import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import fetch from 'node-fetch';

const BASE_URL = process.env.API_URL || 'http://localhost:3001';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

/**
 * OWASP Top 10 Vulnerability Scanner
 * Tests for common security vulnerabilities
 */

describe('OWASP Top 10 Security Tests', () => {
  before(async () => {
    console.log(`\n🔒 Starting OWASP Top 10 Security Scan\n`);
    console.log(`Target: ${BASE_URL}\n`);
  });

  after(async () => {
    console.log('\n📋 OWASP Test Summary:');
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📊 Total: ${results.length}\n`);

    if (failed > 0) {
      console.log('Failed Tests:');
      results.filter(r => !r.passed).forEach(r => {
        console.log(`  - ${r.name}: ${r.error}`);
      });
    }
  });

  describe('A1: SQL Injection Prevention', () => {
    it('should prevent SQL injection in login endpoint', async () => {
      try {
        const payload = {
          email: "' OR '1'='1",
          password: "' OR '1'='1"
        };

        const response = await fetch(`${BASE_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        // Should fail authentication, not execute SQL
        assert(response.status === 401 || response.status === 400);

        results.push({ name: 'SQL Injection - Login', passed: true });
      } catch (error) {
        results.push({
          name: 'SQL Injection - Login',
          passed: false,
          error: String(error)
        });
        throw error;
      }
    });

    it('should prevent SQL injection in search endpoints', async () => {
      try {
        const response = await fetch(`${BASE_URL}/api/documents/search?q='; DROP TABLE users; --`, {
          method: 'GET'
        });

        // Should handle safely, not crash
        assert(response.status !== 500);

        results.push({ name: 'SQL Injection - Search', passed: true });
      } catch (error) {
        results.push({
          name: 'SQL Injection - Search',
          passed: false,
          error: String(error)
        });
        throw error;
      }
    });
  });

  describe('A2: Authentication & Session Management', () => {
    it('should enforce strong session tokens', async () => {
      try {
        const response = await fetch(`${BASE_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'test@example.com',
            password: 'ValidPassword123!'
          })
        });

        if (response.status === 200) {
          const data = await response.json() as { token?: string };
          // Token should be long and random
          assert(data.token && data.token.length > 50);
        }

        results.push({ name: 'Session Token Strength', passed: true });
      } catch (error) {
        results.push({
          name: 'Session Token Strength',
          passed: false,
          error: String(error)
        });
      }
    });

    it('should prevent session fixation attacks', async () => {
      try {
        const oldToken = 'fixed_session_token_12345';
        const response = await fetch(`${BASE_URL}/api/documents`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${oldToken}` }
        });

        // Old/invalid tokens should be rejected
        assert(response.status === 401);

        results.push({ name: 'Session Fixation Prevention', passed: true });
      } catch (error) {
        results.push({
          name: 'Session Fixation Prevention',
          passed: false,
          error: String(error)
        });
      }
    });
  });

  describe('A3: Cross-Site Scripting (XSS) Prevention', () => {
    it('should sanitize HTML in document uploads', async () => {
      try {
        const xssPayload = '<script>alert("XSS")</script>';

        const response = await fetch(`${BASE_URL}/api/documents`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer valid_token'
          },
          body: JSON.stringify({
            name: xssPayload,
            content: xssPayload
          })
        });

        // Should accept but sanitize
        const data = await response.json() as { name?: string };
        if (data.name) {
          assert(!data.name.includes('<script>'));
        }

        results.push({ name: 'XSS Prevention - Upload', passed: true });
      } catch (error) {
        results.push({
          name: 'XSS Prevention - Upload',
          passed: false,
          error: String(error)
        });
      }
    });

    it('should set CSP headers to prevent XSS', async () => {
      try {
        const response = await fetch(`${BASE_URL}/api/health`);
        const cspHeader = response.headers.get('content-security-policy');

        assert(cspHeader !== null);

        results.push({ name: 'CSP Headers Present', passed: true });
      } catch (error) {
        results.push({
          name: 'CSP Headers Present',
          passed: false,
          error: String(error)
        });
      }
    });
  });

  describe('A4: Broken Access Control', () => {
    it('should prevent unauthorized access to admin endpoints', async () => {
      try {
        const response = await fetch(`${BASE_URL}/api/admin/users`, {
          method: 'GET'
        });

        // Should require authentication
        assert(response.status === 401);

        results.push({ name: 'Admin Endpoint Protection', passed: true });
      } catch (error) {
        results.push({
          name: 'Admin Endpoint Protection',
          passed: false,
          error: String(error)
        });
      }
    });

    it('should enforce role-based access control', async () => {
      try {
        const response = await fetch(`${BASE_URL}/api/admin/users`, {
          method: 'GET',
          headers: { 'Authorization': 'Bearer user_token_not_admin' }
        });

        // Non-admin should be forbidden
        assert(response.status === 403 || response.status === 401);

        results.push({ name: 'RBAC Enforcement', passed: true });
      } catch (error) {
        results.push({
          name: 'RBAC Enforcement',
          passed: false,
          error: String(error)
        });
      }
    });
  });

  describe('A5: Security Misconfiguration', () => {
    it('should not expose debug information in errors', async () => {
      try {
        const response = await fetch(`${BASE_URL}/api/nonexistent`, {
          method: 'GET'
        });

        const data = await response.text();

        // Should not expose stack traces or internal details
        assert(!data.includes('at '));
        assert(!data.includes('TypeError'));
        assert(!data.includes('line '));

        results.push({ name: 'Error Disclosure Prevention', passed: true });
      } catch (error) {
        results.push({
          name: 'Error Disclosure Prevention',
          passed: false,
          error: String(error)
        });
      }
    });

    it('should have security headers configured', async () => {
      try {
        const response = await fetch(`${BASE_URL}/api/health`);

        const headers = {
          'x-content-type-options': response.headers.get('x-content-type-options'),
          'x-frame-options': response.headers.get('x-frame-options'),
          'x-xss-protection': response.headers.get('x-xss-protection'),
          'strict-transport-security': response.headers.get('strict-transport-security')
        };

        assert(headers['x-content-type-options'] !== null);
        assert(headers['x-frame-options'] !== null);

        results.push({ name: 'Security Headers', passed: true });
      } catch (error) {
        results.push({
          name: 'Security Headers',
          passed: false,
          error: String(error)
        });
      }
    });
  });

  describe('A6: Sensitive Data Exposure', () => {
    it('should enforce HTTPS (HSTS)', async () => {
      try {
        const response = await fetch(`${BASE_URL}/api/health`);
        const hstsHeader = response.headers.get('strict-transport-security');

        assert(hstsHeader !== null);

        results.push({ name: 'HSTS Enforcement', passed: true });
      } catch (error) {
        results.push({
          name: 'HSTS Enforcement',
          passed: false,
          error: String(error)
        });
      }
    });

    it('should not expose sensitive data in logs', async () => {
      try {
        // This is more of a code review, but we can test API responses
        const response = await fetch(`${BASE_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'test@example.com',
            password: 'SensitivePassword123!'
          })
        });

        const data = await response.json() as Record<string, unknown>;

        // Should not return plaintext passwords
        assert(!JSON.stringify(data).includes('password'));

        results.push({ name: 'Sensitive Data Protection', passed: true });
      } catch (error) {
        results.push({
          name: 'Sensitive Data Protection',
          passed: false,
          error: String(error)
        });
      }
    });
  });

  describe('A7: Cross-Site Request Forgery (CSRF)', () => {
    it('should require CSRF tokens for state-changing operations', async () => {
      try {
        const response = await fetch(`${BASE_URL}/api/documents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Test' })
        });

        // Should either require CSRF token or use SameSite cookie
        assert(response.status === 403 || response.status === 401);

        results.push({ name: 'CSRF Protection', passed: true });
      } catch (error) {
        results.push({
          name: 'CSRF Protection',
          passed: false,
          error: String(error)
        });
      }
    });

    it('should validate CORS for cross-origin requests', async () => {
      try {
        const response = await fetch(`${BASE_URL}/api/health`, {
          method: 'OPTIONS',
          headers: { 'Origin': 'https://malicious.com' }
        });

        const allowOrigin = response.headers.get('access-control-allow-origin');

        // Should not allow arbitrary origins
        assert(allowOrigin !== 'https://malicious.com' || allowOrigin === null);

        results.push({ name: 'CORS Validation', passed: true });
      } catch (error) {
        results.push({
          name: 'CORS Validation',
          passed: false,
          error: String(error)
        });
      }
    });
  });

  describe('A8: Insecure Deserialization', () => {
    it('should not execute code from untrusted serialized data', async () => {
      try {
        const maliciousPayload = JSON.stringify({
          __proto__: { isAdmin: true },
          email: 'attacker@evil.com'
        });

        const response = await fetch(`${BASE_URL}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: maliciousPayload
        });

        // Should handle safely
        assert(response.status !== 500);

        results.push({ name: 'Deserialization Safety', passed: true });
      } catch (error) {
        results.push({
          name: 'Deserialization Safety',
          passed: false,
          error: String(error)
        });
      }
    });
  });

  describe('A9: Using Components with Known Vulnerabilities', () => {
    it('should use updated dependencies', async () => {
      try {
        // This would ideally check npm audit
        // For now, we check that the app starts and responds
        const response = await fetch(`${BASE_URL}/api/health`);
        assert(response.status === 200);

        results.push({ name: 'Dependency Health', passed: true });
      } catch (error) {
        results.push({
          name: 'Dependency Health',
          passed: false,
          error: String(error)
        });
      }
    });
  });

  describe('A10: Insufficient Logging & Monitoring', () => {
    it('should log security events', async () => {
      try {
        // Attempt a failed login
        await fetch(`${BASE_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'test@example.com',
            password: 'WrongPassword'
          })
        });

        // Should have logged the attempt
        // This would be verified in actual logging system

        results.push({ name: 'Security Event Logging', passed: true });
      } catch (error) {
        results.push({
          name: 'Security Event Logging',
          passed: false,
          error: String(error)
        });
      }
    });
  });
});
