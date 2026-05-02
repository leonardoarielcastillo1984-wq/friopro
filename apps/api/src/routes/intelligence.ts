import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getNCRIntelligenceService } from '../services/ncrIntelligence.js';
import type { Prisma } from '@prisma/client';

const FEATURE_KEY = 'ia_inteligencia';

export const intelligenceRoutes: FastifyPluginAsync = async (app) => {
  // POST /intelligence/analyze-ncr/:ncrId — Analizar NCR para detectar riesgo
  app.post('/analyze-ncr/:ncrId', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, FEATURE_KEY);

    const effectiveTenantId = req.db?.tenantId ?? req.auth?.tenantId;
    if (!effectiveTenantId) {
      return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    }
    const tenantId = effectiveTenantId;

    const params = z.object({ ncrId: z.string().uuid() }).parse(req.params);
    const { ncrId } = params;

    const result = await app.runWithDbContext(req, async (tx: Prisma.TransactionClient) => {
      const service = getNCRIntelligenceService(tx as any, req.tenant);
      
      // Obtener datos de la NCR y su historial
      const analysisData = await service.getNCRAnalysisData(ncrId, tenantId);
      
      if (!analysisData) {
        throw new Error('NCR no encontrada');
      }

      // Ejecutar análisis IA
      const analysis = await service.analyzeNCRForRisk(analysisData);

      // Si debe crearse automáticamente, crear el riesgo
      let createdRisk = null;
      if (analysis.autoCreate || analysis.shouldCreateRisk) {
        const riskLevel = analysis.suggestedProbability * analysis.suggestedImpact;
        
        createdRisk = await (tx as any).risk.create({
          data: {
            tenantId,
            code: await generateRiskCode(tx as any, tenantId),
            title: analysis.suggestedTitle,
            description: analysis.suggestedDescription,
            category: 'Operacional', // Default, puede ajustarse
            process: analysisData.processName,
            standard: analysisData.standard,
            probability: analysis.suggestedProbability,
            impact: analysis.suggestedImpact,
            riskLevel,
            status: 'IDENTIFIED',
            sourceNCRId: ncrId,
            createdById: req.auth?.userId ?? null,
            updatedById: req.auth?.userId ?? null,
          },
        });

        // Crear notificación para el usuario
        await (tx as any).notification.create({
          data: {
            tenantId,
            userId: req.auth?.userId ?? '',
            type: 'RISK_CRITICAL',
            title: '🤖 Riesgo detectado automáticamente',
            message: `La IA detectó un riesgo (${createdRisk.code}) a partir de la NCR ${analysisData.title.substring(0, 30)}...`,
            link: `/riesgos/${createdRisk.id}`,
            entityType: 'Risk',
            entityId: createdRisk.id,
          },
        });
      }

      return {
        analysis,
        createdRisk,
        ncrData: analysisData,
      };
    });

    return reply.send({
      success: true,
      shouldCreateRisk: result.analysis.shouldCreateRisk,
      autoCreated: !!result.createdRisk,
      risk: result.createdRisk,
      analysis: {
        confidence: result.analysis.confidence,
        suggestedProbability: result.analysis.suggestedProbability,
        suggestedImpact: result.analysis.suggestedImpact,
        reasoning: result.analysis.reasoning,
        similarNCRCount: result.ncrData.similarNCRCount,
      },
    });
  });

  // GET /intelligence/ncr-suggestion/:ncrId — Solo obtener sugerencia (sin crear)
  app.get('/ncr-suggestion/:ncrId', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, FEATURE_KEY);

    const effectiveTenantId = req.db?.tenantId ?? req.auth?.tenantId;
    if (!effectiveTenantId) {
      return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    }
    const tenantId = effectiveTenantId;

    const params = z.object({ ncrId: z.string().uuid() }).parse(req.params);
    const { ncrId } = params;

    const result = await app.runWithDbContext(req, async (tx: Prisma.TransactionClient) => {
      const service = getNCRIntelligenceService(tx as any, req.tenant);
      const analysisData = await service.getNCRAnalysisData(ncrId, tenantId);
      
      if (!analysisData) {
        throw new Error('NCR no encontrada');
      }

      const analysis = await service.analyzeNCRForRisk(analysisData);

      return {
        analysis,
        ncrData: analysisData,
      };
    });

    return reply.send({
      shouldCreateRisk: result.analysis.shouldCreateRisk,
      confidence: result.analysis.confidence,
      suggestedProbability: result.analysis.suggestedProbability,
      suggestedImpact: result.analysis.suggestedImpact,
      reasoning: result.analysis.reasoning,
      suggestedTitle: result.analysis.suggestedTitle,
      suggestedDescription: result.analysis.suggestedDescription,
      similarNCRCount: result.ncrData.similarNCRCount,
      relatedNCRIds: result.analysis.relatedNCRIds,
    });
  });
};

// Helper para generar código de riesgo
async function generateRiskCode(tx: any, tenantId: string): Promise<string> {
  const year = new Date().getFullYear();
  const count = await tx.risk.count({
    where: { tenantId, code: { startsWith: `RSK-${year}-` } },
  });
  return `RSK-${year}-${String(count + 1).padStart(3, '0')}`;
}
