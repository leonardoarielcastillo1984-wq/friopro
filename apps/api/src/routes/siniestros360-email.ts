import nodemailer from 'nodemailer';

// ═══════════════════════════════════════════════════════════════════════════
// SINIESTROS360 — Email Notification Service
// ═══════════════════════════════════════════════════════════════════════════

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST) return null;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: { rejectUnauthorized: false },
  });
  return transporter;
}

const FROM = process.env.EMAIL_FROM || 'SINIESTROS360 <noreply@logismart.ar>';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://test.logismart.ar';

function base(title: string, body: string) {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; }
  .container { max-width: 600px; margin: 0 auto; padding: 32px 16px; }
  .card { background: #1e293b; border: 1px solid #334155; border-radius: 16px; overflow: hidden; }
  .header { background: linear-gradient(135deg, #f43f5e, #e11d48); padding: 28px 32px; }
  .header h1 { color: white; font-size: 22px; font-weight: 700; }
  .header p { color: rgba(255,255,255,0.8); font-size: 13px; margin-top: 4px; }
  .body { padding: 28px 32px; }
  .field { margin-bottom: 16px; }
  .field label { display: block; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 4px; }
  .field value { display: block; font-size: 15px; color: #e2e8f0; font-weight: 500; }
  .badge { display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; }
  .badge-red { background: rgba(239,68,68,0.2); color: #f87171; border: 1px solid rgba(239,68,68,0.3); }
  .badge-amber { background: rgba(245,158,11,0.2); color: #fbbf24; border: 1px solid rgba(245,158,11,0.3); }
  .badge-green { background: rgba(34,197,94,0.2); color: #4ade80; border: 1px solid rgba(34,197,94,0.3); }
  .badge-blue { background: rgba(59,130,246,0.2); color: #60a5fa; border: 1px solid rgba(59,130,246,0.3); }
  .btn { display: inline-block; background: #f43f5e; color: white; padding: 12px 24px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 14px; margin-top: 20px; }
  .divider { border: none; border-top: 1px solid #334155; margin: 20px 0; }
  .footer { padding: 16px 32px; background: #0f172a; text-align: center; font-size: 11px; color: #475569; }
</style>
</head>
<body>
<div class="container">
  <div class="card">
    <div class="header">
      <h1>🚨 SINIESTROS360</h1>
      <p>${title}</p>
    </div>
    <div class="body">${body}</div>
    <div class="footer">LOGISMART &copy; ${new Date().getFullYear()} — Sistema de Gestión de Siniestros · Este es un mensaje automático, no responder.</div>
  </div>
</div>
</body></html>`;
}

async function send(to: string | string[], subject: string, html: string) {
  const t = getTransporter();
  if (!t) {
    console.log(`[S360-EMAIL] No SMTP configured. Would send to ${to}: ${subject}`);
    return;
  }
  try {
    await t.sendMail({ from: FROM, to: Array.isArray(to) ? to.join(',') : to, subject, html });
    console.log(`[S360-EMAIL] Sent "${subject}" to ${to}`);
  } catch (err: any) {
    console.error(`[S360-EMAIL] Error sending "${subject}":`, err.message);
  }
}

// ── Notificaciones específicas ────────────────────────────────────────────

export async function notifySiniestroCreado(siniestro: any, creadorEmail: string, recipientEmails: string[]) {
  if (!recipientEmails.length) return;
  const body = `
    <div class="field"><label>Código</label><value>${siniestro.codigo}</value></div>
    <div class="field"><label>Fecha</label><value>${siniestro.fecha ? new Date(siniestro.fecha).toLocaleDateString('es-AR') : 'N/A'}</value></div>
    <div class="field"><label>Descripción</label><value>${siniestro.descripcion || 'Sin descripción'}</value></div>
    <div class="field"><label>Gravedad</label><value><span class="badge ${siniestro.severity === 'CRITICA' ? 'badge-red' : siniestro.severity === 'ALTA' ? 'badge-amber' : 'badge-blue'}">${siniestro.severity}</span></value></div>
    <div class="field"><label>Estado</label><value><span class="badge badge-amber">${siniestro.status}</span></value></div>
    <div class="field"><label>Registrado por</label><value>${creadorEmail}</value></div>
    <hr class="divider">
    <a href="${APP_URL}/siniestros360/siniestros/${siniestro.id}" class="btn">Ver Siniestro</a>
  `;
  await send(recipientEmails, `[S360] Nuevo siniestro registrado: ${siniestro.codigo}`, base(`Nuevo siniestro registrado: ${siniestro.codigo}`, body));
}

export async function notifyCambioEstado(siniestro: any, estadoAnterior: string, estadoNuevo: string, responsableEmail: string, recipientEmails: string[]) {
  if (!recipientEmails.length) return;
  const body = `
    <div class="field"><label>Siniestro</label><value>${siniestro.codigo}</value></div>
    <div class="field"><label>Cambio de estado</label><value>
      <span class="badge badge-amber">${estadoAnterior}</span>
      &nbsp;→&nbsp;
      <span class="badge badge-green">${estadoNuevo}</span>
    </value></div>
    ${siniestro.motivoEstado ? `<div class="field"><label>Motivo</label><value>${siniestro.motivoEstado}</value></div>` : ''}
    <div class="field"><label>Realizado por</label><value>${responsableEmail}</value></div>
    <div class="field"><label>Fecha</label><value>${new Date().toLocaleString('es-AR')}</value></div>
    <hr class="divider">
    <a href="${APP_URL}/siniestros360/siniestros/${siniestro.id}" class="btn">Ver Siniestro</a>
  `;
  await send(recipientEmails, `[S360] Estado actualizado: ${siniestro.codigo} → ${estadoNuevo}`, base(`Estado actualizado: ${siniestro.codigo}`, body));
}

export async function notifyAlertaCritica(alerta: any, tenantAdminEmails: string[]) {
  if (!tenantAdminEmails.length) return;
  const body = `
    <div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:10px;padding:16px;margin-bottom:20px;">
      <p style="color:#f87171;font-weight:700;font-size:16px;">⚠️ Alerta de alta prioridad detectada</p>
    </div>
    <div class="field"><label>Tipo</label><value><span class="badge badge-red">${alerta.tipo}</span></value></div>
    <div class="field"><label>Mensaje</label><value>${alerta.mensaje}</value></div>
    <div class="field"><label>Prioridad</label><value>${alerta.prioridad}</value></div>
    <div class="field"><label>Creada</label><value>${new Date(alerta.createdAt).toLocaleString('es-AR')}</value></div>
    <hr class="divider">
    <a href="${APP_URL}/siniestros360/alertas" class="btn">Ver Alertas</a>
  `;
  await send(tenantAdminEmails, `[S360] ⚠️ Alerta crítica: ${alerta.tipo}`, base(`Alerta crítica detectada`, body));
}

export async function notifyDocumentoSubido(siniestro: any, documento: any, usuarioEmail: string, recipientEmails: string[]) {
  if (!recipientEmails.length) return;
  const body = `
    <div class="field"><label>Siniestro</label><value>${siniestro.codigo}</value></div>
    <div class="field"><label>Documento</label><value>${documento.titulo}</value></div>
    <div class="field"><label>Tipo</label><value>${documento.tipo || 'N/A'}</value></div>
    <div class="field"><label>Subido por</label><value>${usuarioEmail}</value></div>
    <div class="field"><label>Fecha</label><value>${new Date().toLocaleString('es-AR')}</value></div>
    <hr class="divider">
    <a href="${APP_URL}/siniestros360/siniestros/${siniestro.id}" class="btn">Ver Documentos</a>
  `;
  await send(recipientEmails, `[S360] Documento adjuntado: ${siniestro.codigo}`, base(`Nuevo documento en siniestro ${siniestro.codigo}`, body));
}
