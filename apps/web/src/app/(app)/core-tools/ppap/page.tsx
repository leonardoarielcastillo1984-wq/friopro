'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { PackageCheck, Plus, ArrowLeft, Trash2, Loader2, Send, CheckCircle } from 'lucide-react';

const EL_STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: 'Pendiente', cls: 'bg-gray-100 text-gray-600' },
  READY: { label: 'Listo', cls: 'bg-blue-100 text-blue-700' },
  SUBMITTED: { label: 'Enviado', cls: 'bg-amber-100 text-amber-700' },
  APPROVED: { label: 'Aprobado', cls: 'bg-emerald-100 text-emerald-700' },
};
const SUB_STATUS: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: 'Borrador', cls: 'bg-gray-100 text-gray-600' },
  SUBMITTED: { label: 'Enviado', cls: 'bg-amber-100 text-amber-700' },
  APPROVED: { label: 'Aprobado', cls: 'bg-emerald-100 text-emerald-700' },
  REJECTED: { label: 'Rechazado', cls: 'bg-red-100 text-red-700' },
};

export default function PpapPage() {
  const [items, setItems] = useState<any[]>([]);
  const [apqps, setApqps] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [elements, setElements] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ partNumber: '', partName: '', customer: '', level: 3, apqpId: '' });

  const load = async () => {
    setLoading(true);
    try {
      const [pp, ap] = await Promise.all([
        apiFetch<{ items: any[] }>('/core-tools/ppap'),
        apiFetch<{ items: any[] }>('/core-tools/apqp'),
      ]);
      setItems(pp.items || []);
      setApqps(ap.items || []);
    } catch (e: any) { setError(e?.message || 'Error'); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openDetail = async (id: string) => {
    const res = await apiFetch<{ item: any }>(`/core-tools/ppap/${id}`);
    setSelected(res.item);
    setElements(Array.isArray(res.item.elements) ? res.item.elements : []);
  };

  const create = async () => {
    try {
      await apiFetch('/core-tools/ppap', {
        method: 'POST',
        json: { ...form, partName: form.partName || null, customer: form.customer || null, apqpId: form.apqpId || null },
      });
      setShowCreate(false);
      setForm({ partNumber: '', partName: '', customer: '', level: 3, apqpId: '' });
      load();
    } catch (e: any) { setError(e?.message || 'Error creando'); }
  };

  const setElStatus = async (i: number, status: string) => {
    if (!selected) return;
    const next = elements.map((el, j) => (j === i ? { ...el, status } : el));
    setElements(next);
    const res = await apiFetch<{ item: any }>(`/core-tools/ppap/${selected.id}`, { method: 'PUT', json: { elements: next } });
    setSelected(res.item);
  };

  const setStatus = async (status: string) => {
    if (!selected) return;
    const res = await apiFetch<{ item: any }>(`/core-tools/ppap/${selected.id}`, { method: 'PUT', json: { status } });
    setSelected(res.item);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('¿Eliminar este PPAP?')) return;
    await apiFetch(`/core-tools/ppap/${id}`, { method: 'DELETE' });
    if (selected?.id === id) setSelected(null);
    load();
  };

  if (selected) {
    const done = elements.filter((e) => e.status === 'APPROVED' || e.status === 'READY').length;
    const pct = elements.length ? Math.round((done / elements.length) * 100) : 0;
    const st = SUB_STATUS[selected.status] || SUB_STATUS.DRAFT;
    return (
      <div className="space-y-4">
        <button onClick={() => setSelected(null)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800">
          <ArrowLeft className="h-4 w-4" /> Volver
        </button>

        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">{selected.code} — {selected.partNumber}</h2>
              <p className="text-sm text-gray-500">{selected.partName || ''} · {selected.customer || ''} · Nivel {selected.level}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${st.cls}`}>{st.label}</span>
          </div>
          <div className="mt-3 h-2 rounded-full bg-gray-200 overflow-hidden">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <div className="text-[11px] text-gray-500 mt-1">{done}/{elements.length} elementos listos/aprobados</div>
          {selected.status === 'DRAFT' && (
            <button onClick={() => setStatus('SUBMITTED')}
              className="mt-3 flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700">
              <Send className="h-4 w-4" /> Marcar como enviado al cliente
            </button>
          )}
          {selected.status === 'SUBMITTED' && (
            <div className="mt-3 flex gap-2">
              <button onClick={() => setStatus('APPROVED')}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700">
                <CheckCircle className="h-4 w-4" /> Aprobado por cliente
              </button>
              <button onClick={() => setStatus('REJECTED')}
                className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50">
                Rechazado
              </button>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-50">
          {elements.map((el, i) => (
            <div key={el.n} className="flex items-center gap-3 px-4 py-2.5">
              <span className="w-6 text-center text-xs font-bold text-gray-400">{el.n}</span>
              <span className="flex-1 text-sm text-gray-700">{el.name}</span>
              <div className="flex gap-1">
                {Object.entries(EL_STATUS).map(([k, v]) => (
                  <button
                    key={k}
                    onClick={() => setElStatus(i, k)}
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold transition-all ${
                      el.status === k ? v.cls + ' ring-1 ring-current' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
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
            <PackageCheck className="h-5 w-5 text-amber-600" /> PPAP — Aprobaciones
          </h1>
          <p className="text-sm text-gray-500">Paquetes de aprobación de piezas de producción (18 elementos, niveles 1-5)</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700">
          <Plus className="h-4 w-4" /> Nuevo PPAP
        </button>
      </div>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center text-sm text-gray-500">
          No hay PPAPs. Creá el primero — se generan los 18 elementos automáticamente.
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
          {items.map((it) => {
            const st = SUB_STATUS[it.status] || SUB_STATUS.DRAFT;
            const els = Array.isArray(it.elements) ? it.elements : [];
            const done = els.filter((e: any) => e.status === 'APPROVED' || e.status === 'READY').length;
            return (
              <div key={it.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                <button onClick={() => openDetail(it.id)} className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-gray-400">{it.code}</span>
                    <span className="font-medium text-gray-900 text-sm">{it.partNumber}</span>
                    <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${st.cls}`}>{st.label}</span>
                    <span className="text-[10px] font-medium rounded-full px-2 py-0.5 bg-gray-100 text-gray-500">Nivel {it.level}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {it.partName || ''} · {it.customer || 'Sin cliente'} · {done}/18 elementos
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
            <h3 className="font-bold text-gray-900">Nuevo PPAP</h3>
            <input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Nº de pieza *"
              value={form.partNumber} onChange={(e) => setForm({ ...form, partNumber: e.target.value })} />
            <input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Nombre de la pieza"
              value={form.partName} onChange={(e) => setForm({ ...form, partName: e.target.value })} />
            <input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Cliente"
              value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })} />
            <div>
              <label className="text-[11px] text-gray-500">Nivel de envío</label>
              <select className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={form.level} onChange={(e) => setForm({ ...form, level: Number(e.target.value) })}>
                {[1, 2, 3, 4, 5].map((l) => <option key={l} value={l}>Nivel {l}{l === 3 ? ' (por defecto)' : ''}</option>)}
              </select>
            </div>
            <select className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={form.apqpId} onChange={(e) => setForm({ ...form, apqpId: e.target.value })}>
              <option value="">Sin proyecto APQP vinculado</option>
              {apqps.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
            </select>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowCreate(false)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm">Cancelar</button>
              <button onClick={create} disabled={!form.partNumber.trim()}
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
