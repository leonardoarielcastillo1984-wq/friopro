'use client';

import React, { useState, useEffect } from 'react';
import {
  AlertTriangle, CheckCircle, AlertCircle, Info, Bell, BellRing,
  Settings, X, RefreshCw, Filter, Search, Clock, User,
  Server, Database, Wifi, HardDrive, Zap, TrendingUp,
  ChevronDown, ChevronUp, Eye, EyeOff, Archive, Trash2
} from 'lucide-react';

interface SystemAlert {
  id: string;
  type: 'error' | 'warning' | 'info' | 'success';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  source: string;
  category: 'system' | 'performance' | 'security' | 'business' | 'integration';
  timestamp: string;
  acknowledged: boolean;
  resolved: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  metadata?: Record<string, any>;
  actions?: Array<{
    type: string;
    label: string;
    url?: string;
    handler?: () => void;
  }>;
}

interface AlertRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  conditions: {
    metric: string;
    operator: '>' | '<' | '=' | '>=' | '<=';
    threshold: number;
    duration: number; // minutes
  };
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  actions: Array<{
    type: 'email' | 'slack' | 'webhook' | 'dashboard';
    target: string;
    template?: string;
  }>;
  cooldown: number; // minutes
  lastTriggered?: string;
  triggerCount: number;
}

interface SystemAlertsProps {
  className?: string;
}

export default function SystemAlerts({ className = '' }: SystemAlertsProps) {
  const [alerts, setAlerts] = useState<SystemAlert[]>([
    {
      id: '1',
      type: 'error',
      severity: 'critical',
      title: 'Servidor de Base de Datos Caído',
      message: 'No se puede conectar a la base de datos principal. Verifique la conexión y el estado del servidor.',
      source: 'Database Monitor',
      category: 'system',
      timestamp: new Date(Date.now() - 300000).toISOString(),
      acknowledged: false,
      resolved: false,
      metadata: {
        database: 'postgresql-primary',
        connectionAttempts: 5,
        lastError: 'Connection timeout'
      },
      actions: [
        { type: 'dashboard', label: 'Ver Logs', url: '/monitoring/logs' },
        { type: 'dashboard', label: 'Reiniciar Servicio', url: '/admin/services' }
      ]
    },
    {
      id: '2',
      type: 'warning',
      severity: 'medium',
      title: 'Alto Uso de Memoria',
      message: 'El uso de memoria en el servidor API es del 85%. Considere escalar o reiniciar servicios.',
      source: 'Performance Monitor',
      category: 'performance',
      timestamp: new Date(Date.now() - 600000).toISOString(),
      acknowledged: true,
      acknowledgedBy: 'admin@sgi360.com',
      acknowledgedAt: new Date(Date.now() - 300000).toISOString(),
      resolved: false,
      metadata: {
        server: 'api-server-01',
        memoryUsage: 85,
        threshold: 80
      }
    },
    {
      id: '3',
      type: 'info',
      severity: 'low',
      title: 'Backup Completado',
      message: 'El backup diario de la base de datos se ha completado exitosamente.',
      source: 'Backup Service',
      category: 'system',
      timestamp: new Date(Date.now() - 1800000).toISOString(),
      acknowledged: true,
      resolved: true,
      resolvedBy: 'system',
      resolvedAt: new Date(Date.now() - 1700000).toISOString(),
      metadata: {
        backupSize: '2.4GB',
        duration: '12m 34s',
        location: 's3://sgi360-backups/daily/'
      }
    },
    {
      id: '4',
      type: 'error',
      severity: 'high',
      title: 'Error en Integración con Slack',
      message: 'Falló el envío de notificaciones a Slack. Verifique la configuración del webhook.',
      source: 'Integration Service',
      category: 'integration',
      timestamp: new Date(Date.now() - 900000).toISOString(),
      acknowledged: false,
      resolved: false,
      metadata: {
        webhook: 'slack-webhook-01',
        error: 'HTTP 403 Forbidden',
        failedMessages: 3
      },
      actions: [
        { type: 'dashboard', label: 'Configurar Webhook', url: '/integraciones/slack' }
      ]
    },
    {
      id: '5',
      type: 'success',
      severity: 'low',
      title: 'Migración de Datos Completada',
      message: 'La migración de datos del tenant ABC Corp se ha completado exitosamente.',
      source: 'Migration Service',
      category: 'business',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      acknowledged: true,
      resolved: true,
      resolvedBy: 'system',
      resolvedAt: new Date(Date.now() - 3500000).toISOString(),
      metadata: {
        tenant: 'ABC Corp',
        recordsMigrated: 15420,
        duration: '2h 15m'
      }
    }
  ]);

  const [rules] = useState<AlertRule[]>([
    {
      id: 'rule-1',
      name: 'Database Connection Failure',
      description: 'Alerta cuando la base de datos no responde',
      enabled: true,
      conditions: {
        metric: 'database.connection.status',
        operator: '=',
        threshold: 0,
        duration: 2
      },
      severity: 'critical',
      category: 'system',
      actions: [
        { type: 'email', target: 'admin@sgi360.com' },
        { type: 'slack', target: '#alerts' }
      ],
      cooldown: 15,
      triggerCount: 1,
      lastTriggered: new Date(Date.now() - 300000).toISOString()
    },
    {
      id: 'rule-2',
      name: 'High Memory Usage',
      description: 'Alerta cuando el uso de memoria excede el 80%',
      enabled: true,
      conditions: {
        metric: 'system.memory.usage',
        operator: '>',
        threshold: 80,
        duration: 5
      },
      severity: 'medium',
      category: 'performance',
      actions: [
        { type: 'email', target: 'ops@sgi360.com' }
      ],
      cooldown: 30,
      triggerCount: 3
    }
  ]);

  const [filterType, setFilterType] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showRules, setShowRules] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<SystemAlert | null>(null);

  const filteredAlerts = alerts.filter(alert => {
    if (filterType !== 'all' && alert.type !== filterType) return false;
    if (filterSeverity !== 'all' && alert.severity !== filterSeverity) return false;
    if (filterCategory !== 'all' && alert.category !== filterCategory) return false;
    if (filterStatus !== 'all') {
      if (filterStatus === 'unresolved' && alert.resolved) return false;
      if (filterStatus === 'acknowledged' && !alert.acknowledged) return false;
      if (filterStatus === 'unacknowledged' && alert.acknowledged) return false;
    }
    if (searchQuery && !alert.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !alert.message.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'error': return <AlertCircle className="w-5 h-5" />;
      case 'warning': return <AlertTriangle className="w-5 h-5" />;
      case 'info': return <Info className="w-5 h-5" />;
      case 'success': return <CheckCircle className="w-5 h-5" />;
      default: return <Bell className="w-5 h-5" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'error': return 'text-red-600 bg-red-50 border-red-200';
      case 'warning': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'info': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'success': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-700 bg-red-100';
      case 'high': return 'text-orange-700 bg-orange-100';
      case 'medium': return 'text-yellow-700 bg-yellow-100';
      case 'low': return 'text-blue-700 bg-blue-100';
      default: return 'text-gray-700 bg-gray-100';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'system': return <Server className="w-4 h-4" />;
      case 'performance': return <TrendingUp className="w-4 h-4" />;
      case 'security': return <Zap className="w-4 h-4" />;
      case 'business': return <User className="w-4 h-4" />;
      case 'integration': return <Wifi className="w-4 h-4" />;
      default: return <Info className="w-4 h-4" />;
    }
  };

  const handleAcknowledge = (alertId: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId 
        ? { 
            ...alert, 
            acknowledged: true, 
            acknowledgedBy: 'current-user',
            acknowledgedAt: new Date().toISOString()
          }
        : alert
    ));
  };

  const handleResolve = (alertId: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId 
        ? { 
            ...alert, 
            resolved: true, 
            resolvedBy: 'current-user',
            resolvedAt: new Date().toISOString()
          }
        : alert
    ));
  };

  const criticalAlerts = alerts.filter(alert => 
    alert.severity === 'critical' && !alert.resolved
  ).length;

  const unresolvedAlerts = alerts.filter(alert => !alert.resolved).length;
  const unacknowledgedAlerts = alerts.filter(alert => !alert.acknowledged && !alert.resolved).length;

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-50 rounded-lg">
            <BellRing className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Alertas del Sistema</h3>
            <p className="text-sm text-gray-600">
              {unresolvedAlerts} sin resolver • {unacknowledgedAlerts} sin reconocer
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRules(!showRules)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Settings className="w-4 h-4" />
            Reglas
          </button>

          <button
            className="p-2 text-gray-600 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Critical Alerts Banner */}
      {criticalAlerts > 0 && (
        <div className="p-4 bg-red-50 border-b border-red-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <span className="font-medium text-red-900">
                {criticalAlerts} alertas críticas requieren atención inmediata
              </span>
            </div>
            <button
              onClick={() => setFilterSeverity('critical')}
              className="text-sm text-red-600 hover:text-red-700"
            >
              Ver alertas críticas
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Buscar alertas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 w-64"
            />
          </div>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5"
          >
            <option value="all">Todos los tipos</option>
            <option value="error">Error</option>
            <option value="warning">Advertencia</option>
            <option value="info">Info</option>
            <option value="success">Éxito</option>
          </select>

          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5"
          >
            <option value="all">Todas las severidades</option>
            <option value="critical">Crítica</option>
            <option value="high">Alta</option>
            <option value="medium">Media</option>
            <option value="low">Baja</option>
          </select>

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5"
          >
            <option value="all">Todas las categorías</option>
            <option value="system">Sistema</option>
            <option value="performance">Performance</option>
            <option value="security">Seguridad</option>
            <option value="business">Negocio</option>
            <option value="integration">Integración</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5"
          >
            <option value="all">Todos los estados</option>
            <option value="unresolved">Sin resolver</option>
            <option value="acknowledged">Reconocidas</option>
            <option value="unacknowledged">No reconocidas</option>
          </select>
        </div>
      </div>

      {/* Alert Rules (when shown) */}
      {showRules && (
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <h4 className="font-medium text-gray-900 mb-3">Reglas de Alerta</h4>
          <div className="space-y-2">
            {rules.map(rule => (
              <div key={rule.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${rule.enabled ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <div>
                    <div className="font-medium text-gray-900">{rule.name}</div>
                    <div className="text-sm text-gray-600">{rule.description}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getSeverityColor(rule.severity)}`}>
                    {rule.severity}
                  </span>
                  <span className="text-sm text-gray-600">
                    {rule.triggerCount} disparos
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alerts List */}
      <div className="p-4">
        {filteredAlerts.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <CheckCircle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-sm">No hay alertas que coincidan con los filtros</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAlerts.map(alert => (
              <div
                key={alert.id}
                className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                  alert.resolved ? 'border-gray-200 bg-gray-50 opacity-60' :
                  alert.acknowledged ? 'border-yellow-200 bg-yellow-50' :
                  'border-red-200 bg-red-50'
                }`}
                onClick={() => setSelectedAlert(alert)}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${getTypeColor(alert.type)}`}>
                    {getTypeIcon(alert.type)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900">{alert.title}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getSeverityColor(alert.severity)}`}>
                        {alert.severity}
                      </span>
                      {alert.acknowledged && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                          Reconocida
                        </span>
                      )}
                      {alert.resolved && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                          Resuelta
                        </span>
                      )}
                    </div>
                    
                    <p className="text-sm text-gray-600 mb-2">{alert.message}</p>
                    
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        {getCategoryIcon(alert.category)}
                        <span>{alert.source}</span>
                      </div>
                      <span>•</span>
                      <span>{new Date(alert.timestamp).toLocaleString()}</span>
                      {alert.acknowledgedBy && (
                        <>
                          <span>•</span>
                          <span>Reconocida por {alert.acknowledgedBy}</span>
                        </>
                      )}
                    </div>

                    {alert.actions && alert.actions.length > 0 && (
                      <div className="flex items-center gap-2 mt-3">
                        {alert.actions.map((action, index) => (
                          <button
                            key={index}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (action.handler) {
                                action.handler();
                              } else if (action.url) {
                                window.open(action.url, '_blank');
                              }
                            }}
                            className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-1">
                    {!alert.resolved && !alert.acknowledged && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAcknowledge(alert.id);
                        }}
                        className="p-1 text-blue-600 hover:text-blue-700"
                        title="Reconocer"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    )}
                    {!alert.resolved && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleResolve(alert.id);
                        }}
                        className="p-1 text-green-600 hover:text-green-700"
                        title="Resolver"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Alert Detail Modal */}
      {selectedAlert && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Detalle de Alerta</h3>
                <button
                  onClick={() => setSelectedAlert(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                {/* Alert Info */}
                <div className={`p-4 rounded-lg ${getTypeColor(selectedAlert.type)}`}>
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${getTypeColor(selectedAlert.type)}`}>
                      {getTypeIcon(selectedAlert.type)}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 mb-1">
                        {selectedAlert.title}
                      </div>
                      <p className="text-sm text-gray-600">{selectedAlert.message}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-500 mt-2">
                        <span>Fuente: {selectedAlert.source}</span>
                        <span>•</span>
                        <span>Categoría: {selectedAlert.category}</span>
                        <span>•</span>
                        <span>{new Date(selectedAlert.timestamp).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Metadata */}
                {selectedAlert.metadata && Object.keys(selectedAlert.metadata).length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Metadata</h4>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <pre className="text-sm text-gray-700">
                        {JSON.stringify(selectedAlert.metadata, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

                {/* Status Information */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Estado</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Reconocida:</span>
                      <span className={`font-medium ${selectedAlert.acknowledged ? 'text-green-600' : 'text-red-600'}`}>
                        {selectedAlert.acknowledged ? 'Sí' : 'No'}
                      </span>
                    </div>
                    {selectedAlert.acknowledgedBy && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Reconocida por:</span>
                        <span className="font-medium">{selectedAlert.acknowledgedBy}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Resuelta:</span>
                      <span className={`font-medium ${selectedAlert.resolved ? 'text-green-600' : 'text-red-600'}`}>
                        {selectedAlert.resolved ? 'Sí' : 'No'}
                      </span>
                    </div>
                    {selectedAlert.resolvedBy && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Resuelta por:</span>
                        <span className="font-medium">{selectedAlert.resolvedBy}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
                  {!selectedAlert.resolved && !selectedAlert.acknowledged && (
                    <button
                      onClick={() => {
                        handleAcknowledge(selectedAlert.id);
                        setSelectedAlert(null);
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      <Eye className="w-4 h-4" />
                      Reconocer
                    </button>
                  )}
                  {!selectedAlert.resolved && (
                    <button
                      onClick={() => {
                        handleResolve(selectedAlert.id);
                        setSelectedAlert(null);
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Resolver
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedAlert(null)}
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
    </div>
  );
}
