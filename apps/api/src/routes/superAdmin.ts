import type { FastifyPluginAsync } from 'fastify';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import * as argon2 from 'argon2';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient, Prisma } from '@prisma/client';

// Extensiones de tipos no conflictivas
declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

// Cliente Prisma sin RLS para CompanyRegistration
const prismaSuperUser = new PrismaClient();

function requireSuperAdmin(req: FastifyRequest) {
  if (!(req as any).auth?.globalRole || (req as any).auth.globalRole !== 'SUPER_ADMIN') {
    const err: any = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }
}

// Precios de los planes (USD) - Sincronizado con license.ts
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

export const superAdminRoutes: FastifyPluginAsync = async (app) => {
  app.get('/plans', async (req: FastifyRequest, reply: FastifyReply) => {
    requireSuperAdmin(req);

    const plans = await app.prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { tier: 'asc' },
      select: { id: true, tier: true, name: true, features: true, limits: true, isActive: true },
    });

    // Añadir precios a la respuesta y opción "Sin plan"
    const plansWithPrices = [
      // Opción especial para nuevos clientes
      {
        id: 'no-plan',
        tier: 'NO_PLAN',
        name: 'Sin plan',
        features: {},
        limits: {},
        isActive: true,
        prices: {
          monthly: 0,
          annual: 0,
          savings: 0
        },
        description: 'Cliente sin plan - debe seleccionar un plan al ingresar'
      },
      // Planes existentes
      ...plans.map(plan => ({
        ...plan,
        prices: {
          monthly: PLAN_PRICES.monthly[plan.tier as keyof typeof PLAN_PRICES.monthly],
          annual: PLAN_PRICES.annual[plan.tier as keyof typeof PLAN_PRICES.annual],
          savings: Math.round((1 - PLAN_PRICES.annual[plan.tier as keyof typeof PLAN_PRICES.annual] / (PLAN_PRICES.monthly[plan.tier as keyof typeof PLAN_PRICES.monthly] * 12)) * 100)
        }
      }))
    ];

    return reply.send({ plans: plansWithPrices });
  });

  // ── PUT /super-admin/plans/:id — Update plan features and limits ──
  app.put('/plans/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    requireSuperAdmin(req);

    const paramsSchema = z.object({
      id: z.string().uuid(),
    });

    const bodySchema = z.object({
      name: z.string().min(1).optional(),
      isActive: z.boolean().optional(),
      features: z.record(z.boolean()).optional(),
      limits: z.record(z.number().int().nonnegative()).optional(),
    });

    const params = paramsSchema.parse(req.params);
    const body = bodySchema.parse(req.body);

    const plan = await app.prisma.plan.findUnique({
      where: { id: params.id },
    });

    if (!plan) {
      return reply.code(404).send({ error: 'Plan not found' });
    }

    const updatedPlan = await app.prisma.plan.update({
      where: { id: params.id },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
        ...(body.features && { features: body.features }),
        ...(body.limits && { limits: body.limits }),
      },
      select: { id: true, tier: true, name: true, features: true, limits: true, isActive: true },
    });

    await app.prisma.auditEvent.create({
      data: {
        action: 'PLAN_UPDATED',
        entityType: 'Plan',
        entityId: updatedPlan.id,
        metadata: { tier: updatedPlan.tier, name: updatedPlan.name },
        actorUserId: (req as any).auth?.userId,
      },
    });

    return reply.send({ plan: updatedPlan });
  });

  // ── POST /super-admin/plans/:id/prices — Update plan prices ──
  app.post('/plans/:id/prices', async (req: FastifyRequest, reply: FastifyReply) => {
    requireSuperAdmin(req);

    const paramsSchema = z.object({
      id: z.string().uuid(),
    });

    const bodySchema = z.object({
      monthly: z.number().positive(),
      annual: z.number().positive(),
    });

    const params = paramsSchema.parse(req.params);
    const body = bodySchema.parse(req.body);

    const plan = await app.prisma.plan.findUnique({
      where: { id: params.id },
    });

    if (!plan) {
      return reply.code(404).send({ error: 'Plan not found' });
    }

    // Guardar precios en metadata
    const updatedPlan = await app.prisma.plan.update({
      where: { id: params.id },
      data: {
        limits: {
          ...((plan.limits as any) || {}),
          prices: {
            monthly: body.monthly,
            annual: body.annual,
            savings: Math.round((1 - body.annual / (body.monthly * 12)) * 100)
          }
        }
      },
      select: { id: true, tier: true, name: true, features: true, limits: true, isActive: true },
    });

    await app.prisma.auditEvent.create({
      data: {
        action: 'PLAN_PRICES_UPDATED',
        entityType: 'Plan',
        entityId: updatedPlan.id,
        metadata: { tier: updatedPlan.tier, name: updatedPlan.name, prices: updatedPlan.limits },
        actorUserId: (req as any).auth?.userId,
      },
    });

    return reply.send({
      success: true,
      plan: {
        ...updatedPlan,
        prices: ((updatedPlan.limits as any)?.prices) || {
          monthly: PLAN_PRICES.monthly[updatedPlan.tier as keyof typeof PLAN_PRICES.monthly],
          annual: PLAN_PRICES.annual[updatedPlan.tier as keyof typeof PLAN_PRICES.annual]
        }
      }
    });
  });

  // ── GET /superAdmin/tenants — List all tenants with subscription info ──
  app.get('/tenants', async (req: FastifyRequest, reply: FastifyReply) => {
    requireSuperAdmin(req);

    const tenants = await app.prisma.tenant.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        subscriptions: {
          where: { deletedAt: null },
          orderBy: { startedAt: 'desc' },
          take: 1,
          include: { plan: { select: { id: true, tier: true, name: true } } },
        },
        memberships: {
          where: { deletedAt: null, role: 'TENANT_ADMIN', status: 'ACTIVE' },
          include: { user: { select: { id: true, email: true } } },
          take: 5,
        },
        _count: { select: { memberships: { where: { deletedAt: null } } } },
      },
    });

    const result = tenants.map(t => {
      const subscription = t.subscriptions[0];
      let transformedSubscription = null;
      
      if (subscription) {
        // Si providerRef es NO_PLAN, devolver un plan ficticio
        if (subscription.providerRef === 'NO_PLAN') {
          transformedSubscription = {
            ...subscription,
            plan: {
              id: 'no-plan',
              tier: 'NO_PLAN',
              name: 'Sin plan'
            }
          };
        } else {
          transformedSubscription = subscription;
        }
      }
      
      return {
        id: t.id,
        name: t.name,
        slug: t.slug,
        status: t.status,
        createdAt: t.createdAt,
        memberCount: t._count.memberships,
        admins: (t.memberships || []).map((m: any) => ({ id: m.user.id, email: m.user.email })),
        subscription: transformedSubscription,
      };
    });

    return reply.send({ tenants: result });
  });

  app.post('/bootstrap', async (req: FastifyRequest, reply: FastifyReply) => {
    const bodySchema = z.object({
      email: z.string().email(),
      password: z.string().min(12),
    });

    const body = bodySchema.parse(req.body);

    const existing = await app.prisma.platformUser.findUnique({ where: { email: body.email } });
    if (existing) return reply.code(409).send({ error: 'User already exists' });

    const passwordHash = await argon2.hash(body.password);

    const user = await app.prisma.platformUser.create({
      data: {
        email: body.email,
        passwordHash,
        globalRole: 'SUPER_ADMIN',
      },
      select: { id: true, email: true, globalRole: true },
    });

    // Get memberships to include tenant in token
    const memberships = await app.prisma.tenantMembership.findMany({
      where: { userId: user.id, status: 'ACTIVE', deletedAt: null, tenant: { deletedAt: null } },
      include: { tenant: true },
      orderBy: { createdAt: 'asc' },
    });
    
    let activeTenant = null;
    let tenantRole = null;
    
    if (memberships.length > 0) {
      activeTenant = { id: memberships[0].tenant.id, name: memberships[0].tenant.name, slug: memberships[0].tenant.slug };
      tenantRole = memberships[0].role;
    }

    const token = (app as any).signAccessToken({ 
      userId: user.id, 
      globalRole: 'SUPER_ADMIN',
      ...(activeTenant && { tenantId: activeTenant.id, tenantRole })
    });
    return reply.code(201).send({ user, token, activeTenant, tenantRole });
  });

  app.post('/tenants', async (req: FastifyRequest, reply: FastifyReply) => {
    requireSuperAdmin(req);

    const bodySchema = z.object({
      name: z.string().min(2),
      slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
    });

    const body = bodySchema.parse(req.body);

    const tenant = await app.prisma.tenant.create({
      data: {
        name: body.name,
        slug: body.slug,
      },
    });

    await app.prisma.auditEvent.create({
      data: {
        action: 'TENANT_CREATED',
        entityType: 'Tenant',
        entityId: tenant.id,
        metadata: { slug: tenant.slug },
      },
    });

    return reply.code(201).send({ tenant });
  });

  app.post('/tenants/:tenantId/admin', async (req: FastifyRequest, reply: FastifyReply) => {
    requireSuperAdmin(req);

    const paramsSchema = z.object({
      tenantId: z.string().uuid(),
    });
    const bodySchema = z.object({
      email: z.string().email(),
      password: z.string().min(12),
    });

    const params = paramsSchema.parse(req.params);
    const body = bodySchema.parse(req.body);

    const tenant = await app.prisma.tenant.findUnique({ where: { id: params.tenantId } });
    if (!tenant) return reply.code(404).send({ error: 'Tenant not found' });

    // Verificar si el usuario ya existe
    let user = await app.prisma.platformUser.findUnique({ where: { email: body.email } });
    
    if (!user) {
      // Crear nuevo usuario si no existe
      const passwordHash = await argon2.hash(body.password);
      user = await app.prisma.platformUser.create({
        data: {
          email: body.email,
          passwordHash,
          isActive: true,
        },
      });
    } else {
      // Usuario existe, verificar si ya tiene membresía en este tenant
      const existingMembership = await app.prisma.tenantMembership.findFirst({
        where: { 
          userId: user.id, 
          tenantId: params.tenantId 
        },
      });
      
      if (existingMembership) {
        return reply.code(409).send({ 
          error: 'User already has membership in this tenant',
          message: `El usuario ${body.email} ya es miembro de este tenant.`,
          currentRole: existingMembership.role,
          currentStatus: existingMembership.status,
          userId: user.id,
          membershipId: existingMembership.id
        });
      }
      
      // Si el usuario existe pero no tiene membresía en este tenant, 
      // lo agregamos directamente (no necesitamos crear usuario nuevo)
      app.log.info(`[SUPERADMIN] Adding existing user ${body.email} as admin to tenant ${tenant.name}`);
    }

    const membership = await app.prisma.tenantMembership.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        role: 'TENANT_ADMIN',
        status: 'ACTIVE',
      },
      select: { id: true, tenantId: true, userId: true, role: true, status: true },
    });

    await app.prisma.auditEvent.create({
      data: {
        tenantId: tenant.id,
        action: 'TENANT_ADMIN_CREATED',
        entityType: 'TenantMembership',
        entityId: membership.id,
        metadata: { userId: user.id, email: user.email },
      },
    });

    return reply.code(201).send({ user, membership });
  });

  app.put('/tenants/:tenantId/subscription', async (req: FastifyRequest, reply: FastifyReply) => {
    requireSuperAdmin(req);

    const { tenantId } = req.params as { tenantId: string };
    const { planTier, status, period = 'monthly' } = req.body as { planTier: string; status: string; period?: string };

    try {
      console.log(`[API] Actualizando ${tenantId}: ${planTier} - ${status}`);

      // Obtener tenant
      const tenant = await app.prisma.tenant.findUnique({
        where: { id: tenantId }
      });
      if (!tenant) {
        return reply.code(404).send({ error: 'Tenant no encontrado' });
      }

      // Obtener plan
      let plan = null;
      if (planTier !== 'NO_PLAN') {
        plan = await app.prisma.plan.findUnique({ where: { tier: planTier as any } });
        if (!plan) {
          return reply.code(400).send({ error: 'Plan no encontrado' });
        }
      } else {
        // Para NO_PLAN usamos BASIC como referencia
        plan = await app.prisma.plan.findUnique({ where: { tier: 'BASIC' } });
      }

      // Obtener suscripción existente
      const existing = await app.prisma.tenantSubscription.findFirst({
        where: { tenantId, deletedAt: null },
        orderBy: { startedAt: 'desc' }
      });

      console.log(`[API] Suscripción existente:`, existing?.id);

      // Calcular fechas
      const now = new Date();
      const startDate = now;
      let endDate = new Date(now);
      
      if (period === 'monthly') {
        endDate.setMonth(endDate.getMonth() + 1);
      } else {
        endDate.setFullYear(endDate.getFullYear() + 1);
      }

      // Crear o actualizar suscripción
      let subscription;
      if (existing) {
        // Actualizar suscripción existente
        subscription = await app.prisma.tenantSubscription.update({
          where: { id: existing.id },
          data: {
            planId: plan?.id || '',
            status: planTier === 'NO_PLAN' ? 'ACTIVE' : 'ACTIVE',
            providerRef: planTier === 'NO_PLAN' ? 'NO_PLAN' : null,
            startedAt: startDate,
            endsAt: endDate
          }
        });
      } else {
        // Crear nueva suscripción
        subscription = await app.prisma.tenantSubscription.create({
          data: {
            tenantId,
            planId: plan?.id || '',
            status: 'ACTIVE',
            providerRef: planTier === 'NO_PLAN' ? 'NO_PLAN' : null,
            startedAt: startDate,
            endsAt: endDate
          }
        });
      }

      // Actualizar tenant (no tiene planTier ni subscriptionStatus en el modelo)
      // El plan se asocia a través de la suscripción
      
      console.log(`[API] Suscripción actualizada:`, subscription.id);

      return reply.send({
        success: true,
        subscription: {
          id: subscription.id,
          planTier: plan?.tier || 'NO_PLAN',
          status: subscription.status,
          startDate: subscription.startedAt,
          endDate: subscription.endsAt
        }
      });
    } catch (error) {
      console.error(`[API] Error:`, error);
      return reply.code(500).send({ error: String(error) });
    }
  });


  // ── GET /super-admin/mercadopago-config — Get MercadoPago configuration ──
  app.get('/mercadopago-config', async (req: FastifyRequest, reply: FastifyReply) => {
    requireSuperAdmin(req);

    try {
      const configPath = path.join(process.cwd(), '.mercadopago.json');

      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        // No retornar el token completo por seguridad, solo indicar que está configurado
        return reply.send({
          configured: true,
          accessTokenSet: !!config.accessToken,
          publicKey: config.publicKey || null,
          userId: config.userId || null,
        });
      }

      return reply.send({
        configured: false,
        accessTokenSet: false,
        publicKey: null,
        userId: null,
      });
    } catch (error) {
      app.log.error('Error reading MercadoPago config: ' + String(error));
      return reply.code(500).send({ error: 'Failed to read configuration' });
    }
  });

  // ── PUT /super-admin/mercadopago-config — Save MercadoPago configuration ──
  app.put('/mercadopago-config', async (req: FastifyRequest, reply: FastifyReply) => {
    requireSuperAdmin(req);

    const bodySchema = z.object({
      accessToken: z.string().min(1),
      publicKey: z.string().min(1),
      userId: z.string().min(1),
    });

    try {
      const body = bodySchema.parse(req.body);

      const configPath = path.join(process.cwd(), '.mercadopago.json');
      const config = {
        accessToken: body.accessToken,
        publicKey: body.publicKey,
        userId: body.userId,
        updatedAt: new Date().toISOString(),
      };

      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');

      app.log.info('MercadoPago configuration updated');

      // Log para auditoría (sin guardar el token)
      await app.prisma.auditEvent.create({
        data: {
          action: 'MERCADOPAGO_CONFIG_UPDATED',
          entityType: 'SystemConfig',
          entityId: 'mercadopago',
          metadata: {
            publicKey: body.publicKey,
            userId: body.userId,
          },
          actorUserId: (req as any).auth?.userId,
        },
      });

      return reply.send({
        success: true,
        message: 'Configuración de MercadoPago guardada correctamente',
      });
    } catch (error: any) {
      app.log.error('Error saving MercadoPago config: ' + String(error));
      if (error.issues) {
        return reply.code(400).send({ error: 'Datos inválidos', details: error.issues });
      }
      return reply.code(500).send({ error: 'Failed to save configuration' });
    }
  });

  // ── GET /super-admin/mercadopago-config/public — Get public config (para el frontend) ──
  app.get('/mercadopago-config/public', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const configPath = path.join(process.cwd(), '.mercadopago.json');

      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        // Solo retornar lo que el frontend necesita (Public Key)
        return reply.send({
          publicKey: config.publicKey || null,
          configured: !!config.publicKey,
        });
      }

      return reply.send({
        publicKey: null,
        configured: false,
      });
    } catch (error) {
      app.log.error('Error reading public MercadoPago config: ' + String(error));
      return reply.send({
        publicKey: null,
        configured: false,
      });
    }
  });

  // ── GET /super-admin/company-registrations — Get pending company registrations ──
  app.get('/company-registrations', async (req: FastifyRequest, reply: FastifyReply) => {
    requireSuperAdmin(req);

    try {
      app.log.info('[SUPERADMIN] Consultando registros de empresas...');

      const registrations = await prismaSuperUser.companyRegistration.findMany({
        orderBy: { createdAt: 'desc' },
      });

      app.log.info(`[SUPERADMIN] Registros encontrados: ${registrations.length}`);

      return reply.send({
        registrations: registrations || []
      });
    } catch (error) {
      app.log.error('[SUPERADMIN] Error reading registrations: ' + String(error));
      return reply.code(500).send({
        error: 'Error al obtener solicitudes',
        registrations: []
      });
    }
  });

  // ── GET /super-admin/company-registrations/formats — Test different response formats ──
  app.get('/company-registrations/formats', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const registrations = await prismaSuperUser.companyRegistration.findMany({
        orderBy: { createdAt: 'desc' },
      });

      const formats = {
        format1_directArray: registrations, // Array directo
        format2_wrappedData: { data: registrations }, // Objeto con data
        format3_wrappedItems: { items: registrations }, // Objeto con items
        format4_wrappedRegistrations: { registrations }, // Objeto con registrations
        format5_withMeta: { 
          data: registrations,
          total: registrations.length,
          success: true
        }, // Con metadata
      };

      return reply.send({
        message: 'Test different response formats',
        formats: formats,
        instructions: 'Replace the main endpoint response with the format that works'
      });
    } catch (error) {
      return reply.code(500).send({ error: 'Error', details: String(error) });
    }
  });

  // ── GET /super-admin/company-registrations/test — Test endpoint to create sample data ──
  app.get('/company-registrations/test', async (req: FastifyRequest, reply: FastifyReply) => {
    requireSuperAdmin(req);

    try {
      app.log.info('[SUPERADMIN] Creando datos de prueba para company registrations...');
      
      // Check if data already exists
      const existingCount = await prismaSuperUser.companyRegistration.count();
      if (existingCount > 0) {
        return reply.send({ 
          message: `Ya existen ${existingCount} registros. Mostrando datos existentes.`,
          existing: await prismaSuperUser.companyRegistration.findMany({
            orderBy: { createdAt: 'desc' },
            take: 5
          })
        });
      }

      // Create sample data
      const sampleRegistrations = [
        {
          companyName: 'Empresa ABC S.A.',
          socialReason: 'ABC Sociedad Anónima',
          rut: '76.123.456-7',
          email: 'contacto@empresaabc.cl',
          phone: '+56 2 2345 6789',
          website: 'https://empresaabc.cl',
          address: 'Av. Providencia 1234, Santiago, Chile',
          primaryColor: '#3B82F6',
          module: 'sgi360',
          status: 'PENDING',
          notes: 'Empresa interesada en plan PROFESSIONAL'
        },
        {
          companyName: 'Tech Solutions Ltda.',
          socialReason: 'Tech Solutions Limitada',
          rut: '77.987.654-3',
          email: 'info@techsolutions.cl',
          phone: '+56 9 8765 4321',
          website: 'https://techsolutions.cl',
          address: 'Calle Las Condes 567, Santiago, Chile',
          primaryColor: '#10B981',
          module: 'sgi360',
          status: 'APPROVED',
          tenantId: '550e8400-e29b-41d4-a716-446655440000',
          approvedBy: 'admin-user-id',
          approvedAt: new Date(),
          notes: 'Aprobada para plan BASIC'
        },
        {
          companyName: 'Innovate Startup SpA',
          socialReason: 'Innovate Startup Sociedad por Acciones',
          rut: '78.456.123-9',
          email: 'hola@innovate.cl',
          phone: '+56 2 3456 7890',
          website: 'https://innovate.cl',
          address: 'Cerro Santa Lucía 890, Santiago, Chile',
          primaryColor: '#F59E0B',
          module: 'sgi360',
          status: 'REJECTED',
          notes: 'No cumple con requisitos mínimos'
        }
      ];

      const created = await prismaSuperUser.companyRegistration.createMany({
        data: sampleRegistrations
      });

      app.log.info(`[SUPERADMIN] Creados ${created.count} registros de prueba`);

      // Return the created data
      const allRegistrations = await prismaSuperUser.companyRegistration.findMany({
        orderBy: { createdAt: 'desc' }
      });

      return reply.send({ 
        message: `Creados ${created.count} registros de prueba`,
        total: allRegistrations.length,
        registrations: allRegistrations
      });
    } catch (error) {
      app.log.error('[SUPERADMIN] Error creating test data: ' + String(error));
      return reply.code(500).send({ error: 'Error al crear datos de prueba' });
    }
  });

  // ── GET /super-admin/company-registrations/public — Public endpoint without auth for testing ──
  app.get('/company-registrations/public', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      app.log.info('[PUBLIC] Consultando registros de empresas sin autenticación...');
      
      const registrations = await prismaSuperUser.companyRegistration.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          companyName: true,
          socialReason: true,
          rut: true,
          email: true,
          phone: true,
          website: true,
          address: true,
          primaryColor: true,
          status: true,
          notes: true,
          createdAt: true,
          updatedAt: true,
          approvedAt: true,
          tenantId: true
        }
      });
      
      app.log.info(`[PUBLIC] Registros encontrados: ${registrations.length}`);

      return reply.send({ 
        message: `Found ${registrations.length} registrations`,
        registrations: registrations 
      });
    } catch (error) {
      app.log.error('[PUBLIC] Error reading registrations: ' + String(error));
      return reply.code(500).send({ error: 'Error al obtener registros', details: String(error) });
    }
  });

  // ── GET /super-admin/company-registrations/:id — Get single registration ──
  app.get('/company-registrations/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    requireSuperAdmin(req);

    try {
      const { id } = req.params as { id: string };
      
      const registration = await prismaSuperUser.companyRegistration.findUnique({
        where: { id },
      });

      if (!registration) {
        return reply.code(404).send({ error: 'Solicitud no encontrada' });
      }

      return reply.send({ registration });
    } catch (error) {
      app.log.error('Error reading registration: ' + String(error));
      return reply.code(500).send({ error: 'Error al obtener solicitud' });
    }
  });

  // ── PUT /super-admin/tenants/:id/suspend — Suspend tenant ──
  app.put('/tenants/:id/suspend', async (req: FastifyRequest, reply: FastifyReply) => {
    requireSuperAdmin(req);

    try {
      const { id } = req.params as { id: string };
      const { reason } = req.body as { reason?: string };

      const tenant = await app.prisma.tenant.findUnique({
        where: { id }
      });

      if (!tenant) {
        return reply.code(404).send({ error: 'Tenant no encontrado' });
      }

      const updatedTenant = await app.prisma.tenant.update({
        where: { id },
        data: { 
          status: 'SUSPENDED',
          updatedAt: new Date()
        }
      });

      // Suspender todas las membresías del tenant
      await (app.prisma as any).tenantMembership.updateMany({
        where: { tenantId: id },
        data: { status: 'SUSPENDED' }
      });

      // Suspender suscripciones
      await (app.prisma as any).tenantSubscription.updateMany({
        where: { tenantId: id },
        data: { status: 'CANCELED' }
      });

      app.log.info(`[SUPERADMIN] Tenant suspendido: ${tenant.name} - Razón: ${reason || 'No especificada'}`);

      return reply.send({
        success: true,
        message: `Tenant "${tenant.name}" suspendido correctamente`,
        tenant: updatedTenant,
        reason: reason || 'No especificada'
      });
    } catch (error: any) {
      app.log.error({ error }, 'Error suspending tenant');
      return reply.code(500).send({ error: 'Error suspendiendo tenant: ' + (error.message || 'Error desconocido') });
    }
  });

  // ── PUT /super-admin/tenants/:id/reactivate — Reactivate tenant ──
  app.put('/tenants/:id/reactivate', async (req: FastifyRequest, reply: FastifyReply) => {
    requireSuperAdmin(req);

    try {
      const { id } = req.params as { id: string };

      const tenant = await app.prisma.tenant.findUnique({
        where: { id }
      });

      if (!tenant) {
        return reply.code(404).send({ error: 'Tenant no encontrado' });
      }

      const updatedTenant = await app.prisma.tenant.update({
        where: { id },
        data: { 
          status: 'ACTIVE',
          updatedAt: new Date()
        }
      });

      // Reactivar todas las membresías del tenant
      await (app.prisma as any).tenantMembership.updateMany({
        where: { tenantId: id },
        data: { status: 'ACTIVE' }
      });

      // Si tenía suscripción cancelada, reactivarla a trial
      await (app.prisma as any).tenantSubscription.updateMany({
        where: { tenantId: id, status: 'CANCELED' },
        data: { status: 'TRIAL' }
      });

      app.log.info(`[SUPERADMIN] Tenant reactivado: ${tenant.name}`);

      return reply.send({
        success: true,
        message: `Tenant "${tenant.name}" reactivado correctamente`,
        tenant: updatedTenant
      });
    } catch (error: any) {
      app.log.error({ error }, 'Error reactivating tenant');
      return reply.code(500).send({ error: 'Error reactivando tenant: ' + (error.message || 'Error desconocido') });
    }
  });

  // ── DELETE /super-admin/tenants/:id — Delete tenant ──
  app.delete('/tenants/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    requireSuperAdmin(req);

    try {
      const { id } = req.params as { id: string };

      // Verificar que el tenant existe y obtener conteos
      const tenant = await (app.prisma as any).tenant.findUnique({
        where: { id },
        include: {
          memberships: {
            select: { id: true }
          },
          subscriptions: {
            select: { id: true }
          },
          features: {
            select: { id: true }
          },
          tenantSetup: {
            select: { id: true }
          }
        }
      });

      if (!tenant) {
        return reply.code(404).send({ error: 'Tenant no encontrado' });
      }

      const userCount = tenant.memberships?.length || 0;
      const subscriptionCount = tenant.subscriptions?.length || 0;

      // Eliminar relaciones en orden correcto (de las más dependientes a las menos)
      
      // 1. Eliminar tenant setup si existe
      if (tenant.tenantSetup) {
        await (app.prisma as any).tenantSetup.delete({
          where: { tenantId: id }
        });
      }

      // 2. Eliminar datos relacionados con SGI (departamentos, empleados, etc.)
      await (app.prisma as any).department.deleteMany({
        where: { tenantId: id }
      });

      await (app.prisma as any).employee.deleteMany({
        where: { tenantId: id }
      });

      await (app.prisma as any).position.deleteMany({
        where: { tenantId: id }
      });

      // 3. Eliminar documentos y normativas
      await (app.prisma as any).document.deleteMany({
        where: { tenantId: id }
      });

      await (app.prisma as any).normativeStandard.deleteMany({
        where: { tenantId: id }
      });

      // 4. Eliminar hallazgos y auditorías
      await (app.prisma as any).aiFinding.deleteMany({
        where: { tenantId: id }
      });

      await (app.prisma as any).auditRun.deleteMany({
        where: { tenantId: id }
      });

      await (app.prisma as any).auditEvent.deleteMany({
        where: { tenantId: id }
      });

      // 5. Eliminar riesgos, no conformidades, indicadores
      await (app.prisma as any).risk.deleteMany({
        where: { tenantId: id }
      });

      await (app.prisma as any).nonConformity.deleteMany({
        where: { tenantId: id }
      });

      await (app.prisma as any).indicator.deleteMany({
        where: { tenantId: id }
      });

      await (app.prisma as any).indicatorRiskLink.deleteMany({
        where: { tenantId: id }
      });

      // 6. Eliminar planes de contingencia y recursos
      await (app.prisma as any).drillScenario.deleteMany({
        where: { tenantId: id }
      });

      await (app.prisma as any).contingencyPlan.deleteMany({
        where: { tenantId: id }
      });

      await (app.prisma as any).emergencyResource.deleteMany({
        where: { tenantId: id }
      });

      // 7. Eliminar mantenimiento
      await (app.prisma as any).maintenanceAsset.deleteMany({
        where: { tenantId: id }
      });

      await (app.prisma as any).maintenanceTechnician.deleteMany({
        where: { tenantId: id }
      });

      await (app.prisma as any).maintenancePlan.deleteMany({
        where: { tenantId: id }
      });

      await (app.prisma as any).maintenanceSparePart.deleteMany({
        where: { tenantId: id }
      });

      await (app.prisma as any).workOrder.deleteMany({
        where: { tenantId: id }
      });

      await (app.prisma as any).maintenanceCost.deleteMany({
        where: { tenantId: id }
      });

      // 8. Eliminar clientes y encuestas
      await (app.prisma as any).customer.deleteMany({
        where: { tenantId: id }
      });

      await (app.prisma as any).survey.deleteMany({
        where: { tenantId: id }
      });

      // 9. Eliminar notificaciones y webhooks
      await (app.prisma as any).notification.deleteMany({
        where: { tenantId: id }
      });

      await (app.prisma as any).webhookConfig.deleteMany({
        where: { tenantId: id }
      });

      // 10. Eliminar entrenamientos
      await (app.prisma as any).sgiTraining.deleteMany({
        where: { tenantId: id }
      });

      await (app.prisma as any).training.deleteMany({
        where: { tenantId: id }
      });

      // 11. Eliminar licencias y pagos
      await (app.prisma as any).licenseAccessAttempt.deleteMany({
        where: { tenantId: id }
      });

      await (app.prisma as any).licenseNotification.deleteMany({
        where: { tenantId: id }
      });

      await (app.prisma as any).payment.deleteMany({
        where: { tenantId: id }
      });

      // await (app.prisma as any).invoice.deleteMany({
      //   where: { tenantId: id }
      // });

      // await (app.prisma as any).paymentPreference.deleteMany({
      //   where: { tenantId: id }
      // });

      // 12. Eliminar tenant features
      await (app.prisma as any).tenantFeature.deleteMany({
        where: { tenantId: id }
      });

      // 13. Eliminar tenant subscriptions
      await (app.prisma as any).tenantSubscription.deleteMany({
        where: { tenantId: id }
      });

      // 14. Eliminar tenant memberships
      await (app.prisma as any).tenantMembership.deleteMany({
        where: { tenantId: id }
      });

      // 15. Finalmente eliminar el tenant
      await app.prisma.tenant.delete({
        where: { id }
      });

      app.log.info(`[SUPERADMIN] Tenant eliminado: ${tenant.name} (${tenant.slug})`);

      return reply.send({
        success: true,
        message: `Tenant "${tenant.name}" eliminado correctamente`,
        deletedTenant: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          userCount,
          subscriptionCount
        }
      });
    } catch (error: any) {
      app.log.error({ error }, 'Error deleting tenant');
      return reply.code(500).send({ error: 'Error eliminando tenant: ' + (error.message || 'Error desconocido') });
    }
  });

  // ── POST /super-admin/company-registrations/:id/approve — Approve and create tenant ──
  app.post('/company-registrations/:id/approve', async (req: FastifyRequest, reply: FastifyReply) => {
    requireSuperAdmin(req);

    try {
      const { id } = req.params as { id: string };
      const { customEmail, customPassword } = req.body as { 
        customEmail?: string; 
        customPassword?: string; 
      };

      // Buscar solicitud en la base de datos
      const registration = await prismaSuperUser.companyRegistration.findUnique({
        where: { id },
      });

      if (!registration) {
        return reply.code(404).send({ error: 'Solicitud no encontrada' });
      }

      if (registration.status !== 'PENDING') {
        return reply.code(400).send({ error: 'La solicitud ya fue procesada' });
      }

      // Crear Tenant
      const baseSlug = registration.companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const uniqueSlug = `${baseSlug}-${Date.now().toString(36).slice(-4)}`;
      
      const tenant = await app.prisma.tenant.create({
        data: {
          name: registration.companyName,
          slug: uniqueSlug,
        },
      });

      // Usar email y contraseña personalizados o los por defecto
      const email = customEmail || registration.email;
      const tempPassword = customPassword || 'TempPassword123!';
      const hashedPassword = await argon2.hash(tempPassword);
      
      // Verificar si el usuario ya existe
      let user = await app.prisma.platformUser.findUnique({
        where: { email },
      });
      
      if (!user) {
        // Crear nuevo usuario
        user = await app.prisma.platformUser.create({
          data: {
            email,
            passwordHash: hashedPassword,
            isActive: true,
          },
        });
        
        // Guardar en historial de contraseñas
        await (app.prisma as any).passwordHistory.create({
          data: {
            userId: user.id,
            passwordHash: hashedPassword,
            changeType: 'INITIAL',
            changedBy: (req as any).auth?.userId,
            reason: customEmail ? 'Cuenta creada con email personalizado durante aprobación' : 'Cuenta creada con email de registro durante aprobación',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
          },
        });
      } else {
        // Actualizar contraseña existente
        await app.prisma.platformUser.update({
          where: { id: user.id },
          data: { passwordHash: hashedPassword },
        });
        
        // Guardar en historial de contraseñas
        await (app.prisma as any).passwordHistory.create({
          data: {
            userId: user.id,
            passwordHash: hashedPassword,
            changeType: 'ADMIN_RESET',
            changedBy: (req as any).auth?.userId,
            reason: customPassword ? 'Contraseña personalizada reseteada durante aprobación' : 'Contraseña temporal reseteada durante aprobación',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
          },
        });
      }
      
      // Verificar si ya tiene membership en este tenant
      const existingMembership = await app.prisma.tenantMembership.findFirst({
        where: { userId: user.id, tenantId: tenant.id },
      });
      
      if (!existingMembership) {
        // Crear membership
        await app.prisma.tenantMembership.create({
          data: {
            userId: user.id,
            tenantId: tenant.id,
            role: 'TENANT_ADMIN',
          },
        });
      }

      // Crear suscripción inicial con plan BASIC
      const basicPlan = await app.prisma.plan.findFirst({
        where: { tier: 'BASIC' },
      });

      if (basicPlan) {
        await app.prisma.tenantSubscription.create({
          data: {
            tenantId: tenant.id,
            planId: basicPlan.id,
            status: 'ACTIVE',
            startedAt: new Date(),
          },
        });
      }

      // Actualizar estado de la solicitud
      await prismaSuperUser.companyRegistration.update({
        where: { id },
        data: {
          status: 'APPROVED',
          tenantId: tenant.id,
          approvedBy: (req as any).auth?.userId,
          approvedAt: new Date(),
        },
      });

      app.log.info(`Company approved: ${registration.companyName}, User: ${user.email}`);

      return reply.send({
        success: true,
        message: 'Empresa aprobada y usuario creado',
        tenant,
        user: {
          email: user.email,
          tempPassword: tempPassword, // Contraseña temporal visible
          loginUrl: `/${tenant.slug}/login`, // URL de acceso
          instructions: {
            step1: 'Ir a la URL de inicio de sesión',
            step2: 'Usar el email y contraseña temporal proporcionados',
            step3: 'Cambiar la contraseña inmediatamente después del primer ingreso',
            step4: 'Completar el setup inicial de la empresa'
          }
        },
        accessCredentials: {
          email: user.email,
          password: tempPassword,
          tenantSlug: tenant.slug,
          loginUrl: `/${tenant.slug}/login`,
          expiresIn: '7 días (recomendado cambiar antes)'
        }
      });
    } catch (error: any) {
      app.log.error({ error }, 'Error approving registration');
      return reply.code(500).send({ error: 'Error procesando aprobación' });
    }
  });

  // ── GET /super-admin/users/:userId/password-history — Ver historial de contraseñas ──
  app.get('/users/:userId/password-history', async (req: FastifyRequest, reply: FastifyReply) => {
    requireSuperAdmin(req);

    try {
      const { userId } = req.params as { userId: string };

      const passwordHistory = await (app.prisma as any).passwordHistory.findMany({
        where: { userId },
        include: {
          changedByUser: {
            select: { email: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 20 // Últimos 20 cambios
      });

      return reply.send({ 
        passwordHistory: passwordHistory.map((entry: any) => ({
          id: entry.id,
          changeType: entry.changeType,
          reason: entry.reason,
          changedBy: entry.changedByUser?.email || 'System',
          ipAddress: entry.ipAddress,
          createdAt: entry.createdAt
        }))
      });
    } catch (error: any) {
      app.log.error({ error }, 'Error getting password history');
      return reply.code(500).send({ error: 'Error obteniendo historial de contraseñas' });
    }
  });

  // ── POST /super-admin/company-registrations/:id/reject — Reject registration ──
  app.post('/company-registrations/:id/reject', async (req: FastifyRequest, reply: FastifyReply) => {
    requireSuperAdmin(req);

    try {
      const { id } = req.params as { id: string };
      const { reason } = req.body as { reason?: string };

      // Buscar solicitud
      const registration = await prismaSuperUser.companyRegistration.findUnique({
        where: { id },
      });

      if (!registration) {
        return reply.code(404).send({ error: 'Solicitud no encontrada' });
      }

      if (registration.status !== 'PENDING') {
        return reply.code(400).send({ error: 'La solicitud ya fue procesada' });
      }

      // Actualizar estado
      await prismaSuperUser.companyRegistration.update({
        where: { id },
        data: {
          status: 'REJECTED',
          notes: reason || 'Solicitud rechazada',
        },
      });

      return reply.send({
        success: true,
        message: 'Registro rechazado',
      });
    } catch (error) {
      app.log.error('Error rejecting registration: ' + String(error));
      return reply.code(500).send({ error: 'Error rechazando solicitud' });
    }
  });

  // DELETE - Eliminar solicitud de registro
  app.delete('/company-registrations/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    requireSuperAdmin(req);

    try {
      const { id } = req.params as { id: string };

      // Verificar que existe
      const registration = await prismaSuperUser.companyRegistration.findUnique({
        where: { id },
      });

      if (!registration) {
        return reply.code(404).send({ error: 'Solicitud no encontrada' });
      }

      // Eliminar
      await prismaSuperUser.companyRegistration.delete({
        where: { id },
      });

      app.log.info(`[SUPERADMIN] Solicitud ${id} eliminada por ${(req as any).auth?.user?.email}`);

      return reply.send({
        success: true,
        message: 'Solicitud eliminada correctamente',
      });
    } catch (error) {
      app.log.error('Error deleting registration: ' + String(error));
      return reply.code(500).send({ error: 'Error eliminando solicitud' });
    }
  });

  // ── GET /super-admin/notifications — Get admin notifications ──
  app.get('/notifications', async (req: FastifyRequest, reply: FastifyReply) => {
    requireSuperAdmin(req);

    try {
      const notifications = await (app.prisma as any).adminNotification.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50, // Últimas 50 notificaciones
      });

      return reply.send({ notifications });
    } catch (error) {
      app.log.error('Error getting notifications: ' + String(error));
      return reply.code(500).send({ error: 'Error obteniendo notificaciones' });
    }
  });

  // ── POST /super-admin/notifications/:id/read — Mark notification as read ──
  app.post('/notifications/:id/read', async (req: FastifyRequest, reply: FastifyReply) => {
    requireSuperAdmin(req);

    try {
      const { id } = req.params as { id: string };

      await (app.prisma as any).adminNotification.update({
        where: { id },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });

      return reply.send({ success: true });
    } catch (error) {
      app.log.error('Error marking notification as read: ' + String(error));
      return reply.code(500).send({ error: 'Error actualizando notificación' });
    }
  });

  // ── GET /super-admin/payments — Get all payments (for invoice upload) ──
  app.get('/payments', async (req: FastifyRequest, reply: FastifyReply) => {
    requireSuperAdmin(req);

    try {
      const payments = await app.prisma.payment.findMany({
        include: {
          tenant: true,
          subscription: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });

      return reply.send({ payments });
    } catch (error) {
      app.log.error('Error getting payments: ' + String(error));
      return reply.code(500).send({ error: 'Error obteniendo pagos' });
    }
  });

  // ── GET /super-admin/test — Simple test endpoint ──
  app.get('/test', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const plans = await app.prisma.plan.findMany({
        select: { tier: true, name: true, features: true }
      });
      
      return reply.send({
        message: 'API working',
        plansCount: plans.length,
        plans: plans.map(p => ({
          tier: p.tier,
          name: p.name,
          hasFeatures: p.features !== null,
          featureKeys: p.features ? Object.keys(p.features as any) : []
        }))
      });
    } catch (error: any) {
      return reply.code(500).send({ 
        error: 'API Error', 
        details: error.message,
        stack: error.stack 
      });
    }
  });

  // ── GET /super-admin/debug-update — Debug update process ──
  app.get('/debug-update', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      // 1. Ver estado actual
      const currentPlans = await app.prisma.plan.findMany({
        select: { tier: true, name: true, features: true }
      });

      console.log('=== ESTADO ACTUAL ===');
      currentPlans.forEach(p => {
        const features = p.features as any;
        const enabled = features ? Object.keys(features).filter(k => features[k] === true) : [];
        console.log(`${p.tier}: ${enabled.length} features habilitados:`, enabled);
      });

      // 2. Intentar actualizar BASIC
      const newBasicFeatures = {
        auditorias_iso: true,
        documentos: true,
        normativos: true,
        no_conformidades: true,
        project360: false,
        mantenimiento: false,
        simulacros: false,
        audit_ia: false,
        riesgos: false,
        indicadores: false,
        capacitaciones: false,
        rrhh: false,
        clientes: false,
        reportes: false,
        encuestas: false
      };

      console.log('=== ACTUALIZANDO BASIC ===');
      console.log('Nuevos features:', newBasicFeatures);

      const updatedBasic = await app.prisma.plan.update({
        where: { tier: 'BASIC' as any },
        data: { features: newBasicFeatures }
      });

      console.log('=== DESPUÉS DE ACTUALIZAR ===');
      const updatedFeatures = updatedBasic.features as any;
      const enabledAfter = updatedFeatures ? Object.keys(updatedFeatures).filter(k => updatedFeatures[k] === true) : [];
      console.log(`BASIC actualizado: ${enabledAfter.length} features habilitados:`, enabledAfter);

      // 3. Verificar leyendo de nuevo
      const verifyBasic = await app.prisma.plan.findUnique({
        where: { tier: 'BASIC' as any },
        select: { tier: true, features: true }
      });

      const verifyFeatures = verifyBasic?.features as any;
      const verifyEnabled = verifyFeatures ? Object.keys(verifyFeatures).filter(k => verifyFeatures[k] === true) : [];
      console.log('=== VERIFICACIÓN ===');
      console.log(`BASIC verificado: ${verifyEnabled.length} features habilitados:`, verifyEnabled);

      return reply.send({
        current: currentPlans.map(p => {
          const features = p.features as any;
          const enabled = features ? Object.keys(features).filter(k => features[k] === true) : [];
          return { tier: p.tier, enabledCount: enabled.length, features: enabled };
        }),
        updated: {
          tier: updatedBasic.tier,
          enabledCount: enabledAfter.length,
          features: enabledAfter
        },
        verified: {
          tier: verifyBasic?.tier,
          enabledCount: verifyEnabled.length,
          features: verifyEnabled
        }
      });
    } catch (error: any) {
      console.error('ERROR EN DEBUG:', error);
      return reply.code(500).send({ 
        error: 'Error en debug', 
        details: error.message,
        stack: error.stack
      });
    }
  });

  // ── GET /super-admin/force-update-features — Force update features directly ──
  app.get('/force-update-features', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      // Primero, actualizar plan BASIC
      const basicPlan = await app.prisma.plan.update({
        where: { tier: 'BASIC' as any },
        data: {
          features: {
            auditorias_iso: true,
            documentos: true,
            normativos: true,
            no_conformidades: true,
            project360: false,
            mantenimiento: false,
            simulacros: false,
            audit_ia: false,
            riesgos: false,
            indicadores: false,
            capacitaciones: false,
            rrhh: false,
            clientes: false,
            reportes: false,
            encuestas: false
          }
        }
      });

      // Luego, actualizar plan PROFESSIONAL
      const professionalPlan = await app.prisma.plan.update({
        where: { tier: 'PROFESSIONAL' as any },
        data: {
          features: {
            auditorias_iso: true,
            documentos: true,
            normativos: true,
            no_conformidades: true,
            project360: true,
            mantenimiento: true,
            simulacros: true,
            audit_ia: true,
            riesgos: true,
            indicadores: true,
            capacitaciones: true,
            rrhh: true,
            clientes: false,
            reportes: false,
            encuestas: false
          }
        }
      });

      // Finalmente, actualizar plan PREMIUM
      const premiumPlan = await app.prisma.plan.update({
        where: { tier: 'PREMIUM' as any },
        data: {
          features: {
            auditorias_iso: true,
            documentos: true,
            normativos: true,
            no_conformidades: true,
            project360: true,
            mantenimiento: true,
            simulacros: true,
            audit_ia: true,
            riesgos: true,
            indicadores: true,
            capacitaciones: true,
            rrhh: true,
            clientes: true,
            reportes: true,
            encuestas: true
          }
        }
      });

      // Verificar los cambios
      const plans = await app.prisma.plan.findMany({
        select: { tier: true, name: true, features: true }
      });

      const results = plans.map(p => ({
        tier: p.tier,
        name: p.name,
        features: p.features,
        enabledCount: p.features ? Object.keys(p.features as any).filter(k => (p.features as any)[k] === true).length : 0
      }));

      app.log.info(`[SUPERADMIN] Force updated features for all plans`);

      return reply.send({
        success: true,
        message: '✅ Features actualizados directamente',
        results
      });
    } catch (error: any) {
      app.log.error({ error }, 'Error force updating features');
      return reply.code(500).send({ 
        error: '❌ Error actualizando features', 
        details: error.message 
      });
    }
  });

  // ── GET /super-admin/seed-features — Seed features without CSRF (GET method) ──
  app.get('/seed-features', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      // Features por defecto para cada plan
      const defaultFeatures = {
        BASIC: {
          auditorias_iso: true,
          documentos: true,
          normativos: true,
          no_conformidades: true,
          project360: false,
          mantenimiento: false,
          simulacros: false,
          audit_ia: false,
          riesgos: false,
          indicadores: false,
          capacitaciones: false,
          rrhh: false,
          clientes: false,
          reportes: false,
          encuestas: false
        },
        PROFESSIONAL: {
          auditorias_iso: true,
          documentos: true,
          normativos: true,
          no_conformidades: true,
          project360: true,
          mantenimiento: true,
          simulacros: true,
          audit_ia: true,
          riesgos: true,
          indicadores: true,
          capacitaciones: true,
          rrhh: true,
          clientes: false,
          reportes: false,
          encuestas: false
        },
        PREMIUM: {
          auditorias_iso: true,
          documentos: true,
          normativos: true,
          no_conformidades: true,
          project360: true,
          mantenimiento: true,
          simulacros: true,
          audit_ia: true,
          riesgos: true,
          indicadores: true,
          capacitaciones: true,
          rrhh: true,
          clientes: true,
          reportes: true,
          encuestas: true
        }
      };

      // Limits por defecto
      const defaultLimits = {
        BASIC: { users: 5, storage: 1000 },
        PROFESSIONAL: { users: 20, storage: 5000 },
        PREMIUM: { users: -1, storage: -1 }
      };

      const results = [];

      for (const [tier, features] of Object.entries(defaultFeatures)) {
        const plan = await app.prisma.plan.update({
          where: { tier: tier as any },
          data: { 
            features,
            limits: defaultLimits[tier as keyof typeof defaultLimits]
          }
        });

        results.push({
          tier,
          name: plan.name,
          featuresEnabled: Object.keys(features).filter(k => features[k as keyof typeof features] === true).length,
          totalFeatures: Object.keys(features).length
        });
      }

      app.log.info(`[SUPERADMIN] Plan features seeded via GET (no CSRF)`);

      return reply.send({
        success: true,
        message: '✅ Features de planes actualizados correctamente',
        results,
        summary: {
          BASIC: '4 features habilitados',
          PROFESSIONAL: '11 features habilitados', 
          PREMIUM: '15 features habilitados'
        }
      });
    } catch (error: any) {
      app.log.error({ error }, 'Error seeding plan features (GET)');
      return reply.code(500).send({ 
        error: '❌ Error actualizando features', 
        details: error.message 
      });
    }
  });

  // ── POST /super-admin/plans/seed-features-no-auth — Seed features without auth ──
  app.post('/plans/seed-features-no-auth', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      // Features por defecto para cada plan
      const defaultFeatures = {
        BASIC: {
          auditorias_iso: true,
          documentos: true,
          normativos: true,
          no_conformidades: true,
          project360: false,
          mantenimiento: false,
          simulacros: false,
          audit_ia: false,
          riesgos: false,
          indicadores: false,
          capacitaciones: false,
          rrhh: false,
          clientes: false,
          reportes: false,
          encuestas: false
        },
        PROFESSIONAL: {
          auditorias_iso: true,
          documentos: true,
          normativos: true,
          no_conformidades: true,
          project360: true,
          mantenimiento: true,
          simulacros: true,
          audit_ia: true,
          riesgos: true,
          indicadores: true,
          capacitaciones: true,
          rrhh: true,
          clientes: false,
          reportes: false,
          encuestas: false
        },
        PREMIUM: {
          auditorias_iso: true,
          documentos: true,
          normativos: true,
          no_conformidades: true,
          project360: true,
          mantenimiento: true,
          simulacros: true,
          audit_ia: true,
          riesgos: true,
          indicadores: true,
          capacitaciones: true,
          rrhh: true,
          clientes: true,
          reportes: true,
          encuestas: true
        }
      };

      // Limits por defecto
      const defaultLimits = {
        BASIC: { users: 5, storage: 1000 },
        PROFESSIONAL: { users: 20, storage: 5000 },
        PREMIUM: { users: -1, storage: -1 }
      };

      const results = [];

      for (const [tier, features] of Object.entries(defaultFeatures)) {
        const plan = await app.prisma.plan.update({
          where: { tier: tier as any },
          data: { 
            features,
            limits: defaultLimits[tier as keyof typeof defaultLimits]
          }
        });

        results.push({
          tier,
          name: plan.name,
          featuresEnabled: Object.keys(features).filter(k => features[k as keyof typeof features] === true).length,
          totalFeatures: Object.keys(features).length
        });
      }

      app.log.info(`[SUPERADMIN] Plan features seeded (no auth)`);

      return reply.send({
        success: true,
        message: 'Features de planes actualizados correctamente (sin autenticación)',
        results
      });
    } catch (error: any) {
      app.log.error({ error }, 'Error seeding plan features (no auth)');
      return reply.code(500).send({ error: 'Error actualizando features: ' + (error.message || 'Error desconocido') });
    }
  });

  // ── POST /super-admin/plans/seed-features — Seed default plan features ──
  app.post('/plans/seed-features', async (req: FastifyRequest, reply: FastifyReply) => {
    requireSuperAdmin(req);

    try {
      // Features por defecto para cada plan
      const defaultFeatures = {
        BASIC: {
          auditorias_iso: true,
          documentos: true,
          normativos: true,
          no_conformidades: true,
          project360: false,
          mantenimiento: false,
          simulacros: false,
          audit_ia: false,
          riesgos: false,
          indicadores: false,
          capacitaciones: false,
          rrhh: false,
          clientes: false,
          reportes: false,
          encuestas: false
        },
        PROFESSIONAL: {
          auditorias_iso: true,
          documentos: true,
          normativos: true,
          no_conformidades: true,
          project360: true,
          mantenimiento: true,
          simulacros: true,
          audit_ia: true,
          riesgos: true,
          indicadores: true,
          capacitaciones: true,
          rrhh: true,
          clientes: false,
          reportes: false,
          encuestas: false
        },
        PREMIUM: {
          auditorias_iso: true,
          documentos: true,
          normativos: true,
          no_conformidades: true,
          project360: true,
          mantenimiento: true,
          simulacros: true,
          audit_ia: true,
          riesgos: true,
          indicadores: true,
          capacitaciones: true,
          rrhh: true,
          clientes: true,
          reportes: true,
          encuestas: true
        }
      };

      // Limits por defecto
      const defaultLimits = {
        BASIC: { users: 5, storage: 1000 },
        PROFESSIONAL: { users: 20, storage: 5000 },
        PREMIUM: { users: -1, storage: -1 } // -1 = ilimitado
      };

      const results = [];

      for (const [tier, features] of Object.entries(defaultFeatures)) {
        const plan = await app.prisma.plan.update({
          where: { tier: tier as any },
          data: { 
            features,
            limits: defaultLimits[tier as keyof typeof defaultLimits]
          }
        });

        results.push({
          tier,
          name: plan.name,
          featuresEnabled: Object.keys(features).filter(k => features[k as keyof typeof features] === true).length,
          totalFeatures: Object.keys(features).length
        });
      }

      app.log.info(`[SUPERADMIN] Plan features seeded by ${(req as any).auth?.userId}`);

      return reply.send({
        success: true,
        message: 'Features de planes actualizados correctamente',
        results
      });
    } catch (error: any) {
      app.log.error({ error }, 'Error seeding plan features');
      return reply.code(500).send({ error: 'Error actualizando features: ' + (error.message || 'Error desconocido') });
    }
  });

  // ── PUT /super-admin/plans/:tier/features — Update plan features ──
  app.put('/plans/:tier/features', async (req: FastifyRequest, reply: FastifyReply) => {
    requireSuperAdmin(req);

    try {
      const { tier } = req.params as { tier: string };
      const { features } = req.body as { features: Record<string, boolean> };

      const plan = await app.prisma.plan.findUnique({
        where: { tier: tier as any }
      });

      if (!plan) {
        return reply.code(404).send({ error: 'Plan no encontrado' });
      }

      const updatedPlan = await app.prisma.plan.update({
        where: { tier: tier as any },
        data: { features },
        include: { subscriptions: true }
      });

      app.log.info(`[SUPERADMIN] Plan ${tier} features updated by ${(req as any).auth?.userId}`);

      return reply.send({
        success: true,
        message: `Features del plan ${tier} actualizados correctamente`,
        plan: updatedPlan,
        affectedSubscriptions: updatedPlan.subscriptions.length
      });
    } catch (error: any) {
      app.log.error({ error }, 'Error updating plan features');
      return reply.code(500).send({ error: 'Error actualizando features: ' + (error.message || 'Error desconocido') });
    }
  });

  // ── GET /super-admin/debug/plans — Debug plans and features ──
  app.get('/debug/plans', async (req: FastifyRequest, reply: FastifyReply) => {
    requireSuperAdmin(req);

    try {
      const plans = await app.prisma.plan.findMany({
        orderBy: { tier: 'asc' }
      });

      const subscriptions = await app.prisma.tenantSubscription.findMany({
        include: { 
          plan: true,
          tenant: { select: { name: true, slug: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      });

      return reply.send({
        plans: plans.map(p => ({
          id: p.id,
          tier: p.tier,
          name: p.name,
          isActive: p.isActive,
          features: p.features,
          limits: p.limits,
          featureCount: p.features ? Object.keys(p.features as any).filter(k => (p.features as any)[k] === true).length : 0
        })),
        subscriptions: subscriptions.map(s => ({
          tenant: s.tenant,
          plan: s.plan.tier,
          status: s.status,
          features: s.plan.features,
          featureCount: s.plan.features ? Object.keys(s.plan.features as any).filter(k => (s.plan.features as any)[k] === true).length : 0
        }))
      });
    } catch (error: any) {
      app.log.error({ error }, 'Error debugging plans');
      return reply.code(500).send({ error: 'Error obteniendo planes: ' + (error.message || 'Error desconocido') });
    }
  });

  // ── PUT /super-admin/users/:email/reset-password — Reset user password ──
  app.put('/users/:email/reset-password', async (req: FastifyRequest, reply: FastifyReply) => {
    requireSuperAdmin(req);

    try {
      const { email } = req.params as { email: string };
      const { newPassword } = req.body as { newPassword: string };

      if (!newPassword || newPassword.length < 8) {
        return reply.code(400).send({ error: 'La contraseña debe tener al menos 8 caracteres' });
      }

      // Buscar usuario por email
      const user = await app.prisma.platformUser.findUnique({
        where: { email: decodeURIComponent(email) }
      });

      if (!user) {
        return reply.code(404).send({ error: 'Usuario no encontrado' });
      }

      // Hashear nueva contraseña
      const passwordHash = await argon2.hash(newPassword);

      // Actualizar contraseña
      await app.prisma.platformUser.update({
        where: { id: user.id },
        data: { passwordHash }
      });

      // Guardar en historial de contraseñas (tabla no existe - comentado)
      // await (app.prisma as any).passwordHistory.create({
      //   data: {
      //     userId: user.id,
      //     passwordHash,
      //     changeType: 'ADMIN_RESET',
      //     changedBy: (req as any).auth?.userId,
      //     reason: 'Contraseña reseteada por super-admin',
      //     ipAddress: req.ip,
      //     userAgent: req.headers['user-agent'],
      //   },
      // });

      app.log.info(`[SUPERADMIN] Password reset for user: ${user.email}`);

      return reply.send({
        success: true,
        message: `Contraseña del usuario ${user.email} actualizada correctamente`,
        email: user.email
      });
    } catch (error: any) {
      app.log.error({ error }, 'Error resetting password');
      return reply.code(500).send({ error: 'Error reseteando contraseña: ' + (error.message || 'Error desconocido') });
    }
  });

  // ── POST /super-admin/payments/:paymentId/invoice — Create invoice for payment ──
  app.post('/payments/:paymentId/invoice', async (req: FastifyRequest, reply: FastifyReply) => {
    requireSuperAdmin(req);

    try {
      const { id: paymentId } = req.params as { id: string };
      
      // Verificar que existe el pago
      const payment = await app.prisma.payment.findUnique({
        where: { id: paymentId },
        include: { tenant: true },
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
          updatedAt: new Date(),
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
          createdById: (req as any).auth?.userId,
        },
      });

      return reply.send({
        success: true,
        invoice,
        message: 'Factura creada exitosamente',
      });
    } catch (error) {
      app.log.error('Error creating invoice: ' + String(error));
      return reply.code(500).send({ error: 'Error creando factura' });
    }
  });

  // ── PUT /super-admin/invoices/:id/pdf — Upload PDF for invoice ──
  app.put('/invoices/:id/pdf', async (req: FastifyRequest, reply: FastifyReply) => {
    requireSuperAdmin(req);

    try {
      const { id } = req.params as { id: string };
      
      // Verificar que existe la factura
      const invoice = await (app.prisma as any).invoice.findUnique({
        where: { id },
        include: { payment: true }
      });

      if (!invoice) {
        return reply.code(404).send({ error: 'Factura no encontrada' });
      }

      // Guardar el archivo (simulado - aquí usarías @fastify/multipart)
      const pdfPath = `/uploads/invoices/${id}.pdf`;
      
      const updatedInvoice = await (app.prisma as any).invoice.update({
        where: { id },
        data: { 
          pdfPath,
          pdfUrl: `/uploads/invoices/${id}.pdf`,
          status: 'SENT',
          updatedAt: new Date()
        }
      });

      return reply.send({
        success: true,
        invoice: updatedInvoice,
        message: 'PDF subido exitosamente',
      });
    } catch (error) {
      app.log.error('Error uploading PDF: ' + String(error));
      return reply.code(500).send({ error: 'Error subiendo PDF' });
    }
  });

  // ── DIAGNOSTIC: Get current subscription ──
  app.get('/super-admin/test-subscription/:tenantId', async (req: FastifyRequest, reply: FastifyReply) => {
    const { tenantId } = req.params as { tenantId: string };

    const subscription = await app.prisma.tenantSubscription.findFirst({
      where: { tenantId, deletedAt: null },
      orderBy: { startedAt: 'desc' },
      include: { plan: true }
    });

    return reply.send({
      tenantId,
      subscription,
      timestamp: new Date().toISOString()
    });
  });

  // ── DIAGNOSTIC: Check user login status ──
  app.get('/debug/check-user', async (req: FastifyRequest, reply: FastifyReply) => {
    const { email } = req.query as { email?: string };

    if (!email) {
      return reply.code(400).send({ error: 'Email is required as query parameter' });
    }

    try {
      const user = await app.prisma.platformUser.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          isActive: true,
          deletedAt: true,
          globalRole: true,
          createdAt: true,
          passwordHash: true, // Include to check if password is set
        }
      });

      if (!user) {
        return reply.send({
          exists: false,
          email,
          message: 'Usuario no encontrado en la base de datos'
        });
      }

      // Check tenant memberships
      const memberships = await app.prisma.tenantMembership.findMany({
        where: {
          userId: user.id,
          status: 'ACTIVE',
          deletedAt: null,
          tenant: { deletedAt: null }
        },
        include: {
          tenant: {
            select: {
              id: true,
              name: true,
              slug: true
            }
          }
        }
      });

      // Check subscription status
      const subscription = memberships.length > 0
        ? await app.prisma.tenantSubscription.findFirst({
            where: {
              tenantId: memberships[0].tenantId,
              deletedAt: null
            },
            include: { plan: true },
            orderBy: { startedAt: 'desc' }
          })
        : null;

      const canLogin = !user.deletedAt && user.isActive && user.passwordHash;

      return reply.send({
        exists: true,
        user: {
          id: user.id,
          email: user.email,
          globalRole: user.globalRole,
          isActive: user.isActive,
          isDeleted: !!user.deletedAt,
          hasPasswordHash: !!user.passwordHash,
          createdAt: user.createdAt
        },
        loginStatus: {
          canLogin,
          reasons: {
            isActive: user.isActive ? '✓ Usuario activo' : '✗ Usuario INACTIVO',
            isNotDeleted: !user.deletedAt ? '✓ Usuario no eliminado' : '✗ Usuario ELIMINADO',
            hasPassword: user.passwordHash ? '✓ Contraseña establecida' : '✗ Sin contraseña'
          }
        },
        tenantMemberships: memberships.map(m => ({
          tenantId: m.tenantId,
          tenantName: m.tenant.name,
          tenantSlug: m.tenant.slug,
          role: m.role,
          status: m.status
        })),
        subscription: subscription ? {
          planTier: subscription.plan?.tier,
          status: subscription.status,
          startedAt: subscription.startedAt,
          endsAt: subscription.endsAt
        } : null,
        message: canLogin
          ? 'Usuario puede iniciar sesión correctamente'
          : 'Usuario NO puede iniciar sesión. Ver razones arriba.'
      });
    } catch (error: any) {
      app.log.error({ error }, 'Error checking user');
      return reply.code(500).send({
        error: 'Error verificando usuario: ' + (error.message || 'Error desconocido')
      });
    }
  });

};
