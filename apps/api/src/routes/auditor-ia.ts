// ──────────────────────────────────────────────────────────────
// Auditor IA — rutas del módulo (spec 02 §4)
//
// Reglas transversales aplicadas en cada handler:
//  - requireFeature('auditor_ia')
//  - requireAuditorAccess(req, reply, app, action) — permiso explícito
//    (el plugin global es fail-open y no cubre este prefijo)
//  - where: { tenantId } en toda consulta
//  - Zod en la entrada
// ──────────────────────────────────────────────────────────────

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  requireAuditorAccess,
  AUDITOR_IA_FEATURE,
  type AuditorAction,
} from '../services/auditor-ia/authz.js';
import { runExtraction } from '../services/auditor-ia/extraction.js';
import { markStaleEvaluations } from '../services/auditor-ia/staleness.js';
import { getConnector, hasModuleAccess, CONNECTOR_KEYS } from '../services/auditor-ia/connectors/index.js';
import { getStorage } from '../services/storage.js';

const idSchema = z.string().uuid();

// Watchdog STALE al abrir una revisión: throttle de 10 min por revisión
// (el snapshot de fuentes es costoso y la UI hace polling).
const STALE_CHECK_TTL_MS = 10 * 60 * 1000;
const STALE_CHECK_CACHE = new Map<string, number>();

async function guard(
  req: FastifyRequest,
  reply: FastifyReply,
  app: FastifyInstance,
  action: AuditorAction,
): Promise<{ tenantId: string; userId: string } | null> {
  app.requireFeature(req, AUDITOR_IA_FEATURE);
  return requireAuditorAccess(req, reply, app, action);
}

function sendError(reply: FastifyReply, error: unknown): unknown {
  const e = error as { statusCode?: number; message?: string; extractionId?: string };
  const status = e.statusCode ?? 500;
  const body: Record<string, unknown> = { error: 'ERROR', message: e.message ?? 'Error interno' };
  if (e.extractionId) body.extractionId = e.extractionId;
  return reply.code(status).send(body);
}

export async function auditorIaRoutes(app: FastifyInstance) {
  // ── Normas con estado de extracción ─────────────────────────
  // GET /normas
  app.get('/normas', async (req, reply) => {
    const ctx = await guard(req, reply, app, 'view');
    if (!ctx) return;

    const normatives = await app.prisma.normativeStandard.findMany({
      where: { tenantId: ctx.tenantId, deletedAt: null },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        code: true,
        version: true,
        status: true,
        fileHash: true,
        filePath: true,
        totalClauses: true,
        auditorExtractions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            status: true,
            revision: true,
            pageCount: true,
            createdAt: true,
            _count: { select: { requirements: true } },
          },
        },
      },
    });

    return reply.send({
      items: normatives.map((n) => {
        const extraction = n.auditorExtractions[0] ?? null;
        return {
          id: n.id,
          name: n.name,
          code: n.code,
          version: n.version,
          status: n.status,
          hasPdf: Boolean(n.filePath && n.fileHash),
          totalClauses: n.totalClauses,
          extraction: extraction
            ? {
                id: extraction.id,
                status: extraction.status,
                revision: extraction.revision,
                pageCount: extraction.pageCount,
                requirementCount: extraction._count.requirements,
                createdAt: extraction.createdAt,
              }
            : null,
        };
      }),
    });
  });

  // ── Iniciar extracción ──────────────────────────────────────
  // POST /normas/:normativeId/extracciones
  app.post('/normas/:normativeId/extracciones', async (req, reply) => {
    const ctx = await guard(req, reply, app, 'extract');
    if (!ctx) return;

    const { normativeId } = z
      .object({ normativeId: idSchema })
      .parse(req.params);

    try {
      // El download ocurre fuera de la transacción (operación lenta).
      const normative = await app.prisma.normativeStandard.findFirst({
        where: { id: normativeId, tenantId: ctx.tenantId, deletedAt: null },
        select: { filePath: true },
      });
      if (!normative?.filePath) {
        return reply
          .code(422)
          .send({ error: 'NO_PDF', message: 'La norma no tiene PDF cargado' });
      }
      const storage = getStorage();
      const buffer = await storage.download(normative.filePath);

      const result = await app.runWithDbContext(req, async (tx) =>
        runExtraction({
          tx,
          tenantId: ctx.tenantId,
          normativeId,
          userId: ctx.userId,
          getBuffer: async () => buffer,
        }),
        // El parse del PDF es lo más lento; el default de Prisma
        // (5s) abortaría normas largas.
        { timeout: 60_000 },
      );

      return reply.code(202).send(result);
    } catch (error) {
      return sendError(reply, error);
    }
  });

  // ── Detalle de extracción ───────────────────────────────────
  // GET /extracciones/:id
  app.get('/extracciones/:id', async (req, reply) => {
    const ctx = await guard(req, reply, app, 'view');
    if (!ctx) return;

    const { id } = z.object({ id: idSchema }).parse(req.params);

    const extraction = await app.prisma.auditorExtraction.findFirst({
      where: { id, tenantId: ctx.tenantId },
      include: {
        normative: { select: { id: true, name: true, code: true, version: true } },
        requirements: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            code: true,
            clauseNumber: true,
            statement: true,
            verificationTypes: true,
            connectorKeys: true,
            page: true,
            requiresDocumentedInfo: true,
            origin: true,
            status: true,
            order: true,
            clause: { select: { id: true, title: true } },
          },
        },
      },
    });
    if (!extraction) {
      return reply.code(404).send({ error: 'NOT_FOUND' });
    }
    return reply.send(extraction);
  });

  // ── Texto de una página fuente (cita verificable) ───────────
  // GET /extracciones/:id/paginas/:n
  app.get('/extracciones/:id/paginas/:n', async (req, reply) => {
    const ctx = await guard(req, reply, app, 'view');
    if (!ctx) return;

    const { id, n } = z
      .object({ id: idSchema, n: z.coerce.number().int().min(1) })
      .parse(req.params);

    const page = await app.prisma.auditorSourcePage.findFirst({
      where: { extractionId: id, tenantId: ctx.tenantId, page: n },
      select: { page: true, text: true },
    });
    if (!page) {
      return reply.code(404).send({ error: 'NOT_FOUND' });
    }
    return reply.send(page);
  });

  // ── Editar requisito (P2) ───────────────────────────────────
  // PATCH /requisitos/:id
  const patchRequirementSchema = z.object({
    statement: z.string().min(1).max(300).optional(),
    verificationTypes: z
      .array(z.enum(['DOCUMENT', 'RECORD', 'OBSERVATION', 'INTERVIEW']))
      .optional(),
    connectorKeys: z
      .array(z.string().max(60))
      .max(10)
      .refine(
        (keys) => keys.every((k) => CONNECTOR_KEYS.includes(k)),
        { message: `connectorKeys válidas: ${CONNECTOR_KEYS.join(', ')}` },
      )
      .optional(),
    status: z.enum(['PROPOSED', 'APPROVED', 'DISCARDED']).optional(),
    page: z.number().int().min(1).nullable().optional(),
  });

  app.patch('/requisitos/:id', async (req, reply) => {
    const ctx = await guard(req, reply, app, 'editRequirements');
    if (!ctx) return;

    const { id } = z.object({ id: idSchema }).parse(req.params);
    const body = patchRequirementSchema.parse(req.body);

    const requirement = await app.prisma.auditorRequirement.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: { id: true, extraction: { select: { status: true } } },
    });
    if (!requirement) {
      return reply.code(404).send({ error: 'NOT_FOUND' });
    }
    if (requirement.extraction.status === 'APPROVED') {
      return reply.code(409).send({
        error: 'EXTRACTION_APPROVED',
        message: 'La extracción ya está aprobada; sus requisitos son inmutables',
      });
    }

    const updated = await app.prisma.auditorRequirement.update({
      where: { id },
      data: {
        ...(body.statement !== undefined ? { statement: body.statement } : {}),
        ...(body.verificationTypes !== undefined
          ? { verificationTypes: body.verificationTypes }
          : {}),
        ...(body.connectorKeys !== undefined
          ? { connectorKeys: body.connectorKeys }
          : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.page !== undefined ? { page: body.page } : {}),
      },
    });
    return reply.send(updated);
  });

  // ── Aprobar extracción (admin) ──────────────────────────────
  // POST /extracciones/:id/aprobar
  app.post('/extracciones/:id/aprobar', async (req, reply) => {
    const ctx = await guard(req, reply, app, 'approveExtraction');
    if (!ctx) return;

    const { id } = z.object({ id: idSchema }).parse(req.params);

    const extraction = await app.prisma.auditorExtraction.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: {
        id: true,
        status: true,
        requirements: {
          where: { status: { in: ['PROPOSED', 'APPROVED'] } },
          select: { status: true },
        },
      },
    });
    if (!extraction) {
      return reply.code(404).send({ error: 'NOT_FOUND' });
    }
    if (extraction.status !== 'PENDING_APPROVAL') {
      return reply.code(409).send({
        error: 'INVALID_STATUS',
        message: `No se puede aprobar una extracción en estado ${extraction.status}`,
      });
    }
    const pending = extraction.requirements.filter((r) => r.status === 'PROPOSED').length;
    if (pending > 0) {
      return reply.code(422).send({
        error: 'REQUIREMENTS_PENDING',
        message: 'Quedan requisitos en estado PROPOSED; aprobálos o descartalos',
        pending,
      });
    }
    const approved = extraction.requirements.filter((r) => r.status === 'APPROVED').length;
    if (approved === 0) {
      return reply.code(422).send({
        error: 'NO_REQUIREMENTS',
        message: 'La extracción no tiene requisitos aprobados; no hay nada que revisar',
      });
    }

    const updated = await app.prisma.auditorExtraction.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedById: ctx.userId,
        approvedAt: new Date(),
      },
    });
    return reply.send(updated);
  });

  // ── Rechazar extracción (admin) ─────────────────────────────
  // POST /extracciones/:id/rechazar
  app.post('/extracciones/:id/rechazar', async (req, reply) => {
    const ctx = await guard(req, reply, app, 'approveExtraction');
    if (!ctx) return;

    const { id } = z.object({ id: idSchema }).parse(req.params);
    const body = z.object({ note: z.string().max(500).optional() }).parse(req.body ?? {});

    const extraction = await app.prisma.auditorExtraction.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: { id: true, status: true },
    });
    if (!extraction) {
      return reply.code(404).send({ error: 'NOT_FOUND' });
    }
    if (!['PENDING_APPROVAL', 'UNREADABLE', 'FAILED'].includes(extraction.status)) {
      return reply.code(409).send({
        error: 'INVALID_STATUS',
        message: `No se puede rechazar una extracción en estado ${extraction.status}`,
      });
    }

    const updated = await app.prisma.auditorExtraction.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectedById: ctx.userId,
        rejectedAt: new Date(),
        rejectNote: body.note,
      },
    });
    return reply.send(updated);
  });

  // ═══════════════════════════════════════════════════════════
  // REVISIONES
  // ═══════════════════════════════════════════════════════════

  const reviewConfigSchema = z.object({
    extractionId: idSchema,
    scope: z.string().max(500).optional(),
    processIds: z.array(idSchema).max(50).default([]),
    sites: z.array(z.string().max(120)).max(20).default([]),
    periodFrom: z.coerce.date().optional(),
    periodTo: z.coerce.date().optional(),
    requirementIds: z.array(idSchema).max(200).optional(),
    tokenBudget: z.number().int().min(0).max(5_000_000).optional(),
  });

  const TOKENS_PER_REQUIREMENT = 2500; // estimación conservadora

  // POST /revisiones/estimar — estimación de alcance y tokens
  app.post('/revisiones/estimar', async (req, reply) => {
    const ctx = await guard(req, reply, app, 'runReview');
    if (!ctx) return;

    const body = reviewConfigSchema.parse(req.body);
    const extraction = await app.prisma.auditorExtraction.findFirst({
      where: { id: body.extractionId, tenantId: ctx.tenantId },
      select: { status: true, _count: { select: { requirements: { where: { status: 'APPROVED' } } } } },
    });
    if (!extraction) return reply.code(404).send({ error: 'NOT_FOUND' });
    if (extraction.status !== 'APPROVED') {
      return reply.code(422).send({ error: 'EXTRACTION_NOT_APPROVED' });
    }

    const requirements = body.requirementIds?.length
      ? Math.min(body.requirementIds.length, extraction._count.requirements)
      : extraction._count.requirements;

    return reply.send({
      requirements,
      estTokens: requirements * TOKENS_PER_REQUIREMENT,
      tokenBudget: body.tokenBudget ?? null,
    });
  });

  // POST /revisiones — crear y encolar
  app.post('/revisiones', async (req, reply) => {
    const ctx = await guard(req, reply, app, 'runReview');
    if (!ctx) return;

    const body = reviewConfigSchema.parse(req.body);
    const extraction = await app.prisma.auditorExtraction.findFirst({
      where: { id: body.extractionId, tenantId: ctx.tenantId, status: 'APPROVED' },
      select: {
        id: true, normativeId: true,
        _count: { select: { requirements: { where: { status: 'APPROVED' } } } },
      },
    });
    if (!extraction) {
      return reply.code(422).send({ error: 'EXTRACTION_NOT_APPROVED' });
    }

    // Dedupe: misma extracción + mismo conjunto de requisitos en curso
    const inFlight = await app.prisma.auditorReview.findFirst({
      where: {
        tenantId: ctx.tenantId,
        extractionId: body.extractionId,
        status: { in: ['QUEUED', 'RUNNING'] },
      },
      select: { id: true, requirementIds: true },
    });
    if (inFlight) {
      const sameScope =
        JSON.stringify((inFlight.requirementIds ?? []).sort()) ===
        JSON.stringify((body.requirementIds ?? []).sort());
      if (sameScope) {
        return reply.code(409).send({ error: 'REVIEW_IN_PROGRESS', reviewId: inFlight.id });
      }
    }

    // Límite mensual de tokens por tenant (AIUsageLog, módulo auditor-ia)
    const monthlyCap = Number(process.env.AUDITOR_IA_MONTHLY_TOKENS ?? 1_000_000);
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const used = await app.prisma.aIUsageLog.aggregate({
      where: { tenantId: ctx.tenantId, module: 'auditor-ia', createdAt: { gte: monthStart } },
      _sum: { tokensUsed: true },
    });
    const usedThisMonth = used._sum.tokensUsed ?? 0;
    if (usedThisMonth >= monthlyCap) {
      return reply.code(422).send({
        error: 'MONTHLY_TOKEN_LIMIT',
        usedThisMonth,
        monthlyCap,
      });
    }

    const review = await app.prisma.auditorReview.create({
      data: {
        tenantId: ctx.tenantId,
        extractionId: extraction.id,
        normativeId: extraction.normativeId,
        scope: body.scope,
        processIds: body.processIds,
        sites: body.sites,
        periodFrom: body.periodFrom,
        periodTo: body.periodTo,
        requirementIds: body.requirementIds ?? [],
        status: 'QUEUED',
        estTokens:
          (body.requirementIds?.length ?? extraction._count.requirements) * TOKENS_PER_REQUIREMENT,
        createdById: ctx.userId,
        config: { tokenBudget: body.tokenBudget ?? null },
      },
    });

    const { getAuditorIaQueue } = await import('../jobs/auditorIaJobs.js');
    const job = await getAuditorIaQueue().add('run-review', {
      reviewId: review.id,
      tenantId: ctx.tenantId,
    });
    if (job.id) {
      await app.prisma.auditorReview.update({
        where: { id: review.id },
        data: { jobId: String(job.id) },
      });
    }

    return reply.code(202).send({ reviewId: review.id });
  });

  // GET /revisiones — listado
  app.get('/revisiones', async (req, reply) => {
    const ctx = await guard(req, reply, app, 'view');
    if (!ctx) return;

    const query = z
      .object({
        status: z.string().optional(),
        normativeId: idSchema.optional(),
        limit: z.coerce.number().int().min(1).max(100).default(50),
      })
      .parse(req.query);

    const reviews = await app.prisma.auditorReview.findMany({
      where: {
        tenantId: ctx.tenantId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.normativeId ? { normativeId: query.normativeId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: query.limit,
      select: {
        id: true, status: true, progress: true, scope: true,
        periodFrom: true, periodTo: true, sites: true,
        estTokens: true, usedTokens: true, totals: true,
        createdAt: true, startedAt: true, finishedAt: true, error: true,
        extraction: {
          select: { normative: { select: { name: true, code: true, version: true } } },
        },
      },
    });
    return reply.send({ items: reviews });
  });

  // GET /revisiones/:id — detalle + matriz de evaluaciones
  app.get('/revisiones/:id', async (req, reply) => {
    const ctx = await guard(req, reply, app, 'view');
    if (!ctx) return;

    const { id } = z.object({ id: idSchema }).parse(req.params);

    // Watchdog autónomo: si la revisión terminó, verificar en cada carga
    // que las fuentes de evidencia no hayan cambiado (marca STALE).
    // Throttle por revisión para no repetir snapshots en polling continuo.
    const status = await app.prisma.auditorReview.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: { status: true },
    });
    if (status && ['COMPLETED', 'PARTIAL'].includes(status.status)) {
      const lastCheck = STALE_CHECK_CACHE.get(id) ?? 0;
      if (Date.now() - lastCheck > STALE_CHECK_TTL_MS) {
        STALE_CHECK_CACHE.set(id, Date.now());
        try { await markStaleEvaluations(app.prisma, ctx.tenantId, id); }
        catch { /* best-effort: la UI sigue respondiendo aunque falle */ }
      }
    }

    const review = await app.prisma.auditorReview.findFirst({
      where: { id, tenantId: ctx.tenantId },
      include: {
        extraction: {
          select: {
            id: true, revision: true, status: true,
            normative: { select: { id: true, name: true, code: true, version: true } },
          },
        },
        evaluations: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true, requirementId: true, attempt: true,
            workStatus: true, evidenceStatus: true, aiVerdict: true,
            humanDecision: true, tokens: true, updatedAt: true,
            noProvider: true, limitations: true,
            requirement: {
              select: { code: true, clauseNumber: true, statement: true, page: true },
            },
          },
        },
      },
    });
    if (!review) return reply.code(404).send({ error: 'NOT_FOUND' });
    return reply.send(review);
  });

  // POST /revisiones/:id/cancelar
  app.post('/revisiones/:id/cancelar', async (req, reply) => {
    const ctx = await guard(req, reply, app, 'runReview');
    if (!ctx) return;

    const { id } = z.object({ id: idSchema }).parse(req.params);
    const review = await app.prisma.auditorReview.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: { status: true },
    });
    if (!review) return reply.code(404).send({ error: 'NOT_FOUND' });
    if (!['QUEUED', 'RUNNING'].includes(review.status)) {
      return reply.code(409).send({ error: 'INVALID_STATUS' });
    }
    const updated = await app.prisma.auditorReview.update({
      where: { id },
      data: { cancelRequested: true },
    });
    return reply.send({ id: updated.id, cancelRequested: true });
  });

  // POST /revisiones/:id/reintentar — retoma pendientes
  app.post('/revisiones/:id/reintentar', async (req, reply) => {
    const ctx = await guard(req, reply, app, 'runReview');
    if (!ctx) return;

    const { id } = z.object({ id: idSchema }).parse(req.params);
    const review = await app.prisma.auditorReview.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: { status: true },
    });
    if (!review) return reply.code(404).send({ error: 'NOT_FOUND' });
    if (!['FAILED', 'CANCELLED', 'COMPLETED'].includes(review.status)) {
      return reply.code(409).send({ error: 'INVALID_STATUS' });
    }

    await app.prisma.auditorReview.update({
      where: { id },
      data: { status: 'QUEUED', cancelRequested: false, error: null },
    });
    const { getAuditorIaQueue } = await import('../jobs/auditorIaJobs.js');
    await getAuditorIaQueue().add('run-review', { reviewId: id, tenantId: ctx.tenantId });
    return reply.code(202).send({ reviewId: id });
  });

  // ═══════════════════════════════════════════════════════════
  // EVALUACIONES
  // ═══════════════════════════════════════════════════════════

  // GET /evaluaciones/:id — detalle con evidencias e historial
  app.get('/evaluaciones/:id', async (req, reply) => {
    const ctx = await guard(req, reply, app, 'view');
    if (!ctx) return;

    const { id } = z.object({ id: idSchema }).parse(req.params);
    const evaluation = await app.prisma.auditorEvaluation.findFirst({
      where: { id, tenantId: ctx.tenantId },
      include: {
        requirement: {
          select: {
            code: true, clauseNumber: true, statement: true, page: true,
            verificationTypes: true, requiresDocumentedInfo: true,
          },
        },
        evidenceLinks: {
          orderBy: { createdAt: 'asc' },
        },
        decisionLogs: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        review: {
          select: { id: true, normativeId: true, periodFrom: true, periodTo: true },
        },
      },
    });
    if (!evaluation) return reply.code(404).send({ error: 'NOT_FOUND' });
    return reply.send(evaluation);
  });

  // POST /evaluaciones/:id/decision — decisión humana (eje 4)
  app.post('/evaluaciones/:id/decision', async (req, reply) => {
    const ctx = await guard(req, reply, app, 'decide');
    if (!ctx) return;

    const { id } = z.object({ id: idSchema }).parse(req.params);
    const body = z
      .object({
        decision: z.enum([
          'VALIDATED',
          'GAP_CONFIRMED',
          'MORE_EVIDENCE_REQUESTED',
          'AI_REJECTED',
        ]),
        comment: z.string().max(1000).optional(),
      })
      .parse(req.body);

    const evaluation = await app.prisma.auditorEvaluation.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: { id: true, humanDecision: true, workStatus: true },
    });
    if (!evaluation) return reply.code(404).send({ error: 'NOT_FOUND' });
    if (evaluation.workStatus === 'IN_PROGRESS') {
      return reply.code(409).send({ error: 'EVALUATION_IN_PROGRESS' });
    }

    await app.prisma.auditorEvaluation.update({
      where: { id },
      data: {
        humanDecision: body.decision,
        decidedById: ctx.userId,
        decidedAt: new Date(),
        decisionComment: body.comment,
      },
    });
    await app.prisma.auditorDecisionLog.create({
      data: {
        tenantId: ctx.tenantId,
        evaluationId: id,
        axis: 'humanDecision',
        fromValue: evaluation.humanDecision,
        toValue: body.decision,
        actorId: ctx.userId,
        comment: body.comment,
      },
    });
    return reply.send({ id, humanDecision: body.decision });
  });

  // POST /evaluaciones/:id/na-proponer — propone no aplicabilidad
  app.post('/evaluaciones/:id/na-proponer', async (req, reply) => {
    const ctx = await guard(req, reply, app, 'proposeNA');
    if (!ctx) return;

    const { id } = z.object({ id: idSchema }).parse(req.params);
    const body = z
      .object({ justification: z.string().min(20).max(2000) })
      .parse(req.body);

    const evaluation = await app.prisma.auditorEvaluation.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: { id: true, humanDecision: true },
    });
    if (!evaluation) return reply.code(404).send({ error: 'NOT_FOUND' });
    if (['NA_APPROVED', 'NA_PROPOSED'].includes(evaluation.humanDecision)) {
      return reply.code(409).send({ error: 'NA_ALREADY_PROPOSED' });
    }

    await app.prisma.auditorEvaluation.update({
      where: { id },
      data: {
        humanDecision: 'NA_PROPOSED',
        naJustification: body.justification,
        naProposedById: ctx.userId,
      },
    });
    await app.prisma.auditorDecisionLog.create({
      data: {
        tenantId: ctx.tenantId,
        evaluationId: id,
        axis: 'humanDecision',
        fromValue: evaluation.humanDecision,
        toValue: 'NA_PROPOSED',
        actorId: ctx.userId,
        comment: body.justification.slice(0, 300),
      },
    });
    return reply.send({ id, humanDecision: 'NA_PROPOSED' });
  });

  // POST /evaluaciones/:id/na-aprobar — aprueba o rechaza la N/A (admin)
  app.post('/evaluaciones/:id/na-aprobar', async (req, reply) => {
    const ctx = await guard(req, reply, app, 'approveNA');
    if (!ctx) return;

    const { id } = z.object({ id: idSchema }).parse(req.params);
    const body = z
      .object({
        approve: z.boolean(),
        comment: z.string().max(1000).optional(),
      })
      .parse(req.body);

    const evaluation = await app.prisma.auditorEvaluation.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: { id: true, humanDecision: true },
    });
    if (!evaluation) return reply.code(404).send({ error: 'NOT_FOUND' });
    if (evaluation.humanDecision !== 'NA_PROPOSED') {
      return reply.code(409).send({ error: 'NOT_NA_PROPOSED' });
    }

    const to = body.approve ? 'NA_APPROVED' : 'NA_REJECTED';
    await app.prisma.auditorEvaluation.update({
      where: { id },
      data: {
        humanDecision: to,
        naApprovedById: ctx.userId,
        naApprovedAt: new Date(),
        decisionComment: body.comment,
      },
    });
    await app.prisma.auditorDecisionLog.create({
      data: {
        tenantId: ctx.tenantId,
        evaluationId: id,
        axis: 'humanDecision',
        fromValue: 'NA_PROPOSED',
        toValue: to,
        actorId: ctx.userId,
        comment: body.comment,
      },
    });
    return reply.send({ id, humanDecision: to });
  });

  // ── Evidencia manual ──

  // GET /conectores/:key/buscar?q= — candidatos para vincular manualmente
  app.get('/conectores/:key/buscar', async (req, reply) => {
    const ctx = await guard(req, reply, app, 'view');
    if (!ctx) return;

    const { key } = z.object({ key: z.string().min(1).max(60) }).parse(req.params);
    const { q } = z.object({ q: z.string().min(2).max(200) }).parse(req.query);

    const connector = getConnector(key);
    if (!connector) return reply.code(404).send({ error: 'CONNECTOR_NOT_FOUND' });

    const { resolveUserPermsForRequest } = await import('../services/auditor-ia/userPerms.js');
    const userPerms = await resolveUserPermsForRequest(app, ctx.userId, ctx.tenantId);
    if (!hasModuleAccess(userPerms, connector.permissionModule)) {
      return reply.code(403).send({ error: 'PERMISSION_DENIED', module: connector.permissionModule });
    }
    const candidates = await connector.search(
      {
        tenantId: ctx.tenantId,
        userPerms,
        processIds: [],
        sites: [],
        db: app.prisma,
      },
      q,
    );
    return reply.send({ items: candidates });
  });

  // POST /evaluaciones/:id/evidencias — vincula evidencia manual
  app.post('/evaluaciones/:id/evidencias', async (req, reply) => {
    const ctx = await guard(req, reply, app, 'addEvidence');
    if (!ctx) return;

    const { id } = z.object({ id: idSchema }).parse(req.params);
    const body = z
      .object({
        connectorKey: z.string().min(1).max(60),
        entityType: z.string().min(1).max(80),
        entityId: idSchema,
        title: z.string().max(300).optional(),
        note: z.string().max(500).optional(),
      })
      .parse(req.body);

    const evaluation = await app.prisma.auditorEvaluation.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: { id: true, review: { select: { periodFrom: true, periodTo: true } } },
    });
    if (!evaluation) return reply.code(404).send({ error: 'NOT_FOUND' });

    const connector = getConnector(body.connectorKey);
    if (!connector) return reply.code(404).send({ error: 'CONNECTOR_NOT_FOUND' });

    const { resolveUserPermsForRequest } = await import('../services/auditor-ia/userPerms.js');
    const userPerms = await resolveUserPermsForRequest(app, ctx.userId, ctx.tenantId);
    if (!hasModuleAccess(userPerms, connector.permissionModule)) {
      return reply.code(403).send({ error: 'PERMISSION_DENIED', module: connector.permissionModule });
    }

    const snap = await connector.snapshot(app.prisma, ctx.tenantId, body.entityId);
    if (!snap) return reply.code(404).send({ error: 'ENTITY_NOT_FOUND' });
    // Tipo real de la entidad (el snapshot lo resuelve); el body no es confiable.
    const entityType = snap.type;
    const duplicate = await app.prisma.auditorEvidenceLink.findFirst({
      where: { evaluationId: id, tenantId: ctx.tenantId, entityId: body.entityId },
      select: { id: true },
    });
    if (duplicate) return reply.code(409).send({ error: 'ALREADY_LINKED', linkId: duplicate.id });

    const inPeriod = snap.updatedAt
      ? (!evaluation.review.periodFrom || new Date(snap.updatedAt) >= evaluation.review.periodFrom) &&
        (!evaluation.review.periodTo || new Date(snap.updatedAt) <= evaluation.review.periodTo)
      : false;

    const link = await app.prisma.auditorEvidenceLink.create({
      data: {
        tenantId: ctx.tenantId,
        evaluationId: id,
        connectorKey: body.connectorKey,
        entityType,
        entityId: body.entityId,
        entityUpdatedAt: snap.updatedAt ? new Date(snap.updatedAt) : null,
        entityHash: snap.hash,
        title: (body.title ?? body.note ?? `${entityType} ${body.entityId.slice(0, 8)}`).slice(0, 300),
        summary: body.note,
        origin: 'MANUAL',
        addedById: ctx.userId,
        inPeriod,
      },
    });
    await app.prisma.auditorDecisionLog.create({
      data: {
        tenantId: ctx.tenantId,
        evaluationId: id,
        axis: 'evidenceLink',
        toValue: `MANUAL:${entityType}:${body.entityId.slice(0, 8)}`,
        actorId: ctx.userId,
        comment: body.note,
      },
    });
    return reply.code(201).send(link);
  });

  // DELETE /evaluaciones/:id/evidencias/:linkId — quita evidencia manual
  app.delete('/evaluaciones/:id/evidencias/:linkId', async (req, reply) => {
    const ctx = await guard(req, reply, app, 'addEvidence');
    if (!ctx) return;

    const { id, linkId } = z
      .object({ id: idSchema, linkId: idSchema })
      .parse(req.params);

    const link = await app.prisma.auditorEvidenceLink.findFirst({
      where: { id: linkId, evaluationId: id, tenantId: ctx.tenantId },
      select: { id: true, origin: true, entityType: true },
    });
    if (!link) return reply.code(404).send({ error: 'NOT_FOUND' });

    await app.prisma.auditorEvidenceLink.delete({ where: { id: linkId } });
    await app.prisma.auditorDecisionLog.create({
      data: {
        tenantId: ctx.tenantId,
        evaluationId: id,
        axis: 'evidenceLink',
        fromValue: `${link.origin}:${link.entityType}`,
        toValue: 'REMOVED',
        actorId: ctx.userId,
      },
    });
    return reply.send({ removed: true });
  });

  // POST /evaluaciones/:id/reevaluar — nuevo attempt del requisito
  app.post('/evaluaciones/:id/reevaluar', async (req, reply) => {
    const ctx = await guard(req, reply, app, 'runReview');
    if (!ctx) return;

    const { id } = z.object({ id: idSchema }).parse(req.params);
    const evaluation = await app.prisma.auditorEvaluation.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: { reviewId: true, requirementId: true, attempt: true },
    });
    if (!evaluation) return reply.code(404).send({ error: 'NOT_FOUND' });

    const maxAttempt = await app.prisma.auditorEvaluation.aggregate({
      where: { reviewId: evaluation.reviewId, requirementId: evaluation.requirementId, tenantId: ctx.tenantId },
      _max: { attempt: true },
    });
    const nextAttempt = (maxAttempt._max.attempt ?? evaluation.attempt) + 1;
    await app.prisma.auditorEvaluation.createMany({
      data: [{
        tenantId: ctx.tenantId, reviewId: evaluation.reviewId,
        requirementId: evaluation.requirementId, attempt: nextAttempt, workStatus: 'PENDING',
      }],
      skipDuplicates: true,
    });
    const { getAuditorIaQueue } = await import('../jobs/auditorIaJobs.js');
    await getAuditorIaQueue().add('reevaluate-evaluation', {
      reviewId: evaluation.reviewId,
      tenantId: ctx.tenantId,
      requirementId: evaluation.requirementId,
      attempt: nextAttempt,
      requestedById: ctx.userId,
    }, { jobId: `reeval-${evaluation.reviewId}-${evaluation.requirementId}-${nextAttempt}` });
    return reply.code(202).send({ queued: true, attempt: nextAttempt });
  });

  // POST /revisiones/:id/reevaluar-todas — encola un intento nuevo por cada
  // requisito evaluado de la revisión. Regenera explicaciones, gaps y
  // propuestas con el prompt vigente (p.ej. en español) y re-colecta
  // evidencia fresca.
  app.post('/revisiones/:id/reevaluar-todas', async (req, reply) => {
    const ctx = await guard(req, reply, app, 'runReview');
    if (!ctx) return;

    const { id } = z.object({ id: idSchema }).parse(req.params);
    const review = await app.prisma.auditorReview.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: { id: true },
    });
    if (!review) return reply.code(404).send({ error: 'NOT_FOUND' });

    // Último intento por requisito
    const evals = await app.prisma.auditorEvaluation.findMany({
      where: { reviewId: id, tenantId: ctx.tenantId },
      select: { requirementId: true, attempt: true, workStatus: true, limitations: true },
    });
    const latest = new Map<string, (typeof evals)[number]>();
    for (const e of evals) {
      const prev = latest.get(e.requirementId);
      if (!prev || e.attempt > prev.attempt) latest.set(e.requirementId, e);
    }

    const { getAuditorIaQueue } = await import('../jobs/auditorIaJobs.js');
    let queued = 0;
    for (const [requirementId, last] of latest) {
      // Ya en cola (PENDING sin motivo) o en curso: no duplicar.
      const hasReason = Array.isArray(last.limitations) && last.limitations.length > 0;
      if (last.workStatus === 'IN_PROGRESS' || (last.workStatus === 'PENDING' && !hasReason)) continue;
      const attempt = last.attempt;
      await app.prisma.auditorEvaluation.createMany({
        data: [{ tenantId: ctx.tenantId, reviewId: id, requirementId, attempt: attempt + 1, workStatus: 'PENDING' }],
        skipDuplicates: true,
      });
      // jobId fijo por requisito+intento: si ya hay un job encolado para
      // ese intento (doble click), BullMQ lo ignora.
      await getAuditorIaQueue().add('reevaluate-evaluation', {
        reviewId: id,
        tenantId: ctx.tenantId,
        requirementId,
        attempt: attempt + 1,
        requestedById: ctx.userId,
      }, { jobId: `reeval-${id}-${requirementId}-${attempt + 1}` });
      queued++;
    }
    return reply.code(202).send({ queued });
  });

  // POST /revisiones/:id/verificar-staleness — marca STALE las evaluaciones
  // cuyas fuentes cambiaron desde el snapshot.
  app.post('/revisiones/:id/verificar-staleness', async (req, reply) => {
    const ctx = await guard(req, reply, app, 'runReview');
    if (!ctx) return;

    const { id } = z.object({ id: idSchema }).parse(req.params);
    const review = await app.prisma.auditorReview.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: { id: true },
    });
    if (!review) return reply.code(404).send({ error: 'NOT_FOUND' });

    const marked = await markStaleEvaluations(app.prisma, ctx.tenantId, id);
    return reply.send({ markedStale: marked });
  });

  // ═══════════════════════════════════════════════════════════
  // HALLAZGOS (AiFinding desde evaluaciones)
  // ═══════════════════════════════════════════════════════════

  // POST /evaluaciones/:id/hallazgo — crea hallazgo DRAFT desde la evaluación
  app.post('/evaluaciones/:id/hallazgo', async (req, reply) => {
    const ctx = await guard(req, reply, app, 'linkFindings');
    if (!ctx) return;

    const { id } = z.object({ id: idSchema }).parse(req.params);
    const body = z
      .object({
        title: z.string().min(5).max(300),
        description: z.string().min(10).max(4000),
        severity: z.enum(['MUST', 'SHOULD']).default('SHOULD'),
      })
      .parse(req.body);

    const evaluation = await app.prisma.auditorEvaluation.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: {
        id: true, requirementId: true,
        requirement: { select: { clauseNumber: true, clauseId: true } },
        review: { select: { normativeId: true } },
      },
    });
    if (!evaluation) return reply.code(404).send({ error: 'NOT_FOUND' });

    const finding = await app.prisma.aiFinding.create({
      data: {
        tenantId: ctx.tenantId,
        severity: body.severity,
        standard: 'auditor-ia',
        clause: evaluation.requirement.clauseNumber,
        title: body.title,
        description: body.description,
        auditType: 'auditor-ia',
        normativeId: evaluation.review.normativeId,
        clauseId: evaluation.requirement.clauseId,
        evaluationId: evaluation.id,
        requirementId: evaluation.requirementId,
        validationStatus: 'DRAFT',
        status: 'OPEN',
        createdById: ctx.userId,
      },
    });
    return reply.code(201).send(finding);
  });

  // GET /hallazgos — hallazgos del módulo (por revisión)
  app.get('/hallazgos', async (req, reply) => {
    const ctx = await guard(req, reply, app, 'view');
    if (!ctx) return;

    const query = z
      .object({
        reviewId: idSchema.optional(),
        validationStatus: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(100).default(50),
      })
      .parse(req.query);

    const where: Record<string, unknown> = {
      tenantId: ctx.tenantId,
      auditType: 'auditor-ia',
      deletedAt: null,
    };
    if (query.validationStatus) where.validationStatus = query.validationStatus;
    if (query.reviewId) {
      // AiFinding.evaluationId es escalar (sin relación): resolver ids primero
      const evalIds = await app.prisma.auditorEvaluation.findMany({
        where: { reviewId: query.reviewId, tenantId: ctx.tenantId },
        select: { id: true },
      });
      where.evaluationId = { in: evalIds.map((e) => e.id) };
    }

    const items = await app.prisma.aiFinding.findMany({
      where: where as never,
      orderBy: { createdAt: 'desc' },
      take: query.limit,
    });
    return reply.send({ items });
  });

  // POST /hallazgos/:id/validar — valida o rechaza el borrador
  app.post('/hallazgos/:id/validar', async (req, reply) => {
    const ctx = await guard(req, reply, app, 'decide');
    if (!ctx) return;

    const { id } = z.object({ id: idSchema }).parse(req.params);
    const body = z
      .object({
        approve: z.boolean(),
        note: z.string().max(1000).optional(),
      })
      .parse(req.body);

    const finding = await app.prisma.aiFinding.findFirst({
      where: { id, tenantId: ctx.tenantId, auditType: 'auditor-ia', deletedAt: null },
      select: { validationStatus: true },
    });
    if (!finding) return reply.code(404).send({ error: 'NOT_FOUND' });
    if (finding.validationStatus !== 'DRAFT') {
      return reply.code(409).send({ error: 'ALREADY_VALIDATED' });
    }

    const updated = await app.prisma.aiFinding.update({
      where: { id },
      data: {
        validationStatus: body.approve ? 'VALIDATED' : 'REJECTED',
        validatedById: ctx.userId,
        validatedAt: new Date(),
        validationNote: body.note,
      },
    });
    return reply.send(updated);
  });

  // POST /hallazgos/:id/a-nc — convierte a No Conformidad
  app.post('/hallazgos/:id/a-nc', async (req, reply) => {
    const ctx = await guard(req, reply, app, 'linkFindings');
    if (!ctx) return;

    const { id } = z.object({ id: idSchema }).parse(req.params);
    const body = z
      .object({
        severity: z.enum(['CRITICAL', 'MAJOR', 'MINOR', 'OBSERVATION']).default('MAJOR'),
        dueDate: z.coerce.date().optional(),
        assignedToId: idSchema.optional(),
      })
      .parse(req.body ?? {});

    const finding = await app.prisma.aiFinding.findFirst({
      where: { id, tenantId: ctx.tenantId, auditType: 'auditor-ia', deletedAt: null },
      select: { id: true, title: true, description: true, clause: true, validationStatus: true },
    });
    if (!finding) return reply.code(404).send({ error: 'NOT_FOUND' });
    if (finding.validationStatus !== 'VALIDATED') {
      return reply.code(409).send({ error: 'FINDING_NOT_VALIDATED' });
    }

    const year = new Date().getFullYear();
    const count = await app.prisma.nonConformity.count({
      where: { tenantId: ctx.tenantId, code: { startsWith: `NCR-${year}-` } },
    });
    const code = `NCR-${year}-${String(count + 1).padStart(3, '0')}`;

    const ncr = await app.prisma.nonConformity.create({
      data: {
        tenantId: ctx.tenantId,
        code,
        title: finding.title,
        description: finding.description,
        severity: body.severity,
        source: 'AI_FINDING',
        status: 'OPEN',
        clause: finding.clause,
        aiFindingId: finding.id,
        dueDate: body.dueDate,
        assignedToId: body.assignedToId,
        createdById: ctx.userId,
        updatedById: ctx.userId,
      },
    });
    await app.prisma.aiFinding.update({
      where: { id },
      data: {
        validationStatus: 'LINKED',
        linkedById: ctx.userId,
        linkedAt: new Date(),
      },
    });
    return reply.code(201).send({ ncrId: ncr.id, code: ncr.code });
  });

  // POST /hallazgos/:id/a-plan — convierte a Plan de Acción
  app.post('/hallazgos/:id/a-plan', async (req, reply) => {
    const ctx = await guard(req, reply, app, 'linkFindings');
    if (!ctx) return;

    const { id } = z.object({ id: idSchema }).parse(req.params);
    const body = z
      .object({
        plannedAction: z.string().min(5).max(2000),
        type: z.enum(['IMMEDIATE_CORRECTION', 'CORRECTIVE', 'PREVENTIVE', 'IMPROVEMENT']).default('CORRECTIVE'),
        plannedEndDate: z.coerce.date().optional(),
        executorId: idSchema.optional(),
      })
      .parse(req.body);

    const finding = await app.prisma.aiFinding.findFirst({
      where: { id, tenantId: ctx.tenantId, auditType: 'auditor-ia', deletedAt: null },
      select: { id: true, title: true, description: true, clause: true, validationStatus: true, actionPlanId: true },
    });
    if (!finding) return reply.code(404).send({ error: 'NOT_FOUND' });
    if (finding.validationStatus !== 'VALIDATED' && finding.validationStatus !== 'LINKED') {
      return reply.code(409).send({ error: 'FINDING_NOT_VALIDATED' });
    }
    if (finding.actionPlanId) {
      return reply.code(409).send({ error: 'ALREADY_LINKED', actionPlanId: finding.actionPlanId });
    }

    const plan = await app.prisma.actionPlan.create({
      data: {
        tenantId: ctx.tenantId,
        origin: 'AUDIT',
        type: body.type,
        status: 'DRAFT',
        findingDescription: `${finding.title}\n\n${finding.description}`.slice(0, 2000),
        requirement: `Cláusula ${finding.clause}`,
        plannedAction: body.plannedAction,
        plannedEndDate: body.plannedEndDate,
        executorId: body.executorId,
        createdById: ctx.userId,
      },
    });
    await app.prisma.aiFinding.update({
      where: { id },
      data: {
        actionPlanId: plan.id,
        validationStatus: 'LINKED',
        linkedById: ctx.userId,
        linkedAt: new Date(),
      },
    });
    return reply.code(201).send({ actionPlanId: plan.id });
  });

  // ═══════════════════════════════════════════════════════════
  // PREPARACIÓN + INFORME
  // ═══════════════════════════════════════════════════════════

  // GET /revisiones/:id/preparacion — datos para preparar la auditoría:
  // pendientes de decisión, verificaciones externas, preguntas y brechas.
  app.get('/revisiones/:id/preparacion', async (req, reply) => {
    const ctx = await guard(req, reply, app, 'view');
    if (!ctx) return;

    const { id } = z.object({ id: idSchema }).parse(req.params);
    const { buildReportData } = await import('../services/auditor-ia/report.js');
    const data = await buildReportData(app.prisma, ctx.tenantId, id);
    if (!data) return reply.code(404).send({ error: 'NOT_FOUND' });

    const pendingDecisions = data.rows.filter(
      (r) => r.workStatus === 'EVALUATED' && r.humanDecision === 'PENDING',
    ).length;
    const gaps = data.rows.filter(
      (r) => r.aiVerdict === 'POSSIBLE_GAP' || r.humanDecision === 'GAP_CONFIRMED',
    );
    const stale = data.rows.filter((r) => r.workStatus === 'STALE').length;

    return reply.send({
      normative: data.normative,
      review: data.review,
      pendingDecisions,
      staleEvaluations: stale,
      gaps: gaps.map((g) => ({
        code: g.code, clauseNumber: g.clauseNumber, statement: g.statement,
        aiVerdict: g.aiVerdict, humanDecision: g.humanDecision,
      })),
      auditQuestions: data.auditQuestions,
      externalChecks: data.externalChecks,
      findings: data.findings,
    });
  });

  // GET /revisiones/:id/informe — datos del informe (JSON)
  app.get('/revisiones/:id/informe', async (req, reply) => {
    const ctx = await guard(req, reply, app, 'export');
    if (!ctx) return;

    const { id } = z.object({ id: idSchema }).parse(req.params);
    const { buildReportData } = await import('../services/auditor-ia/report.js');
    const data = await buildReportData(app.prisma, ctx.tenantId, id);
    if (!data) return reply.code(404).send({ error: 'NOT_FOUND' });
    return reply.send(data);
  });

  // GET /revisiones/:id/informe.html — informe HTML imprimible
  app.get('/revisiones/:id/informe.html', async (req, reply) => {
    const ctx = await guard(req, reply, app, 'export');
    if (!ctx) return;

    const { id } = z.object({ id: idSchema }).parse(req.params);
    const { buildReportData, buildReportHtml } = await import('../services/auditor-ia/report.js');
    const data = await buildReportData(app.prisma, ctx.tenantId, id);
    if (!data) return reply.code(404).send({ error: 'NOT_FOUND' });

    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<title>Informe Auditor IA — ${data.normative.code}</title>
<style>body{font-family:system-ui,sans-serif;max-width:1100px;margin:24px auto;padding:0 16px;color:#111;}
h1{font-size:20px;}h2{font-size:15px;margin-top:22px;}ul{font-size:12px;}
@media print{body{max-width:none;}}</style></head><body>
${buildReportHtml(data)}
</body></html>`;
    return reply.type('text/html; charset=utf-8').send(html);
  });

  // GET /revisiones/:id/informe.pdf — PDF via renderPdf (puppeteer)
  app.get('/revisiones/:id/informe.pdf', async (req, reply) => {
    const ctx = await guard(req, reply, app, 'export');
    if (!ctx) return;

    const { id } = z.object({ id: idSchema }).parse(req.params);
    const { buildReportData, buildReportHtml } = await import('../services/auditor-ia/report.js');
    const data = await buildReportData(app.prisma, ctx.tenantId, id);
    if (!data) return reply.code(404).send({ error: 'NOT_FOUND' });

    const { renderPdf } = await import('../services/pdf-render.js');
    const result = await renderPdf({
      template: { pageSize: 'A4', orientation: 'landscape', footerShowPageNum: true, footerShowDate: true },
      metadata: {
        documentCode: `AI-REV-${data.normative.code}`,
        revision: 1,
        title: `Informe Auditor IA — ${data.normative.name}`,
        status: 'FINAL',
        exportType: 'INFORMATIVE',
        module: 'auditor-ia',
      },
      bodyHtml: buildReportHtml(data),
    });

    return reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `inline; filename="auditor-ia-${data.normative.code}.pdf"`)
      .send(result.buffer);
  });

  // ═══════════════════════════════════════════════════════════
  // CONSULTA ACOTADA A LA REVISIÓN
  // ═══════════════════════════════════════════════════════════

  // POST /revisiones/:id/consultar — pregunta libre respondida SOLO con
  // datos de esta revisión (evaluaciones + evidencias citables R1..Rn).
  app.post('/revisiones/:id/consultar', async (req, reply) => {
    const ctx = await guard(req, reply, app, 'view');
    if (!ctx) return;

    const { id } = z.object({ id: idSchema }).parse(req.params);
    const body = z
      .object({ question: z.string().min(5).max(1000) })
      .parse(req.body);

    const review = await app.prisma.auditorReview.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: { id: true },
    });
    if (!review) return reply.code(404).send({ error: 'NOT_FOUND' });

    // Contexto acotado: solo el último intento por requisito (los
    // intentos viejos mezclarían dictámenes ya reemplazados).
    const allEvals = await app.prisma.auditorEvaluation.findMany({
      where: { reviewId: id, tenantId: ctx.tenantId },
      orderBy: [{ requirementId: 'asc' }, { attempt: 'desc' }],
      select: {
        requirementId: true,
        workStatus: true, evidenceStatus: true, aiVerdict: true,
        humanDecision: true, explanation: true, limitations: true,
        requirement: { select: { code: true, clauseNumber: true, statement: true } },
        evidenceLinks: {
          select: { title: true, entityType: true, origin: true },
          take: 8,
        },
      },
    });
    const latestByReq = new Map<string, (typeof allEvals)[number]>();
    for (const ev of allEvals) {
      if (!latestByReq.has(ev.requirementId)) latestByReq.set(ev.requirementId, ev);
    }
    const evaluations = [...latestByReq.values()].slice(0, 120);

    // Construir refs R1..Rn (por evaluación) + subrefs de evidencia
    const context: Array<{ ref: string; text: string }> = [];
    evaluations.forEach((ev, i) => {
      const ref = `R${i + 1}`;
      context.push({
        ref,
        text:
          `Requisito ${ev.requirement.code} (cláusula ${ev.requirement.clauseNumber}): ${ev.requirement.statement}. ` +
          `Evidencia: ${ev.evidenceStatus}. Dictamen IA: ${ev.aiVerdict}. Decisión humana: ${ev.humanDecision}. ` +
          (ev.explanation ? `Explicación: ${ev.explanation.slice(0, 500)}. ` : '') +
          ((ev.limitations as string[] | null)?.length ? `Limitaciones: ${(ev.limitations as string[]).join('; ')}. ` : '') +
          (ev.evidenceLinks.length
            ? `Evidencias: ${ev.evidenceLinks.map((l) => `${l.title} (${l.entityType}${l.origin === 'MANUAL' ? ', manual' : ''})`).join('; ')}.`
            : ''),
      });
    });

    const tenant = await app.prisma.tenant.findUnique({
      where: { id: ctx.tenantId },
      select: { llmProvider: true, llmApiKey: true, llmModel: true, llmBaseUrl: true },
    });
    const { AuditorLLM } = await import('../services/auditor-ia/llm-adapter.js');
    const llm = AuditorLLM.forTenant(tenant, app.prisma, ctx.tenantId, ctx.userId);

    const result = await llm.answer({ question: body.question, reviewContext: context });
    if (!result.ok || !result.output) {
      return reply.code(422).send({
        error: 'CANNOT_ANSWER',
        message: 'No se pudo responder la consulta con la información disponible.',
        detail: result.error,
      });
    }
    return reply.send({
      answer: result.output.answer,
      citations: result.output.citations,
      outOfScope: result.output.outOfScope,
      tokens: result.tokens,
    });
  });
}
