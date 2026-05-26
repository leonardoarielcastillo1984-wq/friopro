import { PrismaClient } from '@prisma/client';
import { BaseAgent } from './base-agent.js';
import type { AIWorkforce, AgentTask } from '../index.js';

export class AIExecutiveAdvisor extends BaseAgent {
  public readonly name = 'AI Executive Advisor';
  public readonly capabilities = [
    'executive_briefing',
    'strategic_analysis',
    'risk_assessment',
    'priority_advice',
    'trend_analysis',
    'decision_support',
  ];

  constructor(db: PrismaClient, workforce: AIWorkforce) {
    super(db, workforce);
  }

  async execute(task: AgentTask): Promise<any> {
    switch (task.type) {
      case 'DAILY_BRIEF':
        return await this.generateDailyBrief(task.tenantId);
      case 'STRATEGIC_ANALYSIS':
        return await this.analyzeStrategy(task.tenantId, task.payload);
      case 'RISK_BRIEFING':
        return await this.riskBriefing(task.tenantId);
      case 'PRIORITY_ADVICE':
        return await this.priorityAdvice(task.tenantId);
      default:
        throw new Error(`Unknown task type: ${task.type}`);
    }
  }

  private async generateDailyBrief(tenantId: string): Promise<any> {
    const db = this.db as any;

    // Gather executive-level data
    const [
      criticalRisks,
      overdueCAPAs,
      atRiskProjects,
      upcomingAudits,
      fleetStats,
      openNCRs,
    ] = await Promise.all([
      db.risk?.count?.({
        where: { tenantId, level: { in: ['CRITICAL', 'HIGH'] }, status: { not: 'CLOSED' } },
      }) || 0,
      (db.capa || db.correctiveAction)?.count?.({
        where: { tenantId, dueDate: { lt: new Date() }, status: { not: 'CLOSED' } },
      }) || 0,
      db.project360?.count?.({
        where: { tenantId, status: 'AT_RISK', deletedAt: null },
      }) || 0,
      db.audit?.count?.({
        where: {
          tenantId,
          plannedDate: { gte: new Date(), lte: new Date(Date.now() + 14 * 86400000) },
        },
      }) || 0,
      this.getFleetStats(tenantId),
      (db.nonConformityReport || db.ncr)?.count?.({
        where: { tenantId, status: { not: 'CLOSED' } },
      }) || 0,
    ]);

    const brief = {
      date: new Date(),
      executiveSummary: {
        status: this.determineOverallStatus(criticalRisks, overdueCAPAs, atRiskProjects),
        alertLevel: criticalRisks > 0 || overdueCAPAs > 5 ? 'RED' : atRiskProjects > 0 ? 'YELLOW' : 'GREEN',
      },
      keyMetrics: {
        criticalRisks,
        overdueCAPAs,
        atRiskProjects,
        upcomingAudits,
        fleetAvailability: fleetStats.availability,
        openNCRs,
      },
      attentionRequired: [],
      strategicRecommendations: [],
    };

    // Generate attention items
    if (criticalRisks > 0) {
      brief.attentionRequired.push({
        severity: 'CRITICAL',
        category: 'RISK',
        message: `${criticalRisks} riesgo(s) crítico(s) requiere(n) decisión ejecutiva`,
        action: 'REVISAR_RIESGOS',
      });
    }

    if (overdueCAPAs > 5) {
      brief.attentionRequired.push({
        severity: 'HIGH',
        category: 'COMPLIANCE',
        message: `${overdueCAPAs} CAPAs vencidas - riesgo de certificación`,
        action: 'ESCALAR_CAPAS',
      });
    }

    if (atRiskProjects > 0) {
      brief.attentionRequired.push({
        severity: 'MEDIUM',
        category: 'PROJECTS',
        message: `${atRiskProjects} proyecto(s) en riesgo`,
        action: 'REVISAR_PROYECTOS',
      });
    }

    if (fleetStats.availability < 0.75) {
      brief.attentionRequired.push({
        severity: 'HIGH',
        category: 'OPERATIONS',
        message: `Disponibilidad de flota ${Math.round(fleetStats.availability * 100)}% - debajo del umbral 75%`,
        action: 'REVISAR_FLOTA',
      });
    }

    // Strategic recommendations
    if (openNCRs > 10) {
      brief.strategicRecommendations.push({
        priority: 'HIGH',
        recommendation: 'Implementar programa de reducción de NCRs',
        expectedImpact: 'Mejorar calidad 20-30% en 90 días',
        investment: 'MEDIO',
      });
    }

    if (upcomingAudits > 0) {
      brief.strategicRecommendations.push({
        priority: upcomingAudits > 2 ? 'HIGH' : 'MEDIUM',
        recommendation: 'Preparar sesión de revisión pre-auditoría',
        expectedImpact: 'Mejorar resultado de auditoría',
        investment: 'BAJO',
      });
    }

    // Create executive notification
    await this.createNotification(
      tenantId,
      `Brief Ejecutivo Diario - Estado: ${brief.executiveSummary.status}`,
      `${brief.attentionRequired.length} tema(s) requieren atención. ${brief.strategicRecommendations.length} recomendación(es) estratégica(s).`,
      brief.executiveSummary.alertLevel === 'RED' ? 'CRITICAL' : 'HIGH'
    );

    // Save as draft report
    await this.createDraft('EXECUTIVE_BRIEF', brief, tenantId);

    return brief;
  }

  private async getFleetStats(tenantId: string): Promise<any> {
    const db = this.db as any;
    const vehicles = await db.vehiculo?.findMany?.({
      where: { tenantId },
      select: { status: true },
    }) || [];

    const operative = vehicles.filter((v: any) => v.status === 'OPERATIVO').length;
    return {
      total: vehicles.length,
      operative,
      availability: vehicles.length > 0 ? operative / vehicles.length : 1,
    };
  }

  private determineOverallStatus(criticalRisks: number, overdueCAPAs: number, atRiskProjects: number): string {
    if (criticalRisks > 0 || overdueCAPAs > 10) return 'ATENCIÓN_URGENTE';
    if (overdueCAPAs > 5 || atRiskProjects > 2) return 'REQUIERE_ATENCIÓN';
    if (atRiskProjects > 0 || overdueCAPAs > 0) return 'SUPERVISAR';
    return 'OPERATIVO_NORMAL';
  }

  private async analyzeStrategy(tenantId: string, payload: any): Promise<any> {
    const { focusArea } = payload;
    
    return {
      focusArea,
      analysis: 'ANALYSIS_PLACEHOLDER',
      recommendations: [],
      timestamp: new Date(),
    };
  }

  private async riskBriefing(tenantId: string): Promise<any> {
    const db = this.db as any;
    
    const risks = await db.risk?.findMany?.({
      where: { tenantId, status: { not: 'CLOSED' } },
      orderBy: [{ level: 'asc' }, { createdAt: 'desc' }],
      take: 20,
    }) || [];

    return {
      totalRisks: risks.length,
      byLevel: {
        critical: risks.filter((r: any) => r.level === 'CRITICAL').length,
        high: risks.filter((r: any) => r.level === 'HIGH').length,
        medium: risks.filter((r: any) => r.level === 'MEDIUM').length,
        low: risks.filter((r: any) => r.level === 'LOW').length,
      },
      topRisks: risks.slice(0, 5),
      trend: 'ESTABLE',
    };
  }

  private async priorityAdvice(tenantId: string): Promise<any> {
    return {
      topPriorities: [],
      rationale: 'Generated based on current organizational state',
      timestamp: new Date(),
    };
  }
}
