'use client';

import { useState, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { FileDown, Loader2, Shield, ShieldOff, X, ChevronDown } from 'lucide-react';

const SKIP_PATHS = ['/login', '/register', '/validate-doc', '/select-tenant', '/onboarding', '/plan-selection', '/plans', '/billing'];

function pathToOutputKey(path: string): string {
  return path.replace(/^\//, '').replace(/\//g, '-').replace(/[^a-z0-9-]/gi, '') || 'general';
}

function pathToTitle(path: string): string {
  const segments = path.replace(/^\//, '').split('/');
  const labels: Record<string, string> = {
    contexto: 'Contexto de la Organización', 'contexto-sgi': 'Contexto SGI', objetivos: 'Objetivos',
    'objetivos/politicas': 'Política y Objetivos', indicadores: 'Indicadores', riesgos: 'Riesgos',
    'no-conformidades': 'No Conformidades', acciones: 'Acciones CAPA', auditorias: 'Auditorías',
    capacitaciones: 'Capacitaciones', documentos: 'Documentos', documents: 'Documentos',
    proveedores: 'Proveedores', clientes: 'Clientes', incidentes: 'Incidentes',
    ambientales: 'Aspectos Ambientales', rrhh: 'RRHH', 'gestion-cambios': 'Gestión de Cambios',
    'partes-interesadas': 'Partes Interesadas', mantenimiento: 'Mantenimiento',
    calibraciones: 'Calibraciones', infraestructura: 'Infraestructura', activos: 'Activos',
    seguridad: 'Seguridad', iperc: 'IPERC', simulacros: 'Simulacros', minutas: 'Minutas',
    planes: 'Planes de Acción', proyectos: 'Proyectos', cumplimiento: 'Cumplimiento Legal',
    legales: 'Legales', normativos: 'Normativos', 'revision-direccion': 'Revisión de Dirección',
    reportes: 'Reportes', dashboard: 'Dashboard', clima: 'Clima Organizacional',
  };
  return labels[segments[0]] || segments.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' — ');
}

function capturePageContent(): string {
  const main = document.querySelector('main');
  if (!main) return document.body.innerHTML;

  const clone = main.cloneNode(true) as HTMLElement;

  // Remove interactive and non-printable elements
  const removeSelectors = [
    'button', 'input', 'textarea', 'select', 'form',
    '[data-no-export]', '.fixed', '[aria-modal]',
    'script', 'style', 'nav',
  ];
  removeSelectors.forEach(sel => {
    clone.querySelectorAll(sel).forEach(el => el.remove());
  });

  // Try to get page title from h1
  const h1 = clone.querySelector('h1');

  return `<div style="font-family:Arial,sans-serif;font-size:12px;">${clone.innerHTML}</div>`;
}

export default function GlobalExportFAB() {
  const pathname = usePathname();
  const [showMenu, setShowMenu] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  if (SKIP_PATHS.some(p => pathname?.startsWith(p))) return null;

  const outputKey = `page-${pathToOutputKey(pathname || 'general')}`;
  const title = pathToTitle(pathname || '');

  async function doExport(exportType: 'CONTROLLED' | 'INFORMATIVE') {
    setLoading(true);
    setError(null);
    setShowMenu(false);

    try {
      const bodyHtml = capturePageContent();
      const token = localStorage.getItem('accessToken');
      const tenantId = localStorage.getItem('tenantId');
      const csrf = localStorage.getItem('csrfToken');

      const res = await fetch('/api/doc-export/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(tenantId ? { 'x-tenant-id': tenantId } : {}),
          ...(csrf ? { 'x-csrf-token': csrf } : {}),
        },
        body: JSON.stringify({ outputKey, exportType, bodyHtml, title }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Error al exportar' }));
        throw new Error(err.error || 'Error al exportar');
      }

      const blob = await res.blob();
      const contentDisp = res.headers.get('Content-Disposition') || '';
      const match = contentDisp.match(/filename="?(.+?)"?$/);
      const fileName = match ? match[1] : `export_${Date.now()}.pdf`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = fileName;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e.message || 'Error al exportar');
      setTimeout(() => setError(null), 4000);
    }
    setLoading(false);
  }

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2" ref={menuRef}>
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700 shadow max-w-xs flex items-start gap-2">
          <X className="h-3 w-3 shrink-0 mt-0.5" onClick={() => setError(null)} />
          {error}
        </div>
      )}

      {showMenu && (
        <div className="bg-white rounded-xl border border-neutral-200 shadow-xl overflow-hidden w-52">
          <div className="px-3 py-2 border-b border-neutral-100 text-xs text-neutral-500 font-medium truncate">
            Exportar: {title}
          </div>
          <button
            onClick={() => doExport('CONTROLLED')}
            className="flex items-center gap-2 w-full px-3 py-2.5 text-left text-sm hover:bg-green-50 transition-colors"
          >
            <Shield className="h-4 w-4 text-green-600 shrink-0" />
            <div>
              <div className="font-medium text-neutral-800">PDF Controlado</div>
              <div className="text-xs text-neutral-400">Con QR y trazabilidad</div>
            </div>
          </button>
          <div className="border-t border-neutral-100" />
          <button
            onClick={() => doExport('INFORMATIVE')}
            className="flex items-center gap-2 w-full px-3 py-2.5 text-left text-sm hover:bg-blue-50 transition-colors"
          >
            <ShieldOff className="h-4 w-4 text-blue-500 shrink-0" />
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
        title="Exportar esta página a PDF"
        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-full shadow-lg px-4 py-2.5 text-sm font-medium transition-all"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
        Exportar PDF
        {!loading && <ChevronDown className="h-3 w-3 opacity-70" />}
      </button>
    </div>
  );
}
