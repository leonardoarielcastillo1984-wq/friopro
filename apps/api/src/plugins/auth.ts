import fp from 'fastify-plugin';
import jwt, { type SignOptions } from 'jsonwebtoken';
import type { FastifyInstance, FastifyRequest } from 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    auth: {
      userId: string;
      tenantId?: string;
      globalRole?: string;
      tenantRole?: string;
    } | null;
  }

  interface FastifyInstance {
    signAccessToken(payload: {
      userId: string;
      tenantId?: string;
      globalRole?: string;
      tenantRole?: string;
    }): string;

    signRefreshToken(payload: {
      userId: string;
      refreshTokenVersion: number;
    }): string;

    verifyAccessToken(token: string): {
      userId: string;
      tenantId?: string;
      globalRole?: string;
      tenantRole?: string;
    };

    verifyRefreshToken(token: string): {
      userId: string;
      refreshTokenVersion: number;
      tokenType: 'refresh';
    };
  }
}

export const authPlugin = fp(async (app: FastifyInstance) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is required');

  const issuer = process.env.JWT_ISSUER ?? 'sgi360';
  const accessTtl = process.env.ACCESS_TOKEN_TTL ?? '15m';
  const refreshTtl = process.env.REFRESH_TOKEN_TTL ?? '30d';

  app.decorate('signAccessToken', (payload: {
    userId: string;
    tenantId?: string;
    globalRole?: string;
    tenantRole?: string;
  }) => {
    return jwt.sign(payload, secret, { issuer, expiresIn: accessTtl } as SignOptions);
  });

  app.decorate('signRefreshToken', (payload: { userId: string; refreshTokenVersion: number }) => {
    return jwt.sign({ ...payload, tokenType: 'refresh' }, secret, { issuer, expiresIn: refreshTtl } as SignOptions);
  });

  app.decorate('verifyAccessToken', (token: string) => {
    return jwt.verify(token, secret, { issuer }) as any;
  });

  app.decorate('verifyRefreshToken', (token: string) => {
    return jwt.verify(token, secret, { issuer }) as any;
  });

  app.decorateRequest('auth', null);

  app.addHook('preHandler', async (req: FastifyRequest) => {
    const cookieToken = (req.cookies as any)?.access_token as string | undefined;
    const header = req.headers.authorization;
    const bearerToken = header?.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : undefined;
    const token = cookieToken ?? bearerToken;
    if (!token) return;

    try {
      const payload = app.verifyAccessToken(token);
      req.auth = payload;
    } catch {
      req.auth = null;
    }
  });
});
