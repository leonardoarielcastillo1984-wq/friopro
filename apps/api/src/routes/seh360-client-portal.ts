import { FastifyInstance } from 'fastify';

/**
 * Portal de clientes SEH — acceso read-only para usuarios SEH_CLIENT
 * (creados por el consultor en /seh360/clients/:clientId/users).
 * Todas las rutas scopean a los clientIds vinculados en seh_client_users.
 *
 * GET /seh360/portal/me               → usuario + sus clientes
 * GET /seh360/portal/dashboard        → KPIs agregados de sus clientes
 * GET /seh360/portal/:clientId/legal  → matriz legal read-only
 * GET /seh360/portal/:clientId/risks  → matriz de riesgos read-only
 * GET /seh360/portal/:clientId/incidents → incidentes read-only
 * GET /seh360/portal/:clientId/inspections → inspecciones read-only
 * GET /seh360/portal/:clientId/trainings   → capacitaciones read-only
 * GET /seh360/portal/:clientId/documents   → documentos read-only
 * GET /seh360/portal/:clientId/alerts      → alertas read-only
 */
export const registerSehClientPortalRoutes = async (app: FastifyInstance) => {
  const prisma = (app as any).prisma;

  // Guard + resolución de clientes accesibles
  async function getPortalContext(req: any, reply: any): Promise<{ userId: string; clientIds: string[] } | null> {
    const auth = req.auth;
    if (!auth || auth.globalRole !== 'SEH_CLIENT') {
      reply.code(401).send({ error: 'No autorizado' });
      return null;
    }
    const links = await prisma.sehClientUser.findMany({
      where: { userId: auth.userId },
      select: { clientId: true },
    });
    const clientIds = links.map((l: any) => l.clientId);
    if (!clientIds.length) {
      reply.code(403).send({ error: 'Sin clientes asignados' });
      return null;
    }
    return { userId: auth.userId, clientIds };
  }

  const checkClient = (ctx: { clientIds: string[] }, clientId: string) =>
    ctx.clientIds.includes(clientId);

  // ── ME ─────────────────────────────────────────────────────────────
  app.get('/seh360/portal/me', async (req: any, reply) => {
    const ctx = await getPortalContext(req, reply); if (!ctx) return;
    const [user, clients] = await Promise.all([
      prisma.sehUser.findFirst({ where: { id: ctx.userId }, select: { id: true, email: true, firstName: true, lastName: true, position: true } }),
      prisma.sehClient.findMany({ where: { id: { in: ctx.clientIds }, deletedAt: null }, select: { id: true, name: true, logoUrl: true, activity: true, province: true } }),
    ]);
    return reply.send({ user, clients });
  });

  // ── DASHBOARD agregado ─────────────────────────────────────────────
  app.get('/seh360/portal/dashboard', async (req: any, reply) => {
    const ctx = await getPortalContext(req, reply); if (!ctx) return;
    const ids = ctx.clientIds;
    const base = { clientId: { in: ids }, deletedAt: null };

    const [risks, openIncidents, pendingPlans, upcomingInsp, legalReqs, alerts, trainings] = await Promise.all([
      prisma.sehRisk.findMany({ where: base, select: { riskLevel: true } }),
      prisma.sehIncident.count({ where: { ...base, status: { not: 'CLOSED' } } }),
      prisma.sehActionPlan.count({ where: { ...base, status: { in: ['PENDING', 'IN_PROGRESS'] } } }),
      prisma.sehInspection.findMany({
        where: { ...base, status: { in: ['PLANNED', 'IN_PROGRESS'] } },
        select: { id: true, code: true, title: true, plannedDate: true, clientId: true },
        orderBy: { plannedDate: 'asc' }, take: 10,
      }),
      prisma.sehLegalRequirement.findMany({ where: base, select: { status: true } }),
      prisma.sehAlert.findMany({
        where: { clientId: { in: ids }, isRead: false },
        orderBy: { createdAt: 'desc' }, take: 10,
        select: { id: true, title: true, message: true, severity: true, createdAt: true, clientId: true },
      }),
      prisma.sehTraining.findMany({
        where: { ...base, scheduledDate: { gte: new Date() } },
        select: { id: true, code: true, title: true, scheduledDate: true, clientId: true },
        orderBy: { scheduledDate: 'asc' }, take: 10,
      }),
    ]);

    const highRisks = risks.filter((r: any) => (r.riskLevel || 0) >= 15).length;
    const byStatus: Record<string, number> = {};
    for (const l of legalReqs) byStatus[l.status] = (byStatus[l.status] || 0) + 1;
    const evald = legalReqs.filter((l: any) => l.status !== 'PENDING' && l.status !== 'NOT_APPLICABLE');
    const ok = evald.filter((l: any) => l.status === 'COMPLIANT').length + evald.filter((l: any) => l.status === 'PARTIAL').length * 0.5;
    const legalScore = evald.length ? Math.round((ok / evald.length) * 100) : null;

    return reply.send({
      dashboard: {
        totalRisks: risks.length,
        highRisks,
        openIncidents,
        pendingPlans,
        legalScore,
        legalByStatus: byStatus,
        upcomingInspections: upcomingInsp,
        upcomingTrainings: trainings,
        unreadAlerts: alerts,
      },
    });
  });

  // ── Vistas read-only por cliente ───────────────────────────────────
  const READ_ONLY: Record<string, { model: string; orderBy: any }> = {
    legal: { model: 'sehLegalRequirement', orderBy: [{ normative: 'asc' }] },
    risks: { model: 'sehRisk', orderBy: [{ riskLevel: 'desc' }] },
    incidents: { model: 'sehIncident', orderBy: [{ createdAt: 'desc' }] },
    inspections: { model: 'sehInspection', orderBy: [{ plannedDate: 'desc' }] },
    trainings: { model: 'sehTraining', orderBy: [{ scheduledDate: 'desc' }] },
    documents: { model: 'sehDocument', orderBy: [{ createdAt: 'desc' }] },
    alerts: { model: 'sehAlert', orderBy: [{ createdAt: 'desc' }] },
    'action-plans': { model: 'sehActionPlan', orderBy: [{ dueDate: 'asc' }] },
  };

  for (const [key, cfg] of Object.entries(READ_ONLY)) {
    app.get(`/seh360/portal/:clientId/${key}`, async (req: any, reply) => {
      const ctx = await getPortalContext(req, reply); if (!ctx) return;
      const { clientId } = req.params as any;
      if (!checkClient(ctx, clientId)) return reply.code(403).send({ error: 'Sin acceso a este cliente' });
      const rows = await prisma[cfg.model].findMany({
        where: { clientId, deletedAt: null },
        orderBy: cfg.orderBy,
        take: 200,
      });
      return reply.send({ items: rows });
    });
  }
};
