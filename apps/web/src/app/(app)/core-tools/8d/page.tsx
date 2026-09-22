'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Wrench, Plus, ArrowLeft, Trash2, Loader2, Save, Sparkles, CheckCircle } from 'lucide-react';

const DISCIPLINES = [
  { key: 'd1', title: 'D1 — Equipo', field: 'team', placeholder: 'Miembros del equipo multidisciplinario…' },
  { key: 'd2', title: 'D2 — Descripción del problema', field: 'description', placeholder: 'Qué, dónde, cuándo, cuánto (5W2H)…' },
  { key: 'd3', title: 'D3 — Acciones de contención', field: 'containment', placeholder: 'Acciones inmediatas para contener el problema…' },
  { key: 'd4', title: 'D4 — Causa raíz', field: 'rootCause', placeholder: 'Causa raíz identificada…', why5: true },
  { key: 'd5', title: 'D5 — Acciones correctivas permanentes', field: 'actions', placeholder: 'Acciones correctivas elegidas…' },
  { key: 'd6', title: 'D6 — Implementación y validación', field: 'validation', placeholder: 'Evidencia de implementación y efectividad…' },
  { key: 'd7', title: 'D7 — Prevención sistémica', field: 'systemic', placeholder: 'Cambios al sistema para evitar recurrencia…' },
  { key: 'd8', title: 'D8 — Reconocimiento', field: 'recognition', placeholder: 'Reconocimiento al equipo y cierre…' },
];

export default function EightDPage() {
  const [items, setItems] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [disc, setDisc] = useState<any>({});
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ items: any[] }>('/core-tools/eight-d');
      setItems(res.items || []);
    } catch (e: any) { setError(e?.message || 'Error'); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openDetail = async (id: string) => {
    const res = await apiFetch<{ item: any }>(`/core-tools/eight-d/${id}`);
    setSelected(res.item);
    setDisc(res.item.disciplines || {});
  };

  const create = async () => {
    try {
      await apiFetch('/core-tools/eight-d', { method: 'POST', json: { title } });
      setShowCreate(false); setTitle('');
      load();
    } catch (e: any) { setError(e?.message || 'Error creando'); }
  };

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await apiFetch<{ item: any }>(`/core-tools/eight-d/${selected.id}`, { method: 'PUT', json: { disciplines: disc } });
      setSelected(res.item); setError('');
    } catch (e: any) { setError(e?.message || 'Error guardando'); } finally { setSaving(false); }
  };

  const aiAnalyze = async () => {
    if (!selected) return;
    setAiLoading(true);
    try {
      await save();
      const res = await apiFetch<{ analysis: string }>(`/core-tools/eight-d/${selected.id}/ai-analyze`, { method: 'POST' });
      setSelected({ ...selected, aiAnalysis: res.analysis });
    } catch (e: any) { setError(e?.message || 'Error de IA'); } finally { setAiLoading(false); }
  };

  const close = async () => {
    if (!selected) return;
    const res = await apiFetch<{ item: any }>(`/core-tools/eight-d/${selected.id}`, { method: 'PUT', json: { status: 'CLOSED' } });
    setSelected(res.item); load();
  };

  const remove = async (id: string) => {
    if (!confirm('¿Eliminar este reporte 8D?')) return;
    await apiFetch(`/core-tools/eight-d/${id}`, { method: 'DELETE' });
    if (selected?.id === id) setSelected(null);
    load();
  };

  const setD = (key: string, field: string, v: any) =>
    setDisc({ ...disc, [key]: { ...(disc[key] || {}), [field]: v } });

  const completed = DISCIPLINES.filter((d) => {
    const v = disc[d.key]?.[d.field];
    return typeof v === 'string' && v.trim().length > 0;
  }).length;

  if (selected) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={() => setSelected(null)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800">
            <ArrowLeft className="h-4 w-4" /> Volver
          </button>
          <div className="flex items-center gap-2">
            <button onClick={aiAnalyze} disabled={aiLoading}
              className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50">
              {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Analizar con IA
            </button>
            <button onClick={save} disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar
            </button>
            {selected.status !== 'CLOSED' && (
              <button onClick={close}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700">
                <CheckCircle className="h-4 w-4" /> Cerrar 8D
              </button>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{selected.code} — {selected.title}</h2>
            <p className="text-sm text-gray-500">Abierto {new Date(selected.openedAt).toLocaleDateString('es-AR')}</p>
          </div>
          <div className="text-right">
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${selected.status === 'CLOSED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
              {selected.status === 'CLOSED' ? 'Cerrado' : 'Abierto'}
            </span>
            <div className="text-[11px] text-gray-500 mt-1">{completed}/8 disciplinas</div>
          </div>
        </div>

        {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}

        {selected.aiAnalysis && (
          <div className="rounded-xl border border-violet-200 bg-violet-50 p-4">
            <h3 className="font-semibold text-violet-900 text-sm mb-2 flex items-center gap-1.5">
              <Sparkles className="h-4 w-4" /> Análisis IA — causa raíz y acciones sugeridas
            </h3>
            <p className="text-sm text-violet-900 whitespace-pre-wrap leading-relaxed">{selected.aiAnalysis}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {DISCIPLINES.map((d) => (
            <div key={d.key} className="rounded-xl border border-gray-200 bg-white p-4 space-y-2">
              <h3 className="font-semibold text-gray-800 text-sm">{d.title}</h3>
              <textarea
                rows={3}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm resize-none"
                placeholder={d.placeholder}
                value={disc[d.key]?.[d.field] || ''}
                onChange={(e) => setD(d.key, d.field, e.target.value)}
              />
              {d.why5 && (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-gray-500">5 Porqués</label>
                  {(disc.d4?.why5 || ['', '', '', '', '']).map((w: string, i: number) => (
                    <input
                      key={i}
                      className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs"
                      placeholder={`¿Por qué ${i + 1}?`}
                      value={w}
                      onChange={(e) => {
                        const why5 = [...(disc.d4?.why5 || ['', '', '', '', ''])];
                        why5[i] = e.target.value;
                        setD('d4', 'why5', why5);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Wrench className="h-5 w-5 text-cyan-600" /> Reportes 8D
          </h1>
          <p className="text-sm text-gray-500">Resolución de problemas en 8 disciplinas con análisis de causa raíz IA</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700">
          <Plus className="h-4 w-4" /> Nuevo 8D
        </button>
      </div>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center text-sm text-gray-500">
          No hay reportes 8D. Creá el primero con "Nuevo 8D".
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
          {items.map((it) => (
            <div key={it.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
              <button onClick={() => openDetail(it.id)} className="flex-1 text-left">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-gray-400">{it.code}</span>
                  <span className="font-medium text-gray-900 text-sm">{it.title}</span>
                  <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${it.status === 'CLOSED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {it.status === 'CLOSED' ? 'Cerrado' : 'Abierto'}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-0.5">{new Date(it.openedAt).toLocaleDateString('es-AR')}</div>
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
            <h3 className="font-bold text-gray-900">Nuevo reporte 8D</h3>
            <input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Título del problema"
              value={title} onChange={(e) => setTitle(e.target.value)} />
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowCreate(false)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm">Cancelar</button>
              <button onClick={create} disabled={!title.trim()}
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
