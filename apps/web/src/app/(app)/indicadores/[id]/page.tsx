'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import type { Indicator, IndicatorMeasurement, IndicatorStatus } from '@/lib/types';
import IndicatorErrorBoundary from '@/components/indicator-error-boundary';
import {
  ArrowLeft, Edit3, Trash2, AlertCircle, BarChart3,
  TrendingUp, TrendingDown, Minus, Target, User,
  Calendar, Plus, Sparkles, Loader2,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

const FREQ_LABELS: Record<string, string> = {
  DAILY: 'Diaria', WEEKLY: 'Semanal', MONTHLY: 'Mensual',
  QUARTERLY: 'Trimestral', YEARLY: 'Anual',
};

const TREND_ICON: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  UP: { icon: <TrendingUp className="h-4 w-4" />, label: 'Subiendo', color: 'text-green-600' },
  DOWN: { icon: <TrendingDown className="h-4 w-4" />, label: 'Bajando', color: 'text-red-600' },
  STABLE: { icon: <Minus className="h-4 w-4" />, label: 'Estable', color: 'text-neutral-500' },
};

export default function IndicatorDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  // All state hooks must be at the top - BEFORE any conditional logic
  const [indicator, setIndicator] = useState<Indicator | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    targetValue: 0,
    unit: '',
    frequency: 'MONTHLY',
  });
  const [showMeasForm, setShowMeasForm] = useState(false);
  const [measValue, setMeasValue] = useState('');
  const [measPeriod, setMeasPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [measSaving, setMeasSaving] = useState(false);
  const [showNcr, setShowNcr] = useState(false);
  const [ncrSaving, setNcrSaving] = useState(false);
  const [riskQuery, setRiskQuery] = useState('');
  const [riskResults, setRiskResults] = useState<Array<{ id: string; code: string; title: string; probability: number; impact: number; riskLevel: number; process?: string | null }>>([]);
  const [riskSearching, setRiskSearching] = useState(false);
  const [suggestedRisks, setSuggestedRisks] = useState<Array<{ id: string; code: string; title: string; probability: number; impact: number; riskLevel: number; process?: string | null }>>([]);
  const [linkingRiskId, setLinkingRiskId] = useState<string | null>(null);
  const [unlinkingLinkId, setUnlinkingLinkId] = useState<string | null>(null);
  const [applyingRiskId, setApplyingRiskId] = useState<string | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [aiAnalysisLoading, setAiAnalysisLoading] = useState(false);

  async function runDeviationAnalysis() {
    if (!indicator) return;
    setAiAnalysisLoading(true);
    setAiAnalysis(null);
    try {
      const measurements = indicator.measurements ?? [];
      const last3 = measurements.slice(0, 3).map((m: any) => `${m.period}: ${m.value} ${indicator.unit}`).join(', ');
      const prompt = `Eres un experto en sistemas de gestión ISO y análisis de indicadores. Para este indicador:\nNombre: ${indicator.name}\nProceso: ${indicator.process || '—'}\nValor actual: ${indicator.currentValue ?? '—'} ${indicator.unit}\nMeta: ${indicator.targetValue ?? '—'} ${indicator.unit}\nCumplimiento: ${Math.round(indicator.targetValue ? ((indicator.currentValue ?? 0) / indicator.targetValue) * 100 : 0)}%\nTendencia: ${indicator.trend}\nÚltimas mediciones: ${last3 || '(sin datos)'}\n\nAnalizá las posibles causas del desvío y sugerí 3 acciones concretas para retomar la meta. Formato: primero causas probables (2-3 bullets), luego acciones (numeradas).`;
      const res = await apiFetch<{ response?: string; text?: string }>('/ai/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: prompt }),
      });
      setAiAnalysis(res?.response || res?.text || '');
    } catch (e: any) {
      alert('Error IA: ' + (e?.message || 'desconocido'));
    } finally {
      setAiAnalysisLoading(false);
    }
  }

  // All useEffect hooks must be here, BEFORE any conditional returns
  useEffect(() => { 
    if (!id) return;
    loadIndicator(); 
  }, [id]);

  // Derived values with useMemo - must be before conditional returns
  const derivedValues = useMemo(() => {
    if (!indicator) return null;
    const e = indicator._enriched;
    const trend = TREND_ICON[indicator.trend] ?? TREND_ICON.STABLE;
    const pct = e?.compliance ?? (indicator.targetValue ? Math.min(((indicator.currentValue ?? 0) / indicator.targetValue) * 100, 100) : 0);
    const status = indicator.status ?? 'NO_DATA';
    const safeStatus = ['ON_TARGET', 'WARNING', 'OFF_TARGET', 'NO_DATA'].includes(status) ? status as IndicatorStatus : 'NO_DATA';
    const isOnTarget = safeStatus === 'ON_TARGET';
    const isWarning = safeStatus === 'WARNING';
    const isOffTarget = safeStatus === 'OFF_TARGET';
    const measurements = indicator.measurements ?? [];
    const lastMeas = measurements[0] ?? null;
    const dueAt = indicator.nextDueAt ? new Date(indicator.nextDueAt).getTime() : null;
    const isOverdue = dueAt ? Date.now() > dueAt : false;
    const canSuggestNcr = isOffTarget && (indicator.offTargetStreak ?? 0) >= (indicator.ncrTriggerStreak ?? 2);
    const linked = indicator.riskLinks ?? [];
    const linkedRiskIds = new Set(linked.map((l: any) => l.risk?.id));
    
    return {
      trend, pct, status, safeStatus, isOnTarget, isWarning, isOffTarget,
      measurements, lastMeas, isOverdue, canSuggestNcr, linked, linkedRiskIds,
      enriched: e,
    };
  }, [indicator]);

  // Effects that depend on derived values
  useEffect(() => {
    if (!indicator?.process || indicator.process.trim() === '') {
      setSuggestedRisks([]);
      return;
    }
    setRiskSearching(true);
    const linkedRiskIds = derivedValues?.linkedRiskIds ?? new Set();
    
    apiFetch<{ risks: any[] }>(`/risks?process=${encodeURIComponent(indicator.process)}`)
      .then((res) => {
        const items = (res.risks ?? []).filter((r: any) => !linkedRiskIds.has(r.id));
        setSuggestedRisks(items);
      })
      .catch(() => setSuggestedRisks([]))
      .finally(() => setRiskSearching(false));
  }, [indicator?.process, indicator?.id, derivedValues?.linkedRiskIds]);

  useEffect(() => {
    const q = riskQuery.trim();
    if (q.length < 2) {
      setRiskResults([]);
      return;
    }
    let cancelled = false;
    setRiskSearching(true);
    apiFetch<{ risks: any[] }>(`/risks?q=${encodeURIComponent(q)}`)
      .then((res) => {
        if (cancelled) return;
        setRiskResults(res.risks ?? []);
      })
      .catch(() => setRiskResults([]))
      .finally(() => setRiskSearching(false));
    return () => { cancelled = true; };
  }, [riskQuery]);

  async function loadIndicator() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ indicator: Indicator }>(`/indicators/${id}`);
      
      // Validate response data
      if (!res || !res.indicator) {
        throw new Error('Respuesta inválida del servidor');
      }
      
      if (!res.indicator.id || !res.indicator.name) {
        throw new Error('Datos del indicador incompletos');
      }
      
      setIndicator(res.indicator);
      setEditForm({
        targetValue: res.indicator.targetValue ?? 0,
        unit: res.indicator.unit,
        frequency: res.indicator.frequency,
      });
    } catch (err: any) {
      console.error('Error loading indicator:', err);
      setError(err?.message ?? 'Error al cargar indicador');
      if (err?.message === 'Unauthorized') router.push('/login');
    } finally {
      setLoading(false);
    }
  }

  async function linkRisk(riskId: string) {
    setLinkingRiskId(riskId);
    setError(null);
    try {
      await apiFetch(`/indicators/${id}/risk-links`, {
        method: 'POST',
        json: { riskId },
      });
      await loadIndicator();
    } catch (err: any) {
      setError(err?.message ?? 'Error al vincular riesgo');
    } finally {
      setLinkingRiskId(null);
    }
  }

  async function unlinkRisk(linkId: string) {
    setUnlinkingLinkId(linkId);
    setError(null);
    try {
      await apiFetch(`/indicators/${id}/risk-links/${linkId}`, { method: 'DELETE' });
      await loadIndicator();
    } catch (err: any) {
      setError(err?.message ?? 'Error al desvincular riesgo');
    } finally {
      setUnlinkingLinkId(null);
    }
  }

  async function applySuggestedProb(riskId: string, probability: number) {
    setApplyingRiskId(riskId);
    setError(null);
    try {
      await apiFetch(`/risks/${riskId}`, {
        method: 'PATCH',
        json: { probability },
      });
      await loadIndicator();
    } catch (err: any) {
      setError(err?.message ?? 'Error al actualizar probabilidad');
    } finally {
      setApplyingRiskId(null);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch<{ indicator: Indicator }>(`/indicators/${id}`, {
        method: 'PATCH',
        json: editForm,
      });
      setIndicator(res.indicator);
      setEditing(false);
    } catch (err: any) {
      setError(err?.message ?? 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function handleAddMeasurement() {
    if (!measValue) return;
    setMeasSaving(true);
    setError(null);
    try {
      await apiFetch(`/indicators/${id}/measurements`, {
        method: 'POST',
        json: { value: parseFloat(measValue), period: measPeriod },
      });
      setShowMeasForm(false);
      setMeasValue('');
      loadIndicator();
    } catch (err: any) {
      setError(err?.message ?? 'Error al registrar medición');
    } finally {
      setMeasSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm('¿Estás seguro de eliminar este indicador?')) return;
    try {
      await apiFetch(`/indicators/${id}`, { method: 'DELETE' });
      router.push('/indicadores');
    } catch (err: any) {
      setError(err?.message ?? 'Error al eliminar');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
      </div>
    );
  }

  if (!indicator) {
    return (
      <div className="p-6">
        <p className="text-red-600">{error || 'Indicador no encontrado'}</p>
        <button onClick={() => router.push('/indicadores')} className="mt-2 text-blue-600 text-sm hover:underline">
          ← Volver a indicadores
        </button>
      </div>
    );
  }

  // Additional safety check
  if (!indicator.id || !indicator.name) {
    return (
      <div className="p-6">
        <p className="text-red-600">Datos del indicador inválidos</p>
        <button onClick={() => router.push('/indicadores')} className="mt-2 text-blue-600 text-sm hover:underline">
          ← Volver a indicadores
        </button>
      </div>
    );
  }

  // Destructure derived values for use in render
  const {
    trend, pct, safeStatus, isOnTarget, isWarning, isOffTarget,
    measurements, lastMeas, isOverdue, canSuggestNcr, linked, enriched
  } = derivedValues ?? {
    trend: TREND_ICON.STABLE, pct: 0, safeStatus: 'NO_DATA' as IndicatorStatus,
    isOnTarget: false, isWarning: false, isOffTarget: false,
    measurements: [], lastMeas: null, isOverdue: false, canSuggestNcr: false, linked: [], enriched: null
  };

  async function handleCreateNcrSuggested() {
    if (!indicator || !lastMeas) return;
    setNcrSaving(true);
    setError(null);
    try {
      await apiFetch('/ncr', {
        method: 'POST',
        json: {
          title: `Indicador fuera de meta: ${indicator.name}`,
          description: `El indicador ${indicator.code} (${indicator.name}) se encuentra fuera de meta.\n\nÚltima medición: ${lastMeas.period} = ${lastMeas.value} ${indicator.unit}\nMeta: ${indicator.targetValue ?? 'N/A'} ${indicator.unit}\nEstado: ${safeStatus}\nTendencia: ${indicator.trend}`,
          severity: 'MINOR',
          source: 'PROCESS_DEVIATION',
          standard: indicator.standard ?? undefined,
          clause: undefined,
          indicatorId: indicator.id,
          indicatorMeasurementId: lastMeas.id,
        },
      });
      setShowNcr(false);
    } catch (err: any) {
      setError(err?.message ?? 'Error al crear NCR');
    } finally {
      setNcrSaving(false);
    }
  }

  return (
    <IndicatorErrorBoundary>
      <div className="max-w-[1000px] mx-auto space-y-6">
        {/* Back + Actions */}
      <div className="flex items-center justify-between">
        <button onClick={() => router.push('/indicadores')} className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-800 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Indicadores
        </button>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowMeasForm(!showMeasForm)} className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">
            <Plus className="h-4 w-4" /> Medición
          </button>
          <button onClick={() => setEditing(!editing)} className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-50">
            <Edit3 className="h-4 w-4" /> {editing ? 'Cancelar' : 'Editar'}
          </button>
          <button onClick={handleDelete} className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm text-red-600 hover:bg-red-50">
            <Trash2 className="h-4 w-4" /> Eliminar
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" /> {error}
        </div>
      )}

      {/* Risk Links */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="p-5 border-b border-neutral-200">
          <h2 className="font-semibold text-neutral-900">Riesgos</h2>
          <p className="text-xs text-neutral-500 mt-1">Vinculación manual y sugerida por Departamento/Proceso</p>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Vincular riesgo (búsqueda)</label>
            <input
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              placeholder="Buscar por código o título..."
              value={riskQuery}
              onChange={(e) => setRiskQuery(e.target.value)}
            />
            {riskResults.length > 0 && (
              <div className="mt-2 rounded-lg border border-neutral-200 divide-y divide-neutral-100">
                {riskResults.slice(0, 8).map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <div className="min-w-0">
                      <div className="text-xs font-mono text-neutral-400">{r.code}</div>
                      <div className="text-sm text-neutral-900 truncate" title={r.title}>{r.title}</div>
                      <div className="text-xs text-neutral-500 truncate">{r.process || 'Sin proceso'}</div>
                    </div>
                    <button
                      onClick={() => linkRisk(r.id)}
                      disabled={!!linkingRiskId}
                      className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                    >
                      {linkingRiskId === r.id ? 'Vinculando...' : 'Vincular'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {indicator.process && suggestedRisks.length > 0 && (
            <div>
              <p className="text-sm font-medium text-neutral-700">Sugeridos por Departamento/Proceso: {indicator.process}</p>
              <div className="mt-2 rounded-lg border border-neutral-200 divide-y divide-neutral-100">
                {suggestedRisks.slice(0, 6).map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <div className="min-w-0">
                      <div className="text-xs font-mono text-neutral-400">{r.code}</div>
                      <div className="text-sm text-neutral-900 truncate" title={r.title}>{r.title}</div>
                    </div>
                    <button
                      onClick={() => linkRisk(r.id)}
                      disabled={!!linkingRiskId}
                      className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                    >
                      {linkingRiskId === r.id ? 'Vinculando...' : 'Vincular'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-sm font-medium text-neutral-700">Vinculados</p>
            {linked.length === 0 ? (
              <p className="mt-1 text-sm text-neutral-500">No hay riesgos vinculados.</p>
            ) : (
              <div className="mt-2 rounded-lg border border-neutral-200 divide-y divide-neutral-100">
                {linked.map((l: any) => {
                  const r = l.risk;
                  const delta = safeStatus === 'OFF_TARGET' ? l.offTargetProbDelta : safeStatus === 'WARNING' ? l.warningProbDelta : 0;
                  const suggested = delta > 0 ? Math.min(5, Math.max(1, (l.minSuggestedProb ?? 1), (r.probability ?? 1) + delta)) : null;
                  const canApply = suggested !== null && suggested !== r.probability;
                  return (
                    <div key={l.id} className="px-3 py-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs font-mono text-neutral-400">{r.code}</div>
                          <div className="text-sm text-neutral-900 truncate" title={r.title}>{r.title}</div>
                          <div className="text-xs text-neutral-500">NP actual: {r.probability} {canApply ? `→ sugerida: ${suggested}` : ''}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          {canApply && (
                            <button
                              onClick={() => applySuggestedProb(r.id, suggested as number)}
                              disabled={!!applyingRiskId}
                              className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                            >
                              {applyingRiskId === r.id ? 'Aplicando...' : 'Aplicar NP'}
                            </button>
                          )}
                          <button
                            onClick={() => unlinkRisk(l.id)}
                            disabled={!!unlinkingLinkId}
                            className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                          >
                            {unlinkingLinkId === l.id ? 'Quitando...' : 'Desvincular'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="bg-white rounded-xl border border-neutral-200 p-6">
        <div className="flex items-start gap-4">
          <div className="rounded-lg bg-blue-50 p-3">
            <BarChart3 className="h-6 w-6 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded">{indicator.code}</span>
              <span className="text-xs text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded">{indicator.category}</span>
              <span className="text-xs text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded">{FREQ_LABELS[indicator.frequency] || indicator.frequency}</span>
              <span className={`flex items-center gap-1 text-xs font-medium ${trend.color}`}>{trend.icon} {trend.label}</span>
              <span
                className={`text-xs px-2 py-0.5 rounded border ${
                  isOnTarget
                    ? 'bg-green-50 text-green-700 border-green-200'
                    : isWarning
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : isOffTarget
                        ? 'bg-red-50 text-red-700 border-red-200'
                        : 'bg-neutral-50 text-neutral-600 border-neutral-200'
                }`}
              >
                {safeStatus === 'ON_TARGET' ? 'En meta' : safeStatus === 'WARNING' ? 'Alerta' : safeStatus === 'OFF_TARGET' ? 'Bajo meta' : 'Sin datos'}
              </span>
              {isOverdue && (
                <span className="text-xs px-2 py-0.5 rounded border bg-red-50 text-red-700 border-red-200">
                  Medición vencida
                </span>
              )}
            </div>
            <h1 className="mt-2 text-xl font-semibold text-neutral-900">{indicator.name}</h1>
            {indicator.description && <p className="mt-1 text-sm text-neutral-600">{indicator.description}</p>}
            <div className="mt-3 flex items-center gap-4 text-xs text-neutral-400">
              {indicator.owner && <span className="flex items-center gap-1"><User className="h-3 w-3" /> {indicator.owner.email}</span>}
              {indicator.standard && <span>{indicator.standard}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-neutral-200 p-5">
          <p className="text-xs text-neutral-500 mb-1">Valor actual</p>
          <p className="text-2xl font-bold text-neutral-900">{enriched?.value ?? indicator.currentValue ?? '—'} <span className="text-sm font-normal text-neutral-400">{indicator.unit}</span></p>
          <p className="text-xs text-neutral-400 mt-1">Meta: {enriched?.target ?? indicator.targetValue ?? '—'} {indicator.unit}</p>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 p-5">
          <p className="text-xs text-neutral-500 mb-1">Cumplimiento</p>
          <div className="flex items-center gap-3">
            <p className={`text-2xl font-bold ${isOnTarget ? 'text-green-600' : isWarning ? 'text-amber-600' : 'text-red-600'}`}>{Math.round(pct)}%</p>
            <div className="flex-1 h-2 bg-neutral-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${isOnTarget ? 'bg-green-500' : isWarning ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${Math.min(Math.round(pct), 100)}%` }} />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 p-5">
          <p className="text-xs text-neutral-500 mb-1">YTD Acumulado</p>
          <p className="text-2xl font-bold text-neutral-900">{enriched?.ytdValue !== null ? enriched.ytdValue : '—'} <span className="text-sm font-normal text-neutral-400">{indicator.unit}</span></p>
          {enriched?.ytdTarget && <p className="text-xs text-neutral-400 mt-1">Meta anual: {enriched.ytdTarget} ({Math.round(enriched.ytdCompliance ?? 0)}%)</p>}
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 p-5">
          <p className="text-xs text-neutral-500 mb-1">Variaciones</p>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-500">vs Mes ant.:</span>
              <span className={`font-semibold ${(enriched?.variationMoM ?? 0) > 0 ? (indicator.direction === 'LOWER_BETTER' ? 'text-red-600' : 'text-green-600') : (enriched?.variationMoM ?? 0) < 0 ? (indicator.direction === 'LOWER_BETTER' ? 'text-green-600' : 'text-red-600') : 'text-neutral-500'}`}>
                {enriched?.variationMoM !== null ? `${enriched.variationMoM > 0 ? '+' : ''}${enriched.variationMoM.toFixed(1)}%` : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-500">vs Año ant.:</span>
              <span className={`font-semibold ${(enriched?.variationYoY ?? 0) > 0 ? (indicator.direction === 'LOWER_BETTER' ? 'text-red-600' : 'text-green-600') : (enriched?.variationYoY ?? 0) < 0 ? (indicator.direction === 'LOWER_BETTER' ? 'text-green-600' : 'text-red-600') : 'text-neutral-500'}`}>
                {enriched?.variationYoY !== null ? `${enriched.variationYoY > 0 ? '+' : ''}${enriched.variationYoY.toFixed(1)}%` : '—'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Trend Chart */}
      {measurements.length > 0 && (
        <div className="bg-white rounded-xl border border-neutral-200 p-5">
          <h3 className="text-sm font-semibold text-neutral-700 mb-4">Tendencia de Mediciones</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={[...measurements].reverse().map(m => ({
                period: m.period,
                valor: m.value,
                meta: enriched?.target ?? indicator.targetValue ?? 0,
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="period" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(value: any, name: any) => [name === 'meta' ? `Meta: ${value}` : `${value} ${indicator.unit}`, '']} />
                <Legend />
                <Line type="monotone" dataKey="valor" name={`Valor (${indicator.unit})`} stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="meta" name="Meta" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Suggested Actions */}
      {(canSuggestNcr || isOverdue || isOffTarget) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-amber-900">Acciones sugeridas</p>
              <p className="text-sm text-amber-800 mt-1">
                {isOverdue
                  ? 'La medición está vencida según la frecuencia del indicador.'
                  : 'El indicador está fuera de meta de forma sostenida y podría requerir una NCR.'}
              </p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={runDeviationAnalysis}
                disabled={aiAnalysisLoading}
                className="flex items-center gap-1.5 rounded-lg border border-purple-200 bg-white px-3 py-2 text-sm font-medium text-purple-700 hover:bg-purple-50 disabled:opacity-50"
              >
                {aiAnalysisLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Analizar desvío IA
              </button>
              {canSuggestNcr && (
                <button
                  onClick={() => setShowNcr(true)}
                  className="flex-shrink-0 rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700"
                >
                  Crear NCR sugerida
                </button>
              )}
            </div>
          </div>
          {aiAnalysis && (
            <div className="bg-white rounded-lg border border-purple-100 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-purple-500" />
                <span className="text-xs font-semibold text-purple-700">Análisis IA</span>
              </div>
              <p className="text-sm text-neutral-700 whitespace-pre-wrap">{aiAnalysis}</p>
            </div>
          )}
        </div>
      )}

      {/* NCR Modal */}
      {showNcr && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowNcr(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-neutral-900">Crear NCR (sugerida)</h3>
            <p className="text-sm text-neutral-500 mt-1">
              Se creará una no conformidad vinculada al indicador y a la última medición.
            </p>
            <div className="mt-4 rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700">
              <div><span className="font-mono text-xs text-neutral-500">{indicator.code}</span> — {indicator.name}</div>
              {lastMeas && (
                <div className="mt-1 text-xs text-neutral-500">
                  Última medición: {lastMeas.period} = {lastMeas.value} {indicator.unit}
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-5 justify-end">
              <button onClick={() => setShowNcr(false)} className="px-4 py-2 border border-neutral-200 rounded-lg text-sm text-neutral-600 hover:bg-neutral-50">
                Cancelar
              </button>
              <button
                onClick={handleCreateNcrSuggested}
                disabled={ncrSaving || !lastMeas}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-amber-700"
              >
                {ncrSaving ? 'Creando...' : 'Crear NCR'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Measurement Form */}
      {showMeasForm && (
        <div className="bg-white rounded-xl border border-neutral-200 p-6 space-y-4">
          <h2 className="font-semibold text-neutral-900">Registrar medición</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Valor ({indicator.unit})</label>
              <input type="number" step="any" className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm" value={measValue} onChange={(e) => setMeasValue(e.target.value)} autoFocus />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Período</label>
              <input type="month" className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm" value={measPeriod} onChange={(e) => setMeasPeriod(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAddMeasurement} disabled={measSaving || !measValue} className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
              {measSaving ? 'Guardando...' : 'Registrar'}
            </button>
            <button onClick={() => setShowMeasForm(false)} className="text-sm text-neutral-500 hover:text-neutral-700 px-3">Cancelar</button>
          </div>
        </div>
      )}

      {/* Edit Form */}
      {editing && (
        <div className="bg-white rounded-xl border border-neutral-200 p-6 space-y-4">
          <h2 className="font-semibold text-neutral-900">Editar indicador</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Meta</label>
              <input type="number" step="any" className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm" value={editForm.targetValue} onChange={(e) => setEditForm({ ...editForm, targetValue: Number(e.target.value) })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Unidad</label>
              <input className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm" value={editForm.unit} onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Frecuencia</label>
              <select className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm" value={editForm.frequency} onChange={(e) => setEditForm({ ...editForm, frequency: e.target.value })}>
                {Object.entries(FREQ_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving} className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
            <button onClick={() => setEditing(false)} className="text-sm text-neutral-500 hover:text-neutral-700 px-3">Cancelar</button>
          </div>
        </div>
      )}

      {/* Measurements Table */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="p-5 border-b border-neutral-200 flex items-center justify-between">
          <h2 className="font-semibold text-neutral-900 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-neutral-500" /> Historial de mediciones
            <span className="text-xs bg-neutral-100 text-neutral-500 px-2 py-0.5 rounded-full">{measurements.length}</span>
          </h2>
        </div>
        {measurements.length === 0 ? (
          <div className="py-10 text-center">
            <BarChart3 className="h-8 w-8 text-neutral-200 mx-auto mb-2" />
            <p className="text-sm text-neutral-400">Sin mediciones registradas</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[480px]">
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50/50">
                <th className="px-5 py-2.5 text-left font-medium text-neutral-600">Período</th>
                <th className="px-5 py-2.5 text-right font-medium text-neutral-600">Valor</th>
                <th className="px-5 py-2.5 text-right font-medium text-neutral-600">vs Meta</th>
                <th className="px-5 py-2.5 text-left font-medium text-neutral-600">Notas</th>
                <th className="px-5 py-2.5 text-right font-medium text-neutral-600">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {measurements.map(m => {
                const vsMeta = enriched?.target ? ((m.value / enriched.target) * 100) : (indicator.targetValue ? ((m.value / indicator.targetValue) * 100) : null);
                return (
                  <tr key={m.id} className="hover:bg-neutral-50/50">
                    <td className="px-5 py-3 font-mono text-neutral-800">{m.period}</td>
                    <td className="px-5 py-3 text-right font-medium text-neutral-900">{m.value} {indicator.unit}</td>
                    <td className="px-5 py-3 text-right">
                      {vsMeta !== null && (
                        <span className={`text-xs font-medium ${vsMeta >= 95 ? 'text-green-600' : vsMeta >= 85 ? 'text-amber-600' : 'text-red-600'}`}>
                          {Math.round(vsMeta)}%
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-left text-neutral-500 text-xs max-w-[200px] truncate">{m.notes || '—'}</td>
                    <td className="px-5 py-3 text-right text-neutral-400 text-xs">
                      {new Date(m.measuredAt).toLocaleDateString('es-AR')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>
      </div>
    </IndicatorErrorBoundary>
  );
}
