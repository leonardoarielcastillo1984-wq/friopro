#!/usr/bin/env node
/**
 * SGI 360 API Server - Carga datos reales desde data.json
 * Sin dependencias externas, sin Prisma, sin problemas
 */

const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');

// 📂 CARGAR DATOS DESDE data.json
let dataCache = {
  documents: [],
  drills: [],
  trainings: [],
  indicators: [],
  ncrs: [],
  clauseMappings: [],
  normativos: [],
  departments: [],
  positions: [],
  employees: []
};

function loadData() {
  try {
    const dataPath = path.join(__dirname, 'data.json');
    console.log('📂 Cargando datos desde:', dataPath);

    if (fs.existsSync(dataPath)) {
      const content = fs.readFileSync(dataPath, 'utf-8');
      const parsed = JSON.parse(content);
      dataCache = parsed;

      console.log('✅ DATOS CARGADOS:');
      console.log('   📄 Documentos:', parsed.documents?.length || 0);
      console.log('   🔥 Simulacros:', parsed.drills?.length || 0);
      console.log('   📚 Capacitaciones:', parsed.trainings?.length || 0);
      console.log('   📊 Indicadores:', parsed.indicators?.length || 0);
      console.log('   ⚠️  NCRs:', parsed.ncrs?.length || 0);
      console.log('   📋 Normativos:', parsed.normativos?.length || 0);
      return true;
    } else {
      console.log('❌ data.json NOT FOUND, usando datos vacíos');
      return false;
    }
  } catch (error) {
    console.error('❌ Error cargando datos:', error.message);
    return false;
  }
}

// 🚀 CREAR SERVIDOR
const server = http.createServer((req, res) => {
  // CORS headers - Allow localhost:3000 with credentials
  const origin = req.headers.origin;
  const allowedOrigins = ['http://localhost:3000', 'http://127.0.0.1:3000'];

  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-csrf-token, x-tenant-id');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  console.log(`📡 ${req.method} ${pathname}`);

  // ============================================
  // AUTH ENDPOINTS
  // ============================================
  if (pathname === '/api/auth/login' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const { email, password } = JSON.parse(body);
        if (email === 'admin@sgi360.com' && password === 'Admin123!') {
          res.writeHead(200);
          res.end(JSON.stringify({
            user: {
              id: 'user-1',
              email: 'admin@sgi360.com',
              globalRole: 'SUPER_ADMIN',
              firstName: 'Admin',
              lastName: 'User'
            },
            accessToken: 'mock-jwt-' + Date.now(),
            refreshToken: 'mock-refresh',
            csrfToken: 'mock-csrf-' + Date.now(),
            activeTenant: { id: 'tenant-1', name: 'SGI 360', slug: 'demo' },
            tenantRole: 'ADMIN',
            requires2FA: false
          }));
        } else {
          res.writeHead(401);
          res.end(JSON.stringify({ error: 'Invalid credentials' }));
        }
      } catch (e) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Bad request' }));
      }
    });
    return;
  }

  if (pathname === '/api/auth/me' && req.method === 'GET') {
    res.writeHead(200);
    res.end(JSON.stringify({
      user: {
        id: 'user-1',
        email: 'admin@sgi360.com',
        globalRole: 'SUPER_ADMIN',
        firstName: 'Admin',
        lastName: 'User'
      },
      activeTenant: { id: 'tenant-1', name: 'SGI 360', slug: 'demo' },
      tenantRole: 'ADMIN'
    }));
    return;
  }

  // ============================================
  // DOCUMENTOS - ENDPOINT PRINCIPAL
  // ============================================
  if (pathname === '/documents' && req.method === 'GET') {
    console.log('📄 Sirviendo documentos. Total en memoria:', dataCache.documents?.length);

    const activeDocs = (dataCache.documents || []).filter(d => !d.deletedAt);

    const formatted = activeDocs.map(doc => ({
      id: doc.id,
      title: doc.title,
      type: doc.type,
      status: doc.status,
      version: doc.version || 1,
      department: doc.department || null,
      normative: doc.normative || null,
      fileName: doc.fileName,
      filePath: doc.filePath,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    }));

    console.log('✅ Devolviendo', formatted.length, 'documentos');
    res.writeHead(200);
    res.end(JSON.stringify({ documents: formatted }));
    return;
  }

  // ============================================
  // DOCUMENTO INDIVIDUAL
  // ============================================
  if (pathname.match(/^\/documents\/[^/]+$/) && req.method === 'GET') {
    const id = pathname.split('/')[2];
    const doc = (dataCache.documents || []).find(d => d.id === id);

    if (doc) {
      res.writeHead(200);
      res.end(JSON.stringify({
        document: {
          id: doc.id,
          title: doc.title,
          type: doc.type,
          status: doc.status,
          version: doc.version || 1,
          content: doc.content || `Contenido de ${doc.title}`,
          summary: `Resumen: ${doc.title}`,
          keyPoints: ['Punto clave 1', 'Punto clave 2'],
          riskLevel: 'MEDIUM',
          complianceScore: 85,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt
        }
      }));
    } else {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Document not found' }));
    }
    return;
  }

  // ============================================
  // DASHBOARD
  // ============================================
  if (pathname === '/dashboard' && req.method === 'GET') {
    const activeDocs = (dataCache.documents || []).filter(d => !d.deletedAt);
    const effectiveDocs = activeDocs.filter(d => d.status === 'EFFECTIVE');
    const draftDocs = activeDocs.filter(d => d.status === 'DRAFT');
    const recentDocs = [...activeDocs]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5)
      .map(d => ({ id: d.id, title: d.title, status: d.status, createdAt: d.createdAt }));

    res.writeHead(200);
    res.end(JSON.stringify({
      documents: activeDocs.length,
      normatives: (dataCache.normativos || []).length,
      ncrs: (dataCache.ncrs || []).length,
      risks: 0,
      indicators: (dataCache.indicators || []).length,
      trainings: (dataCache.trainings || []).length,
      dashboard: {
        documents: {
          total: activeDocs.length,
          effective: effectiveDocs.length,
          draft: draftDocs.length,
          recent: recentDocs
        },
        normatives: {
          total: (dataCache.normativos || []).length,
          ready: (dataCache.normativos || []).filter(n => n.status === 'ACTIVE').length,
          totalClauses: (dataCache.normativos || []).reduce((acc, n) => acc + (n.clauseCount || 0), 0)
        },
        departments: (dataCache.departments || []).length,
        ncrs: {
          total: (dataCache.ncrs || []).length,
          closed: (dataCache.ncrs || []).filter(n => n.status === 'CLOSED').length,
          open: (dataCache.ncrs || []).filter(n => n.status === 'OPEN').length
        },
        risks: { total: 0, low: 0, medium: 0, high: 0, critical: 0 },
        findings: { total: 0, open: 0, closed: 0 },
        trainings: {
          total: (dataCache.trainings || []).length,
          completed: (dataCache.trainings || []).filter(t => t.status === 'COMPLETED').length,
          scheduled: (dataCache.trainings || []).filter(t => t.status === 'PLANNED' || t.status === 'ACTIVE').length
        },
        indicators: {
          total: (dataCache.indicators || []).length,
          active: (dataCache.indicators || []).filter(i => i.status === 'ACTIVE').length,
          onTarget: 0
        }
      }
    }));
    return;
  }

  // ============================================
  // SIMULACROS / DRILLS
  // ============================================
  if (pathname === '/drills' && req.method === 'GET') {
    res.writeHead(200);
    res.end(JSON.stringify({ drills: dataCache.drills || [] }));
    return;
  }

  // ============================================
  // CAPACITACIONES / TRAININGS
  // ============================================
  if (pathname === '/trainings' && req.method === 'GET') {
    res.writeHead(200);
    res.end(JSON.stringify({ trainings: dataCache.trainings || [] }));
    return;
  }

  // ============================================
  // INDICADORES
  // ============================================
  if (pathname === '/indicators' && req.method === 'GET') {
    res.writeHead(200);
    res.end(JSON.stringify({ indicators: dataCache.indicators || [] }));
    return;
  }

  // ============================================
  // NCRs
  // ============================================
  if (pathname === '/ncrs' && req.method === 'GET') {
    res.writeHead(200);
    res.end(JSON.stringify({ ncrs: dataCache.ncrs || [] }));
    return;
  }

  // ============================================
  // NORMATIVOS
  // ============================================
  if (pathname === '/normativos' && req.method === 'GET') {
    res.writeHead(200);
    res.end(JSON.stringify({ normativos: dataCache.normativos || [] }));
    return;
  }

  // ============================================
  // LICENCIA / PLANES
  // ============================================

  // Configuración de módulos
  const MODULE_CONFIG = {
    dashboard: { name: 'Panel General', minPlan: 'BASIC', icon: 'LayoutDashboard' },
    documents: { name: 'Documentos', minPlan: 'BASIC', icon: 'FileText' },
    ncr: { name: 'No Conformidades', minPlan: 'BASIC', icon: 'Bug' },
    indicators: { name: 'Indicadores', minPlan: 'BASIC', icon: 'BarChart3' },
    risks: { name: 'Riesgos', minPlan: 'BASIC', icon: 'AlertTriangle' },
    audits: { name: 'Auditorías', minPlan: 'PROFESSIONAL', icon: 'ClipboardCheck' },
    trainings: { name: 'Capacitaciones', minPlan: 'PROFESSIONAL', icon: 'BookOpen' },
    maintenance: { name: 'Mantenimiento', minPlan: 'PROFESSIONAL', icon: 'Settings' },
    project360: { name: 'Project360', minPlan: 'PROFESSIONAL', icon: 'Target' },
    simulacros: { name: 'Simulacros', minPlan: 'PROFESSIONAL', icon: 'Flame' },
    normativos: { name: 'Normativos', minPlan: 'PROFESSIONAL', icon: 'Shield' },
    clientes: { name: 'Clientes', minPlan: 'PROFESSIONAL', icon: 'Users' },
    encuestas: { name: 'Encuestas', minPlan: 'PROFESSIONAL', icon: 'MessageSquare' },
    rrhh: { name: 'RRHH', minPlan: 'PREMIUM', icon: 'UserCircle' },
    audit: { name: 'Auditoría IA', minPlan: 'PREMIUM', icon: 'Brain' },
    intelligence: { name: 'Inteligencia', minPlan: 'PREMIUM', icon: 'Sparkles' }
  };

  const PLAN_PRICES = {
    monthly: { BASIC: 35, PROFESSIONAL: 69, PREMIUM: 99 },
    annual: { BASIC: 399, PROFESSIONAL: 786, PREMIUM: 1128 }
  };

  const PLAN_LIMITS = {
    BASIC: { maxUsers: 5, modules: ['dashboard', 'documents', 'ncr', 'indicators', 'risks'], features: ['basic_reports'] },
    PROFESSIONAL: { maxUsers: 15, modules: ['*'], features: ['advanced_analytics', 'api_access'] },
    PREMIUM: { maxUsers: 50, modules: ['*'], features: ['*'] }
  };

  // GET /license/setup
  if (pathname === '/license/setup' && req.method === 'GET') {
    res.writeHead(200);
    res.end(JSON.stringify({
      status: 'PENDING',
      amount: 200.00,
      currency: 'USD',
      required: true,
      message: 'Para comenzar a utilizar SGI 360, debés completar la implementación inicial'
    }));
    return;
  }

  // GET /license/plans
  if (pathname === '/license/plans' && req.method === 'GET') {
    const planHierarchy = ['BASIC', 'PROFESSIONAL', 'PREMIUM'];
    const planDescriptions = {
      BASIC: 'Ideal para pequeñas empresas comenzando con ISO',
      PROFESSIONAL: 'Para empresas que necesitan gestión completa ISO',
      PREMIUM: 'Máximo poder con IA y análisis predictivo'
    };

    const plans = planHierarchy.map((tier) => {
      // Obtener módulos disponibles en este tier
      const availableModules = Object.entries(MODULE_CONFIG)
        .filter(([_, config]) => {
          const tierIndex = planHierarchy.indexOf(tier);
          const requiredIndex = planHierarchy.indexOf(config.minPlan);
          return tierIndex >= requiredIndex;
        })
        .map(([_, config]) => config.name)
        .sort();

      // Obtener módulos NO disponibles en este tier
      const notAvailableModules = Object.entries(MODULE_CONFIG)
        .filter(([_, config]) => {
          const tierIndex = planHierarchy.indexOf(tier);
          const requiredIndex = planHierarchy.indexOf(config.minPlan);
          return tierIndex < requiredIndex;
        })
        .map(([_, config]) => config.name)
        .sort();

      return {
        tier,
        name: tier === 'BASIC' ? 'Básico' : tier === 'PROFESSIONAL' ? 'Profesional' : 'Premium',
        description: planDescriptions[tier],
        prices: {
          monthly: PLAN_PRICES.monthly[tier],
          annual: PLAN_PRICES.annual[tier],
          savings: Math.round((1 - PLAN_PRICES.annual[tier] / (PLAN_PRICES.monthly[tier] * 12)) * 100)
        },
        limits: PLAN_LIMITS[tier],
        features: [
          `Hasta ${PLAN_LIMITS[tier].maxUsers} usuarios`,
          ...availableModules
        ],
        notIncluded: notAvailableModules
      };
    });

    res.writeHead(200);
    res.end(JSON.stringify({ plans }));
    return;
  }

  // GET /license/subscription
  if (pathname === '/license/subscription' && req.method === 'GET') {
    res.writeHead(200);
    res.end(JSON.stringify({
      hasSubscription: true,
      planTier: 'PREMIUM',
      status: 'ACTIVE',
      startedAt: new Date(Date.now() - 86400000).toISOString(),
      endsAt: null,
      daysRemaining: null,
      isInGracePeriod: false,
      graceDaysRemaining: 0,
      isExpired: false
    }));
    return;
  }

  // POST /license/subscription
  if (pathname === '/license/subscription' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          subscription: {
            planTier: data.planTier,
            status: 'ACTIVE',
            message: 'Plan actualizado correctamente'
          }
        }));
      } catch (error) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid request' }));
      }
    });
    return;
  }

  // POST /license/setup/pay
  if (pathname === '/license/setup/pay' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          message: 'Setup pagado correctamente'
        }));
      } catch (error) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid request' }));
      }
    });
    return;
  }

  // ============================================
  // 404
  // ============================================
  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not found' }));
});

const PORT = 3001;

// 🔥 INICIAR SERVIDOR
loadData();

server.listen(PORT, '127.0.0.1', () => {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║  🚀 SGI 360 API - SERVIDOR INICIADO   ║');
  console.log('╚════════════════════════════════════════╝\n');
  console.log('🔗 API escuchando en: http://localhost:' + PORT);
  console.log('📡 Endpoints disponibles:');
  console.log('   GET  /documents              - Listar documentos');
  console.log('   GET  /documents/:id          - Documento específico');
  console.log('   GET  /dashboard              - Dashboard con estadísticas');
  console.log('   GET  /drills                 - Simulacros');
  console.log('   GET  /trainings              - Capacitaciones');
  console.log('   GET  /indicators             - Indicadores');
  console.log('   GET  /ncrs                   - NCRs');
  console.log('   GET  /normativos             - Normativos');
  console.log('   POST /api/auth/login         - Login\n');
  console.log('👤 Credenciales de prueba:');
  console.log('   Email: admin@sgi360.com');
  console.log('   Password: Admin123!\n');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n⏹️  Servidor apagándose...');
  server.close();
});

process.on('SIGINT', () => {
  console.log('\n⏹️  Servidor apagándose...');
  server.close();
});
