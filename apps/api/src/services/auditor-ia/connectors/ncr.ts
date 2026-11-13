import { createHash } from 'node:crypto';
import type {
  EvidenceConnector, ConnectorContext, RequirementRef,
  CollectResult, EvidenceItem, SearchCandidate, SourceSnapshot,
} from './types.js';
import { MAX_ITEMS, hasModuleAccess, inPeriod, noPermission, queryError, trunc } from './types.js';

const KEY = 'ncr';
const PERM = 'calidad'; // ROUTE_MODULE_MAP mapea /api/ncr a 'calidad'

function itemHash(n: { status: string; updatedAt?: Date | null }): string {
  return createHash('sha256')
    .update(`${n.status}|${n.updatedAt?.toISOString() ?? ''}`)
    .digest('hex')
    .slice(0, 16);
}

export const ncrConnector: EvidenceConnector = {
  key: KEY,
  label: 'No conformidades y acciones',
  permissionModule: PERM,

  async collect(ctx: ConnectorContext, _req: RequirementRef): Promise<CollectResult> {
    if (!hasModuleAccess(ctx.userPerms, PERM)) return noPermission(PERM);
    try {
      const ncrs = await ctx.db.nonConformity.findMany({
        where: {
          tenantId: ctx.tenantId,
          deletedAt: null,
          ...(ctx.processIds.length ? { processId: { in: ctx.processIds } } : {}),
        },
        orderBy: [{ detectedAt: 'desc' }],
        take: 50,
        select: {
          id: true, code: true, title: true, severity: true, source: true,
          status: true, detectedAt: true, dueDate: true, closedAt: true,
          rootCause: true, correctiveAction: true, isEffective: true,
          verificationDate: true, updatedAt: true,
          actionPlans: {
            select: { id: true, code: true, plannedAction: true, status: true, plannedEndDate: true },
            take: 3,
          },
        },
      });
      const items: EvidenceItem[] = ncrs.slice(0, MAX_ITEMS).map((n) => {
        const plansTxt = n.actionPlans.length
          ? `Planes: ${n.actionPlans
              .map((p: { code: string | null; plannedAction: string | null; status: string }) =>
                `${p.code ?? p.plannedAction?.slice(0, 40) ?? 'plan'} (${p.status})`)
              .join('; ')}.`
          : 'Sin planes de acción vinculados.';
        return {
          entityType: 'NonConformity',
          entityId: n.id,
          title: `${n.code} — ${n.title}`,
          updatedAt: n.updatedAt,
          url: '/no-conformidades',
          inPeriod:
            inPeriod(n.detectedAt, ctx.periodFrom, ctx.periodTo) ||
            inPeriod(n.closedAt, ctx.periodFrom, ctx.periodTo),
          summary: trunc(
            `NC ${n.code} "${n.title}". Severidad ${n.severity}, fuente ${n.source}, estado ${n.status}. ` +
            `Detectada ${n.detectedAt.toISOString().slice(0, 10)}` +
            `${n.closedAt ? `, cerrada ${n.closedAt.toISOString().slice(0, 10)}` : ', abierta'}. ` +
            `${n.rootCause ? `Causa raíz: ${n.rootCause}. ` : 'Sin análisis de causa. '}` +
            `${n.isEffective === true ? 'Acción verificada eficaz. ' : n.isEffective === false ? 'Acción NO eficaz. ' : ''}` +
            plansTxt,
          ),
          hash: itemHash(n),
        };
      });
      return { items, coverage: { queried: true, available: true, reason: items.length ? undefined : 'sin datos' } };
    } catch (e) {
      return queryError(e);
    }
  },

  async search(ctx: ConnectorContext, q: string): Promise<SearchCandidate[]> {
    const rows = await ctx.db.nonConformity.findMany({
      where: {
        tenantId: ctx.tenantId, deletedAt: null,
        OR: [{ title: { contains: q, mode: 'insensitive' } }, { code: { contains: q, mode: 'insensitive' } }],
      },
      take: 20,
      select: { id: true, code: true, title: true, status: true },
    });
    return rows.map((r) => ({
      entityType: 'NonConformity', entityId: r.id,
      title: `${r.code} — ${r.title}`, url: '/no-conformidades', detail: r.status,
    }));
  },

  async snapshot(db, tenantId, entityId): Promise<SourceSnapshot | null> {
    const n = await db.nonConformity.findFirst({
      where: { id: entityId, tenantId },
      select: { status: true, updatedAt: true },
    });
    if (!n) return null;
    return { type: 'NonConformity', id: entityId, updatedAt: n.updatedAt?.toISOString(), hash: itemHash(n) };
  },
};
