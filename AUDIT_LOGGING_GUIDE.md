# Audit Logging Guide

## Overview

The audit logging system provides comprehensive tracking of all 2FA and security events for compliance, security monitoring, and troubleshooting.

## Architecture

- **Storage**: PostgreSQL `AuditEvent` table
- **Service**: `auditLogger.ts` with typed logging functions
- **Integration**: Automatic logging in all 2FA operations
- **Retention**: Configurable retention policy (default 365 days)

## Audit Events

### 2FA Events

#### 2FA_ENABLED
When user enables two-factor authentication.

```json
{
  "action": "2FA_ENABLED",
  "entityType": "TwoFactorAuth",
  "entityId": "user-uuid",
  "result": "success",
  "ipAddress": "192.168.1.1",
  "userAgent": "Mozilla/5.0...",
  "timestamp": "2026-03-17T10:30:00Z",
  "description": "Two-factor authentication enabled"
}
```

#### 2FA_DISABLED
When user disables two-factor authentication.

```json
{
  "action": "2FA_DISABLED",
  "entityType": "TwoFactorAuth",
  "entityId": "user-uuid",
  "result": "success",
  "ipAddress": "192.168.1.1",
  "timestamp": "2026-03-17T10:35:00Z",
  "description": "Two-factor authentication disabled"
}
```

#### TOTP_VERIFIED
When TOTP (Time-based One-Time Password) is successfully verified.

```json
{
  "action": "TOTP_VERIFIED",
  "entityType": "TwoFactorAuth",
  "entityId": "user-uuid",
  "result": "success",
  "ipAddress": "192.168.1.1",
  "timestamp": "2026-03-17T10:40:00Z",
  "description": "TOTP code verified successfully"
}
```

#### TOTP_VERIFICATION_FAILED
When TOTP verification fails (invalid code, expired, etc.).

```json
{
  "action": "TOTP_VERIFICATION_FAILED",
  "entityType": "TwoFactorAuth",
  "entityId": "user-uuid",
  "result": "failure",
  "ipAddress": "192.168.1.1",
  "errorMessage": "Invalid TOTP code",
  "metadata": {
    "reason": "Invalid TOTP code",
    "attempts": 1
  }
}
```

#### RECOVERY_CODE_USED
When recovery code is used for login.

```json
{
  "action": "RECOVERY_CODE_USED",
  "entityType": "TwoFactorAuth",
  "entityId": "user-uuid",
  "result": "success",
  "ipAddress": "192.168.1.1",
  "timestamp": "2026-03-17T10:45:00Z",
  "description": "Recovery code used for login"
}
```

#### RECOVERY_CODES_REGENERATED
When recovery codes are regenerated.

```json
{
  "action": "RECOVERY_CODES_REGENERATED",
  "entityType": "TwoFactorAuth",
  "entityId": "user-uuid",
  "result": "success",
  "ipAddress": "192.168.1.1",
  "timestamp": "2026-03-17T10:50:00Z",
  "description": "Recovery codes regenerated"
}
```

### Authentication Events

#### LOGIN_ATTEMPT
When user attempts to log in (success or failure).

```json
{
  "action": "LOGIN_ATTEMPT",
  "entityType": "Authentication",
  "entityId": "user-uuid",
  "result": "success|failure",
  "ipAddress": "192.168.1.1",
  "userAgent": "Mozilla/5.0...",
  "errorMessage": "Invalid password",
  "timestamp": "2026-03-17T11:00:00Z",
  "description": "Login successful"
}
```

#### SUSPICIOUS_LOGIN_DETECTED
When login from new device/location is detected.

```json
{
  "action": "SUSPICIOUS_LOGIN_DETECTED",
  "entityType": "Authentication",
  "entityId": "user-uuid",
  "result": "success",
  "ipAddress": "192.168.1.1",
  "metadata": {
    "location": "New York, US",
    "deviceType": "Desktop",
    "description": "Suspicious login from new device/location"
  }
}
```

#### PASSWORD_CHANGED
When user changes password.

```json
{
  "action": "PASSWORD_CHANGED",
  "entityType": "User",
  "entityId": "user-uuid",
  "result": "success",
  "ipAddress": "192.168.1.1",
  "timestamp": "2026-03-17T11:05:00Z",
  "description": "User password changed"
}
```

### Security Events

#### SECURITY_ALERT
When security alert is triggered (brute force, etc.).

```json
{
  "action": "SECURITY_ALERT",
  "entityType": "User",
  "entityId": "user-uuid",
  "result": "success",
  "metadata": {
    "alertType": "BRUTE_FORCE_ATTEMPT",
    "details": "10 failed login attempts in 5 minutes",
    "description": "Security alert triggered"
  }
}
```

## Integration

### Log 2FA Events

```typescript
import {
  log2FAEnabled,
  log2FADisabled,
  logTOTPVerified,
  logTOTPVerificationFailed,
  logRecoveryCodeUsed,
  logRecoveryCodesRegenerated
} from '../services/auditLogger';

// Enable 2FA
await log2FAEnabled(userId, ipAddress, userAgent);

// Disable 2FA
await log2FADisabled(userId, ipAddress, userAgent);

// Verify TOTP
await logTOTPVerified(userId, ipAddress, userAgent);

// Failed TOTP verification
await logTOTPVerificationFailed(userId, 'Invalid code', ipAddress, userAgent);

// Use recovery code
await logRecoveryCodeUsed(userId, ipAddress, userAgent);

// Regenerate recovery codes
await logRecoveryCodesRegenerated(userId, ipAddress, userAgent);
```

### Log Authentication Events

```typescript
import {
  logLoginAttempt,
  logSuspiciousLogin,
  logPasswordChanged,
  logAccountSecurityAlert
} from '../services/auditLogger';

// Log login attempt
await logLoginAttempt(userId, success, ipAddress, userAgent, reason);

// Log suspicious login
await logSuspiciousLogin(userId, 'San Francisco, US', ipAddress, userAgent);

// Log password change
await logPasswordChanged(userId, ipAddress, userAgent);

// Log security alert
await logAccountSecurityAlert(userId, 'BRUTE_FORCE', 'Details...', ipAddress, userAgent);
```

## Querying Audit Logs

### Get User's 2FA Audit Logs

```typescript
import { get2FAAuditLogs } from '../services/auditLogger';

const logs = await get2FAAuditLogs(userId, limit);
// Returns: Array of 2FA-specific events
```

### Get All User Audit Logs

```typescript
import { getUserAuditLogs } from '../services/auditLogger';

const { logs, total } = await getUserAuditLogs(userId, limit, offset);
// Returns: Paginated audit logs for user
```

### Get Security Events

```typescript
import { getSecurityEvents } from '../services/auditLogger';

const events = await getSecurityEvents(userId, days, limit);
// Returns: Security events from last N days
```

## API Endpoints

### Get My 2FA Audit Logs
```
GET /api/2fa/audit-logs?limit=50&offset=0
Authorization: Bearer {token}

Response:
{
  "logs": [
    {
      "id": "uuid",
      "action": "2FA_ENABLED",
      "timestamp": "2026-03-17T10:30:00Z",
      "result": "success",
      "ipAddress": "192.168.1.1",
      "details": "Two-factor authentication enabled"
    }
  ],
  "total": 42
}
```

### Get My Security Events
```
GET /api/2fa/security-events?days=30&limit=50
Authorization: Bearer {token}

Response:
{
  "events": [
    {
      "id": "uuid",
      "action": "LOGIN_ATTEMPT",
      "timestamp": "2026-03-17T11:00:00Z",
      "result": "success",
      "ipAddress": "192.168.1.1",
      "location": "New York, US",
      "details": "Login successful"
    }
  ],
  "total": 15
}
```

### Get User Audit Logs (Admin)
```
GET /api/2fa/user/{userId}/audit-logs?limit=50&offset=0
Authorization: Bearer {admin-token}

Response:
{
  "logs": [...],
  "total": 42,
  "userId": "uuid"
}
```

## Database Queries

### Find All 2FA Events for User

```sql
SELECT * FROM "AuditEvent"
WHERE "actorUserId" = 'user-uuid'
  AND "entityType" = 'TwoFactorAuth'
ORDER BY "createdAt" DESC;
```

### Find Failed TOTP Attempts

```sql
SELECT * FROM "AuditEvent"
WHERE "action" = 'TOTP_VERIFICATION_FAILED'
  AND "createdAt" > NOW() - INTERVAL '7 days'
ORDER BY "createdAt" DESC;
```

### Find Suspicious Logins

```sql
SELECT * FROM "AuditEvent"
WHERE "action" = 'SUSPICIOUS_LOGIN_DETECTED'
  AND "createdAt" > NOW() - INTERVAL '30 days'
ORDER BY "createdAt" DESC;
```

### Find Security Alerts

```sql
SELECT * FROM "AuditEvent"
WHERE "action" = 'SECURITY_ALERT'
  AND "createdAt" > NOW() - INTERVAL '30 days'
ORDER BY "createdAt" DESC;
```

### Find All Failed Login Attempts (Last 24 Hours)

```sql
SELECT "actorUserId", COUNT(*) as attempts
FROM "AuditEvent"
WHERE "action" = 'LOGIN_ATTEMPT'
  AND "metadata"->>'result' = 'failure'
  AND "createdAt" > NOW() - INTERVAL '24 hours'
GROUP BY "actorUserId"
HAVING COUNT(*) > 5
ORDER BY attempts DESC;
```

## Compliance & Retention

### Retention Policy

- **Default**: 365 days
- **Compliance requirement**: Maintain 7 years (configurable)

```typescript
// Archive old logs (admin task)
async function archiveOldLogs() {
  const cutoffDate = new Date();
  cutoffDate.setFullYear(cutoffDate.getFullYear() - 7);

  const archived = await prisma.auditEvent.deleteMany({
    where: {
      createdAt: { lt: cutoffDate }
    }
  });

  console.log(`Archived ${archived.count} events`);
}
```

### Audit Log Export

```typescript
// Export audit logs for compliance
async function exportAuditLogs(startDate: Date, endDate: Date) {
  const logs = await prisma.auditEvent.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lte: endDate
      }
    },
    orderBy: { createdAt: 'asc' }
  });

  // Convert to CSV/JSON for export
  return logs.map(log => ({
    date: log.createdAt,
    user: log.actorUserId,
    action: log.action,
    entity: log.entityType,
    result: log.metadata?.result,
    ipAddress: log.metadata?.ipAddress,
    details: log.metadata?.description
  }));
}
```

## Security Best Practices

1. **Immutable Logs**: Audit logs should not be modified
   - Use database triggers to prevent updates
   - Only delete old logs per retention policy

2. **Access Control**: Restrict audit log access
   - Only admins can view other users' logs
   - Users can only view their own logs
   - Log access attempts

3. **Encryption**: Encrypt sensitive data
   - IP addresses (optional)
   - User agent strings (optional)

4. **Monitoring**: Alert on suspicious patterns
   - Multiple failed 2FA attempts
   - 2FA disabled after enabled
   - Login from unusual locations

## Troubleshooting

### Logs not being recorded

1. Check database connection
   ```bash
   psql $DATABASE_URL -c "SELECT COUNT(*) FROM \"AuditEvent\";"
   ```

2. Check application logs for errors
   ```bash
   grep -i "AuditLog" /var/log/sgi360/*.log
   ```

3. Verify Prisma schema includes AuditEvent
   ```bash
   npx prisma db push
   ```

### Performance issues with large log volume

1. Add indexes
   ```sql
   CREATE INDEX idx_audit_user ON "AuditEvent"("actorUserId");
   CREATE INDEX idx_audit_action ON "AuditEvent"("action");
   CREATE INDEX idx_audit_created ON "AuditEvent"("createdAt");
   ```

2. Implement partitioning by date
   ```sql
   CREATE TABLE "AuditEvent_2026_Q1" PARTITION OF "AuditEvent"
   FOR VALUES FROM ('2026-01-01') TO ('2026-04-01');
   ```

3. Archive old logs regularly

### Missing IP addresses

IP address may be null if:
- Behind proxy (configure trusted proxies)
- Using local connection
- Client didn't provide header

Configure trusted proxies in Fastify:
```typescript
app.register(require('@fastify/proxy'), {
  upstream: 'http://backend:3001',
  prefix: '/api'
});

// Enable to get real IP
app.set('trust proxy', 'loopback,linklocal,uniquelocal');
```

## Dashboard Integration

Display audit logs in user security dashboard:

```typescript
// Dashboard security activity component
export async function getUserSecurityDashboard(userId: string) {
  const events = await getSecurityEvents(userId, 30, 20);

  return {
    recentActivity: events,
    summary: {
      totalEvents: events.length,
      failedLogins: events.filter(e => e.action === 'LOGIN_ATTEMPT' && e.result === 'failure').length,
      suspiciousLogins: events.filter(e => e.action === 'SUSPICIOUS_LOGIN_DETECTED').length,
      passwordChanges: events.filter(e => e.action === 'PASSWORD_CHANGED').length,
    }
  };
}
```

## Support

For audit logging issues:
1. Check PostgreSQL connection: `psql $DATABASE_URL`
2. Verify schema: `SELECT * FROM "AuditEvent" LIMIT 1;`
3. Check logs: `grep -i audit /var/log/sgi360/*.log`
4. Contact: support@sgi360.com
