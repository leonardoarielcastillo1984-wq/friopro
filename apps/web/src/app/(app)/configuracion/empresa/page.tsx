'use client';

import { useEffect, useState, useRef } from 'react';
import { apiFetch } from '@/lib/api';
import { Upload, Building2, Palette, FileText, Save, ImageIcon, X } from 'lucide-react';

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
  const [previewLogo, setPreviewLogo] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        body: JSON.stringify({
          imageBase64: base64Image,
          type: 'light',
        }),
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
    </div>
  );
}
