// Routes para SaaS - Onboarding, Planes, Suscripciones

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

// Schemas de validación
const onboardingSchema = z.object({
  companyName: z.string().min(2),
  adminEmail: z.string().email(),
  adminName: z.string().min(2),
  adminPassword: z.string().min(8),
  employeeCount: z.number().min(1).max(10000),
  industry: z.string().optional(),
  location: z.string().optional()
});

const upgradePlanSchema = z.object({
  planId: z.string(),
  billingCycle: z.enum(['MONTHLY', 'ANNUAL']),
  addons: z.array(z.string()).optional()
});

export default async function saasRoutes(app: FastifyInstance) {
  
  // GET /api/plans - Obtener planes disponibles
  app.get('/plans', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const plans = await app.prisma.plan.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        include: {
          planFeatures: {
            where: { isEnabled: true }
          }
        }
      });

      const addons = await app.prisma.addon.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' }
      });

      return reply.send({
        plans: plans.map(plan => ({
          id: plan.id,
          name: plan.name,
          slug: plan.slug,
          description: plan.description,
          monthlyPrice: plan.monthlyPrice,
          annualPrice: plan.annualPrice,
          userLimit: plan.userLimit,
          storageLimit: plan.storageLimit,
          isPopular: plan.isPopular,
          trialDays: plan.trialDays,
          setupFee: plan.setupFee,
          features: plan.planFeatures.map(pf => ({
            key: pf.featureKey,
            name: pf.featureName,
            description: pf.description,
            limit: pf.limit
          }))
        })),
        addons: addons.map(addon => ({
          id: addon.id,
          name: addon.name,
          slug: addon.slug,
          description: addon.description,
          monthlyPrice: addon.monthlyPrice,
          annualPrice: addon.annualPrice,
          features: addon.features
        }))
      });
    } catch (error) {
      app.log.error('Error getting plans:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // POST /api/onboarding - Proceso de onboarding inicial
  app.post('/onboarding', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const validatedData = onboardingSchema.parse(request.body);

      // Verificar si el email ya existe
      const existingUser = await app.prisma.platformUser.findUnique({
        where: { email: validatedData.adminEmail }
      });

      if (existingUser) {
        return reply.code(400).send({
          error: 'EMAIL_ALREADY_EXISTS',
          message: 'Este email ya está registrado'
        });
      }

      // Crear tenant
      const tenant = await app.prisma.tenant.create({
        data: {
          name: validatedData.companyName,
          slug: generateSlug(validatedData.companyName),
          adminEmail: validatedData.adminEmail,
          adminName: validatedData.adminName,
          employeeCount: validatedData.employeeCount,
          industry: validatedData.industry,
          location: validatedData.location,
          status: 'SETUP',
          isActive: false
        }
      });

      // Crear usuario admin
      const hashedPassword = await app.bcrypt.hash(validatedData.adminPassword);
      const adminUser = await app.prisma.platformUser.create({
        data: {
          email: validatedData.adminEmail,
          passwordHash: hashedPassword,
          firstName: validatedData.adminName.split(' ')[0],
          lastName: validatedData.adminName.split(' ').slice(1).join(' '),
          globalRole: 'SUPER_ADMIN',
          tenantId: tenant.id
        }
      });

      // Crear suscripción inicial (plan Starter)
      const starterPlan = await app.prisma.plan.findFirst({
        where: { slug: 'starter' }
      });

      if (starterPlan) {
        await app.prisma.subscription.create({
          data: {
            tenantId: tenant.id,
            planId: starterPlan.id,
            status: 'TRIAL',
            startDate: new Date(),
            nextBillingDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 días
            billingCycle: 'MONTHLY',
            basePrice: starterPlan.monthlyPrice,
            totalPrice: starterPlan.monthlyPrice,
            userLimit: starterPlan.userLimit,
            storageLimit: starterPlan.storageLimit,
            currentUsers: 1
          }
        });
      }

      // Generar token JWT
      const token = app.jwt.sign({
        userId: adminUser.id,
        email: adminUser.email,
        tenantId: tenant.id
      });

      // Crear pago de setup fee
      const setupPayment = await app.mercadoPagoService.createSetupPayment(
        tenant.id,
        validatedData.adminEmail,
        400 // USD 400
      );

      return reply.send({
        success: true,
        tenant: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          status: tenant.status
        },
        user: {
          id: adminUser.id,
          email: adminUser.email,
          name: `${adminUser.firstName} ${adminUser.lastName}`
        },
        token,
        setupPayment,
        nextStep: 'PAYMENT'
      });
    } catch (error) {
      app.log.error('Error in onboarding:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // POST /api/subscription/upgrade - Actualizar plan
  app.post('/subscription/upgrade', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!request.db?.tenantId) {
        return reply.code(401).send({ error: 'Tenant context required' });
      }

      const validatedData = upgradePlanSchema.parse(request.body);
      const tenantId = request.db.tenantId;

      // Obtener tenant actual
      const tenant = await app.prisma.tenant.findUnique({
        where: { id: tenantId },
        include: {
          subscription: true
        }
      });

      if (!tenant) {
        return reply.code(404).send({ error: 'Tenant not found' });
      }

      // Obtener plan seleccionado
      const newPlan = await app.prisma.plan.findUnique({
        where: { id: validatedData.planId }
      });

      if (!newPlan) {
        return reply.code(404).send({ error: 'Plan not found' });
      }

      // Crear suscripción en MercadoPago
      const subscription = await app.mercadoPagoService[
        validatedData.billingCycle === 'ANNUAL' ? 'createAnnualSubscription' : 'createMonthlySubscription'
      ](
        validatedData.planId,
        tenantId,
        tenant.adminEmail
      );

      return reply.send({
        success: true,
        subscription,
        plan: {
          name: newPlan.name,
          billingCycle: validatedData.billingCycle,
          amount: validatedData.billingCycle === 'ANNUAL' ? newPlan.annualPrice : newPlan.monthlyPrice
        }
      });
    } catch (error) {
      app.log.error('Error upgrading subscription:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // GET /api/subscription/status - Obtener estado de suscripción
  app.get('/subscription/status', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!request.db?.tenantId) {
        return reply.code(401).send({ error: 'Tenant context required' });
      }

      const status = await app.mercadoPagoService.getSubscriptionStatus(request.db.tenantId);
      return reply.send(status);
    } catch (error) {
      app.log.error('Error getting subscription status:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // POST /api/subscription/cancel - Cancelar suscripción
  app.post('/subscription/cancel', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!request.db?.tenantId) {
        return reply.code(401).send({ error: 'Tenant context required' });
      }

      await app.mercadoPagoService.cancelSubscription(request.db.tenantId);
      
      return reply.send({ cancelled: true });
    } catch (error) {
      app.log.error('Error cancelling subscription:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // GET /api/modules/access - Obtener acceso a módulos
  app.get('/modules/access', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!request.db?.tenantId) {
        return reply.code(401).send({ error: 'Tenant context required' });
      }

      // Detectar si es SuperAdmin
      const isSuperAdmin = (request as any).auth?.globalRole === 'SUPER_ADMIN';

      const modules = await app.featureAccessService.getModuleAccess(request.db.tenantId, isSuperAdmin);
      return reply.send({ modules });
    } catch (error) {
      app.log.error('Error getting module access:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // GET /api/subscription/usage - Obtener métricas de uso
  app.get('/subscription/usage', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!request.db?.tenantId) {
        return reply.code(401).send({ error: 'Tenant context required' });
      }

      const planInfo = await app.featureAccessService.getPlanInfo(request.db.tenantId);
      
      return reply.send({
        usage: planInfo.usage,
        limits: {
          users: planInfo.plan.userLimit,
          storage: planInfo.plan.storageLimit
        },
        percentage: {
          users: (planInfo.usage.currentUsers / planInfo.plan.userLimit) * 100,
          storage: (planInfo.usage.currentStorage / planInfo.plan.storageLimit) * 100
        }
      });
    } catch (error) {
      app.log.error('Error getting usage metrics:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // POST /api/users - Crear usuarios (validar límites)
  app.post('/users', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!request.db?.tenantId) {
        return reply.code(401).send({ error: 'Tenant context required' });
      }

      const { email, firstName, lastName, role } = request.body as any;

      // Validar límite de usuarios
      const canCreateUser = await app.featureAccessService.validateUsageLimits(
        request.db.tenantId,
        'users',
        1
      );

      if (!canCreateUser) {
        return reply.code(403).send({
          error: 'USER_LIMIT_EXCEEDED',
          message: 'Has alcanzado el límite de usuarios de tu plan',
          upgradeUrl: '/plans'
        });
      }

      // Crear usuario (lógica existente)
      const user = await app.prisma.platformUser.create({
        data: {
          email,
          firstName,
          lastName,
          globalRole: role || 'USER',
          tenantId: request.db.tenantId
        }
      });

      // Actualizar contador de usuarios
      const currentCount = await app.prisma.platformUser.count({
        where: { tenantId: request.db.tenantId, isActive: true }
      });

      await app.featureAccessService.updateUsage(request.db.tenantId, 'users', currentCount);

      return reply.send({ user });
    } catch (error) {
      app.log.error('Error creating user:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // POST /webhooks/mercadopago - Webhook de MercadoPago
  app.post('/webhooks/mercadopago', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const notification = request.body as any;
      
      // Procesar notificación
      await app.mercadoPagoService.processWebhook(notification);
      
      return reply.send({ received: true });
    } catch (error) {
      app.log.error('Error processing MercadoPago webhook:', error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Helper functions
  function generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9 -]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }
}
