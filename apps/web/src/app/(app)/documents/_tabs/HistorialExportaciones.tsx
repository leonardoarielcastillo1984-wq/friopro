'use client';

import { useEffect, useState, useMemo } from 'react';
import { apiFetch } from '@/lib/api';
import {
  History, Search, Filter, FileDown, Eye, X, Clock,
  CheckCircle, AlertCircle, Shield, ShieldOff,
} from 'lucide-react';

interface ExportRecord {
  id: string;
  outputDefinitionId?: string;
  documentCode?: string;
  revision: number;
  documentTitle?: string;
  exportType: string;
  templateName?: string;
  fileName: string;
  fileSize: number;
  pageCount: number;
  fileHash?: string;
  recordCount: number;
  userId?: string;
  userName?: string;
  userIp?: string;
  createdAt: string;
  outputDefinition?: { screenName: string; module: string; outputKey: string };
  validationToken?: { token: string; expiresAt?: string };
}

export default function HistorialExportaciones() {
  const [exports, setExports] = useState<ExportRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [detail, setDetail] = useState<ExportRecord | null>(null);
  const [page, setPage] = useState(0);
  const limit = 50;

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', String(limit));
      params.set('offset', String(page * limit));
      if (filterType) params.set('exportType', filterType);
      const data = await apiFetch<{ data: ExportRecord[]; total: number }>(`/doc-export/exports?${params}`);
      setExports(Array.isArray(data?.data) ? data.data : []);
      setTotal(typeof data?.total === 'number' ? data.total : 0);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [page, filterType]);

  const filtered = useMemo(() => {
    if (!Array.isArray(exports)) return [];
    if (!search) return exports;
    const q = search.toLowerCase();
    return exports.filter(e =>
      (e.documentCode || '').toLowerCase().includes(q) ||
      (e.documentTitle || '').toLowerCase().includes(q) ||
      (e.fileName || '').toLowerCase().includes(q) ||
      (e.userName || '').toLowerCase().includes(q)
    );
  }, [exports, search]);

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  function formatDate(d: string): string {
    return new Date(d).toLocaleString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  if (loading) return <div className="p-8 text-center text-neutral-400">Cargando historial...</div>;

  return (
    <div className="space-y-4">
      {error && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-neutral-800">Historial de Exportaciones</h2>
        <span className="text-sm text-neutral-500">{total} exportaciones registradas</span>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por código, título, archivo o usuario..."
            className="w-full rounded-lg border border-neutral-300 pl-9 pr-3 py-2 text-sm"
          />
        </div>
        <select
          value={filterType}
          onChange={e => { setFilterType(e.target.value); setPage(0); }}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        >
          <option value="">Todos los tipos</option>
          <option value="CONTROLLED">Controladas</option>
          <option value="INFORMATIVE">Informativas</option>
        </select>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 border-b border-neutral-200">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-neutral-600">Fecha</th>
              <th className="px-3 py-2 text-left font-medium text-neutral-600">Código</th>
              <th className="px-3 py-2 text-left font-medium text-neutral-600">Documento</th>
              <th className="px-3 py-2 text-left font-medium text-neutral-600">Tipo</th>
              <th className="px-3 py-2 text-left font-medium text-neutral-600">Usuario</th>
              <th className="px-3 py-2 text-center font-medium text-neutral-600">Págs</th>
              <th className="px-3 py-2 text-left font-medium text-neutral-600">Tamaño</th>
              <th className="px-3 py-2 text-right font-medium text-neutral-600">Detalle</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {filtered.map(e => (
              <tr key={e.id} className="hover:bg-neutral-50">
                <td className="px-3 py-2 text-xs text-neutral-500">{formatDate(e.createdAt)}</td>
                <td className="px-3 py-2">
                  {e.documentCode ? (
                    <code className="font-mono text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">{e.documentCode}</code>
                  ) : <span className="text-neutral-300 text-xs italic">—</span>}
                </td>
                <td className="px-3 py-2 text-neutral-700 max-w-[200px] truncate">{e.documentTitle || e.fileName}</td>
                <td className="px-3 py-2">
                  {e.exportType === 'CONTROLLED' ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded">
                      <Shield className="h-3 w-3" /> Controlada
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded">
                      <ShieldOff className="h-3 w-3" /> No Controlada
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-xs text-neutral-600">{e.userName || '—'}</td>
                <td className="px-3 py-2 text-center text-neutral-500 text-xs">{e.pageCount}</td>
                <td className="px-3 py-2 text-xs text-neutral-500">{formatSize(e.fileSize)}</td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => setDetail(e)} className="text-neutral-400 hover:text-brand-600">
                    <Eye className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-neutral-400">
            <History className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No hay exportaciones registradas.</p>
          </div>
        )}
      </div>

      {/* Paginación */}
      {total > limit && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-40"
          >
            Anterior
          </button>
          <span className="text-sm text-neutral-500">
            Página {page + 1} de {Math.ceil(total / limit)}
          </span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={(page + 1) * limit >= total}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-40"
          >
            Siguiente
          </button>
        </div>
      )}

      {/* Modal detalle */}
      {detail && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-neutral-800">Detalle de Exportación</h3>
              <button onClick={() => setDetail(null)} className="text-neutral-400 hover:text-neutral-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-neutral-500">Fecha:</dt><dd className="text-neutral-800">{formatDate(detail.createdAt)}</dd></div>
              <div className="flex justify-between"><dt className="text-neutral-500">Código:</dt><dd className="font-mono text-blue-700">{detail.documentCode || '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-neutral-500">Revisión:</dt><dd>R{String(detail.revision).padStart(2, '0')}</dd></div>
              <div className="flex justify-between"><dt className="text-neutral-500">Título:</dt><dd>{detail.documentTitle || '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-neutral-500">Tipo:</dt><dd>{detail.exportType === 'CONTROLLED' ? 'Controlada' : 'No Controlada'}</dd></div>
              <div className="flex justify-between"><dt className="text-neutral-500">Archivo:</dt><dd className="font-mono text-xs">{detail.fileName}</dd></div>
              <div className="flex justify-between"><dt className="text-neutral-500">Tamaño:</dt><dd>{formatSize(detail.fileSize)}</dd></div>
              <div className="flex justify-between"><dt className="text-neutral-500">Páginas:</dt><dd>{detail.pageCount}</dd></div>
              <div className="flex justify-between"><dt className="text-neutral-500">Registros:</dt><dd>{detail.recordCount}</dd></div>
              <div className="flex justify-between"><dt className="text-neutral-500">Usuario:</dt><dd>{detail.userName || '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-neutral-500">IP:</dt><dd className="font-mono text-xs">{detail.userIp || '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-neutral-500">Hash SHA-256:</dt><dd className="font-mono text-xs break-all max-w-[300px]">{detail.fileHash || '—'}</dd></div>
              {detail.validationToken && (
                <div className="flex justify-between"><dt className="text-neutral-500">Token QR:</dt><dd className="font-mono text-xs break-all max-w-[300px]">{detail.validationToken.token}</dd></div>
              )}
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}
