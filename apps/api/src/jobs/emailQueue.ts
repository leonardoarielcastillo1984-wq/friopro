/**
 * Email Queue Service - Async email processing using Bull Queue and Redis
 *
 * This service manages the queue for sending emails asynchronously to ensure
 * API responses remain fast and emails are reliably sent with retry logic.
 */

import { Queue, Worker, type Job } from 'bullmq';
import { sendEmail, type EmailPayload } from '../services/email.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Job payload for email queue
export interface EmailJobPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
  retryCount?: number;
  timestamp?: string;
}

const QUEUE_NAME = 'email-notifications';
const MAX_RETRIES = 3;

/**
 * Get Redis connection configuration
 */
function getRedisConnection() {
  const url = process.env.REDIS_URL || 'redis://localhost:6379';
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || '6379', 10),
    password: parsed.password || undefined,
  };
}

/**
 * Get or create the email queue
 */
let _queue: Queue<EmailJobPayload> | null = null;

export function getEmailQueue(): Queue<EmailJobPayload> {
  if (!_queue) {
    _queue = new Queue<EmailJobPayload>(QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: MAX_RETRIES,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          age: 3600, // Keep completed jobs for 1 hour
        },
        removeOnFail: {
          age: 604800, // Keep failed jobs for 7 days
        },
      },
    });
  }
  return _queue;
}

/**
 * Queue an email for sending
 */
export async function queueEmail(payload: EmailPayload, priority?: number): Promise<void> {
  const queue = getEmailQueue();
  const jobPayload: EmailJobPayload = {
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
    timestamp: new Date().toISOString(),
  };

  await queue.add(QUEUE_NAME, jobPayload, {
    priority,
  });
}

/**
 * Start the email worker
 */
let _worker: Worker<EmailJobPayload> | null = null;

export function startEmailWorker(): Worker<EmailJobPayload> {
  if (_worker) return _worker;

  const redisConnection = getRedisConnection();

  _worker = new Worker<EmailJobPayload>(
    QUEUE_NAME,
    async (job: Job<EmailJobPayload>) => {
      try {
        console.log(`[EmailWorker] Processing email job ${job.id} to ${job.data.to}`);

        const result = await sendEmail({
          to: job.data.to,
          subject: job.data.subject,
          html: job.data.html,
          text: job.data.text,
        });

        if (!result.success) {
          throw new Error(`Email send failed: ${result.error}`);
        }

        console.log(`[EmailWorker] ✓ Email sent successfully to ${job.data.to} (Message ID: ${result.messageId})`);

        // Log success in audit trail
        try {
          await prisma.auditEvent.create({
            data: {
              action: 'EMAIL_SENT',
              entityType: 'EMAIL',
              entityId: result.messageId,
              metadata: {
                to: job.data.to,
                subject: job.data.subject,
                timestamp: job.data.timestamp,
              },
            },
          });
        } catch (auditErr) {
          console.error('[EmailWorker] Failed to log email audit event:', auditErr);
        }

        return { success: true, messageId: result.messageId };
      } catch (error: any) {
        console.error(`[EmailWorker] ✗ Error processing email job ${job.id}:`, error);

        // Log failure in audit trail
        try {
          await prisma.auditEvent.create({
            data: {
              action: 'EMAIL_FAILED',
              entityType: 'EMAIL',
              metadata: {
                to: job.data.to,
                subject: job.data.subject,
                error: error.message,
                attempt: job.attemptsMade,
                maxAttempts: job.opts.attempts,
                timestamp: job.data.timestamp,
              },
            },
          });
        } catch (auditErr) {
          console.error('[EmailWorker] Failed to log email failure audit event:', auditErr);
        }

        // Re-throw to trigger retry
        throw error;
      }
    },
    {
      connection: redisConnection,
      concurrency: parseInt(process.env.EMAIL_WORKER_CONCURRENCY || '5', 10),
    }
  );

  // Event listeners
  _worker.on('completed', (job: Job<EmailJobPayload>) => {
    console.log(`[EmailWorker] Job ${job.id} completed`);
  });

  _worker.on('failed', (job: Job<EmailJobPayload> | undefined, err: Error) => {
    console.error(`[EmailWorker] Job ${job?.id} failed after ${job?.attemptsMade} attempts:`, err.message);
  });

  _worker.on('error', (err: Error) => {
    console.error('[EmailWorker] Worker error:', err);
  });

  return _worker;
}

/**
 * Get queue statistics
 */
export async function getEmailQueueStats() {
  const queue = getEmailQueue();

  const [waiting, active, delayed, failed, completed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getDelayedCount(),
    queue.getFailedCount(),
    queue.getCompletedCount(),
  ]);

  return {
    waiting,
    active,
    delayed,
    failed,
    completed,
    total: waiting + active + delayed + failed + completed,
  };
}

/**
 * Cleanup email queue (admin function)
 */
export async function cleanupEmailQueue() {
  const queue = getEmailQueue();

  // Remove completed jobs older than 1 hour
  await queue.clean(3600000, 100, 'completed');

  // Remove failed jobs older than 7 days
  await queue.clean(604800000, 100, 'failed');

  console.log('[EmailQueue] Cleanup completed');
}

/**
 * Graceful shutdown
 */
export async function closeEmailQueue(): Promise<void> {
  if (_worker) {
    await _worker.close();
    _worker = null;
  }
  if (_queue) {
    await _queue.close();
    _queue = null;
  }
}
