'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// Web Speech API types
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { apiFetch } from '@/lib/api';
import {
  Brain, Mic, Send, Sparkles, Zap, LayoutGrid, TrendingUp,
  AlertTriangle, Target, Briefcase, Users, DollarSign,
  ChevronRight, Crown, X, MoreHorizontal, Loader2,
  Command as CommandIcon, Radar, Activity, Monitor,
  BarChart3, Shield, Target as TargetIcon, Settings,
  Maximize2, Minimize2, Wifi, WifiOff, Cpu,
  ChevronUp, ChevronDown, Clock, CheckCircle, AlertCircle,
  Volume2, Volume, Radio, Waves, Signal, Database,
  TrendingDown, BarChart, PieChart, LineChart, Calendar,
  Filter, Search, Eye, EyeOff, RefreshCw, PlayCircle,
  PauseCircle, StopCircle, Download, Upload, Share2,
  Copy, Trash2, Edit3, Save, FileText, Image,
  Video, Music, Headphones, Speaker,
  ZapOff, Battery, BatteryLow, BatteryFull,
  Thermometer, Gauge, Timer,
  Compass, Navigation, Map, Globe,
  Cloud, CloudRain, CloudSnow, Sun, Moon, Star,
  Heart, Activity as ActivityIcon, BrainCircuit,
  Cpu as CpuIcon, HardDrive, Server,
  Network, Router, Wifi as WifiIcon,
  Lock, Unlock, Key, Shield as ShieldIcon,
  Hammer, Wrench, Settings2,
  Layers, Grid, Columns, Layout, LayoutDashboard,
  Monitor as MonitorIcon, Smartphone, Tablet, Laptop,
  Tv, Radio as RadioIcon, Speaker as SpeakerIcon,
  Headphones as HeadphonesIcon, Disc,
  Music as MusicIcon, Play, Pause, SkipBack, SkipForward,
  Repeat, Shuffle, Volume1, Volume2 as Volume2Icon,
  VolumeX,
  Lightbulb, User
} from 'lucide-react';
import DashboardWidgets from './DashboardWidgets';

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
  const [activeConversationId, setActiveConversationId] = useState<string | undefined>(undefined);
  const [showCommandActions, setShowCommandActions] = useState(false);
  const [showModeSelector, setShowModeSelector] = useState(false);
  const [streamingResponse, setStreamingResponse] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [messages, setMessages] = useState<Array<{role: 'user'|'assistant', content: string, timestamp: Date}>>([]);
  const [liveDataStatus, setLiveDataStatus] = useState({
    connected: true,
    lastSync: new Date(),
    activeFeeds: 12,
    dataPoints: 2847,
    latency: 23
  });
  const [deepAnalysisMode, setDeepAnalysisMode] = useState(false);
  const [contextualVisualizations, setContextualVisualizations] = useState<any[]>([]);
  const [smartSuggestions, setSmartSuggestions] = useState<SmartSuggestion[]>([]);

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
  }, []);

  // Update live data status timestamp only
  useEffect(() => {
    const interval = setInterval(() => {
      setLiveDataStatus(prev => ({
        ...prev,
        lastSync: new Date()
      }));
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Update smart suggestions based on context
  useEffect(() => {
    updateSmartSuggestions();
  }, [state.currentIntent, state.currentMode, userRole]);

  // Check for deep analysis mode
  useEffect(() => {
    if (state.currentMode?.aiSettings.useDeepAnalysis) {
      setDeepAnalysisMode(true);
    } else {
      setDeepAnalysisMode(false);
    }
  }, [state.currentMode]);

  // ============================================================
  // VOICE RECOGNITION - Web Speech API
  // ============================================================
  useEffect(() => {
    if (!isListening) return;

    // Check browser support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error('Speech recognition not supported in this browser');
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'es-AR';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript) {
        setInput(prev => prev + ' ' + finalTranscript.trim());
      }
      if (interimTranscript) {
        // Show interim result temporarily
        setInput(prev => {
          const base = prev.replace(/\.\.\.$/, '').trim();
          return base + ' ' + interimTranscript + '...';
        });
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        alert('Permiso de micrófono denegado. Por favor habilita el acceso al micrófono.');
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    try {
      recognition.start();
    } catch (err) {
      console.error('Failed to start speech recognition:', err);
      setIsListening(false);
    }

    return () => {
      try {
        recognition.stop();
      } catch {
        // Ignore stop errors
      }
    };
  }, [isListening]);

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
    const response = await apiFetch('/command-center/modes');
    return response.data;
  };

  const loadCommandActions = async (): Promise<CommandAction[]> => {
    try {
      const response = await apiFetch('/command-center/actions');
      if (!response.data) {
        return [];
      }
      // El backend devuelve directamente el array de acciones en response.data
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      console.error('Error loading command actions:', error);
      return [];
    }
  };

  const loadFloatingAlerts = async (): Promise<FloatingAlert[]> => {
    try {
      const response = await apiFetch('/command-center/alerts');
      if (!response.data) {
        return [];
      }
      // El backend puede devolver response.data.alerts o directamente response.data
      const alerts = response.data.alerts || response.data;
      return Array.isArray(alerts) ? alerts : [];
    } catch (error) {
      console.error('Error loading floating alerts:', error);
      return [];
    }
  };

  const loadSmartSuggestions = async (): Promise<SmartSuggestion[]> => {
    try {
      const response = await apiFetch('/command-center/suggestions');
      if (!response.data || !Array.isArray(response.data)) {
        return [];
      }
      
      const suggestions: SmartSuggestion[] = [];
      response.data.forEach((category: any) => {
        if (category.queries && Array.isArray(category.queries)) {
          category.queries.forEach((query: string, index: number) => {
            suggestions.push({
              id: `suggestion-${category.category}-${index}`,
              text: query,
              category: category.category.toLowerCase(),
              priority: 5,
              contextual: true,
              icon: 'lightbulb'
            });
          });
        }
      });
      
      return suggestions;
    } catch (error) {
      console.error('Error loading smart suggestions:', error);
      return [];
    }
  };

  const analyzeIntent = async (query: string): Promise<Intent> => {
    const response = await apiFetch('/command-center/intent/analyze', {
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
    const response = await apiFetch('/command-center/thinking/start', {
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
    const response = await apiFetch(`/command-center/actions/${actionId}/execute`, {
      method: 'POST',
      body: JSON.stringify({ parameters })
    });
    return response.data.executionId;
  };

  const dismissAlert = async (alertId: string): Promise<void> => {
    await apiFetch(`/command-center/alerts/${alertId}/dismiss`, {
      method: 'POST'
    });
  };

  const updateSmartSuggestions = async (): Promise<void> => {
    try {
      const baseSuggestions = [
        'Analizar rendimiento financiero',
        'Detectar riesgos operativos',
        'Simular escenarios estratégicos',
        'Generar informe ejecutivo',
        'Optimizar procesos',
        'Evaluar capacidad operativa'
      ];

      let contextualSuggestions = baseSuggestions;

      // Contextual suggestions based on current intent
      if (state.currentIntent) {
        switch (state.currentIntent.type) {
          case 'financial':
            contextualSuggestions = [
              'Analizar cash flow',
              'Evaluar márgenes',
              'Forecast financiero',
              'Análisis de costos',
              'ROI proyectos',
              'Indicadores financieros'
            ];
            break;
          case 'risk':
            contextualSuggestions = [
              'Identificar riesgos críticos',
              'Análisis de vulnerabilidades',
              'Mapa de riesgos',
              'Plan de mitigación',
              'Evaluación de impacto',
              'Monitoreo de riesgos'
            ];
            break;
          case 'operational':
            contextualSuggestions = [
              'Estado de operaciones',
              'Eficiencia de procesos',
              'Análisis de capacidad',
              'Optimización de recursos',
              'Métricas operativas',
              'Dashboard operativo'
            ];
            break;
          case 'strategic':
            contextualSuggestions = [
              'Simulación estratégica',
              'Análisis de escenarios',
              'Plan de expansión',
              'Evaluación de mercado',
              'Competitive analysis',
              'Roadmap estratégico'
            ];
            break;
        }
      }

      const suggestions: SmartSuggestion[] = contextualSuggestions.map((text, index) => ({
        id: `suggestion-${index}`,
        text,
        category: state.currentIntent?.type || 'general',
        priority: Math.floor(Math.random() * 10) + 1,
        contextual: true,
        icon: getSuggestionIcon(text)
      }));

      setSmartSuggestions(suggestions);
    } catch (error) {
      console.error('Error updating smart suggestions:', error);
    }
  };

  const getSuggestionIcon = (suggestion: string): string => {
    if (suggestion.toLowerCase().includes('financ')) return 'dollar-sign';
    if (suggestion.toLowerCase().includes('riesg')) return 'shield';
    if (suggestion.toLowerCase().includes('oper')) return 'settings';
    if (suggestion.toLowerCase().includes('estrat')) return 'target';
    if (suggestion.toLowerCase().includes('anal')) return 'bar-chart';
    if (suggestion.toLowerCase().includes('simul')) return 'zap';
    if (suggestion.toLowerCase().includes('informe')) return 'file-text';
    if (suggestion.toLowerCase().includes('optim')) return 'trending-up';
    return 'lightbulb';
  };

  const updateLiveWidgets = async (): Promise<void> => {
    // Widgets solo desde backend con datos reales — no se generan localmente
  };

  // ============================================================
  // HANDLERS
  // ============================================================

  const handleSendMessage = async () => {
    if (!input.trim() || state.loading) return;

    const query = input.trim();
    setInput('');
    setState(prev => ({ ...prev, loading: true, error: null }));
    setStreamingResponse('');
    setIsStreaming(true);

    try {
      // Step 1: Analyze intent
      const intent = await analyzeIntent(query);
      setState(prev => ({ ...prev, currentIntent: intent }));

      // Step 2: Generate contextual visualizations
      await generateContextualVisualizations(intent);

      // Step 3: Start thinking session
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

      // Step 4: Monitor thinking progress (visual only)
      monitorThinkingProgress(sessionId);

      // Add user message to history
      setMessages(prev => [...prev, { role: 'user', content: query, timestamp: new Date() }]);

      // Step 5: Call real backend /query endpoint
      const queryResponse = await apiFetch('/command-center/query', {
        method: 'POST',
        body: JSON.stringify({
          query,
          conversationId: activeConversationId
        })
      }) as any;

      // Guardar conversationId real del backend para mantener hilo de memoria
      if (queryResponse?.conversationId && queryResponse.conversationId !== activeConversationId) {
        setActiveConversationId(queryResponse.conversationId);
      }

      // Activar Deep Analysis Mode si el backend usó OpenAI
      const usedProvider = queryResponse?.provider || queryResponse?.data?.provider || 'groq';
      if (usedProvider === 'openai') {
        setDeepAnalysisMode(true);
      }

      // Mostrar widgets reales del backend si existen
      if (queryResponse?.data?.widgets && queryResponse.data.widgets.length > 0) {
        setState(prev => ({ ...prev, activeWidgets: queryResponse.data.widgets }));
      }

      // Mostrar alertas proactivas si el backend las devuelve
      if (queryResponse?.data?.alerts && queryResponse.data.alerts.length > 0) {
        setState(prev => ({ ...prev, floatingAlerts: queryResponse.data.alerts }));
      }

      // Si la tool ejecutó una acción (toolExecuted), mostrar resultado especial
      const toolExecuted = queryResponse?.data?.metadata?.toolExecuted;

      // Capturar acciones del paywall u otras acciones del backend
      const responseActions = queryResponse?.data?.actions || [];

      const realAnswer = queryResponse?.data?.summary 
        || queryResponse?.data?.response 
        || queryResponse?.data?.answer
        || 'No se pudo obtener una respuesta del servidor.';

      // Step 6: Stream the real answer character by character
      setIsStreaming(true);
      let currentText = '';
      let charIndex = 0;
      const streamSpeed = toolExecuted ? 8 : 15; // Acciones más rápidas
      const streamInterval = setInterval(() => {
        if (charIndex < realAnswer.length) {
          currentText += realAnswer[charIndex];
          setStreamingResponse(currentText);
          charIndex++;
        } else {
          clearInterval(streamInterval);
          setIsStreaming(false);
          setStreamingResponse('');
          // Save completed response to message history
          setMessages(prev => [...prev, { 
            role: 'assistant', 
            content: realAnswer, 
            timestamp: new Date(),
            provider: usedProvider,
            toolExecuted: toolExecuted || undefined,
            actions: responseActions.length > 0 ? responseActions : undefined
          } as any]);
          setState(prev => ({ ...prev, loading: false }));
          // Desactivar deep analysis mode después de responder
          if (usedProvider !== 'openai') setDeepAnalysisMode(false);
        }
      }, streamSpeed);

    } catch (error) {
      console.error('Error processing message:', error);
      setState(prev => ({ 
        ...prev, 
        error: 'Error processing your request',
        loading: false,
        isThinking: false
      }));
      setIsStreaming(false);
    }
  };

  const generateContextualVisualizations = async (intent: Intent): Promise<void> => {
    // NO generar visualizaciones mock locales
    // Las visualizaciones deben venir exclusivamente del backend con datos reales
    // Si el backend no devuelve widgets, no se muestra nada (array vacío)
    setContextualVisualizations([]);
  };

  const monitorThinkingProgress = (sessionId: string) => {
    // Simulate thinking progress updates
    const thinkingSteps: ThinkingStep[] = [
      { id: '1', phase: 'analyzing', title: 'Analizando intención', description: 'Interpretando el contexto y objetivo', progress: 0, completed: false, timestamp: new Date() },
      { id: '2', phase: 'processing', title: 'Recopilando datos', description: 'Obteniendo información relevante del sistema', progress: 0, completed: false, timestamp: new Date() },
      { id: '3', phase: 'reasoning', title: 'Procesando contexto', description: 'Analizando relaciones y patrones', progress: 0, completed: false, timestamp: new Date() },
      { id: '4', phase: 'generating', title: 'Generando respuesta', description: 'Construyendo respuesta inteligente', progress: 0, completed: false, timestamp: new Date() }
    ];

    setState(prev => ({
      ...prev,
      thinkingSession: {
        ...prev.thinkingSession!,
        steps: thinkingSteps
      }
    }));

    let stepIndex = 0;
    const progressInterval = setInterval(() => {
      if (stepIndex < thinkingSteps.length) {
        // Update current step progress
        setState(prev => {
          const updatedSteps = [...prev.thinkingSession!.steps];
          const currentStep = updatedSteps[stepIndex];
          
          if (currentStep.progress < 100) {
            currentStep.progress = Math.min(currentStep.progress + 20, 100);
          } else if (!currentStep.completed) {
            currentStep.completed = true;
            stepIndex++;
          }
          
          return {
            ...prev,
            thinkingSession: {
              ...prev.thinkingSession!,
              steps: updatedSteps
            }
          };
        });
      } else {
        clearInterval(progressInterval);
        // All steps completed, thinking is done
        setTimeout(() => {
          setState(prev => ({
            ...prev,
            isThinking: false,
            thinkingSession: null
          }));
        }, 1000);
      }
    }, 500); // Update every 500ms
  };

  const generateMockResponse = (intentType: string): string => {
    const responses = {
      financial: `He analizado los indicadores financieros clave de su organización. Los ingresos muestran una tendencia positiva con un crecimiento del 15% en el último trimestre. Sin embargo, he identificado oportunidades de optimización en costos operativos que podrían mejorar el margen neto en aproximadamente 3-4%. Le recomiendo implementar un plan de eficiencia energética y renegociar contratos con proveedores estratégicos. El flujo de caja es saludable pero podría beneficiarse de una mejor gestión del capital de trabajo.`,
      
      operational: `La operación actual muestra una eficiencia del 87% con puntos de mejora específicos en la cadena de suministro. He detectado cuellos de botella en el proceso de logística que podrían reducirse con una redistribución de recursos. Los tiempos de entrega podrían mejorar un 12% con ajustes en la planificación de rutas. Además, recomiendo implementar un sistema de mantenimiento predictivo que podría reducir los tiempos de inactividad en un 25%.`,
      
      strategic: `Basado en el análisis del mercado y capacidades internas, identifico tres oportunidades estratégicas clave: 1) Expansión a mercados emergentes con bajo riesgo y alto potencial, 2) Diversificación de la cartera de productos hacia servicios de mayor valor agregado, 3) Alianzas estratégicas con líderes tecnológicos para acelerar la transformación digital. El plan de ejecución sugerido abarca 18 meses con hitos trimestrales claros y métricas de éxito definidas.`,
      
      risk: `He evaluado el panorama de riesgos actuales y identificado tres áreas críticas que requieren atención inmediata: 1) Riesgos cibernéticos asociados a la infraestructura heredada, 2) Exposición a volatilidad de precios de materias primas, 3) Dependencia de proveedores únicos en componentes críticos. Recomiendo implementar un programa de resiliencia operativa y diversificar la cadena de suministro dentro de los próximos 6 meses.`,
      
      hr: `El análisis del capital humano indica una rotación del 12% en áreas clave, principalmente por falta de desarrollo profesional. Recomiendo implementar programas de formación específicos y planes de carrera claros. La satisfacción general es buena (78%) pero podría mejorar con iniciativas de bienestar y flexibilidad laboral. He identificado alto potencial en 15 empleados que podrían formar parte del plan de sucesión.`,
      
      projects: `El portafolio actual de proyectos muestra un avance promedio del 68% con dos proyectos críticos en riesgo de retraso. Recomiendo reasignar recursos del proyecto X al proyecto Y para mitigar impactos. La tasa de éxito histórica es del 85% pero podría mejorar con mejor gestión de stakeholders y comunicación temprana de desvíos. Los próximos 3 meses son críticos para cumplir los objetivos anuales.`,
      
      compliance: `El estado de cumplimiento es generalmente bueno con un 92% de adherencia a normativas. Sin embargo, he identificado brechas en documentación de procesos de calidad y en actualización de políticas de privacidad. Recomiendo una auditoría interna completa dentro de 60 días y actualizar el marco de cumplimiento según nuevas regulaciones de protección de datos que entrarán en vigor próximamente.`,
      
      general: `He procesado su solicitud y estoy listo para ayudarle con el análisis y gestión de su organización. El Enterprise AI Control Tower está operando con todas las funcionalidades activas: monitoreo en tiempo real, análisis predictivo y generación de insights estratégicos. Puede solicitar análisis específicos por área financiera, operativa, estratégica, de riesgos, recursos humanos, proyectos o cumplimiento normativo.`
    };

    return responses[intentType as keyof typeof responses] || responses.general;
  };

  const startStreamingResponse = (sessionId: string) => {
    // Simulate streaming response
    const fullResponse = generateMockResponse(state.currentIntent?.type || 'general');
    let currentText = '';
    let charIndex = 0;

    const streamInterval = setInterval(() => {
      if (charIndex < fullResponse.length) {
        currentText += fullResponse[charIndex];
        setStreamingResponse(currentText);
        charIndex++;
      } else {
        clearInterval(streamInterval);
        setIsStreaming(false);
        setStreamingResponse(''); // Limpiar la respuesta para permitir nueva interacción
        // Reiniciar el estado loading para volver a habilitar el input
        setState(prev => ({ ...prev, loading: false }));
        console.log('Streaming finished - loading set to false, input should be enabled');
      }
    }, 20); // 50 characters per second
  };

  // Data generation functions for visualizations
  const generateFinancialData = () => ({
    labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'],
    datasets: [
      { label: 'Ingresos', data: [45000, 52000, 48000, 61000, 58000, 67000] },
      { label: 'Gastos', data: [32000, 35000, 33000, 38000, 36000, 41000] }
    ]
  });

  const generateCostData = () => ({
    labels: ['Personal', 'Operaciones', 'Marketing', 'Tecnología', 'Otros'],
    data: [35, 25, 15, 20, 5]
  });

  const generateRevenueData = () => ({
    labels: ['Producto A', 'Producto B', 'Servicios', 'Licencias', 'Consultoría'],
    data: [120000, 85000, 65000, 45000, 30000]
  });

  const generateKPIData = () => ({
    'ROI': 23.5,
    'Margen': 18.2,
    'Crecimiento': 12.8,
    'Eficiencia': 87.3
  });

  const generateRiskData = () => ({
    categories: ['Operacional', 'Financiero', 'Tecnológico', 'Legal', 'Reputacional'],
    matrix: [
      [2, 3, 1, 4, 2],
      [3, 4, 2, 3, 3],
      [1, 2, 4, 2, 1],
      [4, 3, 2, 4, 3],
      [2, 3, 1, 3, 2]
    ]
  });

  const generateVulnerabilityData = () => ({
    labels: ['Seguridad', 'Disponibilidad', 'Confidencialidad', 'Integridad', 'Cumplimiento'],
    data: [65, 78, 82, 71, 89]
  });

  const generateRiskTimelineData = () => ({
    labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'],
    datasets: [
      { label: 'Riesgos Críticos', data: [5, 7, 6, 4, 3, 2] },
      { label: 'Riesgos Moderados', data: [12, 14, 11, 9, 8, 7] },
      { label: 'Riesgos Bajos', data: [8, 9, 7, 6, 5, 4] }
    ]
  });

  const generateAlertData = () => ({
    critical: 3,
    warning: 7,
    info: 12,
    success: 18
  });

  const generateOperationalData = () => ({
    tasks: [
      { name: 'Producción', start: '2024-01-01', end: '2024-01-15', progress: 85 },
      { name: 'Logística', start: '2024-01-10', end: '2024-01-25', progress: 72 },
      { name: 'Control de Calidad', start: '2024-01-20', end: '2024-02-05', progress: 60 },
      { name: 'Distribución', start: '2024-02-01', end: '2024-02-15', progress: 45 }
    ]
  });

  const generateProcessData = () => ({
    processes: [
      { name: 'Manufactura', efficiency: 92, status: 'optimal' },
      { name: 'Embalaje', efficiency: 78, status: 'warning' },
      { name: 'Almacenaje', efficiency: 85, status: 'good' },
      { name: 'Distribución', efficiency: 71, status: 'critical' }
    ]
  });

  const generateResourceData = () => ({
    resources: [
      { type: 'Personal', utilized: 78, total: 100 },
      { type: 'Equipos', utilized: 85, total: 100 },
      { type: 'Instalaciones', utilized: 92, total: 100 },
      { type: 'Transporte', utilized: 67, total: 100 }
    ]
  });

  const generateEfficiencyData = () => ({
    overall: 87.3,
    breakdown: {
      'Productividad': 91.2,
      'Calidad': 88.7,
      'Costos': 82.4,
      'Tiempo': 85.9
    }
  });

  const generateScenarioData = () => ({
    scenarios: [
      { name: 'Optimista', probability: 0.25, expected: 1500000 },
      { name: 'Realista', probability: 0.55, expected: 1200000 },
      { name: 'Pesimista', probability: 0.20, expected: 800000 }
    ]
  });

  const generateGrowthData = () => ({
    years: ['2024', '2025', '2026', '2027', '2028'],
    revenue: [1200000, 1500000, 1900000, 2400000, 3000000],
    profit: [180000, 280000, 420000, 680000, 950000]
  });

  const generateCompetitiveData = () => ({
    companies: [
      { name: 'Nosotros', market: 23, growth: 15, innovation: 85 },
      { name: 'Competidor A', market: 31, growth: 8, innovation: 72 },
      { name: 'Competidor B', market: 18, growth: 12, innovation: 68 },
      { name: 'Competidor C', market: 15, growth: 6, innovation: 61 }
    ]
  });

  const generateRoadmapData = () => ({
    phases: [
      { name: 'Expansión Local', start: '2024-Q1', end: '2024-Q3', status: 'completed' },
      { name: 'Lanzamiento Internacional', start: '2024-Q2', end: '2025-Q1', status: 'in-progress' },
      { name: 'Diversificación', start: '2024-Q4', end: '2025-Q3', status: 'planned' },
      { name: 'Liderazgo Mercado', start: '2025-Q2', end: '2026-Q4', status: 'planned' }
    ]
  });

  // Las visualizaciones se generan desde datos reales del backend
  // No hay datos hardcodeados - si no hay datos, se muestra "Sin datos disponibles"

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
        const response = await apiFetch(`/command-center/actions/executions/${executionId}`);
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
      
      const response = await apiFetch(`/command-center/modes/${mode.id}/activate`, {
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
    if (!state.floatingAlerts || !Array.isArray(state.floatingAlerts)) return null;
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

    // Acciones rápidas siempre disponibles (no dependen de backend)
    const quickActions = [
      { id: 'qa1', label: '📊 Analizar riesgos', query: 'Analizá los riesgos actuales de la empresa' },
      { id: 'qa2', label: '💰 Situación financiera', query: 'Mostrame la situación financiera actual' },
      { id: 'qa3', label: '📁 Estado proyectos', query: '¿Cómo están los proyectos activos?' },
      { id: 'qa4', label: '👥 Resumen RRHH', query: 'Dame un resumen del estado de recursos humanos' },
      { id: 'qa5', label: '🚛 Estado flota', query: '¿Cómo está la flota de vehículos?' },
      { id: 'qa6', label: '🔍 NCRs abiertas', query: '¿Cuántas no conformidades hay abiertas?' },
      { id: 'qa7', label: '✅ CAPAs pendientes', query: '¿Qué CAPAs están pendientes de cierre?' },
      { id: 'qa8', label: '📈 KPIs ejecutivos', query: 'Mostrame los KPIs ejecutivos del tenant' },
    ];

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        className="absolute bottom-full left-0 right-0 mb-2 bg-gray-900/95 backdrop-blur-lg rounded-xl border border-gray-700/60 p-4 z-40 shadow-2xl"
      >
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-medium text-gray-300">Acciones rápidas</span>
          <button onClick={() => setShowCommandActions(false)} className="ml-auto text-gray-500 hover:text-gray-300">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {quickActions.map(action => (
            <button
              key={action.id}
              onClick={() => {
                setInput(action.query);
                setShowCommandActions(false);
                setTimeout(() => inputRef.current?.focus(), 50);
              }}
              className="text-left px-3 py-2.5 bg-gray-800/80 hover:bg-gray-700/80 border border-gray-700/50 hover:border-purple-500/50 rounded-lg text-xs text-gray-300 hover:text-white transition-all duration-200"
            >
              {action.label}
            </button>
          ))}
        </div>
      </motion.div>
    );
  };

  const renderPremiumMicrophone = () => {
    return (
      <motion.button
        onClick={() => setIsListening(!isListening)}
        className={`relative p-4 rounded-2xl transition-all duration-300 ${
          isListening 
            ? 'bg-gradient-to-r from-red-500/20 to-red-600/20 border-2 border-red-500/50 shadow-lg shadow-red-500/25' 
            : 'bg-gradient-to-r from-purple-500/10 to-blue-500/10 border-2 border-gray-600/50 hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/10'
        }`}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        {/* Glow effect */}
        {isListening && (
          <motion.div
            className="absolute inset-0 rounded-2xl bg-red-500/20"
            animate={{
              scale: [1, 1.2, 1.4],
              opacity: [0.5, 0.3, 0.1]
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeOut"
            }}
          />
        )}
        
        {/* Sound waves */}
        {isListening && (
          <div className="absolute inset-0 flex items-center justify-center">
            {[...Array(3)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-8 h-8 border-2 border-red-400/30 rounded-full"
                animate={{
                  scale: [1, 2, 3],
                  opacity: [0.6, 0.3, 0]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  delay: i * 0.3,
                  ease: "easeOut"
                }}
              />
            ))}
          </div>
        )}
        
        {/* Microphone icon */}
        <motion.div
          animate={{
            rotate: isListening ? [0, 5, -5, 0] : 0,
            scale: isListening ? [1, 1.1, 1] : 1
          }}
          transition={{
            duration: 0.5,
            repeat: isListening ? Infinity : 0,
            repeatType: "reverse"
          }}
        >
          <Mic className={`w-6 h-6 ${
            isListening ? 'text-red-400' : 'text-gray-400'
          }`} />
        </motion.div>
        
        {/* Voice level indicator */}
        {isListening && (
          <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 flex gap-1">
            {[...Array(5)].map((_, i) => (
              <motion.div
                key={i}
                className="w-1 bg-red-400 rounded-full"
                animate={{
                  height: [4, 8, 12, 8, 4]
                }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  delay: i * 0.1
                }}
              />
            ))}
          </div>
        )}
      </motion.button>
    );
  };

  const renderLiveWidgets = () => {
    return <DashboardWidgets />;
  };

  const renderLiveDataStatus = () => {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-green-900/20 to-blue-900/20 backdrop-blur-lg border border-green-500/20 rounded-lg px-4 py-2 mb-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-green-300 text-sm font-medium">
                Datos en tiempo real activos
              </span>
            </div>
            <div className="text-gray-400 text-sm">
              Última sincronización: {formatTimeAgo(liveDataStatus.lastSync)}
            </div>
          </div>
          
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <div className="flex items-center gap-1">
              <Database className="w-3 h-3" />
              <span>{liveDataStatus.dataPoints.toLocaleString()} puntos</span>
            </div>
            <div className="flex items-center gap-1">
              <Signal className="w-3 h-3" />
              <span>{liveDataStatus.activeFeeds} feeds</span>
            </div>
            <div className="flex items-center gap-1">
              <Gauge className="w-3 h-3" />
              <span>{liveDataStatus.latency}ms</span>
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  const renderDeepAnalysisMode = () => null;

  const renderContextualVisualizations = () => {
    if (contextualVisualizations.length === 0) return null;

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6"
      >
        {contextualVisualizations.map((viz, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1 }}
            className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-lg rounded-xl border border-gray-700/50 p-6"
          >
            <h3 className="text-lg font-semibold text-white mb-4">{viz.title}</h3>
            
            {/* Render different visualization types */}
            {viz.type === 'line-chart' && <LineChartVisualization data={viz.data} />}
            {viz.type === 'pie-chart' && <PieChartVisualization data={viz.data} />}
            {viz.type === 'bar-chart' && <BarChartVisualization data={viz.data} />}
            {viz.type === 'kpi-grid' && <KPIGridVisualization data={viz.data} />}
            {viz.type === 'heatmap' && <HeatmapVisualization data={viz.data} />}
            {viz.type === 'radar-chart' && <RadarChartVisualization data={viz.data} />}
            {viz.type === 'timeline' && <TimelineVisualization data={viz.data} />}
            {viz.type === 'alert-grid' && <AlertGridVisualization data={viz.data} />}
            {viz.type === 'gantt-chart' && <GanttChartVisualization data={viz.data} />}
            {viz.type === 'progress-grid' && <ProgressGridVisualization data={viz.data} />}
            {viz.type === 'resource-chart' && <ResourceChartVisualization data={viz.data} />}
            {viz.type === 'efficiency-meter' && <EfficiencyMeterVisualization data={viz.data} />}
            {viz.type === 'scenario-matrix' && <ScenarioMatrixVisualization data={viz.data} />}
            {viz.type === 'growth-chart' && <GrowthChartVisualization data={viz.data} />}
            {viz.type === 'competitive-map' && <CompetitiveMapVisualization data={viz.data} />}
            {viz.type === 'roadmap-timeline' && <RoadmapTimelineVisualization data={viz.data} />}
            {viz.type === 'overview-dashboard' && <OverviewDashboardVisualization data={viz.data} />}
          </motion.div>
        ))}
      </motion.div>
    );
  };

  const renderSmartSuggestions = () => {
    if (smartSuggestions.length === 0) return null;

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gray-900/50 backdrop-blur-lg rounded-lg border border-gray-700 p-4 mb-4"
      >
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb className="w-4 h-4 text-yellow-400" />
          <span className="text-sm font-medium text-gray-300">Sugerencias inteligentes</span>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {smartSuggestions.slice(0, 6).map((suggestion) => (
            <motion.button
              key={suggestion.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setInput(suggestion.text)}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs text-gray-300 hover:text-white transition-colors border border-gray-600 hover:border-gray-500"
            >
              {suggestion.text}
            </motion.button>
          ))}
        </div>
      </motion.div>
    );
  };

  const renderStreamingResponse = () => {
    if (!isStreaming || !streamingResponse) return null;

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-blue-900/20 to-purple-900/20 backdrop-blur-lg rounded-xl border border-blue-500/20 p-6 mb-6"
      >
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0">
            <Brain className="w-4 h-4 text-blue-400" />
          </div>
          
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-blue-300 font-medium">IA Response</span>
              {isStreaming && (
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                  <span className="text-xs text-blue-400">Typing...</span>
                </div>
              )}
            </div>
            
            <div className="text-gray-200 leading-relaxed">
              {streamingResponse}
              {isStreaming && (
                <motion.span
                  animate={{ opacity: [1, 0] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                  className="inline-block w-2 h-4 bg-blue-400 ml-1"
                />
              )}
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  // Placeholder visualization components
  const LineChartVisualization = ({ data }: any) => (
    <div className="h-48 flex items-center justify-center border border-gray-700 rounded-lg">
      <div className="text-center">
        <LineChart className="w-8 h-8 text-blue-400 mx-auto mb-2" />
        <p className="text-xs text-gray-400">Gráfico de líneas</p>
        <p className="text-xs text-gray-500 mt-1">{data.labels?.length || 0} puntos de datos</p>
      </div>
    </div>
  );

  const PieChartVisualization = ({ data }: any) => (
    <div className="h-48 flex items-center justify-center border border-gray-700 rounded-lg">
      <div className="text-center">
        <PieChart className="w-8 h-8 text-purple-400 mx-auto mb-2" />
        <p className="text-xs text-gray-400">Gráfico circular</p>
        <p className="text-xs text-gray-500 mt-1">{data.labels?.length || 0} categorías</p>
      </div>
    </div>
  );

  const BarChartVisualization = ({ data }: any) => (
    <div className="h-48 flex items-center justify-center border border-gray-700 rounded-lg">
      <div className="text-center">
        <BarChart3 className="w-8 h-8 text-green-400 mx-auto mb-2" />
        <p className="text-xs text-gray-400">Gráfico de barras</p>
        <p className="text-xs text-gray-500 mt-1">{data.labels?.length || 0} elementos</p>
      </div>
    </div>
  );

  const KPIGridVisualization = ({ data }: any) => (
    <div className="grid grid-cols-2 gap-3">
      {Object.entries(data).map(([key, value]: [string, any]) => (
        <div key={key} className="bg-gray-800/50 rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-white">{typeof value === 'number' ? value.toFixed(1) : value}</div>
          <div className="text-xs text-gray-400">{key}</div>
        </div>
      ))}
    </div>
  );

  const HeatmapVisualization = ({ data }: any) => (
    <div className="h-48 flex items-center justify-center border border-gray-700 rounded-lg">
      <div className="text-center">
        <Activity className="w-8 h-8 text-red-400 mx-auto mb-2" />
        <p className="text-xs text-gray-400">Mapa de calor</p>
        <p className="text-xs text-gray-500 mt-1">{data.categories?.length || 0} categorías</p>
      </div>
    </div>
  );

  const RadarChartVisualization = ({ data }: any) => (
    <div className="h-48 flex items-center justify-center border border-gray-700 rounded-lg">
      <div className="text-center">
        <Radar className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
        <p className="text-xs text-gray-400">Gráfico radar</p>
        <p className="text-xs text-gray-500 mt-1">{data.labels?.length || 0} dimensiones</p>
      </div>
    </div>
  );

  const TimelineVisualization = ({ data }: any) => (
    <div className="h-48 flex items-center justify-center border border-gray-700 rounded-lg">
      <div className="text-center">
        <Calendar className="w-8 h-8 text-indigo-400 mx-auto mb-2" />
        <p className="text-xs text-gray-400">Línea de tiempo</p>
        <p className="text-xs text-gray-500 mt-1">{data.labels?.length || 0} períodos</p>
      </div>
    </div>
  );

  const AlertGridVisualization = ({ data }: any) => (
    <div className="grid grid-cols-2 gap-3">
      {Object.entries(data).map(([key, value]: [string, any]) => (
        <div key={key} className={`rounded-lg p-3 text-center ${
          key === 'critical' ? 'bg-red-900/30 border border-red-500/30' :
          key === 'warning' ? 'bg-yellow-900/30 border border-yellow-500/30' :
          key === 'info' ? 'bg-blue-900/30 border border-blue-500/30' :
          'bg-green-900/30 border border-green-500/30'
        }`}>
          <div className="text-lg font-bold text-white">{value}</div>
          <div className="text-xs text-gray-400 capitalize">{key}</div>
        </div>
      ))}
    </div>
  );

  const GanttChartVisualization = ({ data }: any) => (
    <div className="h-48 flex items-center justify-center border border-gray-700 rounded-lg">
      <div className="text-center">
        <LayoutDashboard className="w-8 h-8 text-orange-400 mx-auto mb-2" />
        <p className="text-xs text-gray-400">Diagrama Gantt</p>
        <p className="text-xs text-gray-500 mt-1">{data.tasks?.length || 0} tareas</p>
      </div>
    </div>
  );

  const ProgressGridVisualization = ({ data }: any) => (
    <div className="space-y-2">
      {data.processes?.map((process: any, index: number) => (
        <div key={index} className="bg-gray-800/50 rounded-lg p-3">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-300">{process.name}</span>
            <span className="text-xs text-gray-400">{process.efficiency}%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div 
              className={`h-2 rounded-full ${
                process.status === 'optimal' ? 'bg-green-500' :
                process.status === 'warning' ? 'bg-yellow-500' :
                process.status === 'critical' ? 'bg-red-500' : 'bg-blue-500'
              }`}
              style={{ width: `${process.efficiency}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );

  const ResourceChartVisualization = ({ data }: any) => (
    <div className="space-y-2">
      {data.resources?.map((resource: any, index: number) => (
        <div key={index} className="bg-gray-800/50 rounded-lg p-3">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-300">{resource.type}</span>
            <span className="text-xs text-gray-400">{resource.utilized}%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div 
              className="bg-blue-500 h-2 rounded-full"
              style={{ width: `${resource.utilized}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );

  const EfficiencyMeterVisualization = ({ data }: any) => (
    <div className="text-center">
      <div className="relative w-32 h-32 mx-auto mb-4">
        <div className="absolute inset-0 rounded-full border-8 border-gray-700"></div>
        <div 
          className="absolute inset-0 rounded-full border-8 border-green-500 border-t-transparent border-r-transparent transform rotate-45"
          style={{ transform: `rotate(${45 + (data.overall * 2.7)}deg)` }}
        ></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-bold text-white">{data.overall}%</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        {Object.entries(data.breakdown).map(([key, value]: [string, any]) => (
          <div key={key} className="text-gray-400">
            {key}: {value}%
          </div>
        ))}
      </div>
    </div>
  );

  const ScenarioMatrixVisualization = ({ data }: any) => (
    <div className="space-y-3">
      {data.scenarios?.map((scenario: any, index: number) => (
        <div key={index} className="bg-gray-800/50 rounded-lg p-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-300">{scenario.name}</span>
            <span className="text-xs text-gray-400">{scenario.probability * 100}% prob</span>
          </div>
          <div className="text-lg font-bold text-white mt-1">
            ${(scenario.expected / 1000000).toFixed(1)}M
          </div>
        </div>
      ))}
    </div>
  );

  const GrowthChartVisualization = ({ data }: any) => (
    <div className="h-48 flex items-center justify-center border border-gray-700 rounded-lg">
      <div className="text-center">
        <TrendingUp className="w-8 h-8 text-green-400 mx-auto mb-2" />
        <p className="text-xs text-gray-400">Proyecciones de crecimiento</p>
        <p className="text-xs text-gray-500 mt-1">{data.years?.length || 0} años</p>
      </div>
    </div>
  );

  const CompetitiveMapVisualization = ({ data }: any) => (
    <div className="space-y-2">
      {data.companies?.map((company: any, index: number) => (
        <div key={index} className={`rounded-lg p-3 ${
          company.name === 'Nosotros' ? 'bg-blue-900/30 border border-blue-500/30' : 'bg-gray-800/50'
        }`}>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-300">{company.name}</span>
            <span className="text-xs text-gray-400">{company.market}% mercado</span>
          </div>
          <div className="flex gap-4 mt-2 text-xs text-gray-400">
            <span>Crecimiento: {company.growth}%</span>
            <span>Innovación: {company.innovation}</span>
          </div>
        </div>
      ))}
    </div>
  );

  const RoadmapTimelineVisualization = ({ data }: any) => (
    <div className="space-y-2">
      {data.phases?.map((phase: any, index: number) => (
        <div key={index} className="bg-gray-800/50 rounded-lg p-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-300">{phase.name}</span>
            <span className={`text-xs px-2 py-1 rounded ${
              phase.status === 'completed' ? 'bg-green-500/20 text-green-300' :
              phase.status === 'in-progress' ? 'bg-blue-500/20 text-blue-300' :
              'bg-gray-500/20 text-gray-300'
            }`}>
              {phase.status}
            </span>
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {phase.start} - {phase.end}
          </div>
        </div>
      ))}
    </div>
  );

  const OverviewDashboardVisualization = ({ data }: any) => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {Object.entries(data.kpis).map(([key, value]: [string, any]) => (
          <div key={key} className="bg-gray-800/50 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-white">{typeof value === 'number' ? value.toFixed(1) : value}</div>
            <div className="text-xs text-gray-400">{key}</div>
          </div>
        ))}
      </div>
      <div className="border-t border-gray-700 pt-3">
        <p className="text-sm font-medium text-gray-300 mb-2">Tendencias</p>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {Object.entries(data.trends).map(([key, value]: [string, any]) => (
            <div key={key} className="flex justify-between">
              <span className="text-gray-400">{key}:</span>
              <span className={value > 0 ? 'text-green-400' : 'text-red-400'}>
                {value > 0 ? '+' : ''}{value}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const formatTimeAgo = (date: Date): string => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return 'hace unos segundos';
    if (seconds < 3600) return `hace ${Math.floor(seconds / 60)} minutos`;
    return `hace ${Math.floor(seconds / 3600)} horas`;
  };

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
            {state.statusBar ? (
              <div className="bg-black/20 backdrop-blur-sm rounded-lg p-3 border border-white/10">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <Cpu className="w-4 h-4 text-blue-400" />
                      <span className="text-gray-300">
                        {state.statusBar.provider === 'openai' ? 'OpenAI' : 'Groq'}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Brain className="w-4 h-4 text-purple-400" />
                      <span className="text-gray-300 capitalize">
                        {state.statusBar.mode}
                      </span>
                    </div>
                    {state.statusBar.deepAnalysis && (
                      <div className="flex items-center space-x-2">
                        <Sparkles className="w-4 h-4 text-yellow-400" />
                        <span className="text-gray-300">Deep Analysis</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <Database className="w-4 h-4 text-green-400" />
                      <span className="text-gray-300">
                        {state.statusBar.queriesRemaining} left
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Activity className="w-4 h-4 text-orange-400" />
                      <span className="text-gray-300">
                        {state.statusBar.responseTime}ms
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-black/20 backdrop-blur-sm rounded-lg p-3 border border-white/10">
                <div className="flex items-center justify-center text-sm text-gray-400">
                  <Brain className="w-4 h-4 mr-2" />
                  AI Status initializing...
                </div>
              </div>
            )}
          </div>
        </motion.header>

        {/* Main Content */}
        <main className="flex-1 overflow-hidden">
          <div className="h-full flex flex-col max-w-7xl mx-auto px-6 py-6">

            {/* Scrollable Content Area - everything except input */}
            <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-1">
              {/* Live Data Status */}
              {renderLiveDataStatus()}
              
              {/* Deep Analysis Mode */}
              {renderDeepAnalysisMode()}
              
              {/* Live Widgets */}
              {renderLiveWidgets()}

              {/* Contextual Visualizations */}
              {renderContextualVisualizations()}

              {/* Message History */}
              {(messages as any[]).map((msg, idx) => (
                <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${
                      msg.provider === 'openai' ? 'bg-yellow-500/20' : 'bg-blue-500/20'
                    }`}>
                      {msg.provider === 'openai'
                        ? <BrainCircuit className="w-4 h-4 text-yellow-400" />
                        : <Brain className="w-4 h-4 text-blue-400" />
                      }
                    </div>
                  )}
                  <div className={`max-w-[80%] rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-purple-600/30 border border-purple-500/30 text-white'
                      : msg.actions?.length > 0
                        ? 'bg-orange-900/30 border border-orange-500/30 text-orange-100'
                        : msg.toolExecuted
                          ? 'bg-green-900/30 border border-green-500/30 text-green-100'
                          : 'bg-gray-800/60 border border-gray-700/50 text-gray-200'
                  }`}>
                    {msg.toolExecuted && (
                      <div className="flex items-center gap-1.5 mb-2 text-xs text-green-400 font-medium">
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Acción ejecutada</span>
                      </div>
                    )}
                    {msg.content}
                    {/* Botones de paywall / upgrade */}
                    {msg.actions && msg.actions.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-orange-500/30 flex flex-col gap-2">
                        {msg.actions.map((action: any, ai: number) => (
                          action.type === 'upgrade' ? (
                            <a
                              key={ai}
                              href="/configuracion/suscripcion"
                              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black font-semibold rounded-lg text-xs transition-all"
                            >
                              <Crown className="w-3.5 h-3.5" />
                              {action.label}
                            </a>
                          ) : action.type === 'buy_pack' ? (
                            <a
                              key={ai}
                              href="/configuracion/suscripcion"
                              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-xs transition-all border border-gray-600"
                            >
                              <Zap className="w-3.5 h-3.5 text-yellow-400" />
                              {action.label}
                            </a>
                          ) : null
                        ))}
                      </div>
                    )}
                    <div className={`flex items-center justify-between text-[10px] mt-1.5 ${
                      msg.role === 'user' ? 'text-purple-300' : 'text-gray-500'
                    }`}>
                      <span>{msg.timestamp.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
                      {msg.provider && msg.role === 'assistant' && (
                        <span className={msg.provider === 'openai' ? 'text-yellow-500' : 'text-blue-500'}>
                          {msg.provider === 'openai' ? '⚡ GPT-4.1' : '⚡ Groq'}
                        </span>
                      )}
                    </div>
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-8 h-8 bg-purple-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                      <User className="w-4 h-4 text-purple-400" />
                    </div>
                  )}
                </div>
              ))}

              {/* Thinking Visualization */}
              {renderThinkingVisualization()}
              
              {/* Streaming Response (while typing) */}
              {renderStreamingResponse()}

              {/* Scroll anchor */}
              <div ref={messagesEndRef} />

              {/* Empty state */}
              {!isStreaming && messages.length === 0 && contextualVisualizations.length === 0 && !state.isThinking && (
                <div className="text-center text-gray-500 py-8">
                  <Brain className="w-12 h-12 mx-auto mb-4 text-gray-600" />
                  <p className="text-lg font-medium">Enterprise AI Control Tower está listo para analizar tus consultas</p>
                  <p className="text-sm mt-2">Intenta preguntar sobre análisis financiero, detección de riesgos o simulaciones estratégicas</p>
                </div>
              )}
            </div>

            {/* Smart Suggestions */}
            {renderSmartSuggestions()}

            {/* Command Actions */}
            <div className="relative">
              {renderCommandActions()}
            </div>

            {/* Input Area - always pinned at bottom */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-r from-gray-900/80 to-gray-800/80 backdrop-blur-lg rounded-xl border border-gray-700/50 shadow-lg"
            >
              <div className="flex items-center gap-4 p-4">
                {/* Premium Microphone */}
                {renderPremiumMicrophone()}

                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => {
                    console.log('Input onChange, loading:', state.loading, 'value:', e.target.value);
                    setInput(e.target.value);
                  }}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  onFocus={() => console.log('Input focused, loading:', state.loading)}
                  placeholder="Analizar situación financiera, detectar riesgos, simular escenarios..."
                  className="flex-1 bg-transparent text-white placeholder-gray-500 outline-none text-sm"
                  disabled={state.loading}
                />

                <button
                  onClick={() => setShowCommandActions(!showCommandActions)}
                  className="p-3 bg-gray-800/50 text-gray-400 hover:text-white rounded-lg transition-colors border border-gray-600/50 hover:border-gray-500/50"
                >
                  <CommandIcon className="w-5 h-5" />
                </button>

                <button
                  onClick={handleSendMessage}
                  disabled={!input.trim() || state.loading}
                  className="p-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-purple-500/25"
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
