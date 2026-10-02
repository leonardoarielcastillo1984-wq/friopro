import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getEffectiveTenantId } from '../utils/tenant-bypass.js';

// ISO 9001/14001/45001 §6.1.3 — registro de requisitos legales y otros requisitos
// ISO 14001/45001 §9.1.2 — evaluación periódica del cumplimiento

const requirementSchema = z.object({
  framework: z.enum(['ENVIRONMENTAL', 'OHAS', 'QUALITY', 'OTHER']),
  source: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  appliesTo: z.string().optional().nullable(),
  evaluationFrequency: z.enum(['MONTHLY', 'QUARTERLY', 'BIANNUAL', 'YEARLY']).optional(),
  nextEvaluationDate: z.string().optional().nullable(),
  responsibleId: z.string().uuid().optional().nullable(),
  evidence: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

const evaluationSchema = z.object({
  evaluationDate: z.string().optional().nullable(),
  result: z.enum(['COMPLIANT', 'PARTIAL', 'NON_COMPLIANT']),
  findings: z.string().optional().nullable(),
  correctiveRequired: z.boolean().optional(),
  evaluatedBy: z.string().optional().nullable(),
  evidence: z.string().optional().nullable(),
});

async function tenantCtx(req: FastifyRequest, reply: FastifyReply, prisma: any): Promise<string | null> {
  const tenantId = await getEffectiveTenantId(req, prisma);
  if (!tenantId) {
    reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    return null;
  }
  return tenantId;
}

export default async function legalRequirementsRoutes(app: FastifyInstance) {
  const prisma = (): any => (app as any).prisma;

  // GET / — lista con filtros y evaluaciones recientes
  app.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await tenantCtx(req, reply, app.prisma); if (!tenantId) return;
    const { framework, active, pendingEval } = req.query as any;
    const where: any = { tenantId, deletedAt: null };
    if (framework) where.framework = framework;
    if (active !== undefined) where.isActive = active !== 'false';
    if (pendingEval === 'true') where.nextEvaluationDate = { lte: new Date() };
    const items = await prisma().legalRequirement.findMany({
      where,
      include: { evaluations: { orderBy: { evaluationDate: 'desc' }, take: 3 } },
      orderBy: [{ framework: 'asc' }, { source: 'asc' }],
    });
    return reply.send({ items, total: items.length });
  });

  // GET /summary — resumen por framework y estado de cumplimiento
  app.get('/summary', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await tenantCtx(req, reply, app.prisma); if (!tenantId) return;
    const items = await prisma().legalRequirement.findMany({
      where: { tenantId, deletedAt: null, isActive: true },
      select: { framework: true, lastEvaluationResult: true, nextEvaluationDate: true },
    });
    const byFramework: Record<string, any> = {};
    let pendingEval = 0;
    const now = new Date();
    for (const r of items) {
      const f = r.framework || 'OTHER';
      byFramework[f] = byFramework[f] || { total: 0, compliant: 0, partial: 0, nonCompliant: 0, notEvaluated: 0 };
      byFramework[f].total++;
      if (r.lastEvaluationResult === 'COMPLIANT') byFramework[f].compliant++;
      else if (r.lastEvaluationResult === 'PARTIAL') byFramework[f].partial++;
      else if (r.lastEvaluationResult === 'NON_COMPLIANT') byFramework[f].nonCompliant++;
      else byFramework[f].notEvaluated++;
      if (r.nextEvaluationDate && new Date(r.nextEvaluationDate) <= now) pendingEval++;
    }
    return reply.send({ total: items.length, pendingEval, byFramework });
  });

  // POST / — crear requisito
  app.post('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await tenantCtx(req, reply, app.prisma); if (!tenantId) return;
    const body = requirementSchema.parse(req.body);
    const item = await prisma().legalRequirement.create({
      data: {
        tenantId,
        framework: body.framework,
        source: body.source,
        title: body.title,
        description: body.description ?? null,
        appliesTo: body.appliesTo ?? null,
        evaluationFrequency: body.evaluationFrequency || 'YEARLY',
        nextEvaluationDate: body.nextEvaluationDate ? new Date(body.nextEvaluationDate) : null,
        responsibleId: body.responsibleId ?? null,
        evidence: body.evidence ?? null,
        isActive: body.isActive ?? true,
      },
    });
    return reply.code(201).send(item);
  });

  // GET /:id — detalle con historial completo
  app.get('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await tenantCtx(req, reply, app.prisma); if (!tenantId) return;
    const item = await prisma().legalRequirement.findFirst({
      where: { id: (req.params as any).id, tenantId, deletedAt: null },
      include: { evaluations: { orderBy: { evaluationDate: 'desc' } } },
    });
    if (!item) return reply.code(404).send({ error: 'Requisito no encontrado' });
    return reply.send(item);
  });

  // PATCH /:id — editar requisito
  app.patch('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await tenantCtx(req, reply, app.prisma); if (!tenantId) return;
    const existing = await prisma().legalRequirement.findFirst({
      where: { id: (req.params as any).id, tenantId, deletedAt: null },
    });
    if (!existing) return reply.code(404).send({ error: 'Requisito no encontrado' });
    const body = requirementSchema.partial().parse(req.body);
    const item = await prisma().legalRequirement.update({
      where: { id: existing.id },
      data: {
        ...(body.framework !== undefined && { framework: body.framework }),
        ...(body.source !== undefined && { source: body.source }),
        ...(body.title !== undefined && { title: body.title }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.appliesTo !== undefined && { appliesTo: body.appliesTo }),
        ...(body.evaluationFrequency !== undefined && { evaluationFrequency: body.evaluationFrequency }),
        ...(body.nextEvaluationDate !== undefined && { nextEvaluationDate: body.nextEvaluationDate ? new Date(body.nextEvaluationDate) : null }),
        ...(body.responsibleId !== undefined && { responsibleId: body.responsibleId }),
        ...(body.evidence !== undefined && { evidence: body.evidence }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
      },
    });
    return reply.send(item);
  });

  // DELETE /:id — baja lógica
  app.delete('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await tenantCtx(req, reply, app.prisma); if (!tenantId) return;
    const existing = await prisma().legalRequirement.findFirst({
      where: { id: (req.params as any).id, tenantId, deletedAt: null },
    });
    if (!existing) return reply.code(404).send({ error: 'Requisito no encontrado' });
    await prisma().legalRequirement.update({ where: { id: existing.id }, data: { deletedAt: new Date(), isActive: false } });
    return reply.send({ ok: true });
  });

  // POST /:id/evaluations — registrar evaluación de cumplimiento (9.1.2)
  app.post('/:id/evaluations', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await tenantCtx(req, reply, app.prisma); if (!tenantId) return;
    const requirement = await prisma().legalRequirement.findFirst({
      where: { id: (req.params as any).id, tenantId, deletedAt: null },
    });
    if (!requirement) return reply.code(404).send({ error: 'Requisito no encontrado' });
    const body = evaluationSchema.parse(req.body);
    const evalDate = body.evaluationDate ? new Date(body.evaluationDate) : new Date();
    const evaluation = await prisma().legalComplianceEvaluation.create({
      data: {
        tenantId,
        requirementId: requirement.id,
        evaluationDate: evalDate,
        result: body.result,
        findings: body.findings ?? null,
        correctiveRequired: body.correctiveRequired ?? false,
        evaluatedBy: body.evaluatedBy ?? null,
        evidence: body.evidence ?? null,
      },
    });
    // Actualizar el requisito con último resultado y próxima fecha
    const freqMonths: Record<string, number> = { MONTHLY: 1, QUARTERLY: 3, BIANNUAL: 6, YEARLY: 12 };
    const next = new Date(evalDate);
    next.setMonth(next.getMonth() + (freqMonths[requirement.evaluationFrequency] || 12));
    await prisma().legalRequirement.update({
      where: { id: requirement.id },
      data: {
        lastEvaluationDate: evalDate,
        lastEvaluationResult: body.result,
        nextEvaluationDate: next,
      },
    });
    return reply.code(201).send(evaluation);
  });
}
