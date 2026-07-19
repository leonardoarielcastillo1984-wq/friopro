import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { signP360Token, verifyP360Token, provisionP360Workspace } from '../plugins/project360Auth.js';
import bcryptjs from 'bcryptjs';
import crypto from 'node:crypto';

function slugify(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'tenant';
}

async function ensureP360ResetTable(prisma: any) {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS p360_password_resets (
        token TEXT PRIMARY KEY,
        "userId" UUID NOT NULL,
        email TEXT NOT NULL,
        "expiresAt" TIMESTAMPTZ NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  } catch {}
}

export default async function project360AuthRoutes(app: FastifyInstance) {
  const prisma = (app as any).prisma;

  // ── POST /project360/auth/signup — self-service: tenant + P360 user + workspace ──
  app.post('/auth/signup', async (req: FastifyRequest, reply: FastifyReply) => {
    const { companyName, name, email, password, phone } = (req.body as any) || {};
    if (!companyName || !name || !email || !password) {
      return reply.code(400).send({ error: 'Datos incompletos' });
    }
    if (String(password).length < 8) {
      return reply.code(400).send({ error: 'La contraseña debe tener al menos 8 caracteres' });
    }
    const existing = await prisma.p360User.findFirst({ where: { email, deletedAt: null } });
    if (existing) {
      return reply.code(409).send({ error: 'Ya existe una cuenta con este email. Iniciá sesión o recuperá tu contraseña.' });
    }

    const slugBase = slugify(companyName);
    let slug = `p360-${slugBase}`; let n = 1;
    while (await prisma.tenant.findUnique({ where: { slug } })) { slug = `p360-${slugBase}-${n++}`; }

    const passwordHash = await bcryptjs.hash(password, 12);

    let tenant: any, user: any, workspace: any, member: any;
    try {
      tenant = await prisma.tenant.create({
        data: { name: companyName, slug, status: 'ACTIVE', licensePlan: 'TRIAL' },
      });
      user = await prisma.p360User.create({
        data: { tenantId: tenant.id, email, name, phone: phone ?? null, passwordHash, status: 'ACTIVE' },
      });
      const prov = await provisionP360Workspace(prisma, tenant.id, user.id, companyName);
      workspace = prov.workspace;
      member = prov.member;
    } catch (err) {
      app.log.error('[P360 Auth] Error en signup:', err);
      return reply.code(500).send({ error: 'No se pudo crear la cuenta. Intentá nuevamente.' });
    }

    (async () => {
      try {
        const mod: any = await import('../services/email-service.js');
        if (mod.sendProject360WelcomeEmail) {
          await mod.sendProject360WelcomeEmail({
            to: email, name, password, companyName,
            loginUrl: 'https://logismart.ar/project360-landing/',
          }).catch(() => {});
        }
      } catch {}
    })();

    const token = signP360Token({
      userId: user.id, workspaceId: workspace.id, memberId: member.id, role: member.role, tenantId: tenant.id,
    });
    return reply.code(201).send({
      token,
      user: { userId: user.id, email: user.email, name: user.name, role: member.role, memberId: member.id },
      workspace: { id: workspace.id, name: workspace.name, status: workspace.status },
    });
  });

  // ── POST /project360/auth/login — email + password contra P360User ──
  app.post('/auth/login', async (req: FastifyRequest, reply: FastifyReply) => {
    const { email, password } = (req.body as any) || {};
    if (!email || !password) {
      return reply.code(400).send({ error: 'Email y contraseña requeridos' });
    }

    const user = await prisma.p360User.findFirst({ where: { email, status: 'ACTIVE', deletedAt: null } });
    if (!user || !user.passwordHash) {
      return reply.code(401).send({ error: 'Credenciales inválidas' });
    }
    const valid = await bcryptjs.compare(password, user.passwordHash);
    if (!valid) {
      return reply.code(401).send({ error: 'Credenciales inválidas' });
    }

    try {
      const { workspace, member } = await provisionP360Workspace(prisma, user.tenantId, user.id);

      const subscription = await prisma.p360Subscription.findFirst({
        where: { workspaceId: workspace.id },
        include: { plan: true },
        orderBy: { createdAt: 'desc' },
      });
      const usage = await prisma.p360UsageLimit.findUnique({ where: { workspaceId: workspace.id } });

      const token = signP360Token({
        userId: user.id, workspaceId: workspace.id, memberId: member.id, role: member.role, tenantId: user.tenantId,
      });

      return reply.send({
        token,
        user: { userId: user.id, email: user.email, name: user.name, role: member.role, memberId: member.id },
        workspace: {
          id: workspace.id, name: workspace.name, status: workspace.status,
          defaultCurrency: workspace.defaultCurrency, timezone: workspace.timezone, logoUrl: workspace.logoUrl,
        },
        plan: subscription?.plan ?? null,
        subscription: subscription
          ? { status: subscription.status, billingPeriod: subscription.billingPeriod, trialEndsAt: subscription.trialEndsAt, currentPeriodEnd: subscription.currentPeriodEnd }
          : null,
        usage: usage ?? null,
      });
    } catch (err) {
      app.log.error('[P360 Auth] Error en login:', err);
      return reply.code(500).send({ error: 'Error al iniciar sesión en PROJECT360' });
    }
  });

  // ── POST /project360/auth/sgi-login — acceso INTERNO desde SGI360 ──
  // Usa el token SGI360 ya validado por el plugin global (req.auth) y provisiona/abre el workspace.
  app.post('/auth/sgi-login', async (req: FastifyRequest, reply: FastifyReply) => {
    const auth = (req as any).auth as { userId?: string; tenantId?: string } | null;
    if (!auth || !auth.userId) {
      return reply.code(401).send({ error: 'Sesión SGI360 requerida' });
    }
    const tenantId = auth.tenantId || (req.headers['x-tenant-id'] as string | undefined);
    if (!tenantId) {
      return reply.code(400).send({ error: 'Tenant no especificado' });
    }
    try {
      const { workspace, member } = await provisionP360Workspace(prisma, tenantId, auth.userId);

      const sgiUser = await prisma.platformUser.findUnique({ where: { id: auth.userId } }).catch(() => null);
      const subscription = await prisma.p360Subscription.findFirst({
        where: { workspaceId: workspace.id },
        include: { plan: true },
        orderBy: { createdAt: 'desc' },
      });
      const usage = await prisma.p360UsageLimit.findUnique({ where: { workspaceId: workspace.id } });

      const token = signP360Token({
        userId: auth.userId, workspaceId: workspace.id, memberId: member.id, role: member.role, tenantId,
      });

      return reply.send({
        token,
        user: { userId: auth.userId, email: sgiUser?.email ?? null, name: sgiUser?.name ?? null, role: member.role, memberId: member.id },
        workspace: {
          id: workspace.id, name: workspace.name, status: workspace.status,
          defaultCurrency: workspace.defaultCurrency, timezone: workspace.timezone, logoUrl: workspace.logoUrl,
        },
        plan: subscription?.plan ?? null,
        subscription: subscription
          ? { status: subscription.status, billingPeriod: subscription.billingPeriod, trialEndsAt: subscription.trialEndsAt, currentPeriodEnd: subscription.currentPeriodEnd }
          : null,
        usage: usage ?? null,
      });
    } catch (err) {
      app.log.error('[P360 Auth] Error en sgi-login:', err);
      return reply.code(500).send({ error: 'Error al iniciar sesión en PROJECT360' });
    }
  });

  // ── POST /project360/auth/forgot-password ──
  app.post('/auth/forgot-password', async (req: FastifyRequest, reply: FastifyReply) => {
    const { email } = (req.body as any) || {};
    if (!email) return reply.code(400).send({ error: 'Email requerido' });
    await ensureP360ResetTable(prisma);
    const token = crypto.randomBytes(32).toString('hex');
    const user = await prisma.p360User.findFirst({ where: { email, status: 'ACTIVE', deletedAt: null } });
    if (user) {
      const expiresAt = new Date(Date.now() + 3_600_000);
      await prisma.$executeRawUnsafe(
        `INSERT INTO p360_password_resets (token, "userId", email, "expiresAt") VALUES ($1, $2::uuid, $3, $4)`,
        token, user.id, user.email, expiresAt
      );
      try {
        const mod: any = await import('../services/email-service.js');
        if (mod.sendProject360PasswordReset) {
          await mod.sendProject360PasswordReset(user.email, user.name || user.email, token).catch(() => {});
        }
      } catch {}
    }
    return reply.send({ ok: true, message: 'Si el correo existe en el sistema, recibirás instrucciones para restablecer tu contraseña.' });
  });

  // ── POST /project360/auth/reset-password ──
  app.post('/auth/reset-password', async (req: FastifyRequest, reply: FastifyReply) => {
    const { token, password } = (req.body as any) || {};
    if (!token || !password || String(password).length < 8) {
      return reply.code(400).send({ error: 'Datos inválidos' });
    }
    await ensureP360ResetTable(prisma);
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT "userId", "expiresAt" FROM p360_password_resets WHERE token = $1 LIMIT 1`, token
    );
    const entry = rows[0];
    if (!entry || new Date(entry.expiresAt).getTime() < Date.now()) {
      if (entry) await prisma.$executeRawUnsafe(`DELETE FROM p360_password_resets WHERE token = $1`, token).catch(() => {});
      return reply.code(400).send({ error: 'Token inválido o expirado. Solicitá un nuevo enlace.' });
    }
    const passwordHash = await bcryptjs.hash(password, 12);
    await prisma.p360User.update({ where: { id: entry.userId }, data: { passwordHash } });
    await prisma.$executeRawUnsafe(`DELETE FROM p360_password_resets WHERE token = $1`, token).catch(() => {});
    return reply.send({ ok: true, message: 'Contraseña actualizada correctamente.' });
  });

  // ── POST /project360/auth/logout ──
  app.post('/auth/logout', async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ success: true, message: 'Sesión PROJECT360 cerrada' });
  });

  // ── GET /project360/auth/me ──
  app.get('/auth/me', async (req: FastifyRequest, reply: FastifyReply) => {
    const authHeader = req.headers.authorization as string | undefined;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    if (!token) return reply.code(401).send({ error: 'Token PROJECT360 requerido' });

    let payload: any;
    try {
      payload = verifyP360Token(token);
    } catch {
      return reply.code(401).send({ error: 'Token PROJECT360 inválido o expirado' });
    }

    try {
      const [user, workspace, member, subscription, usage] = await Promise.all([
        prisma.p360User.findFirst({ where: { id: payload.userId, deletedAt: null } }),
        prisma.p360Workspace.findUnique({ where: { id: payload.workspaceId } }),
        prisma.p360WorkspaceMember.findUnique({ where: { id: payload.memberId } }),
        prisma.p360Subscription.findFirst({
          where: { workspaceId: payload.workspaceId },
          include: { plan: true },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.p360UsageLimit.findUnique({ where: { workspaceId: payload.workspaceId } }),
      ]);

      if (!workspace || !member || member.status !== 'ACTIVE') {
        return reply.code(401).send({ error: 'Sesión PROJECT360 inválida' });
      }

      // user puede ser P360User (standalone) o un usuario interno de SGI360 (no está en p360_users)
      let displayUser: any = user;
      if (!displayUser) {
        displayUser = await prisma.platformUser.findUnique({ where: { id: payload.userId } }).catch(() => null);
      }

      return reply.send({
        user: { userId: payload.userId, email: displayUser?.email ?? null, name: displayUser?.name ?? null, role: payload.role, memberId: payload.memberId },
        workspace,
        plan: subscription?.plan ?? null,
        subscription: subscription ?? null,
        usage: usage ?? null,
      });
    } catch (err) {
      app.log.error('[P360 Auth] Error en /auth/me:', err);
      return reply.code(500).send({ error: 'Error al verificar sesión' });
    }
  });
}
