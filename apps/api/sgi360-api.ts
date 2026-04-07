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

// Cargar documentos reales desde uploads
function loadDocuments() {
  const documents = [];
  if (!fs.existsSync(UPLOADS_DIR)) return documents;
  
  const files = fs.readdirSync(UPLOADS_DIR);
  files.forEach((filename, index) => {
    if (filename.endsWith('.docx') || filename.endsWith('.pdf')) {
      const filePath = path.join(UPLOADS_DIR, filename);
      const stats = fs.statSync(filePath);
      const title = filename.replace(/\.[^/.]+$/, '').replace(/-\d+$/, '').trim();
      
      let type = 'DOCUMENT';
      if (filename.includes('POL')) type = 'POLICY';
      else if (filename.includes('PRO')) type = 'PROCEDURE';
      
      documents.push({
        id: `doc-${Date.now()}-${index}`,
        title,
        type,
        status: 'ACTIVE',
        filePath: `/uploads/${filename}`,
        fileName: filename,
        fileSize: stats.size,
        createdAt: stats.mtime.toISOString(),
        tenantId: 'test-tenant',
        createdById: 'test-user'
      });
    }
  });
  return documents;
}

// Datos en memoria
let documents = loadDocuments();

const drills = [
  {
    id: 'drill-1',
    name: 'Simulacro de Evacuación',
    description: 'Simulacro de evacuación por incendio',
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
  }
];

const contingencyPlans = [
  {
    id: 'cont-1',
    name: 'Plan de Contingencia',
    description: 'Plan de respuesta a incendios',
    type: 'EMERGENCY_RESPONSE',
    scope: { business_units: ['Planta'], critical_processes: ['Producción'], systems: ['Alarmas'], facilities: ['Planta'] },
    risk_assessment: { identified_risks: [{ risk: 'Incendio', probability: 'MEDIUM', impact: 'HIGH', mitigation_strategy: 'Extintores' }], recovery_objectives: { rto: 4, rpo: 2, mtd: 8 } },
    response_teams: [{ team_name: 'Equipo 1', leader: 'Jefe', members: ['Miembro 1'], responsibilities: ['Evacuación'], contact_info: { primary_phone: '123', secondary_phone: '456', email: 'team@test.com' } }],
    communication_plan: { internal_channels: [], external_contacts: [], escalation_procedures: [] },
    recovery_procedures: [],
    testing_schedule: { next_test_date: '2024-12-15', test_frequency: 'QUARTERLY', test_types: [] },
    documentation: { plan_version: '1.0', approval_date: '2024-01-01', next_review_date: '2024-12-31', attachments: [] },
    status: 'ACTIVE',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    created_by: 'test-user'
  }
];

const emergencyResources = [
  { id: 'res-1', name: 'Equipo de Primeros Auxilios', type: 'MEDICAL', quantity: 10, location: 'Enfermería', status: 'AVAILABLE' },
  { id: 'res-2', name: 'Extintores', type: 'FIRE', quantity: 20, location: 'Pasillos', status: 'AVAILABLE' }
];

const normativos = [
  { id: 'norm-1', name: 'ISO 39001', code: '2012', version: '2012', description: 'Seguridad Vial', status: 'ACTIVE', tenantId: 'test-tenant', createdById: 'test-user', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
];

// Auth
app.post('/api/auth/login', async () => ({ user: { id: 'test-user', email: 'test@test.com', name: 'Test' }, accessToken: 'token', refreshToken: 'refresh' }));
app.get('/api/auth/me', async () => ({ id: 'test-user', email: 'test@test.com', name: 'Test' }));

// Documents
app.get('/documents', async () => ({ documents }));

app.get('/documents/:id', async (request, reply) => {
  const { id } = request.params as any;
  const doc = documents.find(d => d.id === id);
  if (!doc) return reply.code(404).send({ error: 'Document not found' });
  return { document: doc };
});

app.delete('/documents/:id', async (request, reply) => {
  const { id } = request.params as any;
  const idx = documents.findIndex(d => d.id === id);
  if (idx === -1) return reply.code(404).send({ error: 'Not found' });
  const deleted = documents.splice(idx, 1)[0];
  return { success: true, document: deleted };
});

// PATCH update document (para modo edición)
app.patch('/documents/:id', async (request, reply) => {
  const { id } = request.params as any;
  const body = request.body as any;
  const idx = documents.findIndex(d => d.id === id);
  if (idx === -1) return reply.code(404).send({ error: 'Document not found' });
  
  // Actualizar campos permitidos
  documents[idx] = {
    ...documents[idx],
    title: body.title || documents[idx].title,
    status: body.status || documents[idx].status,
    type: body.type || documents[idx].type,
    updatedAt: new Date().toISOString()
  };
  
  return { document: documents[idx] };
});

// Clause mappings endpoint
app.get('/documents/:id/clause-mappings', async (request, reply) => {
  const { id } = request.params as any;
  return { mappings: [] };
});

// POST clause mapping
app.post('/documents/:id/clause-mappings', async (request, reply) => {
  const { id } = request.params as any;
  const body = request.body as any;
  return { 
    id: `mapping-${Date.now()}`,
    documentId: id,
    clauseId: body.clauseId,
    complianceType: body.complianceType || 'CUMPLE',
    notes: body.notes,
    createdAt: new Date().toISOString()
  };
});

// DELETE clause mapping
app.delete('/documents/:documentId/clause-mappings/:mappingId', async (request, reply) => {
  const { mappingId } = request.params as any;
  return { success: true, id: mappingId };
});

// Document versions
app.get('/documents/:id/versions', async (request, reply) => {
  const { id } = request.params as any;
  return { versions: [] };
});

// POST new version
app.post('/documents/:id/versions', async (request, reply) => {
  const { id } = request.params as any;
  return { 
    id: `version-${Date.now()}`,
    documentId: id,
    version: 2,
    createdAt: new Date().toISOString()
  };
});

// Download document
app.get('/documents/:id/download', async (request, reply) => {
  const { id } = request.params as any;
  console.log(`📥 Download request for ID: ${id}`);
  
  const doc = documents.find(d => d.id === id);
  if (!doc) {
    console.log(`❌ Document not found: ${id}`);
    return reply.code(404).send({ error: 'Not found' });
  }
  
  console.log(`✅ Document found: ${doc.id}, filePath: ${doc.filePath}`);
  
  // Si hay archivo físico, servirlo
  if (doc.filePath) {
    const fileName = doc.filePath.replace('/uploads/', '');
    console.log(`📄 Serving file: ${fileName}`);
    return reply.sendFile(fileName);
  }
  
  console.log(`❌ No filePath for document: ${id}`);
  return reply.code(404).send({ error: 'File not found' });
});

// Upload new document
app.post('/documents', async (request, reply) => {
  const body = request.body as any;
  const newDoc = {
    id: `doc-${Date.now()}`,
    title: body.title || 'Nuevo Documento',
    type: body.type || 'PROCEDURE',
    status: body.status || 'DRAFT',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tenantId: 'test-tenant',
    createdById: 'test-user',
    version: 1,
    filePath: null,
    fileName: null
  };
  documents.push(newDoc);
  return reply.code(201).send({ document: newDoc });
});

// HR Departments endpoint (para selector de departamentos)
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
  return reply.code(201).send(newDrill);
});

app.get('/emergency/drills/:id', async (request, reply) => {
  const { id } = request.params as any;
  const drill = drills.find(d => d.id === id);
  if (!drill) return reply.code(404).send({ error: 'Not found' });
  return drill;
});

app.put('/emergency/drills/:id', async (request, reply) => {
  const { id } = request.params as any;
  const body = request.body as any;
  const idx = drills.findIndex(d => d.id === id);
  if (idx === -1) return reply.code(404).send({ error: 'Not found' });
  drills[idx] = { ...drills[idx], ...body, updated_at: new Date().toISOString() };
  return drills[idx];
});

app.delete('/emergency/drills/:id', async (request, reply) => {
  const { id } = request.params as any;
  const idx = drills.findIndex(d => d.id === id);
  if (idx === -1) return reply.code(404).send({ error: 'Not found' });
  const deleted = drills.splice(idx, 1)[0];
  return { success: true, drill: deleted };
});

app.post('/emergency/drills/:id/start', async (request, reply) => {
  const { id } = request.params as any;
  const idx = drills.findIndex(d => d.id === id);
  if (idx === -1) return reply.code(404).send({ error: 'Not found' });
  drills[idx].status = 'IN_PROGRESS';
  drills[idx].updated_at = new Date().toISOString();
  return { success: true, drill: drills[idx] };
});

app.post('/emergency/drills/:id/complete', async (request, reply) => {
  const { id } = request.params as any;
  const idx = drills.findIndex(d => d.id === id);
  if (idx === -1) return reply.code(404).send({ error: 'Not found' });
  drills[idx].status = 'COMPLETED';
  drills[idx].updated_at = new Date().toISOString();
  // Agregar resultados mock
  (drills[idx] as any).results = {
    completion_rate: 100,
    participant_satisfaction: 4.5,
    objectives_achieved: 5,
    issues_identified: 0,
    lessons_learned: ['Simulacro completado exitosamente'],
    recommendations: ['Mantener procedimientos actuales'],
    improvement_actions: []
  };
  return { success: true, drill: drills[idx] };
});

app.get('/emergency/stats', async () => {
  const total = drills.length;
  const completed = drills.filter(d => d.status === 'COMPLETED').length;
  return { stats: { total, completed, inProgress: 0, planned: total - completed, completionRate: total > 0 ? Math.round((completed / total) * 100) : 0 } };
});

app.get('/emergency/resources', async () => ({ resources: emergencyResources }));

app.get('/emergency/contingency-plans', async () => ({ plans: contingencyPlans }));

app.post('/emergency/contingency-plans', async (request, reply) => {
  const body = request.body as any;
  const newPlan = {
    id: `cont-${Date.now()}`,
    name: body.name,
    description: body.description || '',
    type: body.type || 'GENERAL',
    scope: { business_units: [], critical_processes: [], systems: [], facilities: [] },
    risk_assessment: { identified_risks: [], recovery_objectives: { rto: 4, rpo: 2, mtd: 8 } },
    response_teams: [],
    communication_plan: { internal_channels: [], external_contacts: [], escalation_procedures: [] },
    recovery_procedures: [],
    testing_schedule: { next_test_date: new Date().toISOString(), test_frequency: 'QUARTERLY', test_types: [] },
    documentation: { plan_version: '1.0', approval_date: new Date().toISOString(), next_review_date: new Date().toISOString(), attachments: [] },
    status: 'ACTIVE',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    created_by: 'test-user'
  };
  contingencyPlans.push(newPlan);
  return reply.code(201).send(newPlan);
});

// Normativos
app.get('/normativos', async () => ({ normativos }));
app.post('/normativos', async (request, reply) => {
  const body = request.body as any;
  const newNorm = {
    id: `norm-${Date.now()}`,
    name: body.name,
    code: body.code,
    version: body.version || '1.0',
    description: body.description || '',
    status: 'PROCESSING',
    tenantId: 'test-tenant',
    createdById: 'test-user',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  normativos.push(newNorm);
  return reply.code(201).send(newNorm);
});

app.get('/normativos/:id/clauses', async (request) => {
  const { id } = request.params as any;
  return { clauses: [{ id: `${id}-c1`, clauseNumber: '1', title: 'Requisitos', content: 'Contenido...', normativeId: id }] };
});

// NCR (No Conformidades)
const ncrs = [
  {
    id: 'ncr-1',
    title: 'NCR-001 - Desviación en proceso',
    description: 'Se detectó una desviación en el proceso de producción',
    type: 'INTERNAL',
    status: 'OPEN',
    severity: 'HIGH',
    area: 'Producción',
    detectedAt: new Date().toISOString(),
    createdById: 'test-user',
    tenantId: 'test-tenant',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

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
  return reply.code(201).send({ ncr: newNcr });
});

app.put('/ncr/:id', async (request, reply) => {
  const { id } = request.params as any;
  const body = request.body as any;
  const idx = ncrs.findIndex(n => n.id === id);
  if (idx === -1) return reply.code(404).send({ error: 'Not found' });
  ncrs[idx] = { ...ncrs[idx], ...body, updatedAt: new Date().toISOString() };
  return { ncr: ncrs[idx] };
});

app.delete('/ncr/:id', async (request, reply) => {
  const { id } = request.params as any;
  const idx = ncrs.findIndex(n => n.id === id);
  if (idx === -1) return reply.code(404).send({ error: 'Not found' });
  const deleted = ncrs.splice(idx, 1)[0];
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
const indicators = [
  {
    id: 'ind-1',
    name: 'Eficiencia de Producción',
    description: 'Medición de eficiencia en línea de producción',
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
  }
];

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
  return reply.code(201).send({ indicator: newIndicator });
});

app.put('/indicators/:id', async (request, reply) => {
  const { id } = request.params as any;
  const body = request.body as any;
  const idx = indicators.findIndex(i => i.id === id);
  if (idx === -1) return reply.code(404).send({ error: 'Not found' });
  indicators[idx] = { ...indicators[idx], ...body, updatedAt: new Date().toISOString() };
  return { indicator: indicators[idx] };
});

app.delete('/indicators/:id', async (request, reply) => {
  const { id } = request.params as any;
  const idx = indicators.findIndex(i => i.id === id);
  if (idx === -1) return reply.code(404).send({ error: 'Not found' });
  const deleted = indicators.splice(idx, 1)[0];
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
const trainings = [
  {
    id: 'train-1',
    title: 'Seguridad Industrial Básica',
    description: 'Capacitación en seguridad industrial para nuevo personal',
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
  }
];

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
  return reply.code(201).send({ training: newTraining });
});

app.put('/trainings/:id', async (request, reply) => {
  const { id } = request.params as any;
  const body = request.body as any;
  const idx = trainings.findIndex(t => t.id === id);
  if (idx === -1) return reply.code(404).send({ error: 'Not found' });
  trainings[idx] = { ...trainings[idx], ...body, updatedAt: new Date().toISOString() };
  return { training: trainings[idx] };
});

app.delete('/trainings/:id', async (request, reply) => {
  const { id } = request.params as any;
  const idx = trainings.findIndex(t => t.id === id);
  if (idx === -1) return reply.code(404).send({ error: 'Not found' });
  const deleted = trainings.splice(idx, 1)[0];
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

// Dashboard general
app.get('/dashboard', async () => ({
  dashboard: {
    documents: { total: documents.length, active: documents.filter(d => d.status === 'ACTIVE' || d.status === 'EFFECTIVE').length },
    ncrs: { total: ncrs.length, open: ncrs.filter(n => n.status === 'OPEN').length },
    indicators: { total: indicators.length, onTarget: indicators.filter(i => i.current >= i.target).length },
    trainings: { total: trainings.length, active: trainings.filter(t => t.status === 'ACTIVE').length },
    drills: { total: drills.length, planned: drills.filter(d => d.status === 'PLANNED').length }
  }
}));

// Health
app.get('/notifications/count', async () => ({ count: 0, unread: 0 }));

app.get('/health', async () => ({
  status: 'ok',
  timestamp: new Date().toISOString(),
  documents: documents.length,
  drills: drills.length,
  normativos: normativos.length
}));

// Start
app.listen({ port: 3001, host: '0.0.0.0' }, () => {
  console.log('🚀 SGI 360 API en puerto 3001');
  console.log(`📄 ${documents.length} documentos cargados`);
  console.log(`📊 ${drills.length} drills`);
  console.log(`📋 ${normativos.length} normativos`);
});
