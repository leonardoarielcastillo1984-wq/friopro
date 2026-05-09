import { isSuperAdmin, getEffectiveTenantId } from '../utils/tenant-bypass.js';
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

// -------- CONTEXTO ORGANIZACIONAL (singleton por año) --------
export const contextRoutes: FastifyPluginAsync = async (app) => {
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
