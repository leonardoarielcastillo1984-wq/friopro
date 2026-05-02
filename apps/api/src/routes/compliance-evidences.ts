import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { requiresTenantContext } from '../utils/tenant-bypass.js';
import { createLLMProvider } from '../services/llm/factory.js';

const FEATURE_KEY = 'normativos_compliance';

// ──────────────────────────────────────────────────────────────
// Servicios: verificar datos reales por módulo
// ──────────────────────────────────────────────────────────────

async function hasRealData(
  tx: Prisma.TransactionClient,
  tenantId: string,
  referenceType: string,
  referenceId?: string | null,
): Promise<boolean> {
  switch (referenceType) {
    case 'suppliers': {
      if (referenceId) {
        const s = await tx.supplier.findFirst({ where: { id: referenceId, tenantId, deletedAt: null } });
        return !!s;
      }
      const count = await tx.supplier.count({ where: { tenantId, deletedAt: null } });
      return count > 0;
    }
    case 'customers': {
      if (referenceId) {
        const c = await tx.customer.findFirst({ where: { id: referenceId, tenantId } });
        return !!c;
      }
      const count = await tx.customer.count({ where: { tenantId } });
      return count > 0;
    }
    case 'employees': {
      if (referenceId) {
        const e = await tx.employee.findFirst({ where: { id: referenceId, tenantId, deletedAt: null } });
        return !!e;
      }
      const count = await tx.employee.count({ where: { tenantId, deletedAt: null } });
      return count > 0;
    }
    case 'kpi': {
      if (referenceId) {
        const k = await tx.indicator.findFirst({ where: { id: referenceId, tenantId } });
        return !!k;
      }
      const count = await tx.indicator.count({ where: { tenantId } });
      return count > 0;
    }
    case 'risks': {
      if (referenceId) {
        const r = await tx.risk.findFirst({ where: { id: referenceId, tenantId } });
        return !!r;
      }
      const count = await tx.risk.count({ where: { tenantId } });
      return count > 0;
    }
    case 'ncr': {
      if (referenceId) {
        const n = await tx.nonConformity.findFirst({ where: { id: referenceId, tenantId } });
        return !!n;
      }
      const count = await tx.nonConformity.count({ where: { tenantId } });
      return count > 0;
    }
    case 'capa': {
      if (referenceId) {
        const p = await tx.customerImprovementPlan.findFirst({ where: { id: referenceId, tenantId } });
        return !!p;
      }
      const count = await tx.customerImprovementPlan.count({ where: { tenantId } });
      return count > 0;
    }
    case 'audits': {
      if (referenceId) {
        const a = await tx.audit.findFirst({ where: { id: referenceId, tenantId } });
        return !!a;
      }
      const count = await tx.audit.count({ where: { tenantId } });
      return count > 0;
    }
    case 'projects': {
      if (referenceId) {
        const p = await tx.project360.findFirst({ where: { id: referenceId, tenantId, deletedAt: null } });
        return !!p;
      }
      const count = await tx.project360.count({ where: { tenantId, deletedAt: null } });
      return count > 0;
    }
    case 'trainings': {
      if (referenceId) {
        const t = await tx.training.findFirst({ where: { id: referenceId, tenantId } });
        return !!t;
      }
      const count = await tx.training.count({ where: { tenantId } });
      return count > 0;
    }
    case 'documents': {
      if (referenceId) {
        const d = await tx.document.findFirst({ where: { id: referenceId, tenantId, deletedAt: null } });
        return !!d;
      }
      const count = await tx.document.count({ where: { tenantId, deletedAt: null } });
      return count > 0;
    }
    case 'departments': {
      if (referenceId) {
        const d = await tx.department.findFirst({ where: { id: referenceId, tenantId } });
        return !!d;
      }
      const count = await tx.department.count({ where: { tenantId } });
      return count > 0;
    }
    case 'policies': {
      if (referenceId) {
        const p = await tx.policy.findFirst({ where: { id: referenceId, tenantId, deletedAt: null } });
        return !!p;
      }
      const count = await tx.policy.count({ where: { tenantId, deletedAt: null } });
      return count > 0;
    }
    case 'objectives': {
      if (referenceId) {
        const o = await tx.sgiObjective.findFirst({ where: { id: referenceId, tenantId } });
        return !!o;
      }
      const count = await tx.sgiObjective.count({ where: { tenantId } });
      return count > 0;
    }
    case 'management_reviews': {
      if (referenceId) {
        const m = await tx.managementReview.findFirst({ where: { id: referenceId, tenantId, deletedAt: null } });
        return !!m;
      }
      const count = await tx.managementReview.count({ where: { tenantId, deletedAt: null } });
      return count > 0;
    }
    case 'stakeholders': {
      if (referenceId) {
        const s = await tx.stakeholder.findFirst({ where: { id: referenceId, tenantId, deletedAt: null } });
        return !!s;
      }
      const count = await tx.stakeholder.count({ where: { tenantId, deletedAt: null } });
      return count > 0;
    }
    case 'organization_contexts': {
      if (referenceId) {
        const o = await tx.organizationContext.findFirst({ where: { id: referenceId, tenantId } });
        return !!o;
      }
      const count = await tx.organizationContext.count({ where: { tenantId } });
      return count > 0;
    }
    case 'environmental_aspects': {
      if (referenceId) {
        const e = await tx.environmentalAspect.findFirst({ where: { id: referenceId, tenantId, deletedAt: null } });
        return !!e;
      }
      const count = await tx.environmentalAspect.count({ where: { tenantId, deletedAt: null } });
      return count > 0;
    }
    case 'positions': {
      if (referenceId) {
        const p = await tx.position.findFirst({ where: { id: referenceId, tenantId, deletedAt: null } });
        return !!p;
      }
      const count = await tx.position.count({ where: { tenantId, deletedAt: null } });
      return count > 0;
    }
    case 'employee_competencies': {
      if (referenceId) {
        const ec = await tx.employeeCompetency.findFirst({
          where: { id: referenceId, employee: { tenantId } },
        });
        return !!ec;
      }
      const count = await tx.employeeCompetency.count({
        where: { employee: { tenantId } },
      });
      return count > 0;
    }
    default:
      return false;
  }
}

async function getModuleStats(
  tx: Prisma.TransactionClient,
  tenantId: string,
  referenceType: string,
) {
  switch (referenceType) {
    case 'suppliers': {
      const [total, withEvaluations] = await Promise.all([
        tx.supplier.count({ where: { tenantId, deletedAt: null } }),
        tx.supplierEvaluation.count({ where: { tenantId } }),
      ]);
      return { total, withEvaluations, score: withEvaluations > 0 ? 'active' : 'empty' };
    }
    case 'customers': {
      const total = await tx.customer.count({ where: { tenantId } });
      return { total, score: total > 0 ? 'active' : 'empty' };
    }
    case 'employees': {
      const total = await tx.employee.count({ where: { tenantId, deletedAt: null } });
      return { total, score: total > 0 ? 'active' : 'empty' };
    }
    case 'kpi': {
      const total = await tx.indicator.count({ where: { tenantId } });
      return { total, score: total > 0 ? 'active' : 'empty' };
    }
    case 'risks': {
      const total = await tx.risk.count({ where: { tenantId } });
      return { total, score: total > 0 ? 'active' : 'empty' };
    }
    case 'ncr': {
      const total = await tx.nonConformity.count({ where: { tenantId } });
      return { total, score: total > 0 ? 'active' : 'empty' };
    }
    case 'capa': {
      const total = await tx.customerImprovementPlan.count({ where: { tenantId } });
      return { total, score: total > 0 ? 'active' : 'empty' };
    }
    case 'audits': {
      const total = await tx.audit.count({ where: { tenantId } });
      return { total, score: total > 0 ? 'active' : 'empty' };
    }
    case 'projects': {
      const total = await tx.project360.count({ where: { tenantId, deletedAt: null } });
      return { total, score: total > 0 ? 'active' : 'empty' };
    }
    case 'trainings': {
      const total = await tx.training.count({ where: { tenantId } });
      return { total, score: total > 0 ? 'active' : 'empty' };
    }
    case 'documents': {
      const total = await tx.document.count({ where: { tenantId, deletedAt: null } });
      return { total, score: total > 0 ? 'active' : 'empty' };
    }
    case 'departments': {
      const total = await tx.department.count({ where: { tenantId } });
      return { total, score: total > 0 ? 'active' : 'empty' };
    }
    case 'policies': {
      const total = await tx.policy.count({ where: { tenantId, deletedAt: null } });
      return { total, score: total > 0 ? 'active' : 'empty' };
    }
    case 'objectives': {
      const total = await tx.sgiObjective.count({ where: { tenantId } });
      return { total, score: total > 0 ? 'active' : 'empty' };
    }
    case 'management_reviews': {
      const total = await tx.managementReview.count({ where: { tenantId, deletedAt: null } });
      return { total, score: total > 0 ? 'active' : 'empty' };
    }
    case 'stakeholders': {
      const total = await tx.stakeholder.count({ where: { tenantId, deletedAt: null } });
      return { total, score: total > 0 ? 'active' : 'empty' };
    }
    case 'organization_contexts': {
      const total = await tx.organizationContext.count({ where: { tenantId } });
      return { total, score: total > 0 ? 'active' : 'empty' };
    }
    case 'environmental_aspects': {
      const total = await tx.environmentalAspect.count({ where: { tenantId, deletedAt: null } });
      return { total, score: total > 0 ? 'active' : 'empty' };
    }
    case 'positions': {
      const total = await tx.position.count({ where: { tenantId, deletedAt: null } });
      return { total, score: total > 0 ? 'active' : 'empty' };
    }
    case 'employee_competencies': {
      const total = await tx.employeeCompetency.count({ where: { employee: { tenantId } } });
      return { total, score: total > 0 ? 'active' : 'empty' };
    }
    default:
      return { total: 0, score: 'unknown' };
  }
}

// ──────────────────────────────────────────────────────────────
// Cálculo de cumplimiento ponderado por cláusula
// ──────────────────────────────────────────────────────────────

export async function calculateClauseCompliance(
  tx: Prisma.TransactionClient,
  tenantId: string,
  clauseId: string,
) {
  // 1. Documentos (40%)
  const docCount = await tx.documentClauseMapping.count({
    where: { clauseId, deletedAt: null },
  });
  const docScore = docCount > 0 ? 1 : 0;

  // 2. Evidencias dinámicas (solo si existe el modelo)
  let evidences: any[] = [];
  try {
    if ((tx as any).clauseEvidence) {
      evidences = await (tx as any).clauseEvidence.findMany({
        where: { clauseId, tenantId, isActive: true },
      });
    }
  } catch (e) {
    // Modelo no existe - continuar sin evidencias dinámicas
  }

  let moduleScore = 0;
  let moduleCount = 0;
  let indicatorScore = 0;
  let indicatorCount = 0;
  let actionScore = 0;
  let actionCount = 0;

  for (const ev of evidences) {
    const hasData = await hasRealData(tx, tenantId, ev.referenceType || '', ev.referenceId ?? null);
    switch (ev.type) {
      case 'MODULE':
        moduleCount++;
        if (hasData) moduleScore++;
        break;
      case 'INDICATOR':
        indicatorCount++;
        if (hasData) indicatorScore++;
        break;
      case 'ACTION':
        actionCount++;
        if (hasData) actionScore++;
        break;
      case 'DOCUMENT':
        // Los DOCUMENT se manejan por DocumentClauseMapping
        break;
    }
  }

  // Cálculo ponderado
  // DOCUMENT: 40% (si hay al menos 1 doc mapping)
  // MODULE: 30% (si hay al menos 1 módulo con datos)
  // INDICATOR: 20% (si hay al menos 1 indicador con datos)
  // ACTION: 10% (si hay al menos 1 acción con datos)

  const docWeight = 0.40;
  const moduleWeight = 0.30;
  const indicatorWeight = 0.20;
  const actionWeight = 0.10;

  const hasDoc = docScore > 0;
  const hasModule = moduleCount > 0 && moduleScore > 0;
  const hasIndicator = indicatorCount > 0 && indicatorScore > 0;
  const hasAction = actionCount > 0 && actionScore > 0;

  const totalScore =
    (hasDoc ? docWeight : 0) +
    (hasModule ? moduleWeight : 0) +
    (hasIndicator ? indicatorWeight : 0) +
    (hasAction ? actionWeight : 0);

  const percentage = Math.round(totalScore * 100);

  let status: 'COMPLIANT' | 'PARTIAL' | 'NON_COMPLIANT' | 'NOT_APPLICABLE';
  if (percentage >= 80) status = 'COMPLIANT';
  else if (percentage >= 50) status = 'PARTIAL';
  else if (evidences.length === 0 && docCount === 0) status = 'NON_COMPLIANT';
  else status = 'NON_COMPLIANT';

  return {
    percentage,
    status,
    breakdown: {
      document: { has: hasDoc, count: docCount },
      module: { has: hasModule, count: moduleCount, active: moduleScore },
      indicator: { has: hasIndicator, count: indicatorCount, active: indicatorScore },
      action: { has: hasAction, count: actionCount, active: actionScore },
    },
  };
}

// ──────────────────────────────────────────────────────────────
// Rutas
// ──────────────────────────────────────────────────────────────

export const complianceEvidenceRoutes: FastifyPluginAsync = async (app) => {
  // ── GET /clauses/:clauseId/evidences ──
  app.get('/clauses/:clauseId/evidences', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, FEATURE_KEY);
    if (requiresTenantContext(req) && !req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });
    const tenantId = req.db!.tenantId;

    const { clauseId } = z.object({ clauseId: z.string().uuid() }).parse(req.params);

    const evidences = await app.runWithDbContext(req, async (tx: Prisma.TransactionClient) => {
      return tx.clauseEvidence.findMany({
        where: { clauseId, tenantId, isActive: true },
        orderBy: { createdAt: 'desc' },
      });
    });

    // Enriquecer con stats de módulo
    const enriched = await Promise.all(
      evidences.map(async (ev: any) => {
        if (ev.type === 'MODULE' && ev.referenceType) {
          const refType: string = ev.referenceType;
          const stats = await app.runWithDbContext(req, async (tx: Prisma.TransactionClient) => {
            return getModuleStats(tx, tenantId, refType);
          });
          return { ...ev, moduleStats: stats };
        }
        return { ...ev, moduleStats: null };
      }),
    );

    return reply.send({ evidences: enriched });
  });

  // ── POST /clauses/:clauseId/evidences ──
  app.post('/clauses/:clauseId/evidences', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, FEATURE_KEY);
    if (requiresTenantContext(req) && !req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });
    const tenantId = req.db!.tenantId;

    const { clauseId } = z.object({ clauseId: z.string().uuid() }).parse(req.params);
    const rawBody = req.body;
    const body = typeof rawBody === 'string' ? JSON.parse(rawBody) : (rawBody ?? {}) as any;

    const schema = z.object({
      type: z.enum(['DOCUMENT', 'MODULE', 'INDICATOR', 'ACTION']),
      referenceId: z.string().uuid().optional().nullable(),
      referenceType: z.string().optional().nullable(),
      description: z.string().optional().nullable(),
    });
    const data = schema.parse(body);

    const evidence = await app.runWithDbContext(req, async (tx: Prisma.TransactionClient) => {
      // Verificar que la cláusula existe y pertenece al tenant
      const clause = await tx.normativeClause.findFirst({
        where: { id: clauseId, deletedAt: null },
        include: { normative: { select: { tenantId: true } } },
      });
      if (!clause || clause.normative.tenantId !== tenantId) {
        throw new Error('Clause not found');
      }

      return tx.clauseEvidence.create({
        data: {
          tenantId,
          clauseId,
          type: data.type,
          referenceId: data.referenceId || null,
          referenceType: data.referenceType || null,
          description: data.description || null,
        },
      });
    });

    return reply.code(201).send({ evidence });
  });

  // ── DELETE /clauses/:clauseId/evidences/:id ──
  app.delete('/clauses/:clauseId/evidences/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, FEATURE_KEY);
    if (requiresTenantContext(req) && !req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });
    const tenantId = req.db!.tenantId;

    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    await app.runWithDbContext(req, async (tx: Prisma.TransactionClient) => {
      const ev = await tx.clauseEvidence.findFirst({ where: { id, tenantId } });
      if (!ev) throw new Error('Not found');
      return tx.clauseEvidence.delete({ where: { id } });
    });

    return reply.send({ ok: true });
  });

  // ── GET /normativos/:id/compliance-detail ──
  app.get('/:id/compliance-detail', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, FEATURE_KEY);
    if (requiresTenantContext(req) && !req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });
    const tenantId = req.db!.tenantId;

    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    const result = await app.runWithDbContext(req, async (tx: Prisma.TransactionClient) => {
      const normative = await tx.normativeStandard.findFirst({
        where: { id, tenantId, deletedAt: null },
        select: { id: true, name: true, code: true },
      });
      if (!normative) throw new Error('Normative not found');

      const clauses = await tx.normativeClause.findMany({
        where: { normativeId: id, deletedAt: null },
        select: { id: true, clauseNumber: true, title: true },
      });

      const clauseCompliances = await Promise.all(
        clauses.map(async (clause: any) => {
          const compliance = await calculateClauseCompliance(tx, tenantId, clause.id as string);
          return { ...clause, ...compliance };
        }),
      );

      const totalClauses = clauses.length;
      const compliantCount = clauseCompliances.filter((c) => c.status === 'COMPLIANT').length;
      const partialCount = clauseCompliances.filter((c) => c.status === 'PARTIAL').length;
      const nonCompliantCount = clauseCompliances.filter((c) => c.status === 'NON_COMPLIANT').length;

      const overallPercentage = totalClauses > 0
        ? Math.round(
            clauseCompliances.reduce((sum, c) => sum + c.percentage, 0) / totalClauses,
          )
        : 0;

      return {
        normative,
        overallPercentage,
        summary: {
          totalClauses,
          compliant: compliantCount,
          partial: partialCount,
          nonCompliant: nonCompliantCount,
        },
        clauses: clauseCompliances,
      };
    });

    return reply.send(result);
  });

  // ── GET /normativos/:id/clauses/:clauseId/compliance ──
  app.get('/:id/clauses/:clauseId/compliance', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, FEATURE_KEY);
    if (requiresTenantContext(req) && !req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });
    const tenantId = req.db!.tenantId;

    const { clauseId } = z.object({ clauseId: z.string().uuid() }).parse(req.params);

    const result = await app.runWithDbContext(req, async (tx: Prisma.TransactionClient) => {
      const clause = await tx.normativeClause.findFirst({
        where: { id: clauseId, deletedAt: null },
        include: { normative: { select: { tenantId: true } } },
      });
      if (!clause || clause.normative.tenantId !== tenantId) {
        throw new Error('Clause not found');
      }
      const compliance = await calculateClauseCompliance(tx, tenantId, clauseId);
      return { clause: { id: clause.id, clauseNumber: clause.clauseNumber, title: clause.title }, compliance };
    });

    return reply.send(result);
  });

  // ── GET /compliance/modules — listar módulos disponibles ──
  app.get('/compliance/modules', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, FEATURE_KEY);
    if (requiresTenantContext(req) && !req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });

    const modules = [
      { key: 'suppliers', label: 'Proveedores', icon: 'Truck' },
      { key: 'customers', label: 'Clientes', icon: 'Users' },
      { key: 'employees', label: 'RRHH / Empleados', icon: 'User' },
      { key: 'departments', label: 'Departamentos / Organización', icon: 'Building' },
      { key: 'positions', label: 'RRHH / Puestos de trabajo', icon: 'Briefcase' },
      { key: 'employee_competencies', label: 'RRHH / Matriz de polivalencia', icon: 'Grid3x3' },
      { key: 'trainings', label: 'RRHH / Capacitaciones', icon: 'GraduationCap' },
      { key: 'kpi', label: 'Indicadores (KPI)', icon: 'BarChart' },
      { key: 'risks', label: 'Riesgos', icon: 'AlertTriangle' },
      { key: 'ncr', label: 'No Conformidades', icon: 'XCircle' },
      { key: 'capa', label: 'CAPA / Planes de mejora', icon: 'CheckCircle' },
      { key: 'audits', label: 'Auditorías', icon: 'ClipboardList' },
      { key: 'projects', label: 'Proyectos / Planes', icon: 'FolderOpen' },
      { key: 'documents', label: 'Documentos del SGI', icon: 'FileText' },
      { key: 'policies', label: 'Políticas SGI', icon: 'Shield' },
      { key: 'objectives', label: 'Objetivos SGI', icon: 'Target' },
      { key: 'management_reviews', label: 'Revisión por la Dirección', icon: 'Clipboard' },
      { key: 'stakeholders', label: 'Contexto del SGI / Partes interesadas', icon: 'UsersRound' },
      { key: 'organization_contexts', label: 'Contexto del SGI / FODA-PESTEL', icon: 'Globe' },
      { key: 'environmental_aspects', label: 'Seguridad & Ambiente / Aspectos ambientales', icon: 'Leaf' },
    ];

    return reply.send({ modules });
  });

  // ── POST /clauses/:clauseId/ai-analyze — Análisis IA de cumplimiento ──
  app.post('/clauses/:clauseId/ai-analyze', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, FEATURE_KEY);
    if (requiresTenantContext(req) && !req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });

    const tenantId = req.db!.tenantId;
    const paramsSchema = z.object({ clauseId: z.string().uuid() });
    const { clauseId } = paramsSchema.parse(req.params);

    try {
      // 1–5. Obtener todos los datos de BD en una transacción corta
      const dbData = await app.runWithDbContext(req, async (tx: Prisma.TransactionClient) => {
        const clause = await tx.normativeClause.findFirst({
          where: { id: clauseId, deletedAt: null },
          include: { normative: { select: { name: true, code: true } } },
        });
        if (!clause) throw new Error('Clause not found');

        const docMappings = await tx.documentClauseMapping.findMany({
          where: { clauseId, deletedAt: null },
          include: { document: { select: { title: true, type: true, filePath: true } } },
        });

        const evidences = await tx.clauseEvidence.findMany({
          where: { clauseId, tenantId, isActive: true },
        });

        const moduleDataSummaries: Record<string, any> = {};
        for (const ev of evidences) {
          if (ev.referenceType) {
            const stats = await getModuleStats(tx, tenantId, ev.referenceType as string);
            moduleDataSummaries[ev.id] = { type: ev.referenceType, description: ev.description, stats };
          }
        }

        const compliance = await calculateClauseCompliance(tx, tenantId, clauseId);
        return { clause, docMappings, evidences, moduleDataSummaries, compliance };
      });

      const { clause, docMappings, evidences, moduleDataSummaries, compliance } = dbData;

      // 6. Construir prompt para IA (fuera de transacción)
      const documentsBlock = docMappings.length > 0
        ? docMappings.map((d: any, i: number) => `  ${i + 1}. ${d.document?.title || 'Sin nombre'} (${d.document?.type || 'sin tipo'})`).join('\n')
        : '  (Sin documentos vinculados)';

      const modulesBlock = evidences.length > 0
        ? evidences.map((e: any, i: number) => {
            const md = moduleDataSummaries[e.id];
            return `  ${i + 1}. ${e.type}${e.referenceType ? ` / ${e.referenceType}` : ''}${e.description ? ` — ${e.description}` : ''}\n     Estado: ${md?.stats?.score === 'active' ? 'Activo (tiene datos reales)' : 'Sin datos reales'}${md?.stats?.total !== undefined ? ` | Registros: ${md.stats.total}` : ''}`;
          }).join('\n')
        : '  (Sin módulos vinculados)';

      const prompt = `Sos un experto auditor ISO 9001, 14001 y 45001. Analizá el cumplimiento de la siguiente cláusula normativa comparando su contenido con los documentos y datos del sistema disponibles.

=== CLÁUSULA ===
Norma: ${clause.normative.code} — ${clause.normative.name}
Cláusula ${clause.clauseNumber || 'N/A'}: ${clause.title || 'Sin título'}
Contenido:\n${(clause.content || '').slice(0, 2000)}

=== DOCUMENTOS VINCULADOS ===
${documentsBlock}

=== MÓDULOS DEL SISTEMA VINCULADOS ===
${modulesBlock}

=== CUMPLIMIENTO CALCULADO ===
Porcentaje: ${compliance.percentage}%
Estado: ${compliance.status}

Tu tarea:
1. Evaluá si los documentos y módulos vinculados cubren los requisitos de la cláusula.
2. Indicá qué falta para alcanzar cumplimiento total.
3. Clasificá el cumplimiento como: CUMPLIMIENTO_TOTAL, CUMPLIMIENTO_PARCIAL, NO_CUMPLIMIENTO.
4. Proporcioná recomendaciones concretas y priorizadas (máximo 5).

Respondé EXACTAMENTE en este formato JSON (sin markdown, sin bloques de código):
{
  "assessment": "CUMPLIMIENTO_TOTAL|CUMPLIMIENTO_PARCIAL|NO_CUMPLIMIENTO",
  "compliancePercentage": ${compliance.percentage},
  "summary": "Análisis breve en 2-3 oraciones.",
  "gaps": ["Brecha 1", "Brecha 2"],
  "recommendations": [
    {"priority": "ALTA|MEDIA|BAJA", "action": "Acción concreta a realizar", "moduleOrDocument": "qué módulo o documento crear/vincular"}
  ],
  "documentsAnalysis": "Análisis de los documentos vinculados y su adecuación.",
  "modulesAnalysis": "Análisis de los datos del sistema y su relevancia para la cláusula."
}`;

      // 7. Llamar a IA (fuera de transacción para evitar timeout)
      const llm = createLLMProvider(req.tenant);
      const response = await llm.chat([{ role: 'user', content: prompt }], 1500);

      let parsed;
      try {
        parsed = JSON.parse(response.text.trim().replace(/^```json\s*|\s*```$/g, ''));
      } catch {
        parsed = {
          assessment: 'CUMPLIMIENTO_PARCIAL',
          compliancePercentage: compliance.percentage,
          summary: response.text.slice(0, 500),
          gaps: ['No se pudo estructurar el análisis.'],
          recommendations: [{ priority: 'MEDIA', action: 'Revisar manualmente el análisis.', moduleOrDocument: 'general' }],
          documentsAnalysis: '',
          modulesAnalysis: '',
        };
      }

      return reply.send({
        clause: { id: clause.id, clauseNumber: clause.clauseNumber, title: clause.title },
        compliance,
        aiAnalysis: parsed,
        model: response.model,
      });
    } catch (err: any) {
      app.log.error('AI clause analyze error:', err);
      return reply.code(503).send({ error: err?.message || 'El servicio de IA no está disponible' });
    }
  });
};
