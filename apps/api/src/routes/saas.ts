// Routes para SaaS - Onboarding, Planes, Suscripciones

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { sendEmail, notificationEmail } from '../services/email.js';

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
      return reply.code(500).send({ error: 'Error interno del servidor' });
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
      return reply.code(500).send({ error: 'Error interno del servidor' });
    }
  });

  // POST /api/subscription/upgrade - Actualizar plan
  app.post('/subscription/upgrade', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!request.db?.tenantId) {
        return reply.code(401).send({ error: 'Se requiere contexto de tenant' });
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

      // Enviar email de notificación al admin sobre el cambio de plan
      try {
        const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || process.env.SMTP_USER || 'leonardoarielcastillo@hotmail.com';
        const appUrl = process.env.CORS_ORIGIN || 'http://localhost:3000';
        
        const currentPlan = await app.prisma.plan.findUnique({
          where: { id: tenant.subscription?.planId || '' }
        });
        
        const isUpgrade = currentPlan && newPlan.monthlyPrice > currentPlan.monthlyPrice;
        const changeType = isUpgrade ? 'Upgrade' : 'Downgrade';
        
        const emailPayload = notificationEmail({
          userEmail: adminEmail,
          title: `Solicitud de ${changeType} de Plan - SGI 360`,
          message: `Un cliente ha solicitado un cambio de plan:\n\n` +
            `<strong>Empresa:</strong> ${tenant.companyName}\n` +
            `<strong>Email:</strong> ${tenant.adminEmail}\n` +
            `<strong>Plan actual:</strong> ${currentPlan?.name || 'Sin plan'}\n` +
            `<strong>Plan solicitado:</strong> ${newPlan.name}\n` +
            `<strong>Tipo de cambio:</strong> ${changeType}\n` +
            `<strong>Ciclo de facturación:</strong> ${validatedData.billingCycle === 'ANNUAL' ? 'Anual' : 'Mensual'}\n` +
            `<strong>Monto:</strong> $${validatedData.billingCycle === 'ANNUAL' ? newPlan.annualPrice : newPlan.monthlyPrice} ARS\n\n` +
            `El cliente ha iniciado el proceso de pago en MercadoPago.`,
          actionLabel: 'Ver solicitud de cambio',
          actionUrl: `${appUrl}/admin/subscriptions`,
          type: 'info',
        });
        
        const emailResult = await sendEmail(emailPayload);
        if (emailResult.success) {
          app.log.info(`[SaaS] Email de ${changeType.toLowerCase()} enviado a ${adminEmail}`);
        } else {
          app.log.error(`[SaaS] Error enviando email de ${changeType.toLowerCase()}: ${emailResult.error}`);
        }
      } catch (emailError) {
        app.log.error(`[SaaS] Error enviando notificación de ${changeType.toLowerCase()}: ${emailError}`);
      }

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
      return reply.code(500).send({ error: 'Error interno del servidor' });
    }
  });

  // GET /api/subscription/status - Obtener estado de suscripción
  app.get('/subscription/status', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!request.db?.tenantId) {
        return reply.code(401).send({ error: 'Se requiere contexto de tenant' });
      }

      const status = await app.mercadoPagoService.getSubscriptionStatus(request.db.tenantId);
      return reply.send(status);
    } catch (error) {
      app.log.error('Error getting subscription status:', error);
      return reply.code(500).send({ error: 'Error interno del servidor' });
    }
  });

  // POST /api/subscription/cancel - Cancelar suscripción
  app.post('/subscription/cancel', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!request.db?.tenantId) {
        return reply.code(401).send({ error: 'Se requiere contexto de tenant' });
      }

      // Obtener información del tenant antes de cancelar
      const tenant = await app.prisma.tenant.findUnique({
        where: { id: request.db.tenantId },
        include: {
          subscription: {
            include: {
              plan: true
            }
          }
        }
      });

      await app.mercadoPagoService.cancelSubscription(request.db.tenantId);

      // Enviar email de notificación al admin sobre la cancelación
      if (tenant) {
        try {
          const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || process.env.SMTP_USER || 'leonardoarielcastillo@hotmail.com';
          const appUrl = process.env.CORS_ORIGIN || 'http://localhost:3000';
          
          const emailPayload = notificationEmail({
            userEmail: adminEmail,
            title: '⚠️ Cancelación de Suscripción - SGI 360',
            message: `Un cliente ha cancelado su suscripción:\n\n` +
              `<strong>Empresa:</strong> ${tenant.companyName}\n` +
              `<strong>Email:</strong> ${tenant.adminEmail}\n` +
              `<strong>Plan cancelado:</strong> ${tenant.subscription?.plan?.name || 'Sin plan'}\n` +
              `<strong>Fecha de cancelación:</strong> ${new Date().toLocaleDateString('es-AR')}\n\n` +
              `Acciones recomendadas:\n` +
              `• Contactar al cliente para entender el motivo\n` +
              `• Ofrecer alternativas o descuentos\n` +
              `• Programar seguimiento para posible reconversión`,
            actionLabel: 'Ver detalles del cliente',
            actionUrl: `${appUrl}/admin/customers/${tenant.id}`,
            type: 'warning',
          });
          
          const emailResult = await sendEmail(emailPayload);
          if (emailResult.success) {
            app.log.info(`[SaaS] Email de cancelación enviado a ${adminEmail}`);
          } else {
            app.log.error(`[SaaS] Error enviando email de cancelación: ${emailResult.error}`);
          }
        } catch (emailError) {
          app.log.error(`[SaaS] Error enviando notificación de cancelación: ${emailError}`);
        }
      }
      
      return reply.send({ cancelled: true });
    } catch (error) {
      app.log.error('Error cancelling subscription:', error);
      return reply.code(500).send({ error: 'Error interno del servidor' });
    }
  });

  // GET /api/modules/access - Obtener acceso a módulos
  app.get('/modules/access', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!request.db?.tenantId) {
        return reply.code(401).send({ error: 'Se requiere contexto de tenant' });
      }

      // Detectar si es SuperAdmin
      const isSuperAdmin = (request as any).auth?.globalRole === 'SUPER_ADMIN';

      const modules = await app.featureAccessService.getModuleAccess(request.db.tenantId, isSuperAdmin);
      return reply.send({ modules });
    } catch (error) {
      app.log.error('Error getting module access:', error);
      return reply.code(500).send({ error: 'Error interno del servidor' });
    }
  });

  // GET /api/subscription/usage - Obtener métricas de uso
  app.get('/subscription/usage', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!request.db?.tenantId) {
        return reply.code(401).send({ error: 'Se requiere contexto de tenant' });
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
      return reply.code(500).send({ error: 'Error interno del servidor' });
    }
  });

  // POST /api/users - Crear usuarios (validar límites)
  app.post('/users', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!request.db?.tenantId) {
        return reply.code(401).send({ error: 'Se requiere contexto de tenant' });
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
      return reply.code(500).send({ error: 'Error interno del servidor' });
    }
  });

  // POST /webhooks/mercadopago - Webhook de MercadoPago
  app.post('/webhooks/mercadopago', async (request: FastifyRequest, reply: FastifyReply) => {
    // Always return 200 immediately to MercadoPago
    reply.send({ received: true });
    
    try {
      const notification = request.body as any;
      await app.mercadoPagoService.processWebhook(notification);
    } catch (error) {
      app.log.error('Error processing MercadoPago webhook:', error);
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
