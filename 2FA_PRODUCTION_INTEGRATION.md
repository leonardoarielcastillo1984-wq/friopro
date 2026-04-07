# 2FA Production Integration Guide

## Overview

This guide covers integrating the production-ready 2FA system with email notifications, audit logging, and rate limiting into your application.

## What's New

### 1. Email Notifications System
- Resend, SendGrid, or SMTP provider support
- Email templates for 2FA events
- Async queue processing with BullMQ/Redis
- Automatic retry with exponential backoff
- Audit logging of all sends/failures

### 2. Audit Logging
- Comprehensive event logging for all 2FA operations
- 2FA enable/disable tracking
- TOTP verification attempts (success/failure)
- Recovery code usage
- Login attempt tracking
- Security alerts
- 7-year retention policy support

### 3. Rate Limiting
- Redis-based sliding window rate limiting
- Configurable limits for each operation
- Protection against brute force attacks
- X-RateLimit headers on responses
- Admin endpoints for management

## Files Added

### Core Services
- `apps/api/src/services/auditLogger.ts` - Audit logging service
- `apps/api/src/jobs/emailQueue.ts` - Email queue worker
- `apps/api/src/middleware/rateLimiter.ts` - Rate limiting middleware

### Enhanced Routes
- `apps/api/src/routes/twoFactorAuthEnhanced.ts` - Enhanced 2FA routes with all integrations

### Email Templates
- `apps/api/templates/2fa-enabled.html`
- `apps/api/templates/2fa-disabled.html`
- `apps/api/templates/suspicious-login.html`
- `apps/api/templates/recovery-codes-generated.html`
- `apps/api/templates/security-alert.html`

### Email Service Extensions
- Enhanced `apps/api/src/services/email.ts` with 2FA templates

### Documentation
- `EMAIL_SETUP_GUIDE.md` - Email provider setup
- `AUDIT_LOGGING_GUIDE.md` - Audit logging documentation
- `RATE_LIMITING_GUIDE.md` - Rate limiting configuration
- `2FA_PRODUCTION_INTEGRATION.md` - This file

## Installation Steps

### Step 1: Install Dependencies

The required packages are already in `package.json`:
- `bullmq` - Queue processing
- `nodemailer` - SMTP email
- `resend` - Resend provider
- `redis` - Redis client

Verify installation:
```bash
cd apps/api
npm install
```

### Step 2: Update Environment Configuration

Copy `.env.example` and configure:

```bash
cp .env.example .env.local
```

Minimum required settings:

```bash
# Email Configuration
EMAIL_PROVIDER=resend              # or smtp, console
EMAIL_FROM=SGI 360 <noreply@sgi360.com>
RESEND_API_KEY=re_xxxxxxxxxxxx    # If using Resend

# Redis for queues and rate limiting
REDIS_URL=redis://localhost:6379

# Support URLs
SUPPORT_URL=https://support.sgi360.com
```

See `EMAIL_SETUP_GUIDE.md` for detailed email provider setup.

### Step 3: Update Route Registration

In `apps/api/src/app.ts`, register the enhanced 2FA routes:

```typescript
import { twoFactorAuthEnhancedRoutes } from './routes/twoFactorAuthEnhanced.js';

// Register 2FA routes with all enhancements
app.register(twoFactorAuthEnhancedRoutes, { prefix: '/2fa' });
```

### Step 4: Initialize Services

In `apps/api/src/main.ts`, initialize email queue and rate limiter:

```typescript
import { initializeRateLimiter, shutdownRateLimiter } from './middleware/rateLimiter.js';
import { startEmailWorker, closeEmailQueue } from './jobs/emailQueue.js';

async function main() {
  // Initialize email queue
  const emailWorker = startEmailWorker();
  console.log('[Startup] Email worker started');

  // Initialize rate limiter
  await initializeRateLimiter();
  console.log('[Startup] Rate limiter initialized');

  // Start server...
  await app.listen({ port: 3001, host: '0.0.0.0' });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    await emailWorker.close();
    await shutdownRateLimiter();
    await app.close();
  });
}

main();
```

### Step 5: Run Database Migration

The audit logging uses the existing `AuditEvent` table. Verify it exists:

```bash
cd apps/api
npx prisma db push
```

Verify audit table:
```bash
psql $DATABASE_URL -c "\dt public.\"AuditEvent\""
```

### Step 6: Test the Integration

```bash
# Start Redis
redis-server

# In another terminal, start the API
cd apps/api
npm run dev
```

Test 2FA setup:
```bash
# Enable 2FA
curl -X POST http://localhost:3001/2fa/setup \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"

# Confirm with TOTP
curl -X POST http://localhost:3001/2fa/confirm \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"token":"123456"}'
```

Check audit logs:
```bash
curl http://localhost:3001/2fa/audit-logs \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Integration Checklist

### Email Setup
- [ ] Choose email provider (Resend recommended)
- [ ] Configure EMAIL_PROVIDER env var
- [ ] Add API key or SMTP credentials
- [ ] Test email sending
- [ ] Customize email templates (optional)
- [ ] Configure support URLs

### Audit Logging
- [ ] Verify AuditEvent table exists
- [ ] Update 2FA routes to use enhanced version
- [ ] Test audit log recording
- [ ] Setup audit log retention policy
- [ ] Configure monitoring/alerts for security events

### Rate Limiting
- [ ] Verify Redis connection
- [ ] Configure rate limit values
- [ ] Add rate limiter middleware to routes
- [ ] Test rate limit responses
- [ ] Monitor for false positives
- [ ] Setup alerts for attack detection

### Testing
- [ ] Test 2FA enable with email notification
- [ ] Test 2FA disable with email warning
- [ ] Test suspicious login detection
- [ ] Test recovery code generation
- [ ] Test rate limits (login, 2FA, password reset)
- [ ] Test audit log retrieval
- [ ] Load test with expected volume

## Frontend Integration

### 2FA Setup Flow

1. User clicks "Enable 2FA"
   ```typescript
   POST /api/2fa/setup
   Response: { secret, qrCodeUrl, manualEntryKey }
   ```

2. Display QR code to user
   ```typescript
   <img src={qrCodeUrl} alt="2FA QR Code" />
   ```

3. User enters code from authenticator
   ```typescript
   POST /api/2fa/confirm
   Body: { token: "123456" }
   Response: { recoveryCodes: [...] }
   ```

4. Display recovery codes
   ```typescript
   // Show with copy/download options
   // Warn about saving them securely
   ```

### Security Dashboard

Display user's security events:

```typescript
// Fetch security events
GET /api/2fa/security-events?days=30
Response: {
  events: [
    { action: "2FA_ENABLED", timestamp, ipAddress, ... },
    { action: "LOGIN_ATTEMPT", timestamp, result, ... },
    ...
  ]
}
```

### Audit Log Display

Show user their own activity:

```typescript
// Fetch 2FA audit logs
GET /api/2fa/audit-logs?limit=50
Response: {
  logs: [
    { action: "2FA_ENABLED", timestamp, ipAddress, ... },
    ...
  ],
  total: 42
}
```

## Admin Dashboard Integration

### Monitor 2FA Adoption
```typescript
// Get 2FA statistics
const stats = await prisma.twoFactorAuth.groupBy({
  by: ['isEnabled'],
  _count: true
});
```

### Review User Audit Logs
```typescript
// Admin view any user's logs
GET /api/2fa/user/{userId}/audit-logs
```

### Monitor Rate Limits
```typescript
// Check if attacks happening
GET /api/admin/rate-limits/status/{ip}
```

### Email Queue Status
```typescript
// Monitor email queue
GET /api/admin/email-queue/stats
```

## Production Deployment

### Environment Setup

1. **Database**
   ```bash
   psql $DATABASE_URL -c "
     CREATE TABLE IF NOT EXISTS \"AuditEvent\" (
       id UUID PRIMARY KEY,
       action VARCHAR(255),
       ...
     );"
   ```

2. **Redis Cluster**
   ```bash
   redis-sentinel sentinel.conf  # For HA
   ```

3. **Email Provider**
   - Resend: Setup API key and sender domain
   - SMTP: Configure credentials and TLS
   - Verify SPF/DKIM records

### Monitoring Setup

1. **Email Queue Monitoring**
   ```bash
   # Monitor queue in Redis
   redis-cli LLEN 'bull:email-notifications:*'
   ```

2. **Audit Log Monitoring**
   ```sql
   -- Alert on suspicious patterns
   SELECT action, COUNT(*) FROM "AuditEvent"
   WHERE "createdAt" > NOW() - INTERVAL '1 hour'
   GROUP BY action;
   ```

3. **Rate Limit Monitoring**
   ```bash
   # Check for attacks
   redis-cli KEYS 'ratelimit:login:*' | wc -l
   ```

### Scaling Considerations

1. **Email Volume**
   - Monitor queue growth
   - Increase worker concurrency if needed
   - Use higher-tier email service plan

2. **Audit Logs Growth**
   - Archive old logs regularly
   - Use database partitioning
   - Add indexes for common queries

3. **Rate Limiting**
   - Ensure Redis cluster is robust
   - Monitor for Redis memory usage
   - Use Redis persistence (RDB/AOF)

## Troubleshooting

### Emails Not Sending

```bash
# Check Redis queue
redis-cli LLEN 'bull:email-notifications:*'

# Check worker logs
grep -i "EmailWorker" /var/log/sgi360/*.log

# Test email provider
curl -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  -d '{"from":"test@resend.dev","to":"test@example.com","subject":"Test","html":"Test"}'
```

### Rate Limits Not Working

```bash
# Check Redis connection
redis-cli PING

# Check rate limit data
redis-cli KEYS 'ratelimit:*'
redis-cli HGETALL 'ratelimit:login:192.168.1.1'
```

### Audit Logs Not Recording

```bash
# Check database connection
psql $DATABASE_URL -c "SELECT COUNT(*) FROM \"AuditEvent\";"

# Check for errors
grep -i "auditlog\|audit" /var/log/sgi360/*.log
```

## Rollback Plan

If issues occur:

1. **Disable rate limiting**
   ```typescript
   // Comment out preHandler middleware
   app.post('/2fa/verify', async (req, reply) => { ... });
   ```

2. **Disable email notifications**
   ```typescript
   // Comment out queueEmail calls
   // await queueEmail(emailPayload);
   ```

3. **Disable audit logging**
   ```typescript
   // Wrap in try-catch
   try {
     await log2FAEnabled(...);
   } catch (err) {
     console.error('Audit logging error:', err);
     // Continue anyway
   }
   ```

## Support

For production deployment support:
1. Review all three guide documents
2. Test thoroughly in staging
3. Monitor closely after production deployment
4. Keep backups of audit logs
5. Contact: devops@sgi360.com

## Verification Checklist

After deployment, verify:

- [ ] Emails sending successfully for 2FA events
- [ ] Audit logs recording all operations
- [ ] Rate limiting preventing brute force
- [ ] Security dashboard showing events
- [ ] Admin audit log access working
- [ ] Email templates rendering correctly
- [ ] No database performance issues
- [ ] Redis memory usage normal
- [ ] Alerts firing for security events
- [ ] Recovery procedures tested

## Next Steps

1. **User Communication**
   - Announce 2FA availability
   - Encourage adoption
   - Provide documentation

2. **Admin Training**
   - How to view audit logs
   - How to handle security alerts
   - How to manage rate limits

3. **Monitoring Setup**
   - Dashboard for security metrics
   - Alerts for suspicious activity
   - Regular audit log review

4. **Compliance Documentation**
   - Document security controls
   - Audit log retention policy
   - Incident response procedures

---

For detailed documentation on each component:
- Email: See `EMAIL_SETUP_GUIDE.md`
- Audit: See `AUDIT_LOGGING_GUIDE.md`
- Rate Limiting: See `RATE_LIMITING_GUIDE.md`
