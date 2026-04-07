// ──────────────────────────────────────────────────────────────
// Job: Procesar PDF de norma subida
// ──────────────────────────────────────────────────────────────

import type { Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { getStorage } from '../services/storage.js';
import { extractTextFromPdf, parseClausesFromText } from '../services/pdfParser.js';

export interface ProcessNormativePayload {
  normativeId: string;
  tenantId: string;
  filePath: string;
}

// Prisma client propio para el worker (no comparte el de Fastify)
const prisma = new PrismaClient();

export async function processNormativeJob(job: Job<ProcessNormativePayload>) {
  const { normativeId, tenantId, filePath } = job.data;

  try {
    // 1. Marcar como PROCESSING
    await prisma.normativeStandard.update({
      where: { id: normativeId },
      data: {
        status: 'PROCESSING',
        processingJobId: job.id,
        errorMessage: null,
      },
    });
    await job.updateProgress(10);

    // 2. Descargar el PDF del storage
    const storage = getStorage();
    const pdfBuffer = await storage.download(filePath);
    await job.updateProgress(20);

    // 3. Extraer texto del PDF
    const text = await extractTextFromPdf(pdfBuffer);
    if (!text || text.trim().length === 0) {
      throw new Error('No se pudo extraer texto del PDF. El archivo puede estar escaneado o vacío.');
    }
    await job.updateProgress(40);

    // 4. Parsear cláusulas y deduplicar por clauseNumber
    const rawClauses = parseClausesFromText(text);
    if (rawClauses.length === 0) {
      throw new Error(
        'No se detectaron cláusulas en el PDF. Verifique que el documento tenga estructura de cláusulas numeradas.',
      );
    }

    // Deduplicar: si hay clauseNumber repetido, quedarse con la versión que tiene más contenido
    const clauseMap = new Map<string, typeof rawClauses[0]>();
    for (const clause of rawClauses) {
      const existing = clauseMap.get(clause.clauseNumber);
      if (!existing || clause.content.length > existing.content.length) {
        clauseMap.set(clause.clauseNumber, clause);
      }
    }
    const parsedClauses = Array.from(clauseMap.values())
      .sort((a, b) => a.extractionOrder - b.extractionOrder);

    console.log(`[processNormativeJob] Parsed ${rawClauses.length} raw clauses, ${parsedClauses.length} unique for ${normativeId}`);
    await job.updateProgress(60);

    // 5. Guardar cláusulas en BD (transaction)
    await prisma.$transaction(async (tx) => {
      // Limpiar cláusulas previas (por si es un reintento)
      await tx.normativeClause.deleteMany({ where: { normativeId } });

      // Primero: crear cláusulas sin parentClauseId
      const clauseIdMap = new Map<string, string>();

      for (const clause of parsedClauses) {
        const created = await tx.normativeClause.create({
          data: {
            normativeId,
            clauseNumber: clause.clauseNumber,
            title: clause.title,
            content: clause.content,
            level: clause.level,
            extractionOrder: clause.extractionOrder,
            pageNumber: clause.pageNumber,
            keywords: clause.keywords,
            status: 'ACTIVE',
          },
        });
        clauseIdMap.set(clause.clauseNumber, created.id);
      }

      // Segundo: resolver parentClauseId
      for (const clause of parsedClauses) {
        if (clause.parentClauseNumber) {
          const parentId = clauseIdMap.get(clause.parentClauseNumber);
          const clauseId = clauseIdMap.get(clause.clauseNumber);
          if (parentId && clauseId) {
            await tx.normativeClause.update({
              where: { id: clauseId },
              data: { parentClauseId: parentId },
            });
          }
        }
      }

      // Tercero: actualizar NormativeStandard
      await tx.normativeStandard.update({
        where: { id: normativeId },
        data: {
          status: 'READY',
          totalClauses: parsedClauses.length,
          extractedAt: new Date(),
          errorMessage: null,
        },
      });
    });

    await job.updateProgress(100);

    return {
      success: true,
      normativeId,
      clausesCount: parsedClauses.length,
    };
  } catch (error: any) {
    console.error(`[processNormativeJob] Error processing ${normativeId}:`, error.message);

    // Marcar como ERROR
    await prisma.normativeStandard
      .update({
        where: { id: normativeId },
        data: {
          status: 'ERROR',
          errorMessage: error.message || 'Error desconocido durante el procesamiento',
        },
      })
      .catch((updateErr: any) => {
        console.error('[processNormativeJob] Failed to update error status:', updateErr.message);
      });

    throw error;
  }
}
