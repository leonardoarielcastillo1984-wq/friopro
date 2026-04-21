import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { getStorageUsage } from '../services/storage-usage.js';

export const storageRoutes: FastifyPluginAsync = async (app) => {
  // GET /storage/usage — uso de almacenamiento del tenant autenticado
  app.get('/usage', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = (req as any).db?.tenantId ?? (req as any).auth?.tenantId;
    if (!tenantId) {
      return reply.code(400).send({ error: 'Tenant context required' });
    }

    const usage = await getStorageUsage((app as any).prisma, tenantId);
    return reply.send(usage);
  });
};
