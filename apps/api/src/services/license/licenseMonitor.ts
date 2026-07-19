import { PrismaClient, Tenant } from '@prisma/client';
import { sendEmail, notificationEmail } from '../email.js';
import { getLicenseStatus } from './licenseStatus.js';

const GRACE_PERIOD_DAYS = 7;
const MAX_NOTIFICATIONS_PER_EVENT = 3;   // max emails per expired/grace event
const MIN_HOURS_BETWEEN_EMAILS = 24;     // min gap between emails

// Helper to check if running in production environment
function isProductionEnvironment(): boolean {
  const corsOrigin = process.env.CORS_ORIGIN || '';
  const isTesting = corsOrigin.includes('test.logismart.ar') || corsOrigin.includes('localhost:4000');
  return process.env.NODE_ENV === 'production' && !isTesting;
}

interface NotifyResult {
  tenantId: string;
  tenantName: string;
  emailsSent: number;
  status: string;
}

export class LicenseMonitor {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  // Check if we should send a notification for this event type.
  // Uses license_notifications table (raw SQL) to enforce max 3 sends with 24h gap.
  private async shouldNotify(tenantId: string, type: string): Promise<boolean> {
    const threeDaysAgo = new Date(Date.now() - MAX_NOTIFICATIONS_PER_EVENT * 24 * 60 * 60 * 1000);
    const minGapAgo = new Date(Date.now() - MIN_HOURS_BETWEEN_EMAILS * 60 * 60 * 1000);
    try {
      const rows = await this.prisma.$queryRaw<{ count: bigint; last_sent: Date | null }[]>`
        SELECT COUNT(*)::bigint AS count, MAX("createdAt") AS last_sent
        FROM license_notifications
        WHERE "tenantId" = ${tenantId}::uuid AND type = ${type}::"LicenseNotificationType"
          AND "createdAt" >= ${threeDaysAgo}
      `;
      const count = Number(rows[0]?.count ?? 0);
      const lastSent = rows[0]?.last_sent ? new Date(rows[0].last_sent) : null;
      if (count >= MAX_NOTIFICATIONS_PER_EVENT) return false;
      if (lastSent && lastSent > minGapAgo) return false;
      return true;
    } catch {
      return true; // on error allow sending
    }
  }

  private async recordNotification(tenantId: string, type: string, title: string, message: string) {
    try {
      await this.prisma.$executeRaw`
        INSERT INTO license_notifications (id, "tenantId", title, message, type, "createdAt")
        VALUES (gen_random_uuid(), ${tenantId}::uuid, ${title}, ${message}, ${type}::"LicenseNotificationType", NOW())
      `;
    } catch { /* non-critical */ }
  }

  async runDailyCheck(): Promise<NotifyResult[]> {
    const results: NotifyResult[] = [];
    const now = new Date();

    const tenants = await this.prisma.tenant.findMany({
      where: {
        status: 'ACTIVE',
        licenseEndAt: { not: null },
      },
      include: {
        memberships: {
          where: { role: 'ADMIN' },
          include: { user: { select: { email: true } } },
        },
      },
    });

    for (const tenant of tenants as any[]) {
      const status = getLicenseStatus(
        tenant.licenseEndAt,
        tenant.graceEndAt,
        tenant.licenseStatus
      );

      // Sync DB if status changed
      if (tenant.licenseStatus !== status.status) {
        await this.prisma.tenant.update({
          where: { id: tenant.id },
          data: {
            licenseStatus: status.status as any,
            ...(status.status === 'GRACE' && !tenant.graceEndAt
              ? {
                  graceEndAt: new Date(
                    new Date(tenant.licenseEndAt).getTime() +
                      GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000
                  ),
                }
              : {}),
          },
        });
      }

      const adminEmails = tenant.memberships
        .map((m: any) => m.user?.email)
        .filter(Boolean);

      let emailsSent = 0;

      if (status.status === 'EXPIRING' && status.daysUntilExpiry !== null && status.daysUntilExpiry <= 1) {
        const canSend = await this.shouldNotify(tenant.id, 'SUBSCRIPTION_EXPIRING_1D');
        if (canSend) {
          await this.notifyExpiring(tenant, status.daysUntilExpiry, 'urgente');
          await this.recordNotification(tenant.id, 'SUBSCRIPTION_EXPIRING_1D', 'Licencia vence mañana', `Vence en ${status.daysUntilExpiry} día(s)`);
          emailsSent = adminEmails.length;
        }
      }

      if (status.status === 'GRACE' && status.graceDaysRemaining !== null) {
        const canSend = await this.shouldNotify(tenant.id, 'GRACE_PERIOD_STARTED');
        if (canSend) {
          await this.notifyGrace(tenant, status.graceDaysRemaining);
          await this.recordNotification(tenant.id, 'GRACE_PERIOD_STARTED', 'Período de gracia activo', `Quedan ${status.graceDaysRemaining} días`);
          emailsSent = adminEmails.length;
        }
      }

      if (status.status === 'EXPIRED') {
        const canSend = await this.shouldNotify(tenant.id, 'SUBSCRIPTION_EXPIRED');
        if (canSend) {
          await this.notifyExpired(tenant);
          await this.recordNotification(tenant.id, 'SUBSCRIPTION_EXPIRED', 'Licencia expirada', 'La licencia y el período de gracia finalizaron');
          emailsSent = adminEmails.length;
        }
      }

      results.push({
        tenantId: tenant.id,
        tenantName: tenant.name,
        emailsSent,
        status: status.status,
      });
    }

    return results;
  }

  private async notifyExpiring(
    tenant: any,
    daysLeft: number,
    urgency: 'leve' | 'visible' | 'urgente'
  ) {
    if (!isProductionEnvironment()) {
      console.log(`[LICENSE_MONITOR] notifyExpiring suppressed - not in production environment`);
      return;
    }
    
    const environment = process.env.ENVIRONMENT || 'PROD';
    const envPrefix = environment === 'TESTING' ? '[TESTING] ' : '[PROD] ';
    
    const urgencyLabels: Record<string, { subject: string; color: string }> = {
      leve: { subject: 'Tu licencia vence pronto', color: '#F59E0B' },
      visible: { subject: 'Tu licencia vence en pocos días', color: '#F97316' },
      urgente: { subject: 'Tu licencia vence mañana', color: '#EF4444' },
    };

    const label = urgencyLabels[urgency];
    const appUrl = process.env.CORS_ORIGIN || 'https://logismart.ar';

    for (const membership of tenant.memberships) {
      const email = membership.user?.email;
      if (!email) continue;

      try {
        await sendEmail({
          to: email,
          subject: `${envPrefix}${label.subject}`,
          html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: ${label.color};">${label.subject}</h2>
            <p>La licencia de <strong>${tenant.name}</strong> vence en <strong>${daysLeft} día${daysLeft !== 1 ? 's' : ''}</strong>.</p>
            <p>Renová ahora para evitar interrupciones en el servicio.</p>
            <a href="${appUrl}/billing" style="display: inline-block; background: ${label.color}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px;">Renovar licencia</a>
          </div>`,
        });
      } catch (err: any) {
        console.error(`[LICENSE_MONITOR] Failed to send email to ${email}:`, err.message);
      }
    }
  }

  private async notifyGrace(tenant: any, daysRemaining: number) {
    if (!isProductionEnvironment()) {
      console.log(`[LICENSE_MONITOR] notifyGrace suppressed - not in production environment`);
      return;
    }
    
    const environment = process.env.ENVIRONMENT || 'PROD';
    const envPrefix = environment === 'TESTING' ? '[TESTING] ' : '[PROD] ';
    const appUrl = process.env.CORS_ORIGIN || 'https://logismart.ar';

    for (const membership of tenant.memberships) {
      const email = membership.user?.email;
      if (!email) continue;

      try {
        await sendEmail({
          to: email,
          subject: `${envPrefix}Tu licencia venció — período de gracia activo`,
          html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #F97316;">Tu licencia venció</h2>
            <p>La licencia de <strong>${tenant.name}</strong> venció. Tenés <strong>${daysRemaining} día${daysRemaining !== 1 ? 's' : ''}</strong> de gracia para renovarla.</p>
            <p>Durante este período el sistema está en <strong>modo solo lectura</strong>. No podrás crear ni modificar registros.</p>
            <a href="${appUrl}/billing" style="display: inline-block; background: #F97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px;">Renovar licencia</a>
          </div>`,
        });
      } catch (err: any) {
        console.error(`[LICENSE_MONITOR] Failed to send email to ${email}:`, err.message);
      }
    }
  }

  private async notifyExpired(tenant: any) {
    if (!isProductionEnvironment()) {
      console.log(`[LICENSE_MONITOR] notifyExpired suppressed - not in production environment`);
      return;
    }
    
    const environment = process.env.ENVIRONMENT || 'PROD';
    const envPrefix = environment === 'TESTING' ? '[TESTING] ' : '[PROD] ';
    const appUrl = process.env.CORS_ORIGIN || 'https://logismart.ar';

    for (const membership of tenant.memberships) {
      const email = membership.user?.email;
      if (!email) continue;

      try {
        await sendEmail({
          to: email,
          subject: `${envPrefix}Tu licencia expiró — reactivá tu cuenta`,
          html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #EF4444;">Tu licencia expiró</h2>
            <p>La licencia de <strong>${tenant.name}</strong> expiró y el período de gracia finalizó.</p>
            <p>Para reactivar el acceso completo, renová tu licencia.</p>
            <a href="${appUrl}/billing" style="display: inline-block; background: #EF4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px;">Reactivar cuenta</a>
          </div>`,
        });
      } catch (err: any) {
        console.error(`[LICENSE_MONITOR] Failed to send email to ${email}:`, err.message);
      }
    }
  }
}
