import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Prisma, PrismaClient } from '@prisma/client';

declare module 'fastify' {
  interface FastifyRequest {
    tenantId?: string;
    userId?: string;
    db: {
      prisma: PrismaClient;
      tenantId?: string;
      userId?: string;
      isAuditorMode: boolean;
    } | null;
  }

  interface FastifyInstance {
    runWithDbContext<T>(
      req: FastifyRequest,
      fn: (tx: Prisma.TransactionClient) => Promise<T>
    ): Promise<T>;
  }
}

function getTenantIdFromRequest(req: FastifyRequest): string | undefined {
  const headerTenantId = req.headers['x-tenant-id'];
  if (typeof headerTenantId === 'string' && headerTenantId.length > 0) return headerTenantId;
  return req.auth?.tenantId;
}

function isTenantScopedRequest(req: FastifyRequest): boolean {
  const path = req.url;
  if (path.startsWith('/auth')) return false;
  if (path.startsWith('/api/auth')) return false;
  if (path.startsWith('/super-admin')) return false;
  if (path.startsWith('/health')) return false;
  return true;
}

export const dbContextPlugin = fp(async (app: FastifyInstance) => {
  app.decorateRequest('tenantId', undefined);
  app.decorateRequest('userId', undefined);
  app.decorateRequest('db', null);

  app.decorate('runWithDbContext', async <T>(
    req: FastifyRequest,
    fn: (tx: Prisma.TransactionClient) => Promise<T>
  ): Promise<T> => {
    if (!req.db) {
      const err: any = new Error('DB context not initialized');
      err.statusCode = 500;
      throw err;
    }

    const prisma = req.db.prisma;
    const userId = req.db.userId;
    const tenantId = req.db.tenantId;

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      if (userId) {
        await tx.$executeRaw`SELECT set_config('app.user_id', ${userId}, true)`;
      }
      if (tenantId) {
        await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
      }
      if (req.auth?.tenantRole) {
        await tx.$executeRaw`SELECT set_config('app.tenant_role', ${req.auth.tenantRole}, true)`;
      }
      if (req.auth?.globalRole) {
        await tx.$executeRaw`SELECT set_config('app.global_role', ${req.auth.globalRole}, true)`;
      }
      return fn(tx);
    });
  });

  app.addHook('preHandler', async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = req.auth?.userId;
    const tenantId = getTenantIdFromRequest(req);

    // Expose on request for legacy route code
    req.userId = userId;
    req.tenantId = tenantId;

    const isSuperAdmin = req.auth?.globalRole === 'SUPER_ADMIN';

    if (isSuperAdmin) {
      if (isTenantScopedRequest(req) && !tenantId) {
        return reply.code(400).send({ error: 'x-tenant-id is required for tenant-scoped requests' });
      }

      if (tenantId) {
        // SUPER_ADMIN usa la misma conexión que los usuarios normales para ver datos del tenant
        req.db = {
          prisma: app.prisma,
          tenantId,
          userId,
          isAuditorMode: false,
        };
        return;
      }

      req.db = {
        prisma: app.prisma,
        userId,
        isAuditorMode: false,
      };
      return;
    }

    // Usuarios normales: tenantId debe provenir del token (header solo puede coincidir)
    if (req.auth?.tenantId) {
      // Allow header to override token tenantId for flexibility
      const effectiveTenantId = tenantId || req.auth.tenantId;
      
      if (tenantId && tenantId !== req.auth.tenantId) {
        return reply.code(400).send({ error: 'Tenant context mismatch' });
      }

      req.db = {
        prisma: app.prisma,
        tenantId: effectiveTenantId,
        userId,
        isAuditorMode: false,
      };

      if (isTenantScopedRequest(req)) {
        const hasMembership = await app.runWithDbContext(req, async (tx: Prisma.TransactionClient) => {
          const membership = await tx.tenantMembership.findFirst({
            where: {
              userId: req.auth!.userId,
              tenantId: req.auth!.tenantId!,
              status: 'ACTIVE',
              deletedAt: null,
            },
            select: { id: true },
          });
          return Boolean(membership);
        });

        if (!hasMembership) return reply.code(403).send({ error: 'No membership active for tenant' });
      }

      return;
    }

    // Rutas no tenant-scoped (ej: /auth/login, /super-admin/bootstrap)
    req.db = {
      prisma: app.prisma,
      userId,
      isAuditorMode: false,
    };
  });
});
