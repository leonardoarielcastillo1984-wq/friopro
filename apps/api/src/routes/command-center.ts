/**
 * COMMAND CENTER ROUTES
 * SGI360 Executive Intelligence API
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createAIOrchestrator, AIResponse } from '../services/ai-orchestrator.js';
import { getEffectiveTenantId } from '../utils/tenant-bypass.js';
import { PrismaClient } from '@prisma/client';

// Extender FastifyInstance
declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

export async function commandCenterRoutes(app: FastifyInstance) {
  const orchestrator = createAIOrchestrator(app.prisma, app);

  // ============================================================
  // HEALTH CHECK
  // ============================================================
  app.get('/health', async (req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ 
      status: 'ok', 
      service: 'command-center',
      timestamp: new Date().toISOString()
    });
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

      const userId = (req as any).db?.userId || 'anonymous';
      const userRole = (req as any).db?.role || 'user';

      // Si es streaming, manejar diferente
      if (stream) {
        return handleStreamingQuery(req, reply, orchestrator, query, tenantId, userId, userRole, conversationId);
      }

      // Procesar consulta normal
      const result = await orchestrator.processQuery(
        query,
        tenantId,
        userId,
        userRole,
        conversationId
      );

      return reply.send({
        success: true,
        data: result,
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
  // VOZ - Speech to Text (placeholder)
  // ============================================================
  app.post('/voice', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) {
        return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      }

      // TODO: Implementar integración con Whisper/OpenAI STT
      // Por ahora, retornar mensaje informativo

      return reply.send({
        success: true,
        message: 'Voice processing endpoint ready',
        note: 'Speech-to-text integration pending',
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      return reply.code(500).send({ error: error.message });
    }
  });

  // ============================================================
  // KPIs EJECUTIVOS
  // ============================================================
  app.get('/kpis', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) {
        return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      }

      const kpis = await orchestrator.getExecutiveKPIs(tenantId);

      return reply.send({
        success: true,
        data: kpis,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      app.log.error('[Command Center] KPIs error:', error);
      return reply.code(500).send({ error: error.message });
    }
  });

  // ============================================================
  // ALERTAS PROACTIVAS
  // ============================================================
  app.get('/alerts', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) {
        return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      }

      const alerts = await orchestrator.generateProactiveAlerts(tenantId);

      return reply.send({
        success: true,
        data: alerts,
        count: alerts.length,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      app.log.error('[Command Center] Alerts error:', error);
      return reply.code(500).send({ error: error.message });
    }
  });

  // ============================================================
  // ESTADO DE SUSCRIPCIÓN AI
  // ============================================================
  app.get('/subscription', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) {
        return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      }

      const subscription = await orchestrator.getAISubscription(tenantId);

      return reply.send({
        success: true,
        data: subscription,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      app.log.error('[Command Center] Subscription error:', error);
      return reply.code(500).send({ error: error.message });
    }
  });

  // ============================================================
  // HISTORIAL DE CONVERSACIONES
  // ============================================================
  app.get('/conversations', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) {
        return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      }

      const userId = (req as any).db?.userId;

      // TODO: Implementar cuando exista el modelo AIConversation
      return reply.send({
        success: true,
        data: [],
        message: 'Conversations feature pending',
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      return reply.code(500).send({ error: error.message });
    }
  });

  // ============================================================
  // CREAR NUEVA CONVERSACIÓN
  // ============================================================
  app.post('/conversations', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) {
        return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      }

      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body as any;
      const { title = 'Nueva conversación' } = body;

      // TODO: Implementar cuando exista el modelo AIConversation
      const conversationId = `conv_${Date.now()}`;

      return reply.code(201).send({
        success: true,
        data: {
          id: conversationId,
          title,
          createdAt: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      return reply.code(500).send({ error: error.message });
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
}
