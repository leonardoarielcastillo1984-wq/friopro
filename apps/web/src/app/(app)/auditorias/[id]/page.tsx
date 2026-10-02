'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { ChevronLeft, Edit2, FileText, CheckCircle, Clock, AlertCircle, Calendar, Play, AlertTriangle } from 'lucide-react';

type Audit = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  plannedStartDate: string | null;
  plannedEndDate: string | null;
  actualStartDate: string | null;
  actualEndDate: string | null;
  duration: number | null;
  leadAuditorId: string;
  leadAuditor?: { id: string; name: string; type: string } | null;
  area: string;
  process: string | null;
  isoStandard: string[];
  scope: string | null;
  objective: string | null;
  interviewees: string | null;
  createdAt: string;
  // Planning & Coordination
  plannedStartTime: string | null;
  plannedEndTime: string | null;
  modality: string | null;
  auditLocation: string | null;
  locationAddress: string | null;
  virtualMeetingLink: string | null;
  auditedProcessOwner: string | null;
  auditedProcessOwnerEmail: string | null;
  expectedParticipants: string | null;
  additionalAuditTeam: string | null;
  logisticObservations: string | null;
  specialInstructions: string | null;
  requiresOpeningMeeting: boolean;
  requiresClosingMeeting: boolean;
  notificationStatus: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  rescheduleCount: number;
  // IATF 16949
  shifts: string[];
  processId: string | null;
  triggerSource: string | null;
  triggerDescription: string | null;
  reportDueDate: string | null;
  productName: string | null;
  productionPhase: string | null;
  sampleSize: string | null;
  // Enriquecidos por el backend
  linkedProcess?: { id: string; name: string; code: string | null; owner?: string | null } | null;
  independenceWarning?: boolean;
  reportOverdue?: boolean;
};

type Finding = {
  id: string;
  code: string;
  type: 'NON_CONFORMITY' | 'OBSERVATION' | 'OPPORTUNITY';
  severity: 'CRITICAL' | 'MAJOR' | 'MINOR' | 'TRIVIAL';
  status: string;
  description: string;
  area: string;
  responsibleId: string;
  detectedAt: string;
};

const TYPE_LABELS: Record<string, string> = {
  'INTERNAL': 'Interna',
  'EXTERNAL': 'Externa',
  'SUPPLIER': 'Proveedor',
  'CUSTOMER': 'Cliente',
  'CERTIFICATION': 'Certificación',
  'RECERTIFICATION': 'Recertificación',
  'SURVEILLANCE': 'Vigilancia',
  'SYSTEM': 'De Sistema (IATF 9.2.2.1)',
  'MANUFACTURING_PROCESS': 'Proceso de Manufactura (IATF 9.2.2.2)',
  'PRODUCT': 'De Producto (IATF 9.2.2.3)',
};

const SHIFT_LABELS: Record<string, string> = {
  MORNING: 'Mañana',
  AFTERNOON: 'Tarde',
  NIGHT: 'Noche',
};

const TRIGGER_LABELS: Record<string, string> = {
  SCHEDULED: 'Programada (plan anual)',
  SCORECARD: 'Scorecard / desempeño de cliente',
  CUSTOMER_COMPLAINT: 'Reclamo de cliente',
  EXTERNAL_NC: 'NC externa / auditoría previa',
  PROCESS_CHANGE: 'Cambio en el proceso',
  PERFORMANCE_TREND: 'Tendencia de desempeño adversa',
};

type ProcessOption = { id: string; name: string; code?: string };

const STATUS_LABELS: Record<string, string> = {
  'DRAFT': 'Borrador',
  'PLANNED': 'Planificada',
  'SCHEDULED': 'Programada',
  'IN_PROGRESS': 'En ejecución',
  'PENDING_REPORT': 'Pendiente informe',
  'COMPLETED': 'Finalizada',
  'CLOSED': 'Cerrada',
};

const STATUS_COLORS: Record<string, string> = {
  'DRAFT': 'bg-gray-100 text-gray-800',
  'PLANNED': 'bg-blue-100 text-blue-800',
  'SCHEDULED': 'bg-purple-100 text-purple-800',
  'IN_PROGRESS': 'bg-yellow-100 text-yellow-800',
  'PENDING_REPORT': 'bg-orange-100 text-orange-800',
  'COMPLETED': 'bg-green-100 text-green-800',
  'CLOSED': 'bg-gray-100 text-gray-800',
};

export default function AuditDetailPage() {
  const params = useParams();
  const pathname = usePathname();
  const auditId = params.id as string;
  
  const [audit, setAudit] = useState<Audit | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    status: 'DRAFT',
    type: 'INTERNAL',
    area: '',
    process: '',
    scope: '',
    objective: '',
    interviewees: '',
    plannedStartDate: '',
    plannedEndDate: '',
    // Planning & Coordination
    plannedStartTime: '',
    plannedEndTime: '',
    modality: '',
    auditLocation: '',
    locationAddress: '',
    virtualMeetingLink: '',
    auditedProcessOwner: '',
    auditedProcessOwnerEmail: '',
    expectedParticipants: '',
    additionalAuditTeam: '',
    logisticObservations: '',
    specialInstructions: '',
    requiresOpeningMeeting: true,
    requiresClosingMeeting: true,
    // IATF
    processId: '',
    shifts: [] as string[],
    triggerSource: '',
    triggerDescription: '',
    reportDueDate: '',
    productName: '',
    productionPhase: '',
    sampleSize: '',
  });
  const [showPlanningEdit, setShowPlanningEdit] = useState(false);
  const [showIatfEdit, setShowIatfEdit] = useState(false);
  const [processes, setProcesses] = useState<ProcessOption[]>([]);

  useEffect(() => {
    if (auditId) {
      loadAudit();
    }
  }, [auditId]);

  async function loadAudit() {
    try {
      setLoading(true);
      const [auditRes, findingsRes] = await Promise.all([
        apiFetch(`/audit/audits/${auditId}`) as Promise<{ audit: Audit }>,
        apiFetch(`/audit/audits/${auditId}/findings`) as Promise<{ findings: Finding[] }>,
      ]);

      if (auditRes.audit) setAudit(auditRes.audit);
      if (findingsRes.findings) setFindings(findingsRes.findings);

      // Procesos del mapa para el selector IATF en el modal de edición
      apiFetch('/objectives/processes')
        .then((res) => setProcesses(Array.isArray(res) ? res as ProcessOption[] : []))
        .catch(() => setProcesses([]));
    } catch (err) {
      setError('Error al cargar la auditoría');
    } finally {
      setLoading(false);
    }
  }

  function toDateInputValue(date: string | null) {
    if (!date) return '';
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  }

  function openEdit() {
    if (!audit) return;
    setError(null);
    const hasPlanning = !!(audit.plannedStartTime || audit.modality || audit.auditLocation || audit.auditedProcessOwner);
    setShowPlanningEdit(hasPlanning);
    setShowIatfEdit(!!(audit.processId || (audit.shifts || []).length || audit.triggerSource || audit.reportDueDate || audit.productName));
    setEditForm({
      title: audit.title || '',
      description: audit.description || '',
      status: audit.status || 'DRAFT',
      type: audit.type || 'INTERNAL',
      area: audit.area || '',
      process: audit.process || '',
      scope: audit.scope || '',
      objective: audit.objective || '',
      interviewees: audit.interviewees || '',
      plannedStartDate: toDateInputValue(audit.plannedStartDate),
      plannedEndDate: toDateInputValue(audit.plannedEndDate),
      // Planning & Coordination
      plannedStartTime: audit.plannedStartTime || '',
      plannedEndTime: audit.plannedEndTime || '',
      modality: audit.modality || '',
      auditLocation: audit.auditLocation || '',
      locationAddress: audit.locationAddress || '',
      virtualMeetingLink: audit.virtualMeetingLink || '',
      auditedProcessOwner: audit.auditedProcessOwner || '',
      auditedProcessOwnerEmail: audit.auditedProcessOwnerEmail || '',
      expectedParticipants: audit.expectedParticipants || '',
      additionalAuditTeam: audit.additionalAuditTeam || '',
      logisticObservations: audit.logisticObservations || '',
      specialInstructions: audit.specialInstructions || '',
      requiresOpeningMeeting: audit.requiresOpeningMeeting ?? true,
      requiresClosingMeeting: audit.requiresClosingMeeting ?? true,
      processId: audit.processId || '',
      shifts: audit.shifts || [],
      triggerSource: audit.triggerSource || '',
      triggerDescription: audit.triggerDescription || '',
      reportDueDate: toDateInputValue(audit.reportDueDate),
      productName: audit.productName || '',
      productionPhase: audit.productionPhase || '',
      sampleSize: audit.sampleSize || '',
    });
    setShowEditModal(true);
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!audit) return;
    try {
      setSaving(true);
      setError(null);
      const t = (s: string) => s?.trim() || null;
      const payload: any = {
        title: editForm.title,
        description: t(editForm.description),
        status: editForm.status,
        type: editForm.type,
        area: editForm.area,
        process: t(editForm.process),
        scope: t(editForm.scope),
        objective: t(editForm.objective),
        interviewees: t(editForm.interviewees),
        plannedStartDate: editForm.plannedStartDate ? new Date(editForm.plannedStartDate).toISOString() : null,
        plannedEndDate: editForm.plannedEndDate ? new Date(editForm.plannedEndDate).toISOString() : null,
        // Planning & Coordination
        plannedStartTime: t(editForm.plannedStartTime),
        plannedEndTime: t(editForm.plannedEndTime),
        modality: editForm.modality || null,
        auditLocation: t(editForm.auditLocation),
        locationAddress: t(editForm.locationAddress),
        virtualMeetingLink: t(editForm.virtualMeetingLink),
        auditedProcessOwner: t(editForm.auditedProcessOwner),
        auditedProcessOwnerEmail: t(editForm.auditedProcessOwnerEmail),
        expectedParticipants: t(editForm.expectedParticipants),
        additionalAuditTeam: t(editForm.additionalAuditTeam),
        logisticObservations: t(editForm.logisticObservations),
        specialInstructions: t(editForm.specialInstructions),
        requiresOpeningMeeting: editForm.requiresOpeningMeeting,
        requiresClosingMeeting: editForm.requiresClosingMeeting,
        // IATF
        processId: editForm.processId || null,
        shifts: editForm.shifts,
        triggerSource: editForm.triggerSource || null,
        triggerDescription: t(editForm.triggerDescription),
        reportDueDate: editForm.reportDueDate ? new Date(editForm.reportDueDate).toISOString() : null,
        productName: t(editForm.productName),
        productionPhase: t(editForm.productionPhase),
        sampleSize: t(editForm.sampleSize),
      };

      const res = await apiFetch(`/audit/audits/${auditId}`, {
        method: 'PATCH',
        json: payload,
      }) as { audit: Audit };

      if (res.audit) {
        setAudit(res.audit);
        setShowEditModal(false);
      }
    } catch (err) {
      console.error('Error updating audit:', err);
      setError(err instanceof Error ? err.message : 'Error al actualizar la auditoría');
    } finally {
      setSaving(false);
    }
  }

  function formatDate(date: string | null) {
    if (!date) return 'No definida';
    return new Date(date).toLocaleDateString('es-ES', {
      timeZone: 'UTC',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  function getSeverityColor(severity: string) {
    switch (severity) {
      case 'CRITICAL': return 'bg-red-100 text-red-800';
      case 'MAJOR': return 'bg-orange-100 text-orange-800';
      case 'MINOR': return 'bg-yellow-100 text-yellow-800';
      case 'TRIVIAL': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  function getTypeColor(type: string) {
    switch (type) {
      case 'NON_CONFORMITY': return 'bg-red-100 text-red-800';
      case 'OBSERVATION': return 'bg-yellow-100 text-yellow-800';
      case 'OPPORTUNITY': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error || !audit) {
    return (
      <div className="space-y-6">
        <Link href="/auditorias" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800">
          <ChevronLeft className="w-4 h-4" />
          Volver al listado
        </Link>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error || 'Auditoría no encontrada'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link 
            href="/auditorias" 
            className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 mb-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Volver al listado
          </Link>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-900">{audit.code}</h1>
            <span className={`px-3 py-1 rounded-full text-sm ${STATUS_COLORS[audit.status]}`}>
              {STATUS_LABELS[audit.status]}
            </span>
          </div>
          <p className="text-gray-600">{audit.title}</p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/auditorias/${auditId}/execute`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Play className="w-4 h-4" />
            Ejecutar
          </Link>
          <button
            onClick={openEdit}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Edit2 className="w-4 h-4" />
            Editar
          </button>
        </div>
      </div>

      {/* Alertas IATF */}
      {(audit.independenceWarning || audit.reportOverdue) && (
        <div className="space-y-2">
          {audit.independenceWarning && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg flex items-center gap-2 text-sm">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span><b>Alerta de independencia (§9.2.2 a):</b> el auditor líder es el responsable del proceso auditado. IATF exige que los auditores no auditen su propio trabajo — asignar otro auditor.</span>
            </div>
          )}
          {audit.reportOverdue && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span><b>Informe vencido:</b> superó el plazo de emisión ({audit.reportDueDate ? formatDate(audit.reportDueDate) : ''}). Emitir el informe para cerrar la auditoría.</span>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-8">
          {[
            { href: `/auditorias/${auditId}`, label: 'General', icon: FileText },
            { href: `/auditorias/${auditId}/checklist`, label: 'Checklist', icon: CheckCircle },
            { href: `/auditorias/${auditId}/findings`, label: `Hallazgos (${findings.length})`, icon: AlertCircle },
            { href: `/auditorias/${auditId}/reporte`, label: 'Informe', icon: FileText },
          ].map((tab) => {
            const isActive = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex items-center gap-2 py-4 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Tipo de Auditoría</h3>
              <p className="text-gray-900">{TYPE_LABELS[audit.type] || audit.type}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Área / Proceso</h3>
              <p className="text-gray-900">{audit.area}{audit.process ? ` / ${audit.process}` : ''}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Auditor Líder</h3>
              <p className="text-gray-900">
                {audit.leadAuditor
                  ? `${audit.leadAuditor.name} (${audit.leadAuditor.type === 'INTERNAL' ? 'Interno' : 'Externo'})`
                  : 'No asignado'}
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Fechas Planificadas</h3>
              <p className="text-gray-900">
                {formatDate(audit.plannedStartDate)} - {formatDate(audit.plannedEndDate)}
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Duración</h3>
              <p className="text-gray-900">{audit.duration ? `${audit.duration} horas` : 'No definida'}</p>
            </div>
          </div>

          {audit.description && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Descripción</h3>
              <p className="text-gray-900">{audit.description}</p>
            </div>
          )}

          {audit.scope && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Alcance</h3>
              <p className="text-gray-900">{audit.scope}</p>
            </div>
          )}

          {audit.objective && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Objetivo</h3>
              <p className="text-gray-900">{audit.objective}</p>
            </div>
          )}

          {audit.interviewees && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Entrevistados</h3>
              <p className="text-gray-900 whitespace-pre-line">{audit.interviewees}</p>
            </div>
          )}

          {audit.isoStandard.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Normas Aplicables</h3>
              <div className="flex flex-wrap gap-2">
                {audit.isoStandard.map((std) => (
                  <span key={std} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm">
                    {std.replace('_', ' ')}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Datos IATF 16949 */}
          {(audit.linkedProcess || (audit.shifts || []).length > 0 || audit.triggerSource || audit.reportDueDate || audit.productName) && (
            <div className="border-t border-gray-100 pt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Datos IATF 16949</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {audit.linkedProcess && (
                  <div>
                    <h4 className="text-xs font-medium text-gray-500 mb-1">Proceso del mapa auditado</h4>
                    <p className="text-gray-900 text-sm">
                      {audit.linkedProcess.code ? `[${audit.linkedProcess.code}] ` : ''}{audit.linkedProcess.name}
                    </p>
                  </div>
                )}
                {(audit.shifts || []).length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-gray-500 mb-1">Turnos cubiertos (IATF 9.2.2.2)</h4>
                    <div className="flex gap-1.5">
                      {audit.shifts.map((s) => (
                        <span key={s} className="px-2 py-0.5 text-xs rounded-full bg-emerald-100 text-emerald-800">{SHIFT_LABELS[s] || s}</span>
                      ))}
                    </div>
                  </div>
                )}
                {audit.triggerSource && (
                  <div>
                    <h4 className="text-xs font-medium text-gray-500 mb-1">Disparador (IATF 9.2.2.1)</h4>
                    <p className="text-gray-900 text-sm">{TRIGGER_LABELS[audit.triggerSource] || audit.triggerSource}</p>
                    {audit.triggerDescription && <p className="text-gray-500 text-xs">{audit.triggerDescription}</p>}
                  </div>
                )}
                {audit.reportDueDate && (
                  <div>
                    <h4 className="text-xs font-medium text-gray-500 mb-1">Plazo de emisión del informe</h4>
                    <p className={`text-sm ${audit.reportOverdue ? 'text-red-600 font-medium' : 'text-gray-900'}`}>{formatDate(audit.reportDueDate)}</p>
                  </div>
                )}
                {audit.productName && (
                  <div>
                    <h4 className="text-xs font-medium text-gray-500 mb-1">Auditoría de producto (IATF 9.2.2.3)</h4>
                    <p className="text-gray-900 text-sm">{audit.productName}</p>
                    <p className="text-gray-500 text-xs">
                      {[audit.productionPhase && `Fase: ${audit.productionPhase}`, audit.sampleSize && `Muestra: ${audit.sampleSize}`].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Planificación y Coordinación */}
          {(audit.plannedStartTime || audit.modality || audit.auditLocation || audit.auditedProcessOwner || audit.expectedParticipants) && (
            <div className="border-t border-gray-100 pt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Planificación y Coordinación</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {audit.plannedStartTime && (
                  <div>
                    <h4 className="text-xs font-medium text-gray-500 mb-1">Horario</h4>
                    <p className="text-gray-900 text-sm">
                      {audit.plannedStartTime}{audit.plannedEndTime ? ` – ${audit.plannedEndTime}` : ''}
                    </p>
                  </div>
                )}
                {audit.modality && (
                  <div>
                    <h4 className="text-xs font-medium text-gray-500 mb-1">Modalidad</h4>
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                      audit.modality === 'PRESENCIAL' ? 'bg-green-100 text-green-700' :
                      audit.modality === 'REMOTA' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                    }`}>
                      {audit.modality === 'PRESENCIAL' ? 'Presencial' : audit.modality === 'REMOTA' ? 'Remota' : 'Híbrida'}
                    </span>
                  </div>
                )}
                {audit.auditLocation && (
                  <div>
                    <h4 className="text-xs font-medium text-gray-500 mb-1">Lugar / Sede</h4>
                    <p className="text-gray-900 text-sm">{audit.auditLocation}</p>
                    {audit.locationAddress && <p className="text-gray-500 text-xs">{audit.locationAddress}</p>}
                  </div>
                )}
                {audit.virtualMeetingLink && (
                  <div>
                    <h4 className="text-xs font-medium text-gray-500 mb-1">Enlace virtual</h4>
                    <a href={audit.virtualMeetingLink} target="_blank" rel="noopener noreferrer"
                      className="text-blue-600 hover:underline text-sm truncate block">{audit.virtualMeetingLink}</a>
                  </div>
                )}
                {audit.auditedProcessOwner && (
                  <div>
                    <h4 className="text-xs font-medium text-gray-500 mb-1">Responsable del proceso auditado</h4>
                    <p className="text-gray-900 text-sm">{audit.auditedProcessOwner}</p>
                    {audit.auditedProcessOwnerEmail && <p className="text-gray-500 text-xs">{audit.auditedProcessOwnerEmail}</p>}
                  </div>
                )}
                {audit.expectedParticipants && (
                  <div>
                    <h4 className="text-xs font-medium text-gray-500 mb-1">Participantes previstos</h4>
                    <p className="text-gray-900 text-sm whitespace-pre-line">{audit.expectedParticipants}</p>
                  </div>
                )}
                <div className="flex gap-3">
                  <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                    audit.requiresOpeningMeeting ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {audit.requiresOpeningMeeting ? '✓' : '✗'} Reunión apertura
                  </span>
                  <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                    audit.requiresClosingMeeting ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {audit.requiresClosingMeeting ? '✓' : '✗'} Reunión cierre
                  </span>
                </div>
              </div>
              {audit.logisticObservations && (
                <div className="mt-3">
                  <h4 className="text-xs font-medium text-gray-500 mb-1">Observaciones logísticas</h4>
                  <p className="text-gray-900 text-sm whitespace-pre-line">{audit.logisticObservations}</p>
                </div>
              )}
              {audit.cancelledAt && (
                <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <p className="text-xs font-medium text-red-700">Auditoría cancelada el {formatDate(audit.cancelledAt)}</p>
                  {audit.cancelReason && <p className="text-xs text-red-600 mt-0.5">{audit.cancelReason}</p>}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 my-8">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Editar Auditoría</h3>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <span className="text-gray-500">×</span>
              </button>
            </div>
            <form onSubmit={saveEdit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Título <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="DRAFT">Borrador</option>
                    <option value="PLANNED">Planificada</option>
                    <option value="SCHEDULED">Programada</option>
                    <option value="IN_PROGRESS">En ejecución</option>
                    <option value="PENDING_REPORT">Pendiente informe</option>
                    <option value="COMPLETED">Finalizada</option>
                    <option value="CLOSED">Cerrada</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                  <select
                    value={editForm.type}
                    onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="INTERNAL">Interna</option>
                    <option value="EXTERNAL">Externa</option>
                    <option value="SUPPLIER">Proveedor</option>
                    <option value="CUSTOMER">Cliente</option>
                    <option value="CERTIFICATION">Certificación</option>
                    <option value="RECERTIFICATION">Recertificación</option>
                    <option value="SURVEILLANCE">Vigilancia</option>
                    <option value="SYSTEM">De Sistema (IATF)</option>
                    <option value="MANUFACTURING_PROCESS">Proceso de Manufactura (IATF)</option>
                    <option value="PRODUCT">De Producto (IATF)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Área <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={editForm.area}
                    onChange={(e) => setEditForm({ ...editForm, area: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Proceso</label>
                  <input
                    type="text"
                    value={editForm.process}
                    onChange={(e) => setEditForm({ ...editForm, process: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Inicio planificado</label>
                  <input
                    type="date"
                    value={editForm.plannedStartDate}
                    onChange={(e) => setEditForm({ ...editForm, plannedStartDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fin planificado</label>
                  <input
                    type="date"
                    value={editForm.plannedEndDate}
                    onChange={(e) => setEditForm({ ...editForm, plannedEndDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Alcance</label>
                <textarea
                  value={editForm.scope}
                  onChange={(e) => setEditForm({ ...editForm, scope: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Objetivo</label>
                <textarea
                  value={editForm.objective}
                  onChange={(e) => setEditForm({ ...editForm, objective: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Entrevistados</label>
                <textarea
                  value={editForm.interviewees}
                  onChange={(e) => setEditForm({ ...editForm, interviewees: e.target.value })}
                  placeholder="Ej: Juan Pérez - Supervisor - Calidad\nMaría Gómez - Jefa - Producción"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>

              {/* Datos IATF 16949 */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowIatfEdit(!showIatfEdit)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-emerald-50 hover:bg-emerald-100 transition-colors text-left"
                >
                  <span className="text-sm font-semibold text-emerald-900">Cumplimiento IATF 16949</span>
                  <span className="text-xs text-emerald-600">{showIatfEdit ? '▲ Ocultar' : '▼ Expandir'}</span>
                </button>
                {showIatfEdit && (
                  <div className="p-4 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Proceso del Mapa de Procesos</label>
                      <select
                        value={editForm.processId}
                        onChange={(e) => {
                          const pid = e.target.value;
                          const proc = processes.find((p) => p.id === pid);
                          setEditForm({ ...editForm, processId: pid, process: proc ? proc.name : editForm.process });
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="">— Sin vincular al mapa —</option>
                        {processes.map((p) => (
                          <option key={p.id} value={p.id}>{p.code ? `[${p.code}] ` : ''}{p.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Disparador (9.2.2.1)</label>
                        <select
                          value={editForm.triggerSource}
                          onChange={(e) => setEditForm({ ...editForm, triggerSource: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                          <option value="">— Sin definir —</option>
                          {Object.entries(TRIGGER_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Justificación</label>
                        <input
                          type="text"
                          value={editForm.triggerDescription}
                          onChange={(e) => setEditForm({ ...editForm, triggerDescription: e.target.value })}
                          placeholder="Ej: reclamo de cliente, scorecard < 90"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    {editForm.type === 'MANUFACTURING_PROCESS' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Turnos cubiertos (9.2.2.2)</label>
                        <div className="flex gap-4">
                          {Object.entries(SHIFT_LABELS).map(([v, l]) => (
                            <label key={v} className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={editForm.shifts.includes(v)}
                                onChange={() => setEditForm({
                                  ...editForm,
                                  shifts: editForm.shifts.includes(v) ? editForm.shifts.filter((s) => s !== v) : [...editForm.shifts, v],
                                })}
                                className="w-4 h-4 text-emerald-600 rounded"
                              />
                              <span className="text-sm text-gray-700">{l}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {editForm.type === 'PRODUCT' && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Producto / muestra</label>
                          <input type="text" value={editForm.productName}
                            onChange={(e) => setEditForm({ ...editForm, productName: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Fase de producción</label>
                          <input type="text" value={editForm.productionPhase}
                            onChange={(e) => setEditForm({ ...editForm, productionPhase: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Tamaño de muestra</label>
                          <input type="text" value={editForm.sampleSize}
                            onChange={(e) => setEditForm({ ...editForm, sampleSize: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Plazo de emisión del informe</label>
                      <input
                        type="date"
                        value={editForm.reportDueDate}
                        onChange={(e) => setEditForm({ ...editForm, reportDueDate: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Planificación y Coordinación */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowPlanningEdit(!showPlanningEdit)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-blue-50 hover:bg-blue-100 transition-colors text-left"
                >
                  <span className="text-sm font-semibold text-blue-900">Planificación y Coordinación</span>
                  <span className="text-xs text-blue-600">{showPlanningEdit ? '▲ Ocultar' : '▼ Expandir'}</span>
                </button>
                {showPlanningEdit && (
                  <div className="p-4 space-y-4">

                    {/* Horario y Modalidad */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Hora inicio</label>
                        <input type="time" value={editForm.plannedStartTime}
                          onChange={e => setEditForm({ ...editForm, plannedStartTime: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Hora fin</label>
                        <input type="time" value={editForm.plannedEndTime}
                          onChange={e => setEditForm({ ...editForm, plannedEndTime: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Modalidad</label>
                        <select value={editForm.modality} onChange={e => setEditForm({ ...editForm, modality: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                          <option value="">Seleccionar...</option>
                          <option value="PRESENCIAL">Presencial</option>
                          <option value="REMOTA">Remota</option>
                          <option value="HIBRIDA">Híbrida</option>
                        </select>
                      </div>
                    </div>

                    {/* Lugar */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Lugar / Sede</label>
                        <input type="text" value={editForm.auditLocation}
                          onChange={e => setEditForm({ ...editForm, auditLocation: e.target.value })}
                          placeholder="Sala de reuniones, planta, etc."
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Dirección / Referencia</label>
                        <input type="text" value={editForm.locationAddress}
                          onChange={e => setEditForm({ ...editForm, locationAddress: e.target.value })}
                          placeholder="Dirección o referencia del lugar"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                    </div>

                    {/* Enlace virtual */}
                    {(editForm.modality === 'REMOTA' || editForm.modality === 'HIBRIDA') && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Enlace de reunión virtual</label>
                        <input type="url" value={editForm.virtualMeetingLink}
                          onChange={e => setEditForm({ ...editForm, virtualMeetingLink: e.target.value })}
                          placeholder="https://meet.google.com/... o https://teams.microsoft.com/..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                    )}

                    {/* Responsable del proceso */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Responsable del proceso auditado</label>
                        <input type="text" value={editForm.auditedProcessOwner}
                          onChange={e => setEditForm({ ...editForm, auditedProcessOwner: e.target.value })}
                          placeholder="Nombre del responsable"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email del responsable</label>
                        <input type="email" value={editForm.auditedProcessOwnerEmail}
                          onChange={e => setEditForm({ ...editForm, auditedProcessOwnerEmail: e.target.value })}
                          placeholder="email@empresa.com"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                    </div>

                    {/* Participantes y equipo */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Participantes previstos</label>
                        <textarea value={editForm.expectedParticipants}
                          onChange={e => setEditForm({ ...editForm, expectedParticipants: e.target.value })}
                          placeholder="Nombres o roles de los participantes..."
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Equipo auditor adicional</label>
                        <textarea value={editForm.additionalAuditTeam}
                          onChange={e => setEditForm({ ...editForm, additionalAuditTeam: e.target.value })}
                          placeholder="Auditores adicionales o expertos técnicos..."
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                    </div>

                    {/* Observaciones logísticas */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones logísticas</label>
                      <textarea value={editForm.logisticObservations}
                        onChange={e => setEditForm({ ...editForm, logisticObservations: e.target.value })}
                        placeholder="Necesidades especiales, equipos, accesos, etc."
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>

                    {/* Instrucciones especiales */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Instrucciones especiales</label>
                      <textarea value={editForm.specialInstructions}
                        onChange={e => setEditForm({ ...editForm, specialInstructions: e.target.value })}
                        placeholder="Instrucciones de seguridad, confidencialidad, etc."
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>

                    {/* Reuniones */}
                    <div className="flex gap-6">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={editForm.requiresOpeningMeeting}
                          onChange={e => setEditForm({ ...editForm, requiresOpeningMeeting: e.target.checked })}
                          className="w-4 h-4 text-blue-600 rounded" />
                        <span className="text-sm text-gray-700">Requiere reunión de apertura</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={editForm.requiresClosingMeeting}
                          onChange={e => setEditForm({ ...editForm, requiresClosingMeeting: e.target.checked })}
                          className="w-4 h-4 text-blue-600 rounded" />
                        <span className="text-sm text-gray-700">Requiere reunión de cierre</span>
                      </label>
                    </div>

                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
