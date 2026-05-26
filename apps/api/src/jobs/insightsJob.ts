/**
 * INSIGHTS CRON JOB
 * Genera insights proactivos periódicamente para cada tenant activo
 * y los almacena en AIProactiveAlert para notificación
 */

import { Queue, Worker, type Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { AIInsightsEngine } from '../services/ai-insights-engine.js';

const QUEUE_NAME = 'insights-generation';

function getRedisConnection() {
  const url = process.env.REDIS_URL || 'redis://localhost:6379';
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || '6379', 10),
  };
}

interface InsightsJobPayload {
  tenantId?: string; // si es null, procesa todos los tenants
}

let _queue: Queue<InsightsJobPayload> | null = null;
let _worker: Worker<InsightsJobPayload> | null = null;

export function getInsightsQueue(): Queue<InsightsJobPayload> {
  if (!_queue) {
    _queue = new Queue<InsightsJobPayload>(QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 10000 },
        removeOnComplete: { count: 20 },
        removeOnFail: { count: 10 },
      },
    });
  }
  return _queue;
}

export function startInsightsWorker(prisma: PrismaClient): Worker<InsightsJobPayload> {
  if (_worker) return _worker;

  const insightsEngine = new AIInsightsEngine(prisma);
  const db = prisma as any;

  _worker = new Worker<InsightsJobPayload>(
    QUEUE_NAME,
    async (job: Job<InsightsJobPayload>) => {
      console.log(`[insights-worker] Processing job ${job.id}`);

      let tenantIds: string[] = [];

      if (job.data.tenantId) {
        tenantIds = [job.data.tenantId];
      } else {
        // Obtener todos los tenants activos
        const tenants = await db.tenant?.findMany({
          where: { status: 'ACTIVE' },
          select: { id: true },
          take: 100,
        }) || [];
        tenantIds = tenants.map((t: any) => t.id);
      }

      let totalInsights = 0;

      for (const tenantId of tenantIds) {
        try {
          const insights = await insightsEngine.generateInsights(tenantId);

          // Guardar insights críticos y altos como AIProactiveAlert
          const criticalInsights = insights.filter(
            (i: any) => i.severity === 'critical' || i.severity === 'high'
          );

          for (const insight of criticalInsights) {
            try {
              await db.aIProactiveAlert?.create({
                data: {
                  tenantId,
                  type: insight.type?.toUpperCase() || 'INSIGHT',
                  severity: insight.severity?.toUpperCase() || 'MEDIUM',
                  title: insight.title,
                  description: insight.description,
                  module: insight.category || 'general',
                  status: 'ACTIVE',
                  metadata: {
                    recommendations: insight.recommendations,
                    confidence: insight.confidence,
                    metric: insight.metric,
                    generatedBy: 'insights-cron',
                  },
                },
              });
              totalInsights++;
            } catch {
              // Skip duplicates or errors
            }
          }
        } catch (err) {
          console.error(`[insights-worker] Error for tenant ${tenantId}:`, err);
        }
      }

      console.log(`[insights-worker] Job ${job.id} done — ${totalInsights} alerts created for ${tenantIds.length} tenants`);
      return { totalInsights, tenants: tenantIds.length };
    },
    {
      connection: getRedisConnection(),
      concurrency: 1,
    },
  );

  _worker.on('completed', (job) => {
    console.log(`[insights-worker] Job ${job.id} completed`);
  });

  _worker.on('failed', (job, err) => {
    console.error(`[insights-worker] Job ${job?.id} failed:`, err.message);
  });

  console.log('[insights-worker] Worker started');
  return _worker;
}

/**
 * Programa el job recurrente (cada 6 horas)
 */
export async function scheduleInsightsCron(): Promise<void> {
  const queue = getInsightsQueue();
  // Remover cron anterior si existe
  const repeatableJobs = await queue.getRepeatableJobs();
  for (const rj of repeatableJobs) {
    if (rj.name === 'insights-cron') {
      await queue.removeRepeatableByKey(rj.key);
    }
  }
  // Programar nuevo cron: cada 6 horas
  await queue.add('insights-cron', {}, {
    repeat: { pattern: '0 */6 * * *' },
  });
  console.log('[insights-cron] Scheduled every 6 hours');
}

export async function shutdownInsightsQueue(): Promise<void> {
  if (_worker) { await _worker.close(); _worker = null; }
  if (_queue) { await _queue.close(); _queue = null; }
}
