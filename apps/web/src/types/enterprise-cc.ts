// ============================================================
// ENTERPRISE AI CONTROL TOWER - TYPES
// ============================================================

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

export interface ThinkingStep {
  id: string;
  phase: 'analyzing' | 'reasoning' | 'processing' | 'generating' | 'finalizing';
  title: string;
  description: string;
  progress: number;
  duration?: number;
  completed: boolean;
  timestamp: Date;
}

export interface AIThinkingSession {
  id: string;
  query: string;
  intent: string;
  provider: 'groq' | 'openai';
  model: string;
  steps: ThinkingStep[];
  startTime: Date;
  endTime?: Date;
  totalDuration?: number;
  deepAnalysis: boolean;
}

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

export interface CommandAction {
  id: string;
  label: string;
  description: string;
  icon: string;
  category: 'analysis' | 'generation' | 'simulation' | 'detection' | 'report' | 'planning';
  action: string;
  parameters?: Record<string, any>;
  requiresDeepAnalysis: boolean;
  estimatedTime: number;
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
  priority: number;
  autoDismiss?: number;
  timestamp: Date;
  userId?: string;
  tenantId: string;
  metadata?: Record<string, any>;
  dismissed: boolean;
  dismissedAt?: Date;
  dismissedBy?: string;
}

export interface LiveWidget {
  id: string;
  type: 'kpi' | 'chart' | 'metric' | 'progress' | 'status';
  title: string;
  value: any;
  trend?: {
    direction: 'up' | 'down' | 'stable';
    percentage: number;
  };
  animated: boolean;
  realTime: boolean;
  lastUpdate: Date;
  dataSource: string;
}

export interface AIStatusBar {
  provider: 'groq' | 'openai';
  mode: 'operational' | 'executive' | 'strategic';
  deepAnalysis: boolean;
  queriesRemaining: number;
  responseTime: number;
  systemStatus: 'optimal' | 'degraded' | 'critical';
  lastSync: Date;
}

export interface SmartSuggestion {
  id: string;
  text: string;
  category: string;
  priority: number;
  contextual: boolean;
  icon?: string;
  action?: string;
}

// UI State Types
export interface EnterpriseCCState {
  // Current session
  currentIntent: Intent | null;
  currentDashboard: ContextualDashboard | null;
  currentMode: OperationalMode | null;
  
  // AI Thinking
  thinkingSession: AIThinkingSession | null;
  isThinking: boolean;
  
  // Widgets & Dashboard
  activeWidgets: LiveWidget[];
  dashboardLayout: 'chat' | 'dashboard' | 'analytics' | 'fullscreen';
  
  // Actions & Executions
  availableActions: CommandAction[];
  activeExecutions: ActionExecution[];
  
  // Alerts
  floatingAlerts: FloatingAlert[];
  showAlerts: boolean;
  
  // Suggestions
  smartSuggestions: SmartSuggestion[];
  showSuggestions: boolean;
  
  // Status Bar
  statusBar: AIStatusBar | null;
  
  // UI State
  isFullscreen: boolean;
  isPremium: boolean;
  loading: boolean;
  error: string | null;
}

// Component Props Types
export interface EnterpriseCCProps {
  tenantId: string;
  userId: string;
  userRole: string;
  permissions: string[];
  subscription: any;
}

// Event Types
export interface EnterpriseCCEvent {
  type: 'intent-changed' | 'mode-changed' | 'dashboard-updated' | 'alert-triggered' | 'action-executed';
  payload: any;
  timestamp: Date;
}
