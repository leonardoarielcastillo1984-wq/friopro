/**
 * AI WORKFORCE
 * FASE 6.3 — Autonomous AI Agents
 * 
 * Agentes autónomos permanentes que:
 * - Trabajan continuamente en background
 * - Monitorean eventos 24/7
 * - Generan recomendaciones proactivas
 * - Crean borradores automáticamente
 * - Preparan análisis preventivos
 * - Anticipan problemas
 */

import { PrismaClient } from '@prisma/client';
import Bull from 'bull';
import { eventEngine } from '../ai-event-engine.js';
import { CorrelationEngine } from '../ai-correlation-engine.js';
import { AnomalyDetector } from '../ai-anomaly-detector.js';
import { AIPriorityEngine } from '../ai-priority-engine.js';
import { AutonomousOrchestrator } from '../autonomous-orchestrator.js';
import { AIPlannerAgent } from './agents/planner-agent.js';
import { AIEscalationAgent } from './agents/escalation-agent.js';
import { AISimulationAgent } from './agents/simulation-agent.js';
import { AIOptimizationAgent } from './agents/optimization-agent.js';
import { AIComplianceWatcher } from './agents/compliance-watcher.js';
import { AIAuditPreparationAgent } from './agents/audit-preparation-agent.js';
import { AIExecutiveAdvisor } from './agents/executive-advisor.js';

// ============================================================
// TYPES
// ============================================================

export type AgentType = 
  | 'PLANNER'
  | 'ESCALATION'
  | 'SIMULATION'
  | 'OPTIMIZATION'
  | 'COMPLIANCE_WATCHER'
  | 'AUDIT_PREPARATION'
  | 'EXECUTIVE_ADVISOR';

export interface AgentStatus {
  id: string;
  type: AgentType;
  name: string;
  status: 'IDLE' | 'WORKING' | 'ERROR' | 'PAUSED';
  lastActivity: Date;
  currentTask?: string;
  tasksCompleted: number;
  tasksFailed: number;
  uptime: number; // seconds
  capabilities: string[];
}

export interface AgentTask {
  id: string;
  agentType: AgentType;
  type: string;
  payload: any;
  tenantId: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface WorkforceActivity {
  timestamp: Date;
  agentType: AgentType;
  agentName: string;
  action: string;
  description: string;
  entityType?: string;
  entityId?: string;
  impact: 'high' | 'medium' | 'low';
  tenantId: string;
}

// ============================================================
// AI WORKFORCE ORCHESTRATOR
// ============================================================

export class AIWorkforce {
  private db: any;
  private taskQueue!: Bull.Queue;
  private agents: Map<AgentType, any> = new Map();
  private agentStatuses: Map<string, AgentStatus> = new Map();
  private isRunning: boolean = false;
  private activityLog: WorkforceActivity[] = [];
  private readonly MAX_LOG_SIZE = 1000;

  constructor(
    prisma: PrismaClient,
    private redisUrl: string = process.env.REDIS_URL || 'redis://localhost:6379'
  ) {
    this.db = prisma as any;
    this.initializeQueue();
    this.initializeAgents(prisma);
  }

  private initializeQueue(): void {
    this.taskQueue = new Bull('ai-workforce-tasks', this.redisUrl, {
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    });

    // Process jobs
    this.taskQueue.process(async (job) => {
      return await this.executeAgentTask(job.data as AgentTask);
    });
  }

  private initializeAgents(prisma: PrismaClient): void {
    // Initialize all 7 agents
    this.agents.set('PLANNER', new AIPlannerAgent(prisma, this));
    this.agents.set('ESCALATION', new AIEscalationAgent(prisma, this));
    this.agents.set('SIMULATION', new AISimulationAgent(prisma, this));
    this.agents.set('OPTIMIZATION', new AIOptimizationAgent(prisma, this));
    this.agents.set('COMPLIANCE_WATCHER', new AIComplianceWatcher(prisma, this));
    this.agents.set('AUDIT_PREPARATION', new AIAuditPreparationAgent(prisma, this));
    this.agents.set('EXECUTIVE_ADVISOR', new AIExecutiveAdvisor(prisma, this));

    // Initialize statuses
    for (const [type, agent] of this.agents) {
      this.agentStatuses.set(type, {
        id: `${type}_${Date.now()}`,
        type,
        name: agent.name,
        status: 'IDLE',
        lastActivity: new Date(),
        tasksCompleted: 0,
        tasksFailed: 0,
        uptime: 0,
        capabilities: agent.capabilities,
      });
    }
  }

  /**
   * Start the AI Workforce
   */
  async start(): Promise<void> {
    if (this.isRunning) return;

    this.isRunning = true;
    console.log('[AIWorkforce] Starting all agents...');

    // Start each agent
    for (const [type, agent] of this.agents) {
      await agent.start();
      this.updateAgentStatus(type, { status: 'IDLE' });
      console.log(`[AIWorkforce] Agent ${type} started`);
    }

    // Schedule periodic tasks
    this.schedulePeriodicTasks();

    console.log('[AIWorkforce] All agents operational');
  }

  /**
   * Stop the AI Workforce
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;

    console.log('[AIWorkforce] Stopping all agents...');

    for (const [type, agent] of this.agents) {
      await agent.stop();
      this.updateAgentStatus(type, { status: 'PAUSED' });
    }

    await this.taskQueue.close();
    this.isRunning = false;

    console.log('[AIWorkforce] All agents stopped');
  }

  /**
   * Schedule periodic background tasks for all agents
   */
  private schedulePeriodicTasks(): void {
    // Planner Agent - Daily planning
    setInterval(async () => {
      await this.submitTask({
        agentType: 'PLANNER',
        type: 'DAILY_PLANNING',
        payload: {},
        priority: 'high',
      });
    }, 24 * 60 * 60 * 1000); // Daily

    // Compliance Watcher - Hourly checks
    setInterval(async () => {
      await this.submitTask({
        agentType: 'COMPLIANCE_WATCHER',
        type: 'HOURLY_SCAN',
        payload: {},
        priority: 'medium',
      });
    }, 60 * 60 * 1000); // Hourly

    // Audit Preparation - Weekly checks
    setInterval(async () => {
      await this.submitTask({
        agentType: 'AUDIT_PREPARATION',
        type: 'WEEKLY_READINESS',
        payload: {},
        priority: 'medium',
      });
    }, 7 * 24 * 60 * 60 * 1000); // Weekly

    // Executive Advisor - Daily brief preparation
    setInterval(async () => {
      await this.submitTask({
        agentType: 'EXECUTIVE_ADVISOR',
        type: 'DAILY_BRIEF',
        payload: {},
        priority: 'high',
      });
    }, 24 * 60 * 60 * 1000); // Daily

    // Optimization Agent - Continuous optimization
    setInterval(async () => {
      await this.submitTask({
        agentType: 'OPTIMIZATION',
        type: 'CONTINUOUS_OPTIMIZE',
        payload: {},
        priority: 'low',
      });
    }, 4 * 60 * 60 * 1000); // Every 4 hours
  }

  /**
   * Submit a task to the workforce
   */
  async submitTask(task: Omit<AgentTask, 'id' | 'status' | 'createdAt'> & { tenantId: string }): Promise<string> {
    const fullTask: AgentTask = {
      ...task,
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: 'pending',
      createdAt: new Date(),
    };

    await this.taskQueue.add(fullTask, {
      priority: this.priorityToNumber(task.priority),
    });

    this.updateAgentStatus(task.agentType, {
      status: 'WORKING',
      currentTask: task.type,
    });

    return fullTask.id;
  }

  /**
   * Execute an agent task
   */
  private async executeAgentTask(task: AgentTask): Promise<any> {
    const agent = this.agents.get(task.agentType);
    if (!agent) {
      throw new Error(`Agent ${task.agentType} not found`);
    }

    const startTime = Date.now();
    task.startedAt = new Date();

    try {
      this.updateAgentStatus(task.agentType, { status: 'WORKING' });

      const result = await agent.execute(task);

      task.status = 'completed';
      task.completedAt = new Date();

      this.updateAgentStatus(task.agentType, {
        status: 'IDLE',
        tasksCompleted: (this.agentStatuses.get(task.agentType)?.tasksCompleted || 0) + 1,
        lastActivity: new Date(),
      });

      // Log activity
      this.logActivity({
        timestamp: new Date(),
        agentType: task.agentType,
        agentName: agent.name,
        action: task.type,
        description: `Completed ${task.type} in ${Date.now() - startTime}ms`,
        impact: task.priority === 'critical' ? 'high' : task.priority === 'high' ? 'medium' : 'low',
        tenantId: task.tenantId,
      });

      return result;
    } catch (error: any) {
      task.status = 'failed';
      task.error = error.message;

      this.updateAgentStatus(task.agentType, {
        status: 'ERROR',
        tasksFailed: (this.agentStatuses.get(task.agentType)?.tasksFailed || 0) + 1,
      });

      throw error;
    }
  }

  /**
   * Update agent status
   */
  private updateAgentStatus(type: AgentType, updates: Partial<AgentStatus>): void {
    const current = this.agentStatuses.get(type);
    if (current) {
      this.agentStatuses.set(type, { ...current, ...updates });
    }
  }

  /**
   * Log workforce activity
   */
  private logActivity(activity: WorkforceActivity): void {
    this.activityLog.unshift(activity);
    if (this.activityLog.length > this.MAX_LOG_SIZE) {
      this.activityLog = this.activityLog.slice(0, this.MAX_LOG_SIZE);
    }
  }

  /**
   * Convert priority to Bull priority number
   */
  private priorityToNumber(priority: string): number {
    const map: Record<string, number> = {
      'critical': 1,
      'high': 5,
      'medium': 10,
      'low': 20,
    };
    return map[priority] || 10;
  }

  // ============================================================
  // PUBLIC API
  // ============================================================

  /**
   * Get status of all agents
   */
  getAllAgentStatuses(): AgentStatus[] {
    return Array.from(this.agentStatuses.values());
  }

  /**
   * Get status of specific agent
   */
  getAgentStatus(type: AgentType): AgentStatus | undefined {
    return this.agentStatuses.get(type);
  }

  /**
   * Get recent workforce activity
   */
  getActivityLog(limit: number = 50, agentType?: AgentType): WorkforceActivity[] {
    let logs = this.activityLog;
    if (agentType) {
      logs = logs.filter(a => a.agentType === agentType);
    }
    return logs.slice(0, limit);
  }

  /**
   * Trigger a specific agent manually
   */
  async triggerAgent(type: AgentType, taskType: string, payload: any, tenantId: string, priority: 'critical' | 'high' | 'medium' | 'low' = 'medium'): Promise<string> {
    return await this.submitTask({
      agentType: type,
      type: taskType,
      payload,
      tenantId,
      priority,
    });
  }

  /**
   * Get workforce statistics
   */
  getStatistics(): {
    totalAgents: number;
    activeAgents: number;
    totalTasksCompleted: number;
    totalTasksFailed: number;
    uptime: number;
  } {
    const statuses = Array.from(this.agentStatuses.values());
    return {
      totalAgents: statuses.length,
      activeAgents: statuses.filter(s => s.status !== 'PAUSED' && s.status !== 'ERROR').length,
      totalTasksCompleted: statuses.reduce((sum, s) => sum + s.tasksCompleted, 0),
      totalTasksFailed: statuses.reduce((sum, s) => sum + s.tasksFailed, 0),
      uptime: statuses.reduce((sum, s) => sum + s.uptime, 0),
    };
  }
}

// Singleton instance
export let aiWorkforce: AIWorkforce;

export function initializeAIWorkforce(prisma: PrismaClient, redisUrl?: string): AIWorkforce {
  if (!aiWorkforce) {
    aiWorkforce = new AIWorkforce(prisma, redisUrl);
  }
  return aiWorkforce;
}
