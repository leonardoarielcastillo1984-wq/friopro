import { LLMProvider } from './llm/factory';

export interface Intent {
  type: 'financial' | 'operational' | 'strategic' | 'risk' | 'hr' | 'projects' | 'compliance' | 'general';
  confidence: number;
  entities: string[];
  context: Record<string, any>;
  suggestedVisualizations: string[];
  suggestedActions: string[];
  operationalMode: 'operational' | 'executive' | 'strategic';
}

export interface ContextualDashboard {
  layout: 'chat' | 'dashboard' | 'analytics' | 'risk' | 'financial' | 'strategic';
  widgets: WidgetConfig[];
  kpis: string[];
  charts: ChartConfig[];
  liveData: boolean;
  realTimeMetrics: string[];
}

export interface WidgetConfig {
  id: string;
  type: 'kpi' | 'chart' | 'table' | 'alert' | 'heatmap' | 'radar' | 'gantt' | 'timeline';
  title: string;
  size: 'small' | 'medium' | 'large' | 'full';
  position: { x: number; y: number; w: number; h: number };
  dataSource: string;
  refreshInterval?: number;
  animated?: boolean;
}

export interface ChartConfig {
  id: string;
  type: 'line' | 'bar' | 'pie' | 'radar' | 'heatmap' | 'scatter' | 'gantt' | 'timeline';
  title: string;
  dataSource: string;
  xAxis?: string;
  yAxis?: string;
  colorScheme?: string;
  animated?: boolean;
  realTime?: boolean;
}

export class EnterpriseIntentEngine {
  private llmProvider: LLMProvider;

  constructor(llmProvider: LLMProvider) {
    this.llmProvider = llmProvider;
  }

  async analyzeIntent(query: string, userContext: any): Promise<Intent> {
    const prompt = `
Analiza la intención del usuario en el contexto de un sistema empresarial SGI360.

QUERY: "${query}"
CONTEXTO USUARIO: ${JSON.stringify(userContext)}

Responde en formato JSON con:
{
  "type": "financial|operational|strategic|risk|hr|projects|compliance|general",
  "confidence": 0.0-1.0,
  "entities": ["entidad1", "entidad2"],
  "context": {"key": "value"},
  "suggestedVisualizations": ["chart1", "chart2"],
  "suggestedActions": ["action1", "action2"],
  "operationalMode": "operational|executive|strategic"
}

Ejemplos:
- "mostrame riesgos" → type: "risk", mode: "executive", visualizations: ["heatmap", "radar"]
- "situación financiera" → type: "financial", mode: "executive", visualizations: ["line", "bar"]
- "analizá proyectos" → type: "projects", mode: "operational", visualizations: ["gantt", "timeline"]
- "capacitación personal" → type: "hr", mode: "operational", visualizations: ["table", "chart"]
`;

    try {
      const response = await this.llmProvider.chat(prompt, {
        system: "Eres un analista de intención experto en sistemas empresariales. Responde únicamente en JSON válido.",
        temperature: 0.1,
        maxTokens: 500
      });

      const intentData = JSON.parse(response.content);
      
      return {
        type: intentData.type || 'general',
        confidence: intentData.confidence || 0.5,
        entities: intentData.entities || [],
        context: intentData.context || {},
        suggestedVisualizations: intentData.suggestedVisualizations || [],
        suggestedActions: intentData.suggestedActions || [],
        operationalMode: intentData.operationalMode || 'operational'
      };
    } catch (error) {
      console.error('Error analyzing intent:', error);
      return this.getDefaultIntent();
    }
  }

  async generateDashboard(intent: Intent): Promise<ContextualDashboard> {
    const layouts = {
      financial: {
        layout: 'financial' as const,
        widgets: [
          {
            id: 'revenue-chart',
            type: 'chart' as const,
            title: 'Revenue Trend',
            size: 'large' as const,
            position: { x: 0, y: 0, w: 8, h: 4 },
            dataSource: 'financial/revenue',
            refreshInterval: 30000,
            animated: true
          },
          {
            id: 'cash-flow',
            type: 'chart' as const,
            title: 'Cash Flow',
            size: 'medium' as const,
            position: { x: 8, y: 0, w: 4, h: 4 },
            dataSource: 'financial/cashflow',
            animated: true
          },
          {
            id: 'margins-kpi',
            type: 'kpi' as const,
            title: 'Margins',
            size: 'medium' as const,
            position: { x: 0, y: 4, w: 4, h: 2 },
            dataSource: 'financial/margins',
            animated: true
          }
        ],
        kpis: ['revenue', 'margin', 'ebitda', 'cashflow'],
        charts: [
          {
            id: 'revenue-line',
            type: 'line' as const,
            title: 'Revenue Evolution',
            dataSource: 'financial/revenue',
            xAxis: 'date',
            yAxis: 'amount',
            animated: true,
            realTime: true
          }
        ],
        liveData: true,
        realTimeMetrics: ['revenue', 'cashflow', 'margins']
      },
      risk: {
        layout: 'risk' as const,
        widgets: [
          {
            id: 'risk-heatmap',
            type: 'heatmap' as const,
            title: 'Risk Matrix',
            size: 'large' as const,
            position: { x: 0, y: 0, w: 8, h: 6 },
            dataSource: 'risks/matrix',
            animated: true
          },
          {
            id: 'risk-radar',
            type: 'radar' as const,
            title: 'Risk Profile',
            size: 'medium' as const,
            position: { x: 8, y: 0, w: 4, h: 4 },
            dataSource: 'risks/profile',
            animated: true
          }
        ],
        kpis: ['total_risks', 'critical_risks', 'mitigated_risks', 'risk_trend'],
        charts: [
          {
            id: 'risk-radar-chart',
            type: 'radar' as const,
            title: 'Risk Assessment',
            dataSource: 'risks/assessment',
            colorScheme: 'risk',
            animated: true
          }
        ],
        liveData: true,
        realTimeMetrics: ['risk_score', 'new_risks']
      },
      projects: {
        layout: 'analytics' as const,
        widgets: [
          {
            id: 'project-gantt',
            type: 'gantt' as const,
            title: 'Project Timeline',
            size: 'full' as const,
            position: { x: 0, y: 0, w: 12, h: 6 },
            dataSource: 'projects/timeline',
            animated: true
          },
          {
            id: 'project-status',
            type: 'chart' as const,
            title: 'Project Status',
            size: 'medium' as const,
            position: { x: 0, y: 6, w: 6, h: 3 },
            dataSource: 'projects/status',
            animated: true
          }
        ],
        kpis: ['active_projects', 'on_time', 'over_budget', 'completion_rate'],
        charts: [
          {
            id: 'project-timeline',
            type: 'gantt' as const,
            title: 'Project Schedule',
            dataSource: 'projects/schedule',
            animated: true,
            realTime: true
          }
        ],
        liveData: true,
        realTimeMetrics: ['project_progress', 'milestone_completion']
      },
      operational: {
        layout: 'dashboard' as const,
        widgets: [
          {
            id: 'operations-kpi',
            type: 'kpi' as const,
            title: 'Operations Overview',
            size: 'medium' as const,
            position: { x: 0, y: 0, w: 4, h: 3 },
            dataSource: 'operations/kpi',
            animated: true
          },
          {
            id: 'alerts-panel',
            type: 'alert' as const,
            title: 'Active Alerts',
            size: 'medium' as const,
            position: { x: 4, y: 0, w: 4, h: 3 },
            dataSource: 'alerts/active',
            refreshInterval: 10000
          }
        ],
        kpis: ['efficiency', 'incidents', 'uptime', 'performance'],
        charts: [],
        liveData: true,
        realTimeMetrics: ['alerts', 'incidents', 'performance']
      },
      strategic: {
        layout: 'strategic' as const,
        widgets: [
          {
            id: 'strategic-kpi',
            type: 'kpi' as const,
            title: 'Strategic Indicators',
            size: 'large' as const,
            position: { x: 0, y: 0, w: 6, h: 4 },
            dataSource: 'strategic/kpi',
            animated: true
          },
          {
            id: 'forecast-chart',
            type: 'chart' as const,
            title: 'Business Forecast',
            size: 'large' as const,
            position: { x: 6, y: 0, w: 6, h: 4 },
            dataSource: 'strategic/forecast',
            animated: true
          }
        ],
        kpis: ['growth', 'market_share', 'innovation', 'sustainability'],
        charts: [
          {
            id: 'growth-projection',
            type: 'line' as const,
            title: 'Growth Projection',
            dataSource: 'strategic/growth',
            animated: true,
            realTime: false
          }
        ],
        liveData: false,
        realTimeMetrics: []
      }
    };

    return layouts[intent.type] || layouts.operational;
  }

  private getDefaultIntent(): Intent {
    return {
      type: 'general',
      confidence: 0.3,
      entities: [],
      context: {},
      suggestedVisualizations: ['chat'],
      suggestedActions: [],
      operationalMode: 'operational'
    };
  }

  async getSmartSuggestions(userContext: any, currentIntent: Intent): Promise<string[]> {
    const prompt = `
Genera sugerencias inteligentes contextuales para el Command Center de SGI360.

CONTEXTO USUARIO: ${JSON.stringify(userContext)}
INTENCIÓN ACTUAL: ${JSON.stringify(currentIntent)}

Genera 5 sugerencias específicas y accionables en formato JSON array:
["sugerencia1", "sugerencia2", "sugerencia3", "sugerencia4", "sugerencia5"]

Las sugerencias deben ser:
- Contextuales al rol y estado actual
- Basadas en módulos activos de SGI360
- Considerar alertas activas si existen
- Evolucionar según el historial
- Ser específicas y accionables
`;

    try {
      const response = await this.llmProvider.chat(prompt, {
        system: "Eres un asistente empresarial experto. Responde únicamente en JSON array válido.",
        temperature: 0.3,
        maxTokens: 300
      });

      return JSON.parse(response.content);
    } catch (error) {
      console.error('Error getting smart suggestions:', error);
      return [
        "Analizar rendimiento general",
        "Revisar alertas activas",
        "Consultar estado proyectos",
        "Evaluar riesgos críticos",
        "Generar informe ejecutivo"
      ];
    }
  }

  async detectProactiveAlerts(userContext: any): Promise<{
    id: string;
    type: 'warning' | 'critical' | 'info';
    title: string;
    description: string;
    action?: string;
    module?: string;
  }[]> {
    // Simulación de detección de alertas proactivas
    // En producción, esto analizaría datos reales de todos los módulos
    const alerts: Array<{
      id: string;
      type: 'warning' | 'critical' | 'info';
      title: string;
      description: string;
      action?: string;
      module?: string;
    }> = [];

    try {
      // Aquí iría lógica real de análisis de datos
      // Por ahora, simulamos algunas alertas contextuales
      
      if (userContext.tenantRole === 'TENANT_ADMIN') {
        alerts.push({
          id: 'storage-usage',
          type: 'warning' as const,
          title: 'Uso de almacenamiento',
          description: 'El almacenamiento está al 78% de capacidad',
          action: 'Ver detalles',
          module: 'settings'
        });
      }

      // Simulación de alertas basadas en fecha
      const now = new Date();
      if (now.getDate() <= 5) {
        alerts.push({
          id: 'monthly-report',
          type: 'info' as const,
          title: 'Reporte mensual disponible',
          description: 'El reporte del mes anterior está listo para revisión',
          action: 'Generar reporte',
          module: 'reports'
        });
      }

      return alerts;
    } catch (error) {
      console.error('Error detecting proactive alerts:', error);
      return [];
    }
  }
}
