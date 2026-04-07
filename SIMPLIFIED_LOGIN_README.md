# Simplified Login System

The login system has been simplified to remove the mandatory 2FA requirement. Users can now log in with just email and password.

## Login Flow

```
1. User enters email + password
   ↓
2. Backend verifies credentials
   ↓
3. Backend generates tokens
   ↓
4. User logged in, shown dashboard
   ↓
5. (Optional) User can enable 2FA in settings
```

## Files Changed

### Frontend
- **`/apps/web/test-login.html`**
  - Removed 2FA form
  - Removed 2FA verification logic
  - Simplified to email + password input only
  - Updated success page with optional 2FA note

### Backend
- **`/apps/api/src/routes/auth.ts`**
  - Removed mandatory 2FA check in `POST /auth/login`
  - Users now receive tokens directly
  - 2FA verification skipped for all users

## Test Credentials

```
Email:    test@example.com
Password: Test123!@#
```

No 2FA code needed anymore.

## To Enable 2FA in the Future

If you want to make 2FA optional and user-configurable:

1. Create endpoints for 2FA management in user settings
2. Modify login flow to check if user has 2FA enabled
3. Only require 2FA verification if user has it enabled

The infrastructure is still there in:
- `/apps/api/src/routes/twoFactorAuth.ts`
- `/apps/api/src/routes/twoFactorAuthEnhanced.ts`
- `/apps/api/src/services/twoFactorAuth.ts`

## API Endpoints

### Login (Simplified)
```
POST /api/auth/login
{
  "email": "test@example.com",
  "password": "Test123!@#"
}

Response:
{
  "user": { "id": "...", "email": "test@example.com" },
  "activeTenant": { "id": "...", "name": "...", "slug": "..." },
  "tenantRole": "TENANT_ADMIN",
  "csrfToken": "...",
  "accessToken": "..." (in cookie)
}
```

No `requires2FA` or `sessionToken` in response anymore.

## Security Notes

- Password still hashed with Argon2
- Rate limiting still applied (10 requests/minute)
- CSRF protection still in place
- Token-based authentication unchanged
- Only 2FA requirement removed (can be re-enabled per-user)

## What's Kept

- All existing authentication logic
- Tenant/role system
- Token generation and refresh
- Session management
- Security headers and protections

## What's Removed

- Mandatory 2FA on every login
- 2FA session tokens
- TOTP code verification on login
- 2FA form UI
