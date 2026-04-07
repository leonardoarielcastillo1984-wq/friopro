import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';

export const dashboardRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = (req as any).auth?.tenantId;
      const tenantFilter = tenantId ? { tenantId } : {};

      const [
        totalDocuments,
        effectiveDocuments,
        draftDocuments,
        totalNormatives,
        totalNcrs,
        openNcrs,
        closedNcrs,
        totalRisks,
        totalTrainings,
        completedTrainings,
        totalDepartments,
        totalIndicators,
      ] = await Promise.all([
        app.prisma.document.count({ where: { ...tenantFilter, deletedAt: null } }).catch(() => 0),
        app.prisma.document.count({ where: { ...tenantFilter, deletedAt: null, status: 'EFFECTIVE' } }).catch(() => 0),
        app.prisma.document.count({ where: { ...tenantFilter, deletedAt: null, status: 'DRAFT' } }).catch(() => 0),
        app.prisma.normativeStandard.count({ where: { ...tenantFilter } }).catch(() => 0),
        app.prisma.nonConformity.count({ where: { ...tenantFilter } }).catch(() => 0),
        app.prisma.nonConformity.count({ where: { ...tenantFilter, status: 'OPEN' } }).catch(() => 0),
        app.prisma.nonConformity.count({ where: { ...tenantFilter, status: 'CLOSED' } }).catch(() => 0),
        app.prisma.risk.count({ where: { ...tenantFilter } }).catch(() => 0),
        app.prisma.sgiTraining.count({ where: { ...tenantFilter } }).catch(() => 0),
        app.prisma.sgiTraining.count({ where: { ...tenantFilter, status: 'COMPLETED' } }).catch(() => 0),
        app.prisma.department.count({ where: { ...tenantFilter } }).catch(() => 0),
        app.prisma.indicator.count({ where: { ...tenantFilter } }).catch(() => 0),
      ]);

      return reply.send({
        dashboard: {
          documents: { total: totalDocuments, effective: effectiveDocuments, draft: draftDocuments },
          normatives: { total: totalNormatives, ready: totalNormatives },
          ncrs: { total: totalNcrs, open: openNcrs, closed: closedNcrs },
          risks: { total: totalRisks },
          findings: { total: totalNcrs },
          trainings: { total: totalTrainings, completed: completedTrainings },
          departments: totalDepartments,
          indicators: { total: totalIndicators },
        },
      });
    } catch (error) {
      app.log.error('Dashboard error:', error);
      return reply.code(500).send({ error: 'Failed to fetch dashboard data' });
    }
  });
};
