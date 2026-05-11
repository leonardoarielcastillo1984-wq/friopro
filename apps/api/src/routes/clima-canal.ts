import type { FastifyPluginAsync } from 'fastify';
import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { getEffectiveTenantId } from '../utils/tenant-bypass.js';

// Schema Zod para validación
const generateQRSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  subtitle: z.string().min(1).max(200).optional(),
  message: z.string().min(1).max(500).optional(),
  footer: z.string().min(1).max(200).optional(),
});

const submitSuggestionSchema = z.object({
  type: z.enum(['SUGGESTION', 'COMPLAINT', 'ALERT', 'RISK', 'CONCERN', 'OPPORTUNITY', 'INCIDENT', 'IDEA']),
  category: z.enum(['WORK_ENVIRONMENT', 'PROCESS', 'SAFETY', 'QUALITY', 'COMMUNICATION', 'OTHER']).optional(),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  isAnonymous: z.boolean().default(true),
  contactEmail: z.string().email().optional().or(z.literal('')).transform(v => v || undefined),
  contactPhone: z.string().max(50).optional().or(z.literal('')).transform(v => v || undefined),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
});

// Generar token único
function generateToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

export const climaCanalRoutes: FastifyPluginAsync = async (app) => {
  // GET /clima/canal-qr - Obtener o generar QR del tenant
  app.get('/canal-qr', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });

    try {
      // Buscar QR activo existente
      let canalQR = await app.prisma.climaCanalQR.findFirst({
        where: { tenantId, isActive: true },
        orderBy: { generatedAt: 'desc' },
        include: { tenant: { select: { id: true, name: true } } },
      });

      // Si no existe, generar uno nuevo
      if (!canalQR) {
        const created = await app.prisma.climaCanalQR.create({
          data: {
            tenantId,
            token: generateToken(),
            generatedById: (req as any).auth?.userId ?? null,
          },
          include: { tenant: { select: { id: true, name: true } } },
        });
        canalQR = created;
      }

      // Obtener logo
      const settings = await app.prisma.companySettings.findUnique({
        where: { tenantId },
        select: { logoUrl: true, primaryColor: true },
      }).catch(() => null);

      // Construir URL pública
      const baseUrl = process.env.APP_URL || 'https://logismart.ar';
      const publicUrl = `${baseUrl}/canal/${canalQR.token}`;

      return reply.send({
        id: canalQR.id,
        token: canalQR.token,
        publicUrl,
        isActive: canalQR.isActive,
        tenantName: canalQR.tenant.name,
        logoUrl: settings?.logoUrl ?? null,
        primaryColor: settings?.primaryColor ?? '#2563eb',
        config: {
          title: canalQR.title,
          subtitle: canalQR.subtitle,
          message: canalQR.message,
          footer: canalQR.footer,
        },
        stats: {
          generatedAt: canalQR.generatedAt,
          lastUsedAt: canalQR.lastUsedAt,
          useCount: canalQR.useCount,
        },
      });
    } catch (err) {
      app.log.error(err, 'Error generating canal QR');
      return reply.code(500).send({ error: 'Error generando QR' });
    }
  });

  // POST /clima/canal-qr - Regenerar/actualizar QR
  app.post('/canal-qr', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });

    const body = generateQRSchema.safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({ error: 'Datos inválidos', details: body.error.errors });
    }

    try {
      // Desactivar QR anterior si existe
      await app.prisma.climaCanalQR.updateMany({
        where: { tenantId, isActive: true },
        data: { isActive: false },
      });

      // Crear nuevo QR
      const canalQR = await app.prisma.climaCanalQR.create({
        data: {
          tenantId,
          token: generateToken(),
          generatedById: (req as any).auth?.userId ?? null,
          ...(body.data.title && { title: body.data.title }),
          ...(body.data.subtitle && { subtitle: body.data.subtitle }),
          ...(body.data.message && { message: body.data.message }),
          ...(body.data.footer && { footer: body.data.footer }),
        },
      });

      const baseUrl = process.env.APP_URL || 'https://logismart.ar';
      const publicUrl = `${baseUrl}/canal/${canalQR.token}`;

      return reply.send({
        id: canalQR.id,
        token: canalQR.token,
        publicUrl,
        config: {
          title: canalQR.title,
          subtitle: canalQR.subtitle,
          message: canalQR.message,
          footer: canalQR.footer,
        },
      });
    } catch (err) {
      app.log.error(err, 'Error regenerating canal QR');
      return reply.code(500).send({ error: 'Error regenerando QR' });
    }
  });

  // GET /clima/canal/:token - Validar token y obtener info del tenant
  app.get('/canal/:token', async (req, reply) => {
    const { token } = req.params as { token: string };

    try {
      const canalQR = await app.prisma.climaCanalQR.findFirst({
        where: { token, isActive: true },
        include: { tenant: { select: { id: true, name: true } } },
      });

      if (!canalQR) {
        return reply.code(404).send({ error: 'Canal no encontrado o inactivo' });
      }

      // Obtener logo y branding del tenant
      const settings = await app.prisma.companySettings.findUnique({
        where: { tenantId: canalQR.tenantId },
        select: { logoUrl: true, primaryColor: true },
      }).catch(() => null);

      // Actualizar último uso
      await app.prisma.climaCanalQR.update({
        where: { id: canalQR.id },
        data: { lastUsedAt: new Date(), useCount: { increment: 1 } },
      });

      return reply.send({
        valid: true,
        tenant: {
          id: canalQR.tenant.id,
          name: canalQR.tenant.name,
          logoUrl: settings?.logoUrl ?? null,
          primaryColor: settings?.primaryColor ?? '#2563eb',
        },
        config: {
          title: canalQR.title,
          subtitle: canalQR.subtitle,
          message: canalQR.message,
          footer: canalQR.footer,
        },
      });
    } catch (err) {
      app.log.error(err, 'Error validating canal token');
      return reply.code(500).send({ error: 'Error validando canal' });
    }
  });

  // POST /clima/canal/:token - Enviar sugerencia anónima
  app.post('/canal/:token', async (req, reply) => {
    const { token } = req.params as { token: string };

    const body = submitSuggestionSchema.safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({ error: 'Datos inválidos', details: body.error.errors });
    }

    try {
      // Validar token y obtener tenant
      const canalQR = await app.prisma.climaCanalQR.findFirst({
        where: { token, isActive: true },
        include: { tenant: true },
      });

      if (!canalQR) {
        return reply.code(404).send({ error: 'Canal no encontrado o inactivo' });
      }

      // Mapear tipos del canal QR a tipos del schema ClimaSuggestion
      const typeMap: Record<string, string> = {
        SUGGESTION: 'SUGERENCIA', COMPLAINT: 'RECLAMO', ALERT: 'ALERTA',
        RISK: 'ALERTA', CONCERN: 'INQUIETUD', OPPORTUNITY: 'MEJORA',
        INCIDENT: 'RECLAMO', IDEA: 'MEJORA',
      };
      const priorityMap: Record<string, string> = {
        LOW: 'BAJA', MEDIUM: 'MEDIA', HIGH: 'ALTA', CRITICAL: 'CRITICA',
      };

      // Crear sugerencia
      const suggestion = await app.prisma.climaSuggestion.create({
        data: {
          tenantId: canalQR.tenantId,
          type: typeMap[body.data.type] || 'SUGERENCIA',
          category: body.data.category || 'OTHER',
          title: body.data.title,
          content: body.data.description,
          isAnonymous: body.data.isAnonymous,
          priority: priorityMap[body.data.priority] || 'MEDIA',
          status: 'ABIERTO',
          contactEmail: body.data.contactEmail || null,
          contactPhone: body.data.contactPhone || null,
        },
      });

      // Incrementar contador de uso
      await app.prisma.climaCanalQR.update({
        where: { id: canalQR.id },
        data: {
          lastUsedAt: new Date(),
          useCount: { increment: 1 },
        },
      });

      // Notificar admins del tenant (async, no bloquear respuesta)
      setImmediate(async () => {
        try {
          const admins = await app.prisma.platformUser.findMany({
            where: {
              memberships: { some: { tenantId: canalQR.tenantId } },
              deletedAt: null,
            },
            select: { email: true },
          });

          if (admins.length > 0) {
            // Aquí se integraría con el sistema de notificaciones
            app.log.info(`Nueva sugerencia canal QR #${suggestion.id} para ${admins.length} admins`);
          }
        } catch (notifyErr) {
          app.log.error(notifyErr, 'Error notificando admins');
        }
      });

      return reply.code(201).send({
        success: true,
        message: 'Gracias por tu aporte. Tu mensaje fue recibido y será revisado.',
        suggestionId: suggestion.id,
      });
    } catch (err) {
      app.log.error(err, 'Error submitting canal suggestion');
      return reply.code(500).send({ error: 'Error enviando sugerencia' });
    }
  });

  // GET /clima/canal-qr/pdf - HTML para imprimir cartel institucional
  app.get('/canal-qr/pdf', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });

    try {
      // Buscar QR activo
      const canalQR = await app.prisma.climaCanalQR.findFirst({
        where: { tenantId, isActive: true },
        include: { tenant: { select: { id: true, name: true } } },
      });

      if (!canalQR) {
        return reply.code(404).send({ error: 'No hay QR activo. Generá uno primero.' });
      }

      const settings = await app.prisma.companySettings.findUnique({
        where: { tenantId },
        select: { logoUrl: true, primaryColor: true },
      }).catch(() => null);

      const baseUrl = process.env.APP_URL || 'https://logismart.ar';
      const publicUrl = `${baseUrl}/canal/${canalQR.token}`;

      const companyName = canalQR.tenant.name;
      const logoUrl = settings?.logoUrl ?? null;
      const primaryColor = settings?.primaryColor || '#2563eb';

      // Generar HTML del cartel
      const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cartel Institucional - Canal de Participación</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 20px;
    }
    .poster {
      background: white;
      border-radius: 24px;
      padding: 48px;
      max-width: 500px;
      width: 100%;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      text-align: center;
    }
    .logo {
      max-height: 60px;
      max-width: 200px;
      margin-bottom: 24px;
      object-fit: contain;
    }
    .company-name {
      font-size: 14px;
      color: #6b7280;
      margin-bottom: 32px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .title {
      font-size: 32px;
      font-weight: 800;
      color: ${primaryColor};
      margin-bottom: 16px;
      line-height: 1.2;
    }
    .subtitle {
      font-size: 18px;
      color: #374151;
      margin-bottom: 32px;
      line-height: 1.5;
    }
    .qr-container {
      background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
      border-radius: 20px;
      padding: 32px;
      margin-bottom: 32px;
    }
    .qr-code {
      width: 200px;
      height: 200px;
      background: white;
      border-radius: 16px;
      margin: 0 auto 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }
    .qr-placeholder {
      font-size: 80px;
      color: ${primaryColor};
    }
    .qr-url {
      font-size: 12px;
      color: #6b7280;
      word-break: break-all;
      font-family: monospace;
    }
    .message {
      font-size: 16px;
      color: #4b5563;
      margin-bottom: 24px;
      line-height: 1.6;
    }
    .features {
      display: flex;
      justify-content: center;
      gap: 24px;
      flex-wrap: wrap;
      margin-bottom: 32px;
    }
    .feature {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      color: #6b7280;
    }
    .feature-icon {
      font-size: 18px;
    }
    .footer {
      border-top: 1px solid #e5e7eb;
      padding-top: 24px;
      font-size: 12px;
      color: #9ca3af;
    }
    .footer-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
    }
    .print-button {
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${primaryColor};
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      transition: all 0.2s;
    }
    .print-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    }
    @media print {
      body { background: white; padding: 0; }
      .poster { box-shadow: none; max-width: 100%; }
      .print-button { display: none; }
    }
    @media (max-width: 600px) {
      .poster { padding: 32px 24px; }
      .title { font-size: 24px; }
      .subtitle { font-size: 16px; }
    }
  </style>
</head>
<body>
  <button class="print-button" onclick="window.print()">🖨️ Imprimir / Guardar PDF</button>
  
  <div class="poster">
    ${logoUrl ? `<img src="${logoUrl}" alt="${companyName}" class="logo">` : ''}
    <div class="company-name">${companyName}</div>
    
    <h1 class="title">${canalQR.title}</h1>
    <p class="subtitle">${canalQR.subtitle}</p>
    
    <div class="qr-container">
      <div class="qr-code">
        <div class="qr-placeholder">📱</div>
      </div>
      <div class="qr-url">${publicUrl}</div>
    </div>
    
    <p class="message">${canalQR.message}</p>
    
    <div class="features">
      <div class="feature">
        <span class="feature-icon">📱</span>
        <span>Acceso rápido desde tu celular</span>
      </div>
      <div class="feature">
        <span class="feature-icon">🔒</span>
        <span>Posibilidad de envío anónimo</span>
      </div>
      <div class="feature">
        <span class="feature-icon">⚡</span>
        <span>Comunicación directa</span>
      </div>
    </div>
    
    <div class="footer">
      <div class="footer-meta">
        <span>Canal #${canalQR.token.slice(-6).toUpperCase()}</span>
        <span>Generado el ${new Date(canalQR.generatedAt).toLocaleDateString('es-ES')}</span>
      </div>
      <p style="margin-top: 8px;">${canalQR.footer}</p>
      <p style="margin-top: 16px; font-size: 10px; color: #d1d5db;">
        Powered by SGI360 · Canal Inteligente de Participación
      </p>
    </div>
  </div>
  
  <script>
    // Auto-print after 500ms
    setTimeout(() => {
      if (window.matchMedia('print').matches === false) {
        console.log('Listo para imprimir. Usá Ctrl+P o el botón 🖨️');
      }
    }, 500);
  </script>
</body>
</html>`;

      return reply
        .code(200)
        .header('Content-Type', 'text/html')
        .send(html);
        
    } catch (err) {
      app.log.error(err, 'Error generating PDF poster');
      return reply.code(500).send({ error: 'Error generando cartel' });
    }
  });

  // GET /clima/canal/:token/stats - Estadísticas del canal (admin only)
  app.get('/canal/:token/stats', async (req: FastifyRequest, reply: FastifyReply) => {
    const { token } = req.params as { token: string };
    const tenantId = req.auth?.tenantId;

    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });

    try {
      const canalQR = await app.prisma.climaCanalQR.findFirst({
        where: { token, tenantId },
        include: {
          _count: {
            select: {
              suggestions: true,
            },
          },
          suggestions: {
            where: { deletedAt: null },
            select: {
              status: true,
              type: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        },
      });

      if (!canalQR) {
        return reply.code(404).send({ error: 'Canal no encontrado' });
      }

      const stats = {
        totalSuggestions: canalQR._count.suggestions,
        byStatus: {
          pending: canalQR.suggestions.filter(s => s.status === 'PENDING').length,
          inProgress: canalQR.suggestions.filter(s => s.status === 'IN_PROGRESS').length,
          resolved: canalQR.suggestions.filter(s => s.status === 'RESOLVED').length,
          rejected: canalQR.suggestions.filter(s => s.status === 'REJECTED').length,
        },
        byType: {
          suggestion: canalQR.suggestions.filter(s => s.type === 'SUGGESTION').length,
          complaint: canalQR.suggestions.filter(s => s.type === 'COMPLAINT').length,
          alert: canalQR.suggestions.filter(s => s.type === 'ALERT').length,
          risk: canalQR.suggestions.filter(s => s.type === 'RISK').length,
          concern: canalQR.suggestions.filter(s => s.type === 'CONCERN').length,
          opportunity: canalQR.suggestions.filter(s => s.type === 'OPPORTUNITY').length,
          incident: canalQR.suggestions.filter(s => s.type === 'INCIDENT').length,
          idea: canalQR.suggestions.filter(s => s.type === 'IDEA').length,
        },
        recent: canalQR.suggestions.slice(0, 5).map(s => ({
          id: s.id,
          type: s.type,
          status: s.status,
          createdAt: s.createdAt,
        })),
        canalStats: {
          generatedAt: canalQR.generatedAt,
          lastUsedAt: canalQR.lastUsedAt,
          useCount: canalQR.useCount,
        },
      };

      return reply.send(stats);
    } catch (err) {
      app.log.error(err, 'Error getting canal stats');
      return reply.code(500).send({ error: 'Error obteniendo estadísticas' });
    }
  });
};
