/**
 * AI INSIGHTS ENGINE
 * SGI360 Command Center - Generador de Insights Proactivos con Datos Reales
 * 
 * Escanea datos reales del tenant y genera insights accionables:
 * - Tendencias de NCRs y calidad
 * - Riesgos operativos detectados
 * - Patrones de flota/mantenimiento
 * - Indicadores de RRHH
 * - Estado de proyectos y alertas
 * - Cumplimiento y auditorías
 */

import { PrismaClient } from '@prisma/client';

export interface ProactiveInsight {
  id: string;
  type: 'trend' | 'alert' | 'opportunity' | 'anomaly' | 'prediction' | 'recommendation';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: 'quality' | 'risk' | 'fleet' | 'hr' | 'projects' | 'compliance' | 'financial' | 'operational';
  title: string;
  description: string;
  metric?: { current: number; previous?: number; change?: number; unit?: string };
  recommendations: string[];
  relatedEntities?: Array<{ type: string; id: string; name: string }>;
  confidence: number;
  createdAt: Date;
  expiresAt?: Date;
}

export class AIInsightsEngine {
  private prisma: PrismaClient;
  private db: any;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.db = prisma as any;
  }

  /**
   * Genera todos los insights para un tenant escaneando datos reales
   */
  async generateInsights(tenantId: string): Promise<ProactiveInsight[]> {
    const insights: ProactiveInsight[] = [];

    const results = await Promise.allSettled([
      this.analyzeNCRTrends(tenantId),
      this.analyzeRiskStatus(tenantId),
      this.analyzeFleetHealth(tenantId),
      this.analyzeProjectHealth(tenantId),
      this.analyzeHRIndicators(tenantId),
      this.analyzeAuditFindings(tenantId),
      this.analyzeCalibrations(tenantId),
      this.analyzeDocumentCompliance(tenantId),
    ]);

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        insights.push(...result.value);
      }
    }

    // Ordenar por severidad y confianza
    const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    insights.sort((a, b) => {
      const sevDiff = (severityOrder[a.severity] || 4) - (severityOrder[b.severity] || 4);
      if (sevDiff !== 0) return sevDiff;
      return b.confidence - a.confidence;
    });

    return insights;
  }

  // ── NCR / Calidad ───────────────────────────────────────────
  private async analyzeNCRTrends(tenantId: string): Promise<ProactiveInsight[]> {
    const insights: ProactiveInsight[] = [];
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
      const sixtyDaysAgo = new Date(now.getTime() - 60 * 86400000);

      const [openNCRs, recentNCRs, previousNCRs, criticalNCRs] = await Promise.all([
        this.db.nonConformity?.count({ where: { tenantId, status: { not: 'CLOSED' }, deletedAt: null } }).catch(() => 0),
        this.db.nonConformity?.count({ where: { tenantId, createdAt: { gte: thirtyDaysAgo }, deletedAt: null } }).catch(() => 0),
        this.db.nonConformity?.count({ where: { tenantId, createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo }, deletedAt: null } }).catch(() => 0),
        this.db.nonConformity?.count({ where: { tenantId, severity: { in: ['CRITICAL', 'HIGH'] }, status: { not: 'CLOSED' }, deletedAt: null } }).catch(() => 0),
      ]);

      if (openNCRs > 0) {
        insights.push({
          id: `ncr-open-${tenantId}`,
          type: criticalNCRs > 0 ? 'alert' : 'trend',
          severity: criticalNCRs > 3 ? 'critical' : criticalNCRs > 0 ? 'high' : openNCRs > 10 ? 'medium' : 'low',
          category: 'quality',
          title: `${openNCRs} No Conformidades abiertas`,
          description: criticalNCRs > 0
            ? `Hay ${criticalNCRs} NCRs de severidad crítica/alta pendientes de resolución. Se requiere atención inmediata.`
            : `Existen ${openNCRs} NCRs abiertas en el sistema. Revise las pendientes de mayor antigüedad.`,
          metric: { current: openNCRs, unit: 'NCRs abiertas' },
          recommendations: [
            ...(criticalNCRs > 0 ? ['Priorizar las NCRs críticas/altas para resolución inmediata'] : []),
            'Asignar responsables a NCRs sin propietario',
            'Revisar tendencia mensual para identificar áreas problemáticas',
          ],
          confidence: 0.95,
          createdAt: now,
        });
      }

      if (recentNCRs > 0 && previousNCRs > 0) {
        const change = ((recentNCRs - previousNCRs) / previousNCRs) * 100;
        if (Math.abs(change) > 20) {
          insights.push({
            id: `ncr-trend-${tenantId}`,
            type: change > 0 ? 'alert' : 'opportunity',
            severity: change > 50 ? 'high' : change > 20 ? 'medium' : 'info',
            category: 'quality',
            title: change > 0
              ? `Aumento del ${Math.round(change)}% en NCRs este mes`
              : `Reducción del ${Math.round(Math.abs(change))}% en NCRs este mes`,
            description: change > 0
              ? `Se detectaron ${recentNCRs} NCRs nuevas en los últimos 30 días vs ${previousNCRs} el mes anterior. Tendencia al alza.`
              : `Se detectaron ${recentNCRs} NCRs nuevas en los últimos 30 días vs ${previousNCRs} el mes anterior. Mejora en calidad.`,
            metric: { current: recentNCRs, previous: previousNCRs, change: Math.round(change), unit: 'NCRs/mes' },
            recommendations: change > 0
              ? ['Investigar causas raíz de las NCRs recientes', 'Reforzar controles preventivos', 'Considerar capacitación en áreas afectadas']
              : ['Documentar las mejores prácticas que generaron esta reducción', 'Mantener las acciones correctivas implementadas'],
            confidence: 0.85,
            createdAt: now,
          });
        }
      }
    } catch (error) {
      console.error('[Insights Engine] NCR analysis error:', error);
    }
    return insights;
  }

  // ── Riesgos ─────────────────────────────────────────────────
  private async analyzeRiskStatus(tenantId: string): Promise<ProactiveInsight[]> {
    const insights: ProactiveInsight[] = [];
    try {
      const [totalRisks, highRisks, unmitigatedRisks] = await Promise.all([
        this.db.risk?.count({ where: { tenantId } }).catch(() => 0),
        this.db.risk?.count({ where: { tenantId, level: { in: ['HIGH', 'CRITICAL'] } } }).catch(() => 0),
        this.db.risk?.count({ where: { tenantId, status: { in: ['IDENTIFIED', 'OPEN'] } } }).catch(() => 0),
      ]);

      if (highRisks > 0) {
        insights.push({
          id: `risk-high-${tenantId}`,
          type: 'alert',
          severity: highRisks > 5 ? 'critical' : highRisks > 2 ? 'high' : 'medium',
          category: 'risk',
          title: `${highRisks} riesgos de nivel alto/crítico`,
          description: `Se identificaron ${highRisks} riesgos de nivel alto o crítico de un total de ${totalRisks}. ${unmitigatedRisks} riesgos aún sin mitigar.`,
          metric: { current: highRisks, unit: 'riesgos alto/crítico' },
          recommendations: [
            'Revisar planes de mitigación de riesgos críticos',
            'Asegurar que cada riesgo alto tenga un responsable asignado',
            'Programar revisión de riesgos con la dirección',
          ],
          confidence: 0.92,
          createdAt: new Date(),
        });
      }

      if (unmitigatedRisks > 0 && totalRisks > 0) {
        const ratio = (unmitigatedRisks / totalRisks) * 100;
        if (ratio > 40) {
          insights.push({
            id: `risk-unmitigated-${tenantId}`,
            type: 'recommendation',
            severity: ratio > 70 ? 'high' : 'medium',
            category: 'risk',
            title: `${Math.round(ratio)}% de riesgos sin mitigar`,
            description: `De ${totalRisks} riesgos identificados, ${unmitigatedRisks} (${Math.round(ratio)}%) permanecen sin plan de mitigación activo.`,
            metric: { current: Math.round(ratio), unit: '% sin mitigar' },
            recommendations: [
              'Definir planes de mitigación para riesgos prioritarios',
              'Asignar presupuesto para controles de riesgo',
              'Establecer indicadores de seguimiento para riesgos clave',
            ],
            confidence: 0.88,
            createdAt: new Date(),
          });
        }
      }
    } catch (error) {
      console.error('[Insights Engine] Risk analysis error:', error);
    }
    return insights;
  }

  // ── Flota / Mantenimiento ───────────────────────────────────
  private async analyzeFleetHealth(tenantId: string): Promise<ProactiveInsight[]> {
    const insights: ProactiveInsight[] = [];
    try {
      const [totalVehicles, activeVehicles, inMaintenance, inactiveVehicles] = await Promise.all([
        this.db.vehiculo?.count({ where: { tenantId } }).catch(() => 0),
        this.db.vehiculo?.count({ where: { tenantId, status: 'ACTIVO' } }).catch(() => 0),
        this.db.vehiculo?.count({ where: { tenantId, status: 'EN_TALLER' } }).catch(() => 0),
        this.db.vehiculo?.count({ where: { tenantId, status: { in: ['INACTIVO', 'BAJA'] } } }).catch(() => 0),
      ]);

      if (totalVehicles === 0) return insights;

      const maintenanceRatio = (inMaintenance / totalVehicles) * 100;
      if (inMaintenance > 0) {
        insights.push({
          id: `fleet-maintenance-${tenantId}`,
          type: maintenanceRatio > 30 ? 'alert' : 'trend',
          severity: maintenanceRatio > 30 ? 'high' : maintenanceRatio > 15 ? 'medium' : 'low',
          category: 'fleet',
          title: `${inMaintenance} vehículos en taller (${Math.round(maintenanceRatio)}%)`,
          description: `De ${totalVehicles} vehículos, ${inMaintenance} están actualmente en mantenimiento. ${activeVehicles} operativos.`,
          metric: { current: inMaintenance, unit: 'vehículos en taller' },
          recommendations: maintenanceRatio > 30
            ? ['Evaluar plan de renovación de flota', 'Revisar programa de mantenimiento preventivo', 'Considerar vehículos de reemplazo temporal']
            : ['Mantener programa de mantenimiento preventivo', 'Monitorear tiempos de reparación'],
          confidence: 0.9,
          createdAt: new Date(),
        });
      }

      // Check overdue maintenance
      const now = new Date();
      const overdueCount = await this.db.mantenimiento?.count({
        where: { tenantId, fechaProxima: { lte: now }, estado: { not: 'COMPLETADO' } }
      }).catch(() => 0);

      if (overdueCount > 0) {
        insights.push({
          id: `fleet-overdue-${tenantId}`,
          type: 'alert',
          severity: overdueCount > 5 ? 'high' : 'medium',
          category: 'fleet',
          title: `${overdueCount} mantenimientos vencidos`,
          description: `Hay ${overdueCount} mantenimientos programados que ya pasaron su fecha estimada sin completarse.`,
          metric: { current: overdueCount, unit: 'mantenimientos vencidos' },
          recommendations: [
            'Priorizar mantenimientos vencidos de vehículos críticos',
            'Actualizar el cronograma de mantenimiento',
            'Notificar a los responsables de cada vehículo',
          ],
          confidence: 0.93,
          createdAt: new Date(),
        });
      }
    } catch (error) {
      console.error('[Insights Engine] Fleet analysis error:', error);
    }
    return insights;
  }

  // ── Proyectos ───────────────────────────────────────────────
  private async analyzeProjectHealth(tenantId: string): Promise<ProactiveInsight[]> {
    const insights: ProactiveInsight[] = [];
    try {
      const [totalProjects, activeProjects, atRiskProjects, delayedProjects] = await Promise.all([
        this.db.project360?.count({ where: { tenantId, deletedAt: null } }).catch(() => 0),
        this.db.project360?.count({ where: { tenantId, deletedAt: null, status: 'ACTIVE' } }).catch(() => 0),
        this.db.project360?.count({ where: { tenantId, deletedAt: null, status: 'AT_RISK' } }).catch(() => 0),
        this.db.project360?.count({ where: { tenantId, deletedAt: null, status: 'DELAYED' } }).catch(() => 0),
      ]);

      if (totalProjects === 0) return insights;

      const problematicCount = atRiskProjects + delayedProjects;
      if (problematicCount > 0) {
        insights.push({
          id: `project-risk-${tenantId}`,
          type: 'alert',
          severity: delayedProjects > 2 ? 'high' : atRiskProjects > 3 ? 'medium' : 'low',
          category: 'projects',
          title: `${problematicCount} proyectos con problemas`,
          description: `De ${totalProjects} proyectos: ${atRiskProjects} en riesgo y ${delayedProjects} retrasados. ${activeProjects} activos sin problemas.`,
          metric: { current: problematicCount, unit: 'proyectos problemáticos' },
          recommendations: [
            ...(delayedProjects > 0 ? ['Revisar hitos y replantear cronogramas de proyectos retrasados'] : []),
            ...(atRiskProjects > 0 ? ['Implementar acciones de mitigación en proyectos en riesgo'] : []),
            'Realizar revisión ejecutiva de portafolio de proyectos',
          ],
          confidence: 0.9,
          createdAt: new Date(),
        });
      }

      // Portfolio health overview
      if (totalProjects > 3) {
        const healthRatio = ((totalProjects - problematicCount) / totalProjects) * 100;
        insights.push({
          id: `project-health-${tenantId}`,
          type: healthRatio > 80 ? 'opportunity' : 'trend',
          severity: 'info',
          category: 'projects',
          title: `Salud del portafolio: ${Math.round(healthRatio)}%`,
          description: `${totalProjects} proyectos totales. ${Math.round(healthRatio)}% en buen estado. ${activeProjects} activos actualmente.`,
          metric: { current: Math.round(healthRatio), unit: '% saludables' },
          recommendations: ['Revisar proyectos próximos a completarse', 'Planificar nuevas iniciativas si hay capacidad'],
          confidence: 0.85,
          createdAt: new Date(),
        });
      }
    } catch (error) {
      console.error('[Insights Engine] Project analysis error:', error);
    }
    return insights;
  }

  // ── RRHH ────────────────────────────────────────────────────
  private async analyzeHRIndicators(tenantId: string): Promise<ProactiveInsight[]> {
    const insights: ProactiveInsight[] = [];
    try {
      const [totalEmployees, activeEmployees] = await Promise.all([
        this.db.employee?.count({ where: { tenantId } }).catch(() => 0),
        this.db.employee?.count({ where: { tenantId, status: 'ACTIVE' } }).catch(() => 0),
      ]);

      if (totalEmployees === 0) return insights;

      const inactiveCount = totalEmployees - activeEmployees;
      if (inactiveCount > 0 && (inactiveCount / totalEmployees) > 0.1) {
        insights.push({
          id: `hr-inactive-${tenantId}`,
          type: 'trend',
          severity: (inactiveCount / totalEmployees) > 0.2 ? 'medium' : 'low',
          category: 'hr',
          title: `${inactiveCount} empleados inactivos (${Math.round((inactiveCount / totalEmployees) * 100)}%)`,
          description: `De ${totalEmployees} empleados registrados, ${inactiveCount} figuran como inactivos.`,
          metric: { current: activeEmployees, unit: 'empleados activos' },
          recommendations: [
            'Actualizar registros de empleados inactivos',
            'Verificar si hay procesos de desvinculación pendientes',
          ],
          confidence: 0.85,
          createdAt: new Date(),
        });
      }

      // Check pending trainings
      const pendingTrainings = await this.db.training?.count({
        where: { tenantId, status: { in: ['PENDING', 'SCHEDULED'] } }
      }).catch(() => 0);

      if (pendingTrainings > 0) {
        insights.push({
          id: `hr-trainings-${tenantId}`,
          type: 'recommendation',
          severity: pendingTrainings > 10 ? 'medium' : 'low',
          category: 'hr',
          title: `${pendingTrainings} capacitaciones pendientes`,
          description: `Hay ${pendingTrainings} solicitudes de capacitación en estado pendiente o programado.`,
          metric: { current: pendingTrainings, unit: 'capacitaciones pendientes' },
          recommendations: [
            'Programar fechas para capacitaciones pendientes',
            'Priorizar capacitaciones vinculadas a brechas de competencia',
          ],
          confidence: 0.88,
          createdAt: new Date(),
        });
      }
    } catch (error) {
      console.error('[Insights Engine] HR analysis error:', error);
    }
    return insights;
  }

  // ── Auditorías ──────────────────────────────────────────────
  private async analyzeAuditFindings(tenantId: string): Promise<ProactiveInsight[]> {
    const insights: ProactiveInsight[] = [];
    try {
      const [openAudits, openFindings] = await Promise.all([
        this.db.auditRun?.count({ where: { tenantId, status: { in: ['PLANNED', 'IN_PROGRESS'] } } }).catch(() => 0),
        this.db.auditFinding?.count({ where: { tenantId, status: { in: ['OPEN', 'IN_PROGRESS'] } } }).catch(() => 0),
      ]);

      if (openAudits > 0) {
        insights.push({
          id: `audit-open-${tenantId}`,
          type: 'trend',
          severity: openAudits > 3 ? 'medium' : 'low',
          category: 'compliance',
          title: `${openAudits} auditorías en curso`,
          description: `Hay ${openAudits} auditorías planificadas o en ejecución. ${openFindings} hallazgos abiertos de auditorías previas.`,
          metric: { current: openAudits, unit: 'auditorías abiertas' },
          recommendations: [
            'Completar auditorías en progreso según cronograma',
            ...(openFindings > 0 ? [`Resolver los ${openFindings} hallazgos abiertos antes de la próxima auditoría`] : []),
          ],
          confidence: 0.87,
          createdAt: new Date(),
        });
      }
    } catch (error) {
      console.error('[Insights Engine] Audit analysis error:', error);
    }
    return insights;
  }

  // ── Calibraciones ───────────────────────────────────────────
  private async analyzeCalibrations(tenantId: string): Promise<ProactiveInsight[]> {
    const insights: ProactiveInsight[] = [];
    try {
      const now = new Date();
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 86400000);

      const [overdueCalibrations, upcomingCalibrations] = await Promise.all([
        this.db.calibration?.count({ where: { tenantId, nextDueDate: { lte: now } } }).catch(() => 0),
        this.db.calibration?.count({ where: { tenantId, nextDueDate: { gt: now, lte: thirtyDaysFromNow } } }).catch(() => 0),
      ]);

      if (overdueCalibrations > 0) {
        insights.push({
          id: `calib-overdue-${tenantId}`,
          type: 'alert',
          severity: overdueCalibrations > 5 ? 'high' : 'medium',
          category: 'compliance',
          title: `${overdueCalibrations} calibraciones vencidas`,
          description: `Hay ${overdueCalibrations} equipos con calibración vencida. Esto puede afectar la validez de mediciones y certificaciones.`,
          metric: { current: overdueCalibrations, unit: 'calibraciones vencidas' },
          recommendations: [
            'Programar calibración inmediata de equipos vencidos',
            'Verificar si las mediciones realizadas con estos equipos son válidas',
            'Actualizar el cronograma de calibraciones',
          ],
          confidence: 0.95,
          createdAt: new Date(),
        });
      }

      if (upcomingCalibrations > 0) {
        insights.push({
          id: `calib-upcoming-${tenantId}`,
          type: 'recommendation',
          severity: 'info',
          category: 'compliance',
          title: `${upcomingCalibrations} calibraciones próximas (30 días)`,
          description: `${upcomingCalibrations} equipos requieren calibración en los próximos 30 días. Planifique con anticipación.`,
          metric: { current: upcomingCalibrations, unit: 'próximas 30 días' },
          recommendations: ['Coordinar con laboratorio de calibración', 'Preparar equipos de respaldo si es necesario'],
          confidence: 0.9,
          createdAt: new Date(),
        });
      }
    } catch (error) {
      console.error('[Insights Engine] Calibration analysis error:', error);
    }
    return insights;
  }

  // ── Documentos ──────────────────────────────────────────────
  private async analyzeDocumentCompliance(tenantId: string): Promise<ProactiveInsight[]> {
    const insights: ProactiveInsight[] = [];
    try {
      const now = new Date();

      const [totalDocs, pendingReview, expiredDocs] = await Promise.all([
        this.db.document?.count({ where: { tenantId } }).catch(() => 0),
        this.db.document?.count({ where: { tenantId, status: 'PENDING_REVIEW' } }).catch(() => 0),
        this.db.document?.count({ where: { tenantId, expirationDate: { lte: now } } }).catch(() => 0),
      ]);

      if (pendingReview > 0) {
        insights.push({
          id: `doc-pending-${tenantId}`,
          type: 'recommendation',
          severity: pendingReview > 10 ? 'medium' : 'low',
          category: 'compliance',
          title: `${pendingReview} documentos pendientes de revisión`,
          description: `Hay ${pendingReview} documentos en estado de revisión pendiente de un total de ${totalDocs}.`,
          metric: { current: pendingReview, unit: 'pendientes de revisión' },
          recommendations: ['Asignar revisores a documentos pendientes', 'Priorizar documentos de mayor antigüedad'],
          confidence: 0.88,
          createdAt: new Date(),
        });
      }

      if (expiredDocs > 0) {
        insights.push({
          id: `doc-expired-${tenantId}`,
          type: 'alert',
          severity: expiredDocs > 5 ? 'high' : 'medium',
          category: 'compliance',
          title: `${expiredDocs} documentos vencidos`,
          description: `${expiredDocs} documentos han superado su fecha de vencimiento y requieren actualización.`,
          metric: { current: expiredDocs, unit: 'documentos vencidos' },
          recommendations: ['Actualizar documentos vencidos de forma prioritaria', 'Revisar vigencia del sistema documental'],
          confidence: 0.92,
          createdAt: new Date(),
        });
      }
    } catch (error) {
      console.error('[Insights Engine] Document analysis error:', error);
    }
    return insights;
  }
}

export default AIInsightsEngine;
