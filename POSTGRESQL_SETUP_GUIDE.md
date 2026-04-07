# PostgreSQL Setup Guide for SGI 360

## Quick Start

The easiest way to get started with PostgreSQL for SGI 360 is to use Docker Compose.

### Prerequisites

- Docker and Docker Compose installed
- Node.js 18+ and pnpm installed
- 4GB free disk space
- Port 5432 (PostgreSQL) and 6379 (Redis) available

### One-Command Setup

```bash
./scripts/setup-local-dev.sh
```

This script will:
1. Create `.env.local` with development credentials
2. Install all dependencies
3. Start PostgreSQL and Redis containers
4. Run all database migrations
5. Seed test data including 2FA
6. Start the API and Frontend servers

## Manual Setup

If you prefer to set up manually:

### 1. Start Database Containers

```bash
docker-compose up -d postgres redis
```

Wait for services to be ready:
```bash
docker-compose exec postgres pg_isready -U sgi -d sgi_dev
docker-compose exec redis redis-cli -a sgidev123 ping
```

### 2. Install Dependencies

```bash
pnpm install
cd apps/api
npm install
```

### 3. Generate Prisma Client

```bash
npm run prisma:generate
```

### 4. Run Migrations

```bash
npm run prisma:migrate
```

This creates all tables:
- `PlatformUser` - User accounts
- `TwoFactorAuth` - 2FA configuration
- `TwoFactorRecoveryCode` - Backup codes
- `TwoFactorSession` - Temporary verification sessions
- All other application tables

### 5. Seed Test Data

```bash
npm run seed:all
npm run seed:demo
npm run --env=local seed:2fa
```

Or use the helper script:
```bash
./scripts/seed-2fa.sh
```

### 6. Start Application

```bash
docker-compose up api web
```

Services will be available at:
- **Frontend**: http://localhost:3000
- **API**: http://localhost:3001
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

## Database Connection

### Connection String

Development:
```
postgresql://sgi:sgidev123@localhost:5432/sgi_dev
```

Docker containers:
```
postgresql://sgi:sgidev123@postgres:5432/sgi_dev
```

### Connection via psql

```bash
psql postgresql://sgi:sgidev123@localhost:5432/sgi_dev
```

Or through Docker:
```bash
docker-compose exec postgres psql -U sgi -d sgi_dev
```

## Common Operations

### View Database Status

```bash
docker-compose ps postgres
docker-compose logs postgres
```

### Access Database CLI

```bash
docker-compose exec postgres psql -U sgi -d sgi_dev
```

### Check 2FA Tables

```sql
-- In psql shell:
SELECT * FROM "TwoFactorAuth";
SELECT * FROM "TwoFactorRecoveryCode";
SELECT * FROM "TwoFactorSession";
```

### View Migrations

```bash
cd apps/api
npx prisma migrate status
npx prisma migrate resolve --applied <migration-name>
```

### Reset Everything

⚠️ **This deletes all data!**

```bash
./scripts/run-migrations.sh reset
```

Or manually:
```bash
cd apps/api
npm run prisma:reset
npm run seed:all
```

### Backup Database

```bash
docker-compose exec postgres pg_dump -U sgi sgi_dev > backup.sql
```

### Restore Database

```bash
docker-compose exec -T postgres psql -U sgi sgi_dev < backup.sql
```

### View Logs

```bash
# PostgreSQL logs
docker-compose logs postgres

# Prisma migration logs
cd apps/api
npm run prisma:migrate
```

## Database Schema

### 2FA Tables

#### TwoFactorAuth
```sql
CREATE TABLE "TwoFactorAuth" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  userId UUID UNIQUE NOT NULL REFERENCES "PlatformUser"(id) ON DELETE CASCADE,
  secret TEXT NOT NULL,
  qrCodeUrl TEXT,
  isEnabled BOOLEAN DEFAULT FALSE,
  isConfirmed BOOLEAN DEFAULT FALSE,
  createdAt TIMESTAMPTZ DEFAULT NOW(),
  enabledAt TIMESTAMPTZ,
  disabledAt TIMESTAMPTZ,
  createdById UUID REFERENCES "PlatformUser"(id)
);

CREATE INDEX idx_twofa_userid ON "TwoFactorAuth"(userId);
CREATE INDEX idx_twofa_isenabled ON "TwoFactorAuth"(isEnabled);
```

#### TwoFactorRecoveryCode
```sql
CREATE TABLE "TwoFactorRecoveryCode" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  twoFactorAuthId UUID NOT NULL REFERENCES "TwoFactorAuth"(id) ON DELETE CASCADE,
  code VARCHAR(255) UNIQUE NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  usedAt TIMESTAMPTZ,
  usedBy TEXT,
  createdAt TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_recovery_twoFactorAuthId ON "TwoFactorRecoveryCode"(twoFactorAuthId);
CREATE INDEX idx_recovery_used ON "TwoFactorRecoveryCode"(used);
CREATE INDEX idx_recovery_code ON "TwoFactorRecoveryCode"(code);
```

#### TwoFactorSession
```sql
CREATE TABLE "TwoFactorSession" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  userId UUID NOT NULL REFERENCES "PlatformUser"(id) ON DELETE CASCADE,
  sessionToken VARCHAR(255) UNIQUE NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  ipAddress VARCHAR(45),
  userAgent TEXT,
  expiresAt TIMESTAMPTZ NOT NULL,
  createdAt TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_session_userId ON "TwoFactorSession"(userId);
CREATE INDEX idx_session_verified ON "TwoFactorSession"(verified);
CREATE INDEX idx_session_expires ON "TwoFactorSession"(expiresAt);
CREATE INDEX idx_session_sessionToken ON "TwoFactorSession"(sessionToken);
```

## Environment Variables

### Database Configuration

```env
# Connection
DATABASE_URL=postgresql://sgi:sgidev123@localhost:5432/sgi_dev

# Credentials
DB_USER=sgi
DB_PASSWORD=sgidev123
DB_NAME=sgi_dev
DB_PORT=5432
```

### Connection Pooling

For production, consider these settings:
```env
DATABASE_URL_POOL=postgresql://sgi:password@localhost:5432/sgi_dev?sslmode=require&connection_limit=20
DATABASE_POOL_MIN=5
DATABASE_POOL_MAX=20
```

## Troubleshooting

### Connection Refused

```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# View PostgreSQL logs
docker-compose logs postgres

# Try to connect
docker-compose exec postgres pg_isready -U sgi -d sgi_dev
```

### Port Already in Use

```bash
# Find process using port 5432
lsof -i :5432

# Or use a different port:
docker-compose down
# Edit docker-compose.yml, change DB_PORT
docker-compose up -d postgres
```

### Migration Conflicts

```bash
# Reset to clean state
cd apps/api
npm run prisma:reset

# Check migration status
npx prisma migrate status

# Manually resolve
npx prisma migrate resolve --applied migration_name
```

### Slow Queries

```bash
# Enable query logging
docker-compose down
# Add to docker-compose.yml postgres command:
# - "-c"
# - "log_min_duration_statement=100"
docker-compose up postgres

# Then check logs
docker-compose logs postgres
```

### Out of Disk Space

```bash
# Clean up Docker volumes
docker-compose down -v
docker system prune -a --volumes

# Restart
docker-compose up -d postgres
```

## Performance Optimization

### Connection Pooling

Use PgBouncer for production:
```bash
docker run -d --name pgbouncer \
  -e DATABASES_HOST=postgres \
  -e DATABASES_PORT=5432 \
  -e DATABASES_USER=sgi \
  -e DATABASES_PASSWORD=sgidev123 \
  -e DATABASES_DBNAME=sgi_dev \
  -p 6432:6432 \
  edoburu/pgbouncer
```

### Index Optimization

```sql
-- Check missing indexes
SELECT schemaname, tablename, indexname
FROM pg_indexes
ORDER BY tablename, indexname;

-- Analyze table for query planning
ANALYZE "TwoFactorAuth";
ANALYZE "TwoFactorSession";

-- Reindex if needed
REINDEX INDEX CONCURRENTLY idx_session_expires;
```

### Table Statistics

```sql
-- Update statistics (PostgreSQL optimizer needs accurate stats)
ANALYZE;

-- View table sizes
SELECT
  relname,
  pg_size_pretty(pg_total_relation_size(relid)) as size
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(relid) DESC;
```

## Security Considerations

### Production Database

1. **Change Default Password**
   ```sql
   ALTER USER sgi WITH PASSWORD 'strong-password-here';
   ```

2. **Enable SSL**
   ```env
   DATABASE_URL=postgresql://sgi:password@host:5432/sgi?sslmode=require
   ```

3. **Restrict Network Access**
   ```yaml
   # In docker-compose.yml
   ports:
     - "127.0.0.1:5432:5432"  # Only local access
   ```

4. **Enable Row-Level Security (RLS)**
   ```bash
   npm run prisma:migrate
   # RLS policies already configured in migrations
   ```

5. **Backup Strategy**
   ```bash
   # Daily backups
   0 2 * * * docker-compose exec -T postgres pg_dump -U sgi sgi_dev > /backups/sgi_$(date +\%Y\%m\%d).sql
   ```

## Useful SQL Queries

### Check 2FA Status

```sql
-- Users with 2FA enabled
SELECT
  u.email,
  t.isEnabled,
  t.isConfirmed,
  t.enabledAt,
  COUNT(r.id) as recovery_codes_total,
  SUM(CASE WHEN r.used THEN 1 ELSE 0 END) as recovery_codes_used
FROM "PlatformUser" u
LEFT JOIN "TwoFactorAuth" t ON u.id = t.userId
LEFT JOIN "TwoFactorRecoveryCode" r ON t.id = r.twoFactorAuthId
WHERE t.isEnabled = true
GROUP BY u.id, t.id;
```

### Find Expired Sessions

```sql
SELECT
  u.email,
  s.sessionToken,
  s.expiresAt,
  NOW() - s.expiresAt as expired_for
FROM "TwoFactorSession" s
JOIN "PlatformUser" u ON s.userId = u.id
WHERE s.expiresAt < NOW()
ORDER BY s.expiresAt DESC;
```

### Monitor Database Growth

```sql
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

## Getting Help

- Check logs: `docker-compose logs -f`
- Review schema: `DATABASE_SCHEMA.md`
- Check migrations: `apps/api/prisma/migrations/`
- Prisma docs: https://www.prisma.io/docs/
- PostgreSQL docs: https://www.postgresql.org/docs/

## Next Steps

1. ✓ Setup PostgreSQL locally
2. ✓ Run migrations
3. ✓ Seed test data
4. → Start development
5. → Configure backups for production
6. → Setup monitoring and alerting
