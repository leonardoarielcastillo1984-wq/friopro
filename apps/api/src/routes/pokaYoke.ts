import { getEffectiveTenantId } from '../utils/tenant-bypass.js';
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

// IATF 16949 §10.2.4 — Error-proofing (poka-yoke):
// registro de dispositivos/métodos a prueba de error + verificación periódica.
export const pokaYokeRoutes: FastifyPluginAsync = async (app) => {

  // GET /poka-yoke — dispositivos con estado de verificación calculado
  app.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    const devices = await app.runWithDbContext(req, async (tx: any) => {
      return tx.pokaYokeDevice.findMany({
        where: { tenantId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { verifications: true } } },
      });
    });

    const now = Date.now();
    const items = devices.map((d: any) => ({
      ...d,
      verificationsCount: d._count?.verifications ?? 0,
      verificationDue: d.nextVerificationAt ? new Date(d.nextVerificationAt).getTime() <= now : !d.lastVerifiedAt,
    }));

    return reply.send({ devices: items });
  });

  // POST /poka-yoke — crear dispositivo
  app.post('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    const schema = z.object({
      name: z.string().min(2),
      type: z.enum(['CONTROL', 'WARNING']).default('CONTROL'),
      location: z.string().optional().nullable(),
      process: z.string().optional().nullable(),
      defectPrevented: z.string().optional().nullable(),
      verificationFrequencyDays: z.number().int().positive().optional(),
      verificationMethod: z.string().optional().nullable(),
    });
    const body = schema.parse(req.body);

    const device = await app.runWithDbContext(req, async (tx: any) => {
      const count = await tx.pokaYokeDevice.count({ where: { tenantId } });
      const code = `PKY-${String(count + 1).padStart(3, '0')}`;
      const freq = body.verificationFrequencyDays ?? 30;
      return tx.pokaYokeDevice.create({
        data: {
          tenantId,
          code,
          name: body.name,
          type: body.type,
          location: body.location || null,
          process: body.process || null,
          defectPrevented: body.defectPrevented || null,
          verificationFrequencyDays: freq,
          verificationMethod: body.verificationMethod || null,
          nextVerificationAt: new Date(Date.now() + freq * 86400000),
          createdById: req.auth?.userId ?? null,
        },
      });
    });

    return reply.code(201).send({ device });
  });

  // PATCH /poka-yoke/:id
  app.patch('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    const schema = z.object({
      name: z.string().min(2).optional(),
      type: z.enum(['CONTROL', 'WARNING']).optional(),
      location: z.string().optional().nullable(),
      process: z.string().optional().nullable(),
      defectPrevented: z.string().optional().nullable(),
      verificationFrequencyDays: z.number().int().positive().optional(),
      verificationMethod: z.string().optional().nullable(),
      status: z.enum(['ACTIVE', 'FAILED', 'OUT_OF_SERVICE']).optional(),
      isActive: z.boolean().optional(),
    });
    const body = schema.parse(req.body);
    const data: any = { ...body };
    if (body.verificationFrequencyDays && !body.status) {
      data.nextVerificationAt = new Date(Date.now() + body.verificationFrequencyDays * 86400000);
    }

    const device = await app.runWithDbContext(req, async (tx: any) => {
      const res = await tx.pokaYokeDevice.updateMany({ where: { id, tenantId, deletedAt: null }, data });
      if (res.count === 0) return null;
      return tx.pokaYokeDevice.findFirst({ where: { id } });
    });
    if (!device) return reply.code(404).send({ error: 'Dispositivo no encontrado' });
    return reply.send({ device });
  });

  // POST /poka-yoke/:id/verify — registrar verificación periódica
  app.post('/:id/verify', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    const schema = z.object({
      result: z.enum(['PASS', 'FAIL']),
      verifiedBy: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
    });
    const body = schema.parse(req.body);

    const result = await app.runWithDbContext(req, async (tx: any) => {
      const device = await tx.pokaYokeDevice.findFirst({ where: { id, tenantId, deletedAt: null } });
      if (!device) return null;

      const now = new Date();
      await tx.pokaYokeVerification.create({
        data: {
          deviceId: id,
          tenantId,
          result: body.result,
          verifiedBy: body.verifiedBy || null,
          notes: body.notes || null,
        },
      });

      return tx.pokaYokeDevice.update({
        where: { id },
        data: {
          lastVerifiedAt: now,
          lastVerificationResult: body.result,
          nextVerificationAt: new Date(now.getTime() + device.verificationFrequencyDays * 86400000),
          status: body.result === 'FAIL' ? 'FAILED' : device.status === 'FAILED' ? 'ACTIVE' : device.status,
        },
      });
    });

    if (!result) return reply.code(404).send({ error: 'Dispositivo no encontrado' });
    return reply.send({ device: result });
  });

  // GET /poka-yoke/:id/verifications — historial
  app.get('/:id/verifications', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const verifications = await app.runWithDbContext(req, async (tx: any) => {
      return tx.pokaYokeVerification.findMany({
        where: { deviceId: id, tenantId },
        orderBy: { verifiedAt: 'desc' },
        take: 100,
      });
    });
    return reply.send({ verifications });
  });

  // DELETE /poka-yoke/:id
  app.delete('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const res = await app.runWithDbContext(req, async (tx: any) => {
      return tx.pokaYokeDevice.updateMany({ where: { id, tenantId, deletedAt: null }, data: { deletedAt: new Date() } });
    });
    if (res.count === 0) return reply.code(404).send({ error: 'Dispositivo no encontrado' });
    return reply.send({ success: true });
  });
};
