import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getEffectiveTenantId } from '../utils/tenant-bypass.js';

// ISO 45001 §8.1 — permisos de trabajo, entregas de EPP (8.1.2) y
// exámenes médicos ocupacionales (9.1.1) del SGI (independiente de SEH360)

const permitSchema = z.object({
  code: z.string().min(1),
  type: z.enum(['HEIGHTS', 'HOT_WORK', 'CONFINED_SPACE', 'ELECTRICAL', 'EXCAVATION', 'LIFTING', 'OTHER']),
  title: z.string().min(1),
  location: z.string().min(1),
  description: z.string().optional().nullable(),
  requestedBy: z.string().optional().nullable(),
  startDate: z.string(),
  endDate: z.string(),
  workers: z.array(z.string()).optional(),
  hazards: z.string().optional().nullable(),
  controls: z.string().optional().nullable(),
  ppeRequired: z.array(z.string()).optional(),
  contractorId: z.string().uuid().optional().nullable(),
});

const ppeSchema = z.object({
  employeeId: z.string().uuid().optional().nullable(),
  employeeName: z.string().optional().nullable(),
  item: z.string().min(1),
  size: z.string().optional().nullable(),
  quantity: z.number().int().min(1).optional(),
  deliveredAt: z.string().optional().nullable(),
  expiryDate: z.string().optional().nullable(),
  receivedBy: z.string().optional().nullable(),
  deliveredBy: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const examSchema = z.object({
  employeeId: z.string().uuid().optional().nullable(),
  employeeName: z.string().optional().nullable(),
  examType: z.enum(['PRE_EMPLOYMENT', 'PERIODIC', 'RETURN_TO_WORK', 'EXIT', 'SPECIAL']),
  examDate: z.string(),
  result: z.enum(['FIT', 'FIT_WITH_RESTRICTIONS', 'UNFIT', 'PENDING']),
  restrictions: z.string().optional().nullable(),
  nextExamDate: z.string().optional().nullable(),
  performedBy: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

async function tenantCtx(req: FastifyRequest, reply: FastifyReply, prisma: any): Promise<string | null> {
  const tenantId = await getEffectiveTenantId(req, prisma);
  if (!tenantId) {
    reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    return null;
  }
  return tenantId;
}

export default async function sstRoutes(app: FastifyInstance) {
  const prisma = (): any => (app as any).prisma;

  // ── Permisos de trabajo ────────────────────────────────────

  app.get('/work-permits', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await tenantCtx(req, reply, app.prisma); if (!tenantId) return;
    const { status, type } = req.query as any;
    const where: any = { tenantId, deletedAt: null };
    if (status) where.status = status;
    if (type) where.type = type;
    const items = await prisma().workPermit.findMany({ where, orderBy: { startDate: 'desc' } });
    return reply.send({ items, total: items.length });
  });

  app.post('/work-permits', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await tenantCtx(req, reply, app.prisma); if (!tenantId) return;
    const body = permitSchema.parse(req.body);
    const exists = await prisma().workPermit.findFirst({ where: { tenantId, code: body.code, deletedAt: null } });
    if (exists) return reply.code(409).send({ error: 'Ya existe un permiso con ese código' });
    const item = await prisma().workPermit.create({
      data: {
        tenantId,
        code: body.code,
        type: body.type,
        title: body.title,
        location: body.location,
        description: body.description ?? null,
        requestedBy: body.requestedBy ?? null,
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
        workers: body.workers ?? [],
        hazards: body.hazards ?? null,
        controls: body.controls ?? null,
        ppeRequired: body.ppeRequired ?? [],
        contractorId: body.contractorId ?? null,
      },
    });
    return reply.code(201).send(item);
  });

  app.patch('/work-permits/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await tenantCtx(req, reply, app.prisma); if (!tenantId) return;
    const existing = await prisma().workPermit.findFirst({ where: { id: (req.params as any).id, tenantId, deletedAt: null } });
    if (!existing) return reply.code(404).send({ error: 'Permiso no encontrado' });
    const body = permitSchema.partial().extend({
      status: z.enum(['REQUESTED', 'APPROVED', 'IN_PROGRESS', 'SUSPENDED', 'CLOSED', 'REJECTED']).optional(),
      approvedBy: z.string().optional().nullable(),
      closureNotes: z.string().optional().nullable(),
    }).parse(req.body);
    const data: any = {};
    for (const k of ['code', 'type', 'title', 'location', 'description', 'requestedBy', 'hazards', 'controls', 'contractorId', 'status', 'approvedBy', 'closureNotes']) {
      if ((body as any)[k] !== undefined) data[k] = (body as any)[k];
    }
    if (body.workers !== undefined) data.workers = body.workers;
    if (body.ppeRequired !== undefined) data.ppeRequired = body.ppeRequired;
    if (body.startDate !== undefined) data.startDate = new Date(body.startDate);
    if (body.endDate !== undefined) data.endDate = new Date(body.endDate);
    // Marcar aprobación/cierre automáticamente
    if (body.status === 'APPROVED' && !existing.approvedAt) data.approvedAt = new Date();
    if (body.status === 'CLOSED' && !existing.closedAt) data.closedAt = new Date();
    const item = await prisma().workPermit.update({ where: { id: existing.id }, data });
    return reply.send(item);
  });

  app.delete('/work-permits/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await tenantCtx(req, reply, app.prisma); if (!tenantId) return;
    const existing = await prisma().workPermit.findFirst({ where: { id: (req.params as any).id, tenantId, deletedAt: null } });
    if (!existing) return reply.code(404).send({ error: 'Permiso no encontrado' });
    await prisma().workPermit.update({ where: { id: existing.id }, data: { deletedAt: new Date() } });
    return reply.send({ ok: true });
  });

  // ── Entregas de EPP ────────────────────────────────────────

  app.get('/ppe-deliveries', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await tenantCtx(req, reply, app.prisma); if (!tenantId) return;
    const { employeeId, expiringSoon } = req.query as any;
    const where: any = { tenantId, deletedAt: null };
    if (employeeId) where.employeeId = employeeId;
    if (expiringSoon === 'true') {
      const in30 = new Date(); in30.setDate(in30.getDate() + 30);
      where.expiryDate = { lte: in30, not: null };
    }
    const items = await prisma().ppeDelivery.findMany({ where, orderBy: { deliveredAt: 'desc' } });
    return reply.send({ items, total: items.length });
  });

  app.post('/ppe-deliveries', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await tenantCtx(req, reply, app.prisma); if (!tenantId) return;
    const body = ppeSchema.parse(req.body);
    const item = await prisma().ppeDelivery.create({
      data: {
        tenantId,
        employeeId: body.employeeId ?? null,
        employeeName: body.employeeName ?? null,
        item: body.item,
        size: body.size ?? null,
        quantity: body.quantity ?? 1,
        deliveredAt: body.deliveredAt ? new Date(body.deliveredAt) : new Date(),
        expiryDate: body.expiryDate ? new Date(body.expiryDate) : null,
        receivedBy: body.receivedBy ?? null,
        deliveredBy: body.deliveredBy ?? null,
        notes: body.notes ?? null,
      },
    });
    return reply.code(201).send(item);
  });

  app.delete('/ppe-deliveries/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await tenantCtx(req, reply, app.prisma); if (!tenantId) return;
    const existing = await prisma().ppeDelivery.findFirst({ where: { id: (req.params as any).id, tenantId, deletedAt: null } });
    if (!existing) return reply.code(404).send({ error: 'Entrega no encontrada' });
    await prisma().ppeDelivery.update({ where: { id: existing.id }, data: { deletedAt: new Date() } });
    return reply.send({ ok: true });
  });

  // ── Exámenes médicos ocupacionales ─────────────────────────

  app.get('/medical-exams', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await tenantCtx(req, reply, app.prisma); if (!tenantId) return;
    const { employeeId, dueSoon } = req.query as any;
    const where: any = { tenantId, deletedAt: null };
    if (employeeId) where.employeeId = employeeId;
    if (dueSoon === 'true') {
      const in60 = new Date(); in60.setDate(in60.getDate() + 60);
      where.nextExamDate = { lte: in60, not: null };
    }
    const items = await prisma().medicalExam.findMany({ where, orderBy: { examDate: 'desc' } });
    return reply.send({ items, total: items.length });
  });

  app.post('/medical-exams', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await tenantCtx(req, reply, app.prisma); if (!tenantId) return;
    const body = examSchema.parse(req.body);
    const item = await prisma().medicalExam.create({
      data: {
        tenantId,
        employeeId: body.employeeId ?? null,
        employeeName: body.employeeName ?? null,
        examType: body.examType,
        examDate: new Date(body.examDate),
        result: body.result,
        restrictions: body.restrictions ?? null,
        nextExamDate: body.nextExamDate ? new Date(body.nextExamDate) : null,
        performedBy: body.performedBy ?? null,
        notes: body.notes ?? null,
      },
    });
    return reply.code(201).send(item);
  });

  app.patch('/medical-exams/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await tenantCtx(req, reply, app.prisma); if (!tenantId) return;
    const existing = await prisma().medicalExam.findFirst({ where: { id: (req.params as any).id, tenantId, deletedAt: null } });
    if (!existing) return reply.code(404).send({ error: 'Examen no encontrado' });
    const body = examSchema.partial().parse(req.body);
    const data: any = {};
    for (const k of ['employeeId', 'employeeName', 'examType', 'result', 'restrictions', 'performedBy', 'notes']) {
      if ((body as any)[k] !== undefined) data[k] = (body as any)[k];
    }
    if (body.examDate !== undefined) data.examDate = new Date(body.examDate);
    if (body.nextExamDate !== undefined) data.nextExamDate = body.nextExamDate ? new Date(body.nextExamDate) : null;
    const item = await prisma().medicalExam.update({ where: { id: existing.id }, data });
    return reply.send(item);
  });

  app.delete('/medical-exams/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await tenantCtx(req, reply, app.prisma); if (!tenantId) return;
    const existing = await prisma().medicalExam.findFirst({ where: { id: (req.params as any).id, tenantId, deletedAt: null } });
    if (!existing) return reply.code(404).send({ error: 'Examen no encontrado' });
    await prisma().medicalExam.update({ where: { id: existing.id }, data: { deletedAt: new Date() } });
    return reply.send({ ok: true });
  });
}
