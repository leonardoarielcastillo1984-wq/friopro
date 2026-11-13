'use client';
// ============================================================
// Auditor IA — Detalle de revisión: matriz de evaluaciones
// + inspector lateral (P1b: dictamen, evidencias, decisiones,
// N/A, evidencia manual, hallazgos, consulta acotada).
// ============================================================
import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Loader2, RefreshCw, FileText, MessageSquare,
  AlertTriangle, CheckCircle2, XCircle, Plus, Trash2, Send, Sparkles,
} from 'lucide-react';
import {
  getReview, getEvaluation, decideEvaluation, proposeNA, approveNA,
  reevaluate, checkStaleness, searchConnector, addEvidence, removeEvidence,
  createFinding, listFindings, validateFinding, findingToNCR, findingToPlan,
  consultar, cancelReview, retryReview, L,
  type ReviewDetail, type EvaluationDetail, type Finding, type EvaluationRow,
} from '../../_lib/api';
import { apiPath } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { hasModulePermission } from '@/hooks/useModulePermission';

const AXIS_COLOR: Record<string, Record<string, string>> = {
  workStatus: {
    EVALUATED: 'bg-emerald-100 text-emerald-700', STALE: 'bg-amber-100 text-amber-700',
    CANNOT_EVALUATE: 'bg-rose-100 text-rose-700', PENDING: 'bg-slate-100 text-slate-600',
    IN_PROGRESS: 'bg-blue-100 text-blue-700',
  },
  evidenceStatus: {
    FOUND: 'bg-emerald-100 text-emerald-700', PARTIAL: 'bg-amber-100 text-amber-700',
    ABSENT: 'bg-rose-100 text-rose-700', SOURCE_UNAVAILABLE: 'bg-slate-100 text-slate-600',
    NOT_SEARCHED: 'bg-slate-100 text-slate-500',
  },
  aiVerdict: {
    EVIDENCE_SUPPORTS: 'bg-emerald-100 text-emerald-700', POSSIBLE_GAP: 'bg-amber-100 text-amber-700',
    REQUIRES_EXTERNAL_VERIFICATION: 'bg-blue-100 text-blue-700',
    INSUFFICIENT_EVIDENCE: 'bg-amber-100 text-amber-700', NONE: 'bg-slate-100 text-slate-500',
  },
  humanDecision: {
    VALIDATED: 'bg-emerald-100 text-emerald-700', GAP_CONFIRMED: 'bg-rose-100 text-rose-700',
    NA_APPROVED: 'bg-emerald-100 text-emerald-700', NA_REJECTED: 'bg-rose-100 text-rose-700',
    PENDING: 'bg-slate-100 text-slate-600', MORE_EVIDENCE_REQUESTED: 'bg-amber-100 text-amber-700',
    AI_REJECTED: 'bg-slate-100 text-slate-600', NA_PROPOSED: 'bg-blue-100 text-blue-700',
  },
};

function Badge({ axis, value }: { axis: string; value: string }) {
  const map = AXIS_COLOR[axis] ?? {};
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${map[value] ?? 'bg-slate-100 text-slate-600'}`}>
      {L[axis as keyof typeof L]?.[value] ?? value}
    </span>
  );
}

export default function ReviewDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, tenantRole } = useAuth();
  const isAdmin = user?.globalRole === 'SUPER_ADMIN' || tenantRole === 'TENANT_ADMIN';
  const canEdit = isAdmin || hasModulePermission('auditor-ia', 'edit');

  const [review, setReview] = useState<ReviewDetail | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'matriz' | 'hallazgos' | 'consulta'>('matriz');

  const load = useCallback(async () => {
    const r = await getReview(id);
    setReview(r);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (review?.status !== 'RUNNING' && review?.status !== 'QUEUED') return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [review?.status, load]);

  const total = review?.evaluations.length ?? 0;
  const done = review?.evaluations.filter((e) => e.workStatus === 'EVALUATED').length ?? 0;
  const pendingDecisions = review?.evaluations.filter(
    (e) => e.workStatus === 'EVALUATED' && e.humanDecision === 'PENDING',
  ).length ?? 0;

  if (loading) {
    return <div className="flex items-center justify-center py-16 text-sm text-neutral-400"><Loader2 className="h-4 w-4 animate-spin mr-2" /> Cargando…</div>;
  }
  if (!review?.id) {
    return <div className="py-16 text-center text-sm text-neutral-500">Revisión no encontrada.</div>;
  }

  const finished = ['COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED'].includes(review.status);

  return (
    <div className="space-y-4">
      <Link href="/auditor-ia" className="inline-flex items-center gap-1 text-[13px] text-neutral-500 hover:text-violet-600">
        <ArrowLeft className="h-3.5 w-3.5" /> Revisiones
      </Link>

      {/* Cabecera */}
      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-lg font-semibold text-neutral-900">
              {review.extraction.normative.name} <span className="font-normal text-neutral-400">{review.extraction.normative.version}</span>
            </h1>
            <div className="mt-1 flex items-center gap-2 text-[12px] text-neutral-500 flex-wrap">
              <Badge axis="workStatus" value="" />
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                review.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700'
                : review.status === 'RUNNING' ? 'bg-blue-100 text-blue-700'
                : review.status === 'PARTIAL' ? 'bg-amber-100 text-amber-700'
                : 'bg-slate-100 text-slate-600'
              }`}>
                {L.reviewStatus[review.status] ?? review.status}
              </span>
              <span>{review.extraction.normative.code}</span>
              {review.scope && <span>· {review.scope}</span>}
              <span>· {review.periodFrom ? new Date(review.periodFrom).toLocaleDateString('es-AR') : '—'} → {review.periodTo ? new Date(review.periodTo).toLocaleDateString('es-AR') : '—'}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {review.status === 'RUNNING' && canEdit && (
              <button onClick={() => cancelReview(id).then(load)} className="rounded-lg border border-rose-200 px-3 py-1.5 text-[12px] font-medium text-rose-600 hover:bg-rose-50">
                Cancelar
              </button>
            )}
            {finished && canEdit && (
              <>
                <button
                  onClick={async () => { const r = await checkStaleness(id); if (r.markedStale) await load(); }}
                  className="rounded-lg border border-neutral-200 px-3 py-1.5 text-[12px] font-medium text-neutral-600 hover:border-violet-300"
                >
                  Verificar obsoletas
                </button>
                <button onClick={() => retryReview(id).then(load)} className="flex items-center gap-1 rounded-lg border border-neutral-200 px-3 py-1.5 text-[12px] font-medium text-neutral-600 hover:border-violet-300">
                  <RefreshCw className="h-3.5 w-3.5" /> Reintentar
                </button>
              </>
            )}
            <a href={apiPath(`/auditor-ia/revisiones/${id}/informe.pdf`)} target="_blank" rel="noreferrer"
              className="flex items-center gap-1 rounded-lg border border-neutral-200 px-3 py-1.5 text-[12px] font-medium text-neutral-600 hover:border-violet-300">
              <FileText className="h-3.5 w-3.5" /> Informe PDF
            </a>
            <Link href={`/auditor-ia/revisiones/${id}/preparacion`} className="rounded-lg bg-violet-600 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-violet-700">
              Preparación
            </Link>
          </div>
        </div>

        {review.status === 'RUNNING' && (
          <div className="mt-3">
            <div className="h-2 rounded-full bg-neutral-100 overflow-hidden">
              <div className="h-full bg-violet-500 transition-all" style={{ width: `${review.progress}%` }} />
            </div>
            <div className="mt-1 text-[11px] text-neutral-400">{done}/{total} evaluados · {review.progress}%</div>
          </div>
        )}
        {pendingDecisions > 0 && finished && (
          <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[12px] text-amber-700 flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5" /> {pendingDecisions} evaluaciones esperan decisión humana.
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5">
        {([['matriz', 'Matriz'], ['hallazgos', 'Hallazgos'], ['consulta', 'Consulta']] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`rounded-lg px-3 py-1.5 text-[12px] font-medium ${tab === k ? 'bg-violet-600 text-white' : 'bg-white border border-neutral-200 text-neutral-600'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'matriz' && (
        <div className="flex gap-4">
          {/* Matriz */}
          <div className="flex-1 min-w-0 rounded-xl border border-neutral-200 bg-white overflow-hidden overflow-x-auto">
            <table className="w-full text-[12px] min-w-[720px]">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-[10px] uppercase tracking-wide text-neutral-500">
                  <th className="px-3 py-2">Req.</th>
                  <th className="px-3 py-2">Enunciado</th>
                  <th className="px-3 py-2">Trabajo</th>
                  <th className="px-3 py-2">Evidencia</th>
                  <th className="px-3 py-2">Dictamen IA</th>
                  <th className="px-3 py-2">Decisión</th>
                </tr>
              </thead>
              <tbody>
                {review.evaluations.map((ev) => (
                  <tr
                    key={ev.id}
                    onClick={() => setSelected(selected === ev.id ? null : ev.id)}
                    className={`border-b border-neutral-100 last:border-0 cursor-pointer ${
                      selected === ev.id ? 'bg-violet-50' : 'hover:bg-neutral-50'
                    }`}
                  >
                    <td className="px-3 py-2.5 font-semibold text-violet-700 whitespace-nowrap">
                      {ev.requirement.code}
                      <div className="font-normal text-neutral-400">{ev.requirement.clauseNumber}</div>
                    </td>
                    <td className="px-3 py-2.5 max-w-[280px]">
                      <span className="line-clamp-2 text-neutral-800">{ev.requirement.statement}</span>
                    </td>
                    <td className="px-3 py-2.5"><Badge axis="workStatus" value={ev.workStatus} /></td>
                    <td className="px-3 py-2.5"><Badge axis="evidenceStatus" value={ev.evidenceStatus} /></td>
                    <td className="px-3 py-2.5"><Badge axis="aiVerdict" value={ev.aiVerdict} /></td>
                    <td className="px-3 py-2.5"><Badge axis="humanDecision" value={ev.humanDecision} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {review.evaluations.length === 0 && (
              <div className="py-12 text-center text-[13px] text-neutral-400">Sin evaluaciones todavía.</div>
            )}
          </div>

          {/* Inspector */}
          {selected && (
            <Inspector
              key={selected}
              evaluationId={selected}
              canEdit={canEdit}
              isAdmin={isAdmin}
              onClose={() => setSelected(null)}
              onChanged={load}
            />
          )}
        </div>
      )}

      {tab === 'hallazgos' && <FindingsTab reviewId={id} canEdit={canEdit} />}
      {tab === 'consulta' && <ConsultaTab reviewId={id} />}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// Inspector de evaluación (P1b)
// ════════════════════════════════════════════════════════════
function Inspector({
  evaluationId, canEdit, isAdmin, onClose, onChanged,
}: {
  evaluationId: string;
  canEdit: boolean;
  isAdmin: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [ev, setEv] = useState<EvaluationDetail | null>(null);
  const [comment, setComment] = useState('');
  const [naText, setNaText] = useState('');
  const [showNA, setShowNA] = useState(false);
  const [showEvidence, setShowEvidence] = useState(false);
  const [showFinding, setShowFinding] = useState(false);
  const [findingForm, setFindingForm] = useState({ title: '', description: '', severity: 'SHOULD' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setEv(await getEvaluation(evaluationId));
  }, [evaluationId]);
  useEffect(() => { load(); }, [load]);

  if (!ev) {
    return (
      <div className="w-[380px] shrink-0 rounded-xl border border-neutral-200 bg-white p-4">
        <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
      </div>
    );
  }

  const decided = ev.humanDecision !== 'PENDING';
  const naPending = ev.humanDecision === 'NA_PROPOSED';

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try { await fn(); await load(); onChanged(); } finally { setBusy(false); }
  };

  const submitFinding = async () => {
    await act(() => createFinding(evaluationId, findingForm));
    setShowFinding(false);
  };

  return (
    <div className="w-[380px] shrink-0 rounded-xl border border-neutral-200 bg-white flex flex-col max-h-[calc(100vh-12rem)] overflow-hidden">
      {/* Header */}
      <div className="border-b border-neutral-100 px-4 py-3 flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-violet-700">{ev.requirement.code}</span>
            <span className="text-[11px] text-neutral-400">cláusula {ev.requirement.clauseNumber}</span>
            <Badge axis="aiVerdict" value={ev.aiVerdict} />
          </div>
          <p className="mt-1 text-[12px] text-neutral-600">{ev.requirement.statement}</p>
        </div>
        <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 shrink-0">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* Dictamen */}
        {ev.explanation && (
          <section>
            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 mb-1">Dictamen IA</h4>
            <p className="text-[12px] text-neutral-700 leading-relaxed">{ev.explanation}</p>
            {ev.noProvider && (
              <p className="mt-1 text-[11px] text-amber-600">Sin proveedor LLM — veredicto conservador.</p>
            )}
          </section>
        )}

        {/* Limitaciones */}
        {ev.limitations && ev.limitations.length > 0 && (
          <section>
            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 mb-1">Limitaciones</h4>
            <ul className="text-[12px] text-amber-700 list-disc pl-4 space-y-0.5">
              {ev.limitations.map((l, i) => <li key={i}>{l}</li>)}
            </ul>
          </section>
        )}

        {/* Brechas */}
        {ev.gaps && ev.gaps.length > 0 && (
          <section>
            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 mb-1">Brechas detectadas</h4>
            <ul className="text-[12px] text-rose-700 list-disc pl-4 space-y-0.5">
              {ev.gaps.map((g, i) => <li key={i}>{g.description}</li>)}
            </ul>
          </section>
        )}

        {/* Propuestas */}
        {ev.proposals && ev.proposals.length > 0 && (
          <section>
            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 mb-1">Sugerencia del agente</h4>
            <ul className="text-[12px] text-neutral-700 list-disc pl-4 space-y-0.5">
              {ev.proposals.map((p, i) => <li key={i}>{p.action}{p.target ? ` → ${p.target}` : ''}</li>)}
            </ul>
            <p className="mt-1 text-[10px] text-neutral-400 italic">Las propuestas requieren validación del responsable.</p>
          </section>
        )}

        {/* Verificaciones externas */}
        {ev.externalChecks && ev.externalChecks.length > 0 && (
          <section>
            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 mb-1">Verificar externamente</h4>
            <ul className="text-[12px] text-blue-700 list-disc pl-4 space-y-0.5">
              {ev.externalChecks.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          </section>
        )}

        {/* Preguntas para la auditoría */}
        {ev.auditQuestions && ev.auditQuestions.length > 0 && (
          <section>
            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 mb-1">Preguntas sugeridas</h4>
            <ul className="text-[12px] text-neutral-700 list-disc pl-4 space-y-0.5">
              {ev.auditQuestions.map((q, i) => <li key={i}>{q}</li>)}
            </ul>
          </section>
        )}

        {/* Evidencias */}
        <section>
          <div className="flex items-center justify-between mb-1">
            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Evidencias ({ev.evidenceLinks.length})</h4>
            {canEdit && (
              <button onClick={() => setShowEvidence(!showEvidence)} className="text-[11px] text-violet-600 hover:underline flex items-center gap-0.5">
                <Plus className="h-3 w-3" /> Vincular
              </button>
            )}
          </div>
          {ev.evidenceLinks.length === 0 && (
            <p className="text-[12px] text-neutral-400">Sin evidencias. La ausencia de evidencia digital no implica incumplimiento.</p>
          )}
          <ul className="space-y-1">
            {ev.evidenceLinks.map((l) => (
              <li key={l.id} className="flex items-start justify-between gap-2 rounded-lg bg-neutral-50 px-2.5 py-1.5">
                <div className="min-w-0">
                  <div className="text-[12px] font-medium text-neutral-800 truncate">
                    {l.url ? <a href={l.url} className="text-violet-600 hover:underline">{l.title}</a> : l.title}
                  </div>
                  <div className="text-[10px] text-neutral-400">
                    {l.entityType} · {L.connector[l.connectorKey] ?? l.connectorKey}
                    {l.origin === 'MANUAL' && ' · manual'}
                    {l.inPeriod === false && ' · fuera de período'}
                  </div>
                  {l.aiAssessment && <div className="text-[11px] text-neutral-600 mt-0.5">{l.aiAssessment}</div>}
                </div>
                {canEdit && (
                  <button onClick={() => act(() => removeEvidence(evaluationId, l.id))} className="text-neutral-300 hover:text-rose-500 shrink-0">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
          {showEvidence && <EvidencePicker evaluationId={evaluationId} onAdded={() => { setShowEvidence(false); load(); }} />}
        </section>

        {/* Fuentes no disponibles */}
        {ev.sourcesUnavailable && ev.sourcesUnavailable.length > 0 && (
          <section>
            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 mb-1">Fuentes no disponibles</h4>
            <ul className="text-[11px] text-neutral-500 space-y-0.5">
              {ev.sourcesUnavailable.map((s, i) => (
                <li key={i}>{L.connector[s.connectorKey] ?? s.connectorKey}: {s.reason}</li>
              ))}
            </ul>
          </section>
        )}

        {/* Historial */}
        {ev.decisionLogs.length > 0 && (
          <section>
            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 mb-1">Historial</h4>
            <ul className="text-[11px] text-neutral-500 space-y-1">
              {ev.decisionLogs.slice(0, 8).map((d) => (
                <li key={d.id}>
                  <span className="text-neutral-400">{new Date(d.createdAt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                  {' '}{d.axis}: {d.fromValue ?? '—'} → {d.toValue}
                  {d.comment && <span className="block text-neutral-400 truncate">{d.comment}</span>}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {/* Acciones */}
      {canEdit && (
        <div className="border-t border-neutral-100 px-4 py-3 space-y-2">
          {naPending && isAdmin ? (
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-2.5">
              <div className="text-[11px] font-medium text-blue-700 mb-1">N/A propuesta — justificación:</div>
              <p className="text-[11px] text-neutral-600 mb-2">{ev.naJustification}</p>
              <div className="flex gap-2">
                <button onClick={() => act(() => approveNA(evaluationId, true))} disabled={busy}
                  className="flex-1 rounded bg-emerald-600 px-2 py-1.5 text-[11px] font-medium text-white">Aprobar N/A</button>
                <button onClick={() => act(() => approveNA(evaluationId, false))} disabled={busy}
                  className="flex-1 rounded border border-rose-200 px-2 py-1.5 text-[11px] font-medium text-rose-600">Rechazar</button>
              </div>
            </div>
          ) : !decided || naPending ? (
            <>
              <div className="flex gap-1.5">
                <button onClick={() => act(() => decideEvaluation(evaluationId, 'VALIDATED', comment || undefined))} disabled={busy}
                  className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-emerald-600 px-2 py-2 text-[11px] font-medium text-white disabled:opacity-50">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Validar
                </button>
                <button onClick={() => act(() => decideEvaluation(evaluationId, 'GAP_CONFIRMED', comment || undefined))} disabled={busy}
                  className="flex-1 rounded-lg bg-rose-600 px-2 py-2 text-[11px] font-medium text-white disabled:opacity-50">
                  Confirmar brecha
                </button>
              </div>
              <div className="flex gap-1.5">
                <button onClick={() => act(() => decideEvaluation(evaluationId, 'MORE_EVIDENCE_REQUESTED', comment || undefined))} disabled={busy}
                  className="flex-1 rounded-lg border border-neutral-200 px-2 py-1.5 text-[11px] text-neutral-600">Pedir evidencia</button>
                <button onClick={() => act(() => decideEvaluation(evaluationId, 'AI_REJECTED', comment || undefined))} disabled={busy}
                  className="flex-1 rounded-lg border border-neutral-200 px-2 py-1.5 text-[11px] text-neutral-600">Rechazar dictamen</button>
                <button onClick={() => setShowNA(!showNA)} className="rounded-lg border border-neutral-200 px-2 py-1.5 text-[11px] text-neutral-600">N/A</button>
              </div>
            </>
          ) : (
            <div className="text-[12px] text-neutral-500">
              Decisión: <Badge axis="humanDecision" value={ev.humanDecision} />
            </div>
          )}

          {showNA && !naPending && (
            <div className="space-y-1.5">
              <textarea
                value={naText}
                onChange={(e) => setNaText(e.target.value)}
                placeholder="Justificación de no aplicabilidad (mín. 20 caracteres)…"
                rows={2}
                className="w-full rounded-lg border border-neutral-200 px-2.5 py-1.5 text-[12px]"
              />
              <button
                onClick={() => act(() => proposeNA(evaluationId, naText)).then(() => setShowNA(false))}
                disabled={naText.length < 20 || busy}
                className="w-full rounded-lg bg-blue-600 px-2 py-1.5 text-[11px] font-medium text-white disabled:opacity-50"
              >
                Proponer N/A (requiere aprobación admin)
              </button>
            </div>
          )}

          <input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Comentario (opcional)…"
            className="w-full rounded-lg border border-neutral-200 px-2.5 py-1.5 text-[12px]"
          />

          <div className="flex gap-1.5 pt-1">
            <button onClick={() => act(() => reevaluate(evaluationId))} disabled={busy}
              className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-neutral-200 px-2 py-1.5 text-[11px] text-neutral-600">
              <RefreshCw className="h-3 w-3" /> Reevaluar
            </button>
            <button onClick={() => setShowFinding(!showFinding)}
              className="flex-1 rounded-lg border border-violet-200 px-2 py-1.5 text-[11px] font-medium text-violet-700">
              + Hallazgo
            </button>
          </div>

          {showFinding && (
            <div className="space-y-1.5 rounded-lg bg-violet-50 border border-violet-200 p-2.5">
              <input value={findingForm.title} onChange={(e) => setFindingForm({ ...findingForm, title: e.target.value })}
                placeholder="Título del hallazgo" className="w-full rounded border border-neutral-200 px-2 py-1.5 text-[12px]" />
              <textarea value={findingForm.description} onChange={(e) => setFindingForm({ ...findingForm, description: e.target.value })}
                placeholder="Descripción" rows={2} className="w-full rounded border border-neutral-200 px-2 py-1.5 text-[12px]" />
              <div className="flex gap-1.5">
                <select value={findingForm.severity} onChange={(e) => setFindingForm({ ...findingForm, severity: e.target.value })}
                  className="rounded border border-neutral-200 px-2 py-1.5 text-[12px]">
                  <option value="SHOULD">Sugerencia</option>
                  <option value="MUST">Obligatorio</option>
                </select>
                <button onClick={submitFinding} disabled={findingForm.title.length < 5 || findingForm.description.length < 10 || busy}
                  className="flex-1 rounded bg-violet-600 px-2 py-1.5 text-[11px] font-medium text-white disabled:opacity-50">
                  Crear borrador
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Selector de evidencia manual ──
function EvidencePicker({ evaluationId, onAdded }: { evaluationId: string; onAdded: () => void }) {
  const [key, setKey] = useState('documents');
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Array<{ entityType: string; entityId: string; title: string }>>([]);
  const [searching, setSearching] = useState(false);

  const search = async () => {
    if (q.length < 2) return;
    setSearching(true);
    const r = await searchConnector(key, q);
    setResults(r.items ?? []);
    setSearching(false);
  };

  const add = async (c: { entityType: string; entityId: string; title: string }) => {
    await addEvidence(evaluationId, { connectorKey: key, entityType: c.entityType, entityId: c.entityId, note: c.title });
    onAdded();
  };

  return (
    <div className="mt-2 rounded-lg border border-violet-200 bg-violet-50/50 p-2.5 space-y-2">
      <div className="flex gap-1.5">
        <select value={key} onChange={(e) => setKey(e.target.value)} className="rounded border border-neutral-200 px-2 py-1 text-[12px]">
          {Object.entries(L.connector).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()}
          placeholder="Buscar…" className="flex-1 rounded border border-neutral-200 px-2 py-1 text-[12px]" />
        <button onClick={search} className="rounded bg-violet-600 px-2 py-1 text-[11px] text-white">
          {searching ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Buscar'}
        </button>
      </div>
      {results.length > 0 && (
        <ul className="max-h-40 overflow-y-auto space-y-1">
          {results.map((c) => (
            <li key={c.entityId} className="flex items-center justify-between gap-2 rounded bg-white px-2 py-1.5">
              <span className="text-[11px] text-neutral-700 truncate">{c.title}</span>
              <button onClick={() => add(c)} className="shrink-0 text-[10px] text-violet-600 font-medium">vincular</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// Tab Hallazgos
// ════════════════════════════════════════════════════════════
function FindingsTab({ reviewId, canEdit }: { reviewId: string; canEdit: boolean }) {
  const [items, setItems] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [planText, setPlanText] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const r = await listFindings(reviewId);
    setItems(r.items ?? []);
    setLoading(false);
  }, [reviewId]);
  useEffect(() => { load(); }, [load]);

  if (loading) return <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />;
  if (!items.length) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 py-12 text-center text-sm text-neutral-500">
        Sin hallazgos. Creálos desde el inspector de una evaluación.
      </div>
    );
  }

  const VS_COLOR: Record<string, string> = {
    DRAFT: 'bg-slate-100 text-slate-600', VALIDATED: 'bg-emerald-100 text-emerald-700',
    REJECTED: 'bg-rose-100 text-rose-700', LINKED: 'bg-blue-100 text-blue-700',
  };

  return (
    <div className="space-y-2">
      {items.map((f) => (
        <div key={f.id} className="rounded-xl border border-neutral-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-neutral-900">{f.title}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${VS_COLOR[f.validationStatus ?? 'DRAFT']}`}>
                  {f.validationStatus ?? 'DRAFT'}
                </span>
                <span className="text-[10px] text-neutral-400">{f.severity === 'MUST' ? 'Obligatorio' : 'Sugerencia'} · cláusula {f.clause}</span>
              </div>
              <p className="mt-1 text-[12px] text-neutral-600 line-clamp-3">{f.description}</p>
            </div>
            {canEdit && (
              <div className="flex flex-col gap-1.5 shrink-0">
                {f.validationStatus === 'DRAFT' && (
                  <div className="flex gap-1.5">
                    <button onClick={async () => { await validateFinding(f.id, true); load(); }}
                      className="rounded bg-emerald-600 px-2.5 py-1 text-[11px] font-medium text-white">Validar</button>
                    <button onClick={async () => { await validateFinding(f.id, false); load(); }}
                      className="rounded border border-rose-200 px-2.5 py-1 text-[11px] font-medium text-rose-600">Rechazar</button>
                  </div>
                )}
                {f.validationStatus === 'VALIDATED' && (
                  <div className="flex gap-1.5">
                    <button onClick={async () => { await findingToNCR(f.id); load(); }}
                      className="rounded bg-rose-600 px-2.5 py-1 text-[11px] font-medium text-white">→ NC</button>
                    <div className="flex gap-1">
                      <input
                        value={planText[f.id] ?? ''}
                        onChange={(e) => setPlanText({ ...planText, [f.id]: e.target.value })}
                        placeholder="Acción planificada"
                        className="w-36 rounded border border-neutral-200 px-2 py-1 text-[11px]"
                      />
                      <button
                        onClick={async () => { await findingToPlan(f.id, { plannedAction: planText[f.id] }); load(); }}
                        disabled={(planText[f.id] ?? '').length < 5}
                        className="rounded bg-violet-600 px-2.5 py-1 text-[11px] font-medium text-white disabled:opacity-50"
                      >→ Plan</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// Tab Consulta acotada
// ════════════════════════════════════════════════════════════
function ConsultaTab({ reviewId }: { reviewId: string }) {
  const [history, setHistory] = useState<Array<{ q: string; a: string; cites: Array<{ ref: string; text: string }>; oos?: boolean }>>([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const ask = async () => {
    if (q.length < 5 || busy) return;
    setBusy(true);
    setError('');
    try {
      const r = await consultar(reviewId, q);
      setHistory((h) => [...h, { q, a: r.answer, cites: r.citations ?? [], oos: r.outOfScope }]);
      setQ('');
    } catch {
      setError('No se pudo responder la consulta con la información disponible.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 max-w-3xl">
      <p className="text-[12px] text-neutral-500 mb-3">
        Preguntas respondidas <strong>solo con datos de esta revisión</strong>. Cada respuesta trae citas verificables.
      </p>

      <div className="space-y-3 mb-4 max-h-[50vh] overflow-y-auto">
        {history.map((h, i) => (
          <div key={i} className="space-y-2">
            <div className="flex justify-end">
              <div className="rounded-xl rounded-br-sm bg-violet-600 px-3 py-2 text-[12px] text-white max-w-[80%]">{h.q}</div>
            </div>
            <div className="rounded-xl rounded-bl-sm bg-neutral-100 px-3 py-2 text-[12px] text-neutral-800 max-w-[85%]">
              {h.oos && <div className="mb-1 text-[11px] text-amber-600 font-medium">Fuera del alcance de esta revisión —</div>}
              {h.a}
              {h.cites.length > 0 && (
                <div className="mt-2 border-t border-neutral-200 pt-1.5 text-[10px] text-neutral-500">
                  {h.cites.map((c, j) => <div key={j}><strong>[{c.ref}]</strong> {c.text.slice(0, 140)}…</div>)}
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && <div className="flex items-center gap-2 text-[12px] text-neutral-400"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Consultando…</div>}
      </div>

      {error && <div className="mb-2 text-[12px] text-rose-600">{error}</div>}

      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && ask()}
          placeholder="P.ej. ¿Qué requisitos quedaron sin evidencia suficiente?"
          className="flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-[13px]"
        />
        <button onClick={ask} disabled={q.length < 5 || busy}
          className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-[13px] font-medium text-white disabled:opacity-50">
          <Send className="h-3.5 w-3.5" /> Preguntar
        </button>
      </div>
      <div className="mt-2 flex gap-1.5 flex-wrap">
        {['¿Qué evidencia falta?', '¿Cuáles son las posibles brechas?', '¿Qué debo verificar externamente?'].map((s) => (
          <button key={s} onClick={() => setQ(s)}
            className="flex items-center gap-1 rounded-full border border-neutral-200 px-2.5 py-1 text-[11px] text-neutral-500 hover:border-violet-300 hover:text-violet-600">
            <Sparkles className="h-3 w-3" /> {s}
          </button>
        ))}
      </div>
    </div>
  );
}
