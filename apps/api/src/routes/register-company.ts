import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { sendEmail, notificationEmail, welcomeTenantEmail } from '../services/email.js';
import * as argon2 from 'argon2';

// Cliente Prisma sin RLS para operaciones de CompanyRegistration
const prismaSuperUser = new PrismaClient();


// Schema de validación
const registerCompanySchema = z.object({
  companyName: z.string().min(1, 'Nombre de empresa requerido'),
  socialReason: z.string().optional(),
  rut: z.string().min(1, 'RUT requerido'),
  email: z.string().email('Email inválido'),
  phone: z.string().min(1, 'Teléfono requerido'),
  website: z.string().optional(),
  address: z.string().min(1, 'Dirección requerida'),
  primaryColor: z.string().default('#3B82F6'),
  module: z.string().default('sgi360'),
});

export async function registerCompanyRoutes(app: FastifyInstance) {
  // POST /api/register-company - Registrar nueva empresa
  app.post('/api/register-company', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = req.body as any;
      
      app.log.info('[REGISTER-COMPANY] Iniciando registro de empresa');
      app.log.info(`[REGISTER-COMPANY] Body recibido: ${JSON.stringify(body)}`);
      
      // Validar datos
      const validatedData = registerCompanySchema.parse(body);
      
      app.log.info(`[REGISTER-COMPANY] Datos validados: ${validatedData.companyName}`);
      
      // Verificar si ya existe una solicitud con el mismo RUT
      const existingByRut = await prismaSuperUser.companyRegistration.findFirst({
        where: { rut: validatedData.rut },
      });
      
      if (existingByRut) {
        return reply.code(400).send({
          success: false,
          error: 'Ya existe una solicitud con este RUT',
          field: 'rut',
        });
      }
      
      // Verificar si ya existe una solicitud con el mismo email
      const existingByEmail = await prismaSuperUser.companyRegistration.findFirst({
        where: { email: validatedData.email },
      });
      
      if (existingByEmail) {
        return reply.code(400).send({
          success: false,
          error: 'Ya existe una solicitud con este email',
          field: 'email',
        });
      }
      
      // Guardar en base de datos (usando prisma sin RLS)
      app.log.info('[REGISTER-COMPANY] Intentando crear registro en DB...');
      
      const registration = await prismaSuperUser.companyRegistration.create({
        data: {
          companyName: validatedData.companyName,
          socialReason: validatedData.socialReason || null,
          rut: validatedData.rut,
          email: validatedData.email,
          phone: validatedData.phone,
          website: validatedData.website || null,
          address: validatedData.address,
          primaryColor: validatedData.primaryColor,
          module: validatedData.module,
          status: 'PENDING', // PENDING, APPROVED, REJECTED
          createdAt: new Date(),
        },
      });
      
      app.log.info(`[REGISTER-COMPANY] Registro creado exitosamente: ${registration.id}`);
      const totalCount = await prismaSuperUser.companyRegistration.count();
      app.log.info(`[REGISTER-COMPANY] Total registros en DB: ${totalCount}`);
      
      // Enviar email de notificación a destinatarios fijos + env var
      const fixedRecipients = ['soporte@logismart.ar', 'leonardoarielcastillo@hotmail.com'];
      const envRecipients = (process.env.ADMIN_NOTIFICATION_EMAILS || process.env.ADMIN_NOTIFICATION_EMAIL || '')
        .split(',').map((e: string) => e.trim()).filter(Boolean);
      const adminEmails = Array.from(new Set([...fixedRecipients, ...envRecipients]));
      const appUrl = process.env.CORS_ORIGIN || 'https://logismart.ar';

      // ── Auto-aprobación: crear tenant, usuario y enviar credenciales ──
      app.log.info(`[REGISTER-COMPANY] Auto-aprobando registro ${registration.id}...`);

      const baseSlug = validatedData.companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const uniqueSlug = `${baseSlug}-${Date.now().toString(36).slice(-4)}`;

      const demoStartedAt = new Date();
      const demoExpiresAt = new Date(demoStartedAt.getTime() + 3 * 24 * 60 * 60 * 1000);

      const tenant = await (app.prisma as any).tenant.create({
        data: {
          name: validatedData.companyName,
          slug: uniqueSlug,
          isDemo: true,
          demoStartedAt,
          demoExpiresAt,
        },
      });
      app.log.info(`[REGISTER-COMPANY] Tenant creado: ${tenant.id} (${tenant.slug})`);

      const tempPassword = 'TempPassword123!';
      const hashedPassword = await argon2.hash(tempPassword);

      let user = await app.prisma.platformUser.findUnique({ where: { email: validatedData.email } });
      if (!user) {
        user = await app.prisma.platformUser.create({
          data: { email: validatedData.email, passwordHash: hashedPassword, isActive: true },
        });
        await (app.prisma as any).passwordHistory.create({
          data: {
            userId: user.id,
            passwordHash: hashedPassword,
            changeType: 'INITIAL',
            reason: 'Cuenta creada por auto-aprobación de registro',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
          },
        });
      } else {
        await app.prisma.platformUser.update({ where: { id: user.id }, data: { passwordHash: hashedPassword } });
        await (app.prisma as any).passwordHistory.create({
          data: {
            userId: user.id,
            passwordHash: hashedPassword,
            changeType: 'ADMIN_RESET',
            reason: 'Contraseña reseteada por auto-aprobación de registro',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
          },
        });
      }

      const existingMembership = await app.prisma.tenantMembership.findFirst({
        where: { userId: user.id, tenantId: tenant.id },
      });
      if (!existingMembership) {
        await app.prisma.tenantMembership.create({
          data: { userId: user.id, tenantId: tenant.id, role: 'TENANT_ADMIN' },
        });
      }

      const initialPlan = await app.prisma.plan.findFirst({
        where: { isActive: true, tier: 'BASIC' },
      }) ?? await app.prisma.plan.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
      });
      if (initialPlan) {
        await app.prisma.tenantSubscription.create({
          data: { tenantId: tenant.id, planId: initialPlan.id, status: 'TRIAL', startedAt: new Date() },
        });
        app.log.info(`[REGISTER-COMPANY] Suscripción TRIAL creada con plan ${initialPlan.tier}`);
      }

      await (app.prisma as any).tenantSetup.upsert({
        where: { tenantId: tenant.id },
        update: { status: 'PAID', paidAt: new Date(), provider: 'auto-approval', updatedAt: new Date() },
        create: {
          tenantId: tenant.id,
          amount: 0,
          currency: 'USD',
          status: 'PAID',
          requestedAt: new Date(),
          paidAt: new Date(),
          provider: 'auto-approval',
        },
      });

      await prismaSuperUser.companyRegistration.update({
        where: { id: registration.id },
        data: {
          status: 'APPROVED',
          tenantId: tenant.id,
          approvedAt: new Date(),
        },
      });
      app.log.info(`[REGISTER-COMPANY] Registro auto-aprobado: ${registration.id}`);

      // Enviar email de bienvenida con credenciales al cliente
      const loginUrl = `${appUrl}/login`;
      try {
        const welcomeResult = await sendEmail(welcomeTenantEmail({
          to: validatedData.email,
          companyName: validatedData.companyName,
          password: tempPassword,
          loginUrl,
        }));
        if (welcomeResult.success) {
          app.log.info(`[REGISTER-COMPANY] Email de bienvenida enviado a ${validatedData.email}`);
        } else {
          app.log.error(`[REGISTER-COMPANY] Error enviando email de bienvenida: ${welcomeResult.error}`);
        }
      } catch (welcomeError) {
        app.log.error(`[REGISTER-COMPANY] Error enviando email de bienvenida: ${welcomeError}`);
      }

      // Enviar notificación a admins (informativa, ya no requiere acción)
      try {
        for (const adminEmail of adminEmails) {
          const emailPayload = notificationEmail({
            userEmail: adminEmail,
            title: 'Nuevo cliente registrado y aprobado automáticamente',
            message: `Se registró y aprobó automáticamente un nuevo cliente:\n\n` +
              `<strong>Empresa:</strong> ${validatedData.companyName}\n` +
              `<strong>Email:</strong> ${validatedData.email}\n` +
              `<strong>RUT:</strong> ${validatedData.rut}\n` +
              `<strong>Teléfono:</strong> ${validatedData.phone}\n` +
              `<strong>Dirección:</strong> ${validatedData.address}\n\n` +
              `El cliente ya recibió sus credenciales y puede acceder al sistema.`,
            actionLabel: 'Ver clientes registrados',
            actionUrl: `${appUrl}/admin/registros`,
            type: 'info',
          });

          const emailResult = await sendEmail(emailPayload);
          if (emailResult.success) {
            app.log.info(`[REGISTER-COMPANY] Email de notificación enviado a ${adminEmail}`);
          } else {
            app.log.error(`[REGISTER-COMPANY] Error enviando email a ${adminEmail}: ${emailResult.error}`);
          }
        }
      } catch (emailError) {
        app.log.error(`[REGISTER-COMPANY] Error enviando notificación: ${emailError}`);
      }
      
      return reply.code(201).send({
        success: true,
        message: 'Registro completado. Te enviamos un email con tus datos de acceso.',
        registrationId: registration.id,
      });
      
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          error: 'Datos inválidos',
          details: error.errors,
        });
      }
      
      // Manejar error de constraint única de Prisma
      const prismaError = error as any;
      if (prismaError.code === 'P2002') {
        const field = prismaError.meta?.target?.[0] || 'campo';
        return reply.code(400).send({
          success: false,
          error: `Ya existe un registro con este ${field}`,
          field,
        });
      }
      
      app.log.error('Error en registro de empresa: ' + String(error));
      return reply.code(500).send({
        success: false,
        error: 'Error interno del servidor',
      });
    }
  });
  
  // GET /api/register-company/:id - Ver estado de registro
  app.get('/api/register-company/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = req.params as { id: string };
      
      const registration = await prismaSuperUser.companyRegistration.findUnique({
        where: { id },
      });
      
      if (!registration) {
        return reply.code(404).send({
          success: false,
          error: 'Registro no encontrado',
        });
      }
      
      return reply.send({
        success: true,
        data: registration,
      });
      
    } catch (error) {
      app.log.error('Error consultando registro: ' + String(error));
      return reply.code(500).send({
        success: false,
        error: 'Error interno del servidor',
      });
    }
  });
}
