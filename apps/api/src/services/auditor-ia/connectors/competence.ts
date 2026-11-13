import { createHash } from 'node:crypto';
import type {
  EvidenceConnector, ConnectorContext, RequirementRef,
  CollectResult, EvidenceItem, SearchCandidate, SourceSnapshot,
} from './types.js';
import { MAX_ITEMS, hasModuleAccess, inPeriod, noPermission, queryError, trunc } from './types.js';

const KEY = 'competence';
const PERM = 'rrhh';

function itemHash(parts: string): string {
  return createHash('sha256').update(parts).digest('hex').slice(0, 16);
}

export const competenceConnector: EvidenceConnector = {
  key: KEY,
  label: 'Competencia y capacitación',
  permissionModule: PERM,

  async collect(ctx: ConnectorContext, _req: RequirementRef): Promise<CollectResult> {
    if (!hasModuleAccess(ctx.userPerms, PERM)) return noPermission(PERM);
    try {
      const [positions, gaps, trainings] = await Promise.all([
        ctx.db.position.findMany({
          where: { tenantId: ctx.tenantId, deletedAt: null },
          take: 20,
          select: {
            id: true, name: true, requirements: true,
            positionCompetencies: {
              select: { requiredLevel: true, competency: { select: { name: true } } },
            },
            _count: { select: { employees: true } },
          },
        }),
        // Brechas: competencias evaluadas por debajo del nivel requerido del puesto
        ctx.db.employeeCompetency.findMany({
          where: { currentLevel: { lte: 2 }, employee: { tenantId: ctx.tenantId } },
          take: 20,
          select: {
            id: true, currentLevel: true, assessedAt: true,
            competency: { select: { name: true } },
            employee: { select: { id: true } }, // sin nombres (datos personales)
          },
        }),
        ctx.db.sgiTraining.findMany({
          where: {
            tenantId: ctx.tenantId,
            deletedAt: null,
            status: { in: ['COMPLETED', 'SCHEDULED'] },
          },
          orderBy: { scheduledDate: 'desc' },
          take: 20,
          select: {
            id: true, code: true, title: true, status: true,
            scheduledDate: true, completedDate: true, updatedAt: true,
            _count: { select: { attendees: true } },
          },
        }),
      ]);

      const items: EvidenceItem[] = [];
      for (const p of positions.slice(0, 5)) {
        items.push({
          entityType: 'Position',
          entityId: p.id,
          title: `Puesto: ${p.name}`,
          url: '/rrhh',
          inPeriod: false, // requisito permanente, no datable
          summary: trunc(
            `Puesto "${p.name}" con ${p._count.employees} ocupantes. ` +
            `Requisitos: ${p.requirements.slice(0, 4).join(', ') || 'sin definir'}. ` +
            `Competencias requeridas: ${p.positionCompetencies
              .map((pc) => `${pc.competency.name} (${pc.requiredLevel}/5)`)
              .join(', ') || 'sin definir'}.`,
          ),
          hash: itemHash(`pos|${p.id}|${p.requirements.join()}|${p.positionCompetencies.length}`),
        });
      }
      for (const g of gaps.slice(0, 5)) {
        items.push({
          entityType: 'EmployeeCompetency',
          entityId: g.id,
          title: `Brecha de competencia: ${g.competency.name}`,
          updatedAt: g.assessedAt ?? undefined,
          url: '/rrhh',
          inPeriod: inPeriod(g.assessedAt, ctx.periodFrom, ctx.periodTo),
          summary: trunc(
            `Evaluación de competencia "${g.competency.name}": nivel actual ${g.currentLevel}/5` +
            `${g.assessedAt ? `, evaluada ${g.assessedAt.toISOString().slice(0, 10)}` : ''}. ` +
            `Nivel por debajo del umbral típico (2 o menos).`,
          ),
          hash: itemHash(`gap|${g.id}|${g.currentLevel}`),
        });
      }
      for (const t of trainings.slice(0, MAX_ITEMS - items.length)) {
        items.push({
          entityType: 'SgiTraining',
          entityId: t.id,
          title: `${t.code} — ${t.title}`,
          updatedAt: t.updatedAt,
          url: '/capacitaciones',
          inPeriod:
            inPeriod(t.scheduledDate, ctx.periodFrom, ctx.periodTo) ||
            inPeriod(t.completedDate, ctx.periodFrom, ctx.periodTo),
          summary: trunc(
            `Capacitación ${t.code} "${t.title}". Estado: ${t.status}. ` +
            `${t.scheduledDate ? `Programada ${t.scheduledDate.toISOString().slice(0, 10)}. ` : ''}` +
            `${t.completedDate ? `Completada ${t.completedDate.toISOString().slice(0, 10)}. ` : ''}` +
            `Asistentes: ${t._count.attendees}.`,
          ),
          hash: itemHash(`tr|${t.id}|${t.status}|${t.completedDate ?? ''}`),
        });
      }
      return { items, coverage: { queried: true, available: true, reason: items.length ? undefined : 'sin datos' } };
    } catch (e) {
      return queryError(e);
    }
  },

  async search(ctx: ConnectorContext, q: string): Promise<SearchCandidate[]> {
    const rows = await ctx.db.sgiTraining.findMany({
      where: {
        tenantId: ctx.tenantId, deletedAt: null,
        OR: [{ title: { contains: q, mode: 'insensitive' } }, { code: { contains: q, mode: 'insensitive' } }],
      },
      take: 20,
      select: { id: true, code: true, title: true, status: true },
    });
    return rows.map((r) => ({
      entityType: 'SgiTraining', entityId: r.id,
      title: `${r.code} — ${r.title}`, url: '/capacitaciones', detail: r.status,
    }));
  },

  async snapshot(db, tenantId, entityId): Promise<SourceSnapshot | null> {
    const t = await db.sgiTraining.findFirst({
      where: { id: entityId, tenantId },
      select: { status: true, updatedAt: true },
    });
    if (t) return { type: 'SgiTraining', id: entityId, updatedAt: t.updatedAt?.toISOString(), hash: itemHash(`tr|${t.status}`) };
    const p = await db.position.findFirst({
      where: { id: entityId, tenantId },
      select: { updatedAt: true },
    });
    if (!p) return null;
    return { type: 'Position', id: entityId, updatedAt: p.updatedAt?.toISOString(), hash: itemHash(`pos|${p.updatedAt?.toISOString()}`) };
  },
};
