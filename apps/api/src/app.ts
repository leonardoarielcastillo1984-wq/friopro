import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import staticPlugin from '@fastify/static';
import path from 'path';
import { fileURLToPath } from 'url';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

import { prismaPlugin } from './plugins/prisma.js';
import { authPlugin } from './plugins/auth.js';
import { csrfPlugin } from './plugins/csrf.js';
import { dbContextPlugin } from './plugins/dbContext.js';
import { featuresPlugin } from './plugins/features.js';

import { healthRoutes } from './routes/health.js';
import saasRoutes from './routes/saas.js';
import { authRoutes } from './routes/auth.js';
import { documentRoutes } from './routes/documents.js';
import { departmentRoutes } from './routes/departments.js';
import { normativoRoutes, clauseMappingRoutes } from './routes/normativos.js';
import { auditRoutes } from './routes/audit.js';
import { registerAuditRoutes } from './routes/audits.js';
import { registerManagementReviewRoutes } from './routes/managementReview.js';
import { ncrRoutes } from './routes/ncr.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { indicadoresRoutes } from './routes/indicators.js';
import { capacitacionesRoutes } from './routes/trainings.js';
import { notificacionesRoutes } from './routes/notifications.js';
import hrRoutes from './routes/hr.js';
import { adminRoutes } from './routes/admin.js';
import { reportRoutes } from './routes/reports.js';
import { riskRoutes } from './routes/risks.js';
import { exportRoutes } from './routes/export.js';
import { integrationRoutes } from './routes/integrations.js';
import { settingsRoutes } from './routes/settings.js';
import { intelligenceRoutes } from './routes/intelligence.js';
import { registerCompanySettingsRoutes } from './routes/company-settings.js';
import { registerLandingSettingsRoutes } from './routes/landing-settings.js';
import project360Routes from './routes/project360.js';
import maintenanceRoutes from './routes/maintenance.js';
import { emergencyRoutes } from './routes/emergency.js';
import { registerCustomerRoutes } from './routes/customers.js';
import { registerSurveyRoutes } from './routes/surveys.js';
import { licenseRoutes } from './routes/license.js';
import { superAdminRoutes } from './routes/superAdmin.js';
import surveyPublicRoutes from './routes/survey-public.js';
import { publicRoutes } from './routes/publicRoutes.js';
import { documentsPublicRoutes } from './routes/documentsPublic.js';
import { registerCompanyRoutes } from './routes/register-company.js';
import { startNormativeWorker, startAuditWorker } from './jobs/queue.js';

export async function buildApp() {
  const app = Fastify({ logger: true });

  // Iniciar workers
  startNormativeWorker();
  startAuditWorker();

  // ┌─ REGISTRAR PARSERS DE CONTENIDO PRIMERO (ANTES DE TODO) ─┐
  app.addContentTypeParser('application/json', (request, payload, done) => {
    let data = '';
    payload.on('data', chunk => { data += chunk.toString(); });
    payload.on('end', () => {
      try {
        const result = JSON.parse(data);
        done(null, result);
      } catch (e) {
        done(e as Error);
      }
    });
    payload.on('error', done);
  });

  app.addContentTypeParser('application/x-www-form-urlencoded', (request, payload, done) => {
    let data = '';
    payload.on('data', chunk => { data += chunk.toString(); });
    payload.on('end', () => {
      try {
        const params = new URLSearchParams(data);
        const result: any = {};
        for (const [key, value] of params.entries()) {
          result[key] = value;
        }
        done(null, result);
      } catch (e) {
        done(e as Error);
      }
    });
    payload.on('error', done);
  });

  const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000,http://127.0.0.1:3000,http://46.62.253.81:4000,http://46.62.253.81:4001';
  await app.register(cors, {
    origin: corsOrigin.split(',').map((o) => o.trim()),
    credentials: true,
  });

  await app.register(cookie);

  await app.register(helmet, {
    contentSecurityPolicy: false,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    xssFilter: true,
    noSniff: true,
  });

  await app.register(rateLimit, {
    max: 200,
    timeWindow: '1 minute',
  });

  await app.register(prismaPlugin);
  await app.register(authPlugin);
  await app.register(csrfPlugin);
  await app.register(dbContextPlugin);
  await app.register(featuresPlugin);

  // Registrar rutas públicas PRIMERO
  await app.register(publicRoutes);
  await app.register(documentsPublicRoutes);

  await app.register(multipart, {
    limits: {
      fileSize: parseInt(process.env.MAX_PDF_SIZE_MB || '50', 10) * 1024 * 1024,
    },
  });

  // Global error handler
  app.setErrorHandler((error: any, request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: 'Validation failed',
        details: error.errors,
      });
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        // Check if this is a normative standard unique constraint violation
        const target = (error.meta as any)?.target;
        if (target && target.includes('NormativeStandard') && target.includes('tenantId') && target.includes('code')) {
          return reply.code(409).send({ error: 'Ya existe una norma con ese código en este tenant. Si eliminaste la norma anteriormente, debe ser restaurada o eliminada permanentemente.' });
        }
        return reply.code(409).send({ error: 'Resource already exists' });
      }
      if (error.code === 'P2025') {
        return reply.code(404).send({ error: 'Resource not found' });
      }
    }

    // Unexpected errors → 500 (log full error, return generic message)
    app.log.error(error);
    return reply.code(500).send({ error: 'Internal server error' });
  });

  await app.register(healthRoutes);
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(documentRoutes, { prefix: '/documents' });
  await app.register(clauseMappingRoutes, { prefix: '/documents' });
  await app.register(departmentRoutes, { prefix: '/departments' });
  await app.register(normativoRoutes, { prefix: '/normativos' });
  await app.register(auditRoutes, { prefix: '/audit' });
  await app.register(registerAuditRoutes);
  await app.register(registerManagementReviewRoutes);
  await app.register(ncrRoutes, { prefix: '/ncr' });
  await app.register(project360Routes, { prefix: '/project360' });
  await app.register(maintenanceRoutes, { prefix: '/maintenance' });
  await app.register(dashboardRoutes, { prefix: '/dashboard' });
  await app.register(indicadoresRoutes, { prefix: '/indicators' });
  await app.register(capacitacionesRoutes, { prefix: '/trainings' });
  await app.register(notificacionesRoutes, { prefix: '/notifications' });
  await app.register(hrRoutes, { prefix: '/hr' });
  await app.register(adminRoutes, { prefix: '/admin' });
  await app.register(reportRoutes, { prefix: '/reports' });
  await app.register(riskRoutes, { prefix: '/risks' });
  await app.register(exportRoutes, { prefix: '/export' });
  await app.register(integrationRoutes, { prefix: '/integrations' });
  await app.register(settingsRoutes, { prefix: '/settings' });
  await app.register(intelligenceRoutes, { prefix: '/intelligence' });
  await app.register(registerCompanySettingsRoutes);
  await app.register(registerLandingSettingsRoutes);
  await app.register(emergencyRoutes, { prefix: '/emergency' });
  await app.register(registerCustomerRoutes, { prefix: '/customers' });
  await app.register(registerSurveyRoutes, { prefix: '/surveys' });
  await app.register(licenseRoutes, { prefix: '/license' });
  await app.register(superAdminRoutes, { prefix: '/super-admin' });
  await app.register(surveyPublicRoutes, { prefix: '/survey' });
  await app.register(registerCompanyRoutes); // Registro de empresas
  await app.register(saasRoutes);

  // Servir archivos estáticos de uploads (AL FINAL para no interferir con API routes)
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const uploadsPath = path.resolve(__dirname, '..', 'uploads');
  console.log('[STATIC] Serving uploads from:', uploadsPath);
  await app.register(staticPlugin, {
    root: uploadsPath,
    prefix: '/uploads/',
    wildcard: false,
  });

  return app;
}
