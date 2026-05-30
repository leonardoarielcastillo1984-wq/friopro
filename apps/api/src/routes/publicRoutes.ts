import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import * as argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';
import { sendEmail, notificationEmail, welcomeTenantEmail } from '../services/email.js';

const prismaDirect = new PrismaClient();

const registerCompanySchema = z.object({
  companyName: z.string().min(1),
  socialReason: z.string().optional(),
  rut: z.string().optional(),
  email: z.string().email(),
  phone: z.string().optional().default(''),
  website: z.string().optional(),
  address: z.string().optional(),
  primaryColor: z.string().default('#3B82F6'),
});

export const publicRoutes: FastifyPluginAsync = async (app) => {
  // ── POST /register-company — Registrar nueva empresa ──
  app.post('/register-company', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = (req.body as any) || {};

      const parsed = registerCompanySchema.safeParse({
        companyName: data.companyName || data.company || data.empresa,
        socialReason: data.socialReason,
        rut: data.rut,
        email: data.email,
        phone: data.phone,
        website: data.website,
        address: data.address,
        primaryColor: data.primaryColor,
      });

      if (!parsed.success) {
        return reply.code(400).send({ error: 'Datos inválidos', issues: parsed.error.issues });
      }

      const validated = parsed.data;
      const autoRut = validated.rut || `PENDIENTE-${Date.now()}`;
      const autoAddress = validated.address || 'N/A';
      const appUrl = process.env.CORS_ORIGIN || 'https://logismart.ar';

      // Verificar email duplicado
      const existingReg = await prismaDirect.companyRegistration.findFirst({ where: { email: validated.email } });
      if (existingReg) {
        return reply.code(400).send({ error: 'Este email ya tiene una cuenta registrada. Revisá tu bandeja de entrada o contactanos.' });
      }

      // ── Crear registro PENDING ──
      const newRegistration = await prismaDirect.companyRegistration.create({
        data: {
          companyName: validated.companyName,
          socialReason: validated.socialReason,
          rut: autoRut,
          email: validated.email,
          phone: validated.phone,
          website: validated.website,
          address: autoAddress,
          primaryColor: validated.primaryColor || '#E8541A',
          status: 'PENDING',
        },
      });

      app.log.info(`[REGISTER-COMPANY] Registro creado: ${newRegistration.id}`);

      // ── Auto-aprobación: crear tenant + usuario + credenciales ──
      try {
        const baseSlug = validated.companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const uniqueSlug = `${baseSlug}-${Date.now().toString(36).slice(-4)}`;

        const demoStartedAt = new Date();
        const demoExpiresAt = new Date(demoStartedAt.getTime() + 7 * 24 * 60 * 60 * 1000);

        const tenant = await (app.prisma as any).tenant.create({
          data: { name: validated.companyName, slug: uniqueSlug, isDemo: true, demoStartedAt, demoExpiresAt },
        });

        // Generar contraseña temporal aleatoria
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
        const tempPassword = Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
        const hashedPassword = await argon2.hash(tempPassword);

        let user = await app.prisma.platformUser.findUnique({ where: { email: validated.email } });
        if (!user) {
          user = await app.prisma.platformUser.create({
            data: { email: validated.email, passwordHash: hashedPassword, isActive: true },
          });
          await (app.prisma as any).passwordHistory.create({
            data: { userId: user.id, passwordHash: hashedPassword, changeType: 'INITIAL', reason: 'Registro desde landing', ipAddress: req.ip, userAgent: req.headers['user-agent'] },
          });
        } else {
          await app.prisma.platformUser.update({ where: { id: user.id }, data: { passwordHash: hashedPassword } });
        }

        const existingMembership = await app.prisma.tenantMembership.findFirst({ where: { userId: user.id, tenantId: tenant.id } });
        if (!existingMembership) {
          await app.prisma.tenantMembership.create({
            data: { userId: user.id, tenantId: tenant.id, role: 'TENANT_ADMIN' },
          });
        }

        const initialPlan = await app.prisma.plan.findFirst({ where: { isActive: true, tier: 'BASIC' } })
          ?? await app.prisma.plan.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'asc' } });
        if (initialPlan) {
          await app.prisma.tenantSubscription.create({
            data: { tenantId: tenant.id, planId: initialPlan.id, status: 'TRIAL', startedAt: new Date() },
          });
        }

        await (app.prisma as any).tenantSetup.upsert({
          where: { tenantId: tenant.id },
          update: { status: 'PAID', paidAt: new Date(), provider: 'landing-registration', updatedAt: new Date() },
          create: { tenantId: tenant.id, amount: 0, currency: 'USD', status: 'PAID', requestedAt: new Date(), paidAt: new Date(), provider: 'landing-registration' },
        });

        await prismaDirect.companyRegistration.update({
          where: { id: newRegistration.id },
          data: { status: 'APPROVED', tenantId: tenant.id, approvedAt: new Date() },
        });

        // Enviar email de bienvenida con credenciales
        const userName = validated.companyName;
        await sendEmail(welcomeTenantEmail({
          to: validated.email,
          companyName: validated.companyName,
          userName,
          password: tempPassword,
          loginUrl: `${appUrl}/sgi360-landing/`,
          trialDays: 7,
        })).catch(e => app.log.error(`[REGISTER-COMPANY] Error email bienvenida: ${e.message}`));

        app.log.info(`[REGISTER-COMPANY] Auto-aprobado: tenant=${tenant.id}, user=${user.id}`);

        // Notificar admins
        const fixedRecipients = ['soporte@logismart.ar', 'leonardoarielcastillo@hotmail.com'];
        for (const adminEmail of fixedRecipients) {
          sendEmail(notificationEmail({
            userEmail: adminEmail,
            title: '🆕 Nuevo cliente registrado — SGI 360',
            message: `<strong>Empresa:</strong> ${validated.companyName}<br><strong>Email:</strong> ${validated.email}<br><strong>Teléfono:</strong> ${validated.phone || 'N/A'}<br><br>El cliente ya recibió sus credenciales y puede acceder al sistema.`,
            actionLabel: 'Ver clientes',
            actionUrl: `${appUrl}/super-admin`,
            type: 'success',
          })).catch(() => {});
        }

      } catch (autoErr: any) {
        app.log.error({ err: autoErr?.message }, '[REGISTER-COMPANY] Error en auto-aprobación');
      }

      return reply.code(200).send({
        success: true,
        message: 'Cuenta creada. Te enviamos un email con tus datos de acceso.',
        registrationId: newRegistration.id,
      });
    } catch (error: any) {
      app.log.error({ err: error?.message || String(error) }, 'Error registering company');
      return reply.code(500).send({ error: 'Error al procesar la solicitud' });
    }
  });

  // ── GET /mercadopago-config/public — Obtener configuración pública de MercadoPago ──
  app.get('/mercadopago-config/public', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const mpConfigPath = path.join(process.cwd(), '.mercadopago-config.json');

      if (!fs.existsSync(mpConfigPath)) {
        return reply.send({
          configured: false,
          publicKey: null,
          userId: null,
        });
      }

      const content = fs.readFileSync(mpConfigPath, 'utf-8');
      const config = JSON.parse(content);

      return reply.send({
        configured: config.configured || false,
        publicKey: config.publicKey || null,
        userId: config.userId || null,
      });
    } catch (error) {
      app.log.error('Error reading MercadoPago config: ' + String(error));
      return reply.send({
        configured: false,
        publicKey: null,
        userId: null,
      });
    }
  });
};
