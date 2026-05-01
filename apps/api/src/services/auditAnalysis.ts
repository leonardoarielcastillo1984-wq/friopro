// ──────────────────────────────────────────────────────────────
// Servicio de Análisis de Auditoría IA
// ──────────────────────────────────────────────────────────────

import type { LLMProvider } from './llm/types.js';

export interface DocumentAnalysisInput {
  documentTitle: string;
  documentContent: string;
  normativeCode: string;
  normativeName: string;
  clauses: Array<{
    id: string;
    clauseNumber: string;
    title: string;
    content: string;
  }>;
}

export interface AnalysisFinding {
  clauseNumber: string;
  covered: boolean;
  severity: 'MUST' | 'SHOULD';
  title: string;
  description: string;
  evidence: string;
  confidence: number;
  suggestedActions: string[];
}

export interface DocumentAnalysisResult {
  findings: AnalysisFinding[];
  summary: string;
  coveredCount: number;
  missingCount: number;
}

export class AuditAnalysisService {
  constructor(private llm: LLMProvider) {}

  /**
   * Analiza un documento contra un conjunto de cláusulas normativas.
   * Si hay >25 cláusulas, las divide en lotes de 15 para análisis independientes.
   */
  async analyzeDocumentVsClauses(
    input: DocumentAnalysisInput,
    onProgress?: (processed: number, total: number) => void
  ): Promise<DocumentAnalysisResult> {
    // Si hay muchas cláusulas, dividir en lotes
    if (input.clauses.length > 25) {
      return this.analyzeInBatches(input, onProgress);
    }

    const result = await this.analyzeDirectly(input);
    onProgress?.(input.clauses.length, input.clauses.length);
    return result;
  }

  /**
   * Realiza análisis directo (sin batches)
   */
  private async analyzeDirectly(input: DocumentAnalysisInput): Promise<DocumentAnalysisResult> {
    const prompt = this.buildAnalysisPrompt(input);

    const response = await this.llm.chat([
      {
        role: 'user',
        content: prompt,
      },
    ]);

    console.log(`[AuditAnalysis] Raw LLM response length: ${response.text?.length || 0}, preview: ${(response.text || '').substring(0, 200)}...`);
    const result = this.parseAnalysisResponse(response.text);
    console.log(`[AuditAnalysis] Parsed ${result.findings.length} findings, covered=${result.coveredCount}, missing=${result.missingCount}`);
    return result;
  }

  /**
   * Divide el análisis en lotes de 15 cláusulas cada uno, luego fusiona resultados
   */
  private async analyzeInBatches(
    input: DocumentAnalysisInput,
    onProgress?: (processed: number, total: number) => void
  ): Promise<DocumentAnalysisResult> {
    const batchSize = 15;
    const batches: AnalysisFinding[][] = [];
    let processedCount = 0;
    const totalCount = input.clauses.length;

    // Crear lotes
    for (let i = 0; i < input.clauses.length; i += batchSize) {
      const batchClauses = input.clauses.slice(i, i + batchSize);
      const batchInput = {
        ...input,
        clauses: batchClauses,
      };

      const batchResult = await this.analyzeDirectly(batchInput);
      batches.push(batchResult.findings);
      
      // Reportar progreso
      processedCount += batchClauses.length;
      onProgress?.(processedCount, totalCount);
    }

    // Fusionar resultados
    const allFindings = batches.flat();
    const coveredCount = allFindings.filter((f) => f.covered).length;
    const missingCount = allFindings.filter((f) => !f.covered).length;

    const summary = `Análisis completado en ${batches.length} lotes. ${coveredCount} cláusulas cubiertas, ${missingCount} con hallazgos.`;

    return {
      findings: allFindings,
      summary,
      coveredCount,
      missingCount,
    };
  }

  /**
   * Construye el prompt estructurado para el análisis
   */
  private buildAnalysisPrompt(input: DocumentAnalysisInput): string {
    const clausesList = input.clauses
      .map(
        (c) => `
Cláusula ${c.clauseNumber}: ${c.title}
Contenido: ${c.content.substring(0, 500)}${c.content.length > 500 ? '...' : ''}`,
      )
      .join('\n---\n');

    return `Eres un auditor experto en cumplimiento normativo ISO/IATF. Analiza el siguiente documento contra las cláusulas normativas proporcionadas.

DOCUMENTO:
Título: ${input.documentTitle}
Contenido: ${input.documentContent.substring(0, 2000)}${input.documentContent.length > 2000 ? '...' : ''}

NORMA: ${input.normativeName} (${input.normativeCode})
CLÁUSULAS A EVALUAR:
${clausesList}

Para cada cláusula, determina:
1. ¿El documento cubre o implementa esta cláusula? (covered: boolean)
2. Severidad del requisito: MUST (obligatorio) o SHOULD (recomendado)
3. Título descriptivo del hallazgo
4. Descripción del análisis
5. Evidencia encontrada en el documento (o indicar ausencia)
6. Confianza del análisis (0.0-1.0)
7. Acciones sugeridas si hay brecha

Responde EXACTAMENTE en este formato JSON (sin markdown, sin bloques de código):
{
  "findings": [
    {
      "clauseNumber": "4.1",
      "covered": true,
      "severity": "MUST",
      "title": "Descripción breve",
      "description": "Análisis detallado",
      "evidence": "Texto extraído del documento",
      "confidence": 0.95,
      "suggestedActions": ["Acción 1", "Acción 2"]
    }
  ],
  "summary": "Resumen general del análisis",
  "coveredCount": 5,
  "missingCount": 2
}`;
  }

  /**
   * Parsea robustamente la respuesta JSON del LLM
   */
  private parseAnalysisResponse(text: string): DocumentAnalysisResult {
    try {
      const raw = text || '';

      // Strategy 1: Try markdown code block ```json ... ```
      const codeBlockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) {
        try {
          const parsed = JSON.parse(codeBlockMatch[1].trim());
          return this.validateAndNormalizeResult(parsed);
        } catch (e) {
          console.log('[AuditAnalysis] Markdown block parse failed, trying next strategy');
        }
      }

      // Strategy 2: Find first { to last } (greedy)
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          return this.validateAndNormalizeResult(parsed);
        } catch (e) {
          console.log('[AuditAnalysis] Greedy JSON parse failed, trying next strategy');
        }
      }

      // Strategy 3: Try to find JSON by looking for the findings array
      const findingsMatch = raw.match(/"findings"\s*:\s*(\[[\s\S]*?\])/);
      if (findingsMatch) {
        try {
          const findings = JSON.parse(findingsMatch[1]);
          const summaryMatch = raw.match(/"summary"\s*:\s*"([^"]+)"/);
          return this.validateAndNormalizeResult({
            findings,
            summary: summaryMatch ? summaryMatch[1] : 'Analysis completed',
          });
        } catch (e) {
          console.log('[AuditAnalysis] Findings-only parse failed');
        }
      }

      console.error('[AuditAnalysis] All JSON parsing strategies failed. Raw response:', raw.substring(0, 500));
      return {
        findings: [],
        summary: 'Error: LLM response not in expected JSON format',
        coveredCount: 0,
        missingCount: 0,
      };
    } catch (error: any) {
      console.error('[AuditAnalysis] Unexpected parse error:', error.message);
      return {
        findings: [],
        summary: 'Error during analysis',
        coveredCount: 0,
        missingCount: 0,
      };
    }
  }

  /**
   * Valida y normaliza el resultado del análisis
   */
  private validateAndNormalizeResult(data: any): DocumentAnalysisResult {
    const findings: AnalysisFinding[] = (data.findings || [])
      .filter((f: any) => f && typeof f === 'object')
      .map((f: any) => ({
        clauseNumber: String(f.clauseNumber || ''),
        covered: Boolean(f.covered),
        severity: (['MUST', 'SHOULD'].includes(f.severity) ? f.severity : 'SHOULD') as 'MUST' | 'SHOULD',
        title: String(f.title || ''),
        description: String(f.description || ''),
        evidence: String(f.evidence || ''),
        confidence: Math.min(1, Math.max(0, Number(f.confidence) || 0)),
        suggestedActions: Array.isArray(f.suggestedActions) ? f.suggestedActions.map(String) : [],
      }));

    const coveredCount = findings.filter((f) => f.covered).length;
    const missingCount = findings.filter((f) => !f.covered).length;

    return {
      findings,
      summary: String(data.summary || 'Analysis completed'),
      coveredCount,
      missingCount,
    };
  }

  /**
   * Construye contexto para el chat auditor
   */
  buildChatContext(
    documents: Array<{ title: string; type: string }>,
    normatives: Array<{ name: string; code: string; clauseCount: number }>,
  ): string {
    const docContext =
      documents.length > 0
        ? `DOCUMENTOS DISPONIBLES:\n${documents.map((d) => `- ${d.title} (${d.type})`).join('\n')}`
        : 'No hay documentos disponibles';

    const normContext =
      normatives.length > 0
        ? `NORMAS DISPONIBLES:\n${normatives.map((n) => `- ${n.name} (${n.code}, ${n.clauseCount} cláusulas)`).join('\n')}`
        : 'No hay normas disponibles';

    return `${docContext}\n\n${normContext}\n\nUsa esta información para contextualizar tus respuestas sobre auditoría y cumplimiento normativo.`;
  }
}
