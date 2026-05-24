'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import {
  Cpu, AlertTriangle, CheckCircle, XCircle, AlertCircle,
  RefreshCw, Users, Truck, DollarSign, FileText, Briefcase,
  ArrowRight, Shield, Clock, Zap
} from 'lucide-react';

interface RelationalAlert {
  type: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  message: string;
  details: any;
  action: string;
}

interface RelationalCheck {
  projectId: string;
  checkedAt: string;
  summary: {
    totalAlerts: number;
    highSeverity: number;
    mediumSeverity: number;
    lowSeverity: number;
    canProceed: boolean;
  };
  alerts: RelationalAlert[];
  missingResources: any[];
  incompatibilities: any[];
  capacityGaps: any[];
  recommendations: string[];
  relatedModules: string[];
}

interface Props {
  projectId: string;
}

const TYPE_ICONS: Record<string, any> = {
  FLOTA: Truck,
  RRHH: Users,
  FINANCIERO: DollarSign,
  PRESUPUESTO: DollarSign,
  LEGAL: FileText,
  ASIGNACION: Briefcase,
  SIMULACION: Zap,
  VIABILIDAD: Shield,
  DIMENSIONAMIENTO: Cpu,
};

const TYPE_COLORS: Record<string, string> = {
  FLOTA: 'bg-amber-100 text-amber-700',
  RRHH: 'bg-blue-100 text-blue-700',
  FINANCIERO: 'bg-emerald-100 text-emerald-700',
  PRESUPUESTO: 'bg-red-100 text-red-700',
  LEGAL: 'bg-purple-100 text-purple-700',
  ASIGNACION: 'bg-indigo-100 text-indigo-700',
  SIMULACION: 'bg-cyan-100 text-cyan-700',
  VIABILIDAD: 'bg-pink-100 text-pink-700',
  DIMENSIONAMIENTO: 'bg-gray-100 text-gray-700',
};

const SEVERITY_CONFIG = {
  HIGH: { icon: XCircle, color: 'bg-red-50 border-red-300 text-red-800', label: 'ALTA' },
  MEDIUM: { icon: AlertTriangle, color: 'bg-amber-50 border-amber-300 text-amber-800', label: 'MEDIA' },
  LOW: { icon: AlertCircle, color: 'bg-blue-50 border-blue-300 text-blue-800', label: 'BAJA' },
};

export default function MotorRelacionalTab({ projectId }: Props) {
  const [check, setCheck] = useState<RelationalCheck | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  const load = useCallback(async () => {
    setChecking(true);
    try {
      const res = await apiFetch(`/project360/projects/${projectId}/relational-check`) as RelationalCheck;
      setCheck(res);
    } catch (e: any) {
      console.error(e);
      alert('Error: ' + e.message);
    }
    setChecking(false);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="p-8 text-center text-gray-500">Cargando análisis relacional...</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Motor Relacional Enterprise</h2>
          <p className="text-sm text-gray-500">Detección automática de faltantes, riesgos e incompatibilidades entre módulos</p>
        </div>
        <button
          onClick={load}
          disabled={checking}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center gap-2 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} /> 
          {checking ? 'Analizando...' : 'Ejecutar Análisis'}
        </button>
      </div>

      {/* Status Banner */}
      {check?.summary && (
        <div className={`rounded-xl border p-4 flex items-center gap-4 ${
          check.summary.canProceed 
            ? 'bg-emerald-50 border-emerald-200' 
            : 'bg-red-50 border-red-200'
        }`}>
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
            check.summary.canProceed ? 'bg-emerald-100' : 'bg-red-100'
          }`}>
            {check.summary.canProceed ? (
              <CheckCircle className="w-6 h-6 text-emerald-600" />
            ) : (
              <XCircle className="w-6 h-6 text-red-600" />
            )}
          </div>
          <div>
            <h3 className={`font-semibold ${check.summary.canProceed ? 'text-emerald-900' : 'text-red-900'}`}>
              {check.summary.canProceed ? 'Proyecto Listo para Avanzar' : 'Bloqueos Detectados'}
            </h3>
            <p className={`text-sm ${check.summary.canProceed ? 'text-emerald-700' : 'text-red-700'}`}>
              {check.summary.totalAlerts === 0 
                ? 'No se detectaron problemas entre módulos' 
                : `${check.summary.totalAlerts} alertas encontradas (${check.summary.highSeverity} alta prioridad)`}
            </p>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      {check?.summary && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border p-4">
            <div className="text-2xl font-bold text-gray-900">{check.summary.totalAlerts}</div>
            <div className="text-xs text-gray-500">Total Alertas</div>
          </div>
          <div className="bg-red-50 rounded-xl border border-red-200 p-4">
            <div className="text-2xl font-bold text-red-600">{check.summary.highSeverity}</div>
            <div className="text-xs text-red-600">Alta Prioridad</div>
          </div>
          <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
            <div className="text-2xl font-bold text-amber-600">{check.summary.mediumSeverity}</div>
            <div className="text-xs text-amber-600">Media Prioridad</div>
          </div>
          <div className="bg-blue-50 rounded-xl border border-blue-200 p-4">
            <div className="text-2xl font-bold text-blue-600">{check.summary.lowSeverity}</div>
            <div className="text-xs text-blue-600">Baja Prioridad</div>
          </div>
        </div>
      )}

      {/* Alerts by Severity */}
      {check?.alerts && check.alerts.length > 0 && (
        <div className="space-y-4">
          {/* HIGH Priority */}
          {check.alerts.filter(a => a.severity === 'HIGH').length > 0 && (
            <div>
              <h3 className="font-semibold text-red-900 mb-3 flex items-center gap-2">
                <XCircle className="w-5 h-5" /> Alta Prioridad - Requiere Acción Inmediata
              </h3>
              <div className="space-y-3">
                {check.alerts.filter(a => a.severity === 'HIGH').map((alert, i) => {
                  const TypeIcon = TYPE_ICONS[alert.type] || AlertTriangle;
                  const typeColor = TYPE_COLORS[alert.type] || 'bg-gray-100 text-gray-700';
                  return (
                    <div key={i} className="bg-red-50 border border-red-200 rounded-xl p-4">
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${typeColor}`}>
                          <TypeIcon className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeColor}`}>
                              {alert.type}
                            </span>
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                              ALTA
                            </span>
                          </div>
                          <p className="text-red-900 font-medium mb-2">{alert.message}</p>
                          {alert.details && (
                            <pre className="text-xs text-red-700 bg-red-100/50 rounded p-2 mb-2 overflow-auto">
                              {JSON.stringify(alert.details, null, 2)}
                            </pre>
                          )}
                          <div className="flex items-center gap-2 text-sm text-red-700">
                            <ArrowRight className="w-4 h-4" />
                            <span className="font-medium">Acción:</span> {alert.action}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* MEDIUM Priority */}
          {check.alerts.filter(a => a.severity === 'MEDIUM').length > 0 && (
            <div>
              <h3 className="font-semibold text-amber-900 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" /> Media Prioridad - Revisar
              </h3>
              <div className="space-y-2">
                {check.alerts.filter(a => a.severity === 'MEDIUM').map((alert, i) => {
                  const TypeIcon = TYPE_ICONS[alert.type] || AlertTriangle;
                  const typeColor = TYPE_COLORS[alert.type] || 'bg-gray-100 text-gray-700';
                  return (
                    <div key={i} className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded flex items-center justify-center flex-shrink-0 ${typeColor}`}>
                          <TypeIcon className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                          <p className="text-amber-900 text-sm font-medium">{alert.message}</p>
                          <p className="text-xs text-amber-700 mt-1">Acción: {alert.action}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* LOW Priority */}
          {check.alerts.filter(a => a.severity === 'LOW').length > 0 && (
            <div>
              <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" /> Baja Prioridad - Considerar
              </h3>
              <div className="space-y-2">
                {check.alerts.filter(a => a.severity === 'LOW').map((alert, i) => {
                  const TypeIcon = TYPE_ICONS[alert.type] || AlertTriangle;
                  return (
                    <div key={i} className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="flex items-start gap-3">
                        <TypeIcon className="w-4 h-4 text-blue-600 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-blue-900 text-sm">{alert.message}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recommendations */}
      {check?.recommendations && check.recommendations.length > 0 && (
        <div className="bg-white rounded-xl border p-5">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-blue-600" /> Recomendaciones del Sistema
          </h3>
          <ul className="space-y-2">
            {check.recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <ArrowRight className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Related Modules */}
      {check?.relatedModules && (
        <div className="bg-gray-50 rounded-xl border p-4">
          <h3 className="text-sm font-medium text-gray-600 mb-3">Módulos Analizados</h3>
          <div className="flex flex-wrap gap-2">
            {check.relatedModules.map((module) => (
              <span key={module} className="px-3 py-1 bg-white border rounded-full text-sm text-gray-700">
                {module}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Last Check */}
      {check?.checkedAt && (
        <div className="text-center text-xs text-gray-500">
          Último análisis: {new Date(check.checkedAt).toLocaleString()}
        </div>
      )}
    </div>
  );
}
