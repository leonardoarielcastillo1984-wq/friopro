# Monitoring & Alerts Setup Guide

Guide for setting up comprehensive monitoring, logging, and alerting for SGI 360 production environment.

## Table of Contents

1. [Monitoring Stack Overview](#monitoring-stack-overview)
2. [Application Metrics](#application-metrics)
3. [Infrastructure Monitoring](#infrastructure-monitoring)
4. [Alert Configuration](#alert-configuration)
5. [Log Aggregation](#log-aggregation)
6. [Dashboards](#dashboards)
7. [On-Call Procedures](#on-call-procedures)

## Monitoring Stack Overview

### Recommended Stack

- **Metrics**: Prometheus + Grafana
- **Logs**: ELK Stack (Elasticsearch, Logstash, Kibana) or Cloud Logging
- **APM**: Datadog or New Relic
- **Error Tracking**: Sentry
- **Status Page**: StatusPage.io or Updown.io
- **Incident Management**: PagerDuty or Opsgenie

### Quick Setup (Minimal)

For basic monitoring without external services:

```bash
# Set environment variables
SENTRY_DSN=https://your-sentry-key@sentry.io/project-id
DATADOG_API_KEY=your-datadog-key
SLACK_WEBHOOK=your-slack-webhook-url

# Update .env.production
nano .env.production

# Restart services
docker-compose -f docker-compose.prod.yml restart api web
```

## Application Metrics

### Health Check Endpoints

The API exposes a health check endpoint for monitoring:

```bash
# Health check
curl http://localhost:3001/api/healthz

# Response (healthy):
{
  "status": "ok",
  "uptime": 3600,
  "timestamp": "2024-03-17T12:00:00Z",
  "services": {
    "database": "connected",
    "redis": "connected",
    "api": "running"
  }
}

# Response (unhealthy):
{
  "status": "error",
  "message": "Database connection failed",
  "timestamp": "2024-03-17T12:00:00Z"
}
```

### Key Metrics to Monitor

#### API Metrics
- Request count by endpoint
- Response time (p50, p95, p99)
- Error rate by status code
- Active connections
- Database query time
- Redis cache hit rate

#### Database Metrics
- Connection pool usage
- Active queries
- Query response time
- Transaction count
- Replication lag (if applicable)
- Disk usage
- Index bloat

#### Frontend Metrics
- Page load time
- Time to First Contentful Paint (FCP)
- JavaScript errors
- Network requests
- User sessions

#### 2FA Metrics
- Setup attempts/success
- Verification success rate
- Backup code generation
- Failed attempts per user
- Average setup time

### Prometheus Configuration

Create `infra/prometheus.yml`:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager:9093']

rule_files:
  - 'alert-rules.yml'

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'api'
    static_configs:
      - targets: ['api:3001']
    metrics_path: '/api/metrics'

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres:5432']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis:6379']
```

## Infrastructure Monitoring

### Docker Container Monitoring

```bash
# Real-time stats
docker stats

# Container logs
docker logs --follow api

# Container resource limits
docker inspect api | grep -A20 "HostConfig"

# Network usage
docker network stats

# Volume usage
docker volume ls -q | xargs -I {} sh -c \
  'echo "{}: $(docker volume inspect {} | jq ".[0].Mountpoint")"'
```

### Database Monitoring

```bash
# Active connections
docker-compose exec postgres psql -U sgi -d sgi_prod -c \
  "SELECT count(*) as active_connections FROM pg_stat_activity WHERE state = 'active';"

# Long-running queries
docker-compose exec postgres psql -U sgi -d sgi_prod -c \
  "SELECT pid, usename, query_start, query
   FROM pg_stat_activity
   WHERE query_start < now() - interval '5 minutes';"

# Cache hit ratio
docker-compose exec postgres psql -U sgi -d sgi_prod -c \
  "SELECT
     sum(heap_blks_hit)::float / (sum(heap_blks_hit) + sum(heap_blks_read)) as cache_hit_ratio
   FROM pg_statio_user_tables;"

# Table sizes
docker-compose exec postgres psql -U sgi -d sgi_prod -c \
  "SELECT tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
   FROM pg_tables
   WHERE schemaname = 'public'
   ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;"

# Disk usage
docker-compose exec postgres psql -U sgi -d sgi_prod -c \
  "SELECT pg_database.datname, pg_size_pretty(pg_database_size(pg_database.datname))
   FROM pg_database
   ORDER BY pg_database_size(pg_database.datname) DESC;"
```

### Redis Monitoring

```bash
# Memory usage
docker-compose exec redis redis-cli INFO memory

# Key statistics
docker-compose exec redis redis-cli INFO stats

# Connected clients
docker-compose exec redis redis-cli INFO clients

# Key count by pattern
docker-compose exec redis redis-cli --scan --pattern "*" | wc -l

# Top memory consumers
docker-compose exec redis redis-cli --bigkeys

# Monitor real-time commands
docker-compose exec redis redis-cli MONITOR
```

## Alert Configuration

### Email Alerts (Recommended for Critical)

```bash
# Test email alert
curl -X POST http://localhost:3001/api/alerts/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "type": "email",
    "to": "ops@company.com",
    "subject": "Alert: High Memory Usage",
    "message": "API server memory usage exceeded 80%"
  }'
```

### Slack Alerts

Configure webhook in `.env.production`:

```bash
SLACK_WEBHOOK=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
SLACK_CHANNEL=#alerts
SLACK_MENTION_ON_CRITICAL=@on-call-team
```

### Alert Rules Template

Create `infra/alert-rules.yml`:

```yaml
groups:
  - name: api_alerts
    rules:
      - alert: APIDown
        expr: up{job="api"} == 0
        for: 2m
        annotations:
          summary: "API is down"
          action: "Restart API container"

      - alert: HighErrorRate
        expr: rate(api_errors_total[5m]) > 0.05
        for: 5m
        annotations:
          summary: "API error rate > 5%"

      - alert: HighMemoryUsage
        expr: container_memory_usage_bytes > 1.5e9
        for: 5m
        annotations:
          summary: "Memory usage > 1.5GB"

      - alert: DatabaseConnectionPoolExhausted
        expr: db_connections_active > 90
        for: 2m
        annotations:
          summary: "DB connection pool nearly full"

      - alert: RedisCacheFull
        expr: redis_memory_used_bytes / redis_memory_max_bytes > 0.9
        for: 2m
        annotations:
          summary: "Redis cache > 90% full"

  - name: database_alerts
    rules:
      - alert: PostgreSQLDown
        expr: pg_up == 0
        for: 1m
        annotations:
          summary: "PostgreSQL is down"

      - alert: HighDiskUsage
        expr: node_filesystem_avail_bytes / node_filesystem_size_bytes < 0.1
        for: 5m
        annotations:
          summary: "Disk usage > 90%"
```

## Log Aggregation

### Docker Logs

```bash
# View API logs
docker-compose -f docker-compose.prod.yml logs -f api

# Follow with timestamps
docker-compose -f docker-compose.prod.yml logs -f -t api

# Last 100 lines
docker-compose -f docker-compose.prod.yml logs --tail=100 api

# Since specific time
docker-compose -f docker-compose.prod.yml logs --since 2024-03-17T10:00:00 api
```

### Structured Logging

Application logs in JSON format for easy parsing:

```json
{
  "timestamp": "2024-03-17T12:00:00.000Z",
  "level": "info",
  "service": "api",
  "message": "User logged in",
  "userId": "user-123",
  "ip": "192.168.1.1",
  "duration": 45,
  "metadata": {
    "sessionId": "session-456"
  }
}
```

### Log Forwarding (ELK Stack)

Example Logstash configuration:

```conf
input {
  docker {
    host => "unix:///var/run/docker.sock"
    containers => {
      "api" => { }
      "web" => { }
      "postgres" => { }
    }
  }
}

filter {
  json {
    source => "message"
  }

  if [level] == "ERROR" or [level] == "FATAL" {
    # Alert on errors
    email {
      to => "ops@company.com"
      subject => "Alert: %{message}"
    }
  }
}

output {
  elasticsearch {
    hosts => ["elasticsearch:9200"]
    index => "sgi-360-%{+YYYY.MM.dd}"
  }
}
```

## Dashboards

### Grafana Dashboard Example

Create `infra/grafana-dashboard.json`:

```json
{
  "dashboard": {
    "title": "SGI 360 Production",
    "panels": [
      {
        "title": "API Uptime",
        "targets": [
          {
            "expr": "up{job=\"api\"}",
            "legendFormat": "API"
          }
        ]
      },
      {
        "title": "Request Rate",
        "targets": [
          {
            "expr": "rate(http_requests_total[1m])",
            "legendFormat": "{{method}} {{path}}"
          }
        ]
      },
      {
        "title": "Response Time (p95)",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))"
          }
        ]
      },
      {
        "title": "Error Rate",
        "targets": [
          {
            "expr": "rate(http_requests_total{status=~\"5..\"}[5m])"
          }
        ]
      }
    ]
  }
}
```

### Key Dashboards to Create

1. **Overview Dashboard**
   - Service health
   - Request metrics
   - Error rates
   - System resources

2. **Database Dashboard**
   - Connection pool
   - Query performance
   - Cache hit ratio
   - Disk usage

3. **2FA Dashboard**
   - Setup success rate
   - Verification attempts
   - Backup codes generated
   - Failed attempts

4. **Infrastructure Dashboard**
   - CPU/Memory usage
   - Disk I/O
   - Network traffic
   - Container status

## On-Call Procedures

### On-Call Checklist

```markdown
# Daily On-Call Tasks

- [ ] Check application health dashboard
- [ ] Review error logs from previous 24 hours
- [ ] Verify backup completion
- [ ] Check database replication status
- [ ] Monitor 2FA verification rates
- [ ] Review security logs for anomalies
```

### Incident Response Process

```bash
# 1. Acknowledge alert
# - Confirm alert in monitoring system
# - Note timestamp and severity

# 2. Initial diagnosis
./scripts/health-check.sh
docker-compose -f docker-compose.prod.yml ps
docker-compose -f docker-compose.prod.yml logs --tail=50 api

# 3. Basic troubleshooting
# - Check disk space: docker system df
# - Check memory: docker stats
# - Check database: see TROUBLESHOOTING_RUNBOOK.md

# 4. Escalate if needed
# - Contact development team
# - Create incident ticket
# - Start war room if critical

# 5. Document resolution
# - Update incident log
# - Post-mortem analysis
# - Process improvements
```

### Escalation Matrix

| Severity | Response Time | Action |
|----------|---------------|--------|
| Critical | 5 minutes | Page on-call engineer, start incident |
| High | 15 minutes | Contact primary engineer |
| Medium | 1 hour | Assign to engineer, plan fix |
| Low | 4 hours | Log for backlog review |

## Monitoring Automation

### Automated Health Checks

```bash
# Schedule health check every 5 minutes (crontab)
*/5 * * * * /path/to/scripts/health-check.sh >> /var/log/health-check.log 2>&1

# Schedule database backup daily at 2 AM
0 2 * * * /path/to/scripts/backup-database.sh >> /var/log/backup.log 2>&1

# Schedule log rotation
0 0 * * * /path/to/scripts/rotate-logs.sh
```

### Monitoring Metrics Export

```bash
# Export metrics in Prometheus format
curl http://localhost:3001/api/metrics

# Expected output:
# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
# http_requests_total{method="GET",status="200"} 1234
# http_requests_total{method="POST",status="201"} 567
```

## Cost Optimization

### Monitoring Service Selection

| Service | Cost | Best For |
|---------|------|----------|
| Datadog | $$ | Comprehensive APM |
| New Relic | $$ | Performance monitoring |
| Sentry | $ | Error tracking |
| Custom Prometheus/Grafana | Free | Self-hosted on-prem |
| CloudWatch | $ | AWS-native |
| Stackdriver | $ | GCP-native |

---

## Useful Commands

```bash
# Export and import Grafana dashboards
# Export
curl -H "Authorization: Bearer $GRAFANA_TOKEN" \
  http://grafana:3000/api/dashboards/db/sgi-360 > dashboard.json

# Test alert rules
./alertmanager amtool check-config alert-rules.yml

# Monitor specific metric
docker-compose exec prometheus promtool query instant 'up'

# Backup Prometheus data
docker volume inspect sgi_prometheus_data

# View all exposed metrics
curl -s http://localhost:3001/api/metrics | head -30
```

---

For more information, see:
- [Deployment Guide](./DEPLOYMENT_GUIDE.md)
- [Troubleshooting Runbook](./TROUBLESHOOTING_RUNBOOK.md)
- [Environment Variables](./ENVIRONMENT_VARIABLES.md)
