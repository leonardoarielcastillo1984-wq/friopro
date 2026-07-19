'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import {
  Play, Plus, TrendingUp, AlertTriangle, CheckCircle2, BarChart3,
  DollarSign, Users, Truck, Fuel, ArrowUpRight, ArrowDownRight, Minus
} from 'lucide-react';

interface Simulation {
  id: string;
  name: string;
  scenarioType: string;
  projectedMargin: number | null;
  projectedRoi: number | null;
  projectedProfit: number | null;
  projectedRevenue: number | null;
  projectedCost: number | null;
  projectedPayback: number | null;
  marginDeviation: number | null;
  roiDeviation: number | null;
  riskLevel: string;
  isBaseline: boolean;
  projectedCashflow: any[];
  createdAt: string;
}

interface Props {
  projectId: string;
}

const SCENARIO_COLORS: Record<string, string> = {
  OPTIMISTA: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  PROBABLE: 'bg-blue-50 text-blue-700 border-blue-200',
  PESIMISTA: 'bg-red-50 text-red-700 border-red-200',
  CUSTOM: 'bg-gray-50 text-gray-700 border-gray-200',
};

const RISK_COLORS: Record<string, string> = {
  BAJO: 'text-emerald-600',
  MEDIO: 'text-amber-600',
  ALTO: 'text-orange-600',
  CRITICO: 'text-red-600',
};

export default function SimulationTab({ projectId }: Props) {
  const [sims, setSims] = useState<Simulation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', scenarioType: 'PROBABLE', fuelPrice: '', exchangeRate: '', inflationRate: '',
    salaryIncrease: '', employeeCount: '', vehicleCount: '', indirectCosts: '',
    financingRate: '', tripCount: '', operationalVolume: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/project360-v1/projects/${projectId}/simulations`) as any;
      setSims(res.simulations || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiFetch(`/project360-v1/projects/${projectId}/simulations`, {
        method: 'POST',
        json: {
          ...form,
          fuelPrice: Number(form.fuelPrice) || undefined,
          exchangeRate: Number(form.exchangeRate) || undefined,
          inflationRate: Number(form.inflationRate) || undefined,
          salaryIncrease: Number(form.salaryIncrease) || undefined,
          employeeCount: Number(form.employeeCount) || undefined,
          vehicleCount: Number(form.vehicleCount) || undefined,
          indirectCosts: Number(form.indirectCosts) || undefined,
          financingRate: Number(form.financingRate) || undefined,
          tripCount: Number(form.tripCount) || undefined,
          operationalVolume: Number(form.operationalVolume) || undefined,
        },
      });
      setShowForm(false);
      setForm({ name: '', scenarioType: 'PROBABLE', fuelPrice: '', exchangeRate: '', inflationRate: '', salaryIncrease: '', employeeCount: '', vehicleCount: '', indirectCosts: '', financingRate: '', tripCount: '', operationalVolume: '' });
      load();
    } catch (e: any) { alert(e.message); }
    setSaving(false);
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Cargando simulaciones...</div>;

  const baseline = sims.find(s => s.isBaseline);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Simulación Financiera</h2>
          <p className="text-sm text-gray-500">Escenarios optimista, probable y pesimista</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Nuevo Escenario
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border p-6 space-y-4">
          <h3 className="font-semibold text-gray-900">Nuevo Escenario</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <input placeholder="Nombre" className="px-3 py-2 border rounded-lg text-sm" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <select className="px-3 py-2 border rounded-lg text-sm" value={form.scenarioType} onChange={e => setForm({ ...form, scenarioType: e.target.value })}>
              <option value="OPTIMISTA">Optimista</option>
              <option value="PROBABLE">Probable</option>
              <option value="PESIMISTA">Pesimista</option>
              <option value="CUSTOM">Personalizado</option>
            </select>
            <input placeholder="Precio Combustible" type="number" className="px-3 py-2 border rounded-lg text-sm" value={form.fuelPrice} onChange={e => setForm({ ...form, fuelPrice: e.target.value })} />
            <input placeholder="Tipo de Cambio" type="number" className="px-3 py-2 border rounded-lg text-sm" value={form.exchangeRate} onChange={e => setForm({ ...form, exchangeRate: e.target.value })} />
            <input placeholder="Inflación (%)" type="number" className="px-3 py-2 border rounded-lg text-sm" value={form.inflationRate} onChange={e => setForm({ ...form, inflationRate: e.target.value })} />
            <input placeholder="Aumento Salarial (%)" type="number" className="px-3 py-2 border rounded-lg text-sm" value={form.salaryIncrease} onChange={e => setForm({ ...form, salaryIncrease: e.target.value })} />
            <input placeholder="Cant. Personal" type="number" className="px-3 py-2 border rounded-lg text-sm" value={form.employeeCount} onChange={e => setForm({ ...form, employeeCount: e.target.value })} />
            <input placeholder="Cant. Vehículos" type="number" className="px-3 py-2 border rounded-lg text-sm" value={form.vehicleCount} onChange={e => setForm({ ...form, vehicleCount: e.target.value })} />
            <input placeholder="Costos Indirectos" type="number" className="px-3 py-2 border rounded-lg text-sm" value={form.indirectCosts} onChange={e => setForm({ ...form, indirectCosts: e.target.value })} />
            <input placeholder="Tasa Financiera (%)" type="number" className="px-3 py-2 border rounded-lg text-sm" value={form.financingRate} onChange={e => setForm({ ...form, financingRate: e.target.value })} />
            <input placeholder="Cant. Viajes" type="number" className="px-3 py-2 border rounded-lg text-sm" value={form.tripCount} onChange={e => setForm({ ...form, tripCount: e.target.value })} />
            <input placeholder="Volumen Operativo" type="number" className="px-3 py-2 border rounded-lg text-sm" value={form.operationalVolume} onChange={e => setForm({ ...form, operationalVolume: e.target.value })} />
          </div>
          <div className="flex gap-3">
            <button onClick={handleSave} disabled={saving} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
              {saving ? 'Calculando...' : 'Calcular Escenario'}
            </button>
            <button onClick={() => setShowForm(false)} className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium">Cancelar</button>
          </div>
        </div>
      )}

      {/* Comparativa */}
      {sims.length > 0 && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-600" /> Comparativa de Escenarios
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Escenario</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Margen</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">ROI</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Utilidad</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Ingresos</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Costos</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">Desv. Margen</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">Riesgo</th>
                </tr>
              </thead>
              <tbody>
                {sims.map(s => (
                  <tr key={s.id} className={`border-t ${s.isBaseline ? 'bg-blue-50/50' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium border ${SCENARIO_COLORS[s.scenarioType] || SCENARIO_COLORS.CUSTOM}`}>
                          {s.scenarioType}
                        </span>
                        <span className="font-medium text-gray-900">{s.name}</span>
                        {s.isBaseline && <span className="text-xs text-blue-600 font-medium">(Base)</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{s.projectedMargin?.toFixed(1)}%</td>
                    <td className="px-4 py-3 text-right text-gray-700">{s.projectedRoi?.toFixed(1)}%</td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {s.projectedProfit ? new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(s.projectedProfit) : '-'}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {s.projectedRevenue ? new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(s.projectedRevenue) : '-'}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {s.projectedCost ? new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(s.projectedCost) : '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {s.marginDeviation != null ? (
                        <span className={`flex items-center justify-center gap-1 text-xs font-medium ${s.marginDeviation >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {s.marginDeviation >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          {Math.abs(s.marginDeviation).toFixed(1)}%
                        </span>
                      ) : <Minus className="w-3 h-3 text-gray-400 mx-auto" />}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-semibold ${RISK_COLORS[s.riskLevel] || 'text-gray-600'}`}>{s.riskLevel}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cashflow de escenarios */}
      {sims.filter(s => s.projectedCashflow?.length > 0).map(s => (
        <div key={s.id} className="bg-white rounded-xl border p-6">
          <h4 className="font-semibold text-gray-900 mb-4">Cashflow Proyectado — {s.name}</h4>
          <div className="flex items-end gap-1 h-40">
            {s.projectedCashflow.map((c: any, i: number) => (
              <div key={i} className="flex-1 flex flex-col gap-1">
                <div className="flex gap-0.5 h-full items-end">
                  <div className="flex-1 bg-emerald-400 rounded-t" style={{ height: `${Math.max(5, (c.revenue / Math.max(...s.projectedCashflow.map((x: any) => x.revenue || 1))) * 100)}%` }} />
                  <div className="flex-1 bg-red-400 rounded-t" style={{ height: `${Math.max(5, (c.expenses / Math.max(...s.projectedCashflow.map((x: any) => x.revenue || 1))) * 100)}%` }} />
                </div>
                <span className="text-[10px] text-center text-gray-500">M{i + 1}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-4 mt-3 text-xs text-gray-600">
            <span className="flex items-center gap-1"><div className="w-2 h-2 bg-emerald-400 rounded" /> Ingresos</span>
            <span className="flex items-center gap-1"><div className="w-2 h-2 bg-red-400 rounded" /> Egresos</span>
          </div>
        </div>
      ))}
    </div>
  );
}
