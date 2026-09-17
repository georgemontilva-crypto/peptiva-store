import { z } from "zod";
import { asc, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { db, schema } from "../db";
import { publicProcedure, rateLimit, router } from "../trpc";
import content from "../data/content.json";
import { emailLayout, escapeHtml, sendMail, supportEmail } from "../lib/mail";
import { uniqueAffiliateCode } from "../lib/affiliates";
import { mediaUrl } from "../lib/media";

export const contentRouter = router({
  page: publicProcedure.input(z.object({ slug: z.string().max(64) })).query(({ input }) => {
    const page = (content.pages as Record<string, { title: string; html: string }>)[input.slug];
    if (!page) throw new TRPCError({ code: "NOT_FOUND", message: "Page not found" });
    return page;
  }),

  faq: publicProcedure.query(() => content.faq),

  /** Un certificado por producto: el lote marcado como principal. */
  coas: publicProcedure.query(async () => {
    const rows = await db
      .select({
        id: schema.coaLots.id, lotNumber: schema.coaLots.lotNumber, title: schema.coaLots.title, purity: schema.coaLots.purity,
        identity: schema.coaLots.identity, heavyMetals: schema.coaLots.heavyMetals, testedAt: schema.coaLots.testedAt,
        reportUrl: schema.coaLots.reportUrl, latest: schema.coaLots.latest, productId: schema.products.id,
        productName: schema.products.name, productSlug: schema.products.slug, imageUrl: schema.products.imageUrl, sortOrder: schema.products.sortOrder,
      })
      .from(schema.coaLots)
      .innerJoin(schema.products, eq(schema.products.id, schema.coaLots.productId))
      .orderBy(asc(schema.products.sortOrder), desc(schema.coaLots.latest), desc(schema.coaLots.testedAt));
    const seen = new Set<number>();
    return rows
      .filter((r) => (seen.has(r.productId) ? false : (seen.add(r.productId), true)))
      .map((c) => ({ ...c, imageUrl: mediaUrl(c.imageUrl), lotCount: rows.filter((r) => r.productId === c.productId && r.lotNumber !== "Current batch").length }));
  }),

  sendContact: publicProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(120),
        email: z.email().max(191),
        subject: z.string().trim().max(191).optional(),
        message: z.string().trim().min(10).max(5000),
        website: z.string().max(0).optional(), // honeypot
      }),
    )
    .mutation(async ({ input, ctx }) => {
      rateLimit(`contact:${ctx.ip}`, 5, 10 * 60_000);
      await db.insert(schema.contactMessages).values({ name: input.name, email: input.email, subject: input.subject || null, message: input.message });
      await sendMail({
        to: supportEmail(),
        replyTo: input.email,
        subject: `Contact form: ${input.subject || "New message"} — ${input.name}`,
        html: `<p><strong>${escapeHtml(input.name)}</strong> &lt;${escapeHtml(input.email)}&gt;</p><p>${escapeHtml(input.message).replace(/\n/g, "<br>")}</p>`,
      });
      return { ok: true };
    }),

  applyAffiliate: publicProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(120),
        email: z.email().max(191),
        channel: z.string().trim().min(3).max(300),
        audience: z.string().trim().max(120).optional(),
        message: z.string().trim().max(3000).optional(),
        website: z.string().max(0).optional(), // honeypot
      }),
    )
    .mutation(async ({ input, ctx }) => {
      rateLimit(`affiliate:${ctx.ip}`, 3, 30 * 60_000);
      const email = input.email.toLowerCase();
      const [existing] = await db.select().from(schema.affiliates).where(eq(schema.affiliates.email, email));
      if (existing && existing.status !== "rejected") {
        throw new TRPCError({ code: "CONFLICT", message: existing.status === "active" ? "This email already has an affiliate account. Sign in instead." : "We already have your application and will reply by email." });
      }
      const values = {
        name: input.name,
        email,
        channel: input.channel,
        audience: input.audience || null,
        applicationNote: input.message || null,
        status: "pending" as const,
      };
      if (existing) await db.update(schema.affiliates).set(values).where(eq(schema.affiliates.id, existing.id));
      else await db.insert(schema.affiliates).values({ ...values, code: await uniqueAffiliateCode(input.name) });
      await sendMail({
        to: supportEmail(),
        replyTo: email,
        subject: `Affiliate application — ${input.name}`,
        html: emailLayout({
          title: "New affiliate application",
          body: `<p><strong>${escapeHtml(input.name)}</strong> &lt;${escapeHtml(email)}&gt;</p><p>Channel: ${escapeHtml(input.channel)}<br>Audience: ${escapeHtml(input.audience ?? "—")}</p>${input.message ? `<p>${escapeHtml(input.message).replace(/\n/g, "<br>")}</p>` : ""}`,
          cta: { label: "Review in admin", url: `${ctx.baseUrl}/admin/affiliates` },
        }),
      });
      return { ok: true };
    }),

  subscribe: publicProcedure
    .input(z.object({ email: z.email().max(191), source: z.enum(["newsletter", "age_gate"]) }))
    .mutation(async ({ input, ctx }) => {
      rateLimit(`lead:${ctx.ip}`, 10, 10 * 60_000);
      await db.insert(schema.leads).values({ email: input.email.toLowerCase(), source: input.source }).onDuplicateKeyUpdate({ set: { source: input.source } });
      return { ok: true };
    }),
});
