'use client';
// ============================================================
// Auditor IA — Revisiones (P1 principal)
// Lista de revisiones + botón "Iniciar revisión" (P1a) + estados.
// ============================================================
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Plus, Play, XCircle, RefreshCw, FileText, AlertTriangle, Loader2 } from 'lucide-react';
import { listReviews, normas, createReview, estimateReview, cancelReview, retryReview, L, type ReviewSummary, type Norma } from './_lib/api';
import { apiPath } from '@/lib/api';

const STATUS_COLOR: Record<string, string> = {
  QUEUED: 'bg-slate-100 text-slate-600', RUNNING: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700', PARTIAL: 'bg-amber-100 text-amber-700',
  FAILED: 'bg-rose-100 text-rose-700', CANCELLED: 'bg-slate-100 text-slate-500',
  DRAFT: 'bg-slate-100 text-slate-600',
};

function fmtDate(s: string | null) {
  return s ? new Date(s).toLocaleDateString('es-AR') : '—';
}

export default function AuditorIaPage() {
  const [reviews, setReviews] = useState<ReviewSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);

  const load = useCallback(async () => {
    const r = await listReviews('?limit=25');
    setReviews(r.items ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Poll mientras haya revisión en curso
  const running = reviews.some((r) => r.status === 'RUNNING' || r.status === 'QUEUED');
  useEffect(() => {
    if (!running) return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [running, load]);

  const handleCancel = async (id: string) => {
    await cancelReview(id);
    load();
  };
  const handleRetry = async (id: string) => {
    await retryReview(id);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Revisiones de cumplimiento</h1>
          <p className="text-[13px] text-neutral-500 mt-0.5">
            Evaluación de requisitos normativos contra la evidencia digital del SGI.
            La IA propone — la persona decide.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/auditor-ia/normas" className="rounded-lg border border-neutral-200 px-3 py-2 text-[13px] font-medium text-neutral-700 hover:bg-neutral-50">
            Extracción normativa
          </Link>
          <button
            onClick={() => setModal(true)}
            className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-[13px] font-medium text-white hover:bg-violet-700"
          >
            <Plus className="h-4 w-4" /> Iniciar revisión
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-neutral-400">
          <Loader2 className="h-4 w-4 animate-spin mr-2" /> Cargando…
        </div>
      ) : reviews.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 py-16 text-center">
          <Play className="mx-auto h-8 w-8 text-neutral-300 mb-3" />
          <p className="text-sm text-neutral-600 font-medium">Todavía no hay revisiones</p>
          <p className="text-[13px] text-neutral-400 mt-1 mb-4">
            Primero extraé los requisitos de una norma y luego iniciá una revisión.
          </p>
          <Link href="/auditor-ia/normas" className="text-[13px] font-medium text-violet-600 hover:underline">
            Ir a Extracción normativa →
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {reviews.map((r) => (
            <Link
              key={r.id}
              href={`/auditor-ia/revisiones/${r.id}`}
              className="block rounded-xl border border-neutral-200 bg-white p-4 hover:border-violet-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-neutral-900 truncate">
                      {r.extraction?.normative.name ?? 'Revisión'}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_COLOR[r.status] ?? STATUS_COLOR.DRAFT}`}>
                      {L.reviewStatus[r.status] ?? r.status}
                    </span>
                  </div>
                  <div className="mt-1 text-[12px] text-neutral-500">
                    {r.extraction?.normative.code} {r.extraction?.normative.version} ·
                    {' '}{fmtDate(r.periodFrom)} → {fmtDate(r.periodTo)} ·
                    {' '}{r.sites?.length ? r.sites.join(', ') : 'todas las sedes'}
                  </div>
                  {r.status === 'RUNNING' && (
                    <div className="mt-2">
                      <div className="h-1.5 w-64 rounded-full bg-neutral-100 overflow-hidden">
                        <div className="h-full bg-violet-500 transition-all" style={{ width: `${r.progress}%` }} />
                      </div>
                      <span className="text-[11px] text-neutral-400">{r.progress}%</span>
                    </div>
                  )}
                  {r.status === 'PARTIAL' && (
                    <div className="mt-1.5 flex items-center gap-1 text-[11px] text-amber-600">
                      <AlertTriangle className="h-3 w-3" /> Algunos requisitos no se evaluaron
                    </div>
                  )}
                  {r.error && <div className="mt-1 text-[11px] text-rose-600 truncate">{r.error}</div>}
                </div>
                <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.preventDefault()}>
                  {(r.status === 'COMPLETED' || r.status === 'PARTIAL') && (
                    <>
                      <a
                        href={apiPath(`/auditor-ia/revisiones/${r.id}/informe.pdf`)}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="rounded-md border border-neutral-200 p-1.5 text-neutral-500 hover:text-violet-600 hover:border-violet-300"
                        title="Informe PDF"
                      >
                        <FileText className="h-4 w-4" />
                      </a>
                      <Link
                        href={`/auditor-ia/revisiones/${r.id}/preparacion`}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded-md border border-neutral-200 px-2 py-1.5 text-[11px] font-medium text-neutral-600 hover:border-violet-300 hover:text-violet-600"
                      >
                        Preparación
                      </Link>
                    </>
                  )}
                  {r.status === 'RUNNING' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleCancel(r.id); }}
                      className="flex items-center gap-1 rounded-md border border-rose-200 px-2 py-1.5 text-[11px] font-medium text-rose-600 hover:bg-rose-50"
                    >
                      <XCircle className="h-3.5 w-3.5" /> Cancelar
                    </button>
                  )}
                  {(r.status === 'FAILED' || r.status === 'PARTIAL' || r.status === 'CANCELLED') && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRetry(r.id); }}
                      className="flex items-center gap-1 rounded-md border border-neutral-200 px-2 py-1.5 text-[11px] font-medium text-neutral-600 hover:border-violet-300 hover:text-violet-600"
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> Reintentar
                    </button>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {modal && <StartReviewModal onClose={() => setModal(false)} onCreated={() => { setModal(false); load(); }} />}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// P1a — Modal "Iniciar revisión"
// ════════════════════════════════════════════════════════════
function StartReviewModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [approved, setApproved] = useState<Norma[]>([]);
  const [extractionId, setExtractionId] = useState('');
  const [scope, setScope] = useState('');
  const [sites, setSites] = useState('');
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');
  const [est, setEst] = useState<{ requirements: number; estTokens: number } | null>(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    normas().then((r) => {
      const withApproved = (r.items ?? []).filter((n) => n.extraction?.status === 'APPROVED');
      setApproved(withApproved);
      if (withApproved.length === 1) setExtractionId(withApproved[0].extraction!.id);
    });
  }, []);

  useEffect(() => {
    if (!extractionId) { setEst(null); return; }
    estimateReview(extractionId).then(setEst).catch(() => setEst(null));
  }, [extractionId]);

  const submit = async () => {
    setCreating(true);
    setError('');
    try {
      await createReview({
        extractionId,
        scope: scope || undefined,
        sites: sites ? sites.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
        periodFrom: periodFrom || undefined,
        periodTo: periodTo || undefined,
      });
      onCreated();
    } catch (e) {
      const err = e as { error?: string; message?: string };
      setError(err.message ?? err.error ?? 'No se pudo crear la revisión');
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold">Iniciar revisión</h3>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600">✕</button>
        </div>

        {approved.length === 0 ? (
          <div className="text-sm text-neutral-500 py-4">
            No hay extracciones aprobadas. Primero extraé y aprobá los requisitos de una norma en{' '}
            <Link href="/auditor-ia/normas" className="text-violet-600 hover:underline" onClick={onClose}>
              Extracción normativa
            </Link>.
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-[12px] font-medium text-neutral-600">Norma (extracción aprobada)</label>
              <select
                value={extractionId}
                onChange={(e) => setExtractionId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              >
                <option value="">Seleccionar…</option>
                {approved.map((n) => (
                  <option key={n.extraction!.id} value={n.extraction!.id}>
                    {n.name} {n.version} (rev. {n.extraction!.revision}, {n.extraction!.requirementCount} req.)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[12px] font-medium text-neutral-600">Alcance</label>
              <input
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                placeholder="Ej: Gestión de calidad — planta central"
                className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="text-[12px] font-medium text-neutral-600">Sedes (separadas por coma)</label>
              <input
                value={sites}
                onChange={(e) => setSites(e.target.value)}
                placeholder="Todas"
                className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[12px] font-medium text-neutral-600">Período desde</label>
                <input type="date" value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-[12px] font-medium text-neutral-600">hasta</label>
                <input type="date" value={periodTo} onChange={(e) => setPeriodTo(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" />
              </div>
            </div>

            {est && (
              <div className="rounded-lg bg-violet-50 border border-violet-200 px-3 py-2 text-[12px] text-violet-700">
                {est.requirements} requisitos a evaluar · ~{est.estTokens.toLocaleString()} tokens estimados
              </div>
            )}

            {error && <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-[12px] text-rose-700">{error}</div>}

            <div className="flex justify-end gap-2 pt-1">
              <button onClick={onClose} className="rounded-lg border border-neutral-200 px-3 py-2 text-[13px]">
                Cancelar
              </button>
              <button
                onClick={submit}
                disabled={!extractionId || creating}
                className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-violet-700 disabled:opacity-50"
              >
                {creating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Iniciar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
