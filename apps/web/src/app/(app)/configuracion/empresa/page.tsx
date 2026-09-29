'use client';

import { useEffect, useState, useRef } from 'react';
import { apiFetch } from '@/lib/api';
import { Upload, Building2, Palette, FileText, Save, ImageIcon, X, Download, Archive, Globe, Plus, Copy, Pencil, Check, Loader2 } from 'lucide-react';
import { COUNTRIES } from '@/lib/countries';

type CompanySettings = {
  companyName: string;
  legalName?: string;
  taxId?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  logoUrl?: string;
  logoDarkUrl?: string;
  primaryColor?: string;
  headerText?: string;
  footerText?: string;
};

export default function CompanySettingsPage() {
  const [settings, setSettings] = useState<CompanySettings>({
    companyName: '',
    primaryColor: '#2563eb',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [downloadingBackup, setDownloadingBackup] = useState(false);
  const [previewLogo, setPreviewLogo] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function downloadBackup() {
    try {
      setDownloadingBackup(true);
      const token = localStorage.getItem('accessToken');
      const tenantId = localStorage.getItem('tenantId');
      const res = await fetch('/api/company/document-backup', {
        headers: {
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          ...(tenantId ? { 'x-tenant-id': tenantId } : {}),
        },
        credentials: 'include',
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        alert(d?.error || 'No se pudo generar el backup');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.headers.get('Content-Disposition')?.match(/filename="?([^";]+)"?/)?.[1] || 'backup-documental.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading backup:', err);
      alert('Error al descargar el backup');
    } finally {
      setDownloadingBackup(false);
    }
  }

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      setLoading(true);
      const res = await apiFetch('/company/settings') as { settings: CompanySettings | null };
      if (res.settings) {
        setSettings(res.settings);
        setPreviewLogo(res.settings.logoUrl || null);
      }
    } catch (err) {
      console.error('Error loading settings:', err);
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await apiFetch('/company/settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      }) as { settings: CompanySettings };

      if (res.settings) {
        setSettings(res.settings);
        alert('Configuración guardada correctamente');
      }
    } catch (err) {
      console.error('Error saving settings:', err);
      alert('Error al guardar configuración');
    } finally {
      setSaving(false);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona una imagen');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert('La imagen no debe superar 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setPreviewLogo(base64);
      uploadLogo(base64);
    };
    reader.readAsDataURL(file);
  }

  async function uploadLogo(base64Image: string) {
    try {
      setUploading(true);
      const res = await apiFetch('/company/logo', {
        method: 'POST',
        json: {
          imageBase64: base64Image,
          type: 'light',
        },
      }) as { success: boolean; logoUrl: string };

      if (res.success) {
        setSettings({ ...settings, logoUrl: res.logoUrl });
        alert('Logo subido correctamente');
      }
    } catch (err) {
      console.error('Error uploading logo:', err);
      alert('Error al subir logo');
    } finally {
      setUploading(false);
    }
  }

  function removeLogo() {
    setPreviewLogo(null);
    setSettings({ ...settings, logoUrl: undefined });
  }

  const PRESET_COLORS = [
    '#2563eb', // Blue
    '#16a34a', // Green
    '#dc2626', // Red
    '#ea580c', // Orange
    '#9333ea', // Purple
    '#0891b2', // Cyan
    '#4f46e5', // Indigo
    '#c026d3', // Fuchsia
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Building2 className="w-8 h-8 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configuración de Empresa</h1>
          <p className="text-gray-500">Personaliza el logo y datos de tu empresa</p>
        </div>
      </div>

      <form onSubmit={saveSettings} className="space-y-6">
        {/* Logo Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <ImageIcon className="w-5 h-5" />
            Logo de Empresa
          </h2>
          
          <div className="flex items-start gap-6">
            {/* Preview */}
            <div className="flex-shrink-0">
              <div className="w-48 h-32 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden">
                {previewLogo ? (
                  <img 
                    src={previewLogo} 
                    alt="Logo preview" 
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <div className="text-center text-gray-400">
                    <ImageIcon className="w-8 h-8 mx-auto mb-1" />
                    <span className="text-sm">Sin logo</span>
                  </div>
                )}
              </div>
            </div>

            {/* Upload Controls */}
            <div className="flex-1 space-y-3">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept="image/*"
                className="hidden"
              />
              
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {uploading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      Subiendo...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Subir Logo
                    </>
                  )}
                </button>
                
                {previewLogo && (
                  <button
                    type="button"
                    onClick={removeLogo}
                    className="inline-flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                    Eliminar
                  </button>
                )}
              </div>

              <p className="text-sm text-gray-500">
                Formatos: PNG, JPG, SVG. Tamaño máximo: 2MB. <br />
                Se recomienda fondo transparente para mejor visualización.
              </p>
            </div>
          </div>
        </div>

        {/* Company Info */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Información de la Empresa
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre de la Empresa <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={settings.companyName}
                onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Razón Social
              </label>
              <input
                type="text"
                value={settings.legalName || ''}
                onChange={(e) => setSettings({ ...settings, legalName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                RUT / Tax ID
              </label>
              <input
                type="text"
                value={settings.taxId || ''}
                onChange={(e) => setSettings({ ...settings, taxId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={settings.email || ''}
                onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Teléfono
              </label>
              <input
                type="tel"
                value={settings.phone || ''}
                onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sitio Web
              </label>
              <input
                type="url"
                value={settings.website || ''}
                onChange={(e) => setSettings({ ...settings, website: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://www.tuempresa.com"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dirección
              </label>
              <input
                type="text"
                value={settings.address || ''}
                onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Branding */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Palette className="w-5 h-5" />
            Personalización
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Color Principal de la Marca
              </label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setSettings({ ...settings, primaryColor: color })}
                    className={`w-10 h-10 rounded-lg border-2 transition-all ${
                      settings.primaryColor === color 
                        ? 'border-gray-900 scale-110' 
                        : 'border-transparent hover:scale-105'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
                <input
                  type="color"
                  value={settings.primaryColor}
                  onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                  className="w-10 h-10 rounded-lg cursor-pointer"
                />
              </div>
              <p className="text-sm text-gray-500 mt-2">
                Color seleccionado: {settings.primaryColor}
              </p>
            </div>
          </div>
        </div>

        {/* Report Settings */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Configuración de Reportes
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Texto de Encabezado (aparece en todos los reportes)
              </label>
              <textarea
                value={settings.headerText || ''}
                onChange={(e) => setSettings({ ...settings, headerText: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
                placeholder="Texto que aparecerá en el encabezado de todos los reportes..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Texto de Pie de Página
              </label>
              <textarea
                value={settings.footerText || ''}
                onChange={(e) => setSettings({ ...settings, footerText: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
                placeholder="Texto que aparecerá en el pie de página de todos los reportes..."
              />
            </div>
          </div>
        </div>

        {/* Backup documental */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
            <Archive className="w-5 h-5" />
            Backup documental
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Descargá todos los documentos cargados por la empresa en un único ZIP, organizado en carpetas por módulo (SGI, Flota 360, Calidad, Mantenimiento, Minutas, Proyectos, Clima, Clientes, RRHH).
          </p>
          <button
            type="button"
            onClick={downloadBackup}
            disabled={downloadingBackup}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            {downloadingBackup ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                Generando ZIP…
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Descargar backup documental
              </>
            )}
          </button>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Guardar Configuración
              </>
            )}
          </button>
        </div>
      </form>

      {/* Sistemas de gestión por país (fuera del form: acciones independientes) */}
      <WorkspacesSection />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Workspaces multi-país: Dada Argentina / Dada Chile / etc.
// Lista los workspaces del grupo, permite agregar un país y clonar estructura.
// ─────────────────────────────────────────────────────────────────────────────
type Workspace = {
  tenantId: string;
  name: string;
  slug: string;
  country: string | null;
  isRoot: boolean;
  isCurrent: boolean;
  logoUrl: string | null;
  memberCount: number;
  myRole: string | null;
};

const CLONE_SECTIONS = [
  { key: 'areas', label: 'Áreas / Departamentos' },
  { key: 'documentTypes', label: 'Tipos y codificación de documentos' },
  { key: 'processes', label: 'Mapa y procesos' },
  { key: 'normatives', label: 'Normativos (metadatos + cláusulas)' },
] as const;

function WorkspacesSection() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // agregar país
  const [showAdd, setShowAdd] = useState(false);
  const [newCountry, setNewCountry] = useState('');
  const [newName, setNewName] = useState('');

  // editar raíz (nombre/país)
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCountry, setEditCountry] = useState('');

  // clonar estructura
  const [cloneTarget, setCloneTarget] = useState<string | null>(null);
  const [cloneSource, setCloneSource] = useState('');
  const [cloneSections, setCloneSections] = useState<string[]>(['areas', 'documentTypes', 'processes']);

  async function load() {
    try {
      const res = await apiFetch<{ workspaces: Workspace[] }>('/workspaces') as any;
      setWorkspaces(res.workspaces ?? []);
      setLoaded(true);
    } catch (e: any) {
      if (e?.status === 403 || String(e?.message ?? '').includes('403')) setForbidden(true);
      setLoaded(true);
    }
  }

  useEffect(() => { load(); }, []);

  const usedCountries = new Set(workspaces.map((w) => w.country).filter(Boolean));
  const availableCountries = Object.entries(COUNTRIES).filter(([code]) => !usedCountries.has(code));

  async function addCountry() {
    if (!newCountry) return;
    setBusy('add'); setError(null); setNotice(null);
    try {
      await apiFetch('/workspaces', {
        method: 'POST',
        json: { country: newCountry, name: newName.trim() || undefined, copyMembers: true },
      });
      setShowAdd(false); setNewCountry(''); setNewName('');
      setNotice('Workspace creado. Los usuarios del grupo ya pueden elegirlo al iniciar sesión.');
      await load();
    } catch (e: any) {
      setError(e?.message ?? 'Error al crear el workspace');
    } finally { setBusy(null); }
  }

  async function saveEdit(tenantId: string) {
    setBusy(`edit-${tenantId}`); setError(null);
    try {
      await apiFetch(`/workspaces/${tenantId}`, {
        method: 'PATCH',
        json: { name: editName.trim() || undefined, country: editCountry || null },
      });
      setEditing(null);
      await load();
    } catch (e: any) {
      setError(e?.message ?? 'Error al guardar');
    } finally { setBusy(null); }
  }

  async function doClone(targetId: string) {
    if (!cloneSource || cloneSections.length === 0) return;
    setBusy(`clone-${targetId}`); setError(null); setNotice(null);
    try {
      const res = await apiFetch(`/workspaces/${targetId}/clone-structure`, {
        method: 'POST',
        json: { sourceTenantId: cloneSource, sections: cloneSections },
      }) as any;
      const r = res?.result ?? {};
      setNotice(`Estructura clonada: ${r.areas ?? 0} áreas, ${r.documentTypes ?? 0} tipos de doc., ${r.processes ?? 0} procesos, ${r.normatives ?? 0} normativos.`);
      setCloneTarget(null);
    } catch (e: any) {
      setError(e?.message ?? 'Error al clonar');
    } finally { setBusy(null); }
  }

  function toggleSection(k: string) {
    setCloneSections((prev) => prev.includes(k) ? prev.filter((s) => s !== k) : [...prev, k]);
  }

  if (!loaded) return null;
  if (forbidden) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
        <Globe className="w-5 h-5" />
        Sistemas de gestión por país
      </h2>
      <p className="text-sm text-gray-500 mb-4">
        Si tu empresa opera en más de un país, cada país es un sistema de gestión independiente
        (empleados, documentos y datos propios) pero con el mismo equipo y plan.
        Al iniciar sesión, los usuarios eligen a cuál entrar.
      </p>

      {error && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {notice && <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</div>}

      <div className="space-y-2">
        {workspaces.map((w) => (
          <div key={w.tenantId} className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-50 border border-gray-100 overflow-hidden">
              {w.logoUrl
                ? <img src={w.logoUrl} alt="" className="max-h-7 max-w-[80%] object-contain" />
                : <Building2 className="w-5 h-5 text-gray-300" />}
            </div>
            <div className="flex-1 min-w-0">
              {editing === w.tenantId ? (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="px-2 py-1 border border-gray-300 rounded text-sm w-48"
                    placeholder="Nombre del workspace"
                  />
                  <select
                    value={editCountry}
                    onChange={(e) => setEditCountry(e.target.value)}
                    className="px-2 py-1 border border-gray-300 rounded text-sm"
                  >
                    <option value="">Sin país</option>
                    {Object.entries(COUNTRIES).map(([code, c]) => (
                      <option key={code} value={code} disabled={usedCountries.has(code) && w.country !== code}>
                        {c.flag} {c.name}
                      </option>
                    ))}
                  </select>
                  <button type="button" onClick={() => saveEdit(w.tenantId)} disabled={busy === `edit-${w.tenantId}`}
                    className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded" title="Guardar">
                    {busy === `edit-${w.tenantId}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  </button>
                  <button type="button" onClick={() => setEditing(null)} className="p-1.5 text-gray-400 hover:bg-gray-50 rounded" title="Cancelar">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                    {w.name}
                    {w.country && <span title={COUNTRIES[w.country]?.name}>{COUNTRIES[w.country]?.flag}</span>}
                    {w.isCurrent && <span className="text-[10px] font-medium bg-blue-50 text-blue-600 rounded-full px-2 py-0.5">Actual</span>}
                    {w.isRoot && <span className="text-[10px] font-medium bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">Principal</span>}
                  </p>
                  <p className="text-xs text-gray-400">{w.memberCount} usuarios{w.country ? ` · ${COUNTRIES[w.country]?.name ?? w.country}` : ''}</p>
                </>
              )}
            </div>
            {editing !== w.tenantId && (
              <div className="flex items-center gap-1">
                <button type="button" title="Editar nombre/país"
                  onClick={() => { setEditing(w.tenantId); setEditName(w.name); setEditCountry(w.country ?? ''); }}
                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                  <Pencil className="w-4 h-4" />
                </button>
                <button type="button" title="Clonar estructura hacia este workspace"
                  onClick={() => {
                    setCloneTarget(cloneTarget === w.tenantId ? null : w.tenantId);
                    setCloneSource(workspaces.find((x) => x.tenantId !== w.tenantId)?.tenantId ?? '');
                  }}
                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Panel de clonación */}
      {cloneTarget && (
        <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50/50 p-4">
          <p className="text-sm font-semibold text-gray-800 mb-2">
            Clonar estructura → {workspaces.find((w) => w.tenantId === cloneTarget)?.name}
          </p>
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <label className="text-xs text-gray-500">Desde:</label>
            <select value={cloneSource} onChange={(e) => setCloneSource(e.target.value)}
              className="px-2 py-1.5 border border-gray-300 rounded text-sm bg-white">
              <option value="">Elegir origen…</option>
              {workspaces.filter((w) => w.tenantId !== cloneTarget).map((w) => (
                <option key={w.tenantId} value={w.tenantId}>{w.name}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-3 mb-3">
            {CLONE_SECTIONS.map((s) => (
              <label key={s.key} className="flex items-center gap-1.5 text-sm text-gray-700">
                <input type="checkbox" checked={cloneSections.includes(s.key)} onChange={() => toggleSection(s.key)}
                  className="rounded border-gray-300" />
                {s.label}
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => doClone(cloneTarget)}
              disabled={!cloneSource || cloneSections.length === 0 || busy === `clone-${cloneTarget}`}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {busy === `clone-${cloneTarget}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
              Clonar
            </button>
            <button type="button" onClick={() => setCloneTarget(null)}
              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
              Cancelar
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">Solo copia lo que falta (no duplica elementos con el mismo nombre/código).</p>
        </div>
      )}

      {/* Agregar país */}
      {availableCountries.length > 0 && (
        <div className="mt-4">
          {!showAdd ? (
            <button type="button" onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-2 px-4 py-2 border border-dashed border-gray-300 text-gray-600 rounded-lg hover:border-blue-400 hover:text-blue-600 transition-colors">
              <Plus className="w-4 h-4" /> Agregar país
            </button>
          ) : (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">País</label>
                <select value={newCountry} onChange={(e) => setNewCountry(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
                  <option value="">Elegir país…</option>
                  {availableCountries.map(([code, c]) => (
                    <option key={code} value={code}>{c.flag} {c.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1 min-w-48">
                <label className="block text-xs text-gray-500 mb-1">Nombre (opcional)</label>
                <input value={newName} onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder={newCountry && workspaces[0] ? `${workspaces.find(w => w.isRoot)?.name?.split(' ')[0] ?? 'Empresa'} ${COUNTRIES[newCountry]?.name ?? ''}` : 'Ej: Dada Chile'} />
              </div>
              <button type="button" onClick={addCountry} disabled={!newCountry || busy === 'add'}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {busy === 'add' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Crear
              </button>
              <button type="button" onClick={() => setShowAdd(false)}
                className="px-3 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg">Cancelar</button>
              <p className="w-full text-xs text-gray-400">Se crea vacío y el equipo actual del grupo queda habilitado automáticamente.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
