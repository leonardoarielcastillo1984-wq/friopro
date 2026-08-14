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

  // Convert <select> elements to <span> with the selected value text
  clone.querySelectorAll('select').forEach(sel => {
    const selected = (sel as HTMLSelectElement).selectedOptions[0];
    const text = selected ? selected.textContent : '';
    const span = document.createElement('span');
    span.textContent = text || '';
    // Copy relevant classes for styling
    const cls = sel.className.replace(/print:hidden/g, '').replace(/cursor-pointer/g, '').replace(/focus:[^\s]+/g, '');
    span.className = cls;
    sel.replaceWith(span);
  });

  // Remove interactive and non-printable elements
  const removeSelectors = [
    'button', 'input', 'textarea', 'form',
    '[data-no-export]', '.fixed', '[aria-modal]',
    'script', 'style', 'nav',
  ];
  removeSelectors.forEach(sel => {
    clone.querySelectorAll(sel).forEach(el => el.remove());
  });

  // Essential CSS to preserve visual appearance (Tailwind utility classes used in reports)
  const essentialCss = `
    * { box-sizing: border-box; }
    .bg-blue-50 { background-color: #eff6ff; }
    .bg-green-50, .bg-emerald-50 { background-color: #ecfdf5; }
    .bg-red-50 { background-color: #fef2f2; }
    .bg-yellow-50, .bg-amber-50 { background-color: #fffbeb; }
    .bg-orange-50 { background-color: #fff7ed; }
    .bg-gray-50, .bg-neutral-50 { background-color: #f9fafb; }
    .bg-gray-100, .bg-neutral-100 { background-color: #f3f4f6; }
    .text-blue-600 { color: #2563eb; }
    .text-blue-700, .text-blue-800 { color: #1d4ed8; }
    .text-green-600, .text-green-700, .text-emerald-600, .text-emerald-700 { color: #059669; }
    .text-green-800, .text-emerald-800 { color: #065f46; }
    .text-red-600, .text-red-700 { color: #dc2626; }
    .text-red-800 { color: #991b1b; }
    .text-yellow-600, .text-amber-600 { color: #d97706; }
    .text-yellow-800, .text-amber-800 { color: #92400e; }
    .text-orange-600 { color: #ea580c; }
    .text-orange-800 { color: #9a3412; }
    .text-gray-500, .text-neutral-500 { color: #6b7280; }
    .text-gray-600, .text-neutral-600 { color: #4b5563; }
    .text-gray-700, .text-neutral-700 { color: #374151; }
    .text-gray-900, .text-neutral-900 { color: #111827; }
    .text-white { color: #ffffff; }
    .text-xs { font-size: 12px; }
    .text-sm { font-size: 14px; }
    .text-lg { font-size: 18px; }
    .text-xl { font-size: 20px; }
    .text-2xl { font-size: 24px; }
    .text-3xl { font-size: 30px; }
    .font-bold { font-weight: 700; }
    .font-medium { font-weight: 500; }
    .font-semibold { font-weight: 600; }
    .font-mono { font-family: monospace; }
    .italic { font-style: italic; }
    .uppercase { text-transform: uppercase; }
    .tracking-wider { letter-spacing: 0.05em; }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .border { border: 1px solid #e5e7eb; }
    .border-gray-200, .border-neutral-200 { border-color: #e5e7eb; }
    .border-gray-100 { border-color: #f3f4f6; }
    .border-blue-700 { border-color: #1d4ed8; }
    .border-b { border-bottom: 1px solid #e5e7eb; }
    .border-b-2 { border-bottom: 2px solid; }
    .border-t { border-top: 1px solid #e5e7eb; }
    .border-blue-600 { border-color: #2563eb; }
    .border-green-600 { border-color: #16a34a; }
    .rounded-lg { border-radius: 8px; }
    .rounded-xl { border-radius: 12px; }
    .rounded-full { border-radius: 9999px; }
    .flex { display: flex; }
    .grid { display: grid; }
    .grid-cols-2 { grid-template-columns: repeat(2, 1fr); }
    .grid-cols-4 { grid-template-columns: repeat(4, 1fr); }
    .gap-2 { gap: 8px; }
    .gap-4 { gap: 16px; }
    .gap-3 { gap: 12px; }
    .items-center { align-items: center; }
    .items-start { align-items: flex-start; }
    .justify-between { justify-content: space-between; }
    .justify-center { justify-content: center; }
    .p-3 { padding: 12px; }
    .p-4 { padding: 16px; }
    .p-8 { padding: 32px; }
    .px-4 { padding-left: 16px; padding-right: 16px; }
    .py-3 { padding-top: 12px; padding-bottom: 12px; }
    .py-2 { padding-top: 8px; padding-bottom: 8px; }
    .px-2 { padding-left: 8px; padding-right: 8px; }
    .py-1 { padding-top: 4px; padding-bottom: 4px; }
    .mb-1 { margin-bottom: 4px; }
    .mb-2 { margin-bottom: 8px; }
    .mb-3 { margin-bottom: 12px; }
    .mb-4 { margin-bottom: 16px; }
    .mb-6 { margin-bottom: 24px; }
    .mb-8 { margin-bottom: 32px; }
    .mt-1 { margin-top: 4px; }
    .mt-2 { margin-top: 8px; }
    .mt-3 { margin-top: 12px; }
    .mt-4 { margin-top: 16px; }
    .mt-8 { margin-top: 32px; }
    .pt-4 { padding-top: 16px; }
    .pt-6 { padding-top: 24px; }
    .pb-3 { padding-bottom: 12px; }
    .pb-6 { padding-bottom: 24px; }
    .space-y-4 > * + * { margin-top: 16px; }
    .space-y-6 > * + * { margin-top: 24px; }
    .shadow-sm { box-shadow: 0 1px 2px 0 rgba(0,0,0,0.05); }
    .whitespace-pre-line { white-space: pre-line; }
    .object-contain { object-fit: contain; }
    .max-h-14 { max-height: 56px; }
    .max-h-20 { max-height: 80px; }
    .max-w-\\[200px\\] { max-width: 200px; }
    .max-w-\\[160px\\] { max-width: 160px; }
    .mx-auto { margin-left: auto; margin-right: auto; }
    .inline-flex { display: inline-flex; }
    .inline-block { display: inline-block; }
    .hidden { display: none; }
    img { max-width: 100%; }
    h1 { font-size: 24px; font-weight: 700; }
    h2 { font-size: 20px; font-weight: 700; }
    h3 { font-size: 16px; font-weight: 600; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 6px 8px; border: 1px solid #e5e7f0; text-align: left; }
    th { background: #f1f5f9; font-weight: 600; }
  `;

  return `<div style="font-family:Arial,sans-serif;font-size:12px;color:#1e293b;"><style>${essentialCss}</style>${clone.innerHTML}</div>`;
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
