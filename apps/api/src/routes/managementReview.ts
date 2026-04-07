import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

// Section templates for each standard
const SECTION_TEMPLATES: Record<string, Array<{ key: string; title: string }>> = {
  ISO_9001: [
    { key: 'audit_results', title: 'Resultados de Auditorías' },
    { key: 'nonconformities', title: 'No Conformidades y Acciones Correctivas' },
    { key: 'customer_feedback', title: 'Retroalimentación del Cliente' },
    { key: 'process_performance', title: 'Desempeño de Procesos' },
    { key: 'improvement_opportunities', title: 'Oportunidades de Mejora' },
    { key: 'risk_management', title: 'Gestión de Riesgos y Oportunidades' },
  ],
  ISO_14001: [
    { key: 'environmental_aspects', title: 'Aspectos Ambientales' },
    { key: 'legal_compliance', title: 'Cumplimiento Legal' },
    { key: 'environmental_objectives', title: 'Objetivos Ambientales' },
    { key: 'emergency_preparedness', title: 'Preparación y Respuesta ante Emergencias' },
  ],
  ISO_45001: [
    { key: 'ohs_audit_results', title: 'Resultados de Auditorías SST' },
    { key: 'incident_investigation', title: 'Investigación de Incidentes y Accidentes' },
    { key: 'risk_assessment', title: 'Evaluación de Riesgos SST' },
    { key: 'ohs_objectives', title: 'Objetivos de SST' },
    { key: 'worker_participation', title: 'Participación y Consulta de los Trabajadores' },
  ],
  ISO_27001: [
    { key: 'risk_treatment', title: 'Tratamiento de Riesgos de Seguridad' },
    { key: 'security_incidents', title: 'Incidentes de Seguridad' },
    { key: 'control_effectiveness', title: 'Efectividad de los Controles' },
    { key: 'compliance_evaluation', title: 'Evaluación de Cumplimiento' },
    { key: 'business_continuity', title: 'Continuidad del Negocio' },
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

  // Audit results for all standards
  if (standards.some(s => SECTION_TEMPLATES[s])) {
    const audits = await tx.audit.findMany({
      where: {
        tenantId,
        actualStartDate: { gte: periodStart },
        actualEndDate: { lte: periodEnd },
        deletedAt: null,
      },
      include: {
        findings: {
          where: { deletedAt: null },
        },
        checklist: {
          orderBy: { order: 'asc' },
        },
      },
    });

    data.audit_results = {
      totalAudits: audits.length,
      completedAudits: audits.filter((a: any) => a.status === 'COMPLETED').length,
      totalFindings: audits.reduce((sum: number, a: any) => sum + a.findings.length, 0),
      openFindings: audits.reduce((sum: number, a: any) => sum + a.findings.filter((f: any) => f.status !== 'CLOSED').length, 0),
      complianceScore: calculateComplianceScore(audits),
      audits: audits.map((a: any) => ({
        id: a.id,
        code: a.code,
        title: a.title,
        type: a.type,
        area: a.area,
        actualStartDate: a.actualStartDate,
        actualEndDate: a.actualEndDate,
        findingsCount: a.findings.length,
        compliancePercentage: calculateAuditCompliance(a.checklist),
      })),
    };
  }

  // Non-conformities (if ISO 9001)
  if (standards.includes('ISO_9001')) {
    const nonconformities = await tx.auditFinding.findMany({
      where: {
        tenantId,
        type: 'NON_CONFORMITY',
        createdAt: { gte: periodStart, lte: periodEnd },
        deletedAt: null,
      },
      include: {
        actions: true,
      },
    });

    data.nonconformities = {
      total: nonconformities.length,
      bySeverity: {
        CRITICAL: nonconformities.filter((f: any) => f.severity === 'CRITICAL').length,
        MAJOR: nonconformities.filter((f: any) => f.severity === 'MAJOR').length,
        MINOR: nonconformities.filter((f: any) => f.severity === 'MINOR').length,
        TRIVIAL: nonconformities.filter((f: any) => f.severity === 'TRIVIAL').length,
      },
      withActions: nonconformities.filter((f: any) => f.actions.length > 0).length,
      closedOnTime: nonconformities.filter((f: any) => 
        f.actions.some((a: any) => a.status === 'COMPLETED' && a.dueDate && new Date(a.dueDate) >= new Date(f.createdAt))
      ).length,
      items: nonconformities.map((nc: any) => ({
        id: nc.id,
        code: nc.code,
        description: nc.description,
        severity: nc.severity,
        status: nc.status,
        area: nc.area,
        createdAt: nc.createdAt,
        actionsCount: nc.actions.length,
      })),
    };
  }

  // Customer feedback placeholder (would integrate with customer complaints module)
  if (standards.includes('ISO_9001')) {
    // Try to get customer feedback from complaints module if it exists
    try {
      const complaints = await tx.auditFinding.findMany({
        where: {
          tenantId,
          type: { in: ['NON_CONFORMITY', 'OBSERVATION'] },
          createdAt: { gte: periodStart, lte: periodEnd },
          deletedAt: null,
          area: { contains: 'cliente' }, // Simple heuristic
        },
      });
      
      data.customer_feedback = {
        totalComplaints: complaints.length,
        resolvedOnTime: complaints.filter((c: any) => 
          c.actions.some((a: any) => a.status === 'COMPLETED' && a.dueDate && new Date(a.dueDate) <= new Date())
        ).length,
        satisfactionScore: 0, // Would come from satisfaction survey module
        trends: [], // Would come from time series data
        items: complaints.map((c: any) => ({
          id: c.id,
          code: c.code,
          description: c.description,
          severity: c.severity,
          status: c.status,
          createdAt: c.createdAt,
        })),
      };
    } catch (error) {
      data.customer_feedback = {
        totalComplaints: 0,
        resolvedOnTime: 0,
        satisfactionScore: 0,
        trends: [],
        items: [],
      };
    }
  }

  // Process performance (KPIs)
  if (standards.includes('ISO_9001')) {
    try {
      // Get indicators data
      const indicators = await tx.indicatorMeasurement.findMany({
        where: {
          indicator: { tenantId },
          measuredAt: { gte: periodStart, lte: periodEnd },
        },
        include: {
          indicator: true,
        },
      });

      const indicatorsGrouped = indicators.reduce((acc: any, measurement: any) => {
        const key = measurement.indicator.id;
        if (!acc[key]) {
          acc[key] = {
            name: measurement.indicator.name,
            code: measurement.indicator.code,
            unit: measurement.indicator.unit,
            measurements: [],
            target: measurement.indicator.targetValue,
          };
        }
        acc[key].measurements.push({
          value: measurement.value,
          date: measurement.measuredAt,
        });
        return acc;
      }, {} as any);

      const kpis = Object.values(indicatorsGrouped).map((kpi: any) => {
        const avgValue = kpi.measurements.reduce((sum: number, m: any) => sum + m.value, 0) / kpi.measurements.length;
        const onTarget = kpi.target ? avgValue >= kpi.target : false;
        const trend = kpi.measurements.length > 1 ? 
          (kpi.measurements[kpi.measurements.length - 1].value > kpi.measurements[0].value ? 'UP' : 'DOWN') : 'STABLE';
        
        return {
          name: kpi.name,
          code: kpi.code,
          unit: kpi.unit,
          averageValue: avgValue,
          target: kpi.target,
          onTarget,
          trend,
          measurements: kpi.measurements.length,
        };
      });

      data.process_performance = {
        kpis,
        overallScore: kpis.length > 0 ? Math.round((kpis.filter(k => k.onTarget).length / kpis.length) * 100) : 0,
        trends: kpis.map(k => ({ name: k.name, trend: k.trend, score: k.onTarget ? 100 : 0 })),
      };
    } catch (error) {
      data.process_performance = {
        kpis: [],
        overallScore: 0,
        trends: [],
      };
    }
  }

  // Environmental aspects (ISO 14001)
  if (standards.includes('ISO_14001')) {
    try {
      // Try to get environmental data from risks module
      const environmentalRisks = await tx.risk.findMany({
        where: {
          tenantId,
          category: { contains: 'ambiental' },
          createdAt: { gte: periodStart, lte: periodEnd },
          deletedAt: null,
        },
      });

      data.environmental_aspects = {
        significantAspects: environmentalRisks.map((r: any) => ({
          id: r.id,
          title: r.title,
          impact: r.impact,
          probability: r.probability,
          riskLevel: r.riskLevel,
        })),
        complianceStatus: environmentalRisks.length > 0 ? 'MONITORING' : 'COMPLIANT',
        improvements: environmentalRisks.filter((r: any) => r.status === 'OPEN').length,
        totalRisks: environmentalRisks.length,
      };
    } catch (error) {
      data.environmental_aspects = {
        significantAspects: [],
        complianceStatus: 'COMPLIANT',
        improvements: 0,
        totalRisks: 0,
      };
    }
  }

  // OHS incidents (ISO 45001)
  if (standards.includes('ISO_45001')) {
    try {
      // Try to get OHS incidents from findings
      const ohsIncidents = await tx.auditFinding.findMany({
        where: {
          tenantId,
          type: 'NON_CONFORMITY',
          area: { contains: 'seguridad' },
          createdAt: { gte: periodStart, lte: periodEnd },
          deletedAt: null,
        },
      });

      data.ohs_incidents = {
        totalIncidents: ohsIncidents.length,
        lostTimeInjuries: ohsIncidents.filter((i: any) => i.severity === 'CRITICAL').length,
        nearMisses: ohsIncidents.filter((i: any) => i.type === 'OBSERVATION').length,
        trend: ohsIncidents.length > 0 ? 'MONITORING' : 'STABLE',
        items: ohsIncidents.map((i: any) => ({
          id: i.id,
          code: i.code,
          description: i.description,
          severity: i.severity,
          createdAt: i.createdAt,
        })),
      };
    } catch (error) {
      data.ohs_incidents = {
        totalIncidents: 0,
        lostTimeInjuries: 0,
        nearMisses: 0,
        trend: 'STABLE',
        items: [],
      };
    }
  }

  // Security incidents (ISO 27001)
  if (standards.includes('ISO_27001')) {
    try {
      // Try to get security incidents from findings
      const securityIncidents = await tx.auditFinding.findMany({
        where: {
          tenantId,
          type: 'NON_CONFORMITY',
          area: { contains: 'información' },
          createdAt: { gte: periodStart, lte: periodEnd },
          deletedAt: null,
        },
      });

      data.security_incidents = {
        totalIncidents: securityIncidents.length,
        highRiskIncidents: securityIncidents.filter((i: any) => i.severity === 'CRITICAL' || i.severity === 'MAJOR').length,
        resolvedIncidents: securityIncidents.filter((i: any) => i.status === 'CLOSED').length,
        averageResolutionTime: 0, // Would calculate from action dates
        items: securityIncidents.map((i: any) => ({
          id: i.id,
          code: i.code,
          description: i.description,
          severity: i.severity,
          status: i.status,
          createdAt: i.createdAt,
        })),
      };
    } catch (error) {
      data.security_incidents = {
        totalIncidents: 0,
        highRiskIncidents: 0,
        resolvedIncidents: 0,
        averageResolutionTime: 0,
        items: [],
      };
    }
  }

  // Training data (for all standards)
  if (standards.length > 0) {
    try {
      const trainings = await tx.training.findMany({
        where: {
          tenantId,
          scheduledDate: { gte: periodStart, lte: periodEnd },
          deletedAt: null,
        },
        include: {
          attendees: true,
        },
      });

      data.training_summary = {
        totalTrainings: trainings.length,
        completedTrainings: trainings.filter((t: any) => t.status === 'COMPLETED').length,
        scheduledTrainings: trainings.filter((t: any) => t.status === 'SCHEDULED').length,
        totalHours: trainings.reduce((sum: number, t: any) => sum + (t.durationHours || 0), 0),
        totalAttendees: trainings.reduce((sum: number, t: any) => sum + t.attendees.length, 0),
        byCategory: trainings.reduce((acc: any, t: any) => {
          acc[t.category] = (acc[t.category] || 0) + 1;
          return acc;
        }, {}),
        items: trainings.map((t: any) => ({
          id: t.id,
          code: t.code,
          title: t.title,
          category: t.category,
          status: t.status,
          durationHours: t.durationHours,
          attendeesCount: t.attendees.length,
          scheduledDate: t.scheduledDate,
        })),
      };
    } catch (error) {
      data.training_summary = {
        totalTrainings: 0,
        completedTrainings: 0,
        scheduledTrainings: 0,
        totalHours: 0,
        totalAttendees: 0,
        byCategory: {},
        items: [],
      };
    }
  }

  return data;
}

function calculateComplianceScore(audits: any[]): number {
  if (audits.length === 0) return 0;
  
  let totalItems = 0;
  let compliantItems = 0;
  
  audits.forEach(audit => {
    audit.checklist.forEach((item: any) => {
      if (item.response && item.response !== 'NOT_APPLICABLE') {
        totalItems++;
        if (item.response === 'COMPLIES') {
          compliantItems++;
        }
      }
    });
  });
  
  return totalItems > 0 ? Math.round((compliantItems / totalItems) * 100) : 0;
}

function calculateAuditCompliance(checklist: any[]): number {
  if (checklist.length === 0) return 0;
  
  const answered = checklist.filter(item => item.response && item.response !== 'NOT_APPLICABLE');
  if (answered.length === 0) return 0;
  
  const compliant = answered.filter(item => item.response === 'COMPLIES');
  return Math.round((compliant.length / answered.length) * 100);
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

      const review = await app.runWithDbContext(req, async (tx) => {
        // Create the review
        const newReview = await tx.managementReview.create({
          data: {
            tenantId,
            title,
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

        // Update sections with system data
        for (const section of existing.sections) {
          const data = systemData[section.key] || null;
          await tx.managementReviewSection.update({
            where: { id: section.id },
            data: { systemData: data },
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
}
