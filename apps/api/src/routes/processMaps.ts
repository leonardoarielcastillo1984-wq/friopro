import { isSuperAdmin, getEffectiveTenantId } from '../utils/tenant-bypass.js';
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { listBaseTemplates, getBaseTemplate, SGI360_TEMPLATE_TYPE, SGI360_TEMPLATE_VERSION } from '../data/baseProcessMaps.js';
import { logAuditEvent } from '../services/audit.js';

const mapSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  scope: z.string().optional(),
  inputLabel: z.string().optional(),
  outputLabel: z.string().optional(),
});

const emptyToUndefined = <T extends z.ZodTypeAny>(schema: T) => z.preprocess((val) => (val === '' || val === null ? undefined : val), schema);

const activitySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().default(''),
  responsible: z.string().optional().default(''),
});

const processSchema = z.object({
  parentId: emptyToUndefined(z.string().uuid().optional().nullable()),
  layer: z.enum(['STRATEGIC', 'OPERATIONAL', 'SUPPORT']),
  name: z.string().min(1),
  code: emptyToUndefined(z.string().optional()),
  status: z.enum(['active', 'inactive']).optional().default('active'),
  description: emptyToUndefined(z.string().optional()),
  owner: emptyToUndefined(z.string().optional()),
  inputs: emptyToUndefined(z.string().optional()),
  outputs: emptyToUndefined(z.string().optional()),
  sites: z.array(z.string()).optional().default([]),
  departmentId: emptyToUndefined(z.string().uuid().optional().nullable()),
  indicators: emptyToUndefined(z.string().optional()),
  documents: emptyToUndefined(z.string().optional()),
  risks: emptyToUndefined(z.string().optional()),
  order: z.number().int().optional(),
  // Enfoque por procesos (Jul 2026)
  objective: emptyToUndefined(z.string().optional()),
  observations: emptyToUndefined(z.string().optional()),
  clientsInternal: z.array(z.string()).optional(),
  suppliersInternal: z.array(z.string()).optional(),
  receivesFrom: z.array(z.string()).optional(),
  deliversTo: z.array(z.string()).optional(),
  activities: z.array(activitySchema).optional(),
  // Sincronización de relaciones (se procesan aparte, no van en process.update/create)
  indicatorIds: z.array(z.string().uuid()).optional(),
  documentIds: z.array(z.string().uuid()).optional(),
  riskIds: z.array(z.string().uuid()).optional(),
});

// Separa los campos escalares del proceso de los arrays de relaciones a sincronizar.
function splitProcessBody(body: any) {
  const { indicatorIds, documentIds, riskIds, ...scalars } = body;
  return { scalars, indicatorIds, documentIds, riskIds };
}

// Sincroniza las relaciones (indicadores/documentos/riesgos) de un proceso dentro de una tx.
async function syncProcessRelations(tx: any, processId: string, rels: { indicatorIds?: string[]; documentIds?: string[]; riskIds?: string[] }) {
  if (rels.indicatorIds) {
    await tx.processIndicator.deleteMany({ where: { processId } });
    if (rels.indicatorIds.length) await tx.processIndicator.createMany({ data: rels.indicatorIds.map((indicatorId) => ({ processId, indicatorId })), skipDuplicates: true });
  }
  if (rels.documentIds) {
    await tx.processDocument.deleteMany({ where: { processId } });
    if (rels.documentIds.length) await tx.processDocument.createMany({ data: rels.documentIds.map((documentId) => ({ processId, documentId })), skipDuplicates: true });
  }
  if (rels.riskIds) {
    await tx.processRisk.deleteMany({ where: { processId } });
    if (rels.riskIds.length) await tx.processRisk.createMany({ data: rels.riskIds.map((riskId) => ({ processId, riskId })), skipDuplicates: true });
  }
}

const processInclude = {
  processIndicators: true,
  processDocuments: true,
  processRisks: true,
} as const;

// ── Import / Export de plantillas .sgi360.json ──────────────────
const templateActivitySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().default(''),
  responsible: z.string().optional().default(''),
});

// Acepta tanto strings ("Doc A") como objetos ({ name: "Doc A" }) y los normaliza a string.
const nameOrString = z.preprocess(
  (v) => (v && typeof v === 'object' && !Array.isArray(v) && 'name' in (v as any) ? (v as any).name : v),
  z.string(),
);

const templateProcessSchema = z.object({
  ref: z.string().min(1),
  parentRef: z.string().nullable().optional(),
  layer: z.enum(['STRATEGIC', 'OPERATIONAL', 'SUPPORT']),
  name: z.string().min(1),
  code: z.string().nullable().optional(),
  status: z.enum(['active', 'inactive']).optional().default('active'),
  description: z.string().nullable().optional(),
  owner: z.string().nullable().optional(),
  inputs: z.string().nullable().optional(),
  outputs: z.string().nullable().optional(),
  sites: z.array(z.string()).optional().default([]),
  order: z.number().int().optional(),
  objective: z.string().nullable().optional(),
  observations: z.string().nullable().optional(),
  clientsInternalRefs: z.array(z.string()).optional().default([]),
  suppliersInternalRefs: z.array(z.string()).optional().default([]),
  receivesFromRefs: z.array(z.string()).optional().default([]),
  deliversToRefs: z.array(z.string()).optional().default([]),
  activities: z.array(templateActivitySchema).optional().default([]),
  documents: z.array(nameOrString).optional().default([]),
  risks: z.array(nameOrString).optional().default([]),
  indicators: z.array(nameOrString).optional().default([]),
});

const templateSchema = z.object({
  sgi360: z.object({ type: z.string(), version: z.number(), app: z.string().optional(), exportedAt: z.string().optional() }).optional(),
  map: z.object({
    name: z.string().min(1),
    description: z.string().nullable().optional(),
    scope: z.string().nullable().optional(),
    inputLabel: z.string().nullable().optional(),
    outputLabel: z.string().nullable().optional(),
  }),
  processes: z.array(templateProcessSchema),
});

type ParsedTemplate = z.infer<typeof templateSchema>;

// Tolera que la plantilla venga como string JSON (bundles viejos que no parseaban el archivo).
function coerceTemplate(input: any): any {
  if (typeof input === 'string') {
    try { return JSON.parse(input); } catch { return input; }
  }
  return input;
}

// Resumen de conteos para la vista previa de importación.
function summarizeTemplate(t: ParsedTemplate) {
  const macro = t.processes.filter((p) => !p.parentRef).length;
  const sub = t.processes.filter((p) => !!p.parentRef).length;
  const uniq = (arr: string[]) => new Set(arr.map((s) => s.trim().toLowerCase()).filter(Boolean)).size;
  const docs = uniq(t.processes.flatMap((p) => p.documents ?? []));
  const risks = uniq(t.processes.flatMap((p) => p.risks ?? []));
  const indicators = uniq(t.processes.flatMap((p) => p.indicators ?? []));
  const activities = t.processes.reduce((acc, p) => acc + (p.activities?.length ?? 0), 0);
  return { maps: 1, macroprocesos: macro, subprocesos: sub, procesos: t.processes.length, documentos: docs, riesgos: risks, indicadores: indicators, actividades: activities };
}

export const processMapsRoutes: FastifyPluginAsync = async (app) => {
  // ── GET /process-maps ──────────────────────────────────────────
  app.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    const maps = await app.runWithDbContext(req, async (tx: any) => {
      return tx.processMap.findMany({
        where: { tenantId, deletedAt: null },
        include: {
          processes: { where: { deletedAt: null }, orderBy: [{ order: 'asc' }, { layer: 'asc' }], include: processInclude },
        },
        orderBy: { createdAt: 'asc' },
      });
    });
    return reply.send(maps);
  });

  // ── GET /process-maps/base-templates — Catálogo de plantillas base ──
  app.get('/base-templates', async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ templates: listBaseTemplates() });
  });

  // ── GET /process-maps/base-templates/:key — Descargar una plantilla base ──
  app.get('/base-templates/:key', async (req: FastifyRequest<{ Params: { key: string } }>, reply: FastifyReply) => {
    const tpl = getBaseTemplate(req.params.key);
    if (!tpl) return reply.code(404).send({ error: 'Plantilla base no encontrada' });
    return reply.send(tpl);
  });

  // ── GET /process-maps/:id/export — Exportar un mapa completo como plantilla .sgi360.json ──
  app.get('/:id/export', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    const result = await app.runWithDbContext(req, async (tx: any) => {
      const map = await tx.processMap.findFirst({
        where: { id: req.params.id, deletedAt: null },
        include: { processes: { where: { deletedAt: null }, orderBy: [{ order: 'asc' }], include: processInclude } },
      });
      if (!map) return null;

      const docIds = new Set<string>(); const riskIds = new Set<string>(); const indIds = new Set<string>();
      for (const p of map.processes) {
        for (const pd of p.processDocuments) docIds.add(pd.documentId);
        for (const pr of p.processRisks) riskIds.add(pr.riskId);
        for (const pi of p.processIndicators) indIds.add(pi.indicatorId);
      }
      const [docs, risks, inds] = await Promise.all([
        docIds.size ? tx.document.findMany({ where: { id: { in: [...docIds] } }, select: { id: true, title: true } }) : [],
        riskIds.size ? tx.risk.findMany({ where: { id: { in: [...riskIds] } }, select: { id: true, title: true } }) : [],
        indIds.size ? tx.indicator.findMany({ where: { id: { in: [...indIds] } }, select: { id: true, name: true } }) : [],
      ]);
      const docName = new Map<string, string>(docs.map((d: any) => [d.id, d.title]));
      const riskName = new Map<string, string>(risks.map((r: any) => [r.id, r.title]));
      const indName = new Map<string, string>(inds.map((i: any) => [i.id, i.name]));

      const refById = new Map<string, string>();
      map.processes.forEach((p: any, i: number) => refById.set(p.id, `p${i}`));
      const mapRefs = (ids?: string[]) => (ids ?? []).map((x) => refById.get(x)).filter(Boolean);

      const processes = map.processes.map((p: any, i: number) => ({
        ref: refById.get(p.id),
        parentRef: p.parentId ? (refById.get(p.parentId) ?? null) : null,
        layer: p.layer, name: p.name, code: p.code ?? null, status: p.status,
        description: p.description ?? null, owner: p.owner ?? null, inputs: p.inputs ?? null, outputs: p.outputs ?? null,
        sites: p.sites ?? [], order: p.order ?? i, objective: p.objective ?? null, observations: p.observations ?? null,
        clientsInternalRefs: mapRefs(p.clientsInternal), suppliersInternalRefs: mapRefs(p.suppliersInternal),
        receivesFromRefs: mapRefs(p.receivesFrom), deliversToRefs: mapRefs(p.deliversTo),
        activities: Array.isArray(p.activities) ? p.activities : [],
        documents: p.processDocuments.map((pd: any) => docName.get(pd.documentId)).filter(Boolean),
        risks: p.processRisks.map((pr: any) => riskName.get(pr.riskId)).filter(Boolean),
        indicators: p.processIndicators.map((pi: any) => indName.get(pi.indicatorId)).filter(Boolean),
      }));

      return {
        sgi360: { type: SGI360_TEMPLATE_TYPE, version: SGI360_TEMPLATE_VERSION, app: 'SGI360', exportedAt: new Date().toISOString() },
        map: { name: map.name, description: map.description ?? undefined, scope: map.scope ?? undefined, inputLabel: map.inputLabel ?? undefined, outputLabel: map.outputLabel ?? undefined },
        processes,
      };
    });

    if (!result) return reply.code(404).send({ error: 'Mapa no encontrado' });
    return reply.send(result);
  });

  // ── POST /process-maps/import/analyze — Validar estructura y devolver resumen ──
  app.post('/import/analyze', async (req: FastifyRequest, reply: FastifyReply) => {
    // El body puede llegar como string (cuando el cliente no envía Content-Type: application/json).
    const rawBody = coerceTemplate(req.body);
    const payload = coerceTemplate(rawBody?.template ?? rawBody);
    const parsed = templateSchema.safeParse(payload);
    if (!parsed.success) {
      return reply.code(400).send({ valid: false, error: 'El archivo no tiene una estructura .sgi360.json válida.', details: parsed.error.issues.slice(0, 10) });
    }
    const t = parsed.data;
    const refs = new Set(t.processes.map((p) => p.ref));
    const warnings: string[] = [];
    if (payload?.sgi360?.type && payload.sgi360.type !== SGI360_TEMPLATE_TYPE) warnings.push('El tipo declarado en el archivo no es un mapa de procesos SGI360.');
    for (const p of t.processes) {
      if (p.parentRef && !refs.has(p.parentRef)) warnings.push(`El proceso "${p.name}" referencia un macroproceso padre inexistente.`);
    }
    return reply.send({ valid: true, map: { name: t.map.name, description: t.map.description ?? '' }, summary: summarizeTemplate(t), warnings });
  });

  // ── POST /process-maps/import — Importar plantilla (new | merge | replace) ──
  app.post('/import', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    const bodySchema = z.object({
      template: z.preprocess(coerceTemplate, templateSchema),
      mode: z.enum(['new', 'merge', 'replace']),
      targetMapId: z.string().uuid().optional().nullable(),
      duplicatePolicy: z.enum(['skip', 'update', 'duplicate']).optional().default('skip'),
    });
    // El body puede llegar como string (cuando el cliente no envía Content-Type: application/json).
    const body = bodySchema.parse(coerceTemplate(req.body));
    if ((body.mode === 'merge' || body.mode === 'replace') && !body.targetMapId) {
      return reply.code(400).send({ error: 'Se requiere un mapa destino para fusionar o reemplazar.' });
    }
    const t = body.template;

    const outcome = await app.runWithDbContext(req, async (tx: any) => {
      // 1. Mapa destino
      let map: any;
      const mapData = { name: t.map.name, description: t.map.description ?? null, scope: t.map.scope ?? null, inputLabel: t.map.inputLabel ?? undefined, outputLabel: t.map.outputLabel ?? undefined };
      if (body.mode === 'new') {
        map = await tx.processMap.create({ data: { ...mapData, tenantId, createdById: req.auth?.userId ?? null } });
      } else {
        map = await tx.processMap.findFirst({ where: { id: body.targetMapId!, deletedAt: null } });
        if (!map) return { error: 'Mapa destino no encontrado' };
        if (body.mode === 'replace') {
          await tx.processMap.update({ where: { id: map.id }, data: mapData });
          const existing = await tx.process.findMany({ where: { processMapId: map.id, deletedAt: null }, select: { id: true } });
          const ids = existing.map((e: any) => e.id);
          if (ids.length) {
            await tx.processDocument.deleteMany({ where: { processId: { in: ids } } });
            await tx.processIndicator.deleteMany({ where: { processId: { in: ids } } });
            await tx.processRisk.deleteMany({ where: { processId: { in: ids } } });
            await tx.process.updateMany({ where: { id: { in: ids } }, data: { deletedAt: new Date() } });
          }
        }
      }

      // 2. Lookups por nombre para revincular documentos / riesgos / indicadores existentes.
      const [allDocs, allRisks, allInds] = await Promise.all([
        tx.document.findMany({ where: { deletedAt: null }, select: { id: true, title: true } }),
        tx.risk.findMany({ select: { id: true, title: true } }),
        tx.indicator.findMany({ select: { id: true, name: true } }),
      ]);
      const docByName = new Map<string, string>(allDocs.map((d: any) => [String(d.title).trim().toLowerCase(), d.id]));
      const riskByName = new Map<string, string>(allRisks.map((r: any) => [String(r.title).trim().toLowerCase(), r.id]));
      const indByName = new Map<string, string>(allInds.map((i: any) => [String(i.name).trim().toLowerCase(), i.id]));

      // 3. Códigos ya usados (evita violar unique [tenantId, code]).
      const usedRows = await tx.process.findMany({ where: { tenantId, code: { not: null }, deletedAt: null }, select: { code: true } });
      const usedCodes = new Set<string>(usedRows.map((r: any) => r.code).filter(Boolean));

      // 4. Procesos existentes del mapa (solo para merge / duplicados).
      const existingActive = body.mode === 'merge'
        ? await tx.process.findMany({ where: { processMapId: map.id, deletedAt: null }, select: { id: true, name: true, parentId: true } })
        : [];
      const nameKey = (name: string, parentId: string | null) => `${parentId ?? ''}::${name.trim().toLowerCase()}`;
      const existingByKey = new Map<string, string>();
      for (const e of existingActive) existingByKey.set(nameKey(e.name, e.parentId), e.id);

      const refToId = new Map<string, string>();
      const touched = new Set<string>();
      let created = 0, updated = 0, skipped = 0;

      const buildData = (p: any, parentId: string | null) => {
        let code = p.code ?? null;
        if (code && usedCodes.has(code)) code = null;
        if (code) usedCodes.add(code);
        return {
          tenantId, processMapId: map.id, parentId,
          layer: p.layer, name: p.name, code, status: p.status ?? 'active',
          description: p.description ?? null, owner: p.owner ?? null,
          inputs: p.inputs ?? null, outputs: p.outputs ?? null, sites: p.sites ?? [],
          order: p.order ?? 0, objective: p.objective ?? null, observations: p.observations ?? null,
          activities: p.activities ?? [],
        };
      };

      const linkRelations = async (processId: string, p: any) => {
        const dIds = (p.documents ?? []).map((n: string) => docByName.get(n.trim().toLowerCase())).filter(Boolean);
        const rIds = (p.risks ?? []).map((n: string) => riskByName.get(n.trim().toLowerCase())).filter(Boolean);
        const iIds = (p.indicators ?? []).map((n: string) => indByName.get(n.trim().toLowerCase())).filter(Boolean);
        if (dIds.length) await tx.processDocument.createMany({ data: dIds.map((documentId: string) => ({ processId, documentId })), skipDuplicates: true });
        if (rIds.length) await tx.processRisk.createMany({ data: rIds.map((riskId: string) => ({ processId, riskId })), skipDuplicates: true });
        if (iIds.length) await tx.processIndicator.createMany({ data: iIds.map((indicatorId: string) => ({ processId, indicatorId })), skipDuplicates: true });
      };

      // Dos pasadas: primero macroprocesos, luego subprocesos (para resolver parentId).
      const passes = [t.processes.filter((p) => !p.parentRef), t.processes.filter((p) => !!p.parentRef)];
      for (let pass = 0; pass < 2; pass++) {
        for (const orig of passes[pass]) {
          let tp: any = orig;
          const parentId = tp.parentRef ? (refToId.get(tp.parentRef) ?? null) : null;
          if (tp.parentRef && !parentId) { skipped++; continue; }
          if (body.mode === 'merge') {
            const existId = existingByKey.get(nameKey(tp.name, parentId));
            if (existId) {
              if (body.duplicatePolicy === 'skip') { refToId.set(tp.ref, existId); skipped++; continue; }
              if (body.duplicatePolicy === 'update') {
                const data = buildData(tp, parentId); delete (data as any).code;
                await tx.process.update({ where: { id: existId }, data });
                await linkRelations(existId, tp);
                refToId.set(tp.ref, existId); touched.add(existId); updated++; continue;
              }
              tp = { ...tp, name: `${tp.name} (copia)` };
            }
          }
          const proc = await tx.process.create({ data: buildData(tp, parentId) });
          refToId.set(tp.ref, proc.id); touched.add(proc.id); created++;
          await linkRelations(proc.id, tp);
        }
      }

      // 5. Interacciones: remapear refs → ids (solo en procesos tocados).
      const mapRefs = (refs?: string[]) => (refs ?? []).map((r) => refToId.get(r)).filter(Boolean) as string[];
      for (const p of t.processes) {
        const pid = refToId.get(p.ref);
        if (!pid || !touched.has(pid)) continue;
        await tx.process.update({ where: { id: pid }, data: {
          clientsInternal: mapRefs(p.clientsInternalRefs),
          suppliersInternal: mapRefs(p.suppliersInternalRefs),
          receivesFrom: mapRefs(p.receivesFromRefs),
          deliversTo: mapRefs(p.deliversToRefs),
        } });
      }

      return { mapId: map.id, mapName: map.name, mode: body.mode, created, updated, skipped };
    });

    if ((outcome as any)?.error) return reply.code(404).send({ error: (outcome as any).error });

    // Auditoría (no debe romper la operación).
    try {
      if (req.auth?.userId) {
        await logAuditEvent({
          tenantId,
          entityType: 'ProcessMap',
          entityId: (outcome as any).mapId,
          action: body.mode === 'merge' ? 'UPDATE' : 'CREATE',
          userId: req.auth.userId,
          description: `Importación de plantilla (${body.mode}) en "${(outcome as any).mapName}": ${(outcome as any).created} creados, ${(outcome as any).updated} actualizados, ${(outcome as any).skipped} omitidos.`,
        });
      }
    } catch { /* auditoría opcional */ }

    return reply.send({ ok: true, ...(outcome as any) });
  });

  // ── POST /process-maps ─────────────────────────────────────────
  app.post('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    const body = mapSchema.parse(req.body);
    const map = await app.runWithDbContext(req, async (tx: any) => {
      return tx.processMap.create({
        data: { ...body, tenantId, createdById: req.auth?.userId ?? null },
        include: { processes: true },
      });
    });
    return reply.code(201).send(map);
  });

  // ── PUT /process-maps/:id ──────────────────────────────────────
  app.put('/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    const body = mapSchema.partial().parse(req.body);
    const map = await app.runWithDbContext(req, async (tx: any) => {
      return tx.processMap.update({
        where: { id: req.params.id },
        data: body,
        include: { processes: { where: { deletedAt: null }, orderBy: [{ layer: 'asc' }, { order: 'asc' }] } },
      });
    });

    // Sincronizar screenName de la salida documental si el mapa fue renombrado
    if (body.name) {
      try {
        const screenName = `Mapa de Procesos — ${body.name}`;
        await (app.prisma as any).documentOutputDefinition.updateMany({
          where: { tenantId, entityRef: req.params.id, deletedAt: null },
          data: { screenName },
        });
      } catch { /* no crítico */ }
    }

    return reply.send(map);
  });

  // ── DELETE /process-maps/:id ───────────────────────────────────
  app.delete('/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    // Verificar si el mapa tiene salida documental o asociaciones normativas
    const output = await (app.prisma as any).documentOutputDefinition.findFirst({
      where: { tenantId, entityRef: req.params.id, deletedAt: null },
      include: { document: { select: { id: true } } },
    });
    let hasMappings = false;
    if (output?.documentId) {
      const count = await (app.prisma as any).documentClauseMapping.count({
        where: { documentId: output.documentId, deletedAt: null },
      });
      hasMappings = count > 0;
    }

    await app.runWithDbContext(req, async (tx: any) => {
      return tx.processMap.update({ where: { id: req.params.id }, data: { deletedAt: new Date() } });
    });

    // Marcar la salida documental como OBSOLETE (no eliminarla, conservar trazabilidad)
    if (output) {
      try {
        await (app.prisma as any).documentOutputDefinition.update({
          where: { id: output.id },
          data: { status: 'OBSOLETE', active: false },
        });
      } catch { /* no crítico */ }
    }

    return reply.code(204).header('X-Has-Document-Output', output ? 'true' : 'false').header('X-Has-Normative-Mappings', hasMappings ? 'true' : 'false').send();
  });

  // ── POST /process-maps/:id/processes ──────────────────────────
  app.post('/:id/processes', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    let body;
    try {
      body = processSchema.parse(req.body);
    } catch (e: any) {
      console.error('[processMaps POST processes] Zod validation error:', e.errors || e.message, 'Body keys:', Object.keys(req.body || {}));
      return reply.code(400).send({ error: 'Validación fallida', details: e.errors || e.message });
    }
    const { scalars, indicatorIds, documentIds, riskIds } = splitProcessBody(body);
    const process = await app.runWithDbContext(req, async (tx: any) => {
      const created = await tx.process.create({ data: { ...scalars, tenantId, processMapId: req.params.id } });
      await syncProcessRelations(tx, created.id, { indicatorIds, documentIds, riskIds });
      return tx.process.findUnique({ where: { id: created.id }, include: processInclude });
    });
    return reply.code(201).send(process);
  });

  // ── PUT /process-maps/:id/processes/reorder ─────────────────────
  // Reordena subprocesos: recibe la lista de IDs en el orden deseado.
  app.put('/:id/processes/reorder', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { ids } = z.object({ ids: z.array(z.string().uuid()) }).parse(req.body);
    await app.runWithDbContext(req, async (tx: any) => {
      for (let i = 0; i < ids.length; i++) {
        await tx.process.update({ where: { id: ids[i] }, data: { order: i } });
      }
    });
    return reply.code(204).send();
  });

  // ── PATCH /process-maps/:id/processes/:pid ──────────────────────
  app.patch('/:id/processes/:pid', async (req: FastifyRequest<{ Params: { id: string; pid: string } }>, reply: FastifyReply) => {
    const body = processSchema.partial().parse(req.body);
    const { scalars, indicatorIds, documentIds, riskIds } = splitProcessBody(body);
    const process = await app.runWithDbContext(req, async (tx: any) => {
      await tx.process.update({ where: { id: req.params.pid }, data: scalars });
      await syncProcessRelations(tx, req.params.pid, { indicatorIds, documentIds, riskIds });
      return tx.process.findUnique({ where: { id: req.params.pid }, include: processInclude });
    });
    return reply.send(process);
  });

  // ── DELETE /process-maps/:id/processes/:pid ───────────────────
  app.delete('/:id/processes/:pid', async (req: FastifyRequest<{ Params: { id: string; pid: string } }>, reply: FastifyReply) => {
    await app.runWithDbContext(req, async (tx: any) => {
      const now = new Date();
      // Al eliminar un macroproceso, también se marcan como eliminados sus subprocesos (evita huérfanos).
      await tx.process.updateMany({ where: { parentId: req.params.pid, deletedAt: null }, data: { deletedAt: now } });
      return tx.process.update({ where: { id: req.params.pid }, data: { deletedAt: now } });
    });
    return reply.code(204).send();
  });

  // ── Relaciones: Indicadores ────────────────────────────────────
  app.post('/:id/processes/:pid/indicators', async (req: FastifyRequest<{ Params: { id: string; pid: string } }>, reply: FastifyReply) => {
    const { indicatorId } = z.object({ indicatorId: z.string().uuid() }).parse(req.body);
    const rel = await app.runWithDbContext(req, async (tx: any) => {
      return tx.processIndicator.create({ data: { processId: req.params.pid, indicatorId } });
    });
    return reply.code(201).send(rel);
  });

  app.delete('/:id/processes/:pid/indicators/:rid', async (req: FastifyRequest<{ Params: { id: string; pid: string; rid: string } }>, reply: FastifyReply) => {
    await app.runWithDbContext(req, async (tx: any) => {
      return tx.processIndicator.delete({ where: { id: req.params.rid } });
    });
    return reply.code(204).send();
  });

  // ── Relaciones: Documentos ─────────────────────────────────────
  app.post('/:id/processes/:pid/documents', async (req: FastifyRequest<{ Params: { id: string; pid: string } }>, reply: FastifyReply) => {
    const { documentId } = z.object({ documentId: z.string().uuid() }).parse(req.body);
    const rel = await app.runWithDbContext(req, async (tx: any) => {
      return tx.processDocument.create({ data: { processId: req.params.pid, documentId } });
    });
    return reply.code(201).send(rel);
  });

  app.delete('/:id/processes/:pid/documents/:rid', async (req: FastifyRequest<{ Params: { id: string; pid: string; rid: string } }>, reply: FastifyReply) => {
    await app.runWithDbContext(req, async (tx: any) => {
      return tx.processDocument.delete({ where: { id: req.params.rid } });
    });
    return reply.code(204).send();
  });

  // ── Relaciones: Riesgos ────────────────────────────────────────
  app.post('/:id/processes/:pid/risks', async (req: FastifyRequest<{ Params: { id: string; pid: string } }>, reply: FastifyReply) => {
    const { riskId } = z.object({ riskId: z.string().uuid() }).parse(req.body);
    const rel = await app.runWithDbContext(req, async (tx: any) => {
      return tx.processRisk.create({ data: { processId: req.params.pid, riskId } });
    });
    return reply.code(201).send(rel);
  });

  app.delete('/:id/processes/:pid/risks/:rid', async (req: FastifyRequest<{ Params: { id: string; pid: string; rid: string } }>, reply: FastifyReply) => {
    await app.runWithDbContext(req, async (tx: any) => {
      return tx.processRisk.delete({ where: { id: req.params.rid } });
    });
    return reply.code(204).send();
  });

  // ── POST /:id/sync-risks — Vincula automáticamente riesgos, documentos e indicadores ──
  // Los módulos de Riesgos, Documentos e Indicadores guardan el "Departamento/Proceso"
  // como texto libre (Risk.process / Document.process / Indicator.process), independiente
  // de las relaciones reales (ProcessRisk / ProcessDocument / ProcessIndicator) que usan
  // las tarjetas del mapa. Este endpoint crea esas relaciones cuando el nombre coincide
  // (case-insensitive), para que lo ya cargado aparezca en el mapa sin vincularlo a mano.
  app.post('/:id/sync-risks', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    const result = await app.runWithDbContext(req, async (tx: any) => {
      const processes = await tx.process.findMany({
        where: { processMapId: req.params.id, tenantId, deletedAt: null },
        select: { id: true, name: true },
      });
      const norm = (s: string) => s.trim().toLowerCase();
      const processByName = new Map<string, string>();
      for (const p of processes) processByName.set(norm(p.name), p.id);
      const processIds = processes.map((p: any) => p.id);

      // Sincroniza una entidad (risk | document | indicator) contra sus procesos vinculados.
      async function syncEntity(entityModel: string, linkModel: string, entityIdField: string, titleField: string) {
        const items = await tx[entityModel].findMany({
          where: { tenantId, deletedAt: null, process: { not: null } },
          select: { id: true, [titleField]: true, process: true },
        });
        const existingLinks = await tx[linkModel].findMany({
          where: { processId: { in: processIds } },
          select: { processId: true, [entityIdField]: true },
        });
        const alreadyLinked = new Set(existingLinks.map((l: any) => `${l.processId}::${l[entityIdField]}`));

        const toCreate: any[] = [];
        const unmatched: { title: string; process: string }[] = [];
        for (const item of items) {
          if (!item.process) continue;
          const processId = processByName.get(norm(item.process));
          if (!processId) { unmatched.push({ title: item[titleField], process: item.process }); continue; }
          if (alreadyLinked.has(`${processId}::${item.id}`)) continue;
          toCreate.push({ processId, [entityIdField]: item.id });
        }
        if (toCreate.length) await tx[linkModel].createMany({ data: toCreate, skipDuplicates: true });
        return { linked: toCreate.length, unmatched };
      }

      const risks = await syncEntity('risk', 'processRisk', 'riskId', 'title');
      const documents = await syncEntity('document', 'processDocument', 'documentId', 'title');
      const indicators = await syncEntity('indicator', 'processIndicator', 'indicatorId', 'name');

      return { risks, documents, indicators };
    });

    return reply.send(result);
  });

  // ── Integración con Salidas Documentales ──────────────────────

  // GET /process-maps/:id/document-output — obtiene la salida documental vinculada al mapa
  app.get('/:id/document-output', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    const map = await app.runWithDbContext(req, async (tx: any) => {
      return tx.processMap.findFirst({ where: { id: req.params.id, deletedAt: null } });
    });
    if (!map) return reply.code(404).send({ error: 'Mapa no encontrado' });

    const output = await (app.prisma as any).documentOutputDefinition.findFirst({
      where: { tenantId, entityRef: req.params.id, deletedAt: null },
      include: {
        template: { select: { id: true, name: true } },
        document: { select: { id: true, title: true, documentCode: true } },
      },
    });
    return reply.send({ output });
  });

  // POST /process-maps/:id/document-output — crea o reutiliza la salida documental (idempotente)
  app.post('/:id/document-output', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    const map = await app.runWithDbContext(req, async (tx: any) => {
      return tx.processMap.findFirst({ where: { id: req.params.id, deletedAt: null } });
    });
    if (!map) return reply.code(404).send({ error: 'Mapa no encontrado' });

    const outputKey = `contexto-sgi.mapa-de-procesos.${map.id}`;
    const screenName = `Mapa de Procesos — ${map.name}`;

    // Idempotente: buscar salida existente por entityRef o outputKey
    let output = await (app.prisma as any).documentOutputDefinition.findFirst({
      where: { tenantId, entityRef: map.id, deletedAt: null },
    });

    if (!output) {
      // Buscar por outputKey (puede existir sin entityRef, creado manualmente)
      output = await (app.prisma as any).documentOutputDefinition.findFirst({
        where: { tenantId, outputKey, deletedAt: null },
      });
    }

    if (output) {
      // Actualizar screenName si el mapa fue renombrado
      if (output.screenName !== screenName) {
        output = await (app.prisma as any).documentOutputDefinition.update({
          where: { id: output.id },
          data: { screenName, entityRef: map.id },
        });
      }
      return reply.send({ output, created: false });
    }

    // Crear nueva salida documental
    output = await (app.prisma as any).documentOutputDefinition.create({
      data: {
        tenantId,
        module: 'contexto-sgi',
        subModule: 'mapa-de-procesos',
        screenName,
        outputKey,
        outputType: 'MAP',
        entityRef: map.id,
        status: 'PENDING',
        description: `Mapa de procesos: ${map.name}`,
      },
    });

    try {
      if (req.auth?.userId) {
        await logAuditEvent({
          tenantId,
          entityType: 'ProcessMap',
          entityId: map.id,
          action: 'UPDATE',
          userId: req.auth.userId,
          description: `Salida documental creada para el mapa "${map.name}" (${outputKey})`,
        });
      }
    } catch { /* auditoría opcional */ }

    return reply.code(201).send({ output, created: true });
  });

  // GET /process-maps/:id/suggest-code — sugiere un código documental para el mapa
  app.get('/:id/suggest-code', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    const map = await app.runWithDbContext(req, async (tx: any) => {
      return tx.processMap.findFirst({ where: { id: req.params.id, deletedAt: null } });
    });
    if (!map) return reply.code(404).send({ error: 'Mapa no encontrado' });

    // Asegurar que existe la salida documental
    const outputKey = `contexto-sgi.mapa-de-procesos.${map.id}`;
    let output = await (app.prisma as any).documentOutputDefinition.findFirst({
      where: { tenantId, entityRef: map.id, deletedAt: null },
    });
    if (!output) {
      output = await (app.prisma as any).documentOutputDefinition.findFirst({
        where: { tenantId, outputKey, deletedAt: null },
      });
    }
    if (!output) return reply.code(404).send({ error: 'Salida documental no encontrada. Ejecute POST /document-output primero.' });

    const rule = await (app.prisma as any).documentCodeRule.findFirst({
      where: { tenantId, module: 'contexto-sgi', active: true },
      orderBy: { subModule: 'asc' },
    });

    let suggestedCode = '';

    async function isCodeTaken(code: string): Promise<boolean> {
      const conflict = await (app.prisma as any).documentOutputDefinition.findFirst({
        where: { tenantId, documentCode: code, id: { not: output.id }, deletedAt: null },
      });
      return !!conflict;
    }

    if (rule) {
      const sep = rule.separator || '-';
      const digits = rule.digitCount || 3;
      let seq = rule.nextSequence;
      const buildCode = (n: number) => {
        const parts: string[] = [];
        if (rule.prefix) parts.push(rule.prefix);
        if (rule.processCode) parts.push(rule.processCode);
        if (rule.typeAbbr) parts.push(rule.typeAbbr);
        parts.push(String(n).padStart(digits, '0'));
        return parts.join(sep);
      };
      suggestedCode = buildCode(seq);
      while (await isCodeTaken(suggestedCode)) {
        seq++;
        suggestedCode = buildCode(seq);
      }
    } else {
      const count = await (app.prisma as any).documentOutputDefinition.count({
        where: { tenantId, module: 'contexto-sgi', documentCode: { not: null }, deletedAt: null },
      });
      let seq = count + 1;
      suggestedCode = `MAP-${String(seq).padStart(3, '0')}`;
      while (await isCodeTaken(suggestedCode)) {
        seq++;
        suggestedCode = `MAP-${String(seq).padStart(3, '0')}`;
      }
    }
    return reply.send({ suggestedCode, hasRule: !!rule, outputId: output.id });
  });

  // POST /process-maps/:id/assign-code — asigna un código documental al mapa
  app.post('/:id/assign-code', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    const { documentCode } = req.body as any;
    if (!documentCode) return reply.code(400).send({ error: 'Se requiere documentCode' });

    const map = await app.runWithDbContext(req, async (tx: any) => {
      return tx.processMap.findFirst({ where: { id: req.params.id, deletedAt: null } });
    });
    if (!map) return reply.code(404).send({ error: 'Mapa no encontrado' });

    const outputKey = `contexto-sgi.mapa-de-procesos.${map.id}`;
    let output = await (app.prisma as any).documentOutputDefinition.findFirst({
      where: { tenantId, entityRef: map.id, deletedAt: null },
    });
    if (!output) {
      output = await (app.prisma as any).documentOutputDefinition.findFirst({
        where: { tenantId, outputKey, deletedAt: null },
      });
    }
    if (!output) return reply.code(404).send({ error: 'Salida documental no encontrada. Ejecute POST /document-output primero.' });

    // Verificar unicidad del código
    const existing = await (app.prisma as any).documentOutputDefinition.findFirst({
      where: { tenantId, documentCode, id: { not: output.id }, deletedAt: null },
    });
    if (existing) return reply.code(409).send({ error: 'El código ya está en uso' });

    const userId = (req as any).auth?.userId ?? null;

    // Crear o actualizar el documento en el Maestro
    let maestroDoc = await (app.prisma as any).document.findFirst({
      where: { tenantId, documentCode, deletedAt: null },
    });
    if (!maestroDoc) {
      maestroDoc = await (app.prisma as any).document.create({
        data: {
          tenantId,
          title: output.screenName,
          type: 'Mapa',
          documentCode,
          status: 'EFFECTIVE',
          process: 'contexto-sgi',
          createdById: userId,
        },
      });
    } else {
      await (app.prisma as any).document.update({
        where: { id: maestroDoc.id },
        data: { documentCode, title: output.screenName },
      });
    }

    // Actualizar la salida con el código y el documento
    await (app.prisma as any).documentOutputDefinition.update({
      where: { id: output.id },
      data: { documentCode, documentId: maestroDoc.id, status: 'EFFECTIVE' },
    });

    // Incrementar la secuencia de la regla
    const rule = await (app.prisma as any).documentCodeRule.findFirst({
      where: { tenantId, module: 'contexto-sgi', active: true },
    });
    if (rule) {
      await (app.prisma as any).documentCodeRule.update({
        where: { id: rule.id },
        data: { nextSequence: { increment: 1 } },
      });
    }

    try {
      if (req.auth?.userId) {
        await logAuditEvent({
          tenantId,
          entityType: 'ProcessMap',
          entityId: map.id,
          action: 'UPDATE',
          userId: req.auth.userId,
          description: `Código documental ${documentCode} asignado al mapa "${map.name}"`,
        });
      }
    } catch { /* auditoría opcional */ }

    return reply.send({ ok: true, documentCode, documentId: maestroDoc.id });
  });
};
