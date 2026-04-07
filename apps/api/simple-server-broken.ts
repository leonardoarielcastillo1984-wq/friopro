import Fastify, { FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';

const app = Fastify({
  logger: false,
});

// Register multipart plugin for file uploads
app.register(multipart);

// In-memory storage for demo purposes
const documents: any[] = [];
const normativos: any[] = [];

await app.register(cors, {
  origin: 'http://localhost:3000',
  credentials: true,
});

await app.register(cookie);

// Health check
app.get('/health', async () => ({ status: 'ok' }));

// Auth endpoints
app.post('/api/auth/login', async (request, reply) => {
  const { email, password } = request.body as any;
  
  if (email === 'admin@sgi360.com' && password === 'Admin123!') {
    const token = 'mock-jwt-token-' + Date.now();
    reply.setCookie('access_token', token, { path: '/', httpOnly: true, sameSite: 'lax' });
    
    return {
      token,
      user: { id: 'd03b0adb-6557-4430-ae10-046493e31c8b', email: 'admin@sgi360.com', globalRole: 'SUPER_ADMIN' },
      activeTenant: { id: 'f20f0bfe-c1d8-40f6-8d36-97734881ffde', name: 'Demo Company', slug: 'demo-company' },
      tenantRole: 'TENANT_ADMIN',
    };
  }
  
  return reply.code(401).send({ error: 'Invalid credentials' });
});

app.get('/api/auth/me', async (request, reply) => {
  const token = request.cookies.access_token;
  
  if (!token) {
    return reply.code(401).send({ error: 'No token found' });
  }
  
  return {
    user: { id: 'd03b0adb-6557-4430-ae10-046493e31c8b', email: 'admin@sgi360.com', globalRole: 'SUPER_ADMIN' },
    activeTenant: { id: 'f20f0bfe-c1d8-40f6-8d36-97734881ffde', name: 'Demo Company', slug: 'demo-company' },
    tenantRole: 'TENANT_ADMIN',
  };
});

// NCR endpoints
app.get('/ncr', async () => ({ ncrs: [] }));
app.get('/ncr/stats', async () => ({ 
  stats: {
    total: 0,
    open: 0,
    inProgress: 0,
    closed: 0,
    bySeverity: { CRITICAL: 0, MAJOR: 0, MINOR: 0, OBSERVATION: 0 },
    byStatus: { OPEN: 0, IN_ANALYSIS: 0, ACTION_PLANNED: 0, IN_PROGRESS: 0, VERIFICATION: 0, CLOSED: 0, CANCELLED: 0 }
  }
}));
app.post('/ncr', async () => ({ 
  id: 'temp-' + Date.now(),
  message: 'No conformidad creada (temporal)'
}));

// Indicators endpoints  
app.get('/indicators', async () => ({ 
  indicators: [
    // Empty array, but if we had data, it would look like:
    // {
    //   id: 'temp-id',
    //   code: 'KPI-001',
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
    //   owner: null,
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
    trending: { up: 0, down: 0, stable: 0 },
    categories: {},
  }
}));
app.get('/indicators/:id', async (request) => { 
  const { id } = request.params as any;
  return { 
    id,
    code: 'KPI-001',
    name: 'Indicador temporal',
    description: 'Datos de ejemplo',
    category: 'Calidad',
    process: null,
    standard: null,
    currentValue: null,
    targetValue: 100,
    minValue: null,
    maxValue: null,
    unit: '%',
    frequency: 'MONTHLY',
    trend: 'STABLE',
    isActive: true,
    owner: null,
    measurements: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
});
app.post('/indicators', async (request) => { 
  const body = request.body as any;
  return { 
    id: 'temp-' + Date.now(),
    code: 'KPI-' + Date.now(),
    name: body.name || 'Nuevo Indicador',
    description: body.description || null,
    category: body.category || 'General',
    process: null,
    standard: null,
    currentValue: null,
    targetValue: body.targetValue ? parseFloat(body.targetValue) : null,
    minValue: null,
    maxValue: null,
    unit: body.unit || '%',
    frequency: body.frequency || 'MONTHLY',
    trend: 'STABLE',
    isActive: true,
    owner: null,
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
    id: 'temp-' + Date.now(),
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
    message: `Notificaciones marcadas como leídas: ${body.ids?.join(', ') || 'none'} (temporal)`
  };
});
app.post('/notifications', async () => ({ 
  id: 'temp-' + Date.now(),
  message: 'Notificación creada (temporal)'
}));

// Dashboard endpoint
app.get('/dashboard', async () => ({
  dashboard: {
    documents: {
      total: 0,
      effective: 0,
      draft: 0,
      recent: []
    },
    normatives: {
      total: 0,
      ready: 0,
      totalClauses: 0
    },
    departments: 0,
    // Additional properties expected by the panel
    ncrs: {
      total: 0,
      closed: 0,
      open: 0
    },
    risks: {
      total: 0,
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    },
    findings: {
      total: 0,
      open: 0,
      closed: 0
    },
    trainings: {
      total: 0,
      completed: 0,
      scheduled: 0
    },
    indicators: {
      total: 0,
      active: 0,
      onTarget: 0
    }
  }
}));

// Risk endpoints
app.get('/risks', async () => ({ risks: [] }));
app.get('/risks/stats', async () => ({ 
  stats: {
    total: 0,
    byStatus: {
      IDENTIFIED: 0,
      ASSESSED: 0,
      MITIGATING: 0,
      MONITORED: 0,
      CLOSED: 0,
    },
    byCategory: {},
    byLevel: {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    },
  }
}));
app.post('/risks', async (request) => { 
  const body = request.body as any;
  return { 
    id: 'temp-' + Date.now(),
    title: body.title || 'Nuevo Riesgo',
    description: body.description || '',
    category: body.category || 'Operacional',
    probability: body.probability || 3,
    impact: body.impact || 3,
    level: (body.probability || 3) * (body.impact || 3),
    status: 'IDENTIFIED',
    treatmentPlan: body.treatmentPlan || '',
    controls: body.controls || '',
    standard: body.standard || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    message: 'Riesgo creado (temporal)'
  };
});

// Audit endpoints
app.get('/audit', async () => ({ audits: [] }));
app.get('/audit/runs', async () => ({ runs: [] }));
app.get('/audit/findings', async () => ({ findings: [] }));
app.get('/audit/stats', async () => ({ 
  stats: {
    total: 0,
    active: 0,
    completed: 0,
    byType: {},
  }
}));
app.post('/audit', async () => ({ 
  id: 'temp-' + Date.now(),
  message: 'Auditoría creada (temporal)'
}));

// Panel endpoints  
app.get('/panel', async () => ({ panels: [] }));
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
    message: `Miembro ${id} actualizado: ${JSON.stringify(body)} (temporal)`
  };
});
app.delete('/settings/members/:id', async (request) => { 
  const { id } = request.params as any;
  return { 
    id,
    message: `Miembro ${id} eliminado (temporal)`
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
    message: `Prueba enviada para webhook ${id} (temporal)`
  };
});
app.patch('/integrations/webhooks/:id', async (request) => { 
  const { id } = request.params as any;
  const body = request.body as any;
  return { 
    id,
    message: `Webhook ${id} actualizado: ${JSON.stringify(body)} (temporal)`
  };
});
app.delete('/integrations/webhooks/:id', async (request) => { 
  const { id } = request.params as any;
  return { 
    id,
    message: `Webhook ${id} eliminado (temporal)`
  };
});
app.post('/integrations', async () => ({ 
  id: 'temp-' + Date.now(),
  message: 'Integración creada (temporal)'
}));

// Documents endpoints
app.get('/documents', async () => ({ documents }));
app.get('/documents/:id', async (request) => { 
  const { id } = request.params as any;
  const document = documents.find(doc => doc.id === id);
  
  if (!document) {
    return { error: 'Document not found' };
  }
  
  // Add additional fields for detail page
  const detailedDocument = {
    ...document,
    content: `Contenido extraído del documento: ${document.title}. Este es un contenido simulado para demostración. En una implementación real, aquí estaría el texto completo extraído del archivo PDF, DOCX o XLSX.`,
    filePath: document.fileUrl,
    originalFileName: document.originalName,
    fileSize: 1024 * 1024, // 1MB simulated
    standardTags: ['calidad', 'proceso', 'seguridad'],
    createdBy: { id: 'user-1', email: 'admin@sgi360.com' },
    updatedBy: { id: 'user-1', email: 'admin@sgi360.com' }
  };
  
  return { document: detailedDocument };
});
app.get('/documents/:id/download', async (request, reply) => { 
  const { id } = request.params as any;
  const document = documents.find(doc => doc.id === id);
  
  if (!document) {
    reply.code(404).send({ error: 'Document not found' });
    return;
  }
  
  // Set headers for file download
  reply.header('Content-Type', 'application/octet-stream');
  reply.header('Content-Disposition', `attachment; filename="${document.originalName}"`);
  
  // Return simulated file content
  return `Contenido del archivo: ${document.originalName}\n\nEste es el contenido simulado del documento "${document.title}".\nEn una implementación real, aquí estaría el contenido binario real del archivo PDF, DOCX o XLSX.\n\nFecha de creación: ${document.createdAt}\nTipo: ${document.type}\nEstado: ${document.status}`;
});
app.get('/documents/:id/clause-mappings', async () => ({ mappings: [] }));
app.post('/documents/upload', async (request, reply) => { 
  // Set content type to handle multipart/form-data
  reply.header('Content-Type', 'application/json');
  
  try {
    const data = await request.file();
    
    // Get the actual filename from the uploaded file
    const filename = data?.filename || 'documento-sin-nombre';
    const title = filename.replace(/\.(pdf|docx|xlsx|xls)$/i, '');
    
    // Create a new document with real filename
    const newDocument = {
      id: 'temp-' + Date.now(),
      title: title,
      originalName: filename,
      type: 'PROCEDURE',
      status: 'EFFECTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      fileUrl: `/uploads/documents/${filename}` // Simulated file URL
    };
    
    // Add to in-memory storage
    documents.push(newDocument);
    
    return { 
      document: newDocument,
      extractedChars: 1000,
      message: `Documento "${title}" subido y procesado correctamente`
    };
  } catch (error) {
    // Fallback if file parsing fails
    const newDocument = {
      id: 'temp-' + Date.now(),
      title: 'Documento subido (temporal)',
      originalName: 'unknown-file',
      type: 'PROCEDURE',
      status: 'EFFECTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      fileUrl: `/uploads/documents/temp-file'
    };
    
    documents.push(newDocument);
    
    return { 
      document: newDocument,
      extractedChars: 1000,
      message: 'Documento subido y procesado (temporal)'
    };
  }
});
app.get('/uploads/documents/:filename', async (request, reply) => { 
  const { filename } = request.params as any;
  
  // For demo purposes, return a simple text response
  // In a real app, this would serve the actual file
  reply.header('Content-Type', 'text/plain');
  return 'Contenido simulado del archivo: ' + filename + '\n\nEste es un archivo de demostracion.\nEn una implementacion real, aqui estaria el contenido del archivo PDF, DOCX o XLSX.';
});
app.post('/documents', async () => ({ 
  id: 'temp-' + Date.now(),
  message: 'Documento creado (temporal)'
}));

// Normativos endpoints
app.get('/normativos', async () => ({ normativos }));
app.post('/normativos/upload', async (request, reply) => { 
  // Set content type to handle multipart/form-data
  reply.header('Content-Type', 'application/json');
  
  // Create a new normative
  const newNormative = {
    id: 'temp-' + Date.now(),
    name: 'Normativo subido (temporal)',
    code: 'NORM-001',
    version: '1.0',
    description: 'Descripción temporal',
    status: 'PROCESSING',
    totalClauses: 0,
    processedClauses: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  // Add to in-memory storage
  normativos.push(newNormative);
  
  return { 
    normative: newNormative,
    message: 'Normativo subido y en procesamiento (temporal)'
  };
});
app.post('/normativos', async () => ({ 
  id: 'temp-' + Date.now(),
  message: 'Normativo creado (temporal)'
}));

const port = Number(process.env.PORT ?? 3001);

try {
  await app.listen({ port, host: '0.0.0.0' });
  console.log('🚀 API running on http://localhost:' + port);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
