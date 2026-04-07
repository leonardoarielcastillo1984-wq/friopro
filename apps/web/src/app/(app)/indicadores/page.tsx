'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import type { Indicator, IndicatorStats } from '@/lib/types';
import {
  BarChart3, TrendingUp, TrendingDown, Minus, Plus, Search,
  Target, ArrowUpRight, ArrowDownRight, CheckCircle2,
  AlertCircle, Filter, X, Download, Edit3, Trash2,
} from 'lucide-react';

const CATEGORIES = [
  'Calidad', 'Seguridad', 'Ambiente', 'Seguridad Vial',
  'Proceso', 'Productividad', 'Satisfacción', 'Financiero',
];

const FREQUENCIES: Record<string, string> = {
  DAILY: 'Diaria', WEEKLY: 'Semanal', MONTHLY: 'Mensual',
  QUARTERLY: 'Trimestral', YEARLY: 'Anual',
};

const DEFAULT_INDICATOR_STATS: IndicatorStats = {
  total: 0,
  active: 0,
  onTarget: 0,
  belowTarget: 0,
  trending: { up: 0, down: 0, stable: 0 },
  categories: {},
};

export default function IndicadoresPage() {
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [stats, setStats] = useState<IndicatorStats>(DEFAULT_INDICATOR_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [filterCat, setFilterCat] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [creating, setCreating] = useState(false);

  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);

  // Measurement modal
  const [measuringId, setMeasuringId] = useState<string | null>(null);
  const [measValue, setMeasValue] = useState('');

  // Edit modal
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '', code: '', description: '', category: 'Calidad',
    process: '', standard: '', currentValue: '', targetValue: '',
    minValue: '', maxValue: '', unit: '', frequency: 'MONTHLY' as string,
  });

  const fetchData = () => {
    setLoading(true);
    const params = filterCat ? `?category=${filterCat}&active=true` : '?active=true';
    Promise.all([
      apiFetch<{ indicators: Indicator[] }>(`/indicators${params}`),
      apiFetch<{ stats: IndicatorStats }>('/indicators/stats'),
    ])
      .then(([ind, st]) => {
        setIndicators(ind?.indicators ?? []);
        setStats(st?.stats ?? DEFAULT_INDICATOR_STATS);
        setError('');
      })
      .catch(() => {
        setIndicators([]);
        setStats(DEFAULT_INDICATOR_STATS);
        setError('');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [filterCat]);

  useEffect(() => {
    apiFetch<{ departments: Array<{ id: string; name: string }> }>('/departments')
      .then((res) => setDepartments((res as any).departments ?? []))
      .catch(() => setDepartments([]));
  }, []);

  const handleCreate = async () => {
    if (!form.name || !form.category) return;
    setCreating(true);
    try {
      await apiFetch('/indicators', {
        method: 'POST',
        json: {
          ...form,
          currentValue: form.currentValue ? Number(form.currentValue) : null,
          targetValue: form.targetValue ? Number(form.targetValue) : null,
          minValue: form.minValue ? Number(form.minValue) : null,
          maxValue: form.maxValue ? Number(form.maxValue) : null,
        },
      });
      setShowForm(false);
      setForm({ name: '', code: '', description: '', category: 'Calidad', process: '', standard: '', currentValue: '', targetValue: '', minValue: '', maxValue: '', unit: '', frequency: 'MONTHLY' as string });
      fetchData();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const handleEdit = async () => {
    if (!form.name || !form.category) return;
    setCreating(true);
    try {
      await apiFetch(`/indicators/${editingId}`, {
        method: 'PUT',
        json: {
          ...form,
          currentValue: form.currentValue ? Number(form.currentValue) : null,
          targetValue: form.targetValue ? Number(form.targetValue) : null,
          minValue: form.minValue ? Number(form.minValue) : null,
          maxValue: form.maxValue ? Number(form.maxValue) : null,
        },
      });
      setEditingId(null);
      setForm({ name: '', code: '', description: '', category: 'Calidad', process: '', standard: '', currentValue: '', targetValue: '', minValue: '', maxValue: '', unit: '', frequency: 'MONTHLY' as string });
      fetchData();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este indicador?')) return;
    try {
      await apiFetch(`/indicators/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleRegisterMeasurement = async () => {
    if (!measValue || !measuringId) return;
    try {
      await apiFetch(`/indicators/${measuringId}/measurements`, {
        method: 'POST',
        json: { value: Number(measValue), period: new Date().toISOString().slice(0, 7) },
      });
      setMeasuringId(null);
      setMeasValue('');
      fetchData();
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Indicadores</h1>
          <p className="text-sm text-slate-500">Monitoreo de métricas clave de negocio</p>
        </div>
        <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <Plus className="h-4 w-4" />
          Nuevo Indicador
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm flex items-center justify-between">
          {error} <button onClick={() => setError('')}><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCardModern icon={<BarChart3 className="h-5 w-5 text-blue-600" />} label="Total Activos" value={stats.active} bg="bg-blue-50" />
        <StatCardModern icon={<CheckCircle2 className="h-5 w-5 text-green-600" />} label="En Meta" value={stats.onTarget} bg="bg-green-50" />
        <StatCardModern icon={<AlertCircle className="h-5 w-5 text-red-600" />} label="Bajo Meta" value={stats.belowTarget} bg="bg-red-50" />
        <StatCardModern icon={<TrendingUp className="h-5 w-5 text-emerald-600" />} label="Tendencia Positiva" value={stats.trending.up} bg="bg-emerald-50" />
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input type="text" placeholder="Buscar indicadores..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white pl-10 pr-4 py-2 text-sm focus:border-blue-500 outline-none" />
        </div>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white">
          <option value="">Todas las categorías</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Indicators List */}
      {(() => {
        const filtered = searchTerm
          ? indicators.filter(ind => ind.name.toLowerCase().includes(searchTerm.toLowerCase()) || ind.code.toLowerCase().includes(searchTerm.toLowerCase()) || ind.category.toLowerCase().includes(searchTerm.toLowerCase()))
          : indicators;
        return filtered.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
            <BarChart3 className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 mb-2">Aún no hay indicadores definidos</p>
            <button onClick={() => setShowForm(true)} className="text-blue-600 text-sm hover:underline">Crear primer indicador</button>
          </div>
        ) : (
          <div className="grid gap-4">
            {filtered.map(ind => {
              const pct = ind.targetValue && ind.currentValue !== null ? Math.min((ind.currentValue / ind.targetValue) * 100, 999) : null;
              const isOnTarget = pct !== null && pct >= 95 && pct <= 105;
              const isWarning = pct !== null && pct < 95 && pct >= 85;
              const isOffTarget = pct !== null && pct < 85;
              return (
                <div key={ind.id} className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-sm border border-white/50 transition-all hover:shadow-md hover:scale-[1.01] hover:border-white/80">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h4 className="font-semibold text-slate-900 mb-1">{ind.name}</h4>
                      <p className="text-xs text-slate-500 uppercase tracking-wide">{ind.category}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`px-2 py-1 rounded-full text-xs font-medium ${ind.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {ind.isActive ? 'Activo' : 'Inactivo'}
                      </div>
                      <button 
                        onClick={() => {
                          setEditingId(ind.id);
                          setForm({
                            name: ind.name,
                            code: ind.code,
                            description: ind.description || '',
                            category: ind.category,
                            process: ind.process || '',
                            standard: ind.standard || '',
                            currentValue: ind.currentValue?.toString() || '',
                            targetValue: ind.targetValue?.toString() || '',
                            minValue: ind.minValue?.toString() || '',
                            maxValue: ind.maxValue?.toString() || '',
                            unit: ind.unit,
                            frequency: ind.frequency,
                          });
                        }} 
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(ind.id)} 
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-end justify-between mb-4">
                    <div className="flex flex-col">
                      <span className={`text-3xl font-bold tabular-nums ${!ind.currentValue ? 'text-slate-300' : isOnTarget ? 'text-green-600' : isWarning ? 'text-yellow-600' : isOffTarget ? 'text-red-600' : 'text-slate-900'}`}>
                        {ind.currentValue !== null ? ind.currentValue : '—'}
                      </span>
                      <span className="text-sm text-slate-500 mb-1">{ind.unit}</span>
                      {ind.targetValue !== null && (
                        <span className="text-sm text-slate-400 mb-1 ml-auto">Meta: {ind.targetValue}{ind.unit}</span>
                      )}
                    </div>

                    {ind.targetValue !== null && (
                      <div className={`text-xs px-2 py-0.5 rounded-full border ${isOnTarget ? 'bg-green-50 text-green-700 border-green-200' : isWarning ? 'bg-amber-50 text-amber-700 border-amber-200' : isOffTarget ? 'bg-red-50 text-red-700 border-red-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                        {pct !== null ? `${pct.toFixed(0)}%` : 'N/A'}
                      </div>
                    )}
                  </div>

                  {/* Progress bar */}
                  {ind.targetValue !== null && (
                    <div className="w-full bg-slate-100/60 rounded-full h-3 mb-3 overflow-hidden shadow-inner">
                      <div className={`h-full rounded-full transition-all duration-500 ease-out ${isOnTarget ? 'bg-gradient-to-r from-green-400 to-green-600 shadow-sm' : (pct && pct >= 70) ? 'bg-gradient-to-r from-yellow-400 to-yellow-600 shadow-sm' : 'bg-gradient-to-r from-red-400 to-red-600 shadow-sm'}`} style={{ width: `${pct ?? 0}%` }} />
                    </div>
                  )}

                  {/* Mini sparkline */}
                  {ind.measurements && ind.measurements.length > 1 && (
                    <div className="flex items-end gap-1 h-10 mb-3 px-1">
                      {[...ind.measurements].reverse().slice(-12).map((m, i) => {
                        const vals = [...ind.measurements].reverse().slice(-12).map(v => v.value);
                        const max = Math.max(...vals);
                        const min = Math.min(...vals);
                        const range = max - min || 1;
                        const h = Math.max(((m.value - min) / range) * 36, 4);
                        return (
                          <div key={i} className="flex-1 bg-gradient-to-t from-blue-500 to-blue-300 rounded-t-md shadow-sm transition-all hover:from-blue-600 hover:to-blue-400 hover:scale-110" style={{ height: h }} title={`${m.period}: ${m.value}`} />
                        );
                      })}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <span className="text-xs text-slate-400">{FREQUENCIES[ind.frequency] || ind.frequency}</span>
                    <button onClick={() => { setMeasuringId(ind.id); setMeasValue(''); }} className="text-xs text-blue-600 hover:underline font-medium">
                      + Registrar medición
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Create/Edit Modal */}
      {(showForm || editingId) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">{editingId ? 'Editar Indicador' : 'Nuevo Indicador'}</h3>
            <div className="space-y-4">
              <input placeholder="Nombre" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              <input placeholder="Código" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              <textarea placeholder="Descripción" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm h-20 resize-none" />
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <input placeholder="Proceso" value={form.process} onChange={e => setForm({ ...form, process: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              <input placeholder="Estándar" value={form.standard} onChange={e => setForm({ ...form, standard: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              <div className="grid grid-cols-2 gap-2">
                <input type="number" step="any" placeholder="Valor actual" value={form.currentValue} onChange={e => setForm({ ...form, currentValue: e.target.value })} className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                <input type="number" step="any" placeholder="Meta" value={form.targetValue} onChange={e => setForm({ ...form, targetValue: e.target.value })} className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input type="number" step="any" placeholder="Mínimo" value={form.minValue} onChange={e => setForm({ ...form, minValue: e.target.value })} className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                <input type="number" step="any" placeholder="Máximo" value={form.maxValue} onChange={e => setForm({ ...form, maxValue: e.target.value })} className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input placeholder="Unidad" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                <select value={form.frequency} onChange={e => setForm({ ...form, frequency: e.target.value })} className="border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  <option value="DAILY">Diaria</option>
                  <option value="WEEKLY">Semanal</option>
                  <option value="MONTHLY">Mensual</option>
                  <option value="QUARTERLY">Trimestral</option>
                  <option value="YEARLY">Anual</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={editingId ? handleEdit : handleCreate} disabled={creating} className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {creating ? 'Guardando...' : editingId ? 'Actualizar' : 'Crear'}
              </button>
              <button onClick={() => { setShowForm(false); setEditingId(null); }} className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Measurement Modal */}
      {measuringId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Registrar Medición</h3>
            <input type="number" step="any" placeholder="Valor" value={measValue} onChange={e => setMeasValue(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-4" />
            <div className="flex gap-3">
              <button onClick={handleRegisterMeasurement} disabled={!measValue} className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">Guardar</button>
              <button onClick={() => { setMeasuringId(null); setMeasValue(''); }} className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCardModern({ icon, label, value, bg }: { icon: React.ReactNode; label: string; value: number; bg: string }) {
  const gradientMap: Record<string, string> = {
    'bg-blue-50': 'bg-gradient-to-br from-blue-50 to-blue-100',
    'bg-green-50': 'bg-gradient-to-br from-green-50 to-green-100',
    'bg-red-50': 'bg-gradient-to-br from-red-50 to-red-100',
    'bg-emerald-50': 'bg-gradient-to-br from-emerald-50 to-emerald-100',
  };
  return (
    <div className={`${gradientMap[bg] || bg} rounded-2xl p-5 shadow-sm border border-white/50 backdrop-blur-sm transition-all hover:shadow-md hover:scale-[1.02] hover:border-white/70`}>
      <div className="flex items-center gap-2 mb-2">{icon}<span className="text-xs font-medium text-slate-600 uppercase tracking-wide">{label}</span></div>
      <div className="text-3xl font-bold text-slate-900 tabular-nums">{value.toLocaleString()}</div>
    </div>
  );
}
