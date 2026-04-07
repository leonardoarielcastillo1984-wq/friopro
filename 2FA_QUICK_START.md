# 2FA Production Features - Quick Start

## TL;DR - 5 Minute Setup

### 1. Configure Environment
```bash
# .env.local
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_xxxxx
EMAIL_FROM=SGI 360 <noreply@sgi360.com>
REDIS_URL=redis://localhost:6379
```

### 2. Start Services
```bash
redis-server                    # Terminal 1
cd apps/api && npm run dev      # Terminal 2
```

### 3. Test Integration
```bash
# Enable 2FA
curl -X POST http://localhost:3001/2fa/setup \
  -H "Authorization: Bearer TOKEN"

# Check audit logs
curl http://localhost:3001/2fa/audit-logs \
  -H "Authorization: Bearer TOKEN"
```

Done! 🎉

---

## What Was Implemented

### 1. Email Notifications ✅
- 2FA enable/disable confirmations
- Suspicious login alerts
- Recovery code generation notices
- Security alerts
- **Provider**: Resend (or SMTP/Console)
- **Queue**: BullMQ + Redis
- **Retry**: Automatic with exponential backoff

### 2. Audit Logging ✅
- All 2FA events logged (enable, disable, verify, recovery codes)
- All login attempts tracked
- Security events recorded
- **Storage**: PostgreSQL AuditEvent table
- **Query**: API endpoints for users and admins
- **Retention**: 7-year compliance-ready

### 3. Rate Limiting ✅
- Login: 5 per minute
- 2FA: 10 per minute
- Password reset: 3 per hour
- **Engine**: Redis sliding window
- **Headers**: X-RateLimit-* on all responses
- **Status**: HTTP 429 when exceeded

---

## File Guide

### Core Implementation (5 files)
| File | Purpose |
|------|---------|
| `src/services/auditLogger.ts` | Event logging |
| `src/jobs/emailQueue.ts` | Async email worker |
| `src/middleware/rateLimiter.ts` | Rate limiting |
| `src/routes/twoFactorAuthEnhanced.ts` | Enhanced 2FA routes |
| `src/services/email.ts` | 2FA email templates |

### Email Templates (5 files)
| Template | Event |
|----------|-------|
| `2fa-enabled.html` | 2FA activated |
| `2fa-disabled.html` | 2FA deactivated |
| `suspicious-login.html` | New device detected |
| `recovery-codes-generated.html` | Recovery codes created |
| `security-alert.html` | General alerts |

### Documentation (4 guides)
| Guide | Contains |
|-------|----------|
| `EMAIL_SETUP_GUIDE.md` | Email provider setup |
| `AUDIT_LOGGING_GUIDE.md` | Audit logging details |
| `RATE_LIMITING_GUIDE.md` | Rate limit configuration |
| `2FA_PRODUCTION_INTEGRATION.md` | Full integration steps |

---

## API Endpoints

### User Endpoints
```
POST   /2fa/setup                  # Start 2FA setup
POST   /2fa/confirm                # Confirm with TOTP code
POST   /2fa/disable                # Disable 2FA
POST   /2fa/recovery-codes         # Generate new codes
POST   /2fa/verify                 # Verify TOTP (login)
GET    /2fa/status                 # Current 2FA status
GET    /2fa/audit-logs             # My 2FA audit logs
GET    /2fa/security-events        # My security events
```

### Admin Endpoints
```
GET    /2fa/user/:userId/audit-logs  # Any user's logs
POST   /admin/email-queue/cleanup     # Cleanup email queue
GET    /admin/email-queue/stats       # Email queue status
POST   /admin/rate-limit/reset/:ip    # Reset rate limit
GET    /admin/rate-limits/status/:ip  # Check rate limits
```

---

## Environment Variables

### Required
```bash
EMAIL_PROVIDER=resend              # console | resend | smtp
RESEND_API_KEY=re_xxxxx            # If using Resend
EMAIL_FROM=SGI 360 <noreply@...>
REDIS_URL=redis://localhost:6379
```

### Optional
```bash
SUPPORT_URL=https://support.sgi360.com
CONTACT_URL=https://contact.sgi360.com
EMAIL_WORKER_CONCURRENCY=5
RATE_LIMIT_LOGIN_MAX=5
RATE_LIMIT_2FA_MAX=10
```

---

## Integration Checklist

```
Setup Phase:
  ☐ Copy .env.example to .env.local
  ☐ Configure email provider
  ☐ Configure Redis URL
  ☐ Run: npm install (already done)

Development Phase:
  ☐ Register enhanced 2FA routes
  ☐ Initialize email worker
  ☐ Initialize rate limiter
  ☐ Test email sending
  ☐ Test audit logs
  ☐ Test rate limits

Testing Phase:
  ☐ Unit tests for each component
  ☐ Integration tests for flows
  ☐ Load test with 1000+ requests
  ☐ Email provider credentials verified
  ☐ Database connections tested

Production Phase:
  ☐ Monitor email queue growth
  ☐ Monitor audit log writes
  ☐ Monitor rate limit hits
  ☐ Setup alerts
  ☐ Document procedures
```

---

## Common Tasks

### Check Email Queue Status
```bash
redis-cli LLEN 'bull:email-notifications:*'
```

### View Audit Logs
```bash
curl http://localhost:3001/2fa/audit-logs \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test Email Sending
```bash
curl -X POST http://localhost:3001/test/send-email \
  -H "Content-Type: application/json" \
  -d '{"to":"test@example.com"}'
```

### Reset Rate Limit for IP
```bash
curl -X POST http://localhost:3001/admin/rate-limit/reset/192.168.1.1 \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### Check Rate Limit Status
```bash
curl http://localhost:3001/admin/rate-limits/status/192.168.1.1 \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

---

## Troubleshooting

### Issue: Emails not sending
```bash
# Check Redis
redis-cli PING                # Should return PONG

# Check email provider
echo $RESEND_API_KEY          # Should not be empty

# Check logs
npm run dev 2>&1 | grep -i email
```

### Issue: Rate limits not working
```bash
# Check Redis connection
redis-cli KEYS 'ratelimit:*'  # Should show keys

# Test rate limit
for i in {1..10}; do curl http://localhost:3001/2fa/verify; done
```

### Issue: Audit logs not recording
```bash
# Check database
psql $DATABASE_URL -c "SELECT COUNT(*) FROM \"AuditEvent\";"

# Check logs for errors
npm run dev 2>&1 | grep -i audit
```

---

## Monitoring

### Key Metrics
```sql
-- Email queue size
SELECT COUNT(*) FROM bull:email-notifications:* (Redis)

-- Failed emails
SELECT COUNT(*) FROM "AuditEvent"
WHERE action = 'EMAIL_FAILED'
AND "createdAt" > NOW() - INTERVAL '1 hour';

-- Rate limit violations
SELECT COUNT(*) FROM "AuditEvent"
WHERE action = 'RATE_LIMIT_EXCEEDED'
AND "createdAt" > NOW() - INTERVAL '1 hour';
```

### Alerts to Setup
- [ ] Email queue > 1000 items
- [ ] Email failure rate > 5%
- [ ] Audit log write latency > 100ms
- [ ] Redis memory > 80% used
- [ ] Rate limit violations > 100/hour

---

## Performance Expectations

| Metric | Expected |
|--------|----------|
| Email send latency | <5 seconds |
| Audit log write | <10ms |
| Rate limit check | <1ms |
| 2FA setup | <1 second |
| 2FA verify | <1 second |

---

## Security Notes

✅ API keys in environment variables
✅ Rate limiting prevents brute force
✅ Audit trail for compliance
✅ Email templates sanitized
✅ Password never logged
✅ TOTP code never logged
✅ Recovery codes hashed

---

## Next Steps

1. **Setup**: Follow 5-minute setup above
2. **Configure**: Copy `.env.example` and add credentials
3. **Test**: Run integration tests
4. **Deploy**: Follow `2FA_PRODUCTION_INTEGRATION.md`
5. **Monitor**: Setup dashboard and alerts

---

## Get Help

### Quick Reference
- **Email Issues**: See `EMAIL_SETUP_GUIDE.md` section 8 (Troubleshooting)
- **Audit Issues**: See `AUDIT_LOGGING_GUIDE.md` section 9 (Troubleshooting)
- **Rate Limit Issues**: See `RATE_LIMITING_GUIDE.md` section 9 (Troubleshooting)

### Full Documentation
- `2FA_PRODUCTION_INTEGRATION.md` - Complete integration guide
- `2FA_FEATURES_IMPLEMENTATION_SUMMARY.md` - Full project summary

### Contact
- Email: devops@sgi360.com
- Slack: #security-engineering
- Issues: GitHub/GitLab issues

---

## Success Criteria

After implementation:
- ✅ Users receive email on 2FA enable/disable
- ✅ Suspicious logins detected and emailed
- ✅ All 2FA events in audit log
- ✅ Rate limiting prevents attacks
- ✅ < 5% email failure rate
- ✅ Zero database performance issues
- ✅ Admin can view audit logs

---

**You're all set! 🚀**

For detailed documentation, see the 4 setup guides in the root directory.
