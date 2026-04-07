'use client';

import React, { useState, useEffect } from 'react';
import {
  Activity, AlertTriangle, CheckCircle, Clock, Server, Database,
  Users, Globe, Zap, TrendingUp, TrendingDown, RefreshCw,
  Download, Filter, Calendar, BarChart3, LineChart, PieChart,
  Monitor, Wifi, HardDrive, Cpu, AlertCircle, Info, Minus
} from 'lucide-react';

interface SystemMetrics {
  timestamp: string;
  uptime: number;
  responseTime: number;
  errorRate: number;
  activeUsers: number;
  requestsPerSecond: number;
  memoryUsage: number;
  cpuUsage: number;
  diskUsage: number;
  networkLatency: number;
}

interface Alert {
  id: string;
  type: 'error' | 'warning' | 'info';
  message: string;
  timestamp: string;
  resolved: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  responseTime: number;
  uptime: number;
  lastCheck: string;
  errorRate: number;
}

interface MonitoringDashboardProps {
  className?: string;
}

export default function MonitoringDashboard({ className = '' }: MonitoringDashboardProps) {
  const [metrics, setMetrics] = useState<SystemMetrics>({
    timestamp: new Date().toISOString(),
    uptime: 99.9,
    responseTime: 120,
    errorRate: 0.5,
    activeUsers: 45,
    requestsPerSecond: 12.5,
    memoryUsage: 65,
    cpuUsage: 45,
    diskUsage: 78,
    networkLatency: 25
  });

  const [alerts, setAlerts] = useState<Alert[]>([
    {
      id: '1',
      type: 'warning',
      message: 'High memory usage detected on API server',
      timestamp: new Date(Date.now() - 300000).toISOString(),
      resolved: false,
      severity: 'medium'
    },
    {
      id: '2',
      type: 'error',
      message: 'Database connection timeout',
      timestamp: new Date(Date.now() - 600000).toISOString(),
      resolved: true,
      severity: 'high'
    },
    {
      id: '3',
      type: 'info',
      message: 'Scheduled maintenance completed successfully',
      timestamp: new Date(Date.now() - 1800000).toISOString(),
      resolved: true,
      severity: 'low'
    }
  ]);

  const [services] = useState<ServiceHealth[]>([
    {
      name: 'API Server',
      status: 'healthy',
      responseTime: 120,
      uptime: 99.9,
      lastCheck: new Date().toISOString(),
      errorRate: 0.2
    },
    {
      name: 'Database',
      status: 'healthy',
      responseTime: 45,
      uptime: 99.95,
      lastCheck: new Date().toISOString(),
      errorRate: 0.1
    },
    {
      name: 'Redis Cache',
      status: 'degraded',
      responseTime: 15,
      uptime: 98.5,
      lastCheck: new Date().toISOString(),
      errorRate: 1.5
    },
    {
      name: 'File Storage',
      status: 'healthy',
      responseTime: 200,
      uptime: 99.8,
      lastCheck: new Date().toISOString(),
      errorRate: 0.3
    }
  ]);

  const [selectedTimeRange, setSelectedTimeRange] = useState('1h');
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      // Simulate real-time updates
      setMetrics(prev => ({
        ...prev,
        timestamp: new Date().toISOString(),
        responseTime: Math.max(50, prev.responseTime + (Math.random() - 0.5) * 20),
        activeUsers: Math.max(1, prev.activeUsers + Math.floor((Math.random() - 0.5) * 5)),
        requestsPerSecond: Math.max(0, prev.requestsPerSecond + (Math.random() - 0.5) * 2),
        memoryUsage: Math.min(100, Math.max(0, prev.memoryUsage + (Math.random() - 0.5) * 5)),
        cpuUsage: Math.min(100, Math.max(0, prev.cpuUsage + (Math.random() - 0.5) * 8))
      }));
    }, 5000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-50';
      case 'degraded': return 'text-yellow-600 bg-yellow-50';
      case 'down': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-50';
      case 'high': return 'text-orange-600 bg-orange-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'low': return 'text-blue-600 bg-blue-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'error': return <AlertCircle className="w-4 h-4" />;
      case 'warning': return <AlertTriangle className="w-4 h-4" />;
      case 'info': return <Info className="w-4 h-4" />;
      default: return <Info className="w-4 h-4" />;
    }
  };

  const getTrendIcon = (current: number, previous: number) => {
    if (current > previous) return <TrendingUp className="w-4 h-4 text-red-600" />;
    if (current < previous) return <TrendingDown className="w-4 h-4 text-green-600" />;
    return <Minus className="w-4 h-4 text-gray-600" />;
  };

  const exportReport = () => {
    const report = {
      timestamp: new Date().toISOString(),
      metrics,
      alerts,
      services,
      timeRange: selectedTimeRange
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `monitoring-report-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const unresolvedAlerts = alerts.filter(alert => !alert.resolved);
  const criticalAlerts = unresolvedAlerts.filter(alert => alert.severity === 'critical');
  const healthyServices = services.filter(service => service.status === 'healthy').length;

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-50 rounded-lg">
            <Monitor className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Dashboard de Monitoreo</h3>
            <p className="text-sm text-gray-600">
              Sistema en tiempo real
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Time Range Selector */}
          <select
            value={selectedTimeRange}
            onChange={(e) => setSelectedTimeRange(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-2 py-1"
          >
            <option value="5m">Últimos 5 min</option>
            <option value="15m">Últimos 15 min</option>
            <option value="1h">Última hora</option>
            <option value="6h">Últimas 6 horas</option>
            <option value="24h">Últimas 24 horas</option>
          </select>

          {/* Auto Refresh Toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${
              autoRefresh 
                ? 'bg-green-100 text-green-700' 
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
            Auto Refresh
          </button>

          {/* Export */}
          <button
            onClick={exportReport}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          >
            <Download className="w-4 h-4" />
            Exportar
          </button>
        </div>
      </div>

      {/* Critical Alerts */}
      {criticalAlerts.length > 0 && (
        <div className="p-4 bg-red-50 border-b border-red-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <span className="font-medium text-red-900">
              {criticalAlerts.length} alertas críticas requieren atención
            </span>
          </div>
        </div>
      )}

      {/* Key Metrics */}
      <div className="p-4 border-b border-gray-200">
        <h4 className="font-medium text-gray-900 mb-3">Métricas Clave</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{metrics.uptime.toFixed(1)}%</div>
            <div className="text-sm text-gray-600">Uptime</div>
            <div className="flex items-center justify-center mt-1">
              {getTrendIcon(metrics.uptime, 99.5)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{metrics.responseTime.toFixed(0)}ms</div>
            <div className="text-sm text-gray-600">Response Time</div>
            <div className="flex items-center justify-center mt-1">
              {getTrendIcon(metrics.responseTime, 100)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{metrics.activeUsers}</div>
            <div className="text-sm text-gray-600">Usuarios Activos</div>
            <div className="flex items-center justify-center mt-1">
              {getTrendIcon(metrics.activeUsers, 40)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{metrics.requestsPerSecond.toFixed(1)}</div>
            <div className="text-sm text-gray-600">Req/Segundo</div>
            <div className="flex items-center justify-center mt-1">
              {getTrendIcon(metrics.requestsPerSecond, 10)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{metrics.errorRate.toFixed(1)}%</div>
            <div className="text-sm text-gray-600">Error Rate</div>
            <div className="flex items-center justify-center mt-1">
              {getTrendIcon(metrics.errorRate, 0.5)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-teal-600">{unresolvedAlerts.length}</div>
            <div className="text-sm text-gray-600">Alertas Activas</div>
            <div className="flex items-center justify-center mt-1">
              {unresolvedAlerts.length > 0 && <AlertTriangle className="w-4 h-4 text-orange-600" />}
            </div>
          </div>
        </div>
      </div>

      {/* System Resources */}
      <div className="p-4 border-b border-gray-200">
        <h4 className="font-medium text-gray-900 mb-3">Recursos del Sistema</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Memory */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <HardDrive className="w-4 h-4 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">Memoria</span>
              <span className="ml-auto text-sm text-gray-600">{metrics.memoryUsage.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full ${
                  metrics.memoryUsage > 80 ? 'bg-red-500' :
                  metrics.memoryUsage > 60 ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                style={{ width: `${metrics.memoryUsage}%` }}
              />
            </div>
          </div>

          {/* CPU */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Cpu className="w-4 h-4 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">CPU</span>
              <span className="ml-auto text-sm text-gray-600">{metrics.cpuUsage.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full ${
                  metrics.cpuUsage > 80 ? 'bg-red-500' :
                  metrics.cpuUsage > 60 ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                style={{ width: `${metrics.cpuUsage}%` }}
              />
            </div>
          </div>

          {/* Disk */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Database className="w-4 h-4 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">Disco</span>
              <span className="ml-auto text-sm text-gray-600">{metrics.diskUsage.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full ${
                  metrics.diskUsage > 80 ? 'bg-red-500' :
                  metrics.diskUsage > 60 ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                style={{ width: `${metrics.diskUsage}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Services Health */}
      <div className="p-4 border-b border-gray-200">
        <h4 className="font-medium text-gray-900 mb-3">Estado de Servicios</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {services.map(service => (
            <div key={service.name} className="p-3 border border-gray-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-900">{service.name}</span>
                <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(service.status)}`}>
                  {service.status === 'healthy' ? 'Sano' : 
                   service.status === 'degraded' ? 'Degradado' : 'Caído'}
                </span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-600">Response:</span>
                  <span className="font-medium">{service.responseTime}ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Uptime:</span>
                  <span className="font-medium">{service.uptime.toFixed(2)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Error Rate:</span>
                  <span className="font-medium">{service.errorRate.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Alerts */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium text-gray-900">Alertas Recientes</h4>
          <span className="text-sm text-gray-600">
            {unresolvedAlerts.length} sin resolver
          </span>
        </div>
        
        {alerts.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <CheckCircle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-sm">No hay alertas recientes</p>
          </div>
        ) : (
          <div className="space-y-2">
            {alerts.slice(0, 5).map(alert => (
              <div key={alert.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <div className={`p-2 rounded-lg ${getSeverityColor(alert.severity)}`}>
                  {getAlertIcon(alert.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getSeverityColor(alert.severity)}`}>
                      {alert.severity}
                    </span>
                    {alert.resolved && (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                        Resuelta
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-900">{alert.message}</p>
                  <p className="text-xs text-gray-600 mt-1">
                    {new Date(alert.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
