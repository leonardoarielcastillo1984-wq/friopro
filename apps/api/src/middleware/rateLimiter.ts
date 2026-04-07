/**
 * Rate Limiter Middleware - Redis-based rate limiting
 *
 * Implements configurable rate limits for:
 * - Login attempts
 * - 2FA verification
 * - Password reset
 * - API endpoints
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import Redis from 'redis';

const redis = Redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

let isConnected = false;

/**
 * Initialize Redis connection
 */
export async function initializeRateLimiter(): Promise<void> {
  if (isConnected) return;

  await redis.connect();
  isConnected = true;

  redis.on('error', (err) => {
    console.error('[RateLimiter] Redis error:', err);
  });

  redis.on('reconnecting', () => {
    console.log('[RateLimiter] Attempting to reconnect to Redis...');
  });

  console.log('[RateLimiter] Connected to Redis');
}

/**
 * Shutdown Redis connection
 */
export async function shutdownRateLimiter(): Promise<void> {
  if (isConnected) {
    await redis.quit();
    isConnected = false;
  }
}

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests in window
  keyPrefix: string; // Redis key prefix
}

/**
 * Default rate limit configurations
 */
export const RATE_LIMITS = {
  login: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 5,
    keyPrefix: 'ratelimit:login',
  } as RateLimitConfig,
  twoFactorVerification: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
    keyPrefix: 'ratelimit:2fa:verify',
  } as RateLimitConfig,
  passwordReset: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 3,
    keyPrefix: 'ratelimit:password-reset',
  } as RateLimitConfig,
  apiEndpoint: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
    keyPrefix: 'ratelimit:api',
  } as RateLimitConfig,
  signup: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 5,
    keyPrefix: 'ratelimit:signup',
  } as RateLimitConfig,
};

/**
 * Check rate limit and update counter
 */
export async function checkRateLimit(key: string, config: RateLimitConfig): Promise<{
  isLimited: boolean;
  remaining: number;
  resetTime: number;
}> {
  const redisKey = `${config.keyPrefix}:${key}`;
  const now = Date.now();
  const windowStart = now - config.windowMs;

  try {
    // Use Redis ZSET for sliding window rate limiting
    // Remove old entries outside the window
    await redis.zRemRangeByScore(redisKey, '-inf', windowStart);

    // Count requests in current window
    const count = await redis.zCard(redisKey);

    if (count >= config.maxRequests) {
      // Get the oldest request time to calculate reset time
      const oldestRequest = await redis.zRange(redisKey, 0, 0, { withScores: true });
      const resetTime = oldestRequest.length > 0
        ? (oldestRequest[0].score as number) + config.windowMs
        : now + config.windowMs;

      return {
        isLimited: true,
        remaining: 0,
        resetTime: Math.ceil((resetTime - now) / 1000), // seconds until reset
      };
    }

    // Add current request
    await redis.zAdd(redisKey, { score: now, member: `${now}-${Math.random()}` });

    // Set expiration on key to clean up old data
    await redis.expire(redisKey, Math.ceil(config.windowMs / 1000) + 1);

    return {
      isLimited: false,
      remaining: config.maxRequests - count - 1,
      resetTime: Math.ceil((now + config.windowMs - now) / 1000),
    };
  } catch (error: any) {
    console.error('[RateLimiter] Error checking rate limit:', error);
    // If Redis fails, allow the request (fail open for availability)
    return {
      isLimited: false,
      remaining: config.maxRequests - 1,
      resetTime: Math.ceil(config.windowMs / 1000),
    };
  }
}

/**
 * Fastify middleware for generic rate limiting
 */
export function createRateLimiterMiddleware(config: RateLimitConfig) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    // Use IP address as the key
    const clientIP = req.ip || 'unknown';
    const limit = await checkRateLimit(clientIP, config);

    // Add headers
    reply.header('X-RateLimit-Limit', config.maxRequests);
    reply.header('X-RateLimit-Remaining', Math.max(0, limit.remaining));
    reply.header('X-RateLimit-Reset', new Date(Date.now() + limit.resetTime * 1000).toISOString());

    if (limit.isLimited) {
      return reply.code(429).send({
        error: 'Too many requests',
        message: `Rate limit exceeded. Try again in ${limit.resetTime} seconds.`,
        retryAfter: limit.resetTime,
      });
    }
  };
}

/**
 * Middleware for login rate limiting
 */
export function loginRateLimiter() {
  return createRateLimiterMiddleware(RATE_LIMITS.login);
}

/**
 * Middleware for 2FA verification rate limiting
 */
export function twoFactorRateLimiter() {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    // Rate limit by user ID if available, otherwise by IP
    const identifier = req.auth?.userId || req.ip || 'unknown';
    const config = RATE_LIMITS.twoFactorVerification;
    const limit = await checkRateLimit(identifier, config);

    reply.header('X-RateLimit-Limit', config.maxRequests);
    reply.header('X-RateLimit-Remaining', Math.max(0, limit.remaining));
    reply.header('X-RateLimit-Reset', new Date(Date.now() + limit.resetTime * 1000).toISOString());

    if (limit.isLimited) {
      return reply.code(429).send({
        error: 'Too many verification attempts',
        message: `Too many 2FA verification attempts. Try again in ${limit.resetTime} seconds.`,
        retryAfter: limit.resetTime,
      });
    }
  };
}

/**
 * Middleware for password reset rate limiting
 */
export function passwordResetRateLimiter() {
  return createRateLimiterMiddleware(RATE_LIMITS.passwordReset);
}

/**
 * Middleware for signup rate limiting
 */
export function signupRateLimiter() {
  return createRateLimiterMiddleware(RATE_LIMITS.signup);
}

/**
 * Middleware for general API rate limiting
 */
export function apiRateLimiter() {
  return createRateLimiterMiddleware(RATE_LIMITS.apiEndpoint);
}

/**
 * Reset rate limit for a key (admin function)
 */
export async function resetRateLimit(key: string, config: RateLimitConfig): Promise<void> {
  const redisKey = `${config.keyPrefix}:${key}`;
  await redis.del(redisKey);
}

/**
 * Get rate limit status (for debugging)
 */
export async function getRateLimitStatus(key: string, config: RateLimitConfig): Promise<{
  key: string;
  count: number;
  limit: number;
  remaining: number;
}> {
  const redisKey = `${config.keyPrefix}:${key}`;
  const count = await redis.zCard(redisKey);

  return {
    key: redisKey,
    count,
    limit: config.maxRequests,
    remaining: Math.max(0, config.maxRequests - count),
  };
}
