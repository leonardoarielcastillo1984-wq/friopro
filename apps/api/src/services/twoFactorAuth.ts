import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

// Types
export interface TOTPSetup {
  secret: string;
  qrCodeUrl: string;
  manualEntryKey: string;
}

export interface RecoveryCode {
  code: string;
  encrypted: string;
}

/**
 * Generate a TOTP secret and QR code URL
 * Requires: npm install speakeasy qrcode
 */
export async function generateTOTPSecret(email: string): Promise<TOTPSetup> {
  try {
    // Dynamic import to avoid issues if speakeasy isn't installed
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
  } catch (error) {
    console.error('Error generating TOTP secret:', error);
    throw new Error('Failed to generate TOTP secret. Please ensure speakeasy and qrcode are installed.');
  }
}

/**
 * Verify a TOTP token
 */
export async function verifyTOTPToken(secret: string, token: string, window: number = 1): Promise<boolean> {
  try {
    const speakeasy = await import('speakeasy');

    const verified = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window,
    });

    return verified;
  } catch (error) {
    console.error('Error verifying TOTP token:', error);
    return false;
  }
}

/**
 * Enable 2FA for a user
 */
export async function enable2FA(
  userId: string,
  secret: string,
  createdById?: string
): Promise<any> {
  try {
    const twoFA = await prisma.twoFactorAuth.create({
      data: {
        userId,
        secret,
        isEnabled: false, // Not enabled until user confirms
        isConfirmed: false,
        createdById,
      },
    });

    return twoFA;
  } catch (error) {
    console.error('Error enabling 2FA:', error);
    throw error;
  }
}

/**
 * Confirm 2FA (user has verified setup with TOTP token)
 */
export async function confirm2FA(
  userId: string,
  token: string
): Promise<any> {
  try {
    const twoFA = await prisma.twoFactorAuth.findUnique({
      where: { userId },
    });

    if (!twoFA) {
      throw new Error('2FA not found for user');
    }

    // Verify the token
    const isValid = await verifyTOTPToken(twoFA.secret, token);
    if (!isValid) {
      throw new Error('Invalid TOTP token');
    }

    // Update 2FA as confirmed and enabled
    const updated = await prisma.twoFactorAuth.update({
      where: { id: twoFA.id },
      data: {
        isConfirmed: true,
        isEnabled: true,
        enabledAt: new Date(),
      },
    });

    return updated;
  } catch (error) {
    console.error('Error confirming 2FA:', error);
    throw error;
  }
}

/**
 * Disable 2FA for a user
 */
export async function disable2FA(userId: string): Promise<void> {
  try {
    const twoFA = await prisma.twoFactorAuth.findUnique({
      where: { userId },
    });

    if (!twoFA) {
      throw new Error('2FA not found for user');
    }

    await prisma.twoFactorAuth.update({
      where: { id: twoFA.id },
      data: {
        isEnabled: false,
        isConfirmed: false,
        disabledAt: new Date(),
      },
    });
  } catch (error) {
    console.error('Error disabling 2FA:', error);
    throw error;
  }
}

/**
 * Generate recovery codes
 */
export async function generateRecoveryCodes(
  userId: string,
  count: number = 10
): Promise<string[]> {
  try {
    const twoFA = await prisma.twoFactorAuth.findUnique({
      where: { userId },
    });

    if (!twoFA) {
      throw new Error('2FA not found for user');
    }

    // Generate codes
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      // Format: XXXX-XXXX (8 characters each)
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      const formatted = `${code.substring(0, 4)}-${code.substring(4, 8)}`;
      codes.push(formatted);

      // Hash and store the code
      const hash = crypto.createHash('sha256').update(formatted).digest('hex');

      await prisma.twoFactorRecoveryCode.create({
        data: {
          twoFactorAuthId: twoFA.id,
          code: hash,
        },
      });
    }

    return codes;
  } catch (error) {
    console.error('Error generating recovery codes:', error);
    throw error;
  }
}

/**
 * Verify a recovery code
 */
export async function verifyRecoveryCode(
  userId: string,
  code: string,
  ipAddress?: string,
  userAgent?: string
): Promise<boolean> {
  try {
    const twoFA = await prisma.twoFactorAuth.findUnique({
      where: { userId },
    });

    if (!twoFA) {
      throw new Error('2FA not found for user');
    }

    // Hash the provided code
    const hash = crypto.createHash('sha256').update(code).digest('hex');

    // Find the unused recovery code
    const recoveryCode = await prisma.twoFactorRecoveryCode.findFirst({
      where: {
        twoFactorAuthId: twoFA.id,
        code: hash,
        used: false,
      },
    });

    if (!recoveryCode) {
      return false;
    }

    // Mark code as used
    await prisma.twoFactorRecoveryCode.update({
      where: { id: recoveryCode.id },
      data: {
        used: true,
        usedAt: new Date(),
        usedBy: ipAddress || userAgent || 'unknown',
      },
    });

    return true;
  } catch (error) {
    console.error('Error verifying recovery code:', error);
    return false;
  }
}

/**
 * Get recovery codes for a user (admin only)
 */
export async function getRecoveryCodes(userId: string): Promise<any[]> {
  try {
    const twoFA = await prisma.twoFactorAuth.findUnique({
      where: { userId },
    });

    if (!twoFA) {
      throw new Error('2FA not found for user');
    }

    const codes = await prisma.twoFactorRecoveryCode.findMany({
      where: { twoFactorAuthId: twoFA.id },
      select: {
        id: true,
        used: true,
        usedAt: true,
        usedBy: true,
        createdAt: true,
      },
    });

    return codes;
  } catch (error) {
    console.error('Error getting recovery codes:', error);
    throw error;
  }
}

/**
 * Get 2FA status for a user
 */
export async function get2FAStatus(userId: string): Promise<any> {
  try {
    const twoFA = await prisma.twoFactorAuth.findUnique({
      where: { userId },
      select: {
        id: true,
        isEnabled: true,
        isConfirmed: true,
        enabledAt: true,
        disabledAt: true,
        recoveryCodes: {
          select: {
            id: true,
            used: true,
            usedAt: true,
          },
        },
      },
    });

    if (!twoFA) {
      return {
        isEnabled: false,
        isConfirmed: false,
        recoveryCodesGenerated: 0,
        recoveryCodesUsed: 0,
      };
    }

    const usedCodes = twoFA.recoveryCodes.filter((c) => c.used).length;
    const totalCodes = twoFA.recoveryCodes.length;

    return {
      isEnabled: twoFA.isEnabled,
      isConfirmed: twoFA.isConfirmed,
      enabledAt: twoFA.enabledAt,
      disabledAt: twoFA.disabledAt,
      recoveryCodesGenerated: totalCodes,
      recoveryCodesUsed: usedCodes,
      recoveryCodesRemaining: totalCodes - usedCodes,
    };
  } catch (error) {
    console.error('Error getting 2FA status:', error);
    throw error;
  }
}

/**
 * Create a temporary 2FA session
 */
export async function create2FASession(
  userId: string,
  expiresIn: number = 10 * 60 * 1000, // 10 minutes default
  ipAddress?: string,
  userAgent?: string
): Promise<string> {
  try {
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + expiresIn);

    const session = await prisma.twoFactorSession.create({
      data: {
        userId,
        sessionToken,
        expiresAt,
        ipAddress,
        userAgent,
      },
    });

    return session.sessionToken;
  } catch (error) {
    console.error('Error creating 2FA session:', error);
    throw error;
  }
}

/**
 * Verify a 2FA session token
 */
export async function verify2FASession(sessionToken: string): Promise<any> {
  try {
    const session = await prisma.twoFactorSession.findUnique({
      where: { sessionToken },
    });

    if (!session) {
      return null;
    }

    // Check if session has expired
    if (session.expiresAt < new Date()) {
      // Delete expired session
      await prisma.twoFactorSession.delete({ where: { id: session.id } });
      return null;
    }

    return session;
  } catch (error) {
    console.error('Error verifying 2FA session:', error);
    return null;
  }
}

/**
 * Mark 2FA session as verified
 */
export async function verify2FASessionWithToken(
  sessionToken: string,
  totpToken: string,
  userId: string
): Promise<boolean> {
  try {
    const session = await verify2FASession(sessionToken);
    if (!session || session.userId !== userId) {
      return false;
    }

    // Verify the TOTP token
    const twoFA = await prisma.twoFactorAuth.findUnique({
      where: { userId },
    });

    if (!twoFA || !twoFA.isEnabled) {
      return false;
    }

    const isValid =
      (await verifyTOTPToken(twoFA.secret, totpToken)) ||
      (await verifyRecoveryCode(userId, totpToken));

    if (!isValid) {
      return false;
    }

    // Mark session as verified
    await prisma.twoFactorSession.update({
      where: { id: session.id },
      data: { verified: true },
    });

    return true;
  } catch (error) {
    console.error('Error verifying 2FA session with token:', error);
    return false;
  }
}

/**
 * Clean up expired 2FA sessions
 */
export async function cleanupExpired2FASessions(): Promise<number> {
  try {
    const result = await prisma.twoFactorSession.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    return result.count;
  } catch (error) {
    console.error('Error cleaning up expired 2FA sessions:', error);
    return 0;
  }
}

/**
 * Force-enable 2FA for a user (admin only)
 */
export async function forceEnable2FA(
  userId: string,
  adminUserId: string
): Promise<any> {
  try {
    // Generate new TOTP secret
    const user = await prisma.platformUser.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const setup = await generateTOTPSecret(user.email);

    // Create or update 2FA
    let twoFA = await prisma.twoFactorAuth.findUnique({
      where: { userId },
    });

    if (twoFA) {
      twoFA = await prisma.twoFactorAuth.update({
        where: { id: twoFA.id },
        data: {
          secret: setup.secret,
          qrCodeUrl: setup.qrCodeUrl,
          isEnabled: true,
          isConfirmed: true,
          enabledAt: new Date(),
          createdById: adminUserId,
        },
      });
    } else {
      twoFA = await prisma.twoFactorAuth.create({
        data: {
          userId,
          secret: setup.secret,
          qrCodeUrl: setup.qrCodeUrl,
          isEnabled: true,
          isConfirmed: true,
          enabledAt: new Date(),
          createdById: adminUserId,
        },
      });
    }

    return {
      ...twoFA,
      qrCodeUrl: setup.qrCodeUrl,
      manualEntryKey: setup.manualEntryKey,
    };
  } catch (error) {
    console.error('Error force-enabling 2FA:', error);
    throw error;
  }
}
