'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import {
  AlertTriangle, Plus, ArrowLeft, Sparkles, Trash2, Loader2, Save, ArrowDownWideNarrow,
} from 'lucide-react';

const AP_STYLE: Record<string, string> = {
  ALTA: 'bg-red-100 text-red-800 border-red-300',
  MEDIA: 'bg-amber-100 text-amber-800 border-amber-300',
  BAJA: 'bg-emerald-100 text-emerald-800 border-emerald-300',
};

const EMPTY_ITEM = {
  id: '', step: '', function: '', failureMode: '', effect: '', s: 5,
  cause: '', o: 5, prevention: '', detection: '', d: 5, ap: null,
  actions: '', actionStatus: 'PENDIENTE', s2: null, o2: null, d2: null, ap2: null,
};

export default function FmeaPage() {
  const [items, setItems] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [sortMode, setSortMode] = useState<'none' | 'ap' | 's'>('none');
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', type: 'PFMEA', process: '', product: '', team: '' });
  const [aiStep, setAiStep] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ items: any[] }>('/core-tools/fmea');
      setItems(res.items || []);
    } catch (e: any) { setError(e?.message || 'Error'); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openDetail = async (id: string) => {
    const res = await apiFetch<{ item: any }>(`/core-tools/fmea/${id}`);
    setSelected(res.item);
    setRows(Array.isArray(res.item.items) ? res.item.items : []);
    setSuggestions([]);
  };

  const create = async () => {
    try {
      await apiFetch('/core-tools/fmea', {
        method: 'POST',
        json: { ...form, process: form.process || null, product: form.product || null, team: form.team || null },
      });
      setShowCreate(false);
      setForm({ name: '', type: 'PFMEA', process: '', product: '', team: '' });
      load();
    } catch (e: any) { setError(e?.message || 'Error creando'); }
  };

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await apiFetch<{ item: any }>(`/core-tools/fmea/${selected.id}`, { method: 'PUT', json: { items: rows } });
      setSelected(res.item);
      setRows(res.item.items || []);
      setError('');
    } catch (e: any) { setError(e?.message || 'Error guardando'); } finally { setSaving(false); }
  };

  const aiSuggest = async () => {
    if (!selected) return;
    setAiLoading(true);
    try {
      const res = await apiFetch<{ suggestions: any[] }>(`/core-tools/fmea/${selected.id}/ai-suggest`, {
        method: 'POST', json: { step: aiStep || selected.process || '', function: '' },
      });
      setSuggestions(res.suggestions || []);
    } catch (e: any) { setError(e?.message || 'Error de IA'); } finally { setAiLoading(false); }
  };

  const addRow = (data?: any) => {
    setRows([...rows, { ...EMPTY_ITEM, ...(data || {}), id: `it-${Date.now()}` }]);
    setSuggestions([]);
  };

  const updateRow = (i: number, k: string, v: any) => {
    const next = [...rows];
    next[i] = { ...next[i], [k]: v };
    setRows(next);
  };

  const remove = async (id: string) => {
    if (!confirm('¿Eliminar este FMEA?')) return;
    await apiFetch(`/core-tools/fmea/${id}`, { method: 'DELETE' });
    if (selected?.id === id) setSelected(null);
    load();
  };

  if (selected) {
    const highAp = rows.filter((r) => r.ap === 'ALTA').length;
    const medAp = rows.filter((r) => r.ap === 'MEDIA').length;
    const lowAp = rows.filter((r) => r.ap === 'BAJA').length;
    const optimized = rows.filter((r) => r.ap2 && r.ap2 !== r.ap).length;
    const apRank: Record<string, number> = { ALTA: 0, MEDIA: 1, BAJA: 2 };
    const sortedRows = sortMode === 'ap'
      ? [...rows].sort((a, b) => (apRank[a.ap] ?? 3) - (apRank[b.ap] ?? 3) || (b.s ?? 0) - (a.s ?? 0))
      : sortMode === 's'
        ? [...rows].sort((a, b) => (b.s ?? 0) - (a.s ?? 0))
        : rows;
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={() => setSelected(null)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800">
            <ArrowLeft className="h-4 w-4" /> Volver
          </button>
          <div className="flex items-center gap-2">
            <button onClick={save} disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{selected.code} — {selected.name}</h2>
            <p className="text-sm text-gray-500">{selected.type} · {selected.process || ''} · {selected.product || ''}</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs justify-end">
            <span className="rounded-full bg-gray-100 px-2.5 py-1 font-medium text-gray-600">{rows.length} items</span>
            {highAp > 0 && <span className="rounded-full bg-red-100 px-2.5 py-1 font-bold text-red-700">{highAp} alta</span>}
            {medAp > 0 && <span className="rounded-full bg-amber-100 px-2.5 py-1 font-bold text-amber-700">{medAp} media</span>}
            {lowAp > 0 && <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-bold text-emerald-700">{lowAp} baja</span>}
            {optimized > 0 && <span className="rounded-full bg-blue-100 px-2.5 py-1 font-bold text-blue-700">{optimized} optimizados</span>}
          </div>
        </div>

        {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}

        {/* IA suggest */}
        <div className="rounded-xl border border-violet-200 bg-violet-50 p-3 flex items-end gap-2">
          <div className="flex-1">
            <label className="text-xs font-medium text-violet-800">Paso de proceso para sugerir modos de falla</label>
            <input
              className="mt-1 w-full rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-sm"
              placeholder="Ej: Soldadura por puntos"
              value={aiStep} onChange={(e) => setAiStep(e.target.value)}
            />
          </div>
          <button onClick={aiSuggest} disabled={aiLoading}
            className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50">
            {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Sugerir con IA
          </button>
        </div>

        {suggestions.length > 0 && (
          <div className="rounded-xl border border-violet-200 bg-white p-3 space-y-2">
            <h4 className="text-xs font-bold text-violet-800">Sugerencias IA — tocá para agregar</h4>
            {suggestions.map((s, i) => (
              <button key={i} onClick={() => addRow({ ...s, step: aiStep })}
                className="w-full text-left rounded-lg border border-violet-100 bg-violet-50/50 px-3 py-2 hover:bg-violet-100 transition-colors">
                <div className="text-sm font-medium text-gray-800">{s.failureMode}</div>
                <div className="text-xs text-gray-500">Efecto: {s.effect} · Causa: {s.cause} · S{s.s}/O{s.o}/D{s.d}</div>
              </button>
            ))}
          </div>
        )}

        {/* Tabla de items */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">Análisis de riesgo (S/O/D → AP) + optimización post-acciones (S2/O2/D2 → AP2)</span>
          <button
            onClick={() => setSortMode(sortMode === 'none' ? 'ap' : sortMode === 'ap' ? 's' : 'none')}
            className="flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1 text-[11px] font-medium text-gray-600 hover:bg-gray-50"
          >
            <ArrowDownWideNarrow className="h-3.5 w-3.5" />
            {sortMode === 'none' ? 'Ordenar' : sortMode === 'ap' ? 'Por AP' : 'Por Severidad'}
          </button>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white overflow-x-auto">
          <table className="w-full text-xs min-w-[1400px]">
            <thead>
              <tr className="bg-gray-50 text-left text-gray-500 border-b">
                <th className="px-2 py-2">Paso</th><th className="px-2 py-2">Función</th><th className="px-2 py-2">Modo de falla</th>
                <th className="px-2 py-2">Efecto</th><th className="px-2 py-2 w-12">S</th><th className="px-2 py-2">Causa</th>
                <th className="px-2 py-2 w-12">O</th><th className="px-2 py-2">Prevención</th><th className="px-2 py-2">Detección</th>
                <th className="px-2 py-2 w-12">D</th><th className="px-2 py-2 w-16">AP</th>
                <th className="px-2 py-2 bg-blue-50/60">Acciones</th>
                <th className="px-2 py-2 w-12 bg-blue-50/60">S2</th><th className="px-2 py-2 w-12 bg-blue-50/60">O2</th><th className="px-2 py-2 w-12 bg-blue-50/60">D2</th>
                <th className="px-2 py-2 w-16 bg-blue-50/60">AP2</th><th className="px-2 py-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((r, i) => {
                const ri = rows.indexOf(r);
                return (
                <tr key={r.id || i} className="border-b border-gray-100 align-top">
                  {['step', 'function', 'failureMode', 'effect'].map((k) => (
                    <td key={k} className="px-1 py-1">
                      <textarea rows={2} className="w-full rounded border border-transparent hover:border-gray-200 px-1.5 py-1 text-xs resize-none"
                        value={r[k] || ''} onChange={(e) => updateRow(ri, k, e.target.value)} />
                    </td>
                  ))}
                  <td className="px-1 py-1">
                    <input type="number" min={1} max={10} className="w-12 rounded border border-transparent hover:border-gray-200 px-1.5 py-1 text-xs text-center font-bold"
                      value={r.s ?? ''} onChange={(e) => updateRow(ri, 's', Number(e.target.value))} />
                  </td>
                  <td className="px-1 py-1">
                    <textarea rows={2} className="w-full rounded border border-transparent hover:border-gray-200 px-1.5 py-1 text-xs resize-none"
                      value={r.cause || ''} onChange={(e) => updateRow(ri, 'cause', e.target.value)} />
                  </td>
                  <td className="px-1 py-1">
                    <input type="number" min={1} max={10} className="w-12 rounded border border-transparent hover:border-gray-200 px-1.5 py-1 text-xs text-center font-bold"
                      value={r.o ?? ''} onChange={(e) => updateRow(ri, 'o', Number(e.target.value))} />
                  </td>
                  {['prevention', 'detection'].map((k) => (
                    <td key={k} className="px-1 py-1">
                      <textarea rows={2} className="w-full rounded border border-transparent hover:border-gray-200 px-1.5 py-1 text-xs resize-none"
                        value={r[k] || ''} onChange={(e) => updateRow(ri, k, e.target.value)} />
                    </td>
                  ))}
                  <td className="px-1 py-1">
                    <input type="number" min={1} max={10} className="w-12 rounded border border-transparent hover:border-gray-200 px-1.5 py-1 text-xs text-center font-bold"
                      value={r.d ?? ''} onChange={(e) => updateRow(ri, 'd', Number(e.target.value))} />
                  </td>
                  <td className="px-1 py-1 text-center">
                    {r.ap && <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold ${AP_STYLE[r.ap]}`}>{r.ap}</span>}
                  </td>
                  <td className="px-1 py-1 bg-blue-50/40">
                    <textarea rows={2} className="w-full rounded border border-transparent hover:border-blue-200 px-1.5 py-1 text-xs resize-none bg-transparent"
                      placeholder="Acción de optimización…"
                      value={r.actions || ''} onChange={(e) => updateRow(ri, 'actions', e.target.value)} />
                  </td>
                  {['s2', 'o2', 'd2'].map((k) => (
                    <td key={k} className="px-1 py-1 bg-blue-50/40">
                      <input type="number" min={1} max={10} className="w-12 rounded border border-transparent hover:border-blue-200 px-1.5 py-1 text-xs text-center font-bold bg-transparent"
                        value={r[k] ?? ''} onChange={(e) => updateRow(ri, k, e.target.value ? Number(e.target.value) : null)} />
                    </td>
                  ))}
                  <td className="px-1 py-1 text-center bg-blue-50/40">
                    {r.ap2 && <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold ${AP_STYLE[r.ap2]}`}>{r.ap2}</span>}
                  </td>
                  <td className="px-1 py-1">
                    <button onClick={() => setRows(rows.filter((x) => x !== r))} className="p-1 text-gray-300 hover:text-red-500">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
          <button onClick={() => addRow()}
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
            <AlertTriangle className="h-5 w-5 text-red-600" /> FMEA — Modos de Falla
          </h1>
          <p className="text-sm text-gray-500">DFMEA y PFMEA con metodología AIAG-VDA y Action Priority</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700">
          <Plus className="h-4 w-4" /> Nuevo FMEA
        </button>
      </div>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center text-sm text-gray-500">
          No hay FMEAs. Creá el primero con "Nuevo FMEA".
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
          {items.map((it) => {
            const its = Array.isArray(it.items) ? it.items : [];
            const high = its.filter((x: any) => x.ap === 'ALTA').length;
            return (
              <div key={it.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                <button onClick={() => openDetail(it.id)} className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-gray-400">{it.code}</span>
                    <span className="font-medium text-gray-900 text-sm">{it.name}</span>
                    <span className="text-[10px] font-bold rounded-full px-2 py-0.5 bg-gray-100 text-gray-600">{it.type}</span>
                    {high > 0 && <span className="text-[10px] font-bold rounded-full px-2 py-0.5 bg-red-100 text-red-700">{high} AP alta</span>}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {it.process || 'Sin proceso'} · {its.length} items · {new Date(it.createdAt).toLocaleDateString('es-AR')}
                  </div>
                </button>
                <button onClick={() => remove(it.id)} className="p-1.5 text-gray-400 hover:text-red-600">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 space-y-3 shadow-xl">
            <h3 className="font-bold text-gray-900">Nuevo FMEA</h3>
            <input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Nombre"
              value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <select className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="PFMEA">PFMEA — Proceso</option>
              <option value="DFMEA">DFMEA — Diseño</option>
            </select>
            <input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Proceso"
              value={form.process} onChange={(e) => setForm({ ...form, process: e.target.value })} />
            <input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Producto / pieza"
              value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })} />
            <input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Equipo multidisciplinario"
              value={form.team} onChange={(e) => setForm({ ...form, team: e.target.value })} />
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
