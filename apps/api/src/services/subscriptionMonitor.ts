/**
 * Subscription Monitor Service - Monitors subscription payments and sends alerts
 */

import { sendEmail, notificationEmail } from './email.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class SubscriptionMonitor {
  private static instance: SubscriptionMonitor;
  private lastPaymentAlert: Map<string, Date> = new Map();
  private readonly PAYMENT_WARNING_DAYS = 3; // Alert 3 days before suspension
  private readonly ALERT_COOLDOWN = 24 * 60 * 60 * 1000; // 24 hours

  static getInstance(): SubscriptionMonitor {
    if (!SubscriptionMonitor.instance) {
      SubscriptionMonitor.instance = new SubscriptionMonitor();
    }
    return SubscriptionMonitor.instance;
  }

  // Check for overdue and soon-to-be-overdue subscriptions
  async checkSubscriptionPayments(): Promise<void> {
    try {
      console.log(`[SUBSCRIPTION_MONITOR] Checking subscription payments...`);
      
      const now = new Date();
      const warningDate = new Date(now.getTime() + (this.PAYMENT_WARNING_DAYS * 24 * 60 * 60 * 1000));
      
      // Find all active subscriptions and filter manually (Prisma doesn't handle null comparisons well)
      const allActiveSubscriptions = await prisma.tenantSubscription.findMany({
        where: {
          status: 'ACTIVE'
        },
        include: {
          tenant: {
            select: {
              id: true,
              name: true
            }
          },
          plan: {
            select: {
              id: true,
              name: true,
              monthlyPrice: true,
              annualPrice: true
            }
          }
        }
      });

      // Filter manually for subscriptions with endsAt <= warningDate
      const expiringSubscriptions = allActiveSubscriptions.filter(sub => 
        sub.endsAt !== null && sub.endsAt <= warningDate
      );

      console.log(`[SUBSCRIPTION_MONITOR] Found ${expiringSubscriptions.length} subscriptions needing attention`);

      for (const subscription of expiringSubscriptions) {
        await this.processExpiringSubscription(subscription, now);
      }
    } catch (error) {
      console.error('[SUBSCRIPTION_MONITOR] Error checking subscription payments:', error);
    }
  }

  private async processExpiringSubscription(subscription: any, now: Date): Promise<void> {
    const { tenant, plan, endsAt } = subscription;
    const daysUntilExpiry = Math.ceil((endsAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    
    // Check cooldown for this specific subscription
    const alertKey = `${tenant.id}_${subscription.id}`;
    const lastAlert = this.lastPaymentAlert.get(alertKey);
    
    if (lastAlert && (now.getTime() - lastAlert.getTime()) < this.ALERT_COOLDOWN) {
      console.log(`[SUBSCRIPTION_MONITOR] Alert cooldown active for ${tenant.name}`);
      return;
    }

    let alertType: 'overdue' | 'warning';
    let urgency: 'critical' | 'high' | 'medium';
    
    if (daysUntilExpiry < 0) {
      alertType = 'overdue';
      urgency = Math.abs(daysUntilExpiry) > 7 ? 'critical' : 'high';
    } else if (daysUntilExpiry === 0) {
      alertType = 'overdue';
      urgency = 'high';
    } else {
      alertType = 'warning';
      urgency = 'medium';
    }

    await this.sendPaymentAlert(tenant, plan, daysUntilExpiry, alertType, urgency);
    this.lastPaymentAlert.set(alertKey, now);
  }

  private async sendPaymentAlert(
    tenant: any, 
    plan: any, 
    daysUntilExpiry: number, 
    alertType: 'overdue' | 'warning',
    urgency: 'critical' | 'high' | 'medium'
  ): Promise<void> {
    try {
      const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || process.env.SMTP_USER || 'leonardoarielcastillo@hotmail.com';
      const appUrl = process.env.CORS_ORIGIN || 'http://localhost:3000';
      
      let title: string;
      let message: string;
      let type: 'error' | 'warning';
      
      if (alertType === 'overdue') {
        title = '⚠️ Pago Vencido - Suscripción Suspendida';
        message = `La suscripción está vencida y necesita atención inmediata:\n\n` +
          `<strong>Empresa:</strong> ${tenant.name}\n` +
          `<strong>Plan:</strong> ${plan.name}\n` +
          `<strong>Días vencida:</strong> ${Math.abs(daysUntilExpiry)} días\n\n` +
          `Acciones recomendadas:\n` +
          `• Contactar al cliente para pago\n` +
          `• Considerar suspensión del servicio\n` +
          `• Evaluar cancelación si no responde`;
        type = 'error';
      } else {
        title = '⏰ Pago Próximo a Vencer';
        message = `La suscripción vencerá pronto:\n\n` +
          `<strong>Empresa:</strong> ${tenant.name}\n` +
          `<strong>Plan:</strong> ${plan.name}\n` +
          `<strong>Días restantes:</strong> ${daysUntilExpiry} días\n\n` +
          `Acciones recomendadas:\n` +
          `• Enviar recordatorio de pago\n` +
          `• Ofrecer renovación anticipada\n` +
          `• Preparar suspensión si no paga`;
        type = 'warning';
      }

      const emailPayload = notificationEmail({
        userEmail: adminEmail,
        title,
        message,
        actionLabel: alertType === 'overdue' ? 'Gestionar suscripción' : 'Ver suscripciones',
        actionUrl: `${appUrl}/admin/subscriptions`,
        type,
      });
      
      const emailResult = await sendEmail(emailPayload);
      if (emailResult.success) {
        console.log(`[SUBSCRIPTION_MONITOR] Payment alert sent for ${tenant.name} (${alertType})`);
      } else {
        console.error(`[SUBSCRIPTION_MONITOR] Error sending payment alert: ${emailResult.error}`);
      }
    } catch (emailError) {
      console.error(`[SUBSCRIPTION_MONITOR] Error sending payment notification: ${emailError}`);
    }
  }

  // Start monitoring with interval
  startMonitoring(intervalHours: number = 6): void {
    console.log(`[SUBSCRIPTION_MONITOR] Starting monitoring with ${intervalHours} hour intervals`);
    
    // Check immediately on start
    this.checkSubscriptionPayments();
    
    // Set up recurring check
    setInterval(() => {
      this.checkSubscriptionPayments();
    }, intervalHours * 60 * 60 * 1000);
  }
}

// Export singleton instance
export const subscriptionMonitor = SubscriptionMonitor.getInstance();
