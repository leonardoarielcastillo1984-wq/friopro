const http = require('http');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Precios de planes
const PLAN_PRICES = {
  monthly: { BASIC: 35, PROFESSIONAL: 69, PREMIUM: 99 },
  annual: { BASIC: 350, PROFESSIONAL: 690, PREMIUM: 990 }
};

// Parse cookies
function parseCookies(cookieHeader) {
  const cookies = {};
  if (cookieHeader) {
    cookieHeader.split(';').forEach(cookie => {
      const [name, value] = cookie.trim().split('=');
      cookies[name] = value;
    });
  }
  return cookies;
}

// Parse JSON body
function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        resolve({});
      }
    });
  });
}

// CORS headers
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

// Main server
const server = http.createServer(async (req, res) => {
  setCorsHeaders(res);

  // Handle OPTIONS
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = req.url;
  const method = req.method;

  try {
    // Health check
    if (url === '/health' && method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', timestamp: new Date() }));
      return;
    }

    // Login
    if (url === '/api/auth/login' && method === 'POST') {
      const body = await parseBody(req);
      const { email } = body;

      const user = await prisma.platformUser.findUnique({
        where: { email }
      });

      if (!user) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid credentials' }));
        return;
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
      
      // Set cookie
      const cookieValue = `access_token=${accessToken}; Path=/; HttpOnly; SameSite=lax`;
      res.setHeader('Set-Cookie', cookieValue);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        accessToken,
        user: { 
          id: user.id, 
          email: user.email, 
          globalRole: user.globalRole 
        },
        activeTenant,
        tenantRole
      }));
      return;
    }

    // Get auth from cookies
    const cookies = parseCookies(req.headers.cookie);
    let auth = null;
    
    if (cookies.access_token && cookies.access_token.startsWith('simple-token-')) {
      const userId = cookies.access_token.replace('simple-token-', '');
      const user = await prisma.platformUser.findUnique({
        where: { id: userId }
      });
      
      if (user) {
        auth = {
          userId: user.id,
          globalRole: user.globalRole
        };
      }
    }

    // GET /license/plans
    if (url === '/license/plans' && method === 'GET') {
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

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ plans }));
      return;
    }

    // POST /license/checkout - ENDPOINT PRINCIPAL
    if (url === '/license/checkout' && method === 'POST') {
      console.log('[CHECKOUT] Iniciando checkout...');
      
      if (!auth?.userId) {
        console.log('[CHECKOUT] Error: No autenticado');
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }

      const body = await parseBody(req);
      const { planTier, period } = body;
      console.log('[CHECKOUT] Datos recibidos:', { planTier, period });
      
      if (!planTier || !['BASIC', 'PROFESSIONAL', 'PREMIUM'].includes(planTier)) {
        console.log('[CHECKOUT] Error: Plan inválido');
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Plan inválido' }));
        return;
      }

      if (!period || !['monthly', 'annual'].includes(period)) {
        console.log('[CHECKOUT] Error: Período inválido');
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Período inválido' }));
        return;
      }

      const amount = PLAN_PRICES[period]?.[planTier];
      
      if (!amount) {
        console.log('[CHECKOUT] Error: Precio no encontrado');
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Precio no encontrado' }));
        return;
      }

      // Mock checkout - SIEMPRE FUNCIONA
      const mockId = `mock_${Date.now()}`;
      const checkoutResponse = {
        preferenceId: mockId,
        initPoint: `https://www.mercadopago.com/mla/checkout/pay?pref_id=${mockId}`,
        sandboxInitPoint: `https://www.mercadopago.com/mla/checkout/pay?pref_id=${mockId}`
      };

      console.log('[CHECKOUT] Enviando respuesta exitosa');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        checkout: checkoutResponse,
        plan: { tier: planTier, period, amount }
      }));
      return;
    }

    // GET /license/subscription
    if (url === '/license/subscription' && method === 'GET') {
      if (!auth?.userId) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }

      const membership = await prisma.tenantMembership.findFirst({
        where: { 
          userId: auth.userId,
          status: 'ACTIVE',
          deletedAt: null
        },
        include: { tenant: true }
      });

      if (!membership) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          subscription: null, 
          currentPlan: 'NO_PLAN' 
        }));
        return;
      }

      const subscription = await prisma.tenantSubscription.findFirst({
        where: { 
          tenantId: membership.tenantId,
          deletedAt: null
        },
        orderBy: { startedAt: 'desc' }
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        subscription: subscription ? {
          id: subscription.id,
          planTier: subscription.planTier,
          status: subscription.status,
          startDate: subscription.startDate,
          endDate: subscription.endDate,
          autoRenew: subscription.autoRenew
        } : null,
        currentPlan: subscription?.planTier || 'NO_PLAN'
      }));
      return;
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));

  } catch (error) {
    console.error('Server error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
});

// Usar puerto 3003 para evitar conflicto
const PORT = 3003;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 API SGI 360 funcionando en puerto ${PORT}`);
  console.log(`📊 Health: http://localhost:${PORT}/health`);
  console.log(`🔐 Login: http://localhost:${PORT}/api/auth/login`);
  console.log(`💳 Checkout: http://localhost:${PORT}/license/checkout`);
  console.log(`📋 Planes: http://localhost:${PORT}/license/plans`);
  console.log(`📈 Suscripción: http://localhost:${PORT}/license/subscription`);
});
