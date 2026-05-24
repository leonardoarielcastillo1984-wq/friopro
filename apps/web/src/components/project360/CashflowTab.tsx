'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiFetch } from '@/lib/api';
import {
  DollarSign, TrendingUp, TrendingDown, Calendar, AlertCircle,
  Plus, Save, Trash2, Download, FileText, BarChart3, Activity
} from 'lucide-react';

interface CashflowItem {
  id: string;
  month: number;
  year: number;
  projectedRevenue: number | null;
  projectedExpenses: number | null;
  actualRevenue: number | null;
  actualExpenses: number | null;
  revenueDeviation: number | null;
  expenseDeviation: number | null;
  milestoneName: string | null;
  billingDate: string | null;
  paymentDate: string | null;
  notes: string | null;
  isLocked: boolean;
}

interface Props {
  projectId: string;
}

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export default function CashflowTab({ projectId }: Props) {
  const [items, setItems] = useState<CashflowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear());
  const [newItem, setNewItem] = useState({
    month: 1, year: new Date().getFullYear(),
    projectedRevenue: '', projectedExpenses: '',
    milestoneName: '', billingDate: '', paymentDate: '', notes: ''
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/project360/projects/${projectId}/cashflow`) as any;
      setItems(res.cashflows || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const yearItems = useMemo(() => 
    items.filter(i => i.year === year).sort((a, b) => a.month - b.month),
    [items, year]
  );

  const stats = useMemo(() => {
    const totalProjectedRevenue = yearItems.reduce((sum, i) => sum + (i.projectedRevenue || 0), 0);
    const totalProjectedExpenses = yearItems.reduce((sum, i) => sum + (i.projectedExpenses || 0), 0);
    const totalActualRevenue = yearItems.reduce((sum, i) => sum + (i.actualRevenue || 0), 0);
    const totalActualExpenses = yearItems.reduce((sum, i) => sum + (i.actualExpenses || 0), 0);
    const projectedProfit = totalProjectedRevenue - totalProjectedExpenses;
    const actualProfit = totalActualRevenue - totalActualExpenses;
    const burnRate = totalActualExpenses / 12;
    const runwayMonths = totalActualRevenue > 0 ? totalActualRevenue / burnRate : 0;
    
    return {
      totalProjectedRevenue, totalProjectedExpenses, projectedProfit,
      totalActualRevenue, totalActualExpenses, actualProfit,
      burnRate, runwayMonths,
      cumulative: yearItems.map((item, idx) => {
        const prev = yearItems.slice(0, idx + 1);
        return {
          month: item.month,
          projected: prev.reduce((s, i) => s + (i.projectedRevenue || 0) - (i.projectedExpenses || 0), 0),
          actual: prev.reduce((s, i) => s + (i.actualRevenue || 0) - (i.actualExpenses || 0), 0)
        };
      })
    };
  }, [yearItems]);

  const handleAdd = async () => {
    try {
      await apiFetch(`/project360/projects/${projectId}/cashflow`, {
        method: 'POST',
        json: {
          ...newItem,
          projectedRevenue: Number(newItem.projectedRevenue) || 0,
          projectedExpenses: Number(newItem.projectedExpenses) || 0,
        }
      });
      setShowAddModal(false);
      setNewItem({ month: 1, year: new Date().getFullYear(), projectedRevenue: '', projectedExpenses: '', milestoneName: '', billingDate: '', paymentDate: '', notes: '' });
      load();
    } catch (e: any) { alert(e.message); }
  };

  const handleUpdateActual = async (id: string, field: 'actualRevenue' | 'actualExpenses', value: number) => {
    try {
      await apiFetch(`/project360/cashflow/${id}`, {
        method: 'PUT',
        json: { [field]: value }
      });
      load();
    } catch (e: any) { alert(e.message); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este item?')) return;
    try {
      await apiFetch(`/project360/cashflow/${id}`, { method: 'DELETE' });
      load();
    } catch (e: any) { alert(e.message); }
  };

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(val);

  if (loading) return <div className="p-8 text-center text-gray-500">Cargando cashflow...</div>;

  const maxCumulative = Math.max(...stats.cumulative.map(c => Math.abs(c.projected)), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Cashflow y Control Financiero</h2>
          <p className="text-sm text-gray-500">Proyección mensual de ingresos y egresos</p>
        </div>
        <div className="flex items-center gap-3">
          <select 
            value={year} 
            onChange={e => setYear(Number(e.target.value))}
            className="px-3 py-2 border rounded-lg text-sm"
          >
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Agregar Mes
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-2 text-emerald-600 mb-2">
            <TrendingUp className="w-5 h-5" />
            <span className="text-sm font-medium">Ingresos Proy.</span>
          </div>
          <div className="text-xl font-bold text-gray-900">{formatCurrency(stats.totalProjectedRevenue)}</div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-2 text-red-600 mb-2">
            <TrendingDown className="w-5 h-5" />
            <span className="text-sm font-medium">Egresos Proy.</span>
          </div>
          <div className="text-xl font-bold text-gray-900">{formatCurrency(stats.totalProjectedExpenses)}</div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-2 text-blue-600 mb-2">
            <DollarSign className="w-5 h-5" />
            <span className="text-sm font-medium">Utilidad Proy.</span>
          </div>
          <div className={`text-xl font-bold ${stats.projectedProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {formatCurrency(stats.projectedProfit)}
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-2 text-amber-600 mb-2">
            <Activity className="w-5 h-5" />
            <span className="text-sm font-medium">Burn Rate</span>
          </div>
          <div className="text-xl font-bold text-gray-900">{formatCurrency(stats.burnRate)}/mes</div>
        </div>
      </div>

      {/* Curva S - Acumulado */}
      <div className="bg-white rounded-xl border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-blue-600" /> Curva S - Flujo Acumulado
        </h3>
        <div className="h-64 flex items-end gap-2">
          {stats.cumulative.map((c, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex gap-1 h-48 items-end">
                <div 
                  className="flex-1 bg-blue-400 rounded-t transition-all" 
                  style={{ height: `${Math.max(5, (Math.abs(c.projected) / maxCumulative) * 100)}%`, opacity: c.projected >= 0 ? 1 : 0.3 }}
                />
                <div 
                  className="flex-1 bg-emerald-500 rounded-t transition-all" 
                  style={{ height: `${Math.max(5, (Math.abs(c.actual) / maxCumulative) * 100)}%`, opacity: c.actual !== 0 ? 1 : 0.3 }}
                />
              </div>
              <span className="text-xs text-gray-500">{MONTHS[c.month - 1]}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-4 text-xs">
          <span className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-400 rounded" /> Proyectado</span>
          <span className="flex items-center gap-1"><div className="w-3 h-3 bg-emerald-500 rounded" /> Real</span>
        </div>
      </div>

      {/* Tabla de Cashflow */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Mes</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Ingreso Proy.</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Egreso Proy.</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Ingreso Real</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Egreso Real</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Desv.</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Hito</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600"></th>
              </tr>
            </thead>
            <tbody>
              {yearItems.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">Sin datos de cashflow para {year}</td></tr>
              ) : yearItems.map(item => (
                <tr key={item.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{MONTHS[item.month - 1]} {item.year}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(item.projectedRevenue || 0)}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(item.projectedExpenses || 0)}</td>
                  <td className="px-4 py-3 text-right">
                    <input
                      type="number"
                      defaultValue={item.actualRevenue || ''}
                      onBlur={e => handleUpdateActual(item.id, 'actualRevenue', Number(e.target.value))}
                      className="w-24 px-2 py-1 border rounded text-right text-sm"
                      placeholder="0"
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <input
                      type="number"
                      defaultValue={item.actualExpenses || ''}
                      onBlur={e => handleUpdateActual(item.id, 'actualExpenses', Number(e.target.value))}
                      className="w-24 px-2 py-1 border rounded text-right text-sm"
                      placeholder="0"
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    {item.revenueDeviation !== null && (
                      <span className={`text-xs font-semibold ${(item.revenueDeviation || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {(item.revenueDeviation || 0) >= 0 ? '+' : ''}{formatCurrency(item.revenueDeviation || 0)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">{item.milestoneName || '-'}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => handleDelete(item.id)} className="text-red-600 hover:text-red-700">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Agregar */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Agregar Proyección Mensual</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Mes</label>
                <select 
                  value={newItem.month} 
                  onChange={e => setNewItem({...newItem, month: Number(e.target.value)})}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Año</label>
                <input 
                  type="number" 
                  value={newItem.year} 
                  onChange={e => setNewItem({...newItem, year: Number(e.target.value)})}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Ingreso Proyectado</label>
                <input 
                  type="number" 
                  value={newItem.projectedRevenue} 
                  onChange={e => setNewItem({...newItem, projectedRevenue: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Egreso Proyectado</label>
                <input 
                  type="number" 
                  value={newItem.projectedExpenses} 
                  onChange={e => setNewItem({...newItem, projectedExpenses: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Hito de Facturación</label>
                <input 
                  type="text" 
                  value={newItem.milestoneName} 
                  onChange={e => setNewItem({...newItem, milestoneName: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  placeholder="Ej: Entrega fase 1"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={handleAdd} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
                Guardar
              </button>
              <button onClick={() => setShowAddModal(false)} className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
