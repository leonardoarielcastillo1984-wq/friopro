/**
 * Rutas CRUD para los 9 módulos SGI profesionales agregados en Abr 2026.
 * Usa el mismo patrón que ncr.ts: runWithDbContext + soft delete + auto-code por año.
 */
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

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
}

function makeCrud(prefix: string, opts: CrudOptions): FastifyPluginAsync {
  return async (app) => {
    // LIST
    app.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
      if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });
      const tenantId = req.db.tenantId;
      const items = await app.runWithDbContext(req, async (tx: any) => {
        return tx[opts.model].findMany({
          where: { tenantId, deletedAt: null },
          orderBy: opts.listOrder ?? { createdAt: 'desc' },
        });
      });
      return reply.send({ items });
    });

    // CREATE
    app.post('/', async (req: FastifyRequest, reply: FastifyReply) => {
      if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });
      const tenantId = req.db.tenantId;
      const body = req.body as any;

      const item = await app.runWithDbContext(req, async (tx: any) => {
        const data: any = { ...body, tenantId };
        // strip undefined / empty strings that might break date fields
        Object.keys(data).forEach((k) => {
          if (data[k] === '' || data[k] === undefined) data[k] = null;
        });

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

        // Soft audit fields where schema supports it
        if ('createdById' in (await tx[opts.model].fields ?? {}) || true) {
          // fall back: try-catch on create
        }
        try {
          data.createdById = req.auth?.userId ?? null;
          data.updatedById = req.auth?.userId ?? null;
        } catch {}

        // Remove audit fields if model doesn't have them
        const itemKeys = new Set(Object.keys(data));
        // We don't know model fields dynamically, so Prisma will throw if invalid.
        // Safer: only keep audit fields for specific models.
        const MODELS_WITH_AUDIT = new Set(['actionItem']);
        if (!MODELS_WITH_AUDIT.has(opts.model)) {
          delete data.createdById;
          delete data.updatedById;
        }
        void itemKeys;

        return tx[opts.model].create({ data });
      });

      return reply.code(201).send({ item });
    });

    // GET by id
    app.get('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
      if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });
      const tenantId = req.db.tenantId;
      const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
      const item = await app.runWithDbContext(req, async (tx: any) => {
        return tx[opts.model].findFirst({ where: { id, tenantId, deletedAt: null } });
      });
      if (!item) return reply.code(404).send({ error: 'Not found' });
      return reply.send({ item });
    });

    // UPDATE
    app.patch('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
      if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });
      const tenantId = req.db.tenantId;
      const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
      const body = req.body as any;

      const item = await app.runWithDbContext(req, async (tx: any) => {
        const existing = await tx[opts.model].findFirst({ where: { id, tenantId, deletedAt: null } });
        if (!existing) throw new Error('Not found');

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

        const MODELS_WITH_AUDIT = new Set(['actionItem']);
        if (MODELS_WITH_AUDIT.has(opts.model)) {
          data.updatedById = req.auth?.userId ?? null;
        }

        return tx[opts.model].update({ where: { id }, data });
      });
      return reply.send({ item });
    });

    // DELETE (soft)
    app.delete('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
      if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });
      const tenantId = req.db.tenantId;
      const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

      const result = await app.runWithDbContext(req, async (tx: any) => {
        const existing = await tx[opts.model].findFirst({ where: { id, tenantId, deletedAt: null } });
        if (!existing) return { kind: 'not_found' as const };
        await tx[opts.model].update({ where: { id }, data: { deletedAt: new Date() } });
        return { kind: 'ok' as const };
      });
      if (result.kind === 'not_found') return reply.code(404).send({ error: 'Not found' });
      return reply.send({ success: true });
    });

    void prefix;
  };
}

export const actionsRoutes = makeCrud('actions', { model: 'actionItem', codePrefix: 'ACT' });
export const objectivesRoutes = makeCrud('objectives', { model: 'sgiObjective', codePrefix: 'OBJ' });
export const stakeholdersRoutes = makeCrud('stakeholders', { model: 'stakeholder' });
export const hazardsRoutes = makeCrud('hazards', { model: 'hazard', codePrefix: 'IPERC' });
export const aspectsRoutes = makeCrud('aspects', { model: 'environmentalAspect', codePrefix: 'AMB' });
export const incidentsRoutes = makeCrud('incidents', { model: 'incident', codePrefix: 'INC' });
export const suppliersRoutes = makeCrud('suppliers', { model: 'supplier', codePrefix: 'PROV' });
export const equipmentRoutes = makeCrud('equipment', { model: 'measuringEquipment', codePrefix: 'EQ' });

// -------- CONTEXTO ORGANIZACIONAL (singleton por año) --------
export const contextRoutes: FastifyPluginAsync = async (app) => {
  app.get('/:year', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });
    const { year } = z.object({ year: z.string() }).parse(req.params);
    const y = parseInt(year, 10);
    const tenantId = req.db.tenantId;

    const item = await app.runWithDbContext(req, async (tx: any) => {
      return tx.organizationContext.findUnique({ where: { tenantId_year: { tenantId, year: y } } });
    });
    return reply.send({ item });
  });

  app.put('/:year', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });
    const { year } = z.object({ year: z.string() }).parse(req.params);
    const y = parseInt(year, 10);
    const tenantId = req.db.tenantId;
    const rawBody = req.body;
    const body = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody as any;

    const item = await app.runWithDbContext(req, async (tx: any) => {
      const { id: _id, tenantId: _tid, year: _y, createdAt: _ca, updatedAt: _ua, ...data } = body;

      return tx.organizationContext.upsert({
        where: { tenantId_year: { tenantId, year: y } },
        update: data,
        create: { tenantId, year: y, ...data },
      });
    });
    return reply.send({ item });
  });
};

// -------- CALENDARIO AGREGADOR --------
export const calendarRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });
    const tenantId = req.db.tenantId;

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
