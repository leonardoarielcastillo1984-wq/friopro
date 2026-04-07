/**
 * Enhanced Two-Factor Authentication Routes
 *
 * This file extends the base 2FA routes with:
 * - Email notifications
 * - Audit logging
 * - Rate limiting
 * - Enhanced error handling
 */

import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  generateTOTPSecret,
  enable2FA,
  confirm2FA,
  disable2FA,
  generateRecoveryCodes,
  get2FAStatus,
  verify2FASessionWithToken,
  forceEnable2FA,
} from '../services/twoFactorAuth.js';
import {
  log2FAEnabled,
  log2FADisabled,
  logTOTPVerified,
  logTOTPVerificationFailed,
  logRecoveryCodeUsed,
  logRecoveryCodesRegenerated,
  getUserAuditLogs,
  get2FAAuditLogs,
  getSecurityEvents,
} from '../services/auditLogger.js';
import { queueEmail } from '../jobs/emailQueue.js';
import {
  twoFactorEnabledEmail,
  twoFactorDisabledEmail,
  suspiciousLoginEmail,
  recoveryCodesGeneratedEmail,
  securityAlertEmail,
} from '../services/email.js';
import {
  twoFactorRateLimiter,
  loginRateLimiter,
} from '../middleware/rateLimiter.js';

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

const auditLogsSchema = z.object({
  limit: z.number().int().min(1).max(100).optional().default(50),
  offset: z.number().int().min(0).optional().default(0),
});

const securityEventsSchema = z.object({
  days: z.number().int().min(1).max(365).optional().default(30),
  limit: z.number().int().min(1).max(100).optional().default(50),
});

export const twoFactorAuthEnhancedRoutes: FastifyPluginAsync = async (app) => {
  // Get client IP and user agent helpers
  function getClientInfo(req: FastifyRequest) {
    return {
      ipAddress: req.ip || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
    };
  }

  // ── GET /2fa/status ──
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
  app.post('/setup', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.auth?.userId) return reply.code(401).send({ error: 'Unauthorized' });

    const clientInfo = getClientInfo(req);

    try {
      setupSchema.parse(req.body);

      const user = await app.prisma.platformUser.findUnique({
        where: { id: req.auth.userId },
        select: { email: true, email: true },
      });

      if (!user) return reply.code(404).send({ error: 'User not found' });

      const setup = await generateTOTPSecret(user.email);
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
  app.post('/confirm', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.auth?.userId) return reply.code(401).send({ error: 'Unauthorized' });

    const clientInfo = getClientInfo(req);

    try {
      const body = confirmSchema.parse(req.body);

      const user = await app.prisma.platformUser.findUnique({
        where: { id: req.auth.userId },
        select: { email: true },
      });

      await confirm2FA(req.auth.userId, body.token);

      // Generate recovery codes
      const recoveryCodes = await generateRecoveryCodes(req.auth.userId);

      // Log 2FA enabled
      await log2FAEnabled(req.auth.userId, clientInfo.ipAddress, clientInfo.userAgent);

      // Send email notification
      if (user?.email) {
        const emailPayload = twoFactorEnabledEmail(user.email, user.email.split('@')[0]);
        await queueEmail(emailPayload, 1); // High priority
      }

      return reply.send({
        success: true,
        message: '2FA enabled successfully',
        recoveryCodes,
        recoveryCodesMessage: 'Save these codes in a safe place. Each code can be used once if you lose access to your authenticator app.',
      });
    } catch (err: any) {
      await logTOTPVerificationFailed(
        req.auth?.userId,
        err.message,
        clientInfo.ipAddress,
        clientInfo.userAgent
      );

      return reply.code(400).send({ error: err.message || 'Failed to confirm 2FA' });
    }
  });

  // ── POST /2fa/disable ──
  app.post('/disable', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.auth?.userId) return reply.code(401).send({ error: 'Unauthorized' });

    const clientInfo = getClientInfo(req);

    try {
      const body = disableSchema.parse(req.body);
      const argon2 = await import('argon2');

      const user = await app.prisma.platformUser.findUnique({
        where: { id: req.auth.userId },
      });

      if (!user) return reply.code(404).send({ error: 'User not found' });

      const passwordOk = await argon2.verify(user.passwordHash, body.password);
      if (!passwordOk) return reply.code(401).send({ error: 'Invalid password' });

      await disable2FA(req.auth.userId);

      // Log 2FA disabled
      await log2FADisabled(req.auth.userId, clientInfo.ipAddress, clientInfo.userAgent);

      // Send email notification
      const emailPayload = twoFactorDisabledEmail(user.email, user.email.split('@')[0]);
      await queueEmail(emailPayload, 1);

      return reply.send({ success: true, message: '2FA disabled' });
    } catch (err: any) {
      return reply.code(400).send({ error: err.message || 'Failed to disable 2FA' });
    }
  });

  // ── POST /2fa/recovery-codes ──
  app.post('/recovery-codes', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.auth?.userId) return reply.code(401).send({ error: 'Unauthorized' });

    const clientInfo = getClientInfo(req);

    try {
      const recoveryCodes = await generateRecoveryCodes(req.auth.userId, 10);

      // Log recovery codes regenerated
      await logRecoveryCodesRegenerated(req.auth.userId, clientInfo.ipAddress, clientInfo.userAgent);

      // Send email notification
      const user = await app.prisma.platformUser.findUnique({
        where: { id: req.auth.userId },
      });

      if (user?.email) {
        const emailPayload = recoveryCodesGeneratedEmail(user.email, user.email.split('@')[0]);
        await queueEmail(emailPayload, 1);
      }

      return reply.send({
        success: true,
        recoveryCodes,
        message: 'New recovery codes generated. Previous codes are still valid.',
      });
    } catch (err: any) {
      return reply.code(500).send({ error: err.message || 'Failed to generate recovery codes' });
    }
  });

  // ── POST /2fa/verify ──
  app.post('/verify', { preHandler: twoFactorRateLimiter() }, async (req: FastifyRequest, reply: FastifyReply) => {
    const clientInfo = getClientInfo(req);

    try {
      const body = verifySchema.parse(req.body);

      const verified = await verify2FASessionWithToken(body.sessionToken, body.token, req.auth?.userId || '');

      if (!verified) {
        const userId = req.auth?.userId;
        if (userId) {
          await logTOTPVerificationFailed(userId, 'Invalid TOTP token or recovery code', clientInfo.ipAddress, clientInfo.userAgent);
        }

        return reply.code(401).send({ error: 'Invalid TOTP token or recovery code' });
      }

      // Log successful verification
      if (req.auth?.userId) {
        await logTOTPVerified(req.auth.userId, clientInfo.ipAddress, clientInfo.userAgent);
      }

      return reply.send({ success: true, message: '2FA verified' });
    } catch (err: any) {
      return reply.code(400).send({ error: err.message || 'Failed to verify 2FA' });
    }
  });

  // ── POST /2fa/force-enable ──
  app.post('/force-enable', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.auth?.userId) return reply.code(401).send({ error: 'Unauthorized' });

    const admin = await app.prisma.platformUser.findUnique({
      where: { id: req.auth.userId },
    });

    if (admin?.globalRole !== 'SUPER_ADMIN') {
      return reply.code(403).send({ error: 'Only admins can force-enable 2FA' });
    }

    try {
      const body = forceEnableSchema.parse(req.body);

      const result = await forceEnable2FA(body.userId, req.auth.userId);

      // Log admin action
      await log2FAEnabled(body.userId, 'admin-force-enable', 'admin-action');

      return reply.send({
        success: true,
        message: '2FA force-enabled',
        userId: body.userId,
        qrCodeUrl: result.qrCodeUrl,
        manualEntryKey: result.manualEntryKey,
      });
    } catch (err: any) {
      return reply.code(500).send({ error: err.message || 'Failed to force-enable 2FA' });
    }
  });

  // ── GET /2fa/audit-logs ──
  // Get 2FA audit logs for current user
  app.get('/audit-logs', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.auth?.userId) return reply.code(401).send({ error: 'Unauthorized' });

    try {
      const query = auditLogsSchema.parse(req.query);
      const logs = await get2FAAuditLogs(req.auth.userId, query.limit);

      return reply.send({
        logs,
        total: logs.length,
      });
    } catch (err: any) {
      return reply.code(400).send({ error: err.message || 'Failed to get audit logs' });
    }
  });

  // ── GET /2fa/security-events ──
  // Get security events for current user
  app.get('/security-events', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.auth?.userId) return reply.code(401).send({ error: 'Unauthorized' });

    try {
      const query = securityEventsSchema.parse(req.query);
      const events = await getSecurityEvents(req.auth.userId, query.days, query.limit);

      return reply.send({
        events,
        total: events.length,
      });
    } catch (err: any) {
      return reply.code(400).send({ error: err.message || 'Failed to get security events' });
    }
  });

  // ── GET /2fa/user/:userId/audit-logs (ADMIN ONLY) ──
  // Get any user's audit logs (admin endpoint)
  app.get('/user/:userId/audit-logs', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.auth?.userId) return reply.code(401).send({ error: 'Unauthorized' });

    const admin = await app.prisma.platformUser.findUnique({
      where: { id: req.auth.userId },
    });

    if (admin?.globalRole !== 'SUPER_ADMIN') {
      return reply.code(403).send({ error: 'Only admins can view other users audit logs' });
    }

    try {
      const userId = (req.params as any).userId;
      const query = auditLogsSchema.parse(req.query);

      const { logs, total } = await getUserAuditLogs(userId, query.limit, query.offset);

      return reply.send({
        logs,
        total,
        userId,
      });
    } catch (err: any) {
      return reply.code(400).send({ error: err.message || 'Failed to get audit logs' });
    }
  });
};
