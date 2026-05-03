import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

function requireSuperAdmin(req: FastifyRequest) {
  if (!(req as any).auth?.globalRole || (req as any).auth.globalRole !== 'SUPER_ADMIN') {
    const err: any = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }
}

export default async function tenantReportRoutes(app: FastifyInstance) {
  // GET /super-admin/tenants/:id/full-report
  app.get('/super-admin/tenants/:id/full-report', async (req: FastifyRequest, reply: FastifyReply) => {
    requireSuperAdmin(req);
    const { id } = req.params as { id: string };

    try {
      app.log.info(`[REPORT] Starting report for tenant ${id}`);
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
      app.log.info(`[REPORT] Step 1 done`);

      // 2. Counts de entidades principales
      app.log.info('[REPORT] Step 2a: usersCount');
      const usersCount = await app.prisma.platformUser.count({ where: { memberships: { some: { tenantId: id, deletedAt: null } } } });
      app.log.info('[REPORT] Step 2b: employeesCount');
      const employeesCount = await app.prisma.employee.count({ where: { tenantId: id, deletedAt: null } });
      app.log.info('[REPORT] Step 2c: documentsCount');
      const documentsCount = await app.prisma.document.count({ where: { tenantId: id, deletedAt: null } });
      app.log.info('[REPORT] Step 2d: ncrCount');
      const ncrCount = await app.prisma.nonConformity.count({ where: { tenantId: id, deletedAt: null } });
      app.log.info('[REPORT] Step 2e: risksCount');
      const risksCount = await app.prisma.risk.count({ where: { tenantId: id, deletedAt: null } });
      app.log.info('[REPORT] Step 2f: indicatorsCount');
      const indicatorsCount = await app.prisma.indicator.count({ where: { tenantId: id, deletedAt: null } });
      app.log.info('[REPORT] Step 2g: auditsCount');
      const auditsCount = await app.prisma.audit.count({ where: { tenantId: id, deletedAt: null } });
      app.log.info('[REPORT] Step 2h: trainingsCount');
      const trainingsCount = await app.prisma.training.count({ where: { tenantId: id, deletedAt: null } });
      app.log.info('[REPORT] Step 2i: incidentsCount');
      const incidentsCount = await app.prisma.incident.count({ where: { tenantId: id, deletedAt: null } });
      app.log.info('[REPORT] Step 2j: drillsCount');
      const drillsCount = await app.prisma.drillScenario.count({ where: { tenantId: id, deletedAt: null } });
      const meetingsCount = 0;
      app.log.info('[REPORT] Step 2k: objectivesCount');
      const objectivesCount = await app.prisma.sgiObjective.count({ where: { tenantId: id, deletedAt: null } });
      app.log.info('[REPORT] Step 2l: stakeholdersCount');
      const stakeholdersCount = await app.prisma.stakeholder.count({ where: { tenantId: id, deletedAt: null } });
      app.log.info('[REPORT] Step 2m: suppliersCount');
      const suppliersCount = await app.prisma.supplier.count({ where: { tenantId: id, deletedAt: null } });
      app.log.info('[REPORT] Step 2n: customersCount');
      const customersCount = await app.prisma.customer.count({ where: { tenantId: id, deletedAt: null } });
      const projectsCount = 0;

      app.log.info(`[REPORT] Step 2 done`);

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
        },
      });

      app.log.info(`[REPORT] Step 3 done`);
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
          notes: true,
          createdAt: true,
          paidAt: true,
        },
      });

      app.log.info(`[REPORT] Step 4 done`);
      // 5. Logins recientes (últimos 50)
      const logins = await app.prisma.auditEvent.findMany({
        where: { tenantId: id, action: { in: ['LOGIN', 'LOGIN_ATTEMPT', 'LOGOUT'] } },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          action: true,
          actorUserId: true,
          createdAt: true,
        },
      });

      app.log.info(`[REPORT] Step 5 done`);
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
        },
      });

      app.log.info(`[REPORT] Step 6 done`);
      // 7. Actividad por módulo (últimos 30 días)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const recentActivity = await (app.prisma.auditEvent as any).groupBy({
        by: ['entityType'],
        where: {
          tenantId: id,
          createdAt: { gte: thirtyDaysAgo },
        },
        _count: { _all: true },
        orderBy: [{ _count: { entityType: 'desc' } }],
      }) as Array<{ entityType: string | null; _count: { _all: number } }>;

      app.log.info(`[REPORT] Step 7 done`);
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

      app.log.info(`[REPORT] Step 8 done`);
      // 9. TRAZABILIDAD DE DOCUMENTOS (últimos 30 días)
      const docDeletedEvents = await app.prisma.auditEvent.findMany({
        where: {
          tenantId: id,
          entityType: 'Document',
          action: 'DELETED',
          createdAt: { gte: thirtyDaysAgo },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          action: true,
          entityId: true,
          actorUserId: true,
          createdAt: true,
          metadata: true,
        },
      });

      const docUpdatedEvents = await app.prisma.auditEvent.findMany({
        where: {
          tenantId: id,
          entityType: 'Document',
          action: 'UPDATED',
          createdAt: { gte: thirtyDaysAgo },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          action: true,
          entityId: true,
          actorUserId: true,
          createdAt: true,
          metadata: true,
        },
      });

      const docVersionEvents = await app.prisma.documentVersion.findMany({
        where: {
          document: { tenantId: id },
          createdAt: { gte: thirtyDaysAgo },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          documentId: true,
          version: true,
          createdAt: true,
        },
      });

      const docStatusEvents = await app.prisma.auditEvent.findMany({
        where: {
          tenantId: id,
          entityType: 'Document',
          action: { in: ['STATUS_CHANGED', 'APPROVED', 'REJECTED', 'PUBLISHED', 'REVIEWED'] },
          createdAt: { gte: thirtyDaysAgo },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          action: true,
          entityId: true,
          actorUserId: true,
          createdAt: true,
          metadata: true,
        },
      });

      const docDownloadEvents = await app.prisma.auditEvent.findMany({
        where: {
          tenantId: id,
          entityType: 'Document',
          action: 'DOWNLOADED',
          createdAt: { gte: thirtyDaysAgo },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          action: true,
          entityId: true,
          actorUserId: true,
          createdAt: true,
        },
      });

      app.log.info(`[REPORT] Step 9 done`);
      // 10. SEGURIDAD Y ACCESOS
      const permissionEvents = await app.prisma.auditEvent.findMany({
        where: {
          tenantId: id,
          action: { contains: 'PERMISSION' },
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
        select: {
          action: true,
          entityType: true,
          entityId: true,
          actorUserId: true,
          createdAt: true,
          metadata: true,
        },
      });

      const userCreatedEvents = await app.prisma.auditEvent.findMany({
        where: {
          tenantId: id,
          action: 'CREATED',
          entityType: { in: ['User', 'PlatformUser', 'Employee'] },
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
        select: {
          action: true,
          entityType: true,
          entityId: true,
          actorUserId: true,
          createdAt: true,
        },
      });

      const userDeletedEvents = await app.prisma.auditEvent.findMany({
        where: {
          tenantId: id,
          action: 'DELETED',
          entityType: { in: ['User', 'PlatformUser', 'Employee'] },
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
        select: {
          action: true,
          entityType: true,
          entityId: true,
          actorUserId: true,
          createdAt: true,
        },
      });

      const roleChangeEvents = await app.prisma.auditEvent.findMany({
        where: {
          tenantId: id,
          action: { contains: 'ROLE' },
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
        select: {
          action: true,
          entityType: true,
          entityId: true,
          actorUserId: true,
          createdAt: true,
          metadata: true,
        },
      });

      app.log.info(`[REPORT] Step 10 done`);
      // 11. EVENTOS CRÍTICOS DEL SISTEMA
      const bulkDeleteEvents = await app.prisma.auditEvent.findMany({
        where: {
          tenantId: id,
          action: 'BULK_DELETE',
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
        select: {
          action: true,
          entityType: true,
          entityId: true,
          actorUserId: true,
          createdAt: true,
          metadata: true,
        },
      });

      const exportEvents = await app.prisma.auditEvent.findMany({
        where: {
          tenantId: id,
          action: { contains: 'EXPORT' },
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
        select: {
          action: true,
          entityType: true,
          entityId: true,
          actorUserId: true,
          createdAt: true,
          metadata: true,
        },
      });

      const sensitiveDownloadEvents = await app.prisma.auditEvent.findMany({
        where: {
          tenantId: id,
          action: 'DOWNLOADED',
          entityType: { in: ['Document', 'NonConformityReport', 'Audit', 'Report'] },
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
        select: {
          action: true,
          entityType: true,
          entityId: true,
          actorUserId: true,
          createdAt: true,
        },
      });

      const tenantConfigEvents = await app.prisma.auditEvent.findMany({
        where: {
          tenantId: id,
          entityType: 'Tenant',
          action: 'UPDATED',
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
        select: {
          action: true,
          entityId: true,
          actorUserId: true,
          createdAt: true,
          metadata: true,
        },
      });

      const licenseAccessAttempts = await app.prisma.licenseAccessAttempt.findMany({
        where: {
          tenantId: id,
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
        select: {
          id: true,
          module: true,
          userId: true,
          path: true,
          createdAt: true,
        },
      });

      app.log.info(`[REPORT] Step 11 done`);
      // 12. USO DEL SISTEMA (ANALÍTICA)
      const activeUserIds = await app.prisma.auditEvent.groupBy({
        by: ['actorUserId'],
        where: {
          tenantId: id,
          action: { in: ['LOGIN', 'LOGIN_ATTEMPT'] },
          createdAt: { gte: thirtyDaysAgo },
        },
        _count: { _all: true },
      });
      const activeUsersLast30d = activeUserIds.filter(u => u.actorUserId !== null).length;

      const moduleUsageRankingRaw = await (app.prisma.auditEvent as any).groupBy({
        by: ['entityType'],
        where: {
          tenantId: id,
          createdAt: { gte: thirtyDaysAgo },
        },
        _count: { _all: true },
        orderBy: [{ _count: { entityType: 'desc' } }],
        take: 25,
      }) as Array<{ entityType: string | null; _count: { _all: number } }>;
      const moduleUsageRanking = moduleUsageRankingRaw.filter(m => m.entityType !== null).slice(0, 20);

      const allModules = [
        'Document', 'Employee', 'Risk', 'Audit', 'Training', 'Incident',
        'Meeting', 'Objective', 'Stakeholder', 'Supplier', 'Customer',
        'Project', 'NonConformityReport', 'Indicator', 'DrillScenario',
        'MaintenanceAsset', 'WorkOrder', 'ProcessMap', 'ActionItem',
        'Competency', 'Position', 'Department', 'Survey', 'EvaluationForm',
        'LicenseAccessAttempt',
      ];
      const usedModules = new Set(moduleUsageRanking.map(m => m.entityType));
      const unusedModules = allModules.filter(m => !usedModules.has(m));

      app.log.info(`[REPORT] Step 12 done`);
      // 13. USO DE IA
      const aiFindingsCount = await app.prisma.aiFinding.count({
        where: {
          tenantId: id,
          createdAt: { gte: thirtyDaysAgo },
        },
      });

      const aiUsageByType = await app.prisma.aiFinding.groupBy({
        by: ['auditType'],
        where: {
          tenantId: id,
          createdAt: { gte: thirtyDaysAgo },
        },
        _count: true,
      });

      app.log.info(`[REPORT] Step 13 done`);
      // 14. ELIMINACIÓN DE REGISTROS
      const deletionsByEntity = await (app.prisma.auditEvent as any).groupBy({
        by: ['entityType'],
        where: {
          tenantId: id,
          action: 'DELETED',
          createdAt: { gte: oneYearAgo },
        },
        _count: { _all: true },
        orderBy: [{ _count: { entityType: 'desc' } }],
      }) as Array<{ entityType: string | null; _count: { _all: number } }>;

      const recentDeletions = await app.prisma.auditEvent.findMany({
        where: {
          tenantId: id,
          action: 'DELETED',
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          action: true,
          entityType: true,
          entityId: true,
          actorUserId: true,
          createdAt: true,
          metadata: true,
        },
      });

      app.log.info(`[REPORT] Step 14 done`);
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
          notes: p.notes,
          date: p.createdAt,
          paidAt: p.paidAt,
        })),
        recentLogins: logins.map(l => ({
          action: l.action,
          userId: l.actorUserId,
          date: l.createdAt,
        })),
        securityEvents: securityEvents.map(s => ({
          action: s.action,
          userId: s.actorUserId,
          date: s.createdAt,
        })),
        auditHistory: auditEvents.map(e => ({
          id: e.id,
          action: e.action,
          entityType: e.entityType,
          entityId: e.entityId,
          actorUserId: e.actorUserId,
          date: e.createdAt,
        })),
        documentTraceability: {
          deletedDocuments: docDeletedEvents.map(e => ({ id: e.id, entityId: e.entityId, actorUserId: e.actorUserId, date: e.createdAt, metadata: e.metadata })),
          modifiedDocuments: docUpdatedEvents.map(e => ({ id: e.id, entityId: e.entityId, actorUserId: e.actorUserId, date: e.createdAt, metadata: e.metadata })),
          createdVersions: docVersionEvents.map(v => ({ id: v.id, documentId: v.documentId, version: v.version, date: v.createdAt })),
          statusChanges: docStatusEvents.map(e => ({ id: e.id, entityId: e.entityId, action: e.action, actorUserId: e.actorUserId, date: e.createdAt, metadata: e.metadata })),
          documentDownloads: docDownloadEvents.map(e => ({ id: e.id, entityId: e.entityId, actorUserId: e.actorUserId, date: e.createdAt })),
        },
        securityAccess: {
          permissionChanges: permissionEvents.map(e => ({ action: e.action, entityType: e.entityType, entityId: e.entityId, actorUserId: e.actorUserId, date: e.createdAt, metadata: e.metadata })),
          userCreations: userCreatedEvents.map(e => ({ entityType: e.entityType, entityId: e.entityId, actorUserId: e.actorUserId, date: e.createdAt })),
          userDeletions: userDeletedEvents.map(e => ({ entityType: e.entityType, entityId: e.entityId, actorUserId: e.actorUserId, date: e.createdAt })),
          roleChanges: roleChangeEvents.map(e => ({ action: e.action, entityType: e.entityType, entityId: e.entityId, actorUserId: e.actorUserId, date: e.createdAt, metadata: e.metadata })),
        },
        criticalEvents: {
          bulkDeletions: bulkDeleteEvents.map(e => ({ action: e.action, entityType: e.entityType, entityId: e.entityId, actorUserId: e.actorUserId, date: e.createdAt, metadata: e.metadata })),
          dataExports: exportEvents.map(e => ({ action: e.action, entityType: e.entityType, entityId: e.entityId, actorUserId: e.actorUserId, date: e.createdAt, metadata: e.metadata })),
          sensitiveDownloads: sensitiveDownloadEvents.map(e => ({ entityType: e.entityType, entityId: e.entityId, actorUserId: e.actorUserId, date: e.createdAt })),
          tenantConfigChanges: tenantConfigEvents.map(e => ({ entityId: e.entityId, actorUserId: e.actorUserId, date: e.createdAt, metadata: e.metadata })),
          licenseAccessAttempts: licenseAccessAttempts.map(a => ({ id: a.id, module: a.module, userId: a.userId, path: a.path, date: a.createdAt })),
        },
        systemUsage: {
          activeUsersLast30d,
          inactiveUsers: usersCount - activeUsersLast30d,
          moduleUsageRanking: moduleUsageRanking.map(m => ({ module: m.entityType, events: m._count._all })),
          unusedModules,
        },
        aiUsage: {
          totalAiFindingsLast30d: aiFindingsCount,
          aiUsageByType: aiUsageByType.map(m => ({ type: m.auditType, count: (m as any)._count?._all })),
        },
        recordDeletions: {
          deletionsByEntity: deletionsByEntity.map(d => ({ entityType: d.entityType, count: d._count._all })),
          recentDeletions: recentDeletions.map(e => ({ entityType: e.entityType, entityId: e.entityId, actorUserId: e.actorUserId, date: e.createdAt, metadata: e.metadata })),
        },
      };

      return reply.send(report);
    } catch (error: any) {
      app.log.error({ err: error, msg: 'Error generating tenant report', stack: error?.stack, detail: error?.message });
      return reply.code(500).send({ error: 'Failed to generate report', message: error.message });
    }
  });
}
