'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import {
  FileText, Plus, Edit3, Trash2, Save, X, LayoutTemplate,
  Eye, Check, Star,
} from 'lucide-react';

interface Template {
  id: string;
  name: string;
  description?: string;
  headerLogoUrl?: string;
  companyName?: string;
  commercialName?: string;
  companyAddress?: string;
  companyCuit?: string;
  companySite?: string;
  footerText?: string;
  footerLegalText?: string;
  footerShowPageNum: boolean;
  footerShowDate: boolean;
  footerShowUser: boolean;
  footerShowQR: boolean;
  footerShowStatus: boolean;
  pageSize: string;
  orientation: string;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
  fontSize: number;
  showCoverPage: boolean;
  showTableOfContents: boolean;
  watermarkText?: string;
  watermarkOpacity: number;
  showSignatures: boolean;
  signatureStyle: string;
  active: boolean;
  isDefault: boolean;
  createdAt: string;
}

const EMPTY_TEMPLATE: Partial<Template> = {
  name: '',
  description: '',
  companyName: '',
  commercialName: '',
  companyAddress: '',
  companyCuit: '',
  companySite: '',
  footerText: '',
  footerLegalText: '',
  footerShowPageNum: true,
  footerShowDate: true,
  footerShowUser: true,
  footerShowQR: true,
  footerShowStatus: true,
  pageSize: 'A4',
  orientation: 'portrait',
  marginTop: 25,
  marginBottom: 25,
  marginLeft: 20,
  marginRight: 20,
  primaryColor: '#1e40af',
  secondaryColor: '#64748b',
  fontFamily: 'Arial, sans-serif',
  fontSize: 11,
  showCoverPage: false,
  showTableOfContents: false,
  watermarkOpacity: 0.1,
  showSignatures: true,
  signatureStyle: 'table',
  isDefault: false,
};

export default function PlantillasExport() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<Template> | null>(null);
  const [isNew, setIsNew] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<Template[]>('/doc-export/templates');
      setTemplates(data);
    } catch (e: any) {
      setError(e.message || 'Error al cargar plantillas');
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function save() {
    if (!editing) return;
    setError(null);
    setSuccess(null);
    try {
      if (isNew) {
        await apiFetch('/doc-export/templates', { method: 'POST', json: editing });
        setSuccess('Plantilla creada');
      } else {
        await apiFetch(`/doc-export/templates/${editing.id}`, { method: 'PUT', json: editing });
        setSuccess('Plantilla actualizada');
      }
      setEditing(null);
      setIsNew(false);
      load();
    } catch (e: any) {
      setError(e.message || 'Error al guardar');
    }
  }

  async function remove(id: string) {
    if (!confirm('¿Eliminar esta plantilla?')) return;
    try {
      await apiFetch(`/doc-export/templates/${id}`, { method: 'DELETE' });
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  if (loading) return <div className="p-8 text-center text-neutral-400">Cargando plantillas...</div>;

  return (
    <div className="space-y-4">
      {error && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">{success}</div>}

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-neutral-800">Plantillas de Membrete Institucional</h2>
        <button
          onClick={() => { setEditing({ ...EMPTY_TEMPLATE }); setIsNew(true); }}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" /> Nueva Plantilla
        </button>
      </div>

      {editing && (
        <div className="rounded-xl border border-neutral-200 bg-white p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-neutral-800">{isNew ? 'Nueva Plantilla' : 'Editar Plantilla'}</h3>
            <button onClick={() => { setEditing(null); setIsNew(false); }} className="text-neutral-400 hover:text-neutral-600">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Nombre *</label>
              <input
                value={editing.name || ''}
                onChange={e => setEditing({ ...editing, name: e.target.value })}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                placeholder="Ej: Membrete Corporativo DADA"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Nombre Comercial</label>
              <input
                value={editing.commercialName || ''}
                onChange={e => setEditing({ ...editing, commercialName: e.target.value })}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Razón Social</label>
              <input
                value={editing.companyName || ''}
                onChange={e => setEditing({ ...editing, companyName: e.target.value })}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">CUIT</label>
              <input
                value={editing.companyCuit || ''}
                onChange={e => setEditing({ ...editing, companyCuit: e.target.value })}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                placeholder="30-12345678-9"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">URL Logo Principal</label>
              <input
                value={editing.headerLogoUrl || ''}
                onChange={e => setEditing({ ...editing, headerLogoUrl: e.target.value })}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                placeholder="https://..."
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">URL Logo Secundario</label>
              <input
                value={editing.headerLogoSecondaryUrl || ''}
                onChange={e => setEditing({ ...editing, headerLogoSecondaryUrl: e.target.value })}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                placeholder="https://..."
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-neutral-600 mb-1">Dirección</label>
              <input
                value={editing.companyAddress || ''}
                onChange={e => setEditing({ ...editing, companyAddress: e.target.value })}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Sitio Web</label>
              <input
                value={editing.companySite || ''}
                onChange={e => setEditing({ ...editing, companySite: e.target.value })}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                placeholder="www.empresa.com"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Color Primario</label>
              <input
                type="color"
                value={editing.primaryColor || '#1e40af'}
                onChange={e => setEditing({ ...editing, primaryColor: e.target.value })}
                className="w-full h-10 rounded-lg border border-neutral-300"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Color Secundario</label>
              <input
                type="color"
                value={editing.secondaryColor || '#64748b'}
                onChange={e => setEditing({ ...editing, secondaryColor: e.target.value })}
                className="w-full h-10 rounded-lg border border-neutral-300"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Tamaño de Página</label>
              <select
                value={editing.pageSize || 'A4'}
                onChange={e => setEditing({ ...editing, pageSize: e.target.value })}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              >
                <option value="A4">A4</option>
                <option value="A3">A3</option>
                <option value="Letter">Letter</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Orientación</label>
              <select
                value={editing.orientation || 'portrait'}
                onChange={e => setEditing({ ...editing, orientation: e.target.value })}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              >
                <option value="portrait">Vertical</option>
                <option value="landscape">Horizontal</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Tamaño Fuente (px)</label>
              <input
                type="number"
                value={editing.fontSize || 11}
                onChange={e => setEditing({ ...editing, fontSize: parseInt(e.target.value) })}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Estilo de Firmas</label>
              <select
                value={editing.signatureStyle || 'table'}
                onChange={e => setEditing({ ...editing, signatureStyle: e.target.value })}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              >
                <option value="table">Tabla (Elaboró/Revisó/Aprobó)</option>
                <option value="names_only">Solo nombres</option>
                <option value="qr_only">Solo QR</option>
                <option value="none">Sin firmas</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-neutral-600 mb-1">Texto Legal del Pie</label>
              <input
                value={editing.footerLegalText || ''}
                onChange={e => setEditing({ ...editing, footerLegalText: e.target.value })}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                placeholder="Documento controlado por el Sistema de Gestión..."
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-neutral-600 mb-1">Texto Marca de Agua</label>
              <input
                value={editing.watermarkText || ''}
                onChange={e => setEditing({ ...editing, watermarkText: e.target.value })}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                placeholder="Dejar vacío para sin marca de agua"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            {[
              { key: 'footerShowPageNum', label: 'Nº de página' },
              { key: 'footerShowDate', label: 'Fecha exportación' },
              { key: 'footerShowUser', label: 'Usuario' },
              { key: 'footerShowQR', label: 'QR validación' },
              { key: 'footerShowStatus', label: 'Estado controlada/no controlada' },
              { key: 'showCoverPage', label: 'Portada' },
              { key: 'showTableOfContents', label: 'Índice' },
              { key: 'showSignatures', label: 'Firmas' },
              { key: 'isDefault', label: 'Plantilla por defecto' },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 text-sm text-neutral-700">
                <input
                  type="checkbox"
                  checked={(editing as any)[key] || false}
                  onChange={e => setEditing({ ...editing, [key]: e.target.checked })}
                  className="rounded border-neutral-300"
                />
                {label}
              </label>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => { setEditing(null); setIsNew(false); }}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50"
            >
              Cancelar
            </button>
            <button
              onClick={save}
              className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              <Save className="h-4 w-4" /> Guardar
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {templates.map(t => (
          <div key={t.id} className={`rounded-xl border bg-white p-4 shadow-sm ${t.isDefault ? 'border-brand-300 ring-1 ring-brand-200' : 'border-neutral-200'}`}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <LayoutTemplate className="h-5 w-5 text-brand-600" />
                <div>
                  <h3 className="font-semibold text-sm text-neutral-800">{t.name}</h3>
                  {t.isDefault && (
                    <span className="inline-flex items-center gap-1 text-xs text-brand-600 font-medium">
                      <Star className="h-3 w-3" /> Por defecto
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => { setEditing(t); setIsNew(false); }} className="text-neutral-400 hover:text-brand-600">
                  <Edit3 className="h-4 w-4" />
                </button>
                <button onClick={() => remove(t.id)} className="text-neutral-400 hover:text-red-600">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            {t.description && <p className="mt-2 text-xs text-neutral-500">{t.description}</p>}
            <div className="mt-3 space-y-1 text-xs text-neutral-500">
              {t.companyName && <div><strong>Empresa:</strong> {t.companyName}</div>}
              <div><strong>Página:</strong> {t.pageSize} {t.orientation === 'landscape' ? 'horizontal' : 'vertical'}</div>
              <div className="flex items-center gap-2">
                <strong>Color:</strong>
                <span className="inline-block h-4 w-4 rounded" style={{ background: t.primaryColor }} />
                <span className="inline-block h-4 w-4 rounded" style={{ background: t.secondaryColor }} />
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {t.footerShowQR && <span className="rounded bg-blue-50 px-1.5 py-0.5 text-blue-600">QR</span>}
                {t.showSignatures && <span className="rounded bg-blue-50 px-1.5 py-0.5 text-blue-600">Firmas</span>}
                {t.showCoverPage && <span className="rounded bg-blue-50 px-1.5 py-0.5 text-blue-600">Portada</span>}
                {t.watermarkText && <span className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-600">Marca agua</span>}
              </div>
            </div>
          </div>
        ))}
        {templates.length === 0 && !editing && (
          <div className="col-span-full text-center py-12 text-neutral-400">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No hay plantillas creadas. Creá la primera con "Nueva Plantilla".</p>
          </div>
        )}
      </div>
    </div>
  );
}
