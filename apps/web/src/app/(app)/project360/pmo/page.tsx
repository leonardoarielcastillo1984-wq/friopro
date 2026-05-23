'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';
import {
  ArrowLeft, BarChart3, TrendingUp, TrendingDown, DollarSign, Target, AlertTriangle,
  CheckCircle2, XCircle, Users, Briefcase, Clock, ShieldAlert, Zap, ArrowUpRight,
  Award, Activity, PieChart
} from 'lucide-react';

interface Kpi {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  criticalProjects: number;
  projectedRevenue: number;
  projectedCosts: number;
  avgMargin: number;
  avgRoi: number;
  pipelineValue: number;
  weightedPipeline: number;
  adjudicados: number;
  enEjecucion: number;
  enRiesgo: number;
}

interface ProjectSummary {
  id: string;
  name: string;
  code: string;
  status: string;
  etapa: string;
  margin: number;
  roi: number;
  viabilityStatus: string;
  riskScore: number;
  probabilityOfWinning: number;
}

interface RankingItem {
  id: string;
  name: string;
  code: string;
  margin: number;
  roi: number;
  viabilityStatus: string;
  etapa: string;
}

export default function PmoDashboardPage() {
  const [data, setData] = useState<{ kpi: Kpi | null; ranking: RankingItem[]; projects: ProjectSummary[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'verde' | 'amarillo' | 'rojo' | 'riesgo'>('all');

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/project360/pmo-dashboard') as any;
      setData(res);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  const kpi = data?.kpi;
  const filteredProjects = data?.projects.filter(p => {
    if (filter === 'verde') return p.viabilityStatus === 'VERDE';
    if (filter === 'amarillo') return p.viabilityStatus === 'AMARILLO';
    if (filter === 'rojo') return p.viabilityStatus === 'ROJO';
    if (filter === 'riesgo') return p.riskScore > 60 || p.viabilityStatus === 'ROJO';
    return true;
  }) || [];

  const kpiCards = kpi ? [
    { label: 'Proyectos Totales', value: kpi.totalProjects, icon: Briefcase, color: 'bg-blue-50 text-blue-600' },
    { label: 'Activos', value: kpi.activeProjects, icon: Activity, color: 'bg-emerald-50 text-emerald-600' },
    { label: 'Revenue Proyectado', value: new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(kpi.projectedRevenue), icon: DollarSign, color: 'bg-purple-50 text-purple-600' },
    { label: 'Pipeline', value: new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(kpi.pipelineValue), icon: PieChart, color: 'bg-indigo-50 text-indigo-600' },
    { label: 'Margen Promedio', value: `${kpi.avgMargin}%`, icon: TrendingUp, color: 'bg-teal-50 text-teal-600' },
    { label: 'ROI Promedio', value: `${kpi.avgRoi}%`, icon: Target, color: 'bg-amber-50 text-amber-600' },
    { label: 'Adjudicados', value: kpi.adjudicados, icon: CheckCircle2, color: 'bg-green-50 text-green-600' },
    { label: 'En Riesgo', value: kpi.enRiesgo, icon: ShieldAlert, color: 'bg-red-50 text-red-600' },
  ] : [];

  const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
    VERDE: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Viable' },
    AMARILLO: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Revisar' },
    ROJO: { bg: 'bg-red-100', text: 'text-red-700', label: 'Alto Riesgo' },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/project360" className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">PMO Dashboard</h1>
            <p className="text-gray-500">Vista ejecutiva de portfolio de proyectos</p>
          </div>
        </div>
        <button onClick={loadDashboard} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
          <Activity className="w-5 h-5" />
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpiCards.map((k) => (
          <div key={k.label} className="bg-white rounded-xl border p-4">
            <div className={`w-10 h-10 rounded-lg ${k.color} flex items-center justify-center mb-3`}>
              <k.icon className="w-5 h-5" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{k.value}</div>
            <div className="text-xs text-gray-500 mt-1">{k.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ranking por rentabilidad */}
        <div className="lg:col-span-2 bg-white rounded-xl border overflow-hidden">
          <div className="px-6 py-4 border-b flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-600" /> Ranking por Rentabilidad
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">#</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Proyecto</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Margen</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">ROI</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">Viabilidad</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Etapa</th>
                </tr>
              </thead>
              <tbody>
                {data?.ranking.map((p, i) => (
                  <tr key={p.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold text-gray-500">{i + 1}</td>
                    <td className="px-4 py-3">
                      <Link href={`/project360/${p.id}`} className="font-medium text-blue-600 hover:underline">
                        {p.name}
                      </Link>
                      <div className="text-xs text-gray-500">{p.code}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{p.margin?.toFixed(1)}%</td>
                    <td className="px-4 py-3 text-right text-gray-700">{p.roi?.toFixed(1)}%</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE[p.viabilityStatus]?.bg || 'bg-gray-100'} ${STATUS_BADGE[p.viabilityStatus]?.text || 'text-gray-700'}`}>
                        {STATUS_BADGE[p.viabilityStatus]?.label || p.viabilityStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{p.etapa}</td>
                  </tr>
                ))}
                {(!data?.ranking || data.ranking.length === 0) && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Sin proyectos con business case</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pipeline funnel */}
        <div className="bg-white rounded-xl border p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <PieChart className="w-5 h-5 text-blue-600" /> Pipeline
          </h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Valor Pipeline</span>
                <span className="font-semibold text-gray-900">
                  {kpi ? new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(kpi.pipelineValue) : '-'}
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div className="bg-blue-500 h-2 rounded-full" style={{ width: '100%' }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Pipeline Ponderado</span>
                <span className="font-semibold text-gray-900">
                  {kpi ? new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(kpi.weightedPipeline) : '-'}
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div className="bg-emerald-500 h-2 rounded-full" style={{ width: kpi && kpi.pipelineValue > 0 ? `${(kpi.weightedPipeline / kpi.pipelineValue) * 100}%` : '0%' }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Proyectos Activos</span>
                <span className="font-semibold text-gray-900">{kpi?.activeProjects || 0}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div className="bg-amber-500 h-2 rounded-full" style={{ width: kpi && kpi.totalProjects > 0 ? `${(kpi.activeProjects / kpi.totalProjects) * 100}%` : '0%' }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Portfolio con filtros */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center justify-between flex-wrap gap-3">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-600" /> Portfolio de Proyectos
          </h3>
          <div className="flex gap-2">
            {[
              { key: 'all' as const, label: 'Todos' },
              { key: 'verde' as const, label: 'Viables' },
              { key: 'amarillo' as const, label: 'Revisar' },
              { key: 'rojo' as const, label: 'Riesgo' },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filter === f.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Proyecto</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Etapa</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Margen</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">ROI</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Viabilidad</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Riesgo</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Prob. Adjud.</th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.map(p => (
                <tr key={p.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/project360/${p.id}`} className="font-medium text-blue-600 hover:underline">
                      {p.name}
                    </Link>
                    <div className="text-xs text-gray-500">{p.code}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">{p.etapa}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{p.margin?.toFixed(1)}%</td>
                  <td className="px-4 py-3 text-right text-gray-700">{p.roi?.toFixed(1)}%</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE[p.viabilityStatus]?.bg || 'bg-gray-100'} ${STATUS_BADGE[p.viabilityStatus]?.text || 'text-gray-700'}`}>
                      {STATUS_BADGE[p.viabilityStatus]?.label || p.viabilityStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-semibold ${p.riskScore > 60 ? 'text-red-600' : p.riskScore > 40 ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {p.riskScore}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-xs font-semibold text-blue-600">{p.probabilityOfWinning}%</span>
                  </td>
                </tr>
              ))}
              {filteredProjects.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Sin proyectos en este filtro</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
