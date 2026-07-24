'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';
import {
  Calendar, Filter, Plus, Pencil, Trash2, GripVertical, Mail, FileText,
  AlertCircle, ChevronDown, ChevronUp, X, CheckCircle, Clock, RefreshCw,
  Send, Download, Eye,
} from 'lucide-react';

// ─── Tipos ───────────────────────────────────────────────────────────────
type Audit = {
  id: string;
  code: string;
  title: string;
  type: string;
  status: string;
  plannedStartDate: string | null;
  plannedEndDate: string | null;
  plannedStartTime: string | null;
  plannedEndTime: string | null;
  area: string;
  process: string | null;
  isoStandard: string[];
  modality: string | null;
  auditLocation: string | null;
  virtualMeetingLink: string | null;
  auditedProcessOwner: string | null;
  auditedProcessOwnerEmail: string | null;
  expectedParticipants: string | null;
  notificationStatus: string | null;
  leadAuditorId: string;
  programId: string;
  agendaItems?: AgendaItem[];
};

type AgendaItem = {
  id: string;
  order: number;
  itemDate: string | null;
  startTime: string | null;
  endTime: string | null;
  durationMinutes: number | null;
  activity: string;
  processOrTopic: string | null;
  criterion: string | null;
  requiredParticipants: string | null;
  location: string | null;
  expectedEvidence: string | null;
  observations: string | null;
};

type Program = { id: string; year: number; name: string };

// ─── Helpers ─────────────────────────────────────────────────────────────
const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador', PLANNED: 'Planificada', SCHEDULED: 'Programada',
  IN_PROGRESS: 'En ejecución', PENDING_REPORT: 'Pendiente informe',
  COMPLETED: 'Finalizada', CLOSED: 'Cerrada', CANCELLED: 'Cancelada',
  RESCHEDULED: 'Reprogramada',
};
const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  PLANNED: 'bg-blue-100 text-blue-700',
  SCHEDULED: 'bg-purple-100 text-purple-700',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-700',
  PENDING_REPORT: 'bg-orange-100 text-orange-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CLOSED: 'bg-gray-200 text-gray-600',
  CANCELLED: 'bg-red-100 text-red-700',
  RESCHEDULED: 'bg-indigo-100 text-indigo-700',
};
const NOTIF_LABELS: Record<string, string> = {
  PENDING_NOTIFICATION: 'Pendiente', DRAFT_READY: 'Borrador listo',
  SENT: 'Enviada', RECEIVED: 'Recibida', CONFIRMED: 'Confirmada',
  NEEDS_RESCHEDULE: 'Requiere reprogramación',
};
const MODALITY_LABELS: Record<string, string> = {
  PRESENCIAL: 'Presencial', REMOTA: 'Remota', HIBRIDA: 'Híbrida',
};

function formatDate(s: string | null) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('es-AR', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' });
}
function calcDuration(start: string | null, end: string | null, startDate: string | null, endDate: string | null): string {
  if (!start || !end) return '—';
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const startMins = sh * 60 + sm;
  const endMins = eh * 60 + em;
  let totalMins = endMins - startMins;
  if (startDate && endDate && startDate !== endDate) {
    const days = Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000);
    totalMins += days * 8 * 60;
  }
  if (totalMins <= 0) return '—';
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return h > 0 ? `${h}h ${m > 0 ? m + 'min' : ''}` : `${m}min`;
}

// ─── Modal de preparación de correo ──────────────────────────────────────
function NotifyModal({ audit, onClose }: { audit: Audit; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<{ to: string; subject: string; body: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setLoading(true);
    apiFetch(`/audit/audits/${audit.id}/notify/prepare`, { method: 'POST', json: {} })
      .then((r: any) => setDraft(r.draft))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [audit.id]);

  async function handleSendMark() {
    await apiFetch(`/audit/audits/${audit.id}/notify/send`, { method: 'POST', json: {} });
    onClose();
  }

  function copyText() {
    if (draft) {
      navigator.clipboard.writeText(`Para: ${draft.to}\nAsunto: ${draft.subject}\n\n${draft.body}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Mail className="w-5 h-5 text-blue-600" />
            Preparar notificación — {audit.code}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading && <div className="text-center text-gray-500 py-8">Generando borrador...</div>}
          {draft && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Para</label>
                <input
                  value={draft.to}
                  onChange={e => setDraft({ ...draft, to: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Asunto</label>
                <input
                  value={draft.subject}
                  onChange={e => setDraft({ ...draft, subject: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Cuerpo del mensaje</label>
                <textarea
                  value={draft.body}
                  onChange={e => setDraft({ ...draft, body: e.target.value })}
                  rows={12}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono text-xs"
                />
              </div>
              <p className="text-xs text-gray-500 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
                <AlertCircle className="w-3 h-3 inline mr-1 text-yellow-600" />
                El PDF de agenda se adjuntará automáticamente. Si el correo no se puede enviar desde el sistema, copiá el texto y envialo manualmente.
              </p>
            </>
          )}
        </div>
        {draft && (
          <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center">
            <button onClick={copyText} className="inline-flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg border border-gray-200">
              {copied ? <CheckCircle className="w-4 h-4 text-green-600" /> : <Download className="w-4 h-4" />}
              {copied ? 'Copiado' : 'Copiar texto'}
            </button>
            <div className="flex gap-2">
              <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm">Cancelar</button>
              <button onClick={handleSendMark} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
                <Send className="w-4 h-4" />
                Marcar como enviada
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Modal de agenda detallada ────────────────────────────────────────────
function AgendaDetailModal({ audit, onClose }: { audit: Audit; onClose: () => void }) {
  const [items, setItems] = useState<AgendaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editItem, setEditItem] = useState<AgendaItem | null>(null);
  const [newItem, setNewItem] = useState({
    itemDate: '', startTime: '', endTime: '', activity: '',
    processOrTopic: '', criterion: '', requiredParticipants: '',
    location: '', expectedEvidence: '', observations: '',
  });
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    apiFetch(`/audit/audits/${audit.id}/agenda-items`)
      .then((r: any) => setItems(Array.isArray(r?.items) ? r.items : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [audit.id]);

  useEffect(() => { load(); }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch(`/audit/audits/${audit.id}/agenda-items`, { method: 'POST', json: newItem });
      setNewItem({ itemDate: '', startTime: '', endTime: '', activity: '', processOrTopic: '', criterion: '', requiredParticipants: '', location: '', expectedEvidence: '', observations: '' });
      setShowAddForm(false);
      load();
    } catch {} finally { setSaving(false); }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editItem) return;
    setSaving(true);
    try {
      await apiFetch(`/audit/agenda-items/${editItem.id}`, { method: 'PATCH', json: editItem });
      setEditItem(null);
      load();
    } catch {} finally { setSaving(false); }
  }

  async function handleDelete(itemId: string) {
    await apiFetch(`/audit/agenda-items/${itemId}`, { method: 'DELETE' });
    setDeleteConfirm(null);
    load();
  }

  const calcDur = (s: string | null, e: string | null) => {
    if (!s || !e) return null;
    const [sh, sm] = s.split(':').map(Number);
    const [eh, em] = e.split(':').map(Number);
    const mins = (eh * 60 + em) - (sh * 60 + sm);
    if (mins <= 0) return null;
    const h = Math.floor(mins / 60); const m = mins % 60;
    return h > 0 ? `${h}h${m > 0 ? ` ${m}min` : ''}` : `${m}min`;
  };

  const SUGGESTED = [
    'Reunión de apertura', 'Presentación del proceso', 'Revisión documental',
    'Entrevistas al personal', 'Recorrido operativo', 'Muestreo de registros',
    'Evaluación de requisitos', 'Preparación de conclusiones', 'Reunión de cierre',
  ];

  const ItemForm = ({ data, setData, onSubmit, onCancel, title }: any) => (
    <form onSubmit={onSubmit} className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
      <h4 className="text-sm font-semibold text-blue-900">{title}</h4>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Fecha</label>
          <input type="date" value={data.itemDate || ''} onChange={e => setData({ ...data, itemDate: e.target.value })}
            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Hora inicio</label>
          <input type="time" value={data.startTime || ''} onChange={e => setData({ ...data, startTime: e.target.value })}
            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Hora fin {data.startTime && data.endTime && <span className="text-blue-600 font-medium ml-1">{calcDur(data.startTime, data.endTime)}</span>}
          </label>
          <input type="time" value={data.endTime || ''} onChange={e => setData({ ...data, endTime: e.target.value })}
            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Actividad <span className="text-red-500">*</span></label>
        <div className="flex gap-2">
          <input value={data.activity || ''} onChange={e => setData({ ...data, activity: e.target.value })} required
            placeholder="Ej: Reunión de apertura" className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-sm" />
          <select onChange={e => { if (e.target.value) setData({ ...data, activity: e.target.value }); e.target.value = ''; }}
            className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-600">
            <option value="">Sugerencia...</option>
            {SUGGESTED.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Proceso / Tema</label>
          <input value={data.processOrTopic || ''} onChange={e => setData({ ...data, processOrTopic: e.target.value })}
            placeholder="Proceso o tema específico" className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Criterio / Requisito</label>
          <input value={data.criterion || ''} onChange={e => setData({ ...data, criterion: e.target.value })}
            placeholder="Cláusula o requisito de referencia" className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Lugar</label>
          <input value={data.location || ''} onChange={e => setData({ ...data, location: e.target.value })}
            placeholder="Sala o sector" className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Participantes requeridos</label>
          <input value={data.requiredParticipants || ''} onChange={e => setData({ ...data, requiredParticipants: e.target.value })}
            placeholder="Nombres o roles" className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Evidencia / documentación esperada</label>
        <textarea value={data.expectedEvidence || ''} onChange={e => setData({ ...data, expectedEvidence: e.target.value })}
          rows={2} placeholder="Registros, documentos, muestras..." className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm" />
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
        <button type="submit" disabled={saving} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </form>
  );

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{audit.code} — Agenda detallada</h3>
            <p className="text-sm text-gray-500">{audit.title}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="text-center py-8 text-gray-400">Cargando agenda...</div>
          ) : (
            <>
              {items.length === 0 && !showAddForm && (
                <div className="text-center py-10 text-gray-400">
                  <Calendar className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No hay actividades en la agenda de esta auditoría.</p>
                </div>
              )}
              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div key={item.id} className="border border-gray-200 rounded-xl p-3 bg-gray-50 hover:bg-white transition-colors">
                    {editItem?.id === item.id ? (
                      <ItemForm data={editItem} setData={setEditItem} onSubmit={handleUpdate} onCancel={() => setEditItem(null)} title="Editar actividad" />
                    ) : (
                      <div className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-bold">{idx + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            {item.startTime && (
                              <span className="text-xs font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                                {item.startTime}{item.endTime ? ` → ${item.endTime}` : ''} {calcDur(item.startTime, item.endTime) && <span className="text-blue-500">({calcDur(item.startTime, item.endTime)})</span>}
                              </span>
                            )}
                            {item.itemDate && <span className="text-xs text-gray-500">{formatDate(item.itemDate)}</span>}
                          </div>
                          <p className="font-medium text-gray-900 text-sm">{item.activity}</p>
                          <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500">
                            {item.processOrTopic && <span>📋 {item.processOrTopic}</span>}
                            {item.criterion && <span>📌 {item.criterion}</span>}
                            {item.location && <span>📍 {item.location}</span>}
                            {item.requiredParticipants && <span>👥 {item.requiredParticipants}</span>}
                          </div>
                          {item.expectedEvidence && (
                            <p className="text-xs text-gray-400 mt-1 italic">Evidencia: {item.expectedEvidence}</p>
                          )}
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <button onClick={() => setEditItem(item)} className="p-1 hover:bg-gray-200 rounded text-gray-500"><Pencil className="w-3.5 h-3.5" /></button>
                          {deleteConfirm === item.id ? (
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-red-600">¿Eliminar?</span>
                              <button onClick={() => handleDelete(item.id)} className="text-xs px-2 py-0.5 bg-red-600 text-white rounded">Sí</button>
                              <button onClick={() => setDeleteConfirm(null)} className="text-xs px-2 py-0.5 bg-gray-200 text-gray-700 rounded">No</button>
                            </div>
                          ) : (
                            <button onClick={() => setDeleteConfirm(item.id)} className="p-1 hover:bg-gray-200 rounded text-gray-500"><Trash2 className="w-3.5 h-3.5" /></button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {showAddForm && (
                <ItemForm data={newItem} setData={setNewItem} onSubmit={handleAdd} onCancel={() => setShowAddForm(false)} title="Nueva actividad" />
              )}
              {!showAddForm && (
                <button onClick={() => setShowAddForm(true)}
                  className="w-full border-2 border-dashed border-blue-200 rounded-xl py-3 text-blue-600 hover:border-blue-400 hover:bg-blue-50 transition-colors text-sm flex items-center justify-center gap-2">
                  <Plus className="w-4 h-4" /> Agregar actividad
                </button>
              )}
            </>
          )}
        </div>
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cerrar</button>
        </div>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────
export default function AgendaAuditorias() {
  const [audits, setAudits] = useState<Audit[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [filters, setFilters] = useState({
    programId: '', year: String(new Date().getFullYear()),
    status: '', modality: '', area: '',
  });
  const [showFilters, setShowFilters] = useState(false);

  // Selección de auditoría para detalle
  const [selectedAudit, setSelectedAudit] = useState<Audit | null>(null);
  const [notifyAudit, setNotifyAudit] = useState<Audit | null>(null);

  // Confirmación de cancelar/eliminar
  const [cancelModal, setCancelModal] = useState<{ audit: Audit } | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelSaving, setCancelSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.programId) params.set('programId', filters.programId);
      if (filters.year)      params.set('year', filters.year);
      if (filters.status)    params.set('status', filters.status);
      if (filters.modality)  params.set('modality', filters.modality);
      if (filters.area)      params.set('area', filters.area);

      const [agendaRes, programsRes] = await Promise.all([
        apiFetch(`/audit/agenda?${params.toString()}`) as Promise<{ audits: Audit[] }>,
        apiFetch('/audit/programs') as Promise<{ programs: Program[] }>,
      ]);
      setAudits(Array.isArray(agendaRes?.audits) ? agendaRes.audits : []);
      setPrograms(Array.isArray(programsRes?.programs) ? programsRes.programs : []);
    } catch (err) {
      setError('Error al cargar la agenda');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  async function handleCancel() {
    if (!cancelModal || !cancelReason.trim()) return;
    setCancelSaving(true);
    try {
      await apiFetch(`/audit/audits/${cancelModal.audit.id}/cancel`, { method: 'POST', json: { reason: cancelReason } });
      setCancelModal(null);
      setCancelReason('');
      load();
    } catch (err: any) {
      setError(err?.error || 'Error al cancelar');
    } finally {
      setCancelSaving(false);
    }
  }

  const hasMissingData = (a: Audit) => !a.plannedStartTime || !a.auditedProcessOwner || !a.modality;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Agenda de Auditorías</h2>
          <p className="text-sm text-gray-500">{audits.length} auditoría{audits.length !== 1 ? 's' : ''} encontrada{audits.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${showFilters ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
        >
          <Filter className="w-4 h-4" />
          Filtros
          {showFilters ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {/* Filtros */}
      {showFilters && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Programa</label>
              <select value={filters.programId} onChange={e => setFilters({ ...filters, programId: e.target.value })}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm">
                <option value="">Todos</option>
                {programs.map(p => <option key={p.id} value={p.id}>{p.year} — {p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Año</label>
              <input type="number" value={filters.year} onChange={e => setFilters({ ...filters, year: e.target.value })}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm" min="2020" max="2030" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Estado</label>
              <select value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm">
                <option value="">Todos</option>
                {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Modalidad</label>
              <select value={filters.modality} onChange={e => setFilters({ ...filters, modality: e.target.value })}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm">
                <option value="">Todas</option>
                {Object.entries(MODALITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Proceso / Área</label>
              <input value={filters.area} onChange={e => setFilters({ ...filters, area: e.target.value })}
                placeholder="Buscar..." className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm" />
            </div>
          </div>
          <button onClick={() => setFilters({ programId: '', year: String(new Date().getFullYear()), status: '', modality: '', area: '' })}
            className="mt-2 text-xs text-gray-400 hover:text-gray-600">
            Limpiar filtros
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2 text-sm">
          <AlertCircle className="w-4 h-4" />{error}
        </div>
      )}

      {/* Tabla */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
        </div>
      ) : audits.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No hay auditorías con los filtros seleccionados.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Código</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Fecha</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Horario</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Auditoría</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Proceso / Área</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Responsable auditado</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Modalidad / Lugar</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Notif.</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {audits.map((audit) => (
                  <tr key={audit.id} className={`hover:bg-gray-50 transition-colors ${audit.status === 'CANCELLED' ? 'opacity-60' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {hasMissingData(audit) && (
                          <span title="Planificación incompleta" className="w-2 h-2 rounded-full bg-yellow-400 flex-shrink-0" />
                        )}
                        <span className="font-mono font-medium text-gray-900 text-xs">{audit.code}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                      {formatDate(audit.plannedStartDate)}
                      {audit.plannedEndDate && audit.plannedEndDate !== audit.plannedStartDate && (
                        <span className="text-gray-400 text-xs block">→ {formatDate(audit.plannedEndDate)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                      {audit.plannedStartTime && audit.plannedEndTime ? (
                        <div>
                          <span className="font-mono text-xs">{audit.plannedStartTime} – {audit.plannedEndTime}</span>
                          <span className="block text-xs text-gray-400">{calcDuration(audit.plannedStartTime, audit.plannedEndTime, audit.plannedStartDate, audit.plannedEndDate)}</span>
                        </div>
                      ) : <span className="text-gray-300 italic text-xs">Sin horario</span>}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/auditorias/${audit.id}`} className="font-medium text-blue-700 hover:text-blue-900 hover:underline text-xs leading-tight block max-w-[180px] truncate">{audit.title}</Link>
                      <span className="text-xs text-gray-400">{audit.isoStandard?.join(', ')}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 text-xs">
                      <span className="block font-medium">{audit.area}</span>
                      {audit.process && <span className="text-gray-400">{audit.process}</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-700 text-xs">
                      {audit.auditedProcessOwner || <span className="text-gray-300 italic">Sin definir</span>}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {audit.modality ? (
                        <span className={`px-2 py-0.5 rounded-full font-medium ${audit.modality === 'PRESENCIAL' ? 'bg-green-100 text-green-700' : audit.modality === 'REMOTA' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                          {MODALITY_LABELS[audit.modality]}
                        </span>
                      ) : <span className="text-gray-300">—</span>}
                      {audit.auditLocation && <span className="block text-gray-400 mt-0.5 truncate max-w-[120px]">{audit.auditLocation}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[audit.status] || 'bg-gray-100 text-gray-700'}`}>
                        {STATUS_LABELS[audit.status] || audit.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {audit.notificationStatus ? (
                        <span className={`px-2 py-0.5 rounded-full font-medium ${
                          audit.notificationStatus === 'SENT' || audit.notificationStatus === 'CONFIRMED' ? 'bg-green-100 text-green-700' :
                          audit.notificationStatus === 'DRAFT_READY' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                        }`}>{NOTIF_LABELS[audit.notificationStatus] || audit.notificationStatus}</span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button title="Ver agenda detallada" onClick={() => setSelectedAudit(audit)}
                          className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-600 transition-colors">
                          <Calendar className="w-4 h-4" />
                        </button>
                        <Link href={`/auditorias/${audit.id}`} title="Ver detalle"
                          className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors">
                          <Eye className="w-4 h-4" />
                        </Link>
                        {audit.status !== 'CANCELLED' && (
                          <button title="Preparar notificación" onClick={() => setNotifyAudit(audit)}
                            className="p-1.5 hover:bg-green-50 rounded-lg text-green-600 transition-colors">
                            <Mail className="w-4 h-4" />
                          </button>
                        )}
                        {!['COMPLETED', 'CLOSED', 'CANCELLED'].includes(audit.status) && (
                          <button title="Cancelar auditoría" onClick={() => setCancelModal({ audit })}
                            className="p-1.5 hover:bg-red-50 rounded-lg text-red-500 transition-colors">
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Leyenda */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-400" />Planificación incompleta</div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-100 border border-green-300" />Notificada/Confirmada</div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-100 border border-red-300" />Cancelada</div>
      </div>

      {/* Modales */}
      {selectedAudit && <AgendaDetailModal audit={selectedAudit} onClose={() => { setSelectedAudit(null); load(); }} />}
      {notifyAudit && <NotifyModal audit={notifyAudit} onClose={() => { setNotifyAudit(null); load(); }} />}

      {/* Modal cancelar */}
      {cancelModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Cancelar auditoría</h3>
            <p className="text-sm text-gray-600"><strong>{cancelModal.audit.code}</strong> — {cancelModal.audit.title}</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Motivo de cancelación <span className="text-red-500">*</span></label>
              <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} rows={3}
                placeholder="Describir el motivo de la cancelación..." required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => { setCancelModal(null); setCancelReason(''); }} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
              <button onClick={handleCancel} disabled={!cancelReason.trim() || cancelSaving}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
                {cancelSaving ? 'Guardando...' : 'Confirmar cancelación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
