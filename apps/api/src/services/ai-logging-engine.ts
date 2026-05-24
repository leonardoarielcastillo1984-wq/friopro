/**
 * AI LOGGING ENGINE
 * SGI360 Command Center - Auditoría completa de consumo IA
 * 
 * Registra y analiza todo el uso de IA:
 * - Tokens consumidos por proveedor
 * - Costos por consulta y módulo
 * - Patrones de uso
 * - Rendimiento y latencia
 * - Errores y fallbacks
 * - Reportes de consumo
 */

import { PrismaClient } from '@prisma/client';

interface AILogEntry {
  tenantId: string;
  userId: string;
  sessionId?: string;
  provider: 'groq' | 'openai';
  model: string;
  tokensUsed: number;
  cost: number;
  latency: number;
  module: string;
  action: string;
  query: string;
  response: string;
  success: boolean;
  error?: string;
  metadata: any;
  timestamp: Date;
}

interface AILoggingStats {
  totalQueries: number;
  totalTokens: number;
  totalCost: number;
  averageLatency: number;
  successRate: number;
  providerBreakdown: {
    groq: { queries: number; tokens: number; cost: number };
    openai: { queries: number; tokens: number; cost: number };
  };
  moduleBreakdown: Record<string, { queries: number; tokens: number; cost: number }>;
  dailyUsage: Array<{
    date: string;
    queries: number;
    tokens: number;
    cost: number;
  }>;
  topUsers: Array<{
    userId: string;
    queries: number;
    tokens: number;
    cost: number;
  }>;
}

interface TokenUsageAlert {
  tenantId: string;
  threshold: number;
  currentUsage: number;
  remaining: number;
  projectedMonthlyUsage: number;
  recommendedActions: string[];
}

export class AILoggingEngine {
  private prisma: PrismaClient;
  private costPerToken: {
    groq: number;
    openai: number;
  };

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    
    // Costos por token (approximados)
    this.costPerToken = {
      groq: 0.00000005, // ~$0.05 per 1M tokens
      openai: 0.0000005  // ~$0.50 per 1M tokens (gpt-4)
    };
  }

  /**
   * Registra una consulta IA
   */
  async logAIQuery(entry: Omit<AILogEntry, 'timestamp'>): Promise<void> {
    try {
      const logEntry: AILogEntry = {
        ...entry,
        timestamp: new Date()
      };

      // Guardar en tabla principal de logs
      await (this.prisma as any).aIUsageLog.create({
        data: {
          tenantId: logEntry.tenantId,
          userId: logEntry.userId,
          sessionId: logEntry.sessionId,
          provider: logEntry.provider,
          model: logEntry.model,
          tokensUsed: logEntry.tokensUsed,
          cost: logEntry.cost,
          latency: logEntry.latency,
          module: logEntry.module,
          action: logEntry.action,
          query: logEntry.query,
          response: logEntry.response,
          success: logEntry.success,
          error: logEntry.error,
          metadata: logEntry.metadata,
          createdAt: logEntry.timestamp
        }
      });

      // Actualizar contadores de suscripción
      await this.updateSubscriptionUsage(logEntry.tenantId, logEntry.provider, logEntry.tokensUsed);

      // Verificar alertas de uso
      await this.checkUsageAlerts(logEntry.tenantId);

    } catch (error: any) {
      console.error('[AI Logging] Error logging AI query:', error);
    }
  }

  /**
   * Actualiza contadores de uso en suscripción
   */
  private async updateSubscriptionUsage(
    tenantId: string,
    provider: string,
    tokensUsed: number
  ): Promise<void> {
    try {
      if (provider === 'openai') {
        await this.prisma.tenantAISubscription.updateMany({
          where: { tenantId },
          data: {
            premiumQueriesUsed: {
              increment: 1
            },
            updatedAt: new Date()
          }
        });
      }
    } catch (error: any) {
      console.error('[AI Logging] Error updating subscription usage:', error);
    }
  }

  /**
   * Verifica alertas de uso
   */
  private async checkUsageAlerts(tenantId: string): Promise<void> {
    try {
      const subscription = await (this.prisma as any).tenantAISubscription.findUnique({
        where: { tenantId }
      });

      if (!subscription || subscription.plan === null) return;

      const usagePercentage = subscription.premiumQueriesLimit > 0
        ? (subscription.premiumQueriesUsed / subscription.premiumQueriesLimit) * 100
        : 0;

      // Alerta al 80% de uso
      if (usagePercentage >= 80 && usagePercentage < 85) {
        await this.createUsageAlert(tenantId, 'warning', 80, usagePercentage);
      }
      
      // Alerta crítica al 95% de uso
      else if (usagePercentage >= 95 && usagePercentage < 100) {
        await this.createUsageAlert(tenantId, 'critical', 95, usagePercentage);
      }

    } catch (error: any) {
      console.error('[AI Logging] Error checking usage alerts:', error);
    }
  }

  /**
   * Crea alerta de uso
   */
  private async createUsageAlert(
    tenantId: string,
    severity: 'warning' | 'critical',
    threshold: number,
    currentUsage: number
  ): Promise<void> {
    try {
      // Evitar alertas duplicadas (cooldown de 24 horas)
      const existingAlert = await (this.prisma as any).aIProactiveAlert.findFirst({
        where: {
          tenantId,
          type: 'usage_alert',
          createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }
      });

      if (existingAlert) return;

      await (this.prisma as any).aIProactiveAlert.create({
        data: {
          tenantId,
          type: 'usage_alert',
          title: `📊 Alerta de Uso IA - ${threshold}% alcanzado`,
          description: `Has utilizado el ${currentUsage.toFixed(1)}% de tu límite mensual de consultas premium.`,
          severity: severity.toUpperCase(),
          category: 'performance',
          source: 'ai_logging',
          sourceData: { threshold, currentUsage },
          recommendations: [
            'Considera optimizar tus consultas',
            'Revisa el reporte de uso detallado',
            'Evalúa upgrade de plan si es necesario'
          ],
          actions: [
            {
              type: 'VIEW_REPORTS',
              description: 'Ver reporte de consumo',
              payload: { type: 'usage_report' }
            }
          ],
          metadata: { usagePercentage: currentUsage },
          acknowledged: false,
          createdAt: new Date()
        }
      });

    } catch (error: any) {
      console.error('[AI Logging] Error creating usage alert:', error);
    }
  }

  /**
   * Obtiene estadísticas de uso
   */
  async getUsageStats(
    tenantId: string,
    dateRange?: { from: Date; to: Date }
  ): Promise<AILoggingStats> {
    try {
      const whereClause: any = { tenantId };
      
      if (dateRange) {
        whereClause.createdAt = {
          gte: dateRange.from,
          lte: dateRange.to
        };
      }

      // Estadísticas generales
      const totalStats = await (this.prisma as any).aIUsageLog.aggregate({
        where: whereClause,
        _sum: {
          tokensUsed: true,
          cost: true,
          latency: true
        },
        _count: true,
        where: { success: true }
      });

      const errorCount = await (this.prisma as any).aIUsageLog.count({
        where: { ...whereClause, success: false }
      });

      // Breakdown por proveedor
      const providerStats = await (this.prisma as any).aIUsageLog.groupBy({
        by: ['provider'],
        where: { ...whereClause, success: true },
        _sum: {
          tokensUsed: true,
          cost: true
        },
        _count: true
      });

      // Breakdown por módulo
      const moduleStats = await (this.prisma as any).aIUsageLog.groupBy({
        by: ['module'],
        where: { ...whereClause, success: true },
        _sum: {
          tokensUsed: true,
          cost: true
        },
        _count: true
      });

      // Uso diario (últimos 30 días)
      const dailyStats = await this.getDailyUsageStats(tenantId, 30);

      // Top usuarios
      const topUsers = await this.getTopUsers(tenantId, 10);

      const totalQueries = totalStats._count || 0;
      const totalTokens = totalStats._sum.tokensUsed || 0;
      const totalCost = totalStats._sum.cost || 0;
      const avgLatency = totalQueries > 0 
        ? (totalStats._sum.latency || 0) / totalQueries 
        : 0;
      const successRate = totalQueries + errorCount > 0
        ? (totalQueries / (totalQueries + errorCount)) * 100
        : 0;

      return {
        totalQueries,
        totalTokens,
        totalCost,
        averageLatency: Math.round(avgLatency),
        successRate: Math.round(successRate * 100) / 100,
        providerBreakdown: {
          groq: {
            queries: providerStats.find(p => p.provider === 'groq')?._count || 0,
            tokens: providerStats.find(p => p.provider === 'groq')?._sum.tokensUsed || 0,
            cost: providerStats.find(p => p.provider === 'groq')?._sum.cost || 0
          },
          openai: {
            queries: providerStats.find(p => p.provider === 'openai')?._count || 0,
            tokens: providerStats.find(p => p.provider === 'openai')?._sum.tokensUsed || 0,
            cost: providerStats.find(p => p.provider === 'openai')?._sum.cost || 0
          }
        },
        moduleBreakdown: moduleStats.reduce((acc, stat) => {
          acc[stat.module] = {
            queries: stat._count,
            tokens: stat._sum.tokensUsed || 0,
            cost: stat._sum.cost || 0
          };
          return acc;
        }, {} as Record<string, { queries: number; tokens: number; cost: number }>),
        dailyUsage: dailyStats,
        topUsers
      };

    } catch (error: any) {
      console.error('[AI Logging] Error getting usage stats:', error);
      return this.getEmptyStats();
    }
  }

  /**
   * Obtiene estadísticas diarias de uso
   */
  private async getDailyUsageStats(tenantId: string, days: number): Promise<any[]> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const dailyStats = await this.prisma.$queryRawUnsafe(`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as queries,
          COALESCE(SUM(tokens_used), 0) as tokens,
          COALESCE(SUM(cost), 0) as cost
        FROM "AIUsageLog"
        WHERE tenant_id = $1 
          AND created_at >= $2
          AND success = true
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `, tenantId, startDate);

      return (dailyStats as any[]).map(stat => ({
        date: stat.date,
        queries: parseInt(stat.queries),
        tokens: parseInt(stat.tokens),
        cost: parseFloat(stat.cost)
      }));

    } catch (error: any) {
      console.error('[AI Logging] Error getting daily usage stats:', error);
      return [];
    }
  }

  /**
   * Obtiene top usuarios
   */
  private async getTopUsers(tenantId: string, limit: number): Promise<any[]> {
    try {
      const topUsers = await this.prisma.$queryRawUnsafe(`
        SELECT 
          user_id,
          COUNT(*) as queries,
          COALESCE(SUM(tokens_used), 0) as tokens,
          COALESCE(SUM(cost), 0) as cost
        FROM "AIUsageLog"
        WHERE tenant_id = $1 
          AND success = true
          AND created_at >= NOW() - INTERVAL '30 days'
        GROUP BY user_id
        ORDER BY queries DESC
        LIMIT $2
      `, tenantId, limit);

      return (topUsers as any[]).map(user => ({
        userId: user.user_id,
        queries: parseInt(user.queries),
        tokens: parseInt(user.tokens),
        cost: parseFloat(user.cost)
      }));

    } catch (error: any) {
      console.error('[AI Logging] Error getting top users:', error);
      return [];
    }
  }

  /**
   * Genera reporte de consumo detallado
   */
  async generateUsageReport(
    tenantId: string,
    format: 'json' | 'csv' | 'pdf' = 'json'
  ): Promise<any> {
    try {
      const stats = await this.getUsageStats(tenantId);
      const dateRange = {
        from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        to: new Date()
      };

      const report = {
        tenantId,
        generatedAt: new Date(),
        period: {
          from: dateRange.from,
          to: dateRange.to
        },
        summary: {
          totalQueries: stats.totalQueries,
          totalTokens: stats.totalTokens,
          totalCost: stats.totalCost,
          averageLatency: stats.averageLatency,
          successRate: stats.successRate
        },
        providers: stats.providerBreakdown,
        modules: stats.moduleBreakdown,
        dailyUsage: stats.dailyUsage,
        topUsers: stats.topUsers,
        insights: this.generateInsights(stats),
        recommendations: this.generateRecommendations(stats)
      };

      if (format === 'csv') {
        return this.convertToCSV(report);
      }

      return report;

    } catch (error: any) {
      console.error('[AI Logging] Error generating usage report:', error);
      throw error;
    }
  }

  /**
   * Genera insights del uso
   */
  private generateInsights(stats: AILoggingStats): string[] {
    const insights: string[] = [];

    // Insight de proveedor más usado
    const groqCost = stats.providerBreakdown.groq.cost;
    const openaiCost = stats.providerBreakdown.openai.cost;
    
    if (openaiCost > groqCost * 2) {
      insights.push('Estás utilizando OpenAI significativamente más que Groq. Considera optimizar costos.');
    }

    // Insight de módulos
    const topModule = Object.entries(stats.moduleBreakdown)
      .sort(([,a], [,b]) => b.cost - a.cost)[0];
    
    if (topModule) {
      insights.push(`El módulo más utilizado es "${topModule[0]}" con ${topModule[1].queries} consultas.`);
    }

    // Insight de eficiencia
    if (stats.averageLatency > 3000) {
      insights.push('La latencia promedio es alta. Considera optimizar consultas o revisar conectividad.');
    }

    // Insight de éxito
    if (stats.successRate < 95) {
      insights.push('La tasa de éxito es inferior al 95%. Revisa los errores y optimiza consultas.');
    }

    return insights;
  }

  /**
   * Genera recomendaciones
   */
  private generateRecommendations(stats: AILoggingStats): string[] {
    const recommendations: string[] = [];

    // Recomendación de costos
    if (stats.providerBreakdown.openai.cost > stats.providerBreakdown.groq.cost * 3) {
      recommendations.push('Considera usar más Groq para consultas simples y reservar OpenAI para análisis complejos.');
    }

    // Recomendación de uso
    if (stats.totalCost > 100) {
      recommendations.push('Tu consumo mensual es elevado. Evalúa un plan Enterprise para mejores tarifas.');
    }

    // Recomendación de módulos
    const lowUsageModules = Object.entries(stats.moduleBreakdown)
      .filter(([, stats]) => stats.queries < 5)
      .map(([module]) => module);
    
    if (lowUsageModules.length > 0) {
      recommendations.push(`Módulos con bajo uso: ${lowUsageModules.join(', ')}. Explora más funcionalidades.`);
    }

    return recommendations;
  }

  /**
   * Convierte reporte a CSV
   */
  private convertToCSV(report: any): string {
    const headers = [
      'Fecha',
      'Consultas',
      'Tokens',
      'Costo (USD)',
      'Latencia (ms)',
      'Proveedor',
      'Módulo',
      'Éxito'
    ];

    const rows = report.dailyUsage.map((day: any) => [
      day.date,
      day.queries,
      day.tokens,
      day.cost.toFixed(4),
      '', // Latencia no disponible en daily stats
      '', // Provider no disponible en daily stats
      '', // Module no disponible en daily stats
      ''  // Success no disponible en daily stats
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  /**
   * Obtiene estadísticas vacías
   */
  private getEmptyStats(): AILoggingStats {
    return {
      totalQueries: 0,
      totalTokens: 0,
      totalCost: 0,
      averageLatency: 0,
      successRate: 0,
      providerBreakdown: {
        groq: { queries: 0, tokens: 0, cost: 0 },
        openai: { queries: 0, tokens: 0, cost: 0 }
      },
      moduleBreakdown: {},
      dailyUsage: [],
      topUsers: []
    };
  }

  /**
   * Limpia logs antiguos
   */
  async cleanupOldLogs(tenantId: string, daysToKeep: number = 90): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const result = await this.prisma.$executeRawUnsafe(`
        DELETE FROM "AIUsageLog"
        WHERE tenant_id = $1 AND created_at < $2
      `, tenantId, cutoffDate);

      console.log(`[AI Logging] Cleaned up ${result} old logs for tenant ${tenantId}`);

    } catch (error: any) {
      console.error('[AI Logging] Error cleaning up old logs:', error);
    }
  }

  /**
   * Exporta logs para análisis externo
   */
  async exportLogs(
    tenantId: string,
    dateRange?: { from: Date; to: Date },
    format: 'json' | 'csv' = 'json'
  ): Promise<any> {
    try {
      const whereClause: any = { tenantId };
      
      if (dateRange) {
        whereClause.createdAt = {
          gte: dateRange.from,
          lte: dateRange.to
        };
      }

      const logs = await (this.prisma as any).aIUsageLog.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: 10000 // Limitar para no sobrecargar
      });

      if (format === 'csv') {
        const headers = [
          'Timestamp', 'User ID', 'Provider', 'Model', 'Tokens', 
          'Cost', 'Latency', 'Module', 'Action', 'Success'
        ];
        
        const rows = logs.map((log: any) => [
          log.createdAt,
          log.userId,
          log.provider,
          log.model,
          log.tokensUsed,
          log.cost,
          log.latency,
          log.module,
          log.action,
          log.success
        ]);

        return [headers, ...rows].map(row => row.join(',')).join('\n');
      }

      return logs;

    } catch (error: any) {
      console.error('[AI Logging] Error exporting logs:', error);
      throw error;
    }
  }

  /**
   * Analiza patrones de uso
   */
  async analyzeUsagePatterns(tenantId: string): Promise<any> {
    try {
      // Patrones temporales
      const hourlyPattern = await this.getHourlyUsagePattern(tenantId);
      const weeklyPattern = await this.getWeeklyUsagePattern(tenantId);

      // Patrones de comportamiento
      const queryPatterns = await this.getQueryPatterns(tenantId);
      const errorPatterns = await this.getErrorPatterns(tenantId);

      return {
        temporal: {
          hourly: hourlyPattern,
          weekly: weeklyPattern
        },
        behavioral: {
          queries: queryPatterns,
          errors: errorPatterns
        },
        recommendations: this.generatePatternRecommendations({
          hourly: hourlyPattern,
          weekly: weeklyPattern,
          queries: queryPatterns,
          errors: errorPatterns
        })
      };

    } catch (error: any) {
      console.error('[AI Logging] Error analyzing usage patterns:', error);
      return {};
    }
  }

  /**
   * Obtiene patrón de uso por hora
   */
  private async getHourlyUsagePattern(tenantId: string): Promise<any> {
    try {
      const pattern = await this.prisma.$queryRawUnsafe(`
        SELECT 
          EXTRACT(HOUR FROM created_at) as hour,
          COUNT(*) as queries,
          COALESCE(SUM(tokens_used), 0) as tokens
        FROM "AIUsageLog"
        WHERE tenant_id = $1 
          AND created_at >= NOW() - INTERVAL '30 days'
          AND success = true
        GROUP BY EXTRACT(HOUR FROM created_at)
        ORDER BY hour
      `, tenantId);

      return (pattern as any[]).reduce((acc, item) => {
        acc[item.hour] = {
          queries: parseInt(item.queries),
          tokens: parseInt(item.tokens)
        };
        return acc;
      }, {});

    } catch (error: any) {
      console.error('[AI Logging] Error getting hourly pattern:', error);
      return {};
    }
  }

  /**
   * Obtiene patrón de uso semanal
   */
  private async getWeeklyUsagePattern(tenantId: string): Promise<any> {
    try {
      const pattern = await this.prisma.$queryRawUnsafe(`
        SELECT 
          EXTRACT(DOW FROM created_at) as day_of_week,
          COUNT(*) as queries,
          COALESCE(SUM(tokens_used), 0) as tokens
        FROM "AIUsageLog"
        WHERE tenant_id = $1 
          AND created_at >= NOW() - INTERVAL '30 days'
          AND success = true
        GROUP BY EXTRACT(DOW FROM created_at)
        ORDER BY day_of_week
      `, tenantId);

      const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      
      return (pattern as any[]).reduce((acc, item) => {
        const dayName = dayNames[item.day_of_week];
        acc[dayName] = {
          queries: parseInt(item.queries),
          tokens: parseInt(item.tokens)
        };
        return acc;
      }, {});

    } catch (error: any) {
      console.error('[AI Logging] Error getting weekly pattern:', error);
      return {};
    }
  }

  /**
   * Obtiene patrones de consultas
   */
  private async getQueryPatterns(tenantId: string): Promise<any> {
    try {
      const patterns = await this.prisma.$queryRawUnsafe(`
        SELECT 
          module,
          action,
          COUNT(*) as count,
          AVG(tokens_used) as avg_tokens,
          AVG(latency) as avg_latency
        FROM "AIUsageLog"
        WHERE tenant_id = $1 
          AND created_at >= NOW() - INTERVAL '30 days'
          AND success = true
        GROUP BY module, action
        ORDER BY count DESC
        LIMIT 20
      `, tenantId);

      return (patterns as any[]).map(pattern => ({
        module: pattern.module,
        action: pattern.action,
        count: parseInt(pattern.count),
        avgTokens: Math.round(pattern.avg_tokens),
        avgLatency: Math.round(pattern.avg_latency)
      }));

    } catch (error: any) {
      console.error('[AI Logging] Error getting query patterns:', error);
      return [];
    }
  }

  /**
   * Obtiene patrones de error
   */
  private async getErrorPatterns(tenantId: string): Promise<any> {
    try {
      const patterns = await this.prisma.$queryRawUnsafe(`
        SELECT 
          provider,
          error,
          COUNT(*) as count
        FROM "AIUsageLog"
        WHERE tenant_id = $1 
          AND created_at >= NOW() - INTERVAL '30 days'
          AND success = false
          AND error IS NOT NULL
        GROUP BY provider, error
        ORDER BY count DESC
        LIMIT 10
      `, tenantId);

      return (patterns as any[]).map(pattern => ({
        provider: pattern.provider,
        error: pattern.error,
        count: parseInt(pattern.count)
      }));

    } catch (error: any) {
      console.error('[AI Logging] Error getting error patterns:', error);
      return [];
    }
  }

  /**
   * Genera recomendaciones basadas en patrones
   */
  private generatePatternRecommendations(patterns: any): string[] {
    const recommendations: string[] = [];

    // Recomendaciones horarias
    const hourlyPeak = Object.entries(patterns.hourly)
      .sort(([,a]: any, [,b]: any) => b.queries - a.queries)[0];
    
    if (hourlyPeak) {
      recommendations.push(`Tu hora pico de uso es a las ${hourlyPeak[0]}:00. Considera programar tareas pesadas en horas menos congestionadas.`);
    }

    // Recomendaciones semanales
    const weeklyPeak = Object.entries(patterns.weekly)
      .sort(([,a]: any, [,b]: any) => b.queries - a.queries)[0];
    
    if (weeklyPeak) {
      recommendations.push(`Tu día más activo es ${weeklyPeak[0]}. Asegúrate de tener disponibilidad adecuada.`);
    }

    // Recomendaciones de errores
    if (patterns.errors.length > 0) {
      recommendations.push(`Se detectaron ${patterns.errors.length} patrones de error. Revisa la configuración de consultas.`);
    }

    return recommendations;
  }
}

export default AILoggingEngine;
