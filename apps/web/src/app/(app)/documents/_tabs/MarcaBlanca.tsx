'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Palette, Save, Building2, Image, Type } from 'lucide-react';

interface WhitelabelConfig {
  companyName: string;
  logoUrl: string;
  headerColor: string;
  footerColor: string;
  watermark: string;
  footerText: string;
  pageSize: string;
  orientation: string;
}

export default function MarcaBlanca() {
  const [config, setConfig] = useState<WhitelabelConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<WhitelabelConfig>('/doc-export/whitelabel')
      .then(c => setConfig(c))
      .catch(() => setError('No hay plantilla por defecto. Cree una desde la pestaña Plantillas.'))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    if (!config) return;
    setSaving(true);
    try {
      await apiFetch('/doc-export/whitelabel', { method: 'PUT', json: config });
      setSuccess('Configuración guardada');
    } catch (e: any) { setError(e.message); }
    setSaving(false);
  }

  if (loading) return <div className="p-8 text-center text-neutral-400">Cargando...</div>;

  return (
    <div className="space-y-4">
      {error && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">{success}</div>}

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-neutral-800 flex items-center gap-2">
          <Palette className="h-5 w-5 text-brand-600" /> Configuración de Marca Blanca
        </h2>
        {config && (
          <button onClick={save} disabled={saving} className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
            <Save className="h-4 w-4" /> {saving ? 'Guardando...' : 'Guardar'}
          </button>
        )}
      </div>

      {config && (
        <div className="rounded-xl border border-neutral-200 bg-white p-6 space-y-4 shadow-sm">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1 flex items-center gap-1"><Building2 className="h-3 w-3" /> Nombre empresa</label>
              <input value={config.companyName} onChange={e => setConfig({ ...config, companyName: e.target.value })} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1 flex items-center gap-1"><Image className="h-3 w-3" /> URL Logo</label>
              <input value={config.logoUrl || ''} onChange={e => setConfig({ ...config, logoUrl: e.target.value })} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" placeholder="https://..." />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Color Header</label>
              <div className="flex items-center gap-2">
                <input type="color" value={config.headerColor || '#1e40af'} onChange={e => setConfig({ ...config, headerColor: e.target.value })} className="h-9 w-12 rounded border border-neutral-300" />
                <input value={config.headerColor || ''} onChange={e => setConfig({ ...config, headerColor: e.target.value })} className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-mono" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Color Footer</label>
              <div className="flex items-center gap-2">
                <input type="color" value={config.footerColor || '#64748b'} onChange={e => setConfig({ ...config, footerColor: e.target.value })} className="h-9 w-12 rounded border border-neutral-300" />
                <input value={config.footerColor || ''} onChange={e => setConfig({ ...config, footerColor: e.target.value })} className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-mono" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1 flex items-center gap-1"><Type className="h-3 w-3" /> Watermark</label>
              <input value={config.watermark || ''} onChange={e => setConfig({ ...config, watermark: e.target.value })} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" placeholder="Copia No Controlada" />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Texto Footer</label>
              <input value={config.footerText || ''} onChange={e => setConfig({ ...config, footerText: e.target.value })} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Tamaño página</label>
              <select value={config.pageSize || 'A4'} onChange={e => setConfig({ ...config, pageSize: e.target.value })} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm">
                <option value="A4">A4</option>
                <option value="Letter">Letter</option>
                <option value="Legal">Legal</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Orientación</label>
              <select value={config.orientation || 'portrait'} onChange={e => setConfig({ ...config, orientation: e.target.value })} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm">
                <option value="portrait">Vertical</option>
                <option value="landscape">Horizontal</option>
              </select>
            </div>
          </div>

          <div className="rounded-lg border border-neutral-200 p-4 bg-neutral-50">
            <p className="text-xs font-medium text-neutral-600 mb-2">Vista previa</p>
            <div className="rounded-lg bg-white p-4 shadow-sm" style={{ borderTop: `4px solid ${config.headerColor}` }}>
              {config.logoUrl && <img src={config.logoUrl} alt="logo" className="h-8 mb-2" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
              <p className="font-semibold text-sm" style={{ color: config.headerColor }}>{config.companyName}</p>
              <div className="mt-2 h-16 flex items-center justify-center text-xs text-neutral-300 border border-dashed border-neutral-200 rounded">
                {config.watermark || 'Sin watermark'}
              </div>
              <p className="text-[10px] text-center mt-2" style={{ color: config.footerColor }}>{config.footerText || 'Pie de página'}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
