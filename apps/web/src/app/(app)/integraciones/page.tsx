'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  Puzzle, CheckCircle2, Clock, Loader2, AlertCircle,
  Database, BarChart3, Cloud, Mail, MessageSquare,
  FileSpreadsheet, Zap, Plus, Trash2, Power, Send,
  X, ExternalLink, MoreVertical,
} from 'lucide-react';

type Webhook = {
  id: string;
  provider: string;
  name: string;
  url: string;
  isActive: boolean;
  events: string[];
  lastSentAt: string | null;
  lastError: string | null;
  totalSent: number;
  totalErrors: number;
  createdAt: string;
};

const NOTIFICATION_EVENTS = [
  { value: 'NCR_ASSIGNED', label: 'NCR Asignada' },
  { value: 'NCR_STATUS_CHANGED', label: 'NCR Cambio de Estado' },
  { value: 'NCR_OVERDUE', label: 'NCR Vencida' },
  { value: 'RISK_CRITICAL', label: 'Riesgo Crítico' },
  { value: 'AUDIT_COMPLETED', label: 'Auditoría Completada' },
  { value: 'AUDIT_FAILED', label: 'Auditoría Fallida' },
  { value: 'FINDING_NEW', label: 'Nuevo Hallazgo' },
  { value: 'TRAINING_SCHEDULED', label: 'Capacitación Programada' },
  { value: 'TRAINING_REMINDER', label: 'Recordatorio de Capacitación' },
  { value: 'MEMBER_INVITED', label: 'Miembro Invitado' },
  { value: 'SYSTEM_ALERT', label: 'Alerta del Sistema' },
];

const PROVIDERS = [
  { value: 'slack', label: 'Slack', icon: <MessageSquare className="h-5 w-5" />, color: 'purple', placeholder: 'https://hooks.slack.com/services/T.../B.../...' },
  { value: 'teams', label: 'Microsoft Teams', icon: <FileSpreadsheet className="h-5 w-5" />, color: 'indigo', placeholder: 'https://outlook.office.com/webhook/...' },
  { value: 'custom', label: 'Webhook Personalizado', icon: <Zap className="h-5 w-5" />, color: 'blue', placeholder: 'https://api.example.com/webhook' },
];

const FUTURE_INTEGRATIONS = [
  { id: 'sap', name: 'SAP ERP', description: 'Sincronización con sistemas ERP', icon: <Database className="h-6 w-6" />, color: 'blue' },
  { id: 'powerbi', name: 'Power BI', description: 'Dashboards avanzados', icon: <BarChart3 className="h-6 w-6" />, color: 'amber' },
  { id: 'google', name: 'Google Workspace', description: 'Drive, Sheets y documentos', icon: <Cloud className="h-6 w-6" />, color: 'green' },
  { id: 'email', name: 'Email & SMTP', description: 'Notificaciones por correo', icon: <Mail className="h-6 w-6" />, color: 'rose' },
];

const COLOR_MAP: Record<string, { bg: string; text: string }> = {
  blue: { bg: 'bg-blue-50', text: 'text-blue-600' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-600' },
  green: { bg: 'bg-green-50', text: 'text-green-600' },
  indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-600' },
  rose: { bg: 'bg-rose-50', text: 'text-rose-600' },
};

export default function IntegracionesPage() {
  const { tenantRole } = useAuth();
  const isAdmin = tenantRole === 'TENANT_ADMIN';

  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [formProvider, setFormProvider] = useState('slack');
  const [formName, setFormName] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formEvents, setFormEvents] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  // Testing
  const [testingId, setTestingId] = useState<string | null>(null);

  // Action menu
  const [menuId, setMenuId] = useState<string | null>(null);

  async function loadWebhooks() {
    try {
      const res = await apiFetch<{ webhooks: Webhook[] }>('/integrations/webhooks');
      setWebhooks(res?.webhooks ?? []);
      setError('');
    } catch {
      setWebhooks([]);
      setError('');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadWebhooks(); }, []);

  function showSuccessMsg(msg: string) {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3000);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setCreating(true);
    try {
      await apiFetch('/integrations/webhooks', {
        method: 'POST',
        json: { provider: formProvider, name: formName, url: formUrl, events: formEvents },
      });
      setShowCreate(false);
      setFormName('');
      setFormUrl('');
      setFormEvents([]);
      showSuccessMsg('Webhook creado correctamente');
      loadWebhooks();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleTest(id: string) {
    setTestingId(id);
    setError('');
    try {
      const res = await apiFetch<{ ok: boolean; message?: string }>(`/integrations/webhooks/${id}/test`, { method: 'POST', json: {} });
      showSuccessMsg(res.message || 'Prueba enviada');
      loadWebhooks();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setTestingId(null);
    }
  }

  async function handleToggle(id: string, isActive: boolean) {
    setError('');
    try {
      await apiFetch(`/integrations/webhooks/${id}`, {
        method: 'PATCH',
        json: { isActive: !isActive },
      });
      showSuccessMsg(isActive ? 'Webhook desactivado' : 'Webhook activado');
      setMenuId(null);
      loadWebhooks();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Estás seguro de eliminar este webhook?')) return;
    setError('');
    try {
      await apiFetch(`/integrations/webhooks/${id}`, { method: 'DELETE' });
      showSuccessMsg('Webhook eliminado');
      setMenuId(null);
      loadWebhooks();
    } catch (e: any) {
      setError(e.message);
    }
  }

  function toggleEvent(value: string) {
    setFormEvents(prev =>
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    );
  }

  const providerInfo = PROVIDERS.find(p => p.value === formProvider)!;
  const activeWebhooks = webhooks.filter(w => w.isActive);

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Integraciones</h1>
        <p className="text-neutral-500 mt-1">Conectores con sistemas externos y notificaciones automáticas</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" /> {error}
          <button onClick={() => setError('')} className="ml-auto"><X className="h-4 w-4" /></button>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl p-3 text-green-700 text-sm">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" /> {success}
        </div>
      )}

      {/* KPI Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-neutral-200 p-4">
          <div className="flex items-center gap-2 mb-1"><Puzzle className="h-5 w-5 text-blue-600" /><span className="text-xs text-neutral-500">Total Webhooks</span></div>
          <div className="text-2xl font-bold text-neutral-900">{webhooks.length}</div>
          <div className="text-xs text-neutral-400">Configurados</div>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 p-4">
          <div className="flex items-center gap-2 mb-1"><CheckCircle2 className="h-5 w-5 text-green-600" /><span className="text-xs text-neutral-500">Activos</span></div>
          <div className="text-2xl font-bold text-neutral-900">{activeWebhooks.length}</div>
          <div className="text-xs text-neutral-400">Enviando notificaciones</div>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 p-4">
          <div className="flex items-center gap-2 mb-1"><Send className="h-5 w-5 text-brand-600" /><span className="text-xs text-neutral-500">Enviados</span></div>
          <div className="text-2xl font-bold text-neutral-900">{webhooks.reduce((s, w) => s + w.totalSent, 0)}</div>
          <div className="text-xs text-neutral-400">Total mensajes</div>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 p-4">
          <div className="flex items-center gap-2 mb-1"><Clock className="h-5 w-5 text-amber-600" /><span className="text-xs text-neutral-500">Próximas</span></div>
          <div className="text-2xl font-bold text-neutral-900">{FUTURE_INTEGRATIONS.length}</div>
          <div className="text-xs text-neutral-400">En roadmap</div>
        </div>
      </div>

      {/* ═══════════════ WEBHOOKS ═══════════════ */}
      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-neutral-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-neutral-600" />
            <h2 className="font-semibold text-neutral-900">Webhooks Activos</h2>
            <span className="text-xs bg-neutral-100 text-neutral-500 px-2 py-0.5 rounded-full">{webhooks.length}</span>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
            >
              <Plus className="h-4 w-4" /> Nuevo Webhook
            </button>
          )}
        </div>

        {/* Create Form */}
        {showCreate && (
          <div className="border-b border-neutral-200 bg-neutral-50/50 p-5">
            <form onSubmit={handleCreate} className="space-y-4 max-w-xl">
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1.5">Plataforma</label>
                <div className="flex gap-2">
                  {PROVIDERS.map(p => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setFormProvider(p.value)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                        formProvider === p.value
                          ? 'border-brand-500 bg-brand-50 text-brand-700'
                          : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'
                      }`}
                    >
                      {p.icon} {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Nombre</label>
                <input
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder={`Ej: ${formProvider === 'slack' ? '#sgi-alertas' : formProvider === 'teams' ? 'Canal de Calidad' : 'Mi webhook'}`}
                  required
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">URL del Webhook</label>
                <input
                  value={formUrl}
                  onChange={e => setFormUrl(e.target.value)}
                  placeholder={providerInfo.placeholder}
                  required
                  type="url"
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-mono text-xs focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1.5">Eventos (dejar vacío para recibir todos)</label>
                <div className="flex flex-wrap gap-1.5">
                  {NOTIFICATION_EVENTS.map(ev => (
                    <button
                      key={ev.value}
                      type="button"
                      onClick={() => toggleEvent(ev.value)}
                      className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                        formEvents.includes(ev.value)
                          ? 'bg-brand-100 text-brand-700 border border-brand-300'
                          : 'bg-neutral-100 text-neutral-500 border border-transparent hover:bg-neutral-200'
                      }`}
                    >
                      {ev.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  disabled={creating || !formName || !formUrl}
                  className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:bg-neutral-300 transition-colors"
                >
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Crear Webhook
                </button>
                <button
                  type="button"
                  onClick={() => { setShowCreate(false); setFormName(''); setFormUrl(''); setFormEvents([]); }}
                  className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-50 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Webhook List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
          </div>
        ) : webhooks.length === 0 ? (
          <div className="py-12 text-center">
            <Zap className="h-10 w-10 text-neutral-200 mx-auto mb-3" />
            <p className="text-neutral-500">No hay webhooks configurados</p>
            <p className="text-xs text-neutral-400 mt-1">Creá un webhook para recibir notificaciones en Slack, Teams u otro servicio</p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {webhooks.map(wh => {
              const prov = PROVIDERS.find(p => p.value === wh.provider);
              const c = COLOR_MAP[prov?.color || 'blue'];
              return (
                <div key={wh.id} className="p-4 flex items-center gap-4 hover:bg-neutral-50/50 transition-colors">
                  <div className={`p-2.5 rounded-lg ${c.bg}`}>
                    <span className={c.text}>{prov?.icon || <Zap className="h-5 w-5" />}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-neutral-900 text-sm">{wh.name}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                        wh.isActive ? 'bg-green-100 text-green-700' : 'bg-neutral-100 text-neutral-400'
                      }`}>
                        {wh.isActive ? 'Activo' : 'Inactivo'}
                      </span>
                      {wh.lastError && (
                        <span className="text-xs text-red-500" title={wh.lastError}>Error reciente</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-neutral-400 truncate max-w-xs font-mono">{wh.url.replace(/https?:\/\//, '').slice(0, 40)}…</span>
                      <span className="text-xs text-neutral-400">{wh.totalSent} enviados</span>
                      {wh.lastSentAt && (
                        <span className="text-xs text-neutral-400">
                          Último: {new Date(wh.lastSentAt).toLocaleDateString('es-AR')}
                        </span>
                      )}
                    </div>
                    {wh.events.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {wh.events.slice(0, 4).map(ev => (
                          <span key={ev} className="text-[10px] bg-neutral-100 text-neutral-500 px-1.5 py-0.5 rounded">
                            {NOTIFICATION_EVENTS.find(e => e.value === ev)?.label || ev}
                          </span>
                        ))}
                        {wh.events.length > 4 && (
                          <span className="text-[10px] text-neutral-400">+{wh.events.length - 4} más</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleTest(wh.id)}
                      disabled={testingId === wh.id}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-neutral-200 bg-white text-xs font-medium text-neutral-600 hover:bg-neutral-50 disabled:opacity-50 transition-colors"
                    >
                      {testingId === wh.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                      Probar
                    </button>
                    {isAdmin && (
                      <div className="relative">
                        <button
                          onClick={() => setMenuId(menuId === wh.id ? null : wh.id)}
                          className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 transition-colors"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                        {menuId === wh.id && (
                          <div className="absolute right-0 top-8 z-10 w-44 rounded-xl border border-neutral-200 bg-white py-1 shadow-lg">
                            <button
                              onClick={() => handleToggle(wh.id, wh.isActive)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
                            >
                              <Power className="h-4 w-4" />
                              {wh.isActive ? 'Desactivar' : 'Activar'}
                            </button>
                            <div className="border-t border-neutral-100 my-1" />
                            <button
                              onClick={() => handleDelete(wh.id)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" /> Eliminar
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ═══════════════ FUTURE INTEGRATIONS ═══════════════ */}
      <div>
        <h2 className="text-lg font-semibold text-neutral-900 mb-4">Próximas integraciones</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {FUTURE_INTEGRATIONS.map(int => {
            const c = COLOR_MAP[int.color];
            return (
              <div key={int.id} className="bg-white rounded-xl border border-neutral-200 p-5 opacity-75">
                <div className="flex items-start justify-between mb-3">
                  <div className={`p-3 rounded-lg ${c.bg}`}><span className={c.text}>{int.icon}</span></div>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">Próximamente</span>
                </div>
                <h3 className="font-semibold text-neutral-900 mb-1">{int.name}</h3>
                <p className="text-xs text-neutral-500">{int.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Click outside to close menus */}
      {menuId && (
        <div className="fixed inset-0 z-0" onClick={() => setMenuId(null)} />
      )}
    </div>
  );
}
