import { createHash } from 'node:crypto';
import type {
  EvidenceConnector, ConnectorContext, RequirementRef,
  CollectResult, EvidenceItem, SearchCandidate, SourceSnapshot,
} from './types.js';
import { MAX_ITEMS, hasModuleAccess, inPeriod, noPermission, queryError, trunc } from './types.js';

const KEY = 'internal_audits';
const PERM = 'auditoria'; // ROUTE_MODULE_MAP mapea /api/audit a 'auditoria'

function itemHash(a: { status: string; updatedAt?: Date | null }): string {
  return createHash('sha256')
    .update(`${a.status}|${a.updatedAt?.toISOString() ?? ''}`)
    .digest('hex')
    .slice(0, 16);
}

export const internalAuditsConnector: EvidenceConnector = {
  key: KEY,
  label: 'Auditorías internas ISO',
  permissionModule: PERM,

  async collect(ctx: ConnectorContext, _req: RequirementRef): Promise<CollectResult> {
    if (!hasModuleAccess(ctx.userPerms, PERM)) return noPermission(PERM);
    try {
      const audits = await ctx.db.audit.findMany({
        where: {
          tenantId: ctx.tenantId,
          deletedAt: null,
          status: { notIn: ['CANCELLED'] },
          ...(ctx.processIds.length ? { processId: { in: ctx.processIds } } : {}),
        },
        orderBy: [{ plannedStartDate: 'desc' }],
        take: 40,
        select: {
          id: true, code: true, title: true, type: true, status: true,
          plannedStartDate: true, plannedEndDate: true,
          actualStartDate: true, actualEndDate: true,
          auditorOpinion: true, scope: true, updatedAt: true,
          _count: { select: { findings: true } },
        },
      });
      const items: EvidenceItem[] = audits.slice(0, MAX_ITEMS).map((a) => ({
        entityType: 'Audit',
        entityId: a.id,
        title: `${a.code} — ${a.title}`,
        updatedAt: a.updatedAt,
        url: '/auditorias',
        inPeriod:
          inPeriod(a.plannedStartDate, ctx.periodFrom, ctx.periodTo) ||
          inPeriod(a.actualStartDate, ctx.periodFrom, ctx.periodTo) ||
          inPeriod(a.actualEndDate, ctx.periodFrom, ctx.periodTo),
        summary: trunc(
          `Auditoría ${a.code} "${a.title}" (${a.type}). Estado: ${a.status}. ` +
          `Planificada ${a.plannedStartDate?.toISOString().slice(0, 10) ?? 's/f'}` +
          `${a.actualEndDate ? `, ejecutada hasta ${a.actualEndDate.toISOString().slice(0, 10)}` : ''}. ` +
          `${a.auditorOpinion ? `Dictamen del auditor: ${a.auditorOpinion}. ` : ''}` +
          `Hallazgos registrados: ${a._count.findings}.` +
          `${a.scope ? ` Alcance: ${a.scope}` : ''}`,
        ),
        hash: itemHash(a),
      }));
      return { items, coverage: { queried: true, available: true, reason: items.length ? undefined : 'sin datos' } };
    } catch (e) {
      return queryError(e);
    }
  },

  async search(ctx: ConnectorContext, q: string): Promise<SearchCandidate[]> {
    const rows = await ctx.db.audit.findMany({
      where: {
        tenantId: ctx.tenantId, deletedAt: null,
        OR: [{ title: { contains: q, mode: 'insensitive' } }, { code: { contains: q, mode: 'insensitive' } }],
      },
      take: 20,
      select: { id: true, code: true, title: true, status: true },
    });
    return rows.map((r) => ({
      entityType: 'Audit', entityId: r.id,
      title: `${r.code} — ${r.title}`, url: '/auditorias', detail: r.status,
    }));
  },

  async snapshot(db, tenantId, entityId): Promise<SourceSnapshot | null> {
    const a = await db.audit.findFirst({
      where: { id: entityId, tenantId },
      select: { status: true, updatedAt: true },
    });
    if (!a) return null;
    return { type: 'Audit', id: entityId, updatedAt: a.updatedAt?.toISOString(), hash: itemHash(a) };
  },
};
