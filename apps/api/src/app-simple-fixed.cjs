const http = require('http');

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
      const { email, password } = body;

      // Mock user validation
      if (email === 'admin@sgi360.com' && password === 'admin123') {
        const accessToken = 'simple-token-1';
        
        // Set cookie
        const cookieValue = `access_token=${accessToken}; Path=/; HttpOnly; SameSite=lax`;
        res.setHeader('Set-Cookie', cookieValue);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          accessToken,
          user: { 
            id: '1', 
            email: 'admin@sgi360.com', 
            globalRole: 'SUPER_ADMIN' 
          },
          activeTenant: { 
            id: '1', 
            name: 'Demo Tenant', 
            slug: 'demo' 
          },
          tenantRole: 'ADMIN'
        }));
        return;
      }

      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid credentials' }));
      return;
    }

    // Get auth from cookies
    const cookies = parseCookies(req.headers.cookie);
    let auth = null;
    
    if (cookies.access_token && cookies.access_token.startsWith('simple-token-')) {
      auth = {
        userId: '1',
        globalRole: 'SUPER_ADMIN'
      };
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

    // POST /license/checkout
    if (url === '/license/checkout' && method === 'POST') {
      if (!auth?.userId) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }

      const body = await parseBody(req);
      const { planTier, period } = body;
      
      if (!planTier || !['BASIC', 'PROFESSIONAL', 'PREMIUM'].includes(planTier)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Plan inválido' }));
        return;
      }

      if (!period || !['monthly', 'annual'].includes(period)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Período inválido' }));
        return;
      }

      const amount = PLAN_PRICES[period]?.[planTier];
      
      if (!amount) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Precio no encontrado' }));
        return;
      }

      // Mock MercadoPago checkout
      const mockId = `mock_${Date.now()}`;
      const checkoutResponse = {
        preferenceId: mockId,
        initPoint: `https://www.mercadopago.com/mla/checkout/pay?pref_id=${mockId}`,
        sandboxInitPoint: `https://www.mercadopago.com/mla/checkout/pay?pref_id=${mockId}`
      };

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

      // Mock subscription - sin plan activo
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        subscription: null,
        currentPlan: 'NO_PLAN'
      }));
      return;
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));

  } catch (error) {
    console.error('Server error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error', details: error.message }));
  }
});

// Puerto 3002
const PORT = 3002;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 API SGI 360 Simple funcionando en puerto ${PORT}`);
  console.log(`📊 Health: http://localhost:${PORT}/health`);
  console.log(`🔐 Login: http://localhost:${PORT}/api/auth/login`);
  console.log(`💳 Checkout: http://localhost:${PORT}/license/checkout`);
  console.log(`📋 Planes: http://localhost:${PORT}/license/plans`);
  console.log(`📈 Suscripción: http://localhost:${PORT}/license/subscription`);
});
