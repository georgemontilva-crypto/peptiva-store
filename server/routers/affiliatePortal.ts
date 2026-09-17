import { z } from "zod";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { db, schema } from "../db";
import { affiliateProcedure, publicProcedure, rateLimit, router } from "../trpc";
import { COOKIE, clearSessionCookie, hashPassword, setSessionCookie, signSession, verifyPassword } from "../lib/auth";
import { affiliateTotals, consumePasswordToken, sendResetEmail } from "../lib/affiliates";
import { getSettings } from "../lib/settings";
import { orderNumber } from "../lib/orders";

export const affiliatePortalRouter = router({
  login: publicProcedure.input(z.object({ email: z.email(), password: z.string().min(1).max(200) })).mutation(async ({ input, ctx }) => {
    rateLimit(`aff-login:${ctx.ip}`, 10, 15 * 60_000);
    const [a] = await db.select().from(schema.affiliates).where(eq(schema.affiliates.email, input.email.toLowerCase()));
    if (!a || !verifyPassword(input.password, a.passwordHash)) throw new TRPCError({ code: "UNAUTHORIZED", message: "Wrong email or password." });
    if (a.status !== "active") throw new TRPCError({ code: "FORBIDDEN", message: "This affiliate account is not active. Contact support." });
    await db.update(schema.affiliates).set({ lastLoginAt: new Date() }).where(eq(schema.affiliates.id, a.id));
    setSessionCookie(ctx.res, COOKIE.affiliate, signSession("affiliate", a.id, 30), 30);
    return { ok: true };
  }),

  logout: publicProcedure.mutation(({ ctx }) => {
    clearSessionCookie(ctx.res, COOKIE.affiliate);
    return { ok: true };
  }),

  setPassword: publicProcedure.input(z.object({ token: z.string().min(20).max(100), password: z.string().min(10).max(200) })).mutation(async ({ input, ctx }) => {
    rateLimit(`aff-setpw:${ctx.ip}`, 10, 15 * 60_000);
    const affiliateId = await consumePasswordToken(input.token);
    if (!affiliateId) throw new TRPCError({ code: "BAD_REQUEST", message: "This link has expired or was already used. Request a new one." });
    await db.update(schema.affiliates).set({ passwordHash: hashPassword(input.password), lastLoginAt: new Date() }).where(eq(schema.affiliates.id, affiliateId));
    setSessionCookie(ctx.res, COOKIE.affiliate, signSession("affiliate", affiliateId, 30), 30);
    return { ok: true };
  }),

  requestReset: publicProcedure.input(z.object({ email: z.email() })).mutation(async ({ input, ctx }) => {
    rateLimit(`aff-reset:${ctx.ip}`, 5, 30 * 60_000);
    const [a] = await db.select().from(schema.affiliates).where(eq(schema.affiliates.email, input.email.toLowerCase()));
    if (a && a.status === "active") await sendResetEmail(a);
    // Misma respuesta exista o no la cuenta
    return { ok: true };
  }),

  me: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.affiliateId) return null;
    const [a] = await db.select({ id: schema.affiliates.id, name: schema.affiliates.name, status: schema.affiliates.status }).from(schema.affiliates).where(eq(schema.affiliates.id, ctx.affiliateId));
    return a && a.status === "active" ? a : null;
  }),

  dashboard: affiliateProcedure.query(async ({ ctx }) => {
    const [a] = await db.select().from(schema.affiliates).where(eq(schema.affiliates.id, ctx.affiliateId));
    if (!a || a.status !== "active") throw new TRPCError({ code: "UNAUTHORIZED", message: "Please sign in again." });
    const settings = await getSettings();
    const since = new Date(Date.now() - 30 * 86_400_000);
    const [commissions, payouts, coupons, visits] = await Promise.all([
      db
        .select({ id: schema.commissions.id, orderId: schema.commissions.orderId, amount: schema.commissions.amount, base: schema.commissions.base, status: schema.commissions.status, source: schema.commissions.source, createdAt: schema.commissions.createdAt })
        .from(schema.commissions)
        .where(eq(schema.commissions.affiliateId, a.id))
        .orderBy(desc(schema.commissions.id))
        .limit(100),
      db.select({ id: schema.payouts.id, amount: schema.payouts.amount, method: schema.payouts.method, createdAt: schema.payouts.createdAt }).from(schema.payouts).where(eq(schema.payouts.affiliateId, a.id)).orderBy(desc(schema.payouts.id)),
      db.select({ code: schema.coupons.code, type: schema.coupons.type, amount: schema.coupons.amount }).from(schema.coupons).where(and(eq(schema.coupons.affiliateId, a.id), eq(schema.coupons.active, true))),
      db
        .select({ day: sql<string>`DATE(${schema.affiliateVisits.createdAt})`, n: sql<number>`COUNT(*)` })
        .from(schema.affiliateVisits)
        .where(and(eq(schema.affiliateVisits.affiliateId, a.id), gte(schema.affiliateVisits.createdAt, since)))
        .groupBy(sql`DATE(${schema.affiliateVisits.createdAt})`),
    ]);
    return {
      name: a.name,
      email: a.email,
      code: a.code,
      rate: Number(a.commissionRate ?? settings.commissionRate),
      cookieDays: settings.cookieDays,
      minPayout: settings.minPayout,
      payoutMethod: a.payoutMethod,
      payoutDetails: a.payoutDetails,
      totals: await affiliateTotals(a.id),
      commissions: commissions.map((c) => ({ ...c, orderNumber: orderNumber(c.orderId) })),
      payouts,
      coupons,
      clicks30: visits.reduce((s, v) => s + Number(v.n), 0),
    };
  }),

  updatePayout: affiliateProcedure
    .input(z.object({ payoutMethod: z.string().trim().min(1).max(40), payoutDetails: z.string().trim().min(3).max(300) }))
    .mutation(async ({ input, ctx }) => {
      await db.update(schema.affiliates).set(input).where(eq(schema.affiliates.id, ctx.affiliateId));
      return { ok: true };
    }),
});
