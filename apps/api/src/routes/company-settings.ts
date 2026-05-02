import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

const UpdateCompanySettingsSchema = z.object({
  companyName: z.string().min(2).optional(),
  legalName: z.string().optional(),
  taxId: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  website: z.string().optional(),
  logoUrl: z.string().optional(),
  logoDarkUrl: z.string().optional(),
  faviconUrl: z.string().optional(),
  headerText: z.string().optional(),
  footerText: z.string().optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

export async function registerCompanySettingsRoutes(app: FastifyInstance) {
  
  // GET /company/settings - Obtener configuración de la empresa
  app.get('/company/settings', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = req.db?.tenantId ?? req.auth?.tenantId;
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    
    try {
      const settings = await app.runWithDbContext(req, async (tx) => {
        return tx.companySettings.findUnique({
          where: { tenantId },
        });
      });
      
      return reply.send({ settings });
    } catch (error) {
      return reply.code(500).send({ error: 'Failed to fetch company settings' });
    }
  });
  
  // PUT /company/settings - Actualizar configuración
  app.put('/company/settings', async (req: FastifyRequest<{ Body: z.infer<typeof UpdateCompanySettingsSchema> }>, reply: FastifyReply) => {
    const tenantId = req.db?.tenantId ?? req.auth?.tenantId;
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    
    const validation = UpdateCompanySettingsSchema.safeParse(req.body);
    if (!validation.success) return reply.code(400).send({ error: 'Validación fallida', details: validation.error.errors });
    
    try {
      const settings = await app.runWithDbContext(req, async (tx) => {
        return tx.companySettings.upsert({
          where: { tenantId },
          update: {
            ...validation.data,
            updatedById: req.auth!.userId,
          },
          create: {
            tenantId,
            companyName: validation.data.companyName || 'Mi Empresa',
            ...validation.data,
            updatedById: req.auth!.userId,
          },
        });
      });
      
      return reply.send({ settings });
    } catch (error) {
      return reply.code(500).send({ error: 'Failed to update company settings' });
    }
  });
  
  // POST /company/logo - Subir logo (simulado - en producción usar S3)
  app.post('/company/logo', async (req: FastifyRequest<{ Body: { imageBase64: string; type: 'light' | 'dark' } }>, reply: FastifyReply) => {
    const tenantId = req.db?.tenantId ?? req.auth?.tenantId;
    if (!tenantId) return reply.code(400).send({ error: 'Se requiere contexto de tenant' });
    
    const { imageBase64, type } = req.body;
    if (!imageBase64) return reply.code(400).send({ error: 'Image is required' });
    
    try {
      // En producción: subir a S3 y obtener URL
      // Simulación: guardar base64 como data URL
      const logoUrl = imageBase64.startsWith('data:') ? imageBase64 : `data:image/png;base64,${imageBase64}`;
      
      const settings = await app.runWithDbContext(req, async (tx) => {
        return tx.companySettings.upsert({
          where: { tenantId },
          update: {
            [type === 'dark' ? 'logoDarkUrl' : 'logoUrl']: logoUrl,
            updatedById: req.auth!.userId,
          },
          create: {
            tenantId,
            companyName: 'Mi Empresa',
            [type === 'dark' ? 'logoDarkUrl' : 'logoUrl']: logoUrl,
            updatedById: req.auth!.userId,
          },
        });
      });
      
      return reply.send({ 
        success: true, 
        logoUrl,
        settings 
      });
    } catch (error) {
      return reply.code(500).send({ error: 'Failed to upload logo' });
    }
  });
}
