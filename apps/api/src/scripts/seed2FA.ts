/**
 * Seed script for 2FA test data
 * Populates TwoFactorAuth, TwoFactorRecoveryCode, and TwoFactorSession test data
 */

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

// Test TOTP secret (can be scanned by authenticator apps)
// This is a real base32 encoded secret for testing
const TEST_TOTP_SECRET = 'JBSWY3DPEBLW64TMMQ======';

async function seed2FA() {
  console.log('Starting 2FA seed...');

  try {
    // Check if test users exist
    const testUser1 = await prisma.platformUser.findUnique({
      where: { email: 'test-2fa@sgi360.local' },
    });

    if (!testUser1) {
      console.log('Test user not found. Please run seedUsers.ts first.');
      return;
    }

    // Check if 2FA already exists for this user
    const existingTwoFA = await prisma.twoFactorAuth.findUnique({
      where: { userId: testUser1.id },
    });

    if (existingTwoFA) {
      console.log(
        `2FA already exists for user ${testUser1.email}. Skipping...`
      );
      return;
    }

    // Create TwoFactorAuth record
    const twoFA = await prisma.twoFactorAuth.create({
      data: {
        userId: testUser1.id,
        secret: TEST_TOTP_SECRET,
        isEnabled: true,
        isConfirmed: true,
        enabledAt: new Date(),
      },
    });

    console.log(`✓ Created TwoFactorAuth for ${testUser1.email}`);

    // Generate 10 recovery codes
    const recoveryCodes: string[] = [];
    for (let i = 0; i < 10; i++) {
      // Generate code in format XXXX-XXXX
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      const formatted = `${code.substring(0, 4)}-${code.substring(4, 8)}`;
      recoveryCodes.push(formatted);

      // Hash the code
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

    console.log(`✓ Generated 10 recovery codes for ${testUser1.email}`);
    console.log('\nRecovery Codes (save these securely):');
    recoveryCodes.forEach((code, index) => {
      console.log(`  ${index + 1}. ${code}`);
    });

    // Create a test 2FA session
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const session = await prisma.twoFactorSession.create({
      data: {
        userId: testUser1.id,
        sessionToken,
        verified: false,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
        ipAddress: '127.0.0.1',
        userAgent: 'Test/1.0',
      },
    });

    console.log(`\n✓ Created test 2FA session`);
    console.log(`  Session Token: ${sessionToken}`);
    console.log(`  Expires: ${session.expiresAt.toISOString()}`);

    // Check if admin user exists for audit trail
    const adminUser = await prisma.platformUser.findUnique({
      where: { email: 'admin@sgi360.local' },
    });

    // Create another test user with 2FA enabled by admin
    const testUser2 = await prisma.platformUser.findUnique({
      where: { email: 'test-2fa-admin@sgi360.local' },
    });

    if (testUser2 && adminUser) {
      const existingTwoFA2 = await prisma.twoFactorAuth.findUnique({
        where: { userId: testUser2.id },
      });

      if (!existingTwoFA2) {
        const twoFA2 = await prisma.twoFactorAuth.create({
          data: {
            userId: testUser2.id,
            secret: TEST_TOTP_SECRET,
            isEnabled: true,
            isConfirmed: true,
            enabledAt: new Date(),
            createdById: adminUser.id,
          },
        });

        console.log(`✓ Created 2FA for ${testUser2.email} (enabled by admin)`);

        // Generate recovery codes for second user
        for (let i = 0; i < 10; i++) {
          const code = crypto.randomBytes(4).toString('hex').toUpperCase();
          const formatted = `${code.substring(0, 4)}-${code.substring(4, 8)}`;
          const hash = crypto
            .createHash('sha256')
            .update(formatted)
            .digest('hex');

          await prisma.twoFactorRecoveryCode.create({
            data: {
              twoFactorAuthId: twoFA2.id,
              code: hash,
            },
          });
        }

        console.log(`✓ Generated recovery codes for ${testUser2.email}`);
      }
    }

    // Print summary
    console.log('\n========================================');
    console.log('2FA Test Data Summary');
    console.log('========================================');
    console.log(`Email: ${testUser1.email}`);
    console.log(`2FA Enabled: true`);
    console.log(`2FA Confirmed: true`);
    console.log(`TOTP Secret (base32): ${TEST_TOTP_SECRET}`);
    console.log(`Recovery Codes: 10 generated`);
    console.log('\n⚠️  Important Notes:');
    console.log(
      '  1. The TOTP secret above can be used in authenticator apps'
    );
    console.log('  2. Recovery codes are one-time use only');
    console.log('  3. 2FA sessions expire after 10 minutes');
    console.log('  4. Save recovery codes in a secure location');
    console.log('========================================\n');
  } catch (error) {
    console.error('Error seeding 2FA data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seed2FA()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  });
