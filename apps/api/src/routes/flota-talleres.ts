// ═══════════════════════════════════════════════════════════════
// FLOTA 360 — TALLERES EXTERNOS / SERVICES OFICIALES
// CRUD de talleres + ciclo de la intervención externa (asignación,
// ingreso, devolución, recepción, garantía, reclamos) y trazabilidad.
// ═══════════════════════════════════════════════════════════════
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getEffectiveTenantId } from '../utils/tenant-bypass.js';
import { applyWorkOrderUpdate } from './maintenance.js';
import {
  abrirIndisponibilidad, cambiarEtapa, episodioAbiertoDe,
  registrarIngresoTaller, registrarSalidaTaller,
} from '../services/unidadEstadoService.js';

const TIPOS_TALLER = ['TALLER_EXTERNO', 'SERVICE_OFICIAL'] as const;
const RESULTADOS_RECEPCION = ['CONFORME', 'OBSERVADO', 'REQUIERE_CORRECCION'] as const;

const tallerSchema = z.object({
  nombre: z.string().min(1).max(200),
  razonSocial: z.string().max(200).optional().nullable(),
  identificacionFiscal: z.string().max(30).optional().nullable(),
  tipo: z.enum(TIPOS_TALLER).default('TALLER_EXTERNO'),
  marcas: z.array(z.string().max(60)).max(50).optional(),
  especialidades: z.array(z.string().max(80)).max(50).optional(),
  direccion: z.string().max(300).optional().nullable(),
  localidad: z.string().max(120).optional().nullable(),
  contactoNombre: z.string().max(160).optional().nullable(),
  telefono: z.string().max(60).optional().nullable(),
  email: z.string().email().max(160).optional().nullable().or(z.literal('')),
  observaciones: z.string().max(1000).optional().nullable(),
  supplierId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().optional(),
  confirmarNombreDuplicado: z.boolean().optional(),
});

function normCuit(v: string | null | undefined): string | null {
  if (!v) return null;
  const n = v.replace(/\D/g, '');
  return n.length ? n : null;
}
function normNombre(v: string): string {
  return v.trim().toLowerCase().replace(/\s+/g, ' ');
}

function actorDe(req: FastifyRequest) {
  const u = (req as any).user;
  return { usuarioId: u?.id ?? null, usuarioNombre: u?.name || u?.email || null };
}

async function registrarEventoTaller(prisma: any, ev: {
  tenantId: string; tallerId: string; workOrderId?: string | null;
  tipo: string; detalle?: string | null; usuarioId?: string | null; usuarioNombre?: string | null;
}) {
  await prisma.flotaTallerEvento.create({
    data: {
      tenantId: ev.tenantId, tallerId: ev.tallerId,
      workOrderId: ev.workOrderId ?? null,
      tipo: ev.tipo, detalle: ev.detalle ?? null,
      usuarioId: ev.usuarioId ?? null, usuarioNombre: ev.usuarioNombre ?? null,
    },
  }).catch((e: any) => console.error('[talleres] evento error:', e));
}

// Recalcula costoExterno de la OT desde sus facturas vinculadas y actualiza totalCost.
// Reglas anti-doble-conteo:
//   - PRESUPUESTO nunca suma (es cotización, no gasto ejecutado).
//   - NOTA_CREDITO resta.
//   - montoRepuestosPropios se excluye del total (esos repuestos ya están en partsCost vía stock).
//   - Solo se suma moneda ARS: otras monedas se registran pero no se mezclan sin conversión.
export async function recalcularCostoExterno(prisma: any, tenantId: string, workOrderId: string) {
  const facturas = await prisma.flotaFactura.findMany({
    where: { tenantId, workOrderId, moneda: 'ARS' },
    select: { tipoComprobante: true, total: true, montoRepuestosPropios: true },
  });
  let costoExterno = 0;
  for (const f of facturas) {
    if (f.tipoComprobante === 'PRESUPUESTO') continue;
    const signo = f.tipoComprobante === 'NOTA_CREDITO' ? -1 : 1;
    costoExterno += signo * Math.max(0, (f.total || 0) - (f.montoRepuestosPropios || 0));
  }
  const ot = await prisma.workOrder.findFirst({ where: { id: workOrderId, tenantId } });
  if (!ot) return null;
  const totalCost = (ot.laborCost || 0) + (ot.partsCost || 0) + costoExterno;
  return prisma.workOrder.update({
    where: { id: workOrderId },
    data: { costoExterno, totalCost },
  });
}

export default async function talleresRoutes(app: FastifyInstance) {

  // ═══════════════════════════════════════════════════════════════
  // TALLERES — CRUD
  // ═══════════════════════════════════════════════════════════════

  // GET /flota/talleres — lista con conteo de OTs abiertas
  app.get('/talleres', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { q, tipo, activos } = req.query as any;
    const talleres = await (app.prisma as any).flotaTaller.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(tipo ? { tipo } : {}),
        ...(activos === '1' ? { isActive: true } : {}),
        ...(q ? { OR: [
          { nombre: { contains: q, mode: 'insensitive' } },
          { razonSocial: { contains: q, mode: 'insensitive' } },
          { identificacionFiscal: { contains: String(q).replace(/\D/g, '') || q } },
        ] } : {}),
      },
      orderBy: { nombre: 'asc' },
    });
    // Conteo de OTs abiertas por taller
    const abiertas = await (app.prisma as any).workOrder.groupBy({
      by: ['tallerId'],
      where: { tenantId, tallerId: { not: null }, status: { in: ['PENDING', 'IN_PROGRESS', 'ON_HOLD'] } },
      _count: { _all: true },
    });
    const porTaller = new Map(abiertas.map((g: any) => [g.tallerId, g._count._all]));
    return reply.send({
      talleres: talleres.map((t: any) => ({ ...t, otsAbiertas: porTaller.get(t.id) || 0 })),
    });
  });

  // GET /flota/talleres/proveedores-lookup — buscar en el catálogo Supplier para no duplicar
  app.get('/talleres/proveedores-lookup', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { q } = req.query as any;
    if (!q || String(q).length < 2) return reply.send({ proveedores: [] });
    const proveedores = await (app.prisma as any).supplier.findMany({
      where: {
        tenantId, deletedAt: null,
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { legalName: { contains: q, mode: 'insensitive' } },
          { taxId: { contains: q } },
        ],
      },
      select: { id: true, name: true, legalName: true, taxId: true, email: true, phone: true },
      take: 10,
    }).catch(() => []);
    return reply.send({ proveedores });
  });

  // POST /flota/talleres — alta
  app.post('/talleres', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const body = tallerSchema.safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos', details: body.error.errors });
    const d = body.data;

    // Duplicado duro por identificación fiscal (normalizada, solo dígitos)
    const cuit = normCuit(d.identificacionFiscal);
    if (cuit) {
      const existentes = await (app.prisma as any).flotaTaller.findMany({ where: { tenantId, deletedAt: null }, select: { id: true, nombre: true, identificacionFiscal: true } });
      const mismoCuit = existentes.find((t: any) => normCuit(t.identificacionFiscal) === cuit);
      if (mismoCuit) {
        return reply.code(409).send({ error: `Ya existe un taller con esa identificación fiscal: ${mismoCuit.nombre}`, code: 'ID_FISCAL_DUPLICADA', existenteId: mismoCuit.id });
      }
    }
    // Advertencia por nombre similar (no bloquea salvo que el front lo confirme)
    const existentesNombre = await (app.prisma as any).flotaTaller.findMany({ where: { tenantId, deletedAt: null }, select: { id: true, nombre: true } });
    const mismoNombre = existentesNombre.find((t: any) => normNombre(t.nombre) === normNombre(d.nombre));
    if (mismoNombre && !d.confirmarNombreDuplicado) {
      return reply.code(409).send({ error: `Ya existe un taller llamado "${mismoNombre.nombre}". Confirmá si querés crearlo igual.`, code: 'NOMBRE_DUPLICADO', existenteId: mismoNombre.id });
    }

    const actor = actorDe(req);
    const taller = await (app.prisma as any).flotaTaller.create({
      data: {
        tenantId,
        nombre: d.nombre.trim(),
        razonSocial: d.razonSocial || null,
        identificacionFiscal: d.identificacionFiscal || null,
        tipo: d.tipo,
        marcas: d.marcas || [],
        especialidades: d.especialidades || [],
        direccion: d.direccion || null,
        localidad: d.localidad || null,
        contactoNombre: d.contactoNombre || null,
        telefono: d.telefono || null,
        email: d.email || null,
        observaciones: d.observaciones || null,
        supplierId: d.supplierId || null,
        isActive: d.isActive ?? true,
      },
    });
    await registrarEventoTaller(app.prisma, { tenantId, tallerId: taller.id, tipo: 'ALTA_TALLER', detalle: `Alta de ${taller.tipo === 'SERVICE_OFICIAL' ? 'service oficial' : 'taller externo'} "${taller.nombre}"`, ...actor });
    return reply.code(201).send({ taller });
  });

  // GET /flota/talleres/:id — ficha completa: datos + OTs + facturas + eventos + métricas
  app.get('/talleres/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const { vehiculoId, desde, hasta, estado, dias } = req.query as any;

    const taller = await (app.prisma as any).flotaTaller.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!taller) return reply.code(404).send({ error: 'Taller no encontrado' });

    // Resolver vehículos por asset para poder filtrar por unidad
    const vehiculos = await (app.prisma as any).vehiculo.findMany({
      where: { tenantId, maintenanceAssetId: { not: null } },
      select: { id: true, dominio: true, tipo: true, maintenanceAssetId: true },
    });
    const assetAVeh = new Map(vehiculos.map((v: any) => [v.maintenanceAssetId, v]));
    const vehSeleccionado = vehiculoId ? vehiculos.find((v: any) => v.id === vehiculoId) : null;

    const whereOt: any = { tenantId, tallerId: id };
    if (vehSeleccionado) whereOt.assetId = vehSeleccionado.maintenanceAssetId;
    if (estado) whereOt.status = estado;
    if (desde || hasta) {
      whereOt.createdAt = {};
      if (desde) whereOt.createdAt.gte = new Date(desde);
      if (hasta) whereOt.createdAt.lte = new Date(`${hasta}T23:59:59.999Z`);
    }

    const [ots, facturas, eventos] = await Promise.all([
      (app.prisma as any).workOrder.findMany({
        where: whereOt,
        orderBy: { createdAt: 'desc' },
        take: 200,
        select: {
          id: true, code: true, title: true, status: true, type: true, priority: true,
          assetId: true, scheduledDate: true, createdAt: true, completedAt: true,
          fechaIngresoTaller: true, fechaEntregaEstimada: true, fechaDevolucion: true,
          recepcionResultado: true, sinCargo: true, reclamoDeOtId: true,
          laborCost: true, partsCost: true, costoExterno: true, totalCost: true,
          referenciaExterna: true, trabajoSolicitado: true,
        },
      }),
      (app.prisma as any).flotaFactura.findMany({
        where: { tenantId, tallerId: id },
        orderBy: { fecha: 'desc' },
        take: 200,
        select: {
          id: true, tipoComprobante: true, numero: true, puntoVenta: true, fecha: true,
          total: true, neto: true, iva: true, moneda: true, concepto: true, categoria: true,
          workOrderId: true, vehiculoId: true, fileUrl: true, fileName: true,
          notaCreditoDeId: true, montoRepuestosPropios: true,
        },
      }),
      (app.prisma as any).flotaTallerEvento.findMany({
        where: { tenantId, tallerId: id },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ]);

    // ── Métricas del taller (distintos cero de falta de datos) ──
    const periodoDias = Math.min(365, Math.max(1, parseInt(dias || '90', 10) || 90));
    const desdePeriodo = new Date(Date.now() - periodoDias * 86400000);

    const otsAbiertas = ots.filter((o: any) => ['PENDING', 'IN_PROGRESS', 'ON_HOLD'].includes(o.status)).length;
    const otsTerminadas = ots.filter((o: any) => o.status === 'COMPLETED').length;

    // Costos reales por período: solo facturas no-PRESUPUESTO en ARS (NC resta)
    const facturasPeriodo = facturas.filter((f: any) => new Date(f.fecha) >= desdePeriodo && f.moneda === 'ARS' && f.tipoComprobante !== 'PRESUPUESTO');
    const costoPeriodo = facturasPeriodo.reduce((s: number, f: any) => s + (f.tipoComprobante === 'NOTA_CREDITO' ? -f.total : f.total), 0);
    const hayFacturasOtraMoneda = facturas.some((f: any) => f.moneda && f.moneda !== 'ARS');

    // Permanencia: ingreso → devolución (solo OTs con ambas fechas)
    const conPermanencia = ots.filter((o: any) => o.fechaIngresoTaller && o.fechaDevolucion);
    const permanencias = conPermanencia.map((o: any) => (new Date(o.fechaDevolucion).getTime() - new Date(o.fechaIngresoTaller).getTime()) / 86400000);
    const permanenciaPromedioDias = permanencias.length ? Math.round((permanencias.reduce((a: number, b: number) => a + b, 0) / permanencias.length) * 10) / 10 : null;

    // Fuera de fecha: solo cuando existía fecha comprometida y la devolución la superó
    const fueraDeFecha = ots.filter((o: any) => o.fechaEntregaEstimada && o.fechaDevolucion && new Date(o.fechaDevolucion) > new Date(o.fechaEntregaEstimada)).length;

    const observados = ots.filter((o: any) => ['OBSERVADO', 'REQUIERE_CORRECCION'].includes(o.recepcionResultado)).length;
    const reclamos = ots.filter((o: any) => o.reclamoDeOtId).length;

    return reply.send({
      taller,
      ots: ots.map((o: any) => ({ ...o, vehiculo: o.assetId ? assetAVeh.get(o.assetId) || null : null })),
      facturas,
      eventos,
      metricas: {
        otsAbiertas, otsTerminadas, otsTotal: ots.length,
        costoPeriodo: Math.round(costoPeriodo * 100) / 100, periodoDias,
        hayFacturasOtraMoneda,
        permanenciaPromedioDias, permanenciasConDatos: permanencias.length,
        fueraDeFecha, observados, reclamos,
      },
    });
  });

  // PATCH /flota/talleres/:id — edición con registro de cambios
  app.patch('/talleres/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const taller = await (app.prisma as any).flotaTaller.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!taller) return reply.code(404).send({ error: 'Taller no encontrado' });

    const body = tallerSchema.partial().safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos', details: body.error.errors });
    const d = body.data;

    // Duplicado por identificación fiscal al editar
    if (d.identificacionFiscal !== undefined) {
      const cuit = normCuit(d.identificacionFiscal);
      if (cuit) {
        const existentes = await (app.prisma as any).flotaTaller.findMany({ where: { tenantId, deletedAt: null, id: { not: id } }, select: { id: true, nombre: true, identificacionFiscal: true } });
        const mismoCuit = existentes.find((t: any) => normCuit(t.identificacionFiscal) === cuit);
        if (mismoCuit) return reply.code(409).send({ error: `La identificación fiscal ya pertenece a "${mismoCuit.nombre}"`, code: 'ID_FISCAL_DUPLICADA' });
      }
    }
    if (d.nombre !== undefined) {
      const existentes = await (app.prisma as any).flotaTaller.findMany({ where: { tenantId, deletedAt: null, id: { not: id } }, select: { nombre: true } });
      if (existentes.some((t: any) => normNombre(t.nombre) === normNombre(d.nombre!)) && !d.confirmarNombreDuplicado) {
        return reply.code(409).send({ error: 'Ya existe otro taller con ese nombre. Confirmá si querés guardarlo igual.', code: 'NOMBRE_DUPLICADO' });
      }
    }

    const campos = ['nombre', 'razonSocial', 'identificacionFiscal', 'tipo', 'direccion', 'localidad', 'contactoNombre', 'telefono', 'email', 'observaciones', 'isActive'] as const;
    const cambios: string[] = [];
    for (const c of campos) {
      if (d[c] !== undefined && (taller as any)[c] !== (d as any)[c]) cambios.push(c);
    }
    if (d.marcas !== undefined && JSON.stringify(d.marcas) !== JSON.stringify(taller.marcas)) cambios.push('marcas');
    if (d.especialidades !== undefined && JSON.stringify(d.especialidades) !== JSON.stringify(taller.especialidades)) cambios.push('especialidades');

    const data: any = {};
    for (const c of campos) if (d[c] !== undefined) data[c] = c === 'nombre' ? String(d[c]).trim() : d[c];
    if (d.marcas !== undefined) data.marcas = d.marcas;
    if (d.especialidades !== undefined) data.especialidades = d.especialidades;
    if (d.supplierId !== undefined) data.supplierId = d.supplierId;

    const actualizado = await (app.prisma as any).flotaTaller.update({ where: { id }, data });
    const actor = actorDe(req);
    if (cambios.length) {
      await registrarEventoTaller(app.prisma, { tenantId, tallerId: id, tipo: 'EDICION_TALLER', detalle: `Campos actualizados: ${cambios.join(', ')}`, ...actor });
    }
    if (d.isActive === false && taller.isActive) {
      await registrarEventoTaller(app.prisma, { tenantId, tallerId: id, tipo: 'EDICION_TALLER', detalle: 'Taller desactivado: no acepta nuevas asignaciones; se conservan OTs e historial', ...actor });
    }
    return reply.send({ taller: actualizado });
  });

  // DELETE /flota/talleres/:id — baja lógica (preserva OTs, facturas y eventos)
  app.delete('/talleres/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const taller = await (app.prisma as any).flotaTaller.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!taller) return reply.code(404).send({ error: 'Taller no encontrado' });
    const actor = actorDe(req);
    await (app.prisma as any).flotaTaller.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
    await registrarEventoTaller(app.prisma, { tenantId, tallerId: id, tipo: 'EDICION_TALLER', detalle: 'Taller dado de baja (historial preservado)', ...actor });
    return reply.send({ ok: true });
  });

  // ═══════════════════════════════════════════════════════════════
  // ASIGNACIÓN / DERIVACIÓN DE OTs
  // ═══════════════════════════════════════════════════════════════

  // POST /flota/ots/:id/derivar — asignar o cambiar ejecutor (interno↔externo) con trazabilidad
  app.post('/ots/:id/derivar', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const schema = z.object({
      ejecutorTipo: z.enum(['INTERNO', 'EXTERNO']),
      tallerId: z.string().uuid().optional().nullable(),
      technicianId: z.string().uuid().optional().nullable(),
      responsableSeguimientoId: z.string().uuid().optional().nullable(),
      responsableSeguimientoNombre: z.string().max(160).optional().nullable(),
      motivo: z.string().max(500).optional().nullable(),
    });
    const body = schema.safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos' });
    const d = body.data;

    const ot = await (app.prisma as any).workOrder.findFirst({ where: { id, tenantId }, include: { taller: true, technician: true } });
    if (!ot) return reply.code(404).send({ error: 'Orden de trabajo no encontrada' });
    if (ot.status === 'COMPLETED' || ot.status === 'CANCELLED') {
      return reply.code(400).send({ error: 'No se puede derivar una OT cerrada' });
    }

    const actor = actorDe(req);
    let detalleEvento = '';
    let data: any = {
      ejecutorTipo: d.ejecutorTipo,
      responsableSeguimientoId: d.responsableSeguimientoId ?? null,
      responsableSeguimientoNombre: d.responsableSeguimientoNombre ?? null,
    };

    if (d.ejecutorTipo === 'EXTERNO') {
      if (!d.tallerId) return reply.code(400).send({ error: 'Seleccioná el taller' });
      const taller = await (app.prisma as any).flotaTaller.findFirst({ where: { id: d.tallerId, tenantId, deletedAt: null } });
      if (!taller) return reply.code(404).send({ error: 'Taller no encontrado' });
      if (!taller.isActive) return reply.code(409).send({ error: `El taller "${taller.nombre}" está inactivo y no acepta nuevas asignaciones`, code: 'TALLER_INACTIVO' });
      data.tallerId = taller.id;
      data.technicianId = null; // un solo ejecutor
      detalleEvento = `${ot.tallerId === taller.id ? 'Reasignación' : ot.technicianId ? 'Derivación de mecánico a taller' : 'Asignación'} a ${taller.nombre}${ot.technician?.name ? ` (antes: ${ot.technician.name})` : ''}`;
    } else {
      data.tallerId = null;
      data.technicianId = d.technicianId ?? null;
      const tec = d.technicianId ? await (app.prisma as any).maintenanceTechnician.findFirst({ where: { id: d.technicianId, tenantId } }) : null;
      detalleEvento = `Derivación a ejecución interna${tec ? `: ${tec.name}` : ' (sin mecánico asignado)'}${ot.taller ? ` (antes: ${ot.taller.nombre})` : ''}`;
    }

    const actualizada = await (app.prisma as any).workOrder.update({ where: { id }, data, include: { taller: true, technician: true } });
    if (d.motivo) detalleEvento += ` — Motivo: ${d.motivo}`;
    // El evento se registra contra el taller nuevo (o el anterior si se desasignó a interno)
    const tallerEventoId = data.tallerId || ot.tallerId;
    if (tallerEventoId) {
      await registrarEventoTaller(app.prisma, { tenantId, tallerId: tallerEventoId, workOrderId: id, tipo: ot.tallerId && data.tallerId && ot.tallerId !== data.tallerId ? 'DERIVACION' : 'ASIGNACION', detalle: `OT ${ot.code}: ${detalleEvento}`, ...actor });
    }
    // Si antes tenía otro taller distinto, también dejar registro en ese taller
    if (ot.tallerId && data.tallerId && ot.tallerId !== data.tallerId) {
      await registrarEventoTaller(app.prisma, { tenantId, tallerId: ot.tallerId, workOrderId: id, tipo: 'DERIVACION', detalle: `OT ${ot.code} reasignada a otro taller`, ...actor });
    }
    return reply.send({ workOrder: actualizada });
  });

  // ═══════════════════════════════════════════════════════════════
  // SEGUIMIENTO DE LA INTERVENCIÓN EXTERNA
  // ═══════════════════════════════════════════════════════════════

  const requireExterna = async (id: string, tenantId: string) =>
    (app.prisma as any).workOrder.findFirst({ where: { id, tenantId }, include: { taller: true } });

  // POST /flota/ots/:id/ingreso-taller — ingreso efectivo: activa la OT y marca la unidad en taller
  app.post('/ots/:id/ingreso-taller', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const schema = z.object({
      fechaIngreso: z.string().optional(),
      fechaEntregaEstimada: z.string().optional().nullable(),
      trabajoSolicitado: z.string().max(2000).optional(),
      referenciaExterna: z.string().max(120).optional().nullable(),
      observaciones: z.string().max(1000).optional().nullable(),
    });
    const body = schema.safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos' });
    const d = body.data;

    const ot = await requireExterna(id, tenantId);
    if (!ot) return reply.code(404).send({ error: 'Orden de trabajo no encontrada' });
    if (ot.ejecutorTipo !== 'EXTERNO' || !ot.tallerId) return reply.code(400).send({ error: 'La OT no está asignada a un taller' });
    if (ot.status === 'COMPLETED' || ot.status === 'CANCELLED') return reply.code(400).send({ error: 'La OT ya está cerrada' });
    if (ot.fechaIngresoTaller) return reply.code(409).send({ error: 'El ingreso al taller ya fue registrado', fechaIngresoTaller: ot.fechaIngresoTaller });

    // El ingreso efectivo pone la OT en proceso (→ unidad EN_TALLER por la lógica unificada).
    // Una OT solo asignada/programada a futuro NO cambia la disponibilidad.
    const result = await applyWorkOrderUpdate(app.prisma, tenantId, id, {
      status: 'IN_PROGRESS',
      startedAt: ot.startedAt || new Date(d.fechaIngreso || Date.now()),
      _userId: actorDe(req).usuarioId,
    });
    if ('error' in result) return reply.code(result.status).send({ error: result.error });

    const fechaIngreso = d.fechaIngreso ? new Date(d.fechaIngreso) : new Date();
    const actualizada = await (app.prisma as any).workOrder.update({
      where: { id },
      data: {
        // Ingreso físico a taller externo = la unidad está retirada del
        // servicio (evidencia definitiva, aunque la OT no lo marcara).
        retiraDeServicio: true,
        fechaIngresoTaller: fechaIngreso,
        fechaEntregaEstimada: d.fechaEntregaEstimada ? new Date(d.fechaEntregaEstimada) : undefined,
        trabajoSolicitado: d.trabajoSolicitado ?? ot.trabajoSolicitado,
        referenciaExterna: d.referenciaExterna ?? ot.referenciaExterna,
        observacionesExternas: d.observaciones ?? ot.observacionesExternas,
      },
      include: { taller: true },
    });
    // Episodio: el ingreso efectivo se registra sobre la misma indisponibilidad
    // (abierta por la OT o absorbida ahora) + ubicación declarada en el taller.
    const veh = await (app.prisma as any).vehiculo.findFirst({
      where: { maintenanceAssetId: ot.assetId, tenantId }, select: { id: true },
    });
    if (veh) {
      const act = actorDe(req);
      const usuario = { id: act.usuarioId ?? null, nombre: act.usuarioNombre ?? null };
      await app.prisma.$transaction(async (tx: any) => {
        const r: any = await abrirIndisponibilidad(tx, {
          tenantId, vehiculoId: veh.id, origen: 'OT',
          motivo: `OT ${ot.code} — ingreso a taller externo`,
          etapa: 'PENDIENTE_DIAGNOSTICO', workOrderId: id,
          tallerTipo: 'EXTERNO', tallerId: ot.tallerId,
          tallerNombre: actualizada.taller?.nombre ?? null,
          fechaIngresoTaller: fechaIngreso,
          fechaDevolucionEstimada: d.fechaEntregaEstimada ? new Date(d.fechaEntregaEstimada) : null,
          usuario,
        });
        if (!r?.error && r?.episodio) {
          await registrarIngresoTaller(tx, {
            tenantId, indisponibilidadId: r.episodio.id, fecha: fechaIngreso,
            tallerTipo: 'EXTERNO', tallerId: ot.tallerId,
            tallerNombre: actualizada.taller?.nombre ?? null,
            fechaDevolucionEstimada: d.fechaEntregaEstimada ? new Date(d.fechaEntregaEstimada) : undefined,
            usuario,
          });
        }
      });
    }
    await registrarEventoTaller(app.prisma, {
      tenantId, tallerId: ot.tallerId, workOrderId: id, tipo: 'INGRESO',
      detalle: `OT ${ot.code} ingresó al taller${d.referenciaExterna ? ` (ref. ${d.referenciaExterna})` : ''}`, ...actorDe(req),
    });
    return reply.send({ workOrder: actualizada });
  });

  // POST /flota/ots/:id/devolucion — devolución de la unidad (NO habilita ni cierra la OT)
  app.post('/ots/:id/devolucion', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const schema = z.object({
      fechaDevolucion: z.string().optional(),
      trabajoRealizado: z.string().max(2000).optional(),
      observaciones: z.string().max(1000).optional().nullable(),
      odometro: z.number().nonnegative().optional(),
    });
    const body = schema.safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos' });
    const d = body.data;

    const ot = await requireExterna(id, tenantId);
    if (!ot) return reply.code(404).send({ error: 'Orden de trabajo no encontrada' });
    if (!ot.tallerId) return reply.code(400).send({ error: 'La OT no está asignada a un taller' });
    if (ot.fechaDevolucion) return reply.code(409).send({ error: 'La devolución ya fue registrada', fechaDevolucion: ot.fechaDevolucion });

    const actualizada = await (app.prisma as any).workOrder.update({
      where: { id },
      data: {
        fechaDevolucion: d.fechaDevolucion ? new Date(d.fechaDevolucion) : new Date(),
        trabajoRealizado: d.trabajoRealizado ?? ot.trabajoRealizado,
        observacionesExternas: d.observaciones ?? ot.observacionesExternas,
      },
      include: { taller: true },
    });
    // La devolución NO habilita la unidad ni completa la OT: se marca la
    // salida física del taller en el episodio y la etapa pasa a
    // PENDIENTE_VERIFICACION (la recepción/conformidad y la habilitación
    // siguen siendo pasos separados del circuito unificado).
    const veh = await (app.prisma as any).vehiculo.findFirst({
      where: { maintenanceAssetId: ot.assetId, tenantId }, select: { id: true },
    });
    if (veh) {
      const act = actorDe(req);
      const usuario = { id: act.usuarioId ?? null, nombre: act.usuarioNombre ?? null };
      await app.prisma.$transaction(async (tx: any) => {
        const ep = await episodioAbiertoDe(tx, tenantId, veh.id);
        if (ep) {
          await registrarSalidaTaller(tx, {
            tenantId, indisponibilidadId: ep.id,
            fecha: d.fechaDevolucion ? new Date(d.fechaDevolucion) : new Date(),
            usuario,
          });
          await cambiarEtapa(tx, {
            tenantId, indisponibilidadId: ep.id, etapa: 'PENDIENTE_VERIFICACION',
            comentario: `Unidad devuelta por el taller (OT ${ot.code}) — pendiente recepción y verificación`,
            workOrderId: id, usuario,
          });
        }
      });
    }
    await registrarEventoTaller(app.prisma, {
      tenantId, tallerId: ot.tallerId, workOrderId: id, tipo: 'DEVOLUCION',
      detalle: `OT ${ot.code}: unidad devuelta por el taller`, ...actorDe(req),
    });
    return reply.send({ workOrder: actualizada });
  });

  // POST /flota/ots/:id/recepcion — conformidad del trabajo recibido
  app.post('/ots/:id/recepcion', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const schema = z.object({
      resultado: z.enum(RESULTADOS_RECEPCION),
      notas: z.string().max(2000).optional().nullable(),
      evidenciaUrl: z.string().max(500).optional().nullable(),
      // Solo las tareas indicadas pasan a COMPLETED — las no listadas quedan pendientes
      tareasCompletadasIds: z.array(z.string().uuid()).optional(),
    });
    const body = schema.safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos' });
    const d = body.data;

    const ot = await requireExterna(id, tenantId);
    if (!ot) return reply.code(404).send({ error: 'Orden de trabajo no encontrada' });
    const actor = actorDe(req);

    await app.prisma.$transaction(async (tx: any) => {
      await tx.workOrder.update({
        where: { id },
        data: {
          recepcionAt: new Date(),
          recepcionUsuarioId: actor.usuarioId,
          recepcionUsuarioNombre: actor.usuarioNombre,
          recepcionResultado: d.resultado,
          recepcionNotas: d.notas ?? null,
          recepcionEvidenciaUrl: d.evidenciaUrl ?? null,
        },
      });
      // Recepción parcial: marcar únicamente las tareas efectivamente completadas.
      // No se toca el status de la OT ni se habilita la unidad.
      if (d.tareasCompletadasIds?.length) {
        await tx.workOrderTask.updateMany({
          where: { workOrderId: id, tenantId, id: { in: d.tareasCompletadasIds }, status: 'PENDING' },
          data: { status: 'COMPLETED', completedAt: new Date() },
        });
      }
    });

    if (ot.tallerId) {
      await registrarEventoTaller(app.prisma, {
        tenantId, tallerId: ot.tallerId, workOrderId: id, tipo: 'RECEPCION',
        detalle: `OT ${ot.code}: recepción ${d.resultado}${d.notas ? ` — ${d.notas}` : ''}`, ...actor,
      });
    }
    const actualizada = await (app.prisma as any).workOrder.findUnique({ where: { id }, include: { taller: true, tareas: true } });
    return reply.send({ workOrder: actualizada });
  });

  // PUT /flota/ots/:id/garantia — registrar/actualizar garantía del trabajo
  app.put('/ots/:id/garantia', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const schema = z.object({
      garantiaAlcance: z.string().max(500).optional().nullable(),
      garantiaInicio: z.string().optional().nullable(),
      garantiaFechaLimite: z.string().optional().nullable(),
      garantiaKmLimite: z.number().nonnegative().optional().nullable(),
      garantiaCondiciones: z.string().max(2000).optional().nullable(),
      garantiaDocUrl: z.string().max(500).optional().nullable(),
    });
    const body = schema.safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos' });
    const d = body.data;

    const ot = await requireExterna(id, tenantId);
    if (!ot) return reply.code(404).send({ error: 'Orden de trabajo no encontrada' });

    const actualizada = await (app.prisma as any).workOrder.update({
      where: { id },
      data: {
        garantiaAlcance: d.garantiaAlcance ?? ot.garantiaAlcance,
        garantiaInicio: d.garantiaInicio ? new Date(d.garantiaInicio) : ot.garantiaInicio,
        garantiaFechaLimite: d.garantiaFechaLimite ? new Date(d.garantiaFechaLimite) : ot.garantiaFechaLimite,
        garantiaKmLimite: d.garantiaKmLimite ?? ot.garantiaKmLimite,
        garantiaCondiciones: d.garantiaCondiciones ?? ot.garantiaCondiciones,
        garantiaDocUrl: d.garantiaDocUrl ?? ot.garantiaDocUrl,
      },
      include: { taller: true },
    });
    if (ot.tallerId) {
      await registrarEventoTaller(app.prisma, {
        tenantId, tallerId: ot.tallerId, workOrderId: id, tipo: 'GARANTIA',
        detalle: `OT ${ot.code}: garantía registrada/actualizada`, ...actorDe(req),
      });
    }
    return reply.send({ workOrder: actualizada });
  });

  // POST /flota/ots/:id/reclamo — crear OT de reclamo/devolución vinculada (puede ser sin cargo)
  app.post('/ots/:id/reclamo', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const schema = z.object({
      title: z.string().min(1).max(300),
      description: z.string().max(2000).optional().nullable(),
      sinCargo: z.boolean().default(true), // reclamo de garantía: sin costo nuevo por defecto
      scheduledDate: z.string().optional(),
    });
    const body = schema.safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos' });
    const d = body.data;

    const origen = await requireExterna(id, tenantId);
    if (!origen) return reply.code(404).send({ error: 'OT origen no encontrada' });

    const actor = actorDe(req);
    const reclamo = await (app.prisma as any).workOrder.create({
      data: {
        code: `OT-R-${Date.now().toString().slice(-6)}`,
        title: d.title,
        description: d.description || `Reclamo/devolución sobre ${origen.code}`,
        type: 'CORRECTIVE', priority: origen.priority, status: 'PENDING',
        assetId: origen.assetId, tenantId,
        reclamoDeOtId: origen.id,
        sinCargo: d.sinCargo,
        ejecutorTipo: origen.ejecutorTipo,
        tallerId: d.sinCargo ? origen.tallerId : null, // reclamo de garantía vuelve al mismo taller
        technicianId: null,
        scheduledDate: d.scheduledDate ? new Date(d.scheduledDate) : new Date(),
        activoNombreLibre: origen.activoNombreLibre,
      },
      include: { taller: true },
    });
    if (reclamo.tallerId) {
      await registrarEventoTaller(app.prisma, {
        tenantId, tallerId: reclamo.tallerId, workOrderId: reclamo.id, tipo: 'RECLAMO',
        detalle: `Reclamo ${reclamo.code} sobre OT ${origen.code}${d.sinCargo ? ' (sin cargo — garantía)' : ''}`, ...actor,
      });
    }
    return reply.code(201).send({ workOrder: reclamo });
  });

  // GET /flota/ots/:id/externo — detalle de la intervención externa (OT + facturas + eventos)
  app.get('/ots/:id/externo', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const ot = await (app.prisma as any).workOrder.findFirst({
      where: { id, tenantId },
      include: {
        taller: true, technician: { select: { id: true, name: true } },
        tareas: { select: { id: true, planId: true, status: true, completedAt: true, plan: { select: { id: true, code: true, title: true } } } },
        reclamos: { select: { id: true, code: true, title: true, status: true, sinCargo: true } },
        reclamoDeOt: { select: { id: true, code: true, title: true } },
      },
    });
    if (!ot) return reply.code(404).send({ error: 'Orden de trabajo no encontrada' });
    const [facturas, eventos, repuestos] = await Promise.all([
      (app.prisma as any).flotaFactura.findMany({ where: { tenantId, workOrderId: id }, orderBy: { fecha: 'desc' } }),
      ot.tallerId
        ? (app.prisma as any).flotaTallerEvento.findMany({ where: { tenantId, workOrderId: id }, orderBy: { createdAt: 'desc' }, take: 50 })
        : Promise.resolve([]),
      (app.prisma as any).workOrderSparePart.findMany({
        where: { workOrderId: id, tenantId },
        include: { sparePart: { select: { id: true, code: true, name: true, unitCost: true } } },
      }),
    ]);
    return reply.send({ workOrder: ot, facturas, eventos, repuestos });
  });

  // GET /flota/talleres-ots — selector liviano de OTs externas (filtros para la ficha)
  app.get('/talleres-ots-abiertas', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const ots = await (app.prisma as any).workOrder.findMany({
      where: { tenantId, ejecutorTipo: 'EXTERNO', status: { in: ['PENDING', 'IN_PROGRESS', 'ON_HOLD'] } },
      select: {
        id: true, code: true, title: true, status: true, tallerId: true, assetId: true,
        fechaIngresoTaller: true, fechaEntregaEstimada: true, fechaDevolucion: true, scheduledDate: true,
        taller: { select: { id: true, nombre: true, tipo: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    const vehiculos = await (app.prisma as any).vehiculo.findMany({
      where: { tenantId, maintenanceAssetId: { not: null } },
      select: { id: true, dominio: true, maintenanceAssetId: true },
    });
    const mapa = new Map(vehiculos.map((v: any) => [v.maintenanceAssetId, v]));
    return reply.send({ ots: ots.map((o: any) => ({ ...o, vehiculo: o.assetId ? mapa.get(o.assetId) || null : null })) });
  });
}
