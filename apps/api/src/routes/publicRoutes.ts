import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';

const registerCompanySchema = z.object({
  companyName: z.string().min(1),
  socialReason: z.string().optional(),
  rut: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  website: z.string().optional(),
  address: z.string().min(1),
  primaryColor: z.string().default('#3B82F6'),
});

export const publicRoutes: FastifyPluginAsync = async (app) => {
  // ── POST /register-company — Registrar nueva empresa ──
  app.post('/register-company', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = req.body as any;

      // Validar datos
      const validated = registerCompanySchema.parse({
        companyName: data.companyName,
        socialReason: data.socialReason,
        rut: data.rut,
        email: data.email,
        phone: data.phone,
        website: data.website,
        address: data.address,
        primaryColor: data.primaryColor,
      });

      // Guardar en base de datos
      const newRegistration = await app.prisma.companyRegistration.create({
        data: {
          companyName: validated.companyName,
          socialReason: validated.socialReason,
          rut: validated.rut,
          email: validated.email,
          phone: validated.phone,
          website: validated.website,
          address: validated.address,
          primaryColor: validated.primaryColor,
          status: 'PENDING',
        },
      });

      app.log.info(`Nueva solicitud de registro: ${validated.companyName}`);

      return reply.code(200).send({
        success: true,
        message: 'Solicitud recibida correctamente',
        registrationId: newRegistration.id,
      });
    } catch (error: any) {
      app.log.error('Error registering company:', error);

      if (error.issues) {
        return reply.code(400).send({
          error: 'Datos inválidos',
          issues: error.issues,
        });
      }

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
