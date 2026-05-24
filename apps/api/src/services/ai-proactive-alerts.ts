/**
 * AI PROACTIVE ALERTS ENGINE
 * SGI360 Command Center - Detección inteligente de riesgos y oportunidades
 * 
 * Analiza datos del tenant para generar alertas proactivas:
 * - Desviaciones en KPIs
 * - Riesgos de cumplimiento
 * - Oportunidades de mejora
 * - Tendencias anómalas
 * - Alertas de seguridad
 */

import { PrismaClient } from '@prisma/client';
import { AIOrchestrator } from './ai-orchestrator';

interface AlertSeverity {
  LOW: 'low';
  MEDIUM: 'medium';
  HIGH: 'high';
  CRITICAL: 'critical';
}

interface ProactiveAlert {
  id: string;
  tenantId: string;
  type: string;
  title: string;
  description: string;
  severity: keyof AlertSeverity;
  category: 'risk' | 'opportunity' | 'compliance' | 'performance' | 'security';
  source: string;
  sourceData: any;
  recommendations: string[];
  actions: Array<{
    type: string;
    description: string;
    entityId?: string;
    payload?: any;
  }>;
  metadata: any;
  createdAt: Date;
  expiresAt?: Date;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}

interface AlertRule {
  id: string;
  name: string;
  description: string;
  type: string;
  enabled: boolean;
  conditions: any;
  severity: keyof AlertSeverity;
  category: string;
  cooldown: number; // minutos
  lastTriggered?: Date;
}

export class AIProactiveAlertsEngine {
  private prisma: PrismaClient;
  private aiOrchestrator: AIOrchestrator;

  constructor(prisma: PrismaClient, aiOrchestrator: AIOrchestrator) {
    this.prisma = prisma;
    this.aiOrchestrator = aiOrchestrator;
  }

  /**
   * Genera alertas proactivas para un tenant
   */
  async generateProactiveAlerts(tenantId: string): Promise<ProactiveAlert[]> {
    const alerts: ProactiveAlert[] = [];

    try {
      // 1. Alertas de KPIs y rendimiento
      alerts.push(...await this.checkPerformanceAlerts(tenantId));
      
      // 2. Alertas de cumplimiento y riesgos
      alerts.push(...await this.checkComplianceAlerts(tenantId));
      
      // 3. Alertas de seguridad
      alerts.push(...await this.checkSecurityAlerts(tenantId));
      
      // 4. Alertas de oportunidades
      alerts.push(...await this.checkOpportunityAlerts(tenantId));
      
      // 5. Alertas de tendencias
      alerts.push(...await this.checkTrendAlerts(tenantId));
      
      // Guardar alertas nuevas
      await this.saveAlerts(tenantId, alerts);
      
      return alerts;
      
    } catch (error: any) {
      console.error('[Proactive Alerts] Error generating alerts:', error);
      return [];
    }
  }

  /**
   * Alertas de rendimiento y KPIs
   */
  private async checkPerformanceAlerts(tenantId: string): Promise<ProactiveAlert[]> {
    const alerts: ProactiveAlert[] = [];

    try {
      // Verificar proyectos con desviaciones
      const projects = await (this.prisma as any).project360?.findMany?.({
        where: { tenantId },
        include: { _count: { select: { tasks: true } } }
      }) || [];

      for (const project of projects) {
        const progress = project.progress || 0;
        const expectedProgress = this.calculateExpectedProgress(project.startDate, project.endDate);
        
        if (progress < expectedProgress - 20) {
          alerts.push({
            id: `project-delay-${project.id}`,
            tenantId,
            type: 'project_delay',
            title: `Proyecto "${project.name}" con retraso significativo`,
            description: `El proyecto tiene ${progress}% de progreso pero debería tener ${expectedProgress}% según la fecha actual.`,
            severity: 'HIGH',
            category: 'performance',
            source: 'project360',
            sourceData: { projectId: project.id, currentProgress: progress, expectedProgress },
            recommendations: [
              'Revisar asignación de recursos',
              'Evaluar reprogramación de hitos',
              'Considerar aumento de equipo'
            ],
            actions: [
              {
                type: 'CREATE_TASK',
                description: 'Crear tarea de revisión de proyecto',
                entityId: project.id,
                payload: { priority: 'HIGH', dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }
              }
            ],
            metadata: { projectName: project.name },
            createdAt: new Date(),
            acknowledged: false
          });
        }
      }

      // Verificar NCRs sin resolver
      const ncrs = await this.prisma.nonConformity.findMany({
        where: { 
          tenantId,
          status: { in: ['OPEN', 'IN_PROGRESS'] },
          createdAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Más de 30 días
        }
      });

      if (ncrs.length > 0) {
        alerts.push({
          id: `ncr-overdue-${Date.now()}`,
          tenantId,
          type: 'ncr_overdue',
          title: `${ncrs.length} No Conformidades sin resolver (>30 días)`,
          description: `Hay ${ncrs.length} NCRs abiertas por más de 30 días que requieren atención urgente.`,
          severity: 'HIGH',
          category: 'risk',
          source: 'ncr',
          sourceData: { ncrIds: ncrs.map(ncr => ncr.id), count: ncrs.length },
          recommendations: [
            'Priorizar resolución de NCRs antiguas',
            'Revisar causas raíz',
            'Implementar acciones correctivas inmediatas'
          ],
            actions: [
              {
                type: 'CREATE_CAPA',
                description: 'Crear CAPA para NCRs urgentes',
                payload: { ncrIds: ncrs.slice(0, 3).map(ncr => ncr.id) }
              }
            ],
          metadata: { ncrCount: ncrs.length },
          createdAt: new Date(),
          acknowledged: false
        });
      }

    } catch (error: any) {
      console.error('[Proactive Alerts] Error checking performance alerts:', error);
    }

    return alerts;
  }

  /**
   * Alertas de cumplimiento y riesgos
   */
  private async checkComplianceAlerts(tenantId: string): Promise<ProactiveAlert[]> {
    const alerts: ProactiveAlert[] = [];

    try {
      // Verificar auditorías vencidas
      const audits = await (this.prisma as any).audit?.findMany?.({
        where: { 
          tenantId,
          status: 'SCHEDULED',
          plannedDate: { lt: new Date() }
        }
      }) || [];

      if (audits.length > 0) {
        alerts.push({
          id: `audit-overdue-${Date.now()}`,
          tenantId,
          type: 'audit_overdue',
          title: `${audits.length} Auditorías programadas vencidas`,
          description: `Hay ${audits.length} auditorías que deberían haberse realizado y están pendientes.`,
          severity: 'CRITICAL',
          category: 'compliance',
          source: 'audit',
          sourceData: { auditIds: audits.map(a => a.id) },
          recommendations: [
            'Programar auditorías inmediatamente',
            'Notificar al equipo de auditoría',
            'Documentar razones del retraso'
          ],
          actions: [
            {
              type: 'SCHEDULE_EVENT',
              description: 'Reprogramar auditorías vencidas',
              payload: { auditIds: audits.map(a => a.id) }
            }
          ],
          metadata: { auditCount: audits.length },
          createdAt: new Date(),
          acknowledged: false
        });
      }

      // Verificar capacitaciones vencidas
      const trainings = await (this.prisma as any).training?.findMany?.({
        where: {
          tenantId,
          status: 'COMPLETED',
          validityEndDate: { lt: new Date() }
        }
      }) || [];

      if (trainings.length > 5) {
        alerts.push({
          id: `training-expired-${Date.now()}`,
          tenantId,
          type: 'training_expired',
          title: `${trainings.length} Capacitaciones con certificación vencida`,
          description: `Hay ${trainings.length} capacitaciones cuyas certificaciones han expirado y requieren renovación.`,
          severity: 'MEDIUM',
          category: 'compliance',
          source: 'training',
          sourceData: { trainingIds: trainings.map(t => t.id) },
          recommendations: [
            'Programar capacitaciones de refresco',
            'Actualizar matriz de competencias',
            'Notificar a empleados afectados'
          ],
          actions: [
            {
              type: 'CREATE_TASK',
              description: 'Planificar renovación de capacitaciones',
              payload: { trainingIds: trainings.slice(0, 5).map(t => t.id) }
            }
          ],
          metadata: { trainingCount: trainings.length },
          createdAt: new Date(),
          acknowledged: false
        });
      }

    } catch (error: any) {
      console.error('[Proactive Alerts] Error checking compliance alerts:', error);
    }

    return alerts;
  }

  /**
   * Alertas de seguridad
   */
  private async checkSecurityAlerts(tenantId: string): Promise<ProactiveAlert[]> {
    const alerts: ProactiveAlert[] = [];

    try {
      // Verificar accesos sospechosos (simulado)
      const recentFailedLogins = await this.prisma.auditEvent?.findMany?.({
        where: {
          tenantId,
          action: 'LOGIN_FAILED',
          createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }
      }) || [];

      if (recentFailedLogins.length > 10) {
        alerts.push({
          id: `security-brute-${Date.now()}`,
          tenantId,
          type: 'brute_force_attempt',
          title: 'Intento de ataque por fuerza bruta detectado',
          description: `Se detectaron ${recentFailedLogins.length} intentos de login fallidos en las últimas 24 horas.`,
          severity: 'HIGH',
          category: 'security',
          source: 'audit',
          sourceData: { failedAttempts: recentFailedLogins.length },
          recommendations: [
            'Revisar logs de acceso',
            'Considerar bloqueo de IPs sospechosas',
            'Forzar cambio de contraseñas'
          ],
          actions: [
            {
              type: 'SEND_NOTIFICATION',
              description: 'Notificar al administrador de seguridad',
              payload: { priority: 'URGENT', channel: 'EMAIL' }
            }
          ],
          metadata: { failedAttempts: recentFailedLogins.length },
          createdAt: new Date(),
          acknowledged: false
        });
      }

    } catch (error: any) {
      console.error('[Proactive Alerts] Error checking security alerts:', error);
    }

    return alerts;
  }

  /**
   * Alertas de oportunidades
   */
  private async checkOpportunityAlerts(tenantId: string): Promise<ProactiveAlert[]> {
    const alerts: ProactiveAlert[] = [];

    try {
      // Detectar proyectos con alto ROI potencial
      const projects = await (this.prisma as any).project360?.findMany?.({
        where: { 
          tenantId,
          status: 'COMPLETED',
          actualCost: { lt: 10000 }, // Proyectos económicos
          progress: 100
        }
      }) || [];

      if (projects.length > 2) {
        alerts.push({
          id: `opportunity-scaling-${Date.now()}`,
          tenantId,
          type: 'scaling_opportunity',
          title: 'Oportunidad de escalamiento de proyectos exitosos',
          description: `Se han completado ${projects.length} proyectos económicos con éxito. Considerar escalar estos modelos.`,
          severity: 'MEDIUM',
          category: 'opportunity',
          source: 'project360',
          sourceData: { projectIds: projects.map(p => p.id) },
          recommendations: [
            'Analizar factores de éxito comunes',
            'Crear plantillas de proyectos replicables',
            'Identificar áreas para expansión'
          ],
          actions: [
            {
              type: 'CREATE_PROJECT',
              description: 'Crear proyecto de análisis de factores de éxito',
              payload: { 
                type: 'ANALYSIS',
                title: 'Análisis de factores de éxito de proyectos',
                budget: 5000
              }
            }
          ],
          metadata: { projectCount: projects.length },
          createdAt: new Date(),
          acknowledged: false
        });
      }

    } catch (error: any) {
      console.error('[Proactive Alerts] Error checking opportunity alerts:', error);
    }

    return alerts;
  }

  /**
   * Alertas de tendencias
   */
  private async checkTrendAlerts(tenantId: string): Promise<ProactiveAlert[]> {
    const alerts: ProactiveAlert[] = [];

    try {
      // Analizar tendencia de NCRs (usando AI)
      const ncrTrend = await this.analyzeNCRTrend(tenantId);
      
      if (ncrTrend.increasing && ncrTrend.rate > 0.2) {
        alerts.push({
          id: `trend-ncr-increasing-${Date.now()}`,
          tenantId,
          type: 'ncr_trend_increasing',
          title: 'Tendencia creciente en No Conformidades',
          description: `Se detectó un aumento del ${(ncrTrend.rate * 100).toFixed(1)}% en NCRs en los últimos 30 días.`,
          severity: 'HIGH',
          category: 'risk',
          source: 'ai_analysis',
          sourceData: { trend: ncrTrend },
          recommendations: [
            'Investigar causas del aumento',
            'Revisar procesos críticos',
            'Implementar medidas preventivas'
          ],
          actions: [
            {
              type: 'ANALYZE_DATA',
              description: 'Análisis profundo de tendencia de NCRs',
              payload: { type: 'NCR_TREND', timeframe: '30d' }
            }
          ],
          metadata: { trend: ncrTrend },
          createdAt: new Date(),
          acknowledged: false
        });
      }

    } catch (error: any) {
      console.error('[Proactive Alerts] Error checking trend alerts:', error);
    }

    return alerts;
  }

  /**
   * Analiza tendencia de NCRs usando IA
   */
  private async analyzeNCRTrend(tenantId: string): Promise<any> {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

      const recentNCRs = await this.prisma.nonConformity.count({
        where: { 
          tenantId,
          createdAt: { gte: thirtyDaysAgo }
        }
      });

      const previousNCRs = await this.prisma.nonConformity.count({
        where: { 
          tenantId,
          createdAt: { 
            gte: sixtyDaysAgo,
            lt: thirtyDaysAgo
          }
        }
      });

      const rate = previousNCRs > 0 ? (recentNCRs - previousNCRs) / previousNCRs : 0;

      return {
        recent: recentNCRs,
        previous: previousNCRs,
        rate,
        increasing: rate > 0.1
      };

    } catch (error: any) {
      console.error('[Proactive Alerts] Error analyzing NCR trend:', error);
      return { recent: 0, previous: 0, rate: 0, increasing: false };
    }
  }

  /**
   * Guarda alertas en la base de datos
   */
  private async saveAlerts(tenantId: string, alerts: ProactiveAlert[]): Promise<void> {
    try {
      for (const alert of alerts) {
        // Verificar si ya existe una alerta similar (cooldown)
        const existing = await (this.prisma as any).aIProactiveAlert.findFirst({
          where: {
            tenantId,
            type: alert.type,
            createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) } // 1 hora cooldown
          }
        });

        if (!existing) {
          await (this.prisma as any).aIProactiveAlert.create({
            data: {
              tenantId,
              type: alert.type,
              title: alert.title,
              description: alert.description,
              severity: alert.severity,
              category: alert.category,
              source: alert.source,
              sourceData: alert.sourceData,
              recommendations: alert.recommendations,
              actions: alert.actions,
              metadata: alert.metadata,
              acknowledged: false,
              createdAt: alert.createdAt
            }
          });
        }
      }
    } catch (error: any) {
      console.error('[Proactive Alerts] Error saving alerts:', error);
    }
  }

  /**
   * Obtiene alertas activas
   */
  async getActiveAlerts(tenantId: string, severity?: keyof AlertSeverity): Promise<ProactiveAlert[]> {
    try {
      const where: any = {
        tenantId,
        acknowledged: false,
        createdAt: { gt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Últimos 7 días
      };

      if (severity) {
        where.severity = severity;
      }

      const alerts = await (this.prisma as any).aIProactiveAlert.findMany({
        where,
        orderBy: [
          { severity: 'desc' },
          { createdAt: 'desc' }
        ]
      });

      return alerts.map((alert: any) => ({
        ...alert,
        actions: alert.actions || []
      }));

    } catch (error: any) {
      console.error('[Proactive Alerts] Error getting active alerts:', error);
      return [];
    }
  }

  /**
   * Reconoce una alerta
   */
  async acknowledgeAlert(alertId: string, userId: string): Promise<boolean> {
    try {
      await (this.prisma as any).aIProactiveAlert.update({
        where: { id: alertId },
        data: {
          acknowledged: true,
          acknowledgedBy: userId,
          acknowledgedAt: new Date()
        }
      });

      return true;
    } catch (error: any) {
      console.error('[Proactive Alerts] Error acknowledging alert:', error);
      return false;
    }
  }

  /**
   * Calcula progreso esperado de un proyecto
   */
  private calculateExpectedProgress(startDate: Date, endDate: Date): number {
    if (!startDate || !endDate) return 0;

    const total = endDate.getTime() - startDate.getTime();
    const elapsed = Date.now() - startDate.getTime();
    
    return Math.max(0, Math.min(100, (elapsed / total) * 100));
  }

  /**
   * Ejecuta acción sugerida por alerta
   */
  async executeAlertAction(
    alertId: string, 
    actionIndex: number, 
    userId: string
  ): Promise<any> {
    try {
      const alert = await (this.prisma as any).aIProactiveAlert.findUnique({
        where: { id: alertId }
      });

      if (!alert || !alert.actions[actionIndex]) {
        throw new Error('Alert or action not found');
      }

      const action = alert.actions[actionIndex];
      
      // Aquí se delegaría al Action Engine
      // Por ahora, retornamos la acción para ejecución manual
      
      return {
        success: true,
        action,
        message: 'Acción lista para ejecutar'
      };

    } catch (error: any) {
      console.error('[Proactive Alerts] Error executing alert action:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Obtiene estadísticas de alertas
   */
  async getAlertStats(tenantId: string): Promise<any> {
    try {
      const stats = await (this.prisma as any).aIProactiveAlert.groupBy({
        by: ['severity', 'category', 'acknowledged'],
        where: {
          tenantId,
          createdAt: { gt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        },
        _count: true
      });

      return {
        total: stats.reduce((sum: number, s: any) => sum + s._count, 0),
        bySeverity: stats.reduce((acc: any, s: any) => {
          acc[s.severity] = (acc[s.severity] || 0) + s._count;
          return acc;
        }, {}),
        byCategory: stats.reduce((acc: any, s: any) => {
          acc[s.category] = (acc[s.category] || 0) + s._count;
          return acc;
        }, {}),
        acknowledged: stats.filter((s: any) => s.acknowledged).reduce((sum: number, s: any) => sum + s._count, 0)
      };

    } catch (error: any) {
      console.error('[Proactive Alerts] Error getting alert stats:', error);
      return {};
    }
  }
}

export default AIProactiveAlertsEngine;
