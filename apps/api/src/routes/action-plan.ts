import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { getEffectiveTenantId } from '../utils/tenant-bypass.js';
import { createGroqOnlyLLMProvider } from '../services/llm/factory.js';

const uuidOrNull = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? null : v),
  z.string().uuid().nullable().optional()
);

const createSchema = z.object({
  ncrId: uuidOrNull,
  origin: z.enum(['MANUAL','AUDIT','NCR','INCIDENT','COMPLAINT','INSPECTION','INDICATOR','MANAGEMENT_REVIEW','RISK','OTHER']).optional(),
  type: z.enum(['IMMEDIATE_CORRECTION','CORRECTIVE','PREVENTIVE','IMPROVEMENT','RISK_TREATMENT','OPPORTUNITY']).optional(),
  severity: z.string().optional(),
  site: z.string().optional(),
  area: z.string().optional(),
  process: z.string().optional(),
  findingDescription: z.string().optional(),
  requirement: z.string().optional(),
  classification: z.string().optional(),
  immediateCorrection: z.string().optional(),
  rootCauseAnalysis: z.string().optional(),
  analysisMethod: z.enum(['FIVE_WHYS','ISHIKAWA','FAULT_TREE','EIGHT_D','OTHER']).nullable().optional(),
  validatedRootCause: z.string().optional(),
  plannedAction: z.string().optional(),
  expectedResult: z.string().optional(),
  executorId: uuidOrNull,
  supervisorId: uuidOrNull,
  requiredResources: z.string().optional(),
  plannedStartDate: z.string().optional().nullable(),
  plannedEndDate: z.string().optional().nullable(),
  observations: z.string().optional(),
  priority: z.enum(['LOW','MEDIUM','HIGH','CRITICAL']).nullable().optional(),
  detectedBy: z.string().optional(),
  preventiveAction: z.string().optional(),
  processChanges: z.string().optional(),
  documentationChanges: z.string().optional(),
  initialProbability: z.number().int().min(1).max(5).nullable().optional(),
  initialImpact: z.number().int().min(1).max(5).nullable().optional(),
  initialRiskLevel: z.string().nullable().optional(),
  residualProbability: z.number().int().min(1).max(5).nullable().optional(),
  residualImpact: z.number().int().min(1).max(5).nullable().optional(),
  residualRiskLevel: z.string().nullable().optional(),
  riskReduction: z.number().nullable().optional(),
});

const updateSchema = createSchema.extend({
  status: z.enum(['DRAFT','PENDING_CODE','PENDING_APPROVAL','OPEN','IN_EXECUTION','PENDING_EVIDENCE','PENDING_EFFECTIVENESS','EFFECTIVE','NOT_EFFECTIVE','OVERDUE','CLOSED','CANCELLED']).optional(),
  progressPercent: z.number().min(0).max(100).optional(),
  actualEndDate: z.string().optional().nullable(),
  effectivenessCheckDate: z.string().optional().nullable(),
  effectivenessMethod: z.string().optional(),
  effectivenessResult: z.string().optional(),
  effectiveness: z.enum(['PENDING','EFFECTIVE','NOT_EFFECTIVE']).optional(),
  effectivenessCheckerId: uuidOrNull,
  approvedCloseById: uuidOrNull,
  cancellationReason: z.string().optional(),
  ncrId: uuidOrNull,
  ncrCode: z.string().optional().nullable(),
});

const USER_SELECT = { id: true, email: true, firstName: true, lastName: true };

function planInclude() {
  return {
    ncr: { select: { id: true, code: true, title: true, severity: true, status: true } },
    executor: { select: USER_SELECT },
    supervisor: { select: USER_SELECT },
    effectivenessChecker: { select: USER_SELECT },
    closedBy: { select: USER_SELECT },
    approvedCloseBy: { select: USER_SELECT },
    codeAssignedBy: { select: USER_SELECT },
    createdBy: { select: USER_SELECT },
    _count: { select: { attachments: true, logs: true } },
  };
}

async function addLog(
  tx: any,
  actionPlanId: string,
  userId: string | null | undefined,
  action: string,
  field?: string | null,
  oldValue?: string | null,
  newValue?: string | null,
  note?: string | null,
) {
  await tx.actionPlanLog.create({
    data: { actionPlanId, userId: userId ?? null, action, field: field ?? null, oldValue: oldValue ?? null, newValue: newValue ?? null, note: note ?? null },
  });
}

export const actionPlanRoutes: FastifyPluginAsync = async (app) => {
  // ── GET /action-plans ─────────────────────────────────────────────────────
  app.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    const { status, origin, type, ncrId, executorId } = (req.query as any) || {};

    const where: any = { tenantId, deletedAt: null };
    if (status && status !== 'ALL') where.status = status;
    if (origin && origin !== 'ALL') where.origin = origin;
    if (type && type !== 'ALL') where.type = type;
    if (ncrId) where.ncrId = ncrId;
    if (executorId) where.executorId = executorId;

    const plans = await app.runWithDbContext(req, async (tx: any) =>
      tx.actionPlan.findMany({
        where,
        orderBy: { openedAt: 'desc' },
        include: planInclude(),
      })
    );

    return reply.send({ plans });
  });

  // ── GET /action-plans/stats ───────────────────────────────────────────────
  app.get('/stats', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    const plans = await app.runWithDbContext(req, async (tx: any) =>
      tx.actionPlan.findMany({
        where: { tenantId, deletedAt: null },
        select: { id: true, status: true, effectiveness: true, plannedEndDate: true, actualEndDate: true, openedAt: true, closedAt: true },
      })
    );

    const now = Date.now();
    const overdue = plans.filter((p: any) =>
      p.plannedEndDate && !p.closedAt && !['CLOSED','CANCELLED','EFFECTIVE','NOT_EFFECTIVE'].includes(p.status) && new Date(p.plannedEndDate).getTime() < now
    ).length;

    const closed = plans.filter((p: any) => p.status === 'CLOSED' || p.status === 'EFFECTIVE');
    const avgClose = closed.length
      ? closed.reduce((acc: number, p: any) => {
          if (p.closedAt) {
            return acc + (new Date(p.closedAt).getTime() - new Date(p.openedAt).getTime()) / (1000 * 60 * 60 * 24);
          }
          return acc;
        }, 0) / closed.length
      : 0;

    const effective = plans.filter((p: any) => p.effectiveness === 'EFFECTIVE').length;
    const notEffective = plans.filter((p: any) => p.effectiveness === 'NOT_EFFECTIVE').length;

    return reply.send({
      stats: {
        total: plans.length,
        byStatus: {
          DRAFT: plans.filter((p: any) => p.status === 'DRAFT').length,
          PENDING_CODE: plans.filter((p: any) => p.status === 'PENDING_CODE').length,
          PENDING_APPROVAL: plans.filter((p: any) => p.status === 'PENDING_APPROVAL').length,
          OPEN: plans.filter((p: any) => p.status === 'OPEN').length,
          IN_EXECUTION: plans.filter((p: any) => p.status === 'IN_EXECUTION').length,
          PENDING_EVIDENCE: plans.filter((p: any) => p.status === 'PENDING_EVIDENCE').length,
          PENDING_EFFECTIVENESS: plans.filter((p: any) => p.status === 'PENDING_EFFECTIVENESS').length,
          EFFECTIVE: plans.filter((p: any) => p.status === 'EFFECTIVE').length,
          NOT_EFFECTIVE: plans.filter((p: any) => p.status === 'NOT_EFFECTIVE').length,
          OVERDUE: overdue,
          CLOSED: plans.filter((p: any) => p.status === 'CLOSED').length,
          CANCELLED: plans.filter((p: any) => p.status === 'CANCELLED').length,
        },
        overdue,
        avgCloseDays: Math.round(avgClose),
        effective,
        notEffective,
        pendingEffectiveness: plans.filter((p: any) => p.status === 'PENDING_EFFECTIVENESS').length,
      },
    });
  });

  // ── POST /action-plans ────────────────────────────────────────────────────
  app.post('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    let body: any;
    try {
      body = createSchema.parse(req.body);
    } catch (e: any) {
      return reply.code(400).send({ error: 'Validación fallida', details: e.errors });
    }

    // Si viene de NCR y ya existe uno, retornar el existente (evitar duplicado por NCR)
    if (body.ncrId) {
      const existing = await app.runWithDbContext(req, async (tx: any) =>
        tx.actionPlan.findFirst({
          where: { tenantId, ncrId: body.ncrId, deletedAt: null },
          include: planInclude(),
        })
      );
      if (existing) {
        return reply.code(200).send({ plan: existing, alreadyExisted: true });
      }
    }

    // Auto-assign sequence number
    const seqResult = await app.runWithDbContext(req, async (tx: any) =>
      tx.$queryRaw`SELECT nextval('action_plan_seq')::int as seq`
    );
    const seqNum = Array.isArray(seqResult) ? seqResult[0]?.seq : null;

    const plan = await app.runWithDbContext(req, async (tx: any) => {
      const created = await tx.actionPlan.create({
        data: {
          tenantId,
          sequenceNumber: seqNum ?? undefined,
          ncrId: body.ncrId ?? null,
          origin: body.origin ?? (body.ncrId ? 'NCR' : 'MANUAL'),
          type: body.type ?? 'CORRECTIVE',
          status: 'DRAFT',
          severity: body.severity ?? null,
          site: body.site ?? null,
          area: body.area ?? null,
          process: body.process ?? null,
          findingDescription: body.findingDescription ?? null,
          requirement: body.requirement ?? null,
          classification: body.classification ?? null,
          immediateCorrection: body.immediateCorrection ?? null,
          rootCauseAnalysis: body.rootCauseAnalysis ?? null,
          analysisMethod: body.analysisMethod ?? null,
          validatedRootCause: body.validatedRootCause ?? null,
          plannedAction: body.plannedAction ?? null,
          expectedResult: body.expectedResult ?? null,
          executorId: body.executorId ?? null,
          supervisorId: body.supervisorId ?? null,
          requiredResources: body.requiredResources ?? null,
          plannedStartDate: body.plannedStartDate ? new Date(body.plannedStartDate) : null,
          plannedEndDate: body.plannedEndDate ? new Date(body.plannedEndDate) : null,
          observations: body.observations ?? null,
          createdById: req.auth?.userId ?? null,
          updatedById: req.auth?.userId ?? null,
        },
        include: planInclude(),
      });

      await addLog(tx, created.id, req.auth?.userId, 'CREATE', undefined, undefined, undefined,
        body.ncrId ? `Plan creado desde NCR ${body.ncrId}` : 'Plan creado manualmente'
      );

      return created;
    });

    return reply.code(201).send({ plan });
  });

  // ── GET /action-plans/:id ─────────────────────────────────────────────────
  app.get('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    const plan = await app.runWithDbContext(req, async (tx: any) =>
      tx.actionPlan.findFirst({
        where: { id, tenantId, deletedAt: null },
        include: {
          ...planInclude(),
          logs: { orderBy: { createdAt: 'desc' }, include: { user: { select: USER_SELECT } }, take: 50 },
          attachments: { orderBy: { createdAt: 'desc' }, include: { uploadedBy: { select: USER_SELECT } } },
        },
      })
    );

    if (!plan) return reply.code(404).send({ error: 'Plan de acción no encontrado' });
    return reply.send({ plan });
  });

  // ── PATCH /action-plans/:id ───────────────────────────────────────────────
  app.patch('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    let body: any;
    try {
      body = updateSchema.parse(req.body);
    } catch (e: any) {
      return reply.code(400).send({ error: 'Validación fallida', details: e.errors });
    }

    const plan = await app.runWithDbContext(req, async (tx: any) => {
      const existing = await tx.actionPlan.findFirst({ where: { id, tenantId, deletedAt: null } });
      if (!existing) throw Object.assign(new Error('Plan no encontrado'), { statusCode: 404 });

      // Validaciones de cierre
      if (body.status === 'CLOSED') {
        if (existing.effectiveness === 'PENDING') {
          throw Object.assign(new Error('No se puede cerrar sin verificación de eficacia'), { statusCode: 422 });
        }
        if (!existing.approvedCloseById && !body.approvedCloseById) {
          throw Object.assign(new Error('Se requiere aprobación del cierre'), { statusCode: 422 });
        }
      }

      // Validación de cancelación
      if (body.status === 'CANCELLED' && !body.cancellationReason && !existing.cancellationReason) {
        throw Object.assign(new Error('Se requiere justificación para cancelar'), { statusCode: 422 });
      }

      // Resolver ncrCode → ncrId si viene ncrCode en el body
      if (body.ncrCode !== undefined) {
        const code = (body.ncrCode as string)?.trim() || '';
        if (code) {
          const ncr = await tx.nonConformity.findFirst({ where: { tenantId, code, deletedAt: null } });
          if (ncr) {
            body.ncrId = ncr.id;
          } else {
            body.ncrId = null;
          }
        } else {
          body.ncrId = null;
        }
        delete body.ncrCode;
      }

      const closedAt = body.status === 'CLOSED' && existing.status !== 'CLOSED' ? new Date() : existing.closedAt;

      const updated = await tx.actionPlan.update({
        where: { id },
        data: {
          ...Object.fromEntries(
            Object.entries(body).map(([k, v]) => {
              if (['plannedStartDate','plannedEndDate','actualEndDate','effectivenessCheckDate'].includes(k)) {
                return [k, v ? new Date(v as string) : null];
              }
              return [k, v];
            })
          ),
          closedAt,
          updatedById: req.auth?.userId ?? null,
        },
        include: planInclude(),
      });

      // Registrar cambios relevantes en bitácora
      const trackedFields: Record<string, string> = {
        status: 'Estado',
        effectiveness: 'Eficacia',
        progressPercent: 'Avance %',
        executorId: 'Responsable ejecución',
        supervisorId: 'Responsable seguimiento',
        plannedEndDate: 'Fecha prevista cierre',
      };
      for (const [field, label] of Object.entries(trackedFields)) {
        if (body[field] !== undefined && (existing as any)[field] !== body[field]) {
          await addLog(tx, id, req.auth?.userId, 'UPDATE', label,
            String((existing as any)[field] ?? ''), String(body[field] ?? ''));
        }
      }

      return updated;
    });

    return reply.send({ plan });
  });

  // ── POST /action-plans/:id/assign-code ────────────────────────────────────
  app.post('/:id/assign-code', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    const plan = await app.runWithDbContext(req, async (tx: any) => {
      const existing = await tx.actionPlan.findFirst({ where: { id, tenantId, deletedAt: null } });
      if (!existing) throw Object.assign(new Error('Plan no encontrado'), { statusCode: 404 });
      if (existing.code) throw Object.assign(new Error('Este plan ya tiene código asignado'), { statusCode: 409 });

      const year = new Date().getFullYear();
      const count = await tx.actionPlan.count({
        where: { tenantId, code: { startsWith: `PAC-${year}-` } },
      });
      const code = `PAC-${year}-${String(count + 1).padStart(4, '0')}`;

      const updated = await tx.actionPlan.update({
        where: { id },
        data: {
          code,
          codeAssignedAt: new Date(),
          codeAssignedById: req.auth?.userId ?? null,
          status: existing.status === 'DRAFT' || existing.status === 'PENDING_CODE' ? 'OPEN' : existing.status,
          updatedById: req.auth?.userId ?? null,
        },
        include: planInclude(),
      });

      await addLog(tx, id, req.auth?.userId, 'CODE_ASSIGNED', 'Código', null, code);
      return updated;
    });

    return reply.send({ plan });
  });

  // ── POST /action-plans/assign-code-bulk ───────────────────────────────────
  app.post('/assign-code-bulk', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    const { ids } = z.object({ ids: z.array(z.string().uuid()).min(1) }).parse(req.body);
    const year = new Date().getFullYear();

    const results: any[] = await app.runWithDbContext(req, async (tx: any) => {
      const out = [];
      for (const id of ids) {
        const existing = await tx.actionPlan.findFirst({ where: { id, tenantId, deletedAt: null, code: null } });
        if (!existing) continue;
        const count = await tx.actionPlan.count({ where: { tenantId, code: { startsWith: `PAC-${year}-` } } });
        const code = `PAC-${year}-${String(count + 1).padStart(4, '0')}`;
        const updated = await tx.actionPlan.update({
          where: { id },
          data: { code, codeAssignedAt: new Date(), codeAssignedById: req.auth?.userId ?? null, status: 'OPEN', updatedById: req.auth?.userId ?? null },
          include: planInclude(),
        });
        await addLog(tx, id, req.auth?.userId, 'CODE_ASSIGNED', 'Código', null, code, 'Asignación masiva');
        out.push(updated);
      }
      return out;
    });

    return reply.send({ plans: results, assigned: results.length });
  });

  // ── GET /action-plans/:id/logs ────────────────────────────────────────────
  app.get('/:id/logs', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    const plan = await app.runWithDbContext(req, async (tx: any) =>
      tx.actionPlan.findFirst({ where: { id, tenantId, deletedAt: null }, select: { id: true } })
    );
    if (!plan) return reply.code(404).send({ error: 'Plan no encontrado' });

    const logs = await app.runWithDbContext(req, async (tx: any) =>
      tx.actionPlanLog.findMany({
        where: { actionPlanId: id },
        orderBy: { createdAt: 'desc' },
        include: { user: { select: USER_SELECT } },
      })
    );

    return reply.send({ logs });
  });

  // ── GET /action-plans/:id/attachments ────────────────────────────────────
  app.get('/:id/attachments', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    const attachments = await app.runWithDbContext(req, async (tx: any) =>
      tx.actionPlanAttachment.findMany({
        where: { actionPlanId: id },
        orderBy: { createdAt: 'desc' },
        include: { uploadedBy: { select: USER_SELECT } },
      })
    );
    return reply.send({ attachments });
  });

  // ── POST /action-plans/:id/attachments ───────────────────────────────────
  app.post('/:id/attachments', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    const body = z.object({
      filename: z.string(),
      url: z.string().url(),
      mimeType: z.string().optional(),
      size: z.number().optional(),
    }).parse(req.body);

    const attachment = await app.runWithDbContext(req, async (tx: any) => {
      const plan = await tx.actionPlan.findFirst({ where: { id, tenantId, deletedAt: null } });
      if (!plan) throw Object.assign(new Error('Plan no encontrado'), { statusCode: 404 });

      const att = await tx.actionPlanAttachment.create({
        data: { actionPlanId: id, filename: body.filename, url: body.url, mimeType: body.mimeType ?? null, size: body.size ?? null, uploadedById: req.auth?.userId ?? null },
        include: { uploadedBy: { select: USER_SELECT } },
      });
      await addLog(tx, id, req.auth?.userId, 'ATTACHMENT_ADDED', 'Adjunto', null, body.filename);
      return att;
    });

    return reply.code(201).send({ attachment });
  });

  // ── DELETE /action-plans/:id/attachments/:attId ──────────────────────────
  app.delete('/:id/attachments/:attId', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id, attId } = z.object({ id: z.string().uuid(), attId: z.string().uuid() }).parse(req.params);

    await app.runWithDbContext(req, async (tx: any) => {
      const plan = await tx.actionPlan.findFirst({ where: { id, tenantId, deletedAt: null } });
      if (!plan) throw Object.assign(new Error('Plan no encontrado'), { statusCode: 404 });
      await tx.actionPlanAttachment.deleteMany({ where: { id: attId, actionPlanId: id } });
      await addLog(tx, id, req.auth?.userId, 'ATTACHMENT_REMOVED', 'Adjunto', attId, null);
    });

    return reply.send({ success: true });
  });

  // ── DELETE /action-plans/:id ──────────────────────────────────────────────
  app.delete('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    await app.runWithDbContext(req, async (tx: any) => {
      const existing = await tx.actionPlan.findFirst({ where: { id, tenantId, deletedAt: null } });
      if (!existing) throw Object.assign(new Error('Plan no encontrado'), { statusCode: 404 });
      await tx.actionPlan.update({ where: { id }, data: { deletedAt: new Date() } });
      await addLog(tx, id, req.auth?.userId, 'DELETED');
    });

    return reply.send({ success: true });
  });

  // ── POST /action-plans/:id/ai-fill ─────────────────────────────────────────
  app.post('/:id/ai-fill', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    const { field } = z.object({
      field: z.enum(['immediateCorrection','rootCauseAnalysis','validatedRootCause','plannedAction','expectedResult']),
    }).parse(req.body);

    const plan = await app.runWithDbContext(req, async (tx: any) =>
      tx.actionPlan.findFirst({
        where: { id, tenantId, deletedAt: null },
        include: {
          ncr: { select: { id: true, code: true, title: true, description: true, severity: true } },
          executor: { select: USER_SELECT },
        },
      })
    );
    if (!plan) return reply.code(404).send({ error: 'Plan no encontrado' });

    const FIELD_LABELS: Record<string, string> = {
      immediateCorrection: 'Corrección inmediata / Medida de contención',
      rootCauseAnalysis: 'Análisis de causa raíz',
      validatedRootCause: 'Causa raíz validada',
      plannedAction: 'Acción planificada',
      expectedResult: 'Resultado esperado / Criterio de éxito',
    };

    const contextParts: string[] = [
      `Tipo de acción: ${plan.type}`,
      `Origen: ${plan.origin}`,
      `Estado: ${plan.status}`,
      plan.severity ? `Criticidad: ${plan.severity}` : '',
      plan.site ? `Sede: ${plan.site}` : '',
      plan.area ? `Área: ${plan.area}` : '',
      plan.process ? `Proceso: ${plan.process}` : '',
      plan.findingDescription ? `Descripción del hallazgo: ${plan.findingDescription}` : '',
      plan.requirement ? `Requisito: ${plan.requirement}` : '',
      plan.classification ? `Clasificación: ${plan.classification}` : '',
      plan.ncr?.title ? `NCR relacionada: ${plan.ncr.title}` : '',
      plan.ncr?.description ? `Descripción NCR: ${plan.ncr.description}` : '',
      plan.immediateCorrection ? `Corrección inmediata: ${plan.immediateCorrection}` : '',
      plan.rootCauseAnalysis ? `Análisis de causa raíz: ${plan.rootCauseAnalysis}` : '',
      plan.analysisMethod ? `Metodología: ${plan.analysisMethod}` : '',
      plan.validatedRootCause ? `Causa raíz validada: ${plan.validatedRootCause}` : '',
      plan.plannedAction ? `Acción planificada: ${plan.plannedAction}` : '',
      plan.expectedResult ? `Resultado esperado: ${plan.expectedResult}` : '',
    ].filter(Boolean);

    const prompt = `Sos un experto en gestión de calidad (ISO 9001/14001/45001/19011). Analizá el siguiente contexto de un Plan de Acción y completá el campo "${FIELD_LABELS[field]}".

Contexto del plan:
${contextParts.join('\n')}

Generá únicamente el contenido para el campo "${FIELD_LABELS[field]}". Sea específico, técnico y accionable. No incluís saludos ni explicaciones. Respondé en español.`;

    try {
      const llm = createGroqOnlyLLMProvider(
        null, app.prisma, tenantId, req.auth?.userId ?? null, 'action-plan-ai-fill'
      );
      const response = await llm.chat([
        { role: 'user', content: prompt },
      ], 1024);

      const generatedText = response.text.trim();

      await app.runWithDbContext(req, async (tx: any) => {
        await tx.actionPlan.update({
          where: { id },
          data: { [field]: generatedText, updatedById: req.auth?.userId ?? null },
        });
        await addLog(tx, id, req.auth?.userId, 'AI_FILL', FIELD_LABELS[field], null, generatedText, `Campo completado con IA`);
      });

      return reply.send({ field, value: generatedText });
    } catch (err: any) {
      return reply.code(500).send({ error: err?.message ?? 'Error en IA' });
    }
  });
};
