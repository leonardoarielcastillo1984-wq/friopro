import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

const mapSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  scope: z.string().optional(),
  inputLabel: z.string().optional(),
  outputLabel: z.string().optional(),
});

const emptyToUndefined = <T extends z.ZodTypeAny>(schema: T) => z.preprocess((val) => (val === '' || val === null ? undefined : val), schema);

const processSchema = z.object({
  layer: z.enum(['STRATEGIC', 'OPERATIONAL', 'SUPPORT']),
  name: z.string().min(1),
  code: emptyToUndefined(z.string().optional()),
  status: z.enum(['active', 'inactive']).optional().default('active'),
  description: emptyToUndefined(z.string().optional()),
  owner: emptyToUndefined(z.string().optional()),
  inputs: emptyToUndefined(z.string().optional()),
  outputs: emptyToUndefined(z.string().optional()),
  sites: z.array(z.string()).optional().default([]),
  departmentId: emptyToUndefined(z.string().uuid().optional().nullable()),
  indicators: emptyToUndefined(z.string().optional()),
  documents: emptyToUndefined(z.string().optional()),
  risks: emptyToUndefined(z.string().optional()),
  order: z.number().int().optional(),
});

export const processMapsRoutes: FastifyPluginAsync = async (app) => {
  // ── GET /process-maps ──────────────────────────────────────────
  app.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = req.db?.tenantId ?? req.auth?.tenantId;
    if (!tenantId) return reply.code(400).send({ error: 'Tenant context required' });

    const maps = await app.runWithDbContext(req, async (tx: any) => {
      return tx.processMap.findMany({
        where: { tenantId, deletedAt: null },
        include: {
          processes: { where: { deletedAt: null }, orderBy: [{ layer: 'asc' }, { order: 'asc' }] },
        },
        orderBy: { createdAt: 'asc' },
      });
    });
    return reply.send(maps);
  });

  // ── POST /process-maps ─────────────────────────────────────────
  app.post('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = req.db?.tenantId ?? req.auth?.tenantId;
    if (!tenantId) return reply.code(400).send({ error: 'Tenant context required' });

    const body = mapSchema.parse(req.body);
    const map = await app.runWithDbContext(req, async (tx: any) => {
      return tx.processMap.create({
        data: { ...body, tenantId, createdById: req.auth?.userId ?? null },
        include: { processes: true },
      });
    });
    return reply.code(201).send(map);
  });

  // ── PUT /process-maps/:id ──────────────────────────────────────
  app.put('/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenantId = req.db?.tenantId ?? req.auth?.tenantId;
    if (!tenantId) return reply.code(400).send({ error: 'Tenant context required' });

    const body = mapSchema.partial().parse(req.body);
    const map = await app.runWithDbContext(req, async (tx: any) => {
      return tx.processMap.update({
        where: { id: req.params.id },
        data: body,
        include: { processes: { where: { deletedAt: null }, orderBy: [{ layer: 'asc' }, { order: 'asc' }] } },
      });
    });
    return reply.send(map);
  });

  // ── DELETE /process-maps/:id ───────────────────────────────────
  app.delete('/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenantId = req.db?.tenantId ?? req.auth?.tenantId;
    if (!tenantId) return reply.code(400).send({ error: 'Tenant context required' });

    await app.runWithDbContext(req, async (tx: any) => {
      return tx.processMap.update({ where: { id: req.params.id }, data: { deletedAt: new Date() } });
    });
    return reply.code(204).send();
  });

  // ── POST /process-maps/:id/processes ──────────────────────────
  app.post('/:id/processes', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenantId = req.db?.tenantId ?? req.auth?.tenantId;
    if (!tenantId) return reply.code(400).send({ error: 'Tenant context required' });

    let body;
    try {
      body = processSchema.parse(req.body);
    } catch (e: any) {
      console.error('[processMaps POST processes] Zod validation error:', e.errors || e.message, 'Body keys:', Object.keys(req.body || {}));
      return reply.code(400).send({ error: 'Validation failed', details: e.errors || e.message });
    }
    const process = await app.runWithDbContext(req, async (tx: any) => {
      return tx.process.create({ data: { ...body, tenantId, processMapId: req.params.id } });
    });
    return reply.code(201).send(process);
  });

  // ── PATCH /process-maps/:id/processes/:pid ──────────────────────
  app.patch('/:id/processes/:pid', async (req: FastifyRequest<{ Params: { id: string; pid: string } }>, reply: FastifyReply) => {
    const body = processSchema.partial().parse(req.body);
    const process = await app.runWithDbContext(req, async (tx: any) => {
      return tx.process.update({
        where: { id: req.params.pid },
        data: body,
        include: {
          processIndicators: true,
          processDocuments: true,
          processRisks: true,
        },
      });
    });
    return reply.send(process);
  });

  // ── DELETE /process-maps/:id/processes/:pid ───────────────────
  app.delete('/:id/processes/:pid', async (req: FastifyRequest<{ Params: { id: string; pid: string } }>, reply: FastifyReply) => {
    await app.runWithDbContext(req, async (tx: any) => {
      return tx.process.update({ where: { id: req.params.pid }, data: { deletedAt: new Date() } });
    });
    return reply.code(204).send();
  });

  // ── Relaciones: Indicadores ────────────────────────────────────
  app.post('/:id/processes/:pid/indicators', async (req: FastifyRequest<{ Params: { id: string; pid: string } }>, reply: FastifyReply) => {
    const { indicatorId } = z.object({ indicatorId: z.string().uuid() }).parse(req.body);
    const rel = await app.runWithDbContext(req, async (tx: any) => {
      return tx.processIndicator.create({ data: { processId: req.params.pid, indicatorId } });
    });
    return reply.code(201).send(rel);
  });

  app.delete('/:id/processes/:pid/indicators/:rid', async (req: FastifyRequest<{ Params: { id: string; pid: string; rid: string } }>, reply: FastifyReply) => {
    await app.runWithDbContext(req, async (tx: any) => {
      return tx.processIndicator.delete({ where: { id: req.params.rid } });
    });
    return reply.code(204).send();
  });

  // ── Relaciones: Documentos ─────────────────────────────────────
  app.post('/:id/processes/:pid/documents', async (req: FastifyRequest<{ Params: { id: string; pid: string } }>, reply: FastifyReply) => {
    const { documentId } = z.object({ documentId: z.string().uuid() }).parse(req.body);
    const rel = await app.runWithDbContext(req, async (tx: any) => {
      return tx.processDocument.create({ data: { processId: req.params.pid, documentId } });
    });
    return reply.code(201).send(rel);
  });

  app.delete('/:id/processes/:pid/documents/:rid', async (req: FastifyRequest<{ Params: { id: string; pid: string; rid: string } }>, reply: FastifyReply) => {
    await app.runWithDbContext(req, async (tx: any) => {
      return tx.processDocument.delete({ where: { id: req.params.rid } });
    });
    return reply.code(204).send();
  });

  // ── Relaciones: Riesgos ────────────────────────────────────────
  app.post('/:id/processes/:pid/risks', async (req: FastifyRequest<{ Params: { id: string; pid: string } }>, reply: FastifyReply) => {
    const { riskId } = z.object({ riskId: z.string().uuid() }).parse(req.body);
    const rel = await app.runWithDbContext(req, async (tx: any) => {
      return tx.processRisk.create({ data: { processId: req.params.pid, riskId } });
    });
    return reply.code(201).send(rel);
  });

  app.delete('/:id/processes/:pid/risks/:rid', async (req: FastifyRequest<{ Params: { id: string; pid: string; rid: string } }>, reply: FastifyReply) => {
    await app.runWithDbContext(req, async (tx: any) => {
      return tx.processRisk.delete({ where: { id: req.params.rid } });
    });
    return reply.code(204).send();
  });
};
