import { PrismaClient } from '@prisma/client';
import { BaseAgent } from './base-agent.js';
import type { AIWorkforce, AgentTask } from '../index.js';

export class AIEscalationAgent extends BaseAgent {
  public readonly name = 'AI Escalation Manager';
  public readonly capabilities = [
    'escalation_detection',
    'stakeholder_notification',
    'escalation_workflows',
    'priority_reassignment',
  ];

  constructor(db: PrismaClient, workforce: AIWorkforce) {
    super(db, workforce);
  }

  async execute(task: AgentTask): Promise<any> {
    switch (task.type) {
      case 'CHECK_ESCALATIONS':
        return await this.checkEscalations(task.tenantId);
      case 'PROCESS_ESCALATION':
        return await this.processEscalation(task.tenantId, task.payload);
      default:
        throw new Error(`Unknown task type: ${task.type}`);
    }
  }

  private async checkEscalations(tenantId: string): Promise<any> {
    const db = this.db as any;
    const escalations: any[] = [];

    // Check overdue CAPAs
    const overdueCapas = await (db.capa || db.correctiveAction)?.findMany?.({
      where: {
        tenantId,
        dueDate: { lt: new Date() },
        status: { not: 'CLOSED' },
      },
      take: 10,
    }) || [];

    for (const capa of overdueCapas) {
      escalations.push({
        type: 'CAPA_OVERDUE',
        entityId: capa.id,
        severity: 'HIGH',
        message: `CAPA vencida desde ${capa.dueDate}`,
      });
    }

    // Check critical risks
    const criticalRisks = await db.risk?.findMany?.({
      where: {
        tenantId,
        level: { in: ['CRITICAL', 'HIGH'] },
        status: { not: 'CLOSED' },
      },
      take: 10,
    }) || [];

    for (const risk of criticalRisks) {
      escalations.push({
        type: 'CRITICAL_RISK',
        entityId: risk.id,
        severity: 'CRITICAL',
        message: `Riesgo ${risk.level}: ${risk.title}`,
      });
    }

    // Process escalations
    for (const escalation of escalations) {
      await this.processEscalation(tenantId, escalation);
    }

    return { escalationsProcessed: escalations.length, escalations };
  }

  private async processEscalation(tenantId: string, escalation: any): Promise<any> {
    // Create high-priority notification
    await this.createNotification(
      tenantId,
      `ESCALAMIENTO: ${escalation.type}`,
      escalation.message,
      'CRITICAL'
    );

    // Create escalation record
    const db = this.db as any;
    await db.escalation?.create?.({
      data: {
        tenantId,
        type: escalation.type,
        entityId: escalation.entityId,
        severity: escalation.severity,
        status: 'PENDING',
        message: escalation.message,
        escalatedBy: 'AI_AGENT',
      },
    });

    return { processed: true, escalation };
  }
}
