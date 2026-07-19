'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import {
  Target, LayoutDashboard, CalendarRange, ClipboardList, ListChecks, Ruler,
  Plus, Loader2, Check, AlertTriangle, TrendingUp, Users2, GraduationCap, ChevronRight, Play, X,
} from 'lucide-react';

/* ─────────── Tipos ─────────── */
interface Dash {
  activeCycles: number; pending: number; inProgress: number; hrReview: number; completed: number; overdue: number; total: number;
  avgScore: number | null; completionPct: number; gapsOpen: number; trainingNeeds: number; devActionsOpen: number; feedbackPending: number;
  byStatus: Record<string, number>; byArea: { name: string; avg: number; count: number }[];
  distribution: Record<string, number>; gapsByCompetency: { label: string; avgGap: number; count: number }[];
}

const STATUS_LABEL: Record<string, string> = {
  BORRADOR: 'Borrador', PENDIENTE: 'Pendiente', AUTOEVALUACION: 'Autoevaluación', EVALUACION_RESPONSABLE: 'Evaluación responsable',
  REVISION_RRHH: 'Revisión RRHH', DEVOLUCION: 'Devolución', CERRADA: 'Cerrada', CANCELADA: 'Cancelada', REABIERTA: 'Reabierta',
};
const CYCLE_STATUS: Record<string, string> = {
  BORRADOR: 'bg-gray-100 text-gray-700', PROGRAMADO: 'bg-blue-100 text-blue-700', ACTIVO: 'bg-green-100 text-green-700',
  EN_CURSO: 'bg-indigo-100 text-indigo-700', EN_REVISION: 'bg-amber-100 text-amber-700', CERRADO: 'bg-gray-200 text-gray-600', CANCELADO: 'bg-red-100 text-red-700',
};
const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none';

type Tab = 'dashboard' | 'cycles' | 'evaluations' | 'templates' | 'scales';

export default function DesempenoPage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Target className="w-6 h-6 text-rose-500" /> Evaluación de Desempeño</h1>
          <p className="text-gray-500 text-sm mt-1">Ciclos, evaluaciones por competencias, brechas y planes de desarrollo.</p>
        </div>
        <Link href="/rrhh" className="text-sm text-gray-500 hover:text-gray-700">← Volver a RRHH</Link>
      </div>

      <div className="flex flex-wrap gap-2 mb-6 border-b border-gray-200 pb-3">
        <TabBtn active={tab === 'dashboard'} onClick={() => setTab('dashboard')} icon={LayoutDashboard} label="Dashboard" />
        <TabBtn active={tab === 'cycles'} onClick={() => setTab('cycles')} icon={CalendarRange} label="Ciclos" />
        <TabBtn active={tab === 'evaluations'} onClick={() => setTab('evaluations')} icon={ListChecks} label="Evaluaciones" />
        <TabBtn active={tab === 'templates'} onClick={() => setTab('templates')} icon={ClipboardList} label="Modelos" />
        <TabBtn active={tab === 'scales'} onClick={() => setTab('scales')} icon={Ruler} label="Escalas" />
      </div>

      {tab === 'dashboard' && <DashboardTab />}
      {tab === 'cycles' && <CyclesTab />}
      {tab === 'evaluations' && <EvaluationsTab />}
      {tab === 'templates' && <TemplatesTab />}
      {tab === 'scales' && <ScalesTab />}
    </div>
  );
}

function TabBtn({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: any; label: string }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${active ? 'bg-rose-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'}`}>
      <Icon className="w-4 h-4" /> {label}
    </button>
  );
}

/* ─────────── Dashboard ─────────── */
function DashboardTab() {
  const [d, setD] = useState<Dash | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { (async () => { try { setD(await apiFetch<Dash>('/performance/dashboard')); } catch { setD(null); } finally { setLoading(false); } })(); }, []);
  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  if (!d) return <Empty title="Sin datos" msg="Aún no hay información de desempeño. Creá un ciclo para empezar." />;

  const cards = [
    { label: 'Ciclos activos', value: d.activeCycles, icon: CalendarRange, color: 'text-indigo-600 bg-indigo-50' },
    { label: 'Pendientes', value: d.pending, icon: ClipboardList, color: 'text-blue-600 bg-blue-50' },
    { label: 'En curso', value: d.inProgress, icon: Loader2, color: 'text-amber-600 bg-amber-50' },
    { label: 'Vencidas', value: d.overdue, icon: AlertTriangle, color: 'text-red-600 bg-red-50' },
    { label: 'Revisión RRHH', value: d.hrReview, icon: Users2, color: 'text-purple-600 bg-purple-50' },
    { label: 'Completadas', value: d.completed, icon: Check, color: 'text-green-600 bg-green-50' },
    { label: 'Devoluciones', value: d.feedbackPending, icon: ChevronRight, color: 'text-teal-600 bg-teal-50' },
    { label: 'Resultado promedio', value: d.avgScore != null ? d.avgScore.toFixed(2) : '—', icon: TrendingUp, color: 'text-rose-600 bg-rose-50' },
    { label: 'Cumplimiento ciclo', value: `${d.completionPct}%`, icon: Check, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Brechas detectadas', value: d.gapsOpen, icon: AlertTriangle, color: 'text-orange-600 bg-orange-50' },
    { label: 'Neces. capacitación', value: d.trainingNeeds, icon: GraduationCap, color: 'text-cyan-600 bg-cyan-50' },
    { label: 'Acciones desarrollo', value: d.devActionsOpen, icon: ListChecks, color: 'text-fuchsia-600 bg-fuchsia-50' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2 ${c.color}`}><c.icon className="w-5 h-5" /></div>
            <div className="text-2xl font-bold text-gray-900">{c.value}</div>
            <div className="text-xs text-gray-500">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Desempeño promedio por área">
          {d.byArea.length === 0 ? <Muted /> : d.byArea.map((a) => (
            <BarRow key={a.name} label={a.name} value={a.avg} max={5} suffix={`${a.avg.toFixed(2)} · ${a.count}`} />
          ))}
        </Panel>
        <Panel title="Distribución de resultados">
          {Object.keys(d.distribution).length === 0 ? <Muted /> : Object.entries(d.distribution).map(([k, v]) => (
            <BarRow key={k} label={k} value={v} max={Math.max(...Object.values(d.distribution))} suffix={String(v)} color="bg-indigo-500" />
          ))}
        </Panel>
        <Panel title="Principales brechas por competencia">
          {d.gapsByCompetency.length === 0 ? <Muted /> : d.gapsByCompetency.map((g) => (
            <BarRow key={g.label} label={g.label} value={g.count} max={Math.max(...d.gapsByCompetency.map((x) => x.count))} suffix={`${g.count} · brecha ${g.avgGap.toFixed(1)}`} color="bg-orange-500" />
          ))}
        </Panel>
        <Panel title="Estado de las evaluaciones">
          {Object.keys(d.byStatus).length === 0 ? <Muted /> : Object.entries(d.byStatus).map(([k, v]) => (
            <BarRow key={k} label={STATUS_LABEL[k] || k} value={v} max={Math.max(...Object.values(d.byStatus))} suffix={String(v)} color="bg-teal-500" />
          ))}
        </Panel>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: any }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-800 mb-3">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
function Muted() { return <p className="text-xs text-gray-400 py-2">Sin datos suficientes.</p>; }
function BarRow({ label, value, max, suffix, color = 'bg-rose-500' }: { label: string; value: number; max: number; suffix?: string; color?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-600 mb-0.5"><span className="truncate">{label}</span><span className="text-gray-500">{suffix}</span></div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden"><div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} /></div>
    </div>
  );
}
function Empty({ title, msg }: { title: string; msg: string }) {
  return <div className="bg-white border border-gray-200 rounded-xl p-10 text-center"><Target className="w-10 h-10 text-gray-300 mx-auto mb-3" /><h3 className="font-semibold text-gray-800">{title}</h3><p className="text-sm text-gray-500 mt-1">{msg}</p></div>;
}

/* ─────────── Ciclos ─────────── */
function CyclesTab() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(async () => { setLoading(true); try { const r = await apiFetch<{ items: any[] }>('/performance/cycles'); setItems(r?.items ?? []); } catch { setItems([]); } finally { setLoading(false); } }, []);
  useEffect(() => { load(); }, [load]);

  const generate = async (id: string) => {
    setBusy(id);
    try { const r = await apiFetch<{ created: number; scoped: number }>(`/performance/cycles/${id}/generate`, { method: 'POST', json: {} }); await apiFetch(`/performance/cycles/${id}/activate`, { method: 'POST', json: {} }); alert(`Se generaron ${r.created} evaluaciones (${r.scoped} empleados en alcance).`); load(); }
    catch (e: any) { alert(e?.message || 'Error al generar'); } finally { setBusy(null); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 text-sm bg-rose-600 hover:bg-rose-700 text-white rounded-lg"><Plus className="w-4 h-4" /> Nuevo ciclo</button></div>
      {loading ? <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
        : items.length === 0 ? <Empty title="Sin ciclos" msg="Creá tu primer ciclo de evaluación (Anual, Semestral, Período de prueba, etc.)." />
        : <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr><th className="px-4 py-2 text-left">Ciclo</th><th className="px-4 py-2 text-left">Tipo</th><th className="px-4 py-2 text-left">Período</th><th className="px-4 py-2 text-left">Estado</th><th className="px-4 py-2 text-left">Evaluaciones</th><th className="px-4 py-2"></th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-800">{c.name}</td>
                    <td className="px-4 py-2 text-gray-600">{c.type}</td>
                    <td className="px-4 py-2 text-gray-600">{c.periodLabel || (c.startDate ? new Date(c.startDate).toLocaleDateString('es-AR') : '—')}</td>
                    <td className="px-4 py-2"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CYCLE_STATUS[c.status] || 'bg-gray-100 text-gray-600'}`}>{c.status}</span></td>
                    <td className="px-4 py-2 text-gray-600">{c.evaluationsClosed}/{c.evaluationsTotal}</td>
                    <td className="px-4 py-2 text-right">
                      <button disabled={busy === c.id} onClick={() => generate(c.id)} className="inline-flex items-center gap-1 text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-50 text-gray-700">{busy === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />} Generar/activar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>}
      {showForm && <CycleForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function CycleForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<any>({ name: '', type: 'ANUAL', periodLabel: '', startDate: '', endDate: '', requiresSelfEvaluation: true, requiresManagerEvaluation: true, requiresHrReview: true, allow360: false });
  const [templates, setTemplates] = useState<any[]>([]);
  const [depts, setDepts] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => {
    (async () => {
      try { const r = await apiFetch<{ items: any[] }>('/performance/templates?active=true'); setTemplates(r?.items ?? []); } catch { /* noop */ }
      try { const r = await apiFetch<any>('/hr/employees'); const set = new Map<string, string>(); (r?.employees || []).forEach((e: any) => { if (e.department) set.set(e.department.id, e.department.name); }); setDepts([...set.entries()].map(([id, name]) => ({ id, name }))); } catch { /* noop */ }
    })();
  }, []);
  const submit = async () => {
    setErr(''); if (!f.name) { setErr('Ingresá un nombre.'); return; }
    setSaving(true);
    try {
      await apiFetch('/performance/cycles', { method: 'POST', json: {
        name: f.name, type: f.type, periodLabel: f.periodLabel || undefined, startDate: f.startDate || undefined, endDate: f.endDate || undefined,
        templateId: f.templateId || undefined, scopeDepartmentIds: f.scopeDepartmentIds || [],
        requiresSelfEvaluation: f.requiresSelfEvaluation, requiresManagerEvaluation: f.requiresManagerEvaluation, requiresHrReview: f.requiresHrReview, allow360: f.allow360,
      } });
      onSaved();
    } catch (e: any) { setErr(e?.message || 'Error al guardar'); } finally { setSaving(false); }
  };
  return (
    <Modal title="Nuevo ciclo de evaluación" onClose={onClose}>
      <div className="space-y-3">
        {err && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{err}</div>}
        <Field label="Nombre *"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={inputCls} placeholder="Evaluación Anual 2026" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipo"><select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} className={inputCls}>{['ANUAL', 'SEMESTRAL', 'PERIODO_PRUEBA', 'EXTRAORDINARIA', 'CAMBIO_PUESTO', 'SEGUIMIENTO'].map((t) => <option key={t} value={t}>{t}</option>)}</select></Field>
          <Field label="Período"><input value={f.periodLabel} onChange={(e) => setF({ ...f, periodLabel: e.target.value })} className={inputCls} placeholder="2026" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Inicio"><input type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} className={inputCls} /></Field>
          <Field label="Cierre"><input type="date" value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} className={inputCls} /></Field>
        </div>
        <Field label="Modelo de evaluación"><select value={f.templateId || ''} onChange={(e) => setF({ ...f, templateId: e.target.value })} className={inputCls}><option value="">Seleccionar…</option>{templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
        <Field label="Áreas alcanzadas (opcional)">
          <select multiple value={f.scopeDepartmentIds || []} onChange={(e) => setF({ ...f, scopeDepartmentIds: Array.from(e.target.selectedOptions).map((o) => o.value) })} className={`${inputCls} h-24`}>{depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
        </Field>
        <div className="flex flex-wrap gap-3 text-sm text-gray-700">
          <label className="flex items-center gap-2"><input type="checkbox" checked={f.requiresSelfEvaluation} onChange={(e) => setF({ ...f, requiresSelfEvaluation: e.target.checked })} /> Autoevaluación</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={f.requiresManagerEvaluation} onChange={(e) => setF({ ...f, requiresManagerEvaluation: e.target.checked })} /> Evaluación responsable</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={f.requiresHrReview} onChange={(e) => setF({ ...f, requiresHrReview: e.target.checked })} /> Revisión RRHH</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={f.allow360} onChange={(e) => setF({ ...f, allow360: e.target.checked })} /> Permite 360°</label>
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
        <button onClick={submit} disabled={saving} className="px-4 py-2 text-sm bg-rose-600 hover:bg-rose-700 text-white rounded-lg flex items-center gap-2">{saving && <Loader2 className="w-4 h-4 animate-spin" />} Crear ciclo</button>
      </div>
    </Modal>
  );
}

/* ─────────── Evaluaciones ─────────── */
function EvaluationsTab() {
  const [items, setItems] = useState<any[]>([]);
  const [cycles, setCycles] = useState<any[]>([]);
  const [cycleId, setCycleId] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try { const qs = new URLSearchParams(); if (cycleId) qs.set('cycleId', cycleId); if (status) qs.set('status', status); const r = await apiFetch<{ items: any[] }>(`/performance/evaluations?${qs.toString()}`); setItems(r?.items ?? []); } catch { setItems([]); } finally { setLoading(false); }
  }, [cycleId, status]);
  useEffect(() => { (async () => { try { const r = await apiFetch<{ items: any[] }>('/performance/cycles'); setCycles(r?.items ?? []); } catch { /* noop */ } })(); }, []);
  useEffect(() => { load(); }, [load]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <select value={cycleId} onChange={(e) => setCycleId(e.target.value)} className={`${inputCls} max-w-xs`}><option value="">Todos los ciclos</option>{cycles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${inputCls} max-w-xs`}><option value="">Todos los estados</option>{Object.keys(STATUS_LABEL).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select>
      </div>
      {loading ? <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
        : items.length === 0 ? <Empty title="Sin evaluaciones" msg="Generá evaluaciones desde un ciclo para verlas acá." />
        : <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr><th className="px-4 py-2 text-left">Empleado</th><th className="px-4 py-2 text-left">Puesto</th><th className="px-4 py-2 text-left">Ciclo</th><th className="px-4 py-2 text-left">Estado</th><th className="px-4 py-2 text-left">Resultado</th><th className="px-4 py-2 text-left">Avance</th><th className="px-4 py-2"></th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-800">{e.employeeName}</td>
                    <td className="px-4 py-2 text-gray-600">{e.position || '—'}</td>
                    <td className="px-4 py-2 text-gray-600">{e.cycle?.name}</td>
                    <td className="px-4 py-2"><span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700">{STATUS_LABEL[e.status] || e.status}</span></td>
                    <td className="px-4 py-2 text-gray-700">{e.finalScore != null ? `${e.finalScore.toFixed(2)} · ${e.classification || ''}` : '—'}</td>
                    <td className="px-4 py-2 text-gray-500">{e.progressPct ?? 0}%</td>
                    <td className="px-4 py-2 text-right"><Link href={`/rrhh/desempeno/evaluacion/${e.id}`} className="text-rose-600 hover:underline text-xs font-medium">Abrir →</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>}
    </div>
  );
}

/* ─────────── Modelos / Plantillas ─────────── */
function TemplatesTab() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { setLoading(true); try { const r = await apiFetch<{ items: any[] }>('/performance/templates'); setItems(r?.items ?? []); } catch { setItems([]); } finally { setLoading(false); } }, []);
  useEffect(() => { load(); }, [load]);
  const seed = async () => { setBusy(true); try { await apiFetch('/performance/templates/seed-defaults', { method: 'POST', json: {} }); load(); } catch (e: any) { alert(e?.message || 'Error'); } finally { setBusy(false); } };
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><button onClick={seed} disabled={busy} className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 hover:bg-gray-50 rounded-lg text-gray-700">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Sembrar modelos base</button></div>
      {loading ? <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
        : items.length === 0 ? <Empty title="Sin modelos" msg="Sembrá los modelos base (Operativo, Responsable de proceso) o creá los tuyos." />
        : <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {items.map((t) => (
              <div key={t.id} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between"><h3 className="font-semibold text-gray-800">{t.name}</h3><span className={`text-xs px-2 py-0.5 rounded-full ${t.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{t.active ? 'Activo' : 'Inactivo'}</span></div>
                <p className="text-xs text-gray-500 mt-1">{t.type} · {t.criteria?.length || 0} criterios · pond. {(t.criteria || []).reduce((s: number, c: any) => s + (c.weight || 0), 0)}%</p>
                <div className="mt-2 flex flex-wrap gap-1">{(t.criteria || []).slice(0, 8).map((c: any) => <span key={c.id} className="text-[11px] bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5 text-gray-600">{c.name} ({c.weight}%)</span>)}</div>
              </div>
            ))}
          </div>}
    </div>
  );
}

/* ─────────── Escalas ─────────── */
function ScalesTab() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { setLoading(true); try { const r = await apiFetch<{ items: any[] }>('/performance/scales'); setItems(r?.items ?? []); } catch { setItems([]); } finally { setLoading(false); } }, []);
  useEffect(() => { load(); }, [load]);
  const seed = async () => { setBusy(true); try { await apiFetch('/performance/scales/seed-defaults', { method: 'POST', json: {} }); load(); } catch (e: any) { alert(e?.message || 'Error'); } finally { setBusy(false); } };
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><button onClick={seed} disabled={busy} className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 hover:bg-gray-50 rounded-lg text-gray-700">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Sembrar escala estándar</button></div>
      {loading ? <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
        : items.length === 0 ? <Empty title="Sin escalas" msg="Sembrá la escala estándar 1-5 para empezar." />
        : items.map((s) => (
            <div key={s.id} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between"><h3 className="font-semibold text-gray-800">{s.name}</h3>{s.isDefault && <span className="text-xs px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">Por defecto</span>}</div>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-5 gap-2">
                {(s.levels || []).map((l: any) => (
                  <div key={l.id} className={`rounded-lg border p-2 text-center ${l.isGap ? 'border-orange-200 bg-orange-50' : 'border-gray-200 bg-gray-50'}`}>
                    <div className="text-lg font-bold text-gray-800">{l.value}</div>
                    <div className="text-[11px] text-gray-600">{l.name}</div>
                    {l.isGap && <div className="text-[10px] text-orange-600 mt-0.5">brecha</div>}
                  </div>
                ))}
              </div>
            </div>
          ))}
    </div>
  );
}

/* ─────────── UI compartida ─────────── */
function Field({ label, children }: { label: string; children: any }) {
  return <div><label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>{children}</div>;
}
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: any }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 sticky top-0 bg-white"><h3 className="font-semibold text-gray-800">{title}</h3><button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button></div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
