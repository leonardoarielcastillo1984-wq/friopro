/**
 * Rutas dedicadas para IPERC (Peligros SST) con gestion completa ISO 45001.
 * Reemplaza el makeCrud generico de sgi-professional.
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

// Calcular nivel de riesgo segun probabilidad * severidad * exposicion
function computeRiskLevel(probability: number, severity: number, exposure: number) {
  return probability * severity * exposure;
}

function getRiskCategory(level: number): string {
  if (level <= 4) return 'TOLERABLE';
  if (level <= 9) return 'MODERATE';
  if (level <= 15) return 'SUBSTANTIAL';
  return 'INTOLERABLE';
}

export const hazardsRoutes: FastifyPluginAsync = async (app) => {
  const tenantId = (req: FastifyRequest) => req.db?.tenantId;

  // --- LIST ---
  app.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const tId = tenantId(req);
    if (!tId) return reply.code(400).send({ error: 'Tenant context required' });
    const query = req.query as Record<string, string>;
    const where: any = { tenantId: tId, deletedAt: null };
    if (query.status) where.status = query.status;
    if (query.riskCategory) where.riskCategory = query.riskCategory;

    const items = await app.runWithDbContext(req, async (tx: any) => {
      return tx.hazard.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          actions: { orderBy: { createdAt: 'desc' } },
          reviews: { orderBy: { reviewDate: 'desc' }, take: 1 },
          _count: { select: { actions: true, reviews: true, nonConformities: true } },
        },
      });
    });
    return reply.send({ items });
  });

  // --- DETAIL ---
  app.get('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tId = tenantId(req);
    if (!tId) return reply.code(400).send({ error: 'Tenant context required' });
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    const item = await app.runWithDbContext(req, async (tx: any) => {
      return tx.hazard.findUnique({
        where: { id, tenantId: tId, deletedAt: null },
        include: {
          actions: { orderBy: { createdAt: 'desc' } },
          reviews: { orderBy: { reviewDate: 'desc' } },
          nonConformities: { orderBy: { createdAt: 'desc' }, take: 5 },
        },
      });
    });
    if (!item) return reply.code(404).send({ error: 'Not found' });
    return reply.send({ item });
  });

  // --- CREATE ---
  app.post('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const tId = tenantId(req);
    if (!tId) return reply.code(400).send({ error: 'Tenant context required' });
    const body = parseBody(req);
    if (!body) return reply.code(400).send({ error: 'Invalid body' });
    delete body.id;

    stripNulls(body);
    parseDates(body);

    // Auto-compute riskLevel and riskCategory if not provided
    if (typeof body.probability === 'number' && typeof body.severity === 'number') {
      const exposure = body.exposure ?? 1;
      body.riskLevel = computeRiskLevel(body.probability, body.severity, exposure);
      body.riskCategory = getRiskCategory(body.riskLevel);
    }

    // Auto code IPERC
    if (!body.code) {
      const year = new Date().getFullYear();
      const count = await app.prisma.hazard.count({
        where: { tenantId: tId, code: { startsWith: `IPERC-${year}-` } },
      });
      body.code = `IPERC-${year}-${String(count + 1).padStart(3, '0')}`;
    }

    const data = { ...body, tenantId: tId };
    try {
      data.createdById = req.auth?.userId ?? null;
      data.updatedById = req.auth?.userId ?? null;
    } catch {}

    const item = await app.runWithDbContext(req, async (tx: any) => {
      return tx.hazard.create({ data });
    });
    return reply.send({ item });
  });

  // --- UPDATE ---
  app.put('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tId = tenantId(req);
    if (!tId) return reply.code(400).send({ error: 'Tenant context required' });
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = parseBody(req);
    if (!body) return reply.code(400).send({ error: 'Invalid body' });
    delete body.id; delete body.tenantId; delete body.createdAt;
    stripNulls(body);
    parseDates(body);

    if (typeof body.probability === 'number' && typeof body.severity === 'number') {
      const exposure = body.exposure ?? 1;
      body.riskLevel = computeRiskLevel(body.probability, body.severity, exposure);
      body.riskCategory = getRiskCategory(body.riskLevel);
    }

    try { body.updatedById = req.auth?.userId ?? null; } catch {}

    const item = await app.runWithDbContext(req, async (tx: any) => {
      return tx.hazard.update({
        where: { id, tenantId: tId, deletedAt: null },
        data: body,
      });
    });
    return reply.send({ item });
  });

  // --- PATCH ---
  app.patch('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tId = tenantId(req);
    if (!tId) return reply.code(400).send({ error: 'Tenant context required' });
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = parseBody(req);
    if (!body) return reply.code(400).send({ error: 'Invalid body' });
    delete body.id; delete body.tenantId;
    stripNulls(body);
    parseDates(body);

    if (typeof body.probability === 'number' && typeof body.severity === 'number') {
      const exposure = body.exposure ?? 1;
      body.riskLevel = computeRiskLevel(body.probability, body.severity, exposure);
      body.riskCategory = getRiskCategory(body.riskLevel);
    }

    try { body.updatedById = req.auth?.userId ?? null; } catch {}

    const item = await app.runWithDbContext(req, async (tx: any) => {
      return tx.hazard.update({
        where: { id, tenantId: tId, deletedAt: null },
        data: body,
      });
    });
    return reply.send({ item });
  });

  // --- SOFT DELETE ---
  app.delete('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tId = tenantId(req);
    if (!tId) return reply.code(400).send({ error: 'Tenant context required' });
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    const item = await app.runWithDbContext(req, async (tx: any) => {
      return tx.hazard.update({
        where: { id, tenantId: tId, deletedAt: null },
        data: { deletedAt: new Date() },
      });
    });
    return reply.send({ item });
  });

  // --- RISK ACTIONS ---
  // List actions for a hazard
  app.get('/:id/actions', async (req: FastifyRequest, reply: FastifyReply) => {
    const tId = tenantId(req);
    if (!tId) return reply.code(400).send({ error: 'Tenant context required' });
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    const actions = await app.runWithDbContext(req, async (tx: any) => {
      return tx.riskAction.findMany({
        where: { hazardId: id, tenantId: tId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
      });
    });
    return reply.send({ actions });
  });

  // Create action
  app.post('/:id/actions', async (req: FastifyRequest, reply: FastifyReply) => {
    const tId = tenantId(req);
    if (!tId) return reply.code(400).send({ error: 'Tenant context required' });
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = parseBody(req);
    if (!body) return reply.code(400).send({ error: 'Invalid body' });
    delete body.id; delete body.hazardId; delete body.tenantId; delete body.createdAt; delete body.updatedAt;
    stripNulls(body);
    parseDates(body);

    try {
      const action = await app.runWithDbContext(req, async (tx: any) => {
        return tx.riskAction.create({
          data: {
            ...body,
            tenantId: tId,
            hazardId: id,
          },
        });
      });
      return reply.send({ action });
    } catch (e: any) {
      app.log.error('Create action error:', e);
      return reply.code(400).send({ error: 'Invalid action data', detail: e?.message });
    }
  });

  // Update action
  app.put('/:id/actions/:actionId', async (req: FastifyRequest, reply: FastifyReply) => {
    const tId = tenantId(req);
    if (!tId) return reply.code(400).send({ error: 'Tenant context required' });
    const { id: hazardId, actionId } = z.object({ id: z.string().uuid(), actionId: z.string().uuid() }).parse(req.params);
    const body = parseBody(req);
    if (!body) return reply.code(400).send({ error: 'Invalid body' });
    delete body.id; delete body.hazardId; delete body.tenantId;
    stripNulls(body);
    parseDates(body);

    try {
      const action = await app.runWithDbContext(req, async (tx: any) => {
        return tx.riskAction.update({
          where: { id: actionId, hazardId, tenantId: tId },
          data: body,
        });
      });
      return reply.send({ action });
    } catch (e: any) {
      app.log.error('Update action error:', e);
      return reply.code(400).send({ error: 'Invalid action data', detail: e?.message });
    }
  });

  // Delete action
  app.delete('/:id/actions/:actionId', async (req: FastifyRequest, reply: FastifyReply) => {
    const tId = tenantId(req);
    if (!tId) return reply.code(400).send({ error: 'Tenant context required' });
    const { id: hazardId, actionId } = z.object({ id: z.string().uuid(), actionId: z.string().uuid() }).parse(req.params);

    await app.runWithDbContext(req, async (tx: any) => {
      return tx.riskAction.delete({ where: { id: actionId, hazardId, tenantId: tId } });
    });
    return reply.send({ deleted: true });
  });

  // --- RISK REVIEWS ---
  app.get('/:id/reviews', async (req: FastifyRequest, reply: FastifyReply) => {
    const tId = tenantId(req);
    if (!tId) return reply.code(400).send({ error: 'Tenant context required' });
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    const reviews = await app.runWithDbContext(req, async (tx: any) => {
      return tx.riskReview.findMany({
        where: { hazardId: id, tenantId: tId },
        orderBy: { reviewDate: 'desc' },
      });
    });
    return reply.send({ reviews });
  });

  app.post('/:id/reviews', async (req: FastifyRequest, reply: FastifyReply) => {
    const tId = tenantId(req);
    if (!tId) return reply.code(400).send({ error: 'Tenant context required' });
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = parseBody(req);
    if (!body) return reply.code(400).send({ error: 'Invalid body' });
    delete body.id; delete body.hazardId; delete body.tenantId; delete body.createdAt; delete body.updatedAt;
    stripNulls(body);
    parseDates(body);

    try {
      const review = await app.runWithDbContext(req, async (tx: any) => {
        return tx.riskReview.create({
          data: {
            ...body,
            tenantId: tId,
            hazardId: id,
          },
        });
      });
      return reply.send({ review });
    } catch (e: any) {
      app.log.error('Create review error:', e);
      return reply.code(400).send({ error: 'Invalid review data', detail: e?.message });
    }
  });

  // --- ALERTS SUMMARY ---
  app.get('/alerts/summary', async (req: FastifyRequest, reply: FastifyReply) => {
    const tId = tenantId(req);
    if (!tId) return reply.code(400).send({ error: 'Tenant context required' });

    const now = new Date();
    const hazards = await app.runWithDbContext(req, async (tx: any) => {
      return tx.hazard.findMany({
        where: { tenantId: tId, deletedAt: null },
        include: {
          actions: true,
          reviews: { orderBy: { reviewDate: 'desc' }, take: 1 },
          nonConformities: { where: { deletedAt: null } },
        },
      });
    });

    const alerts = hazards.map((h: any) => {
      const flags: string[] = [];
      // Riesgo alto sin acciones
      if ((h.riskLevel >= 12 || h.riskCategory === 'INTOLERABLE' || h.riskCategory === 'SUBSTANTIAL') && (!h.actions || h.actions.length === 0)) {
        flags.push('high-no-actions');
      }
      // Accion vencida
      const overdueActions = h.actions?.filter((a: any) => a.dueDate && new Date(a.dueDate) < now && a.status !== 'COMPLETED');
      if (overdueActions && overdueActions.length > 0) flags.push('overdue-action');
      // Sin revision
      const lastReview = h.reviews?.[0];
      if (!lastReview) flags.push('no-review');
      // Control no implementado
      const controls = [
        h.eliminationImplemented, h.substitutionImplemented, h.engineeringImplemented,
        h.administrativeImplemented, h.ppeImplemented,
      ];
      if (controls.some((c: any) => c === false)) flags.push('control-not-implemented');
      // Control no eficaz
      const effs = [
        h.eliminationEffective, h.substitutionEffective, h.engineeringEffective,
        h.administrativeEffective, h.ppeEffective,
      ];
      if (effs.some((e: any) => e === false)) flags.push('control-not-effective');
      // Proxima revision vencida
      if (h.reviewDate && new Date(h.reviewDate) < now) flags.push('review-overdue');

      return { hazardId: h.id, code: h.code, area: h.area, flags, actionsCount: h.actions?.length ?? 0 };
    }).filter((a: any) => a.flags.length > 0);

    return reply.send({ alerts, count: alerts.length });
  });

  // --- AUTO CREATE NC (manual trigger) ---
  app.post('/:id/auto-nc', async (req: FastifyRequest, reply: FastifyReply) => {
    const tId = tenantId(req);
    if (!tId) return reply.code(400).send({ error: 'Tenant context required' });
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    const hazard = await app.runWithDbContext(req, async (tx: any) => {
      return tx.hazard.findUnique({
        where: { id, tenantId: tId, deletedAt: null },
        include: { nonConformities: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 1 } },
      });
    });
    if (!hazard) return reply.code(404).send({ error: 'Hazard not found' });

    // Condicion: nivel alto o control no eficaz
    const highRisk = hazard.riskLevel >= 12 || hazard.riskCategory === 'INTOLERABLE' || hazard.riskCategory === 'SUBSTANTIAL';
    const ineffectiveControl = [
      hazard.eliminationEffective, hazard.substitutionEffective, hazard.engineeringEffective,
      hazard.administrativeEffective, hazard.ppeEffective,
    ].some((e: any) => e === false);

    if (!highRisk && !ineffectiveControl) {
      return reply.send({ created: false, reason: 'Risk not high and controls effective' });
    }

    // Evitar duplicados recientes (30 dias)
    const recent = hazard.nonConformities?.[0];
    if (recent && recent.createdAt) {
      const days = (Date.now() - new Date(recent.createdAt).getTime()) / (24 * 3600 * 1000);
      if (days < 30) {
        return reply.send({ created: false, reason: 'Recent NC exists', existingNcrId: recent.id });
      }
    }

    const title = `Riesgo SST: ${hazard.code} - ${hazard.area}`;
    const description = `Riesgo identificado en IPERC con nivel ${hazard.riskLevel} (${hazard.riskCategory}). Peligro: ${hazard.hazard}. Riesgo: ${hazard.risk}.`;

    const ncr = await app.runWithDbContext(req, async (tx: any) => {
      const year = new Date().getFullYear();
      const count = await tx.nonConformity.count({
        where: { tenantId: tId, code: { startsWith: `NCR-${year}-` } },
      });
      const code = `NCR-${year}-${String(count + 1).padStart(3, '0')}`;

      return tx.nonConformity.create({
        data: {
          tenantId: tId,
          code,
          title,
          description,
          source: 'INTERNAL_AUDIT',
          severity: highRisk ? 'CRITICAL' : 'MAJOR',
          status: 'OPEN',
          dueDate: new Date(Date.now() + 30 * 24 * 3600 * 1000),
          hazardId: id,
          createdById: req.auth?.userId ?? null,
          updatedById: req.auth?.userId ?? null,
        },
      });
    });

    return reply.send({ created: true, ncr });
  });

  // --- AI ANALYSIS ---
  app.post('/:id/ai-analyze', async (req: FastifyRequest, reply: FastifyReply) => {
    const tId = tenantId(req);
    if (!tId) return reply.code(400).send({ error: 'Tenant context required' });
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    const hazard = await app.runWithDbContext(req, async (tx: any) => {
      return tx.hazard.findUnique({
        where: { id, tenantId: tId, deletedAt: null },
        include: { actions: true },
      });
    });
    if (!hazard) return reply.code(404).send({ error: 'Hazard not found' });

    const prompt = `Analiza el siguiente riesgo SST de un IPERC (ISO 45001):

Area/Puesto: ${hazard.area}
Actividad: ${hazard.activity}
Peligro: ${hazard.hazard}
Riesgo: ${hazard.risk}
Probabilidad: ${hazard.probability}, Severidad: ${hazard.severity}, Exposicion: ${hazard.exposure}
Nivel de riesgo: ${hazard.riskLevel} (${hazard.riskCategory})
Controles actuales:
- Eliminacion: ${hazard.elimination || 'Ninguno'}
- Sustitucion: ${hazard.substitution || 'Ninguno'}
- Ingenieria: ${hazard.engineering || 'Ninguno'}
- Administrativo: ${hazard.administrative || 'Ninguno'}
- EPP: ${hazard.ppe || 'Ninguno'}
Acciones abiertas: ${hazard.actions?.length || 0}

Tarea:
1. Evalua si la evaluacion del riesgo es coherente.
2. Sugiere controles adicionales si es necesario.
3. Recomienda acciones correctivas si el riesgo es alto o intolerable.
4. Indica si se requiere una revision urgente.

Responde en español, conciso y profesional.`;

    try {
      const llm = createLLMProvider();
      const aiRes = await llm.chat([{ role: 'user', content: prompt }], 1500);
      return reply.send({ analysis: aiRes?.text || 'Sin respuesta del modelo' });
    } catch (e: any) {
      return reply.code(500).send({ error: 'AI analysis failed', detail: e?.message });
    }
  });
};
