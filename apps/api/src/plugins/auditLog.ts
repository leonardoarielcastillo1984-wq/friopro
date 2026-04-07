import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

function actorRole(req: FastifyRequest): string {
  if (req.auth?.globalRole) return `GLOBAL:${req.auth.globalRole}`;
  if (req.auth?.tenantRole) return `TENANT:${req.auth.tenantRole}`;
  return 'ANONYMOUS';
}

export const auditLogPlugin = fp(async (app: FastifyInstance) => {
  app.addHook('onResponse', async (req: FastifyRequest, reply: FastifyReply) => {
    const isHealth = req.url.startsWith('/health');
    if (isHealth) return;

    const userId = req.auth?.userId;
    const tenantId = req.db?.tenantId;

    const requestId = (req as any).id ?? undefined;
    const ip = (req.headers['x-forwarded-for'] as string | undefined) ?? req.ip;
    const userAgent = req.headers['user-agent'];

    const action = `${req.method}`;
    const resource = `${req.method} ${req.routerPath ?? req.url}`;

    const metadata = {
      actor_role: actorRole(req),
      tenant_context: tenantId ?? null,
      auditor_mode: Boolean(req.db?.isAuditorMode),
      status_code: reply.statusCode,
      method: req.method,
      path: req.url,
      route: req.routerPath ?? null,
      ip,
      user_agent: typeof userAgent === 'string' ? userAgent : null,
      request_id: requestId ?? null,
    };

    // Use app.prisma directly (no RLS/transaction overhead for logging)
    try {
      await app.prisma.auditEvent.create({
        data: {
          tenantId: tenantId ?? null,
          actorUserId: userId ?? null,
          action,
          entityType: 'HTTP',
          entityId: null,
          metadata,
        },
      });
    } catch {
      // Non-critical: silently drop if audit logging fails
    }
  });
});
