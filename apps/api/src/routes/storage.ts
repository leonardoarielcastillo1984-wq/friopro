import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { getStorageUsage } from '../services/storage-usage.js';

const STORAGE_ALERT_THRESHOLD = 0.8; // 80%

export const storageRoutes: FastifyPluginAsync = async (app) => {
  // GET /storage/usage — uso de almacenamiento del tenant autenticado
  app.get('/usage', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = (req as any).db?.tenantId ?? (req as any).auth?.tenantId;
    if (!tenantId) {
      return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    }

    const prisma = (app as any).prisma;
    const usage = await getStorageUsage(prisma, tenantId);

    // Desglose por módulo: sumar fileSize de cada colección
    const [docBytes, normBytes] = await Promise.all([
      prisma.document.aggregate({
        where: { tenantId, deletedAt: null },
        _sum: { fileSize: true },
      }),
      prisma.normativeStandard.aggregate({
        where: { tenantId, deletedAt: null },
        _sum: { fileSize: true },
      }),
    ]);

    const breakdown = {
      documentos: Number(docBytes._sum.fileSize ?? 0),
      normativos: Number(normBytes._sum.fileSize ?? 0),
    };

    const nearLimit = usage.percentage >= STORAGE_ALERT_THRESHOLD * 100;

    return reply.send({
      ...usage,
      breakdown,
      nearLimit,
      alert: nearLimit
        ? `Estás usando el ${usage.percentage.toFixed(1)}% de tu almacenamiento disponible. Considerá eliminar archivos o contactar soporte para ampliar tu capacidad.`
        : null,
    });
  });
};
