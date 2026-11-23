import { z } from "zod";
import { and, asc, count, desc, eq, gt, gte, inArray, isNull, like, or, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { db, schema } from "../db";
import { adminProcedure, router } from "../trpc";
import { mediaUrl } from "../lib/media";
import { mediaPath } from "../lib/media-upload";
import { orderNumber } from "../lib/orders";
import { postState, slugify } from "../lib/blog";
import { importLegacyBatch, legacySummary, runLegacySync } from "../lib/legacy-import";
import { getFaq, getPage, listPages, pageSlugs, resetFaq, resetPage, saveFaq, savePage } from "../lib/site-content";

/**
 * Gestión de la tienda desde el admin: catálogo, blog, biblioteca de imágenes y clientes.
 * Los pedidos, cupones y afiliados viven en admin.ts; aquí está todo lo que es contenido.
 */
const { products, productVariants, categories, productCategories, blogPosts, media, orders, orderItems, coaLots } = schema;

const PAID = ["paid", "on_hold", "shipped", "completed"] as const;
const paidWhere = inArray(orders.status, [...PAID]);
const money = z.union([z.number(), z.string()]).transform((v) => Number(v)).pipe(z.number().min(0).max(1_000_000));
const optMoney = z.union([z.number(), z.string(), z.null()]).optional().transform((v) => (v == null || v === "" ? null : Number(v))).pipe(z.number().min(0).max(1_000_000).nullable());
const url = z.string().trim().max(1024);
const id = z.number().int().positive();

/* ============================== Productos ============================== */

const variantInput = z.object({
  id: id.optional(),
  label: z.string().trim().min(1).max(64),
  price: money,
  salePrice: optMoney,
  sku: z.string().trim().max(64).optional().nullable(),
  stockStatus: z.enum(["instock", "outofstock"]).default("instock"),
});

const productInput = z.object({
  id: id.optional(),
  name: z.string().trim().min(1).max(191),
  slug: z.string().trim().max(191).optional(),
  shortDescription: z.string().max(4000).optional().nullable(),
  descriptionHtml: z.string().max(400_000).optional().nullable(),
  price: money,
  salePrice: optMoney,
  imageUrl: url.optional().nullable(),
  gallery: z.array(url).max(12).default([]),
  seoTitle: z.string().trim().max(255).optional().nullable(),
  seoDescription: z.string().trim().max(512).optional().nullable(),
  status: z.enum(["active", "draft"]),
  stockStatus: z.enum(["instock", "outofstock"]),
  featured: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(100_000).default(0),
  categoryIds: z.array(id).max(30).default([]),
  variants: z.array(variantInput).max(30).default([]),
});

const productsRouter = router({
  list: adminProcedure
    .input(z.object({ search: z.string().max(100).optional(), status: z.enum(["active", "draft"]).optional() }).optional())
    .query(async ({ input }) => {
      const where = [];
      if (input?.status) where.push(eq(products.status, input.status));
      if (input?.search?.trim()) {
        const t = `%${input.search.trim()}%`;
        where.push(or(like(products.name, t), like(products.slug, t))!);
      }
      const rows = await db
        .select({
          id: products.id, slug: products.slug, name: products.name, price: products.price, salePrice: products.salePrice, imageUrl: products.imageUrl,
          status: products.status, stockStatus: products.stockStatus, featured: products.featured, sortOrder: products.sortOrder, updatedAt: products.updatedAt,
        })
        .from(products)
        .where(where.length ? and(...where) : undefined)
        .orderBy(asc(products.sortOrder), asc(products.id));
      if (!rows.length) return [];
      const ids = rows.map((r) => r.id);
      const [variantRows, lotRows, soldRows] = await Promise.all([
        db.select({ productId: productVariants.productId, n: count() }).from(productVariants).where(inArray(productVariants.productId, ids)).groupBy(productVariants.productId),
        db.select({ productId: coaLots.productId, n: count() }).from(coaLots).where(inArray(coaLots.productId, ids)).groupBy(coaLots.productId),
        db
          .select({ productId: orderItems.productId, units: sql<string>`COALESCE(SUM(${orderItems.quantity}),0)` })
          .from(orderItems)
          .innerJoin(orders, eq(orders.id, orderItems.orderId))
          .where(and(paidWhere, inArray(orderItems.productId, ids)))
          .groupBy(orderItems.productId),
      ]);
      const pick = <T extends { productId: number | null }>(list: T[], pid: number) => list.find((x) => x.productId === pid);
      return rows.map((r) => ({
        ...r,
        imageUrl: mediaUrl(r.imageUrl),
        variantCount: pick(variantRows, r.id)?.n ?? 0,
        lotCount: pick(lotRows, r.id)?.n ?? 0,
        unitsSold: Number(pick(soldRows, r.id)?.units ?? 0),
      }));
    }),

  get: adminProcedure.input(z.object({ id })).query(async ({ input }) => {
    const [p] = await db.select().from(products).where(eq(products.id, input.id));
    if (!p) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
    const [variants, cats] = await Promise.all([
      db.select().from(productVariants).where(eq(productVariants.productId, p.id)).orderBy(asc(productVariants.sortOrder), asc(productVariants.id)),
      db.select({ categoryId: productCategories.categoryId }).from(productCategories).where(eq(productCategories.productId, p.id)),
    ]);
    return {
      ...p,
      imageUrl: mediaUrl(p.imageUrl),
      gallery: (p.gallery ?? []).map((g) => mediaUrl(g) ?? g),
      variants,
      categoryIds: cats.map((c) => c.categoryId),
    };
  }),

  save: adminProcedure.input(productInput).mutation(async ({ input }) => {
    const slug = slugify(input.slug || input.name);
    if (!slug) throw new TRPCError({ code: "BAD_REQUEST", message: "The product needs a name." });
    const [taken] = await db.select({ id: products.id }).from(products).where(eq(products.slug, slug));
    if (taken && taken.id !== input.id) throw new TRPCError({ code: "CONFLICT", message: `Another product already uses the address "${slug}".` });

    // Con variantes, el precio base es el de la más barata: es el "desde" que muestran las tarjetas
    const base = input.variants.length ? Math.min(...input.variants.map((v) => v.salePrice ?? v.price)) : input.price;
    const values = {
      slug,
      name: input.name,
      shortDescription: input.shortDescription?.trim() || null,
      descriptionHtml: input.descriptionHtml?.trim() || null,
      price: (input.variants.length ? base : input.price).toFixed(2),
      salePrice: input.variants.length || input.salePrice == null ? null : input.salePrice.toFixed(2),
      imageUrl: input.imageUrl || null,
      gallery: input.gallery.filter(Boolean),
      seoTitle: input.seoTitle || null,
      seoDescription: input.seoDescription || null,
      status: input.status,
      stockStatus: input.stockStatus,
      featured: input.featured,
      sortOrder: input.sortOrder,
    };

    return db.transaction(async (tx) => {
      let productId = input.id;
      if (productId) {
        const [exists] = await tx.select({ id: products.id }).from(products).where(eq(products.id, productId));
        if (!exists) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
        await tx.update(products).set(values).where(eq(products.id, productId));
      } else {
        const [res] = await tx.insert(products).values(values);
        productId = res.insertId;
      }

      await tx.delete(productCategories).where(eq(productCategories.productId, productId));
      if (input.categoryIds.length) {
        const valid = await tx.select({ id: categories.id }).from(categories).where(inArray(categories.id, input.categoryIds));
        if (valid.length) await tx.insert(productCategories).values(valid.map((c) => ({ productId: productId!, categoryId: c.id })));
      }

      // Las variantes existentes se actualizan en su sitio: los carritos y los pedidos guardan su id
      const current = await tx.select({ id: productVariants.id }).from(productVariants).where(eq(productVariants.productId, productId));
      const keep = new Set(input.variants.map((v) => v.id).filter((v): v is number => v != null));
      const drop = current.filter((c) => !keep.has(c.id)).map((c) => c.id);
      if (drop.length) await tx.delete(productVariants).where(inArray(productVariants.id, drop));
      for (const [i, v] of input.variants.entries()) {
        const row = {
          productId,
          label: v.label,
          price: v.price.toFixed(2),
          salePrice: v.salePrice == null ? null : v.salePrice.toFixed(2),
          sku: v.sku || null,
          stockStatus: v.stockStatus,
          sortOrder: i,
        };
        if (v.id && current.some((c) => c.id === v.id)) await tx.update(productVariants).set(row).where(eq(productVariants.id, v.id));
        else await tx.insert(productVariants).values(row);
      }
      return { id: productId, slug };
    });
  }),

  /** Cambios rápidos desde el listado, sin abrir la ficha. */
  quick: adminProcedure
    .input(z.object({ id, status: z.enum(["active", "draft"]).optional(), stockStatus: z.enum(["instock", "outofstock"]).optional(), featured: z.boolean().optional() }))
    .mutation(async ({ input }) => {
      const { id: productId, ...set } = input;
      if (!Object.keys(set).length) return { ok: true };
      await db.update(products).set(set).where(eq(products.id, productId));
      return { ok: true };
    }),

  reorder: adminProcedure.input(z.object({ ids: z.array(id).min(1).max(500) })).mutation(async ({ input }) => {
    await db.transaction(async (tx) => {
      for (const [i, pid] of input.ids.entries()) await tx.update(products).set({ sortOrder: i }).where(eq(products.id, pid));
    });
    return { ok: true };
  }),

  remove: adminProcedure.input(z.object({ id })).mutation(async ({ input }) => {
    // Un producto con ventas no se borra: los pedidos lo referencian. Se pasa a borrador.
    const [sold] = await db.select({ n: count() }).from(orderItems).where(eq(orderItems.productId, input.id));
    if ((sold?.n ?? 0) > 0) {
      throw new TRPCError({ code: "CONFLICT", message: "This product appears in past orders, so it can't be deleted. Set it to Draft to hide it from the store." });
    }
    await db.delete(products).where(eq(products.id, input.id));
    return { ok: true };
  }),
});

const categoryInput = z.object({
  id: id.optional(),
  name: z.string().trim().min(1).max(191),
  slug: z.string().trim().max(191).optional(),
  description: z.string().max(2000).optional().nullable(),
  sortOrder: z.number().int().min(0).max(10_000).default(0),
});

const categoriesRouter = router({
  list: adminProcedure.query(async () => {
    const rows = await db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.id));
    const counts = await db.select({ categoryId: productCategories.categoryId, n: count() }).from(productCategories).groupBy(productCategories.categoryId);
    return rows.map((c) => ({ ...c, productCount: counts.find((x) => x.categoryId === c.id)?.n ?? 0 }));
  }),
  save: adminProcedure.input(categoryInput).mutation(async ({ input }) => {
    const slug = slugify(input.slug || input.name);
    const [taken] = await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, slug));
    if (taken && taken.id !== input.id) throw new TRPCError({ code: "CONFLICT", message: `Another category already uses "${slug}".` });
    const values = { slug, name: input.name, description: input.description?.trim() || null, sortOrder: input.sortOrder };
    if (input.id) {
      await db.update(categories).set(values).where(eq(categories.id, input.id));
      return { id: input.id };
    }
    const [res] = await db.insert(categories).values(values);
    return { id: res.insertId };
  }),
  remove: adminProcedure.input(z.object({ id })).mutation(async ({ input }) => {
    await db.delete(categories).where(eq(categories.id, input.id));
    return { ok: true };
  }),
});

/* ============================== Blog ============================== */

const postInput = z.object({
  id: id.optional(),
  title: z.string().trim().min(1).max(255),
  slug: z.string().trim().max(191).optional(),
  excerpt: z.string().max(1000).optional().nullable(),
  bodyHtml: z.string().max(600_000),
  coverImage: url.optional().nullable(),
  coverAlt: z.string().trim().max(255).optional().nullable(),
  category: z.string().trim().max(80).optional().nullable(),
  targetKeyword: z.string().trim().max(191).optional().nullable(),
  seoTitle: z.string().trim().max(255).optional().nullable(),
  seoDescription: z.string().trim().max(512).optional().nullable(),
  status: z.enum(["draft", "published"]),
  publishedAt: z.date().optional().nullable(),
});

const blogRouter = router({
  list: adminProcedure.input(z.object({ search: z.string().max(100).optional() }).optional()).query(async ({ input }) => {
    const cond = input?.search?.trim() ? or(like(blogPosts.title, `%${input.search.trim()}%`), like(blogPosts.slug, `%${input.search.trim()}%`)) : undefined;
    const rows = await db
      .select({
        id: blogPosts.id, slug: blogPosts.slug, title: blogPosts.title, category: blogPosts.category, coverImage: blogPosts.coverImage,
        status: blogPosts.status, publishedAt: blogPosts.publishedAt, updatedAt: blogPosts.updatedAt, seoDescription: blogPosts.seoDescription,
      })
      .from(blogPosts)
      .where(cond)
      // Borradores arriba, luego lo programado y lo publicado por fecha
      .orderBy(sql`${blogPosts.publishedAt} IS NULL DESC`, desc(blogPosts.publishedAt), desc(blogPosts.id));
    const now = new Date();
    return rows.map((r) => ({ ...r, state: postState(r, now) }));
  }),

  get: adminProcedure.input(z.object({ id })).query(async ({ input }) => {
    const [p] = await db.select().from(blogPosts).where(eq(blogPosts.id, input.id));
    if (!p) throw new TRPCError({ code: "NOT_FOUND", message: "Article not found" });
    return { ...p, state: postState(p) };
  }),

  categories: adminProcedure.query(async () => {
    const rows = await db.selectDistinct({ category: blogPosts.category }).from(blogPosts);
    return rows.map((r) => r.category).filter((c): c is string => Boolean(c)).sort();
  }),

  save: adminProcedure.input(postInput).mutation(async ({ input }) => {
    const slug = slugify(input.slug || input.title);
    if (!slug) throw new TRPCError({ code: "BAD_REQUEST", message: "The article needs a title." });
    const [taken] = await db.select({ id: blogPosts.id }).from(blogPosts).where(eq(blogPosts.slug, slug));
    if (taken && taken.id !== input.id) throw new TRPCError({ code: "CONFLICT", message: `Another article already uses the address "${slug}".` });
    const values = {
      slug,
      title: input.title,
      excerpt: input.excerpt?.trim() || null,
      bodyHtml: input.bodyHtml,
      coverImage: input.coverImage || null,
      coverAlt: input.coverAlt || null,
      category: input.category || null,
      targetKeyword: input.targetKeyword || null,
      seoTitle: input.seoTitle || null,
      seoDescription: input.seoDescription || null,
      status: input.status,
      // Publicar sin fecha significa "ahora"; un borrador conserva la fecha que tuviera prevista
      publishedAt: input.status === "published" ? (input.publishedAt ?? new Date()) : (input.publishedAt ?? null),
    };
    if (input.id) {
      await db.update(blogPosts).set(values).where(eq(blogPosts.id, input.id));
      return { id: input.id, slug };
    }
    const [res] = await db.insert(blogPosts).values(values);
    return { id: res.insertId, slug };
  }),

  remove: adminProcedure.input(z.object({ id })).mutation(async ({ input }) => {
    await db.delete(blogPosts).where(eq(blogPosts.id, input.id));
    return { ok: true };
  }),
});

/* ============================== Biblioteca de imágenes ============================== */

/** Dónde se está usando una imagen, para no dejar huecos al borrarla. */
async function mediaUsage(path: string) {
  const t = `%${path}%`;
  const [inProducts, inPosts] = await Promise.all([
    db.select({ id: products.id, name: products.name }).from(products).where(or(like(products.imageUrl, t), sql`CAST(${products.gallery} AS CHAR) LIKE ${t}`, like(products.descriptionHtml, t))),
    db.select({ id: blogPosts.id, title: blogPosts.title }).from(blogPosts).where(or(like(blogPosts.coverImage, t), like(blogPosts.bodyHtml, t))),
  ]);
  return [...inProducts.map((p) => `Product: ${p.name}`), ...inPosts.map((p) => `Article: ${p.title}`)];
}

const mediaRouter = router({
  list: adminProcedure
    .input(z.object({ page: z.number().int().min(1).default(1), pageSize: z.number().int().min(6).max(120).default(48), search: z.string().max(100).optional() }).optional())
    .query(async ({ input }) => {
      const page = input?.page ?? 1;
      const pageSize = input?.pageSize ?? 48;
      const cond = input?.search?.trim() ? or(like(media.filename, `%${input.search.trim()}%`), like(media.alt, `%${input.search.trim()}%`)) : undefined;
      const [total] = await db.select({ n: count(), bytes: sql<string>`COALESCE(SUM(${media.size}),0)` }).from(media).where(cond);
      // Nunca se selecciona la columna con el archivo: el listado solo necesita los datos de la ficha
      const rows = await db
        .select({ id: media.id, filename: media.filename, mime: media.mime, size: media.size, width: media.width, height: media.height, alt: media.alt, createdAt: media.createdAt })
        .from(media)
        .where(cond)
        .orderBy(desc(media.id))
        .limit(pageSize)
        .offset((page - 1) * pageSize);
      return { total: total?.n ?? 0, bytes: Number(total?.bytes ?? 0), items: rows.map((r) => ({ ...r, url: mediaPath(r.id, r.filename) })) };
    }),

  /** Cuántos archivos siguen cargándose desde el WordPress anterior. */
  legacyStatus: adminProcedure.query(() => legacySummary()),

  /** Copia una tanda de esos archivos a la base y reescribe sus referencias. */
  importLegacy: adminProcedure.input(z.object({ skip: z.array(z.string().max(1024)).max(500).default([]) })).mutation(({ input }) => importLegacyBatch(input.skip)),

  /** Reintenta lo que falte, incluidos los certificados guardados que no están en ningún lote. */
  syncLegacy: adminProcedure.mutation(async () => {
    await runLegacySync({ manual: true });
    return legacySummary();
  }),

  update: adminProcedure.input(z.object({ id, alt: z.string().trim().max(255) })).mutation(async ({ input }) => {
    await db.update(media).set({ alt: input.alt || null }).where(eq(media.id, input.id));
    return { ok: true };
  }),

  remove: adminProcedure.input(z.object({ id, force: z.boolean().default(false) })).mutation(async ({ input }) => {
    const [m] = await db.select({ id: media.id, filename: media.filename }).from(media).where(eq(media.id, input.id));
    if (!m) return { ok: true, usedIn: [] as string[] };
    const usedIn = await mediaUsage(`/media/u/${m.id}/`);
    if (usedIn.length && !input.force) return { ok: false, usedIn };
    await db.delete(media).where(eq(media.id, input.id));
    return { ok: true, usedIn };
  }),
});

/* ============================== Páginas y FAQ ============================== */

const pageSlug = z.string().max(64).refine((s) => pageSlugs().includes(s), "Unknown page");

const pagesRouter = router({
  list: adminProcedure.query(() => listPages()),
  get: adminProcedure.input(z.object({ slug: pageSlug })).query(async ({ input }) => (await getPage(input.slug))!),
  save: adminProcedure.input(z.object({ slug: pageSlug, title: z.string().trim().min(1).max(191), html: z.string().max(300_000) })).mutation(async ({ input }) => {
    await savePage(input.slug, { title: input.title, html: input.html });
    return { ok: true };
  }),
  /** Vuelve al texto original que viene con la tienda. */
  reset: adminProcedure.input(z.object({ slug: pageSlug })).mutation(async ({ input }) => {
    await resetPage(input.slug);
    return { ok: true };
  }),
  faq: adminProcedure.query(() => getFaq()),
  saveFaq: adminProcedure
    .input(z.object({ items: z.array(z.object({ section: z.string().trim().min(1).max(80), q: z.string().trim().min(1).max(300), a: z.string().trim().min(1).max(20_000) })).max(200) }))
    .mutation(async ({ input }) => {
      await saveFaq(input.items);
      return { ok: true };
    }),
  resetFaq: adminProcedure.mutation(async () => {
    await resetFaq();
    return { ok: true };
  }),
});

/* ============================== Clientes ============================== */

const customersRouter = router({
  list: adminProcedure
    .input(z.object({ page: z.number().int().min(1).default(1), pageSize: z.number().int().min(5).max(5000).default(25), search: z.string().max(100).optional(), sort: z.enum(["recent", "spent", "orders"]).default("recent") }))
    .query(async ({ input }) => {
      const t = input.search?.trim() ? `%${input.search.trim()}%` : null;
      const cond = t ? or(like(orders.email, t), like(orders.firstName, t), like(orders.lastName, t), like(orders.city, t)) : undefined;
      const paidSum = sql<string>`COALESCE(SUM(CASE WHEN ${orders.status} IN ('paid','on_hold','shipped','completed') THEN ${orders.total} ELSE 0 END),0)`;
      const paidCount = sql<number>`SUM(CASE WHEN ${orders.status} IN ('paid','on_hold','shipped','completed') THEN 1 ELSE 0 END)`;
      const [total] = await db.select({ n: sql<number>`COUNT(DISTINCT ${orders.email})` }).from(orders).where(cond);
      const order = input.sort === "spent" ? desc(paidSum) : input.sort === "orders" ? desc(paidCount) : desc(sql`MAX(${orders.id})`);
      const rows = await db
        .select({
          email: orders.email,
          lastOrderId: sql<number>`MAX(${orders.id})`,
          firstOrderAt: sql<Date>`MIN(${orders.createdAt})`,
          lastOrderAt: sql<Date>`MAX(${orders.createdAt})`,
          orders: count(),
          paidOrders: paidCount,
          spent: paidSum,
        })
        .from(orders)
        .where(cond)
        .groupBy(orders.email)
        .orderBy(order)
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize);
      if (!rows.length) return { total: Number(total?.n ?? 0), customers: [] };
      // Nombre, teléfono y ciudad: los del pedido más reciente de cada cliente
      const latest = await db
        .select({ id: orders.id, firstName: orders.firstName, lastName: orders.lastName, phone: orders.phone, city: orders.city, state: orders.state })
        .from(orders)
        .where(inArray(orders.id, rows.map((r) => Number(r.lastOrderId))));
      return {
        total: Number(total?.n ?? 0),
        customers: rows.map((r) => {
          const l = latest.find((x) => x.id === Number(r.lastOrderId));
          return {
            email: r.email,
            name: l ? `${l.firstName} ${l.lastName}`.trim() : "",
            phone: l?.phone ?? null,
            location: l ? `${l.city}, ${l.state}` : "",
            orders: r.orders,
            paidOrders: Number(r.paidOrders ?? 0),
            spent: Number(r.spent ?? 0),
            firstOrderAt: new Date(r.firstOrderAt),
            lastOrderAt: new Date(r.lastOrderAt),
          };
        }),
      };
    }),

  get: adminProcedure.input(z.object({ email: z.string().max(191) })).query(async ({ input }) => {
    const rows = await db
      .select({
        id: orders.id, status: orders.status, total: orders.total, createdAt: orders.createdAt, firstName: orders.firstName, lastName: orders.lastName,
        phone: orders.phone, address1: orders.address1, address2: orders.address2, city: orders.city, state: orders.state, zip: orders.zip, couponCode: orders.couponCode,
      })
      .from(orders)
      .where(eq(orders.email, input.email))
      .orderBy(desc(orders.id))
      .limit(100);
    if (!rows.length) throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });
    const paid = rows.filter((o) => (PAID as readonly string[]).includes(o.status));
    const [lead] = await db.select({ id: schema.leads.id }).from(schema.leads).where(eq(schema.leads.email, input.email));
    const items = await db
      .select({ name: orderItems.name, quantity: sql<string>`SUM(${orderItems.quantity})` })
      .from(orderItems)
      .where(inArray(orderItems.orderId, paid.length ? paid.map((o) => o.id) : [0]))
      .groupBy(orderItems.name)
      .orderBy(desc(sql`SUM(${orderItems.quantity})`))
      .limit(6);
    const last = rows[0]!;
    return {
      email: input.email,
      name: `${last.firstName} ${last.lastName}`.trim(),
      phone: last.phone,
      address: [last.address1, last.address2, `${last.city}, ${last.state} ${last.zip}`].filter(Boolean).join(" · "),
      subscribed: Boolean(lead),
      spent: paid.reduce((s, o) => s + Number(o.total), 0),
      paidOrders: paid.length,
      favorites: items.map((i) => ({ name: i.name, quantity: Number(i.quantity) })),
      orders: rows.map((o) => ({ id: o.id, number: orderNumber(o.id), status: o.status, total: o.total, createdAt: o.createdAt, couponCode: o.couponCode })),
    };
  }),
});

/* ============================== Resumen de la tienda ============================== */

const insightsRouter = router({
  /** Datos de catálogo, contenido y clientes para el panel principal. */
  store: adminProcedure.query(async () => {
    const now = new Date();
    const d30 = new Date(now.getTime() - 30 * 86_400_000);
    const [productRows, postRows, mediaRow, customerRow, repeatRow, top, noLots] = await Promise.all([
      db.select({ status: products.status, stock: products.stockStatus, n: count() }).from(products).groupBy(products.status, products.stockStatus),
      db.select({ status: blogPosts.status, publishedAt: blogPosts.publishedAt }).from(blogPosts),
      db.select({ n: count(), bytes: sql<string>`COALESCE(SUM(${media.size}),0)` }).from(media),
      db.select({ n: sql<number>`COUNT(DISTINCT ${orders.email})` }).from(orders).where(paidWhere),
      db
        .select({ n: count() })
        .from(db.select({ email: orders.email }).from(orders).where(paidWhere).groupBy(orders.email).having(gt(count(), 1)).as("r")),
      db
        .select({ name: orderItems.name, units: sql<string>`SUM(${orderItems.quantity})`, revenue: sql<string>`SUM(${orderItems.lineTotal})` })
        .from(orderItems)
        .innerJoin(orders, eq(orders.id, orderItems.orderId))
        .where(and(paidWhere, gte(orders.createdAt, d30)))
        .groupBy(orderItems.name)
        .orderBy(desc(sql`SUM(${orderItems.lineTotal})`))
        .limit(6),
      // Productos a la venta que todavía no tienen ningún certificado publicado
      db
        .select({ id: products.id, name: products.name })
        .from(products)
        .leftJoin(coaLots, eq(coaLots.productId, products.id))
        .where(and(eq(products.status, "active"), isNull(coaLots.id)))
        .limit(20),
    ]);
    const sum = (f: (r: (typeof productRows)[number]) => boolean) => productRows.filter(f).reduce((s, r) => s + r.n, 0);
    const posts = postRows.map((p) => postState(p, now));
    const nextScheduled = postRows
      .filter((p) => p.status === "published" && p.publishedAt && p.publishedAt > now)
      .map((p) => p.publishedAt!)
      .sort((a, b) => a.getTime() - b.getTime())[0];
    const customers = Number(customerRow[0]?.n ?? 0);
    return {
      products: { active: sum((r) => r.status === "active"), draft: sum((r) => r.status === "draft"), outOfStock: sum((r) => r.status === "active" && r.stock === "outofstock") },
      blog: { live: posts.filter((s) => s === "live").length, scheduled: posts.filter((s) => s === "scheduled").length, draft: posts.filter((s) => s === "draft").length, nextScheduled: nextScheduled ?? null },
      media: { count: mediaRow[0]?.n ?? 0, bytes: Number(mediaRow[0]?.bytes ?? 0) },
      customers: { total: customers, repeat: repeatRow[0]?.n ?? 0 },
      topProducts: top.map((t) => ({ name: t.name, units: Number(t.units), revenue: Number(t.revenue) })),
      missingCoa: noLots,
    };
  }),
});

export const adminStoreRouters = {
  products: productsRouter,
  categories: categoriesRouter,
  blog: blogRouter,
  media: mediaRouter,
  pages: pagesRouter,
  customers: customersRouter,
  insights: insightsRouter,
};
