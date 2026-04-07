# SGI 360 PostgreSQL - Quick Reference Card

## Get Started in 30 Seconds

```bash
./scripts/setup-local-dev.sh
# Wait 2-3 minutes...
# Access: http://localhost:3000
```

## URLs & Access

| Service | URL | Credentials |
|---------|-----|-------------|
| Frontend | http://localhost:3000 | N/A |
| API | http://localhost:3001 | N/A |
| PostgreSQL | localhost:5432 | sgi / sgidev123 |
| Redis | localhost:6379 | password: sgidev123 |
| PgAdmin* | http://localhost:5050 | N/A (if installed) |

*Not included in docker-compose.yml, optional to add

## Common Commands

### Setup & Migrations

```bash
# Complete setup (one command)
./scripts/setup-local-dev.sh

# Run migrations only
./scripts/run-migrations.sh migrate

# Reset database (⚠️ deletes data)
./scripts/run-migrations.sh reset

# Seed 2FA test data
./scripts/seed-2fa.sh

# Check migration status
./scripts/run-migrations.sh status
```

### Docker Management

```bash
# Start services
docker-compose up -d

# Start specific service
docker-compose up -d postgres

# View logs (all services)
docker-compose logs -f

# View logs (single service)
docker-compose logs -f api
docker-compose logs -f postgres

# Stop services
docker-compose stop

# Stop and remove containers
docker-compose down

# Full cleanup (removes volumes too!)
docker-compose down -v
```

### Database Access

```bash
# Connect via psql
psql postgresql://sgi:sgidev123@localhost:5432/sgi_dev

# Through Docker
docker-compose exec postgres psql -U sgi -d sgi_dev

# Run SQL command
psql postgresql://sgi:sgidev123@localhost:5432/sgi_dev -c "SELECT * FROM \"PlatformUser\";"
```

### API Testing

```bash
# Health check
curl http://localhost:3001/api/healthz

# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@sgi360.local","password":"..."}'

# Setup 2FA
curl -X POST http://localhost:3001/api/2fa/setup \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json"

# Verify 2FA
curl -X POST http://localhost:3001/api/2fa/verify \
  -H "Content-Type: application/json" \
  -d '{"sessionToken":"...","totpToken":"123456"}'
```

### Development Workflow

```bash
# Install dependencies
pnpm install

# Start development servers
npm run dev

# Build for production
npm run build

# Run tests
npm run test

# Linting
npm run lint
```

## Directory Structure

```
SGI 360/
├── docker-compose.yml              # Main config
├── .env.local                       # Dev environment
├── DATABASE_*.md                    # Documentation
├── scripts/
│   ├── setup-local-dev.sh          # One-command setup
│   ├── run-migrations.sh           # Migration management
│   └── seed-2fa.sh                 # Seed 2FA data
└── apps/
    ├── api/                        # Backend
    │   ├── prisma/
    │   │   ├── schema.prisma       # Database schema
    │   │   └── migrations/         # Migration files
    │   └── src/
    │       ├── services/twoFactorAuth.ts
    │       └── routes/twoFactorAuth.ts
    └── web/                        # Frontend
```

## Test Data

After running setup script:

```
Email: test-2fa@sgi360.local
Password: (see seedUsers.ts)
2FA Enabled: Yes
TOTP Secret: JBSWY3DPEBLW64TMMQ======
Recovery Codes: 10 generated
```

Use TOTP secret in authenticator app (Google Authenticator, Authy, etc.)

## Environment Variables

Key variables in `.env.local`:

```env
# Database
DATABASE_URL=postgresql://sgi:sgidev123@localhost:5432/sgi_dev

# Redis
REDIS_URL=redis://:sgidev123@localhost:6379

# JWT
JWT_SECRET=dev-secret-key-min-32-chars

# URLs
API_URL=http://localhost:3001
FRONTEND_URL=http://localhost:3000

# 2FA
TWO_FA_ISSUER=SGI360-Dev
TWO_FA_BACKUP_CODES_COUNT=10
```

## Database Tables (2FA)

```sql
-- Check if 2FA is enabled
SELECT email, isEnabled FROM "PlatformUser" p
LEFT JOIN "TwoFactorAuth" t ON p.id = t.userId;

-- View recovery codes
SELECT * FROM "TwoFactorRecoveryCode" WHERE used = false;

-- View active sessions
SELECT * FROM "TwoFactorSession" WHERE expiresAt > NOW();

-- Cleanup expired sessions
DELETE FROM "TwoFactorSession" WHERE expiresAt < NOW();
```

## Troubleshooting Checklist

### Services won't start
- [ ] Docker installed and running: `docker info`
- [ ] Ports available: `lsof -i :5432 :6379 :3001 :3000`
- [ ] Check logs: `docker-compose logs`

### Database connection errors
- [ ] Check .env.local is created
- [ ] Verify DATABASE_URL is correct
- [ ] Test: `psql postgresql://sgi:sgidev123@localhost:5432/sgi_dev`
- [ ] View logs: `docker-compose logs postgres`

### Migrations fail
- [ ] Check status: `./scripts/run-migrations.sh status`
- [ ] View errors: `cd apps/api && npm run prisma:migrate`
- [ ] Reset if needed: `./scripts/run-migrations.sh reset`

### Port conflicts
- [ ] Find process: `lsof -i :5432`
- [ ] Kill process: `kill -9 <PID>`
- [ ] Or change port in docker-compose.yml

### Database is locked
- [ ] Check running processes: `docker-compose logs postgres`
- [ ] Restart service: `docker-compose restart postgres`
- [ ] Full reset: `docker-compose down -v && docker-compose up -d`

## Documentation Files

| File | Purpose |
|------|---------|
| DATABASE_README.md | Complete overview |
| DATABASE_SCHEMA.md | Table and column details |
| POSTGRESQL_SETUP_GUIDE.md | Setup instructions |
| DATABASE_INTEGRATION_GUIDE.md | Backend integration |
| POSTGRES_IMPLEMENTATION_SUMMARY.md | What was implemented |
| QUICK_REFERENCE.md | This file |

## 2FA Flow (Quick)

### Setup
```
User clicks "Enable 2FA"
  ↓
Backend generates TOTP secret
  ↓
User scans QR code
  ↓
User enters 6-digit code to confirm
  ↓
Backend generates 10 recovery codes
  ↓
User saves recovery codes securely
```

### Login
```
User enters email/password
  ↓
Check if 2FA enabled?
  ├─ No → Issue JWT token
  └─ Yes → Create temporary session
       User enters TOTP code
       Verify code
       Issue JWT token
```

### Recovery
```
User loses authenticator app
  ↓
User enters recovery code instead of TOTP
  ↓
Code is marked as used
  ↓
User can request new codes
```

## Performance Tips

- Use indexes: Already configured on userId, isEnabled, expiresAt
- Clean up sessions regularly: `DELETE FROM "TwoFactorSession" WHERE expiresAt < NOW()`
- Monitor slow queries: Check API logs for query duration
- Analyze tables: `ANALYZE` in psql for query planning

## Security Checklist

- [ ] Use strong passwords for production DB
- [ ] Enable SSL for connections in production
- [ ] Rotate JWT_SECRET regularly
- [ ] Backup database daily
- [ ] Review audit logs regularly
- [ ] Update dependencies: `npm audit fix`
- [ ] Enable Row-Level Security (RLS)
- [ ] Restrict database network access

## Useful Shortcuts

```bash
# Quick database connection
alias sgidb='docker-compose exec postgres psql -U sgi -d sgi_dev'

# Quick logs
alias sgilog='docker-compose logs -f api'

# Quick restart
alias sgirestart='docker-compose restart api postgres'

# Then use:
sgidb              # Connect to database
sgilog             # View API logs
sgirestart         # Restart services
```

## Monitoring Commands

```bash
# Check all containers
docker-compose ps

# View resource usage
docker stats

# Check specific container
docker-compose top postgres

# View network
docker network ls

# Inspect containers
docker-compose exec postgres \
  pg_stat_statements
```

## Backup & Restore

```bash
# Backup
docker-compose exec -T postgres pg_dump -U sgi sgi_dev > backup.sql

# Restore
docker-compose exec -T postgres psql -U sgi sgi_dev < backup.sql

# Backup to custom format
docker-compose exec -T postgres pg_dump -Fc -U sgi sgi_dev > backup.dump

# Restore from custom format
docker-compose exec -T postgres pg_restore -d sgi_dev -U sgi backup.dump
```

## Key Files to Know

```
.env.local                    # Development config (generated)
docker-compose.yml            # Container orchestration
apps/api/prisma/schema.prisma # Database schema
apps/api/src/services/twoFactorAuth.ts    # 2FA logic
apps/api/src/routes/twoFactorAuth.ts      # 2FA endpoints
```

## Getting Help

1. Check logs: `docker-compose logs -f`
2. Read docs: Open DATABASE_*.md files
3. Check status: `docker-compose ps`
4. Test connection: `psql postgresql://sgi:sgidev123@localhost:5432/sgi_dev`

## Quick Links

- **Setup**: `./scripts/setup-local-dev.sh`
- **Main Docs**: `DATABASE_README.md`
- **Schema**: `DATABASE_SCHEMA.md`
- **Integration**: `DATABASE_INTEGRATION_GUIDE.md`
- **Troubleshooting**: `POSTGRESQL_SETUP_GUIDE.md` (section)

---

**Remember**: After running the setup script, everything is ready to go!
Access http://localhost:3000 and start developing.
