/**
 * notifyService — Envía notificaciones in-app + email cuando ocurren eventos críticos.
 *
 * Uso:
 *   await notifyNcrAssigned(prisma, { tenantId, ncrId, ncrCode, ncrTitle, assignedToId })
 *   await notifyCapaAssigned(prisma, { tenantId, capaId, capaTitle, assignedToId })
 *   await notifyDocumentReview(prisma, { tenantId, docId, docTitle, reviewerId })
 *   await notifyAuditScheduled(prisma, { tenantId, auditId, auditTitle, scheduledDate, userIds })
 */

import { sendEmail } from './email.js';

const APP_URL = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

type PrismaClient = any;

async function createNotification(
  prisma: PrismaClient,
  {
    tenantId,
    userId,
    type,
    title,
    message,
    link,
    entityType,
    entityId,
  }: {
    tenantId: string;
    userId: string;
    type: string;
    title: string;
    message: string;
    link: string;
    entityType: string;
    entityId: string;
  }
) {
  try {
    await prisma.notification.create({
      data: { tenantId, userId, type, title, message, link, entityType, entityId },
    });
  } catch (e) {
    console.error('[notifyService] Error creating notification:', e);
  }
}

async function getUserEmail(prisma: PrismaClient, userId: string): Promise<string | null> {
  try {
    const user = await prisma.platformUser.findUnique({ where: { id: userId }, select: { email: true } });
    return user?.email ?? null;
  } catch { return null; }
}

async function getCompanyBranding(prisma: PrismaClient, tenantId: string): Promise<{ logoUrl?: string | null; companyName?: string | null }> {
  try {
    const s = await prisma.companySettings.findUnique({ where: { tenantId }, select: { logoUrl: true, companyName: true } });
    return { logoUrl: s?.logoUrl ?? null, companyName: s?.companyName ?? null };
  } catch { return {}; }
}

// ── NCR asignada ─────────────────────────────────────────────────────────────

export async function notifyNcrAssigned(
  prisma: PrismaClient,
  { tenantId, ncrId, ncrCode, ncrTitle, assignedToId }: {
    tenantId: string; ncrId: string; ncrCode: string; ncrTitle: string; assignedToId: string;
  }
) {
  const link = `${APP_URL}/no-conformidades/${ncrId}`;
  const title = `NCR asignada: ${ncrCode}`;
  const message = `Se te asignó la no conformidad "${ncrTitle}". Revisá los detalles y tomá las acciones correspondientes.`;

  await createNotification(prisma, {
    tenantId, userId: assignedToId, type: 'NCR',
    title, message, link, entityType: 'ncr', entityId: ncrId,
  });

  const email = await getUserEmail(prisma, assignedToId);
  if (email) {
    const branding = await getCompanyBranding(prisma, tenantId);
    await sendEmail({
      to: email,
      subject: `${branding.companyName || 'SGI 360'} — ${title}`,
      html: buildEmailHtml(title, message, 'Ver NCR', link, '#DC2626', branding),
      text: `${title}\n\n${message}\n\n${link}`,
    }).catch(e => console.error('[notifyService] Email error:', e));
  }
}

// ── CAPA asignada ─────────────────────────────────────────────────────────────

export async function notifyCapaAssigned(
  prisma: PrismaClient,
  { tenantId, capaId, capaTitle, assignedToId, origin }: {
    tenantId: string; capaId: string; capaTitle: string; assignedToId: string; origin?: string;
  }
) {
  const link = `${APP_URL}/clima/planes-accion/${capaId}`;
  const title = `CAPA asignada`;
  const message = `Se te asignó el plan de acción "${capaTitle}"${origin ? ` (origen: ${origin})` : ''}. Por favor revisalo y actualizá su estado.`;

  await createNotification(prisma, {
    tenantId, userId: assignedToId, type: 'CAPA',
    title, message, link, entityType: 'capa', entityId: capaId,
  });

  const email = await getUserEmail(prisma, assignedToId);
  if (email) {
    const branding = await getCompanyBranding(prisma, tenantId);
    await sendEmail({
      to: email,
      subject: `${branding.companyName || 'SGI 360'} — ${title}`,
      html: buildEmailHtml(title, message, 'Ver CAPA', link, '#D97706', branding),
      text: `${title}\n\n${message}\n\n${link}`,
    }).catch(e => console.error('[notifyService] Email error:', e));
  }
}

// ── Documento requiere revisión ───────────────────────────────────────────────

export async function notifyDocumentReview(
  prisma: PrismaClient,
  { tenantId, docId, docTitle, reviewerId }: {
    tenantId: string; docId: string; docTitle: string; reviewerId: string;
  }
) {
  const link = `${APP_URL}/documents/${docId}`;
  const title = `Documento requiere revisión`;
  const message = `El documento "${docTitle}" fue enviado a revisión y requiere tu atención.`;

  await createNotification(prisma, {
    tenantId, userId: reviewerId, type: 'DOCUMENT',
    title, message, link, entityType: 'document', entityId: docId,
  });

  const email = await getUserEmail(prisma, reviewerId);
  if (email) {
    const branding = await getCompanyBranding(prisma, tenantId);
    await sendEmail({
      to: email,
      subject: `${branding.companyName || 'SGI 360'} — ${title}`,
      html: buildEmailHtml(title, message, 'Ver documento', link, '#2563EB', branding),
      text: `${title}\n\n${message}\n\n${link}`,
    }).catch(e => console.error('[notifyService] Email error:', e));
  }
}

// ── Auditoría programada ──────────────────────────────────────────────────────

export async function notifyAuditScheduled(
  prisma: PrismaClient,
  { tenantId, auditId, auditTitle, scheduledDate, userIds }: {
    tenantId: string; auditId: string; auditTitle: string; scheduledDate: Date; userIds: string[];
  }
) {
  const link = `${APP_URL}/auditorias/${auditId}`;
  const dateStr = scheduledDate.toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });
  const title = `Auditoría programada: ${auditTitle}`;
  const message = `Estás asignado a la auditoría "${auditTitle}" programada para el ${dateStr}.`;
  const branding = await getCompanyBranding(prisma, tenantId);

  for (const userId of userIds) {
    await createNotification(prisma, {
      tenantId, userId, type: 'AUDIT',
      title, message, link, entityType: 'audit', entityId: auditId,
    });

    const email = await getUserEmail(prisma, userId);
    if (email) {
      await sendEmail({
        to: email,
        subject: `${branding.companyName || 'SGI 360'} — ${title}`,
        html: buildEmailHtml(title, message, 'Ver auditoría', link, '#7C3AED', branding),
        text: `${title}\n\n${message}\n\n${link}`,
      }).catch(e => console.error('[notifyService] Email error:', e));
    }
  }
}

// ── Inspección: nuevo hallazgo ────────────────────────────────────────────────

async function getInspeccionAlertEmails(prisma: PrismaClient, tenantId: string, tipo: 'alertaHallazgo' | 'alertaOT'): Promise<string[]> {
  try {
    const s = await prisma.companySettings.findUnique({ where: { tenantId }, select: { inspeccionAlertEmails: true } });
    const list: any[] = Array.isArray(s?.inspeccionAlertEmails) ? s.inspeccionAlertEmails : [];
    return list.filter((e: any) => e[tipo] !== false && e.email).map((e: any) => e.email as string);
  } catch { return []; }
}

export async function notifyInspeccionHallazgo(
  prisma: PrismaClient,
  { tenantId, activoNombre, hallazgosCount, haysCriticos, inspeccionId }: {
    tenantId: string; activoNombre: string; hallazgosCount: number; haysCriticos: boolean; inspeccionId: string;
  }
) {
  try {
    const memberships = await (prisma as any).tenantMembership.findMany({
      where: { tenantId, role: 'TENANT_ADMIN', deletedAt: null, status: 'ACTIVE' },
      select: { user: { select: { id: true, email: true } } },
    });
    const admins = memberships.map((m: any) => m.user).filter((u: any) => u?.email);

    const link = `${APP_URL}/infraestructura?tab=inspecciones`;
    const color = haysCriticos ? '#DC2626' : '#D97706';
    const severity = haysCriticos ? '🚨 CRÍTICO' : '⚠️ Moderado';
    const title = `${severity} — ${hallazgosCount} hallazgo${hallazgosCount > 1 ? 's' : ''} detectado${hallazgosCount > 1 ? 's' : ''}`;
    const message = `Se registró una inspección en el activo <strong>${activoNombre}</strong> con ${hallazgosCount} hallazgo${hallazgosCount > 1 ? 's' : ''}${haysCriticos ? ' de severidad <strong>CRÍTICA</strong>' : ''}. Revisá los hallazgos y tomá acción.`;
    const branding = await getCompanyBranding(prisma, tenantId);

    for (const admin of admins) {
      await createNotification(prisma, {
        tenantId, userId: admin.id, type: 'INSPECCION',
        title, message: message.replace(/<[^>]+>/g, ''), link, entityType: 'inspeccion', entityId: inspeccionId,
      });
      if (admin.email) {
        await sendEmail({
          to: admin.email,
          subject: `${branding.companyName || 'SGI 360'} — ${title}`,
          html: buildEmailHtml(title, message, 'Ver hallazgos', link, color, branding),
          text: `${title}\n\nActivo: ${activoNombre}\nHallazgos: ${hallazgosCount}\n\n${link}`,
        }).catch(e => console.error('[notifyService] Email error hallazgo:', e));
      }
    }

    // Emails adicionales configurados por el tenant
    const extraEmails = await getInspeccionAlertEmails(prisma, tenantId, 'alertaHallazgo');
    const adminEmails = new Set(admins.map((a: any) => a.email).filter(Boolean));
    for (const email of extraEmails) {
      if (!adminEmails.has(email)) {
        await sendEmail({
          to: email,
          subject: `${branding.companyName || 'SGI 360'} — ${title}`,
          html: buildEmailHtml(title, message, 'Ver hallazgos', link, color, branding),
          text: `${title}\n\nActivo: ${activoNombre}\nHallazgos: ${hallazgosCount}\n\n${link}`,
        }).catch(e => console.error('[notifyService] Email extra hallazgo:', e));
      }
    }
  } catch (e) {
    console.error('[notifyService] notifyInspeccionHallazgo error:', e);
  }
}

// ── Inspección: OT creada ─────────────────────────────────────────────────────

export async function notifyInspeccionOT(
  prisma: PrismaClient,
  { tenantId, otCode, otTitle, activoNombre, otId }: {
    tenantId: string; otCode: string; otTitle: string; activoNombre: string; otId: string;
  }
) {
  try {
    const memberships = await (prisma as any).tenantMembership.findMany({
      where: { tenantId, role: 'TENANT_ADMIN', deletedAt: null, status: 'ACTIVE' },
      select: { user: { select: { id: true, email: true } } },
    });
    const admins = memberships.map((m: any) => m.user).filter((u: any) => u?.email);
    if (!admins.length) return;

    const link = `${APP_URL}/infraestructura?tab=inspecciones&sub=ots`;
    const title = `OT creada desde inspección: ${otCode}`;
    const message = `Se generó la orden de trabajo <strong>${otCode}</strong> — "${otTitle}" para el activo <strong>${activoNombre}</strong>.`;
    const branding = await getCompanyBranding(prisma, tenantId);

    for (const admin of admins) {
      await createNotification(prisma, {
        tenantId, userId: admin.id, type: 'INSPECCION_OT',
        title, message: message.replace(/<[^>]+>/g, ''), link, entityType: 'work_order', entityId: otId,
      });
      if (admin.email) {
        await sendEmail({
          to: admin.email,
          subject: `${branding.companyName || 'SGI 360'} — ${title}`,
          html: buildEmailHtml(title, message, 'Ver OT', link, '#2563EB', branding),
          text: `${title}\n\nOT: ${otCode}\nActivo: ${activoNombre}\n\n${link}`,
        }).catch(e => console.error('[notifyService] Email error OT:', e));
      }
    }

    const extraEmails = await getInspeccionAlertEmails(prisma, tenantId, 'alertaOT');
    const adminEmails = new Set(admins.map((a: any) => a.email).filter(Boolean));
    for (const email of extraEmails) {
      if (!adminEmails.has(email)) {
        await sendEmail({
          to: email,
          subject: `${branding.companyName || 'SGI 360'} — ${title}`,
          html: buildEmailHtml(title, message, 'Ver OT', link, '#2563EB', branding),
          text: `${title}\n\nOT: ${otCode}\nActivo: ${activoNombre}\n\n${link}`,
        }).catch(e => console.error('[notifyService] Email extra OT:', e));
      }
    }
  } catch (e) {
    console.error('[notifyService] notifyInspeccionOT error:', e);
  }
}

// ── HTML template ─────────────────────────────────────────────────────────────

function buildEmailHtml(
  title: string, message: string, btnLabel: string, btnUrl: string, color: string,
  branding?: { logoUrl?: string | null; companyName?: string | null }
): string {
  const name = branding?.companyName || 'SGI 360';
  const logoHtml = branding?.logoUrl
    ? `<img src="${branding.logoUrl}" alt="${name}" style="max-height:60px;max-width:180px;object-fit:contain;" />`
    : `<h1 style="color:#111827;font-size:22px;margin:0;">${name}</h1><p style="color:#6B7280;font-size:13px;margin:4px 0 0;">Sistema de Gestión Integrado</p>`;
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:40px 20px;">
      <div style="text-align:center;margin-bottom:28px;">${logoHtml}</div>
      <div style="background:#fff;border:1px solid #E5E7EB;border-radius:12px;padding:28px;">
        <div style="display:inline-block;background:${color}20;border:1px solid ${color}40;border-radius:8px;padding:6px 12px;margin-bottom:16px;">
          <span style="color:${color};font-size:12px;font-weight:600;">${title}</span>
        </div>
        <p style="color:#374151;font-size:14px;line-height:1.7;margin:0 0 24px;">${message}</p>
        <div style="text-align:center;">
          <a href="${btnUrl}" style="display:inline-block;background:${color};color:#fff;font-weight:600;font-size:14px;padding:12px 32px;border-radius:8px;text-decoration:none;">${btnLabel} →</a>
        </div>
      </div>
      <p style="color:#9CA3AF;font-size:11px;text-align:center;margin-top:20px;">© ${new Date().getFullYear()} ${name}. Todos los derechos reservados.</p>
    </div>`;
}
