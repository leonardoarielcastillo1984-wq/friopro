// ──────────────────────────────────────────────────────────────
// Servicio de extracción de texto de documentos DOCX / DOC
// ──────────────────────────────────────────────────────────────

import mammoth from 'mammoth';
import { execFile, exec } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);

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

/**
 * Extrae texto de un buffer .doc (Word 97-2003 binario OLE) usando antiword.
 * Si antiword no está disponible, intenta con mammoth como fallback.
 */
export async function extractTextFromDoc(buffer: Buffer): Promise<string> {
  const tmpFile = path.join(os.tmpdir(), `doc_${Date.now()}_${Math.random().toString(36).slice(2)}.doc`);
  try {
    await fs.writeFile(tmpFile, buffer);
    const { stdout } = await execFileAsync('antiword', ['-w', '0', tmpFile], { timeout: 15000 });
    return stdout.trim();
  } catch (antiwordErr) {
    // Fallback: intentar con mammoth (funciona con algunos .doc)
    try {
      const result = await mammoth.extractRawText({ buffer });
      if (result.value && result.value.trim().length > 0) return result.value.trim();
    } catch {
      // ignorar
    }
    throw new Error(`No se pudo extraer texto del archivo .doc: ${(antiwordErr as Error).message}`);
  } finally {
    await fs.unlink(tmpFile).catch(() => null);
  }
}
