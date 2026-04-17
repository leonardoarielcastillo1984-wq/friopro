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
    
    // Log para depurar
    if (req.url.includes('/api/') || req.url.includes('/license/')) {
      console.log('[AUTH] Request:', {
        url: req.url,
        method: req.method,
        hasCookieToken: !!cookieToken,
        hasBearerToken: !!bearerToken,
        hasToken: !!token
      });
    }
    
    // TEMPORARY: Disable auth check completely for debugging frontend issue
    // if (!token) return;
    if (!token) {
      req.auth = null;
      return;
    }

    try {
      const payload = app.verifyAccessToken(token);
      req.auth = payload;
      
      // Log para depurar payload
      if (req.url.includes('/api/') || req.url.includes('/license/')) {
        console.log('[AUTH] Payload decoded:', {
          userId: payload.userId,
          tenantId: payload.tenantId,
          globalRole: payload.globalRole,
          tenantRole: payload.tenantRole
        });
      }
    } catch (error) {
      console.log('[AUTH] Token verification failed - clearing auth:', error);
      req.auth = null;
      
      // Si el token está malformed, limpiar las cookies en la respuesta
      if (error instanceof Error && error.message.includes('jwt malformed')) {
        const reply = (req as any).reply;
        if (reply) {
          reply.clearCookie('access_token', { path: '/' });
          reply.clearCookie('refresh_token', { path: '/auth/refresh' });
          reply.clearCookie('csrf_token', { path: '/' });
        }
      }
    }
  });
});
