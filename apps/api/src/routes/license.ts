import { isSuperAdmin, getEffectiveTenantId } from '../utils/tenant-bypass.js';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { MercadoPagoService } from '../services/mercadopago.js';
import { sendEmail, paymentConfirmationEmail } from '../services/email.js';

// Extender FastifyInstance para incluir prisma
declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

// ============================================
// SISTEMA DE LICENCIAS SGI 360
// ============================================

// Precios de los planes (USD)
const PLAN_PRICES = {
  monthly: {
    BASIC: 35,
    PROFESSIONAL: 69,
    PREMIUM: 99
  },
  annual: {
    BASIC: 399,        // 35 * 12 * 0.95
    PROFESSIONAL: 786, // 69 * 12 * 0.95
    PREMIUM: 1128      // 99 * 12 * 0.95
  }
};

// Billing por producto: el producto standalone flota360 tiene su propio
// pricing (promo $99 los primeros N meses, luego $299) y sus propias URLs
// públicas (basePath /flota360, API /flota360-api). SGI360 queda igual.
const APP_PRODUCT = process.env.PRODUCT || 'sgi360';
const IS_FLOTA_PRODUCT = APP_PRODUCT === 'flota360';
const PRODUCT_BILLING = IS_FLOTA_PRODUCT ? {
  productName: 'Flota 360',
  descriptor: 'FLOTA360',
  basePath: '/flota360',
  apiBase: '/flota360-api',
  successPath: '/planes',
  prices: {
    monthly: { BASIC: 0, PROFESSIONAL: 0, PREMIUM: Number(process.env.MONTHLY_PRICE || 299) },
    annual: { BASIC: 0, PROFESSIONAL: 0, PREMIUM: Number(process.env.ANNUAL_PRICE || Math.round(299 * 12 * 0.95)) },
  },
  promo: { price: Number(process.env.PROMO_PRICE || 99), months: Number(process.env.PROMO_MONTHS || 3) },
} : {
  productName: 'SGI 360',
  descriptor: 'SGI360',
  basePath: '',
  apiBase: '/api',
  successPath: '/configuracion?tab=licencia',
  prices: PLAN_PRICES,
  promo: null,
};

// Precio efectivo del período para un tier, aplicando promo por producto.
// La promo mensual aplica a los primeros `promo.months` pagos mensuales del tenant.
async function resolvePrice(app: FastifyInstance, tenantId: string, tier: string, period: 'monthly' | 'annual') {
  const prices = PRODUCT_BILLING.prices as any;
  let amount = prices[period]?.[tier];
  let isPromo = false;
  if (period === 'monthly' && PRODUCT_BILLING.promo) {
    const paidMonthly = await app.prisma.payment.count({
      where: { tenantId, status: 'COMPLETED' as any, period: 'monthly' },
    });
    if (paidMonthly < PRODUCT_BILLING.promo.months) {
      amount = PRODUCT_BILLING.promo.price;
      isPromo = true;
    }
  }
  return { amount, isPromo };
}

// Límites por plan
const PLAN_LIMITS = {
  BASIC: {
    maxUsers: 5,
    modules: ['dashboard', 'documents', 'ncr', 'indicators', 'risks', 'commandCenter'],
    features: ['basic_reports', 'email_notifications']
  },
  PROFESSIONAL: {
    maxUsers: 15,
    modules: ['dashboard', 'documents', 'ncr', 'indicators', 'risks', 'audits', 'trainings', 'maintenance', 'project360', 'simulacros', 'commandCenter'],
    features: ['basic_reports', 'email_notifications', 'advanced_analytics', 'api_access']
  },
  PREMIUM: {
    maxUsers: 50,
    modules: ['*'], // Todos los módulos
    features: ['*'] // Todas las funcionalidades
  }
};

// Configuración de módulos disponibles (16 módulos - TODOS disponibles en todos los planes)
// El usuario controla la habilitación/deshabilitación desde otra sección
// Fase 5: Seguridad 360 y Audit360 marcados como "Próximamente"
const MODULE_CONFIG = {
  documents: { name: 'Documentos', minPlan: 'BASIC', icon: 'FileText' },
  ncr: { name: 'No Conformidades', minPlan: 'BASIC', icon: 'Bug' },
  indicators: { name: 'Indicadores', minPlan: 'BASIC', icon: 'BarChart3' },
  risks: { name: 'Riesgos', minPlan: 'BASIC', icon: 'AlertTriangle' },
  audits: { name: 'Auditorías ISO', minPlan: 'BASIC', icon: 'ClipboardCheck' },
  trainings: { name: 'Capacitaciones', minPlan: 'BASIC', icon: 'BookOpen' },
  maintenance: { name: 'Mantenimiento', minPlan: 'BASIC', icon: 'Settings' },
  project360: { name: 'PROJECT360', minPlan: 'BASIC', icon: 'Target' },
  simulacros: { name: 'Simulacros', minPlan: 'BASIC', icon: 'Flame' },
  normativos: { name: 'Normativos', minPlan: 'BASIC', icon: 'Shield' },
  clientes: { name: 'Clientes', minPlan: 'BASIC', icon: 'Users' },
  audit_ia: { name: 'Auditoría IA', minPlan: 'BASIC', icon: 'Brain' },
  rrhh: { name: 'RRHH', minPlan: 'BASIC', icon: 'UserCircle' },
  reportes: { name: 'Reportes', minPlan: 'BASIC', icon: 'BarChart2' },
  seguridad360: { name: 'Seguridad 360', minPlan: 'PROFESSIONAL', icon: 'Shield', comingSoon: true },
  audit360: { name: 'Audit360', minPlan: 'PROFESSIONAL', icon: 'ClipboardList', comingSoon: true },
  commandCenter: { name: 'Command Center', minPlan: 'PROFESSIONAL', icon: 'Brain', description: 'IA Ejecutiva Premium', isAddOn: true }
};

// Schemas de validación
const setupPaymentSchema = z.object({
  provider: z.enum(['stripe', 'paypal', 'manual']).default('manual'),
  providerRef: z.string().optional()
});

const createSubscriptionSchema = z.object({
  planTier: z.enum(['BASIC', 'PROFESSIONAL', 'PREMIUM']),
  period: z.enum(['monthly', 'annual']).default('monthly'),
  provider: z.enum(['stripe', 'paypal', 'manual']).default('manual'),
  providerRef: z.string().optional()
});

const recordPaymentSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().default('USD'),
  period: z.enum(['monthly', 'annual']),
  planTier: z.enum(['BASIC', 'PROFESSIONAL', 'PREMIUM']),
  provider: z.enum(['stripe', 'paypal', 'manual']).default('manual'),
  providerRef: z.string().optional()
});

const trackAccessAttemptSchema = z.object({
  module: z.string(),
  path: z.string()
});

export async function licenseRoutes(app: FastifyInstance) {

  // DIAGNOSTIC ENDPOINT
  app.get('/test', async (req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ message: 'License routes are registered correctly', timestamp: new Date() });
  });

  app.post('/test-checkout', async (req: FastifyRequest, reply: FastifyReply) => {
    console.log('[TEST] Checkout POST received');
    return reply.send({ message: 'TEST CHECKOUT ENDPOINT WORKS', timestamp: new Date() });
  });

  // ============================================
  // SETUP INICIAL (USD 200)
  // ============================================

  // Obtener estado del setup
  app.get('/setup', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

      const setup = await app.prisma.tenantSetup.findUnique({
        where: { tenantId }
      });

      if (!setup) {
        return reply.code(200).send({
          status: 'PENDING',
          amount: 200.00,
          currency: 'USD',
          required: true,
          message: 'Para comenzar a utilizar SGI 360, debés completar la implementación inicial'
        });
      }

      return reply.code(200).send({
        status: setup.status,
        amount: setup.amount,
        currency: setup.currency,
        paidAt: setup.paidAt,
        required: setup.status !== 'PAID',
        message: setup.status === 'PAID' 
          ? 'Setup completado'
          : 'Para comenzar a utilizar SGI 360, debés completar la implementación inicial'
      });
    } catch (error: any) {
      app.log.error(error);
      return reply.code(500).send({ error: 'Failed to get setup status' });
    }
  });

  // Marcar setup como pagado (para pagos manuales o webhooks)
  app.post('/setup/pay', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

      const body = setupPaymentSchema.parse(req.body);

      const setup = await app.prisma.tenantSetup.upsert({
        where: { tenantId },
        update: {
          status: 'PAID',
          paidAt: new Date(),
          provider: body.provider,
          providerRef: body.providerRef
        },
        create: {
          tenantId,
          amount: 200.00,
          currency: 'USD',
          status: 'PAID',
          paidAt: new Date(),
          provider: body.provider,
          providerRef: body.providerRef
        }
      });

      // Crear notificación
      await app.prisma.licenseNotification.create({
        data: {
          tenantId,
          type: 'SETUP_REQUIRED',
          title: 'Setup completado',
          message: 'Tu implementación inicial ha sido activada exitosamente.',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }
      });

      return reply.code(200).send({
        success: true,
        setup,
        message: 'Setup completado exitosamente'
      });
    } catch (error: any) {
      app.log.error(error);
      return reply.code(500).send({ error: 'Failed to process setup payment' });
    }
  });

  // ============================================
  // PLANES Y PRECIOS
  // ============================================

  // Obtener planes disponibles (CON features de la BD)
  app.get('/plans', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      // Obtener planes de la base de datos (con features configurados por admin)
      const plansFromDB = await app.prisma.plan.findMany({
        where: { isActive: true },
        orderBy: { tier: 'asc' }
      });

      // Promo por producto (flota360): calcula si el tenant aún puede pagar precio promo
      let promoMonthsLeft = 0;
      if (PRODUCT_BILLING.promo) {
        const tenantId = await getEffectiveTenantId(req, app.prisma).catch(() => null);
        if (tenantId) {
          const paidMonthly = await app.prisma.payment.count({
            where: { tenantId, status: 'COMPLETED' as any, period: 'monthly' },
          });
          promoMonthsLeft = Math.max(0, PRODUCT_BILLING.promo.months - paidMonthly);
        }
      }

      const planDescriptions = IS_FLOTA_PRODUCT ? {
        BASIC: 'Gestión esencial de flota',
        PROFESSIONAL: 'Gestión completa de flota y mantenimiento',
        PREMIUM: 'Flota completa con IA predictiva y todos los módulos',
      } : {
        BASIC: 'Ideal para pequeñas empresas comenzando con ISO',
        PROFESSIONAL: 'Para empresas que necesitan gestión completa ISO',
        PREMIUM: 'Máximo poder con IA y análisis predictivo'
      };

      const plans = plansFromDB.map((plan) => {
        // Obtener nombre de módulos habilitados desde features BD
        const enabledFeatures = Object.entries(plan.features as Record<string, any>)
          .filter(([_, enabled]: [string, any]) => enabled === true)
          .map(([featureKey]: [string, any]) => {
            // Mapear keys a nombres legibles
            const featureNames: Record<string, string> = {
              'auditorias_iso': 'Auditorías ISO',
              'documentos': 'Documentos',
              'normativos': 'Normativos',
              'no_conformidades': 'No Conformidades',
              'project360': 'PROJECT360',
              'mantenimiento': 'Mantenimiento',
              'simulacros': 'Simulacros',
              'audit_ia': 'Auditoría IA',
              'riesgos': 'Riesgos',
              'indicadores': 'Indicadores',
              'capacitaciones': 'Capacitaciones',
              'rrhh': 'RRHH',
              'clientes': 'Clientes',
              'reportes': 'Reportes',
              'encuestas': 'Encuestas'
            };
            return featureNames[featureKey] || featureKey;
          })
          .sort();

        // Obtener nombre de módulos deshabilitados
        const disabledFeatures = Object.entries(plan.features as Record<string, any>)
          .filter(([_, enabled]: [string, any]) => enabled === false)
          .map(([featureKey]: [string, any]) => {
            const featureNames: Record<string, string> = {
              'auditorias_iso': 'Auditorías ISO',
              'documentos': 'Documentos',
              'normativos': 'Normativos',
              'no_conformidades': 'No Conformidades',
              'project360': 'PROJECT360',
              'mantenimiento': 'Mantenimiento',
              'simulacros': 'Simulacros',
              'audit_ia': 'Auditoría IA',
              'riesgos': 'Riesgos',
              'indicadores': 'Indicadores',
              'capacitaciones': 'Capacitaciones',
              'rrhh': 'RRHH',
              'clientes': 'Clientes',
              'reportes': 'Reportes',
              'encuestas': 'Encuestas'
            };
            return featureNames[featureKey] || featureKey;
          })
          .sort();

        // Precios por producto (flota360 tiene promo de lanzamiento)
        const prices = PRODUCT_BILLING.prices as any;
        const regularMonthly = prices.monthly[plan.tier] ?? 0;
        const annualPrice = prices.annual[plan.tier] ?? 0;
        const promoActive = PRODUCT_BILLING.promo && promoMonthsLeft > 0 && periodSafe(plan.tier);
        function periodSafe(tier: string) { return tier === 'PREMIUM'; }
        const monthlyPrice = promoActive ? PRODUCT_BILLING.promo!.price : regularMonthly;
        const savings = regularMonthly > 0 ? Math.round((1 - annualPrice / (regularMonthly * 12)) * 100) : 0;

        return {
          tier: plan.tier,
          name: IS_FLOTA_PRODUCT && plan.tier === 'PREMIUM' ? 'Flota 360 — Plan Completo' : plan.name,
          description: planDescriptions[plan.tier as keyof typeof planDescriptions],
          prices: {
            monthly: monthlyPrice,
            annual: annualPrice,
            regularMonthly,
            savings: savings
          },
          promo: promoActive ? { price: PRODUCT_BILLING.promo!.price, monthsLeft: promoMonthsLeft, regularPrice: regularMonthly } : null,
          limits: plan.limits,
          features: [
            `Hasta ${(plan.limits as any)?.['users'] || (plan.tier === 'BASIC' ? 5 : plan.tier === 'PROFESSIONAL' ? 20 : 50)} usuarios`,
            ...enabledFeatures
          ],
          notIncluded: disabledFeatures
        };
      });

      return reply.code(200).send({ plans });
    } catch (error: any) {
      app.log.error(error);
      return reply.code(500).send({ error: 'Failed to get plans' });
    }
  });

  // Obtener configuración de módulos
  app.get('/modules', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      return reply.code(200).send({ modules: MODULE_CONFIG });
    } catch (error: any) {
      app.log.error({ error }, 'Error getting module access');
      return reply.code(500).send({ error: 'Failed to get modules' });
    }
  });

  // ============================================
  // SUSCRIPCIONES
  // ============================================

  // Obtener suscripción actual
  app.get('/subscription', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

      const subscription = await app.prisma.tenantSubscription.findFirst({
        where: { tenantId },
        include: { plan: true },
        orderBy: { createdAt: 'desc' }
      });

      // Also fetch tenant license data (new system)
      const tenant = await (app.prisma as any).tenant.findUnique({
        where: { id: tenantId },
        select: {
          licensePlan: true,
          licenseStartAt: true,
          licenseEndAt: true,
          licenseStatus: true,
          graceEndAt: true,
          isDemo: true,
          demoExpiresAt: true,
        },
      });

      // No subscription or inactive/canceled
      if (!subscription || subscription.status === 'CANCELED' || subscription.providerRef === 'NO_PLAN') {
        return reply.code(200).send({
          hasSubscription: false,
          status: tenant?.licenseStatus || subscription?.status === 'CANCELED' ? 'CANCELED' : 'TRIAL',
          message: 'No active subscription',
          daysRemaining: 0,
          licenseStatus: tenant?.licenseStatus || 'ACTIVE',
          licenseEndAt: tenant?.licenseEndAt,
          licensePlan: tenant?.licensePlan,
        });
      }

      // Calcular días restantes y estado de gracia.
      // Fuente autoritativa: tenant.licenseEndAt (sistema de licencias nuevo, el mismo que usa el bloqueo real).
      // Fallback: subscription.endsAt (sistema legacy) para tenants sin licenseEndAt.
      const now = new Date();
      const authoritativeEnd = tenant?.licenseEndAt
        ? new Date(tenant.licenseEndAt)
        : (subscription.endsAt ? new Date(subscription.endsAt) : null);
      const gracePeriodDays = 7;

      let daysRemaining = 0;
      let graceDaysRemaining = 0;
      let isInGracePeriod = false;

      if (authoritativeEnd) {
        const diffTime = authoritativeEnd.getTime() - now.getTime();
        daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (daysRemaining < 0) {
          isInGracePeriod = Math.abs(daysRemaining) <= gracePeriodDays;
          graceDaysRemaining = isInGracePeriod ? gracePeriodDays - Math.abs(daysRemaining) : 0;
        }
      }

      return reply.code(200).send({
        hasSubscription: true,
        id: subscription.id,
        planTier: subscription.providerRef === 'NO_PLAN' ? 'NO_PLAN' : (subscription.plan?.tier || subscription.status),
        status: subscription.status,
        startedAt: subscription.startedAt,
        endsAt: tenant?.licenseEndAt ?? subscription.endsAt,
        daysRemaining: Math.max(0, daysRemaining),
        isInGracePeriod,
        graceDaysRemaining,
        isExpired: daysRemaining < 0 && !isInGracePeriod,
        provider: subscription.provider,
        licenseStatus: tenant?.licenseStatus,
        licenseEndAt: tenant?.licenseEndAt,
        licensePlan: tenant?.licensePlan,
      });
    } catch (error: any) {
      app.log.error({ error }, 'message');
      return reply.code(500).send({ error: 'Failed to get subscription' });
    }
  });

  // Crear nueva suscripción
  app.post('/subscription', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

      const body = createSubscriptionSchema.parse(req.body);

      // Buscar o crear el plan
      let plan = await app.prisma.plan.findUnique({
        where: { tier: body.planTier }
      });

      if (!plan) {
        plan = await app.prisma.plan.create({
          data: {
            tier: body.planTier,
            name: body.planTier.charAt(0) + body.planTier.slice(1).toLowerCase(),
            features: PLAN_LIMITS[body.planTier],
            limits: { maxUsers: PLAN_LIMITS[body.planTier].maxUsers }
          }
        });
      }

      // Calcular fechas
      const now = new Date();
      const endsAt = body.period === 'monthly' 
        ? new Date(now.getFullYear(), now.getMonth() + 1, now.getDate())
        : new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());

      // Desactivar suscripciones anteriores
      await app.prisma.tenantSubscription.updateMany({
        where: { tenantId },
        data: { status: 'CANCELED' }
      });

      // Crear nueva suscripción
      const subscription = await app.prisma.tenantSubscription.create({
        data: {
          tenantId,
          planId: plan.id,
          status: 'ACTIVE',
          startedAt: now,
          endsAt,
          provider: body.provider,
          providerRef: body.providerRef
        }
      });

      // Crear notificación
      await app.prisma.licenseNotification.create({
        data: {
          tenantId,
          type: 'PAYMENT_SUCCESS',
          title: 'Suscripción activada',
          message: `Tu plan ${body.planTier} ha sido activado exitosamente.`,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }
      });

      return reply.code(201).send({
        success: true,
        subscription,
        message: 'Subscription created successfully'
      });
    } catch (error: any) {
      app.log.error({ error }, 'message');
      return reply.code(500).send({ error: 'Failed to create subscription' });
    }
  });

  // ============================================
  // PAGOS
  // ============================================

  // Obtener historial de pagos
  app.get('/payments', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

      const payments = await app.prisma.payment.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        include: { subscription: true }
      });

      return reply.code(200).send({ payments });
    } catch (error: any) {
      app.log.error({ error }, 'message');
      return reply.code(500).send({ error: 'Failed to get payments' });
    }
  });

  // Registrar un pago
  app.post('/payments', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

      const body = recordPaymentSchema.parse(req.body);

      // Obtener suscripción activa
      const subscription = await app.prisma.tenantSubscription.findFirst({
        where: { tenantId, status: { in: ['ACTIVE', 'TRIAL'] } },
        orderBy: { createdAt: 'desc' }
      });

      if (!subscription) {
        return reply.code(400).send({ error: 'No active subscription found' });
      }

      // Crear pago
      const payment = await app.prisma.payment.create({
        data: {
          tenantId,
          subscriptionId: subscription.id,
          planId: subscription.planId,
          amount: body.amount,
          currency: body.currency,
          period: body.period,
          planTier: body.planTier,
          status: 'COMPLETED',
          paidAt: new Date(),
          provider: body.provider,
          providerRef: body.providerRef,
          periodStart: new Date(),
          periodEnd: body.period === 'monthly' 
            ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        }
      });

      return reply.code(201).send({ payment });
    } catch (error: any) {
      app.log.error(error);
      return reply.code(500).send({ error: 'Failed to record payment' });
    }
  });

// ============================================
// ESTADÍSTICAS Y MÉTRICAS
// ============================================

  // ============================================
  // VERIFICACIÓN DE ACCESO
  // ============================================

  // Verificar si tiene acceso a un módulo
  app.get('/check-access/:module', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      const userId = (req as any).auth?.userId;
      if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });

      const { module } = req.params as { module: string };

      // Verificar setup
      const setup = await app.prisma.tenantSetup.findUnique({
        where: { tenantId }
      });

      if (!setup || setup.status !== 'PAID') {
        return reply.code(403).send({
          allowed: false,
          reason: 'SETUP_REQUIRED',
          message: 'Para comenzar a utilizar SGI 360, debés completar la implementación inicial',
          setupAmount: 200
        });
      }

      // Obtener suscripción
      const subscription = await app.prisma.tenantSubscription.findFirst({
        where: { tenantId },
        include: { plan: true },
        orderBy: { createdAt: 'desc' }
      });

      if (!subscription) {
        return reply.code(403).send({
          allowed: false,
          reason: 'NO_SUBSCRIPTION',
          message: 'No active subscription'
        });
      }

      // Verificar vencimiento
      const now = new Date();
      const endsAt = subscription.endsAt ? new Date(subscription.endsAt) : null;
      const gracePeriodDays = 5;

      if (endsAt) {
        const diffTime = endsAt.getTime() - now.getTime();
        const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (daysRemaining < -gracePeriodDays) {
          return reply.code(403).send({
            allowed: false,
            reason: 'SUBSCRIPTION_EXPIRED',
            message: 'Tu licencia está vencida. Por favor, renueva tu suscripción.',
            daysExpired: Math.abs(daysRemaining)
          });
        }
      }

      // Verificar acceso al módulo
      const currentPlan = subscription.plan?.tier || 'BASIC';
      const moduleConfig = MODULE_CONFIG[module as keyof typeof MODULE_CONFIG];

      if (!moduleConfig) {
        return reply.code(403).send({
          allowed: false,
          reason: 'MODULE_NOT_FOUND',
          message: 'Module not found'
        });
      }

      const planHierarchy = ['BASIC', 'PROFESSIONAL', 'PREMIUM'];
      const currentPlanIndex = planHierarchy.indexOf(currentPlan);
      const requiredPlanIndex = planHierarchy.indexOf(moduleConfig.minPlan);

      if (currentPlanIndex < requiredPlanIndex) {
        // Registrar intento de acceso
        await trackAccessAttempt(app, tenantId, userId, module, req.url);

        return reply.code(403).send({
          allowed: false,
          reason: 'PLAN_UPGRADE_REQUIRED',
          message: `Este módulo no está disponible en tu plan actual (${currentPlan}). Actualiza a ${moduleConfig.minPlan} o superior.`,
          currentPlan,
          requiredPlan: moduleConfig.minPlan,
          module: moduleConfig
        });
      }

      return reply.code(200).send({
        allowed: true,
        plan: currentPlan,
        module: moduleConfig,
        isInGracePeriod: endsAt && (endsAt.getTime() - now.getTime()) < 0 && (endsAt.getTime() - now.getTime()) > -gracePeriodDays * 24 * 60 * 60 * 1000
      });
    } catch (error: any) {
      app.log.error(error);
      return reply.code(500).send({ error: 'Failed to check access' });
    }
  });

  // ============================================
  // NOTIFICACIONES DE LICENCIA
  // ============================================

  // Obtener notificaciones de licencia
  app.get('/notifications', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      const userId = (req as any).auth?.userId;
      if (!tenantId || !userId) return reply.code(401).send({ error: 'Unauthorized' });

      const notifications = await app.prisma.licenseNotification.findMany({
        where: {
          tenantId,
          AND: [
            {
              OR: [
                { userId },
                { userId: null }
              ]
            },
            {
              OR: [
                { expiresAt: { gt: new Date() } },
                { expiresAt: null }
              ]
            }
          ]
        },
        orderBy: { createdAt: 'desc' }
      });

      return reply.code(200).send({ notifications });
    } catch (error: any) {
      app.log.error(error);
      return reply.code(500).send({ error: 'Failed to get notifications' });
    }
  });

  // Marcar notificación como leída
  app.patch('/notifications/:id/read', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (req as any).auth?.userId;
      if (!userId) return reply.code(401).send({ error: 'Unauthorized' });

      const { id } = req.params as { id: string };

      await app.prisma.licenseNotification.update({
        where: { id },
        data: {
          isRead: true,
          readAt: new Date()
        }
      });

      return reply.code(200).send({ success: true });
    } catch (error: any) {
      app.log.error(error);
      return reply.code(500).send({ error: 'Failed to update notification' });
    }
  });

  // ============================================
  // ESTADÍSTICAS Y MÉTRICAS
  // ============================================

  // Obtener métricas del tenant (para billing dashboard)
  app.get('/metrics', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

      // Contar usuarios
      const userCount = await app.prisma.tenantMembership.count({
        where: { tenantId, status: 'ACTIVE' }
      });

      // Obtener suscripción
      const subscription = await app.prisma.tenantSubscription.findFirst({
        where: { tenantId },
        include: { plan: true },
        orderBy: { createdAt: 'desc' }
      });

      // Obtener intentos de acceso bloqueados
      const blockedAttempts = await app.prisma.licenseAccessAttempt.count({
        where: { tenantId }
      });

      return reply.code(200).send({
        userCount,
        subscription,
        blockedAttempts,
        limits: subscription?.plan?.limits || PLAN_LIMITS.BASIC
      });
    } catch (error: any) {
      app.log.error(error);
      return reply.code(500).send({ error: 'Failed to get metrics' });
    }
  });

  // ============================================
  // SUPERADMIN ENDPOINTS
  // ============================================

  // Listar todos los tenants (SuperAdmin only)
  app.get('/admin/tenants', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (req as any).auth;
      if (!user?.globalRole || user.globalRole !== 'SUPER_ADMIN') {
        return reply.code(403).send({ error: 'Forbidden - SuperAdmin only' });
      }

      const tenants = await app.prisma.tenant.findMany({
        include: {
          subscriptions: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: { plan: true }
          },
          tenantSetup: true,
          _count: {
            select: {
              memberships: true,
              payments: true
            }
          }
        }
      });

      return reply.code(200).send({ tenants });
    } catch (error: any) {
      app.log.error(error);
      return reply.code(500).send({ error: 'Failed to get tenants' });
    }
  });

  // Panel de métricas de negocio (SuperAdmin)
  app.get('/admin/dashboard', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (req as any).auth;
      if (!user?.globalRole || user.globalRole !== 'SUPER_ADMIN') {
        return reply.code(403).send({ error: 'Forbidden - SuperAdmin only' });
      }

      const [
        totalTenants,
        activeTenants,
        expiredTenants,
        setupPending,
        totalPayments,
        monthlyRecurring
      ] = await Promise.all([
        app.prisma.tenant.count(),
        app.prisma.tenantSubscription.count({
          where: { 
            status: 'ACTIVE',
            endsAt: { gt: new Date() }
          }
        }),
        app.prisma.tenantSubscription.count({
          where: { 
            OR: [
              { status: 'CANCELED' },
              { endsAt: { lt: new Date() } }
            ]
          }
        }),
        app.prisma.tenantSetup.count({
          where: { status: 'PENDING' }
        }),
        app.prisma.payment.count({
          where: { status: 'COMPLETED' }
        }),
        app.prisma.payment.aggregate({
          where: {
            status: 'COMPLETED',
            period: 'monthly',
            createdAt: {
              gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
            }
          },
          _sum: { amount: true }
        })
      ]);

      // Plan más utilizado
      const planDistribution = await app.prisma.$queryRaw`
        SELECT p.tier, COUNT(*) as count
        FROM "TenantSubscription" ts
        JOIN "Plan" p ON ts."planId" = p.id
        WHERE ts.status = 'ACTIVE'
        GROUP BY p.tier
        ORDER BY count DESC
      `;

      return reply.code(200).send({
        metrics: {
          totalTenants,
          activeTenants,
          expiredTenants,
          setupPending,
          totalPayments,
          monthlyRecurringRevenue: monthlyRecurring._sum?.amount || 0,
          planDistribution
        }
      });
    } catch (error: any) {
      app.log.error(error);
      return reply.code(500).send({ error: 'Failed to get dashboard' });
    }
  });

  // Actualizar suscripción de un tenant (SuperAdmin)
  app.patch('/admin/tenants/:tenantId/subscription', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (req as any).auth;
      if (!user?.globalRole || user.globalRole !== 'SUPER_ADMIN') {
        return reply.code(403).send({ error: 'Forbidden - SuperAdmin only' });
      }

      const { tenantId } = req.params as { tenantId: string };
      const body = req.body as any;

      // Actualizar o crear suscripción
      const subscription = await app.prisma.tenantSubscription.updateMany({
        where: { tenantId },
        data: {
          status: body.status,
          endsAt: body.endsAt ? new Date(body.endsAt) : undefined
        }
      });

      return reply.code(200).send({
        success: true,
        subscription,
        message: 'Subscription updated successfully'
      });
    } catch (error: any) {
      app.log.error(error);
      return reply.code(500).send({ error: 'Failed to update subscription' });
    }
  });

  // ============================================
  // FUNCIONES AUXILIARES
  // ============================================

  async function trackAccessAttempt(
    app: FastifyInstance,
    tenantId: string,
    userId: string | undefined,
    module: string,
    path: string
  ) {
    if (!userId) return;

    try {
      await app.prisma.licenseAccessAttempt.upsert({
        where: {
          tenantId_userId_module: {
            tenantId,
            userId,
            module
          }
        },
        update: {
          count: { increment: 1 },
          path,
          lastAttemptAt: new Date()
        },
        create: {
          tenantId,
          userId,
          module,
          path,
          count: 1,
          lastAttemptAt: new Date()
        }
      });

      // Si hay 3 o más intentos, crear notificación de sugerencia de upgrade
      const attempts = await app.prisma.licenseAccessAttempt.findUnique({
        where: {
          tenantId_userId_module: {
            tenantId,
            userId,
            module
          }
        }
      });

      if (attempts && attempts.count >= 3) {
        const existingNotification = await app.prisma.licenseNotification.findFirst({
          where: {
            tenantId,
            userId,
            type: 'UPGRADE_SUGGESTED'
          }
        });

        if (!existingNotification) {
          await app.prisma.licenseNotification.create({
            data: {
              tenantId,
              userId,
              type: 'UPGRADE_SUGGESTED',
              title: '¿Necesitas más funcionalidades?',
              message: `Has intentado acceder varias veces al módulo ${MODULE_CONFIG[module as keyof typeof MODULE_CONFIG]?.name || module}. Este módulo está disponible en un plan superior.`,
              expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            }
          });
        }
      }
    } catch (error: any) {
      app.log.error(error);
    }
  }

  // ============================================
  // ACCESO A MÓDULOS (para sidebar)
  // ============================================

  // GET /api/modules/access - Obtener acceso a módulos
  app.get('/modules/access', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      const globalRole = (req as any).auth?.globalRole;
      
      console.log('[/modules/access] tenantId:', tenantId);
      console.log('[/modules/access] globalRole:', globalRole);
      
      if (!tenantId) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      // Detectar si es SuperAdmin
      const isSuperAdmin = globalRole === 'SUPER_ADMIN';
      console.log('[/modules/access] isSuperAdmin:', isSuperAdmin);

      // Si es SuperAdmin, devolver todos los módulos desbloqueados
      if (isSuperAdmin) {
        const allModules = [
          { key: 'project360', name: 'PROJECT360', icon: 'Target', route: '/project360', description: 'Planes de acción y mejora continua', hasAccess: true, isBlocked: false, requiredPlan: 'SUPER_ADMIN', upgradeUrl: '#', tooltip: null },
          { key: 'mantenimiento', name: 'Mantenimiento', icon: 'Wrench', route: '/mantenimiento', description: 'Gestión de mantenimiento industrial', hasAccess: true, isBlocked: false, requiredPlan: 'SUPER_ADMIN', upgradeUrl: '#', tooltip: null },
          { key: 'simulacros', name: 'Simulacros', icon: 'Shield', route: '/simulacros', description: 'Planes de contingencia y emergencias', hasAccess: true, isBlocked: false, requiredPlan: 'SUPER_ADMIN', upgradeUrl: '#', tooltip: null },
          { key: 'commandCenter', name: 'Command Center', icon: 'Brain', route: '/command-center', description: 'IA Ejecutiva Premium', hasAccess: true, isBlocked: false, requiredPlan: 'SUPER_ADMIN', upgradeUrl: '#', tooltip: null },
          { key: 'documentos', name: 'Documentos', icon: 'FileText', route: '/documentos', description: 'Gestión documental', hasAccess: true, isBlocked: false, requiredPlan: 'SUPER_ADMIN', upgradeUrl: '#', tooltip: null },
          { key: 'normativos', name: 'Normativos', icon: 'Shield', route: '/normativos', description: 'Cumplimiento normativo', hasAccess: true, isBlocked: false, requiredPlan: 'SUPER_ADMIN', upgradeUrl: '#', tooltip: null },
          { key: 'ia_auditora', name: 'Auditoría IA', icon: 'Brain', route: '/ia-auditoria', description: 'Auditoría asistida por IA', hasAccess: true, isBlocked: false, requiredPlan: 'SUPER_ADMIN', upgradeUrl: '#', tooltip: null },
          { key: 'auditorias', name: 'Auditorías ISO', icon: 'ClipboardList', route: '/auditorias', description: 'Gestión de auditorías internas y externas', hasAccess: true, isBlocked: false, requiredPlan: 'SUPER_ADMIN', upgradeUrl: '#', tooltip: null },
          { key: 'no_conformidades', name: 'No Conformidades', icon: 'AlertTriangle', route: '/no-conformidades', description: 'Gestión de no conformidades', hasAccess: true, isBlocked: false, requiredPlan: 'SUPER_ADMIN', upgradeUrl: '#', tooltip: null },
          { key: 'riesgos', name: 'Riesgos', icon: 'AlertTriangle', route: '/riesgos', description: 'Gestión de riesgos y mitigación', hasAccess: true, isBlocked: false, requiredPlan: 'SUPER_ADMIN', upgradeUrl: '#', tooltip: null },
          { key: 'indicadores', name: 'Indicadores', icon: 'TrendingUp', route: '/indicadores', description: 'KPIs y métricas avanzadas', hasAccess: true, isBlocked: false, requiredPlan: 'SUPER_ADMIN', upgradeUrl: '#', tooltip: null },
          { key: 'capacitaciones', name: 'Capacitaciones', icon: 'BookOpen', route: '/capacitaciones', description: 'Gestión de capacitaciones', hasAccess: true, isBlocked: false, requiredPlan: 'SUPER_ADMIN', upgradeUrl: '#', tooltip: null },
          { key: 'rrhh', name: 'RRHH', icon: 'UserCircle', route: '/rrhh', description: 'Gestión de recursos humanos', hasAccess: true, isBlocked: false, requiredPlan: 'SUPER_ADMIN', upgradeUrl: '#', tooltip: null },
          { key: 'clientes', name: 'Clientes', icon: 'Users', route: '/clientes', description: 'Gestión de clientes y encuestas', hasAccess: true, isBlocked: false, requiredPlan: 'SUPER_ADMIN', upgradeUrl: '#', tooltip: null },
          { key: 'reportes', name: 'Reportes', icon: 'FileBarChart', route: '/reportes', description: 'Reportes y analytics', hasAccess: true, isBlocked: false, requiredPlan: 'SUPER_ADMIN', upgradeUrl: '#', tooltip: null },
          { key: 'encuestas', name: 'Encuestas', icon: 'MessageSquare', route: '/encuestas', description: 'Encuestas de satisfacción', hasAccess: true, isBlocked: false, requiredPlan: 'SUPER_ADMIN', upgradeUrl: '#', tooltip: null }
        ];
        if (!allModules.find(m => m.key === 'commandCenter')) {
          allModules.push({ key: 'commandCenter', name: 'Command Center', icon: 'Brain', route: '/command-center', description: 'IA Ejecutiva Premium', hasAccess: true, isBlocked: false, requiredPlan: 'SUPER_ADMIN', upgradeUrl: '#', tooltip: null });
        }
        console.log('[/modules/access] Returning all modules for SuperAdmin, count:', allModules.length);
        return reply.send({ modules: allModules });
      }

      // Para usuarios normales, devolver módulos según plan
      // Usar TenantSubscription en lugar de tenantSetup
      const subscription = await app.prisma.tenantSubscription.findFirst({
        where: { tenantId },
        include: { plan: true }
      });

      const planTier = subscription?.plan?.tier || 'BASIC';
      const limits = PLAN_LIMITS[planTier as keyof typeof PLAN_LIMITS] || PLAN_LIMITS.BASIC;

      const modules = Object.entries(MODULE_CONFIG).map(([key, config]: [string, any]) => {
        const hasAccess = limits.modules.includes('*') || limits.modules.includes(key);
        return {
          key,
          name: config.name,
          icon: config.icon,
          route: `/${key}`,
          description: config.description || '',
          hasAccess,
          isBlocked: !hasAccess,
          requiredPlan: config.minPlan,
          upgradeUrl: `/planes?upgrade=${key}`,
          tooltip: !hasAccess ? `Disponible en plan ${config.minPlan}` : null
        };
      });

      return reply.send({ modules });
    } catch (error: any) {
      app.log.error({ error }, 'message');
      return reply.code(500).send({ error: 'Error interno del servidor' });
    }
  });

  // ============================================
  // PLANES Y PAGOS (FASE 4)
  // ============================================

  // POST /create-payment - Crear preferencia de pago en MercadoPago
  app.post('/create-payment', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

      const { planTier, planId, amount } = req.body as { planTier: string; planId: string; amount: number };

      if (!planTier || !planId || !amount) {
        return reply.code(400).send({ error: 'Missing required fields' });
      }

      // Obtener configuración de MercadoPago
      const mpConfigPath = require('path').join(process.cwd(), '.mercadopago-config.json');
      const fs = require('fs');

      if (!fs.existsSync(mpConfigPath)) {
        return reply.code(500).send({ error: 'MercadoPago not configured' });
      }

      const mpConfig = JSON.parse(fs.readFileSync(mpConfigPath, 'utf-8'));

      if (!mpConfig.configured || !mpConfig.accessToken) {
        return reply.code(500).send({ error: 'MercadoPago not properly configured' });
      }

      // Crear preferencia en MercadoPago
      const mercadopago = require('mercadopago');
      mercadopago.configure({
        access_token: mpConfig.accessToken,
      });

      const tenant = await app.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true }
      });

      const preference = {
        items: [
          {
            title: `Plan ${planTier} - ${tenant?.name}`,
            quantity: 1,
            currency_id: 'USD',
            unit_price: amount,
          }
        ],
        payer: {
          email: (req as any).auth?.email || 'customer@example.com',
        },
        back_urls: {
          success: `${process.env.APP_URL || 'http://localhost:3000'}/plan-selection?payment=success&preference_id=${'{preference_id}'}`,
          failure: `${process.env.APP_URL || 'http://localhost:3000'}/plan-selection?payment=failure`,
          pending: `${process.env.APP_URL || 'http://localhost:3000'}/plan-selection?payment=pending`,
        },
        external_reference: `${tenantId}-${planId}`,
        metadata: {
          tenantId,
          planId,
          planTier,
        }
      };

      const result = await mercadopago.preferences.create(preference);

      app.log.info(`Payment preference created: ${result.body.id} for tenant ${tenantId}`);

      return reply.send({
        preferenceId: result.body.id,
        preferenceUrl: result.body.init_point,
      });
    } catch (error: any) {
      app.log.error({ error }, 'message');
      return reply.code(500).send({ error: error.message || 'Error processing payment' });
    }
  });

  // POST /payment-success - Confirmar pago y habilitar módulos
  app.post('/payment-success', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

      const { preferenceId, planTier, planId } = req.body as { preferenceId: string; planTier: string; planId: string };

      if (!planTier || !planId) {
        return reply.code(400).send({ error: 'Missing required fields' });
      }

      // Obtener plan
      const plan = await app.prisma.plan.findUnique({
        where: { id: planId },
        select: { features: true }
      });

      if (!plan) {
        return reply.code(404).send({ error: 'Plan not found' });
      }

      // Eliminar suscripción anterior si existe
      await app.prisma.tenantSubscription.deleteMany({
        where: { tenantId }
      });

      // Crear nueva suscripción
      const subscription = await app.prisma.tenantSubscription.create({
        data: {
          tenantId,
          planId,
          status: 'ACTIVE',
          startedAt: new Date(),
          endsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 año
        }
      });

      // Habilitar módulos según plan
      const enabledModules = Object.entries(plan.features as Record<string, boolean>)
        .filter(([, enabled]) => enabled)
        .map(([key]) => key);

      // Eliminar módulos previos y agregar los nuevos
      await app.prisma.tenantFeature.deleteMany({
        where: { tenantId }
      });

      for (const moduleName of enabledModules) {
        await app.prisma.tenantFeature.create({
          data: {
            tenantId,
            key: moduleName,
            enabled: true,
          }
        });
      }

      app.log.info(`Payment confirmed for tenant ${tenantId}: plan ${planTier} with modules ${enabledModules.join(', ')}`);

      return reply.send({
        success: true,
        message: 'Pago confirmado y módulos habilitados',
        subscription: {
          id: subscription.id,
          planId,
          planTier,
          status: subscription.status,
          startedAt: subscription.startedAt,
          endsAt: subscription.endsAt,
        },
        enabledModules
      });
    } catch (error: any) {
      app.log.error({ error }, 'message');
      return reply.code(500).send({ error: error.message || 'Error processing payment' });
    }
  });

  // ============================================
  // FACTURAS (INVOICES)
  // ============================================

  // Subir factura PDF (solo admin)
  app.post('/payments/:paymentId/invoice', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (req as any).auth;
      if (user.globalRole !== 'SUPER_ADMIN') {
        return reply.code(403).send({ error: 'Forbidden - Solo Super Admin' });
      }

      const { paymentId } = req.params as { paymentId: string };
      
      // Verificar que existe el pago
      const payment = await app.prisma.payment.findUnique({
        where: { id: paymentId },
        include: { tenant: true }
      });

      if (!payment) {
        return reply.code(404).send({ error: 'Pago no encontrado' });
      }

      // Crear o actualizar factura
      const invoiceNumber = `F-${Date.now()}`;
      const invoice = await (app.prisma as any).invoice.upsert({
        where: { paymentId },
        update: {
          status: 'ISSUED',
          updatedAt: new Date()
        },
        create: {
          paymentId,
          tenantId: payment.tenantId,
          invoiceNumber,
          invoiceDate: new Date(),
          subtotal: payment.amount,
          taxAmount: 0,
          total: payment.amount,
          currency: payment.currency,
          customerName: payment.tenant?.name || 'Cliente',
          status: 'ISSUED',
          createdById: user.userId
        }
      });

      return reply.send({
        success: true,
        invoice,
        message: 'Factura creada exitosamente'
      });
    } catch (error: any) {
      app.log.error(error);
      return reply.code(500).send({ error: 'Error creando factura' });
    }
  });

  // Obtener facturas del tenant (para el cliente)
  app.get('/invoices', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

      const invoices = await (app.prisma as any).invoice.findMany({
        where: { tenantId },
        include: { payment: true },
        orderBy: { createdAt: 'desc' }
      });

      return reply.send({ invoices });
    } catch (error: any) {
      app.log.error(error);
      return reply.code(500).send({ error: 'Error obteniendo facturas' });
    }
  });

  // Subir archivo PDF de factura
  app.post('/invoices/:id/pdf', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (req as any).auth;
      if (user.globalRole !== 'SUPER_ADMIN') {
        return reply.code(403).send({ error: 'Forbidden' });
      }

      const { id } = req.params as { id: string };
      
      // Guardar el archivo (simulado - aquí usarías @fastify/multipart)
      const pdfPath = `/uploads/invoices/${id}.pdf`;
      
      const invoice = await (app.prisma as any).invoice.update({
        where: { id },
        data: { 
          pdfPath,
          pdfUrl: `/uploads/invoices/${id}.pdf`,
          status: 'SENT'
        }
      });

      return reply.send({
        success: true,
        invoice,
        message: 'Factura PDF subida exitosamente'
      });
    } catch (error: any) {
      app.log.error(error);
      return reply.code(500).send({ error: 'Error subiendo factura' });
    }
  });

  // ============================================
  // MERCADOPAGO CHECKOUT
  // ============================================

  // Crear preferencia de pago
  app.post('/checkout', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      const userId = (req as any).auth?.userId;
      
      console.log('[CHECKOUT] Iniciando checkout:', { tenantId, userId });
      
      if (!tenantId) {
        console.log('[CHECKOUT] Error: No tenantId en auth');
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const body = req.body as any;
      const { planTier, period } = body;
      
      console.log('[CHECKOUT] Datos recibidos:', { planTier, period });

      // Validar datos
      if (!planTier) {
        console.log('[CHECKOUT] Error: No planTier');
        return reply.code(400).send({ error: 'Plan requerido' });
      }
      if (planTier === 'NO_PLAN') {
        console.log('[CHECKOUT] Error: Plan NO_PLAN no permitido');
        return reply.code(400).send({ error: 'Debes seleccionar un plan para pagar. Por favor elige Básico, Profesional o Premium.' });
      }
      if (!['BASIC', 'PROFESSIONAL', 'PREMIUM'].includes(planTier)) {
        console.log('[CHECKOUT] Error: Plan inválido:', planTier);
        return reply.code(400).send({ error: 'Plan inválido' });
      }

      if (!period || !['monthly', 'annual'].includes(period)) {
        console.log('[CHECKOUT] Error: Período inválido:', period);
        return reply.code(400).send({ error: 'Período inválido' });
      }

      // Obtener datos del tenant y usuario
      const tenant = await app.prisma.tenant.findUnique({
        where: { id: tenantId }
      });

      const user = await app.prisma.platformUser.findUnique({
        where: { id: userId }
      });

      console.log('[CHECKOUT] Tenant y usuario:', { 
        tenant: tenant ? { id: tenant.id, name: tenant.name } : null, 
        user: user ? { id: user.id, email: user.email } : null 
      });

      if (!tenant || !user) {
        console.log('[CHECKOUT] Error: Tenant o usuario no encontrado');
        return reply.code(404).send({ error: 'Tenant o usuario no encontrado' });
      }

      // Calcular monto (aplicando promo del producto si corresponde)
      const { amount, isPromo } = await resolvePrice(app, tenantId, planTier, period);
      console.log('[CHECKOUT] Monto calculado:', { amount, planTier, period, isPromo });

      if (!amount) {
        console.log('[CHECKOUT] Error: Precio no encontrado');
        return reply.code(400).send({ error: 'Precio no encontrado' });
      }

      // Crear preferencia de pago de manera simple
      let checkoutResponse;
      const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

      if (accessToken) {
        // Si tenemos token de MercadoPago, crear preferencia real
        try {
          const appBase = process.env.APP_URL || 'http://localhost:3000';
          const apiBase = `${process.env.WEBHOOK_BASE_URL || process.env.APP_URL || 'https://logismart.ar'}${PRODUCT_BILLING.apiBase}`;
          const periodLabel = period === 'monthly' ? 'Mensual' : 'Anual';
          const preferenceData = {
            items: [{
              title: `${PRODUCT_BILLING.productName} - Plan ${planTier} (${periodLabel})${isPromo ? ' — Promo lanzamiento' : ''}`,
              description: `Suscripción ${period === 'monthly' ? 'mensual' : 'anual'} a ${PRODUCT_BILLING.productName} - Plan ${planTier}`,
              quantity: 1,
              currency_id: 'USD',
              unit_price: amount
            }],
            payer: {
              email: user.email,
              name: user.email.split('@')[0]
            },
            back_urls: {
              success: `${appBase}${PRODUCT_BILLING.basePath}${PRODUCT_BILLING.successPath}?status=success`,
              failure: `${appBase}${PRODUCT_BILLING.basePath}${PRODUCT_BILLING.successPath}?status=failure`,
              pending: `${appBase}${PRODUCT_BILLING.basePath}${PRODUCT_BILLING.successPath}?status=pending`
            },
            notification_url: `${apiBase}/license/webhook/mercadopago`,
            external_reference: `${tenantId}_${planTier}_${period}`,
            statement_descriptor: PRODUCT_BILLING.descriptor,
            metadata: {
              tenant_id: tenantId,
              plan_tier: planTier,
              period: period,
              user_id: userId
            }
          };

          const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(preferenceData)
          });

          const preference = await response.json();

          if (!response.ok) {
            throw new Error(`MercadoPago API Error: ${preference.message || 'Unknown error'}`);
          }

          checkoutResponse = {
            preferenceId: preference.id,
            initPoint: preference.init_point,
            sandboxInitPoint: preference.sandbox_init_point || preference.init_point
          };
        } catch (mpError: any) {
          console.error('MercadoPago error details:', mpError);
          app.log.error(mpError, 'Error creating MercadoPago preference');
          // Fallback a mock si MercadoPago falla
          const mockPreferenceId = `mock_${Date.now()}`;
          checkoutResponse = {
            preferenceId: mockPreferenceId,
            initPoint: `https://www.mercadopago.com/mla/checkout/pay?pref_id=${mockPreferenceId}`,
            sandboxInitPoint: `https://www.mercadopago.com/mla/checkout/pay?pref_id=${mockPreferenceId}`
          };
        }
      } else {
        // Sin token, usar mock para desarrollo
        const mockPreferenceId = `mock_${Date.now()}`;
        checkoutResponse = {
          preferenceId: mockPreferenceId,
          initPoint: `https://www.mercadopago.com/mla/checkout/pay?pref_id=${mockPreferenceId}`,
          sandboxInitPoint: `https://www.mercadopago.com/mla/checkout/pay?pref_id=${mockPreferenceId}`
        };
      }

      // Guardar preferencia de pago en BD
      try {
        await (app.prisma as any).paymentPreference.create({
          data: {
            tenantId,
            userId,
            planTier,
            period,
            amount,
            currency: 'USD',
            mpPreferenceId: checkoutResponse.preferenceId,
            status: 'PENDING'
          }
        }).catch(() => {
          // Si la tabla no existe, continuamos sin guardar
          return null;
        });
      } catch (e) {
        // Ignorar errores de BD, el pago seguirá funcionando
        app.log.warn('Could not save payment preference to DB');
      }

      const isMock = checkoutResponse.preferenceId.startsWith('mock_');
      return reply.send({
        preferenceId: checkoutResponse.preferenceId,
        initPoint: isMock ? null : checkoutResponse.initPoint,
        sandboxInitPoint: isMock ? null : checkoutResponse.sandboxInitPoint,
        mock: isMock,
        amount,
        planTier,
        period
      });

    } catch (error: any) {
      app.log.error(error);
      return reply.code(500).send({ error: 'Error creando checkout', details: error.message });
    }
  });

  // POST /license/activate - Activar plan directamente (testing/dev)
  app.post('/activate', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = req.body as any;
      let tenantId = await getEffectiveTenantId(req, app.prisma);
      // Fallback para testing: buscar primer tenant si no hay contexto
      if (!tenantId) {
        const firstTenant = await app.prisma.tenant.findFirst({ orderBy: { createdAt: 'asc' } });
        if (firstTenant) tenantId = firstTenant.id;
      }
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

      // Usar auth.userId si existe, o fallback para testing
      const userId = (req as any).auth?.userId || 'system';

      const planTier = body.planTier || 'PREMIUM';
      const period = body.period || 'monthly';

      // Buscar o crear el plan
      let plan = await app.prisma.plan.findUnique({
        where: { tier: planTier }
      });

      if (!plan) {
        const planLimit = PLAN_LIMITS[planTier as keyof typeof PLAN_LIMITS];
        plan = await app.prisma.plan.create({
          data: {
            tier: planTier,
            name: planTier.charAt(0) + planTier.slice(1).toLowerCase(),
            features: planLimit || {},
            limits: { maxUsers: planLimit?.maxUsers || 50 }
          }
        });
      }

      // Calcular fechas
      const now = new Date();
      const endDate = new Date(now);
      if (period === 'monthly') {
        endDate.setMonth(endDate.getMonth() + 1);
      } else {
        endDate.setFullYear(endDate.getFullYear() + 1);
      }

      // Desactivar suscripciones anteriores
      await app.prisma.tenantSubscription.updateMany({
        where: { tenantId },
        data: { status: 'CANCELED' }
      });

      // Crear nueva suscripción
      const newSub = await app.prisma.tenantSubscription.create({
        data: {
          tenantId,
          planId: plan.id,
          status: 'ACTIVE',
          startedAt: now,
          endsAt: endDate,
          price: PLAN_PRICES[period as keyof typeof PLAN_PRICES]?.[planTier as keyof (typeof PLAN_PRICES)['monthly']] || 99,
          provider: 'manual'
        }
      });

      // Guardar pago simulado
      try {
        await app.prisma.payment.create({
          data: {
            tenantId,
            subscriptionId: newSub.id,
            planId: plan.id,
            amount: PLAN_PRICES[period as keyof typeof PLAN_PRICES]?.[planTier as keyof (typeof PLAN_PRICES)['monthly']] || 99,
            currency: 'USD',
            period: period === 'annual' ? 'annual' : 'monthly',
            planTier: planTier as any,
            status: 'COMPLETED' as any,
            paidAt: now,
            provider: 'manual',
            providerRef: `manual_${Date.now()}`
          }
        });
      } catch (e: any) {
        app.log.warn('Could not save test payment to DB: ' + e.message);
      }

      return reply.send({
        success: true,
        message: 'Plan activado correctamente',
        planTier,
        period,
        endsAt: endDate
      });
    } catch (error: any) {
      app.log.error(error);
      return reply.code(500).send({ error: 'Error activando plan', details: error.message });
    }
  });

  // GET /license/usage - Obtener uso de licencia
  app.get('/usage', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);

if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

      // Datos básicos de uso
      return reply.send({
        tenantId,
        documentsCount: 0,
        usersCount: 1,
        auditsCount: 0,
        ncrCount: 0,
        storageUsedMB: 0,
        maxStorageMB: 1000
      });
    } catch (error: any) {
      return reply.code(500).send({ error: 'Error obteniendo uso de licencia' });
    }
  });

  // GET /license/usage-history - Obtener historial de uso
  app.get('/usage-history', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

      // Historial vacío por defecto
      return reply.send({ history: [] });
    } catch (error: any) {
      return reply.code(500).send({ error: 'Error obteniendo historial' });
    }
  });

  // GET /license/payment-methods - Obtener métodos de pago
  app.get('/payment-methods', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

      // Métodos de pago vacío por defecto
      return reply.send({ paymentMethods: [] });
    } catch (error: any) {
      return reply.code(500).send({ error: 'Error obteniendo métodos de pago' });
    }
  });

  // GET /license/admin/setup-fees - Obtener cuotas de setup
  app.get('/admin/setup-fees', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      // Verificar que sea admin
      // Setup fees vacío por defecto
      return reply.send({ setupFees: [] });
    } catch (error: any) {
      return reply.code(500).send({ error: 'Error obteniendo cuotas' });
    }
  });

  // GET /license/admin/payments - Obtener pagos de admin
  app.get('/admin/payments', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const payments = await app.prisma.payment.findMany({
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
          tenant: { select: { id: true, name: true, slug: true } },
          subscription: { include: { plan: { select: { name: true, tier: true } } } }
        }
      });
      return reply.send({ payments });
    } catch (error: any) {
      return reply.code(500).send({ error: 'Error obteniendo pagos' });
    }
  });

  // POST /license/admin/setup-fee - Crear cuota de setup
  app.post('/admin/setup-fee', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      // Verificar que sea admin
      const body = req.body as any;

      return reply.send({
        id: 'setup-fee-' + Date.now(),
        amount: body.amount || 0,
        tenantId: body.tenantId,
        createdAt: new Date()
      });
    } catch (error: any) {
      return reply.code(500).send({ error: 'Error creando cuota' });
    }
  });

  // ────────────────────────────────────────────────────────────
  // Helpers compartidos de cobro (preferencia única y débito automático)
  // ────────────────────────────────────────────────────────────

  // Una sola app de MercadoPago → una sola notification URL. Si el tenant del
  // evento no existe en esta DB, el cobro pertenece al otro producto: se
  // reenvía por la red interna de Docker (sgi-network). El header
  // 'x-mp-forwarded' evita loops de reenvío.
  const PEER_WEBHOOK_URL = IS_FLOTA_PRODUCT
    ? `${process.env.SGI_API_INTERNAL || 'http://sgi-api:3002'}/license/webhook/mercadopago`
    : `${process.env.FLOTA_API_INTERNAL || 'http://flota-api:3002'}/license/webhook/mercadopago`;

  async function forwardWebhookToPeer(req: FastifyRequest, body: any, query: any) {
    if ((req.headers['x-mp-forwarded'] as string | undefined) === '1') return;
    try {
      await fetch(PEER_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-mp-forwarded': '1' },
        // El query IPN (?topic&id) viaja dentro del body para que el peer lo procese igual
        body: JSON.stringify({ ...(body || {}), __forwarded_query: query || {} }),
      });
      app.log.info(`[MP WEBHOOK] Evento reenviado al producto par (${PEER_WEBHOOK_URL})`);
    } catch (e: any) {
      app.log.error(`[MP WEBHOOK] Error reenviando al peer: ${e.message}`);
    }
  }

  // Activa/renueva la licencia tras un cobro aprobado. Compartida por el pago
  // único (preferencia) y cada débito automático (authorized_payment).
  async function activatePaidPeriod(opts: {
    tenantId: string;
    planTier: string;
    period: 'monthly' | 'annual';
    providerRef: string;
    amount: number;
    currency?: string;
    preapprovalId?: string;
  }) {
    const { tenantId, planTier, period, providerRef, amount, currency, preapprovalId } = opts;
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

    // Buscar o crear plan
    let plan = await app.prisma.plan.findUnique({ where: { tier: planTier as any } });
    if (!plan) {
      plan = await app.prisma.plan.create({
        data: {
          tier: planTier as any,
          name: planTier.charAt(0) + planTier.slice(1).toLowerCase(),
          features: (PLAN_LIMITS as any)[planTier],
          limits: { maxUsers: (PLAN_LIMITS as any)[planTier]?.maxUsers ?? 50 }
        }
      });
    }

    // Idempotencia: el cobro ya fue procesado (MercadoPago reintenta webhooks)
    const alreadyProcessed = await (app.prisma as any).payment.findFirst({
      where: { tenantId, provider: 'mercadopago', providerRef },
    });
    if (alreadyProcessed) {
      app.log.info(`[MP WEBHOOK] Cobro ${providerRef} ya procesado — ignorando`);
      return;
    }

    // Período de licencia
    const now = new Date();
    const endsAt = new Date(now);
    if (period === 'monthly') endsAt.setMonth(endsAt.getMonth() + 1);
    else endsAt.setFullYear(endsAt.getFullYear() + 1);

    // Cancelar suscripciones anteriores y crear la activa
    await app.prisma.tenantSubscription.updateMany({
      where: { tenantId },
      data: { status: 'CANCELED' }
    });

    const newSub = await app.prisma.tenantSubscription.create({
      data: {
        tenantId,
        planId: plan.id,
        status: 'ACTIVE',
        startedAt: now,
        endsAt,
        price: amount || 0,
        provider: 'mercadopago',
        ...(preapprovalId ? { providerRef: preapprovalId } : {}),
      }
    });

    // Registrar el pago
    await (app.prisma as any).payment.create({
      data: {
        tenantId,
        subscriptionId: newSub.id,
        planId: plan.id,
        amount: amount || 0,
        currency: currency || 'USD',
        status: 'COMPLETED',
        period: period === 'annual' ? 'annual' : 'monthly',
        planTier,
        paidAt: now,
        providerRef,
        provider: 'mercadopago'
      }
    });

    // Reactivar licencia y salir de demo
    const updatedTenant = await (app.prisma as any).tenant.update({
      where: { id: tenantId },
      data: {
        isDemo: false,
        demoExpiresAt: null,
        licensePlan: planTier,
        licenseStartAt: now,
        licenseEndAt: endsAt,
        licenseStatus: 'ACTIVE',
        graceEndAt: null,
        lastPaymentId: providerRef,
        notified7Days: false,
        notified3Days: false,
        notified1Day: false,
        notifiedExpired: false,
        notifiedGrace: false,
      }
    });

    // Email de confirmación al admin del tenant
    const adminMembership = await app.prisma.tenantMembership.findFirst({
      where: { tenantId, role: 'TENANT_ADMIN', deletedAt: null },
      include: { user: { select: { email: true } } }
    });
    if (adminMembership?.user?.email) {
      const appUrl = process.env.APP_URL || 'https://logismart.ar';
      const emailResult = await sendEmail(paymentConfirmationEmail({
        to: adminMembership.user.email,
        companyName: updatedTenant.name || tenantId,
        planName: plan.name || planTier,
        planTier,
        period: period === 'annual' ? 'annual' : 'monthly',
        amount: amount || 0,
        endsAt,
        loginUrl: `${appUrl}${PRODUCT_BILLING.basePath}/login`,
      }));
      if (emailResult.success) {
        app.log.info(`[MP WEBHOOK] Email de confirmación enviado a ${adminMembership.user.email}`);
      } else {
        app.log.warn(`[MP WEBHOOK] No se pudo enviar email: ${emailResult.error}`);
      }
    }

    // Escalado de promo: cuando el tenant agota los meses promocionales, el
    // preapproval sube al precio regular para el siguiente débito.
    if (preapprovalId && PRODUCT_BILLING.promo && period === 'monthly' && accessToken) {
      try {
        const paidMonthly = await app.prisma.payment.count({
          where: { tenantId, status: 'COMPLETED' as any, period: 'monthly' },
        });
        if (paidMonthly >= PRODUCT_BILLING.promo.months) {
          const regular = (PRODUCT_BILLING.prices as any).monthly[planTier];
          const updRes = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              auto_recurring: { frequency: 1, frequency_type: 'months', transaction_amount: regular, currency_id: 'USD' }
            })
          });
          if (updRes.ok) {
            app.log.info(`[MP WEBHOOK] Promo agotada (${paidMonthly} pagos) — preapproval ${preapprovalId} → USD ${regular}/mes`);
          } else {
            app.log.warn(`[MP WEBHOOK] MP rechazó actualización de preapproval ${preapprovalId}: ${updRes.status}`);
          }
        }
      } catch (e: any) {
        app.log.warn(`[MP WEBHOOK] No se pudo actualizar precio del preapproval: ${e.message}`);
      }
    }

    app.log.info(`[MP WEBHOOK] ✅ Plan ${planTier} activado para tenant ${tenantId} — modo demo desactivado`);
  }

  // POST /checkout/subscribe — Suscripción con débito automático mensual
  // (MercadoPago preapproval). Cobra el precio promo si corresponde y el
  // webhook lo sube al regular cuando se agotan los meses promo.
  app.post('/checkout/subscribe', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      const userId = (req as any).auth?.userId;
      if (!tenantId || !userId) return reply.code(401).send({ error: 'Unauthorized' });

      const { planTier } = (req.body as any) || {};
      if (!planTier || !['BASIC', 'PROFESSIONAL', 'PREMIUM'].includes(planTier)) {
        return reply.code(400).send({ error: 'Plan inválido' });
      }

      const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
      if (!accessToken) {
        return reply.code(500).send({ error: 'MercadoPago no configurado' });
      }

      const user = await app.prisma.platformUser.findUnique({ where: { id: userId } });
      const tenant = await app.prisma.tenant.findUnique({ where: { id: tenantId } });
      if (!user || !tenant) return reply.code(404).send({ error: 'Tenant o usuario no encontrado' });

      const { amount, isPromo } = await resolvePrice(app, tenantId, planTier, 'monthly');
      if (!amount) return reply.code(400).send({ error: 'Precio no encontrado' });

      const appBase = process.env.APP_URL || 'https://logismart.ar';
      const now = new Date();
      const startDate = new Date(now.getTime() + 10 * 60 * 1000);
      const endDate = new Date(now);
      endDate.setFullYear(endDate.getFullYear() + 1);

      const preapprovalBody = {
        reason: `${PRODUCT_BILLING.productName} - Plan ${planTier} — débito automático mensual${isPromo ? ' (promo lanzamiento)' : ''}`,
        external_reference: `${tenantId}_${planTier}_monthly`,
        payer_email: user.email,
        back_url: `${appBase}${PRODUCT_BILLING.basePath}${PRODUCT_BILLING.successPath}?status=subscribed`,
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: amount,
          currency_id: 'USD',
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
        },
        status: 'pending',
      };

      const mpRes = await fetch('https://api.mercadopago.com/preapproval', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(preapprovalBody),
      });
      const preapproval = await mpRes.json();

      if (!mpRes.ok) {
        app.log.error({ preapproval }, '[SUBSCRIBE] Error creando preapproval');
        return reply.code(500).send({ error: preapproval.message || 'Error creando suscripción en MercadoPago' });
      }

      app.log.info(`[SUBSCRIBE] Preapproval ${preapproval.id} creado para tenant ${tenantId} — USD ${amount}/mes`);

      return reply.send({
        preapprovalId: preapproval.id,
        initPoint: preapproval.init_point,
        amount,
        isPromo,
      });
    } catch (error: any) {
      app.log.error(error);
      return reply.code(500).send({ error: 'Error creando suscripción', details: error.message });
    }
  });

  // Webhook para recibir notificaciones de pago de MercadoPago
  app.post('/webhook/mercadopago', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = req.body as any;
      // Si el evento fue reenviado desde el otro producto, el query IPN original
      // (?topic&id) viaja dentro del body en __forwarded_query.
      const query = { ...(req.query as any), ...(body?.__forwarded_query || {}) };
      app.log.info({ body, query }, '[MP WEBHOOK] Notificación recibida');

      // Responder inmediatamente a MercadoPago (200 OK)
      reply.send({ received: true });

      // Soporte IPN (query string: ?id=...&topic=payment) Y nuevo formato (body.data.id)
      const isIPN = query?.topic === 'payment' && query?.id;
      const isNewFormat = body?.type === 'payment' && body?.data?.id;

      if (isIPN || isNewFormat) {
        const paymentId = isIPN ? query.id : body.data.id;
        const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

        if (!accessToken) {
          app.log.warn('[MP WEBHOOK] No hay access token configurado');
          return;
        }

        try {
          // Consultar estado del pago en MercadoPago
          const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          });

          if (!mpResponse.ok) {
            app.log.error(`[MP WEBHOOK] Error consultando pago ${paymentId}: ${mpResponse.status}`);
            return;
          }

          const payment = await mpResponse.json();
          app.log.info({ paymentId, status: payment.status, external_reference: payment.external_reference }, '[MP WEBHOOK] Pago consultado');

          if (payment.status !== 'approved') {
            app.log.info(`[MP WEBHOOK] Pago ${paymentId} no aprobado: ${payment.status}`);
            return;
          }

          // Extraer datos del external_reference: tenantId_planTier_period
          const externalRef = payment.external_reference || '';
          const parts = externalRef.split('_');
          if (parts.length < 3) {
            app.log.warn(`[MP WEBHOOK] External reference inválido: ${externalRef}`);
            return;
          }

          const tenantId = parts[0];
          const planTier = parts[1];
          const period = parts[2];

          app.log.info(`[MP WEBHOOK] Activando plan ${planTier} para tenant ${tenantId}, período ${period}`);

          // Una sola app de MP sirve a ambos productos: si el tenant no existe
          // en esta DB, el evento es del producto par → reenviar por red interna.
          const tenantExists = await app.prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { id: true },
          });
          if (!tenantExists) {
            await forwardWebhookToPeer(req, body, query);
            return;
          }

          await activatePaidPeriod({
            tenantId,
            planTier,
            period: period === 'annual' ? 'annual' : 'monthly',
            providerRef: String(paymentId),
            amount: payment.transaction_amount || 0,
            currency: payment.currency_id || 'USD',
          });
        } catch (procError: any) {
          app.log.error(`[MP WEBHOOK] Error procesando pago: ${procError.message}`);
        }
      }

      // ── Suscripción automática: alta/cambio del preapproval ──
      const isPreapprovalEvent =
        body?.type === 'subscription_preapproval' || body?.type === 'preapproval' ||
        query?.topic === 'preapproval' || query?.topic === 'subscription_preapproval';
      if (isPreapprovalEvent) {
        const preapprovalId = body?.data?.id || query?.id;
        const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
        if (preapprovalId && accessToken) {
          try {
            const preRes = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
              headers: { 'Authorization': `Bearer ${accessToken}` },
            });
            if (preRes.ok) {
              const preapproval = await preRes.json();
              const ext = preapproval.external_reference || '';
              const [preTenantId, prePlanTier] = ext.split('_');
              if (preTenantId) {
                const tenantExists = await app.prisma.tenant.findUnique({
                  where: { id: preTenantId },
                  select: { id: true },
                });
                if (!tenantExists) {
                  await forwardWebhookToPeer(req, body, query);
                } else {
                  // Guardar referencia para trazabilidad (no activa: se activa al primer débito)
                  try {
                    await (app.prisma as any).paymentPreference.create({
                      data: {
                        tenantId: preTenantId,
                        planTier: prePlanTier || 'PREMIUM',
                        period: 'monthly',
                        amount: preapproval.auto_recurring?.transaction_amount ?? 0,
                        currency: 'USD',
                        mpPreferenceId: String(preapprovalId),
                        status: String(preapproval.status || 'pending').toUpperCase(),
                      }
                    });
                  } catch { /* trazabilidad best-effort */ }
                  if (preapproval.status === 'cancelled' || preapproval.status === 'paused') {
                    await app.prisma.tenantSubscription.updateMany({
                      where: { tenantId: preTenantId, provider: 'mercadopago', providerRef: String(preapprovalId) },
                      data: { status: 'CANCELED' },
                    });
                    app.log.info(`[MP WEBHOOK] Preapproval ${preapprovalId} ${preapproval.status} — suscripción marcada CANCELED`);
                  } else {
                    app.log.info(`[MP WEBHOOK] Preapproval ${preapprovalId} estado ${preapproval.status} para tenant ${preTenantId}`);
                  }
                }
              }
            }
          } catch (e: any) {
            app.log.error(`[MP WEBHOOK] Error procesando preapproval: ${e.message}`);
          }
        }
      }

      // ── Suscripción automática: cada débito cobrado (authorized_payment) ──
      const isAuthorizedPayment =
        body?.type === 'subscription_authorized_payment' ||
        query?.topic === 'subscription_authorized_payment' || query?.topic === 'authorized_payment';
      if (isAuthorizedPayment) {
        const authPayId = body?.data?.id || query?.id;
        const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
        if (authPayId && accessToken) {
          try {
            const apRes = await fetch(`https://api.mercadopago.com/authorized_payments/${authPayId}`, {
              headers: { 'Authorization': `Bearer ${accessToken}` },
            });
            if (apRes.ok) {
              const ap = await apRes.json();
              app.log.info({ authPayId, status: ap.status, preapprovalId: ap.preapproval_id }, '[MP WEBHOOK] Débito automático consultado');
              if (ap.status === 'processed') {
                const preRes = await fetch(`https://api.mercadopago.com/preapproval/${ap.preapproval_id}`, {
                  headers: { 'Authorization': `Bearer ${accessToken}` },
                });
                const preapproval = preRes.ok ? await preRes.json() : {};
                const ext = preapproval.external_reference || '';
                const [apTenantId, apPlanTier, apPeriod = 'monthly'] = ext.split('_');
                if (apTenantId && apPlanTier) {
                  const tenantExists = await app.prisma.tenant.findUnique({
                    where: { id: apTenantId },
                    select: { id: true },
                  });
                  if (!tenantExists) {
                    await forwardWebhookToPeer(req, body, query);
                  } else {
                    await activatePaidPeriod({
                      tenantId: apTenantId,
                      planTier: apPlanTier,
                      period: apPeriod === 'annual' ? 'annual' : 'monthly',
                      providerRef: String(ap.id),
                      amount: ap.transaction_amount ?? ap.transaction?.amount ?? 0,
                      currency: 'USD',
                      preapprovalId: String(ap.preapproval_id),
                    });
                  }
                }
              }
            }
          } catch (e: any) {
            app.log.error(`[MP WEBHOOK] Error procesando authorized_payment: ${e.message}`);
          }
        }
      }
    } catch (error: any) {
      app.log.error(error);
      // Siempre responder 200 a MercadoPago para evitar reintentos
      if (!reply.sent) {
        return reply.send({ received: true });
      }
    }
  });
}
