import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { updateTenantLicenseStatus } from '../services/license/licenseStatus.js';

const PLAN_PRICES = {
  BASIC: { monthly: 35, annual: 399, name: 'Básico' },
  PROFESSIONAL: { monthly: 69, annual: 786, name: 'Profesional' },
  PREMIUM: { monthly: 99, annual: 1128, name: 'Premium' },
};

export async function billingRoutes(app: FastifyInstance) {
  // GET /billing/status — Estado de licencia del tenant autenticado
  app.get('/status', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = (req as any).db?.tenantId ?? (req as any).auth?.tenantId;
    if (!tenantId) {
      return reply.code(401).send({ error: 'Se requiere autenticación' });
    }

    const tenant = await (app.prisma as any).tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        licensePlan: true,
        licenseStartAt: true,
        licenseEndAt: true,
        licenseStatus: true,
        graceEndAt: true,
        isDemo: true,
        demoExpiresAt: true,
      },
    });

    if (!tenant) {
      return reply.code(404).send({ error: 'Tenant no encontrado' });
    }

    const status = updateTenantLicenseStatus(app.prisma as any, tenantId);

    return reply.send({
      tenant: {
        ...tenant,
        licenseStatus: tenant.licenseStatus || 'ACTIVE',
      },
      plans: PLAN_PRICES,
    });
  });

  // GET /billing/plans — Lista de planes disponibles
  app.get('/plans', async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ plans: PLAN_PRICES });
  });
}
