import { FastifyInstance } from 'fastify';

const tid = (req: any) => req.sehAuth?.tenantId;

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente', COMPLIANT: 'Cumple', PARTIAL: 'Parcial',
  NON_COMPLIANT: 'No cumple', NOT_APPLICABLE: 'No aplica',
};

/**
 * Matriz legal SEH por cliente: vista consolidada con score de cumplimiento.
 * GET /seh360/legal-matrix?clientId=  → stats + grupos + items
 * PATCH /seh360/legal-matrix/:id      → actualizar status/notes/nextReview de un requisito
 */
export const registerSeh360LegalMatrixRoutes = async (app: FastifyInstance) => {

  app.get('/seh360/legal-matrix', async (req: any, reply) => {
    if (!req.sehAuth) return reply.code(401).send({ error: 'No autorizado' });
    const t = tid(req); if (!t) return reply.code(400).send({ error: 'Tenant required' });
    const { clientId } = req.query as any;
    const where: any = { tenantId: t, deletedAt: null };
    if (clientId) where.clientId = clientId;

    const prisma = (app as any).prisma;
    const items = await prisma.sehLegalRequirement.findMany({
      where,
      orderBy: [{ normative: 'asc' }, { createdAt: 'asc' }],
    });

    // Stats
    const byStatus: Record<string, number> = {};
    let evaluated = 0;
    for (const i of items) {
      byStatus[i.status] = (byStatus[i.status] || 0) + 1;
      if (i.status !== 'NOT_APPLICABLE' && i.status !== 'PENDING') evaluated++;
    }
    const compliant = (byStatus.COMPLIANT || 0) + Math.round((byStatus.PARTIAL || 0) * 0.5);
    const score = evaluated > 0 ? Math.round((compliant / evaluated) * 100) : 0;

    // Próximas revisiones
    const now = new Date();
    const in60 = new Date(now.getTime() + 60 * 86400000);
    const upcomingReviews = items.filter((i: any) => i.nextReview && new Date(i.nextReview) <= in60).length;

    // Agrupado por normativa
    const groups: Record<string, { normative: string; jurisdiction: string | null; total: number; compliant: number; items: any[] }> = {};
    for (const i of items) {
      const key = i.normative;
      if (!groups[key]) groups[key] = { normative: i.normative, jurisdiction: i.jurisdiction, total: 0, compliant: 0, items: [] };
      groups[key].total++;
      if (i.status === 'COMPLIANT') groups[key].compliant++;
      groups[key].items.push(i);
    }

    return reply.send({
      matrix: {
        total: items.length,
        byStatus,
        complianceScore: score,
        upcomingReviews,
        groups: Object.values(groups),
        statusLabels: STATUS_LABELS,
      },
    });
  });

  // Resumen comparativo entre clientes del consultor
  app.get('/seh360/legal-matrix/summary', async (req: any, reply) => {
    if (!req.sehAuth) return reply.code(401).send({ error: 'No autorizado' });
    const t = tid(req); if (!t) return reply.code(400).send({ error: 'Tenant required' });
    const prisma = (app as any).prisma;

    const clients = await prisma.sehClient.findMany({ where: { tenantId: t, deletedAt: null }, select: { id: true, name: true } });
    const reqs = await prisma.sehLegalRequirement.findMany({
      where: { tenantId: t, deletedAt: null, clientId: { not: null } },
      select: { clientId: true, status: true },
    });

    const summary = clients.map((c: any) => {
      const mine = reqs.filter((r: any) => r.clientId === c.id);
      const evald = mine.filter((r: any) => r.status !== 'PENDING' && r.status !== 'NOT_APPLICABLE');
      const ok = evald.filter((r: any) => r.status === 'COMPLIANT').length + evald.filter((r: any) => r.status === 'PARTIAL').length * 0.5;
      return {
        clientId: c.id, name: c.name, total: mine.length, evaluated: evald.length,
        score: evald.length ? Math.round((ok / evald.length) * 100) : null,
        nonCompliant: mine.filter((r: any) => r.status === 'NON_COMPLIANT').length,
      };
    });
    return reply.send({ summary });
  });

  app.patch('/seh360/legal-matrix/:id', async (req: any, reply) => {
    if (!req.sehAuth) return reply.code(401).send({ error: 'No autorizado' });
    const t = tid(req); if (!t) return reply.code(400).send({ error: 'Tenant required' });
    const body = (req.body as any) || {};
    const data: any = { updatedAt: new Date(), updatedById: req.sehAuth.userId };
    for (const k of ['status', 'notes', 'verificationNotes', 'responsible', 'evidenceUrl', 'criticality', 'complianceScore', 'frequency', 'evidenceRequired']) {
      if (body[k] !== undefined) data[k] = body[k];
    }
    if (body.nextReview) data.nextReview = new Date(body.nextReview);
    if (body.lastReview) data.lastReview = new Date(body.lastReview);
    if (body.status && body.status !== 'PENDING') data.lastReview = data.lastReview || new Date();
    const r = await (app as any).prisma.sehLegalRequirement.updateMany({ where: { id: req.params.id, tenantId: t }, data });
    return reply.send({ updated: r.count });
  });
};
