/** Envío de emails con Resend. Si no hay API key configurada, no hace nada (solo registra). */
export const mailConfigured = () => Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);

export async function sendMail(opts: { to: string; subject: string; html: string; replyTo?: string }): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  if (!key || !from) {
    console.log(`[mail] RESEND_API_KEY/MAIL_FROM sin configurar; no se envió: "${opts.subject}"`);
    return false;
  }
  try {
    const res = await fetch(process.env.RESEND_API_URL || "https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [opts.to], subject: opts.subject, html: opts.html, reply_to: opts.replyTo }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      console.error(`[mail] Resend respondió ${res.status}: ${await res.text()}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[mail] error enviando email", err);
    return false;
  }
}

export const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export const supportEmail = () => process.env.SUPPORT_EMAIL || "support@peptivasupplies.com";

/** Plantilla común de los emails (HTML simple compatible con clientes de correo). */
export function emailLayout(opts: { title: string; body: string; cta?: { label: string; url: string }; footer?: string }) {
  return `<!doctype html><html><body style="margin:0;background:#f2f5f9;font-family:Arial,Helvetica,sans-serif;color:#1f2733">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f5f9;padding:24px 12px"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden">
      <tr><td style="background:#0b2742;padding:18px 28px;color:#ffffff;font-size:20px;font-weight:bold">Peptiva <span style="color:#0fb0b3;font-weight:normal">Supplies</span></td></tr>
      <tr><td style="padding:28px">
        <h1 style="margin:0 0 14px;font-size:22px;color:#15426e">${opts.title}</h1>
        <div style="font-size:15px;line-height:1.6;color:#2b3340">${opts.body}</div>
        ${opts.cta ? `<p style="margin:26px 0 6px"><a href="${opts.cta.url}" style="display:inline-block;background:#15426e;color:#ffffff;text-decoration:none;font-weight:bold;padding:13px 26px;border-radius:999px">${opts.cta.label}</a></p>` : ""}
      </td></tr>
      <tr><td style="padding:18px 28px;border-top:1px solid #e2e7ee;font-size:12px;line-height:1.5;color:#5d6675">
        ${opts.footer ?? ""}All products are supplied for laboratory research use only. Questions? Write to ${supportEmail()}.
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
}
