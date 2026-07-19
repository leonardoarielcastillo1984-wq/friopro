'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch, getTenantId, getCsrfToken } from '@/lib/api';
import {
  CalendarClock, LayoutDashboard, ClipboardList, CalendarDays, Users2, ShieldCheck,
  Wallet, BarChart3, Settings, Plus, Check, X, Ban, RotateCcw, AlertTriangle, Loader2,
  ChevronRight, History, Pencil, Trash2, Printer,
} from 'lucide-react';

/* ─────────── Tipos ─────────── */
interface AbsenceType {
  id: string; code: string; name: string; color?: string; active: boolean;
  requiresBalance: boolean; deductsBalance: boolean; requiresDocumentation: boolean;
  requiresApproval: boolean; allowsSelfService: boolean; countingMode: string;
  allowsHalfDay: boolean; allowsRetroactive: boolean; requiresSubstitute: boolean;
  requiresCoverage: boolean; sensitiveData: boolean; approvalRule?: string;
  minAdvanceDays?: number | null; maxDurationDays?: number | null;
}
interface Employee { id: string; firstName: string; lastName: string; status?: string; }
interface Balance {
  id: string; employeeId: string; absenceTypeId: string; period: string;
  assignedDays: number; carriedDays: number; accruedDays: number; usedDays: number;
  reservedDays: number; pendingDays: number; adjustmentPositive: number; adjustmentNegative: number;
  status: string; notes?: string; absenceType?: AbsenceType;
  employee?: Employee | null; _available?: number; _credited?: number; _committed?: number;
}
interface AbsenceRequest {
  id: string; code?: string; employeeId: string; absenceTypeId: string;
  startDate: string; endDate: string; halfDay: boolean; computedDays: number;
  countingMode: string; reason?: string; notes?: string; status: string;
  substituteEmployeeId?: string | null; origin: string; createdByHr: boolean;
  absenceType?: AbsenceType; employee?: Employee | null; substitute?: Employee | null;
  approvals?: any[]; attachments?: any[];
}
interface Dashboard {
  year: number; pending: number; absentToday: number; upcoming: number;
  approvedPeriod: number; rejectedPeriod: number; criticalCoverage: number;
  withoutSubstitute: number; pendingVacationDays: number; absenteeismIndex: number;
  overdue: number; activeEmployees: number; alerts: { level: string; message: string }[];
}

/* ─────────── Config UI ─────────── */
const TABS = [
  { id: 'resumen', label: 'Resumen', icon: LayoutDashboard },
  { id: 'solicitudes', label: 'Solicitudes', icon: ClipboardList },
  { id: 'calendario', label: 'Calendario', icon: CalendarDays },
  { id: 'disponibilidad', label: 'Disponibilidad', icon: Users2 },
  { id: 'cobertura', label: 'Cobertura', icon: ShieldCheck },
  { id: 'saldos', label: 'Saldos', icon: Wallet },
  { id: 'indicadores', label: 'Indicadores', icon: BarChart3 },
  { id: 'config', label: 'Configuración', icon: Settings },
];

const STATUS: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: 'Borrador', cls: 'bg-gray-100 text-gray-700' },
  SUBMITTED: { label: 'Enviada', cls: 'bg-blue-100 text-blue-700' },
  PENDING_APPROVAL: { label: 'Pendiente', cls: 'bg-amber-100 text-amber-800' },
  PENDING_DOCS: { label: 'Falta doc.', cls: 'bg-orange-100 text-orange-800' },
  PENDING_COVERAGE: { label: 'Falta cobertura', cls: 'bg-orange-100 text-orange-800' },
  APPROVED: { label: 'Aprobada', cls: 'bg-green-100 text-green-700' },
  REJECTED: { label: 'Rechazada', cls: 'bg-red-100 text-red-700' },
  CANCELLED: { label: 'Cancelada', cls: 'bg-gray-100 text-gray-500' },
  IN_PROGRESS: { label: 'En curso', cls: 'bg-indigo-100 text-indigo-700' },
  FINISHED: { label: 'Finalizada', cls: 'bg-slate-200 text-slate-700' },
};

const inputCls = 'h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400';
const fmt = (d?: string) => (d ? new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—');
const empName = (e?: Employee | null) => (e ? `${e.firstName} ${e.lastName}` : '—');

async function downloadFile(path: string, filename: string) {
  const headers: Record<string, string> = {};
  if (typeof window !== 'undefined') {
    const token = window.localStorage.getItem('accessToken');
    if (token) headers['authorization'] = `Bearer ${token}`;
  }
  const tid = getTenantId(); if (tid) headers['x-tenant-id'] = tid;
  const res = await fetch(`/api${path}`, { headers, credentials: 'include' });
  if (!res.ok) { alert('No se pudo descargar el archivo'); return; }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

async function uploadFile(path: string, file: File, fields: Record<string, string> = {}) {
  const headers: Record<string, string> = {};
  if (typeof window !== 'undefined') {
    const token = window.localStorage.getItem('accessToken');
    if (token) headers['authorization'] = `Bearer ${token}`;
  }
  const tid = getTenantId(); if (tid) headers['x-tenant-id'] = tid;
  const csrf = getCsrfToken(); if (csrf) headers['x-csrf-token'] = csrf;
  const fd = new FormData(); fd.append('file', file);
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  const res = await fetch(`/api${path}`, { method: 'POST', headers, credentials: 'include', body: fd });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as any)?.error || 'Error en la importación');
  return json;
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS[status] || { label: status, cls: 'bg-gray-100 text-gray-700' };
  return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>{s.label}</span>;
}

/* ─────────── Página ─────────── */
export default function AusenciasPage() {
  const [tab, setTab] = useState('resumen');
  const [types, setTypes] = useState<AbsenceType[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const t = new URLSearchParams(window.location.search).get('tab');
      if (t && TABS.some((x) => x.id === t)) setTab(t);
    }
  }, []);

  const loadTypes = useCallback(async () => {
    try { const r = await apiFetch<{ items: AbsenceType[] }>('/absences/types'); setTypes(r?.items ?? []); } catch { setTypes([]); }
  }, []);
  const loadEmployees = useCallback(async () => {
    try { const r = await apiFetch<{ employees: Employee[] }>('/hr/employees'); setEmployees(r?.employees ?? []); } catch { setEmployees([]); }
  }, []);

  useEffect(() => { loadTypes(); loadEmployees(); }, [loadTypes, loadEmployees]);

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500 rounded-lg"><CalendarClock className="w-6 h-6 text-white" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Ausencias y Disponibilidad</h1>
            <p className="text-sm text-gray-500">Gestión de vacaciones, licencias y continuidad operativa</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6 overflow-x-auto">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                tab === t.id ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'resumen' && <ResumenTab />}
      {tab === 'solicitudes' && <SolicitudesTab types={types} employees={employees} />}
      {tab === 'calendario' && <CalendarioTab />}
      {tab === 'disponibilidad' && <DisponibilidadTab />}
      {tab === 'cobertura' && <CoberturaTab employees={employees} />}
      {tab === 'saldos' && <SaldosTab types={types} employees={employees} />}
      {tab === 'indicadores' && <IndicadoresTab />}
      {tab === 'config' && <ConfigTab types={types} reloadTypes={loadTypes} />}
    </div>
  );
}

/* ─────────── Resumen ─────────── */
function ResumenTab() {
  const [d, setD] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try { setD(await apiFetch<Dashboard>('/absences/dashboard')); } catch { /* noop */ } finally { setLoading(false); }
    })();
  }, []);
  if (loading) return <Spinner />;
  if (!d) return <Empty note="No se pudo cargar el resumen." />;

  const cards = [
    { label: 'Solicitudes pendientes', value: d.pending, color: 'text-amber-600' },
    { label: 'Ausentes hoy', value: d.absentToday, color: 'text-indigo-600' },
    { label: 'Próximas (30 días)', value: d.upcoming, color: 'text-blue-600' },
    { label: 'Aprobadas (período)', value: d.approvedPeriod, color: 'text-green-600' },
    { label: 'Rechazadas (período)', value: d.rejectedPeriod, color: 'text-red-600' },
    { label: 'Cobertura crítica', value: d.criticalCoverage, color: 'text-rose-600' },
    { label: 'Sin sustituto', value: d.withoutSubstitute, color: 'text-orange-600' },
    { label: 'Días pend. vacaciones', value: d.pendingVacationDays, color: 'text-teal-600' },
    { label: 'Índice ausentismo', value: `${d.absenteeismIndex}%`, color: 'text-purple-600' },
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-white p-4 rounded-lg border border-gray-200">
            <p className="text-xs text-gray-500">{c.label}</p>
            <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>
      {d.alerts?.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-700">Alertas operativas</h3>
          {d.alerts.map((a, i) => (
            <div key={i} className={`flex items-center gap-2 p-3 rounded-lg text-sm border ${
              a.level === 'error' ? 'bg-red-50 border-red-200 text-red-800'
                : a.level === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800'
                : 'bg-blue-50 border-blue-200 text-blue-800'
            }`}>
              <AlertTriangle className="w-4 h-4 shrink-0" /> {a.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────── Solicitudes ─────────── */
function SolicitudesTab({ types, employees }: { types: AbsenceType[]; employees: Employee[] }) {
  const [rows, setRows] = useState<AbsenceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<AbsenceRequest | null>(null);
  const [detail, setDetail] = useState<AbsenceRequest | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const EDITABLE = ['DRAFT', 'SUBMITTED', 'PENDING_APPROVAL', 'PENDING_DOCS', 'PENDING_COVERAGE'];
  const APPROVABLE = ['SUBMITTED', 'PENDING_APPROVAL', 'PENDING_DOCS', 'PENDING_COVERAGE'];
  const toggleSel = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const bulkApprove = async () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (!confirm(`¿Aprobar ${ids.length} solicitud(es) seleccionada(s)?`)) return;
    setBulkBusy(true);
    try {
      const r = await apiFetch<{ approved: number; failed: number }>('/absences/requests/bulk-approve', { method: 'POST', json: { ids } });
      setSelected(new Set());
      await load();
      if (r?.failed) alert(`Aprobadas: ${r.approved}. No se pudieron aprobar: ${r.failed} (revisá documentación o estado).`);
    } catch (e: any) { alert(e?.message || 'Error'); } finally { setBulkBusy(false); }
  };
  const del = async (r: AbsenceRequest) => {
    if (!confirm(`¿Eliminar la solicitud de ${empName(r.employee)} (${fmt(r.startDate)} → ${fmt(r.endDate)})? Esta acción revierte su efecto en el saldo.`)) return;
    setBusy(r.id);
    try { await apiFetch(`/absences/requests/${r.id}`, { method: 'DELETE' }); await load(); }
    catch (e: any) { alert(e?.message || 'Error'); } finally { setBusy(null); }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = statusFilter ? `?status=${statusFilter}` : '';
      const r = await apiFetch<{ items: AbsenceRequest[] }>(`/absences/requests${qs}`);
      setRows(r?.items ?? []);
    } catch { setRows([]); } finally { setLoading(false); }
  }, [statusFilter]);
  useEffect(() => { load(); }, [load]);

  const act = async (id: string, action: string) => {
    const comment = action === 'reject' ? (prompt('Motivo del rechazo (opcional):') ?? '') : '';
    setBusy(id);
    try {
      await apiFetch(`/absences/requests/${id}/${action}`, { method: 'POST', json: action === 'reject' ? { comment } : {} });
      await load();
    } catch (e: any) { alert(e?.message || 'Error'); } finally { setBusy(null); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-9 rounded-md border border-gray-300 px-3 text-sm">
          <option value="">Todos los estados</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <div className="flex gap-2">
          {selected.size > 0 && (
            <button onClick={bulkApprove} disabled={bulkBusy} className="flex items-center gap-2 text-sm bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg disabled:opacity-50">
              {bulkBusy && <Loader2 className="w-4 h-4 animate-spin" />} Aprobar {selected.size} seleccionada(s)
            </button>
          )}
          <button onClick={() => downloadFile('/absences/calendar.ics', 'ausencias.ics')} className="text-sm border border-gray-300 hover:bg-gray-50 text-gray-700 px-3 py-2 rounded-lg">iCal</button>
          <button onClick={() => downloadFile('/absences/export?type=requests', 'ausencias_solicitudes.xlsx')} className="text-sm border border-gray-300 hover:bg-gray-50 text-gray-700 px-3 py-2 rounded-lg">Exportar</button>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg">
            <Plus className="w-4 h-4" /> Registrar ausencia (RRHH)
          </button>
        </div>
      </div>

      {loading ? <Spinner /> : rows.length === 0 ? <Empty note="No hay solicitudes." /> : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-3 py-2 w-8">
                  <input type="checkbox"
                    checked={rows.filter((r) => APPROVABLE.includes(r.status)).length > 0 && rows.filter((r) => APPROVABLE.includes(r.status)).every((r) => selected.has(r.id))}
                    onChange={(e) => setSelected(e.target.checked ? new Set(rows.filter((r) => APPROVABLE.includes(r.status)).map((r) => r.id)) : new Set())}
                    title="Seleccionar aprobables" />
                </th>
                <th className="text-left px-4 py-2">Empleado</th>
                <th className="text-left px-4 py-2">Tipo</th>
                <th className="text-left px-4 py-2">Período</th>
                <th className="text-left px-4 py-2">Días</th>
                <th className="text-left px-4 py-2">Estado</th>
                <th className="text-right px-4 py-2">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => (
                <tr key={r.id} className={`hover:bg-gray-50 ${selected.has(r.id) ? 'bg-indigo-50/40' : ''}`}>
                  <td className="px-3 py-2 text-center">
                    {APPROVABLE.includes(r.status) && (
                      <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSel(r.id)} />
                    )}
                  </td>
                  <td className="px-4 py-2 font-medium text-gray-800">{empName(r.employee)}</td>
                  <td className="px-4 py-2">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: r.absenceType?.color || '#999' }} />
                      {r.absenceType?.name || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-600">{fmt(r.startDate)} → {fmt(r.endDate)}</td>
                  <td className="px-4 py-2">{r.computedDays}{r.halfDay ? ' (½)' : ''}</td>
                  <td className="px-4 py-2"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setDetail(r)} className="p-1.5 text-gray-500 hover:text-indigo-600" title="Detalle"><ChevronRight className="w-4 h-4" /></button>
                      {['PENDING_APPROVAL', 'SUBMITTED', 'PENDING_DOCS', 'PENDING_COVERAGE'].includes(r.status) && (
                        <>
                          <button disabled={busy === r.id} onClick={() => act(r.id, 'approve')} className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="Aprobar"><Check className="w-4 h-4" /></button>
                          <button disabled={busy === r.id} onClick={() => act(r.id, 'reject')} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Rechazar"><X className="w-4 h-4" /></button>
                        </>
                      )}
                      {r.status === 'APPROVED' && (
                        <button disabled={busy === r.id} onClick={() => act(r.id, 'mark-taken')} className="p-1.5 text-slate-600 hover:bg-slate-100 rounded" title="Marcar tomada"><RotateCcw className="w-4 h-4" /></button>
                      )}
                      {EDITABLE.includes(r.status) && (
                        <button disabled={busy === r.id} onClick={() => setEditing(r)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Editar"><Pencil className="w-4 h-4" /></button>
                      )}
                      {!['CANCELLED', 'REJECTED', 'FINISHED'].includes(r.status) && (
                        <button disabled={busy === r.id} onClick={() => act(r.id, 'cancel')} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded" title="Cancelar"><Ban className="w-4 h-4" /></button>
                      )}
                      <button disabled={busy === r.id} onClick={() => del(r)} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Eliminar"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && <RequestForm types={types} employees={employees} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      {editing && <RequestForm types={types} employees={employees} editing={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      {detail && <RequestDetail request={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

function RequestForm({ types, employees, editing, onClose, onSaved }: { types: AbsenceType[]; employees: Employee[]; editing?: AbsenceRequest | null; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!editing;
  const [f, setF] = useState<any>(editing ? {
    employeeId: editing.employee?.id || editing.employeeId || '',
    absenceTypeId: editing.absenceType?.id || editing.absenceTypeId || '',
    startDate: (editing.startDate || '').slice(0, 10),
    endDate: (editing.endDate || '').slice(0, 10),
    halfDay: !!editing.halfDay,
    reason: editing.reason || '',
    substituteEmployeeId: editing.substitute?.id || editing.substituteEmployeeId || '',
    createdByHr: true,
  } : { employeeId: '', absenceTypeId: '', startDate: '', endDate: '', halfDay: false, reason: '', substituteEmployeeId: '', createdByHr: true });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const selType = types.find((t) => t.id === f.absenceTypeId);

  const submit = async () => {
    setErr('');
    if (!f.employeeId || !f.absenceTypeId || !f.startDate || !f.endDate) { setErr('Completá empleado, tipo y fechas.'); return; }
    setSaving(true);
    try {
      if (isEdit && editing) {
        await apiFetch(`/absences/requests/${editing.id}`, {
          method: 'PATCH',
          json: {
            absenceTypeId: f.absenceTypeId, startDate: f.startDate, endDate: f.endDate,
            halfDay: !!f.halfDay, reason: f.reason || undefined, substituteEmployeeId: f.substituteEmployeeId || undefined,
          },
        });
      } else {
        const created = await apiFetch<{ item: { id: string } }>('/absences/requests', {
          method: 'POST',
          json: {
            employeeId: f.employeeId, absenceTypeId: f.absenceTypeId, startDate: f.startDate, endDate: f.endDate,
            halfDay: !!f.halfDay, reason: f.reason || undefined, substituteEmployeeId: f.substituteEmployeeId || undefined,
            createdByHr: true,
          },
        });
        // Enviar automáticamente a aprobación
        if (created?.item?.id) await apiFetch(`/absences/requests/${created.item.id}/submit`, { method: 'POST', json: {} });
      }
      onSaved();
    } catch (e: any) { setErr(e?.message || 'Error al guardar'); } finally { setSaving(false); }
  };

  return (
    <Modal title={isEdit ? 'Editar solicitud' : 'Registrar ausencia (RRHH)'} onClose={onClose}>
      <div className="space-y-3">
        {err && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{err}</div>}
        <Field label="Empleado *">
          <select value={f.employeeId} disabled={isEdit} onChange={(e) => setF({ ...f, employeeId: e.target.value })} className={`${inputCls} ${isEdit ? 'bg-gray-100 text-gray-500' : ''}`}>
            <option value="">Seleccionar…</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
          </select>
        </Field>
        <Field label="Tipo de ausencia *">
          <select value={f.absenceTypeId} onChange={(e) => setF({ ...f, absenceTypeId: e.target.value })} className={inputCls}>
            <option value="">Seleccionar…</option>
            {types.filter((t) => t.active).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Desde *"><input type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} className={inputCls} /></Field>
          <Field label="Hasta *"><input type="date" value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} className={inputCls} /></Field>
        </div>
        <TeamOverlapNotice employeeId={f.employeeId} from={f.startDate} to={f.endDate} />
        {selType?.allowsHalfDay && (
          <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={f.halfDay} onChange={(e) => setF({ ...f, halfDay: e.target.checked })} /> Media jornada</label>
        )}
        <Field label={`¿Quién lo reemplaza?${selType?.requiresSubstitute ? ' *' : ' (opcional)'}`}>
          <select value={f.substituteEmployeeId} onChange={(e) => setF({ ...f, substituteEmployeeId: e.target.value })} className={inputCls}>
            <option value="">Sin reemplazo</option>
            {employees.filter((e) => e.id !== f.employeeId).map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
          </select>
          <SubstituteCheck substituteEmployeeId={f.substituteEmployeeId} from={f.startDate} to={f.endDate} />
        </Field>
        <Field label="Motivo / observaciones"><textarea value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} rows={2} className={inputCls} /></Field>
        {selType && (
          <p className="text-xs text-gray-500">
            Cómputo: {selType.countingMode === 'CALENDAR' ? 'días corridos' : 'días hábiles'}
            {selType.requiresBalance ? ' · descuenta saldo' : ''}
            {selType.requiresDocumentation ? ' · requiere documentación' : ''}
          </p>
        )}
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
        <button onClick={submit} disabled={saving} className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-2">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />} {isEdit ? 'Guardar cambios' : 'Registrar y enviar'}
        </button>
      </div>
    </Modal>
  );
}

function TeamOverlapNotice({ employeeId, from, to }: { employeeId: string; from: string; to: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!employeeId || !from || !to || from > to) { setData(null); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await apiFetch<any>(`/absences/team-overlap?employeeId=${encodeURIComponent(employeeId)}&from=${from}&to=${to}`);
        if (!cancelled) setData(r);
      } catch { if (!cancelled) setData(null); } finally { if (!cancelled) setLoading(false); }
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [employeeId, from, to]);

  if (!employeeId || !from || !to) return null;
  if (loading) return <p className="text-xs text-gray-400 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Verificando disponibilidad del sector…</p>;
  if (!data || !data.department) return null;
  const overlaps: any[] = data.overlaps || [];
  if (overlaps.length === 0) {
    return (
      <div className="text-xs bg-green-50 border border-green-200 text-green-700 rounded-lg px-3 py-2 flex items-center gap-2">
        <Check className="w-3.5 h-3.5" /> Nadie más de <b>{data.department.name}</b> tiene ausencias en ese período.
      </div>
    );
  }
  const byEmp = new Map<string, any[]>();
  overlaps.forEach((o) => { const a = byEmp.get(o.employeeName) || []; a.push(o); byEmp.set(o.employeeName, a); });
  return (
    <div className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2 space-y-1.5">
      <div className="flex items-center gap-2 font-medium">
        <AlertTriangle className="w-3.5 h-3.5" />
        {data.overlapCount} de {data.total} del sector <b>{data.department.name}</b> ya {data.overlapCount === 1 ? 'tiene' : 'tienen'} ausencias en ese período
      </div>
      <ul className="space-y-1 pl-1">
        {[...byEmp.entries()].map(([name, list]) => (
          <li key={name} className="flex flex-wrap items-center gap-x-2">
            <span className="font-medium text-gray-700">{name}</span>
            {list.map((o, i) => (
              <span key={i} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${o.confirmed ? 'bg-white/70 border border-amber-200' : 'bg-white/40 border border-amber-200 border-dashed'}`}>
                {fmt(o.startDate)}–{fmt(o.endDate)} · {o.type}{o.confirmed ? '' : ' (pendiente)'}
              </span>
            ))}
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-amber-600">Solo informativo — no impide registrar la solicitud.</p>
    </div>
  );
}

function SubstituteCheck({ substituteEmployeeId, from, to }: { substituteEmployeeId: string; from: string; to: string }) {
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    if (!substituteEmployeeId || !from || !to || from > to) { setData(null); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const r = await apiFetch<any>(`/absences/substitutes/check?substituteEmployeeId=${encodeURIComponent(substituteEmployeeId)}&from=${from}&to=${to}`);
        if (!cancelled) setData(r);
      } catch { if (!cancelled) setData(null); }
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [substituteEmployeeId, from, to]);
  if (!substituteEmployeeId || !from || !to || !data) return null;
  if (!data.availableInRange) {
    return <p className="mt-1 text-xs text-amber-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Este reemplazo también estará ausente en ese período.</p>;
  }
  return <p className="mt-1 text-xs text-green-600 flex items-center gap-1"><Check className="w-3 h-3" /> Reemplazo disponible en ese período.</p>;
}

function RequestDetail({ request, onClose }: { request: AbsenceRequest; onClose: () => void }) {
  const [full, setFull] = useState<AbsenceRequest>(request);
  useEffect(() => {
    (async () => { try { const r = await apiFetch<{ item: AbsenceRequest }>(`/absences/requests/${request.id}`); if (r?.item) setFull(r.item); } catch { /* noop */ } })();
  }, [request.id]);
  const printComprobante = () => {
    const estado = STATUS[full.status]?.label || full.status;
    const w = window.open('', '_blank', 'width=800,height=900');
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>Comprobante de ausencia</title>
      <style>
        body{font-family:Segoe UI,Roboto,Arial,sans-serif;color:#111827;padding:40px;max-width:720px;margin:0 auto;}
        h1{font-size:20px;margin:0;} .sub{color:#6b7280;font-size:13px;margin-bottom:24px;}
        table{width:100%;border-collapse:collapse;margin-top:16px;font-size:14px;}
        td{padding:8px 0;border-bottom:1px solid #e5e7eb;} td.k{color:#6b7280;width:40%;}
        .hdr{border-bottom:3px solid #4f46e5;padding-bottom:12px;margin-bottom:8px;}
        .sign{margin-top:64px;display:flex;justify-content:space-between;gap:40px;}
        .sign div{flex:1;border-top:1px solid #9ca3af;padding-top:8px;text-align:center;font-size:12px;color:#6b7280;}
        .foot{margin-top:40px;font-size:11px;color:#9ca3af;text-align:center;}
      </style></head><body>
      <div class="hdr"><h1>Comprobante de Ausencia</h1><div class="sub">SGI 360 · Gestión de Ausencias</div></div>
      <table>
        <tr><td class="k">Empleado</td><td>${empName(full.employee)}</td></tr>
        <tr><td class="k">Tipo de ausencia</td><td>${full.absenceType?.name || '—'}</td></tr>
        <tr><td class="k">Período</td><td>${fmt(full.startDate)} → ${fmt(full.endDate)}</td></tr>
        <tr><td class="k">Días computados</td><td>${full.computedDays}${full.halfDay ? ' (media jornada)' : ''} · ${full.countingMode === 'CALENDAR' ? 'corridos' : 'hábiles'}</td></tr>
        <tr><td class="k">Estado</td><td>${estado}</td></tr>
        ${full.substitute ? `<tr><td class="k">Sustituto</td><td>${empName(full.substitute)}</td></tr>` : ''}
        ${full.reason ? `<tr><td class="k">Motivo</td><td>${full.reason}</td></tr>` : ''}
        <tr><td class="k">N° de solicitud</td><td>${full.code || full.id}</td></tr>
        <tr><td class="k">Emitido</td><td>${new Date().toLocaleDateString('es-AR')}</td></tr>
      </table>
      <div class="sign"><div>Firma del empleado</div><div>Firma RRHH / Responsable</div></div>
      <div class="foot">Documento generado automáticamente por SGI 360.</div>
      </body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };
  return (
    <Modal title="Detalle de solicitud" onClose={onClose}>
      <div className="space-y-3 text-sm">
        <Row k="Empleado" v={empName(full.employee)} />
        <Row k="Tipo" v={full.absenceType?.name} />
        <Row k="Período" v={`${fmt(full.startDate)} → ${fmt(full.endDate)}`} />
        <Row k="Días computados" v={`${full.computedDays}${full.halfDay ? ' (media jornada)' : ''} · ${full.countingMode === 'CALENDAR' ? 'corridos' : 'hábiles'}`} />
        <Row k="Estado" v={<StatusBadge status={full.status} />} />
        <Row k="Sustituto" v={empName(full.substitute)} />
        <Row k="Origen" v={full.createdByHr ? 'Cargada por RRHH' : 'Solicitada por empleado'} />
        {full.reason && <Row k="Motivo" v={full.reason} />}
        <div>
          <p className="font-medium text-gray-700 flex items-center gap-1.5 mb-1"><History className="w-4 h-4" /> Flujo de aprobación</p>
          {full.approvals && full.approvals.length > 0 ? (
            <div className="space-y-1">
              {full.approvals.map((a: any) => (
                <div key={a.id} className="flex items-center justify-between border rounded p-2">
                  <span>Paso {a.stepOrder} · {a.approverRole || '—'}</span>
                  <span className="flex items-center gap-2">
                    <StatusBadge status={a.decision === 'APPROVED' ? 'APPROVED' : a.decision === 'REJECTED' ? 'REJECTED' : 'PENDING_APPROVAL'} />
                    {a.decidedAt && <span className="text-xs text-gray-400">{fmt(a.decidedAt)}</span>}
                  </span>
                </div>
              ))}
            </div>
          ) : <p className="text-xs text-gray-400">Sin pasos de aprobación registrados.</p>}
        </div>
        {full.attachments && full.attachments.length > 0 && (
          <div>
            <p className="font-medium text-gray-700 mb-1">Documentación</p>
            {full.attachments.map((at: any) => (
              <a key={at.id} href={at.fileUrl} target="_blank" rel="noreferrer" className="block text-indigo-600 hover:underline text-xs">{at.fileName}</a>
            ))}
          </div>
        )}
        <ImpactSection requestId={full.id} />
      </div>
      <div className="flex justify-end gap-2 mt-5 pt-3 border-t border-gray-100">
        <button onClick={printComprobante} className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg">
          <Printer className="w-4 h-4" /> Imprimir comprobante
        </button>
      </div>
    </Modal>
  );
}

const IMPACT_LEVEL: Record<string, string> = { error: 'bg-red-50 border-red-200 text-red-800', warning: 'bg-amber-50 border-amber-200 text-amber-800', info: 'bg-blue-50 border-blue-200 text-blue-800' };
function ImpactSection({ requestId }: { requestId: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [ai, setAi] = useState<string>('');
  const [aiLoading, setAiLoading] = useState(false);
  const load = async () => {
    setLoading(true);
    try { setData(await apiFetch<any>(`/absences/requests/${requestId}/impact`)); }
    catch { setData(null); } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [requestId]);
  const runAi = async () => {
    setAiLoading(true);
    try {
      const r: any = await apiFetch(`/absences/requests/${requestId}/impact/ai`, { method: 'POST', json: { context: data?.request, findings: data?.findings } });
      setAi(r?.analysis || 'Sin respuesta.');
    } catch (e: any) { setAi('No se pudo generar el análisis con IA.'); } finally { setAiLoading(false); }
  };
  return (
    <div className="border-t border-gray-100 pt-3">
      <div className="flex items-center justify-between mb-1">
        <p className="font-medium text-gray-700 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> Análisis de impacto</p>
        <button onClick={runAi} disabled={aiLoading || !data} className="text-xs flex items-center gap-1 border border-indigo-200 text-indigo-700 hover:bg-indigo-50 px-2 py-1 rounded-lg disabled:opacity-50">
          {aiLoading && <Loader2 className="w-3 h-3 animate-spin" />} Analizar con IA
        </button>
      </div>
      {loading ? <p className="text-xs text-gray-400">Analizando…</p> : !data ? <p className="text-xs text-gray-400">Sin análisis.</p> : (
        <div className="space-y-1.5">
          {(data.findings || []).map((fd: any, i: number) => (
            <div key={i} className={`text-xs border rounded p-2 ${IMPACT_LEVEL[fd.level] || 'bg-gray-50 border-gray-200 text-gray-700'}`}>
              <b>{fd.category}:</b> {fd.message}
            </div>
          ))}
          {data.competency && (
            <p className="text-xs text-gray-500">Cobertura de competencias del sustituto: {data.competency.percent}% ({data.competency.covered}/{data.competency.required}).</p>
          )}
        </div>
      )}
      {ai && (
        <div className="mt-2 bg-indigo-50 border border-indigo-100 rounded-lg p-3 text-xs text-gray-700 whitespace-pre-wrap">
          <p className="font-medium text-indigo-700 mb-1">Análisis con IA (asistido)</p>
          {ai}
        </div>
      )}
    </div>
  );
}

/* ─────────── Calendario (grilla mensual de todas las ausencias) ─────────── */
const MESES_FULL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DOW = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const PENDING_STATUSES = ['SUBMITTED', 'PENDING_APPROVAL', 'PENDING_DOCS', 'PENDING_COVERAGE'];
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function CalendarioTab() {
  const [rows, setRows] = useState<AbsenceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });

  useEffect(() => {
    (async () => {
      try {
        // Todas las ausencias (cualquier tipo), excluyendo canceladas/rechazadas/borradores.
        const r = await apiFetch<{ items: AbsenceRequest[] }>('/absences/requests');
        setRows((r?.items ?? []).filter((x) => !['CANCELLED', 'REJECTED', 'DRAFT'].includes(x.status)));
      } catch { setRows([]); } finally { setLoading(false); }
    })();
  }, []);

  const year = cursor.getFullYear(); const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const startDow = (first.getDay() + 6) % 7; // lunes = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const absOn = (d: Date) => { const k = dayKey(d); return rows.filter((r) => r.startDate.slice(0, 10) <= k && r.endDate.slice(0, 10) >= k); };
  const typeMap = new Map<string, { name: string; color: string }>();
  rows.forEach((r) => { if (r.absenceType) typeMap.set(r.absenceType.id, { name: r.absenceType.name, color: r.absenceType.color || '#6366f1' }); });
  const today = dayKey(new Date());
  const selectedAbs = selected ? rows.filter((r) => r.startDate.slice(0, 10) <= selected && r.endDate.slice(0, 10) >= selected) : [];

  if (loading) return <Spinner />;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-800">{MESES_FULL[month]} {year}</h3>
        <div className="flex items-center gap-1">
          <button onClick={() => setCursor(new Date(year, month - 1, 1))} className="px-2 py-1 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">‹</button>
          <button onClick={() => { const d = new Date(); setCursor(new Date(d.getFullYear(), d.getMonth(), 1)); }} className="px-3 py-1 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Hoy</button>
          <button onClick={() => setCursor(new Date(year, month + 1, 1))} className="px-2 py-1 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">›</button>
        </div>
      </div>

      {typeMap.size > 0 && (
        <div className="flex flex-wrap gap-3">
          {[...typeMap.values()].map((t) => (
            <span key={t.name} className="flex items-center gap-1.5 text-xs text-gray-600">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: t.color }} /> {t.name}
            </span>
          ))}
          <span className="flex items-center gap-1.5 text-xs text-gray-400"><span className="w-2.5 h-2.5 rounded-full border border-dashed border-gray-400" /> Pendiente</span>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="grid grid-cols-7 bg-gray-50 text-xs font-medium text-gray-500 uppercase">
          {DOW.map((d) => <div key={d} className="px-2 py-2 text-center">{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((d, i) => {
            if (!d) return <div key={i} className="min-h-[84px] border-t border-r border-gray-100 bg-gray-50/40" />;
            const k = dayKey(d);
            const list = absOn(d);
            const isToday = k === today;
            return (
              <button key={i} onClick={() => setSelected(k)} className={`min-h-[84px] border-t border-r border-gray-100 p-1 text-left align-top hover:bg-indigo-50/40 ${isToday ? 'bg-indigo-50/60' : ''}`}>
                <div className={`text-xs mb-1 ${isToday ? 'font-bold text-indigo-700' : 'text-gray-500'}`}>{d.getDate()}</div>
                <div className="space-y-0.5">
                  {list.slice(0, 3).map((r) => {
                    const pending = PENDING_STATUSES.includes(r.status);
                    const color = r.absenceType?.color || '#6366f1';
                    return (
                      <div key={r.id} className="text-[10px] leading-tight truncate rounded px-1 py-0.5 text-white" style={pending ? { background: 'transparent', color: '#4b5563', border: `1px dashed ${color}` } : { background: color }} title={`${empName(r.employee)} · ${r.absenceType?.name} (${STATUS[r.status]?.label || r.status})`}>
                        {empName(r.employee)}
                      </div>
                    );
                  })}
                  {list.length > 3 && <div className="text-[10px] text-gray-400 px-1">+{list.length - 3} más</div>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {selected && (
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-700">Ausencias del {fmt(selected)}</p>
            <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
          </div>
          {selectedAbs.length === 0 ? <p className="text-xs text-gray-400">Sin ausencias este día.</p> : (
            <div className="space-y-2">
              {selectedAbs.map((r) => (
                <div key={r.id} className="flex items-center gap-3">
                  <div className="w-1.5 h-8 rounded-full" style={{ background: r.absenceType?.color || '#999' }} />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800">{empName(r.employee)} · {r.absenceType?.name}</p>
                    <p className="text-xs text-gray-500">{fmt(r.startDate)} → {fmt(r.endDate)} · {r.computedDays} día(s)</p>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────── Saldos ─────────── */
function SaldosTab({ types, employees }: { types: AbsenceType[]; employees: Employee[] }) {
  const [rows, setRows] = useState<Balance[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAssign, setShowAssign] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [movementsOf, setMovementsOf] = useState<Balance | null>(null);
  const year = new Date().getFullYear();

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await apiFetch<{ items: Balance[] }>(`/absences/balances?period=${year}`); setRows(r?.items ?? []); }
    catch { setRows([]); } finally { setLoading(false); }
  }, [year]);
  useEffect(() => { load(); }, [load]);

  const adjust = async (b: Balance) => {
    const raw = prompt('Ajuste de saldo (ej: 2 o -1.5):');
    if (raw == null) return;
    const amount = Number(raw);
    if (isNaN(amount) || amount === 0) { alert('Monto inválido'); return; }
    const reason = prompt('Motivo del ajuste (obligatorio):');
    if (!reason) { alert('El motivo es obligatorio'); return; }
    try { await apiFetch(`/absences/balances/${b.id}/adjust`, { method: 'POST', json: { amount, reason } }); await load(); }
    catch (e: any) { alert(e?.message || 'Error'); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-500">Saldos del período {year}</p>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => downloadFile('/absences/balances/template', 'plantilla_saldos.xlsx')} className="text-sm border border-gray-300 hover:bg-gray-50 text-gray-700 px-3 py-2 rounded-lg">Plantilla</button>
          <button onClick={() => setShowImport(true)} className="text-sm border border-gray-300 hover:bg-gray-50 text-gray-700 px-3 py-2 rounded-lg">Importar Excel</button>
          <button onClick={() => downloadFile('/absences/export?type=balances', 'ausencias_saldos.xlsx')} className="text-sm border border-gray-300 hover:bg-gray-50 text-gray-700 px-3 py-2 rounded-lg">Exportar</button>
          <button onClick={() => setShowAssign(true)} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg">
            <Plus className="w-4 h-4" /> Asignar saldo
          </button>
        </div>
      </div>
      {loading ? <Spinner /> : rows.length === 0 ? <Empty note="No hay saldos cargados." /> : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-2">Empleado</th>
                <th className="text-left px-4 py-2">Tipo</th>
                <th className="text-right px-4 py-2">Asignado</th>
                <th className="text-right px-4 py-2">Usado</th>
                <th className="text-right px-4 py-2">Reservado</th>
                <th className="text-right px-4 py-2">Pendiente</th>
                <th className="text-right px-4 py-2">Disponible</th>
                <th className="text-right px-4 py-2">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-800">{empName(b.employee)}</td>
                  <td className="px-4 py-2">{b.absenceType?.name || '—'}</td>
                  <td className="px-4 py-2 text-right">{b.assignedDays + b.carriedDays + b.accruedDays}</td>
                  <td className="px-4 py-2 text-right">{b.usedDays}</td>
                  <td className="px-4 py-2 text-right">{b.reservedDays}</td>
                  <td className="px-4 py-2 text-right text-amber-600">{b.pendingDays}</td>
                  <td className="px-4 py-2 text-right font-semibold text-green-700">{b._available ?? 0}</td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => adjust(b)} className="text-xs text-indigo-600 hover:underline">Ajustar</button>
                      <button onClick={() => setMovementsOf(b)} className="text-xs text-gray-500 hover:underline ml-2">Historial</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {showAssign && <AssignBalanceForm types={types} employees={employees} year={year} onClose={() => setShowAssign(false)} onSaved={() => { setShowAssign(false); load(); }} />}
      {showImport && <ImportBalancesModal onClose={() => setShowImport(false)} onImported={() => { setShowImport(false); load(); }} />}
      {movementsOf && <MovementsModal balance={movementsOf} onClose={() => setMovementsOf(null)} />}
    </div>
  );
}

function AssignBalanceForm({ types, employees, year, onClose, onSaved }: { types: AbsenceType[]; employees: Employee[]; year: number; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<any>({ employeeId: '', absenceTypeId: '', period: String(year), assignedDays: '', reason: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const submit = async () => {
    setErr('');
    if (!f.employeeId || !f.absenceTypeId || !f.assignedDays) { setErr('Completá empleado, tipo y días.'); return; }
    setSaving(true);
    try {
      await apiFetch('/absences/balances', { method: 'POST', json: { employeeId: f.employeeId, absenceTypeId: f.absenceTypeId, period: f.period, assignedDays: Number(f.assignedDays), reason: f.reason || undefined } });
      onSaved();
    } catch (e: any) { setErr(e?.message || 'Error'); } finally { setSaving(false); }
  };
  return (
    <Modal title="Asignar saldo" onClose={onClose}>
      <div className="space-y-3">
        {err && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{err}</div>}
        <Field label="Empleado *">
          <select value={f.employeeId} onChange={(e) => setF({ ...f, employeeId: e.target.value })} className={inputCls}>
            <option value="">Seleccionar…</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
          </select>
        </Field>
        <Field label="Tipo (requiere saldo) *">
          <select value={f.absenceTypeId} onChange={(e) => setF({ ...f, absenceTypeId: e.target.value })} className={inputCls}>
            <option value="">Seleccionar…</option>
            {types.filter((t) => t.requiresBalance).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Período"><input value={f.period} onChange={(e) => setF({ ...f, period: e.target.value })} className={inputCls} /></Field>
          <Field label="Días asignados *"><input type="number" value={f.assignedDays} onChange={(e) => setF({ ...f, assignedDays: e.target.value })} className={inputCls} /></Field>
        </div>
        <Field label="Motivo"><input value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} className={inputCls} /></Field>
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
        <button onClick={submit} disabled={saving} className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-2">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />} Guardar
        </button>
      </div>
    </Modal>
  );
}

function MovementsModal({ balance, onClose }: { balance: Balance; onClose: () => void }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => { try { const r = await apiFetch<{ items: any[] }>(`/absences/balances/${balance.id}/movements`); setRows(r?.items ?? []); } catch { /* */ } finally { setLoading(false); } })();
  }, [balance.id]);
  return (
    <Modal title={`Historial de saldo · ${empName(balance.employee)}`} onClose={onClose}>
      {loading ? <Spinner /> : rows.length === 0 ? <Empty note="Sin movimientos." /> : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {rows.map((m) => (
            <div key={m.id} className="flex items-center justify-between border rounded p-2 text-sm">
              <div>
                <p className="font-medium text-gray-700">{m.movementType} · <span className="text-gray-400">{m.source}</span></p>
                {m.reason && <p className="text-xs text-gray-500">{m.reason}</p>}
                <p className="text-xs text-gray-400">{new Date(m.createdAt).toLocaleString('es-AR')} {m.userName ? `· ${m.userName}` : ''}</p>
              </div>
              <div className="text-right">
                <p className={`font-semibold ${(m.delta ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{(m.delta ?? 0) >= 0 ? '+' : ''}{m.delta}</p>
                <p className="text-xs text-gray-400">{m.field}: {m.previousValue}→{m.newValue}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

function ImportBalancesModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const analyze = async (f: File) => {
    setErr(''); setBusy(true);
    try { setPreview(await uploadFile('/absences/balances/import', f, { commit: 'false' })); }
    catch (e: any) { setErr(e?.message || 'Error'); } finally { setBusy(false); }
  };
  const commit = async () => {
    if (!file) return;
    setBusy(true);
    try { const r: any = await uploadFile('/absences/balances/import', file, { commit: 'true' }); alert(`Importados ${r.applied} saldo(s).`); onImported(); }
    catch (e: any) { setErr(e?.message || 'Error'); } finally { setBusy(false); }
  };
  return (
    <Modal title="Importar saldos (Excel)" onClose={onClose}>
      <div className="space-y-3">
        {err && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{err}</div>}
        <p className="text-xs text-gray-500">Descargá la plantilla, completala y subila. La importación NO crea empleados y vincula por DNI.</p>
        <input type="file" accept=".xlsx" onChange={(e) => { const f = e.target.files?.[0] || null; setFile(f); setPreview(null); if (f) analyze(f); }} className="text-sm" />
        {busy && <div className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /> Procesando…</div>}
        {preview && (
          <div className="space-y-2 text-sm">
            <div className="flex gap-3">
              <span className="text-green-700">Válidos: {preview.valid?.length ?? 0}</span>
              <span className="text-red-600">Errores: {preview.errors?.length ?? 0}</span>
              <span className="text-amber-600">Advertencias: {preview.warnings?.length ?? 0}</span>
            </div>
            {preview.errors?.length > 0 && (
              <div className="max-h-32 overflow-y-auto border border-red-200 rounded p-2 bg-red-50">
                {preview.errors.map((e: any, i: number) => <p key={i} className="text-xs text-red-700">Fila {e.line}: {e.error}{e.dni ? ` (DNI ${e.dni})` : ''}</p>)}
              </div>
            )}
            {preview.warnings?.length > 0 && (
              <div className="max-h-24 overflow-y-auto border border-amber-200 rounded p-2 bg-amber-50">
                {preview.warnings.map((w: any, i: number) => <p key={i} className="text-xs text-amber-700">Fila {w.line}: {w.warning}</p>)}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
        <button onClick={commit} disabled={busy || !preview || (preview.valid?.length ?? 0) === 0} className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg">Confirmar importación ({preview?.valid?.length ?? 0})</button>
      </div>
    </Modal>
  );
}

/* ─────────── Indicadores ─────────── */
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
function IndicadoresTab() {
  const [d, setD] = useState<any>(null);
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try {
        setD(await apiFetch<any>('/absences/indicators'));
        setDash(await apiFetch<Dashboard>('/absences/dashboard'));
      } catch { /* */ } finally { setLoading(false); }
    })();
  }, []);
  if (loading) return <Spinner />;
  if (!d) return <Empty note="Sin datos." />;
  const byType = d.byType || [];
  const maxDays = Math.max(1, ...byType.map((b: any) => b.days));
  const maxMonth = Math.max(1, ...(d.monthlyTrend || []).map((m: any) => m.days));
  const maxArea = Math.max(1, ...(d.absenteeismByArea || []).map((a: any) => a.days));
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi label="Índice de ausentismo" value={`${dash?.absenteeismIndex ?? 0}%`} />
        <Kpi label="Tiempo prom. aprobación" value={`${d.avgApprovalHours} h`} />
        <Kpi label="% Rechazo" value={`${d.rejectionRate}%`} />
        <Kpi label="Sin sustituto" value={d.withoutSubstitute} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Distribución por tipo (días)</h3>
          {byType.length === 0 ? <Empty note="Sin ausencias." /> : (
            <div className="space-y-2">
              {byType.map((b: any) => (
                <div key={b.name} className="flex items-center gap-3">
                  <span className="w-32 text-sm text-gray-600 truncate">{b.name}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                    <div className="h-4 rounded-full" style={{ width: `${(b.days / maxDays) * 100}%`, background: b.color || '#6366f1' }} />
                  </div>
                  <span className="text-sm text-gray-700 w-20 text-right">{b.days} d · {b.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Ausentismo por área</h3>
          {(d.absenteeismByArea || []).length === 0 ? <Empty note="Sin datos." /> : (
            <div className="space-y-2">
              {d.absenteeismByArea.map((a: any) => (
                <div key={a.name} className="flex items-center gap-3">
                  <span className="w-32 text-sm text-gray-600 truncate">{a.name}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                    <div className="h-4 rounded-full bg-rose-400" style={{ width: `${(a.days / maxArea) * 100}%` }} />
                  </div>
                  <span className="text-sm text-gray-700 w-24 text-right">{a.days} d · {a.index}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Tendencia mensual ({d.year})</h3>
        <div className="flex items-end gap-1 h-32 bg-white border border-gray-200 rounded-lg p-3">
          {(d.monthlyTrend || []).map((m: any) => (
            <div key={m.month} className="flex-1 flex flex-col items-center justify-end gap-1">
              <div className="w-full bg-indigo-400 rounded-t" style={{ height: `${(m.days / maxMonth) * 100}%`, minHeight: m.days > 0 ? '4px' : '0' }} title={`${m.days} días`} />
              <span className="text-[10px] text-gray-400">{MESES[m.month - 1]}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="text-xs text-gray-400">Fórmula ausentismo: días de ausencia (aprobados/en curso/finalizados) ÷ (dotación activa × días hábiles aprox. transcurridos) × 100. Tiempo de aprobación: promedio entre creación y decisión del paso de aprobación.</p>
    </div>
  );
}

/* ─────────── Configuración ─────────── */
function ConfigTab({ types, reloadTypes }: { types: AbsenceType[]; reloadTypes: () => void }) {
  const [seeding, setSeeding] = useState(false);
  const seed = async () => {
    setSeeding(true);
    try { await apiFetch('/absences/types/seed-defaults', { method: 'POST', json: {} }); reloadTypes(); }
    catch (e: any) { alert(e?.message || 'Error'); } finally { setSeeding(false); }
  };
  const toggle = async (t: AbsenceType) => {
    try { await apiFetch(`/absences/types/${t.id}`, { method: 'PATCH', json: { active: !t.active } }); reloadTypes(); }
    catch (e: any) { alert(e?.message || 'Error'); }
  };
  return (
    <div className="space-y-6">
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-700">Tipos de ausencia</h3>
          {types.length === 0 && (
            <button onClick={seed} disabled={seeding} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-3 py-1.5 rounded-lg">
              {seeding && <Loader2 className="w-4 h-4 animate-spin" />} Cargar catálogo por defecto
            </button>
          )}
        </div>
        {types.length === 0 ? <Empty note="No hay tipos. Cargá el catálogo por defecto para empezar." /> : (
          <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
            {types.map((t) => (
              <div key={t.id} className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full" style={{ background: t.color || '#999' }} />
                  <div>
                    <p className="text-sm font-medium text-gray-800">{t.name} <span className="text-xs text-gray-400">({t.code})</span></p>
                    <p className="text-xs text-gray-500">
                      {t.countingMode === 'CALENDAR' ? 'Corridos' : 'Hábiles'}
                      {t.requiresBalance ? ' · saldo' : ''}{t.requiresApproval ? ' · aprobación' : ''}
                      {t.requiresDocumentation ? ' · doc.' : ''}{t.requiresSubstitute ? ' · sustituto' : ''}
                      {t.sensitiveData ? ' · sensible' : ''}
                    </p>
                  </div>
                </div>
                <button onClick={() => toggle(t)} className={`text-xs px-2 py-1 rounded ${t.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {t.active ? 'Activo' : 'Inactivo'}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
      <AccrualSection types={types} />
      <PolicySection />
      <HolidaysSection />
    </div>
  );
}

function AccrualSection({ types }: { types: AbsenceType[] }) {
  const [rules, setRules] = useState<any[]>([]);
  const [f, setF] = useState<any>({ name: '', absenceTypeId: '', minTenureMonths: '', maxTenureMonths: '', daysGranted: '', contractType: '', requiresReview: false, priority: 0 });
  const [running, setRunning] = useState(false);
  const balTypes = types.filter((t) => t.requiresBalance);
  const load = useCallback(async () => { try { const r = await apiFetch<{ items: any[] }>('/absences/accrual-rules'); setRules(r?.items ?? []); } catch { /* */ } }, []);
  useEffect(() => { load(); }, [load]);
  const add = async () => {
    if (!f.name || !f.absenceTypeId || f.daysGranted === '') { alert('Completá nombre, tipo y días'); return; }
    try {
      await apiFetch('/absences/accrual-rules', { method: 'POST', json: {
        name: f.name, absenceTypeId: f.absenceTypeId, daysGranted: Number(f.daysGranted),
        minTenureMonths: f.minTenureMonths !== '' ? Number(f.minTenureMonths) : undefined,
        maxTenureMonths: f.maxTenureMonths !== '' ? Number(f.maxTenureMonths) : undefined,
        contractType: f.contractType || undefined, requiresReview: f.requiresReview, priority: Number(f.priority) || 0,
      } });
      setF({ name: '', absenceTypeId: '', minTenureMonths: '', maxTenureMonths: '', daysGranted: '', contractType: '', requiresReview: false, priority: 0 });
      load();
    } catch (e: any) { alert(e?.message || 'Error'); }
  };
  const del = async (id: string) => { try { await apiFetch(`/absences/accrual-rules/${id}`, { method: 'DELETE' }); load(); } catch { /* */ } };
  const run = async () => {
    if (!confirm('¿Ejecutar el devengamiento para el período actual? Se aplicarán las reglas activas.')) return;
    setRunning(true);
    try {
      const r: any = await apiFetch('/absences/accrual/run', { method: 'POST', json: {} });
      alert(`Devengamiento ${r.period}: ${r.appliedCount} aplicado(s), ${r.reviewCount} para revisión.${r.message ? '\n' + r.message : ''}`);
    } catch (e: any) { alert(e?.message || 'Error'); } finally { setRunning(false); }
  };
  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-700">Reglas de devengamiento</h3>
        <button onClick={run} disabled={running || rules.length === 0} className="flex items-center gap-2 text-sm bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg">
          {running && <Loader2 className="w-4 h-4 animate-spin" />} Ejecutar devengamiento
        </button>
      </div>
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Nombre"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Ej: <5 años" className={inputCls} /></Field>
          <Field label="Tipo"><select value={f.absenceTypeId} onChange={(e) => setF({ ...f, absenceTypeId: e.target.value })} className={inputCls}><option value="">Seleccionar…</option>{balTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
          <Field label="Antig. mín (meses)"><input type="number" value={f.minTenureMonths} onChange={(e) => setF({ ...f, minTenureMonths: e.target.value })} className={`${inputCls} w-28`} /></Field>
          <Field label="Antig. máx (meses)"><input type="number" value={f.maxTenureMonths} onChange={(e) => setF({ ...f, maxTenureMonths: e.target.value })} className={`${inputCls} w-28`} /></Field>
          <Field label="Días"><input type="number" value={f.daysGranted} onChange={(e) => setF({ ...f, daysGranted: e.target.value })} className={`${inputCls} w-20`} /></Field>
          <Field label="Prioridad"><input type="number" value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })} className={`${inputCls} w-20`} /></Field>
          <label className="flex items-center gap-2 text-sm text-gray-700 pb-2"><input type="checkbox" checked={f.requiresReview} onChange={(e) => setF({ ...f, requiresReview: e.target.checked })} /> Revisar antes</label>
          <button onClick={add} className="px-3 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg mb-0.5">Agregar</button>
        </div>
        <p className="text-[11px] text-gray-400">Ejemplo configurable: &lt;5 años → 14 días; 5–10 años (60–120 meses) → 21; &gt;10 años → 28. La mayor prioridad gana si varias reglas aplican.</p>
        {rules.length > 0 && (
          <div className="divide-y divide-gray-100 border-t border-gray-100 pt-2">
            {rules.map((r) => (
              <div key={r.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <p className="font-medium text-gray-800">{r.name} <span className="text-xs text-gray-400">→ {r.absenceTypeName || 'tipo'}</span></p>
                  <p className="text-xs text-gray-500">{r.daysGranted} días · antigüedad {r.minTenureMonths ?? 0}–{r.maxTenureMonths ?? '∞'} meses{r.contractType ? ` · ${r.contractType}` : ''}{r.requiresReview ? ' · revisión' : ''} · prioridad {r.priority}</p>
                </div>
                <button onClick={() => del(r.id)} className="text-red-500 hover:text-red-700"><X className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function PolicySection() {
  const [p, setP] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { (async () => { try { const r = await apiFetch<{ item: any }>('/absences/policy'); setP(r?.item); } catch { /* */ } })(); }, []);
  if (!p) return null;
  const save = async () => {
    setSaving(true);
    try {
      await apiFetch('/absences/policy', { method: 'PUT', json: {
        workingWeekdays: p.workingWeekdays, allowNegativeBalance: p.allowNegativeBalance, allowExceptions: p.allowExceptions,
        defaultMinAdvanceDays: Number(p.defaultMinAdvanceDays) || 0, pendingRequestSlaHours: Number(p.pendingRequestSlaHours) || 48,
        carryoverEnabled: p.carryoverEnabled,
      } });
      alert('Política guardada');
    } catch (e: any) { alert(e?.message || 'Error'); } finally { setSaving(false); }
  };
  const WD = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const toggleDay = (i: number) => {
    const set = new Set<number>(p.workingWeekdays || []);
    if (set.has(i)) set.delete(i); else set.add(i);
    setP({ ...p, workingWeekdays: [...set].sort() });
  };
  return (
    <section>
      <h3 className="text-sm font-semibold text-gray-700 mb-2">Política del módulo</h3>
      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
        <div>
          <p className="text-xs text-gray-500 mb-1">Días laborables</p>
          <div className="flex gap-1">
            {WD.map((d, i) => (
              <button key={i} onClick={() => toggleDay(i)} className={`px-2.5 py-1 rounded text-xs ${(p.workingWeekdays || []).includes(i) ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500'}`}>{d}</button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Anticipación mínima (días)"><input type="number" value={p.defaultMinAdvanceDays ?? 0} onChange={(e) => setP({ ...p, defaultMinAdvanceDays: e.target.value })} className={inputCls} /></Field>
          <Field label="SLA solicitudes (horas)"><input type="number" value={p.pendingRequestSlaHours ?? 48} onChange={(e) => setP({ ...p, pendingRequestSlaHours: e.target.value })} className={inputCls} /></Field>
        </div>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={!!p.allowNegativeBalance} onChange={(e) => setP({ ...p, allowNegativeBalance: e.target.checked })} /> Permitir saldo negativo</label>
          <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={!!p.allowExceptions} onChange={(e) => setP({ ...p, allowExceptions: e.target.checked })} /> Permitir excepciones</label>
          <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={!!p.carryoverEnabled} onChange={(e) => setP({ ...p, carryoverEnabled: e.target.checked })} /> Arrastre de saldo</label>
        </div>
        <div className="flex justify-end">
          <button onClick={save} disabled={saving} className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-2">{saving && <Loader2 className="w-4 h-4 animate-spin" />} Guardar política</button>
        </div>
      </div>
    </section>
  );
}

function HolidaysSection() {
  const [rows, setRows] = useState<any[]>([]);
  const [f, setF] = useState({ date: '', name: '', recurring: false });
  const load = useCallback(async () => { try { const r = await apiFetch<{ items: any[] }>('/absences/holidays'); setRows(r?.items ?? []); } catch { /* */ } }, []);
  useEffect(() => { load(); }, [load]);
  const add = async () => {
    if (!f.date || !f.name) { alert('Completá fecha y nombre'); return; }
    try { await apiFetch('/absences/holidays', { method: 'POST', json: f }); setF({ date: '', name: '', recurring: false }); load(); }
    catch (e: any) { alert(e?.message || 'Error'); }
  };
  const del = async (id: string) => { try { await apiFetch(`/absences/holidays/${id}`, { method: 'DELETE' }); load(); } catch { /* */ } };
  return (
    <section>
      <h3 className="text-sm font-semibold text-gray-700 mb-2">Feriados / días no laborables</h3>
      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Fecha"><input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} className={inputCls} /></Field>
          <Field label="Nombre"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={inputCls} /></Field>
          <label className="flex items-center gap-2 text-sm text-gray-700 pb-2"><input type="checkbox" checked={f.recurring} onChange={(e) => setF({ ...f, recurring: e.target.checked })} /> Anual</label>
          <button onClick={add} className="px-3 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg mb-0.5">Agregar</button>
        </div>
        {rows.length > 0 && (
          <div className="divide-y divide-gray-100">
            {rows.map((h) => (
              <div key={h.id} className="flex items-center justify-between py-2 text-sm">
                <span>{fmt(h.date)} · {h.name} {h.recurring && <span className="text-xs text-gray-400">(anual)</span>}</span>
                <button onClick={() => del(h.id)} className="text-red-500 hover:text-red-700"><X className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* ─────────── Disponibilidad ─────────── */
const AVA_STATUS: Record<string, { label: string; cls: string }> = {
  AVAILABLE: { label: 'Disponible', cls: 'bg-green-100 text-green-700' },
  ABSENT: { label: 'Ausente', cls: 'bg-red-100 text-red-700' },
  PARTIAL: { label: 'Parcial', cls: 'bg-amber-100 text-amber-800' },
};
function DisponibilidadTab() {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dept, setDept] = useState('');
  const [st, setSt] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await apiFetch<any>(`/absences/availability?from=${from}&to=${to}`)); }
    catch { setData(null); } finally { setLoading(false); }
  }, [from, to]);
  useEffect(() => { load(); }, [load]);
  const depts = useMemo(() => {
    const m = new Map<string, string>();
    (data?.employees || []).forEach((e: any) => { if (e.department) m.set(e.department.id, e.department.name); });
    return [...m.entries()];
  }, [data]);
  const rows = (data?.employees || []).filter((e: any) => (!dept || e.department?.id === dept) && (!st || e.status === st));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Desde"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} /></Field>
        <Field label="Hasta"><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} /></Field>
        <Field label="Área"><select value={dept} onChange={(e) => setDept(e.target.value)} className={inputCls}><option value="">Todas</option>{depts.map(([id, nm]) => <option key={id} value={id}>{nm}</option>)}</select></Field>
        <Field label="Estado"><select value={st} onChange={(e) => setSt(e.target.value)} className={inputCls}><option value="">Todos</option><option value="AVAILABLE">Disponible</option><option value="PARTIAL">Parcial</option><option value="ABSENT">Ausente</option></select></Field>
      </div>
      {loading ? <Spinner /> : !data ? <Empty note="Sin datos." /> : (
        <>
          <div className="grid grid-cols-3 gap-4">
            <Kpi label="Disponibles" value={data.available} />
            <Kpi label="Parciales" value={data.partial} />
            <Kpi label="Ausentes" value={data.absent} />
          </div>
          <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>
                <th className="text-left px-4 py-2">Empleado</th><th className="text-left px-4 py-2">Área</th><th className="text-left px-4 py-2">Puesto</th><th className="text-left px-4 py-2">Estado</th><th className="text-left px-4 py-2">Ausencias</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((e: any) => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-800">{e.firstName} {e.lastName}</td>
                    <td className="px-4 py-2 text-gray-600">{e.department?.name || '—'}</td>
                    <td className="px-4 py-2 text-gray-600">{e.position?.name || '—'}</td>
                    <td className="px-4 py-2"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${AVA_STATUS[e.status]?.cls}`}>{AVA_STATUS[e.status]?.label}</span></td>
                    <td className="px-4 py-2 text-xs text-gray-500">{e.absences.length === 0 ? '—' : e.absences.map((a: any) => a.sensitive ? 'No disponible' : a.type).join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400">Los motivos sensibles (licencias médicas, etc.) se muestran como “No disponible”.</p>
        </>
      )}
    </div>
  );
}

/* ─────────── Cobertura ─────────── */
function CoberturaTab({ employees }: { employees: Employee[] }) {
  const [sub, setSub] = useState<'coverage' | 'rules' | 'delegations'>('coverage');
  const segs: [string, string][] = [['coverage', 'Cobertura operativa'], ['rules', 'Reglas'], ['delegations', 'Delegaciones']];
  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {segs.map(([k, l]) => (
          <button key={k} onClick={() => setSub(k as any)} className={`px-3 py-1.5 text-sm rounded-md ${sub === k ? 'bg-white shadow text-indigo-700' : 'text-gray-500'}`}>{l}</button>
        ))}
      </div>
      {sub === 'coverage' && <CoverageView />}
      {sub === 'rules' && <RulesView />}
      {sub === 'delegations' && <DelegationsView employees={employees} />}
    </div>
  );
}

function CoverageView() {
  const [scope, setScope] = useState('DEPARTMENT');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await apiFetch<any>(`/absences/coverage?date=${date}&scopeType=${scope}`)); }
    catch { setData(null); } finally { setLoading(false); }
  }, [date, scope]);
  useEffect(() => { load(); }, [load]);
  const stCls: Record<string, string> = { OK: 'text-green-600', WARNING: 'text-amber-600', CRITICAL: 'text-red-600' };
  return (
    <div className="space-y-3">
      <div className="flex items-end gap-2">
        <Field label="Fecha"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} /></Field>
        <Field label="Agrupar por"><select value={scope} onChange={(e) => setScope(e.target.value)} className={inputCls}><option value="DEPARTMENT">Área</option><option value="POSITION">Puesto</option></select></Field>
      </div>
      {loading ? <Spinner /> : !data ? <Empty note="Sin datos." /> : data.groups.length === 0 ? <Empty note="Sin personal activo." /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {data.groups.map((g: any) => (
            <div key={g.key} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <p className="font-medium text-gray-800">{g.name}</p>
                <span className={`text-sm font-bold ${stCls[g.status]}`}>{g.percent}%</span>
              </div>
              <div className="mt-2 bg-gray-100 rounded-full h-2 overflow-hidden">
                <div className={`h-2 ${g.status === 'CRITICAL' ? 'bg-red-500' : g.status === 'WARNING' ? 'bg-amber-500' : 'bg-green-500'}`} style={{ width: `${Math.min(g.percent, 100)}%` }} />
              </div>
              <p className="text-xs text-gray-500 mt-2">Disponibles {g.available}/{g.total} · mínimo {g.minCoveragePercent}%{g.critical && <span className="text-rose-600 font-medium"> · crítico</span>}</p>
              {g.status === 'CRITICAL' && <p className="text-xs text-red-600 mt-1">⚠ Cobertura crítica</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RulesView() {
  const [rules, setRules] = useState<any[]>([]);
  const [scopeType, setScopeType] = useState('DEPARTMENT');
  const [groups, setGroups] = useState<any[]>([]);
  const [f, setF] = useState<any>({ scopeId: '', minCoveragePercent: 60, critical: false, onBreach: 'WARN' });
  const loadRules = useCallback(async () => { try { const r = await apiFetch<any>('/absences/coverage-rules'); setRules(r?.items || []); } catch { /* */ } }, []);
  const loadGroups = useCallback(async () => { try { const r = await apiFetch<any>(`/absences/coverage?scopeType=${scopeType}`); setGroups((r?.groups || []).filter((g: any) => g.key !== 'none')); } catch { /* */ } }, [scopeType]);
  useEffect(() => { loadRules(); }, [loadRules]);
  useEffect(() => { loadGroups(); }, [loadGroups]);
  const add = async () => {
    if (!f.scopeId) { alert('Elegí un ámbito'); return; }
    const g = groups.find((x) => x.key === f.scopeId);
    try {
      await apiFetch('/absences/coverage-rules', { method: 'POST', json: { scopeType, scopeId: f.scopeId, scopeName: g?.name, minCoveragePercent: Number(f.minCoveragePercent), critical: f.critical, onBreach: f.onBreach } });
      setF({ scopeId: '', minCoveragePercent: 60, critical: false, onBreach: 'WARN' }); loadRules();
    } catch (e: any) { alert(e?.message || 'Error'); }
  };
  const del = async (id: string) => { try { await apiFetch(`/absences/coverage-rules/${id}`, { method: 'DELETE' }); loadRules(); } catch { /* */ } };
  const ON_BREACH: Record<string, string> = { WARN: 'Advertir', REQUIRE_APPROVAL: 'Requiere aprobación', BLOCK: 'Bloquear', ALLOW_EXCEPTION: 'Permitir excepción' };
  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-2">
        <p className="text-sm font-semibold text-gray-700">Nueva regla de cobertura</p>
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Tipo"><select value={scopeType} onChange={(e) => { setScopeType(e.target.value); setF({ ...f, scopeId: '' }); }} className={inputCls}><option value="DEPARTMENT">Área</option><option value="POSITION">Puesto</option></select></Field>
          <Field label="Ámbito"><select value={f.scopeId} onChange={(e) => setF({ ...f, scopeId: e.target.value })} className={inputCls}><option value="">Seleccionar…</option>{groups.map((g) => <option key={g.key} value={g.key}>{g.name}</option>)}</select></Field>
          <Field label="Mínimo %"><input type="number" value={f.minCoveragePercent} onChange={(e) => setF({ ...f, minCoveragePercent: e.target.value })} className={`${inputCls} w-24`} /></Field>
          <Field label="Al incumplir"><select value={f.onBreach} onChange={(e) => setF({ ...f, onBreach: e.target.value })} className={inputCls}>{Object.entries(ON_BREACH).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          <label className="flex items-center gap-2 text-sm text-gray-700 pb-2"><input type="checkbox" checked={f.critical} onChange={(e) => setF({ ...f, critical: e.target.checked })} /> Crítico</label>
          <button onClick={add} className="px-3 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg mb-0.5">Agregar</button>
        </div>
      </div>
      {rules.length === 0 ? <Empty note="No hay reglas configuradas." /> : (
        <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
          {rules.map((r) => (
            <div key={r.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <div>
                <p className="font-medium text-gray-800">{r.scopeName || r.scopeId || r.scopeKey} <span className="text-xs text-gray-400">({r.scopeType})</span></p>
                <p className="text-xs text-gray-500">Mínimo {r.minCoveragePercent}% · {ON_BREACH[r.onBreach] || r.onBreach}{r.critical ? ' · crítico' : ''}{!r.active ? ' · inactiva' : ''}</p>
              </div>
              <button onClick={() => del(r.id)} className="text-red-500 hover:text-red-700"><X className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const DELEG_STATUS: Record<string, { label: string; cls: string }> = {
  SCHEDULED: { label: 'Programada', cls: 'bg-blue-100 text-blue-700' },
  ACTIVE: { label: 'Activa', cls: 'bg-green-100 text-green-700' },
  EXPIRED: { label: 'Vencida', cls: 'bg-gray-100 text-gray-500' },
  CANCELLED: { label: 'Cancelada', cls: 'bg-gray-100 text-gray-400' },
};
function DelegationsView({ employees }: { employees: Employee[] }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await apiFetch<any>('/absences/delegations'); setRows(r?.items || []); }
    catch { setRows([]); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const cancel = async (id: string) => {
    if (!confirm('¿Cancelar esta delegación?')) return;
    try { await apiFetch(`/absences/delegations/${id}`, { method: 'PATCH', json: { status: 'CANCELLED' } }); load(); } catch (e: any) { alert(e?.message || 'Error'); }
  };
  const del = async (id: string) => { if (!confirm('¿Eliminar?')) return; try { await apiFetch(`/absences/delegations/${id}`, { method: 'DELETE' }); load(); } catch { /* */ } };
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Matriz de delegación temporal de funciones</p>
        <button onClick={() => setShow(true)} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg"><Plus className="w-4 h-4" /> Nueva delegación</button>
      </div>
      {loading ? <Spinner /> : rows.length === 0 ? <Empty note="No hay delegaciones." /> : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr>
              <th className="text-left px-4 py-2">Función</th><th className="text-left px-4 py-2">Responsable habitual</th><th className="text-left px-4 py-2">Sustituto</th><th className="text-left px-4 py-2">Período</th><th className="text-left px-4 py-2">Estado</th><th className="text-right px-4 py-2"></th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-800">{d.functionName}</td>
                  <td className="px-4 py-2 text-gray-600">{empName(d.usualResponsible)}</td>
                  <td className="px-4 py-2">{d.substitute ? empName(d.substitute) : <span className="text-rose-600 text-xs">Sin cobertura</span>}</td>
                  <td className="px-4 py-2 text-gray-500 text-xs">{fmt(d.startDate)} → {fmt(d.endDate)}</td>
                  <td className="px-4 py-2"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${DELEG_STATUS[d.effectiveStatus]?.cls}`}>{DELEG_STATUS[d.effectiveStatus]?.label}</span></td>
                  <td className="px-4 py-2 text-right">
                    {d.effectiveStatus !== 'CANCELLED' && d.effectiveStatus !== 'EXPIRED' && <button onClick={() => cancel(d.id)} className="text-xs text-amber-600 hover:underline mr-2">Cancelar</button>}
                    <button onClick={() => del(d.id)} className="text-xs text-red-500 hover:underline">Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {show && <DelegationForm employees={employees} onClose={() => setShow(false)} onSaved={() => { setShow(false); load(); }} />}
    </div>
  );
}

function DelegationForm({ employees, onClose, onSaved }: { employees: Employee[]; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<any>({ functionName: '', usualResponsibleEmployeeId: '', substituteEmployeeId: '', delegationKind: 'FUNCTIONAL', startDate: '', endDate: '', scope: '', observations: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const submit = async () => {
    setErr('');
    if (!f.functionName || !f.startDate || !f.endDate) { setErr('Completá función y fechas.'); return; }
    setSaving(true);
    try {
      await apiFetch('/absences/delegations', { method: 'POST', json: {
        functionName: f.functionName, usualResponsibleEmployeeId: f.usualResponsibleEmployeeId || undefined,
        substituteEmployeeId: f.substituteEmployeeId || undefined, delegationKind: f.delegationKind,
        startDate: f.startDate, endDate: f.endDate, scope: f.scope || undefined, observations: f.observations || undefined,
      } });
      onSaved();
    } catch (e: any) { setErr(e?.message || 'Error'); } finally { setSaving(false); }
  };
  return (
    <Modal title="Nueva delegación de función" onClose={onClose}>
      <div className="space-y-3">
        {err && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{err}</div>}
        <Field label="Función *"><input value={f.functionName} onChange={(e) => setF({ ...f, functionName: e.target.value })} placeholder="Ej: Aprobar documentos" className={inputCls} /></Field>
        <Field label="Responsable habitual">
          <select value={f.usualResponsibleEmployeeId} onChange={(e) => setF({ ...f, usualResponsibleEmployeeId: e.target.value })} className={inputCls}>
            <option value="">—</option>{employees.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
          </select>
        </Field>
        <Field label="Sustituto">
          <select value={f.substituteEmployeeId} onChange={(e) => setF({ ...f, substituteEmployeeId: e.target.value })} className={inputCls}>
            <option value="">Sin cobertura</option>{employees.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
          </select>
        </Field>
        <Field label="Tipo de delegación">
          <select value={f.delegationKind} onChange={(e) => setF({ ...f, delegationKind: e.target.value })} className={inputCls}>
            <option value="FUNCTIONAL">Funcional</option><option value="OPERATIONAL">Operativa</option><option value="PERMISSIONS">Permisos</option>
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Desde *"><input type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} className={inputCls} /></Field>
          <Field label="Hasta *"><input type="date" value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} className={inputCls} /></Field>
        </div>
        <Field label="Alcance"><input value={f.scope} onChange={(e) => setF({ ...f, scope: e.target.value })} className={inputCls} /></Field>
        <Field label="Observaciones"><textarea value={f.observations} onChange={(e) => setF({ ...f, observations: e.target.value })} rows={2} className={inputCls} /></Field>
        <p className="text-[11px] text-gray-400">La delegación vence automáticamente al finalizar el período. No otorga permisos informáticos automáticamente.</p>
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
        <button onClick={submit} disabled={saving} className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-2">{saving && <Loader2 className="w-4 h-4 animate-spin" />} Guardar</button>
      </div>
    </Modal>
  );
}

/* ─────────── Primitivos ─────────── */
function SoonTab({ title, note }: { title: string; note: string }) {
  return (
    <div className="bg-white border border-dashed border-gray-300 rounded-lg p-10 text-center">
      <ShieldCheck className="w-10 h-10 text-gray-300 mx-auto mb-3" />
      <h3 className="text-lg font-semibold text-gray-700">{title}</h3>
      <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">{note}</p>
    </div>
  );
}
function Spinner() { return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>; }
function Empty({ note }: { note: string }) { return <div className="text-center py-10 text-sm text-gray-400">{note}</div>; }
function Kpi({ label, value }: { label: string; value: any }) {
  return <div className="bg-white p-4 rounded-lg border border-gray-200"><p className="text-xs text-gray-500">{label}</p><p className="text-2xl font-bold text-gray-900">{value}</p></div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="block text-xs font-medium text-gray-600 mb-1">{label}</span>{children}</label>;
}
function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex justify-between gap-4 border-b border-gray-50 py-1"><span className="text-gray-500">{k}</span><span className="text-gray-800 text-right">{v}</span></div>;
}
function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
