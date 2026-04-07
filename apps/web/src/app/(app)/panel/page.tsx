'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import type { DashboardData } from '@/lib/types';
import {
  BarChart3, Target, Shield, FileText,
  AlertTriangle, Bug, CheckCircle2, TrendingUp,
  Activity, BookOpen, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';

const DEFAULT_PANEL_DATA: DashboardData = {
  documents: { total: 0, effective: 0, draft: 0, recent: [] },
  ncrs: { total: 0, open: 0, inProgress: 0, closed: 0, overdue: 0, critical: 0 },
  risks: { total: 0, critical: 0, high: 0, medium: 0, low: 0 },
  normatives: { total: 0, ready: 0, totalClauses: 0 },
  findings: { total: 0, open: 0 },
  trainings: { total: 0, completed: 0 },
  departments: 0,
};

// Helper to safely get number values
const safeNum = (val: any, defaultVal = 0): number => {
  const num = Number(val);
  return isNaN(num) ? defaultVal : num;
};

export default function PanelPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ dashboard: DashboardData }>('/dashboard')
      .then(r => {
        const dashboard = r?.dashboard;
        if (!dashboard) {
          setData(DEFAULT_PANEL_DATA);
          return;
        }
        // Ensure all nested objects have safe default values
        setData({
          documents: {
            total: safeNum(dashboard.documents?.total),
            effective: safeNum(dashboard.documents?.effective),
            draft: safeNum(dashboard.documents?.draft),
            recent: dashboard.documents?.recent || []
          },
          ncrs: {
            total: safeNum(dashboard.ncrs?.total),
            open: safeNum(dashboard.ncrs?.open),
            inProgress: safeNum(dashboard.ncrs?.inProgress),
            closed: safeNum(dashboard.ncrs?.closed),
            overdue: safeNum(dashboard.ncrs?.overdue),
            critical: safeNum(dashboard.ncrs?.critical)
          },
          risks: {
            total: safeNum(dashboard.risks?.total),
            critical: safeNum(dashboard.risks?.critical),
            high: safeNum(dashboard.risks?.high),
            medium: safeNum(dashboard.risks?.medium),
            low: safeNum(dashboard.risks?.low)
          },
          normatives: {
            total: safeNum(dashboard.normatives?.total),
            ready: safeNum(dashboard.normatives?.ready),
            totalClauses: safeNum(dashboard.normatives?.totalClauses)
          },
          findings: {
            total: safeNum(dashboard.findings?.total),
            open: safeNum(dashboard.findings?.open)
          },
          trainings: {
            total: safeNum(dashboard.trainings?.total),
            completed: safeNum(dashboard.trainings?.completed)
          },
          departments: safeNum(dashboard.departments)
        });
      })
      .catch(() => setData(DEFAULT_PANEL_DATA))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!data) return null;

  // Calculate module health scores
  const modules = [
    {
      name: 'Documentos',
      icon: <FileText className="h-5 w-5" />,
      score: data.documents.total > 0 ? Math.round((data.documents.effective / data.documents.total) * 100) : 0,
      detail: `${data.documents.effective}/${data.documents.total} vigentes`,
      color: 'blue',
    },
    {
      name: 'No Conformidades',
      icon: <Bug className="h-5 w-5" />,
      score: data.ncrs.total > 0 ? Math.round((data.ncrs.closed / data.ncrs.total) * 100) : 100,
      detail: `${data.ncrs.closed}/${data.ncrs.total} cerradas`,
      color: 'red',
    },
    {
      name: 'Riesgos',
      icon: <AlertTriangle className="h-5 w-5" />,
      score: data.risks.total > 0 ? Math.round(((data.risks.low + data.risks.medium) / data.risks.total) * 100) : 100,
      detail: `${data.risks.critical + data.risks.high} altos/críticos`,
      color: 'amber',
    },
    {
      name: 'Normativos',
      icon: <Shield className="h-5 w-5" />,
      score: data.normatives.total > 0 ? Math.round((data.normatives.ready / data.normatives.total) * 100) : 0,
      detail: `${data.normatives.ready}/${data.normatives.total} listos`,
      color: 'indigo',
    },
    {
      name: 'Auditoría IA',
      icon: <Target className="h-5 w-5" />,
      score: data.findings.total > 0 ? Math.round(((data.findings.total - data.findings.open) / data.findings.total) * 100) : 100,
      detail: `${data.findings.open} hallazgos abiertos`,
      color: 'purple',
    },
    {
      name: 'Capacitaciones',
      icon: <BookOpen className="h-5 w-5" />,
      score: data.trainings.total > 0 ? Math.round((data.trainings.completed / data.trainings.total) * 100) : 0,
      detail: `${data.trainings.completed}/${data.trainings.total} completadas`,
      color: 'pink',
    },
  ];

  const avgScore = modules.length > 0
    ? Math.round(modules.reduce((s, m) => s + m.score, 0) / modules.length)
    : 0;

  const COLOR_MAP: Record<string, { bg: string; text: string; ring: string }> = {
    blue: { bg: 'bg-blue-50', text: 'text-blue-600', ring: 'stroke-blue-500' },
    red: { bg: 'bg-red-50', text: 'text-red-600', ring: 'stroke-red-500' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-600', ring: 'stroke-amber-500' },
    indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', ring: 'stroke-indigo-500' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-600', ring: 'stroke-purple-500' },
    pink: { bg: 'bg-pink-50', text: 'text-pink-600', ring: 'stroke-pink-500' },
  };

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Panel General</h1>
          <p className="text-slate-500 mt-1">Análisis integral de cumplimiento y desempeño por módulo</p>
        </div>
        <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-slate-50 border border-slate-200">
          <Activity className="h-5 w-5 text-blue-600" />
          <div>
            <div className="text-2xl font-bold text-slate-900">{avgScore}%</div>
            <div className="text-xs text-slate-500">Salud Promedio</div>
          </div>
        </div>
      </div>

      {/* Module Health Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {modules.map(mod => {
          const c = COLOR_MAP[mod.color];
          const scoreColor = mod.score >= 80 ? 'text-green-600' : mod.score >= 50 ? 'text-yellow-600' : 'text-red-600';
          const barColor = mod.score >= 80 ? 'bg-green-500' : mod.score >= 50 ? 'bg-yellow-500' : 'bg-red-500';

          return (
            <div key={mod.name} className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className={`p-2 rounded-lg ${c.bg} flex-shrink-0`}>
                    <span className={c.text}>{mod.icon}</span>
                  </div>
                  <h3 className="font-semibold text-slate-900 truncate text-sm">{mod.name}</h3>
                </div>
                <div className="flex-shrink-0 ml-2">
                  <span className={`text-lg font-bold ${scoreColor}`}>{mod.score}%</span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-100 rounded-full h-2 mb-2">
                <div className={`${barColor} rounded-full h-2 transition-all`} style={{ width: `${mod.score}%` }} />
              </div>

              <p className="text-xs text-slate-500">{mod.detail}</p>
            </div>
          );
        })}
      </div>

      {/* Summary Statistics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Risk Breakdown */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-900 mb-4">Distribución de Riesgos</h2>
          <div className="space-y-3">
            <DistBar label="Crítico (20-25)" value={data.risks.critical} total={data.risks.total} color="bg-red-500" />
            <DistBar label="Alto (12-19)" value={data.risks.high} total={data.risks.total} color="bg-orange-500" />
            <DistBar label="Medio (5-11)" value={data.risks.medium} total={data.risks.total} color="bg-yellow-500" />
            <DistBar label="Bajo (1-4)" value={data.risks.low} total={data.risks.total} color="bg-green-500" />
          </div>
        </div>

        {/* NCR Breakdown */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-900 mb-4">Estado de No Conformidades</h2>
          <div className="space-y-3">
            <DistBar label="Abiertas" value={data.ncrs.open} total={data.ncrs.total} color="bg-red-500" />
            <DistBar label="En Proceso" value={data.ncrs.inProgress} total={data.ncrs.total} color="bg-yellow-500" />
            <DistBar label="Cerradas" value={data.ncrs.closed} total={data.ncrs.total} color="bg-green-500" />
          </div>
          {data.ncrs.critical > 0 && (
            <div className="mt-4 bg-red-50 rounded-lg p-3 text-sm text-red-700 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              {data.ncrs.critical} NCR(s) crítica(s) requieren atención inmediata
            </div>
          )}
        </div>
      </div>

      {/* Alerts Section */}
      {(data.ncrs.overdue > 0 || data.ncrs.critical > 0 || data.risks.critical > 0) && (
        <div className="bg-white rounded-xl border border-red-200 p-5">
          <h2 className="font-semibold text-red-700 mb-3 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" /> Alertas Activas
          </h2>
          <div className="space-y-2">
            {data.ncrs.overdue > 0 && (
              <div className="flex items-center gap-2 text-sm text-slate-700 bg-amber-50 rounded-lg p-3">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                {data.ncrs.overdue} no conformidad(es) vencida(s)
              </div>
            )}
            {data.ncrs.critical > 0 && (
              <div className="flex items-center gap-2 text-sm text-slate-700 bg-red-50 rounded-lg p-3">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                {data.ncrs.critical} no conformidad(es) crítica(s) abierta(s)
              </div>
            )}
            {data.risks.critical > 0 && (
              <div className="flex items-center gap-2 text-sm text-slate-700 bg-red-50 rounded-lg p-3">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                {data.risks.critical} riesgo(s) con nivel crítico
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DistBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-600 flex-1 min-w-0">{label}</span>
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="text-xs font-semibold text-slate-900">{value}</span>
          <span className="text-slate-400 font-normal text-xs">({Math.round(pct)}%)</span>
        </div>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-2">
        <div className={`${color} rounded-full h-2 transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
