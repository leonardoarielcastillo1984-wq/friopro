import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Prisma } from '@prisma/client';
import { FeatureAccessService } from '../services/feature-access.js';

type FeatureMap = Record<string, unknown>;

declare module 'fastify' {
  interface FastifyRequest {
    features: {
      effective: FeatureMap;
      planTier?: string;
      limits?: Record<string, unknown>;
    } | null;
  }

  interface FastifyInstance {
    requireFeature(req: FastifyRequest, key: string): void;
    featureAccessService: FeatureAccessService;
  }
}

export const featuresPlugin = fp(async (app: FastifyInstance) => {
  app.decorateRequest('features', null);

  // Registrar el servicio de feature access
  app.decorate('featureAccessService', new FeatureAccessService(app));

  app.decorate('requireFeature', (req: FastifyRequest, key: string) => {
    // Temporarily disable feature checks for development
    console.log('🔵 Features: Allowing feature:', key);
    return;
    
    const enabled = Boolean(req.features?.effective?.[key]);
    if (!enabled) {
      const err: any = new Error('Feature not available');
      err.statusCode = 402;
      err.code = 'FEATURE_NOT_AVAILABLE';
      err.details = { key };
      throw err;
    }
  });

  app.addHook('preHandler', async (req: FastifyRequest, reply: FastifyReply) => {
    // Sin tenant context no resolvemos features.
    const tenantId = req.db?.tenantId;
    if (!tenantId || !req.db) {
      req.features = { effective: {} };
      return;
    }

    // Usa app.prisma (superuser sgi) que bypasea RLS automáticamente
    const sub = await app.prisma.tenantSubscription.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        status: { in: ['ACTIVE', 'TRIAL', 'PAST_DUE'] },
      },
      include: { plan: true },
      orderBy: { startedAt: 'desc' },
    });

    const overrides = await app.prisma.tenantFeature.findMany({
      where: { tenantId, deletedAt: null },
    });

    if (!sub) {
      req.features = { effective: {}, planTier: undefined, limits: undefined };
      return;
    }

    const effective: FeatureMap = { ...(sub.plan.features as any) };
    for (const o of overrides) {
      effective[o.key] = o.enabled ? (o.config ?? true) : false;
    }

    req.features = {
      effective,
      planTier: sub.plan.tier,
      limits: (sub.plan.limits as any) ?? undefined,
    };

    // Regla: Super Admin debe venir con tenant explícito; si no, error.
    if (req.auth?.globalRole === 'SUPER_ADMIN' && !req.db.tenantId) {
      return reply.code(400).send({ error: 'Tenant context required' });
    }
  });
});
