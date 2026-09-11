import { getEffectiveTenantId } from '../utils/tenant-bypass.js';
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';

// ─────────────────────────────────────────────────────────────────────────
// Panel de Preparación para Auditoría
// Agrega, de forma 100% determinística (sin IA), lo que está pendiente en
// cada módulo del SGI: vencido, sin evidencia, sin responsable, sin avance
// reciente, etc. No modifica ningún dato — solo lectura y cálculo.
// ─────────────────────────────────────────────────────────────────────────

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
  score: number; // 0-100, 100 = todo en orden
  issues: ReadinessIssue[];
};

const DAY_MS = 1000 * 60 * 60 * 24;

function scoreFrom(total: number, pending: number): number {
  if (total === 0) return 100;
  return Math.max(0, Math.round(100 - (pending / total) * 100));
}

export const auditReadinessRoutes: FastifyPluginAsync = async (app) => {
  app.get('/summary', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    const now = new Date();
    const staleThreshold = new Date(now.getTime() - 45 * DAY_MS);
    const findingStaleThreshold = new Date(now.getTime() - 30 * DAY_MS);

    const raw = await app.runWithDbContext(req, async (tx: any) => {
      const [objectives, actionPlans, ncrs, risks, documents, trainings, findings, audits, auditPrograms, mgmtReviews, indicators, orgContext, stakeholders] = await Promise.all([
        tx.sgiObjective.findMany({
          where: { tenantId, deletedAt: null },
          select: { id: true, code: true, title: true, status: true, progress: true, endDate: true, updatedAt: true },
        }),
        tx.actionPlan.findMany({
          where: { tenantId, deletedAt: null },
          select: {
            id: true, code: true, findingDescription: true, status: true,
            plannedEndDate: true, closedAt: true, openedAt: true,
          },
        }),
        tx.nonConformity.findMany({
          where: { tenantId, deletedAt: null },
          select: { id: true, code: true, title: true, status: true, dueDate: true, closedAt: true },
        }),
        tx.risk.findMany({
          where: { tenantId, deletedAt: null, status: { not: 'CLOSED' } },
          select: {
            id: true, code: true, title: true, riskLevel: true, ownerId: true,
            treatmentActions: { where: { deletedAt: null }, select: { id: true, completed: true } },
          },
        }),
        tx.document.findMany({
          where: { tenantId, deletedAt: null, status: { not: 'OBSOLETE' } },
          select: { id: true, title: true, nextReviewDate: true, ownerId: true, status: true },
        }),
        tx.sgiTraining.findMany({
          where: { tenantId, deletedAt: null, status: { notIn: ['CANCELLED'] } },
          select: { id: true, code: true, title: true, status: true, scheduledDate: true, completedDate: true },
        }),
        tx.auditFinding.findMany({
          where: { tenantId, deletedAt: null, status: { in: ['OPEN', 'IN_ANALYSIS', 'IN_ACTION', 'REOPENED'] } },
          select: { id: true, code: true, description: true, detectedAt: true, severity: true },
        }),
        tx.audit.findMany({
          where: { tenantId, deletedAt: null },
          select: { id: true, code: true, title: true, status: true, type: true, plannedStartDate: true, actualStartDate: true, actualEndDate: true },
        }).catch(() => []),
        tx.auditProgram.findMany({
          where: { tenantId, deletedAt: null },
          select: { id: true, year: true, name: true, status: true },
        }).catch(() => []),
        tx.managementReview.findMany({
          where: { tenantId, deletedAt: null },
          select: { id: true, title: true, status: true, periodStart: true, periodEnd: true, generatedAt: true },
        }).catch(() => []),
        tx.indicator.findMany({
          where: { tenantId, isActive: true },
          select: { id: true, code: true, name: true, status: true, lastMeasuredAt: true, nextDueAt: true, currentValue: true, targetValue: true, ownerId: true },
        }).catch(() => []),
        tx.organizationContext.findFirst({
          where: { tenantId, year: now.getFullYear() },
        }).catch(() => null),
        tx.stakeholder.findMany({
          where: { tenantId, deletedAt: null },
          select: { id: true, name: true, type: true, complianceStatus: true, complianceLevel: true, lastEvaluationDate: true },
        }).catch(() => []),
      ]);
      return { objectives, actionPlans, ncrs, risks, documents, trainings, findings, audits, auditPrograms, mgmtReviews, indicators, orgContext, stakeholders };
    });

    // ── 1. Objetivos SGI ──────────────────────────────────────────────────
    const activeObjectives = raw.objectives.filter((o: any) => !['ACHIEVED', 'NOT_ACHIEVED', 'CANCELLED'].includes(o.status));
    const objectiveIssues: ReadinessIssue[] = [];
    for (const o of activeObjectives) {
      const delayed = o.endDate && new Date(o.endDate).getTime() < now.getTime();
      const stale = new Date(o.updatedAt).getTime() < staleThreshold.getTime();
      const noProgress = (o.progress ?? 0) === 0;
      if (delayed) {
        objectiveIssues.push({
          id: o.id,
          title: `${o.code ?? ''} ${o.title}`.trim(),
          detail: `Vencido (progreso ${o.progress}%)`,
          severity: 'HIGH',
          href: '/objetivos',
        });
      } else if (stale) {
        objectiveIssues.push({
          id: o.id,
          title: `${o.code ?? ''} ${o.title}`.trim(),
          detail: `Sin actualización hace 45+ días (progreso ${o.progress}%)`,
          severity: 'MEDIUM',
          href: '/objetivos',
        });
      } else if (noProgress) {
        objectiveIssues.push({
          id: o.id,
          title: `${o.code ?? ''} ${o.title}`.trim(),
          detail: 'Sin avance (0%)',
          severity: 'MEDIUM',
          href: '/objetivos',
        });
      }
    }
    const objectivesModule: ModuleReadiness = {
      key: 'objetivos', label: 'Objetivos SGI', href: '/objetivos',
      total: activeObjectives.length, pending: objectiveIssues.length,
      score: scoreFrom(activeObjectives.length, objectiveIssues.length),
      issues: objectiveIssues.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'HIGH' ? -1 : 1)).slice(0, 10),
    };

    // ── 2. Planes de acción / NCR ─────────────────────────────────────────
    const openPlans = raw.actionPlans.filter((p: any) => !['CLOSED', 'CANCELLED', 'EFFECTIVE', 'NOT_EFFECTIVE'].includes(p.status));
    const planIssues: ReadinessIssue[] = [];
    for (const p of openPlans) {
      const overdue = p.plannedEndDate && !p.closedAt && new Date(p.plannedEndDate).getTime() < now.getTime();
      const needsEvidence = p.status === 'PENDING_EVIDENCE';
      const needsEffectiveness = p.status === 'PENDING_EFFECTIVENESS';
      if (overdue || needsEvidence || needsEffectiveness) {
        planIssues.push({
          id: p.id,
          title: `${p.code ?? 'Plan sin código'}`,
          detail: overdue ? 'Vencido' : needsEvidence ? 'Pendiente de evidencia' : 'Pendiente de verificar eficacia',
          severity: overdue ? 'HIGH' : 'MEDIUM',
          href: '/calidad',
        });
      } else {
        planIssues.push({
          id: p.id,
          title: `${p.code ?? 'Plan sin código'}`,
          detail: 'Plan abierto sin cerrar',
          severity: 'LOW',
          href: '/calidad',
        });
      }
    }
    const actionPlansModule: ModuleReadiness = {
      key: 'planes-accion', label: 'Planes de acción', href: '/calidad',
      total: openPlans.length, pending: planIssues.length,
      score: scoreFrom(openPlans.length, planIssues.length),
      issues: planIssues.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'HIGH' ? -1 : 1)).slice(0, 10),
    };

    const openNcrs = raw.ncrs.filter((n: any) => n.status !== 'CLOSED' && n.status !== 'CANCELLED');
    const ncrIssues: ReadinessIssue[] = [];
    for (const n of openNcrs) {
      const overdue = n.dueDate && !n.closedAt && new Date(n.dueDate).getTime() < now.getTime();
      if (overdue) {
        ncrIssues.push({
          id: n.id, title: `${n.code} — ${n.title}`, detail: 'Vencida', severity: 'HIGH',
          href: '/calidad',
        });
      } else {
        ncrIssues.push({
          id: n.id, title: `${n.code} — ${n.title}`, detail: 'Abierta sin cerrar', severity: 'LOW',
          href: '/calidad',
        });
      }
    }
    const ncrModule: ModuleReadiness = {
      key: 'ncr', label: 'No conformidades', href: '/calidad',
      total: openNcrs.length, pending: ncrIssues.length,
      score: scoreFrom(openNcrs.length, ncrIssues.length),
      issues: ncrIssues.slice(0, 10),
    };

    // ── 3. Riesgos ────────────────────────────────────────────────────────
    const riskIssues: ReadinessIssue[] = [];
    for (const r of raw.risks) {
      const actions = r.treatmentActions ?? [];
      const hasNoPlan = actions.length === 0;
      const incomplete = actions.length > 0 && actions.some((a: any) => !a.completed);
      const isCriticalOrHigh = r.riskLevel >= 12;
      const noOwner = !r.ownerId;
      if (isCriticalOrHigh && hasNoPlan) {
        riskIssues.push({
          id: r.id, title: `${r.code} — ${r.title}`, detail: 'Riesgo crítico/alto sin plan de tratamiento', severity: 'HIGH',
          href: `/riesgos/${r.id}`,
        });
      } else if (isCriticalOrHigh && incomplete) {
        riskIssues.push({
          id: r.id, title: `${r.code} — ${r.title}`, detail: 'Plan de tratamiento incompleto', severity: 'MEDIUM',
          href: `/riesgos/${r.id}`,
        });
      }
      if (noOwner) {
        riskIssues.push({
          id: r.id, title: `${r.code} — ${r.title}`, detail: 'Sin responsable asignado', severity: isCriticalOrHigh ? 'HIGH' : 'MEDIUM',
          href: `/riesgos/${r.id}`,
        });
      }
    }
    const risksModule: ModuleReadiness = {
      key: 'riesgos', label: 'Riesgos', href: '/riesgos',
      total: raw.risks.length, pending: riskIssues.length,
      score: scoreFrom(raw.risks.length, riskIssues.length),
      issues: riskIssues.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'HIGH' ? -1 : 1)).slice(0, 10),
    };

    // ── 4. Documentos ─────────────────────────────────────────────────────
    const docIssues: ReadinessIssue[] = [];
    for (const d of raw.documents) {
      const expired = d.nextReviewDate && new Date(d.nextReviewDate).getTime() < now.getTime();
      const dueSoon = d.nextReviewDate && !expired && (new Date(d.nextReviewDate).getTime() - now.getTime()) / DAY_MS <= 15;
      const noOwner = !d.ownerId;
      const notEffective = d.status === 'DRAFT' || d.status === 'REVIEW';
      if (expired) {
        docIssues.push({
          id: d.id, title: d.title, detail: 'Revisión vencida', severity: 'HIGH',
          href: `/documents/${d.id}`,
        });
      } else if (noOwner) {
        docIssues.push({
          id: d.id, title: d.title, detail: 'Sin responsable asignado', severity: 'MEDIUM',
          href: `/documents/${d.id}`,
        });
      } else if (notEffective) {
        docIssues.push({
          id: d.id, title: d.title, detail: d.status === 'DRAFT' ? 'En borrador (no efectivo)' : 'En revisión (no efectivo)', severity: 'MEDIUM',
          href: `/documents/${d.id}`,
        });
      } else if (dueSoon) {
        docIssues.push({
          id: d.id, title: d.title, detail: 'Próximo a vencer (≤15 días)', severity: 'LOW',
          href: `/documents/${d.id}`,
        });
      }
    }
    const documentsModule: ModuleReadiness = {
      key: 'documentos', label: 'Documentos', href: '/documents',
      total: raw.documents.length, pending: docIssues.length,
      score: scoreFrom(raw.documents.length, docIssues.length),
      issues: docIssues.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'HIGH' ? -1 : 1)).slice(0, 10),
    };

    // ── 5. Capacitaciones ─────────────────────────────────────────────────
    const trainingIssues: ReadinessIssue[] = [];
    for (const t of raw.trainings) {
      const isPast = t.scheduledDate && new Date(t.scheduledDate).getTime() < now.getTime();
      const notCompleted = t.status !== 'COMPLETED' && !t.completedDate;
      if (isPast && notCompleted) {
        trainingIssues.push({
          id: t.id, title: `${t.code ?? ''} ${t.title}`.trim(), detail: 'Programada en el pasado, sin marcar completada', severity: 'MEDIUM',
          href: `/capacitaciones/${t.id}`,
        });
      }
    }
    const trainingsModule: ModuleReadiness = {
      key: 'capacitaciones', label: 'Capacitaciones', href: '/capacitaciones',
      total: raw.trainings.length, pending: trainingIssues.length,
      score: scoreFrom(raw.trainings.length, trainingIssues.length),
      issues: trainingIssues.slice(0, 10),
    };

    // ── 6. Hallazgos de auditoría ─────────────────────────────────────────
    const findingIssues: ReadinessIssue[] = [];
    for (const f of raw.findings) {
      const stale = new Date(f.detectedAt).getTime() < findingStaleThreshold.getTime();
      if (stale) {
        findingIssues.push({
          id: f.id, title: `${f.code} — ${f.description.slice(0, 60)}`, detail: 'Abierto hace 30+ días sin cerrar', severity: f.severity === 'MAJOR' || f.severity === 'CRITICAL' ? 'HIGH' : 'MEDIUM',
          href: `/auditoria`,
        });
      } else {
        findingIssues.push({
          id: f.id, title: `${f.code} — ${f.description.slice(0, 60)}`, detail: 'Abierto sin cerrar', severity: 'LOW',
          href: `/auditoria`,
        });
      }
    }
    const findingsModule: ModuleReadiness = {
      key: 'hallazgos', label: 'Hallazgos de auditoría', href: '/auditoria',
      total: raw.findings.length, pending: findingIssues.length,
      score: scoreFrom(raw.findings.length, findingIssues.length),
      issues: findingIssues.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'HIGH' ? -1 : 1)).slice(0, 10),
    };

    // ── 7. Auditorías Internas ────────────────────────────────────────────
    const auditIssues: ReadinessIssue[] = [];
    const currentYear = now.getFullYear();
    const hasProgramThisYear = (raw.auditPrograms as any[]).some((p) => p.year === currentYear);
    if (!hasProgramThisYear) {
      auditIssues.push({
        id: 'no-program', title: `Programa de auditorías ${currentYear}`,
        detail: 'No existe programa de auditorías internas para el año actual', severity: 'HIGH',
        href: '/auditoria',
      });
    }
    for (const a of raw.audits as any[]) {
      if (a.status === 'DRAFT' || a.status === 'PLANNED') {
        const hasNoDates = !a.plannedStartDate;
        auditIssues.push({
          id: a.id, title: `${a.code} — ${a.title}`,
          detail: hasNoDates ? 'Auditoría sin fechas planificadas' : 'Planificada sin ejecutar',
          severity: hasNoDates ? 'MEDIUM' : 'LOW',
          href: '/auditoria',
        });
      } else if (a.status === 'IN_PROGRESS' || a.status === 'PENDING_REPORT') {
        const startedAt = a.actualStartDate ? new Date(a.actualStartDate) : new Date(a.plannedStartDate ?? now);
        const daysSinceStart = (now.getTime() - startedAt.getTime()) / DAY_MS;
        if (daysSinceStart > 30) {
          auditIssues.push({
            id: a.id, title: `${a.code} — ${a.title}`,
            detail: daysSinceStart > 60 ? `En curso hace ${Math.round(daysSinceStart)} días sin cerrar` : 'Pendiente de reporte/cierre',
            severity: daysSinceStart > 60 ? 'HIGH' : 'MEDIUM',
            href: '/auditoria',
          });
        }
      }
    }
    const auditsModule: ModuleReadiness = {
      key: 'auditorias-internas', label: 'Auditorías Internas', href: '/auditoria',
      total: (raw.audits as any[]).length, pending: auditIssues.length,
      score: scoreFrom(Math.max(1, (raw.audits as any[]).length + 1), auditIssues.length),
      issues: auditIssues.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'HIGH' ? -1 : 1)).slice(0, 10),
    };

    // ── 8. Revisión por la Dirección ──────────────────────────────────────
    const reviewIssues: ReadinessIssue[] = [];
    const reviews = raw.mgmtReviews as any[];
    const reviewThisYear = reviews.filter((r) => new Date(r.periodEnd).getFullYear() === currentYear || new Date(r.periodStart).getFullYear() === currentYear);
    if (reviewThisYear.length === 0) {
      reviewIssues.push({
        id: 'no-review', title: `Revisión por la Dirección ${currentYear}`,
        detail: 'No existe revisión por la dirección para el período actual', severity: 'HIGH',
        href: '/contexto-sgi',
      });
    } else {
      for (const r of reviewThisYear) {
        if (r.status === 'DRAFT') {
          reviewIssues.push({
            id: r.id, title: r.title,
            detail: 'Revisión en borrador (no finalizada)', severity: 'MEDIUM',
            href: '/contexto-sgi',
          });
        }
      }
    }
    const mgmtReviewModule: ModuleReadiness = {
      key: 'revision-direccion', label: 'Revisión por la Dirección', href: '/contexto-sgi',
      total: Math.max(1, reviewThisYear.length), pending: reviewIssues.length,
      score: scoreFrom(Math.max(1, reviewThisYear.length), reviewIssues.length),
      issues: reviewIssues.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'HIGH' ? -1 : 1)).slice(0, 10),
    };

    // ── 9. Indicadores ────────────────────────────────────────────────────
    const indicatorIssues: ReadinessIssue[] = [];
    for (const ind of raw.indicators as any[]) {
      const noData = ind.status === 'NO_DATA' || !ind.lastMeasuredAt;
      const offTarget = ind.status === 'OFF_TARGET';
      const staleMeasurement = ind.lastMeasuredAt && new Date(ind.lastMeasuredAt).getTime() < staleThreshold.getTime();
      const overdueNext = ind.nextDueAt && new Date(ind.nextDueAt).getTime() < now.getTime();
      const noOwner = !ind.ownerId;
      if (noData) {
        indicatorIssues.push({
          id: ind.id, title: `${ind.code} — ${ind.name}`,
          detail: 'Sin mediciones registradas', severity: 'HIGH',
          href: '/indicadores',
        });
      } else if (offTarget) {
        indicatorIssues.push({
          id: ind.id, title: `${ind.code} — ${ind.name}`,
          detail: `Fuera de meta (actual: ${ind.currentValue}, meta: ${ind.targetValue})`, severity: 'MEDIUM',
          href: '/indicadores',
        });
      } else if (overdueNext) {
        indicatorIssues.push({
          id: ind.id, title: `${ind.code} — ${ind.name}`,
          detail: 'Medición vencida', severity: 'MEDIUM',
          href: '/indicadores',
        });
      } else if (staleMeasurement) {
        indicatorIssues.push({
          id: ind.id, title: `${ind.code} — ${ind.name}`,
          detail: 'Sin medición hace 45+ días', severity: 'LOW',
          href: '/indicadores',
        });
      } else if (noOwner) {
        indicatorIssues.push({
          id: ind.id, title: `${ind.code} — ${ind.name}`,
          detail: 'Sin responsable asignado', severity: 'LOW',
          href: '/indicadores',
        });
      }
    }
    const indicatorsModule: ModuleReadiness = {
      key: 'indicadores', label: 'Indicadores', href: '/indicadores',
      total: (raw.indicators as any[]).length, pending: indicatorIssues.length,
      score: scoreFrom((raw.indicators as any[]).length, indicatorIssues.length),
      issues: indicatorIssues.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'HIGH' ? -1 : 1)).slice(0, 10),
    };

    // ── 10. Contexto y Partes Interesadas ─────────────────────────────────
    const contextIssues: ReadinessIssue[] = [];
    const ctx = raw.orgContext as any;
    if (!ctx) {
      contextIssues.push({
        id: 'no-context', title: `Análisis FODA ${currentYear}`,
        detail: 'No existe análisis de contexto (FODA/PESTEL) para el año actual', severity: 'HIGH',
        href: '/contexto-sgi',
      });
    } else {
      const hasFoda = ctx.strengths || ctx.weaknesses || ctx.opportunities || ctx.threats;
      if (!hasFoda) {
        contextIssues.push({
          id: 'incomplete-foda', title: `Análisis FODA ${currentYear}`,
          detail: 'FODA incompleto (sin fortalezas/debilidades/oportunidades/amenazas)', severity: 'MEDIUM',
          href: '/contexto-sgi',
        });
      }
    }
    for (const s of raw.stakeholders as any[]) {
      if (!s.complianceStatus) {
        contextIssues.push({
          id: s.id, title: s.name,
          detail: 'Parte interesada sin evaluación de cumplimiento', severity: 'MEDIUM',
          href: '/contexto-sgi',
        });
      } else if (s.complianceStatus === 'NON_COMPLIANT') {
        contextIssues.push({
          id: s.id, title: s.name,
          detail: 'Parte interesada no conforme', severity: 'HIGH',
          href: '/contexto-sgi',
        });
      } else if (s.complianceStatus === 'PARTIAL') {
        contextIssues.push({
          id: s.id, title: s.name,
          detail: 'Parte interesada con cumplimiento parcial', severity: 'LOW',
          href: '/contexto-sgi',
        });
      }
    }
    const contextModule: ModuleReadiness = {
      key: 'contexto', label: 'Contexto y Partes Interesadas', href: '/contexto-sgi',
      total: 1 + (raw.stakeholders as any[]).length, pending: contextIssues.length,
      score: scoreFrom(1 + (raw.stakeholders as any[]).length, contextIssues.length),
      issues: contextIssues.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'HIGH' ? -1 : 1)).slice(0, 10),
    };

    const modules = [objectivesModule, actionPlansModule, ncrModule, risksModule, documentsModule, trainingsModule, findingsModule, auditsModule, mgmtReviewModule, indicatorsModule, contextModule];
    const overallScore = Math.round(modules.reduce((acc, m) => acc + m.score, 0) / modules.length);
    const totalPending = modules.reduce((acc, m) => acc + m.pending, 0);

    return reply.send({
      generatedAt: now.toISOString(),
      overallScore,
      totalPending,
      modules,
    });
  });
};
