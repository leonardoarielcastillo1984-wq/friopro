import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { sendEmail } from '../services/email.js';

/**
 * Auth del portal de clientes SEH (seh_users, NO usuarios de plataforma SGI).
 * El consultor crea usuarios en /seh360/clients/:clientId/users.
 * POST /seh360/auth/login          → email+password → JWT con globalRole SEH_CLIENT
 * POST /seh360/portal/change-password → autenticado, cambia su password
 */
export const registerSeh360AuthRoutes = async (app: FastifyInstance) => {

  app.post('/seh360/auth/login', async (req: any, reply) => {
    const v = z.object({ email: z.string().email(), password: z.string().min(1) }).safeParse(req.body);
    if (!v.success) return reply.code(400).send({ error: 'Email y contraseña requeridos' });
    const { email, password } = v.data;
    const prisma = (app as any).prisma;

    const user = await prisma.sehUser.findFirst({
      where: { email: email.toLowerCase(), isActive: true, deletedAt: null },
    });
    if (!user) return reply.code(401).send({ error: 'Credenciales inválidas' });
    const ok = await argon2.verify(user.passwordHash, password).catch(() => false);
    if (!ok) return reply.code(401).send({ error: 'Credenciales inválidas' });

    const links = await prisma.sehClientUser.findMany({
      where: { userId: user.id },
      select: { clientId: true, role: true, isPrimary: true },
    });
    const clientIds = links.map((l: any) => l.clientId);
    const clients = clientIds.length
      ? await prisma.sehClient.findMany({ where: { id: { in: clientIds }, deletedAt: null }, select: { id: true, name: true, logoUrl: true } })
      : [];

    // Sin tenantId en el token: con tenantId, dbContextPlugin exigiría
    // TenantMembership de plataforma que el usuario seh_users no tiene → 403.
    const token = app.signAccessToken({
      userId: user.id,
      globalRole: 'SEH_CLIENT',
      tenantRole: links.find((l: any) => l.isPrimary)?.role || 'VIEWER',
    } as any);

    return reply.send({
      token,
      user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName },
      clients,
    });
  });

  app.post('/seh360/portal/change-password', async (req: any, reply) => {
    const auth = (req as any).auth;
    if (!auth || auth.globalRole !== 'SEH_CLIENT') return reply.code(401).send({ error: 'No autorizado' });
    const v = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(6) }).safeParse(req.body);
    if (!v.success) return reply.code(400).send({ error: 'Datos inválidos (contraseña mínimo 6 caracteres)' });
    const prisma = (app as any).prisma;

    const user = await prisma.sehUser.findFirst({ where: { id: auth.userId, deletedAt: null } });
    if (!user) return reply.code(404).send({ error: 'Usuario no encontrado' });
    const ok = await argon2.verify(user.passwordHash, v.data.currentPassword).catch(() => false);
    if (!ok) return reply.code(401).send({ error: 'Contraseña actual incorrecta' });

    await prisma.sehUser.update({ where: { id: user.id }, data: { passwordHash: await argon2.hash(v.data.newPassword), updatedAt: new Date() } });
    return reply.send({ changed: true });
  });
};

/**
 * Reset de contraseña del portal (token JWT firmado, 1h).
 * POST /seh360/auth/forgot-password { email }  → envía link por email
 * POST /seh360/auth/reset-password { token, password } → actualiza hash
 */
export const registerSeh360PasswordResetRoutes = async (app: FastifyInstance) => {
  const secret = process.env.SEH_RESET_SECRET || process.env.JWT_SECRET!;

  app.post('/seh360/auth/forgot-password', async (req: any, reply) => {
    const v = z.object({ email: z.string().email() }).safeParse(req.body);
    if (!v.success) return reply.code(400).send({ error: 'Email requerido' });
    const email = v.data.email.toLowerCase();
    const prisma = (app as any).prisma;

    const user = await prisma.sehUser.findFirst({ where: { email, isActive: true, deletedAt: null } });
    // Siempre responder ok — no revelar si el email existe
    if (!user) return reply.send({ ok: true });

    const token = jwt.sign({ purpose: 'seh-reset', userId: user.id, tenantId: user.tenantId }, secret, { expiresIn: '1h' });
    const baseUrl = process.env.SEH_PORTAL_URL || process.env.WEB_URL || 'https://sgi360.com.ar';
    const link = `${baseUrl}/seh-portal/reset?token=${token}`;

    try {
      await sendEmail({
        to: email,
        subject: 'SEH360 — Restablecer contraseña',
        html: `<p>Hola ${user.firstName},</p><p>Recibimos una solicitud para restablecer tu contraseña del portal de Seguridad e Higiene.</p><p><a href="${link}">Restablecer contraseña</a> (válido por 1 hora)</p><p>Si no fuiste vos, ignorá este mensaje.</p>`,
      } as any);
    } catch (e: any) {
      console.error('[SEH forgot-password] email failed:', e?.message);
    }
    return reply.send({ ok: true });
  });

  app.post('/seh360/auth/reset-password', async (req: any, reply) => {
    const v = z.object({ token: z.string(), password: z.string().min(6) }).safeParse(req.body);
    if (!v.success) return reply.code(400).send({ error: 'Datos inválidos (contraseña mínimo 6 caracteres)' });
    let payload: any;
    try {
      payload = jwt.verify(v.data.token, secret);
    } catch {
      return reply.code(400).send({ error: 'Token inválido o vencido' });
    }
    if (payload.purpose !== 'seh-reset') return reply.code(400).send({ error: 'Token inválido' });

    const prisma = (app as any).prisma;
    const user = await prisma.sehUser.findFirst({ where: { id: payload.userId, deletedAt: null } });
    if (!user) return reply.code(404).send({ error: 'Usuario no encontrado' });

    await prisma.sehUser.update({ where: { id: user.id }, data: { passwordHash: await argon2.hash(v.data.password), updatedAt: new Date() } });
    return reply.send({ ok: true });
  });
};
