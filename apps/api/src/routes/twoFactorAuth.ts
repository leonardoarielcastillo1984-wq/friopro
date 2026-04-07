// ──────────────────────────────────────────────────────────────
// Two-Factor Authentication (2FA) Routes
// ──────────────────────────────────────────────────────────────

import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  generateTOTPSecret,
  enable2FA,
  confirm2FA,
  disable2FA,
  generateRecoveryCodes,
  get2FAStatus,
  create2FASession,
  verify2FASessionWithToken,
  forceEnable2FA,
  getRecoveryCodes,
} from '../services/twoFactorAuth.js';

// Validation schemas
const setupSchema = z.object({});

const confirmSchema = z.object({
  token: z.string().regex(/^\d{6}$/, 'Token must be 6 digits'),
});

const disableSchema = z.object({
  password: z.string().min(1, 'Password required for confirmation'),
});

const verifySchema = z.object({
  sessionToken: z.string().min(1),
  token: z.string().min(1),
});

const forceEnableSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
});

const recoveryCodesSchema = z.object({});

export const twoFactorAuthRoutes: FastifyPluginAsync = async (app) => {
  // ── GET /2fa/status ──
  // Get current 2FA status for authenticated user
  app.get('/status', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.auth?.userId) return reply.code(401).send({ error: 'Unauthorized' });

    try {
      const status = await get2FAStatus(req.auth.userId);
      return reply.send({ status });
    } catch (err: any) {
      return reply.code(500).send({ error: err.message || 'Failed to get 2FA status' });
    }
  });

  // ── POST /2fa/setup ──
  // Start 2FA setup: generate secret and QR code
  app.post('/setup', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.auth?.userId) return reply.code(401).send({ error: 'Unauthorized' });

    try {
      setupSchema.parse(req.body);

      // Get user email
      const user = await app.prisma.platformUser.findUnique({
        where: { id: req.auth.userId },
        select: { email: true },
      });

      if (!user) return reply.code(404).send({ error: 'User not found' });

      // Generate TOTP secret
      const setup = await generateTOTPSecret(user.email);

      // Store temporary secret (not yet enabled)
      await enable2FA(req.auth.userId, setup.secret, req.auth.userId);

      return reply.send({
        secret: setup.secret,
        qrCodeUrl: setup.qrCodeUrl,
        manualEntryKey: setup.manualEntryKey,
        message: 'Scan QR code with authenticator app and verify with 6-digit code',
      });
    } catch (err: any) {
      return reply.code(500).send({ error: err.message || 'Failed to setup 2FA' });
    }
  });

  // ── POST /2fa/confirm ──
  // Confirm 2FA setup with TOTP verification
  app.post('/confirm', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.auth?.userId) return reply.code(401).send({ error: 'Unauthorized' });

    try {
      const body = confirmSchema.parse(req.body);

      await confirm2FA(req.auth.userId, body.token);

      // Generate recovery codes
      const recoveryCodes = await generateRecoveryCodes(req.auth.userId);

      return reply.send({
        success: true,
        message: '2FA enabled successfully',
        recoveryCodes,
        recoveryCodesMessage: 'Save these codes in a safe place. Each code can be used once if you lose access to your authenticator app.',
      });
    } catch (err: any) {
      return reply.code(400).send({ error: err.message || 'Failed to confirm 2FA' });
    }
  });

  // ── POST /2fa/disable ──
  // Disable 2FA (requires password confirmation)
  app.post('/disable', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.auth?.userId) return reply.code(401).send({ error: 'Unauthorized' });

    try {
      const body = disableSchema.parse(req.body);
      const argon2 = await import('argon2');

      // Verify password
      const user = await app.prisma.platformUser.findUnique({
        where: { id: req.auth.userId },
      });

      if (!user) return reply.code(404).send({ error: 'User not found' });

      const passwordOk = await argon2.verify(user.passwordHash, body.password);
      if (!passwordOk) return reply.code(401).send({ error: 'Invalid password' });

      // Disable 2FA
      await disable2FA(req.auth.userId);

      return reply.send({ success: true, message: '2FA disabled' });
    } catch (err: any) {
      return reply.code(400).send({ error: err.message || 'Failed to disable 2FA' });
    }
  });

  // ── POST /2fa/recovery-codes ──
  // Generate new recovery codes
  app.post('/recovery-codes', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.auth?.userId) return reply.code(401).send({ error: 'Unauthorized' });

    try {
      recoveryCodesSchema.parse(req.body);

      const recoveryCodes = await generateRecoveryCodes(req.auth.userId, 10);

      return reply.send({
        success: true,
        recoveryCodes,
        message: 'New recovery codes generated. Previous codes are still valid.',
      });
    } catch (err: any) {
      return reply.code(500).send({ error: err.message || 'Failed to generate recovery codes' });
    }
  });

  // ── GET /2fa/recovery-codes ──
  // Get recovery code status (admin viewing user 2FA)
  app.get('/recovery-codes', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.auth?.userId) return reply.code(401).send({ error: 'Unauthorized' });

    try {
      const codes = await getRecoveryCodes(req.auth.userId);

      const unused = codes.filter((c) => !c.used).length;
      const used = codes.filter((c) => c.used).length;

      return reply.send({
        total: codes.length,
        unused,
        used,
        codes: codes.map((c) => ({
          id: c.id,
          used: c.used,
          usedAt: c.usedAt,
          usedBy: c.usedBy,
        })),
      });
    } catch (err: any) {
      return reply.code(500).send({ error: err.message || 'Failed to get recovery codes' });
    }
  });

  // ── POST /2fa/verify ──
  // Verify TOTP token during login (using 2FA session)
  app.post('/verify', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = verifySchema.parse(req.body);

      const verified = await verify2FASessionWithToken(body.sessionToken, body.token, req.auth?.userId || '');

      if (!verified) {
        return reply.code(401).send({ error: 'Invalid TOTP token or recovery code' });
      }

      return reply.send({ success: true, message: '2FA verified' });
    } catch (err: any) {
      return reply.code(400).send({ error: err.message || 'Failed to verify 2FA' });
    }
  });

  // ── POST /2fa/force-enable ──
  // Admin force-enable 2FA for a user
  app.post('/force-enable', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.auth?.userId) return reply.code(401).send({ error: 'Unauthorized' });

    // Check if user is SUPER_ADMIN or TENANT_ADMIN (implement role check)
    const user = await app.prisma.platformUser.findUnique({
      where: { id: req.auth.userId },
    });

    if (user?.globalRole !== 'SUPER_ADMIN') {
      return reply.code(403).send({ error: 'Only admins can force-enable 2FA' });
    }

    try {
      const body = forceEnableSchema.parse(req.body);

      const result = await forceEnable2FA(body.userId, req.auth.userId);

      return reply.send({
        success: true,
        message: '2FA force-enabled',
        userId: body.userId,
        qrCodeUrl: result.qrCodeUrl,
        manualEntryKey: result.manualEntryKey,
        recoveryCodesMessage: 'Provide these recovery codes to the user',
      });
    } catch (err: any) {
      return reply.code(500).send({ error: err.message || 'Failed to force-enable 2FA' });
    }
  });
};
