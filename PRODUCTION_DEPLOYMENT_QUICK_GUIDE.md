# Production Deployment - Quick Guide

**Target:** Deploy SGI 360 2FA system with all new production features
**Time:** ~30-60 minutes
**Prerequisites:** Node.js, npm, PostgreSQL, SSL certificate

---

## Pre-Deployment Checklist

- [ ] SSL/TLS certificate ready
- [ ] PostgreSQL database provisioned
- [ ] Environment variables planned
- [ ] Admin email configured
- [ ] SMTP/Email service configured
- [ ] Monitoring service configured (optional)
- [ ] Backup strategy established
- [ ] Rollback plan documented

---

## Step 1: Prepare Environment Variables (5 min)

### Copy Security Template

```bash
cd /path/to/sgi360
cp .env.security.example .env.production
```

### Generate Required Secrets

```bash
# Generate JWT Secret
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"

# Generate Session Secret
node -e "console.log('SESSION_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
```

### Edit .env.production

```bash
# Core
NODE_ENV=production
API_PORT=3001
DATABASE_URL=postgresql://user:password@host:5432/sgi360

# Security (from generated secrets above)
JWT_SECRET=<paste_generated_secret>
SESSION_SECRET=<paste_generated_secret>

# CORS (set to your domains)
CORS_ORIGIN=https://sgi360.com,https://admin.sgi360.com

# Cookies
COOKIE_SECURE=true
COOKIE_HTTP_ONLY=true
COOKIE_SAME_SITE=strict

# Email
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=<your-sendgrid-api-key>
SMTP_FROM=noreply@sgi360.com
SUPPORT_EMAIL=support@sgi360.com

# Rate Limiting
RATE_LIMIT_MAX=200
RATE_LIMIT_WINDOW=1 minute
```

---

## Step 2: Install Dependencies (10 min)

```bash
cd /path/to/sgi360/apps/api

# Clean install
rm -rf node_modules package-lock.json
npm install

# Verify installation
npm list | grep -E "helmet|swagger|zod|prisma"
```

---

## Step 3: Database Setup (10 min)

```bash
# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate -- --name "production_deployment"

# Seed initial data
npm run seed:complete

# Verify database connection
npm run prisma -- db execute --stdin < <(echo "SELECT 1;")
```

---

## Step 4: Build Application (5 min)

```bash
# Build TypeScript
npm run build

# Verify build output
ls -la dist/
file dist/main.js

# Size check
du -sh dist/
```

---

## Step 5: Test Locally (10 min)

### Start Server

```bash
# Set environment
export NODE_ENV=production

# Start server
npm start &

# Wait for startup
sleep 3
```

### Test Health Endpoint

```bash
curl http://localhost:3001/health
```

Expected response:
```json
{ "status": "ok" }
```

### Test Swagger UI

```bash
# Should return HTML
curl -I http://localhost:3001/api-docs | head -5

# Should return JSON spec
curl http://localhost:3001/api-docs.json | jq '.info.version'
```

### Test Login

```bash
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "YourPassword123!"
  }'
```

### Stop Local Server

```bash
pkill -f "npm start"
```

---

## Step 6: Deploy to Production (15-30 min)

### Option A: Docker Deployment

```bash
# Build Docker image
docker build -f apps/api/Dockerfile -t sgi360-api:latest .

# Tag image
docker tag sgi360-api:latest your-registry/sgi360-api:v1.0

# Push to registry
docker push your-registry/sgi360-api:v1.0

# Deploy with environment variables
docker run -d \
  --name sgi360-api \
  --restart always \
  -p 3001:3001 \
  --env-file .env.production \
  -v /data/uploads:/app/uploads \
  your-registry/sgi360-api:v1.0
```

### Option B: Direct Server Deployment

```bash
# Copy application to server
scp -r dist/ user@server:/opt/sgi360/api/

# Copy assets and templates
scp -r apps/api/templates user@server:/opt/sgi360/api/

# Copy environment file securely
scp .env.production user@server:/opt/sgi360/api/.env

# Set permissions
ssh user@server "chmod 640 /opt/sgi360/api/.env"
ssh user@server "chmod 755 /opt/sgi360/api/dist/main.js"
```

### Option C: PM2 Process Manager

```bash
# Install PM2 globally
npm install -g pm2

# Create ecosystem config
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'sgi360-api',
    script: './dist/main.js',
    instances: 4,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production'
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time_format: 'YYYY-MM-DD HH:mm:ss Z',
    watch: false,
    ignore_watch: ['node_modules', 'logs'],
    max_memory_restart: '500M',
  }]
};
EOF

# Start with PM2
pm2 start ecosystem.config.js

# Enable auto-restart
pm2 startup
pm2 save
```

---

## Step 7: Configure Reverse Proxy (10 min)

### Nginx Configuration

```bash
# Create nginx config
sudo tee /etc/nginx/sites-available/sgi360-api << 'EOF'
upstream sgi360_api {
    server localhost:3001;
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name api.sgi360.com;
    return 301 https://$server_name$request_uri;
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name api.sgi360.com;

    # SSL configuration
    ssl_certificate /etc/letsencrypt/live/api.sgi360.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.sgi360.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Logging
    access_log /var/log/nginx/sgi360-api-access.log;
    error_log /var/log/nginx/sgi360-api-error.log;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=200r/m;
    limit_req zone=api burst=20 nodelay;

    # Proxy settings
    location / {
        proxy_pass http://sgi360_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF

# Enable site
sudo ln -s /etc/nginx/sites-available/sgi360-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## Step 8: Verify Production Deployment (10 min)

### Health Checks

```bash
# Check application health
curl https://api.sgi360.com/health

# Check API docs (should redirect or load)
curl -I https://api.sgi360.com/api-docs

# Test authentication flow
curl -X POST https://api.sgi360.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"YourPassword123!"}'

# Check admin dashboard is protected
curl -I https://api.sgi360.com/admin/dashboard
# Should return 401 or redirect to login
```

### Security Verification

```bash
# Check HSTS header
curl -I https://api.sgi360.com/ | grep Strict-Transport

# Check CSP header
curl -I https://api.sgi360.com/ | grep Content-Security

# Check security headers
curl -I https://api.sgi360.com/ | grep -E "X-Frame|X-Content|X-XSS"
```

### Performance Check

```bash
# Response time benchmark
time curl https://api.sgi360.com/health

# Load test (optional, be careful in production)
# Using ApacheBench
# ab -n 100 -c 10 https://api.sgi360.com/health
```

---

## Step 9: Enable Monitoring & Logging (10 min)

### Application Logging

```bash
# Create logs directory
mkdir -p /var/log/sgi360
chmod 755 /var/log/sgi360

# Configure log rotation
sudo tee /etc/logrotate.d/sgi360 << 'EOF'
/var/log/sgi360/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
}
EOF
```

### System Monitoring

```bash
# Monitor CPU/Memory
ps aux | grep "node\|npm" | grep -v grep

# Monitor Network Connections
netstat -tlnp | grep 3001

# Monitor Disk Usage
du -sh /opt/sgi360

# Check Nginx Status
systemctl status nginx

# View Real-Time Logs
tail -f /var/log/nginx/sgi360-api-access.log
```

### Error Tracking (Optional - Sentry)

```bash
# Set SENTRY_DSN in .env.production
SENTRY_DSN=https://your-key@sentry.io/your-project

# Restart application with new config
systemctl restart sgi360-api
# or
pm2 restart sgi360-api
```

---

## Step 10: Post-Deployment Tasks (5 min)

### Document Deployment

```bash
# Create deployment record
cat > DEPLOYMENT_LOG.txt << 'EOF'
=== SGI 360 2FA System - Production Deployment ===

Date: $(date)
Environment: production
Version: 1.0
API URL: https://api.sgi360.com

Deployed Features:
✓ API Documentation (Swagger/OpenAPI)
✓ Admin Panel for 2FA Management
✓ Security Hardening

Endpoints:
- Health: https://api.sgi360.com/health
- Swagger UI: https://api.sgi360.com/api-docs
- OpenAPI JSON: https://api.sgi360.com/api-docs.json
- Admin Dashboard: https://api.sgi360.com/admin/dashboard

Configuration:
- Database: Connected ✓
- Email: Configured ✓
- Security Headers: Enabled ✓
- Rate Limiting: Enabled ✓

Rollback Plan:
1. Stop current version
2. Deploy previous version from backup
3. Verify health endpoints
4. Notify stakeholders

EOF

cat DEPLOYMENT_LOG.txt
```

### Set Up Alerts

```bash
# Example: Email alert on service down
cat > /opt/sgi360/health-check.sh << 'EOF'
#!/bin/bash
HEALTH=$(curl -s https://api.sgi360.com/health)
if [ $? -ne 0 ]; then
    echo "API Down Alert" | mail -s "SGI360 API Health Alert" admin@example.com
fi
EOF

chmod +x /opt/sgi360/health-check.sh

# Add to crontab (every 5 minutes)
(crontab -l 2>/dev/null; echo "*/5 * * * * /opt/sgi360/health-check.sh") | crontab -
```

### Verify Admin Access

```bash
# Create admin test
curl -X GET https://api.sgi360.com/admin/2fa/stats \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Should return stats (if token valid) or 403 (if not admin)
```

---

## Troubleshooting

### Application Won't Start

```bash
# Check error logs
tail -f /var/log/sgi360/*.log
# or for PM2
pm2 logs sgi360-api

# Check port in use
lsof -i :3001
# Kill if needed
kill -9 <PID>

# Test with verbose logging
NODE_ENV=production DEBUG=* npm start
```

### Database Connection Issues

```bash
# Test connection
psql postgresql://user:password@host:5432/sgi360 -c "SELECT 1;"

# Check Prisma connection
npm run prisma -- db execute --stdin < <(echo "SELECT version();")

# Verify .env DATABASE_URL
echo $DATABASE_URL
```

### SSL Certificate Issues

```bash
# Check certificate validity
openssl x509 -in /etc/letsencrypt/live/api.sgi360.com/fullchain.pem -text -noout | grep -A 2 "Not"

# Renew certificate (if using Let's Encrypt)
sudo certbot renew

# Verify nginx config
sudo nginx -t
```

### Rate Limiting Too Aggressive

```bash
# Edit .env.production
RATE_LIMIT_MAX=500        # Increase max requests
RATE_LIMIT_WINDOW=2 min   # Increase time window

# Restart app
pm2 restart sgi360-api
```

---

## Rollback Plan

### If Issues Occur

```bash
# Step 1: Stop current version
pm2 stop sgi360-api
# or
docker stop sgi360-api

# Step 2: Restore previous version
cd /opt/sgi360/api
git checkout previous-working-commit
npm install
npm run build

# Step 3: Start previous version
pm2 start ecosystem.config.js
# or
docker run ... previous-version-image

# Step 4: Verify health
curl https://api.sgi360.com/health

# Step 5: Notify team
echo "Rollback complete - API restored to previous version" | \
  mail -s "SGI360 API Rollback" devops@example.com
```

---

## Post-Deployment Verification

- [ ] Health endpoint returns 200
- [ ] Swagger UI loads at /api-docs
- [ ] OpenAPI JSON available at /api-docs.json
- [ ] Admin dashboard loads (with auth)
- [ ] Login endpoint works
- [ ] 2FA endpoints functional
- [ ] Admin endpoints require auth
- [ ] Rate limiting active
- [ ] Security headers present
- [ ] Logs being written
- [ ] Database connected
- [ ] Email service working
- [ ] Monitoring active

---

## Maintenance

### Daily
- Monitor error logs
- Check health endpoint
- Verify uptime

### Weekly
- Review security logs
- Check performance metrics
- Update dependencies

### Monthly
- Rotate secrets
- Review audit logs
- Update documentation

---

## Contact & Support

- **On-Call:** on-call@sgi360.com
- **Security:** security@sgi360.com
- **Operations:** ops@sgi360.com
- **Documentation:** https://docs.sgi360.com

---

**Deployment Complete!**

Your SGI 360 2FA system is now running in production with all features enabled.

Monitor the application closely for the first 24 hours and be ready to rollback if needed.

Good luck! 🚀
