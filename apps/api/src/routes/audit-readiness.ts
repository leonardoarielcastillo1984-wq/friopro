import { getEffectiveTenantId } from '../utils/tenant-bypass.js';
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { createGroqOnlyLLMProvider } from '../services/llm/factory.js';

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
      const [objectives, actionPlans, ncrs, risks, documents, trainings, findings, audits, auditPrograms, mgmtReviews, indicators, orgContext, stakeholders, suppliers, processes, drillScenarios, maintenancePlans, measuringEquipment, positionCompetencies, employeeCompetencies, policies, processMaps, surveys, normativeStandards, comms, positions, employees, inspeccionHallazgos, cambios, vehiculos, ncrPlans] = await Promise.all([
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
            id: true, code: true, title: true, riskLevel: true, ownerId: true, responsible: true,
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
          where: { tenantId, deletedAt: null },
          select: { id: true, code: true, description: true, detectedAt: true, severity: true, status: true, ncrId: true },
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
        tx.supplier.findMany({
          where: { tenantId, deletedAt: null },
          select: { id: true, code: true, name: true, status: true, isCritical: true, evaluationScore: true, lastEvaluationDate: true, nextEvaluationDate: true },
        }).catch(() => []),
        tx.process.findMany({
          where: { tenantId, deletedAt: null, parentId: null },
          select: { id: true, code: true, name: true, owner: true, inputs: true, outputs: true, processIndicators: { select: { id: true } }, processDocuments: { select: { id: true } }, processRisks: { select: { id: true } } },
        }).catch(() => []),
        tx.drillScenario.findMany({
          where: { tenantId, deletedAt: null },
          select: { id: true, name: true, type: true, status: true, scheduledDate: true, executionDate: true },
        }).catch(() => []),
        tx.maintenancePlan.findMany({
          where: { tenantId, status: 'ACTIVE' },
          select: { id: true, code: true, title: true, nextExecutionDate: true, lastExecutionDate: true },
        }).catch(() => []),
        tx.measuringEquipment.findMany({
          where: { tenantId, deletedAt: null, status: 'ACTIVE' },
          select: { id: true, code: true, name: true, nextCalibrationDate: true, lastCalibrationDate: true },
        }).catch(() => []),
        tx.positionCompetency.findMany({
          select: { id: true, positionId: true, competencyId: true, requiredLevel: true },
        }).catch(() => []),
        tx.employeeCompetency.findMany({
          select: { id: true, employeeId: true, competencyId: true, currentLevel: true, employee: { select: { firstName: true, lastName: true, positionId: true } } },
        }).catch(() => []),
        tx.policy.findMany({
          where: { tenantId, deletedAt: null },
          select: { id: true, name: true, content: true, scope: true, active: true, signedPdfUrl: true, updatedAt: true },
        }).catch(() => []),
        tx.processMap.findMany({
          where: { tenantId, deletedAt: null },
          select: { id: true, name: true, scope: true },
        }).catch(() => []),
        tx.survey.findMany({
          where: { tenantId, isActive: true, type: { in: ['SATISFACTION', 'NPS'] } },
          select: { id: true, code: true, title: true, type: true, startDate: true, endDate: true, responses: { select: { id: true } } },
        }).catch(() => []),
        tx.normativeStandard.findMany({
          where: { tenantId, deletedAt: null },
          select: { id: true, name: true, code: true, version: true, status: true, totalClauses: true },
        }).catch(() => []),
        tx.climaComms.findMany({
          where: { tenantId, deletedAt: null, status: 'ENVIADO' },
          select: { id: true, title: true, sentAt: true, sentCount: true },
        }).catch(() => []),
        tx.position.findMany({
          where: { tenantId, deletedAt: null },
          select: { id: true, name: true, code: true, level: true, responsibilities: true, employees: { select: { id: true, firstName: true, lastName: true, supervisorId: true } }, additionalEmployees: { select: { employeeId: true } } },
        }).catch(() => []),
        tx.employee.findMany({
          where: { tenantId, status: 'ACTIVE' },
          select: { id: true, firstName: true, lastName: true, positionId: true, supervisorId: true, orgLevel: true },
        }).catch(() => []),
        tx.inspeccionHallazgo.findMany({
          where: { tenantId, estado: { in: ['ABIERTO', 'EN_PROCESO'] } },
          select: { id: true, descripcion: true, tipo: true, severidad: true, estado: true, fechaLimite: true, createdAt: true },
        }).catch(() => []),
        tx.gestionCambio.findMany({
          where: { tenantId, deletedAt: null, status: { notIn: ['CERRADO', 'RECHAZADO'] } },
          select: { id: true, code: true, titulo: true, status: true, nivelGlobal: true, fechaPrevista: true, responsableId: true, createdAt: true },
        }).catch(() => []),
        (tx as any).vehiculo?.findMany({
          where: { tenantId },
          select: { id: true, dominio: true, marca: true, modelo: true, status: true, currentOdometer: true, maintenanceAssetId: true, vencimientos: { select: { id: true, tipo: true, fechaVto: true, renovado: true } } },
        }).catch(() => []) ?? [],
        // Planes de acción vinculados a NCRs — para saber si un hallazgo ya fue gestionado
        tx.actionPlan.findMany({
          where: { tenantId, deletedAt: null, ncrId: { not: null } },
          select: { ncrId: true, status: true },
        }).catch(() => []),
      ]);
      return { objectives, actionPlans, ncrs, risks, documents, trainings, findings, audits, auditPrograms, mgmtReviews, indicators, orgContext, stakeholders, suppliers, processes, drillScenarios, maintenancePlans, measuringEquipment, positionCompetencies, employeeCompetencies, policies, processMaps, surveys, normativeStandards, comms, positions, employees, inspeccionHallazgos, cambios, vehiculos, ncrPlans };
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
      // `total` cuenta TODOS los planes (incluidos los ya cerrados) para que
      // el contador "X de Y" refleje el progreso real al cerrar planes; antes
      // usaba openPlans.length, que siempre era igual a `pending` (todo plan
      // abierto se marca como pendiente), haciendo que "X de X" nunca bajara
      // aunque se cerraran planes.
      total: raw.actionPlans.length, pending: planIssues.length,
      score: scoreFrom(raw.actionPlans.length, planIssues.length),
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
      const noOwner = !r.ownerId && !(r.responsible && r.responsible.trim() !== '');
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
    const risksWithIssues = new Set(riskIssues.map((i) => i.id));
    const risksModule: ModuleReadiness = {
      key: 'riesgos', label: 'Riesgos', href: '/riesgos',
      total: raw.risks.length, pending: risksWithIssues.size,
      score: scoreFrom(raw.risks.length, risksWithIssues.size),
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
    // Un hallazgo abierto cuya NC tiene un plan de acción cerrado cuenta como
    // gestionado (las acciones correctivas ya se cargaron y cerraron en Calidad).
    const closedPlanNcrIds = new Set<string>(
      (raw.ncrPlans as any[])
        .filter((p: any) => ['CLOSED', 'EFFECTIVE', 'NOT_EFFECTIVE'].includes(p.status))
        .map((p: any) => p.ncrId)
    );
    const openFindings = (raw.findings as any[]).filter((f: any) =>
      ['OPEN', 'IN_ANALYSIS', 'IN_ACTION', 'REOPENED'].includes(f.status)
    );
    const findingIssues: ReadinessIssue[] = [];
    for (const f of openFindings) {
      if (f.ncrId && closedPlanNcrIds.has(f.ncrId)) continue; // plan cerrado → gestionado
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
        href: '/reportes/informe-direccion',
      });
    } else {
      for (const r of reviewThisYear) {
        if (r.status === 'DRAFT') {
          reviewIssues.push({
            id: r.id, title: r.title,
            detail: 'Revisión en borrador (no finalizada)', severity: 'MEDIUM',
            href: '/reportes/informe-direccion',
          });
        }
      }
    }
    const mgmtReviewModule: ModuleReadiness = {
      key: 'revision-direccion', label: 'Revisión por la Dirección', href: '/reportes/informe-direccion',
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

    // ── 11. Proveedores (8.4) ────────────────────────────────────────────
    const supplierIssues: ReadinessIssue[] = [];
    for (const s of raw.suppliers as any[]) {
      const noEvaluation = !s.lastEvaluationDate;
      const overdue = s.nextEvaluationDate && new Date(s.nextEvaluationDate).getTime() < now.getTime();
      const lowScore = s.evaluationScore != null && s.evaluationScore < 60 && s.status === 'APPROVED';
      if (s.isCritical && noEvaluation) {
        supplierIssues.push({
          id: s.id, title: `${s.code} — ${s.name}`,
          detail: 'Proveedor crítico sin evaluación', severity: 'HIGH',
          href: '/proveedores',
        });
      } else if (overdue) {
        supplierIssues.push({
          id: s.id, title: `${s.code} — ${s.name}`,
          detail: 'Evaluación vencida', severity: 'HIGH',
          href: '/proveedores',
        });
      } else if (lowScore) {
        supplierIssues.push({
          id: s.id, title: `${s.code} — ${s.name}`,
          detail: `Aprobado con score bajo (${s.evaluationScore})`, severity: 'MEDIUM',
          href: '/proveedores',
        });
      } else if (noEvaluation) {
        supplierIssues.push({
          id: s.id, title: `${s.code} — ${s.name}`,
          detail: 'Sin evaluación', severity: 'LOW',
          href: '/proveedores',
        });
      }
    }
    const suppliersModule: ModuleReadiness = {
      key: 'proveedores', label: 'Proveedores', href: '/proveedores',
      total: (raw.suppliers as any[]).length, pending: supplierIssues.length,
      score: scoreFrom((raw.suppliers as any[]).length, supplierIssues.length),
      issues: supplierIssues.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'HIGH' ? -1 : 1)).slice(0, 10),
    };

    // ── 12. Mapa de Procesos (4.4) ───────────────────────────────────────
    const processIssues: ReadinessIssue[] = [];
    for (const p of raw.processes as any[]) {
      const noOwner = !p.owner;
      const noIndicators = (p.processIndicators ?? []).length === 0;
      const noDocuments = (p.processDocuments ?? []).length === 0;
      if (noOwner) {
        processIssues.push({
          id: p.id, title: `${p.code ?? ''} ${p.name}`.trim(),
          detail: 'Sin responsable de proceso', severity: 'MEDIUM',
          href: '/contexto-sgi?tab=mapa',
        });
      }
      if (noIndicators) {
        processIssues.push({
          id: p.id, title: `${p.code ?? ''} ${p.name}`.trim(),
          detail: 'Sin indicadores vinculados', severity: 'LOW',
          href: '/contexto-sgi?tab=mapa',
        });
      }
      if (noDocuments) {
        processIssues.push({
          id: p.id, title: `${p.code ?? ''} ${p.name}`.trim(),
          detail: 'Sin documentos vinculados', severity: 'LOW',
          href: '/contexto-sgi?tab=mapa',
        });
      }
    }
    const processesWithIssues = new Set(processIssues.map((i) => i.id));
    const processesModule: ModuleReadiness = {
      key: 'mapa-procesos', label: 'Mapa de Procesos', href: '/contexto-sgi?tab=mapa',
      total: (raw.processes as any[]).length, pending: processesWithIssues.size,
      score: scoreFrom((raw.processes as any[]).length, processesWithIssues.size),
      issues: processIssues.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'HIGH' ? -1 : 1)).slice(0, 10),
    };

    // ── 13. Simulacros (8.2 ISO 14001/45001) ──────────────────────────────
    const drillIssues: ReadinessIssue[] = [];
    for (const d of raw.drillScenarios as any[]) {
      const plannedNotExecuted = d.status === 'PLANNED' && d.scheduledDate && new Date(d.scheduledDate).getTime() < now.getTime();
      const neverExecuted = !d.executionDate && d.status !== 'CANCELLED';
      if (plannedNotExecuted) {
        drillIssues.push({
          id: d.id, title: d.name,
          detail: 'Simulacro programado sin ejecutar (fecha vencida)', severity: 'HIGH',
          href: '/simulacros',
        });
      } else if (neverExecuted) {
        drillIssues.push({
          id: d.id, title: d.name,
          detail: 'Escenario sin ejecutar', severity: 'LOW',
          href: '/simulacros',
        });
      }
    }
    const drillsModule: ModuleReadiness = {
      key: 'simulacros', label: 'Simulacros y Emergencias', href: '/simulacros',
      total: (raw.drillScenarios as any[]).length, pending: drillIssues.length,
      score: scoreFrom((raw.drillScenarios as any[]).length, drillIssues.length),
      issues: drillIssues.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'HIGH' ? -1 : 1)).slice(0, 10),
    };

    // ── 14. Infraestructura (7.1.3) ──────────────────────────────────────
    const infraIssues: ReadinessIssue[] = [];
    for (const m of raw.maintenancePlans as any[]) {
      const overdue = m.nextExecutionDate && new Date(m.nextExecutionDate).getTime() < now.getTime();
      if (overdue) {
        infraIssues.push({
          id: m.id, title: `${m.code} — ${m.title}`,
          detail: 'Mantenimiento preventivo vencido', severity: 'HIGH',
          href: '/infraestructura',
        });
      }
    }
    for (const eq of raw.measuringEquipment as any[]) {
      const overdue = eq.nextCalibrationDate && new Date(eq.nextCalibrationDate).getTime() < now.getTime();
      const noCalibration = !eq.lastCalibrationDate;
      if (overdue) {
        infraIssues.push({
          id: eq.id, title: `${eq.code} — ${eq.name}`,
          detail: 'Calibración vencida', severity: 'HIGH',
          href: '/infraestructura',
        });
      } else if (noCalibration) {
        infraIssues.push({
          id: eq.id, title: `${eq.code} — ${eq.name}`,
          detail: 'Sin calibración registrada', severity: 'MEDIUM',
          href: '/infraestructura',
        });
      }
    }
    const infraModule: ModuleReadiness = {
      key: 'infraestructura', label: 'Infraestructura', href: '/infraestructura',
      total: (raw.maintenancePlans as any[]).length + (raw.measuringEquipment as any[]).length,
      pending: infraIssues.length,
      score: scoreFrom((raw.maintenancePlans as any[]).length + (raw.measuringEquipment as any[]).length, infraIssues.length),
      issues: infraIssues.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'HIGH' ? -1 : 1)).slice(0, 10),
    };

    // ── 15. Competencias (7.2) ───────────────────────────────────────────
    const competencyIssues: ReadinessIssue[] = [];
    const posComps = raw.positionCompetencies as any[];
    const empComps = raw.employeeCompetencies as any[];
    // Build map: positionId -> competencyId -> requiredLevel
    const posCompMap = new Map<string, Map<string, number>>();
    for (const pc of posComps) {
      if (!posCompMap.has(pc.positionId)) posCompMap.set(pc.positionId, new Map());
      posCompMap.get(pc.positionId)!.set(pc.competencyId, pc.requiredLevel);
    }
    // Build map: employeeId+competencyId -> currentLevel
    const empCompMap = new Map<string, number>();
    for (const ec of empComps) {
      empCompMap.set(`${ec.employeeId}_${ec.competencyId}`, ec.currentLevel);
    }
    // Check gaps
    const seenGaps = new Set<string>();
    for (const ec of empComps) {
      const posId = ec.employee?.positionId;
      if (!posId) continue;
      const compMap = posCompMap.get(posId);
      if (!compMap) continue;
      const required = compMap.get(ec.competencyId);
      if (required != null && ec.currentLevel < required) {
        const empName = `${ec.employee?.firstName ?? ''} ${ec.employee?.lastName ?? ''}`.trim();
        const gapKey = `${ec.employeeId}_${ec.competencyId}`;
        if (!seenGaps.has(gapKey)) {
          seenGaps.add(gapKey);
          competencyIssues.push({
            id: gapKey, title: empName,
            detail: `Brecha de competencia (actual: ${ec.currentLevel}, requerido: ${required})`, severity: 'MEDIUM',
            href: '/rrhh/matriz-polivalencia',
          });
        }
      }
    }
    // Positions without any competencies defined
    const positionsWithComps = new Set(posComps.map((pc: any) => pc.positionId));
    for (const ec of empComps) {
      const posId = ec.employee?.positionId;
      if (posId && !positionsWithComps.has(posId)) {
        const empName = `${ec.employee?.firstName ?? ''} ${ec.employee?.lastName ?? ''}`.trim();
        const gapKey = `pos_${posId}`;
        if (!seenGaps.has(gapKey)) {
          seenGaps.add(gapKey);
          competencyIssues.push({
            id: gapKey, title: empName,
            detail: 'Cargo sin competencias definidas', severity: 'LOW',
            href: '/rrhh/matriz-polivalencia',
          });
        }
      }
    }
    const competencyModule: ModuleReadiness = {
      key: 'competencias', label: 'Competencias', href: '/rrhh/matriz-polivalencia',
      total: empComps.length, pending: competencyIssues.length,
      score: scoreFrom(Math.max(1, empComps.length), competencyIssues.length),
      issues: competencyIssues.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'HIGH' ? -1 : 1)).slice(0, 10),
    };

    // ── 16. Política de Calidad (5.2) ────────────────────────────────────
    const policyIssues: ReadinessIssue[] = [];
    const activePolicies = (raw.policies as any[]).filter((p) => p.active);
    if (activePolicies.length === 0) {
      policyIssues.push({
        id: 'no-policy', title: 'Política de Calidad',
        detail: 'No existe política de calidad definida y activa', severity: 'HIGH',
        href: '/objetivos/politicas',
      });
    } else {
      for (const p of activePolicies) {
        if (!p.content) {
          policyIssues.push({
            id: p.id, title: p.name,
            detail: 'Política sin contenido definido', severity: 'HIGH',
            href: '/objetivos/politicas',
          });
        }
        if (!p.signedPdfUrl) {
          policyIssues.push({
            id: p.id, title: p.name,
            detail: 'Política sin PDF firmado', severity: 'MEDIUM',
            href: '/objetivos/politicas',
          });
        }
        const policyAge = (now.getTime() - new Date(p.updatedAt).getTime()) / DAY_MS;
        if (policyAge > 365) {
          policyIssues.push({
            id: p.id, title: p.name,
            detail: `Política sin revisar hace ${Math.round(policyAge / 30)} meses`, severity: 'MEDIUM',
            href: '/objetivos/politicas',
          });
        }
      }
    }
    const policiesWithIssues = new Set(policyIssues.map((i) => i.id));
    const policyModule: ModuleReadiness = {
      key: 'politica-calidad', label: 'Política de Calidad', href: '/objetivos/politicas',
      total: Math.max(1, activePolicies.length), pending: policiesWithIssues.size,
      score: scoreFrom(Math.max(1, activePolicies.length), policiesWithIssues.size),
      issues: policyIssues.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'HIGH' ? -1 : 1)).slice(0, 10),
    };

    // ── 17. Alcance del SGC (4.3) ────────────────────────────────────────
    const scopeIssues: ReadinessIssue[] = [];
    const scopeCtx = raw.orgContext as any;
    const maps = raw.processMaps as any[];
    if (maps.length === 0) {
      scopeIssues.push({
        id: 'no-map', title: 'Mapa de Procesos',
        detail: 'No existe mapa de procesos definido', severity: 'HIGH',
        href: '/contexto-sgi',
      });
    } else {
      for (const m of maps) {
        if (!m.scope) {
          scopeIssues.push({
            id: m.id, title: m.name,
            detail: 'Mapa de procesos sin alcance definido', severity: 'MEDIUM',
            href: '/contexto-sgi',
          });
        }
      }
    }
    if (scopeCtx && (!scopeCtx.mission || !scopeCtx.vision)) {
      scopeIssues.push({
        id: 'no-mv', title: 'Misión y Visión',
        detail: scopeCtx.mission ? 'Sin visión definida' : 'Sin misión definida', severity: 'LOW',
        href: '/contexto-sgi',
      });
    }
    const scopeModule: ModuleReadiness = {
      key: 'alcance-sgc', label: 'Alcance del SGC', href: '/contexto-sgi',
      total: Math.max(1, maps.length), pending: scopeIssues.length,
      score: scoreFrom(Math.max(1, maps.length), scopeIssues.length),
      issues: scopeIssues.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'HIGH' ? -1 : 1)).slice(0, 10),
    };

    // ── 18. Comunicación (7.4) ──────────────────────────────────────────
    const commIssues: ReadinessIssue[] = [];
    const sentComms = raw.comms as any[];
    if (sentComms.length === 0) {
      commIssues.push({
        id: 'no-comms', title: 'Comunicaciones internas',
        detail: 'No hay comunicaciones internas enviadas', severity: 'MEDIUM',
        href: '/clima',
      });
    } else {
      const lastComm = sentComms[0];
      const daysSinceLastComm = (now.getTime() - new Date(lastComm.sentAt).getTime()) / DAY_MS;
      if (daysSinceLastComm > 90) {
        commIssues.push({
          id: 'stale-comms', title: 'Comunicaciones internas',
          detail: `Sin comunicaciones en ${Math.round(daysSinceLastComm / 30)} meses`, severity: 'LOW',
          href: '/clima',
        });
      }
    }
    const commModule: ModuleReadiness = {
      key: 'comunicacion', label: 'Comunicación', href: '/clima',
      total: Math.max(1, sentComms.length), pending: commIssues.length,
      score: scoreFrom(Math.max(1, sentComms.length), commIssues.length),
      issues: commIssues.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'HIGH' ? -1 : 1)).slice(0, 10),
    };

    // ── 19. Satisfacción del Cliente (9.1.2) ────────────────────────────
    const satisfactionIssues: ReadinessIssue[] = [];
    const surveys = raw.surveys as any[];
    if (surveys.length === 0) {
      satisfactionIssues.push({
        id: 'no-surveys', title: 'Satisfacción del Cliente',
        detail: 'No existen encuestas de satisfacción activas', severity: 'HIGH',
        href: '/encuestas',
      });
    } else {
      for (const s of surveys) {
        const responseCount = (s.responses ?? []).length;
        if (responseCount === 0) {
          satisfactionIssues.push({
            id: s.id, title: s.title,
            detail: 'Encuesta sin respuestas recibidas', severity: 'MEDIUM',
            href: '/encuestas',
          });
        }
      }
    }
    const satisfactionModule: ModuleReadiness = {
      key: 'satisfaccion-cliente', label: 'Satisfacción del Cliente', href: '/encuestas',
      total: Math.max(1, surveys.length), pending: satisfactionIssues.length,
      score: scoreFrom(Math.max(1, surveys.length), satisfactionIssues.length),
      issues: satisfactionIssues.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'HIGH' ? -1 : 1)).slice(0, 10),
    };

    // ── 20. Cumplimiento Normativo (9.1.1) ──────────────────────────────
    const complianceIssues: ReadinessIssue[] = [];
    const norms = raw.normativeStandards as any[];
    if (norms.length === 0) {
      complianceIssues.push({
        id: 'no-norms', title: 'Normas y Requisitos Legales',
        detail: 'No hay normas cargadas en el sistema', severity: 'HIGH',
        href: '/normativos',
      });
    } else {
      for (const n of norms) {
        if (n.status !== 'COMPLETED' && n.status !== 'PROCESSED') {
          complianceIssues.push({
            id: n.id, title: n.name,
            detail: 'Norma cargada pero no procesada', severity: 'MEDIUM',
            href: '/normativos',
          });
        }
        if (n.totalClauses === 0) {
          complianceIssues.push({
            id: n.id, title: n.name,
            detail: 'Norma sin cláusulas extraídas', severity: 'MEDIUM',
            href: '/normativos',
          });
        }
      }
    }
    const normsWithIssues = new Set(complianceIssues.map((i) => i.id));
    const complianceModule: ModuleReadiness = {
      key: 'cumplimiento-normativo', label: 'Cumplimiento Normativo', href: '/normativos',
      total: Math.max(1, norms.length), pending: normsWithIssues.size,
      score: scoreFrom(Math.max(1, norms.length), normsWithIssues.size),
      issues: complianceIssues.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'HIGH' ? -1 : 1)).slice(0, 10),
    };

    // ── 21. Organigrama y Roles (5.3) ──────────────────────────────────
    const orgIssues: ReadinessIssue[] = [];
    const allPositions = raw.positions as any[];
    const allEmployees = raw.employees as any[];
    if (allPositions.length === 0) {
      orgIssues.push({
        id: 'no-positions', title: 'Cargos y Responsabilidades',
        detail: 'No hay cargos definidos en el organigrama', severity: 'HIGH',
        href: '/rrhh',
      });
    } else {
      for (const p of allPositions) {
        const noResponsibilities = (p.responsibilities ?? []).length === 0;
        const noEmployees = (p.employees ?? []).length === 0 && (p.additionalEmployees ?? []).length === 0;
        if (noResponsibilities) {
          orgIssues.push({
            id: p.id, title: p.name,
            detail: 'Cargo sin responsabilidades definidas', severity: 'MEDIUM',
            href: '/rrhh',
          });
        }
        if (noEmployees && p.level !== 'VACANT') {
          orgIssues.push({
            id: p.id, title: p.name,
            detail: 'Cargo sin personal asignado', severity: 'LOW',
            href: '/rrhh',
          });
        }
      }
    }
    const employeesWithoutPosition = allEmployees.filter((e) => !e.positionId);
    if (employeesWithoutPosition.length > 0) {
      orgIssues.push({
        id: 'no-position-emp', title: `${employeesWithoutPosition.length} empleados sin cargo`,
        detail: 'Empleados activos sin cargo asignado en el organigrama', severity: 'MEDIUM',
        href: '/rrhh',
      });
    }
    const employeesWithoutSupervisor = allEmployees.filter((e) => !e.supervisorId && (e as any).orgLevel !== 0);
    if (employeesWithoutSupervisor.length > 0 && allEmployees.length > 1) {
      orgIssues.push({
        id: 'no-supervisor', title: `${employeesWithoutSupervisor.length} empleados sin supervisor`,
        detail: 'Empleados sin supervisor definido en la jerarquía', severity: 'LOW',
        href: '/rrhh',
      });
    }
    const orgWithIssues = new Set(orgIssues.map((i) => i.id));
    const orgModule: ModuleReadiness = {
      key: 'organigrama-roles', label: 'Organigrama y Roles', href: '/rrhh',
      total: Math.max(1, allPositions.length), pending: orgWithIssues.size,
      score: scoreFrom(Math.max(1, allPositions.length), orgWithIssues.size),
      issues: orgIssues.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'HIGH' ? -1 : 1)).slice(0, 10),
    };

    // ── 22. Requisitos del Cliente (8.2) ───────────────────────────────
    const reqIssues: ReadinessIssue[] = [];
    for (const p of raw.processes as any[]) {
      const noInputs = !p.inputs || (typeof p.inputs === 'string' && !p.inputs.trim());
      const noOutputs = !p.outputs || (typeof p.outputs === 'string' && !p.outputs.trim());
      if (noInputs && noOutputs) {
        reqIssues.push({
          id: p.id, title: `${p.code ?? ''} ${p.name}`.trim(),
          detail: 'Proceso sin entradas ni salidas definidas', severity: 'MEDIUM',
          href: '/contexto-sgi',
        });
      }
    }
    const reqModule: ModuleReadiness = {
      key: 'requisitos-cliente', label: 'Requisitos del Cliente', href: '/contexto-sgi',
      total: Math.max(1, (raw.processes as any[]).length), pending: reqIssues.length,
      score: scoreFrom(Math.max(1, (raw.processes as any[]).length), reqIssues.length),
      issues: reqIssues.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'HIGH' ? -1 : 1)).slice(0, 10),
    };

    // ── 23. Inspecciones (8.5/8.6) ──────────────────────────────────────
    const inspIssues: ReadinessIssue[] = [];
    for (const h of raw.inspeccionHallazgos as any[]) {
      const overdue = h.fechaLimite && new Date(h.fechaLimite).getTime() < now.getTime();
      const stale = !h.fechaLimite && new Date(h.createdAt).getTime() < findingStaleThreshold.getTime();
      if (overdue) {
        inspIssues.push({
          id: h.id, title: h.descripcion.slice(0, 60),
          detail: `Hallazgo de inspección vencido (${h.severidad})`, severity: h.severidad === 'CRITICO' ? 'HIGH' : 'MEDIUM',
          href: '/infraestructura',
        });
      } else if (stale) {
        inspIssues.push({
          id: h.id, title: h.descripcion.slice(0, 60),
          detail: `Hallazgo abierto sin fecha límite (${h.severidad})`, severity: 'LOW',
          href: '/infraestructura',
        });
      } else {
        inspIssues.push({
          id: h.id, title: h.descripcion.slice(0, 60),
          detail: `Hallazgo ${h.estado.toLowerCase()} (${h.severidad})`, severity: 'LOW',
          href: '/infraestructura',
        });
      }
    }
    const inspModule: ModuleReadiness = {
      key: 'inspecciones', label: 'Inspecciones y Liberación', href: '/infraestructura',
      total: Math.max(1, (raw.inspeccionHallazgos as any[]).length), pending: inspIssues.length,
      score: scoreFrom(Math.max(1, (raw.inspeccionHallazgos as any[]).length), inspIssues.length),
      issues: inspIssues.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'HIGH' ? -1 : 1)).slice(0, 10),
    };

    // ── 24. Gestión de Cambios (6.3) ───────────────────────────────────
    const cambioIssues: ReadinessIssue[] = [];
    for (const c of raw.cambios as any[]) {
      const overdue = c.fechaPrevista && new Date(c.fechaPrevista).getTime() < now.getTime();
      const noResponsible = !c.responsableId;
      const stale = new Date(c.createdAt).getTime() < staleThreshold.getTime();
      if (overdue && c.status !== 'IMPLEMENTADO') {
        cambioIssues.push({
          id: c.id, title: `${c.code} — ${c.titulo}`,
          detail: `Cambio vencido (estado: ${c.status})`, severity: 'HIGH',
          href: '/calidad?tab=cambios',
        });
      } else if (noResponsible && c.status !== 'SOLICITADO') {
        cambioIssues.push({
          id: c.id, title: `${c.code} — ${c.titulo}`,
          detail: 'Cambio sin responsable asignado', severity: 'MEDIUM',
          href: '/calidad?tab=cambios',
        });
      } else if (stale && c.status === 'SOLICITADO') {
        cambioIssues.push({
          id: c.id, title: `${c.code} — ${c.titulo}`,
          detail: 'Solicitud de cambio sin revisar (>45 días)', severity: 'MEDIUM',
          href: '/calidad?tab=cambios',
        });
      } else if (c.nivelGlobal === 'CRITICO' && c.status !== 'APROBADO' && c.status !== 'IMPLEMENTADO') {
        cambioIssues.push({
          id: c.id, title: `${c.code} — ${c.titulo}`,
          detail: 'Cambio crítico sin aprobar', severity: 'MEDIUM',
          href: '/calidad?tab=cambios',
        });
      }
    }
    const cambioModule: ModuleReadiness = {
      key: 'gestion-cambios', label: 'Gestión de Cambios', href: '/calidad?tab=cambios',
      total: Math.max(1, (raw.cambios as any[]).length), pending: cambioIssues.length,
      score: scoreFrom(Math.max(1, (raw.cambios as any[]).length), cambioIssues.length),
      issues: cambioIssues.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'HIGH' ? -1 : 1)).slice(0, 10),
    };

    // ── 26. Flota y Vehículos (7.1.3) ──────────────────────────────────
    const flotaIssues: ReadinessIssue[] = [];
    const vehiculos = (raw.vehiculos ?? []) as any[];
    if (vehiculos.length === 0) {
      flotaIssues.push({
        id: 'no-flota', title: 'Flota de Vehículos',
        detail: 'No hay vehículos cargados en el sistema', severity: 'LOW',
        href: '/flota',
      });
    } else {
      for (const v of vehiculos) {
        if (v.status === 'EN_TALLER') {
          flotaIssues.push({
            id: v.id, title: `${v.dominio} — ${v.marca ?? ''} ${v.modelo ?? ''}`.trim(),
            detail: 'Vehículo en taller (no operativo)', severity: 'HIGH',
            href: '/flota',
          });
        }
        if (v.status === 'INACTIVO' || v.status === 'BAJA') {
          flotaIssues.push({
            id: v.id, title: `${v.dominio} — ${v.marca ?? ''} ${v.modelo ?? ''}`.trim(),
            detail: 'Vehículo inactivo/dado de baja', severity: 'LOW',
            href: '/flota',
          });
        }
        const vencimientos = (v.vencimientos ?? []).filter((venc: any) => !venc.renovado);
        const docsVencidos = vencimientos.filter((venc: any) => new Date(venc.fechaVto) < now);
        const docsPorVencer = vencimientos.filter((venc: any) => {
          const dias = Math.ceil((new Date(venc.fechaVto).getTime() - now.getTime()) / DAY_MS);
          return dias >= 0 && dias <= 30;
        });
        if (docsVencidos.length > 0) {
          flotaIssues.push({
            id: `${v.id}-docs-venc`, title: `${v.dominio}`,
            detail: `${docsVencidos.length} documento(s) vencido(s): ${docsVencidos.map((d: any) => d.tipo).join(', ')}`, severity: 'HIGH',
            href: '/flota',
          });
        }
        if (docsPorVencer.length > 0) {
          flotaIssues.push({
            id: `${v.id}-docs-por-vencer`, title: `${v.dominio}`,
            detail: `${docsPorVencer.length} documento(s) por vencer (≤30 días): ${docsPorVencer.map((d: any) => d.tipo).join(', ')}`, severity: 'MEDIUM',
            href: '/flota',
          });
        }
        if (!v.maintenanceAssetId) {
          flotaIssues.push({
            id: `${v.id}-no-asset`, title: `${v.dominio}`,
            detail: 'Sin activo de mantenimiento vinculado', severity: 'LOW',
            href: '/flota',
          });
        }
      }
    }
    const flotaWithIssues = new Set(flotaIssues.map((i) => i.id));
    const flotaModule: ModuleReadiness = {
      key: 'flota', label: 'Flota y Vehículos', href: '/flota',
      total: vehiculos.length, pending: flotaWithIssues.size,
      score: scoreFrom(Math.max(1, vehiculos.length), flotaWithIssues.size),
      issues: flotaIssues.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'HIGH' ? -1 : 1)).slice(0, 10),
    };

    const modules = [objectivesModule, actionPlansModule, ncrModule, risksModule, documentsModule, trainingsModule, findingsModule, auditsModule, mgmtReviewModule, indicatorsModule, contextModule, suppliersModule, processesModule, drillsModule, infraModule, competencyModule, policyModule, scopeModule, commModule, satisfactionModule, complianceModule, orgModule, reqModule, inspModule, cambioModule, flotaModule];
    const overallScore = Math.round(modules.reduce((acc, m) => acc + m.score, 0) / modules.length);
    const totalPending = modules.reduce((acc, m) => acc + m.pending, 0);

    return reply.send({
      generatedAt: now.toISOString(),
      overallScore,
      totalPending,
      modules,
    });
  });

  // ── Asistente IA para completar pendientes ──────────────────────────
  app.post('/assist', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    const body = req.body as { moduleKey?: string; moduleLabel?: string; issues?: Array<{ id: string; title: string; detail: string; severity: string }> };

    if (!body.issues || !Array.isArray(body.issues) || body.issues.length === 0) {
      return reply.code(400).send({ error: 'Se requieren issues para analizar' });
    }

    const moduleLabel = body.moduleLabel || body.moduleKey || 'SGI';
    const issuesToAnalyze = body.issues.slice(0, 10);

    try {
      const llm = createGroqOnlyLLMProvider(
        (req as any).tenant, app.prisma, tenantId,
        (req as any).auth?.userId ?? null,
        'audit-readiness-assist',
      );

      const issuesText = issuesToAnalyze.map((iss, i) =>
        `${i + 1}. [${iss.severity}] ${iss.title}: ${iss.detail}`
      ).join('\n');

      const prompt = `Eres un asistente experto en sistemas de gestión ISO 9001. El usuario tiene los siguientes pendientes en el módulo "${moduleLabel}":

${issuesText}

Para cada pendiente, sugerí una acción concreta y breve (máximo 2 líneas) para resolverlo. Responde EXACTAMENTE en formato JSON (sin markdown, sin bloques de código):
{
  "suggestions": [
    { "id": "<id del issue>", "action": "<acción sugerida>", "priority": "ALTA|MEDIA|BAJA" }
  ]
}`;

      const response = await llm.chat([{ role: 'user', content: prompt }]);
      const jsonMatch = response.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return reply.code(500).send({ error: 'La IA no devolvió un formato válido' });
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const suggestions = Array.isArray(parsed.suggestions)
        ? parsed.suggestions.map((s: any) => ({
            id: String(s.id || ''),
            action: String(s.action || ''),
            priority: ['ALTA', 'MEDIA', 'BAJA'].includes(s.priority) ? s.priority : 'MEDIA',
          }))
        : [];

      return reply.send({ moduleLabel, suggestions });
    } catch (err: any) {
      console.error('Error en audit-readiness/assist:', err.message);
      return reply.code(500).send({ error: 'Error al procesar con IA', details: err.message });
    }
  });

  // ── Ejecutar acción IA (Level 3) ────────────────────────────────────
  app.post('/execute', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    const body = req.body as {
      moduleKey: string;
      issueId: string;
      action: 'assign_responsible' | 'send_reminder' | 'create_draft_action' | 'mark_in_review' | 'update_date' | 'suggest_close';
      actionData?: { responsibleId?: string; newDate?: string; actionTitle?: string; actionDescription?: string };
    };

    if (!body.moduleKey || !body.issueId || !body.action) {
      return reply.code(400).send({ error: 'Faltan parámetros: moduleKey, issueId, action' });
    }

    const userId = (req as any).auth?.userId ?? null;
    const now = new Date();

    try {
      const result = await app.runWithDbContext(req, async (tx: any) => {
        switch (body.action) {

          // ── Asignar responsable automático ──
          case 'assign_responsible': {
            const { responsibleId } = body.actionData ?? {};
            if (!responsibleId) return reply.code(400).send({ error: 'Falta responsibleId' });

            const modelMap: Record<string, string> = {
              'riesgos': 'risk',
              'documentos': 'document',
              'indicadores': 'indicator',
              'gestion-cambios': 'gestionCambio',
            };
            const modelName = modelMap[body.moduleKey];
            if (!modelName) return reply.code(400).send({ error: `No se puede asignar responsable en módulo ${body.moduleKey}` });

            const record = await tx[modelName].updateMany({
              where: { id: body.issueId, tenantId },
              data: { ownerId: responsibleId, updatedAt: now },
            });
            if (record.count === 0) return reply.code(404).send({ error: 'Registro no encontrado' });

            await tx.notification.create({
              data: {
                tenantId, userId: responsibleId,
                type: 'SYSTEM_ALERT',
                title: 'Responsabilidad asignada',
                message: `Se te asignó como responsable de un item en ${body.moduleKey}`,
                read: false, createdAt: now,
              },
            }).catch(() => {});

            return { success: true, message: 'Responsable asignado correctamente' };
          }

          // ── Enviar recordatorio ──
          case 'send_reminder': {
            const modelMap: Record<string, string> = {
              'objetivos': 'sgiObjective',
              'planes-accion': 'actionPlan',
              'ncr': 'nonConformity',
              'riesgos': 'risk',
              'documentos': 'document',
              'capacitaciones': 'sgiTraining',
              'gestion-cambios': 'gestionCambio',
            };
            const modelName = modelMap[body.moduleKey];
            if (!modelName) return reply.code(400).send({ error: `No se puede enviar recordatorio desde ${body.moduleKey}` });

            const record = await tx[modelName].findUnique({
              where: { id: body.issueId },
              select: { ownerId: true, responsibleId: true, code: true, title: true },
            }).catch(() => null);

            if (!record) return reply.code(404).send({ error: 'Registro no encontrado' });

            const targetUserId = record.ownerId || record.responsibleId;
            if (!targetUserId) return reply.code(400).send({ error: 'El registro no tiene responsable para enviar recordatorio' });

            await tx.notification.create({
              data: {
                tenantId, userId: targetUserId,
                type: 'SYSTEM_ALERT',
                title: 'Recordatorio de pendiente',
                message: `Recordatorio: el item ${record.code || record.title || body.issueId} en ${body.moduleKey} tiene un pendiente que requiere tu atención.`,
                read: false, createdAt: now,
              },
            });

            return { success: true, message: 'Recordatorio enviado al responsable' };
          }

          // ── Crear plan de acción en borrador ──
          case 'create_draft_action': {
            const { actionTitle, actionDescription } = body.actionData ?? {};
            if (!actionTitle) return reply.code(400).send({ error: 'Falta actionTitle' });

            const code = `CAPA-${now.getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;

            const plan = await tx.actionPlan.create({
              data: {
                tenantId,
                code,
                findingDescription: actionDescription || actionTitle,
                status: 'DRAFT',
                openedAt: now,
                plannedEndDate: new Date(now.getTime() + 30 * DAY_MS),
                source: 'AI_ASSISTANT',
                sourceIssueId: body.issueId,
                sourceModule: body.moduleKey,
                createdBy: userId,
              },
            }).catch((err: any) => {
              // Fallback without extra fields if they don't exist
              return tx.actionPlan.create({
                data: {
                  tenantId,
                  code,
                  findingDescription: actionDescription || actionTitle,
                  status: 'DRAFT',
                  openedAt: now,
                  plannedEndDate: new Date(now.getTime() + 30 * DAY_MS),
                },
              });
            });

            return { success: true, message: `Plan de acción creado en borrador: ${code}`, planId: plan.id };
          }

          // ── Marcar como "en revisión" ──
          case 'mark_in_review': {
            if (body.moduleKey === 'documentos') {
              const record = await tx.document.updateMany({
                where: { id: body.issueId, tenantId, status: 'DRAFT' },
                data: { status: 'REVIEW', updatedAt: now },
              });
              if (record.count === 0) return reply.code(404).send({ error: 'Documento no encontrado o no está en borrador' });
              return { success: true, message: 'Documento marcado para revisión' };
            }
            return reply.code(400).send({ error: 'mark_in_review solo aplica a documentos' });
          }

          // ── Actualizar fecha prevista ──
          case 'update_date': {
            const { newDate } = body.actionData ?? {};
            if (!newDate) return reply.code(400).send({ error: 'Falta newDate' });

            const dateFieldMap: Record<string, { model: string; field: string }> = {
              'objetivos': { model: 'sgiObjective', field: 'endDate' },
              'planes-accion': { model: 'actionPlan', field: 'plannedEndDate' },
              'ncr': { model: 'nonConformity', field: 'dueDate' },
              'capacitaciones': { model: 'sgiTraining', field: 'scheduledDate' },
              'gestion-cambios': { model: 'gestionCambio', field: 'fechaPrevista' },
            };
            const cfg = dateFieldMap[body.moduleKey];
            if (!cfg) return reply.code(400).send({ error: `No se puede actualizar fecha en ${body.moduleKey}` });

            const record = await tx[cfg.model].updateMany({
              where: { id: body.issueId, tenantId },
              data: { [cfg.field]: new Date(newDate) },
            });
            if (record.count === 0) return reply.code(404).send({ error: 'Registro no encontrado' });

            return { success: true, message: 'Fecha actualizada correctamente' };
          }

          // ── Sugerir cierre (marca para revisión humana) ──
          case 'suggest_close': {
            const modelMap: Record<string, string> = {
              'planes-accion': 'actionPlan',
              'ncr': 'nonConformity',
              'hallazgos': 'auditFinding',
              'inspecciones': 'inspeccionHallazgo',
            };
            const modelName = modelMap[body.moduleKey];
            if (!modelName) return reply.code(400).send({ error: `No se puede sugerir cierre en ${body.moduleKey}` });

            // Create a notification for the quality manager
            await tx.notification.create({
              data: {
                tenantId,
                type: 'SYSTEM_ALERT',
                title: 'Sugerencia de cierre (IA)',
                message: `La IA sugiere cerrar el item ${body.issueId} del módulo ${body.moduleKey}. Revisá y confirmá el cierre manualmente.`,
                read: false, createdAt: now,
              },
            }).catch(() => {});

            return { success: true, message: 'Sugerencia de cierre enviada al responsable de calidad' };
          }

          default:
            return reply.code(400).send({ error: `Acción no soportada: ${body.action}` });
        }
      });

      return reply.send(result);
    } catch (err: any) {
      console.error('Error en audit-readiness/execute:', err.message);
      return reply.code(500).send({ error: 'Error al ejecutar acción', details: err.message });
    }
  });

  // ── Auto-fix masivo para Mapa de Procesos ───────────────────────────
  // Estrategia: tomar como ejemplo los procesos que ya están completos
  // (tienen owner, indicadores y documentos vinculados) y replicar esos
  // datos a los procesos que tienen el mismo nombre pero están incompletos.
  app.post('/auto-fix', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    const body = req.body as { moduleKey: string };
    if (!body.moduleKey) return reply.code(400).send({ error: 'Falta moduleKey' });

    const supportedModules = ['mapa-procesos', 'riesgos', 'documentos', 'indicadores', 'organigrama-roles'];
    if (!supportedModules.includes(body.moduleKey)) {
      return reply.code(400).send({ error: `Auto-fix disponible para: ${supportedModules.join(', ')}` });
    }

    try {
      const result = await app.runWithDbContext(req, async (tx: any) => {

        // ── Auto-fix para organigrama-roles ──
        if (body.moduleKey === 'organigrama-roles') {
          console.log('[auto-fix] ORG-ROLES: starting...');
          const positions = await tx.position.findMany({
            where: { tenantId, deletedAt: null },
            select: { id: true, name: true, responsibilities: true, level: true, employees: { select: { id: true } }, additionalEmployees: { select: { employeeId: true } } },
          }).catch((e: any) => { console.error('[auto-fix] ORG positions error:', e.message); return []; });

          const employees = await tx.employee.findMany({
            where: { tenantId, status: 'ACTIVE' },
            select: { id: true, firstName: true, lastName: true, positionId: true, supervisorId: true, orgLevel: true },
          }).catch((e: any) => { console.error('[auto-fix] ORG employees error:', e.message); return []; });

          console.log('[auto-fix] ORG-ROLES: positions:', positions.length, 'employees:', employees.length);

          const pendingItems: any[] = [];
          const details: string[] = [];

          // Empleados sin cargo
          const empWithoutPosition = employees.filter((e: any) => !e.positionId);
          for (const emp of empWithoutPosition) {
            pendingItems.push({
              id: emp.id,
              name: `${emp.firstName} ${emp.lastName}`.trim(),
              type: 'no-position',
            });
          }
          if (empWithoutPosition.length > 0) {
            details.push(`${empWithoutPosition.length} empleado(s) sin cargo — asignar manualmente`);
          }

          // Empleados sin supervisor (solo si hay más de 1 empleado)
          // Excluir los que tienen orgLevel === 0 (marcado como nivel máximo / sin supervisor a propósito)
          if (employees.length > 1) {
            const empWithoutSupervisor = employees.filter((e: any) => !e.supervisorId && e.orgLevel !== 0);
            for (const emp of empWithoutSupervisor) {
              pendingItems.push({
                id: `${emp.id}__no-supervisor`,
                name: `${emp.firstName} ${emp.lastName}`.trim(),
                type: 'no-supervisor',
                employeeId: emp.id,
              });
            }
            if (empWithoutSupervisor.length > 0) {
              details.push(`${empWithoutSupervisor.length} empleado(s) sin supervisor — asignar manualmente`);
            }
          }

          // Cargos sin personal asignado (excluir los marcados como VACANT)
          for (const pos of positions) {
            if (pos.level === 'VACANT') continue;
            const hasEmployees = (pos.employees && pos.employees.length > 0) || (pos.additionalEmployees && pos.additionalEmployees.length > 0);
            if (!hasEmployees) {
              pendingItems.push({
                id: pos.id,
                name: pos.name,
                type: 'no-employees',
              });
            }
          }

          // Cargos sin responsabilidades (solo link, no se puede auto-fixear)
          for (const pos of positions) {
            const hasResp = pos.responsibilities && (Array.isArray(pos.responsibilities) ? pos.responsibilities.length > 0 : Object.keys(pos.responsibilities ?? {}).length > 0);
            if (!hasResp) {
              pendingItems.push({
                id: pos.id,
                name: pos.name,
                type: 'no-responsibilities',
              });
            }
          }

          console.log('[auto-fix] ORG-ROLES: pendingItems count:', pendingItems.length, 'types:', pendingItems.map(p => p.type));
          return { ownersAssigned: 0, indicatorsLinked: 0, documentsLinked: 0, risksLinked: 0, details: details.slice(0, 20), pendingItems };
        }

        // ── Auto-fix para riesgos, documentos, indicadores (solo asignar owner) ──
        if (body.moduleKey !== 'mapa-procesos') {
          const moduleConfig: Record<string, { model: string; ownerField: string; nameField: string; extraWhere?: any }> = {
            'riesgos':    { model: 'risk',      ownerField: 'ownerId', nameField: 'title', extraWhere: { status: { not: 'CLOSED' } } },
            'documentos': { model: 'document',  ownerField: 'ownerId', nameField: 'title', extraWhere: { status: { not: 'OBSOLETE' } } },
            'indicadores': { model: 'indicator', ownerField: 'ownerId', nameField: 'name', extraWhere: { isActive: true } },
          };
          const cfg = moduleConfig[body.moduleKey];
          if (!cfg) return { ownersAssigned: 0, details: ['Módulo no soportado'] };

          const items = await tx[cfg.model].findMany({
            where: { tenantId, deletedAt: null, ...cfg.extraWhere },
            select: { id: true, [cfg.nameField]: true, [cfg.ownerField]: true, ...(body.moduleKey === 'riesgos' ? { responsible: true } : {}), ...(body.moduleKey === 'indicadores' ? { status: true, lastMeasuredAt: true, code: true } : {}) },
          });

          // Owner más común del módulo
          const ownerCounts = new Map<string, number>();
          for (const item of items) {
            const oid = item[cfg.ownerField];
            if (oid && oid.trim() !== '') {
              ownerCounts.set(oid, (ownerCounts.get(oid) ?? 0) + 1);
            }
          }
          let mostCommonOwner: string | null = null;
          let maxCount = 0;
          for (const [oid, count] of ownerCounts) {
            if (count > maxCount) { maxCount = count; mostCommonOwner = oid; }
          }

          // Para riesgos, el campo libre "responsible" también cuenta como responsable asignado
          const hasOwner = (item: any) => {
            const oid = item[cfg.ownerField];
            if (oid && oid.trim() !== '') return true;
            if (body.moduleKey === 'riesgos' && item.responsible && String(item.responsible).trim() !== '') return true;
            return false;
          };

          const withoutOwner = items.filter((item: any) => !hasOwner(item));

          let ownersAssigned = 0;
          const details: string[] = [];

          for (const item of withoutOwner) {
            if (mostCommonOwner) {
              await tx[cfg.model].update({
                where: { id: item.id },
                data: { [cfg.ownerField]: mostCommonOwner },
              });
              ownersAssigned++;
              details.push(`${item[cfg.nameField]}: owner asignado (más común del módulo)`);
            } else {
              details.push(`${item[cfg.nameField]}: sin owner disponible para copiar`);
            }
          }

          // Items que aún no se pudieron resolver (no había ningún owner en el módulo)
          const pendingItems = withoutOwner.map((item: any) => ({
            id: item.id,
            name: item[cfg.nameField],
            type: 'no-owner' as const,
          }));

          // Para indicadores: también detectar los que no tienen mediciones
          if (body.moduleKey === 'indicadores') {
            const noMeasurements = items.filter((item: any) =>
              item.status === 'NO_DATA' || !item.lastMeasuredAt
            );
            for (const ind of noMeasurements) {
              if (!pendingItems.find((p: any) => p.id === ind.id)) {
                pendingItems.push({
                  id: ind.id,
                  name: `${ind.code} — ${ind.name}`,
                  type: 'no-measurement' as const,
                });
              }
            }
            if (noMeasurements.length > 0) {
              details.push(`${noMeasurements.length} indicador(es) sin mediciones — requieren carga manual`);
            }
          }

          return { ownersAssigned, indicatorsLinked: 0, documentsLinked: 0, risksLinked: 0, details: details.slice(0, 20), pendingItems };
        }

        // ── Auto-fix para mapa-procesos (lógica completa) ──
        const norm = (s: string) => s.trim().toLowerCase()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // sin acentos

        // 1. Obtener TODOS los procesos del tenant
        const processes = await tx.process.findMany({
          where: { tenantId, deletedAt: null },
          select: { id: true, name: true, owner: true, layer: true, processMapId: true },
        });
        if (processes.length === 0) return { ownersAssigned: 0, indicatorsLinked: 0, documentsLinked: 0, risksLinked: 0, details: ['No hay procesos'] };

        const allProcessIds = processes.map((p: any) => p.id);

        // 2. Agrupar procesos por nombre normalizado
        const processesByName = new Map<string, any[]>();
        for (const p of processes) {
          const key = norm(p.name);
          if (!processesByName.has(key)) processesByName.set(key, []);
          processesByName.get(key)!.push(p);
        }

        // 3. Construir mapas de "ejemplo": para cada nombre, el owner, indicadores y documentos
        //    de los procesos que sí los tienen
        const ownerByName = new Map<string, string>();        // name(normalized) -> owner
        const indicatorsByName = new Map<string, string[]>();  // name(normalized) -> [indicatorId...]
        const documentsByName = new Map<string, string[]>();   // name(normalized) -> [documentId...]
        const risksByName = new Map<string, string[]>();       // name(normalized) -> [riskId...]

        // Obtener todas las relaciones existentes
        const [allPI, allPD, allPR] = await Promise.all([
          tx.processIndicator.findMany({ where: { processId: { in: allProcessIds } }, select: { processId: true, indicatorId: true } }).catch(() => []),
          tx.processDocument.findMany({ where: { processId: { in: allProcessIds } }, select: { processId: true, documentId: true } }).catch(() => []),
          tx.processRisk.findMany({ where: { processId: { in: allProcessIds } }, select: { processId: true, riskId: true } }).catch(() => []),
        ]);

        // Mapear processId -> links
        const piByProcess = new Map<string, string[]>();
        for (const pi of allPI) {
          if (!piByProcess.has(pi.processId)) piByProcess.set(pi.processId, []);
          piByProcess.get(pi.processId)!.push(pi.indicatorId);
        }
        const pdByProcess = new Map<string, string[]>();
        for (const pd of allPD) {
          if (!pdByProcess.has(pd.processId)) pdByProcess.set(pd.processId, []);
          pdByProcess.get(pd.processId)!.push(pd.documentId);
        }
        const prByProcess = new Map<string, string[]>();
        for (const pr of allPR) {
          if (!prByProcess.has(pr.processId)) prByProcess.set(pr.processId, []);
          prByProcess.get(pr.processId)!.push(pr.riskId);
        }

        // Para cada grupo de procesos con el mismo nombre, tomar los que tienen datos como ejemplo
        for (const [key, group] of processesByName) {
          // Owner: tomar el primer proceso del grupo que tenga owner
          for (const p of group) {
            if (p.owner && p.owner.trim() !== '') {
              ownerByName.set(key, p.owner);
              break;
            }
          }
          // Indicadores: tomar todos los indicadores vinculados a cualquier proceso del grupo
          const indSet = new Set<string>();
          for (const p of group) {
            for (const indId of (piByProcess.get(p.id) ?? [])) indSet.add(indId);
          }
          if (indSet.size > 0) indicatorsByName.set(key, [...indSet]);

          // Documentos: igual
          const docSet = new Set<string>();
          for (const p of group) {
            for (const docId of (pdByProcess.get(p.id) ?? [])) docSet.add(docId);
          }
          if (docSet.size > 0) documentsByName.set(key, [...docSet]);

          // Riesgos: igual
          const riskSet = new Set<string>();
          for (const p of group) {
            for (const riskId of (prByProcess.get(p.id) ?? [])) riskSet.add(riskId);
          }
          if (riskSet.size > 0) risksByName.set(key, [...riskSet]);
        }

        // 4. También intentar sincronizar por campo `process` en Indicator/Document/Risk
        //    (coincidencia fuzzy sin acentos)
        const processByNormName = new Map<string, string[]>();
        for (const p of processes) {
          const key = norm(p.name);
          if (!processByNormName.has(key)) processByNormName.set(key, []);
          processByNormName.get(key)!.push(p.id);
        }

        async function syncByProcessField(entityModel: string, linkModel: string, entityIdField: string) {
          const items = await tx[entityModel].findMany({
            where: { tenantId, deletedAt: null, process: { not: null } },
            select: { id: true, process: true },
          }).catch(() => []);

          const existingLinks = await tx[linkModel].findMany({
            where: { processId: { in: allProcessIds } },
            select: { processId: true, [entityIdField]: true },
          }).catch(() => []);

          const alreadyLinked = new Set(existingLinks.map((l: any) => `${l.processId}::${l[entityIdField]}`));
          const toCreate: any[] = [];

          for (const item of items) {
            if (!item.process) continue;
            const pIds = processByNormName.get(norm(item.process));
            if (!pIds) continue;
            for (const pid of pIds) {
              if (alreadyLinked.has(`${pid}::${item.id}`)) continue;
              toCreate.push({ processId: pid, [entityIdField]: item.id });
              alreadyLinked.add(`${pid}::${item.id}`); // no duplicar en el mismo batch
            }
          }

          if (toCreate.length) await tx[linkModel].createMany({ data: toCreate, skipDuplicates: true }).catch(() => {});
          return toCreate.length;
        }

        const indicatorsSynced = await syncByProcessField('indicator', 'processIndicator', 'indicatorId');
        const documentsSynced = await syncByProcessField('document', 'processDocument', 'documentId');
        const risksSynced = await syncByProcessField('risk', 'processRisk', 'riskId');

        // 5. Replicar owner, indicadores y documentos de procesos ejemplo a los incompletos
        let ownersAssigned = 0;
        let indicatorsLinked = 0;
        let documentsLinked = 0;
        let risksLinked = 0;
        const details: string[] = [];

        // Reconstruir links existentes después de la sincronización
        const [allPI2, allPD2, allPR2] = await Promise.all([
          tx.processIndicator.findMany({ where: { processId: { in: allProcessIds } }, select: { processId: true, indicatorId: true } }).catch(() => []),
          tx.processDocument.findMany({ where: { processId: { in: allProcessIds } }, select: { processId: true, documentId: true } }).catch(() => []),
          tx.processRisk.findMany({ where: { processId: { in: allProcessIds } }, select: { processId: true, riskId: true } }).catch(() => []),
        ]);
        const linkedIndicators = new Set(allPI2.map((l: any) => `${l.processId}::${l.indicatorId}`));
        const linkedDocuments = new Set(allPD2.map((l: any) => `${l.processId}::${l.documentId}`));
        const linkedRisks = new Set(allPR2.map((l: any) => `${l.processId}::${l.riskId}`));

        for (const [key, group] of processesByName) {
          const exampleOwner = ownerByName.get(key);
          const exampleIndicators = indicatorsByName.get(key) ?? [];
          const exampleDocuments = documentsByName.get(key) ?? [];
          const exampleRisks = risksByName.get(key) ?? [];

          for (const p of group) {
            let changed = false;

            // Asignar owner
            if ((!p.owner || p.owner.trim() === '') && exampleOwner) {
              await tx.process.update({ where: { id: p.id }, data: { owner: exampleOwner } }).catch(() => {});
              ownersAssigned++;
              changed = true;
            }

            // Vincular indicadores
            const newIndicators = exampleIndicators.filter(id => !linkedIndicators.has(`${p.id}::${id}`));
            if (newIndicators.length > 0) {
              await tx.processIndicator.createMany({
                data: newIndicators.map(indicatorId => ({ processId: p.id, indicatorId })),
                skipDuplicates: true,
              }).catch(() => {});
              for (const id of newIndicators) linkedIndicators.add(`${p.id}::${id}`);
              indicatorsLinked += newIndicators.length;
              changed = true;
            }

            // Vincular documentos
            const newDocuments = exampleDocuments.filter(id => !linkedDocuments.has(`${p.id}::${id}`));
            if (newDocuments.length > 0) {
              await tx.processDocument.createMany({
                data: newDocuments.map(documentId => ({ processId: p.id, documentId })),
                skipDuplicates: true,
              }).catch(() => {});
              for (const id of newDocuments) linkedDocuments.add(`${p.id}::${id}`);
              documentsLinked += newDocuments.length;
              changed = true;
            }

            // Vincular riesgos
            const newRisks = exampleRisks.filter(id => !linkedRisks.has(`${p.id}::${id}`));
            if (newRisks.length > 0) {
              await tx.processRisk.createMany({
                data: newRisks.map(riskId => ({ processId: p.id, riskId })),
                skipDuplicates: true,
              }).catch(() => {});
              for (const id of newRisks) linkedRisks.add(`${p.id}::${id}`);
              risksLinked += newRisks.length;
              changed = true;
            }

            if (changed) {
              details.push(`${p.name}: owner${(!p.owner || p.owner.trim() === '') && exampleOwner ? ' ✓' : ''} +${newIndicators.length}ind +${newDocuments.length}doc +${newRisks.length}risk`);
            }
          }
        }

        // 6. Fallback: para los procesos que aún no tienen owner/indicadores/documentos,
        //    vincular todos los indicadores/documentos disponibles automáticamente,
        //    pero devolver los que no tienen owner para que el usuario elija.
        const macroProcesses = processes.filter((p: any) => !p.parentId);

        // Owner más común (para sugerir)
        const ownerCounts = new Map<string, number>();
        for (const p of macroProcesses) {
          if (p.owner && p.owner.trim() !== '') {
            ownerCounts.set(p.owner, (ownerCounts.get(p.owner) ?? 0) + 1);
          }
        }
        let mostCommonOwner: string | null = null;
        let maxCount = 0;
        for (const [owner, count] of ownerCounts) {
          if (count > maxCount) { maxCount = count; mostCommonOwner = owner; }
        }

        const stillNoOwner = macroProcesses.filter((p: any) => !p.owner || p.owner.trim() === '');
        const pendingItems = stillNoOwner.map((p: any) => ({
          id: p.id,
          name: p.name,
          suggestedOwner: mostCommonOwner,
        }));

        // Todos los indicadores disponibles
        const allIndicatorIds = await tx.indicator.findMany({ where: { tenantId, deletedAt: null }, select: { id: true } }).catch(() => []);
        if (allIndicatorIds.length > 0) {
          for (const p of macroProcesses) {
            const has = new Set(allPI2.filter((l: any) => l.processId === p.id).map((l: any) => l.indicatorId));
            const toAdd = allIndicatorIds.filter((i: any) => !has.has(i.id)).map((i: any) => i.id);
            if (toAdd.length > 0) {
              await tx.processIndicator.createMany({
                data: toAdd.map((indicatorId: string) => ({ processId: p.id, indicatorId })),
                skipDuplicates: true,
              }).catch(() => {});
              indicatorsLinked += toAdd.length;
            }
          }
        }

        // Todos los documentos disponibles
        const allDocumentIds = await tx.document.findMany({ where: { tenantId, deletedAt: null }, select: { id: true } }).catch(() => []);
        if (allDocumentIds.length > 0) {
          for (const p of macroProcesses) {
            const has = new Set(allPD2.filter((l: any) => l.processId === p.id).map((l: any) => l.documentId));
            const toAdd = allDocumentIds.filter((d: any) => !has.has(d.id)).map((d: any) => d.id);
            if (toAdd.length > 0) {
              await tx.processDocument.createMany({
                data: toAdd.map((documentId: string) => ({ processId: p.id, documentId })),
                skipDuplicates: true,
              }).catch(() => {});
              documentsLinked += toAdd.length;
            }
          }
        }

        return { ownersAssigned, indicatorsLinked: indicatorsLinked + indicatorsSynced, documentsLinked: documentsLinked + documentsSynced, risksLinked: risksLinked + risksSynced, details: details.slice(0, 20), pendingItems };
      });

      return reply.send({ success: true, ...result });
    } catch (err: any) {
      console.error('Error en audit-readiness/auto-fix:', err.message);
      return reply.code(500).send({ error: 'Error en auto-fix', details: err.message });
    }
  });

  // ── Asignar responsable individual (después de auto-fix) ────────────
  app.post('/auto-fix/assign', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    const body = req.body as { moduleKey: string; itemId: string; ownerId: string; assignType?: string };
    if (!body.moduleKey || !body.itemId || !body.ownerId) {
      return reply.code(400).send({ error: 'Falta moduleKey, itemId u ownerId' });
    }

    // ── Organigrama-roles: asignar cargo o supervisor ──
    if (body.moduleKey === 'organigrama-roles') {
      console.log('[auto-fix/assign] ORG-ROLES DEBUG:', { moduleKey: body.moduleKey, itemId: body.itemId, ownerId: body.ownerId, assignType: body.assignType });
      try {
        if (body.assignType === 'no-position') {
          // ownerId es un positionId
          console.log('[auto-fix/assign] ORG no-position: updating employee', body.itemId, 'with positionId', body.ownerId);
          await app.prisma.employee.update({
            where: { id: body.itemId },
            data: { positionId: body.ownerId },
          });
          console.log('[auto-fix/assign] ORG no-position: OK');
          return reply.send({ success: true, message: 'Cargo asignado' });
        } else if (body.assignType === 'no-employees') {
          // itemId es positionId, ownerId es employeeId o "none" para marcar vacante
          if (body.ownerId === 'none') {
            console.log('[auto-fix/assign] ORG no-employees VACANT: updating position', body.itemId);
            await app.prisma.position.update({
              where: { id: body.itemId },
              data: { level: 'VACANT' },
            });
            console.log('[auto-fix/assign] ORG no-employees VACANT: OK');
            return reply.send({ success: true, message: 'Cargo marcado como vacante' });
          }
          console.log('[auto-fix/assign] ORG no-employees: creating EmployeePosition for employee', body.ownerId, 'position', body.itemId);
          await app.prisma.employeePosition.upsert({
            where: { employeeId_positionId: { employeeId: body.ownerId, positionId: body.itemId } },
            create: { employeeId: body.ownerId, positionId: body.itemId },
            update: {},
          });
          console.log('[auto-fix/assign] ORG no-employees: OK, EmployeePosition created');
          return reply.send({ success: true, message: 'Personal asignado al cargo' });
        } else if (body.assignType === 'no-supervisor') {
          // itemId puede tener sufijo __no-supervisor o ser un employeeId directo
          const employeeId = body.itemId.includes('__no-supervisor') ? body.itemId.split('__no-supervisor')[0] : body.itemId;
          // ownerId es un employeeId (supervisor) o "none" para marcar sin supervisor
          if (body.ownerId === 'none') {
            console.log('[auto-fix/assign] ORG no-supervisor NONE: updating employee', employeeId);
            await app.prisma.employee.update({
              where: { id: employeeId },
              data: { supervisorId: null, orgLevel: 0 },
            });
            console.log('[auto-fix/assign] ORG no-supervisor NONE: OK');
            return reply.send({ success: true, message: 'Marcado sin supervisor' });
          }
          if (body.ownerId === employeeId) {
            return reply.code(400).send({ error: 'No puede ser su propio supervisor' });
          }
          console.log('[auto-fix/assign] ORG no-supervisor: updating employee', employeeId, 'with supervisorId', body.ownerId);
          await app.prisma.employee.update({
            where: { id: employeeId },
            data: { supervisorId: body.ownerId },
          });
          console.log('[auto-fix/assign] ORG no-supervisor: OK');
          return reply.send({ success: true, message: 'Supervisor asignado' });
        }
        console.log('[auto-fix/assign] ORG: unsupported assignType', body.assignType);
        return reply.code(400).send({ error: 'Tipo de asignación no soportado para organigrama-roles' });
      } catch (err: any) {
        console.error('[auto-fix/assign] ORG ERROR:', err.message, err.stack);
        return reply.code(500).send({ error: 'Error al asignar', details: err.message });
      }
    }

    const moduleConfig: Record<string, { model: string; ownerField: string; isText: boolean }> = {
      'mapa-procesos': { model: 'process',   ownerField: 'owner',   isText: true  },
      'riesgos':      { model: 'risk',       ownerField: 'ownerId', isText: false },
      'documentos':   { model: 'document',   ownerField: 'ownerId', isText: false },
      'indicadores':  { model: 'indicator',  ownerField: 'ownerId', isText: false },
    };
    const cfg = moduleConfig[body.moduleKey];
    if (!cfg) return reply.code(400).send({ error: 'Módulo no soportado' });

    try {
      let ownerValue = body.ownerId;

      console.log('[auto-fix/assign] DEBUG:', { moduleKey: body.moduleKey, itemId: body.itemId, ownerId: body.ownerId, cfg: { model: cfg.model, ownerField: cfg.ownerField, isText: cfg.isText } });

      if (cfg.isText) {
        // Process.owner es texto libre: guardar el nombre del empleado
        const emp = await app.prisma.employee.findUnique({
          where: { id: body.ownerId },
          select: { firstName: true, lastName: true },
        });
        console.log('[auto-fix/assign] employee found (text):', emp);
        if (emp) {
          ownerValue = `${emp.firstName} ${emp.lastName}`.trim();
        }
      } else {
        // ownerId es FK a PlatformUser: buscar por email del Employee
        const emp = await app.prisma.employee.findUnique({
          where: { id: body.ownerId },
          select: { email: true, firstName: true, lastName: true },
        });
        console.log('[auto-fix/assign] employee found:', emp ? { email: emp.email, name: `${emp.firstName} ${emp.lastName}` } : null);
        if (emp?.email) {
          const platformUser = await app.prisma.platformUser.findUnique({
            where: { email: emp.email },
            select: { id: true },
          });
          console.log('[auto-fix/assign] platformUser found:', platformUser);
          if (platformUser) {
            ownerValue = platformUser.id;
          } else {
            // Auto-crear PlatformUser para que la FK se cumpla
            const newUser = await app.prisma.platformUser.create({
              data: {
                email: emp.email,
                passwordHash: '!',
                firstName: emp.firstName,
                lastName: emp.lastName,
                isActive: false,
              },
            });
            console.log('[auto-fix/assign] platformUser created:', { id: newUser.id, email: newUser.email });
            ownerValue = newUser.id;
          }
        } else {
          return reply.code(400).send({ error: 'Empleado no encontrado o sin email' });
        }
      }

      console.log('[auto-fix/assign] updating:', { model: cfg.model, itemId: body.itemId, ownerField: cfg.ownerField, ownerValue });
      const updateResult = await (app.prisma as any)[cfg.model].update({
        where: { id: body.itemId },
        data: { [cfg.ownerField]: ownerValue },
      });
      console.log('[auto-fix/assign] update result:', { id: updateResult?.id, ownerId: updateResult?.ownerId, owner: updateResult?.owner });
      return reply.send({ success: true, message: 'Responsable asignado' });
    } catch (err: any) {
      console.error('Error en auto-fix/assign:', body.moduleKey, body.itemId, err.message);
      return reply.code(500).send({ error: 'Error al asignar', details: err.message });
    }
  });
};
