const http = require('http');

const server = http.createServer((req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-csrf-token');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:3001`);
  const path = url.pathname;
  
  console.log(`📡 ${req.method} ${path}`);
  
  // Handle login
  if (path === '/api/auth/login' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        const { email, password } = JSON.parse(body);
        console.log('🔵 Login attempt:', email);
        
        if (email === 'admin@sgi360.com' && password === 'Admin123!') {
          const response = {
            user: {
              id: 'user-1',
              email: 'admin@sgi360.com',
              globalRole: 'SUPER_ADMIN',
              firstName: 'Admin',
              lastName: 'User'
            },
            accessToken: 'mock-jwt-token-' + Date.now(),
            refreshToken: 'mock-refresh-token',
            csrfToken: 'mock-csrf-' + Date.now(),
            activeTenant: {
              id: 'tenant-1',
              name: 'SGI 360 Demo',
              slug: 'demo'
            },
            tenantRole: 'ADMIN',
            requires2FA: false
          };
          
          console.log('✅ Login successful for:', email);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(response));
        } else {
          console.log('❌ Login failed for:', email);
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid credentials' }));
        }
      } catch (error) {
        console.log('❌ Error parsing body:', error);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid request' }));
      }
    });
    
    return;
  }
  
  // Handle /api/auth/me
  if (path === '/api/auth/me' && req.method === 'GET') {
    const response = {
      user: {
        id: 'user-1',
        email: 'admin@sgi360.com',
        globalRole: 'SUPER_ADMIN',
        firstName: 'Admin',
        lastName: 'User'
      },
      activeTenant: {
        id: 'tenant-1',
        name: 'SGI 360 Demo',
        slug: 'demo'
      },
      tenantRole: 'ADMIN'
    };
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response));
    return;
  }
  
  // Handle /api/auth/logout
  if (path === '/api/auth/logout' && req.method === 'POST') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }
  
  // Handle HR endpoints
  if (path === '/hr/employees' && req.method === 'GET') {
    const response = {
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
    };
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response));
    return;
  }
  
  if (path === '/hr/positions' && req.method === 'GET') {
    const response = {
      positions: [
        {
          id: '1',
          name: 'Desarrollador Senior',
          code: 'DEV-001',
          category: 'Técnico',
          level: 'Senior',
          mission: 'Liderar el desarrollo de aplicaciones web escalables',
          keyFunctions: ['Desarrollar y mantener aplicaciones', 'Revisar código del equipo'],
          objective: 'Asegurar la entrega de soluciones técnicas de alta calidad',
          responsibilities: ['Escribir código limpio', 'Participar en reuniones de planificación'],
          requirements: ['5+ años de experiencia', 'Conocimiento de React y Node.js']
        },
        {
          id: '2',
          name: 'Gerente de RRHH',
          code: 'RRHH-001',
          category: 'Administrativo',
          level: 'Gerencial',
          mission: 'Gestionar el talento humano y desarrollar estrategias de retención',
          keyFunctions: ['Reclutamiento y selección', 'Gestión de desempeño'],
          objective: 'Construir y mantener un equipo de trabajo motivado',
          responsibilities: ['Diseñar políticas de RRHH', 'Gestionar el proceso de selección'],
          requirements: ['Título en RRHH o Psicología', '3+ años de experiencia en gestión']
        }
      ]
    };
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response));
    return;
  }
  
  if (path === '/hr/competencies' && req.method === 'GET') {
    const response = {
      competencies: [
        {
          id: '1',
          name: 'Programación',
          category: 'technical',
          description: 'Capacidad para escribir código eficiente y mantenible',
          levels: [
            { level: 1, name: 'Básico', description: 'Puede escribir código simple' },
            { level: 2, name: 'Intermedio', description: 'Puede desarrollar funcionalidades completas' },
            { level: 3, name: 'Avanzado', description: 'Puede diseñar arquitecturas' },
            { level: 4, name: 'Experto', description: 'Puede liderar proyectos complejos' },
            { level: 5, name: 'Maestro', description: 'Referencia en la industria' }
          ]
        },
        {
          id: '2',
          name: 'Comunicación',
          category: 'behavioral',
          description: 'Habilidad para transmitir ideas de forma clara y efectiva',
          levels: [
            { level: 1, name: 'Básico', description: 'Comunica información simple' },
            { level: 2, name: 'Intermedio', description: 'Presenta ideas estructuradas' },
            { level: 3, name: 'Avanzado', description: 'Influye y persuade' },
            { level: 4, name: 'Experto', description: 'Lidera conversaciones difíciles' },
            { level: 5, name: 'Maestro', description: 'Inspira y motiva' }
          ]
        }
      ]
    };
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response));
    return;
  }
  
  if (path === '/hr/org-chart' && req.method === 'GET') {
    const response = {
      orgChart: [
        {
          id: 'emp-2',
          firstName: 'María',
          lastName: 'García',
          position: { name: 'Gerente de RRHH' },
          department: { name: 'Recursos Humanos' },
          subordinates: [
            {
              id: 'emp-1',
              firstName: 'Juan',
              lastName: 'Pérez',
              position: { name: 'Desarrollador Senior' },
              department: { name: 'Tecnología' },
              subordinates: []
            }
          ]
        }
      ]
    };
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response));
    return;
  }
  
  if (path === '/hr/stats' && req.method === 'GET') {
    const response = {
      stats: {
        totalEmployees: 2,
        activeEmployees: 2,
        totalPositions: 2,
        departments: 2,
        avgCompetencyLevel: 3.2,
        trainingNeeds: 3
      }
    };
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response));
    return;
  }
  
  // Handle dashboard
  if (path === '/api/dashboard' && req.method === 'GET') {
    const response = {
      stats: {
        totalEmployees: 2,
        activeEmployees: 2,
        totalDocuments: 5,
        pendingTasks: 3,
        trainingNeeds: 3
      }
    };
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response));
    return;
  }
  
  // 404 for unknown routes
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`🚀 Simple HTTP Server running on port ${PORT}`);
  console.log(`📡 Available endpoints:`);
  console.log(`   POST /api/auth/login`);
  console.log(`   GET  /api/auth/me`);
  console.log(`   GET  /hr/employees`);
  console.log(`   GET  /hr/positions`);
  console.log(`   GET  /hr/competencies`);
  console.log(`   GET  /hr/org-chart`);
  console.log(`   GET  /hr/stats`);
  console.log(`   GET  /api/dashboard`);
  console.log(`\n👤 Login credentials:`);
  console.log(`   Email: admin@sgi360.com`);
  console.log(`   Password: Admin123!`);
});
