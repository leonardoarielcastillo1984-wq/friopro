export interface FloatingAlert {
  id: string;
  type: 'warning' | 'critical' | 'info' | 'success';
  title: string;
  description: string;
  action?: {
    label: string;
    action: string;
    module?: string;
    parameters?: Record<string, any>;
  };
  module?: string;
  priority: number; // 1-10, 10 being highest
  autoDismiss?: number; // milliseconds, undefined = manual dismiss only
  timestamp: Date;
  userId?: string;
  tenantId: string;
  metadata?: Record<string, any>;
  dismissed: boolean;
  dismissedAt?: Date;
  dismissedBy?: string;
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  condition: string; // JSON expression or query
  alertType: 'warning' | 'critical' | 'info';
  priority: number;
  module?: string;
  enabled: boolean;
  autoDismiss?: number;
  actionTemplate?: {
    label: string;
    action: string;
    module?: string;
  };
  cooldown: number; // milliseconds between same alert
  lastTriggered?: Date;
}

export class AIFloatingAlertsManager {
  private alerts: Map<string, FloatingAlert> = new Map();
  private rules: Map<string, AlertRule> = new Map();
  private activeSubscriptions: Map<string, EventSource> = new Map();

  constructor() {
    this.initializeDefaultRules();
  }

  private initializeDefaultRules(): void {
    const defaultRules: AlertRule[] = [
      // Alertas financieras
      {
        id: 'budget-deviation',
        name: 'Desvío Presupuestario',
        description: 'Detecta desvíos significativos en presupuestos de proyectos',
        condition: 'project.budget_variance > 0.15',
        alertType: 'warning',
        priority: 7,
        module: 'projects',
        enabled: true,
        autoDismiss: 30000,
        actionTemplate: {
          label: 'Ver detalles',
          action: 'view_project_budget',
          module: 'projects'
        },
        cooldown: 300000 // 5 minutos
      },
      {
        id: 'cash-flow-low',
        name: 'Flujo de Caja Bajo',
        description: 'Alerta cuando el flujo de caja es crítico',
        condition: 'financial.cash_flow_ratio < 0.1',
        alertType: 'critical',
        priority: 9,
        module: 'financial',
        enabled: true,
        autoDismiss: undefined, // manual dismiss
        actionTemplate: {
          label: 'Análisis financiero',
          action: 'analyze_cash_flow',
          module: 'financial'
        },
        cooldown: 600000 // 10 minutos
      },
      // Alertas operativas
      {
        id: 'system-downtime',
        name: 'Caída del Sistema',
        description: 'Detecta caídas o problemas críticos del sistema',
        condition: 'system.uptime < 0.95',
        alertType: 'critical',
        priority: 10,
        module: 'system',
        enabled: true,
        autoDismiss: undefined,
        actionTemplate: {
          label: 'Ver estado',
          action: 'view_system_status',
          module: 'system'
        },
        cooldown: 180000 // 3 minutos
      },
      {
        id: 'high-error-rate',
        name: 'Tasa de Errores Elevada',
        description: 'Detecta aumento inusual en errores del sistema',
        condition: 'system.error_rate > 0.05',
        alertType: 'warning',
        priority: 6,
        module: 'system',
        enabled: true,
        autoDismiss: 20000,
        actionTemplate: {
          label: 'Ver logs',
          action: 'view_error_logs',
          module: 'system'
        },
        cooldown: 240000 // 4 minutos
      },
      // Alertas de proyectos
      {
        id: 'project-delay',
        name: 'Retraso de Proyecto',
        description: 'Detecta retrasos significativos en proyectos',
        condition: 'project.schedule_variance > 0.1',
        alertType: 'warning',
        priority: 5,
        module: 'projects',
        enabled: true,
        autoDismiss: 25000,
        actionTemplate: {
          label: 'Ver cronograma',
          action: 'view_project_schedule',
          module: 'projects'
        },
        cooldown: 300000 // 5 minutos
      },
      // Alertas de RRHH
      {
        id: 'high-turnover-risk',
        name: 'Riesgo de Rotación',
        description: 'Detecta riesgo elevado de rotación de personal',
        condition: 'hr.turnover_risk_score > 0.7',
        alertType: 'warning',
        priority: 6,
        module: 'hr',
        enabled: true,
        autoDismiss: 30000,
        actionTemplate: {
          label: 'Análisis RRHH',
          action: 'analyze_turnover_risk',
          module: 'hr'
        },
        cooldown: 600000 // 10 minutos
      },
      // Alertas de compliant
      {
        id: 'compliance-overdue',
        name: 'Cumplimiento Vencido',
        description: 'Detecta requisitos de cumplimiento vencidos',
        condition: 'compliance.overdue_items > 0',
        alertType: 'critical',
        priority: 8,
        module: 'compliance',
        enabled: true,
        autoDismiss: undefined,
        actionTemplate: {
          label: 'Ver cumplimiento',
          action: 'view_compliance_status',
          module: 'compliance'
        },
        cooldown: 300000 // 5 minutos
      },
      // Alertas estratégicas
      {
        id: 'market-opportunity',
        name: 'Oportunidad de Mercado',
        description: 'Detecta oportunidades estratégicas de mercado',
        condition: 'market.opportunity_score > 0.8',
        alertType: 'info',
        priority: 4,
        module: 'strategic',
        enabled: true,
        autoDismiss: 45000,
        actionTemplate: {
          label: 'Analizar oportunidad',
          action: 'analyze_market_opportunity',
          module: 'strategic'
        },
        cooldown: 900000 // 15 minutos
      }
    ];

    defaultRules.forEach(rule => {
      this.rules.set(rule.id, rule);
    });
  }

  async checkRules(tenantId: string, systemData: any): Promise<FloatingAlert[]> {
    const triggeredAlerts: FloatingAlert[] = [];

    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      // Verificar cooldown
      if (rule.lastTriggered) {
        const timeSinceLastTrigger = Date.now() - rule.lastTriggered.getTime();
        if (timeSinceLastTrigger < rule.cooldown) continue;
      }

      // Evaluar condición
      const shouldTrigger = await this.evaluateCondition(rule.condition, systemData);
      
      if (shouldTrigger) {
        const alert = await this.createAlertFromRule(rule, tenantId, systemData);
        triggeredAlerts.push(alert);
        
        // Actualizar último trigger
        rule.lastTriggered = new Date();
      }
    }

    return triggeredAlerts;
  }

  private async evaluateCondition(condition: string, data: any): Promise<boolean> {
    try {
      // Para condiciones simples, usar evaluación directa
      if (condition.includes('>') || condition.includes('<') || condition.includes('==')) {
        return this.evaluateSimpleCondition(condition, data);
      }

      // Para condiciones complejas, usar IA
      return await this.evaluateComplexCondition(condition, data);
    } catch (error) {
      console.error('Error evaluating alert condition:', error);
      return false;
    }
  }

  private evaluateSimpleCondition(condition: string, data: any): boolean {
    // Implementación simple de evaluación de condiciones
    // En producción, usar una librería segura como jsonata o similar
    
    try {
      // Reemplazar variables en la condición
      let evalCondition = condition;
      
      // Ejemplo: project.budget_variance > 0.15
      if (condition.includes('project.budget_variance')) {
        const variance = this.getNestedValue(data, 'project.budget_variance', 0);
        evalCondition = evalCondition.replace('project.budget_variance', variance.toString());
      }
      
      if (condition.includes('financial.cash_flow_ratio')) {
        const ratio = this.getNestedValue(data, 'financial.cash_flow_ratio', 1);
        evalCondition = evalCondition.replace('financial.cash_flow_ratio', ratio.toString());
      }
      
      if (condition.includes('system.uptime')) {
        const uptime = this.getNestedValue(data, 'system.uptime', 1);
        evalCondition = evalCondition.replace('system.uptime', uptime.toString());
      }
      
      if (condition.includes('system.error_rate')) {
        const errorRate = this.getNestedValue(data, 'system.error_rate', 0);
        evalCondition = evalCondition.replace('system.error_rate', errorRate.toString());
      }
      
      // Evaluar la condición (usar Function constructor con cuidado)
      // NOTA: En producción, usar un evaluador más seguro
      return new Function('return ' + evalCondition)();
    } catch (error) {
      console.error('Error in simple condition evaluation:', error);
      return false;
    }
  }

  private async evaluateComplexCondition(condition: string, data: any): Promise<boolean> {
    // Para condiciones complejas, usar IA para evaluar
    // Por ahora, retornar false para condiciones complejas
    return false;
  }

  private getNestedValue(obj: any, path: string, defaultValue: any = null): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : defaultValue;
    }, obj);
  }

  private async createAlertFromRule(
    rule: AlertRule, 
    tenantId: string, 
    systemData: any
  ): Promise<FloatingAlert> {
    const alertId = this.generateAlertId();
    
    // Generar título y descripción contextualizados
    const contextualInfo = await this.generateContextualInfo(rule, systemData);
    
    const alert: FloatingAlert = {
      id: alertId,
      type: rule.alertType,
      title: `${rule.name}: ${contextualInfo.title}`,
      description: contextualInfo.description,
      action: rule.actionTemplate ? {
        ...rule.actionTemplate,
        parameters: contextualInfo.actionParameters
      } : undefined,
      module: rule.module,
      priority: rule.priority,
      autoDismiss: rule.autoDismiss,
      timestamp: new Date(),
      tenantId,
      metadata: {
        ruleId: rule.id,
        triggeredBy: 'system',
        contextualData: contextualInfo.data
      },
      dismissed: false
    };

    this.alerts.set(alertId, alert);
    
    // Programar auto-dismiss si corresponde
    if (alert.autoDismiss) {
      setTimeout(() => {
        this.dismissAlert(alertId, 'system');
      }, alert.autoDismiss);
    }

    return alert;
  }

  private async generateContextualInfo(rule: AlertRule, systemData: any): Promise<{
    title: string;
    description: string;
    actionParameters?: Record<string, any>;
    data: any;
  }> {
    // Generar información contextual basada en la regla y datos del sistema
    switch (rule.id) {
      case 'budget-deviation':
        const project = this.getNestedValue(systemData, 'project', {});
        return {
          title: project.name || 'Proyecto sin nombre',
          description: `Desvío del ${Math.round((project.budget_variance || 0) * 100)}% detectado en el presupuesto`,
          actionParameters: { projectId: project.id },
          data: { project }
        };
      
      case 'cash-flow-low':
        const financial = this.getNestedValue(systemData, 'financial', {});
        return {
          title: 'Ratio crítico',
          description: `Flujo de caja actual: ${Math.round((financial.cash_flow_ratio || 0) * 100)}% del mínimo requerido`,
          data: { financial }
        };
      
      case 'system-downtime':
        const system = this.getNestedValue(systemData, 'system', {});
        return {
          title: 'Servicios afectados',
          description: `Uptime del sistema: ${Math.round((system.uptime || 0) * 100)}%`,
          actionParameters: { component: system.affected_component },
          data: { system }
        };
      
      default:
        return {
          title: 'Detectado',
          description: rule.description,
          data: systemData
        };
    }
  }

  async createManualAlert(
    type: 'warning' | 'critical' | 'info' | 'success',
    title: string,
    description: string,
    tenantId: string,
    userId?: string,
    options?: {
      action?: FloatingAlert['action'];
      module?: string;
      priority?: number;
      autoDismiss?: number;
      metadata?: Record<string, any>;
    }
  ): Promise<string> {
    const alertId = this.generateAlertId();
    
    const alert: FloatingAlert = {
      id: alertId,
      type,
      title,
      description,
      action: options?.action,
      module: options?.module,
      priority: options?.priority || 5,
      autoDismiss: options?.autoDismiss,
      timestamp: new Date(),
      userId,
      tenantId,
      metadata: {
        ...options?.metadata,
        triggeredBy: 'manual'
      },
      dismissed: false
    };

    this.alerts.set(alertId, alert);
    
    // Programar auto-dismiss si corresponde
    if (alert.autoDismiss) {
      setTimeout(() => {
        this.dismissAlert(alertId, 'system');
      }, alert.autoDismiss);
    }

    return alertId;
  }

  dismissAlert(alertId: string, dismissedBy: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert || alert.dismissed) return false;

    alert.dismissed = true;
    alert.dismissedAt = new Date();
    alert.dismissedBy = dismissedBy;

    return true;
  }

  getAlert(alertId: string): FloatingAlert | null {
    return this.alerts.get(alertId) || null;
  }

  getActiveAlerts(tenantId: string, userId?: string): FloatingAlert[] {
    return Array.from(this.alerts.values())
      .filter(alert => 
        !alert.dismissed && 
        alert.tenantId === tenantId && 
        (!userId || !alert.userId || alert.userId === userId)
      )
      .sort((a, b) => {
        // Ordenar por prioridad primero, luego por timestamp
        if (b.priority !== a.priority) {
          return b.priority - a.priority;
        }
        return b.timestamp.getTime() - a.timestamp.getTime();
      });
  }

  getAlertsByModule(tenantId: string, module: string): FloatingAlert[] {
    return Array.from(this.alerts.values())
      .filter(alert => 
        !alert.dismissed && 
        alert.tenantId === tenantId && 
        alert.module === module
      )
      .sort((a, b) => b.priority - a.priority);
  }

  getDismissedAlerts(tenantId: string, limit: number = 50): FloatingAlert[] {
    return Array.from(this.alerts.values())
      .filter(alert => alert.dismissed && alert.tenantId === tenantId)
      .sort((a, b) => (b.dismissedAt?.getTime() || 0) - (a.dismissedAt?.getTime() || 0))
      .slice(0, limit);
  }

  // Gestión de reglas
  createRule(rule: Omit<AlertRule, 'id' | 'lastTriggered'>): string {
    const ruleId = this.generateRuleId();
    const newRule: AlertRule = {
      ...rule,
      id: ruleId,
      lastTriggered: undefined
    };
    
    this.rules.set(ruleId, newRule);
    return ruleId;
  }

  updateRule(ruleId: string, updates: Partial<AlertRule>): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) return false;

    Object.assign(rule, updates);
    return true;
  }

  deleteRule(ruleId: string): boolean {
    return this.rules.delete(ruleId);
  }

  getRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  // Estadísticas
  getAlertStats(tenantId: string, timeRange?: { start: Date; end: Date }): {
    total: number;
    byType: Record<string, number>;
    byModule: Record<string, number>;
    dismissed: number;
    averageDismissTime: number;
  } {
    let alerts = Array.from(this.alerts.values()).filter(alert => alert.tenantId === tenantId);
    
    if (timeRange) {
      alerts = alerts.filter(alert => 
        alert.timestamp >= timeRange.start && alert.timestamp <= timeRange.end
      );
    }

    const byType = alerts.reduce((acc, alert) => {
      acc[alert.type] = (acc[alert.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byModule = alerts.reduce((acc, alert) => {
      if (alert.module) {
        acc[alert.module] = (acc[alert.module] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const dismissed = alerts.filter(alert => alert.dismissed);
    const dismissTimes = dismissed
      .filter(alert => alert.dismissedAt)
      .map(alert => alert.dismissedAt!.getTime() - alert.timestamp.getTime());
    
    const averageDismissTime = dismissTimes.length > 0
      ? dismissTimes.reduce((a, b) => a + b, 0) / dismissTimes.length
      : 0;

    return {
      total: alerts.length,
      byType,
      byModule,
      dismissed: dismissed.length,
      averageDismissTime
    };
  }

  // Limpiar alertas antiguas
  cleanupOldAlerts(maxAge: number = 86400000): void { // 24 horas por defecto
    const cutoffTime = Date.now() - maxAge;
    
    for (const [alertId, alert] of this.alerts.entries()) {
      if (alert.timestamp.getTime() < cutoffTime && alert.dismissed) {
        this.alerts.delete(alertId);
      }
    }
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateRuleId(): string {
    return `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
