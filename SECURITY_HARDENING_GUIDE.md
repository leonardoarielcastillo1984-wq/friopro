# Security Hardening Guide - SGI 360 2FA System

## Overview

This guide documents the security hardening measures implemented in the SGI 360 2FA system, including API security, data protection, and deployment best practices.

---

## Table of Contents

1. [Security Headers](#security-headers)
2. [Input Validation & Sanitization](#input-validation--sanitization)
3. [Authentication & Authorization](#authentication--authorization)
4. [Cookie & Session Security](#cookie--session-security)
5. [CORS & CSRF Protection](#cors--csrf-protection)
6. [Rate Limiting](#rate-limiting)
7. [SQL Injection Prevention](#sql-injection-prevention)
8. [XSS Prevention](#xss-prevention)
9. [Production Deployment Checklist](#production-deployment-checklist)
10. [Monitoring & Logging](#monitoring--logging)

---

## Security Headers

### HSTS (HTTP Strict Transport Security)

**Configuration:**
```typescript
hsts: {
  maxAge: 31536000, // 1 year
  includeSubDomains: true,
  preload: true,
}
```

**What it does:**
- Forces browsers to always use HTTPS
- Prevents downgrade attacks
- Protects against man-in-the-middle attacks

**Deployment Notes:**
- Set `maxAge` to 31536000 (1 year) in production
- Enable `preload` to include domain in HSTS preload list
- Test thoroughly before enabling with `includeSubDomains`

### Content Security Policy (CSP)

**Configuration:**
```typescript
contentSecurityPolicy: {
  directives: {
    defaultSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    scriptSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:', 'https:'],
  },
}
```

**What it does:**
- Controls which resources can be loaded
- Prevents inline script injection
- Restricts resource origins

**Recommendations:**
- Remove `'unsafe-inline'` for scripts in production if possible
- Implement nonce-based CSP for dynamic scripts
- Monitor CSP violations using `report-uri`

### X-Frame-Options

**Configuration:**
```typescript
frameguard: {
  action: 'deny',
}
```

**What it does:**
- Prevents clickjacking attacks
- Disallows framing of the application

### Other Headers

**Implemented:**
- **X-Content-Type-Options: nosniff** - Prevents MIME sniffing
- **X-XSS-Protection** - Browser-level XSS protection
- **Referrer-Policy: strict-origin-when-cross-origin** - Controls referrer information

---

## Input Validation & Sanitization

### Zod Schemas

All endpoints use Zod for strict input validation:

```typescript
const setupSchema = z.object({
  token: z.string().regex(/^\d{6}$/, 'Token must be 6 digits'),
});
```

**Benefits:**
- Type-safe validation
- Clear error messages
- Prevents malformed data
- Automatic response formatting

### Validation Rules

**Email:**
- RFC 5322 compliant email validation
- Lowercase normalization

**Passwords:**
- Minimum 8 characters
- Should contain: uppercase, lowercase, numbers, special characters
- Checked during user creation

**TOTP Tokens:**
- Exactly 6 digits
- Regex pattern: `^\d{6}$`

**UUIDs:**
- UUID v4 format validation
- Used for all IDs

### Sanitization

**Database Queries:**
- Prisma ORM with parameterized queries (no string concatenation)
- Automatic SQL injection prevention

**String Inputs:**
- Trimmed of whitespace
- Length validated
- Pattern validated where applicable

---

## Authentication & Authorization

### JWT Token Security

**Token Structure:**
- Issued with 24-hour expiration
- Contains user ID and role
- Signed with secure algorithm (HS256 or RS256)

**Best Practices:**
1. Use short expiration times (24 hours recommended)
2. Implement refresh token mechanism
3. Revoke tokens on logout
4. Store tokens securely in HttpOnly cookies or secure storage

**Environment Variables Required:**
```
JWT_SECRET=your-super-secret-key-minimum-32-characters
JWT_EXPIRATION=86400 # 24 hours in seconds
```

### Role-Based Access Control (RBAC)

**Admin Routes:**
```typescript
function requireAdmin(user: any) {
  if (user?.globalRole !== 'SUPER_ADMIN' && user?.globalRole !== 'TENANT_ADMIN') {
    throw new Error('Admin access required');
  }
}
```

**Roles Implemented:**
- `SUPER_ADMIN` - Full system access
- `TENANT_ADMIN` - Tenant-level access
- `USER` - Standard user permissions

**Authorization Checks:**
- All admin endpoints verify role before executing
- User can only access their own resources
- Audit logging of permission denials

---

## Cookie & Session Security

### Secure Cookie Configuration

**Recommended Settings:**
```javascript
// In your cookie middleware configuration
{
  httpOnly: true,        // JavaScript cannot access
  secure: true,          // HTTPS only
  sameSite: 'strict',    // CSRF protection
  maxAge: 86400000,      // 24 hours
  domain: 'sgi360.com',  // Specific domain
  path: '/',             // Root path only
}
```

**Environment Variables:**
```
COOKIE_SECURE=true
COOKIE_HTTP_ONLY=true
COOKIE_SAME_SITE=strict
COOKIE_MAX_AGE=86400000
```

### Session Management

**Session Token Security:**
- Temporary tokens for 2FA flow
- 10-minute expiration
- Single-use validation
- IP address verification (optional)

**Token Storage:**
- Never in localStorage for sensitive tokens
- Use HttpOnly cookies
- Secure transmission over HTTPS

---

## CORS & CSRF Protection

### CORS Configuration

**Allowed Origins:**
```typescript
{
  origin: corsOrigin.split(',').map((o) => o.trim()),
  credentials: true,
}
```

**Environment Variable:**
```
CORS_ORIGIN=https://sgi360.com,https://admin.sgi360.com
```

**Best Practices:**
- Whitelist specific origins
- Never use `*` in production
- Separate different environments
- Use exact domain matching

### CSRF Protection

**Implementation:**
- CSRF token generation for state-changing operations
- Token validation on POST/PUT/DELETE requests
- SameSite cookie attribute as additional layer

**Token Validation Flow:**
```
1. Client requests CSRF token
2. Server generates and returns token
3. Client includes token in form data
4. Server validates token against session
5. Process request if valid
```

---

## Rate Limiting

### Configuration

**Global Rate Limit:**
```typescript
{
  max: 200,
  timeWindow: '1 minute',
}
```

**Endpoint-Specific Rate Limits:**
- Login attempts: 5 per minute per IP
- 2FA verification: 3 attempts per minute per session
- Admin operations: 20 per minute per user
- Password reset: 1 per hour per email

**Implementation:**
```typescript
// Per-endpoint rate limiting
app.post('/auth/login', {
  rateLimit: { max: 5, timeWindow: '1 minute' }
}, loginHandler);
```

**Monitoring:**
- Log rate limit violations
- Alert on suspicious patterns (brute force detection)
- Implement exponential backoff for repeated failures

---

## SQL Injection Prevention

### Prisma ORM Protection

**All queries use parameterized statements:**
```typescript
// Safe - Parameterized
await app.prisma.user.findUnique({
  where: { id: userId }
});

// NEVER do this:
// const query = `SELECT * FROM users WHERE id = '${userId}'`
```

**Benefits:**
- Automatic escaping
- Type safety
- Query validation
- Protection against common attacks

### Input Length Limits

**Database Fields:**
- Email: 255 characters
- Name: 100 characters
- Password: 128 characters
- Recovery codes: 20 codes maximum

---

## XSS Prevention

### Content Security Policy

- Blocks inline scripts
- Restricts script sources
- Prevents unauthorized resource loading

### React Component Security

**In Admin Dashboard:**
- No `dangerouslySetInnerHTML`
- Automatic escaping of user-generated content
- Input validation before rendering

### HTTP Headers

```
Content-Type: application/json
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
```

---

## Production Deployment Checklist

### Pre-Deployment

- [ ] All environment variables configured
- [ ] SSL/TLS certificate valid and updated
- [ ] Database backups enabled
- [ ] Monitoring and alerting configured
- [ ] Logging aggregation set up
- [ ] Security audit completed
- [ ] Load testing performed
- [ ] Disaster recovery plan in place

### Environment Variables

```bash
# Core
NODE_ENV=production
API_PORT=3001
DATABASE_URL=postgresql://user:pass@host:5432/sgi360

# Security
JWT_SECRET=your-super-secret-key-minimum-32-characters-long
JWT_EXPIRATION=86400
SESSION_SECRET=your-session-secret-key-minimum-32-characters

# CORS
CORS_ORIGIN=https://sgi360.com,https://admin.sgi360.com

# Cookies
COOKIE_SECURE=true
COOKIE_HTTP_ONLY=true
COOKIE_SAME_SITE=strict

# Rate Limiting
RATE_LIMIT_MAX=200
RATE_LIMIT_WINDOW=1m

# Email (for alerts)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=your-sendgrid-api-key
SMTP_FROM=noreply@sgi360.com
SUPPORT_EMAIL=support@sgi360.com

# Monitoring
SENTRY_DSN=your-sentry-dsn
LOG_LEVEL=info
```

### Security Headers Deployment

**Nginx Configuration:**
```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'" always;
```

### HTTPS Configuration

- [ ] Redirect HTTP to HTTPS
- [ ] Valid SSL/TLS certificate (not self-signed)
- [ ] Certificate auto-renewal enabled (Let's Encrypt)
- [ ] TLS 1.2 or higher only
- [ ] Strong cipher suites
- [ ] OCSP stapling enabled

### Database Security

- [ ] Separate database user with limited permissions
- [ ] Password-protected database connections
- [ ] Regular automated backups
- [ ] Encryption at rest enabled
- [ ] Encryption in transit enforced (SSL)
- [ ] Access logs enabled
- [ ] Database activity monitoring

### Application Server Security

- [ ] Run with non-root user
- [ ] File permissions configured correctly (chmod 640)
- [ ] No debug mode in production
- [ ] Sensitive files not accessible via HTTP
- [ ] Process monitoring and auto-restart
- [ ] Log rotation configured

### Network Security

- [ ] Firewall configured
- [ ] Only necessary ports open (80, 443)
- [ ] DDoS protection enabled
- [ ] Web Application Firewall (WAF) configured
- [ ] Rate limiting at infrastructure level
- [ ] VPN access for admin tools

---

## Monitoring & Logging

### Audit Logging

**Events Logged:**
- User login attempts (success/failure)
- 2FA setup, confirmation, and disabling
- 2FA verification attempts
- Recovery code usage
- Admin actions
- API errors and exceptions
- Security violations (rate limits, invalid tokens, etc.)

**Audit Log Fields:**
```typescript
{
  userId: string;           // User performing action
  action: string;           // Action type
  timestamp: Date;          // When it happened
  ipAddress: string;        // Source IP
  userAgent: string;        // Browser/client info
  details: Record<string, any>; // Action-specific details
}
```

### Metrics to Monitor

**Security Metrics:**
- Failed login attempts by user/IP
- 2FA verification failures
- Rate limit violations
- Invalid token attempts
- Admin action frequency
- API error rates

**Performance Metrics:**
- Response times
- Database query times
- API endpoint usage
- 2FA processing time

**Alerts (Critical):**
- 5+ failed logins in 1 minute
- 10+ rate limit violations from single IP
- Database connection failures
- Unauthorized admin access attempts
- Unexpected API errors

### Logging Best Practices

**Never Log:**
- Passwords or password hashes
- Tokens or session IDs
- Recovery codes
- Sensitive user data
- Credit card information

**Always Log:**
- User actions and intent
- Timestamps and duration
- IP addresses and user agents
- Error messages and stack traces
- Authorization decisions

**Log Levels:**
- `ERROR` - Security issues, failures
- `WARN` - Rate limits, suspicious patterns
- `INFO` - User actions, admin operations
- `DEBUG` - Detailed debugging info (development only)

### Log Retention

```
- Audit logs: 1 year minimum
- Security logs: 90 days minimum
- Application logs: 30 days
- Access logs: 30 days
```

### Vulnerability Management

**Regular Activities:**
- Weekly security updates
- Monthly dependency updates
- Quarterly penetration testing
- Annual security audit
- Continuous vulnerability scanning

**Tools:**
- npm audit
- Snyk
- OWASP ZAP
- Burp Suite Community

---

## 2FA-Specific Security

### Recovery Codes Security

**Generation:**
- 10 unique codes per user
- Random alphanumeric (8 characters each)
- One-time use enforced
- Marked as used after consumption

**Storage:**
- Hashed in database (not plaintext)
- Salted with user-specific salt
- Retrieved only during 2FA setup and verification

**User Responsibility:**
- Store securely (password manager recommended)
- Never share with anyone
- Regenerate if compromised

### TOTP Token Validation

**Algorithm:**
- HMAC-SHA1
- 30-second time window
- Support for time skew (±1 window)

**Validation Rules:**
- Exactly 6 digits
- Must not be previously used
- Token age checked (not more than 30 seconds old)
- Prevents replay attacks

### Session Token Security

**Characteristics:**
- Generated using crypto.randomBytes(32)
- 10-minute expiration
- Invalidated after successful 2FA
- Invalidated after failed attempts (3 failures = session reset)

---

## Security Testing

### Manual Testing Checklist

- [ ] Test login with invalid credentials
- [ ] Test 2FA setup without confirmation
- [ ] Test TOTP token validation (wrong code, old code)
- [ ] Test recovery code usage
- [ ] Test admin access without proper role
- [ ] Test rate limiting on login endpoint
- [ ] Test CORS with different origins
- [ ] Test XSS injection in name fields
- [ ] Test SQL injection in search fields
- [ ] Test CSRF token validation

### Automated Testing

```bash
# Run security tests
npm run test:security

# Dependency vulnerability scan
npm audit

# OWASP dependency check
npx audit-ci --moderate

# Penetration testing
npm run test:penetration
```

---

## Incident Response

### Security Incident Classification

**Critical:**
- Data breach confirmed
- Service unavailable
- Unauthorized admin access

**High:**
- Suspected data breach
- Multiple failed login attempts
- Rate limit attacks

**Medium:**
- Single failed admin attempt
- Suspicious patterns
- Configuration issues

**Low:**
- Informational findings
- Best practice recommendations

### Incident Response Process

1. **Detection** - Automated alerts or manual discovery
2. **Containment** - Stop spread, isolate affected systems
3. **Investigation** - Determine scope and root cause
4. **Recovery** - Restore systems to safe state
5. **Notification** - Inform affected users
6. **Post-Incident** - Review and improve

### Notification Requirements

- [ ] Privacy officer notified immediately
- [ ] Affected users notified within 24 hours
- [ ] Regulatory authorities notified if required
- [ ] Public disclosure if necessary
- [ ] RCA completed within 48 hours

---

## Compliance

### Standards Aligned

- **OWASP Top 10** - Addresses all major vulnerabilities
- **CWE Top 25** - Mitigates common weaknesses
- **NIST Cybersecurity Framework** - Follows best practices
- **ISO/IEC 27001** - Information security management

### Regulatory Compliance

- **GDPR** - User data protection and privacy
- **SOC 2** - Security and availability controls
- **HIPAA** - If handling health information
- **PCI-DSS** - If processing payments

---

## References

- [OWASP Web Security Testing Guide](https://owasp.org/www-project-web-security-testing-guide/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [Fastify Security Guide](https://www.fastify.io/docs/latest/Guides/Security/)
- [Helmet.js Documentation](https://helmetjs.github.io/)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [2FA Best Practices](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html#multi-factor-authentication-mfa)

---

**Last Updated:** March 17, 2026
**Document Version:** 1.0
**Status:** Production Ready
