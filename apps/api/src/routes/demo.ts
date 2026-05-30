import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// Límites para tenants en modo demo (sin restricciones durante el trial)
export const DEMO_LIMITS = {
  documents:       9999,
  indicators:      9999,
  nonConformities: 9999,
  audits:          9999,
  users:           9999,
  storageMb:       9999,
};

// Duración del demo en días
const DEMO_DURATION_DAYS = 7;

export async function demoRoutes(app: FastifyInstance) {

  // GET /demo/status — estado del modo demo del tenant actual
  app.get('/demo/status', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = (req as any).db?.tenantId;
    if (!tenantId) return reply.code(401).send({ error: 'No tenant context' });

    try {
      const tenant = await (app.prisma as any).tenant.findUnique({
        where: { id: tenantId },
        select: { id: true, isDemo: true, demoStartedAt: true, demoExpiresAt: true },
      });
      if (!tenant) return reply.code(404).send({ error: 'Tenant not found' });

      const now = new Date();
      const isExpired = tenant.demoExpiresAt ? now > tenant.demoExpiresAt : false;

      let daysLeft = 0;
      if (tenant.demoExpiresAt && !isExpired) {
        daysLeft = Math.ceil((tenant.demoExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      }

      return reply.send({
        isDemo: tenant.isDemo,
        isExpired,
        daysLeft,
        demoStartedAt: tenant.demoStartedAt,
        demoExpiresAt: tenant.demoExpiresAt,
        limits: DEMO_LIMITS,
      });
    } catch (err) {
      app.log.error('[DEMO] Error getting status: ' + String(err));
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // PATCH /demo/complete — marcar demo como completado (activa plan)
  app.patch('/demo/complete', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = (req as any).db?.tenantId;
    if (!tenantId) return reply.code(401).send({ error: 'No tenant context' });

    try {
      await (app.prisma as any).tenant.update({
        where: { id: tenantId },
        data: { isDemo: false },
      });
      return reply.send({ success: true });
    } catch (err) {
      app.log.error('[DEMO] Error completing demo: ' + String(err));
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Middleware helper — llamar antes de CREATE en rutas con límites demo
// ────────────────────────────────────────────────────────────────────────────

type DemoResource = keyof typeof DEMO_LIMITS;

const COUNT_QUERIES: Record<DemoResource, (prisma: any, tenantId: string) => Promise<number>> = {
  documents:       (p, t) => p.document.count({ where: { tenantId: t } }),
  indicators:      (p, t) => p.indicator.count({ where: { tenantId: t } }),
  nonConformities: (p, t) => p.nonConformity.count({ where: { tenantId: t } }),
  audits:          (p, t) => p.auditRun.count({ where: { tenantId: t } }),
  users:           (p, t) => p.tenantMembership.count({ where: { tenantId: t, status: 'ACTIVE' } }),
  storageMb:       () => Promise.resolve(0),
};

export async function checkDemoLimit(
  app: FastifyInstance,
  req: FastifyRequest,
  reply: FastifyReply,
  resource: DemoResource,
): Promise<boolean> {
  const tenantId = (req as any).db?.tenantId;
  if (!tenantId) return true;

  try {
    const tenant = await (app.prisma as any).tenant.findUnique({
      where: { id: tenantId },
      select: { isDemo: true },
    });
    if (!tenant?.isDemo) return true; // Tenant pago — sin límites

    const currentCount = await COUNT_QUERIES[resource](app.prisma, tenantId);
    const limit = DEMO_LIMITS[resource];

    if (currentCount >= limit) {
      reply.code(403).send({
        error: 'DEMO_LIMIT_REACHED',
        message: `Límite alcanzado en modo demo. Activá un plan para continuar.`,
        resource,
        current: currentCount,
        limit,
      });
      return false; // blocked
    }
    return true; // allowed
  } catch (err) {
    app.log.error('[DEMO] checkDemoLimit error: ' + String(err));
    return true; // fail-open: no bloquear por error interno
  }
}
