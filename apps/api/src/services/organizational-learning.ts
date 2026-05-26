/**
 * ORGANIZATIONAL LEARNING ENGINE
 * FASE 7 — Cognitive Enterprise
 * 
 * Motor de aprendizaje organizacional que detecta:
 * - Patrones humanos y operacionales
 * - Mejores prácticas
 * - Patrones de riesgo
 * - Comportamientos repetitivos
 * - Oportunidades de mejora
 */

import { PrismaClient } from '@prisma/client';

// ============================================================
// TYPES
// ============================================================

export interface LearningPattern {
  id: string;
  type: 'BEST_PRACTICE' | 'RISK_PATTERN' | 'BEHAVIORAL' | 'OPERATIONAL' | 'RECURRENCE';
  category: string;
  description: string;
  confidence: number; // 0-1
  frequency: number;
  firstObserved: Date;
  lastObserved: Date;
  entities: string[];
  impact: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  recommendedAction?: string;
  tenantId: string;
}

export interface BehavioralInsight {
  dimension: string;
  metric: string;
  value: number;
  trend: 'INCREASING' | 'DECREASING' | 'STABLE';
  comparison: {
    vsPeriod: string;
    vsTeam?: string;
    vsOrganization?: string;
  };
  insight: string;
  recommendation?: string;
}

export interface KnowledgeEvolution {
  topic: string;
  evolution: Array<{
    date: Date;
    understanding: number;
    documents: number;
    decisions: number;
  }>;
  currentState: 'EMERGING' | 'DEVELOPING' | 'MATURE' | 'DECLINING';
  experts: string[];
  gaps: string[];
}

// ============================================================
// ORGANIZATIONAL LEARNING ENGINE
// ============================================================

export class OrganizationalLearningEngine {
  private db: any;

  constructor(prisma: PrismaClient) {
    this.db = prisma as any;
  }

  /**
   * Analyze organization for learning patterns
   */
  async analyze(tenantId: string, period: '7d' | '30d' | '90d' = '30d'): Promise<{
    patterns: LearningPattern[];
    insights: BehavioralInsight[];
    recommendations: string[];
  }> {
    const since = this.getPeriodDate(period);

    const [
      bestPractices,
      riskPatterns,
      behavioralPatterns,
      operationalPatterns,
    ] = await Promise.all([
      this.detectBestPractices(tenantId, since),
      this.detectRiskPatterns(tenantId, since),
      this.detectBehavioralPatterns(tenantId, since),
      this.detectOperationalPatterns(tenantId, since),
    ]);

    const patterns = [
      ...bestPractices,
      ...riskPatterns,
      ...behavioralPatterns,
      ...operationalPatterns,
    ];

    const insights = await this.generateBehavioralInsights(tenantId, period);
    const recommendations = this.generateRecommendations(patterns, insights);

    return { patterns, insights, recommendations };
  }

  /**
   * Detect best practices from successful outcomes
   */
  private async detectBestPractices(tenantId: string, since: Date): Promise<LearningPattern[]> {
    const db = this.db;
    const patterns: LearningPattern[] = [];

    // Fast CAPA closure pattern
    const fastCapas = await (db.capa || db.correctiveAction)?.findMany?.({
      where: {
        tenantId,
        status: 'CLOSED',
        createdAt: { gte: since },
        closedAt: { not: null },
      },
      include: { owner: { select: { id: true, name: true } } },
      take: 50,
    }) || [];

    const capasWithDuration = fastCapas.map((c: any) => ({
      ...c,
      duration: c.closedAt ? new Date(c.closedAt).getTime() - new Date(c.createdAt).getTime() : Infinity,
    }));

    const fastClosures = capasWithDuration.filter((c: any) => c.duration < 7 * 86400000);
    if (fastClosures.length > 3) {
      const owners = [...new Set(fastClosures.map((c: any) => c.owner?.name).filter(Boolean))];
      patterns.push({
        id: `bp_fast_capa_${Date.now()}`,
        type: 'BEST_PRACTICE',
        category: 'CAPA_MANAGEMENT',
        description: `Práctica efectiva: Cierre rápido de CAPAs (< 7 días) por ${owners.join(', ')}`,
        confidence: Math.min(fastClosures.length / 10, 0.95),
        frequency: fastClosures.length,
        firstObserved: fastClosures[fastClosures.length - 1]?.createdAt || since,
        lastObserved: fastClosures[0]?.closedAt || new Date(),
        entities: owners,
        impact: 'POSITIVE',
        recommendedAction: 'Replicar metodología de cierre rápido en otros responsables',
        tenantId,
      });
    }

    // Low NCR teams
    const teamNCRs = await this.analyzeTeamNCRRates(tenantId, since);
    const bestTeams = teamNCRs.filter((t: any) => t.ncrRate < 0.05);
    if (bestTeams.length > 0) {
      patterns.push({
        id: `bp_low_ncr_${Date.now()}`,
        type: 'BEST_PRACTICE',
        category: 'QUALITY_PERFORMANCE',
        description: `Equipos con baja tasa de NCRs: ${bestTeams.map((t: any) => t.name).join(', ')}`,
        confidence: 0.8,
        frequency: bestTeams.length,
        firstObserved: since,
        lastObserved: new Date(),
        entities: bestTeams.map((t: any) => t.id),
        impact: 'POSITIVE',
        recommendedAction: 'Documentar prácticas de calidad de estos equipos',
        tenantId,
      });
    }

    return patterns;
  }

  /**
   * Detect risk patterns from incidents
   */
  private async detectRiskPatterns(tenantId: string, since: Date): Promise<LearningPattern[]> {
    const db = this.db;
    const patterns: LearningPattern[] = [];

    // Recurring NCR types
    const ncrs = await (db.nonConformityReport || db.ncr)?.findMany?.({
      where: { tenantId, createdAt: { gte: since } },
      select: { type: true, category: true, rootCause: true },
      take: 200,
    }) || [];

    const typeCounts: Record<string, number> = {};
    ncrs.forEach((n: any) => {
      const key = n.type || n.category || 'UNKNOWN';
      typeCounts[key] = (typeCounts[key] || 0) + 1;
    });

    const recurringTypes = Object.entries(typeCounts)
      .filter(([_, count]) => count > 3)
      .sort((a, b) => b[1] - a[1]);

    for (const [type, count] of recurringTypes.slice(0, 3)) {
      patterns.push({
        id: `risk_recurring_${type}_${Date.now()}`,
        type: 'RISK_PATTERN',
        category: 'RECURRING_NCR',
        description: `NCRs recurrentes tipo "${type}": ${count} ocurrencias`,
        confidence: Math.min(count / 10, 0.9),
        frequency: count,
        firstObserved: since,
        lastObserved: new Date(),
        entities: [type],
        impact: 'NEGATIVE',
        recommendedAction: `Analizar root cause de NCRs tipo "${type}" y fortalecer controles preventivos`,
        tenantId,
      });
    }

    // CAPA overdue patterns
    const overdueCapas = await (db.capa || db.correctiveAction)?.count?.({
      where: {
        tenantId,
        dueDate: { lt: new Date() },
        status: { not: 'CLOSED' },
      },
    }) || 0;

    if (overdueCapas > 5) {
      patterns.push({
        id: `risk_overdue_capa_${Date.now()}`,
        type: 'RISK_PATTERN',
        category: 'CAPA_OVERDUE',
        description: `Patrón de vencimientos: ${overdueCapas} CAPAs vencidas`,
        confidence: 0.85,
        frequency: overdueCapas,
        firstObserved: since,
        lastObserved: new Date(),
        entities: [],
        impact: 'NEGATIVE',
        recommendedAction: 'Revisar capacidad de recursos asignados a CAPAs',
        tenantId,
      });
    }

    return patterns;
  }

  /**
   * Detect behavioral patterns
   */
  private async detectBehavioralPatterns(tenantId: string, since: Date): Promise<LearningPattern[]> {
    const patterns: LearningPattern[] = [];

    // High performer identification
    const highPerformers = await this.identifyHighPerformers(tenantId, since);
    if (highPerformers.length > 0) {
      patterns.push({
        id: `behavior_high_perf_${Date.now()}`,
        type: 'BEHAVIORAL',
        category: 'HIGH_PERFORMERS',
        description: `Colaboradores de alto desempeño identificados: ${highPerformers.length}`,
        confidence: 0.75,
        frequency: highPerformers.length,
        firstObserved: since,
        lastObserved: new Date(),
        entities: highPerformers.map((p: any) => p.id),
        impact: 'POSITIVE',
        recommendedAction: 'Considerar para mentoría y roles de liderazgo',
        tenantId,
      });
    }

    // Training effectiveness
    const trainingEffectiveness = await this.analyzeTrainingEffectiveness(tenantId, since);
    if (trainingEffectiveness.effectiveness < 0.6) {
      patterns.push({
        id: `behavior_training_${Date.now()}`,
        type: 'BEHAVIORAL',
        category: 'TRAINING_EFFECTIVENESS',
        description: `Baja efectividad de capacitaciones (${Math.round(trainingEffectiveness.effectiveness * 100)}%)`,
        confidence: 0.7,
        frequency: trainingEffectiveness.total,
        firstObserved: since,
        lastObserved: new Date(),
        entities: [],
        impact: 'NEGATIVE',
        recommendedAction: 'Revisar metodología de capacitación y evaluar relevancia',
        tenantId,
      });
    }

    return patterns;
  }

  /**
   * Detect operational patterns
   */
  private async detectOperationalPatterns(tenantId: string, since: Date): Promise<LearningPattern[]> {
    const db = this.db;
    const patterns: LearningPattern[] = [];

    // Fleet utilization patterns
    const vehicles = await db.vehiculo?.findMany?.({
      where: { tenantId },
      select: { status: true, utilizationRate: true },
    }) || [];

    const lowUtilization = vehicles.filter((v: any) => v.utilizationRate && v.utilizationRate < 0.3);
    if (lowUtilization.length > vehicles.length * 0.2) {
      patterns.push({
        id: `op_low_utilization_${Date.now()}`,
        type: 'OPERATIONAL',
        category: 'FLEET_UTILIZATION',
        description: `Baja utilización de flota: ${lowUtilization.length}/${vehicles.length} vehículos (< 30%)`,
        confidence: 0.8,
        frequency: lowUtilization.length,
        firstObserved: since,
        lastObserved: new Date(),
        entities: lowUtilization.map((v: any) => v.id),
        impact: 'NEGATIVE',
        recommendedAction: 'Evaluar redistribución de activos o reducción de flota',
        tenantId,
      });
    }

    // Project velocity patterns
    const projects = await db.project360?.findMany?.({
      where: { tenantId, deletedAt: null },
      select: { status: true, progress: true, startDate: true, endDate: true },
    }) || [];

    const delayedProjects = projects.filter((p: any) => {
      if (!p.endDate || !p.startDate) return false;
      const expectedProgress = ((Date.now() - new Date(p.startDate).getTime()) / 
        (new Date(p.endDate).getTime() - new Date(p.startDate).getTime())) * 100;
      return p.progress && p.progress < expectedProgress * 0.8;
    });

    if (delayedProjects.length > projects.length * 0.3) {
      patterns.push({
        id: `op_project_delays_${Date.now()}`,
        type: 'OPERATIONAL',
        category: 'PROJECT_DELAYS',
        description: `Patrón de retrasos: ${delayedProjects.length}/${projects.length} proyectos`,
        confidence: 0.75,
        frequency: delayedProjects.length,
        firstObserved: since,
        lastObserved: new Date(),
        entities: delayedProjects.map((p: any) => p.id),
        impact: 'NEGATIVE',
        recommendedAction: 'Analizar causas comunes de retraso y mejorar estimación',
        tenantId,
      });
    }

    return patterns;
  }

  /**
   * Generate behavioral insights
   */
  private async generateBehavioralInsights(tenantId: string, period: string): Promise<BehavioralInsight[]> {
    const insights: BehavioralInsight[] = [];

    // Team efficiency insight
    const teamEfficiency = await this.calculateTeamEfficiency(tenantId);
    insights.push({
      dimension: 'TEAM_EFFICIENCY',
      metric: 'Task Completion Rate',
      value: teamEfficiency.rate,
      trend: teamEfficiency.trend,
      comparison: {
        vsPeriod: period,
        vsOrganization: 'ABOVE_AVERAGE',
      },
      insight: `Eficiencia de equipo: ${Math.round(teamEfficiency.rate * 100)}%`,
      recommendation: teamEfficiency.rate < 0.7 ? 'Revisar carga de trabajo y distribución' : undefined,
    });

    // Compliance behavior insight
    const complianceScore = await this.calculateComplianceBehavior(tenantId);
    insights.push({
      dimension: 'COMPLIANCE_BEHAVIOR',
      metric: 'On-time Compliance',
      value: complianceScore.score,
      trend: complianceScore.trend,
      comparison: {
        vsPeriod: period,
      },
      insight: `Cumplimiento puntual: ${Math.round(complianceScore.score * 100)}%`,
      recommendation: complianceScore.score < 0.8 ? 'Fortalecer seguimiento de vencimientos' : undefined,
    });

    return insights;
  }

  /**
   * Generate recommendations from patterns and insights
   */
  private generateRecommendations(patterns: LearningPattern[], insights: BehavioralInsight[]): string[] {
    const recommendations: string[] = [];

    // From patterns
    for (const pattern of patterns.filter(p => p.impact === 'NEGATIVE')) {
      if (pattern.recommendedAction) {
        recommendations.push(pattern.recommendedAction);
      }
    }

    // From insights
    for (const insight of insights) {
      if (insight.recommendation) {
        recommendations.push(insight.recommendation);
      }
    }

    // Strategic recommendations
    const positivePatterns = patterns.filter(p => p.impact === 'POSITIVE');
    if (positivePatterns.length > 3) {
      recommendations.push('Documentar y replicar mejores prácticas identificadas');
    }

    const riskPatterns = patterns.filter(p => p.type === 'RISK_PATTERN');
    if (riskPatterns.length > 3) {
      recommendations.push('Implementar programa de mitigación de riesgos sistémicos');
    }

    return [...new Set(recommendations)];
  }

  // ============================================================
  // HELPER METHODS
  // ============================================================

  private getPeriodDate(period: string): Date {
    const days: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 };
    return new Date(Date.now() - (days[period] || 30) * 86400000);
  }

  private async analyzeTeamNCRRates(tenantId: string, since: Date): Promise<any[]> {
    // Simplified - would need team grouping
    return [];
  }

  private async identifyHighPerformers(tenantId: string, since: Date): Promise<any[]> {
    // Based on task completion, low NCR rate, etc.
    return [];
  }

  private async analyzeTrainingEffectiveness(tenantId: string, since: Date): Promise<any> {
    return { effectiveness: 0.75, total: 10 };
  }

  private async calculateTeamEfficiency(tenantId: string): Promise<any> {
    return { rate: 0.78, trend: 'STABLE' };
  }

  private async calculateComplianceBehavior(tenantId: string): Promise<any> {
    return { score: 0.82, trend: 'STABLE' };
  }
}

// Singleton instance
export let organizationalLearningEngine: OrganizationalLearningEngine;

export function initializeOrganizationalLearningEngine(prisma: PrismaClient): OrganizationalLearningEngine {
  if (!organizationalLearningEngine) {
    organizationalLearningEngine = new OrganizationalLearningEngine(prisma);
  }
  return organizationalLearningEngine;
}
