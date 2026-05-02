import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';

// ── Validation Schemas ──

const createDepartmentSchema = z.object({
  name: z.string().min(2, 'Department name must be at least 2 characters').max(100),
  description: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid color format. Use hex format (e.g., #FF0000)').default('#3B82F6'),
});

const updateDepartmentSchema = z.object({
  name: z.string().min(2, 'Department name must be at least 2 characters').max(100).optional(),
  description: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid color format. Use hex format (e.g., #FF0000)').optional(),
});

const addMemberSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  role: z.enum(['MEMBER', 'MANAGER']).default('MEMBER'),
});

const updateMemberSchema = z.object({
  role: z.enum(['MEMBER', 'MANAGER']),
});

// ── Helper Function ──

/**
 * Check if user is tenant admin
 */
async function requireTenantAdmin(app: any, req: FastifyRequest) {
  if (!req.auth?.userId) {
    throw { statusCode: 401, message: 'Unauthorized' };
  }

  if (!req.db?.tenantId) {
    throw { statusCode: 400, message: 'Se requiere contexto de tenant' };
  }

  const membership = await app.prisma.tenantMembership.findUnique({
    where: {
      tenantId_userId: {
        tenantId: req.db.tenantId,
        userId: req.auth.userId,
      },
    },
  });

  if (!membership || membership.role !== 'TENANT_ADMIN') {
    throw { statusCode: 403, message: 'Admin access required' };
  }
}

// ── Routes ──

export const departmentRoutes: FastifyPluginAsync = async (app) => {
  /**
   * GET /departments
   * List all departments in the tenant
   * Access: All authenticated users in tenant
   */
  app.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) {
      return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    }

    const tenantId = req.db.tenantId;

    const departments = await app.runWithDbContext(
      req,
      async (tx: Prisma.TransactionClient) => {
        return tx.department.findMany({
          where: { tenantId, deletedAt: null },
          include: {
            members: {
              where: { deletedAt: null },
              include: { user: { select: { id: true, email: true } } },
            },
            _count: { select: { documents: true } },
          },
          orderBy: { name: 'asc' },
        });
      }
    );

    return reply.send({ departments });
  });

  /**
   * GET /departments/:id
   * Get a specific department with its members
   * Access: All authenticated users in tenant
   */
  app.get('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const paramsSchema = z.object({ id: z.string().uuid() });
    const params = paramsSchema.parse(req.params);

    if (!req.db?.tenantId) {
      return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    }

    const department = await app.runWithDbContext(
      req,
      async (tx: Prisma.TransactionClient) => {
        return tx.department.findFirst({
          where: { id: params.id, tenantId: req.db.tenantId, deletedAt: null },
          include: {
            members: {
              where: { deletedAt: null },
              include: { user: { select: { id: true, email: true } } },
            },
            documents: {
              where: { deletedAt: null },
              select: { id: true, title: true, status: true, updatedAt: true },
              take: 5,
              orderBy: { updatedAt: 'desc' },
            },
            _count: { select: { documents: true } },
          },
        });
      }
    );

    if (!department) {
      return reply.code(404).send({ error: 'Department not found' });
    }

    return reply.send({ department });
  });

  /**
   * POST /departments
   * Create a new department
   * Access: Tenant admin only
   */
  app.post('/', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await requireTenantAdmin(app, req);
    } catch (err: any) {
      return reply.code(err.statusCode || 403).send({ error: err.message });
    }

    if (!req.db?.tenantId) {
      return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    }

    const body = createDepartmentSchema.parse(req.body);
    const tenantId = req.db.tenantId;

    try {
      const created = await app.runWithDbContext(
        req,
        async (tx: Prisma.TransactionClient) => {
          return tx.department.create({
            data: {
              tenantId,
              name: body.name,
              description: body.description || null,
              color: body.color,
              createdById: req.auth?.userId ?? null,
              updatedById: req.auth?.userId ?? null,
            },
            include: {
              members: {
                where: { deletedAt: null },
                include: { user: { select: { id: true, email: true } } },
              },
            },
          });
        }
      );

      return reply.code(201).send({ department: created });
    } catch (error: any) {
      if (error.code === 'P2002') {
        return reply.code(409).send({ error: `Department "${body.name}" already exists in this tenant` });
      }
      throw error;
    }
  });

  /**
   * PUT /departments/:id
   * Update a department
   * Access: Tenant admin only
   */
  app.put('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await requireTenantAdmin(app, req);
    } catch (err: any) {
      return reply.code(err.statusCode || 403).send({ error: err.message });
    }

    if (!req.db?.tenantId) {
      return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    }

    const paramsSchema = z.object({ id: z.string().uuid() });
    const params = paramsSchema.parse(req.params);
    const body = updateDepartmentSchema.parse(req.body);
    const tenantId = req.db.tenantId;

    try {
      const updated = await app.runWithDbContext(
        req,
        async (tx: Prisma.TransactionClient) => {
          const existing = await tx.department.findFirst({
            where: { id: params.id, tenantId, deletedAt: null },
          });

          if (!existing) return null;

          return tx.department.update({
            where: { id: existing.id },
            data: {
              name: body.name ?? existing.name,
              description: body.description !== undefined ? body.description : existing.description,
              color: body.color ?? existing.color,
              updatedById: req.auth?.userId ?? null,
            },
            include: {
              members: {
                where: { deletedAt: null },
                include: { user: { select: { id: true, email: true } } },
              },
            },
          });
        }
      );

      if (!updated) {
        return reply.code(404).send({ error: 'Department not found' });
      }

      return reply.send({ department: updated });
    } catch (error: any) {
      if (error.code === 'P2002') {
        return reply.code(409).send({ error: `Department "${body.name}" already exists in this tenant` });
      }
      throw error;
    }
  });

  /**
   * DELETE /departments/:id
   * Delete a department (soft delete)
   * Access: Tenant admin only
   */
  app.delete('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await requireTenantAdmin(app, req);
    } catch (err: any) {
      return reply.code(err.statusCode || 403).send({ error: err.message });
    }

    if (!req.db?.tenantId) {
      return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    }

    const paramsSchema = z.object({ id: z.string().uuid() });
    const params = paramsSchema.parse(req.params);
    const tenantId = req.db.tenantId;

    const deleted = await app.runWithDbContext(
      req,
      async (tx: Prisma.TransactionClient) => {
        const existing = await tx.department.findFirst({
          where: { id: params.id, tenantId, deletedAt: null },
        });

        if (!existing) return null;

        // Clear department reference from documents
        await tx.document.updateMany({
          where: { departmentId: existing.id },
          data: { departmentId: null },
        });

        // Soft delete department members
        await tx.departmentMember.updateMany({
          where: { departmentId: existing.id },
          data: { deletedAt: new Date() },
        });

        // Soft delete department
        return tx.department.update({
          where: { id: existing.id },
          data: {
            deletedAt: new Date(),
            updatedById: req.auth?.userId ?? null,
          },
        });
      }
    );

    if (!deleted) {
      return reply.code(404).send({ error: 'Department not found' });
    }

    return reply.send({ ok: true });
  });

  /**
   * GET /departments/:id/documents
   * Get all documents in a department
   * Access: All authenticated users in tenant
   */
  app.get('/:id/documents', async (req: FastifyRequest, reply: FastifyReply) => {
    const paramsSchema = z.object({ id: z.string().uuid() });
    const params = paramsSchema.parse(req.params);
    const querySchema = z.object({
      page: z.string().default('1').transform(Number),
      pageSize: z.string().default('20').transform(Number),
      status: z.string().optional(),
    });
    const query = querySchema.parse(req.query);

    if (!req.db?.tenantId) {
      return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    }

    const tenantId = req.db.tenantId;

    // Verify department exists in tenant
    const department = await app.runWithDbContext(
      req,
      async (tx: Prisma.TransactionClient) => {
        return tx.department.findFirst({
          where: { id: params.id, tenantId, deletedAt: null },
          select: { id: true },
        });
      }
    );

    if (!department) {
      return reply.code(404).send({ error: 'Department not found' });
    }

    const documents = await app.runWithDbContext(
      req,
      async (tx: Prisma.TransactionClient) => {
        const where: Prisma.DocumentWhereInput = {
          tenantId,
          departmentId: params.id,
          deletedAt: null,
        };

        if (query.status) {
          (where as any).status = query.status;
        }

        const [items, total] = await Promise.all([
          tx.document.findMany({
            where,
            skip: (query.page - 1) * query.pageSize,
            take: query.pageSize,
            select: {
              id: true,
              title: true,
              type: true,
              status: true,
              version: true,
              createdAt: true,
              updatedAt: true,
            },
            orderBy: { updatedAt: 'desc' },
          }),
          tx.document.count({ where }),
        ]);

        return { items, total };
      }
    );

    return reply.send({
      documents: documents.items,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total: documents.total,
        pages: Math.ceil(documents.total / query.pageSize),
      },
    });
  });

  /**
   * POST /departments/:id/members
   * Add a member to a department
   * Access: Tenant admin only
   */
  app.post('/:id/members', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await requireTenantAdmin(app, req);
    } catch (err: any) {
      return reply.code(err.statusCode || 403).send({ error: err.message });
    }

    if (!req.db?.tenantId) {
      return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    }

    const paramsSchema = z.object({ id: z.string().uuid() });
    const params = paramsSchema.parse(req.params);
    const body = addMemberSchema.parse(req.body);
    const tenantId = req.db.tenantId;

    try {
      const member = await app.runWithDbContext(
        req,
        async (tx: Prisma.TransactionClient) => {
          // Verify department exists
          const department = await tx.department.findFirst({
            where: { id: params.id, tenantId, deletedAt: null },
          });
          if (!department) return null;

          // Verify user is in tenant
          const user = await tx.tenantMembership.findUnique({
            where: {
              tenantId_userId: {
                tenantId,
                userId: body.userId,
              },
            },
          });
          if (!user) {
            throw { statusCode: 400, message: 'User is not a member of this tenant' };
          }

          return tx.departmentMember.create({
            data: {
              departmentId: params.id,
              userId: body.userId,
              role: body.role,
              createdById: req.auth?.userId ?? null,
            },
            include: { user: { select: { id: true, email: true } } },
          });
        }
      );

      if (!member) {
        return reply.code(404).send({ error: 'Department not found' });
      }

      return reply.code(201).send({ member });
    } catch (error: any) {
      if (error.code === 'P2002') {
        return reply.code(409).send({ error: 'User is already a member of this department' });
      }
      if (error.statusCode) {
        return reply.code(error.statusCode).send({ error: error.message });
      }
      throw error;
    }
  });

  /**
   * PUT /departments/:id/members/:userId
   * Update a department member role
   * Access: Tenant admin only
   */
  app.put('/:id/members/:userId', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await requireTenantAdmin(app, req);
    } catch (err: any) {
      return reply.code(err.statusCode || 403).send({ error: err.message });
    }

    if (!req.db?.tenantId) {
      return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    }

    const paramsSchema = z.object({ id: z.string().uuid(), userId: z.string().uuid() });
    const params = paramsSchema.parse(req.params);
    const body = updateMemberSchema.parse(req.body);
    const tenantId = req.db.tenantId;

    const updated = await app.runWithDbContext(
      req,
      async (tx: Prisma.TransactionClient) => {
        const existing = await tx.departmentMember.findFirst({
          where: {
            departmentId: params.id,
            userId: params.userId,
            deletedAt: null,
            department: { tenantId, deletedAt: null },
          },
        });

        if (!existing) return null;

        return tx.departmentMember.update({
          where: { id: existing.id },
          data: { role: body.role },
          include: { user: { select: { id: true, email: true } } },
        });
      }
    );

    if (!updated) {
      return reply.code(404).send({ error: 'Department member not found' });
    }

    return reply.send({ member: updated });
  });

  /**
   * DELETE /departments/:id/members/:userId
   * Remove a member from a department
   * Access: Tenant admin only
   */
  app.delete('/:id/members/:userId', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await requireTenantAdmin(app, req);
    } catch (err: any) {
      return reply.code(err.statusCode || 403).send({ error: err.message });
    }

    if (!req.db?.tenantId) {
      return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    }

    const paramsSchema = z.object({ id: z.string().uuid(), userId: z.string().uuid() });
    const params = paramsSchema.parse(req.params);
    const tenantId = req.db.tenantId;

    const deleted = await app.runWithDbContext(
      req,
      async (tx: Prisma.TransactionClient) => {
        const existing = await tx.departmentMember.findFirst({
          where: {
            departmentId: params.id,
            userId: params.userId,
            deletedAt: null,
            department: { tenantId, deletedAt: null },
          },
        });

        if (!existing) return null;

        return tx.departmentMember.update({
          where: { id: existing.id },
          data: { deletedAt: new Date() },
        });
      }
    );

    if (!deleted) {
      return reply.code(404).send({ error: 'Department member not found' });
    }

    return reply.send({ ok: true });
  });
};
