'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { ChevronLeft, Edit2, FileText, CheckCircle, Clock, AlertCircle, Calendar, Play } from 'lucide-react';

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
  area: string;
  process: string | null;
  isoStandard: string[];
  scope: string | null;
  objective: string | null;
  interviewees: string | null;
  createdAt: string;
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
};

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
  });

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
    });
    setShowEditModal(true);
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!audit) return;
    try {
      setSaving(true);
      setError(null);
      const payload: any = {
        title: editForm.title,
        description: editForm.description?.trim() ? editForm.description.trim() : null,
        status: editForm.status,
        type: editForm.type,
        area: editForm.area,
        process: editForm.process?.trim() ? editForm.process.trim() : null,
        scope: editForm.scope?.trim() ? editForm.scope.trim() : null,
        objective: editForm.objective?.trim() ? editForm.objective.trim() : null,
        interviewees: editForm.interviewees?.trim() ? editForm.interviewees.trim() : null,
        plannedStartDate: editForm.plannedStartDate ? new Date(editForm.plannedStartDate).toISOString() : null,
        plannedEndDate: editForm.plannedEndDate ? new Date(editForm.plannedEndDate).toISOString() : null,
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
            <form onSubmit={saveEdit} className="p-6 space-y-4">
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
