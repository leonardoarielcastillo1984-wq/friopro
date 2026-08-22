'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { apiFetch } from '@/lib/api';
import {
  Plus, Search, X, Eye, FileText, Loader2, ChevronDown, ChevronUp,
  Columns3, Check, AlertCircle, Clock, History, Sparkles, Filter, Send,
} from 'lucide-react';
import ExportButton from '@/components/ExportButton';
import { buildTableHtml, buildFullDocument } from '@/lib/pdf-content';
import { InlineCell, type SelectOption } from './InlineCell';
import SolicitarActualizacionModal from './SolicitarActualizacionModal';
import PortalAdminPanel from './PortalAdminPanel';

// ── Types ───────────────────────────────────────────────────────────────────

type APStatus = 'DRAFT'|'PENDING_CODE'|'PENDING_APPROVAL'|'OPEN'|'IN_EXECUTION'|'PENDING_EVIDENCE'|'PENDING_EFFECTIVENESS'|'EFFECTIVE'|'NOT_EFFECTIVE'|'OVERDUE'|'CLOSED'|'CANCELLED';
type APType = 'IMMEDIATE_CORRECTION'|'CORRECTIVE'|'PREVENTIVE'|'IMPROVEMENT'|'RISK_TREATMENT';
type APOrigin = 'MANUAL'|'AUDIT'|'NCR'|'INCIDENT'|'COMPLAINT'|'INSPECTION'|'INDICATOR'|'MANAGEMENT_REVIEW'|'RISK'|'OTHER';
type APEffectiveness = 'PENDING'|'EFFECTIVE'|'NOT_EFFECTIVE';
type APMethod = 'FIVE_WHYS'|'ISHIKAWA'|'FAULT_TREE'|'EIGHT_D'|'OTHER';

interface User { id: string; email: string; firstName?: string; lastName?: string; }
interface ActionPlan {
  id: string; sequenceNumber: number|null; code: string|null; ncrId: string|null; status: APStatus; type: APType; origin: APOrigin;
  severity: string|null; site: string|null; area: string|null; process: string|null;
  findingDescription: string|null; requirement: string|null; classification: string|null;
  immediateCorrection: string|null; rootCauseAnalysis: string|null; analysisMethod: APMethod|null;
  validatedRootCause: string|null; plannedAction: string|null; expectedResult: string|null;
  executorId: string|null; executorNameText: string|null; supervisorId: string|null; requiredResources: string|null;
  openedAt: string; plannedStartDate: string|null; plannedEndDate: string|null; actualEndDate: string|null;
  progressPercent: number; effectivenessCheckDate: string|null; effectivenessMethod: string|null;
  effectivenessResult: string|null; effectiveness: APEffectiveness; cancellationReason: string|null;
  observations: string|null; closedAt: string|null; codeAssignedAt: string|null;
  createdAt: string; updatedAt: string;
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
  DRAFT:                 { label: 'Borrador',           color: 'text-neutral-600', bg: 'bg-neutral-100 border-neutral-200',    dot: 'bg-neutral-400' },
  PENDING_CODE:          { label: 'Pend. codigo',       color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200',         dot: 'bg-amber-400' },
  PENDING_APPROVAL:      { label: 'Pend. aprobacion',   color: 'text-orange-700',  bg: 'bg-orange-50 border-orange-200',       dot: 'bg-orange-400' },
  OPEN:                  { label: 'Abierto',            color: 'text-blue-700',    bg: 'bg-blue-50 border-blue-200',           dot: 'bg-blue-500' },
  IN_EXECUTION:          { label: 'En ejecucion',       color: 'text-indigo-700',  bg: 'bg-indigo-50 border-indigo-200',       dot: 'bg-indigo-500' },
  PENDING_EVIDENCE:      { label: 'Pend. evidencia',    color: 'text-purple-700',  bg: 'bg-purple-50 border-purple-200',       dot: 'bg-purple-500' },
  PENDING_EFFECTIVENESS: { label: 'Pend. eficacia',     color: 'text-cyan-700',    bg: 'bg-cyan-50 border-cyan-200',           dot: 'bg-cyan-500' },
  EFFECTIVE:             { label: 'Eficaz',             color: 'text-green-700',   bg: 'bg-green-50 border-green-200',         dot: 'bg-green-500' },
  NOT_EFFECTIVE:         { label: 'No eficaz',          color: 'text-red-700',     bg: 'bg-red-50 border-red-200',             dot: 'bg-red-500' },
  OVERDUE:               { label: 'Vencido',            color: 'text-red-800',     bg: 'bg-red-100 border-red-300',            dot: 'bg-red-600' },
  CLOSED:                { label: 'Cerrado',            color: 'text-green-800',   bg: 'bg-green-100 border-green-300',        dot: 'bg-green-700' },
  CANCELLED:             { label: 'Cancelado',          color: 'text-neutral-500', bg: 'bg-neutral-100 border-neutral-200',    dot: 'bg-neutral-400' },
};

const TYPE_OPTS: SelectOption[] = [
  { value: 'IMMEDIATE_CORRECTION', label: 'Correccion inmediata' },
  { value: 'CORRECTIVE', label: 'Correctiva' },
  { value: 'PREVENTIVE', label: 'Preventiva' },
  { value: 'IMPROVEMENT', label: 'Mejora' },
  { value: 'RISK_TREATMENT', label: 'Tratamiento riesgo' },
];
const ORIGIN_OPTS: SelectOption[] = [
  { value: 'MANUAL', label: 'Manual' }, { value: 'AUDIT', label: 'Auditoria' },
  { value: 'NCR', label: 'No Conformidad' }, { value: 'INCIDENT', label: 'Incidente' },
  { value: 'COMPLAINT', label: 'Reclamo' }, { value: 'INSPECTION', label: 'Inspeccion' },
  { value: 'INDICATOR', label: 'Indicador' }, { value: 'MANAGEMENT_REVIEW', label: 'Revision Direccion' },
  { value: 'RISK', label: 'Riesgo' }, { value: 'OTHER', label: 'Otro' },
];
const METHOD_OPTS: SelectOption[] = [
  { value: 'FIVE_WHYS', label: '5 Porques' }, { value: 'ISHIKAWA', label: 'Ishikawa' },
  { value: 'FAULT_TREE', label: 'Arbol de causas' }, { value: 'EIGHT_D', label: '8D' },
  { value: 'OTHER', label: 'Otra' },
];
const EFF_OPTS: SelectOption[] = [
  { value: 'PENDING', label: 'Pendiente' },
  { value: 'EFFECTIVE', label: 'Si, es eficaz' },
  { value: 'NOT_EFFECTIVE', label: 'No es eficaz' },
];
const STATUS_OPTS: SelectOption[] = Object.entries(STATUS_CFG).map(([v, c]) => ({ value: v, label: c.label }));

const TYPE_LABELS: Record<string, string> = Object.fromEntries(TYPE_OPTS.map(o => [o.value, o.label]));
const ORIGIN_LABELS: Record<string, string> = Object.fromEntries(ORIGIN_OPTS.map(o => [o.value, o.label]));
const METHOD_LABELS: Record<string, string> = Object.fromEntries(METHOD_OPTS.map(o => [o.value, o.label]));
const EFF_LABELS: Record<string, string> = Object.fromEntries(EFF_OPTS.map(o => [o.value, o.label]));

const DASH = '\u2014';

function fmt(d: string|null|undefined) {
  if (!d) return DASH;
  const date = new Date(d);
  return isNaN(date.getTime()) ? DASH : date.toLocaleDateString('es-AR');
}
function fmtDateTime(d: string|null|undefined) {
  if (!d) return DASH;
  const date = new Date(d);
  return isNaN(date.getTime()) ? DASH : date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}
function userName(u?: User|null, text?: string|null) { return text || (u ? (u.firstName ? `${u.firstName} ${u.lastName ?? ''}`.trim() : u.email) : DASH); }

function trafficLight(plan: ActionPlan): 'green'|'amber'|'red'|null {
  if (!plan.plannedEndDate || ['CLOSED','EFFECTIVE','CANCELLED'].includes(plan.status)) return null;
  const diff = new Date(plan.plannedEndDate).getTime() - Date.now();
  const days = diff / (1000 * 60 * 60 * 24);
  if (days < 0) return 'red';
  if (days <= 7) return 'amber';
  return 'green';
}

function toDateInput(d: string|null|undefined): string {
  if (!d) return '';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '';
  return date.toISOString().split('T')[0];
}

const AI_FIELDS = ['immediateCorrection','rootCauseAnalysis','validatedRootCause','plannedAction','expectedResult'];

// ── Column definitions ──────────────────────────────────────────────────────

interface ColDef {
  key: string;
  label: string;
  group: 'general'|'analisis'|'ejecucion'|'verificacion'|'control';
  width: number;
  sticky?: boolean;
  editable?: boolean;
  cellType?: 'text'|'textarea'|'select'|'date'|'number';
  options?: SelectOption[];
  min?: number; max?: number;
  field?: keyof ActionPlan;
}

const COLUMNS: ColDef[] = [
  { key: 'checkbox', label: '', group: 'general', width: 36, sticky: true },
  { key: 'sequenceNumber', label: 'Nro', group: 'general', width: 50, sticky: true },
  { key: 'ncrCode', label: 'NCR', group: 'general', width: 90 },
  { key: 'status', label: 'Estado', group: 'general', width: 120, editable: true, cellType: 'select', options: STATUS_OPTS, field: 'status' },
  { key: 'type', label: 'Tipo', group: 'general', width: 120, editable: true, cellType: 'select', options: TYPE_OPTS, field: 'type' },
  { key: 'origin', label: 'Origen', group: 'general', width: 110, editable: true, cellType: 'select', options: ORIGIN_OPTS, field: 'origin' },
  { key: 'severity', label: 'Criticidad', group: 'general', width: 90, editable: true, cellType: 'text', field: 'severity' },
  { key: 'site', label: 'Sede', group: 'general', width: 80, editable: true, cellType: 'text', field: 'site' },
  { key: 'area', label: 'Area', group: 'general', width: 80, editable: true, cellType: 'text', field: 'area' },
  { key: 'process', label: 'Proceso', group: 'general', width: 90, editable: true, cellType: 'text', field: 'process' },
  { key: 'requirement', label: 'Requisito', group: 'general', width: 100, editable: true, cellType: 'text', field: 'requirement' },
  { key: 'findingDescription', label: 'Descripcion del hallazgo', group: 'general', width: 200, editable: true, cellType: 'textarea', field: 'findingDescription' },
  { key: 'observations', label: 'Observaciones', group: 'general', width: 150, editable: true, cellType: 'textarea', field: 'observations' },
  { key: 'plannedStartDate', label: 'F. inicio prev.', group: 'general', width: 90, editable: true, cellType: 'date', field: 'plannedStartDate' },
  { key: 'plannedEndDate', label: 'F. cierre prev.', group: 'general', width: 90, editable: true, cellType: 'date', field: 'plannedEndDate' },
  { key: 'immediateCorrection', label: 'Correccion inmediata', group: 'analisis', width: 180, editable: true, cellType: 'textarea', field: 'immediateCorrection' },
  { key: 'rootCauseAnalysis', label: 'Analisis causa raiz', group: 'analisis', width: 180, editable: true, cellType: 'textarea', field: 'rootCauseAnalysis' },
  { key: 'analysisMethod', label: 'Metodologia', group: 'analisis', width: 100, editable: true, cellType: 'select', options: METHOD_OPTS, field: 'analysisMethod' },
  { key: 'validatedRootCause', label: 'Causa raiz validada', group: 'analisis', width: 150, editable: true, cellType: 'textarea', field: 'validatedRootCause' },
  { key: 'plannedAction', label: 'Accion planificada', group: 'ejecucion', width: 180, editable: true, cellType: 'textarea', field: 'plannedAction' },
  { key: 'expectedResult', label: 'Resultado esperado', group: 'ejecucion', width: 150, editable: true, cellType: 'textarea', field: 'expectedResult' },
  { key: 'requiredResources', label: 'Recursos', group: 'ejecucion', width: 120, editable: true, cellType: 'textarea', field: 'requiredResources' },
  { key: 'executorName', label: 'Responsable', group: 'ejecucion', width: 110 },
  { key: 'progressPercent', label: 'Avance %', group: 'ejecucion', width: 70, editable: true, cellType: 'number', min: 0, max: 100, field: 'progressPercent' },
  { key: 'actualEndDate', label: 'F. real fin.', group: 'ejecucion', width: 90, editable: true, cellType: 'date', field: 'actualEndDate' },
  { key: 'effectivenessCheckDate', label: 'F. verif. efic.', group: 'verificacion', width: 90, editable: true, cellType: 'date', field: 'effectivenessCheckDate' },
  { key: 'effectivenessMethod', label: 'Metodo verif.', group: 'verificacion', width: 130, editable: true, cellType: 'textarea', field: 'effectivenessMethod' },
  { key: 'effectivenessResult', label: 'Resultado verif.', group: 'verificacion', width: 150, editable: true, cellType: 'textarea', field: 'effectivenessResult' },
  { key: 'effectiveness', label: 'Eficaz?', group: 'verificacion', width: 100, editable: true, cellType: 'select', options: EFF_OPTS, field: 'effectiveness' },
  { key: 'createdAt', label: 'Creado', group: 'control', width: 90 },
  { key: 'updatedAt', label: 'Modificado', group: 'control', width: 90 },
  { key: 'actions', label: '', group: 'control', width: 60 },
];

const GROUP_LABELS: Record<string, string> = {
  general: 'Datos generales', analisis: 'Analisis', ejecucion: 'Ejecucion',
  verificacion: 'Verificacion', control: 'Control',
};
const GROUP_COLORS: Record<string, string> = {
  general: 'bg-neutral-50', analisis: 'bg-blue-50/40', ejecucion: 'bg-amber-50/40',
  verificacion: 'bg-green-50/40', control: 'bg-purple-50/40',
};

const NO_SORT = ['checkbox','actions','ncrCode','executorName','sequenceNumber','code'];

// ── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: { label: string; value: number|string; sub?: string; color: string }) {
  return (
    <div className={`rounded-xl border p-3 ${color}`}>
      <p className="text-xs font-medium opacity-70">{label}</p>
      <p className="text-xl font-bold mt-0.5">{value}</p>
      {sub && <p className="text-[10px] opacity-60 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Detail Modal ─────────────────────────────────────────────────────────────

function DetailModal({ plan, onClose }: { plan: ActionPlan; onClose: () => void; }) {
  const [logs, setLogs] = useState<any[]>([]);
  const [tab, setTab] = useState<'info'|'log'>('info');

  useEffect(() => {
    apiFetch<{ logs: any[] }>(`/action-plans/${plan.id}/logs`).then(r => setLogs(r.logs ?? [])).catch(() => {});
  }, [plan.id]);

  const stCfg = STATUS_CFG[plan.status] ?? STATUS_CFG.DRAFT;
  const light = trafficLight(plan);

  const field = (label: string, val: string|null|undefined) => (
    <div>
      <p className="text-xs text-neutral-500 font-medium">{label}</p>
      <p className="text-sm text-neutral-800 mt-0.5 whitespace-pre-wrap">{val || DASH}</p>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto py-6 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl">
        <div className="flex items-start justify-between p-5 border-b border-neutral-100">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded">{plan.code || 'Sin codigo'}</span>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-medium ${stCfg.bg} ${stCfg.color}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${stCfg.dot}`} />{stCfg.label}
              </span>
              {light && <span className={`w-3 h-3 rounded-full ${light === 'red' ? 'bg-red-500' : light === 'amber' ? 'bg-amber-400' : 'bg-green-500'}`} />}
            </div>
            <h2 className="mt-2 text-lg font-semibold text-neutral-900">{plan.findingDescription?.slice(0,80) || '(Sin descripcion)'}</h2>
            {plan.ncr && <p className="text-xs text-neutral-500 mt-1">NCR: <span className="font-mono font-medium">{plan.ncr.code}</span> - {plan.ncr.title?.slice(0,60)}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-neutral-100"><X className="w-4 h-4 text-neutral-500" /></button>
        </div>

        <div className="border-b border-neutral-100">
          <nav className="flex gap-0 px-5">
            {(['info','log'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} className={`px-4 py-3 text-sm font-medium border-b-2 ${tab === t ? 'border-blue-600 text-blue-700' : 'border-transparent text-neutral-500 hover:text-neutral-800'}`}>
                {t === 'info' ? 'Informacion' : `Bitacora (${logs.length})`}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {tab === 'info' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {field('Tipo', TYPE_LABELS[plan.type])}
              {field('Origen', ORIGIN_LABELS[plan.origin])}
              {field('Criticidad', plan.severity)}
              {field('Sede', plan.site)} {field('Area', plan.area)} {field('Proceso', plan.process)}
              {field('Requisito', plan.requirement)}
              {field('Responsable', userName(plan.executor))}
              {field('Supervisor', userName(plan.supervisor))}
              {field('Fecha apertura', fmt(plan.openedAt))}
              {field('F. inicio prev.', fmt(plan.plannedStartDate))}
              {field('F. cierre prev.', fmt(plan.plannedEndDate))}
              {field('F. real fin.', fmt(plan.actualEndDate))}
              {field('Avance', `${plan.progressPercent}%`)}
              <div className="md:col-span-3">{field('Descripcion', plan.findingDescription)}</div>
              {field('Correccion inmediata', plan.immediateCorrection)}
              {field('Analisis causa raiz', plan.rootCauseAnalysis)}
              {field('Metodologia', plan.analysisMethod ? METHOD_LABELS[plan.analysisMethod] : null)}
              {field('Causa raiz validada', plan.validatedRootCause)}
              {field('Accion planificada', plan.plannedAction)}
              {field('Resultado esperado', plan.expectedResult)}
              {field('Recursos', plan.requiredResources)}
              {field('Metodo verif.', plan.effectivenessMethod)}
              {field('Resultado verif.', plan.effectivenessResult)}
              {field('Eficacia', EFF_LABELS[plan.effectiveness])}
              {field('F. verif. efic.', fmt(plan.effectivenessCheckDate))}
              {field('Observaciones', plan.observations)}
            </div>
          )}
          {tab === 'log' && (
            <div className="space-y-2">
              {logs.length === 0 && <p className="text-sm text-neutral-400 italic">Sin registros en bitacora.</p>}
              {logs.map(l => (
                <div key={l.id} className="flex gap-3 text-xs text-neutral-600 border-l-2 border-neutral-200 pl-3 py-1">
                  <span className="text-neutral-400 whitespace-nowrap">{fmtDateTime(l.createdAt)}</span>
                  <span className="font-medium text-neutral-700">{l.user?.email ?? DASH}</span>
                  <span>{l.action}</span>
                  {l.field && <span className="text-neutral-400">({l.field}: {l.oldValue ?? '\u2205'} - {l.newValue ?? '\u2205'})</span>}
                  {l.note && <span className="italic text-neutral-400">{l.note}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Create Modal ─────────────────────────────────────────────────────────────

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState<Record<string, any>>({ origin: 'MANUAL', type: 'CORRECTIVE' });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await apiFetch('/action-plans', { method: 'POST', json: form });
      onCreated();
      onClose();
    } catch (e: any) { alert(e.message || 'Error al crear'); }
    setSaving(false);
  }

  const f = (key: string, label: string, type = 'text') => (
    <div>
      <label className="block text-xs font-medium text-neutral-600 mb-1">{label}</label>
      <input type={type} className="w-full text-sm border border-neutral-300 rounded-lg px-3 py-2"
        value={form[key] ?? ''} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} />
    </div>
  );
  const s = (key: string, label: string, opts: SelectOption[]) => (
    <div>
      <label className="block text-xs font-medium text-neutral-600 mb-1">{label}</label>
      <select className="w-full text-sm border border-neutral-300 rounded-lg px-3 py-2"
        value={form[key] ?? ''} onChange={e => setForm(p => ({ ...p, [key]: e.target.value || null }))}>
        <option value="">- Seleccionar -</option>
        {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
  const t = (key: string, label: string) => (
    <div>
      <label className="block text-xs font-medium text-neutral-600 mb-1">{label}</label>
      <textarea rows={3} className="w-full text-sm border border-neutral-300 rounded-lg px-3 py-2"
        value={form[key] ?? ''} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto py-8 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-semibold text-neutral-900">Nuevo Plan de Accion</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-neutral-400" /></button>
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          {s('type', 'Tipo de accion *', TYPE_OPTS)}
          {s('origin', 'Origen *', ORIGIN_OPTS)}
          {f('severity', 'Criticidad')} {f('process', 'Proceso')}
          {f('site', 'Sede')} {f('area', 'Area')}
          {f('requirement', 'Requisito relacionado')}
          {f('plannedEndDate', 'Fecha prevista cierre', 'date')}
          <div className="md:col-span-2">{t('findingDescription', 'Descripcion del hallazgo / problema *')}</div>
          <div className="md:col-span-2">{t('plannedAction', 'Accion planificada')}</div>
        </div>
        <div className="flex gap-2 justify-end p-5 border-t">
          <button onClick={onClose} className="px-4 py-2 text-sm text-neutral-500">Cancelar</button>
          <button onClick={save} disabled={saving} className="px-5 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Creando...' : 'Crear Plan de Accion'}
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
  const [showSolicitar, setShowSolicitar] = useState(false);
  const [showPortalAdmin, setShowPortalAdmin] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState<Record<string, boolean>>({});
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set());
  const [showColSelector, setShowColSelector] = useState(false);
  const [sortKey, setSortKey] = useState<string|null>(null);
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('asc');
  const [saveStatus, setSaveStatus] = useState<Record<string, 'saving'|'saved'|'error'>>({});
  const [colFilters, setColFilters] = useState<Record<string, Set<string>>>({});
  const [openFilterCol, setOpenFilterCol] = useState<string|null>(null);
  const saveTimers = useRef<Record<string, NodeJS.Timeout>>({});

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

  const reloadStats = useCallback(async () => {
    try {
      const sr = await apiFetch<{ stats: APStats }>('/action-plans/stats');
      setStats(sr.stats ?? null);
    } catch {}
  }, []);

  const filtered = useMemo(() => {
    let result = plans.filter(p => {
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
    // Apply per-column filters
    for (const [colKey, selectedValues] of Object.entries(colFilters)) {
      if (selectedValues.size === 0) continue;
      result = result.filter(p => {
        let val: string;
        if (colKey === 'ncrCode') val = p.ncr?.code ?? '';
        else if (colKey === 'executorName') val = p.executorNameText || (p.executor ? (p.executor.firstName ? `${p.executor.firstName} ${p.executor.lastName ?? ''}`.trim() : p.executor.email) : '');
        else if (colKey === 'status') val = STATUS_CFG[p.status]?.label ?? p.status;
        else if (colKey === 'type') val = TYPE_LABELS[p.type] ?? '';
        else if (colKey === 'origin') val = ORIGIN_LABELS[p.origin] ?? '';
        else if (colKey === 'analysisMethod') val = p.analysisMethod ? METHOD_LABELS[p.analysisMethod] : '';
        else if (colKey === 'effectiveness') val = EFF_LABELS[p.effectiveness] ?? '';
        else if (colKey === 'progressPercent') val = String(p.progressPercent);
        else if (colKey === 'sequenceNumber') val = String(p.sequenceNumber ?? '');
        else val = String((p as any)[colKey] ?? '');
        return selectedValues.has(val);
      });
    }
    if (sortKey) {
      result = [...result].sort((a, b) => {
        const av = (a as any)[sortKey] ?? '';
        const bv = (b as any)[sortKey] ?? '';
        if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av;
        return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
      });
    }
    return result;
  }, [plans, search, filterStatus, filterOrigin, filterType, sortKey, sortDir, colFilters]);

  const visibleCols = COLUMNS.filter(c => !hiddenCols.has(c.key));

  const patchPlan = useCallback(async (id: string, patch: Record<string, any>) => {
    setSaveStatus(s => ({ ...s, [id]: 'saving' }));
    try {
      const res = await apiFetch<{ plan: ActionPlan }>(`/action-plans/${id}`, { method: 'PATCH', json: patch });
      setPlans(prev => prev.map(p => p.id === id ? { ...p, ...res.plan } : p));
      setSaveStatus(s => ({ ...s, [id]: 'saved' }));
      void reloadStats();
      if (saveTimers.current[id]) clearTimeout(saveTimers.current[id]);
      saveTimers.current[id] = setTimeout(() => {
        setSaveStatus(s => { const ns = { ...s }; delete ns[id]; return ns; });
      }, 2000);
    } catch {
      setSaveStatus(s => ({ ...s, [id]: 'error' }));
    }
  }, [reloadStats]);

  const handleCellSave = useCallback((plan: ActionPlan, field: string, value: string) => {
    const patch: Record<string, any> = {};
    if (field === 'progressPercent') {
      patch[field] = Math.max(0, Math.min(100, Number(value) || 0));
    } else if (['plannedStartDate','plannedEndDate','actualEndDate','effectivenessCheckDate'].includes(field)) {
      patch[field] = value || null;
    } else {
      patch[field] = value || null;
    }
    return patchPlan(plan.id, patch);
  }, [patchPlan]);

  async function aiFill(planId: string, field: string) {
    const key = `${planId}-${field}`;
    setAiLoading(s => ({ ...s, [key]: true }));
    try {
      const res = await apiFetch<{ field: string; value: string }>(`/action-plans/${planId}/ai-fill`, { method: 'POST', json: { field } });
      setPlans(prev => prev.map(p => p.id === planId ? { ...p, [field]: res.value } : p));
    } catch (e: any) { alert(e.message || 'Error al generar con IA'); }
    setAiLoading(s => { const ns = { ...s }; delete ns[key]; return ns; });
  }

  function toggleSelect(id: string) {
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  }

  function toggleSort(key: string) {
    if (sortKey === key) { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); }
    else { setSortKey(key); setSortDir('asc'); }
  }

  function toggleColumn(key: string) {
    setHiddenCols(prev => { const ns = new Set(prev); if (ns.has(key)) ns.delete(key); else ns.add(key); return ns; });
  }

  function getUniqueValues(colKey: string): string[] {
    const vals = new Set<string>();
    for (const p of plans) {
      let val: string;
      if (colKey === 'ncrCode') val = p.ncr?.code ?? '(vacio)';
      else if (colKey === 'executorName') val = p.executorNameText || (p.executor ? (p.executor.firstName ? `${p.executor.firstName} ${p.executor.lastName ?? ''}`.trim() : p.executor.email) : '') || '(vacio)';
      else if (colKey === 'status') val = STATUS_CFG[p.status]?.label ?? p.status;
      else if (colKey === 'type') val = TYPE_LABELS[p.type] ?? '';
      else if (colKey === 'origin') val = ORIGIN_LABELS[p.origin] ?? '';
      else if (colKey === 'analysisMethod') val = p.analysisMethod ? METHOD_LABELS[p.analysisMethod] : '(vacio)';
      else if (colKey === 'effectiveness') val = EFF_LABELS[p.effectiveness] ?? '';
      else if (colKey === 'progressPercent') val = String(p.progressPercent);
      else if (colKey === 'sequenceNumber') val = String(p.sequenceNumber ?? '');
      else if (['createdAt','updatedAt'].includes(colKey)) val = fmt((p as any)[colKey]);
      else if (['plannedStartDate','plannedEndDate','actualEndDate','effectivenessCheckDate'].includes(colKey)) val = fmt((p as any)[colKey]);
      else val = String((p as any)[colKey] ?? '(vacio)');
      if (!val || val === 'null' || val === 'undefined') val = '(vacio)';
      vals.add(val);
    }
    return Array.from(vals).sort((a, b) => a.localeCompare(b));
  }

  function toggleColFilter(colKey: string, value: string) {
    setColFilters(prev => {
      const ns = { ...prev };
      const cur = new Set(ns[colKey] ?? []);
      if (cur.has(value)) cur.delete(value); else cur.add(value);
      ns[colKey] = cur;
      return ns;
    });
  }

  function clearColFilter(colKey: string) {
    setColFilters(prev => { const ns = { ...prev }; delete ns[colKey]; return ns; });
  }

  const FILTERABLE_COLS = COLUMNS.filter(c => !['checkbox','actions'].includes(c.key)).map(c => c.key);

  // ── Export HTML ────────────────────────────────────────────────────────────

  const bodyHtml = buildFullDocument([{
    title: 'Planes de Accion',
    html: buildTableHtml(
      visibleCols.filter(c => c.key !== 'checkbox' && c.key !== 'actions').map(c => ({ key: c.key, label: c.label, width: `${c.width}px` })),
      filtered.map(p => {
        const row: Record<string, any> = {};
        for (const c of visibleCols) {
          if (c.key === 'checkbox' || c.key === 'actions') continue;
          if (c.key === 'sequenceNumber') row[c.key] = p.sequenceNumber ?? DASH;
          else if (c.key === 'ncrCode') row[c.key] = p.ncr?.code ?? DASH;
          else if (c.key === 'executorName') row[c.key] = userName(p.executor, p.executorNameText);
          else if (c.key === 'status') row[c.key] = STATUS_CFG[p.status]?.label ?? p.status;
          else if (c.key === 'type') row[c.key] = TYPE_LABELS[p.type];
          else if (c.key === 'origin') row[c.key] = ORIGIN_LABELS[p.origin];
          else if (c.key === 'analysisMethod') row[c.key] = p.analysisMethod ? METHOD_LABELS[p.analysisMethod] : DASH;
          else if (c.key === 'effectiveness') row[c.key] = EFF_LABELS[p.effectiveness];
          else if (c.key === 'progressPercent') row[c.key] = `${p.progressPercent}%`;
          else if (['plannedStartDate','plannedEndDate','actualEndDate','effectivenessCheckDate','createdAt','updatedAt'].includes(c.key)) row[c.key] = fmt(p[c.key as keyof ActionPlan] as string);
          else row[c.key] = p[c.key as keyof ActionPlan] ?? DASH;
        }
        return row;
      })
    ),
  }]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Plan de Accion</h1>
          <p className="text-sm text-neutral-500 mt-0.5">Matriz completa - ISO 9001/14001/45001/19011</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ExportButton outputKey="calidad.plan-accion.list" title="Matriz de Planes de Acción" moduleName="calidad" bodyHtml={bodyHtml} recordCount={filtered.length} showDocCode={true} docCodeType="MATRIX" />
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4" /> Nuevo Plan
          </button>
          <button
            onClick={() => setShowSolicitar(true)}
            disabled={selected.length === 0}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" /> Solicitar actualización
          </button>
          <button
            onClick={() => setShowPortalAdmin(v => !v)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${showPortalAdmin ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            <Eye className="w-4 h-4" /> Portal externo
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="Total" value={stats.total} color="border-neutral-200 text-neutral-800" />
          <StatCard label="Abiertos" value={stats.byStatus.OPEN ?? 0} color="border-blue-200 bg-blue-50 text-blue-800" />
          <StatCard label="En ejecucion" value={stats.byStatus.IN_EXECUTION ?? 0} color="border-indigo-200 bg-indigo-50 text-indigo-800" />
          <StatCard label="Vencidos" value={stats.overdue} color="border-red-200 bg-red-50 text-red-800" />
          <StatCard label="Pend. eficacia" value={stats.pendingEffectiveness} color="border-cyan-200 bg-cyan-50 text-cyan-800" />
          <StatCard label="Cerrados" value={stats.byStatus.CLOSED ?? 0} sub={`${stats.avgCloseDays}d prom.`} color="border-green-200 bg-green-50 text-green-800" />
        </div>
      )}

      {/* Filters + actions bar */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input className="w-full pl-9 pr-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:border-blue-400"
            placeholder="Buscar por codigo, NCR, descripcion, proceso..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="text-sm border border-neutral-200 rounded-lg px-3 py-2 bg-white">
          <option value="ALL">Todos los estados</option>
          {Object.entries(STATUS_CFG).map(([v,c]) => <option key={v} value={v}>{c.label}</option>)}
        </select>
        <select value={filterOrigin} onChange={e => setFilterOrigin(e.target.value)} className="text-sm border border-neutral-200 rounded-lg px-3 py-2 bg-white">
          <option value="ALL">Todos los origenes</option>
          {ORIGIN_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="text-sm border border-neutral-200 rounded-lg px-3 py-2 bg-white">
          <option value="ALL">Todos los tipos</option>
          {TYPE_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        {/* Column selector */}
        <div className="relative">
          <button onClick={() => setShowColSelector(!showColSelector)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-neutral-200 rounded-lg bg-white hover:bg-neutral-50">
            <Columns3 className="w-4 h-4" /> Columnas
          </button>
          {showColSelector && (
            <div className="absolute right-0 mt-1 w-64 bg-white rounded-lg shadow-xl border border-neutral-200 z-50 max-h-80 overflow-y-auto">
              <div className="p-2">
                {Object.entries(GROUP_LABELS).map(([gk, gl]) => (
                  <div key={gk}>
                    <p className="text-[10px] font-bold text-neutral-400 uppercase px-2 pt-2 pb-1">{gl}</p>
                    {COLUMNS.filter(c => c.group === gk && c.key !== 'checkbox' && c.key !== 'actions').map(c => (
                      <label key={c.key} className="flex items-center gap-2 px-2 py-1 hover:bg-neutral-50 rounded cursor-pointer">
                        <input type="checkbox" checked={!hiddenCols.has(c.key)} onChange={() => toggleColumn(c.key)} className="rounded border-neutral-300" />
                        <span className="text-xs text-neutral-700">{c.label}</span>
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Save status indicators */}
      {Object.entries(saveStatus).length > 0 && (
        <div className="flex items-center gap-3 text-xs">
          {Object.entries(saveStatus).map(([id, status]) => {
            const plan = plans.find(p => p.id === id);
            if (!plan) return null;
            return (
              <span key={id} className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${status === 'saving' ? 'bg-blue-50 text-blue-700' : status === 'saved' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {status === 'saving' && <Loader2 className="w-3 h-3 animate-spin" />}
                {status === 'saved' && <Check className="w-3 h-3" />}
                {status === 'error' && <AlertCircle className="w-3 h-3" />}
                {plan.code ?? 'sin codigo'}: {status === 'saving' ? 'guardando...' : status === 'saved' ? 'guardado' : 'error'}
              </span>
            );
          })}
        </div>
      )}

      {/* Matrix table */}
      {loading ? (
        <div className="flex items-center justify-center h-48"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-neutral-400">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No hay planes de accion que coincidan con los filtros.</p>
          <button onClick={() => setShowCreate(true)} className="mt-3 text-blue-600 text-sm hover:underline">Crear el primero</button>
        </div>
      ) : (
        <div className="rounded-xl border border-neutral-200 overflow-hidden" onClick={() => openFilterCol && setOpenFilterCol(null)}>
          <div className="overflow-x-auto" style={{ maxHeight: '70vh' }}>
            <table className="border-collapse text-xs">
              <thead className="sticky top-0 z-20">
                {/* Group header row */}
                <tr>
                  {(() => {
                    let off = 0;
                    return visibleCols.map((col, i) => {
                      const prevCol = i > 0 ? visibleCols[i - 1] : null;
                      const groupCols = visibleCols.filter(c => c.group === col.group);
                      const groupStartIdx = visibleCols.findIndex(c => c.group === col.group);
                      const isGroupStart = visibleCols[groupStartIdx]?.key === col.key;
                      const stickyStyle = col.sticky ? { position: 'sticky' as const, left: off, zIndex: 25 } : {};
                      if (col.sticky) off += col.width;
                      if (!isGroupStart) {
                        return <th key={`gh-${col.key}`} style={{ ...stickyStyle, minWidth: col.width, width: col.width }} className={`border-b border-neutral-200 ${GROUP_COLORS[col.group]}`} />;
                      }
                      return (
                        <th key={`gh-${col.key}`} colSpan={groupCols.length}
                          style={{ ...stickyStyle, minWidth: groupCols.reduce((a, c) => a + c.width, 0), zIndex: 25 }}
                          className={`border-b border-r border-neutral-200 ${GROUP_COLORS[col.group]} px-2 py-1 text-[10px] font-bold text-neutral-500 uppercase tracking-wide text-left`}>
                          {GROUP_LABELS[col.group]}
                        </th>
                      );
                    });
                  })()}
                </tr>
                {/* Column header row */}
                <tr>
                  {(() => {
                    let off = 0;
                    return visibleCols.map(col => {
                      const stickyStyle = col.sticky ? { position: 'sticky' as const, left: off, zIndex: 26, background: 'white' as const } : {};
                      if (col.sticky) off += col.width;
                      const canSort = !NO_SORT.includes(col.key);
                      const canFilter = FILTERABLE_COLS.includes(col.key);
                      const hasFilter = colFilters[col.key] && colFilters[col.key].size > 0;
                      const uniqueVals = openFilterCol === col.key ? getUniqueValues(col.key) : [];
                      return (
                        <th key={col.key}
                          style={{ ...stickyStyle, minWidth: col.width, width: col.width }}
                          className={`border-b border-r border-neutral-200 px-2 py-2 text-left font-medium text-neutral-700 bg-neutral-50 ${col.sticky ? 'shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]' : ''} relative`}>
                          <div className="flex items-center gap-1">
                            <span className="truncate cursor-pointer" onClick={() => canSort && toggleSort(col.key)}>
                              {col.label}
                            </span>
                            {canSort && sortKey === col.key && (sortDir === 'asc' ? <ChevronUp className="w-3 h-3 shrink-0" /> : <ChevronDown className="w-3 h-3 shrink-0" />)}
                            {canFilter && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setOpenFilterCol(openFilterCol === col.key ? null : col.key); }}
                                className={`shrink-0 p-0.5 rounded hover:bg-neutral-200 ${hasFilter ? 'text-blue-600' : 'text-neutral-400'}`}
                                title="Filtrar columna"
                              >
                                <Filter className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                          {openFilterCol === col.key && (
                            <div onClick={(e) => e.stopPropagation()} className="absolute top-full left-0 mt-0.5 bg-white rounded-lg shadow-xl border border-neutral-200 z-50 max-h-60 overflow-y-auto w-56">
                              <div className="sticky top-0 bg-white border-b border-neutral-100 px-2 py-1.5 flex items-center justify-between">
                                <span className="text-[10px] font-bold text-neutral-500 uppercase">Filtrar</span>
                                <div className="flex gap-1">
                                  {hasFilter && (
                                    <button onClick={() => clearColFilter(col.key)} className="text-[10px] text-red-500 hover:underline">Limpiar</button>
                                  )}
                                  <button onClick={() => setOpenFilterCol(null)} className="text-neutral-400 hover:text-neutral-600"><X className="w-3 h-3" /></button>
                                </div>
                              </div>
                              <div className="p-1">
                                {uniqueVals.length === 0 && <p className="text-xs text-neutral-400 italic px-2 py-1">Sin datos</p>}
                                {uniqueVals.map(v => (
                                  <label key={v} className="flex items-center gap-2 px-2 py-1 hover:bg-neutral-50 rounded cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={colFilters[col.key]?.has(v) ?? false}
                                      onChange={() => toggleColFilter(col.key, v)}
                                      className="rounded border-neutral-300 text-blue-600"
                                    />
                                    <span className="text-xs text-neutral-700 truncate">{v}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}
                        </th>
                      );
                    });
                  })()}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filtered.map((plan, rowIdx) => {
                  const light = trafficLight(plan);
                  const stCfg = STATUS_CFG[plan.status] ?? STATUS_CFG.DRAFT;
                  const rowSaveStatus = saveStatus[plan.id];
                  const isReadOnly = ['CLOSED','CANCELLED'].includes(plan.status);
                  return (
                    <tr key={plan.id} className={`hover:bg-blue-50/30 transition-colors ${rowIdx % 2 === 1 ? 'bg-neutral-50/30' : ''} ${rowSaveStatus === 'error' ? 'ring-1 ring-inset ring-red-200' : ''}`}>
                      {(() => {
                        let off = 0;
                        return visibleCols.map(col => {
                          const stickyStyle = col.sticky ? { position: 'sticky' as const, left: off, zIndex: 10, background: rowIdx % 2 === 1 ? '#fafafa' as const : 'white' as const } : {};
                          if (col.sticky) off += col.width;
                          const groupBg = col.group === 'analisis' ? 'bg-blue-50/10' : col.group === 'ejecucion' ? 'bg-amber-50/10' : col.group === 'verificacion' ? 'bg-green-50/10' : '';
                          return (
                            <td key={col.key}
                              style={{ ...stickyStyle, minWidth: col.width, width: col.width }}
                              className={`border-r border-neutral-100 px-1.5 py-1.5 align-top ${col.sticky ? 'shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]' : ''} ${groupBg}`}>
                              {col.key === 'checkbox' && (
                                <div className="flex items-center justify-center">
                                  <input type="checkbox" checked={selected.includes(plan.id)} onChange={() => toggleSelect(plan.id)} className="rounded border-neutral-300" />
                                </div>
                              )}
                              {col.key === 'sequenceNumber' && (
                                <span className="font-mono text-xs text-neutral-500 font-medium text-center block">{plan.sequenceNumber ?? DASH}</span>
                              )}
                              {col.key === 'ncrCode' && <span className="font-mono text-xs text-neutral-500">{plan.ncr?.code ?? DASH}</span>}
                              {col.key === 'executorName' && <span className="text-xs text-neutral-600 truncate" title={userName(plan.executor, plan.executorNameText)}>{userName(plan.executor, plan.executorNameText)}</span>}
                              {col.key === 'createdAt' && <span className="text-xs text-neutral-400 whitespace-nowrap">{fmt(plan.createdAt)}</span>}
                              {col.key === 'updatedAt' && <span className="text-xs text-neutral-400 whitespace-nowrap">{fmt(plan.updatedAt)}</span>}
                              {col.key === 'actions' && (
                                <div className="flex items-center gap-1">
                                  <button onClick={() => setSelectedPlan(plan)} className="p-1 rounded hover:bg-blue-100 text-blue-600" title="Ver detalle">
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                  {plan._count?.logs ? (
                                    <span className="text-[10px] text-neutral-400 flex items-center gap-0.5" title={`${plan._count.logs} registros`}>
                                      <History className="w-3 h-3" />{plan._count.logs}
                                    </span>
                                  ) : null}
                                </div>
                              )}
                              {/* Editable cells (text, textarea, date, number) */}
                              {col.editable && col.field && !['status','type','origin','analysisMethod','effectiveness','progressPercent'].includes(col.key) && (
                                <div className="flex items-start gap-1">
                                  <div className="flex-1 min-w-0">
                                    <InlineCell
                                      value={col.cellType === 'date' ? toDateInput(plan[col.field as keyof ActionPlan] as string) : plan[col.field as keyof ActionPlan] as any}
                                      type={col.cellType as any}
                                      options={col.options}
                                      editable={!isReadOnly}
                                      displayValue={col.cellType === 'date' ? fmt(plan[col.field as keyof ActionPlan] as string) : String(plan[col.field as keyof ActionPlan] ?? '')}
                                      onSave={(v) => handleCellSave(plan, col.field!, v)}
                                    />
                                  </div>
                                  {AI_FIELDS.includes(col.key) && !isReadOnly && (
                                    <button
                                      onClick={() => aiFill(plan.id, col.key)}
                                      disabled={aiLoading[`${plan.id}-${col.key}`]}
                                      className="shrink-0 p-0.5 rounded text-purple-600 hover:bg-purple-100 disabled:opacity-40"
                                      title="Completar con IA"
                                    >
                                      {aiLoading[`${plan.id}-${col.key}`] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                                    </button>
                                  )}
                                </div>
                              )}
                              {/* Editable select cells */}
                              {col.editable && col.field && ['status','type','origin','analysisMethod','effectiveness'].includes(col.key) && (
                                <InlineCell
                                  value={plan[col.field as keyof ActionPlan] as any}
                                  type="select"
                                  options={col.options}
                                  editable={!isReadOnly}
                                  displayValue={
                                    col.key === 'status' ? stCfg.label :
                                    col.key === 'type' ? TYPE_LABELS[plan.type] :
                                    col.key === 'origin' ? ORIGIN_LABELS[plan.origin] :
                                    col.key === 'analysisMethod' ? (plan.analysisMethod ? METHOD_LABELS[plan.analysisMethod] : DASH) :
                                    EFF_LABELS[plan.effectiveness]
                                  }
                                  onSave={(v) => handleCellSave(plan, col.field!, v)}
                                />
                              )}
                              {/* Editable progress */}
                              {col.key === 'progressPercent' && col.editable && (
                                <InlineCell
                                  value={plan.progressPercent}
                                  type="number"
                                  min={0}
                                  max={100}
                                  editable={!isReadOnly}
                                  displayValue={`${plan.progressPercent}%`}
                                  onSave={(v) => handleCellSave(plan, 'progressPercent', v)}
                                />
                              )}
                            </td>
                          );
                        });
                      })()}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Result count */}
      {!loading && filtered.length > 0 && (
        <p className="text-xs text-neutral-400 text-center">{filtered.length} plan(es) de accion</p>
      )}

      {/* Modals */}
      {selectedPlan && <DetailModal plan={selectedPlan} onClose={() => setSelectedPlan(null)} />}
      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onCreated={load} />}
      <SolicitarActualizacionModal
        open={showSolicitar}
        onClose={() => setShowSolicitar(false)}
        selectedPlanIds={selected}
      />
      {showPortalAdmin && <PortalAdminPanel />}
    </div>
  );
}
