import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db, schema } from "../db";
import { COOKIE, parseCookies, readSession } from "./auth";
import { matchProduct, parseCoaText, pdfToText } from "./coa-parser";

const MAX = 15 * 1024 * 1024;
const safeName = (s: string) => s.replace(/[^\w.\-]+/g, "-").replace(/-+/g, "-").slice(0, 120) || "certificate.pdf";

export async function parsePdfBuffer(buf: Buffer, filename: string) {
  let text = "";
  try {
    text = await pdfToText(buf);
  } catch (err) {
    console.warn("[coa] no se pudo leer el PDF", err instanceof Error ? err.message : err);
  }
  const parsed = parseCoaText(text);
  const products = await db.select({ id: schema.products.id, name: schema.products.name, slug: schema.products.slug }).from(schema.products);
  const match = matchProduct(`${parsed.title ?? ""} ${filename}`, products);
  return { parsed, match: match ? { id: match.id, name: match.name } : null, scanned: parsed.textLength < 25 };
}

/** POST /admin-api/coa/upload — sube un PDF, lo guarda y devuelve los datos leídos. */
export async function handleCoaUpload(req: Request, res: Response) {
  if (!readSession(parseCookies(req)[COOKIE.admin], "admin")) return res.status(401).json({ error: "Please sign in to the admin." });
  const buf = req.body as Buffer;
  if (!Buffer.isBuffer(buf) || buf.length < 100) return res.status(400).json({ error: "The file is empty." });
  if (buf.length > MAX) return res.status(413).json({ error: "The PDF is larger than 15 MB." });
  if (buf.subarray(0, 5).toString() !== "%PDF-") return res.status(400).json({ error: "That file is not a PDF." });

  const filename = safeName(String(req.headers["x-filename"] ?? "certificate.pdf"));
  const [ins] = await db.insert(schema.coaFiles).values({ filename, size: buf.length, data: buf });
  const result = await parsePdfBuffer(buf, filename);
  res.json({ ...result, reportUrl: `/coa-files/${ins.insertId}/${filename.toLowerCase().endsWith(".pdf") ? filename : `${filename}.pdf`}` });
}

/** GET /coa-files/:id/:name — sirve el PDF guardado. */
export async function handleCoaFile(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(404).end();
  const [file] = await db.select().from(schema.coaFiles).where(eq(schema.coaFiles.id, id));
  if (!file) return res.status(404).end();
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${file.filename}"`);
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.send(file.data);
}
