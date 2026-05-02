'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import type { AuditRun, AiFinding } from '@/lib/types';
import {
  BrainCircuit, FileSearch, MessageSquare, AlertTriangle,
  CheckCircle2, Clock, ChevronRight, Shield, TrendingUp,
  Target, Zap, AlertCircle, Trash2
} from 'lucide-react';

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  QUEUED: { label: 'En cola', color: 'text-neutral-700', bg: 'bg-neutral-100 border-neutral-200' },
  RUNNING: { label: 'Analizando', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  COMPLETED: { label: 'Completado', color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
  FAILED: { label: 'Error', color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
};

const severityConfig: Record<string, { label: string; color: string; bg: string }> = {
  MUST: { label: 'Crítico', color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
  SHOULD: { label: 'Importante', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
};

export default function AuditDashboardPage() {
  const router = useRouter();
  const [runs, setRuns] = useState<AuditRun[]>([]);
  const [findings, setFindings] = useState<AiFinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [runsRes, findingsRes] = await Promise.all([
        apiFetch<{ runs: AuditRun[] }>('/audit/runs'),
        apiFetch<{ findings: AiFinding[] }>('/audit/findings?status=OPEN'),
      ]);
      setRuns(runsRes.runs ?? []);
      setFindings(findingsRes.findings ?? []);
    } catch (err: any) {
      setError(err?.message ?? 'Error loading data');
      if (err?.message === 'Unauthorized') router.push('/login');
    } finally {
      setLoading(false);
    }
  }

  const mustCount = findings.filter(f => f.severity === 'MUST').length;
  const shouldCount = findings.filter(f => f.severity === 'SHOULD').length;
  const completedRuns = runs.filter(r => r.status === 'COMPLETED').length;

  async function handleDelete(runId: string) {
    if (!confirm('¿Estás seguro de eliminar esta auditoría?')) return;
    try {
      await apiFetch(`/audit/runs/${runId}`, { method: 'DELETE' });
      loadData();
    } catch (err: any) {
      setError(err?.message ?? 'Error al eliminar');
    }
  }

  async function convertFindingToNCR(findingId: string) {
    if (!confirm('¿Convertir este hallazgo en una No Conformidad?')) return;
    try {
      const res = await apiFetch<{ success: boolean; message: string; nonConformity: { id: string; code: string } }>(`/audit/findings/${findingId}/convert-to-ncr`, {
        method: 'POST',
      });
      alert(`✅ ${res.message}\nCódigo: ${res.nonConformity.code}`);
      loadData();
    } catch (err: any) {
      setError(err?.message ?? 'Error al convertir a NCR');
    }
  }

  async function deleteFinding(findingId: string) {
    if (!confirm('¿Eliminar este hallazgo? Esta acción no se puede deshacer.')) return;
    try {
      await apiFetch(`/audit/findings/${findingId}`, {
        method: 'DELETE',
      });
      loadData();
    } catch (err: any) {
      setError(err?.message ?? 'Error al eliminar hallazgo');
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Auditoría IA</h1>
          <p className="mt-1 text-sm text-neutral-500">Motor de inteligencia artificial para análisis de cumplimiento</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle className="h-4 w-4 flex-shrink-0" /> {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-brand-50 p-2"><Target className="h-5 w-5 text-brand-600" /></div>
            <div>
              <div className="text-2xl font-bold text-neutral-900">{findings.length}</div>
              <div className="text-xs text-neutral-500">Hallazgos abiertos</div>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50/50 p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-red-100 p-2"><AlertTriangle className="h-5 w-5 text-red-600" /></div>
            <div>
              <div className="text-2xl font-bold text-red-700">{mustCount}</div>
              <div className="text-xs text-red-600">Obligatorios</div>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-100 p-2"><Shield className="h-5 w-5 text-amber-600" /></div>
            <div>
              <div className="text-2xl font-bold text-amber-700">{shouldCount}</div>
              <div className="text-xs text-amber-600">Recomendados</div>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-green-200 bg-green-50/50 p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-100 p-2"><CheckCircle2 className="h-5 w-5 text-green-600" /></div>
            <div>
              <div className="text-2xl font-bold text-green-700">{completedRuns}</div>
              <div className="text-xs text-green-600">Auditorías completadas</div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={() => router.push('/audit/analyze')}
          className="group rounded-xl border border-neutral-200 bg-white p-6 text-left transition-all hover:border-brand-300 hover:shadow-md"
        >
          <div className="flex items-center gap-4">
            <div className="rounded-xl bg-brand-50 p-3 group-hover:bg-brand-100 transition-colors">
              <FileSearch className="h-7 w-7 text-brand-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-neutral-900">Analizar Documento vs Norma</h3>
              <p className="mt-1 text-sm text-neutral-500">Compará un documento contra un estándar normativo y detectá brechas de cumplimiento</p>
            </div>
            <ChevronRight className="h-5 w-5 text-neutral-400 group-hover:text-brand-600 transition-colors" />
          </div>
        </button>

        <button
          onClick={() => router.push('/audit/chat')}
          className="group rounded-xl border border-neutral-200 bg-white p-6 text-left transition-all hover:border-brand-300 hover:shadow-md"
        >
          <div className="flex items-center gap-4">
            <div className="rounded-xl bg-purple-50 p-3 group-hover:bg-purple-100 transition-colors">
              <MessageSquare className="h-7 w-7 text-purple-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-neutral-900">Chat Auditor</h3>
              <p className="mt-1 text-sm text-neutral-500">Consultá a la IA sobre normativas, hallazgos y recomendaciones en lenguaje natural</p>
            </div>
            <ChevronRight className="h-5 w-5 text-neutral-400 group-hover:text-purple-600 transition-colors" />
          </div>
        </button>
      </div>

      {/* Recent Audit Runs */}
      <div>
        <h2 className="text-lg font-semibold text-neutral-900 mb-3">Últimas Ejecuciones</h2>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
          </div>
        ) : runs.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-neutral-200 bg-white p-12 text-center">
            <BrainCircuit className="mx-auto h-12 w-12 text-neutral-300" />
            <h3 className="mt-4 text-lg font-medium text-neutral-900">Sin auditorías</h3>
            <p className="mt-1 text-sm text-neutral-500">Realizá tu primera auditoría analizando un documento contra una norma.</p>
            <button
              onClick={() => router.push('/audit/analyze')}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              <Zap className="h-4 w-4" /> Iniciar auditoría
            </button>
          </div>
        ) : (
          <div className="rounded-xl border border-neutral-200 bg-white overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50/50">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-500">Auditoría</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-500">Estado</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-500">Hallazgos</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-500">Cobertura</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-500">Fecha</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {runs.map(run => {
                  const st = statusConfig[run.status] ?? statusConfig.QUEUED;
                  return (
                    <tr
                      key={run.id}
                      onClick={() => router.push(`/audit/analyze?runId=${run.id}`)}
                      className="cursor-pointer hover:bg-neutral-50/50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <BrainCircuit className="h-5 w-5 text-brand-600" />
                          <div>
                            <div className="font-medium text-sm text-neutral-900">
                              {run.type === 'document_vs_norma'
                                ? `${run.document?.title ?? 'Documento'} vs ${run.normative?.code ?? 'Norma'}`
                                : 'Auditoría completa'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${st.bg} ${st.color}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-neutral-900">{run.findingsCount ?? 0}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-20 rounded-full bg-neutral-200">
                            <div
                              className="h-2 rounded-full bg-brand-600"
                              style={{ width: `${run.totalClauses ? (run.coveredClauses / run.totalClauses) * 100 : 0}%` }}
                            />
                          </div>
                          <span className="text-xs text-neutral-500">{run.coveredClauses}/{run.totalClauses}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-500">
                        {new Date(run.startedAt).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(run.id); }}
                          className="text-neutral-400 hover:text-red-600 transition-colors"
                          title="Eliminar auditoría"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Open Findings */}
      {findings.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-neutral-900 mb-3">Hallazgos Abiertos</h2>
          <div className="space-y-2">
            {findings.slice(0, 8).map(f => {
              const sev = severityConfig[f.severity] ?? severityConfig.SHOULD;
              return (
                <div key={f.id} className="rounded-xl border border-neutral-200 bg-white p-4 hover:border-neutral-300 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 rounded p-1 ${f.severity === 'MUST' ? 'bg-red-100' : 'bg-amber-100'}`}>
                      <AlertTriangle className={`h-4 w-4 ${f.severity === 'MUST' ? 'text-red-600' : 'text-amber-600'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${sev.bg} ${sev.color}`}>
                          {sev.label}
                        </span>
                        <span className="font-mono text-xs text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded">{f.clause}</span>
                        <span className="font-medium text-sm text-neutral-900">{f.title}</span>
                      </div>
                      <p className="mt-1 text-sm text-neutral-600 line-clamp-2">{f.description}</p>
                      {f.confidence != null && (
                        <div className="mt-2 flex items-center gap-2">
                          <div className="h-1.5 w-16 rounded-full bg-neutral-200">
                            <div className="h-1.5 rounded-full bg-brand-500" style={{ width: `${Math.round(f.confidence * 100)}%` }} />
                          </div>
                          <span className="text-xs text-neutral-400">Confianza: {Math.round(f.confidence * 100)}%</span>
                        </div>
                      )}
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          onClick={() => convertFindingToNCR(f.id)}
                          className="inline-flex items-center gap-1.5 rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 transition-colors"
                        >
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Crear No Conformidad
                        </button>
                        <button
                          onClick={() => deleteFinding(f.id)}
                          className="inline-flex items-center gap-1.5 rounded bg-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-300 transition-colors"
                          title="Eliminar hallazgo"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Eliminar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
