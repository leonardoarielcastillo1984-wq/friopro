'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Target, Plus, X, CheckCircle, Clock, AlertTriangle, ArrowUp, ChevronRight } from 'lucide-react';
import { apiFetch } from '@/lib/api';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  ABIERTO: { label: 'Abierto', color: 'bg-amber-100 text-amber-700', icon: Clock },
  EN_PROCESO: { label: 'En proceso', color: 'bg-blue-100 text-blue-700', icon: ArrowUp },
  COMPLETADO: { label: 'Completado', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  VENCIDO: { label: 'Vencido', color: 'bg-red-100 text-red-700', icon: AlertTriangle },
  CANCELADO: { label: 'Cancelado', color: 'bg-gray-100 text-gray-500', icon: X },
};

const CRITICALITY_COLORS: Record<string, string> = {
  BAJA: 'bg-gray-100 text-gray-500',
  MEDIA: 'bg-blue-100 text-blue-600',
  ALTA: 'bg-amber-100 text-amber-700',
  CRITICA: 'bg-red-100 text-red-700',
};

export default function PlanesAccionPage() {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [form, setForm] = useState({ title: '', description: '', origin: 'MANUAL', criticality: 'MEDIA', dueDate: '', createNcr: false });
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadPlans(); }, []);

  async function loadPlans() {
    setLoading(true);
    try {
      const data = await apiFetch('/clima/planes-accion') as any;
      setPlans(data.plans || []);
    } catch { setPlans([]); } finally { setLoading(false); }
  }

  async function createPlan(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await apiFetch('/clima/planes-accion', { method: 'POST', body: JSON.stringify(form) });
      setShowNew(false);
      setForm({ title: '', description: '', origin: 'MANUAL', criticality: 'MEDIA', dueDate: '', createNcr: false });
      loadPlans();
    } catch { alert('Error al crear plan'); } finally { setSaving(false); }
  }

  async function updateStatus(id: string, status: string) {
    await apiFetch(`/clima/planes-accion/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
    loadPlans();
    setSelected(null);
  }

  const open = plans.filter(p => ['ABIERTO', 'EN_PROCESO'].includes(p.status));
  const done = plans.filter(p => ['COMPLETADO', 'CANCELADO'].includes(p.status));

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Planes de Acción</h1>
          <p className="text-sm text-gray-500 mt-0.5">{open.length} activos · {done.length} cerrados</p>
        </div>
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow transition-colors">
          <Plus className="w-4 h-4" />
          Nuevo plan
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-3">
        {Object.entries(STATUS_CONFIG).map(([key, conf]) => {
          const count = plans.filter(p => p.status === key).length;
          const Icon = conf.icon;
          return (
            <div key={key} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
              <Icon className={`w-5 h-5 mx-auto mb-1 ${key === 'ABIERTO' ? 'text-amber-500' : key === 'EN_PROCESO' ? 'text-blue-500' : key === 'COMPLETADO' ? 'text-emerald-500' : 'text-red-500'}`} />
              <p className="text-xl font-bold text-gray-900">{count}</p>
              <p className="text-xs text-gray-500">{conf.label}</p>
            </div>
          );
        })}
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-white rounded-2xl border animate-pulse" />)}</div>
      ) : plans.length === 0 ? (
        <div className="text-center py-20">
          <Target className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">No hay planes de acción creados</p>
          <button onClick={() => setShowNew(true)} className="mt-3 text-sm text-teal-600 font-medium">+ Crear plan</button>
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map(plan => {
            const st = STATUS_CONFIG[plan.status] || STATUS_CONFIG.ABIERTO;
            const Icon = st.icon;
            const isOverdue = plan.dueDate && new Date(plan.dueDate) < new Date() && plan.status !== 'COMPLETADO';
            return (
              <div key={plan.id} onClick={() => setSelected(plan)}
                className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all p-4 cursor-pointer ${isOverdue ? 'border-red-200' : 'border-gray-100'}`}>
                <div className="flex items-start gap-3">
                  <Icon className={`w-4 h-4 mt-1 flex-shrink-0 ${isOverdue ? 'text-red-500' : st.color.includes('amber') ? 'text-amber-500' : 'text-blue-500'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-gray-900 text-sm">{plan.title}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.color}`}>{st.label}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CRITICALITY_COLORS[plan.criticality] || 'bg-gray-100 text-gray-500'}`}>{plan.criticality}</span>
                      {plan.ncrId && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">NCR vinculada</span>}
                    </div>
                    {plan.description && <p className="text-xs text-gray-500 line-clamp-1">{plan.description}</p>}
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                      <span>Origen: {plan.origin}</span>
                      {plan.dueDate && <span className={isOverdue ? 'text-red-500 font-medium' : ''}>Vence: {new Date(plan.dueDate).toLocaleDateString('es-AR')}</span>}
                      {plan.responsible && <span>Resp: {plan.responsible.firstName} {plan.responsible.lastName}</span>}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 mt-1" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New Plan Modal */}
      {showNew && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Nuevo Plan de Acción</h3>
              <button onClick={() => setShowNew(false)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={createPlan} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Título *</label>
                <input required type="text" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="Descripción del plan..."
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Descripción</label>
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  rows={3} className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Origen</label>
                  <select value={form.origin} onChange={e => setForm(p => ({ ...p, origin: e.target.value }))}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none bg-white">
                    {['ENCUESTA', 'SUGERENCIA', 'RECLAMO', 'IA', 'MANUAL'].map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Criticidad</label>
                  <select value={form.criticality} onChange={e => setForm(p => ({ ...p, criticality: e.target.value }))}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none bg-white">
                    {['BAJA', 'MEDIA', 'ALTA', 'CRITICA'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Fecha límite</label>
                <input type="date" value={form.dueDate} onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.createNcr} onChange={e => setForm(p => ({ ...p, createNcr: e.target.checked }))} className="rounded" />
                <span className="text-sm text-gray-700">Crear No Conformidad vinculada (CAPA)</span>
              </label>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowNew(false)} className="flex-1 text-sm text-gray-600 border border-gray-200 py-2.5 rounded-xl hover:bg-gray-50 transition-colors">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-sm font-medium py-2.5 rounded-xl transition-colors">
                  {saving ? 'Guardando...' : 'Crear plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900 text-sm">{selected.title}</h3>
              <button onClick={() => setSelected(null)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              {selected.description && <p className="text-sm text-gray-700">{selected.description}</p>}
              <div className="grid grid-cols-2 gap-3 text-xs text-gray-500">
                <div><span className="font-medium text-gray-700">Origen:</span> {selected.origin}</div>
                <div><span className="font-medium text-gray-700">Criticidad:</span> {selected.criticality}</div>
                {selected.dueDate && <div><span className="font-medium text-gray-700">Vence:</span> {new Date(selected.dueDate).toLocaleDateString('es-AR')}</div>}
                {selected.survey && <div><span className="font-medium text-gray-700">Encuesta:</span> {selected.survey.title}</div>}
              </div>
              <div>
                <p className="text-xs font-medium text-gray-600 mb-2">Cambiar estado</p>
                <div className="flex gap-2 flex-wrap">
                  {['ABIERTO', 'EN_PROCESO', 'COMPLETADO'].map(s => (
                    <button key={s} onClick={() => updateStatus(selected.id, s)}
                      className={`text-xs px-3 py-1.5 rounded-xl border transition-colors font-medium ${selected.status === s ? 'bg-teal-600 text-white border-teal-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                      {STATUS_CONFIG[s].label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
