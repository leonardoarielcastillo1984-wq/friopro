import Fastify from 'fastify';
import type { FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import path from 'path';
import fs from 'fs';
import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = Fastify({ logger: false });

// Register plugins
app.register(cors, {
  origin: ['http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-csrf-token', 'x-tenant-id']
});

app.register(cookie);
app.register(multipart);
app.register(fastifyStatic, {
  root: path.join(__dirname, 'uploads'),
  prefix: '/uploads/',
});

const UPLOADS_DIR = path.join(__dirname, 'uploads');
const DATA_DIR = path.join(__dirname, 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Data files
const DOCUMENTS_FILE = path.join(DATA_DIR, 'documents.json');
const CLAUSE_MAPPINGS_FILE = path.join(DATA_DIR, 'clause-mappings.json');
const DRILLS_FILE = path.join(DATA_DIR, 'drills.json');
const NCR_FILE = path.join(DATA_DIR, 'ncr.json');
const INDICATORS_FILE = path.join(DATA_DIR, 'indicators.json');
const TRAININGS_FILE = path.join(DATA_DIR, 'trainings.json');
const NORMATIVOS_FILE = path.join(DATA_DIR, 'normativos.json');

// In-memory data
let documents: any[] = [];
let clauseMappings: any[] = [];
let drills: any[] = [];
let ncrs: any[] = [];
let indicators: any[] = [];
let trainings: any[] = [];
let normativos: any[] = [];

// Helper to load data from JSON files
function loadData() {
  try {
    if (fs.existsSync(DOCUMENTS_FILE)) {
      documents = JSON.parse(fs.readFileSync(DOCUMENTS_FILE, 'utf-8'));
      console.log(`📄 Loaded ${documents.length} documents from storage`);
    }
    if (fs.existsSync(CLAUSE_MAPPINGS_FILE)) {
      clauseMappings = JSON.parse(fs.readFileSync(CLAUSE_MAPPINGS_FILE, 'utf-8'));
      console.log(`🔗 Loaded ${clauseMappings.length} clause mappings from storage`);
    }
    if (fs.existsSync(DRILLS_FILE)) {
      drills = JSON.parse(fs.readFileSync(DRILLS_FILE, 'utf-8'));
      console.log(`🚨 Loaded ${drills.length} drills from storage`);
    }
    if (fs.existsSync(NCR_FILE)) {
      ncrs = JSON.parse(fs.readFileSync(NCR_FILE, 'utf-8'));
      console.log(`⚠️  Loaded ${ncrs.length} NCRs from storage`);
    }
    if (fs.existsSync(INDICATORS_FILE)) {
      indicators = JSON.parse(fs.readFileSync(INDICATORS_FILE, 'utf-8'));
      console.log(`📊 Loaded ${indicators.length} indicators from storage`);
    }
    if (fs.existsSync(TRAININGS_FILE)) {
      trainings = JSON.parse(fs.readFileSync(TRAININGS_FILE, 'utf-8'));
      console.log(`📚 Loaded ${trainings.length} trainings from storage`);
    }
    if (fs.existsSync(NORMATIVOS_FILE)) {
      normativos = JSON.parse(fs.readFileSync(NORMATIVOS_FILE, 'utf-8'));
      console.log(`📋 Loaded ${normativos.length} normativos from storage`);
    }
  } catch (error) {
    console.error('Error loading data:', error);
  }
}

// Helper to save data to JSON files
function saveDocuments() {
  fs.writeFileSync(DOCUMENTS_FILE, JSON.stringify(documents, null, 2));
}

function saveClauseMappings() {
  fs.writeFileSync(CLAUSE_MAPPINGS_FILE, JSON.stringify(clauseMappings, null, 2));
}

function saveDrills() {
  fs.writeFileSync(DRILLS_FILE, JSON.stringify(drills, null, 2));
}

function saveNCRs() {
  fs.writeFileSync(NCR_FILE, JSON.stringify(ncrs, null, 2));
}

function saveIndicators() {
  fs.writeFileSync(INDICATORS_FILE, JSON.stringify(indicators, null, 2));
}

function saveTrainings() {
  fs.writeFileSync(TRAININGS_FILE, JSON.stringify(trainings, null, 2));
}

function saveNormativos() {
  fs.writeFileSync(NORMATIVOS_FILE, JSON.stringify(normativos, null, 2));
}

// Helper to extract content from DOCX files
async function extractDocxContent(filePath: string): Promise<string> {
  try {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  } catch (error) {
    console.error('Error extracting DOCX content:', error);
    return '';
  }
}

// Initialize documents from uploads folder
async function initializeDocuments() {
  console.log('🔄 Initializing documents from uploads...');
  
  if (!fs.existsSync(UPLOADS_DIR)) {
    console.log('📁 Uploads directory does not exist');
    return;
  }

  const files = fs.readdirSync(UPLOADS_DIR);
  const docxFiles = files.filter(f => f.endsWith('.docx') || f.endsWith('.pdf'));
  
  console.log(`📄 Found ${docxFiles.length} files in uploads`);

  for (const filename of docxFiles) {
    const filePath = path.join(UPLOADS_DIR, filename);
    const stats = fs.statSync(filePath);
    
    // Check if document already exists
    const existingDoc = documents.find(d => d.filePath === `/uploads/${filename}`);

    if (!existingDoc) {
      console.log(`🆕 Creating document for: ${filename}`);
      
      // Extract title from filename
      const titleMatch = filename.match(/^(.+?)-\d+\.docx$/);
      const title = titleMatch ? titleMatch[1].replace(/-/g, ' ') : filename.replace('.docx', '');
      
      // Extract content from DOCX
      let content = '';
      if (filename.endsWith('.docx')) {
        content = await extractDocxContent(filePath);
        console.log(`📝 Extracted ${content.length} characters from ${filename}`);
      }

      const newDoc = {
        id: `doc-${Date.now()}-${documents.length}`,
        title: title,
        type: 'PROCEDURE',
        status: 'DRAFT',
        filePath: `/uploads/${filename}`,
        fileName: filename,
        fileSize: stats.size,
        content: content,
        version: 1,
        tenantId: 'test-tenant',
        createdById: 'test-user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      documents.push(newDoc);
    } else {
      console.log(`✅ Document already exists: ${filename}`);
      
      // Update content if empty
      if (!existingDoc.content && filename.endsWith('.docx')) {
        const content = await extractDocxContent(filePath);
        if (content) {
          existingDoc.content = content;
          existingDoc.updatedAt = new Date().toISOString();
          console.log(`📝 Updated content for: ${filename}`);
        }
      }
    }
  }
  
  // Save to file
  saveDocuments();
  console.log('✅ Document initialization complete');
}

// Initialize NCR with sample data if empty
function initializeNCR() {
  if (ncrs.length === 0) {
    console.log('🆕 Initializing NCR with sample data...');
    ncrs.push({
      id: 'ncr-1',
      title: 'NCR-001 - Desviación en proceso de producción',
      description: 'Se detectó una desviación en el control de calidad del lote #4521',
      type: 'INTERNAL',
      status: 'OPEN',
      severity: 'HIGH',
      area: 'Producción',
      detectedAt: new Date().toISOString(),
      createdById: 'test-user',
      tenantId: 'test-tenant',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    ncrs.push({
      id: 'ncr-2',
      title: 'NCR-002 - Documentación incompleta',
      description: 'Falta registro de capacitación en seguridad para nuevo personal',
      type: 'INTERNAL',
      status: 'IN_PROGRESS',
      severity: 'MEDIUM',
      area: 'Recursos Humanos',
      detectedAt: new Date().toISOString(),
      createdById: 'test-user',
      tenantId: 'test-tenant',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    saveNCRs();
    console.log(`✅ NCR initialized: ${ncrs.length} items`);
  }
}

// Initialize Indicators with sample data if empty
function initializeIndicators() {
  if (indicators.length === 0) {
    console.log('🆕 Initializing Indicators with sample data...');
    indicators.push({
      id: 'ind-1',
      name: 'Eficiencia de Producción',
      description: 'Porcentaje de eficiencia en línea de producción principal',
      type: 'EFFICIENCY',
      unit: '%',
      target: 85,
      current: 82,
      status: 'ACTIVE',
      area: 'Producción',
      frequency: 'MONTHLY',
      tenantId: 'test-tenant',
      createdById: 'test-user',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    indicators.push({
      id: 'ind-2',
      name: 'Cumplimiento de Capacitaciones',
      description: 'Porcentaje de personal con capacitaciones al día',
      type: 'COMPLIANCE',
      unit: '%',
      target: 100,
      current: 95,
      status: 'ACTIVE',
      area: 'Seguridad',
      frequency: 'QUARTERLY',
      tenantId: 'test-tenant',
      createdById: 'test-user',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    saveIndicators();
    console.log(`✅ Indicators initialized: ${indicators.length} items`);
  }
}

// Initialize Trainings with sample data if empty
function initializeTrainings() {
  if (trainings.length === 0) {
    console.log('🆕 Initializing Trainings with sample data...');
    trainings.push({
      id: 'train-1',
      title: 'Seguridad Industrial Básica',
      description: 'Capacitación obligatoria en seguridad industrial para todo el personal',
      type: 'SAFETY',
      status: 'ACTIVE',
      duration: 8,
      mode: 'PRESENTIAL',
      area: 'Seguridad',
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      instructor: 'Juan Pérez',
      capacity: 20,
      enrolled: 15,
      tenantId: 'test-tenant',
      createdById: 'test-user',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    trainings.push({
      id: 'train-2',
      title: 'Manejo de Residuos Peligrosos',
      description: 'Procedimientos para manejo y disposición de residuos clasificados',
      type: 'ENVIRONMENTAL',
      status: 'PLANNED',
      duration: 4,
      mode: 'ONLINE',
      area: 'Medio Ambiente',
      startDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString(),
      instructor: 'María González',
      capacity: 30,
      enrolled: 0,
      tenantId: 'test-tenant',
      createdById: 'test-user',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    saveTrainings();
    console.log(`✅ Trainings initialized: ${trainings.length} items`);
  }
}

// Initialize Drills with sample data if empty
function initializeDrills() {
  if (drills.length === 0) {
    console.log('🆕 Initializing Drills with sample data...');
    drills.push({
      id: 'drill-1',
      name: 'Simulacro de Evacuación',
      description: 'Simulacro de evacuación por incendio - Planta Principal',
      type: 'FIRE',
      severity: 'HIGH',
      category: 'INDUSTRIAL_ACCIDENT',
      status: 'PLANNED',
      schedule: { plannedDate: '2024-12-15T10:00:00Z', duration: 2, start_time: '10:00', end_time: '12:00' },
      scope: { areas: ['Planta'], departments: ['Producción'], participants: 50, external_agencies: ['Bomberos'] },
      coordinator: { id: 'user-1', name: 'Coordinador', email: 'coord@test.com', phone: '123' },
      evaluators: [],
      resources: { equipment: [], personnel: [], facilities: [] },
      procedures: [],
      evaluation_criteria: [],
      participants: [],
      objectives: ['Evacuación segura', 'Control de incendios', 'Coordinación de equipos'],
      results: null,
      location: 'Planta Principal',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: 'test-user',
      tenantId: 'test-tenant'
    });
    saveDrills();
    console.log(`✅ Drills initialized: ${drills.length} items`);
  }
}

// Initialize all data
function initializeAllData() {
  initializeDocuments();
  initializeNCR();
  initializeIndicators();
  initializeTrainings();
  initializeDrills();
}

// Call initializeAllData function
initializeAllData();

// Auth
app.post('/api/auth/login', async () => ({ 
  user: { id: 'test-user', email: 'test@test.com', name: 'Test' }, 
  accessToken: 'token', 
  refreshToken: 'refresh' 
}));

app.get('/api/auth/me', async () => ({ 
  id: 'test-user', 
  email: 'test@test.com', 
  name: 'Test' 
}));

// Documents
app.get('/documents', async () => {
  return { 
    documents: documents.map(doc => ({
      ...doc,
      department: null, // TODO: Add departments support
      normatives: [], // TODO: Add normatives support
    })) 
  };
});

app.get('/documents/:id', async (request, reply) => {
  const { id } = request.params as any;
  const doc = documents.find(d => d.id === id);
  if (!doc) return reply.code(404).send({ error: 'Document not found' });
  
  // Get clause mappings for this document
  const mappings = clauseMappings.filter(m => m.documentId === id && !m.deletedAt);
  
  // Get normative data if document has normativeId
  let normative = null;
  let normatives = [];
  if (doc.normativeId) {
    // Find normative in our mock data
    const foundNormative = {
      id: doc.normativeId,
      name: 'ISO 39001',
      code: '2012',
      version: '2012',
      description: 'Seguridad Vial'
    };
    normative = foundNormative;
    normatives = [foundNormative];
  }
  
  // Get department data if document has departmentId
  let department = null;
  if (doc.departmentId) {
    const departments = [
      { id: 'dept-1', name: 'Calidad' },
      { id: 'dept-2', name: 'Seguridad' },
      { id: 'dept-3', name: 'Producción' },
      { id: 'dept-4', name: 'Mantenimiento' },
      { id: 'dept-5', name: 'Recursos Humanos' },
      { id: 'dept-6', name: 'Administración' }
    ];
    department = departments.find(d => d.id === doc.departmentId) || null;
  }
  
  return { 
    document: {
      ...doc,
      fileUrl: doc.filePath ? `http://localhost:3001${doc.filePath}` : null,
      originalFileName: doc.fileName,
      department: department,
      normative: normative,
      normatives: normatives,
      mappings: mappings
    }
  };
});

app.patch('/documents/:id', async (request, reply) => {
  const { id } = request.params as any;
  const body = request.body as any;
  
  const idx = documents.findIndex(d => d.id === id);
  if (idx === -1) return reply.code(404).send({ error: 'Document not found' });
  
  // Update fields including normativeId and departmentId
  documents[idx] = {
    ...documents[idx],
    title: body.title !== undefined ? body.title : documents[idx].title,
    status: body.status !== undefined ? body.status : documents[idx].status,
    type: body.type !== undefined ? body.type : documents[idx].type,
    normativeId: body.normativeId !== undefined ? body.normativeId : documents[idx].normativeId,
    departmentId: body.departmentId !== undefined ? body.departmentId : documents[idx].departmentId,
    updatedAt: new Date().toISOString()
  };
  
  // Save to file immediately
  saveDocuments();
  
  return { document: documents[idx] };
});

app.delete('/documents/:id', async (request, reply) => {
  const { id } = request.params as any;
  const idx = documents.findIndex(d => d.id === id);
  if (idx === -1) return reply.code(404).send({ error: 'Not found' });
  
  const deleted = documents.splice(idx, 1)[0];
  saveDocuments();
  
  return { success: true, document: deleted };
});

// Download document
app.get('/documents/:id/download', async (request, reply) => {
  const { id } = request.params as any;
  const doc = documents.find(d => d.id === id);
  
  if (!doc || !doc.filePath) {
    return reply.code(404).send({ error: 'Not found' });
  }
  
  const fileName = doc.filePath.replace('/uploads/', '');
  const filePath = path.join(UPLOADS_DIR, fileName);
  
  if (!fs.existsSync(filePath)) {
    return reply.code(404).send({ error: 'File not found' });
  }
  
  return reply.sendFile(fileName);
});

// Clause mappings
app.get('/documents/:id/clause-mappings', async (request, reply) => {
  const { id } = request.params as any;
  const mappings = clauseMappings.filter(m => m.documentId === id && !m.deletedAt);
  
  // Enrich mappings with clause data
  const enrichedMappings = mappings.map(m => {
    // Find clause data from normativos endpoint logic
    const clauseData = {
      id: m.clauseId,
      clauseNumber: '1.1', // Default value
      title: 'Cláusula ' + m.clauseId,
      content: 'Contenido de la cláusula...',
      normative: {
        id: 'norm-1',
        name: 'ISO 39001',
        code: '2012'
      }
    };
    
    return {
      ...m,
      clause: clauseData
    };
  });
  
  return { mappings: enrichedMappings };
});

app.post('/documents/:id/clause-mappings', async (request, reply) => {
  const { id } = request.params as any;
  const body = request.body as any;
  
  const mapping = {
    id: `mapping-${Date.now()}`,
    documentId: id,
    clauseId: body.clauseId,
    complianceType: body.complianceType || 'CUMPLE',
    notes: body.notes,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null
  };
  
  clauseMappings.push(mapping);
  saveClauseMappings();
  
  return mapping;
});

app.delete('/documents/:documentId/clause-mappings/:mappingId', async (request, reply) => {
  const { mappingId } = request.params as any;
  
  const mapping = clauseMappings.find(m => m.id === mappingId);
  if (!mapping) return reply.code(404).send({ error: 'Not found' });
  
  mapping.deletedAt = new Date().toISOString();
  saveClauseMappings();
  
  return { success: true, id: mappingId };
});

// Document versions
app.get('/documents/:id/versions', async (request, reply) => {
  const { id } = request.params as any;
  // Return versions from document
  return { versions: [] };
});

// Upload new document
app.post('/documents', async (request, reply) => {
  const body = request.body as any;
  
  const newDoc = {
    id: `doc-${Date.now()}`,
    title: body.title || 'Nuevo Documento',
    type: body.type || 'PROCEDURE',
    status: body.status || 'DRAFT',
    filePath: null,
    fileName: null,
    fileSize: null,
    content: null,
    version: 1,
    tenantId: 'test-tenant',
    createdById: 'test-user',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  documents.push(newDoc);
  saveDocuments();
  
  return reply.code(201).send({ document: newDoc });
});

// HR Departments
app.get('/hr/departments', async () => ({
  departments: [
    { id: 'dept-1', name: 'Calidad' },
    { id: 'dept-2', name: 'Seguridad' },
    { id: 'dept-3', name: 'Producción' },
    { id: 'dept-4', name: 'Mantenimiento' },
    { id: 'dept-5', name: 'Recursos Humanos' },
    { id: 'dept-6', name: 'Administración' }
  ]
}));

// Emergency endpoints
app.get('/emergency/drills', async () => ({ drills }));

app.get('/emergency/drills/:id', async (request, reply) => {
  const { id } = request.params as any;
  const drill = drills.find(d => d.id === id);
  if (!drill) return reply.code(404).send({ error: 'Not found' });
  return drill;
});

app.post('/emergency/drills', async (request, reply) => {
  const body = request.body as any;
  const newDrill = {
    id: `drill-${Date.now()}`,
    name: body.name,
    description: body.description || '',
    type: body.type || 'GENERAL',
    severity: body.severity || 'MEDIUM',
    category: body.category || 'INDUSTRIAL_ACCIDENT',
    status: body.status || 'PLANNED',
    schedule: { plannedDate: body.plannedDate || new Date().toISOString(), duration: body.duration || 1, start_time: body.start_time || '09:00', end_time: body.end_time || '10:00' },
    scope: { areas: body.areas || ['General'], departments: body.departments || ['General'], participants: body.participants || 10, external_agencies: body.external_agencies || [] },
    coordinator: { id: 'user-1', name: 'Coordinador', email: 'coord@test.com', phone: '123' },
    evaluators: [],
    resources: { equipment: [], personnel: [], facilities: [] },
    procedures: [],
    evaluation_criteria: [],
    participants: [],
    objectives: body.objectives || ['Objetivo general'],
    results: null,
    location: body.location || 'Por definir',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    created_by: 'test-user',
    tenantId: 'test-tenant'
  };
  drills.push(newDrill);
  saveDrills();
  return reply.code(201).send(newDrill);
});

app.put('/emergency/drills/:id', async (request, reply) => {
  const { id } = request.params as any;
  const body = request.body as any;
  const idx = drills.findIndex(d => d.id === id);
  if (idx === -1) return reply.code(404).send({ error: 'Not found' });
  drills[idx] = { ...drills[idx], ...body, updated_at: new Date().toISOString() };
  saveDrills();
  return drills[idx];
});

app.delete('/emergency/drills/:id', async (request, reply) => {
  const { id } = request.params as any;
  const idx = drills.findIndex(d => d.id === id);
  if (idx === -1) return reply.code(404).send({ error: 'Not found' });
  const deleted = drills.splice(idx, 1)[0];
  saveDrills();
  return { success: true, drill: deleted };
});

app.post('/emergency/drills/:id/start', async (request, reply) => {
  const { id } = request.params as any;
  const idx = drills.findIndex(d => d.id === id);
  if (idx === -1) return reply.code(404).send({ error: 'Not found' });
  drills[idx].status = 'IN_PROGRESS';
  drills[idx].updated_at = new Date().toISOString();
  saveDrills();
  return { success: true, drill: drills[idx] };
});

app.post('/emergency/drills/:id/complete', async (request, reply) => {
  const { id } = request.params as any;
  const idx = drills.findIndex(d => d.id === id);
  if (idx === -1) return reply.code(404).send({ error: 'Not found' });
  drills[idx].status = 'COMPLETED';
  drills[idx].updated_at = new Date().toISOString();
  (drills[idx] as any).results = {
    completion_rate: 100,
    participant_satisfaction: 4.5,
    objectives_achieved: 5,
    issues_identified: 0,
    lessons_learned: ['Simulacro completado exitosamente'],
    recommendations: ['Mantener procedimientos actuales'],
    improvement_actions: []
  };
  saveDrills();
  return { success: true, drill: drills[idx] };
});

app.get('/emergency/stats', async () => {
  const total = drills.length;
  const completed = drills.filter(d => d.status === 'COMPLETED').length;
  return { stats: { total, completed, inProgress: 0, planned: total - completed, completionRate: total > 0 ? Math.round((completed / total) * 100) : 0 } };
});

// NCR (No Conformidades)
app.get('/ncr', async () => ({ ncrs }));

app.get('/ncr/:id', async (request, reply) => {
  const { id } = request.params as any;
  const ncr = ncrs.find(n => n.id === id);
  if (!ncr) return reply.code(404).send({ error: 'Not found' });
  return { ncr };
});

app.post('/ncr', async (request, reply) => {
  const body = request.body as any;
  const newNcr = {
    id: `ncr-${Date.now()}`,
    title: body.title || 'Nueva NCR',
    description: body.description || '',
    type: body.type || 'INTERNAL',
    status: body.status || 'OPEN',
    severity: body.severity || 'MEDIUM',
    area: body.area || 'General',
    detectedAt: body.detectedAt || new Date().toISOString(),
    createdById: 'test-user',
    tenantId: 'test-tenant',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  ncrs.push(newNcr);
  saveNCRs();
  return reply.code(201).send({ ncr: newNcr });
});

app.put('/ncr/:id', async (request, reply) => {
  const { id } = request.params as any;
  const body = request.body as any;
  const idx = ncrs.findIndex(n => n.id === id);
  if (idx === -1) return reply.code(404).send({ error: 'Not found' });
  ncrs[idx] = { ...ncrs[idx], ...body, updatedAt: new Date().toISOString() };
  saveNCRs();
  return { ncr: ncrs[idx] };
});

app.delete('/ncr/:id', async (request, reply) => {
  const { id } = request.params as any;
  const idx = ncrs.findIndex(n => n.id === id);
  if (idx === -1) return reply.code(404).send({ error: 'Not found' });
  const deleted = ncrs.splice(idx, 1)[0];
  saveNCRs();
  return { success: true, ncr: deleted };
});

app.get('/ncr/stats', async () => ({
  stats: {
    total: ncrs.length,
    open: ncrs.filter(n => n.status === 'OPEN').length,
    closed: ncrs.filter(n => n.status === 'CLOSED').length,
    inProgress: ncrs.filter(n => n.status === 'IN_PROGRESS').length,
    highSeverity: ncrs.filter(n => n.severity === 'HIGH').length
  }
}));

// Indicadores
app.get('/indicators', async () => ({ indicators }));

app.get('/indicators/:id', async (request, reply) => {
  const { id } = request.params as any;
  const indicator = indicators.find(i => i.id === id);
  if (!indicator) return reply.code(404).send({ error: 'Not found' });
  return { indicator };
});

app.post('/indicators', async (request, reply) => {
  const body = request.body as any;
  const newIndicator = {
    id: `ind-${Date.now()}`,
    name: body.name || 'Nuevo Indicador',
    description: body.description || '',
    type: body.type || 'GENERAL',
    unit: body.unit || '%',
    target: body.target || 100,
    current: body.current || 0,
    status: body.status || 'ACTIVE',
    area: body.area || 'General',
    frequency: body.frequency || 'MONTHLY',
    tenantId: 'test-tenant',
    createdById: 'test-user',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  indicators.push(newIndicator);
  saveIndicators();
  return reply.code(201).send({ indicator: newIndicator });
});

app.put('/indicators/:id', async (request, reply) => {
  const { id } = request.params as any;
  const body = request.body as any;
  const idx = indicators.findIndex(i => i.id === id);
  if (idx === -1) return reply.code(404).send({ error: 'Not found' });
  indicators[idx] = { ...indicators[idx], ...body, updatedAt: new Date().toISOString() };
  saveIndicators();
  return { indicator: indicators[idx] };
});

app.delete('/indicators/:id', async (request, reply) => {
  const { id } = request.params as any;
  const idx = indicators.findIndex(i => i.id === id);
  if (idx === -1) return reply.code(404).send({ error: 'Not found' });
  const deleted = indicators.splice(idx, 1)[0];
  saveIndicators();
  return { success: true, indicator: deleted };
});

app.get('/indicators/stats', async () => ({
  stats: {
    total: indicators.length,
    active: indicators.filter(i => i.status === 'ACTIVE').length,
    inactive: indicators.filter(i => i.status === 'INACTIVE').length,
    onTarget: indicators.filter(i => i.current >= i.target).length,
    belowTarget: indicators.filter(i => i.current < i.target).length
  }
}));

// Capacitaciones
app.get('/trainings', async () => ({ trainings }));

app.get('/trainings/:id', async (request, reply) => {
  const { id } = request.params as any;
  const training = trainings.find(t => t.id === id);
  if (!training) return reply.code(404).send({ error: 'Not found' });
  return { training };
});

app.post('/trainings', async (request, reply) => {
  const body = request.body as any;
  const newTraining = {
    id: `train-${Date.now()}`,
    title: body.title || 'Nueva Capacitación',
    description: body.description || '',
    type: body.type || 'GENERAL',
    status: body.status || 'ACTIVE',
    duration: body.duration || 4,
    mode: body.mode || 'PRESENTIAL',
    area: body.area || 'General',
    startDate: body.startDate || new Date().toISOString(),
    endDate: body.endDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    instructor: body.instructor || 'Por definir',
    capacity: body.capacity || 20,
    enrolled: body.enrolled || 0,
    tenantId: 'test-tenant',
    createdById: 'test-user',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  trainings.push(newTraining);
  saveTrainings();
  return reply.code(201).send({ training: newTraining });
});

app.put('/trainings/:id', async (request, reply) => {
  const { id } = request.params as any;
  const body = request.body as any;
  const idx = trainings.findIndex(t => t.id === id);
  if (idx === -1) return reply.code(404).send({ error: 'Not found' });
  trainings[idx] = { ...trainings[idx], ...body, updatedAt: new Date().toISOString() };
  saveTrainings();
  return { training: trainings[idx] };
});

app.delete('/trainings/:id', async (request, reply) => {
  const { id } = request.params as any;
  const idx = trainings.findIndex(t => t.id === id);
  if (idx === -1) return reply.code(404).send({ error: 'Not found' });
  const deleted = trainings.splice(idx, 1)[0];
  saveTrainings();
  return { success: true, training: deleted };
});

app.get('/trainings/stats', async () => ({
  stats: {
    total: trainings.length,
    active: trainings.filter(t => t.status === 'ACTIVE').length,
    completed: trainings.filter(t => t.status === 'COMPLETED').length,
    totalCapacity: trainings.reduce((sum, t) => sum + t.capacity, 0),
    totalEnrolled: trainings.reduce((sum, t) => sum + t.enrolled, 0)
  }
}));

// Dashboard
app.get('/dashboard', async () => ({
  dashboard: {
    documents: { total: documents.length, active: documents.filter(d => d.status === 'ACTIVE' || d.status === 'EFFECTIVE').length },
    ncrs: { total: ncrs.length, open: ncrs.filter(n => n.status === 'OPEN').length },
    indicators: { total: indicators.length, onTarget: indicators.filter(i => i.current >= i.target).length },
    trainings: { total: trainings.length, active: trainings.filter(t => t.status === 'ACTIVE').length },
    drills: { total: drills.length, planned: drills.filter(d => d.status === 'PLANNED').length }
  }
}));

// Normativos
app.get('/normativos', async () => {
  // Initialize normativos array if empty
  if (normativos.length === 0) {
    normativos.push({
      id: 'norm-1',
      name: 'ISO 39001',
      code: '2012',
      version: '2012',
      description: 'Seguridad Vial',
      status: 'ACTIVE',
      processingStatus: 'COMPLETED',
      fileSize: 1024 * 1024 * 2.5,
      filePath: '/uploads/ISO-39001-2012.pdf',
      originalFileName: 'ISO-39001-2012.pdf',
      fileHash: 'abc123',
      clauseCount: 45,
      tenantId: 'test-tenant',
      createdById: 'test-user',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    saveNormativos();
  }
  return { normativos };
});

app.post('/normativos', async (request, reply) => {
  const body = request.body as any;
  const newNorm = {
    id: `norm-${Date.now()}`,
    name: body.name,
    code: body.code,
    version: body.version || '1.0',
    description: body.description || '',
    status: 'PROCESSING',
    processingStatus: 'PROCESSING',
    fileSize: body.fileSize || 0,
    filePath: body.filePath || null,
    originalFileName: body.originalFileName || null,
    fileHash: body.fileHash || null,
    clauseCount: 0,
    tenantId: 'test-tenant',
    createdById: 'test-user',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  normativos.push(newNorm);
  saveNormativos();
  return reply.code(201).send(newNorm);
});

app.get('/normativos/:id', async (request, reply) => {
  const { id } = request.params as any;
  const norm = normativos.find(n => n.id === id);
  if (!norm) return reply.code(404).send({ error: 'Normative not found' });
  return { normative: norm };
});

app.put('/normativos/:id', async (request, reply) => {
  const { id } = request.params as any;
  const body = request.body as any;
  const idx = normativos.findIndex(n => n.id === id);
  if (idx === -1) return reply.code(404).send({ error: 'Normative not found' });
  
  normativos[idx] = {
    ...normativos[idx],
    name: body.name !== undefined ? body.name : normativos[idx].name,
    code: body.code !== undefined ? body.code : normativos[idx].code,
    version: body.version !== undefined ? body.version : normativos[idx].version,
    description: body.description !== undefined ? body.description : normativos[idx].description,
    status: body.status !== undefined ? body.status : normativos[idx].status,
    processingStatus: body.processingStatus !== undefined ? body.processingStatus : normativos[idx].processingStatus,
    fileSize: body.fileSize !== undefined ? body.fileSize : normativos[idx].fileSize,
    filePath: body.filePath !== undefined ? body.filePath : normativos[idx].filePath,
    originalFileName: body.originalFileName !== undefined ? body.originalFileName : normativos[idx].originalFileName,
    clauseCount: body.clauseCount !== undefined ? body.clauseCount : normativos[idx].clauseCount,
    updatedAt: new Date().toISOString()
  };
  saveNormativos();
  return { normative: normativos[idx] };
});

app.delete('/normativos/:id', async (request, reply) => {
  const { id } = request.params as any;
  const idx = normativos.findIndex(n => n.id === id);
  if (idx === -1) return reply.code(404).send({ error: 'Normative not found' });
  const deleted = normativos.splice(idx, 1)[0];
  saveNormativos();
  return { success: true, normative: deleted };
});

app.get('/normativos/:id/clauses', async (request) => {
  const { id } = request.params as any;
  return { clauses: [{ id: `${id}-c1`, clauseNumber: '1', title: 'Requisitos', content: 'Contenido...', normativeId: id }] };
});

app.get('/normativos/:id/status', async (request, reply) => {
  const { id } = request.params as any;
  const norm = normativos.find(n => n.id === id);
  if (!norm) return reply.code(404).send({ error: 'Normative not found' });
  
  return {
    id: norm.id,
    status: 'ACTIVE',
    progress: 100,
    currentStep: 'Procesamiento completado',
    totalClauses: norm.clauseCount || 0,
    processedClauses: norm.clauseCount || 0,
    errors: []
  };
});

// Health
app.get('/notifications/count', async () => ({ count: 0, unread: 0 }));

app.get('/health', async () => ({
  status: 'ok',
  timestamp: new Date().toISOString(),
  documents: documents.length,
  drills: drills.length,
  normativos: 1
}));

// Start server
const start = async () => {
  try {
    // Load persisted data
    loadData();
    
    // Initialize documents from uploads
    await initializeDocuments();
    
    // Initialize other modules if empty
    initializeNCR();
    initializeIndicators();
    initializeTrainings();
    initializeDrills();
    
    await app.listen({ port: 3001, host: '0.0.0.0' });
    console.log('🚀 SGI 360 API con persistencia en puerto 3001');
    console.log('💾 Datos guardados en:', DATA_DIR);
    console.log('💾 Los cambios ahora son PERMANENTES');
  } catch (err) {
    console.error('❌ Error starting server:', err);
    process.exit(1);
  }
};

start();
