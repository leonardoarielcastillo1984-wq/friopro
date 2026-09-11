'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import {
  ListChecks, AlertTriangle, AlertCircle, Info, RefreshCw,
  CheckCircle2, ChevronRight, Loader2, ShieldAlert,
} from 'lucide-react';

type Severity = 'HIGH' | 'MEDIUM' | 'LOW';

type ReadinessIssue = {
  id: string;
  title: string;
  detail: string;
  severity: Severity;
  href: string;
};

type ModuleReadiness = {
  key: string;
  label: string;
  href: string;
  total: number;
  pending: number;
  score: number;
  issues: ReadinessIssue[];
};

type SummaryResponse = {
  generatedAt: string;
  overallScore: number;
  totalPending: number;
  modules: ModuleReadiness[];
};

const SEVERITY_CONFIG: Record<Severity, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  HIGH: { label: 'Urgente', color: 'text-red-700', bg: 'bg-red-50 border-red-200', icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  MEDIUM: { label: 'Importante', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: <AlertCircle className="h-3.5 w-3.5" /> },
  LOW: { label: 'A revisar', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', icon: <Info className="h-3.5 w-3.5" /> },
};

function scoreColor(score: number): string {
  if (score >= 85) return 'text-green-600';
  if (score >= 60) return 'text-amber-600';
  return 'text-red-600';
}

function scoreBarColor(score: number): string {
  if (score >= 85) return 'bg-green-500';
  if (score >= 60) return 'bg-amber-500';
  return 'bg-red-500';
}

export default function AuditoriaReadinessPage() {
  const router = useRouter();
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => { load(); }, []);

  async function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<SummaryResponse>('/audit-readiness/summary');
      if (!res || !Array.isArray(res.modules)) {
        throw new Error('No se pudo cargar el panel de preparación');
      }
      setData(res);
    } catch (err: any) {
      setError(err?.message ?? 'Error al cargar el panel de preparación');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 flex items-center gap-2">
            <ListChecks className="h-6 w-6 text-brand-600" /> Preparación de Auditoría
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            Detecta automáticamente lo pendiente en cada módulo del SGI: vencidos, sin evidencia, sin responsable o sin avance reciente.
            No modifica ningún dato — solo lectura.
          </p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
        >
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Actualizar
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {data && (
        <>
          {/* Score global */}
          <div className="rounded-xl border border-neutral-200 bg-white p-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className={`text-4xl font-bold ${scoreColor(data.overallScore)}`}>{data.overallScore}%</div>
                <div>
                  <div className="font-semibold text-neutral-900">Nivel de preparación general</div>
                  <div className="text-sm text-neutral-500">
                    {data.totalPending === 0
                      ? 'Todo en orden — no se detectaron pendientes'
                      : `${data.totalPending} ítem${data.totalPending === 1 ? '' : 's'} pendiente${data.totalPending === 1 ? '' : 's'} en total`}
                  </div>
                </div>
              </div>
              {data.totalPending === 0 ? (
                <CheckCircle2 className="h-10 w-10 text-green-500" />
              ) : (
                <ShieldAlert className="h-10 w-10 text-amber-500" />
              )}
            </div>
            <div className="mt-4 h-2.5 w-full rounded-full bg-neutral-100 overflow-hidden">
              <div className={`h-full rounded-full ${scoreBarColor(data.overallScore)} transition-all duration-500`} style={{ width: `${data.overallScore}%` }} />
            </div>
            <div className="mt-2 text-xs text-neutral-400">
              Última actualización: {new Date(data.generatedAt).toLocaleString('es-AR')}
            </div>
          </div>

          {/* Módulos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {data.modules.map((m) => (
              <div key={m.key} className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
                <button
                  onClick={() => setExpanded((e) => ({ ...e, [m.key]: !e[m.key] }))}
                  className="w-full flex items-center justify-between p-4 hover:bg-neutral-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`text-lg font-bold ${scoreColor(m.score)}`}>{m.score}%</div>
                    <div className="text-left">
                      <div className="font-semibold text-neutral-900">{m.label}</div>
                      <div className="text-xs text-neutral-500">
                        {m.pending === 0 ? 'Sin pendientes' : `${m.pending} de ${m.total} con pendientes`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {m.pending > 0 && (
                      <span className="rounded-full bg-red-100 text-red-700 text-xs font-semibold px-2 py-0.5">{m.pending}</span>
                    )}
                    <ChevronRight className={`h-4 w-4 text-neutral-400 transition-transform ${expanded[m.key] ? 'rotate-90' : ''}`} />
                  </div>
                </button>

                {expanded[m.key] && (
                  <div className="border-t border-neutral-100 p-3 space-y-2 bg-neutral-50/50">
                    {m.issues.length === 0 ? (
                      <p className="text-sm text-neutral-400 italic px-2 py-1">Sin ítems pendientes en este módulo.</p>
                    ) : (
                      m.issues.map((issue) => {
                        const cfg = SEVERITY_CONFIG[issue.severity];
                        return (
                          <button
                            key={issue.id}
                            onClick={() => router.push(issue.href)}
                            className={`w-full flex items-start gap-2 rounded-lg border p-2.5 text-left hover:shadow-sm transition-shadow ${cfg.bg}`}
                          >
                            <span className={`mt-0.5 ${cfg.color}`}>{cfg.icon}</span>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-neutral-800 truncate">{issue.title}</div>
                              <div className={`text-xs ${cfg.color}`}>{issue.detail}</div>
                            </div>
                          </button>
                        );
                      })
                    )}
                    {m.href && (
                      <button
                        onClick={() => router.push(m.href)}
                        className="w-full text-center text-xs text-brand-600 hover:text-brand-700 font-medium py-1.5"
                      >
                        Ir al módulo →
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
