// ──────────────────────────────────────────────────────────────
// Jobs: Análisis de Auditoría IA
// ──────────────────────────────────────────────────────────────

import type { Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { createLLMProvider } from '../services/llm/factory.js';
import { AuditAnalysisService } from '../services/auditAnalysis.js';
// import { notifyTenantAdmins } from '../routes/notifications.js'; // Temporarily disabled
import { getStorage } from '../services/storage.js';
import { extractTextFromDocument, detectTypeByExtension } from '../services/textExtractor.js';

// ── Interfaces para Payloads ──

export interface ProcessDocumentVsNormaPayload {
  auditRunId: string;
  tenantId: string;
  documentId: string;
  normativeId: string;
}

export interface ProcessTenantAuditPayload {
  auditRunId: string;
  tenantId: string;
}

// ── Singleton instances ──

const prisma = new PrismaClient();

// Lazy-initialize LLM provider (avoids crash on startup if API key is missing)
let _auditService: AuditAnalysisService | null = null;
function getAuditService(): AuditAnalysisService {
  if (!_auditService) {
    const llmProvider = createLLMProvider();
    _auditService = new AuditAnalysisService(llmProvider);
  }
  return _auditService;
}

/**
 * Resuelve el contenido de texto de un documento:
 * 1. Si tiene `content` en la BD, usar directamente
 * 2. Si tiene `filePath`, descargar y extraer texto
 * 3. Fallback: string vacío (el LLM hará lo que pueda)
 */
async function resolveDocumentContent(doc: {
  content: string | null;
  filePath: string | null;
  title: string;
}): Promise<string> {
  if (doc.content && doc.content.trim().length > 0) {
    return doc.content;
  }

  if (doc.filePath) {
    try {
      const storage = getStorage();
      const buffer = await storage.download(doc.filePath);
      const mime = detectTypeByExtension(doc.filePath) || 'application/pdf';
      const text = await extractTextFromDocument(buffer, mime, doc.filePath);
      return text || '';
    } catch (err: any) {
      console.warn(`[resolveDocumentContent] Could not extract text from ${doc.filePath}: ${err.message}`);
    }
  }

  return '';
}

// ──────────────────────────────────────────────────────────────
// Job 1: Analizar documento contra normativa específica
// ──────────────────────────────────────────────────────────────

export async function processDocumentVsNormaJob(job: Job<ProcessDocumentVsNormaPayload>) {
  const { auditRunId, tenantId, documentId, normativeId } = job.data;

  try {
    // 1. Marcar como RUNNING
    await prisma.auditRun.update({
      where: { id: auditRunId },
      data: { status: 'RUNNING' },
    });
    await job.updateProgress(10);

    // 2. Cargar documento y normativa con cláusulas
    const [document, normative] = await Promise.all([
      prisma.document.findUniqueOrThrow({
        where: { id: documentId },
      }),
      prisma.normativeStandard.findUniqueOrThrow({
        where: { id: normativeId },
        include: {
          clauses: {
            where: { status: 'ACTIVE', deletedAt: null },
            orderBy: { extractionOrder: 'asc' },
          },
        },
      }),
    ]);
    await job.updateProgress(20);

    // 3. Extraer contenido del documento
    let documentContent: string;
    try {
      documentContent = await resolveDocumentContent(document);
      console.log(`[AuditWorker] Documento cargado: ${documentContent.length} caracteres`);
    } catch (err: any) {
      console.error('[AuditWorker] Error al cargar documento:', err.message);
      throw new Error(`No se pudo cargar el documento: ${err.message}`);
    }
    await job.updateProgress(40);

    // 4. Construir input de análisis
    const totalClausesCount = normative.clauses.length;
    const analysisInput = {
      documentTitle: document.title,
      documentContent,
      normativeCode: normative.code,
      normativeName: normative.name,
      clauses: normative.clauses.map((c) => ({
        id: c.id,
        clauseNumber: c.clauseNumber,
        title: c.title,
        content: c.content,
      })),
    };

    // Actualizar total de cláusulas
    await prisma.auditRun.update({
      where: { id: auditRunId },
      data: { totalClauses: totalClausesCount },
    });

    // Ejecutar análisis con callback de progreso
    let lastReportedProgress = 40;
    const analysisResult = await getAuditService().analyzeDocumentVsClauses(
      analysisInput,
      async (processed, total) => {
        // Calcular progreso: 40% base + (60% del análisis)
        const progressIncrement = Math.round((processed / total) * 50);
        const currentProgress = 40 + progressIncrement;
        
        // Solo actualizar si el progreso cambió significativamente
        if (currentProgress > lastReportedProgress) {
          lastReportedProgress = currentProgress;
          await prisma.auditRun.update({
            where: { id: auditRunId },
            data: { 
              coveredClauses: processed,
            },
          });
          await job.updateProgress(currentProgress);
          console.log(`[AuditWorker] Progreso: ${processed}/${total} cláusulas (${currentProgress}%)`);
        }
      }
    );
    await job.updateProgress(90);

    // 4. Crear registros AiFinding para hallazgos (solo gaps, covered=false)
    const findingsToCreate = analysisResult.findings
      .filter((f: any) => !f.covered) // Solo los no cubiertos
      .map((f: any) => ({
        tenantId,
        auditRunId,
        auditType: 'document_vs_norma' as const,
        documentId,
        normativeId,
        severity: f.severity,
        standard: normative.code,
        clause: f.clauseNumber,
        title: f.title,
        description: f.description,
        evidence: f.evidence || null,
        confidence: f.confidence,
        suggestedActions: f.suggestedActions,
        status: 'OPEN',
      }));

    if (findingsToCreate.length > 0) {
      await prisma.aiFinding.createMany({
        data: findingsToCreate as any,
      });
    }

    await job.updateProgress(80);

    // 5. Actualizar AuditRun con resultados consolidados
    await prisma.auditRun.update({
      where: { id: auditRunId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        totalClauses: analysisResult.findings.length,
        coveredClauses: analysisResult.coveredCount,
        missingClauses: analysisResult.missingCount,
        findingsCount: findingsToCreate.length,
      },
    });

    await job.updateProgress(100);

    // Notify admins - Temporarily disabled
    /*
    notifyTenantAdmins(prisma, tenantId, {
      type: 'AUDIT_COMPLETED',
      title: 'Auditoría completada',
      message: `Auditoría de "${document.title}" vs norma finalizada: ${findingsToCreate.length} hallazgo(s)`,
      link: `/audit/analyze?runId=${auditRunId}`,
      entityType: 'auditRun',
      entityId: auditRunId,
    });
    */

    return {
      success: true,
      auditRunId,
      totalClauses: analysisResult.findings.length,
      findingsCount: findingsToCreate.length,
    };
  } catch (error: any) {
    console.error(`[processDocumentVsNormaJob] Error processing ${auditRunId}:`, error.message);

    // Marcar como FAILED
    await prisma.auditRun
      .update({
        where: { id: auditRunId },
        data: {
          status: 'FAILED',
          error: error.message || 'Unknown error during analysis',
        },
      })
      .catch((updateErr: any) => {
        console.error('[processDocumentVsNormaJob] Failed to update error status:', updateErr.message);
      });

    throw error;
  }
}

// ──────────────────────────────────────────────────────────────
// Job 2: Auditoría completa del tenant (todos los docs vs todos los normativos)
// ──────────────────────────────────────────────────────────────

export async function processTenantAuditJob(job: Job<ProcessTenantAuditPayload>) {
  const { auditRunId, tenantId } = job.data;

  try {
    // 1. Marcar como RUNNING
    await prisma.auditRun.update({
      where: { id: auditRunId },
      data: { status: 'RUNNING' },
    });
    await job.updateProgress(5);

    // 2. Cargar TODOS los documentos y TODAS las normativas del tenant
    const [documents, normatives] = await Promise.all([
      prisma.document.findMany({
        where: {
          tenantId,
          deletedAt: null,
        },
      }),
      prisma.normativeStandard.findMany({
        where: {
          tenantId,
          deletedAt: null,
        },
        include: {
          clauses: {
            where: { status: 'ACTIVE', deletedAt: null },
            orderBy: { extractionOrder: 'asc' },
          },
        },
      }),
    ]);

    if (documents.length === 0 || normatives.length === 0) {
      await prisma.auditRun.update({
        where: { id: auditRunId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          totalClauses: 0,
          coveredClauses: 0,
          missingClauses: 0,
          findingsCount: 0,
        },
      });
      return {
        success: true,
        auditRunId,
        totalPairs: 0,
        totalFindings: 0,
      };
    }

    await job.updateProgress(10);

    // 3. Analizar cada par (documento, normativa)
    let totalFindings = 0;
    let totalClauses = 0;
    let coveredClauses = 0;
    const totalPairs = documents.length * normatives.length;
    let pairsProcessed = 0;

    for (const doc of documents) {
      const docContent = await resolveDocumentContent(doc);

      for (const norm of normatives) {
        const analysisInput = {
          documentTitle: doc.title,
          documentContent: docContent,
          normativeCode: norm.code,
          normativeName: norm.name,
          clauses: norm.clauses.map((c) => ({
            id: c.id,
            clauseNumber: c.clauseNumber,
            title: c.title,
            content: c.content,
          })),
        };

        // Ejecutar análisis
        const analysisResult = await getAuditService().analyzeDocumentVsClauses(analysisInput);

        // Crear findings para gaps
        const findingsToCreate = analysisResult.findings
          .filter((f: any) => !f.covered)
          .map((f: any) => ({
            tenantId,
            auditRunId,
            auditType: 'tenant_audit' as const,
            documentId: doc.id,
            normativeId: norm.id,
            severity: f.severity,
            standard: norm.code,
            clause: f.clauseNumber,
            title: f.title,
            description: f.description,
            evidence: f.evidence || null,
            confidence: f.confidence,
            suggestedActions: f.suggestedActions,
            status: 'OPEN',
          }));

        if (findingsToCreate.length > 0) {
          await prisma.aiFinding.createMany({
            data: findingsToCreate as any,
          });
          totalFindings += findingsToCreate.length;
        }

        // Actualizar contadores
        totalClauses += analysisResult.findings.length;
        coveredClauses += analysisResult.coveredCount;

        pairsProcessed++;
        const progress = Math.round(10 + (pairsProcessed / totalPairs) * 80);
        await job.updateProgress(progress);
      }
    }

    await job.updateProgress(90);

    // 4. Actualizar AuditRun con resultados consolidados
    await prisma.auditRun.update({
      where: { id: auditRunId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        totalClauses,
        coveredClauses,
        missingClauses: totalClauses - coveredClauses,
        findingsCount: totalFindings,
      },
    });

    await job.updateProgress(100);

    return {
      success: true,
      auditRunId,
      totalPairs,
      totalFindings,
    };
  } catch (error: any) {
    console.error(`[processTenantAuditJob] Error processing ${auditRunId}:`, error.message);

    // Marcar como FAILED
    await prisma.auditRun
      .update({
        where: { id: auditRunId },
        data: {
          status: 'FAILED',
          error: error.message || 'Unknown error during tenant audit',
        },
      })
      .catch((updateErr: any) => {
        console.error('[processTenantAuditJob] Failed to update error status:', updateErr.message);
      });

    throw error;
  }
}
