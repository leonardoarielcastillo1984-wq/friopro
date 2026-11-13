import { createHash } from 'node:crypto';
import type {
  EvidenceConnector, ConnectorContext, RequirementRef,
  CollectResult, EvidenceItem, SearchCandidate, SourceSnapshot,
} from './types.js';
import { MAX_ITEMS, hasModuleAccess, inPeriod, noPermission, queryError, trunc } from './types.js';

const KEY = 'risks';
const PERM = 'seguridad'; // ROUTE_MODULE_MAP mapea /api/hazards+/aspects+/incidents a 'seguridad'; /api/riesgos no está mapeado

function itemHash(r: { status: string; riskLevel: number; updatedAt?: Date | null }): string {
  return createHash('sha256')
    .update(`${r.status}|${r.riskLevel}|${r.updatedAt?.toISOString() ?? ''}`)
    .digest('hex')
    .slice(0, 16);
}

export const risksConnector: EvidenceConnector = {
  key: KEY,
  label: 'Riesgos y tratamiento',
  permissionModule: PERM,

  async collect(ctx: ConnectorContext, _req: RequirementRef): Promise<CollectResult> {
    if (!hasModuleAccess(ctx.userPerms, PERM)) return noPermission(PERM);
    try {
      const risks = await ctx.db.risk.findMany({
        where: {
          tenantId: ctx.tenantId,
          deletedAt: null,
          status: { notIn: ['CLOSED'] },
        },
        orderBy: [{ riskLevel: 'desc' }, { updatedAt: 'desc' }],
        take: 50,
        select: {
          id: true, code: true, title: true, category: true, process: true,
          probability: true, impact: true, riskLevel: true, status: true,
          strategy: true, treatmentPlan: true, reviewDate: true,
          identificationDate: true, updatedAt: true,
          treatmentActions: {
            where: { deletedAt: null },
            select: { description: true, completed: true, dueDate: true, completedAt: true },
            orderBy: { order: 'asc' },
          },
        },
      });
      const items: EvidenceItem[] = risks.slice(0, MAX_ITEMS).map((r) => {
        const pending = r.treatmentActions.filter((a) => !a.completed).length;
        const done = r.treatmentActions.length - pending;
        return {
          entityType: 'Risk',
          entityId: r.id,
          title: `${r.code} — ${r.title}`,
          version: undefined,
          updatedAt: r.updatedAt,
          url: '/riesgos',
          inPeriod:
            inPeriod(r.identificationDate, ctx.periodFrom, ctx.periodTo) ||
            inPeriod(r.reviewDate, ctx.periodFrom, ctx.periodTo),
          summary: trunc(
            `Riesgo ${r.code}: ${r.title}. Categoría ${r.category}. ` +
            `Nivel ${r.riskLevel} (P${r.probability}×I${r.impact}). Estado: ${r.status}. ` +
            `${r.strategy ? `Estrategia: ${r.strategy}. ` : ''}` +
            `${r.treatmentPlan ? `Plan: ${r.treatmentPlan}. ` : ''}` +
            `Acciones de tratamiento: ${done} completadas, ${pending} pendientes.`,
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
    const rows = await ctx.db.risk.findMany({
      where: {
        tenantId: ctx.tenantId, deletedAt: null,
        OR: [{ title: { contains: q, mode: 'insensitive' } }, { code: { contains: q, mode: 'insensitive' } }],
      },
      take: 20,
      select: { id: true, code: true, title: true, riskLevel: true },
    });
    return rows.map((r) => ({
      entityType: 'Risk', entityId: r.id,
      title: `${r.code} — ${r.title}`, url: '/riesgos', detail: `nivel ${r.riskLevel}`,
    }));
  },

  async snapshot(db, tenantId, entityId): Promise<SourceSnapshot | null> {
    const r = await db.risk.findFirst({
      where: { id: entityId, tenantId },
      select: { status: true, riskLevel: true, updatedAt: true },
    });
    if (!r) return null;
    return { type: 'Risk', id: entityId, updatedAt: r.updatedAt?.toISOString(), hash: itemHash(r) };
  },
};
