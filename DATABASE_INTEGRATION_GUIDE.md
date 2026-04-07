# Database Integration Guide for SGI 360 Backend

## Overview

This guide explains how the SGI 360 backend connects to and uses the PostgreSQL database for 2FA and other features.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│           Fastify API Server (Node.js)              │
├─────────────────────────────────────────────────────┤
│  Routes (Express-style, Fastify framework)          │
│  ├─ /api/auth/login                                  │
│  ├─ /api/auth/register                               │
│  ├─ /api/2fa/*                                       │
│  └─ ...                                              │
├─────────────────────────────────────────────────────┤
│  Services (Business Logic)                           │
│  ├─ twoFactorAuth.ts                                 │
│  ├─ authService.ts                                   │
│  └─ ...                                              │
├─────────────────────────────────────────────────────┤
│  Prisma ORM (Database Access)                        │
│  ├─ Prisma Client (auto-generated)                   │
│  └─ Connection Management                            │
├─────────────────────────────────────────────────────┤
│  Plugins (Infrastructure)                            │
│  ├─ prisma.ts (Database plugin)                      │
│  ├─ auth.ts (JWT plugin)                             │
│  └─ ...                                              │
└─────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────┐
│      PostgreSQL Database (Docker Container)         │
├─────────────────────────────────────────────────────┤
│  Tables:                                             │
│  ├─ TwoFactorAuth                                    │
│  ├─ TwoFactorRecoveryCode                            │
│  ├─ TwoFactorSession                                 │
│  ├─ PlatformUser                                     │
│  ├─ AuditEvent                                       │
│  └─ ...                                              │
└─────────────────────────────────────────────────────┘
```

## Database Connection

### Prisma Plugin (`apps/api/src/plugins/prisma.ts`)

The Prisma plugin initializes and manages the database connection.

```typescript
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: ['query', 'error', 'warn'],
});

// On app startup
app.register(async (app) => {
  app.decorate('prisma', prisma);

  app.addHook('onClose', async () => {
    await app.prisma.$disconnect();
  });
});
```

### Connection String

From `.env.local`:
```env
DATABASE_URL=postgresql://sgi:sgidev123@localhost:5432/sgi_dev
```

This is parsed by Prisma automatically.

### Environment Variables

**Development** (`.env.local`):
```env
DATABASE_URL=postgresql://sgi:sgidev123@localhost:5432/sgi_dev
NODE_ENV=development
```

**Production** (would be different):
```env
DATABASE_URL=postgresql://sgi:securepassword@prod-db.example.com:5432/sgi_prod
NODE_ENV=production
```

## 2FA Service Integration

### Overview

The `apps/api/src/services/twoFactorAuth.ts` service handles all 2FA operations using Prisma ORM.

### Key Functions

#### 1. Generate TOTP Secret

```typescript
export async function generateTOTPSecret(email: string): Promise<TOTPSetup> {
  const speakeasy = await import('speakeasy');
  const QRCode = await import('qrcode');

  const secret = speakeasy.generateSecret({
    name: `SGI 360 (${email})`,
    issuer: 'SGI 360',
    length: 32,
  });

  const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url || '');

  return {
    secret: secret.base32 || '',
    qrCodeUrl,
    manualEntryKey: secret.base32 || '',
  };
}
```

**Database Usage**: Read-only (no database access)

#### 2. Enable 2FA for User

```typescript
export async function enable2FA(
  userId: string,
  secret: string,
  createdById?: string
): Promise<any> {
  const twoFA = await prisma.twoFactorAuth.create({
    data: {
      userId,
      secret,
      isEnabled: false,
      isConfirmed: false,
      createdById,
    },
  });

  return twoFA;
}
```

**Database Operation**: INSERT into `TwoFactorAuth`

**Usage**:
```typescript
// In auth route
const setup = await generateTOTPSecret(user.email);
const twoFA = await enable2FA(user.id, setup.secret);
```

#### 3. Confirm 2FA

```typescript
export async function confirm2FA(
  userId: string,
  token: string
): Promise<any> {
  const twoFA = await prisma.twoFactorAuth.findUnique({
    where: { userId },
  });

  const isValid = await verifyTOTPToken(twoFA.secret, token);
  if (!isValid) throw new Error('Invalid TOTP token');

  const updated = await prisma.twoFactorAuth.update({
    where: { id: twoFA.id },
    data: {
      isConfirmed: true,
      isEnabled: true,
      enabledAt: new Date(),
    },
  });

  return updated;
}
```

**Database Operations**:
- SELECT from `TwoFactorAuth` (findUnique)
- UPDATE `TwoFactorAuth` (update)

#### 4. Generate Recovery Codes

```typescript
export async function generateRecoveryCodes(
  userId: string,
  count: number = 10
): Promise<string[]> {
  const twoFA = await prisma.twoFactorAuth.findUnique({
    where: { userId },
  });

  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    const formatted = `${code.substring(0, 4)}-${code.substring(4, 8)}`;
    codes.push(formatted);

    const hash = crypto
      .createHash('sha256')
      .update(formatted)
      .digest('hex');

    await prisma.twoFactorRecoveryCode.create({
      data: {
        twoFactorAuthId: twoFA.id,
        code: hash,
      },
    });
  }

  return codes;
}
```

**Database Operations**:
- SELECT from `TwoFactorAuth` (findUnique)
- INSERT into `TwoFactorRecoveryCode` (multiple creates)

**Important**: Codes are hashed before storage. Never store plaintext codes.

#### 5. Verify Recovery Code

```typescript
export async function verifyRecoveryCode(
  userId: string,
  code: string,
  ipAddress?: string
): Promise<boolean> {
  const twoFA = await prisma.twoFactorAuth.findUnique({
    where: { userId },
  });

  const hash = crypto.createHash('sha256').update(code).digest('hex');

  const recoveryCode = await prisma.twoFactorRecoveryCode.findFirst({
    where: {
      twoFactorAuthId: twoFA.id,
      code: hash,
      used: false,
    },
  });

  if (!recoveryCode) return false;

  await prisma.twoFactorRecoveryCode.update({
    where: { id: recoveryCode.id },
    data: {
      used: true,
      usedAt: new Date(),
      usedBy: ipAddress,
    },
  });

  return true;
}
```

**Database Operations**:
- SELECT from `TwoFactorAuth` (findUnique)
- SELECT from `TwoFactorRecoveryCode` (findFirst with conditions)
- UPDATE `TwoFactorRecoveryCode` (mark as used)

#### 6. Create 2FA Session

```typescript
export async function create2FASession(
  userId: string,
  expiresIn: number = 10 * 60 * 1000,
  ipAddress?: string
): Promise<string> {
  const sessionToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + expiresIn);

  const session = await prisma.twoFactorSession.create({
    data: {
      userId,
      sessionToken,
      expiresAt,
      ipAddress,
      userAgent: req?.headers['user-agent'],
    },
  });

  return session.sessionToken;
}
```

**Database Operations**:
- INSERT into `TwoFactorSession`

#### 7. Verify 2FA Session with Token

```typescript
export async function verify2FASessionWithToken(
  sessionToken: string,
  totpToken: string,
  userId: string
): Promise<boolean> {
  const session = await verify2FASession(sessionToken);
  if (!session || session.userId !== userId) return false;

  const twoFA = await prisma.twoFactorAuth.findUnique({
    where: { userId },
  });

  if (!twoFA || !twoFA.isEnabled) return false;

  const isValid =
    (await verifyTOTPToken(twoFA.secret, totpToken)) ||
    (await verifyRecoveryCode(userId, totpToken));

  if (!isValid) return false;

  await prisma.twoFactorSession.update({
    where: { id: session.id },
    data: { verified: true },
  });

  return true;
}
```

**Database Operations**:
- SELECT from `TwoFactorSession` (verify2FASession)
- SELECT from `TwoFactorAuth` (findUnique)
- UPDATE `TwoFactorSession` (mark as verified)

## 2FA Routes Integration

### Routes File (`apps/api/src/routes/twoFactorAuth.ts`)

Example route that uses the 2FA service:

```typescript
import { FastifyInstance } from 'fastify';
import { enable2FA, generateTOTPSecret, confirm2FA } from '../services/twoFactorAuth';

export async function twoFactorAuthRoutes(app: FastifyInstance) {
  // Setup 2FA
  app.post('/api/2fa/setup', async (request, reply) => {
    try {
      const userId = request.user.id; // From JWT middleware

      // Generate TOTP secret
      const setup = await generateTOTPSecret(request.user.email);

      // Store initial 2FA record in database
      const twoFA = await enable2FA(userId, setup.secret, request.user.id);

      return reply.send({
        id: twoFA.id,
        qrCodeUrl: setup.qrCodeUrl,
        manualEntryKey: setup.manualEntryKey,
      });
    } catch (error) {
      return reply.status(400).send({ error: 'Failed to setup 2FA' });
    }
  });

  // Confirm 2FA
  app.post('/api/2fa/confirm', async (request, reply) => {
    try {
      const { token } = request.body as { token: string };
      const userId = request.user.id;

      const confirmed = await confirm2FA(userId, token);

      // Generate recovery codes
      const recoveryCodes = await generateRecoveryCodes(userId);

      return reply.send({
        confirmed: true,
        recoveryCodes,
      });
    } catch (error) {
      return reply.status(400).send({ error: 'Failed to confirm 2FA' });
    }
  });

  // Verify TOTP during login
  app.post('/api/2fa/verify', async (request, reply) => {
    try {
      const { sessionToken, totpToken } = request.body as {
        sessionToken: string;
        totpToken: string;
      };
      const userId = request.user.id;

      const verified = await verify2FASessionWithToken(
        sessionToken,
        totpToken,
        userId
      );

      if (!verified) {
        return reply.status(401).send({ error: 'Invalid TOTP token' });
      }

      // Issue JWT token for authenticated session
      const jwtToken = app.jwt.sign({ userId });

      return reply.send({ token: jwtToken });
    } catch (error) {
      return reply.status(400).send({ error: 'Failed to verify 2FA' });
    }
  });
}
```

## Authentication Flow with 2FA

### Login Flow

```
1. User submits email and password
   POST /api/auth/login
   {
     "email": "user@sgi360.local",
     "password": "password123"
   }

2. Backend validates password
   await validatePassword(email, password)

3. Check if user has 2FA enabled
   const twoFA = await prisma.twoFactorAuth.findUnique({
     where: { userId }
   })

4a. If 2FA NOT enabled:
    → Issue JWT token
    → Return token to client

4b. If 2FA IS enabled:
    → Create 2FA session
    const sessionToken = await create2FASession(userId)
    → Return sessionToken (not JWT yet)
    → Client prompts for TOTP code

5. User enters TOTP code
   POST /api/2fa/verify
   {
     "sessionToken": "...",
     "totpToken": "123456"
   }

6. Backend verifies TOTP
   const verified = await verify2FASessionWithToken(
     sessionToken,
     totpToken,
     userId
   )

7. If verified:
   → Issue JWT token
   → Return token to client
   → Client stores token for future requests

8. For future requests:
   Authorization: Bearer <jwt-token>
```

## Database Queries Reference

### User Queries

```typescript
// Get user with 2FA status
const user = await prisma.platformUser.findUnique({
  where: { id: userId },
  include: {
    twoFactorAuth: {
      select: {
        isEnabled: true,
        isConfirmed: true,
        recoveryCodes: {
          where: { used: false },
          select: { id: true }
        }
      }
    }
  }
});

// Check if 2FA is enabled
const hasTwoFA = user.twoFactorAuth?.isEnabled ?? false;

// Count remaining recovery codes
const recoveryCodesRemaining = user.twoFactorAuth?.recoveryCodes.length ?? 0;
```

### 2FA Status Queries

```typescript
// Get 2FA status
const status = await prisma.twoFactorAuth.findUnique({
  where: { userId },
  include: {
    recoveryCodes: {
      select: { used: true, usedAt: true }
    }
  }
});

// Count used recovery codes
const usedCodes = status.recoveryCodes.filter(c => c.used).length;

// Check if 2FA is confirmed
const isConfirmed = status?.isConfirmed ?? false;
```

### Session Queries

```typescript
// Verify session exists and not expired
const session = await prisma.twoFactorSession.findUnique({
  where: { sessionToken }
});

const isValid = session && session.expiresAt > new Date();

// Check if session is verified
const isVerified = session?.verified ?? false;

// Get all active sessions for user
const activeSessions = await prisma.twoFactorSession.findMany({
  where: {
    userId,
    expiresAt: { gt: new Date() }
  }
});
```

### Cleanup Queries

```typescript
// Delete expired sessions (run as scheduled task)
await prisma.twoFactorSession.deleteMany({
  where: {
    expiresAt: {
      lt: new Date()
    }
  }
});

// Archive old 2FA logs (run monthly)
await prisma.auditEvent.updateMany({
  where: {
    action: '2FA_SETUP',
    createdAt: {
      lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    }
  },
  data: { archived: true }
});
```

## Best Practices

### 1. Always Use Transactions for Multi-Step Operations

```typescript
await prisma.$transaction(async (tx) => {
  // Create 2FA record
  const twoFA = await tx.twoFactorAuth.create({ ... });

  // Generate recovery codes
  for (let i = 0; i < 10; i++) {
    await tx.twoFactorRecoveryCode.create({
      twoFactorAuthId: twoFA.id,
      ...
    });
  }

  // Create audit log
  await tx.auditEvent.create({
    action: '2FA_ENABLED',
    entityId: twoFA.id,
    ...
  });
});
```

### 2. Hash Sensitive Data Before Storage

```typescript
// WRONG: Storing plaintext code
await prisma.twoFactorRecoveryCode.create({
  data: { code: 'ABCD-1234' } // ❌ Don't do this
});

// RIGHT: Hash before storage
const hash = crypto.createHash('sha256').update(code).digest('hex');
await prisma.twoFactorRecoveryCode.create({
  data: { code: hash } // ✓ Do this
});
```

### 3. Use Indexes for Common Queries

Already configured in schema:
```prisma
model TwoFactorAuth {
  @@index([userId])
  @@index([isEnabled])
}

model TwoFactorRecoveryCode {
  @@index([twoFactorAuthId])
  @@index([used])
}

model TwoFactorSession {
  @@index([userId])
  @@index([verified])
  @@index([expiresAt])
}
```

### 4. Always Include Error Handling

```typescript
try {
  const verified = await verify2FASessionWithToken(...);
  if (!verified) {
    return reply.status(401).send({ error: 'Invalid token' });
  }
  // ...
} catch (error) {
  console.error('2FA verification error:', error);
  return reply.status(500).send({ error: 'Internal server error' });
}
```

### 5. Log Important Security Events

```typescript
await prisma.auditEvent.create({
  data: {
    tenantId: user.tenantId,
    actorUserId: userId,
    action: '2FA_ENABLED',
    entityType: 'TwoFactorAuth',
    entityId: twoFA.id,
    metadata: {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
      timestamp: new Date().toISOString(),
    },
  },
});
```

## Testing with Database

### Test User

Seeded during `npm run seed:users`:
```
email: test-2fa@sgi360.local
password: (check seedUsers.ts)
2FA enabled: false (initially)
```

### Run 2FA Seed

```bash
npm run seed:2fa
```

Creates:
- User with 2FA enabled
- 10 recovery codes
- Sample TOTP secret: `JBSWY3DPEBLW64TMMQ======`

### Test in API

```bash
# Start server
npm run dev

# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test-2fa@sgi360.local","password":"..."}'

# Should get sessionToken, not JWT

# Verify 2FA
curl -X POST http://localhost:3001/api/2fa/verify \
  -H "Content-Type: application/json" \
  -d '{"sessionToken":"...","totpToken":"123456"}'

# Should get JWT token
```

## Monitoring and Debugging

### View Database Logs

```bash
docker-compose logs postgres
docker-compose logs postgres | grep -i "2factor\|session\|recovery"
```

### Check Query Performance

```bash
# In psql
EXPLAIN ANALYZE
SELECT * FROM "TwoFactorAuth" WHERE "userId" = 'user-id';
```

### Monitor Connection Pool

```bash
# From Prisma logs
NODE_ENV=development npm run dev 2>&1 | grep -i "prisma\|query"
```

## Deployment Checklist

- [ ] Verify DATABASE_URL is set correctly
- [ ] Run migrations: `npm run prisma:migrate`
- [ ] Seed production data if needed
- [ ] Enable SSL for database connections
- [ ] Configure connection pooling
- [ ] Set up monitoring and alerts
- [ ] Verify backup procedures
- [ ] Test disaster recovery
- [ ] Document any custom configurations

## Troubleshooting

### Connection Errors

```typescript
// Check Prisma connection
const test = await prisma.platformUser.count();
console.log('Database connected, user count:', test);
```

### Migration Issues

```bash
cd apps/api
npx prisma migrate status
npx prisma migrate resolve --applied 0007_two_factor_auth
npm run prisma:migrate
```

### Slow Queries

Enable logging in development:
```env
# .env.local
DATABASE_LOG_LEVEL=query
```

Then check `prisma` logs in API output.

## Next Steps

1. Review Prisma documentation: https://www.prisma.io/docs/
2. Understand the 2FA flow in detail
3. Implement frontend for 2FA setup/verification
4. Add audit logging for all 2FA operations
5. Set up monitoring for database performance
