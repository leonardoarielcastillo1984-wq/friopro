'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Save, Send, FileDown, Loader2, AlertCircle, CheckCircle,
  Upload, Paperclip, Trash2, Clock, X, AlertTriangle,
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

const NCR_STATUS_LABELS: Record<string, string> = {
  EXTERNAL_DRAFT: 'Borrador', REPORTED: 'Reportada — Pendiente de revisión',
  NEEDS_CORRECTION: 'Requiere corrección', OPEN: 'Abierta', IN_ANALYSIS: 'En análisis',
  ACTION_PLANNED: 'Acción planificada', IN_PROGRESS: 'En progreso',
  VERIFICATION: 'Verificación', CLOSED: 'Cerrada', CANCELLED: 'Cancelada',
};

const SEVERITY_LABELS: Record<string, string> = {
  CRITICAL: 'Crítica', MAJOR: 'Mayor', MINOR: 'Menor', OBSERVATION: 'Observación',
};

export default function PortalNcrDetailPage({ params }: { params: { token: string; ncrId: string } }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ncr, setNcr] = useState<any>(null);
  const [access, setAccess] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [form, setForm] = useState({
    title: '',
    description: '',
    severity: 'MAJOR' as string,
    standard: '',
    clause: '',
    detectedAt: '',
    location: '',
    productsAffected: '',
    observations: '',
    immediateCorrection: '',
  });

  useEffect(() => {
    loadNcr();
  }, []);

  async function loadNcr() {
    setLoading(true);
    try {
      const [portalRes, ncrRes] = await Promise.all([
        fetch(`${API_BASE}/portal-accion/public/${params.token}`),
        fetch(`${API_BASE}/portal-accion/public/${params.token}/ncr/${params.ncrId}`),
      ]);
      if (!portalRes.ok) throw new Error('Token inválido');
      const portalJson = await portalRes.json();
      setAccess(portalJson.access);

      if (!ncrRes.ok) {
        const body = await ncrRes.json();
        throw new Error(body.error || 'NCR no encontrada');
      }
      const ncrJson = await ncrRes.json();
      setNcr(ncrJson.ncr);
      setForm({
        title: ncrJson.ncr.title || '',
        description: ncrJson.ncr.description || '',
        severity: ncrJson.ncr.severity || 'MAJOR',
        standard: ncrJson.ncr.standard || '',
        clause: ncrJson.ncr.clause || '',
        detectedAt: ncrJson.ncr.detectedAt ? new Date(ncrJson.ncr.detectedAt).toISOString().split('T')[0] : '',
        location: ncrJson.ncr.externalLocation || '',
        productsAffected: ncrJson.ncr.externalProductsAffected || '',
        observations: ncrJson.ncr.externalObservations || '',
        immediateCorrection: ncrJson.ncr.externalImmediateCorrection || '',
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const canEdit = () => {
    if (!access) return false;
    if (ncr.status === 'EXTERNAL_DRAFT' && access.canEditNcrDraft) return true;
    if (ncr.status === 'NEEDS_CORRECTION' && access.canCorrectNcrReturned) return true;
    return false;
  };

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const body: any = { ...form };
      if (form.detectedAt) body.detectedAt = new Date(form.detectedAt).toISOString();
      const res = await fetch(`${API_BASE}/portal-accion/public/${params.token}/ncr/${params.ncrId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error al guardar');
      setNcr(json.ncr);
      setEditing(false);
      setMsg('Cambios guardados correctamente');
      setTimeout(() => setMsg(null), 4000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/portal-accion/public/${params.token}/ncr/${params.ncrId}/submit`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error al enviar');
      setMsg('No Conformidad enviada para revisión');
      setTimeout(() => loadNcr(), 1500);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!confirm('¿Eliminar este borrador? Esta acción no se puede deshacer.')) return;
    try {
      const res = await fetch(`${API_BASE}/portal-accion/public/${params.token}/ncr/${params.ncrId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Error al eliminar');
      router.push(`/portal-accion/${params.token}`);
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API_BASE}/portal-accion/public/${params.token}/ncr/${params.ncrId}/attachments`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Error');
      }
      loadNcr();
    } catch (e: any) {
      setError(`Upload: ${e.message}`);
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteAttachment(attId: string) {
    if (!confirm('¿Eliminar este adjunto?')) return;
    try {
      const res = await fetch(`${API_BASE}/portal-accion/public/${params.token}/ncr/${params.ncrId}/attachments/${attId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Error al eliminar');
      loadNcr();
    } catch (e: any) {
      setError(e.message);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error && !ncr) {
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

  const editable = canEdit();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-4">
          <button
            onClick={() => router.push(`/portal-accion/${params.token}`)}
            className="flex items-center gap-1 text-gray-500 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Volver</span>
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-gray-900">
              {ncr.code || 'NCR Pendiente'}
            </h1>
          </div>
          <span className={`px-2 py-1 rounded text-xs font-medium ${
            ncr.status === 'EXTERNAL_DRAFT' ? 'bg-gray-100 text-gray-700' :
            ncr.status === 'REPORTED' ? 'bg-blue-100 text-blue-700' :
            ncr.status === 'NEEDS_CORRECTION' ? 'bg-amber-100 text-amber-700' :
            ncr.status === 'OPEN' ? 'bg-green-100 text-green-700' :
            'bg-gray-200 text-gray-600'
          }`}>
            {NCR_STATUS_LABELS[ncr.status] || ncr.status}
          </span>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-red-700">{error}</p>
              <button onClick={() => setError(null)} className="mt-1 text-xs text-red-500 underline">Cerrar</button>
            </div>
          </div>
        )}

        {msg && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <p className="text-sm text-green-700">{msg}</p>
          </div>
        )}

        {/* Needs correction banner */}
        {ncr.status === 'NEEDS_CORRECTION' && ncr.reviewNotes && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-800">Se requiere corrección</p>
                <p className="text-sm text-amber-700 mt-1">{ncr.reviewNotes}</p>
                <p className="text-xs text-amber-600 mt-2">
                  Revisado por: {ncr.reviewedBy?.email || '—'} — {ncr.reviewedAt ? new Date(ncr.reviewedAt).toLocaleDateString('es-AR') : ''}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Reported banner */}
        {ncr.status === 'REPORTED' && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-3">
            <Clock className="w-5 h-5 text-blue-600" />
            <p className="text-sm text-blue-700">
              Esta No Conformidad fue enviada y está pendiente de revisión interna.
              Se le notificará cuando sea revisada.
            </p>
          </div>
        )}

        {/* Form / Display */}
        <div className="bg-white rounded-lg border p-6 space-y-4">
          {editing ? (
            <>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Título</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Descripción</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={5}
                  className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Severidad</label>
                  <select
                    value={form.severity}
                    onChange={(e) => setForm({ ...form, severity: e.target.value })}
                    className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="CRITICAL">Crítica</option>
                    <option value="MAJOR">Mayor</option>
                    <option value="MINOR">Menor</option>
                    <option value="OBSERVATION">Observación</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Fecha de detección</label>
                  <input
                    type="date"
                    value={form.detectedAt}
                    onChange={(e) => setForm({ ...form, detectedAt: e.target.value })}
                    className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Norma</label>
                  <input
                    type="text"
                    value={form.standard}
                    onChange={(e) => setForm({ ...form, standard: e.target.value })}
                    className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Cláusula</label>
                  <input
                    type="text"
                    value={form.clause}
                    onChange={(e) => setForm({ ...form, clause: e.target.value })}
                    className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Lugar de detección</label>
                <input
                  type="text"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Productos afectados</label>
                <input
                  type="text"
                  value={form.productsAffected}
                  onChange={(e) => setForm({ ...form, productsAffected: e.target.value })}
                  className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Corrección inmediata</label>
                <textarea
                  value={form.immediateCorrection}
                  onChange={(e) => setForm({ ...form, immediateCorrection: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Observaciones</label>
                <textarea
                  value={form.observations}
                  onChange={(e) => setForm({ ...form, observations: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <h2 className="text-xl font-bold text-gray-900">{ncr.title}</h2>
                <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{ncr.description}</p>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <InfoRow label="Severidad" value={SEVERITY_LABELS[ncr.severity] || ncr.severity} />
                <InfoRow label="Fecha de detección" value={ncr.detectedAt ? new Date(ncr.detectedAt).toLocaleDateString('es-AR') : '—'} />
                <InfoRow label="Norma" value={ncr.standard || '—'} />
                <InfoRow label="Cláusula" value={ncr.clause || '—'} />
                <InfoRow label="Lugar" value={ncr.externalLocation || '—'} />
                <InfoRow label="Productos afectados" value={ncr.externalProductsAffected || '—'} />
              </div>
              {ncr.externalImmediateCorrection && (
                <div className="pt-4 border-t">
                  <p className="text-xs font-medium text-gray-500 mb-1">Corrección inmediata</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{ncr.externalImmediateCorrection}</p>
                </div>
              )}
              {ncr.externalObservations && (
                <div className="pt-4 border-t">
                  <p className="text-xs font-medium text-gray-500 mb-1">Observaciones</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{ncr.externalObservations}</p>
                </div>
              )}
              <div className="pt-4 border-t text-xs text-gray-400">
                <div>Informante: {ncr.externalReporterName || access?.recipientName}</div>
                <div>Creada: {new Date(ncr.createdAt).toLocaleDateString('es-AR')}</div>
              </div>
            </>
          )}
        </div>

        {/* Attachments */}
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Evidencias / Adjuntos</h3>
          {editable && (
            <label className="flex items-center gap-2 px-3 py-2 border border-dashed rounded-lg cursor-pointer hover:bg-gray-50 transition-colors mb-3">
              <Upload className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-500">
                {uploading ? 'Subiendo...' : 'Click para subir evidencia (máx 10MB)'}
              </span>
              <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
            </label>
          )}
          <div className="space-y-2">
            {ncr.attachments?.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-2">Sin adjuntos</p>
            )}
            {ncr.attachments?.map((att: any) => (
              <div key={att.id} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
                <Paperclip className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="text-sm text-gray-700 flex-1 truncate">{att.filename}</span>
                {editable && (
                  <button
                    onClick={() => handleDeleteAttachment(att.id)}
                    className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Action Plans (if linked) */}
        {ncr.actionPlans?.length > 0 && (
          <div className="bg-white rounded-lg border p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Planes de Acción vinculados</h3>
            <div className="space-y-2">
              {ncr.actionPlans.map((plan: any) => (
                <div key={plan.id} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
                  <span className="text-sm font-mono text-gray-900">{plan.code || 'Sin código'}</span>
                  <span className="text-sm text-gray-600 flex-1 truncate">
                    {plan.findingDescription?.substring(0, 80) || '—'}
                  </span>
                  <span className="text-xs text-gray-400">{plan.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action bar */}
        <div className="sticky bottom-0 bg-white border-t px-4 py-3 flex items-center justify-between -mx-4">
          <div className="flex items-center gap-2">
            {access?.canDownloadNcrPdf && ncr.status !== 'EXTERNAL_DRAFT' && (
              <button
                onClick={() => window.open(`${API_BASE}/portal-accion/public/${params.token}/ncr/${params.ncrId}/pdf`, '_blank')}
                className="flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <FileDown className="w-4 h-4" /> PDF
              </button>
            )}
            {ncr.status === 'EXTERNAL_DRAFT' && (
              <button
                onClick={handleDelete}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" /> Eliminar borrador
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {editing ? (
              <>
                <button
                  onClick={() => setEditing(false)}
                  className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Guardar cambios
                </button>
              </>
            ) : editable ? (
              <>
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Editar
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {ncr.status === 'NEEDS_CORRECTION' ? 'Reenviar corregido' : 'Enviar para revisión'}
                </button>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="text-sm text-gray-900">{value}</p>
    </div>
  );
}
