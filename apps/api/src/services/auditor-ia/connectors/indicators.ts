import { createHash } from 'node:crypto';
import type {
  EvidenceConnector, ConnectorContext, RequirementRef,
  CollectResult, EvidenceItem, SearchCandidate, SourceSnapshot,
} from './types.js';
import { MAX_ITEMS, hasModuleAccess, inPeriod, noPermission, queryError, trunc } from './types.js';

const KEY = 'indicators';
const PERM = 'indicadores';

function itemHash(i: { status: string; currentValue: number | null; updatedAt?: Date | null }): string {
  return createHash('sha256')
    .update(`${i.status}|${i.currentValue}|${i.updatedAt?.toISOString() ?? ''}`)
    .digest('hex')
    .slice(0, 16);
}

export const indicatorsConnector: EvidenceConnector = {
  key: KEY,
  label: 'Indicadores (KPI)',
  permissionModule: PERM,

  async collect(ctx: ConnectorContext, _req: RequirementRef): Promise<CollectResult> {
    if (!hasModuleAccess(ctx.userPerms, PERM)) return noPermission(PERM);
    try {
      const indicators = await ctx.db.indicator.findMany({
        where: { tenantId: ctx.tenantId, deletedAt: null, isActive: true },
        orderBy: { updatedAt: 'desc' },
        take: 40,
        select: {
          id: true, code: true, name: true, unit: true, status: true,
          currentValue: true, targetValue: true, frequency: true,
          lastMeasuredAt: true, nextDueAt: true, updatedAt: true,
          measurements: {
            orderBy: { measuredAt: 'desc' },
            take: 3,
            select: { value: true, period: true, measuredAt: true },
          },
        },
      });
      const items: EvidenceItem[] = indicators.slice(0, MAX_ITEMS).map((i) => {
        const inPeriodMeasurements = i.measurements.filter((m) =>
          inPeriod(m.measuredAt, ctx.periodFrom, ctx.periodTo),
        );
        return {
          entityType: 'Indicator',
          entityId: i.id,
          title: `${i.code} — ${i.name}`,
          updatedAt: i.updatedAt,
          url: '/indicadores',
          inPeriod: inPeriodMeasurements.length > 0 || inPeriod(i.lastMeasuredAt, ctx.periodFrom, ctx.periodTo),
          summary: trunc(
            `KPI ${i.code} "${i.name}" (${i.unit}, ${i.frequency}). Estado: ${i.status}. ` +
            `Actual: ${i.currentValue ?? 's/d'}, meta: ${i.targetValue ?? 's/d'}. ` +
            `Última medición: ${i.lastMeasuredAt?.toISOString().slice(0, 10) ?? 'nunca'}. ` +
            `Mediciones en período: ${inPeriodMeasurements.length} ` +
            `(${inPeriodMeasurements.map((m) => `${m.period}=${m.value}`).join(', ') || 'ninguna'}).`,
          ),
          hash: itemHash(i),
        };
      });
      return { items, coverage: { queried: true, available: true, reason: items.length ? undefined : 'sin datos' } };
    } catch (e) {
      return queryError(e);
    }
  },

  async search(ctx: ConnectorContext, q: string): Promise<SearchCandidate[]> {
    const rows = await ctx.db.indicator.findMany({
      where: {
        tenantId: ctx.tenantId, deletedAt: null,
        OR: [{ name: { contains: q, mode: 'insensitive' } }, { code: { contains: q, mode: 'insensitive' } }],
      },
      take: 20,
      select: { id: true, code: true, name: true, status: true },
    });
    return rows.map((r) => ({
      entityType: 'Indicator', entityId: r.id,
      title: `${r.code} — ${r.name}`, url: '/indicadores', detail: r.status,
    }));
  },

  async snapshot(db, tenantId, entityId): Promise<SourceSnapshot | null> {
    const i = await db.indicator.findFirst({
      where: { id: entityId, tenantId },
      select: { status: true, currentValue: true, updatedAt: true },
    });
    if (!i) return null;
    return { type: 'Indicator', id: entityId, updatedAt: i.updatedAt?.toISOString(), hash: itemHash(i) };
  },
};
