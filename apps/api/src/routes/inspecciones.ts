import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getEffectiveTenantId } from '../utils/tenant-bypass.js';
import crypto from 'crypto';
import { notifyInspeccionHallazgo, notifyInspeccionOT } from '../services/notifyService.js';
import ExcelJS from 'exceljs';

const generateToken = () => crypto.randomBytes(20).toString('hex');

const BUILT_IN_TEMPLATES: Record<string, { nombre: string; categoria: string; descripcion: string; items: any[] }> = {
  checklist_camion: {
    nombre: 'Checklist Diario Camión', categoria: 'CAMION',
    descripcion: 'Inspección pre-operacional diaria para vehículos de carga',
    items: [
      { label: 'Nivel de aceite motor', tipo: 'SI_NO', seccion: 'Motor', orden: 1, triggerHallazgo: true },
      { label: 'Nivel de agua / refrigerante', tipo: 'SI_NO', seccion: 'Motor', orden: 2, triggerHallazgo: true },
      { label: 'Estado de frenos', tipo: 'SI_NO', seccion: 'Frenos', orden: 3, triggerHallazgo: true },
      { label: 'Presión de neumáticos', tipo: 'SI_NO', seccion: 'Neumáticos', orden: 4, triggerHallazgo: true },
      { label: 'Luces delanteras y traseras', tipo: 'SI_NO', seccion: 'Electricidad', orden: 5, triggerHallazgo: false },
      { label: 'Cinturón de seguridad', tipo: 'SI_NO', seccion: 'Seguridad', orden: 6, triggerHallazgo: true },
      { label: 'Extintor en cabina', tipo: 'SI_NO', seccion: 'Seguridad', orden: 7, triggerHallazgo: true },
      { label: 'Documentación al día', tipo: 'SI_NO', seccion: 'Documentación', orden: 8, triggerHallazgo: true },
      { label: 'Observaciones', tipo: 'TEXTO', seccion: 'General', orden: 9, isRequerido: false },
    ],
  },
  checklist_autoelevador: {
    nombre: 'Inspección Autoelevador', categoria: 'AUTOELEVADOR',
    descripcion: 'Inspección pre-turno de autoelevadores / montacargas',
    items: [
      { label: 'Nivel combustible / carga batería', tipo: 'SI_NO', seccion: 'Energía', orden: 1, triggerHallazgo: true },
      { label: 'Estado de horquillas', tipo: 'SI_NO', seccion: 'Estructura', orden: 2, triggerHallazgo: true },
      { label: 'Sistema hidráulico (sin pérdidas)', tipo: 'SI_NO', seccion: 'Hidráulico', orden: 3, triggerHallazgo: true },
      { label: 'Freno de mano operativo', tipo: 'SI_NO', seccion: 'Frenos', orden: 4, triggerHallazgo: true },
      { label: 'Alarma de retroceso', tipo: 'SI_NO', seccion: 'Seguridad', orden: 5, triggerHallazgo: true },
      { label: 'Cinturón de seguridad', tipo: 'SI_NO', seccion: 'Seguridad', orden: 6, triggerHallazgo: true },
      { label: 'Neumáticos sin daños', tipo: 'SI_NO', seccion: 'Neumáticos', orden: 7, triggerHallazgo: true },
      { label: 'Observaciones', tipo: 'TEXTO', seccion: 'General', orden: 8, isRequerido: false },
    ],
  },
  checklist_extintor: {
    nombre: 'Inspección Extintores', categoria: 'SEGURIDAD',
    descripcion: 'Verificación mensual de extintores contra incendio',
    items: [
      { label: 'Ubicación correcta y accesible', tipo: 'SI_NO', seccion: 'Ubicación', orden: 1, triggerHallazgo: true },
      { label: 'Precinto / seguro intacto', tipo: 'SI_NO', seccion: 'Estado', orden: 2, triggerHallazgo: true },
      { label: 'Manómetro en zona verde', tipo: 'SI_NO', seccion: 'Estado', orden: 3, triggerHallazgo: true },
      { label: 'Sin daños físicos visibles', tipo: 'SI_NO', seccion: 'Estado', orden: 4, triggerHallazgo: true },
      { label: 'Fecha de vencimiento vigente', tipo: 'SI_NO', seccion: 'Vencimiento', orden: 5, triggerHallazgo: true },
      { label: 'Observaciones', tipo: 'TEXTO', seccion: 'General', orden: 6, isRequerido: false },
    ],
  },
  checklist_maquinaria: {
    nombre: 'Inspección Maquinaria Industrial', categoria: 'MAQUINARIA',
    descripcion: 'Inspección operativa de maquinaria de producción',
    items: [
      { label: 'Protecciones y resguardos en su lugar', tipo: 'SI_NO', seccion: 'Seguridad', orden: 1, triggerHallazgo: true },
      { label: 'Botón de parada de emergencia', tipo: 'SI_NO', seccion: 'Seguridad', orden: 2, triggerHallazgo: true },
      { label: 'Nivel de lubricante', tipo: 'SI_NO', seccion: 'Lubricación', orden: 3, triggerHallazgo: true },
      { label: 'Sin ruidos o vibraciones anormales', tipo: 'SI_NO', seccion: 'Operación', orden: 4, triggerHallazgo: true },
      { label: 'Temperatura de operación (°C)', tipo: 'NUMERO', seccion: 'Operación', orden: 5, isRequerido: false },
      { label: 'Observaciones', tipo: 'TEXTO', seccion: 'General', orden: 6, isRequerido: false },
    ],
  },
  checklist_edificio: {
    nombre: 'Inspección Edilicia', categoria: 'INFRAESTRUCTURA',
    descripcion: 'Revisión de instalaciones y estructura edilicia',
    items: [
      { label: 'Estado de pisos y accesos', tipo: 'SI_NO', seccion: 'Estructura', orden: 1, triggerHallazgo: true },
      { label: 'Iluminación de emergencia operativa', tipo: 'SI_NO', seccion: 'Electricidad', orden: 2, triggerHallazgo: true },
      { label: 'Tableros eléctricos cerrados', tipo: 'SI_NO', seccion: 'Electricidad', orden: 3, triggerHallazgo: true },
      { label: 'Salidas de emergencia despejadas', tipo: 'SI_NO', seccion: 'Seguridad', orden: 4, triggerHallazgo: true },
      { label: 'Orden y limpieza general (1-5)', tipo: 'ESCALA', seccion: 'General', orden: 5, opciones: ['1','2','3','4','5'], isRequerido: false },
      { label: 'Observaciones', tipo: 'TEXTO', seccion: 'General', orden: 6, isRequerido: false },
    ],
  },
};

export async function inspeccionesRoutes(app: FastifyInstance) {

  // ── DASHBOARD ──────────────────────────────────────────────────────────────
  app.get('/dashboard', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const now = new Date();
    const hoy = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const hace30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const hace12m = new Date(now.getFullYear() - 1, now.getMonth(), 1);

    const [totalHoy, totalMes, conHallazgos, criticas, hallazgosAbiertos,
      hallazgosCriticos, totalPlantillas, totalQRs, inspeccionesMes,
      hallazgosPorTipo, topActivos] = await Promise.all([
      (app.prisma as any).inspeccion.count({ where: { tenantId, createdAt: { gte: hoy } } }),
      (app.prisma as any).inspeccion.count({ where: { tenantId, createdAt: { gte: hace30 } } }),
      (app.prisma as any).inspeccion.count({ where: { tenantId, estado: 'CON_HALLAZGOS' } }),
      (app.prisma as any).inspeccion.count({ where: { tenantId, estado: 'CRITICA' } }),
      (app.prisma as any).inspeccionHallazgo.count({ where: { tenantId, estado: { in: ['ABIERTO', 'EN_PROCESO'] } } }),
      (app.prisma as any).inspeccionHallazgo.count({ where: { tenantId, severidad: 'CRITICO', estado: { notIn: ['RESUELTO', 'CERRADO'] } } }),
      (app.prisma as any).inspeccionPlantilla.count({ where: { tenantId, isActive: true } }),
      (app.prisma as any).inspeccionQR.count({ where: { tenantId, isActive: true } }),
      (app.prisma as any).inspeccion.findMany({ where: { tenantId, createdAt: { gte: hace12m } }, select: { createdAt: true } }),
      (app.prisma as any).inspeccionHallazgo.groupBy({ by: ['tipo'], where: { tenantId }, _count: { id: true } }),
      (app.prisma as any).inspeccion.groupBy({
        by: ['activoNombre'], where: { tenantId, hallazgosCount: { gt: 0 } },
        _sum: { hallazgosCount: true }, orderBy: { _sum: { hallazgosCount: 'desc' } }, take: 5,
      }),
    ]);

    const porMes: Record<string, number> = {};
    for (const row of inspeccionesMes as any[]) {
      const d = new Date(row.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      porMes[key] = (porMes[key] || 0) + 1;
    }
    const tendencia = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return { mes: key, total: porMes[key] || 0 };
    });

    return reply.send({
      kpis: { totalHoy, totalMes, conHallazgos, criticas, hallazgosAbiertos, hallazgosCriticos, totalPlantillas, totalQRs,
        cumplimiento: totalMes > 0 ? Math.round(((totalMes - criticas) / totalMes) * 100) : 100 },
      tendencia,
      hallazgosPorTipo: (hallazgosPorTipo as any[]).map(h => ({ tipo: h.tipo, total: h._count.id })),
      topActivos: (topActivos as any[]).map(a => ({ activo: a.activoNombre, hallazgos: a._sum.hallazgosCount || 0 })),
    });
  });

  // ── PLANTILLAS ─────────────────────────────────────────────────────────────
  app.get('/plantillas', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const plantillas = await (app.prisma as any).inspeccionPlantilla.findMany({
      where: { tenantId, isActive: true },
      include: { _count: { select: { items: true, instancias: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return reply.send({ plantillas });
  });

  app.get('/plantillas/built-in', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    return reply.send({
      templates: Object.entries(BUILT_IN_TEMPLATES).map(([key, t]) => ({
        key, nombre: t.nombre, categoria: t.categoria, descripcion: t.descripcion, itemsCount: t.items.length,
      })),
    });
  });

  app.post('/plantillas/from-built-in', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const body = z.object({ key: z.string() }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Key requerida' });
    const tpl = BUILT_IN_TEMPLATES[body.data.key];
    if (!tpl) return reply.code(404).send({ error: 'Template no encontrado' });
    const plantilla = await (app.prisma as any).inspeccionPlantilla.create({
      data: {
        tenantId, nombre: tpl.nombre, descripcion: tpl.descripcion, categoria: tpl.categoria, isBuiltIn: true,
        items: { create: tpl.items.map((item: any) => ({
          label: item.label, tipo: item.tipo, seccion: item.seccion || null, orden: item.orden,
          isRequerido: item.isRequerido !== false, triggerHallazgo: item.triggerHallazgo || false,
          opciones: item.opciones || undefined,
        })) },
      },
      include: { items: { orderBy: { orden: 'asc' } } },
    });
    return reply.send({ plantilla });
  });

  app.post('/plantillas', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const schema = z.object({
      nombre: z.string().min(1).max(150),
      descripcion: z.string().optional(),
      categoria: z.string().default('GENERAL'),
      items: z.array(z.object({
        label: z.string().min(1), tipo: z.string().default('SI_NO'),
        opciones: z.array(z.string()).optional(), seccion: z.string().optional(),
        orden: z.number().default(0), isRequerido: z.boolean().default(true),
        triggerHallazgo: z.boolean().default(false),
      })).default([]),
    });
    const body = schema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos', details: body.error.errors });
    const plantilla = await (app.prisma as any).inspeccionPlantilla.create({
      data: {
        tenantId, nombre: body.data.nombre, descripcion: body.data.descripcion, categoria: body.data.categoria,
        items: { create: body.data.items.map(item => ({
          label: item.label, tipo: item.tipo, opciones: item.opciones || undefined,
          seccion: item.seccion, orden: item.orden, isRequerido: item.isRequerido, triggerHallazgo: item.triggerHallazgo,
        })) },
      },
      include: { items: { orderBy: { orden: 'asc' } } },
    });
    return reply.code(201).send({ plantilla });
  });

  app.get('/plantillas/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const plantilla = await (app.prisma as any).inspeccionPlantilla.findFirst({
      where: { id, tenantId },
      include: { items: { orderBy: { orden: 'asc' } }, _count: { select: { instancias: true } } },
    });
    if (!plantilla) return reply.code(404).send({ error: 'No encontrada' });
    return reply.send({ plantilla });
  });

  app.patch('/plantillas/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const itemSchema = z.object({
      label: z.string().min(1),
      tipo: z.enum(['SI_NO', 'TEXTO', 'NUMERO', 'ESCALA', 'FECHA']).default('SI_NO'),
      seccion: z.string().optional(),
      isRequerido: z.boolean().default(true),
      triggerHallazgo: z.boolean().default(false),
      orden: z.number().default(0),
    });
    const schema = z.object({
      nombre: z.string().optional(),
      descripcion: z.string().optional(),
      categoria: z.string().optional(),
      isActive: z.boolean().optional(),
      items: z.array(itemSchema).optional(),
    });
    const body = schema.safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos' });
    const { items, ...rest } = body.data;
    await (app.prisma as any).inspeccionPlantilla.updateMany({ where: { id, tenantId }, data: rest });
    if (items !== undefined) {
      await (app.prisma as any).inspeccionItem.deleteMany({ where: { plantillaId: id } });
      if (items.length > 0) {
        await (app.prisma as any).inspeccionItem.createMany({
          data: items.map((it, i) => ({ ...it, plantillaId: id, orden: i })),
        });
      }
    }
    return reply.send({ ok: true });
  });

  app.delete('/plantillas/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    await (app.prisma as any).inspeccionPlantilla.updateMany({ where: { id, tenantId }, data: { isActive: false } });
    return reply.send({ ok: true });
  });

  // PATCH /plantillas/:id/diagrama — guarda configuración de fotos + puntos de control
  app.patch('/plantillas/:id/diagrama', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const body = req.body as any;
    // body.fotos = [{url: string (base64 o URL), titulo: string, puntos:[{x,y,label}]}]
    const fotos = Array.isArray(body?.fotos) ? body.fotos.slice(0, 4) : [];
    const updated = await (app.prisma as any).inspeccionPlantilla.updateMany({
      where: { id, tenantId },
      data: { diagramaFotos: fotos },
    });
    if (updated.count === 0) return reply.code(404).send({ error: 'Plantilla no encontrada' });
    return reply.send({ ok: true });
  });

  // ── QR OPERATIVOS ──────────────────────────────────────────────────────────
  app.get('/qrs', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const qrs = await (app.prisma as any).inspeccionQR.findMany({
      where: { tenantId, isActive: true },
      include: { plantilla: { select: { nombre: true, categoria: true } }, _count: { select: { inspecciones: true } } },
      orderBy: { generatedAt: 'desc' },
    });
    const baseUrl = process.env.APP_URL || 'https://logismart.ar';
    return reply.send({ qrs: qrs.map((q: any) => ({ ...q, publicUrl: `${baseUrl}/inspeccionar/${q.token}` })) });
  });

  app.post('/qrs', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const schema = z.object({
      plantillaId: z.string().uuid(),
      activoNombre: z.string().min(1).max(200),
      activoCodigo: z.string().optional(),
      ubicacion: z.string().optional(),
      sector: z.string().optional(),
      titulo: z.string().optional(),
      subtitulo: z.string().optional(),
      instrucciones: z.string().optional(),
      pie: z.string().optional(),
      maintenanceAssetId: z.string().uuid().optional().or(z.literal('').transform(() => undefined)),
    });
    const body = schema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos', details: body.error.errors });
    const plantilla = await (app.prisma as any).inspeccionPlantilla.findFirst({ where: { id: body.data.plantillaId, tenantId } });
    if (!plantilla) return reply.code(404).send({ error: 'Plantilla no encontrada' });
    const qr = await (app.prisma as any).inspeccionQR.create({
      data: { tenantId, ...body.data, token: generateToken() },
      include: { plantilla: { select: { nombre: true, categoria: true } } },
    });
    const baseUrl = process.env.APP_URL || 'https://logismart.ar';
    return reply.code(201).send({ qr: { ...qr, publicUrl: `${baseUrl}/inspeccionar/${qr.token}` } });
  });

  app.put('/qrs/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const schema = z.object({
      activoNombre: z.string().min(1).max(200).optional(),
      activoCodigo: z.string().optional(),
      ubicacion: z.string().optional(),
      sector: z.string().optional(),
      titulo: z.string().optional(),
      pie: z.string().optional(),
      maintenanceAssetId: z.string().uuid().optional().nullable().or(z.literal('').transform(() => null)),
    });
    const body = schema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos', details: body.error.errors });
    const qr = await (app.prisma as any).inspeccionQR.updateMany({ where: { id, tenantId }, data: body.data });
    return reply.send({ ok: true, qr });
  });

  app.delete('/qrs/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    await (app.prisma as any).inspeccionQR.updateMany({ where: { id, tenantId }, data: { isActive: false } });
    return reply.send({ ok: true });
  });

  // ── RUTA PÚBLICA GET ───────────────────────────────────────────────────────
  app.get('/public/:token', async (req: FastifyRequest, reply: FastifyReply) => {
    const { token } = req.params as any;
    const qr = await (app.prisma as any).inspeccionQR.findFirst({
      where: { token, isActive: true },
      include: {
        plantilla: { include: { items: { orderBy: { orden: 'asc' } } } },
        tenant: { select: { id: true, name: true } },
      },
    });
    if (!qr) return reply.code(404).send({ error: 'QR no encontrado o inactivo' });
    const settings = await (app.prisma as any).companySettings.findUnique({
      where: { tenantId: qr.tenantId }, select: { logoUrl: true, primaryColor: true },
    }).catch(() => null);
    return reply.send({
      qr: { id: qr.id, activoNombre: qr.activoNombre, activoCodigo: qr.activoCodigo, ubicacion: qr.ubicacion,
        sector: qr.sector, titulo: qr.titulo, subtitulo: qr.subtitulo, instrucciones: qr.instrucciones, pie: qr.pie },
      plantilla: { id: qr.plantilla.id, nombre: qr.plantilla.nombre, categoria: qr.plantilla.categoria, items: qr.plantilla.items, diagramaFotos: qr.plantilla.diagramaFotos ?? null },
      empresa: { nombre: qr.tenant.name, logoUrl: settings?.logoUrl ?? null, primaryColor: settings?.primaryColor ?? '#2563eb' },
    });
  });

  // ── RUTA PÚBLICA POST ──────────────────────────────────────────────────────
  app.post('/public/:token', async (req: FastifyRequest, reply: FastifyReply) => {
    const { token } = req.params as any;
    const qr = await (app.prisma as any).inspeccionQR.findFirst({
      where: { token, isActive: true },
      include: { plantilla: { include: { items: true } }, maintenanceAsset: { select: { id: true, name: true, code: true } } },
    });
    if (!qr) return reply.code(404).send({ error: 'QR no encontrado o inactivo' });

    const schema = z.object({
      inspectorNombre: z.string().min(1).max(200),
      inspectorEmail: z.string().email().optional().or(z.literal('')).transform(v => v || undefined),
      inspectorPhone: z.string().max(50).optional().or(z.literal('')).transform(v => v || undefined),
      notas: z.string().optional(),
      respuestas: z.array(z.object({
        itemId: z.string().uuid(),
        valor: z.any(),
        esOk: z.boolean().optional(),
        observacion: z.string().optional(),
      })),
    });
    const body = schema.safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos', details: body.error.errors });

    const items = qr.plantilla.items as any[];
    const respuestas = body.data.respuestas;
    const hallazgos: any[] = [];
    let itemsOk = 0;

    for (const resp of respuestas) {
      const item = items.find((i: any) => i.id === resp.itemId);
      if (!item) continue;
      if (resp.esOk === true) itemsOk++;
      if (resp.esOk === false && item.triggerHallazgo) {
        hallazgos.push({ descripcion: resp.observacion || `${item.label}: No cumple`, tipo: 'OPERATIVO', severidad: 'MODERADO', itemLabel: item.label });
      }
    }

    const puntaje = items.length > 0 ? Math.round((itemsOk / items.length) * 100) : 100;
    const estado = hallazgos.length === 0 ? 'COMPLETA' : puntaje < 60 ? 'CRITICA' : 'CON_HALLAZGOS';

    const inspeccion = await (app.prisma as any).inspeccion.create({
      data: {
        tenantId: qr.tenantId, qrId: qr.id,
        inspectorNombre: body.data.inspectorNombre,
        inspectorEmail: body.data.inspectorEmail || null,
        inspectorPhone: body.data.inspectorPhone || null,
        activoNombre: qr.activoNombre, activoCodigo: qr.activoCodigo, sector: qr.sector,
        estado, puntaje, hallazgosCount: hallazgos.length, itemsTotal: items.length, itemsOk,
        notas: body.data.notas,
        respuestas: { create: respuestas.map(r => ({ itemId: r.itemId, valor: r.valor ?? null, esOk: r.esOk ?? null, observacion: r.observacion })) },
        hallazgos: hallazgos.length > 0 ? { create: hallazgos.map(h => ({ tenantId: qr.tenantId, ...h })) } : undefined,
      },
    });

    await (app.prisma as any).inspeccionQR.update({ where: { id: qr.id }, data: { useCount: { increment: 1 }, lastUsedAt: new Date() } });

    // Auto-actualizar estado del activo si hay hallazgos críticos
    if (qr.maintenanceAssetId) {
      try {
        const hayCriticos = hallazgos.some((h: any) => h.severidad === 'CRITICO');
        const updateData: any = { lastMaintenanceDate: new Date() };
        if (hayCriticos) updateData.status = 'MAINTENANCE';
        await (app.prisma as any).maintenanceAsset.updateMany({
          where: { id: qr.maintenanceAssetId },
          data: updateData,
        });
      } catch (e: any) { console.error('[inspecciones] asset status update error:', e); }
    }

    // Auto-crear OT por hallazgo si el QR está vinculado a un activo de mantenimiento
    if (hallazgos.length > 0 && qr.maintenanceAssetId) {
      try {
        const hallazgosCreados = await (app.prisma as any).inspeccionHallazgo.findMany({
          where: { inspeccionId: inspeccion.id },
          select: { id: true, descripcion: true, severidad: true },
        });
        for (const h of hallazgosCreados) {
          const prioridad = h.severidad === 'CRITICO' ? 'CRITICAL' : h.severidad === 'GRAVE' ? 'HIGH' : 'MEDIUM';
          await (app.prisma as any).workOrder.create({
            data: {
              code: `OT-INSP-${Date.now().toString().slice(-6)}`,
              title: `Hallazgo inspección: ${h.descripcion.slice(0, 80)}`,
              description: `Generado automáticamente por inspección QR. Inspector: ${body.data.inspectorNombre}. Activo: ${qr.activoNombre}.`,
              type: 'CORRECTIVE',
              priority: prioridad,
              status: 'PENDING',
              assetId: qr.maintenanceAssetId,
              origen: 'INSPECCION',
              origenId: h.id,
              activoNombreLibre: qr.activoNombre,
              tenantId: qr.tenantId,
            },
          });
        }
      } catch (e: any) { console.error('[inspecciones] auto OT error:', e); }
    }

    if (hallazgos.length > 0) {
      notifyInspeccionHallazgo(app.prisma, {
        tenantId: qr.tenantId,
        activoNombre: qr.activoNombre || 'Sin nombre',
        hallazgosCount: hallazgos.length,
        haysCriticos: hallazgos.some((h: any) => h.severidad === 'CRITICO'),
        inspeccionId: inspeccion.id,
      }).catch((e: any) => console.error('[inspecciones] notify error:', e));
    }

    return reply.code(201).send({
      ok: true, inspeccionId: inspeccion.id, estado, puntaje, hallazgosCount: hallazgos.length,
      mensaje: hallazgos.length > 0
        ? `Inspección registrada con ${hallazgos.length} hallazgo(s).`
        : '✅ Inspección completada exitosamente. Sin hallazgos.',
    });
  });

  // ── INSPECCIONES ───────────────────────────────────────────────────────────
  app.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const q = req.query as any;
    const where: any = { tenantId };
    if (q.estado) where.estado = q.estado;
    if (q.activo) where.activoNombre = { contains: q.activo, mode: 'insensitive' };
    if (q.sector) where.sector = { contains: q.sector, mode: 'insensitive' };
    const [inspecciones, total] = await Promise.all([
      (app.prisma as any).inspeccion.findMany({
        where,
        include: { qr: { select: { plantilla: { select: { nombre: true, categoria: true } } } }, _count: { select: { hallazgos: true } } },
        orderBy: { createdAt: 'desc' },
        take: q.limit ? parseInt(q.limit) : 50,
        skip: q.offset ? parseInt(q.offset) : 0,
      }),
      (app.prisma as any).inspeccion.count({ where }),
    ]);
    return reply.send({ inspecciones, total });
  });

  app.get('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const inspeccion = await (app.prisma as any).inspeccion.findFirst({
      where: { id, tenantId },
      include: {
        qr: { include: { plantilla: { include: { items: { orderBy: { orden: 'asc' } } } }, maintenanceAsset: { select: { id: true, name: true, code: true } } } },
        respuestas: { include: { item: true }, orderBy: { item: { orden: 'asc' } } },
        hallazgos: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!inspeccion) return reply.code(404).send({ error: 'No encontrada' });
    let diagramaFotos = null;
    if (inspeccion.qr?.plantilla?.id) {
      const pf = await (app.prisma as any).inspeccionPlantilla.findUnique({
        where: { id: inspeccion.qr.plantilla.id },
        select: { diagramaFotos: true },
      });
      diagramaFotos = pf?.diagramaFotos ?? null;
    }
    // Prisma objects are frozen — build a plain serializable response
    const result = JSON.parse(JSON.stringify(inspeccion));
    if (result.qr?.plantilla) result.qr.plantilla.diagramaFotos = diagramaFotos;
    return reply.send({ inspeccion: result });
  });

  // ── HALLAZGOS ──────────────────────────────────────────────────────────────
  app.get('/hallazgos', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const q = req.query as any;
    const where: any = { tenantId };
    if (q.estado) where.estado = q.estado;
    if (q.severidad) where.severidad = q.severidad;
    if (q.tipo) where.tipo = q.tipo;
    const [hallazgos, total] = await Promise.all([
      (app.prisma as any).inspeccionHallazgo.findMany({
        where,
        include: { inspeccion: { select: { activoNombre: true, activoCodigo: true, createdAt: true } } },
        orderBy: [{ severidad: 'desc' }, { createdAt: 'desc' }],
        take: 100,
      }),
      (app.prisma as any).inspeccionHallazgo.count({ where }),
    ]);
    return reply.send({ hallazgos, total });
  });

  app.patch('/hallazgos/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const schema = z.object({
      estado: z.enum(['ABIERTO', 'EN_PROCESO', 'RESUELTO', 'CERRADO']).optional(),
      severidad: z.enum(['LEVE', 'MODERADO', 'CRITICO']).optional(),
      accion: z.string().optional(),
      responsable: z.string().optional(),
      fechaLimite: z.string().optional(),
    });
    const body = schema.safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos' });
    const data: any = { ...body.data };
    if (data.fechaLimite) data.fechaLimite = new Date(data.fechaLimite);
    if (data.estado === 'RESUELTO' || data.estado === 'CERRADO') data.resolvedAt = new Date();
    await (app.prisma as any).inspeccionHallazgo.updateMany({ where: { id, tenantId }, data });
    return reply.send({ ok: true });
  });

  // ── ÓRDENES DE TRABAJO DESDE INSPECCIÓN ────────────────────────────────────
  app.post('/ot', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const schema = z.object({
      hallazgoId: z.string().uuid().optional(),
      title: z.string().min(1).max(200),
      description: z.string().optional(),
      type: z.enum(['PREVENTIVE', 'CORRECTIVE', 'PREDICTIVE', 'EMERGENCY']).default('CORRECTIVE'),
      priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('HIGH'),
      activoNombreLibre: z.string().optional(),
      technicianNombre: z.string().optional(),
      scheduledDate: z.string(),
      notas: z.string().optional(),
    });
    const body = schema.safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos', details: body.error.errors });
    const d = body.data;
    try {
      const code = `OT-INS-${Date.now().toString().slice(-6)}`;
      const createData: any = {
        tenantId,
        code,
        title: d.title,
        description: d.description,
        type: d.type,
        priority: d.priority,
        status: 'PENDING',
        scheduledDate: new Date(d.scheduledDate),
        estimatedDuration: 0,
        laborCost: 0,
        partsCost: 0,
        totalCost: 0,
      };
      try { createData.origen = 'INSPECCION'; createData.origenId = d.hallazgoId ?? null; createData.activoNombreLibre = d.activoNombreLibre ?? null; } catch {}
      const ot = await (app.prisma as any).workOrder.create({ data: createData });
      if (d.hallazgoId) {
        await (app.prisma as any).inspeccionHallazgo.updateMany({ where: { id: d.hallazgoId, tenantId }, data: { otId: ot.id } }).catch(() => {});
      }
      notifyInspeccionOT(app.prisma, {
        tenantId,
        otCode: code,
        otTitle: d.title,
        activoNombre: d.activoNombreLibre || 'Sin activo',
        otId: ot.id,
      }).catch((e: any) => console.error('[inspecciones] notify OT error:', e));
      return reply.code(201).send({ ot });
    } catch (err: any) {
      console.error('[inspecciones] Error creando OT:', err);
      return reply.code(500).send({ error: 'Error interno al crear OT', detail: err?.message });
    }
  });

  app.get('/ot', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const q = req.query as any;
    const where: any = { tenantId, origen: 'INSPECCION' };
    if (q.status) where.status = q.status;
    const ots = await (app.prisma as any).workOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return reply.send({ ots });
  });

  app.patch('/ot/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const schema = z.object({
      status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'ON_HOLD']).optional(),
      technicianNombre: z.string().optional(),
      notas: z.string().optional(),
    });
    const body = schema.safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos' });
    await (app.prisma as any).workOrder.updateMany({
      where: { id, tenantId, origen: 'INSPECCION' },
      data: { ...body.data },
    });
    return reply.send({ ok: true });
  });

  // ── EXPORT EXCEL ───────────────────────────────────────────────────────────
  app.get('/:id/excel', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const inspeccion = await (app.prisma as any).inspeccion.findFirst({
      where: { id, tenantId },
      include: {
        qr: { include: { plantilla: { include: { items: { orderBy: { orden: 'asc' } } } } } },
        respuestas: { include: { item: true }, orderBy: { item: { orden: 'asc' } } },
        hallazgos: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!inspeccion) return reply.code(404).send({ error: 'No encontrada' });

    const settings = await (app.prisma as any).companySettings.findUnique({ where: { tenantId }, select: { companyName: true, logoUrl: true, primaryColor: true } });
    const empresa = settings?.companyName || 'SGI 360';
    const color = (settings?.primaryColor || '#2563eb').replace('#', '');

    const wb = new ExcelJS.Workbook();
    wb.creator = empresa;
    const ws = wb.addWorksheet('Inspección', { pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true } });

    ws.columns = [
      { width: 5 }, { width: 40 }, { width: 12 }, { width: 12 }, { width: 35 },
    ];

    // Membrete
    ws.mergeCells('A1:E1');
    const titleCell = ws.getCell('A1');
    titleCell.value = empresa.toUpperCase() + ' — ' + (inspeccion.qr?.plantilla?.nombre || 'Inspección');
    titleCell.font = { bold: true, size: 16, color: { argb: 'FF' + color } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    ws.getRow(1).height = 32;

    // Código de registro
    ws.mergeCells('A2:E2');
    ws.getCell('A2').value = 'MR-CHK-01 · ' + empresa;
    ws.getCell('A2').font = { size: 9, color: { argb: 'FF64748B' } };
    ws.getCell('A2').alignment = { horizontal: 'right' };

    ws.addRow([]);

    // Encabezado datos
    const headerFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    const addDataRow = (label: string, value: string) => {
      const r = ws.addRow(['', label, value, '', '']);
      r.getCell(2).font = { bold: true, size: 10 };
      r.getCell(3).font = { size: 10 };
      r.getCell(2).fill = headerFill;
      ws.mergeCells(`C${r.number}:E${r.number}`);
    };

    const fecha = new Date(inspeccion.createdAt);
    addDataRow('FECHA:', fecha.toLocaleDateString('es-AR') + ' ' + fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }));
    addDataRow('NOMBRE Y APELLIDO:', inspeccion.inspectorNombre || '');
    addDataRow('LUGAR / SECTOR:', inspeccion.sector || inspeccion.qr?.sector || '');
    addDataRow('ACTIVO / UNIDAD:', inspeccion.activoNombre || '');
    addDataRow('CÓDIGO:', inspeccion.activoCodigo || '—');
    addDataRow('CONTROL REALIZADO POR:', inspeccion.inspectorNombre || '');

    ws.addRow([]);

    // Secciones de items
    const items = inspeccion.qr?.plantilla?.items || [];
    const respMap: Record<string, any> = {};
    for (const r of inspeccion.respuestas) respMap[r.itemId] = r;

    const secciones = [...new Set(items.map((i: any) => i.seccion || 'General'))];
    let itemNum = 1;

    for (const sec of secciones) {
      // Encabezado de sección
      const secRow = ws.addRow(['', (sec as string).toUpperCase(), 'OK', 'NG', 'OBSERVACIONES']);
      secRow.eachCell(cell => {
        cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + color } };
        cell.alignment = { horizontal: 'center' };
        cell.border = { bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } } };
      });
      secRow.getCell(2).alignment = { horizontal: 'left' };

      const secItems = items.filter((i: any) => (i.seccion || 'General') === sec);
      for (const item of secItems) {
        const resp = respMap[item.id];
        const ok = resp?.esOk === true ? '✓' : '';
        const ng = resp?.esOk === false ? '✗' : '';
        const obs = resp?.observacion || '';
        const r = ws.addRow([itemNum++, item.label, ok, ng, obs]);
        r.getCell(1).alignment = { horizontal: 'center' };
        r.getCell(3).alignment = { horizontal: 'center' };
        r.getCell(3).font = { color: { argb: 'FF16A34A' }, bold: true, size: 12 };
        r.getCell(4).alignment = { horizontal: 'center' };
        r.getCell(4).font = { color: { argb: 'FFDC2626' }, bold: true, size: 12 };
        r.eachCell(cell => {
          cell.border = { bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } } };
        });
        if (resp?.esOk === false) r.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF2F2' } };
      }
    }

    // Puntaje
    ws.addRow([]);
    const puntRow = ws.addRow(['', 'PUNTAJE DE CUMPLIMIENTO:', `${inspeccion.puntaje}%`, '', '']);
    puntRow.getCell(2).font = { bold: true, size: 11 };
    puntRow.getCell(3).font = { bold: true, size: 14, color: { argb: inspeccion.puntaje >= 80 ? 'FF16A34A' : inspeccion.puntaje >= 60 ? 'FFD97706' : 'FFDC2626' } };

    // Hallazgos
    if (inspeccion.hallazgos?.length > 0) {
      ws.addRow([]);
      const hRow = ws.addRow(['', 'HALLAZGOS DETECTADOS', '', '', '']);
      ws.mergeCells(`B${hRow.number}:E${hRow.number}`);
      hRow.getCell(2).font = { bold: true, size: 11, color: { argb: 'FFDC2626' } };
      hRow.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF2F2' } };

      for (const h of inspeccion.hallazgos) {
        const hr = ws.addRow(['', '⚠ ' + h.descripcion, h.severidad, '', h.tipo]);
        hr.getCell(2).font = { size: 10 };
        hr.getCell(3).font = { size: 9, color: { argb: 'FFDC2626' } };
      }
    }

    // Notas generales
    if (inspeccion.notas) {
      ws.addRow([]);
      ws.addRow(['', 'OBSERVACIONES GENERALES:', '', '', '']);
      ws.addRow(['', inspeccion.notas, '', '', '']);
    }

    // Firma / pie
    ws.addRow([]);
    const firmaRow = ws.addRow(['', 'Firma del Inspector:', '', '', '']);
    firmaRow.getCell(2).font = { bold: true, size: 10 };
    ws.addRow(['', '_________________________', '', '', '']);
    ws.addRow(['', inspeccion.inspectorNombre || '', '', '', '']);
    ws.addRow([]);
    const pieRow = ws.addRow(['', `Generado por ${empresa} · www.logismart.ar · ${new Date().toLocaleDateString('es-AR')}`, '', '', '']);
    ws.mergeCells(`B${pieRow.number}:E${pieRow.number}`);
    pieRow.getCell(2).font = { size: 8, color: { argb: 'FF94A3B8' }, italic: true };
    pieRow.getCell(2).alignment = { horizontal: 'center' };

    const buf = await wb.xlsx.writeBuffer();
    const filename = `inspeccion-${inspeccion.activoNombre?.replace(/\s+/g, '-') || id}-${fecha.toISOString().slice(0,10)}.xlsx`;
    reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    reply.header('Content-Disposition', `attachment; filename="${filename}"`);
    return reply.send(Buffer.from(buf));
  });

  // ── ALERT CONFIG ───────────────────────────────────────────────────────────
  app.get('/alert-config', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const s = await (app.prisma as any).companySettings.findUnique({ where: { tenantId }, select: { inspeccionAlertEmails: true } });
    return reply.send({ alertEmails: s?.inspeccionAlertEmails || [] });
  });

  app.patch('/alert-config', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const body = req.body as any;
    await (app.prisma as any).companySettings.updateMany({
      where: { tenantId },
      data: { inspeccionAlertEmails: body.alertEmails ?? [] },
    });
    return reply.send({ ok: true });
  });

  // ── KPI ────────────────────────────────────────────────────────────────────
  app.get('/kpi', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const hace90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const [porEstado, porActivo, porSector, reincidencias] = await Promise.all([
      (app.prisma as any).inspeccion.groupBy({ by: ['estado'], where: { tenantId }, _count: { id: true } }),
      (app.prisma as any).inspeccion.groupBy({
        by: ['activoNombre'], where: { tenantId, createdAt: { gte: hace90 } },
        _count: { id: true }, _sum: { hallazgosCount: true, puntaje: true },
        orderBy: { _count: { id: 'desc' } }, take: 10,
      }),
      (app.prisma as any).inspeccion.groupBy({
        by: ['sector'], where: { tenantId, sector: { not: null } },
        _count: { id: true }, _sum: { hallazgosCount: true },
      }),
      (app.prisma as any).inspeccionHallazgo.groupBy({
        by: ['itemLabel'], where: { tenantId }, _count: { id: true },
        orderBy: { _count: { id: 'desc' } }, take: 10,
      }),
    ]);
    return reply.send({
      porEstado: (porEstado as any[]).map(e => ({ estado: e.estado, total: e._count.id })),
      porActivo: (porActivo as any[]).map(a => ({
        activo: a.activoNombre, inspecciones: a._count.id,
        hallazgos: a._sum.hallazgosCount || 0,
        puntajePromedio: a._count.id > 0 ? Math.round((a._sum.puntaje || 0) / a._count.id) : 0,
      })),
      porSector: (porSector as any[]).map(s => ({ sector: s.sector, inspecciones: s._count.id, hallazgos: s._sum.hallazgosCount || 0 })),
      reincidencias: (reincidencias as any[]).map(r => ({ item: r.itemLabel, ocurrencias: r._count.id })),
    });
  });
}
