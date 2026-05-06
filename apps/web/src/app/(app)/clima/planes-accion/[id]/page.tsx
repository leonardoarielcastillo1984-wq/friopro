'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Target, CheckCircle, Circle, Plus, Trash2, Save, AlertTriangle, Clock, ExternalLink } from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface AccionItem {
  texto: string;
  estado: 'PENDIENTE' | 'EN_PROCESO' | 'COMPLETADO';
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  ABIERTO:    { label: 'Abierto',    color: 'bg-amber-100 text-amber-700' },
  EN_PROCESO: { label: 'En proceso', color: 'bg-blue-100 text-blue-700' },
  COMPLETADO: { label: 'Completado', color: 'bg-emerald-100 text-emerald-700' },
  VENCIDO:    { label: 'Vencido',    color: 'bg-red-100 text-red-700' },
  CANCELADO:  { label: 'Cancelado',  color: 'bg-gray-100 text-gray-500' },
};

const CRITICALITY_COLORS: Record<string, string> = {
  BAJA:   'bg-gray-100 text-gray-500',
  MEDIA:  'bg-blue-100 text-blue-600',
  ALTA:   'bg-amber-100 text-amber-700',
  CRITICA:'bg-red-100 text-red-700',
};

export default function DetallePlanAccionPage() {
  const router = useRouter();
  const { id } = useParams() as { id: string };
  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [acciones, setAcciones] = useState<AccionItem[]>([]);
  const [newAccion, setNewAccion] = useState('');
  const [saving, setSaving] = useState(false);
  const [evidenceNotes, setEvidenceNotes] = useState('');

  useEffect(() => { loadPlan(); }, [id]);

  async function loadPlan() {
    try {
      const data = await apiFetch('/clima/planes-accion') as any;
      const found = data.plans?.find((p: any) => p.id === id);
      if (found) {
        setPlan(found);
        setAcciones(found.actions || []);
        setEvidenceNotes(found.evidenceNotes || '');
      }
    } catch { } finally { setLoading(false); }
  }

  function toggleAccion(idx: number) {
    setAcciones(prev => prev.map((a, i) => i === idx
      ? { ...a, estado: a.estado === 'COMPLETADO' ? 'PENDIENTE' : 'COMPLETADO' }
      : a
    ));
  }

  function addAccion() {
    if (!newAccion.trim()) return;
    setAcciones(prev => [...prev, { texto: newAccion.trim(), estado: 'PENDIENTE' }]);
    setNewAccion('');
  }

  function removeAccion(idx: number) {
    setAcciones(prev => prev.filter((_, i) => i !== idx));
  }

  async function saveChanges() {
    setSaving(true);
    try {
      const completedCount = acciones.filter(a => a.estado === 'COMPLETADO').length;
      const allDone = acciones.length > 0 && completedCount === acciones.length;
      await apiFetch(`/clima/planes-accion/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          actions: acciones,
          evidenceNotes,
          ...(allDone ? { status: 'COMPLETADO' } : {}),
        }),
      });
      loadPlan();
    } catch { alert('Error al guardar'); } finally { setSaving(false); }
  }

  async function changeStatus(status: string) {
    await apiFetch(`/clima/planes-accion/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
    loadPlan();
  }

  if (loading) return <div className="p-6 text-center text-sm text-gray-400 animate-pulse">Cargando...</div>;
  if (!plan) return <div className="p-6 text-center text-sm text-red-500">Plan no encontrado</div>;

  const st = STATUS_CONFIG[plan.status] || STATUS_CONFIG.ABIERTO;
  const isOverdue = plan.dueDate && new Date(plan.dueDate) < new Date() && plan.status !== 'COMPLETADO';
  const completedCount = acciones.filter(a => a.estado === 'COMPLETADO').length;
  const progress = acciones.length > 0 ? Math.round((completedCount / acciones.length) * 100) : 0;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={() => router.push('/clima/planes-accion')} className="p-2 hover:bg-gray-100 rounded-xl text-gray-500 mt-0.5 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900">{plan.title}</h1>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.color}`}>{st.label}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CRITICALITY_COLORS[plan.criticality] || 'bg-gray-100 text-gray-500'}`}>{plan.criticality}</span>
            {plan.ncrId && (
              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                <ExternalLink className="w-2.5 h-2.5" />NCR vinculada
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
            <span>Origen: {plan.origin}</span>
            {plan.dueDate && (
              <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-500 font-medium' : ''}`}>
                {isOverdue && <AlertTriangle className="w-3 h-3" />}
                Vence: {new Date(plan.dueDate).toLocaleDateString('es-AR')}
              </span>
            )}
            {plan.responsible && (
              <span>Responsable: {plan.responsible.firstName} {plan.responsible.lastName}</span>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      {plan.description && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-sm text-gray-700">{plan.description}</p>
        </div>
      )}

      {/* Links */}
      {(plan.survey || plan.suggestion) && (
        <div className="flex gap-3">
          {plan.survey && (
            <button onClick={() => router.push(`/clima/encuestas/${plan.survey.id}`)}
              className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-800 bg-blue-50 border border-blue-200 px-3 py-2 rounded-xl transition-colors">
              <ExternalLink className="w-3.5 h-3.5" />
              Encuesta origen: {plan.survey.title}
            </button>
          )}
          {plan.suggestion && (
            <button onClick={() => router.push('/clima/sugerencias')}
              className="flex items-center gap-2 text-xs text-purple-600 hover:text-purple-800 bg-purple-50 border border-purple-200 px-3 py-2 rounded-xl transition-colors">
              <ExternalLink className="w-3.5 h-3.5" />
              {plan.suggestion.type}: {plan.suggestion.title}
            </button>
          )}
        </div>
      )}

      {/* Progress */}
      {acciones.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-700">Progreso</span>
            <span className="text-sm font-bold text-teal-700">{completedCount}/{acciones.length} · {progress}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2.5">
            <div
              className={`h-2.5 rounded-full transition-all ${progress === 100 ? 'bg-emerald-500' : 'bg-teal-500'}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Acciones checklist */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">Acciones a realizar</h2>

        {acciones.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No hay acciones definidas aún</p>
        ) : (
          <div className="space-y-2">
            {acciones.map((a, idx) => (
              <div key={idx} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors ${a.estado === 'COMPLETADO' ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50/50 border-gray-100'}`}>
                <button type="button" onClick={() => toggleAccion(idx)} className="flex-shrink-0">
                  {a.estado === 'COMPLETADO'
                    ? <CheckCircle className="w-5 h-5 text-emerald-500" />
                    : <Circle className="w-5 h-5 text-gray-300 hover:text-teal-400 transition-colors" />
                  }
                </button>
                <span className={`flex-1 text-sm ${a.estado === 'COMPLETADO' ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                  {a.texto}
                </span>
                <button type="button" onClick={() => removeAccion(idx)} className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add action */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newAccion}
            onChange={e => setNewAccion(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addAccion())}
            placeholder="Nueva acción... (Enter para agregar)"
            className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 transition-all"
          />
          <button type="button" onClick={addAccion} className="p-2 bg-teal-50 hover:bg-teal-100 text-teal-600 rounded-xl transition-colors border border-teal-200">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Evidencia */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Notas y evidencia</h2>
        <textarea
          value={evidenceNotes}
          onChange={e => setEvidenceNotes(e.target.value)}
          rows={3}
          placeholder="Registrá evidencias, notas de seguimiento, resultados..."
          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 resize-none transition-all"
        />
      </div>

      {/* Cambiar estado */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Estado del plan</h2>
        <div className="flex gap-2 flex-wrap">
          {['ABIERTO', 'EN_PROCESO', 'COMPLETADO', 'CANCELADO'].map(s => (
            <button key={s} onClick={() => changeStatus(s)}
              className={`text-xs px-3 py-2 rounded-xl border transition-colors font-medium ${plan.status === s ? 'bg-teal-600 text-white border-teal-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {STATUS_CONFIG[s].label}
            </button>
          ))}
        </div>
      </div>

      {/* Save */}
      <div className="flex gap-3 justify-end">
        <button onClick={() => router.push('/clima/planes-accion')} className="px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
          Volver
        </button>
        <button onClick={saveChanges} disabled={saving}
          className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-sm font-medium px-5 py-2.5 rounded-xl shadow transition-colors">
          <Save className="w-4 h-4" />
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  );
}
