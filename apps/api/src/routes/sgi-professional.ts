import { isSuperAdmin, getEffectiveTenantId } from '../utils/tenant-bypass.js';
/**
 * Rutas CRUD para los 9 módulos SGI profesionales agregados en Abr 2026.
 * Usa el mismo patrón que ncr.ts: runWithDbContext + soft delete + auto-code por año.
 */
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { createGroqOnlyLLMProvider } from '../services/llm/factory.js';

type ModelName =
  | 'actionItem'
  | 'sgiObjective'
  | 'stakeholder'
  | 'hazard'
  | 'environmentalAspect'
  | 'incident'
  | 'supplier'
  | 'measuringEquipment';

interface CrudOptions {
  model: ModelName;
  codePrefix?: string;
  listOrder?: any;
  filterableFields?: string[];
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v);

function sanitizeUuidFields(data: Record<string, any>): void {
  for (const k of Object.keys(data)) {
    if (k.endsWith('Id') && data[k] !== null && data[k] !== undefined) {
      if (!isUuid(data[k])) {
        console.warn(`[makeCrud] Campo "${k}" con valor no-UUID "${data[k]}" → seteado a null`);
        data[k] = null;
      }
    }
  }
}

function makeCrud(prefix: string, opts: CrudOptions): FastifyPluginAsync {
  return async (app) => {
    // LIST
    app.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      const query = req.query as Record<string, string>;
      const where: any = { tenantId, deletedAt: null };
      if (opts.filterableFields) {
        for (const f of opts.filterableFields) {
          if (query[f] !== undefined && query[f] !== '') {
            where[f] = query[f];
          }
        }
      }
      const items = await app.runWithDbContext(req, async (tx: any) => {
        return tx[opts.model].findMany({
          where,
          orderBy: opts.listOrder ?? { createdAt: 'desc' },
        });
      });
      return reply.send({ items });
    });

    // CREATE
    app.post('/', async (req: FastifyRequest, reply: FastifyReply) => {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      let body = req.body as any;
      // Parse body if it's a string JSON
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch (e) {
          return reply.code(400).send({ error: 'Cuerpo JSON inválido' });
        }
      }

      // Remove deprecated fields that may come from cached frontend
      delete body?.reviewDate;
      // Never accept id on create — Prisma generates UUID automatically
      delete body?.id;

      try {
        const item = await app.runWithDbContext(req, async (tx: any) => {
          const data: any = { ...body, tenantId };
          // strip undefined / empty strings that might break date fields
          Object.keys(data).forEach((k) => {
            if (data[k] === '' || data[k] === undefined) data[k] = null;
          });
          // strip relation arrays that Prisma can't accept in create data
          Object.keys(data).forEach((k) => {
            if (Array.isArray(data[k])) delete data[k];
          });
          // strip relation objects/nulls that Prisma can't accept
          Object.keys(data).forEach((k) => {
            if (data[k] !== null && typeof data[k] === 'object' && !Array.isArray(data[k])) delete data[k];
          });

          // Sanitize: any *Id field that is not a valid UUID must be nulled
          // (prevents P2023 when user fills text-label in FK fields)
          sanitizeUuidFields(data);

          // Convert date strings
          for (const k of Object.keys(data)) {
            if (/Date$|At$/.test(k) && typeof data[k] === 'string' && data[k]) {
              data[k] = new Date(data[k]);
            }
          }

          // Auto code
          if (opts.codePrefix && !data.code) {
            const year = new Date().getFullYear();
            const count = await tx[opts.model].count({
              where: { tenantId, code: { startsWith: `${opts.codePrefix}-${year}-` } },
            });
            data.code = `${opts.codePrefix}-${year}-${String(count + 1).padStart(3, '0')}`;
          }

          console.log(`[makeCrud POST ${opts.model}] data keys:`, Object.keys(data));
          console.log(`[makeCrud POST ${opts.model}] full data:`, JSON.stringify(data));

          return tx[opts.model].create({ data });
        });

        return reply.code(201).send({ item });
      } catch (err: any) {
        req.log.error({ err, body, model: opts.model }, 'Error en makeCrud POST');
        console.error(`[makeCrud POST ${opts.model}] ERROR:`, err.message, err.code, err.meta);
        return reply.code(500).send({ error: 'Error interno del servidor', detail: err.message, model: opts.model });
      }
    });

    // GET by id
    app.get('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
      const item = await app.runWithDbContext(req, async (tx: any) => {
        return tx[opts.model].findFirst({ where: { id, tenantId, deletedAt: null } });
      });
      if (!item) return reply.code(404).send({ error: 'No encontrado' });
      return reply.send({ item });
    });

    // UPDATE
    app.patch('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
      const body = req.body as any;

      const item = await app.runWithDbContext(req, async (tx: any) => {
        const existing = await tx[opts.model].findFirst({ where: { id, tenantId, deletedAt: null } });
        if (!existing) throw new Error('No encontrado');

        // Remove deprecated fields that may come from cached frontend
        delete body?.reviewDate;

        const data = { ...body };
        delete data.id;
        delete data.tenantId;
        delete data.createdAt;
        delete data.createdById;

        for (const k of Object.keys(data)) {
          if (/Date$|At$/.test(k) && typeof data[k] === 'string' && data[k]) {
            data[k] = new Date(data[k]);
          }
          if (data[k] === '') data[k] = null;
        }

        // Sanitize: any *Id field that is not a valid UUID must be nulled
        sanitizeUuidFields(data);

        const MODELS_WITH_AUDIT = new Set(['actionItem']);
        if (MODELS_WITH_AUDIT.has(opts.model)) {
          data.updatedById = req.auth?.userId ?? null;
        }

        // ----- CAPA PROGRESS & VALIDATION (actionItem only) -----
        if (opts.model === 'actionItem') {
          const merged = { ...existing, ...data };
          let progress = 0;
          if (merged.origin || merged.affectedArea || merged.detectedBy) progress += 15;
          if (merged.containmentActions || merged.containmentResult) progress += 15;
          if (merged.rootCause) progress += 15;
          if (merged.correctiveAction) progress += 15;
          if (merged.preventiveAction || merged.processChanges || merged.documentationChanges) progress += 15;
          if (merged.effectivenessResult) progress += 15;
          if (merged.closedAt || merged.status === 'CLOSED') progress += 10;
          data.progress = Math.min(100, progress);

          // Validate closure requirements
          if (data.status === 'CLOSED' || data.closedAt) {
            const missing: string[] = [];
            if (!merged.rootCause?.trim()) missing.push('causa raíz');
            if (!merged.correctiveAction?.trim()) missing.push('acción correctiva');
            if (!merged.effectivenessResult) missing.push('evaluación de eficacia');
            if (missing.length > 0) {
              throw new Error(`No se puede cerrar la acción. Faltan: ${missing.join(', ')}`);
            }
          }
        }
        // ----------------------------------------------------------

        return tx[opts.model].update({ where: { id }, data });
      });
      return reply.send({ item });
    });

    // DELETE (soft)
    app.delete('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
      const tenantId = await getEffectiveTenantId(req, app.prisma);
      if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
      const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

      const result = await app.runWithDbContext(req, async (tx: any) => {
        const existing = await tx[opts.model].findFirst({ where: { id, tenantId, deletedAt: null } });
        if (!existing) return { kind: 'not_found' as const };
        await tx[opts.model].update({ where: { id }, data: { deletedAt: new Date() } });
        return { kind: 'ok' as const };
      });
      if (result.kind === 'not_found') return reply.code(404).send({ error: 'No encontrado' });
      return reply.send({ success: true });
    });

    void prefix;
  };
}

export const actionsRoutes = makeCrud('actions', { model: 'actionItem', codePrefix: 'ACT', filterableFields: ['status', 'type', 'sourceType', 'origin', 'priority'] });
export const stakeholdersRoutes = makeCrud('stakeholders', { model: 'stakeholder' });

// Endpoint adicional para generar acción CAPA desde stakeholder
export const stakeholderActionRoutes: FastifyPluginAsync = async (app) => {
  app.post('/:id/generate-action', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = z.object({ id: z.string() }).parse(req.params);

    const stakeholder = await app.runWithDbContext(req, async (tx: any) => {
      return tx.stakeholder.findFirst({ where: { id, tenantId, deletedAt: null } });
    });
    if (!stakeholder) return reply.code(404).send({ error: 'Parte interesada no encontrada' });

    const rawBody = req.body;
    const body = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody as any;

    const action = await app.runWithDbContext(req, async (tx: any) => {
      // Auto-generate action code like ACT-2026-001
      const year = new Date().getFullYear();
      const count = await tx.actionItem.count({
        where: { tenantId, code: { startsWith: `ACT-${year}-` } }
      });
      const code = `ACT-${year}-${String(count + 1).padStart(3, '0')}`;

      // Create action item
      const newAction = await tx.actionItem.create({
        data: {
          tenantId,
          code,
          title: body.title || `Acción ${stakeholder.name} - ${stakeholder.complianceStatus}`,
          description: body.description || `Origen: Parte Interesada ${stakeholder.name}`,
          type: body.type || (stakeholder.complianceStatus === 'NON_COMPLIANT' ? 'CORRECTIVE' : 'IMPROVEMENT'),
          priority: body.priority || (stakeholder.complianceStatus === 'NON_COMPLIANT' ? 'HIGH' : 'MEDIUM'),
          status: body.status || 'OPEN',
          sourceType: 'STAKEHOLDER',
          sourceId: id,
          openDate: body.openDate ? new Date(body.openDate) : new Date(),
          dueDate: body.dueDate || new Date(Date.now() + 30 * 24 * 3600 * 1000),
        }
      });
      // Update stakeholder with action reference
      await tx.stakeholder.update({
        where: { id },
        data: { actionItemId: newAction.id }
      });
      return newAction;
    });

    return reply.send({ action });
  });

  app.post('/:id/create-nc', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { id } = z.object({ id: z.string() }).parse(req.params);

    const stakeholder = await app.runWithDbContext(req, async (tx: any) => {
      return tx.stakeholder.findFirst({ where: { id, tenantId, deletedAt: null } });
    });
    if (!stakeholder) return reply.code(404).send({ error: 'Parte interesada no encontrada' });

    const rawBody = req.body;
    const body = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody as any;

    const ncr = await app.runWithDbContext(req, async (tx: any) => {
      const year = new Date().getFullYear();
      const count = await tx.nonConformity.count({
        where: { tenantId, code: { startsWith: `NCR-${year}-` } }
      });
      const code = `NCR-${year}-${String(count + 1).padStart(3, '0')}`;

      return tx.nonConformity.create({
        data: {
          tenantId,
          code,
          title: body.title || `NC vinculada a Parte Interesada: ${stakeholder.name}`,
          description: body.description || `Origen: Parte Interesada\nNombre: ${stakeholder.name}\nTipo: ${stakeholder.type}\nCategoría: ${stakeholder.category}\nEstado de cumplimiento: ${stakeholder.complianceStatus || '—'}\nNivel: ${stakeholder.complianceLevel || '—'}%\nEvidencia: ${stakeholder.complianceEvidence || '—'}`,
          severity: body.severity || 'MAJOR',
          source: 'STAKEHOLDER',
          status: 'OPEN',
          standard: body.standard || null,
          clause: body.clause || null,
          dueDate: body.dueDate ? new Date(body.dueDate) : new Date(Date.now() + 30 * 24 * 3600 * 1000),
          stakeholderId: id,
          createdById: req.auth?.userId ?? null,
          updatedById: req.auth?.userId ?? null,
        },
        include: {
          assignedTo: { select: { id: true, email: true } },
          createdBy: { select: { id: true, email: true } },
        },
      });
    });

    return reply.code(201).send({ ncr });
  });
};
export const incidentsRoutes = makeCrud('incidents', { model: 'incident', codePrefix: 'INC' });
export const suppliersRoutes = makeCrud('suppliers', { model: 'supplier', codePrefix: 'PROV' });
export const equipmentRoutes = makeCrud('equipment', { model: 'measuringEquipment', codePrefix: 'EQ' });

// ══════════════════════════════════════════════════════════════
// SCORE ESTRATÉGICO — algoritmo determinista y EXTENSIBLE
// Cada peso es ajustable; sumar factores nuevos no rompe compatibilidad.
// ══════════════════════════════════════════════════════════════
const STRATEGIC_WEIGHTS = {
  identity: 10, // misión / visión / valores
  fodaComplete: 20, // los 4 cuadrantes con contenido
  fodaDepth: 10, // cantidad total de ítems FODA
  fodaBalance: 10, // positivos (F+O) vs negativos (D+A)
  pestel: 15, // cobertura de los 6 factores
  dafo: 20, // 4 estrategias cruzadas
  objectives: 15, // objetivos del año + logro
};

const _arr = (v: any): string[] => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()) : []);
const _filled = (s: any): boolean => typeof s === 'string' && s.trim().length > 0;

function computeContextScore(ctx: any, objs: any[]) {
  const s = _arr(ctx?.strengths), w = _arr(ctx?.weaknesses), o = _arr(ctx?.opportunities), t = _arr(ctx?.threats);
  const pestelKeys = ['political', 'economic', 'social', 'technological', 'environmental', 'legal'];
  const pestelFilled = pestelKeys.filter((k) => _filled(ctx?.[k])).length;
  const dafoKeys = ['dafoFo', 'dafoFa', 'dafoDo', 'dafoDa'];
  const dafoFilled = dafoKeys.filter((k) => _filled(ctx?.[k])).length;
  const identityFilled = ['mission', 'vision', 'values'].filter((k) => _filled(ctx?.[k])).length;

  const factors: any[] = [];
  let score = 0;
  const add = (key: string, label: string, points: number, max: number) => {
    score += points;
    factors.push({ key, label, points: Math.round(points), max });
  };

  add('identity', 'Identidad (misión/visión/valores)', (identityFilled / 3) * STRATEGIC_WEIGHTS.identity, STRATEGIC_WEIGHTS.identity);

  const quadrantsFilled = [s, w, o, t].filter((a) => a.length > 0).length;
  add('fodaComplete', 'FODA completo', (quadrantsFilled / 4) * STRATEGIC_WEIGHTS.fodaComplete, STRATEGIC_WEIGHTS.fodaComplete);

  const totalItems = s.length + w.length + o.length + t.length;
  add('fodaDepth', 'Profundidad del análisis', (Math.min(totalItems, 12) / 12) * STRATEGIC_WEIGHTS.fodaDepth, STRATEGIC_WEIGHTS.fodaDepth);

  const pos = s.length + o.length, neg = w.length + t.length;
  const balance = pos + neg === 0 ? 0 : pos / (pos + neg);
  add('fodaBalance', 'Balance FODA (positivos/negativos)', balance * STRATEGIC_WEIGHTS.fodaBalance, STRATEGIC_WEIGHTS.fodaBalance);

  add('pestel', 'Cobertura PESTEL', (pestelFilled / 6) * STRATEGIC_WEIGHTS.pestel, STRATEGIC_WEIGHTS.pestel);
  add('dafo', 'Estrategias DAFO cruzadas', (dafoFilled / 4) * STRATEGIC_WEIGHTS.dafo, STRATEGIC_WEIGHTS.dafo);

  const objTotal = objs.length;
  const objAchieved = objs.filter((x) => x.status === 'ACHIEVED').length;
  const presence = objTotal > 0 ? 1 : 0;
  const achievementRatio = objTotal > 0 ? objAchieved / objTotal : 0;
  add('objectives', 'Objetivos estratégicos', presence * (STRATEGIC_WEIGHTS.objectives * 0.4) + achievementRatio * (STRATEGIC_WEIGHTS.objectives * 0.6), STRATEGIC_WEIGHTS.objectives);

  return {
    score: Math.round(Math.max(0, Math.min(100, score))),
    factors,
    counts: { s: s.length, w: w.length, o: o.length, t: t.length, pestelFilled, dafoFilled, identityFilled, objTotal, objAchieved },
  };
}

function bandOf(score: number) {
  if (score >= 80) return { band: 'green', label: 'Contexto Adecuado', emoji: '🟢' };
  if (score >= 60) return { band: 'yellow', label: 'Requiere Atención', emoji: '🟡' };
  return { band: 'red', label: 'Contexto Crítico', emoji: '🔴' };
}

function computeOperationalHealth(live: any) {
  let health = 100;
  const detail: any[] = [];
  const ncPenalty = Math.min(live.openNCs * 5, 30);
  const riskPenalty = Math.min(live.highRisks * 4, 25);
  const actionPenalty = Math.min(Math.max(live.openActions - 3, 0) * 2, 15);
  const compPenalty = live.avgCompliance !== null ? Math.round(((100 - live.avgCompliance) / 100) * 20) : 0;
  health -= ncPenalty + riskPenalty + actionPenalty + compPenalty;
  detail.push({ key: 'nc', label: 'No conformidades abiertas', penalty: ncPenalty });
  detail.push({ key: 'risk', label: 'Riesgos altos abiertos', penalty: riskPenalty });
  detail.push({ key: 'actions', label: 'Acciones abiertas', penalty: actionPenalty });
  detail.push({ key: 'compliance', label: 'Cumplimiento partes interesadas', penalty: compPenalty });
  return { health: Math.max(0, Math.min(100, Math.round(health))), detail };
}

// findMany tolerante a modelos sin columna deletedAt
async function _safeFindMany(tx: any, model: string, where: any, select: any) {
  try {
    return await tx[model].findMany({ where, select });
  } catch {
    const { deletedAt, ...rest } = where || {};
    return await tx[model].findMany({ where: rest, select });
  }
}

// -------- CONTEXTO ORGANIZACIONAL (singleton por año) --------
export const contextRoutes: FastifyPluginAsync = async (app) => {
  // Dashboard estratégico: score IA-extensible, evolución histórica y métricas vivas.
  app.get('/strategic-dashboard', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const q = req.query as { year?: string };

    const raw = await app.runWithDbContext(req, async (tx: any) => {
      const contexts = await tx.organizationContext.findMany({ where: { tenantId }, orderBy: { year: 'asc' } });
      const objectives = await _safeFindMany(tx, 'sgiObjective', { tenantId, deletedAt: null }, { year: true, status: true });
      const [risks, actions, ncs, indicators, stakeholders] = await Promise.all([
        _safeFindMany(tx, 'risk', { tenantId, deletedAt: null }, { status: true, riskLevel: true, residualLevel: true }),
        _safeFindMany(tx, 'actionItem', { tenantId, deletedAt: null }, { status: true }),
        _safeFindMany(tx, 'nonConformity', { tenantId, deletedAt: null }, { status: true }),
        _safeFindMany(tx, 'indicator', { tenantId, deletedAt: null }, { status: true, currentValue: true, targetValue: true, direction: true }),
        _safeFindMany(tx, 'stakeholder', { tenantId, deletedAt: null }, { complianceLevel: true }),
      ]);
      return { contexts, objectives, risks, actions, ncs, indicators, stakeholders };
    });

    // ── Métricas vivas (estado actual) ──
    const openRisks = raw.risks.filter((r: any) => r.status !== 'CLOSED').length;
    const highRisks = raw.risks.filter((r: any) => r.status !== 'CLOSED' && (r.residualLevel ?? r.riskLevel ?? 0) >= 15).length;
    const openActions = raw.actions.filter((a: any) => ['OPEN', 'IN_PROGRESS', 'VERIFICATION'].includes(a.status)).length;
    const openNCs = raw.ncs.filter((n: any) => !['CLOSED', 'CANCELLED'].includes(n.status)).length;
    const indicatorsOnTarget = raw.indicators.filter((i: any) => {
      if (i.currentValue == null || i.targetValue == null) return false;
      return i.direction === 'LOWER_BETTER' ? i.currentValue <= i.targetValue : i.currentValue >= i.targetValue;
    }).length;
    const compLevels = raw.stakeholders.map((s: any) => s.complianceLevel).filter((v: any) => typeof v === 'number');
    const avgCompliance = compLevels.length ? Math.round(compLevels.reduce((a: number, b: number) => a + b, 0) / compLevels.length) : null;

    const live = {
      totalRisks: raw.risks.length, openRisks, highRisks,
      totalActions: raw.actions.length, openActions,
      totalNCs: raw.ncs.length, openNCs,
      indicatorsTotal: raw.indicators.length, indicatorsOnTarget,
      stakeholders: raw.stakeholders.length, avgCompliance,
    };

    // ── Evolución histórica (score por año, solo datos año-específicos) ──
    const history = raw.contexts.map((c: any) => {
      const objsY = raw.objectives.filter((o: any) => o.year === c.year);
      const cs = computeContextScore(c, objsY);
      return { year: c.year, score: cs.score, band: bandOf(cs.score).band, ...cs.counts };
    });

    // ── Año objetivo (query, o último con contexto, o año actual) ──
    const nowYear = new Date().getFullYear();
    const targetYear = q.year ? parseInt(q.year, 10) : (raw.contexts.length ? raw.contexts[raw.contexts.length - 1].year : nowYear);
    const ctx = raw.contexts.find((c: any) => c.year === targetYear) || null;
    const objsTarget = raw.objectives.filter((o: any) => o.year === targetYear);
    const cs = computeContextScore(ctx, objsTarget);
    const oh = computeOperationalHealth(live);
    const combined = Math.round(cs.score * 0.65 + oh.health * 0.35);
    const b = bandOf(combined);

    return reply.send({
      current: {
        year: targetYear,
        score: combined,
        contextScore: cs.score,
        operationalHealth: oh.health,
        band: b.band, bandLabel: b.label, bandEmoji: b.emoji,
        factors: cs.factors,
        healthDetail: oh.detail,
        counts: cs.counts,
        hasContext: !!ctx,
      },
      history,
      live,
      weights: STRATEGIC_WEIGHTS,
    });
  });

  // Revisión Estratégica con IA + detección automática de cambios respecto al año anterior.
  app.post('/strategic-review', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const body = (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body) as { year?: number };
    const nowYear = new Date().getFullYear();

    const raw = await app.runWithDbContext(req, async (tx: any) => {
      const contexts = await tx.organizationContext.findMany({ where: { tenantId }, orderBy: { year: 'asc' } });
      const objectives = await _safeFindMany(tx, 'sgiObjective', { tenantId, deletedAt: null }, { year: true, status: true, title: true });
      const [risks, actions, ncs, indicators, stakeholders] = await Promise.all([
        _safeFindMany(tx, 'risk', { tenantId, deletedAt: null }, { status: true, riskLevel: true, residualLevel: true, title: true, category: true }),
        _safeFindMany(tx, 'actionItem', { tenantId, deletedAt: null }, { status: true }),
        _safeFindMany(tx, 'nonConformity', { tenantId, deletedAt: null }, { status: true }),
        _safeFindMany(tx, 'indicator', { tenantId, deletedAt: null }, { status: true, currentValue: true, targetValue: true, direction: true }),
        _safeFindMany(tx, 'stakeholder', { tenantId, deletedAt: null }, { complianceLevel: true }),
      ]);
      return { contexts, objectives, risks, actions, ncs, indicators, stakeholders };
    });

    const targetYear = body?.year ? Number(body.year) : (raw.contexts.length ? raw.contexts[raw.contexts.length - 1].year : nowYear);
    const ctx = raw.contexts.find((c: any) => c.year === targetYear) || null;
    const prev = raw.contexts.filter((c: any) => c.year < targetYear).sort((a: any, b: any) => b.year - a.year)[0] || null;
    if (!ctx) return reply.code(404).send({ error: `No hay contexto cargado para el año ${targetYear}` });

    const openRisks = raw.risks.filter((r: any) => r.status !== 'CLOSED').length;
    const highRisks = raw.risks.filter((r: any) => r.status !== 'CLOSED' && (r.residualLevel ?? r.riskLevel ?? 0) >= 15).length;
    const openActions = raw.actions.filter((a: any) => ['OPEN', 'IN_PROGRESS', 'VERIFICATION'].includes(a.status)).length;
    const openNCs = raw.ncs.filter((n: any) => !['CLOSED', 'CANCELLED'].includes(n.status)).length;
    const compLevels = raw.stakeholders.map((s: any) => s.complianceLevel).filter((v: any) => typeof v === 'number');
    const avgCompliance = compLevels.length ? Math.round(compLevels.reduce((a: number, b: number) => a + b, 0) / compLevels.length) : null;
    const live = { totalRisks: raw.risks.length, openRisks, highRisks, openActions, openNCs, indicatorsTotal: raw.indicators.length, stakeholders: raw.stakeholders.length, avgCompliance };
    const objsY = raw.objectives.filter((o: any) => o.year === targetYear);
    const cs = computeContextScore(ctx, objsY);
    const oh = computeOperationalHealth(live);
    const combined = Math.round(cs.score * 0.65 + oh.health * 0.35);

    const fmt = (v: any) => (_arr(v).length ? _arr(v).map((x) => `- ${x}`).join('\n') : '(sin datos)');
    const pestelTxt = (['political', 'economic', 'social', 'technological', 'environmental', 'legal'] as const)
      .map((k) => (_filled((ctx as any)[k]) ? `${k}: ${(ctx as any)[k]}` : null)).filter(Boolean).join('\n') || '(sin datos)';

    const prompt = `Actuás como consultor senior en sistemas de gestión ISO 9001/14001/45001 e IATF 16949, especializado en empresas logísticas e industriales.
Generá una REVISIÓN ESTRATÉGICA EJECUTIVA del Contexto de la Organización para el año ${targetYear}.

=== DATOS DEL CONTEXTO ${targetYear} ===
Misión: ${ctx.mission || '(no definida)'}
Visión: ${ctx.vision || '(no definida)'}
Valores: ${ctx.values || '(no definidos)'}

FORTALEZAS:
${fmt(ctx.strengths)}
DEBILIDADES:
${fmt(ctx.weaknesses)}
OPORTUNIDADES:
${fmt(ctx.opportunities)}
AMENAZAS:
${fmt(ctx.threats)}

PESTEL:
${pestelTxt}

ESTRATEGIAS DAFO CRUZADO:
FO: ${ctx.dafoFo || '(vacío)'}
DO: ${ctx.dafoDo || '(vacío)'}
FA: ${ctx.dafoFa || '(vacío)'}
DA: ${ctx.dafoDa || '(vacío)'}

=== AÑO ANTERIOR (${prev ? prev.year : 'no disponible'}) para detección de cambios ===
${prev ? `Fortalezas: ${_arr(prev.strengths).join('; ') || '—'}
Debilidades: ${_arr(prev.weaknesses).join('; ') || '—'}
Oportunidades: ${_arr(prev.opportunities).join('; ') || '—'}
Amenazas: ${_arr(prev.threats).join('; ') || '—'}` : 'Sin contexto previo cargado.'}

=== INDICADORES DE GESTIÓN (estado actual) ===
Score estratégico: ${combined}% (contexto ${cs.score}% / operativo ${oh.health}%)
Objetivos ${targetYear}: ${objsY.length} (logrados: ${objsY.filter((o: any) => o.status === 'ACHIEVED').length})
Riesgos abiertos: ${openRisks} (altos: ${highRisks})
Acciones abiertas: ${openActions}
No conformidades abiertas: ${openNCs}
Indicadores: ${raw.indicators.length}
Partes interesadas: ${raw.stakeholders.length}${avgCompliance !== null ? ` (cumplimiento promedio ${avgCompliance}%)` : ''}

=== FORMATO DE SALIDA (Markdown, usá ## para cada sección) ===
## Resumen General
## Fortalezas principales
## Debilidades críticas
## Amenazas emergentes
## Oportunidades relevantes
## Cambios respecto al año anterior
## Riesgos sugeridos
## Objetivos sugeridos
## Indicadores sugeridos
## Proyectos recomendados
## Nivel de madurez estratégica
## Recomendaciones para la Dirección
## Prioridades inmediatas

Sé concreto, accionable y basá todo en los datos provistos. No inventes datos que no estén presentes. Redactá en español profesional para la Alta Dirección.`;

    try {
      const llm = createGroqOnlyLLMProvider((req as any).tenant, (app as any).prisma, tenantId, (req as any).auth?.userId ?? null, 'contexto-strategic-review');
      const aiRes = await llm.chat([{ role: 'user', content: prompt }], 2600);
      return reply.send({
        review: aiRes?.text || 'Sin respuesta del modelo',
        year: targetYear,
        prevYear: prev?.year ?? null,
        score: combined,
        metrics: live,
      });
    } catch (e: any) {
      return reply.code(e.statusCode ?? 500).send({ error: e?.message || 'Falló la revisión estratégica IA' });
    }
  });

  app.get('/:year', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { year } = req.params as { year: string };
    const y = parseInt(year, 10);

    const item = await app.runWithDbContext(req, async (tx: any) => {
      return tx.organizationContext.findUnique({ where: { tenantId_year: { tenantId, year: y } } });
    });
    return reply.send({ item });
  });

  app.put('/:year', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { year } = req.params as { year: string };
    const y = parseInt(year, 10);
    const rawBody = req.body;
    const body = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody as any;

    try {
      const item = await app.runWithDbContext(req, async (tx: any) => {
        const { id: _id, tenantId: _tid, year: _y, createdAt: _ca, updatedAt: _ua, createdById: _cb, deletedAt: _da, ...data } = body;

        return tx.organizationContext.upsert({
          where: { tenantId_year: { tenantId, year: y } },
          update: data,
          create: { tenantId, year: y, ...data },
        });
      });
      return reply.send({ item });
    } catch (err: any) {
      console.error('[CONTEXT_PUT] Error:', err?.message, err?.meta);
      return reply.code(500).send({ error: err?.message || 'Error guardando contexto' });
    }
  });

  // Fase 5 — Prioridad estratégica por ítem FODA (endpoint dedicado, aislado del guardado principal).
  app.put('/:year/priorities', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    const { year } = req.params as { year: string };
    const y = parseInt(year, 10);
    const body = (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body) as { fodaPriorities?: any };
    const fodaPriorities = body?.fodaPriorities ?? {};
    try {
      const item = await app.runWithDbContext(req, async (tx: any) => {
        return tx.organizationContext.upsert({
          where: { tenantId_year: { tenantId, year: y } },
          update: { fodaPriorities },
          create: { tenantId, year: y, fodaPriorities },
        });
      });
      return reply.send({ ok: true, fodaPriorities: item.fodaPriorities });
    } catch (err: any) {
      console.error('[CONTEXT_PRIORITIES] Error:', err?.message);
      return reply.code(500).send({ error: 'No se pudieron guardar las prioridades. Verificá que la migración fodaPriorities esté aplicada.' });
    }
  });
};

// -------- CALENDARIO AGREGADOR --------
export const calendarRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    const from = (req.query as any)?.from ? new Date((req.query as any).from) : new Date();
    const to = (req.query as any)?.to ? new Date((req.query as any).to) : new Date(Date.now() + 180 * 24 * 3600 * 1000);

    const events = await app.runWithDbContext(req, async (tx: any) => {
      const results: any[] = [];

      // Acciones con due date
      const actions = await tx.actionItem.findMany({
        where: { tenantId, deletedAt: null, dueDate: { gte: from, lte: to } },
        select: { id: true, code: true, title: true, dueDate: true, status: true },
      });
      actions.forEach((a: any) => results.push({
        id: `action-${a.id}`, source: 'Acciones', type: 'action',
        title: `${a.code} ${a.title}`, date: a.dueDate, status: a.status,
        link: `/acciones/${a.id}`,
      }));

      // NCRs con due date
      const ncrs = await tx.nonConformity.findMany({
        where: { tenantId, deletedAt: null, dueDate: { gte: from, lte: to } },
        select: { id: true, code: true, title: true, dueDate: true, status: true },
      });
      ncrs.forEach((n: any) => results.push({
        id: `ncr-${n.id}`, source: 'No Conformidades', type: 'ncr',
        title: `${n.code} ${n.title}`, date: n.dueDate, status: n.status,
        link: `/no-conformidades/${n.id}`,
      }));

      // Calibraciones próximas
      const equipment = await tx.measuringEquipment.findMany({
        where: { tenantId, deletedAt: null, nextCalibrationDate: { gte: from, lte: to } },
        select: { id: true, code: true, name: true, nextCalibrationDate: true },
      });
      equipment.forEach((e: any) => results.push({
        id: `equip-${e.id}`, source: 'Calibraciones', type: 'calibration',
        title: `${e.code} ${e.name}`, date: e.nextCalibrationDate, status: 'DUE',
        link: `/calibraciones`,
      }));

      // Evaluaciones de proveedores próximas
      const suppliers = await tx.supplier.findMany({
        where: { tenantId, deletedAt: null, nextEvaluationDate: { gte: from, lte: to } },
        select: { id: true, code: true, name: true, nextEvaluationDate: true },
      });
      suppliers.forEach((s: any) => results.push({
        id: `sup-${s.id}`, source: 'Proveedores', type: 'evaluation',
        title: `Evaluar ${s.name}`, date: s.nextEvaluationDate, status: 'DUE',
        link: `/proveedores`,
      }));

      return results;
    });

    events.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return reply.send({ events });
  });
};
