import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Prisma } from '@prisma/client';

export async function policiesRoutes(app: FastifyInstance) {
  app.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    await req.jwtVerify();
    const tenantId = req.auth?.tenantId;
    const policies = await (app as any).prisma.policy.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return reply.send(policies);
  });

  app.get('/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    await req.jwtVerify();
    const tenantId = req.auth?.tenantId;
    const policy = await (app as any).prisma.policy.findFirst({
      where: { id: req.params.id, tenantId, deletedAt: null },
    });
    if (!policy) return reply.status(404).send({ error: 'Política no encontrada' });
    return reply.send(policy);
  });

  app.post('/', async (req: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    await req.jwtVerify();
    const tenantId = req.auth?.tenantId;
    const userId = req.auth?.userId;
    const { name, content, scope = 'QUALITY', active = true } = req.body;
    const policy = await (app as any).prisma.policy.create({
      data: {
        name,
        content: content || '',
        scope,
        active,
        tenantId,
        createdBy: userId,
      },
    });
    return reply.status(201).send(policy);
  });

  app.put('/:id', async (req: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
    await req.jwtVerify();
    const tenantId = req.auth?.tenantId;
    const { name, content, scope, active } = req.body;
    const existing = await (app as any).prisma.policy.findFirst({
      where: { id: req.params.id, tenantId, deletedAt: null },
    });
    if (!existing) return reply.status(404).send({ error: 'Política no encontrada' });
    const policy = await (app as any).prisma.policy.update({
      where: { id: req.params.id },
      data: {
        name,
        content: content !== undefined ? content : existing.content,
        scope: scope !== undefined ? scope : existing.scope,
        active: active !== undefined ? active : existing.active,
      },
    });
    return reply.send(policy);
  });

  app.delete('/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    await req.jwtVerify();
    const tenantId = req.auth?.tenantId;
    const existing = await (app as any).prisma.policy.findFirst({
      where: { id: req.params.id, tenantId, deletedAt: null },
    });
    if (!existing) return reply.status(404).send({ error: 'Política no encontrada' });
    await (app as any).prisma.policy.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });
    return reply.status(204).send();
  });
}
