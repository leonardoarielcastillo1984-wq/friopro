import { createHash } from 'node:crypto';
import type {
  EvidenceConnector, ConnectorContext, RequirementRef,
  CollectResult, EvidenceItem, SearchCandidate, SourceSnapshot,
} from './types.js';
import { MAX_ITEMS, hasModuleAccess, inPeriod, noPermission, queryError, trunc } from './types.js';

const KEY = 'management_review';
const PERM = 'revision-direccion';

function itemHash(r: { status: string; updatedAt?: Date | null }): string {
  return createHash('sha256')
    .update(`${r.status}|${r.updatedAt?.toISOString() ?? ''}`)
    .digest('hex')
    .slice(0, 16);
}

export const managementReviewConnector: EvidenceConnector = {
  key: KEY,
  label: 'Revisión por la dirección',
  permissionModule: PERM,

  async collect(ctx: ConnectorContext, _req: RequirementRef): Promise<CollectResult> {
    if (!hasModuleAccess(ctx.userPerms, PERM)) return noPermission(PERM);
    try {
      const reviews = await ctx.db.managementReview.findMany({
        where: {
          tenantId: ctx.tenantId,
          deletedAt: null,
          status: 'FINAL',
        },
        orderBy: { periodEnd: 'desc' },
        take: MAX_ITEMS,
        select: {
          id: true, title: true, status: true,
          periodStart: true, periodEnd: true,
          generatedAt: true, updatedAt: true,
          sections: {
            select: { key: true, title: true, outputs: true },
          },
        },
      });
      const items: EvidenceItem[] = reviews.map((r) => {
        const outputsTxt = r.sections
          .filter((s) => s.outputs)
          .map((s) => `${s.title}: ${s.outputs!.slice(0, 80)}`)
          .join('; ');
        return {
          entityType: 'ManagementReview',
          entityId: r.id,
          title: r.title,
          updatedAt: r.updatedAt,
          url: '/revision-direccion',
          inPeriod:
            inPeriod(r.periodEnd, ctx.periodFrom, ctx.periodTo) ||
            inPeriod(r.generatedAt, ctx.periodFrom, ctx.periodTo),
          summary: trunc(
            `Revisión por la dirección "${r.title}" (período ${r.periodStart.toISOString().slice(0, 10)}–${r.periodEnd.toISOString().slice(0, 10)}), ` +
            `estado ${r.status}, ${r.sections.length} secciones. ` +
            `Salidas/decisiones: ${outputsTxt || 'sin salidas registradas'}.`,
          ),
          hash: itemHash(r),
        };
      });
      return { items, coverage: { queried: true, available: true, reason: items.length ? undefined : 'sin datos' } };
    } catch (e) {
      return queryError(e);
    }
  },

  async search(ctx: ConnectorContext, q: string): Promise<SearchCandidate[]> {
    const rows = await ctx.db.managementReview.findMany({
      where: {
        tenantId: ctx.tenantId, deletedAt: null,
        title: { contains: q, mode: 'insensitive' },
      },
      take: 20,
      select: { id: true, title: true, status: true, periodEnd: true },
    });
    return rows.map((r) => ({
      entityType: 'ManagementReview', entityId: r.id,
      title: r.title, url: '/revision-direccion',
      detail: `${r.status} ${r.periodEnd.toISOString().slice(0, 10)}`,
    }));
  },

  async snapshot(db, tenantId, entityId): Promise<SourceSnapshot | null> {
    const r = await db.managementReview.findFirst({
      where: { id: entityId, tenantId },
      select: { status: true, updatedAt: true },
    });
    if (!r) return null;
    return { type: 'ManagementReview', id: entityId, updatedAt: r.updatedAt?.toISOString(), hash: itemHash(r) };
  },
};
