'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  BrainCircuit, TrendingUp, TrendingDown, AlertTriangle, CheckCircle,
  Loader2, RefreshCw, ChevronRight, BarChart2, MessageSquare, Target, Lightbulb
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface TemaRecurrente {
  tema: string;
  menciones: number;
  sentimiento: 'POSITIVO' | 'NEUTRAL' | 'NEGATIVO';
  criticidad: 'BAJA' | 'MEDIA' | 'ALTA';
}

interface AnalisisGlobal {
  resumen: string;
  sentimiento: 'POSITIVO' | 'NEUTRAL' | 'NEGATIVO';
  indiceMedicion: number;
  fortalezas: string[];
  problemasDetectados: string[];
  temasRecurrentes: TemaRecurrente[];
  recomendaciones: string[];
  alertas: string[];
}

const SENTIMENT_CONFIG = {
  POSITIVO: { label: 'Positivo', color: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  NEUTRAL:  { label: 'Neutral',  color: 'bg-gray-400',    text: 'text-gray-600',    bg: 'bg-gray-50 border-gray-200' },
  NEGATIVO: { label: 'Negativo', color: 'bg-red-500',     text: 'text-red-700',     bg: 'bg-red-50 border-red-200' },
};

const CRITICIDAD_COLORS = {
  BAJA:  'bg-gray-100 text-gray-500 border-gray-200',
  MEDIA: 'bg-amber-50 text-amber-700 border-amber-200',
  ALTA:  'bg-orange-50 text-orange-700 border-orange-200',
};

export default function ClimaIAPage() {
  const router = useRouter();
  const [surveys, setSurveys] = useState<any[]>([]);
  const [selectedSurvey, setSelectedSurvey] = useState<string>('');
  const [analysis, setAnalysis] = useState<AnalisisGlobal | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingSurveys, setLoadingSurveys] = useState(true);
  const [totalResponses, setTotalResponses] = useState(0);
  const [avgScore, setAvgScore] = useState<number | null>(null);
  const [indicators, setIndicators] = useState<any>(null);

  useEffect(() => {
    Promise.all([
      apiFetch('/clima/encuestas') as Promise<any>,
      apiFetch('/clima/indicadores') as Promise<any>,
    ]).then(([encData, indData]) => {
      setSurveys(encData.surveys || []);
      setIndicators(indData);
    }).catch(() => {}).finally(() => setLoadingSurveys(false));
  }, []);

  async function runAnalysis() {
    if (!selectedSurvey) return;
    setLoading(true);
    setAnalysis(null);
    try {
      const data = await apiFetch(`/clima/encuestas/${selectedSurvey}/analisis-ia`, { method: 'POST' }) as any;
      setAnalysis(data.analysis);
      setTotalResponses(data.totalResponses || 0);
      setAvgScore(data.avgScore || null);
    } catch (e: any) {
      alert(e?.message || 'Error en análisis IA. Asegurate de tener respuestas cargadas.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow">
              <BrainCircuit className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">IA y Tendencias</h1>
              <p className="text-sm text-gray-500">Análisis inteligente de clima organizacional</p>
            </div>
          </div>
        </div>
      </div>

      {/* Indicadores globales rápidos */}
      {indicators && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Índice clima', value: indicators.indices?.clima != null ? `${indicators.indices.clima}/100` : '—', icon: BarChart2, color: 'bg-teal-500' },
            { label: 'Participación', value: indicators.indices?.participacion != null ? `${indicators.indices.participacion}%` : '—', icon: TrendingUp, color: 'bg-blue-500' },
            { label: 'Sugerencias abiertas', value: indicators.indices?.sugerenciasAbiertas ?? 0, icon: MessageSquare, color: 'bg-amber-500' },
            { label: 'Reclamos abiertos', value: indicators.indices?.reclamosAbiertos ?? 0, icon: AlertTriangle, color: indicators.indices?.reclamosAbiertos > 0 ? 'bg-red-500' : 'bg-gray-400' },
          ].map(k => (
            <div key={k.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${k.color}`}>
                <k.icon className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900">{String(k.value)}</p>
                <p className="text-xs text-gray-500">{k.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Selector de encuesta + botón analizar */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">Seleccionar encuesta para analizar</h2>
        <div className="flex gap-3">
          <select
            value={selectedSurvey}
            onChange={e => { setSelectedSurvey(e.target.value); setAnalysis(null); }}
            className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none bg-white focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 transition-all"
            disabled={loadingSurveys}
          >
            <option value="">— Seleccioná una encuesta —</option>
            {surveys.map(s => (
              <option key={s.id} value={s.id}>
                {s.title} {s.completedCount != null ? `(${s.completedCount} respuestas)` : ''}
              </option>
            ))}
          </select>
          <button
            onClick={runAnalysis}
            disabled={!selectedSurvey || loading}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-5 py-2.5 rounded-xl shadow transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BrainCircuit className="w-4 h-4" />}
            {loading ? 'Analizando...' : 'Analizar'}
          </button>
        </div>
        {selectedSurvey && !analysis && !loading && (
          <p className="text-xs text-gray-400">Hacé clic en "Analizar" para obtener el análisis de IA de esta encuesta</p>
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center space-y-4">
          <Loader2 className="w-12 h-12 text-purple-500 animate-spin mx-auto" />
          <p className="text-sm font-medium text-gray-700">Procesando respuestas con IA...</p>
          <p className="text-xs text-gray-400">Esto puede tomar unos segundos</p>
        </div>
      )}

      {/* Resultados */}
      {analysis && !loading && (
        <div className="space-y-5">
          {/* Stats bar */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-purple-50 rounded-2xl border border-purple-100 p-4 text-center">
              <p className="text-2xl font-bold text-purple-700">{totalResponses}</p>
              <p className="text-xs text-purple-600 mt-0.5">Respuestas analizadas</p>
            </div>
            <div className="bg-teal-50 rounded-2xl border border-teal-100 p-4 text-center">
              <p className="text-2xl font-bold text-teal-700">{analysis.indiceMedicion ?? '—'}/100</p>
              <p className="text-xs text-teal-600 mt-0.5">Índice de clima</p>
            </div>
            <div className={`rounded-2xl border p-4 text-center ${SENTIMENT_CONFIG[analysis.sentimiento]?.bg || 'bg-gray-50 border-gray-200'}`}>
              <p className={`text-2xl font-bold ${SENTIMENT_CONFIG[analysis.sentimiento]?.text || 'text-gray-700'}`}>
                {SENTIMENT_CONFIG[analysis.sentimiento]?.label || analysis.sentimiento}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">Sentimiento general</p>
            </div>
          </div>

          {/* Resumen */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <BrainCircuit className="w-4 h-4 text-purple-500" />
              <h3 className="text-sm font-semibold text-gray-700">Resumen ejecutivo</h3>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">{analysis.resumen}</p>
          </div>

          {/* Alertas */}
          {analysis.alertas?.length > 0 && (
            <div className="bg-red-50 rounded-2xl border border-red-200 p-5 space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <h3 className="text-sm font-semibold text-red-700">Alertas detectadas</h3>
              </div>
              {analysis.alertas.map((a, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-red-700">
                  <span className="text-red-400 mt-0.5">⚠</span>
                  {a}
                </div>
              ))}
            </div>
          )}

          {/* Fortalezas y Problemas */}
          <div className="grid md:grid-cols-2 gap-4">
            {analysis.fortalezas?.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  <h3 className="text-sm font-semibold text-gray-700">Fortalezas</h3>
                </div>
                <div className="space-y-2">
                  {analysis.fortalezas.map((f, i) => (
                    <div key={i} className="flex items-start gap-2 bg-emerald-50 rounded-xl px-3 py-2 text-sm text-gray-700">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                      {f}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {analysis.problemasDetectados?.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingDown className="w-4 h-4 text-red-500" />
                  <h3 className="text-sm font-semibold text-gray-700">Áreas de mejora</h3>
                </div>
                <div className="space-y-2">
                  {analysis.problemasDetectados.map((p, i) => (
                    <div key={i} className="flex items-start gap-2 bg-red-50 rounded-xl px-3 py-2 text-sm text-gray-700">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-400 mt-0.5 flex-shrink-0" />
                      {p}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Temas recurrentes */}
          {analysis.temasRecurrentes?.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <BarChart2 className="w-4 h-4 text-purple-500" />
                <h3 className="text-sm font-semibold text-gray-700">Temas recurrentes</h3>
              </div>
              <div className="space-y-2">
                {analysis.temasRecurrentes.sort((a, b) => b.menciones - a.menciones).map((t, i) => {
                  const maxMenciones = Math.max(...analysis.temasRecurrentes.map(x => x.menciones));
                  const pct = maxMenciones > 0 ? (t.menciones / maxMenciones) * 100 : 0;
                  const sentConf = SENTIMENT_CONFIG[t.sentimiento];
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs text-gray-600 w-36 truncate font-medium">{t.tema}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-2">
                        <div className={`h-2 rounded-full transition-all ${sentConf?.color || 'bg-gray-400'}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-gray-500 w-8 text-right">{t.menciones}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${CRITICIDAD_COLORS[t.criticidad] || 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                        {t.criticidad}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recomendaciones */}
          {analysis.recomendaciones?.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-semibold text-gray-700">Recomendaciones</h3>
              </div>
              <div className="space-y-2">
                {analysis.recomendaciones.map((r, i) => (
                  <div key={i} className="flex items-start gap-3 bg-amber-50 rounded-xl px-3 py-2.5 text-sm text-gray-700">
                    <span className="w-5 h-5 rounded-full bg-amber-200 text-amber-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                    {r}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CTA planes de acción */}
          <div className="bg-gradient-to-r from-teal-500 to-cyan-600 rounded-2xl p-5 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">¿Querés actuar sobre estos resultados?</h3>
                <p className="text-sm text-white/80 mt-1">Creá un plan de acción vinculado a este análisis</p>
              </div>
              <button
                onClick={() => router.push('/clima/planes-accion')}
                className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
              >
                <Target className="w-4 h-4" />
                Crear plan
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
