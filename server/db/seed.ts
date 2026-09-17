import { count, eq } from "drizzle-orm";
import { db, schema } from "./index";
import catalog from "../data/catalog.json";

type CatalogProduct = (typeof catalog.products)[number];

const money = (v: string | null | undefined) => (v == null || v === "" ? null : Number(v).toFixed(2));

/**
 * Carga el catálogo migrado de WooCommerce.
 * Solo inserta productos cuyo slug no existe: nunca pisa ediciones hechas después desde el admin.
 */
export async function seedCatalog() {
  const catIds = new Map<string, number>();
  for (const [i, c] of catalog.categories.entries()) {
    await db
      .insert(schema.categories)
      .values({ slug: c.slug, name: c.name, description: c.description || null, sortOrder: i })
      .onDuplicateKeyUpdate({ set: { name: c.name } });
    const [row] = await db.select({ id: schema.categories.id }).from(schema.categories).where(eq(schema.categories.slug, c.slug));
    if (row) catIds.set(c.slug, row.id);
  }

  let inserted = 0;
  for (const [i, p] of (catalog.products as CatalogProduct[]).entries()) {
    const values = {
      slug: p.slug,
      name: p.name,
      shortDescription: p.shortDescription || null,
      descriptionHtml: p.descriptionHtml || null,
      price: money(p.price) ?? "0.00",
      salePrice: money(p.salePrice),
      imageUrl: p.imageUrl,
      gallery: p.gallery,
      seoTitle: p.seoTitle,
      seoDescription: p.seoDescription,
      sortOrder: i,
      wpId: p.wpId,
    };
    const [existing] = await db.select({ id: schema.products.id }).from(schema.products).where(eq(schema.products.slug, p.slug));
    if (existing) continue;
    await db.insert(schema.products).values(values);
    const [row] = await db.select({ id: schema.products.id }).from(schema.products).where(eq(schema.products.slug, p.slug));
    if (!row) continue;
    inserted++;

    const links = p.categories.map((s) => catIds.get(s)).filter((id): id is number => id != null);
    if (links.length) await db.insert(schema.productCategories).values(links.map((categoryId) => ({ productId: row.id, categoryId })));

    if (p.variants.length) {
      await db.insert(schema.productVariants).values(
        p.variants.map((v, j) => ({
          productId: row.id,
          label: v.label,
          price: money(v.price) ?? "0.00",
          salePrice: money(v.salePrice),
          sku: v.sku,
          sortOrder: j,
          wpId: v.wpId,
        })),
      );
    }
  }
  console.log(`[seed] ${catalog.categories.length} categorías, ${inserted} productos nuevos`);
}

/** En el primer arranque (tabla vacía) carga el catálogo automáticamente. */
export async function seedIfEmpty() {
  const [row] = await db.select({ n: count() }).from(schema.products);
  if ((row?.n ?? 0) === 0) await seedCatalog();
}
