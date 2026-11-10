import { FastifyInstance } from 'fastify';
import { z } from 'zod';

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
};
