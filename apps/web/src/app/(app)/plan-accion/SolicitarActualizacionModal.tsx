'use client';
import { useState } from 'react';
import { X, Send, Loader2, CheckCircle, AlertCircle, Mail, User, Calendar } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

export default function SolicitarActualizacionModal({
  open,
  onClose,
  selectedPlanIds,
}: {
  open: boolean;
  onClose: () => void;
  selectedPlanIds: string[];
}) {
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [sector, setSector] = useState('');
  const [area, setArea] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [canEdit, setCanEdit] = useState(true);
  const [canAttachEvidence, setCanAttachEvidence] = useState(true);
  const [canDownloadPdf, setCanDownloadPdf] = useState(true);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function handleSend() {
    setSending(true);
    setResult(null);
    try {
      const res = await fetch(`${API_BASE}/portal-accion/admin/send-links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          planIds: selectedPlanIds,
          recipientName,
          recipientEmail,
          sector: sector || undefined,
          area: area || undefined,
          canEdit,
          canAttachEvidence,
          canDownloadPdf,
          expiresAt: expiresAt || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error');
      setResult({ ok: true, message: json.message || 'Link enviado correctamente' });
      setTimeout(() => {
        onClose();
        setResult(null);
        setRecipientName('');
        setRecipientEmail('');
        setSector('');
        setArea('');
        setExpiresAt('');
      }, 2500);
    } catch (e: any) {
      setResult({ ok: false, message: e.message });
    } finally {
      setSending(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Solicitar actualización</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {result && (
            <div className={`rounded-lg p-3 flex items-center gap-2 text-sm ${
              result.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}>
              {result.ok ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {result.message}
            </div>
          )}

          <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-700">
            Se enviará un link seguro a {selectedPlanIds.length} plan(s) seleccionado(s).
            El responsable podrá ver y editar los planes desde el portal externo.
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 flex items-center gap-1 mb-1">
              <User className="w-3.5 h-3.5 text-gray-400" /> Nombre del responsable
            </label>
            <input
              type="text"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="Ej: Juan Pérez"
              className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 flex items-center gap-1 mb-1">
              <Mail className="w-3.5 h-3.5 text-gray-400" /> Email
            </label>
            <input
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="responsable@empresa.com"
              className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Sector (opcional)</label>
              <input
                type="text"
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                placeholder="Ej: Operaciones"
                className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Área (opcional)</label>
              <input
                type="text"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                placeholder="Ej: Logística"
                className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 flex items-center gap-1 mb-1">
              <Calendar className="w-3.5 h-3.5 text-gray-400" /> Vencimiento (opcional)
            </label>
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 block">Permisos</label>
            <div className="flex flex-wrap gap-3">
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" checked={canEdit} onChange={(e) => setCanEdit(e.target.checked)} className="rounded" />
                Editar
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" checked={canAttachEvidence} onChange={(e) => setCanAttachEvidence(e.target.checked)} className="rounded" />
                Subir evidencias
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" checked={canDownloadPdf} onChange={(e) => setCanDownloadPdf(e.target.checked)} className="rounded" />
                Descargar PDF
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">
              Cancelar
            </button>
            <button
              onClick={handleSend}
              disabled={!recipientName || !recipientEmail || sending || selectedPlanIds.length === 0}
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 transition-colors"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Enviar link
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
