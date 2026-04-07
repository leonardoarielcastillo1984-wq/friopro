# Email Service Setup Guide

## Overview

The email service provides production-ready email notifications for:
- Two-Factor Authentication (2FA) enabled/disabled
- Suspicious login detection
- Recovery codes generation
- Security alerts
- Password resets
- Custom notifications

## Architecture

The email system uses:
- **BullMQ Queue**: Async email processing with Redis
- **Multiple Providers**: Console (dev), Resend, SMTP
- **Retry Logic**: Exponential backoff with configurable attempts
- **Audit Logging**: All email sends/failures logged to database

## Setup Instructions

### 1. Choose Email Provider

#### Option A: Console (Development Only)
```bash
EMAIL_PROVIDER=console
```
Emails will be printed to console. Use for local development.

#### Option B: Resend (Recommended for Production)
1. Sign up at https://resend.com
2. Create an API key
3. Add to .env:
```bash
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_xxxxxxxxxxxx
EMAIL_FROM=SGI 360 <noreply@sgi360.com>
```

#### Option C: SMTP (Gmail, Office 365, etc.)
```bash
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=SGI 360 <noreply@sgi360.com>
```

**Gmail Setup:**
1. Enable 2-Step Verification
2. Generate App Password at https://myaccount.google.com/apppasswords
3. Use the generated password as SMTP_PASS

**Office 365 Setup:**
```bash
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=your-email@company.com
SMTP_PASS=your-password
```

### 2. Configure Redis Connection

Email queue requires Redis:
```bash
REDIS_URL=redis://localhost:6379
```

For production with authentication:
```bash
REDIS_URL=redis://user:password@redis.example.com:6379
```

### 3. Configure Support URLs (Optional)

Used in email templates:
```bash
SUPPORT_URL=https://support.sgi360.com
CONTACT_URL=https://contact.sgi360.com
```

### 4. Environment Variables

```bash
# Required
EMAIL_PROVIDER=resend                    # console | resend | smtp
EMAIL_FROM=SGI 360 <noreply@sgi360.com>  # From address
REDIS_URL=redis://localhost:6379

# Resend-specific
RESEND_API_KEY=re_xxxxxxxxxxxx

# SMTP-specific
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=user@gmail.com
SMTP_PASS=password

# Queue configuration
EMAIL_WORKER_CONCURRENCY=5               # Worker threads
```

## Integration

### Queue Email Notifications

```typescript
import { queueEmail } from './jobs/emailQueue';
import { twoFactorEnabledEmail } from './services/email';

// Send 2FA enabled notification
const emailPayload = twoFactorEnabledEmail(
  'user@example.com',
  'John Doe'
);
await queueEmail(emailPayload, 1); // Priority: 1 (high)
```

### Available Email Templates

#### 2FA Notifications
```typescript
// 2FA enabled
twoFactorEnabledEmail(email: string, userName: string)

// 2FA disabled
twoFactorDisabledEmail(email: string, userName: string)

// Suspicious login
suspiciousLoginEmail(
  email: string,
  userName: string,
  loginTime: string,
  location: string,
  ipAddress: string,
  deviceInfo: string,
  status: string
)

// Recovery codes generated
recoveryCodesGeneratedEmail(email: string, userName: string)

// Security alert
securityAlertEmail(
  email: string,
  userName: string,
  alertType: string,
  alertDetails: string,
  timestamp: string
)
```

#### Generic Notifications
```typescript
notificationEmail({
  userEmail: string;
  title: string;
  message: string;
  actionLabel?: string;
  actionUrl?: string;
  type?: 'info' | 'warning' | 'error' | 'success';
})
```

## Email Queue Management

### Monitor Queue Status

```typescript
import { getEmailQueueStats } from './jobs/emailQueue';

const stats = await getEmailQueueStats();
console.log(stats);
// {
//   waiting: 5,
//   active: 2,
//   delayed: 0,
//   failed: 1,
//   completed: 1234,
//   total: 1242
// }
```

### Cleanup Old Jobs

```typescript
import { cleanupEmailQueue } from './jobs/emailQueue';

// Remove completed jobs older than 1 hour
// Remove failed jobs older than 7 days
await cleanupEmailQueue();
```

### API Endpoints

#### Get Queue Stats (Admin)
```
GET /api/admin/email-queue/stats
Response: { waiting, active, delayed, failed, completed, total }
```

#### Cleanup Queue (Admin)
```
POST /api/admin/email-queue/cleanup
Response: { success: true }
```

#### Resend Email (Admin)
```
POST /api/admin/email-queue/resend/:jobId
Response: { success: true, jobId }
```

## Monitoring

### Log Files
Email activity is logged to:
- Application logs: Console/file output
- Audit trail: Database audit_events table

### Database Audit Logs
```sql
SELECT * FROM "AuditEvent"
WHERE action IN ('EMAIL_SENT', 'EMAIL_FAILED')
ORDER BY "createdAt" DESC;
```

### Email Status Tracking

```typescript
// Check email history for user
const logs = await prisma.auditEvent.findMany({
  where: {
    action: { in: ['EMAIL_SENT', 'EMAIL_FAILED'] },
    metadata: { path: ['to'], equals: 'user@example.com' }
  },
  orderBy: { createdAt: 'desc' },
  take: 50
});
```

## Troubleshooting

### Emails not sending

1. **Check Redis connection**
   ```bash
   redis-cli ping  # Should return PONG
   ```

2. **Check email provider credentials**
   ```bash
   # Test SMTP
   npm run test:smtp

   # Test Resend
   npm run test:resend
   ```

3. **Check queue worker**
   ```bash
   # Verify worker is running
   npm run dev  # Should show "[EmailWorker]" logs
   ```

4. **Check failed jobs**
   ```typescript
   const queue = getEmailQueue();
   const failed = await queue.getFailed();
   console.log(failed);
   ```

### High email volume

Adjust worker concurrency:
```bash
EMAIL_WORKER_CONCURRENCY=10  # Increase from default 5
```

Monitor queue growth:
```typescript
const stats = await getEmailQueueStats();
if (stats.waiting > 1000) {
  // Alert: Queue backlog
}
```

### Rate limiting by email provider

**Resend**: 100 emails/sec (plan dependent)
**Gmail SMTP**: ~300 emails/hour
**Office 365**: ~400 emails/hour

If hitting limits:
1. Use higher-tier email service plan
2. Distribute sends over time
3. Implement queue prioritization

## Testing

### Send Test Email

```typescript
import { sendEmail } from './services/email';

const result = await sendEmail({
  to: 'test@example.com',
  subject: 'Test Email',
  html: '<h1>Test</h1>',
  text: 'Test email body'
});

console.log(result);
// { success: true, messageId: 'msg_xxx' }
```

### Queue Test Email

```typescript
import { queueEmail } from './jobs/emailQueue';

await queueEmail({
  to: 'test@example.com',
  subject: 'Test',
  html: '<h1>Test</h1>'
});

// Email will be processed asynchronously
```

## Production Checklist

- [ ] EMAIL_PROVIDER set to resend or smtp (not console)
- [ ] Valid API key or SMTP credentials configured
- [ ] Redis connection tested and stable
- [ ] Support/contact URLs configured
- [ ] Email templates customized with correct branding
- [ ] Worker concurrency tuned for expected volume
- [ ] Monitoring/alerting setup for failed emails
- [ ] Audit logging enabled
- [ ] Rate limiting configured appropriately
- [ ] Load testing completed
- [ ] Fallback email provider configured
- [ ] Email templates translated if needed

## Advanced Configuration

### Custom Email Template

Add to `apps/api/templates/` directory:

```html
<!DOCTYPE html>
<html>
<head><title>{{title}}</title></head>
<body>
  <h1>{{title}}</h1>
  <p>{{message}}</p>
</body>
</html>
```

Load and send:

```typescript
import { readFileSync } from 'fs';
import { join } from 'path';

const template = readFileSync(
  join(import.meta.dirname, '../templates/custom.html'),
  'utf-8'
);

const html = template
  .replace('{{title}}', 'Email Title')
  .replace('{{message}}', 'Email message');

await queueEmail({
  to: email,
  subject: 'Custom Email',
  html
});
```

### Batch Email Sending

```typescript
import { queueEmail } from './jobs/emailQueue';

const users = await prisma.platformUser.findMany({
  where: { isActive: true }
});

// Queue emails with staggered priority
for (let i = 0; i < users.length; i++) {
  const priority = i % 10; // Spread priority 0-9
  await queueEmail(emailPayload(users[i].email), priority);
}
```

## API Reference

### queueEmail(payload, priority?)
Queue an email for async sending.
- `payload`: EmailPayload
- `priority`: number (optional, 1=high)
- Returns: Promise<void>

### sendEmail(payload)
Send email immediately (synchronous).
- `payload`: EmailPayload
- Returns: Promise<EmailResult>

### getEmailQueueStats()
Get queue statistics.
- Returns: Promise<QueueStats>

### cleanupEmailQueue()
Remove old completed/failed jobs.
- Returns: Promise<void>

### startEmailWorker()
Start the email queue worker.
- Returns: Worker<EmailJobPayload>

## Support

For issues or questions:
1. Check logs: `grep -i email /var/log/sgi360/*.log`
2. Monitor queue: Visit `/api/admin/email-queue/stats`
3. Contact: support@sgi360.com
