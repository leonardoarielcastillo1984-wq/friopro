import fp from 'fastify-plugin';
import jwt, { type SignOptions } from 'jsonwebtoken';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    flota360Auth: {
      userId: string;
      tenantId: string;
      email: string;
      role: string;
    } | null;
  }

  interface FastifyInstance {
    flota360SignToken(payload: {
      userId: string;
      tenantId: string;
      email: string;
      role: string;
    }): string;
    flota360VerifyToken(token: string): {
      userId: string;
      tenantId: string;
      email: string;
      role: string;
    };
  }
}

export const flota360AuthPlugin = fp(async (app: FastifyInstance) => {
  const secret = process.env.FLOTA360_JWT_SECRET ?? process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET or FLOTA360_JWT_SECRET is required');

  const issuer = process.env.FLOTA360_JWT_ISSUER ?? 'flota360';
  const ttl = process.env.FLOTA360_TOKEN_TTL ?? '8h';

  app.decorate('flota360SignToken', (payload: {
    userId: string;
    tenantId: string;
    email: string;
    role: string;
  }) => {
    return jwt.sign(payload, secret, { issuer, expiresIn: ttl } as SignOptions);
  });

  app.decorate('flota360VerifyToken', (token: string) => {
    return jwt.verify(token, secret, { issuer }) as {
      userId: string;
      tenantId: string;
      email: string;
      role: string;
    };
  });

  // Hook to decode token on every request
  app.addHook('onRequest', async (req: FastifyRequest, _reply: FastifyReply) => {
    req.flota360Auth = null;
    const authHeader = req.headers.authorization;
    if (!authHeader) return;
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) return;
    try {
      req.flota360Auth = app.flota360VerifyToken(token);
    } catch {
      req.flota360Auth = null;
    }
  });
});
