import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getEffectiveTenantId } from '../utils/tenant-bypass.js';
import crypto from 'crypto';
import { notifyIntervencionRegistrada } from '../services/notifyService.js';
import { syncOdometroYDesgaste } from '../services/fleetTires.js';

const generateToken = () => crypto.randomBytes(20).toString('hex');

// ── Catálogo built-in de tareas típicas de mantenimiento vehicular ────────────
const BUILT_IN_TYPES: Array<{ name: string; category: string; km?: number; days?: number }> = [
  // Emergencias en ruta (reportadas por el conductor vía QR) — generan OT urgente automática
  { name: 'Auxilio mecánico en ruta', category: 'EMERGENCIA' },
  { name: 'Grúa / remolque solicitado', category: 'EMERGENCIA' },
  { name: 'Carga de aceite / fluido en ruta', category: 'EMERGENCIA' },
  { name: 'Pinchadura / cambio de rueda en ruta', category: 'EMERGENCIA' },
  { name: 'Falla eléctrica en ruta', category: 'EMERGENCIA' },
  { name: 'Otro imprevisto en ruta', category: 'EMERGENCIA' },
  { name: 'Cambio de aceite y filtro', category: 'MOTOR', km: 10000 },
  { name: 'Cambio de filtro de aire', category: 'MOTOR', km: 20000 },
  { name: 'Cambio de filtro de combustible', category: 'MOTOR', km: 20000 },
  { name: 'Cambio de filtro de habitáculo', category: 'MOTOR', km: 20000 },
  { name: 'Revisión / ajuste de frenos', category: 'FRENOS', km: 10000 },
  { name: 'Cambio de pastillas de freno', category: 'FRENOS', km: 40000 },
  { name: 'Cambio de líquido de frenos', category: 'FRENOS', km: 40000, days: 730 },
  { name: 'Rotación de neumáticos', category: 'NEUMATICOS', km: 10000 },
  { name: 'Cambio de neumáticos', category: 'NEUMATICOS', km: 60000 },
  { name: 'Alineación y balanceo', category: 'NEUMATICOS', km: 10000 },
  { name: 'Revisión de suspensión', category: 'SUSPENSION', km: 20000 },
  { name: 'Cambio de refrigerante', category: 'FLUIDOS', days: 730 },
  { name: 'Cambio de aceite de caja / diferencial', category: 'TRANSMISION', km: 60000 },
  { name: 'Revisión de correas y mangueras', category: 'MOTOR', km: 40000 },
  { name: 'Revisión eléctrica / luces', category: 'ELECTRICO', km: 10000 },
  { name: 'Reparación de espejo / carrocería', category: 'CARROCERIA' },
  { name: 'Lavado y engrase general', category: 'GENERAL', days: 30 },
  { name: 'Verificación técnica / VTV', category: 'GENERAL', days: 365 },
];

export async function maintenanceInterventionsRoutes(app: FastifyInstance) {

  // ── TIPOS DE INTERVENCIÓN (catálogo) ────────────────────────────────────────
  app.get('/types', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });

    let types = await (app.prisma as any).maintenanceInterventionType.findMany({
      where: { tenantId, isActive: true },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    // Seed idempotente del catálogo built-in: agrega los que falten por nombre
    // (cubre tenants nuevos y tenants existentes cuando se suman tipos nuevos)
    const existentes = new Set(types.map((t: any) => t.name));
    const faltantes = BUILT_IN_TYPES.filter(t => !existentes.has(t.name));
    if (faltantes.length > 0) {
      await (app.prisma as any).maintenanceInterventionType.createMany({
        data: faltantes.map(t => ({
          tenantId,
          name: t.name,
          category: t.category,
          defaultKmInterval: t.km ?? null,
          defaultDaysInterval: t.days ?? null,
          isBuiltIn: true,
        })),
      });
      types = await (app.prisma as any).maintenanceInterventionType.findMany({
        where: { tenantId, isActive: true },
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
      });
    }

    return reply.send({ types });
  });

  app.post('/types', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const schema = z.object({
      name: z.string().min(1).max(200),
      category: z.string().default('GENERAL'),
      description: z.string().optional(),
      defaultKmInterval: z.number().int().positive().optional().nullable(),
      defaultDaysInterval: z.number().int().positive().optional().nullable(),
    });
    const body = schema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos', details: body.error.errors });
    const type = await (app.prisma as any).maintenanceInterventionType.create({
      data: { tenantId, ...body.data },
    });
    return reply.code(201).send({ type });
  });

  app.put('/types/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const schema = z.object({
      name: z.string().min(1).max(200).optional(),
      category: z.string().optional(),
      description: z.string().optional().nullable(),
      defaultKmInterval: z.number().int().positive().optional().nullable(),
      defaultDaysInterval: z.number().int().positive().optional().nullable(),
      isActive: z.boolean().optional(),
    });
    const body = schema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos', details: body.error.errors });
    await (app.prisma as any).maintenanceInterventionType.updateMany({
      where: { id, tenantId },
      data: body.data,
    });
    return reply.send({ ok: true });
  });

  app.delete('/types/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    await (app.prisma as any).maintenanceInterventionType.updateMany({
      where: { id, tenantId },
      data: { isActive: false },
    });
    return reply.send({ ok: true });
  });

  // ── QR DE INTERVENCIÓN ──────────────────────────────────────────────────────
  app.get('/qrs', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const qrs = await (app.prisma as any).maintenanceInterventionQR.findMany({
      where: { tenantId, isActive: true },
      include: {
        maintenanceAsset: { select: { id: true, name: true, code: true, currentOdometer: true } },
        _count: { select: { intervenciones: true } },
      },
      orderBy: { generatedAt: 'desc' },
    });
    const baseUrl = process.env.APP_URL || 'https://logismart.ar';
    return reply.send({ qrs: qrs.map((q: any) => ({ ...q, publicUrl: `${baseUrl}/mantenimiento-qr/${q.token}` })) });
  });

  app.post('/qrs', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const schema = z.object({
      maintenanceAssetId: z.string().uuid(),
      titulo: z.string().optional(),
      instrucciones: z.string().optional(),
    });
    const body = schema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos', details: body.error.errors });

    const asset = await (app.prisma as any).maintenanceAsset.findFirst({
      where: { id: body.data.maintenanceAssetId, tenantId },
    });
    if (!asset) return reply.code(404).send({ error: 'Activo no encontrado' });

    // Si ya existe un QR activo para este activo, devolverlo (idempotente)
    const existing = await (app.prisma as any).maintenanceInterventionQR.findFirst({
      where: { maintenanceAssetId: asset.id, tenantId, isActive: true },
    });
    const baseUrl = process.env.APP_URL || 'https://logismart.ar';
    if (existing) {
      return reply.send({ qr: { ...existing, publicUrl: `${baseUrl}/mantenimiento-qr/${existing.token}` }, existing: true });
    }

    const qr = await (app.prisma as any).maintenanceInterventionQR.create({
      data: {
        tenantId,
        token: generateToken(),
        maintenanceAssetId: asset.id,
        activoNombre: asset.name,
        activoCodigo: asset.code,
        titulo: body.data.titulo,
        instrucciones: body.data.instrucciones,
      },
    });
    return reply.code(201).send({ qr: { ...qr, publicUrl: `${baseUrl}/mantenimiento-qr/${qr.token}` } });
  });

  app.delete('/qrs/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    await (app.prisma as any).maintenanceInterventionQR.updateMany({
      where: { id, tenantId },
      data: { isActive: false },
    });
    return reply.send({ ok: true });
  });

  // ── INTERVENCIONES (historial, autenticado) ─────────────────────────────────
  app.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const q = req.query as any;
    const where: any = { tenantId };
    if (q.assetId) where.maintenanceAssetId = q.assetId;
    const intervenciones = await (app.prisma as any).maintenanceIntervention.findMany({
      where,
      include: {
        maintenanceAsset: { select: { id: true, name: true, code: true } },
        plan: { select: { id: true, title: true, code: true } },
        repuestos: { include: { sparePart: { select: { id: true, code: true, name: true } } } },
      },
      orderBy: { performedAt: 'desc' },
      take: q.limit ? parseInt(q.limit) : 100,
    });
    return reply.send({ intervenciones });
  });

  // ── EDITAR intervención (autenticado) ───────────────────────────────────────
  app.put('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;

    const existing = await (app.prisma as any).maintenanceIntervention.findFirst({ where: { id, tenantId } });
    if (!existing) return reply.code(404).send({ error: 'Intervención no encontrada' });

    const schema = z.object({
      tipoIds: z.array(z.string().uuid()).min(1).optional(),
      descripcion: z.string().max(2000).optional().nullable(),
      odometro: z.number().positive().optional().nullable(),
      performedAt: z.string().optional(),
      performedByName: z.string().min(1).max(200).optional(),
      performedByEmail: z.string().email().optional().nullable().or(z.literal('')).transform(v => v || null),
      performedByPhone: z.string().max(50).optional().nullable(),
      planId: z.string().uuid().optional().nullable(),
    });
    const body = schema.safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos', details: body.error.errors });

    const data: any = {};

    if (body.data.tipoIds) {
      const tiposSel = await (app.prisma as any).maintenanceInterventionType.findMany({
        where: { id: { in: body.data.tipoIds }, tenantId },
        select: { name: true },
      });
      if (tiposSel.length === 0) return reply.code(400).send({ error: 'Tipos de intervención inválidos' });
      data.tiposLabel = tiposSel.map((t: any) => t.name);
    }
    if (body.data.descripcion !== undefined) data.descripcion = body.data.descripcion || null;
    if (body.data.odometro !== undefined) data.odometro = body.data.odometro;
    if (body.data.performedAt) data.performedAt = new Date(body.data.performedAt);
    if (body.data.performedByName) data.performedByName = body.data.performedByName;
    if (body.data.performedByEmail !== undefined) data.performedByEmail = body.data.performedByEmail || null;
    if (body.data.performedByPhone !== undefined) data.performedByPhone = body.data.performedByPhone || null;

    if (body.data.planId !== undefined) {
      if (body.data.planId) {
        const plan = await (app.prisma as any).maintenancePlan.findFirst({
          where: { id: body.data.planId, assetId: existing.maintenanceAssetId, tenantId },
        });
        if (!plan) return reply.code(400).send({ error: 'Plan inválido para este activo' });
        data.planId = plan.id;
        data.cumplioPreventivo = true;
      } else {
        data.planId = null;
        data.cumplioPreventivo = false;
      }
    }

    const updated = await (app.prisma as any).maintenanceIntervention.update({
      where: { id },
      data,
      include: {
        maintenanceAsset: { select: { id: true, name: true, code: true } },
        plan: { select: { id: true, title: true, code: true } },
      },
    });
    return reply.send({ intervencion: updated });
  });

  // ── ELIMINAR intervención (autenticado) ─────────────────────────────────────
  app.delete('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;

    const existing = await (app.prisma as any).maintenanceIntervention.findFirst({
      where: { id, tenantId },
      include: { repuestos: true },
    });
    if (!existing) return reply.code(404).send({ error: 'Intervención no encontrada' });

    // Restaurar stock de repuestos consumidos por esta intervención
    for (const r of existing.repuestos || []) {
      try {
        await (app.prisma as any).maintenanceSparePart.update({
          where: { id: r.sparePartId },
          data: { currentStock: { increment: r.quantity } },
        });
      } catch (e: any) { console.error('[intervenciones] error restaurando stock:', e); }
    }

    await (app.prisma as any).maintenanceIntervention.delete({ where: { id } });
    return reply.send({ ok: true });
  });

  // ── RUTA PÚBLICA GET: ficha del activo + preventivos pendientes ─────────────
  app.get('/public/:token', async (req: FastifyRequest, reply: FastifyReply) => {
    const { token } = req.params as any;
    const qr = await (app.prisma as any).maintenanceInterventionQR.findFirst({
      where: { token, isActive: true },
      include: {
        maintenanceAsset: true,
        tenant: { select: { id: true, name: true } },
      },
    });
    if (!qr) return reply.code(404).send({ error: 'QR no encontrado o inactivo' });

    const asset = qr.maintenanceAsset;
    const kmActual = asset.currentOdometer ?? null;

    const [vehiculoFlota, settings, tipos, planes, ultimas, repuestos] = await Promise.all([
      (app.prisma as any).vehiculo.findFirst({
        where: { tenantId: qr.tenantId, maintenanceAssetId: asset.id },
        select: { id: true, dominio: true, estadoOperativo: true, tipo: true, cantEjes: true, configEjes: true },
      }).catch(() => null),
      (app.prisma as any).companySettings.findUnique({
        where: { tenantId: qr.tenantId }, select: { logoUrl: true, primaryColor: true },
      }).catch(() => null),
      (app.prisma as any).maintenanceInterventionType.findMany({
        where: { tenantId: qr.tenantId, isActive: true },
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
      }),
      (app.prisma as any).maintenancePlan.findMany({
        where: { assetId: asset.id, status: 'ACTIVE' },
        orderBy: { nextExecutionDate: 'asc' },
      }),
      (app.prisma as any).maintenanceIntervention.findMany({
        where: { maintenanceAssetId: asset.id },
        orderBy: { performedAt: 'desc' },
        take: 10,
        select: { id: true, tiposLabel: true, descripcion: true, odometro: true, performedAt: true, performedByName: true, cumplioPreventivo: true },
      }),
      (app.prisma as any).maintenanceSparePart.findMany({
        where: { tenantId: qr.tenantId },
        orderBy: { name: 'asc' },
        select: { id: true, code: true, name: true, currentStock: true, unitCost: true },
      }),
    ]);

    // Calcular estado de cada plan preventivo
    const now = new Date();
    const preventivos = planes.map((p: any) => {
      let estado: 'VENCIDO' | 'PROXIMO' | 'AL_DIA' = 'AL_DIA';
      let detalle = '';
      if (p.frequencyUnit === 'KM' && p.triggerKm) {
        const base = p.lastOdometerExecution ?? 0;
        const restante = kmActual != null ? (base + p.triggerKm) - kmActual : null;
        detalle = `cada ${p.triggerKm.toLocaleString('es-AR')} km` + (restante != null ? ` · faltan ${Math.max(0, Math.round(restante)).toLocaleString('es-AR')} km` : '');
        if (restante != null && restante <= 0) estado = 'VENCIDO';
        else if (restante != null && restante <= Math.max(500, p.triggerKm * 0.1)) estado = 'PROXIMO';
      } else if (p.nextExecutionDate) {
        const dias = Math.ceil((new Date(p.nextExecutionDate).getTime() - now.getTime()) / 86400000);
        detalle = `próxima: ${new Date(p.nextExecutionDate).toLocaleDateString('es-AR')} (${dias} días)`;
        if (dias < 0) estado = 'VENCIDO';
        else if (dias <= 7) estado = 'PROXIMO';
      }
      return { id: p.id, code: p.code, title: p.title, type: p.type, estado, detalle };
    });

    // Cubiertas montadas + stock disponible (para el item "cambio/rotación de neumático")
    let cubiertas: any[] = [];
    let neumaticosStock: any[] = [];
    if (vehiculoFlota) {
      [cubiertas, neumaticosStock] = await Promise.all([
        (app.prisma as any).neumaticoPosicion.findMany({
          where: { vehiculoId: vehiculoFlota.id, tenantId: qr.tenantId, activo: true },
          include: { neumatico: { select: { id: true, codigo: true, medida: true, condicion: true, profBanda: true } } },
          orderBy: [{ eje: 'asc' }, { lado: 'asc' }, { posicion: 'asc' }],
        }).catch(() => []),
        (app.prisma as any).neumatico.findMany({
          where: { tenantId: qr.tenantId, status: 'DISPONIBLE' },
          select: { id: true, codigo: true, marca: true, medida: true, condicion: true, profBanda: true },
          orderBy: { codigo: 'asc' },
        }).catch(() => []),
      ]);
    }

    return reply.send({
      qr: { id: qr.id, activoNombre: qr.activoNombre, activoCodigo: qr.activoCodigo, titulo: qr.titulo, instrucciones: qr.instrucciones },
      activo: {
        id: asset.id, name: asset.name, code: asset.code, category: asset.category,
        manufacturer: asset.manufacturer, model: asset.model, serialNumber: asset.serialNumber,
        currentOdometer: asset.currentOdometer, status: asset.status,
      },
      empresa: { nombre: qr.tenant.name, logoUrl: settings?.logoUrl ?? null, primaryColor: settings?.primaryColor ?? '#2563eb' },
      vehiculoFlota: vehiculoFlota ?? null,
      cubiertas: cubiertas.map((p: any) => ({
        posicionId: p.id, eje: p.eje, lado: p.lado, posicion: p.posicion,
        neumaticoId: p.neumatico?.id ?? null, codigo: p.neumatico?.codigo ?? null,
        medida: p.neumatico?.medida ?? null, condicion: p.neumatico?.condicion ?? null,
      })),
      neumaticosStock,
      tipos,
      preventivos,
      ultimasIntervenciones: ultimas,
      repuestosDisponibles: repuestos,
    });
  });

  // ── RUTA PÚBLICA POST: cambiar estadío operativo del vehículo (QR mecánico) ──
  // OPERATIVO (disponible) | EN_TALLER (en el taller) | EN_REPARACION (trabajando ahora)
  app.post('/public/:token/estado', async (req: FastifyRequest, reply: FastifyReply) => {
    const { token } = req.params as any;
    const qr = await (app.prisma as any).maintenanceInterventionQR.findFirst({
      where: { token, isActive: true },
      include: { maintenanceAsset: true },
    });
    if (!qr) return reply.code(404).send({ error: 'QR no encontrado o inactivo' });

    const schema = z.object({
      estado: z.enum(['OPERATIVO', 'EN_TALLER', 'EN_REPARACION']),
      notas: z.string().max(500).optional(),
      mecanicoNombre: z.string().max(200).optional(),
    });
    const body = schema.safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos', details: body.error.errors });

    const vehiculo = await (app.prisma as any).vehiculo.findFirst({
      where: { tenantId: qr.tenantId, maintenanceAssetId: qr.maintenanceAsset.id },
    });
    if (!vehiculo) return reply.code(404).send({ error: 'El activo no está vinculado a un vehículo de flota' });
    if (vehiculo.estadoOperativo === body.data.estado) {
      return reply.send({ ok: true, sinCambio: true, estadoOperativo: vehiculo.estadoOperativo });
    }

    let nuevoStatus = vehiculo.status;
    if (body.data.estado === 'EN_TALLER' || body.data.estado === 'EN_REPARACION') nuevoStatus = 'EN_TALLER';
    else if (body.data.estado === 'OPERATIVO' && vehiculo.status === 'EN_TALLER') nuevoStatus = 'ACTIVO';

    await (app.prisma as any).$transaction([
      (app.prisma as any).vehiculoEstadoEvento.create({
        data: {
          tenantId: qr.tenantId, vehiculoId: vehiculo.id, estado: body.data.estado,
          origen: 'QR_MECANICO', notas: body.data.notas ?? null,
          createdByName: body.data.mecanicoNombre ?? null,
        },
      }),
      (app.prisma as any).vehiculo.update({
        where: { id: vehiculo.id },
        data: { estadoOperativo: body.data.estado, status: nuevoStatus },
      }),
    ]);
    return reply.send({ ok: true, estadoOperativo: body.data.estado, status: nuevoStatus });
  });

  // ── RUTA PÚBLICA POST: registrar intervención realizada ─────────────────────
  app.post('/public/:token', async (req: FastifyRequest, reply: FastifyReply) => {
    const { token } = req.params as any;
    const qr = await (app.prisma as any).maintenanceInterventionQR.findFirst({
      where: { token, isActive: true },
      include: { maintenanceAsset: true },
    });
    if (!qr) return reply.code(404).send({ error: 'QR no encontrado o inactivo' });

    const schema = z.object({
      performedByName: z.string().min(1).max(200),
      performedByEmail: z.string().email().optional().or(z.literal('')).transform(v => v || undefined),
      performedByPhone: z.string().max(50).optional().or(z.literal('')).transform(v => v || undefined),
      tipoIds: z.array(z.string().uuid()).min(1, 'Seleccioná al menos una tarea'),
      descripcion: z.string().max(2000).optional(),
      odometro: z.number().positive().optional(),
      performedAt: z.string().optional(),
      planId: z.string().uuid().optional().nullable(),
      fotos: z.array(z.object({ url: z.string() })).optional(),
      repuestos: z.array(z.object({ sparePartId: z.string().uuid(), quantity: z.number().int().positive() })).optional(),
      // Cambio/rotación de neumáticos: a qué posición va cada cubierta (nueva de stock o movida de otra posición)
      neumaticoCambios: z.array(z.object({
        eje: z.number().int().min(0),
        lado: z.enum(['IZQ', 'DER']),
        posicion: z.enum(['SIMPLE', 'EXT', 'INT', 'AUXILIO']).default('SIMPLE'),
        neumaticoId: z.string().uuid(),
      })).optional(),
    });
    const body = schema.safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos', details: body.error.errors });

    // Resolver nombres de tipos seleccionados (snapshot)
    const tiposSel = await (app.prisma as any).maintenanceInterventionType.findMany({
      where: { id: { in: body.data.tipoIds }, tenantId: qr.tenantId },
      select: { id: true, name: true, category: true },
    });
    const tiposLabel = tiposSel.map((t: any) => t.name);
    if (tiposLabel.length === 0) return reply.code(400).send({ error: 'Tipos de intervención inválidos' });

    const asset = qr.maintenanceAsset;
    const km = body.data.odometro ?? null;
    const performedAt = body.data.performedAt ? new Date(body.data.performedAt) : new Date();

    // Validar plan si se indicó cumplimiento de preventivo
    let plan: any = null;
    if (body.data.planId) {
      plan = await (app.prisma as any).maintenancePlan.findFirst({
        where: { id: body.data.planId, assetId: asset.id, tenantId: qr.tenantId },
      });
    }

    const intervencion = await (app.prisma as any).maintenanceIntervention.create({
      data: {
        tenantId: qr.tenantId,
        qrId: qr.id,
        maintenanceAssetId: asset.id,
        tiposLabel,
        descripcion: body.data.descripcion || null,
        odometro: km,
        performedAt,
        performedByName: body.data.performedByName,
        performedByEmail: body.data.performedByEmail || null,
        performedByPhone: body.data.performedByPhone || null,
        fotos: body.data.fotos ?? null,
        planId: plan?.id ?? null,
        cumplioPreventivo: !!plan,
      },
    });

    await (app.prisma as any).maintenanceInterventionQR.update({
      where: { id: qr.id },
      data: { useCount: { increment: 1 }, lastUsedAt: new Date() },
    });

    // Repuestos consumidos: crear registro y descontar stock
    let repuestosCosto = 0;
    if (body.data.repuestos && body.data.repuestos.length > 0) {
      const partesSel = await (app.prisma as any).maintenanceSparePart.findMany({
        where: { id: { in: body.data.repuestos.map(r => r.sparePartId) }, tenantId: qr.tenantId },
      });
      const partesMap = new Map(partesSel.map((p: any) => [p.id, p]));
      for (const r of body.data.repuestos) {
        const parte: any = partesMap.get(r.sparePartId);
        if (!parte) continue;
        try {
          await (app.prisma as any).maintenanceInterventionSparePart.create({
            data: {
              tenantId: qr.tenantId,
              interventionId: intervencion.id,
              sparePartId: parte.id,
              quantity: r.quantity,
              unitCost: parte.unitCost,
            },
          });
          await (app.prisma as any).maintenanceSparePart.update({
            where: { id: parte.id },
            data: { currentStock: { decrement: r.quantity } },
          });
          repuestosCosto += r.quantity * parte.unitCost;
        } catch (e: any) { console.error('[intervenciones] repuesto stock error:', e); }
      }
    }

    // Actualizar activo: odómetro + última fecha de mantenimiento
    try {
      const updateData: any = { lastMaintenanceDate: performedAt };
      if (km && (asset.currentOdometer == null || km > asset.currentOdometer)) {
        updateData.currentOdometer = km;
      }
      await (app.prisma as any).maintenanceAsset.update({ where: { id: asset.id }, data: updateData });
    } catch (e: any) { console.error('[intervenciones] asset update error:', e); }

    // Si se marcó cumplimiento de un plan preventivo, avanzarlo
    if (plan) {
      try {
        const planUpdate: any = {
          lastExecutionDate: performedAt,
          totalExecutions: { increment: 1 },
        };
        if (plan.frequencyUnit === 'KM' && km) {
          planUpdate.lastOdometerExecution = km;
        } else if (plan.nextExecutionDate) {
          const next = new Date(plan.nextExecutionDate);
          switch (plan.frequencyUnit) {
            case 'DAYS': next.setDate(next.getDate() + plan.frequencyValue); break;
            case 'WEEKS': next.setDate(next.getDate() + plan.frequencyValue * 7); break;
            case 'MONTHS': next.setMonth(next.getMonth() + plan.frequencyValue); break;
            case 'YEARS': next.setFullYear(next.getFullYear() + plan.frequencyValue); break;
          }
          planUpdate.nextExecutionDate = next;
        }
        await (app.prisma as any).maintenancePlan.update({ where: { id: plan.id }, data: planUpdate });
      } catch (e: any) { console.error('[intervenciones] plan update error:', e); }
    }

    // Registrar en historial del vehículo de flota (si el activo está vinculado a uno)
    try {
      const vehiculo = await (app.prisma as any).vehiculo.findFirst({
        where: { maintenanceAssetId: asset.id, tenantId: qr.tenantId },
      });
      if (vehiculo) {
        if (km && (vehiculo.currentOdometer == null || km > vehiculo.currentOdometer)) {
          // Actualiza odómetro + acumula desgaste en cubiertas + propaga al acoplado
          await syncOdometroYDesgaste(app.prisma, qr.tenantId, vehiculo.id, km).catch(() => {});
        }
        await (app.prisma as any).vehiculoHistorialMantenimiento.create({
          data: {
            tenantId: qr.tenantId,
            vehiculoId: vehiculo.id,
            fecha: performedAt,
            tipo: plan ? 'PREVENTIVE' : 'CORRECTIVE',
            descripcion: tiposLabel.join(' + ') + (body.data.descripcion ? ` — ${body.data.descripcion}` : ''),
            odometro: km ?? vehiculo.currentOdometer,
            notas: `Registrado vía QR por ${body.data.performedByName}`,
          },
        });

        // ── Cambio / rotación de neumáticos indicado en el diagrama ──────────
        // Una cubierta que ya está montada en ESTE vehículo se REUBICA (update en
        // el lugar, igual que /rotar) — no se desmonta, así no genera un gasto de
        // cubierta espurio ni un desmontaje ficticio. Solo se desmonta lo que sale
        // del vehículo: el ocupante desplazado que no se reubica, o la cubierta
        // que viene de otro vehículo.
        const cambios = body.data.neumaticoCambios;
        if (cambios && cambios.length > 0) {
          try {
            const kmMonto = km ?? vehiculo.currentOdometer ?? null;
            const ahora = new Date();
            const incomingIds = new Set<string>(cambios.map((c: any) => c.neumaticoId));
            const destSlots = new Set<string>(cambios.map((c: any) => `${c.eje}-${c.lado}-${c.posicion}`));
            // Snapshot de posiciones activas del vehículo (para decidir update-in-place)
            const activas = await (app.prisma as any).neumaticoPosicion.findMany({
              where: { vehiculoId: vehiculo.id, tenantId: qr.tenantId, activo: true },
              select: { id: true, neumaticoId: true, eje: true, lado: true, posicion: true },
            });
            const porNeum = new Map<string, any>(activas.map((p: any) => [p.neumaticoId, p]));
            // Posición activa de cada cubierta entrante en CUALQUIER vehículo (origen de la rotación)
            const posGlobales = await (app.prisma as any).neumaticoPosicion.findMany({
              where: { tenantId: qr.tenantId, activo: true, neumaticoId: { in: [...incomingIds] } },
              select: { neumaticoId: true, eje: true, lado: true, posicion: true },
            });
            const origenGlobal = new Map<string, any>(posGlobales.map((p: any) => [p.neumaticoId, p]));

            // PASADA 1 — desmontar SOLO los ocupantes que realmente se van del vehículo:
            // su slot es destino de un cambio y ellos mismos NO se reubican.
            for (const p of activas) {
              const slot = `${p.eje}-${p.lado}-${p.posicion}`;
              if (destSlots.has(slot) && !incomingIds.has(p.neumaticoId)) {
                await (app.prisma as any).neumaticoPosicion.update({
                  where: { id: p.id },
                  data: { activo: false, desmontadoAt: ahora, kmAlDesmontar: kmMonto },
                });
              }
            }

            // PASADA 2 — ubicar cada cubierta entrante en su posición destino
            for (const c of cambios) {
              const neum = await (app.prisma as any).neumatico.findFirst({ where: { id: c.neumaticoId, tenantId: qr.tenantId }, select: { id: true, profBanda: true } });
              if (!neum) continue;
              const yaMontada = porNeum.get(c.neumaticoId);
              const posGlobal = origenGlobal.get(c.neumaticoId);
              const origen = posGlobal ? { eje: posGlobal.eje, lado: posGlobal.lado, posicion: posGlobal.posicion } : null;
              if (yaMontada) {
                // Reubicación dentro del mismo vehículo → update en el lugar (sin desmontar)
                await (app.prisma as any).neumaticoPosicion.update({
                  where: { id: yaMontada.id },
                  data: { eje: c.eje, lado: c.lado, posicion: c.posicion },
                });
              } else {
                // Viene de stock u otro vehículo → desmontarla donde esté + montarla acá
                await (app.prisma as any).neumaticoPosicion.updateMany({
                  where: { neumaticoId: c.neumaticoId, tenantId: qr.tenantId, activo: true },
                  data: { activo: false, desmontadoAt: ahora, kmAlDesmontar: kmMonto },
                });
                await (app.prisma as any).neumaticoPosicion.create({
                  data: {
                    tenantId: qr.tenantId, vehiculoId: vehiculo.id, neumaticoId: c.neumaticoId,
                    eje: c.eje, lado: c.lado, posicion: c.posicion, activo: true,
                    kmAlMontar: kmMonto, profBandaInicio: neum.profBanda ?? null,
                    notas: `Montado en intervención QR por ${body.data.performedByName}`,
                  },
                });
              }
              await (app.prisma as any).neumatico.updateMany({ where: { id: c.neumaticoId }, data: { status: 'EN_USO' } });
              await (app.prisma as any).neumaticoRotacion.create({
                data: {
                  tenantId: qr.tenantId, neumaticoId: c.neumaticoId, vehiculoId: vehiculo.id,
                  ejeOrigen: origen?.eje ?? 0, ladoOrigen: origen?.lado ?? 'STOCK', posOrigen: origen?.posicion ?? 'STOCK',
                  ejeDestino: c.eje, ladoDestino: c.lado, posDestino: c.posicion,
                  kmAlRotar: kmMonto, notas: `Intervención ${intervencion.id} — ${tiposLabel.join(' + ')}`,
                },
              });
            }
          } catch (e: any) { console.error('[intervenciones] neumaticoCambios error:', e); }
        }
      }
    } catch (e: any) { console.error('[intervenciones] vehiculo historial error:', e); }

    // Emergencia en ruta: si algún tipo seleccionado es EMERGENCIA, generar OT urgente automática
    let otEmergencia: any = null;
    if (tiposSel.some((t: any) => t.category === 'EMERGENCIA')) {
      try {
        otEmergencia = await (app.prisma as any).workOrder.create({
          data: {
            tenantId: qr.tenantId,
            code: `OT-${Date.now().toString().slice(-6)}`,
            title: `EMERGENCIA EN RUTA — ${tiposLabel.join(' + ')}`,
            description: [
              `Reportado por ${body.data.performedByName} vía QR en ruta.`,
              body.data.performedByPhone ? `Tel: ${body.data.performedByPhone}` : null,
              km ? `Odómetro: ${Math.round(km).toLocaleString('es-AR')} km` : null,
              body.data.descripcion ? `Detalle: ${body.data.descripcion}` : null,
            ].filter(Boolean).join('\n'),
            type: 'EMERGENCY',
            priority: 'CRITICAL',
            status: 'PENDING',
            assetId: asset.id,
            origen: 'EMERGENCIA_RUTA',
            scheduledDate: new Date(),
          },
        });
        await (app.prisma as any).maintenanceIntervention.update({
          where: { id: intervencion.id },
          data: { workOrderId: otEmergencia.id },
        });
      } catch (e: any) { console.error('[intervenciones] OT emergencia error:', e); }
    }

    // Notificar a admins
    notifyIntervencionRegistrada(app.prisma, {
      tenantId: qr.tenantId,
      activoNombre: qr.activoNombre,
      tiposLabel,
      performedByName: body.data.performedByName,
      cumplioPreventivo: !!plan,
      planTitle: plan?.title ?? null,
      intervencionId: intervencion.id,
    }).catch((e: any) => console.error('[intervenciones] notify error:', e));

    return reply.code(201).send({
      ok: true,
      intervencionId: intervencion.id,
      cumplioPreventivo: !!plan,
      planTitle: plan?.title ?? null,
      otEmergencia: otEmergencia?.code ?? null,
      repuestosCosto,
      mensaje: plan
        ? `Intervención registrada. Se marcó como cumplido el preventivo "${plan.title}".`
        : 'Intervención registrada correctamente en la ficha del activo.',
    });
  });
}
