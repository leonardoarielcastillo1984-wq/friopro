import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createGroqOnlyLLMProvider } from '../services/llm/factory.js';

const tid = (req: any) => req.sehAuth?.tenantId;
const uid = (req: any) => req.sehAuth?.userId;

/**
 * Biblioteca legal compartida → matriz legal SEH por cliente.
 * GET  /seh360/legal-library           Lista el catálogo LegalLibrary (country, framework, search)
 * POST /seh360/legal-library/import    Importa ítems a seh_legal_requirements de un cliente
 */
export const registerSehLegalLibraryRoutes = async (app: FastifyInstance) => {

  app.get('/seh360/legal-library', async (req: any, reply) => {
    if (!req.sehAuth) return reply.code(401).send({ error: 'No autorizado' });
    const { country, framework, search } = req.query as any;
    const where: any = { isActive: true };
    if (country) where.country = country;
    if (framework) where.framework = framework;
    if (search) where.OR = [
      { title: { contains: String(search), mode: 'insensitive' } },
      { source: { contains: String(search), mode: 'insensitive' } },
    ];
    const items = await (app as any).prisma.legalLibrary.findMany({ where, orderBy: [{ country: 'asc' }, { framework: 'asc' }, { source: 'asc' }], take: 500 });
    return reply.send({ items });
  });

  app.get('/seh360/legal-library/countries', async (req: any, reply) => {
    if (!req.sehAuth) return reply.code(401).send({ error: 'No autorizado' });
    const rows = await (app as any).prisma.legalLibrary.findMany({ where: { isActive: true }, select: { country: true }, distinct: ['country'] });
    return reply.send({ countries: rows.map((r: any) => r.country) });
  });

  app.post('/seh360/legal-library/import', async (req: any, reply) => {
    if (!req.sehAuth) return reply.code(401).send({ error: 'No autorizado' });
    const t = tid(req); if (!t) return reply.code(400).send({ error: 'Tenant required' });
    const v = z.object({
      clientId: z.string().uuid(),
      itemIds: z.array(z.string().uuid()).min(1).max(200),
    }).safeParse(req.body);
    if (!v.success) return reply.code(400).send({ error: 'Datos inválidos', details: v.error.errors });
    const { clientId, itemIds } = v.data;

    const client = await (app as any).prisma.sehClient.findFirst({ where: { id: clientId, tenantId: t, deletedAt: null } });
    if (!client) return reply.code(404).send({ error: 'Cliente no encontrado' });

    const libItems = await (app as any).prisma.legalLibrary.findMany({ where: { id: { in: itemIds }, isActive: true } });
    if (!libItems.length) return reply.code(404).send({ error: 'No se encontraron ítems de biblioteca' });

    // Dedupe: mismo clientId + normative + description
    const existing = await (app as any).prisma.sehLegalRequirement.findMany({
      where: { tenantId: t, clientId, deletedAt: null },
      select: { normative: true, description: true },
    });
    const seen = new Set(existing.map((e: any) => `${e.normative}||${e.description}`));
    const toCreate = libItems
      .filter((i: any) => !seen.has(`${i.source}||${i.title}`))
      .map((i: any) => ({
        tenantId: t,
        clientId,
        createdById: uid(req),
        normative: i.source,
        description: i.title + (i.description ? ` — ${i.description}` : ''),
        jurisdiction: i.jurisdiction || i.country,
        enforcingAuthority: i.enforcingAuthority,
        isLibrary: true,
        librarySource: 'LegalLibrary',
        status: 'PENDING',
      }));
    if (toCreate.length) {
      await (app as any).prisma.sehLegalRequirement.createMany({ data: toCreate });
    }
    return reply.send({ imported: toCreate.length, skipped: libItems.length - toCreate.length });
  });

  // Sugerir normas del país elegido con IA → las suma a la biblioteca compartida
  app.post('/seh360/legal-library/ai-suggest', async (req: any, reply) => {
    if (!req.sehAuth) return reply.code(401).send({ error: 'No autorizado' });
    const t = tid(req); if (!t) return reply.code(400).send({ error: 'Tenant required' });
    const v = z.object({
      country: z.string().min(2).max(60),
      activity: z.string().max(120).optional(),
    }).safeParse(req.body);
    if (!v.success) return reply.code(400).send({ error: 'Datos inválidos', details: v.error.errors });
    const { country, activity } = v.data;
    const prisma = (app as any).prisma;

    const prompt = `Sos un experto en legislación de Seguridad e Higiene laboral. ` +
      `Listá las normas legales vigentes y más relevantes de ${country} en materia de seguridad y salud ocupacional` +
      (activity ? ` para la actividad/rubro "${activity}"` : '') + `.\n\n` +
      `Devolvé SOLO un JSON array (sin markdown ni texto extra) de 8 a 15 ítems con esta forma:\n` +
      `[{"source":"Ley 19.587","title":"Higiene y Seguridad en el Trabajo","framework":"OHAS","jurisdiction":"nacional","article":"",` +
      `"description":"Establece normas mínimas de SST","enforcingAuthority":"SRT","appliesTo":"Toda actividad"}]\n\n` +
      `Reglas: framework ∈ OHAS|ENVIRONMENTAL|QUALITY|OTHER. source = denominación oficial de la norma. ` +
      `Incluí leyes, decretos reglamentarios, resoluciones y normas técnicas obligatorias reales. No inventes números de norma.`;

    let parsed: any[] = [];
    try {
      const llm = createGroqOnlyLLMProvider((req as any).tenant, prisma, t, req.sehAuth?.userId ?? null, 'seh360');
      const res = await llm.chat([{ role: 'user', content: prompt }], 2500);
      const txt = (res?.text || '').replace(/```json|```/g, '').trim();
      const arr = JSON.parse(txt.slice(txt.indexOf('['), txt.lastIndexOf(']') + 1));
      if (Array.isArray(arr)) parsed = arr.filter(i => i?.source && i?.title).slice(0, 15);
    } catch (e: any) {
      return reply.code(500).send({ error: 'No se pudo generar la sugerencia con IA', details: e?.message });
    }
    if (!parsed.length) return reply.send({ added: 0, items: [] });

    // Dedup contra la biblioteca: mismo country + source
    const existing = await prisma.legalLibrary.findMany({ where: { country, isActive: true }, select: { source: true } });
    const seen = new Set(existing.map((e: any) => e.source.toLowerCase()));
    const toCreate = parsed
      .filter(i => !seen.has(String(i.source).toLowerCase()))
      .map(i => ({
        country,
        framework: ['OHAS', 'ENVIRONMENTAL', 'QUALITY', 'OTHER'].includes(i.framework) ? i.framework : 'OHAS',
        jurisdiction: i.jurisdiction || 'nacional',
        source: String(i.source).slice(0, 200),
        article: i.article ? String(i.article).slice(0, 200) : null,
        title: String(i.title).slice(0, 500),
        description: i.description ? String(i.description).slice(0, 2000) : null,
        appliesTo: i.appliesTo ? String(i.appliesTo).slice(0, 300) : null,
        enforcingAuthority: i.enforcingAuthority ? String(i.enforcingAuthority).slice(0, 300) : null,
      }));
    if (toCreate.length) await prisma.legalLibrary.createMany({ data: toCreate });

    // Devolver todo lo del país (nuevas + existentes) para que el usuario seleccione e importe
    const items = await prisma.legalLibrary.findMany({ where: { country, isActive: true }, orderBy: { source: 'asc' } });
    return reply.send({ added: toCreate.length, items });
  });
};
