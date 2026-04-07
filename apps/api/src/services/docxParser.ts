// ──────────────────────────────────────────────────────────────
// Servicio de extracción de texto de documentos DOCX
// ──────────────────────────────────────────────────────────────

import mammoth from 'mammoth';

/**
 * Extrae texto plano de un buffer DOCX.
 */
export async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

/**
 * Extrae texto plano de un buffer DOCX con opciones.
 */
export async function extractTextFromDocxWithHtml(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}
