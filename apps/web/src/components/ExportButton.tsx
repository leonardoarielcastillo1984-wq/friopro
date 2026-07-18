'use client';

import { useState, useRef } from 'react';
import { apiFetch } from '@/lib/api';
import { Download, Loader2, Shield, ShieldOff, FileDown } from 'lucide-react';

interface ExportButtonProps {
  outputKey: string;
  title?: string;
  bodyHtml: string;
  recordCount?: number;
  filters?: Record<string, any>;
  moduleName?: string;
  defaultExportType?: 'CONTROLLED' | 'INFORMATIVE';
  className?: string;
  label?: string;
}

export default function ExportButton({
  outputKey,
  title,
  bodyHtml,
  recordCount,
  filters,
  moduleName,
  defaultExportType = 'INFORMATIVE',
  className,
  label,
}: ExportButtonProps) {
  const [loading, setLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  async function doExport(exportType: 'CONTROLLED' | 'INFORMATIVE') {
    setLoading(true);
    setError(null);
    setShowMenu(false);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      const tenantId = typeof window !== 'undefined' ? localStorage.getItem('tenantId') : null;
      const csrf = typeof window !== 'undefined' ? localStorage.getItem('csrfToken') : null;

      const res = await fetch('/api/doc-export/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(tenantId ? { 'x-tenant-id': tenantId } : {}),
          ...(csrf ? { 'x-csrf-token': csrf } : {}),
        },
        body: JSON.stringify({
          outputKey,
          exportType,
          bodyHtml,
          title,
          recordCount,
          filters,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Error en exportación' }));
        throw new Error(err.error || 'Error en exportación');
      }

      const blob = await res.blob();
      const contentDisp = res.headers.get('Content-Disposition') || '';
      const fileNameMatch = contentDisp.match(/filename="?(.+?)"?$/);
      const fileName = fileNameMatch ? fileNameMatch[1] : `export_${Date.now()}.pdf`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e.message || 'Error al exportar');
    }
    setLoading(false);
  }

  return (
    <div className="relative inline-block" ref={menuRef}>
      {error && (
        <div className="absolute right-0 top-full mt-1 z-50 w-64 rounded-lg bg-red-50 border border-red-200 p-2 text-xs text-red-700 shadow-sm">
          {error}
        </div>
      )}

      {showMenu && (
        <div className="absolute right-0 top-full mt-1 z-50 w-56 rounded-lg border border-neutral-200 bg-white shadow-lg overflow-hidden">
          <button
            onClick={() => doExport('CONTROLLED')}
            disabled={loading}
            className="flex items-center gap-2 w-full px-3 py-2.5 text-left text-sm hover:bg-green-50 transition-colors"
          >
            <Shield className="h-4 w-4 text-green-600" />
            <div>
              <div className="font-medium text-neutral-800">PDF Controlado</div>
              <div className="text-xs text-neutral-400">Con QR, firmas y trazabilidad</div>
            </div>
          </button>
          <div className="border-t border-neutral-100" />
          <button
            onClick={() => doExport('INFORMATIVE')}
            disabled={loading}
            className="flex items-center gap-2 w-full px-3 py-2.5 text-left text-sm hover:bg-blue-50 transition-colors"
          >
            <ShieldOff className="h-4 w-4 text-blue-600" />
            <div>
              <div className="font-medium text-neutral-800">PDF Informativo</div>
              <div className="text-xs text-neutral-400">Copia no controlada</div>
            </div>
          </button>
        </div>
      )}

      <button
        onClick={() => setShowMenu(!showMenu)}
        disabled={loading}
        className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
          className || 'border border-neutral-300 text-neutral-700 hover:bg-neutral-50'
        }`}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileDown className="h-4 w-4" />
        )}
        {label || 'Exportar PDF'}
      </button>
    </div>
  );
}
