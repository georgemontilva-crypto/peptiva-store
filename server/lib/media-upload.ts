import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db, schema } from "../db";
import { COOKIE, parseCookies, readSession } from "./auth";

/**
 * Subida y entrega de las imágenes del admin (blog y productos).
 *
 * El archivo viaja como cuerpo crudo de la petición, igual que los PDFs de COA, con el nombre y las
 * medidas en cabeceras. El tipo no se toma de lo que diga el navegador: se comprueba contra los
 * primeros bytes del archivo, y solo se aceptan formatos de imagen rasterizada. SVG queda fuera a
 * propósito, porque puede llevar scripts y se serviría desde el mismo dominio que el panel.
 */
const MAX = 6 * 1024 * 1024;

const SIGNATURES: { mime: string; ext: string; test: (b: Buffer) => boolean }[] = [
  { mime: "image/jpeg", ext: "jpg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: "image/png", ext: "png", test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: "image/gif", ext: "gif", test: (b) => ["GIF87a", "GIF89a"].includes(b.subarray(0, 6).toString("latin1")) },
  { mime: "image/webp", ext: "webp", test: (b) => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP" },
  { mime: "image/avif", ext: "avif", test: (b) => b.subarray(4, 8).toString("latin1") === "ftyp" && /avif|avis/.test(b.subarray(8, 32).toString("latin1")) },
];

/** Tipo real de una imagen según sus primeros bytes, o null si no es un formato admitido. */
export const sniffImage = (buf: Buffer) => SIGNATURES.find((s) => s.test(buf)) ?? null;

/** Nombre limpio para la URL, siempre con la extensión que corresponde al contenido real. */
export function safeName(raw: string, ext: string): string {
  const base = raw
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${base || "image"}.${ext}`;
}

const intHeader = (v: unknown) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 && n < 20000 ? n : null;
};

export const mediaPath = (id: number, filename: string) => `/media/u/${id}/${filename}`;

/** POST /admin-api/media/upload — guarda una imagen y devuelve su URL pública. */
export async function handleMediaUpload(req: Request, res: Response) {
  if (!readSession(parseCookies(req)[COOKIE.admin], "admin")) return res.status(401).json({ error: "Please sign in to the admin." });
  const buf = req.body as Buffer;
  if (!Buffer.isBuffer(buf) || buf.length < 32) return res.status(400).json({ error: "The file is empty." });
  if (buf.length > MAX) return res.status(413).json({ error: "The image is larger than 6 MB." });

  const kind = SIGNATURES.find((s) => s.test(buf));
  if (!kind) return res.status(400).json({ error: "Only JPG, PNG, WebP, GIF or AVIF images can be uploaded." });

  let rawName = "image";
  try {
    rawName = decodeURIComponent(String(req.headers["x-filename"] ?? "image"));
  } catch {
    /* nombre mal codificado: se usa el genérico */
  }
  const filename = safeName(rawName, kind.ext);
  let alt: string | null = null;
  try {
    alt = decodeURIComponent(String(req.headers["x-alt"] ?? "")).slice(0, 255) || null;
  } catch {
    /* sin texto alternativo */
  }

  const [ins] = await db.insert(schema.media).values({
    filename,
    mime: kind.mime,
    size: buf.length,
    width: intHeader(req.headers["x-width"]),
    height: intHeader(req.headers["x-height"]),
    alt,
    data: buf,
  });
  res.json({ id: ins.insertId, url: mediaPath(ins.insertId, filename), filename, mime: kind.mime, size: buf.length });
}

/** GET /media/u/:id/:name — sirve la imagen. La URL nunca cambia de contenido, así que se cachea un año. */
export async function handleMediaFile(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(404).end();
  const [file] = await db.select().from(schema.media).where(eq(schema.media.id, id));
  if (!file) return res.status(404).end();
  res.setHeader("Content-Type", file.mime);
  res.setHeader("Content-Length", String(file.data.length));
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.send(file.data);
}
