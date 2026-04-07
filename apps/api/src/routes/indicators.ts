import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

const FEATURE_KEY = 'indicadores';

function addInterval(from: Date, frequency: string): Date {
  const d = new Date(from);
  switch (frequency) {
    case 'DAILY':
      d.setDate(d.getDate() + 1);
      return d;
    case 'WEEKLY':
      d.setDate(d.getDate() + 7);
      return d;
    case 'QUARTERLY':
      d.setMonth(d.getMonth() + 3);
      return d;
    case 'YEARLY':
      d.setFullYear(d.getFullYear() + 1);
      return d;
    case 'MONTHLY':
    default:
      d.setMonth(d.getMonth() + 1);
      return d;
  }
}

function computeIndicatorStatus(args: {
  value: number | null;
  targetValue: number | null;
  warningValue: number | null;
  criticalValue: number | null;
  direction: 'HIGHER_BETTER' | 'LOWER_BETTER';
}): 'ON_TARGET' | 'WARNING' | 'OFF_TARGET' | 'NO_DATA' {
  const { value, targetValue, warningValue, criticalValue, direction } = args;
  if (value === null || value === undefined) return 'NO_DATA';
  if (targetValue === null || targetValue === undefined) return 'NO_DATA';

  const isHigher = direction !== 'LOWER_BETTER';
  const warn = warningValue ?? targetValue;

  if (isHigher) {
    if (value >= targetValue) return 'ON_TARGET';
    if (value >= warn) return 'WARNING';
    return 'OFF_TARGET';
  }

  // LOWER_BETTER
  if (value <= targetValue) return 'ON_TARGET';
  if (value <= warn) return 'WARNING';
  return 'OFF_TARGET';
}

async function generateIndicatorCode(tx: any, tenantId: string): Promise<string> {
  const year = new Date().getFullYear();
  const count = await tx.indicator.count({
    where: { tenantId, code: { startsWith: `IND-${year}-` } },
  });
  return `IND-${year}-${String(count + 1).padStart(3, '0')}`;
}

export const indicadoresRoutes: FastifyPluginAsync = async (app) => {
  // GET /indicadores — Listar indicadores
  app.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, FEATURE_KEY);
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });

    const tenantId = req.db.tenantId;

    const query = z
      .object({
        category: z.string().optional(),
        active: z.string().optional(),
      })
      .parse(req.query);

    const isActive = query.active === undefined ? undefined : query.active === 'true';

    const indicators = await app.runWithDbContext(req, async (tx: any) => {
      return tx.indicator.findMany({
        where: {
          tenantId,
          deletedAt: null,
          ...(query.category ? { category: query.category } : {}),
          ...(isActive === undefined ? {} : { isActive }),
        },
        orderBy: { updatedAt: 'desc' },
        include: {
          owner: { select: { id: true, email: true } },
          measurements: { orderBy: { measuredAt: 'desc' }, take: 24 },
          riskLinks: {
            include: {
              risk: { select: { id: true, code: true, title: true, probability: true, impact: true, riskLevel: true } },
            },
          },
        },
      });
    });

    return reply.send({ indicators });
  });

  // GET /indicadores/stats — Estadísticas
  app.get('/stats', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, FEATURE_KEY);
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });

    const tenantId = req.db.tenantId;

    const indicators = await app.runWithDbContext(req, async (tx: any) => {
      return tx.indicator.findMany({
        where: { tenantId, deletedAt: null },
        select: {
          id: true,
          isActive: true,
          category: true,
          trend: true,
          currentValue: true,
          targetValue: true,
          status: true,
          nextDueAt: true,
        },
      });
    });

    const active = indicators.filter((i: any) => i.isActive).length;
    const onTarget = indicators.filter((i: any) => i.isActive && i.status === 'ON_TARGET').length;
    const belowTarget = indicators.filter((i: any) => i.isActive && i.status === 'OFF_TARGET').length;

    const trending = {
      up: indicators.filter((i: any) => i.isActive && i.trend === 'UP').length,
      down: indicators.filter((i: any) => i.isActive && i.trend === 'DOWN').length,
      stable: indicators.filter((i: any) => i.isActive && i.trend === 'STABLE').length,
    };

    const categories: Record<string, number> = {};
    for (const i of indicators) {
      categories[i.category] = (categories[i.category] || 0) + 1;
    }

    return reply.send({
      stats: {
        total: indicators.length,
        active,
        onTarget,
        belowTarget,
        trending,
        categories,
      },
    });
  });

  // GET /indicadores/:id — Detalle
  app.get('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, FEATURE_KEY);
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });

    const tenantId = req.db.tenantId;

    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const indicator = await app.runWithDbContext(req, async (tx: any) => {
      return tx.indicator.findFirst({
        where: { id, tenantId, deletedAt: null },
        include: {
          owner: { select: { id: true, email: true } },
          measurements: { orderBy: { measuredAt: 'desc' }, take: 100 },
          riskLinks: {
            include: {
              risk: { select: { id: true, code: true, title: true, probability: true, impact: true, riskLevel: true, status: true } },
            },
          },
        },
      });
    });

    if (!indicator) return reply.code(404).send({ error: 'Resource not found' });
    return reply.send({ indicator });
  });

  // POST /indicadores — Crear indicador
  app.post('/', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, FEATURE_KEY);
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });

    const tenantId = req.db.tenantId;

    const schema = z.object({
      name: z.string().min(2),
      description: z.string().optional(),
      category: z.string().min(2),
      process: z.string().optional(),
      standard: z.string().optional(),
      targetValue: z.number().optional(),
      warningValue: z.number().optional(),
      criticalValue: z.number().optional(),
      unit: z.string().min(1),
      frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']),
      direction: z.enum(['HIGHER_BETTER', 'LOWER_BETTER']).optional(),
      ncrTriggerStreak: z.number().int().min(1).max(12).optional(),
      ownerId: z.string().uuid().optional(),
    });

    const body = schema.parse(req.body);
    const indicator = await app.runWithDbContext(req, async (tx: any) => {
      const code = await generateIndicatorCode(tx, tenantId);
      return tx.indicator.create({
        data: {
          tenantId,
          code,
          name: body.name,
          description: body.description,
          category: body.category,
          process: body.process,
          standard: body.standard,
          targetValue: body.targetValue ?? null,
          warningValue: body.warningValue ?? null,
          criticalValue: body.criticalValue ?? null,
          unit: body.unit,
          frequency: body.frequency as any,
          direction: (body.direction ?? 'HIGHER_BETTER') as any,
          ncrTriggerStreak: body.ncrTriggerStreak ?? 2,
          ownerId: body.ownerId ?? null,
          createdById: req.auth?.userId ?? null,
          updatedById: req.auth?.userId ?? null,
        },
        include: {
          owner: { select: { id: true, email: true } },
          measurements: { orderBy: { measuredAt: 'desc' }, take: 24 },
          riskLinks: { include: { risk: { select: { id: true, code: true, title: true, probability: true, impact: true, riskLevel: true } } } },
        },
      });
    });

    return reply.code(201).send({ indicator });
  });

  // POST /indicadores/:id/measurements — Agregar medición
  app.post('/:id/measurements', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, FEATURE_KEY);
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });

    const tenantId = req.db.tenantId;

    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const schema = z.object({
      value: z.number(),
      period: z.string().min(1),
      notes: z.string().optional(),
    });
    const body = schema.parse(req.body);

    const res = await app.runWithDbContext(req, async (tx: any) => {
      const indicator = await tx.indicator.findFirst({ where: { id, tenantId, deletedAt: null } });
      if (!indicator) throw new Error('Resource not found');

      const measurement = await tx.indicatorMeasurement.upsert({
        where: { indicatorId_period: { indicatorId: indicator.id, period: body.period } },
        update: { value: body.value, notes: body.notes ?? null, measuredAt: new Date() },
        create: { indicatorId: indicator.id, value: body.value, period: body.period, notes: body.notes ?? null },
      });

      const prev = indicator.currentValue;
      const trend = prev === null || prev === undefined
        ? 'STABLE'
        : body.value > prev
          ? 'UP'
          : body.value < prev
            ? 'DOWN'
            : 'STABLE';

      const status = computeIndicatorStatus({
        value: body.value,
        targetValue: indicator.targetValue,
        warningValue: indicator.warningValue,
        criticalValue: indicator.criticalValue,
        direction: indicator.direction,
      });

      const offTargetStreak = status === 'OFF_TARGET' ? (indicator.offTargetStreak ?? 0) + 1 : 0;
      const now = new Date();
      const nextDueAt = addInterval(now, String(indicator.frequency));

      const updated = await tx.indicator.update({
        where: { id: indicator.id },
        data: {
          currentValue: body.value,
          trend: trend as any,
          status: status as any,
          lastMeasuredAt: now,
          nextDueAt,
          offTargetStreak,
          updatedById: req.auth?.userId ?? null,
        },
        include: {
          owner: { select: { id: true, email: true } },
          measurements: { orderBy: { measuredAt: 'desc' }, take: 24 },
          riskLinks: { include: { risk: { select: { id: true, code: true, title: true, probability: true, impact: true, riskLevel: true } } } },
        },
      });

      return { measurement, indicator: updated };
    });

    return reply.code(201).send(res);
  });

  // POST /indicadores/:id/risk-links — Vincular riesgo a indicador
  app.post('/:id/risk-links', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, FEATURE_KEY);
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });

    const tenantId = req.db.tenantId;
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = z
      .object({
        riskId: z.string().uuid(),
        offTargetProbDelta: z.number().int().min(0).max(5).optional(),
        warningProbDelta: z.number().int().min(0).max(5).optional(),
        minSuggestedProb: z.number().int().min(1).max(5).optional().nullable(),
      })
      .parse(req.body);

    const link = await app.runWithDbContext(req, async (tx: any) => {
      const indicator = await tx.indicator.findFirst({ where: { id, tenantId, deletedAt: null } });
      if (!indicator) throw new Error('Resource not found');

      return tx.indicatorRiskLink.upsert({
        where: { tenantId_indicatorId_riskId: { tenantId, indicatorId: indicator.id, riskId: body.riskId } },
        update: {
          offTargetProbDelta: body.offTargetProbDelta ?? undefined,
          warningProbDelta: body.warningProbDelta ?? undefined,
          minSuggestedProb: body.minSuggestedProb === undefined ? undefined : body.minSuggestedProb,
        },
        create: {
          tenantId,
          indicatorId: indicator.id,
          riskId: body.riskId,
          offTargetProbDelta: body.offTargetProbDelta ?? 1,
          warningProbDelta: body.warningProbDelta ?? 1,
          minSuggestedProb: body.minSuggestedProb ?? null,
        },
        include: {
          risk: { select: { id: true, code: true, title: true, probability: true, impact: true, riskLevel: true, status: true } },
        },
      });
    });

    return reply.code(201).send({ link });
  });

  // DELETE /indicadores/:id/risk-links/:linkId — Desvincular riesgo
  app.delete('/:id/risk-links/:linkId', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, FEATURE_KEY);
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });

    const tenantId = req.db.tenantId;
    const { id, linkId } = z.object({ id: z.string().uuid(), linkId: z.string().uuid() }).parse(req.params);

    await app.runWithDbContext(req, async (tx: any) => {
      const indicator = await tx.indicator.findFirst({ where: { id, tenantId, deletedAt: null } });
      if (!indicator) throw new Error('Resource not found');
      await tx.indicatorRiskLink.delete({ where: { id: linkId } });
    });

    return reply.send({ ok: true });
  });

  // PATCH /indicadores/:id — Actualizar indicador
  app.patch('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, FEATURE_KEY);
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });

    const tenantId = req.db.tenantId;
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    const schema = z.object({
      name: z.string().min(2).optional(),
      description: z.string().optional(),
      category: z.string().min(2).optional(),
      process: z.string().optional(),
      standard: z.string().optional(),
      targetValue: z.number().optional(),
      warningValue: z.number().optional(),
      criticalValue: z.number().optional(),
      unit: z.string().min(1).optional(),
      frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']).optional(),
      direction: z.enum(['HIGHER_BETTER', 'LOWER_BETTER']).optional(),
      isActive: z.boolean().optional(),
      ncrTriggerStreak: z.number().int().min(1).max(12).optional(),
      ownerId: z.string().uuid().optional().nullable(),
    });

    const body = schema.parse(req.body);

    const indicator = await app.runWithDbContext(req, async (tx: any) => {
      const existing = await tx.indicator.findFirst({
        where: { id, tenantId, deletedAt: null },
      });
      if (!existing) return null;

      const data: any = {};
      if (body.name !== undefined) data.name = body.name;
      if (body.description !== undefined) data.description = body.description;
      if (body.category !== undefined) data.category = body.category;
      if (body.process !== undefined) data.process = body.process;
      if (body.standard !== undefined) data.standard = body.standard;
      if (body.targetValue !== undefined) data.targetValue = body.targetValue;
      if (body.warningValue !== undefined) data.warningValue = body.warningValue;
      if (body.criticalValue !== undefined) data.criticalValue = body.criticalValue;
      if (body.unit !== undefined) data.unit = body.unit;
      if (body.frequency !== undefined) data.frequency = body.frequency;
      if (body.direction !== undefined) data.direction = body.direction;
      if (body.isActive !== undefined) data.isActive = body.isActive;
      if (body.ncrTriggerStreak !== undefined) data.ncrTriggerStreak = body.ncrTriggerStreak;
      if (body.ownerId !== undefined) data.ownerId = body.ownerId;
      data.updatedById = req.auth?.userId ?? null;

      return tx.indicator.update({
        where: { id },
        data,
        include: {
          owner: { select: { id: true, email: true } },
          measurements: { orderBy: { measuredAt: 'desc' }, take: 24 },
          riskLinks: { include: { risk: { select: { id: true, code: true, title: true, probability: true, impact: true, riskLevel: true } } } },
        },
      });
    });

    if (!indicator) return reply.code(404).send({ error: 'Resource not found' });
    return reply.send({ indicator });
  });

  // DELETE /indicadores/:id — Eliminar indicador (soft delete)
  app.delete('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, FEATURE_KEY);
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });

    const tenantId = req.db.tenantId;
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    const result = await app.runWithDbContext(req, async (tx: any) => {
      const existing = await tx.indicator.findFirst({
        where: { id, tenantId, deletedAt: null },
      });
      if (!existing) return { kind: 'not_found' as const };

      await tx.indicator.update({
        where: { id },
        data: { deletedAt: new Date(), updatedById: req.auth?.userId ?? null },
      });
      return { kind: 'ok' as const };
    });

    if (result.kind === 'not_found') return reply.code(404).send({ error: 'Resource not found' });
    return reply.send({ success: true, message: 'Indicador eliminado' });
  });
};
