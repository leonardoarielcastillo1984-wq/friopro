export type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
};

export async function sendEmail(input: SendEmailInput) {
  const provider = (process.env.EMAIL_PROVIDER ?? "mock").toLowerCase();

  if (provider === "mock") {
    return { ok: true as const };
  }

  if (provider === "resend") {
    const apiKey = process.env.RESEND_API_KEY ?? "";
    const from = process.env.RESEND_FROM ?? "";

    if (!apiKey) {
      return { ok: true as const, warning: "RESEND_API_KEY_MISSING" };
    }

    if (!from) {
      return { ok: true as const, warning: "RESEND_FROM_MISSING" };
    }

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: input.to,
        subject: input.subject,
        text: input.text,
      }),
    });

    if (!r.ok) {
      const detail = await r.text().catch(() => "");
      return {
        ok: false as const,
        error: `RESEND_FAILED_${r.status}${detail ? `_${detail.slice(0, 300)}` : ""}`,
      };
    }

    return { ok: true as const };
  }

  return { ok: false as const, error: `EMAIL_PROVIDER_UNSUPPORTED_${provider}` };
}
