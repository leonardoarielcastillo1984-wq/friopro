/**
 * AI PRIORITY ENGINE
 * FASE 6 — Dynamic Priority Engine
 * 
 * Motor inteligente de prioridades dinámicas que reordena automáticamente:
 * - tareas
 * - auditorías
 * - CAPAs
 * - mantenimientos
 * - riesgos
 * - proyectos
 * 
 * CRITERIOS: criticidad, impacto, recurrencia, tendencia, historial, correlaciones IA
 */

import { PrismaClient } from '@prisma/client';
import { CorrelationEngine } from './ai-correlation-engine.js';
import { AnomalyDetector } from './ai-anomaly-detector.js';

// ============================================================
// TYPES
// ============================================================

export type PrioritizableEntity = 
  | 'TASK' 
  | 'AUDIT' 
  | 'CAPA' 
  | 'MAINTENANCE' 
  | 'RISK' 
  | 'PROJECT' 
  | 'NCR';

export interface PriorityScore {
  entityId: string;
  entityType: PrioritizableEntity;
  currentPriority: string;
  aiPriority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  aiScore: number; // 0-100
  factors: PriorityFactor[];
  recommendation: string;
  suggestedAction?: string;
}

export interface PriorityFactor {
  name: string;
  weight: number;
  score: number; // 0-100
  description: string;
}

export interface PriorityContext {
  correlations: any[];
  anomalies: any[];
  organizationalContext: {
    openNCRs: number;
    overdueCAPAs: number;
    activeProjects: number;
    fleetAvailability: number;
    recentIncidents: number;
  };
}

// ============================================================
// PRIORITY CALCULATION WEIGHTS
// ============================================================

const PRIORITY_WEIGHTS = {
  CRITICALITY: 30,    // Base severity of the item
  IMPACT: 25,         // Business/operational impact
  URGENCY: 20,        // Time sensitivity
  TREND: 15,          // Getting worse or better
  CORRELATION: 10,    // Cross-module impact
};

// ============================================================
// AI PRIORITY ENGINE CLASS
// ============================================================

export class AIPriorityEngine {
  private db: any;
  private correlationEngine: CorrelationEngine;
  private anomalyDetector: AnomalyDetector;

  constructor(prisma: PrismaClient) {
    this.db = prisma as any;
    this.correlationEngine = new CorrelationEngine(prisma);
    this.anomalyDetector = new AnomalyDetector(prisma);
  }

  /**
   * Calculate dynamic priorities for all entities in a tenant
   */
  async calculateAllPriorities(tenantId: string): Promise<PriorityScore[]> {
    const context = await this.buildContext(tenantId);
    
    const [
      taskPriorities,
      capaPriorities,
      auditPriorities,
      riskPriorities,
      projectPriorities,
      ncrPriorities,
      maintenancePriorities,
    ] = await Promise.all([
      this.calculateTaskPriorities(tenantId, context),
      this.calculateCAPAPriorities(tenantId, context),
      this.calculateAuditPriorities(tenantId, context),
      this.calculateRiskPriorities(tenantId, context),
      this.calculateProjectPriorities(tenantId, context),
      this.calculateNCRPriorities(tenantId, context),
      this.calculateMaintenancePriorities(tenantId, context),
    ]);

    const allPriorities = [
      ...taskPriorities,
      ...capaPriorities,
      ...auditPriorities,
      ...riskPriorities,
      ...projectPriorities,
      ...ncrPriorities,
      ...maintenancePriorities,
    ];

    // Sort by AI score descending
    return allPriorities.sort((a, b) => b.aiScore - a.aiScore);
  }

  /**
   * Build organizational context for priority calculations
   */
  private async buildContext(tenantId: string): Promise<PriorityContext> {
    const [correlations, anomalies, orgData] = await Promise.all([
      this.correlationEngine.detectCorrelations(tenantId),
      this.anomalyDetector.detectAnomalies(tenantId),
      this.getOrganizationalContext(tenantId),
    ]);

    return {
      correlations,
      anomalies,
      organizationalContext: orgData,
    };
  }

  private async getOrganizationalContext(tenantId: string) {
    const db = this.db;

    const [openNCRs, overdueCAPAs, activeProjects, vehicles] = await Promise.all([
      (db.nonConformityReport || db.ncr || db.nonConformity)?.count({
        where: { tenantId, status: { not: 'CLOSED' } },
      }) || 0,
      (db.capa || db.correctiveAction)?.count({
        where: {
          tenantId,
          status: { not: 'CLOSED' },
          dueDate: { lt: new Date() },
        },
      }) || 0,
      db.project360?.count({
        where: { tenantId, deletedAt: null, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
      }) || 0,
      db.vehiculo?.findMany({
        where: { tenantId },
        select: { status: true },
      }) || [],
    ]);

    const operative = vehicles.filter((v: any) => v.status === 'OPERATIVO').length;
    const fleetAvailability = vehicles.length > 0 ? (operative / vehicles.length) : 1;

    return {
      openNCRs,
      overdueCAPAs,
      activeProjects,
      fleetAvailability,
      recentIncidents: 0, // Would need incident tracking
    };
  }

  // ============================================================
  // TASK PRIORITIES
  // ============================================================

  private async calculateTaskPriorities(tenantId: string, context: PriorityContext): Promise<PriorityScore[]> {
    const tasks = await this.db.task?.findMany?.({
      where: { tenantId, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
      include: {
        assignee: { select: { id: true, name: true } },
        project: { select: { id: true, status: true } },
      },
      take: 100,
    }) || [];

    return tasks.map((task: any) => {
      const factors: PriorityFactor[] = [];

      // Criticality (base priority)
      const criticalityScore = this.mapPriorityToScore(task.priority);
      factors.push({
        name: 'Criticalidad Base',
        weight: PRIORITY_WEIGHTS.CRITICALITY,
        score: criticalityScore,
        description: `Prioridad actual: ${task.priority}`,
      });

      // Impact based on project association
      let impactScore = 50;
      if (task.project?.status === 'AT_RISK') {
        impactScore = 90;
      } else if (task.project) {
        impactScore = 70;
      }
      factors.push({
        name: 'Impacto en Proyecto',
        weight: PRIORITY_WEIGHTS.IMPACT,
        score: impactScore,
        description: task.project ? `Asociado a proyecto ${task.project.status}` : 'Sin proyecto asociado',
      });

      // Urgency based on due date
      const urgencyScore = this.calculateUrgencyScore(task.dueDate);
      factors.push({
        name: 'Urgencia Temporal',
        weight: PRIORITY_WEIGHTS.URGENCY,
        score: urgencyScore,
        description: this.describeUrgency(task.dueDate),
      });

      // Trend - check if related to anomalies
      const relatedAnomalies = context.anomalies.filter((a: any) => 
        a.metadata?.relatedTaskId === task.id
      );
      const trendScore = relatedAnomalies.length > 0 ? 85 : 50;
      factors.push({
        name: 'Tendencia Anomalías',
        weight: PRIORITY_WEIGHTS.TREND,
        score: trendScore,
        description: relatedAnomalies.length > 0 ? `${relatedAnomalies.length} anomalías relacionadas` : 'Sin anomalías',
      });

      // Correlation impact
      const relatedCorrelations = context.correlations.filter((c: any) =>
        c.entities?.some((e: any) => e.id === task.id)
      );
      const correlationScore = relatedCorrelations.length > 0 ? 80 : 50;
      factors.push({
        name: 'Impacto Cross-Module',
        weight: PRIORITY_WEIGHTS.CORRELATION,
        score: correlationScore,
        description: relatedCorrelations.length > 0 ? 'Afecta múltiples módulos' : 'Impacto aislado',
      });

      const aiScore = this.calculateWeightedScore(factors);
      const aiPriority = this.scoreToPriority(aiScore);

      return {
        entityId: task.id,
        entityType: 'TASK' as PrioritizableEntity,
        currentPriority: task.priority,
        aiPriority,
        aiScore,
        factors,
        recommendation: this.generateTaskRecommendation(task, aiPriority, factors),
        suggestedAction: aiPriority === 'CRITICAL' ? 'ESCALAR_INMEDIATAMENTE' : undefined,
      };
    });
  }

  // ============================================================
  // CAPA PRIORITIES
  // ============================================================

  private async calculateCAPAPriorities(tenantId: string, context: PriorityContext): Promise<PriorityScore[]> {
    const capas = await (this.db.capa || this.db.correctiveAction)?.findMany?.({
      where: { tenantId, status: { not: 'CLOSED' } },
      include: {
        nonConformity: { select: { severity: true, id: true } },
      },
      take: 100,
    }) || [];

    return capas.map((capa: any) => {
      const factors: PriorityFactor[] = [];

      // Criticality based on associated NCR severity
      const severity = capa.nonConformity?.severity || 'MEDIUM';
      const criticalityScore = this.mapSeverityToScore(severity);
      factors.push({
        name: 'Severidad NCR Asociada',
        weight: PRIORITY_WEIGHTS.CRITICALITY,
        score: criticalityScore,
        description: `NCR: ${severity}`,
      });

      // Impact on quality system
      const qualityImpact = context.organizationalContext.openNCRs > 10 ? 90 : 
                           context.organizationalContext.openNCRs > 5 ? 75 : 60;
      factors.push({
        name: 'Impacto Sistema Calidad',
        weight: PRIORITY_WEIGHTS.IMPACT,
        score: qualityImpact,
        description: `${context.organizationalContext.openNCRs} NCRs abiertas en organización`,
      });

      // Urgency (overdue is critical)
      const isOverdue = capa.dueDate && new Date(capa.dueDate) < new Date();
      const urgencyScore = isOverdue ? 100 : this.calculateUrgencyScore(capa.dueDate);
      factors.push({
        name: 'Urgencia',
        weight: PRIORITY_WEIGHTS.URGENCY,
        score: urgencyScore,
        description: isOverdue ? 'VENCIDA' : this.describeUrgency(capa.dueDate),
      });

      // Trend
      const trendScore = isOverdue ? 95 : 50;
      factors.push({
        name: 'Tendencia',
        weight: PRIORITY_WEIGHTS.TREND,
        score: trendScore,
        description: isOverdue ? 'Riesgo de escalamiento' : 'Estable',
      });

      // Correlation with other quality issues
      const qualityCorrelations = context.correlations.filter((c: any) =>
        c.pattern === 'quality_chain' || c.modules?.includes('quality')
      );
      factors.push({
        name: 'Correlación Calidad',
        weight: PRIORITY_WEIGHTS.CORRELATION,
        score: qualityCorrelations.length > 0 ? 85 : 50,
        description: qualityCorrelations.length > 0 ? 'Parte de cadena de calidad' : 'Aislada',
      });

      const aiScore = this.calculateWeightedScore(factors);
      const aiPriority = this.scoreToPriority(aiScore);

      return {
        entityId: capa.id,
        entityType: 'CAPA' as PrioritizableEntity,
        currentPriority: capa.priority || 'MEDIUM',
        aiPriority,
        aiScore,
        factors,
        recommendation: this.generateCAPARecommendation(capa, aiPriority, isOverdue),
        suggestedAction: isOverdue ? 'ESCALAR_A_DIRECCION' : 
                        aiPriority === 'CRITICAL' ? 'ACELERAR_IMPLEMENTACION' : undefined,
      };
    });
  }

  // ============================================================
  // AUDIT PRIORITIES
  // ============================================================

  private async calculateAuditPriorities(tenantId: string, context: PriorityContext): Promise<PriorityScore[]> {
    const audits = await this.db.audit?.findMany?.({
      where: { 
        tenantId, 
        status: { in: ['PLANNED', 'IN_PROGRESS', 'SCHEDULED'] },
      },
      take: 50,
    }) || [];

    return audits.map((audit: any) => {
      const factors: PriorityFactor[] = [];

      // Criticality based on audit type
      const typeScore = audit.type === 'EXTERNAL' || audit.type === 'CERTIFICATION' ? 95 :
                       audit.type === 'EXTRAORDINARY' ? 85 : 70;
      factors.push({
        name: 'Tipo Auditoría',
        weight: PRIORITY_WEIGHTS.CRITICALITY,
        score: typeScore,
        description: audit.type,
      });

      // Impact - external audits have higher compliance impact
      factors.push({
        name: 'Impacto Compliance',
        weight: PRIORITY_WEIGHTS.IMPACT,
        score: audit.type === 'EXTERNAL' ? 95 : 75,
        description: audit.type === 'EXTERNAL' ? 'Auditores externos' : 'Auditores internos',
      });

      // Urgency based on planned date
      const urgencyScore = this.calculateUrgencyScore(audit.plannedDate);
      factors.push({
        name: 'Proximidad',
        weight: PRIORITY_WEIGHTS.URGENCY,
        score: urgencyScore,
        description: this.describeUrgency(audit.plannedDate),
      });

      // Trend - rising NCRs before audit is bad sign
      const trendScore = context.organizationalContext.openNCRs > 5 ? 85 : 50;
      factors.push({
        name: 'Readiness',
        weight: PRIORITY_WEIGHTS.TREND,
        score: trendScore,
        description: context.organizationalContext.openNCRs > 5 ? 'Preparación deficiente' : 'Buena preparación',
      });

      // Correlation
      factors.push({
        name: 'Contexto',
        weight: PRIORITY_WEIGHTS.CORRELATION,
        score: 50,
        description: 'Preparación de auditoría',
      });

      const aiScore = this.calculateWeightedScore(factors);
      const aiPriority = this.scoreToPriority(aiScore);

      return {
        entityId: audit.id,
        entityType: 'AUDIT' as PrioritizableEntity,
        currentPriority: 'MEDIUM',
        aiPriority,
        aiScore,
        factors,
        recommendation: this.generateAuditRecommendation(audit, aiPriority, context),
        suggestedAction: audit.type === 'EXTERNAL' && context.organizationalContext.openNCRs > 5 
          ? 'ACELERAR_CIERRE_NCRS' : undefined,
      };
    });
  }

  // ============================================================
  // RISK PRIORITIES
  // ============================================================

  private async calculateRiskPriorities(tenantId: string, context: PriorityContext): Promise<PriorityScore[]> {
    const risks = await this.db.risk?.findMany?.({
      where: { tenantId, status: { not: 'CLOSED' } },
      take: 100,
    }) || [];

    return risks.map((risk: any) => {
      const factors: PriorityFactor[] = [];

      // Criticality based on inherent risk level
      const inherentScore = this.mapRiskLevelToScore(risk.level);
      factors.push({
        name: 'Nivel Riesgo Inherente',
        weight: PRIORITY_WEIGHTS.CRITICALITY,
        score: inherentScore,
        description: risk.level,
      });

      // Impact based on probability x impact
      const probability = risk.probability || 3;
      const impact = risk.impact || 3;
      const impactScore = Math.min((probability * impact / 9) * 100, 100);
      factors.push({
        name: 'Probabilidad x Impacto',
        weight: PRIORITY_WEIGHTS.IMPACT,
        score: impactScore,
        description: `P=${probability} x I=${impact}`,
      });

      // Urgency based on trend
      const urgencyScore = risk.trend === 'INCREASING' ? 90 : 
                          risk.trend === 'DECREASING' ? 30 : 50;
      factors.push({
        name: 'Tendencia',
        weight: PRIORITY_WEIGHTS.URGENCY,
        score: urgencyScore,
        description: risk.trend || 'STABLE',
      });

      // Trend analysis
      factors.push({
        name: 'Evolución',
        weight: PRIORITY_WEIGHTS.TREND,
        score: risk.trend === 'INCREASING' ? 95 : 50,
        description: risk.trend === 'INCREASING' ? 'Riesgo creciente' : 'Riesgo estable',
      });

      // Correlation with other risks
      const riskCorrelations = context.correlations.filter((c: any) =>
        c.type === 'risk_cascade' || c.entities?.some((e: any) => e.type === 'RISK' && e.id === risk.id)
      );
      factors.push({
        name: 'Efecto Cascada',
        weight: PRIORITY_WEIGHTS.CORRELATION,
        score: riskCorrelations.length > 0 ? 90 : 50,
        description: riskCorrelations.length > 0 ? 'Riesgo sistémico' : 'Riesgo aislado',
      });

      const aiScore = this.calculateWeightedScore(factors);
      const aiPriority = this.scoreToPriority(aiScore);

      return {
        entityId: risk.id,
        entityType: 'RISK' as PrioritizableEntity,
        currentPriority: risk.priority || 'MEDIUM',
        aiPriority,
        aiScore,
        factors,
        recommendation: this.generateRiskRecommendation(risk, aiPriority, factors),
        suggestedAction: aiPriority === 'CRITICAL' ? 'ACTIVAR_CONTINGENCIA' : 
                        risk.trend === 'INCREASING' ? 'INTENSIFICAR_MITIGACION' : undefined,
      };
    });
  }

  // ============================================================
  // PROJECT PRIORITIES
  // ============================================================

  private async calculateProjectPriorities(tenantId: string, context: PriorityContext): Promise<PriorityScore[]> {
    const projects = await this.db.project360?.findMany?.({
      where: { 
        tenantId, 
        deletedAt: null,
        status: { notIn: ['COMPLETED', 'CANCELLED'] },
      },
      take: 50,
    }) || [];

    return projects.map((project: any) => {
      const factors: PriorityFactor[] = [];

      // Criticality based on strategic importance (could be enhanced with metadata)
      const criticalityScore = project.budget && project.budget > 1000000 ? 85 : 70;
      factors.push({
        name: 'Importancia Estratégica',
        weight: PRIORITY_WEIGHTS.CRITICALITY,
        score: criticalityScore,
        description: project.budget ? `Presupuesto $${project.budget}` : 'Sin presupuesto definido',
      });

      // Impact - at-risk projects have higher business impact
      const isAtRisk = project.status === 'AT_RISK' || 
                      (project.endDate && new Date(project.endDate) < new Date() && project.status !== 'COMPLETED') ||
                      (project.actualCost && project.budget && project.actualCost > project.budget);
      
      factors.push({
        name: 'Impacto Negocio',
        weight: PRIORITY_WEIGHTS.IMPACT,
        score: isAtRisk ? 95 : 70,
        description: isAtRisk ? 'Proyecto en riesgo' : 'Proyecto en curso',
      });

      // Urgency based on deadline
      const urgencyScore = this.calculateUrgencyScore(project.endDate);
      factors.push({
        name: 'Fecha Límite',
        weight: PRIORITY_WEIGHTS.URGENCY,
        score: urgencyScore,
        description: this.describeUrgency(project.endDate),
      });

      // Trend - progress rate vs expected
      const expectedProgress = project.startDate && project.endDate ? 
        ((Date.now() - new Date(project.startDate).getTime()) / 
         (new Date(project.endDate).getTime() - new Date(project.startDate).getTime())) * 100 : 50;
      const actualProgress = project.progress || 0;
      const trendScore = actualProgress < expectedProgress * 0.8 ? 85 : 
                        actualProgress < expectedProgress ? 70 : 50;
      factors.push({
        name: 'Desempeño',
        weight: PRIORITY_WEIGHTS.TREND,
        score: trendScore,
        description: `Progreso ${Math.round(actualProgress)}% vs esperado ${Math.round(expectedProgress)}%`,
      });

      // Correlation
      factors.push({
        name: 'Dependencias',
        weight: PRIORITY_WEIGHTS.CORRELATION,
        score: 50,
        description: 'Proyecto independiente',
      });

      const aiScore = this.calculateWeightedScore(factors);
      const aiPriority = this.scoreToPriority(aiScore);

      return {
        entityId: project.id,
        entityType: 'PROJECT' as PrioritizableEntity,
        currentPriority: project.priority || 'MEDIUM',
        aiPriority,
        aiScore,
        factors,
        recommendation: this.generateProjectRecommendation(project, aiPriority, isAtRisk),
        suggestedAction: isAtRisk ? 'ACTIVAR_PLAN_RECUPERACION' : undefined,
      };
    });
  }

  // ============================================================
  // NCR PRIORITIES
  // ============================================================

  private async calculateNCRPriorities(tenantId: string, context: PriorityContext): Promise<PriorityScore[]> {
    const ncrs = await (this.db.nonConformityReport || this.db.ncr || this.db.nonConformity)?.findMany?.({
      where: { tenantId, status: { not: 'CLOSED' } },
      take: 100,
    }) || [];

    return ncrs.map((ncr: any) => {
      const factors: PriorityFactor[] = [];

      // Criticality based on severity
      const severityScore = this.mapSeverityToScore(ncr.severity);
      factors.push({
        name: 'Severidad',
        weight: PRIORITY_WEIGHTS.CRITICALITY,
        score: severityScore,
        description: ncr.severity,
      });

      // Impact on customer if applicable
      const customerImpact = ncr.customerRelated || ncr.affectsDelivery ? 95 : 65;
      factors.push({
        name: 'Impacto Cliente',
        weight: PRIORITY_WEIGHTS.IMPACT,
        score: customerImpact,
        description: ncr.customerRelated ? 'Afecta al cliente' : 'Interna',
      });

      // Urgency based on aging
      const daysOpen = Math.floor((Date.now() - new Date(ncr.createdAt).getTime()) / 86400000);
      const urgencyScore = daysOpen > 30 ? 100 : daysOpen > 14 ? 80 : daysOpen > 7 ? 60 : 40;
      factors.push({
        name: 'Días Abiertos',
        weight: PRIORITY_WEIGHTS.URGENCY,
        score: urgencyScore,
        description: `${daysOpen} días`,
      });

      // Trend - recurrence
      const isRecurrent = ncr.recurrenceCount && ncr.recurrenceCount > 1;
      factors.push({
        name: 'Recurrencia',
        weight: PRIORITY_WEIGHTS.TREND,
        score: isRecurrent ? 95 : 50,
        description: isRecurrent ? `Recurrente (${ncr.recurrenceCount}x)` : 'Primera ocurrencia',
      });

      // Correlation
      const relatedCorrelations = context.correlations.filter((c: any) =>
        c.entities?.some((e: any) => e.id === ncr.id)
      );
      factors.push({
        name: 'Relaciones',
        weight: PRIORITY_WEIGHTS.CORRELATION,
        score: relatedCorrelations.length > 0 ? 80 : 50,
        description: relatedCorrelations.length > 0 ? 'Parte de patrón' : 'Aislada',
      });

      const aiScore = this.calculateWeightedScore(factors);
      const aiPriority = this.scoreToPriority(aiScore);

      return {
        entityId: ncr.id,
        entityType: 'NCR' as PrioritizableEntity,
        currentPriority: ncr.priority || 'MEDIUM',
        aiPriority,
        aiScore,
        factors,
        recommendation: this.generateNCRRecommendation(ncr, aiPriority, daysOpen),
        suggestedAction: daysOpen > 30 ? 'ESCALAR_VENCIMIENTO' : 
                        ncr.severity === 'CRITICAL' ? 'TRATAMIENTO_INMEDIATO' : undefined,
      };
    });
  }

  // ============================================================
  // MAINTENANCE PRIORITIES
  // ============================================================

  private async calculateMaintenancePriorities(tenantId: string, context: PriorityContext): Promise<PriorityScore[]> {
    const orders = await (this.db.maintenanceOrder || this.db.task)?.findMany?.({
      where: { 
        tenantId, 
        type: { contains: 'maintenance', mode: 'insensitive' },
        status: { notIn: ['COMPLETED', 'CANCELLED'] },
      },
      take: 100,
    }) || [];

    return orders.map((order: any) => {
      const factors: PriorityFactor[] = [];

      // Criticality based on vehicle/asset criticality
      const criticalityScore = order.vehicleCritical || order.assetType === 'CRITICAL' ? 95 : 70;
      factors.push({
        name: 'Críticidad Activo',
        weight: PRIORITY_WEIGHTS.CRITICALITY,
        score: criticalityScore,
        description: order.assetType || 'Estándar',
      });

      // Impact on operations
      const fleetImpact = context.organizationalContext.fleetAvailability < 0.8 ? 95 : 70;
      factors.push({
        name: 'Impacto Operación',
        weight: PRIORITY_WEIGHTS.IMPACT,
        score: fleetImpact,
        description: `Disponibilidad flota ${Math.round(context.organizationalContext.fleetAvailability * 100)}%`,
      });

      // Urgency based on maintenance type
      const urgencyScore = order.maintenanceType === 'EMERGENCY' || order.priority === 'URGENT' ? 100 :
                         order.maintenanceType === 'CORRECTIVE' ? 75 : 50;
      factors.push({
        name: 'Tipo Mantenimiento',
        weight: PRIORITY_WEIGHTS.URGENCY,
        score: urgencyScore,
        description: order.maintenanceType || order.priority,
      });

      // Trend
      factors.push({
        name: 'Histórico',
        weight: PRIORITY_WEIGHTS.TREND,
        score: 50,
        description: 'Sin tendencia histórica',
      });

      // Correlation
      factors.push({
        name: 'Programación',
        weight: PRIORITY_WEIGHTS.CORRELATION,
        score: order.scheduledDate ? 60 : 40,
        description: order.scheduledDate ? 'Programado' : 'Sin programar',
      });

      const aiScore = this.calculateWeightedScore(factors);
      const aiPriority = this.scoreToPriority(aiScore);

      return {
        entityId: order.id,
        entityType: 'MAINTENANCE' as PrioritizableEntity,
        currentPriority: order.priority || 'MEDIUM',
        aiPriority,
        aiScore,
        factors,
        recommendation: this.generateMaintenanceRecommendation(order, aiPriority),
        suggestedAction: aiPriority === 'CRITICAL' ? 'EJECUCION_INMEDIATA' : undefined,
      };
    });
  }

  // ============================================================
  // UTILITY METHODS
  // ============================================================

  private mapPriorityToScore(priority: string): number {
    const map: Record<string, number> = {
      'CRITICAL': 100,
      'HIGH': 75,
      'MEDIUM': 50,
      'LOW': 25,
    };
    return map[priority?.toUpperCase()] || 50;
  }

  private mapSeverityToScore(severity: string): number {
    const map: Record<string, number> = {
      'CRITICAL': 100,
      'HIGH': 80,
      'MEDIUM': 50,
      'LOW': 25,
    };
    return map[severity?.toUpperCase()] || 50;
  }

  private mapRiskLevelToScore(level: string): number {
    const map: Record<string, number> = {
      'CRITICAL': 100,
      'HIGH': 80,
      'MEDIUM': 50,
      'LOW': 25,
    };
    return map[level?.toUpperCase()] || 50;
  }

  private calculateUrgencyScore(dueDate: string | Date | null): number {
    if (!dueDate) return 50;
    
    const due = new Date(dueDate).getTime();
    const now = Date.now();
    const daysUntil = Math.floor((due - now) / 86400000);

    if (daysUntil < 0) return 100; // Overdue
    if (daysUntil === 0) return 95; // Today
    if (daysUntil <= 1) return 90;
    if (daysUntil <= 3) return 80;
    if (daysUntil <= 7) return 70;
    if (daysUntil <= 14) return 60;
    if (daysUntil <= 30) return 50;
    return 30;
  }

  private describeUrgency(dueDate: string | Date | null): string {
    if (!dueDate) return 'Sin fecha definida';
    
    const due = new Date(dueDate).getTime();
    const now = Date.now();
    const daysUntil = Math.floor((due - now) / 86400000);

    if (daysUntil < 0) return `${Math.abs(daysUntil)} días vencido`;
    if (daysUntil === 0) return 'Vence hoy';
    if (daysUntil === 1) return 'Vence mañana';
    return `${daysUntil} días restantes`;
  }

  private calculateWeightedScore(factors: PriorityFactor[]): number {
    const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
    const weightedScore = factors.reduce((sum, f) => sum + (f.score * f.weight), 0);
    return Math.round(weightedScore / totalWeight);
  }

  private scoreToPriority(score: number): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
    if (score >= 85) return 'CRITICAL';
    if (score >= 70) return 'HIGH';
    if (score >= 50) return 'MEDIUM';
    return 'LOW';
  }

  // ============================================================
  // RECOMMENDATION GENERATORS
  // ============================================================

  private generateTaskRecommendation(task: any, priority: string, factors: PriorityFactor[]): string {
    if (priority === 'CRITICAL') {
      return `Tarea requiere atención inmediata. ${factors.find(f => f.name === 'Urgencia Temporal')?.score === 100 ? 'Vencida.' : ''} Considerar reasignación o escalamiento.`;
    }
    if (priority === 'HIGH') {
      return 'Alta prioridad sugerida. Evaluar recursos asignados.';
    }
    return 'Prioridad normal. Seguimiento estándar.';
  }

  private generateCAPARecommendation(capa: any, priority: string, isOverdue: boolean): string {
    if (isOverdue) {
      return 'CAPA VENCIDA - Requiere escalamiento inmediato a dirección de calidad.';
    }
    if (priority === 'CRITICAL') {
      return 'CAPA crítica. Acelerar implementación y verificación de efectividad.';
    }
    return 'Seguimiento normal de CAPA.';
  }

  private generateAuditRecommendation(audit: any, priority: string, context: PriorityContext): string {
    if (audit.type === 'EXTERNAL' && context.organizationalContext.openNCRs > 5) {
      return `ALERTA: Auditoría externa próxima con ${context.organizationalContext.openNCRs} NCRs abiertas. Recomendado cierre acelerado.`;
    }
    return `Preparación de auditoría ${audit.type} en curso.`;
  }

  private generateRiskRecommendation(risk: any, priority: string, factors: PriorityFactor[]): string {
    const trendFactor = factors.find(f => f.name === 'Tendencia');
    if (trendFactor?.score === 95) {
      return `Riesgo en crecimiento. ${priority === 'CRITICAL' ? 'Activar plan de contingencia.' : 'Intensificar controles.'}`;
    }
    return `Riesgo ${risk.level}. Monitoreo ${priority === 'CRITICAL' || priority === 'HIGH' ? 'frecuente' : 'estándar'}.`;
  }

  private generateProjectRecommendation(project: any, priority: string, isAtRisk: boolean): string {
    if (isAtRisk) {
      return `Proyecto en riesgo. Requiere intervención inmediata: revisar alcance, recursos o cronograma.`;
    }
    if (priority === 'HIGH') {
      return 'Proyecto requiere atención gerencial. Revisar progreso vs plan.';
    }
    return 'Proyecto en curso con seguimiento normal.';
  }

  private generateNCRRecommendation(ncr: any, priority: string, daysOpen: number): string {
    if (daysOpen > 30) {
      return `NCR abierta ${daysOpen} días. Excede tiempo estándar. Escalamiento recomendado.`;
    }
    if (ncr.severity === 'CRITICAL') {
      return 'NCR Crítica. Tratamiento inmediato requerido.';
    }
    return `NCR ${ncr.severity}. Seguimiento según procedimiento.`;
  }

  private generateMaintenanceRecommendation(order: any, priority: string): string {
    if (priority === 'CRITICAL') {
      return 'Mantenimiento crítico. Ejecución inmediata para evitar parada operativa.';
    }
    return `Mantenimiento ${order.maintenanceType || 'programado'}. Planificar según disponibilidad.`;
  }

  /**
   * Get priority summary for a specific entity
   */
  async getEntityPriority(entityType: PrioritizableEntity, entityId: string, tenantId: string): Promise<PriorityScore | null> {
    const allPriorities = await this.calculateAllPriorities(tenantId);
    return allPriorities.find(p => p.entityType === entityType && p.entityId === entityId) || null;
  }

  /**
   * Get top N priorities across all entity types
   */
  async getTopPriorities(tenantId: string, limit: number = 10): Promise<PriorityScore[]> {
    const allPriorities = await this.calculateAllPriorities(tenantId);
    return allPriorities.filter(p => p.aiPriority === 'CRITICAL' || p.aiPriority === 'HIGH').slice(0, limit);
  }
}

// Singleton instance
export let aiPriorityEngine: AIPriorityEngine;

export function initializePriorityEngine(prisma: PrismaClient): AIPriorityEngine {
  if (!aiPriorityEngine) {
    aiPriorityEngine = new AIPriorityEngine(prisma);
  }
  return aiPriorityEngine;
}
