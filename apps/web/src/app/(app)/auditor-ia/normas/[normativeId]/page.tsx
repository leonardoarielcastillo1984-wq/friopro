'use client';
// ============================================================
// Auditor IA — Detalle de extracción (P2)
// Diagnóstico del PDF + lista de requisitos propuestos con
// aprobar/descartar/editar + "Aprobar extracción" (admin).
// ============================================================
import { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Loader2, Check, X, FileText, ChevronDown, ChevronUp,
  AlertTriangle, CheckCircle2, Play,
} from 'lucide-react';
import {
  normas, getExtraction, getSourcePage, patchRequirement,
  approveExtraction, rejectExtraction, createReview, L,
  type Norma, type Requirement, type Extraction,
} from '../../_lib/api';

const REQ_STATUS_COLOR: Record<string, string> = {
  PROPOSED: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-emerald-100 text-emerald-700',
  DISCARDED: 'bg-slate-100 text-slate-500',
};

export default function NormaDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const normativeId = params.normativeId as string;
  const extractionId = searchParams.get('extraccion');

  const [norma, setNorma] = useState<Norma | null>(null);
  const [extraction, setExtraction] = useState<Extraction | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageText, setPageText] = useState<{ page: number; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [startingReview, setStartingReview] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'PROPOSED' | 'APPROVED' | 'DISCARDED'>('ALL');

  const load = useCallback(async () => {
    const ns = await normas();
    setNorma((ns.items ?? []).find((n) => n.id === normativeId) ?? null);
    if (extractionId) {
      const ex = await getExtraction(extractionId);
      setExtraction(ex);
    }
    setLoading(false);
  }, [normativeId, extractionId]);

  useEffect(() => { load(); }, [load]);

  // Poll si está extrayendo
  useEffect(() => {
    if (extraction?.status !== 'EXTRACTING') return;
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [extraction?.status, load]);

  const setReqStatus = async (id: string, status: string) => {
    await patchRequirement(id, { status });
    load();
  };

  const handleApproveAll = async () => {
    setBusy(true);
    await approveExtraction(extraction!.id);
    await load();
    setBusy(false);
  };

  const handleReject = async () => {
    const reason = window.prompt('Motivo del rechazo (mín. 10 caracteres):');
    if (!reason || reason.length < 10) return;
    setBusy(true);
    await rejectExtraction(extraction!.id, reason);
    await load();
    setBusy(false);
  };

  const handleStartReview = async () => {
    setStartingReview(true);
    try {
      const r = await createReview({ extractionId: extraction!.id });
      router.push(`/auditor-ia/revisiones/${r.reviewId}`);
    } catch {
      setStartingReview(false);
    }
  };

  const showPage = async (n: number) => {
    if (pageText?.page === n) { setPageText(null); return; }
    const p = await getSourcePage(extractionId!, n);
    setPageText(p);
  };

  const reqs = extraction?.requirements ?? [];
  const filtered = filter === 'ALL' ? reqs : reqs.filter((r) => r.status === filter);
  const counts = {
    ALL: reqs.length,
    PROPOSED: reqs.filter((r) => r.status === 'PROPOSED').length,
    APPROVED: reqs.filter((r) => r.status === 'APPROVED').length,
    DISCARDED: reqs.filter((r) => r.status === 'DISCARDED').length,
  };
  const editable = extraction && extraction.status !== 'APPROVED';
  const canApprove = editable && counts.APPROVED > 0 && counts.PROPOSED === 0;

  return (
    <div className="space-y-4">
      <Link href="/auditor-ia/normas" className="inline-flex items-center gap-1 text-[13px] text-neutral-500 hover:text-violet-600">
        <ArrowLeft className="h-3.5 w-3.5" /> Extracción normativa
      </Link>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-neutral-400">
          <Loader2 className="h-4 w-4 animate-spin mr-2" /> Cargando…
        </div>
      ) : !extraction ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 py-14 text-center text-sm text-neutral-500">
          No hay extracción seleccionada para esta norma.
        </div>
      ) : (
        <>
          {/* Cabecera + diagnóstico */}
          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-lg font-semibold text-neutral-900">
                  {extraction.normative.name} <span className="font-normal text-neutral-400">{extraction.normative.version}</span>
                </h1>
                <div className="mt-1 flex items-center gap-2 text-[12px] text-neutral-500">
                  <span>Extracción rev. {extraction.revision}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${REQ_STATUS_COLOR[extraction.status] ?? 'bg-slate-100'}`}>
                    {L.extractionStatus[extraction.status] ?? extraction.status}
                  </span>
                  {extraction.pageCount ? <span>· {extraction.pageCount} págs.</span> : null}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                {extraction.status === 'APPROVED' && (
                  <button
                    onClick={handleStartReview}
                    disabled={startingReview}
                    className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-[13px] font-medium text-white hover:bg-violet-700 disabled:opacity-50"
                  >
                    {startingReview ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                    Iniciar revisión
                  </button>
                )}
                {editable && extraction.status === 'PENDING_APPROVAL' && (
                  <>
                    <button
                      onClick={handleApproveAll}
                      disabled={busy || !canApprove}
                      title={!canApprove ? 'Aprobá o descartá todos los requisitos propuestos primero' : ''}
                      className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-[13px] font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-4 w-4" /> Aprobar extracción
                    </button>
                    <button
                      onClick={handleReject}
                      disabled={busy}
                      className="rounded-lg border border-rose-200 px-3 py-2 text-[13px] font-medium text-rose-600 hover:bg-rose-50"
                    >
                      Rechazar
                    </button>
                  </>
                )}
              </div>
            </div>

            {editable && counts.PROPOSED > 0 && (
              <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[12px] text-amber-700 flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                Hay {counts.PROPOSED} requisitos propuestos sin revisar. Aprobá o descartá cada uno para poder aprobar la extracción.
              </div>
            )}
          </div>

          {/* Filtros */}
          <div className="flex gap-1.5">
            {(['ALL', 'PROPOSED', 'APPROVED', 'DISCARDED'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-lg px-3 py-1.5 text-[12px] font-medium ${
                  filter === f ? 'bg-violet-600 text-white' : 'bg-white border border-neutral-200 text-neutral-600 hover:border-violet-300'
                }`}
              >
                {f === 'ALL' ? 'Todos' : L.extractionStatus[f] ?? f} ({counts[f]})
              </button>
            ))}
          </div>

          {/* Lista de requisitos */}
          <div className="space-y-2">
            {filtered.map((r) => (
              <RequirementRow
                key={r.id}
                req={r}
                editable={!!editable}
                onSetStatus={setReqStatus}
                onShowPage={r.page ? () => showPage(r.page!) : undefined}
                pageOpen={pageText?.page === r.page}
              />
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-10 text-sm text-neutral-400">Sin requisitos en este filtro.</div>
            )}
          </div>

          {/* Panel de página fuente */}
          {pageText && (
            <div className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white shadow-2xl max-h-[45vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-neutral-100 px-4 py-2 flex items-center justify-between">
                <span className="text-[12px] font-semibold text-neutral-600 flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" /> PDF — página {pageText.page}
                </span>
                <button onClick={() => setPageText(null)} className="text-neutral-400 hover:text-neutral-600">✕</button>
              </div>
              <pre className="px-4 py-3 text-[12px] text-neutral-700 whitespace-pre-wrap font-sans leading-relaxed">
                {pageText.text}
              </pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function RequirementRow({
  req, editable, onSetStatus, onShowPage, pageOpen,
}: {
  req: Requirement;
  editable: boolean;
  onSetStatus: (id: string, s: string) => void;
  onShowPage?: () => void;
  pageOpen?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [stmt, setStmt] = useState(req.statement);
  const [page, setPage] = useState<number | ''>(req.page ?? '');

  const save = async () => {
    const body: Record<string, unknown> = { statement: stmt };
    if (page !== req.page) body.page = page === '' ? null : page;
    const { patchRequirement } = await import('../../_lib/api');
    await patchRequirement(req.id, body);
    setEditing(false);
    window.location.reload();
  };

  return (
    <div className={`rounded-xl border bg-white p-3.5 ${req.status === 'DISCARDED' ? 'border-neutral-100 opacity-60' : 'border-neutral-200'}`}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[12px] font-bold text-violet-700">{req.code}</span>
            <span className="text-[11px] text-neutral-400">cláusula {req.clauseNumber}</span>
            {req.page && (
              <button onClick={onShowPage} className="flex items-center gap-0.5 text-[11px] text-violet-600 hover:underline">
                <FileText className="h-3 w-3" /> pág. {req.page}
                {pageOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
            )}
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${REQ_STATUS_COLOR[req.status]}`}>
              {req.status === 'PROPOSED' ? 'Propuesto' : req.status === 'APPROVED' ? 'Aprobado' : 'Descartado'}
            </span>
            {req.requiresDocumentedInfo && (
              <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-600">info. documentada</span>
            )}
            <span className="text-[10px] text-neutral-400">
              {req.verificationTypes.map((v) => ({ DOCUMENT: 'doc', RECORD: 'reg', OBSERVATION: 'obs', INTERVIEW: 'entrev' })[v] ?? v).join(' · ')}
            </span>
          </div>

          {editing ? (
            <div className="mt-2 space-y-2">
              <textarea
                value={stmt}
                onChange={(e) => setStmt(e.target.value)}
                rows={3}
                maxLength={300}
                className="w-full rounded-lg border border-neutral-200 px-2.5 py-1.5 text-[13px]"
              />
              <div className="flex items-center gap-2">
                <input
                  type="number" min={1} value={page} placeholder="pág."
                  onChange={(e) => setPage(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-20 rounded-lg border border-neutral-200 px-2 py-1 text-[12px]"
                />
                <button onClick={save} className="rounded-lg bg-violet-600 px-2.5 py-1 text-[12px] text-white">Guardar</button>
                <button onClick={() => setEditing(false)} className="text-[12px] text-neutral-500">Cancelar</button>
              </div>
            </div>
          ) : (
            <p className="mt-1 text-[13px] text-neutral-800">{req.statement}</p>
          )}
        </div>

        {editable && !editing && (
          <div className="flex items-center gap-1 shrink-0">
            {req.status !== 'APPROVED' && (
              <button
                onClick={() => onSetStatus(req.id, 'APPROVED')}
                title="Aprobar requisito"
                className="rounded-md border border-emerald-200 p-1.5 text-emerald-600 hover:bg-emerald-50"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
            )}
            {req.status !== 'DISCARDED' && (
              <button
                onClick={() => onSetStatus(req.id, 'DISCARDED')}
                title="Descartar requisito"
                className="rounded-md border border-neutral-200 p-1.5 text-neutral-500 hover:bg-neutral-50"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            {req.status === 'DISCARDED' && (
              <button
                onClick={() => onSetStatus(req.id, 'PROPOSED')}
                title="Restaurar"
                className="rounded-md border border-neutral-200 px-2 py-1 text-[11px] text-neutral-500 hover:bg-neutral-50"
              >
                Restaurar
              </button>
            )}
            <button
              onClick={() => setEditing(true)}
              className="rounded-md border border-neutral-200 px-2 py-1 text-[11px] text-neutral-500 hover:bg-neutral-50"
            >
              Editar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
