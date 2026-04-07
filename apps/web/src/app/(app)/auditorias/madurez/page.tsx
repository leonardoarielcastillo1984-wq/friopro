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
      // Simulación de datos - en producción vendrían de la API
      const mockData: MaturityScore = {
        overall: 78,
        byArea: [
          { area: 'Producción', score: 85, totalAudits: 12, findings: 8, compliantPercentage: 88, trend: 'UP' },
          { area: 'Calidad', score: 92, totalAudits: 15, findings: 3, compliantPercentage: 95, trend: 'STABLE' },
          { area: 'Mantenimiento', score: 72, totalAudits: 8, findings: 15, compliantPercentage: 75, trend: 'DOWN' },
          { area: 'Logística', score: 68, totalAudits: 6, findings: 12, compliantPercentage: 70, trend: 'UP' },
          { area: 'RRHH', score: 88, totalAudits: 10, findings: 5, compliantPercentage: 90, trend: 'STABLE' },
          { area: 'Compras', score: 65, totalAudits: 5, findings: 18, compliantPercentage: 65, trend: 'DOWN' },
        ],
        byStandard: [
          { standard: 'ISO 9001', score: 82, compliant: 245, nonCompliant: 32 },
          { standard: 'ISO 14001', score: 75, compliant: 120, nonCompliant: 28 },
          { standard: 'ISO 45001', score: 71, compliant: 98, nonCompliant: 35 },
          { standard: 'IATF 16949', score: 88, compliant: 180, nonCompliant: 15 },
        ],
        trends: [
          { month: 'Oct 2025', score: 72 },
          { month: 'Nov 2025', score: 74 },
          { month: 'Dic 2025', score: 73 },
          { month: 'Ene 2026', score: 76 },
          { month: 'Feb 2026', score: 77 },
          { month: 'Mar 2026', score: 78 },
        ],
        topRisks: [
          { area: 'Mantenimiento', risk: 'Falta de capacitación en nuevos equipos', severity: 'HIGH' },
          { area: 'Compras', risk: 'Control de proveedores insuficiente', severity: 'HIGH' },
          { area: 'Logística', risk: 'Trazabilidad de productos', severity: 'MEDIUM' },
        ],
      };
      setData(mockData);
    } catch (err) {
      console.error('Error loading maturity data:', err);
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
      <div className="text-center py-8">
        <p className="text-gray-500">Error al cargar datos de madurez</p>
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
        </div>

        {/* Top & Bottom Areas */}
        <div className="space-y-4">
          <div className="bg-green-50 rounded-xl p-4 border border-green-100">
            <div className="flex items-center gap-2 mb-2">
              <Award className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium text-green-800">Mejor Área</span>
            </div>
            <p className="text-lg font-semibold text-green-900">{topArea.area}</p>
            <p className="text-2xl font-bold text-green-600">{topArea.score}%</p>
          </div>
          
          <div className="bg-red-50 rounded-xl p-4 border border-red-100">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <span className="text-sm font-medium text-red-800">Área Crítica</span>
            </div>
            <p className="text-lg font-semibold text-red-900">{bottomArea.area}</p>
            <p className="text-2xl font-bold text-red-600">{bottomArea.score}%</p>
          </div>
        </div>
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
