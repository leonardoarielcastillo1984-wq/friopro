# 📊 Production Monitoring - 2FA

**Sistema de monitoreo para detectar problemas en producción**

---

## 📈 Métricas Clave

### 2FA Adoption
```
Métrica: % de usuarios con 2FA habilitado
Objetivo: >80% en 3 meses
Alerta: <60%
Reporte: Semanal
```

### 2FA Success Rate
```
Métrica: % de logins con 2FA exitosos
Objetivo: >99%
Alerta: <97%
Reporte: Diario
```

### Recovery Code Usage
```
Métrica: % de códigos de recuperación usados
Objetivo: <10% por usuario
Alerta: >30%
Reporte: Semanal
```

### Session Expiration
```
Métrica: % de sesiones que expiran
Objetivo: <5%
Alerta: >10%
Reporte: Diario
```

---

## 🔍 Logs a Monitorear

### API Logs
```
Buscar: "2FA" or "TwoFactor"
Errores críticos:
  - "2FA session invalid"
  - "TOTP verification failed"
  - "Recovery code consumption error"
  - "Database connection failed"
```

### Frontend Logs
```
Buscar: "LoginWith2FA" or "TwoFactorSetup"
Errores críticos:
  - "API connection failed"
  - "Invalid TOTP code format"
  - "Session expired during verification"
  - "Component render error"
```

---

## 📌 Alertas Automáticas

### Crítica (Ejecutar inmediatamente)
```
1. 2FA service is down
   Acción: Rollback deployment
   Contacto: DevOps team

2. More than 10% failed verifications
   Acción: Revisar logs
   Contacto: Backend team

3. Database connection issues
   Acción: Check DB status
   Contacto: DBA
```

### Alta (Dentro de 1 hora)
```
1. Recovery code exhaustion rate > 20%
   Acción: Investigate
   Contacto: Product team

2. API response time > 5s for 2FA endpoints
   Acción: Check performance
   Contacto: Backend team

3. Unusual spike in failed logins
   Acción: Review security
   Contacto: Security team
```

### Media (Dentro de 24 horas)
```
1. 2FA adoption < 70%
   Acción: Promote feature
   Contacto: Product team

2. New errors in logs
   Acción: Investigate
   Contacto: Backend team
```

---

## 🔧 Health Checks

### Endpoints to Monitor
```
GET /healthz
  Expected: {"ok":true}
  Interval: Every 30s
  Alert: If response != 200

GET /2fa/status (authenticated)
  Expected: 200 with status object
  Interval: Every 5m
  Alert: If response != 200

POST /2fa/verify (authenticated)
  Expected: 200 with verification result
  Interval: Every 1m (test)
  Alert: If response != 200
```

### Database Health
```
Query: SELECT 1
Interval: Every 1m
Alert: If fails

Query: SELECT COUNT(*) FROM "TwoFactorAuth"
Interval: Every 1h
Alert: If count decreases

Query: SELECT COUNT(*) FROM "TwoFactorRecoveryCode" WHERE used=true
Interval: Every 1h
Alert: If sudden increase
```

---

## 📊 Dashboard Metrics

### Real-time Dashboard
```
- 2FA Users Online
- Failed Verifications (last 5 min)
- API Response Time
- Database Query Time
- Error Rate
```

### Daily Report
```
- Total 2FA setups
- Total 2FA logins
- Failed verifications breakdown
- Recovery codes used
- Performance metrics
```

### Weekly Report
```
- 2FA adoption rate
- User retention with 2FA
- Security incidents
- Performance trends
- Cost analysis
```

---

## 🛡️ Security Monitoring

### Suspicious Activity
```
Alert if:
- Single user >5 failed 2FA attempts in 1 hour
- Single IP >10 failed 2FA attempts in 1 hour
- Recovery codes >30% usage in single user
- Session tokens used multiple times
- Unusual geographic login patterns
```

### Rate Limiting
```
Monitor: /2fa/verify endpoint
Limit: 5 requests per minute per user
Action: Block after limit exceeded

Monitor: /auth/login endpoint
Limit: 10 requests per minute per IP
Action: Block after limit exceeded
```

---

## 📞 Escalation Path

```
Level 1 (Support Team)
  - Respond to user 2FA issues
  - Reset 2FA if needed
  - Escalate to Level 2 if issue persists

Level 2 (Backend Team)
  - Investigate API errors
  - Review logs and metrics
  - Deploy fixes
  - Escalate to Level 3 if critical

Level 3 (DevOps Team)
  - Database recovery
  - Infrastructure issues
  - Disaster recovery
  - On-call rotation
```

---

## 📈 Performance Targets

| Metric | Target | Alert |
|--------|--------|-------|
| API Response Time (2FA) | <200ms | >500ms |
| DB Query Time | <50ms | >100ms |
| Error Rate | <0.1% | >1% |
| Uptime | 99.9% | <99% |
| Failed Verifications | <1% | >3% |
| Session Expiration | <5% | >10% |

---

## 🔄 Incident Response

### 2FA Service Down
```
1. Page on-call engineer
2. Check health endpoint
3. Review recent deployments
4. Check database connectivity
5. Rollback if necessary
6. Post-mortem within 24h
```

### High Failed Verification Rate
```
1. Check recent code changes
2. Verify TOTP logic is correct
3. Check time synchronization
4. Review error logs
5. Notify affected users if >10% failure
6. Implement fix if needed
```

### Database Issues
```
1. Check connection pool
2. Verify disk space
3. Review slow queries
4. Check for locks
5. Restart database if necessary
6. Verify backups
```

---

## 📋 Checklist Diario

- [ ] Check 2FA adoption rate
- [ ] Review error logs
- [ ] Verify health endpoints responding
- [ ] Check API response times
- [ ] Review failed verifications
- [ ] Check database size
- [ ] Verify backups completed
- [ ] Review security logs

---

## 📋 Checklist Semanal

- [ ] Review all metrics
- [ ] Analyze trends
- [ ] Check recovery code usage
- [ ] Review security incidents
- [ ] Plan capacity needs
- [ ] Review cost metrics
- [ ] Team standup on metrics

---

## 📋 Checklist Mensual

- [ ] Full security audit
- [ ] Performance analysis
- [ ] Cost optimization review
- [ ] User feedback analysis
- [ ] Infrastructure review
- [ ] Disaster recovery test
- [ ] Update runbooks

---

## 🔗 Useful Commands

### Check API health
```bash
curl https://api.sgi360.com/healthz
```

### Check 2FA status
```bash
curl https://api.sgi360.com/2fa/status \
  -H "Authorization: Bearer $TOKEN"
```

### View logs
```bash
docker logs container-id
tail -f /var/log/sgi360/app.log
```

### Database queries
```bash
psql -c "SELECT COUNT(*) FROM \"TwoFactorAuth\" WHERE \"isEnabled\"=true"
psql -c "SELECT COUNT(*) FROM \"TwoFactorRecoveryCode\" WHERE used=true"
```

---

## 📊 Integration with Monitoring Tools

### Prometheus
```yaml
- job_name: 'sgi360-2fa'
  static_configs:
    - targets: ['localhost:9090']
  metrics_path: '/metrics'
```

### Grafana Alerts
```
Alert: TwoFAFailureRate > 1%
Alert: TwoFAResponseTime > 500ms
Alert: TwoFAUptime < 99%
```

### DataDog
```
Monitor 2fa.verify.failures
Monitor 2fa.setup.success
Monitor 2fa.recovery_code.usage
```

### CloudWatch (AWS)
```
Namespace: SGI360/2FA
Metrics:
  - VerificationFailures
  - SetupSuccesses
  - ResponseTime
```

---

## 🔔 Notification Channels

- Slack: #sgi360-alerts
- PagerDuty: On-call rotation
- Email: ops@sgi360.com
- SMS: For critical alerts only

---

**Última actualización:** 2026-03-16
**Mantener actualizado** con cambios de implementación
