'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import type { Indicator, IndicatorStats } from '@/lib/types';
import {
  BarChart3, TrendingUp, TrendingDown, Minus, Plus, Search,
  Target, ArrowUpRight, ArrowDownRight, CheckCircle2,
  AlertCircle, Filter, X, Download, Edit3, Trash2,
  Activity, Eye, Calendar, Hash, ChevronRight, FileSpreadsheet, FileText,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, ReferenceLine, Legend,
} from 'recharts';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  const router = useRouter();
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [stats, setStats] = useState<IndicatorStats>(DEFAULT_INDICATOR_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [filterCat, setFilterCat] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [creating, setCreating] = useState(false);

  // Advanced filters
  const [filterStatus, setFilterStatus] = useState('');
  const [filterFreq, setFilterFreq] = useState('');
  const [filterDirection, setFilterDirection] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const filtered = useMemo(() => {
    let res = indicators;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      res = res.filter(ind =>
        ind.name.toLowerCase().includes(q) ||
        ind.code.toLowerCase().includes(q) ||
        ind.category.toLowerCase().includes(q)
      );
    }
    if (filterCat) res = res.filter(ind => ind.category === filterCat);
    if (filterStatus) res = res.filter(ind => ind.status === filterStatus);
    if (filterFreq) res = res.filter(ind => ind.frequency === filterFreq);
    if (filterDirection) res = res.filter(ind => ind.direction === filterDirection);
    return res;
  }, [indicators, searchTerm, filterCat, filterStatus, filterFreq, filterDirection]);

  const categoryChartData = useMemo(() => {
    return Object.entries(stats.categories).map(([name, count]) => ({
      name: name.slice(0, 12),
      count,
      compliance: Math.round(
        (indicators.filter(i => i.category === name && i.status === 'ON_TARGET').length / (count || 1)) * 100
      ),
    }));
  }, [indicators, stats.categories]);

  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);

  // Measurement modal
  const [measuringId, setMeasuringId] = useState<string | null>(null);
  const [measValue, setMeasValue] = useState('');
  const [measPeriod, setMeasPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const [measNotes, setMeasNotes] = useState('');

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
          yearTargetValue: (form as any).yearTargetValue ? Number((form as any).yearTargetValue) : null,
          tolerancePercent: (form as any).tolerancePercent ? Number((form as any).tolerancePercent) : null,
          monthlyTargets: (form as any).monthlyTargets ? (form as any).monthlyTargets.map(Number) : undefined,
          formula: (form as any).formula || undefined,
          dataSource: (form as any).dataSource || undefined,
          area: (form as any).area || undefined,
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
          yearTargetValue: (form as any).yearTargetValue ? Number((form as any).yearTargetValue) : null,
          tolerancePercent: (form as any).tolerancePercent ? Number((form as any).tolerancePercent) : null,
          monthlyTargets: (form as any).monthlyTargets || undefined,
          formula: (form as any).formula || undefined,
          dataSource: (form as any).dataSource || undefined,
          area: (form as any).area || undefined,
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
        json: { value: Number(measValue), period: measPeriod, notes: measNotes || undefined },
      });
      setMeasuringId(null);
      setMeasValue('');
      setMeasNotes('');
      fetchData();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const exportExcel = () => {
    const rows = filtered.map(ind => ({
      Codigo: ind.code,
      Nombre: ind.name,
      Categoria: ind.category,
      Area: ind.area || '',
      Frecuencia: FREQUENCIES[ind.frequency] || ind.frequency,
      Direccion: ind.direction === 'HIGHER_BETTER' ? 'Mayor es mejor' : 'Menor es mejor',
      Valor: ind.currentValue ?? '',
      Meta: ind.targetValue ?? '',
      Unidad: ind.unit,
      Estado: ind.status === 'ON_TARGET' ? 'En meta' : ind.status === 'WARNING' ? 'Alerta' : ind.status === 'OFF_TARGET' ? 'Bajo meta' : 'Sin datos',
      Tendencia: ind.trend === 'UP' ? 'Subiendo' : ind.trend === 'DOWN' ? 'Bajando' : 'Estable',
      Mediciones: ind.measurements?.length ?? 0,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Indicadores');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([buf], { type: 'application/octet-stream' }), `indicadores_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text('Indicadores - Dashboard Ejecutivo', 14, 16);
    doc.setFontSize(10);
    doc.text(`Generado: ${new Date().toLocaleDateString('es-AR')}`, 14, 23);
    const rows = filtered.map(ind => [
      ind.code,
      ind.name,
      ind.category,
      ind.currentValue !== null ? String(ind.currentValue) : '—',
      ind.targetValue !== null ? String(ind.targetValue) : '—',
      ind.unit,
      ind.status === 'ON_TARGET' ? 'En meta' : ind.status === 'WARNING' ? 'Alerta' : ind.status === 'OFF_TARGET' ? 'Bajo meta' : 'Sin datos',
      ind.trend === 'UP' ? 'Subiendo' : ind.trend === 'DOWN' ? 'Bajando' : 'Estable',
    ]);
    (autoTable as any)(doc, {
      head: [['Código', 'Nombre', 'Categoría', 'Valor', 'Meta', 'Unidad', 'Estado', 'Tendencia']],
      body: rows,
      startY: 28,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [59, 130, 246] },
    });
    doc.save(`indicadores_${new Date().toISOString().slice(0,10)}.pdf`);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFilterCat('');
    setFilterStatus('');
    setFilterFreq('');
    setFilterDirection('');
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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCardModern icon={<BarChart3 className="h-5 w-5 text-blue-600" />} label="Total" value={stats.total} sub={`${stats.active} activos`} bg="bg-blue-50" />
        <StatCardModern icon={<CheckCircle2 className="h-5 w-5 text-green-600" />} label="En Meta" value={stats.onTarget} sub={`${Math.round((stats.onTarget/(stats.active||1))*100)}% activos`} bg="bg-green-50" />
        <StatCardModern icon={<AlertCircle className="h-5 w-5 text-red-600" />} label="Bajo Meta" value={stats.belowTarget} sub={`${Math.round((stats.belowTarget/(stats.active||1))*100)}% activos`} bg="bg-red-50" />
        <StatCardModern icon={<TrendingUp className="h-5 w-5 text-emerald-600" />} label="Mejora" value={stats.trending.up} sub="Tendencia positiva" bg="bg-emerald-50" />
        <StatCardModern icon={<TrendingDown className="h-5 w-5 text-orange-600" />} label="Empeora" value={stats.trending.down} sub="Tendencia negativa" bg="bg-orange-50" />
      </div>

      {/* Category Compliance Chart */}
      {categoryChartData.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Cumplimiento por Categoría</h3>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} domain={[0, 100]} />
                <Tooltip formatter={(v: any) => `${v}%`} />
                <Bar dataKey="compliance" fill="#3b82f6" radius={[4, 4, 0, 0]} name="% Cumplimiento" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Search & Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input type="text" placeholder="Buscar indicadores..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white pl-10 pr-4 py-2 text-sm focus:border-blue-500 outline-none" />
          </div>
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white">
            <option value="">Todas las categorías</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button onClick={() => setShowFilters(!showFilters)} className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
            <Filter className="h-4 w-4" /> Filtros
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-2 border-t border-slate-100">
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white">
              <option value="">Todos los estados</option>
              <option value="ON_TARGET">En meta</option>
              <option value="WARNING">Alerta</option>
              <option value="OFF_TARGET">Bajo meta</option>
              <option value="NO_DATA">Sin datos</option>
            </select>
            <select value={filterFreq} onChange={e => setFilterFreq(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white">
              <option value="">Todas las frecuencias</option>
              {Object.entries(FREQUENCIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={filterDirection} onChange={e => setFilterDirection(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white">
              <option value="">Todas direcciones</option>
              <option value="HIGHER_BETTER">Mayor es mejor</option>
              <option value="LOWER_BETTER">Menor es mejor</option>
            </select>
            <div className="col-span-2 flex items-center gap-2">
              <button onClick={clearFilters} className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1">Limpiar filtros</button>
              <span className="text-xs text-slate-400 ml-auto">{filtered.length} resultados</span>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
          <button onClick={exportExcel} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 text-green-700 border border-green-200 text-xs font-medium hover:bg-green-100">
            <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
          </button>
          <button onClick={exportPDF} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-700 border border-red-200 text-xs font-medium hover:bg-red-100">
            <FileText className="h-3.5 w-3.5" /> PDF
          </button>
        </div>
      </div>

      {/* Indicators Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">Indicadores</h3>
          <span className="text-xs text-slate-400">{filtered.length} resultados</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider">
                <th className="px-4 py-3 text-left font-medium">Indicador</th>
                <th className="px-4 py-3 text-right font-medium">Valor</th>
                <th className="px-4 py-3 text-right font-medium">Meta</th>
                <th className="px-4 py-3 text-right font-medium">Cumpl.</th>
                <th className="px-4 py-3 text-center font-medium">Estado</th>
                <th className="px-4 py-3 text-center font-medium">Tend.</th>
                <th className="px-4 py-3 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(ind => {
                const e = ind._enriched;
                return (
                  <tr key={ind.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-2">
                        <div className="mt-0.5"><div className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{ind.code}</div></div>
                        <div>
                          <div className="font-medium text-slate-900 text-sm">{ind.name}</div>
                          <div className="text-xs text-slate-500">{ind.category} {ind.area ? `· ${ind.area}` : ''}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-900">
                      {e?.value !== null && e?.value !== undefined ? e.value : '—'} <span className="text-xs text-slate-400">{ind.unit}</span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                      {e?.target !== null ? `${e.target} ${ind.unit}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {e?.compliance !== null ? (
                        <div className="flex items-center gap-2 w-28 justify-end">
                          <span className="text-xs font-semibold w-8 text-right tabular-nums">{Math.round(e.compliance)}%</span>
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${e.compliance >= 95 ? 'bg-green-500' : e.compliance >= 85 ? 'bg-amber-400' : 'bg-red-500'}`} style={{ width: `${Math.min(e.compliance, 100)}%` }} />
                          </div>
                        </div>
                      ) : <span className="text-xs text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${ind.status === 'ON_TARGET' ? 'bg-green-50 text-green-700 border-green-200' : ind.status === 'WARNING' ? 'bg-amber-50 text-amber-700 border-amber-200' : ind.status === 'OFF_TARGET' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                        {ind.status === 'ON_TARGET' ? 'En meta' : ind.status === 'WARNING' ? 'Alerta' : ind.status === 'OFF_TARGET' ? 'Bajo meta' : 'Sin datos'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1 text-xs text-slate-500">
                        {ind.trend === 'UP' ? (ind.direction === 'LOWER_BETTER' ? <TrendingDown className="h-4 w-4 text-red-500" /> : <TrendingUp className="h-4 w-4 text-green-500" />) : ind.trend === 'DOWN' ? (ind.direction === 'LOWER_BETTER' ? <TrendingUp className="h-4 w-4 text-green-500" /> : <TrendingDown className="h-4 w-4 text-red-500" />) : <Minus className="h-4 w-4 text-slate-400" />}
                        {ind.trend === 'UP' ? (ind.direction === 'LOWER_BETTER' ? 'Empeora' : 'Mejora') : ind.trend === 'DOWN' ? (ind.direction === 'LOWER_BETTER' ? 'Mejora' : 'Empeora') : 'Estable'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => router.push(`/indicadores/${ind.id}`)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Ver detalle"><Eye className="h-4 w-4" /></button>
                        <button onClick={() => { setEditingId(ind.id); setForm({ name: ind.name, code: ind.code, description: ind.description || '', category: ind.category, process: ind.process || '', standard: ind.standard || '', currentValue: ind.currentValue?.toString() || '', targetValue: ind.targetValue?.toString() || '', minValue: ind.minValue?.toString() || '', maxValue: ind.maxValue?.toString() || '', unit: ind.unit, frequency: ind.frequency }); }} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Editar"><Edit3 className="h-4 w-4" /></button>
                        <button onClick={() => { setMeasuringId(ind.id); setMeasValue(''); }} className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg" title="Registrar medición"><Plus className="h-4 w-4" /></button>
                        <button onClick={() => handleDelete(ind.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Eliminar"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="py-12 text-center">
            <BarChart3 className="h-10 w-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No se encontraron indicadores</p>
            <button onClick={() => setShowForm(true)} className="text-blue-600 text-sm hover:underline mt-1">Crear primer indicador</button>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {(showForm || editingId) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">{editingId ? 'Editar Indicador' : 'Nuevo Indicador'}</h3>
            <div className="space-y-4">
              <input placeholder="Nombre *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              <textarea placeholder="Descripción" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm h-16 resize-none" />
              <div className="grid grid-cols-2 gap-2">
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={form.frequency} onChange={e => setForm({ ...form, frequency: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  <option value="DAILY">Diaria</option>
                  <option value="WEEKLY">Semanal</option>
                  <option value="MONTHLY">Mensual</option>
                  <option value="QUARTERLY">Trimestral</option>
                  <option value="YEARLY">Anual</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input placeholder="Proceso / Área" value={form.process} onChange={e => setForm({ ...form, process: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                <input placeholder="Estándar ISO" value={form.standard} onChange={e => setForm({ ...form, standard: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input type="number" step="any" placeholder="Meta" value={form.targetValue} onChange={e => setForm({ ...form, targetValue: e.target.value })} className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                <input type="number" step="any" placeholder="Meta Anual (YTD)" value={(form as any).yearTargetValue || ''} onChange={e => setForm({ ...form, yearTargetValue: e.target.value } as any)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                <input placeholder="Unidad" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select value={(form as any).direction || 'HIGHER_BETTER'} onChange={e => setForm({ ...form, direction: e.target.value } as any)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  <option value="HIGHER_BETTER">Mayor es mejor</option>
                  <option value="LOWER_BETTER">Menor es mejor</option>
                </select>
                <input type="number" placeholder="Tolerancia %" value={(form as any).tolerancePercent || 5} onChange={e => setForm({ ...form, tolerancePercent: Number(e.target.value) } as any)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input placeholder="Fórmula" value={(form as any).formula || ''} onChange={e => setForm({ ...form, formula: e.target.value } as any)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                <input placeholder="Fuente de datos" value={(form as any).dataSource || ''} onChange={e => setForm({ ...form, dataSource: e.target.value } as any)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={editingId ? handleEdit : handleCreate} disabled={creating} className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">
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
            <div className="space-y-3">
              <input type="number" step="any" placeholder="Valor" value={measValue} onChange={e => setMeasValue(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              <input type="month" value={measPeriod} onChange={e => setMeasPeriod(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              <textarea placeholder="Notas (opcional)" value={measNotes} onChange={e => setMeasNotes(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm h-16 resize-none" />
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={handleRegisterMeasurement} disabled={!measValue} className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">Guardar</button>
              <button onClick={() => { setMeasuringId(null); setMeasValue(''); setMeasNotes(''); }} className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCardModern({ icon, label, value, sub, bg }: { icon: React.ReactNode; label: string; value: number; sub?: string; bg: string }) {
  const gradientMap: Record<string, string> = {
    'bg-blue-50': 'bg-gradient-to-br from-blue-50 to-blue-100',
    'bg-green-50': 'bg-gradient-to-br from-green-50 to-green-100',
    'bg-red-50': 'bg-gradient-to-br from-red-50 to-red-100',
    'bg-emerald-50': 'bg-gradient-to-br from-emerald-50 to-emerald-100',
    'bg-orange-50': 'bg-gradient-to-br from-orange-50 to-orange-100',
  };
  return (
    <div className={`${gradientMap[bg] || bg} rounded-2xl p-4 shadow-sm border border-white/50 backdrop-blur-sm transition-all hover:shadow-md hover:scale-[1.02] hover:border-white/70`}>
      <div className="flex items-center gap-2 mb-1">{icon}<span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">{label}</span></div>
      <div className="text-2xl font-bold text-slate-900 tabular-nums">{value.toLocaleString()}</div>
      {sub && <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}
