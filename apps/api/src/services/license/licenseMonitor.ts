import { PrismaClient, Tenant } from '@prisma/client';
import { sendEmail, notificationEmail } from '../email.js';
import { getLicenseStatus } from './licenseStatus.js';

const GRACE_PERIOD_DAYS = 7;

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

      // Check notifications progressively
      if (status.status === 'EXPIRING' && status.daysUntilExpiry !== null) {
        if (status.daysUntilExpiry <= 1 && !tenant.notified1Day) {
          await this.notifyExpiring(tenant, status.daysUntilExpiry, 'urgente');
          await this.markNotified(tenant.id, 'notified1Day');
          emailsSent = adminEmails.length;
        }
      }

      if (status.status === 'GRACE' && !tenant.notifiedGrace && status.graceDaysRemaining !== null) {
        await this.notifyGrace(tenant, status.graceDaysRemaining);
        await this.markNotified(tenant.id, 'notifiedGrace');
        emailsSent = adminEmails.length;
      }

      if (status.status === 'EXPIRED' && !tenant.notifiedExpired) {
        await this.notifyExpired(tenant);
        await this.markNotified(tenant.id, 'notifiedExpired');
        emailsSent = adminEmails.length;
      }

      // Reset notification flags on renewal
      if (status.status === 'ACTIVE' && tenant.licenseEndAt && new Date(tenant.licenseEndAt) > now) {
        const anyFlag = tenant.notified7Days || tenant.notified3Days || tenant.notified1Day || tenant.notifiedExpired || tenant.notifiedGrace;
        if (anyFlag) {
          await this.prisma.tenant.update({
            where: { id: tenant.id },
            data: {
              notified7Days: false,
              notified3Days: false,
              notified1Day: false,
              notifiedExpired: false,
              notifiedGrace: false,
            },
          });
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

  private async markNotified(tenantId: string, field: string) {
    await (this.prisma.tenant as any).update({
      where: { id: tenantId },
      data: { [field]: true },
    });
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
