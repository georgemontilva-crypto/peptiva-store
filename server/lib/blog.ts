import { and, desc, eq, lte } from "drizzle-orm";
import { db, schema } from "../db";

const { blogPosts } = schema;

/** "What Are Research Peptides?" → "what-are-research-peptides" */
export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

/** Estado tal como lo entiende quien publica: un artículo "published" con fecha futura está programado. */
export const postState = (p: { status: "draft" | "published"; publishedAt: Date | null }, now = new Date()) =>
  p.status === "draft" ? ("draft" as const) : p.publishedAt && p.publishedAt > now ? ("scheduled" as const) : ("live" as const);

const textOf = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim();

/** Minutos de lectura a unas 220 palabras por minuto, con un mínimo de uno. */
export const readingMinutes = (html: string) => Math.max(1, Math.round(textOf(html).split(" ").length / 220));

/** Resumen de respaldo cuando el artículo no trae uno escrito. */
export const autoExcerpt = (html: string, max = 180) => {
  const t = textOf(html);
  return t.length <= max ? t : `${t.slice(0, max).replace(/\s+\S*$/, "")}…`;
};

/** Condición de "visible para el público": publicado y con la fecha ya cumplida. */
export const liveWhere = () => and(eq(blogPosts.status, "published"), lte(blogPosts.publishedAt, new Date()));

export async function liveSlugs(): Promise<Set<string>> {
  const rows = await db.select({ slug: blogPosts.slug }).from(blogPosts).where(liveWhere());
  return new Set(rows.map((r) => r.slug));
}

/**
 * Quita los enlaces internos a artículos que todavía no están publicados y deja solo su texto.
 *
 * Los artículos se enlazan entre sí, pero se publican en días distintos: sin esto, un artículo que
 * sale el lunes enlazaría a otro programado para el jueves y el lector caería en un 404. Como se
 * resuelve al servir, el enlace aparece solo el día que el artículo de destino se publica.
 */
export function unlinkUnpublished(html: string, live: Set<string>): string {
  return html.replace(/<a\b[^>]*\bhref="\/blog\/([a-z0-9-]+)\/?"[^>]*>([\s\S]*?)<\/a>/gi, (whole, slug: string, inner: string) => (live.has(slug) ? whole : inner));
}

export const listFields = {
  id: blogPosts.id,
  slug: blogPosts.slug,
  title: blogPosts.title,
  excerpt: blogPosts.excerpt,
  seoDescription: blogPosts.seoDescription,
  coverImage: blogPosts.coverImage,
  coverAlt: blogPosts.coverAlt,
  category: blogPosts.category,
  publishedAt: blogPosts.publishedAt,
  bodyHtml: blogPosts.bodyHtml,
};

type ListRow = { id: number; slug: string; title: string; excerpt: string | null; seoDescription: string | null; coverImage: string | null; coverAlt: string | null; category: string | null; publishedAt: Date | null; bodyHtml: string };

/** Fila del listado tal como la consume la web: sin el cuerpo, con resumen y minutos de lectura. */
export const toCard = ({ bodyHtml, seoDescription, ...r }: ListRow) => ({
  ...r,
  excerpt: r.excerpt || seoDescription || autoExcerpt(bodyHtml),
  minutes: readingMinutes(bodyHtml),
});

export const livePosts = (limit = 200) => db.select(listFields).from(blogPosts).where(liveWhere()).orderBy(desc(blogPosts.publishedAt), desc(blogPosts.id)).limit(limit);
