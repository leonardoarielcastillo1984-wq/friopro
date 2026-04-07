# Troubleshooting Runbook

Quick reference guide for diagnosing and fixing common issues in production.

## Table of Contents

1. [Quick Diagnostics](#quick-diagnostics)
2. [Common Issues](#common-issues)
3. [Emergency Procedures](#emergency-procedures)
4. [Performance Issues](#performance-issues)
5. [Security Issues](#security-issues)

## Quick Diagnostics

### Health Check Dashboard

```bash
# Run comprehensive health check
./scripts/health-check.sh

# Expected output:
# ✓ Database container is running
# ✓ Redis container is running
# ✓ API Health Check is healthy
# ✓ API Documentation is healthy
# ✓ Frontend is healthy
# All health checks passed!
```

### Service Status

```bash
# Check all containers
docker-compose -f docker-compose.prod.yml ps

# Check specific service
docker-compose -f docker-compose.prod.yml ps api

# Expected status: "Up (healthy)" for all services
```

### Log Analysis

```bash
# Get recent logs from API
docker-compose -f docker-compose.prod.yml logs api --tail=50

# Get recent logs from Frontend
docker-compose -f docker-compose.prod.yml logs web --tail=50

# Follow logs in real-time
docker-compose -f docker-compose.prod.yml logs -f api
```

---

## Common Issues

### Issue 1: "API Container Exits Immediately"

**Symptoms:**
- Container shows status "Exited (1)" or similar
- Health check fails immediately

**Diagnosis:**
```bash
docker-compose -f docker-compose.prod.yml logs api | tail -100
```

**Common Causes & Fixes:**

#### Cause A: Missing Environment Variables
```bash
# Check if all required vars are set
docker-compose -f docker-compose.prod.yml config | grep -A20 "api:"

# Fix: Update .env.production with all required variables
# Required: DATABASE_URL, REDIS_URL, JWT_SECRET
nano .env.production

# Restart
docker-compose -f docker-compose.prod.yml restart api
```

#### Cause B: Database Connection Failed
```bash
# Check database is running and healthy
docker-compose -f docker-compose.prod.yml ps postgres

# Test connection from API container
docker-compose -f docker-compose.prod.yml exec api psql \
  "$DATABASE_URL" -c "SELECT 1;"

# Fix: Verify DATABASE_URL format
# Format: postgresql://user:password@host:port/dbname
echo "Current: $DATABASE_URL"

# Restart
docker-compose -f docker-compose.prod.yml restart postgres api
```

#### Cause C: Migrations Failed
```bash
# Check migrations
docker-compose -f docker-compose.prod.yml exec api \
  npm run prisma:migrate

# Check migration status
docker-compose -f docker-compose.prod.yml exec api \
  npx prisma migrate status

# Fix: Reset and re-run migrations (dev/staging only!)
docker-compose -f docker-compose.prod.yml exec api \
  npm run prisma:reset
```

---

### Issue 2: "Frontend Shows Blank Page"

**Symptoms:**
- Frontend loads but displays nothing
- Browser console shows 404 or CORS errors
- API_URL is wrong or unavailable

**Diagnosis:**
```bash
# Check frontend logs
docker-compose -f docker-compose.prod.yml logs web

# Check browser console (F12)
# Look for: Failed to fetch, 404, CORS error

# Test API connectivity from frontend container
docker-compose -f docker-compose.prod.yml exec web \
  curl "$NEXT_PUBLIC_API_URL/api/healthz"
```

**Fixes:**

```bash
# 1. Verify API is accessible
curl -s http://localhost:3001/api/healthz | jq .

# 2. Check NEXT_PUBLIC_API_URL matches API_URL
grep "API_URL" .env.production

# 3. Verify CORS configuration
curl -i -X OPTIONS http://localhost:3001/api/users \
  -H "Origin: http://localhost:3000"

# 4. If API_URL is wrong, update and rebuild
docker-compose -f docker-compose.prod.yml down web
export NEXT_PUBLIC_API_URL="https://correct-api-url.com"
docker-compose -f docker-compose.prod.yml up -d web
```

---

### Issue 3: "2FA Not Working / QR Code Fails"

**Symptoms:**
- QR code doesn't appear on setup page
- TOTP validation always fails
- Backup codes not generating

**Diagnosis:**
```bash
# Check 2FA database tables
docker-compose -f docker-compose.prod.yml exec postgres psql \
  -U sgi -d sgi_prod -c "
  SELECT tablename FROM pg_tables
  WHERE tablename LIKE '%totp%' OR tablename LIKE '%backup%';"

# Check recent migrations
docker-compose -f docker-compose.prod.yml exec postgres psql \
  -U sgi -d sgi_prod -c "
  SELECT description, executed_at
  FROM \"_prisma_migrations\"
  ORDER BY executed_at DESC LIMIT 5;"

# Check logs for 2FA errors
docker-compose -f docker-compose.prod.yml logs api | grep -i "totp\|2fa\|mfa"

# Test 2FA API endpoint
curl -X POST http://localhost:3001/api/auth/2fa/setup \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

**Fixes:**

```bash
# 1. Verify migrations were applied
docker-compose -f docker-compose.prod.yml exec api \
  npx prisma migrate status

# 2. If missing, run migrations
docker-compose -f docker-compose.prod.yml exec api \
  npm run prisma:migrate

# 3. Check TwoFactorService is loaded
docker-compose -f docker-compose.prod.yml logs api | \
  grep "TwoFactorService\|2FA"

# 4. Restart API service
docker-compose -f docker-compose.prod.yml restart api
```

---

### Issue 4: "High Memory Usage / Out of Memory"

**Symptoms:**
- Services become slow or unresponsive
- Container crashes with OOM (Out of Memory)
- Logs show "Cannot allocate memory"

**Diagnosis:**
```bash
# Check real-time memory usage
docker stats

# Check container memory limits
docker-compose -f docker-compose.prod.yml config | grep -A3 "mem_limit\|memswap"

# Check application memory usage
docker-compose -f docker-compose.prod.yml exec api \
  node -e "console.log(process.memoryUsage())"

# Check for memory leaks in logs
docker-compose -f docker-compose.prod.yml logs api | \
  grep -i "memory\|leak\|gc"
```

**Fixes:**

```bash
# 1. Increase container memory limits
# Edit docker-compose.prod.yml
# Add under service definition:
#   deploy:
#     resources:
#       limits:
#         memory: 2G
#       reservations:
#         memory: 1G

docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d

# 2. Restart services (temporary fix)
docker-compose -f docker-compose.prod.yml restart api web

# 3. Clear Redis cache (may help)
docker-compose -f docker-compose.prod.yml exec redis \
  redis-cli FLUSHALL

# 4. Check for long-running queries
docker-compose -f docker-compose.prod.yml exec postgres psql \
  -U sgi -d sgi_prod -c \
  "SELECT pid, usename, query, query_start
   FROM pg_stat_activity
   WHERE state != 'idle';"

# Kill long-running query if needed
docker-compose -f docker-compose.prod.yml exec postgres psql \
  -U sgi -d sgi_prod -c "SELECT pg_terminate_backend(pid);"
```

---

### Issue 5: "Database Connection Pool Exhausted"

**Symptoms:**
- "Too many connections" errors
- API becomes unresponsive
- New queries fail to connect to database

**Diagnosis:**
```bash
# Check active connections
docker-compose -f docker-compose.prod.yml exec postgres psql \
  -U sgi -d sgi_prod -c \
  "SELECT count(*) as connections FROM pg_stat_activity;"

# Check max allowed connections
docker-compose -f docker-compose.prod.yml exec postgres psql \
  -U sgi -d sgi_prod -c "SHOW max_connections;"

# Check connections per database
docker-compose -f docker-compose.prod.yml exec postgres psql \
  -U sgi -d sgi_prod -c \
  "SELECT datname, count(*)
   FROM pg_stat_activity
   GROUP BY datname;"
```

**Fixes:**

```bash
# 1. Increase max_connections (requires DB restart)
# Edit docker-compose.prod.yml postgres service:
#   command: -c max_connections=200
docker-compose -f docker-compose.prod.yml down postgres
docker-compose -f docker-compose.prod.yml up -d postgres

# 2. Terminate idle connections
docker-compose -f docker-compose.prod.yml exec postgres psql \
  -U sgi -d sgi_prod -c \
  "SELECT pg_terminate_backend(pid)
   FROM pg_stat_activity
   WHERE state = 'idle' AND query_start < now() - interval '10 minutes';"

# 3. Restart API to reset connection pool
docker-compose -f docker-compose.prod.yml restart api

# 4. Check for connection leaks in code
# Review: apps/api/src/lib/db.ts for proper connection handling
```

---

### Issue 6: "Email/SMTP Not Sending"

**Symptoms:**
- Emails not delivered
- Logs show SMTP errors
- 2FA setup email fails

**Diagnosis:**
```bash
# Test SMTP configuration
docker-compose -f docker-compose.prod.yml exec api \
  node -e "
  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD
    }
  });
  transporter.verify((err, valid) => {
    console.log('SMTP Valid:', valid);
    if (err) console.error('Error:', err);
  });
  "

# Check SMTP environment variables
docker-compose -f docker-compose.prod.yml config | grep SMTP

# Check logs for SMTP errors
docker-compose -f docker-compose.prod.yml logs api | grep -i "smtp\|mail\|nodemailer"
```

**Fixes:**

```bash
# 1. Verify SMTP credentials in .env.production
nano .env.production
# Check: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD

# 2. Common SMTP settings:
# Gmail: smtp.gmail.com:587, enable "Less secure apps"
# SendGrid: smtp.sendgrid.net:587, user="apikey"
# Resend: smtp.resend.com:587

# 3. Test with simple email
curl -X POST http://localhost:3001/api/test-email \
  -H "Content-Type: application/json" \
  -d '{"to":"test@example.com","subject":"Test"}'

# 4. Restart API with new credentials
docker-compose -f docker-compose.prod.yml restart api

# 5. Check firewall allows SMTP port
# For SMTP_PORT 587/465
docker-compose -f docker-compose.prod.yml exec api \
  telnet $SMTP_HOST $SMTP_PORT
```

---

## Emergency Procedures

### Immediate Service Recovery

```bash
# 1. Quick health check
./scripts/health-check.sh

# 2. If services down, restart all
docker-compose -f docker-compose.prod.yml restart

# 3. Check logs while restarting
docker-compose -f docker-compose.prod.yml logs -f api

# 4. If still failing, do full restart
docker-compose -f docker-compose.prod.yml down
sleep 5
docker-compose -f docker-compose.prod.yml up -d
```

### Database Recovery

```bash
# 1. Check database status
docker-compose -f docker-compose.prod.yml ps postgres

# 2. Check database integrity
docker-compose -f docker-compose.prod.yml exec postgres \
  psql -U sgi -d sgi_prod -c "VACUUM ANALYZE;"

# 3. If corrupted, restore from backup
gunzip -c backup-20240101.sql.gz | \
  docker-compose -f docker-compose.prod.yml exec -T postgres \
  psql -U sgi -d sgi_prod

# 4. Restart and verify
docker-compose -f docker-compose.prod.yml restart postgres api
```

### Rollback Deployment

```bash
# 1. Identify previous working version
git tag -l | tail -5

# 2. Update image tags
export API_TAG=v1.0.0  # Previous version
export WEB_TAG=v1.0.0

# 3. Pull previous images
docker-compose -f docker-compose.prod.yml pull

# 4. Restart services
docker-compose -f docker-compose.prod.yml up -d

# 5. Verify health
./scripts/health-check.sh
```

---

## Performance Issues

### Slow API Responses

```bash
# Check database query performance
docker-compose -f docker-compose.prod.yml exec postgres psql \
  -U sgi -d sgi_prod -c \
  "SELECT query, calls, mean_exec_time
   FROM pg_stat_statements
   ORDER BY mean_exec_time DESC LIMIT 10;"

# Check database index usage
docker-compose -f docker-compose.prod.yml exec postgres psql \
  -U sgi -d sgi_prod -c \
  "SELECT schemaname, tablename, indexname
   FROM pg_indexes
   WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
   ORDER BY tablename;"

# Run ANALYZE to update statistics
docker-compose -f docker-compose.prod.yml exec postgres \
  psql -U sgi -d sgi_prod -c "ANALYZE;"
```

### Slow Frontend

```bash
# Check Next.js build size
docker-compose -f docker-compose.prod.yml exec web \
  du -sh /app/apps/web/.next

# Check frontend bundle size
docker-compose -f docker-compose.prod.yml logs web | \
  grep -i "build\|bundle\|size"

# Optimize build
docker-compose -f docker-compose.prod.yml down web
cd apps/web && npm run build
docker-compose -f docker-compose.prod.yml up -d web
```

---

## Security Issues

### Unauthorized Access Detected

```bash
# 1. Check recent API logs
docker-compose -f docker-compose.prod.yml logs api | \
  grep -i "unauthorized\|forbidden\|denied" | tail -20

# 2. Review authentication tokens
docker-compose -f docker-compose.prod.yml exec postgres psql \
  -U sgi -d sgi_prod -c \
  "SELECT * FROM sessions WHERE created_at > now() - interval '1 hour';"

# 3. Invalidate compromised tokens
docker-compose -f docker-compose.prod.yml exec redis \
  redis-cli DEL "session:*"

# 4. Force re-authentication
docker-compose -f docker-compose.prod.yml restart api
```

### Suspected Data Breach

```bash
# 1. Create immediate backup
pg_dump $DATABASE_URL | gzip > \
  emergency-backup-$(date +%Y%m%d-%H%M%S).sql.gz

# 2. Review access logs
docker-compose -f docker-compose.prod.yml logs api | \
  grep -i "access\|download\|export" | tail -50

# 3. Check for unusual database activity
docker-compose -f docker-compose.prod.yml exec postgres psql \
  -U sgi -d sgi_prod -c \
  "SELECT * FROM audit_log
   WHERE created_at > now() - interval '24 hours'
   ORDER BY created_at DESC;"

# 4. Rotate credentials immediately
# Update SMTP_PASSWORD, AWS_SECRET_ACCESS_KEY, JWT_SECRET
nano .env.production
docker-compose -f docker-compose.prod.yml restart api
```

---

## Monitoring Commands Cheat Sheet

```bash
# Real-time monitoring
watch -n 2 'docker-compose -f docker-compose.prod.yml ps'

# CPU and memory
docker stats

# Network I/O
docker-compose -f docker-compose.prod.yml stats

# Disk usage
docker system df

# Database connections
docker-compose -f docker-compose.prod.yml exec postgres psql \
  -U sgi -d sgi_prod -c \
  "SELECT pid, usename, state, query FROM pg_stat_activity;"

# Redis memory
docker-compose -f docker-compose.prod.yml exec redis \
  redis-cli INFO memory

# Failed requests (API)
docker-compose -f docker-compose.prod.yml logs api | \
  grep -i "error\|failed\|fatal" | tail -20
```

---

## When to Escalate

Contact the development team if:
- Multiple restart attempts don't resolve issue
- Data corruption is suspected
- Security breach may have occurred
- Database won't start or recover
- Unable to restore from backups

Include in escalation report:
- Exact error messages
- Recent log output (last 100 lines)
- Steps already attempted
- Current system resource usage
- Recent deployments or changes

---

For more information, see:
- [Deployment Guide](./DEPLOYMENT_GUIDE.md)
- [Monitoring Guide](./MONITORING_GUIDE.md)
- [Environment Variables](./ENVIRONMENT_VARIABLES.md)
