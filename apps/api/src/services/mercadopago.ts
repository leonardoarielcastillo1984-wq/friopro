// Servicio de integración con MercadoPago

import { FastifyInstance } from 'fastify';

export class MercadoPagoService {
  private accessToken: string;
  private webhookUrl: string;

  constructor(private app: FastifyInstance) {
    // Obtener credenciales de variables de entorno
    this.accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN || '';
    this.webhookUrl = `${process.env.API_BASE_URL}/webhooks/mercadopago`;
  }

  // Crear suscripción mensual
  async createMonthlySubscription(planId: string, tenantId: string, customerEmail: string) {
    try {
      const plan = await this.app.prisma.plan.findUnique({
        where: { id: planId }
      });

      if (!plan) {
        throw new Error('Plan not found');
      }

      // Crear cliente en MercadoPago
      const customer = await this.createCustomer(customerEmail, tenantId);

      // Crear plan de suscripción recurrente
      const subscriptionData = {
        reason: `SGI360 - Plan ${plan.name}`,
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: plan.monthlyPrice,
          currency_id: 'ARS',
          start_date: this.getStartDate(),
          end_date: this.getEndDate(plan.trialDays)
        },
        back_url: `${process.env.WEB_BASE_URL}/subscription/success`,
        payer_email: customerEmail,
        external_reference: `${tenantId}_${planId}_monthly`,
        metadata: {
          tenant_id: tenantId,
          plan_id: planId,
          billing_cycle: 'monthly'
        }
      };

      const response = await fetch('https://api.mercadopago.com/preapproval', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(subscriptionData)
      });

      const subscription = await response.json();

      if (!response.ok) {
        throw new Error(`MercadoPago API Error: ${subscription.message}`);
      }

      // Guardar referencia en base de datos
      await this.app.prisma.subscription.update({
        where: { tenantId },
        data: {
          mercadoPagoId: subscription.id,
          nextPaymentDue: new Date(subscription.auto_recurring.end_date)
        }
      });

      return {
        subscriptionId: subscription.id,
        initPoint: subscription.init_point,
        sandboxInitPoint: subscription.sandbox_init_point,
        plan: plan.name,
        amount: plan.monthlyPrice,
        currency: 'ARS'
      };
    } catch (error) {
      console.error('Error creating monthly subscription:', error);
      throw error;
    }
  }

  // Crear suscripción anual (10% descuento)
  async createAnnualSubscription(planId: string, tenantId: string, customerEmail: string) {
    try {
      const plan = await this.app.prisma.plan.findUnique({
        where: { id: planId }
      });

      if (!plan) {
        throw new Error('Plan not found');
      }

      const customer = await this.createCustomer(customerEmail, tenantId);

      // Crear plan anual (12 pagos mensuales con descuento)
      const subscriptionData = {
        reason: `SGI360 - Plan ${plan.name} (Anual)`,
        auto_recurring: {
          frequency: 12,
          frequency_type: 'months',
          transaction_amount: plan.annualPrice,
          currency_id: 'ARS',
          start_date: this.getStartDate(),
          end_date: this.getEndDate(plan.trialDays)
        },
        back_url: `${process.env.WEB_BASE_URL}/subscription/success`,
        payer_email: customerEmail,
        external_reference: `${tenantId}_${planId}_annual`,
        metadata: {
          tenant_id: tenantId,
          plan_id: planId,
          billing_cycle: 'annual'
        }
      };

      const response = await fetch('https://api.mercadopago.com/preapproval', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(subscriptionData)
      });

      const subscription = await response.json();

      if (!response.ok) {
        throw new Error(`MercadoPago API Error: ${subscription.message}`);
      }

      await this.app.prisma.subscription.update({
        where: { tenantId },
        data: {
          mercadoPagoId: subscription.id,
          nextPaymentDue: new Date(subscription.auto_recurring.end_date)
        }
      });

      return {
        subscriptionId: subscription.id,
        initPoint: subscription.init_point,
        sandboxInitPoint: subscription.sandbox_init_point,
        plan: plan.name,
        amount: plan.annualPrice,
        currency: 'ARS',
        billingCycle: 'annual'
      };
    } catch (error) {
      console.error('Error creating annual subscription:', error);
      throw error;
    }
  }

  // Crear pago único (setup fee)
  async createSetupPayment(tenantId: string, customerEmail: string, amount: number) {
    try {
      const preferenceData = {
        items: [{
          title: 'SGI360 - Configuración Inicial',
          description: 'Cargo único por configuración y onboarding',
          quantity: 1,
          currency_id: 'ARS',
          unit_price: amount
        }],
        payer: {
          email: customerEmail
        },
        back_urls: {
          success: `${process.env.WEB_BASE_URL}/subscription/setup-success`,
          failure: `${process.env.WEB_BASE_URL}/subscription/setup-failure`,
          pending: `${process.env.WEB_BASE_URL}/subscription/setup-pending`
        },
        auto_return: 'approved',
        external_reference: `${tenantId}_setup`,
        metadata: {
          tenant_id: tenantId,
          payment_type: 'setup'
        }
      };

      const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(preferenceData)
      });

      const preference = await response.json();

      if (!response.ok) {
        throw new Error(`MercadoPago API Error: ${preference.message}`);
      }

      return {
        preferenceId: preference.id,
        initPoint: preference.init_point,
        sandboxInitPoint: preference.sandbox_init_point,
        amount,
        currency: 'ARS'
      };
    } catch (error) {
      console.error('Error creating setup payment:', error);
      throw error;
    }
  }

  // Crear cliente en MercadoPago
  private async createCustomer(email: string, tenantId: string) {
    try {
      const customerData = {
        email: email,
        first_name: email.split('@')[0],
        last_name: 'SGI360 User',
        description: `Tenant: ${tenantId}`,
        identification: {
          type: 'CUIT',
          number: '00000000000' // Placeholder, debería obtenerse del onboarding
        }
      };

      const response = await fetch('https://api.mercadopago.com/v1/customers', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(customerData)
      });

      const customer = await response.json();

      if (!response.ok) {
        throw new Error(`MercadoPago API Error: ${customer.message}`);
      }

      return customer;
    } catch (error) {
      console.error('Error creating customer:', error);
      throw error;
    }
  }

  // Procesar webhook de MercadoPago
  async processWebhook(notification: any) {
    try {
      const { type, data } = notification;

      if (type === 'payment') {
        await this.handlePaymentNotification(data.id);
      } else if (type === 'preapproval') {
        await this.handleSubscriptionNotification(data.id);
      }

      return { received: true };
    } catch (error) {
      console.error('Error processing webhook:', error);
      throw error;
    }
  }

  // Manejar notificación de pago
  private async handlePaymentNotification(paymentId: string) {
    try {
      const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      });

      const payment = await response.json();

      if (!response.ok) {
        throw new Error(`MercadoPago API Error: ${payment.message}`);
      }

      if (payment.status !== 'approved') {
        console.log(`Payment ${paymentId} not approved: ${payment.status}`);
        return;
      }

      const externalReference = payment.external_reference;
      const parts = externalReference.split('_');
      const tenantId = parts[0];
      const planTier = parts[1];
      const period = parts[2];

      console.log(`[WEBHOOK] Payment approved for tenant ${tenantId}, plan ${planTier}, period ${period}`);

      const plan = await this.app.prisma.plan.findUnique({ where: { tier: planTier } });
      if (!plan) throw new Error(`Plan ${planTier} not found`);

      const now = new Date();
      const endsAt = new Date(now);
      if (period === 'annual') {
        endsAt.setFullYear(endsAt.getFullYear() + 1);
      } else {
        endsAt.setMonth(endsAt.getMonth() + 1);
      }

      const existing = await this.app.prisma.tenantSubscription.findFirst({
        where: { tenantId, deletedAt: null },
        orderBy: { startedAt: 'desc' }
      });

      if (existing) {
        await this.app.prisma.tenantSubscription.update({
          where: { id: existing.id },
          data: { planId: plan.id, status: 'ACTIVE', providerRef: null, startedAt: now, endsAt }
        });
      } else {
        await this.app.prisma.tenantSubscription.create({
          data: { tenantId, planId: plan.id, status: 'ACTIVE', providerRef: null, startedAt: now, endsAt }
        });
      }

      const updatedSub = await this.app.prisma.tenantSubscription.findFirst({
        where: { tenantId, deletedAt: null },
        orderBy: { startedAt: 'desc' }
      });

      if (updatedSub) {
        await this.app.prisma.payment.create({
          data: {
            tenantId,
            subscriptionId: updatedSub.id,
            planId: plan.id,
            amount: payment.transaction_amount,
            currency: payment.currency_id || 'ARS',
            status: 'COMPLETED',
            period: period === 'annual' ? 'annual' : 'monthly',
            planTier: planTier as any,
            paidAt: new Date(payment.date_approved),
            providerRef: String(paymentId),
            provider: 'mercadopago'
          }
        });
      }

      console.log(`✅ Payment ${paymentId} processed - tenant ${tenantId} activated with plan ${planTier}`);
    } catch (error) {
      console.error('Error handling payment notification:', error);
    }
  }

  // Manejar notificación de suscripción
  private async handleSubscriptionNotification(preapprovalId: string) {
    try {
      const response = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      });

      const subscription = await response.json();

      if (!response.ok) {
        throw new Error(`MercadoPago API Error: ${subscription.message}`);
      }

      const externalReference = subscription.external_reference;
      const [tenantId, planId, billingCycle] = externalReference.split('_');

      // Actualizar estado de suscripción
      await this.app.prisma.subscription.update({
        where: { tenantId },
        data: {
          status: this.mapSubscriptionStatus(subscription.status),
          nextBillingDate: new Date(subscription.auto_recurring.next_payment_date),
          mercadoPagoId: preapprovalId
        }
      });

      // Si la suscripción está aprobada, activar el plan
      if (subscription.status === 'authorized') {
        await this.activateSubscriptionPlan(tenantId, planId, billingCycle);
      }

      console.log(`✅ Subscription ${preapprovalId} processed for tenant ${tenantId}`);
    } catch (error) {
      console.error('Error handling subscription notification:', error);
    }
  }

  // Activar tenant después del setup
  private async activateTenantAfterSetup(tenantId: string) {
    try {
      await this.app.prisma.tenant.update({
        where: { id: tenantId },
        data: {
          status: 'TRIAL',
          isActive: true,
          trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 días
        }
      });

      console.log(`✅ Tenant ${tenantId} activated with trial period`);
    } catch (error) {
      console.error('Error activating tenant:', error);
    }
  }

  // Activar plan de suscripción
  private async activateSubscriptionPlan(tenantId: string, planId: string, billingCycle: string) {
    try {
      const plan = await this.app.prisma.plan.findUnique({
        where: { id: planId }
      });

      if (!plan) {
        throw new Error('Plan not found');
      }

      const price = billingCycle === 'annual' ? plan.annualPrice : plan.monthlyPrice;

      await this.app.prisma.subscription.update({
        where: { tenantId },
        data: {
          planId,
          status: 'ACTIVE',
          startDate: new Date(),
          nextBillingDate: new Date(Date.now() + (billingCycle === 'annual' ? 365 : 30) * 24 * 60 * 60 * 1000),
          billingCycle: billingCycle.toUpperCase() as any,
          basePrice: price,
          totalPrice: price,
          userLimit: plan.userLimit,
          storageLimit: plan.storageLimit
        }
      });

      await this.app.prisma.tenant.update({
        where: { id: tenantId },
        data: {
          status: 'ACTIVE',
          isActive: true
        }
      });

      console.log(`✅ Plan ${plan.name} activated for tenant ${tenantId}`);
    } catch (error) {
      console.error('Error activating subscription plan:', error);
    }
  }

  // Cancelar suscripción
  async cancelSubscription(tenantId: string) {
    try {
      const subscription = await this.app.prisma.subscription.findUnique({
        where: { tenantId }
      });

      if (!subscription || !subscription.mercadoPagoId) {
        throw new Error('Subscription not found or no MercadoPago ID');
      }

      const response = await fetch(`https://api.mercadopago.com/preapproval/${subscription.mercadoPagoId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: 'cancelled'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to cancel subscription in MercadoPago');
      }

      await this.app.prisma.subscription.update({
        where: { tenantId },
        data: {
          status: 'CANCELLED',
          endDate: new Date()
        }
      });

      return { cancelled: true };
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      throw error;
    }
  }

  // Helper functions
  private getStartDate(): string {
    return new Date().toISOString();
  }

  private getEndDate(trialDays: number): string {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + trialDays);
    return endDate.toISOString();
  }

  private mapPaymentStatus(status: string): string {
    const statusMap: Record<string, string> = {
      'pending': 'PENDING',
      'approved': 'APPROVED',
      'authorized': 'APPROVED',
      'in_process': 'PENDING',
      'rejected': 'REJECTED',
      'cancelled': 'CANCELLED',
      'refunded': 'REFUNDED',
      'charged_back': 'REFUNDED'
    };

    return statusMap[status] || 'PENDING';
  }

  private mapSubscriptionStatus(status: string): string {
    const statusMap: Record<string, string> = {
      'pending': 'PENDING',
      'authorized': 'ACTIVE',
      'paused': 'SUSPENDED',
      'cancelled': 'CANCELLED'
    };

    return statusMap[status] || 'PENDING';
  }

  // Obtener estado de suscripción
  async getSubscriptionStatus(tenantId: string) {
    try {
      const subscription = await this.app.prisma.subscription.findUnique({
        where: { tenantId },
        include: {
          plan: true,
          tenant: {
            select: {
              status: true,
              trialEndsAt: true
            }
          }
        }
      });

      if (!subscription) {
        return {
          status: 'NO_SUBSCRIPTION',
          plan: null,
          trialEndsAt: null,
          nextBillingDate: null
        };
      }

      return {
        status: subscription.status,
        plan: subscription.plan,
        trialEndsAt: subscription.tenant.trialEndsAt,
        nextBillingDate: subscription.nextBillingDate,
        userLimit: subscription.userLimit,
        currentUsers: subscription.currentUsers
      };
    } catch (error) {
      console.error('Error getting subscription status:', error);
      throw error;
    }
  }
}
