import { eq, like } from "drizzle-orm";
import { db, schema } from "../db";
import content from "../data/content.json";

/**
 * Textos del sitio que se pueden corregir desde el admin: las páginas de políticas y las preguntas
 * frecuentes. El texto original viene en el código; lo que se edite se guarda en `settings` y tiene
 * prioridad. "Restaurar" simplemente borra esa fila y vuelve a mandar el original.
 */
export type SitePage = { title: string; html: string };
export type FaqItem = { section: string; q: string; a: string };

const ORIGINAL_PAGES = content.pages as Record<string, SitePage>;
const ORIGINAL_FAQ = content.faq as FaqItem[];
const pageKey = (slug: string) => `page:${slug}`;
const FAQ_KEY = "faq";

export const pageSlugs = () => Object.keys(ORIGINAL_PAGES);

async function read<T>(key: string): Promise<T | null> {
  const [row] = await db.select({ value: schema.settings.value }).from(schema.settings).where(eq(schema.settings.key, key));
  return (row?.value as T | undefined) ?? null;
}
const write = (key: string, value: unknown) => db.insert(schema.settings).values({ key, value }).onDuplicateKeyUpdate({ set: { value } });
const clear = (key: string) => db.delete(schema.settings).where(eq(schema.settings.key, key));

export async function getPage(slug: string): Promise<(SitePage & { edited: boolean }) | null> {
  const original = ORIGINAL_PAGES[slug];
  if (!original) return null;
  const saved = await read<SitePage>(pageKey(slug));
  return saved ? { ...saved, edited: true } : { ...original, edited: false };
}

export async function listPages() {
  const edited = await db.select({ key: schema.settings.key, updatedAt: schema.settings.updatedAt, value: schema.settings.value }).from(schema.settings).where(like(schema.settings.key, "page:%"));
  return pageSlugs().map((slug) => {
    const row = edited.find((e) => e.key === pageKey(slug));
    return { slug, title: (row?.value as SitePage | undefined)?.title ?? ORIGINAL_PAGES[slug]!.title, edited: Boolean(row), updatedAt: row?.updatedAt ?? null };
  });
}

export const savePage = (slug: string, page: SitePage) => write(pageKey(slug), page);
export const resetPage = (slug: string) => clear(pageKey(slug));

export async function getFaq(): Promise<{ items: FaqItem[]; edited: boolean }> {
  const saved = await read<FaqItem[]>(FAQ_KEY);
  return saved ? { items: saved, edited: true } : { items: ORIGINAL_FAQ, edited: false };
}
export const saveFaq = (items: FaqItem[]) => write(FAQ_KEY, items);
export const resetFaq = () => clear(FAQ_KEY);
