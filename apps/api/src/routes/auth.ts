import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import argon2 from 'argon2';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { get2FAStatus, create2FASession } from '../services/twoFactorAuth.js';

// Stricter rate limits for sensitive auth endpoints
const authRateLimit = {
  config: {
    rateLimit: { max: 10, timeWindow: '1 minute' },
  },
};

const strictRateLimit = {
  config: {
    rateLimit: { max: 5, timeWindow: '1 minute' },
  },
};

export const authRoutes: FastifyPluginAsync = async (app) => {
  const isProd = (process.env.NODE_ENV ?? 'development') === 'production';

  function setAuthCookies(reply: FastifyReply, args: { accessToken: string; refreshToken: string }) {
    const domain = isProd ? '.logismart.ar' : undefined;
    
    reply.setCookie('access_token', args.accessToken, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      domain,
    });

    // Restrict refresh cookie to refresh endpoint.
    reply.setCookie('refresh_token', args.refreshToken, {
      path: '/auth/refresh',
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      domain,
    });
  }

  function clearAuthCookies(reply: FastifyReply) {
    reply.clearCookie('access_token', { path: '/' });
    reply.clearCookie('refresh_token', { path: '/auth/refresh' });
  }

  app.get('/csrf', async (_req: FastifyRequest, reply: FastifyReply) => {
    const csrfToken = await app.issueCsrfCookie(reply);
    return reply.send({ csrfToken });
  });

  // ── POST /auth/register — Self-service registration ──
  app.post('/register', authRateLimit, async (req: FastifyRequest, reply: FastifyReply) => {
    const registerSchema = z.object({
      email: z.string().email('Email inválido'),
      password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
      organizationName: z.string().min(2, 'El nombre de la organización es requerido'),
    });

    const body = registerSchema.parse(req.body);
    const emailLower = body.email.toLowerCase().trim();

    // Check if user already exists
    const existing = await app.prisma.platformUser.findUnique({
      where: { email: emailLower },
    });

    if (existing) {
      return reply.code(409).send({ error: 'Ya existe una cuenta con este email' });
    }

    // Create user
    const passwordHash = await argon2.hash(body.password);
    const user = await app.prisma.platformUser.create({
      data: { email: emailLower, passwordHash },
    });

    // Generate unique slug from organization name
    const baseSlug = body.organizationName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 40);
    const slugSuffix = Math.random().toString(36).substring(2, 6);
    const slug = `${baseSlug}-${slugSuffix}`;

    // Create tenant
    const tenant = await app.prisma.tenant.create({
      data: {
        name: body.organizationName.trim(),
        slug,
        createdById: user.id,
      },
    });

    // Create membership (TENANT_ADMIN)
    await app.prisma.tenantMembership.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        role: 'TENANT_ADMIN',
        status: 'ACTIVE',
        createdById: user.id,
      },
    });

    // Auto-assign BASIC plan trial
    const basicPlan = await app.prisma.plan.findFirst({
      where: { tier: 'BASIC', isActive: true },
    });

    if (basicPlan) {
      await app.prisma.tenantSubscription.create({
        data: {
          tenantId: tenant.id,
          planId: basicPlan.id,
          status: 'TRIAL',
          startedAt: new Date(),
          endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        },
      });
    }

    // Auto-login: generate tokens
    const accessToken = app.signAccessToken({
      userId: user.id,
      tenantId: tenant.id,
      tenantRole: 'TENANT_ADMIN',
    });

    const refreshToken = app.signRefreshToken({
      userId: user.id,
      refreshTokenVersion: user.refreshTokenVersion,
    });

    setAuthCookies(reply, { accessToken, refreshToken });
    const csrfToken = await app.issueCsrfCookie(reply);

    return reply.code(201).send({
      user: { id: user.id, email: user.email },
      activeTenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
      tenantRole: 'TENANT_ADMIN',
      csrfToken,
    });
  });

  // ── POST /auth/change-password — Cambiar contraseña ──
  app.post('/change-password', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.auth?.userId) return reply.code(401).send({ error: 'Unauthorized' });

    const schema = z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(8, 'La nueva contraseña debe tener al menos 8 caracteres'),
    });

    const body = schema.parse(req.body);

    const user = await app.prisma.platformUser.findUnique({
      where: { id: req.auth.userId },
    });

    if (!user) return reply.code(401).send({ error: 'Unauthorized' });

    const ok = await argon2.verify(user.passwordHash, body.currentPassword);
    if (!ok) return reply.code(400).send({ error: 'Contraseña actual incorrecta' });

    const newHash = await argon2.hash(body.newPassword);
    await app.prisma.platformUser.update({
      where: { id: user.id },
      data: {
        passwordHash: newHash,
        refreshTokenVersion: { increment: 1 }, // Invalidate all sessions
      },
    });

    return reply.send({ ok: true });
  });

  // ── POST /auth/forgot-password — Solicitar reset de contraseña ──
  app.post('/forgot-password', strictRateLimit, async (req: FastifyRequest, reply: FastifyReply) => {
    const schema = z.object({ email: z.string().email() });
    const { email } = schema.parse(req.body);

    const user = await app.prisma.platformUser.findUnique({ where: { email } });

    // Always return success to prevent email enumeration
    if (!user) return reply.send({ ok: true });

    const secret = process.env.JWT_SECRET!;
    const resetToken = jwt.sign(
      { userId: user.id, purpose: 'password_reset', ver: user.refreshTokenVersion },
      secret,
      { expiresIn: '30m' } as SignOptions,
    );

    const resetUrl = `${process.env.CORS_ORIGIN || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

    // Send reset email (console stub in dev, real provider in prod)
    const { sendEmail, passwordResetEmail } = await import('../services/email.js');
    const emailPayload = passwordResetEmail(email, resetUrl);
    const result = await sendEmail(emailPayload);

    if (!result.success) {
      app.log.error(`[PASSWORD_RESET] Failed to send email to ${email}: ${result.error}`);
    }

    return reply.send({ ok: true });
  });

  // ── POST /auth/reset-password — Resetear contraseña con token ──
  app.post('/reset-password', strictRateLimit, async (req: FastifyRequest, reply: FastifyReply) => {
    const schema = z.object({
      token: z.string().min(1),
      newPassword: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
    });
    const { token, newPassword } = schema.parse(req.body);

    const secret = process.env.JWT_SECRET!;
    let payload: { userId: string; purpose: string; ver: number };

    try {
      payload = jwt.verify(token, secret) as any;
    } catch {
      return reply.code(400).send({ error: 'Token inválido o expirado' });
    }

    if (payload.purpose !== 'password_reset') {
      return reply.code(400).send({ error: 'Token inválido' });
    }

    const user = await app.prisma.platformUser.findUnique({ where: { id: payload.userId } });
    if (!user) return reply.code(400).send({ error: 'Token inválido' });

    // Check token version matches — ensures token can only be used once
    if (user.refreshTokenVersion !== payload.ver) {
      return reply.code(400).send({ error: 'Este enlace ya fue utilizado' });
    }

    const newHash = await argon2.hash(newPassword);
    await app.prisma.platformUser.update({
      where: { id: user.id },
      data: {
        passwordHash: newHash,
        refreshTokenVersion: { increment: 1 }, // Invalidate token + all sessions
      },
    });

    return reply.send({ ok: true });
  });

  app.post('/login', authRateLimit, async (req: FastifyRequest, reply: FastifyReply) => {
    const bodySchema = z.object({
      email: z.string().email(),
      password: z.string().min(1),
      // Opcional: si el usuario pertenece a varios tenants, puede elegir uno en login.
      tenantId: z.string().uuid().optional(),
    });

    const body = bodySchema.parse(req.body);

    const user = await app.prisma.platformUser.findUnique({
      where: { email: body.email },
    });

    if (!user || !user.isActive || user.deletedAt) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    const ok = await argon2.verify(user.passwordHash, body.password);
    if (!ok) return reply.code(401).send({ error: 'Invalid credentials' });

    // 2FA is now optional - users can enable it in settings
    // For now, all users login directly without 2FA requirement

    // SUPER_ADMIN puede tener tenant asignado como SUPER_ADMIN role
    // Buscar memberships incluso para SUPER_ADMIN
    const memberships = await app.prisma.tenantMembership.findMany({
      where: {
        userId: user.id,
        status: 'ACTIVE',
        deletedAt: null,
        tenant: { deletedAt: null },
      },
      include: { tenant: true },
      orderBy: { createdAt: 'asc' },
    });

    let activeTenant = null;
    let tenantRole = null;

    if (memberships.length > 0) {
      let selected = memberships[0];
      if (body.tenantId) {
        const match = memberships.find((m: any) => m.tenantId === body.tenantId);
        if (match) selected = match;
      }
      activeTenant = { id: selected.tenant.id, name: selected.tenant.name, slug: selected.tenant.slug };
      tenantRole = selected.role;
    }

    const accessToken = app.signAccessToken({
      userId: user.id,
      globalRole: user.globalRole || undefined,  // ✅ Manejar null
      ...(activeTenant && { tenantId: activeTenant.id, tenantRole: tenantRole as string })
    });
    const refreshToken = app.signRefreshToken({ userId: user.id, refreshTokenVersion: user.refreshTokenVersion });

    setAuthCookies(reply, { accessToken, refreshToken });
    const csrfToken = await app.issueCsrfCookie(reply);

    return reply.send({
      accessToken,
      user: { id: user.id, email: user.email, globalRole: user.globalRole },
      activeTenant,
      tenantRole,
      csrfToken,
    });
  });

  // ── POST /auth/2fa-complete — Complete 2FA verification after TOTP/recovery code ──
  app.post('/2fa-complete', strictRateLimit, async (req: FastifyRequest, reply: FastifyReply) => {
    const schema = z.object({
      sessionToken: z.string().min(1, 'Session token is required'),
    });

    const body = schema.parse(req.body);

    let session;
    try {
      session = await app.prisma.twoFactorSession.findUnique({
        where: { sessionToken: body.sessionToken },
      });

      if (!session || session.verified !== true || new Date() > session.expiresAt) {
        return reply.code(401).send({ error: '2FA session invalid or expired' });
      }
    } catch {
      return reply.code(401).send({ error: '2FA session invalid or expired' });
    }

    const user = await app.prisma.platformUser.findUnique({
      where: { id: session.userId },
    });

    if (!user || !user.isActive || user.deletedAt) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    // SUPER_ADMIN case
    if (user.globalRole === 'SUPER_ADMIN') {
      const accessToken = app.signAccessToken({ userId: user.id, globalRole: 'SUPER_ADMIN' });
      const refreshToken = app.signRefreshToken({ userId: user.id, refreshTokenVersion: user.refreshTokenVersion });

      setAuthCookies(reply, { accessToken, refreshToken });
      const csrfToken = await app.issueCsrfCookie(reply);

      return reply.send({
        accessToken,
        user: { id: user.id, email: user.email, globalRole: user.globalRole },
        csrfToken,
      });
    }

    // Regular user case - load tenant memberships
    const memberships = await app.prisma.tenantMembership.findMany({
      where: {
        userId: user.id,
        status: 'ACTIVE',
        deletedAt: null,
        tenant: { deletedAt: null },
      },
      include: { tenant: true },
      orderBy: { createdAt: 'asc' },
    });

    if (memberships.length === 0) {
      return reply.code(403).send({ error: 'No active tenant memberships' });
    }

    const selected = memberships[0];

    const accessToken = app.signAccessToken({
      userId: user.id,
      tenantId: selected.tenantId,
      tenantRole: selected.role,
    });

    const refreshToken = app.signRefreshToken({ userId: user.id, refreshTokenVersion: user.refreshTokenVersion });

    setAuthCookies(reply, { accessToken, refreshToken });
    const csrfToken = await app.issueCsrfCookie(reply);

    return reply.send({
      user: { id: user.id, email: user.email },
      activeTenant: { id: selected.tenant.id, name: selected.tenant.name, slug: selected.tenant.slug },
      tenantRole: selected.role,
      needsTenantSwitch: memberships.length > 1,
      csrfToken,
      accessToken,
    });
  });

  app.post('/refresh', async (req: FastifyRequest, reply: FastifyReply) => {
    const cookieRefresh = (req.cookies as any)?.refresh_token as string | undefined;
    if (!cookieRefresh) return reply.code(401).send({ error: 'Unauthorized' });

    let payload: { userId: string; refreshTokenVersion: number; tokenType: 'refresh' };
    try {
      payload = app.verifyRefreshToken(cookieRefresh);
    } catch {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    if (payload.tokenType !== 'refresh') return reply.code(401).send({ error: 'Unauthorized' });

    const bodySchema = z.object({ tenantId: z.string().uuid().optional() });
    const body = bodySchema.parse(req.body ?? {});

    const user = await app.prisma.platformUser.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, globalRole: true, isActive: true, deletedAt: true, refreshTokenVersion: true },
    });

    if (!user || !user.isActive || user.deletedAt) return reply.code(401).send({ error: 'Unauthorized' });
    if (user.refreshTokenVersion !== payload.refreshTokenVersion) return reply.code(401).send({ error: 'Unauthorized' });

    // Rotate refresh token version.
    const bumped = await app.prisma.platformUser.update({
      where: { id: user.id },
      data: { refreshTokenVersion: { increment: 1 } },
      select: { refreshTokenVersion: true },
    });

    if (user.globalRole === 'SUPER_ADMIN') {
      // Get memberships to include tenant in token
      const memberships = await app.prisma.tenantMembership.findMany({
        where: { userId: user.id, status: 'ACTIVE', deletedAt: null, tenant: { deletedAt: null } },
        include: { tenant: true },
        orderBy: { createdAt: 'asc' },
      });
      
      let activeTenant = null;
      let tenantRole = null;
      
      if (memberships.length > 0) {
        activeTenant = { id: memberships[0].tenant.id, name: memberships[0].tenant.name, slug: memberships[0].tenant.slug };
        tenantRole = memberships[0].role;
      }
      
      const accessToken = app.signAccessToken({ 
        userId: user.id, 
        globalRole: 'SUPER_ADMIN',
        ...(activeTenant && { tenantId: activeTenant.id, tenantRole: tenantRole || undefined })
      });
      const refreshToken = app.signRefreshToken({ userId: user.id, refreshTokenVersion: bumped.refreshTokenVersion });
      setAuthCookies(reply, { accessToken, refreshToken });
      const csrfToken = await app.issueCsrfCookie(reply);
      return reply.send({ 
        accessToken, 
        user: { id: user.id, email: user.email, globalRole: user.globalRole },
        activeTenant,
        tenantRole,
        csrfToken 
      });
    }

    const memberships = await app.prisma.tenantMembership.findMany({
      where: {
        userId: user.id,
        status: 'ACTIVE',
        deletedAt: null,
        tenant: { deletedAt: null },
      },
      include: { tenant: true },
      orderBy: { createdAt: 'asc' },
    });

    if (memberships.length === 0) return reply.code(403).send({ error: 'No active tenant memberships' });

    let selected = memberships[0];
    if (body.tenantId) {
      const match = memberships.find((m: any) => m.tenantId === body.tenantId);
      if (!match) return reply.code(403).send({ error: 'Not a member of tenant' });
      selected = match;
    }

    const accessToken = app.signAccessToken({
      userId: user.id,
      tenantId: selected.tenantId,
      tenantRole: selected.role,
    });
    const refreshToken = app.signRefreshToken({ userId: user.id, refreshTokenVersion: bumped.refreshTokenVersion });

    setAuthCookies(reply, { accessToken, refreshToken });
    const csrfToken = await app.issueCsrfCookie(reply);

    return reply.send({
      user: { id: user.id, email: user.email },
      activeTenant: { id: selected.tenant.id, name: selected.tenant.name, slug: selected.tenant.slug },
      tenantRole: selected.role,
      csrfToken,
    });
  });

  // ── POST /auth/logout — Cerrar sesión ──
  app.post('/logout', async (_req: FastifyRequest, reply: FastifyReply) => {
    clearAuthCookies(reply);
    reply.clearCookie('csrf_token', { path: '/' });
    return reply.send({ ok: true });
  });

  app.get('/me', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.auth) return reply.code(401).send({ error: 'Unauthorized' });

    const user = await app.prisma.platformUser.findUnique({
      where: { id: req.auth.userId },
      select: { id: true, email: true, globalRole: true, isActive: true, deletedAt: true },
    });

    if (!user || !user.isActive || user.deletedAt) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    // Get user's tenant memberships to determine active tenant
    let memberships = await app.prisma.tenantMembership.findMany({
      where: {
        userId: user.id,
        status: 'ACTIVE',
        deletedAt: null,
        tenant: { deletedAt: null },
      },
      include: { tenant: true },
      orderBy: { createdAt: 'asc' },
    });

    // Si SUPER_ADMIN no tiene memberships, crear una con el primer tenant
    if (memberships.length === 0 && user.globalRole === 'SUPER_ADMIN') {
      try {
        const firstTenant = await app.prisma.tenant.findFirst({
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
        });

        if (firstTenant) {
          const newMembership = await app.prisma.tenantMembership.create({
            data: {
              userId: user.id,
              tenantId: firstTenant.id,
              role: 'TENANT_ADMIN',
              status: 'ACTIVE',
            },
            include: { tenant: true },
          });
          memberships = [newMembership];
        }
      } catch (err) {
        // Si falla la creación, simplemente continuar sin membership
        console.error('Error creating default tenant membership:', err);
      }
    }

    let activeTenant: { id: string; name: string; slug: string } | undefined;
    let tenantRole: string | null = null;

    // Use the tenantId from JWT if provided, otherwise use first membership
    if (req.auth.tenantId && memberships.length > 0) {
      const found = memberships.find((m) => m.tenantId === req.auth?.tenantId);
      if (found) {
        activeTenant = { id: found.tenant.id, name: found.tenant.name, slug: found.tenant.slug };
        tenantRole = found.role;
      }
    } else if (memberships.length > 0) {
      // Use first membership as fallback
      activeTenant = { id: memberships[0].tenant.id, name: memberships[0].tenant.name, slug: memberships[0].tenant.slug };
      tenantRole = memberships[0].role;
    }

    return reply.send({
      user: { id: user.id, email: user.email, globalRole: user.globalRole },
      activeTenant,
      tenantRole,
    });
  });

  app.get('/tenants', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.auth) return reply.code(401).send({ error: 'Unauthorized' });
    if (req.auth.globalRole === 'SUPER_ADMIN') {
      return reply.send({ tenants: [] });
    }

    const memberships = await app.prisma.tenantMembership.findMany({
      where: {
        userId: req.auth.userId,
        status: 'ACTIVE',
        deletedAt: null,
        tenant: { deletedAt: null },
      },
      include: { tenant: true },
      orderBy: { createdAt: 'asc' },
    });

    return reply.send({
      tenants: memberships.map((m) => ({
        tenantId: m.tenantId,
        name: m.tenant.name,
        slug: m.tenant.slug,
        role: m.role,
      })),
    });
  });

  app.post('/switch-tenant', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.auth) return reply.code(401).send({ error: 'Unauthorized' });
    if (req.auth.globalRole === 'SUPER_ADMIN') {
      return reply.code(400).send({ error: 'Super admin does not switch tenant' });
    }

    const bodySchema = z.object({ tenantId: z.string().uuid() });
    const body = bodySchema.parse(req.body);

    const membership = await app.prisma.tenantMembership.findFirst({
      where: {
        userId: req.auth.userId,
        tenantId: body.tenantId,
        status: 'ACTIVE',
        deletedAt: null,
      },
      include: { tenant: true },
    });

    if (!membership || membership.tenant.deletedAt) {
      return reply.code(403).send({ error: 'Not a member of tenant' });
    }

    const accessToken = app.signAccessToken({
      userId: req.auth.userId,
      tenantId: membership.tenantId,
      tenantRole: membership.role,
    });

    // Keep refresh cookie unchanged; only rotate on /refresh.
    reply.setCookie('access_token', accessToken, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
    });

    return reply.send({
      activeTenant: { id: membership.tenant.id, name: membership.tenant.name, slug: membership.tenant.slug },
      tenantRole: membership.role,
    });
  });


  // ── DEBUG: Check user status ──
  app.get('/debug/check-user', async (req: FastifyRequest, reply: FastifyReply) => {
    const { email } = req.query as { email?: string };
    if (!email) return reply.code(400).send({ error: 'Email required' });

    const user = await app.prisma.platformUser.findUnique({
      where: { email },
      select: { 
        id: true, 
        email: true, 
        isActive: true, 
        deletedAt: true,
        globalRole: true
      }
    });

    if (!user) {
      return reply.send({ found: false, message: 'User not found' });
    }

    const memberships = await app.prisma.tenantMembership.findMany({
      where: { userId: user.id, status: 'ACTIVE', deletedAt: null },
      select: { tenantId: true, role: true }
    });

    return reply.send({ 
      found: true, 
      user, 
      membershipsCount: memberships.length,
      memberships 
    });
  });

};
