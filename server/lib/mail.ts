/** Envío de emails con Resend. Si no hay API key configurada, no hace nada (solo registra). */
export async function sendMail(opts: { to: string; subject: string; html: string; replyTo?: string }) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  if (!key || !from) {
    console.log(`[mail] RESEND_API_KEY/MAIL_FROM sin configurar; no se envió: "${opts.subject}"`);
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [opts.to], subject: opts.subject, html: opts.html, reply_to: opts.replyTo }),
    });
    if (!res.ok) console.error(`[mail] Resend respondió ${res.status}: ${await res.text()}`);
  } catch (err) {
    console.error("[mail] error enviando email", err);
  }
}

export const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export const supportEmail = () => process.env.SUPPORT_EMAIL || "support@peptivasupplies.com";
