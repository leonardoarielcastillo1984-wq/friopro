# 🔐 2FA End-to-End Integration Guide

**Status:** Backend integration complete ✅
**Date:** 2026-03-16
**Complete:** Backend login flow + Frontend implementation ready

---

## Integration Overview

The 2FA system is now fully integrated with the login flow:

```
User → /auth/login (email + password)
       ├─ Password valid?
       │  ├─ No → Error
       │  └─ Yes → Check 2FA enabled?
       │          ├─ No → Issue tokens → Login complete ✓
       │          └─ Yes → Create 2FA session → Send sessionToken
       │
       User enters TOTP/Recovery code
       │
       ├─ /2fa/verify (sessionToken + code)
       │  ├─ Code valid?
       │  │  ├─ No → Error
       │  │  └─ Yes → Mark session verified → Return verification
       │  │
       └─ /auth/2fa-complete (sessionToken)
          └─ Session verified?
             ├─ No → Error
             └─ Yes → Issue tokens → Login complete ✓
```

---

## Backend Implementation Status ✅

### Modified Files

**`apps/api/src/routes/auth.ts`**
- ✅ Added import: `import { get2FAStatus, create2FASession } from '../services/twoFactorAuth.js'`
- ✅ Updated `/auth/login` endpoint:
  - After password verification, checks if user has 2FA enabled
  - If enabled: creates 2FA session and returns `{requires2FA: true, sessionToken}`
  - If disabled: proceeds with normal login (existing behavior)
- ✅ Added new endpoint `/auth/2fa-complete`:
  - Accepts `{sessionToken}` in request body
  - Validates session is verified and not expired
  - Issues full auth tokens on success

### New Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/auth/login` | POST | Login with email/password → may return sessionToken if 2FA required |
| `/auth/2fa-complete` | POST | Complete login with verified 2FA session |

### Existing 2FA Endpoints (Already Implemented)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/2fa/status` | GET | Get user's 2FA status |
| `/2fa/setup` | POST | Start 2FA setup (generates QR code) |
| `/2fa/confirm` | POST | Verify TOTP and enable 2FA |
| `/2fa/disable` | POST | Disable 2FA with password verification |
| `/2fa/recovery-codes` | POST | Generate new recovery codes |
| `/2fa/recovery-codes` | GET | Get recovery code usage status |
| `/2fa/verify` | POST | Verify TOTP or recovery code during login |
| `/2fa/force-enable` | POST | Admin force-enable 2FA for user |

---

## Frontend Integration Checklist

### Phase 1: Copy Components & Hooks

- [ ] Create `src/hooks/use2FA.ts` (copy from frontend-2fa-implementation.tsx)
- [ ] Create `src/hooks/useAuth.ts` (UPDATED - copy enhanced version with 2FA support)
- [ ] Create `src/components/TwoFactorSetup.tsx`
- [ ] Create `src/components/TwoFactorStatus.tsx`
- [ ] Create `src/components/TwoFactorDisable.tsx`
- [ ] Create `src/pages/LoginWith2FA.tsx`
- [ ] Create `src/pages/Settings/TwoFactorSettings.tsx`
- [ ] Create `src/styles/2fa.css`

### Phase 2: Update Routing

- [ ] Update `/login` route to use `LoginWith2FA` component
- [ ] Add `/settings/security` route with `TwoFactorSettings` component
- [ ] Update navigation to include link to security settings

### Phase 3: Update Auth Context/Store

- [ ] Update auth context to include 2FA session state:
  - `requires2FA: boolean`
  - `sessionToken: string | null`
  - `verify2FA(code: string): Promise<void>`

### Phase 4: Testing

- [ ] Unit tests for 2FA components
- [ ] Unit tests for 2FA hooks
- [ ] E2E test: Setup 2FA flow
- [ ] E2E test: Login with 2FA enabled
- [ ] E2E test: Recovery code usage

---

## API Flow Example

### Scenario 1: User with 2FA Disabled

```bash
# 1. Login
POST /auth/login
{
  "email": "user@example.com",
  "password": "password123"
}

# Response (normal login)
{
  "user": { "id": "...", "email": "user@example.com" },
  "activeTenant": { "id": "...", "name": "...", "slug": "..." },
  "tenantRole": "TENANT_MEMBER",
  "csrfToken": "..."
}

# Browser automatically sets auth cookies (access_token, refresh_token)
```

### Scenario 2: User with 2FA Enabled

```bash
# 1. Login
POST /auth/login
{
  "email": "user@example.com",
  "password": "password123"
}

# Response (2FA required)
{
  "requires2FA": true,
  "sessionToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 600
}

# Frontend shows 2FA verification form
```

```bash
# 2. Verify TOTP code
POST /2fa/verify
{
  "sessionToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token": "123456"  # 6-digit code from authenticator app
}

# Response
{
  "success": true,
  "verified": true
}

# Frontend makes completion request
```

```bash
# 3. Complete 2FA login
POST /auth/2fa-complete
{
  "sessionToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}

# Response (same as normal login)
{
  "user": { "id": "...", "email": "user@example.com" },
  "activeTenant": { "id": "...", "name": "...", "slug": "..." },
  "tenantRole": "TENANT_MEMBER",
  "csrfToken": "..."
}

# Browser sets auth cookies
```

---

## Frontend Implementation Guide

### Step 1: Update useAuth Hook

Add 2FA session state to your existing auth hook:

```typescript
export function useAuth() {
  const [requires2FA, setRequires2FA] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  const login = async (email: string, password: string) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (data.requires2FA) {
      // 2FA required
      setRequires2FA(true);
      setSessionToken(data.sessionToken);
      return;
    }

    // Normal login
    setRequires2FA(false);
    setSessionToken(null);
    // Set user, token, etc.
  };

  const verify2FA = async (code: string) => {
    // 1. Verify code with 2FA service
    const verifyResponse = await fetch('/api/2fa/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionToken, token: code }),
    });

    const verifyData = await verifyResponse.json();
    if (!verifyData.success) throw new Error('Invalid code');

    // 2. Complete login
    const completeResponse = await fetch('/api/auth/2fa-complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionToken }),
    });

    const completeData = await completeResponse.json();

    // Set user, token, etc. (same as normal login)
    setRequires2FA(false);
    setSessionToken(null);
  };

  return {
    requires2FA,
    sessionToken,
    login,
    verify2FA,
    // ... other auth methods
  };
}
```

### Step 2: Update LoginWith2FA Component

The component in `frontend-2fa-implementation.tsx` already handles this flow:

```typescript
export function LoginWith2FA({ onLoginSuccess }: { onLoginSuccess?: () => void }) {
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Step 1: Regular login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await auth.login(email, password);
      // If requires2FA is true, component shows verification form
      // If false, redirect to dashboard
      if (!auth.requires2FA) {
        onLoginSuccess?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify 2FA code
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await auth.verify2FA(totp);
      onLoginSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  // Show normal login form
  if (!auth.requires2FA) {
    return (
      <form onSubmit={handleLogin}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Loading...' : 'Sign In'}
        </button>
        {error && <div className="error">{error}</div>}
      </form>
    );
  }

  // Show 2FA verification form
  return (
    <form onSubmit={handleVerify}>
      <h2>Verify Your Identity</h2>
      <p>Enter the 6-digit code from your authenticator app</p>
      <input
        type="text"
        value={totp}
        onChange={(e) => setTotp(e.target.value.slice(0, 6))}
        placeholder="000000"
        maxLength="6"
        inputMode="numeric"
        autoComplete="one-time-code"
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Verifying...' : 'Verify'}
      </button>
      {error && <div className="error">{error}</div>}
    </form>
  );
}
```

### Step 3: Update Routes

```typescript
// In your routing configuration
import { LoginWith2FA } from '@/pages/LoginWith2FA';
import { TwoFactorSettings } from '@/pages/Settings/TwoFactorSettings';

export const routes = [
  {
    path: '/login',
    element: <LoginWith2FA onLoginSuccess={() => navigate('/dashboard')} />,
  },
  {
    path: '/settings/security',
    element: <TwoFactorSettings />,
    // Requires authenticated user
  },
  // ... other routes
];
```

---

## Testing Checklist

### Manual Testing (Dev Environment)

```bash
# 1. Test login without 2FA
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
# Should return: {user, activeTenant, tenantRole, csrfToken}

# 2. Setup 2FA for a test user
curl -X POST http://localhost:3001/2fa/setup \
  -H "Authorization: Bearer $TOKEN"
# Response: {qrCodeUrl, secret, manualEntryKey}

# Scan QR code with Google Authenticator / Authy

# 3. Confirm 2FA setup (enter 6-digit code)
curl -X POST http://localhost:3001/2fa/confirm \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "token": "123456"
  }'
# Response: {recoveryCodes: [...]}

# 4. Test login with 2FA
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
# Response: {requires2FA: true, sessionToken: "...", expiresIn: 600}

# 5. Verify TOTP code
curl -X POST http://localhost:3001/2fa/verify \
  -H "Content-Type: application/json" \
  -d '{
    "sessionToken": "...",
    "token": "654321"
  }'
# Response: {success: true, verified: true}

# 6. Complete login
curl -X POST http://localhost:3001/auth/2fa-complete \
  -H "Content-Type: application/json" \
  -d '{
    "sessionToken": "..."
  }'
# Response: {user, activeTenant, tenantRole, csrfToken}
```

### E2E Testing (Cypress)

```typescript
describe('2FA Complete Flow', () => {
  it('should setup 2FA and login with code', () => {
    // 1. Login without 2FA
    cy.visit('/login');
    cy.get('input[type="email"]').type('user@example.com');
    cy.get('input[type="password"]').type('password123');
    cy.get('button').contains('Sign In').click();
    cy.url().should('include', '/dashboard');

    // 2. Go to settings
    cy.visit('/settings/security');
    cy.get('button').contains('Enable 2FA').click();
    cy.get('button').contains('Start Setup').click();

    // 3. Scan QR code (or use manual entry)
    cy.get('button').contains("I've Scanned").click();

    // 4. Enter TOTP code
    // In test, we need to generate code using speakeasy or similar
    const secret = /* from QR code */;
    const code = generateTOTP(secret);
    cy.get('input[placeholder="000000"]').type(code);
    cy.get('button').contains('Verify & Enable').click();

    // 5. Should show recovery codes
    cy.get('.recovery-codes-list').should('be.visible');
    cy.get('button').contains('Done').click();

    // 6. Logout and test login with 2FA
    cy.visit('/auth/logout');
    cy.visit('/login');
    cy.get('input[type="email"]').type('user@example.com');
    cy.get('input[type="password"]').type('password123');
    cy.get('button').contains('Sign In').click();

    // 7. Should show 2FA verification form
    cy.contains('Verify Your Identity').should('be.visible');
    const totpCode = generateTOTP(secret);
    cy.get('input[placeholder="000000"]').type(totpCode);
    cy.get('button').contains('Verify').click();

    // 8. Should be logged in
    cy.url().should('include', '/dashboard');
  });
});
```

---

## Remaining Tasks

### Immediate (Today)
- [ ] Deploy backend changes to staging
- [ ] Verify login endpoints work without 2FA
- [ ] Test 2FA session creation

### Short Term (This Week)
- [ ] Copy frontend components to project
- [ ] Update auth context with 2FA support
- [ ] Update routes (login + settings/security)
- [ ] Write unit tests
- [ ] Write E2E tests

### Testing & Deployment
- [ ] Full E2E testing in staging
- [ ] Security review of 2FA implementation
- [ ] Load testing (2FA adds minimal overhead)
- [ ] Production deployment

---

## API Response Reference

### POST /auth/login - 2FA Required Response

```json
{
  "requires2FA": true,
  "sessionToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 600
}
```

### POST /2fa/verify - Success Response

```json
{
  "success": true,
  "verified": true
}
```

### POST /auth/2fa-complete - Success Response

```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com"
  },
  "activeTenant": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "name": "Acme Corp",
    "slug": "acme-corp"
  },
  "tenantRole": "TENANT_MEMBER",
  "needsTenantSwitch": false,
  "csrfToken": "..."
}
```

---

## Security Notes

✅ **Implemented:**
- Session tokens have 10-minute expiration
- Sessions cannot be used to access protected API endpoints
- Session tokens are separate from auth tokens (no privilege escalation)
- IP address and User-Agent are logged with session creation
- httpOnly cookies prevent JavaScript access to tokens
- Rate limiting on sensitive endpoints (5 req/min)

⚠️ **Considerations:**
- Ensure HTTPS is enabled in production
- Monitor for brute-force attacks on 2FA verification
- Consider SMS-based backup 2FA for sensitive users
- Consider implementing hardware key support (FIDO2/WebAuthn) long-term

---

## Status Summary

| Component | Status |
|-----------|--------|
| Backend 2FA Service | ✅ Complete (500+ lines) |
| Backend 2FA Routes | ✅ Complete (8 endpoints) |
| Backend Login Integration | ✅ Complete |
| Backend 2FA-Complete Endpoint | ✅ Complete |
| Frontend Components | ✅ Complete (ready to integrate) |
| Frontend Hooks | ✅ Complete (ready to integrate) |
| Frontend Routing | ⏳ Pending |
| Frontend Auth Context | ⏳ Pending |
| Testing | ⏳ Pending |
| Staging Deployment | ⏳ Pending |

---

**Next Step:** Copy frontend files to project and update auth context.
