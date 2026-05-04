import { PrismaClient } from '@prisma/client';

export type LicenseStatusResult = {
  status: 'ACTIVE' | 'EXPIRING' | 'GRACE' | 'EXPIRED';
  daysUntilExpiry: number | null;
  graceDaysRemaining: number | null;
  isBlocked: boolean;
  canWrite: boolean;
};

const GRACE_PERIOD_DAYS = 7;
const EXPIRING_THRESHOLD_DAYS = 3;

export function getLicenseStatus(
  licenseEndAt: Date | null,
  graceEndAt: Date | null,
  licenseStatus: string
): LicenseStatusResult {
  const now = new Date();

  if (!licenseEndAt) {
    return {
      status: 'ACTIVE',
      daysUntilExpiry: null,
      graceDaysRemaining: null,
      isBlocked: false,
      canWrite: true,
    };
  }

  const expiryDate = new Date(licenseEndAt);
  const diffMs = expiryDate.getTime() - now.getTime();
  const daysUntilExpiry = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  // Before expiry - more than 3 days
  if (daysUntilExpiry > EXPIRING_THRESHOLD_DAYS) {
    return {
      status: 'ACTIVE',
      daysUntilExpiry,
      graceDaysRemaining: null,
      isBlocked: false,
      canWrite: true,
    };
  }

  // Expiring - 0 to 3 days before expiry
  if (daysUntilExpiry > 0 && daysUntilExpiry <= EXPIRING_THRESHOLD_DAYS) {
    return {
      status: 'EXPIRING',
      daysUntilExpiry,
      graceDaysRemaining: null,
      isBlocked: false,
      canWrite: true,
    };
  }

  // Today is the exact expiry day (daysUntilExpiry <= 0 but same calendar day)
  // or past expiry but before grace end
  const actualGraceEnd = graceEndAt
    ? new Date(graceEndAt)
    : new Date(expiryDate.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);

  const graceDiffMs = actualGraceEnd.getTime() - now.getTime();
  const graceDaysRemaining = Math.ceil(graceDiffMs / (1000 * 60 * 60 * 24));

  if (graceDaysRemaining > 0) {
    return {
      status: 'GRACE',
      daysUntilExpiry: 0,
      graceDaysRemaining,
      isBlocked: false,
      canWrite: false, // Read-only during grace
    };
  }

  // Expired
  return {
    status: 'EXPIRED',
    daysUntilExpiry: 0,
    graceDaysRemaining: 0,
    isBlocked: true,
    canWrite: false,
  };
}

export async function updateTenantLicenseStatus(
  prisma: PrismaClient,
  tenantId: string
): Promise<LicenseStatusResult> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      licenseEndAt: true,
      graceEndAt: true,
      licenseStatus: true,
    },
  });

  if (!tenant) {
    return {
      status: 'ACTIVE',
      daysUntilExpiry: null,
      graceDaysRemaining: null,
      isBlocked: false,
      canWrite: true,
    };
  }

  const result = getLicenseStatus(
    tenant.licenseEndAt,
    tenant.graceEndAt,
    tenant.licenseStatus as string
  );

  // Sync DB status if changed
  if (tenant.licenseStatus !== result.status) {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { licenseStatus: result.status as any },
    });
  }

  return result;
}
