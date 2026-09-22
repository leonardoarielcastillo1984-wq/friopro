'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { ClipboardCheck, Plus, ArrowLeft, Trash2, Loader2, Save, Star } from 'lucide-react';

const PHASES: Record<string, string> = { PROTOTYPE: 'Prototipo', PRELAUNCH: 'Pre-lanzamiento', PRODUCTION: 'Producción' };
const EMPTY_ROW = { id: '', step: '', characteristic: '', spec: '', method: '', sampleSize: '', frequency: '', controlMethod: '', reactionPlan: '', special: false };

export default function ControlPlanPage() {
  const [items, setItems] = useState<any[]>([]);
  const [fmeas, setFmeas] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', phase: 'PRODUCTION', partNumber: '', process: '', fmeaId: '' });

  const load = async () => {
    setLoading(true);
    try {
      const [cp, fm] = await Promise.all([
        apiFetch<{ items: any[] }>('/core-tools/control-plans'),
        apiFetch<{ items: any[] }>('/core-tools/fmea'),
      ]);
      setItems(cp.items || []);
      setFmeas(fm.items || []);
    } catch (e: any) { setError(e?.message || 'Error'); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openDetail = async (id: string) => {
    const res = await apiFetch<{ item: any }>(`/core-tools/control-plans/${id}`);
    setSelected(res.item);
    setRows(Array.isArray(res.item.items) ? res.item.items : []);
  };

  const create = async () => {
    try {
      await apiFetch('/core-tools/control-plans', {
        method: 'POST',
        json: { ...form, partNumber: form.partNumber || null, process: form.process || null, fmeaId: form.fmeaId || null },
      });
      setShowCreate(false);
      setForm({ name: '', phase: 'PRODUCTION', partNumber: '', process: '', fmeaId: '' });
      load();
    } catch (e: any) { setError(e?.message || 'Error creando'); }
  };

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await apiFetch<{ item: any }>(`/core-tools/control-plans/${selected.id}`, { method: 'PUT', json: { items: rows } });
      setSelected(res.item); setRows(res.item.items || []); setError('');
    } catch (e: any) { setError(e?.message || 'Error guardando'); } finally { setSaving(false); }
  };

  const updateRow = (i: number, k: string, v: any) => {
    const next = [...rows]; next[i] = { ...next[i], [k]: v }; setRows(next);
  };

  const remove = async (id: string) => {
    if (!confirm('¿Eliminar este plan?')) return;
    await apiFetch(`/core-tools/control-plans/${id}`, { method: 'DELETE' });
    if (selected?.id === id) setSelected(null);
    load();
  };

  if (selected) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={() => setSelected(null)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800">
            <ArrowLeft className="h-4 w-4" /> Volver
          </button>
          <button onClick={save} disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar
          </button>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="text-lg font-bold text-gray-900">{selected.code} — {selected.name}</h2>
          <p className="text-sm text-gray-500">{PHASES[selected.phase]} · {selected.partNumber || ''} · {selected.process || ''}</p>
        </div>

        {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}

        <div className="rounded-xl border border-gray-200 bg-white overflow-x-auto">
          <table className="w-full text-xs min-w-[1000px]">
            <thead>
              <tr className="bg-gray-50 text-left text-gray-500 border-b">
                <th className="px-2 py-2 w-8">★</th><th className="px-2 py-2">Paso</th><th className="px-2 py-2">Característica</th>
                <th className="px-2 py-2">Especificación</th><th className="px-2 py-2">Método de medición</th>
                <th className="px-2 py-2 w-20">Muestra</th><th className="px-2 py-2 w-24">Frecuencia</th>
                <th className="px-2 py-2">Método de control</th><th className="px-2 py-2">Plan de reacción</th><th className="px-2 py-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id || i} className={`border-b border-gray-100 align-top ${r.special ? 'bg-amber-50/50' : ''}`}>
                  <td className="px-1 py-1 text-center">
                    <button onClick={() => updateRow(i, 'special', !r.special)} title="Característica especial">
                      <Star className={`h-4 w-4 ${r.special ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
                    </button>
                  </td>
                  {['step', 'characteristic', 'spec', 'method'].map((k) => (
                    <td key={k} className="px-1 py-1">
                      <textarea rows={2} className="w-full rounded border border-transparent hover:border-gray-200 px-1.5 py-1 text-xs resize-none bg-transparent"
                        value={r[k] || ''} onChange={(e) => updateRow(i, k, e.target.value)} />
                    </td>
                  ))}
                  {['sampleSize', 'frequency'].map((k) => (
                    <td key={k} className="px-1 py-1">
                      <input className="w-full rounded border border-transparent hover:border-gray-200 px-1.5 py-1 text-xs bg-transparent"
                        value={r[k] || ''} onChange={(e) => updateRow(i, k, e.target.value)} />
                    </td>
                  ))}
                  {['controlMethod', 'reactionPlan'].map((k) => (
                    <td key={k} className="px-1 py-1">
                      <textarea rows={2} className="w-full rounded border border-transparent hover:border-gray-200 px-1.5 py-1 text-xs resize-none bg-transparent"
                        value={r[k] || ''} onChange={(e) => updateRow(i, k, e.target.value)} />
                    </td>
                  ))}
                  <td className="px-1 py-1">
                    <button onClick={() => setRows(rows.filter((_, j) => j !== i))} className="p-1 text-gray-300 hover:text-red-500">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={() => setRows([...rows, { ...EMPTY_ROW, id: `cp-${Date.now()}` }])}
            className="m-3 flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50">
            <Plus className="h-3.5 w-3.5" /> Agregar fila
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-indigo-600" /> Planes de Control
          </h1>
          <p className="text-sm text-gray-500">Prototipo, pre-lanzamiento y producción — vinculables a PFMEA</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700">
          <Plus className="h-4 w-4" /> Nuevo plan
        </button>
      </div>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center text-sm text-gray-500">
          No hay planes de control. Creá el primero — si lo vinculás a un PFMEA se pre-cargan las características.
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
          {items.map((it) => (
            <div key={it.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
              <button onClick={() => openDetail(it.id)} className="flex-1 text-left">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-gray-400">{it.code}</span>
                  <span className="font-medium text-gray-900 text-sm">{it.name}</span>
                  <span className="text-[10px] font-bold rounded-full px-2 py-0.5 bg-indigo-100 text-indigo-700">{PHASES[it.phase]}</span>
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {it.partNumber || 'Sin pieza'} · {(it.items || []).length} características · {new Date(it.createdAt).toLocaleDateString('es-AR')}
                </div>
              </button>
              <button onClick={() => remove(it.id)} className="p-1.5 text-gray-400 hover:text-red-600">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 space-y-3 shadow-xl">
            <h3 className="font-bold text-gray-900">Nuevo plan de control</h3>
            <input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Nombre"
              value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <select className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={form.phase} onChange={(e) => setForm({ ...form, phase: e.target.value })}>
              {Object.entries(PHASES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Nº de pieza"
              value={form.partNumber} onChange={(e) => setForm({ ...form, partNumber: e.target.value })} />
            <input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Proceso"
              value={form.process} onChange={(e) => setForm({ ...form, process: e.target.value })} />
            <select className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={form.fmeaId} onChange={(e) => setForm({ ...form, fmeaId: e.target.value })}>
              <option value="">Sin FMEA vinculado</option>
              {fmeas.map((f) => <option key={f.id} value={f.id}>{f.code} — {f.name}</option>)}
            </select>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowCreate(false)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm">Cancelar</button>
              <button onClick={create} disabled={!form.name.trim()}
                className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50">
                Crear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
