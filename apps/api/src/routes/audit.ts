// ──────────────────────────────────────────────────────────────
// Rutas de Auditoría IA
// ──────────────────────────────────────────────────────────────

import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { getAuditQueue } from '../jobs/queue.js';
import { createLLMProvider } from '../services/llm/factory.js';
import { AuditAnalysisService } from '../services/auditAnalysis.js';

const FEATURE_KEY = 'audit_ia';

// Tipos locales para NCR
type NCRSeverity = 'CRITICAL' | 'MAJOR' | 'MINOR' | 'OBSERVATION';

// ── Schemas ──

const analyzeDocSchema = z.object({
  documentId: z.string().uuid('documentId debe ser un UUID válido'),
  normativeId: z.string().uuid('normativeId debe ser un UUID válido'),
});

const tenantAuditSchema = z.object({});

const auditRunIdSchema = z.object({
  runId: z.string().uuid('runId debe ser un UUID válido'),
});

const findingIdSchema = z.object({
  id: z.string().uuid('id debe ser un UUID válido'),
});

const updateFindingSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'], {
    errorMap: () => ({ message: 'Status debe ser OPEN, IN_PROGRESS, RESOLVED o CLOSED' }),
  }),
});

const findingsQuerySchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional(),
  severity: z.enum(['MUST', 'SHOULD']).optional(),
  normativeId: z.string().uuid().optional(),
});

const chatSchema = z.object({
  message: z.string().min(1, 'El mensaje no puede estar vacío'),
  context: z
    .object({
      documentIds: z.array(z.string().uuid()).optional(),
      normativeIds: z.array(z.string().uuid()).optional(),
    })
    .optional(),
});

// ──────────────────────────────────────────────────────────────
// Rutas
// ──────────────────────────────────────────────────────────────

export const auditRoutes: FastifyPluginAsync = async (app) => {
  // ── POST /audit/analyze — Analizar documento vs normativa ──
  app.post('/analyze', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, FEATURE_KEY);

    // Verificar tenant context - primero intentar req.db, luego el token JWT
    const effectiveTenantId = req.db?.tenantId ?? req.auth?.tenantId;
    if (!effectiveTenantId) {
      return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    }
    const tenantId = effectiveTenantId;

    const body = analyzeDocSchema.parse(req.body);

    // Validar que documento y normativa existen y pertenecen al tenant
    const [document, normative] = await Promise.all([
      app.runWithDbContext(req, async (tx: Prisma.TransactionClient) => {
        return tx.document.findFirst({
          where: { id: body.documentId, tenantId, deletedAt: null },
        });
      }),
      app.runWithDbContext(req, async (tx: Prisma.TransactionClient) => {
        return tx.normativeStandard.findFirst({
          where: { id: body.normativeId, tenantId, deletedAt: null },
        });
      }),
    ]);

    if (!document) return reply.code(404).send({ error: 'Document not found' });
    if (!normative) return reply.code(404).send({ error: 'Normative not found' });

    // Crear AuditRun
    const auditRun = await app.runWithDbContext(req, async (tx: Prisma.TransactionClient) => {
      return tx.auditRun.create({
        data: {
          tenantId,
          type: 'document_vs_norma',
          status: 'QUEUED',
          documentId: body.documentId,
          normativeId: body.normativeId,
          createdById: req.auth?.userId ?? null,
        },
      });
    });

    // Encolar job
    const queue = getAuditQueue();
    const job = await queue.add('analyze-document-vs-norma', {
      auditRunId: auditRun.id,
      tenantId,
      documentId: body.documentId,
      normativeId: body.normativeId,
    });

    return reply.code(202).send({
      auditRun: {
        id: auditRun.id,
        type: auditRun.type,
        status: auditRun.status,
      },
      jobId: job.id,
    });
  });

  // ── POST /audit/tenant-audit — Auditoría completa del tenant ──
  app.post('/tenant-audit', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, FEATURE_KEY);

    // Verificar tenant context - primero intentar req.db, luego el token JWT
    const effectiveTenantId = req.db?.tenantId ?? req.auth?.tenantId;
    if (!effectiveTenantId) {
      return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    }
    const tenantId = effectiveTenantId;

    tenantAuditSchema.parse(req.body);

    // Crear AuditRun de tipo tenant_audit
    const auditRun = await app.runWithDbContext(req, async (tx: Prisma.TransactionClient) => {
      return tx.auditRun.create({
        data: {
          tenantId,
          type: 'tenant_audit',
          status: 'QUEUED',
          createdById: req.auth?.userId ?? null,
        },
      });
    });

    // Encolar job
    const queue = getAuditQueue();
    const job = await queue.add('tenant-full-audit', {
      auditRunId: auditRun.id,
      tenantId,
    });

    return reply.code(202).send({
      auditRun: {
        id: auditRun.id,
        type: auditRun.type,
        status: auditRun.status,
      },
      jobId: job.id,
    });
  });

  // ── GET /audit/runs — Listar auditorías ──
  app.get('/runs', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, FEATURE_KEY);

    // Verificar tenant context - primero intentar req.db, luego el token JWT
    const effectiveTenantId = req.db?.tenantId ?? req.auth?.tenantId;
    if (!effectiveTenantId) {
      return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    }
    const tenantId = effectiveTenantId;

    const runs = await app.runWithDbContext(req, async (tx: Prisma.TransactionClient) => {
      return tx.auditRun.findMany({
        where: { tenantId, deletedAt: null },
        include: {
          document: { select: { id: true, title: true } },
          normative: { select: { id: true, name: true, code: true } },
        },
        orderBy: { startedAt: 'desc' },
      });
    });

    return reply.send({ runs });
  });

  // ── GET /audit/runs/:runId — Detalle de auditoría ──
  app.get('/runs/:runId', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, FEATURE_KEY);

    const params = auditRunIdSchema.parse(req.params);

    const run = await app.runWithDbContext(req, async (tx: Prisma.TransactionClient) => {
      return tx.auditRun.findFirst({
        where: { id: params.runId, deletedAt: null },
        include: {
          document: { select: { id: true, title: true, type: true } },
          normative: { select: { id: true, name: true, code: true } },
        },
      });
    });

    if (!run) return reply.code(404).send({ error: 'Audit run not found' });
    return reply.send({ run });
  });

  // ── GET /audit/runs/:runId/findings — Hallazgos de auditoría ──
  app.get('/runs/:runId/findings', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, FEATURE_KEY);

    const params = auditRunIdSchema.parse(req.params);

    const findings = await app.runWithDbContext(req, async (tx: Prisma.TransactionClient) => {
      return tx.aiFinding.findMany({
        where: { auditRunId: params.runId, deletedAt: null },
        orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
        include: {
          document: { select: { id: true, title: true } },
          normative: { select: { id: true, name: true, code: true } },
        },
      });
    });

    return reply.send({ findings });
  });

  // ── GET /audit/findings — Listar todos los hallazgos del tenant ──
  app.get('/findings', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, FEATURE_KEY);

    // Verificar tenant context - primero intentar req.db, luego el token JWT
    const effectiveTenantId = req.db?.tenantId ?? req.auth?.tenantId;
    if (!effectiveTenantId) {
      return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    }
    const tenantId = effectiveTenantId;

    const query = findingsQuerySchema.parse(req.query);

    const where: any = {
      tenantId,
      deletedAt: null,
    };

    if (query.status) where.status = query.status;
    if (query.severity) where.severity = query.severity;
    if (query.normativeId) where.normativeId = query.normativeId;

    const findings = await app.runWithDbContext(req, async (tx: Prisma.TransactionClient) => {
      return tx.aiFinding.findMany({
        where,
        orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
        include: {
          document: { select: { id: true, title: true } },
          normative: { select: { id: true, name: true, code: true } },
          auditRun: { select: { id: true, type: true } },
        },
      });
    });

    return reply.send({ findings });
  });

  // ── PATCH /audit/findings/:id — Actualizar estado de hallazgo ──
  app.patch('/findings/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, FEATURE_KEY);

    const params = findingIdSchema.parse(req.params);
    const body = updateFindingSchema.parse(req.body);

    const updated = await app.runWithDbContext(req, async (tx: Prisma.TransactionClient) => {
      const existing = await tx.aiFinding.findFirst({
        where: { id: params.id, deletedAt: null },
      });
      if (!existing) return null;

      return tx.aiFinding.update({
        where: { id: existing.id },
        data: {
          status: body.status,
          updatedById: req.auth?.userId ?? null,
        },
      });
    });

    if (!updated) return reply.code(404).send({ error: 'Finding not found' });
    return reply.send({ finding: updated });
  });

  // ── DELETE /audit/findings/:id — Eliminar hallazgo ──
  app.delete('/findings/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, FEATURE_KEY);

    const effectiveTenantId = req.db?.tenantId ?? req.auth?.tenantId;
    if (!effectiveTenantId) {
      return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    }
    const tenantId = effectiveTenantId;

    const params = findingIdSchema.parse(req.params);
    const { id: findingId } = params;

    const deleted = await app.runWithDbContext(req, async (tx: Prisma.TransactionClient) => {
      // Verificar que el hallazgo existe y pertenece al tenant
      const finding = await tx.aiFinding.findFirst({
        where: { id: findingId, tenantId, deletedAt: null },
      });
      if (!finding) return null;

      // Soft delete del hallazgo
      return tx.aiFinding.update({
        where: { id: findingId },
        data: {
          deletedAt: new Date(),
        },
      });
    });

    if (!deleted) return reply.code(404).send({ error: 'Hallazgo no encontrado' });
    return reply.send({ success: true, message: 'Hallazgo eliminado' });
  });

  // ── DELETE /audit/runs/:runId — Eliminar auditoría ──
  app.delete('/runs/:runId', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, FEATURE_KEY);

    const params = auditRunIdSchema.parse(req.params);

    const deleted = await app.runWithDbContext(req, async (tx: Prisma.TransactionClient) => {
      const existing = await tx.auditRun.findFirst({
        where: { id: params.runId, tenantId: req.db!.tenantId, deletedAt: null },
      });
      if (!existing) return null;

      // Soft delete de la auditoría
      return tx.auditRun.update({
        where: { id: existing.id },
        data: {
          deletedAt: new Date(),
        },
      });
    });

    if (!deleted) return reply.code(404).send({ error: 'Audit run not found' });
    return reply.send({ success: true, message: 'Auditoría eliminada' });
  });

  // ── POST /audit/findings/:findingId/convert-to-ncr — Convertir hallazgo a no conformidad ──
  app.post('/findings/:findingId/convert-to-ncr', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, FEATURE_KEY);

    const effectiveTenantId = req.db?.tenantId ?? req.auth?.tenantId;
    if (!effectiveTenantId) {
      return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    }
    const tenantId = effectiveTenantId;

    const params = z.object({ findingId: z.string().uuid() }).parse(req.params);
    const { findingId } = params;

    const result = await app.runWithDbContext(req, async (tx: Prisma.TransactionClient) => {
      // 1. Obtener el hallazgo
      const finding = await tx.aiFinding.findFirst({
        where: { id: findingId, tenantId, deletedAt: null },
      });
      if (!finding) throw new Error('Hallazgo no encontrado');

      // 2. Verificar que no ya esté convertido
      if (finding.status === 'CONVERTED_TO_NCR') {
        throw new Error('Este hallazgo ya fue convertido a no conformidad');
      }

      // 3. Generar código único para la NCR
      const count = await tx.nonConformity.count({ where: { tenantId } });
      const code = `NCR-${(count + 1).toString().padStart(4, '0')}`;

      // 4. Mapear severidad de FindingSeverity a NCRSeverity
      const severityMap: Record<string, NCRSeverity> = {
        'MUST': 'MAJOR',
        'SHOULD': 'MINOR',
      };
      const ncrSeverity = severityMap[finding.severity] ?? 'OBSERVATION';

      // 5. Crear la no conformidad
      const ncr = await tx.nonConformity.create({
        data: {
          tenantId,
          code,
          title: finding.title,
          description: finding.description,
          severity: ncrSeverity,
          source: 'AI_FINDING',
          status: 'OPEN',
          standard: finding.standard,
          clause: finding.clause,
          aiFindingId: finding.id,
          detectedAt: new Date(),
          createdById: req.auth?.userId ?? null,
        },
      });

      // 6. Actualizar el hallazgo como convertido
      await tx.aiFinding.update({
        where: { id: findingId },
        data: {
          status: 'CONVERTED_TO_NCR',
          updatedAt: new Date(),
        },
      });

      return { ncr, finding };
    });

    return reply.send({
      success: true,
      message: 'Hallazgo convertido a no conformidad exitosamente',
      nonConformity: result.ncr,
    });
  });

  // ── POST /audit/chat — Chat de auditor con contexto ──
  app.post('/chat', async (req: FastifyRequest, reply: FastifyReply) => {
    app.requireFeature(req, FEATURE_KEY);

    // Verificar tenant context - primero intentar req.db, luego el token JWT
    const effectiveTenantId = req.db?.tenantId ?? req.auth?.tenantId;
    if (!effectiveTenantId) {
      return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    }
    const tenantId = effectiveTenantId;

    const body = chatSchema.parse(req.body);

    // Cargar contexto: documentos y normativas disponibles
    const [documents, normatives] = await Promise.all([
      app.runWithDbContext(req, async (tx: Prisma.TransactionClient) => {
        return tx.document.findMany({
          where: { tenantId, deletedAt: null },
          select: { title: true, type: true },
          take: 10, // Limitar para no saturar el contexto
        });
      }),
      app.runWithDbContext(req, async (tx: Prisma.TransactionClient) => {
        return tx.normativeStandard.findMany({
          where: { tenantId, deletedAt: null },
          select: { name: true, code: true, totalClauses: true },
          take: 10,
        });
      }),
    ]);

    // Construir contexto
    const llm = createLLMProvider(req.tenant);
    const auditService = new AuditAnalysisService(llm);
    const contextStr = auditService.buildChatContext(documents, normatives);

    // Hacer llamada LLM con contexto
    const messages = [
      {
        role: 'user' as const,
        content: `${contextStr}\n\nUsuario pregunta: ${body.message}`,
      },
    ];

    const response = await llm.chat(messages);

    return reply.send({
      response: response.text,
      model: response.model,
      tokensUsed: response.tokensUsed,
    });
  });
};
