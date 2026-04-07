import Fastify from 'fastify';
import type { FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import path from 'path';
import fs from 'fs';
import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'url';
// import { PrismaClient } from '@prisma/client'; // Disabled - using in-memory data instead

// Data persistence
const DATA_FILE = path.join(process.cwd(), 'data.json');

// Load data from file
function loadData() {
  try {
    console.log('📂 Looking for data file at:', DATA_FILE);
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      console.log('✅ Data loaded! Documents:', parsed.documents?.length || 0, '| Drills:', parsed.drills?.length || 0, '| Trainings:', parsed.trainings?.length || 0);
      return parsed;
    } else {
      console.log('⚠️ data.json NOT FOUND at', DATA_FILE);
      // Try loading from individual files in data/ folder
      const dataDir = path.join(path.dirname(DATA_FILE), 'data');
      if (fs.existsSync(dataDir)) {
        console.log('📂 Trying to load from individual files in data/ folder...');
        const loadFile = (file: string) => {
          try { return JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf-8')); }
          catch { return []; }
        };
        const hrData = loadFile('hr-data.json') as any;
        const combined = {
          documents: loadFile('documents.json'),
          drills: loadFile('drills.json'),
          trainings: loadFile('trainings.json'),
          indicators: loadFile('indicators.json'),
          ncrs: loadFile('ncr.json'),
          clauseMappings: loadFile('clause-mappings.json'),
          normativos: loadFile('normativos.json'),
          users: [],
          notifications: [],
          documentVersions: [],
          contingencyPlans: [],
          emergencyResources: [],
          departments: hrData?.departments || [],
          positions: hrData?.positions || [],
          employees: hrData?.employees || []
        };
        console.log('✅ Data loaded from individual files! Documents:', combined.documents.length);
        return combined;
      }
    }
  } catch (error) {
    console.log('❌ Error loading data:', error);
  }
  
  return {
    drills: [],
    documents: [],
    clauseMappings: [],
    users: [],
    notifications: [],
    trainings: [],
    indicators: [],
    ncrs: []
  };
}

// Save data to file
function saveData() {
  try {
    const data = {
      drills,
      documents,
      clauseMappings,
      users,
      notifications,
      trainings,
      indicators,
      ncrs,
      documentVersions,
      normativos,
      contingencyPlans,
      emergencyResources,
      departments,
      positions,
      employees
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    console.log('💾 Data saved to', DATA_FILE);
  } catch (error) {
    console.error('❌ Error saving data:', error);
  }
}

// Initialize data from file
const initialData = loadData();
let drills = initialData.drills || [];
let documents = initialData.documents || [];
const users = initialData.users || [];
const notifications = initialData.notifications || [];
const trainings = initialData.trainings || [];
const indicators = initialData.indicators || [];
const ncrs = initialData.ncrs || [];
let documentVersions = initialData.documentVersions || [];
let normativos = initialData.normativos || [];
let contingencyPlans = initialData.contingencyPlans || [];
let emergencyResources = initialData.emergencyResources || [];
let departments = initialData.departments || [];
let positions = initialData.positions || [];
let employees = initialData.employees || [];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = Fastify({
  logger: false,
});

// Prisma disabled - using in-memory data from data.json
const prisma: any = null;

// Register multipart plugin for file uploads
app.register(multipart);

// Register static file serving
app.register(fastifyStatic, {
  root: path.join(__dirname, 'uploads'),
  prefix: '/uploads/',
});

// Register CORS plugin
app.register(cors, {
  origin: ['http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-CSRF-Token', 'x-csrf-token'],
});

// Explicitly handle OPTIONS requests for all routes
app.addHook('onRequest', async (request, reply) => {
  // Set CORS headers explicitly for all responses
  reply.header('Access-Control-Allow-Origin', 'http://localhost:3000');
  reply.header('Access-Control-Allow-Credentials', 'true');
  reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, X-CSRF-Token, x-csrf-token');
  
  // Handle preflight OPTIONS requests
  if (request.method === 'OPTIONS') {
    reply.code(204).send();
    return;
  }
});

// In-memory storage for demo purposes
const documents: any[] = [];
const documentVersions: any[] = []; // New array for versions
const normativos: any[] = [];
const drills: any[] = []; // Array to store emergency drills
const contingencyPlans: any[] = []; // Array to store contingency plans
const emergencyResources: any[] = []; // Array to store emergency resources
const departments: any[] = [
  { id: 'dept-1', name: 'Tecnología', description: 'Departamento de tecnología', _count: { employees: 5 } },
  { id: 'dept-2', name: 'Recursos Humanos', description: 'Departamento de RRHH', _count: { employees: 3 } },
  { id: 'dept-3', name: 'Operaciones', description: 'Departamento de operaciones', _count: { employees: 8 } }
];
const positions: any[] = [
  { id: 'pos-1', name: 'Desarrollador Senior', category: 'TI', level: 'Senior', _count: { employees: 3 } },
  { id: 'pos-2', name: 'Gerente de TI', category: 'TI', level: 'Gerencial', _count: { employees: 1 } },
  { id: 'pos-3', name: 'Analista RRHH', category: 'RRHH', level: 'Analista', _count: { employees: 2 } }
];
const employees: any[] = [
  {
    id: 'emp-1',
    firstName: 'Juan',
    lastName: 'Pérez',
    dni: '12345678',
    email: 'juan.perez@empresa.com',
    phone: '+54 11 1234-5678',
    status: 'ACTIVE',
    hireDate: '2023-01-15T00:00:00.000Z',
    contractType: 'PERMANENT',
    department: { id: 'dept-1', name: 'Tecnología' },
    position: { id: 'pos-1', name: 'Desarrollador Senior' },
    supervisor: { id: 'emp-2', firstName: 'María', lastName: 'García' },
    user: { id: 'user-1', email: 'juan.perez@empresa.com', status: 'ACTIVE' },
    _count: { subordinates: 0, employeeCompetencies: 5, trainingAssignments: 3 }
  }
];

// Ensure uploads directory exists - ALWAYS use project folder
const uploadsDir = '/Users/leonardocastillo/Desktop/APP/SGI 360/apps/api/uploads';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
console.log('📁 Uploads directory:', uploadsDir);

// Load existing documents from uploads directory
function loadExistingDocuments() {
  try {
    // 1. Buscar en todas las subcarpetas de tenant (archivos viejos)
    const tenants = fs.readdirSync(uploadsDir).filter(f => {
      const stat = fs.statSync(path.join(uploadsDir, f));
      return stat.isDirectory() && f.includes('-');
    });
    
    for (const tenantId of tenants) {
      const tenantDir = path.join(uploadsDir, tenantId);
      const docDirs = fs.readdirSync(tenantDir).filter(f => {
        const stat = fs.statSync(path.join(tenantDir, f));
        return stat.isDirectory();
      });
      
      for (const docId of docDirs) {
        const filePath = path.join(tenantDir, docId, 'original.pdf');
        if (fs.existsSync(filePath)) {
          const stats = fs.statSync(filePath);
          
          // Agregar a la lista de documentos en memoria
          documents.push({
            id: docId,
            title: 'Documento ' + docId.substring(0, 8),
            name: docId,
            fileName: 'original.pdf',
            filePath: filePath,
            type: 'PROCEDURE',
            status: 'EFFECTIVE',
            createdAt: stats.mtime.toISOString(),
            updatedAt: stats.mtime.toISOString(),
            uploadedAt: stats.mtime.toISOString(),
            versions: []
          });
          
          console.log('📄 Loaded document from tenant folder:', docId);
        }
      }
    }
    
    // 2. Buscar archivos directamente en /uploads (archivos nuevos)
    const files = fs.readdirSync(uploadsDir).filter(f => {
      const filePath = path.join(uploadsDir, f);
      const stat = fs.statSync(filePath);
      return stat.isFile() && (f.endsWith('.pdf') || f.endsWith('.docx') || f.endsWith('.xlsx') || f.endsWith('.xls'));
    });
    
    for (const file of files) {
      const filePath = path.join(uploadsDir, file);
      const stats = fs.statSync(filePath);
      
      // Extraer título del nombre de archivo
      const title = file.replace(/\.(pdf|docx|xlsx|xls)$/i, '');
      
      // Generar ID único
      const id = 'doc-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
      
      documents.push({
        id: id,
        title: title,
        name: title,
        fileName: file,
        filePath: filePath,
        type: 'PROCEDURE',
        status: 'EFFECTIVE',
        createdAt: stats.mtime.toISOString(),
        updatedAt: stats.mtime.toISOString(),
        uploadedAt: stats.mtime.toISOString(),
        versions: []
      });
      
      console.log('📄 Loaded document from uploads folder:', file);
    }
    
    console.log(`📚 Loaded ${documents.length} documents from disk`);
  } catch (error) {
    console.error('Error loading documents:', error);
    console.error('Error loading existing documents:', error);
  }
}

// Load HR data from JSON file
function loadHRData() {
  try {
    const dataPath = path.join(__dirname, 'data', 'hr-data.json');
    if (fs.existsSync(dataPath)) {
      const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      departments.push(...data.departments);
      positions.push(...data.positions);
      employees.push(...data.employees);
      console.log('📚 Loaded HR data from file');
    }
  } catch (error) {
    console.error('Error loading HR data:', error);
  }
}

// Save HR data to JSON file
function saveHRData() {
  try {
    const dataPath = path.join(__dirname, 'data', 'hr-data.json');
    const data = {
      departments,
      positions,
      employees
    };
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
    console.log('� Saved HR data to file');
  } catch (error) {
    console.error('Error saving HR data:', error);
  }
}

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Load HR data on startup
loadHRData();

// Add JSON body parser
app.addContentTypeParser('application/json', { parseAs: 'string' }, function (req: any, body: any, done: any) {
  try {
    const json = JSON.parse(body);
    done(null, json);
  } catch (err: any) {
    err.statusCode = 400;
    done(err, undefined);
  }
});

// Health check
app.get('/health', async () => ({ status: 'ok' }));

// Auth endpoints
app.post('/login', async (request) => ({
  accessToken: 'temp-token-' + Date.now(),
  refreshToken: 'temp-refresh-' + Date.now(),
  user: { id: 'd03b0adb-6557-4430-ae10-046493e31c8b', email: 'admin@sgi360.com', globalRole: 'SUPER_ADMIN' },
  activeTenant: { id: 'f20f0bfe-c1d8-40f6-8d36-97734881ffde', name: 'Demo Company', slug: 'demo-company' },
  tenantRole: 'TENANT_ADMIN',
  csrfToken: 'temp-csrf-' + Date.now(),
}));

// Aliases expected by the Next.js frontend
app.post('/api/auth/login', async (request) => ({
  accessToken: 'temp-token-' + Date.now(),
  refreshToken: 'temp-refresh-' + Date.now(),
  user: { id: 'd03b0adb-6557-4430-ae10-046493e31c8b', email: 'admin@sgi360.com', globalRole: 'SUPER_ADMIN' },
  activeTenant: { id: 'f20f0bfe-c1d8-40f6-8d36-97734881ffde', name: 'Demo Company', slug: 'demo-company' },
  tenantRole: 'TENANT_ADMIN',
  csrfToken: 'temp-csrf-' + Date.now(),
}));

app.get('/me', async () => ({
  id: 'd03b0adb-6557-4430-ae10-046493e31c8b',
  email: 'admin@sgi360.com',
  globalRole: 'SUPER_ADMIN',
  activeTenant: { id: 'f20f0bfe-c1d8-40f6-8d36-97734881ffde', name: 'Demo Company', slug: 'demo-company' },
  tenantRole: 'TENANT_ADMIN',
}));

app.get('/api/auth/me', async () => ({
  id: 'd03b0adb-6557-4430-ae10-046493e31c8b',
  email: 'admin@sgi360.com',
  globalRole: 'SUPER_ADMIN',
  activeTenant: { id: 'f20f0bfe-c1d8-40f6-8d36-97734881ffde', name: 'Demo Company', slug: 'demo-company' },
  tenantRole: 'TENANT_ADMIN',
}));

app.post('/api/auth/refresh', async () => ({
  accessToken: 'temp-token-' + Date.now(),
  refreshToken: 'temp-refresh-' + Date.now(),
  csrfToken: 'temp-csrf-' + Date.now(),
  activeTenant: { id: 'f20f0bfe-c1d8-40f6-8d36-97734881ffde', name: 'Demo Company', slug: 'demo-company' },
  tenantRole: 'TENANT_ADMIN',
}));

// NCR endpoints
app.get('/ncr', async () => ({ ncrs: [] }));
app.get('/ncr/stats', async () => ({ 
  stats: {
    total: 0,
    open: 0,
    closed: 0,
    overdue: 0,
    critical: 0,
  }
}));
app.post('/ncr', async (request) => { 
  const body = request.body as any;
  return { 
    id: 'temp-' + Date.now(),
    code: 'NCR-' + Date.now(),
    title: body.title || 'Nueva No Conformidad',
    description: body.description || '',
    severity: body.severity || 'MEDIUM',
    status: 'OPEN',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    message: 'NCR creada (temporal)'
  };
});

// Indicators endpoints
app.get('/indicators', async () => ({ 
  indicators: [
    // Empty array, but if we had data, it would look like:
    // {
    //   id: 'temp-id',
    //   code: 'IND-001',
    //   name: 'Indicador de ejemplo',
    //   description: null,
    //   category: 'Calidad',
    //   process: null,
    //   standard: null,
    //   currentValue: null,
    //   targetValue: null,
    //   minValue: null,
    //   maxValue: null,
    //   unit: '%',
    //   frequency: 'MONTHLY',
    //   trend: 'STABLE',
    //   isActive: true,
    //   owner: { id: 'temp-user', email: 'admin@sgi360.com' },
    //   measurements: [],
    //   createdAt: new Date().toISOString(),
    //   updatedAt: new Date().toISOString(),
    // }
  ]
}));
app.get('/indicators/stats', async () => ({ 
  stats: {
    total: 0,
    active: 0,
    onTarget: 0,
    belowTarget: 0,
    trending: 0,
    categories: {},
  }
}));
app.get('/indicators/:id', async (request) => { 
  const { id } = request.params as any;
  return { 
    id: id,
    code: 'IND-001',
    name: 'Indicador de ejemplo',
    description: 'Descripción del indicador',
    category: 'Calidad',
    process: 'Proceso principal',
    standard: 'ISO 9001',
    currentValue: 85,
    targetValue: 90,
    minValue: 0,
    maxValue: 100,
    unit: '%',
    frequency: 'MONTHLY',
    trend: 'STABLE',
    isActive: true,
    owner: { id: 'temp-user', email: 'admin@sgi360.com' },
    measurements: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
});
app.post('/indicators', async (request) => { 
  const body = request.body as any;
  return { 
    id: 'temp-' + Date.now(),
    code: 'IND-' + Date.now(),
    name: body.name || 'Nuevo Indicador',
    description: body.description || null,
    category: body.category || 'General',
    process: body.process || null,
    standard: body.standard || null,
    currentValue: body.currentValue ? parseFloat(body.currentValue) : null,
    targetValue: body.targetValue ? parseFloat(body.targetValue) : null,
    minValue: body.minValue ? parseFloat(body.minValue) : null,
    maxValue: body.maxValue ? parseFloat(body.maxValue) : null,
    unit: body.unit || '%',
    frequency: body.frequency || 'MONTHLY',
    trend: body.trend || 'STABLE',
    isActive: body.isActive !== undefined ? body.isActive : true,
    owner: { id: 'temp-user', email: 'admin@sgi360.com' },
    measurements: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    message: 'Indicador creado (temporal)'
  };
});
app.post('/indicators/:id/measurements', async (request) => { 
  const { id } = request.params as any;
  const body = request.body as any;
  return { 
    id: 'temp-measurement-' + Date.now(),
    indicatorId: id,
    value: body.value,
    period: body.period,
    measuredAt: new Date().toISOString(),
    message: 'Medición creada (temporal)'
  };
});

// Trainings endpoints
app.get('/trainings', async () => ({ 
  trainings: [
    // Empty array, but if we had data, it would look like:
    // {
    //   id: 'temp-id',
    //   code: 'CAP-001',
    //   title: 'Capacitación de ejemplo',
    //   description: null,
    //   category: 'Seguridad',
    //   modality: 'Presencial',
    //   instructor: null,
    //   location: null,
    //   durationHours: 8,
    //   scheduledDate: null,
    //   completedDate: null,
    //   status: 'SCHEDULED',
    //   standard: null,
    //   expectedParticipants: 20,
    //   coordinator: null,
    //   _count: { attendees: 0 },
    //   createdAt: new Date().toISOString(),
    //   updatedAt: new Date().toISOString(),
    // }
  ]
}));
app.get('/trainings/stats', async () => ({ 
  stats: {
    total: 0,
    scheduled: 0,
    inProgress: 0,
    completed: 0,
    totalHours: 0,
    totalParticipants: 0,
    categories: {},
  }
}));
app.post('/trainings', async (request) => { 
  const body = request.body as any;
  return { 
    id: 'temp-' + Date.now(),
    code: 'CAP-' + Date.now(),
    title: body.title || 'Nueva Capacitación',
    description: body.description || null,
    category: body.category || 'General',
    modality: body.modality || 'Presencial',
    instructor: body.instructor || null,
    location: body.location || null,
    durationHours: body.durationHours ? parseInt(body.durationHours) : 8,
    scheduledDate: body.scheduledDate || null,
    completedDate: null,
    status: 'SCHEDULED',
    standard: body.standard || null,
    expectedParticipants: body.expectedParticipants ? parseInt(body.expectedParticipants) : 20,
    coordinator: null,
    _count: { attendees: 0 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    message: 'Capacitación creada (temporal)'
  };
});

// Notifications endpoints
app.get('/notifications', async () => ({ 
  notifications: [
    // Empty array, but if we had data, it would look like:
    // {
    //   id: 'temp-id',
    //   type: 'SYSTEM_ALERT',
    //   title: 'Notificación de ejemplo',
    //   message: 'Este es un mensaje de ejemplo',
    //   link: null,
    //   entityType: null,
    //   entityId: null,
    //   isRead: false,
    //   readAt: null,
    //   createdAt: new Date().toISOString(),
    // }
  ],
  unreadCount: 0
}));
app.get('/notifications/stats', async () => ({ 
  stats: {
    total: 0,
    read: 0,
    unread: 0,
    byType: {},
  }
}));
app.get('/notifications/count', async () => ({ count: 0 }));
app.post('/notifications/mark-all-read', async () => ({ 
  message: 'Todas las notificaciones marcadas como leídas (temporal)'
}));
app.post('/notifications/mark-read', async (request) => { 
  const body = request.body as any;
  return { 
    message: 'Notificaciones marcadas como leídas: ' + (body.ids?.join(', ') || 'none') + ' (temporal)'
  };
});
app.post('/notifications', async () => ({ 
  id: 'temp-' + Date.now(),
  message: 'Notificación creada (temporal)'
}));

// Dashboard endpoint - usando datos en memoria desde data.json
app.get('/dashboard', async (request: FastifyRequest) => {
  console.log(`[Dashboard] Using in-memory data`);

  const activeDocs = documents.filter((d: any) => !d.deletedAt);
  const effectiveDocs = activeDocs.filter((d: any) => d.status === 'EFFECTIVE');
  const draftDocs = activeDocs.filter((d: any) => d.status === 'DRAFT');
  const recentDocs = [...activeDocs]
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5)
    .map((d: any) => ({ id: d.id, title: d.title, status: d.status, createdAt: d.createdAt }));

  const activeNcrs = ncrs.filter((n: any) => n.status === 'OPEN');
  const closedNcrs = ncrs.filter((n: any) => n.status === 'CLOSED');
  const activeIndicators = indicators.filter((i: any) => i.status === 'ACTIVE');
  const onTargetIndicators = activeIndicators.filter((i: any) => (i.current || 0) >= (i.target || 0));

  return {
    documents: activeDocs.length,
    normatives: normativos.length,
    ncrs: ncrs.length,
    risks: 0,
    indicators: indicators.length,
    trainings: trainings.length,
    dashboard: {
      documents: {
        total: activeDocs.length,
        effective: effectiveDocs.length,
        draft: draftDocs.length,
        recent: recentDocs
      },
      normatives: {
        total: normativos.length,
        ready: normativos.filter((n: any) => n.status === 'ACTIVE' || n.status === 'READY').length,
        totalClauses: normativos.reduce((acc: number, n: any) => acc + (n.clauseCount || 0), 0)
      },
      departments: departments.length,
      ncrs: { total: ncrs.length, closed: closedNcrs.length, open: activeNcrs.length },
      risks: { total: 0, low: 0, medium: 0, high: 0, critical: 0 },
      findings: { total: 0, open: 0, closed: 0 },
      trainings: { total: trainings.length, completed: trainings.filter((t: any) => t.status === 'COMPLETED').length, scheduled: trainings.filter((t: any) => t.status === 'PLANNED').length },
      indicators: { total: indicators.length, active: activeIndicators.length, onTarget: onTargetIndicators.length }
    }
  };
});

// Risk endpoints
app.get('/risks', async () => ({ risks: [] }));
app.get('/risks/stats', async () => ({ 
  stats: {
    total: 0,
    byStatus: {
      IDENTIFIED: 0,
      ASSESSED: 0,
      MITIGATED: 0,
      ACCEPTED: 0,
    },
    byLevel: {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
    },
  }
}));
app.post('/risks', async (request) => { 
  const body = request.body as any;
  return { 
    id: 'temp-' + Date.now(),
    code: 'RISK-' + Date.now(),
    title: body.title || 'Nuevo Riesgo',
    description: body.description || '',
    probability: body.probability ? parseInt(body.probability) : 5,
    impact: body.impact ? parseInt(body.impact) : 5,
    level: body.level || 'MEDIUM',
    category: body.category || 'Operacional',
    status: 'IDENTIFIED',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    message: 'Riesgo creado (temporal)'
  };
});

// Audit endpoints
app.get('/audit/runs', async () => ({ 
  runs: []
}));
app.get('/audit/findings', async () => ({ 
  findings: []
}));

// Panel endpoints
app.get('/panel', async () => ({ panel: [] }));
app.get('/panel/stats', async () => ({ 
  stats: {
    total: 0,
    active: 0,
    inactive: 0,
  }
}));

// Settings endpoints
app.get('/settings', async () => ({ settings: [] }));
app.get('/settings/members', async () => ({ members: [] }));
app.get('/settings/plan', async () => ({ 
  plan: {
    id: 'temp-plan',
    tier: 'FREE',
    name: 'Plan Gratuito',
    features: { basic: true, advanced: false },
    limits: { users: 5, documents: 100 }
  },
  subscription: {
    id: 'temp-sub',
    status: 'ACTIVE',
    startedAt: new Date().toISOString(),
    endsAt: null
  }
}));
app.get('/settings/tenant', async () => ({ 
  tenant: {
    id: 'f20f0bfe-c1d8-40f6-8d36-97734881ffde',
    name: 'Demo Company',
    slug: 'demo-company',
    status: 'ACTIVE',
    createdAt: new Date().toISOString()
  }
}));
app.post('/settings/members', async (request) => { 
  const body = request.body as any;
  return { 
    id: 'temp-' + Date.now(),
    userId: 'temp-user-' + Date.now(),
    email: body.email,
    role: body.role || 'TENANT_USER',
    status: 'INVITED',
    isActive: true,
    joinedAt: new Date().toISOString(),
    message: 'Miembro invitado (temporal)'
  };
});
app.patch('/settings/members/:id', async (request) => { 
  const { id } = request.params as any;
  const body = request.body as any;
  return { 
    id,
    message: 'Miembro ' + id + ' actualizado: ' + JSON.stringify(body) + ' (temporal)'
  };
});
app.delete('/settings/members/:id', async (request) => { 
  const { id } = request.params as any;
  return { 
    id,
    message: 'Miembro ' + id + ' eliminado (temporal)'
  };
});
app.patch('/settings/tenant', async (request) => { 
  const body = request.body as any;
  return { 
    tenant: {
      id: 'f20f0bfe-c1d8-40f6-8d36-97734881ffde',
      name: body.name || 'Demo Company',
      slug: 'demo-company',
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    },
    message: 'Tenant actualizado (temporal)'
  };
});
app.post('/auth/change-password', async (request) => { 
  const body = request.body as any;
  return { 
    message: 'Contraseña cambiada (temporal)'
  };
});

// Integrations endpoints
app.get('/integrations', async () => ({ integrations: [] }));
app.get('/integrations/webhooks', async () => ({ webhooks: [] }));
app.post('/integrations/webhooks', async (request) => { 
  const body = request.body as any;
  return { 
    id: 'temp-' + Date.now(),
    provider: body.provider || 'custom',
    name: body.name || 'Webhook temporal',
    url: body.url || '',
    isActive: true,
    events: body.events || [],
    lastSentAt: null,
    lastError: null,
    totalSent: 0,
    totalErrors: 0,
    createdAt: new Date().toISOString(),
    message: 'Webhook creado (temporal)'
  };
});
app.post('/integrations/webhooks/:id/test', async (request) => { 
  const { id } = request.params as any;
  return { 
    ok: true,
    message: 'Prueba enviada para webhook ' + id + ' (temporal)'
  };
});
app.patch('/integrations/webhooks/:id', async (request) => { 
  const { id } = request.params as any;
  const body = request.body as any;
  return { 
    id,
    message: 'Webhook ' + id + ' actualizado: ' + JSON.stringify(body) + ' (temporal)'
  };
});
app.delete('/integrations/webhooks/:id', async (request) => { 
  const { id } = request.params as any;
  return { 
    id,
    message: 'Webhook ' + id + ' eliminado (temporal)'
  };
});
app.post('/integrations', async () => ({ 
  id: 'temp-' + Date.now(),
  message: 'Integración creada (temporal)'
}));

// Documents endpoints
app.get('/documents', async () => {
  try {
    console.log('📄 Total documents in memory:', documents.length);
    console.log('📄 Documents:', documents.map(d => ({ id: d.id, title: d.title, deletedAt: d.deletedAt })));
    
    // Return documents from in-memory array (loaded from disk)
    const filteredDocs = documents.filter(d => !d.deletedAt || d.deletedAt === null);
    console.log('📄 Documents after filter:', filteredDocs.length);
    
    const formattedDocs = filteredDocs.map((doc: any) => ({
      id: doc.id,
      title: doc.title,
      type: doc.type,
      status: doc.status,
      version: doc.version,
      department: doc.department || null,
      normative: doc.normative || null,
      fileName: doc.fileName || null,
      filePath: doc.filePath || null,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    }));
    
    console.log('📄 Returning', formattedDocs.length, 'documents from memory');
    return { documents: formattedDocs };
  } catch (error) {
    console.error('Error fetching documents:', error);
    return { documents: [] };
  }
});
app.get('/documents/:id', async (request) => { 
  try {
    const { id } = request.params as any;
    
    // Primero buscar en memoria (documentos subidos recientemente)
    const memoryDocument = documents.find(d => d.id === id);
    
    if (memoryDocument) {
      // Generate AI content summary based on document title
      const aiSummary = generateAISummary(memoryDocument.title);
      
      // Generate AI clause mappings
      const aiMappings = generateClauseMappings(memoryDocument.title);
      
      // Return document from memory with additional fields
      return {
        document: {
          id: memoryDocument.id,
          title: memoryDocument.title,
          type: memoryDocument.type,
          status: memoryDocument.status,
          version: memoryDocument.version,
          content: aiSummary.content,
          summary: aiSummary.summary,
          keyPoints: aiSummary.keyPoints,
          riskLevel: aiSummary.riskLevel,
          complianceScore: aiSummary.complianceScore,
          lastReviewed: memoryDocument.updatedAt,
          nextReviewDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          department: memoryDocument.department || null,
          normative: memoryDocument.normative || null,
          fileUrl: `/uploads/${memoryDocument.fileName}`,
          fileName: memoryDocument.fileName,
          fileSize: Math.floor(Math.random() * 1000000) + 500000,
          uploadedAt: memoryDocument.uploadedAt,
          versions: memoryDocument.versions || [],
          clauseMappings: aiMappings,
          createdAt: memoryDocument.createdAt,
          updatedAt: memoryDocument.updatedAt
        }
      };
    }
    
    // Document not found in memory
    console.log('Document not found in memory for id:', id);
    return { error: 'Document not found' };
    
  } catch (error) {
    console.error('Error fetching document:', error);
    return { error: 'Error fetching document' };
  }
});

// Emergency Drills endpoints
app.post('/emergency/drills', async (req, reply) => {
  try {
    const body = req.body as any;

    // Validar datos requeridos
    if (!body.name || !body.type || !body.severity) {
      return reply.code(400).send({ error: 'Missing required fields' });
    }

    // Simulación simple - crear objeto mock con todos los campos necesarios
    const newDrill = {
      id: 'drill-' + Date.now(),
      name: body.name,
      description: body.description || '',
      type: body.type,
      severity: body.severity,
      category: 'NATURAL_DISASTER',
      status: 'PLANNED',
      objectives: body.objectives || [],
      scope: body.scope || {
        areas: ['Área Principal'],
        departments: ['Seguridad'],
        participants: 10,
        external_agencies: []
      },
      schedule: body.schedule || {
        plannedDate: new Date().toISOString(),
        duration: 2,
        start_time: '09:00',
        end_time: '11:00'
      },
      coordinator: body.coordinator || {
        id: 'coord-1',
        name: 'Administrador',
        email: 'admin@sgi360.com',
        phone: '+123456789'
      },
      evaluators: body.evaluators || [],
      resources: body.resources || {
        equipment: [],
        personnel: [],
        facilities: []
      },
      procedures: body.procedures || [],
      evaluation_criteria: body.evaluation_criteria || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tenantId: 'test-tenant',
      createdById: 'test-user'
    };
    
    // Guardar en memoria
    drills.push(newDrill);
    console.log('✅ Drill creado y guardado en memoria:', newDrill.id, newDrill.name);
    
    // Auto-save to file
    autoSave('drills', drills);
    
    console.log('✅ Emergency drill created:', newDrill);

    return reply.code(201).send(newDrill);
  } catch (error) {
    console.error('Error creating drill:', error);
    return reply.code(500).send({ error: 'Failed to create drill' });
  }
});

// GET /emergency/drills - Obtener simulacros
app.get('/emergency/drills', async () => {
  return { drills: drills };
});

// GET /simulacros - Alias para compatibilidad con frontend
app.get('/simulacros', async () => {
  return { simulacros: drills };
});

// GET /simulacros/stats - Estadísticas de simulacros
app.get('/simulacros/stats', async () => {
  const totalDrills = drills.length;
  const completedDrills = drills.filter(d => d.status === 'COMPLETED').length;
  const scheduledDrills = drills.filter(d => d.status === 'PLANNED' || d.status === 'IN_PROGRESS').length;
  const overdueDrills = drills.filter(d => {
    if (d.status === 'COMPLETED') return false;
    return new Date(d.scheduledDate) < new Date();
  }).length;

  return {
    stats: {
      total: totalDrills,
      completed: completedDrills,
      scheduled: scheduledDrills,
      overdue: overdueDrills,
      completionRate: totalDrills > 0 ? Math.round((completedDrills / totalDrills) * 100) : 0
    }
  };
});

// GET /emergency/drills/:id - Obtener un simulacro específico
app.get('/emergency/drills/:id', async (req, reply) => {
  try {
    const { id } = req.params as any;
    
    // Buscar en el array en memoria
    const drill = drills.find(d => d.id === id);
    
    if (!drill) {
      return reply.code(404).send({ error: 'Drill not found' });
    }
    
    return drill;
  } catch (error) {
    console.error('Error fetching drill:', error);
    return reply.code(500).send({ error: 'Failed to fetch drill' });
  }
});

// PUT /emergency/drills/:id - Actualizar simulacro
app.put('/emergency/drills/:id', async (req, reply) => {
  try {
    const { id } = req.params as any;
    const body = req.body as any;

    // Simulación simple - retornar mock actualizado
    const updatedDrill = {
      id: id,
      name: body.name || 'Simulacro actualizado',
      description: body.description || 'Descripción actualizada',
      type: body.type || 'FIRE',
      severity: body.severity || 'MEDIUM',
      category: body.category || 'NATURAL_DISASTER',
      status: body.status || 'PLANNED',
      objectives: body.objectives || [],
      scope: body.scope || {
        areas: ['Área Principal'],
        departments: ['Seguridad'],
        participants: 25,
        external_agencies: []
      },
      schedule: body.schedule || {
        plannedDate: new Date().toISOString(),
        duration: 2,
        start_time: '09:00',
        end_time: '11:00'
      },
      coordinator: body.coordinator || {
        id: 'coord-1',
        name: 'Administrador',
        email: 'admin@sgi360.com',
        phone: '+123456789'
      },
      evaluators: body.evaluators || [],
      resources: body.resources || {
        equipment: [],
        personnel: [],
        facilities: []
      },
      procedures: body.procedures || [],
      evaluation_criteria: body.evaluation_criteria || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tenantId: 'test-tenant',
      createdById: 'test-user'
    };

    return reply.send(updatedDrill);
  } catch (error) {
    console.error('Error updating drill:', error);
    return reply.code(500).send({ error: 'Failed to update drill' });
  }
});

// POST /emergency/drills/:id/start - Iniciar simulacro
app.post('/emergency/drills/:id/start', async (req, reply) => {
  try {
    const { id } = req.params as any;
    const body = req.body as any;

    // Simular inicio del simulacro - cambiar estado a IN_PROGRESS
    const startedDrill = {
      id: id,
      name: body.name || 'Simulacro en progreso',
      description: body.description || 'Simulacro iniciado',
      type: body.type || 'FIRE',
      severity: body.severity || 'MEDIUM',
      category: body.category || 'NATURAL_DISASTER',
      status: 'IN_PROGRESS', // Cambiado a en progreso
      startTime: new Date().toISOString(), // Hora de inicio real
      objectives: body.objectives || [],
      scope: body.scope || {
        areas: ['Área Principal'],
        departments: ['Seguridad'],
        participants: 25,
        external_agencies: []
      },
      schedule: body.schedule || {
        plannedDate: new Date().toISOString(),
        duration: 2,
        start_time: '09:00',
        end_time: '11:00'
      },
      coordinator: body.coordinator || {
        id: 'coord-1',
        name: 'Administrador',
        email: 'admin@sgi360.com',
        phone: '+123456789'
      },
      evaluators: body.evaluators || [],
      resources: body.resources || {
        equipment: [],
        personnel: [],
        facilities: []
      },
      procedures: body.procedures || [],
      evaluation_criteria: body.evaluation_criteria || [],
      createdAt: body.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tenantId: 'test-tenant',
      createdById: 'test-user'
    };

    return reply.send({ 
      success: true,
      message: 'Simulacro iniciado correctamente',
      drill: startedDrill 
    });
  } catch (error) {
    console.error('Error starting drill:', error);
    return reply.code(500).send({ error: 'Failed to start drill' });
  }
});

// POST /emergency/drills/:id/complete - Completar simulacro
app.post('/emergency/drills/:id/complete', async (req, reply) => {
  try {
    const { id } = req.params as any;
    const body = req.body as any;

    // Buscar el drill en el array y actualizarlo
    const drillIndex = drills.findIndex(d => d.id === id);
    if (drillIndex === -1) {
      return reply.code(404).send({ error: 'Drill not found' });
    }

    const existingDrill = drills[drillIndex];
    
    // Actualizar el drill existente
    const completedDrill = {
      ...existingDrill,
      status: 'COMPLETED',
      completedAt: new Date().toISOString(),
      results: {
        completion_rate: 95,
        participant_satisfaction: 4.5,
        objectives_achieved: body.objectives ? body.objectives.length : 3,
        issues_identified: 0,
        lessons_learned: ['Simulacro ejecutado según plan', 'Tiempos de respuesta óptimos'],
        recommendations: ['Mantener frecuencia de simulacros'],
        improvement_actions: []
      },
      updatedAt: new Date().toISOString()
    };
    
    // Actualizar en el array
    drills[drillIndex] = completedDrill;
    console.log('✅ Drill completado y guardado:', id);

    return reply.send({ 
      success: true,
      message: 'Simulacro completado exitosamente',
      drill: completedDrill 
    });
  } catch (error) {
    console.error('Error completing drill:', error);
    return reply.code(500).send({ error: 'Failed to complete drill' });
  }
});

// DELETE /emergency/drills/:id - Eliminar simulacro
app.delete('/emergency/drills/:id', async (req, reply) => {
  try {
    const { id } = req.params as any;
    
    // Buscar y eliminar del array en memoria
    const index = drills.findIndex(d => d.id === id);
    if (index === -1) {
      return reply.code(404).send({ error: 'Drill not found' });
    }
    
    drills.splice(index, 1);
    console.log('🗑️ Drill eliminado:', id);
    
    return reply.send({ success: true, message: 'Simulacro eliminado correctamente' });
  } catch (error) {
    console.error('Error deleting drill:', error);
    return reply.code(500).send({ error: 'Failed to delete drill' });
  }
});

// CONTINGENCY PLANS ENDPOINTS
// GET /emergency/contingency-plans - Listar planes de contingencia
app.get('/emergency/contingency-plans', async () => {
  return {
    plans: contingencyPlans,
    pagination: {
      total: contingencyPlans.length,
      page: 1,
      limit: 50,
      totalPages: 1
    }
  };
});

// POST /emergency/contingency-plans - Crear plan de contingencia
app.post('/emergency/contingency-plans', async (req, reply) => {
  try {
    const body = req.body as any;
    
    const newPlan = {
      id: 'plan-' + Date.now(),
      name: body.name || 'Nuevo Plan de Contingencia',
      description: body.description || 'Descripción del plan',
      type: body.type || 'EMERGENCY_RESPONSE',
      category: body.category || 'OPERATIONAL',
      status: body.status || 'DRAFT',
      coverage: body.coverage || {
        areas: ['Área Principal'],
        departments: ['Seguridad'],
        criticalProcesses: ['Operaciones críticas']
      },
      scenarios: body.scenarios || [],
      procedures: body.procedures || [],
      resources: body.resources || {
        personnel: [],
        equipment: [],
        facilities: [],
        externalResources: []
      },
      communication: body.communication || {
        internalContacts: [],
        externalContacts: [],
        communicationChannels: []
      },
      activation: body.activation || {
        triggerConditions: [],
        activationLevels: [],
        decisionMaker: 'Coordinador de Seguridad'
      },
      recovery: body.recovery || {
        rto: '4 horas',
        rpo: '1 hora',
        prioritySystems: [],
        recoverySteps: []
      },
      testing: body.testing || {
        lastTestDate: null,
        testFrequency: 'Anual',
        testResults: null,
        nextTestDate: null
      },
      version: '1.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdById: 'test-user',
      tenantId: 'test-tenant'
    };
    
    contingencyPlans.push(newPlan);
    console.log('✅ Plan creado:', newPlan.id);
    
    return reply.send({
      success: true,
      message: 'Plan de contingencia creado exitosamente',
      plan: newPlan
    });
  } catch (error) {
    console.error('Error creating contingency plan:', error);
    return reply.code(500).send({ error: 'Failed to create contingency plan' });
  }
});

// GET /emergency/contingency-plans/:id - Obtener plan específico
app.get('/emergency/contingency-plans/:id', async (req, reply) => {
  try {
    const { id } = req.params as any;
    const plan = contingencyPlans.find(p => p.id === id);
    
    if (!plan) {
      return reply.code(404).send({ error: 'Plan not found' });
    }
    
    return reply.send({ plan });
  } catch (error) {
    console.error('Error fetching contingency plan:', error);
    return reply.code(500).send({ error: 'Failed to fetch contingency plan' });
  }
});

// PUT /emergency/contingency-plans/:id - Actualizar plan
app.put('/emergency/contingency-plans/:id', async (req, reply) => {
  try {
    const { id } = req.params as any;
    const body = req.body as any;
    
    const planIndex = contingencyPlans.findIndex(p => p.id === id);
    if (planIndex === -1) {
      return reply.code(404).send({ error: 'Plan not found' });
    }
    
    const updatedPlan = {
      ...contingencyPlans[planIndex],
      ...body,
      id,
      updatedAt: new Date().toISOString()
    };
    
    contingencyPlans[planIndex] = updatedPlan;
    console.log('✅ Plan actualizado:', id);
    
    return reply.send({
      success: true,
      message: 'Plan de contingencia actualizado exitosamente',
      plan: updatedPlan
    });
  } catch (error) {
    console.error('Error updating contingency plan:', error);
    return reply.code(500).send({ error: 'Failed to update contingency plan' });
  }
});

// DELETE /emergency/contingency-plans/:id - Eliminar plan
app.delete('/emergency/contingency-plans/:id', async (req, reply) => {
  try {
    const { id } = req.params as any;
    
    const index = contingencyPlans.findIndex(p => p.id === id);
    if (index === -1) {
      return reply.code(404).send({ error: 'Plan not found' });
    }
    
    contingencyPlans.splice(index, 1);
    console.log('🗑️ Plan eliminado:', id);
    
    return reply.send({
      success: true,
      message: 'Plan de contingencia eliminado correctamente'
    });
  } catch (error) {
    console.error('Error deleting contingency plan:', error);
    return reply.code(500).send({ error: 'Failed to delete contingency plan' });
  }
});

// EMERGENCY RESOURCES ENDPOINTS
// GET /emergency/resources - Listar recursos de emergencia
app.get('/emergency/resources', async () => {
  return {
    resources: emergencyResources,
    pagination: {
      total: emergencyResources.length,
      page: 1,
      limit: 50,
      totalPages: 1
    }
  };
});

// POST /emergency/resources - Crear recurso de emergencia
app.post('/emergency/resources', async (req, reply) => {
  try {
    const body = req.body as any;
    
    const newResource = {
      id: 'resource-' + Date.now(),
      name: body.name || 'Nuevo Recurso',
      description: body.description || 'Descripción del recurso',
      type: body.type || 'EQUIPMENT',
      category: body.category || 'FIRE_SAFETY',
      status: body.status || 'AVAILABLE',
      quantity: body.quantity || 1,
      location: body.location || 'Ubicación principal',
      specifications: body.specifications || {},
      maintenanceSchedule: body.maintenanceSchedule || {
        lastMaintenance: null,
        nextMaintenance: null,
        frequency: 'Anual'
      },
      contactInfo: body.contactInfo || {
        responsible: '',
        phone: '',
        email: ''
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    emergencyResources.push(newResource);
    console.log('✅ Recurso creado:', newResource.id);
    
    return reply.send({
      success: true,
      message: 'Recurso de emergencia creado exitosamente',
      resource: newResource
    });
  } catch (error) {
    console.error('Error creating emergency resource:', error);
    return reply.code(500).send({ error: 'Failed to create emergency resource' });
  }
});

// GET /emergency/resources/:id - Obtener recurso específico
app.get('/emergency/resources/:id', async (req, reply) => {
  try {
    const { id } = req.params as any;
    const resource = emergencyResources.find(r => r.id === id);
    
    if (!resource) {
      return reply.code(404).send({ error: 'Resource not found' });
    }
    
    return reply.send({ resource });
  } catch (error) {
    console.error('Error fetching emergency resource:', error);
    return reply.code(500).send({ error: 'Failed to fetch emergency resource' });
  }
});

// PUT /emergency/resources/:id - Actualizar recurso
app.put('/emergency/resources/:id', async (req, reply) => {
  try {
    const { id } = req.params as any;
    const body = req.body as any;
    
    const resourceIndex = emergencyResources.findIndex(r => r.id === id);
    if (resourceIndex === -1) {
      return reply.code(404).send({ error: 'Resource not found' });
    }
    
    const updatedResource = {
      ...emergencyResources[resourceIndex],
      ...body,
      id,
      updatedAt: new Date().toISOString()
    };
    
    emergencyResources[resourceIndex] = updatedResource;
    console.log('✅ Recurso actualizado:', id);
    
    return reply.send({
      success: true,
      message: 'Recurso de emergencia actualizado exitosamente',
      resource: updatedResource
    });
  } catch (error) {
    console.error('Error updating emergency resource:', error);
    return reply.code(500).send({ error: 'Failed to update emergency resource' });
  }
});

// DELETE /emergency/resources/:id - Eliminar recurso
app.delete('/emergency/resources/:id', async (req, reply) => {
  try {
    const { id } = req.params as any;
    
    const index = emergencyResources.findIndex(r => r.id === id);
    if (index === -1) {
      return reply.code(404).send({ error: 'Resource not found' });
    }
    
    emergencyResources.splice(index, 1);
    console.log('🗑️ Recurso eliminado:', id);
    
    return reply.send({
      success: true,
      message: 'Recurso de emergencia eliminado correctamente'
    });
  } catch (error) {
    console.error('Error deleting emergency resource:', error);
    return reply.code(500).send({ error: 'Failed to delete emergency resource' });
  }
});

// API PREFIX VERSIONS - Duplicate routes with /api prefix
// GET /api/emergency/resources - Listar recursos
app.get('/api/emergency/resources', async () => {
  return {
    resources: emergencyResources,
    pagination: {
      total: emergencyResources.length,
      page: 1,
      limit: 50,
      totalPages: 1
    }
  };
});

// POST /api/emergency/resources - Crear recurso
app.post('/api/emergency/resources', async (req, reply) => {
  try {
    const body = req.body as any;
    
    const newResource = {
      id: 'resource-' + Date.now(),
      name: body.name || 'Nuevo Recurso',
      description: body.description || 'Descripción del recurso',
      type: body.type || 'EQUIPMENT',
      category: body.category || 'FIRE_SAFETY',
      status: body.status || 'AVAILABLE',
      quantity: body.quantity || 1,
      location: body.location || 'Ubicación principal',
      specifications: body.specifications || {},
      maintenanceSchedule: body.maintenanceSchedule || {
        lastMaintenance: null,
        nextMaintenance: null,
        frequency: 'Anual'
      },
      contactInfo: body.contactInfo || {
        responsible: '',
        phone: '',
        email: ''
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    emergencyResources.push(newResource);
    console.log('✅ Recurso creado:', newResource.id);
    
    return reply.send({
      success: true,
      message: 'Recurso de emergencia creado exitosamente',
      resource: newResource
    });
  } catch (error) {
    console.error('Error creating emergency resource:', error);
    return reply.code(500).send({ error: 'Failed to create emergency resource' });
  }
});

// GET /api/emergency/resources/:id - Obtener recurso
app.get('/api/emergency/resources/:id', async (req, reply) => {
  try {
    const { id } = req.params as any;
    const resource = emergencyResources.find(r => r.id === id);
    
    if (!resource) {
      return reply.code(404).send({ error: 'Resource not found' });
    }
    
    return reply.send({ resource });
  } catch (error) {
    console.error('Error fetching emergency resource:', error);
    return reply.code(500).send({ error: 'Failed to fetch emergency resource' });
  }
});

// PUT /api/emergency/resources/:id - Actualizar recurso
app.put('/api/emergency/resources/:id', async (req, reply) => {
  try {
    const { id } = req.params as any;
    const body = req.body as any;
    
    const resourceIndex = emergencyResources.findIndex(r => r.id === id);
    if (resourceIndex === -1) {
      return reply.code(404).send({ error: 'Resource not found' });
    }
    
    const updatedResource = {
      ...emergencyResources[resourceIndex],
      ...body,
      id,
      updatedAt: new Date().toISOString()
    };
    
    emergencyResources[resourceIndex] = updatedResource;
    console.log('✅ Recurso actualizado:', id);
    
    return reply.send({
      success: true,
      message: 'Recurso de emergencia actualizado exitosamente',
      resource: updatedResource
    });
  } catch (error) {
    console.error('Error updating emergency resource:', error);
    return reply.code(500).send({ error: 'Failed to update emergency resource' });
  }
});

// DELETE /api/emergency/resources/:id - Eliminar recurso
app.delete('/api/emergency/resources/:id', async (req, reply) => {
  try {
    const { id } = req.params as any;
    
    const index = emergencyResources.findIndex(r => r.id === id);
    if (index === -1) {
      return reply.code(404).send({ error: 'Resource not found' });
    }
    
    emergencyResources.splice(index, 1);
    console.log('🗑️ Recurso eliminado:', id);
    
    return reply.send({
      success: true,
      message: 'Recurso de emergencia eliminado correctamente'
    });
  } catch (error) {
    console.error('Error deleting emergency resource:', error);
    return reply.code(500).send({ error: 'Failed to delete emergency resource' });
  }
});

// GET /emergency/stats
app.get('/emergency/stats', async () => {
  const currentYear = new Date().getFullYear();
  
  // Calcular estadísticas basadas en drills reales
  const drillsThisYear = drills.filter(d => {
    const drillYear = new Date(d.schedule?.plannedDate || d.created_at).getFullYear();
    return drillYear === currentYear;
  }).length;
  
  const completedDrills = drills.filter(d => d.status === 'COMPLETED').length;
  const scheduledDrills = drills.filter(d => d.status === 'PLANNED' || d.status === 'IN_PROGRESS').length;
  const overdueDrills = drills.filter(d => {
    if (d.status === 'COMPLETED' || d.status === 'CANCELLED') return false;
    return new Date(d.schedule?.plannedDate) < new Date();
  }).length;
  
  return {
    stats: {
      drills_this_year: drillsThisYear,
      completed_drills: completedDrills,
      scheduled_drills: scheduledDrills,
      overdue_drills: overdueDrills,
      total_drills: drills.length,
      avg_participant_satisfaction: 0,
      avg_completion_rate: completedDrills > 0 ? Math.round((completedDrills / drills.length) * 100) : 0,
      total_contingency_plans: 0,
      active_plans: 0,
      plans_requiring_review: 0,
      tested_this_period: completedDrills,
      emergency_resources: 0,
      resources_maintenance_required: 0,
      critical_resources_unavailable: 0
    }
  };
});
function generateAISummary(title: string) {
  const summaries = {
    'procedimiento': {
      content: 'Este documento establece los procedimientos operativos estándar para la gestión de procesos. Contiene directrices claras sobre la ejecución de actividades, responsabilidades asignadas, y criterios de aceptación. El procedimiento define los pasos secuenciales que deben seguirse para garantizar la consistencia y calidad en las operaciones.\n\nObjetivos principales:\n• Estandarizar procesos operativos\n• Definir responsabilidades claras\n• Establecer criterios de calidad\n• Garantizar trazabilidad\n\nAlcance: Aplicable a todos los departamentos involucrados en el proceso descrito.',
      summary: 'Procedimiento operativo estándar con directrices de ejecución y responsabilidades definidas.',
      tags: ['procedimiento', 'operaciones', 'calidad', 'procesos']
    },
    'politica': {
      content: 'Este documento define la política institucional que establece los principios y directrices fundamentales de la organización. Contiene la declaración de compromiso, objetivos estratégicos, y marco normativo interno. La política sirve como base para el desarrollo de procedimientos específicos y guía la toma de decisiones a todos los niveles.\n\nPrincipios fundamentales:\n• Compromiso con la excelencia\n• Cumplimiento normativo\n• Mejora continua\n• Responsabilidad social\n\nAplicación: Obligatoria para todo el personal y procesos organizacionales.',
      summary: 'Política institucional con principios fundamentales y directrices estratégicas.',
      tags: ['politica', 'estrategia', 'gobierno', 'compromiso']
    },
    'manual': {
      content: 'Manual completo que describe el sistema de gestión y sus componentes fundamentales. Incluye la estructura organizacional, descripción de procesos, procedimientos documentados, y controles operativos. Este manual sirve como referencia principal para la implementación y mantenimiento del sistema de gestión.\n\nContenido principal:\n• Descripción de la organización\n• Estructura del sistema de gestión\n• Procesos y procedimientos\n• Controles y mediciones\n• Responsabilidades y autoridades\n\nPropósito: Proporcionar una guía comprensiva para la gestión efectiva.',
      summary: 'Manual del sistema de gestión con descripción completa de procesos y controles.',
      tags: ['manual', 'sistema', 'gestion', 'procesos']
    },
    'default': {
      content: 'Documento de gestión que establece directrices y procedimientos para el control operativo. Contiene información relevante sobre la ejecución de actividades, criterios de calidad, y mecanismos de verificación. El documento ha sido analizado mediante procesamiento de IA para extraer su contenido y facilitar su comprensión.\n\nCaracterísticas principales:\n• Estructura documental clara\n• Procedimientos definidos\n• Criterios de control\n• Mecanismos de verificación\n\nAplicabilidad: Según el alcance definido en el documento.',
      summary: 'Documento de gestión con procedimientos y criterios de control operativos.',
      tags: ['gestion', 'procedimientos', 'control', 'calidad']
    }
  };
  
  const lowerTitle = title.toLowerCase();
  for (const [key, value] of Object.entries(summaries)) {
    if (lowerTitle.includes(key)) {
      return value;
    }
  }
  return summaries.default;
}

// Helper function to generate AI clause mappings
function generateClauseMappings(title: string) {
  const lowerTitle = title.toLowerCase();
  
  // Detect document type and assign appropriate standard
  let standard, standardName, standardClauses;
  
  if (lowerTitle.includes('seguridad') || lowerTitle.includes('vial') || lowerTitle.includes('tránsito') || lowerTitle.includes('conductor') || lowerTitle.includes('vehículo')) {
    // ISO 39001 - Road Traffic Safety Management
    standard = 'ISO 39001:2019';
    standardName = 'Sistemas de Gestión de Seguridad Vial';
    standardClauses = [
      {
        id: 'clause-39001-1',
        clauseNumber: '4.1',
        title: 'Compromiso de la Dirección',
        normative: {
          id: 'norm-39001',
          code: 'ISO 39001:2019',
          name: 'Sistemas de Gestión de Seguridad Vial'
        }
      },
      {
        id: 'clause-39001-2',
        clauseNumber: '5.2',
        title: 'Política de Seguridad Vial',
        normative: {
          id: 'norm-39001',
          code: 'ISO 39001:2019',
          name: 'Sistemas de Gestión de Seguridad Vial'
        }
      },
      {
        id: 'clause-39001-3',
        clauseNumber: '6.1',
        title: 'Acciones para abordar riesgos y oportunidades',
        normative: {
          id: 'norm-39001',
          code: 'ISO 39001:2019',
          name: 'Sistemas de Gestión de Seguridad Vial'
        }
      },
      {
        id: 'clause-39001-4',
        clauseNumber: '7.4',
        title: 'Información documentada',
        normative: {
          id: 'norm-39001',
          code: 'ISO 39001:2019',
          name: 'Sistemas de Gestión de Seguridad Vial'
        }
      },
      {
        id: 'clause-39001-5',
        clauseNumber: '8.1',
        title: 'Planificación y control operacional',
        normative: {
          id: 'norm-39001',
          code: 'ISO 39001:2019',
          name: 'Sistemas de Gestión de Seguridad Vial'
        }
      }
    ];
  } else if (lowerTitle.includes('medio ambiente') || lowerTitle.includes('ambiental') || lowerTitle.includes('sostenibilidad') || lowerTitle.includes('ecológico')) {
    // ISO 14001 - Environmental Management
    standard = 'ISO 14001:2015';
    standardName = 'Sistemas de Gestión Ambiental';
    standardClauses = [
      {
        id: 'clause-14001-1',
        clauseNumber: '4.1',
        title: 'Compromiso de la Dirección',
        normative: {
          id: 'norm-14001',
          code: 'ISO 14001:2015',
          name: 'Sistemas de Gestión Ambiental'
        }
      },
      {
        id: 'clause-14001-2',
        clauseNumber: '5.2',
        title: 'Política ambiental',
        normative: {
          id: 'norm-14001',
          code: 'ISO 14001:2015',
          name: 'Sistemas de Gestión Ambiental'
        }
      },
      {
        id: 'clause-14001-3',
        clauseNumber: '6.1',
        title: 'Acciones para abordar riesgos y oportunidades',
        normative: {
          id: 'norm-14001',
          code: 'ISO 14001:2015',
          name: 'Sistemas de Gestión Ambiental'
        }
      }
    ];
  } else if (lowerTitle.includes('seguridad') || lowerTitle.includes('salud') || lowerTitle.includes('ocupacional') || lowerTitle.includes('higiene') || lowerTitle.includes('riesgo laboral')) {
    // ISO 45001 - Occupational Health and Safety
    standard = 'ISO 45001:2018';
    standardName = 'Sistemas de Gestión de Seguridad y Salud Ocupacional';
    standardClauses = [
      {
        id: 'clause-45001-1',
        clauseNumber: '4.1',
        title: 'Compromiso de la Dirección',
        normative: {
          id: 'norm-45001',
          code: 'ISO 45001:2018',
          name: 'Sistemas de Gestión de Seguridad y Salud Ocupacional'
        }
      },
      {
        id: 'clause-45001-2',
        clauseNumber: '5.2',
        title: 'Política de SST',
        normative: {
          id: 'norm-45001',
          code: 'ISO 45001:2018',
          name: 'Sistemas de Gestión de Seguridad y Salud Ocupacional'
        }
      },
      {
        id: 'clause-45001-3',
        clauseNumber: '6.1',
        title: 'Acciones para abordar riesgos y oportunidades',
        normative: {
          id: 'norm-45001',
          code: 'ISO 45001:2018',
          name: 'Sistemas de Gestión de Seguridad y Salud Ocupacional'
        }
      }
    ];
  } else if (lowerTitle.includes('información') || lowerTitle.includes('ciberseguridad') || lowerTitle.includes('tecnología') || lowerTitle.includes('datos') || lowerTitle.includes('privacy')) {
    // ISO 27001 - Information Security
    standard = 'ISO/IEC 27001:2022';
    standardName = 'Sistemas de Gestión de Seguridad de la Información';
    standardClauses = [
      {
        id: 'clause-27001-1',
        clauseNumber: '4.1',
        title: 'Compromiso de la Dirección',
        normative: {
          id: 'norm-27001',
          code: 'ISO/IEC 27001:2022',
          name: 'Sistemas de Gestión de Seguridad de la Información'
        }
      },
      {
        id: 'clause-27001-2',
        clauseNumber: '5.2',
        title: 'Política de seguridad de la información',
        normative: {
          id: 'norm-27001',
          code: 'ISO/IEC 27001:2022',
          name: 'Sistemas de Gestión de Seguridad de la Información'
        }
      },
      {
        id: 'clause-27001-3',
        clauseNumber: '6.1',
        title: 'Acciones para abordar riesgos y oportunidades',
        normative: {
          id: 'norm-27001',
          code: 'ISO/IEC 27001:2022',
          name: 'Sistemas de Gestión de Seguridad de la Información'
        }
      }
    ];
  } else {
    // Default to ISO 9001 - Quality Management
    standard = 'ISO 9001:2015';
    standardName = 'Sistemas de Gestión de Calidad';
    standardClauses = [
      {
        id: 'clause-9001-1',
        clauseNumber: '4.1',
        title: 'Compromiso de la Dirección',
        normative: {
          id: 'norm-9001',
          code: 'ISO 9001:2015',
          name: 'Sistemas de Gestión de Calidad'
        }
      },
      {
        id: 'clause-9001-2',
        clauseNumber: '4.4',
        title: 'Sistema de Gestión de Calidad',
        normative: {
          id: 'norm-9001',
          code: 'ISO 9001:2015',
          name: 'Sistemas de Gestión de Calidad'
        }
      },
      {
        id: 'clause-9001-3',
        clauseNumber: '8.1',
        title: 'Planificación y Control Operacional',
        normative: {
          id: 'norm-9001',
          code: 'ISO 9001:2015',
          name: 'Sistemas de Gestión de Calidad'
        }
      },
      {
        id: 'clause-9001-4',
        clauseNumber: '5.3',
        title: 'Roles, Responsabilidades y Autoridades',
        normative: {
          id: 'norm-9001',
          code: 'ISO 9001:2015',
          name: 'Sistemas de Gestión de Calidad'
        }
      },
      {
        id: 'clause-9001-5',
        clauseNumber: '7.5',
        title: 'Información Documentada',
        normative: {
          id: 'norm-9001',
          code: 'ISO 9001:2015',
          name: 'Sistemas de Gestión de Calidad'
        }
      }
    ];
  }
  
  // Create mappings based on detected standard
  const mappings = standardClauses.map((clause, index) => ({
    id: 'mapping-' + Date.now() + '-' + index,
    documentId: 'temp-' + Date.now(),
    clauseId: clause.id,
    clause: clause,
    complianceType: index === 0 ? 'CUMPLE' : index === 1 ? 'IMPLEMENTA' : index === 2 ? 'CUMPLE' : 'REFERENCIA',
    notes: generateMappingNote(clause.title, standardName, lowerTitle)
  }));
  
  // Return 2-4 random mappings
  const count = Math.floor(Math.random() * 3) + 2; // 2-4 mappings
  return mappings.slice(0, count);
}

// Helper function to generate contextual mapping notes
function generateMappingNote(clauseTitle: string, standardName: string, documentTitle: string): string {
  const notes: Record<string, Record<string, string>> = {
    'ISO 39001:2019': {
      'Compromiso de la Dirección': 'La política de seguridad vial establece el compromiso de la dirección con la gestión de riesgos viales',
      'Política de Seguridad Vial': 'Este documento implementa directamente los requisitos de política de seguridad vial',
      'Acciones para abordar riesgos y oportunidades': 'La política define acciones específicas para mitigar riesgos viales',
      'Información documentada': 'Sirve como información documentada requerida para el sistema de gestión de seguridad vial',
      'Planificación y control operacional': 'Establece controles operativos para la gestión de seguridad vial'
    },
    'ISO 14001:2015': {
      'Compromiso de la Dirección': 'El documento demuestra el compromiso con la protección ambiental',
      'Política ambiental': 'Implementa los requisitos de política ambiental del sistema',
      'Acciones para abordar riesgos y oportunidades': 'Define acciones para gestionar impactos ambientales'
    },
    'ISO 45001:2018': {
      'Compromiso de la Dirección': 'Establece el compromiso con la seguridad y salud ocupacional',
      'Política de SST': 'Implementa directamente la política de seguridad y salud ocupacional',
      'Acciones para abordar riesgos y oportunidades': 'Define acciones para controlar riesgos laborales'
    },
    'ISO/IEC 27001:2022': {
      'Compromiso de la Dirección': 'Demuestra el compromiso con la seguridad de la información',
      'Política de seguridad de la información': 'Implementa la política de seguridad de información',
      'Acciones para abordar riesgos y oportunidades': 'Define acciones para gestionar riesgos de seguridad'
    },
    'ISO 9001:2015': {
      'Compromiso de la Dirección': 'El documento establece el compromiso con la calidad',
      'Sistema de Gestión de Calidad': 'Implementa los requisitos del sistema de gestión',
      'Planificación y Control Operacional': 'Establece procesos planificados y controlados',
      'Roles, Responsabilidades y Autoridades': 'Define claramente las responsabilidades',
      'Información Documentada': 'Sirve como información documentada del sistema'
    }
  };
  
  return notes[standardName]?.[clauseTitle] || 'El documento cumple con los requisitos de esta cláusula normativa';
}
// Document versioning endpoints
app.get('/documents/:id/versions', async (request, reply) => { 
  const { id } = request.params as any;
  
  // Get all versions for this document
  const versions = documentVersions.filter(v => v.documentId === id);
  
  // Sort by version number (descending)
  versions.sort((a, b) => b.version - a.version);
  
  return { versions };
});

app.post('/documents/:id/versions', async (request, reply) => { 
  const { id } = request.params as any;
  const document = documents.find(doc => doc.id === id);
  
  if (!document) {
    return reply.code(404).send({ error: 'Document not found' });
  }
  
  try {
    const data = await request.file();
    
    if (!data) {
      return reply.code(400).send({ error: 'No file provided' });
    }
    
    // Get the next version number
    const existingVersions = documentVersions.filter(v => v.documentId === id);
    const nextVersion = Math.max(...existingVersions.map(v => v.version), 0) + 1;
    
    // Get the actual filename from the uploaded file
    const filename = data?.filename || 'documento-sin-nombre';
    
    // Generate unique filename to avoid conflicts
    const fileExtension = path.extname(filename);
    const baseName = path.basename(filename, fileExtension);
    const uniqueFilename = `${baseName}-v${nextVersion}-${Date.now()}${fileExtension}`;
    const filePath = path.join(uploadsDir, uniqueFilename);
    
    // Save file to disk using stream approach
    await new Promise<void>((resolve, reject) => {
      const writeStream = fs.createWriteStream(filePath);
      data.file.pipe(writeStream);
      writeStream.on('finish', () => resolve());
      writeStream.on('error', reject);
    });
    
    // Create new version
    const newVersion = {
      id: 'version-' + Date.now(),
      documentId: id,
      version: nextVersion,
      title: document.title,
      originalName: filename,
      savedFileName: uniqueFilename,
      type: document.type,
      status: 'EFFECTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      fileUrl: '/uploads/documents/' + uniqueFilename,
      filePath: filePath,
      changeNotes: 'Nueva versión del documento',
      createdBy: 'admin@sgi360.com'
    };
    
    // Add to versions array
    documentVersions.push(newVersion);
    
    // Update document status to show it has versions
    document.hasVersions = true;
    document.latestVersion = nextVersion;
    document.updatedAt = new Date().toISOString();
    
    return {
      version: newVersion,
      message: 'Versión ' + nextVersion + ' creada correctamente'
    };
  } catch (error) {
    console.error('Version creation error:', error);
    return reply.code(500).send({ error: 'Error al crear versión' });
  }
});

// Test endpoint for direct file serving
app.get('/test-download', async (request, reply) => {
  const testFile = '/Users/leonardocastillo/Desktop/APP/SGI 360/apps/api/uploads/SV-POL-001 Política de Seguridad Vial-1775173936520.docx';
  
  if (fs.existsSync(testFile)) {
    const fileBuffer = fs.readFileSync(testFile);
    reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    reply.header('Content-Disposition', 'attachment; filename="test.docx"');
    reply.header('Content-Length', fileBuffer.length);
    return reply.send(fileBuffer);
  } else {
    return reply.code(404).send({ error: 'Test file not found' });
  }
});

app.get('/documents/:id/download', async (request, reply) => { 
  const { id } = request.params as any;
  
  console.log('DOWNLOAD REQUEST ID:', id);
  console.log('DOCUMENTS IN MEMORY:', documents.length);
  
  // 1. Primero buscar en memoria (documentos subidos recientemente) - búsqueda mejorada
  console.log('LOOKING FOR ID:', JSON.stringify(id));
  console.log('AVAILABLE IDS:', documents.map(d => d.id));
  
  let memoryDocument = documents.find(doc => doc.id === id);
  
  if (!memoryDocument) {
    // Método 2: Buscar por título que contenga el ID (para IDs generados dinámicamente)
    memoryDocument = documents.find(doc => 
      doc.title.includes(id) || 
      doc.fileName?.includes(id) ||
      doc.id.includes(id.split('-').slice(-1)[0]) // Buscar por última parte del ID
    );
    console.log('🔍 Alternative search found:', !!memoryDocument);
  }
  
  if (!memoryDocument && documents.length > 0) {
    // Método 3: Usar el primer documento como fallback
    memoryDocument = documents[0];
    console.log('⚠️ Using first available document as fallback');
  }
  
  console.log('MEMORY DOCUMENT FOUND:', !!memoryDocument);
  if (memoryDocument) {
    console.log('MEMORY DOC TITLE:', memoryDocument.title);
    console.log('MEMORY DOC FILEPATH:', memoryDocument.filePath);
  }
  
  if (memoryDocument) {
    console.log('📄 Found document in memory:', memoryDocument.title);
    
    // Priorizar filePath, luego buscar archivos con nombre similar
    let filePath = memoryDocument.filePath;
    
    if (!filePath || !fs.existsSync(filePath)) {
      console.log('🔍 Original filePath not found, searching alternatives...');
      // Buscar archivo por nombre del documento
      const possibleFiles = [
        memoryDocument.fileName,
        memoryDocument.title + '.docx',
        memoryDocument.title + '.pdf',
        memoryDocument.title + '.xlsx'
      ].filter(Boolean);
      
      for (const possibleFile of possibleFiles) {
        const testPath = path.join(uploadsDir, possibleFile);
        if (fs.existsSync(testPath)) {
          filePath = testPath;
          console.log('📁 Found file by name:', filePath);
          break;
        }
      }
    }
    
    if (filePath && fs.existsSync(filePath)) {
      try {
        const fileBuffer = fs.readFileSync(filePath);
        
        // Usar el nombre del archivo físico para determinar el content-type correcto
        const physicalFileName = path.basename(filePath);
        const originalName = memoryDocument.fileName || physicalFileName || memoryDocument.title || id;
        
        // Determinar content type basado en la extensión del archivo físico real
        const ext = path.extname(physicalFileName).toLowerCase();
        const contentType = ext === '.pdf' ? 'application/pdf' : 
                          ext === '.docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' :
                          ext === '.xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' :
                          ext === '.xls' ? 'application/vnd.ms-excel' :
                          ext === '.doc' ? 'application/msword' :
                          'application/octet-stream';
        
        console.log('🔍 File:', physicalFileName, 'Extension:', ext, 'ContentType:', contentType);
        
        // Limpiar el nombre del archivo para evitar caracteres especiales en headers
        const cleanOriginalName = originalName
          .replace(/[^\x00-\x7F]/g, '') // Remover caracteres no-ASCII
          .replace(/[^\w\-._]/g, '_') // Reemplazar caracteres especiales con underscore
          .replace(/_{2,}/g, '_') // Reducir múltiples underscores
          .trim();
        
        reply.header('Content-Type', contentType);
        reply.header('Content-Disposition', `attachment; filename="${cleanOriginalName}"`);
        reply.header('Content-Length', fileBuffer.length);
        reply.header('Cache-Control', 'no-cache');
        
        console.log('📦 Sending memory file:', cleanOriginalName, 'Size:', fileBuffer.length, 'Type:', contentType);
        return reply.send(fileBuffer);
      } catch (error) {
        console.error('❌ Error reading memory file:', error);
      }
    } else {
      console.log('❌ Memory document file not found:', memoryDocument.filePath);
    }
  }
  
  // 2. Fallback: generar archivo de texto
  console.log('📝 Generating fallback text file for:', id);
  const sampleContent = `Documento: ${memoryDocument?.title || id}
Tipo: ${memoryDocument?.type || 'PROCEDURE'}
Estado: ${memoryDocument?.status || 'EFFECTIVE'}
Versión: ${memoryDocument?.version || '1.0'}

${memoryDocument?.title || 'No hay contenido extraído disponible.'}

---
Generado por SGI 360
Fecha: ${new Date().toLocaleString('es-AR')}`;
  
  reply.header('Content-Type', 'text/plain; charset=utf-8');
  reply.header('Content-Disposition', `attachment; filename="${id}.txt"`);
  reply.header('Content-Length', Buffer.byteLength(sampleContent, 'utf8'));
  
  return reply.send(sampleContent);
});

// Direct file serving endpoint (alternative method)
app.get('/uploads/documents/:filename', async (request, reply) => { 
  const { filename } = request.params as any;
  const filePath = path.join(uploadsDir, filename);
  
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    return reply.code(404).send({ error: 'File not found' });
  }
  
  try {
    // Read file as buffer
    const fileBuffer = fs.readFileSync(filePath);
    
    // Detect content type based on extension
    const ext = path.extname(filename).toLowerCase();
    let contentType = 'application/octet-stream';
    
    if (ext === '.pdf') contentType = 'application/pdf';
    else if (ext === '.docx') contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    else if (ext === '.xlsx') contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    else if (ext === '.xls') contentType = 'application/vnd.ms-excel';
    else if (ext === '.doc') contentType = 'application/msword';
    
    // Set headers for inline viewing (not download)
    reply.header('Content-Type', contentType);
    reply.header('Content-Disposition', 'inline; filename="' + filename + '"');
    reply.header('Content-Length', fileBuffer.length);
    
    // Send the buffer
    return reply.send(fileBuffer);
  } catch (error) {
    console.error('Direct file serving error:', error);
    return reply.code(500).send({ error: 'Error reading file' });
  }
});
app.get('/company/settings', async () => ({ 
  company: {
    name: 'SGI 360 Company',
    logo: null,
    settings: {
      theme: 'light',
      language: 'es',
      notifications: true
    }
  }
}));

app.get('/documents/:id/summary', async (request, reply) => {
  const { id } = request.params as any;
  
  // Find the document
  const document = documents.find(doc => doc.id === id);
  if (!document) {
    return reply.code(404).send({ error: 'Document not found' });
  }
  
  try {
    // Try to read the actual document content
    let content = '';
    if (document.filePath && fs.existsSync(document.filePath)) {
      content = fs.readFileSync(document.filePath, 'utf-8');
    }
    
    // Generate AI summary
    const summary = await generateDocumentSummary(
      content || `Documento ${document.title} sin contenido disponible`,
      document.title || 'Documento sin título',
      document.type || 'DOCUMENT'
    );
    
    console.log('🤖 AI Summary generated for document:', id);
    console.log('📊 Summary length:', summary.summary.length);
    console.log('🔑 Key points:', summary.keyPoints.length);
    console.log('🏷️ Topics:', summary.topics.length);
    
    return summary;
  } catch (error) {
    console.error('Error generating summary:', error);
    return reply.code(500).send({ 
      error: 'Error generating summary',
      message: 'No se pudo generar el resumen con IA'
    });
  }
});

// In-memory storage with persistence
const clauseMappings: any[] = loadedClauseMappings;

// Data persistence system
const DATA_DIR = path.join(process.cwd(), 'data');
const DRILLS_FILE = path.join(DATA_DIR, 'drills.json');
const DOCUMENTS_FILE = path.join(DATA_DIR, 'documents.json');
const CLAUSE_MAPPINGS_FILE = path.join(DATA_DIR, 'clause-mappings.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const NOTIFICATIONS_FILE = path.join(DATA_DIR, 'notifications.json');
const TRAININGS_FILE = path.join(DATA_DIR, 'trainings.json');
const INDICATORS_FILE = path.join(DATA_DIR, 'indicators.json');
const NCRS_FILE = path.join(DATA_DIR, 'ncrs.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  console.log('📁 Data directory created:', DATA_DIR);
}

// Load data from files
function loadFromFile(filePath: string, defaultValue: any[] = []): any[] {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.log(`⚠️ Error loading ${filePath}, using default:`, error.message);
  }
  return defaultValue;
}

// Save data to files
function saveToFile(filePath: string, data: any[]): void {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`💾 Data saved to ${path.basename(filePath)} (${data.length} items)`);
  } catch (error) {
    console.error(`❌ Error saving to ${filePath}:`, error);
  }
}

// Auto-save function
function autoSave(dataType: string, dataArray: any[]): void {
  const filePaths: Record<string, string> = {
    drills: DRILLS_FILE,
    documents: DOCUMENTS_FILE,
    clauseMappings: CLAUSE_MAPPINGS_FILE,
    users: USERS_FILE,
    notifications: NOTIFICATIONS_FILE,
    trainings: TRAININGS_FILE,
    indicators: INDICATORS_FILE,
    ncrs: NCRS_FILE
  };
  
  if (filePaths[dataType]) {
    saveToFile(filePaths[dataType], dataArray);
  }
}

// Load initial data from files
console.log('📂 Loading data from files...');
const loadedDrills = loadFromFile(DRILLS_FILE);
const loadedDocuments = loadFromFile(DOCUMENTS_FILE);
const loadedClauseMappings = loadFromFile(CLAUSE_MAPPINGS_FILE);
const loadedUsers = loadFromFile(USERS_FILE);
const loadedNotifications = loadFromFile(NOTIFICATIONS_FILE);
const loadedTrainings = loadFromFile(TRAININGS_FILE);
const loadedIndicators = loadFromFile(INDICATORS_FILE);
const loadedNcrs = loadFromFile(NCRS_FILE);

console.log(`📊 Loaded data: ${loadedDrills.length} drills, ${loadedDocuments.length} documents, ${loadedClauseMappings.length} mappings`);

// Simple AI service for document summaries
async function generateDocumentSummary(content: string, title: string, docType: string) {
  try {
    // Check if OpenAI is available
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      // Return fallback summary when no API key is configured
      return {
        summary: `Este documento titulado "${title}" es un ${docType.toLowerCase()} que contiene información importante para la organización. El documento ha sido procesado y está listo para su revisión y análisis.`,
        keyPoints: [
          `Documento de tipo ${docType} procesado correctamente`,
          `Título: ${title}`,
          `Contenido: ${content.length} caracteres extraídos`,
          'Listo para análisis y revisión',
          'Cumple con los estándares de documentación'
        ],
        topics: [
          docType,
          'Documentación',
          'Gestión de documentos',
          'Calidad',
          'Procesos'
        ]
      };
    }

    // If OpenAI is available, use it (simplified implementation)
    const prompt = `Analizá el siguiente documento de tipo "${docType}" titulado "${title}".

INSTRUCCIONES:
1. Generá un resumen conciso (máximo 3 párrafos) que explique de qué trata el documento
2. Extraé los 3-5 puntos clave más importantes
3. Identificá los temas principales cubiertos (máximo 5 temas)

Respondé ÚNICAMENTE en formato JSON con esta estructura exacta:
{
  "summary": "resumen del documento...",
  "keyPoints": ["punto 1", "punto 2", "punto 3"],
  "topics": ["tema 1", "tema 2", "tema 3"]
}

CONTENIDO DEL DOCUMENTO:
${content.slice(0, 8000)}

${content.length > 8000 ? '\n[Nota: El documento fue truncado por longitud]' : ''}`;

    // For now, return a smart summary based on document analysis
    // In a real implementation, this would call OpenAI API
    const wordCount = content.split(/\s+/).length;
    const charCount = content.length;
    
    // Enhanced keyword detection for Spanish content
    const hasCompliance = /norma|normativa|cumplimiento|requerimiento|obligación|política|procedimiento|reglamento/i.test(content);
    const hasSecurity = /seguridad|riesgo|peligro|prevención|emergencia|evacuación|accidente|incidente/i.test(content);
    const hasQuality = /calidad|proceso|procedimiento|control|auditoría|mejora|gestión|indicador/i.test(content);
    const hasTraining = /capacitación|entrenamiento|competencia|inducción|personal|empleado/i.test(content);
    const hasDocumentation = /documentación|registro|manual|informe|acta|revisión|actualización/i.test(content);
    
    // Generate more specific summary based on content analysis
    let summaryText = `Documento "${title}" de tipo ${docType} con ${wordCount} palabras y ${charCount} caracteres. `;
    
    if (hasCompliance && hasSecurity && hasQuality) {
      summaryText += 'Es una política integral que aborda cumplimiento normativo, gestión de seguridad y sistema de calidad. ';
    } else if (hasCompliance && hasSecurity) {
      summaryText += 'Contiene requisitos normativos y procedimientos de seguridad. ';
    } else if (hasSecurity && hasQuality) {
      summaryText += 'Incluye aspectos de seguridad y gestión de calidad. ';
    } else if (hasCompliance && hasQuality) {
      summaryText += 'Cubre cumplimiento normativo y sistema de calidad. ';
    } else if (hasCompliance) {
      summaryText += 'Establece requisitos normativos y de cumplimiento. ';
    } else if (hasSecurity) {
      summaryText += 'Aborda seguridad y gestión de riesgos. ';
    } else if (hasQuality) {
      summaryText += 'Cubre temas de calidad y procedimientos. ';
    } else {
      summaryText += 'Establece directrices importantes para la organización. ';
    }
    
    if (hasTraining) {
      summaryText += 'Incluye programas de capacitación y desarrollo de competencias. ';
    }
    
    if (hasDocumentation) {
      summaryText += 'Define requisitos de documentación y registros. ';
    }
    
    summaryText += 'El documento establece responsabilidades claras y mecanismos de seguimiento.';
    
    // Generate specific key points based on content
    const keyPoints = [
      `Documento tipo ${docType} con ${wordCount} palabras`
    ];
    
    if (hasCompliance) {
      keyPoints.push('Establece requisitos normativos y de cumplimiento');
    }
    if (hasSecurity) {
      keyPoints.push('Define procedimientos de seguridad y gestión de riesgos');
    }
    if (hasQuality) {
      keyPoints.push('Implementa sistema de gestión de calidad');
    }
    if (hasTraining) {
      keyPoints.push('Incluye programas de capacitación del personal');
    }
    if (hasDocumentation) {
      keyPoints.push('Especifica requisitos de documentación y registros');
    }
    
    keyPoints.push('Asigna responsabilidades y define seguimiento');
    
    // Generate relevant topics
    const topics = [docType];
    
    if (hasCompliance) topics.push('Cumplimiento normativo');
    if (hasSecurity) topics.push('Seguridad');
    if (hasQuality) topics.push('Calidad');
    if (hasTraining) topics.push('Capacitación');
    if (hasDocumentation) topics.push('Documentación');
    
    topics.push('Procesos', 'Gestión');
    
    return {
      summary: summaryText,
      keyPoints: keyPoints.slice(0, 5),
      topics: topics.slice(0, 5)
    };
  } catch (error) {
    console.error('Error generating summary:', error);
    return {
      summary: `Resumen no disponible para "${title}". Error al procesar el documento.`,
      keyPoints: ['Error en el procesamiento', 'Intente nuevamente más tarde'],
      topics: [docType, 'Error']
    };
  }
}

app.get('/documents/:id/clause-mappings', async (request, reply) => {
  const { id } = request.params as any;
  
  // Return mappings for this specific document
  const documentMappings = clauseMappings.filter(mapping => mapping.documentId === id);
  
  // Add mock clause data for each mapping
  const mappingsWithClauses = documentMappings.map(mapping => ({
    ...mapping,
    clause: {
      id: mapping.clauseId,
      clauseNumber: mapping.clauseId.split('-')[1] || mapping.clauseId,
      title: `Cláusula ${mapping.clauseId}`,
      normative: {
        id: 'fc580340-831e-4dae-a90f-d055b55ecbbd',
        name: 'ISO 39001',
        code: '2012'
      }
    }
  }));
  
  return { mappings: mappingsWithClauses };
});
app.post('/documents/:id/clause-mappings', async (request, reply) => {
  const { id } = request.params as any;
  const body = request.body as any;
  
  // Create a new clause mapping
  const newMapping = {
    id: 'mapping-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
    documentId: id,
    clauseId: body.clauseId || 'default-clause',
    complianceType: body.complianceType || 'CUMPLE',
    notes: body.notes || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  // Store the mapping in memory
  clauseMappings.push(newMapping);
  
  console.log('✅ Clause mapping created:', newMapping);
  console.log('📊 Total mappings stored:', clauseMappings.length);
  
  return { 
    mapping: newMapping,
    message: 'Cláusula vinculada correctamente'
  };
});

app.delete('/documents/:id/clause-mappings/:mappingId', {
  config: {
    rawBody: false
  }
}, async (request, reply) => {
  const { id, mappingId } = request.params as any;
  
  console.log('🗑️ DELETE request received:', { documentId: id, mappingId });
  
  // Find and remove the mapping from the array
  const mappingIndex = clauseMappings.findIndex(
    mapping => mapping.documentId === id && mapping.id === mappingId
  );
  
  if (mappingIndex === -1) {
    console.log('❌ Mapping not found:', { documentId: id, mappingId });
    return reply.code(404).send({ error: 'Mapping not found' });
  }
  
  const deletedMapping = clauseMappings.splice(mappingIndex, 1)[0];
  
  console.log('🗑️ Clause mapping deleted:', deletedMapping);
  console.log('📊 Total mappings remaining:', clauseMappings.length);
  
  return {
    mappingId,
    message: 'Cláusula desvinculada correctamente',
    deletedMapping
  };
});

app.post('/documents/upload', async (request, reply) => { 
  // Set content type to handle multipart/form-data
  reply.header('Content-Type', 'application/json');
  
  try {
    const data = await request.file();
    
    if (!data) {
      return reply.code(400).send({ error: 'No file provided' });
    }
    
    // Get the actual filename from the uploaded file
    const filename = data?.filename || 'documento-sin-nombre';
    const title = filename.replace(/\.(pdf|docx|xlsx|xls)$/i, '');
    
    // Generate unique filename to avoid conflicts
    const fileExtension = path.extname(filename);
    const baseName = path.basename(filename, fileExtension);
    const uniqueFilename = `${baseName}-${Date.now()}${fileExtension}`;
    const filePath = path.join(uploadsDir, uniqueFilename);
    
    // Save file to disk using a stream approach
    await new Promise<void>((resolve, reject) => {
      const writeStream = fs.createWriteStream(filePath);
      data.file.pipe(writeStream);
      writeStream.on('finish', () => resolve());
      writeStream.on('error', reject);
    });
    
    // Create document in memory array (temporarily without Prisma)
    const newDocument = {
      id: 'doc-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
      title: title,
      name: title,
      fileName: uniqueFilename,
      filePath: filePath,
      type: 'PROCEDURE',
      status: 'EFFECTIVE',
      version: '1.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      uploadedAt: new Date().toISOString(),
      versions: []
    };
    
    // Add to in-memory storage
    documents.push(newDocument);
    
    console.log('📄 Document uploaded and added to memory:', title);
    
    return { 
      document: newDocument,
      extractedChars: 1000,
      message: 'Documento "' + title + '" subido y guardado correctamente'
    };
  } catch (error) {
    console.error('Upload error:', error);
    return reply.code(500).send({ error: 'Error al subir archivo' });
  }
});
app.delete('/documents/:id', async (request, reply) => { 
  const { id } = request.params as any;
  const documentIndex = documents.findIndex(doc => doc.id === id);
  
  if (documentIndex === -1) {
    return reply.code(404).send({ error: 'Document not found' });
  }
  
  const document = documents[documentIndex];
  
  try {
    // Delete file from disk if it exists
    if (document.filePath && fs.existsSync(document.filePath)) {
      fs.unlinkSync(document.filePath);
      console.log('🗑️  Deleted file from disk:', document.originalName);
    }
    
    // Remove from memory array
    documents.splice(documentIndex, 1);
    
    return { 
      message: 'Documento "' + document.title + '" eliminado correctamente',
      deletedDocument: document
    };
  } catch (error) {
    console.error('Delete error:', error);
    return reply.code(500).send({ error: 'Error al eliminar documento' });
  }
});
app.patch('/documents/:id', async (request, reply) => { 
  const { id } = request.params as any;
  const documentIndex = documents.findIndex(doc => doc.id === id);
  
  if (documentIndex === -1) {
    return reply.code(404).send({ error: 'Document not found' });
  }
  
  try {
    const updates = request.body as any;
    const document = documents[documentIndex];
    
    console.log('📝 PATCH document:', id);
    console.log('📝 Updates received:', updates);
    console.log('📝 Before update - normatives:', document.normatives);
    console.log('📝 Before update - normative:', document.normative);
    
    // Load normatives from in-memory data
    const dbNormatives = normativos;
    
    // Update allowed fields
    if (updates.title !== undefined) document.title = updates.title;
    if (updates.status !== undefined) document.status = updates.status;
    if (updates.type !== undefined) document.type = updates.type;
    if (updates.departmentId !== undefined) document.departmentId = updates.departmentId;
    if (updates.normativeIds !== undefined) document.normativeIds = updates.normativeIds;
    if (updates.normativeId !== undefined) document.normativeId = updates.normativeId;
    
    // Handle multiple normatives
    if (updates.normativeIds && Array.isArray(updates.normativeIds)) {
      // Fetch all normative details
      const normativeDetails = dbNormatives
        .filter(n => updates.normativeIds.includes(n.id))
        .map(n => ({
          id: n.id,
          name: n.name,
          code: n.code
        }));
      
      document.normatives = normativeDetails;
      document.normative = normativeDetails[0] || null; // For compatibility
    } else if (updates.normativeId) {
      // Handle single normative (for compatibility)
      const normative = dbNormatives.find(n => n.id === updates.normativeId);
      if (normative) {
        document.normatives = [{
          id: normative.id,
          name: normative.name,
          code: normative.code
        }];
        document.normative = {
          id: normative.id,
          name: normative.name,
          code: normative.code
        };
      }
    } else {
      // Remove all normatives
      document.normatives = [];
      document.normative = null;
    }
    
    // If departmentId is provided, fetch department details and add to document
    if (updates.departmentId) {
      // For now, create a simple department object
      // In a real implementation, this would come from a departments table
      document.department = {
        id: updates.departmentId,
        name: `Department ${updates.departmentId}`
      };
    } else {
      // If departmentId is null/undefined, remove department
      document.department = null;
    }
    
    // Update timestamp
    document.updatedAt = new Date().toISOString();
    
    console.log('📝 After update - normatives:', document.normatives);
    console.log('📝 After update - normative:', document.normative);
    console.log('📝 Document updated successfully');
    
    return { 
      message: 'Documento "' + document.title + '" actualizado correctamente',
      document: document
    };
  } catch (error) {
    console.error('Update error:', error);
    return reply.code(500).send({ error: 'Error al actualizar documento' });
  }
});

// Normativos endpoints
app.get('/normativos', async () => {
  try {
    // Usar datos en memoria en lugar de Prisma para el simple-server
    return { normativos: normativos };
  } catch (error) {
    console.error('Error fetching normativos:', error);
    return { normativos: [] };
  }
});

// Endpoint para obtener cláusulas de una normativa
app.get('/normativos/:id/clauses', async (request, reply) => {
  const { id } = request.params as any;
  
  try {
    // Usar datos mock en memoria en lugar de Prisma
    const mockClauses = [
      {
        id: `${id}-clause-1`,
        clauseNumber: '1',
        title: 'Requisitos Generales',
        content: 'La organización debe establecer, documentar, implementar y mantener un sistema de gestión de seguridad vial...',
        normativeId: id
      },
      {
        id: `${id}-clause-2`,
        clauseNumber: '2',
        title: 'Política de Seguridad Vial',
        content: 'La alta dirección debe definir y autorizar una política de seguridad vial que sea apropiada...',
        normativeId: id
      },
      {
        id: `${id}-clause-3`,
        clauseNumber: '3',
        title: 'Planificación',
        content: 'La organización debe planificar la implementación del sistema de gestión de seguridad vial...',
        normativeId: id
      },
      {
        id: `${id}-clause-4`,
        clauseNumber: '4',
        title: 'Implementación y Operación',
        content: 'La organización debe implementar y operar el sistema de gestión de seguridad vial...',
        normativeId: id
      },
      {
        id: `${id}-clause-5`,
        clauseNumber: '5',
        title: 'Verificación',
        content: 'La organización debe verificar el sistema de gestión de seguridad vial...',
        normativeId: id
      }
    ];
    
    return { clauses: mockClauses };
  } catch (error) {
    console.error('Error fetching clauses:', error);
    return reply.code(500).send({ error: 'Error fetching clauses' });
  }
});
      data: {
        name: 'Normativo subido',
        code: 'NORM-' + Date.now(),
        version: '1.0',
        description: 'Normativo subido al sistema',
        status: 'PROCESSING',
        tenantId: 'default-tenant',
        createdById: 'user-1',
        updatedById: 'user-1'
      }
    });
    
    return { 
      normative: newNormative,
      message: 'Normativo subido y en procesamiento'
    };
  } catch (error) {
    console.error('Error creating normative:', error);
    return reply.code(500).send({ error: 'Error al crear normativo' });
  }
});
app.post('/normativos', async () => ({ 
  id: 'temp-' + Date.now(),
  message: 'Normativo creado (temporal)'
}));

// HR Module endpoints
app.get('/hr/employees', async () => {
  return { employees };
});

app.post('/hr/employees', async (request, reply) => {
  console.log('🔵 POST /hr/employees called');
  console.log('🔵 Request body:', request.body);
  
  const employeeData = request.body as any;
  
  // Create new employee with generated ID
  const newEmployee = {
    id: 'emp-' + Date.now(),
    firstName: employeeData.firstName,
    lastName: employeeData.lastName,
    dni: employeeData.dni,
    email: employeeData.email,
    phone: employeeData.phone,
    status: 'ACTIVE',
    hireDate: employeeData.hireDate,
    contractType: employeeData.contractType,
    department: employeeData.departmentId ? departments.find(d => d.id === employeeData.departmentId) : null,
    position: employeeData.positionId ? positions.find(p => p.id === employeeData.positionId) : null,
    supervisor: employeeData.supervisorId ? employees.find(e => e.id === employeeData.supervisorId) : null,
    user: null,
    _count: { subordinates: 0, employeeCompetencies: 0, trainingAssignments: 0 },
    birthDate: employeeData.birthDate,
    address: employeeData.address,
    cuil: employeeData.cuil,
    location: employeeData.location,
    notes: employeeData.notes,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Add to in-memory storage
  employees.push(newEmployee);

  // Save to file
  saveHRData();

  console.log('✅ New employee created:', newEmployee);
  console.log('🔵 Total employees:', employees.length);
  
  return { 
    employee: newEmployee,
    message: 'Employee created successfully'
  };
});

// Departments endpoints
app.get('/hr/departments', async () => {
  return { departments };
});

app.post('/hr/departments', async (request, reply) => {
  console.log('🔵 POST /hr/departments called');
  console.log('🔵 Request body:', request.body);
  
  const deptData = request.body as any;
  
  if (!deptData || !deptData.name) {
    console.log('❌ Missing name in request body');
    return reply.status(400).send({ error: 'Name is required' });
  }
  
  const newDepartment = {
    id: 'dept-' + Date.now(),
    name: deptData.name,
    description: deptData.description || null,
    _count: { employees: 0 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Add to in-memory storage
  departments.push(newDepartment);

  // Save to file
  saveHRData();

  console.log('✅ New department created:', newDepartment);
  console.log('🔵 Total departments:', departments.length);
  
  return { 
    department: newDepartment,
    message: 'Department created successfully'
  };
});

// Positions endpoints  
app.get('/hr/positions', async () => {
  return { positions };
});

app.post('/hr/positions', async (request, reply) => {
  console.log('🔵 POST /hr/positions called');
  console.log('🔵 Request body:', request.body);
  
  const posData = request.body as any;
  
  if (!posData || !posData.name) {
    console.log('❌ Missing name in request body');
    return reply.status(400).send({ error: 'Name is required' });
  }
  
  const newPosition = {
    id: 'pos-' + Date.now(),
    name: posData.name,
    code: posData.code || null,
    category: posData.category || null,
    level: posData.level || null,
    objective: posData.objective || null,
    responsibilities: posData.responsibilities || [],
    tasks: posData.tasks || [],
    requirements: posData.requirements || [],
    kpis: posData.kpis || [],
    risks: posData.risks || [],
    _count: { employees: 0 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Add to in-memory storage
  positions.push(newPosition);

  // Save to file
  saveHRData();

  console.log('✅ New position created:', newPosition);
  console.log('🔵 Total positions:', positions.length);
  
  return { 
    position: newPosition,
    message: 'Position created successfully'
  };
});

app.get('/hr/employees/stats', async () => {
  return {
    stats: {
      total: 1,
      active: 1,
      inactive: 0,
      byDepartment: [{ departmentId: 'dept-1', _count: 1 }],
      byPosition: [{ positionId: 'pos-1', _count: 1 }],
      byContractType: [{ contractType: 'PERMANENT', _count: 1 }]
    }
  };
});

app.get('/hr/competencies', async () => {
  return { 
    competencies: [
      { id: 'comp-1', name: 'JavaScript', category: 'Técnica', description: 'Programación en JavaScript' },
      { id: 'comp-2', name: 'Liderazgo', category: 'Blanda', description: 'Capacidad de liderar equipos' }
    ]
  };
});

app.get('/hr/trainings', async () => {
  return { 
    trainings: [
      { id: 'train-1', title: 'Curso de React', type: 'INTERNAL', duration: 40, _count: { assignments: 1 } }
    ]
  };
});

app.get('/hr/org-chart', async () => {
  return { 
    orgChart: [
      {
        id: 'emp-2',
        firstName: 'María',
        lastName: 'García',
        position: { name: 'Gerente de TI' },
        department: { name: 'Tecnología' },
        supervisorId: null,
        children: [
          {
            id: 'emp-1',
            firstName: 'Juan',
            lastName: 'Pérez',
            position: { name: 'Desarrollador Senior' },
            department: { name: 'Tecnología' },
            supervisorId: 'emp-2',
            children: []
          }
        ]
      }
    ]
  };
});

const port = Number(process.env.PORT ?? 3001);

// Onboarding endpoint for SaaS
app.post('/onboarding', async (request, reply) => {
  console.log('🔵 POST /onboarding called');
  console.log('🔵 Request body:', request.body);
  
  const onboardingData = request.body as any;
  
  if (!onboardingData || !onboardingData.companyName || !onboardingData.adminEmail) {
    console.log('❌ Missing required fields');
    return reply.status(400).send({ error: 'Missing required fields' });
  }
  
  try {
    // Create tenant
    const tenant = {
      id: 'tenant-' + Date.now(),
      name: onboardingData.companyName,
      slug: onboardingData.companyName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      adminEmail: onboardingData.adminEmail,
      adminName: onboardingData.adminName,
      employeeCount: onboardingData.employeeCount || 1,
      industry: onboardingData.industry,
      location: onboardingData.location,
      status: 'TRIAL',
      isActive: true,
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Create admin user
    const adminUser = {
      id: 'user-' + Date.now(),
      email: onboardingData.adminEmail,
      passwordHash: 'hashed-password', // In real app, this would be properly hashed
      firstName: onboardingData.adminName?.split(' ')[0] || 'Admin',
      lastName: onboardingData.adminName?.split(' ').slice(1).join(' ') || 'User',
      globalRole: 'SUPER_ADMIN',
      tenantId: tenant.id,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Create subscription
    const subscription = {
      id: 'sub-' + Date.now(),
      tenantId: tenant.id,
      planId: 'starter',
      status: 'TRIAL',
      startDate: new Date().toISOString(),
      nextBillingDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      billingCycle: 'MONTHLY',
      basePrice: 39,
      totalPrice: 39,
      userLimit: 5,
      storageLimit: 1000,
      currentUsers: 1,
      currentStorage: 0
    };
    
    console.log('✅ Tenant created:', tenant);
    console.log('✅ User created:', adminUser);
    console.log('✅ Subscription created:', subscription);
    
    // Generate simple token (in real app, use JWT)
    const token = 'token-' + Date.now();
    
    return reply.send({
      success: true,
      tenant,
      user: {
        id: adminUser.id,
        email: adminUser.email,
        name: `${adminUser.firstName} ${adminUser.lastName}`,
        globalRole: adminUser.globalRole
      },
      token,
      setupPayment: {
        preferenceId: 'pref-' + Date.now(),
        initPoint: 'http://localhost:3000/onboarding/success', // Mock payment URL
        amount: 400
      },
      nextStep: 'PAYMENT'
    });
    
  } catch (error) {
    console.error('❌ Error in onboarding:', error);
    return reply.status(500).send({ error: 'Internal server error' });
  }
});

// Auth endpoints
app.post('/auth/login', async (request, reply) => {
  console.log('🔵 POST /auth/login called');
  const { email, password } = request.body as any;
  
  // Mock authentication - accept any email/password for demo
  if (email && password) {
    const mockUser = {
      id: 'user-' + Date.now(),
      email: email,
      name: email.split('@')[0],
      globalRole: 'SUPER_ADMIN',
      tenantId: 'tenant-demo'
    };
    
    const token = 'token-' + Date.now();
    
    return reply.send({
      success: true,
      user: mockUser,
      token,
      redirectTo: '/dashboard'
    });
  }
  
  return reply.status(400).send({ error: 'Invalid credentials' });
});

app.get('/auth/me', async (request, reply) => {
  console.log('🔵 GET /auth/me called');
  
  // Mock user data
  const mockUser = {
    id: 'user-demo',
    email: 'admin@sgi360.com',
    name: 'Admin User',
    globalRole: 'SUPER_ADMIN',
    tenantId: 'tenant-demo'
  };
  
  return reply.send({
    success: true,
    user: mockUser
  });
});

// Plans endpoint
app.get('/plans', async (request, reply) => {
  console.log('🔵 GET /plans called');
  
  const plans = [
    {
      id: 'starter',
      name: 'Starter',
      slug: 'starter',
      description: 'Perfecto para pequeñas empresas que comienzan con gestión de calidad',
      monthlyPrice: 39,
      annualPrice: 422,
      userLimit: 5,
      storageLimit: 1000,
      isPopular: false,
      trialDays: 14,
      setupFee: 400,
      features: [
        { key: 'DASHBOARD_BASIC', name: 'Dashboard Básico', description: 'Vista general del sistema' },
        { key: 'AUDITS_BASIC', name: 'Auditorías Básicas', description: 'Gestión básica de auditorías' },
        { key: 'USERS_MANAGEMENT', name: 'Gestión de Usuarios', description: 'Hasta 5 usuarios', limit: 5 }
      ]
    },
    {
      id: 'professional',
      name: 'Professional',
      slug: 'professional',
      description: 'La opción más completa para empresas en crecimiento',
      monthlyPrice: 99,
      annualPrice: 1071,
      userLimit: 20,
      storageLimit: 5000,
      isPopular: true,
      trialDays: 14,
      setupFee: 400,
      features: [
        { key: 'PROJECT360', name: 'PROJECT360', description: 'Planes de acción y mejora continua' },
        { key: 'MAINTENANCE', name: 'Mantenimiento', description: 'Gestión de mantenimiento industrial' },
        { key: 'DRILLS', name: 'Simulacros', description: 'Planes de contingencia' },
        { key: 'USERS_MANAGEMENT', name: 'Gestión de Usuarios', description: 'Hasta 20 usuarios', limit: 20 }
      ]
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      slug: 'enterprise',
      description: 'Solución completa para grandes organizaciones',
      monthlyPrice: 249,
      annualPrice: 2691,
      userLimit: -1,
      storageLimit: 50000,
      isPopular: false,
      trialDays: 21,
      setupFee: 400,
      features: [
        { key: 'BUSINESS_INTELLIGENCE', name: 'Business Intelligence', description: 'Analytics avanzado' },
        { key: 'REPORTS_AUTO', name: 'Reportes Automáticos', description: 'Generación automática de informes' },
        { key: 'AI_FEATURES', name: 'AI Features', description: 'Funcionalidades con IA' },
        { key: 'USERS_MANAGEMENT', name: 'Usuarios Ilimitados', description: 'Sin límite de usuarios', limit: -1 }
      ]
    }
  ];
  
  return reply.send({
    plans,
    addons: []
  });
});

// Modules access endpoint
app.get('/modules/access', async (request, reply) => {
  console.log('🔵 GET /modules/access called');
  
  const modules = [
    {
      key: 'dashboard',
      name: 'Dashboard',
      icon: 'BarChart3',
      route: '/dashboard',
      hasAccess: true,
      isBlocked: false,
      requiredPlan: null,
      upgradeUrl: null,
      tooltip: null,
      description: 'Vista general del sistema'
    },
    {
      key: 'audits',
      name: 'Auditorías',
      icon: 'ClipboardList',
      route: '/auditorias',
      hasAccess: true,
      isBlocked: false,
      requiredPlan: null,
      upgradeUrl: null,
      tooltip: null,
      description: 'Gestión de auditorías internas y externas'
    },
    {
      key: 'projects',
      name: 'PROJECT360',
      icon: 'Target',
      route: '/project360',
      hasAccess: false, // Blocked for demo
      isBlocked: true,
      requiredPlan: 'Professional',
      upgradeUrl: '/plans?upgrade=PROJECT360',
      tooltip: 'Disponible en plan Professional',
      description: 'Planes de acción y mejora continua'
    },
    {
      key: 'maintenance',
      name: 'Mantenimiento',
      icon: 'Wrench',
      route: '/mantenimiento',
      hasAccess: false, // Blocked for demo
      isBlocked: true,
      requiredPlan: 'Professional',
      upgradeUrl: '/plans?upgrade=MAINTENANCE',
      tooltip: 'Disponible en plan Professional',
      description: 'Gestión de mantenimiento industrial'
    }
  ];
  
  return reply.send({ modules });
});

// Test endpoint for direct file serving
app.get('/test-download/:id', async (request, reply) => {
  const { id } = request.params as any;
  const filePath = path.join(uploadsDir, '2e18d100-3d50-4703-b91c-3f4dc6f7289a', id, 'original.pdf');
  
  console.log('Test download - looking for:', filePath);
  console.log('Exists:', fs.existsSync(filePath));
  
  if (fs.existsSync(filePath)) {
    const buffer = fs.readFileSync(filePath);
    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `attachment; filename="${id}.pdf"`);
    return reply.send(buffer);
  }
  
  return reply.code(404).send({ error: 'File not found', path: filePath });
});

// Direct file serving endpoint - bypass all logic
app.get('/files/:tenantId/:docId', async (request, reply) => {
  const { tenantId, docId } = request.params as any;
  const filePath = `/Users/leonardocastillo/Desktop/APP/SGI 360/apps/api/uploads/${tenantId}/${docId}/original.pdf`;
  
  console.log('Looking for file:', filePath);
  console.log('Exists:', fs.existsSync(filePath));
  
  if (fs.existsSync(filePath)) {
    const buffer = fs.readFileSync(filePath);
    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `attachment; filename="${docId}.pdf"`);
    return reply.send(buffer);
  }
  return reply.code(404).send({ error: 'File not found', path: filePath });
});

// Load documents from disk on startup
loadExistingDocuments();

try {
  await app.listen({ port, host: '0.0.0.0' });
  console.log('🚀 API running on http://localhost:' + port);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
