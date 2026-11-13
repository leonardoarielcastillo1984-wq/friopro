import { createHash } from 'node:crypto';
import type {
  EvidenceConnector, ConnectorContext, RequirementRef,
  CollectResult, EvidenceItem, SearchCandidate, SourceSnapshot,
} from './types.js';
import { MAX_ITEMS, hasModuleAccess, inPeriod, noPermission, queryError, trunc } from './types.js';

const KEY = 'objectives';
const PERM = 'objetivos';

function itemHash(o: { status: string; progress: number; updatedAt?: Date | null }): string {
  return createHash('sha256')
    .update(`${o.status}|${o.progress}|${o.updatedAt?.toISOString() ?? ''}`)
    .digest('hex')
    .slice(0, 16);
}

export const objectivesConnector: EvidenceConnector = {
  key: KEY,
  label: 'Objetivos del SGI',
  permissionModule: PERM,

  async collect(ctx: ConnectorContext, _req: RequirementRef): Promise<CollectResult> {
    if (!hasModuleAccess(ctx.userPerms, PERM)) return noPermission(PERM);
    try {
      const objectives = await ctx.db.sgiObjective.findMany({
        where: {
          tenantId: ctx.tenantId,
          deletedAt: null,
          ...(ctx.processIds.length ? { OR: [
            { processId: { in: ctx.processIds } },
            { involvedProcessIds: { hasSome: ctx.processIds } },
          ] } : {}),
          ...(ctx.sites.length ? { sites: { hasSome: ctx.sites } } : {}),
        },
        orderBy: { updatedAt: 'desc' },
        take: 50,
        select: {
          id: true, code: true, title: true, target: true, status: true,
          progress: true, startDate: true, endDate: true, year: true,
          updatedAt: true, progressMethod: true, approvedAt: true, closedAt: true,
          finalValue: true, evaluationComment: true,
        },
      });
      const items: EvidenceItem[] = objectives.slice(0, MAX_ITEMS).map((o) => {
        const inPer =
          inPeriod(o.startDate, ctx.periodFrom, ctx.periodTo) ||
          inPeriod(o.endDate, ctx.periodFrom, ctx.periodTo) ||
          inPeriod(o.closedAt, ctx.periodFrom, ctx.periodTo);
        return {
          entityType: 'SgiObjective',
          entityId: o.id,
          title: `${o.code} — ${o.title}`,
          version: String(o.year),
          updatedAt: o.updatedAt,
          url: '/objetivos',
          inPeriod: inPer,
          summary: trunc(
            `Objetivo ${o.code} (${o.year}). Meta: ${o.target}. Estado: ${o.status}. ` +
            `Avance: ${o.progress}% (método ${o.progressMethod ?? 'MANUAL'}). ` +
            `${o.approvedAt ? 'Aprobado por dirección. ' : 'Sin aprobación de dirección. '}` +
            `${o.finalValue != null ? `Resultado final medido: ${o.finalValue}. ` : ''}` +
            `${o.evaluationComment ? `Evaluación: ${o.evaluationComment}` : ''}`,
          ),
          hash: itemHash(o),
        };
      });
      return { items, coverage: { queried: true, available: true, reason: items.length ? undefined : 'sin datos' } };
    } catch (e) {
      return queryError(e);
    }
  },

  async search(ctx: ConnectorContext, q: string): Promise<SearchCandidate[]> {
    const rows = await ctx.db.sgiObjective.findMany({
      where: {
        tenantId: ctx.tenantId, deletedAt: null,
        OR: [{ title: { contains: q, mode: 'insensitive' } }, { code: { contains: q, mode: 'insensitive' } }],
      },
      take: 20,
      select: { id: true, code: true, title: true, status: true },
    });
    return rows.map((r) => ({
      entityType: 'SgiObjective', entityId: r.id,
      title: `${r.code} — ${r.title}`, url: '/objetivos', detail: r.status,
    }));
  },

  async snapshot(db, tenantId, entityId): Promise<SourceSnapshot | null> {
    const o = await db.sgiObjective.findFirst({
      where: { id: entityId, tenantId },
      select: { status: true, progress: true, updatedAt: true },
    });
    if (!o) return null;
    return { type: 'SgiObjective', id: entityId, updatedAt: o.updatedAt?.toISOString(), hash: itemHash(o) };
  },
};
