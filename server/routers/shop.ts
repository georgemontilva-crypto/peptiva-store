import crypto from "node:crypto";
import { z } from "zod";
import { and, asc, eq, gt } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { db, schema } from "../db";
import { externalProcedure, publicProcedure, rateLimit, router } from "../trpc";
import { quoteCart } from "../lib/pricing";
import { bankfulConfigured, createHostedPayment } from "../lib/bankful";
import { getOrderWithItems, logOrderEvent, orderNumber, parseOrderNumber } from "../lib/orders";
import { findActiveAffiliateByCode, resolveAttribution } from "../lib/affiliates";
import { saveAbandonedCart } from "../lib/abandoned";
import { getSettings } from "../lib/settings";
import { CARRIERS, STATUS_LABELS, trackingLink } from "../lib/tracking";
import { sha256 } from "../lib/auth";

const cartLines = z
  .array(z.object({ productId: z.number().int().positive(), variantId: z.number().int().positive().nullable(), quantity: z.number().int().min(1).max(99) }))
  .max(50);

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS",
  "MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
] as const;

const checkoutInput = z.object({
  lines: cartLines.min(1),
  couponCode: z.string().max(64).optional().nullable(),
  email: z.email().max(191),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  phone: z.string().trim().min(7).max(32),
  address1: z.string().trim().min(3).max(200),
  address2: z.string().trim().max(200).optional().nullable(),
  city: z.string().trim().min(2).max(100),
  state: z.enum(US_STATES),
  zip: z.string().trim().regex(/^\d{5}(-\d{4})?$/, "Enter a valid ZIP code"),
  customerNote: z.string().trim().max(1000).optional().nullable(),
  researchAcknowledged: z.literal(true),
  cartToken: z.string().min(16).max(64).optional().nullable(),
  affiliateCode: z.string().max(64).optional().nullable(),
});

export const shopRouter = router({
  quote: publicProcedure
    .input(z.object({ lines: cartLines, couponCode: z.string().max(64).optional().nullable() }))
    .query(({ input }) => quoteCart(input.lines, input.couponCode)),

  paymentsEnabled: publicProcedure.query(() => bankfulConfigured()),

  /** Datos públicos de la tienda para la ficha (hora de corte de envío). */
  storeInfo: publicProcedure.query(async () => {
    const s = await getSettings();
    return { shippingCutoffHour: s.shippingCutoffHour };
  }),

  placeOrder: externalProcedure.input(checkoutInput).mutation(async ({ input, ctx }) => {
    rateLimit(`order:${ctx.ip}`, 8, 10 * 60_000);
    if (!bankfulConfigured()) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Card payments are temporarily unavailable. Please contact support." });
    }

    const quote = await quoteCart(input.lines, input.couponCode, { email: input.email });
    if (!quote.lines.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Your cart is empty." });
    if (quote.removed.length) {
      throw new TRPCError({ code: "CONFLICT", message: "Some items in your cart are no longer available. Please review your cart." });
    }
    if (input.couponCode && quote.couponError) throw new TRPCError({ code: "BAD_REQUEST", message: quote.couponError });

    const attribution = await resolveAttribution({ affiliateCode: input.affiliateCode, couponAffiliateId: quote.coupon?.affiliateId, email: input.email });
    const accessKey = crypto.randomBytes(24).toString("hex");
    const orderId = await db.transaction(async (tx) => {
      const [res] = await tx.insert(schema.orders).values({
        accessKey,
        email: input.email.toLowerCase(),
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        address1: input.address1,
        address2: input.address2 || null,
        city: input.city,
        state: input.state,
        zip: input.zip,
        country: "US",
        subtotal: quote.subtotal,
        bundleDiscount: quote.bundleDiscount,
        couponCode: quote.coupon?.code ?? null,
        couponDiscount: quote.couponDiscount,
        shippingTotal: quote.shipping,
        total: quote.total,
        customerNote: input.customerNote || null,
        researchAcknowledged: true,
        affiliateId: attribution?.affiliateId ?? null,
        cartToken: input.cartToken ?? null,
      });
      const id = res.insertId;
      await tx.insert(schema.orderItems).values(
        quote.lines.map((l) => ({
          orderId: id, productId: l.productId, variantId: l.variantId, name: l.name, variantLabel: l.variantLabel,
          unitPrice: l.unitPrice, quantity: l.quantity, bundlePercent: l.bundlePercent, lineTotal: l.lineTotal,
        })),
      );
      return id;
    });

    await logOrderEvent(orderId, "pending", "Order placed, awaiting payment");
    const [order] = await db.select().from(schema.orders).where(eq(schema.orders.id, orderId));
    try {
      const redirectUrl = await createHostedPayment(order!, ctx.baseUrl);
      return { orderId, redirectUrl };
    } catch (err) {
      await db.update(schema.orders).set({ status: "failed" }).where(eq(schema.orders.id, orderId));
      await logOrderEvent(orderId, "failed", "Payment page could not be opened", { public: false });
      throw new TRPCError({ code: "BAD_GATEWAY", message: err instanceof Error ? err.message : "Payment error" });
    }
  }),

  order: publicProcedure
    .input(z.object({ id: z.number().int().positive(), key: z.string().min(10).max(64) }))
    .query(async ({ input }) => {
      const order = await getOrderWithItems(input.id);
      const a = Buffer.from(order?.accessKey ?? "");
      const b = Buffer.from(input.key);
      if (!order || a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      }
      return {
        number: orderNumber(order.id),
        status: order.status,
        email: order.email,
        name: `${order.firstName} ${order.lastName}`,
        address: [order.address1, order.address2, `${order.city}, ${order.state} ${order.zip}`].filter(Boolean),
        items: order.items.map((i) => ({ name: i.name, variantLabel: i.variantLabel, quantity: i.quantity, lineTotal: i.lineTotal })),
        subtotal: order.subtotal,
        bundleDiscount: order.bundleDiscount,
        couponCode: order.couponCode,
        couponDiscount: order.couponDiscount,
        total: order.total,
        createdAt: order.createdAt,
      };
    }),

  /** Seguimiento público: número de pedido + email. */
  trackOrder: publicProcedure
    .input(z.object({ order: z.string().trim().min(1).max(20), email: z.email().max(191) }))
    .query(async ({ input, ctx }) => {
      rateLimit(`track:${ctx.ip}`, 20, 10 * 60_000);
      const id = parseOrderNumber(input.order);
      const order = id && id > 0 ? await getOrderWithItems(id) : null;
      if (!order || order.email !== input.email.trim().toLowerCase()) {
        throw new TRPCError({ code: "NOT_FOUND", message: "We couldn't find an order with that number and email." });
      }
      const events = await db
        .select()
        .from(schema.orderEvents)
        .where(and(eq(schema.orderEvents.orderId, order.id), eq(schema.orderEvents.public, true)))
        .orderBy(asc(schema.orderEvents.createdAt), asc(schema.orderEvents.id));
      return {
        number: orderNumber(order.id),
        status: order.status,
        statusLabel: STATUS_LABELS[order.status] ?? order.status,
        createdAt: order.createdAt,
        paidAt: order.paidAt,
        shippedAt: order.shippedAt,
        completedAt: order.completedAt,
        carrier: order.carrier ? (CARRIERS[order.carrier as keyof typeof CARRIERS]?.label ?? order.carrier) : null,
        trackingNumber: order.trackingNumber,
        trackingUrl: trackingLink(order.carrier, order.trackingNumber, order.trackingUrl),
        shipTo: `${order.city}, ${order.state}`,
        items: order.items.map((i) => ({ name: i.name, variantLabel: i.variantLabel, quantity: i.quantity })),
        total: order.total,
        events: events.map((e) => ({ status: e.status, label: STATUS_LABELS[e.status] ?? e.status, note: e.note, at: e.createdAt })),
      };
    }),

  /** Guarda el carrito cuando el cliente escribe su email en el checkout (para recordatorios). */
  saveCart: publicProcedure
    .input(
      z.object({
        token: z.string().min(16).max(64),
        email: z.email().max(191),
        firstName: z.string().max(80).optional().nullable(),
        lines: cartLines.min(1),
        couponCode: z.string().max(64).optional().nullable(),
        affiliateCode: z.string().max(64).optional().nullable(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      rateLimit(`savecart:${ctx.ip}`, 30, 10 * 60_000);
      await saveAbandonedCart(input);
      return { ok: true };
    }),

  recoverCart: publicProcedure.input(z.object({ token: z.string().min(16).max(64) })).query(async ({ input }) => {
    const [cart] = await db.select().from(schema.abandonedCarts).where(eq(schema.abandonedCarts.token, input.token));
    if (!cart) throw new TRPCError({ code: "NOT_FOUND", message: "This cart link is no longer available." });
    return { lines: cart.lines, couponCode: cart.couponCode, recovered: cart.status === "recovered" };
  }),

  unsubscribeCart: publicProcedure.input(z.object({ token: z.string().min(16).max(64) })).mutation(async ({ input }) => {
    await db.update(schema.abandonedCarts).set({ status: "unsubscribed" }).where(eq(schema.abandonedCarts.token, input.token));
    return { ok: true };
  }),

  /** Registra el clic de un enlace de afiliado. Una visita por visitante al día. */
  trackAffiliateVisit: publicProcedure
    .input(z.object({ code: z.string().min(1).max(64), path: z.string().max(255).optional(), referrer: z.string().max(255).optional() }))
    .mutation(async ({ input, ctx }) => {
      rateLimit(`visit:${ctx.ip}`, 30, 10 * 60_000);
      const affiliate = await findActiveAffiliateByCode(input.code);
      const settings = await getSettings();
      if (!affiliate) return { valid: false as const, cookieDays: settings.cookieDays };
      const day = new Date().toISOString().slice(0, 10);
      const visitorHash = sha256(`${ctx.ip}|${ctx.req.headers["user-agent"] ?? ""}|${day}`);
      const [seen] = await db
        .select({ id: schema.affiliateVisits.id })
        .from(schema.affiliateVisits)
        .where(and(eq(schema.affiliateVisits.affiliateId, affiliate.id), eq(schema.affiliateVisits.visitorHash, visitorHash), gt(schema.affiliateVisits.createdAt, new Date(Date.now() - 86_400_000))));
      if (!seen) {
        await db.insert(schema.affiliateVisits).values({
          affiliateId: affiliate.id,
          landingPath: input.path?.slice(0, 255) ?? null,
          referrer: input.referrer?.slice(0, 255) || null,
          visitorHash,
        });
      }
      return { valid: true as const, code: affiliate.code, cookieDays: settings.cookieDays };
    }),
});
