/**
 * AI ORCHESTRATOR SERVICE
 * SGI360 Command Center - Executive Intelligence
 * 
 * Responsabilidades:
 * - Interpretar intención del usuario
 * - Detectar complejidad y enrutar a IA correcta (Groq vs OpenAI)
 * - Consultar módulos SGI360
 * - Construir contexto
 * - Generar prompts
 * - Renderizar widgets dinámicos
 * - Ejecutar acciones
 * - Registrar consumo IA
 * - Validar permisos
 * - Controlar límites del tenant
 */

import { FastifyInstance, FastifyRequest } from 'fastify';
import { PrismaClient } from '@prisma/client';
import Groq from 'groq-sdk';
import OpenAI from 'openai';
import { AIToolsEngine } from './ai-tools-engine.js';

// ============================================================
// TIPOS Y INTERFACES
// ============================================================

export type AIProvider = 'groq' | 'openai';

export interface AIResponse {
  summary: string;
  widgets?: AIWidget[];
  charts?: AIChart[];
  alerts?: AIAlert[];
  actions?: AIAction[];
  data?: any;
  metadata?: any;
  provider: AIProvider;
  tokensUsed: number;
  cost: number;
}

export interface AIWidget {
  type: 'kpi' | 'table' | 'alert' | 'info' | 'progress' | 'status';
  title: string;
  data: any;
  config?: Record<string, any>;
}

export interface AIChart {
  type: 'line' | 'bar' | 'pie' | 'radar' | 'heatmap';
  title: string;
  data: any[];
  xAxis?: string;
  yAxis?: string;
  series?: string[];
}

export interface AIAlert {
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  message: string;
  module?: string;
  entityId?: string;
  action?: string;
}

export interface AIAction {
  type: string;
  label: string;
  icon?: string;
  route?: string;
  payload?: any;
  requiresConfirmation?: boolean;
}

export interface QueryContext {
  tenantId: string;
  userId: string;
  userRole: string;
  intent: QueryIntent;
  complexity: 'low' | 'medium' | 'high';
  modules: string[];
  entities: string[];
  timeRange?: { start: Date; end: Date };
  filters?: Record<string, any>;
}

export interface QueryIntent {
  category: 'dashboard' | 'analysis' | 'action' | 'comparison' | 'forecast' | 'risk' | 'kpi' | 'navigation';
  action?: string;
  target?: string;
  parameters?: Record<string, any>;
}

export interface AISubscription {
  plan: 'STARTER_AI' | 'BUSINESS_AI' | 'ENTERPRISE_AI' | null;
  status: 'active' | 'inactive' | 'suspended';
  premiumQueriesLimit: number;
  premiumQueriesUsed: number;
  premiumQueriesRemaining: number;
  groqEnabled: boolean;
  openaiEnabled: boolean;
  resetDate: Date;
}

// ============================================================
// CONFIGURACIÓN
// ============================================================

const AI_CONFIG = {
  groq: {
    model: 'llama-3.3-70b-versatile',
    apiUrl: 'https://api.groq.com/openai/v1/chat/completions',
    maxTokens: 4096,
    temperature: 0.7,
    costPer1KTokens: 0.0005, // $0.50 por 1M tokens
  },
  openai: {
    model: 'gpt-4.1',
    apiUrl: 'https://api.openai.com/v1/chat/completions',
    maxTokens: 8192,
    temperature: 0.7,
    costPer1KTokens: 0.03, // $30 por 1M tokens input
  }
};

const PLAN_LIMITS = {
  STARTER_AI: {
    premiumQueriesPerMonth: 30,
    groqUnlimited: true,
    features: ['basic_analysis', 'kpi_dashboard', 'simple_forecast']
  },
  BUSINESS_AI: {
    premiumQueriesPerMonth: 150,
    groqUnlimited: true,
    features: ['advanced_analysis', 'strategic_insights', 'complex_simulations', 'contract_analysis']
  },
  ENTERPRISE_AI: {
    premiumQueriesPerMonth: -1, // Ilimitado
    groqUnlimited: true,
    features: ['all_features', 'custom_models', 'priority_support', 'dedicated_resources']
  }
};

// ============================================================
// PROMPTS DEL SISTEMA
// ============================================================

// ── Multi-agent specialized prompts ──────────────────────────
const AGENT_SPECIALIZATIONS: Record<string, string> = {
  quality: `Eres el AGENTE DE CALIDAD de SGI360. Especializado en:
- No Conformidades (NCR): análisis de tendencias, severidades, tiempos de resolución
- Acciones Correctivas (CAPA): efectividad, causa raíz, seguimiento
- Auditorías: hallazgos, cumplimiento normativo ISO 9001/14001/45001
- Documentos: control documental, vencimientos, revisiones pendientes
Detecta patrones de calidad, recomienda acciones preventivas, identifica riesgos de incumplimiento.`,

  projects: `Eres el AGENTE DE PROYECTOS de SGI360. Especializado en:
- Gestión de proyectos: avance, cronograma, presupuesto, recursos
- Análisis de riesgo de proyectos: sobrecosto, atrasos, dependencias
- Hitos y entregables: cumplimiento, desvíos, impacto
Analiza el portafolio completo, detecta proyectos críticos, sugiere re-priorización.`,

  fleet: `Eres el AGENTE DE FLOTA de SGI360. Especializado en:
- Gestión de vehículos: estado operativo, mantenimientos, costos
- Mantenimiento preventivo: vencimientos, KM pendientes
- Indicadores de flota: disponibilidad, costo por KM, eficiencia
Detecta unidades con mantenimiento vencido, optimiza costos operativos.`,

  hr: `Eres el AGENTE DE RRHH de SGI360. Especializado en:
- Dotación de personal: departamentos, posiciones, estados
- Capacitaciones: pendientes, vencidas, brechas de competencia
- Matriz de polivalencia: gaps entre nivel actual y requerido
Identifica necesidades de formación, detecta rotación, analiza distribución de personal.`,

  risk: `Eres el AGENTE DE RIESGOS de SGI360. Especializado en:
- Mapa de riesgos: niveles, probabilidades, impactos
- Riesgos no mitigados: planes de acción pendientes
- Análisis de tendencias: evolución de riesgos
Prioriza riesgos por severidad, recomienda controles, identifica riesgos emergentes.`,
};

const SYSTEM_PROMPTS = {
  groq: `Eres SGI360 AI, el asistente ejecutivo inteligente de SGI360.
Tu rol es ayudar a directivos y gerentes a tomar decisiones empresariales informadas.

REGLA CRÍTICA — NUNCA INVENTAR DATOS:
- SOLO puedes usar los datos que se te proveen en el campo "Datos del sistema" de cada consulta.
- Si no hay datos para un módulo, responde: "No hay datos disponibles en el sistema para este módulo."
- NUNCA inventes números, porcentajes, empleados, proyectos, vehículos ni ningún otro dato.
- Si los datos están vacíos o ausentes, dilo claramente y sugiere dónde cargarlos en SGI360.

FORMATO DE RESPUESTA:
Responde SIEMPRE en español, de forma clara y ejecutiva.
Basa TODA tu respuesta exclusivamente en los datos provistos.
Si detectas riesgos o alertas en los datos reales, destácalos.

CONTEXTO SGI360:
- Project360: gestión de proyectos completa
- Flota360: gestión de vehículos y activos
- RRHH: gestión de personas y capacitaciones
- Auditorías: compliance ISO y auditorías
- Riesgos: gestión de riesgos empresariales
- NCR/CAPA: no conformidades y acciones correctivas
- Documentos: sistema documental ISO`,

  openai: `Eres SGI360 Executive Intelligence, el asesor estratégico premium de SGI360.

TU ROL:
Analizar situaciones complejas, razonar profundamente y proporcionar recomendaciones estratégicas de alto nivel para la dirección empresarial.

CAPACIDADES AVANZADAS:
- Análisis financiero complejo y multi-escenario
- Evaluación de inversiones y ROI
- Análisis contractual y legal avanzado
- Estrategia de escalado operativo
- Simulaciones empresariales
- Análisis cruzado de módulos
- Detección de patrones y tendencias
- Predicciones y forecasting avanzado

FORMATO JSON ESTRUCTURADO:
{
  "summary": "Resumen ejecutivo de la respuesta",
  "analysis": "Análisis detallado",
  "recommendations": ["Recomendación 1", "Recomendación 2"],
  "risks": ["Riesgo identificado"],
  "opportunities": ["Oportunidad detectada"],
  "confidence": 0.85,
  "dataSources": ["Fuentes consultadas"]
}

NIVEL DE ANÁLISIS:
- Ejecutivo: alto nivel, estratégico
- Detallado: con números, métricas, comparativas
- Accionable: con pasos específicos a seguir
- Preventivo: anticipando problemas antes de que ocurran`
};

// ============================================================
// CLASE PRINCIPAL: AI Orchestrator
// ============================================================

export class AIOrchestrator {
  private prisma: PrismaClient;
  private db: any;
  private app?: FastifyInstance;
  private groq: Groq;
  private openai: OpenAI;
  public toolsEngine: AIToolsEngine;

  constructor(prisma: PrismaClient, app?: FastifyInstance) {
    this.prisma = prisma;
    this.db = prisma as any;
    this.app = app;
    this.toolsEngine = new AIToolsEngine(prisma, app);
    
    // Inicializar clientes IA
    this.groq = new Groq({
      apiKey: process.env.GROQ_API_KEY || '',
    });

    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || '',
    });
  }

  // ============================================================
  // MÉTODOS PÚBLICOS
  // ============================================================

  /**
   * Procesa una consulta del usuario
   * Entry point principal del Command Center
   */
  async processQuery(
    query: string,
    tenantId: string,
    userId: string,
    userRole: string,
    conversationId?: string
  ): Promise<AIResponse> {
    try {
      // 1. Validar suscripción AI
      const subscription = await this.validateAISubscription(tenantId);
      
      // 2. Detectar si la query activa una herramienta (crear proyecto, NCR, CAPA, etc.)
      const toolIntent = this.toolsEngine.detectToolIntent(query);
      if (toolIntent) {
        const toolResult = await this.toolsEngine.executeTool(
          toolIntent.tool,
          toolIntent.params,
          tenantId,
          userId,
          userRole
        );
        // Guardar mensaje en BD y devolver resultado de la herramienta
        await this.saveConversationMessages(conversationId, query, toolResult.message, 'groq', 0, 0);
        return {
          summary: toolResult.message,
          provider: 'groq',
          tokensUsed: 0,
          cost: 0,
          metadata: { toolExecuted: toolIntent.tool, toolResult }
        };
      }

      // 3. Recuperar historial de conversación desde BD
      const conversationHistory = await this.getConversationHistory(conversationId, 10);
      
      // 4. Analizar intención y complejidad
      const context = await this.analyzeIntent(query, tenantId, userId, userRole);
      
      // 5. Seleccionar proveedor de IA
      const provider = this.selectAIProvider(context, subscription);
      
      // 6. Verificar límites de consultas premium
      if (provider === 'openai' && !this.canUsePremiumQuery(subscription)) {
        return this.buildPaywallResponse(subscription);
      }
      
      // 7. Construir contexto de datos
      const dataContext = await this.buildDataContext(context, tenantId);
      
      // 8. Generar y ejecutar consulta a IA (con historial incluido)
      const aiResult = await this.executeAIQuery(query, provider, dataContext, context, conversationHistory);
      
      // 9. Registrar uso
      await this.logAIUsage(tenantId, userId, provider, aiResult.tokensUsed, aiResult.cost, query, conversationId);
      
      // 10. Actualizar contadores si es premium
      if (provider === 'openai') {
        await this.incrementPremiumUsage(tenantId);
      }
      
      // 11. Guardar mensajes en BD (no crítico)
      await this.saveConversationMessages(conversationId, query, aiResult.summary, provider, aiResult.tokensUsed, aiResult.cost);

      // 12. Procesar acciones si las hay
      const enrichedResult = await this.processActions(aiResult, context);
      
      return enrichedResult;
      
    } catch (error: any) {
      console.error('[AI Orchestrator] Error:', error);
      return {
        summary: 'Lo siento, ocurrió un error al procesar tu consulta. Por favor intenta nuevamente.',
        provider: 'groq',
        tokensUsed: 0,
        cost: 0,
        alerts: [{
          severity: 'high',
          title: 'Error en procesamiento',
          message: error.message
        }]
      };
    }
  }

  /**
   * Recupera el historial de mensajes de una conversación desde BD
   */
  private async getConversationHistory(
    conversationId: string | undefined,
    limit: number = 10
  ): Promise<Array<{ role: string; content: string }>> {
    if (!conversationId) return [];
    try {
      const messages = await this.db.aIMessage?.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
        take: limit,
        select: { role: true, content: true }
      }) || [];
      return messages.map((m: any) => ({
        role: m.role === 'USER' ? 'user' : 'assistant',
        content: m.content
      }));
    } catch {
      return [];
    }
  }

  /**
   * Guarda mensajes de usuario y asistente en BD
   */
  private async saveConversationMessages(
    conversationId: string | undefined,
    userQuery: string,
    assistantResponse: string,
    provider: string,
    tokensUsed: number,
    cost: number
  ): Promise<void> {
    if (!conversationId) return;
    try {
      await this.db.aIMessage?.create({
        data: { conversationId, role: 'USER', content: userQuery, tokensUsed: 0, cost: 0 }
      });
      await this.db.aIMessage?.create({
        data: { conversationId, role: 'ASSISTANT', content: assistantResponse, provider: provider.toUpperCase(), tokensUsed, cost }
      });
    } catch {
      // No crítico
    }
  }

  /**
   * Procesa comandos de voz (speech-to-text)
   */
  async processVoiceCommand(
    audioData: Buffer,
    tenantId: string,
    userId: string,
    userRole: string
  ): Promise<AIResponse> {
    try {
      // Usar Whisper de OpenAI para transcribir
      const transcription = await this.openai.audio.transcriptions.create({
        file: new File([audioData], 'audio.webm', { type: 'audio/webm' }),
        model: 'whisper-1',
        language: 'es'
      });

      const transcribedText = transcription.text;
      return this.processQuery(transcribedText, tenantId, userId, userRole);
      
    } catch (error: any) {
      console.error('[AI Orchestrator] Voice transcription error:', error);
      return {
        summary: 'No se pudo transcribir el audio. Por favor intenta escribir tu consulta.',
        provider: 'groq',
        tokensUsed: 0,
        cost: 0
      };
    }
  }

  /**
   * Streaming de respuestas IA en tiempo real
   */
  async *processQueryStream(
    query: string,
    tenantId: string,
    userId: string,
    userRole: string,
    conversationId?: string
  ): AsyncGenerator<AIResponse & { done?: boolean }> {
    try {
      // Validar suscripción
      const subscription = await this.validateAISubscription(tenantId);
      
      // Analizar intención
      const context = await this.analyzeIntent(query, tenantId, userId, userRole);
      
      // Seleccionar proveedor
      const provider = this.selectAIProvider(context, subscription);
      
      // Verificar límites premium
      if (provider === 'openai' && !this.canUsePremiumQuery(subscription)) {
        yield { ...this.buildPaywallResponse(subscription), done: true };
        return;
      }
      
      // Construir contexto
      const dataContext = await this.buildDataContext(context, tenantId);
      
      // ── Multi-agent + summary injection for streaming ──
      let systemPrompt = SYSTEM_PROMPTS[provider];
      const agentKey = this.detectSpecializedAgent(context);
      if (agentKey && AGENT_SPECIALIZATIONS[agentKey]) {
        systemPrompt += `\n\nESPECIALIZACIÓN ACTIVA:\n${AGENT_SPECIALIZATIONS[agentKey]}`;
      }

      const convHistory = await this.getConversationHistory(conversationId, 10);
      if (convHistory.length > 4) {
        systemPrompt += `\n\nRESUMEN DE CONVERSACIÓN PREVIA:\n${this.buildConversationSummary(convHistory)}`;
      }

      const streamMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: systemPrompt },
        ...convHistory.slice(-6).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        { role: 'user', content: dataContext ? `Datos del sistema:\n${dataContext}\n\nConsulta: ${query}` : query },
      ];

      let fullContent = '';
      let tokensUsed = 0;
      
      if (provider === 'openai') {
        const stream = await this.openai.chat.completions.create({
          model: AI_CONFIG.openai.model,
          messages: streamMessages,
          temperature: AI_CONFIG.openai.temperature,
          max_tokens: AI_CONFIG.openai.maxTokens,
          stream: true
        });

        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || '';
          fullContent += content;
          yield { summary: fullContent, provider: 'openai', tokensUsed: 0, cost: 0, done: false };
        }
        tokensUsed = Math.ceil(fullContent.length / 4);
        
      } else {
        // Real Groq streaming
        try {
          const stream = await this.groq.chat.completions.create({
            model: AI_CONFIG.groq.model,
            messages: streamMessages,
            temperature: AI_CONFIG.groq.temperature,
            max_tokens: AI_CONFIG.groq.maxTokens,
            stream: true
          });

          for await (const chunk of stream) {
            const content = (chunk as any).choices?.[0]?.delta?.content || '';
            fullContent += content;
            if (content) {
              yield { summary: fullContent, provider: 'groq', tokensUsed: 0, cost: 0, done: false };
            }
          }
          tokensUsed = Math.ceil(fullContent.length / 4);
        } catch (groqErr) {
          // Fallback: non-streaming
          console.warn('[AI Orchestrator] Groq streaming fallback:', groqErr);
          const response = await this.executeAIQuery(query, provider, dataContext, context);
          fullContent = response.summary;
          tokensUsed = response.tokensUsed;
          yield { summary: fullContent, provider: 'groq', tokensUsed: 0, cost: 0, done: false };
        }
      }
      
      // Mensaje final con costos
      const cost = (tokensUsed / 1000) * AI_CONFIG[provider].costPer1KTokens;
      
      yield {
        summary: fullContent,
        provider,
        tokensUsed,
        cost,
        done: true
      };
      
      // Log final
      await this.logAIUsage(tenantId, userId, provider, tokensUsed, cost, query, conversationId);
      
      if (provider === 'openai') {
        await this.incrementPremiumUsage(tenantId);
      }
      
    } catch (error: any) {
      console.error('[AI Orchestrator] Streaming error:', error);
      yield {
        summary: 'Error en el procesamiento. Por favor intenta nuevamente.',
        provider: 'groq',
        tokensUsed: 0,
        cost: 0,
        done: true,
        alerts: [{
          severity: 'high',
          title: 'Error de conexión',
          message: error.message
        }]
      };
    }
  }

  /**
   * Obtiene el estado de suscripción AI del tenant
   */
  async getAISubscription(tenantId: string): Promise<AISubscription> {
    const defaultSubscription: AISubscription = {
      plan: null,
      status: 'inactive',
      premiumQueriesLimit: 3,
      premiumQueriesUsed: 0,
      premiumQueriesRemaining: 3,
      groqEnabled: true,
      openaiEnabled: false,
      resetDate: new Date()
    };

    let sub: any = null;
    try {
      const aiSubModel = (this.prisma as any).tenantAISubscription;
      if (aiSubModel) {
        sub = await aiSubModel.findUnique({ where: { tenantId } });
      }
    } catch {
      return defaultSubscription;
    }

    if (!sub) {
      return defaultSubscription;
    }

    // Verificar si necesita reset mensual
    const now = new Date();
    const resetDate = new Date(sub.lastResetDate);
    const daysSinceReset = Math.floor((now.getTime() - resetDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysSinceReset >= 30) {
      // Resetear contadores
      const aiSubModel = (this.prisma as any).tenantAISubscription;
      if (aiSubModel) {
        await aiSubModel.update({
          where: { tenantId },
          data: {
            premiumQueriesUsed: 0,
            lastResetDate: now
          }
        });
        sub.premiumQueriesUsed = 0;
      }
    }

    const limit = PLAN_LIMITS[sub.plan as keyof typeof PLAN_LIMITS]?.premiumQueriesPerMonth ?? 3;
    
    return {
      plan: sub.plan as AISubscription['plan'],
      status: sub.status as AISubscription['status'],
      premiumQueriesLimit: limit,
      premiumQueriesUsed: sub.premiumQueriesUsed,
      premiumQueriesRemaining: limit === -1 ? -1 : Math.max(0, limit - sub.premiumQueriesUsed),
      groqEnabled: true,
      openaiEnabled: sub.status === 'active' && sub.plan !== null,
      resetDate: sub.lastResetDate
    };
  }

  /**
   * Obtiene KPIs ejecutivos para el dashboard
   */
  async getExecutiveKPIs(tenantId: string): Promise<AIWidget[]> {
    const widgets: AIWidget[] = [];

    try {
      // KPIs de Project360
      const projects = await this.prisma.project360?.findMany({
        where: { tenantId, deletedAt: null }
      }) || [];
      
      const activeProjects = projects.filter((p: any) => p.status === 'ACTIVE').length;
      const atRiskProjects = projects.filter((p: any) => 
        p.status === 'AT_RISK' || p.riskLevel === 'HIGH'
      ).length;
      
      widgets.push({
        type: 'kpi',
        title: 'Proyectos Activos',
        data: { value: activeProjects, trend: '+5%', color: 'blue' }
      });
      
      if (atRiskProjects > 0) {
        widgets.push({
          type: 'alert',
          title: 'Proyectos en Riesgo',
          data: { value: atRiskProjects, severity: 'high' }
        });
      }

      // KPIs de NCR (NonConformity)
      const ncrModel = (this.prisma as any).nonConformity || (this.prisma as any).ncr;
      const openNCRs = ncrModel ? await ncrModel.count({
        where: { tenantId, status: { not: 'CLOSED' } }
      }) : 0;
      
      widgets.push({
        type: 'kpi',
        title: 'NCRs Abiertas',
        data: { value: openNCRs, trend: openNCRs > 10 ? '+alto' : 'normal', color: openNCRs > 10 ? 'red' : 'green' }
      });

      // Más KPIs de otros módulos...
      
    } catch (error) {
      console.error('[AI Orchestrator] Error getting KPIs:', error);
    }

    return widgets;
  }

  /**
   * Genera alertas proactivas basadas en IA
   */
  async generateProactiveAlerts(tenantId: string): Promise<AIAlert[]> {
    const alerts: AIAlert[] = [];
    
    try {
      // Detectar proyectos con desvíos
      const project360Model = (this.prisma as any).project360;
      const projectsWithIssues = project360Model ? await project360Model.findMany({
        where: {
          tenantId,
          deletedAt: null
        }
      }) : [];
      
      projectsWithIssues.forEach((p: any) => {
        alerts.push({
          severity: p.actualCost > p.budget ? 'critical' : 'high',
          title: `Proyecto ${p.name} requiere atención`,
          message: p.actualCost > p.budget 
            ? `Sobrecosto detectado: ${((p.actualCost - p.budget) / p.budget * 100).toFixed(1)}%`
            : 'Riesgo de atraso detectado',
          module: 'Project360',
          entityId: p.id
        });
      });

      // Más alertas de otros módulos...
      
    } catch (error) {
      console.error('[AI Orchestrator] Error generating alerts:', error);
    }
    
    return alerts;
  }

  // ============================================================
  // MÉTODOS PRIVADOS
  // ============================================================

  private async validateAISubscription(tenantId: string): Promise<AISubscription> {
    return this.getAISubscription(tenantId);
  }

  private async analyzeIntent(
    query: string,
    tenantId: string,
    userId: string,
    userRole: string
  ): Promise<QueryContext> {
    const lowerQuery = query.toLowerCase();
    
    // Detectar intención por keywords
    let intent: QueryIntent = { category: 'dashboard' };
    let complexity: 'low' | 'medium' | 'high' = 'low';
    let modules: string[] = [];
    
    // Patrones de análisis complejo (requieren OpenAI)
    const complexPatterns = [
      /(?:invertir|inversión|roi|rentabilidad|conviene|escalar|expansión|estratégico)/i,
      /(?:simular|simulación|escenario|proyección|forecast|predicción)/i,
      /(?:analiza|análisis profundo|razona|evalúa comparativa)/i,
      /(?:contrato|licitación|propuesta técnica|documento legal)/i,
      /(?:por qué|cómo afecta|impacto|causa raíz)/i
    ];
    
    if (complexPatterns.some(p => p.test(lowerQuery))) {
      complexity = 'high';
    } else if (lowerQuery.length > 100 || /comparar|versus|vs/.test(lowerQuery)) {
      complexity = 'medium';
    }
    
    // Detectar módulos involucrados
    if (lowerQuery.includes('proyecto')) { modules.push('project360'); intent = { ...intent, target: 'projects' }; }
    if (lowerQuery.includes('riesgo')) { modules.push('risks'); intent = { ...intent, category: 'risk' }; }
    if (lowerQuery.includes('flota') || lowerQuery.includes('veh') || lowerQuery.includes('camion') || lowerQuery.includes('camión') || lowerQuery.includes('unidad')) { modules.push('flota360'); }
    if (lowerQuery.includes('auditoría')) { modules.push('audits'); }
    if (lowerQuery.includes('ncr') || lowerQuery.includes('no conformidad')) { modules.push('ncr'); }
    if (lowerQuery.includes('capa')) { modules.push('capa'); }
    if (lowerQuery.includes('indicador') || lowerQuery.includes('kpi')) { 
      modules.push('indicators'); 
      intent = { category: 'kpi', target: 'indicators' };
    }
    if (lowerQuery.includes('documento')) { modules.push('documents'); }
    if (lowerQuery.includes('rrhh') || lowerQuery.includes('personal') || lowerQuery.includes('empleado')) { 
      modules.push('hr'); 
    }
    if (lowerQuery.includes('financiero') || lowerQuery.includes('costo') || lowerQuery.includes('presupuesto')) { 
      modules.push('finance'); 
      intent = { category: 'analysis', target: 'financial' };
    }
    
    // Detectar acciones
    if (/crear|generar|agregar|nuevo/.test(lowerQuery)) {
      intent = { ...intent, action: 'create' };
    } else if (/comparar|versus|vs|diferencia/.test(lowerQuery)) {
      intent = { ...intent, category: 'comparison' };
    } else if (/pronosticar|predecir|forecast|futuro/.test(lowerQuery)) {
      intent = { ...intent, category: 'forecast' };
    }
    
    return {
      tenantId,
      userId,
      userRole,
      intent,
      complexity,
      // Siempre carga TODOS los módulos para contexto completo del sistema
      modules: ['project360', 'risks', 'hr', 'flota360', 'quality', 'inspections', 'audits'],
      entities: []
    };
  }

  private selectAIProvider(context: QueryContext, subscription: AISubscription): AIProvider {
    // Si es consulta compleja y tiene acceso premium, usar OpenAI
    if (context.complexity === 'high' && subscription.openaiEnabled) {
      return 'openai';
    }
    
    // Si es consulta media y tiene Business o Enterprise, usar OpenAI
    if (context.complexity === 'medium' && 
        (subscription.plan === 'BUSINESS_AI' || subscription.plan === 'ENTERPRISE_AI')) {
      return 'openai';
    }
    
    // Default: Groq (rápido y económico)
    return 'groq';
  }

  private canUsePremiumQuery(subscription: AISubscription): boolean {
    if (!subscription.openaiEnabled) return false;
    if (subscription.plan === 'ENTERPRISE_AI') return true; // Ilimitado
    return subscription.premiumQueriesRemaining > 0;
  }

  private async buildDataContext(context: QueryContext, tenantId: string): Promise<string> {
    const dataSections: string[] = [];
    
    try {
      // Cargar todos los módulos en paralelo siempre
      const allModules = ['project360', 'risks', 'hr', 'flota360', 'quality', 'inspections', 'audits'];
      for (const module of allModules) {
        switch (module) {
          case 'project360':
            const projects = await this.prisma.project360?.findMany({
              where: { tenantId, deletedAt: null },
              take: 10,
              orderBy: { updatedAt: 'desc' }
            }) || [];
            if (projects.length > 0) {
              dataSections.push(`Proyectos activos (${projects.length}): ${projects.map((p: any) => 
                `${p.name} (${p.status}, ${p.progress}%)`).join(', ')}`);
            }
            break;
            
          case 'risks':
            const risks = await this.prisma.risk?.findMany({
              where: { tenantId },
              take: 5
            }) || [];
            if (risks.length > 0) {
              dataSections.push(`Riesgos activos (${risks.length}): ${risks.map((r: any) => 
                `${r.title} (nivel ${r.level})`).join(', ')}`);
            }
            break;
            
          case 'ncr':
            const ncrModel2 = (this.prisma as any).nonConformity || (this.prisma as any).ncr;
            const ncrs = ncrModel2 ? await ncrModel2.findMany({
              where: { tenantId, status: { not: 'CLOSED' } },
              take: 5
            }) : [];
            if (ncrs.length > 0) {
              dataSections.push(`NCRs abiertas (${ncrs.length}): ${ncrs.map((n: any) => 
                `${n.code || n.id} (${n.status})`).join(', ')}`);
            }
            break;
            
          case 'hr':
          case 'rrhh': {
            const employees = await this.db.employee?.findMany({
              where: { tenantId, deletedAt: null },
              select: { id: true, status: true, department: true, position: true },
              take: 200
            }) || [];
            if (employees.length > 0) {
              const active = employees.filter((e: any) => e.status === 'ACTIVE' || e.status === 'ACTIVO').length;
              const byDept: Record<string, number> = {};
              employees.forEach((e: any) => { if (e.department) byDept[e.department] = (byDept[e.department] || 0) + 1; });
              const deptStr = Object.entries(byDept).map(([d, c]) => `${d}: ${c}`).join(', ');
              dataSections.push(`RRHH — Empleados totales: ${employees.length}, Activos: ${active}${deptStr ? `. Departamentos: ${deptStr}` : ''}`);
            } else {
              dataSections.push('RRHH — Sin datos de empleados cargados en el sistema.');
            }
            break;
          }

          case 'fleet':
          case 'flota':
          case 'flota360': {
            const vehicles = await this.db.vehiculo?.findMany({
              where: { tenantId },
              select: { id: true, status: true, tipo: true, marca: true, modelo: true, dominio: true },
              take: 200
            }) || [];
            if (vehicles.length > 0) {
              const operative = vehicles.filter((v: any) => v.status === 'ACTIVO').length;
              const maintenance = vehicles.filter((v: any) => v.status === 'EN_TALLER').length;
              const inactive = vehicles.filter((v: any) => v.status === 'INACTIVO' || v.status === 'BAJA').length;
              dataSections.push(`Flota360 — Vehículos totales: ${vehicles.length}. Operativos: ${operative}, En taller: ${maintenance}, Inactivos/Baja: ${inactive}.`);
            } else {
              dataSections.push('Flota360 — Sin datos de vehículos en el sistema.');
            }
            break;
          }

          case 'quality':
          case 'calidad': {
            const db = this.db;
            const ncrModel = db.nonConformityReport || db.ncr || db.nonConformity;
            const capaModel = db.capa || db.correctiveAction;
            const [allNcrs, allCapas] = await Promise.all([
              ncrModel ? ncrModel.findMany({ where: { tenantId }, select: { status: true, severity: true }, take: 200 }) : [],
              capaModel ? capaModel.findMany({ where: { tenantId }, select: { status: true }, take: 200 }) : []
            ]);
            if (allNcrs.length > 0 || allCapas.length > 0) {
              const openNcrs = allNcrs.filter((n: any) => n.status !== 'CLOSED').length;
              const openCapas = allCapas.filter((c: any) => c.status !== 'CLOSED' && c.status !== 'COMPLETED').length;
              dataSections.push(`Calidad — NCRs totales: ${allNcrs.length}, abiertas: ${openNcrs}. CAPAs totales: ${allCapas.length}, pendientes: ${openCapas}`);
            }
            break;
          }

          case 'inspections': {
            // Hallazgos de inspecciones (tabla raw — no en Prisma schema principal)
            try {
              const hallazgos = await this.prisma.$queryRaw<any[]>`
                SELECT h.descripcion, h.severidad, h.estado, h."itemLabel",
                       i."activoNombre", i."activoCodigo", i.sector, i."inspectorNombre",
                       i."createdAt"
                FROM inspeccion_hallazgos h
                JOIN inspecciones i ON i.id = h."inspeccionId"
                WHERE i."tenantId" = ${tenantId}::uuid
                  AND h.estado = 'ABIERTO'
                ORDER BY i."createdAt" DESC
                LIMIT 30
              `;
              if (hallazgos.length > 0) {
                const bySeverity: Record<string, number> = {};
                hallazgos.forEach((h: any) => { bySeverity[h.severidad] = (bySeverity[h.severidad] || 0) + 1; });
                const sevStr = Object.entries(bySeverity).map(([s, c]) => `${s}: ${c}`).join(', ');
                const detalle = hallazgos.slice(0, 10).map((h: any) =>
                  `• [${h.severidad}] ${h.itemLabel || h.descripcion} — Activo: ${h.activoNombre || 'sin especificar'} (${h.estado})`
                ).join('\n');
                dataSections.push(`Inspecciones — Hallazgos abiertos: ${hallazgos.length} (${sevStr})\n${detalle}`);
              }
            } catch {}
            break;
          }

          case 'audits': {
            try {
              const findings = await this.prisma.$queryRaw<any[]>`
                SELECT f.title, f.severity, f.status, f.description
                FROM audit_findings f
                JOIN audits a ON a.id = f."auditId"
                WHERE a."tenantId" = ${tenantId}::uuid
                  AND f.status != 'CLOSED'
                ORDER BY f."createdAt" DESC
                LIMIT 20
              `;
              if (findings.length > 0) {
                const openFindings = findings.filter((f: any) => f.status !== 'CLOSED').length;
                dataSections.push(`Auditorías — Hallazgos abiertos: ${openFindings}. Ejemplos: ${findings.slice(0,5).map((f: any) => `${f.title} (${f.severity})`).join(', ')}`);
              }
            } catch {}
            break;
          }
        }
      }
    } catch (error) {
      console.error('[AI Orchestrator] Error building data context:', error);
    }
    
    return dataSections.length > 0
      ? dataSections.join('\n')
      : 'No hay datos disponibles en el sistema para esta consulta.';
  }

  private async executeAIQuery(
    query: string,
    provider: AIProvider,
    dataContext: string,
    context: QueryContext,
    conversationHistory: Array<{ role: string; content: string }> = []
  ): Promise<AIResponse> {
    const config = AI_CONFIG[provider];
    let systemPrompt = SYSTEM_PROMPTS[provider];

    // ── Multi-agent: inject specialized prompt based on detected modules ──
    const agentKey = this.detectSpecializedAgent(context);
    if (agentKey && AGENT_SPECIALIZATIONS[agentKey]) {
      systemPrompt += `\n\nESPECIALIZACIÓN ACTIVA:\n${AGENT_SPECIALIZATIONS[agentKey]}`;
    }

    // ── Conversation summary injection ──
    if (conversationHistory.length > 4) {
      const summary = this.buildConversationSummary(conversationHistory);
      systemPrompt += `\n\nRESUMEN DE CONVERSACIÓN PREVIA:\n${summary}`;
    }
    
    try {
      let content: string;
      let tokensUsed: number = 0;

      // Construir mensajes con historial para memoria conversacional
      const userMessage = dataContext
        ? `Datos del sistema:\n${dataContext}\n\nConsulta: ${query}`
        : query;

      // Limit conversation history to last 6 messages to save tokens
      const recentHistory = conversationHistory.slice(-6);

      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: systemPrompt },
        ...recentHistory.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content
        })),
        { role: 'user', content: userMessage }
      ];
      
      if (provider === 'groq') {
        const completion = await this.groq.chat.completions.create({
          model: config.model,
          messages,
          temperature: config.temperature,
          max_tokens: config.maxTokens
        });
        
        content = completion.choices[0]?.message?.content || '';
        tokensUsed = completion.usage?.total_tokens || 0;
        
      } else {
        const completion = await this.openai.chat.completions.create({
          model: config.model,
          messages,
          temperature: config.temperature,
          max_tokens: config.maxTokens
        });
        
        content = completion.choices[0]?.message?.content || '';
        tokensUsed = completion.usage?.total_tokens || 0;
      }
      
      const cost = (tokensUsed / 1000) * config.costPer1KTokens;
      
      // NO parsear widgets del contenido de la IA
      // Los widgets deben venir exclusivamente de datos reales de la BD (getExecutiveKPIs)
      // para evitar mostrar datos inventados
      
      return {
        summary: content,
        provider,
        tokensUsed,
        cost
      };
      
    } catch (error: any) {
      console.error(`[AI Orchestrator] ${provider} error:`, error);
      
      // Fallback a respuesta local si falla la API
      return {
        summary: this.generateFallbackResponse(query, context),
        provider,
        tokensUsed: 0,
        cost: 0
      };
    }
  }

  private generateFallbackResponse(query: string, context: QueryContext): string {
    return `Entendí tu consulta sobre "${query.substring(0, 50)}...". ` +
           `Estoy procesando información de los módulos: ${context.modules.join(', ')}. ` +
           `Por favor intenta nuevamente en unos momentos.`;
  }

  private async logAIUsage(
    tenantId: string,
    userId: string,
    provider: AIProvider,
    tokensUsed: number,
    cost: number,
    query: string,
    conversationId?: string
  ): Promise<void> {
    try {
      // Verificar si existe el modelo AIUsageLog
      const aiUsageLogModel = (this.prisma as any).aIUsageLog;
      if (aiUsageLogModel) {
        await aiUsageLogModel.create({
          data: {
            tenantId,
            userId,
            provider,
            tokensUsed,
            cost,
            promptLength: query.length,
            module: 'command-center',
            conversationId
          }
        });
      }
    } catch (error) {
      console.error('[AI Orchestrator] Error logging usage:', error);
    }
  }

  private async incrementPremiumUsage(tenantId: string): Promise<void> {
    try {
      const aiSubModel = (this.prisma as any).tenantAISubscription;
      if (aiSubModel) {
        await aiSubModel.update({
          where: { tenantId },
          data: { premiumQueriesUsed: { increment: 1 } }
        });
      }
    } catch (error) {
      console.error('[AI Orchestrator] Error incrementing usage:', error);
    }
  }

  private buildPaywallResponse(subscription: AISubscription): AIResponse {
    const planNames: Record<string, string> = {
      'STARTER_AI': 'Starter AI',
      'BUSINESS_AI': 'Business AI',
      'ENTERPRISE_AI': 'Enterprise AI'
    };
    
    return {
      summary: 'Has alcanzado el límite de consultas avanzadas IA para este período.',
      widgets: [{
        type: 'alert',
        title: 'Límite alcanzado',
        data: {
          used: subscription.premiumQueriesUsed,
          limit: subscription.premiumQueriesLimit,
          plan: subscription.plan
        }
      }],
      actions: [
        {
          type: 'upgrade',
          label: 'Upgrade a Business AI',
          icon: 'Zap',
          requiresConfirmation: false
        },
        {
          type: 'buy_pack',
          label: 'Comprar Pack de Consultas',
          icon: 'CreditCard',
          requiresConfirmation: false
        }
      ],
      provider: 'groq',
      tokensUsed: 0,
      cost: 0
    };
  }

  private async processActions(result: AIResponse, context: QueryContext): Promise<AIResponse> {
    return result;
  }

  /**
   * Detecta si la consulta merece gráficos visuales
   */
  shouldGenerateCharts(query: string): boolean {
    const q = query.toLowerCase();
    return /indicador|kpi|dashboard|gráfico|grafico|chart|estado.*flota|estado.*proyecto|estado.*general|resumen|reporte|informe|mostrar datos|visualizar|comparar|tendencia|distribución|distribucion/.test(q);
  }

  /**
   * Genera configuraciones de gráficos Recharts a partir de datos reales de BD
   */
  async generateChartsFromData(query: string, tenantId: string): Promise<AIChart[]> {
    const charts: AIChart[] = [];
    const q = query.toLowerCase();

    try {
      // ── Fleet charts ──
      if (/flota|veh|camion|camión|unidad/.test(q) || /estado.*general|dashboard|indicador|kpi/.test(q)) {
        const vehicles = await this.db.vehiculo?.findMany({
          where: { tenantId },
          select: { id: true, status: true, tipo: true }
        }) || [];

        if (vehicles.length > 0) {
          const statusMap: Record<string, number> = {};
          vehicles.forEach((v: any) => {
            const s = v.status === 'ACTIVO' ? 'Operativos' : v.status === 'EN_TALLER' ? 'En Taller' : v.status === 'INACTIVO' ? 'Inactivos' : v.status === 'BAJA' ? 'Baja' : v.status || 'Otro';
            statusMap[s] = (statusMap[s] || 0) + 1;
          });
          charts.push({
            type: 'pie',
            title: `Estado de Flota (${vehicles.length} vehículos)`,
            data: Object.entries(statusMap).map(([name, value]) => ({ name, value })),
            xAxis: 'name',
            series: ['value'],
          });

          // By type
          const typeMap: Record<string, number> = {};
          vehicles.forEach((v: any) => { const t = v.tipo || 'Sin tipo'; typeMap[t] = (typeMap[t] || 0) + 1; });
          if (Object.keys(typeMap).length > 1) {
            charts.push({
              type: 'bar',
              title: 'Vehículos por Tipo',
              data: Object.entries(typeMap).map(([tipo, cantidad]) => ({ tipo, cantidad })),
              xAxis: 'tipo',
              series: ['cantidad'],
            });
          }
        }
      }

      // ── Inspections/findings charts ──
      if (/hallazgo|inspección|inspeccion|flota|estado.*general|dashboard|indicador/.test(q)) {
        try {
          const hallazgos = await this.prisma.$queryRaw<any[]>`
            SELECT h.severidad, h.estado, h."itemLabel"
            FROM inspeccion_hallazgos h
            JOIN inspecciones i ON i.id = h."inspeccionId"
            WHERE i."tenantId" = ${tenantId}::uuid
            LIMIT 100
          `;
          if (hallazgos.length > 0) {
            const bySeverity: Record<string, number> = {};
            hallazgos.forEach((h: any) => { bySeverity[h.severidad || 'Sin clasificar'] = (bySeverity[h.severidad || 'Sin clasificar'] || 0) + 1; });
            charts.push({
              type: 'bar',
              title: `Hallazgos por Severidad (${hallazgos.length} total)`,
              data: Object.entries(bySeverity).map(([severidad, cantidad]) => ({ severidad, cantidad })),
              xAxis: 'severidad',
              series: ['cantidad'],
            });

            const byStatus: Record<string, number> = {};
            hallazgos.forEach((h: any) => { byStatus[h.estado || 'Sin estado'] = (byStatus[h.estado || 'Sin estado'] || 0) + 1; });
            charts.push({
              type: 'pie',
              title: 'Hallazgos por Estado',
              data: Object.entries(byStatus).map(([name, value]) => ({ name, value })),
              xAxis: 'name',
              series: ['value'],
            });
          }
        } catch {}
      }

      // ── Projects charts ──
      if (/proyecto|project|avance|estado.*general|dashboard|indicador/.test(q)) {
        const projects = await this.prisma.project360?.findMany({
          where: { tenantId, deletedAt: null },
          take: 20,
          orderBy: { updatedAt: 'desc' }
        }) || [];

        if (projects.length > 0) {
          // Status distribution
          const statusMap: Record<string, number> = {};
          projects.forEach((p: any) => {
            const s = p.status === 'ACTIVE' ? 'Activo' : p.status === 'COMPLETED' ? 'Completado' : p.status === 'AT_RISK' ? 'En Riesgo' : p.status === 'PENDING' ? 'Pendiente' : p.status || 'Otro';
            statusMap[s] = (statusMap[s] || 0) + 1;
          });
          charts.push({
            type: 'pie',
            title: `Proyectos por Estado (${projects.length})`,
            data: Object.entries(statusMap).map(([name, value]) => ({ name, value })),
            xAxis: 'name',
            series: ['value'],
          });

          // Progress bar chart (top 10 by name)
          const progressData = projects.slice(0, 10).map((p: any) => ({
            nombre: (p.name || 'Sin nombre').substring(0, 20),
            avance: p.progress || 0,
          }));
          if (progressData.some((d: any) => d.avance > 0)) {
            charts.push({
              type: 'bar',
              title: 'Avance de Proyectos (%)',
              data: progressData,
              xAxis: 'nombre',
              series: ['avance'],
            });
          }
        }
      }

      // ── Quality (NCRs/CAPAs) ──
      if (/ncr|capa|calidad|no conformidad|quality|estado.*general|dashboard|indicador/.test(q)) {
        const db = this.db;
        const ncrModel = db.nonConformityReport || db.ncr || db.nonConformity;
        if (ncrModel) {
          const ncrs = await ncrModel.findMany({ where: { tenantId }, select: { status: true, severity: true }, take: 200 });
          if (ncrs.length > 0) {
            const byStatus: Record<string, number> = {};
            ncrs.forEach((n: any) => { byStatus[n.status || 'Sin estado'] = (byStatus[n.status || 'Sin estado'] || 0) + 1; });
            charts.push({
              type: 'pie',
              title: `NCRs por Estado (${ncrs.length} total)`,
              data: Object.entries(byStatus).map(([name, value]) => ({ name, value })),
              xAxis: 'name',
              series: ['value'],
            });

            const bySeverity: Record<string, number> = {};
            ncrs.forEach((n: any) => { if (n.severity) bySeverity[n.severity] = (bySeverity[n.severity] || 0) + 1; });
            if (Object.keys(bySeverity).length > 0) {
              charts.push({
                type: 'bar',
                title: 'NCRs por Severidad',
                data: Object.entries(bySeverity).map(([severidad, cantidad]) => ({ severidad, cantidad })),
                xAxis: 'severidad',
                series: ['cantidad'],
              });
            }
          }
        }
      }

      // ── HR ──
      if (/rrhh|personal|empleado|recurso.*humano|dotación|dotacion|estado.*general|dashboard/.test(q)) {
        const employees = await this.db.employee?.findMany({
          where: { tenantId, deletedAt: null },
          select: { department: true, status: true },
          take: 500
        }) || [];

        if (employees.length > 0) {
          const byDept: Record<string, number> = {};
          employees.forEach((e: any) => {
            const d = e.department || 'Sin departamento';
            byDept[d] = (byDept[d] || 0) + 1;
          });
          if (Object.keys(byDept).length > 1) {
            charts.push({
              type: 'bar',
              title: `Empleados por Departamento (${employees.length} total)`,
              data: Object.entries(byDept)
                .sort(([,a], [,b]) => (b as number) - (a as number))
                .slice(0, 15)
                .map(([departamento, cantidad]) => ({ departamento, cantidad })),
              xAxis: 'departamento',
              series: ['cantidad'],
            });
          }
        }
      }

    } catch (err) {
      console.error('[AI Orchestrator] Error generating charts:', err);
    }

    return charts;
  }

  /**
   * Multi-agent: detecta qué agente especializado activar según los módulos detectados
   */
  private detectSpecializedAgent(context: QueryContext): string | null {
    const modules = context.modules || [];
    const intent = context.intent;

    // Prioridad por intent
    if (intent?.category === 'risk') return 'risk';
    if (intent?.target === 'projects' || modules.includes('project360')) return 'projects';

    // Prioridad por módulos detectados
    if (modules.includes('ncr') || modules.includes('capa') || modules.includes('quality')) return 'quality';
    if (modules.includes('flota360') || modules.includes('fleet')) return 'fleet';
    if (modules.includes('hr') || modules.includes('rrhh')) return 'hr';
    if (modules.includes('risks')) return 'risk';
    if (modules.includes('audits')) return 'quality';

    return null; // General agent
  }

  /**
   * Genera un resumen compacto de la conversación previa para inyectar como contexto
   */
  private buildConversationSummary(history: Array<{ role: string; content: string }>): string {
    if (history.length === 0) return '';

    // Tomar las preguntas del usuario como resumen de temas
    const userQueries = history
      .filter(m => m.role === 'user')
      .map(m => m.content.substring(0, 100))
      .slice(-5);

    // Tomar la última respuesta del asistente como contexto reciente
    const lastAssistant = history
      .filter(m => m.role === 'assistant')
      .pop();

    const lastResponse = lastAssistant
      ? lastAssistant.content.substring(0, 300)
      : '';

    return `Temas consultados previamente: ${userQueries.join(' | ')}` +
      (lastResponse ? `\nÚltima respuesta: ${lastResponse}...` : '');
  }
}

// ============================================================
// EXPORTAR INSTANCIA
// ============================================================

export function createAIOrchestrator(prisma: PrismaClient, app?: FastifyInstance): AIOrchestrator {
  return new AIOrchestrator(prisma, app);
}
