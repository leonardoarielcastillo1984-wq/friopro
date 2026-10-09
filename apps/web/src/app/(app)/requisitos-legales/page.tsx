'use client';

import { Fragment, useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import DocCodeBadge from '@/components/DocCodeBadge';
import { Scale, Plus, Trash2, X, CheckCircle2, AlertTriangle, ClipboardCheck } from 'lucide-react';
import PageTitleHelp from '@/components/ui/PageTitleHelp';

// ISO 9001/14001/45001 §6.1.3 — registro de requisitos legales
// ISO 14001/45001 §9.1.2 — evaluación periódica del cumplimiento

type Requirement = {
  id: string; framework: string; source: string; title: string; description?: string;
  appliesTo?: string; lastEvaluationDate?: string; lastEvaluationResult?: string;
  nextEvaluationDate?: string; evaluationFrequency: string; evidence?: string;
  isActive: boolean; evaluations?: Evaluation[];
};
type Evaluation = {
  id: string; evaluationDate: string; result: string; findings?: string;
  correctiveRequired: boolean; evaluatedBy?: string; evidence?: string;
};

const FRAMEWORKS: Record<string, { label: string; cls: string }> = {
  ENVIRONMENTAL: { label: 'Ambiental (14001)', cls: 'bg-emerald-100 text-emerald-700' },
  OHAS: { label: 'SST (45001)', cls: 'bg-orange-100 text-orange-700' },
  QUALITY: { label: 'Calidad (9001/IATF)', cls: 'bg-blue-100 text-blue-700' },
  OTHER: { label: 'Otro', cls: 'bg-gray-100 text-gray-600' },
};
const EVAL_RESULTS: Record<string, { label: string; cls: string }> = {
  COMPLIANT: { label: 'Cumple', cls: 'bg-emerald-100 text-emerald-700' },
  PARTIAL: { label: 'Cumple parcial', cls: 'bg-amber-100 text-amber-700' },
  NON_COMPLIANT: { label: 'No cumple', cls: 'bg-red-100 text-red-700' },
};
const FREQ: Record<string, string> = { MONTHLY: 'Mensual', QUARTERLY: 'Trimestral', BIANNUAL: 'Semestral', YEARLY: 'Anual' };

const inputCls = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('es-AR') : '—';
const isOverdue = (d?: string) => d && new Date(d) < new Date();

const emptyForm = {
  framework: 'ENVIRONMENTAL', source: '', title: '', description: '', appliesTo: '',
  evaluationFrequency: 'YEARLY', nextEvaluationDate: '', evidence: '',
};
const emptyEval = { result: 'COMPLIANT', findings: '', correctiveRequired: false, evaluatedBy: '', evidence: '', evaluationDate: new Date().toISOString().split('T')[0] };

export default function RequisitosLegalesPage() {
  const [items, setItems] = useState<Requirement[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Requirement | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [evalTarget, setEvalTarget] = useState<Requirement | null>(null);
  const [evalForm, setEvalForm] = useState(emptyEval);
  const [history, setHistory] = useState<Record<string, Evaluation[]>>({});

  const load = useCallback(async () => {
    try {
      const q = filter ? `?framework=${filter}` : '';
      const [r, s] = await Promise.all([
        apiFetch<{ items: Requirement[] }>(`/legal-requirements${q}`),
        apiFetch<any>('/legal-requirements/summary'),
      ]);
      setItems(r?.items || []);
      setSummary(s);
    } finally { setLoading(false); }
  }, [filter]);
  useEffect(() => { setLoading(true); load(); }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    try {
      const body = { ...form, nextEvaluationDate: form.nextEvaluationDate || null };
      if (editItem) {
        await apiFetch(`/legal-requirements/${editItem.id}`, { method: 'PATCH', json: body });
      } else {
        await apiFetch('/legal-requirements', { method: 'POST', json: body });
      }
      setShowModal(false); setEditItem(null); setForm(emptyForm);
      await load();
    } finally { setSaving(false); }
  }

  async function saveEval(e: React.FormEvent) {
    e.preventDefault(); if (!evalTarget) return; setSaving(true);
    try {
      await apiFetch(`/legal-requirements/${evalTarget.id}/evaluations`, { method: 'POST', json: evalForm });
      setEvalTarget(null); setEvalForm(emptyEval);
      await load();
    } finally { setSaving(false); }
  }

  async function remove(id: string) {
    if (!confirm('¿Dar de baja el requisito?')) return;
    await apiFetch(`/legal-requirements/${id}`, { method: 'DELETE' });
    await load();
  }

  async function toggleHistory(id: string) {
    if (history[id]) { setHistory({ ...history, [id]: undefined as any }); return; }
    const r = await apiFetch<Requirement>(`/legal-requirements/${id}`);
    setHistory({ ...history, [id]: r?.evaluations || [] });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-blue-100 p-3 border border-blue-200"><Scale className="h-6 w-6 text-blue-600" /></div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Requisitos Legales <PageTitleHelp moduleHref="/requisitos-legales" /></h1>
            <p className="mt-1 text-sm text-gray-500">Registro de requisitos legales y evaluación del cumplimiento — ISO 14001/45001 §6.1.3 y §9.1.2</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <DocCodeBadge outputKey="cumplimiento.requisitos-legales" title="Requisitos Legales" module="cumplimiento" subModule="requisitos-legales" outputType="LIST" />
          <button onClick={() => { setEditItem(null); setForm(emptyForm); setShowModal(true); }}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            <Plus className="h-4 w-4" /> Nuevo requisito
          </button>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Object.entries(FRAMEWORKS).map(([k, f]) => {
            const s = summary.byFramework?.[k];
            return (
              <div key={k} className="rounded-xl border border-gray-200 bg-white p-4">
                <p className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${f.cls}`}>{f.label}</p>
                <p className="mt-2 text-2xl font-bold text-gray-900">{s?.total ?? 0}</p>
                <p className="text-xs text-gray-500">
                  {s ? `${s.compliant} cumple · ${s.nonCompliant} incumple · ${s.notEvaluated} sin evaluar` : 'Sin registros'}
                </p>
              </div>
            );
          })}
        </div>
      )}
      {summary?.pendingEval > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <p className="text-sm text-amber-800"><strong>{summary.pendingEval}</strong> requisito(s) con evaluación de cumplimiento vencida o próxima.</p>
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={() => setFilter('')} className={`rounded-lg px-3 py-1.5 text-sm ${!filter ? 'bg-blue-600 text-white' : 'border border-gray-200 bg-white text-gray-600'}`}>Todos</button>
        {Object.entries(FRAMEWORKS).map(([k, f]) => (
          <button key={k} onClick={() => setFilter(k)} className={`rounded-lg px-3 py-1.5 text-sm ${filter === k ? 'bg-blue-600 text-white' : 'border border-gray-200 bg-white text-gray-600'}`}>{f.label}</button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {loading ? <p className="p-8 text-center text-sm text-gray-500">Cargando…</p> : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Norma / requisito</th><th className="px-4 py-3">Framework</th><th className="px-4 py-3">Aplica a</th>
                <th className="px-4 py-3">Última eval.</th><th className="px-4 py-3">Resultado</th><th className="px-4 py-3">Próxima</th><th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">Sin requisitos registrados — agregá leyes, decretos, resoluciones o compromisos contractuales.</td></tr>}
              {items.map(r => (
                <Fragment key={r.id}>
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{r.source}</div>
                      <div className="text-xs text-gray-500 line-clamp-1">{r.title}</div>
                    </td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${FRAMEWORKS[r.framework]?.cls || 'bg-gray-100'}`}>{FRAMEWORKS[r.framework]?.label || r.framework}</span></td>
                    <td className="px-4 py-3 text-xs">{r.appliesTo || '—'}</td>
                    <td className="px-4 py-3 text-xs">{fmtDate(r.lastEvaluationDate)}</td>
                    <td className="px-4 py-3">
                      {r.lastEvaluationResult
                        ? <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${EVAL_RESULTS[r.lastEvaluationResult]?.cls}`}>{EVAL_RESULTS[r.lastEvaluationResult]?.label}</span>
                        : <span className="text-xs text-gray-400">Sin evaluar</span>}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {r.nextEvaluationDate
                        ? <span className={isOverdue(r.nextEvaluationDate) ? 'font-medium text-red-600' : ''}>{fmtDate(r.nextEvaluationDate)}{isOverdue(r.nextEvaluationDate) && ' ⚠'}</span>
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => { setEvalTarget(r); setEvalForm(emptyEval); }} title="Registrar evaluación" className="rounded p-1.5 text-emerald-600 hover:bg-emerald-50"><CheckCircle2 className="h-4 w-4" /></button>
                        <button onClick={() => toggleHistory(r.id)} title="Historial" className="rounded p-1.5 text-gray-500 hover:bg-gray-100"><ClipboardCheck className="h-4 w-4" /></button>
                        <button onClick={() => { setEditItem(r); setForm({ framework: r.framework, source: r.source, title: r.title, description: r.description || '', appliesTo: r.appliesTo || '', evaluationFrequency: r.evaluationFrequency, nextEvaluationDate: r.nextEvaluationDate?.split('T')[0] || '', evidence: r.evidence || '' }); setShowModal(true); }} className="rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50">Editar</button>
                        <button onClick={() => remove(r.id)} className="rounded p-1 text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                  {history[r.id] && (
                    <tr key={r.id + '-hist'} className="bg-gray-50">
                      <td colSpan={7} className="px-6 py-3">
                        <p className="mb-2 text-xs font-semibold uppercase text-gray-500">Historial de evaluaciones ({history[r.id].length})</p>
                        {history[r.id].length === 0 && <p className="text-xs text-gray-400">Sin evaluaciones registradas.</p>}
                        <ul className="space-y-1">
                          {history[r.id].map(ev => (
                            <li key={ev.id} className="flex items-center gap-3 text-xs">
                              <span className="text-gray-500">{fmtDate(ev.evaluationDate)}</span>
                              <span className={`rounded-full px-2 py-0.5 font-medium ${EVAL_RESULTS[ev.result]?.cls}`}>{EVAL_RESULTS[ev.result]?.label}</span>
                              {ev.evaluatedBy && <span className="text-gray-500">por {ev.evaluatedBy}</span>}
                              {ev.findings && <span className="text-gray-600">{ev.findings}</span>}
                              {ev.correctiveRequired && <span className="font-medium text-red-600">requiere corrección</span>}
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal crear/editar requisito */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form onSubmit={save} className="w-full max-w-2xl rounded-xl bg-white max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900">{editItem ? 'Editar' : 'Nuevo'} requisito legal</h3>
              <button type="button" onClick={() => setShowModal(false)}><X className="h-5 w-5 text-gray-500" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3 p-4">
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Framework *</label>
                <select className={inputCls} value={form.framework} onChange={e => setForm({ ...form, framework: e.target.value })}>
                  {Object.entries(FRAMEWORKS).map(([k, f]) => <option key={k} value={k}>{f.label}</option>)}
                </select></div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Norma / fuente *</label><input required className={inputCls} value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} placeholder="Ley 24.051, Decreto 351/79, contrato..." /></div>
              <div className="col-span-2"><label className="mb-1 block text-sm font-medium text-gray-700">Requisito *</label><input required className={inputCls} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Registro de generadores de residuos peligrosos..." /></div>
              <div className="col-span-2"><label className="mb-1 block text-sm font-medium text-gray-700">Descripción</label><textarea rows={2} className={inputCls} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Aplica a</label><input className={inputCls} value={form.appliesTo} onChange={e => setForm({ ...form, appliesTo: e.target.value })} placeholder="Proceso / actividad / planta" /></div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Frecuencia de evaluación</label>
                <select className={inputCls} value={form.evaluationFrequency} onChange={e => setForm({ ...form, evaluationFrequency: e.target.value })}>
                  {Object.entries(FREQ).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select></div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Próxima evaluación</label><input type="date" className={inputCls} value={form.nextEvaluationDate} onChange={e => setForm({ ...form, nextEvaluationDate: e.target.value })} /></div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Evidencia / referencia</label><input className={inputCls} value={form.evidence} onChange={e => setForm({ ...form, evidence: e.target.value })} placeholder="URL, nº de expediente, certificado..." /></div>
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-200 p-4">
              <button type="button" onClick={() => setShowModal(false)} className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100">Cancelar</button>
              <button disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar'}</button>
            </div>
          </form>
        </div>
      )}

      {/* Modal evaluación de cumplimiento 9.1.2 */}
      {evalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form onSubmit={saveEval} className="w-full max-w-lg rounded-xl bg-white">
            <div className="flex items-center justify-between border-b border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900">Evaluar cumplimiento</h3>
              <button type="button" onClick={() => setEvalTarget(null)}><X className="h-5 w-5 text-gray-500" /></button>
            </div>
            <div className="space-y-3 p-4">
              <p className="text-sm text-gray-600"><strong>{evalTarget.source}</strong> — {evalTarget.title}</p>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="mb-1 block text-sm font-medium text-gray-700">Fecha</label><input type="date" className={inputCls} value={evalForm.evaluationDate} onChange={e => setEvalForm({ ...evalForm, evaluationDate: e.target.value })} /></div>
                <div><label className="mb-1 block text-sm font-medium text-gray-700">Resultado *</label>
                  <select className={inputCls} value={evalForm.result} onChange={e => setEvalForm({ ...evalForm, result: e.target.value })}>
                    {Object.entries(EVAL_RESULTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select></div>
              </div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Hallazgos / observaciones</label><textarea rows={2} className={inputCls} value={evalForm.findings} onChange={e => setEvalForm({ ...evalForm, findings: e.target.value })} /></div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Evaluado por</label><input className={inputCls} value={evalForm.evaluatedBy} onChange={e => setEvalForm({ ...evalForm, evaluatedBy: e.target.value })} /></div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Evidencia</label><input className={inputCls} value={evalForm.evidence} onChange={e => setEvalForm({ ...evalForm, evidence: e.target.value })} /></div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={evalForm.correctiveRequired} onChange={e => setEvalForm({ ...evalForm, correctiveRequired: e.target.checked })} className="rounded border-gray-300" />
                Requiere acción correctiva
              </label>
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-200 p-4">
              <button type="button" onClick={() => setEvalTarget(null)} className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100">Cancelar</button>
              <button disabled={saving} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700 disabled:opacity-50">{saving ? 'Guardando…' : 'Registrar evaluación'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
