import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

const FEATURE_KEY = 'no_conformidades';

const uuidOrEmpty = z.preprocess((val) => (val === '' || val === null ? undefined : val), z.string().uuid().optional());

const createSchema = z.object({
  title: z.string().min(2),
  description: z.string().min(5),
  severity: z.enum(['CRITICAL', 'MAJOR', 'MINOR', 'OBSERVATION']),
  source: z.enum(['INTERNAL_AUDIT', 'EXTERNAL_AUDIT', 'CUSTOMER_COMPLAINT', 'PROCESS_DEVIATION', 'SUPPLIER_ISSUE', 'AI_FINDING', 'OTHER', 'STAKEHOLDER']),
  standard: z.string().optional(),
  clause: z.string().optional(),
  dueDate: z.string().optional(),
  detectedAt: z.string().optional(),
  assignedToId: uuidOrEmpty,

  indicatorId: uuidOrEmpty,
  indicatorMeasurementId: uuidOrEmpty,
  stakeholderId: uuidOrEmpty,
});

export const ncrRoutes: FastifyPluginAsync = async (app) => {
  // GET /ncr — Listar no conformidades
  app.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    // app.requireFeature(req, FEATURE_KEY);
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant requerido' });

    const tenantId = req.db.tenantId;
    const ncrs = await app.runWithDbContext(req, async (tx: any) => {
      return tx.nonConformity.findMany({
        where: { tenantId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        include: {
          assignedTo: { select: { id: true, email: true } },
          createdBy: { select: { id: true, email: true } },
        },
      });
    });

    return reply.send({ ncrs });
  });

  // GET /ncr/stats — Estadísticas
  app.get('/stats', async (req: FastifyRequest, reply: FastifyReply) => {
    // app.requireFeature(req, FEATURE_KEY);
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant requerido' });

    const tenantId = req.db.tenantId;
    const ncrs = await app.runWithDbContext(req, async (tx: any) => {
      return tx.nonConformity.findMany({
        where: { tenantId, deletedAt: null },
        select: { id: true, status: true, severity: true, dueDate: true, closedAt: true },
      });
    });

    const now = Date.now();
    const overdue = ncrs.filter((n: any) => n.dueDate && !n.closedAt && new Date(n.dueDate).getTime() < now).length;

    const stats = {
      total: ncrs.length,
      open: ncrs.filter((n: any) => n.status === 'OPEN').length,
      inProgress: ncrs.filter((n: any) => ['IN_ANALYSIS', 'ACTION_PLANNED', 'IN_PROGRESS', 'VERIFICATION'].includes(n.status)).length,
      closed: ncrs.filter((n: any) => n.status === 'CLOSED').length,
      critical: ncrs.filter((n: any) => n.severity === 'CRITICAL').length,
      major: ncrs.filter((n: any) => n.severity === 'MAJOR').length,
      minor: ncrs.filter((n: any) => n.severity === 'MINOR').length,
      overdue,
      bySeverity: {
        CRITICAL: ncrs.filter((n: any) => n.severity === 'CRITICAL').length,
        MAJOR: ncrs.filter((n: any) => n.severity === 'MAJOR').length,
        MINOR: ncrs.filter((n: any) => n.severity === 'MINOR').length,
        OBSERVATION: ncrs.filter((n: any) => n.severity === 'OBSERVATION').length,
      },
      byStatus: {
        OPEN: ncrs.filter((n: any) => n.status === 'OPEN').length,
        IN_ANALYSIS: ncrs.filter((n: any) => n.status === 'IN_ANALYSIS').length,
        ACTION_PLANNED: ncrs.filter((n: any) => n.status === 'ACTION_PLANNED').length,
        IN_PROGRESS: ncrs.filter((n: any) => n.status === 'IN_PROGRESS').length,
        VERIFICATION: ncrs.filter((n: any) => n.status === 'VERIFICATION').length,
        CLOSED: ncrs.filter((n: any) => n.status === 'CLOSED').length,
        CANCELLED: ncrs.filter((n: any) => n.status === 'CANCELLED').length,
      },
    };

    return reply.send({ stats });
  });

  // POST /ncr — Crear no conformidad
  app.post('/', async (req: FastifyRequest, reply: FastifyReply) => {
    // app.requireFeature(req, FEATURE_KEY);
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant requerido' });
    const tenantId = req.db.tenantId;

    let body: any;
    try {
      body = createSchema.parse(req.body);
    } catch (e: any) {
      console.error('[NCR CREATE] Zod validation error:', e.errors || e.message, 'Body keys:', Object.keys(req.body || {}));
      return reply.code(400).send({ error: 'Validación fallida', details: e.errors || e.message });
    }

    try {
    const ncr = await app.runWithDbContext(req, async (tx: any) => {
      const year = new Date().getFullYear();
      const count = await tx.nonConformity.count({
        where: { tenantId, code: { startsWith: `NCR-${year}-` } },
      });
      const code = `NCR-${year}-${String(count + 1).padStart(3, '0')}`;

      return tx.nonConformity.create({
        data: {
          tenantId,
          code,
          title: body.title,
          description: body.description,
          severity: body.severity,
          source: body.source,
          status: 'OPEN',
          standard: body.standard ?? null,
          clause: body.clause ?? null,
          dueDate: body.dueDate ? new Date(body.dueDate) : null,
          assignedToId: body.assignedToId ?? null,
          indicatorId: body.indicatorId ?? null,
          indicatorMeasurementId: body.indicatorMeasurementId ?? null,
          stakeholderId: body.stakeholderId ?? null,
          createdById: req.auth?.userId ?? null,
          updatedById: req.auth?.userId ?? null,
        },
        include: {
          assignedTo: { select: { id: true, email: true } },
          createdBy: { select: { id: true, email: true } },
        },
      });
    });

    return reply.code(201).send({ ncr });
    } catch (err: any) {
      console.error('[NCR CREATE] Prisma error:', err.message, err.code, err.meta);
      return reply.code(500).send({ error: 'Database error', details: err.message });
    }
  });

  // GET /ncr/:id — Detalle
  app.get('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    // app.requireFeature(req, FEATURE_KEY);
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant requerido' });
    const tenantId = req.db.tenantId;

    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const ncr = await app.runWithDbContext(req, async (tx: any) => {
      return tx.nonConformity.findFirst({
        where: { id, tenantId, deletedAt: null },
        include: {
          assignedTo: { select: { id: true, email: true } },
          createdBy: { select: { id: true, email: true } },
        },
      });
    });

    if (!ncr) return reply.code(404).send({ error: 'Recurso no encontrado' });
    return reply.send({ ncr });
  });

  // PATCH /ncr/:id — Actualizar no conformidad
  app.patch('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    // app.requireFeature(req, FEATURE_KEY);
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant requerido' });
    const tenantId = req.db.tenantId;

    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    const updateSchema = z.object({
      status: z.enum(['OPEN', 'IN_ANALYSIS', 'ACTION_PLANNED', 'IN_PROGRESS', 'VERIFICATION', 'CLOSED', 'CANCELLED']).optional(),
      severity: z.enum(['CRITICAL', 'MAJOR', 'MINOR', 'OBSERVATION']).optional(),
      rootCause: z.string().optional(),
      correctiveAction: z.string().optional(),
      preventiveAction: z.string().optional(),
      verificationNotes: z.string().optional(),
      dueDate: z.string().datetime().optional().nullable(),
      assignedToId: z.string().uuid().optional().nullable(),
    });

    const body = updateSchema.parse(req.body);

    const ncr = await app.runWithDbContext(req, async (tx: any) => {
      const existing = await tx.nonConformity.findFirst({
        where: { id, tenantId, deletedAt: null },
      });
      if (!existing) throw new Error('NCR no encontrada');

      // Si el estado cambia a CLOSED, registrar fecha de cierre
      const closedAt = body.status === 'CLOSED' && existing.status !== 'CLOSED'
        ? new Date()
        : existing.closedAt;

      return tx.nonConformity.update({
        where: { id },
        data: {
          ...body,
          closedAt,
          updatedById: req.auth?.userId ?? null,
        },
        include: {
          assignedTo: { select: { id: true, email: true } },
          createdBy: { select: { id: true, email: true } },
        },
      });
    });

    return reply.send({ ncr });
  });

  // DELETE /ncr/:id — Eliminar no conformidad (soft delete)
  app.delete('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    // app.requireFeature(req, FEATURE_KEY);
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant requerido' });
    const tenantId = req.db.tenantId;

    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    const result = await app.runWithDbContext(req, async (tx: any) => {
      const existing = await tx.nonConformity.findFirst({
        where: { id, tenantId, deletedAt: null },
      });
      if (!existing) return { kind: 'not_found' as const };

      await tx.nonConformity.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      return { kind: 'ok' as const };
    });

    if (result.kind === 'not_found') return reply.code(404).send({ error: 'Recurso no encontrado' });
    return reply.send({ success: true, message: 'NCR eliminada' });
  });
};
