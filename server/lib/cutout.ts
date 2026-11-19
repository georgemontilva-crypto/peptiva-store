import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Request, Response } from "express";
import { fetchOriginal, ALLOWED_EXT } from "./media";

/**
 * Recorte del fondo de las fotos de producto.
 *
 * Las fotos del catálogo son tomas de estudio: el frasco sobre un fondo de color (azul, lila, blanco)
 * que a menudo lleva un degradado y una superficie al pie. Para que el frasco pueda "flotar" sobre los
 * degradados de la portada hace falta un PNG con transparencia. El servidor descarga la foto original
 * una sola vez, borra el fondo y guarda el PNG recortado en disco; a partir de ahí se sirve desde caché.
 *
 * El método es un crecimiento de región desde los bordes de la foto, no "borra el color X":
 *   - un píxel se suma al fondo si se parece al píxel de fondo vecino (LOCAL), lo que permite seguir
 *     degradados suaves sin cortar de golpe;
 *   - y además no puede alejarse demasiado del color medio del marco (GLOBAL), que es lo que impide
 *     que la selección se cuele dentro del producto por una sombra o un reflejo.
 * Como solo crece desde el borde, los blancos y claros de la etiqueta nunca se agujerean.
 */
const CACHE_DIR = path.join(os.tmpdir(), "peptiva-cutout");
fs.mkdirSync(CACHE_DIR, { recursive: true });

/** Variación máxima respecto al píxel de fondo vecino (sigue el degradado del fondo). */
const LOCAL = 10;
/** Distancia máxima al color medio del marco de la foto (frena la selección en el producto). */
const GLOBAL = 72;
/** Pasadas de suavizado del borde, para que no quede dentado. */
const FEATHER = 2;
/** Por debajo de este alfa el píxel no cuenta para calcular el recorte. */
const EDGE_ALPHA = 24;

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

/**
 * Quita el fondo y devuelve un PNG recortado al contenido.
 * Devuelve null si la imagen no se puede procesar o si el resultado no es creíble (queda casi nada,
 * o no se quitó prácticamente nada): en ese caso es mejor servir la foto original.
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
  const off = (i: number) => i * 4;

  // Color medio del marco exterior: es la referencia de "fondo"
  let sr = 0;
  let sg = 0;
  let sb = 0;
  let n = 0;
  const sample = (x: number, y: number) => {
    const p = off(y * w + x);
    sr += data[p]!;
    sg += data[p + 1]!;
    sb += data[p + 2]!;
    n++;
  };
  for (let x = 0; x < w; x++) {
    sample(x, 0);
    sample(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    sample(0, y);
    sample(w - 1, y);
  }
  const seedR = sr / n;
  const seedG = sg / n;
  const seedB = sb / n;

  const dist2 = (p: number, r: number, g: number, b: number) => {
    const dr = data[p]! - r;
    const dg = data[p + 1]! - g;
    const db = data[p + 2]! - b;
    return dr * dr + dg * dg + db * db;
  };
  const LOCAL2 = LOCAL * LOCAL;
  const GLOBAL2 = GLOBAL * GLOBAL;

  // Crecimiento de región desde los cuatro bordes
  const bg = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let head = 0;
  let tail = 0;
  const push = (x: number, y: number, from: number) => {
    const i = y * w + x;
    if (bg[i]) return;
    const p = off(i);
    if (from >= 0 && dist2(p, data[from]!, data[from + 1]!, data[from + 2]!) > LOCAL2) return;
    if (dist2(p, seedR, seedG, seedB) > GLOBAL2) return;
    bg[i] = 1;
    queue[tail++] = i;
  };
  for (let x = 0; x < w; x++) {
    push(x, 0, -1);
    push(x, h - 1, -1);
  }
  for (let y = 0; y < h; y++) {
    push(0, y, -1);
    push(w - 1, y, -1);
  }
  while (head < tail) {
    const i = queue[head++]!;
    const x = i % w;
    const y = (i / w) | 0;
    const p = off(i);
    if (x > 0) push(x - 1, y, p);
    if (x < w - 1) push(x + 1, y, p);
    if (y > 0) push(x, y - 1, p);
    if (y < h - 1) push(x, y + 1, p);
  }

  // Alfa con el borde suavizado
  const alpha = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) alpha[i] = bg[i] ? 0 : 255;
  for (let pass = 0; pass < FEATHER; pass++) {
    const prev = Uint8Array.from(alpha);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (!prev[i]) continue;
        let sum = prev[i]!;
        let c = 1;
        if (x > 0) { sum += prev[i - 1]!; c++; }
        if (x < w - 1) { sum += prev[i + 1]!; c++; }
        if (y > 0) { sum += prev[i - w]!; c++; }
        if (y < h - 1) { sum += prev[i + w]!; c++; }
        alpha[i] = Math.round(sum / c);
      }
    }
  }

  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  let kept = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const a = alpha[i]!;
      data[off(i) + 3] = a;
      if (a > EDGE_ALPHA) {
        kept++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  // Ni "se borró casi todo" ni "no se borró nada": en ambos casos la original es mejor
  const ratio = kept / (w * h);
  if (maxX < 0 || ratio < 0.02 || ratio > 0.97) return null;

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
