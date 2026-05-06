'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft, ClipboardList, Users, CheckCircle, Clock, Send,
  BarChart2, BrainCircuit, Settings, AlertCircle, Edit3, Plus, Download
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

const TABS = [
  { key: 'info', label: 'Información', icon: ClipboardList },
  { key: 'participacion', label: 'Participación', icon: Users },
  { key: 'resultados', label: 'Resultados', icon: BarChart2 },
  { key: 'ia', label: 'Análisis IA', icon: BrainCircuit },
];

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Pendiente', color: 'bg-gray-100 text-gray-600' },
  SENT: { label: 'Enviada', color: 'bg-blue-100 text-blue-700' },
  OPENED: { label: 'Abierta', color: 'bg-amber-100 text-amber-700' },
  COMPLETED: { label: 'Completada', color: 'bg-emerald-100 text-emerald-700' },
  EXPIRED: { label: 'Vencida', color: 'bg-red-100 text-red-600' },
};

export default function DetallEncuestaPage() {
  const router = useRouter();
  const { id } = useParams() as { id: string };
  const [tab, setTab] = useState('info');
  const [survey, setSurvey] = useState<any>(null);
  const [participacion, setParticipacion] = useState<any>(null);
  const [resultados, setResultados] = useState<any>(null);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadSurvey(); }, [id]);
  useEffect(() => {
    if (tab === 'participacion' && !participacion) loadParticipacion();
    if (tab === 'resultados' && !resultados) loadResultados();
  }, [tab]);

  async function loadSurvey() {
    try {
      const data = await apiFetch(`/clima/encuestas/${id}`) as any;
      setSurvey(data.survey);
    } catch { } finally { setLoading(false); }
  }

  async function loadParticipacion() {
    try {
      const data = await apiFetch(`/clima/encuestas/${id}/participacion`) as any;
      setParticipacion(data.recipients || []);
    } catch { setParticipacion([]); }
  }

  async function loadResultados() {
    try {
      const data = await apiFetch(`/clima/encuestas/${id}/resultados`) as any;
      setResultados(data);
    } catch { setResultados(null); }
  }

  async function runAiAnalysis() {
    setAiLoading(true);
    try {
      const data = await apiFetch(`/clima/encuestas/${id}/analisis-ia`, { method: 'POST' }) as any;
      setAiAnalysis(data.analysis);
    } catch (e: any) {
      alert(e?.message || 'Error en análisis IA');
    } finally { setAiLoading(false); }
  }

  if (loading) return <div className="p-6 text-center text-gray-500 text-sm animate-pulse">Cargando encuesta...</div>;
  if (!survey) return <div className="p-6 text-center text-red-500 text-sm">Encuesta no encontrada</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={() => router.push('/clima/encuestas')} className="p-2 hover:bg-gray-100 rounded-xl text-gray-500 mt-0.5 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900">{survey.title}</h1>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${survey.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
              {survey.isActive ? 'Activa' : 'Inactiva'}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">{survey.code} · {survey.category?.replace('_', ' ')} · {survey.isAnonymous ? 'Anónima' : 'Identificada'}</p>
        </div>
        <button
          onClick={() => {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
            const tenantId = typeof window !== 'undefined' ? localStorage.getItem('tenantId') : null;
            const token = typeof window !== 'undefined' ? localStorage.getItem('csrfToken') : null;
            const url = `${apiUrl}/clima/encuestas/${id}/exportar-csv`;
            const a = document.createElement('a');
            a.href = url;
            a.click();
          }}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 hover:border-gray-400 px-3 py-2.5 rounded-xl transition-colors"
        >
          <Download className="w-4 h-4" />
          CSV
        </button>
        <button
          onClick={() => router.push(`/clima/encuestas/${id}/enviar`)}
          className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow transition-colors"
        >
          <Send className="w-4 h-4" />
          Enviar
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Preguntas', value: survey._count?.questions ?? survey.questions?.length ?? 0, icon: ClipboardList, color: 'text-blue-600 bg-blue-50' },
          { label: 'Destinatarios', value: survey.completedCount != null ? survey._count?.recipients : survey._count?.recipients ?? 0, icon: Users, color: 'text-purple-600 bg-purple-50' },
          { label: 'Completas', value: survey.completedCount ?? 0, icon: CheckCircle, color: 'text-emerald-600 bg-emerald-50' },
          { label: 'Puntaje promedio', value: survey.avgScore ? survey.avgScore.toFixed(1) : '—', icon: BarChart2, color: 'text-amber-600 bg-amber-50' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${s.color}`}>
              <s.icon className="w-4 h-4" />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-1">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${tab === t.key ? 'bg-white border border-b-white border-gray-200 text-teal-700 -mb-px' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div>
        {tab === 'info' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">Preguntas de la encuesta</h3>
            {survey.questions?.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 text-sm">No hay preguntas cargadas</p>
                <p className="text-xs text-gray-400 mt-1">Editá la encuesta para agregar preguntas</p>
              </div>
            ) : (
              <div className="space-y-3">
                {survey.questions?.map((q: any, idx: number) => (
                  <div key={q.id} className="flex gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50/50">
                    <span className="w-6 h-6 rounded-full bg-teal-100 text-teal-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{idx + 1}</span>
                    <div className="flex-1">
                      <p className="text-sm text-gray-800 font-medium">{q.text}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{q.type}</span>
                        {q.isRequired && <span className="text-xs text-amber-600">Requerida</span>}
                      </div>
                      {q.options?.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {q.options.map((o: any) => (
                            <span key={o.id} className="text-xs bg-white border border-gray-200 px-2 py-0.5 rounded-full text-gray-600">{o.label}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'participacion' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Estado de participación</h3>
            {!participacion ? (
              <p className="text-sm text-gray-400 text-center py-8">Cargando...</p>
            ) : participacion.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No hay destinatarios aún</p>
                <button onClick={() => router.push(`/clima/encuestas/${id}/enviar`)} className="mt-3 text-sm text-teal-600 hover:text-teal-800 font-medium">
                  Enviar encuesta →
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {participacion.map((r: any) => {
                  const st = STATUS_LABELS[r.status] || STATUS_LABELS.PENDING;
                  return (
                    <div key={r.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-gray-100 bg-gray-50/50">
                      <span className="text-sm text-gray-700 font-medium">{r.name}</span>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        {r.completedAt && <span>{new Date(r.completedAt).toLocaleDateString('es-AR')}</span>}
                        <span className={`px-2 py-0.5 rounded-full font-medium ${st.color}`}>{st.label}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === 'resultados' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5">
            {!resultados ? (
              <p className="text-sm text-gray-400 text-center py-8">Cargando resultados...</p>
            ) : resultados.totalResponses === 0 ? (
              <div className="text-center py-8">
                <BarChart2 className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Sin respuestas aún</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-teal-50 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-teal-700">{resultados.totalResponses}</p>
                    <p className="text-xs text-teal-600">Respuestas</p>
                  </div>
                  <div className="bg-purple-50 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-purple-700">{resultados.participacion?.rate ?? 0}%</p>
                    <p className="text-xs text-purple-600">Participación</p>
                  </div>
                  <div className="bg-amber-50 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-amber-700">{resultados.overallAvg ?? '—'}</p>
                    <p className="text-xs text-amber-600">Puntaje promedio</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {resultados.questionStats?.map((qs: any) => (
                    <div key={qs.questionId} className="border border-gray-100 rounded-xl p-4">
                      <p className="text-sm font-medium text-gray-800 mb-2">{qs.questionText}</p>
                      <p className="text-xs text-gray-500 mb-3">{qs.totalAnswers} respuestas</p>
                      {qs.avgScore != null && (
                        <div className="flex items-center gap-3">
                          <div className="flex-1 bg-gray-100 rounded-full h-2">
                            <div
                              className="bg-teal-500 h-2 rounded-full transition-all"
                              style={{ width: `${Math.min((qs.avgScore / 5) * 100, 100)}%` }}
                            />
                          </div>
                          <span className="text-sm font-bold text-teal-700 w-8 text-right">{qs.avgScore}</span>
                        </div>
                      )}
                      {qs.textAnswers?.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {qs.textAnswers.slice(0, 3).map((t: string, i: number) => (
                            <p key={i} className="text-xs text-gray-600 bg-gray-50 px-3 py-1.5 rounded-lg italic">"{t}"</p>
                          ))}
                        </div>
                      )}
                      {Object.keys(qs.optionCounts || {}).length > 0 && (
                        <div className="mt-2 space-y-1">
                          {Object.entries(qs.optionCounts).map(([opt, count]) => (
                            <div key={opt} className="flex items-center gap-2 text-xs">
                              <span className="w-24 truncate text-gray-600">{opt}</span>
                              <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                                <div
                                  className="bg-purple-400 h-1.5 rounded-full"
                                  style={{ width: `${qs.totalAnswers > 0 ? ((count as number) / qs.totalAnswers) * 100 : 0}%` }}
                                />
                              </div>
                              <span className="text-gray-500 w-6 text-right">{String(count)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {tab === 'ia' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">Análisis Inteligente</h3>
              <button
                onClick={runAiAnalysis}
                disabled={aiLoading}
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors"
              >
                <BrainCircuit className="w-3.5 h-3.5" />
                {aiLoading ? 'Analizando...' : 'Analizar con IA'}
              </button>
            </div>

            {!aiAnalysis ? (
              <div className="text-center py-10">
                <BrainCircuit className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-500">Hacé clic en "Analizar con IA" para obtener un análisis profundo de las respuestas</p>
                <p className="text-xs text-gray-400 mt-1">Requiere al menos 1 respuesta completa</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
                  <p className="text-xs font-semibold text-purple-700 mb-1">Resumen</p>
                  <p className="text-sm text-gray-700">{aiAnalysis.resumen}</p>
                </div>

                <div className="flex gap-3">
                  <div className={`flex-1 text-center p-3 rounded-xl font-semibold text-sm ${aiAnalysis.sentimiento === 'POSITIVO' ? 'bg-emerald-100 text-emerald-700' : aiAnalysis.sentimiento === 'NEGATIVO' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                    {aiAnalysis.sentimiento}
                  </div>
                  {aiAnalysis.indiceMedicion != null && (
                    <div className="flex-1 text-center p-3 rounded-xl bg-teal-50 font-semibold text-teal-700 text-sm">
                      Índice: {aiAnalysis.indiceMedicion}/100
                    </div>
                  )}
                </div>

                {aiAnalysis.fortalezas?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-600 mb-2">Fortalezas detectadas</p>
                    <div className="space-y-1.5">
                      {aiAnalysis.fortalezas.map((f: string, i: number) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-gray-700 bg-emerald-50 rounded-lg px-3 py-2">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                          {f}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {aiAnalysis.problemasDetectados?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-600 mb-2">Problemas detectados</p>
                    <div className="space-y-1.5">
                      {aiAnalysis.problemasDetectados.map((p: string, i: number) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-gray-700 bg-red-50 rounded-lg px-3 py-2">
                          <AlertCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 flex-shrink-0" />
                          {p}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {aiAnalysis.temasRecurrentes?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-600 mb-2">Temas recurrentes</p>
                    <div className="flex flex-wrap gap-2">
                      {aiAnalysis.temasRecurrentes.map((t: any, i: number) => (
                        <span key={i} className={`text-xs px-2.5 py-1 rounded-full border font-medium ${t.sentimiento === 'POSITIVO' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : t.sentimiento === 'NEGATIVO' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                          {t.tema} ({t.menciones})
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {aiAnalysis.recomendaciones?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-600 mb-2">Recomendaciones</p>
                    <div className="space-y-1.5">
                      {aiAnalysis.recomendaciones.map((r: string, i: number) => (
                        <div key={i} className="text-sm text-gray-700 bg-blue-50 rounded-lg px-3 py-2 flex items-start gap-2">
                          <span className="text-blue-500 font-bold text-xs mt-0.5">{i + 1}.</span>
                          {r}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => router.push('/clima/planes-accion')}
                  className="w-full text-sm text-teal-600 hover:text-teal-800 border border-teal-200 hover:border-teal-400 py-2.5 rounded-xl transition-colors font-medium"
                >
                  → Crear plan de acción desde este análisis
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
