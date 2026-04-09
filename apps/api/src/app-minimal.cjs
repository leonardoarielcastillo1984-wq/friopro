const http = require('http');

const server = http.createServer((req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = req.url;
  const method = req.method;

  console.log(`${method} ${url}`);

  // Health check
  if (url === '/health' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      message: 'API minimal funcionando'
    }));
    return;
  }

  // Login
  if (url === '/api/auth/login' && method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const { email, password } = JSON.parse(body);
        if (email === 'admin@sgi360.com' && password === 'admin123') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            accessToken: 'simple-token-1',
            user: { id: '1', email: 'admin@sgi360.com', globalRole: 'SUPER_ADMIN' },
            activeTenant: { id: '1', name: 'Demo Tenant', slug: 'demo' },
            tenantRole: 'ADMIN'
          }));
        } else {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid credentials' }));
        }
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  // Plans
  if (url === '/license/plans' && method === 'GET') {
    const plans = {
      plans: [
        {
          id: 'BASIC',
          name: 'Básico',
          tier: 'BASIC',
          monthlyPrice: 35,
          annualPrice: 350,
          popular: false,
          features: ['Hasta 5 usuarios', '10 GB almacenamiento', 'Soporte por email']
        },
        {
          id: 'PROFESSIONAL',
          name: 'Profesional',
          tier: 'PROFESSIONAL',
          monthlyPrice: 69,
          annualPrice: 690,
          popular: true,
          features: ['Hasta 20 usuarios', '50 GB almacenamiento', 'Soporte prioritario', 'API access']
        },
        {
          id: 'PREMIUM',
          name: 'Premium',
          tier: 'PREMIUM',
          monthlyPrice: 99,
          annualPrice: 990,
          popular: false,
          features: ['Usuarios ilimitados', 'Almacenamiento ilimitado', 'Soporte 24/7', 'AI Assistant']
        }
      ]
    };
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(plans));
    return;
  }

  // Subscription
  if (url === '/license/subscription' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      subscription: null,
      currentPlan: 'NO_PLAN'
    }));
    return;
  }

  // Checkout
  if (url === '/license/checkout' && method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const { planTier, period } = JSON.parse(body);
        const prices = {
          monthly: { BASIC: 35, PROFESSIONAL: 69, PREMIUM: 99 },
          annual: { BASIC: 350, PROFESSIONAL: 690, PREMIUM: 990 }
        };
        
        const amount = prices[period]?.[planTier];
        if (!amount) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Plan o período inválido' }));
          return;
        }

        const mockId = `mock_${Date.now()}`;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          checkout: {
            preferenceId: mockId,
            initPoint: `https://www.mercadopago.com/mla/checkout/pay?pref_id=${mockId}`,
            sandboxInitPoint: `https://www.mercadopago.com/mla/checkout/pay?pref_id=${mockId}`
          },
          plan: { tier: planTier, period, amount }
        }));
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found', url, method }));
});

const PORT = 3002;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 API Minimal funcionando en puerto ${PORT}`);
  console.log(`📊 Health: http://localhost:${PORT}/health`);
  console.log(`🔐 Login: http://localhost:${PORT}/api/auth/login`);
  console.log(`📋 Planes: http://localhost:${PORT}/license/plans`);
  console.log(`📈 Suscripción: http://localhost:${PORT}/license/subscription`);
  console.log(`💳 Checkout: http://localhost:${PORT}/license/checkout`);
});

server.on('error', (err) => {
  console.error('Server error:', err);
});
