import { z } from "zod";
import { and, asc, count, desc, eq, gte, inArray, like, or, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { db, schema } from "../db";
import { adminProcedure, publicProcedure, rateLimit, router } from "../trpc";
import { COOKIE, clearSessionCookie, hashPassword, setSessionCookie, signSession, verifyPassword } from "../lib/auth";
import { getOrderWithItems, orderNumber, parseOrderNumber, updateOrderStatus, logOrderEvent } from "../lib/orders";
import { affiliateTotals, createPasswordLink, normalizeCode, sendApprovalEmail, uniqueAffiliateCode } from "../lib/affiliates";
import { runAbandonedCartJob, sendReminderNow } from "../lib/abandoned";
import { DEFAULT_SETTINGS, getSettings, updateSettings } from "../lib/settings";
import { mailConfigured } from "../lib/mail";
import { bankfulConfigured } from "../lib/bankful";
import { CARRIERS, trackingLink } from "../lib/tracking";
import { adminCoasRouter } from "./adminCoas";

const PAID = ["paid", "on_hold", "shipped", "completed"] as const;
const paidWhere = inArray(schema.orders.status, [...PAID]);
const pageInput = { page: z.number().int().min(1).default(1), pageSize: z.number().int().min(5).max(100).default(25) };
const money = z.union([z.number(), z.string()]).transform((v) => Number(v)).pipe(z.number().min(0).max(1_000_000));

const authRouter = router({
  login: publicProcedure.input(z.object({ email: z.email(), password: z.string().min(1).max(200) })).mutation(async ({ input, ctx }) => {
    rateLimit(`admin-login:${ctx.ip}`, 8, 15 * 60_000);
    const [admin] = await db.select().from(schema.admins).where(eq(schema.admins.email, input.email.toLowerCase()));
    if (!admin || !verifyPassword(input.password, admin.passwordHash)) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Wrong email or password." });
    }
    await db.update(schema.admins).set({ lastLoginAt: new Date() }).where(eq(schema.admins.id, admin.id));
    setSessionCookie(ctx.res, COOKIE.admin, signSession("admin", admin.id, 7), 7);
    return { email: admin.email };
  }),
  logout: publicProcedure.mutation(({ ctx }) => {
    clearSessionCookie(ctx.res, COOKIE.admin);
    return { ok: true };
  }),
  me: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.adminId) return null;
    const [admin] = await db.select({ id: schema.admins.id, email: schema.admins.email, name: schema.admins.name }).from(schema.admins).where(eq(schema.admins.id, ctx.adminId));
    return admin ?? null;
  }),
  changePassword: adminProcedure
    .input(z.object({ current: z.string().min(1), next: z.string().min(10).max(200) }))
    .mutation(async ({ input, ctx }) => {
      const [admin] = await db.select().from(schema.admins).where(eq(schema.admins.id, ctx.adminId));
      if (!admin || !verifyPassword(input.current, admin.passwordHash)) throw new TRPCError({ code: "BAD_REQUEST", message: "Current password is wrong." });
      await db.update(schema.admins).set({ passwordHash: hashPassword(input.next) }).where(eq(schema.admins.id, admin.id));
      return { ok: true };
    }),
});

const dashboardRouter = router({
  overview: adminProcedure.query(async () => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const d7 = new Date(now.getTime() - 7 * 86_400_000);
    const d30 = new Date(now.getTime() - 30 * 86_400_000);
    const revenue = async (from: Date) => {
      const [r] = await db
        .select({ total: sql<string>`COALESCE(SUM(${schema.orders.total}),0)`, n: count() })
        .from(schema.orders)
        .where(and(paidWhere, gte(schema.orders.paidAt, from)));
      return { total: Number(r?.total ?? 0), orders: r?.n ?? 0 };
    };
    const [today, week, month] = await Promise.all([revenue(startOfDay), revenue(d7), revenue(d30)]);

    const statusRows = await db.select({ status: schema.orders.status, n: count() }).from(schema.orders).groupBy(schema.orders.status);
    const byStatus = Object.fromEntries(statusRows.map((r) => [r.status, r.n])) as Record<string, number>;

    const [abandoned] = await db
      .select({ n: count(), value: sql<string>`COALESCE(SUM(${schema.abandonedCarts.subtotal}),0)` })
      .from(schema.abandonedCarts)
      .where(and(eq(schema.abandonedCarts.status, "open"), gte(schema.abandonedCarts.updatedAt, d30)));
    const [recovered] = await db
      .select({ n: count() })
      .from(schema.abandonedCarts)
      .where(and(eq(schema.abandonedCarts.status, "recovered"), gte(schema.abandonedCarts.updatedAt, d30)));

    const [pendingAffiliates] = await db.select({ n: count() }).from(schema.affiliates).where(eq(schema.affiliates.status, "pending"));
    const commissionRows = await db
      .select({ status: schema.commissions.status, amount: sql<string>`COALESCE(SUM(${schema.commissions.amount}),0)` })
      .from(schema.commissions)
      .groupBy(schema.commissions.status);
    const commissionsBy = (s: string) => Number(commissionRows.find((r) => r.status === s)?.amount ?? 0);

    const daily = await db
      .select({ day: sql<string>`DATE(${schema.orders.paidAt})`, total: sql<string>`SUM(${schema.orders.total})`, n: count() })
      .from(schema.orders)
      .where(and(paidWhere, gte(schema.orders.paidAt, new Date(now.getTime() - 14 * 86_400_000))))
      .groupBy(sql`DATE(${schema.orders.paidAt})`);
    const days = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(now.getTime() - (13 - i) * 86_400_000);
      const key = d.toISOString().slice(0, 10);
      const row = daily.find((r) => String(r.day).slice(0, 10) === key);
      return { day: key, total: Number(row?.total ?? 0), orders: row?.n ?? 0 };
    });

    const recent = await db
      .select({ id: schema.orders.id, email: schema.orders.email, firstName: schema.orders.firstName, lastName: schema.orders.lastName, total: schema.orders.total, status: schema.orders.status, createdAt: schema.orders.createdAt })
      .from(schema.orders)
      .orderBy(desc(schema.orders.id))
      .limit(8);

    return {
      revenue: { today, week, month },
      byStatus,
      toShip: byStatus.paid ?? 0,
      onHold: byStatus.on_hold ?? 0,
      abandoned: { open: abandoned?.n ?? 0, value: Number(abandoned?.value ?? 0), recovered: recovered?.n ?? 0 },
      affiliates: { pending: pendingAffiliates?.n ?? 0, commissionsPending: commissionsBy("pending"), commissionsApproved: commissionsBy("approved") },
      days,
      recent: recent.map((o) => ({ ...o, number: orderNumber(o.id) })),
      health: { payments: bankfulConfigured(), email: mailConfigured(), sessionSecret: Boolean(process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32) },
    };
  }),
});

const ordersRouter = router({
  list: adminProcedure
    .input(z.object({ status: z.string().optional(), search: z.string().max(100).optional(), ...pageInput }))
    .query(async ({ input }) => {
      const where = [];
      if (input.status) where.push(eq(schema.orders.status, input.status as (typeof schema.orderStatuses)[number]));
      if (input.search?.trim()) {
        const term = input.search.trim();
        const id = parseOrderNumber(term);
        const likeTerm = `%${term}%`;
        where.push(or(like(schema.orders.email, likeTerm), like(schema.orders.lastName, likeTerm), like(schema.orders.firstName, likeTerm), like(schema.orders.trackingNumber, likeTerm), ...(id && id > 0 ? [eq(schema.orders.id, id)] : []))!);
      }
      const cond = where.length ? and(...where) : undefined;
      const [total] = await db.select({ n: count() }).from(schema.orders).where(cond);
      const rows = await db
        .select()
        .from(schema.orders)
        .where(cond)
        .orderBy(desc(schema.orders.id))
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize);
      const itemCounts = rows.length
        ? await db
            .select({ orderId: schema.orderItems.orderId, n: sql<number>`SUM(${schema.orderItems.quantity})` })
            .from(schema.orderItems)
            .where(inArray(schema.orderItems.orderId, rows.map((r) => r.id)))
            .groupBy(schema.orderItems.orderId)
        : [];
      return {
        total: total?.n ?? 0,
        orders: rows.map((o) => ({
          id: o.id, number: orderNumber(o.id), status: o.status, email: o.email, name: `${o.firstName} ${o.lastName}`, total: o.total,
          items: Number(itemCounts.find((c) => c.orderId === o.id)?.n ?? 0), createdAt: o.createdAt, trackingNumber: o.trackingNumber,
          couponCode: o.couponCode, affiliateId: o.affiliateId, state: o.state,
        })),
      };
    }),

  get: adminProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ input }) => {
    const order = await getOrderWithItems(input.id);
    if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
    const [events, payments, commissionRows, affiliateRows] = await Promise.all([
      db.select().from(schema.orderEvents).where(eq(schema.orderEvents.orderId, order.id)).orderBy(asc(schema.orderEvents.createdAt), asc(schema.orderEvents.id)),
      db.select({ id: schema.paymentEvents.id, kind: schema.paymentEvents.kind, transStatus: schema.paymentEvents.transStatus, outcome: schema.paymentEvents.outcome, signatureValid: schema.paymentEvents.signatureValid, createdAt: schema.paymentEvents.createdAt }).from(schema.paymentEvents).where(eq(schema.paymentEvents.orderId, order.id)).orderBy(asc(schema.paymentEvents.id)),
      db.select().from(schema.commissions).where(eq(schema.commissions.orderId, order.id)),
      order.affiliateId ? db.select({ id: schema.affiliates.id, name: schema.affiliates.name, code: schema.affiliates.code }).from(schema.affiliates).where(eq(schema.affiliates.id, order.affiliateId)) : Promise.resolve([]),
    ]);
    const { accessKey: _accessKey, ...safe } = order;
    return {
      ...safe,
      number: orderNumber(order.id),
      trackingLink: trackingLink(order.carrier, order.trackingNumber, order.trackingUrl),
      events, payments, commission: commissionRows[0] ?? null, affiliate: affiliateRows[0] ?? null,
    };
  }),

  update: adminProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        status: z.enum(schema.orderStatuses),
        note: z.string().max(500).optional().nullable(),
        carrier: z.enum(Object.keys(CARRIERS) as [keyof typeof CARRIERS, ...(keyof typeof CARRIERS)[]]).optional().nullable(),
        trackingNumber: z.string().max(64).optional().nullable(),
        trackingUrl: z.url().max(512).optional().nullable().or(z.literal("")),
        notifyCustomer: z.boolean().default(true),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await updateOrderStatus(input.id, { ...input, trackingUrl: input.trackingUrl || null, by: `admin:${ctx.adminId}` });
      return { ok: true };
    }),

  addNote: adminProcedure
    .input(z.object({ id: z.number().int().positive(), note: z.string().trim().min(1).max(500) }))
    .mutation(async ({ input, ctx }) => {
      const [order] = await db.select({ status: schema.orders.status }).from(schema.orders).where(eq(schema.orders.id, input.id));
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      await logOrderEvent(input.id, order.status, input.note, { public: false, by: `admin:${ctx.adminId}` });
      return { ok: true };
    }),
});

const abandonedRouter = router({
  list: adminProcedure.input(z.object({ status: z.enum(["open", "recovered", "unsubscribed"]).optional(), ...pageInput })).query(async ({ input }) => {
    const cond = input.status ? eq(schema.abandonedCarts.status, input.status) : undefined;
    const [total] = await db.select({ n: count() }).from(schema.abandonedCarts).where(cond);
    const rows = await db.select().from(schema.abandonedCarts).where(cond).orderBy(desc(schema.abandonedCarts.updatedAt)).limit(input.pageSize).offset((input.page - 1) * input.pageSize);
    const productIds = [...new Set(rows.flatMap((r) => r.lines.map((l) => l.productId)))];
    const names = productIds.length ? await db.select({ id: schema.products.id, name: schema.products.name }).from(schema.products).where(inArray(schema.products.id, productIds)) : [];
    const settings = await getSettings();
    return {
      total: total?.n ?? 0,
      mailConfigured: mailConfigured(),
      enabled: settings.abandonedEnabled,
      carts: rows.map((c) => ({
        id: c.id, email: c.email, firstName: c.firstName, status: c.status, emailsSent: c.emailsSent, lastEmailAt: c.lastEmailAt,
        subtotal: c.subtotal, couponCode: c.couponCode, recoveredOrderId: c.recoveredOrderId, createdAt: c.createdAt, updatedAt: c.updatedAt,
        items: c.lines.map((l) => `${names.find((n) => n.id === l.productId)?.name ?? "Removed product"} × ${l.quantity}`),
      })),
    };
  }),
  sendNow: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
    try {
      return { step: await sendReminderNow(input.id) };
    } catch (err) {
      throw new TRPCError({ code: "BAD_REQUEST", message: err instanceof Error ? err.message : "Could not send" });
    }
  }),
  remove: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
    await db.delete(schema.abandonedCarts).where(eq(schema.abandonedCarts.id, input.id));
    return { ok: true };
  }),
  runNow: adminProcedure.mutation(() => runAbandonedCartJob()),
});

const couponInput = z.object({
  code: z.string().trim().min(2).max(64),
  description: z.string().max(191).optional().nullable(),
  type: z.enum(["percent", "fixed"]),
  amount: money,
  active: z.boolean(),
  startsAt: z.coerce.date().optional().nullable(),
  expiresAt: z.coerce.date().optional().nullable(),
  usageLimit: z.number().int().min(1).optional().nullable(),
  perCustomerLimit: z.number().int().min(1).optional().nullable(),
  minSubtotal: money.optional().nullable(),
  affiliateId: z.number().int().positive().optional().nullable(),
});

const toCouponRow = (c: z.infer<typeof couponInput>) => {
  if (c.type === "percent" && c.amount > 100) throw new TRPCError({ code: "BAD_REQUEST", message: "A percentage discount can't be above 100%." });
  return {
    code: c.code.toLowerCase(),
    description: c.description || null,
    type: c.type,
    amount: c.amount.toFixed(2),
    active: c.active,
    startsAt: c.startsAt ?? null,
    expiresAt: c.expiresAt ?? null,
    usageLimit: c.usageLimit ?? null,
    perCustomerLimit: c.perCustomerLimit ?? null,
    minSubtotal: c.minSubtotal != null ? c.minSubtotal.toFixed(2) : null,
    affiliateId: c.affiliateId ?? null,
  };
};

const couponsRouter = router({
  list: adminProcedure.query(async () => {
    const rows = await db.select().from(schema.coupons).orderBy(desc(schema.coupons.id));
    const affiliates = await db.select({ id: schema.affiliates.id, name: schema.affiliates.name }).from(schema.affiliates);
    const revenue = await db
      .select({ code: schema.orders.couponCode, total: sql<string>`SUM(${schema.orders.total})`, discount: sql<string>`SUM(${schema.orders.couponDiscount})` })
      .from(schema.orders)
      .where(and(paidWhere, sql`${schema.orders.couponCode} IS NOT NULL`))
      .groupBy(schema.orders.couponCode);
    return rows.map((c) => ({
      ...c,
      affiliateName: affiliates.find((a) => a.id === c.affiliateId)?.name ?? null,
      revenue: Number(revenue.find((r) => r.code === c.code)?.total ?? 0),
      discountGiven: Number(revenue.find((r) => r.code === c.code)?.discount ?? 0),
    }));
  }),
  create: adminProcedure.input(couponInput).mutation(async ({ input }) => {
    const [dupe] = await db.select({ id: schema.coupons.id }).from(schema.coupons).where(eq(schema.coupons.code, input.code.toLowerCase()));
    if (dupe) throw new TRPCError({ code: "CONFLICT", message: "A coupon with this code already exists." });
    await db.insert(schema.coupons).values(toCouponRow(input));
    return { ok: true };
  }),
  update: adminProcedure.input(couponInput.extend({ id: z.number().int().positive() })).mutation(async ({ input }) => {
    const [dupe] = await db.select({ id: schema.coupons.id }).from(schema.coupons).where(eq(schema.coupons.code, input.code.toLowerCase()));
    if (dupe && dupe.id !== input.id) throw new TRPCError({ code: "CONFLICT", message: "A coupon with this code already exists." });
    await db.update(schema.coupons).set(toCouponRow(input)).where(eq(schema.coupons.id, input.id));
    return { ok: true };
  }),
  remove: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
    const [c] = await db.select().from(schema.coupons).where(eq(schema.coupons.id, input.id));
    if (!c) return { removed: false };
    if (c.usageCount > 0) {
      // Con usos registrados se desactiva para no perder el historial
      await db.update(schema.coupons).set({ active: false }).where(eq(schema.coupons.id, c.id));
      return { removed: false, deactivated: true };
    }
    await db.delete(schema.coupons).where(eq(schema.coupons.id, c.id));
    return { removed: true };
  }),
});

const affiliateInput = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.email().max(191),
  code: z.string().trim().min(2).max(40),
  status: z.enum(["pending", "active", "rejected", "suspended"]),
  commissionRate: money.optional().nullable(),
  channel: z.string().max(300).optional().nullable(),
  payoutMethod: z.string().max(40).optional().nullable(),
  payoutDetails: z.string().max(300).optional().nullable(),
  adminNote: z.string().max(3000).optional().nullable(),
});

const affiliatesRouter = router({
  list: adminProcedure.input(z.object({ status: z.enum(["pending", "active", "rejected", "suspended"]).optional(), search: z.string().max(100).optional() })).query(async ({ input }) => {
    const where = [];
    if (input.status) where.push(eq(schema.affiliates.status, input.status));
    if (input.search?.trim()) {
      const t = `%${input.search.trim()}%`;
      where.push(or(like(schema.affiliates.name, t), like(schema.affiliates.email, t), like(schema.affiliates.code, t))!);
    }
    const rows = await db.select().from(schema.affiliates).where(where.length ? and(...where) : undefined).orderBy(desc(schema.affiliates.id));
    const settings = await getSettings();
    return Promise.all(
      rows.map(async (a) => {
        const { passwordHash, ...safe } = a;
        return { ...safe, hasPassword: Boolean(passwordHash), effectiveRate: Number(a.commissionRate ?? settings.commissionRate), totals: await affiliateTotals(a.id) };
      }),
    );
  }),

  get: adminProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ input }) => {
    const [a] = await db.select().from(schema.affiliates).where(eq(schema.affiliates.id, input.id));
    if (!a) throw new TRPCError({ code: "NOT_FOUND", message: "Affiliate not found" });
    const { passwordHash, ...safe } = a;
    const [commissions, payouts, coupons] = await Promise.all([
      db.select().from(schema.commissions).where(eq(schema.commissions.affiliateId, a.id)).orderBy(desc(schema.commissions.id)).limit(100),
      db.select().from(schema.payouts).where(eq(schema.payouts.affiliateId, a.id)).orderBy(desc(schema.payouts.id)),
      db.select({ id: schema.coupons.id, code: schema.coupons.code, amount: schema.coupons.amount, type: schema.coupons.type, active: schema.coupons.active, usageCount: schema.coupons.usageCount }).from(schema.coupons).where(eq(schema.coupons.affiliateId, a.id)),
    ]);
    const settings = await getSettings();
    return {
      ...safe,
      hasPassword: Boolean(passwordHash),
      effectiveRate: Number(a.commissionRate ?? settings.commissionRate),
      minPayout: settings.minPayout,
      totals: await affiliateTotals(a.id),
      commissions: commissions.map((c) => ({ ...c, orderNumber: orderNumber(c.orderId) })),
      payouts,
      coupons,
    };
  }),

  create: adminProcedure.input(affiliateInput.partial({ code: true }).extend({ sendInvite: z.boolean().default(true) })).mutation(async ({ input }) => {
    const email = input.email.toLowerCase();
    const [dupe] = await db.select({ id: schema.affiliates.id }).from(schema.affiliates).where(eq(schema.affiliates.email, email));
    if (dupe) throw new TRPCError({ code: "CONFLICT", message: "An affiliate with this email already exists." });
    const code = input.code ? normalizeCode(input.code) : await uniqueAffiliateCode(input.name);
    const [codeTaken] = await db.select({ id: schema.affiliates.id }).from(schema.affiliates).where(eq(schema.affiliates.code, code));
    if (codeTaken) throw new TRPCError({ code: "CONFLICT", message: "That referral code is already taken." });
    const [res] = await db.insert(schema.affiliates).values({
      name: input.name, email, code, status: input.status, commissionRate: input.commissionRate != null ? input.commissionRate.toFixed(2) : null,
      channel: input.channel || null, payoutMethod: input.payoutMethod || null, payoutDetails: input.payoutDetails || null, adminNote: input.adminNote || null,
      approvedAt: input.status === "active" ? new Date() : null,
    });
    const [created] = await db.select().from(schema.affiliates).where(eq(schema.affiliates.id, res.insertId));
    let emailed = false;
    let passwordLink: string | null = null;
    if (created && input.status === "active" && input.sendInvite) {
      emailed = await sendApprovalEmail(created);
      if (!emailed) passwordLink = await createPasswordLink(created.id);
    }
    return { id: res.insertId, emailed, passwordLink };
  }),

  update: adminProcedure.input(affiliateInput.extend({ id: z.number().int().positive() })).mutation(async ({ input }) => {
    const code = normalizeCode(input.code);
    const [codeTaken] = await db.select({ id: schema.affiliates.id }).from(schema.affiliates).where(eq(schema.affiliates.code, code));
    if (codeTaken && codeTaken.id !== input.id) throw new TRPCError({ code: "CONFLICT", message: "That referral code is already taken." });
    const [emailTaken] = await db.select({ id: schema.affiliates.id }).from(schema.affiliates).where(eq(schema.affiliates.email, input.email.toLowerCase()));
    if (emailTaken && emailTaken.id !== input.id) throw new TRPCError({ code: "CONFLICT", message: "Another affiliate uses this email." });
    await db.update(schema.affiliates).set({
      name: input.name, email: input.email.toLowerCase(), code, status: input.status,
      commissionRate: input.commissionRate != null ? input.commissionRate.toFixed(2) : null,
      channel: input.channel || null, payoutMethod: input.payoutMethod || null, payoutDetails: input.payoutDetails || null, adminNote: input.adminNote || null,
    }).where(eq(schema.affiliates.id, input.id));
    return { ok: true };
  }),

  approve: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
    await db.update(schema.affiliates).set({ status: "active", approvedAt: new Date() }).where(eq(schema.affiliates.id, input.id));
    const [a] = await db.select().from(schema.affiliates).where(eq(schema.affiliates.id, input.id));
    if (!a) throw new TRPCError({ code: "NOT_FOUND", message: "Affiliate not found" });
    const emailed = await sendApprovalEmail(a);
    return { emailed, passwordLink: emailed ? null : await createPasswordLink(a.id) };
  }),

  reject: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
    await db.update(schema.affiliates).set({ status: "rejected" }).where(eq(schema.affiliates.id, input.id));
    return { ok: true };
  }),

  /** Genera un nuevo enlace para crear contraseña (y lo envía si hay email configurado). */
  resendInvite: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
    const [a] = await db.select().from(schema.affiliates).where(eq(schema.affiliates.id, input.id));
    if (!a || a.status !== "active") throw new TRPCError({ code: "BAD_REQUEST", message: "Only active affiliates can receive an invite." });
    const emailed = await sendApprovalEmail(a);
    return { emailed, passwordLink: emailed ? null : await createPasswordLink(a.id) };
  }),

  setCommissionStatus: adminProcedure
    .input(z.object({ ids: z.array(z.number().int().positive()).min(1).max(200), status: z.enum(["pending", "approved", "rejected"]) }))
    .mutation(async ({ input }) => {
      await db
        .update(schema.commissions)
        .set({ status: input.status, approvedAt: input.status === "approved" ? new Date() : null })
        .where(and(inArray(schema.commissions.id, input.ids), sql`${schema.commissions.status} <> 'paid'`));
      return { ok: true };
    }),

  /** Registra un pago: marca como pagadas todas las comisiones aprobadas del afiliado. */
  createPayout: adminProcedure
    .input(z.object({ affiliateId: z.number().int().positive(), method: z.string().max(40).optional(), reference: z.string().max(191).optional(), note: z.string().max(500).optional() }))
    .mutation(async ({ input }) => {
      const approved = await db
        .select()
        .from(schema.commissions)
        .where(and(eq(schema.commissions.affiliateId, input.affiliateId), eq(schema.commissions.status, "approved")));
      if (!approved.length) throw new TRPCError({ code: "BAD_REQUEST", message: "There are no approved commissions to pay." });
      const amount = approved.reduce((s, c) => s + Number(c.amount), 0);
      const payoutId = await db.transaction(async (tx) => {
        const [res] = await tx.insert(schema.payouts).values({ affiliateId: input.affiliateId, amount: amount.toFixed(2), method: input.method || null, reference: input.reference || null, note: input.note || null });
        await tx.update(schema.commissions).set({ status: "paid", payoutId: res.insertId }).where(inArray(schema.commissions.id, approved.map((c) => c.id)));
        return res.insertId;
      });
      return { payoutId, amount, commissions: approved.length };
    }),
});

const commissionsRouter = router({
  list: adminProcedure.input(z.object({ status: z.enum(["pending", "approved", "paid", "rejected"]).optional(), ...pageInput })).query(async ({ input }) => {
    const cond = input.status ? eq(schema.commissions.status, input.status) : undefined;
    const [total] = await db.select({ n: count() }).from(schema.commissions).where(cond);
    const rows = await db
      .select({
        id: schema.commissions.id, orderId: schema.commissions.orderId, base: schema.commissions.base, rate: schema.commissions.rate, amount: schema.commissions.amount,
        status: schema.commissions.status, source: schema.commissions.source, createdAt: schema.commissions.createdAt,
        affiliateId: schema.affiliates.id, affiliateName: schema.affiliates.name, orderStatus: schema.orders.status,
      })
      .from(schema.commissions)
      .innerJoin(schema.affiliates, eq(schema.affiliates.id, schema.commissions.affiliateId))
      .innerJoin(schema.orders, eq(schema.orders.id, schema.commissions.orderId))
      .where(cond)
      .orderBy(desc(schema.commissions.id))
      .limit(input.pageSize)
      .offset((input.page - 1) * input.pageSize);
    return { total: total?.n ?? 0, commissions: rows.map((r) => ({ ...r, orderNumber: orderNumber(r.orderId) })) };
  }),
});

const settingsRouter = router({
  get: adminProcedure.query(async () => ({ values: await getSettings(), defaults: DEFAULT_SETTINGS })),
  update: adminProcedure
    .input(
      z.object({
        commissionRate: z.number().min(0).max(90),
        cookieDays: z.number().int().min(1).max(365),
        minPayout: z.number().min(0).max(100000),
        autoApproveOnComplete: z.boolean(),
        abandonedEnabled: z.boolean(),
        abandonedFirstDelayMinutes: z.number().int().min(15).max(7 * 24 * 60),
        abandonedSecondDelayHours: z.number().int().min(1).max(14 * 24),
        abandonedCouponCode: z.string().max(64),
        shippingCutoffHour: z.number().int().min(0).max(23),
      }).partial(),
    )
    .mutation(async ({ input }) => {
      if (input.abandonedCouponCode) {
        const [c] = await db.select({ id: schema.coupons.id }).from(schema.coupons).where(eq(schema.coupons.code, input.abandonedCouponCode.toLowerCase()));
        if (!c) throw new TRPCError({ code: "BAD_REQUEST", message: "That coupon code doesn't exist. Create it in Coupons first." });
        input.abandonedCouponCode = input.abandonedCouponCode.toLowerCase();
      }
      return updateSettings(input);
    }),
});

const inboxRouter = router({
  messages: adminProcedure.query(() => db.select().from(schema.contactMessages).orderBy(desc(schema.contactMessages.id)).limit(200)),
  leads: adminProcedure.query(() => db.select().from(schema.leads).orderBy(desc(schema.leads.id)).limit(500)),
});

export const adminRouter = router({
  auth: authRouter,
  dashboard: dashboardRouter,
  orders: ordersRouter,
  abandoned: abandonedRouter,
  coupons: couponsRouter,
  affiliates: affiliatesRouter,
  commissions: commissionsRouter,
  settings: settingsRouter,
  inbox: inboxRouter,
  coas: adminCoasRouter,
});
