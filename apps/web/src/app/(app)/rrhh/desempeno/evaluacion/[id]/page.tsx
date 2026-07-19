'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import {
  Loader2, ArrowLeft, User, Check, AlertTriangle, Sparkles, GraduationCap,
  ClipboardList, Layers, BookOpen, TrendingUp, MessageSquare, History, ListChecks, Save,
} from 'lucide-react';

const STATUS_LABEL: Record<string, string> = {
  BORRADOR: 'Borrador', PENDIENTE: 'Pendiente', AUTOEVALUACION: 'Autoevaluación', EVALUACION_RESPONSABLE: 'Evaluación responsable',
  REVISION_RRHH: 'Revisión RRHH', DEVOLUCION: 'Devolución', CERRADA: 'Cerrada', CANCELADA: 'Cancelada', REABIERTA: 'Reabierta',
};
const NEXT_ACTIONS: Record<string, { to: string; label: string }[]> = {
  PENDIENTE: [{ to: 'AUTOEVALUACION', label: 'Iniciar autoevaluación' }, { to: 'EVALUACION_RESPONSABLE', label: 'Evaluar como responsable' }],
  AUTOEVALUACION: [{ to: 'EVALUACION_RESPONSABLE', label: 'Pasar a evaluación responsable' }],
  EVALUACION_RESPONSABLE: [{ to: 'REVISION_RRHH', label: 'Enviar a revisión RRHH' }, { to: 'DEVOLUCION', label: 'Pasar a devolución' }, { to: 'CERRADA', label: 'Cerrar' }],
  REVISION_RRHH: [{ to: 'DEVOLUCION', label: 'Pasar a devolución' }, { to: 'CERRADA', label: 'Cerrar' }, { to: 'EVALUACION_RESPONSABLE', label: 'Devolver al responsable' }],
  DEVOLUCION: [{ to: 'CERRADA', label: 'Cerrar' }],
  REABIERTA: [{ to: 'EVALUACION_RESPONSABLE', label: 'Reanudar evaluación' }],
};
const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none';
type Tab = 'resumen' | 'evaluacion' | 'competencias' | 'polivalencia' | 'capacitaciones' | 'objetivos' | 'brechas' | 'plan' | 'devolucion' | 'historial';

export default function EvaluacionDetailPage() {
  const params = useParams();
  const id = String(params?.id || '');
  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('resumen');
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await apiFetch<{ item: any }>(`/performance/evaluations/${id}`); setItem(r?.item ?? null); } catch { setItem(null); } finally { setLoading(false); }
  }, [id]);
  useEffect(() => { if (id) load(); }, [id, load]);

  const transition = async (to: string) => {
    if (to === 'CERRADA' && !confirm('¿Cerrar la evaluación? No podrá editarse sin reapertura.')) return;
    try { await apiFetch(`/performance/evaluations/${id}/transition`, { method: 'POST', json: { to } }); setMsg('Estado actualizado.'); load(); }
    catch (e: any) { alert(e?.message || 'Error'); }
  };

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  if (!item) return <div className="p-6"><p className="text-gray-500">Evaluación no encontrada.</p><Link href="/rrhh/desempeno" className="text-rose-600 text-sm">← Volver</Link></div>;

  const emp = item.context?.employee || {};
  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'resumen', label: 'Resumen', icon: User },
    { id: 'evaluacion', label: 'Evaluación', icon: ClipboardList },
    { id: 'competencias', label: 'Competencias', icon: Layers },
    { id: 'polivalencia', label: 'Polivalencia', icon: Layers },
    { id: 'capacitaciones', label: 'Capacitaciones', icon: GraduationCap },
    { id: 'objetivos', label: 'Objetivos y evidencias', icon: BookOpen },
    { id: 'brechas', label: 'Brechas', icon: AlertTriangle },
    { id: 'plan', label: 'Plan de desarrollo', icon: ListChecks },
    { id: 'devolucion', label: 'Devolución', icon: MessageSquare },
    { id: 'historial', label: 'Historial', icon: History },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <Link href="/rrhh/desempeno" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3"><ArrowLeft className="w-4 h-4" /> Volver</Link>

      {/* Cabecera ejecutiva del empleado */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="w-16 h-16 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 text-xl font-bold overflow-hidden">
            {emp.profilePhoto ? <img src={emp.profilePhoto} alt="" className="w-full h-full object-cover" /> : (emp.name || '?').slice(0, 1)}
          </div>
          <div className="flex-1 min-w-[200px]">
            <h1 className="text-xl font-bold text-gray-900">{emp.name}</h1>
            <p className="text-sm text-gray-500">Legajo {emp.legajo || '—'} · {emp.position || 'Sin puesto'} · {emp.department || 'Sin área'}</p>
            <p className="text-xs text-gray-400 mt-0.5">Responsable: {emp.supervisor || '—'} · Ingreso: {emp.hireDate ? new Date(emp.hireDate).toLocaleDateString('es-AR') : '—'}{emp.antiguedadMeses != null ? ` · ${Math.floor(emp.antiguedadMeses / 12)}a ${emp.antiguedadMeses % 12}m` : ''}{emp.location ? ` · ${emp.location}` : ''}</p>
          </div>
          <div className="text-right">
            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">{STATUS_LABEL[item.status] || item.status}</span>
            <div className="mt-2 text-2xl font-bold text-gray-900">{item.finalScore != null ? item.finalScore.toFixed(2) : '—'}</div>
            <div className="text-xs text-gray-500">{item.classification || 'Sin resultado'}</div>
          </div>
        </div>
        {item.context?.availabilityWarning && (
          <div className="mt-3 text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> {item.context.availabilityWarning}</div>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {(NEXT_ACTIONS[item.status] || []).map((a) => (
            <button key={a.to} onClick={() => transition(a.to)} className="text-xs px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white">{a.label}</button>
          ))}
          {item.status === 'CERRADA' && <ReopenButton id={id} onDone={load} />}
        </div>
        {msg && <p className="text-xs text-green-600 mt-2">{msg}</p>}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${tab === t.id ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}><t.icon className="w-3.5 h-3.5" /> {t.label}</button>
        ))}
      </div>

      {tab === 'resumen' && <ResumenTab item={item} />}
      {tab === 'evaluacion' && <EvaluacionTab item={item} onReload={load} />}
      {tab === 'competencias' && <MatrixTab matrix={item.context?.competencyMatrix} title="Competencias del puesto" />}
      {tab === 'polivalencia' && <MatrixTab matrix={item.context?.competencyMatrix} title="Matriz de polivalencia (competencias por función)" polyvalence />}
      {tab === 'capacitaciones' && <TrainingsTab context={item.context} />}
      {tab === 'objetivos' && <ObjectivesTab context={item.context} />}
      {tab === 'brechas' && <GapsTab item={item} onReload={load} />}
      {tab === 'plan' && <PlanTab item={item} onReload={load} />}
      {tab === 'devolucion' && <FeedbackTab item={item} onReload={load} />}
      {tab === 'historial' && <HistoryTab item={item} />}
    </div>
  );
}

function ReopenButton({ id, onDone }: { id: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const reopen = async () => { if (!reason.trim()) return; try { await apiFetch(`/performance/evaluations/${id}/reopen`, { method: 'POST', json: { reason } }); setOpen(false); onDone(); } catch (e: any) { alert(e?.message || 'Error'); } };
  if (!open) return <button onClick={() => setOpen(true)} className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">Reabrir</button>;
  return (
    <div className="flex items-center gap-2">
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo de reapertura (obligatorio)" className="text-xs border border-gray-300 rounded px-2 py-1 w-64" />
      <button onClick={reopen} className="text-xs px-2 py-1 rounded bg-rose-600 text-white">Confirmar</button>
    </div>
  );
}

/* ─────────── Resumen + IA ─────────── */
function ResumenTab({ item }: { item: any }) {
  const [ai, setAi] = useState<string>(item.aiAnalysis?.text || '');
  const [loading, setLoading] = useState(false);
  const runAi = async () => { setLoading(true); try { const r = await apiFetch<{ analysis: string }>(`/performance/evaluations/${item.id}/ai-analyze`, { method: 'POST', json: {} }); setAi(r?.analysis || ''); } catch (e: any) { alert(e?.message || 'Error'); } finally { setLoading(false); } };
  const scores = [
    { label: 'Autoevaluación', value: item.selfScore }, { label: 'Responsable', value: item.managerScore }, { label: 'Resultado final', value: item.finalScore },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {scores.map((s) => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4 text-center"><div className="text-2xl font-bold text-gray-900">{s.value != null ? s.value.toFixed(2) : '—'}</div><div className="text-xs text-gray-500">{s.label}</div></div>
        ))}
      </div>
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3"><h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2"><Sparkles className="w-4 h-4 text-rose-500" /> Análisis con IA</h3><button onClick={runAi} disabled={loading} className="text-xs px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1">{loading && <Loader2 className="w-3 h-3 animate-spin" />} Analizar</button></div>
        {ai ? <><div className="text-sm text-gray-700 whitespace-pre-wrap">{ai}</div><p className="text-[11px] text-gray-400 mt-2">Sugerencia generada por IA — requiere revisión humana.</p></> : <p className="text-xs text-gray-400">Ejecutá el análisis para obtener un resumen asistido (no define la calificación).</p>}
      </div>
    </div>
  );
}

/* ─────────── Evaluación por criterios ─────────── */
function EvaluacionTab({ item, onReload }: { item: any; onReload: () => void }) {
  const criteria = item.template?.criteria || [];
  const levels = item.scale?.levels || [];
  const respByRole = (cid: string, role: string) => (item.responses || []).find((r: any) => r.criterionId === cid && r.role === role);
  const [scores, setScores] = useState<Record<string, { score: string; comment: string }>>(() => {
    const init: any = {}; for (const c of criteria) { const r = respByRole(c.id, 'MANAGER'); init[c.id] = { score: r?.score != null ? String(r.score) : '', comment: r?.comment || '' }; } return init;
  });
  const [saving, setSaving] = useState(false);
  const readOnly = ['CERRADA', 'CANCELADA'].includes(item.status);
  const save = async () => {
    setSaving(true);
    try {
      const responses = criteria.map((c: any) => ({ criterionId: c.id, score: scores[c.id]?.score ? Number(scores[c.id].score) : null, comment: scores[c.id]?.comment || null }));
      await apiFetch(`/performance/evaluations/${item.id}/responses`, { method: 'PATCH', json: { role: 'MANAGER', responses } });
      onReload();
    } catch (e: any) { alert(e?.message || 'Error'); } finally { setSaving(false); }
  };
  if (!criteria.length) return <div className="bg-white border border-gray-200 rounded-xl p-6 text-sm text-gray-500">Esta evaluación no tiene un modelo con criterios asignado.</div>;
  return (
    <div className="space-y-3">
      <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
        {criteria.map((c: any) => {
          const selfScore = respByRole(c.id, 'SELF')?.score;
          const mgr = scores[c.id]?.score ? Number(scores[c.id].score) : null;
          const diff = selfScore != null && mgr != null ? mgr - selfScore : null;
          return (
            <div key={c.id} className="p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-[200px]"><p className="text-sm font-medium text-gray-800">{c.name} <span className="text-xs text-gray-400">({c.weight}% · {c.category || 'General'})</span></p>{c.description && <p className="text-xs text-gray-500">{c.description}</p>}</div>
                <div className="flex items-center gap-2">
                  {selfScore != null && <span className="text-xs text-gray-500">Auto: <b>{selfScore}</b></span>}
                  <select disabled={readOnly} value={scores[c.id]?.score || ''} onChange={(e) => setScores({ ...scores, [c.id]: { ...scores[c.id], score: e.target.value } })} className="border border-gray-300 rounded-lg px-2 py-1 text-sm">
                    <option value="">—</option>
                    {levels.map((l: any) => <option key={l.value} value={l.value}>{l.value} · {l.name}</option>)}
                  </select>
                </div>
              </div>
              {diff != null && Math.abs(diff) >= 2 && <p className="text-[11px] text-amber-600 mt-1">Diferencia relevante de percepción ({diff > 0 ? '+' : ''}{diff}).</p>}
              <input disabled={readOnly} value={scores[c.id]?.comment || ''} onChange={(e) => setScores({ ...scores, [c.id]: { ...scores[c.id], comment: e.target.value } })} placeholder="Comentario (opcional)" className="mt-2 w-full border border-gray-200 rounded px-2 py-1 text-xs" />
            </div>
          );
        })}
      </div>
      {!readOnly && <div className="flex justify-end"><button onClick={save} disabled={saving} className="flex items-center gap-2 px-4 py-2 text-sm bg-rose-600 hover:bg-rose-700 text-white rounded-lg">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar evaluación</button></div>}
    </div>
  );
}

/* ─────────── Matriz de competencias / polivalencia ─────────── */
function MatrixTab({ matrix, title, polyvalence }: { matrix: any; title: string; polyvalence?: boolean }) {
  const items = matrix?.items || [];
  if (!items.length) return <div className="bg-white border border-gray-200 rounded-xl p-6 text-sm text-gray-500">El puesto no tiene competencias definidas. Cargalas en el módulo de Competencias.</div>;
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-4 py-2 text-xs text-gray-500 bg-gray-50">{title} — {polyvalence ? 'niveles de habilitación por función.' : 'requerido por puesto vs actual del empleado.'} La modificación formal se realiza en el módulo de Competencias.</div>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr><th className="px-4 py-2 text-left">Competencia / función</th><th className="px-4 py-2 text-left">Categoría</th><th className="px-4 py-2 text-center">Requerido</th><th className="px-4 py-2 text-center">Actual</th><th className="px-4 py-2 text-center">Brecha</th></tr></thead>
        <tbody className="divide-y divide-gray-100">
          {items.map((c: any) => (
            <tr key={c.competencyId} className={c.gap > 0 ? 'bg-orange-50/40' : ''}>
              <td className="px-4 py-2 font-medium text-gray-800">{c.name}</td>
              <td className="px-4 py-2 text-gray-500">{c.category || '—'}</td>
              <td className="px-4 py-2 text-center text-gray-700">{c.requiredLevel}</td>
              <td className="px-4 py-2 text-center text-gray-700">{c.currentLevel}</td>
              <td className="px-4 py-2 text-center">{c.gap > 0 ? <span className="text-orange-600 font-semibold">-{c.gap}</span> : <Check className="w-4 h-4 text-green-500 inline" />}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─────────── Capacitaciones ─────────── */
function TrainingsTab({ context }: { context: any }) {
  const trainings = context?.trainings || [];
  const s = context?.trainingSummary || {};
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <StatMini label="Total" value={s.total || 0} /><StatMini label="Completadas" value={s.completed || 0} /><StatMini label="Pendientes" value={s.pending || 0} />
      </div>
      {trainings.length === 0 ? <div className="bg-white border border-gray-200 rounded-xl p-6 text-sm text-gray-500">Sin capacitaciones registradas para este empleado.</div>
        : <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {trainings.map((t: any, i: number) => (
              <div key={i} className="p-3 flex items-center justify-between text-sm"><span className="text-gray-800">{t.title}</span><span className="text-xs text-gray-500">{t.status}{t.completedDate ? ` · ${new Date(t.completedDate).toLocaleDateString('es-AR')}` : ''}</span></div>
            ))}
          </div>}
    </div>
  );
}

/* ─────────── Objetivos y evidencias ─────────── */
function ObjectivesTab({ context }: { context: any }) {
  const objectives = context?.objectives || [];
  return (
    <div className="space-y-3">
      <div className="bg-white border border-gray-200 rounded-xl p-4 text-xs text-gray-500">Evidencias SGI360: información objetiva de otros módulos. Los objetivos son evidencia contextual y no definen la calificación automáticamente.</div>
      {objectives.length === 0 ? <div className="bg-white border border-gray-200 rounded-xl p-6 text-sm text-gray-500">Sin objetivos vinculados al puesto del empleado en el período.</div>
        : <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {objectives.map((o: any) => (
              <div key={o.id} className="p-3">
                <div className="flex items-center justify-between text-sm"><span className="font-medium text-gray-800">{o.code} · {o.title}</span><span className="text-xs text-gray-500">{o.status} · {o.progress}%</span></div>
                <p className="text-xs text-gray-500">Meta: {o.target} · Año {o.year}</p>
              </div>
            ))}
          </div>}
    </div>
  );
}

/* ─────────── Brechas ─────────── */
function GapsTab({ item, onReload }: { item: any; onReload: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const recompute = async () => { setBusy('recompute'); try { await apiFetch(`/performance/evaluations/${item.id}/gaps/recompute`, { method: 'POST', json: {} }); onReload(); } catch (e: any) { alert(e?.message || 'Error'); } finally { setBusy(null); } };
  const createNeed = async (gapId: string) => { setBusy(gapId); try { await apiFetch(`/performance/evaluations/${item.id}/gaps/${gapId}/training-need`, { method: 'POST', json: {} }); alert('Necesidad de capacitación creada en el circuito de Capacitaciones.'); onReload(); } catch (e: any) { alert(e?.message || 'Error'); } finally { setBusy(null); } };
  const gaps = item.gaps || [];
  return (
    <div className="space-y-3">
      <div className="flex justify-end"><button onClick={recompute} disabled={busy === 'recompute'} className="flex items-center gap-2 px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700">{busy === 'recompute' ? <Loader2 className="w-3 h-3 animate-spin" /> : <TrendingUp className="w-3.5 h-3.5" />} Recalcular brechas de competencia</button></div>
      {gaps.length === 0 ? <div className="bg-white border border-gray-200 rounded-xl p-6 text-sm text-gray-500">No hay brechas detectadas. Recalculá desde la matriz de competencias.</div>
        : <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {gaps.map((g: any) => (
              <div key={g.id} className="p-3 flex items-center justify-between gap-3 flex-wrap">
                <div><p className="text-sm font-medium text-gray-800">{g.label || 'Brecha'} {g.gapValue ? <span className="text-orange-600">(-{g.gapValue})</span> : ''}</p><p className="text-xs text-gray-500">{g.description || ''} · {g.source} · {g.status}</p></div>
                {g.linkedTrainingNeedId ? <span className="text-xs text-green-600 flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Necesidad creada</span>
                  : <button onClick={() => createNeed(g.id)} disabled={busy === g.id} className="text-xs px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white flex items-center gap-1">{busy === g.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <GraduationCap className="w-3.5 h-3.5" />} Crear necesidad de capacitación</button>}
              </div>
            ))}
          </div>}
    </div>
  );
}

/* ─────────── Plan de desarrollo ─────────── */
const ACTION_TYPES = ['CAPACITACION', 'ENTRENAMIENTO_EN_PUESTO', 'ENTRENAMIENTO_CRUZADO', 'MENTORIA', 'PARTICIPACION_EN_CAPA', 'PARTICIPACION_EN_PROYECTO', 'REEVALUACION_COMPETENCIA', 'REEVALUACION_POLIVALENCIA', 'OBJETIVO_INDIVIDUAL', 'OTRA'];
function PlanTab({ item, onReload }: { item: any; onReload: () => void }) {
  const plan = item.plan;
  const [type, setType] = useState('CAPACITACION');
  const [desc, setDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const add = async () => { if (!desc.trim()) return; setSaving(true); try { await apiFetch(`/performance/evaluations/${item.id}/plan/actions`, { method: 'POST', json: { type, description: desc } }); setDesc(''); onReload(); } catch (e: any) { alert(e?.message || 'Error'); } finally { setSaving(false); } };
  const setStatus = async (actionId: string, status: string) => { try { await apiFetch(`/performance/plan/actions/${actionId}`, { method: 'PATCH', json: { status } }); onReload(); } catch (e: any) { alert(e?.message || 'Error'); } };
  const actions = plan?.actions || [];
  return (
    <div className="space-y-3">
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-gray-800 mb-2">Plan Individual de Desarrollo</h3>
        <div className="flex gap-2 flex-wrap">
          <select value={type} onChange={(e) => setType(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-2 text-sm">{ACTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select>
          <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Descripción de la acción" className="flex-1 min-w-[200px] border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          <button onClick={add} disabled={saving} className="px-4 py-2 text-sm bg-rose-600 hover:bg-rose-700 text-white rounded-lg flex items-center gap-2">{saving && <Loader2 className="w-4 h-4 animate-spin" />} Agregar</button>
        </div>
      </div>
      {actions.length === 0 ? <div className="bg-white border border-gray-200 rounded-xl p-6 text-sm text-gray-500">Sin acciones de desarrollo. Agregá acciones o generá necesidades desde Brechas.</div>
        : <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {actions.map((a: any) => (
              <div key={a.id} className="p-3 flex items-center justify-between gap-3 flex-wrap">
                <div><p className="text-sm font-medium text-gray-800">{a.type}{a.linkedEntityType ? <span className="text-[11px] text-cyan-600"> · {a.linkedEntityType}</span> : ''}</p><p className="text-xs text-gray-500">{a.description}</p></div>
                <select value={a.status} onChange={(e) => setStatus(a.id, e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-xs">{['PENDIENTE', 'EN_CURSO', 'COMPLETADA', 'CANCELADA'].map((s) => <option key={s} value={s}>{s}</option>)}</select>
              </div>
            ))}
          </div>}
    </div>
  );
}

/* ─────────── Devolución ─────────── */
function FeedbackTab({ item, onReload }: { item: any; onReload: () => void }) {
  const [f, setF] = useState<any>({ summary: '', agreements: '', commitments: '', nextFollowUp: '' });
  const [saving, setSaving] = useState(false);
  const save = async () => { setSaving(true); try { await apiFetch(`/performance/evaluations/${item.id}/feedback`, { method: 'POST', json: { summary: f.summary, agreements: f.agreements, commitments: f.commitments, nextFollowUp: f.nextFollowUp || undefined } }); setF({ summary: '', agreements: '', commitments: '', nextFollowUp: '' }); onReload(); } catch (e: any) { alert(e?.message || 'Error'); } finally { setSaving(false); } };
  const feedbacks = item.feedbacks || [];
  return (
    <div className="space-y-3">
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
        <h3 className="text-sm font-semibold text-gray-800">Registrar devolución</h3>
        <textarea value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} rows={2} placeholder="Resumen de la entrevista" className={inputCls} />
        <div className="grid grid-cols-2 gap-2">
          <textarea value={f.agreements} onChange={(e) => setF({ ...f, agreements: e.target.value })} rows={2} placeholder="Acuerdos" className={inputCls} />
          <textarea value={f.commitments} onChange={(e) => setF({ ...f, commitments: e.target.value })} rows={2} placeholder="Compromisos" className={inputCls} />
        </div>
        <div className="flex items-center gap-2"><label className="text-xs text-gray-500">Próximo seguimiento</label><input type="date" value={f.nextFollowUp} onChange={(e) => setF({ ...f, nextFollowUp: e.target.value })} className="border border-gray-300 rounded-lg px-2 py-1 text-sm" /></div>
        <div className="flex justify-end"><button onClick={save} disabled={saving} className="px-4 py-2 text-sm bg-rose-600 hover:bg-rose-700 text-white rounded-lg flex items-center gap-2">{saving && <Loader2 className="w-4 h-4 animate-spin" />} Guardar devolución</button></div>
      </div>
      {feedbacks.map((fb: any) => (
        <div key={fb.id} className="bg-white border border-gray-200 rounded-xl p-4 text-sm">
          <p className="text-xs text-gray-400">{fb.date ? new Date(fb.date).toLocaleDateString('es-AR') : ''} {fb.acknowledgementStatus ? `· Recepción: ${fb.acknowledgementStatus}` : '· Pendiente de confirmación'}</p>
          <p className="text-gray-800 mt-1">{fb.summary}</p>
          {fb.agreements && <p className="text-gray-600 text-xs mt-1"><b>Acuerdos:</b> {fb.agreements}</p>}
          {fb.commitments && <p className="text-gray-600 text-xs"><b>Compromisos:</b> {fb.commitments}</p>}
        </div>
      ))}
    </div>
  );
}

/* ─────────── Historial ─────────── */
function HistoryTab({ item }: { item: any }) {
  const h = item.histories || [];
  if (!h.length) return <div className="bg-white border border-gray-200 rounded-xl p-6 text-sm text-gray-500">Sin historial.</div>;
  return (
    <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
      {h.map((x: any) => (
        <div key={x.id} className="p-3 text-sm flex items-start gap-3">
          <History className="w-4 h-4 text-gray-400 mt-0.5" />
          <div><p className="text-gray-800">{x.action}{x.fromStatus || x.toStatus ? ` · ${x.fromStatus || '—'} → ${x.toStatus || '—'}` : ''}</p><p className="text-xs text-gray-400">{new Date(x.createdAt).toLocaleString('es-AR')}{x.userName ? ` · ${x.userName}` : ''}{x.comment ? ` · ${x.comment}` : ''}</p></div>
        </div>
      ))}
    </div>
  );
}

function StatMini({ label, value }: { label: string; value: number }) {
  return <div className="bg-white border border-gray-200 rounded-xl p-4 text-center"><div className="text-2xl font-bold text-gray-900">{value}</div><div className="text-xs text-gray-500">{label}</div></div>;
}
