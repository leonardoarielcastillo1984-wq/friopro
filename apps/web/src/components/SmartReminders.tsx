'use client';

import React, { useState, useEffect } from 'react';
import {
  Clock, Bell, Calendar, CheckCircle2, AlertCircle, Plus, X,
  Edit, Trash2, Play, Pause, RefreshCw, Mail, MessageSquare,
  Users, Target, Timer, Settings, Filter, Eye
} from 'lucide-react';

interface ReminderRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  entityType: 'ncr' | 'risk' | 'training' | 'indicator' | 'customer';
  triggerConditions: {
    status?: string[];
    ageHours?: number;
    dueDateHours?: number;
    priority?: string[];
    assignedTo?: string[];
  };
  reminderConfig: {
    frequency: 'once' | 'daily' | 'weekly' | 'custom';
    intervalHours?: number;
    maxReminders?: number;
    escalateAfter?: number;
  };
  actions: Array<{
    type: 'notification' | 'email' | 'assignment' | 'escalation';
    target: string[];
    message?: string;
    delayMinutes?: number;
  }>;
  createdAt: string;
  lastTriggered?: string;
  triggerCount: number;
}

interface ReminderEvent {
  id: string;
  ruleId: string;
  ruleName: string;
  entityType: string;
  entityId: string;
  entityCode: string;
  entityTitle: string;
  assignedTo?: string;
  dueDate?: string;
  entityStatus: string;
  reminderNumber: number;
  scheduledAt: string;
  sentAt?: string;
  eventStatus: 'pending' | 'sent' | 'failed' | 'cancelled';
  actions: Array<{
    type: string;
    target: string;
    executedAt?: string;
    success?: boolean;
    details?: string;
  }>;
}

interface SmartRemindersProps {
  rules: ReminderRule[];
  events: ReminderEvent[];
  onRuleCreate?: (rule: Partial<ReminderRule>) => void;
  onRuleUpdate?: (rule: ReminderRule) => void;
  onRuleDelete?: (ruleId: string) => void;
  onRuleToggle?: (ruleId: string, enabled: boolean) => void;
  onEventAcknowledge?: (eventId: string) => void;
  onEventCancel?: (eventId: string) => void;
  onEventSend?: (eventId: string) => void;
  className?: string;
}

const ENTITY_TYPES = {
  ncr: { label: 'No Conformidades', icon: <AlertCircle className="w-4 h-4" />, color: '#EF4444' },
  risk: { label: 'Riesgos', icon: <Target className="w-4 h-4" />, color: '#F59E0B' },
  training: { label: 'Capacitaciones', icon: <Users className="w-4 h-4" />, color: '#10B981' },
  indicator: { label: 'Indicadores', icon: <Bell className="w-4 h-4" />, color: '#3B82F6' },
  customer: { label: 'Clientes', icon: <MessageSquare className="w-4 h-4" />, color: '#8B5CF6' }
};

const FREQUENCY_TYPES = {
  once: { label: 'Una vez', icon: <Clock className="w-4 h-4" /> },
  daily: { label: 'Diario', icon: <Calendar className="w-4 h-4" /> },
  weekly: { label: 'Semanal', icon: <Calendar className="w-4 h-4" /> },
  custom: { label: 'Personalizado', icon: <Timer className="w-4 h-4" /> }
};

export default function SmartReminders({
  rules,
  events,
  onRuleCreate,
  onRuleUpdate,
  onRuleDelete,
  onRuleToggle,
  onEventAcknowledge,
  onEventCancel,
  onEventSend,
  className = ''
}: SmartRemindersProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingRule, setEditingRule] = useState<ReminderRule | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<ReminderEvent | null>(null);
  const [filterEntityType, setFilterEntityType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const activeRules = rules.filter(rule => rule.enabled);
  const pendingEvents = events.filter(event => event.eventStatus === 'pending');
  const overdueEvents = events.filter(event => {
    if (event.eventStatus !== 'pending') return false;
    return new Date(event.scheduledAt) < new Date();
  });

  const filteredEvents = events.filter(event => {
    if (filterEntityType !== 'all' && event.entityType !== filterEntityType) return false;
    if (filterStatus !== 'all' && event.eventStatus !== filterStatus) return false;
    return true;
  });

  const getTimeUntilReminder = (event: ReminderEvent) => {
    const now = new Date();
    const scheduled = new Date(event.scheduledAt);
    const diffMs = scheduled.getTime() - now.getTime();
    
    if (diffMs <= 0) return 'Vencido';
    
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffHours > 24) {
      const diffDays = Math.floor(diffHours / 24);
      return `en ${diffDays} día${diffDays > 1 ? 's' : ''}`;
    } else if (diffHours > 0) {
      return `en ${diffHours}h ${diffMinutes}m`;
    } else {
      return `en ${diffMinutes}m`;
    }
  };

  const getEventStatus = (event: ReminderEvent) => {
    switch (event.eventStatus) {
      case 'pending': return { color: 'text-yellow-600', bg: 'bg-yellow-50', label: 'Pendiente' };
      case 'sent': return { color: 'text-green-600', bg: 'bg-green-50', label: 'Enviado' };
      case 'failed': return { color: 'text-red-600', bg: 'bg-red-50', label: 'Fallido' };
      case 'cancelled': return { color: 'text-gray-600', bg: 'bg-gray-50', label: 'Cancelado' };
      default: return { color: 'text-gray-600', bg: 'bg-gray-50', label: 'Desconocido' };
    }
  };

  const handleCreateRule = (ruleData: Partial<ReminderRule>) => {
    const newRule: ReminderRule = {
      id: `reminder-${Date.now()}`,
      name: ruleData.name || 'Nueva Regla de Recordatorio',
      description: ruleData.description || '',
      enabled: true,
      entityType: ruleData.entityType || 'ncr',
      triggerConditions: ruleData.triggerConditions || {
        status: ['OPEN'],
        ageHours: 24
      },
      reminderConfig: ruleData.reminderConfig || {
        frequency: 'once',
        maxReminders: 3
      },
      actions: ruleData.actions || [
        {
          type: 'notification',
          target: ['assigned_to'],
          message: 'Recordatorio de seguimiento requerido'
        }
      ],
      createdAt: new Date().toISOString(),
      triggerCount: 0
    };

    onRuleCreate?.(newRule);
    setShowCreateForm(false);
  };

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-lg">
            <Bell className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Recordatorios Inteligentes</h3>
            <p className="text-sm text-gray-600 mt-1">
              {activeRules.length} reglas activas • {pendingEvents.length} pendientes • {overdueEvents.length} vencidos
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Filters */}
          <select
            value={filterEntityType}
            onChange={(e) => setFilterEntityType(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-2 py-1"
          >
            <option value="all">Todos los tipos</option>
            <option value="ncr">NCRs</option>
            <option value="risk">Riesgos</option>
            <option value="training">Capacitaciones</option>
            <option value="indicator">Indicadores</option>
            <option value="customer">Clientes</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-2 py-1"
          >
            <option value="all">Todos los estados</option>
            <option value="pending">Pendientes</option>
            <option value="sent">Enviados</option>
            <option value="failed">Fallidos</option>
          </select>

          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Nueva Regla
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="p-4 bg-gray-50 border-b border-gray-200">
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{rules.length}</div>
            <div className="text-sm text-gray-600">Reglas Totales</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{activeRules.length}</div>
            <div className="text-sm text-gray-600">Reglas Activas</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{overdueEvents.length}</div>
            <div className="text-sm text-gray-600">Recordatorios Vencidos</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {events.reduce((sum, event) => sum + event.actions.length, 0)}
            </div>
            <div className="text-sm text-gray-600">Acciones Enviadas</div>
          </div>
        </div>
      </div>

      {/* Overdue Events Alert */}
      {overdueEvents.length > 0 && (
        <div className="p-4 bg-red-50 border-b border-red-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <span className="font-medium text-red-900">
                {overdueEvents.length} recordatorios vencidos requieren atención
              </span>
            </div>
            <button
              onClick={() => setFilterStatus('pending')}
              className="text-sm text-red-600 hover:text-red-700"
            >
              Ver todos
            </button>
          </div>
        </div>
      )}

      {/* Active Rules */}
      <div className="p-4 border-b border-gray-200">
        <h4 className="font-medium text-gray-900 mb-3">Reglas Activas</h4>
        <div className="space-y-2">
          {activeRules.length === 0 ? (
            <p className="text-sm text-gray-500">No hay reglas activas</p>
          ) : (
            activeRules.map(rule => (
              <div key={rule.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: ENTITY_TYPES[rule.entityType].color }}
                  />
                  <div>
                    <div className="font-medium text-gray-900">{rule.name}</div>
                    <div className="text-sm text-gray-600">
                      {ENTITY_TYPES[rule.entityType].label} • {FREQUENCY_TYPES[rule.reminderConfig.frequency].label}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">
                    {rule.triggerCount} activaciones
                  </span>
                  <button
                    onClick={() => setEditingRule(rule)}
                    className="p-1 text-gray-600 hover:text-gray-700"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onRuleToggle?.(rule.id, false)}
                    className="p-1 text-orange-600 hover:text-orange-700"
                  >
                    <Pause className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Reminder Events */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium text-gray-900">Recordatorios Programados</h4>
          <div className="text-sm text-gray-600">
            {filteredEvents.length} eventos
          </div>
        </div>
        
        {filteredEvents.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Bell className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-sm">No hay recordatorios programados</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredEvents.map(event => {
              const status = getEventStatus(event);
              const timeUntil = getTimeUntilReminder(event);
              const entityType = ENTITY_TYPES[event.entityType as keyof typeof ENTITY_TYPES];
              const isOverdue = new Date(event.scheduledAt) < new Date();
              
              return (
                <div
                  key={event.id}
                  className={`flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 cursor-pointer ${
                    isOverdue ? 'border-red-200 bg-red-50' : 'border-gray-200'
                  }`}
                  onClick={() => setSelectedEvent(event)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${status.bg}`}>
                      <AlertCircle className={`w-4 h-4 ${status.color}`} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900">{event.entityCode}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${status.bg} ${status.color}`}>
                          {status.label}
                        </span>
                        {isOverdue && (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                            Vencido
                          </span>
                        )}
                        <span className="text-xs text-gray-500">
                          #{event.reminderNumber}
                        </span>
                      </div>
                      
                      <div className="text-sm text-gray-600 truncate">{event.entityTitle}</div>
                      
                      <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                        <span>{entityType.label}</span>
                        <span>•</span>
                        <span>Estado: {event.entityStatus}</span>
                        <span>•</span>
                        <span>Programado: {new Date(event.scheduledAt).toLocaleString()}</span>
                        <span>•</span>
                        <span className={isOverdue ? 'text-red-600 font-medium' : 'text-gray-600'}>
                          {timeUntil}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    {event.eventStatus === 'pending' && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEventSend?.(event.id);
                          }}
                          className="p-1 text-blue-600 hover:text-blue-700"
                          title="Enviar ahora"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEventAcknowledge?.(event.id);
                          }}
                          className="p-1 text-green-600 hover:text-green-700"
                          title="Reconocer"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEventCancel?.(event.id);
                          }}
                          className="p-1 text-red-600 hover:text-red-700"
                          title="Cancelar"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    <button
                      className="p-1 text-gray-600 hover:text-gray-700"
                      title="Ver detalles"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
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
                <h3 className="text-lg font-semibold text-gray-900">Detalle de Recordatorio</h3>
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
                      <AlertCircle className={`w-5 h-5 ${getEventStatus(selectedEvent).color}`} />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 mb-1">
                        {selectedEvent.entityCode} - {selectedEvent.entityTitle}
                      </div>
                      <p className="text-sm text-gray-600">
                        {ENTITY_TYPES[selectedEvent.entityType as keyof typeof ENTITY_TYPES].label} • 
                        Recordatorio #{selectedEvent.reminderNumber}
                      </p>
                      <p className="text-sm text-gray-600">
                        Programado: {new Date(selectedEvent.scheduledAt).toLocaleString()}
                      </p>
                      {selectedEvent.sentAt && (
                        <p className="text-sm text-gray-600">
                          Enviado: {new Date(selectedEvent.sentAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Acciones Configuradas</h4>
                  <div className="space-y-2">
                    {selectedEvent.actions.map((action, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${
                            action.success ? 'bg-green-50' : 'bg-gray-100'
                          }`}>
                            {action.type === 'notification' && <Bell className={`w-4 h-4 ${action.success ? 'text-green-600' : 'text-gray-600'}`} />}
                            {action.type === 'email' && <Mail className={`w-4 h-4 ${action.success ? 'text-green-600' : 'text-gray-600'}`} />}
                            {action.type === 'assignment' && <Users className={`w-4 h-4 ${action.success ? 'text-green-600' : 'text-gray-600'}`} />}
                            {action.type === 'escalation' && <AlertCircle className={`w-4 h-4 ${action.success ? 'text-green-600' : 'text-gray-600'}`} />}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900 capitalize">
                              {action.type === 'notification' ? 'Notificación' :
                               action.type === 'email' ? 'Email' :
                               action.type === 'assignment' ? 'Asignación' : 'Escalamiento'}
                            </div>
                            <div className="text-sm text-gray-600">
                              Para: {action.target}
                              {action.details && ` • ${action.details}`}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          {action.executedAt && (
                            <>
                              <div className={`text-sm font-medium ${
                                action.success ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {action.success ? 'Exitoso' : 'Fallido'}
                              </div>
                              <div className="text-xs text-gray-500">
                                {new Date(action.executedAt).toLocaleString()}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
                  {selectedEvent.eventStatus === 'pending' && (
                    <>
                      <button
                        onClick={() => {
                          onEventSend?.(selectedEvent.id);
                          setSelectedEvent(null);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        <Play className="w-4 h-4" />
                        Enviar Ahora
                      </button>
                      <button
                        onClick={() => {
                          onEventAcknowledge?.(selectedEvent.id);
                          setSelectedEvent(null);
                        }}
                        className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Reconocer
                      </button>
                      <button
                        onClick={() => {
                          onEventCancel?.(selectedEvent.id);
                          setSelectedEvent(null);
                        }}
                        className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                      >
                        <X className="w-4 h-4" />
                        Cancelar
                      </button>
                    </>
                  )}
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
      {(showCreateForm || editingRule) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {editingRule ? 'Editar Regla de Recordatorio' : 'Nueva Regla de Recordatorio'}
                </h3>
                <button
                  onClick={() => {
                    setShowCreateForm(false);
                    setEditingRule(null);
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    defaultValue={editingRule?.name || ''}
                    placeholder="Nombre de la regla"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                  <textarea
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    defaultValue={editingRule?.description || ''}
                    placeholder="Descripción de la regla"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Entidad</label>
                    <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                      <option value="ncr">No Conformidades</option>
                      <option value="risk">Riesgos</option>
                      <option value="training">Capacitaciones</option>
                      <option value="indicator">Indicadores</option>
                      <option value="customer">Clientes</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Frecuencia</label>
                    <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                      <option value="once">Una vez</option>
                      <option value="daily">Diario</option>
                      <option value="weekly">Semanal</option>
                      <option value="custom">Personalizado</option>
                    </select>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tiempo para primer recordatorio (horas)
                    </label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      defaultValue={editingRule?.triggerConditions.ageHours || 24}
                      min="1"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Máximo de recordatorios
                    </label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      defaultValue={editingRule?.reminderConfig.maxReminders || 3}
                      min="1"
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3 mt-6">
                <button
                  onClick={() => {
                    if (editingRule) {
                      // Handle update
                      setEditingRule(null);
                    } else {
                      // Handle create
                      handleCreateRule({});
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {editingRule ? 'Actualizar' : 'Crear'}
                </button>
                <button
                  onClick={() => {
                    setShowCreateForm(false);
                    setEditingRule(null);
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
