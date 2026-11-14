// ──────────────────────────────────────────────────────────────
// Auditor IA — cola BullMQ "auditor-ia"
//
// Un job por revisión. Reconstruye el contexto del creador:
// permisos de módulos (para gating de conectores) y config LLM
// del tenant. El worker corre secuencial dentro de la revisión
// (concurrencia 1 por revisión, spec §7).
// ──────────────────────────────────────────────────────────────

import { Queue, Worker, type Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { runReview, reevaluateRequirement } from '../services/auditor-ia/orchestrator.js';
import { AuditorLLM } from '../services/auditor-ia/llm-adapter.js';
import { resolveUserPerms } from '../services/auditor-ia/userPerms.js';

const QUEUE_NAME = 'auditor-ia';

export interface AuditorReviewPayload {
  reviewId: string;
  tenantId: string;
  /** Presente solo en job 'reevaluate-evaluation'. */
  requirementId?: string;
  attempt?: number;
  requestedById?: string;
}

function getRedisConnection() {
  const url = process.env.REDIS_URL || 'redis://localhost:6379';
  const parsed = new URL(url);
  return { host: parsed.hostname, port: parseInt(parsed.port || '6379', 10) };
}

// ── Cola ──

let _queue: Queue<AuditorReviewPayload> | null = null;

export function getAuditorIaQueue(): Queue<AuditorReviewPayload> {
  if (!_queue) {
    _queue = new Queue<AuditorReviewPayload>(QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 30000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      },
    });
  }
  return _queue;
}

// ── Procesamiento ──

async function processAuditorReviewJob(job: Job<AuditorReviewPayload>): Promise<void> {
  const { reviewId, tenantId } = job.data;
  const prisma = new PrismaClient();
  try {
    const review = await prisma.auditorReview.findFirst({
      where: { id: reviewId, tenantId },
      select: {
        id: true, tenantId: true, normativeId: true, createdById: true, processIds: true,
        sites: true, periodFrom: true, periodTo: true, config: true,
      },
    });
    if (!review) throw new Error(`revisión ${reviewId} no encontrada`);

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { llmProvider: true, llmApiKey: true, llmModel: true, llmBaseUrl: true },
    });

    const config = (review.config as { tokenBudget?: number } | null) ?? {};
    const tokenBudget = config.tokenBudget ?? Number(process.env.AUDITOR_IA_REVIEW_TOKENS ?? 200_000);

    if (job.name === 'reevaluate-evaluation') {
      const userId = job.data.requestedById ?? review.createdById;
      const userPerms = await resolveUserPerms(prisma, userId, tenantId);
      const llm = AuditorLLM.forTenant(tenant, prisma, tenantId, userId);
      const { tokens } = await reevaluateRequirement(
        {
          tenantId,
          reviewId,
          normativeId: review.normativeId,
          createdById: userId,
          userPerms,
          processIds: review.processIds ?? [],
          sites: review.sites ?? [],
          periodFrom: review.periodFrom ?? undefined,
          periodTo: review.periodTo ?? undefined,
          prisma,
          llm,
          tokenBudget,
        },
        job.data.requirementId!,
        job.data.attempt ?? 2,
      );
      await prisma.auditorReview.updateMany({
        where: { id: reviewId },
        data: { usedTokens: { increment: tokens } },
      });
      console.log(`[auditor-ia] reevaluación ${job.data.requirementId} en review ${reviewId}: ${tokens} tok`);
      return;
    }

    const userPerms = await resolveUserPerms(prisma, review.createdById, tenantId);
    const llm = AuditorLLM.forTenant(tenant, prisma, tenantId, review.createdById);

    const result = await runReview({
      tenantId,
      reviewId,
      normativeId: review.normativeId,
      createdById: review.createdById,
      userPerms,
      processIds: review.processIds ?? [],
      sites: review.sites ?? [],
      periodFrom: review.periodFrom ?? undefined,
      periodTo: review.periodTo ?? undefined,
      prisma,
      llm,
      tokenBudget,
    });

    console.log(`[auditor-ia] revisión ${reviewId}: ${result.status} (${result.evaluated} eval, ${result.failed} err, ${result.tokensUsed} tok)`);
  } catch (e) {
    // Marcar la revisión como fallida si muere el job de la revisión.
    // Una re-evaluación puntual que falla no invalida la revisión entera.
    if (job.name === 'run-review') await prisma.auditorReview.updateMany({
      where: { id: reviewId, tenantId, status: { in: ['QUEUED', 'RUNNING'] } },
      data: { status: 'FAILED', finishedAt: new Date(), error: (e as Error).message?.slice(0, 500) },
    }).catch(() => {});
    throw e;
  } finally {
    await prisma.$disconnect();
  }
}

// ── Worker ──

let _worker: Worker<AuditorReviewPayload> | null = null;

export function startAuditorIaWorker(): Worker<AuditorReviewPayload> {
  if (_worker) return _worker;

  _worker = new Worker<AuditorReviewPayload>(
    QUEUE_NAME,
    async (job: Job<AuditorReviewPayload>) => {
      if (job.name !== 'run-review' && job.name !== 'reevaluate-evaluation') {
        throw new Error(`Unknown auditor-ia job: ${job.name}`);
      }
      return processAuditorReviewJob(job);
    },
    {
      connection: getRedisConnection(),
      concurrency: 1, // una revisión a la vez por instancia
      lockDuration: 900000,
      stalledInterval: 60000,
    },
  );

  _worker.on('completed', (job) => {
    console.log(`[auditor-ia-worker] Job ${job.id} completed`);
  });
  _worker.on('failed', (job, err) => {
    console.error(`[auditor-ia-worker] Job ${job?.id} failed:`, err.message);
  });

  console.log('[auditor-ia-worker] Worker started');
  return _worker;
}

export async function shutdownAuditorIaQueue(): Promise<void> {
  if (_worker) { await _worker.close(); _worker = null; }
  if (_queue) { await _queue.close(); _queue = null; }
}
