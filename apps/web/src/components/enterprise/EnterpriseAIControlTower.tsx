'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// Web Speech API types
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from '@/lib/api';
import {
  Brain, Mic, Send, Sparkles, Zap, TrendingUp,
  Crown, Loader2,
  Activity, Monitor, BarChart3, Shield, Database,
  Clock, Lightbulb, User, BrainCircuit, MicOff,
  Maximize2, Minimize2, Cpu,
  ThumbsUp, ThumbsDown, Download, Bell, AlertTriangle,
  Play, FileText, ChevronRight, Copy, Check, ExternalLink
} from 'lucide-react';
import DashboardWidgets from './DashboardWidgets';
import DynamicCharts, { type ChartData } from './DynamicCharts';
import ConversationSidebar from './ConversationSidebar';
import InsightsPanel from './InsightsPanel';
import OperationalTimeline from './OperationalTimeline';

import { EnterpriseCCProps } from '@/types/enterprise-cc';

// ── Types ─────────────────────────────────────────────────────
interface Message {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  provider?: string;
  tokensUsed?: number;
  widgets?: any[];
  charts?: ChartData[];
  actions?: AIActionButton[];
  isThinking?: boolean;
  isStreaming?: boolean;
  feedback?: 'up' | 'down' | null;
}

interface AIActionButton {
  type: string;
  label: string;
  icon?: string;
  route?: string;
  payload?: any;
  requiresConfirmation?: boolean;
}

type RightPanel = 'insights' | 'timeline' | 'charts' | 'predictive' | null;

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

  // ── State ─────────────────────────────────────────────────
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | undefined>(undefined);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [rightPanel, setRightPanel] = useState<RightPanel>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [smartSuggestions, setSmartSuggestions] = useState<Array<{ id: string; text: string; category: string }>>([]);
  const [liveStatus, setLiveStatus] = useState({ connected: true, lastSync: new Date(), latency: 23 });
  const [useStreaming] = useState(true);
  const [notifCount, setNotifCount] = useState(0);
  const isPremium = subscription?.plan !== 'STARTER_AI';

  // ── Refs ──────────────────────────────────────────────────
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Effects ───────────────────────────────────────────────
  useEffect(() => {
    loadSuggestions();
    // Heartbeat
    const interval = setInterval(() => {
      setLiveStatus(prev => ({ ...prev, lastSync: new Date() }));
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Voice Recognition ─────────────────────────────────────
  useEffect(() => {
    if (!isListening) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error('Speech recognition not supported');
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
        setInput(prev => (prev + ' ' + finalTranscript).trim());
      } else if (interimTranscript) {
        setInput(prev => {
          const base = prev.replace(/\.\.\.$/, '').trim();
          return (base + ' ' + interimTranscript + '...').trim();
        });
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech error:', event.error);
      setIsListening(false);
    };
    recognition.onend = () => setIsListening(false);

    try { recognition.start(); } catch { setIsListening(false); }
    return () => { try { recognition.stop(); } catch {} };
  }, [isListening]);

  // ── API helpers ───────────────────────────────────────────
  const loadSuggestions = async () => {
    try {
      const res = await apiFetch('/command-center/suggestions') as any;
      if (res?.data && Array.isArray(res.data)) {
        const sugs: Array<{ id: string; text: string; category: string }> = [];
        res.data.forEach((cat: any) => {
          if (cat.queries) {
            cat.queries.forEach((q: string, i: number) => {
              sugs.push({ id: `sug-${cat.category}-${i}`, text: q, category: cat.category });
            });
          }
        });
        setSmartSuggestions(sugs);
      }
    } catch { /* non-critical */ }
  };

  // ── Fetch notification count ────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch('/command-center/notifications') as any;
        if (res?.unreadCount != null) setNotifCount(res.unreadCount);
      } catch { /* non-critical */ }
    })();
    const iv = setInterval(async () => {
      try {
        const res = await apiFetch('/command-center/notifications') as any;
        if (res?.unreadCount != null) setNotifCount(res.unreadCount);
      } catch {}
    }, 60000);
    return () => clearInterval(iv);
  }, []);

  // ── Keyboard shortcuts ──────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Cmd+K or Ctrl+K → focus input
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
      // Escape → exit fullscreen or close right panel
      if (e.key === 'Escape') {
        if (isFullscreen) setIsFullscreen(false);
        else if (rightPanel) setRightPanel(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isFullscreen, rightPanel]);

  // ── Feedback handler ────────────────────────────────────────
  const handleFeedback = useCallback(async (msgIdx: number, rating: 'up' | 'down') => {
    setMessages(prev => {
      const msgs = [...prev];
      msgs[msgIdx] = { ...msgs[msgIdx], feedback: rating };
      return msgs;
    });
    const msg = messages[msgIdx];
    if (msg?.id) {
      try {
        await apiFetch(`/command-center/messages/${msg.id}/feedback`, {
          method: 'POST',
          body: JSON.stringify({ rating }),
        });
      } catch { /* non-critical */ }
    }
  }, [messages]);

  // ── Action execution from chat ──────────────────────────────
  const handleExecuteAction = useCallback(async (action: AIActionButton) => {
    if (action.route) {
      window.location.href = action.route;
      return;
    }
    if (action.requiresConfirmation && !confirm(`¿Ejecutar "${action.label}"?`)) return;
    try {
      setIsLoading(true);
      const res = await apiFetch('/command-center/execute-action', {
        method: 'POST',
        body: JSON.stringify({
          action: action.type,
          params: action.payload || {},
          conversationId: activeConversationId,
        }),
      }) as any;
      const resultMsg: Message = {
        role: 'assistant',
        content: res?.data?.message || `✅ Acción "${action.label}" ejecutada correctamente`,
        timestamp: new Date(),
        provider: 'SYSTEM',
      };
      setMessages(prev => [...prev, resultMsg]);
    } catch (err: any) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `❌ Error ejecutando "${action.label}": ${err.message}`,
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [activeConversationId]);

  // ── Export conversation ──────────────────────────────────────
  const handleExportConversation = useCallback(async () => {
    if (!activeConversationId) return;
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || '';
      const url = `${apiBase}/api/command-center/conversations/${activeConversationId}/export?format=markdown`;
      const res = await fetch(url, { credentials: 'include' });
      const text = await res.text();
      const blob = new Blob([text], { type: 'text/markdown' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `conversacion-${activeConversationId.slice(0, 8)}.md`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      console.error('Export error:', err);
    }
  }, [activeConversationId]);

  // ── Copy message content ────────────────────────────────────
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const handleCopyMessage = useCallback(async (content: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 2000);
    } catch {}
  }, []);

  // ── Send message (with SSE streaming support) ──────────────
  const handleSendMessage = async (queryOverride?: string) => {
    const query = (queryOverride || input).trim();
    if (!query || isLoading) return;

    const userMsg: Message = { role: 'user', content: query, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    if (useStreaming) {
      // ── SSE Streaming path ──
      const streamingMsg: Message = { role: 'assistant', content: '', timestamp: new Date(), isStreaming: true };
      setMessages(prev => [...prev, streamingMsg]);

      try {
        const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || '';
        const res = await fetch(`${apiBase}/api/command-center/stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ query, conversationId: activeConversationId }),
        });

        if (!res.ok || !res.body) throw new Error('SSE connection failed');

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let finalProvider = '';
        let finalTokens = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'chunk') {
                setMessages(prev => {
                  const msgs = [...prev];
                  const last = msgs[msgs.length - 1];
                  if (last?.isStreaming) {
                    msgs[msgs.length - 1] = { ...last, content: last.content + data.content };
                  }
                  return msgs;
                });
              } else if (data.type === 'complete') {
                finalProvider = data.provider || '';
                finalTokens = data.tokensUsed || 0;
                setMessages(prev => {
                  const msgs = [...prev];
                  const last = msgs[msgs.length - 1];
                  if (last?.isStreaming) {
                    msgs[msgs.length - 1] = {
                      ...last,
                      content: data.content || last.content,
                      provider: finalProvider,
                      tokensUsed: finalTokens,
                      isStreaming: false,
                    };
                  }
                  return msgs;
                });
              }
            } catch { /* skip invalid JSON */ }
          }
        }

        // Finalize if stream ended without complete event
        setMessages(prev => {
          const msgs = [...prev];
          const last = msgs[msgs.length - 1];
          if (last?.isStreaming) {
            msgs[msgs.length - 1] = { ...last, isStreaming: false, provider: finalProvider };
          }
          return msgs;
        });

      } catch (err: any) {
        console.warn('[CC] SSE failed, falling back to normal:', err.message);
        // Fallback to non-streaming
        await sendNonStreaming(query);
      }
    } else {
      // ── Non-streaming path ──
      const thinkingMsg: Message = { role: 'assistant', content: '', timestamp: new Date(), isThinking: true };
      setMessages(prev => [...prev, thinkingMsg]);
      await sendNonStreaming(query);
    }

    setIsLoading(false);
  };

  const sendNonStreaming = async (query: string) => {
    try {
      const res = await apiFetch('/command-center/query', {
        method: 'POST',
        body: JSON.stringify({ query, conversationId: activeConversationId }),
      }) as any;

      const data = res?.data || res;
      const assistantMsg: Message = {
        role: 'assistant',
        content: data?.summary || data?.response || 'Sin respuesta',
        timestamp: new Date(),
        provider: data?.provider || res?.provider,
        tokensUsed: data?.tokensUsed,
        widgets: data?.widgets,
        charts: data?.charts,
        actions: data?.actions,
      };

      setMessages(prev => {
        const filtered = prev.filter(m => !m.isThinking && !m.isStreaming);
        return [...filtered, assistantMsg];
      });

      if (res?.conversationId) setActiveConversationId(res.conversationId);
    } catch (err: any) {
      console.error('[CC] Query error:', err);
      setMessages(prev => {
        const filtered = prev.filter(m => !m.isThinking && !m.isStreaming);
        return [...filtered, {
          role: 'assistant',
          content: `Error: ${err.message || 'No se pudo procesar la consulta'}`,
          timestamp: new Date(),
        }];
      });
    }
  };

  // ── Select conversation ───────────────────────────────────
  const handleSelectConversation = async (convId: string) => {
    setActiveConversationId(convId);
    setMessages([]);
    try {
      const res = await apiFetch(`/command-center/conversations/${convId}/messages`) as any;
      if (res?.data?.messages) {
        const loaded: Message[] = res.data.messages.map((m: any) => ({
          role: m.role === 'USER' ? 'user' : 'assistant',
          content: m.content,
          timestamp: new Date(m.createdAt),
          provider: m.provider,
          tokensUsed: m.tokensUsed,
        }));
        setMessages(loaded);
      }
    } catch (err) {
      console.error('Error loading conversation:', err);
    }
  };

  // ── New conversation ──────────────────────────────────────
  const handleNewConversation = () => {
    setActiveConversationId(undefined);
    setMessages([]);
    inputRef.current?.focus();
  };

  // ── Ask from insight ──────────────────────────────────────
  const handleAskAbout = (query: string) => {
    setRightPanel(null);
    setInput(query);
    setTimeout(() => handleSendMessage(query), 100);
  };

  // ── Key handler ───────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // ── Render ────────────────────────────────────────────────
  return (
    <div className={`flex h-[calc(100vh-64px)] bg-gray-950 text-white overflow-hidden ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      {/* ── Left Sidebar: Conversations ─────────────────── */}
      <ConversationSidebar
        activeConversationId={activeConversationId}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(prev => !prev)}
      />

      {/* ── Main Content ────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header Bar */}
        <div className="h-12 px-4 border-b border-gray-800/80 flex items-center justify-between bg-gray-900/50 backdrop-blur-sm flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Brain className="w-5 h-5 text-purple-400" />
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full border border-gray-900" />
              </div>
              <span className="font-semibold text-sm text-gray-200">Command Center</span>
              {isPremium && (
                <span className="flex items-center gap-1 px-1.5 py-0.5 bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border border-yellow-500/30 rounded text-[9px] text-yellow-400 font-bold">
                  <Crown className="w-2.5 h-2.5" /> PREMIUM
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Live status */}
            <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-800/50 rounded-lg">
              <span className={`w-1.5 h-1.5 rounded-full ${liveStatus.connected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-[10px] text-gray-400">
                {liveStatus.connected ? 'Online' : 'Offline'} | {liveStatus.latency}ms
              </span>
            </div>

            {/* Right panel toggles */}
            <button
              onClick={() => setRightPanel(rightPanel === 'insights' ? null : 'insights')}
              className={`p-1.5 rounded-lg transition-colors ${
                rightPanel === 'insights' ? 'bg-yellow-500/20 text-yellow-400' : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
              title="Insights proactivos"
            >
              <Lightbulb className="w-4 h-4" />
            </button>
            <button
              onClick={() => setRightPanel(rightPanel === 'timeline' ? null : 'timeline')}
              className={`p-1.5 rounded-lg transition-colors ${
                rightPanel === 'timeline' ? 'bg-blue-500/20 text-blue-400' : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
              title="Timeline operativo"
            >
              <Activity className="w-4 h-4" />
            </button>
            <button
              onClick={() => setRightPanel(rightPanel === 'charts' ? null : 'charts')}
              className={`p-1.5 rounded-lg transition-colors ${
                rightPanel === 'charts' ? 'bg-green-500/20 text-green-400' : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
              title="Gráficos operativos"
            >
              <BarChart3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setRightPanel(rightPanel === 'predictive' ? null : 'predictive')}
              className={`p-1.5 rounded-lg transition-colors ${
                rightPanel === 'predictive' ? 'bg-orange-500/20 text-orange-400' : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
              title="Análisis predictivo"
            >
              <TrendingUp className="w-4 h-4" />
            </button>

            {/* Notifications bell */}
            <button className="relative p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors" title="Notificaciones">
              <Bell className="w-4 h-4" />
              {notifCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-red-500 rounded-full text-[8px] text-white font-bold flex items-center justify-center">
                  {notifCount > 9 ? '9+' : notifCount}
                </span>
              )}
            </button>

            {/* Export conversation */}
            {activeConversationId && (
              <button
                onClick={handleExportConversation}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                title="Exportar conversación"
              >
                <Download className="w-4 h-4" />
              </button>
            )}

            {/* Fullscreen toggle */}
            <button
              onClick={() => setIsFullscreen(prev => !prev)}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex min-h-0">
          {/* ── Chat Column ─────────────────────────────── */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {messages.length === 0 ? (
                <WelcomeScreen
                  userRole={userRole}
                  suggestions={smartSuggestions}
                  onSuggestionClick={(text) => handleSendMessage(text)}
                  isPremium={isPremium}
                />
              ) : (
                <>
                  {messages.map((msg, idx) => (
                    <MessageBubble
                      key={idx}
                      message={msg}
                      idx={idx}
                      onFeedback={handleFeedback}
                      onCopy={handleCopyMessage}
                      copiedIdx={copiedIdx}
                      onExecuteAction={handleExecuteAction}
                    />
                  ))}
                </>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="px-4 pb-4 flex-shrink-0">
              <div className="max-w-3xl mx-auto">
                <div className={`flex items-center gap-2 p-2 bg-gray-800/60 backdrop-blur-sm border rounded-xl transition-colors ${
                  isLoading ? 'border-purple-500/40' : 'border-gray-700/50 focus-within:border-purple-500/50'
                }`}>
                  {/* Voice button */}
                  <button
                    onClick={() => setIsListening(prev => !prev)}
                    className={`p-2 rounded-lg transition-all ${
                      isListening
                        ? 'bg-red-500/20 text-red-400 animate-pulse'
                        : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                    }`}
                    title={isListening ? 'Detener' : 'Hablar'}
                  >
                    {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>

                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={isListening ? 'Escuchando...' : 'Pregunta algo al asistente IA... (⌘K)'}
                    className="flex-1 bg-transparent text-sm text-gray-200 placeholder-gray-500 outline-none"
                    disabled={isLoading}
                  />

                  <button
                    onClick={() => handleSendMessage()}
                    disabled={!input.trim() || isLoading}
                    className={`p-2 rounded-lg transition-all ${
                      input.trim() && !isLoading
                        ? 'bg-purple-500 text-white hover:bg-purple-600'
                        : 'text-gray-600 cursor-not-allowed'
                    }`}
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>

                {/* Quick suggestions below input */}
                {messages.length > 0 && smartSuggestions.length > 0 && !isLoading && (
                  <div className="flex gap-1.5 mt-2 overflow-x-auto pb-1">
                    {smartSuggestions.slice(0, 4).map(sug => (
                      <button
                        key={sug.id}
                        onClick={() => handleSendMessage(sug.text)}
                        className="flex-shrink-0 px-2.5 py-1 bg-gray-800/40 border border-gray-700/30 rounded-full text-[10px] text-gray-400 hover:text-white hover:border-purple-500/40 transition-colors"
                      >
                        <Sparkles className="w-2.5 h-2.5 inline mr-1" />
                        {sug.text.length > 40 ? sug.text.slice(0, 40) + '...' : sug.text}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Right Panel ─────────────────────────────── */}
          <AnimatePresence>
            {rightPanel && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 380, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="border-l border-gray-700/50 overflow-hidden flex-shrink-0"
              >
                <div className="w-[380px] h-full overflow-y-auto p-3 space-y-3">
                  {rightPanel === 'insights' && <InsightsPanel onAskAbout={handleAskAbout} />}
                  {rightPanel === 'timeline' && <OperationalTimeline />}
                  {rightPanel === 'charts' && <ChartsPanel />}
                  {rightPanel === 'predictive' && <PredictivePanel />}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ── Welcome Screen ──────────────────────────────────────────
function WelcomeScreen({
  userRole,
  suggestions,
  onSuggestionClick,
  isPremium,
}: {
  userRole: string;
  suggestions: Array<{ id: string; text: string; category: string }>;
  onSuggestionClick: (text: string) => void;
  isPremium: boolean;
}) {
  const grouped = suggestions.reduce<Record<string, typeof suggestions>>((acc, s) => {
    (acc[s.category] = acc[s.category] || []).push(s);
    return acc;
  }, {});

  const categoryIcons: Record<string, any> = {
    Dashboard: Monitor,
    'Análisis': BarChart3,
    Acciones: Zap,
    'Estratégico': TrendingUp,
  };

  const categoryColors: Record<string, string> = {
    Dashboard: 'from-blue-500/20 to-blue-600/10 border-blue-500/20',
    'Análisis': 'from-green-500/20 to-green-600/10 border-green-500/20',
    Acciones: 'from-purple-500/20 to-purple-600/10 border-purple-500/20',
    'Estratégico': 'from-amber-500/20 to-amber-600/10 border-amber-500/20',
  };

  return (
    <div className="flex flex-col items-center justify-center h-full px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center max-w-2xl"
      >
        {/* Logo */}
        <div className="relative mx-auto w-16 h-16 mb-4">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-2xl blur-xl" />
          <div className="relative w-16 h-16 bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-2xl flex items-center justify-center">
            <BrainCircuit className="w-8 h-8 text-purple-400" />
          </div>
        </div>

        <h2 className="text-xl font-bold text-white mb-1">
          Command Center IA
        </h2>
        <p className="text-sm text-gray-400 mb-6">
          Tu asistente inteligente para gestión operativa. Preguntá sobre proyectos, calidad, riesgos, flota, RRHH y más.
        </p>

        {/* Suggestion Cards */}
        <div className="grid grid-cols-2 gap-3 max-w-lg mx-auto">
          {Object.entries(grouped).map(([category, items]) => {
            const Icon = categoryIcons[category] || Sparkles;
            const colorClass = categoryColors[category] || 'from-gray-500/20 to-gray-600/10 border-gray-500/20';
            return (
              <div
                key={category}
                className={`bg-gradient-to-br ${colorClass} border rounded-xl p-3 text-left`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-4 h-4 text-gray-300" />
                  <span className="text-xs font-semibold text-gray-300">{category}</span>
                </div>
                <div className="space-y-1">
                  {items.slice(0, 2).map(item => (
                    <button
                      key={item.id}
                      onClick={() => onSuggestionClick(item.text)}
                      className="block w-full text-left text-[11px] text-gray-400 hover:text-white transition-colors py-0.5 truncate"
                    >
                      &ldquo;{item.text}&rdquo;
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Feature badges */}
        <div className="flex items-center justify-center gap-2 mt-6 flex-wrap">
          {[
            { icon: Database, label: 'Memoria persistente' },
            { icon: Lightbulb, label: 'Insights proactivos' },
            { icon: Activity, label: 'Timeline en vivo' },
            { icon: Shield, label: 'Multi-tenant' },
          ].map(({ icon: Icon, label }) => (
            <span key={label} className="flex items-center gap-1 px-2 py-1 bg-gray-800/40 rounded-full text-[10px] text-gray-500">
              <Icon className="w-3 h-3" />
              {label}
            </span>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

// ── Message Bubble (Phase 3+4) ──────────────────────────────
function MessageBubble({
  message, idx, onFeedback, onCopy, copiedIdx, onExecuteAction
}: {
  message: Message;
  idx: number;
  onFeedback: (idx: number, rating: 'up' | 'down') => void;
  onCopy: (content: string, idx: number) => void;
  copiedIdx: number | null;
  onExecuteAction: (action: AIActionButton) => void;
}) {
  const isUser = message.role === 'user';

  if (message.isThinking) {
    return (
      <div className="flex items-start gap-3 max-w-3xl mx-auto">
        <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center flex-shrink-0">
          <Brain className="w-4 h-4 text-purple-400 animate-pulse" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <ThinkingAnimation />
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`group flex items-start gap-3 max-w-3xl mx-auto ${isUser ? 'flex-row-reverse' : ''}`}
    >
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
        isUser
          ? 'bg-blue-500/10 border border-blue-500/20'
          : 'bg-purple-500/10 border border-purple-500/20'
      }`}>
        {isUser ? (
          <User className="w-4 h-4 text-blue-400" />
        ) : (
          <Brain className="w-4 h-4 text-purple-400" />
        )}
      </div>

      {/* Content */}
      <div className={`flex-1 min-w-0 ${isUser ? 'text-right' : ''}`}>
        <div className={`inline-block text-left px-4 py-3 rounded-xl max-w-full ${
          isUser
            ? 'bg-blue-500/10 border border-blue-500/20'
            : 'bg-gray-800/60 border border-gray-700/30'
        }`}>
          {/* Markdown-aware content */}
          <div
            className="text-sm text-gray-200 leading-relaxed break-words prose prose-invert prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-headings:my-2 prose-strong:text-white prose-code:text-purple-300 prose-code:bg-gray-700/50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
          />
          {message.isStreaming && (
            <span className="inline-block w-2 h-4 bg-purple-400 ml-0.5 animate-pulse rounded-sm" />
          )}
        </div>

        {/* Action Buttons from AI */}
        {!isUser && message.actions && message.actions.length > 0 && !message.isStreaming && (
          <div className="flex flex-wrap gap-2 mt-2">
            {message.actions.map((action, ai) => (
              <button
                key={ai}
                onClick={() => onExecuteAction(action)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/10 border border-purple-500/30 rounded-lg text-xs text-purple-300 hover:bg-purple-500/20 hover:text-purple-200 transition-colors"
              >
                {action.route ? <ExternalLink className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                {action.label}
                {action.requiresConfirmation && <AlertTriangle className="w-3 h-3 text-yellow-400" />}
              </button>
            ))}
          </div>
        )}

        {/* Metadata + Actions row */}
        {!message.isStreaming && (
          <div className={`flex items-center gap-2 mt-1 ${isUser ? 'justify-end' : ''}`}>
            <Clock className="w-2.5 h-2.5 text-gray-600" />
            <span className="text-[10px] text-gray-600">
              {message.timestamp.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
            </span>
            {!isUser && message.provider && (
              <span className="text-[10px] text-purple-500/60 flex items-center gap-0.5">
                <Cpu className="w-2.5 h-2.5" />
                {message.provider}
              </span>
            )}
            {!isUser && message.tokensUsed && message.tokensUsed > 0 && (
              <span className="text-[10px] text-gray-600">{message.tokensUsed} tokens</span>
            )}

            {/* Copy + Feedback (only for assistant, visible on hover) */}
            {!isUser && (
              <div className="flex items-center gap-1 ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => onCopy(message.content, idx)}
                  className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
                  title="Copiar"
                >
                  {copiedIdx === idx ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                </button>
                <button
                  onClick={() => onFeedback(idx, 'up')}
                  className={`p-1 transition-colors ${message.feedback === 'up' ? 'text-green-400' : 'text-gray-500 hover:text-green-400'}`}
                  title="Buena respuesta"
                >
                  <ThumbsUp className="w-3 h-3" />
                </button>
                <button
                  onClick={() => onFeedback(idx, 'down')}
                  className={`p-1 transition-colors ${message.feedback === 'down' ? 'text-red-400' : 'text-gray-500 hover:text-red-400'}`}
                  title="Mala respuesta"
                >
                  <ThumbsDown className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Dynamic Charts */}
        {!isUser && message.charts && message.charts.length > 0 && (
          <DynamicCharts charts={message.charts} />
        )}

        {/* Widgets if present */}
        {!isUser && message.widgets && message.widgets.length > 0 && (
          <div className="mt-3">
            <DashboardWidgets />
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Thinking Animation ──────────────────────────────────────
function ThinkingAnimation() {
  const steps = [
    { label: 'Analizando consulta', icon: Brain },
    { label: 'Consultando datos', icon: Database },
    { label: 'Generando respuesta', icon: Sparkles },
  ];

  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep(prev => (prev + 1) % steps.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-3 py-2 px-3 bg-gray-800/40 border border-gray-700/30 rounded-xl">
      <div className="relative">
        <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
      </div>
      <div>
        <p className="text-xs text-gray-300 font-medium">{steps[currentStep].label}...</p>
        <div className="flex gap-1 mt-1">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`w-1 h-1 rounded-full transition-colors ${
                i <= currentStep ? 'bg-purple-400' : 'bg-gray-600'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Charts Panel ─────────────────────────────────────────────
function ChartsPanel() {
  const [charts, setCharts] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch('/command-center/charts') as any;
        if (res?.data && Array.isArray(res.data)) {
          setCharts(res.data);
        }
      } catch (err) {
        console.error('Error loading charts:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 text-green-400 animate-spin" />
      </div>
    );
  }

  if (charts.length === 0) {
    return (
      <div className="text-center py-12">
        <BarChart3 className="w-8 h-8 text-gray-600 mx-auto mb-2" />
        <p className="text-sm text-gray-500">Sin datos para gráficos</p>
        <p className="text-xs text-gray-600 mt-1">Los gráficos se generan con datos reales del sistema</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
        <BarChart3 className="w-4 h-4 text-green-400" />
        Gráficos Operativos
      </h3>
      <DynamicCharts charts={charts} />
    </div>
  );
}

// ── Lightweight Markdown → HTML ──────────────────────────────
function renderMarkdown(content: string): string {
  if (!content) return '';
  let html = content
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // Headers
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold & italic
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Unordered lists
    .replace(/^[-•] (.+)$/gm, '<li>$1</li>')
    // Ordered lists
    .replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>')
    // Line breaks → paragraphs
    .replace(/\n{2,}/g, '</p><p>')
    .replace(/\n/g, '<br/>');
  // Wrap consecutive <li> in <ul>
  html = html.replace(/(<li>.*?<\/li>(?:<br\/>)?)+/gs, (match) => {
    return '<ul>' + match.replace(/<br\/>/g, '') + '</ul>';
  });
  return '<p>' + html + '</p>';
}

// ── Predictive Analytics Panel ───────────────────────────────
function PredictivePanel() {
  const [predictions, setPredictions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch('/command-center/predictive') as any;
        if (res?.data && Array.isArray(res.data)) setPredictions(res.data);
      } catch (err) {
        console.error('Predictive error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 text-orange-400 animate-spin" />
      </div>
    );
  }

  if (predictions.length === 0) {
    return (
      <div className="text-center py-12">
        <TrendingUp className="w-8 h-8 text-gray-600 mx-auto mb-2" />
        <p className="text-sm text-gray-500">Sin predicciones disponibles</p>
        <p className="text-xs text-gray-600 mt-1">Se necesitan datos históricos para generar predicciones</p>
      </div>
    );
  }

  const trendIcon = (trend: string) => {
    if (trend === 'up') return <TrendingUp className="w-3.5 h-3.5 text-green-400" />;
    if (trend === 'down') return <TrendingUp className="w-3.5 h-3.5 text-red-400 rotate-180" />;
    return <Activity className="w-3.5 h-3.5 text-gray-400" />;
  };

  const riskColor = (level?: string) => {
    if (level === 'high') return 'text-red-400 bg-red-500/10 border-red-500/30';
    if (level === 'medium') return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
    return 'text-green-400 bg-green-500/10 border-green-500/30';
  };

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-orange-400" />
        Análisis Predictivo
      </h3>
      <div className="space-y-3">
        {predictions.map((p, i) => (
          <div key={i} className="bg-gray-800/40 border border-gray-700/30 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-300">{p.metric}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded border ${riskColor(p.riskLevel)}`}>
                {p.module}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-center">
                <p className="text-lg font-bold text-white">{p.current}</p>
                <p className="text-[9px] text-gray-500 uppercase">Actual</p>
              </div>
              <div className="flex items-center gap-1">
                {trendIcon(p.trend)}
                <span className={`text-xs font-medium ${p.trendPct > 0 ? 'text-green-400' : p.trendPct < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                  {p.trendPct > 0 ? '+' : ''}{p.trendPct}%
                </span>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-purple-300">{p.predicted}</p>
                <p className="text-[9px] text-gray-500 uppercase">Predicción</p>
              </div>
            </div>

            {p.confidence && (
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1 bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-purple-500 rounded-full" style={{ width: `${p.confidence * 100}%` }} />
                </div>
                <span className="text-[9px] text-gray-500">{Math.round(p.confidence * 100)}% confianza</span>
              </div>
            )}

            {p.estimatedCompletion && (
              <p className="text-[10px] text-gray-400">
                <Clock className="w-3 h-3 inline mr-1" />
                Completado estimado: {p.estimatedCompletion}
              </p>
            )}

            {p.alert && (
              <div className="flex items-start gap-1.5 px-2 py-1.5 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <AlertTriangle className="w-3 h-3 text-yellow-400 flex-shrink-0 mt-0.5" />
                <span className="text-[10px] text-yellow-300">{p.alert}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
