'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

// ── Report Types ──
const REPORT_ENDPOINTS: Record<string, string> = {
  executive: '/reports/executive',
  ncr: '/reports/ncr',
  risks: '/reports/risks',
  indicators: '/reports/indicators',
  compliance: '/reports/compliance',
  trainings: '/reports/trainings',
};

const REPORT_TITLES: Record<string, string> = {
  executive: 'Reporte Ejecutivo',
  ncr: 'Reporte de No Conformidades',
  risks: 'Reporte de Riesgos',
  indicators: 'Reporte de Indicadores',
  compliance: 'Reporte de Cumplimiento',
  trainings: 'Reporte de Capacitaciones',
};

export default function ReportExportPage() {
  return (
    <Suspense>
      <ReportExportContent />
    </Suspense>
  );
}

function ReportExportContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { tenant } = useAuth();
  const type = searchParams.get('type') || 'executive';

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const endpoint = REPORT_ENDPOINTS[type];
    if (!endpoint) {
      setError('Tipo de reporte inválido');
      setLoading(false);
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    params.delete('type');
    const qs = params.toString();

    apiFetch<{ report: any }>(qs ? `${endpoint}?${qs}` : endpoint)
      .then((res) => setData(res.report))
      .catch((e: any) => setError(e.message))
      .finally(() => setLoading(false));
  }, [type, searchParams]);

  useEffect(() => {
    if (data && !loading && !error) {
      // Auto-print after rendering
      setTimeout(() => window.print(), 500);
    }
  }, [data, loading, error]);

  const now = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600 mx-auto" />
          <p className="mt-3 text-neutral-500">Generando reporte...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-red-600">{error}</p>
          <button onClick={() => router.back()} className="mt-3 text-blue-600 underline">Volver</button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Print-only styles */}
      <style jsx global>{`
        @media print {
          nav, header, .no-print, .sidebar { display: none !important; }
          body { background: white !important; padding: 0 !important; margin: 0 !important; }
          .print-page { margin: 0 !important; padding: 20mm !important; box-shadow: none !important; }
          .ml-\\[260px\\] { margin-left: 0 !important; }
          @page { margin: 15mm; size: A4; }
        }
        @media screen {
          .print-page { max-width: 900px; margin: 2rem auto; padding: 3rem; background: white; box-shadow: 0 1px 3px rgba(0,0,0,.1); border-radius: 12px; }
        }
      `}</style>

      {/* Screen-only toolbar */}
      <div className="no-print flex items-center justify-between p-4 bg-neutral-50 border-b border-neutral-200 mb-4">
        <button onClick={() => router.back()} className="text-sm text-neutral-600 hover:text-neutral-900">
          ← Volver a Reportes
        </button>
        <button
          onClick={() => window.print()}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Exportar PDF
        </button>
      </div>

      <div className="print-page">
        {/* Header */}
        <div className="border-b-2 border-neutral-900 pb-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-neutral-900">{REPORT_TITLES[type]}</h1>
              <p className="text-neutral-500 mt-1">{tenant?.name || 'SGI 360'}</p>
            </div>
            <div className="text-right text-sm text-neutral-500">
              <p>Fecha: {now}</p>
              <p>SGI 360 — Sistema de Gestión Integrado</p>
            </div>
          </div>
        </div>

        {/* Report Body */}
        {type === 'executive' && <ExecutiveReport data={data.summary} />}
        {type === 'ncr' && <NCRReport data={{ ...data.stats, items: data.items }} />}
        {type === 'risks' && <RiskReport data={{ ...data.stats, items: data.items }} />}
        {type === 'indicators' && <IndicatorReport data={{ ...data.stats, items: data.items }} />}
        {type === 'compliance' && <ComplianceReport data={{ ...data.stats, norms: data.norms }} />}
        {type === 'trainings' && <TrainingReport data={{ ...data.stats, items: data.items }} />}

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-neutral-300 text-xs text-neutral-400 flex justify-between">
          <span>Generado por SGI 360 — {tenant?.name}</span>
          <span>{now}</span>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════
// REPORT RENDERERS
// ═══════════════════════════════════════════

function StatBox({ label, value, color = 'text-neutral-900' }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="border border-neutral-200 rounded-lg p-3 text-center">
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-neutral-500 mt-0.5">{label}</div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-semibold text-neutral-900 mt-6 mb-3 border-b border-neutral-200 pb-2">{children}</h2>;
}

function ExecutiveReport({ data }: { data: any }) {
  return (
    <div className="space-y-4">
      <SectionTitle>Resumen General</SectionTitle>
      <div className="grid grid-cols-4 gap-3">
        <StatBox label="Documentos" value={data.documents?.total ?? 0} />
        <StatBox label="NCRs Abiertas" value={data.ncrs?.open ?? 0} color="text-red-600" />
        <StatBox label="Riesgos" value={data.risks?.total ?? 0} />
        <StatBox label="Hallazgos IA" value={data.findings?.open ?? 0} color="text-amber-600" />
      </div>

      <SectionTitle>Documentos</SectionTitle>
      <div className="grid grid-cols-3 gap-3">
        <StatBox label="Total" value={data.documents?.total ?? 0} />
        <StatBox label="Efectivos" value={data.documents?.effective ?? 0} color="text-green-600" />
        <StatBox label="Borradores" value={data.documents?.draft ?? 0} />
      </div>

      <SectionTitle>No Conformidades</SectionTitle>
      <div className="grid grid-cols-4 gap-3">
        <StatBox label="Total" value={data.ncrs?.total ?? 0} />
        <StatBox label="Abiertas" value={data.ncrs?.open ?? 0} color="text-red-600" />
        <StatBox label="En Progreso" value={data.ncrs?.inProgress ?? 0} color="text-amber-600" />
        <StatBox label="Cerradas" value={data.ncrs?.closed ?? 0} color="text-green-600" />
      </div>

      <SectionTitle>Riesgos</SectionTitle>
      <div className="grid grid-cols-4 gap-3">
        <StatBox label="Total" value={data.risks?.total ?? 0} />
        <StatBox label="Críticos" value={data.risks?.critical ?? 0} color="text-red-600" />
        <StatBox label="Altos" value={data.risks?.high ?? 0} color="text-orange-600" />
        <StatBox label="Medios" value={data.risks?.medium ?? 0} color="text-amber-600" />
      </div>

      <SectionTitle>Indicadores</SectionTitle>
      <div className="grid grid-cols-3 gap-3">
        <StatBox label="Total" value={data.indicators?.total ?? 0} />
        <StatBox label="En Meta" value={data.indicators?.onTarget ?? 0} color="text-green-600" />
        <StatBox label="Bajo Meta" value={data.indicators?.belowTarget ?? 0} color="text-red-600" />
      </div>
    </div>
  );
}

function NCRReport({ data }: { data: any }) {
  return (
    <div className="space-y-4">
      <SectionTitle>Estadísticas Generales</SectionTitle>
      <div className="grid grid-cols-4 gap-3">
        <StatBox label="Total" value={data.total ?? 0} />
        <StatBox label="Abiertas" value={data.open ?? 0} color="text-red-600" />
        <StatBox label="En Progreso" value={data.inProgress ?? 0} color="text-amber-600" />
        <StatBox label="Cerradas" value={data.closed ?? 0} color="text-green-600" />
      </div>

      {data.bySeverity && (
        <>
          <SectionTitle>Por Severidad</SectionTitle>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200">
                <th className="text-left py-2 font-medium text-neutral-600">Severidad</th>
                <th className="text-right py-2 font-medium text-neutral-600">Cantidad</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(data.bySeverity).map(([k, v]) => (
                <tr key={k} className="border-b border-neutral-100">
                  <td className="py-2">{k}</td>
                  <td className="py-2 text-right font-medium">{v as number}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {data.items && data.items.length > 0 && (
        <>
          <SectionTitle>Detalle de NCRs</SectionTitle>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200">
                <th className="text-left py-2 font-medium text-neutral-600">Código</th>
                <th className="text-left py-2 font-medium text-neutral-600">Título</th>
                <th className="text-left py-2 font-medium text-neutral-600">Severidad</th>
                <th className="text-left py-2 font-medium text-neutral-600">Estado</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item: any) => (
                <tr key={item.id || item.code} className="border-b border-neutral-100">
                  <td className="py-2 font-mono text-xs">{item.code}</td>
                  <td className="py-2">{item.title}</td>
                  <td className="py-2">{item.severity}</td>
                  <td className="py-2">{item.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

function RiskReport({ data }: { data: any }) {
  return (
    <div className="space-y-4">
      <SectionTitle>Estadísticas Generales</SectionTitle>
      <div className="grid grid-cols-4 gap-3">
        <StatBox label="Total" value={data.total ?? 0} />
        <StatBox label="Nivel Promedio" value={(data.avgRiskLevel ?? 0).toFixed(1)} />
        <StatBox label="Críticos (≥20)" value={data.critical ?? 0} color="text-red-600" />
        <StatBox label="Altos (15-19)" value={data.high ?? 0} color="text-orange-600" />
      </div>

      {data.byCategory && (
        <>
          <SectionTitle>Por Categoría</SectionTitle>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200">
                <th className="text-left py-2 font-medium text-neutral-600">Categoría</th>
                <th className="text-right py-2 font-medium text-neutral-600">Cantidad</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(data.byCategory).map(([k, v]) => (
                <tr key={k} className="border-b border-neutral-100">
                  <td className="py-2">{k}</td>
                  <td className="py-2 text-right font-medium">{v as number}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {data.items && data.items.length > 0 && (
        <>
          <SectionTitle>Detalle de Riesgos</SectionTitle>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-neutral-200">
                <th className="text-left py-2 font-medium text-neutral-600">Código</th>
                <th className="text-left py-2 font-medium text-neutral-600">Título</th>
                <th className="text-left py-2 font-medium text-neutral-600">Cat.</th>
                <th className="text-left py-2 font-medium text-neutral-600">ISO</th>
                <th className="text-left py-2 font-medium text-neutral-600">Req.</th>
                <th className="text-left py-2 font-medium text-neutral-600">Legal</th>
                <th className="text-left py-2 font-medium text-neutral-600">Estrategia</th>
                <th className="text-left py-2 font-medium text-neutral-600">Resp.</th>
                <th className="text-left py-2 font-medium text-neutral-600">Ef.</th>
                <th className="text-left py-2 font-medium text-neutral-600">P/A</th>
                <th className="text-left py-2 font-medium text-neutral-600">P×I</th>
                <th className="text-left py-2 font-medium text-neutral-600">Estado</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item: any) => (
                <tr key={item.id || item.code} className="border-b border-neutral-100">
                  <td className="py-2 font-mono text-xs">{item.code}</td>
                  <td className="py-2 max-w-[180px] truncate" title={item.title}>{item.title}</td>
                  <td className="py-2 max-w-[90px] truncate" title={item.category}>{item.category}</td>
                  <td className="py-2 max-w-[70px] truncate" title={item.aspectType || ''}>{item.aspectType || '-'}</td>
                  <td className="py-2 max-w-[160px] truncate" title={item.requirement || ''}>{item.requirement || '-'}</td>
                  <td className="py-2">{item.legalRequirement === true ? 'Sí' : item.legalRequirement === false ? 'No' : '-'}</td>
                  <td className="py-2 max-w-[90px] truncate" title={item.strategy || ''}>{item.strategy || '-'}</td>
                  <td className="py-2 max-w-[110px] truncate" title={item.responsible || item.owner?.email || ''}>{item.responsible || item.owner?.email || '-'}</td>
                  <td className="py-2">{item.effectiveness ?? '-'}</td>
                  <td className="py-2 max-w-[120px] truncate" title={(item.environmentalAspect || item.hazard || '')}>
                    {item.environmentalAspect || item.hazard || '-'}
                  </td>
                  <td className="py-2 font-medium">{item.riskLevel}</td>
                  <td className="py-2">{item.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

function IndicatorReport({ data }: { data: any }) {
  return (
    <div className="space-y-4">
      <SectionTitle>Estadísticas Generales</SectionTitle>
      <div className="grid grid-cols-4 gap-3">
        <StatBox label="Total" value={data.total ?? 0} />
        <StatBox label="Activos" value={data.active ?? 0} />
        <StatBox label="En Meta" value={data.onTarget ?? 0} color="text-green-600" />
        <StatBox label="Bajo Meta" value={data.belowTarget ?? 0} color="text-red-600" />
      </div>

      {data.items && data.items.length > 0 && (
        <>
          <SectionTitle>Detalle de Indicadores</SectionTitle>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200">
                <th className="text-left py-2 font-medium text-neutral-600">Código</th>
                <th className="text-left py-2 font-medium text-neutral-600">Nombre</th>
                <th className="text-right py-2 font-medium text-neutral-600">Actual</th>
                <th className="text-right py-2 font-medium text-neutral-600">Meta</th>
                <th className="text-left py-2 font-medium text-neutral-600">Tendencia</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item: any) => (
                <tr key={item.id || item.code} className="border-b border-neutral-100">
                  <td className="py-2 font-mono text-xs">{item.code}</td>
                  <td className="py-2">{item.name}</td>
                  <td className="py-2 text-right font-medium">{item.currentValue ?? '-'} {item.unit}</td>
                  <td className="py-2 text-right">{item.targetValue ?? '-'} {item.unit}</td>
                  <td className="py-2">{item.trend === 'UP' ? '↑' : item.trend === 'DOWN' ? '↓' : '→'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

function ComplianceReport({ data }: { data: any }) {
  return (
    <div className="space-y-4">
      <SectionTitle>Cumplimiento General</SectionTitle>
      <div className="grid grid-cols-3 gap-3">
        <StatBox label="Score" value={`${data.score ?? 0}%`} color={data.score >= 80 ? 'text-green-600' : data.score >= 50 ? 'text-amber-600' : 'text-red-600'} />
        <StatBox label="Documentos Efectivos" value={data.effectiveDocs ?? 0} color="text-green-600" />
        <StatBox label="Total Documentos" value={data.totalDocs ?? 0} />
      </div>

      {data.norms && data.norms.length > 0 && (
        <>
          <SectionTitle>Normas Aplicadas</SectionTitle>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200">
                <th className="text-left py-2 font-medium text-neutral-600">Norma</th>
                <th className="text-left py-2 font-medium text-neutral-600">Código</th>
                <th className="text-right py-2 font-medium text-neutral-600">Cláusulas</th>
                <th className="text-left py-2 font-medium text-neutral-600">Estado</th>
              </tr>
            </thead>
            <tbody>
              {data.norms.map((n: any) => (
                <tr key={n.id || n.code} className="border-b border-neutral-100">
                  <td className="py-2">{n.name}</td>
                  <td className="py-2 font-mono text-xs">{n.code}</td>
                  <td className="py-2 text-right">{n.totalClauses}</td>
                  <td className="py-2">{n.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

function TrainingReport({ data }: { data: any }) {
  return (
    <div className="space-y-4">
      <SectionTitle>Estadísticas Generales</SectionTitle>
      <div className="grid grid-cols-4 gap-3">
        <StatBox label="Total" value={data.total ?? 0} />
        <StatBox label="Completadas" value={data.completed ?? 0} color="text-green-600" />
        <StatBox label="Horas Totales" value={data.totalHours ?? 0} />
        <StatBox label="Participantes" value={data.totalParticipants ?? 0} />
      </div>

      {data.byCategory && (
        <>
          <SectionTitle>Por Categoría</SectionTitle>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200">
                <th className="text-left py-2 font-medium text-neutral-600">Categoría</th>
                <th className="text-right py-2 font-medium text-neutral-600">Cantidad</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(data.byCategory).map(([k, v]) => (
                <tr key={k} className="border-b border-neutral-100">
                  <td className="py-2">{k}</td>
                  <td className="py-2 text-right font-medium">{v as number}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {data.items && data.items.length > 0 && (
        <>
          <SectionTitle>Detalle de Capacitaciones</SectionTitle>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200">
                <th className="text-left py-2 font-medium text-neutral-600">Código</th>
                <th className="text-left py-2 font-medium text-neutral-600">Título</th>
                <th className="text-right py-2 font-medium text-neutral-600">Horas</th>
                <th className="text-left py-2 font-medium text-neutral-600">Estado</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item: any) => (
                <tr key={item.id || item.code} className="border-b border-neutral-100">
                  <td className="py-2 font-mono text-xs">{item.code}</td>
                  <td className="py-2">{item.title}</td>
                  <td className="py-2 text-right">{item.durationHours}h</td>
                  <td className="py-2">{item.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
