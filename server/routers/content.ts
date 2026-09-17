import { z } from "zod";
import { asc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { db, schema } from "../db";
import { publicProcedure, rateLimit, router } from "../trpc";
import content from "../data/content.json";
import { escapeHtml, sendMail, supportEmail } from "../lib/mail";
import { mediaUrl } from "../lib/media";

export const contentRouter = router({
  page: publicProcedure.input(z.object({ slug: z.string().max(64) })).query(({ input }) => {
    const page = (content.pages as Record<string, { title: string; html: string }>)[input.slug];
    if (!page) throw new TRPCError({ code: "NOT_FOUND", message: "Page not found" });
    return page;
  }),

  faq: publicProcedure.query(() => content.faq),

  coas: publicProcedure.query(async () =>
    (await db
      .select({
        id: schema.coaLots.id, lotNumber: schema.coaLots.lotNumber, purity: schema.coaLots.purity, reportUrl: schema.coaLots.reportUrl,
        testedAt: schema.coaLots.testedAt, productName: schema.products.name, productSlug: schema.products.slug, imageUrl: schema.products.imageUrl,
      })
      .from(schema.coaLots)
      .innerJoin(schema.products, eq(schema.products.id, schema.coaLots.productId))
      .orderBy(asc(schema.products.sortOrder))).map((c) => ({ ...c, imageUrl: mediaUrl(c.imageUrl) })),
  ),

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

  subscribe: publicProcedure
    .input(z.object({ email: z.email().max(191), source: z.enum(["newsletter", "age_gate"]) }))
    .mutation(async ({ input, ctx }) => {
      rateLimit(`lead:${ctx.ip}`, 10, 10 * 60_000);
      await db.insert(schema.leads).values({ email: input.email.toLowerCase(), source: input.source }).onDuplicateKeyUpdate({ set: { source: input.source } });
      return { ok: true };
    }),
});
