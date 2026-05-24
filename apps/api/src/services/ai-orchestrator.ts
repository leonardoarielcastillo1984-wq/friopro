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

const SYSTEM_PROMPTS = {
  groq: `Eres SGI360 AI, el asistente ejecutivo inteligente de SGI360.
Tu rol es ayudar a directivos y gerentes a tomar decisiones empresariales informadas.

CAPACIDADES:
- Analizar datos operativos y financieros
- Detectar riesgos y oportunidades
- Generar insights ejecutivos
- Responder consultas sobre proyectos, KPIs, riesgos, recursos
- Navegar el sistema SGI360

FORMATO DE RESPUESTA:
Responde SIEMPRE en español, de forma clara y ejecutiva.
Si la consulta requiere datos específicos, indica qué información necesitas.
Si detectas riesgos o alertas, destácalas claramente.

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
  private app?: FastifyInstance;
  private groq: Groq;
  private openai: OpenAI;

  constructor(prisma: PrismaClient, app?: FastifyInstance) {
    this.prisma = prisma;
    this.app = app;
    
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
      
      // 2. Analizar intención y complejidad
      const context = await this.analyzeIntent(query, tenantId, userId, userRole);
      
      // 3. Seleccionar proveedor de IA
      const provider = this.selectAIProvider(context, subscription);
      
      // 4. Verificar límites de consultas premium
      if (provider === 'openai' && !this.canUsePremiumQuery(subscription)) {
        return this.buildPaywallResponse(subscription);
      }
      
      // 5. Construir contexto de datos
      const dataContext = await this.buildDataContext(context, tenantId);
      
      // 6. Generar y ejecutar consulta a IA
      const aiResult = await this.executeAIQuery(query, provider, dataContext, context);
      
      // 7. Registrar uso
      await this.logAIUsage(tenantId, userId, provider, aiResult.tokensUsed, aiResult.cost, query, conversationId);
      
      // 8. Actualizar contadores si es premium
      if (provider === 'openai') {
        await this.incrementPremiumUsage(tenantId);
      }
      
      // 9. Procesar acciones si las hay
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
      const systemPrompt = SYSTEM_PROMPTS[provider];
      
      let fullContent = '';
      let tokensUsed = 0;
      
      if (provider === 'openai') {
        // Streaming con OpenAI
        const stream = await this.openai.chat.completions.create({
          model: AI_CONFIG.openai.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Contexto:\n${dataContext}\n\nConsulta: ${query}` }
          ],
          temperature: AI_CONFIG.openai.temperature,
          max_tokens: AI_CONFIG.openai.maxTokens,
          stream: true
        });

        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || '';
          fullContent += content;
          
          yield {
            summary: fullContent,
            provider: 'openai',
            tokensUsed: 0,
            cost: 0,
            done: false
          };
        }
        
        // Estimar tokens finales
        tokensUsed = Math.ceil(fullContent.length / 4);
        
      } else {
        // Para Groq, hacer consulta normal y simular streaming
        const response = await this.executeAIQuery(query, provider, dataContext, context);
        fullContent = response.summary;
        tokensUsed = response.tokensUsed;
        
        // Simular streaming chunk by chunk
        const words = fullContent.split(' ');
        let currentContent = '';
        
        for (const word of words) {
          currentContent += (currentContent ? ' ' : '') + word;
          yield {
            summary: currentContent,
            provider: 'groq',
            tokensUsed: 0,
            cost: 0,
            done: false
          };
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
    const aiSubModel = (this.prisma as any).tenantAISubscription;
    const sub = aiSubModel ? await aiSubModel.findUnique({ where: { tenantId } }) : null;

    if (!sub) {
      // Retornar tier gratuito por defecto
      return {
        plan: null,
        status: 'inactive',
        premiumQueriesLimit: 3,
        premiumQueriesUsed: 0,
        premiumQueriesRemaining: 3,
        groqEnabled: true,
        openaiEnabled: false,
        resetDate: new Date()
      };
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
    if (lowerQuery.includes('flota') || lowerQuery.includes('vehículo')) { modules.push('flota360'); }
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
      modules: modules.length > 0 ? modules : ['general'],
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
      for (const module of context.modules) {
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
            
          // Agregar más módulos según necesidad
        }
      }
    } catch (error) {
      console.error('[AI Orchestrator] Error building data context:', error);
    }
    
    return dataSections.join('\n');
  }

  private async executeAIQuery(
    query: string,
    provider: AIProvider,
    dataContext: string,
    context: QueryContext
  ): Promise<AIResponse> {
    const config = AI_CONFIG[provider];
    const systemPrompt = SYSTEM_PROMPTS[provider];
    
    try {
      let content: string;
      let tokensUsed: number = 0;
      
      if (provider === 'groq') {
        // Usar cliente Groq real
        const completion = await this.groq.chat.completions.create({
          model: config.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Contexto:\n${dataContext}\n\nConsulta: ${query}` }
          ],
          temperature: config.temperature,
          max_tokens: config.maxTokens
        });
        
        content = completion.choices[0]?.message?.content || '';
        tokensUsed = completion.usage?.total_tokens || 0;
        
      } else {
        // Usar cliente OpenAI real
        const completion = await this.openai.chat.completions.create({
          model: config.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Contexto:\n${dataContext}\n\nConsulta: ${query}` }
          ],
          temperature: config.temperature,
          max_tokens: config.maxTokens
        });
        
        content = completion.choices[0]?.message?.content || '';
        tokensUsed = completion.usage?.total_tokens || 0;
      }
      
      const cost = (tokensUsed / 1000) * config.costPer1KTokens;
      
      // Parsear widgets y acciones del contenido si es OpenAI (formato JSON)
      let widgets: AIWidget[] | undefined;
      let actions: AIAction[] | undefined;
      
      if (provider === 'openai') {
        try {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            widgets = parsed.widgets;
            actions = parsed.actions;
          }
        } catch {
          // No es JSON, usar texto plano
        }
      }
      
      return {
        summary: content,
        widgets,
        actions,
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
    // Aquí se procesarían acciones ejecutables por la IA
    // Como crear proyectos, generar CAPAs, etc.
    return result;
  }
}

// ============================================================
// EXPORTAR INSTANCIA
// ============================================================

export function createAIOrchestrator(prisma: PrismaClient, app?: FastifyInstance): AIOrchestrator {
  return new AIOrchestrator(prisma, app);
}
