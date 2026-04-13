import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { MercadoPagoService } from '../services/mercadopago.js';

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

// Límites por plan
const PLAN_LIMITS = {
  BASIC: {
    maxUsers: 5,
    modules: ['dashboard', 'documents', 'ncr', 'indicators', 'risks'],
    features: ['basic_reports', 'email_notifications']
  },
  PROFESSIONAL: {
    maxUsers: 15,
    modules: ['dashboard', 'documents', 'ncr', 'indicators', 'risks', 'audits', 'trainings', 'maintenance', 'project360', 'simulacros'],
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
  audit360: { name: 'Audit360', minPlan: 'PROFESSIONAL', icon: 'ClipboardList', comingSoon: true }
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
      const tenantId = (req as any).auth?.tenantId;
      if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });

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
      const tenantId = (req as any).auth?.tenantId;
      if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });

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

      const planDescriptions = {
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

        // Usar precios por defecto (el modelo Plan no tiene metadata)
        const monthlyPrice = PLAN_PRICES.monthly[plan.tier as keyof typeof PLAN_PRICES.monthly];
        const annualPrice = PLAN_PRICES.annual[plan.tier as keyof typeof PLAN_PRICES.annual];
        const savings = Math.round((1 - annualPrice / (monthlyPrice * 12)) * 100);

        return {
          tier: plan.tier,
          name: plan.name,
          description: planDescriptions[plan.tier as keyof typeof planDescriptions],
          prices: {
            monthly: monthlyPrice,
            annual: annualPrice,
            savings: savings
          },
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
      const tenantId = (req as any).auth?.tenantId;
      if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });

      const subscription = await app.prisma.tenantSubscription.findFirst({
        where: { tenantId },
        include: { plan: true },
        orderBy: { createdAt: 'desc' }
      });

      if (!subscription) {
        return reply.code(200).send({
          hasSubscription: false,
          status: 'TRIAL',
          message: 'No active subscription',
          daysRemaining: 0
        });
      }

      // Calcular días restantes y estado de gracia
      const now = new Date();
      const endsAt = subscription.endsAt ? new Date(subscription.endsAt) : null;
      const gracePeriodDays = 5;
      
      let daysRemaining = 0;
      let graceDaysRemaining = 0;
      let isInGracePeriod = false;

      if (endsAt) {
        const diffTime = endsAt.getTime() - now.getTime();
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
        endsAt: subscription.endsAt,
        daysRemaining: Math.max(0, daysRemaining),
        isInGracePeriod,
        graceDaysRemaining,
        isExpired: daysRemaining < 0 && !isInGracePeriod,
        provider: subscription.provider
      });
    } catch (error: any) {
      app.log.error({ error }, 'message');
      return reply.code(500).send({ error: 'Failed to get subscription' });
    }
  });

  // Crear nueva suscripción
  app.post('/subscription', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = (req as any).auth?.tenantId;
      if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });

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
      const tenantId = (req as any).auth?.tenantId;
      if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });

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
      const tenantId = (req as any).auth?.tenantId;
      if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });

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
      const tenantId = (req as any).auth?.tenantId;
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
      const tenantId = (req as any).auth?.tenantId;
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
      const tenantId = (req as any).auth?.tenantId;
      if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });

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
      const tenantId = (req as any).auth?.tenantId;
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
        console.log('[/modules/access] Returning all modules for SuperAdmin');
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
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // ============================================
  // PLANES Y PAGOS (FASE 4)
  // ============================================

  // POST /create-payment - Crear preferencia de pago en MercadoPago
  app.post('/create-payment', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = (req as any).auth?.tenantId;
      if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });

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
      const tenantId = (req as any).auth?.tenantId;
      if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });

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
      const tenantId = (req as any).auth?.tenantId;
      if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });

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
      const tenantId = (req as any).auth?.tenantId;
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

      // Calcular monto
      const amount = PLAN_PRICES[period as keyof typeof PLAN_PRICES]?.[planTier as keyof (typeof PLAN_PRICES)['monthly']];
      console.log('[CHECKOUT] Monto calculado:', { amount, planTier, period });
      
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
          const preferenceData = {
            items: [{
              title: `SGI 360 - Plan ${planTier} (${period === 'monthly' ? 'Mensual' : 'Anual'})`,
              description: `Suscripción ${period === 'monthly' ? 'mensual' : 'anual'} a SGI 360 - Plan ${planTier}`,
              quantity: 1,
              currency_id: 'USD',
              unit_price: amount
            }],
            payer: {
              email: user.email,
              name: user.email.split('@')[0]
            },
            back_urls: {
              success: `${process.env.APP_URL || 'http://localhost:3000'}/licencia/planes?status=success`,
              failure: `${process.env.APP_URL || 'http://localhost:3000'}/licencia/planes?status=failure`,
              pending: `${process.env.APP_URL || 'http://localhost:3000'}/licencia/planes?status=pending`
            },
            external_reference: `${tenantId}_${planTier}_${period}_${Date.now()}`,
            statement_descriptor: "SGI360",
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

      return reply.send({
        preferenceId: checkoutResponse.preferenceId,
        initPoint: checkoutResponse.initPoint,
        sandboxInitPoint: checkoutResponse.sandboxInitPoint,
        amount,
        planTier,
        period
      });

    } catch (error: any) {
      app.log.error(error);
      return reply.code(500).send({ error: 'Error creando checkout', details: error.message });
    }
  });

  // GET /license/usage - Obtener uso de licencia
  app.get('/usage', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });

      const tenantId = req.db.tenantId;

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
      if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });

      // Historial vacío por defecto
      return reply.send({ history: [] });
    } catch (error: any) {
      return reply.code(500).send({ error: 'Error obteniendo historial' });
    }
  });

  // GET /license/payment-methods - Obtener métodos de pago
  app.get('/payment-methods', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });

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

  // Webhook para recibir notificaciones de pago
  app.post('/webhook/mercadopago', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = req.body as any;
      app.log.info({ body }, 'Webhook received');

      // Procesar pago según el tipo de notificación
      if (body.type === 'payment' && body.data?.id) {
        // Aquí procesaríamos el pago real con MercadoPago
        // Por ahora simulamos un pago exitoso

        // Crear notificación para admin
        await (app.prisma as any).adminNotification.create({
          data: {
            type: 'PAYMENT_RECEIVED',
            title: 'Nuevo pago recibido',
            message: `Pago de $${body.data?.amount || '0'} recibido. Revisa el panel para subir la factura.`,
            data: JSON.stringify(body),
            isRead: false
          }
        });
      }

      return reply.send({ success: true });
    } catch (error: any) {
      app.log.error(error);
      return reply.code(500).send({ error: 'Error procesando webhook' });
    }
  });
}
