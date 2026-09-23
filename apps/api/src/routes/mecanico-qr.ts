import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import { applyWorkOrderUpdate } from './maintenance.js';

const generateToken = () => crypto.randomBytes(20).toString('hex');

export async function mecanicoQRRoutes(app: FastifyInstance) {
  const prisma = () => app.prisma as any;

  // ═══════════════════════════════════════════════════════════════════════
  // ADMIN (autenticado) — generar / listar / desactivar QR de un mecánico
  // ═══════════════════════════════════════════════════════════════════════

  // GET /mecanico-qr/qrs?scope=fleet - Listar QRs generados por mecánico
  app.get('/qrs', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { scope } = request.query as any;

    const qrs = await prisma().mechanicQR.findMany({
      where: {
        tenantId: request.db.tenantId,
        ...(scope ? { technician: { scope: String(scope).toUpperCase() } } : {}),
      },
      include: {
        technician: { select: { id: true, name: true, code: true, specialization: true, scope: true } },
      },
      orderBy: { generatedAt: 'desc' },
    });

    const baseUrl = process.env.APP_URL || 'https://logismart.ar';
    return reply.send({
      qrs: qrs.map((q: any) => ({
        id: q.id,
        token: q.token,
        isActive: q.isActive,
        useCount: q.useCount,
        lastUsedAt: q.lastUsedAt,
        technicianId: q.technicianId,
        technicianNombre: q.technician?.name,
        technicianCode: q.technician?.code,
        publicUrl: `${baseUrl}/mecanico-qr/${q.token}`,
      })),
    });
  });

  // POST /mecanico-qr/qrs - Generar (o reactivar) el QR de un mecánico
  app.post('/qrs', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    const schema = z.object({ technicianId: z.string().uuid() });
    const body = schema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos', details: body.error.errors });

    const tecnico = await prisma().maintenanceTechnician.findFirst({
      where: { id: body.data.technicianId, tenantId: request.db.tenantId },
    });
    if (!tecnico) return reply.code(404).send({ error: 'Mecánico no encontrado' });

    const existente = await prisma().mechanicQR.findFirst({
      where: { technicianId: tecnico.id, tenantId: request.db.tenantId },
    });

    let qr;
    if (existente) {
      qr = await prisma().mechanicQR.update({
        where: { id: existente.id },
        data: { isActive: true },
      });
    } else {
      qr = await prisma().mechanicQR.create({
        data: { tenantId: request.db.tenantId, technicianId: tecnico.id, token: generateToken() },
      });
    }

    const baseUrl = process.env.APP_URL || 'https://logismart.ar';
    return reply.code(201).send({
      qr: {
        id: qr.id, token: qr.token, isActive: qr.isActive, technicianId: tecnico.id,
        technicianNombre: tecnico.name, publicUrl: `${baseUrl}/mecanico-qr/${qr.token}`,
      },
    });
  });

  // DELETE /mecanico-qr/qrs/:id - Desactivar QR
  app.delete('/qrs/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = request.params as any;
    await prisma().mechanicQR.updateMany({
      where: { id, tenantId: request.db.tenantId },
      data: { isActive: false },
    });
    return reply.send({ ok: true });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // PÚBLICO (sin auth, acceso vía token del QR escaneado por el mecánico)
  // ═══════════════════════════════════════════════════════════════════════

  const cargarQR = async (token: string) => {
    return prisma().mechanicQR.findFirst({
      where: { token, isActive: true },
      include: { technician: true },
    });
  };

  const serializarOrden = async (o: any) => {
    let vehiculo: any = null;
    if (o.assetId) {
      vehiculo = await prisma().vehiculo.findFirst({
        where: { maintenanceAssetId: o.assetId },
        select: { id: true, dominio: true, marca: true, modelo: true, tipo: true },
      });
    }
    return {
      id: o.id, code: o.code, title: o.title, description: o.description,
      type: o.type, priority: o.priority, status: o.status,
      scheduledDate: o.scheduledDate, startedAt: o.startedAt, completedAt: o.completedAt,
      estimatedDuration: o.estimatedDuration,
      activo: o.asset ? { id: o.asset.id, name: o.asset.name, code: o.asset.code, currentOdometer: o.asset.currentOdometer } : null,
      activoNombreLibre: o.activoNombreLibre,
      vehiculo,
    };
  };

  // GET /mecanico-qr/public/:token - Tareas asignadas al mecánico (hoy, pendientes, en curso)
  app.get('/public/:token', async (req: FastifyRequest, reply: FastifyReply) => {
    const { token } = req.params as any;
    const qr = await cargarQR(token);
    if (!qr) return reply.code(404).send({ error: 'QR no encontrado o inactivo' });

    const ordenesRaw = await prisma().workOrder.findMany({
      where: {
        tenantId: qr.tenantId,
        technicianId: qr.technicianId,
        status: { in: ['PENDING', 'IN_PROGRESS', 'ON_HOLD'] },
      },
      include: { asset: true },
      orderBy: [{ status: 'asc' }, { scheduledDate: 'asc' }],
    });

    const hoyInicio = new Date(); hoyInicio.setHours(0, 0, 0, 0);
    const completadasHoyRaw = await prisma().workOrder.findMany({
      where: {
        tenantId: qr.tenantId,
        technicianId: qr.technicianId,
        status: 'COMPLETED',
        completedAt: { gte: hoyInicio },
      },
      include: { asset: true },
      orderBy: { completedAt: 'desc' },
      take: 20,
    });

    const repuestosDisponibles = await prisma().maintenanceSparePart.findMany({
      where: { tenantId: qr.tenantId, currentStock: { gt: 0 } },
      select: { id: true, code: true, name: true, currentStock: true, unitCost: true },
      orderBy: { name: 'asc' },
    });

    await prisma().mechanicQR.update({
      where: { id: qr.id },
      data: { useCount: { increment: 1 }, lastUsedAt: new Date() },
    });

    return reply.send({
      mecanico: { id: qr.technician.id, name: qr.technician.name, code: qr.technician.code, specialization: qr.technician.specialization },
      ordenes: await Promise.all(ordenesRaw.map(serializarOrden)),
      completadasHoy: await Promise.all(completadasHoyRaw.map(serializarOrden)),
      repuestosDisponibles,
    });
  });

  // POST /mecanico-qr/public/:token/ordenes/:workOrderId/iniciar - Marcar OT en curso
  app.post('/public/:token/ordenes/:workOrderId/iniciar', async (req: FastifyRequest, reply: FastifyReply) => {
    const { token, workOrderId } = req.params as any;
    const qr = await cargarQR(token);
    if (!qr) return reply.code(404).send({ error: 'QR no encontrado o inactivo' });

    const orden = await prisma().workOrder.findFirst({ where: { id: workOrderId, tenantId: qr.tenantId, technicianId: qr.technicianId } });
    if (!orden) return reply.code(404).send({ error: 'Orden no encontrada o no asignada a este mecánico' });
    if (orden.status === 'COMPLETED') return reply.code(400).send({ error: 'La orden ya está completada' });

    const result = await applyWorkOrderUpdate(prisma(), qr.tenantId, workOrderId, { status: 'IN_PROGRESS', startedAt: orden.startedAt || new Date() });
    if ('error' in result) return reply.code(result.status).send({ error: result.error });
    return reply.send({ orden: await serializarOrden(result.workOrder) });
  });

  // POST /mecanico-qr/public/:token/ordenes/:workOrderId/completar - Finalizar OT con evidencia
  app.post('/public/:token/ordenes/:workOrderId/completar', async (req: FastifyRequest, reply: FastifyReply) => {
    const { token, workOrderId } = req.params as any;
    const qr = await cargarQR(token);
    if (!qr) return reply.code(404).send({ error: 'QR no encontrado o inactivo' });

    const schema = z.object({
      notas: z.string().max(2000).optional(),
      odometro: z.number().positive().optional(),
      repuestos: z.array(z.object({ sparePartId: z.string().uuid(), quantity: z.number().int().positive() })).optional(),
    });
    const body = schema.safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos', details: body.error.errors });

    const orden = await prisma().workOrder.findFirst({ where: { id: workOrderId, tenantId: qr.tenantId, technicianId: qr.technicianId } });
    if (!orden) return reply.code(404).send({ error: 'Orden no encontrada o no asignada a este mecánico' });
    if (orden.status === 'COMPLETED') return reply.code(400).send({ error: 'La orden ya está completada' });

    // Asignar repuestos utilizados a la OT (se descuentan del stock al aplicar el update)
    if (body.data.repuestos && body.data.repuestos.length > 0) {
      for (const r of body.data.repuestos) {
        const parte = await prisma().maintenanceSparePart.findFirst({ where: { id: r.sparePartId, tenantId: qr.tenantId } });
        if (!parte) continue;
        await prisma().workOrderSparePart.create({
          data: { tenantId: qr.tenantId, workOrderId, sparePartId: parte.id, quantity: r.quantity, unitCost: parte.unitCost },
        });
      }
    }

    // Nota de cierre: observaciones + odómetro informado (queda trazable en la OT
    // aunque el activo no tenga vehículo vinculado en Flota 360)
    const partesCierre: string[] = [];
    if (body.data.notas) partesCierre.push(body.data.notas);
    if (body.data.odometro) partesCierre.push(`Odómetro: ${body.data.odometro} km`);
    const descripcionFinal = partesCierre.length > 0
      ? `${orden.description ? orden.description + '\n\n' : ''}Cierre del mecánico: ${partesCierre.join(' · ')}`
      : undefined;

    const result = await applyWorkOrderUpdate(prisma(), qr.tenantId, workOrderId, {
      status: 'COMPLETED',
      description: descripcionFinal,
      odometro: body.data.odometro,
      finalOdometer: body.data.odometro,
    });
    if ('error' in result) return reply.code(result.status).send({ error: result.error });
    return reply.send({ orden: await serializarOrden(result.workOrder), mensaje: `Orden ${result.workOrder.code} marcada como completada` });
  });
}
