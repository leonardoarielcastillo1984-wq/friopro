/**
 * AI MEMORY ENGINE
 * SGI360 Command Center - Sistema de memoria conversacional
 * 
 * Proporciona memoria persistente y contextual para las conversaciones IA:
 * - Historial de conversaciones por usuario
 * - Contexto de tenant persistente
 * - Preferencias y patrones aprendidos
 * - Referencias contextuales ("comparalo con el anterior")
 * - Insights y patrones detectados
 */

import { PrismaClient } from '@prisma/client';
import { AIMemoryType } from './ai-orchestrator';

interface MemoryContext {
  tenantId: string;
  userId: string;
  conversationId?: string;
}

interface MemoryEntry {
  type: AIMemoryType;
  key: string;
  value: any;
  metadata?: any;
  expiresAt?: Date;
}

interface ConversationContext {
  modules: string[];
  entities: string[];
  filters: Record<string, any>;
  lastQueries: string[];
  patterns: string[];
  preferences: Record<string, any>;
}

export class AIMemoryEngine {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Almacena un valor en memoria
   */
  async storeMemory(
    context: MemoryContext,
    type: AIMemoryType,
    key: string,
    value: any,
    metadata?: any,
    expiresAt?: Date
  ): Promise<void> {
    try {
      await this.prisma.aIMemory.upsert({
        where: {
          tenantId_key: {
            tenantId: context.tenantId,
            key: this.buildMemoryKey(context, key)
          }
        },
        update: {
          type,
          value,
          metadata,
          expiresAt,
          lastUpdated: new Date()
        },
        create: {
          tenantId: context.tenantId,
          type,
          key: this.buildMemoryKey(context, key),
          value,
          metadata,
          expiresAt
        }
      });
    } catch (error) {
      console.error('[AI Memory Engine] Error storing memory:', error);
    }
  }

  /**
   * Recupera un valor de memoria
   */
  async getMemory(
    context: MemoryContext,
    type: AIMemoryType,
    key: string
  ): Promise<any | null> {
    try {
      const memory = await this.prisma.aIMemory.findUnique({
        where: {
          tenantId_key: {
            tenantId: context.tenantId,
            key: this.buildMemoryKey(context, key)
          }
        }
      });

      // Verificar si expiró
      if (memory && memory.expiresAt && memory.expiresAt < new Date()) {
        await this.prisma.aIMemory.delete({
          where: { id: memory.id }
        });
        return null;
      }

      return memory?.value || null;
    } catch (error) {
      console.error('[AI Memory Engine] Error getting memory:', error);
      return null;
    }
  }

  /**
   * Obtiene contexto completo de conversación
   */
  async getConversationContext(
    context: MemoryContext
  ): Promise<ConversationContext> {
    const baseContext: ConversationContext = {
      modules: [],
      entities: [],
      filters: {},
      lastQueries: [],
      patterns: [],
      preferences: {}
    };

    try {
      // Obtener memorias de contexto
      const memories = await this.prisma.aIMemory.findMany({
        where: {
          tenantId: context.tenantId,
          type: { in: ['CONTEXT', 'HISTORY', 'PREFERENCE', 'PATTERN'] }
        }
      });

      for (const memory of memories) {
        // Verificar expiración
        if (memory.expiresAt && memory.expiresAt < new Date()) {
          continue;
        }

        // Extraer contexto del usuario si aplica
        if (context.userId && !memory.key.includes(`user:${context.userId}`)) {
          continue;
        }

        switch (memory.type) {
          case 'CONTEXT':
            if (memory.key.includes('modules')) {
              baseContext.modules = memory.value || [];
            } else if (memory.key.includes('entities')) {
              baseContext.entities = memory.value || [];
            } else if (memory.key.includes('filters')) {
              baseContext.filters = memory.value || {};
            }
            break;
          
          case 'HISTORY':
            if (memory.key.includes('queries')) {
              baseContext.lastQueries = memory.value || [];
            }
            break;
          
          case 'PATTERN':
            if (memory.key.includes('patterns')) {
              baseContext.patterns = memory.value || [];
            }
            break;
          
          case 'PREFERENCE':
            baseContext.preferences = {
              ...baseContext.preferences,
              ...memory.value
            };
            break;
        }
      }
    } catch (error) {
      console.error('[AI Memory Engine] Error getting conversation context:', error);
    }

    return baseContext;
  }

  /**
   * Actualiza contexto de conversación
   */
  async updateConversationContext(
    context: MemoryContext,
    updates: Partial<ConversationContext>
  ): Promise<void> {
    try {
      const expiration = new Date();
      expiration.setDate(expiration.getDate() + 30); // Expira en 30 días

      if (updates.modules) {
        await this.storeMemory(
          context,
          'CONTEXT',
          'modules',
          updates.modules,
          { source: 'conversation_update' },
          expiration
        );
      }

      if (updates.entities) {
        await this.storeMemory(
          context,
          'CONTEXT',
          'entities',
          updates.entities,
          { source: 'conversation_update' },
          expiration
        );
      }

      if (updates.filters) {
        await this.storeMemory(
          context,
          'CONTEXT',
          'filters',
          updates.filters,
          { source: 'conversation_update' },
          expiration
        );
      }

      if (updates.lastQueries) {
        // Mantener solo últimas 20 consultas
        const recentQueries = updates.lastQueries.slice(-20);
        await this.storeMemory(
          context,
          'HISTORY',
          'queries',
          recentQueries,
          { source: 'conversation_update' },
          expiration
        );
      }

      if (updates.patterns) {
        await this.storeMemory(
          context,
          'PATTERN',
          'patterns',
          updates.patterns,
          { source: 'conversation_update' },
          expiration
        );
      }

      if (updates.preferences) {
        await this.storeMemory(
          context,
          'PREFERENCE',
          'user_preferences',
          updates.preferences,
          { source: 'conversation_update' },
          expiration
        );
      }
    } catch (error) {
      console.error('[AI Memory Engine] Error updating conversation context:', error);
    }
  }

  /**
   * Agrega una consulta al historial
   */
  async addQueryToHistory(
    context: MemoryContext,
    query: string,
    response?: any
  ): Promise<void> {
    try {
      const history = await this.getMemory(context, 'HISTORY', 'queries') || [];
      
      const queryEntry = {
        query,
        timestamp: new Date().toISOString(),
        response: response ? {
          summary: response.summary,
          provider: response.provider,
          tokensUsed: response.tokensUsed
        } : undefined
      };

      history.push(queryEntry);

      // Mantener solo últimas 50 consultas
      const recentHistory = history.slice(-50);

      await this.storeMemory(
        context,
        'HISTORY',
        'queries',
        recentHistory,
        { source: 'query_addition' }
      );
    } catch (error) {
      console.error('[AI Memory Engine] Error adding query to history:', error);
    }
  }

  /**
   * Detecta y almacena patrones de uso
   */
  async detectAndStorePatterns(
    context: MemoryContext,
    query: string,
    response: any
  ): Promise<void> {
    try {
      const patterns = await this.getMemory(context, 'PATTERN', 'patterns') || [];
      
      // Detectar patrones simples
      const queryLower = query.toLowerCase();
      
      // Patrones de tipo de consulta
      if (queryLower.includes('proyecto') || queryLower.includes('project')) {
        this.addPattern(patterns, 'project_focus', {
          frequency: 1,
          lastSeen: new Date().toISOString(),
          context: 'project_management'
        });
      }

      if (queryLower.includes('riesgo') || queryLower.includes('risk')) {
        this.addPattern(patterns, 'risk_focus', {
          frequency: 1,
          lastSeen: new Date().toISOString(),
          context: 'risk_management'
        });
      }

      if (queryLower.includes('kpi') || queryLower.includes('indicador')) {
        this.addPattern(patterns, 'analytics_focus', {
          frequency: 1,
          lastSeen: new Date().toISOString(),
          context: 'analytics'
        });
      }

      // Patrones temporales
      const hour = new Date().getHours();
      if (hour >= 9 && hour <= 11) {
        this.addPattern(patterns, 'morning_user', {
          frequency: 1,
          lastSeen: new Date().toISOString()
        });
      }

      // Patrones de complejidad
      if (response.provider === 'openai') {
        this.addPattern(patterns, 'complex_queries', {
          frequency: 1,
          lastSeen: new Date().toISOString(),
          avgTokens: response.tokensUsed
        });
      }

      await this.storeMemory(
        context,
        'PATTERN',
        'patterns',
        patterns,
        { source: 'pattern_detection' }
      );
    } catch (error) {
      console.error('[AI Memory Engine] Error detecting patterns:', error);
    }
  }

  /**
   * Agrega un patrón al array de patrones
   */
  private addPattern(patterns: any[], patternKey: string, data: any): void {
    const existingPattern = patterns.find(p => p.key === patternKey);
    
    if (existingPattern) {
      existingPattern.frequency += 1;
      existingPattern.lastSeen = data.lastSeen;
      if (data.avgTokens) {
        existingPattern.avgTokens = (existingPattern.avgTokens + data.avgTokens) / 2;
      }
    } else {
      patterns.push({
        key: patternKey,
        ...data
      });
    }
  }

  /**
   * Obtiene insights aprendidos
   */
  async getInsights(context: MemoryContext): Promise<any[]> {
    try {
      const insights = await this.prisma.aIMemory.findMany({
        where: {
          tenantId: context.tenantId,
          type: 'INSIGHT'
        },
        orderBy: { createdAt: 'desc' },
        take: 20
      });

      return insights
        .filter(memory => !memory.expiresAt || memory.expiresAt >= new Date())
        .map(memory => memory.value);
    } catch (error) {
      console.error('[AI Memory Engine] Error getting insights:', error);
      return [];
    }
  }

  /**
   * Almacena un insight aprendido
   */
  async storeInsight(
    context: MemoryContext,
    insight: any,
    confidence: number = 0.8
  ): Promise<void> {
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 90); // Los insights expiran en 90 días

      await this.storeMemory(
        context,
        'INSIGHT',
        `insight_${Date.now()}`,
        {
          ...insight,
          confidence,
          discoveredAt: new Date().toISOString(),
          discoveredBy: context.userId
        },
        { source: 'ai_learning' },
        expiresAt
      );
    } catch (error) {
      console.error('[AI Memory Engine] Error storing insight:', error);
    }
  }

  /**
   * Limpia memorias expiradas
   */
  async cleanupExpiredMemories(): Promise<void> {
    try {
      const result = await this.prisma.aIMemory.deleteMany({
        where: {
          expiresAt: {
            lt: new Date()
          }
        }
      });

      console.log(`[AI Memory Engine] Cleaned up ${result.count} expired memories`);
    } catch (error) {
      console.error('[AI Memory Engine] Error cleaning up memories:', error);
    }
  }

  /**
   * Construye clave de memoria única
   */
  private buildMemoryKey(context: MemoryContext, key: string): string {
    if (context.userId) {
      return `user:${context.userId}:${key}`;
    }
    if (context.conversationId) {
      return `conv:${context.conversationId}:${key}`;
    }
    return `tenant:${key}`;
  }

  /**
   * Obtiene estadísticas de uso de memoria
   */
  async getMemoryStats(tenantId: string): Promise<any> {
    try {
      const stats = await this.prisma.aIMemory.groupBy({
        by: ['type'],
        where: { tenantId },
        _count: true
      });

      const totalMemories = stats.reduce((sum, s) => sum + s._count, 0);
      
      return {
        total: totalMemories,
        byType: stats.reduce((acc, s) => {
          acc[s.type] = s._count;
          return acc;
        }, {} as Record<string, number>),
        lastCleanup: new Date().toISOString()
      };
    } catch (error) {
      console.error('[AI Memory Engine] Error getting memory stats:', error);
      return { total: 0, byType: {} };
    }
  }

  /**
   * Exporta memoria del tenant (para backup/migración)
   */
  async exportMemory(tenantId: string): Promise<any> {
    try {
      const memories = await this.prisma.aIMemory.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' }
      });

      return {
        tenantId,
        exportedAt: new Date().toISOString(),
        memories: memories.map(m => ({
          type: m.type,
          key: m.key,
          value: m.value,
          metadata: m.metadata,
          createdAt: m.createdAt,
          expiresAt: m.expiresAt
        }))
      };
    } catch (error) {
      console.error('[AI Memory Engine] Error exporting memory:', error);
      return { tenantId, exportedAt: new Date().toISOString(), memories: [] };
    }
  }

  /**
   * Importa memoria del tenant (desde backup)
   */
  async importMemory(tenantId: string, data: any): Promise<void> {
    try {
      if (!data.memories || !Array.isArray(data.memories)) {
        throw new Error('Invalid memory data format');
      }

      for (const memoryData of data.memories) {
        await this.prisma.aIMemory.create({
          data: {
            tenantId,
            type: memoryData.type,
            key: memoryData.key,
            value: memoryData.value,
            metadata: memoryData.metadata,
            expiresAt: memoryData.expiresAt ? new Date(memoryData.expiresAt) : null,
            createdAt: memoryData.createdAt ? new Date(memoryData.createdAt) : new Date(),
            updatedAt: new Date()
          }
        });
      }

      console.log(`[AI Memory Engine] Imported ${data.memories.length} memories for tenant ${tenantId}`);
    } catch (error) {
      console.error('[AI Memory Engine] Error importing memory:', error);
      throw error;
    }
  }
}

export default AIMemoryEngine;
