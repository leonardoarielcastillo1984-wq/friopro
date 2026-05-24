'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, Mic, Send, Sparkles, Zap, LayoutGrid, TrendingUp,
  AlertTriangle, Target, Briefcase, Users, DollarSign, 
  ChevronRight, Crown, X, MoreHorizontal, Loader2,
  Command as CommandIcon, Radar, Activity
} from 'lucide-react';

// ============================================================
// TIPOS
// ============================================================

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  widgets?: AIWidget[];
  actions?: AIAction[];
  provider?: 'groq' | 'openai';
}

interface AIWidget {
  type: 'kpi' | 'table' | 'alert' | 'info' | 'progress' | 'status' | 'chart';
  title: string;
  data: any;
  config?: Record<string, any>;
}

interface AIAction {
  type: string;
  label: string;
  icon?: string;
  route?: string;
  payload?: any;
  requiresConfirmation?: boolean;
}

interface AISubscription {
  plan: 'STARTER_AI' | 'BUSINESS_AI' | 'ENTERPRISE_AI' | null;
  status: 'active' | 'inactive' | 'suspended';
  premiumQueriesLimit: number;
  premiumQueriesUsed: number;
  premiumQueriesRemaining: number;
  groqEnabled: boolean;
  openaiEnabled: boolean;
  resetDate: Date;
}

interface Suggestion {
  category: string;
  queries: string[];
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

export default function CommandCenterPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [subscription, setSubscription] = useState<AISubscription | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [streamingMessage, setStreamingMessage] = useState('');
  const [activeWidgets, setActiveWidgets] = useState<AIWidget[]>([]);
  const [showPaywall, setShowPaywall] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll al final de mensajes
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage, scrollToBottom]);

  // Cargar suscripción y sugerencias al inicio
  useEffect(() => {
    loadSubscription();
    loadSuggestions();
    
    // Mensaje de bienvenida
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: '¡Bienvenido al Command Center de SGI360. Soy tu asistente ejecutivo inteligente. Puedo ayudarte a analizar proyectos, detectar riesgos, consultar KPIs y tomar decisiones estratégicas. ¿Qué información necesitas?',
        timestamp: new Date(),
        provider: 'groq'
      }
    ]);

    // Event listener para consultas de capacidades
    const handleCapabilityQuery = (event: CustomEvent) => {
      sendMessage(event.detail);
    };

    window.addEventListener('sendCapabilityQuery', handleCapabilityQuery as EventListener);
    
    return () => {
      window.removeEventListener('sendCapabilityQuery', handleCapabilityQuery as EventListener);
    };
  }, []);

  const loadSubscription = async () => {
    try {
      const res = await apiFetch('/command-center/subscription') as any;
      setSubscription(res.data);
    } catch (e) {
      console.error('Error loading subscription:', e);
    }
  };

  const loadSuggestions = async () => {
    try {
      const res = await apiFetch('/command-center/suggestions') as any;
      setSuggestions(res.data || []);
    } catch (e) {
      console.error('Error loading suggestions:', e);
    }
  };

  // ============================================================
  // ENVÍO DE MENSAJE
  // ============================================================

  const sendMessage = async (text: string, useVoice = false) => {
    if (!text.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setShowSuggestions(false);
    setStreamingMessage('');

    try {
      const res = await apiFetch('/command-center/query', {
        method: 'POST',
        json: { query: text, stream: false }
      }) as any;

      if (res.data?.actions?.some((a: AIAction) => a.type === 'upgrade')) {
        setShowPaywall(true);
      }

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: res.data?.summary || 'Lo siento, no pude procesar tu consulta.',
        timestamp: new Date(),
        widgets: res.data?.widgets,
        actions: res.data?.actions,
        provider: res.data?.provider
      };

      setMessages(prev => [...prev, assistantMessage]);
      
      if (res.data?.widgets) {
        setActiveWidgets(res.data.widgets);
      }

      // Recargar suscripción para actualizar contadores
      loadSubscription();

    } catch (error: any) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Lo siento, ocurrió un error al procesar tu consulta. Por favor intenta nuevamente.',
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  // ============================================================
  // VOZ (PLACEHOLDER)
  // ============================================================

  const toggleVoice = () => {
    if (isListening) {
      setIsListening(false);
      // Aquí se detendría la grabación
    } else {
      setIsListening(true);
      // Simular reconocimiento de voz
      setTimeout(() => {
        setIsListening(false);
        sendMessage('Proyectos en riesgo'); // Placeholder
      }, 3000);
    }
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Header Premium */}
      <header className="border-b border-white/10 bg-slate-950/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-xl blur-lg opacity-50" />
                <div className="relative p-2.5 bg-gradient-to-br from-violet-600 to-fuchsia-600 rounded-xl">
                  <Brain className="w-6 h-6 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                  Command Center
                </h1>
                <p className="text-xs text-slate-400">SGI360 Executive Intelligence</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Status de IA */}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-xs text-slate-300">
                  {subscription?.openaiEnabled ? 'GPT-4.1 Ready' : 'Groq Active'}
                </span>
              </div>
              
              {/* Créditos Premium */}
              {subscription && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-full">
                  <Crown className="w-4 h-4 text-amber-400" />
                  <span className="text-xs text-amber-300">
                    {subscription.premiumQueriesRemaining === -1 
                      ? 'Ilimitado' 
                      : `${subscription.premiumQueriesRemaining} consultas`}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Panel Principal - Chat */}
          <div className="lg:col-span-2 space-y-6">
            {/* Área de Mensajes */}
            <div className="min-h-[500px] max-h-[600px] overflow-y-auto rounded-2xl border border-white/10 bg-slate-900/50 backdrop-blur-sm p-6 space-y-4">
              <AnimatePresence>
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
                  >
                    {/* Avatar */}
                    <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
                      message.role === 'user' 
                        ? 'bg-gradient-to-br from-blue-600 to-blue-700' 
                        : 'bg-gradient-to-br from-violet-600 to-fuchsia-600'
                    }`}>
                      {message.role === 'user' ? (
                        <Users className="w-5 h-5 text-white" />
                      ) : (
                        <Sparkles className="w-5 h-5 text-white" />
                      )}
                    </div>
                    
                    {/* Contenido */}
                    <div className={`max-w-[80%] ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
                      <div className={`rounded-2xl px-4 py-3 ${
                        message.role === 'user'
                          ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white'
                          : 'bg-white/5 border border-white/10 text-slate-200'
                      }`}>
                        <p className="text-sm leading-relaxed">{message.content}</p>
                        
                        {/* Widgets */}
                        {message.widgets && message.widgets.length > 0 && (
                          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {message.widgets.map((widget, idx) => (
                              <WidgetCard key={idx} widget={widget} />
                            ))}
                          </div>
                        )}
                        
                        {/* Acciones */}
                        {message.actions && message.actions.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {message.actions.map((action, idx) => (
                              <ActionButton key={idx} action={action} />
                            ))}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 mt-1 px-1">
                        <span className="text-xs text-slate-500">
                          {message.timestamp.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {message.provider && (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            message.provider === 'openai' 
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
                              : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          }`}>
                            {message.provider === 'openai' ? 'GPT-4.1' : 'Groq'}
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              
              {/* Mensaje en streaming */}
              {streamingMessage && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex gap-3"
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-white animate-pulse" />
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 max-w-[80%]">
                    <p className="text-sm text-slate-200">{streamingMessage}</p>
                    <div className="flex gap-1 mt-2">
                      <span className="w-2 h-2 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </motion.div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Input de Chat */}
            <form onSubmit={handleSubmit} className="relative">
              <div className="relative flex items-center gap-2 p-2 rounded-2xl bg-slate-900/80 border border-white/10 backdrop-blur-sm">
                <button
                  type="button"
                  onClick={toggleVoice}
                  className={`p-3 rounded-xl transition-all ${
                    isListening 
                      ? 'bg-red-500/20 text-red-400 animate-pulse' 
                      : 'bg-white/5 text-slate-400 hover:bg-white/10'
                  }`}
                >
                  <Mic className="w-5 h-5" />
                </button>
                
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={isListening ? 'Escuchando...' : 'Escribe tu consulta o comando...'}
                  className="flex-1 bg-transparent border-none outline-none text-white placeholder-slate-500 px-2 py-3"
                  disabled={isLoading || isListening}
                />
                
                <button
                  type="submit"
                  disabled={isLoading || !input.trim()}
                  className="p-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </button>
              </div>
            </form>

            {/* Sugerencias */}
            <AnimatePresence>
              {showSuggestions && messages.length < 3 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-3"
                >
                  <p className="text-sm text-slate-400 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-400" />
                    Consultas sugeridas
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {suggestions.flatMap(s => s.queries.slice(0, 2)).slice(0, 4).map((query, idx) => (
                      <button
                        key={idx}
                        onClick={() => sendMessage(query)}
                        className="text-left p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-violet-500/50 transition-all group"
                      >
                        <p className="text-sm text-slate-300 group-hover:text-white">{query}</p>
                        <ChevronRight className="w-4 h-4 text-slate-500 mt-2 group-hover:text-violet-400" />
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Panel Lateral - Dashboard */}
          <div className="space-y-6">
            {/* Widgets Activos */}
            {activeWidgets.length > 0 && (
              <div className="rounded-2xl border border-white/10 bg-slate-900/50 backdrop-blur-sm p-5">
                <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                  <LayoutGrid className="w-4 h-4 text-violet-400" />
                  Dashboard Contextual
                </h3>
                <div className="space-y-3">
                  {activeWidgets.map((widget, idx) => (
                    <WidgetCard key={idx} widget={widget} compact />
                  ))}
                </div>
              </div>
            )}

            {/* KPIs Rápidos */}
            <div className="rounded-2xl border border-white/10 bg-slate-900/50 backdrop-blur-sm p-5">
              <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                Estado del Sistema
              </h3>
              <div className="space-y-3">
                <KPIRow 
                  icon={<Briefcase className="w-4 h-4" />} 
                  label="Proyectos Activos" 
                  value="12" 
                  trend="+2" 
                  color="blue"
                />
                <KPIRow 
                  icon={<AlertTriangle className="w-4 h-4" />} 
                  label="Alertas Críticas" 
                  value="3" 
                  trend="-1" 
                  color="red"
                />
                <KPIRow 
                  icon={<TrendingUp className="w-4 h-4" />} 
                  label="Cumplimiento" 
                  value="94%" 
                  trend="+3%" 
                  color="emerald"
                />
              </div>
            </div>

            {/* Plan AI */}
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-amber-500/10 to-orange-500/10 backdrop-blur-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-amber-300 flex items-center gap-2">
                  <Crown className="w-4 h-4" />
                  Plan AI
                </h3>
                <span className="text-xs px-2 py-1 bg-amber-500/20 text-amber-300 rounded-full">
                  {subscription?.plan || 'Free'}
                </span>
              </div>
              
              {subscription && subscription.premiumQueriesLimit > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Consultas Premium</span>
                    <span>
                      {subscription.premiumQueriesRemaining === -1 
                        ? 'Ilimitadas' 
                        : `${subscription.premiumQueriesUsed} / ${subscription.premiumQueriesLimit}`}
                    </span>
                  </div>
                  {subscription.premiumQueriesRemaining !== -1 && (
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all"
                        style={{ 
                          width: `${(subscription.premiumQueriesUsed / subscription.premiumQueriesLimit) * 100}%` 
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
              
              <button 
                onClick={() => setShowPaywall(true)}
                className="w-full mt-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-medium rounded-xl hover:opacity-90 transition-all"
              >
                Upgrade Plan
              </button>
            </div>

            {/* Capacidades */}
            <div className="rounded-2xl border border-white/10 bg-slate-900/50 backdrop-blur-sm p-5">
              <h3 className="text-sm font-semibold text-slate-300 mb-4">Capacidades IA</h3>
              <div className="space-y-2">
                <CapabilityItem icon={<Target />} label="Análisis de Proyectos" />
                <CapabilityItem icon={<Radar />} label="Detección de Riesgos" />
                <CapabilityItem icon={<TrendingUp />} label="KPIs y Dashboards" />
                <CapabilityItem icon={<DollarSign />} label="Análisis Financiero" />
                <CapabilityItem icon={<Briefcase />} label="Simulaciones" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Paywall */}
      <AnimatePresence>
        {showPaywall && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="max-w-md w-full rounded-2xl border border-amber-500/30 bg-gradient-to-br from-slate-900 to-slate-950 p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-500/20 rounded-xl">
                    <Crown className="w-6 h-6 text-amber-400" />
                  </div>
                  <h3 className="text-lg font-bold text-white">Límite Alcanzado</h3>
                </div>
                <button 
                  onClick={() => setShowPaywall(false)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-all"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              
              <p className="text-slate-300 mb-6">
                Has alcanzado el límite de consultas avanzadas IA para este período. 
                Actualiza tu plan para continuar usando análisis premium.
              </p>
              
              <div className="space-y-3">
                <button 
                  onClick={() => window.location.href = '/settings/subscription'}
                  className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium rounded-xl hover:opacity-90 transition-all"
                >
                  Upgrade a Business AI
                </button>
                <button 
                  onClick={() => window.location.href = '/settings/subscription'}
                  className="w-full py-3 border border-white/20 text-slate-300 rounded-xl hover:bg-white/5 transition-all"
                >
                  Comprar Pack de Consultas
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================
// COMPONENTES AUXILIARES
// ============================================================

function WidgetCard({ widget, compact = false }: { widget: AIWidget; compact?: boolean }) {
  const bgColors: Record<string, string> = {
    kpi: 'from-blue-500/20 to-blue-600/20 border-blue-500/30',
    alert: 'from-red-500/20 to-orange-500/20 border-red-500/30',
    info: 'from-slate-500/20 to-slate-600/20 border-slate-500/30',
    progress: 'from-emerald-500/20 to-emerald-600/20 border-emerald-500/30',
    status: 'from-violet-500/20 to-fuchsia-500/20 border-violet-500/30',
    chart: 'from-amber-500/20 to-orange-500/20 border-amber-500/30'
  };

  const iconColors: Record<string, string> = {
    kpi: 'text-blue-400',
    alert: 'text-red-400',
    info: 'text-slate-400',
    progress: 'text-emerald-400',
    status: 'text-violet-400',
    chart: 'text-amber-400'
  };

  return (
    <div className={`p-4 rounded-xl border bg-gradient-to-br ${bgColors[widget.type] || bgColors.info}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={iconColors[widget.type] || 'text-slate-400'}>
          {widget.type === 'kpi' && <TrendingUp className="w-4 h-4" />}
          {widget.type === 'alert' && <AlertTriangle className="w-4 h-4" />}
          {widget.type === 'progress' && <Activity className="w-4 h-4" />}
          {widget.type === 'status' && <Target className="w-4 h-4" />}
          {widget.type === 'chart' && <LayoutGrid className="w-4 h-4" />}
        </span>
        <span className="text-xs font-medium text-slate-300 uppercase">{widget.type}</span>
      </div>
      <h4 className="text-sm font-semibold text-white">{widget.title}</h4>
      {widget.data?.value && (
        <p className="text-2xl font-bold text-white mt-1">{widget.data.value}</p>
      )}
      {widget.data?.message && (
        <p className="text-sm text-slate-400 mt-1">{widget.data.message}</p>
      )}
    </div>
  );
}

function ActionButton({ action }: { action: AIAction }) {
  return (
    <button className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs rounded-lg transition-all">
      {action.label}
      <ChevronRight className="w-3 h-3" />
    </button>
  );
}

function KPIRow({ icon, label, value, trend, color }: { 
  icon: React.ReactNode; 
  label: string; 
  value: string; 
  trend: string;
  color: 'blue' | 'red' | 'emerald' | 'amber';
}) {
  const colorClasses = {
    blue: 'from-blue-500 to-blue-600',
    red: 'from-red-500 to-orange-500',
    emerald: 'from-emerald-500 to-emerald-600',
    amber: 'from-amber-500 to-orange-500'
  };

  const trendPositive = !trend.startsWith('-');

  return (
    <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
      <div className="flex items-center gap-3">
        <div className={`p-2 bg-gradient-to-br ${colorClasses[color]} rounded-lg`}>
          {icon}
        </div>
        <div>
          <p className="text-sm font-medium text-white">{label}</p>
          <p className="text-xs text-slate-400">{value}</p>
        </div>
      </div>
      <span className={`text-xs font-medium ${trendPositive ? 'text-emerald-400' : 'text-red-400'}`}>
        {trend}
      </span>
    </div>
  );
}

function CapabilityItem({ icon, label }: { icon: React.ReactNode; label: string }) {
  const capabilityQueries: Record<string, string> = {
    'Análisis de Proyectos': 'Analiza los proyectos actuales y muestra su estado, riesgos y KPIs principales',
    'Detección de Riesgos': 'Identifica los riesgos críticos en el sistema y muestra alertas prioritarias',
    'KPIs y Dashboards': 'Muestra los indicadores clave de rendimiento y métricas del negocio',
    'Análisis Financiero': 'Analiza el desempeño financiero y proyecciones',
    'Simulaciones': 'Ejecuta una simulación de escenarios para análisis estratégico'
  };

  const handleCapabilityClick = () => {
    const query = capabilityQueries[label] || `Muéstrame más sobre ${label}`;
    // Enviar la consulta al padre
    const event = new CustomEvent('sendCapabilityQuery', { detail: query });
    window.dispatchEvent(event);
  };

  return (
    <button 
      onClick={handleCapabilityClick}
      className="w-full flex items-center gap-3 p-2 hover:bg-white/5 rounded-lg transition-all text-left group"
    >
      <div className="p-1.5 bg-violet-500/20 rounded-lg text-violet-400 group-hover:bg-violet-500/30">
        {icon}
      </div>
      <span className="text-sm text-slate-300 group-hover:text-white">{label}</span>
      <ChevronRight className="w-4 h-4 text-slate-500 ml-auto group-hover:text-violet-400" />
    </button>
  );
}
