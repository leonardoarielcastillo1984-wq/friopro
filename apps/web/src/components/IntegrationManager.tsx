'use client';

import React, { useState, useEffect } from 'react';
import {
  Mail, MessageSquare, Webhook, Zap, Plus, X, Edit, Trash2,
  CheckCircle2, AlertCircle, Settings, Play, Pause, RefreshCw,
  Key, Globe, Bell, Users, Calendar, Clock, Eye, Copy, EyeOff
} from 'lucide-react';

interface IntegrationConfig {
  id: string;
  name: string;
  type: 'email' | 'slack' | 'webhook' | 'api';
  provider: string;
  enabled: boolean;
  config: {
    apiKey?: string;
    webhookUrl?: string;
    email?: string;
    channel?: string;
    baseUrl?: string;
    headers?: Record<string, string>;
  };
  triggers: Array<{
    eventType: string;
    enabled: boolean;
    filters?: Record<string, any>;
  }>;
  templates?: Array<{
    id: string;
    name: string;
    subject?: string;
    body: string;
    variables?: string[];
  }>;
  createdAt: string;
  lastUsed?: string;
  successCount: number;
  errorCount: number;
}

interface IntegrationEvent {
  id: string;
  integrationId: string;
  integrationName: string;
  eventType: string;
  payload: any;
  status: 'pending' | 'sent' | 'failed' | 'retrying';
  sentAt?: string;
  error?: string;
  response?: any;
  retryCount: number;
}

interface IntegrationManagerProps {
  integrations: IntegrationConfig[];
  events: IntegrationEvent[];
  onIntegrationCreate?: (integration: Partial<IntegrationConfig>) => void;
  onIntegrationUpdate?: (integration: IntegrationConfig) => void;
  onIntegrationDelete?: (integrationId: string) => void;
  onIntegrationToggle?: (integrationId: string, enabled: boolean) => void;
  onIntegrationTest?: (integrationId: string) => void;
  className?: string;
}

const PROVIDER_CONFIGS = {
  email: {
    providers: [
      { name: 'SMTP', icon: <Mail className="w-4 h-4" />, color: '#3B82F6' },
      { name: 'SendGrid', icon: <Mail className="w-4 h-4" />, color: '#10B981' },
      { name: 'Resend', icon: <Mail className="w-4 h-4" />, color: '#8B5CF6' }
    ]
  },
  slack: {
    providers: [
      { name: 'Slack API', icon: <MessageSquare className="w-4 h-4" />, color: '#4A154B' },
      { name: 'Slack Webhook', icon: <Webhook className="w-4 h-4" />, color: '#4A154B' }
    ]
  },
  webhook: {
    providers: [
      { name: 'Generic Webhook', icon: <Webhook className="w-4 h-4" />, color: '#F59E0B' },
      { name: 'Microsoft Teams', icon: <MessageSquare className="w-4 h-4" />, color: '#5E5CE6' },
      { name: 'Discord', icon: <MessageSquare className="w-4 h-4" />, color: '#5865F2' }
    ]
  },
  api: {
    providers: [
      { name: 'REST API', icon: <Globe className="w-4 h-4" />, color: '#6B7280' },
      { name: 'GraphQL', icon: <Globe className="w-4 h-4" />, color: '#E10098' }
    ]
  }
};

const EVENT_TYPES = [
  'ncr.created', 'ncr.updated', 'ncr.escalated',
  'risk.created', 'risk.updated', 'risk.mitigated',
  'training.created', 'training.reminder', 'training.completed',
  'indicator.below_target', 'indicator.achieved',
  'customer.complaint', 'customer.feedback'
];

export default function IntegrationManager({
  integrations,
  events,
  onIntegrationCreate,
  onIntegrationUpdate,
  onIntegrationDelete,
  onIntegrationToggle,
  onIntegrationTest,
  className = ''
}: IntegrationManagerProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingIntegration, setEditingIntegration] = useState<IntegrationConfig | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<IntegrationEvent | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const activeIntegrations = integrations.filter(integration => integration.enabled);
  const recentEvents = events.slice(0, 10);
  const failedEvents = events.filter(event => event.status === 'failed');

  const filteredIntegrations = integrations.filter(integration => {
    if (filterType !== 'all' && integration.type !== filterType) return false;
    if (filterStatus !== 'all') {
      if (filterStatus === 'enabled' && !integration.enabled) return false;
      if (filterStatus === 'disabled' && integration.enabled) return false;
    }
    return true;
  });

  const getEventStatus = (event: IntegrationEvent) => {
    switch (event.status) {
      case 'pending': return { color: 'text-yellow-600', bg: 'bg-yellow-50', label: 'Pendiente' };
      case 'sent': return { color: 'text-green-600', bg: 'bg-green-50', label: 'Enviado' };
      case 'failed': return { color: 'text-red-600', bg: 'bg-red-50', label: 'Fallido' };
      case 'retrying': return { color: 'text-blue-600', bg: 'bg-blue-50', label: 'Reintentando' };
      default: return { color: 'text-gray-600', bg: 'bg-gray-50', label: 'Desconocido' };
    }
  };

  const getSuccessRate = (integration: IntegrationConfig) => {
    const total = integration.successCount + integration.errorCount;
    if (total === 0) return 0;
    return (integration.successCount / total) * 100;
  };

  const handleCreateIntegration = (integrationData: Partial<IntegrationConfig>) => {
    const newIntegration: IntegrationConfig = {
      id: `integration-${Date.now()}`,
      name: integrationData.name || 'Nueva Integración',
      type: integrationData.type || 'webhook',
      provider: integrationData.provider || 'Generic Webhook',
      enabled: true,
      config: integrationData.config || {},
      triggers: integrationData.triggers || [],
      templates: integrationData.templates || [],
      createdAt: new Date().toISOString(),
      successCount: 0,
      errorCount: 0
    };

    onIntegrationCreate?.(newIntegration);
    setShowCreateForm(false);
  };

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-50 rounded-lg">
            <Zap className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Gestión de Integraciones</h3>
            <p className="text-sm text-gray-600 mt-1">
              {activeIntegrations.length} de {integrations.length} integraciones activas
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Filters */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-2 py-1"
          >
            <option value="all">Todos los tipos</option>
            <option value="email">Email</option>
            <option value="slack">Slack</option>
            <option value="webhook">Webhook</option>
            <option value="api">API</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-2 py-1"
          >
            <option value="all">Todos los estados</option>
            <option value="enabled">Activos</option>
            <option value="disabled">Inactivos</option>
          </select>

          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            <Plus className="w-4 h-4" />
            Nueva Integración
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="p-4 bg-gray-50 border-b border-gray-200">
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{integrations.length}</div>
            <div className="text-sm text-gray-600">Total Integraciones</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{activeIntegrations.length}</div>
            <div className="text-sm text-gray-600">Activas</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{failedEvents.length}</div>
            <div className="text-sm text-gray-600">Eventos Fallidos</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {events.reduce((sum, event) => sum + 1, 0)}
            </div>
            <div className="text-sm text-gray-600">Total Eventos</div>
          </div>
        </div>
      </div>

      {/* Failed Events Alert */}
      {failedEvents.length > 0 && (
        <div className="p-4 bg-red-50 border-b border-red-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <span className="font-medium text-red-900">
                {failedEvents.length} eventos fallaron y requieren atención
              </span>
            </div>
            <button
              onClick={() => setFilterStatus('all')}
              className="text-sm text-red-600 hover:text-red-700"
            >
              Ver eventos
            </button>
          </div>
        </div>
      )}

      {/* Integrations List */}
      <div className="p-4 border-b border-gray-200">
        <h4 className="font-medium text-gray-900 mb-3">Integraciones Configuradas</h4>
        <div className="space-y-2">
          {filteredIntegrations.length === 0 ? (
            <p className="text-sm text-gray-500">No hay integraciones configuradas</p>
          ) : (
            filteredIntegrations.map(integration => {
              const providerConfig = PROVIDER_CONFIGS[integration.type as keyof typeof PROVIDER_CONFIGS];
              const provider = providerConfig?.providers.find(p => p.name === integration.provider);
              const successRate = getSuccessRate(integration);
              
              return (
                <div key={integration.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div
                      className="p-2 rounded-lg"
                      style={{ backgroundColor: provider?.color + '20' }}
                    >
                      {provider?.icon || <Settings className="w-4 h-4" />}
                    </div>
                    
                    <div>
                      <div className="font-medium text-gray-900">{integration.name}</div>
                      <div className="text-sm text-gray-600">
                        {integration.provider} • {integration.triggers.length} eventos activos
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                        <span>Tasa éxito: {successRate.toFixed(1)}%</span>
                        <span>•</span>
                        <span>{integration.successCount} enviados</span>
                        <span>•</span>
                        <span>{integration.errorCount} fallidos</span>
                        {integration.lastUsed && (
                          <>
                            <span>•</span>
                            <span>Último uso: {new Date(integration.lastUsed).toLocaleDateString()}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onIntegrationTest?.(integration.id)}
                      className="p-1 text-blue-600 hover:text-blue-700"
                      title="Probar integración"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setEditingIntegration(integration)}
                      className="p-1 text-gray-600 hover:text-gray-700"
                      title="Editar"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onIntegrationToggle?.(integration.id, !integration.enabled)}
                      className={`p-1 rounded-lg transition-colors ${
                        integration.enabled 
                          ? 'text-green-600 hover:text-green-700 hover:bg-green-50' 
                          : 'text-gray-600 hover:text-gray-700 hover:bg-gray-50'
                      }`}
                      title={integration.enabled ? 'Desactivar' : 'Activar'}
                    >
                      {integration.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => onIntegrationDelete?.(integration.id)}
                      className="p-1 text-red-600 hover:text-red-700"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Recent Events */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium text-gray-900">Eventos Recientes</h4>
          <div className="text-sm text-gray-600">
            {recentEvents.length} eventos
          </div>
        </div>
        
        {recentEvents.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Zap className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-sm">No hay eventos recientes</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentEvents.map(event => {
              const status = getEventStatus(event);
              const integration = integrations.find(i => i.id === event.integrationId);
              
              return (
                <div
                  key={event.id}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                  onClick={() => setSelectedEvent(event)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${status.bg}`}>
                      {event.status === 'sent' && <CheckCircle2 className={`w-4 h-4 ${status.color}`} />}
                      {event.status === 'failed' && <AlertCircle className={`w-4 h-4 ${status.color}`} />}
                      {event.status === 'pending' && <Clock className={`w-4 h-4 ${status.color}`} />}
                      {event.status === 'retrying' && <RefreshCw className={`w-4 h-4 ${status.color}`} />}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900">{integration?.name}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${status.bg} ${status.color}`}>
                          {status.label}
                        </span>
                        {event.retryCount > 0 && (
                          <span className="text-xs text-gray-500">
                            Reintento #{event.retryCount}
                          </span>
                        )}
                      </div>
                      
                      <div className="text-sm text-gray-600">{event.eventType}</div>
                      
                      <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                        <span>Enviado: {event.sentAt ? new Date(event.sentAt).toLocaleString() : 'Pendiente'}</span>
                        {event.error && (
                          <>
                            <span>•</span>
                            <span className="text-red-600 truncate max-w-xs" title={event.error}>
                              Error: {event.error}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <button
                    className="p-1 text-gray-600 hover:text-gray-700"
                    title="Ver detalles"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Detalle de Evento</h3>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                {/* Event Info */}
                <div className={`p-4 rounded-lg ${getEventStatus(selectedEvent).bg}`}>
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${getEventStatus(selectedEvent).bg}`}>
                      {selectedEvent.status === 'sent' && <CheckCircle2 className={`w-5 h-5 ${getEventStatus(selectedEvent).color}`} />}
                      {selectedEvent.status === 'failed' && <AlertCircle className={`w-5 h-5 ${getEventStatus(selectedEvent).color}`} />}
                      {selectedEvent.status === 'pending' && <Clock className={`w-5 h-5 ${getEventStatus(selectedEvent).color}`} />}
                      {selectedEvent.status === 'retrying' && <RefreshCw className={`w-5 h-5 ${getEventStatus(selectedEvent).color}`} />}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 mb-1">
                        {selectedEvent.eventType}
                      </div>
                      <p className="text-sm text-gray-600">
                        Integración: {selectedEvent.integrationName}
                      </p>
                      <p className="text-sm text-gray-600">
                        Estado: {getEventStatus(selectedEvent).label}
                      </p>
                      {selectedEvent.sentAt && (
                        <p className="text-sm text-gray-600">
                          Enviado: {new Date(selectedEvent.sentAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Payload */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Payload</h4>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <pre className="text-sm text-gray-700 overflow-x-auto">
                      {JSON.stringify(selectedEvent.payload, null, 2)}
                    </pre>
                  </div>
                </div>

                {/* Error Details */}
                {selectedEvent.error && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Error</h4>
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-800">{selectedEvent.error}</p>
                    </div>
                  </div>
                )}

                {/* Response */}
                {selectedEvent.response && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Respuesta</h4>
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <pre className="text-sm text-green-800 overflow-x-auto">
                        {JSON.stringify(selectedEvent.response, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => setSelectedEvent(null)}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Form Modal */}
      {(showCreateForm || editingIntegration) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {editingIntegration ? 'Editar Integración' : 'Nueva Integración'}
                </h3>
                <button
                  onClick={() => {
                    setShowCreateForm(false);
                    setEditingIntegration(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    defaultValue={editingIntegration?.name || ''}
                    placeholder="Nombre de la integración"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                    <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500">
                      <option value="email">Email</option>
                      <option value="slack">Slack</option>
                      <option value="webhook">Webhook</option>
                      <option value="api">API</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor</label>
                    <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500">
                      <option value="smtp">SMTP</option>
                      <option value="sendgrid">SendGrid</option>
                      <option value="resend">Resend</option>
                      <option value="slack-api">Slack API</option>
                      <option value="slack-webhook">Slack Webhook</option>
                      <option value="generic">Generic Webhook</option>
                    </select>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Configuración</label>
                  <div className="space-y-2">
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      placeholder="API Key / URL / Email"
                    />
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      placeholder="Canal / Webhook URL"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Eventos Activados</label>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {EVENT_TYPES.map(eventType => (
                      <label key={eventType} className="flex items-center gap-2">
                        <input type="checkbox" className="rounded border-gray-300" />
                        <span className="text-sm text-gray-700">{eventType}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3 mt-6">
                <button
                  onClick={() => {
                    if (editingIntegration) {
                      // Handle update
                      setEditingIntegration(null);
                    } else {
                      // Handle create
                      handleCreateIntegration({});
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {editingIntegration ? 'Actualizar' : 'Crear'}
                </button>
                <button
                  onClick={() => {
                    setShowCreateForm(false);
                    setEditingIntegration(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
