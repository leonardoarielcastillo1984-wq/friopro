// ──────────────────────────────────────────────────────────────
// Auditor IA — informe de revisión y preparación de auditoría.
//
// Solo agrega datos ya persistidos: nunca sintetiza conclusiones
// ni dictámenes. Cada fila de la matriz muestra los 4 ejes
// (trabajo / evidencia / dictamen IA / decisión humana).
// ──────────────────────────────────────────────────────────────

import type { PrismaClient } from '@prisma/client';

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const LABELS: Record<string, Record<string, string>> = {
  workStatus: {
    PENDING: 'Pendiente', IN_PROGRESS: 'En curso', EVALUATED: 'Evaluado',
    CANNOT_EVALUATE: 'No evaluable', STALE: 'Obsoleto',
  },
  evidenceStatus: {
    NOT_SEARCHED: 'Sin buscar', FOUND: 'Encontrada', PARTIAL: 'Parcial',
    ABSENT: 'Ausente', SOURCE_UNAVAILABLE: 'Fuente no disponible',
  },
  aiVerdict: {
    NONE: '—', EVIDENCE_SUPPORTS: 'Evidencia respalda', POSSIBLE_GAP: 'Posible brecha',
    REQUIRES_EXTERNAL_VERIFICATION: 'Requiere verif. externa', INSUFFICIENT_EVIDENCE: 'Evidencia insuficiente',
  },
  humanDecision: {
    PENDING: 'Pendiente', VALIDATED: 'Validada', GAP_CONFIRMED: 'Brecha confirmada',
    MORE_EVIDENCE_REQUESTED: 'Más evidencia solicitada', AI_REJECTED: 'Dictamen rechazado',
    NA_PROPOSED: 'N/A propuesta', NA_APPROVED: 'N/A aprobada', NA_REJECTED: 'N/A rechazada',
  },
};

const COLORS: Record<string, Record<string, string>> = {
  workStatus: {
    EVALUATED: '#16a34a', STALE: '#d97706', CANNOT_EVALUATE: '#dc2626',
    PENDING: '#6b7280', IN_PROGRESS: '#2563eb',
  },
  evidenceStatus: {
    FOUND: '#16a34a', PARTIAL: '#d97706', ABSENT: '#dc2626',
    SOURCE_UNAVAILABLE: '#6b7280', NOT_SEARCHED: '#9ca3af',
  },
  aiVerdict: {
    EVIDENCE_SUPPORTS: '#16a34a', POSSIBLE_GAP: '#d97706',
    REQUIRES_EXTERNAL_VERIFICATION: '#2563eb', INSUFFICIENT_EVIDENCE: '#d97706', NONE: '#9ca3af',
  },
  humanDecision: {
    VALIDATED: '#16a34a', GAP_CONFIRMED: '#dc2626', NA_APPROVED: '#16a34a',
    NA_REJECTED: '#dc2626', PENDING: '#6b7280', MORE_EVIDENCE_REQUESTED: '#d97706',
    AI_REJECTED: '#6b7280', NA_PROPOSED: '#2563eb',
  },
};

export interface ReportRow {
  code: string;
  clauseNumber: string;
  statement: string;
  page: number | null;
  workStatus: string;
  evidenceStatus: string;
  aiVerdict: string;
  humanDecision: string;
  explanation: string | null;
  limitations: string[];
  links: Array<{ title: string; entityType: string; origin: string; url: string | null }>;
}

export interface ReportData {
  normative: { name: string; code: string; version: string };
  review: {
    id: string; scope: string | null; periodFrom: Date | null; periodTo: Date | null;
    sites: string[]; status: string; startedAt: Date | null; finishedAt: Date | null;
    usedTokens: number;
  };
  totals: Record<string, Record<string, number>>;
  rows: ReportRow[];
  auditQuestions: string[];
  externalChecks: string[];
  findings: Array<{ id: string; title: string; validationStatus: string | null }>;
}

export async function buildReportData(
  prisma: PrismaClient,
  tenantId: string,
  reviewId: string,
): Promise<ReportData | null> {
  const review = await prisma.auditorReview.findFirst({
    where: { id: reviewId, tenantId },
    include: {
      extraction: {
        select: {
          normative: { select: { name: true, code: true, version: true } },
        },
      },
      evaluations: {
        orderBy: { createdAt: 'asc' },
        include: {
          requirement: {
            select: { code: true, clauseNumber: true, statement: true, page: true },
          },
          evidenceLinks: {
            select: { title: true, entityType: true, origin: true, url: true },
            orderBy: { createdAt: 'asc' },
          },
        },
      },
    },
  });
  if (!review) return null;

  // Solo el attempt más reciente por requisito
  const byReq = new Map<string, (typeof review.evaluations)[number]>();
  for (const ev of review.evaluations) {
    const prev = byReq.get(ev.requirementId);
    if (!prev || ev.attempt > prev.attempt) byReq.set(ev.requirementId, ev);
  }
  const latest = [...byReq.values()];

  const totals: Record<string, Record<string, number>> = {
    workStatus: {}, evidenceStatus: {}, aiVerdict: {}, humanDecision: {},
  };
  const questions: string[] = [];
  const external: string[] = [];

  const rows: ReportRow[] = latest.map((ev) => {
    totals.workStatus[ev.workStatus] = (totals.workStatus[ev.workStatus] ?? 0) + 1;
    totals.evidenceStatus[ev.evidenceStatus] = (totals.evidenceStatus[ev.evidenceStatus] ?? 0) + 1;
    totals.aiVerdict[ev.aiVerdict] = (totals.aiVerdict[ev.aiVerdict] ?? 0) + 1;
    totals.humanDecision[ev.humanDecision] = (totals.humanDecision[ev.humanDecision] ?? 0) + 1;

    for (const q of (ev.auditQuestions as string[] | null) ?? []) {
      if (questions.length < 60) questions.push(`${ev.requirement.clauseNumber}: ${q}`);
    }
    for (const c of (ev.externalChecks as string[] | null) ?? []) {
      if (external.length < 60) external.push(`${ev.requirement.clauseNumber}: ${c}`);
    }

    return {
      code: ev.requirement.code,
      clauseNumber: ev.requirement.clauseNumber,
      statement: ev.requirement.statement,
      page: ev.requirement.page,
      workStatus: ev.workStatus,
      evidenceStatus: ev.evidenceStatus,
      aiVerdict: ev.aiVerdict,
      humanDecision: ev.humanDecision,
      explanation: ev.explanation,
      limitations: (ev.limitations as string[] | null) ?? [],
      links: ev.evidenceLinks,
    };
  });
  rows.sort((a, b) => a.clauseNumber.localeCompare(b.clauseNumber, undefined, { numeric: true }) || a.code.localeCompare(b.code));

  // AiFinding.evaluationId es escalar (sin relación): filtrar por ids
  const evalIds = review.evaluations.map((e) => e.id);
  const findings = evalIds.length
    ? await prisma.aiFinding.findMany({
        where: {
          tenantId, auditType: 'auditor-ia', deletedAt: null,
          evaluationId: { in: evalIds },
        },
        select: { id: true, title: true, validationStatus: true },
        take: 100,
      })
    : [];

  return {
    normative: review.extraction.normative,
    review: {
      id: review.id, scope: review.scope,
      periodFrom: review.periodFrom, periodTo: review.periodTo,
      sites: review.sites, status: review.status,
      startedAt: review.startedAt, finishedAt: review.finishedAt,
      usedTokens: review.usedTokens,
    },
    totals, rows,
    auditQuestions: questions,
    externalChecks: external,
    findings,
  };
}

function badge(axis: string, value: string): string {
  const label = LABELS[axis]?.[value] ?? value;
  const color = COLORS[axis]?.[value] ?? '#6b7280';
  return `<span style="display:inline-block;padding:1px 7px;border-radius:9px;font-size:11px;font-weight:600;color:#fff;background:${color};white-space:nowrap;">${esc(label)}</span>`;
}

function totalsTable(data: ReportData): string {
  const axes: Array<[string, string]> = [
    ['workStatus', 'Trabajo'], ['evidenceStatus', 'Evidencia'],
    ['aiVerdict', 'Dictamen IA'], ['humanDecision', 'Decisión humana'],
  ];
  const rows = axes.map(([axis, title]) => {
    const parts = Object.entries(data.totals[axis])
      .map(([k, n]) => `${badge(axis, k)} × ${n}`)
      .join(' ') || '—';
    return `<tr><th style="text-align:left;padding:4px 10px 4px 0;">${title}</th><td>${parts}</td></tr>`;
  });
  return `<table style="border-collapse:collapse;margin-bottom:14px;">${rows.join('')}</table>`;
}

export function buildReportHtml(data: ReportData): string {
  const fmt = (d: Date | null) => (d ? new Date(d).toLocaleDateString('es-AR') : '—');

  const matrix = data.rows
    .map(
      (r) => `<tr style="border-bottom:1px solid #e5e7eb;">
      <td style="padding:6px 8px;vertical-align:top;white-space:nowrap;font-weight:600;">${esc(r.code)}</td>
      <td style="padding:6px 8px;vertical-align:top;max-width:340px;">${esc(r.statement)}${r.page ? `<div style="font-size:10px;color:#6b7280;">PDF pág. ${r.page}</div>` : ''}
        ${r.limitations.length ? `<div style="font-size:11px;color:#b45309;margin-top:2px;">${esc(r.limitations.join(' · '))}</div>` : ''}
        ${r.explanation ? `<div style="font-size:11px;color:#374151;margin-top:2px;">${esc(r.explanation.slice(0, 400))}</div>` : ''}
        ${r.links.length ? `<div style="font-size:10px;color:#4b5563;margin-top:2px;">${r.links.map((l) => `${esc(l.title)}${l.origin === 'MANUAL' ? ' (manual)' : ''}`).join(' · ')}</div>` : ''}
      </td>
      <td style="padding:6px 8px;vertical-align:top;">${badge('workStatus', r.workStatus)}</td>
      <td style="padding:6px 8px;vertical-align:top;">${badge('evidenceStatus', r.evidenceStatus)}</td>
      <td style="padding:6px 8px;vertical-align:top;">${badge('aiVerdict', r.aiVerdict)}</td>
      <td style="padding:6px 8px;vertical-align:top;">${badge('humanDecision', r.humanDecision)}</td>
    </tr>`,
    )
    .join('');

  const questions = data.auditQuestions.length
    ? `<h2>Preguntas sugeridas para la auditoría</h2><ul>${data.auditQuestions.map((q) => `<li>${esc(q)}</li>`).join('')}</ul>`
    : '';
  const external = data.externalChecks.length
    ? `<h2>Verificaciones externas pendientes</h2><ul>${data.externalChecks.map((q) => `<li>${esc(q)}</li>`).join('')}</ul>`
    : '';
  const findings = data.findings.length
    ? `<h2>Hallazgos vinculados</h2><ul>${data.findings.map((f) => `<li>${esc(f.title)} — ${esc(f.validationStatus ?? 'DRAFT')}</li>`).join('')}</ul>`
    : '';

  return `
  <h1>Informe de revisión — Auditor IA</h1>
  <p style="color:#4b5563;font-size:12px;">
    <strong>${esc(data.normative.name)}</strong> (${esc(data.normative.code)} ${esc(data.normative.version)})<br>
    Período: ${fmt(data.review.periodFrom)} → ${fmt(data.review.periodTo)} ·
    Sedes: ${data.review.sites.length ? esc(data.review.sites.join(', ')) : 'todas'} ·
    Estado: ${esc(data.review.status)} ·
    ${data.review.scope ? `Alcance: ${esc(data.review.scope)}` : ''}
  </p>
  <p style="font-size:11px;color:#9ca3af;font-style:italic;">
    La IA asiste la revisión: los dictámenes son propuestas con trazabilidad, no conclusiones.
    Toda decisión de conformidad requiere revisión humana.
  </p>
  ${totalsTable(data)}
  <h2>Matriz de evaluación</h2>
  <table style="width:100%;border-collapse:collapse;font-size:12px;">
    <thead><tr style="border-bottom:2px solid #111;text-align:left;">
      <th style="padding:6px 8px;">Req.</th><th style="padding:6px 8px;">Enunciado</th>
      <th style="padding:6px 8px;">Trabajo</th><th style="padding:6px 8px;">Evidencia</th>
      <th style="padding:6px 8px;">Dictamen IA</th><th style="padding:6px 8px;">Decisión</th>
    </tr></thead>
    <tbody>${matrix}</tbody>
  </table>
  ${questions}
  ${external}
  ${findings}`;
}
