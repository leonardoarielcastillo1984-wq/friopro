# Security Testing Framework for SGI 360

## Overview

This document describes the comprehensive security testing framework for SGI 360, covering OWASP Top 10 vulnerabilities, CI/CD integration, and production deployment guidelines.

## Components

### 1. OWASP Top 10 Vulnerability Scanner

The security testing framework includes automated tests for:

#### A1: SQL Injection Prevention
- Tests against SQL injection in login endpoint
- Tests against SQL injection in search endpoints
- Uses parameterized queries and prepared statements

**Prevention Measures:**
- Use ORM (Prisma) with prepared statements
- Input validation and sanitization
- Use parameterized queries for raw SQL

**Test Location:** `tests/security/owasp-scanner.test.ts`

#### A2: Authentication & Session Management
- Enforces strong session tokens (50+ characters)
- Prevents session fixation attacks
- Validates token strength and uniqueness

**Prevention Measures:**
- Generate cryptographically secure tokens
- Use HTTPS only for transmission
- Implement session timeout (default: 1 hour)
- Regenerate tokens on re-authentication

#### A3: Cross-Site Scripting (XSS)
- Sanitizes HTML in document uploads
- Sets CSP (Content-Security-Policy) headers
- Validates input and escapes output

**Prevention Measures:**
- HTML sanitization library (DOMPurify)
- CSP headers configured in app.ts
- Output encoding for all user input
- Input validation using Zod schemas

#### A4: Broken Access Control
- Protects admin endpoints from unauthorized access
- Enforces role-based access control (RBAC)
- Validates user permissions on every endpoint

**Prevention Measures:**
- Role-based middleware in routes
- Permission checks before resource access
- Separate admin routes with strict authentication

#### A5: Security Misconfiguration
- Prevents debug information exposure in errors
- Validates security headers configuration
- Uses secure defaults for all settings

**Prevention Measures:**
- Custom error handlers that don't expose stack traces
- Security headers via Helmet.js
- Environment-based configuration
- No debug information in production

#### A6: Sensitive Data Exposure
- Enforces HTTPS with HSTS headers
- Prevents sensitive data exposure in logs
- Masks sensitive information in responses

**Prevention Measures:**
- TLS 1.2+ enforced
- HSTS header (31536000 seconds)
- No plaintext password transmission
- Encrypted data at rest (bcrypt/Argon2)

#### A7: Cross-Site Request Forgery (CSRF)
- Requires CSRF tokens for state-changing operations
- Validates CORS configuration
- Uses SameSite cookies

**Prevention Measures:**
- CSRF token validation in csrfPlugin
- SameSite=Strict cookies
- Double-submit-cookie pattern
- Referrer header validation

#### A8: Insecure Deserialization
- Validates deserialized objects safely
- Prevents prototype pollution attacks
- Validates object schema with Zod

**Prevention Measures:**
- Zod schema validation on all inputs
- No unsafe object deserialization
- Type-safe parsing

#### A9: Using Components with Known Vulnerabilities
- Automated dependency scanning
- Regular npm audit checks
- Up-to-date dependency management

**Prevention Measures:**
- `npm audit` in CI/CD
- Dependency update strategy
- Security advisory monitoring

#### A10: Insufficient Logging & Monitoring
- Logs security events (failed logins, etc.)
- Audit trail for sensitive operations
- Alert configuration for suspicious activities

**Prevention Measures:**
- Comprehensive audit logging
- Security event logging
- Real-time alert system
- Log retention policies

### 2. CSRF Test Suite

Location: `tests/security/csrf.test.ts`

Tests the following CSRF protection mechanisms:

- CSRF token validation
- Token regeneration after login
- Double-submit-cookie pattern
- SameSite cookie protection
- Referer header validation
- Token expiration
- CORS and CSRF interaction

### 3. Web Application Firewall (WAF) Configuration

Location: `infra/security/modsecurity-rules.conf`

Implements ModSecurity with rules for:

#### DDoS Protection
- Rate limiting (100 req/min global, 10 req/min for login)
- Connection limiting (100 per IP)
- Bandwidth limiting
- Slowloris attack prevention

#### Bot Detection
- Known bad bot blocking
- User-Agent validation
- Behavioral analysis
- Whitelist for legitimate crawlers

#### Malicious Request Blocking
- SQL injection patterns
- XSS payload detection
- Command injection prevention
- Path traversal blocking
- File upload validation

#### Logging & Alerting
- All denied requests logged
- Critical rule alerts (XSS, SQL injection)
- Authentication failure tracking

### 4. SSL/TLS Automation

Location: `infra/security/ssl-tls-setup.sh`

Automates:

1. **Let's Encrypt Integration**
   - Automatic certificate generation
   - Multi-domain support
   - SAN (Subject Alternative Name) certificates

2. **Auto-Renewal**
   - Systemd timer (recommended)
   - Cron job backup
   - Renewal logging
   - Automatic nginx reload

3. **HSTS Configuration**
   - max-age: 1 year (31536000 seconds)
   - includeSubDomains enabled
   - Preload list enabled

4. **Certificate Pinning**
   - SPKI hash generation
   - HPKP header configuration
   - Backup certificate pins

5. **TLS Hardening**
   - TLS 1.2+ minimum
   - Strong cipher suite
   - OCSP stapling
   - DH parameters (2048-bit)
   - Session ticket configuration

## CI/CD Integration

### GitHub Actions Workflow

Create `.github/workflows/security-tests.yml`:

```yaml
name: Security Tests

on: [push, pull_request]

jobs:
  security-tests:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run OWASP security tests
        run: npm run test:security

      - name: Run CSRF tests
        run: npm run test:csrf

      - name: Dependency audit
        run: npm audit --audit-level=moderate

      - name: SAST scanning (if available)
        run: npm run scan:sast || true

      - name: Upload test results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: security-test-results
          path: test-results/

  sca-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Run Snyk scan
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        run: npm run scan:snyk || true
```

### Local Testing

Run security tests locally:

```bash
# Run all security tests
npm run test:security

# Run specific test suites
npm run test:security:owasp
npm run test:security:csrf

# Run dependency audit
npm audit

# Check for vulnerable packages
npm audit fix
```

## Deployment Checklist

- [ ] SSL/TLS certificate installed and valid
- [ ] HSTS headers enabled
- [ ] Certificate pinning configured
- [ ] Auto-renewal configured (systemd timer)
- [ ] All security headers in place
- [ ] CORS properly configured
- [ ] CSRF protection enabled
- [ ] Rate limiting configured
- [ ] WAF rules deployed
- [ ] Logging and alerting configured
- [ ] Security tests passing
- [ ] Dependencies up to date
- [ ] No high/critical vulnerabilities in npm audit
- [ ] Production environment variables secured
- [ ] Database encryption enabled
- [ ] Backup and recovery tested

## Monitoring & Maintenance

### Certificate Monitoring

Monitor certificate expiration:

```bash
# Check certificate expiration
openssl x509 -in /etc/letsencrypt/live/sgi360.example.com/cert.pem -enddate -noout

# Run certificate monitoring script
./infra/security/ssl-tls-setup.sh verify
```

### WAF Log Analysis

```bash
# View WAF blocked requests
tail -f /var/log/modsecurity_audit.log

# Count attacks by type
grep "RuleID" /var/log/modsecurity_audit.log | sort | uniq -c
```

### Security Event Logging

Monitor audit trail for security events:

```bash
# Query recent security events
SELECT * FROM audit_logs
WHERE action IN ('LOGIN_FAILED', 'UNAUTHORIZED_ACCESS')
ORDER BY created_at DESC
LIMIT 100;
```

## Incident Response

### SQL Injection Detected

1. Check WAF logs for attack patterns
2. Review affected tables and data
3. Check for data exfiltration
4. Apply patches to vulnerable code
5. Update WAF rules if needed

### XSS Attack Detected

1. Identify injection point
2. Sanitize affected data
3. Update CSP headers if needed
4. Notify affected users
5. Review security testing

### Authentication Bypass

1. Invalidate affected sessions
2. Force password reset if needed
3. Review authentication logic
4. Enable additional MFA for affected users
5. Implement additional protections

## Compliance

The security framework addresses requirements for:

- **PCI-DSS**: Encryption, authentication, access control
- **HIPAA**: Audit logging, encryption, access control
- **GDPR**: Data protection, encryption, audit trail
- **SOC2**: Security controls, logging, monitoring

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP Testing Guide](https://owasp.org/www-project-web-security-testing-guide/)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [ModSecurity Documentation](https://modsecurity.org/documentation/)
- [HSTS Preload List](https://hstspreload.org/)

