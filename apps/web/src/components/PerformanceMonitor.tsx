'use client';

import React, { useState, useEffect } from 'react';
import { usePerformanceMonitor } from '@/lib/performance';
import {
  Activity, AlertTriangle, CheckCircle, Clock, Cpu, Wifi,
  HardDrive, TrendingUp, TrendingDown, Minus, RefreshCw,
  Download, Eye, EyeOff, BarChart3
} from 'lucide-react';

interface PerformanceMonitorProps {
  showDetails?: boolean;
  className?: string;
}

export default function PerformanceMonitor({ 
  showDetails = false, 
  className = '' 
}: PerformanceMonitorProps) {
  const { metrics, systemMetrics, report, trackInteraction } = usePerformanceMonitor();
  const [isVisible, setIsVisible] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const getScoreColor = (value: number, good: number, poor: number) => {
    if (value <= good) return 'text-green-600';
    if (value <= poor) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreIcon = (value: number, good: number, poor: number) => {
    if (value <= good) return <CheckCircle className="w-4 h-4 text-green-600" />;
    if (value <= poor) return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
    return <AlertTriangle className="w-4 h-4 text-red-600" />;
  };

  const getScoreLabel = (value: number, good: number, poor: number) => {
    if (value <= good) return 'Bueno';
    if (value <= poor) return 'Mejorable';
    return 'Pobre';
  };

  const getMemoryUsage = () => {
    if (systemMetrics.memory.total === 0) return 0;
    return (systemMetrics.memory.used / systemMetrics.memory.total) * 100;
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 MB';
    const mb = bytes / 1024 / 1024;
    return `${mb.toFixed(1)} MB`;
  };

  const downloadReport = () => {
    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `performance-report-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isVisible && !showDetails) {
    return (
      <div className={`fixed bottom-4 right-4 z-50 ${className}`}>
        <button
          onClick={() => setIsVisible(true)}
          className="flex items-center gap-2 px-3 py-2 bg-gray-900 text-white rounded-lg shadow-lg hover:bg-gray-800 transition-colors"
        >
          <Activity className="w-4 h-4" />
          <span className="text-sm">Performance</span>
        </button>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 shadow-lg ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-lg">
            <Activity className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Monitor de Performance</h3>
            <p className="text-sm text-gray-600">
              Core Web Vitals y métricas del sistema
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 text-gray-600 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            {isExpanded ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          
          <button
            onClick={downloadReport}
            className="p-2 text-gray-600 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            title="Descargar reporte"
          >
            <Download className="w-4 h-4" />
          </button>
          
          {!showDetails && (
            <button
              onClick={() => setIsVisible(false)}
              className="p-2 text-gray-600 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Core Web Vitals */}
      <div className="p-4 space-y-4">
        <div>
          <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Core Web Vitals
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* CLS */}
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">CLS</span>
                {getScoreIcon(metrics.cls, 0.1, 0.25)}
              </div>
              <div className={`text-lg font-bold ${getScoreColor(metrics.cls, 0.1, 0.25)}`}>
                {metrics.cls.toFixed(3)}
              </div>
              <div className="text-xs text-gray-600">
                {getScoreLabel(metrics.cls, 0.1, 0.25)}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Layout Shift
              </div>
            </div>

            {/* FID */}
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">FID</span>
                {getScoreIcon(metrics.fid, 100, 300)}
              </div>
              <div className={`text-lg font-bold ${getScoreColor(metrics.fid, 100, 300)}`}>
                {metrics.fid.toFixed(0)}ms
              </div>
              <div className="text-xs text-gray-600">
                {getScoreLabel(metrics.fid, 100, 300)}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Input Delay
              </div>
            </div>

            {/* FCP */}
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">FCP</span>
                {getScoreIcon(metrics.fcp, 1800, 3000)}
              </div>
              <div className={`text-lg font-bold ${getScoreColor(metrics.fcp, 1800, 3000)}`}>
                {metrics.fcp.toFixed(0)}ms
              </div>
              <div className="text-xs text-gray-600">
                {getScoreLabel(metrics.fcp, 1800, 3000)}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                First Paint
              </div>
            </div>

            {/* LCP */}
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">LCP</span>
                {getScoreIcon(metrics.lcp, 2500, 4000)}
              </div>
              <div className={`text-lg font-bold ${getScoreColor(metrics.lcp, 2500, 4000)}`}>
                {metrics.lcp.toFixed(0)}ms
              </div>
              <div className="text-xs text-gray-600">
                {getScoreLabel(metrics.lcp, 2500, 4000)}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Largest Paint
              </div>
            </div>

            {/* TTFB */}
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">TTFB</span>
                {getScoreIcon(metrics.ttfb, 800, 1800)}
              </div>
              <div className={`text-lg font-bold ${getScoreColor(metrics.ttfb, 800, 1800)}`}>
                {metrics.ttfb.toFixed(0)}ms
              </div>
              <div className="text-xs text-gray-600">
                {getScoreLabel(metrics.ttfb, 800, 1800)}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                First Byte
              </div>
            </div>
          </div>
        </div>

        {/* System Metrics (Expanded) */}
        {isExpanded && (
          <div className="border-t border-gray-200 pt-4">
            <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
              <Cpu className="w-4 h-4" />
              Métricas del Sistema
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Memory */}
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <HardDrive className="w-4 h-4 text-gray-600" />
                  <span className="text-sm font-medium text-gray-700">Memoria</span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Usada:</span>
                    <span className="font-medium">{formatBytes(systemMetrics.memory.used)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Total:</span>
                    <span className="font-medium">{formatBytes(systemMetrics.memory.total)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Uso:</span>
                    <span className={`font-medium ${getScoreColor(getMemoryUsage(), 70, 90)}`}>
                      {getMemoryUsage().toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Network */}
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Wifi className="w-4 h-4 text-gray-600" />
                  <span className="text-sm font-medium text-gray-700">Red</span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Tipo:</span>
                    <span className="font-medium">{systemMetrics.network.effectiveType}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Velocidad:</span>
                    <span className="font-medium">{systemMetrics.network.downlink} Mbps</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">RTT:</span>
                    <span className="font-medium">{systemMetrics.network.rtt}ms</span>
                  </div>
                </div>
              </div>

              {/* CPU */}
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Cpu className="w-4 h-4 text-gray-600" />
                  <span className="text-sm font-medium text-gray-700">CPU</span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Núcleos:</span>
                    <span className="font-medium">{systemMetrics.cpu.cores}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Arquitectura:</span>
                    <span className="font-medium">{systemMetrics.cpu.architecture}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Performance Score */}
        <div className="border-t border-gray-200 pt-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900">Score General</h4>
              <p className="text-sm text-gray-600">Basado en Core Web Vitals</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-blue-600">
                {(() => {
                  const scores = [
                    metrics.cls <= 0.1 ? 1 : metrics.cls <= 0.25 ? 0.5 : 0,
                    metrics.fid <= 100 ? 1 : metrics.fid <= 300 ? 0.5 : 0,
                    metrics.fcp <= 1800 ? 1 : metrics.fcp <= 3000 ? 0.5 : 0,
                    metrics.lcp <= 2500 ? 1 : metrics.lcp <= 4000 ? 0.5 : 0,
                    metrics.ttfb <= 800 ? 1 : metrics.ttfb <= 1800 ? 0.5 : 0
                  ];
                  const average = scores.reduce((a, b) => a + b, 0) / scores.length;
                  return (average * 100).toFixed(0);
                })()}%
              </div>
              <p className="text-sm text-gray-600">Performance Score</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
