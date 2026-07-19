import { getEffectiveTenantId } from '../utils/tenant-bypass.js';
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { createGroqOnlyLLMProvider } from '../services/llm/factory.js';

// ─────────────────────────── HELPERS ───────────────────────────
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const cleanUUID = (v: string | undefined | null) => (v && UUID_RE.test(v) ? v : undefined);
const empFullName = (e: any) => (e ? `${e.firstName ?? ''} ${e.lastName ?? ''}`.trim() : '—');
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const emptyToUndefined = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((val) => (val === '' || val === null ? undefined : val), schema);

// Escala estándar 1-5 (configurable). isGap: nivel que marca brecha.
const DEFAULT_SCALE_LEVELS = [
  { value: 1, name: 'Insuficiente', description: 'No cumple lo esperado', isGap: true, order: 1 },
  { value: 2, name: 'Requiere mejora', description: 'Cumple parcialmente', isGap: true, order: 2 },
  { value: 3, name: 'Cumple expectativas', description: 'Cumple lo esperado', isGap: false, order: 3 },
  { value: 4, name: 'Supera expectativas', description: 'Supera lo esperado', isGap: false, order: 4 },
  { value: 5, name: 'Sobresaliente', description: 'Desempeño excepcional', isGap: false, order: 5 },
];

// Bandas de clasificación (configurables vía scale.config.classification)
const DEFAULT_CLASSIFICATION = [
  { min: 1.0, max: 1.99, label: 'Insuficiente' },
  { min: 2.0, max: 2.99, label: 'Requiere mejora' },
  { min: 3.0, max: 3.99, label: 'Cumple expectativas' },
  { min: 4.0, max: 4.49, label: 'Supera expectativas' },
  { min: 4.5, max: 5.0, label: 'Sobresaliente' },
];

const DEFAULT_TEMPLATES = [
  {
    name: 'Modelo Operativo', type: 'OPERATIVO',
    criteria: [
      { name: 'Calidad del trabajo', category: 'Desempeño', weight: 15 },
      { name: 'Cumplimiento de procedimientos', category: 'Desempeño', weight: 15 },
      { name: 'Seguridad', category: 'Desempeño', weight: 15 },
      { name: 'Productividad', category: 'Desempeño', weight: 15 },
      { name: 'Competencia técnica', category: 'Competencias', weight: 15 },
      { name: 'Trabajo en equipo', category: 'Actitudinal', weight: 10 },
      { name: 'Responsabilidad', category: 'Actitudinal', weight: 10 },
      { name: 'Mejora continua', category: 'Actitudinal', weight: 5 },
    ],
  },
  {
    name: 'Modelo Responsable de Proceso', type: 'RESPONSABLE',
    criteria: [
      { name: 'Liderazgo', category: 'Gestión', weight: 15 },
      { name: 'Gestión del equipo', category: 'Gestión', weight: 15 },
      { name: 'Cumplimiento de KPI', category: 'Resultados', weight: 15 },
      { name: 'Gestión de riesgos', category: 'Gestión', weight: 10 },
      { name: 'Cumplimiento de objetivos', category: 'Resultados', weight: 15 },
      { name: 'Gestión de acciones CAPA', category: 'Gestión', weight: 10 },
      { name: 'Toma de decisiones', category: 'Gestión', weight: 10 },
      { name: 'Mejora continua', category: 'Actitudinal', weight: 10 },
    ],
  },
];

// Estados de evaluación y transiciones permitidas (workflow trazable).
const EVAL_STATUSES = ['BORRADOR', 'PENDIENTE', 'AUTOEVALUACION', 'EVALUACION_RESPONSABLE', 'REVISION_RRHH', 'DEVOLUCION', 'CERRADA', 'CANCELADA', 'REABIERTA'];

async function getEmployeeForUser(tx: any, tenantId: string, userId: string | null) {
  if (!userId) return null;
  const pu = await tx.platformUser.findUnique({ where: { id: userId }, select: { email: true } });
  if (!pu?.email) return null;
  return tx.employee.findFirst({
    where: { tenantId, email: pu.email, deletedAt: null },
    select: {
      id: true, firstName: true, lastName: true, email: true, status: true, supervisorId: true,
      department: { select: { id: true, name: true } },
      position: { select: { id: true, name: true } },
    },
  });
}

async function resolveUserName(tx: any, userId?: string | null): Promise<string | null> {
  if (!userId) return null;
  try {
    const pu = await tx.platformUser.findUnique({ where: { id: userId }, select: { name: true, email: true } });
    return pu?.name || pu?.email || null;
  } catch { return null; }
}

// Notificación in-app (usa enum SYSTEM_ALERT; entityType distingue el módulo).
async function notify(tx: any, args: { tenantId: string; userId: string | null; title: string; message: string; link?: string; entityId?: string | null }) {
  if (!args.userId) return;
  try {
    await tx.notification.create({
      data: {
        tenantId: args.tenantId, userId: args.userId, type: 'SYSTEM_ALERT',
        title: args.title, message: args.message, link: args.link ?? null,
        entityType: 'performance_evaluation', entityId: args.entityId ?? null,
      },
    });
  } catch { /* noop */ }
}

async function addHistory(tx: any, args: { tenantId: string; evaluationId: string; fromStatus?: string | null; toStatus?: string | null; action: string; userId?: string | null; userName?: string | null; comment?: string | null }) {
  try {
    await tx.performanceHistory.create({
      data: {
        tenantId: args.tenantId, evaluationId: args.evaluationId,
        fromStatus: args.fromStatus ?? null, toStatus: args.toStatus ?? null,
        action: args.action, userId: args.userId ?? null, userName: args.userName ?? null, comment: args.comment ?? null,
      },
    });
  } catch { /* noop */ }
}

async function getUserIdForEmployee(tx: any, employeeId?: string | null): Promise<string | null> {
  if (!employeeId) return null;
  try {
    const emp = await tx.employee.findFirst({ where: { id: employeeId }, select: { email: true } });
    if (!emp?.email) return null;
    const pu = await tx.platformUser.findFirst({ where: { email: emp.email }, select: { id: true } });
    return pu?.id ?? null;
  } catch { return null; }
}

function classify(score: number | null | undefined, bands: any[]): string | null {
  if (score == null) return null;
  const b = (bands || DEFAULT_CLASSIFICATION).find((x: any) => score >= x.min && score <= x.max);
  return b ? b.label : null;
}

async function getDefaultScale(tx: any, tenantId: string) {
  let scale = await tx.performanceScale.findFirst({ where: { tenantId, isDefault: true, deletedAt: null } });
  if (!scale) scale = await tx.performanceScale.findFirst({ where: { tenantId, active: true, deletedAt: null }, orderBy: { createdAt: 'asc' } });
  return scale;
}

// Recalcula puntajes (self/manager/final), clasificación y % de avance de una evaluación.
async function scoreEvaluation(tx: any, tenantId: string, evaluationId: string) {
  const evaluation = await tx.performanceEvaluation.findFirst({ where: { id: evaluationId, tenantId } });
  if (!evaluation) return null;
  const template = evaluation.templateId ? await tx.performanceTemplate.findFirst({ where: { id: evaluation.templateId } }) : null;
  const criteria = template ? await tx.performanceCriterion.findMany({ where: { templateId: template.id } }) : [];
  const responses = await tx.performanceResponse.findMany({ where: { evaluationId } });
  const scale = evaluation.scaleId ? await tx.performanceScale.findFirst({ where: { id: evaluation.scaleId } }) : await getDefaultScale(tx, tenantId);
  const bands = (scale?.config as any)?.classification || DEFAULT_CLASSIFICATION;

  const totalWeight = criteria.reduce((s: number, c: any) => s + (c.weight || 0), 0) || 0;
  const weightedAvg = (role: string) => {
    if (!criteria.length) return null;
    let acc = 0, wsum = 0;
    for (const c of criteria) {
      const r = responses.find((x: any) => x.criterionId === c.id && x.role === role && x.score != null);
      if (r) { const w = totalWeight > 0 ? (c.weight || 0) : 1; acc += (r.score as number) * w; wsum += w; }
    }
    return wsum > 0 ? round2(acc / wsum) : null;
  };

  const selfScore = weightedAvg('SELF');
  const managerScore = weightedAvg('MANAGER');
  // 360°: promedio ponderado por peso de cada evaluador presente
  const evaluators = await tx.performanceEvaluator.findMany({ where: { evaluationId } });
  let finalScore: number | null = managerScore;
  if (evaluation.config && (evaluation.config as any).mode360 && evaluators.length) {
    let acc = 0, wsum = 0;
    for (const ev of evaluators) {
      const s = weightedAvg(ev.role);
      if (s != null) { acc += s * (ev.weight || 0); wsum += ev.weight || 0; }
    }
    if (wsum > 0) finalScore = round2(acc / wsum);
  }
  if (finalScore == null) finalScore = managerScore ?? selfScore;

  // Progreso: criterios respondidos por el responsable sobre el total
  const answeredMgr = criteria.filter((c: any) => responses.some((r: any) => r.criterionId === c.id && r.role === 'MANAGER' && r.score != null)).length;
  const progressPct = criteria.length ? round2((answeredMgr / criteria.length) * 100) : 0;

  const classification = classify(finalScore, bands);
  return tx.performanceEvaluation.update({
    where: { id: evaluationId },
    data: { selfScore, managerScore, finalScore, classification, progressPct },
  });
}

// Matriz de competencias (base de "polivalencia"): requerido por puesto vs actual del empleado.
async function computeCompetencyMatrix(tx: any, employeeId: string, positionId?: string | null) {
  const emp = await tx.employee.findFirst({ where: { id: employeeId }, select: { positionId: true } });
  const posId = positionId || emp?.positionId || null;
  if (!posId) return { required: [], items: [], gaps: [] };
  const [posComps, empComps] = await Promise.all([
    tx.positionCompetency.findMany({ where: { positionId: posId }, include: { competency: { select: { id: true, name: true, category: true } } } }),
    tx.employeeCompetency.findMany({ where: { employeeId } }),
  ]);
  const empMap = new Map(empComps.map((c: any) => [c.competencyId, c.currentLevel]));
  const items = posComps.map((pc: any) => {
    const current = (empMap.get(pc.competencyId) as number | undefined) ?? 0;
    const gap = (pc.requiredLevel || 0) - current;
    return {
      competencyId: pc.competencyId, name: pc.competency?.name, category: pc.competency?.category,
      requiredLevel: pc.requiredLevel, currentLevel: current, gap: gap > 0 ? gap : 0,
    };
  });
  const gaps = items.filter((i: any) => i.gap > 0);
  return { items, gaps };
}

// ─────────────────────────── ROUTES ───────────────────────────
export const performanceRoutes: FastifyPluginAsync = async (app) => {
  const tid = (req: FastifyRequest) => getEffectiveTenantId(req, (app as any).prisma);
  const uid = (req: FastifyRequest) => ((req as any).auth?.userId ?? null) as string | null;

  // ==================== ESCALAS ====================
  app.get('/scales', async (req, reply) => {
    const tenantId = await tid(req);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const items = await app.runWithDbContext(req, (tx: any) =>
      tx.performanceScale.findMany({ where: { tenantId, deletedAt: null }, include: { levels: { orderBy: { order: 'asc' } } }, orderBy: { createdAt: 'asc' } }));
    return reply.send({ items });
  });

  const scaleSchema = z.object({
    name: z.string().min(1), description: emptyToUndefined(z.string().optional()),
    isDefault: z.boolean().optional(), active: z.boolean().optional(),
    config: z.any().optional(),
    levels: z.array(z.object({
      value: z.number().int(), name: z.string().min(1),
      description: emptyToUndefined(z.string().optional()), interpretation: emptyToUndefined(z.string().optional()),
      isGap: z.boolean().optional(), order: z.number().int().optional(),
    })).optional(),
  });

  app.post('/scales', async (req, reply) => {
    const tenantId = await tid(req);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    let data; try { data = scaleSchema.parse(req.body); } catch (e: any) { return reply.code(400).send({ error: 'Validación fallida', details: e.errors }); }
    const userId = uid(req);
    const item = await app.runWithDbContext(req, async (tx: any) => {
      if (data.isDefault) await tx.performanceScale.updateMany({ where: { tenantId }, data: { isDefault: false } });
      const scale = await tx.performanceScale.create({ data: { tenantId, name: data.name, description: data.description ?? null, isDefault: !!data.isDefault, active: data.active ?? true, config: data.config ?? null, createdById: userId, updatedById: userId } });
      const levels = data.levels?.length ? data.levels : DEFAULT_SCALE_LEVELS;
      for (const l of levels) await tx.performanceScaleLevel.create({ data: { tenantId, scaleId: scale.id, value: l.value, name: l.name, description: (l as any).description ?? null, interpretation: (l as any).interpretation ?? null, isGap: !!(l as any).isGap, order: (l as any).order ?? l.value } });
      return tx.performanceScale.findFirst({ where: { id: scale.id }, include: { levels: { orderBy: { order: 'asc' } } } });
    });
    return reply.code(201).send({ item });
  });

  app.patch('/scales/:id', async (req, reply) => {
    const tenantId = await tid(req);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    let data; try { data = scaleSchema.partial().parse(req.body); } catch (e: any) { return reply.code(400).send({ error: 'Validación fallida', details: e.errors }); }
    const userId = uid(req);
    const item = await app.runWithDbContext(req, async (tx: any) => {
      const exists = await tx.performanceScale.findFirst({ where: { id, tenantId, deletedAt: null } });
      if (!exists) return null;
      if (data.isDefault) await tx.performanceScale.updateMany({ where: { tenantId }, data: { isDefault: false } });
      await tx.performanceScale.update({ where: { id }, data: { name: data.name ?? undefined, description: data.description ?? undefined, isDefault: data.isDefault ?? undefined, active: data.active ?? undefined, config: data.config ?? undefined, updatedById: userId } });
      if (data.levels) {
        await tx.performanceScaleLevel.deleteMany({ where: { scaleId: id } });
        for (const l of data.levels) await tx.performanceScaleLevel.create({ data: { tenantId, scaleId: id, value: l.value, name: l.name, description: (l as any).description ?? null, interpretation: (l as any).interpretation ?? null, isGap: !!(l as any).isGap, order: (l as any).order ?? l.value } });
      }
      return tx.performanceScale.findFirst({ where: { id }, include: { levels: { orderBy: { order: 'asc' } } } });
    });
    if (!item) return reply.code(404).send({ error: 'Escala no encontrada' });
    return reply.send({ item });
  });

  app.delete('/scales/:id', async (req, reply) => {
    const tenantId = await tid(req);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    await app.runWithDbContext(req, (tx: any) => tx.performanceScale.updateMany({ where: { id, tenantId }, data: { deletedAt: new Date(), active: false } }));
    return reply.send({ ok: true });
  });

  app.post('/scales/seed-defaults', async (req, reply) => {
    const tenantId = await tid(req);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const userId = uid(req);
    const item = await app.runWithDbContext(req, async (tx: any) => {
      const existing = await tx.performanceScale.findFirst({ where: { tenantId, deletedAt: null } });
      if (existing) return existing;
      const scale = await tx.performanceScale.create({ data: { tenantId, name: 'Escala estándar (1-5)', isDefault: true, active: true, config: { classification: DEFAULT_CLASSIFICATION }, createdById: userId, updatedById: userId } });
      for (const l of DEFAULT_SCALE_LEVELS) await tx.performanceScaleLevel.create({ data: { tenantId, scaleId: scale.id, ...l } });
      return tx.performanceScale.findFirst({ where: { id: scale.id }, include: { levels: { orderBy: { order: 'asc' } } } });
    });
    return reply.send({ item });
  });

  // ==================== PLANTILLAS / MODELOS ====================
  app.get('/templates', async (req, reply) => {
    const tenantId = await tid(req);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const q = req.query as any;
    const where: any = { tenantId, deletedAt: null };
    if (q.active === 'true') where.active = true;
    const items = await app.runWithDbContext(req, (tx: any) => tx.performanceTemplate.findMany({ where, include: { criteria: { orderBy: { order: 'asc' } } }, orderBy: { createdAt: 'desc' } }));
    return reply.send({ items });
  });

  app.get('/templates/:id', async (req, reply) => {
    const tenantId = await tid(req);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    const item = await app.runWithDbContext(req, (tx: any) => tx.performanceTemplate.findFirst({ where: { id, tenantId, deletedAt: null }, include: { criteria: { orderBy: { order: 'asc' } } } }));
    if (!item) return reply.code(404).send({ error: 'Plantilla no encontrada' });
    return reply.send({ item });
  });

  const criterionSchema = z.object({
    name: z.string().min(1), description: emptyToUndefined(z.string().optional()), category: emptyToUndefined(z.string().optional()),
    weight: z.number().min(0).max(100).optional(), order: z.number().int().optional(),
    requiresComment: z.boolean().optional(), requiresEvidence: z.boolean().optional(),
    competencyId: emptyToUndefined(z.string().uuid().optional()), linkedToObjectives: z.boolean().optional(),
    consumesSgiData: z.boolean().optional(), sgiSource: emptyToUndefined(z.string().optional()),
    scaleId: emptyToUndefined(z.string().uuid().optional()),
  });
  const templateSchema = z.object({
    name: z.string().min(1), description: emptyToUndefined(z.string().optional()), type: z.string().optional(),
    active: z.boolean().optional(),
    appliesToPositionIds: z.array(z.string()).optional(), appliesToDepartmentIds: z.array(z.string()).optional(),
    appliesToProcessIds: z.array(z.string()).optional(), appliesToLevels: z.array(z.string()).optional(),
    appliesToContractTypes: z.array(z.string()).optional(), appliesToPositionFamily: emptyToUndefined(z.string().optional()),
    scaleId: emptyToUndefined(z.string().uuid().optional()), config: z.any().optional(),
    criteria: z.array(criterionSchema).optional(),
  });

  function validateWeights(criteria: any[] | undefined, active: boolean | undefined) {
    if (!active || !criteria?.length) return null;
    const sum = criteria.reduce((s, c) => s + (c.weight || 0), 0);
    if (Math.abs(sum - 100) > 0.01) return `La suma de ponderaciones debe ser 100% (actual: ${round2(sum)}%)`;
    return null;
  }

  app.post('/templates', async (req, reply) => {
    const tenantId = await tid(req);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    let data; try { data = templateSchema.parse(req.body); } catch (e: any) { return reply.code(400).send({ error: 'Validación fallida', details: e.errors }); }
    const werr = validateWeights(data.criteria, data.active ?? false);
    if (werr) return reply.code(400).send({ error: werr });
    const userId = uid(req);
    const item = await app.runWithDbContext(req, async (tx: any) => {
      const t = await tx.performanceTemplate.create({ data: {
        tenantId, name: data.name, description: data.description ?? null, type: data.type ?? 'CUSTOM', active: data.active ?? false,
        appliesToPositionIds: (data.appliesToPositionIds || []).filter((v) => UUID_RE.test(v)),
        appliesToDepartmentIds: (data.appliesToDepartmentIds || []).filter((v) => UUID_RE.test(v)),
        appliesToProcessIds: (data.appliesToProcessIds || []).filter((v) => UUID_RE.test(v)),
        appliesToLevels: data.appliesToLevels || [], appliesToContractTypes: data.appliesToContractTypes || [],
        appliesToPositionFamily: data.appliesToPositionFamily ?? null, scaleId: cleanUUID(data.scaleId) ?? null, config: data.config ?? null,
        createdById: userId, updatedById: userId,
      } });
      let order = 0;
      for (const c of data.criteria || []) {
        await tx.performanceCriterion.create({ data: { tenantId, templateId: t.id, name: c.name, description: c.description ?? null, category: c.category ?? null, weight: c.weight ?? 0, order: c.order ?? order++, requiresComment: !!c.requiresComment, requiresEvidence: !!c.requiresEvidence, competencyId: cleanUUID(c.competencyId) ?? null, linkedToObjectives: !!c.linkedToObjectives, consumesSgiData: !!c.consumesSgiData, sgiSource: c.sgiSource ?? null, scaleId: cleanUUID(c.scaleId) ?? null } });
      }
      return tx.performanceTemplate.findFirst({ where: { id: t.id }, include: { criteria: { orderBy: { order: 'asc' } } } });
    });
    return reply.code(201).send({ item });
  });

  app.patch('/templates/:id', async (req, reply) => {
    const tenantId = await tid(req);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    let data; try { data = templateSchema.partial().parse(req.body); } catch (e: any) { return reply.code(400).send({ error: 'Validación fallida', details: e.errors }); }
    const userId = uid(req);
    const result = await app.runWithDbContext(req, async (tx: any) => {
      const exists = await tx.performanceTemplate.findFirst({ where: { id, tenantId, deletedAt: null } });
      if (!exists) return { error: 'not_found' };
      const willBeActive = data.active ?? exists.active;
      const criteria = data.criteria ?? await tx.performanceCriterion.findMany({ where: { templateId: id } });
      const werr = validateWeights(criteria, willBeActive);
      if (werr) return { error: werr };
      await tx.performanceTemplate.update({ where: { id }, data: {
        name: data.name ?? undefined, description: data.description ?? undefined, type: data.type ?? undefined, active: data.active ?? undefined,
        appliesToPositionIds: data.appliesToPositionIds ? data.appliesToPositionIds.filter((v) => UUID_RE.test(v)) : undefined,
        appliesToDepartmentIds: data.appliesToDepartmentIds ? data.appliesToDepartmentIds.filter((v) => UUID_RE.test(v)) : undefined,
        appliesToProcessIds: data.appliesToProcessIds ? data.appliesToProcessIds.filter((v) => UUID_RE.test(v)) : undefined,
        appliesToLevels: data.appliesToLevels ?? undefined, appliesToContractTypes: data.appliesToContractTypes ?? undefined,
        appliesToPositionFamily: data.appliesToPositionFamily ?? undefined, scaleId: data.scaleId !== undefined ? (cleanUUID(data.scaleId) ?? null) : undefined, config: data.config ?? undefined, updatedById: userId,
      } });
      if (data.criteria) {
        await tx.performanceCriterion.deleteMany({ where: { templateId: id } });
        let order = 0;
        for (const c of data.criteria) await tx.performanceCriterion.create({ data: { tenantId, templateId: id, name: c.name, description: c.description ?? null, category: c.category ?? null, weight: c.weight ?? 0, order: c.order ?? order++, requiresComment: !!c.requiresComment, requiresEvidence: !!c.requiresEvidence, competencyId: cleanUUID(c.competencyId) ?? null, linkedToObjectives: !!c.linkedToObjectives, consumesSgiData: !!c.consumesSgiData, sgiSource: c.sgiSource ?? null, scaleId: cleanUUID(c.scaleId) ?? null } });
      }
      return { item: await tx.performanceTemplate.findFirst({ where: { id }, include: { criteria: { orderBy: { order: 'asc' } } } }) };
    });
    if ((result as any).error === 'not_found') return reply.code(404).send({ error: 'Plantilla no encontrada' });
    if ((result as any).error) return reply.code(400).send({ error: (result as any).error });
    return reply.send({ item: (result as any).item });
  });

  app.delete('/templates/:id', async (req, reply) => {
    const tenantId = await tid(req);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    await app.runWithDbContext(req, (tx: any) => tx.performanceTemplate.updateMany({ where: { id, tenantId }, data: { deletedAt: new Date(), active: false } }));
    return reply.send({ ok: true });
  });

  app.post('/templates/seed-defaults', async (req, reply) => {
    const tenantId = await tid(req);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const userId = uid(req);
    const created = await app.runWithDbContext(req, async (tx: any) => {
      let scale = await getDefaultScale(tx, tenantId);
      if (!scale) {
        scale = await tx.performanceScale.create({ data: { tenantId, name: 'Escala estándar (1-5)', isDefault: true, active: true, config: { classification: DEFAULT_CLASSIFICATION }, createdById: userId, updatedById: userId } });
        for (const l of DEFAULT_SCALE_LEVELS) await tx.performanceScaleLevel.create({ data: { tenantId, scaleId: scale.id, ...l } });
      }
      const out: string[] = [];
      for (const t of DEFAULT_TEMPLATES) {
        const exists = await tx.performanceTemplate.findFirst({ where: { tenantId, name: t.name, deletedAt: null } });
        if (exists) continue;
        const tpl = await tx.performanceTemplate.create({ data: { tenantId, name: t.name, type: t.type, active: true, scaleId: scale.id, createdById: userId, updatedById: userId } });
        let order = 0;
        for (const c of t.criteria) await tx.performanceCriterion.create({ data: { tenantId, templateId: tpl.id, name: c.name, category: c.category, weight: c.weight, order: order++ } });
        out.push(t.name);
      }
      return out;
    });
    return reply.send({ created });
  });

  // ==================== CICLOS ====================
  app.get('/cycles', async (req, reply) => {
    const tenantId = await tid(req);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const items = await app.runWithDbContext(req, async (tx: any) => {
      const rows = await tx.performanceCycle.findMany({ where: { tenantId, deletedAt: null }, orderBy: { createdAt: 'desc' } });
      const counts = await tx.performanceEvaluation.groupBy({ by: ['cycleId', 'status'], where: { tenantId, deletedAt: null }, _count: true }).catch(() => []);
      return rows.map((c: any) => {
        const cy = (counts as any[]).filter((x) => x.cycleId === c.id);
        const total = cy.reduce((s, x) => s + (x._count || 0), 0);
        const closed = cy.filter((x) => x.status === 'CERRADA').reduce((s, x) => s + (x._count || 0), 0);
        return { ...c, evaluationsTotal: total, evaluationsClosed: closed };
      });
    });
    return reply.send({ items });
  });

  const cycleSchema = z.object({
    name: z.string().min(1), description: emptyToUndefined(z.string().optional()),
    type: z.string().optional(), status: z.string().optional(),
    startDate: emptyToUndefined(z.string().optional()), endDate: emptyToUndefined(z.string().optional()), periodLabel: emptyToUndefined(z.string().optional()),
    ownerUserId: emptyToUndefined(z.string().uuid().optional()), ownerEmployeeId: emptyToUndefined(z.string().uuid().optional()),
    scopeDepartmentIds: z.array(z.string()).optional(), scopeProcessIds: z.array(z.string()).optional(),
    scopePositionIds: z.array(z.string()).optional(), scopeEmployeeIds: z.array(z.string()).optional(),
    templateId: emptyToUndefined(z.string().uuid().optional()), scaleId: emptyToUndefined(z.string().uuid().optional()),
    requiresSelfEvaluation: z.boolean().optional(), requiresManagerEvaluation: z.boolean().optional(),
    requiresHrReview: z.boolean().optional(), requiresFeedbackInterview: z.boolean().optional(),
    allow90: z.boolean().optional(), allow180: z.boolean().optional(), allow360: z.boolean().optional(),
    reminderConfig: z.any().optional(), dueRules: z.any().optional(),
  });

  app.get('/cycles/:id', async (req, reply) => {
    const tenantId = await tid(req);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    const item = await app.runWithDbContext(req, (tx: any) => tx.performanceCycle.findFirst({ where: { id, tenantId, deletedAt: null } }));
    if (!item) return reply.code(404).send({ error: 'Ciclo no encontrado' });
    return reply.send({ item });
  });

  app.post('/cycles', async (req, reply) => {
    const tenantId = await tid(req);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    let data; try { data = cycleSchema.parse(req.body); } catch (e: any) { return reply.code(400).send({ error: 'Validación fallida', details: e.errors }); }
    const userId = uid(req);
    const item = await app.runWithDbContext(req, (tx: any) => tx.performanceCycle.create({ data: {
      tenantId, name: data.name, description: data.description ?? null, type: data.type ?? 'ANUAL', status: data.status ?? 'BORRADOR',
      startDate: data.startDate ? new Date(data.startDate) : null, endDate: data.endDate ? new Date(data.endDate) : null, periodLabel: data.periodLabel ?? null,
      ownerUserId: cleanUUID(data.ownerUserId) ?? userId, ownerEmployeeId: cleanUUID(data.ownerEmployeeId) ?? null,
      scopeDepartmentIds: (data.scopeDepartmentIds || []).filter((v) => UUID_RE.test(v)), scopeProcessIds: (data.scopeProcessIds || []).filter((v) => UUID_RE.test(v)),
      scopePositionIds: (data.scopePositionIds || []).filter((v) => UUID_RE.test(v)), scopeEmployeeIds: (data.scopeEmployeeIds || []).filter((v) => UUID_RE.test(v)),
      templateId: cleanUUID(data.templateId) ?? null, scaleId: cleanUUID(data.scaleId) ?? null,
      requiresSelfEvaluation: data.requiresSelfEvaluation ?? true, requiresManagerEvaluation: data.requiresManagerEvaluation ?? true,
      requiresHrReview: data.requiresHrReview ?? true, requiresFeedbackInterview: data.requiresFeedbackInterview ?? false,
      allow90: data.allow90 ?? true, allow180: data.allow180 ?? false, allow360: data.allow360 ?? false,
      reminderConfig: data.reminderConfig ?? null, dueRules: data.dueRules ?? null, createdById: userId, updatedById: userId,
    } }));
    return reply.code(201).send({ item });
  });

  app.patch('/cycles/:id', async (req, reply) => {
    const tenantId = await tid(req);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    let data; try { data = cycleSchema.partial().parse(req.body); } catch (e: any) { return reply.code(400).send({ error: 'Validación fallida', details: e.errors }); }
    const userId = uid(req);
    const item = await app.runWithDbContext(req, async (tx: any) => {
      const exists = await tx.performanceCycle.findFirst({ where: { id, tenantId, deletedAt: null } });
      if (!exists) return null;
      return tx.performanceCycle.update({ where: { id }, data: {
        name: data.name ?? undefined, description: data.description ?? undefined, type: data.type ?? undefined, status: data.status ?? undefined,
        startDate: data.startDate !== undefined ? (data.startDate ? new Date(data.startDate) : null) : undefined,
        endDate: data.endDate !== undefined ? (data.endDate ? new Date(data.endDate) : null) : undefined, periodLabel: data.periodLabel ?? undefined,
        ownerUserId: data.ownerUserId !== undefined ? (cleanUUID(data.ownerUserId) ?? null) : undefined, ownerEmployeeId: data.ownerEmployeeId !== undefined ? (cleanUUID(data.ownerEmployeeId) ?? null) : undefined,
        scopeDepartmentIds: data.scopeDepartmentIds ? data.scopeDepartmentIds.filter((v) => UUID_RE.test(v)) : undefined,
        scopeProcessIds: data.scopeProcessIds ? data.scopeProcessIds.filter((v) => UUID_RE.test(v)) : undefined,
        scopePositionIds: data.scopePositionIds ? data.scopePositionIds.filter((v) => UUID_RE.test(v)) : undefined,
        scopeEmployeeIds: data.scopeEmployeeIds ? data.scopeEmployeeIds.filter((v) => UUID_RE.test(v)) : undefined,
        templateId: data.templateId !== undefined ? (cleanUUID(data.templateId) ?? null) : undefined, scaleId: data.scaleId !== undefined ? (cleanUUID(data.scaleId) ?? null) : undefined,
        requiresSelfEvaluation: data.requiresSelfEvaluation ?? undefined, requiresManagerEvaluation: data.requiresManagerEvaluation ?? undefined,
        requiresHrReview: data.requiresHrReview ?? undefined, requiresFeedbackInterview: data.requiresFeedbackInterview ?? undefined,
        allow90: data.allow90 ?? undefined, allow180: data.allow180 ?? undefined, allow360: data.allow360 ?? undefined,
        reminderConfig: data.reminderConfig ?? undefined, dueRules: data.dueRules ?? undefined, updatedById: userId,
      } });
    });
    if (!item) return reply.code(404).send({ error: 'Ciclo no encontrado' });
    return reply.send({ item });
  });

  app.delete('/cycles/:id', async (req, reply) => {
    const tenantId = await tid(req);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    await app.runWithDbContext(req, (tx: any) => tx.performanceCycle.updateMany({ where: { id, tenantId }, data: { deletedAt: new Date(), status: 'CANCELADO' } }));
    return reply.send({ ok: true });
  });

  // Materializa evaluaciones para los empleados del alcance del ciclo (idempotente).
  app.post('/cycles/:id/generate', async (req, reply) => {
    const tenantId = await tid(req);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    const userId = uid(req);
    const result = await app.runWithDbContext(req, async (tx: any) => {
      const cycle = await tx.performanceCycle.findFirst({ where: { id, tenantId, deletedAt: null } });
      if (!cycle) return { error: 'not_found' };
      const where: any = { tenantId, deletedAt: null, status: 'ACTIVE' };
      const or: any[] = [];
      if (cycle.scopeEmployeeIds?.length) or.push({ id: { in: cycle.scopeEmployeeIds } });
      if (cycle.scopeDepartmentIds?.length) or.push({ departmentId: { in: cycle.scopeDepartmentIds } });
      if (cycle.scopePositionIds?.length) or.push({ positionId: { in: cycle.scopePositionIds } });
      if (or.length) where.OR = or;
      const employees = await tx.employee.findMany({ where, select: { id: true, positionId: true, departmentId: true, supervisorId: true } });
      let created = 0;
      for (const e of employees) {
        const existing = await tx.performanceEvaluation.findFirst({ where: { cycleId: id, employeeId: e.id } });
        if (existing) continue;
        // Resolver evaluador responsable (supervisor)
        let evaluatorEmployeeId: string | null = e.supervisorId ?? null;
        const evaluatorUserId = await getUserIdForEmployee(tx, evaluatorEmployeeId);
        const evaluation = await tx.performanceEvaluation.create({ data: {
          tenantId, cycleId: id, employeeId: e.id, templateId: cycle.templateId ?? null, scaleId: cycle.scaleId ?? (await getDefaultScale(tx, tenantId))?.id ?? null,
          positionId: e.positionId ?? null, departmentId: e.departmentId ?? null, evaluatorEmployeeId, evaluatorUserId,
          status: 'PENDIENTE', dueDate: cycle.endDate ?? null,
          config: { mode360: !!cycle.allow360 }, createdById: userId, updatedById: userId,
        } });
        // Evaluadores base (self + manager) para trazabilidad de 90/180/360
        if (cycle.requiresSelfEvaluation) await tx.performanceEvaluator.create({ data: { tenantId, evaluationId: evaluation.id, evaluatorEmployeeId: e.id, evaluatorUserId: await getUserIdForEmployee(tx, e.id), role: 'SELF', weight: 0 } });
        if (cycle.requiresManagerEvaluation && evaluatorEmployeeId) await tx.performanceEvaluator.create({ data: { tenantId, evaluationId: evaluation.id, evaluatorEmployeeId, evaluatorUserId, role: 'MANAGER', weight: 100 } });
        await addHistory(tx, { tenantId, evaluationId: evaluation.id, toStatus: 'PENDIENTE', action: 'CREADA', userId, userName: await resolveUserName(tx, userId) });
        if (evaluatorUserId) await notify(tx, { tenantId, userId: evaluatorUserId, title: 'Nueva evaluación asignada', message: `Tenés una evaluación de desempeño para completar en el ciclo "${cycle.name}".`, link: `/rrhh/desempeno/evaluacion/${evaluation.id}`, entityId: evaluation.id });
        created++;
      }
      return { created, scoped: employees.length };
    });
    if ((result as any).error === 'not_found') return reply.code(404).send({ error: 'Ciclo no encontrado' });
    return reply.send(result);
  });

  app.post('/cycles/:id/activate', async (req, reply) => {
    const tenantId = await tid(req);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    const item = await app.runWithDbContext(req, async (tx: any) => {
      const c = await tx.performanceCycle.findFirst({ where: { id, tenantId, deletedAt: null } });
      if (!c) return null;
      return tx.performanceCycle.update({ where: { id }, data: { status: 'ACTIVO' } });
    });
    if (!item) return reply.code(404).send({ error: 'Ciclo no encontrado' });
    return reply.send({ item });
  });

  // ==================== DASHBOARD ====================
  app.get('/dashboard', async (req, reply) => {
    const tenantId = await tid(req);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const data = await app.runWithDbContext(req, async (tx: any) => {
      const now = new Date();
      const [cycles, evals] = await Promise.all([
        tx.performanceCycle.findMany({ where: { tenantId, deletedAt: null } }),
        tx.performanceEvaluation.findMany({ where: { tenantId, deletedAt: null }, select: { id: true, status: true, finalScore: true, classification: true, dueDate: true, departmentId: true, employeeId: true, cycleId: true } }),
      ]);
      const activeCycles = cycles.filter((c: any) => ['ACTIVO', 'EN_CURSO', 'EN_REVISION'].includes(c.status)).length;
      const byStatus: Record<string, number> = {};
      for (const e of evals) byStatus[e.status] = (byStatus[e.status] || 0) + 1;
      const inProgress = evals.filter((e: any) => ['AUTOEVALUACION', 'EVALUACION_RESPONSABLE'].includes(e.status)).length;
      const pending = evals.filter((e: any) => e.status === 'PENDIENTE').length;
      const hrReview = evals.filter((e: any) => e.status === 'REVISION_RRHH').length;
      const completed = evals.filter((e: any) => e.status === 'CERRADA').length;
      const overdue = evals.filter((e: any) => e.dueDate && new Date(e.dueDate) < now && !['CERRADA', 'CANCELADA'].includes(e.status)).length;
      const total = evals.length;
      const scored = evals.filter((e: any) => e.finalScore != null);
      const avgScore = scored.length ? round2(scored.reduce((s: number, e: any) => s + e.finalScore, 0) / scored.length) : null;
      const completionPct = total ? round2((completed / total) * 100) : 0;

      // Brechas y necesidades de capacitación
      const [gapsOpen, trainingNeeds, devActions, feedbackPending] = await Promise.all([
        tx.performanceGap.count({ where: { tenantId, status: { not: 'CLOSED' } } }).catch(() => 0),
        tx.performanceGap.count({ where: { tenantId, linkedTrainingNeedId: { not: null } } }).catch(() => 0),
        tx.developmentAction.count({ where: { tenantId, status: { not: 'COMPLETADA' } } }).catch(() => 0),
        tx.performanceEvaluation.count({ where: { tenantId, status: 'DEVOLUCION' } }).catch(() => 0),
      ]);

      // Desempeño promedio por área (departamento)
      const deptIds = [...new Set(scored.map((e: any) => e.departmentId).filter(Boolean))];
      const depts = deptIds.length ? await tx.department.findMany({ where: { id: { in: deptIds as string[] } }, select: { id: true, name: true } }) : [];
      const deptName = new Map(depts.map((d: any) => [d.id, d.name]));
      const byAreaMap = new Map<string, { name: string; sum: number; n: number }>();
      for (const e of scored) {
        const key = e.departmentId || 'none';
        const g = byAreaMap.get(key) || { name: (deptName.get(e.departmentId) as string) || 'Sin área', sum: 0, n: 0 };
        g.sum += e.finalScore; g.n++; byAreaMap.set(key, g);
      }
      const byArea = [...byAreaMap.values()].map((g) => ({ name: g.name, avg: round2(g.sum / g.n), count: g.n })).sort((a, b) => b.avg - a.avg);

      // Distribución de clasificaciones
      const distribution: Record<string, number> = {};
      for (const e of scored) if (e.classification) distribution[e.classification] = (distribution[e.classification] || 0) + 1;

      // Brechas por competencia (top)
      const gapRows = await tx.performanceGap.findMany({ where: { tenantId, source: { in: ['COMPETENCY', 'CRITERION'] } }, select: { competencyId: true, label: true, gapValue: true } }).catch(() => []);
      const gapByCompMap = new Map<string, { label: string; total: number; count: number }>();
      for (const g of gapRows as any[]) {
        const key = g.competencyId || g.label || 'otros';
        const cur = gapByCompMap.get(key) || { label: g.label || 'Competencia', total: 0, count: 0 };
        cur.total += g.gapValue || 0; cur.count++; gapByCompMap.set(key, cur);
      }
      const gapsByCompetency = [...gapByCompMap.values()].map((g) => ({ label: g.label, avgGap: round2(g.total / g.count), count: g.count })).sort((a, b) => b.count - a.count).slice(0, 10);

      return {
        activeCycles, pending, inProgress, hrReview, completed, overdue, total,
        avgScore, completionPct, gapsOpen, trainingNeeds, devActionsOpen: devActions, feedbackPending,
        byStatus, byArea, distribution, gapsByCompetency,
      };
    });
    return reply.send(data);
  });

  // ==================== CONTEXTO DEL EMPLEADO (evidencias SGI360) ====================
  // Reutiliza Personal/Puestos/Competencias/Capacitaciones/Objetivos/Ausencias. No duplica datos.
  async function buildEmployeeContext(tx: any, tenantId: string, employeeId: string, opts?: { dueDate?: Date | null; year?: number | null }) {
    const emp = await tx.employee.findFirst({
      where: { id: employeeId, tenantId, deletedAt: null },
      select: {
        id: true, firstName: true, lastName: true, dni: true, email: true, hireDate: true, status: true, location: true, profilePhoto: true,
        department: { select: { id: true, name: true } }, position: { select: { id: true, name: true } },
        supervisor: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!emp) return { error: 'Empleado no encontrado' };
    const antiguedadMeses = emp.hireDate ? Math.max(0, Math.floor((Date.now() - new Date(emp.hireDate).getTime()) / (1000 * 60 * 60 * 24 * 30.44))) : null;

    // Competencias / polivalencia (matriz requerido vs actual)
    const matrix = await computeCompetencyMatrix(tx, employeeId, emp.position?.id);

    // Capacitaciones reales (SgiTraining vía asistentes)
    const attendee = await tx.sgiTrainingAttendee.findMany({
      where: { employeeId }, include: { training: { select: { id: true, title: true, status: true, scheduledDate: true, completedDate: true, competencyId: true } } },
    }).catch(() => []);
    const trainings = (attendee as any[]).map((a) => ({ id: a.training?.id, title: a.training?.title, status: a.training?.status, attended: a.attended, scheduledDate: a.training?.scheduledDate, completedDate: a.training?.completedDate }));
    const trainingSummary = {
      total: trainings.length,
      completed: trainings.filter((t) => t.status === 'COMPLETED').length,
      pending: trainings.filter((t) => ['SCHEDULED', 'IN_PROGRESS'].includes(t.status)).length,
    };

    // Objetivos (evidencia contextual por puesto/proceso; nunca calificación automática)
    const objWhere: any = { tenantId, deletedAt: null };
    if (emp.position?.id) objWhere.responsiblePositionId = emp.position.id;
    const objectives = emp.position?.id ? await tx.sgiObjective.findMany({ where: objWhere, select: { id: true, code: true, title: true, target: true, progress: true, status: true, year: true } }).catch(() => []) : [];

    // Disponibilidad (ausencias aprobadas próximas; SOLO para programación, nunca afecta calificación)
    let availabilityWarning: string | null = null;
    try {
      const from = new Date();
      const to = opts?.dueDate ? new Date(opts.dueDate) : new Date(Date.now() + 30 * 86400000);
      const abs = await tx.absenceRequest.findFirst({ where: { tenantId, employeeId, deletedAt: null, status: { in: ['APPROVED', 'IN_PROGRESS'] }, startDate: { lte: to }, endDate: { gte: from } }, select: { startDate: true, endDate: true } });
      if (abs) availabilityWarning = `El empleado posee una ausencia aprobada (${new Date(abs.startDate).toLocaleDateString('es-AR')}–${new Date(abs.endDate).toLocaleDateString('es-AR')}) próxima al vencimiento de la evaluación.`;
    } catch { /* noop */ }

    return {
      employee: {
        id: emp.id, name: empFullName(emp), legajo: emp.dni, position: emp.position?.name || null, positionId: emp.position?.id || null,
        department: emp.department?.name || null, departmentId: emp.department?.id || null,
        supervisor: emp.supervisor ? empFullName(emp.supervisor) : null, hireDate: emp.hireDate, antiguedadMeses,
        status: emp.status, location: emp.location || null, profilePhoto: emp.profilePhoto || null,
      },
      competencyMatrix: matrix, trainings, trainingSummary, objectives, availabilityWarning,
    };
  }

  app.get('/employees/:id/context', async (req, reply) => {
    const tenantId = await tid(req);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    const data = await app.runWithDbContext(req, (tx: any) => buildEmployeeContext(tx, tenantId, id));
    if ((data as any).error) return reply.code(404).send(data);
    return reply.send(data);
  });

  app.get('/employees/:id/history', async (req, reply) => {
    const tenantId = await tid(req);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    const items = await app.runWithDbContext(req, async (tx: any) => {
      const rows = await tx.performanceEvaluation.findMany({ where: { tenantId, employeeId: id, deletedAt: null, status: 'CERRADA' }, include: { cycle: { select: { name: true, type: true } } }, orderBy: { closedAt: 'desc' } });
      return rows.map((e: any) => ({ id: e.id, cycle: e.cycle?.name, type: e.cycle?.type, finalScore: e.finalScore, classification: e.classification, closedAt: e.closedAt }));
    });
    return reply.send({ items });
  });

  // ==================== EVALUACIONES ====================
  app.get('/evaluations', async (req, reply) => {
    const tenantId = await tid(req);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const q = req.query as any;
    const where: any = { tenantId, deletedAt: null };
    if (cleanUUID(q.cycleId)) where.cycleId = q.cycleId;
    if (cleanUUID(q.employeeId)) where.employeeId = q.employeeId;
    if (q.status) where.status = q.status;
    const items = await app.runWithDbContext(req, async (tx: any) => {
      const rows = await tx.performanceEvaluation.findMany({ where, include: { cycle: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 500 });
      const empIds = [...new Set(rows.map((r: any) => r.employeeId))];
      const emps = empIds.length ? await tx.employee.findMany({ where: { id: { in: empIds as string[] } }, select: { id: true, firstName: true, lastName: true, position: { select: { name: true } }, department: { select: { name: true } } } }) : [];
      const map = new Map(emps.map((e: any) => [e.id, e]));
      return rows.map((r: any) => { const e: any = map.get(r.employeeId); return { ...r, employeeName: empFullName(e), position: e?.position?.name || null, department: e?.department?.name || null }; });
    });
    return reply.send({ items });
  });

  async function loadEvaluationDetail(tx: any, tenantId: string, id: string) {
    const ev = await tx.performanceEvaluation.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        cycle: true, evaluators: true, gaps: true, feedbacks: { orderBy: { createdAt: 'desc' } },
        histories: { orderBy: { createdAt: 'desc' } }, plan: { include: { actions: { orderBy: { createdAt: 'asc' } } } },
      },
    });
    if (!ev) return null;
    const template = ev.templateId ? await tx.performanceTemplate.findFirst({ where: { id: ev.templateId }, include: { criteria: { orderBy: { order: 'asc' } } } }) : null;
    const scale = ev.scaleId ? await tx.performanceScale.findFirst({ where: { id: ev.scaleId }, include: { levels: { orderBy: { order: 'asc' } } } }) : await getDefaultScale(tx, tenantId);
    const responses = await tx.performanceResponse.findMany({ where: { evaluationId: id } });
    const context = await buildEmployeeContext(tx, tenantId, ev.employeeId, { dueDate: ev.dueDate });
    return { ...ev, template, scale, responses, context };
  }

  app.get('/evaluations/:id', async (req, reply) => {
    const tenantId = await tid(req);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    const item = await app.runWithDbContext(req, (tx: any) => loadEvaluationDetail(tx, tenantId, id));
    if (!item) return reply.code(404).send({ error: 'Evaluación no encontrada' });
    return reply.send({ item });
  });

  app.post('/evaluations', async (req, reply) => {
    const tenantId = await tid(req);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const body = req.body as any;
    if (!cleanUUID(body.cycleId) || !cleanUUID(body.employeeId)) return reply.code(400).send({ error: 'cycleId y employeeId son requeridos' });
    const userId = uid(req);
    const result = await app.runWithDbContext(req, async (tx: any) => {
      const cycle = await tx.performanceCycle.findFirst({ where: { id: body.cycleId, tenantId, deletedAt: null } });
      if (!cycle) return { error: 'Ciclo no encontrado' };
      const emp = await tx.employee.findFirst({ where: { id: body.employeeId, tenantId, deletedAt: null }, select: { id: true, positionId: true, departmentId: true, supervisorId: true } });
      if (!emp) return { error: 'Empleado no encontrado' };
      const existing = await tx.performanceEvaluation.findFirst({ where: { cycleId: cycle.id, employeeId: emp.id } });
      if (existing) return { error: 'El empleado ya tiene una evaluación en este ciclo' };
      const evaluatorUserId = await getUserIdForEmployee(tx, emp.supervisorId);
      const ev = await tx.performanceEvaluation.create({ data: {
        tenantId, cycleId: cycle.id, employeeId: emp.id, templateId: body.templateId ? cleanUUID(body.templateId) : (cycle.templateId ?? null),
        scaleId: cycle.scaleId ?? (await getDefaultScale(tx, tenantId))?.id ?? null, positionId: emp.positionId ?? null, departmentId: emp.departmentId ?? null,
        evaluatorEmployeeId: emp.supervisorId ?? null, evaluatorUserId, status: 'PENDIENTE', dueDate: cycle.endDate ?? null, config: { mode360: !!cycle.allow360 }, createdById: userId, updatedById: userId,
      } });
      await addHistory(tx, { tenantId, evaluationId: ev.id, toStatus: 'PENDIENTE', action: 'CREADA', userId, userName: await resolveUserName(tx, userId) });
      return { item: ev };
    });
    if ((result as any).error) return reply.code(400).send({ error: (result as any).error });
    return reply.code(201).send({ item: (result as any).item });
  });

  // Guardar respuestas (autoevaluación / responsable / 360). No define estado; recalcula puntajes.
  app.patch('/evaluations/:id/responses', async (req, reply) => {
    const tenantId = await tid(req);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    const body = req.body as any;
    const role = (body.role || 'MANAGER').toUpperCase();
    const responses = Array.isArray(body.responses) ? body.responses : [];
    const result = await app.runWithDbContext(req, async (tx: any) => {
      const ev = await tx.performanceEvaluation.findFirst({ where: { id, tenantId, deletedAt: null } });
      if (!ev) return { error: 'not_found' };
      if (ev.status === 'CERRADA') return { error: 'La evaluación está cerrada' };
      const evaluator = await tx.performanceEvaluator.findFirst({ where: { evaluationId: id, role } });
      for (const r of responses) {
        if (!cleanUUID(r.criterionId)) continue;
        const existing = await tx.performanceResponse.findFirst({ where: { evaluationId: id, criterionId: r.criterionId, role } });
        if (existing) await tx.performanceResponse.update({ where: { id: existing.id }, data: { score: r.score ?? null, comment: r.comment ?? null, evidence: r.evidence ?? null } });
        else await tx.performanceResponse.create({ data: { tenantId, evaluationId: id, criterionId: r.criterionId, evaluatorId: evaluator?.id ?? null, role, score: r.score ?? null, comment: r.comment ?? null, evidence: r.evidence ?? null } });
      }
      if (evaluator) await tx.performanceEvaluator.update({ where: { id: evaluator.id }, data: { status: 'IN_PROGRESS' } });
      await scoreEvaluation(tx, tenantId, id);
      return { item: await loadEvaluationDetail(tx, tenantId, id) };
    });
    if ((result as any).error === 'not_found') return reply.code(404).send({ error: 'Evaluación no encontrada' });
    if ((result as any).error) return reply.code(400).send({ error: (result as any).error });
    return reply.send({ item: (result as any).item });
  });

  // Máquina de estados con historial y notificaciones.
  const ALLOWED: Record<string, string[]> = {
    BORRADOR: ['PENDIENTE', 'CANCELADA'],
    PENDIENTE: ['AUTOEVALUACION', 'EVALUACION_RESPONSABLE', 'CANCELADA'],
    AUTOEVALUACION: ['EVALUACION_RESPONSABLE', 'CANCELADA'],
    EVALUACION_RESPONSABLE: ['REVISION_RRHH', 'DEVOLUCION', 'CERRADA', 'CANCELADA'],
    REVISION_RRHH: ['DEVOLUCION', 'CERRADA', 'EVALUACION_RESPONSABLE', 'CANCELADA'],
    DEVOLUCION: ['CERRADA', 'CANCELADA'],
    REABIERTA: ['EVALUACION_RESPONSABLE', 'REVISION_RRHH', 'CANCELADA'],
  };

  app.post('/evaluations/:id/transition', async (req, reply) => {
    const tenantId = await tid(req);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    const body = req.body as any;
    const to = String(body.to || '').toUpperCase();
    if (!EVAL_STATUSES.includes(to)) return reply.code(400).send({ error: 'Estado destino inválido' });
    const userId = uid(req);
    const result = await app.runWithDbContext(req, async (tx: any) => {
      const ev = await tx.performanceEvaluation.findFirst({ where: { id, tenantId, deletedAt: null } });
      if (!ev) return { error: 'not_found' };
      const allowed = ALLOWED[ev.status] || [];
      if (!allowed.includes(to)) return { error: `Transición no permitida de ${ev.status} a ${to}` };
      if (to === 'CERRADA' && ev.managerScore == null && ev.finalScore == null) return { error: 'No se puede cerrar sin la evaluación del responsable' };
      const data: any = { status: to, updatedById: userId };
      if (to === 'CERRADA') { data.closedAt = new Date(); data.closedById = userId; }
      const updated = await tx.performanceEvaluation.update({ where: { id }, data });
      const userName = await resolveUserName(tx, userId);
      await addHistory(tx, { tenantId, evaluationId: id, fromStatus: ev.status, toStatus: to, action: 'TRANSICION', userId, userName, comment: body.comment ?? null });
      // Notificaciones
      const employeeUserId = await getUserIdForEmployee(tx, ev.employeeId);
      if (to === 'AUTOEVALUACION' && employeeUserId) await notify(tx, { tenantId, userId: employeeUserId, title: 'Autoevaluación pendiente', message: 'Tenés una autoevaluación de desempeño para completar.', link: `/rrhh/desempeno/evaluacion/${id}`, entityId: id });
      if (to === 'EVALUACION_RESPONSABLE' && ev.evaluatorUserId) await notify(tx, { tenantId, userId: ev.evaluatorUserId, title: 'Evaluación pendiente', message: 'Tenés una evaluación de tu equipo para completar.', link: `/rrhh/desempeno/evaluacion/${id}`, entityId: id });
      if (to === 'DEVOLUCION' && employeeUserId) await notify(tx, { tenantId, userId: employeeUserId, title: 'Entrevista de devolución', message: 'Tenés una devolución de evaluación de desempeño pendiente.', link: `/rrhh/desempeno/evaluacion/${id}`, entityId: id });
      if (to === 'CERRADA' && employeeUserId) await notify(tx, { tenantId, userId: employeeUserId, title: 'Evaluación cerrada', message: 'Tu evaluación de desempeño fue cerrada. Podés consultar el resultado.', link: `/rrhh/desempeno/evaluacion/${id}`, entityId: id });
      return { item: updated };
    });
    if ((result as any).error === 'not_found') return reply.code(404).send({ error: 'Evaluación no encontrada' });
    if ((result as any).error) return reply.code(400).send({ error: (result as any).error });
    return reply.send({ item: (result as any).item });
  });

  app.post('/evaluations/:id/reopen', async (req, reply) => {
    const tenantId = await tid(req);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    const body = req.body as any;
    if (!body.reason || !String(body.reason).trim()) return reply.code(400).send({ error: 'El motivo de reapertura es obligatorio' });
    const userId = uid(req);
    const result = await app.runWithDbContext(req, async (tx: any) => {
      const ev = await tx.performanceEvaluation.findFirst({ where: { id, tenantId, deletedAt: null } });
      if (!ev) return { error: 'not_found' };
      if (ev.status !== 'CERRADA') return { error: 'Solo se puede reabrir una evaluación cerrada' };
      const updated = await tx.performanceEvaluation.update({ where: { id }, data: { status: 'REABIERTA', reopenReason: body.reason, reopenedById: userId, reopenedAt: new Date(), closedAt: null, closedById: null, updatedById: userId } });
      await addHistory(tx, { tenantId, evaluationId: id, fromStatus: 'CERRADA', toStatus: 'REABIERTA', action: 'REAPERTURA', userId, userName: await resolveUserName(tx, userId), comment: body.reason });
      return { item: updated };
    });
    if ((result as any).error === 'not_found') return reply.code(404).send({ error: 'Evaluación no encontrada' });
    if ((result as any).error) return reply.code(400).send({ error: (result as any).error });
    return reply.send({ item: (result as any).item });
  });

  // Recalcular brechas de competencia (determinístico, desde la matriz puesto vs empleado).
  app.post('/evaluations/:id/gaps/recompute', async (req, reply) => {
    const tenantId = await tid(req);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    const result = await app.runWithDbContext(req, async (tx: any) => {
      const ev = await tx.performanceEvaluation.findFirst({ where: { id, tenantId, deletedAt: null } });
      if (!ev) return { error: 'not_found' };
      const matrix = await computeCompetencyMatrix(tx, ev.employeeId, ev.positionId);
      // Reemplaza brechas de competencia autogeneradas (mantiene las que tienen necesidad/acción vinculada)
      await tx.performanceGap.deleteMany({ where: { evaluationId: id, source: 'COMPETENCY', linkedTrainingNeedId: null, linkedDevelopmentActionId: null } });
      for (const g of matrix.gaps) {
        const exists = await tx.performanceGap.findFirst({ where: { evaluationId: id, source: 'COMPETENCY', competencyId: g.competencyId } });
        if (exists) continue;
        await tx.performanceGap.create({ data: { tenantId, evaluationId: id, competencyId: g.competencyId, source: 'COMPETENCY', label: g.name, expectedLevel: g.requiredLevel, obtainedLevel: g.currentLevel, gapValue: g.gap, severity: g.gap >= 2 ? 'HIGH' : 'MEDIUM', description: `Nivel requerido ${g.requiredLevel} vs actual ${g.currentLevel}` } });
      }
      return { item: await tx.performanceGap.findMany({ where: { evaluationId: id }, orderBy: { gapValue: 'desc' } }) };
    });
    if ((result as any).error === 'not_found') return reply.code(404).send({ error: 'Evaluación no encontrada' });
    return reply.send({ items: (result as any).item });
  });

  // Generar necesidad de capacitación desde una brecha -> crea SgiTraining (circuito real) + acción de desarrollo.
  app.post('/evaluations/:id/gaps/:gapId/training-need', async (req, reply) => {
    const tenantId = await tid(req);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id, gapId } = req.params as { id: string; gapId: string };
    const userId = uid(req);
    const result = await app.runWithDbContext(req, async (tx: any) => {
      const ev = await tx.performanceEvaluation.findFirst({ where: { id, tenantId, deletedAt: null } });
      if (!ev) return { error: 'not_found' };
      const gap = await tx.performanceGap.findFirst({ where: { id: gapId, evaluationId: id, tenantId } });
      if (!gap) return { error: 'Brecha no encontrada' };
      if (gap.linkedTrainingNeedId) return { error: 'La brecha ya tiene una necesidad de capacitación asociada' };
      const code = `NEC-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
      const training = await tx.sgiTraining.create({ data: {
        tenantId, code, title: `Necesidad: ${gap.label || 'Brecha de desempeño'}`, description: `Necesidad detectada en evaluación de desempeño. Nivel esperado ${gap.expectedLevel ?? '-'}, obtenido ${gap.obtainedLevel ?? '-'}.`,
        category: 'Brecha de desempeño', modality: 'PRESENCIAL', competencyId: gap.competencyId ?? null, gapLevel: gap.gapValue ? Math.round(gap.gapValue) : null,
        durationHours: 0, status: 'SCHEDULED', expectedParticipants: 1, createdById: userId, updatedById: userId,
      } });
      try { await tx.sgiTrainingAttendee.create({ data: { trainingId: training.id, employeeId: ev.employeeId } }); } catch { /* noop */ }
      // Plan de desarrollo + acción trazable
      let plan = await tx.developmentPlan.findFirst({ where: { evaluationId: id } });
      if (!plan) plan = await tx.developmentPlan.create({ data: { tenantId, evaluationId: id, employeeId: ev.employeeId, status: 'OPEN', createdById: userId } });
      const action = await tx.developmentAction.create({ data: { tenantId, planId: plan.id, type: 'CAPACITACION', description: `Cubrir brecha: ${gap.label || ''}`.trim(), competencyId: gap.competencyId ?? null, priority: gap.severity === 'HIGH' ? 'ALTA' : 'MEDIA', status: 'PENDIENTE', linkedEntityType: 'TRAINING', linkedEntityId: training.id } });
      await tx.performanceGap.update({ where: { id: gapId }, data: { linkedTrainingNeedId: training.id, linkedDevelopmentActionId: action.id, status: 'IN_PROGRESS' } });
      await addHistory(tx, { tenantId, evaluationId: id, action: 'NECESIDAD_CAPACITACION', userId, userName: await resolveUserName(tx, userId), comment: `Necesidad "${training.code}" creada para brecha ${gap.label || ''}` });
      return { training, action };
    });
    if ((result as any).error === 'not_found') return reply.code(404).send({ error: 'Evaluación no encontrada' });
    if ((result as any).error) return reply.code(400).send({ error: (result as any).error });
    return reply.code(201).send(result);
  });

  // ==================== PLAN DE DESARROLLO ====================
  app.post('/evaluations/:id/plan', async (req, reply) => {
    const tenantId = await tid(req);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    const body = req.body as any;
    const userId = uid(req);
    const result = await app.runWithDbContext(req, async (tx: any) => {
      const ev = await tx.performanceEvaluation.findFirst({ where: { id, tenantId, deletedAt: null } });
      if (!ev) return { error: 'not_found' };
      const plan = await tx.developmentPlan.upsert({
        where: { evaluationId: id },
        create: { tenantId, evaluationId: id, employeeId: ev.employeeId, title: body.title ?? null, summary: body.summary ?? null, status: body.status ?? 'OPEN', createdById: userId },
        update: { title: body.title ?? undefined, summary: body.summary ?? undefined, status: body.status ?? undefined },
      });
      return { item: await tx.developmentPlan.findFirst({ where: { id: plan.id }, include: { actions: { orderBy: { createdAt: 'asc' } } } }) };
    });
    if ((result as any).error === 'not_found') return reply.code(404).send({ error: 'Evaluación no encontrada' });
    return reply.send({ item: (result as any).item });
  });

  app.post('/evaluations/:id/plan/actions', async (req, reply) => {
    const tenantId = await tid(req);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    const body = req.body as any;
    if (!body.type) return reply.code(400).send({ error: 'El tipo de acción es requerido' });
    const userId = uid(req);
    const result = await app.runWithDbContext(req, async (tx: any) => {
      const ev = await tx.performanceEvaluation.findFirst({ where: { id, tenantId, deletedAt: null } });
      if (!ev) return { error: 'not_found' };
      let plan = await tx.developmentPlan.findFirst({ where: { evaluationId: id } });
      if (!plan) plan = await tx.developmentPlan.create({ data: { tenantId, evaluationId: id, employeeId: ev.employeeId, status: 'OPEN', createdById: userId } });
      const action = await tx.developmentAction.create({ data: {
        tenantId, planId: plan.id, type: body.type, description: body.description ?? null,
        competencyId: cleanUUID(body.competencyId) ?? null, criterionId: cleanUUID(body.criterionId) ?? null,
        responsibleUserId: cleanUUID(body.responsibleUserId) ?? null, responsibleEmployeeId: cleanUUID(body.responsibleEmployeeId) ?? null,
        targetDate: body.targetDate ? new Date(body.targetDate) : null, priority: body.priority ?? 'MEDIA', status: body.status ?? 'PENDIENTE',
        linkedEntityType: body.linkedEntityType ?? null, linkedEntityId: cleanUUID(body.linkedEntityId) ?? null,
      } });
      return { item: action };
    });
    if ((result as any).error === 'not_found') return reply.code(404).send({ error: 'Evaluación no encontrada' });
    return reply.code(201).send({ item: (result as any).item });
  });

  app.patch('/plan/actions/:actionId', async (req, reply) => {
    const tenantId = await tid(req);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { actionId } = req.params as { actionId: string };
    const body = req.body as any;
    const item = await app.runWithDbContext(req, async (tx: any) => {
      const a = await tx.developmentAction.findFirst({ where: { id: actionId, tenantId } });
      if (!a) return null;
      return tx.developmentAction.update({ where: { id: actionId }, data: {
        description: body.description ?? undefined, priority: body.priority ?? undefined, status: body.status ?? undefined,
        targetDate: body.targetDate !== undefined ? (body.targetDate ? new Date(body.targetDate) : null) : undefined,
        evidence: body.evidence ?? undefined, closedAt: body.status === 'COMPLETADA' ? new Date() : undefined,
      } });
    });
    if (!item) return reply.code(404).send({ error: 'Acción no encontrada' });
    return reply.send({ item });
  });

  app.delete('/plan/actions/:actionId', async (req, reply) => {
    const tenantId = await tid(req);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { actionId } = req.params as { actionId: string };
    await app.runWithDbContext(req, (tx: any) => tx.developmentAction.deleteMany({ where: { id: actionId, tenantId } }));
    return reply.send({ ok: true });
  });

  // ==================== DEVOLUCIÓN ====================
  app.post('/evaluations/:id/feedback', async (req, reply) => {
    const tenantId = await tid(req);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    const body = req.body as any;
    const userId = uid(req);
    const result = await app.runWithDbContext(req, async (tx: any) => {
      const ev = await tx.performanceEvaluation.findFirst({ where: { id, tenantId, deletedAt: null } });
      if (!ev) return { error: 'not_found' };
      const fb = await tx.performanceFeedback.create({ data: {
        tenantId, evaluationId: id, date: body.date ? new Date(body.date) : new Date(), responsibleUserId: userId,
        participants: Array.isArray(body.participants) ? body.participants : [], summary: body.summary ?? null,
        employeeComments: body.employeeComments ?? null, agreements: body.agreements ?? null, commitments: body.commitments ?? null,
        nextFollowUp: body.nextFollowUp ? new Date(body.nextFollowUp) : null, notified: true,
      } });
      const employeeUserId = await getUserIdForEmployee(tx, ev.employeeId);
      if (employeeUserId) await notify(tx, { tenantId, userId: employeeUserId, title: 'Devolución de evaluación', message: 'Se registró la devolución de tu evaluación. Confirmá la recepción.', link: `/rrhh/desempeno/evaluacion/${id}`, entityId: id });
      await addHistory(tx, { tenantId, evaluationId: id, action: 'DEVOLUCION_REGISTRADA', userId, userName: await resolveUserName(tx, userId) });
      return { item: fb };
    });
    if ((result as any).error === 'not_found') return reply.code(404).send({ error: 'Evaluación no encontrada' });
    return reply.code(201).send({ item: (result as any).item });
  });

  app.post('/feedback/:fid/acknowledge', async (req, reply) => {
    const tenantId = await tid(req);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { fid } = req.params as { fid: string };
    const body = req.body as any;
    const status = String(body.status || 'CONFORME').toUpperCase();
    const item = await app.runWithDbContext(req, async (tx: any) => {
      const fb = await tx.performanceFeedback.findFirst({ where: { id: fid, tenantId } });
      if (!fb) return null;
      return tx.performanceFeedback.update({ where: { id: fid }, data: { acknowledgedAt: new Date(), acknowledgementStatus: status, employeeComments: body.employeeComments ?? fb.employeeComments } });
    });
    if (!item) return reply.code(404).send({ error: 'Devolución no encontrada' });
    return reply.send({ item });
  });

  // ==================== 360° (evaluadores) ====================
  app.post('/evaluations/:id/evaluators', async (req, reply) => {
    const tenantId = await tid(req);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    const body = req.body as any;
    const result = await app.runWithDbContext(req, async (tx: any) => {
      const ev = await tx.performanceEvaluation.findFirst({ where: { id, tenantId, deletedAt: null } });
      if (!ev) return { error: 'not_found' };
      const evaluatorUserId = await getUserIdForEmployee(tx, cleanUUID(body.evaluatorEmployeeId));
      const item = await tx.performanceEvaluator.create({ data: { tenantId, evaluationId: id, evaluatorEmployeeId: cleanUUID(body.evaluatorEmployeeId) ?? null, evaluatorUserId, role: (body.role || 'PEER').toUpperCase(), weight: body.weight ?? 0, confidential: !!body.confidential } });
      return { item };
    });
    if ((result as any).error === 'not_found') return reply.code(404).send({ error: 'Evaluación no encontrada' });
    return reply.code(201).send({ item: (result as any).item });
  });

  app.delete('/evaluators/:evId', async (req, reply) => {
    const tenantId = await tid(req);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { evId } = req.params as { evId: string };
    await app.runWithDbContext(req, (tx: any) => tx.performanceEvaluator.deleteMany({ where: { id: evId, tenantId } }));
    return reply.send({ ok: true });
  });

  // ==================== IA (asistiva) ====================
  app.post('/evaluations/:id/ai-analyze', async (req, reply) => {
    const tenantId = await tid(req);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = req.params as { id: string };
    const detail = await app.runWithDbContext(req, (tx: any) => loadEvaluationDetail(tx, tenantId, id));
    if (!detail) return reply.code(404).send({ error: 'Evaluación no encontrada' });
    const llm = createGroqOnlyLLMProvider((req as any).tenant, (app as any).prisma, tenantId, uid(req), 'performance-ai');
    const payload = {
      empleado: detail.context?.employee?.name, puesto: detail.context?.employee?.position,
      resultadoFinal: detail.finalScore, clasificacion: detail.classification,
      criterios: (detail.template?.criteria || []).map((c: any) => ({ nombre: c.name, peso: c.weight, categoria: c.category })),
      respuestas: (detail.responses || []).map((r: any) => ({ criterio: r.criterionId, rol: r.role, puntaje: r.score, comentario: r.comment })),
      brechasCompetencia: detail.context?.competencyMatrix?.gaps || [],
      capacitaciones: detail.context?.trainingSummary, objetivos: detail.context?.objectives,
      historial: detail.histories?.slice(0, 5),
    };
    const prompt = `Sos analista de RRHH. Analizá esta evaluación de desempeño y respondé en español, claro y accionable. ` +
      `TODA recomendación debe cerrar con "Sugerencia generada por IA — requiere revisión humana.". ` +
      `NO definas la calificación final, NO apruebes/rechaces al empleado, NO recomiendes despidos ni sanciones, NO diagnostiques condiciones, NO uses datos médicos, NO penalices vacaciones/licencias.\n\n` +
      `Datos: ${JSON.stringify(payload)}\n\n` +
      `Devolvé secciones cortas: 1) Resumen ejecutivo, 2) Fortalezas, 3) Brechas, 4) Brechas recurrentes (si el historial lo sugiere), 5) Recomendaciones de desarrollo, 6) Capacitaciones sugeridas, 7) Reevaluaciones sugeridas, 8) Propuesta de Plan Individual de Desarrollo.`;
    try {
      const res = await llm.chat([{ role: 'user', content: prompt }], 1500);
      const analysis = res?.text || 'Sin respuesta del modelo';
      await app.runWithDbContext(req, (tx: any) => tx.performanceEvaluation.update({ where: { id }, data: { aiAnalysis: { text: analysis, generatedAt: new Date().toISOString() } } }));
      return reply.send({ analysis, disclaimer: 'Sugerencia generada por IA — requiere revisión humana.' });
    } catch (e: any) {
      return reply.code(500).send({ error: 'No se pudo generar el análisis con IA', details: e?.message });
    }
  });

  // ==================== PORTAL DEL EMPLEADO ====================
  app.get('/me/evaluations', async (req, reply) => {
    const tenantId = await tid(req);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const userId = uid(req);
    const data = await app.runWithDbContext(req, async (tx: any) => {
      const me = await getEmployeeForUser(tx, tenantId, userId);
      if (!me) return { linked: false, asEmployee: [], asEvaluator: [] };
      const asEmployee = await tx.performanceEvaluation.findMany({ where: { tenantId, employeeId: me.id, deletedAt: null }, include: { cycle: { select: { name: true } } }, orderBy: { createdAt: 'desc' } });
      const asEvaluator = await tx.performanceEvaluation.findMany({ where: { tenantId, evaluatorEmployeeId: me.id, deletedAt: null, status: { in: ['EVALUACION_RESPONSABLE', 'PENDIENTE', 'REABIERTA'] } }, include: { cycle: { select: { name: true } } }, orderBy: { createdAt: 'desc' } });
      const empIds = [...new Set(asEvaluator.map((e: any) => e.employeeId))];
      const emps = empIds.length ? await tx.employee.findMany({ where: { id: { in: empIds as string[] } }, select: { id: true, firstName: true, lastName: true } }) : [];
      const map = new Map(emps.map((e: any) => [e.id, e]));
      return { linked: true, asEmployee, asEvaluator: asEvaluator.map((e: any) => ({ ...e, employeeName: empFullName(map.get(e.employeeId)) })) };
    });
    return reply.send(data);
  });

  app.get('/me/evaluations/:id', async (req, reply) => {
    const tenantId = await tid(req);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const userId = uid(req);
    const { id } = req.params as { id: string };
    const result = await app.runWithDbContext(req, async (tx: any) => {
      const me = await getEmployeeForUser(tx, tenantId, userId);
      if (!me) return { error: 'no_employee' };
      const ev = await tx.performanceEvaluation.findFirst({ where: { id, tenantId, deletedAt: null } });
      if (!ev || (ev.employeeId !== me.id && ev.evaluatorEmployeeId !== me.id)) return { error: 'forbidden' };
      return { item: await loadEvaluationDetail(tx, tenantId, id), viewerRole: ev.employeeId === me.id ? 'SELF' : 'MANAGER' };
    });
    if ((result as any).error === 'no_employee') return reply.code(404).send({ error: 'Tu usuario no está vinculado a un legajo.' });
    if ((result as any).error === 'forbidden') return reply.code(403).send({ error: 'No autorizado' });
    return reply.send(result);
  });

  app.patch('/me/evaluations/:id/self-responses', async (req, reply) => {
    const tenantId = await tid(req);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const userId = uid(req);
    const { id } = req.params as { id: string };
    const body = req.body as any;
    const responses = Array.isArray(body.responses) ? body.responses : [];
    const result = await app.runWithDbContext(req, async (tx: any) => {
      const me = await getEmployeeForUser(tx, tenantId, userId);
      if (!me) return { error: 'no_employee' };
      const ev = await tx.performanceEvaluation.findFirst({ where: { id, tenantId, deletedAt: null } });
      if (!ev || ev.employeeId !== me.id) return { error: 'forbidden' };
      if (!['PENDIENTE', 'AUTOEVALUACION'].includes(ev.status)) return { error: 'La autoevaluación no está habilitada en este estado' };
      const evaluator = await tx.performanceEvaluator.findFirst({ where: { evaluationId: id, role: 'SELF' } });
      for (const r of responses) {
        if (!cleanUUID(r.criterionId)) continue;
        const existing = await tx.performanceResponse.findFirst({ where: { evaluationId: id, criterionId: r.criterionId, role: 'SELF' } });
        if (existing) await tx.performanceResponse.update({ where: { id: existing.id }, data: { score: r.score ?? null, comment: r.comment ?? null, evidence: r.evidence ?? null } });
        else await tx.performanceResponse.create({ data: { tenantId, evaluationId: id, criterionId: r.criterionId, evaluatorId: evaluator?.id ?? null, role: 'SELF', score: r.score ?? null, comment: r.comment ?? null, evidence: r.evidence ?? null } });
      }
      if (ev.status === 'PENDIENTE') await tx.performanceEvaluation.update({ where: { id }, data: { status: 'AUTOEVALUACION' } });
      await scoreEvaluation(tx, tenantId, id);
      return { ok: true };
    });
    if ((result as any).error === 'no_employee') return reply.code(404).send({ error: 'Tu usuario no está vinculado a un legajo.' });
    if ((result as any).error === 'forbidden') return reply.code(403).send({ error: 'No autorizado' });
    if ((result as any).error) return reply.code(400).send({ error: (result as any).error });
    return reply.send(result);
  });
};

export default performanceRoutes;
