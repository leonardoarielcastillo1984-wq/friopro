import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import type { Prisma } from '@prisma/client';
import argon2 from 'argon2';
import { z } from 'zod';
import crypto from 'crypto';

async function createNotification(
  prisma: any,
  input: {
    tenantId: string;
    userId: string;
    type: string;
    title: string;
    message: string;
    link?: string | null;
  }
) {
  try {
    const model = prisma?.notification;
    if (!model?.create) return;
    await model.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        type: input.type,
        title: input.title,
        message: input.message,
        link: input.link ?? null,
      },
    });
  } catch {
    // Best-effort: notifications should not block settings flows
  }
}

const ROLE_LABELS_ES: Record<string, string> = {
  TENANT_ADMIN: 'Administrador',
  TENANT_USER: 'Usuario',
};

// ── Validation Schemas ──

const inviteMemberSchema = z.object({
  email: z.string().email('Email inválido'),
  role: z.enum(['TENANT_ADMIN', 'TENANT_USER'], {
    errorMap: () => ({ message: 'Rol debe ser TENANT_ADMIN o TENANT_USER' }),
  }),
});

const updateMemberSchema = z.object({
  role: z.enum(['TENANT_ADMIN', 'TENANT_USER']).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
});

const updateTenantSchema = z.object({
  name: z.string().min(2, 'Nombre debe tener al menos 2 caracteres').optional(),
});

export const settingsRoutes: FastifyPluginAsync = async (app) => {
  // GET /settings/members — Usuarios del tenant
  app.get('/members', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });

    const members = await app.runWithDbContext(req, async (tx: Prisma.TransactionClient) => {
      return tx.tenantMembership.findMany({
        where: { tenantId: req.db!.tenantId, deletedAt: null },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true, isActive: true, createdAt: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    return reply.send({
      members: members.map((m: any) => ({
        id: m.id,
        userId: m.user.id,
        email: m.user.email,
        name: `${m.user.firstName} ${m.user.lastName}`.trim() || m.user.email,
        role: m.role,
        status: m.status,
        isActive: m.user.isActive,
        joinedAt: m.createdAt,
      })),
    });
  });

  // GET /settings/plan — Info del plan actual
  app.get('/plan', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });

    // Usar prisma (superuser) para acceder a TenantSubscription (bypasea RLS)
    const sub = await app.prisma.tenantSubscription.findFirst({
      where: { tenantId: req.db.tenantId, deletedAt: null, status: { in: ['ACTIVE', 'TRIAL', 'PAST_DUE'] } },
      include: { plan: true },
      orderBy: { startedAt: 'desc' },
    });

    if (!sub) {
      return reply.send({ plan: null, subscription: null });
    }

    return reply.send({
      plan: {
        id: sub.plan.id,
        tier: sub.plan.tier,
        name: sub.plan.name,
        features: sub.plan.features,
        limits: sub.plan.limits,
      },
      subscription: {
        id: sub.id,
        status: sub.status,
        startedAt: sub.startedAt,
        endsAt: sub.endsAt,
      },
    });
  });

  // GET /settings/tenant — Info del tenant
  app.get('/tenant', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });

    const tenant = await app.runWithDbContext(req, async (tx: Prisma.TransactionClient) => {
      return tx.tenant.findFirst({
        where: { id: req.db!.tenantId, deletedAt: null },
        select: { id: true, name: true, slug: true, status: true, createdAt: true },
      });
    });

    return reply.send({ tenant });
  });

  // ── POST /settings/members — Invitar miembro al tenant ──
  app.post('/members', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });
    const tenantId = req.db.tenantId;

    const body = inviteMemberSchema.parse(req.body);

    // Verificar que el que invita es TENANT_ADMIN
    const inviter = await app.runWithDbContext(req, async (tx: Prisma.TransactionClient) => {
      return tx.tenantMembership.findFirst({
        where: { tenantId: req.db!.tenantId, userId: req.auth?.userId, deletedAt: null },
      });
    });

    if (!inviter || inviter.role !== 'TENANT_ADMIN') {
      return reply.code(403).send({ error: 'Solo administradores pueden invitar miembros' });
    }

    // Verificar si el usuario ya existe
    let user = await app.prisma.platformUser.findUnique({
      where: { email: body.email.toLowerCase() },
    });

    if (!user) {
      // Crear usuario con contraseña temporal
      const tempPassword = crypto.randomBytes(16).toString('hex');
      const passwordHash = await argon2.hash(tempPassword);

      user = await app.prisma.platformUser.create({
        data: {
          email: body.email.toLowerCase(),
          passwordHash,
          createdById: req.auth?.userId ?? null,
        },
      });
    }

    // Verificar si ya es miembro del tenant
    const existingMembership = await app.runWithDbContext(req, async (tx: Prisma.TransactionClient) => {
      return tx.tenantMembership.findFirst({
        where: { tenantId, userId: user!.id },
      });
    });

    if (existingMembership && !existingMembership.deletedAt) {
      return reply.code(409).send({ error: 'El usuario ya es miembro del tenant' });
    }

    // Crear membresía (o reactivar)
    if (existingMembership?.deletedAt) {
      await app.runWithDbContext(req, async (tx: Prisma.TransactionClient) => {
        return tx.tenantMembership.update({
          where: { id: existingMembership.id },
          data: {
            role: body.role as any,
            status: 'INVITED',
            deletedAt: null,
            updatedById: req.auth?.userId ?? null,
          },
        });
      });
    } else {
      await app.runWithDbContext(req, async (tx: Prisma.TransactionClient) => {
        return tx.tenantMembership.create({
          data: {
            tenantId,
            userId: user!.id,
            role: body.role as any,
            status: 'INVITED',
            createdById: req.auth?.userId ?? null,
          },
        });
      });
    }

    // Notify the invited user (non-blocking)
    const tenantName = await app.runWithDbContext(req, async (tx: Prisma.TransactionClient) => {
      const t = await tx.tenant.findFirst({ where: { id: tenantId }, select: { name: true } });
      return t?.name || 'un equipo';
    });

    createNotification(app.prisma, {
      tenantId,
      userId: user.id,
      type: 'MEMBER_INVITED',
      title: 'Invitación al equipo',
      message: `Fuiste invitado a ${tenantName} como ${ROLE_LABELS_ES[body.role] || body.role}`,
      link: '/dashboard',
    });

    return reply.code(201).send({
      member: {
        userId: user.id,
        email: user.email,
        role: body.role,
        status: 'INVITED',
      },
    });
  });

  // ── PATCH /settings/members/:memberId — Actualizar miembro ──
  app.patch('/members/:memberId', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });

    const { memberId } = req.params as { memberId: string };
    const body = updateMemberSchema.parse(req.body);

    if (!body.role && !body.status) {
      return reply.code(400).send({ error: 'Debe proporcionar al menos role o status' });
    }

    // Verificar que el que actualiza es TENANT_ADMIN
    const updater = await app.runWithDbContext(req, async (tx: Prisma.TransactionClient) => {
      return tx.tenantMembership.findFirst({
        where: { tenantId: req.db!.tenantId, userId: req.auth?.userId, deletedAt: null },
      });
    });

    if (!updater || updater.role !== 'TENANT_ADMIN') {
      return reply.code(403).send({ error: 'Solo administradores pueden modificar miembros' });
    }

    // No permitir que se modifique a sí mismo (para evitar auto-degradar)
    const target = await app.runWithDbContext(req, async (tx: Prisma.TransactionClient) => {
      return tx.tenantMembership.findFirst({
        where: { id: memberId, tenantId: req.db!.tenantId, deletedAt: null },
      });
    });

    if (!target) return reply.code(404).send({ error: 'Miembro no encontrado' });

    if (target.userId === req.auth?.userId) {
      return reply.code(400).send({ error: 'No podés modificar tu propia membresía' });
    }

    const updateData: any = { updatedById: req.auth?.userId ?? null };
    if (body.role) updateData.role = body.role;
    if (body.status) updateData.status = body.status;

    const updated = await app.runWithDbContext(req, async (tx: Prisma.TransactionClient) => {
      return tx.tenantMembership.update({
        where: { id: memberId },
        data: updateData,
        include: {
          user: { select: { id: true, email: true } },
        },
      });
    });

    return reply.send({
      member: {
        id: updated.id,
        userId: updated.user.id,
        email: updated.user.email,
        role: updated.role,
        status: updated.status,
      },
    });
  });

  // ── DELETE /settings/members/:memberId — Eliminar miembro del tenant ──
  app.delete('/members/:memberId', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });

    const { memberId } = req.params as { memberId: string };

    // Verificar permisos
    const deleter = await app.runWithDbContext(req, async (tx: Prisma.TransactionClient) => {
      return tx.tenantMembership.findFirst({
        where: { tenantId: req.db!.tenantId, userId: req.auth?.userId, deletedAt: null },
      });
    });

    if (!deleter || deleter.role !== 'TENANT_ADMIN') {
      return reply.code(403).send({ error: 'Solo administradores pueden eliminar miembros' });
    }

    const target = await app.runWithDbContext(req, async (tx: Prisma.TransactionClient) => {
      return tx.tenantMembership.findFirst({
        where: { id: memberId, tenantId: req.db!.tenantId, deletedAt: null },
      });
    });

    if (!target) return reply.code(404).send({ error: 'Miembro no encontrado' });

    if (target.userId === req.auth?.userId) {
      return reply.code(400).send({ error: 'No podés eliminarte a vos mismo del tenant' });
    }

    // Soft delete
    await app.runWithDbContext(req, async (tx: Prisma.TransactionClient) => {
      return tx.tenantMembership.update({
        where: { id: memberId },
        data: { deletedAt: new Date(), updatedById: req.auth?.userId ?? null },
      });
    });

    return reply.code(204).send();
  });

  // ── PATCH /settings/tenant — Actualizar datos del tenant ──
  app.patch('/tenant', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.db?.tenantId) return reply.code(400).send({ error: 'Tenant context required' });

    const body = updateTenantSchema.parse(req.body);

    // Verificar que es TENANT_ADMIN
    const membership = await app.runWithDbContext(req, async (tx: Prisma.TransactionClient) => {
      return tx.tenantMembership.findFirst({
        where: { tenantId: req.db!.tenantId, userId: req.auth?.userId, deletedAt: null },
      });
    });

    if (!membership || membership.role !== 'TENANT_ADMIN') {
      return reply.code(403).send({ error: 'Solo administradores pueden modificar datos del tenant' });
    }

    const updated = await app.runWithDbContext(req, async (tx: Prisma.TransactionClient) => {
      return tx.tenant.update({
        where: { id: req.db!.tenantId },
        data: {
          ...(body.name ? { name: body.name } : {}),
          updatedById: req.auth?.userId ?? null,
        },
        select: { id: true, name: true, slug: true, status: true, createdAt: true },
      });
    });

    return reply.send({ tenant: updated });
  });
};
