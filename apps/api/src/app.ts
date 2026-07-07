import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import staticPlugin from '@fastify/static';
import path from 'path';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

import { prismaPlugin } from './plugins/prisma.js';
import { createLLMProvider } from './services/llm/factory.js';
import { authPlugin } from './plugins/auth.js';
import { csrfPlugin } from './plugins/csrf.js';
import { dbContextPlugin } from './plugins/dbContext.js';
import { featuresPlugin } from './plugins/features.js';
import { userPermissionsPlugin } from './plugins/user-permissions.js';

import { healthRoutes } from './routes/health.js';
import { readyRoutes } from './routes/ready.js';
import saasRoutes from './routes/saas.js';
import { authRoutes } from './routes/auth.js';
import { documentRoutes } from './routes/documents.js';
import { departmentRoutes } from './routes/departments.js';
import { normativoRoutes, clauseMappingRoutes } from './routes/normativos.js';
import { complianceEvidenceRoutes } from './routes/compliance-evidences.js';
import { auditRoutes } from './routes/audit.js';
import gestionCambiosRoutes from './routes/gestion-cambios.js';
import { registerAuditRoutes } from './routes/audits.js';
import { registerManagementReviewRoutes } from './routes/managementReview.js';
import { ncrRoutes } from './routes/ncr.js';
import { settingsRoutes } from './routes/settings.js';
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
import { objectivesRoutes } from './routes/objectives.js';
import { minutasRoutes } from './routes/minutas.js';
import { intelligenceRoutes } from './routes/intelligence.js';
import { commandCenterRoutes } from './routes/command-center.js';
import { registerCompanySettingsRoutes } from './routes/company-settings.js';
import { registerLandingSettingsRoutes } from './routes/landing-settings.js';
import project360Routes from './routes/project360.js';
import project360BaseRoutes from './routes/project360-base.js';
import project360AuthRoutes from './routes/project360-auth.js';
import project360WorkspaceRoutes from './routes/project360-workspace.js';
import project360ResourcesRoutes from './routes/project360-resources.js';
import project360MembersRoutes from './routes/project360-members.js';
import project360DepartmentsRoutes from './routes/project360-departments.js';
import project360ProjectsRoutes from './routes/project360-projects.js';
import project360TasksRoutes from './routes/project360-tasks.js';
import project360MilestonesRoutes from './routes/project360-milestones.js';
import project360DashboardRoutes from './routes/project360-dashboard.js';
import project360KanbanRoutes from './routes/project360-kanban.js';
import project360CommentsRoutes from './routes/project360-comments.js';
import project360AttachmentsRoutes from './routes/project360-attachments.js';
import project360GanttRoutes from './routes/project360-gantt.js';
import project360WorkloadRoutes from './routes/project360-workload.js';
import project360TimelogRoutes from './routes/project360-timelogs.js';
import project360ReportsRoutes from './routes/project360-reports.js';
import project360NotificationsRoutes from './routes/project360-notifications.js';
import project360SprintsRoutes from './routes/project360-sprints.js';
import project360RisksRoutes from './routes/project360-risks.js';
import project360HealthRoutes from './routes/project360-health.js';
import project360AutomationsRoutes from './routes/project360-automations.js';
import project360DocumentsRoutes from './routes/project360-documents.js';
import project360ClientPortalRoutes from './routes/project360-client-portal.js';
import project360AIRoutes from './routes/project360-ai.js';
import project360BillingRoutes from './routes/project360-billing.js';
import project360AuditRoutes from './routes/project360-audit.js';
import project360AdminRoutes from './routes/project360-admin.js';
import project360PortfoliosRoutes from './routes/project360-portfolios.js';
import project360DemandRoutes from './routes/project360-demand.js';
import project360DemandAnalyticsRoutes from './routes/project360-demand-analytics.js';
import project360ChangeRoutes from './routes/project360-change.js';
import project360ChangeAnalyticsRoutes from './routes/project360-change-analytics.js';
import project360KnowledgeRoutes from './routes/project360-knowledge.js';
import project360KnowledgeAnalyticsRoutes from './routes/project360-knowledge-analytics.js';
import project360ExecutiveRoutes from './routes/project360-executive.js';
import project360ExecutiveAnalyticsRoutes from './routes/project360-executive-analytics.js';
import project360ResourceForecastRoutes from './routes/project360-resource-forecast.js';
import project360ResourceForecastAnalyticsRoutes from './routes/project360-resource-forecast-analytics.js';
import project360TemplatesRoutes from './routes/project360-templates.js';
import project360TemplatesAnalyticsRoutes from './routes/project360-templates-analytics.js';
import project360ProgramsRoutes from './routes/project360-programs.js';
import project360ProgramsAnalyticsRoutes from './routes/project360-programs-analytics.js';
import project360ScorecardsRoutes from './routes/project360-scorecards.js';
import project360ScorecardsAnalyticsRoutes from './routes/project360-scorecards-analytics.js';
import project360AIProactiveRoutes from './routes/project360-ai-proactive.js';
import project360AIAnalyticsRoutes from './routes/project360-ai-analytics.js';
import { startScheduler } from './services/project360-scheduler.js';
import maintenanceRoutes from './routes/maintenance.js';
import { emergencyRoutes } from './routes/emergency.js';
import { registerCustomerRoutes } from './routes/customers.js';
import { registerSurveyRoutes } from './routes/surveys.js';
import { climaCulturaRoutes } from './routes/clima-cultura.js';
import { inspeccionesRoutes } from './routes/inspecciones.js';
import { climaCanalRoutes } from './routes/clima-canal.js';
import { climaRoutes } from './routes/clima.js';
import { licenseRoutes } from './routes/license.js';
import { storageRoutes } from './routes/storage.js';
import { superAdminRoutes } from './routes/superAdmin.js';
import { licenseBlockPlugin } from './plugins/licenseBlock.js';
import { LicenseMonitor } from './services/license/licenseMonitor.js';
import { billingRoutes } from './routes/billing.js';
import tenantReportRoutes from './routes/tenantReport.js';
import surveyPublicRoutes from './routes/survey-public.js';
import { publicRoutes } from './routes/publicRoutes.js';
import { documentsPublicRoutes } from './routes/documentsPublic.js';
import { processMapsRoutes } from './routes/processMaps.js';
import { processTemplatesRoutes } from './routes/processTemplates.js';
import { registerCompanyRoutes } from './routes/register-company.js';
import { registerSupplierRoutes } from './routes/suppliers.js';
import { registerHelpRoutes } from './routes/help.js';
import { demoRoutes } from './routes/demo.js';
import { startNormativeWorker, startAuditWorker, recoverStuckNormatives } from './jobs/queue.js';
import { startStorageReconcileJob } from './jobs/storageReconcileJob.js';
import {
  actionsRoutes, stakeholdersRoutes, stakeholderActionRoutes,
  incidentsRoutes,
  equipmentRoutes, contextRoutes, calendarRoutes,
} from './routes/sgi-professional.js';
import { evaluationCyclesRoutes, stakeholderEvaluationsRoutes } from './routes/stakeholderCycles.js';
import { calibrationsRoutes } from './routes/calibrations.js';
import { hazardsRoutes } from './routes/hazards.js';
import { aspectsRoutes } from './routes/aspects.js';
import flotaRoutes from './routes/flota.js';
import garantiasRoutes from './routes/garantias.js';
import digitalTwinRoutes from './routes/digital-twin.js';
import { seh360AuthPlugin } from "./plugins/seh360Auth.js";
import { registerSeh360AuthRoutes, registerSeh360PasswordResetRoutes } from "./routes/seh360-auth.js";
import { registerSeh360Routes } from "./routes/seh360.js";
import { registerSeh360LegalMatrixRoutes } from "./routes/seh360-legal-matrix.js";
import { registerSeh360LegalUpdatesRoutes } from "./routes/seh360-legal-updates.js";
import { registerSeh360LegalExportRoutes } from "./routes/seh360-legal-export.js";
import { registerSeh360AIRoutes } from "./routes/seh360-ai.js";
import { registerSehLegalLibraryRoutes } from "./routes/seh360-legal-library.js";
import { registerSehClientPortalRoutes } from "./routes/seh360-client-portal.js";
import { registerLegal360Routes } from "./routes/legal360.js";
import { audit360Routes } from "./routes/audit360.js";
import { audit360StandardsRoutes } from "./routes/audit360-standards.js";
import { audit360ProgramRoutes } from "./routes/audit360-program.js";
// import audit360DocsRoutes - incluido en audit360.ts
import { audit360BillingRoutes } from "./routes/audit360-billing.js";
import { audit360ReportsRoutes } from "./routes/audit360-reports.js";
import { audit360PortalRoutes } from "./routes/audit360-portal.js";
import { audit360DocumentsRoutes } from "./routes/audit360-documents.js";
import { audit360ExecutiveDashboardRoutes } from "./routes/audit360-executive-dashboard.js";
import { audit360AlertsWorkflowsRoutes } from "./routes/audit360-alerts-workflows.js";
import { audit360CopilotRoutes } from "./routes/audit360-copilot.js";
import { audit360SearchRoutes } from "./routes/audit360-search.js";
import { audit360SecurityRoutes, logAction as a360Log } from "./routes/audit360-security.js";
import { audit360AIRoutes } from "./routes/audit360-ai.js";
import { audit360SubscriptionRoutes } from "./routes/audit360-subscription.js";
import { registerAudit360AuthRoutes } from "./routes/audit360-auth.js";
import { registerAudit360ClientRoutes } from "./routes/audit360-clients.js";
import { registerAudit360ContractRoutes } from "./routes/audit360-contracts.js";
import { registerSiniestros360Routes } from "./routes/siniestros360.js";
import { audit360AuthPlugin } from "./plugins/audit360Auth.js";
import { flota360AuthPlugin } from "./plugins/flota360Auth.js";
import { registerFlota360AuthRoutes } from "./routes/flota360-auth.js";

export async function buildApp() {
  const app = Fastify({
    logger: true,
    bodyLimit: parseInt(process.env.MAX_PDF_SIZE_MB || '50', 10) * 1024 * 1024,
  });

  // Iniciar workers
  startNormativeWorker();
  startAuditWorker();
  // Recuperar normativos que quedaron atascados (p.ej. Redis read-only al subirlos)
  void recoverStuckNormatives();

  // ┌─ REGISTRAR PARSERS DE CONTENIDO PRIMERO (ANTES DE TODO) ─┐
  app.addContentTypeParser('application/json', (request, payload, done) => {
    let data = '';
    payload.on('data', chunk => { data += chunk.toString(); });
    payload.on('end', () => {
      try {
        const result = data.trim() ? JSON.parse(data) : {};
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
  startStorageReconcileJob((app as any).prisma);
  await app.register(authPlugin);
  await app.register(seh360AuthPlugin);
  await app.register(audit360AuthPlugin);
  await app.register(flota360AuthPlugin);
  await app.register(csrfPlugin);
  await app.register(licenseBlockPlugin);
  await app.register(dbContextPlugin);
  await app.register(featuresPlugin);
  await app.register(userPermissionsPlugin);

  // Iniciar monitor diario de licencias (cada 24h)
  const licenseMonitor = new LicenseMonitor((app as any).prisma);
  setInterval(() => {
    licenseMonitor.runDailyCheck().catch((err: any) => {
      app.log.error('[LICENSE_MONITOR] Error en check diario:', err);
    });
  }, 24 * 60 * 60 * 1000);
  // Ejecutar inmediatamente al arrancar
  licenseMonitor.runDailyCheck().catch((err: any) => {
    app.log.error('[LICENSE_MONITOR] Error en check inicial:', err);
  });

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
        if (target && (Array.isArray(target) ? target.join(',') : String(target)).includes('management_reviews')) {
          return reply.code(409).send({ error: 'Ya existe un informe con ese título. Por favor usá un título diferente.' });
        }
        return reply.code(409).send({ error: 'El registro ya existe. Verificá que no esté duplicado.' });
      }
      if (error.code === 'P2025') {
        return reply.code(404).send({ error: 'El registro no fue encontrado.' });
      }
    }

    // Si el error tiene statusCode explícito (ej: 401 Token expired desde auth plugin)
    if (error.statusCode && typeof error.statusCode === 'number' && error.statusCode < 500) {
      return reply.code(error.statusCode).send({ error: error.message || 'Error de autenticación' });
    }

    // Unexpected errors → 500 (log full error, return generic message)
    app.log.error(error);
    return reply.code(500).send({ error: 'Error interno del servidor. Por favor intentá nuevamente.' });
  });

  await app.register(healthRoutes);
  await app.register(readyRoutes);
  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(documentRoutes, { prefix: '/documents' });
  await app.register(clauseMappingRoutes, { prefix: '/documents' });
  await app.register(departmentRoutes, { prefix: '/departments' });
  await app.register(normativoRoutes, { prefix: '/normativos' });
  await app.register(complianceEvidenceRoutes, { prefix: '/normativos' });
  await app.register(auditRoutes, { prefix: '/audit' });
  await app.register(registerAuditRoutes);
  await app.register(registerManagementReviewRoutes);
  await app.register(ncrRoutes, { prefix: '/ncr' });
  await app.register(project360Routes, { prefix: '/project360-v1' });
  await app.register(project360BaseRoutes, { prefix: '/project360' });
  await app.register(project360AuthRoutes, { prefix: '/project360' });
  await app.register(project360WorkspaceRoutes, { prefix: '/project360' });
  await app.register(project360ResourcesRoutes, { prefix: '/project360' });
  await app.register(project360MembersRoutes, { prefix: '/project360' });
  await app.register(project360DepartmentsRoutes, { prefix: '/project360' });
  await app.register(project360ProjectsRoutes, { prefix: '/project360' });
  await app.register(project360TasksRoutes, { prefix: '/project360' });
  await app.register(project360MilestonesRoutes, { prefix: '/project360' });
  await app.register(project360DashboardRoutes, { prefix: '/project360' });
  await app.register(project360KanbanRoutes, { prefix: '/project360' });
  await app.register(project360CommentsRoutes, { prefix: '/project360' });
  await app.register(project360AttachmentsRoutes, { prefix: '/project360' });
  await app.register(project360GanttRoutes, { prefix: '/project360' });
  await app.register(project360WorkloadRoutes, { prefix: '/project360' });
  await app.register(project360TimelogRoutes, { prefix: '/project360' });
  await app.register(project360ReportsRoutes, { prefix: '/project360' });
  await app.register(project360NotificationsRoutes, { prefix: '/project360' });
  await app.register(project360SprintsRoutes, { prefix: '/project360' });
  await app.register(project360RisksRoutes, { prefix: '/project360' });
  await app.register(project360HealthRoutes, { prefix: '/project360' });
  await app.register(project360AutomationsRoutes, { prefix: '/project360' });
  await app.register(project360DocumentsRoutes, { prefix: '/project360' });
  await app.register(project360ClientPortalRoutes, { prefix: '/project360' });
  await app.register(project360AIRoutes, { prefix: '/project360' });
  await app.register(project360BillingRoutes, { prefix: '/project360' });
  await app.register(project360PortfoliosRoutes, { prefix: '/project360' });
  await app.register(project360DemandRoutes,            { prefix: '/project360' });
  await app.register(project360DemandAnalyticsRoutes,   { prefix: '/project360' });
  await app.register(project360ChangeRoutes,            { prefix: '/project360' });
  await app.register(project360ChangeAnalyticsRoutes,   { prefix: '/project360' });
  await app.register(project360KnowledgeRoutes,         { prefix: '/project360' });
  await app.register(project360KnowledgeAnalyticsRoutes, { prefix: '/project360' });
  await app.register(project360ExecutiveRoutes,           { prefix: '/project360' });
  await app.register(project360ExecutiveAnalyticsRoutes,  { prefix: '/project360' });
  await app.register(project360ResourceForecastRoutes,            { prefix: '/project360' });
  await app.register(project360ResourceForecastAnalyticsRoutes,   { prefix: '/project360' });
  await app.register(project360TemplatesRoutes,          { prefix: '/project360' });
  await app.register(project360TemplatesAnalyticsRoutes, { prefix: '/project360' });
  await app.register(project360ProgramsRoutes,          { prefix: '/project360' });
  await app.register(project360ProgramsAnalyticsRoutes,   { prefix: '/project360' });
  await app.register(project360ScorecardsRoutes,          { prefix: '/project360' });
  await app.register(project360ScorecardsAnalyticsRoutes, { prefix: '/project360' });
  await app.register(project360AIProactiveRoutes,         { prefix: '/project360' });
  await app.register(project360AIAnalyticsRoutes,         { prefix: '/project360' });
  await app.register(project360AuditRoutes,       { prefix: '/project360' });
  await app.register(project360AdminRoutes,       { prefix: '/project360' });
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
  await app.register(commandCenterRoutes, { prefix: '/command-center' });
  await app.register(registerCompanySettingsRoutes);
  await app.register(registerLandingSettingsRoutes);
  await app.register(emergencyRoutes, { prefix: '/emergency' });
  await app.register(registerCustomerRoutes, { prefix: '/customers' });
  await app.register(registerSurveyRoutes, { prefix: '/surveys' });
  await app.register(licenseRoutes, { prefix: '/license' });
  await app.register(billingRoutes, { prefix: '/billing' });
  await app.register(storageRoutes, { prefix: '/storage' });
  await app.register(processMapsRoutes, { prefix: '/process-maps' });
  await app.register(processTemplatesRoutes, { prefix: '/process-templates' });
  await app.register(superAdminRoutes, { prefix: '/super-admin' });
  await app.register(tenantReportRoutes);
  await app.register(surveyPublicRoutes, { prefix: '/survey' });
  await app.register(climaCulturaRoutes, { prefix: '/clima' });
  await app.register(climaCanalRoutes, { prefix: '/clima' });
  await app.register(inspeccionesRoutes, { prefix: '/inspecciones' });
  await app.register(flotaRoutes, { prefix: '/flota' });
await app.register(garantiasRoutes, { prefix: '/garantias' });
await app.register(digitalTwinRoutes, { prefix: '/digital-twin' });
  await app.register(registerCompanyRoutes); // Registro de empresas
  await app.register(saasRoutes);

  // SGI Profesional (Abr 2026)
  await app.register(actionsRoutes, { prefix: '/actions' });
  await app.register(objectivesRoutes, { prefix: '/objectives' });
  await app.register(minutasRoutes, { prefix: '/minutas' });
  await app.register(stakeholdersRoutes, { prefix: '/stakeholders' });
  await app.register(stakeholderActionRoutes, { prefix: '/stakeholders' });
  await app.register(evaluationCyclesRoutes, { prefix: '/evaluation-cycles' });
  await app.register(stakeholderEvaluationsRoutes, { prefix: '/stakeholder-evaluations' });
  await app.register(contextRoutes, { prefix: '/context' });
  await app.register(hazardsRoutes, { prefix: '/hazards' });
  await app.register(aspectsRoutes, { prefix: '/aspects' });
  await app.register(incidentsRoutes, { prefix: '/incidents' });
  await app.register(registerSupplierRoutes, { prefix: '/suppliers' });
  await app.register(equipmentRoutes, { prefix: '/equipment' });
  await app.register(calibrationsRoutes, { prefix: '/calibrations' });
  await app.register(calendarRoutes, { prefix: '/calendar' });
  await app.register(gestionCambiosRoutes, { prefix: '/gestion-cambios' });
  await app.register(registerHelpRoutes, { prefix: '/help' });
  await app.register(demoRoutes);
  // SEH360 independent routes
  await registerSeh360AuthRoutes(app);
  await registerSeh360PasswordResetRoutes(app);
  await registerSeh360Routes(app);
  await registerSeh360LegalMatrixRoutes(app);
  await registerSeh360LegalUpdatesRoutes(app);
  await registerSeh360LegalExportRoutes(app);
  await registerSeh360AIRoutes(app);
  await registerSehLegalLibraryRoutes(app);
  await registerSehClientPortalRoutes(app);
  await registerLegal360Routes(app);
  await app.register(audit360Routes, { prefix: "/audit360" });
  await app.register(audit360StandardsRoutes, { prefix: "/audit360" });
  await app.register(audit360ProgramRoutes, { prefix: "/audit360" });
  // audit360DocsRoutes desactivado - ya incluido en audit360.ts
  await app.register(audit360BillingRoutes, { prefix: "/audit360" });
  await app.register(audit360ReportsRoutes, { prefix: "/audit360" });
  await app.register(audit360PortalRoutes, { prefix: "/audit360" });
  await app.register(audit360DocumentsRoutes, { prefix: "/audit360" });
  await app.register(audit360ExecutiveDashboardRoutes, { prefix: "/audit360" });
  await app.register(audit360AlertsWorkflowsRoutes, { prefix: "/audit360" });
  await app.register(audit360CopilotRoutes, { prefix: "/audit360" });
  await app.register(audit360SearchRoutes, { prefix: "/audit360" });
  await app.register(audit360SecurityRoutes, { prefix: "/audit360" });
  await app.register(audit360AIRoutes, { prefix: "/audit360" });
  await app.register(audit360SubscriptionRoutes);
  await registerAudit360AuthRoutes(app);
  await registerFlota360AuthRoutes(app);
  await app.register(registerAudit360ClientRoutes);
  await app.register(registerAudit360ContractRoutes);
  await app.register(registerSiniestros360Routes);

  // Endpoint genérico de IA para módulos del frontend - respuestas rápidas
  app.post('/ai/chat', async (req: any, reply: any) => {
    try {
      const rawBody = req.body;
      const body = typeof rawBody === 'string' ? JSON.parse(rawBody) : (rawBody ?? {});
      const message: string = body?.message || body?.prompt || '';
      if (!message) return reply.code(400).send({ error: 'message requerido' });
      const llm = createLLMProvider(req.tenant);
      // Usar solo 512 tokens para respuestas rápidas (evitar timeout 504)
      const result = await llm.chat([{ role: 'user', content: message }], 512);
      return reply.send({ response: result.text });
    } catch (err: any) {
      if (err?.code === 'LLM_NOT_CONFIGURED' || err?.statusCode === 503) {
        return reply.code(503).send({ 
          error: 'IA no configurada',
          response: 'El asistente de IA no está disponible. Contacte al administrador.' 
        });
      }
      app.log.error('IA chat error:', err);
      return reply.code(500).send({ error: 'Error al procesar la consulta. Intentá nuevamente.' });
    }
  });

  // Servir archivos estáticos de uploads (AL FINAL para no interferir con API routes)
  const uploadsPath = path.resolve(process.env.STORAGE_LOCAL_PATH || '/app/uploads');
  console.log('[STATIC] Serving uploads from:', uploadsPath);
  await app.register(staticPlugin, {
    root: uploadsPath,
    prefix: '/uploads/',
    wildcard: true,
  });


  // Auto-audit log for mutations
  app.addHook('onResponse', async (req: any, reply: any) => {
    try {
      if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) return;
      if (reply.statusCode >= 400) return;
      const t = req.audit360Auth?.tenantId || req.tenantId || req.user?.tenantId;
      if (!t) return;
      const route = (req as any).routeOptions?.url || (req as any).routerPath || req.url || '';
      if (!route.startsWith('/audit360')) return;
      // skip security log endpoint itself to avoid recursion
      if (route.includes('/security/log') || route.includes('/security/audit-log')) return;
      let entityType: string | null = null;
      if (route.includes('/clients')) entityType = 'client';
      else if (route.includes('/audits')) entityType = 'audit';
      else if (route.includes('/findings')) entityType = 'finding';
      else if (route.includes('/capas')) entityType = 'capa';
      else if (route.includes('/reports')) entityType = 'report';
      else if (route.includes('/documents')) entityType = 'document';
      else if (route.includes('/proposals')) entityType = 'proposal';
      else if (route.includes('/standards')) entityType = 'standard';
      else if (route.includes('/team')) entityType = 'team_member';
      if (!entityType) return;
      const action = req.method === 'POST' ? 'CREATE' : req.method === 'DELETE' ? 'DELETE' : 'UPDATE';
      await a360Log((app as any).prisma, {
        tenantId: t,
        userId: req.audit360Auth?.userId || req.user?.id || null,
        userName: req.audit360Auth?.name || req.audit360Auth?.email || req.user?.email || null,
        action,
        entityType,
        entityId: (req.params as any)?.id || null,
        ip: req.ip,
        userAgent: (req.headers['user-agent'] as string)?.slice(0, 200),
      });
    } catch { /* never break */ }
  });

  // Start PROJECT360 background scheduler
  startScheduler({ prisma: (app as any).prisma });

  return app;
}
