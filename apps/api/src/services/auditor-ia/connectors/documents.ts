import { createHash } from 'node:crypto';
import type {
  EvidenceConnector, ConnectorContext, RequirementRef,
  CollectResult, EvidenceItem, SearchCandidate, SourceSnapshot,
} from './types.js';
import { MAX_ITEMS, hasModuleAccess, inPeriod, noPermission, queryError, trunc } from './types.js';
import { getDocumentText } from '../docExtract.js';

const KEY = 'documents';
const PERM = 'documents';

function itemHash(d: { status: string; version: number; updatedAt?: Date | null }): string {
  return createHash('sha256')
    .update(`${d.status}|v${d.version}|${d.updatedAt?.toISOString() ?? ''}`)
    .digest('hex')
    .slice(0, 16);
}

const MAX_SNIPPET = 400;

// Palabras vacías frecuentes en enunciados de normas: no aportan
// señal a la búsqueda por título y generan falsos positivos.
const STOPWORDS = new Set([
  'organización', 'debe', 'deben', 'deberá', 'tener', 'cuenta',
  'asegurar', 'asegurarse', 'determinar', 'establecer', 'mantener',
  'conservar', 'realizar', 'cuando', 'donde', 'según', 'sobre',
  'entre', 'para', 'como', 'esto', 'estos', 'estas', 'todas',
  'todos', 'parte', 'partes', 'forma', 'medida', 'necesario',
  'necesarios', 'pertinente', 'pertinentes', 'aplicable', 'aplicables',
]);

/** Busca el fragmento más relevante del texto para el requisito. */
function bestSnippet(text: string, requirement: RequirementRef): string {
  const lower = text.toLowerCase();
  const titleWords = requirement.statement
    .toLowerCase()
    .replace(/[^a-záéíóúñü\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 4)
    .slice(0, 6);
  let bestIdx = -1;
  let bestScore = 0;
  const hay = titleWords.length ? titleWords : [requirement.clauseNumber];
  for (const w of hay) {
    const idx = lower.indexOf(w);
    if (idx >= 0) {
      const score = w.length;
      if (score > bestScore) { bestScore = score; bestIdx = idx; }
    }
  }
  if (bestIdx < 0) return trunc(text, MAX_SNIPPET);
  const start = Math.max(0, bestIdx - MAX_SNIPPET / 2);
  return trunc(text.slice(start, start + MAX_SNIPPET * 1.5), MAX_SNIPPET);
}

export const documentsConnector: EvidenceConnector = {
  key: KEY,
  label: 'Documentos del SGI',
  permissionModule: PERM,

  async collect(ctx: ConnectorContext, requirement: RequirementRef): Promise<CollectResult> {
    if (!hasModuleAccess(ctx.userPerms, PERM)) return noPermission(PERM);
    try {
      // 1) Documentos mapeados a la cláusula (DocumentClauseMapping).
      // El mapping no tiene tenantId propio: se filtra por document/clause.
      // clause.normativeId evita mezclar cláusulas homónimas de otras
      // normas; NO_APLICA no aporta evidencia de cumplimiento.
      const mappings = await ctx.db.documentClauseMapping.findMany({
        where: {
          deletedAt: null,
          complianceType: { not: 'NO_APLICA' },
          document: { tenantId: ctx.tenantId, deletedAt: null },
          clause: {
            clauseNumber: requirement.clauseNumber,
            deletedAt: null,
            ...(ctx.normativeId ? { normativeId: ctx.normativeId } : {}),
          },
        },
        select: { documentId: true },
      });
      const mappedIds = mappings.map((m) => m.documentId);

      // 2) Búsqueda por texto: términos del statement sobre título/código.
      // En modo relaxed (segunda pasada autónoma) se amplía: más términos,
      // documentCode por número de cláusula y contenido del documento.
      const terms = requirement.statement
        .toLowerCase()
        .replace(/[^a-záéíóúñü\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > (ctx.relaxed ? 4 : 5) && !STOPWORDS.has(w))
        .slice(0, ctx.relaxed ? 6 : 3);

      const docs = await ctx.db.document.findMany({
        where: {
          tenantId: ctx.tenantId,
          deletedAt: null,
          status: { in: ['EFFECTIVE', 'REVIEW'] },
          OR: [
            { id: { in: mappedIds.length ? mappedIds : ['00000000-0000-0000-0000-000000000000'] } },
            ...(ctx.relaxed
              ? [{ documentCode: { contains: requirement.clauseNumber, mode: 'insensitive' as const } }]
              : []),
            ...(terms.length
              ? terms.map((t) => ({ title: { contains: t, mode: 'insensitive' as const } }))
              : []),
            ...(ctx.relaxed && terms.length
              ? terms.slice(0, 3).map((t) => ({ content: { contains: t, mode: 'insensitive' as const } }))
              : []),
          ],
        },
        orderBy: { updatedAt: 'desc' },
        take: 60,
        select: {
          id: true, title: true, documentCode: true, type: true, status: true,
          version: true, filePath: true, approvedAt: true, reviewDate: true,
          nextReviewDate: true, updatedAt: true, content: true,
        },
      });

      // Los documentos mapeados a la cláusula van primero: son
      // evidencia curada, más relevante que un match de texto.
      const mappedSet = new Set(mappedIds);
      docs.sort((a, b) => Number(mappedSet.has(b.id)) - Number(mappedSet.has(a.id)));

      const items: EvidenceItem[] = [];
      for (const d of docs.slice(0, MAX_ITEMS)) {
        const docText = await getDocumentText(ctx.db, ctx.tenantId, d.id);
        const snippet = docText?.text
          ? bestSnippet(docText.text, requirement)
          : trunc(d.content ?? '', MAX_SNIPPET);
        items.push({
          entityType: 'Document',
          entityId: d.id,
          title: `${d.documentCode ?? ''} ${d.title}`.trim(),
          version: `v${d.version}`,
          updatedAt: d.updatedAt,
          url: `/documents/${d.id}`,
          inPeriod:
            inPeriod(d.approvedAt, ctx.periodFrom, ctx.periodTo) ||
            inPeriod(d.reviewDate, ctx.periodFrom, ctx.periodTo) ||
            inPeriod(d.updatedAt, ctx.periodFrom, ctx.periodTo),
          summary: trunc(
            `Documento ${d.type} "${d.title}" v${d.version}, estado ${d.status}. ` +
            `${d.approvedAt ? `Aprobado ${d.approvedAt.toISOString().slice(0, 10)}. ` : 'Sin aprobación. '}` +
            `${d.nextReviewDate ? `Próxima revisión ${d.nextReviewDate.toISOString().slice(0, 10)}. ` : ''}` +
            `Fragmento: ${snippet}`,
          ),
          hash: itemHash(d),
        });
      }
      return { items, coverage: { queried: true, available: true, reason: items.length ? undefined : 'sin datos' } };
    } catch (e) {
      return queryError(e);
    }
  },

  async search(ctx: ConnectorContext, q: string): Promise<SearchCandidate[]> {
    const rows = await ctx.db.document.findMany({
      where: {
        tenantId: ctx.tenantId, deletedAt: null,
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { documentCode: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: 20,
      select: { id: true, title: true, documentCode: true, status: true, version: true },
    });
    return rows.map((r) => ({
      entityType: 'Document', entityId: r.id,
      title: `${r.documentCode ?? ''} ${r.title}`.trim(),
      url: `/documents/${r.id}`, detail: `v${r.version} ${r.status}`,
    }));
  },

  async snapshot(db, tenantId, entityId): Promise<SourceSnapshot | null> {
    const d = await db.document.findFirst({
      where: { id: entityId, tenantId },
      select: { status: true, version: true, updatedAt: true },
    });
    if (!d) return null;
    return { type: 'Document', id: entityId, updatedAt: d.updatedAt?.toISOString(), hash: itemHash(d) };
  },
};
