'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { ScrollText, Search, Download } from 'lucide-react';

interface AuditEntry {
  id: string;
  documentCode: string;
  documentTitle: string;
  exportType: string;
  userName: string;
  userIp: string;
  userAgent: string;
  fileHash: string;
  fileSize: number;
  createdAt: string;
}

export default function AuditoriaExportaciones() {
  const [items, setItems] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const limit = 50;

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', String(limit));
      params.set('offset', String(page * limit));
      if (search) params.set('userId', search);
      const data = await apiFetch<{ data: AuditEntry[]; total: number }>(`/doc-export/audit-log?${params}`);
      setItems(Array.isArray(data?.data) ? data.data : []);
      setTotal(typeof data?.total === 'number' ? data.total : 0);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }

  useEffect(() => { load(); }, [page]);

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  return (
    <div className="space-y-4">
      {error && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-neutral-800 flex items-center gap-2">
          <ScrollText className="h-5 w-5 text-brand-600" /> Auditoría de Exportaciones
        </h2>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { setPage(0); load(); } }}
              placeholder="Buscar por usuario..."
              className="rounded-lg border border-neutral-300 pl-9 pr-3 py-1.5 text-sm w-48"
            />
          </div>
          <button onClick={() => { setPage(0); load(); }} className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm">Buscar</button>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-neutral-400">Cargando...</div>
      ) : (
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-neutral-600">Documento</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-600">Tipo</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-600">Usuario</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-600">IP</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-600">Hash</th>
                <th className="text-right px-4 py-3 font-medium text-neutral-600">Tamaño</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-600">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {items.map(e => (
                <tr key={e.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-neutral-800 text-xs">{e.documentTitle || '—'}</div>
                    <code className="text-[10px] text-blue-600">{e.documentCode || '—'}</code>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${e.exportType === 'CONTROLLED' ? 'bg-blue-50 text-blue-700' : 'bg-neutral-100 text-neutral-600'}`}>
                      {e.exportType === 'CONTROLLED' ? 'Controlada' : 'Informativa'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-neutral-600 text-xs">{e.userName || '—'}</td>
                  <td className="px-4 py-3 text-neutral-400 text-xs font-mono">{e.userIp || '—'}</td>
                  <td className="px-4 py-3 text-neutral-400 text-xs font-mono truncate max-w-[120px]">{e.fileHash ? e.fileHash.substring(0, 16) + '...' : '—'}</td>
                  <td className="px-4 py-3 text-right text-neutral-500 text-xs">{formatSize(e.fileSize)}</td>
                  <td className="px-4 py-3 text-neutral-400 text-xs">{new Date(e.createdAt).toLocaleString('es-AR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 && (
            <div className="py-12 text-center text-neutral-400">
              <ScrollText className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Sin registros de auditoría</p>
            </div>
          )}
        </div>
      )}

      {total > limit && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-40">Anterior</button>
          <span className="text-sm text-neutral-500">Página {page + 1} de {Math.ceil(total / limit)}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={(page + 1) * limit >= total} className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-40">Siguiente</button>
        </div>
      )}
    </div>
  );
}
