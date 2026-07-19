import { isSuperAdmin, getEffectiveTenantId } from '../utils/tenant-bypass.js';
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { assessObjective, OBJECTIVE_RISK_THRESHOLDS } from '../domain/objectiveAssessment.js';

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
  responsibleId: emptyToUndefined(z.string().optional()),
  startDate: emptyToUndefined(z.string().optional()),
  endDate: emptyToUndefined(z.string().optional()),
  status: emptyToUndefined(z.string().optional()),
  progress: z.number().int().min(0).max(100).optional(),
  indicatorId: emptyToUndefined(z.string().optional()),
  notes: emptyToUndefined(z.string().optional()),
  policyId: emptyToUndefined(z.string().uuid().nullable().optional()),
  processId: emptyToUndefined(z.string().optional()),
  originType: emptyToUndefined(z.string().optional()),
  originId: emptyToUndefined(z.string().optional()),
  strategicPriority: emptyToUndefined(z.string().optional()),
  strategicWeight: z.number().optional(),
  contextYear: z.number().int().optional(),
  // Gestión y medición avanzada (aditivo)
  primaryIndicatorId: emptyToUndefined(z.string().optional()),
  baselineValue: z.number().optional(),
  progressMethod: emptyToUndefined(z.string().optional()),
  lastProgressNote: emptyToUndefined(z.string().optional()),
  responsiblePositionId: emptyToUndefined(z.string().optional()),
  involvedProcessIds: z.array(z.string()).optional(),
  policyIds: z.array(z.string()).optional(),
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
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const cleanUUID = (v: string | undefined | null) => (v && UUID_RE.test(v)) ? v : undefined;

// Selección ligera del KPI vinculado (fuente de verdad = Indicator)
const KPI_INCLUDE = { select: { id: true, code: true, name: true, currentValue: true, targetValue: true, unit: true, direction: true, frequency: true } };

// Enriquecer objetivo con evaluación determinística (progreso esperado / desviación / riesgo)
function enrichObjective(obj: any) {
  if (!obj) return obj;
  const _assessment = assessObjective({
    status: obj.status,
    progress: obj.progress,
    progressMethod: obj.progressMethod,
    startDate: obj.startDate,
    endDate: obj.endDate,
    baselineValue: obj.baselineValue,
    activities: obj.activities,
    primaryIndicator: obj.primaryIndicator,
  });
  return { ...obj, _assessment };
}

async function resolveUserName(tx: any, userId?: string | null): Promise<string | null> {
  if (!userId) return null;
  try {
    const u = await tx.platformUser.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true, email: true } });
    if (!u) return null;
    const full = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim();
    return full || u.email || null;
  } catch { return null; }
}

// -------- ROUTES --------
export const objectivesRoutes: FastifyPluginAsync = async (app) => {

  // === OBJECTIVES CRUD ===

  // List
  app.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const q = req.query as any;
    const where: any = { tenantId, deletedAt: null };
    if (q.year) where.year = Number(q.year);
    if (q.status) where.status = q.status;
    if (q.policyId) where.policyId = q.policyId;
    if (q.processId) where.processId = q.processId;
    if (q.originType) where.originType = q.originType;
    if (q.standard) where.standard = q.standard;
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
          primaryIndicator: KPI_INCLUDE,
          responsiblePosition: { select: { id: true, name: true, code: true } },
          activities: true,
          indicators: true,
          audits: true,
          capas: true,
          risks: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    });
    return reply.send({ items: items.map(enrichObjective) });
  });

  // Create
  app.post('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    let data;
    try {
      data = objectiveSchema.parse(req.body);
    } catch (e: any) {
      console.error('[objectives POST] Zod validation error:', e.errors || e.message, 'Body keys:', Object.keys(req.body || {}));
      return reply.code(400).send({ error: 'Validación fallida', details: e.errors || e.message });
    }
    // Normalize undefined/null for optional UUID fields (strip invalid UUIDs to prevent Prisma errors)
    const userId = (req as any).auth?.userId ?? null;
    const item = await app.runWithDbContext(req, async (tx: any) => {
      const created = await tx.sgiObjective.create({
        data: {
          tenantId,
          ...data,
          policyId: cleanUUID(data.policyId) ?? null,
          processId: cleanUUID(data.processId) ?? null,
          indicatorId: cleanUUID(data.indicatorId) ?? null,
          responsibleId: cleanUUID(data.responsibleId) ?? null,
          primaryIndicatorId: cleanUUID((data as any).primaryIndicatorId) ?? null,
          responsiblePositionId: cleanUUID((data as any).responsiblePositionId) ?? null,
          involvedProcessIds: ((data as any).involvedProcessIds ?? []).filter((v: string) => UUID_RE.test(v)),
          policyIds: ((data as any).policyIds ?? []).filter((v: string) => UUID_RE.test(v)),
          startDate: data.startDate ? parseDate(data.startDate) : null,
          endDate: data.endDate ? parseDate(data.endDate) : null,
          sites: data.sites ?? [],
        },
        include: { policy: true, process: true, primaryIndicator: KPI_INCLUDE, responsiblePosition: { select: { id: true, name: true, code: true } }, activities: true },
      });
      // Historial: creación inicial (origen SYSTEM)
      await tx.objectiveProgressLog.create({
        data: {
          tenantId,
          objectiveId: created.id,
          userId,
          userName: await resolveUserName(tx, userId),
          previousProgress: null,
          newProgress: created.progress ?? 0,
          previousStatus: null,
          newStatus: created.status ?? 'PLANNED',
          source: 'SYSTEM',
          justification: 'Creación del objetivo',
        },
      });
      return created;
    });
    return reply.code(201).send({ item: enrichObjective(item) });
  });

  // === POLICIES (must be before /:id to avoid matching 'policies' as an id) ===
  app.get('/policies', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
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
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const schema = z.object({ name: z.string().min(1), content: emptyToUndefined(z.string().optional()), scope: emptyToUndefined(z.string().optional()), active: z.boolean().optional(), signedPdfUrl: emptyToUndefined(z.string().optional()) });
    let data;
    try {
      data = schema.parse(req.body);
    } catch (e: any) {
      console.error('[policies POST] Zod validation error:', e.errors || e.message, 'Body keys:', Object.keys(req.body || {}));
      return reply.code(400).send({ error: 'Validación fallida', details: e.errors || e.message });
    }
    const item = await app.runWithDbContext(req, async (tx: any) => {
      return tx.policy.create({ data: { tenantId, ...data } });
    });
    return reply.code(201).send(item);
  });

  app.patch('/policies/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    const schema = z.object({ name: z.string().optional(), content: emptyToUndefined(z.string().optional()), scope: emptyToUndefined(z.string().optional()), active: z.boolean().optional(), signedPdfUrl: emptyToUndefined(z.string().optional()) });
    let data;
    try {
      data = schema.parse(req.body);
    } catch (e: any) {
      console.error('[policies PATCH] Zod validation error:', e.errors || e.message, 'Body keys:', Object.keys(req.body || {}));
      return reply.code(400).send({ error: 'Validación fallida', details: e.errors || e.message });
    }
    const item = await app.runWithDbContext(req, async (tx: any) => {
      return tx.policy.update({ where: { id }, data });
    });
    return reply.send(item);
  });

  app.delete('/policies/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    await app.runWithDbContext(req, async (tx: any) => {
      return tx.policy.update({ where: { id }, data: { deletedAt: new Date() } });
    });
    return reply.send({ success: true });
  });

  // GET /processes — lista de procesos para selector (debe estar antes de /:id)
  app.get('/processes', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const items = await app.runWithDbContext(req, async (tx: any) => {
      return tx.process.findMany({
        where: { tenantId, status: 'active' },
        select: { id: true, name: true, code: true, layer: true },
        orderBy: [{ layer: 'asc' }, { name: 'asc' }],
      });
    });
    return reply.send(items);
  });

  // GET /kpis — lista ligera de indicadores/KPI para vincular (fuente = Indicator, sin duplicar catálogo)
  app.get('/kpis', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const items = await app.runWithDbContext(req, async (tx: any) => {
      return tx.indicator.findMany({
        where: { tenantId, deletedAt: null },
        select: { id: true, code: true, name: true, unit: true, currentValue: true, targetValue: true, direction: true, frequency: true, category: true },
        orderBy: { name: 'asc' },
      });
    });
    return reply.send(items);
  });

  // GET /positions — puestos/roles para responsable funcional (fuente = Position)
  app.get('/positions', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const items = await app.runWithDbContext(req, async (tx: any) => {
      return tx.position.findMany({
        where: { tenantId, deletedAt: null },
        select: { id: true, name: true, code: true },
        orderBy: { name: 'asc' },
      });
    });
    return reply.send(items);
  });

  // Get one
  app.get('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    const item = await app.runWithDbContext(req, async (tx: any) => {
      return tx.sgiObjective.findFirst({
        where: { id, tenantId, deletedAt: null },
        include: {
          policy: true,
          process: true,
          primaryIndicator: KPI_INCLUDE,
          responsiblePosition: { select: { id: true, name: true, code: true } },
          activities: true,
          indicators: true,
          audits: true,
          capas: true,
          risks: true,
          progressLogs: { orderBy: { createdAt: 'desc' }, take: 100 },
        },
      });
    });
    if (!item) return reply.code(404).send({ error: 'Not found' });
    return reply.send({ item: enrichObjective(item) });
  });

  // Update
  app.patch('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    const body = objectiveSchema.partial().parse(req.body);
    // Convert empty policyId to null to prevent Prisma errors
    if (body.policyId === '') body.policyId = null;
    const userId = (req as any).auth?.userId ?? null;
    const item = await app.runWithDbContext(req, async (tx: any) => {
      const prev = await tx.sgiObjective.findFirst({ where: { id, tenantId }, select: { progress: true, status: true } });
      const data: any = {
        ...body,
        startDate: body.startDate !== undefined ? parseDate(body.startDate) : undefined,
        endDate: body.endDate !== undefined ? parseDate(body.endDate) : undefined,
        sites: body.sites ?? undefined,
        updatedAt: new Date(),
      };
      // Sanear UUIDs/arrays de los campos nuevos cuando vienen presentes
      if ((body as any).primaryIndicatorId !== undefined) data.primaryIndicatorId = cleanUUID((body as any).primaryIndicatorId) ?? null;
      if ((body as any).responsiblePositionId !== undefined) data.responsiblePositionId = cleanUUID((body as any).responsiblePositionId) ?? null;
      if ((body as any).involvedProcessIds !== undefined) data.involvedProcessIds = ((body as any).involvedProcessIds ?? []).filter((v: string) => UUID_RE.test(v));
      if ((body as any).policyIds !== undefined) data.policyIds = ((body as any).policyIds ?? []).filter((v: string) => UUID_RE.test(v));
      const updated = await tx.sgiObjective.update({ where: { id }, data });
      // Historial: registrar cambios de progreso/estado desde edición
      const progressChanged = body.progress !== undefined && prev && body.progress !== prev.progress;
      const statusChanged = body.status !== undefined && prev && body.status !== prev.status;
      if (progressChanged || statusChanged) {
        await tx.objectiveProgressLog.create({
          data: {
            tenantId,
            objectiveId: id,
            userId,
            userName: await resolveUserName(tx, userId),
            previousProgress: prev?.progress ?? null,
            newProgress: updated.progress ?? null,
            previousStatus: prev?.status ?? null,
            newStatus: updated.status ?? null,
            source: 'MANUAL',
            justification: (body as any).lastProgressNote ?? null,
          },
        });
      }
      return updated;
    });
    return reply.send({ item });
  });

  // Soft delete
  app.delete('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    await app.runWithDbContext(req, async (tx: any) => {
      return tx.sgiObjective.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
    });
    return reply.send({ success: true });
  });

  // === PROGRESS & HISTORY (medición y seguimiento determinístico) ===
  const progressSchema = z.object({
    progress: z.number().int().min(0).max(100).optional(),
    justification: emptyToUndefined(z.string().optional()),
    source: emptyToUndefined(z.string().optional()), // MANUAL | KPI | ACTIONS | SYSTEM
    status: emptyToUndefined(z.string().optional()),
    evidenceUrl: emptyToUndefined(z.string().optional()),
    evidenceName: emptyToUndefined(z.string().optional()),
  });

  app.post('/:id/progress', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    let body;
    try { body = progressSchema.parse(req.body); }
    catch (e: any) { return reply.code(400).send({ error: 'Validación fallida', details: e.errors || e.message }); }
    const source = (body.source || 'MANUAL').toUpperCase();
    // Justificación obligatoria en modo manual
    if (source === 'MANUAL' && !body.justification) {
      return reply.code(400).send({ error: 'La justificación es obligatoria para el avance manual' });
    }
    const userId = (req as any).auth?.userId ?? null;
    const result = await app.runWithDbContext(req, async (tx: any) => {
      const prev = await tx.sgiObjective.findFirst({
        where: { id, tenantId, deletedAt: null },
        include: { activities: { select: { status: true } }, primaryIndicator: KPI_INCLUDE },
      });
      if (!prev) return null;
      let newProgress = prev.progress ?? 0;
      let kpiValue: number | null = null;
      const method = prev.progressMethod || 'MANUAL';
      if (source === 'KPI' || (source === 'SYSTEM' && method === 'KPI')) {
        const a = assessObjective(prev);
        newProgress = a.actualProgress;
        kpiValue = prev.primaryIndicator?.currentValue ?? null;
      } else if (source === 'ACTIONS' || (source === 'SYSTEM' && method === 'ACTIONS')) {
        const a = assessObjective(prev);
        newProgress = a.actualProgress;
      } else if (body.progress !== undefined) {
        newProgress = body.progress;
      }
      const newStatus = body.status || prev.status;
      const updated = await tx.sgiObjective.update({
        where: { id },
        data: {
          progress: newProgress,
          status: newStatus,
          lastProgressNote: source === 'MANUAL' ? (body.justification ?? prev.lastProgressNote) : prev.lastProgressNote,
          updatedAt: new Date(),
        },
      });
      await tx.objectiveProgressLog.create({
        data: {
          tenantId,
          objectiveId: id,
          userId,
          userName: await resolveUserName(tx, userId),
          previousProgress: prev.progress ?? null,
          newProgress,
          previousStatus: prev.status ?? null,
          newStatus,
          kpiValue,
          justification: body.justification ?? null,
          source,
          evidenceUrl: body.evidenceUrl ?? null,
          evidenceName: body.evidenceName ?? null,
        },
      });
      return updated;
    });
    if (!result) return reply.code(404).send({ error: 'Not found' });
    return reply.send({ item: result });
  });

  app.get('/:id/history', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    const logs = await app.runWithDbContext(req, async (tx: any) => {
      return tx.objectiveProgressLog.findMany({
        where: { tenantId, objectiveId: id },
        orderBy: { createdAt: 'desc' },
        take: 200,
      });
    });
    return reply.send({ logs });
  });

  // === ACTIVITIES ===
  app.post('/:id/activities', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
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
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
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
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { activityId } = req.params as { activityId: string };
    await app.runWithDbContext(req, async (tx: any) => {
      return tx.objectiveActivity.delete({ where: { id: activityId } });
    });
    return reply.send({ success: true });
  });

  // === INDICATORS ===
  app.post('/:id/indicators', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
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
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { relationId } = req.params as { relationId: string };
    await app.runWithDbContext(req, async (tx: any) => {
      return tx.objectiveIndicator.delete({ where: { id: relationId } });
    });
    return reply.send({ success: true });
  });

  // === AUDITS ===
  app.post('/:id/audits', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
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
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { relationId } = req.params as { relationId: string };
    await app.runWithDbContext(req, async (tx: any) => {
      return tx.objectiveAudit.delete({ where: { id: relationId } });
    });
    return reply.send({ success: true });
  });

  // === CAPAS ===
  app.post('/:id/capas', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
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
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { relationId } = req.params as { relationId: string };
    await app.runWithDbContext(req, async (tx: any) => {
      return tx.objectiveCAPA.delete({ where: { id: relationId } });
    });
    return reply.send({ success: true });
  });

  // === RISKS ===
  app.post('/:id/risks', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
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
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { relationId } = req.params as { relationId: string };
    await app.runWithDbContext(req, async (tx: any) => {
      return tx.objectiveRisk.delete({ where: { id: relationId } });
    });
    return reply.send({ success: true });
  });


  // === DASHBOARD STATS ===
  app.get('/stats/summary', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const q = req.query as any;
    const year = q.year ? Number(q.year) : new Date().getFullYear();
    const stats = await app.runWithDbContext(req, async (tx: any) => {
      const objs = await tx.sgiObjective.findMany({
        where: { tenantId, deletedAt: null, year },
        include: { activities: { select: { status: true } }, primaryIndicator: KPI_INCLUDE },
      });
      const now = new Date();
      let planned = 0, inProgress = 0, achieved = 0, notAchieved = 0, cancelled = 0;
      let atRisk = 0, delayed = 0, progressSum = 0;
      for (const o of objs) {
        const a = assessObjective(o, now);
        progressSum += a.actualProgress;
        // Conteo por estado real almacenado (reconciliable con el total)
        switch (o.status) {
          case 'IN_PROGRESS': inProgress++; break;
          case 'ACHIEVED': achieved++; break;
          case 'NOT_ACHIEVED': notAchieved++; break;
          case 'CANCELLED': cancelled++; break;
          default: planned++; break;
        }
        // Indicadores determinísticos (subconjuntos informativos)
        if (a.isAtRisk) atRisk++;
        if (a.isDelayed) delayed++;
      }
      const total = objs.length;
      const avg = total ? Math.round(progressSum / total) : 0;
      return {
        total,
        planned,
        inProgress,
        achieved,
        notAchieved,
        cancelled,
        atRisk,
        delayed,
        averageProgress: avg,
        avgProgress: avg,
        thresholds: OBJECTIVE_RISK_THRESHOLDS,
      };
    });
    return reply.send(stats);
  });
};
