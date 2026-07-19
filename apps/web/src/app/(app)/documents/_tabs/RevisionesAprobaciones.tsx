'use client';

import { useEffect, useState, useMemo } from 'react';
import { apiFetch } from '@/lib/api';
import {
  GitBranch, Plus, Save, X, Search, Filter, Clock,
  CheckCircle, AlertCircle, FileText, User, PenTool,
  ArrowRight, History, Shield, Trash2,
} from 'lucide-react';

interface Revision {
  id: string;
  revision: number;
  changeReason: string;
  status: string;
  documentCode?: string;
  title: string;
  metadata: any;
  createdAt: string;
  approvedAt?: string;
  approvedById?: string;
  obsoleteAt?: string;
  outputDefinition?: { screenName: string; module: string; documentCode?: string };
  approvals?: Approval[];
  signatures?: Signature[];
}

interface Approval {
  id: string;
  action: string;
  decision: string;
  comment?: string;
  userName?: string;
  userRole?: string;
  createdAt: string;
}

interface Signature {
  id: string;
  role: string;
  userName: string;
  userPosition?: string;
  signedAt: string;
  signatureHash?: string;
}

interface OutputDef {
  id: string;
  screenName: string;
  module: string;
  outputKey: string;
  documentCode?: string;
  revision: number;
  status: string;
}

const REV_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT: { label: 'Borrador', color: 'text-amber-700', bg: 'bg-amber-50' },
  REVIEW: { label: 'En Revisión', color: 'text-blue-700', bg: 'bg-blue-50' },
  PENDING_APPROVAL: { label: 'Pend. Aprob.', color: 'text-purple-700', bg: 'bg-purple-50' },
  EFFECTIVE: { label: 'Vigente', color: 'text-green-700', bg: 'bg-green-50' },
  OBSOLETE: { label: 'Obsoleto', color: 'text-red-700', bg: 'bg-red-50' },
};

const FLOW = ['DRAFT', 'REVIEW', 'PENDING_APPROVAL', 'EFFECTIVE'];

export default function RevisionesAprobaciones() {
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [outputs, setOutputs] = useState<OutputDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newRev, setNewRev] = useState({ outputDefinitionId: '', changeReason: '', title: '' });
  const [selectedRev, setSelectedRev] = useState<Revision | null>(null);
  const [approvalComment, setApprovalComment] = useState('');
  const [sigName, setSigName] = useState('');
  const [sigRole, setSigRole] = useState('ELABORATED');
  const [sigPosition, setSigPosition] = useState('');

  async function load() {
    setLoading(true);
    try {
      const [revs, outs] = await Promise.all([
        apiFetch<Revision[]>('/doc-export/revisions'),
        apiFetch<OutputDef[]>('/doc-export/outputs'),
      ]);
      setRevisions(Array.isArray(revs) ? revs : []);
      setOutputs(Array.isArray(outs) ? outs : []);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function createRevision() {
    if (!newRev.outputDefinitionId || !newRev.title) return;
    try {
      await apiFetch('/doc-export/revisions', { method: 'POST', json: newRev });
      setSuccess('Revisión creada');
      setShowCreate(false);
      setNewRev({ outputDefinitionId: '', changeReason: '', title: '' });
      load();
    } catch (e: any) { setError(e.message); }
  }

  async function changeStatus(revId: string, status: string) {
    try {
      await apiFetch(`/doc-export/revisions/${revId}/status`, { method: 'PUT', json: { status } });
      setSuccess(`Estado cambiado a ${REV_STATUS[status]?.label || status}`);
      load();
      if (selectedRev?.id === revId) {
        setSelectedRev({ ...selectedRev, status });
      }
    } catch (e: any) { setError(e.message); }
  }

  async function submitApproval(revId: string, decision: string) {
    try {
      await apiFetch('/doc-export/approvals', {
        method: 'POST',
        json: { revisionId: revId, action: 'REVIEW', decision, comment: approvalComment },
      });
      setSuccess(decision === 'APPROVED' ? 'Aprobación registrada' : 'Rechazo registrado');
      setApprovalComment('');
      load();
    } catch (e: any) { setError(e.message); }
  }

  async function addSignature(revId: string) {
    if (!sigName) return;
    try {
      await apiFetch('/doc-export/signatures', {
        method: 'POST',
        json: { revisionId: revId, role: sigRole, userName: sigName, userPosition: sigPosition },
      });
      setSuccess('Firma registrada');
      setSigName(''); setSigPosition('');
      load();
    } catch (e: any) { setError(e.message); }
  }

  const filtered = useMemo(() => {
    if (!Array.isArray(revisions)) return [];
    return revisions.filter(r => {
      if (search) {
        const q = search.toLowerCase();
        if (!r.title.toLowerCase().includes(q) && !(r.documentCode || '').toLowerCase().includes(q)) return false;
      }
      if (filterStatus && r.status !== filterStatus) return false;
      return true;
    });
  }, [revisions, search, filterStatus]);

  if (loading) return <div className="p-8 text-center text-neutral-400">Cargando revisiones...</div>;

  return (
    <div className="space-y-4">
      {error && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">{success}</div>}

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-neutral-800">Revisiones y Aprobaciones</h2>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" /> Nueva Revisión
        </button>
      </div>

      {showCreate && (
        <div className="rounded-xl border border-neutral-200 bg-white p-4 space-y-3 shadow-sm">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Documento</label>
              <select
                value={newRev.outputDefinitionId}
                onChange={e => setNewRev({ ...newRev, outputDefinitionId: e.target.value })}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              >
                <option value="">Seleccionar...</option>
                {outputs.map(o => (
                  <option key={o.id} value={o.id}>{o.screenName} ({o.module})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Título</label>
              <input
                value={newRev.title}
                onChange={e => setNewRev({ ...newRev, title: e.target.value })}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Motivo de Cambio</label>
              <input
                value={newRev.changeReason}
                onChange={e => setNewRev({ ...newRev, changeReason: e.target.value })}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowCreate(false)} className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm">Cancelar</button>
            <button onClick={createRevision} className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm text-white">Crear</button>
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por título o código..."
            className="w-full rounded-lg border border-neutral-300 pl-9 pr-3 py-2 text-sm"
          />
        </div>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        >
          <option value="">Todos los estados</option>
          {Object.entries(REV_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      <div className="grid gap-3">
        {filtered.map(r => {
          const st = REV_STATUS[r.status] || { label: r.status, color: '', bg: '' };
          const currentIdx = FLOW.indexOf(r.status);
          return (
            <div key={r.id} className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <GitBranch className="h-5 w-5 text-brand-600" />
                  <div>
                    <h3 className="font-semibold text-sm text-neutral-800">{r.title}</h3>
                    <div className="text-xs text-neutral-400 mt-0.5">
                      <code className="font-mono text-blue-700">{r.documentCode || '—'}</code>
                      {' · '}R{String(r.revision).padStart(2, '0')}
                      {' · '}{r.outputDefinition?.screenName}
                    </div>
                  </div>
                </div>
                <span className={`rounded px-2 py-0.5 text-xs font-medium ${st.bg} ${st.color}`}>{st.label}</span>
              </div>

              {r.changeReason && <p className="mt-2 text-xs text-neutral-500">Motivo: {r.changeReason}</p>}

              {/* Workflow visual */}
              <div className="mt-3 flex items-center gap-1">
                {FLOW.map((s, i) => (
                  <div key={s} className="flex items-center">
                    <div className={`rounded px-2 py-0.5 text-xs ${i <= currentIdx ? 'bg-brand-100 text-brand-700' : 'bg-neutral-100 text-neutral-400'}`}>
                      {REV_STATUS[s]?.label}
                    </div>
                    {i < FLOW.length - 1 && <ArrowRight className="h-3 w-3 text-neutral-300 mx-0.5" />}
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="mt-3 flex flex-wrap gap-2">
                {r.status === 'DRAFT' && (
                  <button onClick={() => changeStatus(r.id, 'REVIEW')} className="rounded-lg bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100">
                    Enviar a Revisión
                  </button>
                )}
                {r.status === 'REVIEW' && (
                  <>
                    <button onClick={() => changeStatus(r.id, 'PENDING_APPROVAL')} className="rounded-lg bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700 hover:bg-purple-100">
                      Solicitar Aprobación
                    </button>
                    <button onClick={() => submitApproval(r.id, 'REJECTED')} className="rounded-lg bg-red-50 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-100">
                      Rechazar
                    </button>
                  </>
                )}
                {r.status === 'PENDING_APPROVAL' && (
                  <>
                    <button onClick={() => changeStatus(r.id, 'EFFECTIVE')} className="rounded-lg bg-green-50 px-3 py-1 text-xs font-medium text-green-700 hover:bg-green-100">
                      Aprobar y Publicar
                    </button>
                    <button onClick={() => submitApproval(r.id, 'REJECTED')} className="rounded-lg bg-red-50 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-100">
                      Rechazar
                    </button>
                  </>
                )}
                <button onClick={() => setSelectedRev(r)} className="rounded-lg border border-neutral-200 px-3 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-50">
                  Ver detalle
                </button>
              </div>

              {/* Aprobaciones y firmas */}
              {(r.approvals?.length || r.signatures?.length) ? (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  {r.approvals && r.approvals.length > 0 && (
                    <div>
                      <div className="text-xs font-bold text-neutral-500 mb-1">Aprobaciones</div>
                      {r.approvals.map(a => (
                        <div key={a.id} className="text-xs text-neutral-600 flex items-center gap-1">
                          {a.decision === 'APPROVED' ? <CheckCircle className="h-3 w-3 text-green-500" /> : <AlertCircle className="h-3 w-3 text-red-500" />}
                          {a.userName} — {a.decision}
                          {a.comment && ` (${a.comment})`}
                        </div>
                      ))}
                    </div>
                  )}
                  {r.signatures && r.signatures.length > 0 && (
                    <div>
                      <div className="text-xs font-bold text-neutral-500 mb-1">Firmas</div>
                      {r.signatures.map(s => (
                        <div key={s.id} className="text-xs text-neutral-600 flex items-center gap-1">
                          <PenTool className="h-3 w-3 text-brand-500" />
                          {s.role}: {s.userName}
                          {s.userPosition && ` (${s.userPosition})`}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="py-12 text-center text-neutral-400">
            <History className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No hay revisiones registradas.</p>
          </div>
        )}
      </div>

      {/* Modal detalle */}
      {selectedRev && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-neutral-800">Detalle de Revisión R{String(selectedRev.revision).padStart(2, '0')}</h3>
              <button onClick={() => setSelectedRev(null)} className="text-neutral-400 hover:text-neutral-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <dl className="space-y-1 text-sm">
              <div className="flex justify-between"><dt className="text-neutral-500">Título:</dt><dd>{selectedRev.title}</dd></div>
              <div className="flex justify-between"><dt className="text-neutral-500">Código:</dt><dd className="font-mono text-blue-700">{selectedRev.documentCode || '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-neutral-500">Motivo:</dt><dd>{selectedRev.changeReason}</dd></div>
              <div className="flex justify-between"><dt className="text-neutral-500">Estado:</dt><dd>{REV_STATUS[selectedRev.status]?.label}</dd></div>
              <div className="flex justify-between"><dt className="text-neutral-500">Fecha:</dt><dd>{new Date(selectedRev.createdAt).toLocaleString('es-AR')}</dd></div>
            </dl>

            {/* Aprobar/rechazar con comentario */}
            {selectedRev.status === 'REVIEW' || selectedRev.status === 'PENDING_APPROVAL' ? (
              <div className="border-t border-neutral-100 pt-3 space-y-2">
                <input
                  value={approvalComment}
                  onChange={e => setApprovalComment(e.target.value)}
                  placeholder="Comentario de aprobación/rechazo..."
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                />
                <div className="flex gap-2">
                  <button onClick={() => submitApproval(selectedRev.id, 'APPROVED')} className="rounded-lg bg-green-600 px-3 py-1.5 text-sm text-white">Aprobar</button>
                  <button onClick={() => submitApproval(selectedRev.id, 'REJECTED')} className="rounded-lg bg-red-600 px-3 py-1.5 text-sm text-white">Rechazar</button>
                </div>
              </div>
            ) : null}

            {/* Agregar firma */}
            <div className="border-t border-neutral-100 pt-3 space-y-2">
              <h4 className="text-sm font-semibold text-neutral-700">Agregar Firma</h4>
              <div className="grid grid-cols-3 gap-2">
                <select value={sigRole} onChange={e => setSigRole(e.target.value)} className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm">
                  <option value="ELABORATED">Elaboró</option>
                  <option value="REVIEWED">Revisó</option>
                  <option value="APPROVED">Aprobó</option>
                </select>
                <input value={sigName} onChange={e => setSigName(e.target.value)} placeholder="Nombre" className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm" />
                <input value={sigPosition} onChange={e => setSigPosition(e.target.value)} placeholder="Cargo" className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm" />
              </div>
              <button onClick={() => addSignature(selectedRev.id)} className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm text-white">Firmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
