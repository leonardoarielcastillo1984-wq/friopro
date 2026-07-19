'use client';
import { useEffect, useState, useCallback, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  Gauge, TrendingUp, TrendingDown, Minus, GitCompare, X, Loader2,
  ShieldAlert, Target, ClipboardList, AlertTriangle, Activity, UsersRound, BarChart3,
  Sparkles, FileText, Network, ArrowRight, Compass, FolderKanban, CheckSquare, Flag,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { generateStrategicPDF } from './strategicReport';

// ── Tipos ──
interface Factor { key: string; label: string; points: number; max: number }
interface HealthDetail { key: string; label: string; penalty: number }
interface Counts { s: number; w: number; o: number; t: number; pestelFilled: number; dafoFilled: number; identityFilled: number; objTotal: number; objAchieved: number }
interface HistoryYear { year: number; score: number; band: string; s: number; w: number; o: number; t: number; pestelFilled: number; dafoFilled: number; objTotal: number; objAchieved: number }
interface Live {
  totalRisks: number; openRisks: number; highRisks: number;
  totalActions: number; openActions: number;
  totalNCs: number; openNCs: number;
  indicatorsTotal: number; indicatorsOnTarget: number;
  stakeholders: number; avgCompliance: number | null;
}
interface Dashboard {
  current: {
    year: number; score: number; contextScore: number; operationalHealth: number;
    band: string; bandLabel: string; bandEmoji: string;
    factors: Factor[]; healthDetail: HealthDetail[]; counts: Counts; hasContext: boolean;
  };
  history: HistoryYear[];
  live: Live;
}
interface ContextRow {
  year: number;
  strengths?: string[]; weaknesses?: string[]; opportunities?: string[]; threats?: string[];
  political?: string; economic?: string; social?: string; technological?: string; environmental?: string; legal?: string;
  mission?: string; vision?: string; values?: string;
  dafoFo?: string; dafoFa?: string; dafoDo?: string; dafoDa?: string;
}

const BAND_STYLES: Record<string, { bar: string; text: string; ring: string; bg: string }> = {
  green: { bar: 'bg-green-500', text: 'text-green-700', ring: 'ring-green-200', bg: 'bg-green-50' },
  yellow: { bar: 'bg-amber-500', text: 'text-amber-700', ring: 'ring-amber-200', bg: 'bg-amber-50' },
  red: { bar: 'bg-red-500', text: 'text-red-700', ring: 'ring-red-200', bg: 'bg-red-50' },
};

function arr(v?: string[] | null): string[] {
  return Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()) : [];
}

function VariationBadge({ delta }: { delta: number | null }) {
  if (delta === null) return <span className="inline-flex items-center gap-0.5 text-xs text-gray-400"><Minus className="h-3 w-3" />—</span>;
  if (delta > 0) return <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-green-600"><TrendingUp className="h-3 w-3" />+{delta}%</span>;
  if (delta < 0) return <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-red-600"><TrendingDown className="h-3 w-3" />{delta}%</span>;
  return <span className="inline-flex items-center gap-0.5 text-xs text-gray-500"><Minus className="h-3 w-3" />0%</span>;
}

export default function StrategicPanel({ year, refreshKey = 0 }: { year: number; refreshKey?: number }) {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Comparador
  const [showCompare, setShowCompare] = useState(false);
  const [cmpA, setCmpA] = useState<number | null>(null);
  const [cmpB, setCmpB] = useState<number | null>(null);
  const [cmpLoading, setCmpLoading] = useState(false);
  const [cmpResult, setCmpResult] = useState<{ a: ContextRow; b: ContextRow } | null>(null);

  // Revisión IA / PDF / Mapa
  const router = useRouter();
  const [showReview, setShowReview] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewText, setReviewText] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);
  const [showMap, setShowMap] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await apiFetch<Dashboard>(`/context/strategic-dashboard?year=${year}&_r=${refreshKey}`);
      setData(res);
    } catch (e: any) {
      setError(e?.message || 'Error al cargar el panel estratégico');
    } finally {
      setLoading(false);
    }
  }, [year, refreshKey]);

  useEffect(() => { load(); }, [load]);

  const openCompare = () => {
    const years = (data?.history || []).map((h) => h.year).sort((a, b) => b - a);
    setCmpB(years[0] ?? year);
    setCmpA(years[1] ?? years[0] ?? year - 1);
    setCmpResult(null);
    setShowCompare(true);
  };

  const runCompare = async () => {
    if (cmpA === null || cmpB === null) return;
    setCmpLoading(true); setCmpResult(null);
    try {
      const [ra, rb] = await Promise.all([
        apiFetch<{ item: ContextRow | null }>(`/context/${cmpA}`),
        apiFetch<{ item: ContextRow | null }>(`/context/${cmpB}`),
      ]);
      setCmpResult({ a: ra?.item || { year: cmpA }, b: rb?.item || { year: cmpB } });
    } catch (e: any) {
      alert('Error al comparar: ' + (e?.message || 'desconocido'));
    } finally {
      setCmpLoading(false);
    }
  };

  const runReview = async () => {
    setShowReview(true); setReviewLoading(true); setReviewText('');
    try {
      const res = await apiFetch<{ review: string }>(`/context/strategic-review`, { method: 'POST', json: { year } });
      setReviewText(res?.review || 'Sin respuesta del modelo.');
    } catch (e: any) {
      setReviewText('Error al generar la revisión: ' + (e?.message || 'desconocido'));
    } finally { setReviewLoading(false); }
  };

  const doPDF = async () => {
    if (!data) return;
    setPdfLoading(true);
    try {
      const res = await apiFetch<{ item: ContextRow | null }>(`/context/${year}`);
      generateStrategicPDF({
        year,
        dashboard: data,
        context: res?.item || { year },
        review: reviewText || undefined,
      });
    } catch (e: any) {
      alert('Error al generar el PDF: ' + (e?.message || 'desconocido'));
    } finally { setPdfLoading(false); }
  };

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-6 flex items-center gap-3 text-gray-500">
        <Loader2 className="h-5 w-5 animate-spin" /> Calculando estado estratégico...
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-4 text-sm text-gray-500">
        {error || 'Sin datos estratégicos.'}
      </div>
    );
  }

  const { current, history, live } = data;
  const bs = BAND_STYLES[current.band] || BAND_STYLES.yellow;
  const maxScore = Math.max(100, ...history.map((h) => h.score));

  // Tendencias: comparar los dos últimos años del historial
  const sorted = [...history].sort((a, b) => a.year - b.year);
  const lastTwo = sorted.slice(-2);
  const trendPct = (a?: number, b?: number) => {
    if (a === undefined || b === undefined || a === 0) return b && b > 0 ? 100 : null;
    return Math.round(((b - a) / a) * 100);
  };

  return (
    <>
      {/* ══ Estado Estratégico del SGI ══ */}
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold">Estado Estratégico del SGI</h2>
            <span className="text-xs text-gray-400">Año {current.year}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={openCompare} className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
              <GitCompare className="h-4 w-4 text-blue-600" /> Comparar
            </button>
            <button onClick={() => setShowMap((v) => !v)} className={`flex items-center gap-2 px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50 ${showMap ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-gray-200'}`}>
              <Network className="h-4 w-4 text-blue-600" /> Mapa
            </button>
            <button onClick={doPDF} disabled={pdfLoading} className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50">
              {pdfLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4 text-blue-600" />} Informe Ejecutivo
            </button>
            <button onClick={runReview} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700">
              <Sparkles className="h-4 w-4" /> Revisión con IA
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Score principal */}
          <div className={`rounded-xl ring-1 ${bs.ring} ${bs.bg} p-5 flex flex-col justify-center`}>
            <div className="flex items-end gap-2">
              <span className={`text-4xl font-bold ${bs.text}`}>{current.score}%</span>
              <span className="text-lg mb-1">{current.bandEmoji}</span>
            </div>
            <div className={`text-sm font-medium ${bs.text} mt-0.5`}>{current.bandLabel}</div>
            <div className="mt-3 h-3 bg-white/70 rounded-full overflow-hidden">
              <div className={`h-full ${bs.bar} rounded-full transition-all`} style={{ width: `${current.score}%` }} />
            </div>
            <div className="flex justify-between text-[11px] text-gray-500 mt-2">
              <span>Contexto: <b>{current.contextScore}%</b></span>
              <span>Operativo: <b>{current.operationalHealth}%</b></span>
            </div>
            {!current.hasContext && (
              <p className="text-[11px] text-amber-600 mt-2">No hay contexto cargado para {current.year}. El score refleja solo datos operativos.</p>
            )}
          </div>

          {/* Factores del score */}
          <div className="lg:col-span-2">
            <p className="text-xs font-semibold text-gray-500 mb-2">Composición del índice (algoritmo extensible)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
              {current.factors.map((f) => {
                const pct = f.max > 0 ? Math.round((f.points / f.max) * 100) : 0;
                return (
                  <div key={f.key}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-gray-600">{f.label}</span>
                      <span className="text-gray-500 font-medium">{f.points}/{f.max}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-400'}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ══ Mapa Estratégico (navegable) ══ */}
      {showMap && (
        <section className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Network className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold">Mapa Estratégico</h2>
            <span className="text-xs text-gray-400">Trazabilidad del SGI — hacé clic en cada nodo</span>
          </div>
          <div className="flex flex-wrap items-center gap-y-3">
            {([
              { label: 'PESTEL', desc: `${current.counts.pestelFilled}/6 factores`, icon: <Activity className="h-4 w-4" />, go: () => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }) },
              { label: 'FODA', desc: `${current.counts.s + current.counts.w + current.counts.o + current.counts.t} ítems`, icon: <Compass className="h-4 w-4" />, go: () => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }) },
              { label: 'DAFO', desc: `${current.counts.dafoFilled}/4 estrategias`, icon: <GitCompare className="h-4 w-4" />, go: () => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }) },
              { label: 'Objetivos', desc: `${current.counts.objTotal}`, icon: <Target className="h-4 w-4" />, go: () => router.push('/objetivos') },
              { label: 'Indicadores', desc: `${live.indicatorsTotal}`, icon: <Activity className="h-4 w-4" />, go: () => router.push('/indicadores') },
              { label: 'Proyectos', desc: 'Project360', icon: <FolderKanban className="h-4 w-4" />, go: () => router.push('/proyectos') },
              { label: 'Riesgos', desc: `${live.openRisks} abiertos`, icon: <ShieldAlert className="h-4 w-4" />, go: () => router.push('/riesgos') },
              { label: 'Acciones', desc: `${live.openActions} abiertas`, icon: <CheckSquare className="h-4 w-4" />, go: () => router.push('/acciones') },
              { label: 'Resultados', desc: 'Dashboard', icon: <Flag className="h-4 w-4" />, go: () => router.push('/dashboard') },
            ]).map((n, i, all) => (
              <div key={n.label} className="flex items-center">
                <button onClick={n.go} className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition min-w-[92px]">
                  <span className="text-blue-600">{n.icon}</span>
                  <span className="text-xs font-semibold text-gray-700">{n.label}</span>
                  <span className="text-[10px] text-gray-400">{n.desc}</span>
                </button>
                {i < all.length - 1 && <ArrowRight className="h-4 w-4 text-gray-300 mx-1 shrink-0" />}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ══ Dashboard ejecutivo ══ */}
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="h-5 w-5 text-blue-600" />
          <h2 className="text-lg font-semibold">Dashboard Estratégico</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <MetricCard label="Fortalezas" value={current.counts.s} color="text-green-600" icon={<TrendingUp className="h-4 w-4" />} />
          <MetricCard label="Debilidades" value={current.counts.w} color="text-red-600" icon={<TrendingDown className="h-4 w-4" />} />
          <MetricCard label="Oportunidades" value={current.counts.o} color="text-blue-600" icon={<Target className="h-4 w-4" />} />
          <MetricCard label="Amenazas" value={current.counts.t} color="text-orange-600" icon={<AlertTriangle className="h-4 w-4" />} />
          <MetricCard label="Estrategias DAFO" value={`${current.counts.dafoFilled}/4`} color="text-violet-600" icon={<GitCompare className="h-4 w-4" />} />
          <MetricCard label="PESTEL" value={`${current.counts.pestelFilled}/6`} color="text-teal-600" icon={<Activity className="h-4 w-4" />} />
          <MetricCard label="Objetivos" value={current.counts.objTotal} sub={`${current.counts.objAchieved} logrados`} color="text-indigo-600" icon={<Target className="h-4 w-4" />} />
          <MetricCard label="Riesgos abiertos" value={live.openRisks} sub={`${live.highRisks} altos`} color="text-rose-600" icon={<ShieldAlert className="h-4 w-4" />} />
          <MetricCard label="Acciones abiertas" value={live.openActions} sub={`${live.totalActions} total`} color="text-amber-600" icon={<ClipboardList className="h-4 w-4" />} />
          <MetricCard label="NC abiertas" value={live.openNCs} sub={`${live.totalNCs} total`} color="text-red-600" icon={<AlertTriangle className="h-4 w-4" />} />
          <MetricCard label="Indicadores" value={live.indicatorsTotal} sub={`${live.indicatorsOnTarget} en meta`} color="text-cyan-600" icon={<Activity className="h-4 w-4" />} />
          <MetricCard label="Partes interesadas" value={live.stakeholders} sub={live.avgCompliance !== null ? `${live.avgCompliance}% cumpl.` : undefined} color="text-fuchsia-600" icon={<UsersRound className="h-4 w-4" />} />
        </div>
      </section>

      {/* ══ Evolución histórica + Tendencias ══ */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Evolución del score */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold">Evolución Estratégica</h2>
          </div>
          {history.length === 0 ? (
            <p className="text-sm text-gray-400">Aún no hay años cargados.</p>
          ) : (
            <>
              <div className="flex items-end gap-3 h-40 border-b border-gray-100 pb-1">
                {sorted.map((h) => {
                  const st = BAND_STYLES[h.band] || BAND_STYLES.yellow;
                  return (
                    <div key={h.year} className="flex-1 flex flex-col items-center justify-end gap-1 group">
                      <span className="text-xs font-semibold text-gray-700">{h.score}%</span>
                      <div className={`w-full ${st.bar} rounded-t-md transition-all`} style={{ height: `${Math.max(6, (h.score / maxScore) * 120)}px` }} title={`${h.year}: ${h.score}%`} />
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-3 mt-2">
                {sorted.map((h, i) => {
                  const prev = i > 0 ? sorted[i - 1].score : null;
                  const delta = prev !== null ? h.score - prev : null;
                  return (
                    <div key={h.year} className="flex-1 flex flex-col items-center">
                      <span className="text-xs text-gray-500">{h.year}</span>
                      <VariationBadge delta={delta} />
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Tendencias FODA */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold">Tendencias</h2>
          </div>
          {lastTwo.length < 2 ? (
            <p className="text-sm text-gray-400">Se necesitan al menos dos años para calcular tendencias.</p>
          ) : (
            <div className="space-y-3">
              {([
                ['Amenazas', 't', 'text-orange-600'],
                ['Oportunidades', 'o', 'text-blue-600'],
                ['Fortalezas', 's', 'text-green-600'],
                ['Debilidades', 'w', 'text-red-600'],
              ] as const).map(([label, key, color]) => {
                const a = lastTwo[0][key] as number;
                const b = lastTwo[1][key] as number;
                const pct = trendPct(a, b);
                return (
                  <div key={key} className="flex items-center justify-between">
                    <span className={`text-sm font-medium ${color}`}>{label}</span>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-gray-400">{lastTwo[0].year} → {lastTwo[1].year}</span>
                      <span className="text-gray-700 font-semibold tabular-nums">{a} → {b}</span>
                      <VariationBadge delta={pct} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ══ Modal Comparar Contextos ══ */}
      {showCompare && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white">
              <div className="flex items-center gap-2">
                <GitCompare className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-semibold">Comparar Contextos</h2>
              </div>
              <button onClick={() => setShowCompare(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-end gap-3 flex-wrap">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Año base</label>
                  <select value={cmpA ?? ''} onChange={(e) => setCmpA(parseInt(e.target.value))} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                    {history.map((h) => <option key={h.year} value={h.year}>{h.year}</option>)}
                  </select>
                </div>
                <span className="pb-2 text-gray-400">vs</span>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Año comparado</label>
                  <select value={cmpB ?? ''} onChange={(e) => setCmpB(parseInt(e.target.value))} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                    {history.map((h) => <option key={h.year} value={h.year}>{h.year}</option>)}
                  </select>
                </div>
                <button onClick={runCompare} disabled={cmpLoading || cmpA === cmpB} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50 flex items-center gap-2">
                  {cmpLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitCompare className="h-4 w-4" />} Comparar
                </button>
              </div>

              {cmpResult && <CompareResult a={cmpResult.a} b={cmpResult.b} />}
            </div>
          </div>
        </div>
      )}

      {/* ══ Modal Revisión Estratégica con IA ══ */}
      {showReview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-violet-600" />
                <h2 className="text-lg font-semibold">Revisión Estratégica con IA — {year}</h2>
              </div>
              <div className="flex items-center gap-2">
                {!reviewLoading && reviewText && (
                  <>
                    <button onClick={doPDF} disabled={pdfLoading} className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50 flex items-center gap-1.5 disabled:opacity-50">
                      {pdfLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} PDF
                    </button>
                    <button onClick={runReview} className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50">Regenerar</button>
                  </>
                )}
                <button onClick={() => setShowReview(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="p-6">
              {reviewLoading ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                  <Sparkles className="w-8 h-8 text-violet-500 animate-pulse mb-3" />
                  <p className="text-sm">Analizando el contexto estratégico con IA...</p>
                </div>
              ) : (
                <div className="prose prose-sm max-w-none">{renderMarkdown(reviewText)}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function renderMarkdown(txt: string): ReactNode {
  return txt.split('\n').map((line, i) => {
    if (line.startsWith('## ')) return <h3 key={i} className="text-base font-bold text-violet-700 mt-4 mb-1">{line.slice(3)}</h3>;
    if (line.startsWith('# ')) return <h2 key={i} className="text-lg font-bold mt-4 mb-1">{line.slice(2)}</h2>;
    if (/^\s*[-*]\s+/.test(line)) return <li key={i} className="ml-5 list-disc text-sm text-gray-700">{line.replace(/^\s*[-*]\s+/, '').replace(/\*\*/g, '')}</li>;
    if (!line.trim()) return <div key={i} className="h-2" />;
    return <p key={i} className="text-sm text-gray-700">{line.replace(/\*\*/g, '')}</p>;
  });
}

function MetricCard({ label, value, sub, color, icon }: { label: string; value: number | string; sub?: string; color: string; icon: ReactNode }) {
  return (
    <div className="border border-gray-200 rounded-lg p-3">
      <div className={`flex items-center gap-1 ${color}`}>{icon}<span className="text-xl font-bold">{value}</span></div>
      <div className="text-[11px] text-gray-500 leading-tight mt-0.5">{label}</div>
      {sub && <div className="text-[10px] text-gray-400">{sub}</div>}
    </div>
  );
}

function DiffList({ title, added, removed }: { title: string; added: string[]; removed: string[] }) {
  if (added.length === 0 && removed.length === 0) {
    return (
      <div>
        <p className="text-xs font-semibold text-gray-600 mb-1">{title}</p>
        <p className="text-xs text-gray-400">Sin cambios</p>
      </div>
    );
  }
  return (
    <div>
      <p className="text-xs font-semibold text-gray-600 mb-1">{title}</p>
      <ul className="space-y-0.5">
        {added.map((x, i) => <li key={`a${i}`} className="text-xs text-green-700">+ {x}</li>)}
        {removed.map((x, i) => <li key={`r${i}`} className="text-xs text-red-600 line-through opacity-70">− {x}</li>)}
      </ul>
    </div>
  );
}

function CompareResult({ a, b }: { a: ContextRow; b: ContextRow }) {
  const diff = (ka: string[], kb: string[]) => {
    const added = kb.filter((x) => !ka.some((y) => y.toLowerCase().trim() === x.toLowerCase().trim()));
    const removed = ka.filter((x) => !kb.some((y) => y.toLowerCase().trim() === x.toLowerCase().trim()));
    return { added, removed };
  };
  const s = diff(arr(a.strengths), arr(b.strengths));
  const w = diff(arr(a.weaknesses), arr(b.weaknesses));
  const o = diff(arr(a.opportunities), arr(b.opportunities));
  const t = diff(arr(a.threats), arr(b.threats));

  const pestel: [string, keyof ContextRow][] = [
    ['Político', 'political'], ['Económico', 'economic'], ['Social', 'social'],
    ['Tecnológico', 'technological'], ['Ambiental', 'environmental'], ['Legal', 'legal'],
  ];
  const changedText = (key: keyof ContextRow) => (String(a[key] || '').trim() !== String(b[key] || '').trim());
  const pestelChanges = pestel.filter(([, k]) => changedText(k));
  const missionChanged = changedText('mission');
  const visionChanged = changedText('vision');
  const valuesChanged = changedText('values');

  return (
    <div className="border border-gray-200 rounded-xl p-4 space-y-4">
      <p className="text-sm font-semibold text-gray-800">{a.year} vs {b.year}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <DiffList title="Fortalezas" added={s.added} removed={s.removed} />
        <DiffList title="Debilidades" added={w.added} removed={w.removed} />
        <DiffList title="Oportunidades" added={o.added} removed={o.removed} />
        <DiffList title="Amenazas" added={t.added} removed={t.removed} />
      </div>
      <div className="border-t border-gray-100 pt-3">
        <p className="text-xs font-semibold text-gray-600 mb-1">Cambios PESTEL</p>
        {pestelChanges.length === 0 ? <p className="text-xs text-gray-400">Sin cambios</p> : (
          <div className="flex flex-wrap gap-1.5">
            {pestelChanges.map(([label]) => <span key={label} className="px-2 py-0.5 text-xs rounded-full bg-amber-50 text-amber-700 border border-amber-200">{label} modificado</span>)}
          </div>
        )}
      </div>
      <div className="border-t border-gray-100 pt-3 flex flex-wrap gap-1.5">
        {missionChanged && <span className="px-2 py-0.5 text-xs rounded-full bg-blue-50 text-blue-700 border border-blue-200">Misión modificada</span>}
        {visionChanged && <span className="px-2 py-0.5 text-xs rounded-full bg-blue-50 text-blue-700 border border-blue-200">Visión modificada</span>}
        {valuesChanged && <span className="px-2 py-0.5 text-xs rounded-full bg-blue-50 text-blue-700 border border-blue-200">Valores modificados</span>}
        {!missionChanged && !visionChanged && !valuesChanged && <span className="text-xs text-gray-400">Identidad sin cambios</span>}
      </div>
    </div>
  );
}
