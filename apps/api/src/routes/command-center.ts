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

      return reply.send({
        success: true,
        data: result,
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
  // STREAMING - Chat realtime
  // ============================================================
  async function handleStreamingQuery(
    req: FastifyRequest,
    reply: FastifyReply,
    orchestrator: any,
    query: string,
    tenantId: string,
    userId: string,
    userRole: string,
    conversationId?: string
  ) {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    try {
      // Enviar evento de inicio
      reply.raw.write(`data: ${JSON.stringify({ type: 'start' })}\n\n`);

      // Procesar consulta
      const result = await orchestrator.processQuery(
        query,
        tenantId,
        userId,
        userRole,
        conversationId
      );

      // Stream de la respuesta por chunks
      const chunks = result.summary.match(/.{1,50}/g) || [result.summary];
      for (const chunk of chunks) {
        reply.raw.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
        await new Promise(r => setTimeout(r, 50)); // Simular typing
      }

      // Evento final con metadata
      reply.raw.write(`data: ${JSON.stringify({ 
        type: 'complete', 
        widgets: result.widgets,
        actions: result.actions,
        provider: result.provider,
        tokensUsed: result.tokensUsed
      })}\n\n`);

      reply.raw.end();

    } catch (error: any) {
      reply.raw.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
      reply.raw.end();
    }
  }

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

}
