
// ═══════════════════════════════════════════════════════════════════════════
// SINIESTROS360 — Auth emails (bienvenida + recuperación)
// ═══════════════════════════════════════════════════════════════════════════

export async function sendSiniestros360WelcomeEmail(opts: {
  to: string; name: string; password: string; companyName?: string; loginUrl?: string;
}): Promise<boolean> {
  const t = getTransporter();
  if (!t) return false;
  const url = opts.loginUrl || 'https://logismart.ar/siniestros360-landing/';
  const company = opts.companyName || 'SINIESTROS360';
  const body = `
    <div class="field"><label>Hola ${opts.name}</label>
      <value>Tu cuenta en <strong>SINIESTROS360</strong> para <strong>${company}</strong> fue creada exitosamente.</value>
    </div>
    <hr class="divider" />
    <div class="field"><label>Email</label><value>${opts.to}</value></div>
    <div class="field"><label>Contraseña</label><value>${opts.password}</value></div>
    <p style="color:#94a3b8;font-size:13px;margin-top:8px;">Te recomendamos cambiar tu contraseña la primera vez que ingreses.</p>
    <a class="btn" href="${url}">Ingresar a SINIESTROS360</a>
  `;
  try {
    await t.sendMail({
      from: FROM,
      to: opts.to,
      subject: `Bienvenido a SINIESTROS360 - ${company}`,
      html: base('Tu acceso está listo', body),
    });
    return true;
  } catch { return false; }
}

export async function sendSiniestros360PasswordReset(
  to: string, name: string, token: string,
): Promise<boolean> {
  const t = getTransporter();
  if (!t) return false;
  const resetUrl = `https://logismart.ar/siniestros360-landing/reset-password?token=${token}`;
  const body = `
    <div class="field"><label>Hola ${name}</label>
      <value>Recibimos una solicitud para restablecer la contraseña de tu cuenta en <strong>SINIESTROS360</strong>.</value>
    </div>
    <p style="color:#94a3b8;font-size:13px;margin-top:8px;">Este enlace expira en <strong>1 hora</strong>. Si no solicitaste este cambio, ignorá este email.</p>
    <a class="btn" href="${resetUrl}">Restablecer contraseña</a>
    <hr class="divider" />
    <p style="color:#64748b;font-size:11px;word-break:break-all;">O copiá este enlace: ${resetUrl}</p>
  `;
  try {
    await t.sendMail({
      from: FROM,
      to,
      subject: 'Recuperación de contraseña - SINIESTROS360',
      html: base('Recuperación de contraseña', body),
    });
    return true;
  } catch { return false; }
}
