
// ==========================================================================
// PROJECT360 - RECUPERACION DE CONTRASEÑA
// ==========================================================================

export async function sendProject360PasswordReset(
  to: string,
  name: string,
  token: string,
): Promise<boolean> {
  const resetUrl = `https://logismart.ar/proyect360-landing/reset-password?token=${token}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
      <div style="background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%); padding: 32px 40px; border-radius: 12px 12px 0 0;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="width: 40px; height: 40px; background: rgba(255,255,255,0.2); border-radius: 10px; display: flex; align-items: center; justify-content: center;">
            <span style="color: white; font-size: 20px;">&#128202;</span>
          </div>
          <div>
            <p style="margin: 0; color: rgba(255,255,255,0.7); font-size: 11px; font-weight: bold; letter-spacing: 2px; text-transform: uppercase;">PROJECT360</p>
            <p style="margin: 0; color: white; font-size: 13px;">Gestion Inteligente de Proyectos</p>
          </div>
        </div>
      </div>
      <div style="padding: 40px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        <h2 style="margin: 0 0 8px; color: #1e1b4b; font-size: 22px; font-weight: 700;">Recuperacion de Contraseña</h2>
        <p style="color: #6b7280; margin: 0 0 24px; font-size: 14px;">Hola ${name},</p>
        <p style="color: #374151; font-size: 14px; line-height: 1.6;">
          Recibimos una solicitud para restablecer la contraseña de tu cuenta en <strong>PROJECT360</strong>.
        </p>
        <div style="background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 10px; padding: 24px; margin: 24px 0; text-align: center;">
          <p style="margin: 0 0 16px; color: #4338ca; font-size: 13px; font-weight: 600;">Hacé clic para restablecer tu contraseña:</p>
          <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #4f46e5, #6366f1); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px;">
            Restablecer Contraseña
          </a>
        </div>
        <p style="color: #9ca3af; font-size: 12px; line-height: 1.6;">
          Este enlace expira en <strong>1 hora</strong>.<br>
          Si no solicitaste este cambio, podés ignorar este email.
        </p>
        <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 28px 0 20px;">
        <p style="color: #d1d5db; font-size: 11px; text-align: center; margin: 0;">
          PROJECT360 &mdash; Gestion Inteligente de Proyectos | <a href="https://logismart.ar/proyect360-landing" style="color: #818cf8; text-decoration: none;">logismart.ar/proyect360-landing</a>
        </p>
      </div>
    </div>
  `;
  const text = `PROJECT360 - Recuperacion de Contraseña\n\nHola ${name},\n\nPara restablecer tu contraseña, ingresa al siguiente enlace:\n${resetUrl}\n\nEste enlace expira en 1 hora.`;
  return sendEmail({
    from: `PROJECT360 <${process.env.FROM_EMAIL || 'soporte@logismart.ar'}>`,
    to,
    subject: 'Recuperacion de Contraseña - PROJECT360',
    html,
    text,
  });
}

// ==========================================================================
// PROJECT360 - BIENVENIDA / CREDENCIALES DE ACCESO
// ==========================================================================

export async function sendProject360WelcomeEmail(opts: {
  to: string;
  name: string;
  password: string;
  companyName?: string;
  loginUrl?: string;
}): Promise<boolean> {
  const url = opts.loginUrl || 'https://logismart.ar/proyect360-landing/';
  const company = opts.companyName || 'PROJECT360';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
      <div style="background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%); padding: 32px 40px; border-radius: 12px 12px 0 0;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="width: 40px; height: 40px; background: rgba(255,255,255,0.2); border-radius: 10px; display: flex; align-items: center; justify-content: center;">
            <span style="color: white; font-size: 20px;">&#128202;</span>
          </div>
          <div>
            <p style="margin: 0; color: rgba(255,255,255,0.7); font-size: 11px; font-weight: bold; letter-spacing: 2px; text-transform: uppercase;">PROJECT360</p>
            <p style="margin: 0; color: white; font-size: 13px;">Gestion Inteligente de Proyectos</p>
          </div>
        </div>
      </div>
      <div style="padding: 40px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        <h2 style="margin: 0 0 8px; color: #1e1b4b; font-size: 22px; font-weight: 700;">Tu acceso a PROJECT360 esta listo</h2>
        <p style="color: #6b7280; margin: 0 0 24px; font-size: 14px;">Hola <strong>${opts.name}</strong>,</p>
        <p style="color: #374151; font-size: 14px; line-height: 1.6;">
          Tu cuenta en <strong>PROJECT360</strong> para <strong>${company}</strong> fue creada exitosamente. Tus credenciales de acceso son:
        </p>
        <div style="background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 10px; padding: 20px 24px; margin: 24px 0;">
          <p style="margin: 0 0 10px; font-size: 13px; color: #4338ca;"><strong>Email:</strong> ${opts.to}</p>
          <p style="margin: 0; font-size: 13px; color: #4338ca;"><strong>Contraseña:</strong> ${opts.password}</p>
        </div>
        <p style="color: #6b7280; font-size: 13px; line-height: 1.6; margin-bottom: 24px;">
          Te recomendamos cambiar tu contraseña la primera vez que ingreses desde tu perfil.
        </p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${url}" style="display: inline-block; background: linear-gradient(135deg, #4f46e5, #6366f1); color: white; padding: 14px 40px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px;">
            Ingresar a PROJECT360
          </a>
        </div>
        <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 28px 0 20px;">
        <p style="color: #d1d5db; font-size: 11px; text-align: center; margin: 0;">
          PROJECT360 &mdash; Gestion Inteligente de Proyectos | <a href="https://logismart.ar/proyect360-landing" style="color: #818cf8; text-decoration: none;">logismart.ar/proyect360-landing</a>
        </p>
      </div>
    </div>
  `;
  return sendEmail({
    from: `PROJECT360 <${process.env.FROM_EMAIL || 'soporte@logismart.ar'}>`,
    to: opts.to,
    subject: `Bienvenido a PROJECT360 - ${company}`,
    html,
  });
}
