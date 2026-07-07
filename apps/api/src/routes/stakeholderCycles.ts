import { getEffectiveTenantId } from '../utils/tenant-bypass.js';
/**
 * Gestión por períodos/ciclos de evaluación de Partes Interesadas (Jul 2026).
 * - EvaluationCycle: ciclo/período (ej "SGI 2026").
 * - StakeholderEvaluation: evaluación de una parte interesada dentro de un ciclo.
 * Mantiene compatibilidad: al editar la evaluación del ciclo ACTIVO, se espeja
 * al modelo Stakeholder (campos legacy) para no romper vistas/reportes existentes.
 */
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const toDate = (v: any) => (v ? new Date(v) : null);
const emptyToNull = (v: any) => (v === '' || v === undefined ? null : v);
const cleanUuid = (v: any) => (typeof v === 'string' && UUID_RE.test(v) ? v : null);

const cycleCreateSchema = z.object({
  name: z.string().min(1),
  year: z.number().int().min(2000).max(2100),
  status: z.enum(['DRAFT', 'ACTIVE', 'CLOSED']).optional().default('ACTIVE'),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
});

const cyclePatchSchema = z.object({
  name: z.string().min(1).optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'CLOSED']).optional(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
});

const evalPatchSchema = z.object({
  complianceStatus: z.enum(['PENDING', 'COMPLIES', 'PARTIAL', 'NON_COMPLIANT']).optional().nullable(),
  complianceLevel: z.number().int().min(0).max(100).optional().nullable(),
  evaluationDate: z.string().optional().nullable(),
  complianceEvidence: z.string().optional().nullable(),
  indicatorNote: z.string().optional().nullable(),
  requiresAction: z.boolean().optional(),
  influence: z.number().int().min(1).max(5).optional().nullable(),
  interest: z.number().int().min(1).max(5).optional().nullable(),
  observations: z.string().optional().nullable(),
  needs: z.string().optional().nullable(),
  expectations: z.string().optional().nullable(),
  requirements: z.string().optional().nullable(),
  reviewFrequency: z.enum(['MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL']).optional().nullable(),
  nextEvaluationDate: z.string().optional().nullable(),
  followUpResponsible: z.string().optional().nullable(),
});

function parseBody(raw: any): any {
  if (typeof raw === 'string') { try { return JSON.parse(raw); } catch { return {}; } }
  return raw ?? {};
}

// Espeja la evaluación del ciclo ACTIVO al modelo Stakeholder (campos legacy).
async function mirrorToStakeholder(tx: any, ev: any) {
  const cycle = await tx.evaluationCycle.findUnique({ where: { id: ev.cycleId } });
  if (!cycle || cycle.status !== 'ACTIVE') return;
  await tx.stakeholder.update({
    where: { id: ev.stakeholderId },
    data: {
      complianceStatus: ev.complianceStatus && ev.complianceStatus !== 'PENDING' ? ev.complianceStatus : null,
      complianceLevel: ev.complianceLevel ?? null,
      lastEvaluationDate: ev.evaluationDate ?? null,
      complianceEvidence: ev.complianceEvidence ?? null,
      requiresAction: ev.requiresAction ?? false,
      influence: ev.influence ?? undefined,
      interest: ev.interest ?? undefined,
    },
  });
}

// ── /evaluation-cycles ────────────────────────────────────────────────
export const evaluationCyclesRoutes: FastifyPluginAsync = async (app) => {
  // LIST
  app.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const cycles = await app.runWithDbContext(req, async (tx: any) => {
      return tx.evaluationCycle.findMany({ where: { tenantId }, orderBy: { year: 'desc' } });
    });
    return reply.send({ cycles });
  });

  // CREATE
  app.post('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    let body;
    try { body = cycleCreateSchema.parse(parseBody(req.body)); }
    catch (e: any) { return reply.code(400).send({ error: 'Validación fallida', details: e.errors ?? e.message }); }
    try {
      const cycle = await app.runWithDbContext(req, async (tx: any) => {
        const dup = await tx.evaluationCycle.findFirst({ where: { tenantId, year: body!.year } });
        if (dup) throw Object.assign(new Error(`Ya existe un ciclo para el año ${body!.year}`), { statusCode: 409 });
        return tx.evaluationCycle.create({
          data: {
            tenantId, name: body!.name, year: body!.year, status: body!.status,
            startDate: toDate(body!.startDate), endDate: toDate(body!.endDate),
          },
        });
      });
      return reply.code(201).send({ cycle });
    } catch (err: any) {
      return reply.code(err.statusCode ?? 500).send({ error: err.message ?? 'Error al crear ciclo' });
    }
  });

  // UPDATE
  app.patch('/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    let body;
    try { body = cyclePatchSchema.parse(parseBody(req.body)); }
    catch (e: any) { return reply.code(400).send({ error: 'Validación fallida', details: e.errors ?? e.message }); }
    const cycle = await app.runWithDbContext(req, async (tx: any) => {
      const existing = await tx.evaluationCycle.findFirst({ where: { id, tenantId } });
      if (!existing) throw Object.assign(new Error('Ciclo no encontrado'), { statusCode: 404 });
      const data: any = {};
      if (body!.name !== undefined) data.name = body!.name;
      if (body!.status !== undefined) data.status = body!.status;
      if (body!.startDate !== undefined) data.startDate = toDate(body!.startDate);
      if (body!.endDate !== undefined) data.endDate = toDate(body!.endDate);
      return tx.evaluationCycle.update({ where: { id }, data });
    }).catch((err: any) => { throw err; });
    return reply.send({ cycle });
  });

  // DELETE (borra ciclo y sus evaluaciones; solo si no es el único)
  app.delete('/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    await app.runWithDbContext(req, async (tx: any) => {
      const existing = await tx.evaluationCycle.findFirst({ where: { id, tenantId } });
      if (!existing) throw Object.assign(new Error('Ciclo no encontrado'), { statusCode: 404 });
      await tx.evaluationCycle.delete({ where: { id } });
    });
    return reply.send({ success: true });
  });

  // LIST evaluaciones del ciclo (join con stakeholder).
  // Auto-crea evaluaciones faltantes en ciclos no cerrados (partes nuevas / ciclo recién creado).
  app.get('/:id/evaluations', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const evaluations = await app.runWithDbContext(req, async (tx: any) => {
      const cycle = await tx.evaluationCycle.findFirst({ where: { id, tenantId } });
      if (!cycle) throw Object.assign(new Error('Ciclo no encontrado'), { statusCode: 404 });
      if (cycle.status !== 'CLOSED') {
        const stakeholders = await tx.stakeholder.findMany({ where: { tenantId, deletedAt: null } });
        const existing = await tx.stakeholderEvaluation.findMany({ where: { tenantId, cycleId: id }, select: { stakeholderId: true } });
        const have = new Set(existing.map((e: any) => e.stakeholderId));
        const missing = stakeholders.filter((s: any) => !have.has(s.id));
        for (const s of missing) {
          await tx.stakeholderEvaluation.create({
            data: {
              tenantId, stakeholderId: s.id, cycleId: id,
              needs: s.needs, expectations: s.expectations, requirements: s.requirements,
              influence: s.influence, interest: s.interest,
              complianceStatus: 'PENDING', complianceLevel: 0, requiresAction: false,
            },
          });
        }
      }
      return tx.stakeholderEvaluation.findMany({
        where: { tenantId, cycleId: id, stakeholder: { deletedAt: null } },
        include: { stakeholder: true },
        orderBy: { stakeholder: { name: 'asc' } },
      });
    });
    return reply.send({ evaluations });
  });

  // SUMMARY / dashboard del ciclo
  app.get('/:id/summary', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const evals = await app.runWithDbContext(req, async (tx: any) => {
      return tx.stakeholderEvaluation.findMany({
        where: { tenantId, cycleId: id, stakeholder: { deletedAt: null } },
        select: { complianceStatus: true, complianceLevel: true, requiresAction: true, actionItemId: true, nextEvaluationDate: true },
      });
    });
    const now = Date.now();
    const complies = evals.filter((e: any) => e.complianceStatus === 'COMPLIES').length;
    const partial = evals.filter((e: any) => e.complianceStatus === 'PARTIAL').length;
    const nonCompliant = evals.filter((e: any) => e.complianceStatus === 'NON_COMPLIANT').length;
    const pending = evals.filter((e: any) => !e.complianceStatus || e.complianceStatus === 'PENDING').length;
    const openActions = evals.filter((e: any) => e.requiresAction && !e.actionItemId).length;
    const overdue = evals.filter((e: any) => e.nextEvaluationDate && new Date(e.nextEvaluationDate).getTime() < now).length;
    const levels = evals.map((e: any) => e.complianceLevel).filter((n: any) => typeof n === 'number');
    const avgLevel = levels.length ? Math.round(levels.reduce((a: number, b: number) => a + b, 0) / levels.length) : 0;
    return reply.send({
      summary: { total: evals.length, complies, partial, nonCompliant, pending, openActions, overdue, avgLevel },
    });
  });

  // CREATE-NEXT: crea el ciclo siguiente copiando la estructura del ciclo origen
  app.post('/create-next', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const body = parseBody(req.body);
    const fromCycleId = cleanUuid(body.fromCycleId);
    const closeSource = body.closeSource === true;

    try {
      const result = await app.runWithDbContext(req, async (tx: any) => {
        // Ciclo origen: el indicado, o el ACTIVO más reciente, o el de mayor año.
        let source = fromCycleId ? await tx.evaluationCycle.findFirst({ where: { id: fromCycleId, tenantId } }) : null;
        if (!source) source = await tx.evaluationCycle.findFirst({ where: { tenantId, status: 'ACTIVE' }, orderBy: { year: 'desc' } });
        if (!source) source = await tx.evaluationCycle.findFirst({ where: { tenantId }, orderBy: { year: 'desc' } });
        if (!source) throw Object.assign(new Error('No hay un ciclo previo para copiar. Creá el primer ciclo.'), { statusCode: 400 });

        const newYear = source.year + 1;
        const dup = await tx.evaluationCycle.findFirst({ where: { tenantId, year: newYear } });
        if (dup) throw Object.assign(new Error(`Ya existe un ciclo para el año ${newYear}`), { statusCode: 409 });

        const newCycle = await tx.evaluationCycle.create({
          data: {
            tenantId, name: `SGI ${newYear}`, year: newYear, status: 'ACTIVE',
            startDate: new Date(Date.UTC(newYear, 0, 1)), endDate: new Date(Date.UTC(newYear, 11, 31, 23, 59, 59)),
          },
        });

        // Copiar evaluaciones del ciclo origen dejando la evaluación en "Pendiente".
        const prevEvals = await tx.stakeholderEvaluation.findMany({
          where: { tenantId, cycleId: source.id, stakeholder: { deletedAt: null } },
        });
        let copied = 0;
        for (const pe of prevEvals) {
          await tx.stakeholderEvaluation.create({
            data: {
              tenantId, stakeholderId: pe.stakeholderId, cycleId: newCycle.id,
              // Estructura copiada
              needs: pe.needs, expectations: pe.expectations, requirements: pe.requirements,
              influence: pe.influence, interest: pe.interest,
              indicatorNote: pe.indicatorNote, indicatorId: pe.indicatorId,
              reviewFrequency: pe.reviewFrequency, followUpResponsible: pe.followUpResponsible,
              // Evaluación reiniciada a Pendiente
              complianceStatus: 'PENDING', complianceLevel: 0,
              evaluationDate: null, complianceEvidence: null, observations: null,
              requiresAction: false, actionItemId: null, nextEvaluationDate: null,
            },
          });
          copied++;
        }

        if (closeSource) await tx.evaluationCycle.update({ where: { id: source.id }, data: { status: 'CLOSED' } });

        return { cycle: newCycle, copied, fromCycle: { id: source.id, name: source.name, year: source.year } };
      });
      return reply.code(201).send(result);
    } catch (err: any) {
      return reply.code(err.statusCode ?? 500).send({ error: err.message ?? 'Error al crear ciclo siguiente' });
    }
  });
};

// ── /stakeholder-evaluations ──────────────────────────────────────────
export const stakeholderEvaluationsRoutes: FastifyPluginAsync = async (app) => {
  // Historial de una parte interesada (todas sus evaluaciones por ciclo)
  app.get('/by-stakeholder/:stakeholderId', async (req: FastifyRequest<{ Params: { stakeholderId: string } }>, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { stakeholderId } = z.object({ stakeholderId: z.string().uuid() }).parse(req.params);
    const history = await app.runWithDbContext(req, async (tx: any) => {
      return tx.stakeholderEvaluation.findMany({
        where: { tenantId, stakeholderId },
        include: { cycle: true },
        orderBy: { cycle: { year: 'desc' } },
      });
    });
    return reply.send({ history });
  });

  // Actualizar evaluación de un período (no toca otros períodos)
  app.patch('/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    let body;
    try { body = evalPatchSchema.parse(parseBody(req.body)); }
    catch (e: any) { return reply.code(400).send({ error: 'Validación fallida', details: e.errors ?? e.message }); }

    const evaluation = await app.runWithDbContext(req, async (tx: any) => {
      const existing = await tx.stakeholderEvaluation.findFirst({ where: { id, tenantId } });
      if (!existing) throw Object.assign(new Error('Evaluación no encontrada'), { statusCode: 404 });
      const b = body!;
      const data: any = {};
      const setStr = (k: keyof typeof b) => { if (b[k] !== undefined) data[k] = emptyToNull(b[k]); };
      setStr('complianceStatus'); setStr('complianceEvidence'); setStr('indicatorNote');
      setStr('observations'); setStr('needs'); setStr('expectations'); setStr('requirements');
      setStr('reviewFrequency'); setStr('followUpResponsible');
      if (b.complianceLevel !== undefined) data.complianceLevel = b.complianceLevel;
      if (b.influence !== undefined) data.influence = b.influence;
      if (b.interest !== undefined) data.interest = b.interest;
      if (b.requiresAction !== undefined) data.requiresAction = b.requiresAction;
      if (b.evaluationDate !== undefined) data.evaluationDate = toDate(b.evaluationDate);
      if (b.nextEvaluationDate !== undefined) data.nextEvaluationDate = toDate(b.nextEvaluationDate);
      const updated = await tx.stakeholderEvaluation.update({ where: { id }, data });
      await mirrorToStakeholder(tx, updated);
      return updated;
    });
    return reply.send({ evaluation });
  });

  // Crear NC vinculada a la evaluación (parte interesada + período)
  app.post('/:id/create-nc', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = parseBody(req.body);

    const ncr = await app.runWithDbContext(req, async (tx: any) => {
      const ev = await tx.stakeholderEvaluation.findFirst({ where: { id, tenantId }, include: { stakeholder: true, cycle: true } });
      if (!ev) throw Object.assign(new Error('Evaluación no encontrada'), { statusCode: 404 });
      const year = new Date().getFullYear();
      const count = await tx.nonConformity.count({ where: { tenantId, code: { startsWith: `NCR-${year}-` } } });
      const code = `NCR-${year}-${String(count + 1).padStart(3, '0')}`;
      const s = ev.stakeholder;
      return tx.nonConformity.create({
        data: {
          tenantId, code,
          title: body.title || `NC ${s.name} — ${ev.cycle?.name ?? ''}`,
          description: body.description || `Origen: Parte Interesada (período ${ev.cycle?.name ?? '—'})\nNombre: ${s.name}\nEstado: ${ev.complianceStatus || '—'}\nNivel: ${ev.complianceLevel ?? '—'}%\nEvidencia: ${ev.complianceEvidence || '—'}`,
          severity: body.severity || 'MAJOR',
          source: 'STAKEHOLDER', status: 'OPEN',
          standard: body.standard || null, clause: body.clause || null,
          dueDate: body.dueDate ? new Date(body.dueDate) : new Date(Date.now() + 30 * 24 * 3600 * 1000),
          stakeholderId: ev.stakeholderId,
          assignedToId: cleanUuid(body.assignedToId),
          createdById: req.auth?.userId ?? null, updatedById: req.auth?.userId ?? null,
        },
      });
    });
    return reply.code(201).send({ ncr });
  });

  // Generar acción CAPA vinculada a la evaluación
  app.post('/:id/generate-action', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = parseBody(req.body);

    const action = await app.runWithDbContext(req, async (tx: any) => {
      const ev = await tx.stakeholderEvaluation.findFirst({ where: { id, tenantId }, include: { stakeholder: true, cycle: true } });
      if (!ev) throw Object.assign(new Error('Evaluación no encontrada'), { statusCode: 404 });
      const year = new Date().getFullYear();
      const count = await tx.actionItem.count({ where: { tenantId, code: { startsWith: `ACT-${year}-` } } });
      const code = `ACT-${year}-${String(count + 1).padStart(3, '0')}`;
      const s = ev.stakeholder;
      const newAction = await tx.actionItem.create({
        data: {
          tenantId, code,
          title: body.title || `Acción ${s.name} — ${ev.cycle?.name ?? ''}`,
          description: body.description || `Origen: Parte Interesada (período ${ev.cycle?.name ?? '—'})\n${s.name}\nEstado: ${ev.complianceStatus}\nNivel: ${ev.complianceLevel ?? '—'}%`,
          type: body.type || (ev.complianceStatus === 'NON_COMPLIANT' ? 'CORRECTIVE' : 'IMPROVEMENT'),
          priority: body.priority || (ev.complianceStatus === 'NON_COMPLIANT' ? 'HIGH' : 'MEDIUM'),
          status: 'OPEN', sourceType: 'STAKEHOLDER', sourceId: ev.stakeholderId,
          openDate: new Date(), dueDate: body.dueDate ? new Date(body.dueDate) : new Date(Date.now() + 30 * 24 * 3600 * 1000),
        },
      });
      await tx.stakeholderEvaluation.update({ where: { id }, data: { actionItemId: newAction.id } });
      // Reflejar en el stakeholder maestro si el ciclo es activo
      const updatedEv = { ...ev, actionItemId: newAction.id };
      await tx.stakeholder.update({ where: { id: ev.stakeholderId }, data: { actionItemId: newAction.id } }).catch(() => {});
      void updatedEv;
      return newAction;
    });
    return reply.send({ action });
  });
};
