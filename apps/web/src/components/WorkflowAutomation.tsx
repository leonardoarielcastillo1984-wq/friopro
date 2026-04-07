'use client';

import React, { useState, useEffect } from 'react';
import {
  Zap, Play, Pause, Settings, Clock, AlertTriangle, CheckCircle2,
  ArrowRight, Plus, X, Edit, Trash2, Copy, Eye, EyeOff,
  GitBranch, Filter, Calendar, Users, Mail, Bell
} from 'lucide-react';

interface WorkflowTrigger {
  type: 'manual' | 'event' | 'schedule' | 'condition';
  config: {
    eventType?: string;
    schedule?: string;
    condition?: string;
    threshold?: number;
  };
}

interface WorkflowAction {
  type: 'notification' | 'assignment' | 'escalation' | 'email' | 'webhook' | 'update';
  config: {
    recipients?: string[];
    message?: string;
    assignTo?: string;
    priority?: string;
    webhookUrl?: string;
    updateField?: string;
    updateValue?: any;
  };
}

interface WorkflowRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  trigger: WorkflowTrigger;
  actions: WorkflowAction[];
  conditions?: Array<{
    field: string;
    operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains';
    value: any;
  }>;
  category: 'ncr' | 'risk' | 'indicator' | 'training' | 'customer';
  priority: 'low' | 'medium' | 'high' | 'critical';
  createdAt: string;
  lastRun?: string;
  runCount: number;
  successCount: number;
}

interface WorkflowExecution {
  id: string;
  ruleId: string;
  ruleName: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  triggeredBy: string;
  startedAt: string;
  completedAt?: string;
  result?: string;
  error?: string;
  actionsExecuted: number;
  actionsSuccessful: number;
}

interface WorkflowAutomationProps {
  rules: WorkflowRule[];
  executions: WorkflowExecution[];
  onRuleCreate?: (rule: Partial<WorkflowRule>) => void;
  onRuleUpdate?: (rule: WorkflowRule) => void;
  onRuleDelete?: (ruleId: string) => void;
  onRuleToggle?: (ruleId: string, enabled: boolean) => void;
  onRuleExecute?: (ruleId: string) => void;
  className?: string;
}

const TRIGGER_TYPES = {
  manual: { label: 'Manual', icon: <Play className="w-4 h-4" /> },
  event: { label: 'Evento', icon: <Bell className="w-4 h-4" /> },
  schedule: { label: 'Programado', icon: <Calendar className="w-4 h-4" /> },
  condition: { label: 'Condición', icon: <Filter className="w-4 h-4" /> }
};

const ACTION_TYPES = {
  notification: { label: 'Notificación', icon: <Bell className="w-4 h-4" /> },
  assignment: { label: 'Asignación', icon: <Users className="w-4 h-4" /> },
  escalation: { label: 'Escalamiento', icon: <ArrowRight className="w-4 h-4" /> },
  email: { label: 'Email', icon: <Mail className="w-4 h-4" /> },
  webhook: { label: 'Webhook', icon: <GitBranch className="w-4 h-4" /> },
  update: { label: 'Actualizar', icon: <Edit className="w-4 h-4" /> }
};

const CATEGORY_COLORS = {
  ncr: '#EF4444',
  risk: '#F59E0B',
  indicator: '#3B82F6',
  training: '#10B981',
  customer: '#8B5CF6'
};

export default function WorkflowAutomation({
  rules,
  executions,
  onRuleCreate,
  onRuleUpdate,
  onRuleDelete,
  onRuleToggle,
  onRuleExecute,
  className = ''
}: WorkflowAutomationProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingRule, setEditingRule] = useState<WorkflowRule | null>(null);
  const [expandedRule, setExpandedRule] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const filteredRules = rules.filter(rule => {
    if (filterCategory !== 'all' && rule.category !== filterCategory) return false;
    if (filterStatus !== 'all') {
      if (filterStatus === 'enabled' && !rule.enabled) return false;
      if (filterStatus === 'disabled' && rule.enabled) return false;
    }
    return true;
  });

  const recentExecutions = executions.slice(0, 10);

  const handleCreateRule = (ruleData: Partial<WorkflowRule>) => {
    const newRule: WorkflowRule = {
      id: `workflow-${Date.now()}`,
      name: ruleData.name || 'Nuevo Workflow',
      description: ruleData.description || '',
      enabled: true,
      trigger: ruleData.trigger || { type: 'manual', config: {} },
      actions: ruleData.actions || [],
      category: ruleData.category || 'ncr',
      priority: ruleData.priority || 'medium',
      createdAt: new Date().toISOString(),
      runCount: 0,
      successCount: 0
    };

    onRuleCreate?.(newRule);
    setShowCreateForm(false);
  };

  const handleToggleRule = (ruleId: string, enabled: boolean) => {
    onRuleToggle?.(ruleId, enabled);
  };

  const handleExecuteRule = (ruleId: string) => {
    onRuleExecute?.(ruleId);
  };

  const getExecutionStatus = (execution: WorkflowExecution) => {
    switch (execution.status) {
      case 'pending': return { color: 'text-yellow-600', bg: 'bg-yellow-50', label: 'Pendiente' };
      case 'running': return { color: 'text-blue-600', bg: 'bg-blue-50', label: 'Ejecutando' };
      case 'completed': return { color: 'text-green-600', bg: 'bg-green-50', label: 'Completado' };
      case 'failed': return { color: 'text-red-600', bg: 'bg-red-50', label: 'Fallido' };
      default: return { color: 'text-gray-600', bg: 'bg-gray-50', label: 'Desconocido' };
    }
  };

  const getSuccessRate = (rule: WorkflowRule) => {
    if (rule.runCount === 0) return 0;
    return (rule.successCount / rule.runCount) * 100;
  };

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-lg">
            <Zap className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Automatización de Workflows</h3>
            <p className="text-sm text-gray-600 mt-1">
              {filteredRules.filter(r => r.enabled).length} de {filteredRules.length} workflows activos
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
            <option value="indicator">Indicadores</option>
            <option value="training">Capacitaciones</option>
            <option value="customer">Clientes</option>
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
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Nuevo Workflow
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="p-4 bg-gray-50 border-b border-gray-200">
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{filteredRules.length}</div>
            <div className="text-sm text-gray-600">Total Workflows</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {filteredRules.filter(r => r.enabled).length}
            </div>
            <div className="text-sm text-gray-600">Activos</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {recentExecutions.filter(e => e.status === 'completed').length}
            </div>
            <div className="text-sm text-gray-600">Ejecuciones exitosas</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">
              {filteredRules.reduce((sum, rule) => sum + rule.runCount, 0)}
            </div>
            <div className="text-sm text-gray-600">Total ejecuciones</div>
          </div>
        </div>
      </div>

      {/* Workflow Rules */}
      <div className="divide-y divide-gray-200">
        {filteredRules.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Zap className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-sm">No hay workflows configurados</p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="mt-4 text-blue-600 hover:text-blue-700"
            >
              Crear primer workflow
            </button>
          </div>
        ) : (
          filteredRules.map(rule => (
            <div key={rule.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <div
                    className="w-3 h-3 rounded-full mt-2"
                    style={{ backgroundColor: CATEGORY_COLORS[rule.category] }}
                  />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-gray-900">{rule.name}</h4>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        rule.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {rule.enabled ? 'Activo' : 'Inactivo'}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        rule.priority === 'critical' ? 'bg-red-100 text-red-700' :
                        rule.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                        rule.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {rule.priority}
                      </span>
                    </div>
                    
                    <p className="text-sm text-gray-600 mb-2">{rule.description}</p>
                    
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="capitalize">{rule.category}</span>
                      <span>•</span>
                      <span>{TRIGGER_TYPES[rule.trigger.type].label}</span>
                      <span>•</span>
                      <span>{rule.actions.length} acciones</span>
                      <span>•</span>
                      <span>Tasa éxito: {getSuccessRate(rule).toFixed(1)}%</span>
                      <span>•</span>
                      <span>Ejecuciones: {rule.runCount}</span>
                    </div>

                    {/* Trigger and Actions Preview */}
                    <div className="mt-3 flex items-center gap-4 text-xs">
                      <div className="flex items-center gap-1">
                        <span className="text-gray-500">Trigger:</span>
                        <div className="flex items-center gap-1 text-gray-700">
                          {TRIGGER_TYPES[rule.trigger.type].icon}
                          <span>{TRIGGER_TYPES[rule.trigger.type].label}</span>
                        </div>
                      </div>
                      
                      <ArrowRight className="w-3 h-3 text-gray-400" />
                      
                      <div className="flex items-center gap-1">
                        <span className="text-gray-500">Acciones:</span>
                        <div className="flex items-center gap-1">
                          {rule.actions.slice(0, 2).map((action, index) => (
                            <div key={index} className="flex items-center gap-1 text-gray-700">
                              {ACTION_TYPES[action.type].icon}
                              <span>{ACTION_TYPES[action.type].label}</span>
                              {index < Math.min(rule.actions.length - 1, 1) && <span>•</span>}
                            </div>
                          ))}
                          {rule.actions.length > 2 && (
                            <span className="text-gray-500">+{rule.actions.length - 2} más</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 ml-4">
                  <button
                    onClick={() => handleToggleRule(rule.id, !rule.enabled)}
                    className={`p-2 rounded-lg transition-colors ${
                      rule.enabled 
                        ? 'text-green-600 hover:text-green-700 hover:bg-green-50' 
                        : 'text-gray-600 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                    title={rule.enabled ? 'Desactivar' : 'Activar'}
                  >
                    {rule.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                  
                  {rule.trigger.type === 'manual' && (
                    <button
                      onClick={() => handleExecuteRule(rule.id)}
                      className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg"
                      title="Ejecutar manualmente"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                  )}
                  
                  <button
                    onClick={() => setEditingRule(rule)}
                    className="p-2 text-gray-600 hover:text-gray-700 hover:bg-gray-50 rounded-lg"
                    title="Editar"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  
                  <button
                    onClick={() => setExpandedRule(expandedRule === rule.id ? null : rule.id)}
                    className="p-2 text-gray-600 hover:text-gray-700 hover:bg-gray-50 rounded-lg"
                    title="Detalles"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedRule === rule.id && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h5 className="font-medium text-gray-900 mb-2">Configuración del Trigger</h5>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Tipo:</span>
                          <span className="font-medium">{TRIGGER_TYPES[rule.trigger.type].label}</span>
                        </div>
                        {rule.trigger.config.eventType && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Evento:</span>
                            <span className="font-medium">{rule.trigger.config.eventType}</span>
                          </div>
                        )}
                        {rule.trigger.config.schedule && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Programación:</span>
                            <span className="font-medium">{rule.trigger.config.schedule}</span>
                          </div>
                        )}
                        {rule.trigger.config.threshold && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Umbral:</span>
                            <span className="font-medium">{rule.trigger.config.threshold}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div>
                      <h5 className="font-medium text-gray-900 mb-2">Acciones Configuradas</h5>
                      <div className="space-y-2">
                        {rule.actions.map((action, index) => (
                          <div key={index} className="flex items-center gap-2 text-sm">
                            <div className="flex items-center gap-1 text-gray-600">
                              {ACTION_TYPES[action.type].icon}
                              <span>{ACTION_TYPES[action.type].label}</span>
                            </div>
                            {action.config.recipients && (
                              <span className="text-gray-500">
                                → {action.config.recipients.join(', ')}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  {/* Conditions */}
                  {rule.conditions && rule.conditions.length > 0 && (
                    <div className="mt-4">
                      <h5 className="font-medium text-gray-900 mb-2">Condiciones</h5>
                      <div className="space-y-1">
                        {rule.conditions.map((condition, index) => (
                          <div key={index} className="text-sm text-gray-600">
                            {condition.field} {condition.operator} {condition.value}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Statistics */}
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Última ejecución:</span>
                        <span className="font-medium text-gray-900 ml-2">
                          {rule.lastRun ? new Date(rule.lastRun).toLocaleString() : 'Nunca'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Tasa de éxito:</span>
                        <span className="font-medium text-green-600 ml-2">
                          {getSuccessRate(rule).toFixed(1)}%
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Creado:</span>
                        <span className="font-medium text-gray-900 ml-2">
                          {new Date(rule.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Recent Executions */}
      {recentExecutions.length > 0 && (
        <div className="p-4 bg-gray-50 border-t border-gray-200">
          <h4 className="font-medium text-gray-900 mb-3">Ejecuciones Recientes</h4>
          <div className="space-y-2">
            {recentExecutions.map(execution => {
              const status = getExecutionStatus(execution);
              return (
                <div key={execution.id} className="flex items-center justify-between p-2 bg-white rounded border border-gray-200">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${status.bg} ${status.color}`}>
                      {status.label}
                    </span>
                    <span className="text-sm font-medium text-gray-900">{execution.ruleName}</span>
                    <span className="text-xs text-gray-600">
                      {new Date(execution.startedAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-600">
                    <span>{execution.actionsSuccessful}/{execution.actionsExecuted} acciones</span>
                    {execution.error && (
                      <span className="text-red-600" title={execution.error}>
                        Error
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
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
                  {editingRule ? 'Editar Workflow' : 'Nuevo Workflow'}
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
                    placeholder="Nombre del workflow"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                  <textarea
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    defaultValue={editingRule?.description || ''}
                    placeholder="Descripción del workflow"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                    <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                      <option value="ncr">NCRs</option>
                      <option value="risk">Riesgos</option>
                      <option value="indicator">Indicadores</option>
                      <option value="training">Capacitaciones</option>
                      <option value="customer">Clientes</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Prioridad</label>
                    <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                      <option value="low">Baja</option>
                      <option value="medium">Media</option>
                      <option value="high">Alta</option>
                      <option value="critical">Crítica</option>
                    </select>
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
