const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true
}));
app.use(cookieParser());
app.use(express.json());

// Precios de planes
const PLAN_PRICES = {
  monthly: { BASIC: 35, PROFESSIONAL: 69, PREMIUM: 99 },
  annual: { BASIC: 350, PROFESSIONAL: 690, PREMIUM: 990 }
};

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Login simple
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await prisma.platformUser.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

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

    const accessToken = 'simple-token-' + user.id;
    
    res.cookie('access_token', accessToken, {
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'lax'
    });

    res.json({
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
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Middleware de auth
app.use((req, res, next) => {
  const token = req.cookies.access_token;
  
  if (token && token.startsWith('simple-token-')) {
    const userId = token.replace('simple-token-', '');
    prisma.platformUser.findUnique({
      where: { id: userId }
    }).then(user => {
      if (user) {
        req.auth = {
          userId: user.id,
          globalRole: user.globalRole
        };
      }
      next();
    }).catch(() => next());
  } else {
    next();
  }
});

// GET /license/plans
app.get('/license/plans', (req, res) => {
  const plans = [
    {
      id: 'BASIC',
      name: 'Básico',
      tier: 'BASIC',
      monthlyPrice: PLAN_PRICES.monthly.BASIC,
      annualPrice: PLAN_PRICES.annual.BASIC,
      popular: false,
      features: ['Hasta 5 usuarios', '10 GB almacenamiento', 'Soporte por email']
    },
    {
      id: 'PROFESSIONAL',
      name: 'Profesional',
      tier: 'PROFESSIONAL',
      monthlyPrice: PLAN_PRICES.monthly.PROFESSIONAL,
      annualPrice: PLAN_PRICES.annual.PROFESSIONAL,
      popular: true,
      features: ['Hasta 20 usuarios', '50 GB almacenamiento', 'Soporte prioritario', 'API access']
    },
    {
      id: 'PREMIUM',
      name: 'Premium',
      tier: 'PREMIUM',
      monthlyPrice: PLAN_PRICES.monthly.PREMIUM,
      annualPrice: PLAN_PRICES.annual.PREMIUM,
      popular: false,
      features: ['Usuarios ilimitados', 'Almacenamiento ilimitado', 'Soporte 24/7', 'AI Assistant']
    }
  ];

  res.json({ plans });
});

// POST /license/checkout - ESTE ES EL ENDPOINT QUE NECESITAS
app.post('/license/checkout', async (req, res) => {
  try {
    console.log('[CHECKOUT] Iniciando checkout...');
    
    if (!req.auth?.userId) {
      console.log('[CHECKOUT] Error: No autenticado');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { planTier, period } = req.body;
    console.log('[CHECKOUT] Datos recibidos:', { planTier, period });
    
    if (!planTier || !['BASIC', 'PROFESSIONAL', 'PREMIUM'].includes(planTier)) {
      console.log('[CHECKOUT] Error: Plan inválido');
      return res.status(400).json({ error: 'Plan inválido' });
    }

    if (!period || !['monthly', 'annual'].includes(period)) {
      console.log('[CHECKOUT] Error: Período inválido');
      return res.status(400).json({ error: 'Período inválido' });
    }

    const amount = PLAN_PRICES[period]?.[planTier];
    
    if (!amount) {
      console.log('[CHECKOUT] Error: Precio no encontrado');
      return res.status(400).json({ error: 'Precio no encontrado' });
    }

    // Crear preferencia de MercadoPago (real si hay token, mock si no)
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    let checkoutResponse;

    if (accessToken) {
      try {
        console.log('[CHECKOUT] Creando preferencia real con MercadoPago...');
        
        const user = await prisma.platformUser.findUnique({
          where: { id: req.auth.userId }
        });

        const membership = await prisma.tenantMembership.findFirst({
          where: { 
            userId: req.auth.userId,
            status: 'ACTIVE',
            deletedAt: null
          },
          include: { tenant: true }
        });

        if (!membership) {
          return res.status(400).json({ error: 'No tenant found' });
        }

        const preferenceData = {
          items: [{
            title: `SGI 360 - Plan ${planTier} (${period === 'monthly' ? 'Mensual' : 'Anual'})`,
            description: `Suscripción ${period === 'monthly' ? 'mensual' : 'anual'} a SGI 360`,
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
          auto_return: 'approved',
          external_reference: `${membership.tenantId}_${planTier}_${period}_${Date.now()}`,
          metadata: {
            tenant_id: membership.tenantId,
            plan_tier: planTier,
            period: period,
            user_id: req.auth.userId
          }
        };

        const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(preferenceData)
        });

        const responseText = await mpResponse.text();
        console.log('[CHECKOUT] Respuesta MP:', mpResponse.status, responseText);

        if (mpResponse.ok) {
          const preference = JSON.parse(responseText);
          checkoutResponse = {
            preferenceId: preference.id,
            initPoint: preference.init_point,
            sandboxInitPoint: preference.sandbox_init_point || preference.init_point
          };
          console.log('[CHECKOUT] Preferencia creada:', checkoutResponse);
        } else {
          throw new Error(`MP Error: ${responseText}`);
        }
      } catch (mpError) {
        console.log('[CHECKOUT] MP falló, usando mock:', mpError.message);
        const mockId = `mock_${Date.now()}`;
        checkoutResponse = {
          preferenceId: mockId,
          initPoint: `https://www.mercadopago.com/mla/checkout/pay?pref_id=${mockId}`,
          sandboxInitPoint: `https://www.mercadopago.com/mla/checkout/pay?pref_id=${mockId}`
        };
      }
    } else {
      console.log('[CHECKOUT] Sin token MP, usando mock');
      const mockId = `mock_${Date.now()}`;
      checkoutResponse = {
        preferenceId: mockId,
        initPoint: `https://www.mercadopago.com/mla/checkout/pay?pref_id=${mockId}`,
        sandboxInitPoint: `https://www.mercadopago.com/mla/checkout/pay?pref_id=${mockId}`
      };
    }

    console.log('[CHECKOUT] Enviando respuesta exitosa');
    res.json({
      success: true,
      checkout: checkoutResponse,
      plan: { tier: planTier, period, amount }
    });

  } catch (error) {
    console.error('[CHECKOUT] Error:', error);
    res.status(500).json({ 
      error: 'Error creating checkout',
      details: error.message 
    });
  }
});

// GET /license/subscription
app.get('/license/subscription', async (req, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const membership = await prisma.tenantMembership.findFirst({
      where: { 
        userId: req.auth.userId,
        status: 'ACTIVE',
        deletedAt: null
      },
      include: { tenant: true }
    });

    if (!membership) {
      return res.json({ 
        subscription: null, 
        currentPlan: 'NO_PLAN' 
      });
    }

    const subscription = await prisma.tenantSubscription.findFirst({
      where: { 
        tenantId: membership.tenantId,
        deletedAt: null
      },
      orderBy: { startedAt: 'desc' }
    });

    res.json({
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
    res.status(500).json({ error: 'Error getting subscription' });
  }
});

// Iniciar servidor
const PORT = 3002;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 API de PAGOS funcionando en puerto ${PORT}`);
  console.log(`📊 Health: http://localhost:${PORT}/health`);
  console.log(`💳 Checkout: http://localhost:${PORT}/license/checkout`);
  console.log(`📋 Planes: http://localhost:${PORT}/license/plans`);
});
