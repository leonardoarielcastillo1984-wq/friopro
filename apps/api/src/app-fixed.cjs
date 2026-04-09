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

  console.log(`${new Date().toISOString()} ${method} ${url}`);

  // Health endpoint
  if (url === '/health' || url === '/api/health') {
    console.log('Health check requested');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'ok', 
      message: 'API Fixed funcionando',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    }));
    return;
  }

  // Login endpoint
  if ((url === '/api/auth/login' || url === '/auth/login') && method === 'POST') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      console.log('Login request body:', body);
      
      try {
        const { email, password } = JSON.parse(body);
        console.log('Parsed credentials:', { email, password: '***' });
        
        // Mock validation - aceptar ambas contraseñas
        if (email === 'admin@sgi360.com' && (password === 'admin123' || password === 'Admin123!')) {
          const response = {
            accessToken: 'simple-token-1',
            user: { 
              id: '1', 
              email: 'admin@sgi360.com', 
              globalRole: 'SUPER_ADMIN',
              name: 'Admin User'
            },
            activeTenant: { 
              id: '1', 
              name: 'Demo Tenant', 
              slug: 'demo' 
            },
            tenantRole: 'ADMIN'
          };
          
          console.log('Login successful');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(response));
        } else {
          console.log('Invalid credentials');
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid credentials' }));
        }
      } catch (error) {
        console.error('JSON parse error:', error);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    
    req.on('error', (error) => {
      console.error('Request error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Request error' }));
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
    
    console.log('Returning plans');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(plans));
    return;
  }

  // Subscription
  if (url === '/license/subscription' && method === 'GET') {
    console.log('Returning subscription');
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

  // Dashboard stats
  if (url === '/api/stats' && method === 'GET') {
    console.log('Returning dashboard stats');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      totalUsers: 1,
      totalTenants: 1,
      totalProjects: 0,
      totalAudits: 0,
      totalNCRs: 0,
      totalTrainings: 0,
      totalDocuments: 0,
      activeUsers: 1,
      systemHealth: 'OK'
    }));
    return;
  }

  // User profile
  if (url === '/api/me' && method === 'GET') {
    console.log('Returning user profile');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      id: '1',
      email: 'admin@sgi360.com',
      globalRole: 'SUPER_ADMIN',
      name: 'Admin User',
      activeTenant: { 
        id: '1', 
        name: 'Demo Tenant', 
        slug: 'demo' 
      },
      tenantRole: 'ADMIN',
      permissions: ['*'] // Full access
    }));
    return;
  }

  // Mock endpoints for all modules (return empty data to unlock)
  const moduleEndpoints = [
    '/audit/audits', '/audit/analyze', '/audit/findings',
    '/ncr', '/ncr/stats',
    '/trainings', '/trainings/stats',
    '/project360/projects', '/project360/stats',
    '/customers', '/surveys',
    '/indicators', '/risks',
    '/reports', '/reports/stats',
    '/emergency/drills', '/emergency/contingency-plans', '/emergency/resources', '/emergency/stats',
    '/intelligence/insights', '/management-review/meetings',
    '/settings', '/admin/users', '/notifications'
  ];

  for (const endpoint of moduleEndpoints) {
    if (url.startsWith(endpoint) && method === 'GET') {
      console.log(`Returning mock data for: ${endpoint}`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ data: [], total: 0, page: 1, limit: 10 }));
      return;
    }
  }

  // 404
  console.log('404 for:', url, method);
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found', url, method }));
});

const PORT = 3002;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 API Fixed funcionando en puerto ${PORT}`);
  console.log(`📊 Health: http://localhost:${PORT}/health`);
  console.log(`🔐 Login: http://localhost:${PORT}/api/auth/login`);
  console.log(`📋 Planes: http://localhost:${PORT}/license/plans`);
  console.log(`📈 Suscripción: http://localhost:${PORT}/license/subscription`);
  console.log(`💳 Checkout: http://localhost:${PORT}/license/checkout`);
});

server.on('error', (err) => {
  console.error('Server error:', err);
});

// Handle process errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
