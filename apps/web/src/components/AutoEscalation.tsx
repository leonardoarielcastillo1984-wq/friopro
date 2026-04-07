'use client';

import React, { useState, useEffect } from 'react';
import {
  AlertTriangle, ArrowUpRight, Clock, Users, Mail, Bell,
  Settings, Play, Pause, RefreshCw, CheckCircle2, X,
  TrendingUp, Calendar, Filter, Eye, Edit, Trash2, Plus
} from 'lucide-react';

interface EscalationRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  triggerConditions: {
    severity?: string[];
    ageHours?: number;
    status?: string[];
    category?: string[];
  };
  escalationLevels: Array<{
    level: number;
    delayHours: number;
    assignTo?: string[];
    notifyUsers?: string[];
    notifyEmails?: string[];
    priority: string;
    actions?: string[];
  }>;
  category: 'ncr' | 'risk' | 'customer';
  createdAt: string;
  lastTriggered?: string;
  triggerCount: number;
}

interface EscalationEvent {
  id: string;
  ruleId: string;
  ruleName: string;
  itemId: string;
  itemCode: string;
  itemTitle: string;
  currentLevel: number;
  triggeredAt: string;
  nextEscalationAt?: string;
  status: 'pending' | 'escalated' | 'resolved' | 'cancelled';
  actions: Array<{
    type: 'assignment' | 'notification' | 'email';
    target: string;
    executedAt: string;
    success: boolean;
    details?: string;
  }>;
}

interface AutoEscalationProps {
  rules: EscalationRule[];
  events: EscalationEvent[];
  onRuleCreate?: (rule: Partial<EscalationRule>) => void;
  onRuleUpdate?: (rule: EscalationRule) => void;
  onRuleDelete?: (ruleId: string) => void;
  onRuleToggle?: (ruleId: string, enabled: boolean) => void;
  onEventAcknowledge?: (eventId: string) => void;
  onEventCancel?: (eventId: string) => void;
  className?: string;
}

const SEVERITY_COLORS = {
  CRITICAL: '#DC2626',
  MAJOR: '#EA580C',
  MINOR: '#D97706',
  OBSERVATION: '#059669'
};

const CATEGORY_COLORS = {
  ncr: '#EF4444',
  risk: '#F59E0B',
  customer: '#8B5CF6'
};

export default function AutoEscalation({
  rules,
  events,
  onRuleCreate,
  onRuleUpdate,
  onRuleDelete,
  onRuleToggle,
  onEventAcknowledge,
  onEventCancel,
  className = ''
}: AutoEscalationProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingRule, setEditingRule] = useState<EscalationRule | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<EscalationEvent | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const activeRules = rules.filter(rule => rule.enabled);
  const pendingEvents = events.filter(event => event.status === 'pending');
  const escalatedEvents = events.filter(event => event.status === 'escalated');

  const filteredEvents = events.filter(event => {
    if (filterCategory !== 'all') {
      const rule = rules.find(r => r.id === event.ruleId);
      if (!rule || rule.category !== filterCategory) return false;
    }
    if (filterStatus !== 'all' && event.status !== filterStatus) return false;
    return true;
  });

  const getTimeUntilNextEscalation = (event: EscalationEvent) => {
    if (!event.nextEscalationAt) return null;
    
    const now = new Date();
    const nextEscalation = new Date(event.nextEscalationAt);
    const diffMs = nextEscalation.getTime() - now.getTime();
    
    if (diffMs <= 0) return 'Ahora';
    
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffHours > 0) {
      return `en ${diffHours}h ${diffMinutes}m`;
    } else {
      return `en ${diffMinutes}m`;
    }
  };

  const getEventStatus = (event: EscalationEvent) => {
  switch (event.status) {
    case 'pending': return { color: 'text-yellow-600', bg: 'bg-yellow-50', label: 'Pendiente' };
    case 'escalated': return { color: 'text-orange-600', bg: 'bg-orange-50', label: 'Escalado' };
    case 'resolved': return { color: 'text-green-600', bg: 'bg-green-50', label: 'Resuelto' };
    case 'cancelled': return { color: 'text-gray-600', bg: 'bg-gray-50', label: 'Cancelado' };
    default: return { color: 'text-gray-600', bg: 'bg-gray-50', label: 'Desconocido' };
  }
};

  const handleCreateRule = (ruleData: Partial<EscalationRule>) => {
    const newRule: EscalationRule = {
      id: `escalation-${Date.now()}`,
      name: ruleData.name || 'Nueva Regla de Escalamiento',
      description: ruleData.description || '',
      enabled: true,
      triggerConditions: ruleData.triggerConditions || {
        severity: ['CRITICAL'],
        ageHours: 24
      },
      escalationLevels: ruleData.escalationLevels || [
        {
          level: 1,
          delayHours: 24,
          assignTo: ['manager'],
          notifyUsers: ['manager'],
          priority: 'high',
          actions: ['review', 'assign']
        }
      ],
      category: ruleData.category || 'ncr',
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
          <div className="p-2 bg-orange-50 rounded-lg">
            <ArrowUpRight className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Escalamiento Automático</h3>
            <p className="text-sm text-gray-600 mt-1">
              {activeRules.length} reglas activas • {pendingEvents.length} pendientes
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Filters */}
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-2 py-1"
          >
            <option value="all">Todas las categorías</option>
            <option value="ncr">NCRs</option>
            <option value="risk">Riesgos</option>
            <option value="customer">Clientes</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-2 py-1"
          >
            <option value="all">Todos los estados</option>
            <option value="pending">Pendientes</option>
            <option value="escalated">Escalados</option>
            <option value="resolved">Resueltos</option>
          </select>

          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
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
            <div className="text-2xl font-bold text-orange-600">{pendingEvents.length}</div>
            <div className="text-sm text-gray-600">Escalamientos Pendientes</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {events.reduce((sum, event) => sum + event.actions.length, 0)}
            </div>
            <div className="text-sm text-gray-600">Acciones Ejecutadas</div>
          </div>
        </div>
      </div>

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
                    style={{ backgroundColor: CATEGORY_COLORS[rule.category] }}
                  />
                  <div>
                    <div className="font-medium text-gray-900">{rule.name}</div>
                    <div className="text-sm text-gray-600">
                      {rule.escalationLevels.length} niveles • {rule.triggerCount} activaciones
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
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

      {/* Escalation Events */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium text-gray-900">Eventos de Escalamiento</h4>
          <div className="text-sm text-gray-600">
            {filteredEvents.length} eventos
          </div>
        </div>
        
        {filteredEvents.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <ArrowUpRight className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-sm">No hay eventos de escalamiento</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredEvents.map(event => {
              const status = getEventStatus(event);
              const rule = rules.find(r => r.id === event.ruleId);
              const timeUntilNext = getTimeUntilNextEscalation(event);
              
              return (
                <div
                  key={event.id}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                  onClick={() => setSelectedEvent(event)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${status.bg}`}>
                      <ArrowUpRight className={`w-4 h-4 ${status.color}`} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900">{event.itemCode}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${status.bg} ${status.color}`}>
                          {status.label}
                        </span>
                        <span className="text-xs text-gray-500">
                          Nivel {event.currentLevel}
                        </span>
                      </div>
                      
                      <div className="text-sm text-gray-600 truncate">{event.itemTitle}</div>
                      
                      <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                        <span>Regla: {event.ruleName}</span>
                        <span>•</span>
                        <span>{new Date(event.triggeredAt).toLocaleString()}</span>
                        {event.status === 'pending' && timeUntilNext && (
                          <>
                            <span>•</span>
                            <span className="text-orange-600 font-medium">
                              Próximo escalamiento {timeUntilNext}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    {event.status === 'pending' && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEventAcknowledge?.(event.id);
                          }}
                          className="p-1 text-blue-600 hover:text-blue-700"
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
                          title="Cancelar escalamiento"
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
                <h3 className="text-lg font-semibold text-gray-900">Detalle de Escalamiento</h3>
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
                      <ArrowUpRight className={`w-5 h-5 ${getEventStatus(selectedEvent).color}`} />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 mb-1">
                        {selectedEvent.itemCode} - {selectedEvent.itemTitle}
                      </div>
                      <p className="text-sm text-gray-600">
                        Regla: {selectedEvent.ruleName} • Nivel {selectedEvent.currentLevel}
                      </p>
                      <p className="text-sm text-gray-600">
                        Activado: {new Date(selectedEvent.triggeredAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Actions Timeline */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Acciones Ejecutadas</h4>
                  <div className="space-y-2">
                    {selectedEvent.actions.map((action, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${
                            action.success ? 'bg-green-50' : 'bg-red-50'
                          }`}>
                            {action.type === 'assignment' && <Users className={`w-4 h-4 ${action.success ? 'text-green-600' : 'text-red-600'}`} />}
                            {action.type === 'notification' && <Bell className={`w-4 h-4 ${action.success ? 'text-green-600' : 'text-red-600'}`} />}
                            {action.type === 'email' && <Mail className={`w-4 h-4 ${action.success ? 'text-green-600' : 'text-red-600'}`} />}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900 capitalize">
                              {action.type === 'assignment' ? 'Asignación' :
                               action.type === 'notification' ? 'Notificación' : 'Email'}
                            </div>
                            <div className="text-sm text-gray-600">
                              Para: {action.target}
                              {action.details && ` • ${action.details}`}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-sm font-medium ${
                            action.success ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {action.success ? 'Exitoso' : 'Fallido'}
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(action.executedAt).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Next Escalation */}
                {selectedEvent.status === 'pending' && selectedEvent.nextEscalationAt && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Próximo Escalamiento</h4>
                    <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-orange-900">
                            Nivel {selectedEvent.currentLevel + 1}
                          </div>
                          <div className="text-sm text-orange-700">
                            {new Date(selectedEvent.nextEscalationAt).toLocaleString()}
                          </div>
                        </div>
                        <div className="text-sm text-orange-600 font-medium">
                          {getTimeUntilNextEscalation(selectedEvent)}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
                  {selectedEvent.status === 'pending' && (
                    <>
                      <button
                        onClick={() => {
                          onEventAcknowledge?.(selectedEvent.id);
                          setSelectedEvent(null);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
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
                  {editingRule ? 'Editar Regla de Escalamiento' : 'Nueva Regla de Escalamiento'}
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    defaultValue={editingRule?.name || ''}
                    placeholder="Nombre de la regla"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                  <textarea
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    rows={3}
                    defaultValue={editingRule?.description || ''}
                    placeholder="Descripción de la regla"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                    <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500">
                      <option value="ncr">NCRs</option>
                      <option value="risk">Riesgos</option>
                      <option value="customer">Clientes</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Severidad Mínima</label>
                    <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500">
                      <option value="CRITICAL">Crítica</option>
                      <option value="MAJOR">Mayor</option>
                      <option value="MINOR">Menor</option>
                      <option value="OBSERVATION">Observación</option>
                    </select>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tiempo para primer escalamiento (horas)
                  </label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    defaultValue={editingRule?.escalationLevels[0]?.delayHours || 24}
                    min="1"
                  />
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
                  className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
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
