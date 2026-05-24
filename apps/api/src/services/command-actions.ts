export interface CommandAction {
  id: string;
  label: string;
  description: string;
  icon: string;
  category: 'analysis' | 'generation' | 'simulation' | 'detection' | 'report' | 'planning';
  action: string;
  parameters?: Record<string, any>;
  requiresDeepAnalysis: boolean;
  estimatedTime: number; // segundos
  successMessage: string;
  module?: string;
  permissions: string[];
}

export interface ActionExecution {
  id: string;
  actionId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  progress: number;
  result?: any;
  error?: string;
  userId: string;
  tenantId: string;
}

export class CommandActionsManager {
  private actions: Map<string, CommandAction> = new Map();
  private executions: Map<string, ActionExecution> = new Map();

  constructor() {
    this.initializeActions();
  }

  private initializeActions(): void {
    const commandActions: CommandAction[] = [
      // Análisis
      {
        id: 'analyze-profitability',
        label: 'Analizar Rentabilidad',
        description: 'Análisis completo de rentabilidad por proyecto y área',
        icon: 'trending-up',
        category: 'analysis',
        action: 'analyze_profitability',
        requiresDeepAnalysis: true,
        estimatedTime: 15,
        successMessage: 'Análisis de rentabilidad completado',
        module: 'financial',
        permissions: ['financial_read', 'reports_generate']
      },
      {
        id: 'detect-risks',
        label: 'Detectar Riesgos',
        description: 'Identificación automática de riesgos críticos',
        icon: 'alert-triangle',
        category: 'detection',
        action: 'detect_risks',
        requiresDeepAnalysis: true,
        estimatedTime: 10,
        successMessage: 'Riesgos detectados y priorizados',
        module: 'risk',
        permissions: ['risk_read', 'risk_analyze']
      },
      {
        id: 'analyze-projects',
        label: 'Analizar Proyectos',
        description: 'Análisis integral de estado de proyectos',
        icon: 'briefcase',
        category: 'analysis',
        action: 'analyze_projects',
        requiresDeepAnalysis: false,
        estimatedTime: 8,
        successMessage: 'Análisis de proyectos completado',
        module: 'projects',
        permissions: ['projects_read']
      },
      // Generación
      {
        id: 'generate-executive-report',
        label: 'Generar Informe Ejecutivo',
        description: 'Crear informe ejecutivo completo',
        icon: 'file-text',
        category: 'report',
        action: 'generate_executive_report',
        requiresDeepAnalysis: true,
        estimatedTime: 20,
        successMessage: 'Informe ejecutivo generado exitosamente',
        module: 'reports',
        permissions: ['reports_generate', 'executive_access']
      },
      {
        id: 'generate-capa',
        label: 'Generar CAPA',
        description: 'Crear Plan de Acción Correctiva',
        icon: 'check-square',
        category: 'generation',
        action: 'generate_capa',
        requiresDeepAnalysis: false,
        estimatedTime: 12,
        successMessage: 'CAPA generado correctamente',
        module: 'quality',
        permissions: ['quality_manage', 'capa_create']
      },
      {
        id: 'create-project',
        label: 'Crear Proyecto',
        description: 'Iniciar nuevo proyecto con IA',
        icon: 'plus-circle',
        category: 'generation',
        action: 'create_project',
        requiresDeepAnalysis: false,
        estimatedTime: 15,
        successMessage: 'Proyecto creado exitosamente',
        module: 'projects',
        permissions: ['projects_create']
      },
      // Simulación
      {
        id: 'simulate-business',
        label: 'Simular Negocio',
        description: 'Simulación estratégica del negocio',
        icon: 'cpu',
        category: 'simulation',
        action: 'simulate_business',
        requiresDeepAnalysis: true,
        estimatedTime: 25,
        successMessage: 'Simulación de negocio completada',
        module: 'strategic',
        permissions: ['strategic_analyze', 'simulation_run']
      },
      {
        id: 'forecast-financial',
        label: 'Forecast Financiero',
        description: 'Proyecciones financieras avanzadas',
        icon: 'dollar-sign',
        category: 'simulation',
        action: 'forecast_financial',
        requiresDeepAnalysis: true,
        estimatedTime: 18,
        successMessage: 'Forecast financiero generado',
        module: 'financial',
        permissions: ['financial_analyze', 'forecast_generate']
      },
      {
        id: 'analyze-expansion',
        label: 'Analizar Expansión',
        description: 'Análisis de oportunidades de expansión',
        icon: 'target',
        category: 'analysis',
        action: 'analyze_expansion',
        requiresDeepAnalysis: true,
        estimatedTime: 22,
        successMessage: 'Análisis de expansión completado',
        module: 'strategic',
        permissions: ['strategic_analyze', 'expansion_plan']
      },
      // Detección
      {
        id: 'detect-anomalies',
        label: 'Detectar Anomalías',
        description: 'Identificar patrones anómalos en datos',
        icon: 'activity',
        category: 'detection',
        action: 'detect_anomalies',
        requiresDeepAnalysis: false,
        estimatedTime: 10,
        successMessage: 'Anomalías detectadas y analizadas',
        module: 'analytics',
        permissions: ['analytics_read']
      },
      {
        id: 'analyze-compliance',
        label: 'Analizar Cumplimiento',
        description: 'Evaluación de cumplimiento normativo',
        icon: 'shield',
        category: 'analysis',
        action: 'analyze_compliance',
        requiresDeepAnalysis: true,
        estimatedTime: 15,
        successMessage: 'Análisis de cumplimiento completado',
        module: 'compliance',
        permissions: ['compliance_read', 'compliance_analyze']
      },
      // Reportes
      {
        id: 'generate-minutes',
        label: 'Generar Minuta',
        description: 'Crear minuta de reunión automática',
        icon: 'edit',
        category: 'report',
        action: 'generate_minutes',
        requiresDeepAnalysis: false,
        estimatedTime: 8,
        successMessage: 'Minuta generada exitosamente',
        module: 'meetings',
        permissions: ['meetings_create', 'reports_generate']
      },
      {
        id: 'analyze-bidding',
        label: 'Analizar Licitación',
        description: 'Análisis inteligente de licitaciones',
        icon: 'file-search',
        category: 'analysis',
        action: 'analyze_bidding',
        requiresDeepAnalysis: true,
        estimatedTime: 20,
        successMessage: 'Análisis de licitación completado',
        module: 'bidding',
        permissions: ['bidding_analyze', 'procurement_read']
      }
    ];

    commandActions.forEach(action => {
      this.actions.set(action.id, action);
    });
  }

  getAction(actionId: string): CommandAction | null {
    return this.actions.get(actionId) || null;
  }

  getAllActions(): CommandAction[] {
    return Array.from(this.actions.values());
  }

  getActionsByCategory(category: string): CommandAction[] {
    return Array.from(this.actions.values()).filter(action => action.category === category);
  }

  getActionsForUser(userPermissions: string[], userRole: string): CommandAction[] {
    return Array.from(this.actions.values()).filter(action => {
      // Verificar permisos
      const hasPermission = action.permissions.some(perm => 
        userPermissions.includes(perm) || userRole === 'TENANT_ADMIN'
      );

      // Filtrar por rol si es necesario
      if (userRole === 'OPERATIVE' && action.requiresDeepAnalysis) {
        return false;
      }

      return hasPermission;
    });
  }

  async executeAction(
    actionId: string, 
    userId: string, 
    tenantId: string, 
    parameters?: Record<string, any>
  ): Promise<string> {
    const action = this.getAction(actionId);
    if (!action) {
      throw new Error(`Action ${actionId} not found`);
    }

    const executionId = this.generateExecutionId();
    const execution: ActionExecution = {
      id: executionId,
      actionId,
      status: 'pending',
      startTime: new Date(),
      progress: 0,
      userId,
      tenantId
    };

    this.executions.set(executionId, execution);

    // Ejecutar acción asíncronamente
    this.runAction(executionId, action, parameters).catch(error => {
      console.error(`Error executing action ${actionId}:`, error);
    });

    return executionId;
  }

  private async runAction(
    executionId: string, 
    action: CommandAction, 
    parameters?: Record<string, any>
  ): Promise<void> {
    const execution = this.executions.get(executionId);
    if (!execution) return;

    try {
      execution.status = 'running';
      
      // Simular progreso
      await this.simulateProgress(executionId, action.estimatedTime);

      // Ejecutar lógica específica de la acción
      const result = await this.executeActionLogic(action, parameters, execution);

      execution.status = 'completed';
      execution.endTime = new Date();
      execution.progress = 100;
      execution.result = result;

    } catch (error) {
      execution.status = 'failed';
      execution.endTime = new Date();
      execution.error = error instanceof Error ? error.message : 'Unknown error';
    }
  }

  private async simulateProgress(executionId: string, totalSeconds: number): Promise<void> {
    const execution = this.executions.get(executionId);
    if (!execution) return;

    const steps = 10;
    const stepDuration = (totalSeconds * 1000) / steps;

    for (let i = 1; i <= steps; i++) {
      await new Promise(resolve => setTimeout(resolve, stepDuration));
      
      const currentExecution = this.executions.get(executionId);
      if (currentExecution) {
        currentExecution.progress = (i / steps) * 100;
      }
    }
  }

  private async executeActionLogic(
    action: CommandAction, 
    parameters?: Record<string, any>,
    execution?: ActionExecution
  ): Promise<any> {
    // Aquí iría la lógica real de cada acción
    // Por ahora, simulamos resultados

    switch (action.action) {
      case 'analyze_profitability':
        return {
          type: 'profitability_analysis',
          summary: 'Rentabilidad general: 23.5%',
          details: {
            byProject: {
              'Project A': { revenue: 150000, cost: 120000, margin: 20 },
              'Project B': { revenue: 200000, cost: 140000, margin: 30 }
            },
            trends: 'Tendencia positiva en últimos 3 meses',
            recommendations: ['Optimizar costos en Project A', 'Expandir Project B']
          }
        };

      case 'detect_risks':
        return {
          type: 'risk_detection',
          summary: '5 riesgos críticos detectados',
          risks: [
            { id: 'R001', level: 'critical', description: 'Desvío presupuestario Project C', probability: 0.8 },
            { id: 'R002', level: 'high', description: 'Retraso en entrega proveedor X', probability: 0.7 },
            { id: 'R003', level: 'medium', description: 'Capacidad operativa límite', probability: 0.6 }
          ]
        };

      case 'generate_executive_report':
        return {
          type: 'executive_report',
          reportId: 'EXEC_' + Date.now(),
          format: 'PDF',
          sections: ['Resumen Ejecutivo', 'KPIs', 'Análisis Financiero', 'Recomendaciones'],
          downloadUrl: `/api/reports/download/EXEC_${Date.now()}.pdf`
        };

      case 'simulate_business':
        return {
          type: 'business_simulation',
          scenarios: [
            { name: 'Crecimiento 10%', revenue: 2200000, profit: 440000 },
            { name: 'Crecimiento 20%', revenue: 2400000, profit: 520000 },
            { name: 'Estancamiento', revenue: 2000000, profit: 400000 }
          ],
          recommendations: 'Estrategia de crecimiento 15% recomendada'
        };

      default:
        return {
          type: action.action,
          status: 'completed',
          message: action.successMessage,
          timestamp: new Date()
        };
    }
  }

  getExecution(executionId: string): ActionExecution | null {
    return this.executions.get(executionId) || null;
  }

  getUserExecutions(userId: string): ActionExecution[] {
    return Array.from(this.executions.values())
      .filter(execution => execution.userId === userId)
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
  }

  async cancelExecution(executionId: string, userId: string): Promise<boolean> {
    const execution = this.executions.get(executionId);
    if (!execution || execution.userId !== userId) {
      return false;
    }

    if (execution.status === 'running') {
      execution.status = 'failed';
      execution.endTime = new Date();
      execution.error = 'Cancelled by user';
      return true;
    }

    return false;
  }

  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Limpiar ejecuciones antiguas
  cleanupOldExecutions(maxAge: number = 3600000): void { // 1 hora por defecto
    const now = Date.now();
    
    for (const [executionId, execution] of this.executions.entries()) {
      const executionAge = now - execution.startTime.getTime();
      if (executionAge > maxAge) {
        this.executions.delete(executionId);
      }
    }
  }

  // Estadísticas de uso
  getUsageStats(userId?: string): {
    totalExecutions: number;
    completedExecutions: number;
    failedExecutions: number;
    averageExecutionTime: number;
    mostUsedActions: Array<{ actionId: string; count: number }>;
  } {
    let executions = Array.from(this.executions.values());
    
    if (userId) {
      executions = executions.filter(e => e.userId === userId);
    }

    const completed = executions.filter(e => e.status === 'completed');
    const failed = executions.filter(e => e.status === 'failed');

    // Calcular tiempo promedio de ejecución
    const executionTimes = completed
      .filter(e => e.endTime)
      .map(e => e.endTime!.getTime() - e.startTime.getTime());
    
    const averageTime = executionTimes.length > 0 
      ? executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length 
      : 0;

    // Acciones más usadas
    const actionCounts = executions.reduce((acc, execution) => {
      acc[execution.actionId] = (acc[execution.actionId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const mostUsedActions = Object.entries(actionCounts)
      .map(([actionId, count]) => ({ actionId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalExecutions: executions.length,
      completedExecutions: completed.length,
      failedExecutions: failed.length,
      averageExecutionTime: averageTime,
      mostUsedActions
    };
  }
}
