import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';

export const dashboardRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = (req as any).auth?.tenantId;
      const tenantFilter = tenantId ? { tenantId } : {};
      const now = new Date();
      const in30 = new Date(Date.now() + 30 * 24 * 3600 * 1000);
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const [
        // Documentos
        totalDocuments, effectiveDocuments, draftDocuments,
        // Normativos
        totalNormatives,
        // No Conformidades
        totalNcrs, openNcrs, closedNcrs,
        // Riesgos
        totalRisks,
        // Capacitaciones
        totalTrainings, completedTrainings,
        // Departamentos / personal
        totalDepartments,
        // Indicadores
        totalIndicators,
        // --- Módulos profesionales ---
        // Acciones CAPA
        openActions, overdueActions,
        // Objetivos
        totalObjectives, onTrackObjectives,
        // IPERC
        totalHazards, criticalHazards,
        // Aspectos Ambientales
        totalAspects, significantAspects,
        // Incidentes (mes actual)
        incidentsThisMonth,
        // Proveedores
        approvedSuppliers, pendingSuppliers,
        // Calibraciones vencidas en 30 días
        calibrationsDueSoon,
        // Partes interesadas
        totalStakeholders,
      ] = await Promise.all([
        // Documentos
        app.prisma.document.count({ where: { ...tenantFilter, deletedAt: null } }).catch(() => 0),
        app.prisma.document.count({ where: { ...tenantFilter, deletedAt: null, status: 'EFFECTIVE' } }).catch(() => 0),
        app.prisma.document.count({ where: { ...tenantFilter, deletedAt: null, status: 'DRAFT' } }).catch(() => 0),
        // Normativos
        app.prisma.normativeStandard.count({ where: { ...tenantFilter, deletedAt: null } }).catch(() => 0),
        // NCRs
        app.prisma.nonConformity.count({ where: { ...tenantFilter, deletedAt: null } }).catch(() => 0),
        app.prisma.nonConformity.count({ where: { ...tenantFilter, deletedAt: null, status: 'OPEN' } }).catch(() => 0),
        app.prisma.nonConformity.count({ where: { ...tenantFilter, deletedAt: null, status: 'CLOSED' } }).catch(() => 0),
        // Riesgos
        app.prisma.risk.count({ where: { ...tenantFilter, deletedAt: null } }).catch(() => 0),
        // Capacitaciones
        app.prisma.sgiTraining.count({ where: { ...tenantFilter, deletedAt: null } }).catch(() => 0),
        app.prisma.sgiTraining.count({ where: { ...tenantFilter, deletedAt: null, status: 'COMPLETED' } }).catch(() => 0),
        // Departamentos
        app.prisma.department.count({ where: { ...tenantFilter, deletedAt: null } }).catch(() => 0),
        // Indicadores
        app.prisma.indicator.count({ where: { ...tenantFilter, deletedAt: null } }).catch(() => 0),
        // Acciones abiertas
        app.prisma.actionItem.count({ where: { ...tenantFilter, deletedAt: null, status: { in: ['OPEN', 'IN_PROGRESS'] } } }).catch(() => 0),
        // Acciones vencidas
        app.prisma.actionItem.count({ where: { ...tenantFilter, deletedAt: null, status: { in: ['OPEN', 'IN_PROGRESS'] }, dueDate: { lt: now } } }).catch(() => 0),
        // Objetivos totales
        app.prisma.sgiObjective.count({ where: { ...tenantFilter, deletedAt: null } }).catch(() => 0),
        // Objetivos on-track (status ON_TRACK o COMPLETED)
        app.prisma.sgiObjective.count({ where: { ...tenantFilter, deletedAt: null, status: { in: ['ON_TRACK', 'COMPLETED'] } } }).catch(() => 0),
        // IPERC total
        app.prisma.hazard.count({ where: { ...tenantFilter, deletedAt: null } }).catch(() => 0),
        // IPERC críticos (riskLevel HIGH o CRITICAL)
        app.prisma.hazard.count({ where: { ...tenantFilter, deletedAt: null, riskLevel: { in: ['HIGH', 'CRITICAL'] } } }).catch(() => 0),
        // Aspectos ambientales
        app.prisma.environmentalAspect.count({ where: { ...tenantFilter, deletedAt: null } }).catch(() => 0),
        // Aspectos significativos
        app.prisma.environmentalAspect.count({ where: { ...tenantFilter, deletedAt: null, isSignificant: true } }).catch(() => 0),
        // Incidentes este mes
        app.prisma.incident.count({ where: { ...tenantFilter, deletedAt: null, date: { gte: startOfMonth } } }).catch(() => 0),
        // Proveedores aprobados
        app.prisma.supplier.count({ where: { ...tenantFilter, deletedAt: null, status: 'APPROVED' } }).catch(() => 0),
        // Proveedores pendientes de aprobación
        app.prisma.supplier.count({ where: { ...tenantFilter, deletedAt: null, status: 'PENDING' } }).catch(() => 0),
        // Calibraciones vencen en 30 días
        app.prisma.measuringEquipment.count({ where: { ...tenantFilter, deletedAt: null, status: 'ACTIVE', nextCalibrationDate: { gte: now, lte: in30 } } }).catch(() => 0),
        // Partes interesadas
        app.prisma.stakeholder.count({ where: { ...tenantFilter, deletedAt: null } }).catch(() => 0),
      ]);

      return reply.send({
        dashboard: {
          // Módulos base
          documents: { total: totalDocuments, effective: effectiveDocuments, draft: draftDocuments },
          normatives: { total: totalNormatives, ready: totalNormatives },
          ncrs: { total: totalNcrs, open: openNcrs, closed: closedNcrs },
          risks: { total: totalRisks },
          findings: { total: totalNcrs },
          trainings: { total: totalTrainings, completed: completedTrainings },
          departments: totalDepartments,
          indicators: { total: totalIndicators },
          // Módulos profesionales
          actions: { open: openActions, overdue: overdueActions },
          objectives: { total: totalObjectives, onTrack: onTrackObjectives },
          hazards: { total: totalHazards, critical: criticalHazards },
          aspects: { total: totalAspects, significant: significantAspects },
          incidents: { thisMonth: incidentsThisMonth },
          suppliers: { approved: approvedSuppliers, pending: pendingSuppliers },
          calibrations: { dueSoon: calibrationsDueSoon },
          stakeholders: { total: totalStakeholders },
        },
      });
    } catch (error) {
      app.log.error('Dashboard error:', error);
      return reply.code(500).send({ error: 'Failed to fetch dashboard data' });
    }
  });
};
