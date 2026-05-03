import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireSuperAdmin } from '../middleware/auth.js';

export default async function tenantReportRoutes(app: FastifyInstance) {
  // GET /super-admin/tenants/:id/full-report
  app.get('/super-admin/tenants/:id/full-report', async (req: FastifyRequest, reply: FastifyReply) => {
    requireSuperAdmin(req);
    const { id } = req.params as { id: string };

    try {
      // 1. Información básica del tenant
      const tenant = await app.prisma.tenant.findUnique({
        where: { id },
        include: {
          subscriptions: {
            where: { deletedAt: null },
            orderBy: { startedAt: 'desc' },
            take: 1,
            include: { plan: { select: { id: true, tier: true, name: true } } },
          },
          _count: {
            select: {
              memberships: { where: { deletedAt: null } },
            },
          },
        },
      });

      if (!tenant) return reply.code(404).send({ error: 'Tenant not found' });

      // 2. Counts de entidades principales
      const [
        usersCount,
        employeesCount,
        documentsCount,
        ncrCount,
        risksCount,
        indicatorsCount,
        auditsCount,
        trainingsCount,
        incidentsCount,
        drillsCount,
        meetingsCount,
        objectivesCount,
        stakeholdersCount,
        suppliersCount,
        customersCount,
        projectsCount,
      ] = await Promise.all([
        app.prisma.platformUser.count({ where: { memberships: { some: { tenantId: id, deletedAt: null } } } }),
        app.prisma.employee.count({ where: { tenantId: id, deletedAt: null } }),
        app.prisma.document.count({ where: { tenantId: id, deletedAt: null } }),
        app.prisma.nonConformityReport.count({ where: { tenantId: id, deletedAt: null } }),
        app.prisma.risk.count({ where: { tenantId: id, deletedAt: null } }),
        app.prisma.indicator.count({ where: { tenantId: id, deletedAt: null } }),
        app.prisma.audit.count({ where: { tenantId: id, deletedAt: null } }),
        app.prisma.training.count({ where: { tenantId: id, deletedAt: null } }),
        app.prisma.incident.count({ where: { tenantId: id, deletedAt: null } }),
        app.prisma.drillScenario.count({ where: { tenantId: id, deletedAt: null } }),
        app.prisma.meeting.count({ where: { tenantId: id, deletedAt: null } }),
        app.prisma.objective.count({ where: { tenantId: id, deletedAt: null } }),
        app.prisma.stakeholder.count({ where: { tenantId: id, deletedAt: null } }),
        app.prisma.supplier.count({ where: { tenantId: id, deletedAt: null } }),
        app.prisma.customer.count({ where: { tenantId: id, deletedAt: null } }),
        app.prisma.project.count({ where: { tenantId: id, deletedAt: null } }),
      ]);

      // 3. Historial de auditoría (últimos 200 eventos)
      const auditEvents = await app.prisma.auditEvent.findMany({
        where: { tenantId: id },
        orderBy: { createdAt: 'desc' },
        take: 200,
        select: {
          id: true,
          action: true,
          entityType: true,
          entityId: true,
          actorUserId: true,
          createdAt: true,
          ipAddress: true,
          userAgent: true,
        },
      });

      // 4. Pagos recientes
      const payments = await app.prisma.payment.findMany({
        where: { tenantId: id },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          amount: true,
          currency: true,
          status: true,
          description: true,
          createdAt: true,
          paidAt: true,
        },
      });

      // 5. Logins recientes (últimos 50)
      const logins = await app.prisma.auditEvent.findMany({
        where: { tenantId: id, action: { in: ['LOGIN', 'LOGIN_ATTEMPT', 'LOGOUT'] } },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          action: true,
          actorUserId: true,
          createdAt: true,
          ipAddress: true,
        },
      });

      // 6. Errores / alertas de seguridad
      const securityEvents = await app.prisma.auditEvent.findMany({
        where: {
          tenantId: id,
          action: {
            in: ['SUSPICIOUS_LOGIN_DETECTED', 'SECURITY_ALERT', 'FAILED_LOGIN', 'PERMISSION_DENIED', 'PASSWORD_CHANGED'],
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          action: true,
          actorUserId: true,
          createdAt: true,
          ipAddress: true,
        },
      });

      // 7. Actividad por módulo (últimos 30 días)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const recentActivity = await app.prisma.auditEvent.groupBy({
        by: ['entityType'],
        where: {
          tenantId: id,
          createdAt: { gte: thirtyDaysAgo },
        },
        _count: { _all: true },
        orderBy: { _count: { createdAt: 'desc' } },
      });

      // 8. Timeline de creación (cantidad de entidades creadas por mes en el último año)
      const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
      const monthlyCreations = await app.prisma.auditEvent.groupBy({
        by: ['action'],
        where: {
          tenantId: id,
          createdAt: { gte: oneYearAgo },
          action: { contains: 'CREATED' },
        },
        _count: { _all: true },
      });

      // Generar resumen de actividad
      const totalEntities = usersCount + employeesCount + documentsCount + ncrCount + risksCount +
        indicatorsCount + auditsCount + trainingsCount + incidentsCount + drillsCount +
        meetingsCount + objectivesCount + stakeholdersCount + suppliersCount + customersCount + projectsCount;

      const subscription = tenant.subscriptions[0];

      const report = {
        generatedAt: new Date().toISOString(),
        tenant: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          status: tenant.status,
          createdAt: tenant.createdAt,
          memberCount: tenant._count.memberships,
          plan: subscription?.plan?.name || 'Sin plan',
          planTier: subscription?.plan?.tier || 'N/A',
          subscriptionStatus: subscription?.status || 'N/A',
          subscriptionStarted: subscription?.startedAt || null,
          subscriptionEnds: subscription?.endsAt || null,
        },
        statistics: {
          totalEntities,
          users: usersCount,
          employees: employeesCount,
          documents: documentsCount,
          nonConformities: ncrCount,
          risks: risksCount,
          indicators: indicatorsCount,
          audits: auditsCount,
          trainings: trainingsCount,
          incidents: incidentsCount,
          drills: drillsCount,
          meetings: meetingsCount,
          objectives: objectivesCount,
          stakeholders: stakeholdersCount,
          suppliers: suppliersCount,
          customers: customersCount,
          projects: projectsCount,
        },
        recentActivity: recentActivity.map(a => ({
          module: a.entityType,
          events: a._count._all,
        })),
        monthlyCreations: monthlyCreations.map(m => ({
          action: m.action,
          count: m._count._all,
        })),
        payments: payments.map(p => ({
          id: p.id,
          amount: p.amount,
          currency: p.currency,
          status: p.status,
          description: p.description,
          date: p.createdAt,
          paidAt: p.paidAt,
        })),
        recentLogins: logins.map(l => ({
          action: l.action,
          userId: l.actorUserId,
          date: l.createdAt,
          ip: l.ipAddress,
        })),
        securityEvents: securityEvents.map(s => ({
          action: s.action,
          userId: s.actorUserId,
          date: s.createdAt,
          ip: s.ipAddress,
        })),
        auditHistory: auditEvents.map(e => ({
          id: e.id,
          action: e.action,
          entityType: e.entityType,
          entityId: e.entityId,
          actorUserId: e.actorUserId,
          date: e.createdAt,
          ip: e.ipAddress,
        })),
      };

      return reply.send(report);
    } catch (error: any) {
      app.log.error('Error generating tenant report:', error);
      return reply.code(500).send({ error: 'Failed to generate report', message: error.message });
    }
  });
}
