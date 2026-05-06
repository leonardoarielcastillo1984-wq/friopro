import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { getStorageUsage, incrementStorageUsed } from '../services/storage-usage.js';
import fs from 'fs/promises';
import path from 'path';

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

  // POST /storage/upload — Subir archivo genérico
  app.post('/upload', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = (req as any).db?.tenantId ?? (req as any).auth?.tenantId;
      if (!tenantId) {
        return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      }

      const data = await req.file();
      if (!data) {
        return reply.code(400).send({ error: 'No file uploaded' });
      }

      // Leer archivo
      const chunks: Buffer[] = [];
      for await (const chunk of data.file) {
        chunks.push(chunk);
      }
      const fileBuffer = Buffer.concat(chunks);

      // Guardar archivo
      const storageBase = process.env.STORAGE_LOCAL_PATH || '/app/uploads';
      const uploadDir = path.resolve(storageBase, tenantId, 'files');
      await fs.mkdir(uploadDir, { recursive: true });

      const fileName = `${Date.now()}-${data.filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const filePath = path.join(uploadDir, fileName);
      await fs.writeFile(filePath, fileBuffer);

      // Incrementar uso de storage
      const prisma = (app as any).prisma;
      await incrementStorageUsed(prisma, tenantId, fileBuffer.length);

      // Construir URL pública
      const host = req.headers.host || process.env.APP_URL || 'localhost:3000';
      const protocol = host.includes('localhost') ? 'http' : 'https';
      const url = `${protocol}://${host}/uploads/${tenantId}/files/${fileName}`;

      return reply.send({
        url,
        size: fileBuffer.length,
        type: data.mimetype,
        name: data.filename,
      });
    } catch (err: any) {
      console.error('[STORAGE_UPLOAD] Error:', err.message);
      return reply.code(500).send({ error: 'Error uploading file: ' + err.message });
    }
  });
};
