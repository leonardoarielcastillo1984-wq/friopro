import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest } from 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    sehAuth: {
      userId: string;
      tenantId?: string;
      email?: string;
      role: string;
    } | null;
  }
}

/**
 * SEH360 dentro de SGI360: reutiliza el JWT y tenant de SGI.
 * Mapea req.auth → req.sehAuth para las rutas /seh360/*.
 * Roles SGI → roles SEH: SUPER_ADMIN → SUPERADMIN, OWNER/ADMIN → ADMIN, resto → USER.
 * SUPER_ADMIN sin tenantId toma el primer tenant activo (patrón getEffectiveTenantId).
 */
export const seh360AuthPlugin = fp(async (app: FastifyInstance) => {
  app.decorateRequest('sehAuth', null);

  app.addHook('preHandler', async (req: FastifyRequest) => {
    if (!req.url.startsWith('/seh360')) return;

    const auth = (req as any).auth;
    if (!auth) { req.sehAuth = null; return; }

    // Usuarios de portal cliente SEH: tienen JWT propio (role SEH_CLIENT),
    // solo acceden a /seh360/portal/* — no a las rutas de gestión
    if (auth.globalRole === 'SEH_CLIENT') { req.sehAuth = null; return; }

    // Tenant: prioriza header x-tenant-id (impersonación), si no el del token
    const headerTenant = req.headers['x-tenant-id'];
    let tenantId: string | undefined =
      typeof headerTenant === 'string' && headerTenant.length > 0
        ? headerTenant
        : auth.tenantId;

    // SUPER_ADMIN sin tenant → primer tenant disponible (mismo fallback que getEffectiveTenantId)
    if (!tenantId && auth.globalRole === 'SUPER_ADMIN') {
      const prisma = (app as any).prisma;
      const first =
        (await prisma.tenant.findFirst({ where: { status: 'ACTIVE' }, select: { id: true }, orderBy: { createdAt: 'asc' } })) ??
        (await prisma.tenant.findFirst({ select: { id: true }, orderBy: { createdAt: 'asc' } }));
      tenantId = first?.id;
    }

    let role = 'USER';
    if (auth.globalRole === 'SUPER_ADMIN') role = 'SUPERADMIN';
    else if (auth.tenantRole === 'OWNER' || auth.tenantRole === 'ADMIN') role = 'ADMIN';

    req.sehAuth = {
      userId: auth.userId,
      tenantId,
      email: auth.email,
      role,
    };
  });
});
