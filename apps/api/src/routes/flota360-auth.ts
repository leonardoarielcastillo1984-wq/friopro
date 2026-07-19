import { FastifyInstance } from 'fastify';
import { z } from 'zod';

let _bcrypt: any = null;
async function getBcrypt() {
  if (_bcrypt) return _bcrypt;
  _bcrypt = (await import('bcryptjs')).default;
  return _bcrypt;
}

const LoginS = z.object({
  email: z.string().email().min(3),
  password: z.string().min(6),
});

const RegisterS = z.object({
  email: z.string().email().min(3),
  password: z.string().min(6),
  name: z.string().min(1),
  tenantId: z.string().uuid(),
  roleId: z.string().uuid().optional(),
  phone: z.string().optional(),
});

const SignupS = z.object({
  companyName: z.string().min(2),
  name: z.string().min(2),
  email: z.string().email().min(3),
  password: z.string().min(8),
  phone: z.string().optional(),
});

function slugify(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'tenant';
}

// DB-backed reset tokens (1h expiry), aislados por módulo
async function ensureFlota360ResetTable(prisma: any) {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS flota360_password_resets (
        token TEXT PRIMARY KEY,
        "userId" UUID NOT NULL,
        email TEXT NOT NULL,
        "expiresAt" TIMESTAMPTZ NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  } catch {}
}

export async function registerFlota360AuthRoutes(app: FastifyInstance) {
  const p = '/flota360/auth';

  // ── LOGIN ──
  app.post(`${p}/login`, async (req, reply) => {
    const body = LoginS.parse(req.body);
    const prisma = (app as any).prisma ?? (req as any).prisma;

    const user = await prisma.flota360User.findFirst({
      where: { email: body.email, status: 'ACTIVE', deletedAt: null },
      include: { memberships: { include: { role: true } } },
    });

    if (!user || !user.passwordHash) {
      return reply.code(401).send({ error: 'Credenciales inválidas' });
    }

    const valid = await (await getBcrypt()).compare(body.password, user.passwordHash);
    if (!valid) {
      return reply.code(401).send({ error: 'Credenciales inválidas' });
    }

    const primaryMembership = user.memberships.find((m: any) => m.isPrimary) || user.memberships[0];
    const roleName = primaryMembership?.role?.name || 'OPERADOR';
    const tenantId = primaryMembership?.tenantId || user.tenantId;

    const token = app.flota360SignToken({
      userId: user.id,
      tenantId,
      email: user.email,
      role: roleName,
    });

    return reply.send({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: roleName,
        tenantId,
      },
    });
  });

  // ── REGISTER (admin crea usuario dentro de un tenant existente) ──
  app.post(`${p}/register`, async (req, reply) => {
    const body = RegisterS.parse(req.body);
    const prisma = (app as any).prisma ?? (req as any).prisma;

    const exists = await prisma.flota360User.findFirst({
      where: { email: body.email, tenantId: body.tenantId },
    });
    if (exists) {
      return reply.code(409).send({ error: 'El email ya está registrado para este tenant' });
    }

    const passwordHash = await (await getBcrypt()).hash(body.password, 12);

    const user = await prisma.flota360User.create({
      data: {
        email: body.email,
        passwordHash,
        name: body.name,
        phone: body.phone ?? null,
        tenantId: body.tenantId,
        status: 'ACTIVE',
      },
    });

    const roleId = body.roleId;
    if (roleId) {
      await prisma.flota360TenantMembership.create({
        data: {
          tenantId: body.tenantId,
          userId: user.id,
          roleId,
          isPrimary: true,
        },
      });
    }

    const { sendFlota360WelcomeEmail } = await import('../services/email-service.js');
    await sendFlota360WelcomeEmail({
      to: body.email,
      name: body.name,
      password: body.password,
      loginUrl: 'https://logismart.ar/flota360-landing/',
    }).catch(() => {});

    return reply.code(201).send({ user: { id: user.id, email: user.email, name: user.name } });
  });

  // ── SIGNUP (self-service: crea tenant + admin user + trial 7d) ──
  app.post(`${p}/signup`, async (req, reply) => {
    const body = SignupS.parse(req.body);
    const prisma = (app as any).prisma ?? (req as any).prisma;

    // Email no debe existir en NINGUN tenant flota360 (evita confusiones de login)
    const existing = await prisma.flota360User.findFirst({ where: { email: body.email, deletedAt: null } });
    if (existing) {
      return reply.code(409).send({ error: 'Ya existe una cuenta con este email. Iniciá sesión o recuperá tu contraseña.' });
    }

    // slug único namespaced f360-
    const baseSlug = slugify(body.companyName);
    let slug = `f360-${baseSlug}`;
    let n = 1;
    while (await prisma.tenant.findUnique({ where: { slug } })) {
      slug = `f360-${baseSlug}-${n++}`;
    }

    const passwordHash = await (await getBcrypt()).hash(body.password, 12);

    let tenant: any, user: any;
    try {
      const result = await prisma.$transaction(async (tx: any) => {
        const t = await tx.tenant.create({
          data: { name: body.companyName, slug, status: 'ACTIVE', licensePlan: 'TRIAL' },
        });
        const role = await tx.flota360Role.create({
          data: { tenantId: t.id, name: 'ADMIN', description: 'Administrador de la flota', isSystem: true },
        });
        const u = await tx.flota360User.create({
          data: { tenantId: t.id, email: body.email, name: body.name, phone: body.phone ?? null, passwordHash, status: 'ACTIVE' },
        });
        await tx.flota360TenantMembership.create({
          data: { tenantId: t.id, userId: u.id, roleId: role.id, isPrimary: true },
        });
        return { tenant: t, user: u };
      });
      tenant = result.tenant;
      user = result.user;
    } catch (err: any) {
      (app as any).log?.error({ err: err.message }, '[FLOTA360-SIGNUP] Error creando tenant');
      return reply.code(500).send({ error: 'No se pudo crear la cuenta. Intentá nuevamente.' });
    }

    // Email de bienvenida (no bloqueante)
    (async () => {
      try {
        const mod = await import('../services/email-service.js');
        await mod.sendFlota360WelcomeEmail({
          to: body.email, name: body.name, password: body.password,
          companyName: body.companyName, loginUrl: 'https://logismart.ar/flota360-landing/',
        }).catch(() => {});
      } catch {}
    })();

    // Auto-login: devolver token
    const token = app.flota360SignToken({
      userId: user.id, tenantId: tenant.id, email: user.email, role: 'ADMIN',
    });
    return reply.code(201).send({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: 'ADMIN', tenantId: tenant.id },
    });
  });

  // ── FORGOT PASSWORD (token DB, 1h) ──
  app.post(`${p}/forgot-password`, async (req: any, reply: any) => {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    const prisma = (app as any).prisma ?? (req as any).prisma;
    await ensureFlota360ResetTable(prisma);
    const crypto = await import('node:crypto');
    const token = crypto.randomBytes(32).toString('hex');
    const user = await prisma.flota360User.findFirst({
      where: { email, status: 'ACTIVE', deletedAt: null },
    });
    if (user) {
      const expiresAt = new Date(Date.now() + 3_600_000);
      await prisma.$executeRawUnsafe(
        `INSERT INTO flota360_password_resets (token, "userId", email, "expiresAt") VALUES ($1, $2::uuid, $3, $4)`,
        token, user.id, user.email, expiresAt
      );
      const { sendFlota360PasswordReset } = await import('../services/email-service.js');
      await sendFlota360PasswordReset(user.email, user.name || user.email, token).catch(() => {});
    }
    return reply.send({ ok: true, message: 'Si el correo existe en el sistema, recibirás instrucciones para restablecer tu contraseña.' });
  });

  // ── RESET PASSWORD ──
  app.post(`${p}/reset-password`, async (req: any, reply: any) => {
    const { token, password } = z.object({ token: z.string(), password: z.string().min(8) }).parse(req.body);
    const prisma = (app as any).prisma ?? (req as any).prisma;
    await ensureFlota360ResetTable(prisma);
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT "userId", "expiresAt" FROM flota360_password_resets WHERE token = $1 LIMIT 1`, token
    );
    const entry = rows[0];
    if (!entry || new Date(entry.expiresAt).getTime() < Date.now()) {
      if (entry) await prisma.$executeRawUnsafe(`DELETE FROM flota360_password_resets WHERE token = $1`, token).catch(() => {});
      return reply.code(400).send({ error: 'Token inválido o expirado. Solicitá un nuevo enlace.' });
    }
    const passwordHash = await (await getBcrypt()).hash(password, 12);
    await prisma.flota360User.update({ where: { id: entry.userId }, data: { passwordHash } });
    await prisma.$executeRawUnsafe(`DELETE FROM flota360_password_resets WHERE token = $1`, token).catch(() => {});
    return reply.send({ ok: true, message: 'Contraseña actualizada correctamente.' });
  });

  // ── LOGOUT ──
  app.post(`${p}/logout`, async (_req, reply) => {
    return reply.send({ success: true, message: 'Sesión FLOTA360 cerrada' });
  });

  // ── ME ──
  app.get(`${p}/me`, async (req, reply) => {
    const auth = (req as any).flota360Auth;
    if (!auth) {
      return reply.code(401).send({ error: 'No autenticado' });
    }
    const prisma = (app as any).prisma ?? (req as any).prisma;
    const user = await prisma.flota360User.findFirst({
      where: { id: auth.userId, deletedAt: null },
      include: { memberships: { include: { role: true } } },
    });
    if (!user) {
      return reply.code(401).send({ error: 'Usuario no encontrado' });
    }
    const primary = user.memberships.find((m: any) => m.isPrimary) || user.memberships[0];
    return reply.send({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: primary?.role?.name || 'OPERADOR',
        tenantId: primary?.tenantId || user.tenantId,
      },
    });
  });
}
