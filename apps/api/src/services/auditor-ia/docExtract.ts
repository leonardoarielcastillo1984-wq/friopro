// ──────────────────────────────────────────────────────────────
// Auditor IA — caché de texto de documentos (AuditorDocExtract)
//
// Orden de fuentes de texto de un Document:
//   1. content / htmlContent ya almacenado (sin descarga)
//   2. adjunto filePath → descarga por storage + extracción según tipo
// El resultado se persiste con fileHash para no reprocesar. Si el
// documento cambia de versión/archivo, el hash difiere y se refresca.
// ──────────────────────────────────────────────────────────────

import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { extractTextFromDocument, detectTypeByExtension } from '../textExtractor.js';
import { getStorage } from '../storage.js';
import type { ConnectorDb } from './connectors/types.js';

const MAX_EXTRACT_CHARS = 200_000; // cota dura de almacenamiento

function hash(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface DocText {
  text: string;
  source: 'content' | 'file' | 'none';
  fileHash: string;
}

/**
 * Obtiene (o genera) el extracto de texto de un Document del tenant.
 * Devuelve null si el documento no existe o no tiene texto extraíble.
 */
export async function getDocumentText(
  db: ConnectorDb,
  tenantId: string,
  documentId: string,
): Promise<DocText | null> {
  const doc = await db.document.findFirst({
    where: { id: documentId, tenantId, deletedAt: null },
    select: {
      id: true,
      version: true,
      content: true,
      htmlContent: true,
      filePath: true,
      updatedAt: true,
    },
  });
  if (!doc) return null;

  // Identidad del contenido actual: versión + archivo + updatedAt.
  const identity = `v${doc.version}|${doc.filePath ?? 'inline'}|${doc.updatedAt?.toISOString() ?? ''}`;
  const fileHash = hash(identity);

  const cached = await db.auditorDocExtract.findUnique({
    where: { documentId: doc.id },
    select: { fileHash: true, text: true, pages: true },
  });
  if (cached && cached.fileHash === fileHash) {
    return { text: cached.text, source: doc.filePath ? 'file' : 'content', fileHash };
  }

  // 1) Texto ya almacenado en el propio documento
  let text = doc.content?.trim() || '';
  let source: DocText['source'] = 'content';
  if (!text && doc.htmlContent) {
    text = stripHtml(doc.htmlContent);
  }

  // 2) Adjunto
  if (!text && doc.filePath) {
    try {
      const buffer = await getStorage().download(doc.filePath);
      const mime = detectTypeByExtension(doc.filePath) ?? 'application/octet-stream';
      text = (await extractTextFromDocument(buffer, mime, doc.filePath)).trim();
      source = 'file';
    } catch {
      text = '';
      source = 'none';
    }
  }

  if (!text) {
    return { text: '', source: 'none', fileHash };
  }
  text = text.slice(0, MAX_EXTRACT_CHARS);

  await db.auditorDocExtract.upsert({
    where: { documentId: doc.id },
    create: {
      tenantId,
      documentId: doc.id,
      documentVersion: doc.version,
      fileHash,
      text,
      pages: Math.max(1, Math.ceil(text.length / 3000)),
    },
    update: {
      documentVersion: doc.version,
      fileHash,
      text,
      pages: Math.max(1, Math.ceil(text.length / 3000)),
    },
  });

  return { text, source, fileHash };
}
