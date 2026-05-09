'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';
import { Trophy, TrendingUp, AlertTriangle, Target, BarChart3, Award, ChevronRight } from 'lucide-react';

type MaturityScore = {
  overall: number;
  byArea: {
    area: string;
    score: number;
    totalAudits: number;
    findings: number;
    compliantPercentage: number;
    trend: 'UP' | 'DOWN' | 'STABLE';
  }[];
  byStandard: {
    standard: string;
    score: number;
    compliant: number;
    nonCompliant: number;
  }[];
  trends: {
    month: string;
    score: number;
  }[];
  topRisks: {
    area: string;
    risk: string;
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
  }[];
};

export default function MaturityScorePage() {
  const [data, setData] = useState<MaturityScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'6M' | '1Y' | '2Y'>('1Y');

  useEffect(() => {
    loadData();
  }, [selectedPeriod]);

  async function loadData() {
    try {
      setLoading(true);

      const [statsRes, auditsRes] = await Promise.allSettled([
        apiFetch<{ stats: any }>('/audit/stats'),
        apiFetch<{ audits: any[] }>('/audit/audits'),
      ]);

      const stats = statsRes.status === 'fulfilled' ? statsRes.value.stats : null;
      const audits: any[] = auditsRes.status === 'fulfilled' ? (auditsRes.value.audits || []) : [];

      if (!stats && audits.length === 0) {
        setData(null);
        return;
      }

      // Calcular score por área desde auditorías reales
      const areaMap: Record<string, { total: number; completed: number; findings: number }> = {};
      for (const audit of audits) {
        const area = audit.area || audit.process || 'Sin área';
        if (!areaMap[area]) areaMap[area] = { total: 0, completed: 0, findings: 0 };
        areaMap[area].total += 1;
        if (audit.status === 'COMPLETED' || audit.status === 'CLOSED') areaMap[area].completed += 1;
        areaMap[area].findings += audit._count?.findings ?? 0;
      }

      const byArea = Object.entries(areaMap).map(([area, d]) => {
        const completionRate = d.total > 0 ? (d.completed / d.total) * 100 : 0;
        const findingPenalty = Math.min(d.findings * 2, 30);
        const score = Math.max(0, Math.round(completionRate - findingPenalty + (d.completed > 0 ? 10 : 0)));
        return {
          area,
          score: Math.min(score, 100),
          totalAudits: d.total,
          findings: d.findings,
          compliantPercentage: Math.round(completionRate),
          trend: 'STABLE' as 'UP' | 'DOWN' | 'STABLE',
        };
      });

      // Score general
      const overall = byArea.length > 0
        ? Math.round(byArea.reduce((acc, a) => acc + a.score, 0) / byArea.length)
        : (stats ? Math.round(((stats.auditsByStatus?.COMPLETED ?? 0) / Math.max(stats.totalAudits, 1)) * 100) : 0);

      // Normas usadas en las auditorías
      const standardMap: Record<string, { compliant: number; nonCompliant: number }> = {};
      for (const audit of audits) {
        const standards: string[] = audit.isoStandard ?? [];
        for (const std of standards) {
          if (!standardMap[std]) standardMap[std] = { compliant: 0, nonCompliant: 0 };
          if (audit.status === 'COMPLETED' || audit.status === 'CLOSED') standardMap[std].compliant += 1;
          else standardMap[std].nonCompliant += 1;
        }
      }
      const byStandard = Object.entries(standardMap).map(([standard, d]) => {
        const total = d.compliant + d.nonCompliant;
        return {
          standard,
          score: total > 0 ? Math.round((d.compliant / total) * 100) : 0,
          compliant: d.compliant,
          nonCompliant: d.nonCompliant,
        };
      });

      // Áreas críticas (con más hallazgos)
      const topRisks = [...byArea]
        .sort((a, b) => b.findings - a.findings)
        .slice(0, 3)
        .filter(a => a.findings > 0)
        .map(a => ({
          area: a.area,
          risk: `${a.findings} hallazgo${a.findings !== 1 ? 's' : ''} registrado${a.findings !== 1 ? 's' : ''}`,
          severity: (a.findings >= 5 ? 'HIGH' : 'MEDIUM') as 'HIGH' | 'MEDIUM' | 'LOW',
        }));

      setData({ overall, byArea, byStandard, trends: [], topRisks });
    } catch (err) {
      console.error('Error loading maturity data:', err);
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  function getScoreColor(score: number) {
    if (score >= 90) return 'text-green-600 bg-green-50';
    if (score >= 75) return 'text-blue-600 bg-blue-50';
    if (score >= 60) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  }

  function getScoreLabel(score: number) {
    if (score >= 90) return 'Excelente';
    if (score >= 75) return 'Bueno';
    if (score >= 60) return 'Regular';
    return 'Crítico';
  }

  function getTrendIcon(trend: string) {
    switch (trend) {
      case 'UP': return <TrendingUp className="w-4 h-4 text-green-600" />;
      case 'DOWN': return <TrendingUp className="w-4 h-4 text-red-600 rotate-180" />;
      default: return <div className="w-4 h-4 border-2 border-gray-400 rounded-full" />;
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Trophy className="w-8 h-8 text-yellow-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Score de Madurez</h1>
            <p className="text-gray-500">Análisis de madurez del sistema de gestión</p>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">No hay suficientes datos para calcular el score de madurez.</p>
          <p className="text-gray-400 text-sm mt-1">Creá y completá auditorías desde <strong>RRHH → Auditorías</strong> para ver el análisis.</p>
        </div>
      </div>
    );
  }

  const sortedAreas = [...data.byArea].sort((a, b) => b.score - a.score);
  const topArea = sortedAreas[0];
  const bottomArea = sortedAreas[sortedAreas.length - 1];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Trophy className="w-8 h-8 text-yellow-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Score de Madurez</h1>
            <p className="text-gray-500">Análisis de madurez del sistema de gestión</p>
          </div>
        </div>
        <div className="flex gap-2">
          {['6M', '1Y', '2Y'].map((period) => (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period as any)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedPeriod === period
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              {period === '6M' ? '6 Meses' : period === '1Y' ? '1 Año' : '2 Años'}
            </button>
          ))}
        </div>
      </div>

      {/* Overall Score */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className={`w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold ${getScoreColor(data.overall)}`}>
              {data.overall}%
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Madurez General</h2>
              <p className={`text-lg font-medium ${getScoreColor(data.overall).split(' ')[0]}`}>
                {getScoreLabel(data.overall)}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Basado en {data.byArea.reduce((acc, a) => acc + a.totalAudits, 0)} auditorías
              </p>
            </div>
          </div>
          
          {/* Trend Chart (simplified) */}
          {data.trends.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">Evolución del Score</h3>
              <div className="h-32 flex items-end gap-2">
                {data.trends.map((trend, i) => {
                  const height = (trend.score / 100) * 100;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className="w-full bg-blue-500 rounded-t transition-all duration-300 hover:bg-blue-600"
                        style={{ height: `${height}%` }}
                      />
                      <span className="text-xs text-gray-500">{trend.month}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Top & Bottom Areas */}
        {sortedAreas.length > 0 && (
          <div className="space-y-4">
            {topArea && (
              <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                <div className="flex items-center gap-2 mb-2">
                  <Award className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-medium text-green-800">Mejor Área</span>
                </div>
                <p className="text-lg font-semibold text-green-900">{topArea.area}</p>
                <p className="text-2xl font-bold text-green-600">{topArea.score}%</p>
              </div>
            )}
            {bottomArea && bottomArea !== topArea && (
              <div className="bg-red-50 rounded-xl p-4 border border-red-100">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <span className="text-sm font-medium text-red-800">Área Crítica</span>
                </div>
                <p className="text-lg font-semibold text-red-900">{bottomArea.area}</p>
                <p className="text-2xl font-bold text-red-600">{bottomArea.score}%</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Ranking by Area */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Ranking por Área</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {sortedAreas.map((area, index) => (
            <div key={area.area} className="px-6 py-4 flex items-center gap-4">
              <div className="w-8 text-center font-bold text-gray-400">
                {index + 1}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-900">{area.area}</h3>
                  <div className="flex items-center gap-2">
                    {getTrendIcon(area.trend)}
                    <span className={`text-lg font-bold ${getScoreColor(area.score).split(' ')[0]}`}>
                      {area.score}%
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span>{area.totalAudits} auditorías</span>
                  <span>{area.findings} hallazgos</span>
                  <span>{area.compliantPercentage}% conformidad</span>
                </div>
                <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      area.score >= 75 ? 'bg-green-500' : area.score >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${area.score}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* By Standard */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Madurez por Norma ISO</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {data.byStandard.map((std) => (
              <div key={std.standard} className="p-4 rounded-xl bg-gray-50">
                <h3 className="font-semibold text-gray-900 mb-2">{std.standard}</h3>
                <p className={`text-3xl font-bold mb-2 ${getScoreColor(std.score).split(' ')[0]}`}>
                  {std.score}%
                </p>
                <div className="flex justify-between text-sm text-gray-500">
                  <span className="text-green-600">{std.compliant} OK</span>
                  <span className="text-red-600">{std.nonCompliant} NC</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Risks */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Áreas Críticas y Riesgos</h2>
          <Link href="/auditorias/riesgos" className="text-sm text-blue-600 hover:text-blue-800">
            Ver análisis completo →
          </Link>
        </div>
        <div className="divide-y divide-gray-200">
          {data.topRisks.map((risk, i) => (
            <div key={i} className="px-6 py-4 flex items-center gap-4">
              <div className={`p-2 rounded-lg ${
                risk.severity === 'HIGH' ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-600'
              }`}>
                <Target className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">{risk.area}</span>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    risk.severity === 'HIGH' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {risk.severity === 'HIGH' ? 'Alto Riesgo' : 'Riesgo Medio'}
                  </span>
                </div>
                <p className="text-gray-600 text-sm mt-1">{risk.risk}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
