// ──────────────────────────────────────────────────────────────
// BullMQ: Cola de procesamiento de normativos
// ──────────────────────────────────────────────────────────────

import { Queue, Worker, type Job } from 'bullmq';
import { processNormativeJob, type ProcessNormativePayload } from './processNormativeJob.js';
import {
  processDocumentVsNormaJob,
  processTenantAuditJob,
  type ProcessDocumentVsNormaPayload,
  type ProcessTenantAuditPayload,
} from './auditJobs.js';

const QUEUE_NAME = 'normative-processing';

function getRedisConnection() {
  const url = process.env.REDIS_URL || 'redis://localhost:6379';
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || '6379', 10),
  };
}

// ── Cola ──

let _queue: Queue<ProcessNormativePayload> | null = null;

export function getNormativeQueue(): Queue<ProcessNormativePayload> {
  if (!_queue) {
    _queue = new Queue<ProcessNormativePayload>(QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      },
    });
  }
  return _queue;
}

// ── Worker ──

let _worker: Worker<ProcessNormativePayload> | null = null;

export function startNormativeWorker(): Worker<ProcessNormativePayload> {
  if (_worker) return _worker;

  _worker = new Worker<ProcessNormativePayload>(
    QUEUE_NAME,
    async (job: Job<ProcessNormativePayload>) => {
      return processNormativeJob(job);
    },
    {
      connection: getRedisConnection(),
      concurrency: 2,
    },
  );

  _worker.on('completed', (job) => {
    console.log(`[normative-worker] Job ${job.id} completed for normative ${job.data.normativeId}`);
  });

  _worker.on('failed', (job, err) => {
    console.error(`[normative-worker] Job ${job?.id} failed:`, err.message);
  });

  console.log('[normative-worker] Worker started');
  return _worker;
}

// ── Audit Analysis Queue ──

const AUDIT_QUEUE_NAME = 'audit-analysis';

type AuditJobPayload = ProcessDocumentVsNormaPayload | ProcessTenantAuditPayload;

let _auditQueue: Queue<AuditJobPayload> | null = null;

export function getAuditQueue(): Queue<AuditJobPayload> {
  if (!_auditQueue) {
    _auditQueue = new Queue<AuditJobPayload>(AUDIT_QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 10000 },
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 20 },
      },
    });
  }
  return _auditQueue;
}

// ── Audit Worker ──

let _auditWorker: Worker<AuditJobPayload> | null = null;

export function startAuditWorker(): Worker<AuditJobPayload> {
  if (_auditWorker) return _auditWorker;

  _auditWorker = new Worker<AuditJobPayload>(
    AUDIT_QUEUE_NAME,
    async (job: Job<AuditJobPayload>) => {
      switch (job.name) {
        case 'analyze-document-vs-norma':
          return processDocumentVsNormaJob(job as Job<ProcessDocumentVsNormaPayload>);
        case 'tenant-full-audit':
          return processTenantAuditJob(job as Job<ProcessTenantAuditPayload>);
        default:
          throw new Error(`Unknown audit job type: ${job.name}`);
      }
    },
    {
      connection: getRedisConnection(),
      concurrency: 1,
      lockDuration: 900000, // 15 minutos para jobs de IA con muchos lotes
      stalledInterval: 60000,
    },
  );

  _auditWorker.on('completed', (job) => {
    console.log(`[audit-worker] Job ${job.id} (${job.name}) completed`);
  });

  _auditWorker.on('failed', (job, err) => {
    console.error(`[audit-worker] Job ${job?.id} (${job?.name}) failed:`, err.message);
  });

  console.log('[audit-worker] Worker started');
  return _auditWorker;
}

// ── Shutdown ──

export async function shutdownQueue(): Promise<void> {
  // Normative worker
  if (_worker) {
    await _worker.close();
    _worker = null;
  }
  if (_queue) {
    await _queue.close();
    _queue = null;
  }

  // Audit worker
  if (_auditWorker) {
    await _auditWorker.close();
    _auditWorker = null;
  }
  if (_auditQueue) {
    await _auditQueue.close();
    _auditQueue = null;
  }
}
