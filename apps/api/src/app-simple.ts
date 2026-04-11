import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import { PrismaClient } from '@prisma/client';

// Crear instancia de Fastify
const app = Fastify({ logger: true });

// Crear instancia de Prisma
const prisma = new PrismaClient();

// Registrar plugins
app.register(cors, {
  origin: (process.env.CORS_ORIGIN || 'http://localhost:3000,http://127.0.0.1:3000').split(','),
  credentials: true,
});

app.register(cookie);

// Extender FastifyInstance para incluir prisma
app.decorate('prisma', prisma);

// Rutas básicas de salud
app.get('/health', async (req, reply) => {
  return { status: 'ok', timestamp: new Date() };
});

// Rutas de autenticación simplificadas
app.post('/api/auth/login', async (req, reply) => {
  try {
    const { email, password } = req.body as any;
    
    // Buscar usuario
    const user = await prisma.platformUser.findUnique({
      where: { email }
    });

    if (!user) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    // Para desarrollo, aceptar cualquier contraseña
    // En producción, verificar con hash
    
    // Obtener membresías activas
    const memberships = await prisma.tenantMembership.findMany({
      where: { 
        userId: user.id, 
        status: 'ACTIVE',
        deletedAt: null,
        tenant: { deletedAt: null }
      },
      include: { tenant: true },
      orderBy: { createdAt: 'asc' }
    });

    let activeTenant = null;
    let tenantRole = null;
    
    if (memberships.length > 0) {
      const selected = memberships[0];
      activeTenant = { 
        id: selected.tenant.id, 
        name: selected.tenant.name, 
        slug: selected.tenant.slug 
      };
      tenantRole = selected.role;
    }

    // Token simple para desarrollo
    const accessToken = 'simple-token-' + user.id;
    
    // Establecer cookies
    reply.setCookie('access_token', accessToken, {
      path: '/',
      httpOnly: true,
      secure: false, // para desarrollo
      sameSite: 'lax'
    });

    return reply.send({
      accessToken,
      user: { 
        id: user.id, 
        email: user.email, 
        globalRole: user.globalRole 
      },
      activeTenant,
      tenantRole
    });

  } catch (error) {
    console.error('Login error:', error);
    return reply.code(500).send({ error: 'Internal server error' });
  }
});

// Middleware de autenticación simple
app.addHook('preHandler', async (req, reply) => {
  const token = req.cookies.access_token;
  
  if (token && token.startsWith('simple-token-')) {
    const userId = token.replace('simple-token-', '');
    const user = await prisma.platformUser.findUnique({
      where: { id: userId }
    });
    
    if (user) {
      (req as any).auth = {
        userId: user.id,
        globalRole: user.globalRole
      };
    }
  }
});

// Rutas de licencias (versión simplificada)
app.register(async function (app) {
  
  // Precios de los planes
  const PLAN_PRICES = {
    monthly: { BASIC: 35, PROFESSIONAL: 69, PREMIUM: 99 },
    annual: { BASIC: 350, PROFESSIONAL: 690, PREMIUM: 990 }
  };

  // GET /license/test
  app.get('/license/test', async (req, reply) => {
    return { 
      message: 'License routes working', 
      timestamp: new Date() 
    };
  });

  // GET /license/plans
  app.get('/license/plans', async (req, reply) => {
    const plans = [
      {
        id: 'BASIC',
        name: 'Básico',
        tier: 'BASIC',
        monthlyPrice: PLAN_PRICES.monthly.BASIC,
        annualPrice: PLAN_PRICES.annual.BASIC,
        popular: false
      },
      {
        id: 'PROFESSIONAL',
        name: 'Profesional',
        tier: 'PROFESSIONAL',
        monthlyPrice: PLAN_PRICES.monthly.PROFESSIONAL,
        annualPrice: PLAN_PRICES.annual.PROFESSIONAL,
        popular: true
      },
      {
        id: 'PREMIUM',
        name: 'Premium',
        tier: 'PREMIUM',
        monthlyPrice: PLAN_PRICES.monthly.PREMIUM,
        annualPrice: PLAN_PRICES.annual.PREMIUM,
        popular: false
      }
    ];

    return { plans };
  });

  // GET /license/mercadopago-status
  app.get('/license/mercadopago-status', async (req, reply) => {
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    
    return {
      hasAccessToken: !!accessToken,
      nodeEnv: process.env.NODE_ENV || 'development',
      appUrl: process.env.APP_URL || 'http://localhost:3000',
      mpConnectionStatus: accessToken ? 'configured' : 'no_token'
    };
  });

  // POST /license/checkout
  app.post('/license/checkout', async (req, reply) => {
    try {
      const auth = (req as any).auth;
      if (!auth?.userId) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const { planTier, period } = req.body as any;
      
      if (!planTier || !['BASIC', 'PROFESSIONAL', 'PREMIUM'].includes(planTier)) {
        return reply.code(400).send({ error: 'Plan inválido' });
      }

      if (!period || !['monthly', 'annual'].includes(period)) {
        return reply.code(400).send({ error: 'Período inválido' });
      }

      const amount = PLAN_PRICES[period as keyof typeof PLAN_PRICES]?.[planTier as keyof (typeof PLAN_PRICES)['monthly']];
      
      if (!amount) {
        return reply.code(400).send({ error: 'Precio no encontrado' });
      }

      // Mock checkout para desarrollo
      const mockPreferenceId = `mock_${Date.now()}`;
      const checkoutResponse = {
        preferenceId: mockPreferenceId,
        initPoint: `https://www.mercadopago.com/mla/checkout/pay?pref_id=${mockPreferenceId}`,
        sandboxInitPoint: `https://www.mercadopago.com/mla/checkout/pay?pref_id=${mockPreferenceId}`
      };

      return reply.send({
        success: true,
        checkout: checkoutResponse,
        plan: { tier: planTier, period, amount }
      });

    } catch (error) {
      console.error('Checkout error:', error);
      return reply.code(500).send({ error: 'Error creating checkout' });
    }
  });

  // GET /license/subscription
  app.get('/license/subscription', async (req, reply) => {
    try {
      const auth = (req as any).auth;
      if (!auth?.userId) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      // Obtener membresía del usuario para saber el tenant
      const membership = await prisma.tenantMembership.findFirst({
        where: { 
          userId: auth.userId,
          status: 'ACTIVE',
          deletedAt: null
        },
        include: { tenant: true }
      });

      if (!membership) {
        return reply.send({ 
          subscription: null, 
          currentPlan: 'NO_PLAN' 
        });
      }

      // Obtener suscripción del tenant
      const subscription = await prisma.tenantSubscription.findFirst({
        where: { 
          tenantId: membership.tenantId,
          deletedAt: null
        },
        orderBy: { startedAt: 'desc' }
      });

      return reply.send({
        subscription: subscription ? {
          id: subscription.id,
          planTier: subscription.planTier,
          status: subscription.status,
          startDate: subscription.startDate,
          endDate: subscription.endDate,
          autoRenew: subscription.autoRenew
        } : null,
        currentPlan: subscription?.planTier || 'NO_PLAN'
      });

    } catch (error) {
      console.error('Subscription error:', error);
      return reply.code(500).send({ error: 'Error getting subscription' });
    }
  });
});

// Rutas de Super Admin simplificadas
app.register(async function (app) {
  
  // GET /super-admin/tenants
  app.get('/super-admin/tenants', async (req, reply) => {
    try {
      const tenants = await prisma.tenant.findMany({
        where: { deletedAt: null },
        include: {
          tenantSubscription: {
            where: { deletedAt: null },
            orderBy: { startedAt: 'desc' },
            take: 1
          },
          _count: {
            select: { tenantMembership: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      return reply.send({ tenants });
    } catch (error) {
      console.error('Tenants error:', error);
      return reply.code(500).send({ error: 'Error getting tenants' });
    }
  });

  // PUT /super-admin/tenants/:id/plan
  app.put('/super-admin/tenants/:id/plan', async (req, reply) => {
    try {
      const { id: tenantId } = req.params as any;
      const { planTier, period } = req.body as any;

      if (!planTier || !['NO_PLAN', 'BASIC', 'PROFESSIONAL', 'PREMIUM'].includes(planTier)) {
        return reply.code(400).send({ error: 'Plan inválido' });
      }

      // Actualizar tenant
      await prisma.tenant.update({
        where: { id: tenantId },
        data: {
          planTier,
          subscriptionStatus: planTier === 'NO_PLAN' ? 'INACTIVE' : 'ACTIVE'
        }
      });

      // Si no es NO_PLAN, crear o actualizar suscripción
      if (planTier !== 'NO_PLAN') {
        const now = new Date();
        let endDate = new Date(now);
        
        if (period === 'monthly') {
          endDate.setMonth(endDate.getMonth() + 1);
        } else {
          endDate.setFullYear(endDate.getFullYear() + 1);
        }

        const existing = await prisma.tenantSubscription.findFirst({
          where: { tenantId, deletedAt: null },
          orderBy: { startedAt: 'desc' }
        });

        if (existing) {
          await prisma.tenantSubscription.update({
            where: { id: existing.id },
            data: {
              planTier,
              status: 'ACTIVE',
              startDate: now,
              endDate,
              autoRenew: true
            }
          });
        } else {
          await prisma.tenantSubscription.create({
            data: {
              tenantId,
              planTier,
              status: 'ACTIVE',
              startDate: now,
              endDate,
              autoRenew: true
            }
          });
        }
      }

      return reply.send({ success: true });
    } catch (error) {
      console.error('Plan update error:', error);
      return reply.code(500).send({ error: 'Error updating plan' });
    }
  });
});

// Iniciar servidor
const start = async () => {
  try {
    const port = Number(process.env.PORT ?? 3002);
    await app.listen({ port, host: '0.0.0.0' });
    console.log(`🚀 API SGI 360 funcionando en puerto ${port}`);
    console.log(`📊 Health check: http://localhost:${port}/health`);
    console.log(`🔐 Login: http://localhost:${port}/api/auth/login`);
    console.log(`💳 Licencias: http://localhost:${port}/license/plans`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
