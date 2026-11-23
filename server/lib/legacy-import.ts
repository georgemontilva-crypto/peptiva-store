import { eq, like, sql } from "drizzle-orm";
import { db, schema } from "../db";
import content from "../data/content.json";
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
  const done: Record<string, string> = {};
  let imported = 0;
  await Promise.all(
    batch.map(async (url) => {
      try {
        const next = isPdf(url) ? await importPdf(url) : await importImage(url);
        await rewrite(url, next);
        done[url] = next;
        imported++;
      } catch (err) {
        failed.push({ url, reason: err instanceof Error ? err.message : String(err) });
      }
    }),
  );
  // Queda anotado para que la copia automática no vuelva a descargar lo mismo
  if (imported) {
    const prev = (await legacySync()) ?? { at: "", failedRuns: 0, copied: {}, failed: [] };
    const value: LegacySync = { ...prev, at: new Date().toISOString(), copied: { ...prev.copied, ...done }, failed: prev.failed.filter((f) => !done[f.url]) };
    await db.insert(schema.settings).values({ key: SYNC_KEY, value }).onDuplicateKeyUpdate({ set: { value } });
  }
  return { imported, failed, remaining: pending.length - batch.length };
}

/**
 * Copia automática al arrancar.
 *
 * El WordPress anterior se va a eliminar, así que la tienda no espera a que alguien pulse el botón:
 * en cada arranque, mientras quede algo allí, lo trae sola en segundo plano. Además de los archivos
 * que la tienda enlaza, guarda los certificados que constan en los datos del catálogo aunque hoy no
 * estén asociados a ningún lote (otras versiones), para que no se pierdan con el servidor viejo.
 *
 * Lo copiado queda anotado en settings (dirección antigua → nueva), de modo que no se descarga dos
 * veces. Si algo falla se reintenta en la misma pasada y en los arranques siguientes, hasta un tope.
 */
const SYNC_KEY = "legacyImport";
const MAX_FAILED_RUNS = 6;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type LegacySync = { at: string; failedRuns: number; copied: Record<string, string>; failed: { url: string; reason: string }[] };

export async function legacySync(): Promise<LegacySync | null> {
  const [row] = await db.select({ value: schema.settings.value }).from(schema.settings).where(eq(schema.settings.key, SYNC_KEY));
  return (row?.value as LegacySync | undefined) ?? null;
}

/** Certificados que figuran en los datos del catálogo, estén o no enlazados a un lote. */
const knownPdfs = () => [...content.coas.map((c) => c.pdfUrl), ...content.coaLots.map((l) => l.reportUrl)].filter((u): u is string => typeof u === "string" && isPdf(u) && relOf(u) !== u);

let running = false;

export async function runLegacySync(opts: { manual?: boolean } = {}): Promise<void> {
  if (running) return;
  running = true;
  try {
    const prev = (await legacySync()) ?? { at: "", failedRuns: 0, copied: {}, failed: [] };
    const copied = { ...prev.copied };
    const refs = await legacyReferences();
    const referenced = new Set([...refs.images, ...refs.pdfs]);
    const pending = [...new Set([...referenced, ...knownPdfs()])].filter((u) => !copied[u] || referenced.has(u));
    if (!pending.length || (!opts.manual && prev.failedRuns >= MAX_FAILED_RUNS)) return;

    console.log(`[legacy] ${pending.length} archivos por traer del sitio anterior`);
    let queue = pending;
    let failed: LegacySync["failed"] = [];
    for (let pass = 0; pass < (opts.manual ? 1 : 3) && queue.length; pass++) {
      if (pass) await wait(15_000);
      failed = [];
      for (let i = 0; i < queue.length; i += 3) {
        await Promise.all(
          queue.slice(i, i + 3).map(async (url) => {
            try {
              const next = copied[url] ?? (isPdf(url) ? await importPdf(url) : await importImage(url));
              copied[url] = next;
              if (referenced.has(url)) await rewrite(url, next);
            } catch (err) {
              failed.push({ url, reason: err instanceof Error ? err.message : String(err) });
            }
          }),
        );
      }
      queue = failed.map((f) => f.url);
    }

    const value: LegacySync = { at: new Date().toISOString(), failedRuns: failed.length ? prev.failedRuns + 1 : 0, copied, failed };
    await db.insert(schema.settings).values({ key: SYNC_KEY, value }).onDuplicateKeyUpdate({ set: { value } });
    console.log(`[legacy] ${pending.length - failed.length} archivos guardados en la tienda${failed.length ? `, ${failed.length} no se pudieron descargar` : ""}`);
  } catch (err) {
    console.error("[legacy] la copia automática falló", err);
  } finally {
    running = false;
  }
}

/** Resumen para el admin: qué se guardó, qué falló y qué certificados guardados no están en ningún lote. */
export async function legacySummary() {
  const [refs, sync, lots] = await Promise.all([legacyReferences(), legacySync(), db.select({ reportUrl: schema.coaLots.reportUrl }).from(schema.coaLots)]);
  const linked = new Set(lots.map((l) => l.reportUrl));
  const saved = Object.entries(sync?.copied ?? {});
  return {
    images: refs.images.length,
    pdfs: refs.pdfs.length,
    saved: saved.length,
    savedAt: sync?.at || null,
    failed: sync?.failed ?? [],
    unlinked: saved.filter(([old, next]) => isPdf(old) && !linked.has(next)).map(([old, next]) => ({ name: decodeURIComponent(relOf(old)), url: next })),
  };
}
