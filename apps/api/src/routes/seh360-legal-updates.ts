import { FastifyInstance } from 'fastify';

const tid = (req: any) => req.sehAuth?.tenantId;

/**
 * Novedades legales SEH:
 * GET /seh360/legal-updates?clientId=&days=90
 *  → items nuevos de LegalLibrary (últimos N días) marcando cuáles ya están
 *    en la matriz del cliente + requisitos cuya nextReview está próxima/vencida.
 */
export const registerSeh360LegalUpdatesRoutes = async (app: FastifyInstance) => {

  app.get('/seh360/legal-updates', async (req: any, reply) => {
    if (!req.sehAuth) return reply.code(401).send({ error: 'No autorizado' });
    const t = tid(req); if (!t) return reply.code(400).send({ error: 'Tenant required' });
    const prisma = (app as any).prisma;
    const { clientId, country } = req.query as any;
    const days = Math.min(Number((req.query as any).days) || 90, 365);
    const since = new Date(Date.now() - days * 86400000);

    // Nuevas normas en la biblioteca compartida
    const libWhere: any = { isActive: true, createdAt: { gte: since } };
    if (country) libWhere.country = country;
    const newLibraryItems = await prisma.legalLibrary.findMany({ where: libWhere, orderBy: { createdAt: 'desc' } });

    // Cuáles ya están en la matriz del cliente (dedupe por source+title)
    let alreadyImported = new Set<string>();
    if (clientId) {
      const mine = await prisma.sehLegalRequirement.findMany({
        where: { tenantId: t, clientId, deletedAt: null },
        select: { normative: true, description: true },
      });
      alreadyImported = new Set(mine.map((m: any) => `${m.normative}`));
    }

    // Requisitos con revisión próxima o vencida (próximos 60 días)
    const in60 = new Date(Date.now() + 60 * 86400000);
    const revWhere: any = { tenantId: t, deletedAt: null, nextReview: { lte: in60 } };
    if (clientId) revWhere.clientId = clientId;
    const dueReviews = await prisma.sehLegalRequirement.findMany({
      where: revWhere,
      orderBy: { nextReview: 'asc' },
      take: 100,
      select: { id: true, clientId: true, normative: true, description: true, status: true, nextReview: true, responsible: true },
    });

    const now = Date.now();
    const reviews = dueReviews.map((r: any) => ({
      ...r,
      overdue: r.nextReview && new Date(r.nextReview).getTime() < now,
      daysUntil: r.nextReview ? Math.ceil((new Date(r.nextReview).getTime() - now) / 86400000) : null,
    }));

    return reply.send({
      updates: {
        newLibraryItems: newLibraryItems.map((i: any) => ({ ...i, alreadyInMatrix: alreadyImported.has(i.source) })),
        dueReviews: reviews,
        overdueCount: reviews.filter((r: any) => r.overdue).length,
      },
    });
  });
};
