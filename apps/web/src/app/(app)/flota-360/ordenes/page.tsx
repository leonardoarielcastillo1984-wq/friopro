'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { Plus, X } from 'lucide-react';

type WorkOrder = {
  id: string; code: string; title: string; type: string; priority: string; status: string;
  assetId: string | null; scheduledDate: string | null; technician?: { name: string } | null; totalCost: number;
};

const ESTADO_COLOR: Record<string, string> = {
  PENDING: 'bg-neutral-100 text-neutral-700', IN_PROGRESS: 'bg-blue-50 text-blue-700',
  COMPLETED: 'bg-green-50 text-green-700', ON_HOLD: 'bg-amber-50 text-amber-700', CANCELLED: 'bg-red-50 text-red-600',
};

export default function OrdenesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-neutral-500">Cargando…</div>}>
      <OrdenesPageInner />
    </Suspense>
  );
}

function OrdenesPageInner() {
  const params = useSearchParams();
  const [ordenes, setOrdenes] = useState<WorkOrder[]>([]);
  const [vehiculos, setVehiculos] = useState<any[]>([]);
  const [tecnicos, setTecnicos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(params.get('nueva') === '1');
  const [tab, setTab] = useState<'ACTIVAS' | 'HISTORIAL'>('ACTIVAS');
  const [form, setForm] = useState<any>({ title: '', type: 'CORRECTIVE', priority: 'MEDIUM', assetId: '', technicianId: '', scheduledDate: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [o, v, t] = await Promise.all([
        apiFetch<{ workOrders: WorkOrder[] }>('/maintenance/work-orders'),
        apiFetch<{ vehiculos: any[] }>('/flota/vehiculos'),
        apiFetch<{ technicians: any[] }>('/maintenance/technicians'),
      ]);
      setOrdenes(o.workOrders || []);
      setVehiculos(v.vehiculos || []);
      setTecnicos(t.technicians || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const vehiculoPorAsset = useMemo(() => {
    const m = new Map<string, any>();
    vehiculos.forEach((v) => { if (v.maintenanceAssetId) m.set(v.maintenanceAssetId, v); });
    return m;
  }, [vehiculos]);

  const filtradas = ordenes.filter((o) =>
    tab === 'ACTIVAS' ? ['PENDING', 'IN_PROGRESS', 'ON_HOLD'].includes(o.status) : ['COMPLETED', 'CANCELLED'].includes(o.status)
  );

  const crear = async () => {
    if (!form.title || !form.assetId) { setError('Título y vehículo son obligatorios'); return; }
    setSaving(true);
    setError(null);
    try {
      const veh = vehiculos.find((v) => v.id === form.assetId);
      await apiFetch('/maintenance/work-orders', {
        method: 'POST',
        json: {
          title: form.title,
          type: form.type,
          priority: form.priority,
          assetId: veh?.maintenanceAssetId || undefined,
          technicianId: form.technicianId || undefined,
          scheduledDate: form.scheduledDate || undefined,
        },
      });
      setShowModal(false);
      setForm({ title: '', type: 'CORRECTIVE', priority: 'MEDIUM', assetId: '', technicianId: '', scheduledDate: '' });
      load();
    } catch (e: any) {
      setError(e?.message || 'No se pudo crear la orden');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Órdenes de trabajo</h1>
          <p className="text-sm text-neutral-500">Motor compartido con Infraestructura y Mantenimiento — sin lógica duplicada</p>
        </div>
        <button onClick={() => setShowModal(true)} className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
          <Plus className="h-4 w-4" /> Nueva OT
        </button>
      </div>

      <div className="flex gap-1 border-b border-neutral-200">
        {(['ACTIVAS', 'HISTORIAL'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${tab === t ? 'border-blue-600 text-blue-700' : 'border-transparent text-neutral-500'}`}>
            {t === 'ACTIVAS' ? 'Pendientes' : 'Historial'}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left font-medium px-3 py-2">Código</th>
              <th className="text-left font-medium px-3 py-2">Título</th>
              <th className="text-left font-medium px-3 py-2">Vehículo</th>
              <th className="text-left font-medium px-3 py-2">Prioridad</th>
              <th className="text-left font-medium px-3 py-2">Estado</th>
              <th className="text-left font-medium px-3 py-2">Técnico</th>
              <th className="text-left font-medium px-3 py-2">Costo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {loading && <tr><td colSpan={7} className="px-3 py-6 text-center text-neutral-400">Cargando…</td></tr>}
            {!loading && filtradas.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-neutral-400">Sin órdenes</td></tr>}
            {filtradas.map((o) => (
              <tr key={o.id} className="hover:bg-neutral-50">
                <td className="px-3 py-2 font-medium text-neutral-800">{o.code}</td>
                <td className="px-3 py-2 text-neutral-600">{o.title}</td>
                <td className="px-3 py-2 text-neutral-600">{o.assetId ? vehiculoPorAsset.get(o.assetId)?.dominio || '—' : '—'}</td>
                <td className="px-3 py-2 text-neutral-600">{o.priority}</td>
                <td className="px-3 py-2"><span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${ESTADO_COLOR[o.status] || 'bg-neutral-100'}`}>{o.status}</span></td>
                <td className="px-3 py-2 text-neutral-600">{o.technician?.name || '—'}</td>
                <td className="px-3 py-2 text-neutral-600">${(o.totalCost || 0).toLocaleString('es-AR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-neutral-900">Nueva orden de trabajo</h2>
              <button onClick={() => setShowModal(false)}><X className="h-4 w-4 text-neutral-400" /></button>
            </div>
            <div className="p-4 space-y-3">
              {error && <p className="text-xs text-red-600">{error}</p>}
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Título *</label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Vehículo *</label>
                <select value={form.assetId} onChange={(e) => setForm({ ...form, assetId: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm">
                  <option value="">Seleccionar…</option>
                  {vehiculos.map((v) => <option key={v.id} value={v.id}>{v.dominio} ({v.tipo})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Tipo</label>
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm">
                    <option value="CORRECTIVE">Correctivo</option>
                    <option value="PREVENTIVE">Preventivo</option>
                    <option value="PREDICTIVE">Predictivo</option>
                    <option value="EMERGENCY">Emergencia</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Prioridad</label>
                  <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm">
                    <option value="LOW">Baja</option>
                    <option value="MEDIUM">Media</option>
                    <option value="HIGH">Alta</option>
                    <option value="CRITICAL">Crítica</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Técnico</label>
                <select value={form.technicianId} onChange={(e) => setForm({ ...form, technicianId: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm">
                  <option value="">Sin asignar</option>
                  {tecnicos.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Fecha programada</label>
                <input type="date" value={form.scheduledDate} onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })} className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-neutral-200 px-4 py-3">
              <button onClick={() => setShowModal(false)} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50">Cancelar</button>
              <button onClick={crear} disabled={saving} className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Guardando…' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
