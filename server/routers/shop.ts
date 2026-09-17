import crypto from "node:crypto";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { db, schema } from "../db";
import { publicProcedure, rateLimit, router } from "../trpc";
import { quoteCart } from "../lib/pricing";
import { bankfulConfigured, createHostedPayment } from "../lib/bankful";
import { getOrderWithItems, orderNumber } from "../lib/orders";

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
});

export const shopRouter = router({
  quote: publicProcedure
    .input(z.object({ lines: cartLines, couponCode: z.string().max(64).optional().nullable() }))
    .query(({ input }) => quoteCart(input.lines, input.couponCode)),

  paymentsEnabled: publicProcedure.query(() => bankfulConfigured()),

  placeOrder: publicProcedure.input(checkoutInput).mutation(async ({ input, ctx }) => {
    rateLimit(`order:${ctx.ip}`, 8, 10 * 60_000);
    if (!bankfulConfigured()) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Card payments are temporarily unavailable. Please contact support." });
    }

    const quote = await quoteCart(input.lines, input.couponCode);
    if (!quote.lines.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Your cart is empty." });
    if (quote.removed.length) {
      throw new TRPCError({ code: "CONFLICT", message: "Some items in your cart are no longer available. Please review your cart." });
    }
    if (input.couponCode && quote.couponError) throw new TRPCError({ code: "BAD_REQUEST", message: quote.couponError });

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

    const [order] = await db.select().from(schema.orders).where(eq(schema.orders.id, orderId));
    try {
      const redirectUrl = await createHostedPayment(order!, ctx.baseUrl);
      return { orderId, redirectUrl };
    } catch (err) {
      await db.update(schema.orders).set({ status: "failed" }).where(eq(schema.orders.id, orderId));
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
});
