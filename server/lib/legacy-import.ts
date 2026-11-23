import { eq, like, sql } from "drizzle-orm";
import { db, schema } from "../db";
import { fetchOriginal } from "./media";
import { mediaPath, safeName, sniffImage } from "./media-upload";

/**
 * Trae a la base de datos los archivos que todavía viven en el WordPress anterior.
 *
 * Las fotos de producto se sirven a través de un proxy que las descarga de peptivasupplies.com, y los
 * PDF de los certificados enlazan directo a su carpeta de uploads. Mientras el dominio apunte a
 * WordPress eso funciona; el día que apunte a esta tienda, esas direcciones dejan de existir. Este
 * importador copia cada archivo una vez (fotos a la biblioteca, PDF a los archivos de COA) y
 * reescribe las referencias, de modo que la tienda deja de depender del servidor antiguo.
 *
 * Trabaja por tandas pequeñas para que ninguna llamada se acerque al límite de tiempo.
 */
const ORIGIN = (process.env.MEDIA_ORIGIN || "https://peptivasupplies.com").replace(/\/$/, "");
const WP_URL = /https?:\/\/(?:www\.)?peptivasupplies\.com\/wp-content\/uploads\/[\w\-./%]+?\.(?:png|jpe?g|webp|gif|avif|pdf)/gi;
const relOf = (url: string) => url.replace(/^https?:\/\/(?:www\.)?peptivasupplies\.com\/wp-content\/uploads\//i, "");
const isPdf = (url: string) => /\.pdf$/i.test(url);

/** Todas las direcciones del WordPress antiguo que siguen referenciadas en la tienda. */
export async function legacyReferences(): Promise<{ images: string[]; pdfs: string[] }> {
  const t = "%/wp-content/uploads/%";
  const [prods, lots, posts] = await Promise.all([
    db.select({ imageUrl: schema.products.imageUrl, gallery: schema.products.gallery, descriptionHtml: schema.products.descriptionHtml }).from(schema.products),
    db.select({ reportUrl: schema.coaLots.reportUrl }).from(schema.coaLots).where(like(schema.coaLots.reportUrl, t)),
    db.select({ bodyHtml: schema.blogPosts.bodyHtml, coverImage: schema.blogPosts.coverImage }).from(schema.blogPosts),
  ]);
  const found = new Set<string>();
  const scan = (text: string | null | undefined) => {
    for (const m of (text ?? "").matchAll(WP_URL)) found.add(m[0]);
  };
  for (const p of prods) {
    scan(p.imageUrl);
    for (const g of p.gallery ?? []) scan(g);
    scan(p.descriptionHtml);
  }
  for (const l of lots) scan(l.reportUrl);
  for (const b of posts) {
    scan(b.bodyHtml);
    scan(b.coverImage);
  }
  const all = [...found].sort();
  return { images: all.filter((u) => !isPdf(u)), pdfs: all.filter(isPdf) };
}

/** Sustituye una dirección antigua por la nueva en todos los sitios donde aparece. */
async function rewrite(oldUrl: string, newUrl: string) {
  const t = `%${oldUrl}%`;
  await db.update(schema.products).set({ imageUrl: newUrl }).where(eq(schema.products.imageUrl, oldUrl));
  await db.update(schema.coaLots).set({ reportUrl: newUrl }).where(eq(schema.coaLots.reportUrl, oldUrl));
  await db.update(schema.blogPosts).set({ coverImage: newUrl }).where(eq(schema.blogPosts.coverImage, oldUrl));
  await db.update(schema.blogPosts).set({ bodyHtml: sql`REPLACE(${schema.blogPosts.bodyHtml}, ${oldUrl}, ${newUrl})` }).where(like(schema.blogPosts.bodyHtml, t));
  await db.update(schema.products).set({ descriptionHtml: sql`REPLACE(${schema.products.descriptionHtml}, ${oldUrl}, ${newUrl})` }).where(like(schema.products.descriptionHtml, t));
  // La galería es JSON: se reescribe elemento a elemento
  const withGallery = await db.select({ id: schema.products.id, gallery: schema.products.gallery }).from(schema.products).where(sql`CAST(${schema.products.gallery} AS CHAR) LIKE ${t}`);
  for (const p of withGallery) {
    await db.update(schema.products).set({ gallery: (p.gallery ?? []).map((g) => (g === oldUrl ? newUrl : g)) }).where(eq(schema.products.id, p.id));
  }
}

async function importImage(url: string): Promise<string> {
  const rel = relOf(url);
  const buf = await fetchOriginal(decodeURIComponent(rel));
  if (!buf) throw new Error("could not be downloaded");
  const kind = sniffImage(buf);
  if (!kind) throw new Error("is not a supported image format");
  const filename = safeName(rel.split("/").pop() ?? "image", kind.ext);
  const [ins] = await db.insert(schema.media).values({ filename, mime: kind.mime, size: buf.length, data: buf });
  return mediaPath(ins.insertId, filename);
}

async function importPdf(url: string): Promise<string> {
  const res = await fetch(`${ORIGIN}/wp-content/uploads/${relOf(url)}`, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; PeptivaStore/1.0)", Accept: "application/pdf,*/*" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error(`answered ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.subarray(0, 5).toString() !== "%PDF-") throw new Error("is not a PDF");
  const filename = (decodeURIComponent(relOf(url)).split("/").pop() ?? "certificate.pdf").replace(/[^\w.\-]+/g, "-").slice(0, 120);
  const [ins] = await db.insert(schema.coaFiles).values({ filename, size: buf.length, data: buf });
  return `/coa-files/${ins.insertId}/${filename}`;
}

/** Importa una tanda. `skip` son las direcciones que ya fallaron, para no reintentarlas en bucle. */
export async function importLegacyBatch(skip: string[], size = 3) {
  const { images, pdfs } = await legacyReferences();
  const pending = [...images, ...pdfs].filter((u) => !skip.includes(u));
  const batch = pending.slice(0, size);
  const failed: { url: string; reason: string }[] = [];
  let imported = 0;
  await Promise.all(
    batch.map(async (url) => {
      try {
        const next = isPdf(url) ? await importPdf(url) : await importImage(url);
        await rewrite(url, next);
        imported++;
      } catch (err) {
        failed.push({ url, reason: err instanceof Error ? err.message : String(err) });
      }
    }),
  );
  return { imported, failed, remaining: pending.length - batch.length };
}
