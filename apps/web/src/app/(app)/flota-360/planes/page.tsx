'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Plus, X, Wrench, Zap } from 'lucide-react';

type Rule = {
  id: string; nombre: string; categoria: string; tipoActivoAplicable: string;
  frecuenciaKm: number | null; frecuenciaDias: number | null; criticidad: string;
  duracionEstimada: number | null; accionVencimiento: string;
  aplicaciones: { assetId: string; generatedPlanId: string | null }[];
};

const CRIT_COLOR: Record<string, string> = { BAJA: 'bg-neutral-100 text-neutral-600', MEDIA: 'bg-amber-50 text-amber-700', ALTA: 'bg-red-50 text-red-700' };

export default function PlanesFrecuenciasPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [vehiculos, setVehiculos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [applyRule, setApplyRule] = useState<Rule | null>(null);
  const [applyAssetVeh, setApplyAssetVeh] = useState('');
  const [form, setForm] = useState<any>({
    nombre: '', categoria: 'GENERAL', tipoActivoAplicable: 'TODOS',
    frecuenciaKm: '', frecuenciaDias: '', criticidad: 'MEDIA', duracionEstimada: '', accionVencimiento: 'ALERTA',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [r, p, v] = await Promise.all([
        apiFetch<{ rules: Rule[] }>('/fleet-ops/component-rules'),
        apiFetch<{ plans: any[] }>('/maintenance/plans'),
        apiFetch<{ vehiculos: any[] }>('/flota/vehiculos'),
      ]);
      setRules(r.rules || []);
      setPlans((p.plans || []).filter((pl: any) => pl.assetId));
      setVehiculos(v.vehiculos || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const crear = async () => {
    if (!form.nombre) { setError('El nombre es obligatorio'); return; }
    setSaving(true);
    setError(null);
    try {
      await apiFetch('/fleet-ops/component-rules', {
        method: 'POST',
        json: {
          ...form,
          frecuenciaKm: form.frecuenciaKm ? Number(form.frecuenciaKm) : undefined,
          frecuenciaDias: form.frecuenciaDias ? Number(form.frecuenciaDias) : undefined,
          duracionEstimada: form.duracionEstimada ? Number(form.duracionEstimada) : undefined,
        },
      });
      setShowModal(false);
      setForm({ nombre: '', categoria: 'GENERAL', tipoActivoAplicable: 'TODOS', frecuenciaKm: '', frecuenciaDias: '', criticidad: 'MEDIA', duracionEstimada: '', accionVencimiento: 'ALERTA' });
      load();
    } catch (e: any) {
      setError(e?.message || 'No se pudo crear la regla');
    } finally {
      setSaving(false);
    }
  };

  const aplicar = async () => {
    if (!applyRule || !applyAssetVeh) return;
    const veh = vehiculos.find((v) => v.id === applyAssetVeh);
    if (!veh?.maintenanceAssetId) { setError('Este vehículo no tiene un activo de mantenimiento vinculado'); return; }
    setSaving(true);
    try {
      await apiFetch(`/fleet-ops/component-rules/${applyRule.id}/aplicar`, { method: 'POST', json: { assetId: veh.maintenanceAssetId } });
      setApplyRule(null);
      setApplyAssetVeh('');
      load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Planes y frecuencias</h1>
          <p className="text-sm text-neutral-500">Catálogo de componentes. Al aplicar una regla a un vehículo, se sincroniza con un Plan de mantenimiento real.</p>
        </div>
        <button onClick={() => setShowModal(true)} className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
          <Plus className="h-4 w-4" /> Nuevo componente
        </button>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
        <div className="px-4 py-2.5 border-b border-neutral-200 text-sm font-semibold text-neutral-800 flex items-center gap-1.5"><Wrench className="h-4 w-4" /> Catálogo de componentes</div>
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left font-medium px-3 py-2">Componente</th>
              <th className="text-left font-medium px-3 py-2">Aplica a</th>
              <th className="text-left font-medium px-3 py-2">Regla de servicio</th>
              <th className="text-left font-medium px-3 py-2">Criticidad</th>
              <th className="text-left font-medium px-3 py-2">Vehículos con plan</th>
              <th className="text-left font-medium px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {loading && <tr><td colSpan={6} className="px-3 py-6 text-center text-neutral-400">Cargando…</td></tr>}
            {!loading && rules.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-neutral-400">Sin componentes definidos</td></tr>}
            {rules.map((r) => (
              <tr key={r.id} className="hover:bg-neutral-50">
                <td className="px-3 py-2 font-medium text-neutral-800">{r.nombre}<div className="text-xs text-neutral-400">{r.categoria}</div></td>
                <td className="px-3 py-2 text-neutral-600">{r.tipoActivoAplicable}</td>
                <td className="px-3 py-2 text-neutral-600">
                  {r.frecuenciaKm ? `Cada ${r.frecuenciaKm.toLocaleString('es-AR')} km` : ''}
                  {r.frecuenciaKm && r.frecuenciaDias ? ' o ' : ''}
                  {r.frecuenciaDias ? `${r.frecuenciaDias} días` : ''}
                  {!r.frecuenciaKm && !r.frecuenciaDias && '—'}
                </td>
                <td className="px-3 py-2"><span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${CRIT_COLOR[r.criticidad]}`}>{r.criticidad}</span></td>
                <td className="px-3 py-2 text-neutral-600">{r.aplicaciones?.length || 0}</td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => setApplyRule(r)} className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"><Zap className="h-3 w-3" /> Aplicar a vehículo</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
        <div className="px-4 py-2.5 border-b border-neutral-200 text-sm font-semibold text-neutral-800">Planes de mantenimiento activos (motor existente)</div>
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left font-medium px-3 py-2">Plan</th>
              <th className="text-left font-medium px-3 py-2">Activo</th>
              <th className="text-left font-medium px-3 py-2">Frecuencia</th>
              <th className="text-left font-medium px-3 py-2">Próxima ejecución</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {plans.length === 0 && <tr><td colSpan={4} className="px-3 py-4 text-center text-neutral-400">Sin planes vinculados a activos</td></tr>}
            {plans.map((p) => (
              <tr key={p.id}>
                <td className="px-3 py-2 font-medium text-neutral-800">{p.title}</td>
                <td className="px-3 py-2 text-neutral-600">{p.asset?.name || '—'}</td>
                <td className="px-3 py-2 text-neutral-600">{p.frequencyUnit === 'KM' ? `${p.triggerKm} km` : `${p.frequencyValue} ${p.frequencyUnit}`}</td>
                <td className="px-3 py-2 text-neutral-600">{p.nextExecutionDate ? new Date(p.nextExecutionDate).toLocaleDateString('es-AR') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-neutral-900">Nuevo componente</h2>
              <button onClick={() => setShowModal(false)}><X className="h-4 w-4 text-neutral-400" /></button>
            </div>
            <div className="p-4 space-y-3">
              {error && <p className="text-xs text-red-600">{error}</p>}
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Nombre *</label>
                <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Cambio de aceite de motor" className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Categoría</label>
                  <select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm">
                    {['MOTOR', 'FRENOS', 'NEUMATICOS', 'SUSPENSION', 'LUBRICACION', 'DOCUMENTACION', 'GENERAL'].map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Aplica a</label>
                  <select value={form.tipoActivoAplicable} onChange={(e) => setForm({ ...form, tipoActivoAplicable: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm">
                    {['TODOS', 'TRACTOR', 'CAMION', 'UTILITARIO', 'SEMI', 'CONJUNTO'].map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Frecuencia (km)</label>
                  <input type="number" value={form.frecuenciaKm} onChange={(e) => setForm({ ...form, frecuenciaKm: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Frecuencia (días)</label>
                  <input type="number" value={form.frecuenciaDias} onChange={(e) => setForm({ ...form, frecuenciaDias: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Criticidad</label>
                  <select value={form.criticidad} onChange={(e) => setForm({ ...form, criticidad: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm">
                    <option value="BAJA">Baja</option><option value="MEDIA">Media</option><option value="ALTA">Alta</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Duración estimada (h)</label>
                  <input type="number" value={form.duracionEstimada} onChange={(e) => setForm({ ...form, duracionEstimada: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Acción ante vencimiento</label>
                <select value={form.accionVencimiento} onChange={(e) => setForm({ ...form, accionVencimiento: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm">
                  <option value="ALERTA">Solo alerta</option>
                  <option value="SUGERENCIA_OT">Sugerencia de OT</option>
                  <option value="GENERAR_OT">Generar OT automáticamente</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-neutral-200 px-4 py-3">
              <button onClick={() => setShowModal(false)} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50">Cancelar</button>
              <button onClick={crear} disabled={saving} className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">{saving ? 'Guardando…' : 'Crear'}</button>
            </div>
          </div>
        </div>
      )}

      {applyRule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-neutral-900">Aplicar "{applyRule.nombre}"</h2>
              <button onClick={() => setApplyRule(null)}><X className="h-4 w-4 text-neutral-400" /></button>
            </div>
            <div className="p-4 space-y-3">
              {error && <p className="text-xs text-red-600">{error}</p>}
              <label className="block text-xs font-medium text-neutral-600 mb-1">Vehículo</label>
              <select value={applyAssetVeh} onChange={(e) => setApplyAssetVeh(e.target.value)} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm">
                <option value="">Seleccionar…</option>
                {vehiculos.map((v) => <option key={v.id} value={v.id}>{v.dominio}</option>)}
              </select>
              <p className="text-xs text-neutral-500">Esto crea o actualiza un Plan de Mantenimiento real vinculado a este vehículo, sin afectar planes existentes de otros activos.</p>
            </div>
            <div className="flex justify-end gap-2 border-t border-neutral-200 px-4 py-3">
              <button onClick={() => setApplyRule(null)} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50">Cancelar</button>
              <button onClick={aplicar} disabled={saving} className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">{saving ? 'Aplicando…' : 'Aplicar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
