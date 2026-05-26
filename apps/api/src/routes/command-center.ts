/**
 * COMMAND CENTER ROUTES
 * SGI360 Executive Intelligence API - Full Implementation
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createAIOrchestrator, AIResponse } from '../services/ai-orchestrator.js';
import { AIMemoryEngine } from '../services/ai-memory-engine.js';
import { AIActionEngine } from '../services/ai-action-engine.js';
import { AISemanticSearchEngine } from '../services/ai-semantic-search.js';
import { AIProactiveAlertsEngine } from '../services/ai-proactive-alerts.js';
import { AIMercadoPagoService } from '../services/ai-mercadopago.js';
import { AILoggingEngine } from '../services/ai-logging-engine.js';
import { AIStrategicSimulationEngine } from '../services/ai-strategic-simulation.js';
import { AIReportGenerator } from '../services/ai-report-generator.js';
import { EnterpriseIntentEngine, Intent, ContextualDashboard } from '../services/enterprise-intent-engine.js';
import { createLLMProvider } from '../services/llm/factory.js';
import { AIThinkingVisualizer, ThinkingStep, AIThinkingSession } from '../services/ai-thinking-visualizer.js';
import { OperationalModesManager, OperationalMode } from '../services/operational-modes.js';
import { CommandActionsManager, CommandAction, ActionExecution } from '../services/command-actions.js';
import { AIFloatingAlertsManager, FloatingAlert, AlertRule } from '../services/ai-floating-alerts.js';
import { AIInsightsEngine } from '../services/ai-insights-engine.js';
import { AITimelineEngine } from '../services/ai-timeline-engine.js';
import { AgentRouter, AGENTS } from '../services/ai-agents/index.js';
import { EnterpriseEventEngine, eventEngine } from '../services/ai-event-engine.js';
import { CorrelationEngine } from '../services/ai-correlation-engine.js';
import { AnomalyDetector } from '../services/ai-anomaly-detector.js';
import { ExecutiveReportGenerator } from '../services/ai-executive-reports.js';
import { getEffectiveTenantId } from '../utils/tenant-bypass.js';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';

// Extender FastifyInstance
declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

export async function commandCenterRoutes(app: FastifyInstance) {
  const orchestrator = createAIOrchestrator(app.prisma, app);
  const memoryEngine = new AIMemoryEngine(app.prisma);
  const actionEngine = new AIActionEngine(app.prisma, app);
  const semanticSearch = new AISemanticSearchEngine(app.prisma);
  const proactiveAlerts = new AIProactiveAlertsEngine(app.prisma, orchestrator);
  const mercadopago = new AIMercadoPagoService(app.prisma);
  const loggingEngine = new AILoggingEngine(app.prisma);
  const simulationEngine = new AIStrategicSimulationEngine(app.prisma, orchestrator);
  const reportGenerator = new AIReportGenerator(app.prisma, orchestrator);
  
  // Phase 5: Multi-Agent + Correlation + Anomaly + Reports
  const agentRouter = new AgentRouter(app.prisma);
  const correlationEngine = new CorrelationEngine(app.prisma);
  const anomalyDetector = new AnomalyDetector(app.prisma);
  const executiveReports = new ExecutiveReportGenerator(app.prisma);

  // Enterprise AI Control Tower Services
  const intentEngine = new EnterpriseIntentEngine(createLLMProvider());
  const thinkingVisualizer = new AIThinkingVisualizer();
  const operationalModes = new OperationalModesManager();
  const commandActions = new CommandActionsManager();
  const floatingAlerts = new AIFloatingAlertsManager();
  const insightsEngine = new AIInsightsEngine(app.prisma);
  const timelineEngine = new AITimelineEngine(app.prisma);

  // ============================================================
  // HEALTH CHECK - Enhanced
  // ============================================================
  app.get('/health', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    
    const health = {
      status: 'ok',
      service: 'command-center',
      timestamp: new Date().toISOString(),
      features: {
        orchestrator: !!orchestrator,
        memory: !!memoryEngine,
        actions: !!actionEngine,
        streaming: true,
        voice: !!process.env.OPENAI_API_KEY,
        groq: !!process.env.GROQ_API_KEY,
        openai: !!process.env.OPENAI_API_KEY
      }
    };

    if (tenantId) {
      try {
        const subscription = await orchestrator.getAISubscription(tenantId);
        (health as any)['subscription'] = subscription;
      } catch (error) {
        (health as any)['subscription'] = { error: 'Not available' };
      }
    }

    return reply.send(health);
  });

  // ============================================================
  // CONVERSATION MANAGEMENT
  // ============================================================

  app.get('/conversations', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) {
        return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      }

      const userId = (req as any).db?.userId || 'anonymous';
      const { limit = 20, offset = 0 } = req.query as any;

      const conversations = await (app.prisma as any).aIConversation.findMany({
        where: {
          tenantId,
          userId
        },
        include: {
          messages: {
            take: 1,
            orderBy: { createdAt: 'desc' }
          },
          _count: {
            select: { messages: true }
          }
        },
        orderBy: { updatedAt: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset)
      });

      return reply.send({ success: true, data: conversations });
    } catch (error: any) {
      console.error('[Command Center] Conversations error:', error);
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  app.post('/conversations', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) {
        return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      }

      const userId = (req as any).db?.userId || 'anonymous';
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body as any;
      const { title } = body;

      const conversation = await (app.prisma as any).aIConversation.create({
        data: {
          tenantId,
          userId,
          title: title || 'Nueva conversación',
          status: 'ACTIVE'
        }
      });

      return reply.send({ success: true, data: conversation });
    } catch (error: any) {
      console.error('[Command Center] Create conversation error:', error);
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  // ============================================================
  // AI ACTIONS
  // ============================================================

  app.post('/actions', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) {
        return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      }

      const userId = (req as any).db?.userId || 'anonymous';
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body as any;

      const result = await actionEngine.executeAction({
        ...body,
        tenantId,
        userId
      });

      return reply.send({ success: true, data: result });
    } catch (error: any) {
      console.error('[Command Center] Action error:', error);
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  app.get('/actions', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) {
        return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      }

      const { limit = 20 } = req.query as any;
      const actions = await actionEngine.getActionHistory(tenantId, parseInt(limit));

      return reply.send({ success: true, data: actions });
    } catch (error: any) {
      console.error('[Command Center] Actions history error:', error);
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  app.get('/actions/stats', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) {
        return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      }

      const stats = await actionEngine.getActionStats(tenantId);
      return reply.send({ success: true, data: stats });
    } catch (error: any) {
      console.error('[Command Center] Actions stats error:', error);
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  // ============================================================
  // AI SUBSCRIPTION
  // ============================================================

  app.get('/subscription', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) {
        return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      }

      const subscription = await orchestrator.getAISubscription(tenantId);
      return reply.send({ success: true, data: subscription });
    } catch (error: any) {
      console.error('[Command Center] Subscription error:', error);
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  app.post('/subscription', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) {
        return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      }

      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body as any;
      const { plan, mercadopagoPreferenceId } = body;

      const subscription = await (app.prisma as any).tenantAISubscription.upsert({
        where: { tenantId },
        update: {
          ...(plan && { plan }),
          ...(mercadopagoPreferenceId && { mercadopagoPreferenceId }),
          status: 'ACTIVE',
          updatedAt: new Date()
        },
        create: {
          tenantId,
          plan: plan || 'STARTER_AI',
          status: 'ACTIVE',
          premiumQueriesLimit: plan === 'STARTER_AI' ? 30 : plan === 'BUSINESS_AI' ? 150 : -1,
          mercadopagoPreferenceId
        }
      });

      return reply.send({ success: true, data: subscription });
    } catch (error: any) {
      console.error('[Command Center] Update subscription error:', error);
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  // ============================================================
  // VOICE COMMANDS
  // ============================================================

  app.post('/voice', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) {
        return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      }

      const userId = (req as any).db?.userId || 'anonymous';
      const userRole = (req as any).db?.role || 'user';
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body as any;
      const { audio, format = 'webm' } = body;

      if (!audio) {
        return reply.code(400).send({ error: 'Audio data is required' });
      }

      const audioBuffer = Buffer.from(audio, 'base64');
      const result = await orchestrator.processVoiceCommand(audioBuffer, tenantId, userId, userRole);

      return reply.send({ success: true, data: result });
    } catch (error: any) {
      console.error('[Command Center] Voice error:', error);
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  // ============================================================
  // WIDGETS & DASHBOARD
  // ============================================================

  app.get('/widgets', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) {
        return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      }

      const { conversationId } = req.query as any;
      let widgets;

      if (conversationId) {
        widgets = await (app.prisma as any).aIWidget.findMany({
          where: {
            conversationId,
            isActive: true
          },
          orderBy: { position: 'asc' }
        });
      } else {
        widgets = await orchestrator.getExecutiveKPIs(tenantId);
      }

      return reply.send({ success: true, data: widgets });
    } catch (error: any) {
      console.error('[Command Center] Widgets error:', error);
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  app.get('/kpis', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) {
        return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      }

      const kpis = await orchestrator.getExecutiveKPIs(tenantId);
      return reply.send({ success: true, data: kpis });
    } catch (error: any) {
      console.error('[Command Center] KPIs error:', error);
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  app.get('/alerts', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) {
        return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      }

      // Temporalmente devolver alertas de ejemplo para evitar errores
      const mockAlerts = [
        {
          id: 'alert-1',
          tenantId,
          type: 'system',
          title: 'Sistema Operativo',
          description: 'Command Center funcionando correctamente',
          severity: 'low',
          category: 'performance',
          dismissed: false,
          createdAt: new Date().toISOString(),
          metadata: {}
        }
      ];

      try {
        const alerts = await proactiveAlerts.generateProactiveAlerts(tenantId);
        return reply.send({ success: true, data: alerts });
      } catch (proactiveError) {
        console.error('[Command Center] Proactive alerts error, using mock:', proactiveError);
        return reply.send({ success: true, data: mockAlerts });
      }
    } catch (error: any) {
      console.error('[Command Center] Alerts error:', error);
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  // ============================================================
  // SEMANTIC SEARCH
  // ============================================================

  app.post('/search', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) {
        return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      }

      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body as any;
      const { query, filters, limit = 10, threshold = 0.7 } = body;

      if (!query) {
        return reply.code(400).send({ error: 'Query es requerido' });
      }

      const results = await semanticSearch.semanticSearch({
        query,
        tenantId,
        filters,
        limit,
        threshold
      });

      return reply.send({ success: true, data: results });
    } catch (error: any) {
      console.error('[Command Center] Search error:', error);
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  app.post('/search/index', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) {
        return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      }

      await semanticSearch.indexExistingContent(tenantId);
      
      return reply.send({ 
        success: true, 
        message: 'Indexación de contenido iniciada' 
      });
    } catch (error: any) {
      console.error('[Command Center] Index error:', error);
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  app.get('/search/stats', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) {
        return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      }

      const stats = await semanticSearch.getIndexStats(tenantId);
      return reply.send({ success: true, data: stats });
    } catch (error: any) {
      console.error('[Command Center] Search stats error:', error);
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  // ============================================================
  // PROACTIVE ALERTS
  // ============================================================

  app.get('/alerts/active', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) {
        return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      }

      const { severity } = req.query as any;
      const alerts = await proactiveAlerts.getActiveAlerts(tenantId, severity);
      
      return reply.send({ success: true, data: alerts });
    } catch (error: any) {
      console.error('[Command Center] Active alerts error:', error);
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  app.post('/alerts/:alertId/acknowledge', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) {
        return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      }

      const userId = (req as any).db?.userId || 'anonymous';
      const { alertId } = req.params as any;

      const success = await proactiveAlerts.acknowledgeAlert(alertId, userId);
      
      return reply.send({ success, acknowledged: success });
    } catch (error: any) {
      console.error('[Command Center] Acknowledge alert error:', error);
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  app.get('/alerts/stats', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) {
        return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      }

      const stats = await proactiveAlerts.getAlertStats(tenantId);
      return reply.send({ success: true, data: stats });
    } catch (error: any) {
      console.error('[Command Center] Alert stats error:', error);
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  // ============================================================
  // MERCADOPAGO PAYMENTS
  // ============================================================

  app.get('/pricing/plans', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const plans = mercadopago.getAvailablePlans();
      return reply.send({ success: true, data: plans });
    } catch (error: any) {
      console.error('[Command Center] Pricing plans error:', error);
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  app.post('/payment/create', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) {
        return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      }

      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body as any;
      const { planId, userEmail, userName } = body;

      if (!planId || !userEmail || !userName) {
        return reply.code(400).send({ 
          error: 'planId, userEmail y userName son requeridos' 
        });
      }

      const preference = await mercadopago.createPaymentPreference(
        tenantId,
        planId,
        userEmail,
        userName
      );

      return reply.send({ success: true, data: preference });
    } catch (error: any) {
      console.error('[Command Center] Create payment error:', error);
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  app.post('/payment/webhook', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const signature = req.headers['x-signature'] as string;
      const body = JSON.stringify(req.body);

      // Verificar firma
      if (!mercadopago.verifyWebhookSignature(body, signature)) {
        return reply.code(401).send({ error: 'Firma inválida' });
      }

      await mercadopago.processWebhook(req.body);
      
      return reply.send({ success: true });
    } catch (error: any) {
      console.error('[Command Center] Webhook error:', error);
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  app.get('/billing/metrics', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) {
        return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      }

      const metrics = await mercadopago.getBillingMetrics(tenantId);
      return reply.send({ success: true, data: metrics });
    } catch (error: any) {
      console.error('[Command Center] Billing metrics error:', error);
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  // ============================================================
  // AI LOGGING & AUDIT
  // ============================================================

  app.get('/logging/stats', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) {
        return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      }

      const { from, to } = req.query as any;
      const dateRange = from && to ? {
        from: new Date(from),
        to: new Date(to)
      } : undefined;

      const stats = await loggingEngine.getUsageStats(tenantId, dateRange);
      return reply.send({ success: true, data: stats });
    } catch (error: any) {
      console.error('[Command Center] Logging stats error:', error);
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  app.get('/logging/report', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) {
        return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      }

      const { format = 'json' } = req.query as any;
      const report = await loggingEngine.generateUsageReport(tenantId, format);
      
      if (format === 'csv') {
        reply.type('text/csv');
        reply.header('Content-Disposition', 'attachment; filename="ai-usage-report.csv"');
      }
      
      return reply.send(report);
    } catch (error: any) {
      console.error('[Command Center] Logging report error:', error);
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  app.get('/logging/patterns', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) {
        return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      }

      const patterns = await loggingEngine.analyzeUsagePatterns(tenantId);
      return reply.send({ success: true, data: patterns });
    } catch (error: any) {
      console.error('[Command Center] Logging patterns error:', error);
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  // ============================================================
  // STRATEGIC SIMULATION
  // ============================================================

  app.post('/simulation/scenarios', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) {
        return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      }

      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body as any;
      
      const scenario = await simulationEngine.createScenario(tenantId, body);
      return reply.send({ success: true, data: scenario });
    } catch (error: any) {
      console.error('[Command Center] Create scenario error:', error);
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  app.get('/simulation/scenarios', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) {
        return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      }

      const scenarios = await simulationEngine.getScenarios(tenantId);
      return reply.send({ success: true, data: scenarios });
    } catch (error: any) {
      console.error('[Command Center] Get scenarios error:', error);
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  app.post('/simulation/scenarios/:scenarioId/run', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { scenarioId } = req.params as any;
      
      const result = await simulationEngine.runSimulation(scenarioId);
      return reply.send({ success: true, data: result });
    } catch (error: any) {
      console.error('[Command Center] Run simulation error:', error);
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  app.get('/simulation/scenarios/:scenarioId/result', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { scenarioId } = req.params as any;
      
      const result = await simulationEngine.getSimulationResult(scenarioId);
      return reply.send({ success: true, data: result });
    } catch (error: any) {
      console.error('[Command Center] Get simulation result error:', error);
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  app.post('/simulation/compare', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body as any;
      const { scenarioIds } = body;

      if (!scenarioIds || !Array.isArray(scenarioIds) || scenarioIds.length < 2) {
        return reply.code(400).send({ 
          error: 'Se requieren al menos 2 IDs de escenarios para comparar' 
        });
      }

      const comparison = await simulationEngine.compareScenarios(scenarioIds);
      return reply.send({ success: true, data: comparison });
    } catch (error: any) {
      console.error('[Command Center] Compare scenarios error:', error);
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  app.delete('/simulation/scenarios/:scenarioId', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { scenarioId } = req.params as any;
      
      const success = await simulationEngine.deleteScenario(scenarioId);
      return reply.send({ success, deleted: success });
    } catch (error: any) {
      console.error('[Command Center] Delete scenario error:', error);
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  // ============================================================
  // AI REPORT GENERATOR
  // ============================================================

  app.post('/reports/generate', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) {
        return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      }

      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body as any;
      
      const report = await reportGenerator.generateReport({
        tenantId,
        type: body.type || 'executive_summary',
        format: body.format || 'pdf',
        title: body.title,
        description: body.description,
        dateRange: body.dateRange,
        filters: body.filters,
        template: body.template,
        includeCharts: body.includeCharts !== false,
        language: body.language || 'es'
      });

      return reply.send({ success: true, data: report });
    } catch (error: any) {
      console.error('[Command Center] Generate report error:', error);
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  app.get('/reports', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) {
        return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      }

      const reports = await reportGenerator.getReports(tenantId);
      return reply.send({ success: true, data: reports });
    } catch (error: any) {
      console.error('[Command Center] Get reports error:', error);
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  app.get('/reports/:reportId/download', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) {
        return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      }

      const { reportId } = req.params as any;
      
      const { filePath, contentType } = await reportGenerator.downloadReport(reportId, tenantId);
      
      // Enviar archivo
      const fileBuffer = await fs.readFile(filePath);
      
      reply.type(contentType);
      reply.header('Content-Disposition', `attachment; filename="${path.basename(filePath)}"`);
      return reply.send(fileBuffer);
      
    } catch (error: any) {
      console.error('[Command Center] Download report error:', error);
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  app.delete('/reports/:reportId', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) {
        return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      }

      const { reportId } = req.params as any;
      
      // Eliminar de la base de datos (el archivo se limpia con cleanup)
      await (app.prisma as any).aIReport.deleteMany({
        where: { 
          id: reportId,
          tenantId 
        }
      });

      return reply.send({ success: true, deleted: true });
    } catch (error: any) {
      console.error('[Command Center] Delete report error:', error);
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  // ============================================================
  // CONSULTA PRINCIPAL - Chat con IA
  // ============================================================
  app.post('/query', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) {
        return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      }

      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body as any;
      const { query, conversationId, stream = false } = body;

      if (!query || typeof query !== 'string') {
        return reply.code(400).send({ error: 'Query es requerido' });
      }

      const userId = (req as any).auth?.userId || (req as any).db?.userId || 'anonymous';
      const rawRole = (req as any).auth?.tenantRole || (req as any).auth?.globalRole || (req as any).db?.role || 'USER';
      const userRole = String(rawRole).toUpperCase();

      // Resolver conversación: crear si no existe, recuperar si ya existe
      let resolvedConversationId = conversationId;
      try {
        if (resolvedConversationId && userId !== 'anonymous') {
          // Verificar que la conversación existe y pertenece a este tenant/user
          const existing = await (app.prisma as any).aIConversation?.findFirst({
            where: { id: resolvedConversationId, tenantId, userId }
          });
          if (!existing) {
            resolvedConversationId = undefined;
          }
        }
        if (!resolvedConversationId && userId !== 'anonymous') {
          // Crear nueva conversación en BD
          const newConv = await (app.prisma as any).aIConversation?.create({
            data: {
              tenantId,
              userId,
              title: query.substring(0, 80),
              status: 'ACTIVE'
            }
          });
          resolvedConversationId = newConv?.id;
        }
      } catch {
        // No crítico — continúa sin persistencia de conversación
      }

      // Obtener contexto de memoria
      const memoryContext = {
        tenantId,
        userId,
        conversationId: resolvedConversationId
      };

      const conversationContext = await memoryEngine.getConversationContext(memoryContext);

      // Si se solicita streaming, usar endpoint separado
      if (stream) {
        return reply.code(400).send({ 
          error: 'Use /api/command-center/stream endpoint para streaming',
          websocketUrl: '/api/command-center/stream'
        });
      }

      // Procesar consulta normal
      const startTime = Date.now();
      const result = await orchestrator.processQuery(
        query,
        tenantId,
        userId,
        userRole,
        resolvedConversationId
      );
      const latency = Date.now() - startTime;

      // Actualizar memoria
      await memoryEngine.addQueryToHistory(memoryContext, query, result);
      await memoryEngine.detectAndStorePatterns(memoryContext, query, result);

      // Registrar uso de IA (no crítico - no interrumpe si falla)
      try { await loggingEngine.logAIQuery({
        tenantId,
        userId,
        sessionId: resolvedConversationId,
        provider: (result as any).provider || 'groq',
        model: (result as any).model || 'llama-3.1-8b-instant',
        tokensUsed: result.tokensUsed || 0,
        cost: result.cost || 0,
        latency,
        module: 'command-center',
        action: 'query',
        query,
        response: result.summary,
        success: true,
        metadata: {
          conversationId: resolvedConversationId,
          userRole,
          widgets: result.widgets?.length || 0
        }
      }); } catch (logErr) { app.log.warn({ err: logErr }, '[Command Center] Logging error (non-critical)'); }
      // Nota: mensajes guardados en BD por AIOrchestrator.saveConversationMessages()

      // Actualizar contexto si hay widgets
      if (result.widgets && result.widgets.length > 0) {
        conversationContext.modules.push('dashboard');
        await memoryEngine.updateConversationContext(memoryContext, conversationContext);
      }

      // Generate charts from real DB data when query warrants visual indicators
      let charts = result.charts || [];
      try {
        if (orchestrator.shouldGenerateCharts(query)) {
          const autoCharts = await orchestrator.generateChartsFromData(query, tenantId);
          if (autoCharts.length > 0) charts = [...charts, ...autoCharts];
        }
      } catch {}

      return reply.send({
        success: true,
        data: { ...result, charts: charts.length > 0 ? charts : undefined },
        conversationId: resolvedConversationId,
        provider: result.provider,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      app.log.error('[Command Center] Query error:', error);
      return reply.code(500).send({ 
        error: 'Error procesando consulta',
        message: error.message 
      });
    }
  });

  // ============================================================
  // STREAMING SSE - Chat realtime con generator
  // ============================================================
  app.get('/stream', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      const userId = (req as any).auth?.userId || (req as any).db?.userId || 'anonymous';
      const userRole = (req as any).auth?.role || (req as any).db?.tenantRole || 'USER';
      const { query, conversationId } = req.query as any;
      if (!query) return reply.code(400).send({ error: 'Se requiere query' });

      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      });

      // Route query to specialized agents
      const queryRouting = agentRouter.routeQuery(query);
      const queryBadges = agentRouter.getAgentBadges(queryRouting);

      reply.raw.write(`data: ${JSON.stringify({ type: 'start', agents: queryBadges })}\n\n`);

      const stream = orchestrator.processQueryStream(query, tenantId, userId, userRole, conversationId);
      let lastContent = '';

      for await (const chunk of stream) {
        const newContent = chunk.summary.slice(lastContent.length);
        if (newContent) {
          reply.raw.write(`data: ${JSON.stringify({ type: 'chunk', content: newContent })}\n\n`);
          lastContent = chunk.summary;
        }
        if (chunk.done) {
          // Generate charts from real DB data when query warrants it
          let charts: any[] = [];
          try {
            if (orchestrator.shouldGenerateCharts(query)) {
              charts = await orchestrator.generateChartsFromData(query, tenantId);
            }
          } catch (chartErr) {
            console.error('[Command Center] Chart generation error:', chartErr);
          }

          reply.raw.write(`data: ${JSON.stringify({
            type: 'complete',
            content: chunk.summary,
            provider: chunk.provider,
            tokensUsed: chunk.tokensUsed,
            cost: chunk.cost,
            charts: charts.length > 0 ? charts : undefined,
            agents: queryBadges,
          })}\n\n`);
        }
      }

      // Update memory
      const memoryContext = { tenantId, userId, conversationId };
      await memoryEngine.addQueryToHistory(memoryContext, query, { summary: lastContent, tokensUsed: 0, cost: 0, provider: 'groq' } as any);

      reply.raw.end();
    } catch (error: any) {
      try {
        reply.raw.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
        reply.raw.end();
      } catch {
        // Connection already closed
      }
    }
  });

  // ============================================================
  // SUGERENCIAS DE CONSULTAS
  // ============================================================
  app.get('/suggestions', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) {
        return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      }

      const suggestions = [
        { category: 'Dashboard', queries: [
          '¿Cuál es el estado general de los proyectos?',
          'Muéstrame los KPIs principales',
          '¿Hay alguna alerta importante?'
        ]},
        { category: 'Análisis', queries: [
          'Analiza los riesgos del proyecto X',
          '¿Qué proyectos están en riesgo?',
          'Compara el desempeño de los proyectos'
        ]},
        { category: 'Acciones', queries: [
          'Crea un proyecto correctivo',
          'Genera una CAPA para la NCR 123',
          'Programa una reunión de revisión'
        ]},
        { category: 'Estratégico', queries: [
          '¿Conviene invertir en esta operación?',
          '¿Tenemos capacidad para escalar?',
          'Analiza el ROI de los proyectos activos'
        ]}
      ];

      return reply.send({
        success: true,
        data: suggestions,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      return reply.code(500).send({ error: error.message });
    }
  });

  // ============================================================
  // EJECUTAR ACCIÓN (crear proyecto, CAPA, etc.)
  // ============================================================
  app.post('/actions/execute', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) {
        return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      }

      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body as any;
      const { actionType, payload } = body;

      // TODO: Implementar ejecución de acciones
      // Esto requiere integración con los diferentes módulos

      return reply.send({
        success: true,
        message: `Acción ${actionType} ejecutada (simulado)`,
        data: payload,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      return reply.code(500).send({ error: error.message });
    }
  });

  // ============================================================
  // USO DE IA (reporte de consumo)
  // ============================================================
  app.get('/usage', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) {
        return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      }

      // TODO: Implementar cuando exista el modelo AIUsageLog
      return reply.send({
        success: true,
        data: {
          totalQueries: 0,
          tokensConsumed: 0,
          costEstimate: 0,
          byProvider: { groq: 0, openai: 0 },
          byModule: {}
        },
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      return reply.code(500).send({ error: error.message });
    }
  });

  // ============================================================
  // PROACTIVE INSIGHTS (datos reales)
  // ============================================================
  app.get('/insights', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      const insights = await insightsEngine.generateInsights(tenantId);
      return reply.send({ success: true, data: insights, timestamp: new Date().toISOString() });
    } catch (error: any) {
      console.error('[Command Center] Insights error:', error);
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  // ============================================================
  // OPERATIONAL TIMELINE (datos reales)
  // ============================================================
  app.get('/timeline', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      const { limit = '50', offset = '0', modules, since } = req.query as any;
      const result = await timelineEngine.getTimeline(tenantId, {
        limit: parseInt(limit),
        offset: parseInt(offset),
        modules: modules ? String(modules).split(',') : undefined,
        since: since ? new Date(since) : undefined
      });
      return reply.send({ success: true, data: result, timestamp: new Date().toISOString() });
    } catch (error: any) {
      console.error('[Command Center] Timeline error:', error);
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  // ============================================================
  // CONVERSATION MESSAGES (historial)
  // ============================================================
  app.get('/conversations/:conversationId/messages', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      const userId = (req as any).auth?.userId || (req as any).db?.userId || 'anonymous';
      const { conversationId } = req.params as any;
      const { limit = '100' } = req.query as any;
      const conversation = await (app.prisma as any).aIConversation?.findFirst({
        where: { id: conversationId, tenantId, userId }
      });
      if (!conversation) return reply.code(404).send({ error: 'Conversación no encontrada' });
      const messages = await (app.prisma as any).aIMessage?.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
        take: parseInt(limit)
      }) || [];
      return reply.send({ success: true, data: { conversation, messages } });
    } catch (error: any) {
      console.error('[Command Center] Conversation messages error:', error);
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  // ============================================================
  // MEMORY STATS
  // ============================================================
  app.get('/memory/stats', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      const stats = await memoryEngine.getMemoryStats(tenantId);
      return reply.send({ success: true, data: stats });
    } catch (error: any) {
      console.error('[Command Center] Memory stats error:', error);
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  // ============================================================
  // DYNAMIC CHARTS (datos reales para Recharts)
  // ============================================================
  app.get('/charts', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      const db = app.prisma as any;
      const charts: any[] = [];

      // 1. NCR by status
      const ncrModel = db.nonConformityReport || db.ncr || db.nonConformity;
      if (ncrModel) {
        const ncrs = await ncrModel.findMany({ where: { tenantId }, select: { status: true, severity: true } });
        if (ncrs.length > 0) {
          const byStatus: Record<string, number> = {};
          ncrs.forEach((n: any) => { byStatus[n.status] = (byStatus[n.status] || 0) + 1; });
          charts.push({
            type: 'bar',
            title: 'NCRs por Estado',
            data: Object.entries(byStatus).map(([status, count]) => ({ estado: status, cantidad: count })),
            xKey: 'estado',
            series: [{ key: 'cantidad', color: '#ef4444', label: 'NCRs' }],
          });
          // NCR by severity pie
          const bySev: Record<string, number> = {};
          ncrs.forEach((n: any) => { if (n.severity) bySev[n.severity] = (bySev[n.severity] || 0) + 1; });
          if (Object.keys(bySev).length > 0) {
            charts.push({
              type: 'pie',
              title: 'NCRs por Severidad',
              data: Object.entries(bySev).map(([sev, count]) => ({ severidad: sev, cantidad: count })),
              xKey: 'severidad',
              series: [{ key: 'cantidad' }],
            });
          }
        }
      }

      // 2. Projects by status
      const projects = await db.project360?.findMany({ where: { tenantId, deletedAt: null }, select: { status: true, progress: true } }) || [];
      if (projects.length > 0) {
        const byStatus: Record<string, number> = {};
        projects.forEach((p: any) => { byStatus[p.status] = (byStatus[p.status] || 0) + 1; });
        charts.push({
          type: 'pie',
          title: 'Proyectos por Estado',
          data: Object.entries(byStatus).map(([status, count]) => ({ estado: status, cantidad: count })),
          xKey: 'estado',
          series: [{ key: 'cantidad' }],
        });
      }

      // 3. Fleet by status
      const vehicles = await db.vehiculo?.findMany({ where: { tenantId }, select: { status: true } }) || [];
      if (vehicles.length > 0) {
        const byStatus: Record<string, number> = {};
        vehicles.forEach((v: any) => { byStatus[v.status || 'SIN_ESTADO'] = (byStatus[v.status || 'SIN_ESTADO'] || 0) + 1; });
        charts.push({
          type: 'bar',
          title: 'Flota por Estado',
          data: Object.entries(byStatus).map(([status, count]) => ({ estado: status, cantidad: count })),
          xKey: 'estado',
          series: [{ key: 'cantidad', color: '#3b82f6', label: 'Vehículos' }],
        });
      }

      // 4. Risks by level
      const risks = await db.risk?.findMany({ where: { tenantId }, select: { level: true, status: true } }) || [];
      if (risks.length > 0) {
        const byLevel: Record<string, number> = {};
        risks.forEach((r: any) => { byLevel[r.level || 'SIN_NIVEL'] = (byLevel[r.level || 'SIN_NIVEL'] || 0) + 1; });
        charts.push({
          type: 'bar',
          title: 'Riesgos por Nivel',
          data: Object.entries(byLevel).map(([level, count]) => ({ nivel: level, cantidad: count })),
          xKey: 'nivel',
          series: [{ key: 'cantidad', color: '#f59e0b', label: 'Riesgos' }],
        });
      }

      return reply.send({ success: true, data: charts, timestamp: new Date().toISOString() });
    } catch (error: any) {
      console.error('[Command Center] Charts error:', error);
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  // ============================================================
  // ENTERPRISE AI CONTROL TOWER - NEW ENDPOINTS
  // ============================================================

  // ------------------------------------------------------------
  // INTENT ANALYSIS & CONTEXTUAL DASHBOARD
  // ------------------------------------------------------------
  app.post('/intent/analyze', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) {
        return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      }

      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body as any;
      const { query, userContext } = body;

      if (!query) {
        return reply.code(400).send({ error: 'Query es requerido' });
      }

      // Analizar intención
      const intent = await intentEngine.analyzeIntent(query, userContext || {});
      
      // Generar dashboard contextual
      const dashboard = await intentEngine.generateDashboard(intent);

      return reply.send({
        success: true,
        data: {
          intent,
          dashboard,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error: any) {
      return reply.code(500).send({ error: error.message });
    }
  });

  // ------------------------------------------------------------
  // AI THINKING VISUALIZATION
  // ------------------------------------------------------------
  app.post('/thinking/start', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body as any;
      const { query, intent, provider, model } = body;

      if (!query || !intent) {
        return reply.code(400).send({ error: 'Query e intent son requeridos' });
      }

      const sessionId = await thinkingVisualizer.startThinkingSession(
        query, 
        intent, 
        provider || 'groq', 
        model || 'llama-3.1-8b-instant'
      );

      // Iniciar simulación de progreso
      thinkingVisualizer.simulateProgress(sessionId);

      return reply.send({
        success: true,
        data: {
          sessionId,
          steps: thinkingVisualizer.getActiveSessionSteps(sessionId),
          timestamp: new Date().toISOString()
        }
      });

    } catch (error: any) {
      return reply.code(500).send({ error: error.message });
    }
  });

  app.get('/thinking/:sessionId', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { sessionId } = req.params as any;
      const session = thinkingVisualizer.getSession(sessionId);
      
      if (!session) {
        return reply.code(404).send({ error: 'Session not found' });
      }

      return reply.send({
        success: true,
        data: {
          session,
          currentStep: thinkingVisualizer.getCurrentStep(sessionId),
          progress: thinkingVisualizer.getSessionProgress(sessionId),
          timestamp: new Date().toISOString()
        }
      });

    } catch (error: any) {
      return reply.code(500).send({ error: error.message });
    }
  });

  // ------------------------------------------------------------
  // OPERATIONAL MODES
  // ------------------------------------------------------------
  app.get('/modes', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const modes = operationalModes.getAllModes();
      
      return reply.send({
        success: true,
        data: modes
      });

    } catch (error: any) {
      return reply.code(500).send({ error: error.message });
    }
  });

  app.post('/modes/:modeId/activate', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { modeId } = req.params as any;
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body as any;
      const { query } = body;

      const mode = operationalModes.getMode(modeId);
      if (!mode) {
        return reply.code(404).send({ error: 'Mode not found' });
      }

      // Adaptar query para el modo
      const adaptedQuery = await operationalModes.adaptQueryForMode(query, mode);

      // Obtener widgets y acciones específicas del modo
      const widgets = await operationalModes.getModeSpecificWidgets(mode);
      const actions = await operationalModes.getModeSpecificActions(mode);

      return reply.send({
        success: true,
        data: {
          mode,
          adaptedQuery,
          widgets,
          actions,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error: any) {
      return reply.code(500).send({ error: error.message });
    }
  });

  app.post('/actions/:actionId/execute', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) {
        return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      }

      const { actionId } = req.params as any;
      const userId = (req as any).db?.userId || 'anonymous';
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body as any;
      const { parameters } = body;

      const executionId = await commandActions.executeAction(actionId, userId, tenantId, parameters);

      return reply.send({
        success: true,
        data: {
          executionId,
          actionId,
          status: 'started',
          timestamp: new Date().toISOString()
        }
      });

    } catch (error: any) {
      return reply.code(500).send({ error: error.message });
    }
  });

  app.get('/actions/executions/:executionId', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { executionId } = req.params as any;
      const execution = commandActions.getExecution(executionId);
      
      if (!execution) {
        return reply.code(404).send({ error: 'Execution not found' });
      }

      return reply.send({
        success: true,
        data: execution
      });

    } catch (error: any) {
      return reply.code(500).send({ error: error.message });
    }
  });

  app.post('/alerts', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) {
        return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      }

      const userId = (req as any).db?.userId;
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body as any;
      const { type, title, description, options } = body;

      if (!type || !title || !description) {
        return reply.code(400).send({ error: 'Type, title y description son requeridos' });
      }

      const alertId = await floatingAlerts.createManualAlert(
        type,
        title,
        description,
        tenantId,
        userId,
        options
      );

      return reply.send({
        success: true,
        data: {
          alertId,
          message: 'Alert created successfully',
          timestamp: new Date().toISOString()
        }
      });

    } catch (error: any) {
      return reply.code(500).send({ error: error.message });
    }
  });

  app.post('/alerts/:alertId/dismiss', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { alertId } = req.params as any;
      const userId = (req as any).db?.userId || 'anonymous';

      const dismissed = floatingAlerts.dismissAlert(alertId, userId);

      if (!dismissed) {
        return reply.code(404).send({ error: 'Alert not found or already dismissed' });
      }

      return reply.send({
        success: true,
        data: {
          message: 'Alert dismissed successfully',
          timestamp: new Date().toISOString()
        }
      });

    } catch (error: any) {
      return reply.code(500).send({ error: error.message });
    }
  });

  // ------------------------------------------------------------
  // PROACTIVE ALERTS CHECK
  // ------------------------------------------------------------
  app.post('/alerts/check', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) {
        return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      }

      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body as any;
      const { systemData } = body;

      // Simular datos del sistema si no se proporcionan
      const mockSystemData = systemData || {
        project: { budget_variance: 0.12, name: 'Project Alpha' },
        financial: { cash_flow_ratio: 0.08 },
        system: { uptime: 0.97, error_rate: 0.03 },
        hr: { turnover_risk_score: 0.6 },
        compliance: { overdue_items: 2 }
      };

      const triggeredAlerts = await floatingAlerts.checkRules(tenantId, mockSystemData);

      return reply.send({
        success: true,
        data: {
          triggeredAlerts,
          systemData: mockSystemData,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error: any) {
      return reply.code(500).send({ error: error.message });
    }
  });

  // ============================================================
  // WIDGETS CONFIGURABLES — CATÁLOGO Y DATOS REALES
  // ============================================================

  app.get('/widgets/catalog', async (req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      success: true,
      data: [
        { key: 'employees_total',        label: 'Empleados totales',       module: 'RRHH',          icon: 'users',       color: 'blue' },
        { key: 'employees_active',       label: 'Empleados activos',       module: 'RRHH',          icon: 'user-check',  color: 'green' },
        { key: 'projects_total',         label: 'Proyectos totales',       module: 'Project360',    icon: 'folder',      color: 'purple' },
        { key: 'projects_active',        label: 'Proyectos activos',       module: 'Project360',    icon: 'play-circle', color: 'indigo' },
        { key: 'projects_at_risk',       label: 'Proyectos en riesgo',     module: 'Project360',    icon: 'alert-triangle', color: 'orange' },
        { key: 'fleet_total',            label: 'Vehículos totales',       module: 'Flota360',      icon: 'truck',       color: 'cyan' },
        { key: 'fleet_active',           label: 'Vehículos operativos',    module: 'Flota360',      icon: 'check-circle', color: 'green' },
        { key: 'fleet_maintenance',      label: 'Vehículos en taller',     module: 'Flota360',      icon: 'tool',        color: 'yellow' },
        { key: 'ncr_total',              label: 'NCRs totales',            module: 'Calidad',       icon: 'file-x',      color: 'red' },
        { key: 'ncr_open',              label: 'NCRs abiertas',           module: 'Calidad',       icon: 'alert-circle', color: 'orange' },
        { key: 'ncr_critical',           label: 'NCRs críticas',           module: 'Calidad',       icon: 'zap',         color: 'red' },
        { key: 'risks_total',            label: 'Riesgos registrados',     module: 'Riesgos',       icon: 'shield',      color: 'yellow' },
        { key: 'risks_high',             label: 'Riesgos altos',           module: 'Riesgos',       icon: 'shield-off',  color: 'red' },
        { key: 'audits_total',           label: 'Auditorías totales',      module: 'Auditorías',    icon: 'clipboard',   color: 'teal' },
        { key: 'audits_open',            label: 'Auditorías en curso',     module: 'Auditorías',    icon: 'clipboard-list', color: 'blue' },
        { key: 'calibrations_due',       label: 'Calibraciones vencidas',  module: 'Calibraciones', icon: 'clock',       color: 'orange' },
      ]
    });
  });

  app.post('/widgets/data', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body as any;
      const { keys }: { keys: string[] } = body;
      if (!Array.isArray(keys) || keys.length === 0) return reply.code(400).send({ error: 'keys requerido' });

      const db = app.prisma as any;
      const results: Record<string, number | null> = {};

      await Promise.all(keys.map(async (key) => {
        try {
          switch (key) {
            case 'employees_total':
              results[key] = await db.employee.count({ where: { tenantId } });
              break;
            case 'employees_active':
              results[key] = await db.employee.count({ where: { tenantId, status: 'ACTIVE' } });
              break;
            case 'projects_total':
              results[key] = await db.project360.count({ where: { tenantId, deletedAt: null } });
              break;
            case 'projects_active':
              results[key] = await db.project360.count({ where: { tenantId, deletedAt: null, status: 'ACTIVE' } });
              break;
            case 'projects_at_risk':
              results[key] = await db.project360.count({ where: { tenantId, deletedAt: null, status: 'AT_RISK' } });
              break;
            case 'fleet_total':
              results[key] = await db.vehiculo.count({ where: { tenantId } });
              break;
            case 'fleet_active':
              results[key] = await db.vehiculo.count({ where: { tenantId, status: 'ACTIVO' } });
              break;
            case 'fleet_maintenance':
              results[key] = await db.vehiculo.count({ where: { tenantId, status: 'EN_TALLER' } });
              break;
            case 'ncr_total':
              results[key] = await db.nonConformity.count({ where: { tenantId } });
              break;
            case 'ncr_open':
              results[key] = await db.nonConformity.count({ where: { tenantId, status: { not: 'CLOSED' }, deletedAt: null } });
              break;
            case 'ncr_critical':
              results[key] = await db.nonConformity.count({ where: { tenantId, severity: { in: ['CRITICAL', 'HIGH'] }, status: { not: 'CLOSED' } } });
              break;
            case 'risks_total':
              results[key] = await db.risk.count({ where: { tenantId } });
              break;
            case 'risks_high':
              results[key] = await db.risk.count({ where: { tenantId, level: { in: ['HIGH', 'CRITICAL'] } } });
              break;
            case 'audits_total':
              results[key] = await db.auditRun?.count({ where: { tenantId } }) ?? null;
              break;
            case 'audits_open':
              results[key] = await db.auditRun?.count({ where: { tenantId, status: { in: ['PLANNED', 'IN_PROGRESS'] } } }) ?? null;
              break;
            case 'calibrations_due': {
              const now = new Date();
              results[key] = await db.calibration?.count({ where: { tenantId, nextDueDate: { lte: now } } }) ?? null;
              break;
            }
            default:
              results[key] = null;
          }
        } catch {
          results[key] = null;
        }
      }));

      return reply.send({ success: true, data: results });

    } catch (error: any) {
      return reply.code(500).send({ error: error.message });
    }
  });

  // ============================================================
  // MERCADOPAGO — PLANES Y PAGOS
  // ============================================================

  app.get('/mercadopago/plans', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const mpService = new AIMercadoPagoService(app.prisma);
      const plans = mpService.getAvailablePlans();
      return reply.send({ success: true, data: plans });
    } catch (error: any) {
      return reply.code(500).send({ error: error.message });
    }
  });

  app.post('/mercadopago/create-preference', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body as any;
      const { planId } = body;
      if (!planId) return reply.code(400).send({ error: 'planId requerido' });

      const userId = (req as any).auth?.userId || (req as any).db?.userId || 'anonymous';
      const userEmail = (req as any).auth?.email || (req as any).db?.email || 'cliente@sgi360.com';
      const userName = (req as any).auth?.name || 'Cliente SGI360';

      const mpService = new AIMercadoPagoService(app.prisma);
      const preference = await mpService.createPaymentPreference(tenantId, planId, userEmail, userName);
      return reply.send({ success: true, data: preference });
    } catch (error: any) {
      return reply.code(500).send({ error: error.message });
    }
  });

  // ============================================================
  // FASE 3: PREDICTIVE ANALYTICS
  // ============================================================
  app.get('/predictive', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      const db = app.prisma as any;
      const predictions: any[] = [];

      // --- NCR trend prediction ---
      const ncrModel = db.nonConformityReport || db.ncr || db.nonConformity;
      if (ncrModel) {
        const ncrs = await ncrModel.findMany({
          where: { tenantId },
          select: { createdAt: true, status: true, severity: true },
          orderBy: { createdAt: 'asc' },
        });
        if (ncrs.length >= 3) {
          const months: Record<string, number> = {};
          ncrs.forEach((n: any) => {
            const m = new Date(n.createdAt).toISOString().slice(0, 7);
            months[m] = (months[m] || 0) + 1;
          });
          const entries = Object.entries(months).sort();
          const recent = entries.slice(-6);
          const avg = recent.reduce((s, [, v]) => s + v, 0) / (recent.length || 1);
          const trend = recent.length >= 2
            ? (recent[recent.length - 1][1] - recent[0][1]) / (recent.length - 1)
            : 0;
          const nextMonth = Math.max(0, Math.round(avg + trend));
          predictions.push({
            module: 'calidad',
            metric: 'NCRs mensuales',
            current: recent[recent.length - 1]?.[1] || 0,
            predicted: nextMonth,
            trend: trend > 0 ? 'up' : trend < 0 ? 'down' : 'stable',
            trendPct: recent.length >= 2 && recent[0][1] > 0
              ? Math.round(((recent[recent.length - 1][1] - recent[0][1]) / recent[0][1]) * 100)
              : 0,
            confidence: Math.min(0.95, 0.6 + ncrs.length * 0.005),
            history: recent.map(([month, count]) => ({ month, count })),
            alert: nextMonth > avg * 1.3 ? 'Tendencia alcista en NCRs detectada — revisar procesos' : null,
          });
        }
      }

      // --- Project delivery prediction ---
      const projects = await db.project360?.findMany({
        where: { tenantId, deletedAt: null, status: { in: ['ACTIVE', 'AT_RISK'] } },
        select: { id: true, name: true, progress: true, status: true, startDate: true, targetDate: true, budget: true, actualCost: true },
      }) || [];
      for (const p of projects) {
        if (p.startDate && p.targetDate && p.progress != null) {
          const total = new Date(p.targetDate).getTime() - new Date(p.startDate).getTime();
          const elapsed = Date.now() - new Date(p.startDate).getTime();
          const timeProgress = Math.min(1, elapsed / (total || 1));
          const deviation = timeProgress > 0 ? p.progress / 100 / timeProgress : 1;
          const riskLevel = deviation < 0.7 ? 'high' : deviation < 0.9 ? 'medium' : 'low';
          const estimatedCompletion = deviation > 0
            ? new Date(new Date(p.startDate).getTime() + total / deviation)
            : null;
          const overBudget = p.budget && p.actualCost ? (p.actualCost - p.budget) / p.budget : 0;
          predictions.push({
            module: 'projects',
            metric: `Proyecto: ${p.name}`,
            current: p.progress,
            predicted: Math.min(100, Math.round(p.progress + deviation * 10)),
            trend: deviation >= 1 ? 'up' : 'down',
            trendPct: Math.round((deviation - 1) * 100),
            confidence: 0.75,
            riskLevel,
            estimatedCompletion: estimatedCompletion?.toISOString().slice(0, 10) || null,
            overBudget: overBudget > 0 ? Math.round(overBudget * 100) : 0,
            alert: riskLevel === 'high'
              ? `⚠️ Proyecto "${p.name}" tiene riesgo alto de atraso`
              : overBudget > 0.15
                ? `💰 Sobrecosto del ${Math.round(overBudget * 100)}% detectado`
                : null,
          });
        }
      }

      // --- Fleet maintenance prediction ---
      const vehicles = await db.vehiculo?.findMany({
        where: { tenantId },
        select: { id: true, dominio: true, marca: true, modelo: true, status: true, kmActual: true },
      }) || [];
      const maintenanceCount = vehicles.filter((v: any) => v.status === 'EN_TALLER').length;
      if (vehicles.length > 0) {
        predictions.push({
          module: 'flota',
          metric: 'Disponibilidad de flota',
          current: Math.round(((vehicles.length - maintenanceCount) / vehicles.length) * 100),
          predicted: Math.round(((vehicles.length - Math.max(0, maintenanceCount - 1)) / vehicles.length) * 100),
          trend: maintenanceCount > vehicles.length * 0.2 ? 'down' : 'stable',
          confidence: 0.7,
          alert: maintenanceCount > vehicles.length * 0.3
            ? `🚛 ${maintenanceCount} de ${vehicles.length} vehículos en taller (${Math.round(maintenanceCount / vehicles.length * 100)}%)`
            : null,
        });
      }

      return reply.send({ success: true, data: predictions, timestamp: new Date().toISOString() });
    } catch (error: any) {
      console.error('[Command Center] Predictive error:', error);
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  // ============================================================
  // FASE 3: EXECUTE ACTIONS FROM CHAT
  // ============================================================
  app.post('/execute-action', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      const userId = (req as any).auth?.userId || (req as any).db?.userId || 'anonymous';
      const userRole = (req as any).auth?.tenantRole || (req as any).db?.role || 'USER';
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body as any;
      const { action, params, conversationId } = body;

      if (!action) return reply.code(400).send({ error: 'action requerido' });

      const toolsEngine = orchestrator.toolsEngine || new (await import('../services/ai-tools-engine.js')).AIToolsEngine(app.prisma, app);
      const result = await toolsEngine.executeTool(action, params || {}, tenantId, userId, String(userRole).toUpperCase());

      // Save action message in conversation
      if (conversationId) {
        try {
          await (app.prisma as any).aIMessage?.create({
            data: { conversationId, role: 'ASSISTANT', content: result.message, provider: 'SYSTEM', tokensUsed: 0, cost: 0 }
          });
        } catch { /* non-critical */ }
      }

      return reply.send({ success: true, data: result, timestamp: new Date().toISOString() });
    } catch (error: any) {
      console.error('[Command Center] Execute action error:', error);
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  // ============================================================
  // FASE 3: SMART NOTIFICATIONS
  // ============================================================
  app.get('/notifications', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      const db = app.prisma as any;
      const notifications: any[] = [];

      // Proactive alerts from DB
      try {
        const alerts = await db.aIProactiveAlert?.findMany({
          where: { tenantId, status: 'ACTIVE' },
          orderBy: { createdAt: 'desc' },
          take: 20,
        }) || [];
        alerts.forEach((a: any) => {
          notifications.push({
            id: a.id, type: 'alert', severity: a.severity?.toLowerCase() || 'medium',
            title: a.title, description: a.description, module: a.module,
            createdAt: a.createdAt, read: false,
          });
        });
      } catch { /* table may not exist */ }

      // Recent NCRs opened
      const ncrModel = db.nonConformityReport || db.ncr || db.nonConformity;
      if (ncrModel) {
        const recentNCRs = await ncrModel.findMany({
          where: { tenantId, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
          select: { id: true, title: true, severity: true, createdAt: true },
          orderBy: { createdAt: 'desc' }, take: 5,
        });
        recentNCRs.forEach((n: any) => {
          notifications.push({
            id: `ncr-${n.id}`, type: 'ncr', severity: n.severity?.toLowerCase() || 'medium',
            title: `Nueva NCR: ${n.title}`, description: `Severidad: ${n.severity}`,
            module: 'calidad', createdAt: n.createdAt, read: false,
          });
        });
      }

      // Sort by date
      notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return reply.send({ success: true, data: notifications, unreadCount: notifications.filter(n => !n.read).length });
    } catch (error: any) {
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  // ============================================================
  // FASE 4: MESSAGE FEEDBACK (thumbs up/down)
  // ============================================================
  app.post('/messages/:messageId/feedback', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { messageId } = req.params as any;
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body as any;
      const { rating, comment } = body; // rating: 'up' | 'down'

      const db = app.prisma as any;
      // Try to update message with feedback
      try {
        await db.aIMessage?.update({
          where: { id: messageId },
          data: {
            metadata: {
              feedback: rating,
              feedbackComment: comment || null,
              feedbackAt: new Date().toISOString(),
            }
          }
        });
      } catch {
        // Message model might not have metadata field - store in audit
        await db.auditEvent?.create({
          data: {
            action: 'AI_FEEDBACK',
            entityType: 'AI_MESSAGE',
            entityId: messageId,
            metadata: { rating, comment },
          }
        });
      }

      return reply.send({ success: true, message: 'Feedback registrado' });
    } catch (error: any) {
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  // ============================================================
  // FASE 4: EXPORT CONVERSATION
  // ============================================================
  app.get('/conversations/:conversationId/export', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      const userId = (req as any).auth?.userId || (req as any).db?.userId || 'anonymous';
      const { conversationId } = req.params as any;
      const { format = 'markdown' } = req.query as any;

      const db = app.prisma as any;
      const conv = await db.aIConversation?.findFirst({ where: { id: conversationId, tenantId, userId } });
      if (!conv) return reply.code(404).send({ error: 'Conversación no encontrada' });

      const messages = await db.aIMessage?.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
      }) || [];

      if (format === 'markdown') {
        let md = `# ${conv.title || 'Conversación'}\n`;
        md += `**Fecha:** ${new Date(conv.createdAt).toLocaleDateString('es-AR')}\n\n---\n\n`;
        for (const m of messages) {
          const role = m.role === 'USER' ? '👤 **Usuario**' : '🤖 **SGI360 AI**';
          const time = new Date(m.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
          md += `### ${role} — ${time}\n\n${m.content}\n\n`;
          if (m.provider) md += `_Provider: ${m.provider} | Tokens: ${m.tokensUsed || 0}_\n\n`;
          md += '---\n\n';
        }

        reply.header('Content-Type', 'text/markdown; charset=utf-8');
        reply.header('Content-Disposition', `attachment; filename="conversacion-${conversationId.slice(0, 8)}.md"`);
        return reply.send(md);
      }

      // JSON format
      return reply.send({
        success: true,
        data: { conversation: conv, messages, exportedAt: new Date().toISOString() },
      });
    } catch (error: any) {
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  // ============================================================
  // PHASE 5: MULTI-AGENT SYSTEM
  // ============================================================

  app.get('/agents', async (req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      success: true,
      data: Object.values(AGENTS).map(a => ({
        id: a.id,
        name: a.name,
        icon: a.icon,
        color: a.color,
        specialization: a.specialization,
        capabilities: a.capabilities,
      }))
    });
  });

  app.post('/agents/route', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { query } = req.body as any;
      if (!query) return reply.code(400).send({ error: 'Se requiere query' });

      const routing = agentRouter.routeQuery(query);
      const badges = agentRouter.getAgentBadges(routing);

      return reply.send({ success: true, data: { routing, badges } });
    } catch (error: any) {
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  // ============================================================
  // PHASE 5: CROSS-MODULE CORRELATIONS
  // ============================================================

  app.get('/correlations', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

      const insights = await correlationEngine.detectCorrelations(tenantId);
      return reply.send({ success: true, data: insights });
    } catch (error: any) {
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  // ============================================================
  // PHASE 5: ANOMALY DETECTION
  // ============================================================

  app.get('/anomalies', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

      const anomalies = await anomalyDetector.detectAnomalies(tenantId);
      return reply.send({ success: true, data: anomalies });
    } catch (error: any) {
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  // ============================================================
  // PHASE 5: ENTERPRISE EVENT ENGINE
  // ============================================================

  app.get('/events', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

      const { limit, types, since } = req.query as any;
      const events = await eventEngine.getRecentEvents(tenantId, {
        limit: parseInt(limit) || 50,
        types: types ? types.split(',') : undefined,
        since: since ? new Date(since) : undefined,
      });

      return reply.send({ success: true, data: events });
    } catch (error: any) {
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  app.get('/events/stats', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

      const stats = await eventEngine.getEventStats(tenantId);
      return reply.send({ success: true, data: stats });
    } catch (error: any) {
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  app.post('/events', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      const userId = (req as any).auth?.userId || (req as any).db?.userId || 'system';

      const body = req.body as any;
      const eventId = await eventEngine.publish({
        type: body.type,
        tenantId,
        userId,
        module: body.module || 'system',
        severity: body.severity || 'info',
        title: body.title,
        description: body.description || '',
        entityId: body.entityId,
        entityType: body.entityType,
        metadata: body.metadata,
        timestamp: new Date()
      });

      return reply.send({ success: true, data: { eventId } });
    } catch (error: any) {
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  // ============================================================
  // PHASE 5: DIGITAL TWIN DATA
  // ============================================================

  app.get('/digital-twin', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

      const db = app.prisma as any;

      // Gather data from all modules to build org graph
      const [vehicles, employees, projects, ncrs, risks] = await Promise.allSettled([
        db.vehiculo?.findMany({ where: { tenantId }, select: { id: true, status: true, tipo: true, marca: true, dominio: true } }) || [],
        db.employee?.findMany({ where: { tenantId, deletedAt: null }, select: { id: true, department: true, position: true, status: true } }) || [],
        db.project360?.findMany({ where: { tenantId, deletedAt: null }, select: { id: true, name: true, status: true, progress: true } }) || [],
        (db.nonConformityReport || db.ncr || db.nonConformity)?.findMany({ where: { tenantId }, select: { id: true, status: true, severity: true }, take: 50 }) || [],
        db.risk?.findMany({ where: { tenantId }, select: { id: true, title: true, level: true }, take: 30 }) || [],
      ]);

      // Build nodes and edges for digital twin
      const nodes: any[] = [];
      const edges: any[] = [];

      // Central node
      nodes.push({ id: 'org', type: 'organization', label: 'Organización', status: 'active', x: 400, y: 300, data: {} });

      // Module nodes
      const moduleConfigs = [
        { id: 'fleet', label: 'Flota', color: '#f59e0b', count: (vehicles as any).value?.length || 0 },
        { id: 'hr', label: 'RRHH', color: '#ec4899', count: (employees as any).value?.length || 0 },
        { id: 'projects', label: 'Proyectos', color: '#06b6d4', count: (projects as any).value?.length || 0 },
        { id: 'quality', label: 'Calidad', color: '#84cc16', count: (ncrs as any).value?.length || 0 },
        { id: 'risks', label: 'Riesgos', color: '#ef4444', count: (risks as any).value?.length || 0 },
      ];

      const angleStep = (2 * Math.PI) / moduleConfigs.length;
      moduleConfigs.forEach((mod, i) => {
        const x = 400 + Math.cos(i * angleStep) * 200;
        const y = 300 + Math.sin(i * angleStep) * 200;
        nodes.push({ id: mod.id, type: 'module', label: mod.label, color: mod.color, count: mod.count, x, y, data: {} });
        edges.push({ source: 'org', target: mod.id, type: 'contains' });
      });

      // Add correlations as edges
      const correlations = await correlationEngine.detectCorrelations(tenantId);
      for (const insight of correlations) {
        for (const corr of insight.correlations) {
          const sourceModule = corr.source.module === 'maintenance' ? 'fleet' : corr.source.module === 'inspections' ? 'fleet' : corr.source.module;
          const targetModule = corr.target.module === 'operations' ? 'projects' : corr.target.module;
          if (nodes.find(n => n.id === sourceModule) && nodes.find(n => n.id === targetModule)) {
            edges.push({
              source: sourceModule,
              target: targetModule,
              type: corr.type,
              strength: corr.strength,
              label: insight.title,
              severity: insight.severity,
            });
          }
        }
      }

      // Department breakdown for HR
      if ((employees as any).value?.length > 0) {
        const depts: Record<string, number> = {};
        ((employees as any).value || []).forEach((e: any) => { depts[e.department || 'General'] = (depts[e.department || 'General'] || 0) + 1; });
        Object.entries(depts).slice(0, 8).forEach(([dept, count], i) => {
          nodes.push({ id: `dept-${i}`, type: 'department', label: dept, count, color: '#ec4899', x: 0, y: 0, data: {} });
          edges.push({ source: 'hr', target: `dept-${i}`, type: 'contains' });
        });
      }

      return reply.send({
        success: true,
        data: { nodes, edges, correlations, anomalies: await anomalyDetector.detectAnomalies(tenantId) }
      });
    } catch (error: any) {
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  // ============================================================
  // PHASE 5: EXPLAINABILITY (XAI)
  // ============================================================

  app.post('/explain', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

      const { query } = req.body as any;
      if (!query) return reply.code(400).send({ error: 'Se requiere query' });

      // Route to agents
      const routing = agentRouter.routeQuery(query);
      const badges = agentRouter.getAgentBadges(routing);

      // Get correlations and anomalies
      const [correlations, anomalies] = await Promise.all([
        correlationEngine.detectCorrelations(tenantId),
        anomalyDetector.detectAnomalies(tenantId),
      ]);

      // Build explanation
      const explanation = {
        agents: badges,
        routing,
        correlations: correlations.slice(0, 5),
        anomalies: anomalies.slice(0, 5),
        dataSources: routing.supportingAgents.map(a => AGENTS[a]?.specialization || a),
        reasoning: [
          `Agente principal: ${AGENTS[routing.primaryAgent]?.name} (confianza: ${(routing.confidence * 100).toFixed(0)}%)`,
          routing.supportingAgents.length > 0 ? `Agentes de soporte: ${routing.supportingAgents.map(a => AGENTS[a]?.name).join(', ')}` : null,
          correlations.length > 0 ? `Se detectaron ${correlations.length} correlaciones cross-module` : null,
          anomalies.length > 0 ? `Se detectaron ${anomalies.length} anomalías operativas` : null,
        ].filter(Boolean),
      };

      return reply.send({ success: true, data: explanation });
    } catch (error: any) {
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  // ============================================================
  // PHASE 5: EXECUTIVE AI REPORTS
  // ============================================================

  app.get('/executive-report', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

      const { period, format } = req.query as any;
      const report = await executiveReports.generateReport(tenantId, { period });

      if (format === 'download') {
        reply.header('Content-Type', 'text/markdown; charset=utf-8');
        reply.header('Content-Disposition', `attachment; filename="reporte-ejecutivo-${new Date().toISOString().slice(0, 10)}.md"`);
        return reply.send(report.content);
      }

      return reply.send({ success: true, data: report });
    } catch (error: any) {
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  // ============================================================
  // PHASE 5: CONTEXTUAL KPI PANEL
  // ============================================================

  app.get('/contextual-kpis', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

      const { context } = req.query as any;
      const db = app.prisma as any;

      // Debug: check available models
      console.log('[ContextualKPIs] Available db models:', Object.keys(db).filter(k => !k.startsWith('_')).slice(0, 20));
      
      // Gather data in parallel
      const [vehicles, ncrs, projects, employees, capas, recentActions] = await Promise.allSettled([
        db.vehiculo?.findMany({ where: { tenantId }, select: { status: true } }),
        (db.nonConformityReport || db.ncr || db.nonConformity)?.findMany({ where: { tenantId }, select: { status: true, severity: true, createdAt: true }, take: 100, orderBy: { createdAt: 'desc' } }),
        db.project360?.findMany({ where: { tenantId, deletedAt: null }, select: { status: true, progress: true } }),
        db.employee?.findMany({ where: { tenantId, deletedAt: null }, select: { status: true } }),
        (db.capa || db.correctiveAction)?.findMany({ where: { tenantId }, select: { status: true, dueDate: true }, take: 50 }),
        db.notification?.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' }, take: 10, select: { title: true, type: true, createdAt: true, metadata: true } }),
      ]);

      console.log('[ContextualKPIs] vehicles result:', vehicles);
      console.log('[ContextualKPIs] db.vehiculo exists:', !!db.vehiculo);

      const vList = vehicles.status === 'fulfilled' ? (vehicles.value || []) : [];
      console.log('[ContextualKPIs] vList length:', vList.length);
      const nList = ncrs.status === 'fulfilled' ? ncrs.value || [] : [];
      const pList = projects.status === 'fulfilled' ? projects.value || [] : [];
      const eList = employees.status === 'fulfilled' ? employees.value || [] : [];
      const cList = capas.status === 'fulfilled' ? capas.value || [] : [];
      const aList = recentActions.status === 'fulfilled' ? recentActions.value || [] : [];

      // Calculate gauges
      const gauges: any[] = [];
      const kpis: any[] = [];

      // Fleet availability — status can be 'ACTIVO' or 'OPERATIVO'
      if (vList.length > 0) {
        const operative = vList.filter((v: any) => 
          v.status === 'ACTIVO' || v.status === 'OPERATIVO'
        ).length;
        const availability = Math.round((operative / vList.length) * 100);
        gauges.push({ value: availability, max: 100, label: 'Disponibilidad Flota', color: availability < 75 ? 'risk' : 'good' });
        kpis.push({ title: 'Vehículos Operativos', value: `${operative}/${vList.length}`, trend: availability >= 85 ? 'up' : 'down', trendValue: `${availability}%`, icon: 'truck', color: '#f59e0b' });
      }

      // Quality NCR rate
      if (nList.length > 0) {
        const open = nList.filter((n: any) => n.status !== 'CLOSED').length;
        const openRate = Math.round((open / Math.max(nList.length, 1)) * 100);
        gauges.push({ value: openRate, max: 100, label: 'NCRs Abiertas', color: 'risk' });
        kpis.push({ title: 'NCRs Abiertas', value: open, trend: open > 5 ? 'up' : 'stable', trendValue: open > 5 ? 'Alto' : 'Normal', icon: 'shield', color: '#ef4444' });
      }

      // Project progress
      if (pList.length > 0) {
        const active = pList.filter((p: any) => !['COMPLETED', 'CANCELLED'].includes(p.status));
        const avgProg = active.length > 0 ? Math.round(active.reduce((s: number, p: any) => s + (p.progress || 0), 0) / active.length) : 0;
        gauges.push({ value: avgProg, max: 100, label: 'Progreso Proyectos', color: 'good' });
        kpis.push({ title: 'Proyectos Activos', value: active.length, trend: avgProg >= 50 ? 'up' : 'down', trendValue: `${avgProg}%`, icon: 'kanban', color: '#06b6d4' });
      }

      // CAPAs overdue
      if (cList.length > 0) {
        const overdue = cList.filter((c: any) => c.dueDate && new Date(c.dueDate) < new Date() && c.status !== 'CLOSED').length;
        kpis.push({ title: 'CAPAs Vencidas', value: overdue, trend: overdue > 0 ? 'down' : 'stable', trendValue: overdue > 0 ? 'Atención' : 'OK', icon: 'zap', color: '#eab308' });
      }

      // HR headcount
      if (eList.length > 0) {
        const active = eList.filter((e: any) => e.status === 'ACTIVO').length;
        kpis.push({ title: 'Dotación Activa', value: active, trend: 'stable', icon: 'users', color: '#ec4899' });
      }

      // Activity feed from notifications
      const activities: any[] = aList.map((n: any) => {
        const elapsed = Date.now() - new Date(n.createdAt).getTime();
        const mins = Math.floor(elapsed / 60000);
        let time = '';
        if (mins < 60) time = `Hace ${mins} min`;
        else if (mins < 1440) time = `Hace ${Math.floor(mins / 60)} h`;
        else time = `Hace ${Math.floor(mins / 1440)} d`;

        let type = 'activity';
        const title = n.title || 'Actividad';
        if (title.toLowerCase().includes('ncr')) type = 'ncr';
        else if (title.toLowerCase().includes('audit')) type = 'audit';
        else if (title.toLowerCase().includes('capa')) type = 'capa';
        else if (title.toLowerCase().includes('flota') || title.toLowerCase().includes('vehículo')) type = 'fleet';
        else if (title.toLowerCase().includes('proyecto')) type = 'project';
        else if (title.toLowerCase().includes('alerta') || title.toLowerCase().includes('alert')) type = 'alert';

        return { title, time, type, severity: n.metadata?.severity };
      });

      // If no notifications, generate activity from recent NCRs
      if (activities.length === 0 && nList.length > 0) {
        const recent = nList.slice(0, 5);
        recent.forEach((n: any) => {
          const elapsed = Date.now() - new Date(n.createdAt).getTime();
          const mins = Math.floor(elapsed / 60000);
          let time = '';
          if (mins < 60) time = `Hace ${mins} min`;
          else if (mins < 1440) time = `Hace ${Math.floor(mins / 60)} h`;
          else time = `Hace ${Math.floor(mins / 1440)} d`;
          activities.push({ title: `NCR ${n.status === 'CLOSED' ? 'cerrada' : 'abierta'}`, time, type: 'ncr', severity: n.severity?.toLowerCase() });
        });
      }

      console.log('[ContextualKPIs] Final gauges:', gauges.length, 'kpis:', kpis.length);

      const vehicleStatusCounts = vList.reduce((acc: any, v: any) => {
        acc[v.status] = (acc[v.status] || 0) + 1;
        return acc;
      }, {});

      return reply.send({
        success: true,
        data: { 
          gauges, 
          kpis, 
          activities,
          debug: {  // <-- moved inside data (no underscore)
            vehicleCount: vList.length,
            vehicleStatusCounts,
            tenantId,
            vListSample: vList.slice(0, 3), // first 3 vehicles for inspection
          }
        },
      });
    } catch (error: any) {
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  // ============================================================
  // PHASE 6: AUTONOMOUS AI ORCHESTRATION
  // ============================================================

  app.get('/autonomous/status', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

      const { autonomousOrchestrator } = await import('../services/autonomous-orchestrator.js');
      const status = autonomousOrchestrator?.getStatus(tenantId);

      return reply.send({
        success: true,
        data: {
          orchestratorRunning: status?.running || false,
          rulesActive: status?.rules || 0,
          tenantId,
        },
      });
    } catch (error: any) {
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  app.post('/autonomous/trigger/:ruleId', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

      const { ruleId } = req.params as any;
      const { autonomousOrchestrator } = await import('../services/autonomous-orchestrator.js');
      
      const result = await autonomousOrchestrator?.manualEvaluate(ruleId, tenantId);

      return reply.send({ success: true, data: result });
    } catch (error: any) {
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  // ============================================================
  // PHASE 6: AI PRIORITY ENGINE
  // ============================================================

  app.get('/priorities', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

      const { aiPriorityEngine } = await import('../services/ai-priority-engine.js');
      const priorities = await aiPriorityEngine?.calculateAllPriorities(tenantId);

      return reply.send({
        success: true,
        data: {
          priorities,
          generatedAt: new Date(),
        },
      });
    } catch (error: any) {
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  app.get('/priorities/top', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

      const { query } = req.query as any;
      const limit = parseInt(query?.limit || '10', 10);

      const { aiPriorityEngine } = await import('../services/ai-priority-engine.js');
      const priorities = await aiPriorityEngine?.getTopPriorities(tenantId, limit);

      return reply.send({
        success: true,
        data: { priorities },
      });
    } catch (error: any) {
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  // ============================================================
  // PHASE 6: AI WORKFORCE
  // ============================================================

  app.get('/workforce/agents', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { aiWorkforce } = await import('../services/ai-workforce/index.js');
      const statuses = aiWorkforce?.getAllAgentStatuses() || [];

      return reply.send({
        success: true,
        data: { agents: statuses },
      });
    } catch (error: any) {
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  app.get('/workforce/activity', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { query } = req.query as any;
      const limit = parseInt(query?.limit || '50', 10);
      const agentType = query?.agentType;

      const { aiWorkforce } = await import('../services/ai-workforce/index.js');
      const activity = aiWorkforce?.getActivityLog(limit, agentType) || [];

      return reply.send({
        success: true,
        data: { activity },
      });
    } catch (error: any) {
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  app.get('/workforce/stats', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { aiWorkforce } = await import('../services/ai-workforce/index.js');
      const stats = aiWorkforce?.getStatistics();

      return reply.send({
        success: true,
        data: { stats },
      });
    } catch (error: any) {
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  app.post('/workforce/trigger/:agentType', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

      const { agentType } = req.params as any;
      const { taskType, payload, priority } = req.body as any;

      const { aiWorkforce } = await import('../services/ai-workforce/index.js');
      const taskId = await aiWorkforce?.triggerAgent(
        agentType,
        taskType,
        payload || {},
        tenantId,
        priority || 'medium'
      );

      return reply.send({
        success: true,
        data: { taskId },
      });
    } catch (error: any) {
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  // ============================================================
  // PHASE 6: BUSINESS SIMULATION
  // ============================================================

  app.post('/simulate', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

      const { scenario, parameters } = req.body as any;

      // Use simulation agent
      const { aiWorkforce } = await import('../services/ai-workforce/index.js');
      const result = await aiWorkforce?.triggerAgent(
        'SIMULATION',
        'SIMULATE_SCENARIO',
        { scenario, parameters },
        tenantId,
        'medium'
      );

      return reply.send({
        success: true,
        data: { simulationId: result },
      });
    } catch (error: any) {
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  // ============================================================
  // PHASE 7: COGNITIVE ENTERPRISE
  // ============================================================

  app.get('/learning/analysis', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

      const { period } = req.query as any;

      const { organizationalLearningEngine } = await import('../services/organizational-learning.js');
      const analysis = await organizationalLearningEngine?.analyze(tenantId, period || '30d');

      return reply.send({
        success: true,
        data: analysis,
      });
    } catch (error: any) {
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  app.get('/intelligence-graph', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

      const { operationalIntelligenceGraph } = await import('../services/operational-intelligence-graph.js');
      const graph = await operationalIntelligenceGraph?.buildGraph(tenantId);

      return reply.send({
        success: true,
        data: graph,
      });
    } catch (error: any) {
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  app.get('/intelligence-graph/entity/:entityId', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

      const { entityId } = req.params as any;
      const { operationalIntelligenceGraph } = await import('../services/operational-intelligence-graph.js');
      const relations = await operationalIntelligenceGraph?.getEntityRelations(tenantId, entityId);

      return reply.send({
        success: true,
        data: relations,
      });
    } catch (error: any) {
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  app.get('/intelligence-graph/influential', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

      const { limit } = req.query as any;

      const { operationalIntelligenceGraph } = await import('../services/operational-intelligence-graph.js');
      const entities = await operationalIntelligenceGraph?.findInfluentialEntities(tenantId, parseInt(limit || '10', 10));

      return reply.send({
        success: true,
        data: { entities },
      });
    } catch (error: any) {
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  // ============================================================
  // PHASE 8: AUTONOMOUS COMPLIANCE & AI-NATIVE ORGANIZATION
  // ============================================================

  app.get('/compliance/assess', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

      const { standard } = req.query as any;

      const { autonomousComplianceEngine } = await import('../services/autonomous-compliance.js');
      const assessment = await autonomousComplianceEngine?.assessCompliance(tenantId, standard || 'ISO_9001');

      return reply.send({
        success: true,
        data: assessment,
      });
    } catch (error: any) {
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  app.get('/compliance/gaps', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

      const { standard, severity, status } = req.query as any;

      const { autonomousComplianceEngine } = await import('../services/autonomous-compliance.js');
      const gaps = await autonomousComplianceEngine?.getGaps(tenantId, { standard, severity, status });

      return reply.send({
        success: true,
        data: { gaps },
      });
    } catch (error: any) {
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  app.post('/compliance/gaps/auto-fix', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

      const { autonomousComplianceEngine } = await import('../services/autonomous-compliance.js');
      const result = await autonomousComplianceEngine?.autoFixGaps(tenantId);

      return reply.send({
        success: true,
        data: result,
      });
    } catch (error: any) {
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  app.get('/compliance/report', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

      const { autonomousComplianceEngine } = await import('../services/autonomous-compliance.js');
      const report = await autonomousComplianceEngine?.generateReport(tenantId);

      return reply.send({
        success: true,
        data: report,
      });
    } catch (error: any) {
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  // ============================================================
  // PHASE 8: GLOBAL ENTERPRISE DASHBOARD
  // ============================================================

  app.get('/enterprise-dashboard', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

      const db = app.prisma as any;

      // Gather all enterprise data in parallel
      const [
        fleetStats,
        qualityStats,
        projectStats,
        riskStats,
        auditStats,
        workforceStats,
        complianceScore,
      ] = await Promise.allSettled([
        getFleetStats(db, tenantId),
        getQualityStats(db, tenantId),
        getProjectStats(db, tenantId),
        getRiskStats(db, tenantId),
        getAuditStats(db, tenantId),
        getWorkforceStats(db, tenantId),
        (async () => {
          const { autonomousComplianceEngine } = await import('../services/autonomous-compliance.js');
          return await autonomousComplianceEngine?.assessCompliance(tenantId, 'ISO_9001');
        })(),
      ]);

      const dashboard = {
        generatedAt: new Date(),
        organizationalHealth: {
          status: calculateHealthStatus(fleetStats, qualityStats, riskStats),
          score: calculateHealthScore(fleetStats, qualityStats, riskStats, complianceScore),
        },
        modules: {
          fleet: fleetStats.status === 'fulfilled' ? fleetStats.value : null,
          quality: qualityStats.status === 'fulfilled' ? qualityStats.value : null,
          projects: projectStats.status === 'fulfilled' ? projectStats.value : null,
          risks: riskStats.status === 'fulfilled' ? riskStats.value : null,
          audits: auditStats.status === 'fulfilled' ? auditStats.value : null,
          workforce: workforceStats.status === 'fulfilled' ? workforceStats.value : null,
        },
        compliance: complianceScore.status === 'fulfilled' ? complianceScore.value : null,
        activeAgents: 7, // AI Workforce agents
        pendingDecisions: (complianceScore.status === 'fulfilled' ? complianceScore.value?.gaps?.length || 0 : 0) +
                         (riskStats.status === 'fulfilled' ? riskStats.value?.critical || 0 : 0),
      };

      return reply.send({
        success: true,
        data: dashboard,
      });
    } catch (error: any) {
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

}

// ============================================================
// DASHBOARD HELPER METHODS
// ============================================================

async function getFleetStats(db: any, tenantId: string): Promise<any> {
  const vehicles = await db.vehiculo?.findMany?.({
    where: { tenantId },
    select: { status: true },
  }) || [];
  
  const operative = vehicles.filter((v: any) => v.status === 'ACTIVO' || v.status === 'OPERATIVO').length;
  return {
    total: vehicles.length,
    operative,
    availability: vehicles.length > 0 ? operative / vehicles.length : 1,
  };
}

async function getQualityStats(db: any, tenantId: string): Promise<any> {
  const [ncrs, capas] = await Promise.all([
    (db.nonConformityReport || db.ncr)?.count?.({ where: { tenantId, status: { not: 'CLOSED' } } }) || 0,
    (db.capa || db.correctiveAction)?.count?.({ where: { tenantId, status: { not: 'CLOSED' } } }) || 0,
  ]);
  return { ncrsOpen: ncrs, capasOpen: capas };
}

async function getProjectStats(db: any, tenantId: string): Promise<any> {
  const projects = await db.project360?.findMany?.({
    where: { tenantId, deletedAt: null },
    select: { status: true },
  }) || [];
  return {
    total: projects.length,
    atRisk: projects.filter((p: any) => p.status === 'AT_RISK').length,
    completed: projects.filter((p: any) => p.status === 'COMPLETED').length,
  };
}

async function getRiskStats(db: any, tenantId: string): Promise<any> {
  const risks = await db.risk?.findMany?.({
    where: { tenantId, status: { not: 'CLOSED' } },
    select: { level: true },
  }) || [];
  return {
    total: risks.length,
    critical: risks.filter((r: any) => r.level === 'CRITICAL').length,
    high: risks.filter((r: any) => r.level === 'HIGH').length,
  };
}

async function getAuditStats(db: any, tenantId: string): Promise<any> {
  const [upcoming, overdue] = await Promise.all([
    db.audit?.count?.({ where: { tenantId, plannedDate: { gte: new Date() } } }) || 0,
    db.audit?.count?.({ where: { tenantId, plannedDate: { lt: new Date() }, status: { not: 'COMPLETED' } } }) || 0,
  ]);
  return { upcoming, overdue };
}

async function getWorkforceStats(db: any, tenantId: string): Promise<any> {
  const employees = await db.employee?.count?.({ where: { tenantId, deletedAt: null, status: 'ACTIVO' } }) || 0;
  return { activeEmployees: employees };
}

function calculateHealthStatus(fleet: any, quality: any, risk: any): string {
  if (fleet.status === 'rejected' || risk.status === 'rejected') return 'AT_RISK';
  if (fleet.status === 'fulfilled' && fleet.value?.availability < 0.7) return 'WARNING';
  if (risk.status === 'fulfilled' && risk.value?.critical > 0) return 'WARNING';
  return 'HEALTHY';
}

function calculateHealthScore(fleet: any, quality: any, risk: any, compliance: any): number {
  let score = 100;
  
  if (fleet.status === 'fulfilled') {
    score -= Math.max(0, (1 - fleet.value.availability) * 30);
  }
  if (quality.status === 'fulfilled') {
    score -= Math.min(20, quality.value.ncrsOpen * 2);
  }
  if (risk.status === 'fulfilled') {
    score -= risk.value.critical * 10;
    score -= risk.value.high * 5;
  }
  if (compliance.status === 'fulfilled') {
    score = (score + compliance.value.score) / 2;
  }
  
  return Math.max(0, Math.min(100, Math.round(score)));
}


