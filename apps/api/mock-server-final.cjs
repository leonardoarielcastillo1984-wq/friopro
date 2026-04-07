const http = require('http');
const url = require('url');

// Mock users database - Credenciales correctas para SGI 360
const users = {
  'admin@sgi360.com': {
    id: 'user-1',
    email: 'admin@sgi360.com',
    name: 'Admin User',
    password: 'Admin123!',
    twoFactorEnabled: false,
    globalRole: 'SUPER_ADMIN'
  },
  'test@example.com': {
    id: '2',
    email: 'test@example.com',
    name: 'Test User',
    password: 'Test123!@#',
    twoFactorEnabled: true,
  },
  'admin@test.com': {
    id: '3',
    email: 'admin@test.com',
    name: 'Admin User',
    password: 'Admin123!@#',
    twoFactorEnabled: false,
  },
};

// Mock sessions for 2FA verification
const sessions = new Map();

// Helper to generate mock tokens
function generateToken() {
  return 'mock_token_' + Math.random().toString(36).substring(2, 15);
}

function generateAccessToken() {
  return 'mock-jwt-token-' + Date.now();
}

// Helper to generate mock session token
function generateSessionToken() {
  return 'session_' + Math.random().toString(36).substring(2, 15);
}

// Helper to generate CSRF token
function generateCsrfToken() {
  return 'csrf_' + Math.random().toString(36).substring(2, 15);
}

// Helper to parse JSON body
function parseBody(req, callback) {
  let body = '';
  req.on('data', (chunk) => {
    body += chunk.toString();
  });
  req.on('end', () => {
    try {
      callback(JSON.parse(body));
    } catch (e) {
      callback(null);
    }
  });
}

// CORS headers
function addCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token, x-csrf-token, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

// Request handler
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // Log incoming request
  console.log(`[${new Date().toISOString()}] ${method} ${pathname}`);

  // CORS preflight
  if (method === 'OPTIONS') {
    addCorsHeaders(res);
    res.writeHead(200);
    res.end();
    return;
  }

  addCorsHeaders(res);

  // GET /auth/csrf
  if (pathname === '/auth/csrf' && method === 'GET') {
    const csrfToken = generateCsrfToken();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ csrfToken: csrfToken }));
    console.log(`  → CSRF token generated: ${csrfToken}`);
    return;
  }

  // POST /api/auth/login
  if (pathname === '/api/auth/login' && method === 'POST') {
    parseBody(req, (body) => {
      if (!body || !body.email || !body.password) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing email or password' }));
        return;
      }

      const user = users[body.email];

      if (!user || user.password !== body.password) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid credentials' }));
        console.log(`  → Login failed for ${body.email}`);
        return;
      }

      if (user.twoFactorEnabled) {
        // User has 2FA enabled
        const sessionToken = generateSessionToken();
        sessions.set(sessionToken, {
          email: user.email,
          userId: user.id,
          createdAt: Date.now(),
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            requires2FA: true,
            sessionToken: sessionToken,
          })
        );
        console.log(`  → 2FA required for ${body.email}`);
      } else {
        // User does not have 2FA enabled
        const accessToken = generateAccessToken();
        const csrfToken = generateCsrfToken();
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            accessToken: accessToken,
            user: {
              id: user.id,
              email: user.email,
              name: user.name,
            },
            csrfToken: csrfToken,
            requires2FA: false,
          })
        );
        console.log(`  → Login successful for ${body.email}`);
      }
    });
    return;
  }

  // GET /api/auth/me
  if (pathname === '/api/auth/me' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      user: {
        id: 'user-1',
        email: 'admin@sgi360.com',
        name: 'Admin User',
        globalRole: 'SUPER_ADMIN'
      },
      activeTenant: {
        id: 'tenant-1',
        name: 'SGI 360 Demo'
      },
      tenantRole: 'ADMIN'
    }));
    return;
  }

  // POST /api/auth/logout
  if (pathname === '/api/auth/logout' && method === 'POST') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  // GET /api/dashboard
  if (pathname === '/api/dashboard' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      stats: {
        totalEmployees: 5,
        activeEmployees: 5,
        totalDocuments: 12,
        pendingTasks: 3,
        trainingNeeds: 2
      }
    }));
    return;
  }

  // HR endpoints
  if (pathname === '/hr/employees' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      employees: [
        {
          id: 'emp-1',
          firstName: 'Juan',
          lastName: 'Pérez',
          email: 'juan.perez@empresa.com',
          status: 'ACTIVE',
          department: { id: 'dept-1', name: 'Tecnología' },
          position: { id: 'pos-1', name: 'Desarrollador Senior' }
        },
        {
          id: 'emp-2',
          firstName: 'María',
          lastName: 'García',
          email: 'maria.garcia@empresa.com',
          status: 'ACTIVE',
          department: { id: 'dept-2', name: 'Recursos Humanos' },
          position: { id: 'pos-2', name: 'Gerente de RRHH' }
        }
      ]
    }));
    return;
  }

  if (pathname === '/hr/positions' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      positions: [
        {
          id: '1',
          name: 'Desarrollador Senior',
          code: 'DEV-001',
          category: 'Técnico',
          level: 'Senior'
        },
        {
          id: '2',
          name: 'Gerente de RRHH',
          code: 'RRHH-001',
          category: 'Administrativo',
          level: 'Gerencial'
        }
      ]
    }));
    return;
  }

  if (pathname === '/hr/competencies' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      competencies: [
        {
          id: '1',
          name: 'Programación',
          category: 'technical',
          description: 'Capacidad para escribir código eficiente'
        },
        {
          id: '2',
          name: 'Liderazgo',
          category: 'leadership',
          description: 'Capacidad para guiar equipos'
        }
      ]
    }));
    return;
  }

  if (pathname === '/hr/stats' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      stats: {
        totalEmployees: 2,
        activeEmployees: 2,
        totalPositions: 2,
        trainingNeeds: 3
      }
    }));
    return;
  }

  // POST /hr/positions
  if (pathname === '/hr/positions' && method === 'POST') {
    parseBody(req, (body) => {
      const newPosition = {
        id: 'pos-' + Date.now(),
        ...body,
        createdAt: new Date().toISOString()
      };
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(newPosition));
    });
    return;
  }

  // GET /ncr
  if (pathname === '/ncr' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ncr: [
        {
          id: 'ncr-1',
          title: 'No Conformidad Ejemplo',
          description: 'Descripción de la no conformidad',
          status: 'OPEN',
          severity: 'MEDIUM',
          createdAt: '2024-01-15T10:00:00Z',
          assignedTo: { id: 'emp-1', firstName: 'Juan', lastName: 'Pérez' },
          createdBy: { id: 'emp-2', firstName: 'María', lastName: 'García' }
        }
      ]
    }));
    return;
  }

  // GET /ncr/stats
  if (pathname === '/ncr/stats' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      stats: {
        total: 1,
        open: 1,
        closed: 0,
        high: 0,
        medium: 1,
        low: 0
      }
    }));
    return;
  }

  // GET /indicators
  if (pathname === '/indicators' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      indicators: [
        {
          id: 'ind-1',
          name: 'Productividad',
          code: 'PROD-001',
          category: 'Operacional',
          target: 100,
          current: 85,
          unit: '%',
          frequency: 'Mensual'
        },
        {
          id: 'ind-2',
          name: 'Calidad',
          code: 'CAL-001',
          category: 'Calidad',
          target: 95,
          current: 92,
          unit: '%',
          frequency: 'Mensual'
        }
      ]
    }));
    return;
  }

  // GET /indicators/stats
  if (pathname === '/indicators/stats' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      stats: {
        total: 2,
        onTarget: 1,
        belowTarget: 1,
        aboveTarget: 0
      }
    }));
    return;
  }

  // GET /trainings
  if (pathname === '/trainings' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      trainings: [
        {
          id: 'train-1',
          title: 'Capacitación en Seguridad',
          code: 'TRAIN-001',
          category: 'Seguridad',
          status: 'ACTIVE',
          startDate: '2024-01-20T09:00:00Z',
          endDate: '2024-01-20T17:00:00Z',
          instructor: 'Juan Pérez',
          participants: 5
        }
      ]
    }));
    return;
  }

  // GET /trainings/stats
  if (pathname === '/trainings/stats' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      stats: {
        total: 1,
        active: 1,
        completed: 0,
        upcoming: 1,
        totalParticipants: 5
      }
    }));
    return;
  }

  // GET /notifications
  if (pathname === '/notifications' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      notifications: [
        {
          id: 'notif-1',
          title: 'Recordatorio de Evaluación',
          message: 'Tienes una evaluación pendiente',
          type: 'info',
          read: false,
          createdAt: '2024-01-15T14:30:00Z'
        }
      ]
    }));
    return;
  }

  // GET /notifications/stats
  if (pathname === '/notifications/stats' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      stats: {
        total: 1,
        unread: 1,
        read: 0
      }
    }));
    return;
  }

  // GET /documents
  if (pathname === '/documents' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      documents: [
        {
          id: 'doc-1',
          name: 'Manual de Calidad',
          version: 'v2.0',
          category: 'Calidad',
          uploadedAt: '2024-01-10T10:00:00Z',
          size: 1024000
        }
      ]
    }));
    return;
  }

  // GET /normativos
  if (pathname === '/normativos' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      normativos: [
        {
          id: 'norm-1',
          title: 'ISO 9001:2015',
          description: 'Sistema de Gestión de Calidad',
          version: '2015',
          status: 'ACTIVE'
        }
      ]
    }));
    return;
  }

  // 404 for unknown routes
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`🚀 Mock API Server running on port ${PORT}`);
  console.log(`📡 Available endpoints:`);
  console.log(`   POST /api/auth/login`);
  console.log(`   GET  /api/auth/me`);
  console.log(`   POST /api/auth/logout`);
  console.log(`   GET  /api/dashboard`);
  console.log(`   GET  /hr/employees`);
  console.log(`   GET  /hr/positions`);
  console.log(`   POST /hr/positions`);
  console.log(`   GET  /hr/competencies`);
  console.log(`   GET  /hr/stats`);
  console.log(`   GET  /ncr`);
  console.log(`   GET  /ncr/stats`);
  console.log(`   GET  /indicators`);
  console.log(`   GET  /indicators/stats`);
  console.log(`   GET  /trainings`);
  console.log(`   GET  /trainings/stats`);
  console.log(`   GET  /notifications`);
  console.log(`   GET  /notifications/stats`);
  console.log(`   GET  /documents`);
  console.log(`   GET  /normativos`);
  console.log(`\n👤 Login credentials:`);
  console.log(`   Email: admin@sgi360.com`);
  console.log(`   Password: Admin123!`);
  console.log(`\n📝 Alternative test credentials:`);
  console.log(`   Email: test@example.com`);
  console.log(`   Password: Test123!@# (requires 2FA)`);
  console.log(`   Email: admin@test.com`);
  console.log(`   Password: Admin123!@#`);
});
