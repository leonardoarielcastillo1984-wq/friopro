/**
 * Script de uso único para enviar email con hallazgos activos actuales.
 * Ejecutar con: npx ts-node -r tsconfig-paths/register src/scripts/send-hallazgos-email.ts
 */
import { PrismaClient } from '@prisma/client';
import { sendEmail } from '../services/email';

const prisma = new PrismaClient();
const tenantId = '9239373f-b6fc-4ea0-ab2f-d25781a241b7';
const APP_URL = process.env.APP_URL || 'https://www.logismart.ar';

async function main() {
  // Obtener memberships TENANT_ADMIN
  const memberships = await (prisma as any).tenantMembership.findMany({
    where: { tenantId, role: 'TENANT_ADMIN', deletedAt: null, status: 'ACTIVE' },
    select: { user: { select: { id: true, email: true } } },
  });
  const admins = memberships.map((m: any) => m.user).filter((u: any) => u?.email);
  console.log('Admins:', admins.map((a: any) => a.email));

  // Emails extra configurados
  const settings = await (prisma as any).companySettings.findUnique({
    where: { tenantId },
    select: { inspeccionAlertEmails: true },
  });
  const extraList: any[] = Array.isArray(settings?.inspeccionAlertEmails) ? settings.inspeccionAlertEmails : [];
  const extraEmails = extraList.filter((e: any) => e.alertaHallazgo !== false && e.email).map((e: any) => e.email as string);
  console.log('Extra emails:', extraEmails);

  // Obtener hallazgos activos agrupados por inspección
  const hallazgos = await (prisma as any).inspeccionHallazgo.findMany({
    where: { inspeccion: { tenantId } },
    select: {
      id: true, descripcion: true, severidad: true, estado: true, createdAt: true,
      inspeccion: { select: { activoNombre: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  console.log('Hallazgos activos:', hallazgos.length);

  const company = await (prisma as any).companySettings.findUnique({ where: { tenantId }, select: { companyName: true } });
  const companyName = company?.companyName || 'SGI 360';

  const rows = hallazgos.map((h: any) =>
    `<tr style="border-bottom:1px solid #e5e7eb;">
      <td style="padding:8px 12px;font-size:13px;">${h.inspeccion?.activoNombre || '—'}</td>
      <td style="padding:8px 12px;font-size:13px;">${h.descripcion}</td>
      <td style="padding:8px 12px;font-size:13px;">
        <span style="padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:600;background:${h.severidad === 'CRITICO' ? '#FEE2E2' : h.severidad === 'GRAVE' ? '#FEF3C7' : '#FEF9C3'};color:${h.severidad === 'CRITICO' ? '#991B1B' : h.severidad === 'GRAVE' ? '#92400E' : '#713F12'};">
          ${h.severidad}
        </span>
      </td>
      <td style="padding:8px 12px;font-size:13px;color:#6B7280;">${new Date(h.createdAt).toLocaleDateString('es-AR')}</td>
    </tr>`
  ).join('');

  const hayCriticos = hallazgos.some((h: any) => h.severidad === 'CRITICO');
  const color = hayCriticos ? '#DC2626' : '#D97706';
  const title = `Resumen de hallazgos activos — ${hallazgos.length} hallazgo${hallazgos.length !== 1 ? 's' : ''}`;
  const link = `${APP_URL}/infraestructura?tab=inspecciones`;

  const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:640px;margin:0 auto;padding:40px 20px;">
  <h1 style="color:#111827;font-size:22px;margin-bottom:4px;">${companyName}</h1>
  <p style="color:#6B7280;font-size:13px;margin-top:0;">Sistema de Gestión Integrado — SGI 360</p>
  <div style="background:${color}15;border-left:4px solid ${color};padding:16px;border-radius:4px;margin:24px 0;">
    <p style="color:${color};font-weight:700;margin:0;font-size:16px;">${title}</p>
    <p style="color:#374151;margin:8px 0 0;font-size:14px;">Hallazgos detectados en inspecciones QR actualmente activos en el sistema.</p>
  </div>
  <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
    <thead>
      <tr style="background:#F9FAFB;text-align:left;">
        <th style="padding:10px 12px;font-size:11px;color:#6B7280;text-transform:uppercase;font-weight:600;">Activo</th>
        <th style="padding:10px 12px;font-size:11px;color:#6B7280;text-transform:uppercase;font-weight:600;">Descripción</th>
        <th style="padding:10px 12px;font-size:11px;color:#6B7280;text-transform:uppercase;font-weight:600;">Severidad</th>
        <th style="padding:10px 12px;font-size:11px;color:#6B7280;text-transform:uppercase;font-weight:600;">Fecha</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <a href="${link}" style="display:inline-block;background:#2563EB;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Ver en sistema →</a>
  <p style="color:#9CA3AF;font-size:11px;text-align:center;margin-top:32px;">© ${new Date().getFullYear()} ${companyName}. Todos los derechos reservados.</p>
</div>`;

  const subject = `${companyName} — ${title}`;
  const allEmails = [...new Set([...admins.map((a: any) => a.email), ...extraEmails])];

  for (const email of allEmails) {
    const result = await sendEmail({ to: email, subject, html, text: `${title}\n\nHallazgos activos:\n${hallazgos.map((h: any) => `- [${h.severidad}] ${h.inspeccion?.activoNombre}: ${h.descripcion}`).join('\n')}\n\n${link}` });
    console.log(`Email a ${email}:`, result.success ? '✅ Enviado' : `❌ Error: ${result.error}`);
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
