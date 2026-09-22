'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Layers, Plus, ArrowLeft, Trash2, Loader2, Play, CheckCircle, XCircle, Minus } from 'lucide-react';

const FREQ: Record<string, string> = { DAILY: 'Diaria', WEEKLY: 'Semanal', MONTHLY: 'Mensual' };

export default function LpaPage() {
  const [plans, setPlans] = useState<any[]>([]);
  const [executions, setExecutions] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [executing, setExecuting] = useState<any | null>(null);
  const [responses, setResponses] = useState<any[]>([]);
  const [auditor, setAuditor] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', area: '', frequency: 'WEEKLY', questions: '' });

  const load = async () => {
    setLoading(true);
    try {
      const [p, e] = await Promise.all([
        apiFetch<{ items: any[] }>('/core-tools/lpa/plans'),
        apiFetch<{ items: any[] }>('/core-tools/lpa/executions'),
      ]);
      setPlans(p.items || []);
      setExecutions(e.items || []);
    } catch (e: any) { setError(e?.message || 'Error'); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    try {
      const checklist = form.questions.split('\n').map((q) => q.trim()).filter(Boolean).map((q) => ({ question: q }));
      await apiFetch('/core-tools/lpa/plans', {
        method: 'POST',
        json: { name: form.name, area: form.area || null, frequency: form.frequency, checklist },
      });
      setShowCreate(false);
      setForm({ name: '', area: '', frequency: 'WEEKLY', questions: '' });
      load();
    } catch (e: any) { setError(e?.message || 'Error creando'); }
  };

  const startExecution = (plan: any) => {
    setExecuting(plan);
    setAuditor('');
    setResponses((plan.checklist || []).map((c: any) => ({ question: c.question, result: 'NA', comment: '' })));
  };

  const submitExecution = async () => {
    if (!executing) return;
    try {
      await apiFetch(`/core-tools/lpa/plans/${executing.id}/execute`, {
        method: 'POST',
        json: { auditorName: auditor || null, responses },
      });
      setExecuting(null);
      load();
    } catch (e: any) { setError(e?.message || 'Error registrando'); }
  };

  const remove = async (id: string) => {
    if (!confirm('¿Eliminar este plan LPA?')) return;
    await apiFetch(`/core-tools/lpa/plans/${id}`, { method: 'DELETE' });
    if (selected?.id === id) setSelected(null);
    load();
  };

  // ── Ejecución de auditoría ─────────────────────────────────────────────────
  if (executing) {
    const ok = responses.filter((r) => r.result === 'OK').length;
    const nok = responses.filter((r) => r.result === 'NOK').length;
    return (
      <div className="space-y-4">
        <button onClick={() => setExecuting(null)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800">
          <ArrowLeft className="h-4 w-4" /> Cancelar ejecución
        </button>

        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="text-lg font-bold text-gray-900">Ejecutar: {executing.name}</h2>
          <p className="text-sm text-gray-500">{executing.area || ''} · {FREQ[executing.frequency]}</p>
          <input
            className="mt-3 w-full max-w-sm rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="Nombre del auditor"
            value={auditor} onChange={(e) => setAuditor(e.target.value)}
          />
        </div>

        <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-50">
          {responses.map((r, i) => (
            <div key={i} className="px-4 py-3 space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-gray-700 flex-1">{r.question}</span>
                <div className="flex gap-1">
                  {(['OK', 'NOK', 'NA'] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => { const n = [...responses]; n[i] = { ...n[i], result: v }; setResponses(n); }}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-all ${
                        r.result === v
                          ? v === 'OK' ? 'bg-emerald-600 text-white' : v === 'NOK' ? 'bg-red-600 text-white' : 'bg-gray-500 text-white'
                          : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
              {r.result === 'NOK' && (
                <input
                  className="w-full rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs"
                  placeholder="Comentario del hallazgo…"
                  value={r.comment || ''}
                  onChange={(e) => { const n = [...responses]; n[i] = { ...n[i], comment: e.target.value }; setResponses(n); }}
                />
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3">
          <span className="text-sm text-gray-600">
            <span className="font-bold text-emerald-600">{ok} OK</span> · <span className="font-bold text-red-600">{nok} NOK</span>
          </span>
          <button onClick={submitExecution}
            className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700">
            <Play className="h-4 w-4" /> Registrar ejecución
          </button>
        </div>
      </div>
    );
  }

  // ── Detalle de plan ────────────────────────────────────────────────────────
  if (selected) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={() => setSelected(null)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800">
            <ArrowLeft className="h-4 w-4" /> Volver
          </button>
          <button onClick={() => startExecution(selected)}
            className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700">
            <Play className="h-4 w-4" /> Ejecutar auditoría
          </button>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="text-lg font-bold text-gray-900">{selected.name}</h2>
          <p className="text-sm text-gray-500">{selected.area || ''} · {FREQ[selected.frequency]} · {(selected.checklist || []).length} preguntas</p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="font-semibold text-gray-800 text-sm mb-2">Checklist</h3>
          <ul className="space-y-1">
            {(selected.checklist || []).map((c: any, i: number) => (
              <li key={i} className="text-sm text-gray-600 flex gap-2">
                <span className="text-gray-400 font-mono text-xs mt-0.5">{i + 1}.</span> {c.question}
              </li>
            ))}
          </ul>
        </div>

        {(selected.executions || []).length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="font-semibold text-gray-800 text-sm mb-2">Últimas ejecuciones</h3>
            <div className="space-y-1.5">
              {selected.executions.map((ex: any) => (
                <div key={ex.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{new Date(ex.executedAt).toLocaleDateString('es-AR')} · {ex.auditorName || 'Sin auditor'}</span>
                  <span className={`font-bold ${ex.score >= 90 ? 'text-emerald-600' : ex.score >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
                    {ex.score != null ? `${ex.score}%` : '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Lista ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Layers className="h-5 w-5 text-pink-600" /> LPA — Auditorías por Capas
          </h1>
          <p className="text-sm text-gray-500">Layered Process Audits con checklists y registro de ejecuciones (CQI-8)</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700">
          <Plus className="h-4 w-4" /> Nuevo plan
        </button>
      </div>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
      ) : (
        <>
          <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
            {plans.length === 0 ? (
              <div className="p-10 text-center text-sm text-gray-500">No hay planes LPA. Creá el primero con su checklist.</div>
            ) : plans.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                <button onClick={() => setSelected(p)} className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 text-sm">{p.name}</span>
                    <span className="text-[10px] font-bold rounded-full px-2 py-0.5 bg-pink-100 text-pink-700">{FREQ[p.frequency]}</span>
                    {!p.active && <span className="text-[10px] font-bold rounded-full px-2 py-0.5 bg-gray-100 text-gray-500">Inactivo</span>}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {p.area || 'Sin área'} · {(p.checklist || []).length} preguntas · {(p.executions || []).length} ejecuciones recientes
                  </div>
                </button>
                <div className="flex items-center gap-1">
                  <button onClick={() => startExecution(p)} className="p-1.5 text-gray-400 hover:text-amber-600" title="Ejecutar">
                    <Play className="h-4 w-4" />
                  </button>
                  <button onClick={() => remove(p.id)} className="p-1.5 text-gray-400 hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {executions.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <h3 className="font-semibold text-gray-800 text-sm mb-3">Ejecuciones recientes</h3>
              <div className="space-y-2">
                {executions.slice(0, 10).map((ex) => (
                  <div key={ex.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                    <div className="flex items-center gap-2 text-sm">
                      {ex.score >= 90 ? <CheckCircle className="h-4 w-4 text-emerald-500" />
                        : ex.score >= 70 ? <Minus className="h-4 w-4 text-amber-500" />
                        : <XCircle className="h-4 w-4 text-red-500" />}
                      <span className="text-gray-700">{ex.plan?.name}</span>
                      <span className="text-gray-400 text-xs">· {ex.plan?.area || ''}</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(ex.executedAt).toLocaleDateString('es-AR')} · {ex.auditorName || '—'} ·
                      <span className="font-bold ml-1">{ex.score != null ? `${ex.score}%` : '—'}</span>
                      {(ex.findings || []).length > 0 && <span className="text-red-600 font-bold ml-1">({ex.findings.length} hallazgos)</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 space-y-3 shadow-xl">
            <h3 className="font-bold text-gray-900">Nuevo plan LPA</h3>
            <input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Nombre del plan"
              value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Área / línea"
              value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} />
            <select className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })}>
              {Object.entries(FREQ).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <div>
              <label className="text-[11px] text-gray-500">Preguntas del checklist (una por línea)</label>
              <textarea rows={5} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder={'¿El operario usa EP correcto?\n¿Los parámetros están dentro del rango?\n¿El plan de control está disponible?'}
                value={form.questions} onChange={(e) => setForm({ ...form, questions: e.target.value })} />
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
