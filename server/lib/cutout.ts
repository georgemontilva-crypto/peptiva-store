import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Request, Response } from "express";
import { fetchOriginal, ALLOWED_EXT } from "./media";

/**
 * Recorte del fondo de las fotos de producto.
 *
 * Las fotos del catálogo vienen sobre fondo blanco. Para que los frascos puedan "flotar" sobre los
 * degradados de la portada hace falta un PNG con transparencia. Aquí el servidor descarga la foto
 * original una sola vez, borra el fondo y guarda el PNG recortado en disco; a partir de ahí se sirve
 * desde caché, así que el recorte se hace una vez por imagen y no en cada visita.
 *
 * El borrado NO es "todo píxel blanco": eso agujerearía las etiquetas claras del frasco. Se hace una
 * inundación desde los bordes de la foto, de modo que solo desaparece el blanco conectado con el borde.
 */
const CACHE_DIR = path.join(os.tmpdir(), "peptiva-cutout");
fs.mkdirSync(CACHE_DIR, { recursive: true });

/** Un píxel cuenta como fondo si es claro y sin color dominante (gris muy claro o blanco). */
const LIGHT = 238; // mínimo de cada canal
const SPREAD = 14; // diferencia máxima entre canales
/** Zona de transición: a partir de este valor el píxel se vuelve semitransparente, para que no quede borde dentado. */
const SOFT = 216;

const inflight = new Map<string, Promise<Buffer | null>>();

/** Firma mínima de sharp que usamos aquí (el paquete exporta una función con `export =`). */
type SharpFactory = (input?: Buffer, opts?: { raw?: { width: number; height: number; channels: number } }) => import("sharp").Sharp;
let sharpMod: SharpFactory | null | undefined;
async function loadSharp(): Promise<SharpFactory | null> {
  if (sharpMod !== undefined) return sharpMod;
  try {
    sharpMod = (await import("sharp")).default as unknown as SharpFactory;
  } catch (err) {
    console.warn("[cutout] sharp no está disponible, se sirve la imagen original:", err instanceof Error ? err.message : err);
    sharpMod = null;
  }
  return sharpMod;
}

const isLight = (r: number, g: number, b: number) =>
  r >= LIGHT && g >= LIGHT && b >= LIGHT && Math.max(r, g, b) - Math.min(r, g, b) <= SPREAD;

/**
 * Quita el fondo y devuelve un PNG recortado al contenido.
 * Devuelve null si la imagen no se puede procesar o si el recorte se comería casi toda la foto
 * (señal de que el fondo no era claro y es mejor dejar la original).
 */
export async function removeBackground(input: Buffer): Promise<Buffer | null> {
  const sharp = await loadSharp();
  if (!sharp) return null;

  const { data, info } = await sharp(input)
    .rotate()
    .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width: w, height: h } = info;
  const px = (x: number, y: number) => (y * w + x) * 4;

  // 1) Inundación desde los bordes: marca el fondo conectado con el exterior
  const bg = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let head = 0;
  let tail = 0;
  const push = (x: number, y: number) => {
    const i = y * w + x;
    if (bg[i]) return;
    const o = px(x, y);
    if (!isLight(data[o]!, data[o + 1]!, data[o + 2]!)) return;
    bg[i] = 1;
    queue[tail++] = i;
  };
  for (let x = 0; x < w; x++) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    push(0, y);
    push(w - 1, y);
  }
  while (head < tail) {
    const i = queue[head++]!;
    const x = i % w;
    const y = (i / w) | 0;
    if (x > 0) push(x - 1, y);
    if (x < w - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < h - 1) push(x, y + 1);
  }

  // 2) Alfa: fondo transparente, y borde suave según lo claro que sea el píxel vecino
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  let kept = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const o = px(x, y);
      let alpha = data[o + 3]!;
      if (bg[i]) {
        alpha = 0;
      } else {
        // ¿toca el fondo? entonces se difumina según su luminosidad
        const touches =
          (x > 0 && bg[i - 1]) || (x < w - 1 && bg[i + 1]) || (y > 0 && bg[i - w]) || (y < h - 1 && bg[i + w]);
        if (touches) {
          const lum = (data[o]! * 299 + data[o + 1]! * 587 + data[o + 2]! * 114) / 1000;
          if (lum > SOFT) {
            const t = Math.min(1, (lum - SOFT) / (255 - SOFT));
            alpha = Math.round(alpha * (1 - t));
          }
        }
      }
      data[o + 3] = alpha;
      if (alpha > 8) {
        kept++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  // Si queda menos del 2% de la foto, el recorte salió mal: mejor la original
  if (maxX < 0 || kept < w * h * 0.02) return null;

  const pad = 2;
  const left = Math.max(0, minX - pad);
  const top = Math.max(0, minY - pad);
  const right = Math.min(w - 1, maxX + pad);
  const bottom = Math.min(h - 1, maxY + pad);

  return sharp(Buffer.from(data), { raw: { width: w, height: h, channels: 4 } })
    .extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/** `/media/wp/2026/08/ps1.png` → `/media/cut/2026/08/ps1.png` (PNG con fondo transparente). */
export async function handleCutout(req: Request, res: Response) {
  const raw = (req.params as { path?: string | string[] }).path;
  const rel = Array.isArray(raw) ? raw.join("/") : (raw ?? "");
  if (!/^[\w\-./]+$/.test(rel) || rel.includes("..") || !ALLOWED_EXT.test(rel)) return res.status(400).end();

  const file = path.join(CACHE_DIR, crypto.createHash("sha1").update(rel).digest("hex") + ".png");

  let buf: Buffer | null = null;
  try {
    buf = await fs.promises.readFile(file);
  } catch {
    let job = inflight.get(rel);
    if (!job) {
      job = (async () => {
        const original = await fetchOriginal(rel);
        if (!original) return null;
        try {
          const cut = await removeBackground(original);
          if (!cut) return null;
          await fs.promises.writeFile(file, cut);
          return cut;
        } catch (err) {
          console.warn(`[cutout] falló el recorte de ${rel}:`, err instanceof Error ? err.message : err);
          return null;
        }
      })().finally(() => inflight.delete(rel));
      inflight.set(rel, job);
    }
    buf = await job;
  }

  // Sin recorte posible, el navegador se queda con la foto original y la portada no se rompe
  if (!buf) return res.redirect(302, `/media/wp/${rel}`);

  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "public, max-age=604800, stale-while-revalidate=86400");
  res.send(buf);
}
