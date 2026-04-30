import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

// -------- SCHEMAS --------
const emptyToUndefined = <T extends z.ZodTypeAny>(schema: T) => z.preprocess((val) => (val === '' || val === null ? undefined : val), schema);

const objectiveSchema = z.object({
  code: z.string().min(1),
  title: z.string().min(1),
  description: emptyToUndefined(z.string().optional()),
  year: z.number().int(),
  standard: emptyToUndefined(z.string().optional()),
  target: z.string().min(1),
  targetValue: z.number().optional(),
  unit: emptyToUndefined(z.string().optional()),
  type: emptyToUndefined(z.string().optional()),
  sites: z.array(z.string()).optional(),
  responsibleId: emptyToUndefined(z.string().uuid().optional()),
  startDate: emptyToUndefined(z.string().optional()),
  endDate: emptyToUndefined(z.string().optional()),
  status: emptyToUndefined(z.string().optional()),
  progress: z.number().int().min(0).max(100).optional(),
  indicatorId: emptyToUndefined(z.string().uuid().optional()),
  notes: emptyToUndefined(z.string().optional()),
  policyId: emptyToUndefined(z.string().uuid().nullable().optional()),
  processId: emptyToUndefined(z.string().uuid().optional()),
});

const activitySchema = z.object({
  name: z.string().min(1),
  responsibleId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.string().optional(),
});

const relationSchema = z.object({
  id: z.string().uuid(),
});

// -------- HELPERS --------
const parseDate = (v: string | undefined) => v ? new Date(v) : undefined;

// -------- ROUTES --------
export const objectivesRoutes: FastifyPluginAsync = async (app) => {

  // === OBJECTIVES CRUD ===

  // List
  app.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });
    const tenantId = req.db.tenantId;
    const q = req.query as any;
    const where: any = { tenantId, deletedAt: null };
    if (q.year) where.year = Number(q.year);
    if (q.status) where.status = q.status;
    if (q.policyId) where.policyId = q.policyId;
    if (q.processId) where.processId = q.processId;
    if (q.search) {
      where.OR = [
        { title: { contains: q.search, mode: 'insensitive' } },
        { code: { contains: q.search, mode: 'insensitive' } },
      ];
    }
    const items = await app.runWithDbContext(req, async (tx: any) => {
      return tx.sgiObjective.findMany({
        where,
        include: {
          policy: { select: { id: true, name: true } },
          process: { select: { id: true, name: true } },
          activities: true,
          indicators: true,
          audits: true,
          capas: true,
          risks: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    });
    return reply.send({ items });
  });

  // Create
  app.post('/', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });
    const tenantId = req.db.tenantId;
    let data;
    try {
      data = objectiveSchema.parse(req.body);
    } catch (e: any) {
      console.error('[objectives POST] Zod validation error:', e.errors || e.message, 'Body keys:', Object.keys(req.body || {}));
      return reply.code(400).send({ error: 'Validation failed', details: e.errors || e.message });
    }
    // Normalize undefined/null for optional UUID fields
    const item = await app.runWithDbContext(req, async (tx: any) => {
      return tx.sgiObjective.create({
        data: {
          tenantId,
          ...data,
          policyId: data.policyId ?? null,
          processId: data.processId ?? null,
          indicatorId: data.indicatorId ?? null,
          responsibleId: data.responsibleId ?? null,
          startDate: data.startDate ? parseDate(data.startDate) : null,
          endDate: data.endDate ? parseDate(data.endDate) : null,
          sites: data.sites ?? [],
        },
        include: { policy: true, process: true },
      });
    });
    return reply.code(201).send({ item });
  });

  // === POLICIES (must be before /:id to avoid matching 'policies' as an id) ===
  app.get('/policies', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });
    const tenantId = req.db.tenantId;
    const q = req.query as any;
    const items = await app.runWithDbContext(req, async (tx: any) => {
      return tx.policy.findMany({
        where: { tenantId, deletedAt: null, ...(q.scope ? { scope: q.scope } : {}) },
        orderBy: { createdAt: 'desc' },
      });
    });
    return reply.send(items);
  });

  app.post('/policies', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });
    const tenantId = req.db.tenantId;
    const schema = z.object({ name: z.string().min(1), content: z.string().optional(), scope: z.string().optional(), active: z.boolean().optional() });
    const data = schema.parse(req.body);
    const item = await app.runWithDbContext(req, async (tx: any) => {
      return tx.policy.create({ data: { tenantId, ...data } });
    });
    return reply.code(201).send(item);
  });

  app.patch('/policies/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });
    const { id } = req.params as { id: string };
    const schema = z.object({ name: z.string().optional(), content: z.string().optional(), scope: z.string().optional(), active: z.boolean().optional() });
    const data = schema.parse(req.body);
    const item = await app.runWithDbContext(req, async (tx: any) => {
      return tx.policy.update({ where: { id }, data });
    });
    return reply.send(item);
  });

  app.delete('/policies/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });
    const { id } = req.params as { id: string };
    await app.runWithDbContext(req, async (tx: any) => {
      return tx.policy.update({ where: { id }, data: { deletedAt: new Date() } });
    });
    return reply.send({ success: true });
  });

  // Get one
  app.get('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });
    const tenantId = req.db.tenantId;
    const { id } = req.params as { id: string };
    const item = await app.runWithDbContext(req, async (tx: any) => {
      return tx.sgiObjective.findFirst({
        where: { id, tenantId, deletedAt: null },
        include: {
          policy: true,
          process: true,
          activities: true,
          indicators: { include: { indicator: true } },
          audits: { include: { audit: true } },
          capas: { include: { capa: true } },
          risks: { include: { risk: true } },
        },
      });
    });
    if (!item) return reply.code(404).send({ error: 'Not found' });
    return reply.send({ item });
  });

  // Update
  app.patch('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });
    const tenantId = req.db.tenantId;
    const { id } = req.params as { id: string };
    const body = objectiveSchema.partial().parse(req.body);
    // Convert empty policyId to null to prevent Prisma errors
    if (body.policyId === '') body.policyId = null;
    const item = await app.runWithDbContext(req, async (tx: any) => {
      return tx.sgiObjective.update({
        where: { id },
        data: {
          ...body,
          startDate: body.startDate !== undefined ? parseDate(body.startDate) : undefined,
          endDate: body.endDate !== undefined ? parseDate(body.endDate) : undefined,
          sites: body.sites ?? undefined,
          updatedAt: new Date(),
        },
      });
    });
    return reply.send({ item });
  });

  // Soft delete
  app.delete('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });
    const tenantId = req.db.tenantId;
    const { id } = req.params as { id: string };
    await app.runWithDbContext(req, async (tx: any) => {
      return tx.sgiObjective.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
    });
    return reply.send({ success: true });
  });

  // === ACTIVITIES ===
  app.post('/:id/activities', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });
    const tenantId = req.db.tenantId;
    const { id } = req.params as { id: string };
    const data = activitySchema.parse(req.body);
    const item = await app.runWithDbContext(req, async (tx: any) => {
      return tx.objectiveActivity.create({
        data: {
          tenantId,
          objectiveId: id,
          ...data,
          startDate: parseDate(data.startDate),
          endDate: parseDate(data.endDate),
        },
      });
    });
    return reply.code(201).send({ item });
  });

  app.patch('/activities/:activityId', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });
    const { activityId } = req.params as { activityId: string };
    const data = activitySchema.partial().parse(req.body);
    const item = await app.runWithDbContext(req, async (tx: any) => {
      return tx.objectiveActivity.update({
        where: { id: activityId },
        data: {
          ...data,
          startDate: data.startDate !== undefined ? parseDate(data.startDate) : undefined,
          endDate: data.endDate !== undefined ? parseDate(data.endDate) : undefined,
        },
      });
    });
    return reply.send({ item });
  });

  app.delete('/activities/:activityId', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });
    const { activityId } = req.params as { activityId: string };
    await app.runWithDbContext(req, async (tx: any) => {
      return tx.objectiveActivity.delete({ where: { id: activityId } });
    });
    return reply.send({ success: true });
  });

  // === INDICATORS ===
  app.post('/:id/indicators', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });
    const tenantId = req.db.tenantId;
    const { id } = req.params as { id: string };
    const { id: indicatorId } = relationSchema.parse(req.body);
    const item = await app.runWithDbContext(req, async (tx: any) => {
      return tx.objectiveIndicator.create({
        data: { tenantId, objectiveId: id, indicatorId },
      });
    });
    return reply.code(201).send({ item });
  });

  app.delete('/indicators/:relationId', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });
    const { relationId } = req.params as { relationId: string };
    await app.runWithDbContext(req, async (tx: any) => {
      return tx.objectiveIndicator.delete({ where: { id: relationId } });
    });
    return reply.send({ success: true });
  });

  // === AUDITS ===
  app.post('/:id/audits', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });
    const tenantId = req.db.tenantId;
    const { id } = req.params as { id: string };
    const { id: auditId } = relationSchema.parse(req.body);
    const item = await app.runWithDbContext(req, async (tx: any) => {
      return tx.objectiveAudit.create({
        data: { tenantId, objectiveId: id, auditId },
      });
    });
    return reply.code(201).send({ item });
  });

  app.delete('/audits/:relationId', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });
    const { relationId } = req.params as { relationId: string };
    await app.runWithDbContext(req, async (tx: any) => {
      return tx.objectiveAudit.delete({ where: { id: relationId } });
    });
    return reply.send({ success: true });
  });

  // === CAPAS ===
  app.post('/:id/capas', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });
    const tenantId = req.db.tenantId;
    const { id } = req.params as { id: string };
    const { id: capaId } = relationSchema.parse(req.body);
    const item = await app.runWithDbContext(req, async (tx: any) => {
      return tx.objectiveCAPA.create({
        data: { tenantId, objectiveId: id, capaId },
      });
    });
    return reply.code(201).send({ item });
  });

  app.delete('/capas/:relationId', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });
    const { relationId } = req.params as { relationId: string };
    await app.runWithDbContext(req, async (tx: any) => {
      return tx.objectiveCAPA.delete({ where: { id: relationId } });
    });
    return reply.send({ success: true });
  });

  // === RISKS ===
  app.post('/:id/risks', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });
    const tenantId = req.db.tenantId;
    const { id } = req.params as { id: string };
    const { id: riskId } = relationSchema.parse(req.body);
    const item = await app.runWithDbContext(req, async (tx: any) => {
      return tx.objectiveRisk.create({
        data: { tenantId, objectiveId: id, riskId },
      });
    });
    return reply.code(201).send({ item });
  });

  app.delete('/risks/:relationId', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });
    const { relationId } = req.params as { relationId: string };
    await app.runWithDbContext(req, async (tx: any) => {
      return tx.objectiveRisk.delete({ where: { id: relationId } });
    });
    return reply.send({ success: true });
  });


  // === DASHBOARD STATS ===
  app.get('/stats/summary', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });
    const tenantId = req.db.tenantId;
    const q = req.query as any;
    const year = q.year ? Number(q.year) : new Date().getFullYear();
    const stats = await app.runWithDbContext(req, async (tx: any) => {
      const total = await tx.sgiObjective.count({ where: { tenantId, deletedAt: null, year } });
      const inProgress = await tx.sgiObjective.count({ where: { tenantId, deletedAt: null, year, status: 'IN_PROGRESS' } });
      const achieved = await tx.sgiObjective.count({ where: { tenantId, deletedAt: null, year, status: 'ACHIEVED' } });
      const planned = await tx.sgiObjective.count({ where: { tenantId, deletedAt: null, year, status: 'PLANNED' } });
      const notAchieved = await tx.sgiObjective.count({ where: { tenantId, deletedAt: null, year, status: 'NOT_ACHIEVED' } });
      const cancelled = await tx.sgiObjective.count({ where: { tenantId, deletedAt: null, year, status: 'CANCELLED' } });
      const avgProgress = await tx.sgiObjective.aggregate({
        where: { tenantId, deletedAt: null, year },
        _avg: { progress: true },
      });
      return {
        total,
        inProgress,
        achieved,
        planned,
        notAchieved,
        cancelled,
        atRisk: notAchieved,
        delayed: notAchieved,
        avgProgress: Math.round(avgProgress._avg?.progress ?? 0),
      };
    });
    return reply.send(stats);
  });
};
