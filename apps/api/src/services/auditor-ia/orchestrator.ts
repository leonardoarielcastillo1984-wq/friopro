// ──────────────────────────────────────────────────────────────
// Auditor IA — orquestador de revisiones (spec §7)
//
// Por cada requisito de la revisión, secuencial:
//   1. cancelRequested → detener
//   2. collect de conectores con permiso (resto → SOURCE_UNAVAILABLE)
//   3. evidenceStatus determinista (presencia en período)
//   4. verificationTypes ⊆ {OBSERVATION, INTERVIEW} →
//      REQUIRES_EXTERNAL_VERIFICATION sin llamar al modelo
//   5. ABSENT → INSUFFICIENT_EVIDENCE sin llamar al modelo
//   6. resto → AuditorLLM.evaluate + sourceSnapshot
//   7. progress + usedTokens
//
// Persiste por requisito → el reintento retoma los pendientes.
// ──────────────────────────────────────────────────────────────

import { Prisma, type PrismaClient } from '@prisma/client';
import type { EvidenceItem, ConnectorContext, UserPerms, SourceSnapshot } from './connectors/types.js';
import { getConnector } from './connectors/index.js';
import { AuditorLLM, PROMPT_VERSION } from './llm-adapter.js';

export interface ReviewRunContext {
  tenantId: string;
  reviewId: string;
  /** Norma de la revisión: los conectores filtran mapeos por cláusula. */
  normativeId?: string;
  createdById: string | null;
  userPerms: UserPerms;
  processIds: string[];
  sites: string[];
  periodFrom?: Date;
  periodTo?: Date;
  prisma: PrismaClient;
  llm: AuditorLLM;
  /** Tope de tokens de la revisión (config del review). */
  tokenBudget: number;
}

type EvidenceStatus = 'FOUND' | 'PARTIAL' | 'ABSENT' | 'SOURCE_UNAVAILABLE';

/**
 * Estado determinista de evidencia (spec §7.3):
 * - SOURCE_UNAVAILABLE: ninguna fuente respondió (permiso/error), no hay ítems
 * - ABSENT: se consultó y no hay ítems
 * - FOUND: hay ítems y al menos uno está en período
 * - PARTIAL: hay ítems pero ninguno en período
 */
function computeEvidenceStatus(
  items: EvidenceItem[],
  anySourceQueried: boolean,
): EvidenceStatus {
  if (items.length === 0) {
    return anySourceQueried ? 'ABSENT' : 'SOURCE_UNAVAILABLE';
  }
  return items.some((i) => i.inPeriod) ? 'FOUND' : 'PARTIAL';
}

interface RequirementRow {
  id: string;
  clauseNumber: string;
  statement: string;
  verificationTypes: string[];
  connectorKeys: string[];
  requiresDocumentedInfo: boolean;
}

async function evaluateOne(
  ctx: ReviewRunContext,
  requirement: RequirementRow,
  attempt: number,
): Promise<{ tokens: number }> {
  const { prisma, tenantId } = ctx;

  // Eval existente para este intento (reintentos retoman pendientes)
  let evaluation = await prisma.auditorEvaluation.findUnique({
    where: {
      reviewId_requirementId_attempt: {
        reviewId: ctx.reviewId,
        requirementId: requirement.id,
        attempt,
      },
    },
  });
  if (evaluation && evaluation.workStatus !== 'IN_PROGRESS') {
    evaluation = await prisma.auditorEvaluation.update({
      where: { id: evaluation.id },
      data: { workStatus: 'IN_PROGRESS', limitations: [] },
    });
  }
  evaluation ??= await prisma.auditorEvaluation.create({
    data: {
      tenantId,
      reviewId: ctx.reviewId,
      requirementId: requirement.id,
      attempt,
      workStatus: 'IN_PROGRESS',
    },
  });

  const markError = async (msg: string) => {
    // PENDING: el reintento retoma este requisito (spec §7)
    await prisma.auditorEvaluation.update({
      where: { id: evaluation!.id },
      data: {
        workStatus: 'PENDING',
        limitations: ['error de ejecución: ' + msg.slice(0, 200)],
      },
    });
  };

  try {
    // 2) Collect de conectores
    const items: EvidenceItem[] = [];
    const unavailable: Array<{ key: string; reason: string }> = [];
    const consulted: string[] = [];
    const connectorCtx: ConnectorContext = {
      tenantId,
      userPerms: ctx.userPerms,
      normativeId: ctx.normativeId,
      processIds: ctx.processIds,
      sites: ctx.sites,
      periodFrom: ctx.periodFrom,
      periodTo: ctx.periodTo,
      db: prisma,
    };

    // Evidencia manual del intento anterior: los vínculos son por
    // evaluación, así que el intento nuevo arranca con copias y el
    // modelo las ve como fuentes (E#).
    if (attempt > 1) {
      const prevLinks = await prisma.auditorEvidenceLink.findMany({
        where: {
          tenantId,
          origin: 'MANUAL',
          evaluation: {
            reviewId: ctx.reviewId,
            requirementId: requirement.id,
            attempt: attempt - 1,
          },
        },
        select: {
          entityType: true, entityId: true, version: true,
          entityUpdatedAt: true, title: true, url: true,
          summary: true, entityHash: true, inPeriod: true,
        },
      });
      for (const l of prevLinks) {
        items.push({
          entityType: l.entityType,
          entityId: l.entityId,
          title: l.title,
          version: l.version ?? undefined,
          updatedAt: l.entityUpdatedAt ?? undefined,
          url: l.url ?? '',
          inPeriod: l.inPeriod,
          summary: l.summary ?? l.title,
          hash: l.entityHash ?? '',
          manual: true,
        });
      }
    }

    for (const key of requirement.connectorKeys.length ? requirement.connectorKeys : ['documents']) {
      const connector = getConnector(key);
      if (!connector) {
        unavailable.push({ key, reason: 'conector desconocido' });
        continue;
      }
      try {
        const result = await connector.collect(connectorCtx, requirement);
        consulted.push(key);
        if (!result.coverage.available) {
          unavailable.push({ key, reason: result.coverage.reason ?? 'no disponible' });
        }
        items.push(...result.items);
      } catch (e) {
        unavailable.push({ key, reason: `error: ${(e as Error).message}`.slice(0, 150) });
      }
    }

    // 2b) Segunda pasada autónoma: si no se localizó evidencia, el agente
    // reintenta el conector de documentos con criterios más amplios
    // (más términos del enunciado, número de cláusula, contenido).
    let relaxedTried = false;
    if (items.length === 0 && !unavailable.some((u) => u.key === 'documents')) {
      const docConnector = getConnector('documents');
      if (docConnector) {
        relaxedTried = true;
        try {
          const retry = await docConnector.collect({ ...connectorCtx, relaxed: true }, requirement);
          if (retry.items.length) {
            items.push(...retry.items);
            if (!consulted.includes('documents')) consulted.push('documents');
          }
        } catch {
          // la segunda pasada es best-effort: si falla, se sigue con ABSENT
        }
      }
    }

    // Dedupe por entidad: un ítem manual vinculado a la misma fuente
    // que colecta un conector no aparece dos veces (gana el manual).
    const seen = new Set<string>();
    const deduped = items.filter((i) => {
      const k = `${i.entityType}:${i.entityId}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    items.length = 0;
    items.push(...deduped);

    // Evidencia manual primero (la marcó un humano) y en período
    // después: el modelo recibe las primeras MAX_MODEL_EVIDENCE y
    // los refs E# se asignan por este orden.
    items.sort((a, b) =>
      Number(b.manual ?? false) - Number(a.manual ?? false) ||
      Number(b.inPeriod) - Number(a.inPeriod),
    );

    // 3) evidenceStatus determinista
    const evidenceStatus = computeEvidenceStatus(items, consulted.length > 0);

    // 4) Solo verificación externa → sin modelo
    const externalOnly =
      requirement.verificationTypes.length > 0 &&
      requirement.verificationTypes.every((t) => t === 'OBSERVATION' || t === 'INTERVIEW');

    const snapshots = items.map((i) => ({
      type: i.entityType,
      id: i.entityId,
      updatedAt: i.updatedAt?.toISOString() ?? null,
      hash: i.hash,
    }));

    let aiVerdict: string;
    let workStatus = 'EVALUATED';
    let noProvider = false;
    let explanation = '';
    let limitations: string[] = [];
    let externalChecks: string[] = [];
    let gaps: unknown[] = [];
    let proposals: unknown[] = [];
    let auditQuestions: string[] = [];
    let assessments: Record<string, string> = {};
    let tokens = 0;
    let model: string | undefined;

    if (externalOnly) {
      aiVerdict = 'REQUIRES_EXTERNAL_VERIFICATION';
      explanation =
        'El requisito solo admite verificación por observación o entrevista; ' +
        'la evidencia digital no puede sustentar un dictamen.';
      limitations = ['verificación externa requerida'];
    } else if (evidenceStatus === 'ABSENT') {
      aiVerdict = 'INSUFFICIENT_EVIDENCE';
      explanation =
        'No se encontró evidencia digital para este requisito en el alcance configurado. ' +
        'Esto no implica incumplimiento: verificar en sitio o cargar evidencia.';
      limitations = [
        ...(unavailable.length
          ? unavailable.map((u) => `fuente ${u.key}: ${u.reason}`)
          : ['sin evidencia localizada']),
        ...(relaxedTried ? ['búsqueda ampliada de documentos sin resultados'] : []),
      ];
    } else {
      // 6) Llamada al modelo
      const result = await ctx.llm.evaluate({ requirement, evidence: items });
      tokens += result.tokens;
      model = result.model;
      if (!result.ok && result.transient) {
        // Proveedor saturado/caído: no es un dictamen. Queda PENDING
        // (markError) para que el reintento de la cola o "Reintentar" lo retome.
        throw new Error(`proveedor IA no disponible temporalmente, se reintentará (${result.error ?? ''})`);
      }
      if (!result.ok || !result.output) {
        // Sin dictamen por defecto (spec §9): CANNOT_EVALUATE va en workStatus
        workStatus = 'CANNOT_EVALUATE';
        aiVerdict = 'NONE';
        noProvider = /no configurad|api_key|apikey|api key/i.test(result.error ?? '');
        explanation = 'No fue posible obtener una evaluación válida del modelo.';
        limitations = [result.error ?? 'salida inválida del modelo'];
      } else {
        const out = result.output;
        aiVerdict = out.verdict;
        explanation = out.explanation;
        limitations = out.limitations;
        externalChecks = out.externalChecks;
        gaps = out.gaps;
        proposals = out.proposals;
        auditQuestions = out.auditQuestions;
        for (const ev of out.evidence) assessments[ev.ref] = ev.assessment;
      }
    }

    // Guardar vínculos de evidencia automática
    if (items.length) {
      await prisma.auditorEvidenceLink.deleteMany({
        where: { evaluationId: evaluation.id, origin: 'AUTO' },
      });
      await prisma.auditorEvidenceLink.createMany({
        data: items.map((i, idx) => ({
          tenantId,
          evaluationId: evaluation!.id,
          connectorKey: connectorKeyFor(i, requirement),
          entityType: i.entityType,
          entityId: i.entityId,
          version: i.version,
          entityUpdatedAt: i.updatedAt,
          title: i.title.slice(0, 300),
          url: i.url,
          summary: i.summary,
          entityHash: i.hash,
          origin: (i.manual ? 'MANUAL' : 'AUTO') as 'MANUAL' | 'AUTO',
          aiAssessment: assessments[`E${idx + 1}`] ?? null,
          inPeriod: i.inPeriod,
        })),
      });
    }

    await prisma.auditorEvaluation.update({
      where: { id: evaluation.id },
      data: {
        workStatus,
        evidenceStatus,
        aiVerdict,
        noProvider,
        explanation: explanation.slice(0, 4000),
        limitations,
        externalChecks,
        gaps: gaps as object[],
        proposals: proposals as object[],
        auditQuestions,
        sourcesConsulted: items.map((_, i) => `E${i + 1}`),
        sourcesUnavailable: unavailable.map((u) => ({ connectorKey: u.key, reason: u.reason })),
        sourceSnapshot: { items: snapshots },
        model,
        promptVersion: PROMPT_VERSION,
        tokens,
      },
    });

    // Comportamiento autónomo: cuando el dictamen marca una brecha
    // posible, el agente convierte sus propuestas ACTION_PLAN en
    // planes de acción DRAFT (el humano los valida/cierra después).
    // sourceRef evita duplicados en reevaluaciones del mismo intento.
    if (aiVerdict === 'POSSIBLE_GAP') {
      const actionProposals = (proposals as Array<{ action?: string; target?: string }>)
        .filter((p) => p?.target === 'ACTION_PLAN' && typeof p.action === 'string' && p.action.length > 10)
        .slice(0, 3);
      const firstGap = (gaps as Array<{ description?: string }>)
        .find((g) => typeof g?.description === 'string')?.description;
      for (let i = 0; i < actionProposals.length; i++) {
        const sourceRef = `auditor-ia:${evaluation.id}:${i}`;
        const exists = await prisma.actionPlan.findFirst({
          where: { tenantId, sourceRef },
          select: { id: true },
        });
        if (exists) continue;
        await prisma.actionPlan.create({
          data: {
            tenantId,
            origin: 'AUDIT',
            type: 'CORRECTIVE',
            status: 'DRAFT',
            requirement: `Cláusula ${requirement.clauseNumber}`,
            findingDescription: (firstGap ?? explanation).slice(0, 2000),
            plannedAction: actionProposals[i].action!.slice(0, 4000),
            sourceRef,
            createdById: ctx.createdById,
          },
        });
      }
    }

    return { tokens };
  } catch (e) {
    await markError((e as Error).message);
    throw e;
  }
}

function connectorKeyFor(item: EvidenceItem, requirement: RequirementRow): string {
  const map: Record<string, string> = {
    Document: 'documents',
    SgiObjective: 'objectives',
    Position: 'competence',
    EmployeeCompetency: 'competence',
    SgiTraining: 'competence',
    Supplier: 'suppliers',
    OrganizationContext: 'context',
    Stakeholder: 'context',
    Risk: 'risks',
    Indicator: 'indicators',
    NonConformity: 'ncr',
    Audit: 'internal_audits',
    ManagementReview: 'management_review',
  };
  return map[item.entityType] ?? requirement.connectorKeys[0] ?? 'documents';
}

/**
 * Reevalúa un requisito puntual creando un intento nuevo (spec §7:
 * "reevaluar crea attempt N+1 por evaluación"). Usado por el job
 * `reevaluate-evaluation`.
 */
export async function reevaluateRequirement(
  ctx: Omit<ReviewRunContext, 'reviewId'> & { reviewId: string },
  requirementId: string,
  attempt: number,
): Promise<{ tokens: number }> {
  const requirement = await ctx.prisma.auditorRequirement.findFirst({
    where: { id: requirementId, tenantId: ctx.tenantId },
    select: {
      id: true, clauseNumber: true, statement: true,
      verificationTypes: true, connectorKeys: true,
      requiresDocumentedInfo: true,
    },
  });
  if (!requirement) throw new Error('requisito no encontrado');
  return evaluateOne(ctx, requirement, attempt);
}

/**
 * Ejecuta (o retoma) una revisión. Idempotente: los requisitos ya
 * EVALUATED del intento actual se saltan.
 */
export async function runReview(ctx: ReviewRunContext): Promise<{
  status: 'COMPLETED' | 'CANCELLED' | 'FAILED';
  evaluated: number;
  failed: number;
  tokensUsed: number;
}> {
  const { prisma, tenantId, reviewId } = ctx;

  const review = await prisma.auditorReview.findFirst({
    where: { id: reviewId, tenantId },
    include: {
      extraction: {
        select: {
          requirements: {
            where: { status: 'APPROVED' },
            orderBy: { order: 'asc' },
            select: {
              id: true, clauseNumber: true, statement: true,
              verificationTypes: true, connectorKeys: true,
              requiresDocumentedInfo: true,
            },
          },
        },
      },
    },
  });
  if (!review) throw new Error('revisión no encontrada');

  let requirements: RequirementRow[] = review.extraction.requirements;
  if (review.requirementIds?.length) {
    const wanted = new Set(review.requirementIds);
    requirements = requirements.filter((r) => wanted.has(r.id));
  }

  let tokensUsed = review.usedTokens ?? 0;
  let evaluated = 0;
  let failed = 0;

  await prisma.auditorReview.update({
    where: { id: reviewId },
    data: { status: 'RUNNING', startedAt: review.startedAt ?? new Date() },
  });

  for (let i = 0; i < requirements.length; i++) {
    const req = requirements[i];

    // 1) Cancelación cooperativa
    const current = await prisma.auditorReview.findUnique({
      where: { id: reviewId },
      select: { cancelRequested: true },
    });
    if (current?.cancelRequested) {
      await prisma.auditorReview.update({
        where: { id: reviewId },
        data: { status: 'CANCELLED', finishedAt: new Date(), progress: Math.round((i / requirements.length) * 100) },
      });
      return { status: 'CANCELLED', evaluated, failed, tokensUsed };
    }

    // Retomar sobre el último intento del requisito (reevaluar crea
    // attempt N+1): si ya está EVALUATED se salta, si quedó pendiente
    // o falló se completa ese mismo intento.
    const latest = await prisma.auditorEvaluation.findFirst({
      where: { reviewId, requirementId: req.id },
      orderBy: { attempt: 'desc' },
      select: { workStatus: true, attempt: true },
    });
    const attempt = latest?.attempt ?? 1;
    if (latest?.workStatus === 'EVALUATED' || latest?.workStatus === 'STALE') {
      evaluated++;
      continue;
    }

    // Tope de tokens de la revisión
    if (ctx.tokenBudget > 0 && tokensUsed >= ctx.tokenBudget) {
      await prisma.auditorReview.update({
        where: { id: reviewId },
        data: { status: 'FAILED', finishedAt: new Date(), error: 'tope de tokens de la revisión alcanzado' },
      });
      return { status: 'FAILED', evaluated, failed, tokensUsed };
    }

    try {
      const { tokens } = await evaluateOne(ctx, req, attempt);
      tokensUsed += tokens;
      evaluated++;
    } catch {
      failed++;
    }

    // 7) progreso + tokens
    await prisma.auditorReview.update({
      where: { id: reviewId },
      data: {
        progress: Math.round(((i + 1) / requirements.length) * 100),
        usedTokens: tokensUsed,
      },
    });
  }

  const finalStatus = failed > 0 && evaluated === 0 ? 'FAILED' : 'COMPLETED';
  await prisma.auditorReview.update({
    where: { id: reviewId },
    data: {
      status: finalStatus,
      finishedAt: new Date(),
      progress: 100,
      usedTokens: tokensUsed,
      totals: {
        requirements: requirements.length,
        evaluated,
        failed,
      },
    },
  });

  return { status: finalStatus, evaluated, failed, tokensUsed };
}
