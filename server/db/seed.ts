import fs from "node:fs";
import path from "node:path";
import { count, eq } from "drizzle-orm";
import { db, schema } from "./index";
import catalog from "../data/catalog.json";
import content from "../data/content.json";
import blog from "../data/blog-posts.json";
import { hashPassword, verifyPassword } from "../lib/auth";

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
  await seedBlog();
  await seedProductPhotos();
}

/**
 * Carga en la biblioteca las fotos de producto propias y se las asigna a cada producto.
 *
 * Las fotos viajan con el código (server/data/product-photos, ya optimizadas en WebP) y al arrancar se
 * copian una sola vez a la tabla `media`, que es el almacenamiento de la tienda. Desde ahí son una
 * imagen más de la biblioteca: se ven en el admin y se pueden cambiar. Con esto las fichas dejan de
 * cargar la foto del WordPress anterior.
 *
 * No pisa nada que ya se haya cambiado: solo toca productos sin foto o cuya foto siga apuntando a
 * WordPress, y queda anotado en settings para no repetirse en cada deploy.
 */
const PHOTOS_SEED_KEY = "productPhotosV1";
const PHOTOS_DIR = path.resolve(process.cwd(), "server/data/product-photos");
type PhotoEntry = { slug: string; file: string; width: number; height: number; alt: string };

async function seedProductPhotos() {
  const [done] = await db.select({ key: schema.settings.key }).from(schema.settings).where(eq(schema.settings.key, PHOTOS_SEED_KEY));
  if (done) return;
  const manifestFile = path.join(PHOTOS_DIR, "manifest.json");
  if (!fs.existsSync(manifestFile)) {
    console.warn("[seed] no se encontró server/data/product-photos; las fotos de producto no se cargaron");
    return;
  }
  const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8")) as PhotoEntry[];
  const isLegacy = (url: string | null) => !url || /\/wp-content\/uploads\//i.test(url) || url.startsWith("/media/wp/");
  let assigned = 0;
  for (const entry of manifest) {
    const [product] = await db.select({ id: schema.products.id, imageUrl: schema.products.imageUrl, gallery: schema.products.gallery }).from(schema.products).where(eq(schema.products.slug, entry.slug));
    const file = path.join(PHOTOS_DIR, entry.file);
    if (!product || !isLegacy(product.imageUrl) || !fs.existsSync(file)) continue;
    const data = fs.readFileSync(file);
    const [ins] = await db.insert(schema.media).values({ filename: entry.file, mime: "image/webp", size: data.length, width: entry.width, height: entry.height, alt: entry.alt, data });
    await db
      .update(schema.products)
      .set({ imageUrl: `/media/u/${ins.insertId}/${entry.file}`, gallery: (product.gallery ?? []).filter((g) => !isLegacy(g)) })
      .where(eq(schema.products.id, product.id));
    assigned++;
  }
  await db.insert(schema.settings).values({ key: PHOTOS_SEED_KEY, value: { at: new Date().toISOString(), assigned } });
  console.log(`[seed] ${assigned} fotos de producto cargadas en la biblioteca`);
}

/**
 * Carga los artículos del primer mes del blog, cada uno con la fecha de su calendario editorial.
 *
 * Se hace una sola vez: queda anotado en settings. Si no fuera así, un artículo borrado a propósito
 * desde el admin volvería a aparecer en el siguiente deploy. Tampoco pisa artículos que ya existan
 * con la misma dirección.
 */
const BLOG_SEED_KEY = "blogSeedMonth1";
async function seedBlog() {
  const [done] = await db.select({ key: schema.settings.key }).from(schema.settings).where(eq(schema.settings.key, BLOG_SEED_KEY));
  if (done) return;
  let inserted = 0;
  for (const p of blog.posts) {
    const [exists] = await db.select({ id: schema.blogPosts.id }).from(schema.blogPosts).where(eq(schema.blogPosts.slug, p.slug));
    if (exists) continue;
    await db.insert(schema.blogPosts).values({
      slug: p.slug,
      title: p.title,
      excerpt: p.excerpt,
      bodyHtml: p.bodyHtml,
      category: p.category,
      targetKeyword: p.targetKeyword,
      seoDescription: p.seoDescription,
      status: "published",
      publishedAt: new Date(p.publishedAt),
    });
    inserted++;
  }
  await db.insert(schema.settings).values({ key: BLOG_SEED_KEY, value: { at: new Date().toISOString(), inserted } });
  console.log(`[seed] ${inserted} artículos del blog`);
}

/**
 * Administrador a partir de ADMIN_EMAIL y ADMIN_PASSWORD.
 *
 * Las variables mandan cuando cambian: al arrancar se comparan con las que se aplicaron la última vez
 * y, si son distintas (o nunca se aplicaron), se crea esa cuenta o se le pone esa contraseña. Así,
 * cambiar la clave en Railway surte efecto, y recuperar un acceso perdido es cambiar la variable.
 * Mientras no cambien, no se toca nada: una contraseña cambiada desde Settings se conserva.
 *
 * Lo aplicado se recuerda como un hash con sal (igual que las contraseñas), nunca en claro.
 */
const ADMIN_ENV_KEY = "adminEnvApplied";

/** Por qué las variables no se pudieron aplicar, para decirlo en la pantalla de acceso. */
export let adminSetupIssue: "missing" | "email" | "short" | null = null;

export async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD?.trim();
  const [row] = await db.select({ n: count() }).from(schema.admins);
  const none = (row?.n ?? 0) === 0;
  adminSetupIssue = null;
  if (!email || !password) {
    if (none) {
      adminSetupIssue = "missing";
      console.warn("[seed] No hay administradores. Define ADMIN_EMAIL y ADMIN_PASSWORD para crear el primero.");
    }
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    adminSetupIssue = "email";
    console.warn("[seed] ADMIN_EMAIL no es un correo válido; no se aplicó.");
    return;
  }
  if (password.length < 10) {
    adminSetupIssue = "short";
    console.warn("[seed] ADMIN_PASSWORD debe tener al menos 10 caracteres; no se aplicó.");
    return;
  }

  const stamp = `${email}\n${password}`;
  const [applied] = await db.select({ value: schema.settings.value }).from(schema.settings).where(eq(schema.settings.key, ADMIN_ENV_KEY));
  const hash = (applied?.value as { hash?: string } | undefined)?.hash;
  const [existing] = await db.select({ id: schema.admins.id }).from(schema.admins).where(eq(schema.admins.email, email));
  if (existing && verifyPassword(stamp, hash)) return;

  if (existing) await db.update(schema.admins).set({ passwordHash: hashPassword(password) }).where(eq(schema.admins.id, existing.id));
  else await db.insert(schema.admins).values({ email, passwordHash: hashPassword(password), name: "Admin" });
  const value = { hash: hashPassword(stamp), at: new Date().toISOString() };
  await db.insert(schema.settings).values({ key: ADMIN_ENV_KEY, value }).onDuplicateKeyUpdate({ set: { value } });
  console.log(`[seed] administrador ${existing ? "actualizado" : "creado"} desde las variables: ${email}`);
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
