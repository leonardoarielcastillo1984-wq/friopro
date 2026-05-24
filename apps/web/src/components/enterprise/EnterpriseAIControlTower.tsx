'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { apiFetch } from '@/lib/api';
import {
  Brain, Mic, Send, Sparkles, Zap, LayoutGrid, TrendingUp,
  AlertTriangle, Target, Briefcase, Users, DollarSign, 
  ChevronRight, Crown, X, MoreHorizontal, Loader2,
  Command as CommandIcon, Radar, Activity, Monitor,
  BarChart3, Shield, Target as TargetIcon, Settings,
  Maximize2, Minimize2, Wifi, WifiOff, Cpu,
  ChevronUp, ChevronDown, Clock, CheckCircle, AlertCircle
} from 'lucide-react';

import {
  EnterpriseCCState,
  Intent,
  ContextualDashboard,
  ThinkingStep,
  OperationalMode,
  CommandAction,
  FloatingAlert,
  LiveWidget,
  AIStatusBar,
  SmartSuggestion,
  EnterpriseCCProps
} from '@/types/enterprise-cc';

// ============================================================
// ENTERPRISE AI CONTROL TOWER - MAIN COMPONENT
// ============================================================

export default function EnterpriseAIControlTower({ 
  tenantId, 
  userId, 
  userRole, 
  permissions, 
  subscription 
}: EnterpriseCCProps) {
  // ============================================================
  // STATE MANAGEMENT
  // ============================================================
  
  const [state, setState] = useState<EnterpriseCCState>({
    currentIntent: null,
    currentDashboard: null,
    currentMode: null,
    thinkingSession: null,
    isThinking: false,
    activeWidgets: [],
    dashboardLayout: 'chat',
    availableActions: [],
    activeExecutions: [],
    floatingAlerts: [],
    showAlerts: true,
    smartSuggestions: [],
    showSuggestions: true,
    statusBar: null,
    isFullscreen: false,
    isPremium: subscription?.plan !== 'STARTER_AI',
    loading: false,
    error: null
  });

  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [showCommandActions, setShowCommandActions] = useState(false);
  const [showModeSelector, setShowModeSelector] = useState(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const controls = useAnimation();

  // ============================================================
  // EFFECTS
  // ============================================================

  // Initialize Enterprise CC
  useEffect(() => {
    initializeEnterpriseCC();
    const interval = setInterval(updateLiveWidgets, 5000); // Update every 5 seconds
    return () => clearInterval(interval);
  }, []);

  // Update status bar
  useEffect(() => {
    updateStatusBar();
    const interval = setInterval(updateStatusBar, 10000); // Update every 10 seconds
    return () => clearInterval(interval);
  }, []);

  // ============================================================
  // INITIALIZE ENTERPRISE CC
  // ============================================================

  const initializeEnterpriseCC = async () => {
    try {
      setState(prev => ({ ...prev, loading: true }));

      // Load initial data
      const [modes, actions, alerts, suggestions] = await Promise.all([
        loadOperationalModes(),
        loadCommandActions(),
        loadFloatingAlerts(),
        loadSmartSuggestions()
      ]);

      // Set initial mode based on user role
      const initialMode = modes.find(mode => 
        userRole === 'TENANT_ADMIN' ? mode.id === 'executive' : mode.id === 'operational'
      ) || modes[0];

      setState(prev => ({
        ...prev,
        currentMode: initialMode,
        availableActions: actions,
        floatingAlerts: alerts,
        smartSuggestions: suggestions,
        loading: false
      }));

    } catch (error) {
      console.error('Error initializing Enterprise CC:', error);
      setState(prev => ({ ...prev, error: 'Error initializing system', loading: false }));
    }
  };

  // ============================================================
  // API CALLS
  // ============================================================

  const loadOperationalModes = async (): Promise<OperationalMode[]> => {
    const response = await apiFetch('/api/command-center/modes');
    return response.data;
  };

  const loadCommandActions = async (): Promise<CommandAction[]> => {
    const response = await apiFetch('/api/command-center/actions');
    return response.data.actions;
  };

  const loadFloatingAlerts = async (): Promise<FloatingAlert[]> => {
    const response = await apiFetch('/api/command-center/alerts');
    return response.data.alerts;
  };

  const loadSmartSuggestions = async (): Promise<SmartSuggestion[]> => {
    const response = await apiFetch('/api/command-center/suggestions');
    return response.data.suggestions.map((s: string, i: number) => ({
      id: `suggestion-${i}`,
      text: s,
      category: 'general',
      priority: 5,
      contextual: true,
      icon: 'lightbulb'
    }));
  };

  const analyzeIntent = async (query: string): Promise<Intent> => {
    const response = await apiFetch('/api/command-center/intent/analyze', {
      method: 'POST',
      body: JSON.stringify({
        query,
        userContext: {
          tenantId,
          userId,
          userRole,
          permissions
        }
      })
    });
    return response.data.intent;
  };

  const startThinkingSession = async (query: string, intent: Intent): Promise<string> => {
    const response = await apiFetch('/api/command-center/thinking/start', {
      method: 'POST',
      body: JSON.stringify({
        query,
        intent: intent.type,
        provider: intent.operationalMode === 'strategic' ? 'openai' : 'groq',
        model: intent.operationalMode === 'strategic' ? 'gpt-4' : 'llama-3.1-8b-instant'
      })
    });
    return response.data.sessionId;
  };

  const executeCommandAction = async (actionId: string, parameters?: any): Promise<string> => {
    const response = await apiFetch(`/api/command-center/actions/${actionId}/execute`, {
      method: 'POST',
      body: JSON.stringify({ parameters })
    });
    return response.data.executionId;
  };

  const dismissAlert = async (alertId: string): Promise<void> => {
    await apiFetch(`/api/command-center/alerts/${alertId}/dismiss`, {
      method: 'POST'
    });
  };

  const updateStatusBar = async (): Promise<void> => {
    const statusBar: AIStatusBar = {
      provider: state.currentMode?.aiSettings.useDeepAnalysis ? 'openai' : 'groq',
      mode: state.currentMode?.id || 'operational',
      deepAnalysis: state.currentMode?.aiSettings.useDeepAnalysis || false,
      queriesRemaining: subscription?.premiumQueriesRemaining || 0,
      responseTime: Math.random() * 1000 + 200, // Simulated
      systemStatus: 'optimal',
      lastSync: new Date()
    };
    setState(prev => ({ ...prev, statusBar }));
  };

  const updateLiveWidgets = async (): Promise<void> => {
    // Simulate live widget updates
    const liveWidgets: LiveWidget[] = [
      {
        id: 'kpi-1',
        type: 'kpi',
        title: 'Rendimiento Operativo',
        value: Math.random() * 100,
        trend: {
          direction: Math.random() > 0.5 ? 'up' : 'down',
          percentage: Math.random() * 20
        },
        animated: true,
        realTime: true,
        lastUpdate: new Date(),
        dataSource: 'operations'
      },
      {
        id: 'kpi-2',
        type: 'metric',
        title: 'Alertas Activas',
        value: state.floatingAlerts.filter(a => !a.dismissed).length,
        animated: true,
        realTime: true,
        lastUpdate: new Date(),
        dataSource: 'alerts'
      }
    ];
    setState(prev => ({ ...prev, activeWidgets: liveWidgets }));
  };

  // ============================================================
  // HANDLERS
  // ============================================================

  const handleSendMessage = async () => {
    if (!input.trim() || state.loading) return;

    const query = input.trim();
    setInput('');
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      // Step 1: Analyze intent
      const intent = await analyzeIntent(query);
      setState(prev => ({ ...prev, currentIntent: intent }));

      // Step 2: Start thinking session
      const sessionId = await startThinkingSession(query, intent);
      setState(prev => ({ 
        ...prev, 
        isThinking: true,
        thinkingSession: { 
          id: sessionId, 
          query, 
          intent: intent.type,
          provider: intent.operationalMode === 'strategic' ? 'openai' : 'groq',
          model: intent.operationalMode === 'strategic' ? 'gpt-4' : 'llama-3.1-8b-instant',
          steps: [],
          startTime: new Date(),
          deepAnalysis: intent.operationalMode === 'strategic'
        }
      }));

      // Step 3: Monitor thinking progress
      monitorThinkingProgress(sessionId);

      // Step 4: Update dashboard based on intent
      if (intent.type !== 'general') {
        const dashboardResponse = await apiFetch('/api/command-center/intent/analyze', {
          method: 'POST',
          body: JSON.stringify({
            query,
            userContext: {
              tenantId,
              userId,
              userRole,
              permissions
            }
          })
        });
        setState(prev => ({ 
          ...prev, 
          currentDashboard: dashboardResponse.data.dashboard,
          dashboardLayout: dashboardResponse.data.dashboard.layout
        }));
      }

    } catch (error) {
      console.error('Error processing message:', error);
      setState(prev => ({ 
        ...prev, 
        error: 'Error processing your request',
        loading: false,
        isThinking: false
      }));
    }
  };

  const monitorThinkingProgress = (sessionId: string) => {
    const interval = setInterval(async () => {
      try {
        const response = await apiFetch(`/api/command-center/thinking/${sessionId}`);
        const session = response.data.session;
        
        setState(prev => ({ 
          ...prev, 
          thinkingSession: session,
          isThinking: !session.endTime
        }));

        if (session.endTime) {
          clearInterval(interval);
          setState(prev => ({ ...prev, loading: false }));
        }
      } catch (error) {
        clearInterval(interval);
        setState(prev => ({ ...prev, isThinking: false, loading: false }));
      }
    }, 1000);
  };

  const handleActionClick = async (action: CommandAction) => {
    try {
      const executionId = await executeCommandAction(action.id);
      
      // Add to active executions
      const newExecution: ActionExecution = {
        id: executionId,
        actionId: action.id,
        status: 'pending',
        startTime: new Date(),
        progress: 0,
        userId,
        tenantId
      };

      setState(prev => ({
        ...prev,
        activeExecutions: [...prev.activeExecutions, newExecution]
      }));

      // Monitor execution progress
      monitorExecutionProgress(executionId);

    } catch (error) {
      console.error('Error executing action:', error);
      setState(prev => ({ ...prev, error: 'Error executing action' }));
    }
  };

  const monitorExecutionProgress = (executionId: string) => {
    const interval = setInterval(async () => {
      try {
        const response = await apiFetch(`/api/command-center/actions/executions/${executionId}`);
        const execution = response.data;
        
        setState(prev => ({
          ...prev,
          activeExecutions: prev.activeExecutions.map(e => 
            e.id === executionId ? execution : e
          )
        }));

        if (execution.status === 'completed' || execution.status === 'failed') {
          clearInterval(interval);
          
          // Remove from active executions after 3 seconds
          setTimeout(() => {
            setState(prev => ({
              ...prev,
              activeExecutions: prev.activeExecutions.filter(e => e.id !== executionId)
            }));
          }, 3000);
        }
      } catch (error) {
        clearInterval(interval);
      }
    }, 1000);
  };

  const handleModeChange = async (mode: OperationalMode) => {
    try {
      setState(prev => ({ ...prev, loading: true }));
      
      const response = await apiFetch(`/api/command-center/modes/${mode.id}/activate`, {
        method: 'POST',
        body: JSON.stringify({ query: input || 'Modo cambiado' })
      });

      setState(prev => ({
        ...prev,
        currentMode: mode,
        currentDashboard: response.data.dashboard,
        loading: false,
        showModeSelector: false
      }));

    } catch (error) {
      console.error('Error changing mode:', error);
      setState(prev => ({ ...prev, error: 'Error changing mode', loading: false }));
    }
  };

  const handleAlertDismiss = async (alertId: string) => {
    try {
      await dismissAlert(alertId);
      setState(prev => ({
        ...prev,
        floatingAlerts: prev.floatingAlerts.map(a =>
          a.id === alertId ? { ...a, dismissed: true, dismissedAt: new Date() } : a
        )
      }));
    } catch (error) {
      console.error('Error dismissing alert:', error);
    }
  };

  const toggleFullscreen = () => {
    setState(prev => ({ ...prev, isFullscreen: !prev.isFullscreen }));
  };

  // ============================================================
  // RENDER COMPONENTS
  // ============================================================

  const renderThinkingVisualization = () => {
    if (!state.isThinking || !state.thinkingSession) return null;

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-purple-900/20 to-blue-900/20 backdrop-blur-lg rounded-xl p-6 border border-purple-500/20"
      >
        <div className="flex items-center gap-3 mb-4">
          <Brain className="w-5 h-5 text-purple-400 animate-pulse" />
          <span className="text-purple-300 font-medium">IA Thinking</span>
          {state.thinkingSession.deepAnalysis && (
            <span className="px-2 py-1 bg-yellow-500/20 text-yellow-300 text-xs rounded-full">
              Deep Analysis
            </span>
          )}
        </div>

        <div className="space-y-3">
          {state.thinkingSession.steps.map((step, index) => (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex items-center gap-3"
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step.completed 
                  ? 'bg-green-500/20 text-green-400' 
                  : step.progress > 0 
                    ? 'bg-blue-500/20 text-blue-400 animate-pulse'
                    : 'bg-gray-500/20 text-gray-400'
              }`}>
                {step.completed ? (
                  <CheckCircle className="w-4 h-4" />
                ) : step.progress > 0 ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Clock className="w-4 h-4" />
                )}
              </div>
              
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-200">{step.title}</span>
                  {step.progress > 0 && !step.completed && (
                    <span className="text-xs text-gray-400">{Math.round(step.progress)}%</span>
                  )}
                </div>
                <p className="text-xs text-gray-400">{step.description}</p>
                
                {step.progress > 0 && !step.completed && (
                  <div className="mt-2 w-full bg-gray-700 rounded-full h-1">
                    <motion.div
                      className="bg-blue-500 h-1 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${step.progress}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    );
  };

  const renderFloatingAlerts = () => {
    const activeAlerts = state.floatingAlerts.filter(a => !a.dismissed);
    if (activeAlerts.length === 0) return null;

    return (
      <AnimatePresence>
        {activeAlerts.slice(0, 3).map((alert) => (
          <motion.div
            key={alert.id}
            initial={{ opacity: 0, x: 300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 300 }}
            className={`fixed top-4 right-4 z-50 max-w-sm p-4 rounded-lg backdrop-blur-lg border ${
              alert.type === 'critical' ? 'bg-red-900/80 border-red-500/50' :
              alert.type === 'warning' ? 'bg-yellow-900/80 border-yellow-500/50' :
              alert.type === 'info' ? 'bg-blue-900/80 border-blue-500/50' :
              'bg-green-900/80 border-green-500/50'
            }`}
          >
            <div className="flex items-start gap-3">
              {alert.type === 'critical' && <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />}
              {alert.type === 'warning' && <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0" />}
              {alert.type === 'info' && <Activity className="w-5 h-5 text-blue-400 flex-shrink-0" />}
              {alert.type === 'success' && <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />}
              
              <div className="flex-1">
                <h4 className="font-medium text-white text-sm">{alert.title}</h4>
                <p className="text-xs text-gray-300 mt-1">{alert.description}</p>
                
                {alert.action && (
                  <button
                    onClick={() => handleActionClick({ id: 'manual', label: alert.action!.label, action: alert.action!.action } as CommandAction)}
                    className="mt-2 text-xs font-medium text-blue-400 hover:text-blue-300"
                  >
                    {alert.action.label}
                  </button>
                )}
              </div>
              
              <button
                onClick={() => handleAlertDismiss(alert.id)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    );
  };

  const renderCommandActions = () => {
    if (!showCommandActions) return null;

    const categories = {
      analysis: { icon: BarChart3, label: 'Análisis', color: 'blue' },
      generation: { icon: Sparkles, label: 'Generación', color: 'purple' },
      simulation: { icon: Target, label: 'Simulación', color: 'green' },
      detection: { icon: Radar, label: 'Detección', color: 'yellow' },
      report: { icon: Briefcase, label: 'Reportes', color: 'indigo' },
      planning: { icon: TargetIcon, label: 'Planificación', color: 'pink' }
    };

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute bottom-full left-0 right-0 mb-2 bg-gray-900/95 backdrop-blur-lg rounded-lg border border-gray-700 p-4 z-40"
      >
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Object.entries(categories).map(([category, config]) => {
            const actions = state.availableActions.filter(a => a.category === category);
            if (actions.length === 0) return null;

            return (
              <div key={category} className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-medium text-gray-400">
                  <config.icon className="w-3 h-3" />
                  {config.label}
                </div>
                {actions.slice(0, 3).map(action => (
                  <button
                    key={action.id}
                    onClick={() => handleActionClick(action)}
                    className="w-full text-left px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs text-gray-300 hover:text-white transition-colors"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </motion.div>
    );
  };

  const renderAIStatusBar = () => {
    if (!state.statusBar) return null;

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gray-900/80 backdrop-blur-lg border border-gray-700 rounded-lg px-4 py-2 flex items-center gap-6 text-xs"
      >
        <div className="flex items-center gap-2">
          <Cpu className={`w-3 h-3 ${
            state.statusBar.provider === 'openai' ? 'text-green-400' : 'text-blue-400'
          }`} />
          <span className="text-gray-300">
            {state.statusBar.provider === 'openai' ? 'GPT-4' : 'Groq'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Monitor className="w-3 h-3 text-purple-400" />
          <span className="text-gray-300 capitalize">{state.statusBar.mode}</span>
        </div>

        {state.statusBar.deepAnalysis && (
          <div className="flex items-center gap-1 px-2 py-1 bg-yellow-500/20 rounded-full">
            <Sparkles className="w-3 h-3 text-yellow-400" />
            <span className="text-yellow-300">Deep Analysis</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Wifi className="w-3 h-3 text-green-400" />
          <span className="text-gray-300">{Math.round(state.statusBar.responseTime)}ms</span>
        </div>

        <div className="flex items-center gap-2">
          <Zap className="w-3 h-3 text-blue-400" />
          <span className="text-gray-300">{state.statusBar.queriesRemaining}</span>
        </div>
      </motion.div>
    );
  };

  const renderLiveWidgets = () => {
    if (state.activeWidgets.length === 0) return null;

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {state.activeWidgets.map((widget) => (
          <motion.div
            key={widget.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-900/50 backdrop-blur-lg rounded-lg border border-gray-700 p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-400">{widget.title}</span>
              {widget.realTime && (
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              )}
            </div>
            
            <div className="text-2xl font-bold text-white">
              {widget.type === 'kpi' ? `${Math.round(widget.value)}%` : widget.value}
            </div>
            
            {widget.trend && (
              <div className="flex items-center gap-1 mt-2">
                {widget.trend.direction === 'up' ? (
                  <ChevronUp className="w-3 h-3 text-green-400" />
                ) : widget.trend.direction === 'down' ? (
                  <ChevronDown className="w-3 h-3 text-red-400" />
                ) : (
                  <div className="w-3 h-3 bg-gray-400 rounded-full" />
                )}
                <span className={`text-xs ${
                  widget.trend.direction === 'up' ? 'text-green-400' :
                  widget.trend.direction === 'down' ? 'text-red-400' : 'text-gray-400'
                }`}>
                  {Math.round(widget.trend.percentage)}%
                </span>
              </div>
            )}
          </motion.div>
        ))}
      </div>
    );
  };

  // ============================================================
  // MAIN RENDER
  // ============================================================

  return (
    <div className={`min-h-screen bg-gradient-to-br from-gray-900 via-blue-900/20 to-purple-900/20 ${
      state.isFullscreen ? 'fixed inset-0 z-50' : ''
    }`}>
      {/* Floating Alerts */}
      {renderFloatingAlerts()}

      {/* Main Container */}
      <div className="flex flex-col h-screen">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-900/80 backdrop-blur-lg border-b border-gray-700 px-6 py-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Brain className="w-6 h-6 text-purple-400" />
                <h1 className="text-xl font-bold text-white">Enterprise AI Control Tower</h1>
              </div>
              
              {state.isPremium && (
                <div className="flex items-center gap-1 px-2 py-1 bg-yellow-500/20 rounded-full">
                  <Crown className="w-3 h-3 text-yellow-400" />
                  <span className="text-xs text-yellow-300">Premium</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-4">
              {/* Mode Selector */}
              <button
                onClick={() => setShowModeSelector(!showModeSelector)}
                className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <Monitor className="w-4 h-4 text-gray-300" />
                <span className="text-sm text-gray-300 capitalize">
                  {state.currentMode?.name || 'Operativo'}
                </span>
              </button>

              {/* Fullscreen Toggle */}
              <button
                onClick={toggleFullscreen}
                className="p-2 text-gray-400 hover:text-white transition-colors"
              >
                {state.isFullscreen ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* AI Status Bar */}
          <div className="mt-4">
            {renderAIStatusBar()}
          </div>
        </motion.header>

        {/* Main Content */}
        <main className="flex-1 overflow-hidden">
          <div className="h-full flex flex-col max-w-7xl mx-auto px-6 py-6">
            {/* Live Widgets */}
            {renderLiveWidgets()}

            {/* Thinking Visualization */}
            {renderThinkingVisualization()}

            {/* Messages Container */}
            <div className="flex-1 overflow-y-auto mb-6 space-y-4">
              {/* Messages would go here */}
              <div className="text-center text-gray-500 py-8">
                <Brain className="w-12 h-12 mx-auto mb-4 text-gray-600" />
                <p>Enterprise AI Control Tower está listo para analizar tus consultas</p>
                <p className="text-sm mt-2">Intenta preguntar sobre análisis financiero, detección de riesgos o simulaciones estratégicas</p>
              </div>
            </div>

            {/* Command Actions */}
            <div className="relative">
              {renderCommandActions()}
            </div>

            {/* Input Area */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gray-900/80 backdrop-blur-lg rounded-lg border border-gray-700"
            >
              <div className="flex items-center gap-4 p-4">
                <button
                  onClick={() => setIsListening(!isListening)}
                  className={`p-3 rounded-lg transition-colors ${
                    isListening 
                      ? 'bg-red-500/20 text-red-400 animate-pulse' 
                      : 'bg-gray-800 text-gray-400 hover:text-white'
                  }`}
                >
                  <Mic className="w-5 h-5" />
                </button>

                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Analizar situación financiera, detectar riesgos, simular escenarios..."
                  className="flex-1 bg-transparent text-white placeholder-gray-500 outline-none"
                  disabled={state.loading}
                />

                <button
                  onClick={() => setShowCommandActions(!showCommandActions)}
                  className="p-3 bg-gray-800 text-gray-400 hover:text-white rounded-lg transition-colors"
                >
                  <CommandIcon className="w-5 h-5" />
                </button>

                <button
                  onClick={handleSendMessage}
                  disabled={!input.trim() || state.loading}
                  className="p-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {state.loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        </main>
      </div>

      {/* Mode Selector Modal */}
      <AnimatePresence>
        {showModeSelector && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center"
            onClick={() => setShowModeSelector(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-gray-900 rounded-xl border border-gray-700 p-6 max-w-2xl w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-white mb-4">Seleccionar Modo Operativo</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Mode options would be rendered here */}
                <div className="text-center text-gray-500 py-8">
                  Modos operativos disponibles
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
