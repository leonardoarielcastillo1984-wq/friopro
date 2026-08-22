'use client';
import { useState, useEffect } from 'react';
import {
  Loader2, AlertCircle, CheckCircle, XCircle, Clock, Mail, User, Trash2,
  Ban, Play, Eye, FileText, Send, Plus,
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Activo', SUSPENDED: 'Suspendido', EXPIRED: 'Expirado', REVOKED: 'Revocado',
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700', SUSPENDED: 'bg-amber-100 text-amber-700',
  EXPIRED: 'bg-gray-100 text-gray-600', REVOKED: 'bg-red-100 text-red-700',
};

const DRAFT_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador', SUBMITTED: 'Enviado', UNDER_REVIEW: 'En revisión',
  APPROVED: 'Aprobado', REJECTED: 'Rechazado', APPLIED: 'Aplicado',
};

export default function PortalAdminPanel() {
  const [tab, setTab] = useState<'accesses' | 'drafts'>('accesses');
  const [loading, setLoading] = useState(true);
  const [accesses, setAccesses] = useState<any[]>([]);
  const [drafts, setDrafts] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [detailAccess, setDetailAccess] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, [tab]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      if (tab === 'accesses') {
        const res = await fetch(`${API_BASE}/portal-accion/admin/access`, { credentials: 'include' });
        if (!res.ok) throw new Error('Error al cargar accesos');
        const json = await res.json();
        setAccesses(json.accesses || []);
      } else {
        const res = await fetch(`${API_BASE}/portal-accion/admin/drafts`, { credentials: 'include' });
        if (!res.ok) throw new Error('Error al cargar borradores');
        const json = await res.json();
        setDrafts(json.drafts || []);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(accessId: string, action: string) {
    setActionLoading(`${accessId}-${action}`);
    try {
      const res = await fetch(`${API_BASE}/portal-accion/admin/access/${accessId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Error');
      }
      await load();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDraftAction(draftId: string, action: 'approve' | 'reject') {
    setActionLoading(`${draftId}-${action}`);
    try {
      const body = action === 'reject' ? { notes: prompt('Motivo del rechazo:') || '' } : {};
      const res = await fetch(`${API_BASE}/portal-accion/admin/drafts/${draftId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Error');
      }
      await load();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Portal Externo — Administración</h2>
          <p className="text-sm text-gray-500">Gestión de accesos externos y borradores de actualización</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" /> Nuevo acceso
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        <button
          onClick={() => setTab('accesses')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'accesses' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Accesos ({accesses.length})
        </button>
        <button
          onClick={() => setTab('drafts')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'drafts' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Borradores pendientes ({drafts.length})
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 rounded-lg p-3 flex items-center gap-2 text-sm">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : tab === 'accesses' ? (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Responsable</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Sector/Área</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Estado</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Accesos</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Últ. acceso</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Vence</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {accesses.length === 0 && (
                <tr><td colSpan={7} className="text-center py-8 text-gray-400">No hay accesos creados</td></tr>
              )}
              {accesses.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{a.recipientName}</div>
                    <div className="text-xs text-gray-500 flex items-center gap-1">
                      <Mail className="w-3 h-3" /> {a.recipientEmail}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {a.sector || a.area ? `${a.sector || ''} ${a.area ? `/ ${a.area}` : ''}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[a.status] || 'bg-gray-100'}`}>
                      {STATUS_LABELS[a.status] || a.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{a.accessCount}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {a.lastAccessAt ? new Date(a.lastAccessAt).toLocaleDateString('es-AR') : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {a.expiresAt ? new Date(a.expiresAt).toLocaleDateString('es-AR') : 'Sin vto.'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setDetailAccess(a)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                        title="Ver detalle"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {a.status === 'ACTIVE' && (
                        <button
                          onClick={() => handleAction(a.id, 'suspend')}
                          disabled={actionLoading === `${a.id}-suspend`}
                          className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded"
                          title="Suspender"
                        >
                          <Ban className="w-4 h-4" />
                        </button>
                      )}
                      {a.status === 'SUSPENDED' && (
                        <button
                          onClick={() => handleAction(a.id, 'reactivate')}
                          disabled={actionLoading === `${a.id}-reactivate`}
                          className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded"
                          title="Reactivar"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                      )}
                      {a.status !== 'REVOKED' && (
                        <button
                          onClick={() => {
                            const reason = prompt('Motivo de revocación:') || '';
                            handleAction(a.id, 'revoke');
                          }}
                          disabled={actionLoading === `${a.id}-revoke`}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                          title="Revocar"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Plan</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Enviado por</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Campos</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Estado</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Fecha</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {drafts.length === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-gray-400">No hay borradores pendientes</td></tr>
              )}
              {drafts.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-mono text-xs font-medium text-gray-900">{d.actionPlan?.code || 'Sin código'}</div>
                    <div className="text-xs text-gray-500 truncate max-w-xs">{d.actionPlan?.findingDescription || '—'}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {d.accessToken?.recipientName || '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {Object.keys(d.draftData || {}).join(', ')}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      d.status === 'SUBMITTED' ? 'bg-blue-100 text-blue-700' :
                      d.status === 'APPLIED' ? 'bg-green-100 text-green-700' :
                      d.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {DRAFT_STATUS_LABELS[d.status] || d.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {d.submittedAt ? new Date(d.submittedAt).toLocaleDateString('es-AR') : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {d.status === 'SUBMITTED' && (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleDraftAction(d.id, 'approve')}
                          disabled={actionLoading === `${d.id}-approve`}
                          className="flex items-center gap-1 px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                        >
                          <CheckCircle className="w-3.5 h-3.5" /> Aprobar
                        </button>
                        <button
                          onClick={() => handleDraftAction(d.id, 'reject')}
                          disabled={actionLoading === `${d.id}-reject`}
                          className="flex items-center gap-1 px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Rechazar
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail modal */}
      {detailAccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setDetailAccess(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h3 className="font-semibold text-gray-900">Detalle de acceso</h3>
              <button onClick={() => setDetailAccess(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-5 space-y-3 text-sm">
              <DetailRow label="Responsable" value={detailAccess.recipientName} />
              <DetailRow label="Email" value={detailAccess.recipientEmail} />
              <DetailRow label="Sector" value={detailAccess.sector || '—'} />
              <DetailRow label="Área" value={detailAccess.area || '—'} />
              <DetailRow label="Estado" value={STATUS_LABELS[detailAccess.status] || detailAccess.status} />
              <DetailRow label="Permisos" value={[
                detailAccess.canEdit && 'Editar',
                detailAccess.canAttachEvidence && 'Evidencias',
                detailAccess.canDownloadPdf && 'PDF',
                detailAccess.canChangeStatus && 'Cambiar estado',
                detailAccess.canCreateNonConformities && 'Crear NCR',
                detailAccess.canViewNcrOwn && 'Ver NCR propias',
                detailAccess.canEditNcrDraft && 'Editar borrador NCR',
                detailAccess.canCorrectNcrReturned && 'Corregir NCR',
                detailAccess.canDownloadNcrPdf && 'PDF NCR',
              ].filter(Boolean).join(', ') || 'Sin permisos'} />
              <DetailRow label="Accesos" value={`${detailAccess.accessCount}${detailAccess.maxAccesses ? ` / ${detailAccess.maxAccesses}` : ''}`} />
              <DetailRow label="Último acceso" value={detailAccess.lastAccessAt ? new Date(detailAccess.lastAccessAt).toLocaleString('es-AR') : '—'} />
              <DetailRow label="Vencimiento" value={detailAccess.expiresAt ? new Date(detailAccess.expiresAt).toLocaleDateString('es-AR') : 'Sin vencimiento'} />
              <DetailRow label="Creado" value={new Date(detailAccess.createdAt).toLocaleString('es-AR')} />
              <DetailRow label="Logs" value={`${detailAccess._count?.logs || 0} entradas`} />
              <DetailRow label="Borradores" value={`${detailAccess._count?.drafts || 0}`} />
            </div>
          </div>
        </div>
      )}

      {/* Create access modal */}
      {showCreate && (
        <CreateAccessModal onClose={() => setShowCreate(false)} onCreated={load} />
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b pb-2">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-900 font-medium text-right">{value}</span>
    </div>
  );
}

function CreateAccessModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [sector, setSector] = useState('');
  const [area, setArea] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [canEdit, setCanEdit] = useState(true);
  const [canAttachEvidence, setCanAttachEvidence] = useState(true);
  const [canDownloadPdf, setCanDownloadPdf] = useState(true);
  const [canCreateNonConformities, setCanCreateNonConformities] = useState(false);
  const [canViewNcrOwn, setCanViewNcrOwn] = useState(true);
  const [canEditNcrDraft, setCanEditNcrDraft] = useState(true);
  const [canCorrectNcrReturned, setCanCorrectNcrReturned] = useState(true);
  const [canDownloadNcrPdf, setCanDownloadNcrPdf] = useState(true);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string; token?: string } | null>(null);

  async function handleCreate() {
    setSending(true);
    try {
      const res = await fetch(`${API_BASE}/portal-accion/admin/access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          recipientName, recipientEmail,
          sector: sector || undefined, area: area || undefined,
          canEdit, canAttachEvidence, canDownloadPdf,
          canCreateNonConformities, canViewNcrOwn, canEditNcrDraft, canCorrectNcrReturned, canDownloadNcrPdf,
          expiresAt: expiresAt || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error');
      setResult({ ok: true, message: 'Acceso creado y email enviado', token: json.access?.token });
      setTimeout(() => { onClose(); onCreated(); }, 3000);
    } catch (e: any) {
      setResult({ ok: false, message: e.message });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-semibold text-gray-900">Nuevo acceso externo</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="p-5 space-y-3">
          {result && (
            <div className={`rounded-lg p-3 text-sm ${result.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {result.message}
              {result.token && (
                <div className="mt-2 text-xs break-all bg-white p-2 rounded border">
                  Link: /portal-accion/{result.token}
                </div>
              )}
            </div>
          )}
          <input placeholder="Nombre del responsable" value={recipientName} onChange={(e) => setRecipientName(e.target.value)}
            className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input type="email" placeholder="Email" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)}
            className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="Sector" value={sector} onChange={(e) => setSector(e.target.value)}
              className="px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <input placeholder="Área" value={area} onChange={(e) => setArea(e.target.value)}
              className="px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)}
            className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <div className="flex flex-wrap gap-3">
            <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={canEdit} onChange={(e) => setCanEdit(e.target.checked)} /> Editar</label>
            <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={canAttachEvidence} onChange={(e) => setCanAttachEvidence(e.target.checked)} /> Evidencias</label>
            <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={canDownloadPdf} onChange={(e) => setCanDownloadPdf(e.target.checked)} /> PDF</label>
          </div>
          <div className="border-t pt-3">
            <p className="text-xs font-semibold text-gray-500 mb-2">Permisos de No Conformidades</p>
            <div className="flex flex-wrap gap-3">
              <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={canCreateNonConformities} onChange={(e) => setCanCreateNonConformities(e.target.checked)} /> Crear NCR</label>
              <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={canViewNcrOwn} onChange={(e) => setCanViewNcrOwn(e.target.checked)} /> Ver propias</label>
              <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={canEditNcrDraft} onChange={(e) => setCanEditNcrDraft(e.target.checked)} /> Editar borrador</label>
              <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={canCorrectNcrReturned} onChange={(e) => setCanCorrectNcrReturned(e.target.checked)} /> Corregir</label>
              <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={canDownloadNcrPdf} onChange={(e) => setCanDownloadNcrPdf(e.target.checked)} /> PDF NCR</label>
            </div>
          </div>
          <button onClick={handleCreate} disabled={!recipientName || !recipientEmail || sending}
            className="w-full px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300">
            {sending ? 'Creando...' : 'Crear y enviar email'}
          </button>
        </div>
      </div>
    </div>
  );
}
