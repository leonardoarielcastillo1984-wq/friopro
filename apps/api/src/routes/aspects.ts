/**
 * Rutas dedicadas para Aspectos Ambientales con gestion completa ISO 14001.
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

function computeReductionPercent(initial: number | null, current: number): number | null {
  if (!initial || initial <= 0) return null;
  const reduction = ((initial - current) / initial) * 100;
  return Math.round(reduction);
}

export const aspectsRoutes: FastifyPluginAsync = async (app) => {
  const tenantId = (req: FastifyRequest) => (req as any).db?.tenantId;

  // --- LIST ---
  app.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const tId = tenantId(req);
    if (!tId) return reply.code(400).send({ error: 'Tenant context required' });
    const query = req.query as Record<string, string>;
    const where: any = { tenantId: tId, deletedAt: null };
    if (query.status) where.status = query.status;
    if (query.category) where.category = query.category;
    if (query.isSignificant) where.isSignificant = query.isSignificant === 'true';

    const items = await app.runWithDbContext(req, async (tx: any) => {
      return tx.environmentalAspect.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          actions: { orderBy: { createdAt: 'desc' } },
          controls: true,
          reviews: { orderBy: { reviewDate: 'desc' }, take: 1 },
          _count: { select: { actions: true, controls: true, reviews: true, nonConformities: true } },
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
      return tx.environmentalAspect.findUnique({
        where: { id, tenantId: tId, deletedAt: null },
        include: {
          actions: { orderBy: { createdAt: 'desc' } },
          controls: true,
          reviews: { orderBy: { reviewDate: 'desc' } },
          nonConformities: { orderBy: { createdAt: 'desc' }, take: 5 },
        },
      });
    });
    if (!item) return reply.code(404).send({ error: 'Not found' });

    const reduction = computeReductionPercent(item.initialSignificance, item.significance);
    return reply.send({ item: { ...item, reductionPercent: reduction } });
  });

  // --- CREATE ---
  app.post('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const tId = tenantId(req);
    if (!tId) return reply.code(400).send({ error: 'Tenant context required' });
    const body = parseBody(req);
    if (!body) return reply.code(400).send({ error: 'Invalid body' });
    stripNulls(body);
    parseDates(body);
    delete body.id; delete body.tenantId;

    if (!body.initialSignificance && body.significance) {
      body.initialSignificance = body.significance;
    }

    const item = await app.runWithDbContext(req, async (tx: any) => {
      const year = new Date().getFullYear();
      const count = await tx.environmentalAspect.count({
        where: { tenantId: tId, code: { startsWith: `AMB-${year}-` } },
      });
      const code = `AMB-${year}-${String(count + 1).padStart(3, '0')}`;
      const data = { ...body, tenantId: tId, code };
      return tx.environmentalAspect.create({ data });
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

    const item = await app.runWithDbContext(req, async (tx: any) => {
      return tx.environmentalAspect.update({
        where: { id, tenantId: tId, deletedAt: null },
        data: body,
      });
    });
    return reply.send({ item });
  });

  // --- DELETE ---
  app.delete('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tId = tenantId(req);
    if (!tId) return reply.code(400).send({ error: 'Tenant context required' });
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    await app.runWithDbContext(req, async (tx: any) => {
      return tx.environmentalAspect.update({
        where: { id, tenantId: tId },
        data: { deletedAt: new Date() },
      });
    });
    return reply.send({ deleted: true });
  });

  // ===== ENVIRONMENTAL ACTIONS =====

  app.get('/:id/actions', async (req: FastifyRequest, reply: FastifyReply) => {
    const tId = tenantId(req);
    if (!tId) return reply.code(400).send({ error: 'Tenant context required' });
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    const actions = await app.runWithDbContext(req, async (tx: any) => {
      return tx.environmentalAction.findMany({
        where: { aspectId: id, tenantId: tId },
        orderBy: { createdAt: 'desc' },
      });
    });
    return reply.send({ actions });
  });

  app.post('/:id/actions', async (req: FastifyRequest, reply: FastifyReply) => {
    const tId = tenantId(req);
    if (!tId) return reply.code(400).send({ error: 'Tenant context required' });
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = parseBody(req);
    if (!body) return reply.code(400).send({ error: 'Invalid body' });
    delete body.id; delete body.aspectId; delete body.tenantId; delete body.createdAt; delete body.updatedAt;
    stripNulls(body);
    parseDates(body);

    try {
      const action = await app.runWithDbContext(req, async (tx: any) => {
        return tx.environmentalAction.create({
          data: { ...body, tenantId: tId, aspectId: id },
        });
      });
      return reply.send({ action });
    } catch (e: any) {
      app.log.error('Create action error:', e);
      return reply.code(400).send({ error: 'Invalid action data', detail: e?.message });
    }
  });

  app.put('/:id/actions/:actionId', async (req: FastifyRequest, reply: FastifyReply) => {
    const tId = tenantId(req);
    if (!tId) return reply.code(400).send({ error: 'Tenant context required' });
    const { id: aspectId, actionId } = z.object({ id: z.string().uuid(), actionId: z.string().uuid() }).parse(req.params);
    const body = parseBody(req);
    if (!body) return reply.code(400).send({ error: 'Invalid body' });
    delete body.id; delete body.aspectId; delete body.tenantId;
    stripNulls(body);
    parseDates(body);

    try {
      const action = await app.runWithDbContext(req, async (tx: any) => {
        return tx.environmentalAction.update({
          where: { id: actionId, aspectId, tenantId: tId },
          data: body,
        });
      });
      return reply.send({ action });
    } catch (e: any) {
      app.log.error('Update action error:', e);
      return reply.code(400).send({ error: 'Invalid action data', detail: e?.message });
    }
  });

  app.delete('/:id/actions/:actionId', async (req: FastifyRequest, reply: FastifyReply) => {
    const tId = tenantId(req);
    if (!tId) return reply.code(400).send({ error: 'Tenant context required' });
    const { id: aspectId, actionId } = z.object({ id: z.string().uuid(), actionId: z.string().uuid() }).parse(req.params);

    await app.runWithDbContext(req, async (tx: any) => {
      return tx.environmentalAction.delete({ where: { id: actionId, aspectId, tenantId: tId } });
    });
    return reply.send({ deleted: true });
  });

  // ===== ENVIRONMENTAL CONTROLS =====

  app.get('/:id/controls', async (req: FastifyRequest, reply: FastifyReply) => {
    const tId = tenantId(req);
    if (!tId) return reply.code(400).send({ error: 'Tenant context required' });
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    const controls = await app.runWithDbContext(req, async (tx: any) => {
      return tx.environmentalControl.findMany({
        where: { aspectId: id, tenantId: tId },
        orderBy: { createdAt: 'desc' },
      });
    });
    return reply.send({ controls });
  });

  app.post('/:id/controls', async (req: FastifyRequest, reply: FastifyReply) => {
    const tId = tenantId(req);
    if (!tId) return reply.code(400).send({ error: 'Tenant context required' });
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = parseBody(req);
    if (!body) return reply.code(400).send({ error: 'Invalid body' });
    delete body.id; delete body.aspectId; delete body.tenantId;
    stripNulls(body);

    try {
      const control = await app.runWithDbContext(req, async (tx: any) => {
        return tx.environmentalControl.create({
          data: { ...body, tenantId: tId, aspectId: id },
        });
      });
      return reply.send({ control });
    } catch (e: any) {
      app.log.error('Create control error:', e);
      return reply.code(400).send({ error: 'Invalid control data', detail: e?.message });
    }
  });

  app.put('/:id/controls/:controlId', async (req: FastifyRequest, reply: FastifyReply) => {
    const tId = tenantId(req);
    if (!tId) return reply.code(400).send({ error: 'Tenant context required' });
    const { id: aspectId, controlId } = z.object({ id: z.string().uuid(), controlId: z.string().uuid() }).parse(req.params);
    const body = parseBody(req);
    if (!body) return reply.code(400).send({ error: 'Invalid body' });
    delete body.id; delete body.aspectId; delete body.tenantId;
    stripNulls(body);

    try {
      const control = await app.runWithDbContext(req, async (tx: any) => {
        return tx.environmentalControl.update({
          where: { id: controlId, aspectId, tenantId: tId },
          data: body,
        });
      });
      return reply.send({ control });
    } catch (e: any) {
      app.log.error('Update control error:', e);
      return reply.code(400).send({ error: 'Invalid control data', detail: e?.message });
    }
  });

  app.delete('/:id/controls/:controlId', async (req: FastifyRequest, reply: FastifyReply) => {
    const tId = tenantId(req);
    if (!tId) return reply.code(400).send({ error: 'Tenant context required' });
    const { id: aspectId, controlId } = z.object({ id: z.string().uuid(), controlId: z.string().uuid() }).parse(req.params);

    await app.runWithDbContext(req, async (tx: any) => {
      return tx.environmentalControl.delete({ where: { id: controlId, aspectId, tenantId: tId } });
    });
    return reply.send({ deleted: true });
  });

  // ===== ENVIRONMENTAL REVIEWS =====

  app.get('/:id/reviews', async (req: FastifyRequest, reply: FastifyReply) => {
    const tId = tenantId(req);
    if (!tId) return reply.code(400).send({ error: 'Tenant context required' });
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    const reviews = await app.runWithDbContext(req, async (tx: any) => {
      return tx.environmentalReview.findMany({
        where: { aspectId: id, tenantId: tId },
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
    delete body.id; delete body.aspectId; delete body.tenantId; delete body.createdAt; delete body.updatedAt;
    stripNulls(body);
    parseDates(body);

    try {
      const review = await app.runWithDbContext(req, async (tx: any) => {
        return tx.environmentalReview.create({
          data: { ...body, tenantId: tId, aspectId: id },
        });
      });
      return reply.send({ review });
    } catch (e: any) {
      app.log.error('Create review error:', e);
      return reply.code(400).send({ error: 'Invalid review data', detail: e?.message });
    }
  });

  app.put('/:id/reviews/:reviewId', async (req: FastifyRequest, reply: FastifyReply) => {
    const tId = tenantId(req);
    if (!tId) return reply.code(400).send({ error: 'Tenant context required' });
    const { id: aspectId, reviewId } = z.object({ id: z.string().uuid(), reviewId: z.string().uuid() }).parse(req.params);
    const body = parseBody(req);
    if (!body) return reply.code(400).send({ error: 'Invalid body' });
    delete body.id; delete body.aspectId; delete body.tenantId;
    stripNulls(body);
    parseDates(body);

    try {
      const review = await app.runWithDbContext(req, async (tx: any) => {
        return tx.environmentalReview.update({
          where: { id: reviewId, aspectId, tenantId: tId },
          data: body,
        });
      });
      return reply.send({ review });
    } catch (e: any) {
      app.log.error('Update review error:', e);
      return reply.code(400).send({ error: 'Invalid review data', detail: e?.message });
    }
  });

  app.delete('/:id/reviews/:reviewId', async (req: FastifyRequest, reply: FastifyReply) => {
    const tId = tenantId(req);
    if (!tId) return reply.code(400).send({ error: 'Tenant context required' });
    const { id: aspectId, reviewId } = z.object({ id: z.string().uuid(), reviewId: z.string().uuid() }).parse(req.params);

    await app.runWithDbContext(req, async (tx: any) => {
      return tx.environmentalReview.delete({ where: { id: reviewId, aspectId, tenantId: tId } });
    });
    return reply.send({ deleted: true });
  });

  // --- ALERTS SUMMARY ---
  app.get('/alerts/summary', async (req: FastifyRequest, reply: FastifyReply) => {
    const tId = tenantId(req);
    if (!tId) return reply.code(400).send({ error: 'Tenant context required' });

    const now = new Date();
    const aspects = await app.runWithDbContext(req, async (tx: any) => {
      return tx.environmentalAspect.findMany({
        where: { tenantId: tId, deletedAt: null },
        include: {
          actions: true,
          controls: true,
          reviews: { orderBy: { reviewDate: 'desc' }, take: 1 },
        },
      });
    });

    const alerts = aspects.map((a: any) => {
      const flags: string[] = [];
      if (a.isSignificant && (!a.actions || a.actions.length === 0)) {
        flags.push('significant-no-actions');
      }
      if (a.isSignificant && (!a.controls || a.controls.length === 0 || !a.controls.some((c: any) => c.implemented))) {
        flags.push('significant-no-controls');
      }
      const overdueActions = a.actions?.filter((act: any) => act.dueDate && new Date(act.dueDate) < now && act.status !== 'COMPLETED');
      if (overdueActions && overdueActions.length > 0) flags.push('overdue-action');
      const notImplemented = a.controls?.filter((c: any) => !c.implemented);
      if (notImplemented && notImplemented.length > 0) flags.push('control-not-implemented');
      const notEffective = a.controls?.filter((c: any) => c.implemented && !c.effective);
      if (notEffective && notEffective.length > 0) flags.push('control-not-effective');
      const lastReview = a.reviews?.[0];
      if (!lastReview) flags.push('no-review');
      if (a.reviewDate && new Date(a.reviewDate) < now) flags.push('review-overdue');

      return {
        aspectId: a.id,
        code: a.code,
        process: a.process,
        flags,
        actionsCount: a.actions?.length ?? 0,
        controlsCount: a.controls?.length ?? 0,
      };
    }).filter((a: any) => a.flags.length > 0);

    return reply.send({ alerts, count: alerts.length });
  });

  // --- AUTO CREATE NC ---
  app.post('/:id/create-nc', async (req: FastifyRequest, reply: FastifyReply) => {
    const tId = tenantId(req);
    if (!tId) return reply.code(400).send({ error: 'Tenant context required' });
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    const aspect = await app.runWithDbContext(req, async (tx: any) => {
      return tx.environmentalAspect.findUnique({
        where: { id, tenantId: tId, deletedAt: null },
        include: {
          actions: true,
          controls: true,
          nonConformities: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      });
    });
    if (!aspect) return reply.code(404).send({ error: 'Not found' });

    const highImpact = aspect.isSignificant;
    const lowLegal = aspect.legalCompliance <= 2;
    const ineffectiveControl = aspect.controls?.some((c: any) => c.implemented && !c.effective);

    if (!highImpact && !lowLegal && !ineffectiveControl) {
      return reply.send({ created: false, reason: 'Conditions not met for NC creation' });
    }

    const recent = aspect.nonConformities?.[0];
    if (recent && recent.createdAt) {
      const days = (Date.now() - new Date(recent.createdAt).getTime()) / (24 * 3600 * 1000);
      if (days < 30) {
        return reply.send({ created: false, reason: 'Recent NC exists', existingNcrId: recent.id });
      }
    }

    const title = `Aspecto Ambiental: ${aspect.code} - ${aspect.process}`;
    const description = `Aspecto ambiental significativo identificado. Proceso: ${aspect.process}. Aspecto: ${aspect.aspect}. Impacto: ${aspect.impact}. Significancia: ${aspect.significance}.`;

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
          source: 'PROCESS_DEVIATION',
          severity: highImpact ? 'MAJOR' : 'MINOR',
          status: 'OPEN',
          dueDate: new Date(Date.now() + 30 * 24 * 3600 * 1000),
          environmentalAspectId: id,
          createdById: (req as any).auth?.userId ?? null,
          updatedById: (req as any).auth?.userId ?? null,
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

    const aspect = await app.runWithDbContext(req, async (tx: any) => {
      return tx.environmentalAspect.findUnique({
        where: { id, tenantId: tId, deletedAt: null },
        include: { actions: true, controls: true },
      });
    });
    if (!aspect) return reply.code(404).send({ error: 'Aspect not found' });

    const prompt = `Analiza el siguiente aspecto ambiental de un SGA (ISO 14001):

Proceso: ${aspect.process}
Aspecto: ${aspect.aspect}
Impacto: ${aspect.impact}
Categoria: ${aspect.category}
Condicion: ${aspect.condition}
Naturaleza: ${aspect.naturalness}
Magnitud: ${aspect.magnitude}, Severidad: ${aspect.severity}, Frecuencia: ${aspect.frequency}, Cumplimiento legal: ${aspect.legalCompliance}
Significancia: ${aspect.significance} (Significativo: ${aspect.isSignificant ? 'Si' : 'No'})
Controles actuales: ${aspect.controls?.map((c: any) => `${c.type}: ${c.description} (implementado: ${c.implemented ? 'Si' : 'No'}, eficaz: ${c.effective ? 'Si' : 'No'})`).join(', ') || 'Ninguno'}
Acciones abiertas: ${aspect.actions?.length || 0}

Tarea:
1. Evalua si la evaluacion de significancia es coherente.
2. Sugiere controles adicionales si es necesario.
3. Recomienda acciones correctivas si el aspecto es significativo y no tiene controles suficientes.
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
