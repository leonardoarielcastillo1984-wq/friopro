'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Save, FileDown, Upload, Trash2, Loader2, AlertCircle,
  CheckCircle, Clock, Send, Lock, Paperclip,
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador', PENDING_CODE: 'Pend. código', PENDING_APPROVAL: 'Pend. aprobación',
  OPEN: 'Abierto', IN_EXECUTION: 'En ejecución', PENDING_EVIDENCE: 'Pend. evidencia',
  PENDING_EFFECTIVENESS: 'Pend. eficacia', EFFECTIVE: 'Eficaz', NOT_EFFECTIVE: 'No eficaz',
  OVERDUE: 'Vencido', CLOSED: 'Cerrado', CANCELLED: 'Cancelado',
};

const TYPE_LABELS: Record<string, string> = {
  IMMEDIATE_CORRECTION: 'Corrección inmediata', CORRECTIVE: 'Correctiva',
  PREVENTIVE: 'Preventiva', IMPROVEMENT: 'Mejora', RISK_TREATMENT: 'Tratamiento de riesgo',
};

const FIELDS_REQUIRING_APPROVAL = [
  'validatedRootCause', 'plannedAction', 'plannedStartDate', 'plannedEndDate', 'effectivenessResult', 'status',
];

const FIELD_LABELS: Record<string, string> = {
  immediateCorrection: 'Corrección inmediata',
  rootCauseAnalysis: 'Análisis de causa raíz',
  validatedRootCause: 'Causa raíz validada',
  plannedAction: 'Acción planificada',
  expectedResult: 'Resultado esperado',
  progressPercent: 'Progreso (%)',
  requiredResources: 'Recursos requeridos',
  observations: 'Observaciones',
  analysisMethod: 'Metodología de análisis',
  findingDescription: 'Descripción del hallazgo',
  requirement: 'Requisito',
  classification: 'Clasificación',
  plannedStartDate: 'Fecha inicio prevista',
  plannedEndDate: 'Fecha fin prevista',
  effectivenessResult: 'Resultado de eficacia',
};

export default function PortalPlanDetailPage({ params }: { params: { token: string; planId: string } }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<any>(null);
  const [access, setAccess] = useState<any>(null);
  const [drafts, setDrafts] = useState<any[]>([]);
  const [editing, setEditing] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadPlan();
  }, []);

  async function loadPlan() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/portal-accion/public/${params.token}/plans/${params.planId}`);
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || 'Error');
      }
      const json = await res.json();
      setPlan(json.plan);
      setDrafts(json.drafts || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaveMsg(null);
    setConflict(null);
    try {
      const body: any = { ...editing, _expectedUpdatedAt: plan.updatedAt };
      const res = await fetch(`${API_BASE}/portal-accion/public/${params.token}/plans/${params.planId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (res.status === 409) {
        setConflict(json.message || 'Conflicto de concurrencia');
        setPlan(json.plan || plan);
      } else if (!res.ok) {
        throw new Error(json.error || 'Error al guardar');
      } else {
        setPlan(json.plan);
        setEditing({});
        setSaveMsg(json.message || 'Cambios guardados');
        if (json.pendingApproval?.length > 0) {
          // Reload to get updated drafts
          loadPlan();
        }
      }
    } catch (e: any) {
      setSaveMsg(`Error: ${e.message}`);
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(null), 5000);
    }
  }

  async function handleSubmitDraft() {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/portal-accion/public/${params.token}/plans/${params.planId}/submit`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error');
      setSaveMsg(json.message || 'Borrador enviado');
      loadPlan();
    } catch (e: any) {
      setSaveMsg(`Error: ${e.message}`);
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(null), 5000);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API_BASE}/portal-accion/public/${params.token}/plans/${params.planId}/attachments`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Error');
      }
      loadPlan();
    } catch (e: any) {
      setSaveMsg(`Error upload: ${e.message}`);
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteAttachment(attId: string) {
    if (!confirm('¿Eliminar este adjunto?')) return;
    try {
      const res = await fetch(`${API_BASE}/portal-accion/public/${params.token}/plans/${params.planId}/attachments/${attId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Error');
      }
      loadPlan();
    } catch (e: any) {
      setSaveMsg(`Error: ${e.message}`);
    }
  }

  function isFieldEditable(field: string): boolean {
    if (!access?.canEdit) return false;
    if (access.canEditFields.length > 0) return access.canEditFields.includes(field);
    return true;
  }

  function isApprovalField(field: string): boolean {
    return FIELDS_REQUIRING_APPROVAL.includes(field);
  }

  function getFieldValue(field: string): any {
    return editing[field] !== undefined ? editing[field] : plan?.[field];
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600">{error}</p>
          <button onClick={() => router.push(`/portal-accion/${params.token}`)} className="mt-4 text-blue-600 hover:underline">
            Volver al portal
          </button>
        </div>
      </div>
    );
  }

  const hasEdits = Object.keys(editing).length > 0;
  const pendingDraft = drafts.find((d) => d.status === 'DRAFT' || d.status === 'SUBMITTED');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-4">
          <button
            onClick={() => router.push(`/portal-accion/${params.token}`)}
            className="flex items-center gap-1 text-gray-500 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Volver</span>
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-gray-900">
              {plan.code || 'Plan sin código'}
            </h1>
            <p className="text-xs text-gray-500">{TYPE_LABELS[plan.type] || plan.type}</p>
          </div>
          <span className={`px-2 py-1 rounded text-xs font-medium ${
            plan.status === 'CLOSED' ? 'bg-gray-200 text-gray-600' :
            plan.status === 'IN_EXECUTION' ? 'bg-indigo-100 text-indigo-700' :
            'bg-blue-100 text-blue-700'
          }`}>
            {STATUS_LABELS[plan.status] || plan.status}
          </span>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Conflict warning */}
        {conflict && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800">{conflict}</p>
              <p className="text-xs text-amber-600 mt-1">Recargá los datos y volvé a intentar.</p>
              <button onClick={loadPlan} className="mt-2 text-xs text-amber-700 underline">Recargar</button>
            </div>
          </div>
        )}

        {/* Save message */}
        {saveMsg && (
          <div className={`rounded-lg p-3 flex items-center gap-2 text-sm ${
            saveMsg.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
          }`}>
            {saveMsg.startsWith('Error') ? <AlertCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
            {saveMsg}
          </div>
        )}

        {/* Pending draft notice */}
        {pendingDraft && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
            <Clock className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-800">
                {pendingDraft.status === 'SUBMITTED'
                  ? 'Borrador enviado para revisión interna'
                  : 'Tenés cambios pendientes de envío'}
              </p>
              <p className="text-xs text-blue-600 mt-1">
                Campos en revisión: {Object.keys(pendingDraft.draftData).map(f => FIELD_LABELS[f] || f).join(', ')}
              </p>
              {pendingDraft.status === 'DRAFT' && (
                <button
                  onClick={handleSubmitDraft}
                  disabled={saving}
                  className="mt-2 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
                >
                  Enviar para revisión
                </button>
              )}
            </div>
          </div>
        )}

        {/* Editable form sections */}
        <FormSection title="Descripción del Hallazgo">
          <FieldRow
            label="Descripción"
            field="findingDescription"
            value={getFieldValue('findingDescription')}
            editable={isFieldEditable('findingDescription')}
            approval={isApprovalField('findingDescription')}
            onChange={(v) => setEditing({ ...editing, findingDescription: v })}
          />
          <FieldRow
            label="Requisito"
            field="requirement"
            value={getFieldValue('requirement')}
            editable={isFieldEditable('requirement')}
            approval={isApprovalField('requirement')}
            onChange={(v) => setEditing({ ...editing, requirement: v })}
          />
          <FieldRow
            label="Clasificación"
            field="classification"
            value={getFieldValue('classification')}
            editable={isFieldEditable('classification')}
            approval={isApprovalField('classification')}
            onChange={(v) => setEditing({ ...editing, classification: v })}
          />
        </FormSection>

        <FormSection title="Corrección Inmediata">
          <FieldRow
            label="Acción inmediata / Medida de contención"
            field="immediateCorrection"
            value={getFieldValue('immediateCorrection')}
            editable={isFieldEditable('immediateCorrection')}
            approval={isApprovalField('immediateCorrection')}
            onChange={(v) => setEditing({ ...editing, immediateCorrection: v })}
          />
        </FormSection>

        <FormSection title="Análisis de Causa Raíz">
          <FieldRow
            label="Análisis"
            field="rootCauseAnalysis"
            value={getFieldValue('rootCauseAnalysis')}
            editable={isFieldEditable('rootCauseAnalysis')}
            approval={isApprovalField('rootCauseAnalysis')}
            onChange={(v) => setEditing({ ...editing, rootCauseAnalysis: v })}
          />
          <FieldRow
            label="Causa raíz validada"
            field="validatedRootCause"
            value={getFieldValue('validatedRootCause')}
            editable={isFieldEditable('validatedRootCause')}
            approval={isApprovalField('validatedRootCause')}
            onChange={(v) => setEditing({ ...editing, validatedRootCause: v })}
          />
        </FormSection>

        <FormSection title="Acción Planificada">
          <FieldRow
            label="Acción"
            field="plannedAction"
            value={getFieldValue('plannedAction')}
            editable={isFieldEditable('plannedAction')}
            approval={isApprovalField('plannedAction')}
            onChange={(v) => setEditing({ ...editing, plannedAction: v })}
          />
          <FieldRow
            label="Resultado esperado"
            field="expectedResult"
            value={getFieldValue('expectedResult')}
            editable={isFieldEditable('expectedResult')}
            approval={isApprovalField('expectedResult')}
            onChange={(v) => setEditing({ ...editing, expectedResult: v })}
          />
          <FieldRow
            label="Recursos requeridos"
            field="requiredResources"
            value={getFieldValue('requiredResources')}
            editable={isFieldEditable('requiredResources')}
            approval={isApprovalField('requiredResources')}
            onChange={(v) => setEditing({ ...editing, requiredResources: v })}
          />
        </FormSection>

        <FormSection title="Seguimiento">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Progreso (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={getFieldValue('progressPercent') ?? 0}
                disabled={!isFieldEditable('progressPercent')}
                onChange={(e) => setEditing({ ...editing, progressPercent: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Fecha fin prevista</label>
              <input
                type="date"
                value={getFieldValue('plannedEndDate') ? new Date(getFieldValue('plannedEndDate')).toISOString().split('T')[0] : ''}
                disabled={!isFieldEditable('plannedEndDate')}
                onChange={(e) => setEditing({ ...editing, plannedEndDate: e.target.value })}
                className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
              />
              {isApprovalField('plannedEndDate') && isFieldEditable('plannedEndDate') && (
                <p className="text-xs text-amber-600 mt-1">⚠ Requiere aprobación interna</p>
              )}
            </div>
          </div>
          <FieldRow
            label="Observaciones"
            field="observations"
            value={getFieldValue('observations')}
            editable={isFieldEditable('observations')}
            approval={isApprovalField('observations')}
            onChange={(v) => setEditing({ ...editing, observations: v })}
          />
        </FormSection>

        {/* Attachments */}
        <FormSection title="Evidencias / Adjuntos">
          {access?.canAttachEvidence && (
            <div className="mb-3">
              <label className="flex items-center gap-2 px-3 py-2 border border-dashed rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <Upload className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-500">
                  {uploading ? 'Subiendo...' : 'Click para subir evidencia (máx 10MB)'}
                </span>
                <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
              </label>
            </div>
          )}
          <div className="space-y-2">
            {plan.attachments?.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">Sin adjuntos</p>
            )}
            {plan.attachments?.map((att: any) => (
              <div key={att.id} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
                <Paperclip className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="text-sm text-gray-700 flex-1 truncate">{att.filename}</span>
                <span className="text-xs text-gray-400">{att.mimeType}</span>
                {att.uploadedById === null && (
                  <button
                    onClick={() => handleDeleteAttachment(att.id)}
                    className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </FormSection>

        {/* Action bar */}
        <div className="sticky bottom-0 bg-white border-t px-4 py-3 flex items-center justify-between -mx-4">
          <div className="flex items-center gap-2">
            {access?.canDownloadPdf && (
              <button
                onClick={() => window.open(`${API_BASE}/portal-accion/public/${params.token}/plans/${params.planId}/pdf`, '_blank')}
                className="flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <FileDown className="w-4 h-4" />
                PDF
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {hasEdits && (
              <button
                onClick={() => setEditing({})}
                className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                Cancelar
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={!hasEdits || saving}
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 transition-colors"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Guardar cambios
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg border p-5">
      <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">{title}</h2>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function FieldRow({
  label, field, value, editable, approval, onChange,
}: {
  label: string; field: string; value: any; editable: boolean; approval: boolean;
  onChange: (v: string) => void;
}) {
  const isDate = field === 'plannedStartDate' || field === 'plannedEndDate';
  const displayValue = isDate && value ? new Date(value).toISOString().split('T')[0] : value || '';

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <label className="text-xs font-medium text-gray-500">{label}</label>
        {approval && editable && (
          <span className="text-xs text-amber-600 flex items-center gap-0.5">
            <Lock className="w-3 h-3" /> Requiere aprobación
          </span>
        )}
      </div>
      <textarea
        value={displayValue}
        disabled={!editable}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400 resize-y"
        placeholder={editable ? 'Escribí aquí...' : 'No editable'}
      />
    </div>
  );
}
