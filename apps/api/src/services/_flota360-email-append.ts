
// ==========================================================================
// FLOTA360 - RECUPERACION DE CONTRASEÑA
// ==========================================================================

export async function sendFlota360PasswordReset(
  to: string,
  name: string,
  token: string,
): Promise<boolean> {
  const resetUrl = `https://logismart.ar/flota360-landing/reset-password?token=${token}`;
  const fromName = 'FLOTA360';

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
      <div style="background: linear-gradient(135deg, #0891b2 0%, #06b6d4 100%); padding: 32px 40px; border-radius: 12px 12px 0 0;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="width: 40px; height: 40px; background: rgba(255,255,255,0.2); border-radius: 10px; display: flex; align-items: center; justify-content: center;">
            <span style="color: white; font-size: 20px;">&#128666;</span>
          </div>
          <div>
            <p style="margin: 0; color: rgba(255,255,255,0.7); font-size: 11px; font-weight: bold; letter-spacing: 2px; text-transform: uppercase;">FLOTA360</p>
            <p style="margin: 0; color: white; font-size: 13px;">Gestion Integral de Flota</p>
          </div>
        </div>
      </div>
      <div style="padding: 40px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        <h2 style="margin: 0 0 8px; color: #083344; font-size: 22px; font-weight: 700;">Recuperacion de Contraseña</h2>
        <p style="color: #6b7280; margin: 0 0 24px; font-size: 14px;">Hola ${name},</p>
        <p style="color: #374151; font-size: 14px; line-height: 1.6;">
          Recibimos una solicitud para restablecer la contraseña de tu cuenta en <strong>FLOTA360</strong>.
        </p>
        <div style="background: #ecfeff; border: 1px solid #a5f3fc; border-radius: 10px; padding: 24px; margin: 24px 0; text-align: center;">
          <p style="margin: 0 0 16px; color: #0e7490; font-size: 13px; font-weight: 600;">Hacé clic para restablecer tu contraseña:</p>
          <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #0891b2, #06b6d4); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px; letter-spacing: 0.3px;">
            Restablecer Contraseña
          </a>
        </div>
        <p style="color: #9ca3af; font-size: 12px; line-height: 1.6;">
          Este enlace expira en <strong>1 hora</strong>.<br>
          Si no solicitaste este cambio, podés ignorar este email. Tu contraseña no sera modificada.
        </p>
        <div style="margin-top: 12px; padding: 12px 16px; background: #fafafa; border-radius: 6px; border: 1px solid #e5e7eb;">
          <p style="margin: 0; font-size: 11px; color: #9ca3af; word-break: break-all;">
            O copiá este enlace en tu navegador:<br>
            <span style="color: #0891b2;">${resetUrl}</span>
          </p>
        </div>
        <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 28px 0 20px;">
        <p style="color: #d1d5db; font-size: 11px; text-align: center; margin: 0;">
          FLOTA360 &mdash; Gestion Integral de Flota | <a href="https://logismart.ar/flota360-landing" style="color: #22d3ee; text-decoration: none;">logismart.ar/flota360-landing</a>
        </p>
      </div>
    </div>
  `;

  const text = `
    FLOTA360 - Recuperacion de Contraseña

    Hola ${name},

    Para restablecer tu contraseña, ingresa al siguiente enlace:
    ${resetUrl}

    Este enlace expira en 1 hora.

    Si no solicitaste este cambio, ignorá este email.
  `;

  return sendEmail({
    from: fromName + ' <' + (process.env.FROM_EMAIL || 'soporte@logismart.ar') + '>',
    to,
    subject: 'Recuperacion de Contraseña - FLOTA360',
    html,
    text,
  });
}

// ==========================================================================
// FLOTA360 - BIENVENIDA / CREDENCIALES DE ACCESO
// ==========================================================================

export async function sendFlota360WelcomeEmail(opts: {
  to: string;
  name: string;
  password: string;
  companyName?: string;
  loginUrl?: string;
}): Promise<boolean> {
  const url = opts.loginUrl || 'https://logismart.ar/flota360-landing/';
  const company = opts.companyName || 'FLOTA360';

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
      <div style="background: linear-gradient(135deg, #0891b2 0%, #06b6d4 100%); padding: 32px 40px; border-radius: 12px 12px 0 0;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="width: 40px; height: 40px; background: rgba(255,255,255,0.2); border-radius: 10px; display: flex; align-items: center; justify-content: center;">
            <span style="color: white; font-size: 20px;">&#128666;</span>
          </div>
          <div>
            <p style="margin: 0; color: rgba(255,255,255,0.7); font-size: 11px; font-weight: bold; letter-spacing: 2px; text-transform: uppercase;">FLOTA360</p>
            <p style="margin: 0; color: white; font-size: 13px;">Gestion Integral de Flota</p>
          </div>
        </div>
      </div>
      <div style="padding: 40px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        <h2 style="margin: 0 0 8px; color: #083344; font-size: 22px; font-weight: 700;">Tu acceso a FLOTA360 esta listo</h2>
        <p style="color: #6b7280; margin: 0 0 24px; font-size: 14px;">Hola <strong>${opts.name}</strong>,</p>
        <p style="color: #374151; font-size: 14px; line-height: 1.6;">
          Tu cuenta en <strong>FLOTA360</strong> para <strong>${company}</strong> fue creada exitosamente. Tus credenciales de acceso son:
        </p>
        <div style="background: #ecfeff; border: 1px solid #a5f3fc; border-radius: 10px; padding: 20px 24px; margin: 24px 0;">
          <p style="margin: 0 0 10px; font-size: 13px; color: #0e7490;"><strong>Email:</strong> ${opts.to}</p>
          <p style="margin: 0; font-size: 13px; color: #0e7490;"><strong>Contraseña:</strong> ${opts.password}</p>
        </div>
        <p style="color: #6b7280; font-size: 13px; line-height: 1.6; margin-bottom: 24px;">
          Te recomendamos cambiar tu contraseña la primera vez que ingreses desde tu perfil.
        </p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${url}" style="display: inline-block; background: linear-gradient(135deg, #0891b2, #06b6d4); color: white; padding: 14px 40px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px; letter-spacing: 0.3px;">
            Ingresar a FLOTA360
          </a>
        </div>
        <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 28px 0 20px;">
        <p style="color: #d1d5db; font-size: 11px; text-align: center; margin: 0;">
          FLOTA360 &mdash; Gestion Integral de Flota | <a href="https://logismart.ar/flota360-landing" style="color: #22d3ee; text-decoration: none;">logismart.ar/flota360-landing</a>
        </p>
      </div>
    </div>
  `;

  return sendEmail({
    from: `FLOTA360 <${process.env.FROM_EMAIL || 'soporte@logismart.ar'}>`,
    to: opts.to,
    subject: `Bienvenido a FLOTA360 - ${company}`,
    html,
  });
}
