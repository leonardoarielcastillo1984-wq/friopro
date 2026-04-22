import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

const mapSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  scope: z.string().optional(),
  inputLabel: z.string().optional(),
  outputLabel: z.string().optional(),
});

const processSchema = z.object({
  layer: z.enum(['STRATEGIC', 'OPERATIONAL', 'SUPPORT']),
  name: z.string().min(1),
  description: z.string().optional(),
  owner: z.string().optional(),
  inputs: z.string().optional(),
  outputs: z.string().optional(),
  indicators: z.string().optional(),
  documents: z.string().optional(),
  risks: z.string().optional(),
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

    const body = processSchema.parse(req.body);
    const process = await app.runWithDbContext(req, async (tx: any) => {
      return tx.process.create({ data: { ...body, tenantId, processMapId: req.params.id } });
    });
    return reply.code(201).send(process);
  });

  // ── PUT /process-maps/:id/processes/:pid ──────────────────────
  app.put('/:id/processes/:pid', async (req: FastifyRequest<{ Params: { id: string; pid: string } }>, reply: FastifyReply) => {
    const body = processSchema.partial().parse(req.body);
    const process = await app.runWithDbContext(req, async (tx: any) => {
      return tx.process.update({ where: { id: req.params.pid }, data: body });
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
};
