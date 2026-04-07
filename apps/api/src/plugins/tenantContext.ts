import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest } from 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    tenant: {
      tenantId: string;
    } | null;
  }
}

export const tenantContextPlugin = fp(async (app: FastifyInstance) => {
  app.decorateRequest('tenant', null);

  app.addHook('preHandler', async (req: FastifyRequest) => {
    // Resolución de tenant por header. En producción se soportará también por subdominio.
    const tenantId = req.headers['x-tenant-id'];
    if (typeof tenantId === 'string' && tenantId.length > 0) {
      req.tenant = { tenantId };
      return;
    }

    // Si el token trae tenantId, lo usamos.
    if (req.auth?.tenantId) {
      req.tenant = { tenantId: req.auth.tenantId };
    }
  });
});
