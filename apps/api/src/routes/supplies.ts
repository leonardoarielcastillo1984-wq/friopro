import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getEffectiveTenantId } from '../utils/tenant-bypass.js';

// ============================================================
// Insumos y consumibles — Infraestructura
// Catálogo por rubro + declaración mensual por sector + stock.
// Stock crítico = (consumo medio/día × leadTimeDays) × safetyFactor
// (fórmula del correo corporativo, factor 1,20 por defecto).
// ============================================================

const RUBROS = ['LIMPIEZA', 'LIBRERIA', 'FILM', 'LUBRICANTE', 'EP', 'OTRO'];

const itemSchema = z.object({
  code: z.string().min(1).max(40),
  name: z.string().min(1).max(200),
  rubro: z.enum(['LIMPIEZA', 'LIBRERIA', 'FILM', 'LUBRICANTE', 'EP', 'OTRO']).default('OTRO'),
  unit: z.string().max(20).default('unidad'),
  description: z.string().max(500).optional().nullable(),
  leadTimeDays: z.number().int().min(0).max(365).default(3),
  minStock: z.number().min(0).default(0),
  safetyFactor: z.number().min(1).max(3).default(1.2),
  supplier: z.string().max(150).optional().nullable(),
  supplierCode: z.string().max(60).optional().nullable(),
  location: z.string().max(80).optional().nullable(),
  unitCost: z.number().min(0).default(0),
  currentStock: z.number().min(0).default(0),
});

const movSchema = z.object({
  delta: z.number().refine((n) => n !== 0, 'delta no puede ser 0'),
  motivo: z.string().min(2).max(300),
  sector: z.string().max(120).optional().nullable(),
});

const needSchema = z.object({
  itemId: z.string().uuid(),
  sector: z.string().min(1).max(120),
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'period debe ser YYYY-MM'),
  monthlyQty: z.number().min(0),
  departmentId: z.string().uuid().optional().nullable(),
  notes: z.string().max(300).optional().nullable(),
});

const num = (v: any): number => (v == null ? 0 : typeof v === 'number' ? v : parseFloat(String(v)) || 0);

// Consumo medio por día de los últimos N días (egresos absolutos / días)
async function dailyUsage(prisma: any, tenantId: string, itemIds: string[], days = 60) {
  const since = new Date(Date.now() - days * 86400_000);
  const rows = await prisma.supplyMovement.groupBy({
    by: ['itemId'],
    where: { tenantId, itemId: { in: itemIds }, delta: { lt: 0 }, createdAt: { gte: since } },
    _sum: { delta: true },
  });
  const map: Record<string, number> = {};
  for (const r of rows) map[r.itemId] = Math.abs(num(r._sum.delta)) / days;
  return map;
}

function decorateItem(item: any, daily: number) {
  const criticoCalc = daily * item.leadTimeDays * item.safetyFactor;
  const stockCritico = item.minStock > 0 ? item.minStock : criticoCalc;
  return {
    ...item,
    consumoDia: Math.round(daily * 100) / 100,
    stockCritico: Math.round(stockCritico * 100) / 100,
    criticoOrigen: item.minStock > 0 ? 'manual' : 'calculado',
    bajoStock: item.currentStock < stockCritico,
    diasAutonomia: daily > 0 ? Math.round(item.currentStock / daily) : null,
  };
}

export default async function suppliesRoutes(app: FastifyInstance) {
  const prisma = () => app.prisma;

  // ── Catálogo ──
  app.get('/items', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, prisma());
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const q = req.query as any;
    const items = await prisma().supplyItem.findMany({
      where: { tenantId, deletedAt: null, activo: true, ...(q.rubro ? { rubro: q.rubro } : {}) },
      orderBy: [{ rubro: 'asc' }, { name: 'asc' }],
      take: 500,
    });
    const usage = await dailyUsage(prisma(), tenantId, items.map((i: any) => i.id));
    return reply.send({ items: items.map((i: any) => decorateItem(i, usage[i.id] || 0)), rubros: RUBROS });
  });

  app.post('/items', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, prisma());
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const body = itemSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Validation failed', details: body.error.issues });
    try {
      const item = await app.runWithDbContext(req, async (tx: any) => tx.supplyItem.create({ data: { ...body.data, tenantId } }));
      return reply.code(201).send({ item });
    } catch (e: any) {
      if (e.code === 'P2002') return reply.code(409).send({ error: 'Ya existe un insumo con ese código' });
      throw e;
    }
  });

  app.patch('/items/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, prisma());
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const body = itemSchema.partial().safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Validation failed', details: body.error.issues });
    const r = await prisma().supplyItem.updateMany({ where: { id, tenantId, deletedAt: null }, data: body.data });
    if (!r.count) return reply.code(404).send({ error: 'Insumo no encontrado' });
    return reply.send({ ok: true });
  });

  app.delete('/items/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, prisma());
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const r = await prisma().supplyItem.updateMany({ where: { id, tenantId }, data: { deletedAt: new Date() } });
    if (!r.count) return reply.code(404).send({ error: 'Insumo no encontrado' });
    return reply.send({ ok: true });
  });

  // ── Movimientos de stock ──
  app.get('/items/:id/movimientos', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, prisma());
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const movs = await prisma().supplyMovement.findMany({
      where: { tenantId, itemId: id },
      orderBy: { createdAt: 'desc' }, take: 50,
    });
    return reply.send({ movimientos: movs });
  });

  app.post('/items/:id/movimientos', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, prisma());
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const body = movSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Validation failed', details: body.error.issues });
    const item = await prisma().supplyItem.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!item) return reply.code(404).send({ error: 'Insumo no encontrado' });
    if (body.data.delta < 0 && item.currentStock + body.data.delta < 0) {
      return reply.code(400).send({ error: `Stock insuficiente (hay ${item.currentStock} ${item.unit})` });
    }
    await app.runWithDbContext(req, async (tx: any) => {
      await tx.supplyMovement.create({
        data: { tenantId, itemId: id, delta: body.data.delta, motivo: body.data.motivo, sector: body.data.sector ?? null, userId: (req as any).auth?.userId ?? null },
      });
      await tx.supplyItem.update({ where: { id }, data: { currentStock: { increment: body.data.delta } } });
    });
    return reply.code(201).send({ ok: true });
  });

  // ── Necesidades mensuales por sector ──
  app.get('/needs', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, prisma());
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const period = (req.query as any).period || new Date().toISOString().slice(0, 7);
    const needs = await prisma().supplyNeed.findMany({
      where: { tenantId, period },
      include: { item: { select: { id: true, code: true, name: true, rubro: true, unit: true } } },
      orderBy: [{ sector: 'asc' }],
      take: 1000,
    });
    return reply.send({ needs, period });
  });

  app.post('/needs', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, prisma());
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const body = needSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Validation failed', details: body.error.issues });
    const d = body.data;
    const item = await prisma().supplyItem.findFirst({ where: { id: d.itemId, tenantId, deletedAt: null } });
    if (!item) return reply.code(404).send({ error: 'Insumo no encontrado' });
    const userId = (req as any).auth?.userId ?? null;
    let respName: string | null = null;
    if (userId) {
      const u = await prisma().platformUser.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true, email: true } }).catch(() => null);
      respName = u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email : null;
    }
    const need = await prisma().supplyNeed.upsert({
      where: { tenantId_itemId_sector_period: { tenantId, itemId: d.itemId, sector: d.sector, period: d.period } },
      create: { tenantId, itemId: d.itemId, sector: d.sector, period: d.period, monthlyQty: d.monthlyQty, departmentId: d.departmentId ?? null, responsibleId: userId, responsibleName: respName, notes: d.notes ?? null },
      update: { monthlyQty: d.monthlyQty, departmentId: d.departmentId ?? null, responsibleId: userId, responsibleName: respName, notes: d.notes ?? null },
    });
    return reply.code(201).send({ need });
  });

  app.delete('/needs/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, prisma());
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as any;
    const r = await prisma().supplyNeed.deleteMany({ where: { id, tenantId } });
    if (!r.count) return reply.code(404).send({ error: 'Necesidad no encontrada' });
    return reply.send({ ok: true });
  });

  // ── Consolidado de compras por período ──
  // suma necesidades de todos los sectores por ítem + sugerido de compra
  // sugerido = max(0, needTotal + stockCritico - stock actual)
  app.get('/consolidado', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, prisma());
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const period = (req.query as any).period || new Date().toISOString().slice(0, 7);
    const needs = await prisma().supplyNeed.findMany({ where: { tenantId, period } });
    const itemIds = [...new Set(needs.map((n: any) => n.itemId))] as string[];
    const items = await prisma().supplyItem.findMany({ where: { tenantId, deletedAt: null, activo: true, id: { in: itemIds } } });
    const usage = await dailyUsage(prisma(), tenantId, itemIds);

    const byItem: Record<string, { item: any; sectores: any[]; needTotal: number }> = {};
    for (const n of needs) {
      const item = items.find((i: any) => i.id === n.itemId);
      if (!item) continue;
      byItem[n.itemId] = byItem[n.itemId] || { item, sectores: [], needTotal: 0 };
      byItem[n.itemId].sectores.push({ sector: n.sector, monthlyQty: n.monthlyQty, responsible: n.responsibleName });
      byItem[n.itemId].needTotal += n.monthlyQty;
    }

    const filas = Object.values(byItem).map(({ item, sectores, needTotal }) => {
      const deco = decorateItem(item, usage[item.id] || 0);
      const sugerido = Math.max(0, Math.ceil(needTotal + deco.stockCritico - item.currentStock));
      return {
        itemId: item.id, code: item.code, name: item.name, rubro: item.rubro, unit: item.unit,
        sectores, needTotal, currentStock: item.currentStock, stockCritico: deco.stockCritico,
        sugerido, unitCost: item.unitCost, costoEstimado: Math.round(sugerido * item.unitCost),
        proveedor: item.supplier, leadTimeDays: item.leadTimeDays,
      };
    }).sort((a, b) => b.costoEstimado - a.costoEstimado);

    return reply.send({ filas, period, totalEstimado: filas.reduce((a, f) => a + f.costoEstimado, 0) });
  });

  // ── Desvíos: declarado vs consumo real por sector ──
  app.get('/desvios', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, prisma());
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const period = (req.query as any).period || new Date().toISOString().slice(0, 7);
    const [y, m] = period.split('-').map(Number);
    const from = new Date(y, m - 1, 1);
    const to = new Date(y, m, 1);

    const needs = await prisma().supplyNeed.findMany({ where: { tenantId, period } });
    const itemIds = [...new Set(needs.map((n: any) => n.itemId))] as string[];
    const items = await prisma().supplyItem.findMany({ where: { tenantId, id: { in: itemIds } }, select: { id: true, name: true, unit: true } });

    const movs = await prisma().supplyMovement.findMany({
      where: { tenantId, itemId: { in: itemIds }, delta: { lt: 0 }, createdAt: { gte: from, lt: to } },
      select: { itemId: true, sector: true, delta: true },
    });

    const rows = needs.map((n: any) => {
      const real = Math.abs(movs
        .filter((mv: any) => mv.itemId === n.itemId && (mv.sector || '') === n.sector)
        .reduce((a: number, mv: any) => a + num(mv.delta), 0));
      const desvio = real - n.monthlyQty;
      return {
        itemId: n.itemId, item: items.find((i: any) => i.id === n.itemId)?.name || '', unit: items.find((i: any) => i.id === n.itemId)?.unit || '',
        sector: n.sector, responsible: n.responsibleName, declarado: n.monthlyQty,
        consumido: Math.round(real * 100) / 100,
        desvio: Math.round(desvio * 100) / 100,
        desvioPct: n.monthlyQty > 0 ? Math.round((desvio / n.monthlyQty) * 100) : (real > 0 ? 100 : 0),
      };
    }).sort((a, b) => b.desvio - a.desvio);

    return reply.send({ rows, period });
  });
}
