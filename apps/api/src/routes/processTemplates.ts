import { getEffectiveTenantId } from '../utils/tenant-bypass.js';
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  PROCESS_TEMPLATE_CATALOG,
  NORMS,
  INDUSTRIES,
  IMPLEMENTATION_DAYS_PER_PROCESS,
  type ProcessTemplateSeed,
} from '../data/processTemplates.js';
import { createGroqOnlyLLMProvider } from '../services/llm/factory.js';

// ── Auto-seed idempotente ─────────────────────────────────────────────────
// Inserta el catálogo global (tenantId null) en la tabla process_templates
// la primera vez que se consulta y la tabla está vacía. No pisa datos
// existentes ni plantillas custom de tenants.
let seedChecked = false;
async function ensureCatalogSeeded(prisma: any) {
  if (seedChecked) return;
  try {
    const count = await prisma.processTemplate.count({ where: { tenantId: null } });
    if (count === 0) {
      await prisma.processTemplate.createMany({
        data: PROCESS_TEMPLATE_CATALOG.map((t: ProcessTemplateSeed) => ({
          tenantId: null,
          norm: t.norm,
          industry: t.industry,
          name: t.name,
          layer: t.layer,
          description: t.description ?? null,
          objective: t.objective ?? null,
          scope: t.scope ?? null,
          inputs: t.inputs ?? [],
          outputs: t.outputs ?? [],
          clients: t.clients ?? [],
          suppliers: t.suppliers ?? [],
          risks: t.risks ?? [],
          opportunities: t.opportunities ?? [],
          indicators: t.indicators ?? [],
          documents: t.documents ?? [],
          resources: t.resources ?? [],
          clauses: t.clauses ?? [],
          interactions: t.interactions ?? [],
          order: t.order,
          color: t.color ?? null,
          icon: t.icon ?? null,
          active: true,
        })),
        skipDuplicates: true,
      });
      console.log(`[processTemplates] Auto-seed: ${PROCESS_TEMPLATE_CATALOG.length} plantillas cargadas`);
    }
    seedChecked = true;
  } catch (e: any) {
    // Si la tabla aún no existe (schema drift), no bloquear — se re-intenta luego.
    console.error('[processTemplates] Auto-seed falló (¿tabla no creada?):', e?.message);
  }
}

const asArray = (v: any): string[] => (Array.isArray(v) ? v.filter(Boolean).map(String) : []);

// Compone una descripción rica a partir de todos los campos de la plantilla,
// para preservar toda la información dentro del modelo Process existente
// (que no tiene columnas dedicadas para objetivo/alcance/clientes/etc.).
function composeDescription(t: any): string {
  const parts: string[] = [];
  if (t.description) parts.push(t.description);
  if (t.objective) parts.push(`Objetivo: ${t.objective}`);
  if (t.scope) parts.push(`Alcance: ${t.scope}`);
  const clients = asArray(t.clients);
  if (clients.length) parts.push(`Clientes internos: ${clients.join(', ')}`);
  const suppliers = asArray(t.suppliers);
  if (suppliers.length) parts.push(`Proveedores internos: ${suppliers.join(', ')}`);
  const opportunities = asArray(t.opportunities);
  if (opportunities.length) parts.push(`Oportunidades: ${opportunities.join(', ')}`);
  const resources = asArray(t.resources);
  if (resources.length) parts.push(`Recursos: ${resources.join(', ')}`);
  const clauses = asArray(t.clauses);
  if (clauses.length) parts.push(`Cláusulas: ${clauses.join(', ')}`);
  const interactions = asArray(t.interactions);
  if (interactions.length) parts.push(`Interactúa con: ${interactions.join(', ')}`);
  return parts.join('\n');
}

function indicatorsToString(indicators: any): string {
  if (!Array.isArray(indicators)) return '';
  return indicators
    .map((i: any) => (typeof i === 'string' ? i : [i.name, i.unit ? `(${i.unit})` : '', i.frequency ? `- ${i.frequency}` : ''].filter(Boolean).join(' ')))
    .filter(Boolean)
    .join(', ');
}

const importSchema = z.object({
  norm: z.string().min(1),
  industry: z.string().min(1),
  // Nombres de procesos a importar (checkboxes del wizard). Si se omite, importa todos.
  processNames: z.array(z.string()).optional(),
  // Crear un mapa nuevo (mapName) o agregar a uno existente (mapId).
  mapName: z.string().min(1).optional(),
  mapId: z.string().uuid().optional(),
  mapDescription: z.string().optional(),
  mapScope: z.string().optional(),
});

export const processTemplatesRoutes: FastifyPluginAsync = async (app) => {
  // ── GET /process-templates/norms ─────────────────────────────────────────
  app.get('/norms', async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ norms: NORMS });
  });

  // ── GET /process-templates/industries ────────────────────────────────────
  app.get('/industries', async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ industries: INDUSTRIES });
  });

  // ── GET /process-templates ────────────────────────────────────────────────
  // Query: ?norm=IATF16949&industry=AUTOMOTIVE
  app.get('/', async (req: FastifyRequest<{ Querystring: { norm?: string; industry?: string } }>, reply: FastifyReply) => {
    await ensureCatalogSeeded(app.prisma);
    const tenantId = await getEffectiveTenantId(req, app.prisma).catch(() => null);
    const { norm, industry } = req.query;
    const where: any = {
      active: true,
      // Plantillas globales (tenantId null) + custom del tenant actual
      OR: [{ tenantId: null }, ...(tenantId ? [{ tenantId }] : [])],
    };
    if (norm) where.norm = norm;
    if (industry) where.industry = industry;

    const templates = await (app.prisma as any).processTemplate.findMany({
      where,
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    });

    const days = templates.length * IMPLEMENTATION_DAYS_PER_PROCESS;
    const summary = {
      processes: templates.length,
      indicators: templates.reduce((s: number, t: any) => s + (Array.isArray(t.indicators) ? t.indicators.length : 0), 0),
      risks: templates.reduce((s: number, t: any) => s + asArray(t.risks).length, 0),
      documents: templates.reduce((s: number, t: any) => s + asArray(t.documents).length, 0),
      estimatedDays: days,
      estimatedLabel: days >= 30 ? `${Math.round(days / 30 * 10) / 10} meses` : `${days} días`,
    };

    return reply.send({ templates, summary });
  });

  // ── GET /process-templates/:id ────────────────────────────────────────────
  app.get('/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    await ensureCatalogSeeded(app.prisma);
    const template = await (app.prisma as any).processTemplate.findUnique({ where: { id: req.params.id } });
    if (!template) return reply.code(404).send({ error: 'Plantilla no encontrada' });
    return reply.send(template);
  });

  // ── POST /process-templates/import ────────────────────────────────────────
  // Crea (o completa) un mapa de procesos a partir de una plantilla.
  app.post('/import', async (req: FastifyRequest, reply: FastifyReply) => {
    await ensureCatalogSeeded(app.prisma);
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    let body;
    try {
      body = importSchema.parse(req.body);
    } catch (e: any) {
      return reply.code(400).send({ error: 'Validación fallida', details: e.errors || e.message });
    }

    // Traer las plantillas seleccionadas (globales + custom del tenant)
    const where: any = {
      active: true,
      norm: body.norm,
      industry: body.industry,
      OR: [{ tenantId: null }, { tenantId }],
    };
    if (body.processNames && body.processNames.length > 0) {
      where.name = { in: body.processNames };
    }
    const templates = await (app.prisma as any).processTemplate.findMany({
      where,
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    });
    if (templates.length === 0) {
      return reply.code(400).send({ error: 'No se encontraron plantillas para importar con los criterios dados' });
    }

    const result = await app.runWithDbContext(req, async (tx: any) => {
      // 1. Resolver mapa destino
      let map;
      if (body.mapId) {
        map = await tx.processMap.findFirst({ where: { id: body.mapId, tenantId, deletedAt: null } });
        if (!map) throw new Error('Mapa destino no encontrado');
      } else {
        const normLabel = NORMS.find((n) => n.code === body.norm)?.label ?? body.norm;
        map = await tx.processMap.create({
          data: {
            tenantId,
            name: body.mapName || `Mapa ${normLabel}`,
            description: body.mapDescription || `Mapa de procesos generado desde plantilla ${normLabel}`,
            scope: body.mapScope || undefined,
            createdById: (req as any).auth?.userId ?? null,
          },
        });
      }

      // 2. Nombres ya existentes en el mapa (para no duplicar)
      const existing = await tx.process.findMany({
        where: { processMapId: map.id, deletedAt: null },
        select: { name: true },
      });
      const existingNames = new Set(existing.map((p: any) => p.name.trim().toLowerCase()));

      // 3. Crear procesos desde las plantillas (mapeo a campos del Process existente)
      let created = 0;
      let skipped = 0;
      for (const t of templates) {
        if (existingNames.has(t.name.trim().toLowerCase())) { skipped++; continue; }
        await tx.process.create({
          data: {
            tenantId,
            processMapId: map.id,
            layer: t.layer,
            name: t.name,
            status: 'active',
            description: composeDescription(t),
            inputs: asArray(t.inputs).join('\n') || undefined,
            outputs: asArray(t.outputs).join('\n') || undefined,
            indicators: indicatorsToString(t.indicators) || undefined,
            documents: asArray(t.documents).join(', ') || undefined,
            risks: asArray(t.risks).join(', ') || undefined,
            sites: [],
            order: t.order ?? 0,
          },
        });
        created++;
      }

      const full = await tx.processMap.findUnique({
        where: { id: map.id },
        include: { processes: { where: { deletedAt: null }, orderBy: [{ layer: 'asc' }, { order: 'asc' }] } },
      });
      return { map: full, created, skipped };
    });

    return reply.code(201).send(result);
  });

  // ── POST /process-templates/ai-implement ──────────────────────────────────
  // Implementación inteligente con IA: a partir de respuestas del usuario,
  // la IA arma un mapa de procesos adaptado. Si la IA falla, cae al catálogo.
  const aiSchema = z.object({
    businessDescription: z.string().optional(),
    sites: z.union([z.string(), z.number()]).optional(),
    hasProduction: z.boolean().optional(),
    hasDesign: z.boolean().optional(),
    hasOutsourcing: z.boolean().optional(),
    norms: z.array(z.string()).optional(),
    isCertified: z.boolean().optional(),
    mapName: z.string().optional(),
  });

  app.post('/ai-implement', async (req: FastifyRequest, reply: FastifyReply) => {
    await ensureCatalogSeeded(app.prisma);
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    let a;
    try { a = aiSchema.parse(req.body); }
    catch (e: any) { return reply.code(400).send({ error: 'Validación fallida', details: e.errors || e.message }); }

    const userId = (req as any).auth?.userId ?? null;
    const normsList = (a.norms && a.norms.length ? a.norms : ['ISO9001']).join(', ');

    // Procesos generados por IA (o fallback al catálogo)
    type GenProc = { name: string; layer: string; description?: string; objective?: string; indicators?: string[]; risks?: string[]; documents?: string[]; interactions?: string[] };
    let processes: GenProc[] = [];

    try {
      const llm = createGroqOnlyLLMProvider(null, app.prisma, tenantId, userId, 'process-templates-ai');
      const prompt = `Sos un consultor experto en Sistemas de Gestión ISO. A partir del perfil de la organización, generá el mapa de procesos adaptado.

PERFIL DE LA ORGANIZACIÓN:
- Actividad: ${a.businessDescription || 'No especificada'}
- Sedes: ${a.sites ?? 'No especificado'}
- ¿Tiene producción?: ${a.hasProduction ? 'Sí' : 'No'}
- ¿Realiza diseño?: ${a.hasDesign ? 'Sí' : 'No'}
- ¿Procesos tercerizados?: ${a.hasOutsourcing ? 'Sí' : 'No'}
- Normas a implementar: ${normsList}
- ¿Está certificada?: ${a.isCertified ? 'Sí' : 'No'}

Respondé ÚNICAMENTE con JSON válido, sin markdown ni texto adicional, con esta estructura:
{"processes":[{"name":"","layer":"STRATEGIC|OPERATIONAL|SUPPORT","description":"","objective":"","indicators":["nombre indicador"],"risks":["riesgo"],"documents":["documento"],"interactions":["otro proceso"]}]}

Reglas:
- layer debe ser exactamente STRATEGIC, OPERATIONAL o SUPPORT.
- Incluí entre 8 y 16 procesos coherentes con la actividad y las normas.
- Si no hay producción, no incluyas procesos productivos; enfocate en servicios.
- Ordená: estratégicos primero, luego operativos, luego soporte.`;

      const resp = await llm.chat([{ role: 'user', content: prompt }], 4096, true);
      const parsed = JSON.parse(resp.text || '{}');
      if (Array.isArray(parsed?.processes)) {
        processes = parsed.processes
          .filter((p: any) => p?.name && ['STRATEGIC', 'OPERATIONAL', 'SUPPORT'].includes(p.layer))
          .map((p: any) => ({
            name: String(p.name),
            layer: p.layer,
            description: p.description ? String(p.description) : undefined,
            objective: p.objective ? String(p.objective) : undefined,
            indicators: asArray(p.indicators),
            risks: asArray(p.risks),
            documents: asArray(p.documents),
            interactions: asArray(p.interactions),
          }));
      }
    } catch (e: any) {
      console.error('[processTemplates ai-implement] IA falló, usando fallback de catálogo:', e?.message);
    }

    // Fallback: catálogo de la primera norma (genérico) si la IA no devolvió nada
    let usedFallback = false;
    if (processes.length === 0) {
      usedFallback = true;
      const firstNorm = (a.norms && a.norms[0]) || 'ISO9001';
      let cat = PROCESS_TEMPLATE_CATALOG.filter((t) => t.norm === firstNorm);
      if (cat.length === 0) cat = PROCESS_TEMPLATE_CATALOG.filter((t) => t.norm === 'ISO9001');
      // Filtrar productivos si no hay producción
      if (!a.hasProduction) {
        cat = cat.filter((t) => !/producci|armado|fabric/i.test(t.name));
      }
      processes = cat.map((t) => ({
        name: t.name, layer: t.layer, description: t.description, objective: t.objective,
        indicators: (t.indicators || []).map((i) => i.name), risks: t.risks, documents: t.documents, interactions: t.interactions,
      }));
    }

    if (processes.length === 0) {
      return reply.code(422).send({ error: 'No se pudieron generar procesos. Intentá con el asistente de plantillas.' });
    }

    const result = await app.runWithDbContext(req, async (tx: any) => {
      const map = await tx.processMap.create({
        data: {
          tenantId,
          name: a.mapName || 'Mapa de Procesos (IA)',
          description: `Mapa generado por IA — Normas: ${normsList}. ${a.businessDescription || ''}`.trim(),
          createdById: userId,
        },
      });
      let order = 0;
      for (const p of processes) {
        const desc = [p.description, p.objective ? `Objetivo: ${p.objective}` : '', p.interactions?.length ? `Interactúa con: ${p.interactions.join(', ')}` : ''].filter(Boolean).join('\n');
        await tx.process.create({
          data: {
            tenantId, processMapId: map.id, layer: p.layer, name: p.name, status: 'active',
            description: desc || undefined,
            indicators: (p.indicators || []).join(', ') || undefined,
            documents: (p.documents || []).join(', ') || undefined,
            risks: (p.risks || []).join(', ') || undefined,
            sites: [], order: order++,
          },
        });
      }
      const full = await tx.processMap.findUnique({
        where: { id: map.id },
        include: { processes: { where: { deletedAt: null }, orderBy: [{ layer: 'asc' }, { order: 'asc' }] } },
      });
      return { map: full, created: processes.length, usedFallback };
    });

    return reply.code(201).send(result);
  });
};
