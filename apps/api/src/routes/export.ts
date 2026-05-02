// ──────────────────────────────────────────────────────────────
// Rutas de Exportación
// ──────────────────────────────────────────────────────────────

import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import {
  exportNCRs,
  exportRisks,
  exportIndicators,
  exportDocuments,
  exportFindings,
  exportTenantReport,
} from '../services/export.js';

const exportFormatSchema = z.object({
  format: z.enum(['xlsx', 'csv']).default('xlsx'),
});

const exportRisksQuerySchema = exportFormatSchema.extend({
  status: z.string().optional(),
  category: z.string().optional(),
  aspectType: z.string().optional(),
  strategy: z.string().optional(),
  legalRequirement: z.enum(['true', 'false']).optional(),
  riskSource: z.string().optional(),
  minLevel: z.coerce.number().int().optional(),
  maxLevel: z.coerce.number().int().optional(),
});

export const exportRoutes: FastifyPluginAsync = async (app) => {
  // ── GET /export/ncr — Exportar No Conformidades ──
  app.get('/ncr', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    const tenantId = req.db.tenantId;

    const query = exportFormatSchema.parse(req.query);
    const format = (query.format ?? 'xlsx') as 'xlsx' | 'csv';

    try {
      const result = await app.runWithDbContext(req, async (tx: Prisma.TransactionClient) => {
        return await exportNCRs(tx, tenantId, { format });
      });

      reply
        .header('Content-Type', result.mimeType)
        .header('Content-Disposition', `attachment; filename="${result.filename}"`)
        .send(result.buffer);
    } catch (err: any) {
      reply.code(500).send({ error: err.message || 'Export failed' });
    }
  });

  // ── GET /export/risks — Exportar Riesgos ──
  app.get('/risks', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    const tenantId = req.db.tenantId;

    const query = exportRisksQuerySchema.parse(req.query);
    const format = (query.format ?? 'xlsx') as 'xlsx' | 'csv';

    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.category) where.category = query.category;
    if (query.aspectType) where.aspectType = query.aspectType;
    if (query.strategy) where.strategy = query.strategy;
    if (query.legalRequirement) where.legalRequirement = query.legalRequirement === 'true';
    if (query.riskSource) where.riskSource = query.riskSource;
    if (query.minLevel !== undefined || query.maxLevel !== undefined) {
      where.riskLevel = {
        ...(query.minLevel !== undefined ? { gte: query.minLevel } : {}),
        ...(query.maxLevel !== undefined ? { lte: query.maxLevel } : {}),
      };
    }

    try {
      const result = await app.runWithDbContext(req, async (tx: Prisma.TransactionClient) => {
        return await exportRisks(tx, tenantId, {
          format,
          where,
        });
      });

      reply
        .header('Content-Type', result.mimeType)
        .header('Content-Disposition', `attachment; filename="${result.filename}"`)
        .send(result.buffer);
    } catch (err: any) {
      reply.code(500).send({ error: err.message || 'Export failed' });
    }
  });

  // ── GET /export/indicators — Exportar Indicadores ──
  app.get('/indicators', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    const tenantId = req.db.tenantId;

    const query = exportFormatSchema.parse(req.query);
    const format = (query.format ?? 'xlsx') as 'xlsx' | 'csv';

    try {
      const result = await app.runWithDbContext(req, async (tx: Prisma.TransactionClient) => {
        return await exportIndicators(tx, tenantId, { format });
      });

      reply
        .header('Content-Type', result.mimeType)
        .header('Content-Disposition', `attachment; filename="${result.filename}"`)
        .send(result.buffer);
    } catch (err: any) {
      reply.code(500).send({ error: err.message || 'Export failed' });
    }
  });

  // ── GET /export/documents — Exportar Documentos ──
  app.get('/documents', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    const tenantId = req.db.tenantId;

    const query = exportFormatSchema.parse(req.query);
    const format = (query.format ?? 'xlsx') as 'xlsx' | 'csv';

    try {
      const result = await app.runWithDbContext(req, async (tx: Prisma.TransactionClient) => {
        return await exportDocuments(tx, tenantId, { format });
      });

      reply
        .header('Content-Type', result.mimeType)
        .header('Content-Disposition', `attachment; filename="${result.filename}"`)
        .send(result.buffer);
    } catch (err: any) {
      reply.code(500).send({ error: err.message || 'Export failed' });
    }
  });

  // ── GET /export/findings — Exportar Hallazgos IA ──
  app.get('/findings', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    const tenantId = req.db.tenantId;

    const query = exportFormatSchema.parse(req.query);
    const format = (query.format ?? 'xlsx') as 'xlsx' | 'csv';

    try {
      const result = await app.runWithDbContext(req, async (tx: Prisma.TransactionClient) => {
        return await exportFindings(tx, tenantId, { format });
      });

      reply
        .header('Content-Type', result.mimeType)
        .header('Content-Disposition', `attachment; filename="${result.filename}"`)
        .send(result.buffer);
    } catch (err: any) {
      reply.code(500).send({ error: err.message || 'Export failed' });
    }
  });

  // ── GET /export/tenant-report — Reporte Completo del Tenant ──
  app.get('/tenant-report', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    const tenantId = req.db.tenantId;

    const query = exportFormatSchema.parse(req.query);
    const format = (query.format ?? 'xlsx') as 'xlsx' | 'csv';

    try {
      const result = await app.runWithDbContext(req, async (tx: Prisma.TransactionClient) => {
        return await exportTenantReport(tx, tenantId, { format });
      });

      reply
        .header('Content-Type', result.mimeType)
        .header('Content-Disposition', `attachment; filename="${result.filename}"`)
        .send(result.buffer);
    } catch (err: any) {
      reply.code(500).send({ error: err.message || 'Export failed' });
    }
  });
};
