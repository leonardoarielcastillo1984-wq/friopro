import { createHash } from 'node:crypto';
import type {
  EvidenceConnector, ConnectorContext, RequirementRef,
  CollectResult, EvidenceItem, SearchCandidate, SourceSnapshot,
} from './types.js';
import { MAX_ITEMS, hasModuleAccess, inPeriod, noPermission, queryError, trunc } from './types.js';

const KEY = 'suppliers';
const PERM = 'proveedores';

function itemHash(s: { status: string; updatedAt?: Date | null }): string {
  return createHash('sha256')
    .update(`${s.status}|${s.updatedAt?.toISOString() ?? ''}`)
    .digest('hex')
    .slice(0, 16);
}

export const suppliersConnector: EvidenceConnector = {
  key: KEY,
  label: 'Proveedores y evaluaciones',
  permissionModule: PERM,

  async collect(ctx: ConnectorContext, _req: RequirementRef): Promise<CollectResult> {
    if (!hasModuleAccess(ctx.userPerms, PERM)) return noPermission(PERM);
    try {
      const suppliers = await ctx.db.supplier.findMany({
        where: {
          tenantId: ctx.tenantId,
          deletedAt: null,
          status: { notIn: ['REJECTED'] },
        },
        orderBy: [{ isCritical: 'desc' }, { updatedAt: 'desc' }],
        take: 50,
        select: {
          id: true, code: true, name: true, category: true, status: true,
          isCritical: true, providerType: true, evaluationScore: true,
          lastEvaluationDate: true, nextEvaluationDate: true, updatedAt: true,
          evaluations: {
            orderBy: { date: 'desc' },
            take: 2,
            select: { date: true, result: true, overallScore: true, period: true },
          },
        },
      });
      const items: EvidenceItem[] = suppliers.slice(0, MAX_ITEMS).map((s) => {
        const last = s.evaluations[0];
        return {
          entityType: 'Supplier',
          entityId: s.id,
          title: `${s.code} — ${s.name}`,
          updatedAt: s.updatedAt,
          url: '/proveedores',
          inPeriod:
            inPeriod(s.lastEvaluationDate, ctx.periodFrom, ctx.periodTo) ||
            inPeriod(s.nextEvaluationDate, ctx.periodFrom, ctx.periodTo),
          summary: trunc(
            `Proveedor ${s.code} "${s.name}" (${s.category ?? 's/cat'}). Estado ${s.status}` +
            `${s.isCritical ? ', CRÍTICO' : ''}${s.providerType ? `, tipo ${s.providerType}` : ''}. ` +
            `${s.evaluationScore != null ? `Score: ${s.evaluationScore}. ` : 'Sin score. '}` +
            `${last ? `Última evaluación ${last.date.toISOString().slice(0, 10)}: ${last.result} (${last.overallScore}). ` : 'Sin evaluaciones. '}` +
            `${s.nextEvaluationDate ? `Próxima evaluación ${s.nextEvaluationDate.toISOString().slice(0, 10)}.` : ''}`,
          ),
          hash: itemHash(s),
        };
      });
      return { items, coverage: { queried: true, available: true, reason: items.length ? undefined : 'sin datos' } };
    } catch (e) {
      return queryError(e);
    }
  },

  async search(ctx: ConnectorContext, q: string): Promise<SearchCandidate[]> {
    const rows = await ctx.db.supplier.findMany({
      where: {
        tenantId: ctx.tenantId, deletedAt: null,
        OR: [{ name: { contains: q, mode: 'insensitive' } }, { code: { contains: q, mode: 'insensitive' } }],
      },
      take: 20,
      select: { id: true, code: true, name: true, status: true },
    });
    return rows.map((r) => ({
      entityType: 'Supplier', entityId: r.id,
      title: `${r.code} — ${r.name}`, url: '/proveedores', detail: r.status,
    }));
  },

  async snapshot(db, tenantId, entityId): Promise<SourceSnapshot | null> {
    const s = await db.supplier.findFirst({
      where: { id: entityId, tenantId },
      select: { status: true, updatedAt: true },
    });
    if (!s) return null;
    return { type: 'Supplier', id: entityId, updatedAt: s.updatedAt?.toISOString(), hash: itemHash(s) };
  },
};
