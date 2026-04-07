'use client';

import React, { useState, useEffect } from 'react';
import {
  AlertTriangle, TrendingUp, TrendingDown, Target, Clock,
  Bell, BellRing, CheckCircle2, AlertCircle, Info,
  ChevronDown, ChevronUp, X, Settings, RefreshCw
} from 'lucide-react';

interface AlertRule {
  id: string;
  name: string;
  description: string;
  type: 'threshold' | 'trend' | 'anomaly' | 'target';
  metric: string;
  condition: 'above' | 'below' | 'increasing' | 'decreasing' | 'not_met';
  threshold?: number;
  trendPeriod?: number;
  trendPercent?: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  category: 'quality' | 'safety' | 'environment' | 'customer' | 'financial';
}

interface Alert {
  id: string;
  ruleId: string;
  ruleName: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  metric: string;
  currentValue: number;
  threshold?: number;
  trend?: string;
  category: string;
  timestamp: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  resolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  actionRequired: boolean;
  suggestedActions?: string[];
}

interface SmartAlertsProps {
  alerts: Alert[];
  rules: AlertRule[];
  onAcknowledge?: (alertId: string) => void;
  onResolve?: (alertId: string) => void;
  onDismiss?: (alertId: string) => void;
  onRefresh?: () => void;
  className?: string;
}

const SEVERITY_CONFIG = {
  low: { color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', icon: Info },
  medium: { color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200', icon: AlertCircle },
  high: { color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', icon: AlertTriangle },
  critical: { color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', icon: BellRing }
};

const CATEGORY_COLORS = {
  quality: '#3B82F6',
  safety: '#EF4444',
  environment: '#10B981',
  customer: '#8B5CF6',
  financial: '#F59E0B'
};

export default function SmartAlerts({
  alerts,
  rules,
  onAcknowledge,
  onResolve,
  onDismiss,
  onRefresh,
  className = ''
}: SmartAlertsProps) {
  const [expanded, setExpanded] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const activeAlerts = alerts.filter(alert => !alert.resolved);
  const acknowledgedAlerts = alerts.filter(alert => alert.acknowledged && !alert.resolved);
  const unacknowledgedAlerts = alerts.filter(alert => !alert.acknowledged && !alert.resolved);

  const filteredAlerts = activeAlerts.filter(alert => {
    if (filterSeverity !== 'all' && alert.severity !== filterSeverity) return false;
    if (filterCategory !== 'all' && alert.category !== filterCategory) return false;
    return true;
  });

  const getAlertCount = (severity?: string, category?: string) => {
    return activeAlerts.filter(alert => {
      if (severity && alert.severity !== severity) return false;
      if (category && alert.category !== category) return false;
      return true;
    }).length;
  };

  const handleAcknowledge = (alertId: string) => {
    onAcknowledge?.(alertId);
  };

  const handleResolve = (alertId: string) => {
    onResolve?.(alertId);
    setSelectedAlert(null);
  };

  const getSeverityStats = () => {
    return {
      critical: getAlertCount('critical'),
      high: getAlertCount('high'),
      medium: getAlertCount('medium'),
      low: getAlertCount('low')
    };
  };

  const getCategoryStats = () => {
    return Object.keys(CATEGORY_COLORS).reduce((stats, category) => {
      stats[category] = getAlertCount(undefined, category);
      return stats;
    }, {} as Record<string, number>);
  };

  const severityStats = getSeverityStats();
  const categoryStats = getCategoryStats();
  const totalActive = Object.values(severityStats).reduce((sum, count) => sum + count, 0);

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Bell className="w-5 h-5 text-gray-600" />
            {totalActive > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-4 w-4 flex items-center justify-center">
                {totalActive}
              </span>
            )}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Alertas Inteligentes</h3>
            <p className="text-sm text-gray-600">
              {totalActive} alertas activas
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Filters */}
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-2 py-1"
          >
            <option value="all">Todas las severidades</option>
            <option value="critical">Críticas</option>
            <option value="high">Altas</option>
            <option value="medium">Medias</option>
            <option value="low">Bajas</option>
          </select>
          
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-2 py-1"
          >
            <option value="all">Todas las categorías</option>
            <option value="quality">Calidad</option>
            <option value="safety">Seguridad</option>
            <option value="environment">Ambiente</option>
            <option value="customer">Cliente</option>
            <option value="financial">Financiero</option>
          </select>

          {/* Actions */}
          <button
            onClick={() => setShowRules(!showRules)}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
          >
            <Settings className="w-4 h-4" />
          </button>
          
          <button
            onClick={onRefresh}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="p-4 bg-gray-50 border-b border-gray-200">
        <div className="grid grid-cols-5 gap-4">
          {/* Severity Distribution */}
          <div className="col-span-2">
            <div className="text-sm font-medium text-gray-700 mb-2">Por Severidad</div>
            <div className="space-y-1">
              {Object.entries(severityStats).map(([severity, count]) => {
                const config = SEVERITY_CONFIG[severity as keyof typeof SEVERITY_CONFIG];
                const Icon = config.icon;
                return (
                  <div key={severity} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className={`w-3 h-3 ${config.color}`} />
                      <span className="text-xs text-gray-600 capitalize">{severity}</span>
                    </div>
                    <span className="text-xs font-medium text-gray-900">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Category Distribution */}
          <div className="col-span-2">
            <div className="text-sm font-medium text-gray-700 mb-2">Por Categoría</div>
            <div className="space-y-1">
              {Object.entries(categoryStats).map(([category, count]) => (
                <div key={category} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: CATEGORY_COLORS[category as keyof typeof CATEGORY_COLORS] }}
                    />
                    <span className="text-xs text-gray-600 capitalize">{category}</span>
                  </div>
                  <span className="text-xs font-medium text-gray-900">{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div>
            <div className="text-sm font-medium text-gray-700 mb-2">Resumen</div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-600">Sin reconocer:</span>
                <span className="font-medium text-orange-600">{unacknowledgedAlerts.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Reconocidas:</span>
                <span className="font-medium text-blue-600">{acknowledgedAlerts.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Acción req.:</span>
                <span className="font-medium text-red-600">
                  {activeAlerts.filter(a => a.actionRequired).length}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Alert Rules */}
      {showRules && (
        <div className="p-4 bg-blue-50 border-b border-blue-200">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-blue-900">Reglas de Alerta Activas</h4>
            <button
              onClick={() => setShowRules(false)}
              className="text-blue-600 hover:text-blue-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2">
            {rules.filter(rule => rule.enabled).map(rule => (
              <div key={rule.id} className="flex items-center justify-between p-2 bg-white rounded border border-blue-200">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full`} style={{ backgroundColor: CATEGORY_COLORS[rule.category] }} />
                  <span className="text-sm font-medium text-gray-900">{rule.name}</span>
                  <span className="text-xs text-gray-600">{rule.metric}</span>
                </div>
                <div className={`px-2 py-1 rounded text-xs font-medium ${SEVERITY_CONFIG[rule.severity].bg} ${SEVERITY_CONFIG[rule.severity].color}`}>
                  {rule.severity}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alerts List */}
      {expanded && (
        <div className="max-h-96 overflow-y-auto">
          {filteredAlerts.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Bell className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="text-sm">No hay alertas activas</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredAlerts.map(alert => {
                const config = SEVERITY_CONFIG[alert.severity];
                const Icon = config.icon;
                
                return (
                  <div
                    key={alert.id}
                    className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                      alert.acknowledged ? 'opacity-60' : ''
                    }`}
                    onClick={() => setSelectedAlert(alert)}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${config.bg}`}>
                        <Icon className={`w-4 h-4 ${config.color}`} />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-gray-900">{alert.ruleName}</span>
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${config.bg} ${config.color}`}>
                                {alert.severity}
                              </span>
                              {alert.actionRequired && (
                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                                  Acción req.
                                </span>
                              )}
                              {alert.acknowledged && (
                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                                  Reconocida
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 mb-2">{alert.message}</p>
                            
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <span>Métrica: {alert.metric}</span>
                              <span>Valor: {alert.currentValue}</span>
                              {alert.threshold && <span>Umbral: {alert.threshold}</span>}
                              <span>{new Date(alert.timestamp).toLocaleString()}</span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1">
                            {!alert.acknowledged && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAcknowledge(alert.id);
                                }}
                                className="p-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded"
                                title="Reconocer alerta"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleResolve(alert.id);
                              }}
                              className="p-1 text-green-600 hover:text-green-700 hover:bg-green-50 rounded"
                              title="Resolver alerta"
                            >
                              <Target className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onDismiss?.(alert.id);
                              }}
                              className="p-1 text-gray-600 hover:text-gray-700 hover:bg-gray-50 rounded"
                              title="Descartar"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

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
                <div className={`p-4 rounded-lg ${SEVERITY_CONFIG[selectedAlert.severity].bg} ${SEVERITY_CONFIG[selectedAlert.severity].border}`}>
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${SEVERITY_CONFIG[selectedAlert.severity].bg}`}>
                      {React.createElement(SEVERITY_CONFIG[selectedAlert.severity].icon, { 
                        className: `w-5 h-5 ${SEVERITY_CONFIG[selectedAlert.severity].color}` 
                      })}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 mb-1">{selectedAlert.ruleName}</div>
                      <p className="text-sm text-gray-600">{selectedAlert.message}</p>
                    </div>
                  </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Métricas</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Métrica:</span>
                        <span className="font-medium">{selectedAlert.metric}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Valor Actual:</span>
                        <span className="font-medium">{selectedAlert.currentValue}</span>
                      </div>
                      {selectedAlert.threshold && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Umbral:</span>
                          <span className="font-medium">{selectedAlert.threshold}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-gray-600">Categoría:</span>
                        <span className="font-medium capitalize">{selectedAlert.category}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Estado</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Severidad:</span>
                        <span className={`font-medium capitalize ${SEVERITY_CONFIG[selectedAlert.severity].color}`}>
                          {selectedAlert.severity}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Reconocida:</span>
                        <span className={`font-medium ${selectedAlert.acknowledged ? 'text-green-600' : 'text-orange-600'}`}>
                          {selectedAlert.acknowledged ? 'Sí' : 'No'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Fecha:</span>
                        <span className="font-medium">
                          {new Date(selectedAlert.timestamp).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Suggested Actions */}
                {selectedAlert.suggestedActions && selectedAlert.suggestedActions.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Acciones Sugeridas</h4>
                    <ul className="space-y-1 text-sm text-gray-600">
                      {selectedAlert.suggestedActions.map((action, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="text-blue-600 mt-0.5">•</span>
                          <span>{action}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
                  {!selectedAlert.acknowledged && (
                    <button
                      onClick={() => handleAcknowledge(selectedAlert.id)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Reconocer
                    </button>
                  )}
                  <button
                    onClick={() => handleResolve(selectedAlert.id)}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    <Target className="w-4 h-4" />
                    Resolver
                  </button>
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
