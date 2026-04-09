const http = require('http');

const server = http.createServer((req, res) => {
  // Enable CORS - Permitir localhost:3000 específicamente para credentials
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control, Pragma, x-tenant-id');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

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
      message: 'API Fixed v2 funcionando',
      timestamp: new Date().toISOString(),
      version: '2.0.0'
    }));
    return;
  }

  // Login endpoint - Manejar query parameters
  if ((url.startsWith('/api/auth/login') || url.startsWith('/auth/login')) && method === 'POST') {
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
          
          console.log('Login successful for admin');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(response));
        } else if ((email === 'lcastillo@dadalogistica.com' || email === 'lcastillo@dadalogitica.com') && (password === 'temporal123' || password === 'Temporal123!')) {
          const response = {
            accessToken: 'simple-token-2',
            user: { 
              id: 'c35f8112-5675-459a-b0ff-0b82010a3016', 
              email: email, 
              globalRole: 'CLIENT',
              name: 'Leonardo Castillo'
            },
            activeTenant: { 
              id: '1', 
              name: 'Demo Tenant', 
              slug: 'demo' 
            },
            tenantRole: 'USER'
          };
          
          console.log('Login successful for CLIENT:', email);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(response));
        } else {
          console.log('Invalid credentials for email:', email);
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid credentials' }));
        }
      } catch (error) {
        console.log('JSON parse error:', error.message);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  // User profile endpoint
  if ((url === '/api/me' || url === '/api/auth/me') && method === 'GET') {
    console.log('Returning user profile');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
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
      tenantRole: 'ADMIN',
      permissions: ['*'] // Full access
    }));
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

  // License endpoints
  if ((url === '/license/plans' || url === '/api/license/plans') && method === 'GET') {
    console.log('Returning license plans');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      plans: [
        { id: 'basic', name: 'Básico', price: 99, features: ['Hasta 10 usuarios', 'Auditorías básicas'] },
        { id: 'pro', name: 'Profesional', price: 299, features: ['Hasta 50 usuarios', 'Auditorías avanzadas', 'Reportes'] },
        { id: 'enterprise', name: 'Empresarial', price: 599, features: ['Usuarios ilimitados', 'Todas las funcionalidades'] }
      ]
    }));
    return;
  }

  if ((url === '/license/subscription' || url === '/api/license/subscription') && method === 'GET') {
    console.log('Returning subscription status');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      plan: 'basic',
      status: 'active',
      endsAt: '2024-12-31T23:59:59.000Z'
    }));
    return;
  }

  if ((url === '/license/checkout' || url === '/api/license/checkout') && method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      console.log('Checkout request body:', body);
      try {
        const { planId } = JSON.parse(body);
        console.log('Checkout for plan:', planId);
        
        // Mock MercadoPago response
        const response = {
          preferenceId: 'pref_' + Math.random().toString(36).substr(2, 9),
          initPoint: 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=' + Math.random().toString(36).substr(2, 9),
          plan: { id: planId, price: 299 }
        };
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  // License endpoints
  if (url.startsWith('/license/setup') && method === 'GET') {
    console.log('Returning license setup status');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      required: false, 
      status: 'PAID', 
      amount: 200, 
      currency: 'USD',
      paidAt: new Date().toISOString(),
      message: 'Setup completed'
    }));
    return;
  }

  if (url.startsWith('/license/subscription') && method === 'GET') {
    console.log('Returning license subscription status for CLIENT');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      hasSubscription: true,
      planTier: 'BASIC',
      status: 'ACTIVE',
      startedAt: new Date().toISOString(),
      endsAt: '2024-12-31T23:59:59Z',
      daysRemaining: 365,
      isInGracePeriod: false,
      graceDaysRemaining: 0,
      isExpired: false,
      plan: {
        id: 'basic',
        name: 'Plan Básico',
        price: 99,
        features: [
          'Hasta 10 usuarios',
          'Módulos básicos',
          'Soporte por email'
        ],
        maxUsers: 10,
        modules: ['dashboard', 'documents', 'reports', 'customers', 'surveys']
      }
    }));
    return;
  }

  if (url.startsWith('/license/plans') && method === 'GET') {
    console.log('Returning license plans');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      plans: [
        {
          tier: 'BASIC',
          name: 'Básico',
          description: 'Funcionalidades esenciales',
          prices: { monthly: 99, annual: 990, savings: 10 },
          limits: { maxUsers: 5, modules: ['dashboard', 'documents', 'ncr'], features: ['Basic support'] },
          features: ['Dashboard', 'Documentos', 'No Conformidades'],
          notIncluded: ['Auditorías', 'Inteligencia IA']
        },
        {
          tier: 'PROFESSIONAL',
          name: 'Profesional',
          description: 'Para equipos en crecimiento',
          prices: { monthly: 299, annual: 2990, savings: 17 },
          limits: { maxUsers: 15, modules: ['dashboard', 'documents', 'ncr', 'audits', 'trainings'], features: ['Priority support'] },
          features: ['Todo BASIC + Auditorías', 'Capacitaciones', 'Project360'],
          notIncluded: ['Inteligencia IA', 'RRHH']
        },
        {
          tier: 'PREMIUM',
          name: 'Premium',
          description: 'Sin límites',
          prices: { monthly: 599, annual: 5990, savings: 17 },
          limits: { maxUsers: 50, modules: ['all'], features: ['Dedicated support'] },
          features: ['Todas las funcionalidades', 'Inteligencia IA', 'RRHH', 'Soporte dedicado'],
          notIncluded: []
        }
      ]
    }));
    return;
  }

  if (url.startsWith('/license/check-access/') && method === 'GET') {
    console.log('Checking module access - allowing all');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ allowed: true }));
    return;
  }

  // Mock endpoints for all modules (return empty data to unlock)
  const moduleEndpoints = [
    '/dashboard', '/audit/audits', '/audit/analyze', '/audit/findings',
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
    if ((url.startsWith('/api' + endpoint) || url.startsWith(endpoint)) && method === 'GET') {
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
  console.log(`🚀 API Fixed v2 funcionando en puerto ${PORT}`);
  console.log(`📊 Health: http://localhost:${PORT}/health`);
  console.log(`📊 Health (API): http://localhost:${PORT}/api/health`);
  console.log(`🔐 Login: http://localhost:${PORT}/api/auth/login`);
  console.log(`👤 Profile: http://localhost:${PORT}/api/me`);
  console.log(`📈 Stats: http://localhost:${PORT}/api/stats`);
});
