import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

export const integrationRoutes: FastifyPluginAsync = async (app) => {
  // ── GET /integrations/webhooks — List all webhooks for this tenant ──
  app.get('/webhooks', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    if (!req.auth?.userId) return reply.code(401).send({ error: 'Unauthorized' });

    const tenantId = req.db.tenantId;

    const webhooks = await app.runWithDbContext(req, async (tx: any) => {
      return tx.webhookConfig.findMany({
        where: { tenantId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, provider: true, name: true, url: true,
          isActive: true, events: true, lastSentAt: true,
          lastError: true, totalSent: true, totalErrors: true,
          createdAt: true, updatedAt: true,
        },
      });
    });

    return reply.send({ webhooks });
  });

  // ── POST /integrations/webhooks — Create webhook ──
  app.post('/webhooks', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    if (!req.auth?.userId) return reply.code(401).send({ error: 'Unauthorized' });
    const tenantId = req.db.tenantId;
    if (req.auth.tenantRole !== 'TENANT_ADMIN') {
      return reply.code(403).send({ error: 'Solo administradores pueden crear webhooks' });
    }

    const schema = z.object({
      provider: z.enum(['slack', 'teams', 'custom']),
      name: z.string().min(1, 'El nombre es requerido'),
      url: z.string().url('URL inválida'),
      events: z.array(z.string()).optional().default([]),
    });

    const body = schema.parse(req.body);

    const webhook = await app.runWithDbContext(req, async (tx: any) => {
      return tx.webhookConfig.create({
        data: {
          tenantId,
          provider: body.provider,
          name: body.name,
          url: body.url,
          events: body.events,
          createdById: req.auth!.userId,
        },
      });
    });

    return reply.code(201).send({ webhook });
  });

  // ── PATCH /integrations/webhooks/:id — Update webhook ──
  app.patch('/webhooks/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    if (!req.auth?.userId) return reply.code(401).send({ error: 'Unauthorized' });
    const tenantId = req.db.tenantId;
    if (req.auth.tenantRole !== 'TENANT_ADMIN') {
      return reply.code(403).send({ error: 'Solo administradores pueden editar webhooks' });
    }

    const schema = z.object({
      name: z.string().min(1).optional(),
      url: z.string().url().optional(),
      isActive: z.boolean().optional(),
      events: z.array(z.string()).optional(),
    });

    const body = schema.parse(req.body);
    const { id } = req.params;

    const webhook = await app.runWithDbContext(req, async (tx: any) => {
      // Verify ownership
      const existing = await tx.webhookConfig.findFirst({
        where: { id, tenantId, deletedAt: null },
      });
      if (!existing) throw new Error('Webhook no encontrado');

      return tx.webhookConfig.update({
        where: { id },
        data: body,
      });
    });

    return reply.send({ webhook });
  });

  // ── DELETE /integrations/webhooks/:id — Soft delete webhook ──
  app.delete('/webhooks/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    if (!req.auth?.userId) return reply.code(401).send({ error: 'Unauthorized' });
    const tenantId = req.db.tenantId;
    if (req.auth.tenantRole !== 'TENANT_ADMIN') {
      return reply.code(403).send({ error: 'Solo administradores pueden eliminar webhooks' });
    }

    const { id } = req.params;

    await app.runWithDbContext(req, async (tx: any) => {
      const existing = await tx.webhookConfig.findFirst({
        where: { id, tenantId, deletedAt: null },
      });
      if (!existing) throw new Error('Webhook no encontrado');

      await tx.webhookConfig.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
    });

    return reply.send({ ok: true });
  });

  // ── POST /integrations/webhooks/:id/test — Send test message ──
  app.post('/webhooks/:id/test', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    if (!req.auth?.userId) return reply.code(401).send({ error: 'Unauthorized' });
    const tenantId = req.db.tenantId;

    const { id } = req.params;

    const webhook = await app.runWithDbContext(req, async (tx: any) => {
      return tx.webhookConfig.findFirst({
        where: { id, tenantId, deletedAt: null },
        include: { tenant: { select: { name: true } } },
      });
    });

    if (!webhook) return reply.code(404).send({ error: 'Webhook no encontrado' });

    // Build test payload
    const { dispatchWebhooks } = await import('../services/webhook.js');

    // We'll use a direct test — send a system alert
    try {
      const testPayload = buildTestPayload(webhook.provider, webhook.tenant.name);

      const res = await fetch(webhook.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testPayload),
        signal: AbortSignal.timeout(10000),
      });

      if (res.ok) {
        await (app.prisma as any).webhookConfig.update({
          where: { id },
          data: { lastSentAt: new Date(), lastError: null, totalSent: { increment: 1 } },
        });
        return reply.send({ ok: true, message: 'Mensaje de prueba enviado correctamente' });
      } else {
        const errText = await res.text().catch(() => `HTTP ${res.status}`);
        await (app.prisma as any).webhookConfig.update({
          where: { id },
          data: { lastError: `HTTP ${res.status}: ${errText.slice(0, 200)}`, totalErrors: { increment: 1 } },
        });
        return reply.code(400).send({ error: `Error al enviar: HTTP ${res.status}` });
      }
    } catch (err: any) {
      return reply.code(500).send({ error: `Error de conexión: ${err?.message || 'Unknown'}` });
    }
  });
};

function buildTestPayload(provider: string, tenantName: string) {
  const now = new Date().toLocaleString('es-AR');

  if (provider === 'slack') {
    return {
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `✅ *Prueba de conexión SGI 360*\nEste es un mensaje de prueba para verificar la integración con Slack.`,
          },
        },
        {
          type: 'context',
          elements: [
            { type: 'mrkdwn', text: `*Organización:* ${tenantName} | ${now}` },
          ],
        },
      ],
    };
  }

  if (provider === 'teams') {
    return {
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      themeColor: '2563eb',
      summary: 'Prueba de conexión SGI 360',
      sections: [{
        activityTitle: 'Prueba de conexión SGI 360',
        activitySubtitle: tenantName,
        text: 'Este es un mensaje de prueba para verificar la integración con Microsoft Teams.',
        facts: [{ name: 'Fecha', value: now }],
      }],
    };
  }

  return {
    type: 'SYSTEM_ALERT',
    title: 'Prueba de conexión SGI 360',
    message: 'Este es un mensaje de prueba para verificar la integración.',
    tenantName,
    timestamp: new Date().toISOString(),
  };
}
