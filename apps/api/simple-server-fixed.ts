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

const app = Fastify({
  logger: false,
});

// Register plugins
app.register(cors, {
  origin: ['http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-csrf-token', 'x-tenant-id']
});

app.register(cookie);
app.register(multipart);

// Data storage
const drills: any[] = [
  {
    id: 'drill-1775181853942',
    name: 'Simulacro de Evacuación por Incendio',
    type: 'FIRE',
    severity: 'HIGH',
    status: 'PLANNED',
    scheduledDate: '2024-12-15T10:00:00Z',
    location: 'Planta Principal',
    description: 'Simulacro de evacuación por incendio en áreas de producción',
    participants: [],
    evaluation_criteria: [],
    createdAt: '2024-12-02T14:00:00.000Z',
    updatedAt: '2024-12-02T14:00:00.000Z',
    tenantId: 'test-tenant',
    createdById: 'test-user'
  }
];

const documents: any[] = [];
const clauseMappings: any[] = [];
const normativos: any[] = [
  {
    id: 'fc580340-831e-4dae-a90f-d055b55ecbbd',
    name: 'ISO 39001',
    code: '2012',
    version: '2012',
    description: 'Sistema de Gestión de Seguridad Vial',
    status: 'ACTIVE',
    tenantId: 'test-tenant',
    createdById: 'test-user',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  }
];

// Auth endpoints
app.post('/api/auth/login', async (request, reply) => {
  return {
    user: {
      id: 'test-user',
      email: 'test@example.com',
      name: 'Test User'
    },
    accessToken: 'test-token',
    refreshToken: 'refresh-token'
  };
});

app.get('/api/auth/me', async () => {
  return {
    id: 'test-user',
    email: 'test@example.com',
    name: 'Test User'
  };
});

// Normativos endpoints - CORREGIDOS
app.get('/normativos', async () => {
  try {
    console.log('📋 Serving normativos:', normativos.length);
    return { normativos: normativos };
  } catch (error) {
    console.error('Error fetching normativos:', error);
    return { normativos: [] };
  }
});

app.post('/normativos', async (request, reply) => {
  try {
    const body = request.body as any;
    const newNormativo = {
      id: 'norm-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
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
    
    normativos.push(newNormativo);
    console.log('✅ Normativo created:', newNormativo.id);
    
    return reply.code(201).send(newNormativo);
  } catch (error) {
    console.error('Error creating normativo:', error);
    return reply.code(500).send({ error: 'Failed to create normativo' });
  }
});

app.get('/normativos/:id/clauses', async (request, reply) => {
  const { id } = request.params as any;
  
  const mockClauses = [
    {
      id: `${id}-clause-1`,
      clauseNumber: '1',
      title: 'Requisitos Generales',
      content: 'La organización debe establecer, documentar, implementar y mantener un sistema de gestión...',
      normativeId: id
    },
    {
      id: `${id}-clause-2`,
      clauseNumber: '2', 
      title: 'Política de Seguridad Vial',
      content: 'La alta dirección debe definir y autorizar una política de seguridad vial...',
      normativeId: id
    },
    {
      id: `${id}-clause-3`,
      clauseNumber: '3',
      title: 'Planificación',
      content: 'La organización debe planificar la implementación del sistema de gestión...',
      normativeId: id
    }
  ];
  
  return { clauses: mockClauses };
});

// Simulacros endpoints
app.get('/simulacros', async () => {
  return { simulacros: drills };
});

app.get('/simulacros/stats', async () => {
  const totalDrills = drills.length;
  const completedDrills = drills.filter(d => d.status === 'COMPLETED').length;
  const scheduledDrills = drills.filter(d => d.status === 'PLANNED' || d.status === 'IN_PROGRESS').length;
  
  return {
    stats: {
      total: totalDrills,
      completed: completedDrills,
      scheduled: scheduledDrills,
      overdue: 0,
      completionRate: totalDrills > 0 ? Math.round((completedDrills / totalDrills) * 100) : 0
    }
  };
});

// Documents endpoints
app.get('/documents', async () => {
  return { documents: documents };
});

app.get('/documents/:id', async (request, reply) => {
  const { id } = request.params as any;
  const document = documents.find(doc => doc.id === id);
  
  if (!document) {
    return reply.code(404).send({ error: 'Document not found' });
  }
  
  return document;
});

app.get('/documents/:id/clause-mappings', async (request, reply) => {
  const { id } = request.params as any;
  
  const documentMappings = clauseMappings.filter(mapping => mapping.documentId === id);
  
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
  
  const newMapping = {
    id: 'mapping-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
    documentId: id,
    clauseId: body.clauseId || 'default-clause',
    complianceType: body.complianceType || 'CUMPLE',
    notes: body.notes || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  clauseMappings.push(newMapping);
  
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
  
  const mappingIndex = clauseMappings.findIndex(
    mapping => mapping.documentId === id && mapping.id === mappingId
  );
  
  if (mappingIndex === -1) {
    return reply.code(404).send({ error: 'Mapping not found' });
  }
  
  const deletedMapping = clauseMappings.splice(mappingIndex, 1)[0];
  
  return {
    mappingId,
    message: 'Cláusula desvinculada correctamente',
    deletedMapping
  };
});

// Health check
app.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
const start = async () => {
  try {
    await app.listen({ port: 3001, host: '0.0.0.0' });
    console.log('🚀 SGI 360 API running on port 3001');
    console.log('📋 Normativos loaded:', normativos.length);
    console.log('📊 Simulacros loaded:', drills.length);
  } catch (err) {
    console.error('Error starting server:', err);
    process.exit(1);
  }
};

start();
