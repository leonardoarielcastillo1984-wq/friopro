/**
 * Audit Logger Service - Comprehensive logging for security events
 *
 * This service logs all critical security events including 2FA operations,
 * login attempts, and account activities for compliance and security monitoring.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface AuditLogOptions {
  userId?: string;
  tenantId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  ipAddress?: string;
  userAgent?: string;
  result: 'success' | 'failure';
  errorMessage?: string;
  metadata?: Record<string, any>;
}

/**
 * Log an audit event
 */
export async function logAuditEvent(options: AuditLogOptions): Promise<void> {
  try {
    const logEntry = {
      action: options.action,
      entityType: options.entityType,
      entityId: options.entityId,
      actorUserId: options.userId,
      tenantId: options.tenantId,
      metadata: {
        result: options.result,
        ipAddress: options.ipAddress,
        userAgent: options.userAgent,
        timestamp: new Date().toISOString(),
        ...options.metadata,
        ...(options.errorMessage && { errorMessage: options.errorMessage }),
      },
    };

    await prisma.auditEvent.create({
      data: logEntry,
    });

    console.log(`[AuditLog] ${options.action} - ${options.result} - User: ${options.userId || 'unknown'}`);
  } catch (error: any) {
    console.error('[AuditLog] Failed to log audit event:', error);
    // Don't throw - audit logging failures should not break the application
  }
}

/**
 * 2FA Events Logging
 */

export async function log2FAEnabled(userId: string, ipAddress?: string, userAgent?: string): Promise<void> {
  await logAuditEvent({
    userId,
    action: '2FA_ENABLED',
    entityType: 'TwoFactorAuth',
    entityId: userId,
    ipAddress,
    userAgent,
    result: 'success',
    metadata: {
      description: 'Two-factor authentication enabled',
    },
  });
}

export async function log2FADisabled(userId: string, ipAddress?: string, userAgent?: string): Promise<void> {
  await logAuditEvent({
    userId,
    action: '2FA_DISABLED',
    entityType: 'TwoFactorAuth',
    entityId: userId,
    ipAddress,
    userAgent,
    result: 'success',
    metadata: {
      description: 'Two-factor authentication disabled',
    },
  });
}

export async function logTOTPVerified(userId: string, ipAddress?: string, userAgent?: string): Promise<void> {
  await logAuditEvent({
    userId,
    action: 'TOTP_VERIFIED',
    entityType: 'TwoFactorAuth',
    entityId: userId,
    ipAddress,
    userAgent,
    result: 'success',
    metadata: {
      description: 'TOTP code verified successfully',
    },
  });
}

export async function logTOTPVerificationFailed(
  userId: string,
  reason: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await logAuditEvent({
    userId,
    action: 'TOTP_VERIFICATION_FAILED',
    entityType: 'TwoFactorAuth',
    entityId: userId,
    ipAddress,
    userAgent,
    result: 'failure',
    errorMessage: reason,
    metadata: {
      description: 'TOTP code verification failed',
      reason,
    },
  });
}

export async function logRecoveryCodeUsed(userId: string, ipAddress?: string, userAgent?: string): Promise<void> {
  await logAuditEvent({
    userId,
    action: 'RECOVERY_CODE_USED',
    entityType: 'TwoFactorAuth',
    entityId: userId,
    ipAddress,
    userAgent,
    result: 'success',
    metadata: {
      description: 'Recovery code used for login',
    },
  });
}

export async function logRecoveryCodesRegenerated(userId: string, ipAddress?: string, userAgent?: string): Promise<void> {
  await logAuditEvent({
    userId,
    action: 'RECOVERY_CODES_REGENERATED',
    entityType: 'TwoFactorAuth',
    entityId: userId,
    ipAddress,
    userAgent,
    result: 'success',
    metadata: {
      description: 'Recovery codes regenerated',
    },
  });
}

/**
 * Login Events Logging
 */

export async function logLoginAttempt(
  userId: string,
  success: boolean,
  ipAddress?: string,
  userAgent?: string,
  reason?: string
): Promise<void> {
  await logAuditEvent({
    userId,
    action: 'LOGIN_ATTEMPT',
    entityType: 'Authentication',
    entityId: userId,
    ipAddress,
    userAgent,
    result: success ? 'success' : 'failure',
    errorMessage: reason,
    metadata: {
      description: success ? 'Login successful' : 'Login failed',
      reason: !success ? reason : undefined,
    },
  });
}

export async function logSuspiciousLogin(
  userId: string,
  location: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await logAuditEvent({
    userId,
    action: 'SUSPICIOUS_LOGIN_DETECTED',
    entityType: 'Authentication',
    entityId: userId,
    ipAddress,
    userAgent,
    result: 'success',
    metadata: {
      description: 'Suspicious login from new device/location',
      location,
    },
  });
}

/**
 * Password Change Events
 */

export async function logPasswordChanged(userId: string, ipAddress?: string, userAgent?: string): Promise<void> {
  await logAuditEvent({
    userId,
    action: 'PASSWORD_CHANGED',
    entityType: 'User',
    entityId: userId,
    ipAddress,
    userAgent,
    result: 'success',
    metadata: {
      description: 'User password changed',
    },
  });
}

/**
 * Account Security Events
 */

export async function logAccountSecurityAlert(
  userId: string,
  alertType: string,
  details: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await logAuditEvent({
    userId,
    action: 'SECURITY_ALERT',
    entityType: 'User',
    entityId: userId,
    ipAddress,
    userAgent,
    result: 'success',
    metadata: {
      description: 'Security alert triggered',
      alertType,
      details,
    },
  });
}

/**
 * Get audit logs for a user (admin endpoint)
 */
export async function getUserAuditLogs(
  userId: string,
  limit: number = 100,
  offset: number = 0
): Promise<{
  logs: any[];
  total: number;
}> {
  try {
    const [logs, total] = await Promise.all([
      prisma.auditEvent.findMany({
        where: {
          actorUserId: userId,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
        skip: offset,
      }),
      prisma.auditEvent.count({
        where: {
          actorUserId: userId,
        },
      }),
    ]);

    return {
      logs: logs.map((log) => ({
        id: log.id,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        timestamp: log.createdAt,
        result: log.metadata?.result || 'unknown',
        ipAddress: log.metadata?.ipAddress,
        userAgent: log.metadata?.userAgent,
        details: log.metadata?.description,
      })),
      total,
    };
  } catch (error: any) {
    console.error('[AuditLog] Failed to get user audit logs:', error);
    throw new Error('Failed to retrieve audit logs');
  }
}

/**
 * Get 2FA-specific audit logs for a user
 */
export async function get2FAAuditLogs(userId: string, limit: number = 50): Promise<any[]> {
  try {
    const logs = await prisma.auditEvent.findMany({
      where: {
        actorUserId: userId,
        entityType: 'TwoFactorAuth',
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    return logs.map((log) => ({
      id: log.id,
      action: log.action,
      timestamp: log.createdAt,
      result: log.metadata?.result || 'unknown',
      ipAddress: log.metadata?.ipAddress,
      details: log.metadata?.description,
    }));
  } catch (error: any) {
    console.error('[AuditLog] Failed to get 2FA audit logs:', error);
    throw new Error('Failed to retrieve 2FA audit logs');
  }
}

/**
 * Get security events for a user (used for security dashboard)
 */
export async function getSecurityEvents(
  userId: string,
  days: number = 30,
  limit: number = 100
): Promise<any[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  try {
    const logs = await prisma.auditEvent.findMany({
      where: {
        actorUserId: userId,
        createdAt: {
          gte: startDate,
        },
        OR: [
          { action: 'LOGIN_ATTEMPT' },
          { action: 'SUSPICIOUS_LOGIN_DETECTED' },
          { action: '2FA_ENABLED' },
          { action: '2FA_DISABLED' },
          { action: 'PASSWORD_CHANGED' },
          { action: 'SECURITY_ALERT' },
        ],
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    return logs.map((log) => ({
      id: log.id,
      action: log.action,
      timestamp: log.createdAt,
      result: log.metadata?.result || 'unknown',
      ipAddress: log.metadata?.ipAddress,
      location: log.metadata?.location,
      details: log.metadata?.description,
    }));
  } catch (error: any) {
    console.error('[AuditLog] Failed to get security events:', error);
    throw new Error('Failed to retrieve security events');
  }
}
