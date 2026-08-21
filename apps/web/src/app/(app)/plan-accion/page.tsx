'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import {
  Plus, Search, X, Eye, Code2,
  FileText, Trash2, Edit3, Loader2,
} from 'lucide-react';
import DocCodeBadge from '@/components/DocCodeBadge';
import ExportButton from '@/components/ExportButton';
import { buildTableHtml, buildFullDocument } from '@/lib/pdf-content';

// ── Types ───────────────────────────────────────────────────────────────────

type APStatus = 'DRAFT'|'PENDING_CODE'|'PENDING_APPROVAL'|'OPEN'|'IN_EXECUTION'|'PENDING_EVIDENCE'|'PENDING_EFFECTIVENESS'|'EFFECTIVE'|'NOT_EFFECTIVE'|'OVERDUE'|'CLOSED'|'CANCELLED';
type APType = 'IMMEDIATE_CORRECTION'|'CORRECTIVE'|'PREVENTIVE'|'IMPROVEMENT'|'RISK_TREATMENT';
type APOrigin = 'MANUAL'|'AUDIT'|'NCR'|'INCIDENT'|'COMPLAINT'|'INSPECTION'|'INDICATOR'|'MANAGEMENT_REVIEW'|'RISK'|'OTHER';
type APEffectiveness = 'PENDING'|'EFFECTIVE'|'NOT_EFFECTIVE';
type APMethod = 'FIVE_WHYS'|'ISHIKAWA'|'FAULT_TREE'|'EIGHT_D'|'OTHER';

interface User { id: string; email: string; firstName?: string; lastName?: string; }
interface ActionPlan {
  id: string; code: string|null; ncrId: string|null; status: APStatus; type: APType; origin: APOrigin;
  severity: string|null; site: string|null; area: string|null; process: string|null;
  findingDescription: string|null; requirement: string|null; classification: string|null;
  immediateCorrection: string|null; rootCauseAnalysis: string|null; analysisMethod: APMethod|null;
  validatedRootCause: string|null; plannedAction: string|null; expectedResult: string|null;
  executorId: string|null; supervisorId: string|null; requiredResources: string|null;
  openedAt: string; plannedStartDate: string|null; plannedEndDate: string|null; actualEndDate: string|null;
  progressPercent: number; effectivenessCheckDate: string|null; effectivenessMethod: string|null;
  effectivenessResult: string|null; effectiveness: APEffectiveness; cancellationReason: string|null;
  observations: string|null; closedAt: string|null; codeAssignedAt: string|null;
  ncr?: { id: string; code: string; title: string; severity: string; status: string; }|null;
  executor?: User|null; supervisor?: User|null; effectivenessChecker?: User|null;
  closedBy?: User|null; approvedCloseBy?: User|null; createdBy?: User|null;
  _count?: { attachments: number; logs: number; };
}
interface APStats {
  total: number; byStatus: Record<string,number>; overdue: number;
  avgCloseDays: number; effective: number; notEffective: number; pendingEffectiveness: number;
}

// ── Config maps ──────────────────────────────────────────────────────────────

const STATUS_CFG: Record<APStatus, { label: string; color: string; bg: string; dot: string }> = {
  DRAFT:                  { label: 'Borrador',              color: 'text-neutral-600', bg: 'bg-neutral-100 border-neutral-200', dot: 'bg-neutral-400' },
  PENDING_CODE:           { label: 'Pend. código',          color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200',     dot: 'bg-amber-400' },
  PENDING_APPROVAL:       { label: 'Pend. aprobación',      color: 'text-orange-700',  bg: 'bg-orange-50 border-orange-200',   dot: 'bg-orange-400' },
  OPEN:                   { label: 'Abierto',               color: 'text-blue-700',    bg: 'bg-blue-50 border-blue-200',       dot: 'bg-blue-500' },
  IN_EXECUTION:           { label: 'En ejecución',          color: 'text-indigo-700',  bg: 'bg-indigo-50 border-indigo-200',   dot: 'bg-indigo-500' },
  PENDING_EVIDENCE:       { label: 'Pend. evidencia',       color: 'text-purple-700',  bg: 'bg-purple-50 border-purple-200',   dot: 'bg-purple-500' },
  PENDING_EFFECTIVENESS:  { label: 'Pend. eficacia',        color: 'text-cyan-700',    bg: 'bg-cyan-50 border-cyan-200',       dot: 'bg-cyan-500' },
  EFFECTIVE:              { label: 'Eficaz',                color: 'text-green-700',   bg: 'bg-green-50 border-green-200',     dot: 'bg-green-500' },
  NOT_EFFECTIVE:          { label: 'No eficaz',             color: 'text-red-700',     bg: 'bg-red-50 border-red-200',         dot: 'bg-red-500' },
  OVERDUE:                { label: 'Vencido',               color: 'text-red-800',     bg: 'bg-red-100 border-red-300',        dot: 'bg-red-600' },
  CLOSED:                 { label: 'Cerrado',               color: 'text-green-800',   bg: 'bg-green-100 border-green-300',    dot: 'bg-green-700' },
  CANCELLED:              { label: 'Cancelado',             color: 'text-neutral-500', bg: 'bg-neutral-100 border-neutral-200',dot: 'bg-neutral-400' },
};

const TYPE_LABELS: Record<APType, string> = {
  IMMEDIATE_CORRECTION: 'Corrección inmediata', CORRECTIVE: 'Correctiva',
  PREVENTIVE: 'Preventiva', IMPROVEMENT: 'Mejora', RISK_TREATMENT: 'Tratamiento riesgo',
};
const ORIGIN_LABELS: Record<APOrigin, string> = {
  MANUAL: 'Manual', AUDIT: 'Auditoría', NCR: 'No Conformidad', INCIDENT: 'Incidente',
  COMPLAINT: 'Reclamo', INSPECTION: 'Inspección', INDICATOR: 'Indicador',
  MANAGEMENT_REVIEW: 'Revisión Dirección', RISK: 'Riesgo', OTHER: 'Otro',
};
const METHOD_LABELS: Record<APMethod, string> = {
  FIVE_WHYS: '5 Porqués', ISHIKAWA: 'Ishikawa', FAULT_TREE: 'Árbol de causas',
  EIGHT_D: '8D', OTHER: 'Otra',
};
const EFF_CFG: Record<APEffectiveness, { label: string; color: string }> = {
  PENDING:       { label: 'Pendiente', color: 'text-amber-600' },
  EFFECTIVE:     { label: 'Eficaz',    color: 'text-green-600' },
  NOT_EFFECTIVE: { label: 'No eficaz', color: 'text-red-600' },
};

function fmt(d: string|null) { return d ? new Date(d).toLocaleDateString('es-AR') : '—'; }
function userName(u?: User|null) { return u ? (u.firstName ? `${u.firstName} ${u.lastName ?? ''}`.trim() : u.email) : '—'; }

function trafficLight(plan: ActionPlan): 'green'|'amber'|'red'|null {
  if (!plan.plannedEndDate || ['CLOSED','EFFECTIVE','CANCELLED'].includes(plan.status)) return null;
  const diff = new Date(plan.plannedEndDate).getTime() - Date.now();
  const days = diff / (1000 * 60 * 60 * 24);
  if (days < 0) return 'red';
  if (days <= 7) return 'amber';
  return 'green';
}

// ── Empty form ───────────────────────────────────────────────────────────────

function emptyForm(): Partial<ActionPlan> {
  return {
    origin: 'MANUAL', type: 'CORRECTIVE', status: 'DRAFT',
    progressPercent: 0, effectiveness: 'PENDING',
  };
}

// ── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: { label: string; value: number|string; sub?: string; color: string }) {
  return (
    <div className={`rounded-xl border p-4 ${color}`}>
      <p className="text-xs font-medium opacity-70">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs opacity-60 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Detail Modal ─────────────────────────────────────────────────────────────

function DetailModal({ plan, onClose, onSave }: { plan: ActionPlan; onClose: () => void; onSave: () => void }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<ActionPlan>>({ ...plan });
  const [logs, setLogs] = useState<any[]>([]);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [tab, setTab] = useState<'info'|'analysis'|'execution'|'verification'|'log'>('info');
  const [assigning, setAssigning] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showCancel, setShowCancel] = useState(false);

  useEffect(() => {
    apiFetch<{ logs: any[] }>(`/action-plans/${plan.id}/logs`).then(r => setLogs(r.logs ?? [])).catch(() => {});
    apiFetch<{ attachments: any[] }>(`/action-plans/${plan.id}/attachments`).then(r => setAttachments(r.attachments ?? [])).catch(() => {});
  }, [plan.id]);

  async function save() {
    setSaving(true);
    try {
      await apiFetch(`/action-plans/${plan.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(form) });
      onSave();
      setEditing(false);
    } catch (e: any) { alert(e.message || 'Error al guardar'); }
    finally { setSaving(false); }
  }

  async function assignCode() {
    if (!confirm('¿Asignar código a este plan?')) return;
    setAssigning(true);
    try {
      await apiFetch(`/action-plans/${plan.id}/assign-code`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
      onSave();
    } catch (e: any) { alert(e.message || 'Error'); }
    finally { setAssigning(false); }
  }

  async function doCancel() {
    if (!cancelReason.trim()) { alert('Debe ingresar una justificación'); return; }
    setSaving(true);
    try {
      await apiFetch(`/action-plans/${plan.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'CANCELLED', cancellationReason: cancelReason }) });
      onSave(); onClose();
    } catch (e: any) { alert(e.message || 'Error'); }
    finally { setSaving(false); }
  }

  const stCfg = STATUS_CFG[plan.status] ?? STATUS_CFG.DRAFT;
  const light = trafficLight(plan);

  const field = (label: string, val: string|null|undefined) => (
    <div>
      <p className="text-xs text-neutral-500 font-medium">{label}</p>
      <p className="text-sm text-neutral-800 mt-0.5 whitespace-pre-wrap">{val || '—'}</p>
    </div>
  );

  const textarea = (key: keyof ActionPlan, label: string, rows = 3) => (
    <div>
      <label className="block text-xs font-medium text-neutral-600 mb-1">{label}</label>
      <textarea rows={rows} className="w-full text-sm border border-neutral-300 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
        value={(form as any)[key] ?? ''} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
    </div>
  );

  const input = (key: keyof ActionPlan, label: string, type = 'text') => (
    <div>
      <label className="block text-xs font-medium text-neutral-600 mb-1">{label}</label>
      <input type={type} className="w-full text-sm border border-neutral-300 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
        value={(form as any)[key] ?? ''} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
    </div>
  );

  const sel = (key: keyof ActionPlan, label: string, opts: { value: string; label: string }[]) => (
    <div>
      <label className="block text-xs font-medium text-neutral-600 mb-1">{label}</label>
      <select className="w-full text-sm border border-neutral-300 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
        value={(form as any)[key] ?? ''} onChange={e => setForm(f => ({ ...f, [key]: e.target.value || null }))}>
        <option value="">— Seleccionar —</option>
        {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );

  const TABS = [
    { key: 'info', label: 'Información' },
    { key: 'analysis', label: 'Análisis' },
    { key: 'execution', label: 'Ejecución' },
    { key: 'verification', label: 'Verificación' },
    { key: 'log', label: 'Bitácora' },
  ] as const;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto py-6 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-neutral-100">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded">{plan.code || 'Sin código'}</span>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-medium ${stCfg.bg} ${stCfg.color}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${stCfg.dot}`} />
                {stCfg.label}
              </span>
              {light && (
                <span className={`w-3 h-3 rounded-full ${light === 'red' ? 'bg-red-500' : light === 'amber' ? 'bg-amber-400' : 'bg-green-500'}`} title={light === 'red' ? 'Vencido' : light === 'amber' ? 'Próximo a vencer' : 'En plazo'} />
              )}
            </div>
            <h2 className="mt-2 text-lg font-semibold text-neutral-900">{plan.findingDescription?.slice(0,80) || '(Sin descripción)'}</h2>
            {plan.ncr && (
              <p className="text-xs text-neutral-500 mt-1">NCR: <span className="font-mono font-medium">{plan.ncr.code}</span> — {plan.ncr.title?.slice(0,60)}</p>
            )}
          </div>
          <div className="flex items-center gap-2 ml-4 shrink-0">
            {!plan.code && (
              <button onClick={assignCode} disabled={assigning} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 disabled:opacity-50">
                {assigning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Code2 className="w-3 h-3" />} Asignar código
              </button>
            )}
            <button onClick={() => setEditing(!editing)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-neutral-200 rounded-lg hover:bg-neutral-50">
              <Edit3 className="w-3 h-3" /> {editing ? 'Cancelar' : 'Editar'}
            </button>
            <button onClick={() => setShowCancel(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-red-200 text-red-600 rounded-lg hover:bg-red-50">
              <Trash2 className="w-3 h-3" /> Cancelar plan
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-neutral-100">
              <X className="w-4 h-4 text-neutral-500" />
            </button>
          </div>
        </div>

        {/* Sub-tabs */}
        <div className="border-b border-neutral-100">
          <nav className="flex gap-0 overflow-x-auto px-6">
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${tab === t.key ? 'border-blue-600 text-blue-700' : 'border-transparent text-neutral-500 hover:text-neutral-800'}`}>
                {t.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6 space-y-6">
          {/* ── Info ── */}
          {tab === 'info' && (
            editing ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sel('status', 'Estado', Object.entries(STATUS_CFG).map(([v,c]) => ({ value: v, label: c.label })))}
                {sel('type', 'Tipo de acción', Object.entries(TYPE_LABELS).map(([v,l]) => ({ value: v, label: l })))}
                {sel('origin', 'Origen', Object.entries(ORIGIN_LABELS).map(([v,l]) => ({ value: v, label: l })))}
                {input('severity', 'Criticidad / Clasificación')}
                {input('site', 'Sede')}
                {input('area', 'Área')}
                {input('process', 'Proceso')}
                {input('requirement', 'Requisito relacionado')}
                <div className="md:col-span-2">{textarea('findingDescription', 'Descripción del hallazgo / problema', 3)}</div>
                <div className="md:col-span-2">{textarea('observations', 'Observaciones', 2)}</div>
                {input('plannedStartDate', 'Fecha prevista inicio', 'date')}
                {input('plannedEndDate', 'Fecha prevista cierre', 'date')}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {field('Tipo', TYPE_LABELS[plan.type])}
                {field('Origen', ORIGIN_LABELS[plan.origin])}
                {field('Criticidad', plan.severity)}
                {field('Sede', plan.site)} {field('Área', plan.area)} {field('Proceso', plan.process)}
                {field('Requisito', plan.requirement)}
                {field('Responsable ejecución', userName(plan.executor))}
                {field('Responsable seguimiento', userName(plan.supervisor))}
                {field('Fecha apertura', fmt(plan.openedAt))}
                {field('Fecha prevista inicio', fmt(plan.plannedStartDate))}
                {field('Fecha prevista cierre', fmt(plan.plannedEndDate))}
                {field('Fecha real cierre', fmt(plan.actualEndDate))}
                <div className="md:col-span-3">{field('Descripción', plan.findingDescription)}</div>
                <div className="md:col-span-3">{field('Observaciones', plan.observations)}</div>
              </div>
            )
          )}

          {/* ── Analysis ── */}
          {tab === 'analysis' && (
            editing ? (
              <div className="space-y-4">
                {textarea('immediateCorrection', 'Corrección inmediata / Medida de contención')}
                {textarea('rootCauseAnalysis', 'Análisis de causa raíz')}
                {sel('analysisMethod', 'Metodología', Object.entries(METHOD_LABELS).map(([v,l]) => ({ value: v, label: l })))}
                {textarea('validatedRootCause', 'Causa raíz validada')}
              </div>
            ) : (
              <div className="space-y-4">
                {field('Corrección inmediata', plan.immediateCorrection)}
                {field('Análisis de causa raíz', plan.rootCauseAnalysis)}
                {field('Metodología', plan.analysisMethod ? METHOD_LABELS[plan.analysisMethod] : null)}
                {field('Causa raíz validada', plan.validatedRootCause)}
              </div>
            )
          )}

          {/* ── Execution ── */}
          {tab === 'execution' && (
            editing ? (
              <div className="space-y-4">
                {textarea('plannedAction', 'Acción planificada')}
                {textarea('expectedResult', 'Resultado esperado / Criterio de éxito')}
                {textarea('requiredResources', 'Recursos requeridos')}
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Avance (%)</label>
                  <input type="number" min={0} max={100} className="w-32 text-sm border border-neutral-300 rounded-lg px-3 py-2"
                    value={form.progressPercent ?? 0} onChange={e => setForm(f => ({ ...f, progressPercent: Number(e.target.value) }))} />
                </div>
                {input('actualEndDate', 'Fecha real de finalización', 'date')}
              </div>
            ) : (
              <div className="space-y-4">
                {field('Acción planificada', plan.plannedAction)}
                {field('Resultado esperado', plan.expectedResult)}
                {field('Recursos requeridos', plan.requiredResources)}
                <div>
                  <p className="text-xs text-neutral-500 font-medium">Avance</p>
                  <div className="mt-1.5 flex items-center gap-3">
                    <div className="flex-1 bg-neutral-200 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${plan.progressPercent}%` }} />
                    </div>
                    <span className="text-sm font-medium text-neutral-700">{plan.progressPercent}%</span>
                  </div>
                </div>
                {field('Fecha real finalización', fmt(plan.actualEndDate))}
                <p className="text-xs text-neutral-400">Adjuntos: {plan._count?.attachments ?? 0}</p>
              </div>
            )
          )}

          {/* ── Verification ── */}
          {tab === 'verification' && (
            editing ? (
              <div className="space-y-4">
                {input('effectivenessCheckDate', 'Fecha prevista verificación eficacia', 'date')}
                {textarea('effectivenessMethod', 'Método / Indicador de verificación')}
                {textarea('effectivenessResult', 'Resultado de la verificación')}
                {sel('effectiveness', 'Acción eficaz', [
                  { value: 'PENDING', label: 'Pendiente' },
                  { value: 'EFFECTIVE', label: 'Sí, es eficaz' },
                  { value: 'NOT_EFFECTIVE', label: 'No es eficaz' },
                ])}
              </div>
            ) : (
              <div className="space-y-4">
                {field('Fecha prevista verificación', fmt(plan.effectivenessCheckDate))}
                {field('Método de verificación', plan.effectivenessMethod)}
                {field('Resultado de verificación', plan.effectivenessResult)}
                <div>
                  <p className="text-xs text-neutral-500 font-medium">Eficacia</p>
                  <p className={`text-sm font-semibold mt-0.5 ${EFF_CFG[plan.effectiveness].color}`}>
                    {EFF_CFG[plan.effectiveness].label}
                  </p>
                </div>
                {field('Verificador', userName(plan.effectivenessChecker))}
                {field('Cierre', fmt(plan.closedAt))}
                {field('Aprobó cierre', userName(plan.approvedCloseBy))}
              </div>
            )
          )}

          {/* ── Log ── */}
          {tab === 'log' && (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {logs.length === 0 && <p className="text-sm text-neutral-400 italic">Sin registros en bitácora.</p>}
              {logs.map(l => (
                <div key={l.id} className="flex gap-3 text-xs text-neutral-600 border-l-2 border-neutral-200 pl-3 py-1">
                  <span className="text-neutral-400 whitespace-nowrap">{fmt(l.createdAt)}</span>
                  <span className="font-medium text-neutral-700">{l.user?.email ?? '—'}</span>
                  <span>{l.action}</span>
                  {l.field && <span className="text-neutral-400">({l.field}: {l.oldValue ?? '∅'} → {l.newValue ?? '∅'})</span>}
                  {l.note && <span className="italic text-neutral-400">{l.note}</span>}
                </div>
              ))}
            </div>
          )}

          {editing && (
            <div className="flex gap-2 pt-2">
              <button onClick={save} disabled={saving} className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
              <button onClick={() => setEditing(false)} className="px-4 py-2 text-sm text-neutral-500 hover:text-neutral-800">Cancelar</button>
            </div>
          )}
        </div>

        {/* Cancel dialog */}
        {showCancel && (
          <div className="border-t border-red-100 bg-red-50 p-4 rounded-b-2xl">
            <p className="text-sm font-medium text-red-700 mb-2">Justificación para cancelar (obligatorio):</p>
            <textarea rows={2} className="w-full text-sm border border-red-200 rounded-lg px-3 py-2 bg-white"
              value={cancelReason} onChange={e => setCancelReason(e.target.value)} />
            <div className="flex gap-2 mt-2">
              <button onClick={doCancel} disabled={saving} className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50">
                {saving ? 'Cancelando...' : 'Confirmar cancelación'}
              </button>
              <button onClick={() => setShowCancel(false)} className="px-4 py-2 text-sm text-neutral-600">Volver</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Create/Edit Form Modal ───────────────────────────────────────────────────

function CreateModal({ ncrPreload, onClose, onCreated }: { ncrPreload?: { ncrId: string; findingDescription: string; origin: APOrigin; requirement: string; severity: string; process: string; }; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState<Partial<ActionPlan>>({
    ...emptyForm(),
    ncrId: ncrPreload?.ncrId ?? null,
    findingDescription: ncrPreload?.findingDescription ?? '',
    origin: ncrPreload?.origin ?? 'MANUAL',
    requirement: ncrPreload?.requirement ?? '',
    severity: ncrPreload?.severity ?? '',
    process: ncrPreload?.process ?? '',
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await apiFetch<{ plan: ActionPlan; alreadyExisted?: boolean }>('/action-plans', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.alreadyExisted) alert('Esta NCR ya tiene un Plan de Acción. Se abrirá el existente.');
      onCreated();
      onClose();
    } catch (e: any) { alert(e.message || 'Error al crear'); }
    finally { setSaving(false); }
  }

  const f = (key: keyof ActionPlan, label: string, type = 'text') => (
    <div>
      <label className="block text-xs font-medium text-neutral-600 mb-1">{label}</label>
      <input type={type} className="w-full text-sm border border-neutral-300 rounded-lg px-3 py-2"
        value={(form as any)[key] ?? ''} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} />
    </div>
  );
  const s = (key: keyof ActionPlan, label: string, opts: {value: string; label: string}[]) => (
    <div>
      <label className="block text-xs font-medium text-neutral-600 mb-1">{label}</label>
      <select className="w-full text-sm border border-neutral-300 rounded-lg px-3 py-2"
        value={(form as any)[key] ?? ''} onChange={e => setForm(p => ({ ...p, [key]: e.target.value || null }))}>
        <option value="">— Seleccionar —</option>
        {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
  const t = (key: keyof ActionPlan, label: string) => (
    <div>
      <label className="block text-xs font-medium text-neutral-600 mb-1">{label}</label>
      <textarea rows={3} className="w-full text-sm border border-neutral-300 rounded-lg px-3 py-2"
        value={(form as any)[key] ?? ''} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto py-8 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold text-neutral-900">Nuevo Plan de Acción</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-neutral-400" /></button>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {s('type', 'Tipo de acción *', Object.entries(TYPE_LABELS).map(([v,l]) => ({ value: v, label: l })))}
          {s('origin', 'Origen *', Object.entries(ORIGIN_LABELS).map(([v,l]) => ({ value: v, label: l })))}
          {f('severity', 'Criticidad')} {f('process', 'Proceso')}
          {f('site', 'Sede')} {f('area', 'Área')}
          {f('requirement', 'Requisito relacionado')}
          {f('plannedEndDate', 'Fecha prevista cierre', 'date')}
          <div className="md:col-span-2">{t('findingDescription', 'Descripción del hallazgo / problema *')}</div>
          <div className="md:col-span-2">{t('plannedAction', 'Acción planificada')}</div>
        </div>
        <div className="flex gap-2 justify-end p-6 border-t">
          <button onClick={onClose} className="px-4 py-2 text-sm text-neutral-500">Cancelar</button>
          <button onClick={save} disabled={saving} className="px-5 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Creando...' : 'Crear Plan de Acción'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function PlanAccionPage() {
  const [plans, setPlans] = useState<ActionPlan[]>([]);
  const [stats, setStats] = useState<APStats|null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterOrigin, setFilterOrigin] = useState('ALL');
  const [filterType, setFilterType] = useState('ALL');
  const [selectedPlan, setSelectedPlan] = useState<ActionPlan|null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [assigning, setAssigning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pr, sr] = await Promise.all([
        apiFetch<{ plans: ActionPlan[] }>('/action-plans'),
        apiFetch<{ stats: APStats }>('/action-plans/stats'),
      ]);
      setPlans(pr.plans ?? []);
      setStats(sr.stats ?? null);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = plans.filter(p => {
    if (filterStatus !== 'ALL' && p.status !== filterStatus) return false;
    if (filterOrigin !== 'ALL' && p.origin !== filterOrigin) return false;
    if (filterType !== 'ALL' && p.type !== filterType) return false;
    if (search) {
      const q = search.toLowerCase();
      return (p.code ?? '').toLowerCase().includes(q)
        || (p.ncr?.code ?? '').toLowerCase().includes(q)
        || (p.findingDescription ?? '').toLowerCase().includes(q)
        || (p.process ?? '').toLowerCase().includes(q)
        || (p.executor?.email ?? '').toLowerCase().includes(q);
    }
    return true;
  });

  async function assignBulk() {
    const pending = selected.filter(id => !plans.find(p => p.id === id)?.code);
    if (pending.length === 0) { alert('Los planes seleccionados ya tienen código.'); return; }
    if (!confirm(`¿Asignar código a ${pending.length} plan(es) sin código? Esta acción no se puede revertir.`)) return;
    setAssigning(true);
    try {
      await apiFetch('/action-plans/assign-code-bulk', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ids: pending }) });
      setSelected([]);
      load();
    } catch (e: any) { alert(e.message || 'Error'); }
    setAssigning(false);
  }

  function toggleSelect(id: string) {
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  }

  const bodyHtml = buildFullDocument([{
    title: 'Planes de Acción',
    html: buildTableHtml([
      { key: 'code', label: 'Código', width: '90px' },
      { key: 'ncrCode', label: 'NCR', width: '90px' },
      { key: 'type', label: 'Tipo', width: '110px' },
      { key: 'origin', label: 'Origen', width: '100px' },
      { key: 'status', label: 'Estado', width: '110px' },
      { key: 'process', label: 'Proceso', width: '100px' },
      { key: 'finding', label: 'Descripción' },
      { key: 'executor', label: 'Responsable', width: '120px' },
      { key: 'plannedEnd', label: 'Fecha cierre', width: '90px' },
      { key: 'progress', label: 'Avance', width: '60px', align: 'center' },
    ], filtered.map(p => ({
      code: p.code ?? '—', ncrCode: p.ncr?.code ?? '—',
      type: TYPE_LABELS[p.type], origin: ORIGIN_LABELS[p.origin],
      status: STATUS_CFG[p.status]?.label ?? p.status,
      process: p.process ?? '—', finding: (p.findingDescription ?? '').slice(0, 60),
      executor: userName(p.executor), plannedEnd: fmt(p.plannedEndDate),
      progress: `${p.progressPercent}%`,
    }))),
  }]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Plan de Acción</h1>
          <p className="text-sm text-neutral-500 mt-0.5">Matriz centralizada — ISO 9001/14001/45001/19011</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DocCodeBadge outputKey="calidad.plan-accion.list" title="Plan de Acción" module="calidad" outputType="MATRIX" />
          <ExportButton outputKey="calidad.plan-accion.list" title="Plan de Acción" moduleName="calidad" bodyHtml={bodyHtml} recordCount={filtered.length} />
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4" /> Nuevo Plan de Acción
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="Total" value={stats.total} color="border-neutral-200 text-neutral-800" />
          <StatCard label="Abiertos" value={stats.byStatus.OPEN ?? 0} color="border-blue-200 bg-blue-50 text-blue-800" />
          <StatCard label="En ejecución" value={stats.byStatus.IN_EXECUTION ?? 0} color="border-indigo-200 bg-indigo-50 text-indigo-800" />
          <StatCard label="Vencidos" value={stats.overdue} color="border-red-200 bg-red-50 text-red-800" />
          <StatCard label="Pend. eficacia" value={stats.pendingEffectiveness} color="border-cyan-200 bg-cyan-50 text-cyan-800" />
          <StatCard label="Cerrados" value={stats.byStatus.CLOSED ?? 0} sub={`${stats.avgCloseDays}d prom.`} color="border-green-200 bg-green-50 text-green-800" />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input className="w-full pl-9 pr-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:border-blue-400"
            placeholder="Buscar por código, NCR, descripción, proceso…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="text-sm border border-neutral-200 rounded-lg px-3 py-2 bg-white">
          <option value="ALL">Todos los estados</option>
          {Object.entries(STATUS_CFG).map(([v,c]) => <option key={v} value={v}>{c.label}</option>)}
        </select>
        <select value={filterOrigin} onChange={e => setFilterOrigin(e.target.value)} className="text-sm border border-neutral-200 rounded-lg px-3 py-2 bg-white">
          <option value="ALL">Todos los orígenes</option>
          {Object.entries(ORIGIN_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="text-sm border border-neutral-200 rounded-lg px-3 py-2 bg-white">
          <option value="ALL">Todos los tipos</option>
          {Object.entries(TYPE_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        {selected.length > 0 && (
          <button onClick={assignBulk} disabled={assigning} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            <Code2 className="w-4 h-4" /> {assigning ? 'Asignando...' : `Asignar código (${selected.length})`}
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-48"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-neutral-400">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No hay planes de acción que coincidan con los filtros.</p>
          <button onClick={() => setShowCreate(true)} className="mt-3 text-blue-600 text-sm hover:underline">Crear el primero</button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-200">
                <th className="w-8 px-3 py-3"><input type="checkbox" checked={selected.length === filtered.length && filtered.length > 0} onChange={e => setSelected(e.target.checked ? filtered.map(p => p.id) : [])} /></th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide w-6">⚑</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide">Código</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide">NCR</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide">Tipo</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide">Origen</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide">Estado</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide">Proceso</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide">Descripción</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide">Responsable</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide">Cierre prev.</th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-neutral-500 uppercase tracking-wide">Avance</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filtered.map(p => {
                const stCfg = STATUS_CFG[p.status] ?? STATUS_CFG.DRAFT;
                const light = trafficLight(p);
                return (
                  <tr key={p.id} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-3 py-3"><input type="checkbox" checked={selected.includes(p.id)} onChange={() => toggleSelect(p.id)} /></td>
                    <td className="px-3 py-3">
                      {light && <span className={`w-2.5 h-2.5 rounded-full block mx-auto ${light === 'red' ? 'bg-red-500' : light === 'amber' ? 'bg-amber-400' : 'bg-green-500'}`} />}
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-neutral-600">{p.code ?? <span className="text-neutral-300 italic">sin código</span>}</td>
                    <td className="px-3 py-3 font-mono text-xs text-neutral-600">{p.ncr?.code ?? '—'}</td>
                    <td className="px-3 py-3 text-xs text-neutral-700">{TYPE_LABELS[p.type]}</td>
                    <td className="px-3 py-3 text-xs text-neutral-700">{ORIGIN_LABELS[p.origin]}</td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${stCfg.bg} ${stCfg.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${stCfg.dot}`} />{stCfg.label}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs text-neutral-600">{p.process ?? '—'}</td>
                    <td className="px-3 py-3 text-xs text-neutral-700 max-w-xs">
                      <span className="line-clamp-2">{p.findingDescription ?? '—'}</span>
                    </td>
                    <td className="px-3 py-3 text-xs text-neutral-600">{userName(p.executor)}</td>
                    <td className="px-3 py-3 text-xs text-neutral-600">{fmt(p.plannedEndDate)}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5">
                        <div className="w-16 bg-neutral-200 rounded-full h-1.5">
                          <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${p.progressPercent}%` }} />
                        </div>
                        <span className="text-xs text-neutral-500">{p.progressPercent}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <button onClick={() => setSelectedPlan(p)} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600">
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selectedPlan && (
        <DetailModal plan={selectedPlan} onClose={() => setSelectedPlan(null)} onSave={() => { load(); setSelectedPlan(null); }} />
      )}
      {showCreate && (
        <CreateModal onClose={() => setShowCreate(false)} onCreated={load} />
      )}
    </div>
  );
}
