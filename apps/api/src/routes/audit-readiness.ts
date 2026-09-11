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
      const [objectives, actionPlans, ncrs, risks, documents, trainings, findings] = await Promise.all([
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
            id: true, code: true, title: true, riskLevel: true,
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
      ]);
      return { objectives, actionPlans, ncrs, risks, documents, trainings, findings };
    });

    // ── 1. Objetivos SGI ──────────────────────────────────────────────────
    const activeObjectives = raw.objectives.filter((o: any) => !['ACHIEVED', 'NOT_ACHIEVED', 'CANCELLED'].includes(o.status));
    const objectiveIssues: ReadinessIssue[] = [];
    for (const o of activeObjectives) {
      const delayed = o.endDate && new Date(o.endDate).getTime() < now.getTime();
      const stale = new Date(o.updatedAt).getTime() < staleThreshold.getTime();
      if (delayed || stale) {
        objectiveIssues.push({
          id: o.id,
          title: `${o.code ?? ''} ${o.title}`.trim(),
          detail: delayed ? `Vencido (progreso ${o.progress}%)` : `Sin actualización hace 45+ días (progreso ${o.progress}%)`,
          severity: delayed ? 'HIGH' : 'MEDIUM',
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
    }
    const risksModule: ModuleReadiness = {
      key: 'riesgos', label: 'Riesgos', href: '/riesgos',
      total: raw.risks.filter((r: any) => r.riskLevel >= 12).length, pending: riskIssues.length,
      score: scoreFrom(raw.risks.filter((r: any) => r.riskLevel >= 12).length, riskIssues.length),
      issues: riskIssues.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'HIGH' ? -1 : 1)).slice(0, 10),
    };

    // ── 4. Documentos ─────────────────────────────────────────────────────
    const docIssues: ReadinessIssue[] = [];
    for (const d of raw.documents) {
      const expired = d.nextReviewDate && new Date(d.nextReviewDate).getTime() < now.getTime();
      const dueSoon = d.nextReviewDate && !expired && (new Date(d.nextReviewDate).getTime() - now.getTime()) / DAY_MS <= 15;
      const noOwner = !d.ownerId;
      if (expired || noOwner) {
        docIssues.push({
          id: d.id, title: d.title,
          detail: expired ? 'Revisión vencida' : 'Sin responsable asignado',
          severity: expired ? 'HIGH' : 'MEDIUM',
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
      }
    }
    const findingsModule: ModuleReadiness = {
      key: 'hallazgos', label: 'Hallazgos de auditoría', href: '/auditoria',
      total: raw.findings.length, pending: findingIssues.length,
      score: scoreFrom(raw.findings.length, findingIssues.length),
      issues: findingIssues.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'HIGH' ? -1 : 1)).slice(0, 10),
    };

    const modules = [objectivesModule, actionPlansModule, ncrModule, risksModule, documentsModule, trainingsModule, findingsModule];
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
