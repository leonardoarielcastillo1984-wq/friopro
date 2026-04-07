/**
 * Email Service — Abstraction layer for sending transactional emails.
 *
 * Supported providers:
 *   EMAIL_PROVIDER  — 'console' | 'resend' | 'smtp'
 *   EMAIL_FROM      — Default sender address (e.g. 'SGI 360 <noreply@sgi360.app>')
 *
 * Resend:
 *   RESEND_API_KEY  — API key from https://resend.com
 *
 * SMTP (Nodemailer):
 *   SMTP_HOST       — e.g. 'smtp.gmail.com'
 *   SMTP_PORT       — e.g. '587'
 *   SMTP_USER       — username
 *   SMTP_PASS       — password
 *   SMTP_SECURE     — 'true' for port 465, default false
 */

import { Resend } from 'resend';
import nodemailer from 'nodemailer';

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

const DEFAULT_FROM = process.env.EMAIL_FROM || 'SGI 360 <noreply@sgi360.app>';

// ── Console Transport (development) ──────────────────────────
async function sendViaConsole(payload: EmailPayload): Promise<EmailResult> {
  const border = '═'.repeat(60);
  console.log(`\n╔${border}╗`);
  console.log(`║  📧 EMAIL (dev mode — not actually sent)`);
  console.log(`╠${border}╣`);
  console.log(`║  To:      ${payload.to}`);
  console.log(`║  Subject: ${payload.subject}`);
  console.log(`╠${border}╣`);
  console.log(`║  ${payload.text || '(HTML only)'}`);
  console.log(`╚${border}╝\n`);

  return { success: true, messageId: `console-${Date.now()}` };
}

// ── Resend Transport ─────────────────────────────────────────
let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error('[email] RESEND_API_KEY is required when EMAIL_PROVIDER=resend');
    _resend = new Resend(apiKey);
  }
  return _resend;
}

async function sendViaResend(payload: EmailPayload): Promise<EmailResult> {
  try {
    const resend = getResend();
    const { data, error } = await resend.emails.send({
      from: DEFAULT_FROM,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ── SMTP Transport (Nodemailer) ──────────────────────────────
let _transporter: nodemailer.Transporter | null = null;

function getSmtpTransporter(): nodemailer.Transporter {
  if (!_transporter) {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const secure = process.env.SMTP_SECURE === 'true';
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host) throw new Error('[email] SMTP_HOST is required when EMAIL_PROVIDER=smtp');

    _transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
    });
  }
  return _transporter;
}

async function sendViaSmtp(payload: EmailPayload): Promise<EmailResult> {
  try {
    const transporter = getSmtpTransporter();
    const info = await transporter.sendMail({
      from: DEFAULT_FROM,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    });

    return { success: true, messageId: info.messageId };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ── Public API ───────────────────────────────────────────────
export async function sendEmail(payload: EmailPayload): Promise<EmailResult> {
  const provider = process.env.EMAIL_PROVIDER || 'console';

  switch (provider) {
    case 'console':
      return sendViaConsole(payload);
    case 'resend':
      return sendViaResend(payload);
    case 'smtp':
      return sendViaSmtp(payload);
    default:
      console.warn(`[email] Unknown provider "${provider}", falling back to console`);
      return sendViaConsole(payload);
  }
}

// ── Template helpers ─────────────────────────────────────────

const EMAIL_TEMPLATE_BASE = (content: string) => `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
    <div style="text-align: center; margin-bottom: 32px;">
      <h1 style="color: #111827; font-size: 24px; margin: 0;">SGI 360</h1>
      <p style="color: #6B7280; font-size: 14px; margin-top: 4px;">Sistema de Gestión Integrado</p>
    </div>
    ${content}
    <p style="color: #9CA3AF; font-size: 11px; text-align: center; margin-top: 24px;">
      © ${new Date().getFullYear()} SGI 360. Todos los derechos reservados.
    </p>
  </div>
`;

export function passwordResetEmail(email: string, resetUrl: string): EmailPayload {
  return {
    to: email,
    subject: 'SGI 360 — Restablecer tu contraseña',
    text: [
      `Hola,`,
      ``,
      `Recibimos una solicitud para restablecer tu contraseña en SGI 360.`,
      ``,
      `Hacé clic en el siguiente enlace (válido por 30 minutos):`,
      resetUrl,
      ``,
      `Si no solicitaste este cambio, podés ignorar este mensaje.`,
      ``,
      `— Equipo SGI 360`,
    ].join('\n'),
    html: EMAIL_TEMPLATE_BASE(`
      <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 12px; padding: 32px;">
        <h2 style="color: #111827; font-size: 18px; margin: 0 0 16px;">Restablecer contraseña</h2>
        <p style="color: #4B5563; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
          Recibimos una solicitud para restablecer la contraseña asociada a <strong>${email}</strong>.
        </p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${resetUrl}" style="display: inline-block; background: #4F46E5; color: #FFFFFF; font-weight: 600; font-size: 14px; padding: 12px 32px; border-radius: 8px; text-decoration: none;">
            Restablecer contraseña
          </a>
        </div>
        <p style="color: #9CA3AF; font-size: 12px; line-height: 1.5; margin: 24px 0 0;">
          Este enlace es válido por 30 minutos. Si no solicitaste este cambio, podés ignorar este mensaje de forma segura.
        </p>
      </div>
    `).trim(),
  };
}

// ── Notification Email Templates ──────────────────────────────

export interface NotificationEmailOptions {
  userEmail: string;
  title: string;
  message: string;
  actionLabel?: string;
  actionUrl?: string;
  type?: 'info' | 'warning' | 'error' | 'success';
}

export function notificationEmail(options: NotificationEmailOptions): EmailPayload {
  const bgColor = options.type === 'error' ? '#FEE2E2' : options.type === 'warning' ? '#FEF3C7' : options.type === 'success' ? '#DBEAFE' : '#F3F4F6';
  const borderColor = options.type === 'error' ? '#FCA5A5' : options.type === 'warning' ? '#FCD34D' : options.type === 'success' ? '#93C5FD' : '#D1D5DB';
  const accentColor = options.type === 'error' ? '#DC2626' : options.type === 'warning' ? '#D97706' : options.type === 'success' ? '#2563EB' : '#6B7280';

  const actionHtml = options.actionUrl ? `
    <div style="text-align: center; margin: 24px 0;">
      <a href="${options.actionUrl}" style="display: inline-block; background: ${accentColor}; color: #FFFFFF; font-weight: 600; font-size: 14px; padding: 12px 32px; border-radius: 8px; text-decoration: none;">
        ${options.actionLabel || 'Ver detalle'}
      </a>
    </div>
  ` : '';

  return {
    to: options.userEmail,
    subject: `SGI 360 — ${options.title}`,
    text: [
      options.title,
      '',
      options.message,
      ...(options.actionUrl ? ['', options.actionUrl] : []),
      '',
      '— Equipo SGI 360',
    ].join('\n'),
    html: EMAIL_TEMPLATE_BASE(`
      <div style="background: ${bgColor}; border: 1px solid ${borderColor}; border-radius: 12px; padding: 32px;">
        <h2 style="color: #111827; font-size: 18px; margin: 0 0 16px;">
          ${['error', 'warning'].includes(options.type || '') ? '⚠️' : options.type === 'success' ? '✅' : 'ℹ️'} ${options.title}
        </h2>
        <p style="color: #4B5563; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
          ${options.message}
        </p>
        ${actionHtml}
      </div>
    `).trim(),
  };
}

// Notificación: NCR Asignada
export function ncrAssignedEmail(userEmail: string, ncrCode: string, ncrTitle: string, ncrUrl: string): EmailPayload {
  return notificationEmail({
    userEmail,
    title: 'Nueva No Conformidad Asignada',
    message: `Te ha sido asignada la no conformidad <strong>${ncrCode}: ${ncrTitle}</strong>. Por favor revisa los detalles y toma las acciones correspondientes.`,
    actionLabel: 'Ver NCR',
    actionUrl: ncrUrl,
    type: 'info',
  });
}

// Notificación: Estado de NCR cambió
export function ncrStatusChangedEmail(userEmail: string, ncrCode: string, newStatus: string, ncrUrl: string): EmailPayload {
  return notificationEmail({
    userEmail,
    title: 'Estado de NCR Actualizado',
    message: `La no conformidad <strong>${ncrCode}</strong> ha cambiado a estado <strong>${newStatus}</strong>.`,
    actionLabel: 'Ver cambios',
    actionUrl: ncrUrl,
    type: 'info',
  });
}

// Notificación: NCR Vencida
export function ncrOverdueEmail(userEmail: string, ncrCode: string, ncrTitle: string, ncrUrl: string): EmailPayload {
  return notificationEmail({
    userEmail,
    title: '⏰ No Conformidad Vencida',
    message: `La no conformidad <strong>${ncrCode}: ${ncrTitle}</strong> ha sobrepasado su fecha de vencimiento. Requiere acción inmediata.`,
    actionLabel: 'Ver NCR',
    actionUrl: ncrUrl,
    type: 'error',
  });
}

// Notificación: Riesgo Crítico
export function riskCriticalEmail(userEmail: string, riskCode: string, riskTitle: string, riskUrl: string): EmailPayload {
  return notificationEmail({
    userEmail,
    title: '🚨 Riesgo Crítico Identificado',
    message: `Se ha identificado un riesgo de nivel crítico: <strong>${riskCode}: ${riskTitle}</strong>. Se requiere revisión y mitigación inmediata.`,
    actionLabel: 'Ver riesgo',
    actionUrl: riskUrl,
    type: 'error',
  });
}

// Notificación: Auditoría Completada
export function auditCompletedEmail(userEmail: string, docName: string, normCode: string, findingsCount: number, auditUrl: string): EmailPayload {
  return notificationEmail({
    userEmail,
    title: '✅ Auditoría Completada',
    message: `La auditoría de cumplimiento entre "<strong>${docName}</strong>" y la norma <strong>${normCode}</strong> ha finalizado. Se encontraron <strong>${findingsCount}</strong> hallazgo(s).`,
    actionLabel: 'Ver resultados',
    actionUrl: auditUrl,
    type: 'success',
  });
}

// Notificación: Auditoría Falló
export function auditFailedEmail(userEmail: string, error: string, auditUrl: string): EmailPayload {
  return notificationEmail({
    userEmail,
    title: '❌ Auditoría Falló',
    message: `La auditoría no pudo completarse debido a: <strong>${error}</strong>. Por favor revisa la configuración e intenta nuevamente.`,
    actionLabel: 'Ver detalles',
    actionUrl: auditUrl,
    type: 'error',
  });
}

// Notificación: Nuevo Hallazgo
export function findingNewEmail(userEmail: string, clause: string, findingTitle: string, severity: string, auditUrl: string): EmailPayload {
  const severityIcon = severity === 'MUST' ? '🔴' : '🟠';
  return notificationEmail({
    userEmail,
    title: `${severityIcon} Nuevo Hallazgo: ${clause}`,
    message: `Se ha identificado un nuevo hallazgo ${severity === 'MUST' ? 'crítico' : 'importante'}: <strong>${findingTitle}</strong>. Revisar y tomar acciones correspondientes.`,
    actionLabel: 'Ver hallazgo',
    actionUrl: auditUrl,
    type: severity === 'MUST' ? 'error' : 'warning',
  });
}

// Notificación: Capacitación Programada
export function trainingScheduledEmail(userEmail: string, trainingTitle: string, trainingDate: string, trainingUrl: string): EmailPayload {
  return notificationEmail({
    userEmail,
    title: '📚 Capacitación Programada',
    message: `Te has registrado en la capacitación <strong>${trainingTitle}</strong> programada para <strong>${trainingDate}</strong>. Asegúrate de estar presente.`,
    actionLabel: 'Ver detalles',
    actionUrl: trainingUrl,
    type: 'info',
  });
}

// Notificación: Recordatorio de Capacitación
export function trainingReminderEmail(userEmail: string, trainingTitle: string, trainingDate: string, trainingUrl: string): EmailPayload {
  return notificationEmail({
    userEmail,
    title: '⏰ Recordatorio: Capacitación Próxima',
    message: `Recordatorio: La capacitación <strong>${trainingTitle}</strong> comienza el <strong>${trainingDate}</strong>. Confirma tu asistencia.`,
    actionLabel: 'Confirmar',
    actionUrl: trainingUrl,
    type: 'warning',
  });
}

// Notificación: Miembro Invitado
export function memberInvitedEmail(userEmail: string, tenantName: string, invitedByName: string, acceptUrl: string): EmailPayload {
  return notificationEmail({
    userEmail,
    title: '👋 Invitación a Tenant',
    message: `<strong>${invitedByName}</strong> te ha invitado a unirte al tenant <strong>${tenantName}</strong> en SGI 360.`,
    actionLabel: 'Aceptar invitación',
    actionUrl: acceptUrl,
    type: 'success',
  });
}

// Notificación: Alerta del Sistema
export function systemAlertEmail(userEmail: string, alertMessage: string): EmailPayload {
  return notificationEmail({
    userEmail,
    title: '🔔 Alerta del Sistema',
    message: alertMessage,
    type: 'warning',
  });
}

// ── 2FA Email Templates ──────────────────────────────────────

export function twoFactorEnabledEmail(userEmail: string, userName: string): EmailPayload {
  const contactUrl = process.env.SUPPORT_URL || 'https://support.sgi360.com';
  return {
    to: userEmail,
    subject: '✓ Two-Factor Authentication Enabled - SGI 360',
    text: [
      `Hello ${userName},`,
      ``,
      `Your two-factor authentication (2FA) has been successfully enabled on your SGI 360 account.`,
      ``,
      `From now on, you'll need to provide a code from your authenticator app when logging in.`,
      ``,
      `If you did not enable 2FA, please contact our support team immediately.`,
      `${contactUrl}`,
      ``,
      `— SGI 360 Security Team`,
    ].join('\n'),
    html: EMAIL_TEMPLATE_BASE(`
      <div style="background: #f0f9ff; border: 1px solid #86efac; border-radius: 12px; padding: 32px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="font-size: 48px;">✓</div>
        </div>
        <h2 style="color: #16a34a; font-size: 20px; margin: 0 0 16px; text-align: center;">Two-Factor Authentication Enabled</h2>
        <p style="color: #4B5563; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
          Hello ${userName},
        </p>
        <p style="color: #4B5563; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
          Your two-factor authentication (2FA) has been successfully enabled. Your account is now protected with an additional security layer.
        </p>
        <div style="background: #f0fdf4; border-left: 4px solid #16a34a; padding: 12px; margin: 16px 0; border-radius: 4px;">
          <p style="color: #166534; font-size: 13px; margin: 0; font-weight: 600;">What this means:</p>
          <ul style="color: #166534; font-size: 13px; margin: 8px 0 0; padding-left: 20px;">
            <li>You'll need to provide a code from your authenticator app when logging in</li>
            <li>Only you can access your account with your password and authenticator app</li>
            <li>Your recovery codes should be stored in a safe place</li>
          </ul>
        </div>
        <p style="color: #666; font-size: 12px; margin: 16px 0; font-style: italic;">
          If you did not enable 2FA on your account, please <a href="${contactUrl}" style="color: #2563eb; text-decoration: none;">contact our support team</a> immediately.
        </p>
      </div>
    `).trim(),
  };
}

export function twoFactorDisabledEmail(userEmail: string, userName: string): EmailPayload {
  const contactUrl = process.env.SUPPORT_URL || 'https://support.sgi360.com';
  return {
    to: userEmail,
    subject: '⚠️ Two-Factor Authentication Disabled - SGI 360',
    text: [
      `Hello ${userName},`,
      ``,
      `Your two-factor authentication (2FA) has been disabled on your SGI 360 account.`,
      ``,
      `Your account now relies only on your password for authentication.`,
      `We recommend re-enabling 2FA to protect your account.`,
      ``,
      `If you did not disable 2FA, please contact our support team immediately.`,
      `${contactUrl}`,
      ``,
      `— SGI 360 Security Team`,
    ].join('\n'),
    html: EMAIL_TEMPLATE_BASE(`
      <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 12px; padding: 32px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="font-size: 48px;">⚠️</div>
        </div>
        <h2 style="color: #b45309; font-size: 20px; margin: 0 0 16px; text-align: center;">Two-Factor Authentication Disabled</h2>
        <p style="color: #4B5563; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
          Hello ${userName},
        </p>
        <p style="color: #4B5563; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
          Your two-factor authentication has been disabled. Your account now relies only on your password.
        </p>
        <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px; margin: 16px 0; border-radius: 4px;">
          <p style="color: #92400e; font-size: 13px; margin: 0; font-weight: 600;">Security reminder:</p>
          <p style="color: #92400e; font-size: 13px; margin: 8px 0; padding-left: 0;">We recommend keeping 2FA enabled for better account security. You can re-enable it anytime in your account settings.</p>
        </div>
        <p style="color: #666; font-size: 12px; margin: 16px 0; font-style: italic;">
          If you did not disable 2FA, your account may have been compromised. Please <a href="${contactUrl}" style="color: #2563eb; text-decoration: none;">contact our support team</a> immediately.
        </p>
      </div>
    `).trim(),
  };
}

export function suspiciousLoginEmail(
  userEmail: string,
  userName: string,
  loginTime: string,
  location: string,
  ipAddress: string,
  deviceInfo: string,
  status: string
): EmailPayload {
  const contactUrl = process.env.SUPPORT_URL || 'https://support.sgi360.com';
  return {
    to: userEmail,
    subject: '🔒 Suspicious Login Detected - SGI 360',
    text: [
      `Hello ${userName},`,
      ``,
      `We detected a login attempt on your SGI 360 account from a new device or location.`,
      ``,
      `Time: ${loginTime}`,
      `Location: ${location}`,
      `IP Address: ${ipAddress}`,
      `Device: ${deviceInfo}`,
      `Status: ${status}`,
      ``,
      `If this was you, no action is needed. If not, please change your password immediately.`,
      ``,
      `${contactUrl}`,
      ``,
      `— SGI 360 Security Team`,
    ].join('\n'),
    html: EMAIL_TEMPLATE_BASE(`
      <div style="background: #fee2e2; border: 1px solid #fca5a5; border-radius: 12px; padding: 32px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="font-size: 48px;">🔒</div>
        </div>
        <h2 style="color: #dc2626; font-size: 20px; margin: 0 0 16px; text-align: center;">Suspicious Login Detected</h2>
        <p style="color: #4B5563; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
          We detected a login attempt on your account from an unfamiliar device or location.
        </p>
        <div style="background: #fef2f2; border: 1px solid #fecaca; padding: 12px; margin: 16px 0; border-radius: 4px; font-family: monospace; font-size: 12px;">
          <div style="margin: 4px 0;"><strong>Time:</strong> ${loginTime}</div>
          <div style="margin: 4px 0;"><strong>Location:</strong> ${location}</div>
          <div style="margin: 4px 0;"><strong>IP Address:</strong> ${ipAddress}</div>
          <div style="margin: 4px 0;"><strong>Device:</strong> ${deviceInfo}</div>
          <div style="margin: 4px 0;"><strong>Status:</strong> ${status}</div>
        </div>
        <div style="background: #f0fdf4; border-left: 4px solid #16a34a; padding: 12px; margin: 16px 0; border-radius: 4px;">
          <p style="color: #166534; font-size: 13px; margin: 0; font-weight: 600;">Was this you?</p>
          <p style="color: #166534; font-size: 13px; margin: 8px 0;">If this was you, no action is needed. Your 2FA protection prevented unauthorized access.</p>
        </div>
        <p style="color: #666; font-size: 12px; margin: 16px 0; font-style: italic;">
          If this was NOT you, please change your password immediately and <a href="${contactUrl}" style="color: #2563eb; text-decoration: none;">contact our security team</a>.
        </p>
      </div>
    `).trim(),
  };
}

export function recoveryCodesGeneratedEmail(userEmail: string, userName: string): EmailPayload {
  const contactUrl = process.env.SUPPORT_URL || 'https://support.sgi360.com';
  return {
    to: userEmail,
    subject: '🔐 Recovery Codes Generated - SGI 360',
    text: [
      `Hello ${userName},`,
      ``,
      `New recovery codes have been generated for your SGI 360 account.`,
      ``,
      `Recovery codes are backup codes that allow you to access your account if you lose access to your authenticator app.`,
      `Each code can be used only once.`,
      ``,
      `Please store these codes in a secure location such as a password manager or safe deposit box.`,
      `Never share recovery codes with anyone.`,
      ``,
      `If you did not request new recovery codes, please contact our support team immediately.`,
      `${contactUrl}`,
      ``,
      `— SGI 360 Security Team`,
    ].join('\n'),
    html: EMAIL_TEMPLATE_BASE(`
      <div style="background: #dbeafe; border: 1px solid #93c5fd; border-radius: 12px; padding: 32px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="font-size: 48px;">🔐</div>
        </div>
        <h2 style="color: #1e40af; font-size: 20px; margin: 0 0 16px; text-align: center;">Recovery Codes Generated</h2>
        <p style="color: #4B5563; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
          New recovery codes have been generated for your account.
        </p>
        <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px; margin: 16px 0; border-radius: 4px;">
          <p style="color: #1e3a8a; font-size: 13px; margin: 0; font-weight: 600;">Keep these codes safe:</p>
          <ul style="color: #1e3a8a; font-size: 13px; margin: 8px 0 0; padding-left: 20px;">
            <li>Store them in a secure location (password manager, safe deposit box, etc.)</li>
            <li>Never share recovery codes with anyone</li>
            <li>Don't store them in plain text files or take screenshots</li>
          </ul>
        </div>
        <p style="color: #666; font-size: 12px; margin: 16px 0; font-style: italic;">
          If you did not request new recovery codes, please <a href="${contactUrl}" style="color: #2563eb; text-decoration: none;">contact our support team</a> immediately.
        </p>
      </div>
    `).trim(),
  };
}

export function securityAlertEmail(
  userEmail: string,
  userName: string,
  alertType: string,
  alertDetails: string,
  timestamp: string
): EmailPayload {
  const contactUrl = process.env.SUPPORT_URL || 'https://support.sgi360.com';
  return {
    to: userEmail,
    subject: '🚨 Account Security Alert - SGI 360',
    text: [
      `Hello ${userName},`,
      ``,
      `We detected suspicious activity on your SGI 360 account.`,
      ``,
      `Alert Type: ${alertType}`,
      `Time: ${timestamp}`,
      `Details: ${alertDetails}`,
      ``,
      `If you recognize this activity, no action is needed.`,
      `If you don't recognize this activity, please change your password immediately and contact support.`,
      ``,
      `${contactUrl}`,
      ``,
      `— SGI 360 Security Team`,
    ].join('\n'),
    html: EMAIL_TEMPLATE_BASE(`
      <div style="background: #ffebee; border: 1px solid #fca5a5; border-radius: 12px; padding: 32px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="font-size: 48px;">🚨</div>
        </div>
        <h2 style="color: #d32f2f; font-size: 20px; margin: 0 0 16px; text-align: center;">Account Security Alert</h2>
        <p style="color: #4B5563; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
          We detected suspicious activity on your account that requires your attention.
        </p>
        <div style="background: #fef2f2; border: 1px solid #fecaca; padding: 12px; margin: 16px 0; border-radius: 4px;">
          <div style="margin: 4px 0;"><strong>Alert Type:</strong> ${alertType}</div>
          <div style="margin: 4px 0;"><strong>Time:</strong> ${timestamp}</div>
          <div style="margin: 4px 0;"><strong>Details:</strong> ${alertDetails}</div>
        </div>
        <div style="background: #ffe0b2; border-left: 4px solid #ff9800; padding: 12px; margin: 16px 0; border-radius: 4px;">
          <p style="color: #e65100; font-size: 13px; margin: 0; font-weight: 600;">What you should do:</p>
          <ul style="color: #e65100; font-size: 13px; margin: 8px 0 0; padding-left: 20px;">
            <li>Change your password immediately if you don't recognize the activity</li>
            <li>Review your recent account activity in security settings</li>
            <li>Enable or verify 2FA is enabled on your account</li>
          </ul>
        </div>
        <p style="color: #666; font-size: 12px; margin: 16px 0; font-style: italic;">
          For immediate assistance, please <a href="${contactUrl}" style="color: #2563eb; text-decoration: none;">contact our security team</a>.
        </p>
      </div>
    `).trim(),
  };
}
