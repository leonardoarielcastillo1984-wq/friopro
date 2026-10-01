import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getEffectiveTenantId, isSuperAdmin } from '../utils/tenant-bypass.js';
import { sendEmail } from '../services/email.js';

/**
 * Feedback — buzón de sugerencias al desarrollador (ícono 💡 en la app).
 * Cualquier usuario logueado envía una sugerencia/error/pregunta; se guarda
 * en feedback_sugerencias y se reenvía por mail a soporte.
 */
const DESTINOS = (process.env.FEEDBACK_EMAIL || 'soporte@logismart.ar')
  .split(',').map((s: string) => s.trim()).filter(Boolean);

const TIPOS: Record<string, string> = {
  SUGERENCIA: 'Sugerencia',
  ERROR: 'Reporte de error',
  PREGUNTA: 'Pregunta',
};

export async function registerFeedbackRoutes(app: FastifyInstance) {
  app.post('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await getEffectiveTenantId(req, app.prisma);
    if (!tenantId) return reply.code(401).send({ error: 'Unauthorized' });
    const user = (req as any).user;

    const schema = z.object({
      tipo: z.enum(['SUGERENCIA', 'ERROR', 'PREGUNTA']),
      mensaje: z.string().min(3).max(3000),
      pagina: z.string().max(500).optional(),
    });
    const body = schema.safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: 'Datos inválidos', details: body.error.errors });
    const d = body.data;

    const tenant = await (app.prisma as any).tenant.findUnique({
      where: { id: tenantId }, select: { name: true },
    }).catch(() => null);

    const sug = await (app.prisma as any).feedbackSugerencia.create({
      data: {
        tenantId,
        tipo: d.tipo,
        mensaje: d.mensaje,
        pagina: d.pagina || null,
        usuarioId: user?.id || null,
        usuarioNombre: user?.name || null,
        usuarioEmail: user?.email || null,
      },
    });

    // Mail a soporte — fire & forget, no bloquea la respuesta al usuario
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    sendEmail({
      to: DESTINOS.join(','),
      subject: `[SGI360] ${TIPOS[d.tipo]} de ${user?.name || 'usuario'} — ${tenant?.name || tenantId}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px">
          <h2 style="color:#7C3AED;margin:0 0 12px">💡 ${TIPOS[d.tipo]} — SGI360</h2>
          <table style="font-size:13px;color:#374151;border-collapse:collapse">
            <tr><td style="padding:3px 12px 3px 0;color:#6B7280">Empresa</td><td><b>${esc(tenant?.name || tenantId)}</b></td></tr>
            <tr><td style="padding:3px 12px 3px 0;color:#6B7280">Usuario</td><td>${esc(user?.name || '—')} ${user?.email ? `&lt;${esc(user.email)}&gt;` : ''}</td></tr>
            ${d.pagina ? `<tr><td style="padding:3px 12px 3px 0;color:#6B7280">Página</td><td>${esc(d.pagina)}</td></tr>` : ''}
            <tr><td style="padding:3px 12px 3px 0;color:#6B7280">Fecha</td><td>${new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}</td></tr>
          </table>
          <div style="margin-top:14px;padding:14px;background:#F5F3FF;border-radius:8px;font-size:14px;color:#111827;white-space:pre-wrap">${esc(d.mensaje)}</div>
          <p style="font-size:11px;color:#9CA3AF;margin-top:14px">Para responder, contestá este mail al email del usuario (o escribile directo).</p>
        </div>`,
      text: `${TIPOS[d.tipo]} de ${user?.name || 'usuario'} (${user?.email || 'sin email'}) — ${tenant?.name || tenantId}\nPágina: ${d.pagina || '—'}\n\n${d.mensaje}`,
    }).catch((e: any) => console.error('[feedback] mail:', e));

    return reply.code(201).send({ ok: true, id: sug.id });
  });

  // Listado para superadmin (buzón interno)
  app.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!isSuperAdmin(req)) return reply.code(403).send({ error: 'Solo superadmin' });
    const items = await (app.prisma as any).feedbackSugerencia.findMany({
      orderBy: { createdAt: 'desc' }, take: 200,
    });
    const ids = [...new Set(items.map((i: any) => i.tenantId))];
    const tenants = await (app.prisma as any).tenant.findMany({
      where: { id: { in: ids } }, select: { id: true, name: true },
    }).catch(() => []);
    const tMap = new Map(tenants.map((t: any) => [t.id, t.name]));
    return reply.send({ items: items.map((i: any) => ({ ...i, tenantNombre: tMap.get(i.tenantId) || null })) });
  });
}
