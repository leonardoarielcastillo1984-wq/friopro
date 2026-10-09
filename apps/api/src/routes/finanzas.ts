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

// Rubro de costo para el análisis "¿en qué se va la plata?". Gastos manuales
// y facturas de flota usan su categoría; el resto se mapea por fuente.
const RUBRO_FUENTE: Record<string, string> = {
  MANTENIMIENTO_OT: 'MANTENIMIENTO', MANTENIMIENTO: 'MANTENIMIENTO', NEUMATICO: 'NEUMATICOS',
  PERSONAL: 'SUELDOS', PERSONAL_FLOTA: 'SUELDOS', COMBUSTIBLE: 'COMBUSTIBLE', MULTA: 'MULTAS',
  FINANCIACION: 'FINANCIACION', CALIBRACION: 'CALIBRACIONES', CAPACITACION: 'CAPACITACIONES',
};
function rubroDe(fuente: string): string {
  if (fuente.startsWith('GASTO_')) return fuente.slice(6);
  if (fuente.startsWith('FACTURA_') && fuente !== 'FACTURA_EMITIDA') return fuente.slice(8);
  return RUBRO_FUENTE[fuente] || 'OTRO';
}

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
    tipoComprobante: z.enum(['FACTURA', 'NOTA_CREDITO', 'NOTA_DEBITO', 'BOLETA', 'OTRO']).default('FACTURA'),
    fechaEmision: z.string().optional(),
    fechaVencimiento: z.string().optional().nullable(),
    clienteId: z.string().uuid().optional().nullable(),
    clienteNombre: z.string().min(1).max(200),
    clienteRut: z.string().max(20).optional().nullable(),
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

  app.patch('/cobros/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const schema = z.object({
      fecha: z.string().optional(),
      importe: z.number().positive().optional(),
      referencia: z.string().max(100).optional().nullable(),
      medioPago: z.string().max(30).optional().nullable(),
      notas: z.string().max(500).optional().nullable(),
    });
    const body = schema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Validation failed', details: body.error.issues });
    const cobro = await prisma().finanzaCobro.findFirst({ where: { id, tenantId } });
    if (!cobro) return reply.code(404).send({ error: 'Cobro no encontrado' });
    const data: any = { ...body.data };
    if (data.fecha) data.fecha = new Date(data.fecha);
    await prisma().finanzaCobro.update({ where: { id }, data });
    await syncFacturaEstado(app.prisma, cobro.facturaId);
    return reply.send({ ok: true });
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
  // PAGOS — espejo de cobros del lado de egresos (CxP).
  // Un gasto puede tener pagos parciales; sin pagos y sin vencimiento
  // se asume pagado en su fecha (comportamiento previo a CxP).
  // ═══════════════════════════════════════════════════════════════

  const pagoSchema = z.object({
    fecha: z.string().optional(),
    importe: z.number().positive(),
    moneda: z.string().max(5).optional(),
    referencia: z.string().max(100).optional().nullable(),
    medioPago: z.string().max(30).optional().nullable(),
    notas: z.string().max(500).optional().nullable(),
  });

  app.post('/gastos/:id/pagos', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const gasto = await prisma().finanzaGasto.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!gasto) return reply.code(404).send({ error: 'Gasto no encontrado' });
    const body = pagoSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Validation failed', details: body.error.issues });
    const user = await resolveUser(app.prisma, (req as any).auth?.userId);
    const pago = await prisma().finanzaPago.create({
      data: {
        ...body.data, tenantId, gastoId: id,
        fecha: body.data.fecha ? new Date(body.data.fecha) : new Date(),
        moneda: body.data.moneda || gasto.moneda,
        createdById: user.id, createdByNombre: user.nombre,
      },
    });
    const pagos = await prisma().finanzaPago.findMany({ where: { gastoId: id }, orderBy: { fecha: 'asc' } });
    const pagado = pagos.reduce((s: number, x: any) => s + num(x.importe), 0);
    return reply.code(201).send({ pago, gasto: { ...gasto, pagos, pagado, saldo: Math.max(0, num(gasto.total) - pagado) } });
  });

  app.patch('/pagos/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const body = pagoSchema.partial().safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Validation failed', details: body.error.issues });
    const pago = await prisma().finanzaPago.findFirst({ where: { id, tenantId } });
    if (!pago) return reply.code(404).send({ error: 'Pago no encontrado' });
    const data: any = { ...body.data };
    if (data.fecha) data.fecha = new Date(data.fecha);
    await prisma().finanzaPago.update({ where: { id }, data });
    return reply.send({ ok: true });
  });

  app.delete('/pagos/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const pago = await prisma().finanzaPago.findFirst({ where: { id, tenantId } });
    if (!pago) return reply.code(404).send({ error: 'Pago no encontrado' });
    await prisma().finanzaPago.delete({ where: { id } });
    return reply.send({ ok: true });
  });

  // Marca una factura de proveedor de flota como pagada (pago simple)
  app.post('/flota-facturas/:id/pagar', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const body = z.object({ fecha: z.string().optional() }).safeParse(req.body);
    const r = await prisma().flotaFactura.updateMany({
      where: { id, tenantId },
      data: { pagadaAt: body.success && body.data.fecha ? new Date(body.data.fecha) : new Date() },
    });
    if (!r.count) return reply.code(404).send({ error: 'Factura no encontrada' });
    return reply.send({ ok: true });
  });

  app.post('/flota-facturas/:id/despagar', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const r = await prisma().flotaFactura.updateMany({ where: { id, tenantId }, data: { pagadaAt: null } });
    if (!r.count) return reply.code(404).send({ error: 'Factura no encontrada' });
    return reply.send({ ok: true });
  });

  app.patch('/flota-facturas/:id/vencimiento', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const body = z.object({ fechaVencimiento: z.string().nullable() }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Validation failed', details: body.error.issues });
    const r = await prisma().flotaFactura.updateMany({
      where: { id, tenantId },
      data: { fechaVencimiento: body.data.fechaVencimiento ? new Date(body.data.fechaVencimiento) : null },
    });
    if (!r.count) return reply.code(404).send({ error: 'Factura no encontrada' });
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
    neto: z.number().optional().nullable(),
    iva: z.number().optional().nullable(),
    ivaRecuperable: z.boolean().optional(),
    total: z.number(),
    moneda: z.string().max(5).default('ARS'),
    tipoComprobante: z.string().max(20).optional().nullable(),
    numeroComprobante: z.string().max(50).optional().nullable(),
    proveedorRut: z.string().max(20).optional().nullable(),
    fechaVencimiento: z.string().optional().nullable(),
    claseCosto: z.enum(['FIJO', 'VARIABLE', 'MIXTO']).optional().nullable(),
    esRecurrente: z.boolean().default(false),
    fechaDesde: z.string().optional().nullable(),
    fechaHasta: z.string().optional().nullable(),
    esAmortizable: z.boolean().optional(),
    variacionCuota: z.number().optional().nullable(),
    vehiculoId: z.string().uuid().optional().nullable(),
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
        fechaVencimiento: body.data.fechaVencimiento ? new Date(body.data.fechaVencimiento) : null,
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
    if (data.fechaVencimiento !== undefined) data.fechaVencimiento = data.fechaVencimiento ? new Date(data.fechaVencimiento) : null;
    if (data.fechaDesde !== undefined) data.fechaDesde = data.fechaDesde ? new Date(data.fechaDesde) : null;
    if (data.fechaHasta !== undefined) data.fechaHasta = data.fechaHasta ? new Date(data.fechaHasta) : null;
    const r = await prisma().finanzaGasto.updateMany({ where: { id, tenantId, deletedAt: null }, data });
    if (!r.count) return reply.code(404).send({ error: 'Gasto no encontrado' });
    return reply.send({ ok: true });
  });

  // Reclasifica en bloque todos los gastos de un proveedor (por RUT o nombre).
  // Clasificar un proveedor una vez aplica a todo su histórico importado.
  app.post('/gastos/reclasificar', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const schema = z.object({
      proveedorRut: z.string().max(20).optional().nullable(),
      proveedor: z.string().max(200).optional().nullable(),
      categoria: z.string().max(50).optional(),
      tipoGasto: z.enum(['OPERATIVO', 'ESTRUCTURA', 'OTRO']).optional(),
      centroCostoId: z.string().uuid().optional().nullable(),
    });
    const body = schema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Validation failed', details: body.error.issues });
    const { proveedorRut, proveedor, ...data } = body.data;
    if (!proveedorRut && !proveedor) return reply.code(400).send({ error: 'Indicá proveedorRut o proveedor' });
    const where: any = { tenantId, deletedAt: null, ...(proveedorRut ? { proveedorRut } : { proveedor }) };
    const r = await prisma().finanzaGasto.updateMany({ where, data });
    return reply.send({ ok: true, actualizados: r.count });
  });

  app.delete('/gastos/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const r = await prisma().finanzaGasto.updateMany({ where: { id, tenantId }, data: { deletedAt: new Date() } });
    if (!r.count) return reply.code(404).send({ error: 'Gasto no encontrado' });
    return reply.send({ ok: true });
  });

  // Monedas en uso (ordenadas por cantidad de movimientos) — el dashboard
  // nunca suma monedas distintas, arranca en la más usada.
  app.get('/monedas', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const [f, g] = await Promise.all([
      prisma().finanzaFactura.groupBy({ by: ['moneda'], where: { tenantId, deletedAt: null }, _count: { _all: true } }).catch(() => []),
      prisma().finanzaGasto.groupBy({ by: ['moneda'], where: { tenantId, deletedAt: null }, _count: { _all: true } }).catch(() => []),
    ]);
    const cnt: Record<string, number> = {};
    for (const r of [...f, ...g]) cnt[r.moneda] = (cnt[r.moneda] || 0) + r._count._all;
    const monedas = Object.entries(cnt).sort((a, b) => b[1] - a[1]).map(([m]) => m);
    return reply.send({ monedas });
  });

  // Configuración de moneda por empresa: la local sale del país del tenant;
  // la de inicio es configurable (ej. USD). USD siempre disponible.
  const MONEDA_PAIS: Record<string, string> = {
    AR: 'ARS', CL: 'CLP', BR: 'BRL', UY: 'UYU', PY: 'PYG', BO: 'BOB', PE: 'PEN',
    EC: 'USD', CO: 'COP', VE: 'VES', MX: 'MXN', US: 'USD', ES: 'EUR',
  };
  const configMoneda = async (tenantId: string) => {
    const t = await app.prisma.tenant.findUnique({ where: { id: tenantId }, select: { country: true, monedaResultados: true, resultadosConfig: true } });
    const monedaLocal = (t?.country && MONEDA_PAIS[t.country]) || null;
    const ivaTasa = ((t?.resultadosConfig as any)?.ivaTasa as Record<string, number> | undefined) || {};
    const presupuesto = ((t?.resultadosConfig as any)?.presupuesto as Record<string, number> | undefined) || {};
    return { country: t?.country || null, monedaLocal, monedaDefault: t?.monedaResultados || monedaLocal, ivaTasa, presupuesto };
  };

  app.get('/config', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    return reply.send(await configMoneda(tenantId));
  });

  app.put('/config', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const body = z.object({
      monedaDefault: z.string().regex(/^[A-Z]{3}$/).nullable().optional(),
      saldoInicial: z.record(z.string(), z.number()).optional(),
      claseCosto: z.record(z.string(), z.enum(['FIJO', 'VARIABLE', 'MIXTO'])).optional(),
      alertas: z.object({ atencion: z.number().min(1).max(100), critica: z.number().min(1).max(200) }).optional(),
      // Tasa de IVA por moneda (0–0.5): ARS 0.21, CLP 0.19… anula el default por moneda
      ivaTasa: z.record(z.string().regex(/^[A-Z]{3}$/), z.number().min(0).max(0.5).nullable()).optional(),
      // Presupuesto mensual por categoría de gasto (null = sin tope)
      presupuesto: z.record(z.string().max(50), z.number().min(0).nullable()).optional(),
    }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Validation failed', details: body.error.issues });
    const data: any = {};
    if (body.data.monedaDefault !== undefined) data.monedaResultados = body.data.monedaDefault;
    if (body.data.saldoInicial || body.data.claseCosto || body.data.alertas || body.data.ivaTasa || body.data.presupuesto) {
      const t = await app.prisma.tenant.findUnique({ where: { id: tenantId }, select: { resultadosConfig: true } });
      const conf = ((t?.resultadosConfig as any) || {}) as any;
      if (body.data.saldoInicial) conf.saldoInicial = body.data.saldoInicial;
      if (body.data.claseCosto) conf.claseCosto = body.data.claseCosto;
      if (body.data.alertas) conf.alertas = body.data.alertas;
      if (body.data.ivaTasa) {
        conf.ivaTasa = { ...(conf.ivaTasa || {}), ...Object.fromEntries(Object.entries(body.data.ivaTasa).filter(([, v]) => v !== null)) };
        for (const [k, v] of Object.entries(body.data.ivaTasa)) if (v === null) delete conf.ivaTasa[k];
      }
      if (body.data.presupuesto) {
        conf.presupuesto = { ...(conf.presupuesto || {}), ...Object.fromEntries(Object.entries(body.data.presupuesto).filter(([, v]) => v !== null)) };
        for (const [k, v] of Object.entries(body.data.presupuesto)) if (v === null) delete conf.presupuesto[k];
      }
      data.resultadosConfig = conf;
    }
    if (Object.keys(data).length) await app.prisma.tenant.update({ where: { id: tenantId }, data });
    return reply.send(await configMoneda(tenantId));
  });

  // Clientes ya facturados (para autocompletar nombre + RUT)
  app.get('/clientes', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const rows = await prisma().finanzaFactura.groupBy({
      by: ['clienteNombre', 'clienteRut'], where: { tenantId, deletedAt: null }, _count: { _all: true },
    }).catch(() => []);
    const clientes = rows.sort((a: any, b: any) => b._count._all - a._count._all).map((r: any) => ({ nombre: r.clienteNombre, rut: r.clienteRut }));
    return reply.send({ clientes });
  });

  // Proveedores ya cargados en gastos (para reclasificar en bloque)
  app.get('/proveedores', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const rows = await prisma().finanzaGasto.groupBy({
      by: ['proveedor', 'proveedorRut', 'categoria', 'tipoGasto'], where: { tenantId, deletedAt: null, proveedor: { not: null } },
      _count: { _all: true }, _sum: { total: true },
    }).catch(() => []);
    const proveedores = rows.map((r: any) => ({ nombre: r.proveedor, rut: r.proveedorRut, categoria: r.categoria, tipoGasto: r.tipoGasto, cantidad: r._count._all, total: num(r._sum.total) }))
      .sort((a: any, b: any) => b.total - a.total);
    return reply.send({ proveedores });
  });

  // ═══════════════════════════════════════════════════════════════
  // CONSOLIDADO MENSUAL — resultado económico (devengado) + caja
  // ═══════════════════════════════════════════════════════════════

  // Recolecta TODAS las líneas económicas del rango con trazabilidad.
  // Cada línea: {fecha, concepto, importe, grupo, fuente, modulo, origenId, origenUrl, centroCostoId}
  // grupo: FACTURADO | INGRESO_OPERATIVO | COBRADO | COSTO_OP | ESTRUCTURA | GASTO_MANUAL
  async function recolectarLineas(tenantId: string, desde: Date, hasta: Date, moneda: string | null, centroCostoId: string | null) {
    const lineas: any[] = [];
    const add = (l: any) => lineas.push({ ...l, rubro: rubroDe(l.fuente) });
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
      // Venta = base sin IVA (el IVA no es ingreso de la empresa). Sin neto cargado → total.
      const base = num(f.neto) > 0 ? num(f.neto) : num(f.total);
      const label = f.tipoComprobante === 'NOTA_CREDITO' ? 'Nota de crédito' : 'Factura';
      add({ fecha: f.fechaEmision, concepto: `${label} ${[f.puntoVenta, f.numero].filter(Boolean).join('-') || 's/n'} — ${f.clienteNombre}`, importe: sign * base, grupo: 'FACTURADO', fuente: 'FACTURA_EMITIDA', modulo: 'Resultados', origenId: f.id, origenUrl: '/resultados?tab=facturacion', centroCostoId: f.centroCostoId });
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
      select: { id: true, fecha: true, total: true, neto: true, iva: true, ivaRecuperable: true, concepto: true, categoria: true, tipoComprobante: true, proveedor: true, vehiculoId: true, neumaticoId: true, moneda: true },
    }).catch(() => []);
    const facturasNeumaticoIds = new Set<string>();
    for (const f of flotaFacturas) {
      if (!monOk(f.moneda)) continue;
      const veh = f.vehiculoId ? vehMap.get(f.vehiculoId) : null;
      const cc = veh?.centroCostoId ?? null;
      if (!ccOk(cc)) continue;
      const sign = f.tipoComprobante === 'NOTA_CREDITO' ? -1 : 1;
      // Costo real = neto cuando el IVA se recupera; si no, el IVA es costo.
      const base = f.ivaRecuperable !== false && num(f.neto) > 0 ? num(f.neto) : num(f.total);
      add({ fecha: f.fecha, concepto: `${f.concepto || f.categoria}${f.proveedor ? ' — ' + f.proveedor : ''}${veh ? ` (${veh.dominio})` : ''}`, importe: sign * base, grupo: 'COSTO_OP', fuente: `FACTURA_${f.categoria || 'GASTO'}`, modulo: 'Flota 360', origenId: f.id, origenUrl: f.vehiculoId ? `/flota-360/vehiculos/${f.vehiculoId}` : '/flota-360', centroCostoId: cc, iva: num(f.iva), ivaRecuperable: f.ivaRecuperable !== false });
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

    // Historial de mantenimiento de vehículos SUELTO (sin OT — si tiene
    // workOrderId el costo ya está dentro de totalCost de la OT).
    const histMant = await p.vehiculoHistorialMantenimiento.findMany({
      where: { tenantId, fecha: { gte: desde, lt: hasta }, workOrderId: null, costo: { gt: 0 } },
      select: { id: true, fecha: true, tipo: true, descripcion: true, costo: true, vehiculoId: true },
    }).catch(() => []);
    for (const h of histMant) {
      const veh = h.vehiculoId ? vehMap.get(h.vehiculoId) : null;
      const cc = veh?.centroCostoId ?? null;
      if (!ccOk(cc)) continue;
      add({ fecha: h.fecha, concepto: `${h.descripcion || 'Mantenimiento'}${veh ? ` (${veh.dominio})` : ''}`, importe: num(h.costo), grupo: 'COSTO_OP', fuente: 'MANTENIMIENTO', modulo: 'Flota 360', origenId: h.id, origenUrl: h.vehiculoId ? `/flota-360/vehiculos/${h.vehiculoId}` : '/flota-360', centroCostoId: cc });
    }

    // Combustible + urea
    const combustible = await p.registroCombustible.findMany({
      where: { tenantId, fecha: { gte: desde, lt: hasta } },
      select: { id: true, fecha: true, costoTotal: true, costoUrea: true, estacion: true, vehiculoId: true, iva: true, ivaUrea: true, ivaRecuperable: true },
    }).catch(() => []);
    for (const c of combustible) {
      const veh = c.vehiculoId ? vehMap.get(c.vehiculoId) : null;
      const cc = veh?.centroCostoId ?? null;
      if (!ccOk(cc)) continue;
      const bruto = num(c.costoTotal) + num(c.costoUrea);
      if (bruto <= 0) continue;
      // Si el IVA se recupera y está desagregado, el costo real es sin impuesto.
      // Sin dato de IVA → el total queda como costo (conservador) y se reporta
      // como estimado en /iva-credito para evidenciar el posible recupero.
      const ivaCont = c.ivaRecuperable !== false ? num(c.iva) + num(c.ivaUrea) : 0;
      const total = bruto - Math.min(ivaCont, bruto);
      add({ fecha: c.fecha, concepto: `Combustible${c.estacion ? ' — ' + c.estacion : ''}${veh ? ` (${veh.dominio})` : ''}`, importe: total, grupo: 'COSTO_OP', fuente: 'COMBUSTIBLE', modulo: 'Flota 360', origenId: c.id, origenUrl: '/flota-360/combustible', centroCostoId: cc, iva: ivaCont, ivaBruto: bruto, ivaRecuperable: c.ivaRecuperable !== false });
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

    // Calibraciones de equipos de medición (costo del servicio de calibración)
    const calibraciones = await p.calibration.findMany({
      where: { tenantId, date: { gte: desde, lt: hasta }, cost: { gt: 0 } },
      select: { id: true, date: true, cost: true, provider: true, equipment: { select: { name: true, code: true } } },
    }).catch(() => []);
    for (const cal of calibraciones) {
      add({ fecha: cal.date, concepto: `Calibración ${cal.equipment?.name || ''}${cal.provider ? ' — ' + cal.provider : ''}`, importe: num(cal.cost), grupo: 'COSTO_OP', fuente: 'CALIBRACION', modulo: 'Infraestructura', origenId: cal.id, origenUrl: '/infraestructura?tab=calibraciones', centroCostoId: null });
    }

    // Capacitaciones con costo (fecha = createdAt; no hay campo de fecha de dictado)
    const trainings = await p.training.findMany({
      where: { tenantId, deletedAt: null, cost: { gt: 0 }, createdAt: { gte: desde, lt: hasta } },
      select: { id: true, title: true, cost: true, createdAt: true },
    }).catch(() => []);
    for (const t of trainings) {
      add({ fecha: t.createdAt, concepto: `Capacitación — ${t.title}`, importe: num(t.cost), grupo: 'COSTO_OP', fuente: 'CAPACITACION', modulo: 'RRHH', origenId: t.id, origenUrl: '/capacitaciones', centroCostoId: null });
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
    // Un gasto con vehiculoId sin centroCostoId hereda el CC de la unidad
    const vehIdsCC = centroCostoId ? vehiculos.filter((v: any) => v.centroCostoId === centroCostoId).map((v: any) => v.id) : [];
    const gastos = await p.finanzaGasto.findMany({
      where: {
        tenantId, deletedAt: null,
        ...(moneda ? { moneda } : {}),
        AND: [
          { OR: [
            { fecha: { gte: desde, lt: hasta }, esRecurrente: false, esAmortizable: false },
            { esRecurrente: true, OR: [{ fechaDesde: null }, { fechaDesde: { lt: hasta } }], AND: [{ OR: [{ fechaHasta: null }, { fechaHasta: { gte: desde } }] }] },
            // Amortizable: entra en cualquier mes que intersecte [fechaDesde, fechaHasta]
            { esAmortizable: true, fechaDesde: { not: null, lt: hasta }, fechaHasta: { not: null, gte: desde } },
          ] },
          ...(centroCostoId ? [{ OR: [{ centroCostoId }, { vehiculoId: { in: vehIdsCC } }] }] : []),
        ],
      },
    }).catch(() => []);
    for (const g of gastos) {
      const veh = g.vehiculoId ? vehMap.get(g.vehiculoId) : null;
      const cc = g.centroCostoId ?? veh?.centroCostoId ?? null;
      if (!ccOk(cc)) continue;
      const grupo = g.tipoGasto === 'ESTRUCTURA' ? 'ESTRUCTURA' : 'GASTO_MANUAL';
      // Costo real = neto solo cuando el IVA se recupera (crédito fiscal).
      // ivaRecuperable=false → el impuesto es costo → se usa total. NC resta.
      const sign = g.tipoComprobante === 'NOTA_CREDITO' ? -1 : 1;
      const base = g.ivaRecuperable !== false && g.neto !== null && g.neto !== undefined ? num(g.neto) : num(g.total);
      let fecha = new Date(g.fecha);
      let importe = sign * base;
      let tag = '';
      if (g.esAmortizable && g.fechaDesde && g.fechaHasta) {
        // Gasto anual prorrateado: el total se divide en partes iguales
        // por cada mes de la ventana (seguro, alquiler anual, etc.)
        const ini = new Date(g.fechaDesde), fin = new Date(g.fechaHasta);
        const meses = (fin.getUTCFullYear() - ini.getUTCFullYear()) * 12 + fin.getUTCMonth() - ini.getUTCMonth() + 1;
        if (meses > 0) {
          const k = (desde.getUTCFullYear() - ini.getUTCFullYear()) * 12 + desde.getUTCMonth() - ini.getUTCMonth() + 1;
          importe = sign * (base / meses);
          fecha = ini > desde ? ini : desde;
          tag = ` (amort. ${k}/${meses})`;
        }
      } else if (g.esRecurrente) {
        const ini = g.fechaDesde ? new Date(g.fechaDesde) : new Date(g.fecha);
        fecha = ini > desde ? ini : desde;
        const dv = num(g.variacionCuota);
        if (dv !== 0) {
          // Cuota variable (préstamo/leasing): mes k = base + (k-1)·variación
          const k = (desde.getUTCFullYear() - ini.getUTCFullYear()) * 12 + desde.getUTCMonth() - ini.getUTCMonth() + 1;
          importe = sign * Math.max(0, base + (k - 1) * dv);
          tag = ` (cuota ${k})`;
        } else {
          tag = ' (recurrente)';
        }
      }
      add({ fecha, concepto: `${g.concepto}${g.proveedor ? ' — ' + g.proveedor : ''}${veh ? ` (${veh.dominio})` : ''}${tag}`, importe, grupo, fuente: `GASTO_${g.categoria}`, modulo: 'Resultados', origenId: g.id, origenUrl: veh ? `/flota-360/vehiculos/${veh.id}` : '/resultados?tab=gastos', centroCostoId: cc, iva: num(g.iva), ivaRecuperable: g.ivaRecuperable !== false });
    }

    return lineas;
  }

  // Fecha del último dato económico registrado/modificado. Alimenta la
  // leyenda "actualizado hoy 08:32" de cada cuadro del módulo.
  async function ultimaAct(tenantId: string, moneda: string | null): Promise<Date | null> {
    const p = prisma();
    const fMon = moneda ? { moneda } : {};
    const aggs = await Promise.all([
      p.finanzaFactura.aggregate({ _max: { updatedAt: true }, where: { tenantId, deletedAt: null, ...fMon } }).catch(() => null),
      p.finanzaCobro.aggregate({ _max: { createdAt: true }, where: { tenantId, ...fMon } }).catch(() => null),
      p.finanzaGasto.aggregate({ _max: { updatedAt: true }, where: { tenantId, deletedAt: null, ...fMon } }).catch(() => null),
      p.finanzaPago.aggregate({ _max: { createdAt: true }, where: { tenantId, ...fMon } }).catch(() => null),
      p.finanzaComentarioPeriodo.aggregate({ _max: { updatedAt: true }, where: { tenantId, deletedAt: null } }).catch(() => null),
      p.flotaFactura.aggregate({ _max: { createdAt: true }, where: { tenantId, ...fMon } }).catch(() => null),
      p.flotaIngreso.aggregate({ _max: { createdAt: true }, where: { tenantId } }).catch(() => null),
      p.registroCombustible.aggregate({ _max: { createdAt: true }, where: { tenantId } }).catch(() => null),
    ]);
    let max: Date | null = null;
    for (const a of aggs) {
      const d = a?._max?.updatedAt || a?._max?.createdAt || null;
      if (d && (!max || d > max)) max = d;
    }
    return max;
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
      const porRubro: Record<string, number> = {};
      for (const l of lineas) {
        if (!['COSTO_OP', 'ESTRUCTURA', 'GASTO_MANUAL'].includes(l.grupo)) continue;
        porRubro[l.rubro] = (porRubro[l.rubro] || 0) + l.importe;
      }

      meses.push({
        mes: m, mesKey: `${anio}-${String(m).padStart(2, '0')}`,
        facturado, ingresosOperativos, ventas, cobrado,
        costosOperativos, estructura, costosTotales: costosOperativos + estructura,
        resultado, margen, lineas: lineas.length, porRubro,
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
    totales.porRubro = {} as Record<string, number>;
    for (const m of meses) for (const [r, v] of Object.entries(m.porRubro as Record<string, number>)) totales.porRubro[r] = (totales.porRubro[r] || 0) + v;
    totales.mesesPositivos = meses.filter(m => m.resultado > 0).length;
    totales.mesesNegativos = meses.filter(m => m.resultado < 0).length;

    const actualizadoEn = await ultimaAct(tenantId, moneda);
    return reply.send({ anio, moneda, centroCostoId, meses, totales, actualizadoEn });
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
    const porRubro: Record<string, number> = {};
    for (const l of lineas) {
      if (!['COSTO_OP', 'ESTRUCTURA', 'GASTO_MANUAL'].includes(l.grupo)) continue;
      porRubro[l.rubro] = (porRubro[l.rubro] || 0) + l.importe;
    }
    return reply.send({ anio, mes, lineas, porGrupo, porFuente, porRubro });
  });

  // ═══════════════════════════════════════════════════════════════
  // CUENTAS POR COBRAR — cuánto debe cada cliente, cada cuánto paga
  // ═══════════════════════════════════════════════════════════════
  app.get('/cuentas-por-cobrar', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const q = req.query as any;
    const facturas = await prisma().finanzaFactura.findMany({
      where: { tenantId, deletedAt: null, estado: { not: 'ANULADA' }, ...(q.moneda ? { moneda: q.moneda } : {}) },
      include: { cobros: { orderBy: { fecha: 'asc' } } },
      orderBy: { fechaEmision: 'asc' },
    });
    const hoy = Date.now();
    const DIA = 86400000;
    const porCliente = new Map<string, any>();
    for (const f of facturas) {
      const key = (f.clienteRut || f.clienteNombre).trim().toUpperCase();
      if (!porCliente.has(key)) porCliente.set(key, {
        cliente: f.clienteNombre, rut: f.clienteRut, facturado: 0, cobrado: 0, notasCredito: 0, saldo: 0,
        aging: { corriente: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90: 0 },
        diasPago: [] as number[], fechasCobro: [] as number[], pendientes: [] as any[], ultimoCobro: null as Date | null,
      });
      const c = porCliente.get(key);
      const total = num(f.total);
      if (f.tipoComprobante === 'NOTA_CREDITO') { c.notasCredito += total; continue; }
      const cobrado = f.cobros.reduce((s: number, x: any) => s + num(x.importe), 0);
      c.facturado += total; c.cobrado += cobrado;
      for (const x of f.cobros) {
        c.fechasCobro.push(new Date(x.fecha).getTime());
        if (!c.ultimoCobro || x.fecha > c.ultimoCobro) c.ultimoCobro = x.fecha;
      }
      const saldo = Math.max(0, total - cobrado);
      if (saldo <= 0.5 && f.cobros.length) {
        // Días de pago = emisión → cobro que la canceló
        const last = new Date(f.cobros[f.cobros.length - 1].fecha).getTime();
        c.diasPago.push(Math.max(0, Math.round((last - new Date(f.fechaEmision).getTime()) / DIA)));
        continue;
      }
      if (saldo <= 0.5) continue;
      c.saldo += saldo;
      const venc = f.fechaVencimiento ? new Date(f.fechaVencimiento).getTime() : new Date(f.fechaEmision).getTime();
      const atraso = Math.floor((hoy - venc) / DIA);
      if (atraso <= 0) c.aging.corriente += saldo;
      else if (atraso <= 30) c.aging.d1_30 += saldo;
      else if (atraso <= 60) c.aging.d31_60 += saldo;
      else if (atraso <= 90) c.aging.d61_90 += saldo;
      else c.aging.d90 += saldo;
      c.pendientes.push({
        id: f.id, numero: [f.puntoVenta, f.numero].filter(Boolean).join('-') || null, fechaEmision: f.fechaEmision,
        fechaVencimiento: f.fechaVencimiento, total, cobrado, saldo, diasAtraso: Math.max(0, atraso), moneda: f.moneda,
        fileUrl: f.fileUrl, diasDesdeEmision: Math.floor((hoy - new Date(f.fechaEmision).getTime()) / DIA),
      });
    }
    const clientes = [...porCliente.values()].map(c => {
      const fechas = [...new Set(c.fechasCobro.map((t: number) => Math.floor(t / DIA)))].sort((a: any, b: any) => a - b) as number[];
      const intervalos = fechas.slice(1).map((d, i) => d - fechas[i]);
      const { diasPago, fechasCobro, ...rest } = c;
      // NC sin aplicar a una factura puntual: se descuenta de la deuda más vieja primero
      let credito = c.notasCredito;
      for (const b of ['d90', 'd61_90', 'd31_60', 'd1_30', 'corriente'] as const) {
        const aplica = Math.min(credito, c.aging[b]);
        c.aging[b] -= aplica; credito -= aplica;
      }
      return {
        ...rest,
        saldo: Math.max(0, c.saldo - c.notasCredito),
        diasPagoPromedio: diasPago.length ? Math.round(diasPago.reduce((s: number, d: number) => s + d, 0) / diasPago.length) : null,
        frecuenciaPagoDias: intervalos.length ? Math.round(intervalos.reduce((s, d) => s + d, 0) / intervalos.length) : null,
        facturasPagadas: diasPago.length,
      };
    }).sort((a, b) => b.saldo - a.saldo);
    const totales = clientes.reduce((t, c) => ({
      saldo: t.saldo + c.saldo,
      vencido: t.vencido + c.aging.d1_30 + c.aging.d31_60 + c.aging.d61_90 + c.aging.d90,
      d90: t.d90 + c.aging.d90,
    }), { saldo: 0, vencido: 0, d90: 0 });
    const actualizadoEn = await ultimaAct(tenantId, q.moneda || null);
    return reply.send({ clientes, totales, actualizadoEn });
  });

  // ═══════════════════════════════════════════════════════════════
  // CUENTAS POR PAGAR — obligaciones futuras con proveedores.
  // Fuentes: finanza_gastos con vencimiento o pagos + flota_facturas
  // con vencimiento o marca de pago. Sin vencimiento ni pago registrado,
  // el gasto se asume pagado al contado en su fecha (no aparece pendiente).
  // ═══════════════════════════════════════════════════════════════
  async function obtenerCxPInterno(p: any, tenantId: string, moneda: string | null) {
    const hoy = Date.now();
    const DIA = 86400000;
    const [gastos, flota] = await Promise.all([
      p.finanzaGasto.findMany({
        where: {
          tenantId, deletedAt: null, tipoComprobante: { not: 'NOTA_CREDITO' },
          ...(moneda ? { moneda } : {}),
          OR: [{ fechaVencimiento: { not: null } }, { pagos: { some: {} } }],
        },
        include: { pagos: { orderBy: { fecha: 'asc' } } },
        orderBy: { fechaVencimiento: 'asc' },
      }).catch(() => []),
      p.flotaFactura.findMany({
        where: {
          tenantId, tipoComprobante: { notIn: ['PRESUPUESTO', 'NOTA_CREDITO'] },
          ...(moneda ? { moneda } : {}),
          OR: [{ fechaVencimiento: { not: null } }, { pagadaAt: { not: null } }],
        },
        select: { id: true, fecha: true, numero: true, puntoVenta: true, proveedor: true, cuitProveedor: true, concepto: true, categoria: true, total: true, moneda: true, fechaVencimiento: true, pagadaAt: true, vehiculoId: true },
        orderBy: { fechaVencimiento: 'asc' },
      }).catch(() => []),
    ]);

    const items: any[] = [];
    for (const g of gastos) {
      const pagado = g.pagos.reduce((s: number, x: any) => s + num(x.importe), 0);
      const saldo = Math.max(0, num(g.total) - pagado);
      const venc = g.fechaVencimiento ? new Date(g.fechaVencimiento).getTime() : new Date(g.fecha).getTime();
      const diasVenc = Math.floor((venc - hoy) / DIA);
      const estado = saldo <= 0.5 ? 'PAGADO' : pagado > 0 ? (diasVenc < 0 ? 'VENCIDO' : 'PARCIAL') : diasVenc < 0 ? 'VENCIDO' : 'PENDIENTE';
      items.push({
        id: g.id, origen: 'GASTO', proveedor: g.proveedor || 'Sin proveedor', proveedorRut: g.proveedorRut,
        comprobante: [g.tipoComprobante, g.numeroComprobante].filter(Boolean).join(' ') || null,
        concepto: g.concepto, fechaEmision: g.fecha, fechaVencimiento: g.fechaVencimiento,
        total: num(g.total), pagado, saldo, moneda: g.moneda, centroCostoId: g.centroCostoId,
        estado, diasVencimiento: diasVenc, categoria: g.categoria,
        pagos: g.pagos.map((x: any) => ({ id: x.id, fecha: x.fecha, importe: num(x.importe), moneda: x.moneda, referencia: x.referencia, medioPago: x.medioPago })),
        origenUrl: '/resultados?tab=gastos', modulo: 'Resultados',
      });
    }
    for (const f of flota) {
      const pagado = f.pagadaAt ? num(f.total) : 0;
      const saldo = Math.max(0, num(f.total) - pagado);
      const venc = f.fechaVencimiento ? new Date(f.fechaVencimiento).getTime() : new Date(f.fecha).getTime();
      const diasVenc = Math.floor((venc - hoy) / DIA);
      const estado = f.pagadaAt ? 'PAGADO' : diasVenc < 0 ? 'VENCIDO' : 'PENDIENTE';
      items.push({
        id: f.id, origen: 'FLOTA', proveedor: f.proveedor || 'Sin proveedor', proveedorRut: f.cuitProveedor,
        comprobante: [f.puntoVenta, f.numero].filter(Boolean).join('-') || null,
        concepto: f.concepto || f.categoria, fechaEmision: f.fecha, fechaVencimiento: f.fechaVencimiento,
        total: num(f.total), pagado, saldo, moneda: f.moneda, centroCostoId: null,
        estado, diasVencimiento: diasVenc, categoria: f.categoria, pagadaAt: f.pagadaAt, pagos: [],
        origenUrl: f.vehiculoId ? `/flota-360/vehiculos/${f.vehiculoId}` : '/flota-360', modulo: 'Flota 360',
      });
    }
    items.sort((a, b) => new Date(a.fechaVencimiento || a.fechaEmision).getTime() - new Date(b.fechaVencimiento || b.fechaEmision).getTime());
    return items;
  }

  app.get('/cuentas-por-pagar', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const q = req.query as any;
    const items = await obtenerCxPInterno(prisma(), tenantId, q.moneda || null);
    const pend = items.filter(i => i.saldo > 0.5);
    const totales = {
      porPagar: pend.reduce((s, i) => s + i.saldo, 0),
      vencido: pend.filter(i => i.diasVencimiento < 0).reduce((s, i) => s + i.saldo, 0),
      vence7: pend.filter(i => i.diasVencimiento >= 0 && i.diasVencimiento <= 7).reduce((s, i) => s + i.saldo, 0),
      vence30: pend.filter(i => i.diasVencimiento >= 0 && i.diasVencimiento <= 30).reduce((s, i) => s + i.saldo, 0),
    };
    const porProveedor = new Map<string, any>();
    for (const i of pend) {
      const k = (i.proveedorRut || i.proveedor).trim().toUpperCase();
      const e = porProveedor.get(k) || { proveedor: i.proveedor, rut: i.proveedorRut, saldo: 0, vencido: 0, cantidad: 0 };
      e.saldo += i.saldo; if (i.diasVencimiento < 0) e.vencido += i.saldo; e.cantidad++;
      porProveedor.set(k, e);
    }
    const ranking = [...porProveedor.values()].sort((a, b) => b.saldo - a.saldo);
    const actualizadoEn = await ultimaAct(tenantId, q.moneda || null);
    return reply.send({ items, totales, ranking, actualizadoEn });
  });

  // ═══════════════════════════════════════════════════════════════
  // FLUJO DE CAJA — cobros/pagos REALES por fecha + proyección.
  // Distinto del resultado económico: acá importa cuándo entró/salió
  // la plata. Reglas: cobro = FinanzaCobro.fecha / FlotaIngreso.cobradoAt;
  // pago = FinanzaPago.fecha / FlotaFactura.pagadaAt / gasto o factura
  // sin tracking → se asume pagado en su fecha (legacy).
  // ═══════════════════════════════════════════════════════════════
  app.get('/flujo-caja', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const q = req.query as any;
    const moneda = q.moneda || null;
    const p = prisma();
    const hoy = new Date();
    const anio = Number(q.anio) || hoy.getUTCFullYear();
    const desde = new Date(Date.UTC(anio, 0, 1));
    const horizonte = new Date(hoy.getTime() + 90 * 86400000);

    const [cobros, ingresosCobrados, ingresosPend, facturasPend, pagos, gastosLegacy, flotaFacts, recurrentes, tenant] = await Promise.all([
      p.finanzaCobro.findMany({ where: { tenantId, fecha: { gte: desde, lte: horizonte }, ...(moneda ? { moneda } : {}) }, select: { fecha: true, importe: true } }).catch(() => []),
      p.flotaIngreso.findMany({ where: { tenantId, cobradoAt: { gte: desde, lte: horizonte } }, select: { cobradoAt: true, monto: true } }).catch(() => []),
      p.flotaIngreso.findMany({ where: { tenantId, cobradoAt: null, fechaCobroEstimada: { gte: hoy, lte: horizonte } }, select: { fechaCobroEstimada: true, monto: true, concepto: true, cliente: true } }).catch(() => []),
      p.finanzaFactura.findMany({ where: { tenantId, deletedAt: null, estado: { in: ['EMITIDA', 'PARCIALMENTE_COBRADA'] }, ...(moneda ? { moneda } : {}) }, include: { cobros: true } }).catch(() => []),
      p.finanzaPago.findMany({ where: { tenantId, fecha: { gte: desde, lte: horizonte }, ...(moneda ? { moneda } : {}) }, select: { fecha: true, importe: true } }).catch(() => []),
      p.finanzaGasto.findMany({ where: { tenantId, deletedAt: null, fecha: { gte: desde, lte: hoy }, ...(moneda ? { moneda } : {}), pagos: { none: {} } }, select: { fecha: true, total: true, tipoComprobante: true } }).catch(() => []),
      p.flotaFactura.findMany({ where: { tenantId, tipoComprobante: { notIn: ['PRESUPUESTO', 'NOTA_CREDITO'] }, ...(moneda ? { moneda } : {}), OR: [{ pagadaAt: { not: null } }, { fechaVencimiento: null, fecha: { gte: desde, lte: hoy } }] }, select: { fecha: true, pagadaAt: true, total: true } }).catch(() => []),
      p.finanzaGasto.findMany({ where: { tenantId, deletedAt: null, ...(moneda ? { moneda } : {}), OR: [
        { esRecurrente: true, OR: [{ fechaHasta: null }, { fechaHasta: { gte: hoy } }] },
        { esAmortizable: true, fechaDesde: { not: null, lte: horizonte }, fechaHasta: { not: null, gte: hoy } },
      ] }, select: { total: true, neto: true, ivaRecuperable: true, esAmortizable: true, fechaDesde: true, fechaHasta: true } }).catch(() => []),
      p.tenant.findUnique({ where: { id: tenantId }, select: { resultadosConfig: true } }).catch(() => null),
    ]);

    const entradas: { fecha: Date; importe: number }[] = [
      ...cobros.map((c: any) => ({ fecha: new Date(c.fecha), importe: num(c.importe) })),
      ...ingresosCobrados.map((i: any) => ({ fecha: new Date(i.cobradoAt), importe: num(i.monto) })),
    ];
    const salidas: { fecha: Date; importe: number }[] = [
      ...pagos.map((x: any) => ({ fecha: new Date(x.fecha), importe: num(x.importe) })),
      ...gastosLegacy.map((g: any) => ({ fecha: new Date(g.fecha), importe: num(g.total) * (g.tipoComprobante === 'NOTA_CREDITO' ? -1 : 1) })),
      ...flotaFacts.map((f: any) => ({ fecha: new Date(f.pagadaAt || f.fecha), importe: num(f.total) })),
    ];

    const conf = (tenant?.resultadosConfig as any) || {};
    const saldoInicial = num(conf?.saldoInicial?.[moneda || ''] ?? conf?.saldoInicial?.['*'] ?? 0);

    const movs = [...entradas.map(e => ({ fecha: e.fecha, delta: e.importe })), ...salidas.map(s => ({ fecha: s.fecha, delta: -s.importe }))]
      .filter(m => m.fecha <= hoy).sort((a, b) => a.fecha.getTime() - b.fecha.getTime());

    const meses: any[] = [];
    let saldoCorrida = saldoInicial;
    for (let m = 0; m < 12; m++) {
      const d = new Date(Date.UTC(anio, m, 1)), h = new Date(Date.UTC(anio, m + 1, 1));
      if (d > hoy) break;
      const en = movs.filter(x => x.fecha >= d && x.fecha < h && x.delta > 0).reduce((s, x) => s + x.delta, 0);
      const sa = movs.filter(x => x.fecha >= d && x.fecha < h && x.delta < 0).reduce((s, x) => s - x.delta, 0);
      saldoCorrida += en - sa;
      meses.push({ mes: m + 1, mesKey: `${anio}-${String(m + 1).padStart(2, '0')}`, cobros: en, pagos: sa, flujoNeto: en - sa, saldo: saldoCorrida });
    }

    const proximosCobros = [
      ...facturasPend.map((f: any) => {
        const cobrado = f.cobros.reduce((s: number, c: any) => s + num(c.importe), 0);
        const saldo = Math.max(0, num(f.total) - cobrado);
        return { fecha: new Date(f.fechaVencimiento || f.fechaEmision), importe: saldo, concepto: `Cobro ${[f.puntoVenta, f.numero].filter(Boolean).join('-')} — ${f.clienteNombre}`, tipo: 'FACTURA' };
      }).filter((x: any) => x.importe > 0.5 && x.fecha <= horizonte),
      ...ingresosPend.map((i: any) => ({ fecha: new Date(i.fechaCobroEstimada), importe: num(i.monto), concepto: `${i.concepto}${i.cliente ? ' — ' + i.cliente : ''}`, tipo: 'INGRESO_FLOTA' })),
    ];
    const pendCxP = await obtenerCxPInterno(p, tenantId, moneda).catch(() => [] as any[]);
    const proximosPagos = pendCxP.filter((i: any) => i.saldo > 0.5)
      .map((i: any) => ({ fecha: new Date(i.fechaVencimiento || i.fechaEmision), importe: i.saldo, concepto: `${i.proveedor} — ${i.concepto}`, tipo: i.origen }));

    const bucket = (lista: any[], dias: number) => lista.filter(x => x.fecha >= hoy && x.fecha <= new Date(hoy.getTime() + dias * 86400000));
    const suma = (lista: any[]) => lista.reduce((s, x) => s + x.importe, 0);
    const saldoActual = saldoInicial + movs.reduce((s, m) => s + m.delta, 0);
    const proyeccion = [7, 30, 60, 90].map(d => ({
      dias: d, cobros: suma(bucket(proximosCobros, d)), pagos: suma(bucket(proximosPagos, d)),
      saldoProyectado: saldoActual + suma(bucket(proximosCobros, d)) - suma(bucket(proximosPagos, d)),
    }));

    return reply.send({
      saldoInicial, saldoActual,
      cobrosPeriodo: entradas.filter(e => e.fecha <= hoy).reduce((s, e) => s + e.importe, 0),
      pagosPeriodo: salidas.filter(s => s.fecha <= hoy).reduce((s, x) => s + x.importe, 0),
      flujoNeto: meses.reduce((s, m) => s + m.flujoNeto, 0),
      meses,
      proximosCobros: proximosCobros.sort((a, b) => a.fecha.getTime() - b.fecha.getTime()),
      proximosPagos: proximosPagos.sort((a, b) => a.fecha.getTime() - b.fecha.getTime()),
      proyeccion,
      // Equivalente mensual: recurrentes al total del mes (neto si el IVA se
      // recupera); amortizables a su prorrateo por la ventana.
      recurrentesMensual: recurrentes.reduce((s: number, r: any) => {
        const base = r.ivaRecuperable !== false && r.neto !== null ? num(r.neto) : num(r.total);
        if (r.esAmortizable && r.fechaDesde && r.fechaHasta) {
          const ini = new Date(r.fechaDesde), fin = new Date(r.fechaHasta);
          const m = (fin.getUTCFullYear() - ini.getUTCFullYear()) * 12 + fin.getUTCMonth() - ini.getUTCMonth() + 1;
          return s + (m > 0 ? base / m : base);
        }
        return s + base;
      }, 0),
      actualizadoEn: await ultimaAct(tenantId, moneda),
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // RENTABILIDAD — por centro de costo / cliente / servicio.
  // Ingresos: atribución directa (centroCostoId / cliente / servicioId).
  // Costos: directos por centroCostoId; para cliente se distribuyen
  // proporcional a su participación en ventas (regla explícita —
  // nunca se inventan datos).
  // ═══════════════════════════════════════════════════════════════
  app.get('/rentabilidad', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const q = req.query as any;
    const anio = Number(q.anio) || new Date().getUTCFullYear();
    const mesQ = q.mes ? Number(q.mes) : null;
    const moneda = q.moneda || null;
    const p = prisma();
    const desde = mesQ ? new Date(Date.UTC(anio, mesQ - 1, 1)) : new Date(Date.UTC(anio, 0, 1));
    const hasta = mesQ ? new Date(Date.UTC(anio, mesQ, 1)) : new Date(Date.UTC(anio + 1, 0, 1));

    const [lineas, facturas, ingresos, centros, servicios] = await Promise.all([
      recolectarLineas(tenantId, desde, hasta, moneda, q.centroCostoId || null),
      p.finanzaFactura.findMany({ where: { tenantId, deletedAt: null, estado: { not: 'ANULADA' }, fechaEmision: { gte: desde, lt: hasta }, ...(moneda ? { moneda } : {}) }, select: { clienteNombre: true, clienteRut: true, centroCostoId: true, servicioId: true, neto: true, total: true, tipoComprobante: true } }).catch(() => []),
      p.flotaIngreso.findMany({ where: { tenantId, fecha: { gte: desde, lt: hasta } }, select: { cliente: true, servicioId: true, monto: true, vehiculoId: true } }).catch(() => []),
      p.finanzaCentroCosto.findMany({ where: { tenantId, deletedAt: null }, select: { id: true, nombre: true, tipo: true } }).catch(() => []),
      p.flotaServicio.findMany({ where: { tenantId, deletedAt: null }, select: { id: true, nombre: true } }).catch(() => []),
    ]);

    const lineasCosto = lineas.filter(l => ['COSTO_OP', 'ESTRUCTURA', 'GASTO_MANUAL'].includes(l.grupo));
    const lineasIngreso = lineas.filter(l => ['FACTURADO', 'INGRESO_OPERATIVO'].includes(l.grupo));
    const centroNombre = new Map<string, string>(centros.map((c: any) => [c.id, c.nombre]));
    const servicioNombre = new Map<string, string>(servicios.map((s: any) => [s.id, s.nombre]));

    const acum = (map: Map<string, any>, key: string, label: string) => {
      if (!map.has(key)) map.set(key, { key, nombre: label, ventas: 0, costosDirectos: 0 });
      return map.get(key);
    };

    // Por centro de costo / unidad de negocio (atribución directa)
    const porCentro = new Map<string, any>();
    for (const l of lineasIngreso) acum(porCentro, l.centroCostoId || '_SIN', centroNombre.get(l.centroCostoId) || 'Sin asignar').ventas += l.importe;
    for (const l of lineasCosto) acum(porCentro, l.centroCostoId || '_SIN', centroNombre.get(l.centroCostoId) || 'Sin asignar').costosDirectos += l.importe;

    // Por cliente: ventas directas; costos proporcionales a participación
    const porCliente = new Map<string, any>();
    for (const f of facturas) {
      const sign = f.tipoComprobante === 'NOTA_CREDITO' ? -1 : 1;
      const base = num(f.neto) > 0 ? num(f.neto) : num(f.total);
      acum(porCliente, (f.clienteRut || f.clienteNombre || 'Sin nombre').toUpperCase(), f.clienteNombre || 'Sin nombre').ventas += sign * base;
    }
    for (const i of ingresos) {
      acum(porCliente, (i.cliente || 'Sin cliente').toUpperCase(), i.cliente || 'Sin cliente').ventas += num(i.monto);
    }
    const ventasTotalesClientes = [...porCliente.values()].reduce((s, c) => s + Math.max(0, c.ventas), 0);
    const totalCostos = lineasCosto.reduce((s, l) => s + l.importe, 0);
    for (const c of porCliente.values()) {
      c.costosDirectos = ventasTotalesClientes > 0 ? (Math.max(0, c.ventas) / ventasTotalesClientes) * totalCostos : 0;
      c.metodo = 'PROPORCIONAL_VENTAS';
    }

    // Por servicio (ventas con servicioId; costos requieren imputación que aún no existe)
    const porServicio = new Map<string, any>();
    for (const f of facturas) if (f.servicioId) acum(porServicio, f.servicioId, servicioNombre.get(f.servicioId) || 'Servicio').ventas += num(f.neto) > 0 ? num(f.neto) : num(f.total);
    for (const i of ingresos) if (i.servicioId) acum(porServicio, i.servicioId, servicioNombre.get(i.servicioId) || 'Servicio').ventas += num(i.monto);

    const fin = (map: Map<string, any>, conCostos: boolean) => [...map.values()].map(x => ({
      key: x.key, nombre: x.nombre, metodo: x.metodo || 'DIRECTO',
      ventas: x.ventas, costos: conCostos ? x.costosDirectos : null,
      resultado: conCostos ? x.ventas - x.costosDirectos : null,
      margen: conCostos && x.ventas > 0 ? Math.round(((x.ventas - x.costosDirectos) / x.ventas) * 1000) / 10 : null,
    })).sort((a, b) => b.ventas - a.ventas);

    return reply.send({
      anio, mes: mesQ, moneda,
      porCentroCosto: fin(porCentro, true),
      porCliente: fin(porCliente, true),
      porServicio: fin(porServicio, true),
      notaCostos: 'Costos por cliente imputados proporcional a su participación en ventas. Por centro de costo y servicio: atribución directa.',
      actualizadoEn: await ultimaAct(tenantId, moneda),
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // PUNTO DE EQUILIBRIO — clase FIJO/VARIABLE por línea de costo:
  //   1) gasto.claseCosto (manual por documento), 2) config.claseCosto[rubro]
  //   (parametrizable por tenant), 3) CLASE_DEFAULT sugerida por rubro.
  //   ESTRUCTURA sin clase → FIJO. Sin clasificar se reporta aparte.
  // ═══════════════════════════════════════════════════════════════
  const CLASE_DEFAULT: Record<string, string> = {
    SUELDOS: 'FIJO', FINANCIACION: 'FIJO', ALQUILER: 'FIJO', SEGUROS: 'FIJO',
    ADMINISTRACION: 'FIJO', IMPUESTOS: 'FIJO', SERVICIOS: 'FIJO',
    COMBUSTIBLE: 'VARIABLE', MANTENIMIENTO: 'VARIABLE', NEUMATICOS: 'VARIABLE',
    MULTAS: 'VARIABLE', REPUESTO: 'VARIABLE', SERVICE: 'VARIABLE', REPARACION: 'VARIABLE',
    CALIBRACIONES: 'VARIABLE', CAPACITACIONES: 'FIJO',
    // Operación del predio / depósito
    DESPENSA: 'VARIABLE', LIMPIEZA: 'FIJO', VIGILANCIA: 'FIJO', EPP: 'VARIABLE',
    EMBALAJE: 'VARIABLE', HERRAMIENTAS: 'VARIABLE', VIATICOS: 'VARIABLE',
    TECNOLOGIA: 'FIJO', MERMAS: 'VARIABLE', COMERCIAL: 'FIJO',
    // Circuito industrial / terceros
    CONSULTORIA: 'FIJO', ALQUILER_MAQUINARIA: 'FIJO', EXPENSAS: 'FIJO',
    PLAGAS: 'FIJO', RESIDUOS: 'FIJO', INSUMOS: 'VARIABLE',
    CERTIFICACIONES: 'FIJO', MEDICINA_LABORAL: 'FIJO', LEYES_SOCIALES: 'FIJO',
    FLETE: 'VARIABLE', PEAJES: 'VARIABLE', HONORARIOS: 'FIJO', BANCARIOS: 'FIJO',
    OTRO: 'MIXTO',
  };

  app.get('/punto-equilibrio', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const q = req.query as any;
    const anio = Number(q.anio) || new Date().getUTCFullYear();
    const moneda = q.moneda || null;
    const p = prisma();
    const hoy = new Date();
    const ultimoMes = anio === hoy.getUTCFullYear() ? hoy.getUTCMonth() + 1 : 12;
    const desde = new Date(Date.UTC(anio, 0, 1));
    const hasta = new Date(Date.UTC(anio, ultimoMes, 1));

    const [lineas, tenant, gastosClase] = await Promise.all([
      recolectarLineas(tenantId, desde, hasta, moneda, q.centroCostoId || null),
      p.tenant.findUnique({ where: { id: tenantId }, select: { resultadosConfig: true } }).catch(() => null),
      p.finanzaGasto.findMany({ where: { tenantId, deletedAt: null, fecha: { gte: desde, lt: hasta }, claseCosto: { not: null } }, select: { id: true, claseCosto: true } }).catch(() => []),
    ]);
    const conf = (tenant?.resultadosConfig as any) || {};
    const mapConf: Record<string, string> = conf?.claseCosto || {};
    const clasePorGasto = new Map(gastosClase.map((g: any) => [g.id, g.claseCosto]));

    const porRubroClase: Record<string, { fijo: number; variable: number; mixto: number }> = {};
    let fijos = 0, variables = 0, sinClasificar = 0;
    for (const l of lineas) {
      if (!['COSTO_OP', 'ESTRUCTURA', 'GASTO_MANUAL'].includes(l.grupo)) continue;
      const r = porRubroClase[l.rubro] || (porRubroClase[l.rubro] = { fijo: 0, variable: 0, mixto: 0 });
      let clase = mapConf[l.rubro] || clasePorGasto.get(l.origenId) || CLASE_DEFAULT[l.rubro] || null;
      if (l.grupo === 'ESTRUCTURA' && !clase) clase = 'FIJO';
      if (clase === 'FIJO') { fijos += l.importe; r.fijo += l.importe; }
      else if (clase === 'VARIABLE') { variables += l.importe; r.variable += l.importe; }
      else if (clase === 'MIXTO') { fijos += l.importe / 2; variables += l.importe / 2; r.mixto += l.importe; }
      else sinClasificar += l.importe;
    }
    const ventas = lineas.filter(l => ['FACTURADO', 'INGRESO_OPERATIVO'].includes(l.grupo)).reduce((s, l) => s + l.importe, 0);
    const mesesConDatos = Math.max(1, ultimoMes);
    const margenContribucion = ventas - variables;
    const ratioContribucion = ventas > 0 ? margenContribucion / ventas : 0;
    const puntoEquilibrio = ratioContribucion > 0 ? fijos / ratioContribucion : null;
    const ventasMensualProm = ventas / mesesConDatos;
    const peMensual = puntoEquilibrio !== null ? puntoEquilibrio / mesesConDatos : null;

    return reply.send({
      anio, moneda, mesesConsiderados: mesesConDatos,
      costosFijos: fijos, costosVariables: variables, sinClasificar,
      ventas, margenContribucion, ratioContribucion: Math.round(ratioContribucion * 1000) / 10,
      puntoEquilibrio, peMensual, ventasMensualProm,
      vsPuntoEquilibrio: peMensual && ventasMensualProm > 0 ? Math.round(((ventasMensualProm - peMensual) / peMensual) * 1000) / 10 : null,
      porRubro: Object.entries(porRubroClase).map(([rubro, v]) => ({ rubro, ...v, clase: mapConf[rubro] || CLASE_DEFAULT[rubro] || null })),
      config: mapConf,
      actualizadoEn: await ultimaAct(tenantId, moneda),
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // PROYECCIÓN DE CIERRE — real hasta hoy + compromisos conocidos +
  // estimación del resto (ritmo diario de los últimos 3 meses).
  // ═══════════════════════════════════════════════════════════════
  app.get('/proyeccion-cierre', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const q = req.query as any;
    const hoy = new Date();
    const anio = Number(q.anio) || hoy.getUTCFullYear();
    const mes = Number(q.mes) || hoy.getUTCMonth() + 1;
    const moneda = q.moneda || null;
    const p = prisma();
    const desde = new Date(Date.UTC(anio, mes - 1, 1));
    const hasta = new Date(Date.UTC(anio, mes, 1));
    const esActual = hoy >= desde && hoy < hasta;
    const corte = esActual ? hoy : hasta;
    const diasMes = Math.round((hasta.getTime() - desde.getTime()) / 86400000);
    const diasTranscurridos = Math.max(1, Math.round((corte.getTime() - desde.getTime()) / 86400000));
    const diasRestantes = Math.max(0, diasMes - diasTranscurridos);

    const [lineas, lineasPrev, pendCxP] = await Promise.all([
      recolectarLineas(tenantId, desde, corte, moneda, q.centroCostoId || null),
      recolectarLineas(tenantId, new Date(Date.UTC(anio, mes - 4, 1)), desde, moneda, q.centroCostoId || null),
      obtenerCxPInterno(p, tenantId, moneda).catch(() => [] as any[]),
    ]);

    const esIng = (l: any) => ['FACTURADO', 'INGRESO_OPERATIVO'].includes(l.grupo);
    const esCosto = (l: any) => ['COSTO_OP', 'ESTRUCTURA', 'GASTO_MANUAL'].includes(l.grupo);
    const ventasReal = lineas.filter(esIng).reduce((s, l) => s + l.importe, 0);
    const costosReal = lineas.filter(esCosto).reduce((s, l) => s + l.importe, 0);

    // Compromisos conocidos: CxP que vence dentro del resto del mes
    const compromisosPago = pendCxP
      .filter((i: any) => i.saldo > 0.5 && new Date(i.fechaVencimiento || i.fechaEmision) >= corte && new Date(i.fechaVencimiento || i.fechaEmision) < hasta)
      .reduce((s: number, i: any) => s + i.saldo, 0);

    // Ritmo histórico: promedio diario de los últimos 3 meses con datos
    const mesesPrevConDatos = Math.max(1, new Set(lineasPrev.map(l => `${new Date(l.fecha).getUTCFullYear()}-${new Date(l.fecha).getUTCMonth()}`)).size);
    const ventasPrev = lineasPrev.filter(esIng).reduce((s, l) => s + l.importe, 0);
    const costosPrev = lineasPrev.filter(esCosto).reduce((s, l) => s + l.importe, 0);
    const estVentas = esActual ? (ventasPrev / (mesesPrevConDatos * 30.44)) * diasRestantes : 0;
    const estCostos = Math.max(0, esActual ? (costosPrev / (mesesPrevConDatos * 30.44)) * diasRestantes - compromisosPago : 0);

    const ventasProj = ventasReal + estVentas;
    const costosProj = costosReal + compromisosPago + estCostos;
    const resultadoProj = ventasProj - costosProj;
    const base = ventasProj + costosProj;
    const confianza = base > 0 ? Math.round(((ventasReal + costosReal + compromisosPago) / base) * 100) : 0;

    return reply.send({
      anio, mes, moneda, esMesActual: esActual, diasTranscurridos, diasRestantes,
      ventas: { real: ventasReal, compromisos: 0, estimacion: estVentas, proyectado: ventasProj },
      costos: { real: costosReal, compromisos: compromisosPago, estimacion: estCostos, proyectado: costosProj },
      resultadoProyectado: resultadoProj,
      margenProyectado: ventasProj > 0 ? Math.round((resultadoProj / ventasProj) * 1000) / 10 : null,
      confianza, confianzaLabel: confianza >= 70 ? 'ALTA' : confianza >= 40 ? 'MEDIA' : 'BAJA',
      metodo: 'Real registrado + compromisos (CxP con vencimiento en el mes) + ritmo diario de los últimos 3 meses con datos.',
      actualizadoEn: await ultimaAct(tenantId, moneda),
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // IVA CRÉDITO FISCAL — evidencia del recupero de IVA en costos.
  // recuperado = IVA desagregado en documentos marcados recuperables;
  // noRecuperado = IVA que computa como costo; estimado = IVA implícito
  // en cargas de combustible sin desagregar (surtidor incluye IVA).
  // ═══════════════════════════════════════════════════════════════
  const IVA_TASA: Record<string, number> = { ARS: 0.21, CLP: 0.19, USD: 0, UYU: 0.22, PYG: 0.1, BRL: 0 };
  // Tasa efectiva: override del tenant en resultadosConfig.ivaTasa[moneda], sino el default por moneda
  const tasaIva = async (tenantId: string, moneda: string | null) => {
    const t = await app.prisma.tenant.findUnique({ where: { id: tenantId }, select: { resultadosConfig: true } }).catch(() => null);
    const over = (t?.resultadosConfig as any)?.ivaTasa as Record<string, number> | undefined;
    if (moneda && over && over[moneda] !== undefined) return Number(over[moneda]);
    return moneda ? (IVA_TASA[moneda] ?? 0.21) : 0.21;
  };

  app.get('/iva-credito', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const q = req.query as any;
    const anio = Number(q.anio) || new Date().getUTCFullYear();
    const moneda = q.moneda || null;
    const tasa = await tasaIva(tenantId, moneda);
    const hoy = new Date();
    const ultimoMes = anio === hoy.getUTCFullYear() ? hoy.getUTCMonth() + 1 : 12;
    const lineas = await recolectarLineas(tenantId, new Date(Date.UTC(anio, 0, 1)), new Date(Date.UTC(anio, ultimoMes, 1)), moneda, q.centroCostoId || null);
    const meses = [];
    const tot = { recuperado: 0, noRecuperado: 0, estimado: 0, cargasSinDesagregar: 0 };
    for (let m = 1; m <= ultimoMes; m++) {
      const ls = lineas.filter((l: any) => new Date(l.fecha).getUTCMonth() + 1 === m);
      const recuperado = ls.filter(l => l.ivaRecuperable !== false && num(l.iva) > 0).reduce((s, l) => s + num(l.iva), 0);
      const noRecuperado = ls.filter(l => l.ivaRecuperable === false && num(l.iva) > 0).reduce((s, l) => s + num(l.iva), 0);
      const sinDesag = ls.filter(l => l.fuente === 'COMBUSTIBLE' && l.ivaRecuperable !== false && num(l.iva) === 0 && num(l.ivaBruto) > 0);
      const estimado = sinDesag.reduce((s, l) => s + num(l.ivaBruto) * (tasa / (1 + tasa)), 0);
      meses.push({ mes: m, mesKey: `${anio}-${String(m).padStart(2, '0')}`, recuperado, noRecuperado, estimado, cargasSinDesagregar: sinDesag.length });
      tot.recuperado += recuperado; tot.noRecuperado += noRecuperado; tot.estimado += estimado; tot.cargasSinDesagregar += sinDesag.length;
    }
    const actualizadoEn = await ultimaAct(tenantId, moneda);
    return reply.send({ anio, moneda, tasaEstimada: tasa, meses, totales: tot, actualizadoEn });
  });

  // ═══════════════════════════════════════════════════════════════
  // ALERTAS GERENCIALES — reglas deterministas sobre datos reales.
  // Umbrales por tenant: resultadosConfig.alertas {atencion:10, critica:25}.
  // Severidad: INFO | ATENCION | CRITICA. Máximo 8, por impacto económico.
  // ═══════════════════════════════════════════════════════════════
  app.get('/alertas', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const q = req.query as any;
    const hoy = new Date();
    const anio = Number(q.anio) || hoy.getUTCFullYear();
    const mes = Number(q.mes) || hoy.getUTCMonth() + 1;
    const moneda = q.moneda || null;
    const p = prisma();

    const tenant = await p.tenant.findUnique({ where: { id: tenantId }, select: { resultadosConfig: true } }).catch(() => null);
    const umbrales = ((tenant?.resultadosConfig as any)?.alertas) || {};
    const UMB_AT = num(umbrales.atencion) || 10;
    const UMB_CR = num(umbrales.critica) || 25;
    const ivaOver = ((tenant?.resultadosConfig as any)?.ivaTasa as Record<string, number> | undefined) || {};
    const tasaIvaAlerta = moneda && ivaOver[moneda] !== undefined ? Number(ivaOver[moneda]) : moneda ? (IVA_TASA[moneda] ?? 0.21) : 0.21;

    const desde = new Date(Date.UTC(anio, mes - 1, 1));
    const hasta = new Date(Date.UTC(anio, mes, 1));
    const desdePrev = new Date(Date.UTC(anio, mes - 2, 1));
    const desdeHist = new Date(Date.UTC(anio, mes - 7, 1));

    const [lineas, lineasPrev, lineasHist, cxp, cxc] = await Promise.all([
      recolectarLineas(tenantId, desde, hasta, moneda, q.centroCostoId || null),
      recolectarLineas(tenantId, desdePrev, desde, moneda, q.centroCostoId || null),
      recolectarLineas(tenantId, desdeHist, desdePrev, moneda, q.centroCostoId || null),
      obtenerCxPInterno(p, tenantId, moneda).catch(() => [] as any[]),
      p.finanzaFactura.findMany({ where: { tenantId, deletedAt: null, estado: { in: ['EMITIDA', 'PARCIALMENTE_COBRADA'] }, ...(moneda ? { moneda } : {}) }, include: { cobros: true } }).catch(() => []),
    ]);

    const sumaGrupo = (ls: any[], g: string[]) => ls.filter(l => g.includes(l.grupo)).reduce((s, l) => s + l.importe, 0);
    const porRubro = (ls: any[]) => {
      const r: Record<string, number> = {};
      for (const l of ls) if (['COSTO_OP', 'ESTRUCTURA', 'GASTO_MANUAL'].includes(l.grupo)) r[l.rubro] = (r[l.rubro] || 0) + l.importe;
      return r;
    };
    const ing = (ls: any[]) => sumaGrupo(ls, ['FACTURADO', 'INGRESO_OPERATIVO']);
    const cst = (ls: any[]) => sumaGrupo(ls, ['COSTO_OP', 'ESTRUCTURA', 'GASTO_MANUAL']);

    const alertas: any[] = [];
    const push = (severidad: string, tipo: string, mensaje: string, impacto: number, ref?: string) =>
      alertas.push({ severidad, tipo, mensaje, impacto: Math.abs(impacto), ref: ref || null });

    const vAct = ing(lineas), vPrev = ing(lineasPrev);
    const cAct = cst(lineas), cPrev = cst(lineasPrev);
    const rAct = vAct - cAct, rPrev = vPrev - cPrev;
    const varPct = (a: number, b: number) => (b !== 0 ? ((a - b) / Math.abs(b)) * 100 : null);

    // Variación de facturación / resultado / margen
    const vVentas = varPct(vAct, vPrev);
    if (vVentas !== null && Math.abs(vVentas) >= UMB_AT)
      push(vVentas >= UMB_CR ? 'CRITICA' : Math.abs(vVentas) >= UMB_CR ? 'CRITICA' : 'ATENCION', vVentas > 0 ? 'VENTAS_UP' : 'VENTAS_DOWN',
        `Ventas ${vVentas > 0 ? 'aumentaron' : 'cayeron'} ${Math.abs(vVentas).toFixed(1)} % respecto del mes anterior`, vAct - vPrev);
    const vRes = varPct(rAct, rPrev);
    if (vRes !== null && Math.abs(vRes) >= UMB_AT)
      push(rAct < rPrev ? 'ATENCION' : 'INFO', 'RESULTADO',
        `Resultado ${vRes! > 0 ? 'mejoró' : 'empeoró'} ${Math.abs(vRes!).toFixed(1)} % respecto del mes anterior`, rAct - rPrev);

    // Variación por rubro vs mes anterior y vs promedio 6 meses
    const rubAct = porRubro(lineas), rubPrev = porRubro(lineasPrev), rubHist = porRubro(lineasHist);
    const mesesHist = Math.max(1, new Set(lineasHist.map(l => `${new Date(l.fecha).getUTCFullYear()}-${new Date(l.fecha).getUTCMonth()}`)).size);
    const rubros = new Set([...Object.keys(rubAct), ...Object.keys(rubPrev)]);
    for (const r of rubros) {
      const a = rubAct[r] || 0, b = rubPrev[r] || 0;
      const prom = (rubHist[r] || 0) / mesesHist;
      const vM = varPct(a, b);
      if (vM !== null && a > b && Math.abs(vM) >= UMB_AT)
        push(Math.abs(vM) >= UMB_CR ? 'CRITICA' : 'ATENCION', 'RUBRO_UP',
          `${r} aumentó ${Math.abs(vM).toFixed(1)} % respecto del mes anterior`, a - b);
      else if (a > prom && prom > 0 && varPct(a, prom)! >= UMB_CR)
        push('ATENCION', 'RUBRO_HIST',
          `${r} está ${(((a - prom) / prom) * 100).toFixed(0)} % por encima del promedio de los últimos ${mesesHist} meses`, a - prom);
    }

    // Presupuesto mensual por categoría (resultadosConfig.presupuesto):
    // el real del mes superando el tope dispara alerta.
    const presupuesto = ((tenant?.resultadosConfig as any)?.presupuesto as Record<string, number> | undefined) || {};
    for (const [cat, tope] of Object.entries(presupuesto)) {
      const t = num(tope);
      if (t <= 0) continue;
      const real = rubAct[cat] || 0;
      if (real > t) {
        const exceso = real - t;
        push(exceso / t >= UMB_CR / 100 ? 'CRITICA' : 'ATENCION', 'PRESUPUESTO_EXCEDIDO',
          `${cat} superó el presupuesto mensual en ${((exceso / t) * 100).toFixed(0)} % (${real.toLocaleString('es-AR', { maximumFractionDigits: 0 })} de ${t.toLocaleString('es-AR', { maximumFractionDigits: 0 })})`, exceso, '/resultados?tab=gastos');
      }
    }

    // CxC vencida
    const vencidoCxc = cxc.reduce((s: number, f: any) => {
      const cobrado = f.cobros.reduce((x: number, c: any) => x + num(c.importe), 0);
      const saldo = Math.max(0, num(f.total) - cobrado);
      return saldo > 0.5 && f.fechaVencimiento && new Date(f.fechaVencimiento) < hoy ? s + saldo : s;
    }, 0);
    if (vencidoCxc > 0) push('ATENCION', 'CXC_VENCIDA', `${moneda || ''} ${vencidoCxc.toLocaleString('es-AR', { maximumFractionDigits: 0 })} están vencidos de cobro`.trim(), vencidoCxc);

    // CxP vencida / próxima
    const pendCxP = cxp.filter((i: any) => i.saldo > 0.5);
    const vencidoCxp = pendCxP.filter(i => i.diasVencimiento < 0).reduce((s, i) => s + i.saldo, 0);
    const prox7 = pendCxP.filter(i => i.diasVencimiento >= 0 && i.diasVencimiento <= 7).reduce((s, i) => s + i.saldo, 0);
    if (vencidoCxp > 0) push('CRITICA', 'CXP_VENCIDA', `${vencidoCxp.toLocaleString('es-AR', { maximumFractionDigits: 0 })} en obligaciones están vencidas`, vencidoCxp);
    if (prox7 > 0) push('ATENCION', 'CXP_7D', `En los próximos 7 días vencen ${prox7.toLocaleString('es-AR', { maximumFractionDigits: 0 })} en obligaciones`, prox7);

    // IVA: no recuperado computa como costo; combustible sin desagregar
    // no evidencia el crédito fiscal que podría estarse perdiendo.
    const ivaNoRec = lineas.filter(l => l.ivaRecuperable === false && num(l.iva) > 0).reduce((s, l) => s + num(l.iva), 0);
    if (ivaNoRec > 0)
      push('ATENCION', 'IVA_NO_RECUPERADO', `${ivaNoRec.toLocaleString('es-AR', { maximumFractionDigits: 0 })} de IVA computó como costo (marcado no recuperable)`, ivaNoRec);
    const combSinIva = lineas.filter(l => l.fuente === 'COMBUSTIBLE' && l.ivaRecuperable !== false && num(l.iva) === 0 && num(l.ivaBruto) > 0);
    if (combSinIva.length > 0) {
      const bruto = combSinIva.reduce((s, l) => s + num(l.ivaBruto), 0);
      push('INFO', 'IVA_SIN_DESAGREGAR', `${combSinIva.length} cargas de combustible sin IVA desagregado — posible crédito fiscal sin evidenciar`, tasaIvaAlerta > 0 ? bruto * tasaIvaAlerta / (1 + tasaIvaAlerta) : 0);
    }

    // Orden: CRITICA → ATENCION → INFO, dentro por impacto. Máximo 8.
    const sev: Record<string, number> = { CRITICA: 3, ATENCION: 2, INFO: 1 };
    alertas.sort((a, b) => sev[b.severidad] - sev[a.severidad] || b.impacto - a.impacto);
    const actualizadoEn = await ultimaAct(tenantId, moneda);
    return reply.send({ alertas: alertas.slice(0, 8), umbrales: { atencion: UMB_AT, critica: UMB_CR }, actualizadoEn });
  });

  // ═══════════════════════════════════════════════════════════════
  // COMPARATIVA + "¿QUÉ EXPLICA EL RESULTADO?" — determinístico:
  // mes vs mes anterior y mismo mes año anterior. La explicación
  // descompone la variación del resultado en sus drivers reales.
  // ═══════════════════════════════════════════════════════════════
  app.get('/comparativa', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const q = req.query as any;
    const anio = Number(q.anio) || new Date().getUTCFullYear();
    const mes = Number(q.mes) || new Date().getUTCMonth() + 1;
    const moneda = q.moneda || null;
    const cc = q.centroCostoId || null;

    const rango = (a: number, m: number) => [new Date(Date.UTC(a, m - 1, 1)), new Date(Date.UTC(a, m, 1))] as const;
    const [dA, hA] = rango(anio, mes);
    const prevMes = mes === 1 ? { a: anio - 1, m: 12 } : { a: anio, m: mes - 1 };
    const [dM, hM] = rango(prevMes.a, prevMes.m);
    const [dY, hY] = rango(anio - 1, mes);

    const [act, prev, yoy] = await Promise.all([
      recolectarLineas(tenantId, dA, hA, moneda, cc),
      recolectarLineas(tenantId, dM, hM, moneda, cc),
      recolectarLineas(tenantId, dY, hY, moneda, cc),
    ]);

    const resumen = (ls: any[]) => {
      const g = (gr: string[]) => ls.filter(l => gr.includes(l.grupo)).reduce((s, l) => s + l.importe, 0);
      const ventas = g(['FACTURADO', 'INGRESO_OPERATIVO']);
      const costos = g(['COSTO_OP', 'GASTO_MANUAL']) , estructura = g(['ESTRUCTURA']);
      const porRubro: Record<string, number> = {};
      for (const l of ls) if (['COSTO_OP', 'ESTRUCTURA', 'GASTO_MANUAL'].includes(l.grupo)) porRubro[l.rubro] = (porRubro[l.rubro] || 0) + l.importe;
      const porFuenteIng: Record<string, number> = {};
      for (const l of ls) if (['FACTURADO', 'INGRESO_OPERATIVO'].includes(l.grupo)) porFuenteIng[l.fuente] = (porFuenteIng[l.fuente] || 0) + l.importe;
      const cobrado = g(['COBRADO']);
      const resultado = ventas - costos - estructura;
      return { ventas, costos, estructura, costosTotales: costos + estructura, cobrado, resultado, margen: ventas > 0 ? (resultado / ventas) * 100 : null, porRubro, porFuenteIng, lineas: ls.length };
    };
    const A = resumen(act), P = resumen(prev), Y = resumen(yoy);

    const delta = (a: number, b: number) => ({ abs: a - b, pct: b !== 0 ? ((a - b) / Math.abs(b)) * 100 : null });
    const compara = (a: typeof A, b: typeof A) => ({
      ventas: delta(a.ventas, b.ventas), costos: delta(a.costosTotales, b.costosTotales),
      resultado: delta(a.resultado, b.resultado),
      margen: a.margen !== null && b.margen !== null ? { abs: a.margen - b.margen } : null,
      cobrado: delta(a.cobrado, b.cobrado),
    });

    // Drivers: variación del resultado = Δventas − Δcostos. Se descompone.
    const drivers: any[] = [];
    if (A.lineas || P.lineas) {
      const fuentesIng = new Set([...Object.keys(A.porFuenteIng), ...Object.keys(P.porFuenteIng)]);
      for (const f of fuentesIng) {
        const d = (A.porFuenteIng[f] || 0) - (P.porFuenteIng[f] || 0);
        if (Math.abs(d) > 0.5) drivers.push({ tipo: 'INGRESO', clave: f, variacion: d, actual: A.porFuenteIng[f] || 0, anterior: P.porFuenteIng[f] || 0 });
      }
      const rubros = new Set([...Object.keys(A.porRubro), ...Object.keys(P.porRubro)]);
      for (const r of rubros) {
        const d = (A.porRubro[r] || 0) - (P.porRubro[r] || 0);
        if (Math.abs(d) > 0.5) drivers.push({ tipo: 'COSTO', clave: r, variacion: -d, actual: A.porRubro[r] || 0, anterior: P.porRubro[r] || 0 });
      }
      drivers.sort((a, b) => Math.abs(b.variacion) - Math.abs(a.variacion));
    }

    const huboPrev = P.lineas > 0, huboYoy = Y.lineas > 0;
    return reply.send({
      anio, mes, moneda,
      actual: A,
      mesAnterior: { ...P, mesKey: `${prevMes.a}-${String(prevMes.m).padStart(2, '0')}`, hayDatos: huboPrev },
      mismoMesAnioAnterior: { ...Y, mesKey: `${anio - 1}-${String(mes).padStart(2, '0')}`, hayDatos: huboYoy },
      vsMesAnterior: compara(A, P),
      vsAnioAnterior: huboYoy ? compara(A, Y) : null,
      drivers: drivers.slice(0, 8),
      actualizadoEn: await ultimaAct(tenantId, moneda),
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // COMENTARIO DEL PERÍODO — nota gerencial con autor y fecha.
  // Se diferencia del resumen automático: es texto de un humano.
  // ═══════════════════════════════════════════════════════════════
  app.get('/comentarios-periodo', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const q = req.query as any;
    const where: any = { tenantId, deletedAt: null };
    if (q.mesKey) where.mesKey = q.mesKey;
    if (q.centroCostoId) where.centroCostoId = q.centroCostoId;
    const comentarios = await prisma().finanzaComentarioPeriodo.findMany({ where, orderBy: { createdAt: 'desc' }, take: 100 }).catch(() => []);
    return reply.send({ comentarios });
  });

  app.post('/comentarios-periodo', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const body = z.object({
      mesKey: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
      centroCostoId: z.string().uuid().optional().nullable(),
      texto: z.string().min(1).max(2000),
    }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Validation failed', details: body.error.issues });
    const user = await resolveUser(app.prisma, (req as any).auth?.userId);
    const c = await prisma().finanzaComentarioPeriodo.create({
      data: { tenantId, mesKey: body.data.mesKey, centroCostoId: body.data.centroCostoId || null, texto: body.data.texto, createdById: user.id, createdByNombre: user.nombre },
    });
    return reply.code(201).send({ comentario: c });
  });

  app.patch('/comentarios-periodo/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const body = z.object({ texto: z.string().min(1).max(2000) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Validation failed', details: body.error.issues });
    const r = await prisma().finanzaComentarioPeriodo.updateMany({ where: { id, tenantId, deletedAt: null }, data: { texto: body.data.texto } });
    if (!r.count) return reply.code(404).send({ error: 'Comentario no encontrado' });
    return reply.send({ ok: true });
  });

  app.delete('/comentarios-periodo/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const r = await prisma().finanzaComentarioPeriodo.updateMany({ where: { id, tenantId }, data: { deletedAt: new Date() } });
    if (!r.count) return reply.code(404).send({ error: 'Comentario no encontrado' });
    return reply.send({ ok: true });
  });

  // ═══════════════════════════════════════════════════════════════
  // IMPORTACIÓN RCV (Registro de Compras y Ventas — SII Chile)
  // El front parsea el CSV y envía filas normalizadas. Deduplica por
  // tipo + folio + RUT: re-importar el mismo mes no duplica.
  // ═══════════════════════════════════════════════════════════════
  const filaRcvSchema = z.object({
    tipoDoc: z.string().max(10),
    folio: z.string().min(1).max(50),
    rut: z.string().max(20).optional().nullable(),
    razonSocial: z.string().max(200).optional().nullable(),
    fecha: z.string(),
    exento: z.number().default(0),
    neto: z.number().default(0),
    iva: z.number().default(0),
    ivaNoRecuperable: z.number().default(0),
    total: z.number(),
  });
  const importRcvSchema = z.object({
    tipo: z.enum(['VENTAS', 'COMPRAS']),
    moneda: z.string().max(5).default('CLP'),
    centroCostoId: z.string().uuid().optional().nullable(),
    diasVencimiento: z.number().int().min(0).max(365).default(30),
    categoriaDefault: z.string().max(50).default('OTRO'),
    tipoGastoDefault: z.enum(['OPERATIVO', 'ESTRUCTURA', 'OTRO']).default('OPERATIVO'),
    filas: z.array(filaRcvSchema).min(1).max(5000),
  });
  // Códigos de documento SII → tipo interno
  const tipoDesdeSii = (cod: string) => {
    const c = String(cod).trim();
    if (c === '61') return 'NOTA_CREDITO';
    if (c === '56') return 'NOTA_DEBITO';
    if (c === '39' || c === '41') return 'BOLETA';
    if (c === '33' || c === '34' || c === '30' || c === '32' || c === '46') return 'FACTURA';
    return 'OTRO';
  };

  app.post('/importar-rcv', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const body = importRcvSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Validation failed', details: body.error.issues });
    const { tipo, moneda, centroCostoId, diasVencimiento, categoriaDefault, tipoGastoDefault, filas } = body.data;
    const user = await resolveUser(app.prisma, (req as any).auth?.userId);
    const p = prisma();
    let creados = 0, duplicados = 0;
    const errores: string[] = [];

    // Clasificación previa por proveedor: si ya existe un gasto de ese RUT, se reutiliza
    const clasif = new Map<string, any>();
    if (tipo === 'COMPRAS') {
      const ruts = [...new Set(filas.map(f => f.rut).filter(Boolean))] as string[];
      const prev = ruts.length ? await p.finanzaGasto.findMany({
        where: { tenantId, deletedAt: null, proveedorRut: { in: ruts } },
        orderBy: { updatedAt: 'desc' }, select: { proveedorRut: true, categoria: true, tipoGasto: true, centroCostoId: true },
      }) : [];
      for (const g of prev) if (!clasif.has(g.proveedorRut)) clasif.set(g.proveedorRut, g);
    }

    for (const f of filas) {
      const fecha = new Date(f.fecha);
      if (isNaN(fecha.getTime())) { errores.push(`Folio ${f.folio}: fecha inválida`); continue; }
      const tipoComprobante = tipoDesdeSii(f.tipoDoc);
      try {
        if (tipo === 'VENTAS') {
          const existe = await p.finanzaFactura.findFirst({ where: { tenantId, deletedAt: null, numero: f.folio, tipoComprobante, ...(f.rut ? { clienteRut: f.rut } : {}) }, select: { id: true } });
          if (existe) { duplicados++; continue; }
          await p.finanzaFactura.create({
            data: {
              tenantId, numero: f.folio, tipoComprobante, fechaEmision: fecha,
              fechaVencimiento: tipoComprobante === 'NOTA_CREDITO' ? null : new Date(fecha.getTime() + diasVencimiento * 86400000),
              clienteNombre: f.razonSocial || f.rut || 'Sin nombre', clienteRut: f.rut || null,
              neto: f.neto + f.exento, iva: f.iva, total: f.total, moneda, centroCostoId: centroCostoId || null,
              origen: 'IMPORT_RCV', uploadedById: user.id, uploadedByNombre: user.nombre,
            },
          });
        } else {
          const existe = await p.finanzaGasto.findFirst({ where: { tenantId, deletedAt: null, numeroComprobante: f.folio, tipoComprobante, ...(f.rut ? { proveedorRut: f.rut } : {}) }, select: { id: true } });
          if (existe) { duplicados++; continue; }
          const prev = f.rut ? clasif.get(f.rut) : null;
          await p.finanzaGasto.create({
            data: {
              tenantId, fecha, proveedor: f.razonSocial || null, proveedorRut: f.rut || null,
              concepto: `${tipoComprobante === 'NOTA_CREDITO' ? 'NC' : 'Factura'} ${f.folio}${f.razonSocial ? ' — ' + f.razonSocial : ''}`,
              categoria: prev?.categoria || categoriaDefault, tipoGasto: prev?.tipoGasto || tipoGastoDefault,
              centroCostoId: prev?.centroCostoId ?? centroCostoId ?? null,
              // IVA no recuperable es costo; el recuperable no
              neto: f.neto + f.exento + f.ivaNoRecuperable, iva: f.iva, total: f.total, moneda,
              tipoComprobante, numeroComprobante: f.folio, origen: 'IMPORT_RCV',
              uploadedById: user.id, uploadedByNombre: user.nombre,
            },
          });
        }
        creados++;
      } catch (e: any) {
        errores.push(`Folio ${f.folio}: ${e?.message?.slice(0, 120) || 'error'}`);
      }
    }
    return reply.send({ ok: true, creados, duplicados, errores: errores.slice(0, 50), totalErrores: errores.length });
  });
}
