'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import {
  ListChecks, AlertTriangle, AlertCircle, Info, RefreshCw,
  CheckCircle2, ChevronRight, Loader2, ShieldAlert,
  Sparkles, X, Send, ArrowRight, Zap, Check,
} from 'lucide-react';

type Severity = 'HIGH' | 'MEDIUM' | 'LOW';

type ReadinessIssue = {
  id: string;
  title: string;
  detail: string;
  severity: Severity;
  href: string;
};

type ModuleReadiness = {
  key: string;
  label: string;
  href: string;
  total: number;
  pending: number;
  score: number;
  issues: ReadinessIssue[];
};

type SummaryResponse = {
  generatedAt: string;
  overallScore: number;
  totalPending: number;
  modules: ModuleReadiness[];
};

const SEVERITY_CONFIG: Record<Severity, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  HIGH: { label: 'Urgente', color: 'text-red-700', bg: 'bg-red-50 border-red-200', icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  MEDIUM: { label: 'Importante', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: <AlertCircle className="h-3.5 w-3.5" /> },
  LOW: { label: 'A revisar', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', icon: <Info className="h-3.5 w-3.5" /> },
};

function scoreColor(score: number): string {
  if (score >= 85) return 'text-green-600';
  if (score >= 60) return 'text-amber-600';
  return 'text-red-600';
}

function scoreBarColor(score: number): string {
  if (score >= 85) return 'bg-green-500';
  if (score >= 60) return 'bg-amber-500';
  return 'bg-red-500';
}

type AISuggestion = { id: string; action: string; priority: string };

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  suggestions?: AISuggestion[];
  executed?: Record<string, boolean>;
  executing?: Record<string, boolean>;
};

const ACTION_MAP: Record<string, string[]> = {
  'riesgos': ['assign_responsible', 'send_reminder', 'create_draft_action'],
  'documentos': ['assign_responsible', 'mark_in_review', 'send_reminder'],
  'indicadores': ['assign_responsible', 'send_reminder'],
  'gestion-cambios': ['assign_responsible', 'update_date', 'send_reminder'],
  'objetivos': ['update_date', 'send_reminder', 'create_draft_action'],
  'planes-accion': ['update_date', 'suggest_close', 'send_reminder'],
  'ncr': ['update_date', 'suggest_close', 'send_reminder'],
  'capacitaciones': ['update_date', 'send_reminder'],
  'hallazgos': ['suggest_close', 'send_reminder'],
  'inspecciones': ['suggest_close', 'send_reminder'],
};

const ACTION_LABELS: Record<string, string> = {
  assign_responsible: 'Asignar responsable',
  send_reminder: 'Enviar recordatorio',
  create_draft_action: 'Crear plan (borrador)',
  mark_in_review: 'Marcar en revisión',
  update_date: 'Actualizar fecha',
  suggest_close: 'Sugerir cierre',
};

export default function AuditoriaReadinessPage() {
  const router = useRouter();
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatModule, setChatModule] = useState<ModuleReadiness | null>(null);
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [autoFixing, setAutoFixing] = useState<string | null>(null);
  const [autoFixResult, setAutoFixResult] = useState<string | null>(null);

  async function executeAction(suggestionId: string, action: string, moduleKey: string) {
    const issueId = suggestionId;
    setExecutingId(issueId + action);
    try {
      const res = await apiFetch<{ success: boolean; message: string }>('/audit-readiness/execute', {
        method: 'POST',
        json: { moduleKey, issueId, action },
      });
      setChatMessages((prev) => prev.map((m) => {
        if (!m.suggestions) return m;
        return {
          ...m,
          executed: { ...m.executed, [issueId + action]: true },
        };
      }));
      setChatMessages((prev) => [...prev, { role: 'assistant', content: res.message || 'Acción ejecutada' }]);
      load(true);
    } catch (err: any) {
      setChatMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${err?.message ?? 'No se pudo ejecutar'}` }]);
    } finally {
      setExecutingId(null);
    }
  }

  useEffect(() => { load(); }, []);

  async function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<SummaryResponse>('/audit-readiness/summary');
      if (!res || !Array.isArray(res.modules)) {
        throw new Error('No se pudo cargar el panel de preparación');
      }
      setData(res);
    } catch (err: any) {
      setError(err?.message ?? 'Error al cargar el panel de preparación');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function assistModule(m: ModuleReadiness) {
    if (m.issues.length === 0) return;
    setChatModule(m);
    setChatOpen(true);
    setChatMessages([{ role: 'user', content: `Analizar pendientes de "${m.label}"` }]);
    setChatLoading(true);
    try {
      const res = await apiFetch<{ moduleLabel: string; suggestions: AISuggestion[] }>('/audit-readiness/assist', {
        method: 'POST',
        json: { moduleKey: m.key, moduleLabel: m.label, issues: m.issues },
      });
      setChatMessages((prev) => [...prev, {
        role: 'assistant',
        content: `Encontré ${res.suggestions.length} sugerencia(s) para "${m.label}":`,
        suggestions: res.suggestions,
      }]);
    } catch (err: any) {
      setChatMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${err?.message ?? 'No se pudo procesar'}` }]);
    } finally {
      setChatLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 flex items-center gap-2">
            <ListChecks className="h-6 w-6 text-brand-600" /> Preparación de Auditoría
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            Detecta automáticamente lo pendiente en cada módulo del SGI: vencidos, sin evidencia, sin responsable o sin avance reciente.
            No modifica ningún dato — solo lectura.
          </p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
        >
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Actualizar
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {data && (
        <>
          {/* Score global */}
          <div className="rounded-xl border border-neutral-200 bg-white p-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className={`text-4xl font-bold ${scoreColor(data.overallScore)}`}>{data.overallScore}%</div>
                <div>
                  <div className="font-semibold text-neutral-900">Nivel de preparación general</div>
                  <div className="text-sm text-neutral-500">
                    {data.totalPending === 0
                      ? 'Todo en orden — no se detectaron pendientes'
                      : `${data.totalPending} ítem${data.totalPending === 1 ? '' : 's'} pendiente${data.totalPending === 1 ? '' : 's'} en total`}
                  </div>
                </div>
              </div>
              {data.totalPending === 0 ? (
                <CheckCircle2 className="h-10 w-10 text-green-500" />
              ) : (
                <ShieldAlert className="h-10 w-10 text-amber-500" />
              )}
            </div>
            <div className="mt-4 h-2.5 w-full rounded-full bg-neutral-100 overflow-hidden">
              <div className={`h-full rounded-full ${scoreBarColor(data.overallScore)} transition-all duration-500`} style={{ width: `${data.overallScore}%` }} />
            </div>
            <div className="mt-2 text-xs text-neutral-400">
              Última actualización: {new Date(data.generatedAt).toLocaleString('es-AR')}
            </div>
          </div>

          {/* Módulos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {data.modules.map((m) => (
              <div key={m.key} className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
                <button
                  onClick={() => setExpanded((e) => ({ ...e, [m.key]: !e[m.key] }))}
                  className="w-full flex items-center justify-between p-4 hover:bg-neutral-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`text-lg font-bold ${scoreColor(m.score)}`}>{m.score}%</div>
                    <div className="text-left">
                      <div className="font-semibold text-neutral-900">{m.label}</div>
                      <div className="text-xs text-neutral-500">
                        {m.pending === 0 ? 'Sin pendientes' : `${m.pending} de ${m.total} con pendientes`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {m.pending > 0 && (
                      <span className="rounded-full bg-red-100 text-red-700 text-xs font-semibold px-2 py-0.5">{m.pending}</span>
                    )}
                    <ChevronRight className={`h-4 w-4 text-neutral-400 transition-transform ${expanded[m.key] ? 'rotate-90' : ''}`} />
                  </div>
                </button>

                {expanded[m.key] && (
                  <div className="border-t border-neutral-100 p-3 space-y-2 bg-neutral-50/50">
                    {m.issues.length === 0 ? (
                      <p className="text-sm text-neutral-400 italic px-2 py-1">Sin ítems pendientes en este módulo.</p>
                    ) : (
                      m.issues.map((issue) => {
                        const cfg = SEVERITY_CONFIG[issue.severity];
                        return (
                          <button
                            key={issue.id}
                            onClick={() => router.push(issue.href)}
                            className={`w-full flex items-start gap-2 rounded-lg border p-2.5 text-left hover:shadow-sm transition-shadow ${cfg.bg}`}
                          >
                            <span className={`mt-0.5 ${cfg.color}`}>{cfg.icon}</span>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-neutral-800 truncate">{issue.title}</div>
                              <div className={`text-xs ${cfg.color}`}>{issue.detail}</div>
                            </div>
                          </button>
                        );
                      })
                    )}
                    <div className="flex items-center gap-2 pt-1">
                      {m.href && (
                        <button
                          onClick={() => router.push(m.href)}
                          className="text-xs text-brand-600 hover:text-brand-700 font-medium py-1.5"
                        >
                          Ir al módulo →
                        </button>
                      )}
                      {m.key === 'mapa-procesos' && m.pending > 0 && (
                        <button
                          onClick={async () => {
                            setAutoFixing(m.key);
                            setAutoFixResult(null);
                            try {
                              const res = await apiFetch<{ success: boolean; ownersAssigned: number; indicatorsLinked: number; documentsLinked: number; risksLinked: number; details: string[] }>('/audit-readiness/auto-fix', {
                                method: 'POST',
                                json: { moduleKey: m.key },
                              });
                              const msg = `Responsables: ${res.ownersAssigned} | Indicadores: ${res.indicatorsLinked} | Documentos: ${res.documentsLinked} | Riesgos: ${res.risksLinked}`;
                              setAutoFixResult(msg);
                              load(true);
                            } catch (err: any) {
                              setAutoFixResult(`Error: ${err?.message ?? 'No se pudo ejecutar'}`);
                            } finally {
                              setAutoFixing(null);
                            }
                          }}
                          disabled={autoFixing === m.key}
                          className="flex items-center gap-1 rounded-lg bg-green-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          {autoFixing === m.key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />} Auto-fix
                        </button>
                      )}
                      {m.pending > 0 && (
                        <button
                          onClick={() => assistModule(m)}
                          className="ml-auto flex items-center gap-1 rounded-lg bg-brand-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
                        >
                          <Sparkles className="h-3.5 w-3.5" /> Asistir con IA
                        </button>
                      )}
                    </div>
                    {autoFixResult && m.key === 'mapa-procesos' && (
                      <div className="text-xs text-neutral-600 bg-green-50 border border-green-200 rounded-lg px-2.5 py-1.5 mt-1">{autoFixResult}</div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Chat flotante IA */}
      {chatOpen && (
        <div className="fixed bottom-4 right-4 z-50 w-[400px] max-w-[calc(100vw-2rem)] rounded-xl border border-neutral-200 bg-white shadow-2xl flex flex-col" style={{ maxHeight: '70vh' }}>
          <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-brand-600" />
              <span className="font-semibold text-sm text-neutral-900">Asistente IA</span>
              {chatModule && <span className="text-xs text-neutral-400">· {chatModule.label}</span>}
            </div>
            <button onClick={() => setChatOpen(false)} className="text-neutral-400 hover:text-neutral-600">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {chatMessages.map((msg, i) => (
              <div key={i} className={msg.role === 'user' ? 'text-right' : ''}>
                <div className={`inline-block rounded-lg px-3 py-2 text-sm ${msg.role === 'user' ? 'bg-brand-600 text-white' : 'bg-neutral-100 text-neutral-800'}`}>
                  {msg.content}
                </div>
                {msg.suggestions && msg.suggestions.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {msg.suggestions.map((sug, j) => {
                      const actions = chatModule ? (ACTION_MAP[chatModule.key] || ['send_reminder']) : ['send_reminder'];
                      return (
                        <div key={j} className="rounded-lg border border-neutral-200 p-2.5 bg-white">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${sug.priority === 'ALTA' ? 'bg-red-100 text-red-700' : sug.priority === 'MEDIA' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>{sug.priority}</span>
                          </div>
                          <p className="text-xs text-neutral-700 mb-2">{sug.action}</p>
                          <div className="flex flex-wrap gap-1.5">
                            {actions.map((act) => {
                              const execKey = sug.id + act;
                              const isExecuted = msg.executed?.[execKey];
                              const isExecuting = executingId === execKey;
                              return (
                                <button
                                  key={act}
                                  onClick={() => !isExecuted && !isExecuting && executeAction(sug.id, act, chatModule!.key)}
                                  disabled={isExecuted || isExecuting}
                                  className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium ${
                                    isExecuted
                                      ? 'bg-green-100 text-green-700 cursor-default'
                                      : isExecuting
                                      ? 'bg-neutral-100 text-neutral-400'
                                      : 'bg-brand-50 text-brand-700 hover:bg-brand-100'
                                  }`}
                                >
                                  {isExecuted ? (
                                    <><Check className="h-3 w-3" /> Hecho</>
                                  ) : isExecuting ? (
                                    <><Loader2 className="h-3 w-3 animate-spin" /> ...</>
                                  ) : (
                                    <><Zap className="h-3 w-3" /> {ACTION_LABELS[act]}</>
                                  )}
                                </button>
                              );
                            })}
                            {chatModule?.href && (
                              <button
                                onClick={() => router.push(chatModule.href)}
                                className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-neutral-500 hover:text-neutral-700"
                              >
                                Ir <ArrowRight className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
            {chatLoading && (
              <div className="flex items-center gap-2 text-sm text-neutral-400">
                <Loader2 className="h-4 w-4 animate-spin" /> Analizando pendientes...
              </div>
            )}
          </div>
          <div className="border-t border-neutral-100 px-4 py-2 text-xs text-neutral-400">
            La IA ejecuta acciones seguras (recordatorios, borradores, asignaciones). Cierres definitivos requieren tu confirmación manual.
          </div>
        </div>
      )}

      {/* Botón flotante para abrir chat */}
      {!chatOpen && data && data.totalPending > 0 && (
        <button
          onClick={() => {
            const firstPending = data.modules.find((m) => m.pending > 0);
            if (firstPending) assistModule(firstPending);
          }}
          className="fixed bottom-[68px] right-4 z-50 flex items-center gap-2 rounded-full bg-brand-600 px-4 py-3 text-sm font-medium text-white shadow-lg hover:bg-brand-700"
        >
          <Sparkles className="h-4 w-4" /> Asistir con IA
        </button>
      )}
    </div>
  );
}
