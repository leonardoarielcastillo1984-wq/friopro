import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { FeatureAccessService } from '../services/feature-access.js';

type FeatureMap = Record<string, unknown>;

declare module 'fastify' {
  interface FastifyRequest {
    features: { effective: FeatureMap; planTier?: string; limits?: Record<string, unknown> } | null;
  }
  interface FastifyInstance {
    requireFeature(req: FastifyRequest, key: string): void;
    featureAccessService: FeatureAccessService;
  }
}

const featuresCache = new Map<string, { data: { effective: FeatureMap; planTier?: string; limits?: Record<string, unknown> }; expiresAt: number }>();
const CACHE_TTL_MS = 60 * 1000;

export const featuresPlugin = fp(async (app: FastifyInstance) => {
  app.decorateRequest('features', null);
  app.decorate('featureAccessService', new FeatureAccessService(app));

  app.decorate('requireFeature', (req: FastifyRequest, key: string) => {
    const enabled = Boolean(req.features?.effective?.[key]);
    if (!enabled) {
      const err: any = new Error('Feature not available on your current plan');
      err.statusCode = 402;
      err.code = 'FEATURE_NOT_AVAILABLE';
      err.details = { key };
      throw err;
    }
  });

  app.addHook('preHandler', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = req.db?.tenantId;
    if (!tenantId || !req.db) {
      req.features = { effective: {} };
      return;
    }

    const cached = featuresCache.get(tenantId);
    if (cached && cached.expiresAt > Date.now()) {
      req.features = cached.data;
      if (req.auth?.globalRole === 'SUPER_ADMIN' && !req.db.tenantId) {
        return reply.code(400).send({ error: 'Tenant context required' });
      }
      return;
    }

    const [sub, overrides] = await Promise.all([
      app.prisma.tenantSubscription.findFirst({
        where: { tenantId, deletedAt: null, status: { in: ['ACTIVE', 'TRIAL', 'PAST_DUE'] } },
        include: { plan: true },
        orderBy: { startedAt: 'desc' },
      }),
      app.prisma.tenantFeature.findMany({ where: { tenantId, deletedAt: null } }),
    ]);

    if (!sub) {
      req.features = { effective: {}, planTier: undefined, limits: undefined };
      return;
    }

    const effective: FeatureMap = { ...(sub.plan.features as any) };
    for (const o of overrides) {
      effective[o.key] = o.enabled ? (o.config ?? true) : false;
    }

    const result = { effective, planTier: sub.plan.tier, limits: (sub.plan.limits as any) ?? undefined };
    featuresCache.set(tenantId, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
    req.features = result;

    if (req.auth?.globalRole === 'SUPER_ADMIN' && !req.db.tenantId) {
      return reply.code(400).send({ error: 'Tenant context required' });
    }
  });
});
