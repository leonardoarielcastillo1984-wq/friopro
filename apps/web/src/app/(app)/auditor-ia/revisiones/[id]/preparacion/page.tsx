'use client';
// ============================================================
// Auditor IA — Preparación de auditoría (P4)
// Pendientes de decisión, brechas, verificaciones externas y
// preguntas sugeridas para llevar a la auditoría.
// ============================================================
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, FileText, AlertTriangle, HelpCircle, ListChecks } from 'lucide-react';
import { getPreparacion } from '../../../_lib/api';
import { apiPath } from '@/lib/api';

interface PrepData {
  normative: { name: string; code: string; version: string };
  review: { id: string; scope: string | null; periodFrom: string | null; periodTo: string | null; sites: string[] };
  pendingDecisions: number;
  staleEvaluations: number;
  gaps: Array<{ code: string; clauseNumber: string; statement: string; aiVerdict: string; humanDecision: string }>;
  auditQuestions: string[];
  externalChecks: string[];
  findings: Array<{ id: string; title: string; validationStatus: string | null }>;
}

export default function PreparacionPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<PrepData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPreparacion(id).then((d) => {
      setData(d as PrepData);
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return <div className="flex items-center justify-center py-16 text-sm text-neutral-400"><Loader2 className="h-4 w-4 animate-spin mr-2" /> Cargando…</div>;
  }
  if (!data?.review?.id) {
    return <div className="py-16 text-center text-sm text-neutral-500">Revisión no encontrada.</div>;
  }

  const fmt = (s: string | null) => (s ? new Date(s).toLocaleDateString('es-AR') : '—');

  return (
    <div className="space-y-4 max-w-4xl">
      <Link href={`/auditor-ia/revisiones/${id}`} className="inline-flex items-center gap-1 text-[13px] text-neutral-500 hover:text-violet-600">
        <ArrowLeft className="h-3.5 w-3.5" /> Revisión
      </Link>

      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-neutral-900">Preparación de auditoría</h1>
            <p className="text-[13px] text-neutral-500 mt-0.5">
              {data.normative.name} ({data.normative.code} {data.normative.version}) ·{' '}
              {fmt(data.review.periodFrom)} → {fmt(data.review.periodTo)}
            </p>
          </div>
          <a
            href={apiPath(`/auditor-ia/revisiones/${id}/informe.pdf`)}
            target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-2 text-[12px] font-medium text-neutral-600 hover:border-violet-300 shrink-0"
          >
            <FileText className="h-4 w-4" /> Exportar PDF
          </a>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-center">
            <div className="text-xl font-bold text-amber-700">{data.pendingDecisions}</div>
            <div className="text-[11px] text-amber-600">decisiones pendientes</div>
          </div>
          <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2.5 text-center">
            <div className="text-xl font-bold text-rose-700">{data.gaps.length}</div>
            <div className="text-[11px] text-rose-600">posibles brechas</div>
          </div>
          <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2.5 text-center">
            <div className="text-xl font-bold text-blue-700">{data.externalChecks.length}</div>
            <div className="text-[11px] text-blue-600">verificaciones externas</div>
          </div>
        </div>
      </div>

      {data.staleEvaluations > 0 && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-[13px] text-amber-700 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {data.staleEvaluations} evaluaciones tienen fuentes que cambiaron — reevaluar antes de la auditoría.
        </div>
      )}

      {/* Brechas */}
      <section className="rounded-xl border border-neutral-200 bg-white p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-900 mb-2">
          <AlertTriangle className="h-4 w-4 text-rose-500" /> Posibles brechas a verificar
        </h2>
        {data.gaps.length === 0 ? (
          <p className="text-[13px] text-neutral-400">No se detectaron posibles brechas.</p>
        ) : (
          <ul className="space-y-2">
            {data.gaps.map((g, i) => (
              <li key={i} className="rounded-lg bg-rose-50/60 border border-rose-100 px-3 py-2">
                <div className="flex items-center gap-2 text-[11px] font-semibold text-rose-700">
                  {g.code} · cláusula {g.clauseNumber}
                  <span className="font-normal text-neutral-400">({g.humanDecision === 'GAP_CONFIRMED' ? 'confirmada' : 'posible'})</span>
                </div>
                <p className="text-[12px] text-neutral-700 mt-0.5">{g.statement}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Verificaciones externas */}
      <section className="rounded-xl border border-neutral-200 bg-white p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-900 mb-2">
          <ListChecks className="h-4 w-4 text-blue-500" /> Verificaciones externas pendientes
        </h2>
        {data.externalChecks.length === 0 ? (
          <p className="text-[13px] text-neutral-400">Sin verificaciones externas pendientes.</p>
        ) : (
          <ul className="text-[13px] text-neutral-700 list-disc pl-5 space-y-1">
            {data.externalChecks.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        )}
      </section>

      {/* Preguntas */}
      <section className="rounded-xl border border-neutral-200 bg-white p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-900 mb-2">
          <HelpCircle className="h-4 w-4 text-violet-500" /> Preguntas sugeridas para la auditoría
        </h2>
        {data.auditQuestions.length === 0 ? (
          <p className="text-[13px] text-neutral-400">Sin preguntas sugeridas.</p>
        ) : (
          <ul className="text-[13px] text-neutral-700 list-disc pl-5 space-y-1">
            {data.auditQuestions.map((q, i) => <li key={i}>{q}</li>)}
          </ul>
        )}
      </section>

      {/* Hallazgos */}
      {data.findings.length > 0 && (
        <section className="rounded-xl border border-neutral-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-neutral-900 mb-2">Hallazgos vinculados</h2>
          <ul className="text-[13px] text-neutral-700 list-disc pl-5 space-y-1">
            {data.findings.map((f) => <li key={f.id}>{f.title} — {f.validationStatus ?? 'DRAFT'}</li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
