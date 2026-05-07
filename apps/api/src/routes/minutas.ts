import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

const emptyToUndefined = <T>(val: T): T | undefined => (val === '' ? undefined : val);

export const minutasRoutes: FastifyPluginAsync = async (app) => {
  // GET /minutas — Listar minutas del tenant
  app.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const tenantId = req.db.tenantId;

    const items = await app.runWithDbContext(req, async (tx: any) => {
      return tx.minuta.findMany({
        where: { tenantId, deletedAt: null },
        orderBy: { date: 'desc' },
      });
    });
    return reply.send(items);
  });

  // GET /minutas/:id — Obtener minuta por ID
  app.get('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    const tenantId = req.db.tenantId;

    const item = await app.runWithDbContext(req, async (tx: any) => {
      return tx.minuta.findFirst({
        where: { id, tenantId, deletedAt: null },
      });
    });

    if (!item) return reply.code(404).send({ error: 'Minuta no encontrada' });
    return reply.send(item);
  });

  // POST /minutas — Crear minuta
  app.post('/', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const tenantId = req.db.tenantId;

    const schema = z.object({
      title: z.string().min(1),
      date: z.string(),
      time: emptyToUndefined(z.string().optional()),
      duration: emptyToUndefined(z.string().optional()),
      area: emptyToUndefined(z.string().optional()),
      type: z.string(),
      participants: z.array(z.string()).default([]),
      responsible: emptyToUndefined(z.string().optional()),
      clientId: emptyToUndefined(z.string().optional()),
      supplierId: emptyToUndefined(z.string().optional()),
      projectId: emptyToUndefined(z.string().optional()),
      tags: z.array(z.string()).default([]),
      priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
      status: z.string().default('DRAFT'),
      confidentiality: z.string().default('INTERNAL'),
      attachments: z.array(z.string()).default([]),
      audioUrl: emptyToUndefined(z.string().optional()),
      content: emptyToUndefined(z.string().optional()),
      summary: emptyToUndefined(z.string().optional()),
    });

    let data;
    try {
      data = schema.parse(req.body);
    } catch (e: any) {
      console.error('[minutas POST] Zod validation error:', e.errors || e.message);
      return reply.code(400).send({ error: 'Validación fallida', details: e.errors || e.message });
    }

    const item = await app.runWithDbContext(req, async (tx: any) => {
      return tx.minuta.create({
        data: {
          tenantId,
          ...data,
          date: new Date(data.date),
        },
      });
    });

    return reply.code(201).send(item);
  });

  // PATCH /minutas/:id — Actualizar minuta
  app.patch('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    const tenantId = req.db.tenantId;

    const schema = z.object({
      title: z.string().optional(),
      date: z.string().optional(),
      time: emptyToUndefined(z.string().optional()),
      duration: emptyToUndefined(z.string().optional()),
      area: emptyToUndefined(z.string().optional()),
      type: z.string().optional(),
      participants: z.array(z.string()).optional(),
      responsible: emptyToUndefined(z.string().optional()),
      clientId: emptyToUndefined(z.string().optional()),
      supplierId: emptyToUndefined(z.string().optional()),
      projectId: emptyToUndefined(z.string().optional()),
      tags: z.array(z.string()).optional(),
      priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
      status: z.string().optional(),
      confidentiality: z.string().optional(),
      attachments: z.array(z.string()).optional(),
      audioUrl: emptyToUndefined(z.string().optional()),
      content: emptyToUndefined(z.string().optional()),
      summary: emptyToUndefined(z.string().optional()),
      aiProcessed: z.boolean().optional(),
    });

    let data;
    try {
      data = schema.parse(req.body);
    } catch (e: any) {
      console.error('[minutas PATCH] Zod validation error:', e.errors || e.message);
      return reply.code(400).send({ error: 'Validación fallida', details: e.errors || e.message });
    }

    const item = await app.runWithDbContext(req, async (tx: any) => {
      return tx.minuta.update({
        where: { id, tenantId },
        data: {
          ...data,
          ...(data.date !== undefined ? { date: new Date(data.date) } : {}),
        },
      });
    });

    return reply.send(item);
  });

  // DELETE /minutas/:id — Eliminar minuta (soft delete)
  app.delete('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    const tenantId = req.db.tenantId;

    await app.runWithDbContext(req, async (tx: any) => {
      return tx.minuta.update({
        where: { id, tenantId },
        data: { deletedAt: new Date() },
      });
    });

    return reply.code(204).send();
  });
};
