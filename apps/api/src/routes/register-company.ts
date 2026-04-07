import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { Resend } from 'resend';
import { PrismaClient } from '@prisma/client';

// Cliente Prisma sin RLS para operaciones de CompanyRegistration
const prismaSuperUser = new PrismaClient();

// Inicializar Resend para enviar emails (usa API key del env)
const resend = new Resend(process.env.RESEND_API_KEY || 're_123456789');

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
      
      // Enviar email al administrador
      try {
        await resend.emails.send({
          from: 'SGI 360 <noreply@sgi360.com>',
          to: 'admin@sgi360.com', // Email del admin
          subject: `Nueva solicitud de registro: ${validatedData.companyName}`,
          html: `
            <h2>Nueva Solicitud de Registro de Empresa</h2>
            <p><strong>Empresa:</strong> ${validatedData.companyName}</p>
            <p><strong>Razón Social:</strong> ${validatedData.socialReason || 'No especificada'}</p>
            <p><strong>RUT:</strong> ${validatedData.rut}</p>
            <p><strong>Email:</strong> ${validatedData.email}</p>
            <p><strong>Teléfono:</strong> ${validatedData.phone}</p>
            <p><strong>Dirección:</strong> ${validatedData.address}</p>
            <p><strong>Website:</strong> ${validatedData.website || 'No especificada'}</p>
            <p><strong>Módulo solicitado:</strong> ${validatedData.module}</p>
            <p><strong>Color de marca:</strong> ${validatedData.primaryColor}</p>
            <br>
            <p>Para aprobar esta solicitud, ingrese al panel de administración.</p>
            <p>ID de registro: ${registration.id}</p>
          `,
        });
        app.log.info('Email de notificación enviado al admin');
      } catch (emailError) {
        app.log.error('Error enviando email: ' + String(emailError));
        // No fallar si el email no se envía
      }
      
      // También enviar email de confirmación al usuario
      try {
        await resend.emails.send({
          from: 'SGI 360 <noreply@sgi360.com>',
          to: validatedData.email,
          subject: 'Solicitud de registro recibida - SGI 360',
          html: `
            <h2>¡Gracias por registrarse en SGI 360!</h2>
            <p>Hemos recibido su solicitud de registro para <strong>${validatedData.companyName}</strong>.</p>
            <p>Nuestro equipo está revisando su información y pronto recibirá un email con las instrucciones para acceder al sistema.</p>
            <br>
            <p>Datos registrados:</p>
            <ul>
              <li><strong>Empresa:</strong> ${validatedData.companyName}</li>
              <li><strong>Email:</strong> ${validatedData.email}</li>
              <li><strong>Módulo:</strong> SGI 360</li>
            </ul>
            <br>
            <p>Si tiene alguna pregunta, no dude en contactarnos.</p>
            <p>Saludos,<br>Equipo SGI 360</p>
          `,
        });
      } catch (emailError) {
        app.log.error('Error enviando email de confirmación: ' + String(emailError));
      }
      
      return reply.code(201).send({
        success: true,
        message: 'Solicitud de registro enviada correctamente',
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
