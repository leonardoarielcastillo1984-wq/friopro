import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'node:crypto';

function isStateChanging(method?: string) {
  const m = (method ?? 'GET').toUpperCase();
  return m === 'POST' || m === 'PUT' || m === 'PATCH' || m === 'DELETE';
}

function shouldSkip(req: FastifyRequest) {
  const url = req.url;
  if (url.startsWith('/health')) return true;
  if (url.startsWith('/webhooks/mercadopago')) return true;
  if (url.startsWith('/license/webhook/mercadopago')) return true;
  if (url.startsWith('/docs')) return true;
  if (url.startsWith('/help/ask')) return true; // TEMP: testing assistant IA
  if (url.startsWith('/api/auth/login') || url.startsWith('/auth/login')) return true;
  if (url.startsWith('/api/auth/register') || url.startsWith('/auth/register')) return true;
  if (url.startsWith('/api/auth/refresh') || url.startsWith('/auth/refresh')) return true;
  if (url.startsWith('/api/register-company') || url.startsWith('/register-company')) return true;
  if (url.startsWith('/documents/upload')) return true;
  if (url.startsWith('/normativos/upload')) return true;
  if (url.startsWith('/audit/auditors') && url.includes('/upload')) return true;
  if (url.startsWith('/indicators')) return true;
  if (url.startsWith('/risks')) return true;
  if (url.startsWith('/ncr')) return true;
  if (url.startsWith('/departments')) return true;
  if (url.startsWith('/hr')) return true;
  if (url.startsWith('/emergency')) return true; // Emergency routes para simulacros
  if (url.startsWith('/maintenance')) return true; // Maintenance routes
  if (url.startsWith('/project360')) return true; // Project360 routes
  if (url.startsWith('/register-company')) return true; // Public route: company registration
  if (url.startsWith('/company-registrations')) return true; // Public route: get registrations
  if (url.startsWith('/mercadopago-config')) return true; // Public route: MercadoPago config
  if (url.includes('/seed-features-no-auth')) return true; // Seed features without auth
  if (url.match(/\/documents\/[^\/]+\/versions/)) return true;
  if (url.match(/\/documents\/[^\/]+\/clause-mappings/)) return true;
  return false;
}

export const csrfPlugin = fp(async (app: FastifyInstance) => {
  const isProd = (process.env.NODE_ENV ?? 'development') === 'production';

  app.addHook('preHandler', async (req: FastifyRequest, reply: FastifyReply) => {
    // Only enforce CSRF when we rely on cookies for auth.
    if (!isStateChanging(req.method)) return;
    if (shouldSkip(req)) return;

    // If the request is authenticated via Bearer token, CSRF protection is not needed.
    const authHeader = req.headers.authorization;
    if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
      return;
    }

    const cookieToken = (req.cookies as any)?.csrf_token as string | undefined;
    const headerToken = (req.headers['x-csrf-token'] as string | undefined) ?? undefined;

    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      return reply.code(403).send({ error: 'CSRF validation failed' });
    }
  });

  app.decorate('issueCsrfCookie', async (reply: FastifyReply) => {
    const csrf = crypto.randomBytes(32).toString('hex');
    reply.setCookie('csrf_token', csrf, {
      path: '/',
      httpOnly: false,
      sameSite: 'lax',
      secure: isProd,
    });
    return csrf;
  });
});

declare module 'fastify' {
  interface FastifyInstance {
    issueCsrfCookie(reply: FastifyReply): Promise<string>;
  }
}
