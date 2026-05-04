import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { updateTenantLicenseStatus } from '../services/license/licenseStatus.js';

const ALWAYS_ALLOWED_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/refresh',
  '/auth/me',
  '/billing',
  '/plans',
  '/webhooks',
  '/webhook',
  '/license',
  '/health',
  '/docs',
  '/mercadopago-config',
  '/company-registrations',
  '/register-company',
];

const ALWAYS_ALLOWED_METHODS = ['GET', 'HEAD', 'OPTIONS'];

function isAlwaysAllowed(req: FastifyRequest): boolean {
  const url = req.url;
  const method = req.method;

  // Allow GET/HEAD/OPTIONS always
  if (ALWAYS_ALLOWED_METHODS.includes(method)) return true;

  // Allow specific paths
  for (const path of ALWAYS_ALLOWED_PATHS) {
    if (url.startsWith(path) || url.startsWith('/api' + path)) return true;
  }

  // Allow if user is superadmin
  const globalRole = (req as any).auth?.globalRole;
  if (globalRole === 'SUPER_ADMIN') return true;

  return false;
}

export const licenseBlockPlugin = fp(async (app: FastifyInstance) => {
  app.addHook('preHandler', async (req: FastifyRequest, reply: FastifyReply) => {
    if (isAlwaysAllowed(req)) return;

    const tenantId = (req as any).db?.tenantId ?? (req as any).auth?.tenantId;
    if (!tenantId) return;

    const status = await updateTenantLicenseStatus((app as any).prisma, tenantId);

    if (status.status === 'EXPIRED') {
      return reply.code(403).send({
        error: 'Licencia vencida',
        message: 'Tu licencia está vencida. Activá un plan para continuar.',
        code: 'LICENSE_EXPIRED',
        redirectTo: '/billing',
      });
    }

    if (status.status === 'GRACE' && !status.canWrite) {
      // Grace period: block POST/PUT/PATCH/DELETE
      const method = req.method;
      if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
        return reply.code(403).send({
          error: 'Licencia en período de gracia',
          message: 'Tu licencia venció. Solo lectura disponible. Renovala para recuperar el acceso completo.',
          code: 'LICENSE_GRACE',
          redirectTo: '/billing',
          graceDaysRemaining: status.graceDaysRemaining,
        });
      }
    }
  });

  app.addHook('onSend', async (req: FastifyRequest, reply: FastifyReply, payload: any) => {
    const tenantId = (req as any).db?.tenantId ?? (req as any).auth?.tenantId;
    if (!tenantId) return payload;

    try {
      const status = await updateTenantLicenseStatus((app as any).prisma, tenantId);

      // Inject license status header for frontend awareness
      reply.header('x-license-status', status.status);
      if (status.daysUntilExpiry !== null) {
        reply.header('x-license-days-remaining', String(status.daysUntilExpiry));
      }
      if (status.graceDaysRemaining !== null) {
        reply.header('x-license-grace-days', String(status.graceDaysRemaining));
      }
    } catch {
      // Silently fail — don't break responses
    }

    return payload;
  });
});
