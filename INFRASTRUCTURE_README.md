# Production Infrastructure Documentation

Complete index of production-ready infrastructure, deployment, and operational documentation for SGI 360 with 2FA support.

## Quick Navigation

### For New Deployments
1. Read: [PRODUCTION_READINESS_SUMMARY.md](./PRODUCTION_READINESS_SUMMARY.md) - Overview of what's ready
2. Follow: [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md) - Pre-deployment checklist
3. Execute: [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) - Detailed deployment steps

### For Troubleshooting
1. Check: [TROUBLESHOOTING_RUNBOOK.md](./TROUBLESHOOTING_RUNBOOK.md) - Quick diagnostics
2. Reference: [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md) - Config reference
3. Monitor: [MONITORING_GUIDE.md](./MONITORING_GUIDE.md) - Monitoring setup

## Documentation Structure

### Core Deployment Files

| File | Purpose | Audience |
|------|---------|----------|
| [PRODUCTION_READINESS_SUMMARY.md](./PRODUCTION_READINESS_SUMMARY.md) | Executive overview of production readiness | Leads, Decision Makers |
| [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md) | Pre-deployment checklist and procedures | Deployment Team |
| [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) | Step-by-step deployment instructions | DevOps, Engineers |
| [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md) | Complete configuration reference | All Team Members |

### Operational Files

| File | Purpose | Audience |
|------|---------|----------|
| [TROUBLESHOOTING_RUNBOOK.md](./TROUBLESHOOTING_RUNBOOK.md) | Quick fixes for common issues | On-Call, DevOps |
| [MONITORING_GUIDE.md](./MONITORING_GUIDE.md) | Monitoring and alerting setup | DevOps, SREs |

### Script Files

| Script | Purpose | Usage |
|--------|---------|-------|
| `scripts/deploy-production.sh` | Automated production deployment | `./scripts/deploy-production.sh` |
| `scripts/deploy-staging.sh` | Deploy to staging environment | `./scripts/deploy-staging.sh` |
| `scripts/health-check.sh` | Verify service health | `./scripts/health-check.sh` |
| `scripts/setup-database.sh` | Initialize database with migrations | `./scripts/setup-database.sh` |
| `scripts/backup-database.sh` | Create automated database backups | `./scripts/backup-database.sh` |

### Configuration Files

| File | Purpose |
|------|---------|
| `.env.example` | Template for environment variables |
| `.env.production` | Production environment config (create from example) |
| `.env.staging` | Staging environment config (provided) |
| `docker-compose.prod.yml` | Production Docker Compose configuration |
| `.github/workflows/2fa-tests.yml` | CI/CD pipeline automation |

## Deployment Overview

### Architecture

```
GitHub Push
    ↓
GitHub Actions CI/CD
    ├─ Unit Tests
    ├─ Type Check
    ├─ Linting
    ├─ Build
    ├─ E2E Tests
    ├─ Docker Build
    ├─ Push to Registry
    └─ Deploy (Staging/Prod)
         ├─ Pull Images
         ├─ Database Migrations
         ├─ Health Checks
         └─ Deployment Complete
```

### Deployment Triggers

| Branch | Action | Environment |
|--------|--------|-------------|
| `push: main` | Build & Test only | None (manual deployment) |
| `push: staging` | Build, Test, Deploy | Staging |
| `git tag: v*` | Build, Test (manual deployment) | None (manual) |

## Services

### API Service
- **Port**: 3001
- **Framework**: Fastify
- **Language**: TypeScript/Node.js
- **Health Check**: `GET /api/healthz`
- **Docs**: `GET /api/docs` (Swagger UI)

### Frontend Service
- **Port**: 3000
- **Framework**: Next.js
- **Language**: TypeScript/React
- **Health Check**: `GET /`

### Database Service
- **Port**: 5432
- **Type**: PostgreSQL 16
- **Volume**: `/var/lib/postgresql/data`
- **Health Check**: `pg_isready -U sgi`

### Cache Service
- **Port**: 6379
- **Type**: Redis 7
- **Volume**: `/data`
- **Health Check**: `redis-cli ping`

## Getting Started

### Prerequisites

- Docker 20.10+
- Docker Compose 2.0+
- Git 2.20+
- Bash 4.0+
- 8GB RAM minimum
- 20GB free disk space

### First-Time Setup

```bash
# 1. Clone repository
git clone <repo-url>
cd "SGI 360"

# 2. Create environment files
cp .env.example .env.production
# Edit .env.production with your values

# 3. Configure GitHub Secrets (in GitHub UI)
# Settings → Secrets and variables → Actions
# Add: DOCKER_REGISTRY, DOCKER_USERNAME, DOCKER_PASSWORD, etc.

# 4. Deploy to production
./scripts/deploy-production.sh

# 5. Verify deployment
./scripts/health-check.sh
```

## Monitoring & Alerts

### Health Checks

```bash
# Comprehensive health check
./scripts/health-check.sh

# Individual service checks
curl http://localhost:3001/api/healthz  # API
curl http://localhost:3000              # Frontend
docker-compose ps                        # Container status
```

### Metrics Available

- Request count and rates
- Response times (p50, p95, p99)
- Error rates by status code
- Database connection pool
- Redis cache hit rates
- Container resource usage

### Recommended Monitoring Stack

- **Metrics**: Prometheus + Grafana
- **Logs**: ELK Stack or CloudWatch
- **APM**: Datadog or New Relic
- **Errors**: Sentry
- **Status**: StatusPage.io

## Security

### Implemented Measures

✓ JWT-based authentication
✓ Two-factor authentication (TOTP + Backup Codes)
✓ Encrypted secrets at rest
✓ CORS properly configured
✓ Environment-based secrets
✓ Docker container isolation
✓ No hardcoded credentials

### Recommendations

- Enable SSL/TLS on Nginx (provided template)
- Implement rate limiting on auth endpoints
- Set up Web Application Firewall (WAF)
- Configure DDoS protection
- Enable audit logging
- Regular security scanning

## Database Management

### Backups

```bash
# Manual backup
./scripts/backup-database.sh

# Automated daily backups
# Configure in crontab: 0 2 * * * /path/to/backup-database.sh
```

### Migrations

Automatically run on deployment:
```bash
docker-compose -f docker-compose.prod.yml exec api npm run prisma:migrate
```

### Database Maintenance

```bash
# Vacuum database
docker-compose exec postgres psql -U sgi -d sgi_prod -c "VACUUM ANALYZE;"

# Check table sizes
docker-compose exec postgres psql -U sgi -d sgi_prod -c \
  "SELECT tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) FROM pg_tables WHERE schemaname='public';"
```

## Troubleshooting Quick Links

| Issue | Quick Fix | Details |
|-------|-----------|---------|
| Container exits | Check logs: `docker-compose logs api` | [TROUBLESHOOTING_RUNBOOK.md](./TROUBLESHOOTING_RUNBOOK.md#issue-1-api-container-exits-immediately) |
| Blank frontend | Verify API URL: `echo $NEXT_PUBLIC_API_URL` | [TROUBLESHOOTING_RUNBOOK.md](./TROUBLESHOOTING_RUNBOOK.md#issue-2-frontend-shows-blank-page) |
| 2FA not working | Check migrations: `npm run prisma:migrate` | [TROUBLESHOOTING_RUNBOOK.md](./TROUBLESHOOTING_RUNBOOK.md#issue-3-2fa-not-working) |
| High memory | Check docker stats: `docker stats` | [TROUBLESHOOTING_RUNBOOK.md](./TROUBLESHOOTING_RUNBOOK.md#issue-4-high-memory-usage) |
| DB connection errors | Test: `psql $DATABASE_URL -c "SELECT 1"` | [TROUBLESHOOTING_RUNBOOK.md](./TROUBLESHOOTING_RUNBOOK.md#issue-5-database-connection-pool-exhausted) |

## 2FA Implementation Details

### Features
- TOTP (Time-based One-Time Password)
- QR code generation for authenticator apps
- Backup codes for account recovery
- Secure secret storage
- Time window tolerance

### API Endpoints
```
POST   /api/auth/2fa/setup             - Initialize 2FA
POST   /api/auth/2fa/verify            - Verify TOTP code
POST   /api/auth/2fa/verify-backup     - Use backup code
GET    /api/auth/2fa/status            - Check 2FA status
DELETE /api/auth/2fa/disable           - Disable 2FA
```

### Database Tables
- `Users` - User accounts with 2FA status
- `TotpCodes` - TOTP secrets (encrypted)
- `BackupCodes` - Recovery codes (hashed)

## Useful Commands

### Deployment
```bash
./scripts/deploy-production.sh           # Deploy to production
./scripts/deploy-staging.sh              # Deploy to staging
./scripts/health-check.sh                # Verify health
./scripts/setup-database.sh              # Initialize database
./scripts/backup-database.sh             # Create backup
```

### Container Management
```bash
docker-compose -f docker-compose.prod.yml up -d              # Start services
docker-compose -f docker-compose.prod.yml down               # Stop services
docker-compose -f docker-compose.prod.yml ps                 # Status
docker-compose -f docker-compose.prod.yml logs -f api        # Follow logs
docker-compose -f docker-compose.prod.yml restart api        # Restart service
```

### Database Operations
```bash
docker-compose -f docker-compose.prod.yml exec postgres psql -U sgi -d sgi_prod
docker-compose -f docker-compose.prod.yml exec api npm run prisma:migrate
docker-compose -f docker-compose.prod.yml exec api npm run seed:all
```

### Monitoring
```bash
docker stats                             # Real-time stats
docker-compose logs --tail=100 api       # Recent logs
docker system df                         # Disk usage
curl http://localhost:3001/api/healthz  # API health
```

## Support & Resources

### Internal Documentation
- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) - Detailed deployment steps
- [TROUBLESHOOTING_RUNBOOK.md](./TROUBLESHOOTING_RUNBOOK.md) - Common issues and fixes
- [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md) - Configuration reference
- [MONITORING_GUIDE.md](./MONITORING_GUIDE.md) - Monitoring setup
- [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md) - Pre-deployment verification

### External Resources
- [Docker Documentation](https://docs.docker.com/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Redis Documentation](https://redis.io/documentation)
- [Fastify Documentation](https://www.fastify.io/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs/)

### Common Issues
See [TROUBLESHOOTING_RUNBOOK.md](./TROUBLESHOOTING_RUNBOOK.md) for:
- Container startup failures
- Database connection issues
- 2FA verification problems
- Memory and performance issues
- Email delivery failures
- Emergency procedures and rollback

## File Locations

All files are located in the project root:
```
/path/to/SGI\ 360/
├── INFRASTRUCTURE_README.md (this file)
├── PRODUCTION_READINESS_SUMMARY.md
├── PRODUCTION_CHECKLIST.md
├── DEPLOYMENT_GUIDE.md
├── ENVIRONMENT_VARIABLES.md
├── TROUBLESHOOTING_RUNBOOK.md
├── MONITORING_GUIDE.md
├── .env.example
├── .env.staging
├── .env.production (create from example)
├── docker-compose.prod.yml
├── scripts/
│   ├── deploy-production.sh
│   ├── deploy-staging.sh
│   ├── health-check.sh
│   ├── setup-database.sh
│   └── backup-database.sh
├── .github/workflows/
│   └── 2fa-tests.yml
├── apps/
│   ├── api/
│   │   ├── Dockerfile
│   │   └── ...
│   └── web/
│       ├── Dockerfile
│       └── ...
└── infra/
    ├── docker-compose.yml
    └── ...
```

## Checklist: Before You Deploy

- [ ] Read [PRODUCTION_READINESS_SUMMARY.md](./PRODUCTION_READINESS_SUMMARY.md)
- [ ] Follow [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md)
- [ ] Complete [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)
- [ ] Configure all variables in [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md)
- [ ] Set up monitoring per [MONITORING_GUIDE.md](./MONITORING_GUIDE.md)
- [ ] Bookmark [TROUBLESHOOTING_RUNBOOK.md](./TROUBLESHOOTING_RUNBOOK.md) for on-call

## Version Information

- **Documentation Version**: 1.0.0
- **Last Updated**: 2024-03-17
- **2FA Status**: ✓ Complete and Tested
- **Production Readiness**: ✓ Ready for Deployment

---

**Need help?** Start with [TROUBLESHOOTING_RUNBOOK.md](./TROUBLESHOOTING_RUNBOOK.md) or check the relevant section above.
