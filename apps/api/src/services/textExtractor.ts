// ──────────────────────────────────────────────────────────────
// Servicio de extracción de texto de documentos (PDF, DOCX, XLSX)
// ──────────────────────────────────────────────────────────────

// @ts-ignore — pdf-parse v2 ESM has no default export but works at runtime
import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';

export type SupportedMime =
  | 'application/pdf'
  | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  | 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  | 'application/vnd.ms-excel';

const SUPPORTED_MIMES: string[] = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
];

/**
 * Verifica si el MIME type es soportado para extracción de texto.
 */
export function isSupportedMime(mime: string): boolean {
  return SUPPORTED_MIMES.includes(mime);
}

/**
 * Detecta el tipo de archivo por extensión (fallback si el MIME no es confiable).
 */
export function detectTypeByExtension(filename: string): string | null {
  const ext = filename.toLowerCase().split('.').pop();
  switch (ext) {
    case 'pdf':
      return 'application/pdf';
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'xls':
      return 'application/vnd.ms-excel';
    default:
      return null;
  }
}

/**
 * Extrae texto plano de un buffer de documento.
 * Soporta PDF, DOCX y XLSX/XLS.
 */
export async function extractTextFromDocument(
  buffer: Buffer,
  mimeType: string,
  filename: string,
): Promise<string> {
  // Use extension-based detection as fallback
  const effectiveMime = isSupportedMime(mimeType)
    ? mimeType
    : detectTypeByExtension(filename) ?? mimeType;

  switch (effectiveMime) {
    case 'application/pdf':
      return extractFromPdf(buffer);
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return extractFromDocx(buffer);
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
    case 'application/vnd.ms-excel':
      return extractFromXlsx(buffer);
    default:
      throw new Error(`Formato no soportado: ${effectiveMime}`);
  }
}

// ── PDF ──
async function extractFromPdf(buffer: Buffer): Promise<string> {
  const data = await pdf(buffer);
  return data.text;
}

// ── DOCX (Word) ──
async function extractFromDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

// ── XLSX/XLS (Excel) ──
function extractFromXlsx(buffer: Buffer): string {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const lines: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    lines.push(`--- Hoja: ${sheetName} ---`);

    // Convert sheet to array of arrays
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: '',
    });

    for (const row of rows) {
      const text = row
        .map((cell: any) => (cell != null ? String(cell).trim() : ''))
        .filter((cell: string) => cell.length > 0)
        .join(' | ');
      if (text) lines.push(text);
    }

    lines.push(''); // blank line between sheets
  }

  return lines.join('\n').trim();
}

/**
 * Retorna las extensiones de archivo aceptadas para el input HTML.
 */
export const ACCEPTED_EXTENSIONS = '.pdf,.docx,.xlsx,.xls';

/**
 * Retorna los MIME types aceptados para el input HTML.
 */
export const ACCEPTED_MIMES =
  'application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel';
