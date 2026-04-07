# Production Deployment Checklist

Complete checklist for deploying SGI 360 to production with 2FA support.

## Pre-Deployment (1 Week Before)

### Code & Testing
- [ ] All feature branches merged to `main`
- [ ] All tests passing (unit, E2E, integration)
- [ ] Code review completed
- [ ] Security audit completed
- [ ] Performance baseline established
- [ ] 2FA functionality fully tested
- [ ] Backup/recovery procedures tested

### Documentation
- [ ] Deployment guide reviewed
- [ ] Runbook prepared
- [ ] Environment variables documented
- [ ] API changes documented
- [ ] Database schema changes documented
- [ ] 2FA setup guide created for end users

### Infrastructure
- [ ] Production Docker images built and tested
- [ ] Docker registry access verified
- [ ] Database backups configured
- [ ] SSL/TLS certificates prepared
- [ ] Domain/DNS records configured
- [ ] Monitoring/alerting configured
- [ ] Log aggregation configured

### Credentials & Secrets
- [ ] All secrets rotated
- [ ] GitHub Secrets configured
  - [ ] `DOCKER_REGISTRY`
  - [ ] `DOCKER_USERNAME`
  - [ ] `DOCKER_PASSWORD`
  - [ ] `DATABASE_URL_PROD`
  - [ ] `REDIS_URL_PROD`
  - [ ] `JWT_SECRET_PROD`
  - [ ] `DEPLOY_KEY_PROD`
  - [ ] `SLACK_WEBHOOK`
- [ ] Environment files created
  - [ ] `.env.production`
  - [ ] `.env.staging` (for validation)
- [ ] SSH keys configured
- [ ] Database credentials secured
- [ ] SMTP credentials verified

### Team & Process
- [ ] Deployment team identified
- [ ] On-call schedule established
- [ ] Incident escalation process documented
- [ ] Team trained on deployment process
- [ ] Stakeholders notified

## 48 Hours Before Deployment

### Final Verification
- [ ] Staging environment tested
- [ ] All migrations tested on staging
- [ ] 2FA flow tested end-to-end
- [ ] Email notifications tested
- [ ] File uploads tested
- [ ] Payment processing tested (if applicable)

### Backup & Recovery
- [ ] Full database backup created
- [ ] Backup tested and verified
- [ ] Recovery procedure documented
- [ ] Rollback plan prepared
- [ ] Previous version still accessible

### Monitoring Readiness
- [ ] Monitoring dashboards created
- [ ] Alert thresholds configured
- [ ] Log aggregation tested
- [ ] Status page updated
- [ ] On-call team ready
- [ ] Incident communication plan ready

## 24 Hours Before Deployment

### Final Checks
- [ ] No code changes scheduled for 24 hours
- [ ] Production database backup successful
- [ ] All external services health checked
  - [ ] Email service
  - [ ] Cloud storage (S3, etc.)
  - [ ] Analytics/monitoring
- [ ] DNS propagation verified
- [ ] CDN/caching configured
- [ ] Rate limiting configured

### Documentation Review
- [ ] Runbook reviewed by ops team
- [ ] Rollback procedures reviewed
- [ ] Emergency contact list prepared
- [ ] Communication templates prepared

## Deployment Day

### Pre-Deployment (30 Minutes Before)
- [ ] All team members online and ready
- [ ] Status page set to "maintenance"
- [ ] Slack channel notifications enabled
- [ ] Monitoring dashboard open
- [ ] Backup terminal session open
- [ ] Runbook printed or easily accessible

### Deployment Execution
```bash
# Run deployment script
./scripts/deploy-production.sh
```

Steps performed by script:
- [ ] Environment validation
- [ ] Docker login
- [ ] Image pull
- [ ] Database health check
- [ ] Migrations execution
- [ ] Service restart
- [ ] Health checks

### Manual Verification (After script completes)
- [ ] All containers running: `docker-compose -f docker-compose.prod.yml ps`
- [ ] API responding: `curl http://localhost:3001/api/healthz`
- [ ] Frontend loaded: `curl http://localhost:3000`
- [ ] Database connected: Check in API logs
- [ ] Redis connected: Check in API logs

### Post-Deployment Testing (30 Minutes)

#### Functional Testing
- [ ] User registration works
- [ ] User login works
- [ ] 2FA setup works
  - [ ] QR code generates
  - [ ] TOTP codes validate
  - [ ] Backup codes generate
- [ ] User can verify 2FA on login
- [ ] Backup codes can authenticate
- [ ] Password reset works
- [ ] Email sending works

#### Integration Testing
- [ ] Database migrations applied
- [ ] All tables exist and have data
- [ ] Redis cache working
- [ ] S3 uploads working
- [ ] Email notifications working
- [ ] API documentation accessible

#### Performance Testing
- [ ] Page load times acceptable
- [ ] No JavaScript errors in console
- [ ] API response times < 500ms
- [ ] Database queries performing well

#### Security Testing
- [ ] HTTPS enforced
- [ ] CORS properly configured
- [ ] Authentication working
- [ ] Authorization working
- [ ] 2FA preventing unauthorized access
- [ ] No sensitive data in logs

## Post-Deployment (First 24 Hours)

### Monitoring & Alerts
- [ ] Error rate normal (< 1%)
- [ ] Response times normal
- [ ] Database performance normal
- [ ] Memory usage stable
- [ ] No alert spam
- [ ] Logs being captured correctly

### Business Metrics
- [ ] User login count as expected
- [ ] 2FA completion rate monitored
- [ ] Transaction success rate good
- [ ] Feature usage as expected

### Documentation
- [ ] Deployment logged
- [ ] Build/version number recorded
- [ ] Timeline of deployment recorded
- [ ] Any issues encountered logged
- [ ] Lessons learned documented

### Cleanup
- [ ] Status page updated (remove maintenance)
- [ ] Stakeholders notified
- [ ] Team debriefing scheduled
- [ ] Documentation updates merged

## Post-Deployment (First Week)

### Validation
- [ ] No critical bugs reported
- [ ] Performance meets expectations
- [ ] 2FA adoption rate monitored
- [ ] User feedback collected

### Maintenance
- [ ] Regular backups running
- [ ] Log rotation working
- [ ] Monitoring stable
- [ ] Security scan completed

### Follow-up
- [ ] Post-deployment retrospective
- [ ] Document any issues and resolutions
- [ ] Update runbooks with lessons learned
- [ ] Plan for next improvements

## Rollback Procedure (If Needed)

### Immediate Actions
- [ ] Declare incident
- [ ] Notify team
- [ ] Page on-call engineer
- [ ] Enable incident communication channel

### Execute Rollback
```bash
# Identify previous stable version
git tag -l | tail -5

# Update to previous version
export API_TAG=v1.x.x  # Previous version
export WEB_TAG=v1.x.x

# Pull previous images
docker-compose -f docker-compose.prod.yml pull

# Restart with previous images
docker-compose -f docker-compose.prod.yml up -d

# Verify health
./scripts/health-check.sh
```

### Database Rollback
```bash
# If data corruption suspected
# Restore from pre-deployment backup
gunzip -c backup-before-deployment.sql.gz | \
  psql $DATABASE_URL

# Verify
psql $DATABASE_URL -c "SELECT COUNT(*) FROM users;"
```

### Communication
- [ ] Update status page
- [ ] Notify affected users
- [ ] Document incident
- [ ] Schedule post-mortem

## Success Criteria

Deployment is considered successful when:

- ✓ All containers healthy for 2+ hours
- ✓ Error rate < 0.5%
- ✓ API response time p95 < 500ms
- ✓ No critical issues reported
- ✓ All 2FA tests passing
- ✓ Database performing normally
- ✓ All monitoring alerts configured
- ✓ Team reports confidence in deployment

## Emergency Contacts

| Role | Name | Phone | Email |
|------|------|-------|-------|
| Engineering Lead | | | |
| DevOps Lead | | | |
| DBA | | | |
| Product Manager | | | |
| Executive On-Call | | | |

## Notes

Space for notes during deployment:

```
Timeline:
- [00:00] Deployment started
- [00:15] Database migrations completed
- [00:20] Services healthy
- [00:30] All tests passing
- [00:45] Deployment completed

Issues encountered:
(none)

Resolution:
(n/a)

Completed by: ________________  Date: ________________
```

---

## Related Documentation

- [Deployment Guide](./DEPLOYMENT_GUIDE.md)
- [Troubleshooting Runbook](./TROUBLESHOOTING_RUNBOOK.md)
- [Environment Variables](./ENVIRONMENT_VARIABLES.md)
- [Monitoring Guide](./MONITORING_GUIDE.md)
- [GitHub Actions Workflow](./.github/workflows/2fa-tests.yml)

---

**Version**: 1.0.0
**Last Updated**: 2024-03-17
**Next Review**: 2024-04-17
