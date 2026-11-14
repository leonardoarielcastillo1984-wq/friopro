'use client';
// ============================================================
// Auditor IA — Workspace (P1 principal, estilo mockup)
// Selector de norma → última revisión → KPIs + matriz de
// requisitos + panel de detalle + trazabilidad + consulta.
// ============================================================
import { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Play, FileText, AlertTriangle, Loader2, Sparkles, ChevronRight,
  CheckCircle2, Clock3, FileSearch, SendHorizonal, RefreshCw, XCircle,
  FolderSearch, ArrowRight,
} from 'lucide-react';
import {
  normas, listReviews, getReview, getEvaluation, consultar,
  createReview, estimateReview, cancelReview, retryReview, L,
  type Norma, type ReviewSummary, type ReviewDetail, type EvaluationRow,
  type EvaluationDetail,
} from './_lib/api';
import { apiPath } from '@/lib/api';

// ── Chips de estado por evaluación ───────────────────────────
type Chip = { label: string; cls: string };

function evalChip(e: EvaluationRow): Chip {
  if (e.humanDecision === 'PENDING' && e.aiVerdict !== 'NONE')
    return { label: 'Por validar', cls: 'bg-amber-100 text-amber-700' };
  if (e.humanDecision === 'VALIDATED' || e.humanDecision === 'NA_APPROVED')
    return { label: 'Con evidencia', cls: 'bg-emerald-100 text-emerald-700' };
  if (e.evidenceStatus === 'ABSENT')
    return { label: 'Sin evidencia', cls: 'bg-rose-100 text-rose-700' };
  if (e.evidenceStatus === 'FOUND' || e.evidenceStatus === 'PARTIAL')
    return { label: 'Con evidencia', cls: 'bg-emerald-100 text-emerald-700' };
  if (e.evidenceStatus === 'SOURCE_UNAVAILABLE')
    return { label: 'Fuente no disp.', cls: 'bg-slate-100 text-slate-600' };
  if (e.humanDecision === 'NA_PROPOSED')
    return { label: 'N/A propuesta', cls: 'bg-indigo-100 text-indigo-700' };
  return { label: L.workStatus[e.workStatus] ?? 'En proceso', cls: 'bg-slate-100 text-slate-600' };
}

function KpiCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3.5">
      <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${tone}`}>{icon}</span>
      <div>
        <div className="text-[12px] text-neutral-500">{label}</div>
        <div className="text-xl font-semibold text-neutral-900 leading-tight">{value}</div>
      </div>
    </div>
  );
}

function Step({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-[12px] font-medium text-neutral-700">
      {children}
    </span>
  );
}

export default function AuditorIaPage() {
  const [norms, setNorms] = useState<Norma[]>([]);
  const [reviews, setReviews] = useState<ReviewSummary[]>([]);
  const [normaCode, setNormaCode] = useState('');
  const [review, setReview] = useState<ReviewDetail | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<EvaluationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [modal, setModal] = useState(false);
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState<{ answer: string; citations: Array<{ ref: string; text: string }>; outOfScope: boolean } | null>(null);

  // ── Carga inicial ─────────────────────────────────────────
  const load = useCallback(async () => {
    const [n, r] = await Promise.all([normas(), listReviews('?limit=50')]);
    const items = n.items ?? [];
    setNorms(items);
    setReviews(r.items ?? []);
    if (!normaCode && items.length) {
      const withExtraction = items.find((x) => x.extraction);
      setNormaCode((withExtraction ?? items[0]).code);
    }
    setLoading(false);
  }, [normaCode]);

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedNorma = useMemo(
    () => norms.find((n) => n.code === normaCode) ?? null,
    [norms, normaCode],
  );

  // Última revisión de la norma seleccionada
  const latestReviewSummary = useMemo(() => {
    if (!selectedNorma) return null;
    const candidates = reviews.filter(
      (r) => r.extraction?.normative.code === selectedNorma.code && r.status !== 'DRAFT',
    );
    return candidates[0] ?? null;
  }, [reviews, selectedNorma]);

  // Carga detalle de la revisión activa
  useEffect(() => {
    setReview(null); setSelectedId(null); setDetail(null); setAnswer(null);
    if (!latestReviewSummary) return;
    getReview(latestReviewSummary.id).then(setReview).catch(() => setReview(null));
  }, [latestReviewSummary?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll mientras la revisión corre
  const running = review?.status === 'RUNNING' || review?.status === 'QUEUED';
  useEffect(() => {
    if (!running || !review) return;
    const t = setInterval(async () => {
      const d = await getReview(review.id).catch(() => null);
      if (d) setReview(d);
    }, 5000);
    return () => clearInterval(t);
  }, [running, review?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Selección de evaluación → detalle para el panel derecho
  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    setLoadingDetail(true);
    getEvaluation(selectedId)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setLoadingDetail(false));
  }, [selectedId]);

  // Auto-seleccionar la primera evaluación "por validar" o la primera
  useEffect(() => {
    if (!review || selectedId) return;
    const first =
      review.evaluations.find((e) => e.humanDecision === 'PENDING' && e.aiVerdict !== 'NONE')
      ?? review.evaluations[0];
    if (first) setSelectedId(first.id);
  }, [review, selectedId]);

  // ── KPIs ──────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const evs = review?.evaluations ?? [];
    return {
      total: evs.length,
      conEvidencia: evs.filter((e) => e.evidenceStatus === 'FOUND' || e.evidenceStatus === 'PARTIAL').length,
      porValidar: evs.filter((e) => e.humanDecision === 'PENDING' && e.aiVerdict !== 'NONE').length,
      sinEvidencia: evs.filter((e) => e.evidenceStatus === 'ABSENT').length,
    };
  }, [review]);

  const selectedEval = review?.evaluations.find((e) => e.id === selectedId) ?? null;

  const ask = async (q: string) => {
    if (!review || !q.trim()) return;
    setAsking(true); setAnswer(null);
    try {
      const r = await consultar(review.id, q.trim());
      setAnswer(r);
    } catch {
      setAnswer({ answer: 'No se pudo obtener respuesta.', citations: [], outOfScope: false });
    } finally {
      setAsking(false);
    }
  };

  const handleCancel = async () => {
    if (!review) return;
    await cancelReview(review.id); load();
  };
  const handleRetry = async () => {
    if (!review) return;
    await retryReview(review.id); load();
  };

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <h1 className="text-lg font-semibold text-neutral-900">Auditor IA</h1>
            <p className="text-[12px] text-neutral-500 -mt-0.5">Cumplimiento normativo con evidencia trazable</p>
          </div>
        </div>
        <button
          onClick={() => setModal(true)}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-blue-700"
        >
          <Play className="h-3.5 w-3.5" /> Iniciar revisión
        </button>
      </div>

      {/* Selector de norma + fuente */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-[13px] font-medium text-neutral-600">Norma:</label>
          <select
            value={normaCode}
            onChange={(e) => setNormaCode(e.target.value)}
            className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[13px] text-neutral-800"
          >
            {norms.map((n) => (
              <option key={n.id} value={n.code}>
                {n.name} · {n.extraction ? 'versión cargada' : 'sin extracción'}
              </option>
            ))}
          </select>
        </div>
        <span className="flex items-center gap-1.5 text-[12px] text-neutral-400">
          <FileText className="h-3.5 w-3.5" /> Fuente: Normativos / PDF
        </span>
        {running && review && (
          <span className="ml-auto flex items-center gap-2 text-[12px] text-blue-600">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Revisión en curso {review.progress}%
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-neutral-400">
          <Loader2 className="h-4 w-4 animate-spin mr-2" /> Cargando…
        </div>
      ) : !review ? (
        /* Sin revisión para la norma */
        <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 py-16 text-center">
          <Play className="mx-auto h-8 w-8 text-neutral-300 mb-3" />
          <p className="text-sm text-neutral-600 font-medium">
            {selectedNorma?.extraction
              ? 'Todavía no hay revisiones para esta norma'
              : 'Esta norma no tiene extracción aprobada'}
          </p>
          <p className="text-[13px] text-neutral-400 mt-1 mb-4">
            {selectedNorma?.extraction
              ? 'Iniciá una revisión para evaluar los requisitos contra la evidencia del SGI.'
              : 'Primero extraé y aprobá los requisitos de la norma en Extracción normativa.'}
          </p>
          {selectedNorma?.extraction ? (
            <button onClick={() => setModal(true)} className="text-[13px] font-medium text-blue-600 hover:underline">
              Iniciar revisión →
            </button>
          ) : (
            <Link href="/auditor-ia/normas" className="text-[13px] font-medium text-blue-600 hover:underline">
              Ir a Extracción normativa →
            </Link>
          )}
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard icon={<FileText className="h-4 w-4" />} label="Requisitos revisados" value={kpis.total} tone="bg-blue-50 text-blue-600" />
            <KpiCard icon={<CheckCircle2 className="h-4 w-4" />} label="Con evidencia" value={kpis.conEvidencia} tone="bg-emerald-50 text-emerald-600" />
            <KpiCard icon={<Clock3 className="h-4 w-4" />} label="Por validar" value={kpis.porValidar} tone="bg-amber-50 text-amber-600" />
            <KpiCard icon={<AlertTriangle className="h-4 w-4" />} label="Sin evidencia" value={kpis.sinEvidencia} tone="bg-rose-50 text-rose-600" />
          </div>

          {/* Matriz + panel derecho */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Matriz */}
            <div className="lg:col-span-2 rounded-xl border border-neutral-200 bg-white overflow-hidden">
              <div className="px-4 py-3 border-b border-neutral-100 flex items-center justify-between">
                <h2 className="text-[14px] font-semibold text-neutral-900">Matriz de requisitos y evidencias</h2>
                <div className="flex items-center gap-2">
                  {running && (
                    <button onClick={handleCancel} className="flex items-center gap-1 rounded-md border border-rose-200 px-2 py-1 text-[11px] font-medium text-rose-600 hover:bg-rose-50">
                      <XCircle className="h-3 w-3" /> Cancelar
                    </button>
                  )}
                  {(review.status === 'FAILED' || review.status === 'PARTIAL' || review.status === 'CANCELLED') && (
                    <button onClick={handleRetry} className="flex items-center gap-1 rounded-md border border-neutral-200 px-2 py-1 text-[11px] font-medium text-neutral-600 hover:border-blue-300 hover:text-blue-600">
                      <RefreshCw className="h-3 w-3" /> Reintentar
                    </button>
                  )}
                  <a href={apiPath(`/auditor-ia/revisiones/${review.id}/informe.pdf`)} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1 rounded-md border border-neutral-200 px-2 py-1 text-[11px] font-medium text-neutral-600 hover:border-blue-300 hover:text-blue-600">
                    <FileText className="h-3 w-3" /> Informe
                  </a>
                </div>
              </div>
              <div className="max-h-[420px] overflow-y-auto divide-y divide-neutral-100">
                {review.evaluations.map((e) => {
                  const chip = evalChip(e);
                  const active = e.id === selectedId;
                  return (
                    <button
                      key={e.id}
                      onClick={() => setSelectedId(e.id)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-blue-50/40 transition-colors ${active ? 'bg-blue-50/70' : ''}`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-medium text-neutral-900 truncate">
                          {e.requirement.code} {shortTitle(e.requirement.statement)}
                        </div>
                        <div className="text-[11px] text-neutral-400">
                          {e.requirement.clauseNumber} · {L.evidenceStatus[e.evidenceStatus] ?? e.evidenceStatus}
                        </div>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${chip.cls}`}>
                        {chip.label}
                      </span>
                      <ChevronRight className="h-4 w-4 text-neutral-300 shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Panel derecho — revisión del requisito seleccionado */}
            <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
              {loadingDetail ? (
                <div className="flex items-center justify-center py-16 text-sm text-neutral-400">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" /> Cargando…
                </div>
              ) : !detail || !selectedEval ? (
                <div className="px-4 py-12 text-center text-[13px] text-neutral-400">
                  Seleccioná un requisito de la matriz
                </div>
              ) : (
                <div>
                  <div className="px-4 py-3 border-b border-neutral-100 flex items-center justify-between">
                    <h3 className="text-[13px] font-semibold text-neutral-900">
                      Revisión de {detail.requirement.code}
                    </h3>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${evalChip(selectedEval).cls}`}>
                      {evalChip(selectedEval).label}
                    </span>
                  </div>
                  <div className="px-4 py-3 space-y-4">
                    <p className="text-[12px] text-neutral-600 leading-relaxed line-clamp-4">
                      {detail.requirement.statement}
                    </p>

                    {/* Fuentes consultadas */}
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400 mb-1.5">
                        Fuentes consultadas
                      </div>
                      <div className="space-y-1">
                        <Link
                          href={`/auditor-ia/normas/${detail.review.normativeId}?requisito=${selectedEval.requirementId}`}
                          className="flex items-center gap-2 text-[12px] text-blue-600 hover:underline"
                        >
                          <FileSearch className="h-3.5 w-3.5" /> Ver requisito en PDF
                        </Link>
                        {(detail.sourcesConsulted ?? []).map((k) => (
                          <div key={k} className="flex items-center gap-2 text-[12px] text-neutral-600">
                            <FolderSearch className="h-3.5 w-3.5 text-neutral-400" />
                            {L.connector[k] ?? k}
                          </div>
                        ))}
                        {detail.evidenceLinks.slice(0, 3).map((l) => (
                          <div key={l.id} className="flex items-center gap-2 text-[12px] text-neutral-600">
                            <FileText className="h-3.5 w-3.5 text-neutral-400" />
                            <span className="truncate">{l.title}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Sugerencia del agente */}
                    {(detail.explanation || detail.aiVerdict !== 'NONE') && (
                      <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3">
                        <div className="flex items-center gap-1.5 text-[12px] font-semibold text-blue-700 mb-1">
                          <Sparkles className="h-3.5 w-3.5" /> Sugerencia del agente
                        </div>
                        <p className="text-[12px] text-neutral-600 leading-relaxed line-clamp-4">
                          {detail.explanation ?? L.aiVerdict[detail.aiVerdict] ?? detail.aiVerdict}
                        </p>
                        <div className="flex gap-2 mt-2.5">
                          <Link
                            href={`/auditor-ia/revisiones/${review.id}?evaluacion=${detail.id}`}
                            className="rounded-md bg-blue-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-blue-700"
                          >
                            Revisar propuesta
                          </Link>
                          <button
                            onClick={() => setSelectedId(null)}
                            className="rounded-md border border-neutral-200 px-3 py-1.5 text-[11px] font-medium text-neutral-600 hover:bg-neutral-50"
                          >
                            Descartar
                          </button>
                        </div>
                        <p className="text-[10px] text-neutral-400 mt-2">
                          Las propuestas requieren validación del responsable.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Trazabilidad */}
          {selectedEval && (
            <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
              <div className="text-[12px] font-semibold text-neutral-700 mb-2">
                Trazabilidad del requisito seleccionado
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Step><FileText className="h-3.5 w-3.5 text-neutral-400" /> Normativos · PDF</Step>
                <ArrowRight className="h-3.5 w-3.5 text-neutral-300" />
                <Step><FileSearch className="h-3.5 w-3.5 text-neutral-400" /> Requisito {selectedEval.requirement.code}</Step>
                <ArrowRight className="h-3.5 w-3.5 text-neutral-300" />
                <Step>
                  <FolderSearch className="h-3.5 w-3.5 text-neutral-400" />
                  {(detail?.sourcesConsulted ?? []).length
                    ? (detail!.sourcesConsulted ?? []).map((k) => L.connector[k] ?? k).join(' + ')
                    : 'Fuentes SGI'}
                </Step>
                <ArrowRight className="h-3.5 w-3.5 text-neutral-300" />
                <Step><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Evaluación</Step>
              </div>
            </div>
          )}

          {/* Consulta conversacional */}
          <div className="rounded-xl border border-neutral-200 bg-white p-3">
            {answer && (
              <div className="mb-3 rounded-lg bg-neutral-50 border border-neutral-100 px-3 py-2.5">
                <p className="text-[13px] text-neutral-700 leading-relaxed whitespace-pre-wrap">{answer.answer}</p>
                {answer.citations.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {answer.citations.slice(0, 6).map((c) => (
                      <span key={c.ref} title={c.text}
                        className="rounded-full bg-blue-50 border border-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                        {c.ref}
                      </span>
                    ))}
                  </div>
                )}
                {answer.outOfScope && (
                  <p className="mt-1.5 text-[11px] text-amber-600">La consulta está fuera del alcance de esta revisión.</p>
                )}
              </div>
            )}
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-500 shrink-0" />
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { ask(question); setQuestion(''); } }}
                placeholder="Consultá un requisito o pedí revisar un proceso…"
                className="flex-1 text-[13px] outline-none placeholder:text-neutral-400"
              />
              <button
                onClick={() => { ask('¿Qué evidencia falta?'); }}
                className="shrink-0 rounded-full border border-neutral-200 px-3 py-1.5 text-[11px] font-medium text-neutral-600 hover:border-blue-300 hover:text-blue-600"
              >
                ¿Qué evidencia falta?
              </button>
              <Link
                href={`/auditor-ia/revisiones/${review.id}/preparacion`}
                className="shrink-0 rounded-full border border-neutral-200 px-3 py-1.5 text-[11px] font-medium text-neutral-600 hover:border-blue-300 hover:text-blue-600"
              >
                Preparar auditoría
              </Link>
              <button
                onClick={() => { ask(question); setQuestion(''); }}
                disabled={asking || !question.trim()}
                className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {asking ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </>
      )}

      {modal && (
        <StartReviewModal
          onClose={() => setModal(false)}
          onCreated={() => { setModal(false); load(); }}
        />
      )}
    </div>
  );
}

// Título corto del requisito: primera oración o primeras ~8 palabras
function shortTitle(statement: string): string {
  const clean = statement.replace(/\s+/g, ' ').trim();
  const cut = clean.split(/[.¡!¿?]/)[0] ?? clean;
  return cut.length > 60 ? `${cut.slice(0, 57)}…` : cut;
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
            <Link href="/auditor-ia/normas" className="text-blue-600 hover:underline" onClick={onClose}>
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
              <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-[12px] text-blue-700">
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
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-blue-700 disabled:opacity-50"
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
