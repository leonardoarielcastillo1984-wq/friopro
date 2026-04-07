'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';
import {
  FileBarChart, Download, Calendar, CheckCircle2,
  AlertTriangle, Shield, BarChart3, BookOpen,
  Target, Loader2, ChevronDown, ChevronUp, Users,
} from 'lucide-react';

type ReportType = 'executive' | 'ncr' | 'risks' | 'indicators' | 'compliance' | 'trainings' | 'customers';

const REPORT_TYPES: { id: ReportType; title: string; description: string; icon: React.ReactNode; color: string }[] = [
  { id: 'executive', title: 'Resumen Ejecutivo', description: 'Resumen general de todos los módulos del SGI', icon: <Target className="h-5 w-5" />, color: 'blue' },
  { id: 'ncr', title: 'No Conformidades', description: 'Análisis detallado de NCRs, severidad y estados', icon: <AlertTriangle className="h-5 w-5" />, color: 'red' },
  { id: 'risks', title: 'Análisis de Riesgos', description: 'Evaluación de riesgos, matriz y mitigaciones', icon: <Shield className="h-5 w-5" />, color: 'purple' },
  { id: 'indicators', title: 'Indicadores Mensuales', description: 'KPIs de desempeño y tendencias', icon: <BarChart3 className="h-5 w-5" />, color: 'emerald' },
  { id: 'compliance', title: 'Cumplimiento Normativo', description: 'Estado de conformidad con normas aplicables', icon: <CheckCircle2 className="h-5 w-5" />, color: 'amber' },
  { id: 'trainings', title: 'Capacitaciones', description: 'Resumen de formación y asistencia', icon: <BookOpen className="h-5 w-5" />, color: 'pink' },
  { id: 'customers', title: 'Gestión de Clientes', description: 'Satisfacción, reclamos y métricas de servicio', icon: <Users className="h-5 w-5" />, color: 'indigo' },
];

const COLOR_MAP: Record<string, { bg: string; text: string; border: string }> = {
  blue: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200' },
  red: { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200' },
  pink: { bg: 'bg-pink-50', text: 'text-pink-600', border: 'border-pink-200' },
  indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-200' },
};

export default function ReportesPage() {
  const [selectedType, setSelectedType] = useState<ReportType | null>(null);
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const generateReport = async (type: ReportType) => {
    setSelectedType(type);
    setLoading(true);
    setError('');
    setReportData(null);
    try {
      const res = await apiFetch<{ report: any }>(`/reports/${type}`);
      setReportData(res.report);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Reportes</h1>
        <p className="text-slate-500 mt-1">Genera reportes en tiempo real a partir de los datos de tu sistema</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm">{error}</div>
      )}

      {/* Report Type Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Informe para la Dirección - Special Card */}
        <Link
          href="/reportes/informe-direccion"
          className="text-left rounded-xl border-2 p-5 transition-all hover:shadow-md bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200 hover:border-blue-300"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="p-2.5 rounded-lg bg-blue-100">
              <FileBarChart className="h-5 w-5 text-blue-600" />
            </div>
          </div>
          <h3 className="font-semibold text-slate-900 text-sm">Informe para la Dirección</h3>
          <p className="text-xs text-slate-500 mt-1">Revisión por la dirección multi-norma con entradas/salidas</p>
        </Link>

        {REPORT_TYPES.map(rt => {
          const c = COLOR_MAP[rt.color];
          const isSelected = selectedType === rt.id;
          return (
            <button
              key={rt.id}
              onClick={() => generateReport(rt.id)}
              disabled={loading}
              className={`text-left rounded-xl border-2 p-5 transition-all hover:shadow-md ${
                isSelected ? `${c.bg} ${c.border}` : 'border-slate-200 bg-white hover:border-slate-300'
              } ${loading ? 'opacity-50' : ''}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`p-2.5 rounded-lg ${c.bg}`}>
                  <span className={c.text}>{rt.icon}</span>
                </div>
                {isSelected && loading && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
                {isSelected && !loading && reportData && <CheckCircle2 className="h-4 w-4 text-green-500" />}
              </div>
              <h3 className="font-semibold text-slate-900 text-sm">{rt.title}</h3>
              <p className="text-xs text-slate-500 mt-1">{rt.description}</p>
            </button>
          );
        })}
      </div>

      {/* Generated Report */}
      {loading && (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-slate-500">Generando reporte...</p>
        </div>
      )}

      {reportData && !loading && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {/* Report Header */}
          <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">
                {REPORT_TYPES.find(r => r.id === reportData.type)?.title || 'Reporte'}
              </h2>
              <p className="text-xs text-slate-400">
                Generado: {new Date(reportData.generatedAt).toLocaleString('es-AR')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => window.open(`/reportes/export?type=${reportData.type}`, '_blank')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700"
              >
                <Download className="h-3.5 w-3.5" /> Exportar PDF
              </button>
            </div>
          </div>

          {/* Report Content */}
          <div className="p-6">
            {reportData.type === 'executive' && <ExecutiveReport data={reportData} />}
            {reportData.type === 'ncr' && <NCRReport data={reportData} />}
            {reportData.type === 'risks' && <RisksReport data={reportData} />}
            {reportData.type === 'indicators' && <IndicatorsReport data={reportData} />}
            {reportData.type === 'compliance' && <ComplianceReport data={reportData} />}
            {reportData.type === 'trainings' && <TrainingsReport data={reportData} />}
          </div>
        </div>
      )}

      {!reportData && !loading && (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <FileBarChart className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">Selecciona un tipo de reporte para generarlo</p>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, sub, color = 'slate' }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className={`bg-${color}-50 rounded-lg p-4 border border-${color}-100`}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-2xl font-bold text-slate-900 mt-1">{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function ExecutiveReport({ data }: { data: any }) {
  const s = data.summary;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
          <div className="text-xs text-slate-500">Cumplimiento</div>
          <div className="text-3xl font-bold text-blue-600">{s.complianceScore}%</div>
        </div>
        <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
          <div className="text-xs text-slate-500">Documentos</div>
          <div className="text-2xl font-bold text-slate-900">{s.documents.total}</div>
          <div className="text-xs text-slate-400">{s.documents.effective} vigentes</div>
        </div>
        <div className="bg-red-50 rounded-lg p-4 border border-red-100">
          <div className="text-xs text-slate-500">NCRs Abiertas</div>
          <div className="text-2xl font-bold text-red-600">{s.ncrs.open}</div>
          <div className="text-xs text-slate-400">{s.ncrs.critical} críticas</div>
        </div>
        <div className="bg-amber-50 rounded-lg p-4 border border-amber-100">
          <div className="text-xs text-slate-500">Riesgos Altos+</div>
          <div className="text-2xl font-bold text-amber-600">{s.risks.critical + s.risks.high}</div>
          <div className="text-xs text-slate-400">{s.risks.total} total</div>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-100">
          <div className="text-xs text-slate-500">Normativos</div>
          <div className="text-2xl font-bold text-slate-900">{s.normatives.total}</div>
          <div className="text-xs text-slate-400">{s.normatives.totalClauses} cláusulas</div>
        </div>
        <div className="bg-purple-50 rounded-lg p-4 border border-purple-100">
          <div className="text-xs text-slate-500">Hallazgos Abiertos</div>
          <div className="text-2xl font-bold text-slate-900">{s.findings.open}</div>
          <div className="text-xs text-slate-400">{s.findings.total} total</div>
        </div>
        <div className="bg-green-50 rounded-lg p-4 border border-green-100">
          <div className="text-xs text-slate-500">Auditorías Completadas</div>
          <div className="text-2xl font-bold text-slate-900">{s.audits.completed}</div>
          <div className="text-xs text-slate-400">{s.audits.total} total</div>
        </div>
      </div>
    </div>
  );
}

function NCRReport({ data }: { data: any }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-50 rounded-lg p-4 border border-slate-100"><div className="text-xs text-slate-500">Total</div><div className="text-2xl font-bold">{data.stats.total}</div></div>
        <div className="bg-red-50 rounded-lg p-4 border border-red-100"><div className="text-xs text-slate-500">Abiertas</div><div className="text-2xl font-bold text-red-600">{data.stats.open}</div></div>
        <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-100"><div className="text-xs text-slate-500">En Proceso</div><div className="text-2xl font-bold text-yellow-600">{data.stats.inProgress}</div></div>
        <div className="bg-green-50 rounded-lg p-4 border border-green-100"><div className="text-xs text-slate-500">Cerradas</div><div className="text-2xl font-bold text-green-600">{data.stats.closed}</div></div>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Por Severidad</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(data.stats.bySeverity).map(([k, v]) => (
            <div key={k} className="bg-slate-50 rounded-lg p-3 text-center border border-slate-100">
              <div className="text-lg font-bold text-slate-900">{v as number}</div>
              <div className="text-xs text-slate-500">{k}</div>
            </div>
          ))}
        </div>
      </div>
      {data.items.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Detalle ({data.items.length} registros)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-200">
                <th className="text-left py-2 px-3 text-xs text-slate-400">Código</th>
                <th className="text-left py-2 px-3 text-xs text-slate-400">Título</th>
                <th className="text-left py-2 px-3 text-xs text-slate-400">Severidad</th>
                <th className="text-left py-2 px-3 text-xs text-slate-400">Estado</th>
              </tr></thead>
              <tbody>
                {data.items.slice(0, 20).map((n: any) => (
                  <tr key={n.id} className="border-b border-slate-50">
                    <td className="py-2 px-3 font-mono text-xs">{n.code}</td>
                    <td className="py-2 px-3">{n.title}</td>
                    <td className="py-2 px-3"><span className={`text-xs px-2 py-0.5 rounded-full ${n.severity === 'CRITICAL' ? 'bg-red-100 text-red-700' : n.severity === 'MAJOR' ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700'}`}>{n.severity}</span></td>
                    <td className="py-2 px-3 text-xs text-slate-500">{n.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function RisksReport({ data }: { data: any }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-slate-50 rounded-lg p-4 border border-slate-100"><div className="text-xs text-slate-500">Total</div><div className="text-2xl font-bold">{data.stats.total}</div></div>
        <div className="bg-red-50 rounded-lg p-4 border border-red-100"><div className="text-xs text-slate-500">Crítico</div><div className="text-2xl font-bold text-red-600">{data.stats.critical}</div></div>
        <div className="bg-orange-50 rounded-lg p-4 border border-orange-100"><div className="text-xs text-slate-500">Alto</div><div className="text-2xl font-bold text-orange-600">{data.stats.high}</div></div>
        <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-100"><div className="text-xs text-slate-500">Medio</div><div className="text-2xl font-bold text-yellow-600">{data.stats.medium}</div></div>
        <div className="bg-green-50 rounded-lg p-4 border border-green-100"><div className="text-xs text-slate-500">Bajo</div><div className="text-2xl font-bold text-green-600">{data.stats.low}</div></div>
      </div>
      <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
        <div className="text-xs text-slate-500">Nivel Promedio de Riesgo</div>
        <div className="text-3xl font-bold text-slate-900">{data.stats.avgRiskLevel}</div>
        <div className="text-xs text-slate-400">sobre 25 (escala 1-5 x 1-5)</div>
      </div>
      {Object.keys(data.stats.byCategory).length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Por Categoría</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(data.stats.byCategory).map(([k, v]) => (
              <div key={k} className="bg-slate-50 rounded-lg p-3 text-center border border-slate-100">
                <div className="text-lg font-bold text-slate-900">{v as number}</div>
                <div className="text-xs text-slate-500">{k}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function IndicatorsReport({ data }: { data: any }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-100"><div className="text-xs text-slate-500">Activos</div><div className="text-2xl font-bold">{data.stats.total}</div></div>
        <div className="bg-green-50 rounded-lg p-4 border border-green-100"><div className="text-xs text-slate-500">En Meta</div><div className="text-2xl font-bold text-green-600">{data.stats.onTarget}</div></div>
        <div className="bg-red-50 rounded-lg p-4 border border-red-100"><div className="text-xs text-slate-500">Bajo Meta</div><div className="text-2xl font-bold text-red-600">{data.stats.belowTarget}</div></div>
      </div>
      {data.items.length > 0 && (
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[480px]">
          <thead><tr className="border-b border-slate-200">
            <th className="text-left py-2 px-3 text-xs text-slate-400">KPI</th>
            <th className="text-left py-2 px-3 text-xs text-slate-400">Actual</th>
            <th className="text-left py-2 px-3 text-xs text-slate-400">Meta</th>
            <th className="text-left py-2 px-3 text-xs text-slate-400">Tendencia</th>
          </tr></thead>
          <tbody>
            {data.items.map((i: any) => (
              <tr key={i.id} className="border-b border-slate-50">
                <td className="py-2 px-3 font-medium">{i.name}</td>
                <td className="py-2 px-3">{i.currentValue !== null ? `${i.currentValue}${i.unit}` : '—'}</td>
                <td className="py-2 px-3">{i.targetValue !== null ? `${i.targetValue}${i.unit}` : '—'}</td>
                <td className="py-2 px-3 text-xs">{i.trend === 'UP' ? '↗ Subiendo' : i.trend === 'DOWN' ? '↘ Bajando' : '→ Estable'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
      {data.items.length === 0 && <p className="text-slate-400 text-sm text-center py-6">No hay indicadores definidos</p>}
    </div>
  );
}

function ComplianceReport({ data }: { data: any }) {
  const s = data.stats;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-100"><div className="text-xs text-slate-500">Cumplimiento</div><div className="text-3xl font-bold text-blue-600">{s.complianceScore}%</div></div>
        <div className="bg-slate-50 rounded-lg p-4 border border-slate-100"><div className="text-xs text-slate-500">Docs Vigentes</div><div className="text-2xl font-bold">{s.effectiveDocs}/{s.totalDocs}</div></div>
        <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-100"><div className="text-xs text-slate-500">Normas Listas</div><div className="text-2xl font-bold">{s.readyNorms}/{s.totalNorms}</div></div>
        <div className="bg-red-50 rounded-lg p-4 border border-red-100"><div className="text-xs text-slate-500">Hallazgos Abiertos</div><div className="text-2xl font-bold text-red-600">{s.openFindings}</div></div>
      </div>
      {data.norms.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Normas Aplicables</h3>
          <div className="space-y-2">
            {data.norms.map((n: any) => (
              <div key={n.id} className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg">
                <div><span className="font-medium text-sm">{n.name}</span> <span className="text-xs text-slate-400 ml-2">{n.code}</span></div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${n.status === 'READY' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{n.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TrainingsReport({ data }: { data: any }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-50 rounded-lg p-4 border border-slate-100"><div className="text-xs text-slate-500">Total</div><div className="text-2xl font-bold">{data.stats.total}</div></div>
        <div className="bg-green-50 rounded-lg p-4 border border-green-100"><div className="text-xs text-slate-500">Completadas</div><div className="text-2xl font-bold text-green-600">{data.stats.completed}</div></div>
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-100"><div className="text-xs text-slate-500">Programadas</div><div className="text-2xl font-bold text-blue-600">{data.stats.scheduled}</div></div>
        <div className="bg-purple-50 rounded-lg p-4 border border-purple-100"><div className="text-xs text-slate-500">Horas Formación</div><div className="text-2xl font-bold">{data.stats.totalHours}h</div></div>
      </div>
      {data.items.length > 0 && (
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[540px]">
          <thead><tr className="border-b border-slate-200">
            <th className="text-left py-2 px-3 text-xs text-slate-400">Código</th>
            <th className="text-left py-2 px-3 text-xs text-slate-400">Título</th>
            <th className="text-left py-2 px-3 text-xs text-slate-400">Categoría</th>
            <th className="text-left py-2 px-3 text-xs text-slate-400">Estado</th>
            <th className="text-left py-2 px-3 text-xs text-slate-400">Horas</th>
          </tr></thead>
          <tbody>
            {data.items.map((t: any) => (
              <tr key={t.id} className="border-b border-slate-50">
                <td className="py-2 px-3 font-mono text-xs">{t.code}</td>
                <td className="py-2 px-3 font-medium">{t.title}</td>
                <td className="py-2 px-3 text-xs">{t.category}</td>
                <td className="py-2 px-3"><span className={`text-xs px-2 py-0.5 rounded-full ${t.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : t.status === 'SCHEDULED' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>{t.status}</span></td>
                <td className="py-2 px-3 text-xs">{t.durationHours}h</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
      {data.items.length === 0 && <p className="text-slate-400 text-sm text-center py-6">No hay capacitaciones registradas</p>}
    </div>
  );
}
