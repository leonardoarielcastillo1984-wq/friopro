/**
 * Rutas dedicadas para Simulacros / Planes de Contingencia / Recursos de Emergencia (ISO 14001/45001).
 */
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { createLLMProvider } from '../services/llm/factory.js';

function parseBody(req: FastifyRequest): any {
  let body = req.body as any;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return null; }
  }
  return body;
}

function stripNulls(data: any) {
  Object.keys(data).forEach((k) => {
    if (data[k] === '' || data[k] === undefined) data[k] = null;
  });
}

function parseDates(data: any) {
  for (const k of Object.keys(data)) {
    if (/Date$|At$/.test(k) && typeof data[k] === 'string' && data[k]) {
      data[k] = new Date(data[k]);
    }
  }
}

function isValidUUID(v: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(v);
}

export const emergencyRoutes: FastifyPluginAsync = async (app) => {
  const tenantId = (req: FastifyRequest) => (req as any).db?.tenantId;

  // ========== DRILLS ==========
  app.get('/drills', async (req: FastifyRequest, reply: FastifyReply) => {
    const tId = tenantId(req);
    if (!tId) return reply.code(400).send({ error: 'Tenant context required' });
    const query = req.query as Record<string, string>;
    const where: any = { tenantId: tId, deletedAt: null };
    if (query.status) where.status = query.status;
    if (query.type) where.type = query.type;
    if (query.severity) where.severity = query.severity;

    const items = await app.runWithDbContext(req, async (tx: any) => {
      return tx.drillScenario.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          responsible: { select: { id: true, firstName: true, lastName: true } },
          risk: { select: { id: true, code: true } },
          environmentalAspect: { select: { id: true, code: true } },
          drillResults: { orderBy: { createdAt: 'desc' }, take: 1 },
          drillActions: true,
          participants: { include: { employee: { select: { id: true, firstName: true, lastName: true } } } },
          _count: { select: { drillResults: true, drillActions: true, participants: true, nonConformities: true } },
        },
      });
    });
    return reply.send({ drills: items });
  });

  app.get('/drills/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tId = tenantId(req);
    if (!tId) return reply.code(400).send({ error: 'Tenant context required' });
    const { id } = req.params as { id: string };
    const item = await app.runWithDbContext(req, async (tx: any) => {
      return tx.drillScenario.findFirst({
        where: { id, tenantId: tId, deletedAt: null },
        include: {
          responsible: { select: { id: true, firstName: true, lastName: true } },
          risk: { select: { id: true, code: true, hazard: true, risk: true } },
          environmentalAspect: { select: { id: true, code: true, aspect: true } },
          drillResults: { orderBy: { createdAt: 'desc' } },
          drillActions: { orderBy: { createdAt: 'desc' } },
          participants: { include: { employee: { select: { id: true, firstName: true, lastName: true } } } },
          nonConformities: { orderBy: { createdAt: 'desc' }, take: 5 },
        },
      });
    });
    if (!item) return reply.code(404).send({ error: 'Not found' });
    return reply.send(item);
  });

  app.post('/drills', async (req: FastifyRequest, reply: FastifyReply) => {
    const tId = tenantId(req);
    if (!tId) return reply.code(400).send({ error: 'Tenant context required' });
    let body = parseBody(req);
    if (!body) return reply.code(400).send({ error: 'Invalid body' });
    stripNulls(body);
    parseDates(body);

    const created = await app.runWithDbContext(req, async (tx: any) => {
      return tx.drillScenario.create({
        data: {
          tenantId: tId,
          name: body.name,
          description: body.description,
          type: body.type || 'OTHER',
          severity: body.severity || 'MEDIUM',
          category: body.category || 'NATURAL_DISASTER',
          status: body.status || 'PLANNED',
          scheduledDate: body.scheduledDate,
          executionDate: body.executionDate,
          responsibleId: body.responsibleId,
          riskId: body.riskId,
          environmentalAspectId: body.environmentalAspectId,
          objectives: body.objectives ?? [],
          scope: body.scope ?? {},
          schedule: body.schedule ?? {},
          coordinator: body.coordinator ?? {},
          evaluators: body.evaluators ?? [],
          resources: body.resources ?? {},
          procedures: body.procedures ?? [],
          evaluationCriteria: body.evaluationCriteria ?? [],
          createdById: (req as any).auth?.userId,
        },
      });
    });
    return reply.code(201).send(created);
  });

  app.put('/drills/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tId = tenantId(req);
    if (!tId) return reply.code(400).send({ error: 'Tenant context required' });
    const { id } = req.params as { id: string };
    let body = parseBody(req);
    if (!body) return reply.code(400).send({ error: 'Invalid body' });
    stripNulls(body);
    parseDates(body);

    const existing = await app.runWithDbContext(req, async (tx: any) => {
      return tx.drillScenario.findFirst({ where: { id, tenantId: tId, deletedAt: null } });
    });
    if (!existing) return reply.code(404).send({ error: 'Not found' });

    const data: any = {};
    ['name','description','type','severity','category','status','scheduledDate','executionDate','responsibleId','riskId','environmentalAspectId','objectives','scope','schedule','coordinator','evaluators','resources','procedures','evaluationCriteria'].forEach((k) => {
      if (body[k] !== undefined) data[k] = body[k];
    });

    const updated = await app.runWithDbContext(req, async (tx: any) => {
      return tx.drillScenario.update({ where: { id }, data });
    });
    return reply.send(updated);
  });

  app.delete('/drills/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tId = tenantId(req);
    if (!tId) return reply.code(400).send({ error: 'Tenant context required' });
    const { id } = req.params as { id: string };
    const existing = await app.runWithDbContext(req, async (tx: any) => {
      return tx.drillScenario.findFirst({ where: { id, tenantId: tId, deletedAt: null } });
    });
    if (!existing) return reply.code(404).send({ error: 'Not found' });
    await app.runWithDbContext(req, async (tx: any) => {
      return tx.drillScenario.update({ where: { id }, data: { deletedAt: new Date() } });
    });
    return reply.code(204).send();
  });

  app.post('/drills/:id/start', async (req: FastifyRequest, reply: FastifyReply) => {
    const tId = tenantId(req);
    if (!tId) return reply.code(400).send({ error: 'Tenant context required' });
    const { id } = req.params as { id: string };
    const updated = await app.runWithDbContext(req, async (tx: any) => {
      return tx.drillScenario.update({ where: { id }, data: { status: 'IN_PROGRESS', startedAt: new Date() } });
    });
    return reply.send({ success: true, drill: updated });
  });

  app.post('/drills/:id/complete', async (req: FastifyRequest, reply: FastifyReply) => {
    const tId = tenantId(req);
    if (!tId) return reply.code(400).send({ error: 'Tenant context required' });
    const { id } = req.params as { id: string };
    const updated = await app.runWithDbContext(req, async (tx: any) => {
      return tx.drillScenario.update({ where: { id }, data: { status: 'COMPLETED', completedAt: new Date(), executionDate: new Date() } });
    });
    return reply.send({ success: true, drill: updated });
  });

  // ========== DRILL RESULTS ==========
  app.get('/drills/:id/results', async (req: FastifyRequest, reply: FastifyReply) => {
    const tId = tenantId(req);
    if (!tId) return reply.code(400).send({ error: 'Tenant context required' });
    const { id } = req.params as { id: string };
    const items = await app.runWithDbContext(req, async (tx: any) => {
      return tx.drillResult.findMany({ where: { drillId: id, tenantId: tId }, orderBy: { createdAt: 'desc' } });
    });
    return reply.send({ items });
  });

  app.post('/drills/:id/results', async (req: FastifyRequest, reply: FastifyReply) => {
    const tId = tenantId(req);
    if (!tId) return reply.code(400).send({ error: 'Tenant context required' });
    const { id } = req.params as { id: string };
    let body = parseBody(req);
    if (!body || !body.result) return reply.code(400).send({ error: 'result required' });
    const created = await app.runWithDbContext(req, async (tx: any) => {
      return tx.drillResult.create({
        data: {
          tenantId: tId,
          drillId: id,
          result: body.result,
          responseTime: body.responseTime ? Number(body.responseTime) : null,
          observations: body.observations,
          deviationsDetected: body.deviationsDetected ?? false,
        }
      });
    });
    return reply.code(201).send(created);
  });

  app.put('/drills/:id/results/:resultId', async (req: FastifyRequest, reply: FastifyReply) => {
    const tId = tenantId(req);
    if (!tId) return reply.code(400).send({ error: 'Tenant context required' });
    const { resultId } = req.params as { resultId: string };
    let body = parseBody(req);
    if (!body) return reply.code(400).send({ error: 'Invalid body' });
    const data: any = {};
    ['result','responseTime','observations','deviationsDetected'].forEach((k) => { if (body[k] !== undefined) data[k] = body[k]; });
    const updated = await app.runWithDbContext(req, async (tx: any) => {
      return tx.drillResult.update({ where: { id: resultId }, data });
    });
    return reply.send(updated);
  });

  app.delete('/drills/:id/results/:resultId', async (req: FastifyRequest, reply: FastifyReply) => {
    const tId = tenantId(req);
    if (!tId) return reply.code(400).send({ error: 'Tenant context required' });
    const { resultId } = req.params as { resultId: string };
    await app.runWithDbContext(req, async (tx: any) => {
      return tx.drillResult.delete({ where: { id: resultId } });
    });
    return reply.code(204).send();
  });

  // ========== DRILL ACTIONS ==========
  app.get('/drills/:id/actions', async (req: FastifyRequest, reply: FastifyReply) => {
    const tId = tenantId(req);
    if (!tId) return reply.code(400).send({ error: 'Tenant context required' });
    const { id } = req.params as { id: string };
    const items = await app.runWithDbContext(req, async (tx: any) => {
      return tx.drillAction.findMany({
        where: { drillId: id, tenantId: tId },
        orderBy: { createdAt: 'desc' },
        include: { responsible: { select: { id: true, firstName: true, lastName: true } } }
      });
    });
    return reply.send({ items });
  });

  app.post('/drills/:id/actions', async (req: FastifyRequest, reply: FastifyReply) => {
    const tId = tenantId(req);
    if (!tId) return reply.code(400).send({ error: 'Tenant context required' });
    const { id } = req.params as { id: string };
    let body = parseBody(req);
    if (!body || !body.description) return reply.code(400).send({ error: 'description required' });
    if (body.responsibleId && !isValidUUID(body.responsibleId)) return reply.code(400).send({ error: 'responsibleId must be a valid UUID' });
    stripNulls(body);
    parseDates(body);
    const created = await app.runWithDbContext(req, async (tx: any) => {
      return tx.drillAction.create({
        data: {
          tenantId: tId,
          drillId: id,
          description: body.description,
          responsibleId: body.responsibleId || null,
          dueDate: body.dueDate,
          status: body.status || 'PENDING',
          effectiveness: body.effectiveness || null,
        }
      });
    });
    return reply.code(201).send(created);
  });

  app.put('/drills/:id/actions/:actionId', async (req: FastifyRequest, reply: FastifyReply) => {
    const tId = tenantId(req);
    if (!tId) return reply.code(400).send({ error: 'Tenant context required' });
    const { actionId } = req.params as { actionId: string };
    let body = parseBody(req);
    if (!body) return reply.code(400).send({ error: 'Invalid body' });
    stripNulls(body);
    parseDates(body);
    const data: any = {};
    ['description','responsibleId','dueDate','status','effectiveness'].forEach((k) => { if (body[k] !== undefined) data[k] = body[k]; });
    const updated = await app.runWithDbContext(req, async (tx: any) => {
      return tx.drillAction.update({ where: { id: actionId }, data });
    });
    return reply.send(updated);
  });

  app.delete('/drills/:id/actions/:actionId', async (req: FastifyRequest, reply: FastifyReply) => {
    const tId = tenantId(req);
    if (!tId) return reply.code(400).send({ error: 'Tenant context required' });
    const { actionId } = req.params as { actionId: string };
    await app.runWithDbContext(req, async (tx: any) => {
      return tx.drillAction.delete({ where: { id: actionId } });
    });
    return reply.code(204).send();
  });

  // ========== DRILL PARTICIPANTS ==========
  app.get('/drills/:id/participants', async (req: FastifyRequest, reply: FastifyReply) => {
    const tId = tenantId(req);
    if (!tId) return reply.code(400).send({ error: 'Tenant context required' });
    const { id } = req.params as { id: string };
    const items = await app.runWithDbContext(req, async (tx: any) => {
      return tx.drillParticipant.findMany({
        where: { drillId: id, tenantId: tId },
        include: { employee: { select: { id: true, firstName: true, lastName: true, email: true } } }
      });
    });
    return reply.send({ items });
  });

  app.post('/drills/:id/participants', async (req: FastifyRequest, reply: FastifyReply) => {
    const tId = tenantId(req);
    if (!tId) return reply.code(400).send({ error: 'Tenant context required' });
    const { id } = req.params as { id: string };
    let body = parseBody(req);
    if (!body || !body.employeeId) return reply.code(400).send({ error: 'employeeId required' });
    if (!isValidUUID(body.employeeId)) return reply.code(400).send({ error: 'employeeId must be a valid UUID' });
    const created = await app.runWithDbContext(req, async (tx: any) => {
      return tx.drillParticipant.create({
        data: { tenantId: tId, drillId: id, employeeId: body.employeeId }
      });
    });
    return reply.code(201).send(created);
  });

  app.delete('/drills/:id/participants/:participantId', async (req: FastifyRequest, reply: FastifyReply) => {
    const tId = tenantId(req);
    if (!tId) return reply.code(400).send({ error: 'Tenant context required' });
    const { participantId } = req.params as { participantId: string };
    await app.runWithDbContext(req, async (tx: any) => {
      return tx.drillParticipant.delete({ where: { id: participantId } });
    });
    return reply.code(204).send();
  });

  // ========== AUTO NC ==========
  app.post('/drills/:id/create-nc', async (req: FastifyRequest, reply: FastifyReply) => {
    const tId = tenantId(req);
    if (!tId) return reply.code(400).send({ error: 'Tenant context required' });
    const { id } = req.params as { id: string };

    const drill = await app.runWithDbContext(req, async (tx: any) => {
      return tx.drillScenario.findFirst({
        where: { id, tenantId: tId, deletedAt: null },
        include: { drillResults: { orderBy: { createdAt: 'desc' }, take: 1 } }
      });
    });
    if (!drill) return reply.code(404).send({ error: 'Drill not found' });

    const latestResult = drill.drillResults?.[0];
    if (!latestResult) return reply.send({ created: false, reason: 'Sin resultado registrado' });
    if (latestResult.result !== 'WITH_FAILURES' && latestResult.result !== 'CRITICAL') {
      return reply.send({ created: false, reason: 'Resultado no requiere NC' });
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const existing = await app.runWithDbContext(req, async (tx: any) => {
      return tx.nonConformity.findFirst({
        where: {
          tenantId: tId,
          drillId: id,
          createdAt: { gte: thirtyDaysAgo },
          deletedAt: null,
        },
        orderBy: { createdAt: 'desc' },
      });
    });
    if (existing) return reply.send({ created: false, reason: 'NC ya existe recientemente', existingNcrId: existing.id });

    const count = await app.runWithDbContext(req, async (tx: any) => {
      return tx.nonConformity.count({ where: { tenantId: tId, deletedAt: null } });
    });
    const seq = count + 1;
    const code = 'NCR-' + String(seq).padStart(4, '0');

    const ncr = await app.runWithDbContext(req, async (tx: any) => {
      return tx.nonConformity.create({
        data: {
          tenantId: tId,
          code,
          title: 'NC por simulacro: ' + drill.name,
          description: latestResult.observations || 'Simulacro con fallas/crítico',
          severity: latestResult.result === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
          source: 'DRILL',
          status: 'OPEN',
          standard: 'ISO 14001 / ISO 45001',
          drillId: id,
          createdById: (req as any).auth?.userId,
        }
      });
    });
    return reply.send({ created: true, ncr });
  });

  // ========== AI ANALYSIS ==========
  app.post('/drills/:id/ai-analyze', async (req: FastifyRequest, reply: FastifyReply) => {
    const tId = tenantId(req);
    if (!tId) return reply.code(400).send({ error: 'Tenant context required' });
    const { id } = req.params as { id: string };

    const drill = await app.runWithDbContext(req, async (tx: any) => {
      return tx.drillScenario.findFirst({
        where: { id, tenantId: tId, deletedAt: null },
        include: { drillResults: { orderBy: { createdAt: 'desc' }, take: 1 }, drillActions: true, participants: true }
      });
    });
    if (!drill) return reply.code(404).send({ error: 'Not found' });

    try {
      const llm = createLLMProvider();
      const prompt = `Analiza el siguiente simulacro de emergencia y evalua su desempeño. Simulacro: ${drill.name}. Tipo: ${drill.type}. Estado: ${drill.status}. Resultado mas reciente: ${drill.drillResults?.[0]?.result || 'Sin resultado'}. Observaciones: ${drill.drillResults?.[0]?.observations || 'Ninguna'}. Acciones asociadas: ${drill.drillActions?.length || 0}. Participantes: ${drill.participants?.length || 0}. Proporciona: 1) Evaluacion de desempeño. 2) Deteccion de fallas. 3) Sugerencias de mejora. 4) Indicar si requiere revisión urgente. Responde en español.`;
      const aiRes = await llm.chat([{ role: 'user', content: prompt }], 1500);
      return reply.send({ analysis: aiRes?.text || 'Sin respuesta del modelo' });
    } catch (e: any) {
      return reply.code(500).send({ error: 'Error IA', details: e?.message });
    }
  });

  // ========== ALERTS ==========
  app.get('/drills/alerts/summary', async (req: FastifyRequest, reply: FastifyReply) => {
    const tId = tenantId(req);
    if (!tId) return reply.code(400).send({ error: 'Tenant context required' });
    const now = new Date();

    const drills = await app.runWithDbContext(req, async (tx: any) => {
      return tx.drillScenario.findMany({
        where: { tenantId: tId, deletedAt: null },
        include: { drillResults: { orderBy: { createdAt: 'desc' }, take: 1 }, drillActions: true }
      });
    });

    const alerts: any[] = [];
    for (const d of drills) {
      const flags: string[] = [];
      if (d.status === 'PLANNED' && d.scheduledDate && new Date(d.scheduledDate) < now) {
        flags.push('Simulacro vencido');
      }
      if (d.status === 'PLANNED' && !d.executionDate) {
        flags.push('Simulacro sin ejecutar');
      }
      const latestResult = d.drillResults?.[0];
      if (latestResult && (latestResult.result === 'WITH_FAILURES' || latestResult.result === 'CRITICAL')) {
        flags.push('Simulacro con fallas');
      }
      const overdueActions = d.drillActions?.filter((a: any) => a.dueDate && new Date(a.dueDate) < now && a.status !== 'COMPLETED');
      if (overdueActions && overdueActions.length > 0) flags.push('Acciones vencidas');
      if (flags.length > 0) {
        alerts.push({ drillId: d.id, drillName: d.name, flags });
      }
    }
    return reply.send({ alerts, count: alerts.length });
  });

  // ========== STATS / DASHBOARD ==========
  app.get('/stats', async (req: FastifyRequest, reply: FastifyReply) => {
    const tId = tenantId(req);
    if (!tId) return reply.code(400).send({ error: 'Tenant context required' });

    const [totalDrills, completedDrills, inProgressDrills, plannedDrills, contingencyPlans, activePlans, operationalResources, totalResources, avgResponseTime] = await app.runWithDbContext(req, async (tx: any) => {
      return Promise.all([
        tx.drillScenario.count({ where: { tenantId: tId, deletedAt: null } }),
        tx.drillScenario.count({ where: { tenantId: tId, deletedAt: null, status: 'COMPLETED' } }),
        tx.drillScenario.count({ where: { tenantId: tId, deletedAt: null, status: 'IN_PROGRESS' } }),
        tx.drillScenario.count({ where: { tenantId: tId, deletedAt: null, status: 'PLANNED' } }),
        tx.contingencyPlan.count({ where: { tenantId: tId, deletedAt: null } }),
        tx.contingencyPlan.count({ where: { tenantId: tId, deletedAt: null, status: 'ACTIVE' } }),
        tx.emergencyResource.count({ where: { tenantId: tId, deletedAt: null, isOperational: true } }),
        tx.emergencyResource.count({ where: { tenantId: tId, deletedAt: null } }),
        tx.drillResult.aggregate({
          where: { tenantId: tId, responseTime: { not: null } },
          _avg: { responseTime: true }
        }),
      ]);
    });

    const failureDrills = await app.runWithDbContext(req, async (tx: any) => {
      return tx.drillResult.count({
        where: { tenantId: tId, result: { in: ['WITH_FAILURES', 'CRITICAL'] } }
      });
    });

    return reply.send({
      stats: {
        total_drills: totalDrills,
        completed_drills: completedDrills,
        in_progress_drills: inProgressDrills,
        planned_drills: plannedDrills,
        failure_drills: failureDrills,
        contingency_plans: contingencyPlans,
        active_plans: activePlans,
        resources_total: totalResources,
        resources_operational: operationalResources,
        operational_percent: totalResources > 0 ? Math.round((operationalResources / totalResources) * 100) : 0,
        avg_response_time: avgResponseTime?._avg?.responseTime ?? 0,
      }
    });
  });

  // ========== CONTINGENCY PLANS ==========
  app.get('/contingency-plans', async (req: FastifyRequest, reply: FastifyReply) => {
    const tId = tenantId(req);
    if (!tId) return reply.code(400).send({ error: 'Tenant context required' });
    const items = await app.runWithDbContext(req, async (tx: any) => {
      return tx.contingencyPlan.findMany({
        where: { tenantId: tId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        include: { responsible: { select: { id: true, firstName: true, lastName: true } } }
      });
    });
    return reply.send({ plans: items });
  });

  app.get('/contingency-plans/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tId = tenantId(req);
    if (!tId) return reply.code(400).send({ error: 'Tenant context required' });
    const { id } = req.params as { id: string };
    const item = await app.runWithDbContext(req, async (tx: any) => {
      return tx.contingencyPlan.findFirst({
        where: { id, tenantId: tId, deletedAt: null },
        include: {
          responsible: { select: { id: true, firstName: true, lastName: true } },
          versionHistory: { orderBy: { createdAt: 'desc' } }
        }
      });
    });
    if (!item) return reply.code(404).send({ error: 'Not found' });
    return reply.send({ item });
  });

  app.post('/contingency-plans', async (req: FastifyRequest, reply: FastifyReply) => {
    const tId = tenantId(req);
    if (!tId) return reply.code(400).send({ error: 'Tenant context required' });
    let body = parseBody(req);
    if (!body || !body.name) return reply.code(400).send({ error: 'name required' });
    stripNulls(body);
    parseDates(body);

    const created = await app.runWithDbContext(req, async (tx: any) => {
      return tx.contingencyPlan.create({
        data: {
          tenantId: tId,
          name: body.name,
          description: body.description,
          type: body.type || 'OTHER',
          status: body.status || 'ACTIVE',
          version: body.version || '1.0',
          responsibleId: body.responsibleId,
          reviewDate: body.reviewDate,
          nextReviewDate: body.nextReviewDate,
          objectives: body.objectives ?? [],
          triggers: body.triggers ?? [],
          responsibilities: body.responsibilities ?? {},
          procedures: body.procedures ?? [],
          resources: body.resources ?? {},
          communications: body.communications ?? {},
          timeline: body.timeline ?? {},
          createdById: (req as any).auth?.userId,
        }
      });
    });
    return reply.code(201).send({ success: true, plan: created });
  });

  app.put('/contingency-plans/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tId = tenantId(req);
    if (!tId) return reply.code(400).send({ error: 'Tenant context required' });
    const { id } = req.params as { id: string };
    let body = parseBody(req);
    if (!body) return reply.code(400).send({ error: 'Invalid body' });
    stripNulls(body);
    parseDates(body);

    const existing = await app.runWithDbContext(req, async (tx: any) => {
      return tx.contingencyPlan.findFirst({ where: { id, tenantId: tId, deletedAt: null } });
    });
    if (!existing) return reply.code(404).send({ error: 'Not found' });

    const data: any = {};
    ['name','description','type','status','version','responsibleId','reviewDate','nextReviewDate','objectives','triggers','responsibilities','procedures','resources','communications','timeline'].forEach((k) => {
      if (body[k] !== undefined) data[k] = body[k];
    });

    const updated = await app.runWithDbContext(req, async (tx: any) => {
      return tx.contingencyPlan.update({ where: { id }, data });
    });
    return reply.send({ success: true, plan: updated });
  });

  app.delete('/contingency-plans/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tId = tenantId(req);
    if (!tId) return reply.code(400).send({ error: 'Tenant context required' });
    const { id } = req.params as { id: string };
    const existing = await app.runWithDbContext(req, async (tx: any) => {
      return tx.contingencyPlan.findFirst({ where: { id, tenantId: tId, deletedAt: null } });
    });
    if (!existing) return reply.code(404).send({ error: 'Not found' });
    await app.runWithDbContext(req, async (tx: any) => {
      return tx.contingencyPlan.update({ where: { id }, data: { deletedAt: new Date() } });
    });
    return reply.code(204).send();
  });

  // ========== EMERGENCY RESOURCES ==========
  app.get('/resources', async (req: FastifyRequest, reply: FastifyReply) => {
    const tId = tenantId(req);
    if (!tId) return reply.code(400).send({ error: 'Tenant context required' });
    const items = await app.runWithDbContext(req, async (tx: any) => {
      return tx.emergencyResource.findMany({
        where: { tenantId: tId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        include: { responsible: { select: { id: true, firstName: true, lastName: true } } }
      });
    });
    return reply.send({ resources: items });
  });

  app.get('/resources/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tId = tenantId(req);
    if (!tId) return reply.code(400).send({ error: 'Tenant context required' });
    const { id } = req.params as { id: string };
    const item = await app.runWithDbContext(req, async (tx: any) => {
      return tx.emergencyResource.findFirst({
        where: { id, tenantId: tId, deletedAt: null },
        include: { responsible: { select: { id: true, firstName: true, lastName: true } } }
      });
    });
    if (!item) return reply.code(404).send({ error: 'Not found' });
    return reply.send({ item });
  });

  app.post('/resources', async (req: FastifyRequest, reply: FastifyReply) => {
    const tId = tenantId(req);
    if (!tId) return reply.code(400).send({ error: 'Tenant context required' });
    let body = parseBody(req);
    if (!body || !body.name) return reply.code(400).send({ error: 'name required' });
    stripNulls(body);
    parseDates(body);

    const created = await app.runWithDbContext(req, async (tx: any) => {
      return tx.emergencyResource.create({
        data: {
          tenantId: tId,
          name: body.name,
          description: body.description,
          type: body.type || 'EQUIPMENT',
          category: body.category,
          quantity: body.quantity ? Number(body.quantity) : null,
          location: body.location,
          status: body.status || 'AVAILABLE',
          isOperational: body.isOperational !== undefined ? body.isOperational : true,
          maintenanceDate: body.maintenanceDate,
          expirationDate: body.expirationDate,
          responsibleId: body.responsibleId,
          contactInfo: body.contactInfo ?? {},
          specifications: body.specifications ?? {},
          maintenanceSchedule: body.maintenanceSchedule ?? {},
          createdById: (req as any).auth?.userId,
        }
      });
    });
    return reply.code(201).send(created);
  });

  app.put('/resources/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tId = tenantId(req);
    if (!tId) return reply.code(400).send({ error: 'Tenant context required' });
    const { id } = req.params as { id: string };
    let body = parseBody(req);
    if (!body) return reply.code(400).send({ error: 'Invalid body' });
    stripNulls(body);
    parseDates(body);

    const existing = await app.runWithDbContext(req, async (tx: any) => {
      return tx.emergencyResource.findFirst({ where: { id, tenantId: tId, deletedAt: null } });
    });
    if (!existing) return reply.code(404).send({ error: 'Not found' });

    const data: any = {};
    ['name','description','type','category','quantity','location','status','isOperational','maintenanceDate','expirationDate','responsibleId','contactInfo','specifications','maintenanceSchedule'].forEach((k) => {
      if (body[k] !== undefined) data[k] = body[k];
    });

    const updated = await app.runWithDbContext(req, async (tx: any) => {
      return tx.emergencyResource.update({ where: { id }, data });
    });
    return reply.send(updated);
  });

  app.delete('/resources/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tId = tenantId(req);
    if (!tId) return reply.code(400).send({ error: 'Tenant context required' });
    const { id } = req.params as { id: string };
    const existing = await app.runWithDbContext(req, async (tx: any) => {
      return tx.emergencyResource.findFirst({ where: { id, tenantId: tId, deletedAt: null } });
    });
    if (!existing) return reply.code(404).send({ error: 'Not found' });
    await app.runWithDbContext(req, async (tx: any) => {
      return tx.emergencyResource.update({ where: { id }, data: { deletedAt: new Date() } });
    });
    return reply.code(204).send();
  });
};
