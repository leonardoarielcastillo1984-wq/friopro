# SGI 360 Database Schema Documentation

## Overview

SGI 360 uses PostgreSQL as the production database with Prisma ORM for database management. This document describes the database schema with emphasis on the 2FA (Two-Factor Authentication) system.

## Database Setup

### PostgreSQL Version
- **Version**: 16.x (Alpine Linux)
- **Connection Pool**: Managed by Prisma
- **Timezone**: UTC (Timestamptz fields)

### Extensions Required
- `uuid-ossp` - UUID generation
- `pg_trgm` - Text search and trigram indexes
- `unaccent` - Text normalization

## Core Models

### Two-Factor Authentication Tables

#### `TwoFactorAuth`
Stores 2FA configuration for users.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| userId | UUID | Foreign key to PlatformUser (UNIQUE) |
| secret | TEXT | TOTP secret (base32 encoded) |
| qrCodeUrl | TEXT | Data URL for QR code |
| isEnabled | BOOLEAN | Is 2FA active? |
| isConfirmed | BOOLEAN | Has user confirmed setup? |
| createdAt | TIMESTAMPTZ | Creation timestamp |
| enabledAt | TIMESTAMPTZ | When 2FA was enabled |
| disabledAt | TIMESTAMPTZ | When 2FA was disabled |
| createdById | UUID | Admin who created (for audit) |

**Indexes**:
- PRIMARY: id
- UNIQUE: userId
- INDEX: isEnabled

**Constraints**:
- Foreign Key: userId → PlatformUser.id (CASCADE)
- Foreign Key: createdById → PlatformUser.id

#### `TwoFactorRecoveryCode`
Backup codes for 2FA recovery.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| twoFactorAuthId | UUID | Foreign key to TwoFactorAuth |
| code | VARCHAR(255) | Hashed recovery code (UNIQUE) |
| used | BOOLEAN | Has code been used? |
| usedAt | TIMESTAMPTZ | When code was used |
| usedBy | TEXT | IP address or user agent |
| createdAt | TIMESTAMPTZ | Creation timestamp |

**Indexes**:
- PRIMARY: id
- UNIQUE: code
- INDEX: twoFactorAuthId
- INDEX: used

**Constraints**:
- Foreign Key: twoFactorAuthId → TwoFactorAuth.id (CASCADE)

#### `TwoFactorSession`
Temporary sessions during 2FA verification.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| userId | UUID | Foreign key to PlatformUser |
| sessionToken | VARCHAR(255) | Unique session token (UNIQUE) |
| verified | BOOLEAN | Has TOTP been verified? |
| ipAddress | VARCHAR(45) | IPv4 or IPv6 address |
| userAgent | TEXT | Browser user agent |
| expiresAt | TIMESTAMPTZ | Session expiration time |
| createdAt | TIMESTAMPTZ | Creation timestamp |

**Indexes**:
- PRIMARY: id
- UNIQUE: sessionToken
- INDEX: userId
- INDEX: verified
- INDEX: expiresAt

**Constraints**:
- Foreign Key: userId → PlatformUser.id (CASCADE)

### Supporting Tables

#### `PlatformUser`
Base user model for authentication.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| email | VARCHAR(255) | Email address (UNIQUE) |
| passwordHash | TEXT | Hashed password |
| globalRole | ENUM | SUPER_ADMIN or null |
| refreshTokenVersion | INT | For token rotation |
| isActive | BOOLEAN | Is user active? |
| createdAt | TIMESTAMPTZ | Creation timestamp |
| updatedAt | TIMESTAMPTZ | Last update |
| createdById | UUID | Who created this user |
| updatedById | UUID | Who last updated |
| deletedAt | TIMESTAMPTZ | Soft delete timestamp |

**Relations**:
- 1:1 to TwoFactorAuth
- 1:N to TwoFactorSession

## Migrations

All migrations are stored in `apps/api/prisma/migrations/` with numeric prefixes:

- `0001_init` - Initial schema
- `0002_refresh_token_version` - Add token refresh support
- `0003_normativo_compliance` - Add compliance standards
- `0004_ai_auditor` - Add audit engine
- `0005_document_content` - Add documents
- `0006_audit_log` - Add audit logs
- `0007_two_factor_auth` - Add 2FA tables
- `0008_notifications` - Add notifications
- `0009_webhooks` - Add webhooks
- `0010_fix_rls_tenant_isolation` - Add RLS policies

## Key Features

### Security

1. **Recovery Code Hashing**
   - Codes are hashed with SHA-256 before storage
   - Never stored in plaintext
   - Marked as used after validation

2. **Session Management**
   - 10-minute expiration by default
   - One-time use tokens
   - IP and User-Agent tracking
   - Automatic cleanup of expired sessions

3. **Audit Trail**
   - 2FA enabled/disabled timestamps
   - Admin who enabled 2FA tracked
   - Recovery code usage logged

### Performance

**Indexes for Query Optimization**:
```sql
-- Fast lookups
CREATE INDEX idx_twofa_userid ON "TwoFactorAuth"(userId);
CREATE INDEX idx_twofa_isenabled ON "TwoFactorAuth"(isEnabled);
CREATE INDEX idx_recovery_code ON "TwoFactorRecoveryCode"(used);
CREATE INDEX idx_session_userid ON "TwoFactorSession"(userId);
CREATE INDEX idx_session_expires ON "TwoFactorSession"(expiresAt);
```

## Database Operations

### Local Development

#### Start PostgreSQL Container
```bash
docker-compose up postgres
```

#### Connect to Database
```bash
psql postgresql://sgi:sgidev123@localhost:5432/sgi_dev
```

#### Run Migrations
```bash
cd apps/api
npm run prisma:migrate
```

#### Seed Test Data
```bash
cd apps/api
npm run seed:demo
```

### Production

#### Prerequisites
- PostgreSQL 14.x or newer
- Minimum 2GB RAM
- SSD storage recommended
- Daily backups configured

#### Connection String Format
```
postgresql://[user[:password]@][netloc][:port][/dbname][?param1=value1&...]
```

#### Environment Variables
```env
DATABASE_URL=postgresql://user:password@host:5432/dbname
DATABASE_POOL_MIN=5
DATABASE_POOL_MAX=20
```

## 2FA Implementation Details

### Secret Storage

TOTP secrets are stored as base32-encoded strings. In production:
- Consider field-level encryption (FLE)
- Use AWS Secrets Manager or HashiCorp Vault
- Rotate secrets regularly

### Recovery Codes

Generation example:
```typescript
// Generates 10 codes like: AAAA-BBBB
const codes = generateRecoveryCodes(userId, 10);
// Returns: ['A1B2-C3D4', 'E5F6-G7H8', ...]
```

### Session Flow

1. User logs in with email/password
2. Create TwoFactorSession (10 min expiration)
3. User verifies TOTP or recovery code
4. Mark session as verified
5. Issue JWT token
6. Cleanup expired sessions via cron

### Verification Flow

```
Login Request
  ↓
Check password
  ↓
Check 2FA enabled?
  ├─ No → Issue JWT
  └─ Yes → Create TwoFactorSession
         → Send TOTP prompt
         → User submits TOTP or recovery code
         → Verify token
         → Mark session verified
         → Issue JWT
```

## Maintenance Tasks

### Regular Cleanup
```sql
-- Delete expired 2FA sessions (runs daily)
DELETE FROM "TwoFactorSession"
WHERE "expiresAt" < CURRENT_TIMESTAMP;

-- Archive used recovery codes (runs monthly)
UPDATE "TwoFactorRecoveryCode"
SET archived = true
WHERE used = true AND "usedAt" < NOW() - INTERVAL '90 days';
```

### Performance Monitoring
```sql
-- Check table sizes
SELECT
  relname,
  pg_size_pretty(pg_total_relation_size(relid)) as size
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(relid) DESC;

-- Check slow queries
SELECT query, calls, mean_exec_time FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC;
```

## Disaster Recovery

### Backup Strategy

1. **Daily Full Backups**
   ```bash
   pg_dump -Fc postgresql://sgi:password@localhost/sgi_dev > backup.dump
   ```

2. **Point-in-Time Recovery**
   - Enable WAL archiving
   - Keep 7+ days of WAL files

3. **Backup Verification**
   ```bash
   pg_restore -l backup.dump | head
   ```

### Restore Procedure

```bash
# Stop application
docker-compose down

# Restore database
pg_restore -d sgi_dev -j 4 backup.dump

# Run migrations if needed
npm run prisma:migrate

# Start application
docker-compose up
```

## Troubleshooting

### Connection Issues
```bash
# Test connection
psql postgresql://sgi:sgidev123@localhost:5432/sgi_dev -c "SELECT 1"

# Check PostgreSQL logs
docker logs sgi360-postgres
```

### Migration Problems
```bash
# Reset database (⚠️ deletes all data)
npm run prisma:reset

# Manually run migrations
npm run prisma:migrate

# Check migration status
npx prisma migrate status
```

### Performance Issues
```sql
-- Analyze tables
ANALYZE "TwoFactorAuth";
ANALYZE "TwoFactorSession";

-- Reindex tables
REINDEX TABLE "TwoFactorAuth";
REINDEX TABLE "TwoFactorRecoveryCode";
```

## Next Steps

1. Enable field-level encryption for TOTP secrets
2. Implement database connection pooling (PgBouncer)
3. Set up automated backups with retention policies
4. Configure database monitoring and alerting
5. Implement database replication for HA
