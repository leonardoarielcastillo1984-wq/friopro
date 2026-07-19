'use client';

import { useState, useRef, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import {
  MessageSquare, Send, Bot, User, Sparkles, Loader2,
  AlertTriangle, TrendingUp, Users, DollarSign, Clock, ShieldAlert
} from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  type?: 'text' | 'analysis' | 'alert';
  metadata?: any;
}

interface Props {
  projectId: string;
  projectName: string;
}

const SUGGESTIONS = [
  '¿Qué riesgos tiene este proyecto?',
  '¿Qué recursos faltan?',
  'Analizar rentabilidad',
  '¿Cuál es el margen proyectado?',
  'Generar resumen ejecutivo',
  'Comparar con proyectos similares',
];

export default function ProjectCopilot({ projectId, projectName }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Hola, soy el Copilot de Proyectos de SGI360. Estoy analizando "${projectName}". ¿En qué puedo ayudarte?`,
      type: 'text',
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      // First try the predictive IA endpoint for structured analysis
      const res = await apiFetch(`/project360-v1/projects/${projectId}/ia-predictiva`, {
        method: 'POST',
        json: { question: text },
      }) as any;

      let assistantContent = '';
      let msgType: 'text' | 'analysis' | 'alert' = 'text';
      let metadata: any = {};

      if (res.iaAnalysis) {
        msgType = 'analysis';
        metadata = res.iaAnalysis;
        assistantContent = res.summary || 'Análisis completado.';

        // Build rich response
        const parts: string[] = [assistantContent];
        if (res.recommendations?.length) {
          parts.push('\n\n**Recomendaciones:**\n' + res.recommendations.map((r: string, i: number) => `${i + 1}. ${r}`).join('\n'));
        }
        if (res.alerts?.length) {
          parts.push('\n\n**Alertas:**\n' + res.alerts.map((a: string, i: number) => `⚠️ ${a}`).join('\n'));
          msgType = 'alert';
        }
        assistantContent = parts.join('');
      } else {
        assistantContent = res.summary || 'No pude generar un análisis detallado en este momento.';
      }

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: assistantContent,
        type: msgType,
        metadata,
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (e: any) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Lo siento, ocurrió un error al procesar tu consulta. Por favor, intentá de nuevo más tarde.',
        type: 'text',
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const renderMessage = (msg: Message) => {
    const isUser = msg.role === 'user';
    return (
      <div key={msg.id} className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
        {!isUser && (
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
            <Bot className="w-4 h-4 text-blue-600" />
          </div>
        )}
        <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser ? 'bg-blue-600 text-white' :
          msg.type === 'alert' ? 'bg-red-50 text-red-900 border border-red-100' :
          msg.type === 'analysis' ? 'bg-emerald-50 text-emerald-900 border border-emerald-100' :
          'bg-gray-100 text-gray-800'
        }`}>
          {msg.content.split('\n').map((line, i) => (
            <p key={i} className={line.startsWith('**') ? 'font-semibold mt-2 mb-1' : 'mb-0.5'}>
              {line.replace(/\*\*/g, '')}
            </p>
          ))}
          {msg.type === 'analysis' && msg.metadata && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {msg.metadata.probabilityOfWinning != null && (
                <div className="bg-white rounded-lg p-2 text-center">
                  <div className="text-xs text-gray-500">Prob. Adjudicación</div>
                  <div className="font-bold text-emerald-700">{msg.metadata.probabilityOfWinning}%</div>
                </div>
              )}
              {msg.metadata.overallRiskScore != null && (
                <div className="bg-white rounded-lg p-2 text-center">
                  <div className="text-xs text-gray-500">Riesgo Global</div>
                  <div className="font-bold text-red-700">{msg.metadata.overallRiskScore}%</div>
                </div>
              )}
              {msg.metadata.viabilityScore != null && (
                <div className="bg-white rounded-lg p-2 text-center">
                  <div className="text-xs text-gray-500">Viabilidad</div>
                  <div className="font-bold text-blue-700">{msg.metadata.viabilityScore}%</div>
                </div>
              )}
              {msg.metadata.financialScore != null && (
                <div className="bg-white rounded-lg p-2 text-center">
                  <div className="text-xs text-gray-500">Score Financiero</div>
                  <div className="font-bold text-purple-700">{msg.metadata.financialScore}%</div>
                </div>
              )}
            </div>
          )}
        </div>
        {isUser && (
          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
            <User className="w-4 h-4 text-gray-600" />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-[600px] bg-white rounded-xl border">
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center gap-3 bg-gray-50 rounded-t-xl">
        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div>
          <div className="text-sm font-semibold text-gray-900">Project Copilot</div>
          <div className="text-xs text-gray-500">IA Predictiva — {projectName}</div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(renderMessage)}
        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <Bot className="w-4 h-4 text-blue-600" />
            </div>
            <div className="bg-gray-100 rounded-2xl px-4 py-3 flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-gray-500 animate-spin" />
              <span className="text-sm text-gray-500">Analizando proyecto...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions */}
      {messages.length < 3 && !loading && (
        <div className="px-4 py-2 border-t bg-gray-50">
          <div className="text-xs text-gray-500 mb-2">Sugerencias:</div>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map(s => (
              <button
                key={s}
                onClick={() => sendMessage(s)}
                className="px-3 py-1.5 bg-white border rounded-full text-xs text-gray-700 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-3 border-t">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Preguntá sobre el proyecto..."
            className="flex-1 px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
