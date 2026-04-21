import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { createLLMProvider } from '../services/llm/factory.js';

// Section templates for each standard — aligned to ISO clause 9.3
const SECTION_TEMPLATES: Record<string, Array<{ key: string; title: string }>> = {
  // ISO 9001:2015 — Cláusula 9.3.2 (Entradas) y 9.3.3 (Salidas)
  ISO_9001: [
    { key: 'context_changes',          title: 'Cambios en el Contexto y el SGC (9.3.2.a)' },
    { key: 'objectives_performance',   title: 'Desempeño de Objetivos de Calidad (9.3.2.b)' },
    { key: 'process_performance',      title: 'Desempeño de Procesos e Indicadores KPI (9.3.2.b)' },
    { key: 'customer_feedback',        title: 'Satisfacción del Cliente y Retroalimentación (9.3.2.c)' },
    { key: 'nonconformities',          title: 'No Conformidades y Acciones Correctivas (9.3.2.d)' },
    { key: 'audit_results',            title: 'Resultados de Auditorías Internas y Externas (9.3.2.e)' },
    { key: 'supplier_performance',     title: 'Desempeño de Proveedores Externos (9.3.2.f)' },
    { key: 'risk_management',          title: 'Gestión de Riesgos y Oportunidades (9.3.2.g)' },
    { key: 'actions_capa',             title: 'Estado de Acciones CAPA (9.3.2.h)' },
    { key: 'improvement_opportunities',title: 'Oportunidades de Mejora (9.3.3)' },
    { key: 'resources_adequacy',       title: 'Adecuación de Recursos (9.3.3)' },
  ],
  // ISO 14001:2015 — Cláusula 9.3
  ISO_14001: [
    { key: 'context_changes',          title: 'Cambios en el Contexto y el SGA (9.3.a)' },
    { key: 'environmental_objectives', title: 'Logro de Objetivos Ambientales (9.3.b)' },
    { key: 'environmental_aspects',    title: 'Aspectos Ambientales Significativos (9.3.c)' },
    { key: 'legal_compliance',         title: 'Cumplimiento de Obligaciones Legales (9.3.d)' },
    { key: 'audit_results',            title: 'Resultados de Auditorías Ambientales (9.3.e)' },
    { key: 'nonconformities',          title: 'No Conformidades y Acciones Correctivas (9.3.f)' },
    { key: 'emergency_preparedness',   title: 'Preparación y Respuesta ante Emergencias (9.3.g)' },
    { key: 'improvement_opportunities',title: 'Oportunidades de Mejora Continua (9.3.h)' },
  ],
  // ISO 45001:2018 — Cláusula 9.3
  ISO_45001: [
    { key: 'context_changes',          title: 'Cambios en el Contexto y el SGSST (9.3.a)' },
    { key: 'ohs_objectives',           title: 'Logro de Objetivos de SST (9.3.b)' },
    { key: 'incident_investigation',   title: 'Incidentes, No Conformidades y Acciones Correctivas (9.3.c)' },
    { key: 'ohs_audit_results',        title: 'Resultados de Auditorías SST (9.3.d)' },
    { key: 'risk_assessment',          title: 'Evaluación de Peligros y Riesgos SST (9.3.e)' },
    { key: 'worker_participation',     title: 'Participación y Consulta de los Trabajadores (9.3.f)' },
    { key: 'legal_compliance',         title: 'Cumplimiento de Requisitos Legales SST (9.3.g)' },
    { key: 'resources_adequacy',       title: 'Adecuación de Recursos y Competencias (9.3.h)' },
    { key: 'improvement_opportunities',title: 'Oportunidades de Mejora Continua SST (9.3.i)' },
  ],
  // ISO 27001:2022 — Cláusula 9.3
  ISO_27001: [
    { key: 'context_changes',          title: 'Cambios en el Contexto y el SGSI (9.3.a)' },
    { key: 'security_incidents',       title: 'Incidentes de Seguridad de la Información (9.3.b)' },
    { key: 'risk_treatment',           title: 'Tratamiento de Riesgos de Seguridad (9.3.c)' },
    { key: 'control_effectiveness',    title: 'Efectividad de los Controles Implementados (9.3.d)' },
    { key: 'audit_results',            title: 'Resultados de Auditorías del SGSI (9.3.e)' },
    { key: 'compliance_evaluation',    title: 'Evaluación de Cumplimiento Normativo (9.3.f)' },
    { key: 'business_continuity',      title: 'Continuidad del Negocio y Disponibilidad (9.3.g)' },
    { key: 'improvement_opportunities',title: 'Oportunidades de Mejora (9.3.h)' },
  ],
  // IATF 16949:2016 — Cláusula 9.3 (extiende ISO 9001)
  IATF_16949: [
    { key: 'context_changes',          title: 'Cambios en el Contexto y el SGCA (9.3.2.a)' },
    { key: 'customer_feedback',        title: 'Satisfacción del Cliente y Desempeño de Entrega (9.3.2.b)' },
    { key: 'process_performance',      title: 'Desempeño de Procesos y KPIs (9.3.2.c)' },
    { key: 'nonconformities',          title: 'No Conformidades Internas y de Campo (9.3.2.d)' },
    { key: 'audit_results',            title: 'Resultados de Auditorías (internas, de 2da y 3ra parte) (9.3.2.e)' },
    { key: 'supplier_performance',     title: 'Desempeño de Proveedores y Cadena de Suministro (9.3.2.f)' },
    { key: 'risk_management',          title: 'Riesgos y Oportunidades del Negocio (9.3.2.g)' },
    { key: 'actions_capa',             title: 'Estado de Acciones CAPA Abiertas (9.3.2.h)' },
    { key: 'improvement_opportunities',title: 'Oportunidades de Mejora y Lecciones Aprendidas (9.3.3)' },
  ],
};

async function buildSectionSystemData(params: {
  tenantId: string;
  periodStart: Date;
  periodEnd: Date;
  standards: string[];
  tx: any;
}) {
  const { tenantId, periodStart, periodEnd, standards, tx } = params;
  const data: Record<string, any> = {};
  const tf = { tenantId };
  const tfPeriod = { tenantId, createdAt: { gte: periodStart, lte: periodEnd } };

  // ── SECCIÓN COMÚN A TODAS LAS NORMAS: Cambios en el contexto ──────────────
  try {
    const context = await tx.organizationContext.findFirst({
      where: { tenantId, year: periodEnd.getFullYear() },
    }).catch(() => null);
    const stakeholders = await tx.stakeholder.findMany({
      where: { tenantId, deletedAt: null },
      select: { name: true, type: true, category: true, needs: true, expectations: true },
    }).catch(() => []);
    data.context_changes = {
      hasFodaAnalysis: !!context,
      year: periodEnd.getFullYear(),
      strengths: context?.strengths ?? null,
      weaknesses: context?.weaknesses ?? null,
      opportunities: context?.opportunities ?? null,
      threats: context?.threats ?? null,
      totalStakeholders: stakeholders.length,
      internalStakeholders: stakeholders.filter((s: any) => s.type === 'INTERNAL').length,
      externalStakeholders: stakeholders.filter((s: any) => s.type === 'EXTERNAL').length,
      nota: 'Completar manualmente: cambios en factores externos e internos, cambios normativos, cambios en partes interesadas',
    };
  } catch { data.context_changes = { nota: 'Sin datos de contexto registrados. Completar manualmente.' }; }

  // ── AUDITORÍAS (todas las normas) ───────────────────────────────────────────
  try {
    const audits = await tx.audit.findMany({
      where: { tenantId, deletedAt: null,
        OR: [
          { actualStartDate: { gte: periodStart, lte: periodEnd } },
          { plannedStartDate: { gte: periodStart, lte: periodEnd } },
        ],
      },
      select: { id: true, code: true, title: true, type: true, status: true, area: true, actualStartDate: true, actualEndDate: true },
    });
    const allFindings = await tx.auditFinding.findMany({
      where: { tenantId, deletedAt: null, createdAt: { gte: periodStart, lte: periodEnd } },
      select: { id: true, code: true, type: true, severity: true, status: true, area: true, description: true, createdAt: true },
    });
    const checklists = await tx.auditChecklistItem.findMany({
      where: { auditId: { in: audits.map((a: any) => a.id) } },
      select: { auditId: true, response: true },
    });
    const complianceByAudit = audits.map((a: any) => {
      const items = checklists.filter((c: any) => c.auditId === a.id && c.response && c.response !== 'NOT_APPLICABLE');
      const compliant = items.filter((c: any) => c.response === 'COMPLIES').length;
      return { ...a, compliancePercentage: items.length > 0 ? Math.round((compliant / items.length) * 100) : null };
    });
    data.audit_results = {
      totalAudits: audits.length,
      completedAudits: audits.filter((a: any) => a.status === 'COMPLETED').length,
      totalFindings: allFindings.length,
      openFindings: allFindings.filter((f: any) => f.status !== 'CLOSED').length,
      bySeverity: {
        CRITICAL: allFindings.filter((f: any) => f.severity === 'CRITICAL').length,
        MAJOR: allFindings.filter((f: any) => f.severity === 'MAJOR').length,
        MINOR: allFindings.filter((f: any) => f.severity === 'MINOR').length,
      },
      audits: complianceByAudit.map((a: any) => ({
        code: a.code, title: a.title, type: a.type, status: a.status,
        area: a.area, compliancePercentage: a.compliancePercentage,
      })),
    };
    data.ohs_audit_results = data.audit_results;
  } catch { data.audit_results = { totalAudits: 0, completedAudits: 0, totalFindings: 0, openFindings: 0, audits: [] }; }

  // ── NO CONFORMIDADES ────────────────────────────────────────────────────────
  try {
    const ncrs = await tx.nonConformity.findMany({
      where: { tenantId, createdAt: { gte: periodStart, lte: periodEnd } },
      select: { id: true, code: true, title: true, severity: true, status: true, source: true, createdAt: true, closedAt: true },
    });
    const findingNcrs = await tx.auditFinding.findMany({
      where: { tenantId, type: 'NON_CONFORMITY', deletedAt: null, createdAt: { gte: periodStart, lte: periodEnd } },
      select: { id: true, code: true, severity: true, status: true, area: true, description: true },
    });
    data.nonconformities = {
      totalNcrs: ncrs.length,
      openNcrs: ncrs.filter((n: any) => n.status === 'OPEN').length,
      closedNcrs: ncrs.filter((n: any) => n.status === 'CLOSED').length,
      bySeverity: {
        CRITICAL: ncrs.filter((n: any) => n.severity === 'CRITICAL').length,
        MAJOR: ncrs.filter((n: any) => n.severity === 'MAJOR').length,
        MINOR: ncrs.filter((n: any) => n.severity === 'MINOR').length,
      },
      auditFindings: findingNcrs.length,
      openAuditFindings: findingNcrs.filter((f: any) => f.status !== 'CLOSED').length,
      items: ncrs.slice(0, 10).map((n: any) => ({ code: n.code, title: n.title, severity: n.severity, status: n.status, source: n.source })),
    };
    data.incident_investigation = data.nonconformities;
  } catch { data.nonconformities = { totalNcrs: 0, openNcrs: 0, closedNcrs: 0, items: [] }; }

  // ── ACCIONES CAPA ───────────────────────────────────────────────────────────
  try {
    const now = new Date();
    const actions = await tx.actionItem.findMany({
      where: { tenantId, deletedAt: null, createdAt: { gte: periodStart, lte: periodEnd } },
      select: { id: true, code: true, title: true, type: true, status: true, priority: true, dueDate: true, completedAt: true },
    });
    data.actions_capa = {
      total: actions.length,
      open: actions.filter((a: any) => ['OPEN','IN_PROGRESS'].includes(a.status)).length,
      closed: actions.filter((a: any) => a.status === 'CLOSED').length,
      overdue: actions.filter((a: any) => ['OPEN','IN_PROGRESS'].includes(a.status) && a.dueDate && new Date(a.dueDate) < now).length,
      byType: {
        CORRECTIVE: actions.filter((a: any) => a.type === 'CORRECTIVE').length,
        PREVENTIVE: actions.filter((a: any) => a.type === 'PREVENTIVE').length,
        IMPROVEMENT: actions.filter((a: any) => a.type === 'IMPROVEMENT').length,
      },
      items: actions.slice(0, 10).map((a: any) => ({ code: a.code, title: a.title, type: a.type, status: a.status, priority: a.priority, dueDate: a.dueDate })),
    };
  } catch { data.actions_capa = { total: 0, open: 0, closed: 0, overdue: 0, byType: {} }; }

  // ── OBJETIVOS SGI ───────────────────────────────────────────────────────────
  try {
    const objectives = await tx.sgiObjective.findMany({
      where: { tenantId, deletedAt: null, year: periodEnd.getFullYear() },
      select: { id: true, code: true, title: true, standard: true, status: true, progress: true, target: true, targetValue: true, unit: true },
    });
    data.objectives_performance = {
      total: objectives.length,
      achieved: objectives.filter((o: any) => o.status === 'ACHIEVED').length,
      inProgress: objectives.filter((o: any) => o.status === 'IN_PROGRESS').length,
      notAchieved: objectives.filter((o: any) => o.status === 'NOT_ACHIEVED').length,
      averageProgress: objectives.length > 0 ? Math.round(objectives.reduce((s: number, o: any) => s + (o.progress || 0), 0) / objectives.length) : 0,
      items: objectives.map((o: any) => ({ code: o.code, title: o.title, standard: o.standard, status: o.status, progress: o.progress, target: o.target })),
    };
    data.environmental_objectives = data.objectives_performance;
    data.ohs_objectives = data.objectives_performance;
  } catch { data.objectives_performance = { total: 0, achieved: 0, inProgress: 0, notAchieved: 0, items: [] }; }

  // ── INDICADORES / KPIs ──────────────────────────────────────────────────────
  try {
    const measurements = await tx.indicatorMeasurement.findMany({
      where: { measuredAt: { gte: periodStart, lte: periodEnd } },
      include: { indicator: { where: { tenantId } } },
    });
    const validMeasurements = measurements.filter((m: any) => m.indicator);
    const grouped = validMeasurements.reduce((acc: any, m: any) => {
      const k = m.indicator.id;
      if (!acc[k]) acc[k] = { name: m.indicator.name, code: m.indicator.code, unit: m.indicator.unit, target: m.indicator.targetValue, values: [] };
      acc[k].values.push(m.value);
      return acc;
    }, {} as any);
    const kpis = Object.values(grouped).map((k: any) => {
      const avg = k.values.reduce((s: number, v: number) => s + v, 0) / k.values.length;
      return { name: k.name, code: k.code, unit: k.unit, average: +avg.toFixed(2), target: k.target, onTarget: k.target ? avg >= k.target : null, measurements: k.values.length };
    });
    data.process_performance = {
      kpis,
      totalIndicators: kpis.length,
      onTarget: kpis.filter((k: any) => k.onTarget === true).length,
      offTarget: kpis.filter((k: any) => k.onTarget === false).length,
      overallScore: kpis.length > 0 ? Math.round((kpis.filter((k: any) => k.onTarget).length / kpis.length) * 100) : 0,
    };
  } catch { data.process_performance = { kpis: [], totalIndicators: 0, onTarget: 0, offTarget: 0 }; }

  // ── RIESGOS ─────────────────────────────────────────────────────────────────
  try {
    const risks = await tx.risk.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true, code: true, title: true, category: true, riskLevel: true, status: true, aspectType: true, strategy: true },
    });
    data.risk_management = {
      total: risks.length,
      high: risks.filter((r: any) => r.riskLevel >= 15).length,
      medium: risks.filter((r: any) => r.riskLevel >= 6 && r.riskLevel < 15).length,
      low: risks.filter((r: any) => r.riskLevel < 6).length,
      open: risks.filter((r: any) => r.status === 'IDENTIFIED' || r.status === 'IN_TREATMENT').length,
      byCategory: risks.reduce((acc: any, r: any) => { acc[r.category] = (acc[r.category] || 0) + 1; return acc; }, {}),
    };
    data.risk_assessment = data.risk_management;
    data.risk_treatment = data.risk_management;
  } catch { data.risk_management = { total: 0, high: 0, medium: 0, low: 0 }; }

  // ── ASPECTOS AMBIENTALES ────────────────────────────────────────────────────
  try {
    const aspects = await tx.environmentalAspect.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true, aspect: true, impact: true, isSignificant: true, currentControls: true },
    }).catch(() => []);
    data.environmental_aspects = {
      total: aspects.length,
      significant: aspects.filter((a: any) => a.isSignificant).length,
      withControls: aspects.filter((a: any) => a.currentControls).length,
      items: aspects.slice(0, 10).map((a: any) => ({ aspect: a.aspect, impact: a.impact, isSignificant: a.isSignificant })),
    };
  } catch { data.environmental_aspects = { total: 0, significant: 0, withControls: 0, items: [] }; }

  // ── INCIDENTES (ISO 45001) ───────────────────────────────────────────────────
  try {
    const incidents = await tx.incident.findMany({
      where: { tenantId, deletedAt: null, date: { gte: periodStart, lte: periodEnd } },
      select: { id: true, code: true, type: true, severity: true, investigationStatus: true, date: true, daysLost: true },
    }).catch(() => []);
    data.incident_investigation = {
      ...data.incident_investigation,
      totalIncidents: incidents.length,
      byType: incidents.reduce((acc: any, i: any) => { acc[i.type] = (acc[i.type] || 0) + 1; return acc; }, {}),
      bySeverity: {
        FATALITY: incidents.filter((i: any) => i.severity === 'FATALITY').length,
        LOST_TIME: incidents.filter((i: any) => i.severity === 'LOST_TIME').length,
        MEDICAL: incidents.filter((i: any) => i.severity === 'MEDICAL_TREATMENT').length,
        NEAR_MISS: incidents.filter((i: any) => i.type === 'NEAR_MISS').length,
      },
      totalDaysLost: incidents.reduce((s: number, i: any) => s + (i.daysLost || 0), 0),
      open: incidents.filter((i: any) => i.investigationStatus !== 'COMPLETED').length,
    };
  } catch { /* mantiene valor anterior */ }

  // ── PROVEEDORES ─────────────────────────────────────────────────────────────
  try {
    const suppliers = await tx.supplier.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true, name: true, category: true, status: true, isCritical: true },
    }).catch(() => []);
    const evals = await tx.supplierEvaluation.findMany({
      where: { tenantId, createdAt: { gte: periodStart, lte: periodEnd } },
      select: { supplierId: true, overallScore: true, result: true },
    }).catch(() => []);
    data.supplier_performance = {
      total: suppliers.length,
      approved: suppliers.filter((s: any) => s.status === 'APPROVED').length,
      pending: suppliers.filter((s: any) => s.status === 'PENDING').length,
      suspended: suppliers.filter((s: any) => s.status === 'SUSPENDED').length,
      critical: suppliers.filter((s: any) => s.isCritical).length,
      evaluationsInPeriod: evals.length,
      approvedEvals: evals.filter((e: any) => e.result === 'APPROVED').length,
      avgScore: evals.length > 0 ? +(evals.reduce((s: number, e: any) => s + (e.overallScore || 0), 0) / evals.length).toFixed(1) : null,
    };
    data.customer_feedback = {
      nota: 'Registrar manualmente: quejas de clientes, índice de satisfacción, reclamos recibidos y resueltos en el período.',
      suppliersApproved: data.supplier_performance.approved,
      suppliersPending: data.supplier_performance.pending,
    };
  } catch { data.supplier_performance = { total: 0, approved: 0, pending: 0 }; }

  // ── CALIBRACIONES / RECURSOS ─────────────────────────────────────────────────
  try {
    const now2 = new Date();
    const in60 = new Date(Date.now() + 60 * 24 * 3600 * 1000);
    const equips = await tx.measuringEquipment.findMany({
      where: { tenantId, deletedAt: null, status: 'ACTIVE' },
      select: { id: true, name: true, nextCalibrationDate: true, status: true },
    }).catch(() => []);
    const trainings = await tx.sgiTraining.findMany({
      where: { tenantId, deletedAt: null, scheduledDate: { gte: periodStart, lte: periodEnd } },
      select: { id: true, title: true, status: true, durationHours: true },
    }).catch(() => []);
    data.resources_adequacy = {
      totalEquipment: equips.length,
      calibrationsDueSoon: equips.filter((e: any) => e.nextCalibrationDate && new Date(e.nextCalibrationDate) <= in60).length,
      calibrationsOverdue: equips.filter((e: any) => e.nextCalibrationDate && new Date(e.nextCalibrationDate) < now2).length,
      totalTrainings: trainings.length,
      completedTrainings: trainings.filter((t: any) => t.status === 'COMPLETED').length,
      totalTrainingHours: trainings.reduce((s: number, t: any) => s + (t.durationHours || 0), 0),
      nota: 'Completar manualmente: evaluación de adecuación de infraestructura y ambiente de trabajo.',
    };
  } catch { data.resources_adequacy = { totalEquipment: 0, calibrationsDueSoon: 0, nota: 'Sin datos' }; }

  // ── CUMPLIMIENTO LEGAL ───────────────────────────────────────────────────────
  try {
    const legalRisks = await tx.risk.findMany({
      where: { tenantId, deletedAt: null, legalRequirement: true },
      select: { id: true, title: true, status: true, legalReference: true, riskLevel: true },
    }).catch(() => []);
    data.legal_compliance = {
      totalLegalRequirements: legalRisks.length,
      compliant: legalRisks.filter((r: any) => r.status === 'CLOSED' || r.status === 'ACCEPTED').length,
      nonCompliant: legalRisks.filter((r: any) => r.status === 'IDENTIFIED' || r.status === 'IN_TREATMENT').length,
      items: legalRisks.slice(0, 10).map((r: any) => ({ title: r.title, status: r.status, legalReference: r.legalReference, riskLevel: r.riskLevel })),
      nota: 'Completar manualmente con evaluación de la matriz legal del período.',
    };
  } catch { data.legal_compliance = { totalLegalRequirements: 0, nota: 'Completar manualmente.' }; }

  // ── OPORTUNIDADES DE MEJORA ─────────────────────────────────────────────────
  try {
    const improvements = await tx.actionItem.findMany({
      where: { tenantId, deletedAt: null, type: 'IMPROVEMENT', createdAt: { gte: periodStart, lte: periodEnd } },
      select: { code: true, title: true, status: true, priority: true },
    }).catch(() => []);
    data.improvement_opportunities = {
      total: improvements.length,
      open: improvements.filter((i: any) => i.status !== 'CLOSED').length,
      closed: improvements.filter((i: any) => i.status === 'CLOSED').length,
      items: improvements.slice(0, 10),
      nota: 'Completar manualmente con análisis de tendencias, benchmarking y propuestas del equipo.',
    };
  } catch { data.improvement_opportunities = { total: 0, nota: 'Completar manualmente.' }; }

  // ── SEGURIDAD (ISO 27001) ────────────────────────────────────────────────────
  data.security_incidents = {
    nota: 'Registrar manualmente: incidentes de seguridad de la información detectados en el período, clasificación y tiempo de respuesta.',
    ...((data.incident_investigation?.totalIncidents !== undefined) ? { incidentsRegistered: data.incident_investigation.totalIncidents } : {}),
  };
  data.control_effectiveness = {
    nota: 'Evaluar manualmente la efectividad de los controles del Anexo A implementados. Incluir resultado de pruebas de controles.',
    risksInTreatment: data.risk_management?.open ?? 0,
  };
  data.business_continuity = {
    nota: 'Completar manualmente: estado de planes de continuidad, pruebas realizadas, incidentes que activaron el plan.',
  };
  data.emergency_preparedness = {
    nota: 'Completar manualmente: simulacros realizados, incidentes ambientales o de SST activados, lecciones aprendidas.',
    incidents: data.incident_investigation?.totalIncidents ?? 0,
  };
  data.worker_participation = {
    nota: 'Completar manualmente: instancias de participación realizadas, consultas respondidas, temas planteados por los trabajadores.',
    trainings: data.resources_adequacy?.completedTrainings ?? 0,
  };

  return data;
}


export async function registerManagementReviewRoutes(app: FastifyInstance) {
  // GET /management-reviews - List management reviews
  app.get(
    '/management-reviews',
    async (req: FastifyRequest, reply: FastifyReply) => {
      const tenantId = req.db?.tenantId ?? req.auth?.tenantId;
      if (!tenantId) return reply.code(400).send({ error: 'Tenant context required' });

      const reviews = await app.runWithDbContext(req, async (tx) => {
        return tx.managementReview.findMany({
          where: { tenantId, deletedAt: null },
          orderBy: { createdAt: 'desc' },
          include: {
            sections: {
              select: { key: true, title: true },
            },
          },
        });
      });

      return reply.send({ reviews });
    },
  );

  // POST /management-reviews - Create new management review
  app.post(
    '/management-reviews',
    async (req: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
      const tenantId = req.db?.tenantId ?? req.auth?.tenantId;
      if (!tenantId) return reply.code(400).send({ error: 'Tenant context required' });

      const body = req.body as any;
      const { title, summary, periodStart, periodEnd, standards } = body;

      if (!title || !periodStart || !periodEnd || !standards || !Array.isArray(standards)) {
        return reply.code(400).send({ error: 'Missing required fields: title, periodStart, periodEnd, standards' });
      }

      const startDate = new Date(periodStart);
      const endDate = new Date(periodEnd);
      if (startDate >= endDate) {
        return reply.code(400).send({ error: 'periodStart must be before periodEnd' });
      }

      const baseTitle = title.trim();

      // Check for active (non-deleted) duplicate first
      const activeConflict = await app.runWithDbContext(req, async (tx) => {
        return tx.managementReview.findFirst({
          where: { tenantId, title: baseTitle, deletedAt: null },
          select: { id: true },
        });
      });
      app.log.info({ tenantId, baseTitle, activeConflict }, '[MR-CREATE] duplicate check');
      if (activeConflict) {
        return reply.code(409).send({ error: `Ya existe un informe activo con el título "${baseTitle}". Por favor usá un título diferente.` });
      }

      // Always append a unique suffix to avoid P2002 from soft-deleted records
      // The suffix is invisible if no conflict exists (we'll strip it on display if needed)
      const uniqueSuffix = Date.now().toString().slice(-8);
      const finalTitle = `${baseTitle}__${uniqueSuffix}`;

      const review = await app.runWithDbContext(req, async (tx) => {
        // Create the review with guaranteed unique title internally
        const newReview = await tx.managementReview.create({
          data: {
            tenantId,
            title: finalTitle,
            summary: summary?.trim() || null,
            periodStart: startDate,
            periodEnd: endDate,
            standards,
            status: 'DRAFT',
            generatedById: req.auth!.userId,
          },
        });

        // Generate sections based on standards
        const sections = [];
        for (const standard of standards) {
          const templates = SECTION_TEMPLATES[standard] || [];
          for (const template of templates) {
            const section = await tx.managementReviewSection.create({
              data: {
                reportId: newReview.id,
                key: template.key,
                title: template.title,
                systemData: undefined, // Will be populated when generating draft
                freeText: null,
                outputs: null,
                decisions: undefined,
              },
            });
            sections.push(section);
          }
        }

        return { ...newReview, sections };
      });

      if (review && (review as any).conflict) {
        return reply.code(409).send({ error: (review as any).message });
      }

      return reply.code(201).send({ review });
    },
  );

  // GET /management-reviews/:id - Get single management review
  app.get(
    '/management-reviews/:id',
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const tenantId = req.db?.tenantId ?? req.auth?.tenantId;
      if (!tenantId) return reply.code(400).send({ error: 'Tenant context required' });

      const review = await app.runWithDbContext(req, async (tx) => {
        return tx.managementReview.findFirst({
          where: { id: req.params.id, tenantId, deletedAt: null },
          include: {
            sections: {
              orderBy: { key: 'asc' },
            },
          },
        });
      });

      if (!review) return reply.code(404).send({ error: 'Management review not found' });
      return reply.send({ review });
    },
  );

  // POST /management-reviews/:id/generate-draft - Generate draft with system data
  app.post(
    '/management-reviews/:id/generate-draft',
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const tenantId = req.db?.tenantId ?? req.auth?.tenantId;
      if (!tenantId) return reply.code(400).send({ error: 'Tenant context required' });

      const review = await app.runWithDbContext(req, async (tx) => {
        const existing = await tx.managementReview.findFirst({
          where: { id: req.params.id, tenantId, deletedAt: null },
          include: { sections: true },
        });
        if (!existing) return null;

        // Build system data for all sections
        const systemData = await buildSectionSystemData({
          tenantId,
          periodStart: existing.periodStart,
          periodEnd: existing.periodEnd,
          standards: existing.standards,
          tx,
        });

        // Rebuild sections from scratch to get updated templates and deduplicate keys
        // Delete all existing sections first
        await tx.managementReviewSection.deleteMany({
          where: { reportId: req.params.id },
        });

        // Collect unique sections across all standards (dedup by key, first title wins)
        const seenKeys = new Set<string>();
        const sectionsToCreate: Array<{ key: string; title: string; order: number }> = [];
        let order = 0;
        for (const standard of existing.standards) {
          const templates = SECTION_TEMPLATES[standard] || [];
          for (const template of templates) {
            if (!seenKeys.has(template.key)) {
              seenKeys.add(template.key);
              sectionsToCreate.push({ key: template.key, title: template.title, order: order++ });
            }
          }
        }

        // Create new sections with system data
        for (const sec of sectionsToCreate) {
          // Preserve freeText / outputs / decisions from old sections if key matches
          const oldSection = existing.sections.find((s: any) => s.key === sec.key);
          await tx.managementReviewSection.create({
            data: {
              reportId: req.params.id,
              key: sec.key,
              title: sec.title,
              systemData: systemData[sec.key] ?? null,
              freeText: oldSection?.freeText ?? null,
              outputs: oldSection?.outputs ?? null,
              decisions: oldSection?.decisions ?? undefined,
            },
          });
        }

        // Update review status
        await tx.managementReview.update({
          where: { id: req.params.id },
          data: { generatedAt: new Date() },
        });

        // Return updated review with sections
        return tx.managementReview.findFirst({
          where: { id: req.params.id, tenantId, deletedAt: null },
          include: {
            sections: {
              orderBy: { key: 'asc' },
            },
          },
        });
      });

      if (!review) return reply.code(404).send({ error: 'Management review not found' });
      return reply.send({ review });
    },
  );

  // PATCH /management-reviews/:id - Update review metadata
  app.patch(
    '/management-reviews/:id',
    async (req: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
      const tenantId = req.db?.tenantId ?? req.auth?.tenantId;
      if (!tenantId) return reply.code(400).send({ error: 'Tenant context required' });

      const body = req.body as any;
      const data: any = {};

      if ('title' in body) data.title = body.title;
      if ('summary' in body) data.summary = body.summary && typeof body.summary === 'string' ? body.summary.trim() : null;
      if ('status' in body && ['DRAFT', 'FINAL'].includes(body.status)) data.status = body.status;

      if (Object.keys(data).length === 0) {
        return reply.code(400).send({ error: 'No updatable fields provided' });
      }

      const review = await app.runWithDbContext(req, async (tx) => {
        const existing = await tx.managementReview.findFirst({
          where: { id: req.params.id, tenantId, deletedAt: null },
        });
        if (!existing) return null;

        return tx.managementReview.update({
          where: { id: req.params.id },
          data,
        });
      });

      if (!review) return reply.code(404).send({ error: 'Management review not found' });
      return reply.send({ review });
    },
  );

  // PATCH /management-reviews/:id/sections/:sectionKey - Update section
  app.patch(
    '/management-reviews/:id/sections/:sectionKey',
    async (req: FastifyRequest<{ Params: { id: string; sectionKey: string }; Body: any }>, reply: FastifyReply) => {
      const tenantId = req.db?.tenantId ?? req.auth?.tenantId;
      if (!tenantId) return reply.code(400).send({ error: 'Tenant context required' });

      const body = req.body as any;
      const data: any = {};

      if ('freeText' in body) data.freeText = body.freeText && typeof body.freeText === 'string' ? body.freeText.trim() : null;
      if ('outputs' in body) data.outputs = body.outputs && typeof body.outputs === 'string' ? body.outputs.trim() : null;
      if ('decisions' in body) data.decisions = body.decisions;

      const section = await app.runWithDbContext(req, async (tx) => {
        const review = await tx.managementReview.findFirst({
          where: { id: req.params.id, tenantId, deletedAt: null },
        });
        if (!review) return null;

        const existing = await tx.managementReviewSection.findFirst({
          where: { reportId: req.params.id, key: req.params.sectionKey },
        });
        if (!existing) return null;

        return tx.managementReviewSection.update({
          where: { id: existing.id },
          data,
        });
      });

      if (!section) return reply.code(404).send({ error: 'Section not found' });
      return reply.send({ section });
    },
  );

  // DELETE /management-reviews/:id - Delete management review
  app.delete(
    '/management-reviews/:id',
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const tenantId = req.db?.tenantId ?? req.auth?.tenantId;
      if (!tenantId) return reply.code(400).send({ error: 'Tenant context required' });

      await app.runWithDbContext(req, async (tx) => {
        const existing = await tx.managementReview.findFirst({
          where: { id: req.params.id, tenantId, deletedAt: null },
        });
        if (!existing) return;

        // Soft delete
        await tx.managementReview.update({
          where: { id: req.params.id },
          data: { deletedAt: new Date() },
        });
      });

      return reply.code(204).send();
    },
  );

  // POST /management-reviews/:id/ai-suggest/:sectionKey
  // Usa el LLM del servidor para generar sugerencias de texto para una sección específica
  app.post(
    '/management-reviews/:id/ai-suggest/:sectionKey',
    async (req: FastifyRequest<{ Params: { id: string; sectionKey: string } }>, reply: FastifyReply) => {
      const tenantId = (req as any).db?.tenantId ?? (req as any).auth?.tenantId;
      if (!tenantId) return reply.code(400).send({ error: 'Tenant context required' });

      // Obtener la sección con datos del sistema
      const section = await (app as any).runWithDbContext(req, async (tx: any) => {
        const review = await tx.managementReview.findFirst({
          where: { id: req.params.id, tenantId, deletedAt: null },
          select: { title: true, periodStart: true, periodEnd: true, standards: true },
        });
        if (!review) return null;

        const sec = await tx.managementReviewSection.findFirst({
          where: { reportId: req.params.id, key: req.params.sectionKey },
        });
        return sec ? { section: sec, review } : null;
      });

      if (!section) return reply.code(404).send({ error: 'Sección no encontrada' });

      try {
        const llm = createLLMProvider();
        const { section: sec, review } = section;

        const periodStr = `${new Date(review.periodStart).toLocaleDateString('es-AR')} al ${new Date(review.periodEnd).toLocaleDateString('es-AR')}`;
        const normas = Array.isArray(review.standards) ? review.standards.join(', ') : review.standards;

        // Construir resumen de datos del sistema si existen
        let systemDataSummary = '';
        if (sec.systemData) {
          try {
            const sd = typeof sec.systemData === 'string' ? JSON.parse(sec.systemData) : sec.systemData;
            systemDataSummary = '\n\nDatos del sistema (entradas automáticas):\n' + JSON.stringify(sd, null, 2).slice(0, 1500);
          } catch {
            systemDataSummary = '';
          }
        }

        // Texto actual del usuario como contexto adicional
        const currentText = sec.freeText ? `\n\nTexto actual del responsable:\n${sec.freeText}` : '';

        const prompt = `Sos un experto en sistemas de gestión integrado (SGI) con profundo conocimiento en ${normas}.
Estás ayudando a redactar el Informe para la Dirección del período ${periodStr} para la sección "${sec.title}".

Tu tarea es generar un párrafo de análisis y observaciones profesional, concreto y bien redactado en español formal (Argentina), apropiado para presentar a la alta dirección.

El texto debe:
- Interpretar los datos disponibles y destacar tendencias o hallazgos relevantes
- Indicar si el desempeño es satisfactorio o requiere atención
- Sugerir conclusiones que la dirección debería considerar
- Proponer posibles decisiones o acciones concretas
- Usar lenguaje técnico ISO apropiado pero comprensible
- Tener entre 3 y 5 párrafos bien estructurados
${systemDataSummary}${currentText}

Generá únicamente el texto del análisis, sin encabezados ni formato adicional.`;

        const response = await llm.chat([{ role: 'user', content: prompt }], 800);

        return reply.send({ suggestion: response.text, model: response.model });
      } catch (err: any) {
        app.log.error('AI suggest error:', err);
        return reply.code(503).send({
          error: err?.message || 'El servicio de IA no está disponible en este momento',
        });
      }
    },
  );
}
