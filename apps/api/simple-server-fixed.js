#!/usr/bin/env node

/**
 * Simple API Server for SGI 360
 * Provides basic endpoints for development when the main API is not running
 */

import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Mock data
const users = [
  {
    id: 'user-1',
    email: 'admin@sgi360.com',
    globalRole: 'SUPER_ADMIN',
    firstName: 'Admin',
    lastName: 'User'
  }
];

const tenants = [
  {
    id: 'tenant-1',
    name: 'SGI 360 Demo',
    slug: 'demo'
  }
];

// Auth endpoints
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  console.log('🔵 Login attempt:', email);
  
  if (email === 'admin@sgi360.com' && password === 'Admin123!') {
    const user = users[0];
    const accessToken = 'mock-jwt-token-' + Date.now();
    const csrfToken = 'mock-csrf-' + Date.now();
    
    console.log('✅ Login successful for:', email);
    
    res.json({
      user,
      accessToken,
      refreshToken: 'mock-refresh-token',
      csrfToken,
      activeTenant: tenants[0],
      tenantRole: 'ADMIN',
      requires2FA: false
    });
  } else {
    console.log('❌ Login failed for:', email);
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

app.get('/api/auth/me', (req, res) => {
  const authHeader = req.headers.authorization;
  const csrfToken = req.headers['x-csrf-token'];
  
  if (!authHeader || !csrfToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  res.json({
    user: users[0],
    activeTenant: tenants[0],
    tenantRole: 'ADMIN'
  });
});

app.post('/api/auth/logout', (req, res) => {
  res.json({ success: true });
});

// HR endpoints
app.get('/hr/employees', (req, res) => {
  res.json({
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
  });
});

app.get('/hr/positions', (req, res) => {
  res.json({
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
  });
});

app.get('/hr/competencies', (req, res) => {
  res.json({
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
  });
});

app.get('/hr/org-chart', (req, res) => {
  res.json({
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
  });
});

app.get('/hr/stats', (req, res) => {
  res.json({
    stats: {
      totalEmployees: 2,
      activeEmployees: 2,
      totalPositions: 2,
      departments: 2,
      avgCompetencyLevel: 3.2,
      trainingNeeds: 3
    }
  });
});

// Dashboard endpoint
app.get('/api/dashboard', (req, res) => {
  res.json({
    stats: {
      totalEmployees: 2,
      activeEmployees: 2,
      totalDocuments: 5,
      pendingTasks: 3,
      trainingNeeds: 3
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Simple API Server running on port ${PORT}`);
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
