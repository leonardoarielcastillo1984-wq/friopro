import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getEffectiveTenantId } from '../utils/tenant-bypass.js';
import { createGroqOnlyLLMProvider } from '../services/llm/factory.js';
import { finanzaCore } from '../services/finanzaCore.js';
import { existsSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { encryptApiKey, decryptApiKey } from '../services/llm/tenantCrypto.js';
import { sendEmail } from '../services/email.js';
// @ts-ignore — pdf-parse no publica tipos propios
import pdfParse from 'pdf-parse';
import XLSX from 'xlsx';

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

// Moneda por defecto según el país del tenant (usada por rutas y por los
// jobs diarios — por eso vive a nivel módulo).
const MONEDA_PAIS: Record<string, string> = {
  AR: 'ARS', CL: 'CLP', BR: 'BRL', UY: 'UYU', PY: 'PYG', BO: 'BOB', PE: 'PEN',
  EC: 'USD', CO: 'COP', VE: 'VES', MX: 'MXN', US: 'USD', ES: 'EUR',
};

const APP_URL = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

// Cache en memoria del contexto del asistente /explicar: recolectar líneas
// del mes es la parte cara; se reutiliza 10 minutos por tenant+período.
const EXPLICA_CACHE = new Map<string, { at: number; lineas: any[] }>();
const EXPLICA_CACHE_TTL = 10 * 60 * 1000;

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
// Una nota de crédito no tiene obligación de cobro → nunca VENCIDA.
function estadoEfectivo(f: any): string {
  if (f.estado === 'ANULADA' || f.estado === 'COBRADA') return f.estado;
  if (f.tipoComprobante === 'NOTA_CREDITO') return f.estado;
  if (f.fechaVencimiento && new Date(f.fechaVencimiento) < new Date()) return 'VENCIDA';
  return f.estado;
}

// Verifica que los IDs referenciados existan y pertenezcan al tenant.
// Sin esto, un centroCostoId/vehiculoId/servicioId de otro tenant o inexistente
// dejaba el documento "invisible" al filtrar por centro de costo.
async function validarRefs(p: any, tenantId: string, refs: { centroCostoId?: string | null; vehiculoId?: string | null; servicioId?: string | null }) {
  if (refs.centroCostoId) {
    const c = await p.finanzaCentroCosto.findFirst({ where: { id: refs.centroCostoId, tenantId, deletedAt: null }, select: { id: true } }).catch(() => null);
    if (!c) return 'centroCostoId';
  }
  if (refs.vehiculoId) {
    const v = await p.vehiculo.findFirst({ where: { id: refs.vehiculoId, tenantId }, select: { id: true } }).catch(() => null);
    if (!v) return 'vehiculoId';
  }
  if (refs.servicioId) {
    const s = await p.flotaServicio.findFirst({ where: { id: refs.servicioId, tenantId, deletedAt: null }, select: { id: true } }).catch(() => null);
    if (!s) return 'servicioId';
  }
  return null;
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
      const EXT: Record<string, string> = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
      if (!EXT[data.mimetype]) return reply.code(400).send({ error: 'Solo PDF o imágenes' });
      const buf = await data.toBuffer();
      if (buf.length > 10 * 1024 * 1024) return reply.code(400).send({ error: 'El archivo supera 10 MB' });
      // Magic bytes: el mimetype declarado puede mentir (exe renombrado).
      const okMagic =
        (data.mimetype === 'application/pdf' && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) ||
        (data.mimetype === 'image/jpeg' && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) ||
        (data.mimetype === 'image/png' && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) ||
        (data.mimetype === 'image/webp' && buf.length > 12 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50);
      if (!okMagic) return reply.code(400).send({ error: 'El contenido no coincide con el tipo de archivo declarado' });
      const uploadDir = join(process.env.STORAGE_LOCAL_PATH || '/app/uploads', subdir, tenantId);
      if (!existsSync(uploadDir)) await mkdir(uploadDir, { recursive: true });
      // Extensión derivada del mimetype verificado, nunca del filename del cliente.
      const filename = `${Date.now()}_${randomBytes(6).toString('hex')}.${EXT[data.mimetype]}`;
      await writeFile(join(uploadDir, filename), buf);
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

  // Coherencia contable básica: el neto no puede superar el total.
  const checkNetoTotal = (d: any, ctx: z.RefinementCtx) => {
    if (d.neto !== undefined && d.neto !== null && d.total !== undefined && d.total !== null && d.neto > d.total + 0.5)
      ctx.addIssue({ code: 'custom', path: ['neto'], message: 'El neto no puede ser mayor que el total' });
  };
  const facturaSchemaBase = z.object({
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
  const facturaSchema = facturaSchemaBase.superRefine(checkNetoTotal);

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
    const { items, ...data } = body.data;
    const refError = await validarRefs(prisma(), tenantId, data);
    if (refError) return reply.code(400).send({ error: `${refError} no existe en esta empresa` });
    if (await rechazarSiCerrado(tenantId, data.fechaEmision ? new Date(data.fechaEmision) : new Date(), reply)) return;
    // Dedupe manual: mismo número + tipo + cliente (como hace el import RCV).
    if (data.numero) {
      const dup = await prisma().finanzaFactura.findFirst({
        where: { tenantId, deletedAt: null, numero: data.numero, tipoComprobante: data.tipoComprobante, ...(data.clienteRut ? { clienteRut: data.clienteRut } : { clienteNombre: data.clienteNombre }) },
        select: { id: true },
      });
      if (dup) return reply.code(409).send({ error: `Ya existe un comprobante ${data.tipoComprobante} N° ${data.numero} para ese cliente` });
    }
    const user = await resolveUser(app.prisma, (req as any).auth?.userId);
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
    const body = facturaSchemaBase.partial().superRefine(checkNetoTotal).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Validation failed', details: body.error.issues });
    const { items, ...data } = body.data;
    const refError = await validarRefs(prisma(), tenantId, data);
    if (refError) return reply.code(400).send({ error: `${refError} no existe en esta empresa` });
    const update: any = { ...data };
    if (data.fechaEmision) update.fechaEmision = new Date(data.fechaEmision);
    if (data.fechaVencimiento !== undefined) update.fechaVencimiento = data.fechaVencimiento ? new Date(data.fechaVencimiento) : null;
    // Cierre de período: no se edita un doc de un mes cerrado ni se lo mueve a uno.
    const prev = await prisma().finanzaFactura.findFirst({ where: { id, tenantId, deletedAt: null }, select: { fechaEmision: true } });
    if (!prev) return reply.code(404).send({ error: 'Factura no encontrada' });
    if (await rechazarSiCerrado(tenantId, prev.fechaEmision, reply)) return;
    if (update.fechaEmision && await rechazarSiCerrado(tenantId, update.fechaEmision, reply)) return;
    const r = await prisma().finanzaFactura.updateMany({ where: { id, tenantId, deletedAt: null }, data: update });
    if (items) {
      await prisma().finanzaFacturaItem.deleteMany({ where: { facturaId: id } });
      if (items.length) await prisma().finanzaFacturaItem.createMany({ data: items.map((i: any) => ({ ...i, facturaId: id })) });
    }
    // Si cambió el total o la fecha de vencimiento, el estado de cobro puede
    // haber quedado viejo (ej. bajó el total y ya estaba cubierto).
    if (data.total !== undefined || data.fechaVencimiento !== undefined) await syncFacturaEstado(app.prisma, id);
    const factura = await prisma().finanzaFactura.findFirst({ where: { id }, include: { items: true, cobros: true } });
    return reply.send({ factura });
  });

  app.post('/facturas/:id/anular', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const prev = await prisma().finanzaFactura.findFirst({ where: { id, tenantId, deletedAt: null }, select: { fechaEmision: true } });
    if (prev && await rechazarSiCerrado(tenantId, prev.fechaEmision, reply)) return;
    const r = await prisma().finanzaFactura.updateMany({ where: { id, tenantId, deletedAt: null }, data: { estado: 'ANULADA' } });
    if (!r.count) return reply.code(404).send({ error: 'Factura no encontrada' });
    return reply.send({ ok: true });
  });

  app.delete('/facturas/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const prev = await prisma().finanzaFactura.findFirst({ where: { id, tenantId, deletedAt: null }, select: { fechaEmision: true } });
    if (prev && await rechazarSiCerrado(tenantId, prev.fechaEmision, reply)) return;
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
    // Moneda: forzada a la del documento — nunca se suman monedas distintas.
    if (body.data.moneda && body.data.moneda !== factura.moneda)
      return reply.code(400).send({ error: `El cobro debe ser en ${factura.moneda} (la factura es en esa moneda)` });
    if (await rechazarSiCerrado(tenantId, body.data.fecha || new Date(), reply)) return;
    // Sobrecobro: el cobro no puede superar el saldo pendiente (no aplica a NC,
    // que no se cobran — el frontend ya las excluye pero el API no asumía nada).
    if (factura.tipoComprobante !== 'NOTA_CREDITO') {
      const cobrosPrev = await prisma().finanzaCobro.findMany({ where: { facturaId: id }, select: { importe: true } });
      const saldo = num(factura.total) - cobrosPrev.reduce((s: number, c: any) => s + num(c.importe), 0);
      if (body.data.importe > saldo + 0.5)
        return reply.code(400).send({ error: `El cobro supera el saldo pendiente (${factura.moneda} ${Math.max(0, saldo).toFixed(2)})` });
    }
    const user = await resolveUser(app.prisma, (req as any).auth?.userId);
    const cobro = await prisma().finanzaCobro.create({
      data: {
        ...body.data, tenantId, facturaId: id,
        fecha: body.data.fecha ? new Date(body.data.fecha) : new Date(),
        moneda: factura.moneda,
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
    const cobro = await prisma().finanzaCobro.findFirst({ where: { id, tenantId }, include: { factura: { include: { cobros: true } } } });
    if (!cobro) return reply.code(404).send({ error: 'Cobro no encontrado' });
    const data: any = { ...body.data };
    if (data.fecha) data.fecha = new Date(data.fecha);
    if (await rechazarSiCerrado(tenantId, data.fecha || cobro.fecha, reply)) return;
    if (data.importe !== undefined && cobro.factura?.tipoComprobante !== 'NOTA_CREDITO') {
      const saldo = num(cobro.factura?.total) - cobro.factura.cobros.filter((c: any) => c.id !== id).reduce((s: number, c: any) => s + num(c.importe), 0);
      if (data.importe > saldo + 0.5)
        return reply.code(400).send({ error: `El cobro supera el saldo pendiente (${cobro.factura?.moneda} ${Math.max(0, saldo).toFixed(2)})` });
    }
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
    if (await rechazarSiCerrado(tenantId, cobro.fecha, reply)) return;
    await prisma().finanzaCobro.delete({ where: { id } });
    await syncFacturaEstado(app.prisma, cobro.facturaId);
    return reply.send({ ok: true });
  });

  // ═══════════════════════════════════════════════════════════════
  // CARTOLA BANCARIA — conciliación de abonos → cobros.
  // commit=false: devuelve el match propuesto (preview).
  // commit=true: crea los FinanzaCobro de las filas matcheadas.
  // Dedup: cada abono se guarda con referencia "CARTOLA:fecha:monto:hash"
  // — re-subir la misma cartola no duplica cobros.
  // ═══════════════════════════════════════════════════════════════
  // Normaliza a "<dígitos><dv>" sin puntos, guion ni ceros a la izquierda
  const normRutKey = (s: string) => {
    const t = s.replace(/[.\s-]/g, '').toUpperCase();
    const m = t.match(/^0*(\d+)([0-9K])$/);
    return m ? m[1] + m[2] : t;
  };
  const rutEnTexto = (t: string): string[] => {
    const out = new Set<string>();
    // con guion: 12.345.678-9 / 12345678-9
    for (const m of t.matchAll(/(\d{1,3}(?:\.\d{3})+|\d{7,9})\s*-\s*([0-9kK])/g))
      out.add(normRutKey(m[1]) + m[2]);
    // sin guion (formato Santander): 084687500K → 84687500-K ; 0221151666 → 22115166-6
    for (const m of t.matchAll(/\b0?\d{7,8}[0-9kK]\b/g)) out.add(normRutKey(m[0]));
    return [...out];
  };
  const normTxt = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
    .replace(/\b(SPA|LTDA|LIMITADA|S\.A|SA|EIRL|SOCIEDAD|COMERCIAL|DE|Y|LOS|LAS|EL|LA|EN|SPA\.)\b/g, ' ')
    .replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const tokensDe = (s: string) => new Set(normTxt(s).split(' ').filter(t => t.length >= 3));
  // Firma idempotente del abono (≤100 chars para columna referencia)
  const firmaCobro = (f: { fecha: string; monto: number; descripcion: string; referencia?: string | null }) => {
    const s = `${f.descripcion}|${f.referencia || ''}`;
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return `CARTOLA:${f.fecha}:${Math.round(f.monto)}:${h.toString(36)}`;
  };

  const cartolaSchema = z.object({
    commit: z.boolean().default(false),
    moneda: z.string().max(5).optional().nullable(),
    filas: z.array(z.object({
      fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'fecha YYYY-MM-DD'),
      descripcion: z.string().max(400).default(''),
      monto: z.number().positive(),
      referencia: z.string().max(120).optional().nullable(),
    })).min(1).max(3000),
  });

  app.post('/cartola-conciliar', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const body = cartolaSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Validation failed', details: body.error.issues });
    const { commit, moneda, filas } = body.data;
    // Cierre de período: al commitear, los abonos de meses cerrados se omiten.
    let filasU = filas;
    if (commit) {
      const meses = [...new Set(filas.map(f => f.fecha.slice(0, 7)))];
      const cerrados = (await Promise.all(meses.map(m => periodoCerrado(tenantId, `${m}-15`)))).filter(Boolean) as string[];
      if (cerrados.length) {
        const setC = new Set(cerrados);
        filasU = filas.filter(f => !setC.has(f.fecha.slice(0, 7)));
        if (!filasU.length) return reply.code(423).send({ error: `Período(s) cerrado(s): ${cerrados.join(', ')}`, periodosCerrados: cerrados });
      }
    }
    const user = await resolveUser(app.prisma, (req as any).auth?.userId);

    // Cobros ya aplicados por cartola → dedup por firma
    const prev = await prisma().finanzaCobro.findMany({
      where: { tenantId, referencia: { startsWith: 'CARTOLA:' } }, select: { referencia: true },
    });
    const aplicadas = new Set(prev.map((c: any) => c.referencia));

    // Facturas con saldo pendiente, más vencidas primero (orden FIFO de imputación)
    const facts = await prisma().finanzaFactura.findMany({
      where: {
        tenantId, deletedAt: null, tipoComprobante: { not: 'NOTA_CREDITO' },
        estado: { notIn: ['ANULADA', 'COBRADA'] }, ...(moneda ? { moneda } : {}),
      },
      include: { cobros: true },
      orderBy: [{ fechaVencimiento: 'asc' }, { fechaEmision: 'asc' }],
    });
    const pend = facts.map((f: any) => ({
      id: f.id, numero: [f.puntoVenta, f.numero].filter(Boolean).join('-') || null,
      cliente: f.clienteNombre, rut: f.clienteRut ? normRutKey(f.clienteRut) : null,
      nombreNorm: normTxt(f.clienteNombre), moneda: f.moneda,
      fechaEmision: f.fechaEmision,
      saldo: Math.max(0, num(f.total) - f.cobros.reduce((s: number, c: any) => s + num(c.importe), 0)),
    })).filter((f: any) => f.saldo > 0.5);
    const resto = new Map(pend.map((f: any) => [f.id, f.saldo]));
    const getResto = (f: any) => resto.get(f.id) ?? f.saldo;

    // Subconjunto de candidatas cuyo resto suma EXACTAMENTE el abono (±$2).
    // Meet-in-the-middle O(2^(n/2)), n acotado a 24; prefiere menos facturas.
    const contarBits = (x: number) => { let c = 0; while (x) { c += x & 1; x >>>= 1; } return c; };
    const subconjuntoExacto = (cand: any[], target: number): any[] | null => {
      const items = cand.slice(0, 24).map(f => ({ f, v: getResto(f) }));
      const A = items.slice(0, 12), B = items.slice(12);
      const sumsA: { s: number; m: number }[] = [];
      for (let m = 1; m < (1 << A.length); m++) {
        let s = 0;
        for (let i = 0; i < A.length; i++) if (m & (1 << i)) s += A[i].v;
        sumsA.push({ s, m });
      }
      sumsA.sort((a, b) => a.s - b.s);
      let mejor: number | null = null;
      for (let m = 0; m < (1 << B.length); m++) {
        let s = 0;
        for (let i = 0; i < B.length; i++) if (m & (1 << i)) s += B[i].v;
        const need = target - s;
        let lo = 0, hi = sumsA.length;
        while (lo < hi) { const mid = (lo + hi) >> 1; if (sumsA[mid].s < need - 2) lo = mid + 1; else hi = mid; }
        for (let k = lo; k < sumsA.length && sumsA[k].s <= need + 2; k++) {
          const mask = sumsA[k].m | (m << A.length);
          if (mejor === null || contarBits(mask) < contarBits(mejor)) mejor = mask;
        }
      }
      if (mejor === null) return null;
      return items.filter((_, i) => ((mejor as number) & (1 << i)) !== 0).map(x => x.f);
    };

    const matchNombre = (desc: string, f: any) => {
      const tk = [...tokensDe(f.nombreNorm)];
      if (!tk.length) return false;
      const d = tokensDe(desc);
      const hits = tk.filter(t => d.has(t)).length;
      return hits === tk.length || (tk.length > 2 && hits / tk.length >= 0.7);
    };

    const resFilas: any[] = [];
    for (const [idx, fl] of filasU.entries()) {
      const firma = firmaCobro(fl);
      const base = { idx, fecha: fl.fecha, descripcion: fl.descripcion, monto: fl.monto, referencia: fl.referencia ?? null, firma };
      if (aplicadas.has(firma)) { resFilas.push({ ...base, estado: 'ya_aplicado', facturas: [] }); continue; }

      // Candidatas por RUT en la descripción o por nombre de cliente.
      // NUNCA se imputa a facturas emitidas DESPUÉS del abono: un pago no
      // puede cubrir algo que todavía no existía.
      const emitidaAntes = (f: any) => new Date(f.fechaEmision) <= new Date(`${fl.fecha}T23:59:59Z`);
      const ruts = new Set(rutEnTexto(`${fl.descripcion} ${fl.referencia || ''}`));
      let candTodas = ruts.size ? pend.filter((f: any) => f.rut && ruts.has(f.rut)) : [];
      let como = 'rut';
      if (!candTodas.length) { candTodas = pend.filter((f: any) => matchNombre(fl.descripcion, f)); como = 'nombre'; }
      let cand = candTodas.filter(emitidaAntes);

      // Se aplica SOLO cuando la deuda cuadra exacta: una factura igual al
      // abono, un subconjunto que suma el abono, o el abono cubre TODA la
      // deuda visible (el sobrante queda como excedente = anticipo o
      // facturas aún no cargadas). Sin repartos parciales arbitrarios.
      let aplica: { f: any; aplicar: number }[] = [];
      let excedente = 0;
      if (cand.length) {
        const exact = cand.find((f: any) => Math.abs(getResto(f) - fl.monto) <= 2);
        const suma = cand.reduce((s: number, f: any) => s + getResto(f), 0);
        if (exact) aplica = [{ f: exact, aplicar: getResto(exact) }];
        else if (Math.abs(suma - fl.monto) <= 2) aplica = cand.map((f: any) => ({ f, aplicar: getResto(f) }));
        else if (suma < fl.monto - 2) {
          aplica = cand.map((f: any) => ({ f, aplicar: getResto(f) }));
          excedente = fl.monto - suma;
        } else {
          const sub = subconjuntoExacto(cand, fl.monto);
          if (sub?.length) aplica = sub.map(f => ({ f, aplicar: getResto(f) }));
        }
      } else {
        const unicos = pend.filter((f: any) => emitidaAntes(f) && Math.abs(getResto(f) - fl.monto) <= 2);
        if (unicos.length === 1) { cand = unicos; candTodas = unicos; aplica = [{ f: unicos[0], aplicar: getResto(unicos[0]) }]; como = 'monto'; }
      }

      if (!aplica.length) {
        resFilas.push({
          ...base, estado: 'sin_match', facturas: [],
          motivo: !candTodas.length
            ? 'no encontré facturas pendientes de ese pagador'
            : !cand.length
              ? `${candTodas[0].cliente}: sus pendientes fueron emitidas después del abono`
              : `${cand[0].cliente}: ninguna combinación de sus ${cand.length} pendiente(s) suma el abono exacto`,
        });
        continue;
      }
      const confianza = como === 'monto' ? 'baja' : 'alta';
      for (const a of aplica) resto.set(a.f.id, Math.max(0, getResto(a.f) - a.aplicar));
      aplicadas.add(firma);
      resFilas.push({
        ...base, estado: 'match', como, confianza,
        ...(excedente > 0.5 ? { excedente } : {}),
        facturas: aplica.map(a => ({
          id: a.f.id, numero: a.f.numero, cliente: a.f.cliente, moneda: a.f.moneda,
          fechaEmision: a.f.fechaEmision, saldoPrevio: getResto(a.f) + a.aplicar, aplicar: a.aplicar,
        })),
      });
    }

    if (!commit) {
      const m = resFilas.filter(r => r.estado === 'match');
      return reply.send({
        filas: resFilas,
        resumen: {
          total: resFilas.length, matches: m.length, sinMatch: resFilas.filter(r => r.estado === 'sin_match').length,
          yaAplicados: resFilas.filter(r => r.estado === 'ya_aplicado').length,
          montoMatch: m.reduce((s, r) => s + r.facturas.reduce((x: number, f: any) => x + f.aplicar, 0), 0),
        },
      });
    }

    let creados = 0; const errores: string[] = [];
    const tocadas = new Set<string>();
    for (const r of resFilas.filter(x => x.estado === 'match')) {
      for (const a of r.facturas) {
        try {
          await prisma().finanzaCobro.create({
            data: {
              tenantId, facturaId: a.id, fecha: new Date(`${r.fecha}T12:00:00Z`),
              importe: a.aplicar, moneda: a.moneda || moneda || 'CLP',
              referencia: firmaCobro(r), medioPago: 'TRANSFERENCIA',
              notas: `Cartola: ${r.descripcion}`.slice(0, 500),
              createdById: user.id, createdByNombre: user.nombre,
            },
          });
          creados++; tocadas.add(a.id);
        } catch (e: any) {
          errores.push(`${r.fecha} $${r.monto}: ${e?.message?.slice(0, 120) || 'error'}`);
        }
      }
    }
    for (const fid of tocadas) await syncFacturaEstado(app.prisma, fid);
    return reply.send({ creados, facturasAfectadas: tocadas.size, errores, filas: resFilas });
  });

  // POST /cartola-deshacer {referencia} — revierte un abono ya conciliado:
  // borra sus cobros CARTOLA y las facturas vuelven a pendiente.
  app.post('/cartola-deshacer', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const referencia = String((req.body as any)?.referencia || '');
    if (!referencia.startsWith('CARTOLA:')) return reply.code(400).send({ error: 'referencia CARTOLA:* requerida' });
    const cobros = await prisma().finanzaCobro.findMany({
      where: { tenantId, referencia }, select: { id: true, facturaId: true },
    });
    if (!cobros.length) return reply.send({ eliminados: 0, facturas: 0 });
    const fids = [...new Set(cobros.map((c: any) => c.facturaId))] as string[];
    await prisma().finanzaCobro.deleteMany({ where: { tenantId, referencia } });
    for (const fid of fids) await syncFacturaEstado(app.prisma, fid);
    return reply.send({ eliminados: cobros.length, facturas: fids.length });
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
    const gasto = await prisma().finanzaGasto.findFirst({ where: { id, tenantId, deletedAt: null }, include: { pagos: true } });
    if (!gasto) return reply.code(404).send({ error: 'Gasto no encontrado' });
    const body = pagoSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Validation failed', details: body.error.issues });
    if (body.data.moneda && body.data.moneda !== gasto.moneda)
      return reply.code(400).send({ error: `El pago debe ser en ${gasto.moneda} (el gasto es en esa moneda)` });
    if (await rechazarSiCerrado(tenantId, body.data.fecha || new Date(), reply)) return;
    // Sobrepago: no puede superar el saldo. Las NC no reciben pagos (restan).
    if (gasto.tipoComprobante === 'NOTA_CREDITO')
      return reply.code(400).send({ error: 'Una nota de crédito no recibe pagos' });
    const saldo = num(gasto.total) - gasto.pagos.reduce((s: number, x: any) => s + num(x.importe), 0);
    if (body.data.importe > saldo + 0.5)
      return reply.code(400).send({ error: `El pago supera el saldo pendiente (${gasto.moneda} ${Math.max(0, saldo).toFixed(2)})` });
    const user = await resolveUser(app.prisma, (req as any).auth?.userId);
    const pago = await prisma().finanzaPago.create({
      data: {
        ...body.data, tenantId, gastoId: id,
        fecha: body.data.fecha ? new Date(body.data.fecha) : new Date(),
        moneda: gasto.moneda,
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
    const pago = await prisma().finanzaPago.findFirst({ where: { id, tenantId }, include: { gasto: { include: { pagos: true } } } });
    if (!pago) return reply.code(404).send({ error: 'Pago no encontrado' });
    const data: any = { ...body.data };
    if (data.fecha) data.fecha = new Date(data.fecha);
    if (await rechazarSiCerrado(tenantId, data.fecha || pago.fecha, reply)) return;
    if (data.importe !== undefined && pago.gasto?.tipoComprobante !== 'NOTA_CREDITO') {
      const saldo = num(pago.gasto?.total) - pago.gasto.pagos.filter((x: any) => x.id !== id).reduce((s: number, x: any) => s + num(x.importe), 0);
      if (data.importe > saldo + 0.5)
        return reply.code(400).send({ error: `El pago supera el saldo pendiente (${pago.gasto?.moneda} ${Math.max(0, saldo).toFixed(2)})` });
    }
    await prisma().finanzaPago.update({ where: { id }, data });
    return reply.send({ ok: true });
  });

  app.delete('/pagos/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const pago = await prisma().finanzaPago.findFirst({ where: { id, tenantId } });
    if (!pago) return reply.code(404).send({ error: 'Pago no encontrado' });
    if (await rechazarSiCerrado(tenantId, pago.fecha, reply)) return;
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

  const checkGasto = (d: any, ctx: z.RefinementCtx) => {
    // Coherencia de la ventana de amortización/recurrencia
    if (d.fechaDesde && d.fechaHasta && new Date(d.fechaHasta) < new Date(d.fechaDesde))
      ctx.addIssue({ code: 'custom', path: ['fechaHasta'], message: 'fechaHasta no puede ser anterior a fechaDesde' });
    // variacionCuota solo tiene efecto con esRecurrente (el consolidado la ignora si no)
    if (d.esRecurrente === false && d.variacionCuota !== undefined && d.variacionCuota !== null && d.variacionCuota !== 0)
      ctx.addIssue({ code: 'custom', path: ['variacionCuota'], message: 'La cuota variable solo aplica a gastos recurrentes' });
    checkNetoTotal(d, ctx);
  };
  const gastoSchemaBase = z.object({
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
  const gastoSchema = gastoSchemaBase.superRefine(checkGasto);

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
    const take = Math.min(Math.max(Number(q.take) || 1000, 1), 5000);
    const skip = Math.max(Number(q.skip) || 0, 0);
    const gastos = await prisma().finanzaGasto.findMany({ where, orderBy: { fecha: 'desc' }, take, skip });
    return reply.send({ gastos, truncado: gastos.length === take });
  });

  app.post('/gastos', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const body = gastoSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Validation failed', details: body.error.issues });
    const refError = await validarRefs(prisma(), tenantId, body.data);
    if (refError) return reply.code(400).send({ error: `${refError} no existe en esta empresa` });
    if (await rechazarSiCerrado(tenantId, body.data.fecha || new Date(), reply)) return;
    // Dedupe manual: mismo número + tipo + proveedor (como hace el import RCV).
    if (body.data.numeroComprobante) {
      const dup = await prisma().finanzaGasto.findFirst({
        where: { tenantId, deletedAt: null, numeroComprobante: body.data.numeroComprobante, tipoComprobante: body.data.tipoComprobante ?? null, ...(body.data.proveedorRut ? { proveedorRut: body.data.proveedorRut } : { proveedor: body.data.proveedor ?? null }) },
        select: { id: true },
      });
      if (dup) return reply.code(409).send({ error: `Ya existe un comprobante ${body.data.tipoComprobante || ''} N° ${body.data.numeroComprobante} para ese proveedor` });
    }
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
    const body = gastoSchemaBase.partial().superRefine(checkGasto).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Validation failed', details: body.error.issues });
    const refError = await validarRefs(prisma(), tenantId, body.data);
    if (refError) return reply.code(400).send({ error: `${refError} no existe en esta empresa` });
    const data: any = { ...body.data };
    if (data.fecha) data.fecha = new Date(data.fecha);
    if (data.fechaVencimiento !== undefined) data.fechaVencimiento = data.fechaVencimiento ? new Date(data.fechaVencimiento) : null;
    if (data.fechaDesde !== undefined) data.fechaDesde = data.fechaDesde ? new Date(data.fechaDesde) : null;
    if (data.fechaHasta !== undefined) data.fechaHasta = data.fechaHasta ? new Date(data.fechaHasta) : null;
    // Cierre de período: no se edita un gasto de un mes cerrado ni se mueve a uno.
    const prev = await prisma().finanzaGasto.findFirst({ where: { id, tenantId, deletedAt: null }, select: { fecha: true } });
    if (!prev) return reply.code(404).send({ error: 'Gasto no encontrado' });
    if (await rechazarSiCerrado(tenantId, prev.fecha, reply)) return;
    if (data.fecha && await rechazarSiCerrado(tenantId, data.fecha, reply)) return;
    const r = await prisma().finanzaGasto.updateMany({ where: { id, tenantId, deletedAt: null }, data });
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
  const configMoneda = async (tenantId: string) => {
    const t = await app.prisma.tenant.findUnique({ where: { id: tenantId }, select: { country: true, monedaResultados: true, resultadosConfig: true } });
    const conf = (t?.resultadosConfig as any) || {};
    const monedaLocal = (t?.country && MONEDA_PAIS[t.country]) || null;
    const ivaTasa = (conf.ivaTasa as Record<string, number> | undefined) || {};
    const presupuesto = (conf.presupuesto as Record<string, number> | undefined) || {};
    const saldoInicial = (conf.saldoInicial as Record<string, number> | undefined) || {};
    // Credenciales SII: solo expone RUT + flag configurado (la clave nunca sale)
    const siiCfg = conf.sii;
    const sii = siiCfg?.rut ? { rut: siiCfg.rut, rutEmpresa: siiCfg.rutEmpresa || null, configurado: !!siiCfg.claveEnc } : null;
    return {
      country: t?.country || null, monedaLocal, monedaDefault: t?.monedaResultados || monedaLocal,
      ivaTasa, presupuesto, saldoInicial, sii,
      alertas: (conf.alertas as any) || {},
      metas: (conf.metas as any) || {},
      tiposCambio: (conf.tiposCambio as any) || {},
      periodosCerrados: (conf.periodosCerrados as string[] | undefined) || [],
      informeEmail: (conf.informeEmail as any) || null,
      // Balance anual: patrimonio compuesto, PPM y provisión laboral.
      patrimonio: (conf.patrimonio as any) || {},
      ppmTasa: conf.ppmTasa != null ? Number(conf.ppmTasa) : null,
      provisionLaboral: conf.provisionLaboral != null ? Number(conf.provisionLaboral) : null,
    };
  };

  // Cierre de período: resultadosConfig.periodosCerrados = ['2026-09', …].
  // Un mes cerrado rechaza cargas/ediciones con fecha en ese mes (423).
  const periodoCerrado = async (tenantId: string, fecha: Date | string): Promise<string | null> => {
    const d = fecha instanceof Date ? fecha : new Date(fecha);
    if (isNaN(d.getTime())) return null;
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    const t = await app.prisma.tenant.findUnique({ where: { id: tenantId }, select: { resultadosConfig: true } }).catch(() => null);
    const cerrados = (((t?.resultadosConfig as any)?.periodosCerrados) as string[] | undefined) || [];
    return cerrados.includes(key) ? key : null;
  };
  const rechazarSiCerrado = async (tenantId: string, fecha: Date | string, reply: FastifyReply): Promise<boolean> => {
    const mk = await periodoCerrado(tenantId, fecha);
    if (mk) { reply.code(423).send({ error: `El período ${mk} está cerrado`, periodoCerrado: mk }); return true; }
    return false;
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
      // Credenciales SII (Chile): rut + clave (se guarda cifrada). eliminar=true borra todo.
      sii: z.object({
        rut: z.string().max(20).optional(),
        clave: z.string().max(100).optional(),
        rutEmpresa: z.string().max(20).optional().nullable(),
        eliminar: z.boolean().optional(),
      }).nullable().optional(),
      // Metas comerciales: avance en Dashboard (null = sin meta)
      metas: z.object({
        ventasMensual: z.number().min(0).nullable().optional(),
        resultadoMensual: z.number().nullable().optional(),
        ventasAnual: z.number().min(0).nullable().optional(),
        resultadoAnual: z.number().nullable().optional(),
      }).optional(),
      // Tipos de cambio manuales para el consolidado: { USD: { '2026-10': 950, '*': 940 } }
      // 'YYYY-MM' = tasa del mes; '*' = tasa por defecto. null borra la tasa.
      tiposCambio: z.record(z.string().regex(/^[A-Z]{3}$/), z.record(z.string().regex(/^(\d{4}-\d{2}|\*)$/), z.number().positive().nullable())).optional(),
      // Cierre de período: array de 'YYYY-MM' bloqueados para carga/edición.
      periodosCerrados: z.array(z.string().regex(/^\d{4}-\d{2}$/)).max(240).optional(),
      // Informe ejecutivo automático por email (día 1, mes anterior).
      informeEmail: z.object({
        activo: z.boolean().optional(),
        emails: z.array(z.string().email()).max(10).optional(),
      }).nullable().optional(),
      // Balance anual: patrimonio compuesto, tasa PPM y provisión laboral.
      patrimonio: z.object({
        capital: z.number().optional(),
        utilidadesRetenidas: z.number().optional(),
        retiros: z.number().optional(),
      }).optional(),
      ppmTasa: z.number().min(0).max(0.2).nullable().optional(),
      provisionLaboral: z.number().min(0).nullable().optional(),
    }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Validation failed', details: body.error.issues });
    const data: any = {};
    if (body.data.monedaDefault !== undefined) data.monedaResultados = body.data.monedaDefault;
    if (body.data.saldoInicial || body.data.claseCosto || body.data.alertas || body.data.ivaTasa || body.data.presupuesto || body.data.metas || body.data.tiposCambio || body.data.periodosCerrados || body.data.informeEmail !== undefined || body.data.patrimonio || body.data.ppmTasa !== undefined || body.data.provisionLaboral !== undefined) {
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
      if (body.data.metas) conf.metas = { ...(conf.metas || {}), ...body.data.metas };
      if (body.data.tiposCambio) {
        conf.tiposCambio = conf.tiposCambio || {};
        for (const [mon, tasas] of Object.entries(body.data.tiposCambio)) {
          conf.tiposCambio[mon] = { ...(conf.tiposCambio[mon] || {}), ...Object.fromEntries(Object.entries(tasas).filter(([, v]) => v !== null)) };
          for (const [k, v] of Object.entries(tasas)) if (v === null) delete conf.tiposCambio[mon][k];
          if (!Object.keys(conf.tiposCambio[mon]).length) delete conf.tiposCambio[mon];
        }
      }
      if (body.data.periodosCerrados) conf.periodosCerrados = body.data.periodosCerrados;
      if (body.data.informeEmail !== undefined) {
        if (body.data.informeEmail === null) delete conf.informeEmail;
        else conf.informeEmail = { ...(conf.informeEmail || {}), ...body.data.informeEmail };
      }
      if (body.data.patrimonio) conf.patrimonio = { ...(conf.patrimonio || {}), ...body.data.patrimonio };
      if (body.data.ppmTasa !== undefined) {
        if (body.data.ppmTasa === null) delete conf.ppmTasa; else conf.ppmTasa = body.data.ppmTasa;
      }
      if (body.data.provisionLaboral !== undefined) {
        if (body.data.provisionLaboral === null) delete conf.provisionLaboral; else conf.provisionLaboral = body.data.provisionLaboral;
      }
      data.resultadosConfig = conf;
    }
    if (body.data.sii !== undefined && body.data.sii !== null) {
      const t = await app.prisma.tenant.findUnique({ where: { id: tenantId }, select: { resultadosConfig: true } });
      const conf = (((data.resultadosConfig ?? t?.resultadosConfig) as any) || {}) as any;
      if (body.data.sii.eliminar) {
        delete conf.sii;
      } else if (body.data.sii.rut || body.data.sii.clave || body.data.sii.rutEmpresa !== undefined) {
        const prev = conf.sii || {};
        conf.sii = {
          rut: body.data.sii.rut !== undefined ? body.data.sii.rut : prev.rut,
          claveEnc: body.data.sii.clave ? encryptApiKey(body.data.sii.clave) : prev.claveEnc,
          rutEmpresa: body.data.sii.rutEmpresa !== undefined ? body.data.sii.rutEmpresa : prev.rutEmpresa,
        };
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
    // Fuentes periódicas (sueldos, cuotas, recurrentes, amortizables) emiten
    // UNA línea por cada mes calendario del rango — si el rango es anual esto
    // devuelve los 12 meses, no solo el primero.
    const monthStarts = (d: Date, h: Date) => {
      const arr: Date[] = [];
      let cur = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
      while (cur < h) { arr.push(cur); cur = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 1)); }
      return arr;
    };

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
      add({ fecha: f.fechaEmision, concepto: `${label} ${[f.puntoVenta, f.numero].filter(Boolean).join('-') || 's/n'} — ${f.clienteNombre}`, importe: sign * base, iva: sign * num(f.iva), ivaRecuperable: false, grupo: 'FACTURADO', fuente: 'FACTURA_EMITIDA', modulo: 'Resultados', origenId: f.id, origenUrl: '/resultados?tab=facturacion', centroCostoId: f.centroCostoId, moneda: f.moneda });
    }

    // Cobros de facturas emitidas (caja)
    const cobros = await p.finanzaCobro.findMany({
      where: { tenantId, fecha: { gte: desde, lt: hasta }, ...(moneda ? { moneda } : {}) },
      include: { factura: { select: { clienteNombre: true, numero: true, puntoVenta: true, centroCostoId: true, deletedAt: true } } },
    }).catch(() => []);
    for (const c of cobros) {
      if (c.factura?.deletedAt) continue;
      if (!ccOk(c.factura?.centroCostoId)) continue;
      add({ fecha: c.fecha, concepto: `Cobro fact. ${[c.factura?.puntoVenta, c.factura?.numero].filter(Boolean).join('-') || ''} — ${c.factura?.clienteNombre || ''}`, importe: num(c.importe), grupo: 'COBRADO', fuente: 'COBRO', modulo: 'Resultados', origenId: c.facturaId, origenUrl: '/resultados?tab=facturacion', centroCostoId: c.factura?.centroCostoId, moneda: c.moneda || c.factura?.moneda });
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
      add({ fecha: f.fecha, concepto: `${f.concepto || f.categoria}${f.proveedor ? ' — ' + f.proveedor : ''}${veh ? ` (${veh.dominio})` : ''}`, importe: sign * base, grupo: 'COSTO_OP', fuente: `FACTURA_${f.categoria || 'GASTO'}`, modulo: 'Flota 360', origenId: f.id, origenUrl: f.vehiculoId ? `/flota-360/vehiculos/${f.vehiculoId}` : '/flota-360', centroCostoId: cc, iva: sign * num(f.iva), ivaRecuperable: f.ivaRecuperable !== false, moneda: f.moneda });
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
      const t0 = new Date(v.primerCuotaAt).getTime();
      for (const ms of monthStarts(desde, hasta)) {
        const idx = Math.floor((ms.getTime() - t0) / (30.44 * 86400000)) + 1;
        if (idx >= 1 && idx <= v.cuotasTotales) {
          add({ fecha: ms, concepto: `Cuota financiación ${v.dominio} (${idx}/${v.cuotasTotales})`, importe: cuota, grupo: 'COSTO_OP', fuente: 'FINANCIACION', modulo: 'Flota 360', origenId: v.id, origenUrl: `/flota-360/vehiculos/${v.id}`, centroCostoId: v.centroCostoId });
        }
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
      where: { tenantId, deletedAt: null, status: 'ACTIVE' },
      select: { id: true, firstName: true, lastName: true, dni: true, costoMensual: true, centroCostoId: true },
    }).catch(() => []);
    const dnisEmpleados = new Set<string>(empleados.map((e: any) => (e.dni || '').trim()).filter(Boolean));
    // Sueldos importados desde la planilla de liquidaciones: si existe un
    // EmployeeSalary para (empleado, año, mes) ese monto gana sobre costoMensual.
    const sueldosImp = await p.employeeSalary.findMany({
      where: { tenantId, anio: { gte: desde.getFullYear(), lte: hasta.getFullYear() } },
      select: { employeeId: true, anio: true, mes: true, monto: true, tipoGasto: true },
    }).catch(() => []);
    const sueldoMes = new Map<string, { monto: number; tipoGasto: string }>();
    const conImport = new Set<string>();
    let maxImpYm = 0;
    for (const s of sueldosImp) {
      sueldoMes.set(`${s.employeeId}:${s.anio}-${s.mes}`, { monto: num(s.monto), tipoGasto: s.tipoGasto || 'ESTRUCTURA' });
      conImport.add(s.employeeId);
      if (s.anio * 100 + s.mes > maxImpYm) maxImpYm = s.anio * 100 + s.mes;
    }
    for (const e of empleados) {
      const costo = num(e.costoMensual);
      const tieneImport = conImport.has(e.id);
      const concepto = `Sueldo ${`${e.firstName || ''} ${e.lastName || ''}`.trim()}`;
      for (const ms of monthStarts(desde, hasta)) {
        const msYm = ms.getFullYear() * 100 + ms.getMonth() + 1;
        const imp = sueldoMes.get(`${e.id}:${ms.getFullYear()}-${ms.getMonth() + 1}`);
        // Si el empleado tiene planilla importada, un mes dentro del rango
        // importado sin fila propia = no cobró ese mes (alta/baja en el año).
        // costoMensual solo proyecta meses posteriores al último importado.
        const importe = imp ? imp.monto : (tieneImport && msYm <= maxImpYm ? 0 : costo);
        if (importe <= 0 || !ccOk(e.centroCostoId)) continue;
        const grupo = 'ESTRUCTURA';
        add({ fecha: ms, concepto, importe, grupo, fuente: 'PERSONAL', modulo: 'RRHH', origenId: e.id, origenUrl: '/rrhh', centroCostoId: e.centroCostoId });
      }
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
      const concepto = `Sueldo chofer ${c.nombre}${veh ? ` (${veh.dominio})` : ''}`;
      for (const ms of monthStarts(desde, hasta))
        add({ fecha: ms, concepto, importe: num(c.costoMensual), grupo: 'COSTO_OP', fuente: 'PERSONAL_FLOTA', modulo: 'Flota 360', origenId: c.id, origenUrl: '/flota-360/conductores', centroCostoId: cc });
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
      const conceptoBase = `${g.concepto}${g.proveedor ? ' — ' + g.proveedor : ''}${veh ? ` (${veh.dominio})` : ''}`;
      const url = veh ? `/flota-360/vehiculos/${veh.id}` : '/resultados?tab=gastos';
      const emisor = { grupo, fuente: `GASTO_${g.categoria}`, modulo: 'Resultados', origenId: g.id, origenUrl: url, centroCostoId: cc, ivaRecuperable: g.ivaRecuperable !== false, moneda: g.moneda };
      if (g.esAmortizable && g.fechaDesde && g.fechaHasta) {
        // Gasto anual prorrateado: el total se divide en partes iguales por
        // cada mes de la ventana; una línea por mes del rango que intersecte
        // [fechaDesde, fechaHasta]. El IVA se prorratea igual.
        const ini = new Date(g.fechaDesde), fin = new Date(g.fechaHasta);
        const meses = (fin.getUTCFullYear() - ini.getUTCFullYear()) * 12 + fin.getUTCMonth() - ini.getUTCMonth() + 1;
        if (meses > 0) {
          for (const ms of monthStarts(desde, hasta)) {
            const msEnd = new Date(Date.UTC(ms.getUTCFullYear(), ms.getUTCMonth() + 1, 1));
            if (msEnd <= ini || ms > fin) continue;
            const k = (ms.getUTCFullYear() - ini.getUTCFullYear()) * 12 + ms.getUTCMonth() - ini.getUTCMonth() + 1;
            add({ ...emisor, fecha: ini > ms ? ini : ms, concepto: `${conceptoBase} (amort. ${k}/${meses})`, importe: sign * (base / meses), iva: sign * (num(g.iva) / meses) });
          }
        }
      } else if (g.esRecurrente) {
        // Recurrente: una línea por cada mes del rango que intersecte la
        // ventana [fechaDesde ?? fecha, fechaHasta ?? ∞]. Con variacionCuota,
        // el importe del mes k = base + (k-1)·variación (cuota decreciente).
        const ini = g.fechaDesde ? new Date(g.fechaDesde) : new Date(g.fecha);
        const fin = g.fechaHasta ? new Date(g.fechaHasta) : null;
        const dv = num(g.variacionCuota);
        for (const ms of monthStarts(desde, hasta)) {
          const msEnd = new Date(Date.UTC(ms.getUTCFullYear(), ms.getUTCMonth() + 1, 1));
          if (msEnd <= ini || (fin && ms > fin)) continue;
          const k = (ms.getUTCFullYear() - ini.getUTCFullYear()) * 12 + ms.getUTCMonth() - ini.getUTCMonth() + 1;
          const importe = dv !== 0 ? sign * Math.max(0, base + (k - 1) * dv) : sign * base;
          const tag = dv !== 0 ? ` (cuota ${k})` : ' (recurrente)';
          add({ ...emisor, fecha: ini > ms ? ini : ms, concepto: `${conceptoBase}${tag}`, importe, iva: sign * num(g.iva) });
        }
      } else {
        add({ ...emisor, fecha: new Date(g.fecha), concepto: conceptoBase, importe: sign * base, iva: sign * num(g.iva) });
      }
    }

    return lineas;
  }

  // ── Consolidación multi-moneda (moneda=TODAS) ─────────────────
  // Convierte cada línea a la moneda base del tenant usando
  // resultadosConfig.tiposCambio: { USD: { '2026-10': 950, '*': 940 } }
  // ('*' = tasa por defecto sin mes específico). Líneas cuya moneda no
  // tiene tasa cargada quedan EXCLUIDAS del consolidado y se listan en
  // `faltantes` (moneda·mes) para que el usuario cargue el tipo de cambio.
  async function aplicarTiposCambio(tenantId: string, lineas: any[], monedaBase: string) {
    const t = await app.prisma.tenant.findUnique({ where: { id: tenantId }, select: { resultadosConfig: true } }).catch(() => null);
    const tc = (((t?.resultadosConfig as any)?.tiposCambio) || {}) as Record<string, Record<string, number>>;
    const faltantes = new Set<string>();
    let excluidas = 0;
    const out: any[] = [];
    for (const l of lineas) {
      const m = l.moneda || monedaBase;
      if (m === monedaBase) { out.push(l); continue; }
      const d = new Date(l.fecha);
      const mesKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      const tasa = num(tc[m]?.[mesKey]) || num(tc[m]?.['*']);
      if (tasa > 0) {
        out.push({
          ...l, importe: l.importe * tasa,
          ...(l.iva !== undefined ? { iva: num(l.iva) * tasa } : {}),
          ...(l.ivaBruto !== undefined ? { ivaBruto: num(l.ivaBruto) * tasa } : {}),
          monedaOriginal: m, tasaAplicada: tasa,
        });
      } else { faltantes.add(`${m}·${mesKey}`); excluidas++; }
    }
    return { lineas: out, faltantes: [...faltantes].sort(), excluidas };
  }

  // Recolecta TODAS las monedas y las consolida en la moneda base.
  async function recolectarConsolidado(tenantId: string, desde: Date, hasta: Date, centroCostoId: string | null) {
    const cfg = await configMoneda(tenantId);
    const base = cfg.monedaDefault || 'USD';
    const crudas = await recolectarLineas(tenantId, desde, hasta, null, centroCostoId);
    const r = await aplicarTiposCambio(tenantId, crudas, base);
    return { ...r, monedaBase: base };
  }

  // Exposición interna para routers hermanos (centro-empresa): la tarjeta
  // "Administración" del Centro de Control usa el MISMO pipeline que el
  // dashboard de Resultados — nunca un cálculo paralelo que pueda divergir.
  // Va por singleton de módulo: Fastify encapsula decorators por plugin,
  // un app.decorate() acá NO llega a otros routers.
  finanzaCore.recolectarLineas = recolectarLineas;
  finanzaCore.recolectarConsolidado = recolectarConsolidado;
  finanzaCore.configMoneda = configMoneda;
  finanzaCore.calcularAlertas = calcularAlertas;

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
    const monedaQ = q.moneda || null;
    const consolidar = monedaQ === 'TODAS';
    const moneda = consolidar ? null : monedaQ;
    const centroCostoId = q.centroCostoId || null;

    const mesActual = new Date().getUTCMonth() + 1;
    const anioActual = new Date().getUTCFullYear();
    const mesesACalcular = anio === anioActual ? mesActual : 12;

    // Una sola recolectada para todo el período; las líneas periódicas
    // (sueldos, cuotas, recurrentes, amortizables) vienen fechadas en su mes.
    const desdeAnio = new Date(Date.UTC(anio, 0, 1));
    const hastaAnio = new Date(Date.UTC(anio, mesesACalcular, 1));
    const consol = consolidar ? await recolectarConsolidado(tenantId, desdeAnio, hastaAnio, centroCostoId) : null;
    const lineasAnio = consol ? consol.lineas : await recolectarLineas(tenantId, desdeAnio, hastaAnio, moneda, centroCostoId);

    const meses: any[] = [];
    for (let m = 1; m <= mesesACalcular; m++) {
      const lineas = lineasAnio.filter(l => {
        const f = new Date(l.fecha);
        return f.getUTCFullYear() === anio && f.getUTCMonth() + 1 === m;
      });

      const suma = (grupo: string) => lineas.filter(l => l.grupo === grupo).reduce((s, l) => s + l.importe, 0);
      const facturado = suma('FACTURADO');
      const ingresosOperativos = suma('INGRESO_OPERATIVO');
      const cobrado = suma('COBRADO');
      const costosOperativos = suma('COSTO_OP') + suma('GASTO_MANUAL');
      const estructura = suma('ESTRUCTURA');
      // IVA desagregado por mes: para el toggle "con IVA" del dashboard.
      // Ventas = débito de facturas emitidas (signado). Costos = IVA solo
      // cuando el costo registrado es neto (ivaRecuperable); si el IVA ya
      // venía dentro del importe (ivaRecuperable=false) no se suma de nuevo.
      const ivaVentas = lineas.filter(l => l.grupo === 'FACTURADO').reduce((s, l) => s + num(l.iva || 0), 0);
      const ivaCostos = lineas.filter(l => ['COSTO_OP', 'ESTRUCTURA', 'GASTO_MANUAL'].includes(l.grupo) && l.ivaRecuperable !== false).reduce((s, l) => s + num(l.iva || 0), 0);
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
        costosOperativos, estructura, costosTotales: costosOperativos + estructura, ivaVentas, ivaCostos,
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
    return reply.send({ anio, moneda: monedaQ, monedaBase: consol?.monedaBase ?? null, faltantesTC: consol?.faltantes ?? [], excluidasSinTC: consol?.excluidas ?? 0, centroCostoId, meses, totales, actualizadoEn });
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
        diasPago: [] as number[], fechasCobro: [] as number[], pendientes: [] as any[], cobradas: [] as any[], ultimoCobro: null as Date | null,
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
        const cancelo = f.cobros[f.cobros.length - 1];
        const last = new Date(cancelo.fecha).getTime();
        c.diasPago.push(Math.max(0, Math.round((last - new Date(f.fechaEmision).getTime()) / DIA)));
        // Consolidado de cobradas (para que el cliente no "desaparezca" al saldar)
        c.cobradas.push({
          id: f.id, numero: [f.puntoVenta, f.numero].filter(Boolean).join('-') || null,
          fechaEmision: f.fechaEmision, fechaCobro: cancelo.fecha, total, moneda: f.moneda,
          fileUrl: f.fileUrl, origen: (cancelo.referencia || '').startsWith('CARTOLA:') ? 'cartola' : 'manual',
        });
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
      c.cobradas.sort((a: any, b: any) => new Date(b.fechaEmision).getTime() - new Date(a.fechaEmision).getTime());
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
      // Cobros/pagos de docs eliminados (soft-delete) quedaban en el histórico
      // porque FinanzaCobro/FinanzaPago no tienen deletedAt propio.
      p.finanzaCobro.findMany({ where: { tenantId, fecha: { gte: desde, lte: horizonte }, ...(moneda ? { moneda } : {}), factura: { deletedAt: null } }, select: { fecha: true, importe: true } }).catch(() => []),
      p.flotaIngreso.findMany({ where: { tenantId, cobradoAt: { gte: desde, lte: horizonte } }, select: { cobradoAt: true, monto: true } }).catch(() => []),
      p.flotaIngreso.findMany({ where: { tenantId, cobradoAt: null, fechaCobroEstimada: { gte: hoy, lte: horizonte } }, select: { fechaCobroEstimada: true, monto: true, concepto: true, cliente: true } }).catch(() => []),
      p.finanzaFactura.findMany({ where: { tenantId, deletedAt: null, estado: { in: ['EMITIDA', 'PARCIALMENTE_COBRADA'] }, ...(moneda ? { moneda } : {}) }, include: { cobros: true } }).catch(() => []),
      p.finanzaPago.findMany({ where: { tenantId, fecha: { gte: desde, lte: horizonte }, ...(moneda ? { moneda } : {}), gasto: { deletedAt: null } }, select: { fecha: true, importe: true } }).catch(() => []),
      // "Legacy" = solo puntuales sin pagos trackeados. Los recurrentes/
      // amortizables se agregan abajo como eventos mensuales sintéticos.
      p.finanzaGasto.findMany({ where: { tenantId, deletedAt: null, esRecurrente: false, esAmortizable: false, fecha: { gte: desde, lte: hoy }, ...(moneda ? { moneda } : {}), pagos: { none: {} } }, select: { fecha: true, total: true, tipoComprobante: true } }).catch(() => []),
      p.flotaFactura.findMany({ where: { tenantId, tipoComprobante: { notIn: ['PRESUPUESTO', 'NOTA_CREDITO'] }, ...(moneda ? { moneda } : {}), OR: [{ pagadaAt: { not: null } }, { fechaVencimiento: null, fecha: { gte: desde, lte: hoy } }] }, select: { fecha: true, pagadaAt: true, total: true } }).catch(() => []),
      p.finanzaGasto.findMany({ where: { tenantId, deletedAt: null, ...(moneda ? { moneda } : {}), OR: [
        { esRecurrente: true, OR: [{ fechaHasta: null }, { fechaHasta: { gte: hoy } }] },
        { esAmortizable: true, fechaDesde: { not: null, lte: horizonte }, fechaHasta: { not: null, gte: hoy } },
      ] }, select: { total: true, neto: true, ivaRecuperable: true, esAmortizable: true, fechaDesde: true, fechaHasta: true, fecha: true, variacionCuota: true, pagos: { select: { id: true }, take: 1 } } }).catch(() => []),
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
    // Recurrentes y amortizables sin pagos trackeados entran al histórico como
    // egreso mensual sintético (fecha = inicio de mes) — antes solo figuraban
    // en `recurrentesMensual` y el pasado quedaba inflado.
    for (const r of recurrentes) {
      if (r.pagos?.length) continue; // ya entran vía FinanzaPago
      const base = r.ivaRecuperable !== false && r.neto !== null ? num(r.neto) : num(r.total);
      const ini = r.fechaDesde ? new Date(r.fechaDesde) : new Date(r.fecha || desde);
      const fin = r.fechaHasta ? new Date(r.fechaHasta) : null;
      let importe = base;
      if (r.esAmortizable && r.fechaDesde && r.fechaHasta) {
        const meses = (fin!.getUTCFullYear() - ini.getUTCFullYear()) * 12 + fin!.getUTCMonth() - ini.getUTCMonth() + 1;
        if (meses <= 0) continue;
        importe = base / meses;
      }
      const dv = num(r.variacionCuota);
      for (let ms = new Date(Date.UTC(Math.max(ini.getUTCFullYear(), anio), Math.max(ini.getUTCFullYear(), anio) === ini.getUTCFullYear() ? ini.getUTCMonth() : 0, 1)); ms <= horizonte; ms = new Date(Date.UTC(ms.getUTCFullYear(), ms.getUTCMonth() + 1, 1))) {
        if (fin && ms > fin) break;
        const k = (ms.getUTCFullYear() - ini.getUTCFullYear()) * 12 + ms.getUTCMonth() - ini.getUTCMonth() + 1;
        salidas.push({ fecha: ms, importe: dv !== 0 && !r.esAmortizable ? Math.max(0, importe + (k - 1) * dv) : importe });
      }
    }

    // Hábito de pago por cliente: lag promedio emisión → cobro final, medido
    // sobre facturas ya canceladas. Alimenta la fecha estimada de los cobros
    // esperados (fallback: vencimiento del documento).
    const facturasHist = await p.finanzaFactura.findMany({
      where: { tenantId, deletedAt: null, tipoComprobante: { not: 'NOTA_CREDITO' }, ...(moneda ? { moneda } : {}), cobros: { some: {} } },
      select: { clienteNombre: true, fechaEmision: true, total: true, cobros: { select: { fecha: true, importe: true } } },
    }).catch(() => [] as any[]);
    const lagAcc = new Map<string, { s: number; n: number }>();
    for (const f of facturasHist) {
      const cobrado = f.cobros.reduce((s: number, c: any) => s + num(c.importe), 0);
      if (cobrado < num(f.total) - 0.5) continue;
      const last = f.cobros.reduce((m: any, c: any) => (!m || c.fecha > m ? c.fecha : m), null as Date | null);
      if (!last) continue;
      const d = Math.max(0, Math.round((new Date(last).getTime() - new Date(f.fechaEmision).getTime()) / 86400000));
      const k = (f.clienteNombre || '').toLowerCase().trim();
      const a = lagAcc.get(k) || { s: 0, n: 0 }; a.s += d; a.n += 1; lagAcc.set(k, a);
    }
    const lagCliente = new Map([...lagAcc.entries()].map(([k, a]) => [k, Math.round(a.s / a.n)] as [string, number]));

    const conf = (tenant?.resultadosConfig as any) || {};
    const saldoInicial = num(conf?.saldoInicial?.[moneda || ''] ?? conf?.saldoInicial?.['*'] ?? 0);

    // Ventana [desde, hoy]: saldoInicial representa el saldo al 1/1 del año,
    // así que movimientos anteriores no se vuelven a sumar.
    const movs = [...entradas.map(e => ({ fecha: e.fecha, delta: e.importe })), ...salidas.map(s => ({ fecha: s.fecha, delta: -s.importe }))]
      .filter(m => m.fecha >= desde && m.fecha <= hoy).sort((a, b) => a.fecha.getTime() - b.fecha.getTime());

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
      ...facturasPend.filter((f: any) => f.tipoComprobante !== 'NOTA_CREDITO').map((f: any) => {
        const cobrado = f.cobros.reduce((s: number, c: any) => s + num(c.importe), 0);
        const saldo = Math.max(0, num(f.total) - cobrado);
        const lag = lagCliente.get((f.clienteNombre || '').toLowerCase().trim());
        let fecha = lag != null ? new Date(new Date(f.fechaEmision).getTime() + lag * 86400000) : new Date(f.fechaVencimiento || f.fechaEmision);
        if (fecha < hoy) fecha = hoy; // la estimación ya pasó y sigue sin cobrarse
        return { fecha, importe: saldo, concepto: `Cobro ${[f.puntoVenta, f.numero].filter(Boolean).join('-')} — ${f.clienteNombre}`, tipo: 'FACTURA', via: lag != null ? 'HISTORIAL' : 'VENCIMIENTO' };
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
      cobrosPeriodo: movs.filter(m => m.delta > 0).reduce((s, m) => s + m.delta, 0),
      pagosPeriodo: movs.filter(m => m.delta < 0).reduce((s, m) => s - m.delta, 0),
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

    // Por servicio: ventas con servicioId (NC resta). Los costos NO se
    // imputan por servicio — fin(..., false) devuelve costos/resultado/margen
    // en null en vez de un margen 100% falso.
    const porServicio = new Map<string, any>();
    for (const f of facturas) if (f.servicioId) {
      const sign = f.tipoComprobante === 'NOTA_CREDITO' ? -1 : 1;
      acum(porServicio, f.servicioId, servicioNombre.get(f.servicioId) || 'Servicio').ventas += sign * (num(f.neto) > 0 ? num(f.neto) : num(f.total));
    }
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
      porServicio: fin(porServicio, false),
      notaCostos: 'Costos por cliente: proporcional a participación en ventas. Por centro de costo: atribución directa. Por servicio: solo ventas (los costos no se imputan por servicio).',
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
      p.finanzaGasto.findMany({ where: { tenantId, deletedAt: null, claseCosto: { not: null } }, select: { id: true, claseCosto: true } }).catch(() => []),
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
    // Meses con al menos una línea económica — si el año arrancó en junio no
    // se divide por 12 a los promedios mensuales.
    const mesesConDatos = Math.max(1, Math.min(ultimoMes, new Set(lineas.map(l => { const f = new Date(l.fecha); return f.getUTCFullYear() * 12 + f.getUTCMonth(); })).size));
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

    // ── Mes siguiente: compromisos conocidos (líneas periódicas ya
    // comprometidas + CxP con vencimiento en ese mes) + baseline del
    // promedio mensual de los últimos 3 meses con datos.
    const hastaSig = new Date(Date.UTC(anio, mes + 1, 1));
    const lineasSig = await recolectarLineas(tenantId, hasta, hastaSig, moneda, q.centroCostoId || null).catch(() => [] as any[]);
    const ventasCompSig = lineasSig.filter(esIng).reduce((s, l) => s + l.importe, 0);
    const costosCompSig = lineasSig.filter(esCosto).reduce((s, l) => s + l.importe, 0)
      + pendCxP
        .filter((i: any) => i.saldo > 0.5 && new Date(i.fechaVencimiento || i.fechaEmision) >= hasta && new Date(i.fechaVencimiento || i.fechaEmision) < hastaSig)
        .reduce((s: number, i: any) => s + i.saldo, 0);
    const ventasBaseMes = ventasPrev / mesesPrevConDatos;
    const costosBaseMes = costosPrev / mesesPrevConDatos;
    const estVentasSig = Math.max(0, ventasBaseMes - ventasCompSig);
    const estCostosSig = Math.max(0, costosBaseMes - costosCompSig);
    const ventasProjSig = ventasCompSig + estVentasSig;
    const costosProjSig = costosCompSig + estCostosSig;
    const resultadoProjSig = ventasProjSig - costosProjSig;
    const baseSig = ventasProjSig + costosProjSig;
    const confianzaSig = baseSig > 0 ? Math.round(((ventasCompSig + costosCompSig) / baseSig) * 100) : 0;

    return reply.send({
      anio, mes, moneda, esMesActual: esActual, diasTranscurridos, diasRestantes,
      ventas: { real: ventasReal, compromisos: 0, estimacion: estVentas, proyectado: ventasProj },
      costos: { real: costosReal, compromisos: compromisosPago, estimacion: estCostos, proyectado: costosProj },
      resultadoProyectado: resultadoProj,
      margenProyectado: ventasProj > 0 ? Math.round((resultadoProj / ventasProj) * 1000) / 10 : null,
      confianza, confianzaLabel: confianza >= 70 ? 'ALTA' : confianza >= 40 ? 'MEDIA' : 'BAJA',
      metodo: 'Real registrado + compromisos (CxP con vencimiento en el mes) + ritmo diario de los últimos 3 meses con datos.',
      siguiente: {
        anio: hasta.getUTCFullYear(), mes: hasta.getUTCMonth() + 1,
        ventas: { compromisos: ventasCompSig, estimacion: estVentasSig, proyectado: ventasProjSig },
        costos: { compromisos: costosCompSig, estimacion: estCostosSig, proyectado: costosProjSig },
        resultadoProyectado: resultadoProjSig,
        margenProyectado: ventasProjSig > 0 ? Math.round((resultadoProjSig / ventasProjSig) * 1000) / 10 : null,
        confianza: confianzaSig,
        confianzaLabel: confianzaSig >= 70 ? 'ALTA' : confianzaSig >= 40 ? 'MEDIA' : 'BAJA',
        metodo: 'Compromisos del mes (sueldos, recurrentes, cuotas, CxP a vencer) + promedio mensual de los últimos 3 meses con datos.',
      },
      actualizadoEn: await ultimaAct(tenantId, moneda),
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // TENDENCIA — serie mensual de los últimos 12 meses + proyección de
  // los próximos N meses por regresión lineal simple (mínimos cuadrados).
  // Solo proyecta si hay al menos 4 meses con datos; confianza = R².
  // ═══════════════════════════════════════════════════════════════
  app.get('/tendencia', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const q = req.query as any;
    const monedaQ = q.moneda || null;
    const consolidar = monedaQ === 'TODAS';
    const moneda = consolidar ? null : monedaQ;
    const horizonte = Math.min(6, Math.max(1, Number(q.horizonte) || 3));
    const hoy = new Date();
    const baseMes = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1));
    const desde12 = new Date(Date.UTC(baseMes.getUTCFullYear(), baseMes.getUTCMonth() - 11, 1));

    let lineas: any[];
    if (consolidar) lineas = (await recolectarConsolidado(tenantId, desde12, new Date(Date.UTC(baseMes.getUTCFullYear(), baseMes.getUTCMonth() + 1, 1)), q.centroCostoId || null)).lineas;
    else lineas = await recolectarLineas(tenantId, desde12, new Date(Date.UTC(baseMes.getUTCFullYear(), baseMes.getUTCMonth() + 1, 1)), moneda, q.centroCostoId || null);

    const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const esIng = (l: any) => ['FACTURADO', 'INGRESO_OPERATIVO'].includes(l.grupo);
    const esCosto = (l: any) => ['COSTO_OP', 'ESTRUCTURA', 'GASTO_MANUAL'].includes(l.grupo);
    const serie: { anio: number; mes: number; mesKey: string; label: string; ventas: number; costos: number; resultado: number; enCurso: boolean }[] = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(Date.UTC(baseMes.getUTCFullYear(), baseMes.getUTCMonth() - 11 + i, 1));
      const h = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
      const corte = d <= hoy && hoy < h ? hoy : h;
      const ls = lineas.filter(l => { const f = new Date(l.fecha); return f >= d && f < corte; });
      const ventas = ls.filter(esIng).reduce((s, l) => s + l.importe, 0);
      const costos = ls.filter(esCosto).reduce((s, l) => s + l.importe, 0);
      serie.push({
        anio: d.getUTCFullYear(), mes: d.getUTCMonth() + 1,
        mesKey: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`,
        label: `${MESES[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`,
        ventas: Math.round(ventas), costos: Math.round(costos), resultado: Math.round(ventas - costos),
        enCurso: d <= hoy && hoy < h,
      });
    }

    // Regresión lineal sobre meses CERRADOS con actividad (el mes en curso
    // queda fuera para no arrastrar la pendiente con un mes incompleto).
    const datos = serie.filter(s => !s.enCurso && (s.ventas !== 0 || s.costos !== 0));
    const regresion = (vals: number[]) => {
      const n = vals.length;
      if (n < 4) return null;
      const xs = vals.map((_, i) => i);
      const sx = xs.reduce((a, b) => a + b, 0), sy = vals.reduce((a, b) => a + b, 0);
      const sxy = xs.reduce((a, x, i) => a + x * vals[i], 0);
      const sxx = xs.reduce((a, x) => a + x * x, 0);
      const pend = (n * sxy - sx * sy) / (n * sxx - sx * sx);
      const inter = (sy - pend * sx) / n;
      // R²
      const ym = sy / n;
      const ssTot = vals.reduce((a, y) => a + (y - ym) ** 2, 0);
      const ssRes = vals.reduce((a, y, i) => a + (y - (pend * i + inter)) ** 2, 0);
      const r2 = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;
      return { pend, inter, r2 };
    };
    const n = datos.length;
    const rVentas = regresion(datos.map(d => d.ventas));
    const rCostos = regresion(datos.map(d => d.costos));

    const proyectado: any[] = [];
    for (let i = 1; i <= horizonte; i++) {
      const d = new Date(Date.UTC(baseMes.getUTCFullYear(), baseMes.getUTCMonth() + i, 1));
      const x = n - 1 + i;
      const ventas = rVentas ? Math.max(0, rVentas.pend * x + rVentas.inter) : 0;
      const costos = rCostos ? Math.max(0, rCostos.pend * x + rCostos.inter) : 0;
      proyectado.push({
        anio: d.getUTCFullYear(), mes: d.getUTCMonth() + 1,
        mesKey: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`,
        label: `${MESES[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`,
        ventas: Math.round(ventas), costos: Math.round(costos), resultado: Math.round(ventas - costos),
      });
    }
    const r2min = Math.min(rVentas?.r2 ?? 0, rCostos?.r2 ?? 0);
    return reply.send({
      moneda: monedaQ || 'todas', horizonte, mesesConDatos: n,
      serie, proyectado,
      tendencia: {
        ventasMensual: rVentas ? Math.round(rVentas.pend) : null,
        costosMensual: rCostos ? Math.round(rCostos.pend) : null,
        r2: Math.round(r2min * 100) / 100,
        confianza: n < 4 ? 'INSUFICIENTE' : r2min >= 0.6 ? 'ALTA' : r2min >= 0.3 ? 'MEDIA' : 'BAJA',
      },
      metodo: 'Regresión lineal (mínimos cuadrados) sobre los últimos 12 meses cerrados con datos. El mes en curso no afecta la pendiente.',
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // BALANCE — estado de situación patrimonial estimado a fin de mes.
  // Mix gerencial/contable: activo (caja + CxC + remanente IVA + PPM +
  // flota depreciada), pasivo corriente (CxP + IVA + provisión laboral +
  // deuda financiera <12m) y no corriente (cuotas de leasing/préstamo
  // de flota >12m), patrimonio compuesto (capital + utilidades +
  // resultado del ejercicio − retiros) cruzado contra el implícito
  // (activo − pasivo) como control de calidad del dato.
  // No es contable formal: sigue siendo una brújula con supuestos
  // explícitos, pensada para el ejercicio anual al 31/12.
  // ═══════════════════════════════════════════════════════════════
  app.get('/balance', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const q = req.query as any;
    const hoy = new Date();
    const anio = Math.min(2100, Math.max(2000, Number(q.anio) || hoy.getUTCFullYear()));
    const mes = Math.min(12, Math.max(1, Number(q.mes) || hoy.getUTCMonth() + 1));
    const moneda = q.moneda || null;
    const p = prisma();
    const corte = new Date(Date.UTC(anio, mes, 1)); // fin del mes pedido
    const inicioAnio = new Date(Date.UTC(anio, 0, 1));

    const [cxcFacts, cxp, cobrosHist, pagosHist, ingresosCobrados, gastosSinPago, flotaFactsPagadas, vehiculos, tenant, facturasMes] = await Promise.all([
      // CxC: emitidas hasta el corte con saldo al corte
      p.finanzaFactura.findMany({
        where: { tenantId, deletedAt: null, fechaEmision: { lt: corte }, ...(moneda ? { moneda } : {}) },
        select: { total: true, tipoComprobante: true, cobros: { select: { importe: true, fecha: true } } },
      }).catch(() => [] as any[]),
      obtenerCxPInterno(p, tenantId, moneda).catch(() => [] as any[]),
      p.finanzaCobro.findMany({ where: { tenantId, deletedAt: null, fecha: { gte: inicioAnio, lt: corte }, ...(moneda ? { moneda } : {}) }, select: { importe: true } }).catch(() => [] as any[]),
      p.finanzaPago.findMany({ where: { tenantId, deletedAt: null, fecha: { gte: inicioAnio, lt: corte }, ...(moneda ? { moneda } : {}) }, select: { importe: true } }).catch(() => [] as any[]),
      p.flotaIngreso.findMany({ where: { tenantId, ...(moneda ? { moneda } : {}), cobradoAt: { gte: inicioAnio, lt: corte } }, select: { monto: true } }).catch(() => [] as any[]),
      p.finanzaGasto.findMany({ where: { tenantId, deletedAt: null, esRecurrente: false, esAmortizable: false, fecha: { gte: inicioAnio, lt: corte }, ...(moneda ? { moneda } : {}), pagos: { none: {} } }, select: { total: true, tipoComprobante: true } }).catch(() => [] as any[]),
      p.flotaFactura.findMany({ where: { tenantId, tipoComprobante: { notIn: ['PRESUPUESTO', 'NOTA_CREDITO'] }, ...(moneda ? { moneda } : {}), pagadaAt: { gte: inicioAnio, lt: corte } }, select: { total: true } }).catch(() => [] as any[]),
      p.vehiculo.findMany({ where: { tenantId, deletedAt: null }, select: { precioCompra: true, dominio: true, tipo: true, anio: true, cuotaMensual: true, cuotasTotales: true, primerCuotaAt: true, anticipoCompra: true } }).catch(() => []),
      p.tenant.findUnique({ where: { id: tenantId }, select: { resultadosConfig: true } }).catch(() => null),
      p.finanzaFactura.findMany({ where: { tenantId, deletedAt: null, fechaEmision: { gte: inicioAnio, lt: corte } }, select: { iva: true, tipoComprobante: true, fechaEmision: true } }).catch(() => []),
    ]);

    // ── CxC al corte: total emitido − cobrado hasta el corte.
    let cxc = 0; let cxcVencido = 0;
    for (const f of cxcFacts) {
      const signoF = f.tipoComprobante === 'NOTA_CREDITO' ? -1 : 1;
      const cobrado = (f.cobros || []).filter((c: any) => new Date(c.fecha) < corte).reduce((s: number, c: any) => s + num(c.importe), 0);
      const saldo = signoF * num(f.total) - cobrado;
      if (saldo > 0.5) cxc += saldo;
    }

    // ── CxP al corte (saldo vivo hoy aproxima el pasivo corriente).
    const cxpSaldo = cxp.reduce((s: number, i: any) => s + num(i.saldo), 0);
    const cxpVencido = cxp.filter((i: any) => num(i.saldo) > 0.5 && num(i.diasVencimiento) > 0).reduce((s: number, i: any) => s + num(i.saldo), 0);

    // ── Caja estimada: saldoInicial (al 1/1) + cobros − pagos del año.
    const conf = (tenant?.resultadosConfig as any) || {};
    const saldoInicial = num(conf?.saldoInicial?.[moneda || ''] ?? conf?.saldoInicial?.['*'] ?? 0);
    const cobradoAnio = cobrosHist.reduce((s: number, c: any) => s + num(c.importe), 0)
      + ingresosCobrados.reduce((s: number, i: any) => s + num(i.monto), 0);
    const pagadoAnio = pagosHist.reduce((s: number, x: any) => s + num(x.importe), 0)
      + gastosSinPago.reduce((s: number, g: any) => s + num(g.total) * (g.tipoComprobante === 'NOTA_CREDITO' ? -1 : 1), 0)
      + flotaFactsPagadas.reduce((s: number, f: any) => s + num(f.total), 0);
    const caja = saldoInicial + cobradoAnio - pagadoAnio;

    // ── Flota: valor de compra menos depreciación lineal simple a 10 años.
    let flotaValor = 0;
    const flotaDetalle: any[] = [];
    for (const v of vehiculos) {
      const compra = num(v.precioCompra);
      if (compra <= 0) continue;
      const aniosUso = v.anio ? Math.max(0, Math.min(10, anio - Number(v.anio) + (mes / 12))) : 0;
      const valor = Math.round(compra * Math.max(0.1, 1 - aniosUso / 10));
      flotaValor += valor;
      flotaDetalle.push({ dominio: v.dominio, tipo: v.tipo, anio: v.anio, precioCompra: Math.round(compra), valorEstimado: valor });
    }

    // ── IVA: remanente de crédito fiscal acumulado mes a mes (regla
    // chilena: el crédito que excede el débito arrastra al mes siguiente).
    // Una sola recolectada anual; las líneas traen su mes en `fecha`.
    const lineasAnio = await recolectarLineas(tenantId, inicioAnio, corte, moneda, null).catch(() => [] as any[]);
    const debitoPorMes = new Map<number, number>(), creditoPorMes = new Map<number, number>();
    for (const f of facturasMes) {
      const m = new Date(f.fechaEmision).getUTCMonth() + 1;
      debitoPorMes.set(m, (debitoPorMes.get(m) || 0) + (f.tipoComprobante === 'NOTA_CREDITO' ? -1 : 1) * num(f.iva));
    }
    let ventasNetasYtd = 0, resultadoEjercicio = 0;
    for (const l of lineasAnio) {
      const m = new Date(l.fecha).getUTCMonth() + 1;
      if (num(l.iva) !== 0 && l.ivaRecuperable !== false) creditoPorMes.set(m, (creditoPorMes.get(m) || 0) + num(l.iva));
      if (['FACTURADO', 'INGRESO_OPERATIVO'].includes(l.grupo)) ventasNetasYtd += num(l.importe);
      else if (['COSTO_OP', 'ESTRUCTURA', 'GASTO_MANUAL'].includes(l.grupo)) ventasNetasYtd -= 0;
      resultadoEjercicio += ['FACTURADO', 'INGRESO_OPERATIVO'].includes(l.grupo) ? num(l.importe) : ['COSTO_OP', 'ESTRUCTURA', 'GASTO_MANUAL'].includes(l.grupo) ? -num(l.importe) : 0;
    }
    let remanente = 0, ivaPagar = 0;
    for (let m = 1; m <= mes; m++) {
      const neto = (debitoPorMes.get(m) || 0) - (creditoPorMes.get(m) || 0) - remanente;
      if (neto > 0) { ivaPagar = neto; remanente = 0; }
      else { remanente += -neto; ivaPagar = 0; }
    }
    // El remanente es un ACTIVO (crédito fiscal a recuperar en F29 futuros);
    // el débito neto del último mes es el IVA a pagar pendiente.

    // ── PPM anticipados (activo: pagos provisionales mensuales a cuenta
    // del impuesto anual). ppmTasa configurable (ej. 0.003 = 0,3 %).
    const ppmTasa = num(conf?.ppmTasa);
    const ppmAnticipos = ppmTasa > 0 ? Math.round(ventasNetasYtd * ppmTasa) : 0;

    // ── Provisión laboral: sueldos + leyes sociales devengados del mes,
    // aún no pagados al corte (configuración plana, típica pyme).
    const provisionLaboral = Math.max(0, num(conf?.provisionLaboral));

    // ── Deuda financiera de flota (leasing/préstamo): cuotas restantes a
    // partir del corte, partidas en <12m (corriente) y >12m (no corriente).
    // Las cuotas ya vencidas/pagadas no son pasivo; las futuras sí.
    let finCorriente = 0, finNoCorriente = 0;
    const finDetalle: any[] = [];
    for (const v of vehiculos) {
      const cuota = num(v.cuotaMensual), tot = Math.floor(num(v.cuotasTotales));
      if (cuota <= 0 || tot <= 0 || !v.primerCuotaAt) continue;
      const t0 = new Date(v.primerCuotaAt).getTime();
      const vencidas = Math.max(0, Math.min(tot, Math.floor((corte.getTime() - t0) / (30.44 * 86400000))));
      const restantes = tot - vencidas;
      if (restantes <= 0) continue;
      const cor = Math.min(12, restantes) * cuota;
      const ncor = Math.max(0, restantes - 12) * cuota;
      finCorriente += cor; finNoCorriente += ncor;
      finDetalle.push({ dominio: v.dominio, cuotaMensual: Math.round(cuota), cuotasRestantes: restantes, deudaCorriente: Math.round(cor), deudaNoCorriente: Math.round(ncor) });
    }

    // ── Patrimonio compuesto: capital + utilidades retenidas + resultado
    // del ejercicio (devengado YTD) − retiros. Se cruza con el implícito
    // (activo − pasivo): la diferencia marca datos faltantes.
    const pat = conf?.patrimonio || {};
    const capital = num(pat.capital), utilidades = num(pat.utilidadesRetenidas), retiros = num(pat.retiros);
    const patrimonioCompuesto = capital + utilidades + resultadoEjercicio - retiros;

    const activoCorriente = caja + cxc + remanente + ppmAnticipos;
    const activoNoCorriente = flotaValor;
    const activo = activoCorriente + activoNoCorriente;
    const pasivoCorriente = cxpSaldo + ivaPagar + provisionLaboral + finCorriente;
    const pasivoNoCorriente = finNoCorriente;
    const pasivo = pasivoCorriente + pasivoNoCorriente;
    const patrimonioImplicito = activo - pasivo;

    return reply.send({
      anio, mes, moneda, alCorteDe: corte.toISOString().slice(0, 10),
      activo: {
        corriente: { caja: Math.round(caja), cuentasPorCobrar: Math.round(cxc), remanenteIva: Math.round(remanente), ppmAnticipos, total: Math.round(activoCorriente) },
        noCorriente: { flotaValorEstimado: Math.round(flotaValor), total: Math.round(activoNoCorriente), unidades: vehiculos.length },
        total: Math.round(activo),
      },
      pasivo: {
        corriente: { cuentasPorPagar: Math.round(cxpSaldo), cxpVencido: Math.round(cxpVencido), ivaAPagarEstimado: Math.round(ivaPagar), provisionLaboral: Math.round(provisionLaboral), financiacionCorriente: Math.round(finCorriente), total: Math.round(pasivoCorriente) },
        noCorriente: { financiacionFlota: Math.round(finNoCorriente), total: Math.round(pasivoNoCorriente) },
        total: Math.round(pasivo),
      },
      patrimonio: {
        capital: Math.round(capital), utilidadesRetenidas: Math.round(utilidades),
        resultadoEjercicio: Math.round(resultadoEjercicio), retiros: Math.round(retiros),
        compuesto: Math.round(patrimonioCompuesto), implicito: Math.round(patrimonioImplicito),
        diferencia: Math.round(patrimonioImplicito - patrimonioCompuesto),
        nota: 'Compuesto = capital + utilidades + resultado del ejercicio − retiros (configurado). Implícito = activo − pasivo. Una diferencia grande indica movimientos no registrados en el sistema.',
      },
      ratios: {
        liquidez: pasivoCorriente > 0 ? Math.round((activoCorriente / pasivoCorriente) * 100) / 100 : null,
        endeudamiento: activo > 0 ? Math.round((pasivo / activo) * 1000) / 10 : null,
        cxcSobreVentas: null as number | null,
      },
      flotaDetalle: flotaDetalle.sort((a, b) => b.valorEstimado - a.valorEstimado).slice(0, 30),
      financiacionDetalle: finDetalle.sort((a, b) => (b.deudaCorriente + b.deudaNoCorriente) - (a.deudaCorriente + a.deudaNoCorriente)),
      supuestos: [
        'Caja = saldo inicial configurado + cobros − pagos del año hasta el corte.',
        'CxC = facturas emitidas menos cobros registrados hasta el corte.',
        'CxP = saldo actual de cuentas por pagar.',
        'Flota = precio de compra con depreciación lineal a 10 años (valor residual mínimo 10 %).',
        'IVA: remanente de crédito fiscal arrastrado mes a mes; el débito neto del último mes es el F29 a pagar.',
        'PPM = tasa configurada × ventas netas del año (anticipo de impuesto anual).',
        'Deuda financiera = cuotas de leasing/préstamo de flota restantes al corte (<12m corriente, >12m no corriente).',
        'Provisión laboral = monto fijo configurado (sueldos + leyes sociales del mes por pagar).',
        'Patrimonio compuesto cruza contra el implícito: diferencia = datos no registrados.',
      ],
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
    const [lineas, facturasIva] = await Promise.all([
      recolectarLineas(tenantId, new Date(Date.UTC(anio, 0, 1)), new Date(Date.UTC(anio, ultimoMes, 1)), moneda, q.centroCostoId || null),
      // Débito fiscal: IVA cobrado en ventas emitidas (NC resta, ANULADA no cuenta).
      // Va por query aparte — las líneas FACTURA_EMITIDA no llevan iva para no
      // contaminar el cálculo de crédito.
      app.prisma.finanzaFactura.findMany({
        where: { tenantId, deletedAt: null, estado: { not: 'ANULADA' }, fechaEmision: { gte: new Date(Date.UTC(anio, 0, 1)), lt: new Date(Date.UTC(anio, ultimoMes, 1)) }, ...(moneda ? { moneda } : {}), ...(q.centroCostoId ? { centroCostoId: q.centroCostoId } : {}) },
        select: { fechaEmision: true, iva: true, tipoComprobante: true },
      }).catch(() => [] as any[]),
    ]);
    const meses = [];
    const tot = { recuperado: 0, noRecuperado: 0, estimado: 0, cargasSinDesagregar: 0, debito: 0, aPagar: 0, remanente: 0 };
    // Remanente a favor: cuando el crédito del mes supera al débito, el excedente
    // se arrastra y descuenta el débito del mes siguiente (lógica F29).
    let remanente = 0;
    for (let m = 1; m <= ultimoMes; m++) {
      const ls = lineas.filter((l: any) => new Date(l.fecha).getUTCMonth() + 1 === m);
      const recuperado = ls.filter(l => l.ivaRecuperable !== false && num(l.iva) > 0).reduce((s, l) => s + num(l.iva), 0);
      const noRecuperado = ls.filter(l => l.ivaRecuperable === false && num(l.iva) > 0).reduce((s, l) => s + num(l.iva), 0);
      const sinDesag = ls.filter(l => l.fuente === 'COMBUSTIBLE' && l.ivaRecuperable !== false && num(l.iva) === 0 && num(l.ivaBruto) > 0);
      const estimado = sinDesag.reduce((s, l) => s + num(l.ivaBruto) * (tasa / (1 + tasa)), 0);
      const debito = facturasIva
        .filter((f: any) => new Date(f.fechaEmision).getUTCMonth() + 1 === m)
        .reduce((s: number, f: any) => s + (f.tipoComprobante === 'NOTA_CREDITO' ? -1 : 1) * num(f.iva), 0);
      const creditoDisponible = recuperado + remanente;
      const aPagar = Math.max(0, debito - creditoDisponible);
      remanente = Math.max(0, creditoDisponible - debito);
      meses.push({ mes: m, mesKey: `${anio}-${String(m).padStart(2, '0')}`, recuperado, noRecuperado, estimado, cargasSinDesagregar: sinDesag.length, debito, aPagar, remanente });
      tot.recuperado += recuperado; tot.noRecuperado += noRecuperado; tot.estimado += estimado; tot.cargasSinDesagregar += sinDesag.length; tot.debito += debito; tot.aPagar += aPagar;
    }
    tot.remanente = remanente;
    const actualizadoEn = await ultimaAct(tenantId, moneda);
    return reply.send({ anio, moneda, tasaEstimada: tasa, meses, totales: tot, actualizadoEn });
  });

  // ═══════════════════════════════════════════════════════════════
  // ALERTAS GERENCIALES — reglas deterministas sobre datos reales.
  // Umbrales por tenant: resultadosConfig.alertas {atencion:10, critica:25}.
  // Severidad: INFO | ATENCION | CRITICA. Máximo 8, por impacto económico.
  // ═══════════════════════════════════════════════════════════════
  // Núcleo del cálculo de alertas — lo usa GET /alertas y el job diario
  // que notifica las críticas a los administradores del tenant.
  async function calcularAlertas(tenantId: string, anio: number, mes: number, moneda: string | null, centroCostoId: string | null) {
    const hoy = new Date();
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

    // Comparación like-for-like: si el mes consultado es el que está en curso,
    // el mes anterior se corta en el mismo día (1..N vs 1..N). Comparar un mes
    // a medias contra uno completo infla falsas caídas del ~100%.
    const hoyA = new Date();
    const esActual = hoyA >= desde && hoyA < hasta;
    const corteAct = esActual ? hoyA : hasta;
    const diasTranscurridos = Math.max(1, Math.round((corteAct.getTime() - desde.getTime()) / 86400000));
    const cortePrev = new Date(Math.min(desdePrev.getTime() + diasTranscurridos * 86400000, desde.getTime()));
    const mesNombre = new Date(desde).toLocaleDateString('es-CL', { month: 'long', timeZone: 'UTC' });
    const refPrev = esActual ? `los primeros ${diasTranscurridos} días del mes anterior` : 'el mes anterior';

    const [lineas, lineasPrev, lineasHist, cxp, cxc] = await Promise.all([
      recolectarLineas(tenantId, desde, corteAct, moneda, centroCostoId),
      recolectarLineas(tenantId, desdePrev, cortePrev, moneda, centroCostoId),
      recolectarLineas(tenantId, desdeHist, desdePrev, moneda, centroCostoId),
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
    // Mes sin datos cargados: una variación de −100% es falso positivo (faltan
    // cargas, no ventas). Se reporta como INFO en vez de CRITICA.
    if (lineas.length === 0 && lineasPrev.length > 0) {
      push('INFO', 'SIN_DATOS', `${mesNombre} todavía no tiene movimientos cargados — las variaciones contra el mes anterior no son comparables`, vPrev - cPrev);
    } else {
      const vVentas = varPct(vAct, vPrev);
      if (vVentas !== null && Math.abs(vVentas) >= UMB_AT)
        push(vVentas >= UMB_CR ? 'CRITICA' : Math.abs(vVentas) >= UMB_CR ? 'CRITICA' : 'ATENCION', vVentas > 0 ? 'VENTAS_UP' : 'VENTAS_DOWN',
          `Ventas ${vVentas > 0 ? 'aumentaron' : 'cayeron'} ${Math.abs(vVentas).toFixed(1)} % respecto de ${refPrev}`, vAct - vPrev);
      const vRes = varPct(rAct, rPrev);
      if (vRes !== null && Math.abs(vRes) >= UMB_AT)
        push(rAct < rPrev ? 'ATENCION' : 'INFO', 'RESULTADO',
          `Resultado ${vRes! > 0 ? 'mejoró' : 'empeoró'} ${Math.abs(vRes!).toFixed(1)} % respecto de ${refPrev}`, rAct - rPrev);
    }

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
    return { alertas: alertas.slice(0, 8), umbrales: { atencion: UMB_AT, critica: UMB_CR }, actualizadoEn };
  }

  app.get('/alertas', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const q = req.query as any;
    const hoy = new Date();
    const anio = Number(q.anio) || hoy.getUTCFullYear();
    const mes = Number(q.mes) || hoy.getUTCMonth() + 1;
    const monedaQ = q.moneda || null;
    const consolidar = monedaQ === 'TODAS';
    const moneda = consolidar ? null : monedaQ;
    const cfgC = await configMoneda(tenantId);
    const res = await calcularAlertas(tenantId, anio, mes, moneda, q.centroCostoId || null);
    return reply.send({ ...res, moneda: monedaQ, monedaBase: consolidar ? (cfgC.monedaDefault || 'USD') : null });
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
    const monedaQ = q.moneda || null;
    const consolidar = monedaQ === 'TODAS';
    const moneda = consolidar ? null : monedaQ;
    const cc = q.centroCostoId || null;

    const rango = (a: number, m: number) => [new Date(Date.UTC(a, m - 1, 1)), new Date(Date.UTC(a, m, 1))] as const;
    const [dA, hA] = rango(anio, mes);
    const prevMes = mes === 1 ? { a: anio - 1, m: 12 } : { a: anio, m: mes - 1 };
    const [dM, hM] = rango(prevMes.a, prevMes.m);
    const [dY, hY] = rango(anio - 1, mes);

    // Like-for-like: mes en curso se compara contra la MISMA cantidad de días
    // del mes anterior y del mismo mes del año pasado (1..N vs 1..N). Un mes a
    // medias vs uno completo inventa caídas del ~100%.
    const hoyC = new Date();
    const esActual = hoyC >= dA && hoyC < hA;
    const corteA = esActual ? hoyC : hA;
    const diasT = Math.max(1, Math.round((corteA.getTime() - dA.getTime()) / 86400000));
    const corteM = new Date(Math.min(dM.getTime() + diasT * 86400000, hM.getTime()));
    const corteY = new Date(Math.min(dY.getTime() + diasT * 86400000, hY.getTime()));

    // YTD: acumulado del año hasta el mismo día/corte, contra el mismo tramo
    // del año anterior (ene→N del año vs ene→N del año pasado).
    const dYtd = new Date(Date.UTC(anio, 0, 1));
    const dYtdPrev = new Date(Date.UTC(anio - 1, 0, 1));
    const hYtdPrev = new Date(Date.UTC(anio - 1, mes, Math.min(diasT, new Date(Date.UTC(anio - 1, mes, 0)).getUTCDate())));

    const rec = (d: Date, h: Date) => consolidar
      ? recolectarConsolidado(tenantId, d, h, cc).then(r => r.lineas)
      : recolectarLineas(tenantId, d, h, moneda, cc);
    const [act, prev, yoy, ytdA, ytdP, consolInfo] = await Promise.all([
      rec(dA, corteA), rec(dM, corteM), rec(dY, corteY), rec(dYtd, corteA), rec(dYtdPrev, hYtdPrev),
      consolidar ? recolectarConsolidado(tenantId, dA, corteA, cc) : Promise.resolve(null),
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
    const YA = resumen(ytdA), YP = resumen(ytdP);

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

    const huboPrev = P.lineas > 0, huboYoy = Y.lineas > 0, huboYtdP = YP.lineas > 0;
    return reply.send({
      anio, mes, moneda: monedaQ, monedaBase: consolInfo?.monedaBase ?? null,
      faltantesTC: consolInfo?.faltantes ?? [], esMesActual: esActual, diasTranscurridos: esActual ? diasT : null,
      actual: A,
      mesAnterior: { ...P, mesKey: `${prevMes.a}-${String(prevMes.m).padStart(2, '0')}`, hayDatos: huboPrev },
      mismoMesAnioAnterior: { ...Y, mesKey: `${anio - 1}-${String(mes).padStart(2, '0')}`, hayDatos: huboYoy },
      vsMesAnterior: compara(A, P),
      vsAnioAnterior: huboYoy ? compara(A, Y) : null,
      // YTD: acumulado ene→corte del año vs el mismo tramo del año anterior
      ytd: {
        actual: { ...YA, desde: `${anio}-01`, hasta: `${anio}-${String(mes).padStart(2, '0')}` },
        anioAnterior: { ...YP, desde: `${anio - 1}-01`, hasta: `${anio - 1}-${String(mes).padStart(2, '0')}`, hayDatos: huboYtdP },
        vs: huboYtdP ? compara(YA, YP) : null,
      },
      drivers: drivers.slice(0, 8),
      actualizadoEn: await ultimaAct(tenantId, moneda),
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // ASISTENTE DE RESULTADOS — "¿Qué es este número?"
  // Recibe la métrica clickeada en la UI, recolecta el contexto real
  // del período (líneas que la componen + posición IVA) y lo resume
  // con el LLM en lenguaje simple. Si la IA no está disponible,
  // responde una explicación estática igualmente correcta.
  // ═══════════════════════════════════════════════════════════════
  const EXPLICA_ESTATICO: Record<string, string> = {
    'kpi-ventas': 'Ventas del año: suma de facturas emitidas (a valor neto, sin IVA — el IVA no es ingreso) más los ingresos operativos cargados en Flota 360. Viene del RCV de ventas del SII, de facturas cargadas a mano y del módulo Flota 360.',
    'kpi-costos': 'Costos del año: todo lo operativo (facturas de proveedores del RCV de compras, combustible, mantenimiento, neumáticos, multas, sueldos, cuotas de financiación) más gastos de estructura y gastos cargados a mano. El IVA recuperable se descuenta porque no es costo real.',
    'kpi-resultado': 'Resultado = ventas (netas de IVA) − costos operativos − estructura. Es resultado devengado (cuando se emite la factura / se consume el gasto), no caja. El margen es resultado ÷ ventas.',
    'kpi-cobrado': 'Cobrado = plata que efectivamente entró al banco: cobros registrados sobre facturas emitidas + ingresos de flota marcados como cobrados. Incluye IVA porque el cliente paga el total. Difiere de ventas porque facturar no es cobrar.',
    'resumen-mes': 'El resumen cruza ventas, costos y resultado del mes seleccionado, y compara contra el mes anterior y el mismo mes del año pasado. Si el mes está en curso, compara solo los primeros N días en los tres períodos (comparación justa).',
    'comparativa': 'Las variaciones comparan el mes seleccionado contra el mes anterior y el mismo mes del año pasado. Si el mes está en curso se cortan los tres períodos en el mismo día (1..N) para no inventar caídas del ~100%.',
    drivers: 'Los drivers son los rubros que más movieron el resultado respecto del mes anterior: ingresos por fuente (facturación, ingresos de flota) y costos por rubro (combustible, sueldos, mantenimiento...). Verde = empujó el resultado arriba; rojo = lo tiró abajo.',
    alertas: 'Las alertas se generan comparando ventas/resultado del mes contra el anterior y el promedio de los últimos 6 meses. Si el mes está en curso, la comparación es por igual cantidad de días. Umbral de atención 10 %, crítica 25 % (configurable).',
    'iva-debito': 'IVA débito: el IVA que le cobraste a tus clientes en las facturas emitidas del mes (notas de crédito restan). Es plata que recaudás para el fisco, no ingreso. Sale del RCV de ventas del SII + facturas cargadas a mano.',
    'iva-credito': 'IVA crédito: el IVA de tus compras y gastos marcado como recuperable (facturas del RCV de compras, facturas de flota, combustible con IVA desagregado). Se descuenta del débito en el F29.',
    'iva-remanente': 'Remanente a favor: cuando el crédito del mes supera al débito, el excedente no se pierde — se arrastra y descuenta el débito del mes siguiente (lógica del F29, código 077).',
    'iva-apagar': 'A pagar estimado = débito − (crédito del mes + remanente acumulado). Es una estimación del IVA del F29: no incluye PPM ni retenciones, que el contador liquida aparte.',
    'iva-costo': 'IVA al costo: IVA de compras marcado como no recuperable — queda dentro del costo real del gasto y no descuenta débito.',
    'iva-estimado': 'Estimado en combustible: cargas de combustible sin IVA desagregado en el ticket. El sistema estima el IVA suponiendo que el precio de surtidor lo incluye (tasa editable). Cargar el IVA real en Flota 360 → Combustible lo convierte en crédito evidenciado.',
    'iva-cargas': 'Cargas sin IVA desagregado: cantidad de tickets de combustible donde no se cargó el IVA real — solo se puede estimar.',
    'iva-mes': 'La tabla por meses muestra la posición IVA de todo el año: débito (ventas), crédito (compras recuperable), remanente que se arrastra y a pagar estimado por mes.',
    f29: 'F29 real: la declaración efectivamente hecha en el SII para el período (folio, fecha y estado). El detalle compara lo declarado contra lo estimado por el sistema; diferencias típicas: documentos no válidos como crédito, PPM y retenciones que solo existen en el F29.',
    movimientos: 'Movimientos del período: cada línea económica del mes con su módulo de origen (Resultados, Flota 360, Infraestructura). El ícono del lápiz edita; el enlace abre el documento de origen.',
    ytd: 'Acumulado del año (YTD): suma de enero hasta el mes seleccionado comparada contra el mismo tramo del año anterior. Permite ver la tendencia anual sin que un mes malo distorsione la foto.',
    'balance-activo': 'Activo: lo que la empresa tiene — caja estimada (saldo inicial + cobros − pagos del año) más cuentas por cobrar (facturas emitidas sin cobrar) más la flota a valor estimado.',
    'balance-caja': 'Caja estimada: saldo inicial configurado más todos los cobros registrados del año menos los pagos, hasta el corte del mes. Aproxima la plata disponible.',
    'balance-cxc': 'Cuentas por cobrar: facturas emitidas a clientes que todavía no se cobraron al cierre del período (neto de notas de crédito).',
    'balance-flota': 'Valor de flota estimado: precio de compra de cada vehículo con depreciación lineal a 10 años (piso del 10 %). Es una estimación gerencial, no un valor contable ni de mercado.',
    'balance-pasivo': 'Pasivo: lo que la empresa debe — cuentas por pagar a proveedores (saldo vivo) más el IVA a pagar estimado del mes (débito − crédito evidenciado).',
    'balance-cxp': 'Cuentas por pagar: gastos y facturas de proveedores cargados que aún no están pagados.',
    'balance-iva': 'IVA a pagar estimado: débito del mes (IVA de facturas emitidas) menos crédito evidenciado del mes. Sin remanente ni PPM — el contador liquida el F29 real.',
    'balance-patrimonio': 'Patrimonio estimado = activo − pasivo. Si es positivo y crece, la empresa acumula valor; si es negativo, debe más de lo que tiene. Estimación gerencial, no el balance contable.',
    'balance-liquidez': 'Liquidez corriente = activo corriente ÷ pasivo corriente. Mayor a 1 significa que alcanza para cubrir las deudas de corto plazo; menor a 1 anticipa problemas de caja.',
    'balance-endeudamiento': 'Endeudamiento = pasivo ÷ activo. Qué porcentaje de lo que hay está financiado con deuda. Más alto = más riesgo.',
    tendencia: 'Tendencia y proyección: regresión lineal sobre los últimos 12 meses cerrados con datos. La pendiente muestra cuánto crecen (o caen) ventas y costos por mes; R² indica qué tan bien los datos explican la proyección.',
    'meta-ventas': 'Meta de ventas: objetivo mensual cargado en Configuración. El avance compara lo facturado del mes contra la meta.',
    'meta-resultado': 'Meta de resultado: objetivo de resultado mensual cargado en Configuración. El avance compara el resultado real contra la meta.',
    'cierre-periodo': 'Cierre de período: meses bloqueados para carga y edición. Una vez cerrado, ningún documento con fecha de ese mes se puede crear, editar o borrar (error 423). Sirve para congelar números ya reportados.',
    'informe-email': 'Informe ejecutivo por email: el día 1 de cada mes el sistema envía automáticamente el resumen del mes anterior a las direcciones configuradas.',
    'tipos-cambio': 'Tipos de cambio: tasas manuales por moneda y mes (o "*" como default) usadas para consolidar todas las operaciones en la moneda base cuando se elige "Consolidado".',
  };

  app.post('/explicar', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const body = z.object({
      metrica: z.string().max(60),
      titulo: z.string().max(140).optional().nullable(),
      anio: z.number().int().min(2000).max(2100),
      mes: z.number().int().min(1).max(12),
      moneda: z.string().max(6).optional().nullable(),
      centroCostoId: z.string().uuid().optional().nullable(),
      datos: z.any().optional().nullable(),
      texto: z.string().max(600).optional().nullable(),
      pregunta: z.string().max(400).optional().nullable(),
    }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Validation failed', details: body.error.issues });
    const { metrica, titulo, anio, mes, centroCostoId, datos, texto, pregunta } = body.data;
    const monedaQ = body.data.moneda || null;
    const consolidar = monedaQ === 'TODAS';
    const moneda = consolidar ? null : monedaQ;
    const p = prisma();

    // Ventana like-for-like: si el mes está en curso se corta en hoy.
    const desde = new Date(Date.UTC(anio, mes - 1, 1));
    const hasta = new Date(Date.UTC(anio, mes, 1));
    const hoyX = new Date();
    const enCurso = hoyX >= desde && hoyX < hasta;
    const corte = enCurso ? hoyX : hasta;
    const mesNombre = desde.toLocaleDateString('es-CL', { month: 'long', timeZone: 'UTC' });

    // Cache 10 min del contexto (recolectar es la parte cara del request).
    const cacheKey = `${tenantId}:${anio}-${mes}:${monedaQ || '-'}:${centroCostoId || '-'}`;
    const hit = EXPLICA_CACHE.get(cacheKey);
    let lineas: any[];
    if (hit && Date.now() - hit.at < EXPLICA_CACHE_TTL) {
      lineas = hit.lineas;
    } else {
      lineas = consolidar
        ? (await recolectarConsolidado(tenantId, desde, corte, centroCostoId || null)).lineas
        : await recolectarLineas(tenantId, desde, corte, moneda, centroCostoId || null);
      EXPLICA_CACHE.set(cacheKey, { at: Date.now(), lineas });
      if (EXPLICA_CACHE.size > 200) {
        // Limpieza simple: borra las entradas vencidas primero.
        const ahora = Date.now();
        for (const [k, v] of EXPLICA_CACHE) if (ahora - v.at > EXPLICA_CACHE_TTL) EXPLICA_CACHE.delete(k);
      }
    }
    const sg = (g: string[]) => lineas.filter(l => g.includes(l.grupo)).reduce((s, l) => s + l.importe, 0);
    const ventas = sg(['FACTURADO', 'INGRESO_OPERATIVO']);
    const costosOp = sg(['COSTO_OP', 'GASTO_MANUAL']);
    const estructura = sg(['ESTRUCTURA']);
    const cobrado = sg(['COBRADO']);
    const resultado = ventas - costosOp - estructura;
    const porRubro: Record<string, number> = {};
    for (const l of lineas) if (['COSTO_OP', 'ESTRUCTURA', 'GASTO_MANUAL'].includes(l.grupo)) porRubro[l.rubro] = (porRubro[l.rubro] || 0) + l.importe;

    // Evidencia real: las líneas que componen la métrica clickeada.
    const GRUPO_DE: Record<string, string[]> = {
      'kpi-ventas': ['FACTURADO', 'INGRESO_OPERATIVO'],
      'kpi-costos': ['COSTO_OP', 'ESTRUCTURA', 'GASTO_MANUAL'],
      'kpi-cobrado': ['COBRADO'],
      'kpi-resultado': [],
    };
    let rel = lineas;
    const g = GRUPO_DE[metrica];
    if (g?.length) rel = lineas.filter(l => g.includes(l.grupo));
    if (['factura', 'cxc-factura', 'cxc-cobrada', 'importar-doc', 'factura-total'].includes(metrica)) rel = lineas.filter(l => l.grupo === 'FACTURADO');
    if (['cobro', 'caja-cobro', 'cxc-total', 'cxc-vencido', 'cxc-90'].includes(metrica)) rel = lineas.filter(l => l.grupo === 'COBRADO');
    if (['gasto', 'gasto-total', 'gasto-proveedor', 'cxp-item', 'caja-pago', 'rubro', 'rubros'].includes(metrica)) rel = lineas.filter(l => ['COSTO_OP', 'ESTRUCTURA', 'GASTO_MANUAL'].includes(l.grupo));
    if (metrica === 'iva-credito') rel = lineas.filter(l => num(l.iva) > 0 && l.ivaRecuperable !== false);
    if (metrica === 'iva-costo') rel = lineas.filter(l => num(l.iva) > 0 && l.ivaRecuperable === false);
    if (metrica === 'iva-estimado' || metrica === 'iva-cargas') rel = lineas.filter(l => l.fuente === 'COMBUSTIBLE');
    const evidencia = rel.slice().sort((a, b) => Math.abs(b.importe) - Math.abs(a.importe)).slice(0, 6)
      .map(l => ({ fecha: new Date(l.fecha).toISOString().slice(0, 10), concepto: String(l.concepto).slice(0, 80), importe: Math.round(l.importe), fuente: l.fuente, modulo: l.modulo }));

    // Débito IVA del mes: IVA de facturas emitidas (NC resta).
    const facturasIva = await p.finanzaFactura.findMany({
      where: { tenantId, deletedAt: null, fechaEmision: { gte: desde, lt: hasta }, ...(moneda ? { moneda } : {}) },
      select: { iva: true, tipoComprobante: true },
    }).catch(() => [] as any[]);
    const ivaDebito = facturasIva.reduce((s: number, f: any) => s + (f.tipoComprobante === 'NOTA_CREDITO' ? -1 : 1) * num(f.iva), 0);
    const ivaCredito = lineas.filter(l => num(l.iva) > 0 && l.ivaRecuperable !== false).reduce((s, l) => s + num(l.iva), 0);
    const ivaNoRec = lineas.filter(l => num(l.iva) > 0 && l.ivaRecuperable === false).reduce((s, l) => s + num(l.iva), 0);

    const contexto = {
      periodo: `${mesNombre} ${anio}${enCurso ? ' (en curso)' : ''}`,
      moneda: consolidar ? 'consolidado (todas, convertidas a moneda base)' : moneda || 'todas', centroCosto: centroCostoId ? 'filtrado' : 'todos',
      resumen: {
        ventasNetas: Math.round(ventas), costosOperativos: Math.round(costosOp), estructura: Math.round(estructura),
        resultado: Math.round(resultado), cobradoConIva: Math.round(cobrado),
        margenPct: ventas > 0 ? Math.round((resultado / ventas) * 1000) / 10 : null, movimientos: lineas.length,
      },
      costosPorRubro: Object.fromEntries(Object.entries(porRubro).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => [k, Math.round(v)])),
      ivaMes: { debito: Math.round(ivaDebito), credito: Math.round(ivaCredito), alCostoNoRecuperado: Math.round(ivaNoRec) },
      evidenciaPrincipales: evidencia,
      numerosQueVeElUsuario: datos ?? undefined,
      elementoClickeado: texto ?? undefined,
    };

    let explicacion: string | null = null;
    let via = 'estatico';
    try {
      const llm = createGroqOnlyLLMProvider((req as any).tenant, p, tenantId, (req as any).auth?.userId ?? null, 'finanzas-asistente');
      const prompt = `Sos el asistente financiero de una PyME de transporte/logística dentro de su ERP. ${pregunta
        ? `El usuario hizo una PREGUNTA LIBRE sobre sus números del módulo "Resultados de negocio".

Pregunta del usuario: "${pregunta}"${metrica && metrica !== 'pregunta' ? ` (estaba mirando: "${titulo || metrica}")` : ''}`
        : `El usuario hizo click sobre un indicador del módulo "Resultados de negocio" y quiere entenderlo para poder explicarlo a otros.

Métrica clickeada: "${metrica}"${titulo ? ` (título en pantalla: "${titulo}")` : ''}.`}

Contexto real del período (JSON):
${JSON.stringify(contexto)}

Reglas:
${pregunta
        ? '- Respondé la pregunta DIRECTAMENTE usando solo los números del contexto. Si el dato necesario no está, decilo sin inventar.'
        : '- Explicá QUÉ es el número, CÓMO se compone (la fórmula en criollo) y DE DÓNDE salen los datos (qué módulo/fuente: RCV del SII, facturas manuales, Flota 360, Infraestructura, RRHH).'}
- Citá 1-2 líneas de "evidenciaPrincipales" con su monto si ayudan a entenderlo.
- Si el mes está en curso, aclaralo ("todavía se está cargando/va a subir").
- Si hay "numerosQueVeElUsuario", usá esos valores exactos para referirte a lo que ve en pantalla.
- Tono cercano, español rioplatense neutro, máximo ~110 palabras, sin markdown ni encabezados. Podés usar **negrita** solo para el número clave.
- No inventes cifras que no estén en el contexto.`;
      const ai = await llm.chat([{ role: 'user', content: prompt }], 700);
      explicacion = (ai?.text || '').trim() || null;
      if (explicacion) via = 'ia';
    } catch { /* sin LLM → fallback estático */ }

    if (!explicacion) {
      explicacion = pregunta
        ? `En ${mesNombre} ${anio} llevás ventas netas ${Math.round(ventas).toLocaleString('es-AR')}, costos ${Math.round(costosOp + estructura).toLocaleString('es-AR')} y resultado ${Math.round(resultado).toLocaleString('es-AR')} (${monedaQ || 'todas'}). La IA no está disponible ahora, pero esos son los números del período.`
        : EXPLICA_ESTATICO[metrica] || `Este indicador forma parte del resultado de ${mesNombre} ${anio}: ventas netas ${Math.round(ventas)}, costos ${Math.round(costosOp + estructura)}, resultado ${Math.round(resultado)} (${monedaQ || ''}). Cada línea del detalle indica su módulo de origen.`;
    }
    return reply.send({ explicacion, via, periodo: `${mesNombre} ${anio}` });
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
    // Con filtro de centro se muestran sus comentarios + los globales (null).
    if (q.centroCostoId) where.centroCostoId = { in: [q.centroCostoId, null] };
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

  // Ingest compartido: lo usan /importar-rcv (CSV manual) y /sii-sync
  // (descarga automática). Dedup por tipo + folio + RUT en ambos caminos.
  async function ingestarFilasRcv(
    p: any, tenantId: string, user: { id: string | null; nombre: string | null },
    opts: { tipo: 'VENTAS' | 'COMPRAS'; moneda: string; centroCostoId?: string | null; diasVencimiento: number; categoriaDefault: string; tipoGastoDefault: string; filas: any[]; origen?: string },
  ) {
    const { tipo, moneda, centroCostoId, diasVencimiento, categoriaDefault, tipoGastoDefault, filas } = opts;
    const origen = opts.origen || 'IMPORT_RCV';
    let creados = 0, duplicados = 0;
    const errores: string[] = [];

    // Clasificación previa por proveedor: si ya existe un gasto de ese RUT, se reutiliza
    const clasif = new Map<string, any>();
    if (tipo === 'COMPRAS') {
      const ruts = [...new Set(filas.map((f: any) => f.rut).filter(Boolean))] as string[];
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
              origen, uploadedById: user.id, uploadedByNombre: user.nombre,
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
              tipoComprobante, numeroComprobante: f.folio, origen,
              uploadedById: user.id, uploadedByNombre: user.nombre,
            },
          });
        }
        creados++;
      } catch (e: any) {
        errores.push(`Folio ${f.folio}: ${e?.message?.slice(0, 120) || 'error'}`);
      }
    }
    return { creados, duplicados, errores };
  }

  app.post('/importar-rcv', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const body = importRcvSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Validation failed', details: body.error.issues });
    const { tipo, moneda, centroCostoId, diasVencimiento, categoriaDefault, tipoGastoDefault, filas } = body.data;
    const user = await resolveUser(app.prisma, (req as any).auth?.userId);
    const { creados, duplicados, errores } = await ingestarFilasRcv(
      prisma(), tenantId, user,
      { tipo, moneda, centroCostoId, diasVencimiento, categoriaDefault, tipoGastoDefault, filas },
    );
    return reply.send({ ok: true, creados, duplicados, errores: errores.slice(0, 50), totalErrores: errores.length });
  });

  // ═══════════════════════════════════════════════════════════════
  // IMPORTAR SUELDOS — planilla de liquidaciones (.xlsx)
  // Formato esperado: una fila por empleado por mes; columna A = Fecha
  // (periodo), R.U.T. + NOMBRE para matchear al empleado, "Costo Mano
  // Obra" para imputación (Administrativo → estructura) y
  // "COSTO EMPRESA" como monto. La misma planilla puede traer todo el año:
  // cada fila se vincula al mes de su Fecha.
  // ═══════════════════════════════════════════════════════════════

  const normHdr = (s: any) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
  const normRutEmp = (s: any) => String(s ?? '').replace(/[^0-9kK]/g, '').toUpperCase();
  const normNombreEmp = (s: any) => normHdr(s).split(' ').filter(Boolean).sort().join(' ');

  const parseMontoSueldo = (v: any): number => {
    if (v === null || v === undefined || v === '') return 0;
    if (typeof v === 'number') return v;
    let s = String(v).trim().replace(/[^\d,.-]/g, '');
    if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
    else if (s.includes(',') && !s.includes('.')) s = s.replace(',', '.');
    const n = Number(s);
    return isNaN(n) ? 0 : n;
  };

  const parsePeriodo = (v: any): { anio: number; mes: number } | null => {
    if (v instanceof Date && !isNaN(v.getTime())) return { anio: v.getFullYear(), mes: v.getMonth() + 1 };
    if (typeof v === 'number' && v > 20000 && v < 80000) { // serial de Excel
      const d = XLSX.SSF?.parse_date_code?.(v);
      if (d) return { anio: d.y, mes: d.m };
      const js = new Date(Math.round((v - 25569) * 86400 * 1000));
      if (!isNaN(js.getTime())) return { anio: js.getUTCFullYear(), mes: js.getUTCMonth() + 1 };
    }
    const s = String(v ?? '').trim();
    let m = s.match(/^(\d{4})-(\d{1,2})/);
    if (m) return { anio: +m[1], mes: +m[2] };
    m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
    if (m) return { anio: +m[3], mes: +m[2] };
    m = s.match(/^(\d{1,2})[\/-](\d{4})$/); // MM-YYYY
    if (m) return { anio: +m[2], mes: +m[1] };
    return null;
  };

  // Busca la hoja con headers Fecha + Costo Empresa (prefiere la llamada "Sueldos")
  function extraerFilasSueldos(wb: any) {
    type H = { sheet: string; headerRow: number; col: Record<string, number> };
    const detectar = (name: string): H | null => {
      const ws = wb.Sheets[name];
      if (!ws) return null;
      const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '', range: 0 }) as any[][];
      for (let r = 0; r < Math.min(rows.length, 15); r++) {
        const h = (rows[r] || []).map(normHdr);
        const idx = (preds: string[]) => h.findIndex(x => preds.some(px => x === px || x.includes(px)));
        const col = {
          fecha: idx(['fecha', 'periodo']),
          rut: idx(['rut', 'r u t']),
          nombre: idx(['nombre', 'apellido nombre', 'trabajador', 'empleado']),
          tipo: idx(['costo mano obra', 'costo mano de obra', 'tipo personal']),
          monto: idx(['costo empresa', 'costo total empresa']),
        };
        if (col.fecha >= 0 && col.monto >= 0) return { sheet: name, headerRow: r, col };
      }
      return null;
    };
    let h = detectar('Sueldos');
    if (!h) for (const name of wb.SheetNames) { h = detectar(name); if (h) break; }
    if (!h) return null;
    const ws = wb.Sheets[h.sheet];
    const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '', range: h.headerRow + 1 }) as any[][];
    const cr = h.col;
    const get = (row: any[], i: number) => (i >= 0 ? row[i] : '');
    return rows.map(row => ({
      periodo: parsePeriodo(get(row, cr.fecha)),
      rut: normRutEmp(get(row, cr.rut)),
      nombre: String(get(row, cr.nombre) ?? '').trim(),
      tipoManoObra: String(get(row, cr.tipo) ?? '').trim(),
      monto: parseMontoSueldo(get(row, cr.monto)),
    })).filter(f => f.periodo && f.monto > 0 && (f.rut || f.nombre));
  }

  app.post('/importar-sueldos', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const file = await (req as any).file();
    if (!file) return reply.code(400).send({ error: 'No se proporcionó archivo' });
    const buf = await file.toBuffer();
    let wb: any;
    try { wb = XLSX.read(buf, { type: 'buffer', cellDates: true }); }
    catch { return reply.code(400).send({ error: 'No se pudo leer el archivo. Subí un .xlsx válido.' }); }
    const filas = extraerFilasSueldos(wb);
    if (!filas) return reply.code(400).send({ error: 'No encontré una hoja con columnas "Fecha" y "Costo Empresa". ¿Es la planilla de liquidaciones?' });
    if (!filas.length) return reply.code(400).send({ error: 'La hoja no tiene filas válidas (fecha + costo empresa > 0).' });

    const empleados = await prisma().employee.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true, firstName: true, lastName: true, dni: true, centroCostoId: true },
    });
    const porRut = new Map<string, any>(empleados.map((e: any) => [normRutEmp(e.dni), e] as const).filter(([r]: [string, any]) => r));
    const porNombre = new Map(empleados.map((e: any) => [normNombreEmp(`${e.firstName} ${e.lastName}`), e] as const));

    let matched = 0, sinMatch = 0;
    const porPeriodo = new Map<string, { personas: number; total: number }>();
    const filasOut = filas.map(f => {
      const emp = (f.rut ? porRut.get(f.rut) : undefined) || (f.nombre ? porNombre.get(normNombreEmp(f.nombre)) : undefined);
      // Todos los sueldos importados se imputan a ESTRUCTURA (total de personal,
      // sin diferenciar administración/operación).
      const tipoGasto = 'ESTRUCTURA' as const;
      const p = f.periodo!;
      const key = `${p.anio}-${String(p.mes).padStart(2, '0')}`;
      const agg = porPeriodo.get(key) || { personas: 0, total: 0 };
      agg.personas += 1; agg.total += f.monto; porPeriodo.set(key, agg);
      if (emp) matched++; else sinMatch++;
      return {
        anio: p.anio, mes: p.mes,
        rut: f.rut || null, nombreExcel: f.nombre || null,
        employeeId: emp?.id || null, nombreEmpleado: emp ? `${emp.firstName} ${emp.lastName}`.trim() : null,
        monto: f.monto, tipoGasto,
      };
    });
    return reply.send({
      ok: true,
      filas: filasOut.slice(0, 500), totalFilas: filasOut.length,
      matched, sinMatch,
      periodos: Array.from(porPeriodo.entries()).sort().map(([periodo, v]) => ({ periodo, ...v })),
    });
  });

  const sueldoFilaSchema = z.object({
    anio: z.number().int().min(2000).max(2100), mes: z.number().int().min(1).max(12),
    employeeId: z.string().uuid().optional(),
    rut: z.string().optional(), nombre: z.string().optional(),
    monto: z.number().positive(),
    tipoGasto: z.enum(['OPERATIVO', 'ESTRUCTURA']).default('OPERATIVO'),
  });

  // Nombre de planilla de liquidaciones: "APELLIDO1 APELLIDO2 NOMBRE(S)".
  const splitNombrePlanilla = (nombre: string) => {
    const toks = String(nombre || '').trim().split(/\s+/).filter(Boolean);
    if (toks.length >= 3) return { lastName: toks.slice(0, 2).join(' '), firstName: toks.slice(2).join(' ') };
    if (toks.length === 2) return { lastName: toks[0], firstName: toks[1] };
    const uno = toks[0] || 'SIN NOMBRE';
    return { lastName: uno, firstName: uno };
  };

  app.post('/importar-sueldos/confirm', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const body = z.object({
      filas: z.array(sueldoFilaSchema).min(1).max(5000),
      crearEmpleados: z.boolean().optional().default(false),
    }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Validation failed', details: body.error.issues });
    // Solo filas matcheadas a un empleado del tenant (o creables si se pidió)
    const empIds = new Set((await prisma().employee.findMany({ where: { tenantId }, select: { id: true } })).map((e: any) => e.id));
    const filas = body.data.filas.filter(f =>
      f.employeeId ? empIds.has(f.employeeId) : (body.data.crearEmpleados && (f.rut || f.nombre)));
    if (!filas.length) return reply.code(400).send({ error: 'Ninguna fila corresponde a un empleado del tenant.' });

    // Crear empleados faltantes (planilla de otro país/legajo no cargado en RRHH)
    let empleadosCreados = 0;
    if (body.data.crearEmpleados) {
      const faltantes = filas.filter(f => !f.employeeId);
      if (faltantes.length) {
        const existentes = await prisma().employee.findMany({
          where: { tenantId }, select: { id: true, dni: true, firstName: true, lastName: true },
        });
        const porRut = new Map<string, string>(existentes.map((e: any) => [normRutEmp(e.dni), e.id] as const).filter(([r]: [string, string]) => r));
        const porNombre = new Map<string, string>(existentes.map((e: any) => [normNombreEmp(`${e.firstName} ${e.lastName}`), e.id] as const));
        // Personas únicas: por RUT si hay, si no por nombre normalizado
        const personas = new Map<string, { rut: string; nombre: string; ym: number; anio: number; mes: number }>();
        for (const f of faltantes) {
          const key = f.rut ? `r:${normRutEmp(f.rut)}` : `n:${normNombreEmp(f.nombre)}`;
          const ym = f.anio * 100 + f.mes;
          const cur = personas.get(key);
          if (!cur) personas.set(key, { rut: f.rut || '', nombre: f.nombre || '', ym, anio: f.anio, mes: f.mes });
          else if (ym < cur.ym) { cur.ym = ym; cur.anio = f.anio; cur.mes = f.mes; }
        }
        for (const [key, p] of personas) {
          let id = (p.rut ? porRut.get(normRutEmp(p.rut)) : undefined) || porNombre.get(normNombreEmp(p.nombre));
          if (!id) {
            const { firstName, lastName } = splitNombrePlanilla(p.nombre);
            const slug = normRutEmp(p.rut) || normNombreEmp(p.nombre).replace(/\s+/g, '-').slice(0, 40) || key.slice(0, 40);
            const created = await prisma().employee.create({
              data: {
                tenantId, firstName, lastName,
                dni: p.rut || `IMP-${slug}`,
                email: `emp-${slug.toLowerCase()}@import.local`,
                hireDate: new Date(Date.UTC(p.anio, p.mes - 1, 1)),
                contractType: 'PERMANENT',
              },
              select: { id: true },
            }).catch(() => null);
            if (created) {
              id = created.id; empleadosCreados++;
              if (p.rut) porRut.set(normRutEmp(p.rut), created.id);
              if (p.nombre) porNombre.set(normNombreEmp(p.nombre), created.id);
            }
          }
          if (id) {
            for (const f of faltantes) {
              const k = f.rut ? `r:${normRutEmp(f.rut)}` : `n:${normNombreEmp(f.nombre)}`;
              if (k === key) f.employeeId = id;
            }
          }
        }
      }
    }
    const filasOk = filas.filter(f => f.employeeId);

    let upserted = 0;
    const ultimoPorEmp = new Map<string, { anio: number; mes: number; monto: number }>();
    for (const f of filasOk) {
      const employeeId = f.employeeId!;
      await prisma().employeeSalary.upsert({
        where: { tenantId_employeeId_anio_mes: { tenantId, employeeId, anio: f.anio, mes: f.mes } },
        create: { tenantId, employeeId, anio: f.anio, mes: f.mes, monto: f.monto, tipoGasto: f.tipoGasto, origen: 'IMPORT_SUELDOS' },
        update: { monto: f.monto, tipoGasto: f.tipoGasto, origen: 'IMPORT_SUELDOS' },
      });
      upserted++;
      const cur = ultimoPorEmp.get(employeeId);
      if (!cur || f.anio * 100 + f.mes > cur.anio * 100 + cur.mes) ultimoPorEmp.set(employeeId, { anio: f.anio, mes: f.mes, monto: f.monto });
    }
    // costoMensual proyecta meses sin importar → lo sincronizamos al último
    // sueldo de cada empleado. Quien no figura en el último mes de la planilla
    // queda con costoMensual = 0 (baja: no cobró en el mes más reciente).
    const maxYm = Math.max(...filasOk.map(f => f.anio * 100 + f.mes));
    for (const [employeeId, u] of ultimoPorEmp) {
      const activo = u.anio * 100 + u.mes >= maxYm;
      await prisma().employee.update({ where: { id: employeeId }, data: { costoMensual: activo ? u.monto : 0 } }).catch(() => {});
    }
    const periodos = [...new Set(filasOk.map(f => `${f.anio}-${String(f.mes).padStart(2, '0')}`))].sort();
    return reply.send({ ok: true, upserted, empleados: ultimoPorEmp.size, empleadosCreados, periodos });
  });

  // ═══════════════════════════════════════════════════════════════
  // SINCRONIZACIÓN AUTOMÁTICA SII (Chile)
  // Baja el RCV vía APIGateway.cl con las credenciales del contribuyente
  // guardadas CIFRADAS en resultadosConfig.sii (AES-256-CBC, misma clave
  // que las API keys de LLM). Los documentos pasan por el mismo ingest
  // del CSV → dedup automático por folio + RUT.
  // El token de la plataforma va en env APIGATEWAY_API_TOKEN (cuenta
  // nuestra, no del tenant). Provider aislado en fetchRcvDatos: si hay
  // que migrar a la API oficial del SII, solo cambia esa función.
  // ═══════════════════════════════════════════════════════════════
  // Colapsa '_' y espacios → 'razon_social' == 'razon social' == 'razonsocial'
  const normKey = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[_\s]+/g, '').trim();
  // RUT SII: '778873427' → '77887342-7' (el provider espera el guión)
  const normalizarRut = (rut: string) => {
    const limpio = String(rut || '').replace(/[^0-9kK]/g, '');
    return limpio.length > 1 ? `${limpio.slice(0, -1)}-${limpio.slice(-1).toUpperCase()}` : limpio;
  };

  // Filas del RCV → shape filaRcvSchema. Misma lógica de match de columnas
  // que el parser CSV del front (parseRcv en ImportarSII.tsx).
  function rcvDatosToFilas(datos: any[]): any[] {
    // Dos pasadas: exacto primero (así 'total' gana sobre 'iva_retencion_total'
    // y 'fecha' sobre 'fecha_recepcion'), después contains. APIGateway v2 real
    // devuelve snake_case plano (folio/fecha/total/dte/rut/razon_social); otros
    // providers pueden devolver 'det*' o las columnas del CSV.
    const buscar = (row: any, preds: string[]) => {
      const np = preds.map(normKey);
      for (const k of Object.keys(row)) if (np.includes(normKey(k))) return row[k];
      for (const k of Object.keys(row)) {
        const n = normKey(k);
        if (np.some(px => n.startsWith(px) || n.includes(px))) return row[k];
      }
      return undefined;
    };
    const toNum = (v: any) => { const n = Number(String(v ?? '').replace(/[.\s]/g, '').replace(',', '.')); return isFinite(n) ? n : 0; };
    const parseFecha = (v: any) => {
      const s = String(v || '').trim().split(' ')[0];
      let m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
      if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
      m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (m) return `${m[1]}-${m[2]}-${m[3]}`;
      return '';
    };
    const filas: any[] = [];
    for (const row of datos || []) {
      const folioRaw = String(buscar(row, ['folio', 'nrodoc', 'nro doc']) ?? '').trim();
      const folio = folioRaw.replace(/^0+/, '') || folioRaw;
      const fecha = parseFecha(buscar(row, ['fecha docto', 'fchdoc', 'fecha']));
      const total = toNum(buscar(row, ['monto total', 'mnttotal', 'total']));
      if (!folio || !fecha || !total) continue;
      // RUT del documento: algunos providers separan DV (detRutDoc + detDvDoc)
      const rutBase = String(buscar(row, ['rut']) ?? '').trim();
      const dv = String(buscar(row, ['dvdoc', 'dv doc', 'digito']) ?? '').trim();
      const rut = rutBase && dv && !rutBase.includes('-') ? `${rutBase}-${dv}` : (rutBase || null);
      filas.push({
        tipoDoc: String(buscar(row, ['tipo doc', 'tipodoc', 'dte']) ?? '33').trim() || '33',
        folio,
        rut,
        razonSocial: String(buscar(row, ['razon social', 'rznso']) ?? '').trim() || null,
        fecha,
        exento: toNum(buscar(row, ['monto exento', 'mntexe', 'exento'])),
        neto: toNum(buscar(row, ['monto neto', 'mntneto', 'neto'])),
        iva: toNum(buscar(row, ['monto iva recuperable', 'monto iva', 'mntiva', 'iva'])),
        ivaNoRecuperable: toNum(buscar(row, ['monto iva no recuperable', 'iva no recuperable'])),
        total,
      });
    }
    return filas;
  }

  // APIGateway.cl — RCV detalle. dte=0 = todos los tipos de documento en
  // una sola consulta; compras usa estado REGISTRO (los que cuentan como
  // gasto). Auth: token de plataforma en header + RUT/clave del
  // contribuyente en body.auth.pass.
  async function fetchRcvDatos(rut: string, clave: string, rutEmpresa: string | null | undefined, periodo: string, tipo: 'compra' | 'venta') {
    const token = process.env.APIGATEWAY_API_TOKEN;
    if (!token) throw new Error('Falta configurar APIGATEWAY_API_TOKEN en el servidor');
    const yyyymm = periodo.replace('-', '');
    const contribuyente = rutEmpresa || rut; // el RUT cuyo RCV se consulta (path)
    const url = tipo === 'compra'
      ? `https://app.apigateway.cl/api/v2/sii/rcv/compras/detalle/${contribuyente}/${yyyymm}/0/REGISTRO`
      : `https://app.apigateway.cl/api/v2/sii/rcv/ventas/detalle/${contribuyente}/${yyyymm}/0`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ auth: { pass: { rut, clave } } }),
    });
    const json: any = await resp.json().catch(() => null);
    if (!resp.ok || json?.success === false) {
      throw new Error(`SII/${tipo}: ${json?.message || json?.error || `HTTP ${resp.status}`}`);
    }
    return Array.isArray(json?.data) ? json.data : (json?.data?.datos || []);
  }

  app.post('/sii-sync', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const body = z.object({
      periodo: z.string().regex(/^\d{4}-\d{2}$/, 'período YYYY-MM'),
      tipo: z.enum(['COMPRAS', 'VENTAS', 'AMBOS']).default('AMBOS'),
      moneda: z.string().max(5).default('CLP'),
      centroCostoId: z.string().uuid().optional().nullable(),
      diasVencimiento: z.number().int().min(0).max(365).default(30),
      categoriaDefault: z.string().max(50).default('OTRO'),
      tipoGastoDefault: z.enum(['OPERATIVO', 'ESTRUCTURA', 'OTRO']).default('OPERATIVO'),
    }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Validation failed', details: body.error.issues });
    const { periodo, tipo, moneda, centroCostoId, diasVencimiento, categoriaDefault, tipoGastoDefault } = body.data;

    // Credenciales SII del tenant (cifradas en resultadosConfig.sii)
    const t = await app.prisma.tenant.findUnique({ where: { id: tenantId }, select: { resultadosConfig: true } });
    const sii = (t?.resultadosConfig as any)?.sii;
    if (!sii?.rut || !sii?.claveEnc) {
      return reply.code(400).send({ error: 'Credenciales SII no configuradas. Cargá RUT y clave en la pestaña Importar.' });
    }
    let clave: string;
    try { clave = decryptApiKey(sii.claveEnc); }
    catch { return reply.code(500).send({ error: 'No se pudo descifrar la clave SII guardada. Volvé a guardarla.' }); }

    const user = await resolveUser(app.prisma, (req as any).auth?.userId);
    const p = prisma();
    const tipos: Array<'compra' | 'venta'> = tipo === 'AMBOS' ? ['venta', 'compra'] : [tipo === 'VENTAS' ? 'venta' : 'compra'];
    const resultado: Record<string, any> = {};

    for (const tipoRcv of tipos) {
      try {
        const datos = await fetchRcvDatos(normalizarRut(sii.rut), clave, sii.rutEmpresa ? normalizarRut(sii.rutEmpresa) : null, periodo, tipoRcv);
        const filas = rcvDatosToFilas(datos);
        const r = await ingestarFilasRcv(p, tenantId, user, {
          tipo: tipoRcv === 'venta' ? 'VENTAS' : 'COMPRAS', moneda, centroCostoId,
          diasVencimiento, categoriaDefault, tipoGastoDefault, filas, origen: 'IMPORT_SII_AUTO',
        });
        resultado[tipoRcv] = { documentos: datos.length, filasValidas: filas.length, ...r };
      } catch (e: any) {
        resultado[tipoRcv] = { error: e?.message?.slice(0, 200) || 'error' };
      }
    }
    return reply.send({ ok: true, periodo, resultado });
  });

  // ═══════════════════════════════════════════════════════════════
  // F29 — declaración real del mes en el SII (vía APIGateway.cl).
  // Sirve para cruzar el "a pagar estimado" de la tarjeta IVA contra
  // lo que el contador efectivamente declaró: vigente, rectificada,
  // con observaciones o sin presentar.
  // ═══════════════════════════════════════════════════════════════
  async function fetchF29Listado(rut: string, clave: string, rutEmpresa: string | null | undefined, periodo: string) {
    const token = process.env.APIGATEWAY_API_TOKEN;
    if (!token) throw new Error('Falta configurar APIGATEWAY_API_TOKEN en el servidor');
    const yyyymm = periodo.replace('-', '');
    // F29: el contribuyente va en auth.pass (no en el path como el RCV)
    const rutDeclarante = rutEmpresa || rut;
    const url = `https://app.apigateway.cl/api/v2/sii/f29/declaraciones/listado/${yyyymm}`;
    const llamar = async () => {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ auth: { pass: { rut: rutDeclarante, clave } } }),
      });
      const raw = await resp.text();
      let json: any = null;
      try { json = JSON.parse(raw); } catch { /* html/texto */ }
      // Período sin tabla en el SII (aún no declarable / sin nada declarado):
      // el scraper de APIGateway tira timeout 10s → 400. No es un error real.
      if (resp.status === 400 && (json?.detail || '').includes('tabla de declaraciones')) {
        return [];
      }
      if (!resp.ok || json?.success === false) {
        // Log completo: el "HTTP 400" solo esconde el motivo real (rate limit, sesión activa, etc.)
        console.error(`[f29] ${yyyymm} → HTTP ${resp.status} body:`, raw.slice(0, 500));
        const err: any = new Error(`SII/F29: ${json?.message || json?.error || `HTTP ${resp.status}`}`);
        err.status = resp.status;
        throw err;
      }
      return Array.isArray(json?.data) ? json.data : [];
    };
    try {
      return await llamar();
    } catch (e: any) {
      // Un solo retry: el SII puede rechazar un login si la sesión anterior no liberó todavía
      if (e?.status === 400 || e?.status === 429) {
        await new Promise(r => setTimeout(r, 4000));
        return await llamar();
      }
      throw e;
    }
  }

  // Cache F29 por tenant+período (6h) + dedup en vuelo: cada consulta abre
  // sesión al SII y dos logins simultáneos responden HTTP 400 — la segunda
  // request espera el resultado de la primera en vez de disparar otra sesión.
  const f29Cache = new Map<string, { payload: any; ts: number }>();
  const f29InFlight = new Map<string, Promise<any>>();
  const F29_TTL_MS = 6 * 3600 * 1000;

  // Credenciales SII del tenant (rut login + rut declarante + clave descifrada)
  async function getSiiAuth(tenantId: string): Promise<{ rutLogin: string; rutEmpresa: string | null; clave: string } | null> {
    const t = await app.prisma.tenant.findUnique({ where: { id: tenantId }, select: { resultadosConfig: true } });
    const sii = (t?.resultadosConfig as any)?.sii;
    if (!sii?.rut || !sii?.claveEnc) return null;
    let clave: string;
    try { clave = decryptApiKey(sii.claveEnc); }
    catch { throw new Error('No se pudo descifrar la clave SII guardada. Volvé a guardarla.'); }
    return { rutLogin: normalizarRut(sii.rut), rutEmpresa: sii.rutEmpresa ? normalizarRut(sii.rutEmpresa) : null, clave };
  }

  // POST genérico a APIGateway con credenciales SII (auth.pass)
  function f29ApiPost(path: string, rut: string, clave: string) {
    const token = process.env.APIGATEWAY_API_TOKEN;
    if (!token) throw new Error('Falta configurar APIGATEWAY_API_TOKEN en el servidor');
    return fetch(`https://app.apigateway.cl/api/v2${path}`, {
      method: 'POST',
      headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ auth: { pass: { rut, clave } } }),
    });
  }

  // Dedup genérico: si hay una promesa en vuelo para la key, se comparte
  async function deduped<T>(map: Map<string, Promise<any>>, key: string, fn: () => Promise<T>): Promise<T> {
    const p = map.get(key);
    if (p) return p;
    const c = fn();
    map.set(key, c);
    try { return await c; } finally { map.delete(key); }
  }

  // Listado de declaraciones del período con cache + dedup (compartido por
  // /f29 y /f29/montos). La promesa se registra sincrónicamente, antes de
  // cualquier await — si no, una request que llega durante el await de
  // prisma pasaría el check de enVuelo y dispararía otro login al SII.
  async function f29Listado(tenantId: string, periodo: string): Promise<any> {
    const cacheKey = `${tenantId}:${periodo}`;
    const cached = f29Cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < F29_TTL_MS) return cached.payload;
    return deduped(f29InFlight, cacheKey, async () => {
      const auth = await getSiiAuth(tenantId);
      if (!auth) return { configurado: false, declarado: null, declaraciones: [] };
      const declaraciones = await fetchF29Listado(auth.rutLogin, auth.clave, auth.rutEmpresa, periodo);
      // La última de la lista es la vigente (las anteriores son rectificadas/historial)
      const norm = declaraciones.map((d: any) => ({
        folio: d.folio ?? null,
        periodo: d.periodo ?? null,
        rut: d.rut ?? null,
        fecha: d.fecha ?? d.fecha_hora ?? null,
        estado: d.estado ?? null,
      }));
      const payload = { configurado: true, periodo, declarado: norm.length > 0, declaraciones: norm, vigente: norm[norm.length - 1] || null };
      f29Cache.set(cacheKey, { payload, ts: Date.now() });
      return payload;
    });
  }

  app.get('/f29', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const q = req.query as any;
    if (!/^\d{4}-\d{2}$/.test(q.periodo || '')) return reply.code(400).send({ error: 'periodo YYYY-MM requerido' });
    const cacheKey = `${tenantId}:${q.periodo}`;
    const cached = f29Cache.get(cacheKey);
    try {
      return reply.send(await f29Listado(tenantId, q.periodo));
    } catch (e: any) {
      // Si el SII tira error transitorio pero teníamos dato cacheado, servirlo stale
      if (cached) return reply.send({ ...cached.payload, stale: true });
      return reply.send({ configurado: true, periodo: q.periodo, declarado: null, error: e?.message?.slice(0, 200) || 'error', declaraciones: [] });
    }
  });

  // ── Estados de TODOS los períodos (una sola consulta al SII) ──────────────
  const f29EstadosCache = new Map<string, { payload: any; ts: number }>();
  const f29EstadosInFlight = new Map<string, Promise<any>>();
  app.get('/f29/estados', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const cached = f29EstadosCache.get(tenantId);
    if (cached && Date.now() - cached.ts < F29_TTL_MS) return reply.send(cached.payload);
    try {
      const payload = await deduped(f29EstadosInFlight, tenantId, async () => {
        const auth = await getSiiAuth(tenantId);
        if (!auth) return { configurado: false, periodos: [] };
        const resp = await f29ApiPost('/sii/f29/obtener_estados', auth.rutEmpresa || auth.rutLogin, auth.clave);
        const raw = await resp.text();
        let json: any = null; try { json = JSON.parse(raw); } catch { /* no-json */ }
        if (!resp.ok) throw new Error(`SII/F29 estados: ${json?.detail || json?.message || `HTTP ${resp.status}`}`);
        const periodos = (Array.isArray(json?.data) ? json.data : []).map((p: any) => ({
          periodo: p.periodo ?? null, declarado: !!p.declarado, estado: p.estado ?? null,
        }));
        const out = { configurado: true, periodos };
        f29EstadosCache.set(tenantId, { payload: out, ts: Date.now() });
        return out;
      });
      return reply.send(payload);
    } catch (e: any) {
      if (cached) return reply.send({ ...cached.payload, stale: true });
      return reply.send({ configurado: true, periodos: [], error: e?.message?.slice(0, 200) || 'error' });
    }
  });

  // ── Detalle de una declaración por folio (historial de eventos) ───────────
  const f29DetalleCache = new Map<string, { payload: any; ts: number }>();
  const f29DetalleInFlight = new Map<string, Promise<any>>();
  app.get('/f29/detalle', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const folio = String((req.query as any).folio || '').replace(/\D/g, '');
    if (!folio) return reply.code(400).send({ error: 'folio requerido' });
    const cacheKey = `${tenantId}:${folio}`;
    const cached = f29DetalleCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < F29_TTL_MS) return reply.send(cached.payload);
    try {
      const payload = await deduped(f29DetalleInFlight, cacheKey, async () => {
        const auth = await getSiiAuth(tenantId);
        if (!auth) return { configurado: false };
        const resp = await f29ApiPost(`/sii/f29/detalles_declaracion/${folio}`, auth.rutEmpresa || auth.rutLogin, auth.clave);
        const raw = await resp.text();
        let json: any = null; try { json = JSON.parse(raw); } catch { /* no-json */ }
        if (!resp.ok) throw new Error(`SII/F29 detalle: ${json?.detail || json?.message || `HTTP ${resp.status}`}`);
        const d = json?.data || {};
        const out = {
          configurado: true,
          folio: d.folio ?? folio,
          periodo: d.periodo ?? null,
          fechaHora: d.fecha_hora ?? d.fechaHora ?? null,
          estado: d.estado ?? null,
          historial: (Array.isArray(d.historial) ? d.historial : []).map((h: any) => ({ fecha: h.fecha ?? null, descripcion: h.descripcion ?? null })),
        };
        f29DetalleCache.set(cacheKey, { payload: out, ts: Date.now() });
        return out;
      });
      return reply.send(payload);
    } catch (e: any) {
      if (cached) return reply.send({ ...cached.payload, stale: true });
      return reply.send({ configurado: true, error: e?.message?.slice(0, 200) || 'error' });
    }
  });

  // ── PDF de la declaración (compacto o certificado solemne) ────────────────
  const f29PdfCache = new Map<string, { buf: Buffer; ts: number }>();
  const f29PdfInFlight = new Map<string, Promise<any>>();
  async function f29PdfBytes(tenantId: string, folio: string, tipo: 'compacto' | 'solemne'): Promise<Buffer> {
    const cacheKey = `${tenantId}:${tipo}:${folio}`;
    const cached = f29PdfCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < F29_TTL_MS) return cached.buf;
    return deduped(f29PdfInFlight, cacheKey, async () => {
      const auth = await getSiiAuth(tenantId);
      if (!auth) throw new Error('Sin credenciales SII configuradas');
      const recurso = tipo === 'solemne' ? 'certificado_solemne' : 'formulario_compacto';
      const resp = await f29ApiPost(`/sii/f29/${recurso}/pdf/${folio}`, auth.rutEmpresa || auth.rutLogin, auth.clave);
      if (!resp.ok) {
        const raw = await resp.text();
        let json: any = null; try { json = JSON.parse(raw); } catch { /* pdf/html */ }
        throw new Error(`SII/F29 pdf: ${json?.detail || json?.message || `HTTP ${resp.status}`}`);
      }
      const buf = Buffer.from(await resp.arrayBuffer());
      if (!buf.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw new Error('La respuesta del SII no fue un PDF válido');
      f29PdfCache.set(cacheKey, { buf, ts: Date.now() });
      return buf;
    });
  }

  app.get('/f29/pdf', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const q = req.query as any;
    const folio = String(q.folio || '').replace(/\D/g, '');
    if (!folio) return reply.code(400).send({ error: 'folio requerido' });
    const tipo = q.tipo === 'solemne' ? 'solemne' : 'compacto';
    try {
      const buf = await f29PdfBytes(tenantId, folio, tipo);
      reply.header('Content-Type', 'application/pdf');
      reply.header('Content-Disposition', `attachment; filename="F29_${tipo}_${folio}.pdf"`);
      return reply.send(buf);
    } catch (e: any) {
      return reply.code(502).send({ error: e?.message?.slice(0, 200) || 'error' });
    }
  });

  // ── Montos declarados: PDF compacto → texto → códigos del F29 ─────────────
  // El F29 compacto lista cada línea como "código  descripción  valor" (valor
  // con puntos de miles). Se mapean los códigos conocidos y se devuelve el
  // resto crudo para inspección.
  const F29_CODES: Record<string, string> = {
    '502': 'Débitos facturas emitidas', '538': 'Total débitos',
    '511': 'Crédito IVA dctos. electrónicos', '537': 'Total créditos',
    '077': 'Remanente crédito mes anterior', '062': 'PPM neto determinado',
    '089': 'IVA determinado', '091': 'Total a pagar', '547': 'Total determinado',
    '151': 'Retención honorarios', '048': 'Retención imp. único trab.',
    '563': 'Base imponible retenida',
  };
  function parseF29PdfText(text: string): Record<string, { descripcion: string; valor: number }> {
    const codigos: Record<string, { descripcion: string; valor: number }> = {};
    for (const raw of (text || '').split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) continue;
      // pdf-parse entrega las columnas PEGADAS: "502DÉBITOS FACTURAS EMITIDAS12.280.547".
      // código (2-4 díg) + glosa (lazy, puede contener dígitos) + valor trailing.
      // El lazy + ancla $ hace que la glosa crezca solo hasta que el resto sea numérico.
      const m = line.match(/^\[?(\d{2,4})\]?(.*?)(\d[\d.]*)$/);
      if (m && m[2]) {
        // "0.125" (cero inicial) = tasa decimal; "77.582.200" = miles con puntos
        const numStr = m[3].replace(/\.$/, '');
        const valor = /^0\.\d+$/.test(numStr) ? parseFloat(numStr) : parseInt(numStr.replace(/\./g, ''), 10);
        if (Number.isFinite(valor) && !codigos[m[1]]) {
          const desc = m[2].replace(/[.\s]{3,}/g, ' ').trim();
          codigos[m[1]] = { descripcion: desc || F29_CODES[m[1]] || '', valor };
        }
      }
    }
    return codigos;
  }

  const f29MontosCache = new Map<string, { payload: any; ts: number }>();
  const f29MontosInFlight = new Map<string, Promise<any>>();
  app.get('/f29/montos', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const q = req.query as any;
    if (!/^\d{4}-\d{2}$/.test(q.periodo || '')) return reply.code(400).send({ error: 'periodo YYYY-MM requerido' });
    const cacheKey = `${tenantId}:${q.periodo}`;
    const cached = f29MontosCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < F29_TTL_MS) return reply.send(cached.payload);
    try {
      const payload = await deduped(f29MontosInFlight, cacheKey, async () => {
        const lst = await f29Listado(tenantId, q.periodo);
        if (!lst.configurado) return { configurado: false };
        if (!lst.vigente?.folio) return { configurado: true, periodo: q.periodo, montos: null, motivo: 'sin declaración vigente' };
        const buf = await f29PdfBytes(tenantId, lst.vigente.folio, 'compacto');
        const parsed = await pdfParse(buf);
        const codigos = parseF29PdfText(parsed?.text || '');
        const n = Object.keys(codigos).length;
        if (!n) console.error(`[f29-montos] parse vacío folio ${lst.vigente.folio}, texto:`, (parsed?.text || '').slice(0, 1200));
        const cod = (c: string) => codigos[c]?.valor ?? null;
        const out = {
          configurado: true,
          periodo: q.periodo,
          folio: lst.vigente.folio,
          principales: {
            baseVentas: cod('502'), debito: cod('538'), credito: cod('537') ?? cod('511'),
            remanente: cod('077'), ppm: cod('062'), retencion: cod('151') ?? cod('048'), totalPagar: cod('091') ?? cod('547'),
          },
          codigos,
          nCodigos: n,
        };
        f29MontosCache.set(cacheKey, { payload: out, ts: Date.now() });
        return out;
      });
      return reply.send(payload);
    } catch (e: any) {
      if (cached) return reply.send({ ...cached.payload, stale: true });
      return reply.send({ configurado: true, periodo: q.periodo, error: e?.message?.slice(0, 200) || 'error' });
    }
  });
  app.get('/informe-ejecutivo', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const q = req.query as any;
    const hoy = new Date();
    const anio = Number(q.anio) || hoy.getUTCFullYear();
    const mes = q.mes ? Number(q.mes) : null;
    const moneda = q.moneda || null;
    const cc = q.centroCostoId || null;

    const fwd: Record<string, string> = {};
    if (req.headers.authorization) fwd.authorization = req.headers.authorization;
    if (req.headers.cookie) fwd.cookie = req.headers.cookie as string;
    if (req.headers['x-tenant-id']) fwd['x-tenant-id'] = req.headers['x-tenant-id'] as string;

    const call = async (path: string) => {
      try {
        const r = await app.inject({ method: 'GET', url: `/finanzas${path}`, headers: fwd });
        return r.statusCode < 400 ? r.json() : null;
      } catch { return null; }
    };

    const ccQ = cc ? `&centroCostoId=${cc}` : '';
    const monQ = moneda ? `&moneda=${moneda}` : '';
    const mesQ = mes ? `&mes=${mes}` : `&mes=${hoy.getUTCMonth() + 1}`;
    const mesKey = mes ? `${anio}-${String(mes).padStart(2, '0')}` : `${anio}-${String(hoy.getUTCMonth() + 1).padStart(2, '0')}`;

    const [res, alerts, cxc, cxp, caja, rent, pe, proy, comentarios] = await Promise.all([
      call(`/resultado-mensual?anio=${anio}${monQ}${ccQ}`),
      call(`/alertas?anio=${anio}${mesQ}${monQ}${ccQ}`),
      call(`/cuentas-por-cobrar?${monQ}`),
      call(`/cuentas-por-pagar?${monQ}`),
      call(`/flujo-caja?${monQ}`),
      call(`/rentabilidad?anio=${anio}${monQ}${ccQ}`),
      call(`/punto-equilibrio?anio=${anio}${monQ}${ccQ}`),
      call(`/proyeccion-cierre?anio=${anio}${mesQ}${monQ}${ccQ}`),
      call(`/comentarios-periodo?mesKey=${mesKey}${ccQ}`),
    ]);

    const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const periodo = mes ? `${MESES[mes - 1]} ${anio}` : `Año ${anio}`;
    const fm = (n: number | null | undefined) => n === null || n === undefined ? '—' : `${moneda || ''} ${Math.round(n).toLocaleString('es-AR')}`.trim();
    const fp = (n: number | null | undefined) => n === null || n === undefined ? '—' : `${n.toFixed(1)} %`;
    const esc = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const signo = (n: number | null | undefined) => (n ?? 0) >= 0 ? 'var(--ok)' : 'var(--bad)';

    const tenant = await prisma().tenant.findUnique({ where: { id: tenantId }, select: { nombre: true, name: true } }).catch(() => null);
    const empresa = esc(tenant?.nombre || tenant?.name || 'Empresa');

    // Mes del informe (o acumulado anual si no hay mes)
    const mm = mes ? (res?.meses || []).find((m: any) => m.mes === mes) : null;
    const acum = res?.totales;
    const datos = mm || (acum ? { ventas: acum.ventas, cobrado: acum.cobrado, costosTotales: acum.costos, resultado: acum.resultado, margen: acum.margen, porRubro: acum.porRubro, mesesPositivos: acum.mesesPositivos, mesesNegativos: acum.mesesNegativos } : null);

    // Comparativa vs mes anterior
    let compHtml = '';
    if (mes && mm && res?.meses?.length) {
      const prev = res.meses.find((m: any) => m.mes === mes - 1) || (mes === 1 ? null : null);
      const varPct = (a: number, b: number) => b !== 0 ? (((a - b) / Math.abs(b)) * 100).toFixed(1) : null;
      if (prev) compHtml = `<table><tr><th></th><th>${MESES[mes - 1]}</th><th>${MESES[mes - 2]}</th><th>Var</th></tr>
        ${[['Facturación', 'ventas'], ['Costos', 'costosTotales'], ['Resultado', 'resultado'], ['Cobrado', 'cobrado']].map(([l, k]) => {
          const v = varPct(mm[k], prev[k]);
          return `<tr><td>${l}</td><td class="num">${fm(mm[k])}</td><td class="num">${fm(prev[k])}</td><td class="num" style="color:${signo(mm[k] - prev[k])}">${v !== null ? (Number(v) >= 0 ? '+' : '') + v + ' %' : '—'}</td></tr>`;
        }).join('')}</table>`;
    }

    // Mejor / peor mes
    let mpHtml = '';
    if (res?.meses?.length > 1) {
      const conVentas = res.meses.filter((m: any) => m.ventas > 0 || m.costosTotales > 0);
      if (conVentas.length) {
        const mejor = [...conVentas].sort((a: any, b: any) => b.resultado - a.resultado)[0];
        const peor = [...conVentas].sort((a: any, b: any) => a.resultado - b.resultado)[0];
        const prom = conVentas.reduce((s: number, m: any) => s + m.resultado, 0) / conVentas.length;
        mpHtml = `<div class="grid3"><div class="card"><div class="lbl">Mejor mes</div><div class="val" style="color:var(--ok)">${MESES[mejor.mes - 1]} · ${fm(mejor.resultado)}</div><div class="sub">margen ${fp(mejor.margen)}</div></div>
          <div class="card"><div class="lbl">Peor mes</div><div class="val" style="color:var(--bad)">${MESES[peor.mes - 1]} · ${fm(peor.resultado)}</div><div class="sub">margen ${fp(peor.margen)}</div></div>
          <div class="card"><div class="lbl">Promedio mensual</div><div class="val">${fm(prom)}</div><div class="sub">${conVentas.length} meses con datos</div></div></div>`;
      }
    }

    // Principales costos (por rubro del período o del año)
    const rubros = Object.entries((datos?.porRubro || {}) as Record<string, number>).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const rubHtml = rubros.length ? `<table><tr><th>Rubro</th><th class="num">Importe</th><th class="num">% costos</th></tr>
      ${rubros.map(([r, v]) => `<tr><td>${esc(r)}</td><td class="num">${fm(v)}</td><td class="num">${datos!.costosTotales ? ((v / datos!.costosTotales) * 100).toFixed(1) + ' %' : '—'}</td></tr>`).join('')}</table>` : '<p class="muted">Sin costos en el período.</p>';

    // Alertas
    const alertasList = alerts?.alertas || [];
    const alHtml = alertasList.length ? `<table><tr><th>Severidad</th><th>Alerta</th><th class="num">Impacto</th></tr>
      ${alertasList.map((a: any) => `<tr><td><span class="sev ${a.severidad}">${a.severidad}</span></td><td>${esc(a.mensaje)}</td><td class="num">${fm(a.impacto)}</td></tr>`).join('')}</table>` : '<p class="muted">Sin alertas en el período.</p>';

    // Rentabilidad por cliente (top + negativos)
    let rentHtml = '<p class="muted">Sin datos de rentabilidad.</p>';
    if (rent?.porCliente?.length) {
      const neg = rent.porCliente.filter((f: any) => (f.resultado ?? 0) < 0);
      rentHtml = `<table><tr><th>Cliente</th><th class="num">Facturación</th><th class="num">Costos</th><th class="num">Resultado</th><th class="num">Margen</th></tr>
        ${rent.porCliente.slice(0, 15).map((f: any) => `<tr${(f.resultado ?? 0) < 0 ? ' class="neg"' : ''}><td>${esc(f.nombre)}</td><td class="num">${fm(f.ventas)}</td><td class="num">${f.costos === null ? '—' : fm(f.costos)}</td><td class="num" style="color:${signo(f.resultado)}">${f.resultado === null ? '—' : fm(f.resultado)}</td><td class="num" style="color:${signo(f.margen)}">${fp(f.margen)}</td></tr>`).join('')}</table>
        ${neg.length ? `<p class="warn">⚠ ${neg.length} cliente(s) con margen negativo: ${esc(neg.map((f: any) => f.nombre).join(', '))}</p>` : ''}
        ${rent.notaCostos ? `<p class="muted">${esc(rent.notaCostos)}</p>` : ''}`;
    }

    // Punto de equilibrio
    let peHtml = '<p class="muted">No hay suficiente información para el punto de equilibrio.</p>';
    if (pe?.peMensual != null) {
      const vs = pe.vsPuntoEquilibrio;
      peHtml = `<div class="grid3"><div class="card"><div class="lbl">Punto de equilibrio</div><div class="val">${fm(pe.peMensual)}/mes</div><div class="sub">facturación mínima para no perder</div></div>
        <div class="card"><div class="lbl">Costos fijos / variables</div><div class="val">${fm(pe.costosFijos)} / ${fm(pe.costosVariables)}</div><div class="sub">${pe.sinClasificar > 0 ? `${fm(pe.sinClasificar)} sin clasificar` : 'todo clasificado'}</div></div>
        <div class="card"><div class="lbl">Estado</div><div class="val" style="color:${(vs ?? 0) >= 0 ? 'var(--ok)' : 'var(--bad)'}">${vs === null ? '—' : `${Math.abs(vs).toFixed(1)} % ${vs >= 0 ? 'por encima' : 'por debajo'}`}</div><div class="sub">ventas prom. ${fm(pe.ventasMensualProm)}</div></div></div>`;
    }

    // Proyección de cierre
    let proyHtml = '';
    if (proy?.esMesActual) {
      proyHtml = `<div class="card" style="margin-bottom:12px"><div class="lbl">Proyección de cierre ${MESES[(proy.mes || 1) - 1]}</div>
        <div class="val" style="color:${signo(proy.resultadoProyectado)}">${fm(proy.resultadoProyectado)} <span class="sub">(margen ${fp(proy.margenProyectado)})</span></div>
        <div class="sub">Confianza ${proy.confianzaLabel} — ${proy.confianza} % respaldado por datos reales/compromisos</div></div>
        <table><tr><th></th><th class="num">Real</th><th class="num">Compromisos</th><th class="num">Estimación</th><th class="num">Proyectado</th></tr>
        <tr><td>Ventas</td><td class="num">${fm(proy.ventas.real)}</td><td class="num">${fm(proy.ventas.compromisos)}</td><td class="num">${fm(proy.ventas.estimacion)}</td><td class="num"><b>${fm(proy.ventas.proyectado)}</b></td></tr>
        <tr><td>Costos</td><td class="num">${fm(proy.costos.real)}</td><td class="num">${fm(proy.costos.compromisos)}</td><td class="num">${fm(proy.costos.estimacion)}</td><td class="num"><b>${fm(proy.costos.proyectado)}</b></td></tr></table>`;
    }

    // Comentarios del período
    const comHtml = (comentarios?.comentarios || []).length ? `<div class="comentario">${comentarios.comentarios.map((c: any) => `<p>“${esc(c.texto)}”</p><p class="muted">— ${esc(c.createdByNombre || 'Anónimo')} · ${new Date(c.createdAt).toLocaleDateString('es-AR')}${c.updatedAt && c.updatedAt !== c.createdAt ? ' (editado)' : ''}</p>`).join('<hr style="border:none;border-top:1px solid #eee;margin:8px 0">')}</div>` : '';

    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Informe Ejecutivo — ${periodo}</title>
<style>
:root{--ok:#15803d;--bad:#b91c1c;--muted:#737373}
*{box-sizing:border-box}body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#171717;margin:0;padding:32px;max-width:900px;font-size:13px}
h1{font-size:20px;margin:0}h2{font-size:14px;margin:24px 0 8px;border-bottom:2px solid #171717;padding-bottom:4px}
.hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #171717;padding-bottom:12px;margin-bottom:16px}
.muted{color:var(--muted);font-size:11px}.warn{color:#b45309;font-size:12px;margin:8px 0}
.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:8px}
.grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:8px}
.card{border:1px solid #e5e5e5;border-radius:8px;padding:10px}
.lbl{font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}
.val{font-size:18px;font-weight:700;margin-top:2px}.sub{font-size:11px;color:var(--muted);font-weight:400}
table{width:100%;border-collapse:collapse;margin:6px 0;font-size:12px}
th{text-align:left;font-size:10px;text-transform:uppercase;color:var(--muted);border-bottom:1px solid #e5e5e5;padding:4px 6px}
td{padding:4px 6px;border-bottom:1px solid #f5f5f5}.num{text-align:right;font-variant-numeric:tabular-nums}
tr.neg td{background:#fef2f2}
.sev{font-size:10px;font-weight:700;padding:1px 6px;border-radius:8px}
.sev.CRITICA{background:#fee2e2;color:#b91c1c}.sev.ATENCION{background:#fef3c7;color:#b45309}.sev.INFO{background:#dcfce7;color:#15803d}
.comentario{background:#fafaf9;border-left:3px solid #a3a3a3;padding:10px 14px;border-radius:0 8px 8px 0;margin:8px 0;font-style:italic}
.btn{position:fixed;top:12px;right:12px;background:#171717;color:#fff;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:12px}
@media print{.btn{display:none}body{padding:0}}
</style></head><body>
<button class="btn" onclick="window.print()">Imprimir / PDF</button>
<div class="hdr"><div><h1>Informe Ejecutivo — Resultado de Negocio</h1><div class="muted">${empresa} · ${periodo}${moneda ? ` · ${moneda}` : ''}${cc ? ' · filtrado por centro de costo' : ''}</div></div>
<div class="muted" style="text-align:right">Generado ${new Date().toLocaleString('es-AR')}<br>SGI360 · Datos del sistema</div></div>

<h2>Resultado del período</h2>
${datos ? `<div class="grid4">
<div class="card"><div class="lbl">Ventas</div><div class="val">${fm(datos.ventas)}</div></div>
<div class="card"><div class="lbl">Costos</div><div class="val">${fm(datos.costosTotales)}</div></div>
<div class="card"><div class="lbl">Resultado</div><div class="val" style="color:${signo(datos.resultado)}">${fm(datos.resultado)}</div><div class="sub">margen ${fp(datos.margen)}</div></div>
<div class="card"><div class="lbl">Cobrado</div><div class="val">${fm(datos.cobrado)}</div></div></div>
${!mes && datos.mesesPositivos !== undefined ? `<p class="muted">Meses positivos: ${datos.mesesPositivos} · negativos: ${datos.mesesNegativos}</p>` : ''}` : '<p class="muted">Sin datos para el período.</p>'}

${compHtml ? `<h2>Comparación con el mes anterior</h2>${compHtml}` : ''}
${mpHtml ? `<h2>Récord del año</h2>${mpHtml}` : ''}
${proyHtml ? `<h2>Proyección de cierre</h2>${proyHtml}` : ''}
${comHtml ? `<h2>Comentario del período</h2>${comHtml}` : ''}

<h2>Cuentas por cobrar</h2>
${cxc?.totales ? `<div class="grid3"><div class="card"><div class="lbl">Por cobrar</div><div class="val">${fm(cxc.totales.saldo)}</div></div>
<div class="card"><div class="lbl">Vencido</div><div class="val" style="color:${cxc.totales.vencido > 0 ? 'var(--bad)' : 'var(--ok)'}">${fm(cxc.totales.vencido)}</div></div>
<div class="card"><div class="lbl">>90 días</div><div class="val" style="color:${cxc.totales.d90 > 0 ? 'var(--bad)' : 'inherit'}">${fm(cxc.totales.d90)}</div></div></div>
${(cxc.clientes || []).filter((c: any) => c.saldo > 0.5).length ? `<table><tr><th>Cliente</th><th class="num">Saldo</th><th class="num">Vencido</th><th class="num">Paga en ~días</th></tr>
${cxc.clientes.filter((c: any) => c.saldo > 0.5).slice(0, 10).map((c: any) => `<tr><td>${esc(c.cliente)}</td><td class="num">${fm(c.saldo)}</td><td class="num">${fm(c.aging.d1_30 + c.aging.d31_60 + c.aging.d61_90 + c.aging.d90)}</td><td class="num">${c.diasPagoPromedio ?? '—'}</td></tr>`).join('')}</table>` : ''}` : '<p class="muted">Sin cuentas por cobrar.</p>'}

<h2>Cuentas por pagar</h2>
${cxp?.totales ? `<div class="grid4"><div class="card"><div class="lbl">Por pagar</div><div class="val">${fm(cxp.totales.porPagar)}</div></div>
<div class="card"><div class="lbl">Vencido</div><div class="val" style="color:${cxp.totales.vencido > 0 ? 'var(--bad)' : 'var(--ok)'}">${fm(cxp.totales.vencido)}</div></div>
<div class="card"><div class="lbl">Vence 7d</div><div class="val">${fm(cxp.totales.vence7)}</div></div>
<div class="card"><div class="lbl">Vence 30d</div><div class="val">${fm(cxp.totales.vence30)}</div></div></div>
${(cxp.ranking || []).length ? `<table><tr><th>Proveedor</th><th class="num">Saldo</th><th class="num">Vencido</th><th class="num">Docs</th></tr>
${cxp.ranking.slice(0, 10).map((r: any) => `<tr><td>${esc(r.proveedor)}</td><td class="num">${fm(r.saldo)}</td><td class="num" style="color:${r.vencido > 0 ? 'var(--bad)' : 'inherit'}">${fm(r.vencido)}</td><td class="num">${r.cantidad}</td></tr>`).join('')}</table>` : ''}` : '<p class="muted">Sin cuentas por pagar.</p>'}

${caja ? `<h2>Flujo de caja</h2><div class="grid4">
<div class="card"><div class="lbl">Saldo inicial</div><div class="val">${fm(caja.saldoInicial)}</div></div>
<div class="card"><div class="lbl">Cobros</div><div class="val" style="color:var(--ok)">+${fm(caja.cobros)}</div></div>
<div class="card"><div class="lbl">Pagos</div><div class="val" style="color:var(--bad)">-${fm(caja.pagos)}</div></div>
<div class="card"><div class="lbl">Saldo actual</div><div class="val">${fm(caja.saldoActual)}</div></div></div>
${(caja.proyeccion || []).length ? `<table><tr><th>Horizonte</th><th class="num">Cobros prev.</th><th class="num">Pagos prev.</th><th class="num">Saldo proyectado</th></tr>
${caja.proyeccion.map((p: any) => `<tr><td>${p.dias} días</td><td class="num">+${fm(p.cobros)}</td><td class="num">-${fm(p.pagos)}</td><td class="num"><b>${fm(p.saldoProyectado)}</b></td></tr>`).join('')}</table>` : ''}` : ''}

<h2>Principales costos${mes ? ' del mes' : ' del año'}</h2>${rubHtml}
<h2>Rentabilidad por cliente</h2>${rentHtml}
<h2>Punto de equilibrio</h2>${peHtml}
<h2>Alertas gerenciales</h2>${alHtml}

<p class="muted" style="margin-top:24px;border-top:1px solid #e5e5e5;padding-top:8px">Documento generado automáticamente por SGI360 — Resultado de Negocio. Los importes corresponden a la moneda seleccionada sin conversión. Los datos proyectados están diferenciados de los reales.</p>
</body></html>`;

    reply.header('content-type', 'text/html; charset=utf-8');
    return reply.send(html);
  });

  // ═══════════════════════════════════════════════════════════════
  // JOBS PROGRAMADOS — informe ejecutivo mensual + alertas proactivas.
  // Vive dentro del plugin para reutilizar recolectarLineas /
  // calcularAlertas / obtenerCxPInterno. Corre cada hora; la dedupe se
  // persiste en resultadosConfig para sobrevivir reinicios.
  // ═══════════════════════════════════════════════════════════════
  const tickFinanzas = async () => {
    const p = prisma();
    const hoy = new Date();
    const mesKeyHoy = `${hoy.getUTCFullYear()}-${String(hoy.getUTCMonth() + 1).padStart(2, '0')}`;
    const hoyKey = hoy.toISOString().slice(0, 10);
    // Mes anterior (período del informe)
    const prev = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - 1, 1));
    const prevAnio = prev.getUTCFullYear(), prevMes = prev.getUTCMonth() + 1;
    const prevKey = `${prevAnio}-${String(prevMes).padStart(2, '0')}`;
    const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

    const tenants = await p.tenant.findMany({ where: { deletedAt: null }, select: { id: true, nombre: true, name: true, resultadosConfig: true, monedaResultados: true, country: true } }).catch(() => [] as any[]);
    for (const t of tenants) {
      try {
        const conf = ((t.resultadosConfig as any) || {}) as any;
        let dirty = false;

        // ── 1) Informe ejecutivo mensual: día 1, informa el mes anterior.
        const inf = conf.informeEmail;
        const emails: string[] = Array.isArray(inf?.emails) ? inf.emails.filter((e: any) => typeof e === 'string' && e.includes('@')) : [];
        if (inf?.activo && emails.length && hoy.getUTCDate() === 1 && inf.ultimoEnvio !== prevKey) {
          const moneda = inf.moneda || t.monedaResultados || (t.country ? MONEDA_PAIS[t.country] : null) || null;
          const desde = new Date(Date.UTC(prevAnio, prevMes - 1, 1));
          const hasta = new Date(Date.UTC(prevAnio, prevMes, 1));
          const [lineasInf, alertasInf, cxpInf, cxcFacts] = await Promise.all([
            recolectarLineas(t.id, desde, hasta, moneda, null).catch(() => [] as any[]),
            calcularAlertas(t.id, prevAnio, prevMes, moneda, null).catch(() => ({ alertas: [] } as any)),
            obtenerCxPInterno(p, t.id, moneda).catch(() => [] as any[]),
            p.finanzaFactura.findMany({ where: { tenantId: t.id, deletedAt: null, estado: { in: ['EMITIDA', 'PARCIALMENTE_COBRADA'] }, ...(moneda ? { moneda } : {}) }, include: { cobros: true } }).catch(() => [] as any[]),
          ]);
          const gSum = (g: string[]) => lineasInf.filter(l => g.includes(l.grupo)).reduce((s, l) => s + l.importe, 0);
          const ventas = gSum(['FACTURADO', 'INGRESO_OPERATIVO']);
          const costos = gSum(['COSTO_OP', 'ESTRUCTURA', 'GASTO_MANUAL']);
          const resultado = ventas - costos;
          const cobrado = gSum(['COBRADO']);
          const margen = ventas > 0 ? (resultado / ventas) * 100 : null;
          const porRubro: Record<string, number> = {};
          for (const l of lineasInf) if (['COSTO_OP', 'ESTRUCTURA', 'GASTO_MANUAL'].includes(l.grupo)) porRubro[l.rubro] = (porRubro[l.rubro] || 0) + l.importe;
          const topRubros = Object.entries(porRubro).sort((a, b) => b[1] - a[1]).slice(0, 5);
          const cxpSaldo = cxpInf.reduce((s: number, i: any) => s + num(i.saldo), 0);
          const cxcSaldo = cxcFacts.reduce((s: number, f: any) => {
            const signoF = f.tipoComprobante === 'NOTA_CREDITO' ? -1 : 1;
            const cob = (f.cobros || []).reduce((x: number, c: any) => x + num(c.importe), 0);
            const saldo = signoF * num(f.total) - cob;
            return s + (saldo > 0.5 ? saldo : 0);
          }, 0);
          const fm = (n: number | null) => n === null ? '—' : `${moneda || ''} ${Math.round(n).toLocaleString('es-AR')}`.trim();
          const esc = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          const empresa = esc(t.nombre || t.name || 'Empresa');
          const periodoLbl = `${MESES[prevMes - 1]} ${prevAnio}`;
          const alertasHtml = (alertasInf.alertas || []).length
            ? `<ul style="margin:8px 0;padding-left:18px">${(alertasInf.alertas as any[]).slice(0, 6).map(a => `<li style="margin:4px 0;color:${a.severidad === 'CRITICA' ? '#b91c1c' : a.severidad === 'ATENCION' ? '#b45309' : '#374151'}"><b>[${a.severidad}]</b> ${esc(a.mensaje)}</li>`).join('')}</ul>`
            : '<p style="color:#6b7280">Sin alertas en el período.</p>';
          const rubrosHtml = topRubros.length
            ? `<ul style="margin:8px 0;padding-left:18px">${topRubros.map(([r, v]) => `<li>${esc(r)}: <b>${fm(v)}</b></li>`).join('')}</ul>`
            : '<p style="color:#6b7280">Sin costos en el período.</p>';
          const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:32px 20px;color:#171717">
            <h1 style="font-size:18px;margin:0 0 4px">Informe Ejecutivo — ${periodoLbl}</h1>
            <p style="color:#6b7280;font-size:12px;margin:0 0 20px">${empresa} · generado automáticamente por SGI360</p>
            <table style="width:100%;border-collapse:collapse;font-size:13px">
              <tr><td style="padding:6px 0;border-bottom:1px solid #eee">Ventas netas</td><td style="text-align:right;font-weight:700;border-bottom:1px solid #eee">${fm(ventas)}</td></tr>
              <tr><td style="padding:6px 0;border-bottom:1px solid #eee">Costos totales</td><td style="text-align:right;font-weight:700;border-bottom:1px solid #eee">${fm(costos)}</td></tr>
              <tr><td style="padding:6px 0;border-bottom:1px solid #eee">Resultado</td><td style="text-align:right;font-weight:700;color:${resultado >= 0 ? '#15803d' : '#b91c1c'};border-bottom:1px solid #eee">${fm(resultado)}${margen !== null ? ` (${margen.toFixed(1)} %)` : ''}</td></tr>
              <tr><td style="padding:6px 0;border-bottom:1px solid #eee">Cobrado</td><td style="text-align:right;font-weight:700;border-bottom:1px solid #eee">${fm(cobrado)}</td></tr>
              <tr><td style="padding:6px 0;border-bottom:1px solid #eee">Por cobrar</td><td style="text-align:right;border-bottom:1px solid #eee">${fm(cxcSaldo)}</td></tr>
              <tr><td style="padding:6px 0">Por pagar</td><td style="text-align:right">${fm(cxpSaldo)}</td></tr>
            </table>
            <h3 style="font-size:13px;margin:20px 0 4px">Principales costos</h3>${rubrosHtml}
            <h3 style="font-size:13px;margin:20px 0 4px">Alertas</h3>${alertasHtml}
            <div style="text-align:center;margin:24px 0"><a href="${APP_URL}/resultados" style="background:#171717;color:#fff;padding:10px 22px;border-radius:8px;text-decoration:none;font-size:13px">Ver detalle en SGI360</a></div>
            <p style="color:#9ca3af;font-size:11px;text-align:center">Informe del mes anterior, enviado el día 1. Desactivar en Resultados → Configuración.</p>
          </div>`;
          let enviados = 0;
          for (const to of emails) {
            const r = await sendEmail({ to, subject: `SGI360 — Informe ejecutivo ${periodoLbl}`, html, text: `Informe ejecutivo ${periodoLbl}: ventas ${fm(ventas)}, costos ${fm(costos)}, resultado ${fm(resultado)}.` }).catch(() => ({ success: false }));
            if (r?.success !== false) enviados++;
          }
          if (enviados > 0) { inf.ultimoEnvio = prevKey; dirty = true; }
          app.log.info(`[finanzas-job] informe ejecutivo ${prevKey} enviado a ${enviados}/${emails.length} — tenant ${t.id}`);
        }

        // ── 2) Alertas proactivas: notifica CRITICAS del mes en curso.
        // Dedupe: avisa si cambió el set de tipos críticos o pasaron ≥3 días.
        const aJob = (conf.alertasJob || {}) as any;
        const monedaA = aJob.moneda || t.monedaResultados || (t.country ? MONEDA_PAIS[t.country] : null) || null;
        const res = await calcularAlertas(t.id, hoy.getUTCFullYear(), hoy.getUTCMonth() + 1, monedaA, null).catch(() => null);
        const criticas = ((res?.alertas || []) as any[]).filter(a => a.severidad === 'CRITICA');
        const hash = criticas.map(a => a.tipo).sort().join('|');
        const diasDesde = aJob.ultimoAviso ? Math.round((Date.now() - new Date(aJob.ultimoAviso).getTime()) / 86400000) : 999;
        if (criticas.length && (hash !== aJob.ultimoHash || diasDesde >= 3)) {
          const link = '/resultados';
          const admins = await p.tenantMembership.findMany({ where: { tenantId: t.id, role: { in: ['TENANT_ADMIN', 'ADMIN', 'OWNER'] } }, select: { userId: true } }).catch(() => [] as any[]);
          const titulo = `${criticas.length} alerta(s) crítica(s) en Resultados — ${mesKeyHoy}`;
          const detalle = criticas.slice(0, 4).map((a: any) => `• ${a.mensaje}`).join('\n');
          for (const m of admins) {
            await p.notification.create({
              data: { tenantId: t.id, userId: m.userId, type: 'FINANZAS_ALERTA', title: titulo, message: detalle, link, entityType: 'finanzas', entityId: mesKeyHoy },
            }).catch(() => null);
            const u = await p.platformUser.findUnique({ where: { id: m.userId }, select: { email: true } }).catch(() => null);
            if (u?.email) {
              const esc2 = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
              await sendEmail({
                to: u.email,
                subject: `SGI360 — ${titulo}`,
                text: `${titulo}\n\n${detalle}\n\nVer: ${APP_URL}${link}`,
                html: `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:32px 20px">
                  <div style="background:#fee2e2;border:1px solid #fca5a5;border-radius:10px;padding:20px">
                  <h2 style="font-size:16px;margin:0 0 12px;color:#b91c1c">${esc2(titulo)}</h2>
                  ${criticas.slice(0, 4).map((a: any) => `<p style="margin:6px 0;font-size:13px;color:#374151">• ${esc2(a.mensaje)}</p>`).join('')}
                  </div>
                  <div style="text-align:center;margin:20px 0"><a href="${APP_URL}${link}" style="background:#171717;color:#fff;padding:10px 22px;border-radius:8px;text-decoration:none;font-size:13px">Ver Resultados</a></div>
                </div>`,
              }).catch(() => null);
            }
          }
          conf.alertasJob = { ...aJob, ultimoAviso: hoyKey, ultimoHash: hash };
          dirty = true;
          app.log.info(`[finanzas-job] ${criticas.length} alertas críticas notificadas — tenant ${t.id}`);
        } else if (aJob.ultimoHash && !criticas.length) {
          conf.alertasJob = { ...aJob, ultimoHash: '' };
          dirty = true;
        }

        if (dirty) await p.tenant.update({ where: { id: t.id }, data: { resultadosConfig: conf } }).catch(() => null);
      } catch (e: any) {
        app.log.warn(`[finanzas-job] tenant ${t.id}: ${e?.message || e}`);
      }
    }
  };

  if (!(globalThis as any).__finanzasJobStarted) {
    (globalThis as any).__finanzasJobStarted = true;
    const timer = setInterval(() => { tickFinanzas().catch(e => app.log.warn(`[finanzas-job] ${e?.message || e}`)); }, 60 * 60 * 1000);
    // Primera corrida a los 2 min de arrancar (no en el boot para no competir recursos).
    const kickoff = setTimeout(() => tickFinanzas().catch(e => app.log.warn(`[finanzas-job] ${e?.message || e}`)), 2 * 60 * 1000);
    app.addHook('onClose', async () => { clearInterval(timer); clearTimeout(kickoff); });
  }
}
