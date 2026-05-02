// ──────────────────────────────────────────────────────────────
// Audit Trail Viewer Routes
// ──────────────────────────────────────────────────────────────

import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  getEntityAuditTrail,
  getAuditLogs,
  getAuditLogCount,
  getAuditSummaryByUser,
  getAuditSummaryByEntityType,
} from '../services/audit.js';
import { AuditAction } from '@prisma/client';

// Validation schemas
const auditTrailQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(500).default(100),
  offset: z.coerce.number().min(0).default(0),
});

const auditLogsQuerySchema = z.object({
  entityType: z.string().optional(),
  entityId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  action: z.enum(['CREATE', 'UPDATE', 'DELETE']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.coerce.number().min(1).max(500).default(100),
  offset: z.coerce.number().min(0).default(0),
});

const auditSummaryQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const auditTrailRoutes: FastifyPluginAsync = async (app) => {
  // ── GET /audit-trail/trail/:entityType/:entityId ──
  // Get complete audit trail for a specific entity
  app.get(
    '/trail/:entityType/:entityId',
    async (req: FastifyRequest, reply: FastifyReply) => {
      if (!req.db?.tenantId)
        return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

      try {
        const { entityType, entityId } = req.params as {
          entityType: string;
          entityId: string;
        };
        const query = auditTrailQuerySchema.parse(req.query);

        const total = await getAuditLogCount(req.db.tenantId, {
          entityType,
          entityId,
        });

        const logs = await getEntityAuditTrail(
          req.db.tenantId,
          entityType,
          entityId,
          query.limit,
          query.offset
        );

        reply.send({
          total,
          count: logs.length,
          limit: query.limit,
          offset: query.offset,
          data: logs,
        });
      } catch (err: any) {
        reply.code(500).send({ error: err.message || 'Failed to fetch audit trail' });
      }
    }
  );

  // ── GET /audit-trail/logs ──
  // Get audit logs with flexible filtering
  app.get('/logs', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId)
      return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    try {
      const query = auditLogsQuerySchema.parse(req.query);

      const filters = {
        entityType: query.entityType,
        entityId: query.entityId,
        userId: query.userId,
        action: query.action as AuditAction | undefined,
        startDate: query.startDate ? new Date(query.startDate) : undefined,
        endDate: query.endDate ? new Date(query.endDate) : undefined,
        limit: query.limit,
        offset: query.offset,
      };

      const total = await getAuditLogCount(req.db.tenantId, filters);
      const logs = await getAuditLogs(req.db.tenantId, filters);

      reply.send({
        total,
        count: logs.length,
        limit: query.limit,
        offset: query.offset,
        filters: {
          entityType: query.entityType,
          userId: query.userId,
          action: query.action,
          dateRange: query.startDate || query.endDate ? {
            start: query.startDate,
            end: query.endDate,
          } : null,
        },
        data: logs,
      });
    } catch (err: any) {
      reply.code(500).send({ error: err.message || 'Failed to fetch audit logs' });
    }
  });

  // ── GET /audit-trail/summary/users ──
  // Get audit summary grouped by user
  app.get(
    '/summary/users',
    async (req: FastifyRequest, reply: FastifyReply) => {
      if (!req.db?.tenantId)
        return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

      try {
        const query = auditSummaryQuerySchema.parse(req.query);

        const summary = await getAuditSummaryByUser(
          req.db.tenantId,
          query.startDate ? new Date(query.startDate) : undefined,
          query.endDate ? new Date(query.endDate) : undefined
        );

        reply.send({
          dateRange: {
            start: query.startDate,
            end: query.endDate,
          },
          summary: summary.map((item) => ({
            userId: item.userId,
            userName: item.userName,
            totalActions: item.totalActions,
            creates: item.creates,
            updates: item.updates,
            deletes: item.deletes,
            lastActionAt: item.lastActionAt,
          })),
        });
      } catch (err: any) {
        reply
          .code(500)
          .send({ error: err.message || 'Failed to fetch user summary' });
      }
    }
  );

  // ── GET /audit-trail/summary/entities ──
  // Get audit summary grouped by entity type
  app.get(
    '/summary/entities',
    async (req: FastifyRequest, reply: FastifyReply) => {
      if (!req.db?.tenantId)
        return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

      try {
        const query = auditSummaryQuerySchema.parse(req.query);

        const summary = await getAuditSummaryByEntityType(
          req.db.tenantId,
          query.startDate ? new Date(query.startDate) : undefined,
          query.endDate ? new Date(query.endDate) : undefined
        );

        reply.send({
          dateRange: {
            start: query.startDate,
            end: query.endDate,
          },
          summary: summary.map((item) => ({
            entityType: item.entityType,
            totalChanges: item.totalChanges,
            creates: item.creates,
            updates: item.updates,
            deletes: item.deletes,
          })),
        });
      } catch (err: any) {
        reply
          .code(500)
          .send({ error: err.message || 'Failed to fetch entity summary' });
      }
    }
  );

  // ── GET /audit-trail/export ──
  // Export audit logs as CSV
  app.get('/export', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId)
      return reply.code(400).send({ error: 'Se requiere contexto de tenant' });

    try {
      const query = auditLogsQuerySchema.parse(req.query);

      const filters = {
        entityType: query.entityType,
        entityId: query.entityId,
        userId: query.userId,
        action: query.action as AuditAction | undefined,
        startDate: query.startDate ? new Date(query.startDate) : undefined,
        endDate: query.endDate ? new Date(query.endDate) : undefined,
        limit: 100000, // High limit for export
      };

      const logs = await getAuditLogs(req.db.tenantId, filters);

      // Generate CSV
      const headers = [
        'Date',
        'Time',
        'Entity Type',
        'Entity Code',
        'Action',
        'User',
        'Field',
        'Old Value',
        'New Value',
        'Description',
      ];

      const rows = logs.map((log) => [
        log.createdAt.toISOString().split('T')[0],
        log.createdAt.toISOString().split('T')[1].substring(0, 8),
        log.entityType,
        log.entityCode || '-',
        log.action,
        log.userName,
        log.fieldName || '-',
        log.oldValue ? (log.oldValue.length > 100 ? log.oldValue.substring(0, 97) + '...' : log.oldValue) : '-',
        log.newValue ? (log.newValue.length > 100 ? log.newValue.substring(0, 97) + '...' : log.newValue) : '-',
        log.description || '-',
      ]);

      const csv =
        [headers, ...rows]
          .map((row) =>
            row
              .map((cell) => {
                // Escape quotes and wrap in quotes if needed
                const str = String(cell).replace(/"/g, '""');
                return `"${str}"`;
              })
              .join(',')
          )
          .join('\n') + '\n';

      const timestamp = new Date().toISOString().substring(0, 10);
      const filename = `audit-log-${timestamp}.csv`;

      reply
        .header('Content-Type', 'text/csv')
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .send(csv);
    } catch (err: any) {
      reply.code(500).send({ error: err.message || 'Export failed' });
    }
  });
};
