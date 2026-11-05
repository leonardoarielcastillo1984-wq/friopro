import { PrismaClient } from '@prisma/client';
import { sendEmail, notificationEmail } from '../services/email.js';
import { unsubscribeUrl } from '../routes/growth.js';

const APP_URL = process.env.CORS_ORIGIN?.split(',')[0]?.trim() || 'https://logismart.ar';

// Títulos legibles por source (mismo mapeo que LEAD_RESOURCES en publicRoutes)
const RESOURCE_TITLES: Record<string, string> = {
  'checklist-iso-9001': 'el Checklist ISO 9001 — Autodiagnóstico',
  'matriz-iperc': 'la Matriz IPERC (Excel)',
  'plantilla-bia': 'la Plantilla BIA (Excel)',
  'soa-iso-27001': 'la Declaración de Aplicabilidad ISO 27001 (Excel)',
};
const resourceTitle = (lead: any) => RESOURCE_TITLES[lead.source] || 'un recurso gratuito';

// Secuencia de 3 emails post-lead-magnet (descarga de plantilla/checklist).
// Solo a leads que NO se registraron y NO se dieron de baja.
//   step 1 (+1d):  tips para aplicar el recurso descargado
//   step 2 (+4d):  qué resuelve SGI360 vs. plantillas sueltas
//   step 3 (+8d):  oferta trial 30 días — último email, siempre con unsubscribe
const STEPS: { step: number; minHoursSincePrev: number; build: (lead: any) => Parameters<typeof notificationEmail>[0] }[] = [
  {
    step: 1,
    minHoursSincePrev: 24, // desde createdAt
    build: (lead) => ({
      userEmail: lead.email,
      title: `¿Pudiste usar ${lead.nombre ? 'tu recurso' : 'el recurso'}?`,
      message: `Hola${lead.nombre ? ` ${lead.nombre}` : ''},<br><br>` +
        `Hace un día descargaste <strong>${resourceTitle(lead)}</strong> de LOGISMART.<br><br>` +
        `Tips rápidos para sacarle más jugo:<br>` +
        `• Empezá por los ítems marcados "críticos" — son los que más pesan en una auditoría.<br>` +
        `• No busques el 100%: con cerrar las brechas más visibles ya estás mejorando tu SG.<br>` +
        `• Guardate una copia firmada como evidencia de autodiagnóstico.<br><br>` +
        `Cuando quieras pasar de plantillas sueltas a un sistema que lo gestiona todo, tenés 30 días gratis.`,
      actionLabel: 'Probar SGI 360 gratis',
      actionUrl: `${APP_URL}/register?utm_source=nurture&utm_medium=email&utm_campaign=step1`,
      type: 'info',
    }),
  },
  {
    step: 2,
    minHoursSincePrev: 72, // desde el email anterior
    build: (lead) => ({
      userEmail: lead.email,
      title: 'Las plantillas ordenan — el sistema las mantiene vivas',
      message: `Hola${lead.nombre ? ` ${lead.nombre}` : ''},<br><br>` +
        `Una matriz o checklist en Excel funciona hasta que:<br>` +
        `• nadie actualiza la versión correcta,<br>` +
        `• los vencimientos se pasan sin aviso,<br>` +
        `• y la auditoría pide trazabilidad que el Excel no tiene.<br><br>` +
        `SGI 360 resuelve exactamente eso: documentos versionados con QR, ` +
        `alertas automáticas, auditorías con hallazgos trazables y ` +
        `evidencias vinculadas a cada requisito de la norma.<br><br>` +
        `Clientes en Argentina ya lo usan para ISO 9001, 14001 y 45001.`,
      actionLabel: 'Ver cómo funciona',
      actionUrl: `${APP_URL}/sgi360?utm_source=nurture&utm_medium=email&utm_campaign=step2`,
      type: 'info',
    }),
  },
  {
    step: 3,
    minHoursSincePrev: 96, // desde el email anterior — último de la secuencia
    build: (lead) => ({
      userEmail: lead.email,
      title: 'Último email — 30 días gratis, sin tarjeta',
      message: `Hola${lead.nombre ? ` ${lead.nombre}` : ''},<br><br>` +
        `Cierro la secuencia con una invitación directa: ` +
        `probá SGI 360 durante <strong>30 días gratis</strong>, sin tarjeta ni compromiso.<br><br>` +
        `Si ya tenés tu sistema en papeles o planillas, migrar es más rápido de lo que parece — ` +
        `la estructura documental y los checklists ya vienen precargados por norma.<br><br>` +
        `Si no te interesa, no te escribo más: podés darte de baja con un click abajo.`,
      actionLabel: 'Empezar mi trial',
      actionUrl: `${APP_URL}/register?utm_source=nurture&utm_medium=email&utm_campaign=step3`,
      type: 'success',
    }),
  },
];

class GrowthNurtureJob {
  private prisma = new PrismaClient();
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  startMonitoring(intervalHours = 6) {
    if (this.timer) return;
    // Primera pasada a los 5 min de boot (deja estabilizar SMTP/DB)
    setTimeout(() => void this.runOnce(), 5 * 60 * 1000);
    this.timer = setInterval(() => void this.runOnce(), intervalHours * 60 * 60 * 1000);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async runOnce() {
    if (this.running) return;
    this.running = true;
    try {
      // Leads activos en la secuencia (consentidos, no dados de baja, step < 3)
      const leads = await this.prisma.marketingLead.findMany({
        where: { nurtureStep: { lt: STEPS.length }, unsubscribedAt: null, consentedAt: { not: null } },
        orderBy: { createdAt: 'asc' },
        take: 200, // lote acotado por corrida
      });
      if (!leads.length) return;

      let sent = 0;
      for (const lead of leads) {
        const nextStep = STEPS.find((s) => s.step === lead.nurtureStep + 1);
        if (!nextStep) continue;

        const base = lead.lastNurturedAt ?? lead.createdAt;
        const elapsedHours = (Date.now() - base.getTime()) / 3600e3;
        if (elapsedHours < nextStep.minHoursSincePrev) continue;

        // ¿Se registró con este email? Cortar la secuencia — ya convirtió.
        const registered = await this.prisma.platformUser.findUnique({
          where: { email: lead.email.toLowerCase() }, select: { id: true },
        });
        if (registered) {
          await this.prisma.marketingLead.update({
            where: { id: lead.id },
            data: { nurtureStep: STEPS.length, lastNurturedAt: new Date() },
          });
          continue;
        }

        const built = nextStep.build(lead);
        const payload = notificationEmail(built);
        // Adjuntar link de baja (obligación básica de marketing email).
        // EMAIL_TEMPLATE_BASE no tiene </body> — se concatena al final.
        payload.html = payload.html +
          `<p style="font-family:system-ui;font-size:11px;color:#9CA3AF;text-align:center;padding:4px 24px;">` +
          `¿No querés más emails? <a href="${unsubscribeUrl(lead.email)}" style="color:#9CA3AF;">Darme de baja</a></p>`;

        const result = await sendEmail(payload);
        if (result.success) {
          await this.prisma.marketingLead.update({
            where: { id: lead.id },
            data: { nurtureStep: nextStep.step, lastNurturedAt: new Date() },
          });
          sent++;
        } else {
          console.error(`[NURTURE] Error enviando step ${nextStep.step} a ${lead.email}: ${result.error}`);
          // Backoff: marcar lastNurturedAt para no reintentar en la misma hora
          await this.prisma.marketingLead.update({
            where: { id: lead.id }, data: { lastNurturedAt: new Date() },
          }).catch(() => {});
        }
      }
      if (sent > 0) console.log(`[NURTURE] ${sent} emails enviados (${leads.length} leads evaluados)`);
    } catch (e: any) {
      console.error(`[NURTURE] Error en corrida: ${e?.message || e}`);
    } finally {
      this.running = false;
    }
  }
}

export const growthNurtureJob = new GrowthNurtureJob();
