/**
 * Base Agent Class for AI Workforce
 */

import { PrismaClient } from '@prisma/client';
import type { AIWorkforce, AgentTask } from '../index.js';

export abstract class BaseAgent {
  public abstract readonly name: string;
  public abstract readonly capabilities: string[];
  protected isRunning: boolean = false;

  constructor(
    protected db: PrismaClient,
    protected workforce: AIWorkforce
  ) {}

  async start(): Promise<void> {
    this.isRunning = true;
  }

  async stop(): Promise<void> {
    this.isRunning = false;
  }

  abstract execute(task: AgentTask): Promise<any>;

  protected async createNotification(tenantId: string, title: string, message: string, priority: string = 'MEDIUM'): Promise<void> {
    const db = this.db as any;
    await db.notification?.create?.({
      data: {
        tenantId,
        title,
        message,
        type: 'AI_AGENT',
        priority,
        metadata: { agent: this.name, timestamp: new Date() },
      },
    });
  }

  protected async createDraft(type: string, data: any, tenantId: string): Promise<string> {
    const db = this.db as any;
    const draft = await db.aiDraft?.create?.({
      data: {
        tenantId,
        type,
        content: data,
        status: 'PENDING_REVIEW',
        createdByAgent: this.name,
      },
    });
    return draft?.id || `draft_${Date.now()}`;
  }
}
