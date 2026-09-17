import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Request, Response } from "express";

/**
 * Proxy de imágenes del WordPress anterior.
 * Las imágenes siguen alojadas en peptivasupplies.com hasta migrarlas a R2; cargarlas directo desde el
 * navegador depende de ese servidor (caché, protección anti-hotlink, CDN). Aquí el servidor las descarga
 * una vez, las guarda en disco y las sirve desde nuestro propio dominio con caché larga.
 */
const ORIGIN = (process.env.MEDIA_ORIGIN || "https://peptivasupplies.com").replace(/\/$/, "");
const UPLOADS_PREFIX = /^https?:\/\/(www\.)?peptivasupplies\.com\/wp-content\/uploads\//i;
const CACHE_DIR = path.join(os.tmpdir(), "peptiva-media");
const ALLOWED = /\.(png|jpe?g|webp|gif|svg|avif)$/i;
const TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", svg: "image/svg+xml", avif: "image/avif" };

fs.mkdirSync(CACHE_DIR, { recursive: true });
const inflight = new Map<string, Promise<Buffer | null>>();

/** Convierte una URL de uploads de WordPress en una ruta servida por nosotros. Otras URLs no se tocan. */
export function mediaUrl(url: string | null | undefined): string | null {
  if (!url) return url ?? null;
  if (!UPLOADS_PREFIX.test(url) || !ALLOWED.test(url.split("?")[0]!)) return url;
  return `/media/wp/${url.replace(UPLOADS_PREFIX, "").split("?")[0]}`;
}

async function download(rel: string, file: string): Promise<Buffer | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`${ORIGIN}/wp-content/uploads/${rel}`, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; PeptivaStore/1.0)", Accept: "image/*" },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        console.warn(`[media] ${rel} respondió ${res.status}`);
        return null;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      await fs.promises.writeFile(file, buf);
      return buf;
    } catch (err) {
      if (attempt === 1) console.warn(`[media] no se pudo descargar ${rel}:`, err instanceof Error ? err.message : err);
    }
  }
  return null;
}

export async function handleMedia(req: Request, res: Response) {
  const raw = (req.params as { path?: string | string[] }).path;
  const rel = Array.isArray(raw) ? raw.join("/") : (raw ?? "");
  // Solo rutas simples tipo 2026/05/archivo.png
  if (!/^[\w\-./]+$/.test(rel) || rel.includes("..") || !ALLOWED.test(rel)) return res.status(400).end();

  const ext = rel.split(".").pop()!.toLowerCase();
  const file = path.join(CACHE_DIR, crypto.createHash("sha1").update(rel).digest("hex") + "." + ext);

  let buf: Buffer | null = null;
  try {
    buf = await fs.promises.readFile(file);
  } catch {
    let job = inflight.get(rel);
    if (!job) {
      job = download(rel, file).finally(() => inflight.delete(rel));
      inflight.set(rel, job);
    }
    buf = await job;
  }

  if (!buf) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(404).end();
  }
  res.setHeader("Content-Type", TYPES[ext] ?? "application/octet-stream");
  res.setHeader("Cache-Control", "public, max-age=604800, stale-while-revalidate=86400");
  res.send(buf);
}
