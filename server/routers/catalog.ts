import { z } from "zod";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { db, schema } from "../db";
import { publicProcedure, router } from "../trpc";
import { mediaUrl } from "../lib/media";

const { products, productVariants, categories, productCategories, coaLots } = schema;

async function variantsFor(ids: number[]) {
  if (!ids.length) return new Map<number, (typeof productVariants.$inferSelect)[]>();
  const rows = await db.select().from(productVariants).where(inArray(productVariants.productId, ids)).orderBy(asc(productVariants.sortOrder));
  const map = new Map<number, typeof rows>();
  for (const r of rows) map.set(r.productId, [...(map.get(r.productId) ?? []), r]);
  return map;
}

export const catalogRouter = router({
  categories: publicProcedure.query(() => db.select().from(categories).orderBy(asc(categories.sortOrder))),

  products: publicProcedure
    .input(z.object({ category: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const where = [eq(products.status, "active")];
      if (input?.category) {
        const linked = await db
          .select({ id: productCategories.productId })
          .from(productCategories)
          .innerJoin(categories, eq(categories.id, productCategories.categoryId))
          .where(eq(categories.slug, input.category));
        if (!linked.length) return [];
        where.push(inArray(products.id, linked.map((l) => l.id)));
      }
      const rows = await db
        .select({
          id: products.id, slug: products.slug, name: products.name, price: products.price,
          salePrice: products.salePrice, imageUrl: products.imageUrl, stockStatus: products.stockStatus,
        })
        .from(products)
        .where(and(...where))
        .orderBy(asc(products.sortOrder));
      const vmap = await variantsFor(rows.map((r) => r.id));
      return rows.map((r) => ({ ...r, imageUrl: mediaUrl(r.imageUrl), variantCount: vmap.get(r.id)?.length ?? 0 }));
    }),

  productBySlug: publicProcedure.input(z.object({ slug: z.string().min(1).max(191) })).query(async ({ input }) => {
    const [product] = await db.select().from(products).where(and(eq(products.slug, input.slug), eq(products.status, "active")));
    if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Producto no encontrado" });
    const [variants, cats, coas] = await Promise.all([
      variantsFor([product.id]).then((m) => m.get(product.id) ?? []),
      db.select({ slug: categories.slug, name: categories.name }).from(productCategories)
        .innerJoin(categories, eq(categories.id, productCategories.categoryId))
        .where(eq(productCategories.productId, product.id)),
      db.select().from(coaLots).where(eq(coaLots.productId, product.id)).orderBy(desc(coaLots.latest), desc(coaLots.testedAt), desc(coaLots.id)),
    ]);
    return { ...product, imageUrl: mediaUrl(product.imageUrl), gallery: (product.gallery ?? []).map((g) => mediaUrl(g) ?? g), variants, categories: cats, coas };
  }),
});
