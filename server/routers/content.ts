import { z } from "zod";
import { and, asc, desc, eq, ne } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { db, schema } from "../db";
import { publicProcedure, rateLimit, router } from "../trpc";
import content from "../data/content.json";
import { emailLayout, escapeHtml, sendMail, supportEmail } from "../lib/mail";
import { uniqueAffiliateCode } from "../lib/affiliates";
import { mediaUrl } from "../lib/media";
import { getFaq, getPage } from "../lib/site-content";
import { autoExcerpt, listFields, livePosts, liveSlugs, liveWhere, postState, readingMinutes, toCard, unlinkUnpublished } from "../lib/blog";

const blogRouter = router({
  /** Artículos visibles, del más reciente al más antiguo, y las categorías que tienen alguno. */
  list: publicProcedure.input(z.object({ category: z.string().max(80).optional(), limit: z.number().int().min(1).max(200).optional() }).optional()).query(async ({ input }) => {
    const rows = (await livePosts()).map(toCard);
    const categories = [...new Set(rows.map((r) => r.category).filter((c): c is string => Boolean(c)))].sort();
    const filtered = input?.category ? rows.filter((r) => r.category === input.category) : rows;
    return { categories, total: filtered.length, posts: input?.limit ? filtered.slice(0, input.limit) : filtered };
  }),

  /**
   * Un artículo por su dirección. El público solo ve lo publicado; quien tiene sesión de admin puede
   * abrir también borradores y programados, que es lo que usa el botón "Preview" del editor.
   */
  get: publicProcedure.input(z.object({ slug: z.string().min(1).max(191) })).query(async ({ input, ctx }) => {
    const [post] = await db.select().from(schema.blogPosts).where(eq(schema.blogPosts.slug, input.slug));
    const state = post ? postState(post) : null;
    if (!post || (state !== "live" && !ctx.adminId)) throw new TRPCError({ code: "NOT_FOUND", message: "Article not found" });

    const live = await liveSlugs();
    const others = await db
      .select(listFields)
      .from(schema.blogPosts)
      .where(and(liveWhere(), ne(schema.blogPosts.id, post.id)))
      .orderBy(desc(schema.blogPosts.publishedAt))
      .limit(40);
    // Primero los de la misma categoría, y se completa con los más recientes
    const related = [...others.filter((o) => o.category && o.category === post.category), ...others.filter((o) => !o.category || o.category !== post.category)].slice(0, 3).map(toCard);

    return {
      id: post.id,
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt || post.seoDescription || autoExcerpt(post.bodyHtml),
      bodyHtml: unlinkUnpublished(post.bodyHtml, live),
      coverImage: post.coverImage,
      coverAlt: post.coverAlt,
      category: post.category,
      seoTitle: post.seoTitle,
      seoDescription: post.seoDescription,
      publishedAt: post.publishedAt,
      updatedAt: post.updatedAt,
      minutes: readingMinutes(post.bodyHtml),
      state,
      related,
    };
  }),
});

export const contentRouter = router({
  blog: blogRouter,

  page: publicProcedure.input(z.object({ slug: z.string().max(64) })).query(async ({ input }) => {
    const page = await getPage(input.slug);
    if (!page) throw new TRPCError({ code: "NOT_FOUND", message: "Page not found" });
    return { title: page.title, html: page.html };
  }),

  faq: publicProcedure.query(async () => (await getFaq()).items),

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
