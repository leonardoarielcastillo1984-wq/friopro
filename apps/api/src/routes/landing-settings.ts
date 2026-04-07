import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

const UpdateLandingSettingsSchema = z.object({
  phone: z.string().optional(),
  address: z.string().optional(),
  email: z.string().email().optional(),
  linkedin: z.string().optional(),
  twitter: z.string().optional(),
  facebook: z.string().optional(),
  clientLogos: z.string().optional(), // JSON array
  integrations: z.string().optional(), // JSON array
  missionText: z.string().optional(),
  objectiveText: z.string().optional(),
  visionText: z.string().optional(),
  stats: z.string().optional(), // JSON object with company stats
});

export async function registerLandingSettingsRoutes(app: FastifyInstance) {

  // GET /landing/settings - Obtener configuración de landing page
  app.get('/landing/settings', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      // Esta información es pública, no requiere autenticación
      // Temporalmente retornar valores por defecto hasta que se cree el modelo
      const settings = {
        phone: '+56 2 1234 5678',
        address: 'Calle Principal 123, Santiago, Chile',
        email: 'support@sgi360.com',
        linkedin: 'https://linkedin.com/company/sgi360',
        twitter: 'https://twitter.com/sgi360',
        facebook: 'https://facebook.com/sgi360',
        clientLogos: JSON.stringify(['Acme Corp', 'Global SA', 'TechFlow', 'DataPro', 'InnovateLab']),
        integrations: JSON.stringify(['Excel', 'Google Sheets', 'Google Drive', 'OneDrive', 'Zapier', 'Slack', 'Gmail', 'Power BI']),
        missionText: 'Transformar los procesos de gestión empresarial mediante tecnología innovadora y soporte experto',
        objectiveText: 'Ser la plataforma de gestión integrada número 1 en Latinoamérica, confiada por más de 1000 empresas',
        visionText: 'Empoderar a las organizaciones con herramientas de IA y automatización para lograr excelencia operacional',
        stats: JSON.stringify({ companies: 500, users: 1500, experience: '15+', uptime: '99.9%' })
      };

      return reply.send({ settings });
    } catch (error) {
      return reply.code(500).send({ error: 'Failed to fetch landing settings' });
    }
  });

  // PUT /landing/settings - Actualizar configuración (solo admin)
  app.put('/landing/settings', async (req: FastifyRequest<{ Body: z.infer<typeof UpdateLandingSettingsSchema> }>, reply: FastifyReply) => {
    // TODO: Implementar autenticación cuando esté disponible
    const validation = UpdateLandingSettingsSchema.safeParse(req.body);
    if (!validation.success) return reply.code(400).send({ error: 'Validation failed', details: validation.error.errors });

    try {
      // TODO: Guardar en base de datos cuando se cree el modelo landingSettings
      // Por ahora solo retornar éxito con los datos validados
      const settings = validation.data;

      return reply.send({ success: true, settings });
    } catch (error) {
      console.error('Error updating landing settings:', error);
      return reply.code(500).send({ error: 'Failed to update landing settings' });
    }
  });
}
