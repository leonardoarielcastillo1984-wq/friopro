import { isSuperAdmin, getEffectiveTenantId } from '../utils/tenant-bypass.js';
/**
 * Rutas específicas para calibraciones de equipos de medición
 * Incluye CRUD de calibraciones y upload de certificados
 */
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export const calibrationsRoutes: FastifyPluginAsync = async (app) => {
  // GET /calibrations/:equipmentId - Obtener calibraciones de un equipo
  app.get('/:equipmentId', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { equipmentId } = z.object({ equipmentId: z.string().uuid() }).parse(req.params);

    const calibrations = await app.runWithDbContext(req, async (tx: any) => {
      return tx.calibration.findMany({
        where: { equipmentId, tenantId },
        orderBy: { date: 'desc' },
      });
    });

    return reply.send({ calibrations });
  });

  // POST /calibrations - Crear nueva calibración
  app.post('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    let body = req.body as any;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        return reply.code(400).send({ error: 'Cuerpo JSON inválido' });
      }
    }

    const { equipmentId, date, provider, certificateNumber, certificateUrl, result, notes, nextCalibrationDate, cost } = body;

    try {
      const calibration = await app.runWithDbContext(req, async (tx: any) => {
        const data: any = {
          tenantId,
          equipmentId,
          date: date ? new Date(date) : new Date(),
          provider: provider || null,
          certificateNumber: certificateNumber || null,
          certificateUrl: certificateUrl || null,
          result: result || 'CONFORMING',
          notes: notes || null,
          nextCalibrationDate: nextCalibrationDate ? new Date(nextCalibrationDate) : null,
          cost: cost ? Number(cost) : null,
        };

        const created = await tx.calibration.create({ data });

        // Actualizar el equipo con la última fecha de calibración
        await tx.measuringEquipment.update({
          where: { id: equipmentId },
          data: {
            lastCalibrationDate: new Date(date),
            nextCalibrationDate: nextCalibrationDate ? new Date(nextCalibrationDate) : null,
          },
        });

        return created;
      });

      return reply.code(201).send({ calibration });
    } catch (err: any) {
      console.error('[CALIBRATIONS_POST] Error:', err?.message);
      return reply.code(500).send({ error: err?.message || 'Error al crear calibración' });
    }
  });

  // PATCH /calibrations/:id - Actualizar calibración
  app.patch('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    let body = req.body as any;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        return reply.code(400).send({ error: 'Cuerpo JSON inválido' });
      }
    }

    try {
      const calibration = await app.runWithDbContext(req, async (tx: any) => {
        const existing = await tx.calibration.findFirst({
          where: { id, tenantId },
        });
        if (!existing) throw new Error('Calibración no encontrada');

        const data: any = {};
        if (body.date !== undefined) data.date = new Date(body.date);
        if (body.provider !== undefined) data.provider = body.provider;
        if (body.certificateNumber !== undefined) data.certificateNumber = body.certificateNumber;
        if (body.certificateUrl !== undefined) data.certificateUrl = body.certificateUrl;
        if (body.result !== undefined) data.result = body.result;
        if (body.notes !== undefined) data.notes = body.notes;
        if (body.nextCalibrationDate !== undefined) data.nextCalibrationDate = new Date(body.nextCalibrationDate);
        if (body.cost !== undefined) data.cost = Number(body.cost);

        const updated = await tx.calibration.update({
          where: { id },
          data,
        });

        // Si se actualiza la fecha, actualizar también el equipo
        if (body.date || body.nextCalibrationDate) {
          await tx.measuringEquipment.update({
            where: { id: existing.equipmentId },
            data: {
              lastCalibrationDate: body.date ? new Date(body.date) : existing.date,
              nextCalibrationDate: body.nextCalibrationDate ? new Date(body.nextCalibrationDate) : existing.nextCalibrationDate,
            },
          });
        }

        return updated;
      });

      return reply.send({ calibration });
    } catch (err: any) {
      console.error('[CALIBRATIONS_PATCH] Error:', err?.message);
      return reply.code(500).send({ error: err?.message || 'Error al actualizar calibración' });
    }
  });

  // DELETE /calibrations/:id - Eliminar calibración
  app.delete('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    try {
      await app.runWithDbContext(req, async (tx: any) => {
        const existing = await tx.calibration.findFirst({
          where: { id, tenantId },
        });
        if (!existing) throw new Error('Calibración no encontrada');

        await tx.calibration.delete({ where: { id } });
      });

      return reply.send({ deleted: true });
    } catch (err: any) {
      console.error('[CALIBRATIONS_DELETE] Error:', err?.message);
      return reply.code(500).send({ error: err?.message || 'Error al eliminar calibración' });
    }
  });

  // POST /calibrations/upload - Subir certificado de calibración
  app.post('/upload', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    try {
      const data = await req.file();
      if (!data) {
        return reply.code(400).send({ error: 'No se proporcionó archivo' });
      }

      // Validar tamaño (máximo 10MB)
      const MAX_SIZE = 10 * 1024 * 1024;
      if (data.file.bytesRead > MAX_SIZE) {
        return reply.code(400).send({ error: 'El archivo excede el tamaño máximo de 10MB' });
      }

      // Validar tipo
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
      if (!allowedTypes.includes(data.mimetype)) {
        return reply.code(400).send({ error: 'Solo se permiten archivos PDF, JPG o PNG' });
      }

      // Crear directorio de uploads si no existe
      const uploadDir = join(process.env.STORAGE_LOCAL_PATH || '/app/uploads', 'calibrations', tenantId);
      if (!existsSync(uploadDir)) {
        await mkdir(uploadDir, { recursive: true });
      }

      // Generar nombre único
      const timestamp = Date.now();
      const ext = data.filename.split('.').pop();
      const filename = `calibration_${timestamp}.${ext}`;
      const filepath = join(uploadDir, filename);

      // Guardar archivo
      const buffer = await data.toBuffer();
      await writeFile(filepath, buffer);

      // Retornar ruta relativa para acceso web
      const relativePath = `/uploads/calibrations/${tenantId}/${filename}`;

      return reply.send({ filePath: relativePath });
    } catch (err: any) {
      console.error('[CALIBRATIONS_UPLOAD] Error:', err?.message);
      return reply.code(500).send({ error: err?.message || 'Error al subir archivo' });
    }
  });
};
