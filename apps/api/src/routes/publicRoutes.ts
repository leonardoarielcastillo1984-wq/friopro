import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import * as argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';
import { sendEmail, notificationEmail, welcomeTenantEmail, leadMagnetEmail } from '../services/email.js';

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

  // ── POST /leads — Captura pública de leads (lead magnets) ──
  const leadSchema = z.object({
    email: z.string().email().max(160),
    nombre: z.string().max(120).optional(),
    empresa: z.string().max(160).optional(),
    telefono: z.string().max(40).optional(),
    source: z.string().min(1).max(60),
    meta: z.record(z.any()).optional(),
    website: z.string().max(200).optional(), // honeypot — si viene con contenido es bot
    utmSource: z.string().max(100).optional(),
    utmMedium: z.string().max(100).optional(),
    utmCampaign: z.string().max(100).optional(),
  });

  const LEAD_RESOURCES: Record<string, { titulo: string; downloadUrl?: string }> = {
    'checklist-iso-9001': { titulo: 'Checklist ISO 9001 — Autodiagnóstico', downloadUrl: 'https://logismart.ar/herramientas/checklist-iso-9001' },
    'matriz-iperc': { titulo: 'Plantilla Matriz IPERC (Excel)', downloadUrl: 'https://logismart.ar/descargas/plantilla-matriz-iperc.xlsx' },
    'plantilla-bia': { titulo: 'Plantilla BIA — Análisis de Impacto al Negocio (Excel)', downloadUrl: 'https://logismart.ar/descargas/plantilla-bia.xlsx' },
    'soa-iso-27001': { titulo: 'Declaración de Aplicabilidad ISO 27001:2022 (Excel)', downloadUrl: 'https://logismart.ar/descargas/soa-iso-27001.xlsx' },
  };

  const handleLead = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const parsed = leadSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Datos inválidos', issues: parsed.error.issues });
      }
      const data = parsed.data;

      // Honeypot: campo invisible "website" — los bots lo completan. Respondemos éxito sin guardar.
      if (data.website && data.website.trim().length > 0) {
        app.log.info(`[LEADS] Honeypot activado — descartado (email=${data.email})`);
        return reply.send({ success: true });
      }

      const recurso = LEAD_RESOURCES[data.source] || { titulo: 'Recurso gratuito' };
      const appUrl = process.env.CORS_ORIGIN?.split(',')[0]?.trim() || 'https://logismart.ar';

      // Dedup: mismo email + misma fuente → actualizar datos en lugar de duplicar
      const existing = await prismaDirect.marketingLead.findFirst({
        where: { email: data.email, source: data.source },
      });
      let lead;
      if (existing) {
        lead = await prismaDirect.marketingLead.update({
          where: { id: existing.id },
          data: {
            nombre: data.nombre || existing.nombre,
            empresa: data.empresa || existing.empresa,
            telefono: data.telefono || existing.telefono,
            meta: data.meta ?? existing.meta ?? undefined,
            utmSource: data.utmSource || existing.utmSource,
            utmMedium: data.utmMedium || existing.utmMedium,
            utmCampaign: data.utmCampaign || existing.utmCampaign,
            ip: req.ip,
          },
        });
      } else {
        lead = await prismaDirect.marketingLead.create({
          data: {
            email: data.email,
            nombre: data.nombre,
            empresa: data.empresa,
            telefono: data.telefono,
            source: data.source,
            meta: data.meta,
            ip: req.ip,
            utmSource: data.utmSource,
            utmMedium: data.utmMedium,
            utmCampaign: data.utmCampaign,
          },
        });
      }
      app.log.info(`[LEADS] Lead ${existing ? 'actualizado' : 'creado'}: ${lead.id} source=${data.source}`);

      // Email al lead con el recurso (no bloquea la respuesta)
      const extraHtml = data.meta?.score != null
        ? `<p style="color:#4B5563;font-size:14px;line-height:1.6;margin:8px 0 0;">Tu diagnóstico arrojó <strong>${data.meta.score}%</strong> de cumplimiento${data.meta.total ? ` (${data.meta.done}/${data.meta.total} ítems)` : ''}.</p>`
        : '';
      sendEmail(leadMagnetEmail({
        to: data.email,
        nombre: data.nombre,
        recursoTitulo: recurso.titulo,
        downloadUrl: recurso.downloadUrl,
        extraHtml,
      })).catch((e: any) => app.log.error(`[LEADS] Error enviando recurso: ${e.message}`));

      // Notificación interna
      for (const adminEmail of ['soporte@logismart.ar', 'leonardoarielcastillo@hotmail.com']) {
        sendEmail(notificationEmail({
          userEmail: adminEmail,
          title: `🧲 Nuevo lead — ${recurso.titulo}`,
          message: `<strong>Email:</strong> ${data.email}<br><strong>Nombre:</strong> ${data.nombre || '—'}<br><strong>Empresa:</strong> ${data.empresa || '—'}<br><strong>Teléfono:</strong> ${data.telefono || '—'}<br><strong>Fuente:</strong> ${data.source}<br><strong>UTM:</strong> ${[data.utmSource, data.utmMedium, data.utmCampaign].filter(Boolean).join(' / ') || '—'}${data.meta?.score != null ? `<br><strong>Score checklist:</strong> ${data.meta.score}%` : ''}`,
          actionLabel: 'Ver landing',
          actionUrl: appUrl,
          type: 'success',
        })).catch(() => {});
      }

      return reply.send({ success: true, downloadUrl: recurso.downloadUrl });
    } catch (error: any) {
      app.log.error({ err: error?.message || String(error) }, '[LEADS] Error');
      return reply.code(500).send({ error: 'Error al procesar la solicitud' });
    }
  };

  app.post('/leads', handleLead);
  app.post('/api/leads', handleLead); // alias por si el proxy no strippea /api

  // ── GET /leads — Listado (solo SUPER_ADMIN, ?format=csv para exportar) ──
  const handleListLeads = async (req: FastifyRequest, reply: FastifyReply) => {
    const auth = (req as any).auth;
    if (!auth || auth.globalRole !== 'SUPER_ADMIN') {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const q = (req.query as any) || {};
    const where: any = {};
    if (q.source) where.source = String(q.source);

    const leads = await prismaDirect.marketingLead.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(parseInt(q.limit || '500', 10) || 500, 2000),
    });

    if (q.format === 'csv') {
      const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const rows = [
        'email,nombre,empresa,telefono,source,utm_source,utm_medium,utm_campaign,created_at',
        ...leads.map(l => [l.email, l.nombre, l.empresa, l.telefono, l.source, l.utmSource, l.utmMedium, l.utmCampaign, l.createdAt.toISOString()].map(esc).join(',')),
      ];
      reply.header('Content-Type', 'text/csv; charset=utf-8');
      reply.header('Content-Disposition', 'attachment; filename="leads.csv"');
      return reply.send(rows.join('\n'));
    }
    return reply.send({ count: leads.length, leads });
  };

  app.get('/leads', handleListLeads);
  app.get('/api/leads', handleListLeads);

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
