import { count, eq } from "drizzle-orm";
import { db, schema } from "./index";
import catalog from "../data/catalog.json";
import content from "../data/content.json";
import { hashPassword } from "../lib/auth";

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

/** Cupones que existían en WooCommerce. */
const wpCoupons: { code: string; amount: string; expiresAt?: Date; usageCount?: number }[] = [
  { code: "summer30", amount: "30" },
  { code: "karie3", amount: "20" },
  { code: "jesa2026", amount: "20" },
  { code: "sulwe70", amount: "20" },
  { code: "kayt26", amount: "20" },
  { code: "ragnar88", amount: "20" },
  { code: "50% off this weekend", amount: "50", expiresAt: new Date(1787457600 * 1000), usageCount: 4 },
  { code: "zaid850", amount: "20", usageCount: 2 },
];

async function isEmpty(table: typeof schema.coupons | typeof schema.coaLots | typeof schema.products) {
  const [row] = await db.select({ n: count() }).from(table);
  return (row?.n ?? 0) === 0;
}

/** Siembra cada bloque de datos solo si su tabla está vacía. Seguro de correr en cada arranque. */
export async function seedIfEmpty() {
  if (await isEmpty(schema.products)) await seedCatalog();
  else {
    // Mantiene los nombres de categoría al día con el archivo
    for (const c of catalog.categories) {
      await db.update(schema.categories).set({ name: c.name }).where(eq(schema.categories.slug, c.slug));
    }
  }

  if (await isEmpty(schema.coupons)) {
    await db.insert(schema.coupons).values(wpCoupons.map((c) => ({ ...c, type: "percent" as const })));
    console.log(`[seed] ${wpCoupons.length} cupones`);
  }

  await seedCoaLots();
}

/**
 * Crea el primer administrador con ADMIN_EMAIL y ADMIN_PASSWORD si todavía no hay ninguno.
 * Después la contraseña se cambia desde Admin → Settings (la variable ya no se usa).
 */
export async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const [row] = await db.select({ n: count() }).from(schema.admins);
  if ((row?.n ?? 0) > 0) return;
  if (!email || !password) {
    console.warn("[seed] No hay administradores. Define ADMIN_EMAIL y ADMIN_PASSWORD para crear el primero.");
    return;
  }
  if (password.length < 10) {
    console.warn("[seed] ADMIN_PASSWORD debe tener al menos 10 caracteres; no se creó el administrador.");
    return;
  }
  await db.insert(schema.admins).values({ email, passwordHash: hashPassword(password), name: "Admin" });
  console.log(`[seed] administrador creado: ${email}`);
}

/**
 * Carga los lotes con los datos leídos de cada certificado (importador de COA de WordPress).
 * Corre si no hay lotes, o si solo existen los enlaces simples "Current batch" de la versión anterior.
 */
async function seedCoaLots() {
  const existing = await db.select({ lot: schema.coaLots.lotNumber }).from(schema.coaLots);
  const onlyPlaceholders = existing.every((r) => r.lot === "Current batch");
  if (existing.length && !onlyPlaceholders) return;

  const products = await db.select({ id: schema.products.id, slug: schema.products.slug }).from(schema.products);
  const bySlug = new Map(products.map((r) => [r.slug, r.id]));
  const detailed = content.coaLots.filter((l) => bySlug.has(l.productSlug));
  const withLots = new Set(detailed.map((l) => l.productSlug));

  const rows: (typeof schema.coaLots.$inferInsert)[] = detailed.map((l) => ({
    productId: bySlug.get(l.productSlug)!,
    lotNumber: l.lotNumber,
    title: l.title || null,
    purity: l.purity || null,
    specPurity: l.specPurity || null,
    appearance: l.appearance || null,
    identity: l.identity || null,
    measured: l.measured || null,
    heavyMetals: l.heavyMetals || null,
    endotoxin: l.endotoxin || null,
    testedAt: l.testedAt,
    reportUrl: l.reportUrl,
    latest: l.latest,
  }));
  // Productos sin datos leídos: se conserva el enlace al PDF
  for (const c of content.coas) {
    const productId = bySlug.get(c.productSlug);
    if (productId && !withLots.has(c.productSlug)) rows.push({ productId, lotNumber: "Current batch", reportUrl: c.pdfUrl, latest: true });
  }

  if (existing.length) await db.delete(schema.coaLots);
  if (rows.length) await db.insert(schema.coaLots).values(rows);
  console.log(`[seed] ${detailed.length} lotes con datos de COA y ${rows.length - detailed.length} enlaces sin datos`);
}
