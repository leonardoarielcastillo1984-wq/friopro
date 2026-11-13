// ──────────────────────────────────────────────────────────────
// Auditor IA — extracción de PDF normativo por página (spec §5)
//
// Usa la opción `pagerender` de pdf-parse 1.1.x para conservar el
// texto de cada página. Genera diagnóstico de legibilidad y
// persiste AuditorExtraction + AuditorSourcePage + requisitos
// fallback por cláusula (P2: propuesta IA llega en E4).
// ──────────────────────────────────────────────────────────────

// @ts-ignore — pdf-parse v2 ESM has no default export but works at runtime
import pdf from 'pdf-parse';
import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { suggestedConnectorKeys } from './connectors/seed-iso9001.js';

export interface ExtractedPage {
  page: number;
  text: string;
}

export interface ExtractionDiagnostics {
  textPages: number;
  emptyPages: number;
  totalChars: number;
  avgCharsPerPage: number;
  encrypted: boolean;
  reason?: string;
}

export type ExtractionVerdict = 'OK' | 'UNREADABLE';

const MIN_TOTAL_CHARS = 200;
const MIN_TEXT_PAGE_RATIO = 0.5;

/**
 * Extrae el texto página por página usando el hook `pagerender` de
 * pdf-parse. El hook se invoca por cada página en orden, así que
 * acumulamos el resultado con su número de página.
 */
export async function extractPagesFromPdf(buffer: Buffer): Promise<{
  pages: ExtractedPage[];
  pageCount: number;
  encrypted: boolean;
}> {
  const pages: ExtractedPage[] = [];
  let ordinal = 0;

  try {
    const data = await pdf(buffer, {
      // max 0 = todas las páginas
      max: 0,
      pagerender: async (pageData: {
        pageIndex: number;
        getTextContent: (opts: Record<string, unknown>) => Promise<{
          items: Array<{ str: string; transform: number[] }>;
        }>;
      }) => {
        ordinal += 1;
        const textContent = await pageData.getTextContent({
          normalizeWhitespace: false,
          disableCombineTextItems: false,
        });

        // Reconstrucción de líneas por coordenada Y (misma técnica que
        // el render por defecto de pdf-parse).
        let lastY: number | undefined;
        let text = '';
        for (const item of textContent.items) {
          const y = item.transform[5];
          if (lastY === y || lastY === undefined) {
            text += item.str;
          } else {
            text += '\n' + item.str;
          }
          lastY = y;
        }

        pages.push({ page: ordinal, text: text.trim() });
        return text;
      },
    });

    return {
      pages,
      pageCount: data.numpages ?? pages.length,
      encrypted: false,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const encrypted = /encrypt|password|decrypt/i.test(message);
    const err = new Error(message) as Error & { encrypted?: boolean };
    err.encrypted = encrypted;
    throw err;
  }
}

/** Diagnóstico de legibilidad según spec §5.2. */
export function diagnose(
  pages: ExtractedPage[],
  pageCount: number,
  encrypted: boolean,
): { verdict: ExtractionVerdict; diagnostics: ExtractionDiagnostics } {
  const textPages = pages.filter((p) => p.text.length > 0).length;
  const emptyPages = pages.length - textPages;
  const totalChars = pages.reduce((acc, p) => acc + p.text.length, 0);
  const avgCharsPerPage = pageCount > 0 ? Math.round(totalChars / pageCount) : 0;

  const diagnostics: ExtractionDiagnostics = {
    textPages,
    emptyPages,
    totalChars,
    avgCharsPerPage,
    encrypted,
  };

  if (encrypted) {
    diagnostics.reason = 'PDF cifrado o protegido con contraseña';
    return { verdict: 'UNREADABLE', diagnostics };
  }
  if (pageCount > 0 && textPages / pageCount < MIN_TEXT_PAGE_RATIO) {
    diagnostics.reason =
      'Menos de la mitad de las páginas contienen texto extraíble (posible escaneo)';
    return { verdict: 'UNREADABLE', diagnostics };
  }
  if (totalChars < MIN_TOTAL_CHARS) {
    diagnostics.reason = 'Texto extraído insuficiente para identificar requisitos';
    return { verdict: 'UNREADABLE', diagnostics };
  }

  return { verdict: 'OK', diagnostics };
}

export function sha256(text: string | Buffer): string {
  return createHash('sha256').update(text).digest('hex');
}

/**
 * Busca la página donde aparece el encabezado de una cláusula.
 * Heurística: `clauseNumber` seguido (en la misma línea o la página)
 * de las primeras palabras del título. Devuelve null si no se halla —
 * nunca se inventa una página.
 */
export function resolveClausePage(
  clauseNumber: string,
  clauseTitle: string,
  pages: ExtractedPage[],
): number | null {
  const titleWords = clauseTitle
    .toLowerCase()
    .replace(/[^a-záéíóúñü\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 3);

  const numberEscaped = clauseNumber.replace(/\./g, '\\.');
  const headerRe = new RegExp(`^\\s*${numberEscaped}[\\s.]+`, 'm');

  for (const { page, text } of pages) {
    if (!headerRe.test(text)) continue;
    // Si hay palabras del título, pedir que al menos una aparezca en la
    // página para reducir falsos positivos del índice.
    if (titleWords.length === 0) return page;
    const lower = text.toLowerCase();
    if (titleWords.some((w) => lower.includes(w))) return page;
  }
  return null;
}

/**
 * Requisitos fallback (CLAUSE_FALLBACK): uno por cláusula de nivel ≥1
 * con contenido suficiente. La propuesta IA los reemplaza/complementa
 * en E4; siempre quedan PROPOSED hasta decisión humana.
 */
export function requirementsFromClauses(
  clauses: Array<{
    id: string;
    clauseNumber: string;
    title: string;
    content: string;
    level: number;
    extractionOrder: number;
    pageNumber: number | null;
  }>,
  pages: ExtractedPage[],
): Array<{
  clauseId: string;
  code: string;
  clauseNumber: string;
  statement: string;
  verificationTypes: string[];
  connectorKeys: string[];
  page: number | null;
  requiresDocumentedInfo: boolean;
  origin: 'CLAUSE_FALLBACK';
  order: number;
}> {
  const out = [];
  for (const c of clauses) {
    if (c.level === 0) continue; // encabezados de capítulo no son requisitos
    const content = (c.content || '').trim();
    if (content.length < 30) continue;

    const statement =
      content.length <= 300 ? content : `${c.title} — ${content.slice(0, 260)}…`;
    const requiresDocumentedInfo =
      /informaci[oó]n documentada|documented information|mantener.*document|registro/i.test(
        content,
      );
    const page =
      c.pageNumber ?? resolveClausePage(c.clauseNumber, c.title, pages);

    out.push({
      clauseId: c.id,
      code: `${c.clauseNumber}-a`,
      clauseNumber: c.clauseNumber,
      statement: statement.slice(0, 300),
      verificationTypes: requiresDocumentedInfo
        ? ['DOCUMENT', 'RECORD']
        : ['RECORD', 'OBSERVATION'],
      connectorKeys: suggestedConnectorKeys(c.clauseNumber),
      page,
      requiresDocumentedInfo,
      origin: 'CLAUSE_FALLBACK' as const,
      order: c.extractionOrder,
    });
  }
  return out;
}

type Tx = Prisma.TransactionClient;

/**
 * Ejecuta la extracción completa dentro de una transacción:
 *  - crea la AuditorExtraction (o devuelve la existente por hash)
 *  - persiste páginas + diagnóstico
 *  - genera requisitos fallback PROPOSED
 *
 * `getBuffer` descarga el PDF (se inyecta para testabilidad).
 */
export async function runExtraction(args: {
  tx: Tx;
  tenantId: string;
  normativeId: string;
  userId?: string;
  getBuffer: () => Promise<Buffer>;
}): Promise<{ extractionId: string; status: string; reused: boolean }> {
  const { tx, tenantId, normativeId, userId, getBuffer } = args;

  const normative = await tx.normativeStandard.findFirst({
    where: { id: normativeId, tenantId, deletedAt: null },
    select: { id: true, filePath: true, fileHash: true, status: true },
  });
  if (!normative) {
    const err = new Error('Norma no encontrada') as Error & { statusCode?: number };
    err.statusCode = 404;
    throw err;
  }
  if (!normative.filePath || !normative.fileHash) {
    const err = new Error('La norma no tiene PDF (cargada desde plantilla)') as Error & {
      statusCode?: number;
    };
    err.statusCode = 422;
    throw err;
  }

  // Dedupe por huella: misma norma + mismo archivo
  const existing = await tx.auditorExtraction.findFirst({
    where: { normativeId, tenantId, fileHash: normative.fileHash },
    orderBy: { revision: 'desc' },
    select: { id: true, status: true },
  });
  if (existing && existing.status !== 'FAILED') {
    const err = new Error('Ya existe una extracción para esta versión del archivo') as Error & {
      statusCode?: number;
      extractionId?: string;
    };
    err.statusCode = 409;
    err.extractionId = existing.id;
    throw err;
  }

  const lastRevision = await tx.auditorExtraction.findFirst({
    where: { normativeId, tenantId },
    orderBy: { revision: 'desc' },
    select: { revision: true },
  });
  const revision = (lastRevision?.revision ?? 0) + 1;

  const extraction = await tx.auditorExtraction.create({
    data: {
      tenantId,
      normativeId,
      fileHash: normative.fileHash,
      revision,
      status: 'EXTRACTING',
      createdById: userId,
    },
  });

  try {
    const buffer = await getBuffer();
    const { pages, pageCount, encrypted } = await extractPagesFromPdf(buffer);
    const { verdict, diagnostics } = diagnose(pages, pageCount, encrypted);

    if (verdict === 'UNREADABLE') {
      await tx.auditorExtraction.update({
        where: { id: extraction.id },
        data: {
          status: 'UNREADABLE',
          pageCount,
          diagnostics: diagnostics as unknown as Prisma.InputJsonValue,
        },
      });
      return { extractionId: extraction.id, status: 'UNREADABLE', reused: false };
    }

    // Persistir páginas (batch)
    await tx.auditorSourcePage.createMany({
      data: pages.map((p) => ({
        tenantId,
        extractionId: extraction.id,
        page: p.page,
        text: p.text,
        textHash: sha256(p.text),
      })),
    });

    // Requisitos fallback desde NormativeClause
    const clauses = await tx.normativeClause.findMany({
      where: { normativeId, deletedAt: null, status: 'ACTIVE' },
      orderBy: { extractionOrder: 'asc' },
      select: {
        id: true,
        clauseNumber: true,
        title: true,
        content: true,
        level: true,
        extractionOrder: true,
        pageNumber: true,
      },
    });
    const requirements = requirementsFromClauses(clauses, pages);
    if (requirements.length > 0) {
      await tx.auditorRequirement.createMany({
        data: requirements.map((r) => ({
          tenantId,
          extractionId: extraction.id,
          ...r,
        })),
      });
    }

    await tx.auditorExtraction.update({
      where: { id: extraction.id },
      data: {
        status: 'PENDING_APPROVAL',
        pageCount,
        diagnostics: diagnostics as unknown as Prisma.InputJsonValue,
      },
    });

    return { extractionId: extraction.id, status: 'PENDING_APPROVAL', reused: false };
  } catch (error) {
    const e = error as Error & { encrypted?: boolean };
    await tx.auditorExtraction.update({
      where: { id: extraction.id },
      data: {
        status: e.encrypted ? 'UNREADABLE' : 'FAILED',
        error: e.message?.slice(0, 500),
        diagnostics: { encrypted: e.encrypted ?? false } as Prisma.InputJsonValue,
      },
    });
    return {
      extractionId: extraction.id,
      status: e.encrypted ? 'UNREADABLE' : 'FAILED',
      reused: false,
    };
  }
}
