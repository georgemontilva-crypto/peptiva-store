import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { db, schema } from "../db";
import { getSettings } from "./settings";
import { emailLayout, escapeHtml, sendMail } from "./mail";
import { publicUrl, randomToken, sha256 } from "./auth";

export const normalizeCode = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40);

/** Genera un código único a partir del nombre: "Ana Lopez" → "analopez", "analopez2"… */
export async function uniqueAffiliateCode(base: string) {
  const root = normalizeCode(base.replace(/\s+/g, "")) || "partner";
  for (let i = 0; i < 50; i++) {
    const code = i === 0 ? root : `${root}${i + 1}`;
    const [exists] = await db.select({ id: schema.affiliates.id }).from(schema.affiliates).where(eq(schema.affiliates.code, code));
    if (!exists) return code;
  }
  return `${root}${Date.now().toString(36)}`;
}

export async function findActiveAffiliateByCode(code: string | null | undefined) {
  if (!code) return null;
  const [a] = await db
    .select()
    .from(schema.affiliates)
    .where(and(eq(schema.affiliates.code, normalizeCode(code)), eq(schema.affiliates.status, "active")));
  return a ?? null;
}

/**
 * Decide a qué afiliado pertenece una venta. El cupón de un afiliado tiene prioridad sobre el enlace.
 * No se permite la auto-referencia (el afiliado comprando con su propio email).
 */
export async function resolveAttribution(opts: { affiliateCode?: string | null; couponAffiliateId?: number | null; email: string }) {
  const email = opts.email.trim().toLowerCase();
  if (opts.couponAffiliateId) {
    const [a] = await db
      .select()
      .from(schema.affiliates)
      .where(and(eq(schema.affiliates.id, opts.couponAffiliateId), eq(schema.affiliates.status, "active")));
    if (a && a.email.toLowerCase() !== email) return { affiliateId: a.id, source: "coupon" as const };
  }
  const a = await findActiveAffiliateByCode(opts.affiliateCode);
  if (a && a.email.toLowerCase() !== email) return { affiliateId: a.id, source: "link" as const };
  return null;
}

/** Crea la comisión cuando el pedido se paga (una por pedido). */
export async function createCommissionForOrder(order: typeof schema.orders.$inferSelect, source: "link" | "coupon") {
  if (!order.affiliateId) return;
  const [affiliate] = await db.select().from(schema.affiliates).where(eq(schema.affiliates.id, order.affiliateId));
  if (!affiliate || affiliate.status !== "active") return;
  const settings = await getSettings();
  const rate = Number(affiliate.commissionRate ?? settings.commissionRate);
  const base = Math.max(0, Number(order.total) - Number(order.shippingTotal));
  const amount = Math.round(base * rate) / 100;
  await db
    .insert(schema.commissions)
    .values({ affiliateId: affiliate.id, orderId: order.id, base: base.toFixed(2), rate: rate.toFixed(2), amount: amount.toFixed(2), source })
    .onDuplicateKeyUpdate({ set: { affiliateId: affiliate.id } });
}

/** Ajusta la comisión cuando cambia el estado del pedido. */
export async function syncCommissionWithOrderStatus(orderId: number, status: string) {
  const [c] = await db.select().from(schema.commissions).where(eq(schema.commissions.orderId, orderId));
  if (!c || c.status === "paid") return;
  if (status === "completed" && c.status === "pending") {
    const settings = await getSettings();
    if (settings.autoApproveOnComplete) {
      await db.update(schema.commissions).set({ status: "approved", approvedAt: new Date() }).where(eq(schema.commissions.id, c.id));
    }
  }
  if (status === "refunded" || status === "cancelled") {
    await db.update(schema.commissions).set({ status: "rejected" }).where(eq(schema.commissions.id, c.id));
  }
}

/** Crea un enlace de un solo uso (7 días) para crear o recuperar la contraseña. */
export async function createPasswordLink(affiliateId: number) {
  const token = randomToken();
  await db.insert(schema.affiliateTokens).values({ affiliateId, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 7 * 86_400_000) });
  return `${publicUrl()}/affiliate-account/set-password?token=${token}`;
}

export async function consumePasswordToken(token: string) {
  const [row] = await db
    .select()
    .from(schema.affiliateTokens)
    .where(and(eq(schema.affiliateTokens.tokenHash, sha256(token)), isNull(schema.affiliateTokens.usedAt), gt(schema.affiliateTokens.expiresAt, new Date())));
  if (!row) return null;
  await db.update(schema.affiliateTokens).set({ usedAt: new Date() }).where(eq(schema.affiliateTokens.id, row.id));
  return row.affiliateId;
}

export async function sendApprovalEmail(affiliate: typeof schema.affiliates.$inferSelect) {
  const link = await createPasswordLink(affiliate.id);
  const settings = await getSettings();
  return sendMail({
    to: affiliate.email,
    subject: "You're approved — welcome to the Peptiva affiliate program",
    html: emailLayout({
      title: `Welcome aboard, ${escapeHtml(affiliate.name.split(" ")[0] ?? affiliate.name)}`,
      body: `<p>Your affiliate application was approved. You earn <strong>${affiliate.commissionRate ?? settings.commissionRate}%</strong> on qualifying sales, tracked for ${settings.cookieDays} days after each click.</p>
        <p>Your referral link:<br><a href="${publicUrl()}/?ref=${affiliate.code}" style="color:#15426e">${publicUrl()}/?ref=${affiliate.code}</a></p>
        <p>Create your password to open your dashboard with clicks, orders and commissions. This link expires in 7 days.</p>`,
      cta: { label: "Create my password", url: link },
    }),
  });
}

export async function sendResetEmail(affiliate: typeof schema.affiliates.$inferSelect) {
  const link = await createPasswordLink(affiliate.id);
  return sendMail({
    to: affiliate.email,
    subject: "Reset your Peptiva affiliate password",
    html: emailLayout({
      title: "Reset your password",
      body: "<p>We received a request to reset the password of your affiliate account. If it wasn't you, ignore this email.</p><p>The link expires in 7 days.</p>",
      cta: { label: "Choose a new password", url: link },
    }),
  });
}

/** Totales del afiliado para su panel y el admin. */
export async function affiliateTotals(affiliateId: number) {
  const [visits] = await db
    .select({ n: sql<number>`COUNT(*)` })
    .from(schema.affiliateVisits)
    .where(eq(schema.affiliateVisits.affiliateId, affiliateId));
  const rows = await db
    .select({ status: schema.commissions.status, n: sql<number>`COUNT(*)`, amount: sql<string>`COALESCE(SUM(${schema.commissions.amount}),0)` })
    .from(schema.commissions)
    .where(eq(schema.commissions.affiliateId, affiliateId))
    .groupBy(schema.commissions.status);
  const by = (s: string) => rows.find((r) => r.status === s);
  const [paidOut] = await db
    .select({ amount: sql<string>`COALESCE(SUM(${schema.payouts.amount}),0)` })
    .from(schema.payouts)
    .where(eq(schema.payouts.affiliateId, affiliateId));
  const orders = rows.filter((r) => r.status !== "rejected").reduce((s, r) => s + Number(r.n), 0);
  const clicks = Number(visits?.n ?? 0);
  return {
    clicks,
    orders,
    conversionRate: clicks ? Math.round((orders / clicks) * 1000) / 10 : 0,
    pending: Number(by("pending")?.amount ?? 0),
    approved: Number(by("approved")?.amount ?? 0),
    paid: Number(by("paid")?.amount ?? 0),
    paidOut: Number(paidOut?.amount ?? 0),
  };
}
