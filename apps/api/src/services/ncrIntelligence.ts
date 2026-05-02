import { createLLMProvider } from './llm/factory.js';
import type { PrismaClient } from '@prisma/client';

export interface NCRRiskAnalysisInput {
  ncrId: string;
  title: string;
  description: string;
  severity: string;
  processName?: string | null;
  standard?: string | null;
  rootCause?: string | null;
  // Historial de NCRs similares en este proceso
  similarNCRCount: number;
  processNCRHistory: Array<{
    id: string;
    title: string;
    severity: string;
    detectedAt: Date;
  }>;
}

export interface NCRRiskAnalysisResult {
  shouldCreateRisk: boolean;
  confidence: number; // 0-1
  suggestedProbability: number; // 1-5
  suggestedImpact: number; // 1-5
  reasoning: string;
  suggestedTitle: string;
  suggestedDescription: string;
  autoCreate: boolean; // Solo si es CRÍTICO y recurrente
  relatedNCRIds: string[];
}

export class NCRIntelligenceService {
  private prisma: PrismaClient;
  private tenant: any;

  constructor(prisma: PrismaClient, tenant?: any) {
    this.prisma = prisma;
    this.tenant = tenant;
  }

  private getLLM() {
    return createLLMProvider(this.tenant);
  }

  async analyzeNCRForRisk(input: NCRRiskAnalysisInput): Promise<NCRRiskAnalysisResult> {
    // Construir prompt para el LLM
    const prompt = this.buildAnalysisPrompt(input);
    
    try {
      const response = await this.getLLM().chat([
        {
          role: 'user',
          content: `Eres un analista experto en gestión de riesgos ISO 31000. Analizas No Conformidades (NCRs) para detectar riesgos sistémicos.

Tu tarea:
1. Evaluar si esta NCR indica un riesgo sistémico que debería gestionarse formalmente
2. Calcular probabilidad (1-5) e impacto (1-5) si el problema se repite
3. Sugerir título y descripción para el riesgo
4. Determinar si el riesgo es lo suficientemente grave como para crearse automáticamente

Criterios para auto-crear riesgo:
- Severidad CRITICAL + proceso con historial de NCRs similares
- NCR recurrente (>2 similares en 6 meses) con alta severidad
- Problema sistémico claro que afecta operación/marca/cumplimiento

Responde SOLO con JSON válido.`,
        },
        { role: 'user', content: prompt },
      ]);

      // Parsear respuesta JSON
      const similarIds = input.processNCRHistory.map((ncr) => ncr.id);
      const analysis = this.parseLLMResponse(response.text, similarIds);
      
      return analysis;
    } catch (error) {
      console.error('[NCRIntelligence] Error analyzing NCR:', error);
      // Fallback: análisis básico basado en reglas
      return this.fallbackAnalysis(input);
    }
  }

  private buildAnalysisPrompt(input: NCRRiskAnalysisInput): string {
    return `Analiza esta No Conformidad y determina si representa un riesgo sistémico:

**NCR Actual:**
- ID: ${input.ncrId}
- Título: ${input.title}
- Descripción: ${input.description}
- Severidad: ${input.severity}
- Proceso: ${input.processName || 'No especificado'}
- Norma: ${input.standard || 'N/A'}
- Causa Raíz: ${input.rootCause || 'No analizada'}

**Historial del Proceso (${input.similarNCRCount} NCRs similares en últimos 6 meses):**
${input.processNCRHistory.map(ncr => `- ${ncr.title} (${ncr.severity}, ${ncr.detectedAt.toISOString().split('T')[0]})`).join('\n') || 'Sin historial'}

**Responde con este JSON exacto:**
{
  "shouldCreateRisk": boolean,
  "confidence": number, // 0.0 a 1.0
  "suggestedProbability": number, // 1 a 5
  "suggestedImpact": number, // 1 a 5
  "reasoning": "string explicando el análisis",
  "suggestedTitle": "título del riesgo",
  "suggestedDescription": "descripción del riesgo",
  "autoCreate": boolean // true solo si es CRÍTICO + recurrente
}`;
  }

  private parseLLMResponse(text: string, relatedNCRIds: string[]): NCRRiskAnalysisResult {
    try {
      // Extraer JSON de la respuesta
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        shouldCreateRisk: parsed.shouldCreateRisk ?? false,
        confidence: Math.max(0, Math.min(1, parsed.confidence ?? 0.5)),
        suggestedProbability: Math.max(1, Math.min(5, Math.round(parsed.suggestedProbability ?? 3))),
        suggestedImpact: Math.max(1, Math.min(5, Math.round(parsed.suggestedImpact ?? 3))),
        reasoning: parsed.reasoning ?? 'Sin análisis detallado',
        suggestedTitle: parsed.suggestedTitle ?? 'Riesgo detectado desde NCR',
        suggestedDescription: parsed.suggestedDescription ?? '',
        autoCreate: parsed.autoCreate ?? false,
        relatedNCRIds,
      };
    } catch (error) {
      console.error('[NCRIntelligence] Error parsing LLM response:', error);
      return this.fallbackAnalysis(
        {
          ncrId: 'unknown',
          title: 'NCR',
          description: 'Sin descripción',
          severity: 'MINOR',
          similarNCRCount: relatedNCRIds.length,
          processNCRHistory: [],
        },
        relatedNCRIds
      );
    }
  }

  private fallbackAnalysis(input: NCRRiskAnalysisInput, relatedNCRIds: string[] = []): NCRRiskAnalysisResult {
    // Análisis basado en reglas simples
    const isCritical = input.severity === 'CRITICAL';
    const isMajor = input.severity === 'MAJOR';
    const hasHistory = input.similarNCRCount >= 2;
    
    return {
      shouldCreateRisk: isCritical || (isMajor && hasHistory),
      confidence: isCritical ? 0.9 : hasHistory ? 0.7 : 0.5,
      suggestedProbability: hasHistory ? 4 : isCritical ? 3 : 2,
      suggestedImpact: isCritical ? 5 : isMajor ? 4 : 3,
      reasoning: `Análisis basado en reglas: Severidad ${input.severity}, ${input.similarNCRCount} NCRs similares en el proceso.`,
      suggestedTitle: `Riesgo: ${input.title?.substring(0, 50) || 'Sin título'}`,
      suggestedDescription: `Riesgo sistémico detectado a partir de NCR en proceso "${input.processName || 'N/A'}".`,
      autoCreate: isCritical && hasHistory,
      relatedNCRIds,
    };
  }

  // Obtener datos para el análisis desde la base de datos
  async getNCRAnalysisData(ncrId: string, tenantId: string): Promise<NCRRiskAnalysisInput | null> {
    const ncr = await this.prisma.nonConformity.findFirst({
      where: { id: ncrId, tenantId },
    });

    if (!ncr) return null;

    // Buscar NCRs similares por título/descripción (sin processId aún)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // Por ahora: buscar NCRs del mismo tenant con misma severidad
    const similarNCRs = await this.prisma.nonConformity.findMany({
      where: {
        tenantId,
        id: { not: ncrId },
        deletedAt: null,
        detectedAt: { gte: sixMonthsAgo },
        severity: ncr.severity, // Misma severidad = "similar"
      },
      select: {
        id: true,
        title: true,
        severity: true,
        detectedAt: true,
      },
      orderBy: { detectedAt: 'desc' },
      take: 5,
    });

    return {
      ncrId: ncr.id,
      title: ncr.title,
      description: ncr.description,
      severity: ncr.severity,
      processName: null, // Sin proceso aún
      standard: ncr.standard,
      rootCause: (ncr as any).rootCause ?? null,
      similarNCRCount: similarNCRs.length,
      processNCRHistory: similarNCRs,
    };
  }
}

export function getNCRIntelligenceService(prisma: PrismaClient, tenant?: any): NCRIntelligenceService {
  return new NCRIntelligenceService(prisma, tenant);
}
