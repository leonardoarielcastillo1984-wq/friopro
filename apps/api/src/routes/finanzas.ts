import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getEffectiveTenantId } from '../utils/tenant-bypass.js';
import { existsSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { randomBytes } from 'crypto';

// ════════════════════════════════════════════════════════════════════════════
// RESULTADOS DEL NEGOCIO — /api/finanzas
// Consolidador económico: registra facturación emitida, cobros y gastos
// manuales/estructura; agrega costos desde módulos origen (flota, mantenimiento,
// RRHH) con reglas anti-duplicación. Resultado económico = devengado
// (facturación + ingresos operativos − costos − estructura); cobrado = caja.
// ════════════════════════════════════════════════════════════════════════════

const num = (v: any) => (v === null || v === undefined ? 0 : Number(v));

async function resolveUser(prisma: any, userId?: string | null) {
  if (!userId) return { id: null as string | null, nombre: null as string | null };
  try {
    const u = await prisma.platformUser.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true, email: true } });
    const nombre = u ? (`${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email) : null;
    return { id: userId, nombre };
  } catch { return { id: userId, nombre: null }; }
}

// Sincroniza el estado de cobro de una factura según la suma de sus cobros.
async function syncFacturaEstado(prisma: any, facturaId: string) {
  const f = await prisma.finanzaFactura.findUnique({ where: { id: facturaId }, include: { cobros: true } });
  if (!f || f.estado === 'ANULADA') return;
  const cobrado = f.cobros.reduce((s: number, c: any) => s + num(c.importe), 0);
  const total = num(f.total);
  let estado = 'EMITIDA';
  if (total > 0 && cobrado >= total) estado = 'COBRADA';
  else if (cobrado > 0) estado = 'PARCIALMENTE_COBRADA';
  if (estado !== f.estado) await prisma.finanzaFactura.update({ where: { id: facturaId }, data: { estado } });
}

// Estado efectivo para lectura: VENCIDA es dinámico por fecha de vencimiento.
function estadoEfectivo(f: any): string {
  if (f.estado === 'ANULADA' || f.estado === 'COBRADA') return f.estado;
  if (f.fechaVencimiento && new Date(f.fechaVencimiento) < new Date()) return 'VENCIDA';
  return f.estado;
}

export default async function finanzasRoutes(app: FastifyInstance) {
  const prisma = () => app.prisma as any;

  // ═══════════════════════════════════════════════════════════════
  // CENTROS DE COSTO / UNIDADES DE NEGOCIO
  // ═══════════════════════════════════════════════════════════════

  app.get('/centros-costo', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const centros = await prisma().finanzaCentroCosto.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: [{ tipo: 'asc' }, { nombre: 'asc' }],
    });
    return reply.send({ centros });
  });

  const centroSchema = z.object({
    nombre: z.string().min(1).max(200),
    tipo: z.enum(['UNIDAD_NEGOCIO', 'CENTRO_COSTO']).default('CENTRO_COSTO'),
    parentId: z.string().uuid().optional().nullable(),
    notas: z.string().max(500).optional().nullable(),
    activo: z.boolean().optional(),
  });

  app.post('/centros-costo', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const body = centroSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Validation failed', details: body.error.issues });
    const centro = await prisma().finanzaCentroCosto.create({ data: { ...body.data, tenantId } });
    return reply.code(201).send({ centro });
  });

  app.patch('/centros-costo/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const body = centroSchema.partial().safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Validation failed', details: body.error.issues });
    const r = await prisma().finanzaCentroCosto.updateMany({ where: { id, tenantId, deletedAt: null }, data: body.data });
    if (!r.count) return reply.code(404).send({ error: 'Centro de costo no encontrado' });
    return reply.send({ ok: true });
  });

  app.delete('/centros-costo/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const now = new Date();
    await prisma().finanzaCentroCosto.updateMany({ where: { parentId: id, tenantId, deletedAt: null }, data: { deletedAt: now } });
    const r = await prisma().finanzaCentroCosto.updateMany({ where: { id, tenantId }, data: { deletedAt: now } });
    if (!r.count) return reply.code(404).send({ error: 'Centro de costo no encontrado' });
    return reply.send({ ok: true });
  });

  // ═══════════════════════════════════════════════════════════════
  // UPLOADS
  // ═══════════════════════════════════════════════════════════════

  const uploadHandler = (subdir: string) => async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    try {
      const data = await (req as any).file();
      if (!data) return reply.code(400).send({ error: 'No se recibió archivo' });
      const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
      if (!allowed.includes(data.mimetype)) return reply.code(400).send({ error: 'Solo PDF o imágenes' });
      const uploadDir = join(process.env.STORAGE_LOCAL_PATH || '/app/uploads', subdir, tenantId);
      if (!existsSync(uploadDir)) await mkdir(uploadDir, { recursive: true });
      const ext = (data.filename.split('.').pop() || 'pdf').toLowerCase();
      const filename = `${Date.now()}_${randomBytes(6).toString('hex')}.${ext}`;
      await writeFile(join(uploadDir, filename), await data.toBuffer());
      const baseUrl = process.env.API_BASE_URL || `http://${req.headers.host || 'localhost:3000'}`;
      return reply.send({ url: `${baseUrl}/uploads/${subdir}/${tenantId}/${filename}`, name: data.filename, mimeType: data.mimetype });
    } catch (e: any) {
      console.error(`[finanzas] ${subdir} upload error:`, e);
      return reply.code(500).send({ error: 'No se pudo subir el archivo' });
    }
  };

  app.post('/facturas/upload', uploadHandler('finanza-facturas'));
  app.post('/gastos/upload', uploadHandler('finanza-gastos'));

  // ═══════════════════════════════════════════════════════════════
  // FACTURAS EMITIDAS
  // ═══════════════════════════════════════════════════════════════

  const facturaSchema = z.object({
    numero: z.string().max(50).optional().nullable(),
    puntoVenta: z.string().max(20).optional().nullable(),
    tipoComprobante: z.enum(['FACTURA', 'NOTA_CREDITO', 'BOLETA', 'OTRO']).default('FACTURA'),
    fechaEmision: z.string().optional(),
    fechaVencimiento: z.string().optional().nullable(),
    clienteId: z.string().uuid().optional().nullable(),
    clienteNombre: z.string().min(1).max(200),
    neto: z.number().optional(),
    iva: z.number().optional(),
    total: z.number(),
    moneda: z.string().max(5).default('ARS'),
    centroCostoId: z.string().uuid().optional().nullable(),
    servicioId: z.string().uuid().optional().nullable(),
    fileUrl: z.string().optional().nullable(),
    fileName: z.string().optional().nullable(),
    mimeType: z.string().optional().nullable(),
    notas: z.string().max(1000).optional().nullable(),
    items: z.array(z.object({
      concepto: z.string().min(1).max(300),
      cantidad: z.number().positive().default(1),
      precioUnitario: z.number(),
      subtotal: z.number(),
      servicioId: z.string().uuid().optional().nullable(),
      centroCostoId: z.string().uuid().optional().nullable(),
    })).optional(),
  });

  app.get('/facturas', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const q = req.query as any;
    const where: any = { tenantId, deletedAt: null };
    if (q.estado) where.estado = q.estado;
    if (q.clienteId) where.clienteId = q.clienteId;
    if (q.centroCostoId) where.centroCostoId = q.centroCostoId;
    if (q.moneda) where.moneda = q.moneda;
    if (q.desde || q.hasta) {
      where.fechaEmision = {};
      if (q.desde) where.fechaEmision.gte = new Date(q.desde);
      if (q.hasta) where.fechaEmision.lt = new Date(q.hasta);
    }
    const facturas = await prisma().finanzaFactura.findMany({
      where,
      include: { items: true, cobros: { orderBy: { fecha: 'asc' } } },
      orderBy: { fechaEmision: 'desc' },
      take: Math.min(Number(q.limit) || 500, 1000),
    });
    const enriched = facturas.map((f: any) => {
      const cobrado = f.cobros.reduce((s: number, c: any) => s + num(c.importe), 0);
      const estado = estadoEfectivo(f);
      return {
        ...f, cobrado, saldo: Math.max(0, num(f.total) - cobrado), estado,
        diasAtraso: estado === 'VENCIDA' && f.fechaVencimiento
          ? Math.floor((Date.now() - new Date(f.fechaVencimiento).getTime()) / 86400000) : 0,
      };
    });
    return reply.send({ facturas: enriched });
  });

  app.post('/facturas', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const body = facturaSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Validation failed', details: body.error.issues });
    const user = await resolveUser(app.prisma, (req as any).auth?.userId);
    const { items, ...data } = body.data;
    const factura = await prisma().finanzaFactura.create({
      data: {
        ...data, tenantId,
        fechaEmision: data.fechaEmision ? new Date(data.fechaEmision) : new Date(),
        fechaVencimiento: data.fechaVencimiento ? new Date(data.fechaVencimiento) : null,
        uploadedById: user.id, uploadedByNombre: user.nombre,
        items: items?.length ? { create: items } : undefined,
      },
      include: { items: true, cobros: true },
    });
    return reply.code(201).send({ factura });
  });

  app.patch('/facturas/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const body = facturaSchema.partial().safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Validation failed', details: body.error.issues });
    const { items, ...data } = body.data;
    const update: any = { ...data };
    if (data.fechaEmision) update.fechaEmision = new Date(data.fechaEmision);
    if (data.fechaVencimiento !== undefined) update.fechaVencimiento = data.fechaVencimiento ? new Date(data.fechaVencimiento) : null;
    const r = await prisma().finanzaFactura.updateMany({ where: { id, tenantId, deletedAt: null }, data: update });
    if (!r.count) return reply.code(404).send({ error: 'Factura no encontrada' });
    if (items) {
      await prisma().finanzaFacturaItem.deleteMany({ where: { facturaId: id } });
      if (items.length) await prisma().finanzaFacturaItem.createMany({ data: items.map((i: any) => ({ ...i, facturaId: id })) });
    }
    const factura = await prisma().finanzaFactura.findFirst({ where: { id }, include: { items: true, cobros: true } });
    return reply.send({ factura });
  });

  app.post('/facturas/:id/anular', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const r = await prisma().finanzaFactura.updateMany({ where: { id, tenantId, deletedAt: null }, data: { estado: 'ANULADA' } });
    if (!r.count) return reply.code(404).send({ error: 'Factura no encontrada' });
    return reply.send({ ok: true });
  });

  app.delete('/facturas/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const r = await prisma().finanzaFactura.updateMany({ where: { id, tenantId }, data: { deletedAt: new Date() } });
    if (!r.count) return reply.code(404).send({ error: 'Factura no encontrada' });
    return reply.send({ ok: true });
  });

  // ═══════════════════════════════════════════════════════════════
  // COBROS
  // ═══════════════════════════════════════════════════════════════

  app.post('/facturas/:id/cobros', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const factura = await prisma().finanzaFactura.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!factura) return reply.code(404).send({ error: 'Factura no encontrada' });
    if (factura.estado === 'ANULADA') return reply.code(400).send({ error: 'No se puede cobrar una factura anulada' });
    const schema = z.object({
      fecha: z.string().optional(),
      importe: z.number().positive(),
      moneda: z.string().max(5).optional(),
      referencia: z.string().max(100).optional().nullable(),
      medioPago: z.string().max(30).optional().nullable(),
      notas: z.string().max(500).optional().nullable(),
    });
    const body = schema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Validation failed', details: body.error.issues });
    const user = await resolveUser(app.prisma, (req as any).auth?.userId);
    const cobro = await prisma().finanzaCobro.create({
      data: {
        ...body.data, tenantId, facturaId: id,
        fecha: body.data.fecha ? new Date(body.data.fecha) : new Date(),
        moneda: body.data.moneda || factura.moneda,
        createdById: user.id, createdByNombre: user.nombre,
      },
    });
    await syncFacturaEstado(app.prisma, id);
    const actualizada = await prisma().finanzaFactura.findFirst({ where: { id }, include: { items: true, cobros: { orderBy: { fecha: 'asc' } } } });
    const cobrado = actualizada.cobros.reduce((s: number, c: any) => s + num(c.importe), 0);
    return reply.code(201).send({ cobro, factura: { ...actualizada, cobrado, saldo: Math.max(0, num(actualizada.total) - cobrado), estado: estadoEfectivo(actualizada) } });
  });

  app.delete('/cobros/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const cobro = await prisma().finanzaCobro.findFirst({ where: { id, tenantId } });
    if (!cobro) return reply.code(404).send({ error: 'Cobro no encontrado' });
    await prisma().finanzaCobro.delete({ where: { id } });
    await syncFacturaEstado(app.prisma, cobro.facturaId);
    return reply.send({ ok: true });
  });

  // ═══════════════════════════════════════════════════════════════
  // GASTOS MANUALES / ESTRUCTURA
  // ═══════════════════════════════════════════════════════════════

  const gastoSchema = z.object({
    fecha: z.string().optional(),
    proveedor: z.string().max(200).optional().nullable(),
    concepto: z.string().min(1).max(300),
    categoria: z.string().max(50).default('OTRO'),
    tipoGasto: z.enum(['OPERATIVO', 'ESTRUCTURA', 'OTRO']).default('OPERATIVO'),
    centroCostoId: z.string().uuid().optional().nullable(),
    total: z.number(),
    moneda: z.string().max(5).default('ARS'),
    esRecurrente: z.boolean().default(false),
    fechaDesde: z.string().optional().nullable(),
    fechaHasta: z.string().optional().nullable(),
    fileUrl: z.string().optional().nullable(),
    fileName: z.string().optional().nullable(),
    mimeType: z.string().optional().nullable(),
    notas: z.string().max(1000).optional().nullable(),
  });

  app.get('/gastos', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const q = req.query as any;
    const where: any = { tenantId, deletedAt: null };
    if (q.tipoGasto) where.tipoGasto = q.tipoGasto;
    if (q.categoria) where.categoria = q.categoria;
    if (q.centroCostoId) where.centroCostoId = q.centroCostoId;
    if (q.moneda) where.moneda = q.moneda;
    if (q.desde || q.hasta) {
      where.fecha = {};
      if (q.desde) where.fecha.gte = new Date(q.desde);
      if (q.hasta) where.fecha.lt = new Date(q.hasta);
    }
    const gastos = await prisma().finanzaGasto.findMany({ where, orderBy: { fecha: 'desc' }, take: 1000 });
    return reply.send({ gastos });
  });

  app.post('/gastos', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const body = gastoSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Validation failed', details: body.error.issues });
    const user = await resolveUser(app.prisma, (req as any).auth?.userId);
    const gasto = await prisma().finanzaGasto.create({
      data: {
        ...body.data, tenantId,
        fecha: body.data.fecha ? new Date(body.data.fecha) : new Date(),
        fechaDesde: body.data.fechaDesde ? new Date(body.data.fechaDesde) : null,
        fechaHasta: body.data.fechaHasta ? new Date(body.data.fechaHasta) : null,
        uploadedById: user.id, uploadedByNombre: user.nombre,
      },
    });
    return reply.code(201).send({ gasto });
  });

  app.patch('/gastos/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const body = gastoSchema.partial().safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Validation failed', details: body.error.issues });
    const data: any = { ...body.data };
    if (data.fecha) data.fecha = new Date(data.fecha);
    if (data.fechaDesde !== undefined) data.fechaDesde = data.fechaDesde ? new Date(data.fechaDesde) : null;
    if (data.fechaHasta !== undefined) data.fechaHasta = data.fechaHasta ? new Date(data.fechaHasta) : null;
    const r = await prisma().finanzaGasto.updateMany({ where: { id, tenantId, deletedAt: null }, data });
    if (!r.count) return reply.code(404).send({ error: 'Gasto no encontrado' });
    return reply.send({ ok: true });
  });

  app.delete('/gastos/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const r = await prisma().finanzaGasto.updateMany({ where: { id, tenantId }, data: { deletedAt: new Date() } });
    if (!r.count) return reply.code(404).send({ error: 'Gasto no encontrado' });
    return reply.send({ ok: true });
  });

  // ═══════════════════════════════════════════════════════════════
  // CONSOLIDADO MENSUAL — resultado económico (devengado) + caja
  // ═══════════════════════════════════════════════════════════════

  // Recolecta TODAS las líneas económicas del rango con trazabilidad.
  // Cada línea: {fecha, concepto, importe, grupo, fuente, modulo, origenId, origenUrl, centroCostoId}
  // grupo: FACTURADO | INGRESO_OPERATIVO | COBRADO | COSTO_OP | ESTRUCTURA | GASTO_MANUAL
  async function recolectarLineas(tenantId: string, desde: Date, hasta: Date, moneda: string | null, centroCostoId: string | null) {
    const lineas: any[] = [];
    const add = (l: any) => lineas.push(l);
    const ccOk = (cc: string | null | undefined) => !centroCostoId || cc === centroCostoId;
    const monOk = (m: string | null | undefined) => !moneda || !m || m === moneda;
    const p = prisma();

    // Mapa vehiculoId → {centroCostoId, dominio} para imputar costos de flota
    const vehiculos = await p.vehiculo.findMany({
      where: { tenantId },
      select: { id: true, centroCostoId: true, dominio: true, cuotaMensual: true, cuotasTotales: true, primerCuotaAt: true, conductorId: true, maintenanceAssetId: true },
    }).catch(() => []);
    const vehMap = new Map<string, any>(vehiculos.map((v: any) => [v.id, v]));
    const assetToVeh = new Map<string, any>();
    for (const v of vehiculos) if (v.maintenanceAssetId) assetToVeh.set(v.maintenanceAssetId, v);

    // ── INGRESOS ─────────────────────────────────────────────────
    // Facturas emitidas (devengado por fechaEmision; NC resta; ANULADA excluida)
    const facturas = await p.finanzaFactura.findMany({
      where: { tenantId, deletedAt: null, estado: { not: 'ANULADA' }, fechaEmision: { gte: desde, lt: hasta }, ...(moneda ? { moneda } : {}), ...(centroCostoId ? { centroCostoId } : {}) },
      include: { cobros: true },
    }).catch(() => []);
    for (const f of facturas) {
      const sign = f.tipoComprobante === 'NOTA_CREDITO' ? -1 : 1;
      add({ fecha: f.fechaEmision, concepto: `Factura ${[f.puntoVenta, f.numero].filter(Boolean).join('-') || 's/n'} — ${f.clienteNombre}`, importe: sign * num(f.total), grupo: 'FACTURADO', fuente: 'FACTURA_EMITIDA', modulo: 'Resultados', origenId: f.id, origenUrl: '/resultados?tab=facturacion', centroCostoId: f.centroCostoId });
    }

    // Cobros de facturas emitidas (caja)
    const cobros = await p.finanzaCobro.findMany({
      where: { tenantId, fecha: { gte: desde, lt: hasta }, ...(moneda ? { moneda } : {}) },
      include: { factura: { select: { clienteNombre: true, numero: true, puntoVenta: true, centroCostoId: true, deletedAt: true } } },
    }).catch(() => []);
    for (const c of cobros) {
      if (c.factura?.deletedAt) continue;
      if (!ccOk(c.factura?.centroCostoId)) continue;
      add({ fecha: c.fecha, concepto: `Cobro fact. ${[c.factura?.puntoVenta, c.factura?.numero].filter(Boolean).join('-') || ''} — ${c.factura?.clienteNombre || ''}`, importe: num(c.importe), grupo: 'COBRADO', fuente: 'COBRO', modulo: 'Resultados', origenId: c.facturaId, origenUrl: '/resultados?tab=facturacion', centroCostoId: c.factura?.centroCostoId });
    }

    // Ingresos operativos de flota (sin factura emitida)
    const ingresos = await p.flotaIngreso.findMany({
      where: { tenantId, fecha: { gte: desde, lt: hasta } },
      select: { id: true, fecha: true, monto: true, concepto: true, descripcion: true, cliente: true, vehiculoId: true, servicioId: true, cobradoAt: true },
    }).catch(() => []);
    for (const i of ingresos) {
      const veh = i.vehiculoId ? vehMap.get(i.vehiculoId) : null;
      const cc = veh?.centroCostoId ?? null;
      if (!ccOk(cc)) continue;
      add({ fecha: i.fecha, concepto: `${i.concepto}${i.descripcion ? ' — ' + i.descripcion : ''}${veh ? ` (${veh.dominio})` : ''}`, importe: num(i.monto), grupo: 'INGRESO_OPERATIVO', fuente: 'INGRESO_FLOTA', modulo: 'Flota 360', origenId: i.id, origenUrl: '/flota-360', centroCostoId: cc });
      if (i.cobradoAt && i.cobradoAt >= desde && i.cobradoAt < hasta) {
        add({ fecha: i.cobradoAt, concepto: `Cobro ${i.concepto} — ${i.cliente || ''}`, importe: num(i.monto), grupo: 'COBRADO', fuente: 'COBRO_FLOTA', modulo: 'Flota 360', origenId: i.id, origenUrl: '/flota-360', centroCostoId: cc });
      }
    }

    // ── COSTOS OPERATIVOS (automáticos desde módulos origen) ────
    // Facturas de proveedor flota SUELTAS (sin OT). NC resta; PRESUPUESTO excluido.
    const flotaFacturas = await p.flotaFactura.findMany({
      where: { tenantId, fecha: { gte: desde, lt: hasta }, workOrderId: null, tipoComprobante: { not: 'PRESUPUESTO' } },
      select: { id: true, fecha: true, total: true, concepto: true, categoria: true, tipoComprobante: true, proveedor: true, vehiculoId: true, neumaticoId: true, moneda: true },
    }).catch(() => []);
    const facturasNeumaticoIds = new Set<string>();
    for (const f of flotaFacturas) {
      if (!monOk(f.moneda)) continue;
      const veh = f.vehiculoId ? vehMap.get(f.vehiculoId) : null;
      const cc = veh?.centroCostoId ?? null;
      if (!ccOk(cc)) continue;
      const sign = f.tipoComprobante === 'NOTA_CREDITO' ? -1 : 1;
      add({ fecha: f.fecha, concepto: `${f.concepto || f.categoria}${f.proveedor ? ' — ' + f.proveedor : ''}${veh ? ` (${veh.dominio})` : ''}`, importe: sign * num(f.total), grupo: 'COSTO_OP', fuente: `FACTURA_${f.categoria || 'GASTO'}`, modulo: 'Flota 360', origenId: f.id, origenUrl: f.vehiculoId ? `/flota-360/vehiculos/${f.vehiculoId}` : '/flota-360', centroCostoId: cc });
      if (f.neumaticoId) facturasNeumaticoIds.add(f.neumaticoId);
    }
    // También marcar neumáticos cubiertos por facturas vinculadas a OT
    const factNeumOT = await p.flotaFactura.findMany({ where: { tenantId, neumaticoId: { not: null } }, select: { neumaticoId: true } }).catch(() => []);
    for (const f of factNeumOT) if (f.neumaticoId) facturasNeumaticoIds.add(f.neumaticoId);

    // OTs completadas en el mes: totalCost ya incluye MO + repuestos + costoExterno
    // (facturas vinculadas) → fuente única de ese gasto, sin doble conteo.
    const ots = await p.workOrder.findMany({
      where: { tenantId, status: 'COMPLETED', completedAt: { gte: desde, lt: hasta }, totalCost: { gt: 0 } },
      select: { id: true, code: true, title: true, completedAt: true, totalCost: true, assetId: true },
    }).catch(() => []);
    for (const ot of ots) {
      const veh = ot.assetId ? assetToVeh.get(ot.assetId) : null;
      const cc = veh?.centroCostoId ?? null;
      if (!ccOk(cc)) continue;
      add({ fecha: ot.completedAt, concepto: `OT ${ot.code} — ${ot.title}${veh ? ` (${veh.dominio})` : ''}`, importe: num(ot.totalCost), grupo: 'COSTO_OP', fuente: 'MANTENIMIENTO_OT', modulo: 'Infraestructura', origenId: ot.id, origenUrl: '/infraestructura', centroCostoId: cc });
    }

    // Costos de mantenimiento SUELTOS (sin OT — no están dentro de totalCost)
    const maintCosts = await p.maintenanceCost.findMany({
      where: { tenantId, date: { gte: desde, lt: hasta }, workOrderId: null },
      select: { id: true, date: true, amount: true, description: true, costType: true, assetId: true },
    }).catch(() => []);
    for (const c of maintCosts) {
      const veh = c.assetId ? assetToVeh.get(c.assetId) : null;
      const cc = veh?.centroCostoId ?? null;
      if (!ccOk(cc)) continue;
      add({ fecha: c.date, concepto: `Mantenimiento ${c.costType}${c.description ? ' — ' + c.description : ''}`, importe: num(c.amount), grupo: 'COSTO_OP', fuente: 'MANTENIMIENTO', modulo: 'Infraestructura', origenId: c.id, origenUrl: '/infraestructura', centroCostoId: cc });
    }

    // Combustible + urea
    const combustible = await p.registroCombustible.findMany({
      where: { tenantId, fecha: { gte: desde, lt: hasta } },
      select: { id: true, fecha: true, costoTotal: true, costoUrea: true, estacion: true, vehiculoId: true },
    }).catch(() => []);
    for (const c of combustible) {
      const veh = c.vehiculoId ? vehMap.get(c.vehiculoId) : null;
      const cc = veh?.centroCostoId ?? null;
      if (!ccOk(cc)) continue;
      const total = num(c.costoTotal) + num(c.costoUrea);
      if (total <= 0) continue;
      add({ fecha: c.fecha, concepto: `Combustible${c.estacion ? ' — ' + c.estacion : ''}${veh ? ` (${veh.dominio})` : ''}`, importe: total, grupo: 'COSTO_OP', fuente: 'COMBUSTIBLE', modulo: 'Flota 360', origenId: c.id, origenUrl: '/flota-360/combustible', centroCostoId: cc });
    }

    // Multas pagadas en el período
    const multas = await p.flotaMulta.findMany({
      where: { tenantId, estado: 'PAGADA', pagadaAt: { gte: desde, lt: hasta } },
      select: { id: true, pagadaAt: true, monto: true, descripcion: true, tipo: true, vehiculoId: true },
    }).catch(() => []);
    for (const m of multas) {
      const veh = m.vehiculoId ? vehMap.get(m.vehiculoId) : null;
      const cc = veh?.centroCostoId ?? null;
      if (!ccOk(cc)) continue;
      add({ fecha: m.pagadaAt, concepto: `Multa ${m.tipo}${m.descripcion ? ' — ' + m.descripcion : ''}${veh ? ` (${veh.dominio})` : ''}`, importe: num(m.monto), grupo: 'COSTO_OP', fuente: 'MULTA', modulo: 'Flota 360', origenId: m.id, origenUrl: '/flota-360', centroCostoId: cc });
    }

    // Compra de cubiertas: solo si NO existe factura de flota para ese neumático
    const neumaticos = await p.neumatico.findMany({
      where: { tenantId, fechaCompra: { gte: desde, lt: hasta }, precioCompra: { gt: 0 } },
      select: { id: true, fechaCompra: true, precioCompra: true, codigo: true, marca: true, proveedor: true },
    }).catch(() => []);
    for (const n of neumaticos) {
      if (facturasNeumaticoIds.has(n.id)) continue; // ya contado vía factura
      add({ fecha: n.fechaCompra, concepto: `Compra cubierta ${n.codigo}${n.marca ? ' ' + n.marca : ''}${n.proveedor ? ' — ' + n.proveedor : ''}`, importe: num(n.precioCompra), grupo: 'COSTO_OP', fuente: 'NEUMATICO', modulo: 'Flota 360', origenId: n.id, origenUrl: '/flota-360/neumaticos', centroCostoId: null });
    }

    // Financiación de unidades: cuota mensual vigente en el mes
    for (const v of vehiculos) {
      const cuota = num(v.cuotaMensual);
      if (!cuota || !v.primerCuotaAt || !v.cuotasTotales) continue;
      if (!ccOk(v.centroCostoId)) continue;
      const idx = Math.floor((desde.getTime() - new Date(v.primerCuotaAt).getTime()) / (30.44 * 86400000)) + 1;
      if (idx >= 1 && idx <= v.cuotasTotales) {
        add({ fecha: desde, concepto: `Cuota financiación ${v.dominio} (${idx}/${v.cuotasTotales})`, importe: cuota, grupo: 'COSTO_OP', fuente: 'FINANCIACION', modulo: 'Flota 360', origenId: v.id, origenUrl: `/flota-360/vehiculos/${v.id}`, centroCostoId: v.centroCostoId });
      }
    }

    // ── COSTO DE PERSONAL (dedup Conductor↔Employee por DNI) ────
    const empleados = await p.employee.findMany({
      where: { tenantId, deletedAt: null, status: 'ACTIVE', costoMensual: { not: null } },
      select: { id: true, firstName: true, lastName: true, dni: true, costoMensual: true, centroCostoId: true },
    }).catch(() => []);
    const dnisEmpleados = new Set<string>(empleados.map((e: any) => (e.dni || '').trim()).filter(Boolean));
    for (const e of empleados) {
      const costo = num(e.costoMensual);
      if (costo <= 0 || !ccOk(e.centroCostoId)) continue;
      add({ fecha: desde, concepto: `Sueldo ${`${e.firstName || ''} ${e.lastName || ''}`.trim()}`, importe: costo, grupo: 'COSTO_OP', fuente: 'PERSONAL', modulo: 'RRHH', origenId: e.id, origenUrl: '/rrhh', centroCostoId: e.centroCostoId });
    }
    const conductores = await p.conductor.findMany({
      where: { tenantId, status: 'ACTIVO', costoMensual: { gt: 0 } },
      select: { id: true, nombre: true, dni: true, costoMensual: true },
    }).catch(() => []);
    for (const c of conductores) {
      if (c.dni && dnisEmpleados.has(c.dni.trim())) continue; // ya suma como Employee
      const veh = vehiculos.find((v: any) => v.conductorId === c.id);
      const cc = veh?.centroCostoId ?? null;
      if (!ccOk(cc)) continue;
      add({ fecha: desde, concepto: `Sueldo chofer ${c.nombre}${veh ? ` (${veh.dominio})` : ''}`, importe: num(c.costoMensual), grupo: 'COSTO_OP', fuente: 'PERSONAL_FLOTA', modulo: 'Flota 360', origenId: c.id, origenUrl: '/flota-360/conductores', centroCostoId: cc });
    }

    // ── GASTOS MANUALES / ESTRUCTURA ────────────────────────────
    const gastos = await p.finanzaGasto.findMany({
      where: {
        tenantId, deletedAt: null,
        ...(moneda ? { moneda } : {}),
        ...(centroCostoId ? { centroCostoId } : {}),
        OR: [
          { fecha: { gte: desde, lt: hasta }, esRecurrente: false },
          { esRecurrente: true, OR: [{ fechaDesde: null }, { fechaDesde: { lt: hasta } }], AND: [{ OR: [{ fechaHasta: null }, { fechaHasta: { gte: desde } }] }] },
        ],
      },
    }).catch(() => []);
    for (const g of gastos) {
      // Recurrentes imputan una vez por mes dentro de su ventana
      const fecha = g.esRecurrente ? (g.fechaDesde && g.fechaDesde > desde ? g.fechaDesde : desde) : g.fecha;
      const grupo = g.tipoGasto === 'ESTRUCTURA' ? 'ESTRUCTURA' : 'GASTO_MANUAL';
      add({ fecha, concepto: `${g.concepto}${g.proveedor ? ' — ' + g.proveedor : ''}${g.esRecurrente ? ' (recurrente)' : ''}`, importe: num(g.total), grupo, fuente: `GASTO_${g.categoria}`, modulo: 'Resultados', origenId: g.id, origenUrl: '/resultados?tab=gastos', centroCostoId: g.centroCostoId });
    }

    return lineas;
  }

  // GET /resultado-mensual?anio=YYYY&moneda=&centroCostoId=
  // Devuelve la serie de meses con KPIs devengado + caja.
  app.get('/resultado-mensual', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const q = req.query as any;
    const anio = Math.min(Math.max(Number(q.anio) || new Date().getUTCFullYear(), 2000), 2100);
    const moneda = q.moneda || null;
    const centroCostoId = q.centroCostoId || null;

    const mesActual = new Date().getUTCMonth() + 1;
    const anioActual = new Date().getUTCFullYear();
    const mesesACalcular = anio === anioActual ? mesActual : 12;

    const meses: any[] = [];
    for (let m = 1; m <= mesesACalcular; m++) {
      const desde = new Date(Date.UTC(anio, m - 1, 1));
      const hasta = new Date(Date.UTC(anio, m, 1));
      const lineas = await recolectarLineas(tenantId, desde, hasta, moneda, centroCostoId);

      const suma = (grupo: string) => lineas.filter(l => l.grupo === grupo).reduce((s, l) => s + l.importe, 0);
      const facturado = suma('FACTURADO');
      const ingresosOperativos = suma('INGRESO_OPERATIVO');
      const cobrado = suma('COBRADO');
      const costosOperativos = suma('COSTO_OP') + suma('GASTO_MANUAL');
      const estructura = suma('ESTRUCTURA');
      const ventas = facturado + ingresosOperativos;
      const resultado = ventas - costosOperativos - estructura;
      const margen = ventas > 0 ? Math.round((resultado / ventas) * 1000) / 10 : null;

      meses.push({
        mes: m, mesKey: `${anio}-${String(m).padStart(2, '0')}`,
        facturado, ingresosOperativos, ventas, cobrado,
        costosOperativos, estructura, costosTotales: costosOperativos + estructura,
        resultado, margen, lineas: lineas.length,
      });
    }

    // KPIs del año: acumulado + mes actual
    const totales = meses.reduce((acc, m) => ({
      facturado: acc.facturado + m.facturado,
      ventas: acc.ventas + m.ventas,
      cobrado: acc.cobrado + m.cobrado,
      costos: acc.costos + m.costosTotales,
      resultado: acc.resultado + m.resultado,
    }), { facturado: 0, ventas: 0, cobrado: 0, costos: 0, resultado: 0 });
    totales.margen = totales.ventas > 0 ? Math.round((totales.resultado / totales.ventas) * 1000) / 10 : null;

    return reply.send({ anio, moneda, centroCostoId, meses, totales });
  });

  // GET /resultado-mensual/detalle?anio=&mes=&moneda=&centroCostoId=&grupo=
  // Drill-down: devuelve las líneas individuales del mes con trazabilidad.
  app.get('/resultado-mensual/detalle', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const q = req.query as any;
    const anio = Number(q.anio) || new Date().getUTCFullYear();
    const mes = Number(q.mes) || new Date().getUTCMonth() + 1;
    if (mes < 1 || mes > 12) return reply.code(400).send({ error: 'mes inválido (1-12)' });
    const desde = new Date(Date.UTC(anio, mes - 1, 1));
    const hasta = new Date(Date.UTC(anio, mes, 1));
    let lineas = await recolectarLineas(tenantId, desde, hasta, q.moneda || null, q.centroCostoId || null);
    if (q.grupo) lineas = lineas.filter(l => l.grupo === q.grupo);
    if (q.fuente) lineas = lineas.filter(l => l.fuente === q.fuente);
    lineas.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
    const porGrupo: Record<string, number> = {};
    const porFuente: Record<string, number> = {};
    for (const l of lineas) {
      porGrupo[l.grupo] = (porGrupo[l.grupo] || 0) + l.importe;
      porFuente[l.fuente] = (porFuente[l.fuente] || 0) + l.importe;
    }
    return reply.send({ anio, mes, lineas, porGrupo, porFuente });
  });
}
