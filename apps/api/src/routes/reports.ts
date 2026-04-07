import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

export const reportRoutes: FastifyPluginAsync = async (app) => {
  // GET /reports/ncr — Reporte de No Conformidades
  app.get('/ncr', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });

    const ncrs = await app.runWithDbContext(req, async (tx: any) => {
      return tx.nonConformity.findMany({
        where: { tenantId: req.db!.tenantId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        include: {
          assignedTo: { select: { id: true, email: true } },
          createdBy: { select: { id: true, email: true } },
        },
      });
    });

    const stats = {
      total: ncrs.length,
      open: ncrs.filter((n: any) => n.status === 'OPEN').length,
      inProgress: ncrs.filter((n: any) => ['IN_ANALYSIS', 'ACTION_PLANNED', 'IN_PROGRESS'].includes(n.status)).length,
      closed: ncrs.filter((n: any) => n.status === 'CLOSED').length,
      critical: ncrs.filter((n: any) => n.severity === 'CRITICAL').length,
      major: ncrs.filter((n: any) => n.severity === 'MAJOR').length,
      minor: ncrs.filter((n: any) => n.severity === 'MINOR').length,
      bySeverity: {
        CRITICAL: ncrs.filter((n: any) => n.severity === 'CRITICAL').length,
        MAJOR: ncrs.filter((n: any) => n.severity === 'MAJOR').length,
        MINOR: ncrs.filter((n: any) => n.severity === 'MINOR').length,
        OBSERVATION: ncrs.filter((n: any) => n.severity === 'OBSERVATION').length,
      },
      bySource: {} as Record<string, number>,
      byStatus: {} as Record<string, number>,
    };

    for (const n of ncrs) {
      stats.bySource[(n as any).source] = (stats.bySource[(n as any).source] || 0) + 1;
      stats.byStatus[(n as any).status] = (stats.byStatus[(n as any).status] || 0) + 1;
    }

    return reply.send({ report: { type: 'ncr', stats, items: ncrs, generatedAt: new Date().toISOString() } });
  });

  // GET /reports/risks — Reporte de Riesgos
  app.get('/risks', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });

    const tenantId = req.db.tenantId;

    const query = z
      .object({
        status: z.string().optional(),
        category: z.string().optional(),
        aspectType: z.string().optional(),
        strategy: z.string().optional(),
        legalRequirement: z.enum(['true', 'false']).optional(),
        riskSource: z.string().optional(),
        minLevel: z.coerce.number().int().optional(),
        maxLevel: z.coerce.number().int().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      })
      .parse(req.query);

    const where: any = { tenantId, deletedAt: null };
    if (query.status) where.status = query.status;
    if (query.category) where.category = query.category;
    if (query.aspectType) where.aspectType = query.aspectType;
    if (query.strategy) where.strategy = query.strategy;
    if (query.legalRequirement) where.legalRequirement = query.legalRequirement === 'true';
    if (query.riskSource) where.riskSource = query.riskSource;
    if (query.minLevel !== undefined || query.maxLevel !== undefined) {
      where.riskLevel = {
        ...(query.minLevel !== undefined ? { gte: query.minLevel } : {}),
        ...(query.maxLevel !== undefined ? { lte: query.maxLevel } : {}),
      };
    }
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {
        ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
        ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
      };
    }

    const risks = await app.runWithDbContext(req, async (tx: any) => {
      return tx.risk.findMany({
        where,
        orderBy: { riskLevel: 'desc' },
        include: { owner: { select: { id: true, email: true } } },
      });
    });

    const stats = {
      total: risks.length,
      critical: risks.filter((r: any) => r.riskLevel >= 20).length,
      high: risks.filter((r: any) => r.riskLevel >= 12 && r.riskLevel < 20).length,
      medium: risks.filter((r: any) => r.riskLevel >= 5 && r.riskLevel < 12).length,
      low: risks.filter((r: any) => r.riskLevel < 5).length,
      byCategory: {} as Record<string, number>,
      byStatus: {} as Record<string, number>,
      avgRiskLevel: risks.length > 0 ? Math.round(risks.reduce((s: number, r: any) => s + r.riskLevel, 0) / risks.length * 10) / 10 : 0,
    };

    for (const r of risks) {
      stats.byCategory[(r as any).category] = (stats.byCategory[(r as any).category] || 0) + 1;
      stats.byStatus[(r as any).status] = (stats.byStatus[(r as any).status] || 0) + 1;
    }

    return reply.send({ report: { type: 'risks', stats, items: risks, generatedAt: new Date().toISOString() } });
  });

  // GET /reports/indicators — Reporte de Indicadores
  app.get('/indicators', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });

    const indicators = await app.runWithDbContext(req, async (tx: any) => {
      return tx.indicator.findMany({
        where: { tenantId: req.db!.tenantId, deletedAt: null, isActive: true },
        include: { measurements: { orderBy: { measuredAt: 'desc' }, take: 12 } },
      });
    });

    const active = indicators.length;
    const onTarget = indicators.filter((i: any) => i.currentValue !== null && i.targetValue !== null && i.currentValue >= i.targetValue).length;
    const belowTarget = active - onTarget;

    return reply.send({
      report: {
        type: 'indicators', generatedAt: new Date().toISOString(),
        stats: { total: active, onTarget, belowTarget },
        items: indicators,
      },
    });
  });

  // GET /reports/compliance — Reporte de Cumplimiento Normativo
  app.get('/compliance', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });

    const data = await app.runWithDbContext(req, async (tx: any) => {
      const docs = await tx.document.findMany({
        where: { tenantId: req.db!.tenantId, deletedAt: null },
        select: { id: true, status: true, title: true, type: true },
      });
      const norms = await tx.normativeStandard.findMany({
        where: { tenantId: req.db!.tenantId, deletedAt: null },
        select: { id: true, name: true, code: true, status: true, totalClauses: true },
      });
      const findings = await tx.aiFinding.findMany({
        where: { tenantId: req.db!.tenantId, deletedAt: null },
        select: { id: true, severity: true, status: true, standard: true, clause: true },
      });

      return { docs, norms, findings };
    });

    const totalDocs = data.docs.length;
    const effectiveDocs = data.docs.filter((d: any) => d.status === 'EFFECTIVE').length;
    const complianceScore = totalDocs > 0 ? Math.round((effectiveDocs / totalDocs) * 100) : 0;

    return reply.send({
      report: {
        type: 'compliance', generatedAt: new Date().toISOString(),
        stats: {
          complianceScore,
          totalDocs,
          effectiveDocs,
          draftDocs: data.docs.filter((d: any) => d.status === 'DRAFT').length,
          totalNorms: data.norms.length,
          readyNorms: data.norms.filter((n: any) => n.status === 'READY').length,
          totalFindings: data.findings.length,
          openFindings: data.findings.filter((f: any) => f.status === 'OPEN').length,
        },
        norms: data.norms,
      },
    });
  });

  // GET /reports/trainings — Reporte de Capacitaciones
  app.get('/trainings', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });

    const trainings = await app.runWithDbContext(req, async (tx: any) => {
      return tx.sgiTraining.findMany({
        where: { tenantId: req.db!.tenantId, deletedAt: null },
        include: { _count: { select: { attendees: true } } },
        orderBy: { scheduledDate: 'desc' },
      });
    });

    const stats = {
      total: trainings.length,
      completed: trainings.filter((t: any) => t.status === 'COMPLETED').length,
      scheduled: trainings.filter((t: any) => t.status === 'SCHEDULED').length,
      totalHours: trainings.filter((t: any) => t.status === 'COMPLETED').reduce((s: number, t: any) => s + (t.durationHours || 0), 0),
      byCategory: {} as Record<string, number>,
    };

    for (const t of trainings) {
      stats.byCategory[(t as any).category] = (stats.byCategory[(t as any).category] || 0) + 1;
    }

    return reply.send({
      report: { type: 'trainings', stats, items: trainings, generatedAt: new Date().toISOString() },
    });
  });

  // GET /reports/executive — Resumen ejecutivo completo
  app.get('/executive', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = req.db?.tenantId ?? req.auth?.tenantId;
    if (!tenantId) return reply.code(400).send({ error: 'Tenant context required' });

    const data = await app.runWithDbContext(req, async (tx: any) => {
      const [docs, ncrs, risks, findings, auditRuns, norms] = await Promise.all([
        tx.document.findMany({ where: { tenantId, deletedAt: null }, select: { status: true } }),
        tx.nonConformity.findMany({ where: { tenantId, deletedAt: null }, select: { status: true, severity: true } }),
        tx.risk.findMany({ where: { tenantId, deletedAt: null }, select: { riskLevel: true, status: true } }),
        tx.aiFinding.findMany({ where: { tenantId, deletedAt: null }, select: { status: true, severity: true } }),
        tx.auditRun.findMany({ where: { tenantId, deletedAt: null }, select: { status: true } }),
        tx.normativeStandard.findMany({ where: { tenantId, deletedAt: null }, select: { status: true, totalClauses: true } }),
      ]);

      return { docs, ncrs, risks, findings, auditRuns, norms };
    });

    const totalDocs = data.docs.length;
    const effectiveDocs = data.docs.filter((d: any) => d.status === 'EFFECTIVE').length;

    return reply.send({
      report: {
        type: 'executive',
        generatedAt: new Date().toISOString(),
        summary: {
          complianceScore: totalDocs > 0 ? Math.round((effectiveDocs / totalDocs) * 100) : 0,
          documents: { total: totalDocs, effective: effectiveDocs },
          ncrs: { total: data.ncrs.length, open: data.ncrs.filter((n: any) => n.status === 'OPEN').length, critical: data.ncrs.filter((n: any) => n.severity === 'CRITICAL').length },
          risks: { total: data.risks.length, critical: data.risks.filter((r: any) => r.riskLevel >= 20).length, high: data.risks.filter((r: any) => r.riskLevel >= 12 && r.riskLevel < 20).length },
          findings: { total: data.findings.length, open: data.findings.filter((f: any) => f.status === 'OPEN').length },
          audits: { total: data.auditRuns.length, completed: data.auditRuns.filter((a: any) => a.status === 'COMPLETED').length },
          normatives: { total: data.norms.length, totalClauses: data.norms.reduce((s: number, n: any) => s + (n.totalClauses || 0), 0) },
        },
      },
    });
  });
};
