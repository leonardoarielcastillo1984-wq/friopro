'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import {
  TrendingUp, TrendingDown, DollarSign, Percent, Clock, ShieldAlert, ShieldCheck, Shield,
  BarChart3, Target, Zap, ArrowRight, Save, RotateCcw, AlertTriangle, CheckCircle2, XCircle
} from 'lucide-react';

interface BusinessCase {
  id: string;
  estimatedRevenue: number | null;
  directCosts: number | null;
  indirectCosts: number | null;
  financialMargin: number | null;
  grossMargin: number | null;
  netMargin: number | null;
  roi: number | null;
  paybackMonths: number | null;
  minimumAcceptedMargin: number | null;
  currency: string;
  financialRisk: number | null;
  operationalRisk: number | null;
  commercialRisk: number | null;
  strategicRisk: number | null;
  successProbability: number | null;
  estimatedHours: number | null;
  estimatedKm: number | null;
  estimatedFuel: number | null;
  requiredVehicles: number | null;
  requiredEmployees: number | null;
  requiredSupervisors: number | null;
  clientStrategicLevel: string | null;
  businessScore: number | null;
  competitiveDifficulty: number | null;
  marketOpportunity: number | null;
  viabilityStatus: string;
  executiveSummary: string | null;
  recommendation: string | null;
  financialScore: number | null;
  operationalScore: number | null;
  commercialScore: number | null;
  strategicScore: number | null;
  contractualScore: number | null;
  riskScore: number | null;
  capacityScore: number | null;
  overallScore: number | null;
  createdAt: string;
}

interface Props {
  projectId: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  VERDE: { label: 'Viable', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: ShieldCheck },
  AMARILLO: { label: 'Revisar', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: Shield },
  ROJO: { label: 'Alto Riesgo', color: 'text-red-700', bg: 'bg-red-50 border-red-200', icon: ShieldAlert },
};

const REC_LABEL: Record<string, { label: string; color: string }> = {
  RECOMENDABLE: { label: 'Recomendable', color: 'text-emerald-600' },
  REVISAR: { label: 'Revisar', color: 'text-amber-600' },
  ALTO_RIESGO: { label: 'Alto Riesgo', color: 'text-orange-600' },
  NO_RECOMENDABLE: { label: 'No Recomendable', color: 'text-red-600' },
};

function formatCurrency(val: number | null, currency = 'ARS') {
  if (val == null) return '-';
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(val);
}

function formatPercent(val: number | null) {
  if (val == null) return '-';
  return `${Math.round(val * 10) / 10}%`;
}

export default function BusinessCaseTab({ projectId }: Props) {
  const [bc, setBc] = useState<BusinessCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<BusinessCase>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/project360-v1/projects/${projectId}/business-case`) as any;
      setBc(res.businessCase);
      if (res.businessCase) setForm(res.businessCase);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await apiFetch(`/project360-v1/projects/${projectId}/business-case`, {
        method: 'POST',
        json: form,
      }) as any;
      setBc(res.businessCase);
      setEditing(false);
    } catch (e: any) {
      alert(e.message || 'Error guardando Business Case');
    } finally {
      setSaving(false);
    }
  };

  const updateForm = (field: keyof BusinessCase, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Cargando Business Case...</div>;

  const status = STATUS_CONFIG[bc?.viabilityStatus || 'AMARILLO'];
  const StatusIcon = status.icon;
  const rec = REC_LABEL[bc?.recommendation || 'REVISAR'];

  const kpis = [
    { label: 'Ingreso Estimado', value: formatCurrency(bc?.estimatedRevenue, bc?.currency), icon: DollarSign, color: 'bg-blue-50 text-blue-600' },
    { label: 'Costos Directos', value: formatCurrency(bc?.directCosts, bc?.currency), icon: TrendingDown, color: 'bg-red-50 text-red-600' },
    { label: 'Margen Bruto', value: formatPercent(bc?.grossMargin), icon: Percent, color: 'bg-emerald-50 text-emerald-600' },
    { label: 'ROI', value: formatPercent(bc?.roi), icon: TrendingUp, color: 'bg-purple-50 text-purple-600' },
    { label: 'Payback', value: bc?.paybackMonths ? `${Math.round(bc.paybackMonths * 10) / 10} meses` : '-', icon: Clock, color: 'bg-amber-50 text-amber-600' },
    { label: 'Score General', value: bc?.overallScore ? `${Math.round(bc.overallScore)} / 100` : '-', icon: Target, color: 'bg-indigo-50 text-indigo-600' },
  ];

  const radarData = [
    { label: 'Financiero', value: bc?.financialScore || 0, color: '#10b981' },
    { label: 'Operativo', value: bc?.operationalScore || 0, color: '#3b82f6' },
    { label: 'Comercial', value: bc?.commercialScore || 0, color: '#8b5cf6' },
    { label: 'Estratégico', value: bc?.strategicScore || 0, color: '#f59e0b' },
    { label: 'Contractual', value: bc?.contractualScore || 0, color: '#ec4899' },
    { label: 'Riesgo', value: 100 - (bc?.riskScore || 0), color: '#ef4444' },
  ];

  return (
    <div className="space-y-6">
      {/* Header con semáforo */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Business Case</h2>
          <p className="text-sm text-gray-500">Análisis de viabilidad financiera y estratégica</p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${status.bg}`}>
            <StatusIcon className={`w-5 h-5 ${status.color}`} />
            <span className={`font-semibold text-sm ${status.color}`}>{status.label}</span>
          </div>
          <button
            onClick={() => setEditing(!editing)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            {editing ? 'Cancelar' : 'Editar'}
          </button>
        </div>
      </div>

      {/* Recomendación */}
      {bc?.recommendation && (
        <div className="bg-white rounded-xl border p-4 flex items-center gap-3">
          {bc.recommendation === 'RECOMENDABLE' ? <CheckCircle2 className="w-6 h-6 text-emerald-500" /> :
           bc.recommendation === 'NO_RECOMENDABLE' ? <XCircle className="w-6 h-6 text-red-500" /> :
           <AlertTriangle className="w-6 h-6 text-amber-500" />}
          <div>
            <span className="text-sm text-gray-500">Recomendación del sistema:</span>
            <span className={`ml-2 font-bold ${rec.color}`}>{rec.label}</span>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-xl border p-4">
            <div className={`w-10 h-10 rounded-lg ${kpi.color} flex items-center justify-center mb-3`}>
              <kpi.icon className="w-5 h-5" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{kpi.value}</div>
            <div className="text-xs text-gray-500 mt-1">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Radar de riesgos + scores */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Radar Chart */}
        <div className="bg-white rounded-xl border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            Radar de Scores
          </h3>
          <div className="relative w-full aspect-square max-w-sm mx-auto">
            <svg viewBox="0 0 200 200" className="w-full h-full">
              {/* Background grid */}
              {[20, 40, 60, 80, 100].map(r => (
                <circle key={r} cx="100" cy="100" r={r} fill="none" stroke="#e5e7eb" strokeWidth="0.5" />
              ))}
              {/* Axes */}
              {radarData.map((_, i) => {
                const angle = (Math.PI * 2 * i) / radarData.length - Math.PI / 2;
                const x = 100 + 100 * Math.cos(angle);
                const y = 100 + 100 * Math.sin(angle);
                return <line key={i} x1="100" y1="100" x2={x} y2={y} stroke="#e5e7eb" strokeWidth="0.5" />;
              })}
              {/* Data polygon */}
              <polygon
                points={radarData.map((d, i) => {
                  const angle = (Math.PI * 2 * i) / radarData.length - Math.PI / 2;
                  const r = (d.value / 100) * 100;
                  return `${100 + r * Math.cos(angle)},${100 + r * Math.sin(angle)}`;
                }).join(' ')}
                fill="rgba(59, 130, 246, 0.2)"
                stroke="#3b82f6"
                strokeWidth="2"
              />
              {/* Labels */}
              {radarData.map((d, i) => {
                const angle = (Math.PI * 2 * i) / radarData.length - Math.PI / 2;
                const x = 100 + 115 * Math.cos(angle);
                const y = 100 + 115 * Math.sin(angle);
                return (
                  <text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize="7" fill="#374151">
                    {d.label}
                  </text>
                );
              })}
            </svg>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
            {radarData.map(d => (
              <div key={d.label} className="flex items-center gap-1 justify-center">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="text-gray-600">{d.label}: {Math.round(d.value)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Riesgos */}
        <div className="bg-white rounded-xl border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-600" />
            Evaluación de Riesgos
          </h3>
          <div className="space-y-4">
            {[
              { label: 'Riesgo Financiero', value: bc?.financialRisk, color: 'bg-red-500' },
              { label: 'Riesgo Operativo', value: bc?.operationalRisk, color: 'bg-orange-500' },
              { label: 'Riesgo Comercial', value: bc?.commercialRisk, color: 'bg-amber-500' },
              { label: 'Riesgo Estratégico', value: bc?.strategicRisk, color: 'bg-blue-500' },
              { label: 'Probabilidad de Éxito', value: bc?.successProbability, color: 'bg-emerald-500' },
            ].map(r => (
              <div key={r.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-700">{r.label}</span>
                  <span className="font-semibold text-gray-900">{r.value ?? '-'}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5">
                  <div className={`${r.color} h-2.5 rounded-full transition-all`} style={{ width: `${Math.min(100, Math.max(0, r.value || 0))}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Resumen ejecutivo */}
      {bc?.executiveSummary && (
        <div className="bg-white rounded-xl border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Resumen Ejecutivo</h3>
          <p className="text-gray-600 text-sm leading-relaxed">{bc.executiveSummary}</p>
        </div>
      )}

      {/* Formulario de edición */}
      {editing && (
        <div className="bg-white rounded-xl border p-6 space-y-6">
          <h3 className="text-lg font-semibold text-gray-900">Editar Business Case</h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ingreso Estimado</label>
              <input
                type="number"
                value={form.estimatedRevenue || ''}
                onChange={e => updateForm('estimatedRevenue', Number(e.target.value))}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Costos Directos</label>
              <input
                type="number"
                value={form.directCosts || ''}
                onChange={e => updateForm('directCosts', Number(e.target.value))}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Costos Indirectos</label>
              <input
                type="number"
                value={form.indirectCosts || ''}
                onChange={e => updateForm('indirectCosts', Number(e.target.value))}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Margen Mínimo Aceptado (%)</label>
              <input
                type="number"
                value={form.minimumAcceptedMargin || ''}
                onChange={e => updateForm('minimumAcceptedMargin', Number(e.target.value))}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                placeholder="10"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Moneda</label>
              <select
                value={form.currency || 'ARS'}
                onChange={e => updateForm('currency', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              >
                <option value="ARS">ARS</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nivel Estratégico Cliente</label>
              <select
                value={form.clientStrategicLevel || ''}
                onChange={e => updateForm('clientStrategicLevel', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              >
                <option value="">Seleccionar...</option>
                <option value="ALTO">Alto</option>
                <option value="MEDIO">Medio</option>
                <option value="BAJO">Bajo</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Riesgo Financiero (0-100)', field: 'financialRisk' as const },
              { label: 'Riesgo Operativo (0-100)', field: 'operationalRisk' as const },
              { label: 'Riesgo Comercial (0-100)', field: 'commercialRisk' as const },
              { label: 'Riesgo Estratégico (0-100)', field: 'strategicRisk' as const },
              { label: 'Prob. Éxito (0-100)', field: 'successProbability' as const },
              { label: 'Horas Estimadas', field: 'estimatedHours' as const },
              { label: 'KM Estimados', field: 'estimatedKm' as const },
              { label: 'Combustible Est.', field: 'estimatedFuel' as const },
            ].map(item => (
              <div key={item.field}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{item.label}</label>
                <input
                  type="number"
                  value={(form as any)[item.field] || ''}
                  onChange={e => updateForm(item.field, Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vehículos Requeridos</label>
              <input
                type="number"
                value={form.requiredVehicles || ''}
                onChange={e => updateForm('requiredVehicles', Number(e.target.value))}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Empleados Requeridos</label>
              <input
                type="number"
                value={form.requiredEmployees || ''}
                onChange={e => updateForm('requiredEmployees', Number(e.target.value))}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Supervisores Requeridos</label>
              <input
                type="number"
                value={form.requiredSupervisors || ''}
                onChange={e => updateForm('requiredSupervisors', Number(e.target.value))}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Resumen Ejecutivo</label>
            <textarea
              value={form.executiveSummary || ''}
              onChange={e => updateForm('executiveSummary', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="Describe el business case..."
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Guardando...' : 'Guardar y Calcular'}
            </button>
            <button
              onClick={() => { setEditing(false); setForm(bc || {}); }}
              className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
