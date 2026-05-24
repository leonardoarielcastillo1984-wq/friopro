export interface OperationalMode {
  id: 'operational' | 'executive' | 'strategic';
  name: string;
  description: string;
  focus: string[];
  kpiCategories: string[];
  visualStyle: {
    primaryColor: string;
    secondaryColor: string;
    chartTypes: string[];
    layoutDensity: 'compact' | 'balanced' | 'spacious';
  };
  aiSettings: {
    temperature: number;
    maxTokens: number;
    responseStyle: 'concise' | 'detailed' | 'comprehensive';
    useDeepAnalysis: boolean;
  };
  permissions: {
    canEdit: boolean;
    canDelete: boolean;
    canExport: boolean;
    canShare: boolean;
  };
  features: string[];
}

export class OperationalModesManager {
  private modes: Record<string, OperationalMode> = {
    operational: {
      id: 'operational',
      name: 'Modo Operativo',
      description: 'Gestión diaria y operaciones en tiempo real',
      focus: ['tareas', 'alertas', 'estado diario', 'incidentes', 'eficiencia'],
      kpiCategories: ['productividad', 'incidentes', 'uptime', 'rendimiento'],
      visualStyle: {
        primaryColor: '#3b82f6',
        secondaryColor: '#60a5fa',
        chartTypes: ['line', 'bar', 'gauge', 'status'],
        layoutDensity: 'compact'
      },
      aiSettings: {
        temperature: 0.2,
        maxTokens: 800,
        responseStyle: 'concise',
        useDeepAnalysis: false
      },
      permissions: {
        canEdit: true,
        canDelete: true,
        canExport: true,
        canShare: true
      },
      features: [
        'alertas_tiempo_real',
        'dashboard_operativo',
        'gestion_tareas',
        'monitoreo_sistemas',
        'reportes_diarios'
      ]
    },
    executive: {
      id: 'executive',
      name: 'Modo Ejecutivo',
      description: 'Visión estratégica y KPIs de negocio',
      focus: ['KPIs', 'rentabilidad', 'estado general', 'cumplimiento', 'métricas clave'],
      kpiCategories: ['financieros', 'operativos', 'estratégicos', 'cumplimiento'],
      visualStyle: {
        primaryColor: '#8b5cf6',
        secondaryColor: '#a78bfa',
        chartTypes: ['line', 'bar', 'pie', 'radar', 'heatmap'],
        layoutDensity: 'balanced'
      },
      aiSettings: {
        temperature: 0.4,
        maxTokens: 1200,
        responseStyle: 'detailed',
        useDeepAnalysis: true
      },
      permissions: {
        canEdit: false,
        canDelete: false,
        canExport: true,
        canShare: true
      },
      features: [
        'dashboard_ejecutivo',
        'kpis_avanzados',
        'analisis_tendencias',
        'comparativos_periodo',
        'alertas_estrategicas'
      ]
    },
    strategic: {
      id: 'strategic',
      name: 'Modo Estratégico',
      description: 'Análisis de largo plazo y toma de decisiones estratégicas',
      focus: ['simulaciones', 'expansión', 'inversiones', 'escenarios futuros', 'forecast'],
      kpiCategories: ['crecimiento', 'innovación', 'sostenibilidad', 'cuota mercado'],
      visualStyle: {
        primaryColor: '#f59e0b',
        secondaryColor: '#fbbf24',
        chartTypes: ['forecast', 'scenario', 'simulation', 'trend', 'projection'],
        layoutDensity: 'spacious'
      },
      aiSettings: {
        temperature: 0.6,
        maxTokens: 2000,
        responseStyle: 'comprehensive',
        useDeepAnalysis: true
      },
      permissions: {
        canEdit: false,
        canDelete: false,
        canExport: true,
        canShare: true
      },
      features: [
        'simulaciones_estrategicas',
        'modelado_escenarios',
        'analisis_inversion',
        'forecast_avanzado',
        'planeacion_estrategica'
      ]
    }
  };

  getMode(modeId: string): OperationalMode | null {
    return this.modes[modeId] || null;
  }

  getAllModes(): OperationalMode[] {
    return Object.values(this.modes);
  }

  async getModeForUser(userRole: string, context: any): Promise<OperationalMode> {
    // Lógica para determinar el modo apropiado según rol y contexto
    if (userRole === 'TENANT_ADMIN' || userRole === 'EXECUTIVE') {
      return this.modes.executive;
    } else if (userRole === 'STRATEGIC_PLANNER' || userRole === 'C_LEVEL') {
      return this.modes.strategic;
    } else {
      return this.modes.operational;
    }
  }

  async adaptQueryForMode(query: string, mode: OperationalMode): Promise<string> {
    const adaptations = {
      operational: {
        prefix: 'Dame una respuesta operativa concisa enfocada en acciones inmediatas: ',
        suffix: '. Prioritiza tareas y alertas actuales.',
        focusKeywords: ['hoy', 'ahora', 'inmediato', 'urgente', 'tareas', 'operaciones']
      },
      executive: {
        prefix: 'Proporciona un análisis ejecutivo con KPIs y métricas clave: ',
        suffix: '. Enfócate en impacto empresarial y tendencias.',
        focusKeywords: ['KPI', 'métricas', 'rendimiento', 'negocio', 'estratégico']
      },
      strategic: {
        prefix: 'Genera un análisis estratégico comprehensivo con proyecciones: ',
        suffix: '. Considera escenarios futuros e implicaciones de largo plazo.',
        focusKeywords: ['futuro', 'estrategia', 'crecimiento', 'inversión', 'expansión']
      }
    };

    const adaptation = adaptations[mode.id];
    let adaptedQuery = adaptation.prefix + query + adaptation.suffix;

    // Agregar palabras clave de enfoque si no están presentes
    const hasKeyword = adaptation.focusKeywords.some(keyword => 
      query.toLowerCase().includes(keyword.toLowerCase())
    );

    if (!hasKeyword) {
      adaptedQuery += ` Enfócate en ${adaptation.focusKeywords[0]}.`;
    }

    return adaptedQuery;
  }

  async getModeSpecificWidgets(mode: OperationalMode): Promise<Array<{
    id: string;
    type: string;
    title: string;
    dataSource: string;
    priority: number;
  }>> {
    const widgets = {
      operational: [
        {
          id: 'real-time-alerts',
          type: 'alert',
          title: 'Alertas en Tiempo Real',
          dataSource: 'alerts/active',
          priority: 1
        },
        {
          id: 'task-progress',
          type: 'progress',
          title: 'Progreso de Tareas',
          dataSource: 'tasks/progress',
          priority: 2
        },
        {
          id: 'system-status',
          type: 'status',
          title: 'Estado del Sistema',
          dataSource: 'system/status',
          priority: 3
        },
        {
          id: 'incidents-today',
          type: 'table',
          title: 'Incidentes del Día',
          dataSource: 'incidents/today',
          priority: 4
        }
      ],
      executive: [
        {
          id: 'kpi-dashboard',
          type: 'kpi',
          title: 'KPIs Principales',
          dataSource: 'kpis/main',
          priority: 1
        },
        {
          id: 'financial-overview',
          type: 'chart',
          title: 'Resumen Financiero',
          dataSource: 'financial/summary',
          priority: 2
        },
        {
          id: 'performance-trends',
          type: 'trend',
          title: 'Tendencias de Rendimiento',
          dataSource: 'performance/trends',
          priority: 3
        },
        {
          id: 'compliance-status',
          type: 'gauge',
          title: 'Estado de Cumplimiento',
          dataSource: 'compliance/status',
          priority: 4
        }
      ],
      strategic: [
        {
          id: 'growth-projection',
          type: 'forecast',
          title: 'Proyección de Crecimiento',
          dataSource: 'strategic/growth',
          priority: 1
        },
        {
          id: 'scenario-analysis',
          type: 'scenario',
          title: 'Análisis de Escenarios',
          dataSource: 'strategic/scenarios',
          priority: 2
        },
        {
          id: 'investment-opportunities',
          type: 'opportunity',
          title: 'Oportunidades de Inversión',
          dataSource: 'strategic/investments',
          priority: 3
        },
        {
          id: 'market-analysis',
          type: 'market',
          title: 'Análisis de Mercado',
          dataSource: 'strategic/market',
          priority: 4
        }
      ]
    };

    return widgets[mode.id] || widgets.operational;
  }

  async getModeSpecificActions(mode: OperationalMode): Promise<Array<{
    id: string;
    label: string;
    description: string;
    icon: string;
    action: string;
    priority: number;
  }>> {
    const actions = {
      operational: [
        {
          id: 'create-task',
          label: 'Crear Tarea',
          description: 'Nueva tarea operativa',
          icon: 'plus',
          action: 'create_task',
          priority: 1
        },
        {
          id: 'manage-alerts',
          label: 'Gestionar Alertas',
          description: 'Ver y gestionar alertas activas',
          icon: 'alert',
          action: 'manage_alerts',
          priority: 2
        },
        {
          id: 'daily-report',
          label: 'Reporte Diario',
          description: 'Generar reporte del día',
          icon: 'document',
          action: 'generate_daily_report',
          priority: 3
        }
      ],
      executive: [
        {
          id: 'executive-report',
          label: 'Informe Ejecutivo',
          description: 'Generar informe para dirección',
          icon: 'briefcase',
          action: 'generate_executive_report',
          priority: 1
        },
        {
          id: 'kpi-analysis',
          label: 'Análisis KPI',
          description: 'Análisis detallado de indicadores',
          icon: 'trending-up',
          action: 'analyze_kpis',
          priority: 2
        },
        {
          id: 'performance-review',
          label: 'Revisión Rendimiento',
          description: 'Revisión de rendimiento empresarial',
          icon: 'activity',
          action: 'performance_review',
          priority: 3
        }
      ],
      strategic: [
        {
          id: 'strategic-simulation',
          label: 'Simulación Estratégica',
          description: 'Ejecutar simulación estratégica',
          icon: 'target',
          action: 'run_strategic_simulation',
          priority: 1
        },
        {
          id: 'scenario-planning',
          label: 'Planeación Escenarios',
          description: 'Planificar escenarios futuros',
          icon: 'layers',
          action: 'scenario_planning',
          priority: 2
        },
        {
          id: 'investment-analysis',
          label: 'Análisis de Inversión',
          description: 'Evaluar oportunidades de inversión',
          icon: 'dollar-sign',
          action: 'analyze_investment',
          priority: 3
        }
      ]
    };

    return actions[mode.id] || actions.operational;
  }

  async shouldUseDeepAnalysis(query: string, mode: OperationalMode): Promise<boolean> {
    // Si el modo ya requiere deep analysis
    if (mode.aiSettings.useDeepAnalysis) {
      return true;
    }

    // Palabras clave que activan deep analysis
    const deepAnalysisKeywords = [
      'análisis profundo', 'estratégico', 'completo', 'detallado',
      'simulación', 'proyección', 'forecast', 'escenario',
      'evaluación', 'impacto', 'tendencias', 'futuro'
    ];

    return deepAnalysisKeywords.some(keyword => 
      query.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  async getModeTransition(from: OperationalMode, to: OperationalMode): Promise<{
    message: string;
    changes: string[];
    animation: string;
  }> {
    const transitions = {
      'operational->executive': {
        message: 'Cambiando a vista ejecutiva...',
        changes: ['Expandiendo KPIs', 'Cargando métricas estratégicas', 'Optimizando dashboard'],
        animation: 'expand-up'
      },
      'operational->strategic': {
        message: 'Activando modo estratégico...',
        changes: ['Cargando proyecciones', 'Iniciando análisis de escenarios', 'Preparando simulaciones'],
        animation: 'zoom-out'
      },
      'executive->operational': {
        message: 'Cambiando a modo operativo...',
        changes: ['Simplificando vista', 'Cargando alertas', 'Optimizando para acciones'],
        animation: 'compress-down'
      },
      'executive->strategic': {
        message: 'Elevando a análisis estratégico...',
        changes: ['Expandiendo horizonte temporal', 'Cargando modelos predictivos', 'Activando deep analysis'],
        animation: 'expand-right'
      },
      'strategic->operational': {
        message: 'Cambiando a operaciones diarias...',
        changes: ['Enfocando en presente', 'Cargando tareas inmediatas', 'Simplificando análisis'],
        animation: 'zoom-in'
      },
      'strategic->executive': {
        message: 'Cambiando a vista ejecutiva...',
        changes: ['Reduciendo horizonte temporal', 'Optimizando KPIs', 'Balanceando análisis'],
        animation: 'compress-left'
      }
    };

    const key = `${from.id}->${to.id}`;
    return transitions[key] || {
      message: 'Cambiando modo...',
      changes: ['Actualizando interfaz', 'Cargando componentes', 'Aplicando configuración'],
      animation: 'fade'
    };
  }
}
