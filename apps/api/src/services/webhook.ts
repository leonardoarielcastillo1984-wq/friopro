/**
 * Webhook dispatch service — sends notifications to Slack, Teams, or custom endpoints.
 */

import type { PrismaClient } from '@prisma/client';

type WebhookPayload = {
  type: string;
  title: string;
  message: string;
  link?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  timestamp: string;
  tenantName?: string;
};

// ── Slack block kit formatter ──
function buildSlackPayload(p: WebhookPayload) {
  const severityEmoji: Record<string, string> = {
    NCR_ASSIGNED: '🔴',
    NCR_STATUS_CHANGED: '🟡',
    NCR_OVERDUE: '⏰',
    RISK_CRITICAL: '🛡️',
    AUDIT_COMPLETED: '✅',
    AUDIT_FAILED: '❌',
    FINDING_NEW: '🔍',
    TRAINING_SCHEDULED: '📚',
    TRAINING_REMINDER: '📅',
    MEMBER_INVITED: '👤',
    SYSTEM_ALERT: '⚙️',
  };

  const emoji = severityEmoji[p.type] || '📌';

  return {
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${emoji} *${p.title}*\n${p.message}`,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `*Tipo:* ${p.type} | *Organización:* ${p.tenantName || 'SGI 360'} | ${new Date(p.timestamp).toLocaleString('es-AR')}`,
          },
        ],
      },
    ],
  };
}

// ── Teams adaptive card formatter ──
function buildTeamsPayload(p: WebhookPayload) {
  return {
    '@type': 'MessageCard',
    '@context': 'http://schema.org/extensions',
    themeColor: '2563eb',
    summary: p.title,
    sections: [
      {
        activityTitle: p.title,
        activitySubtitle: p.tenantName || 'SGI 360',
        text: p.message,
        facts: [
          { name: 'Tipo', value: p.type },
          { name: 'Fecha', value: new Date(p.timestamp).toLocaleString('es-AR') },
        ],
      },
    ],
  };
}

// ── Generic JSON formatter ──
function buildCustomPayload(p: WebhookPayload) {
  return p;
}

function buildPayload(provider: string, p: WebhookPayload): unknown {
  switch (provider) {
    case 'slack': return buildSlackPayload(p);
    case 'teams': return buildTeamsPayload(p);
    default: return buildCustomPayload(p);
  }
}

/**
 * Fire webhooks for a tenant event. Non-blocking — catches all errors.
 */
export async function dispatchWebhooks(
  prisma: PrismaClient,
  tenantId: string,
  event: {
    type: string;
    title: string;
    message: string;
    link?: string | null;
    entityType?: string | null;
    entityId?: string | null;
  },
) {
  try {
    // Find active webhooks for this tenant that listen to this event type
    const webhooks = await prisma.webhookConfig.findMany({
      where: {
        tenantId,
        isActive: true,
        deletedAt: null,
      },
      include: { tenant: { select: { name: true } } },
    });

    if (webhooks.length === 0) return;

    const payload: WebhookPayload = {
      ...event,
      timestamp: new Date().toISOString(),
    };

    for (const wh of webhooks) {
      // Check if this webhook listens to this event type
      const events = (wh.events as string[]) || [];
      if (events.length > 0 && !events.includes(event.type)) continue;

      payload.tenantName = wh.tenant.name;

      const body = buildPayload(wh.provider, payload);

      try {
        const res = await fetch(wh.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(10000), // 10s timeout
        });

        if (res.ok) {
          await prisma.webhookConfig.update({
            where: { id: wh.id },
            data: {
              lastSentAt: new Date(),
              lastError: null,
              totalSent: { increment: 1 },
            },
          });
        } else {
          const errText = await res.text().catch(() => `HTTP ${res.status}`);
          await prisma.webhookConfig.update({
            where: { id: wh.id },
            data: {
              lastError: `HTTP ${res.status}: ${errText.slice(0, 200)}`,
              totalErrors: { increment: 1 },
            },
          });
        }
      } catch (err: any) {
        await prisma.webhookConfig.update({
          where: { id: wh.id },
          data: {
            lastError: err?.message?.slice(0, 200) || 'Unknown error',
            totalErrors: { increment: 1 },
          },
        }).catch(() => {}); // Don't let update failure propagate
      }
    }
  } catch {
    // Non-blocking — never throw
  }
}
