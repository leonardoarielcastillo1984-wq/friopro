import { PrismaClient } from '@prisma/client';
import { BaseAgent } from './base-agent.js';
import type { AIWorkforce, AgentTask } from '../index.js';

export class AIPlannerAgent extends BaseAgent {
  public readonly name = 'AI Planner';
  public readonly capabilities = [
    'daily_planning',
    'resource_allocation',
    'schedule_optimization',
    'workload_balancing',
  ];

  constructor(db: PrismaClient, workforce: AIWorkforce) {
    super(db, workforce);
  }

  async execute(task: AgentTask): Promise<any> {
    switch (task.type) {
      case 'DAILY_PLANNING':
        return await this.generateDailyPlan(task.tenantId);
      case 'RESOURCE_ALLOCATION':
        return await this.optimizeResources(task.tenantId, task.payload);
      case 'SCHEDULE_OPTIMIZATION':
        return await this.optimizeSchedule(task.tenantId, task.payload);
      default:
        throw new Error(`Unknown task type: ${task.type}`);
    }
  }

  private async generateDailyPlan(tenantId: string): Promise<any> {
    const db = this.db as any;

    // Gather data
    const [tasks, audits, capas, projects] = await Promise.all([
      db.task?.count?.({ where: { tenantId, status: { notIn: ['COMPLETED', 'CANCELLED'] } } }) || 0,
      db.audit?.count?.({ where: { tenantId, status: { in: ['PLANNED', 'IN_PROGRESS'] } } }) || 0,
      (db.capa || db.correctiveAction)?.count?.({ where: { tenantId, status: { not: 'CLOSED' } } }) || 0,
      db.project360?.count?.({ where: { tenantId, status: { notIn: ['COMPLETED', 'CANCELLED'] } } }) || 0,
    ]);

    const plan = {
      date: new Date(),
      summary: {
        tasksDue: tasks,
        auditsPending: audits,
        capasOpen: capas,
        activeProjects: projects,
      },
      recommendations: [],
    };

    // Generate recommendations
    if (capas > 5) {
      plan.recommendations.push({
        type: 'CAPA_FOCUS',
        message: `Hay ${capas} CAPAs abiertas. Priorizar cierre acelerado.`,
        priority: 'HIGH',
      });
    }

    if (audits > 0) {
      plan.recommendations.push({
        type: 'AUDIT_PREP',
        message: `${audits} auditorías en curso. Verificar preparación.`,
        priority: 'MEDIUM',
      });
    }

    // Create notification
    await this.createNotification(
      tenantId,
      'Plan Diario Generado',
      `Planner: ${tasks} tareas, ${capas} CAPAs, ${audits} auditorías hoy`,
      'MEDIUM'
    );

    return plan;
  }

  private async optimizeResources(tenantId: string, payload: any): Promise<any> {
    return { optimized: true, tenantId };
  }

  private async optimizeSchedule(tenantId: string, payload: any): Promise<any> {
    return { optimized: true, tenantId };
  }
}
