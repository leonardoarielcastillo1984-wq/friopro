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
   * Primero filtra cláusulas irrelevantes vía LLM, luego analiza solo las relevantes.
   */
  async analyzeDocumentVsClauses(
    input: DocumentAnalysisInput,
    onProgress?: (processed: number, total: number) => void
  ): Promise<DocumentAnalysisResult> {
    // Paso 1: Filtrar cláusulas relevantes según tipo de documento
    const relevantClauseNumbers = await this.filterRelevantClauses(input);
    const relevantClauses = input.clauses.filter((c) =>
      relevantClauseNumbers.includes(c.clauseNumber)
    );

    console.log(`[AuditAnalysis] Filtrado: ${relevantClauses.length}/${input.clauses.length} cláusulas relevantes para "${input.documentTitle}"`);

    if (relevantClauses.length === 0) {
      return {
        findings: [],
        summary: 'No se identificaron cláusulas relevantes para este tipo de documento.',
        coveredCount: 0,
        missingCount: 0,
      };
    }

    const filteredInput = { ...input, clauses: relevantClauses };

    // Paso 2: Analizar solo las cláusulas relevantes
    if (filteredInput.clauses.length > 25) {
      return this.analyzeInBatches(filteredInput, onProgress);
    }

    const result = await this.analyzeDirectly(filteredInput);
    onProgress?.(filteredInput.clauses.length, filteredInput.clauses.length);
    return result;
  }

  /**
   * Filtra cláusulas relevantes buscando palabras clave del título del documento
   * en título y contenido de cada cláusula. No usa LLM — es determinístico y preciso.
   * Ej: "Política de Seguridad Vial" → match con cláusula que contenga "política".
   */
  private filterRelevantClauses(input: DocumentAnalysisInput): string[] {
    const titleLower = input.documentTitle.toLowerCase();

    // Detectar el TIPO de documento por palabras clave identificadoras en el título
    // Solo usamos estas palabras, no palabras genéricas como "seguridad", "vial", "gestion"
    const typeKeywords: Record<string, string[]> = {
      // Política → capítulos que hablan de política, compromiso, dirección
      'politica': ['politica', 'política', 'policy', 'compromiso', 'liderazgo', 'direccion', 'dirección', 'top management'],
      'política': ['politica', 'política', 'policy', 'compromiso', 'liderazgo', 'direccion', 'dirección', 'top management'],

      // Procedimiento / Proceso
      'procedimiento': ['procedimiento', 'proceso', 'procesos', 'procedimientos', 'procedure', 'operacional'],
      'proceso': ['proceso', 'procesos', 'procedimiento', 'procedimientos', 'procedure', 'operacional'],

      // Incidente / No conformidad / Acción correctiva
      'incidente': ['incidente', 'incidentes', 'no conformidad', 'no conformidades', 'accion correctiva', 'acciones correctivas', 'no conforme', 'nonconformity', 'corrective action'],
      'accioncorrectiva': ['accion correctiva', 'acciones correctivas', 'incidente', 'incidentes', 'no conformidad', 'corrective'],
      'accióncorrectiva': ['accion correctiva', 'acciones correctivas', 'incidente', 'incidentes', 'no conformidad', 'corrective'],

      // Capacitación / Competencia / Formación
      'capacitacion': ['capacitacion', 'capacitación', 'formacion', 'formación', 'entrenamiento', 'competencia', 'competencias', 'training', 'awareness'],
      'competencia': ['competencia', 'competencias', 'capacitacion', 'capacitación', 'formacion', 'training'],

      // Riesgo / Peligro
      'riesgo': ['riesgo', 'riesgos', 'peligro', 'peligros', 'hazard', 'risk', 'evaluacion de riesgo', 'oportunidad', 'oportunidades'],

      // Partes interesadas / Stakeholders
      'parteinteresada': ['parteinteresada', 'partesinteresadas', 'stakeholder', 'interesados', 'parte interesada', 'partes interesadas'],

      // Auditoría
      'auditoria': ['auditoria', 'auditoría', 'auditorias', 'auditorías', 'audit', 'auditor interno', 'programa de auditoria'],
      'auditoría': ['auditoria', 'auditoría', 'auditorias', 'auditorías', 'audit'],

      // Documento / Registro / Información documentada
      'documento': ['documento', 'documentos', 'documentacion', 'documentación', 'documented', 'registro', 'registros', 'informacion documentada', 'información documentada', 'record'],
      'registro': ['registro', 'registros', 'documento', 'documentacion', 'record', 'informacion documentada'],

      // Mejora / Acción preventiva
      'mejora': ['mejora', 'mejoramiento', 'improvement', 'continua', 'preventiva', 'accion preventiva', 'acciones preventivas'],

      // Objetivo / Meta / Planificación
      'objetivo': ['objetivo', 'objetivos', 'meta', 'metas', 'planificacion', 'planificación', 'planificar', 'plan', 'plan de'],

      // Recursos / Infraestructura
      'recurso': ['recurso', 'recursos', 'infraestructura', 'infraestructuras', 'equipo', 'equipos', 'recursos humanos'],
      'infraestructura': ['infraestructura', 'infraestructuras', 'recurso', 'recursos', 'equipo'],

      // Comunicación / Información
      'comunicacion': ['comunicacion', 'comunicación', 'comunicar', 'informacion', 'información', 'external', 'internal'],
      'comunicación': ['comunicacion', 'comunicación', 'comunicar', 'informacion', 'información'],
    };

    // Buscar qué tipo de documento detectamos en el título
    const detectedTypes: string[] = [];
    for (const [typeKey, searchTerms] of Object.entries(typeKeywords)) {
      // Cualquiera de los términos de búsqueda aparece en el título?
      const titleHasMatch = searchTerms.some((term) =>
        titleLower.includes(term.toLowerCase())
      );
      if (titleHasMatch) {
        detectedTypes.push(typeKey);
      }
    }

    // Eliminar duplicados y extraer keywords únicos para buscar en cláusulas
    const searchKeywords = new Set<string>();
    for (const type of detectedTypes) {
      if (typeKeywords[type]) {
        typeKeywords[type].forEach((term) => searchKeywords.add(term.toLowerCase()));
      }
    }

    // Si no detectamos ningún tipo específico, fallback a todas las cláusulas
    if (searchKeywords.size === 0) {
      console.warn(`[AuditAnalysis] No document type detected in title "${input.documentTitle}", falling back to all ${input.clauses.length} clauses`);
      return input.clauses.map((c) => c.clauseNumber);
    }

    const keywordArray = Array.from(searchKeywords);
    console.log(`[AuditAnalysis] Document types detected: ${[...new Set(detectedTypes)].join(', ')}. Search keywords: ${keywordArray.join(', ')}`);

    const matched: string[] = [];
    for (const clause of input.clauses) {
      const clauseText = (clause.title + ' ' + clause.content).toLowerCase();
      const isRelevant = keywordArray.some((kw) => clauseText.includes(kw));
      if (isRelevant) {
        matched.push(clause.clauseNumber);
      }
    }

    // Fallback si no hay matches
    if (matched.length === 0) {
      console.warn(`[AuditAnalysis] No clause matches for detected types, falling back to all clauses`);
      return input.clauses.map((c) => c.clauseNumber);
    }

    console.log(`[AuditAnalysis] Matched ${matched.length} clauses: ${matched.join(', ')}`);
    return matched;
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
    ], 4096);

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
    const batchSize = 5;
    const batches: AnalysisFinding[][] = [];
    let processedCount = 0;
    const totalCount = input.clauses.length;

    // Crear lotes
    for (let i = 0; i < input.clauses.length; i += batchSize) {
      // Delay entre lotes para evitar rate limits de TPM (Groq free tier: 6000 TPM)
      if (i > 0) {
        await new Promise((resolve) => setTimeout(resolve, 15000));
      }

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
   * Prompt detallado para análisis profundo de cumplimiento.
   * Ahora que solo se analizan cláusulas vinculadas (5-15), podemos incluir
   * más contexto del documento y pedir análisis fundamentado con citas.
   */
  private buildAnalysisPrompt(input: DocumentAnalysisInput): string {
    const clausesList = input.clauses
      .map(
        (c) => `=== CLÁUSULA ${c.clauseNumber}: ${c.title} ===\n${c.content.substring(0, 600)}${c.content.length > 600 ? '...' : ''}`,
      )
      .join('\n\n');

    return `Actuá como auditor experto en ISO. Analizá el siguiente documento contra cada cláusula normativa vinculada.

DOCUMENTO A AUDITAR:
Título: ${input.documentTitle}
Contenido completo:
${input.documentContent.substring(0, 1500)}${input.documentContent.length > 1500 ? '...' : ''}

NORMA: ${input.normativeCode}

CLÁUSULAS A EVALUAR:
${clausesList}

INSTRUCCIONES DE ANÁLISIS PROFUNDO:
1. Leé cuidadosamente el documento completo.
2. Para CADA cláusula, determiná si el documento la CUBRE o NO.
3. Si CUBRE: citá textualmente del documento la evidencia que lo demuestra. Describí POR QUÉ cumple.
4. Si NO CUBRE: explicá QUÉ elemento de la cláusula falta en el documento. Sé específico.
5. La descripción debe tener al menos 2-3 oraciones explicando el fundamento del hallazgo.
6. Las acciones sugeridas deben ser concretas y aplicables (ej: "Incluir definición de responsables en la sección 3").
7. Confidence: 0.95 si hay evidencia textual clara, 0.7 si es inferencia, 0.5 si es ambiguo.

Formato de salida: JSON puro, sin markdown, sin bloques de código.
Cada "finding" debe incluir:
- clauseNumber: número exacto de la cláusula
- covered: true/false
- severity: MUST (obligatorio normativo) o SHOULD (recomendación)
- title: título conciso del hallazgo (máx 10 palabras)
- description: análisis detallado con fundamento (2-4 oraciones)
- evidence: cita textual del documento que justifica el hallazgo, o "No se encontró evidencia" si no cubre
- confidence: número 0.0-1.0
- suggestedActions: array de strings con acciones concretas (mínimo 1 si no cubre)

Output JSON: {"findings":[{"clauseNumber":"","covered":false,"severity":"MUST","title":"","description":"","evidence":"","confidence":0.8,"suggestedActions":["accion concreta 1","accion concreta 2"]}],"summary":"Resumen ejecutivo del análisis: cuántas cláusulas se cubren, cuáles no, y las principales brechas identificadas.","coveredCount":0,"missingCount":0}`;
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
        suggestedActions: Array.isArray(f.suggestedActions)
          ? f.suggestedActions
              .map((a: any) =>
                typeof a === 'string'
                  ? a
                  : a?.action || a?.text || a?.description || (typeof a === 'object' ? null : String(a))
              )
              .filter((a: any) => a && typeof a === 'string' && a.length > 0)
          : [],
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
