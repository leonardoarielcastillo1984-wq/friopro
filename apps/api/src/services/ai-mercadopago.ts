/**
 * AI MERCADOPAGO INTEGRATION
 * SGI360 Command Center - Gestión de pagos para suscripción IA
 * 
 * Integra MercadoPago para:
 * - Crear preferencias de pago
 * - Manejar suscripciones recurrentes
 * - Procesar webhooks
 * - Gestionar upgrades/downgrades
 * - Emitir facturas
 */

import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import crypto from 'crypto';

interface MercadoPagoConfig {
  accessToken: string;
  publicKey: string;
  clientId: string;
  clientSecret: string;
  baseUrl: string;
  webhookUrl: string;
}

interface AIPricingPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  billingCycle: 'monthly' | 'yearly';
  features: string[];
  limits: {
    premiumQueries: number;
    storage: number;
    users: number;
  };
}

interface PaymentPreference {
  id: string;
  initPoint: string;
  sandboxMode: boolean;
  items: Array<{
    id: string;
    title: string;
    description: string;
    quantity: number;
    unitPrice: number;
  }>;
  payer: {
    email: string;
    name: string;
    surname: string;
  };
  metadata: {
    tenantId: string;
    planId: string;
    billingCycle: string;
  };
}

export class AIMercadoPagoService {
  private prisma: PrismaClient;
  private config: MercadoPagoConfig;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.config = {
      accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || '',
      publicKey: process.env.MERCADOPAGO_PUBLIC_KEY || '',
      clientId: process.env.MERCADOPAGO_CLIENT_ID || '',
      clientSecret: process.env.MERCADOPAGO_CLIENT_SECRET || '',
      baseUrl: process.env.MERCADOPAGO_ENV === 'production' 
        ? 'https://api.mercadopago.com' 
        : 'https://api.mercadopago.com',
      webhookUrl: `${process.env.API_BASE_URL}/api/command-center/mercadopago/webhook`
    };
  }

  /**
   * Planes de precios IA
   */
  private readonly pricingPlans: AIPricingPlan[] = [
    {
      id: 'starter_ai_monthly',
      name: 'Starter IA',
      description: 'Perfecto para equipos pequeños que comienzan con IA',
      price: 15,
      currency: 'USD',
      billingCycle: 'monthly',
      features: [
        '30 consultas premium/mes con GPT-4.1',
        'Consultas ilimitadas con Groq',
        'Contexto completo del sistema',
        'Memoria conversacional',
        'Widgets de métricas configurables',
        'Soporte por email'
      ],
      limits: { premiumQueries: 30, storage: 5, users: 5 }
    },
    {
      id: 'business_ai_monthly',
      name: 'Business IA',
      description: 'Ideal para empresas en crecimiento',
      price: 49,
      currency: 'USD',
      billingCycle: 'monthly',
      features: [
        '150 consultas premium/mes con GPT-4.1',
        'Consultas ilimitadas con Groq',
        'Análisis avanzado y simulaciones',
        'Comandos de voz',
        'Alertas proactivas',
        'Búsqueda semántica',
        'Soporte prioritario'
      ],
      limits: { premiumQueries: 150, storage: 20, users: 20 }
    },
    {
      id: 'enterprise_ai_monthly',
      name: 'Enterprise IA',
      description: 'Solución completa para grandes organizaciones',
      price: 99,
      currency: 'USD',
      billingCycle: 'monthly',
      features: [
        'Consultas premium ilimitadas con GPT-4.1',
        'Todos los modelos IA disponibles',
        'SLA 99.9%',
        'Onboarding dedicado',
        'Personalización avanzada',
        'Integraciones custom',
        'Soporte 24/7'
      ],
      limits: { premiumQueries: -1, storage: 100, users: -1 }
    },
    {
      id: 'starter_ai_yearly',
      name: 'Starter IA - Anual',
      description: 'Ahorrá 20% con pago anual',
      price: 144,
      currency: 'USD',
      billingCycle: 'yearly',
      features: [
        '30 consultas premium/mes con GPT-4.1',
        'Consultas ilimitadas con Groq',
        'Contexto completo del sistema',
        'Memoria conversacional',
        'Widgets de métricas configurables',
        'Soporte por email',
        '2 meses gratis'
      ],
      limits: { premiumQueries: 30, storage: 5, users: 5 }
    },
    {
      id: 'business_ai_yearly',
      name: 'Business IA - Anual',
      description: 'Ahorrá 20% con pago anual',
      price: 470,
      currency: 'USD',
      billingCycle: 'yearly',
      features: [
        '150 consultas premium/mes con GPT-4.1',
        'Consultas ilimitadas con Groq',
        'Análisis avanzado y simulaciones',
        'Comandos de voz',
        'Alertas proactivas',
        'Búsqueda semántica',
        'Soporte prioritario',
        '2 meses gratis'
      ],
      limits: { premiumQueries: 150, storage: 20, users: 20 }
    },
    {
      id: 'enterprise_ai_yearly',
      name: 'Enterprise IA - Anual',
      description: 'Ahorrá 20% con pago anual',
      price: 950,
      currency: 'USD',
      billingCycle: 'yearly',
      features: [
        'Consultas premium ilimitadas con GPT-4.1',
        'Todos los modelos IA disponibles',
        'SLA 99.9%',
        'Onboarding dedicado',
        'Personalización avanzada',
        'Integraciones custom',
        'Soporte 24/7',
        '2 meses gratis'
      ],
      limits: { premiumQueries: -1, storage: 100, users: -1 }
    },
    {
      id: 'pack_20_queries',
      name: 'Pack 20 Consultas',
      description: 'Consultas premium adicionales sin suscripción',
      price: 10,
      currency: 'USD',
      billingCycle: 'monthly',
      features: [
        '20 consultas premium con GPT-4.1',
        'Sin vencimiento',
        'Se acumulan con tu plan'
      ],
      limits: { premiumQueries: 20, storage: 0, users: 0 }
    }
  ];

  /**
   * Obtiene todos los planes disponibles
   */
  getAvailablePlans(): AIPricingPlan[] {
    return this.pricingPlans;
  }

  /**
   * Obtiene plan por ID
   */
  getPlanById(planId: string): AIPricingPlan | null {
    return this.pricingPlans.find(plan => plan.id === planId) || null;
  }

  /**
   * Crea preferencia de pago para suscripción IA
   */
  async createPaymentPreference(
    tenantId: string,
    planId: string,
    userEmail: string,
    userName: string
  ): Promise<PaymentPreference> {
    try {
      const plan = this.getPlanById(planId);
      if (!plan) {
        throw new Error('Plan no encontrado');
      }

      // Obtener información del tenant
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        include: { companySettings: true }
      });

      if (!tenant) {
        throw new Error('Tenant no encontrado');
      }

      const preferenceData = {
        items: [{
          id: plan.id,
          title: plan.name,
          description: plan.description,
          quantity: 1,
          unit_price: Math.round(plan.price * 100), // MercadoPago usa centavos
          currency_id: plan.currency
        }],
        payer: {
          email: userEmail,
          name: userName.split(' ')[0],
          surname: userName.split(' ').slice(1).join(' ')
        },
        back_urls: {
          success: `${process.env.WEB_BASE_URL}/command-center/success`,
          failure: `${process.env.WEB_BASE_URL}/command-center/failure`,
          pending: `${process.env.WEB_BASE_URL}/command-center/pending`
        },
        auto_return: 'approved',
        notification_url: this.config.webhookUrl,
        metadata: {
          tenantId,
          planId,
          billingCycle: plan.billingCycle,
          type: 'ai_subscription'
        },
        external_reference: `ai_sub_${tenantId}_${Date.now()}`
      };

      const response = await axios.post(
        `${this.config.baseUrl}/checkout/preferences`,
        preferenceData,
        {
          headers: {
            'Authorization': `Bearer ${this.config.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // Guardar preferencia en BD
      await this.prisma.tenantAISubscription.upsert({
        where: { tenantId },
        update: {
          mercadopagoPreferenceId: response.data.id,
          updatedAt: new Date()
        },
        create: {
          tenantId,
          plan: this.mapPlanToSubscriptionPlan(planId),
          status: 'PENDING',
          mercadopagoPreferenceId: response.data.id,
          premiumQueriesLimit: plan.limits.premiumQueries
        }
      });

      return {
        id: response.data.id,
        initPoint: response.data.init_point,
        sandboxMode: this.config.baseUrl.includes('sandbox'),
        items: preferenceData.items,
        payer: preferenceData.payer,
        metadata: preferenceData.metadata
      };

    } catch (error: any) {
      console.error('[MercadoPago] Error creating payment preference:', error);
      throw new Error('Error al crear preferencia de pago');
    }
  }

  /**
   * Procesa webhook de MercadoPago
   */
  async processWebhook(notification: any): Promise<void> {
    try {
      const { type, data } = notification;

      if (type === 'payment') {
        await this.handlePaymentNotification(data.id);
      } else if (type === 'preapproval') {
        await this.handlePreapprovalNotification(data.id);
      }

    } catch (error: any) {
      console.error('[MercadoPago] Error processing webhook:', error);
      throw error;
    }
  }

  /**
   * Maneja notificación de pago
   */
  private async handlePaymentNotification(paymentId: string): Promise<void> {
    try {
      // Obtener información del pago
      const paymentResponse = await axios.get(
        `${this.config.baseUrl}/v1/payments/${paymentId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.config.accessToken}`
          }
        }
      );

      const payment = paymentResponse.data;
      const metadata = payment.metadata;

      if (!metadata?.tenantId || !metadata?.planId) {
        console.error('[MercadoPago] Invalid payment metadata');
        return;
      }

      // Actualizar suscripción según estado del pago
      if (payment.status === 'approved') {
        await this.activateSubscription(
          metadata.tenantId,
          metadata.planId,
          paymentId,
          payment
        );
      } else if (payment.status === 'rejected' || payment.status === 'cancelled') {
        await this.handlePaymentFailure(metadata.tenantId, payment);
      }

    } catch (error: any) {
      console.error('[MercadoPago] Error handling payment notification:', error);
    }
  }

  /**
   * Maneja notificación de suscripción recurrente
   */
  private async handlePreapprovalNotification(preapprovalId: string): Promise<void> {
    try {
      const preapprovalResponse = await axios.get(
        `${this.config.baseUrl}/preapproval/${preapprovalId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.config.accessToken}`
          }
        }
      );

      const preapproval = preapprovalResponse.data;
      const metadata = preapproval.metadata;

      if (!metadata?.tenantId) {
        console.error('[MercadoPago] Invalid preapproval metadata');
        return;
      }

      // Actualizar estado de suscripción recurrente
      if (preapproval.status === 'authorized') {
        await this.updateRecurringSubscription(
          metadata.tenantId,
          preapprovalId,
          preapproval
        );
      } else if (preapproval.status === 'cancelled') {
        await this.cancelSubscription(metadata.tenantId);
      }

    } catch (error: any) {
      console.error('[MercadoPago] Error handling preapproval notification:', error);
    }
  }

  /**
   * Activa suscripción después del pago
   */
  private async activateSubscription(
    tenantId: string,
    planId: string,
    paymentId: string,
    paymentData: any
  ): Promise<void> {
    try {
      const plan = this.getPlanById(planId);
      if (!plan) {
        throw new Error('Plan no encontrado');
      }

      const subscriptionPlan = this.mapPlanToSubscriptionPlan(planId);
      
      // Calcular próxima fecha de facturación
      const nextBillingDate = new Date();
      if (plan.billingCycle === 'monthly') {
        nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
      } else {
        nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
      }

      await this.prisma.tenantAISubscription.upsert({
        where: { tenantId },
        update: {
          plan: subscriptionPlan,
          status: 'ACTIVE',
          mercadopagoSubscriptionId: paymentId,
          nextBillingDate,
          monthlyAmount: plan.price,
          premiumQueriesLimit: plan.limits.premiumQueries,
          premiumQueriesUsed: 0,
          openaiEnabled: true,
          updatedAt: new Date()
        },
        create: {
          tenantId,
          plan: subscriptionPlan,
          status: 'ACTIVE',
          mercadopagoSubscriptionId: paymentId,
          nextBillingDate,
          monthlyAmount: plan.price,
          premiumQueriesLimit: plan.limits.premiumQueries,
          openaiEnabled: true
        }
      });

      // Enviar notificación de activación
      await this.sendSubscriptionNotification(tenantId, 'activated', plan);

      console.log(`[MercadoPago] Subscription activated for tenant ${tenantId}`);

    } catch (error: any) {
      console.error('[MercadoPago] Error activating subscription:', error);
    }
  }

  /**
   * Maneja fallo de pago
   */
  private async handlePaymentFailure(tenantId: string, paymentData: any): Promise<void> {
    try {
      await this.prisma.tenantAISubscription.update({
        where: { tenantId },
        data: {
          status: 'PAYMENT_FAILED',
          updatedAt: new Date()
        }
      });

      // Enviar notificación de fallo
      await this.sendSubscriptionNotification(tenantId, 'payment_failed', null);

    } catch (error: any) {
      console.error('[MercadoPago] Error handling payment failure:', error);
    }
  }

  /**
   * Cancela suscripción
   */
  async cancelSubscription(tenantId: string): Promise<void> {
    try {
      await this.prisma.tenantAISubscription.update({
        where: { tenantId },
        data: {
          status: 'CANCELLED',
          openaiEnabled: false,
          cancelledAt: new Date(),
          updatedAt: new Date()
        }
      });

      // Enviar notificación de cancelación
      await this.sendSubscriptionNotification(tenantId, 'cancelled', null);

    } catch (error: any) {
      console.error('[MercadoPago] Error cancelling subscription:', error);
      throw error;
    }
  }

  /**
   * Crea suscripción recurrente
   */
  async createRecurringSubscription(
    tenantId: string,
    planId: string,
    userEmail: string,
    userName: string
  ): Promise<any> {
    try {
      const plan = this.getPlanById(planId);
      if (!plan) {
        throw new Error('Plan no encontrado');
      }

      const preapprovalData = {
        reason: plan.name,
        auto_recurring: {
          frequency: plan.billingCycle === 'monthly' ? 1 : 12,
          frequency_type: plan.billingCycle === 'monthly' ? 'months' : 'years',
          transaction_amount: plan.price,
          currency_id: plan.currency
        },
        back_url: `${process.env.WEB_BASE_URL}/command-center/subscription`,
        payer_email: userEmail,
        metadata: {
          tenantId,
          planId,
          type: 'ai_subscription_recurring'
        }
      };

      const response = await axios.post(
        `${this.config.baseUrl}/preapproval`,
        preapprovalData,
        {
          headers: {
            'Authorization': `Bearer ${this.config.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        id: response.data.id,
        initPoint: response.data.init_point,
        sandboxMode: this.config.baseUrl.includes('sandbox')
      };

    } catch (error: any) {
      console.error('[MercadoPago] Error creating recurring subscription:', error);
      throw new Error('Error al crear suscripción recurrente');
    }
  }

  /**
   * Verifica firma del webhook
   */
  verifyWebhookSignature(
    body: string,
    signature: string,
    secret: string = this.config.clientSecret
  ): boolean {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(body)
        .digest('hex');

      return signature === expectedSignature;
    } catch (error) {
      console.error('[MercadoPago] Error verifying webhook signature:', error);
      return false;
    }
  }

  /**
   * Obtiene estado de suscripción
   */
  async getSubscriptionStatus(tenantId: string): Promise<any> {
    try {
      const subscription = await this.prisma.tenantAISubscription.findUnique({
        where: { tenantId }
      });

      if (!subscription) {
        return {
          status: 'none',
          plan: null,
          active: false
        };
      }

      return {
        status: subscription.status.toLowerCase(),
        plan: subscription.plan,
        active: subscription.status === 'ACTIVE',
        nextBillingDate: subscription.nextBillingDate,
        monthlyAmount: subscription.monthlyAmount,
        premiumQueriesLimit: subscription.premiumQueriesLimit,
        premiumQueriesUsed: subscription.premiumQueriesUsed,
        premiumQueriesRemaining: subscription.premiumQueriesRemaining
      };

    } catch (error: any) {
      console.error('[MercadoPago] Error getting subscription status:', error);
      return {
        status: 'error',
        plan: null,
        active: false
      };
    }
  }

  /**
   * Envía notificación de suscripción
   */
  private async sendSubscriptionNotification(
    tenantId: string,
    type: 'activated' | 'payment_failed' | 'cancelled',
    plan: AIPricingPlan | null
  ): Promise<void> {
    try {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        include: { companySettings: true }
      });

      if (!tenant) return;

      let title: string;
      let message: string;

      switch (type) {
        case 'activated':
          title = '✅ Suscripción IA Activada';
          message = plan 
            ? `Tu suscripción ${plan.name} ha sido activada. Ya puedes disfrutar de todas las funciones premium.`
            : 'Tu suscripción IA ha sido activada.';
          break;
        case 'payment_failed':
          title = '⚠️ Fallo en Pago';
          message = 'Hubo un problema con tu pago. Por favor actualiza tu información de pago.';
          break;
        case 'cancelled':
          title = '📋 Suscripción Cancelada';
          message = 'Tu suscripción IA ha sido cancelada. Puedes reactivarla en cualquier momento.';
          break;
      }

      // Crear notificación en el sistema
      await this.prisma.notification.create({
        data: {
          tenantId,
          type: 'SYSTEM_ALERT',
          title,
          message,
          metadata: { type, planName: plan?.name },
          isRead: false
        }
      });

    } catch (error: any) {
      console.error('[MercadoPago] Error sending subscription notification:', error);
    }
  }

  /**
   * Mapea ID de plan a enum de suscripción
   */
  private mapPlanToSubscriptionPlan(planId: string): string {
    if (planId.includes('starter')) return 'STARTER_AI';
    if (planId.includes('business')) return 'BUSINESS_AI';
    if (planId.includes('enterprise')) return 'ENTERPRISE_AI';
    return 'STARTER_AI';
  }

  /**
   * Genera link de pago rápido
   */
  async generateQuickPaymentLink(
    tenantId: string,
    planId: string,
    userEmail: string,
    userName: string
  ): Promise<string> {
    try {
      const preference = await this.createPaymentPreference(
        tenantId,
        planId,
        userEmail,
        userName
      );

      return preference.initPoint;
    } catch (error: any) {
      console.error('[MercadoPago] Error generating quick payment link:', error);
      throw error;
    }
  }

  /**
   * Obtiene métricas de facturación
   */
  async getBillingMetrics(tenantId: string): Promise<any> {
    try {
      const subscription = await this.prisma.tenantAISubscription.findUnique({
        where: { tenantId }
      });

      if (!subscription) {
        return { active: false };
      }

      // Calcular métricas
      const daysUntilBilling = subscription.nextBillingDate 
        ? Math.ceil((subscription.nextBillingDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : 0;

      const usagePercentage = subscription.premiumQueriesLimit > 0
        ? (subscription.premiumQueriesUsed / subscription.premiumQueriesLimit) * 100
        : 0;

      return {
        active: subscription.status === 'ACTIVE',
        plan: subscription.plan,
        monthlyAmount: subscription.monthlyAmount,
        nextBillingDate: subscription.nextBillingDate,
        daysUntilBilling,
        usage: {
          queries: {
            used: subscription.premiumQueriesUsed,
            limit: subscription.premiumQueriesLimit,
            remaining: subscription.premiumQueriesRemaining,
            percentage: Math.round(usagePercentage)
          }
        }
      };

    } catch (error: any) {
      console.error('[MercadoPago] Error getting billing metrics:', error);
      return { active: false };
    }
  }
}

export default AIMercadoPagoService;
