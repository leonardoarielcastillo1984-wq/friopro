// ──────────────────────────────────────────────────────────────
// Servicio de extracción y parsing de PDFs normativos
// ──────────────────────────────────────────────────────────────

// @ts-ignore — pdf-parse v2 ESM has no default export but works at runtime
import pdf from 'pdf-parse';

export interface ParsedClause {
  clauseNumber: string;
  title: string;
  content: string;
  level: number;
  extractionOrder: number;
  pageNumber: number | null;
  parentClauseNumber: string | null;
  keywords: string[];
}

/**
 * Extrae texto plano de un buffer PDF.
 */
export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const data = await pdf(buffer);
  return data.text;
}

/**
 * Obtiene el número total de páginas del PDF.
 */
export async function getPdfPageCount(buffer: Buffer): Promise<number> {
  const data = await pdf(buffer);
  return data.numpages;
}

/**
 * Parsea el texto extraído de un PDF normativo y detecta cláusulas.
 *
 * Detecta patrones jerárquicos comunes en normas ISO/IATF:
 * - Secciones principales: "4 Contexto de la organización"
 * - Sub-secciones: "4.1 Comprensión de la organización"
 * - Sub-sub-secciones: "4.1.1 General"
 * - Anexos: "A.1", "B.2.3"
 */
export function parseClausesFromText(text: string): ParsedClause[] {
  const clauses: ParsedClause[] = [];
  const lines = text.split('\n');

  // Patrón para detectar encabezados de cláusula:
  // - Números: "4", "4.1", "4.1.1", "10.2.1"
  // - Anexos: "A.1", "B.2.3"
  const clauseHeaderPattern = /^([A-Z]?\d+(?:\.\d+)*)\s+(.+)$/;

  let currentClause: {
    number: string;
    title: string;
    contentLines: string[];
    startLine: number;
  } | null = null;

  let extractionOrder = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const match = line.match(clauseHeaderPattern);

    if (match) {
      // Si hay una cláusula acumulada, guardarla
      if (currentClause) {
        clauses.push(buildClause(currentClause, extractionOrder));
        extractionOrder++;
      }

      currentClause = {
        number: match[1],
        title: match[2].trim(),
        contentLines: [],
        startLine: i,
      };
    } else if (currentClause) {
      currentClause.contentLines.push(line);
    }
  }

  // Guardar la última cláusula
  if (currentClause) {
    clauses.push(buildClause(currentClause, extractionOrder));
  }

  // Resolver jerarquía parent-child
  resolveHierarchy(clauses);

  return clauses;
}

function buildClause(
  raw: { number: string; title: string; contentLines: string[]; startLine: number },
  order: number,
): ParsedClause {
  const content = raw.contentLines.join('\n').trim();
  const level = computeLevel(raw.number);
  const keywords = extractKeywords(raw.title + ' ' + content);

  return {
    clauseNumber: raw.number,
    title: raw.title,
    content: content || raw.title, // Si no hay contenido, usar el título
    level,
    extractionOrder: order,
    pageNumber: null, // Se puede mejorar con pdfjs-dist si se necesita
    parentClauseNumber: null, // Se resuelve después
    keywords,
  };
}

/**
 * Calcula el nivel jerárquico basado en el número de cláusula.
 * "4" → 0, "4.1" → 1, "4.1.1" → 2, "A.1" → 1
 */
function computeLevel(clauseNumber: string): number {
  const parts = clauseNumber.split('.');
  return parts.length - 1;
}

/**
 * Resuelve la relación parent-child entre cláusulas.
 * "4.1" tiene como padre "4", "4.1.1" tiene como padre "4.1", etc.
 */
function resolveHierarchy(clauses: ParsedClause[]): void {
  const clauseMap = new Map(clauses.map((c) => [c.clauseNumber, c]));

  for (const clause of clauses) {
    if (clause.level === 0) continue;

    // Buscar padre: para "4.1.1" → buscar "4.1", para "4.1" → buscar "4"
    const parts = clause.clauseNumber.split('.');
    parts.pop();
    const parentNumber = parts.join('.');

    if (parentNumber && clauseMap.has(parentNumber)) {
      clause.parentClauseNumber = parentNumber;
    }
  }
}

/**
 * Extrae palabras clave relevantes del texto (simplificado).
 * Filtra stop words y retorna las más frecuentes.
 */
function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del',
    'en', 'y', 'o', 'a', 'al', 'que', 'es', 'se', 'por', 'con', 'para',
    'su', 'sus', 'no', 'como', 'lo', 'más', 'este', 'esta', 'estos',
    'the', 'and', 'or', 'of', 'to', 'in', 'for', 'is', 'are', 'be',
    'that', 'this', 'with', 'on', 'at', 'by', 'an', 'it', 'as', 'from',
    'shall', 'should', 'must', 'can', 'may', 'will', 'not', 'its',
    'when', 'where', 'which', 'has', 'have', 'been', 'being',
  ]);

  const words = text
    .toLowerCase()
    .replace(/[^a-záéíóúñü\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stopWords.has(w));

  // Contar frecuencia
  const freq = new Map<string, number>();
  for (const w of words) {
    freq.set(w, (freq.get(w) || 0) + 1);
  }

  // Retornar top 10 por frecuencia
  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}
