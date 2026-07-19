/**
 * Plantillas de email del módulo de Ausencias.
 * Devuelven un EmailPayload listo para encolar con queueEmail().
 */
import type { EmailPayload } from './email.js';

const APP_URL = process.env.APP_URL || 'https://app.logismart.ar';

function shell(title: string, bodyHtml: string, cta?: { label: string; href: string }): string {
  return `<!doctype html><html><body style="margin:0;background:#f3f4f6;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:24px;">
    <div style="background:#4f46e5;border-radius:12px 12px 0 0;padding:20px 24px;color:#fff;">
      <div style="font-size:18px;font-weight:700;">SGI 360</div>
      <div style="font-size:13px;opacity:.85;">Gestión de Ausencias</div>
    </div>
    <div style="background:#fff;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 12px 12px;padding:24px;color:#374151;">
      <h1 style="font-size:18px;margin:0 0 12px;color:#111827;">${title}</h1>
      ${bodyHtml}
      ${cta ? `<div style="margin-top:20px;"><a href="${cta.href}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:600;">${cta.label}</a></div>` : ''}
      <p style="margin-top:24px;font-size:12px;color:#9ca3af;">Este es un mensaje automático de SGI 360. No respondas a este correo.</p>
    </div>
  </div></body></html>`;
}

function fmt(d: string | Date): string {
  const dt = typeof d === 'string' ? new Date(d) : d;
  return dt.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
}

interface RequestInfo {
  employeeName: string;
  typeName: string;
  startDate: string | Date;
  endDate: string | Date;
  days: number;
  reason?: string | null;
}

/** Para el/los aprobador(es): nueva solicitud pendiente. */
export function absenceSubmittedEmail(to: string, r: RequestInfo): EmailPayload {
  const body = `
    <p style="margin:0 0 8px;"><b>${r.employeeName}</b> registró una solicitud de ausencia que requiere tu aprobación.</p>
    <table style="width:100%;font-size:14px;border-collapse:collapse;margin-top:8px;">
      <tr><td style="padding:4px 0;color:#6b7280;">Tipo</td><td style="padding:4px 0;text-align:right;">${r.typeName}</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280;">Período</td><td style="padding:4px 0;text-align:right;">${fmt(r.startDate)} → ${fmt(r.endDate)}</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280;">Días</td><td style="padding:4px 0;text-align:right;">${r.days}</td></tr>
      ${r.reason ? `<tr><td style="padding:4px 0;color:#6b7280;">Motivo</td><td style="padding:4px 0;text-align:right;">${r.reason}</td></tr>` : ''}
    </table>`;
  return {
    to,
    subject: `Nueva solicitud de ausencia — ${r.employeeName}`,
    html: shell('Nueva solicitud pendiente de aprobación', body, { label: 'Revisar solicitud', href: `${APP_URL}/rrhh/ausencias?tab=solicitudes` }),
    text: `${r.employeeName} registró una ausencia (${r.typeName}) del ${fmt(r.startDate)} al ${fmt(r.endDate)}, ${r.days} día(s). Revisá en ${APP_URL}/rrhh/ausencias`,
  };
}

/** Para el empleado: aprobada. */
export function absenceApprovedEmail(to: string, r: RequestInfo): EmailPayload {
  const body = `
    <p style="margin:0 0 8px;">Tu solicitud de ausencia fue <b style="color:#059669;">aprobada</b>.</p>
    <table style="width:100%;font-size:14px;border-collapse:collapse;margin-top:8px;">
      <tr><td style="padding:4px 0;color:#6b7280;">Tipo</td><td style="padding:4px 0;text-align:right;">${r.typeName}</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280;">Período</td><td style="padding:4px 0;text-align:right;">${fmt(r.startDate)} → ${fmt(r.endDate)}</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280;">Días</td><td style="padding:4px 0;text-align:right;">${r.days}</td></tr>
    </table>`;
  return {
    to,
    subject: `Ausencia aprobada — ${r.typeName}`,
    html: shell('Solicitud aprobada', body, { label: 'Ver mis solicitudes', href: `${APP_URL}/rrhh/ausencias?tab=mis-solicitudes` }),
    text: `Tu ausencia (${r.typeName}) del ${fmt(r.startDate)} al ${fmt(r.endDate)} fue aprobada.`,
  };
}

/** Para el empleado: rechazada. */
export function absenceRejectedEmail(to: string, r: RequestInfo, comment?: string | null): EmailPayload {
  const body = `
    <p style="margin:0 0 8px;">Tu solicitud de ausencia fue <b style="color:#dc2626;">rechazada</b>.</p>
    <table style="width:100%;font-size:14px;border-collapse:collapse;margin-top:8px;">
      <tr><td style="padding:4px 0;color:#6b7280;">Tipo</td><td style="padding:4px 0;text-align:right;">${r.typeName}</td></tr>
      <tr><td style="padding:4px 0;color:#6b7280;">Período</td><td style="padding:4px 0;text-align:right;">${fmt(r.startDate)} → ${fmt(r.endDate)}</td></tr>
    </table>
    ${comment ? `<p style="margin-top:12px;padding:10px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;font-size:13px;"><b>Motivo:</b> ${comment}</p>` : ''}`;
  return {
    to,
    subject: `Ausencia rechazada — ${r.typeName}`,
    html: shell('Solicitud rechazada', body, { label: 'Ver mis solicitudes', href: `${APP_URL}/rrhh/ausencias?tab=mis-solicitudes` }),
    text: `Tu ausencia (${r.typeName}) del ${fmt(r.startDate)} al ${fmt(r.endDate)} fue rechazada.${comment ? ' Motivo: ' + comment : ''}`,
  };
}

/** Recordatorio a aprobadores: solicitudes pendientes hace días. */
export function absencePendingReminderEmail(to: string, count: number): EmailPayload {
  const body = `<p style="margin:0 0 8px;">Tenés <b>${count}</b> solicitud(es) de ausencia esperando aprobación. Revisalas para no demorar al equipo.</p>`;
  return {
    to,
    subject: `Tenés ${count} solicitud(es) de ausencia pendientes`,
    html: shell('Solicitudes pendientes de aprobación', body, { label: 'Revisar pendientes', href: `${APP_URL}/rrhh/ausencias?tab=solicitudes` }),
    text: `Tenés ${count} solicitud(es) de ausencia pendientes de aprobación. Revisá en ${APP_URL}/rrhh/ausencias`,
  };
}
