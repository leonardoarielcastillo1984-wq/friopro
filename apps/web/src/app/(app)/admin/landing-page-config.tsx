'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Globe, Save, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

type LandingSettings = {
  phone: string;
  address: string;
  email: string;
  linkedin: string;
  twitter: string;
  facebook: string;
  clientLogos: string;
  integrations: string;
  missionText: string;
  objectiveText: string;
  visionText: string;
  stats: string;
};

export default function LandingPageConfig() {
  const [settings, setSettings] = useState<LandingSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await apiFetch('/landing/settings', { method: 'GET' });
      if (response.settings) {
        setSettings(response.settings);
      }
    } catch (error) {
      console.error('Error fetching landing settings:', error);
      setMessage({ type: 'error', text: 'Error al cargar configuración' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;

    setSaving(true);
    try {
      const response = await apiFetch('/landing/settings', {
        method: 'PUT',
        body: settings,
      });

      if (response.success) {
        setMessage({ type: 'success', text: 'Configuración guardada exitosamente' });
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (error) {
      console.error('Error saving landing settings:', error);
      setMessage({ type: 'error', text: 'Error al guardar configuración' });
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field: keyof LandingSettings, value: string) => {
    setSettings(prev => prev ? { ...prev, [field]: value } : null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!settings) return <div>Error al cargar configuración</div>;

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {message && (
        <div className={`p-4 rounded-lg flex items-center gap-2 ${
          message.type === 'success'
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
          {message.text}
        </div>
      )}

      {/* Contacto */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-neutral-900 mb-1">Teléfono</label>
          <input
            type="text"
            value={settings.phone}
            onChange={e => handleInputChange('phone', e.target.value)}
            className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="+56 2 1234 5678"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-900 mb-1">Email</label>
          <input
            type="email"
            value={settings.email}
            onChange={e => handleInputChange('email', e.target.value)}
            className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="support@sgi360.com"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-900 mb-1">Dirección</label>
        <input
          type="text"
          value={settings.address}
          onChange={e => handleInputChange('address', e.target.value)}
          className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Calle Principal 123, Santiago, Chile"
        />
      </div>

      {/* Redes Sociales */}
      <div className="space-y-3 p-4 bg-neutral-50 rounded-lg">
        <h3 className="font-medium text-neutral-900">Redes Sociales</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">LinkedIn</label>
            <input
              type="url"
              value={settings.linkedin}
              onChange={e => handleInputChange('linkedin', e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://linkedin.com/company/..."
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">Twitter</label>
            <input
              type="url"
              value={settings.twitter}
              onChange={e => handleInputChange('twitter', e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://twitter.com/..."
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">Facebook</label>
            <input
              type="url"
              value={settings.facebook}
              onChange={e => handleInputChange('facebook', e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://facebook.com/..."
            />
          </div>
        </div>
      </div>

      {/* Misión, Objetivo, Visión */}
      <div className="space-y-3">
        <h3 className="font-medium text-neutral-900">Misión, Objetivo y Visión</h3>
        <div>
          <label className="block text-xs font-medium text-neutral-700 mb-1">Misión</label>
          <textarea
            value={settings.missionText}
            onChange={e => handleInputChange('missionText', e.target.value)}
            className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={2}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-700 mb-1">Objetivo</label>
          <textarea
            value={settings.objectiveText}
            onChange={e => handleInputChange('objectiveText', e.target.value)}
            className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={2}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-700 mb-1">Visión</label>
          <textarea
            value={settings.visionText}
            onChange={e => handleInputChange('visionText', e.target.value)}
            className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={2}
          />
        </div>
      </div>

      {/* Logos y Integraciones */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-neutral-700 mb-1">Logos de Clientes (JSON)</label>
          <textarea
            value={settings.clientLogos}
            onChange={e => handleInputChange('clientLogos', e.target.value)}
            className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            rows={3}
            placeholder='["Acme Corp", "Global SA", ...]'
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-700 mb-1">Integraciones (JSON)</label>
          <textarea
            value={settings.integrations}
            onChange={e => handleInputChange('integrations', e.target.value)}
            className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            rows={3}
            placeholder='["Excel", "Google Sheets", ...]'
          />
        </div>
      </div>

      {/* Estadísticas */}
      <div>
        <label className="block text-sm font-medium text-neutral-900 mb-1">Estadísticas (JSON)</label>
        <textarea
          value={settings.stats}
          onChange={e => handleInputChange('stats', e.target.value)}
          className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
          rows={3}
          placeholder='{"companies": 500, "users": 1500, "experience": "15+", "uptime": "99.9%"}'
        />
      </div>

      {/* Botón Guardar */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'Guardando...' : 'Guardar Cambios'}
        </button>
      </div>
    </form>
  );
}
