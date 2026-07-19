'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import {
  Search, Filter, FileText, Download, Eye, Edit2, CheckCircle2,
  AlertTriangle, Clock, Archive, RefreshCw, ChevronDown, X, Save,
  Calendar, User, Link2, Tag, Hash
} from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  DRAFT:     { label: 'Borrador',    color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200',   icon: Clock },
  REVIEW:    { label: 'En revisión', color: 'text-blue-700',    bg: 'bg-blue-50 border-blue-200',     icon: RefreshCw },
  EFFECTIVE: { label: 'Vigente',     color: 'text-green-700',   bg: 'bg-green-50 border-green-200',   icon: CheckCircle2 },
  OBSOLETE:  { label: 'Obsoleto',    color: 'text-neutral-500', bg: 'bg-neutral-100 border-neutral-200', icon: Archive },
};

interface DocRow {
  id: string;
  documentCode: string | null;
  title: string;
  type: string;
  status: string;
  version: number;
  process: string | null;
  createdAt: string;
  approvedAt: string | null;
  nextReviewDate: string | null;
  typeConfig: { id: string; name: string; abbreviation: string; color: string } | null;
  department: { id: string; name: string } | null;
  owner: { id: string; email: string; firstName?: string; lastName?: string } | null;
  approvedBy: { id: string; email: string; firstName?: string; lastName?: string } | null;
  relatedDocument: { id: string; title: string; documentCode: string | null } | null;
  _count: { versions: number };
}

interface TypeConfig { id: string; name: string; abbreviation: string; color: string; nextSequence: number }
interface CodeConfig { prefix: string; digitCount: number; separator: string }

interface EditModal {
  doc: DocRow;
  status: string;
  process: string;
  nextReviewDate: string;
  approvedAt: string;
  relatedDocumentId: string;
}

export default function MaestroDocumentos() {
  const router = useRouter();
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [typeConfigs, setTypeConfigs] = useState<TypeConfig[]>([]);
  const [codeConfig, setCodeConfig] = useState<CodeConfig>({ prefix: 'SGI', digitCount: 3, separator: '-' });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterType, setFilterType] = useState('ALL');
  const [editModal, setEditModal] = useState<EditModal | null>(null);
  const [saving, setSaving] = useState(false);
  const [allDocs, setAllDocs] = useState<{ id: string; title: string; documentCode: string | null }[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (filterStatus !== 'ALL') params.set('status', filterStatus);
      if (filterType !== 'ALL') params.set('typeConfigId', filterType);
      const data = await apiFetch(`/documents/master?${params}`) as any;
      setDocs(data.documents || []);
      setTypeConfigs(data.typeConfigs || []);
      if (data.codeConfig) setCodeConfig(data.codeConfig);
    } catch {}
    setLoading(false);
  }, [search, filterStatus, filterType]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    apiFetch('/documents').then((d: any) => setAllDocs(d.documents || [])).catch(() => {});
  }, []);

  function formatDate(d: string | null) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('es-AR');
  }

  function userName(u: { email: string; firstName?: string; lastName?: string } | null) {
    if (!u) return '—';
    const name = [u.firstName, u.lastName].filter(Boolean).join(' ');
    return name || u.email;
  }

  function openEdit(doc: DocRow) {
    setEditModal({
      doc,
      status: doc.status,
      process: doc.process || '',
      nextReviewDate: doc.nextReviewDate ? doc.nextReviewDate.slice(0, 10) : '',
      approvedAt: doc.approvedAt ? doc.approvedAt.slice(0, 10) : '',
      relatedDocumentId: doc.relatedDocument?.id || '',
    });
  }

  async function saveEdit() {
    if (!editModal) return;
    setSaving(true);
    try {
      await apiFetch(`/documents/${editModal.doc.id}/master`, {
        method: 'PUT',
        body: JSON.stringify({
          status: editModal.status,
          process: editModal.process || undefined,
          nextReviewDate: editModal.nextReviewDate ? new Date(editModal.nextReviewDate).toISOString() : null,
          approvedAt: editModal.approvedAt ? new Date(editModal.approvedAt).toISOString() : null,
          relatedDocumentId: editModal.relatedDocumentId || null,
        }),
      });
      setEditModal(null);
      load();
    } catch {}
    setSaving(false);
  }

  function exportCSV() {
    const rows = [
      ['Código', 'Título', 'Tipo', 'Área/Proceso', 'Versión', 'Estado', 'Responsable', 'F. Creación', 'F. Aprobación', 'Próx. Revisión', 'Relacionado'],
      ...docs.map(d => [
        d.documentCode || '',
        d.title,
        d.typeConfig?.name || d.type,
        d.department?.name || d.process || '',
        String(d.version),
        STATUS_CONFIG[d.status]?.label || d.status,
        userName(d.owner),
        formatDate(d.createdAt),
        formatDate(d.approvedAt),
        formatDate(d.nextReviewDate),
        d.relatedDocument?.documentCode || d.relatedDocument?.title || '',
      ]),
    ];
    const csv = '\uFEFF' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `maestro-documentos-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const reviewSoon = docs.filter(d => {
    if (!d.nextReviewDate) return false;
    const diff = (new Date(d.nextReviewDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return diff <= 30 && diff >= 0;
  }).length;
  const overdue = docs.filter(d => d.nextReviewDate && new Date(d.nextReviewDate) < new Date()).length;

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-neutral-200 rounded-xl p-4">
          <p className="text-xs text-neutral-500 mb-1">Total documentos</p>
          <p className="text-2xl font-bold text-neutral-800">{docs.length}</p>
        </div>
        <div className="bg-white border border-neutral-200 rounded-xl p-4">
          <p className="text-xs text-neutral-500 mb-1">Vigentes</p>
          <p className="text-2xl font-bold text-green-600">{docs.filter(d => d.status === 'EFFECTIVE').length}</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-xs text-amber-700 mb-1">Vence pronto (30d)</p>
          <p className="text-2xl font-bold text-amber-600">{reviewSoon}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-xs text-red-700 mb-1">Revisión vencida</p>
          <p className="text-2xl font-bold text-red-600">{overdue}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <input
            className="w-full pl-9 pr-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Buscar por código o título..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="text-sm border border-neutral-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
        >
          <option value="ALL">Todos los estados</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <select
          className="text-sm border border-neutral-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
        >
          <option value="ALL">Todos los tipos</option>
          {typeConfigs.map(t => (
            <option key={t.id} value={t.id}>{t.name} ({t.abbreviation})</option>
          ))}
        </select>
        <button
          onClick={exportCSV}
          className="flex items-center gap-1.5 text-sm border border-neutral-200 rounded-lg px-3 py-2 bg-white hover:bg-neutral-50"
        >
          <Download className="h-4 w-4" /> Exportar CSV
        </button>
        <button
          onClick={load}
          className="p-2 border border-neutral-200 rounded-lg bg-white hover:bg-neutral-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Formato de código vigente */}
      <div className="flex items-center gap-2 text-xs text-neutral-500 bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2">
        <Hash className="h-3.5 w-3.5" />
        <span>Formato de código configurado:</span>
        <code className="font-mono font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
          {codeConfig.prefix}{codeConfig.separator}[TIPO]{codeConfig.separator}{Array(codeConfig.digitCount).fill('0').join('')}
        </code>
        <span className="text-neutral-400">ej: {codeConfig.prefix}{codeConfig.separator}{typeConfigs[0]?.abbreviation || 'PR'}{codeConfig.separator}{Array(codeConfig.digitCount).fill('0').join('').slice(0, -1)}1</span>
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="text-center py-12 text-neutral-400 text-sm">Cargando maestro...</div>
      ) : docs.length === 0 ? (
        <div className="text-center py-12 text-neutral-400 text-sm">No hay documentos que coincidan con los filtros</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Código</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Título</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Tipo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Área / Proceso</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Ver.</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Estado</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Responsable</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Creación</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Aprobación</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Próx. Revisión</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Relacionado</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {docs.map(doc => {
                const st = STATUS_CONFIG[doc.status] || STATUS_CONFIG.DRAFT;
                const StIcon = st.icon;
                const isOverdue = doc.nextReviewDate && new Date(doc.nextReviewDate) < new Date();
                const reviewDiff = doc.nextReviewDate
                  ? (new Date(doc.nextReviewDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                  : null;
                const soonReview = reviewDiff !== null && reviewDiff <= 30 && reviewDiff >= 0;
                return (
                  <tr key={doc.id} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-4 py-3">
                      {doc.documentCode ? (
                        <code className="font-mono text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                          {doc.documentCode}
                        </code>
                      ) : (
                        <span className="text-neutral-300 text-xs italic">Sin código</span>
                      )}
                    </td>
                    <td className="px-4 py-3 max-w-56">
                      <button
                        onClick={() => router.push(`/documents/${doc.id}`)}
                        className="font-medium text-neutral-800 hover:text-blue-600 text-left line-clamp-2"
                      >
                        {doc.title}
                      </button>
                      {doc._count.versions > 1 && (
                        <span className="text-xs text-neutral-400">{doc._count.versions} versiones</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {doc.typeConfig ? (
                        <span
                          className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium border"
                          style={{ borderColor: doc.typeConfig.color + '60', backgroundColor: doc.typeConfig.color + '15', color: doc.typeConfig.color }}
                        >
                          {doc.typeConfig.abbreviation} · {doc.typeConfig.name}
                        </span>
                      ) : (
                        <span className="text-xs text-neutral-400">{doc.type}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-neutral-600">{doc.department?.name || doc.process || '—'}</td>
                    <td className="px-4 py-3 text-center text-xs font-mono text-neutral-700">v{doc.version}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${st.bg} ${st.color}`}>
                        <StIcon className="h-3 w-3" />
                        {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-neutral-600">{userName(doc.owner)}</td>
                    <td className="px-4 py-3 text-xs text-neutral-500">{formatDate(doc.createdAt)}</td>
                    <td className="px-4 py-3 text-xs text-neutral-500">{formatDate(doc.approvedAt)}</td>
                    <td className="px-4 py-3 text-xs">
                      {doc.nextReviewDate ? (
                        <span className={`font-medium ${isOverdue ? 'text-red-600' : soonReview ? 'text-amber-600' : 'text-neutral-600'}`}>
                          {isOverdue && '⚠ '}
                          {formatDate(doc.nextReviewDate)}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-neutral-500">
                      {doc.relatedDocument ? (
                        <span className="text-blue-600">{doc.relatedDocument.documentCode || doc.relatedDocument.title.slice(0, 20)}</span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => openEdit(doc)}
                        className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-500 hover:text-blue-600"
                        title="Editar metadatos"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de edición */}
      {editModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b border-neutral-100">
              <div>
                <h3 className="font-semibold text-neutral-800">Editar metadatos</h3>
                <p className="text-xs text-neutral-500 mt-0.5 font-mono">{editModal.doc.documentCode || editModal.doc.title}</p>
              </div>
              <button onClick={() => setEditModal(null)} className="p-1.5 hover:bg-neutral-100 rounded-lg">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Estado</label>
                <select
                  className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={editModal.status}
                  onChange={e => setEditModal(m => m ? { ...m, status: e.target.value } : null)}
                >
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Área / Proceso</label>
                <input
                  className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="ej: Recursos Humanos, Compras..."
                  value={editModal.process}
                  onChange={e => setEditModal(m => m ? { ...m, process: e.target.value } : null)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Fecha de aprobación</label>
                  <input
                    type="date"
                    className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={editModal.approvedAt}
                    onChange={e => setEditModal(m => m ? { ...m, approvedAt: e.target.value } : null)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Próxima revisión</label>
                  <input
                    type="date"
                    className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={editModal.nextReviewDate}
                    onChange={e => setEditModal(m => m ? { ...m, nextReviewDate: e.target.value } : null)}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Documento relacionado</label>
                <select
                  className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={editModal.relatedDocumentId}
                  onChange={e => setEditModal(m => m ? { ...m, relatedDocumentId: e.target.value } : null)}
                >
                  <option value="">— Sin relación —</option>
                  {allDocs.filter(d => d.id !== editModal.doc.id).map(d => (
                    <option key={d.id} value={d.id}>
                      {d.documentCode ? `[${d.documentCode}] ` : ''}{d.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-neutral-100">
              <button
                onClick={() => setEditModal(null)}
                className="px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={saveEdit}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
