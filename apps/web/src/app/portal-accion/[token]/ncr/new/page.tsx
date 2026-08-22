'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Save, Send, Loader2, AlertCircle, CheckCircle, Upload, Paperclip, Trash2, X,
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

const SEVERITY_OPTIONS = [
  { value: 'CRITICAL', label: 'Crítica' },
  { value: 'MAJOR', label: 'Mayor' },
  { value: 'MINOR', label: 'Menor' },
  { value: 'OBSERVATION', label: 'Observación' },
];

export default function PortalNcrNewPage({ params }: { params: { token: string } }) {
  const router = useRouter();
  const [access, setAccess] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [createdNcrId, setCreatedNcrId] = useState<string | null>(null);

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
    loadAccess();
  }, []);

  async function loadAccess() {
    try {
      const res = await fetch(`${API_BASE}/portal-accion/public/${params.token}`);
      if (!res.ok) throw new Error('Token inválido');
      const json = await res.json();
      setAccess(json.access);
      if (!json.access?.canCreateNonConformities) {
        setError('No tiene permiso para crear No Conformidades');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveDraft() {
    if (!form.title.trim() || !form.description.trim()) {
      setError('Título y descripción son obligatorios');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body: any = { ...form, submit: false };
      if (form.detectedAt) body.detectedAt = new Date(form.detectedAt).toISOString();
      const res = await fetch(`${API_BASE}/portal-accion/public/${params.token}/ncr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error al guardar');
      setCreatedNcrId(json.ncr.id);
      setMsg('Borrador guardado correctamente');
      setTimeout(() => setMsg(null), 4000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit() {
    if (!form.title.trim() || !form.description.trim()) {
      setError('Título y descripción son obligatorios');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const body: any = { ...form, submit: true };
      if (form.detectedAt) body.detectedAt = new Date(form.detectedAt).toISOString();
      const res = await fetch(`${API_BASE}/portal-accion/public/${params.token}/ncr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error al enviar');
      setMsg('No Conformidad enviada para revisión');
      setTimeout(() => router.push(`/portal-accion/${params.token}`), 2000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !createdNcrId) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API_BASE}/portal-accion/public/${params.token}/ncr/${createdNcrId}/attachments`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Error');
      }
      const json = await res.json();
      setAttachments([...attachments, json.attachment]);
    } catch (e: any) {
      setError(`Upload: ${e.message}`);
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteAttachment(attId: string) {
    if (!createdNcrId) return;
    if (!confirm('¿Eliminar este adjunto?')) return;
    try {
      const res = await fetch(`${API_BASE}/portal-accion/public/${params.token}/ncr/${createdNcrId}/attachments/${attId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Error al eliminar');
      setAttachments(attachments.filter((a) => a.id !== attId));
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
          <h1 className="text-lg font-bold text-gray-900 flex-1">Informar No Conformidad</h1>
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

        {/* Read-only context info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800 font-medium mb-2">Información automática</p>
          <div className="grid grid-cols-2 gap-2 text-xs text-blue-700">
            <div><span className="font-medium">Informante:</span> {access?.recipientName}</div>
            <div><span className="font-medium">Email:</span> {access?.recipientEmail}</div>
            {access?.sector && <div><span className="font-medium">Sector:</span> {access.sector}</div>}
            {access?.area && <div><span className="font-medium">Área:</span> {access.area}</div>}
            <div><span className="font-medium">Fecha:</span> {new Date().toLocaleDateString('es-AR')}</div>
            <div><span className="font-medium">Origen:</span> Portal Externo</div>
          </div>
          <p className="text-xs text-blue-500 mt-2">Estos datos se completan automáticamente y no son editables.</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg border p-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              Título <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Breve descripción del hallazgo"
              className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              Descripción detallada <span className="text-red-500">*</span>
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Descripción completa de la no conformidad detectada"
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
                {SEVERITY_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
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
              <label className="text-sm font-medium text-gray-700 mb-1 block">Norma de referencia</label>
              <input
                type="text"
                value={form.standard}
                onChange={(e) => setForm({ ...form, standard: e.target.value })}
                placeholder="Ej: ISO 9001"
                className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Cláusula</label>
              <input
                type="text"
                value={form.clause}
                onChange={(e) => setForm({ ...form, clause: e.target.value })}
                placeholder="Ej: 8.5.1"
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
              placeholder="Ej: Planta 1 - Línea de producción A"
              className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Productos afectados</label>
            <input
              type="text"
              value={form.productsAffected}
              onChange={(e) => setForm({ ...form, productsAffected: e.target.value })}
              placeholder="Ej: Lote 1234 - Producto X"
              className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Corrección inmediata tomada</label>
            <textarea
              value={form.immediateCorrection}
              onChange={(e) => setForm({ ...form, immediateCorrection: e.target.value })}
              placeholder="Acciones inmediatas o medidas de contención aplicadas"
              rows={3}
              className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Observaciones adicionales</label>
            <textarea
              value={form.observations}
              onChange={(e) => setForm({ ...form, observations: e.target.value })}
              placeholder="Cualquier información adicional relevante"
              rows={3}
              className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            />
          </div>
        </div>

        {/* Attachments (only after draft is saved) */}
        {createdNcrId && (
          <div className="bg-white rounded-lg border p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Evidencias / Adjuntos</h3>
            <label className="flex items-center gap-2 px-3 py-2 border border-dashed rounded-lg cursor-pointer hover:bg-gray-50 transition-colors mb-3">
              <Upload className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-500">
                {uploading ? 'Subiendo...' : 'Click para subir evidencia (máx 10MB)'}
              </span>
              <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
            </label>
            <div className="space-y-2">
              {attachments.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-2">Sin adjuntos</p>
              )}
              {attachments.map((att) => (
                <div key={att.id} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
                  <Paperclip className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="text-sm text-gray-700 flex-1 truncate">{att.filename}</span>
                  <button
                    onClick={() => handleDeleteAttachment(att.id)}
                    className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action bar */}
        <div className="sticky bottom-0 bg-white border-t px-4 py-3 flex items-center justify-between -mx-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push(`/portal-accion/${params.token}`)}
              className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              Cancelar
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveDraft}
              disabled={saving || submitting}
              className="flex items-center gap-1.5 px-4 py-2 text-sm border rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Guardar borrador
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving || submitting}
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Enviar para revisión
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
