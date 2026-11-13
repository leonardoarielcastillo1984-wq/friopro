import { createHash } from 'node:crypto';
import type {
  EvidenceConnector, ConnectorContext, RequirementRef,
  CollectResult, EvidenceItem, SearchCandidate, SourceSnapshot,
} from './types.js';
import { MAX_ITEMS, hasModuleAccess, inPeriod, noPermission, queryError, trunc } from './types.js';

const KEY = 'context';
const PERM = 'contexto-sgi';

function itemHash(updatedAt?: Date | null): string {
  return createHash('sha256').update(updatedAt?.toISOString() ?? '').digest('hex').slice(0, 16);
}

export const contextConnector: EvidenceConnector = {
  key: KEY,
  label: 'Contexto y partes interesadas',
  permissionModule: PERM,

  async collect(ctx: ConnectorContext, _req: RequirementRef): Promise<CollectResult> {
    if (!hasModuleAccess(ctx.userPerms, PERM)) return noPermission(PERM);
    try {
      const [contexts, stakeholders] = await Promise.all([
        ctx.db.organizationContext.findMany({
          where: { tenantId: ctx.tenantId },
          orderBy: { year: 'desc' },
          take: 5,
        }),
        ctx.db.stakeholder.findMany({
          where: { tenantId: ctx.tenantId, deletedAt: null },
          orderBy: { updatedAt: 'desc' },
          take: 30,
          select: {
            id: true, name: true, type: true, category: true,
            needs: true, expectations: true, requirements: true, updatedAt: true,
          },
        }),
      ]);

      const items: EvidenceItem[] = [];
      for (const c of contexts) {
        const count = (arr: unknown) => (Array.isArray(arr) ? arr.length : 0);
        items.push({
          entityType: 'OrganizationContext',
          entityId: c.id,
          title: `Contexto organizacional ${c.year}`,
          version: String(c.year),
          updatedAt: c.updatedAt,
          url: '/contexto-sgi',
          inPeriod: inPeriod(c.updatedAt, ctx.periodFrom, ctx.periodTo),
          summary: trunc(
            `Análisis de contexto ${c.year}: ${count(c.strengths)} fortalezas, ${count(c.weaknesses)} debilidades, ` +
            `${count(c.opportunities)} oportunidades, ${count(c.threats)} amenazas. ` +
            `${c.mission ? 'Misión definida. ' : 'Sin misión registrada. '}` +
            `${c.political ? 'Análisis PESTEL presente. ' : ''}` +
            `${c.fodaPriorities ? 'Prioridades FODA definidas.' : ''}`,
          ),
          hash: itemHash(c.updatedAt),
        });
      }
      for (const s of stakeholders.slice(0, MAX_ITEMS - items.length)) {
        items.push({
          entityType: 'Stakeholder',
          entityId: s.id,
          title: s.name,
          updatedAt: s.updatedAt,
          url: '/contexto-sgi?tab=partes',
          inPeriod: inPeriod(s.updatedAt, ctx.periodFrom, ctx.periodTo),
          summary: trunc(
            `Parte interesada ${s.name} (${s.type}/${s.category}). ` +
            `${s.needs ? `Necesidades: ${s.needs}. ` : ''}` +
            `${s.requirements ? `Requisitos: ${s.requirements}.` : 'Sin requisitos registrados.'}`,
          ),
          hash: itemHash(s.updatedAt),
        });
      }
      return { items, coverage: { queried: true, available: true, reason: items.length ? undefined : 'sin datos' } };
    } catch (e) {
      return queryError(e);
    }
  },

  async search(ctx: ConnectorContext, q: string): Promise<SearchCandidate[]> {
    const rows = await ctx.db.stakeholder.findMany({
      where: { tenantId: ctx.tenantId, deletedAt: null, name: { contains: q, mode: 'insensitive' } },
      take: 20,
      select: { id: true, name: true, type: true, category: true },
    });
    return rows.map((r) => ({
      entityType: 'Stakeholder', entityId: r.id,
      title: r.name, url: '/contexto-sgi?tab=partes', detail: `${r.type}/${r.category}`,
    }));
  },

  async snapshot(db, tenantId, entityId): Promise<SourceSnapshot | null> {
    const s = await db.stakeholder.findFirst({
      where: { id: entityId, tenantId },
      select: { updatedAt: true },
    });
    if (s) return { type: 'Stakeholder', id: entityId, updatedAt: s.updatedAt?.toISOString(), hash: itemHash(s.updatedAt) };
    const c = await db.organizationContext.findFirst({
      where: { id: entityId, tenantId },
      select: { updatedAt: true },
    });
    if (!c) return null;
    return { type: 'OrganizationContext', id: entityId, updatedAt: c.updatedAt?.toISOString(), hash: itemHash(c.updatedAt) };
  },
};
