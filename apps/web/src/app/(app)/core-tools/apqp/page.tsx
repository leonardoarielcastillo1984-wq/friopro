'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { FolderKanban, Plus, ArrowLeft, Trash2, Loader2, CheckCircle, Circle, ChevronRight, CalendarClock, User } from 'lucide-react';

const PHASE_COLORS = ['bg-blue-500', 'bg-violet-500', 'bg-amber-500', 'bg-emerald-500', 'bg-pink-500'];

export default function ApqpPage() {
  const [items, setItems] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [phases, setPhases] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', customer: '', partNumber: '', startDate: '', dueDate: '' });

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ items: any[] }>('/core-tools/apqp');
      setItems(res.items || []);
    } catch (e: any) { setError(e?.message || 'Error'); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openDetail = async (id: string) => {
    const res = await apiFetch<{ item: any }>(`/core-tools/apqp/${id}`);
    setSelected(res.item);
    setPhases(Array.isArray(res.item.phases) ? res.item.phases : []);
  };

  const create = async () => {
    try {
      await apiFetch('/core-tools/apqp', {
        method: 'POST',
        json: { ...form, customer: form.customer || null, partNumber: form.partNumber || null, startDate: form.startDate || null, dueDate: form.dueDate || null },
      });
      setShowCreate(false);
      setForm({ name: '', customer: '', partNumber: '', startDate: '', dueDate: '' });
      load();
    } catch (e: any) { setError(e?.message || 'Error creando'); }
  };

  const toggleDeliverable = async (pi: number, di: number) => {
    if (!selected) return;
    const next = phases.map((p, i) => i !== pi ? p : {
      ...p,
      deliverables: p.deliverables.map((d: any, j: number) =>
        j !== di ? d : { ...d, status: d.status === 'DONE' ? 'PENDING' : 'DONE' }),
    });
    setPhases(next);
    const res = await apiFetch<{ item: any }>(`/core-tools/apqp/${selected.id}`, { method: 'PUT', json: { phases: next } });
    setSelected(res.item);
  };

  const updateDeliverable = async (pi: number, di: number, k: string, v: any) => {
    if (!selected) return;
    const next = phases.map((p, i) => i !== pi ? p : {
      ...p,
      deliverables: p.deliverables.map((d: any, j: number) => j !== di ? d : { ...d, [k]: v }),
    });
    setPhases(next);
    await apiFetch<{ item: any }>(`/core-tools/apqp/${selected.id}`, { method: 'PUT', json: { phases: next } });
  };

  const setPhase = async (phase: number) => {
    if (!selected) return;
    const res = await apiFetch<{ item: any }>(`/core-tools/apqp/${selected.id}`, { method: 'PUT', json: { currentPhase: phase } });
    setSelected(res.item);
  };

  const remove = async (id: string) => {
    if (!confirm('¿Eliminar este proyecto APQP?')) return;
    await apiFetch(`/core-tools/apqp/${id}`, { method: 'DELETE' });
    if (selected?.id === id) setSelected(null);
    load();
  };

  const phaseProgress = (p: any) => {
    const d = p.deliverables || [];
    return d.length ? Math.round((d.filter((x: any) => x.status === 'DONE').length / d.length) * 100) : 0;
  };

  if (selected) {
    const totalD = phases.reduce((s, p) => s + (p.deliverables?.length || 0), 0);
    const doneD = phases.reduce((s, p) => s + (p.deliverables || []).filter((d: any) => d.status === 'DONE').length, 0);
    const overall = totalD ? Math.round((doneD / totalD) * 100) : 0;
    const today = new Date().toISOString().slice(0, 10);
    const isOverdue = (d: any) => d.dueDate && d.dueDate < today && d.status !== 'DONE';
    const overdueCount = phases.reduce((s, p) => s + (p.deliverables || []).filter(isOverdue).length, 0);
    // Timeline: todos los entregables con fecha, ordenados
    const timeline = phases.flatMap((p) => (p.deliverables || []).map((d: any) => ({ ...d, phase: p.phase, phaseName: p.name })))
      .filter((d) => d.dueDate)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    return (
      <div className="space-y-4">
        <button onClick={() => setSelected(null)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800">
          <ArrowLeft className="h-4 w-4" /> Volver
        </button>

        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">{selected.code} — {selected.name}</h2>
              <p className="text-sm text-gray-500">{selected.customer || ''} · {selected.partNumber || ''}</p>
            </div>
            <div className="flex items-center gap-2">
              {overdueCount > 0 && (
                <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700">{overdueCount} vencidos</span>
              )}
              <span className="text-sm font-bold text-gray-700">{overall}% completado</span>
            </div>
          </div>
          <div className="mt-2 h-2 rounded-full bg-gray-200 overflow-hidden">
            <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${overall}%` }} />
          </div>
          {/* Stepper de fases */}
          <div className="flex items-center gap-1 mt-4">
            {phases.map((p, i) => (
              <div key={p.phase} className="flex items-center flex-1">
                <button
                  onClick={() => setPhase(p.phase)}
                  className={`flex-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-center transition-colors ${
                    selected.currentPhase === p.phase ? 'bg-amber-600 text-white' : phaseProgress(p) === 100 ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  F{p.phase}
                </button>
                {i < phases.length - 1 && <ChevronRight className="h-3.5 w-3.5 text-gray-300 shrink-0" />}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {phases.map((p, pi) => (
            <div key={p.phase} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-100">
                <div className={`w-7 h-7 rounded-lg ${PHASE_COLORS[pi]} flex items-center justify-center text-white text-xs font-bold`}>
                  {p.phase}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-800 text-sm">{p.name}</h3>
                </div>
                <span className="text-xs font-medium text-gray-500">{phaseProgress(p)}%</span>
              </div>
              <div className="divide-y divide-gray-50">
                {(p.deliverables || []).map((d: any, di: number) => (
                  <div key={di} className={`flex items-center gap-2.5 px-4 py-2 ${isOverdue(d) ? 'bg-red-50/60' : ''}`}>
                    <button onClick={() => toggleDeliverable(pi, di)} className="shrink-0">
                      {d.status === 'DONE'
                        ? <CheckCircle className="h-4 w-4 text-emerald-500" />
                        : <Circle className={`h-4 w-4 ${isOverdue(d) ? 'text-red-400' : 'text-gray-300'}`} />}
                    </button>
                    <span className={`flex-1 text-sm ${d.status === 'DONE' ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{d.name}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <User className="h-3 w-3 text-gray-300" />
                      <input
                        className="w-24 rounded border border-transparent hover:border-gray-200 px-1.5 py-0.5 text-[11px] bg-transparent"
                        placeholder="Responsable"
                        defaultValue={d.responsible || ''}
                        onBlur={(e) => e.target.value !== (d.responsible || '') && updateDeliverable(pi, di, 'responsible', e.target.value)}
                      />
                      <CalendarClock className={`h-3 w-3 ${isOverdue(d) ? 'text-red-400' : 'text-gray-300'}`} />
                      <input
                        type="date"
                        className={`rounded border px-1.5 py-0.5 text-[11px] bg-transparent ${isOverdue(d) ? 'border-red-300 text-red-700 font-bold' : 'border-transparent hover:border-gray-200'}`}
                        defaultValue={d.dueDate || ''}
                        onBlur={(e) => e.target.value !== (d.dueDate || '') && updateDeliverable(pi, di, 'dueDate', e.target.value || null)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Timeline de entregables con fecha */}
        {timeline.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="font-semibold text-gray-800 text-sm mb-3 flex items-center gap-1.5">
              <CalendarClock className="h-4 w-4 text-gray-400" /> Timeline de entregables
            </h3>
            <div className="relative pl-5 space-y-2 before:absolute before:left-1.5 before:top-1 before:bottom-1 before:w-px before:bg-gray-200">
              {timeline.map((d, i) => (
                <div key={i} className="relative flex items-center gap-3 text-xs">
                  <span className={`absolute -left-[17px] w-3 h-3 rounded-full border-2 border-white ${
                    d.status === 'DONE' ? 'bg-emerald-500' : isOverdue(d) ? 'bg-red-500' : 'bg-amber-400'
                  }`} />
                  <span className={`font-mono font-bold ${isOverdue(d) ? 'text-red-600' : 'text-gray-500'}`}>{d.dueDate}</span>
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-500">F{d.phase}</span>
                  <span className={d.status === 'DONE' ? 'text-gray-400 line-through' : 'text-gray-700'}>{d.name}</span>
                  {d.responsible && <span className="text-gray-400">· {d.responsible}</span>}
                  {isOverdue(d) && <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-bold text-red-700">VENCIDO</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <FolderKanban className="h-5 w-5 text-violet-600" /> APQP — Proyectos
          </h1>
          <p className="text-sm text-gray-500">Planificación avanzada de calidad en 5 fases (AIAG APQP-2)</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700">
          <Plus className="h-4 w-4" /> Nuevo proyecto
        </button>
      </div>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center text-sm text-gray-500">
          No hay proyectos APQP. Creá el primero — se generan las 5 fases con sus entregables.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {items.map((it) => {
            const ph = Array.isArray(it.phases) ? it.phases : [];
            const tot = ph.reduce((s: number, p: any) => s + (p.deliverables?.length || 0), 0);
            const done = ph.reduce((s: number, p: any) => s + (p.deliverables || []).filter((d: any) => d.status === 'DONE').length, 0);
            const pct = tot ? Math.round((done / tot) * 100) : 0;
            return (
              <div key={it.id} className="rounded-xl border border-gray-200 bg-white p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between">
                  <button onClick={() => openDetail(it.id)} className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-gray-400">{it.code}</span>
                      <span className="font-medium text-gray-900 text-sm">{it.name}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">{it.customer || 'Sin cliente'} · Fase {it.currentPhase}/5</div>
                  </button>
                  <button onClick={() => remove(it.id)} className="p-1.5 text-gray-400 hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-3 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full bg-amber-500" style={{ width: `${pct}%` }} />
                </div>
                <div className="text-[11px] text-gray-500 mt-1">{done}/{tot} entregables · {pct}%</div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 space-y-3 shadow-xl">
            <h3 className="font-bold text-gray-900">Nuevo proyecto APQP</h3>
            <input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Nombre del proyecto"
              value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Cliente"
              value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })} />
            <input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Nº de pieza"
              value={form.partNumber} onChange={(e) => setForm({ ...form, partNumber: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-gray-500">Inicio</label>
                <input type="date" className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                  value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              </div>
              <div>
                <label className="text-[11px] text-gray-500">Entrega</label>
                <input type="date" className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                  value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
              </div>
            </div>
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
