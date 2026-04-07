'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import type { DocumentRow, NormativeStandard, ChatMessage } from '@/lib/types';
import {
  MessageSquare, Send, RotateCcw, ArrowLeft, BrainCircuit,
  User, FileText, BookOpen, ChevronDown, AlertCircle
} from 'lucide-react';

export default function AuditChatPage() {
  const router = useRouter();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [normatives, setNormatives] = useState<NormativeStandard[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [selectedNormIds, setSelectedNormIds] = useState<string[]>([]);
  const [showContext, setShowContext] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadOptions() {
      try {
        const [docsRes, normsRes] = await Promise.all([
          apiFetch<{ documents: DocumentRow[] }>('/documents'),
          apiFetch<{ normativos: NormativeStandard[] }>('/normativos'),
        ]);
        setDocuments(docsRes.documents ?? []);
        setNormatives((normsRes.normativos ?? []).filter(n => n.status === 'READY'));
      } catch (err: any) {
        if (err?.message === 'Unauthorized') router.push('/login');
      }
    }
    loadOptions();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function toggleDoc(id: string) {
    setSelectedDocIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }
  function toggleNorm(id: string) {
    setSelectedNormIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || sending) return;

    const userMessage: ChatMessage = { role: 'user', content: input.trim() };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setSending(true);
    setError(null);

    try {
      const res = await apiFetch<{ response: string }>('/audit/chat', {
        method: 'POST',
        json: {
          message: input.trim(),
          context: {
            documentIds: selectedDocIds.length > 0 ? selectedDocIds : undefined,
            normativeIds: selectedNormIds.length > 0 ? selectedNormIds : undefined,
          },
        },
      });
      setMessages(prev => [...prev, { role: 'assistant', content: res.response }]);
    } catch (err: any) {
      setError(err?.message ?? 'Error al enviar mensaje');
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  const contextCount = selectedDocIds.length + selectedNormIds.length;

  const suggestions = [
    '¿Cuáles son las principales brechas de cumplimiento?',
    '¿Qué documentos necesito para ISO 9001?',
    '¿Cómo mejoro la política de seguridad vial?',
    'Resumí los hallazgos críticos actuales',
  ];

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-neutral-200">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/audit')}
            className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="rounded-lg bg-purple-50 p-2">
            <MessageSquare className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-neutral-900">Chat Auditor IA</h1>
            <p className="text-xs text-neutral-500">Consultá sobre cumplimiento normativo en lenguaje natural</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowContext(!showContext)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
              contextCount > 0 ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'
            }`}
          >
            <FileText className="h-4 w-4" />
            Contexto {contextCount > 0 && <span className="rounded-full bg-brand-600 text-white text-xs px-1.5 py-0.5">{contextCount}</span>}
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showContext ? 'rotate-180' : ''}`} />
          </button>
          <button
            onClick={() => { setMessages([]); setError(null); }}
            className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-50 transition-colors"
          >
            <RotateCcw className="h-4 w-4" /> Nueva
          </button>
        </div>
      </div>

      {/* Context Panel */}
      {showContext && (
        <div className="mt-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-neutral-700 mb-2">Contexto de la conversación</p>
          <p className="text-xs text-neutral-500 mb-3">Seleccioná documentos y normas para enfocar las respuestas de la IA.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-neutral-600 mb-1 flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> Documentos</p>
              <div className="max-h-28 overflow-y-auto rounded-lg border border-neutral-200 p-2 space-y-0.5">
                {documents.length === 0 ? (
                  <p className="text-xs text-neutral-400 py-1">Sin documentos disponibles</p>
                ) : documents.map(d => (
                  <label key={d.id} className="flex items-center gap-2 py-1 px-1 rounded hover:bg-neutral-50 text-xs cursor-pointer">
                    <input type="checkbox" checked={selectedDocIds.includes(d.id)} onChange={() => toggleDoc(d.id)} className="rounded border-neutral-300 text-brand-600 focus:ring-brand-500" />
                    <span className="truncate">{d.title}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-neutral-600 mb-1 flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" /> Normas</p>
              <div className="max-h-28 overflow-y-auto rounded-lg border border-neutral-200 p-2 space-y-0.5">
                {normatives.length === 0 ? (
                  <p className="text-xs text-neutral-400 py-1">Sin normas disponibles</p>
                ) : normatives.map(n => (
                  <label key={n.id} className="flex items-center gap-2 py-1 px-1 rounded hover:bg-neutral-50 text-xs cursor-pointer">
                    <input type="checkbox" checked={selectedNormIds.includes(n.id)} onChange={() => toggleNorm(n.id)} className="rounded border-neutral-300 text-brand-600 focus:ring-brand-500" />
                    <span className="truncate">{n.name} <span className="text-neutral-400">({n.code})</span></span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="h-4 w-4 flex-shrink-0" /> {error}
        </div>
      )}

      {/* Messages area */}
      <div className="mt-3 flex-1 overflow-y-auto rounded-xl border border-neutral-200 bg-neutral-50/50 p-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center">
            <div className="rounded-2xl bg-purple-50 p-4 mb-4">
              <BrainCircuit className="h-10 w-10 text-purple-400" />
            </div>
            <h3 className="text-lg font-medium text-neutral-900 mb-1">Auditor IA</h3>
            <p className="text-sm text-neutral-500 mb-6 text-center max-w-md">
              Preguntá sobre cumplimiento normativo, brechas, evidencias necesarias o recomendaciones de mejora.
            </p>
            <div className="grid grid-cols-2 gap-2 max-w-lg">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => { setInput(s); inputRef.current?.focus(); }}
                  className="rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-left text-xs text-neutral-600 hover:border-brand-300 hover:bg-brand-50 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="flex-shrink-0 rounded-lg bg-purple-100 p-1.5 h-fit">
                    <BrainCircuit className="h-4 w-4 text-purple-600" />
                  </div>
                )}
                <div className={`max-w-[75%] rounded-xl px-4 py-3 text-sm ${
                  msg.role === 'user'
                    ? 'bg-brand-600 text-white'
                    : 'bg-white text-neutral-800 border border-neutral-200 shadow-sm'
                }`}>
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                </div>
                {msg.role === 'user' && (
                  <div className="flex-shrink-0 rounded-lg bg-brand-100 p-1.5 h-fit">
                    <User className="h-4 w-4 text-brand-600" />
                  </div>
                )}
              </div>
            ))}

            {sending && (
              <div className="flex gap-3">
                <div className="flex-shrink-0 rounded-lg bg-purple-100 p-1.5 h-fit">
                  <BrainCircuit className="h-4 w-4 text-purple-600 animate-pulse" />
                </div>
                <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-400 shadow-sm">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <div className="h-2 w-2 rounded-full bg-neutral-300 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="h-2 w-2 rounded-full bg-neutral-300 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="h-2 w-2 rounded-full bg-neutral-300 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span>Analizando...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} className="mt-3 flex gap-2">
        <input
          ref={inputRef}
          className="flex-1 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
          placeholder="Preguntá sobre cumplimiento, brechas, evidencias..."
          value={input}
          onChange={e => setInput(e.target.value)}
          disabled={sending}
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-medium text-white hover:bg-brand-700 disabled:bg-neutral-300 disabled:cursor-not-allowed transition-colors"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
