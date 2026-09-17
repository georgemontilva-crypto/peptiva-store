import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "../db";
import { escapeHtml, sendMail, supportEmail } from "./mail";

const money = (v: string) => `$${Number(v).toFixed(2)}`;
export const orderNumber = (id: number) => `PV-${1000 + id}`;

export async function getOrderWithItems(orderId: number) {
  const [order] = await db.select().from(schema.orders).where(eq(schema.orders.id, orderId));
  if (!order) return null;
  const items = await db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, orderId));
  return { ...order, items };
}

/**
 * Marca un pedido como pagado una sola vez (idempotente): solo cambia si sigue en pending/on_hold/failed.
 * Suma el uso del cupón y envía los emails.
 */
export async function markOrderPaid(orderId: number, transactionId: string | null) {
  const result = await db
    .update(schema.orders)
    .set({ status: "paid", paidAt: new Date(), paymentTransactionId: transactionId })
    .where(and(eq(schema.orders.id, orderId), sql`${schema.orders.status} IN ('pending','on_hold','failed','cancelled')`));
  const changed = (result[0] as { affectedRows?: number }).affectedRows ?? 0;
  if (!changed) return false;

  const order = await getOrderWithItems(orderId);
  if (!order) return false;
  if (order.couponCode) {
    await db
      .update(schema.coupons)
      .set({ usageCount: sql`${schema.coupons.usageCount} + 1` })
      .where(eq(schema.coupons.code, order.couponCode));
  }
  await sendOrderEmails(order);
  return true;
}

async function sendOrderEmails(order: NonNullable<Awaited<ReturnType<typeof getOrderWithItems>>>) {
  const rows = order.items
    .map(
      (i) =>
        `<tr><td style="padding:6px 0">${escapeHtml(i.name)}${i.variantLabel ? ` (${escapeHtml(i.variantLabel)})` : ""} × ${i.quantity}</td><td style="padding:6px 0;text-align:right">${money(i.lineTotal)}</td></tr>`,
    )
    .join("");
  const summary = `
    <table style="width:100%;border-collapse:collapse;font-size:14px">${rows}
      ${Number(order.couponDiscount) > 0 ? `<tr><td style="padding:6px 0">Discount (${escapeHtml(order.couponCode ?? "")})</td><td style="text-align:right">−${money(order.couponDiscount)}</td></tr>` : ""}
      <tr><td style="padding:6px 0">Shipping</td><td style="text-align:right">Free</td></tr>
      <tr><td style="padding:10px 0;font-weight:bold;border-top:1px solid #ddd">Total</td><td style="text-align:right;font-weight:bold;border-top:1px solid #ddd">${money(order.total)}</td></tr>
    </table>`;
  const address = `${escapeHtml(order.firstName)} ${escapeHtml(order.lastName)}<br>${escapeHtml(order.address1)}${order.address2 ? `<br>${escapeHtml(order.address2)}` : ""}<br>${escapeHtml(order.city)}, ${escapeHtml(order.state)} ${escapeHtml(order.zip)}`;

  await sendMail({
    to: order.email,
    subject: `Order ${orderNumber(order.id)} confirmed — Peptiva Supplies`,
    html: `<div style="font-family:Arial,sans-serif;color:#2b3340;max-width:560px">
      <h2 style="color:#15426e">Thank you for your order</h2>
      <p>We received your payment for order <strong>${orderNumber(order.id)}</strong>. Orders ship the same or next business day, and you'll get tracking details by email once it's on its way.</p>
      ${summary}
      <p style="margin-top:20px"><strong>Shipping to</strong><br>${address}</p>
      <p style="font-size:12px;color:#5d6675;margin-top:24px">All products are supplied for laboratory research use only. Questions? Reply to this email or write to ${supportEmail()}.</p>
    </div>`,
    replyTo: supportEmail(),
  });

  await sendMail({
    to: process.env.ORDERS_NOTIFY_EMAIL || supportEmail(),
    subject: `New paid order ${orderNumber(order.id)} — ${money(order.total)}`,
    html: `<div style="font-family:Arial,sans-serif">${summary}<p>${address}<br>${escapeHtml(order.email)} · ${escapeHtml(order.phone ?? "")}</p>${order.customerNote ? `<p><strong>Note:</strong> ${escapeHtml(order.customerNote)}</p>` : ""}</div>`,
  });
}
