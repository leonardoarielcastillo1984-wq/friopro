# SGI 360 Production Deployment Guide

## Overview

This guide covers the complete deployment process for the SGI 360 application with 2FA implementation. The deployment is fully automated using Docker and Docker Compose with a comprehensive CI/CD pipeline via GitHub Actions.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Pre-Deployment Preparation](#pre-deployment-preparation)
3. [Local Development Deployment](#local-development-deployment)
4. [Staging Deployment](#staging-deployment)
5. [Production Deployment](#production-deployment)
6. [Post-Deployment Verification](#post-deployment-verification)
7. [Monitoring & Maintenance](#monitoring--maintenance)
8. [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements

- Docker 20.10+ ([Install Docker](https://docs.docker.com/get-docker/))
- Docker Compose 2.0+ (included with Docker Desktop)
- Git 2.20+
- Bash 4.0+
- curl (for health checks)
- 8GB minimum RAM, 20GB free disk space

### Required Accounts & Credentials

- Docker registry access (Azure Container Registry, Docker Hub, etc.)
- AWS account (for S3 uploads) - optional but recommended
- Email service (Gmail, Resend, SendGrid)
- GitHub account with deploy keys configured

### Environment Setup

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd SGI\ 360
   ```

2. **Create environment files:**
   ```bash
   # Copy example to create actual environment files
   cp .env.example .env.production
   cp .env.example .env.staging
   ```

3. **Configure secrets in GitHub:**
   Go to GitHub repository → Settings → Secrets and variables → Actions
   Add the following secrets:
   - `DOCKER_REGISTRY` - Container registry URL
   - `DOCKER_USERNAME` - Registry username
   - `DOCKER_PASSWORD` - Registry password
   - `DATABASE_URL_TEST` - Test database connection string
   - `JWT_SECRET_TEST` - Test JWT secret
   - `SLACK_WEBHOOK` - Slack webhook for notifications
   - `DEPLOY_KEY_STAGING` - SSH private key for staging
   - `DEPLOY_HOST_STAGING` - Staging server hostname
   - `DEPLOY_USER_STAGING` - Staging server username

## Pre-Deployment Preparation

### 1. Validate Environment Files

```bash
# Production
cat .env.production

# Staging
cat .env.staging
```

**Required variables checklist:**
- ✓ `JWT_SECRET` (minimum 32 characters)
- ✓ `DATABASE_URL` (valid PostgreSQL connection string)
- ✓ `REDIS_URL` (valid Redis connection string)
- ✓ `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`
- ✓ `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
- ✓ `API_URL`, `FRONTEND_URL`

### 2. Database Preparation

```bash
# Create database backups (production only)
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d-%H%M%S).sql

# Verify database connectivity
psql $DATABASE_URL -c "SELECT 1"
```

### 3. Security Checks

```bash
# Verify no secrets in code
git grep -i "password\|secret\|token" -- '*.ts' '*.tsx' '*.js' || true

# Check for hardcoded credentials
grep -r "hardcoded\|placeholder" . --include="*.md" --include="*.env*" || true
```

## Local Development Deployment

### Quick Start (Development with Hot Reload)

```bash
# Install dependencies
pnpm install

# Start development servers
pnpm dev

# In another terminal, start databases
docker-compose -f infra/docker-compose.yml up -d postgres redis

# Run database migrations
cd apps/api && npm run prisma:migrate

# Access the application
# Frontend: http://localhost:3000
# API: http://localhost:3001
# API Docs: http://localhost:3001/api/docs
```

### Docker Compose (Development)

```bash
# Build images
docker-compose -f infra/docker-compose.yml build

# Start all services
docker-compose -f infra/docker-compose.yml up -d

# Check service status
docker-compose -f infra/docker-compose.yml ps

# View logs
docker-compose -f infra/docker-compose.yml logs -f api

# Stop services
docker-compose -f infra/docker-compose.yml down
```

## Staging Deployment

### Automated GitHub Actions Deployment

When you push to the `staging` branch, GitHub Actions automatically:
1. Runs all tests and linting
2. Builds Docker images
3. Pushes images to registry
4. Deploys to staging environment
5. Runs migrations
6. Sends Slack notification

### Manual Staging Deployment

```bash
# Make executable
chmod +x scripts/deploy-staging.sh

# Deploy to staging
./scripts/deploy-staging.sh
```

## Production Deployment

### Pre-Production Checklist

Before deploying to production:

- [ ] All tests passing on main branch
- [ ] Code reviewed and approved
- [ ] Changelog updated
- [ ] Database backup created
- [ ] Monitoring/alerting configured
- [ ] Runbook prepared
- [ ] Team notified
- [ ] Maintenance window scheduled (if needed)

### Automated GitHub Actions Deployment

1. **Create a release on GitHub:**
   ```bash
   git tag -a v1.0.0 -m "Production release v1.0.0"
   git push origin v1.0.0
   ```

2. **GitHub Actions will:**
   - Build and test the release
   - Build Docker images
   - Push images with version tag
   - Can optionally trigger production deployment (configure webhook)

### Manual Production Deployment

```bash
# Make executable
chmod +x scripts/deploy-production.sh

# Prepare environment
export API_TAG=v1.0.0
export WEB_TAG=v1.0.0

# Deploy (this will ask for confirmation)
./scripts/deploy-production.sh
```

**The script will:**
1. Verify all requirements
2. Pull Docker images
3. Start services
4. Run database migrations
5. Verify health checks
6. Display deployment summary

### Deployment Steps Breakdown

```bash
# Step 1: Environment validation
# The script checks .env.production exists and has required vars

# Step 2: Docker authentication
docker login -u <username> -p <password> <registry>

# Step 3: Pull images
docker pull sgi-api:production
docker pull sgi-frontend:production

# Step 4: Start services
docker-compose -f docker-compose.prod.yml up -d

# Step 5: Migrate database
docker-compose -f docker-compose.prod.yml exec api npm run prisma:migrate

# Step 6: Verify health
curl http://localhost:3001/api/healthz
curl http://localhost:3000
```

## Post-Deployment Verification

### Automated Health Checks

```bash
# Run comprehensive health checks
chmod +x scripts/health-check.sh
./scripts/health-check.sh

# Output:
# ✓ Database container is running
# ✓ Redis container is running
# ✓ API Health Check is healthy
# ✓ API Documentation is healthy
# ✓ Frontend is healthy
```

### Manual Verification Steps

```bash
# 1. Check service status
docker-compose -f docker-compose.prod.yml ps

# 2. Verify API endpoints
curl -s http://localhost:3001/api/healthz | jq .

# 3. Check frontend
curl -s http://localhost:3000 | head -20

# 4. Review logs
docker-compose -f docker-compose.prod.yml logs --tail=50 api
docker-compose -f docker-compose.prod.yml logs --tail=50 web

# 5. Test 2FA functionality
# Navigate to http://localhost:3000/auth/setup-2fa
# Verify QR code generation and TOTP validation

# 6. Test email notifications
# Check SMTP configuration and test email delivery
curl -X POST http://localhost:3001/api/test-email \
  -H "Content-Type: application/json" \
  -d '{"to":"test@example.com"}'
```

### Database Validation

```bash
# Connect to database
psql $DATABASE_URL

# Check migrations applied
SELECT * FROM "_prisma_migrations" ORDER BY "executedAt" DESC;

# Verify tables created
\dt

# Check 2FA-related tables
SELECT * FROM pg_tables WHERE tablename LIKE '%totp%' OR tablename LIKE '%2fa%';
```

## Monitoring & Maintenance

### Container Logs

```bash
# API logs
docker-compose -f docker-compose.prod.yml logs -f api --tail=100

# Frontend logs
docker-compose -f docker-compose.prod.yml logs -f web --tail=100

# All services
docker-compose -f docker-compose.prod.yml logs -f --tail=50
```

### Resource Monitoring

```bash
# Real-time container stats
docker stats

# Detailed container info
docker inspect <container-id>

# Disk usage
docker system df

# Prune unused resources
docker system prune
```

### Database Maintenance

```bash
# Backup database
pg_dump $DATABASE_URL | gzip > backup-$(date +%Y%m%d).sql.gz

# Check database size
psql $DATABASE_URL -c "SELECT pg_database.datname,
  pg_size_pretty(pg_database_size(pg_database.datname)) AS size
  FROM pg_database ORDER BY pg_database_size(pg_database.datname) DESC;"

# Optimize database
psql $DATABASE_URL -c "VACUUM ANALYZE;"
```

### Clearing Cache

```bash
# Clear Redis cache
docker-compose -f docker-compose.prod.yml exec redis redis-cli FLUSHALL

# Clear browser cache (frontend config)
# Update NEXT_PUBLIC_CACHE_VERSION in .env
```

## Troubleshooting

### Service Won't Start

```bash
# Check container status
docker-compose -f docker-compose.prod.yml ps

# View detailed logs
docker-compose -f docker-compose.prod.yml logs api

# Restart specific service
docker-compose -f docker-compose.prod.yml restart api

# Remove and recreate
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d
```

### Database Connection Issues

```bash
# Test connection
psql $DATABASE_URL -c "SELECT 1"

# Check network connectivity
docker-compose -f docker-compose.prod.yml exec api curl postgres:5432

# Verify environment variables
docker-compose -f docker-compose.prod.yml exec api env | grep DATABASE

# Check Prisma schema
cat apps/api/prisma/schema.prisma | grep -A5 "datasource db"
```

### API Not Responding

```bash
# Check if API is listening
docker-compose -f docker-compose.prod.yml exec api netstat -tlnp | grep 3001

# Test from container
docker-compose -f docker-compose.prod.yml exec api curl http://localhost:3001/api/healthz

# Check logs for errors
docker-compose -f docker-compose.prod.yml logs api | grep ERROR
```

### 2FA Not Working

```bash
# Check 2FA service in logs
docker-compose -f docker-compose.prod.yml logs api | grep -i "totp\|2fa\|mfa"

# Verify database tables
psql $DATABASE_URL -c "\dt *totp*"

# Check Redis cache
docker-compose -f docker-compose.prod.yml exec redis redis-cli KEYS "*2fa*"

# Review recent migrations
psql $DATABASE_URL -c "SELECT * FROM \"_prisma_migrations\" WHERE description LIKE '%2fa%';"
```

### High Memory Usage

```bash
# Check memory usage
docker stats

# Check for memory leaks
docker-compose -f docker-compose.prod.yml logs api | grep -i "memory\|heap"

# Restart service
docker-compose -f docker-compose.prod.yml restart api

# Scale down if needed
docker-compose -f docker-compose.prod.yml down api
docker-compose -f docker-compose.prod.yml up -d --scale api=2
```

## Rollback Procedure

### Quick Rollback

```bash
# Rollback to previous version
export API_TAG=v1.0.0  # Previous version
export WEB_TAG=v1.0.0

# Restart with previous images
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d

# Verify
./scripts/health-check.sh
```

### Database Rollback

```bash
# List available backups
ls -lh backup-*.sql.gz

# Restore from backup
gunzip -c backup-20240101.sql.gz | psql $DATABASE_URL

# Verify restoration
psql $DATABASE_URL -c "SELECT COUNT(*) FROM users;"
```

## Useful Commands

```bash
# View all secrets in use
grep -r "process.env\." apps --include="*.ts" --include="*.tsx" | sort -u

# Generate secure tokens
openssl rand -base64 32

# Check certificate expiration (if using SSL)
openssl x509 -in ssl/cert.pem -noout -dates

# Monitor in real-time
watch -n 2 'docker-compose -f docker-compose.prod.yml ps'

# Backup environment
tar czf env-backup-$(date +%Y%m%d).tar.gz .env.production .env.staging
```

## Support & Escalation

For issues not covered here:

1. Check application logs: `docker-compose logs api web`
2. Review GitHub Actions workflow: `.github/workflows/2fa-tests.yml`
3. Consult Prisma documentation: `https://www.prisma.io/docs/`
4. Check 2FA implementation: `apps/api/src/services/TwoFactorService.ts`

## Change Log

- **v1.0.0** (2024-03-17) - Initial production deployment guide with 2FA support

---

For more information, see:
- [Environment Variables Documentation](./ENVIRONMENT_VARIABLES.md)
- [Monitoring Guide](./MONITORING_GUIDE.md)
- [Troubleshooting Runbook](./TROUBLESHOOTING_RUNBOOK.md)
