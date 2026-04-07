/**
 * Admin Panel Routes for 2FA Management
 * All routes require admin authentication
 */

import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { disable2FA } from '../services/twoFactorAuth.js';
import { sendEmail } from '../services/email.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');

let dashboardHTML = '';
try {
  dashboardHTML = readFileSync(join(__dirname, '../..', 'templates', 'admin-dashboard.html'), 'utf-8');
} catch (err) {
  console.warn('Admin dashboard template not found, HTML UI will not be available');
}

// ── Validation Schemas ──

const listUsersQuery = z.object({
  page: z.string().default('1').transform(Number),
  pageSize: z.string().default('20').transform(Number),
  search: z.string().optional(),
  twoFactorEnabled: z.string().optional().transform((v) => v === 'true'),
});

const auditLogsQuery = z.object({
  limit: z.string().default('50').transform(Number),
  offset: z.string().default('0').transform(Number),
});

const alertRequest = z.object({
  subject: z.string().min(1, 'Subject required'),
  message: z.string().min(1, 'Message required'),
  type: z.enum(['INFO', 'WARNING', 'CRITICAL']).default('INFO'),
});

const disableUserSchema = z.object({
  reason: z.string().optional(),
});

// ── Helper Functions ──

/**
 * Check if user is admin
 */
function requireAdmin(user: any) {
  if (user?.globalRole !== 'SUPER_ADMIN' && user?.globalRole !== 'TENANT_ADMIN') {
    throw new Error('Admin access required');
  }
}

// ── Routes ──

export const adminRoutes: FastifyPluginAsync = async (app) => {
  /**
   * GET /admin/dashboard
   * Serve admin dashboard HTML interface
   */
  app.get('/dashboard', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.auth?.userId) {
      return reply.code(401).redirect('/login');
    }

    try {
      const user = await app.prisma.platformUser.findUnique({
        where: { id: req.auth.userId },
        select: { globalRole: true },
      });

      if (user?.globalRole !== 'SUPER_ADMIN' && user?.globalRole !== 'TENANT_ADMIN') {
        return reply.code(403).send({ error: 'Admin access required' });
      }

      if (!dashboardHTML) {
        return reply.code(503).send({ error: 'Admin dashboard not available' });
      }

      return reply.type('text/html').send(dashboardHTML);
    } catch (err) {
      app.log.error(err);
      return reply.code(500).send({ error: 'Failed to load dashboard' });
    }
  });

  /**
   * GET /admin/2fa/users
   * List all users with 2FA status
   */
  app.get<{ Querystring: Record<string, any> }>(
    '/2fa/users',
    async (req: FastifyRequest, reply: FastifyReply) => {
      if (!req.auth?.userId) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      try {
        // Check admin status
        const user = await app.prisma.platformUser.findUnique({
          where: { id: req.auth.userId },
          select: { globalRole: true },
        });

        requireAdmin(user);

        // Parse query
        const query = listUsersQuery.parse(req.query);
        const skip = (query.page - 1) * query.pageSize;

        // Build filters
        const whereClause: any = {};
        if (query.search) {
          whereClause.OR = [
            { email: { contains: query.search, mode: 'insensitive' } },
            { firstName: { contains: query.search, mode: 'insensitive' } },
            { lastName: { contains: query.search, mode: 'insensitive' } },
          ];
        }
        if (query.twoFactorEnabled !== undefined) {
          whereClause.twoFactorEnabled = query.twoFactorEnabled;
        }

        // Get users
        const users = await app.prisma.platformUser.findMany({
          where: whereClause,
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            twoFactorEnabled: true,
            twoFactorLastVerified: true,
            createdAt: true,
            twoFactorRecoveryCodes: {
              select: { id: true, used: true },
            },
          },
          skip,
          take: query.pageSize,
          orderBy: { createdAt: 'desc' },
        });

        const total = await app.prisma.platformUser.count({
          where: whereClause,
        });

        const formattedUsers = users.map((u) => ({
          userId: u.id,
          email: u.email,
          name: `${u.firstName || ''} ${u.lastName || ''}`.trim(),
          twoFactorEnabled: u.twoFactorEnabled,
          lastVerified: u.twoFactorLastVerified,
          recoveryCodesCount: u.twoFactorRecoveryCodes.length,
          recoveryCodesUnused: u.twoFactorRecoveryCodes.filter((c) => !c.used).length,
          createdAt: u.createdAt,
        }));

        return reply.send({
          users: formattedUsers,
          total,
          page: query.page,
          pageSize: query.pageSize,
          totalPages: Math.ceil(total / query.pageSize),
        });
      } catch (err: any) {
        if (err.message === 'Admin access required') {
          return reply.code(403).send({ error: 'Admin access required' });
        }
        app.log.error(err);
        return reply.code(500).send({ error: err.message || 'Failed to list users' });
      }
    }
  );

  /**
   * GET /admin/2fa/users/:userId/audit-logs
   * Get audit logs for a specific user
   */
  app.get<{ Params: { userId: string }; Querystring: Record<string, any> }>(
    '/2fa/users/:userId/audit-logs',
    async (req: FastifyRequest, reply: FastifyReply) => {
      if (!req.auth?.userId) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      try {
        // Check admin status
        const admin = await app.prisma.platformUser.findUnique({
          where: { id: req.auth.userId },
          select: { globalRole: true },
        });

        requireAdmin(admin);

        // Verify target user exists
        const targetUser = await app.prisma.platformUser.findUnique({
          where: { id: req.params.userId },
          select: { id: true, email: true },
        });

        if (!targetUser) {
          return reply.code(404).send({ error: 'User not found' });
        }

        // Parse query
        const query = auditLogsQuery.parse(req.query);

        // Get audit logs
        const logs = await app.prisma.auditLog.findMany({
          where: { userId: req.params.userId },
          select: {
            id: true,
            userId: true,
            action: true,
            ipAddress: true,
            userAgent: true,
            createdAt: true,
            details: true,
          },
          orderBy: { createdAt: 'desc' },
          skip: query.offset,
          take: query.limit,
        });

        const total = await app.prisma.auditLog.count({
          where: { userId: req.params.userId },
        });

        return reply.send({
          userId: req.params.userId,
          userEmail: targetUser.email,
          logs,
          total,
          limit: query.limit,
          offset: query.offset,
        });
      } catch (err: any) {
        if (err.message === 'Admin access required') {
          return reply.code(403).send({ error: 'Admin access required' });
        }
        app.log.error(err);
        return reply.code(500).send({ error: err.message || 'Failed to get audit logs' });
      }
    }
  );

  /**
   * POST /admin/2fa/users/:userId/disable
   * Admin override to disable 2FA for a user
   */
  app.post<{ Params: { userId: string }; Body: any }>(
    '/2fa/users/:userId/disable',
    async (req: FastifyRequest, reply: FastifyReply) => {
      if (!req.auth?.userId) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      try {
        // Check admin status
        const admin = await app.prisma.platformUser.findUnique({
          where: { id: req.auth.userId },
          select: { globalRole: true },
        });

        requireAdmin(admin);

        // Verify target user exists
        const targetUser = await app.prisma.platformUser.findUnique({
          where: { id: req.params.userId },
          select: { id: true, email: true, twoFactorEnabled: true },
        });

        if (!targetUser) {
          return reply.code(404).send({ error: 'User not found' });
        }

        if (!targetUser.twoFactorEnabled) {
          return reply.send({
            success: true,
            message: '2FA already disabled for this user',
            userId: req.params.userId,
          });
        }

        // Parse body
        const body = disableUserSchema.parse(req.body);

        // Disable 2FA
        await disable2FA(req.params.userId);

        // Log admin action
        await app.prisma.auditLog.create({
          data: {
            userId: req.auth.userId,
            action: 'ADMIN_2FA_DISABLED',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'] || '',
            details: {
              targetUserId: req.params.userId,
              targetUserEmail: targetUser.email,
              reason: body.reason,
              adminId: req.auth.userId,
            },
          },
        });

        // Send notification to user
        try {
          await sendEmail({
            to: targetUser.email,
            subject: 'Two-Factor Authentication Disabled by Administrator',
            template: 'admin-disabled-2fa',
            variables: {
              userName: targetUser.email.split('@')[0],
              reason: body.reason || 'Not specified',
              supportEmail: process.env.SUPPORT_EMAIL || 'support@sgi360.com',
            },
          });
        } catch (emailErr) {
          app.log.warn('Failed to send 2FA disabled notification email', emailErr);
        }

        return reply.send({
          success: true,
          message: '2FA disabled for user',
          userId: req.params.userId,
          userEmail: targetUser.email,
        });
      } catch (err: any) {
        if (err.message === 'Admin access required') {
          return reply.code(403).send({ error: 'Admin access required' });
        }
        app.log.error(err);
        return reply.code(500).send({ error: err.message || 'Failed to disable 2FA' });
      }
    }
  );

  /**
   * POST /admin/2fa/users/:userId/alert
   * Send security alert to user
   */
  app.post<{ Params: { userId: string }; Body: any }>(
    '/2fa/users/:userId/alert',
    async (req: FastifyRequest, reply: FastifyReply) => {
      if (!req.auth?.userId) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      try {
        // Check admin status
        const admin = await app.prisma.platformUser.findUnique({
          where: { id: req.auth.userId },
          select: { globalRole: true, email: true },
        });

        requireAdmin(admin);

        // Verify target user exists
        const targetUser = await app.prisma.platformUser.findUnique({
          where: { id: req.params.userId },
          select: { id: true, email: true },
        });

        if (!targetUser) {
          return reply.code(404).send({ error: 'User not found' });
        }

        // Parse body
        const body = alertRequest.parse(req.body);

        // Send alert email
        await sendEmail({
          to: targetUser.email,
          subject: `[${body.type}] ${body.subject}`,
          template: 'admin-alert',
          variables: {
            subject: body.subject,
            message: body.message,
            type: body.type,
            sentBy: admin.email,
            timestamp: new Date().toISOString(),
            supportEmail: process.env.SUPPORT_EMAIL || 'support@sgi360.com',
          },
        });

        // Log alert
        await app.prisma.auditLog.create({
          data: {
            userId: req.auth.userId,
            action: 'ADMIN_ALERT_SENT',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'] || '',
            details: {
              targetUserId: req.params.userId,
              targetUserEmail: targetUser.email,
              alertType: body.type,
              subject: body.subject,
              adminId: req.auth.userId,
            },
          },
        });

        return reply.send({
          success: true,
          message: 'Alert sent to user',
          userId: req.params.userId,
          userEmail: targetUser.email,
          alertType: body.type,
        });
      } catch (err: any) {
        if (err.message === 'Admin access required') {
          return reply.code(403).send({ error: 'Admin access required' });
        }
        if (err instanceof z.ZodError) {
          return reply.code(400).send({
            error: 'Validation error',
            issues: err.issues.map((i) => ({
              path: i.path.join('.'),
              message: i.message,
            })),
          });
        }
        app.log.error(err);
        return reply.code(500).send({ error: err.message || 'Failed to send alert' });
      }
    }
  );

  /**
   * GET /admin/2fa/stats
   * Get overall 2FA statistics
   */
  app.get('/2fa/stats', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.auth?.userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    try {
      // Check admin status
      const admin = await app.prisma.platformUser.findUnique({
        where: { id: req.auth.userId },
        select: { globalRole: true },
      });

      requireAdmin(admin);

      // Get 2FA statistics
      const totalUsers = await app.prisma.platformUser.count();
      const twoFactorEnabled = await app.prisma.platformUser.count({
        where: { twoFactorEnabled: true },
      });
      const twoFactorDisabled = totalUsers - twoFactorEnabled;

      // Get recovery code stats
      const allRecoveryCodes = await app.prisma.twoFactorRecoveryCode.findMany({
        select: { used: true },
      });
      const unusedCodes = allRecoveryCodes.filter((c) => !c.used).length;
      const usedCodes = allRecoveryCodes.filter((c) => c.used).length;

      // Get recent activity
      const recentActivity = await app.prisma.auditLog.findMany({
        where: {
          action: {
            in: [
              '2FA_ENABLED',
              '2FA_DISABLED',
              '2FA_VERIFIED',
              'ADMIN_2FA_DISABLED',
            ],
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          userId: true,
          action: true,
          createdAt: true,
        },
      });

      return reply.send({
        stats: {
          total_users: totalUsers,
          two_factor_enabled: twoFactorEnabled,
          two_factor_disabled: twoFactorDisabled,
          two_factor_percentage: totalUsers > 0 ? ((twoFactorEnabled / totalUsers) * 100).toFixed(2) : 0,
          recovery_codes_total: allRecoveryCodes.length,
          recovery_codes_unused: unusedCodes,
          recovery_codes_used: usedCodes,
        },
        recent_activity: recentActivity,
        generated_at: new Date().toISOString(),
      });
    } catch (err: any) {
      if (err.message === 'Admin access required') {
        return reply.code(403).send({ error: 'Admin access required' });
      }
      app.log.error(err);
      return reply.code(500).send({ error: err.message || 'Failed to get statistics' });
    }
  });

  /**
   * GET /admin/tenants (y /super-admin/tennts)
   * Listar todos los tenants con info de suscripción
   */
  app.get('/tenants', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.auth?.userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    try {
      // Check SUPER_ADMIN role
      const admin = await app.prisma.platformUser.findUnique({
        where: { id: req.auth.userId },
        select: { globalRole: true },
      });

      if (admin?.globalRole !== 'SUPER_ADMIN') {
        return reply.code(403).send({ error: 'Super Admin access required' });
      }

      const tenants = await app.prisma.tenant.findMany({
        where: { deletedAt: null },
        include: {
          _count: { select: { memberships: true } },
          subscriptions: {
            where: { deletedAt: null, status: { in: ['ACTIVE', 'TRIAL', 'PAST_DUE'] } },
            orderBy: { startedAt: 'desc' },
            take: 1,
            include: { plan: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return reply.send({
        tenants: tenants.map((t: any) => ({
          id: t.id,
          name: t.name,
          slug: t.slug,
          status: t.status,
          createdAt: t.createdAt,
          memberCount: t._count?.memberships || 0,
          subscription: t.subscriptions[0]
            ? {
                id: t.subscriptions[0].id,
                status: t.subscriptions[0].status,
                startedAt: t.subscriptions[0].startedAt,
                endsAt: t.subscriptions[0].endsAt,
                plan: {
                  id: t.subscriptions[0].plan.id,
                  tier: t.subscriptions[0].plan.tier,
                  name: t.subscriptions[0].plan.name,
                },
              }
            : null,
        })),
      });
    } catch (err: any) {
      app.log.error(err);
      return reply.code(500).send({ error: err.message || 'Failed to fetch tenants' });
    }
  });

  /**
   * GET /admin/plans (y /super-admin/plans)
   * Listar todos los planes disponibles
   */
  app.get('/plans', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.auth?.userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    try {
      // Check SUPER_ADMIN role
      const admin = await app.prisma.platformUser.findUnique({
        where: { id: req.auth.userId },
        select: { globalRole: true },
      });

      if (admin?.globalRole !== 'SUPER_ADMIN') {
        return reply.code(403).send({ error: 'Super Admin access required' });
      }

      const plans = await app.prisma.plan.findMany({
        where: { isActive: true },
        orderBy: { tier: 'asc' },
      });

      return reply.send({
        plans: plans.map((p: any) => ({
          id: p.id,
          tier: p.tier,
          name: p.name,
          features: p.features,
          limits: p.limits,
        })),
      });
    } catch (err: any) {
      app.log.error(err);
      return reply.code(500).send({ error: err.message || 'Failed to fetch plans' });
    }
  });
};
