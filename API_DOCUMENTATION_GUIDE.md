# API Documentation Guide - SGI 360

## Quick Links

- **Interactive Documentation**: http://api.sgi360.com/api-docs (Swagger UI)
- **OpenAPI Specification**: http://api.sgi360.com/api-docs.json
- **Postman Collection**: Import `postman-collection.json`
- **Admin Dashboard**: http://api.sgi360.com/admin/dashboard

---

## Authentication

### Bearer Token Authentication

All protected endpoints require JWT bearer token in the Authorization header:

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  https://api.sgi360.com/2fa/status
```

### Getting a Token

1. **Login first:**
```bash
curl -X POST https://api.sgi360.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"YourPassword123!"}'
```

2. **Response includes token:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "requires2FA": false
}
```

3. **Use token in Authorization header:**
```bash
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Authentication Endpoints

### POST /auth/login

Authenticate user with email and password.

**Request:**
```bash
curl -X POST https://api.sgi360.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "YourPassword123!"
  }'
```

**Success Response (no 2FA):**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "requires2FA": false
}
```

**Success Response (2FA required):**
```json
{
  "success": true,
  "requires2FA": true,
  "sessionToken": "temp_session_token_xyz"
}
```

**Error Response:**
```json
{
  "error": "Invalid credentials"
}
```

**Status Codes:**
- `200` - Successful authentication
- `401` - Invalid credentials
- `400` - Validation error

---

## Two-Factor Authentication (2FA) Endpoints

### POST /2fa/setup

Start 2FA setup by generating TOTP secret and QR code.

**Requirements:**
- Authenticated user
- 2FA not already enabled

**Request:**
```bash
curl -X POST https://api.sgi360.com/2fa/setup \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Success Response:**
```json
{
  "secret": "JBSWY3DPEBLW64TMMQ======",
  "qrCodeUrl": "data:image/png;base64,iVBORw0KGgoAAAANS...",
  "manualEntryKey": "sgi360-user@example.com (jbswy3dp...)",
  "message": "Scan QR code with authenticator app and verify with 6-digit code"
}
```

**Steps:**
1. User scans QR code with authenticator app (Google Authenticator, Authy, etc.)
2. User receives 6-digit code from app
3. User calls `/2fa/confirm` with code

---

### POST /2fa/confirm

Confirm 2FA setup by verifying TOTP token.

**Requirements:**
- Authenticated user
- Valid 6-digit TOTP code from authenticator app

**Request:**
```bash
curl -X POST https://api.sgi360.com/2fa/confirm \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "token": "123456"
  }'
```

**Success Response:**
```json
{
  "success": true,
  "message": "2FA enabled successfully",
  "recoveryCodes": [
    "ABC12345",
    "DEF67890",
    "GHI12345",
    "JKL67890",
    "MNO12345",
    "PQR67890",
    "STU12345",
    "VWX67890",
    "YZA12345",
    "BCD67890"
  ],
  "recoveryCodesMessage": "Save these codes in a safe place. Each code can be used once if you lose access to your authenticator app."
}
```

**Important:** User must save recovery codes in a secure location!

**Error Response:**
```json
{
  "error": "Invalid TOTP token"
}
```

---

### POST /2fa/verify

Verify 2FA token during login process.

**Used when:** Login returned `requires2FA: true`

**Request:**
```bash
curl -X POST https://api.sgi360.com/2fa/verify \
  -H "Content-Type: application/json" \
  -d '{
    "sessionToken": "temp_session_token_xyz",
    "token": "123456"
  }'
```

**Alternative (using recovery code):**
```bash
curl -X POST https://api.sgi360.com/2fa/verify \
  -H "Content-Type: application/json" \
  -d '{
    "sessionToken": "temp_session_token_xyz",
    "token": "ABC12345"
  }'
```

**Success Response:**
```json
{
  "success": true,
  "message": "2FA verified"
}
```

**After this, the client should:**
1. Complete the login flow to get final JWT token
2. Or call `/auth/login` again with credentials

---

### GET /2fa/status

Get current 2FA status for authenticated user.

**Request:**
```bash
curl -X GET https://api.sgi360.com/2fa/status \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "status": {
    "enabled": true,
    "lastVerified": "2026-03-17T14:30:00Z",
    "method": "TOTP",
    "backupCodesRemaining": 8
  }
}
```

---

### POST /2fa/disable

Disable 2FA for authenticated user.

**Requirements:**
- User's password for confirmation
- 2FA currently enabled

**Request:**
```bash
curl -X POST https://api.sgi360.com/2fa/disable \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "password": "UserPassword123!"
  }'
```

**Success Response:**
```json
{
  "success": true,
  "message": "2FA disabled"
}
```

**Error Response:**
```json
{
  "error": "Invalid password"
}
```

---

### GET /2fa/recovery-codes

Get recovery codes information.

**Request:**
```bash
curl -X GET https://api.sgi360.com/2fa/recovery-codes \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "total": 10,
  "unused": 8,
  "used": 2,
  "codes": [
    {
      "id": "code_1",
      "used": false,
      "usedAt": null,
      "usedBy": null
    },
    {
      "id": "code_2",
      "used": true,
      "usedAt": "2026-03-10T10:30:00Z",
      "usedBy": "2FA_RECOVERY"
    }
  ]
}
```

---

### POST /2fa/recovery-codes

Regenerate recovery codes.

**Requirements:**
- 2FA enabled
- User authenticated

**Request:**
```bash
curl -X POST https://api.sgi360.com/2fa/recovery-codes \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Response:**
```json
{
  "success": true,
  "recoveryCodes": [
    "ABC12345",
    "DEF67890",
    "..."
  ],
  "message": "New recovery codes generated. Previous codes are still valid."
}
```

---

## Admin Endpoints

### GET /admin/2fa/users

List all users with 2FA status.

**Requirements:**
- Admin or Super Admin role
- Authentication token

**Request:**
```bash
curl -X GET 'https://api.sgi360.com/admin/2fa/users?page=1&pageSize=20&search=&twoFactorEnabled=true' \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

**Query Parameters:**
- `page` (optional, default: 1) - Page number
- `pageSize` (optional, default: 20) - Results per page
- `search` (optional) - Search by email or name
- `twoFactorEnabled` (optional) - Filter: true/false

**Response:**
```json
{
  "users": [
    {
      "userId": "user-uuid-1",
      "email": "user1@example.com",
      "name": "John Doe",
      "twoFactorEnabled": true,
      "lastVerified": "2026-03-17T14:00:00Z",
      "recoveryCodesCount": 10,
      "recoveryCodesUnused": 8,
      "createdAt": "2026-01-15T10:00:00Z"
    }
  ],
  "total": 150,
  "page": 1,
  "pageSize": 20,
  "totalPages": 8
}
```

---

### GET /admin/2fa/users/:userId/audit-logs

Get audit logs for specific user.

**Requirements:**
- Admin or Super Admin role
- Valid user ID

**Request:**
```bash
curl -X GET 'https://api.sgi360.com/admin/2fa/users/user-uuid-1/audit-logs?limit=50&offset=0' \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

**Response:**
```json
{
  "userId": "user-uuid-1",
  "userEmail": "user@example.com",
  "logs": [
    {
      "id": "log-1",
      "userId": "user-uuid-1",
      "action": "2FA_ENABLED",
      "ipAddress": "192.168.1.1",
      "userAgent": "Mozilla/5.0...",
      "timestamp": "2026-03-17T14:30:00Z",
      "details": {
        "method": "TOTP",
        "device": "Google Authenticator"
      }
    },
    {
      "id": "log-2",
      "userId": "user-uuid-1",
      "action": "2FA_VERIFIED",
      "ipAddress": "192.168.1.1",
      "userAgent": "Mozilla/5.0...",
      "timestamp": "2026-03-17T10:30:00Z",
      "details": {}
    }
  ],
  "total": 25,
  "limit": 50,
  "offset": 0
}
```

---

### POST /admin/2fa/users/:userId/disable

Disable 2FA for a user (admin override).

**Requirements:**
- Admin or Super Admin role
- Valid user ID

**Request:**
```bash
curl -X POST 'https://api.sgi360.com/admin/2fa/users/user-uuid-1/disable' \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "User locked out of authenticator app"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "2FA disabled for user",
  "userId": "user-uuid-1",
  "userEmail": "user@example.com"
}
```

**Note:** User will receive email notification of 2FA disabling

---

### POST /admin/2fa/users/:userId/alert

Send security alert to user.

**Requirements:**
- Admin or Super Admin role
- Valid user ID

**Request:**
```bash
curl -X POST 'https://api.sgi360.com/admin/2fa/users/user-uuid-1/alert' \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "Unusual Login Activity Detected",
    "message": "We detected a login attempt from an unusual location. If this wasn'\''t you, please reset your password immediately.",
    "type": "WARNING"
  }'
```

**Alert Types:**
- `INFO` - Informational message
- `WARNING` - Warning level alert
- `CRITICAL` - Critical security alert

**Response:**
```json
{
  "success": true,
  "message": "Alert sent to user",
  "userId": "user-uuid-1",
  "userEmail": "user@example.com",
  "alertType": "WARNING"
}
```

---

### GET /admin/2fa/stats

Get overall 2FA statistics.

**Requirements:**
- Admin or Super Admin role

**Request:**
```bash
curl -X GET https://api.sgi360.com/admin/2fa/stats \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

**Response:**
```json
{
  "stats": {
    "total_users": 500,
    "two_factor_enabled": 350,
    "two_factor_disabled": 150,
    "two_factor_percentage": "70.00",
    "recovery_codes_total": 3500,
    "recovery_codes_unused": 2800,
    "recovery_codes_used": 700
  },
  "recent_activity": [
    {
      "id": "log-1",
      "userId": "user-uuid-1",
      "action": "2FA_ENABLED",
      "createdAt": "2026-03-17T14:30:00Z"
    }
  ],
  "generated_at": "2026-03-17T15:45:30Z"
}
```

---

## Audit Logs Endpoints

### GET /audit-logs

Get audit logs for current authenticated user.

**Request:**
```bash
curl -X GET 'https://api.sgi360.com/audit-logs?limit=50&offset=0' \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "logs": [
    {
      "id": "log-1",
      "userId": "your-user-id",
      "action": "2FA_ENABLED",
      "ipAddress": "192.168.1.1",
      "userAgent": "Mozilla/5.0...",
      "timestamp": "2026-03-17T14:30:00Z",
      "details": {
        "method": "TOTP"
      }
    },
    {
      "id": "log-2",
      "userId": "your-user-id",
      "action": "LOGIN_SUCCESS",
      "ipAddress": "192.168.1.1",
      "userAgent": "Mozilla/5.0...",
      "timestamp": "2026-03-17T10:30:00Z",
      "details": {}
    }
  ],
  "total": 100,
  "limit": 50,
  "offset": 0
}
```

---

## API Documentation & Tools

### GET /api-docs

Access interactive Swagger UI documentation.

**URL:** https://api.sgi360.com/api-docs

**Features:**
- Try out endpoints directly
- See request/response examples
- Explore all available endpoints
- Authentication testing

### GET /api-docs.json

Download OpenAPI 3.0 specification in JSON format.

**URL:** https://api.sgi360.com/api-docs.json

**Usage:**
- Import into API tools
- Generate code clients
- Documentation generation
- Schema validation

### Admin Dashboard

Access the admin management interface.

**URL:** https://api.sgi360.com/admin/dashboard (admin only)

**Features:**
- View all users and 2FA status
- Search and filter users
- View user audit logs
- Disable 2FA for users
- Send security alerts
- View overall statistics

---

## Error Handling

### Error Response Format

All error responses follow this format:

```json
{
  "error": "Error message description",
  "code": "ERROR_CODE (optional)",
  "issues": [
    {
      "path": "field_name",
      "message": "Field-specific error message"
    }
  ]
}
```

### Common Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| 400 | Bad Request | Validation error or malformed request |
| 401 | Unauthorized | Missing or invalid authentication |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Duplicate resource (e.g., email already exists) |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |

### Validation Error Example

```json
{
  "error": "Validation error",
  "issues": [
    {
      "path": "token",
      "message": "Token must be 6 digits"
    },
    {
      "path": "password",
      "message": "Password must be at least 8 characters"
    }
  ]
}
```

---

## Rate Limiting

All endpoints are rate-limited to prevent abuse.

**Global Rate Limit:** 200 requests per minute per IP

**Endpoint-Specific Limits:**
- Login: 5 attempts per minute
- 2FA verification: 3 attempts per minute
- Admin operations: 20 requests per minute

**Rate Limit Headers:**
```
X-RateLimit-Limit: 200
X-RateLimit-Remaining: 195
X-RateLimit-Reset: 1647531900
```

**When rate limited (429 response):**
```json
{
  "error": "Too many requests, please try again later"
}
```

---

## CORS (Cross-Origin Resource Sharing)

API supports CORS for browser-based clients.

**Allowed Origins (production):**
- https://sgi360.com
- https://admin.sgi360.com

**Credentials:** Required for authentication

**Allowed Methods:**
- GET
- POST
- PUT
- DELETE
- OPTIONS

---

## Security Best Practices

### When Using the API

1. **Never share tokens** - Keep JWT tokens confidential
2. **Use HTTPS only** - Always use HTTPS, never HTTP
3. **Store tokens securely** - Use HttpOnly cookies or secure storage
4. **Implement token refresh** - Rotate tokens regularly
5. **Validate responses** - Always validate API responses
6. **Log security events** - Track 2FA changes and admin actions
7. **Monitor for anomalies** - Watch for unusual API usage
8. **Implement retry logic** - Handle transient failures gracefully

### For Admin Operations

1. **Verify user identity** - Confirm user before sensitive operations
2. **Log all actions** - All admin operations are audited
3. **Use strong passwords** - Admin accounts require strong passwords
4. **Enable 2FA for admins** - All admin accounts should have 2FA
5. **Restrict access** - Only grant admin access when necessary
6. **Regular audits** - Review audit logs regularly

---

## Example Workflows

### User 2FA Setup Flow

```
1. POST /auth/login
   ├─ email: user@example.com
   └─ password: UserPassword123!

2. Receive token

3. POST /2fa/setup
   ├─ Authorization: Bearer token
   └─ {}

4. Receive QR code and secret
   ├─ User scans QR code
   └─ User enters code from app

5. POST /2fa/confirm
   ├─ Authorization: Bearer token
   ├─ token: 123456

6. Receive and save recovery codes
```

### User 2FA Login Flow

```
1. POST /auth/login
   ├─ email: user@example.com
   └─ password: UserPassword123!

2. Response requires2FA: true
   └─ Get sessionToken

3. POST /2fa/verify
   ├─ sessionToken: temp_token
   └─ token: 123456 (or recovery code)

4. Complete login with final token
```

### Admin User Management Flow

```
1. GET /admin/2fa/users
   ├─ Authorization: Bearer admin_token
   ├─ page: 1
   └─ pageSize: 20

2. View users and 2FA status

3. Select user and view audit logs
   ├─ GET /admin/2fa/users/{userId}/audit-logs

4. Optionally disable 2FA or send alert
   ├─ POST /admin/2fa/users/{userId}/disable
   └─ POST /admin/2fa/users/{userId}/alert
```

---

## Support & Documentation

- **Issues**: Report bugs and request features
- **Security**: Report vulnerabilities to security@sgi360.com
- **Questions**: Contact support@sgi360.com
- **Documentation**: https://docs.sgi360.com

---

**Last Updated:** March 17, 2026
**API Version:** 1.0
**Status:** Production Ready
