'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft, ClipboardList, Users, CheckCircle, Clock, Send,
  BarChart2, BrainCircuit, AlertCircle, Plus, Download, Trash2, X, ClipboardCheck, CheckCircle2
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
  const [showCapaModal, setShowCapaModal] = useState(false);
  const [capaContext, setCapaContext] = useState<{ title: string; description: string } | null>(null);
  const [capaForm, setCapaForm] = useState({ title: '', description: '', criticality: 'MEDIA', dueDate: '', createNcr: false });
  const [ncrCreada, setNcrCreada] = useState<{ id: string; code: string } | null>(null);
  const [savingCapa, setSavingCapa] = useState(false);
  const [capaCreada, setCapaCreada] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  async function handleDelete() {
    if (!confirm('¿Eliminar esta encuesta? Esta acción no se puede deshacer.')) return;
    setDeleting(true);
    try {
      await apiFetch(`/clima/encuestas/${id}`, { method: 'DELETE' });
      router.push('/clima/encuestas');
    } catch { alert('Error al eliminar'); setDeleting(false); }
  }

  function openCapa(title: string, description: string) {
    setCapaForm({ title, description, criticality: 'MEDIA', dueDate: '', createNcr: false });
    setCapaCreada(false);
    setNcrCreada(null);
    setShowCapaModal(true);
  }

  async function handleCrearCapa(e: React.FormEvent) {
    e.preventDefault();
    setSavingCapa(true);
    try {
      const res = await apiFetch('/clima/planes-accion', {
        method: 'POST',
        json: { title: capaForm.title, description: capaForm.description, criticality: capaForm.criticality, dueDate: capaForm.dueDate || undefined, surveyId: id, origin: 'ENCUESTA', createNcr: capaForm.createNcr },
      }) as any;
      setCapaCreada(true);
      if (res?.ncr) setNcrCreada({ id: res.ncr.id, code: res.ncr.code });
      setShowCapaModal(false);
    } catch { alert('Error al crear CAPA'); } finally { setSavingCapa(false); }
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
            const url = `${apiUrl}/clima/encuestas/${id}/exportar-csv`;
            const a = document.createElement('a'); a.href = url; a.click();
          }}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 hover:border-gray-400 px-3 py-2.5 rounded-xl transition-colors"
        >
          <Download className="w-4 h-4" />
          CSV
        </button>
        <button onClick={handleDelete} disabled={deleting}
          className="p-2.5 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-xl transition-colors border border-gray-200" title="Eliminar encuesta">
          <Trash2 className="w-4 h-4" />
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

                {/* CAPA global desde resultados */}
                {capaCreada && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-xl px-4 py-2.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="font-medium">CAPA creada correctamente</span>
                      <button onClick={() => router.push('/clima/planes-accion')} className="ml-auto text-xs underline">Ver planes</button>
                    </div>
                    {ncrCreada && (
                      <div className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 rounded-xl px-4 py-2.5">
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="font-medium">NCR {ncrCreada.code} creada en módulo general</span>
                        <button onClick={() => router.push(`/no-conformidades`)} className="ml-auto text-xs underline">Ver NCR</button>
                      </div>
                    )}
                  </div>
                )}
                {!capaCreada && (
                  <button onClick={() => openCapa(`Mejora encuesta: ${survey.title}`, `Hallazgos detectados en resultados de la encuesta "${survey.title}"`)}
                    className="w-full flex items-center justify-center gap-2 text-sm text-purple-700 border border-purple-200 hover:bg-purple-50 py-2.5 rounded-xl transition-colors font-medium">
                    <ClipboardCheck className="w-4 h-4" />
                    Crear plan de acción (CAPA) desde estos resultados
                  </button>
                )}

                <div className="space-y-4">
                  {resultados.questionStats?.map((qs: any) => (
                    <div key={qs.questionId} className="border border-gray-100 rounded-xl p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="text-sm font-medium text-gray-800">{qs.questionText}</p>
                        {qs.avgScore != null && qs.avgScore <= 3 && (
                          <button onClick={() => openCapa(`Bajo puntaje: ${qs.questionText}`, `Pregunta con puntaje promedio ${qs.avgScore}/5 en la encuesta "${survey.title}"`)}
                            className="flex-shrink-0 text-xs text-purple-600 border border-purple-200 hover:bg-purple-50 px-2.5 py-1 rounded-lg transition-colors font-medium whitespace-nowrap">
                            + CAPA
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mb-3">{qs.totalAnswers} respuestas</p>
                      {qs.avgScore != null && (
                        <div className="flex items-center gap-3">
                          <div className="flex-1 bg-gray-100 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${qs.avgScore <= 2.5 ? 'bg-red-400' : qs.avgScore <= 3.5 ? 'bg-amber-400' : 'bg-teal-500'}`}
                              style={{ width: `${Math.min((qs.avgScore / 5) * 100, 100)}%` }}
                            />
                          </div>
                          <span className={`text-sm font-bold w-8 text-right ${qs.avgScore <= 2.5 ? 'text-red-600' : qs.avgScore <= 3.5 ? 'text-amber-600' : 'text-teal-700'}`}>{qs.avgScore}</span>
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

                {capaCreada ? (
                  <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-xl px-4 py-2.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="font-medium">CAPA creada correctamente</span>
                    <button onClick={() => router.push('/clima/planes-accion')} className="ml-auto text-xs underline">Ver planes</button>
                  </div>
                ) : (
                  <button
                    onClick={() => openCapa(`Plan IA: ${survey.title}`, `${aiAnalysis.resumen}\n\nProblemas: ${(aiAnalysis.problemasDetectados || []).join(', ')}\n\nRecomendaciones: ${(aiAnalysis.recomendaciones || []).join(', ')}`)}
                    className="w-full flex items-center justify-center gap-2 text-sm text-purple-700 border border-purple-200 hover:bg-purple-50 py-2.5 rounded-xl transition-colors font-medium"
                  >
                    <ClipboardCheck className="w-4 h-4" />
                    Crear plan de acción (CAPA) desde análisis IA
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* CAPA Modal */}
      {showCapaModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Nuevo Plan de Acción (CAPA)</h3>
              <button onClick={() => setShowCapaModal(false)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleCrearCapa} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Título *</label>
                <input type="text" required value={capaForm.title} onChange={e => setCapaForm(p => ({ ...p, title: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Descripción</label>
                <textarea value={capaForm.description} onChange={e => setCapaForm(p => ({ ...p, description: e.target.value }))}
                  rows={3} className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Criticidad</label>
                  <select value={capaForm.criticality} onChange={e => setCapaForm(p => ({ ...p, criticality: e.target.value }))}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none bg-white">
                    {['BAJA','MEDIA','ALTA','CRITICA'].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Fecha límite</label>
                  <input type="date" value={capaForm.dueDate} onChange={e => setCapaForm(p => ({ ...p, dueDate: e.target.value }))}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={capaForm.createNcr} onChange={e => setCapaForm(p => ({ ...p, createNcr: e.target.checked }))}
                  className="rounded border-gray-300" />
                Crear también como NCR en módulo general
              </label>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCapaModal(false)} className="flex-1 text-sm text-gray-600 border border-gray-200 py-2.5 rounded-xl hover:bg-gray-50">Cancelar</button>
                <button type="submit" disabled={savingCapa} className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white text-sm font-medium py-2.5 rounded-xl transition-colors">
                  {savingCapa ? 'Guardando...' : 'Crear CAPA'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
