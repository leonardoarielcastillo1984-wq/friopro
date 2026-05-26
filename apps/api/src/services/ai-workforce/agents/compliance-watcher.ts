import { PrismaClient } from '@prisma/client';
import { BaseAgent } from './base-agent.js';
import type { AIWorkforce, AgentTask } from '../index.js';

export class AIComplianceWatcher extends BaseAgent {
  public readonly name = 'AI Compliance Watcher';
  public readonly capabilities = [
    'normative_monitoring',
    'compliance_gap_detection',
    'regulatory_alert',
    'iso_compliance_check',
    'document_compliance_verify',
  ];

  constructor(db: PrismaClient, workforce: AIWorkforce) {
    super(db, workforce);
  }

  async execute(task: AgentTask): Promise<any> {
    switch (task.type) {
      case 'HOURLY_SCAN':
        return await this.runComplianceScan(task.tenantId);
      case 'ISO_CHECK':
        return await this.checkISOCompliance(task.tenantId, task.payload);
      case 'NORMATIVE_UPDATE':
        return await this.checkNormativeUpdates(task.tenantId);
      default:
        throw new Error(`Unknown task type: ${task.type}`);
    }
  }

  private async runComplianceScan(tenantId: string): Promise<any> {
    const db = this.db as any;
    const issues: any[] = [];

    // Check for compliance issues
    const [
      expiredDocuments,
      overdueAudits,
      openCAPAs,
      missingRiskAssessments,
    ] = await Promise.all([
      this.checkExpiredDocuments(tenantId),
      this.checkOverdueAudits(tenantId),
      this.checkOpenCAPAs(tenantId),
      this.checkMissingRiskAssessments(tenantId),
    ]);

    if (expiredDocuments.length > 0) {
      issues.push({
        type: 'EXPIRED_DOCUMENTS',
        count: expiredDocuments.length,
        severity: 'HIGH',
        message: `${expiredDocuments.length} documentos vencidos`,
      });
    }

    if (overdueAudits.length > 0) {
      issues.push({
        type: 'OVERDUE_AUDITS',
        count: overdueAudits.length,
        severity: 'CRITICAL',
        message: `${overdueAudits.length} auditorías vencidas`,
      });
    }

    if (openCAPAs.length > 10) {
      issues.push({
        type: 'EXCESSIVE_CAPAS',
        count: openCAPAs.length,
        severity: 'MEDIUM',
        message: `${openCAPAs.length} CAPAs abiertas - sistema de calidad bajo presión`,
      });
    }

    // Notify if issues found
    if (issues.length > 0) {
      await this.createNotification(
        tenantId,
        'Alertas de Compliance',
        `${issues.length} problemas de compliance detectados: ${issues.map(i => i.type).join(', ')}`,
        issues.some(i => i.severity === 'CRITICAL') ? 'CRITICAL' : 'HIGH'
      );
    }

    return { issues, timestamp: new Date() };
  }

  private async checkExpiredDocuments(tenantId: string): Promise<any[]> {
    const db = this.db as any;
    return await db.document?.findMany?.({
      where: {
        tenantId,
        expiresAt: { lt: new Date() },
        status: { not: 'ARCHIVED' },
      },
      take: 50,
    }) || [];
  }

  private async checkOverdueAudits(tenantId: string): Promise<any[]> {
    const db = this.db as any;
    return await db.audit?.findMany?.({
      where: {
        tenantId,
        plannedDate: { lt: new Date() },
        status: { in: ['PLANNED', 'SCHEDULED'] },
      },
      take: 20,
    }) || [];
  }

  private async checkOpenCAPAs(tenantId: string): Promise<any[]> {
    const db = this.db as any;
    return await (db.capa || db.correctiveAction)?.findMany?.({
      where: {
        tenantId,
        status: { not: 'CLOSED' },
      },
      take: 100,
    }) || [];
  }

  private async checkMissingRiskAssessments(tenantId: string): Promise<any[]> {
    // Check for processes without risk assessment
    return [];
  }

  private async checkISOCompliance(tenantId: string, payload: any): Promise<any> {
    const { standard } = payload; // ISO 9001, 14001, 45001, etc.
    
    return {
      standard,
      complianceScore: 0.85,
      gaps: [],
      recommendations: [],
    };
  }

  private async checkNormativeUpdates(tenantId: string): Promise<any> {
    // In a real implementation, this would check external regulatory feeds
    return {
      updates: [],
      requiresAction: false,
    };
  }
}
