# Rate Limiting Configuration Guide

## Overview

Rate limiting protects the application from:
- Brute force attacks
- Denial of Service (DoS) attacks
- API abuse
- Automated attacks

The system uses Redis-based sliding window rate limiting for accurate, distributed rate limiting.

## Architecture

- **Storage**: Redis sorted sets for efficient sliding window
- **Service**: `rateLimiter.ts` with configurable limits
- **Integration**: Fastify middleware for easy route protection
- **Monitoring**: X-RateLimit headers on all responses

## Default Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| Login | 5 attempts | 1 minute |
| 2FA Verification | 10 attempts | 1 minute |
| Password Reset | 3 attempts | 1 hour |
| API Endpoints | 100 requests | 1 minute |
| Signup | 5 registrations | 1 hour |

## Configuration

### Environment Variables

```bash
# Login Rate Limiting
RATE_LIMIT_LOGIN_WINDOW=60000      # milliseconds (1 minute)
RATE_LIMIT_LOGIN_MAX=5              # max attempts per window

# 2FA Verification Rate Limiting
RATE_LIMIT_2FA_WINDOW=60000
RATE_LIMIT_2FA_MAX=10

# Password Reset Rate Limiting
RATE_LIMIT_PASSWORD_RESET_WINDOW=3600000  # 1 hour
RATE_LIMIT_PASSWORD_RESET_MAX=3

# API Endpoint Rate Limiting
RATE_LIMIT_API_WINDOW=60000
RATE_LIMIT_API_MAX=100

# Signup Rate Limiting
RATE_LIMIT_SIGNUP_WINDOW=3600000
RATE_LIMIT_SIGNUP_MAX=5

# Redis Connection
REDIS_URL=redis://localhost:6379
```

### Customize Rate Limits

Edit `src/middleware/rateLimiter.ts`:

```typescript
export const RATE_LIMITS = {
  login: {
    windowMs: 60 * 1000,      // 1 minute
    maxRequests: 5,            // 5 attempts
    keyPrefix: 'ratelimit:login',
  },
  // ... other limits
};
```

## Implementation

### Protect Routes with Middleware

```typescript
import { loginRateLimiter, twoFactorRateLimiter } from '../middleware/rateLimiter';

// Apply to specific routes
app.post('/auth/login', { preHandler: loginRateLimiter() }, async (req, reply) => {
  // Login logic
});

app.post('/2fa/verify', { preHandler: twoFactorRateLimiter() }, async (req, reply) => {
  // 2FA verification
});

// Apply to all routes under a prefix
app.register(async (app) => {
  app.post('/setup', { preHandler: twoFactorRateLimiter() }, ...);
  app.post('/confirm', { preHandler: twoFactorRateLimiter() }, ...);
}, { prefix: '/2fa' });
```

### Custom Rate Limits

```typescript
import { createRateLimiterMiddleware, RATE_LIMITS } from '../middleware/rateLimiter';

// Create custom limit
const customLimit = {
  windowMs: 5 * 60 * 1000,  // 5 minutes
  maxRequests: 20,
  keyPrefix: 'ratelimit:custom'
};

const customRateLimiter = createRateLimiterMiddleware(customLimit);

app.post('/custom-endpoint',
  { preHandler: customRateLimiter },
  async (req, reply) => {
    // Protected endpoint
  }
);
```

### User-Based Rate Limiting

By default, rate limiting uses IP address. For authenticated endpoints, use user ID:

```typescript
// In twoFactorRateLimiter()
const identifier = req.auth?.userId || req.ip || 'unknown';
const limit = await checkRateLimit(identifier, config);
```

## HTTP Headers

All rate-limited responses include headers:

```
X-RateLimit-Limit: 5          # Max requests in window
X-RateLimit-Remaining: 2      # Requests remaining
X-RateLimit-Reset: 2026-03-17T10:30:00Z  # When limit resets
```

## Error Response

When rate limit exceeded (HTTP 429):

```json
{
  "error": "Too many requests",
  "message": "Rate limit exceeded. Try again in 45 seconds.",
  "retryAfter": 45
}
```

Client should:
1. Wait `retryAfter` seconds
2. Or wait until `X-RateLimit-Reset`
3. Implement exponential backoff for retries

## API Endpoints (Admin)

### Get Rate Limit Status

```typescript
import { getRateLimitStatus, RATE_LIMITS } from '../middleware/rateLimiter';

const status = await getRateLimitStatus(ipAddress, RATE_LIMITS.login);
// Returns: { key, count, limit, remaining }
```

### Reset Rate Limit

```typescript
import { resetRateLimit, RATE_LIMITS } from '../middleware/rateLimiter';

// Clear rate limit for specific IP
await resetRateLimit(ipAddress, RATE_LIMITS.login);

// Admin endpoint
app.post('/admin/rate-limit/reset/:ip', async (req, reply) => {
  const ip = (req.params as any).ip;
  await resetRateLimit(ip, RATE_LIMITS.login);
  return reply.send({ success: true });
});
```

### Get Limits for IP Address

```
GET /api/admin/rate-limits/status/{ip}

Response:
{
  "login": { "count": 3, "limit": 5, "remaining": 2 },
  "2fa": { "count": 8, "limit": 10, "remaining": 2 },
  "passwordReset": { "count": 0, "limit": 3, "remaining": 3 },
  "api": { "count": 45, "limit": 100, "remaining": 55 }
}
```

## Whitelist/Bypass

### Bypass for Trusted IPs

```typescript
import { checkRateLimit, RATE_LIMITS } from '../middleware/rateLimiter';

const TRUSTED_IPS = ['127.0.0.1', 'healthcheck-service'];

app.addHook('onRequest', async (req, reply) => {
  if (TRUSTED_IPS.includes(req.ip)) {
    // Skip rate limiting for trusted IPs
    req.skipRateLimit = true;
  }
});
```

### Bypass for Specific Routes

```typescript
// Health check - no rate limit
app.get('/health', async (req, reply) => {
  return { status: 'ok' };
});

// Public endpoint - no rate limit
app.get('/public/info', async (req, reply) => {
  return { version: '1.0.0' };
});
```

## Monitoring

### Monitor Rate Limit Activity

```typescript
import { getRateLimitStatus, RATE_LIMITS } from '../middleware/rateLimiter';

// Check for rate-limited IPs
const suspiciousIPs = [];
for (const ip of getActiveIPs()) {
  const status = await getRateLimitStatus(ip, RATE_LIMITS.login);
  if (status.count === status.limit) {
    suspiciousIPs.push({ ip, attempts: status.count });
  }
}

if (suspiciousIPs.length > 0) {
  // Alert: Possible brute force attacks
  console.warn('Suspicious login attempts:', suspiciousIPs);
}
```

### Alert on Rate Limit Hits

```typescript
// Middleware to track rate limit violations
app.addHook('onRequest', async (req, reply) => {
  reply.addHook('onSend', async (req, reply, payload) => {
    if (reply.statusCode === 429) {
      // Log rate limit hit
      await logSecurityEvent({
        type: 'RATE_LIMIT_EXCEEDED',
        ipAddress: req.ip,
        endpoint: req.url,
        timestamp: new Date()
      });

      // Trigger alert if suspicious
      const violations = await getRecentViolations(req.ip);
      if (violations > 10) {
        // Alert: Possible attack
      }
    }
  });
});
```

## Production Tuning

### For High Traffic

Increase limits:

```bash
RATE_LIMIT_API_MAX=500          # More requests allowed
RATE_LIMIT_API_WINDOW=60000     # Same 1-minute window
```

### For Security-Conscious

Decrease limits:

```bash
RATE_LIMIT_LOGIN_MAX=3          # Stricter login limit
RATE_LIMIT_LOGIN_WINDOW=300000  # 5-minute window
RATE_LIMIT_2FA_MAX=5            # Fewer 2FA attempts
```

### For Load Balanced Setup

Ensure Redis is shared across all instances:

```bash
REDIS_URL=redis://redis-cluster.internal:6379
REDIS_CLUSTER=true
```

All servers see same rate limit counters.

## Troubleshooting

### Rate limits not working

1. **Check Redis connection**
   ```bash
   redis-cli ping  # Should return PONG
   redis-cli GET 'ratelimit:login:192.168.1.1'
   ```

2. **Verify middleware is applied**
   ```typescript
   // Check route registration
   console.log(app.printRoutes());
   ```

3. **Check environment variables**
   ```bash
   echo $REDIS_URL
   echo $RATE_LIMIT_LOGIN_MAX
   ```

### False positives (legitimate users blocked)

1. **Increase limits**
   ```bash
   RATE_LIMIT_LOGIN_MAX=10
   ```

2. **Whitelist IP ranges**
   ```typescript
   const TRUSTED_RANGES = ['192.168.0.0/16'];
   if (isInRange(req.ip, TRUSTED_RANGES)) {
     return;  // Skip rate limit
   }
   ```

3. **Implement per-user instead of per-IP**
   ```typescript
   const identifier = req.auth?.userId || req.ip;
   ```

### Redis connection issues

If Redis is unavailable, rate limiting fails open (allows requests):

```typescript
return {
  isLimited: false,  // Fail open
  remaining: config.maxRequests - 1,
  resetTime: config.windowMs
};
```

To fail closed instead:

```typescript
catch (error) {
  // Fail closed - reject if Redis unavailable
  throw new Error('Rate limiter unavailable');
}
```

## Database Queries

### Find Rate Limited IPs (Last Hour)

```sql
SELECT DISTINCT
  jsonb_object_keys(metadata) as ip,
  COUNT(*) as violations
FROM "AuditEvent"
WHERE action = 'RATE_LIMIT_EXCEEDED'
  AND "createdAt" > NOW() - INTERVAL '1 hour'
GROUP BY jsonb_object_keys(metadata)
ORDER BY violations DESC;
```

### Find Brute Force Attempts

```sql
SELECT "actorUserId", ip, COUNT(*) as attempts
FROM "AuditEvent"
WHERE action = 'LOGIN_ATTEMPT'
  AND metadata->>'result' = 'failure'
  AND "createdAt" > NOW() - INTERVAL '15 minutes'
GROUP BY "actorUserId", ip
HAVING COUNT(*) > 5
ORDER BY attempts DESC;
```

## Advanced Configuration

### Dynamic Rate Limiting

```typescript
// Adjust limits based on system load
async function getDynamicLimit(endpoint: string) {
  const cpuUsage = os.cpus().reduce((a, c) => a + c.idle, 0) / os.cpus().length;

  if (cpuUsage > 80) {
    // System under load - stricter limits
    return { max: 3, window: 60000 };
  } else if (cpuUsage < 20) {
    // System underutilized - relaxed limits
    return { max: 50, window: 60000 };
  }

  return { max: 10, window: 60000 };
}
```

### User-Based Limits

```typescript
// VIP users get higher limits
async function getUserLimit(userId: string) {
  const user = await prisma.platformUser.findUnique({
    where: { id: userId }
  });

  if (user?.globalRole === 'SUPER_ADMIN') {
    return { max: 1000, window: 60000 };  // No limit effectively
  }

  return { max: 100, window: 60000 };
}
```

### Gradual Backoff

```typescript
// Increase wait time after repeated violations
function getBackoffTime(violationCount: number) {
  if (violationCount < 3) return 0;
  if (violationCount < 5) return 300;      // 5 minutes
  if (violationCount < 10) return 3600;    // 1 hour
  return 86400;                              // 24 hours
}
```

## Best Practices

1. **Always rate limit login/auth endpoints**
   - Protects against brute force attacks
   - Critical security measure

2. **Implement progressive delays**
   - First violations: inform user
   - Later violations: longer delays
   - Multiple violations: temporary ban

3. **Log all rate limit violations**
   - Detect attack patterns
   - Alert on suspicious activity
   - Improve security monitoring

4. **Test rate limit boundaries**
   - Ensure legitimate users not affected
   - Test with expected peak load
   - Stress test with attacks

5. **Monitor and adjust**
   - Track actual usage patterns
   - Adjust limits based on data
   - Keep security and usability balanced

## Support

For rate limiting issues:
1. Check Redis: `redis-cli PING`
2. Check logs: `grep -i "ratelimit" /var/log/sgi360/*.log`
3. Test endpoint: `curl -v http://localhost:3001/auth/login`
4. Contact: support@sgi360.com
