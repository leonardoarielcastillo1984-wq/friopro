/**
 * AUTONOMOUS AI ORCHESTRATOR
 * FASE 6 — Autonomous Enterprise Platform
 * 
 * Motor de orquestación autónoma que:
 * - Detecta eventos críticos en tiempo real
 * - Correlaciona módulos
 * - Prioriza acciones automáticamente
 * - Inicia workflows sin intervención humana
 * - Escala problemas según severidad
 */

import { PrismaClient } from '@prisma/client';
import { eventEngine, type EnterpriseEvent, type EventType } from './ai-event-engine.js';
import { CorrelationEngine } from './ai-correlation-engine.js';
import { AnomalyDetector } from './ai-anomaly-detector.js';
import { AIActionEngine } from './ai-action-engine.js';

// ============================================================
// TYPES
// ============================================================

export interface OrchestrationRule {
  id: string;
  name: string;
  description: string;
  trigger: {
    type: string;
    conditions: Array<{
      field: string;
      operator: 'eq' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'in';
      value: any;
    }>;
  };
  correlationCheck?: boolean;
  anomalyCheck?: boolean;
  priority: 'critical' | 'high' | 'medium' | 'low';
  autoExecute: boolean;
  requiresApproval: boolean;
  actions: Array<{
    type: string;
    payload: Record<string, any>;
    delay?: number;
  }>;
  escalation?: {
    threshold: number;
    escalateTo: string[];
    message: string;
  };
  enabled: boolean;
  tenantId: string;
}

export interface OrchestrationResult {
  ruleId: string;
  ruleName: string;
  triggered: boolean;
  correlations?: any[];
  anomalies?: any[];
  actions: Array<{
    type: string;
    status: 'pending' | 'executed' | 'failed' | 'requires_approval';
    result?: any;
    error?: string;
  }>;
  escalated?: boolean;
  escalationMessage?: string;
  timestamp: Date;
}

export interface AutonomousEvent {
  id: string;
  tenantId: string;
  type: string;
  source: string;
  payload: any;
  severity: 'critical' | 'high' | 'medium' | 'low';
  timestamp: Date;
  correlations?: any[];
  suggestedActions?: string[];
  autoExecuted?: boolean;
}

// ============================================================
// BUILT-IN ORCHESTRATION RULES
// ============================================================

const BUILT_IN_RULES: Omit<OrchestrationRule, 'tenantId'>[] = [
  // Rule 1: CAPA vencida → Escalar automáticamente
  {
    id: 'capa_overdue_escalation',
    name: 'CAPA Vencida - Escalamiento',
    description: 'Cuando una CAPA vence, escalar automáticamente a dirección',
    trigger: {
      type: 'capa_overdue',
      conditions: [{ field: 'status', operator: 'eq', value: 'OVERDUE' }],
    },
    priority: 'critical',
    autoExecute: true,
    requiresApproval: false,
    actions: [
      { type: 'NOTIFY_MANAGEMENT', payload: { channels: ['email', 'in_app'] } },
      { type: 'CREATE_TASK', payload: { title: 'Revisar CAPA vencida', priority: 'HIGH' } },
    ],
    escalation: {
      threshold: 1,
      escalateTo: ['quality_manager', 'operations_director'],
      message: 'CAPA vencida requiere atención inmediata',
    },
    enabled: true,
  },

  // Rule 2: KPI crítico → Abrir análisis IA
  {
    id: 'critical_kpi_analysis',
    name: 'KPI Crítico - Análisis IA',
    description: 'Cuando un KPI cae por debajo de umbral crítico, iniciar análisis automático',
    trigger: {
      type: 'kpi_threshold_breach',
      conditions: [{ field: 'severity', operator: 'eq', value: 'CRITICAL' }],
    },
    correlationCheck: true,
    priority: 'high',
    autoExecute: true,
    requiresApproval: false,
    actions: [
      { type: 'ANALYZE_WITH_AI', payload: { depth: 'comprehensive' } },
      { type: 'GENERATE_REPORT', payload: { type: 'executive_summary' } },
      { type: 'SUGGEST_ACTIONS', payload: { count: 3 } },
    ],
    enabled: true,
  },

  // Rule 3: Muchas NCRs → Sugerir auditoría extraordinaria
  {
    id: 'high_ncr_suggest_audit',
    name: 'Alta tasa NCR - Sugerir Auditoría',
    description: 'Cuando hay más de 5 NCRs abiertas en 7 días, sugerir auditoría extraordinaria',
    trigger: {
      type: 'ncr_accumulation',
      conditions: [{ field: 'count_7d', operator: 'gt', value: 5 }],
    },
    priority: 'high',
    autoExecute: false,
    requiresApproval: true,
    actions: [
      { type: 'SUGGEST_AUDIT', payload: { type: 'EXTRAORDINARY', scope: 'focused' } },
      { type: 'ANALYZE_TREND', payload: { period: '30d' } },
    ],
    enabled: true,
  },

  // Rule 4: Caída RRHH → Recomendar capacitación
  {
    id: 'hr_gap_training_recommendation',
    name: 'Brecha RRHH - Recomendar Capacitación',
    description: 'Cuando hay brechas de competencia críticas, recomendar capacitación',
    trigger: {
      type: 'competency_gap_critical',
      conditions: [{ field: 'critical_gaps', operator: 'gt', value: 3 }],
    },
    priority: 'medium',
    autoExecute: false,
    requiresApproval: true,
    actions: [
      { type: 'SCHEDULE_TRAINING', payload: { type: 'urgent' } },
      { type: 'NOTIFY_HR', payload: { priority: 'HIGH' } },
    ],
    enabled: true,
  },

  // Rule 5: Riesgo alto → Generar minuta ejecutiva
  {
    id: 'high_risk_executive_brief',
    name: 'Riesgo Alto - Minuta Ejecutiva',
    description: 'Cuando se detecta riesgo alto, generar minuta automática para ejecutivos',
    trigger: {
      type: 'risk_level_high',
      conditions: [{ field: 'level', operator: 'in', value: ['HIGH', 'CRITICAL'] }],
    },
    correlationCheck: true,
    anomalyCheck: true,
    priority: 'critical',
    autoExecute: true,
    requiresApproval: false,
    actions: [
      { type: 'GENERATE_EXECUTIVE_BRIEF', payload: { urgency: 'immediate' } },
      { type: 'NOTIFY_EXECUTIVES', payload: { channels: ['email', 'sms'] } },
      { type: 'ESCALATE_RISK', payload: { level: 'EXECUTIVE' } },
    ],
    escalation: {
      threshold: 1,
      escalateTo: ['ceo', 'coo', 'risk_manager'],
      message: 'Riesgo crítico detectado - requiere decisión ejecutiva',
    },
    enabled: true,
  },

  // Rule 6: Flota crítica → Mantenimiento urgente
  {
    id: 'fleet_critical_maintenance',
    name: 'Flota Crítica - Mantenimiento Urgente',
    description: 'Cuando disponibilidad de flota cae bajo 70%, generar órdenes de mantenimiento urgentes',
    trigger: {
      type: 'fleet_availability_low',
      conditions: [{ field: 'availability_rate', operator: 'lt', value: 0.70 }],
    },
    priority: 'high',
    autoExecute: true,
    requiresApproval: false,
    actions: [
      { type: 'CREATE_MAINTENANCE_ORDERS', payload: { priority: 'URGENT' } },
      { type: 'NOTIFY_FLEET_MANAGER', payload: { urgency: 'HIGH' } },
      { type: 'SCHEDULE_INSPECTION', payload: { type: 'EMERGENCY' } },
    ],
    enabled: true,
  },

  // Rule 7: Proyecto en riesgo → Alerta y acciones
  {
    id: 'project_at_risk',
    name: 'Proyecto en Riesgo - Acciones Correctivas',
    description: 'Cuando un proyecto entra en estado de riesgo, iniciar protocolo de recuperación',
    trigger: {
      type: 'project_status_risk',
      conditions: [{ field: 'status', operator: 'eq', value: 'AT_RISK' }],
    },
    priority: 'high',
    autoExecute: false,
    requiresApproval: true,
    actions: [
      { type: 'ANALYZE_PROJECT', payload: { depth: 'root_cause' } },
      { type: 'SUGGEST_RECOVERY_PLAN', payload: { type: 'auto' } },
      { type: 'NOTIFY_STAKEHOLDERS', payload: { level: 'PROJECT_TEAM' } },
    ],
    enabled: true,
  },

  // Rule 8: Anomalía crítica → Contención inmediata
  {
    id: 'critical_anomaly_containment',
    name: 'Anomalía Crítica - Contención',
    description: 'Cuando se detecta anomalía crítica, activar protocolo de contención',
    trigger: {
      type: 'anomaly_critical',
      conditions: [{ field: 'severity', operator: 'eq', value: 'CRITICAL' }],
    },
    correlationCheck: true,
    priority: 'critical',
    autoExecute: true,
    requiresApproval: false,
    actions: [
      { type: 'CONTAIN_ANOMALY', payload: { scope: 'immediate' } },
      { type: 'NOTIFY_RESPONSE_TEAM', payload: { urgency: 'CRITICAL' } },
      { type: 'LOG_INCIDENT', payload: { type: 'CRITICAL_ANOMALY' } },
    ],
    escalation: {
      threshold: 1,
      escalateTo: ['incident_commander', 'operations_director'],
      message: 'Anomalía crítica detectada - protocolo de contención activado',
    },
    enabled: true,
  },
];

// ============================================================
// AUTONOMOUS ORCHESTRATOR CLASS
// ============================================================

export class AutonomousOrchestrator {
  private db: any;
  private correlationEngine: CorrelationEngine;
  private anomalyDetector: AnomalyDetector;
  private actionEngine: AIActionEngine;
  private rules: Map<string, OrchestrationRule[]> = new Map();
  private isRunning: boolean = false;
  private intervalId?: NodeJS.Timeout;

  constructor(
    prisma: PrismaClient,
    private app?: any
  ) {
    this.db = prisma as any;
    this.correlationEngine = new CorrelationEngine(prisma);
    this.anomalyDetector = new AnomalyDetector(prisma);
    this.actionEngine = new AIActionEngine(prisma, app);
  }

  /**
   * Initialize orchestrator for a tenant
   */
  async initialize(tenantId: string): Promise<void> {
    // Load or create built-in rules for tenant
    const existingRules = await this.loadRules(tenantId);
    
    if (existingRules.length === 0) {
      // Seed with built-in rules
      for (const rule of BUILT_IN_RULES) {
        await this.createRule({
          ...rule,
          tenantId,
        } as OrchestrationRule);
      }
    }

    this.rules.set(tenantId, await this.loadRules(tenantId));
    console.log(`[AutonomousOrchestrator] Initialized for tenant ${tenantId} with ${this.rules.get(tenantId)?.length} rules`);
  }

  /**
   * Start autonomous monitoring loop
   */
  start(intervalMs: number = 60000): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log(`[AutonomousOrchestrator] Started with ${intervalMs}ms interval`);

    this.intervalId = setInterval(async () => {
      await this.runAutonomousCycle();
    }, intervalMs);
  }

  /**
   * Stop autonomous monitoring
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.isRunning = false;
    console.log('[AutonomousOrchestrator] Stopped');
  }

  /**
   * Run one autonomous cycle (check all tenants)
   */
  private async runAutonomousCycle(): Promise<void> {
    for (const [tenantId, rules] of this.rules) {
      try {
        await this.evaluateRulesForTenant(tenantId, rules);
      } catch (err) {
        console.error(`[AutonomousOrchestrator] Error evaluating tenant ${tenantId}:`, err);
      }
    }
  }

  /**
   * Evaluate all rules for a specific tenant
   */
  private async evaluateRulesForTenant(tenantId: string, rules: OrchestrationRule[]): Promise<void> {
    // Gather current state
    const [correlations, anomalies, events] = await Promise.allSettled([
      this.correlationEngine.detectCorrelations(tenantId),
      this.anomalyDetector.detectAnomalies(tenantId),
      this.getRecentEvents(tenantId, 5),
    ]);

    const context = {
      correlations: correlations.status === 'fulfilled' ? correlations.value : [],
      anomalies: anomalies.status === 'fulfilled' ? anomalies.value : [],
      events: events.status === 'fulfilled' ? events.value : [],
    };

    // Evaluate each rule
    for (const rule of rules.filter(r => r.enabled)) {
      const result = await this.evaluateRule(rule, context, tenantId);
      
      if (result.triggered) {
        await this.publishOrchestrationEvent(tenantId, result);
        
        if (result.escalated) {
          await this.handleEscalation(tenantId, result);
        }
      }
    }
  }

  /**
   * Evaluate a single rule against current context
   */
  private async evaluateRule(
    rule: OrchestrationRule,
    context: { correlations: any[]; anomalies: any[]; events: any[] },
    tenantId: string
  ): Promise<OrchestrationResult> {
    let triggered = false;
    const actions: OrchestrationResult['actions'] = [];
    let escalated = false;
    let escalationMessage: string | undefined;

    // Check trigger conditions based on event type
    triggered = await this.checkTriggerConditions(rule, context, tenantId);

    if (triggered) {
      // Check correlations if required
      if (rule.correlationCheck && context.correlations.length === 0) {
        triggered = false; // Need correlations but none found
      }

      // Check anomalies if required
      if (rule.anomalyCheck && context.anomalies.length === 0) {
        triggered = false; // Need anomalies but none found
      }
    }

    if (triggered) {
      // Execute or queue actions
      for (const action of rule.actions) {
        if (rule.autoExecute && !rule.requiresApproval) {
          const result = await this.executeAction(action, tenantId);
          actions.push(result);
        } else {
          actions.push({
            type: action.type,
            status: 'requires_approval',
          });
        }
      }

      // Check escalation
      if (rule.escalation) {
        const criticalActions = actions.filter(a => a.status === 'failed').length;
        if (criticalActions >= rule.escalation.threshold) {
          escalated = true;
          escalationMessage = rule.escalation.message;
        }
      }
    }

    return {
      ruleId: rule.id,
      ruleName: rule.name,
      triggered,
      correlations: context.correlations,
      anomalies: context.anomalies,
      actions,
      escalated,
      escalationMessage,
      timestamp: new Date(),
    };
  }

  /**
   * Check trigger conditions against database state
   */
  private async checkTriggerConditions(
    rule: OrchestrationRule,
    context: any,
    tenantId: string
  ): Promise<boolean> {
    const db = this.db;

    switch (rule.trigger.type) {
      case 'capa_overdue': {
        const capas = await (db.capa || db.correctiveAction)?.findMany({
          where: {
            tenantId,
            dueDate: { lt: new Date() },
            status: { not: 'CLOSED' },
          },
          take: 1,
        }) || [];
        return capas.length > 0;
      }

      case 'ncr_accumulation': {
        const since = new Date(Date.now() - 7 * 86400000);
        const ncrs = await (db.nonConformityReport || db.ncr || db.nonConformity)?.count({
          where: {
            tenantId,
            createdAt: { gte: since },
            status: { not: 'CLOSED' },
          },
        }) || 0;
        return ncrs > 5;
      }

      case 'competency_gap_critical': {
        const gaps = await db.employeeCompetency?.count({
          where: {
            employee: { tenantId },
            currentLevel: { lt: db.$queryRaw`"requiredLevel"` },
          },
        }) || 0;
        return gaps > 3;
      }

      case 'fleet_availability_low': {
        const vehicles = await db.vehiculo?.findMany({
          where: { tenantId },
          select: { status: true },
        }) || [];
        if (vehicles.length === 0) return false;
        const operative = vehicles.filter((v: any) => v.status === 'OPERATIVO').length;
        return (operative / vehicles.length) < 0.70;
      }

      case 'project_status_risk': {
        const projects = await db.project360?.count({
          where: {
            tenantId,
            status: 'AT_RISK',
            deletedAt: null,
          },
        }) || 0;
        return projects > 0;
      }

      case 'risk_level_high': {
        const risks = await db.risk?.count({
          where: {
            tenantId,
            level: { in: ['HIGH', 'CRITICAL'] },
          },
        }) || 0;
        return risks > 0;
      }

      case 'anomaly_critical':
        return context.anomalies.some((a: any) => a.severity === 'critical');

      case 'kpi_threshold_breach':
        return context.anomalies.some((a: any) => a.type === 'threshold_breach');

      default:
        return false;
    }
  }

  /**
   * Execute an action
   */
  private async executeAction(
    action: { type: string; payload: any },
    tenantId: string
  ): Promise<OrchestrationResult['actions'][0]> {
    try {
      let result: any;

      switch (action.type) {
        case 'NOTIFY_MANAGEMENT':
        case 'NOTIFY_HR':
        case 'NOTIFY_FLEET_MANAGER':
        case 'NOTIFY_EXECUTIVES':
        case 'NOTIFY_RESPONSE_TEAM':
        case 'NOTIFY_STAKEHOLDERS':
          result = await this.sendNotification(tenantId, action);
          break;

        case 'CREATE_TASK':
          result = await this.createTask(tenantId, action.payload);
          break;

        case 'ANALYZE_WITH_AI':
          result = await this.analyzeWithAI(tenantId, action.payload);
          break;

        case 'GENERATE_REPORT':
        case 'GENERATE_EXECUTIVE_BRIEF':
          result = await this.generateReport(tenantId, action.payload);
          break;

        case 'SUGGEST_ACTIONS':
          result = await this.suggestActions(tenantId, action.payload);
          break;

        case 'SUGGEST_AUDIT':
          result = await this.suggestAudit(tenantId, action.payload);
          break;

        case 'SCHEDULE_TRAINING':
          result = await this.scheduleTraining(tenantId, action.payload);
          break;

        case 'CREATE_MAINTENANCE_ORDERS':
          result = await this.createMaintenanceOrders(tenantId, action.payload);
          break;

        case 'SCHEDULE_INSPECTION':
          result = await this.scheduleInspection(tenantId, action.payload);
          break;

        case 'ANALYZE_PROJECT':
          result = await this.analyzeProject(tenantId, action.payload);
          break;

        case 'SUGGEST_RECOVERY_PLAN':
          result = await this.suggestRecoveryPlan(tenantId, action.payload);
          break;

        case 'ESCALATE_RISK':
          result = await this.escalateRisk(tenantId, action.payload);
          break;

        case 'LOG_INCIDENT':
          result = await this.logIncident(tenantId, action.payload);
          break;

        case 'CONTAIN_ANOMALY':
          result = await this.containAnomaly(tenantId, action.payload);
          break;

        default:
          return { type: action.type, status: 'failed', error: 'Unknown action type' };
      }

      return { type: action.type, status: 'executed', result };
    } catch (err: any) {
      return { type: action.type, status: 'failed', error: err.message };
    }
  }

  // ── Action Implementations ─────────────────────────────────

  private async sendNotification(tenantId: string, action: any): Promise<any> {
    const notification = await this.db.notification?.create({
      data: {
        tenantId,
        title: 'Orquestación Autónoma',
        message: action.payload.message || 'Acción automática ejecutada',
        type: 'SYSTEM',
        priority: action.payload.priority || 'MEDIUM',
        metadata: { autoGenerated: true, action },
      },
    });
    return { notificationId: notification?.id };
  }

  private async createTask(tenantId: string, payload: any): Promise<any> {
    const task = await this.db.task?.create({
      data: {
        tenantId,
        title: payload.title,
        description: payload.description || 'Tarea generada automáticamente',
        priority: payload.priority || 'MEDIUM',
        status: 'PENDING',
        dueDate: payload.dueDate ? new Date(payload.dueDate) : new Date(Date.now() + 86400000),
        metadata: { autoGenerated: true },
      },
    });
    return { taskId: task?.id };
  }

  private async analyzeWithAI(tenantId: string, payload: any): Promise<any> {
    // Trigger AI analysis - results stored for later retrieval
    return { analysisId: `analysis_${Date.now()}`, status: 'initiated', depth: payload.depth };
  }

  private async generateReport(tenantId: string, payload: any): Promise<any> {
    return { reportId: `report_${Date.now()}`, type: payload.type, status: 'generated' };
  }

  private async suggestActions(tenantId: string, payload: any): Promise<any> {
    return { suggestions: [], count: payload.count };
  }

  private async suggestAudit(tenantId: string, payload: any): Promise<any> {
    return { auditType: payload.type, scope: payload.scope, suggested: true };
  }

  private async scheduleTraining(tenantId: string, payload: any): Promise<any> {
    return { scheduled: true, type: payload.type };
  }

  private async createMaintenanceOrders(tenantId: string, payload: any): Promise<any> {
    const orders = await this.db.maintenanceOrder?.createMany?.({
      data: [{
        tenantId,
        title: 'Mantenimiento Urgente - Orquestación Autónoma',
        priority: payload.priority,
        status: 'PENDING',
        metadata: { autoGenerated: true },
      }],
    });
    return { ordersCreated: orders?.count || 0 };
  }

  private async scheduleInspection(tenantId: string, payload: any): Promise<any> {
    return { scheduled: true, type: payload.type };
  }

  private async analyzeProject(tenantId: string, payload: any): Promise<any> {
    return { analysisId: `project_analysis_${Date.now()}`, depth: payload.depth };
  }

  private async suggestRecoveryPlan(tenantId: string, payload: any): Promise<any> {
    return { planId: `recovery_${Date.now()}`, suggested: true };
  }

  private async escalateRisk(tenantId: string, payload: any): Promise<any> {
    return { escalated: true, level: payload.level };
  }

  private async logIncident(tenantId: string, payload: any): Promise<any> {
    const incident = await this.db.incident?.create?.({
      data: {
        tenantId,
        type: payload.type,
        description: 'Incidente auto-detectado',
        severity: 'CRITICAL',
        status: 'OPEN',
        metadata: { autoGenerated: true },
      },
    });
    return { incidentId: incident?.id };
  }

  private async containAnomaly(tenantId: string, payload: any): Promise<any> {
    return { contained: true, scope: payload.scope };
  }

  // ── Database Operations ─────────────────────────────────────

  private async loadRules(tenantId: string): Promise<OrchestrationRule[]> {
    // In production, load from DB. For now, return built-in rules
    const rules = await this.db.autonomousRule?.findMany?.({
      where: { tenantId },
    }) || [];

    if (rules.length === 0) {
      // Return seeded built-in rules
      return BUILT_IN_RULES.map(r => ({ ...r, tenantId })) as OrchestrationRule[];
    }

    return rules;
  }

  private async createRule(rule: OrchestrationRule): Promise<void> {
    await this.db.autonomousRule?.create?.({ data: rule });
  }

  private async getRecentEvents(tenantId: string, limit: number): Promise<any[]> {
    return await this.db.systemEvent?.findMany?.({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }) || [];
  }

  /**
   * Publish orchestration event to event stream
   */
  private async publishOrchestrationEvent(tenantId: string, result: OrchestrationResult): Promise<void> {
    await eventEngine.publish({
      tenantId,
      type: 'SYSTEM_ALERT',
      module: 'autonomous_orchestration',
      severity: result.escalated ? 'critical' : 'high',
      title: `Orquestación: ${result.ruleName}`,
      description: result.escalated ? result.escalationMessage || 'Escalamiento activado' : 'Workflow ejecutado',
      metadata: { orchestrationResult: result },
      timestamp: new Date(),
    });
  }

  /**
   * Handle escalation
   */
  private async handleEscalation(tenantId: string, result: OrchestrationResult): Promise<void> {
    const rule = this.rules.get(tenantId)?.find(r => r.id === result.ruleId);
    if (!rule?.escalation) return;

    // Create escalation record
    await this.db.escalation?.create?.({
      data: {
        tenantId,
        ruleId: rule.id,
        ruleName: rule.name,
        message: result.escalationMessage,
        escalateTo: rule.escalation.escalateTo,
        status: 'PENDING',
        metadata: { orchestrationResult: result },
      },
    });

    // Send escalation notifications
    for (const role of rule.escalation.escalateTo) {
      await this.sendNotification(tenantId, {
        payload: {
          message: `ESCALAMIENTO: ${result.escalationMessage}`,
          priority: 'CRITICAL',
          channels: ['email', 'in_app', 'sms'],
        },
      });
    }
  }

  /**
   * Manually trigger a rule evaluation
   */
  async manualEvaluate(ruleId: string, tenantId: string): Promise<OrchestrationResult | null> {
    const rules = this.rules.get(tenantId) || await this.loadRules(tenantId);
    const rule = rules.find(r => r.id === ruleId);
    
    if (!rule) return null;

    const [correlations, anomalies, events] = await Promise.allSettled([
      this.correlationEngine.detectCorrelations(tenantId),
      this.anomalyDetector.detectAnomalies(tenantId),
      this.getRecentEvents(tenantId, 5),
    ]);

    const context = {
      correlations: correlations.status === 'fulfilled' ? correlations.value : [],
      anomalies: anomalies.status === 'fulfilled' ? anomalies.value : [],
      events: events.status === 'fulfilled' ? events.value : [],
    };

    return this.evaluateRule(rule, context, tenantId);
  }

  /**
   * Get orchestration status for a tenant
   */
  getStatus(tenantId: string): { rules: number; running: boolean; lastCycle?: Date } {
    const rules = this.rules.get(tenantId) || [];
    return {
      rules: rules.length,
      running: this.isRunning,
    };
  }
}

// Singleton instance
export let autonomousOrchestrator: AutonomousOrchestrator;

export function initializeAutonomousOrchestrator(prisma: PrismaClient, app?: any): AutonomousOrchestrator {
  if (!autonomousOrchestrator) {
    autonomousOrchestrator = new AutonomousOrchestrator(prisma, app);
  }
  return autonomousOrchestrator;
}
