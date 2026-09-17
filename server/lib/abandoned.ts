import { and, eq, gt, sql } from "drizzle-orm";
import { db, schema } from "../db";
import { quoteCart, type CartLineInput } from "./pricing";
import { getSettings } from "./settings";
import { emailLayout, escapeHtml, mailConfigured, sendMail } from "./mail";
import { publicUrl } from "./auth";

/** Guarda o actualiza el carrito de alguien que dejó su email en el checkout. */
export async function saveAbandonedCart(input: {
  token: string;
  email: string;
  firstName?: string | null;
  lines: CartLineInput[];
  couponCode?: string | null;
  affiliateCode?: string | null;
}) {
  const quote = await quoteCart(input.lines, null);
  const values = {
    email: input.email.trim().toLowerCase(),
    firstName: input.firstName?.trim() || null,
    lines: input.lines,
    couponCode: input.couponCode?.trim().toLowerCase() || null,
    affiliateCode: input.affiliateCode || null,
    subtotal: quote.subtotal,
    updatedAt: new Date(),
  };
  const [existing] = await db.select().from(schema.abandonedCarts).where(eq(schema.abandonedCarts.token, input.token));
  if (!existing) {
    await db.insert(schema.abandonedCarts).values({ token: input.token, ...values });
  } else if (existing.status === "open") {
    // Si cambió el contenido, se reinicia la secuencia de emails
    const changed = JSON.stringify(existing.lines) !== JSON.stringify(input.lines) || existing.email !== values.email;
    await db
      .update(schema.abandonedCarts)
      .set({ ...values, ...(changed ? { emailsSent: 0, lastEmailAt: null } : {}) })
      .where(eq(schema.abandonedCarts.id, existing.id));
  }
}

export async function markCartRecovered(opts: { token?: string | null; email: string; orderId: number }) {
  const where = opts.token
    ? eq(schema.abandonedCarts.token, opts.token)
    : and(eq(schema.abandonedCarts.email, opts.email.toLowerCase()), eq(schema.abandonedCarts.status, "open"));
  await db
    .update(schema.abandonedCarts)
    .set({ status: "recovered", recoveredOrderId: opts.orderId })
    .where(and(where, sql`${schema.abandonedCarts.status} <> 'unsubscribed'`));
}

const money = (v: string | number) => `$${Number(v).toFixed(2)}`;

async function sendReminder(cart: typeof schema.abandonedCarts.$inferSelect, step: 1 | 2) {
  const settings = await getSettings();
  const quote = await quoteCart(cart.lines, null);
  if (!quote.lines.length) return false;
  const base = publicUrl();
  const recover = `${base}/cart/recover/${cart.token}`;
  const unsubscribe = `${base}/cart/unsubscribe/${cart.token}`;
  const coupon = step === 2 && settings.abandonedCouponCode ? settings.abandonedCouponCode : null;
  const rows = quote.lines
    .map(
      (l) => `<tr>
        <td style="padding:8px 0;width:64px">${l.imageUrl ? `<img src="${l.imageUrl.startsWith("/") ? base + l.imageUrl : l.imageUrl}" width="56" height="56" style="border-radius:10px;object-fit:cover;display:block" alt="">` : ""}</td>
        <td style="padding:8px 10px">${escapeHtml(l.name)}${l.variantLabel ? `, ${escapeHtml(l.variantLabel)}` : ""} × ${l.quantity}</td>
        <td style="padding:8px 0;text-align:right;white-space:nowrap">${money(l.lineTotal)}</td></tr>`,
    )
    .join("");
  const name = cart.firstName ? `, ${escapeHtml(cart.firstName)}` : "";
  return sendMail({
    to: cart.email,
    subject: step === 1 ? "You left something in your cart" : coupon ? "Your cart is still waiting — here's a code" : "Your cart is still waiting",
    html: emailLayout({
      title: step === 1 ? `Still need these${name}?` : `Your cart is saved${name}`,
      body: `<p>${step === 1 ? "We saved the items from your last visit so you can finish your order in one click." : "Your research compounds are still in your cart. Stock on some items moves quickly."}</p>
        <table role="presentation" width="100%" style="border-collapse:collapse;font-size:14px;margin:14px 0">${rows}</table>
        ${coupon ? `<p style="background:#eaf6f7;border-radius:12px;padding:12px 14px">Use code <strong>${escapeHtml(coupon.toUpperCase())}</strong> at checkout.</p>` : ""}
        <p>Free U.S. shipping and a certificate of analysis for every product.</p>`,
      cta: { label: "Return to my cart", url: coupon ? `${recover}?coupon=${encodeURIComponent(coupon)}` : recover },
      footer: `You're receiving this because you started a checkout at Peptiva Supplies. <a href="${unsubscribe}" style="color:#5d6675">Don't send cart reminders</a>.<br>`,
    }),
  });
}

let running = false;

/** Tarea periódica: envía el 1.er y 2.º recordatorio a carritos abandonados. */
export async function runAbandonedCartJob() {
  if (running) return { skipped: "running" };
  const settings = await getSettings();
  if (!settings.abandonedEnabled) return { skipped: "disabled" };
  if (!mailConfigured()) return { skipped: "mail_not_configured" };
  running = true;
  let sent = 0;
  try {
    const now = Date.now();
    const firstBefore = new Date(now - settings.abandonedFirstDelayMinutes * 60_000);
    const secondBefore = new Date(now - settings.abandonedSecondDelayHours * 3_600_000);
    const due = await db
      .select()
      .from(schema.abandonedCarts)
      .where(
        and(
          eq(schema.abandonedCarts.status, "open"),
          gt(schema.abandonedCarts.updatedAt, new Date(now - 7 * 86_400_000)),
          sql`((${schema.abandonedCarts.emailsSent} = 0 AND ${schema.abandonedCarts.updatedAt} < ${firstBefore})
            OR (${schema.abandonedCarts.emailsSent} = 1 AND ${schema.abandonedCarts.lastEmailAt} < ${secondBefore}))`,
        ),
      )
      .limit(50);

    for (const cart of due) {
      // ¿Compró después de dejar el carrito? Entonces no se le escribe
      const [order] = await db
        .select({ id: schema.orders.id })
        .from(schema.orders)
        .where(
          and(
            eq(schema.orders.email, cart.email),
            gt(schema.orders.createdAt, new Date(cart.createdAt.getTime() - 60_000)),
            sql`${schema.orders.status} IN ('paid','on_hold','shipped','completed')`,
          ),
        )
        .limit(1);
      if (order) {
        await markCartRecovered({ token: cart.token, email: cart.email, orderId: order.id });
        continue;
      }
      const step = cart.emailsSent === 0 ? 1 : 2;
      if (await sendReminder(cart, step)) {
        await db
          .update(schema.abandonedCarts)
          .set({ emailsSent: step, lastEmailAt: new Date(), updatedAt: cart.updatedAt })
          .where(eq(schema.abandonedCarts.id, cart.id));
        sent++;
      }
    }
  } finally {
    running = false;
  }
  if (sent) console.log(`[abandoned] ${sent} recordatorios enviados`);
  return { sent };
}

/** Envío manual desde el admin (ignora los tiempos de espera, respeta el máximo de 2). */
export async function sendReminderNow(cartId: number) {
  const [cart] = await db.select().from(schema.abandonedCarts).where(eq(schema.abandonedCarts.id, cartId));
  if (!cart || cart.status !== "open") throw new Error("This cart is not open.");
  if (cart.emailsSent >= 2) throw new Error("Both reminders were already sent.");
  if (!mailConfigured()) throw new Error("Email is not configured (RESEND_API_KEY and MAIL_FROM).");
  const step = cart.emailsSent === 0 ? 1 : 2;
  const ok = await sendReminder(cart, step);
  if (!ok) throw new Error("The email could not be sent. Check the server logs.");
  await db
    .update(schema.abandonedCarts)
    .set({ emailsSent: step, lastEmailAt: new Date(), updatedAt: cart.updatedAt })
    .where(eq(schema.abandonedCarts.id, cart.id));
  return step;
}

