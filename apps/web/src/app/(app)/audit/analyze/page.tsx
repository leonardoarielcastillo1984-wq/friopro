'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import type { DocumentRow, NormativeStandard, AuditRun, AiFinding } from '@/lib/types';

const severityConfig: Record<string, { label: string; color: string }> = {
  MUST: { label: 'OBLIGATORIO', color: 'bg-red-100 text-red-800' },
  SHOULD: { label: 'RECOMENDADO', color: 'bg-yellow-100 text-yellow-800' },
};

export default function AnalyzePage() {
  return (
    <Suspense>
      <AnalyzeContent />
    </Suspense>
  );
}

function AnalyzeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const existingRunId = searchParams.get('runId');

  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [normatives, setNormatives] = useState<NormativeStandard[]>([]);
  const [documentId, setDocumentId] = useState('');
  const [normativeId, setNormativeId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Results
  const [auditRun, setAuditRun] = useState<AuditRun | null>(null);
  const [findings, setFindings] = useState<AiFinding[]>([]);
  const [polling, setPolling] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Timer for analysis duration
  useEffect(() => {
    if (!polling || !auditRun) {
      setElapsedTime(0);
      return;
    }
    
    if (!startTime) {
      setStartTime(Date.now());
    }
    
    const timer = setInterval(() => {
      if (startTime) {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      }
    }, 1000);
    
    return () => clearInterval(timer);
  }, [polling, auditRun, startTime]);

  // Load documents and normatives for selectors
  useEffect(() => {
    async function loadOptions() {
      try {
        const [docsRes, normsRes] = await Promise.all([
          apiFetch<{ documents: DocumentRow[] }>('/documents'),
          apiFetch<{ normativos: NormativeStandard[] }>('/normativos'),
        ]);
        setDocuments(docsRes.documents ?? []);
        setNormatives((normsRes.normativos ?? []).filter((n) => n.status === 'READY'));
      } catch (err: any) {
        if (err?.message === 'Unauthorized') router.push('/login');
      }
    }
    loadOptions();
  }, []);

  // If we have an existing run ID, load it
  useEffect(() => {
    if (existingRunId) {
      loadAuditRun(existingRunId);
    }
  }, [existingRunId]);

  const loadAuditRun = useCallback(async (runId: string) => {
    try {
      const res = await apiFetch<{ run: AuditRun }>(`/audit/runs/${runId}`);
      setAuditRun(res.run);

      if (res.run.status === 'COMPLETED' || res.run.status === 'FAILED') {
        setPolling(false);
        if (res.run.status === 'COMPLETED') {
          const findingsRes = await apiFetch<{ findings: AiFinding[] }>(`/audit/runs/${runId}/findings`);
          setFindings(findingsRes.findings ?? []);
        }
      } else {
        setPolling(true);
      }
    } catch (err: any) {
      setError(err?.message ?? 'Error');
    }
  }, []);

  // Polling for running audits
  useEffect(() => {
    if (!polling || !auditRun) return;
    const interval = setInterval(() => loadAuditRun(auditRun.id), 3000);
    return () => clearInterval(interval);
  }, [polling, auditRun, loadAuditRun]);

  async function startAnalysis() {
    if (!documentId || !normativeId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ auditRun: { id: string; type: string; status: string }; jobId: string }>('/audit/analyze', {
        method: 'POST',
        json: { documentId, normativeId },
      });
      // Start polling the new run
      setPolling(true);
      await loadAuditRun(res.auditRun.id);
    } catch (err: any) {
      setError(err?.message ?? 'Error');
    } finally {
      setLoading(false);
    }
  }

  async function startTenantAudit() {
    if (!confirm('¿Iniciar auditoría completa del tenant? Esto puede tardar varios minutos.')) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ auditRun: { id: string; type: string; status: string } }>('/audit/tenant-audit', {
        method: 'POST',
        json: {},
      });
      setPolling(true);
      await loadAuditRun(res.auditRun.id);
    } catch (err: any) {
      setError(err?.message ?? 'Error');
    } finally {
      setLoading(false);
    }
  }

  async function updateFindingStatus(findingId: string, status: string) {
    try {
      await apiFetch(`/audit/findings/${findingId}`, {
        method: 'PATCH',
        json: { status },
      });
      // Refresh findings
      if (auditRun) {
        const res = await apiFetch<{ findings: AiFinding[] }>(`/audit/runs/${auditRun.id}/findings`);
        setFindings(res.findings ?? []);
      }
    } catch (err: any) {
      setError(err?.message ?? 'Error');
    }
  }

  async function convertFindingToNCR(findingId: string) {
    if (!confirm('¿Convertir este hallazgo en una No Conformidad?')) return;
    try {
      const res = await apiFetch<{ success: boolean; message: string; nonConformity: { id: string; code: string } }>(`/audit/findings/${findingId}/convert-to-ncr`, {
        method: 'POST',
      });
      alert(`✅ ${res.message}\nCódigo: ${res.nonConformity.code}`);
      // Refresh findings
      if (auditRun) {
        const findingsRes = await apiFetch<{ findings: AiFinding[] }>(`/audit/runs/${auditRun.id}/findings`);
        setFindings(findingsRes.findings ?? []);
      }
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
      // Refresh findings
      if (auditRun) {
        const findingsRes = await apiFetch<{ findings: AiFinding[] }>(`/audit/runs/${auditRun.id}/findings`);
        setFindings(findingsRes.findings ?? []);
      }
    } catch (err: any) {
      setError(err?.message ?? 'Error al eliminar hallazgo');
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Análisis de Cumplimiento</h1>
        <button
          className="rounded border border-neutral-300 bg-white px-3 py-2 text-sm hover:bg-neutral-50"
          onClick={() => router.push('/audit')}
        >
          ← Dashboard
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
      )}

      {/* Analysis Form */}
      {!auditRun && (
        <div className="mt-6 rounded border border-neutral-200 bg-white p-6">
          <h2 className="text-lg font-medium">Documento vs Norma</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Seleccioná un documento y una norma para analizar el cumplimiento cláusula por cláusula.
          </p>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700">Documento</label>
              <select
                value={documentId}
                onChange={(e) => setDocumentId(e.target.value)}
                className="mt-1 w-full rounded border border-neutral-300 bg-white px-3 py-2"
              >
                <option value="">Seleccionar documento...</option>
                {documents.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title} ({d.type})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700">Norma</label>
              <select
                value={normativeId}
                onChange={(e) => setNormativeId(e.target.value)}
                className="mt-1 w-full rounded border border-neutral-300 bg-white px-3 py-2"
              >
                <option value="">Seleccionar norma...</option>
                {normatives.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name} ({n.code}) — {n.totalClauses} cláusulas
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 flex gap-3">
            <button
              onClick={startAnalysis}
              disabled={loading || !documentId || !normativeId}
              className="rounded bg-black px-4 py-2 text-white hover:bg-neutral-800 disabled:bg-neutral-400"
            >
              {loading ? 'Analizando...' : 'Iniciar Análisis'}
            </button>
            <button
              onClick={startTenantAudit}
              disabled={loading}
              className="rounded border border-neutral-300 bg-white px-4 py-2 text-sm hover:bg-neutral-50 disabled:opacity-50"
            >
              Auditoría Completa del Tenant
            </button>
          </div>
        </div>
      )}

      {/* Audit Run Status */}
      {auditRun && (
        <div className="mt-6">
          <div className="rounded border border-neutral-200 bg-white p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium">
                {auditRun.type === 'document_vs_norma'
                  ? `${auditRun.document?.title ?? 'Documento'} vs ${auditRun.normative?.name ?? 'Norma'}`
                  : 'Auditoría Completa'}
              </h2>
              <span
                className={`rounded-full px-3 py-1 text-sm font-medium ${
                  auditRun.status === 'COMPLETED'
                    ? 'bg-green-100 text-green-800'
                    : auditRun.status === 'FAILED'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-yellow-100 text-yellow-800'
                }`}
              >
                {auditRun.status === 'RUNNING' ? 'Analizando...' : auditRun.status}
              </span>
            </div>

            {(auditRun.status === 'QUEUED' || auditRun.status === 'RUNNING') && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-neutral-700">
                      {auditRun.totalClauses > 0 
                        ? `${Math.round((auditRun.coveredClauses / auditRun.totalClauses) * 100)}%` 
                        : '0%'}
                    </span>
                    <span className="text-xs font-mono text-blue-600 bg-blue-50 px-2 py-1 rounded">
                      ⏱️ {formatTime(elapsedTime)}
                    </span>
                  </div>
                  <span className="text-xs text-neutral-500">
                    {auditRun.coveredClauses} de {auditRun.totalClauses} cláusulas analizadas
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200">
                  <div 
                    className="h-2 animate-pulse rounded-full bg-yellow-500 transition-all duration-500" 
                    style={{ width: `${auditRun.totalClauses > 0 ? (auditRun.coveredClauses / auditRun.totalClauses) * 100 : 0}%` }} 
                  />
                </div>
                <p className="mt-2 text-sm text-neutral-500">La IA está analizando el cumplimiento...</p>
              </div>
            )}

            {auditRun.status === 'FAILED' && (
              <div className="mt-4 rounded bg-red-50 p-3 text-sm text-red-700">
                {auditRun.error ?? 'Error desconocido'}
              </div>
            )}

            {auditRun.status === 'COMPLETED' && (
              <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded bg-neutral-50 p-3 text-center">
                  <div className="text-2xl font-bold">{auditRun.totalClauses}</div>
                  <div className="text-xs text-neutral-500">Total Cláusulas</div>
                </div>
                <div className="rounded bg-green-50 p-3 text-center">
                  <div className="text-2xl font-bold text-green-700">{auditRun.coveredClauses}</div>
                  <div className="text-xs text-green-600">Cubiertas</div>
                </div>
                <div className="rounded bg-red-50 p-3 text-center">
                  <div className="text-2xl font-bold text-red-700">{auditRun.missingClauses}</div>
                  <div className="text-xs text-red-600">Faltantes</div>
                </div>
                <div className="rounded bg-yellow-50 p-3 text-center">
                  <div className="text-2xl font-bold text-yellow-700">{auditRun.findingsCount}</div>
                  <div className="text-xs text-yellow-600">Hallazgos</div>
                </div>
              </div>
            )}
          </div>

          {/* Findings List */}
          {findings.length > 0 && (
            <div className="mt-6">
              <h2 className="text-lg font-semibold">Hallazgos ({findings.length})</h2>
              <div className="mt-3 space-y-3">
                {findings.map((f) => (
                  <div key={f.id} className="rounded border border-neutral-200 bg-white p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${severityConfig[f.severity]?.color ?? 'bg-neutral-100 text-neutral-800'}`}>
                          {severityConfig[f.severity]?.label ?? f.severity}
                        </span>
                        <span className="font-mono text-sm text-neutral-500">{f.clause}</span>
                        <span className="font-medium">{f.title}</span>
                      </div>
                      <select
                        value={f.status}
                        onChange={(e) => updateFindingStatus(f.id, e.target.value)}
                        className="rounded border border-neutral-300 px-2 py-1 text-xs"
                      >
                        <option value="OPEN">Abierto</option>
                        <option value="IN_PROGRESS">En Proceso</option>
                        <option value="RESOLVED">Resuelto</option>
                        <option value="CLOSED">Cerrado</option>
                      </select>
                      <button
                        onClick={() => convertFindingToNCR(f.id)}
                        className="ml-2 rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700"
                        title="Convertir a No Conformidad"
                      >
                        Crear NCR
                      </button>
                      <button
                        onClick={() => deleteFinding(f.id)}
                        className="ml-2 rounded bg-neutral-400 px-2 py-1 text-xs text-white hover:bg-neutral-500"
                        title="Eliminar hallazgo"
                      >
                        🗑️
                      </button>
                    </div>
                    <p className="mt-2 text-sm text-neutral-600">{f.description}</p>
                    {f.evidence && (
                      <div className="mt-2 rounded bg-neutral-50 p-2 text-xs text-neutral-500">
                        <strong>Evidencia:</strong> {f.evidence}
                      </div>
                    )}
                    {f.suggestedActions && f.suggestedActions.length > 0 && (
                      <div className="mt-2 text-xs text-blue-600">
                        <strong>Acciones sugeridas:</strong>{' '}
                        {f.suggestedActions
                          .map((a: any) => (typeof a === 'string' ? a : a?.action ?? a?.text ?? JSON.stringify(a)))
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    )}
                    {f.confidence != null && (
                      <div className="mt-1 flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-neutral-200">
                          <div
                            className="h-1.5 rounded-full bg-blue-500"
                            style={{ width: `${f.confidence * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-neutral-400">{Math.round(f.confidence * 100)}%</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* New Analysis button */}
          <button
            className="mt-6 rounded border border-neutral-300 bg-white px-4 py-2 text-sm hover:bg-neutral-50"
            onClick={() => {
              setAuditRun(null);
              setFindings([]);
              setPolling(false);
              router.push('/audit/analyze');
            }}
          >
            Nuevo Análisis
          </button>
        </div>
      )}
    </div>
  );
}
