import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "../db";
import { emailLayout, escapeHtml, sendMail, supportEmail } from "./mail";
import { publicUrl } from "./auth";
import { createCommissionForOrder, syncCommissionWithOrderStatus } from "./affiliates";
import { markCartRecovered } from "./abandoned";
import { CARRIERS, STATUS_LABELS, trackingLink } from "./tracking";

type OrderStatus = (typeof schema.orderStatuses)[number];
const money = (v: string) => `$${Number(v).toFixed(2)}`;
export const orderNumber = (id: number) => `PV-${1000 + id}`;
export const parseOrderNumber = (s: string) => {
  const m = s.trim().toUpperCase().match(/^(?:PV-?)?(\d+)$/);
  return m ? Number(m[1]) - 1000 : null;
};

export async function getOrderWithItems(orderId: number) {
  const [order] = await db.select().from(schema.orders).where(eq(schema.orders.id, orderId));
  if (!order) return null;
  const items = await db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, orderId));
  return { ...order, items };
}

export async function logOrderEvent(orderId: number, status: OrderStatus, note?: string | null, opts: { public?: boolean; by?: string } = {}) {
  await db.insert(schema.orderEvents).values({ orderId, status, note: note ?? null, public: opts.public ?? true, createdBy: opts.by ?? "system" });
}

const trackUrl = (order: { id: number; email: string }) =>
  `${publicUrl()}/track-order?order=${orderNumber(order.id)}&email=${encodeURIComponent(order.email)}`;

/**
 * Marca un pedido como pagado una sola vez (idempotente): solo cambia si sigue en pending/on_hold/failed/cancelled.
 * Suma el uso del cupón, crea la comisión del afiliado, cierra el carrito abandonado y envía los emails.
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
  await logOrderEvent(order.id, "paid", "Payment received");

  if (order.couponCode) {
    await db
      .update(schema.coupons)
      .set({ usageCount: sql`${schema.coupons.usageCount} + 1` })
      .where(eq(schema.coupons.code, order.couponCode));
  }

  try {
    if (order.affiliateId) {
      const [coupon] = order.couponCode
        ? await db.select({ affiliateId: schema.coupons.affiliateId }).from(schema.coupons).where(eq(schema.coupons.code, order.couponCode))
        : [];
      await createCommissionForOrder(order, coupon?.affiliateId === order.affiliateId ? "coupon" : "link");
    }
    await markCartRecovered({ token: order.cartToken, email: order.email, orderId: order.id });
  } catch (err) {
    console.error(`[orders] error en comisión/carrito del pedido ${order.id}`, err);
  }

  await sendOrderEmails(order);
  return true;
}

export type StatusUpdate = {
  status: OrderStatus;
  note?: string | null;
  carrier?: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  notifyCustomer?: boolean;
  by?: string;
};

/** Cambio de estado desde el admin: guarda seguimiento, historial, comisión y avisa al cliente. */
export async function updateOrderStatus(orderId: number, update: StatusUpdate) {
  const order = await getOrderWithItems(orderId);
  if (!order) throw new Error("Order not found");

  if (update.status === "paid" && ["pending", "on_hold", "failed", "cancelled"].includes(order.status)) {
    // Confirmación manual de pago (p. ej. pedido que quedó en revisión)
    await markOrderPaid(orderId, order.paymentTransactionId);
    if (update.note) await logOrderEvent(orderId, "paid", update.note, { by: update.by, public: false });
    return getOrderWithItems(orderId);
  }

  const patch: Partial<typeof schema.orders.$inferInsert> = { status: update.status };
  if (update.carrier !== undefined) patch.carrier = update.carrier || null;
  if (update.trackingNumber !== undefined) patch.trackingNumber = update.trackingNumber?.trim() || null;
  if (update.trackingUrl !== undefined) patch.trackingUrl = update.trackingUrl?.trim() || null;
  if (update.status === "shipped" && !order.shippedAt) patch.shippedAt = new Date();
  if (update.status === "completed") {
    patch.completedAt = new Date();
    if (!order.shippedAt) patch.shippedAt = new Date();
  }
  await db.update(schema.orders).set(patch).where(eq(schema.orders.id, orderId));

  const statusChanged = update.status !== order.status;
  const trackingChanged =
    (update.trackingNumber !== undefined && (update.trackingNumber?.trim() || null) !== order.trackingNumber) ||
    (update.carrier !== undefined && (update.carrier || null) !== order.carrier);
  if (statusChanged || update.note || trackingChanged) {
    await logOrderEvent(orderId, update.status, update.note ?? (trackingChanged && !statusChanged ? "Tracking updated" : null), { by: update.by });
  }
  if (statusChanged) await syncCommissionWithOrderStatus(orderId, update.status);

  const fresh = (await getOrderWithItems(orderId))!;
  if (update.notifyCustomer && (statusChanged || trackingChanged)) await sendStatusEmail(fresh, update.note);
  return fresh;
}

function itemsTable(order: NonNullable<Awaited<ReturnType<typeof getOrderWithItems>>>) {
  const rows = order.items
    .map(
      (i) =>
        `<tr><td style="padding:6px 0">${escapeHtml(i.name)}${i.variantLabel ? ` (${escapeHtml(i.variantLabel)})` : ""} × ${i.quantity}</td><td style="padding:6px 0;text-align:right">${money(i.lineTotal)}</td></tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" style="border-collapse:collapse;font-size:14px">${rows}
    ${Number(order.couponDiscount) > 0 ? `<tr><td style="padding:6px 0">Discount (${escapeHtml(order.couponCode ?? "")})</td><td style="text-align:right">−${money(order.couponDiscount)}</td></tr>` : ""}
    <tr><td style="padding:6px 0">Shipping</td><td style="text-align:right">Free</td></tr>
    <tr><td style="padding:10px 0;font-weight:bold;border-top:1px solid #e2e7ee">Total</td><td style="text-align:right;font-weight:bold;border-top:1px solid #e2e7ee">${money(order.total)}</td></tr>
  </table>`;
}

const addressHtml = (o: typeof schema.orders.$inferSelect) =>
  `${escapeHtml(o.firstName)} ${escapeHtml(o.lastName)}<br>${escapeHtml(o.address1)}${o.address2 ? `<br>${escapeHtml(o.address2)}` : ""}<br>${escapeHtml(o.city)}, ${escapeHtml(o.state)} ${escapeHtml(o.zip)}`;

async function sendOrderEmails(order: NonNullable<Awaited<ReturnType<typeof getOrderWithItems>>>) {
  await sendMail({
    to: order.email,
    subject: `Order ${orderNumber(order.id)} confirmed — Peptiva Supplies`,
    html: emailLayout({
      title: "Thank you for your order",
      body: `<p>We received your payment for order <strong>${orderNumber(order.id)}</strong>. Orders ship the same or next business day, and we'll email you the tracking number once it's on its way.</p>
        ${itemsTable(order)}<p style="margin-top:18px"><strong>Shipping to</strong><br>${addressHtml(order)}</p>`,
      cta: { label: "Track my order", url: trackUrl(order) },
    }),
    replyTo: supportEmail(),
  });

  await sendMail({
    to: process.env.ORDERS_NOTIFY_EMAIL || supportEmail(),
    subject: `New paid order ${orderNumber(order.id)} — ${money(order.total)}`,
    html: emailLayout({
      title: `New order ${orderNumber(order.id)}`,
      body: `${itemsTable(order)}<p>${addressHtml(order)}<br>${escapeHtml(order.email)} · ${escapeHtml(order.phone ?? "")}</p>${order.customerNote ? `<p><strong>Note:</strong> ${escapeHtml(order.customerNote)}</p>` : ""}`,
      cta: { label: "Open in admin", url: `${publicUrl()}/admin/orders/${order.id}` },
    }),
  });
}

async function sendStatusEmail(order: NonNullable<Awaited<ReturnType<typeof getOrderWithItems>>>, note?: string | null) {
  const link = trackingLink(order.carrier, order.trackingNumber, order.trackingUrl);
  const carrier = order.carrier ? CARRIERS[order.carrier as keyof typeof CARRIERS]?.label ?? order.carrier : null;
  const titles: Partial<Record<OrderStatus, string>> = {
    shipped: "Your order is on its way",
    completed: "Your order was delivered",
    cancelled: "Your order was cancelled",
    refunded: "Your refund was issued",
  };
  const trackingBlock =
    order.trackingNumber
      ? `<p style="background:#eaf6f7;border-radius:12px;padding:12px 14px">${carrier ? `${escapeHtml(carrier)} tracking: ` : "Tracking: "}<strong>${escapeHtml(order.trackingNumber)}</strong>${link ? `<br><a href="${link}" style="color:#15426e">Track with the carrier</a>` : ""}</p>`
      : "";
  await sendMail({
    to: order.email,
    subject: `${titles[order.status] ?? `Order update: ${STATUS_LABELS[order.status]}`} — ${orderNumber(order.id)}`,
    html: emailLayout({
      title: titles[order.status] ?? `Order ${orderNumber(order.id)}: ${STATUS_LABELS[order.status]}`,
      body: `<p>Order <strong>${orderNumber(order.id)}</strong> is now <strong>${STATUS_LABELS[order.status]}</strong>.</p>${note ? `<p>${escapeHtml(note)}</p>` : ""}${trackingBlock}`,
      cta: { label: "View order status", url: trackUrl(order) },
    }),
    replyTo: supportEmail(),
  });
}
