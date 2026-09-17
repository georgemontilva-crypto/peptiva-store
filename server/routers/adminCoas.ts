import { z } from "zod";
import { and, asc, count, desc, eq, ne, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { db, schema } from "../db";
import { adminProcedure, router } from "../trpc";
import { parsePdfBuffer } from "../lib/coa-files";

const lotInput = z.object({
  productId: z.number().int().positive(),
  lotNumber: z.string().trim().min(1).max(64),
  title: z.string().trim().max(120).optional().nullable(),
  purity: z.string().trim().max(32).regex(/^(\d{1,3}(\.\d{1,4})?)?$/, "Purity must be a number like 99.434").optional().nullable(),
  specPurity: z.string().trim().max(32).optional().nullable(),
  appearance: z.string().trim().max(120).optional().nullable(),
  identity: z.string().trim().max(64).optional().nullable(),
  measured: z.string().trim().max(191).optional().nullable(),
  heavyMetals: z.string().trim().max(64).optional().nullable(),
  endotoxin: z.string().trim().max(64).optional().nullable(),
  lab: z.string().trim().max(191).optional().nullable(),
  testedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable().or(z.literal("")),
  reportUrl: z.string().trim().max(1024).optional().nullable(),
  latest: z.boolean(),
});

const clean = (v: z.infer<typeof lotInput>) => ({
  productId: v.productId,
  lotNumber: v.lotNumber,
  title: v.title || null,
  purity: v.purity || null,
  specPurity: v.specPurity || null,
  appearance: v.appearance || null,
  identity: v.identity || null,
  measured: v.measured || null,
  heavyMetals: v.heavyMetals || null,
  endotoxin: v.endotoxin || null,
  lab: v.lab || null,
  testedAt: v.testedAt || null,
  reportUrl: v.reportUrl || null,
  latest: v.latest,
});

/** Garantiza exactamente un lote "latest" por producto (el elegido o el más reciente). */
async function normalizeLatest(productId: number, preferId?: number) {
  const lots = await db
    .select({ id: schema.coaLots.id, latest: schema.coaLots.latest })
    .from(schema.coaLots)
    .where(eq(schema.coaLots.productId, productId))
    .orderBy(desc(schema.coaLots.testedAt), desc(schema.coaLots.id));
  if (!lots.length) return;
  const keep = preferId ?? lots.find((l) => l.latest)?.id ?? lots[0]!.id;
  await db.update(schema.coaLots).set({ latest: sql`(${schema.coaLots.id} = ${keep})` }).where(eq(schema.coaLots.productId, productId));
}

export const adminCoasRouter = router({
  products: adminProcedure.query(async () => {
    const products = await db.select({ id: schema.products.id, name: schema.products.name, slug: schema.products.slug, imageUrl: schema.products.imageUrl }).from(schema.products).orderBy(asc(schema.products.sortOrder));
    const lots = await db.select().from(schema.coaLots).orderBy(desc(schema.coaLots.latest), desc(schema.coaLots.testedAt));
    return products.map((p) => {
      const mine = lots.filter((l) => l.productId === p.id && l.lotNumber !== "Current batch");
      const latest = mine.find((l) => l.latest) ?? mine[0] ?? null;
      const placeholder = lots.find((l) => l.productId === p.id && l.lotNumber === "Current batch");
      return {
        ...p,
        lotCount: mine.length,
        latest: latest ? { lotNumber: latest.lotNumber, purity: latest.purity, testedAt: latest.testedAt, reportUrl: latest.reportUrl } : null,
        pdfOnly: !latest && placeholder ? placeholder.reportUrl : null,
      };
    });
  }),

  lots: adminProcedure.input(z.object({ productId: z.number().int().positive() })).query(({ input }) =>
    db.select().from(schema.coaLots).where(eq(schema.coaLots.productId, input.productId)).orderBy(desc(schema.coaLots.latest), desc(schema.coaLots.testedAt), desc(schema.coaLots.id)),
  ),

  save: adminProcedure.input(lotInput.extend({ id: z.number().int().positive().optional() })).mutation(async ({ input }) => {
    const values = clean(input);
    const [dupe] = await db
      .select({ id: schema.coaLots.id })
      .from(schema.coaLots)
      .where(and(eq(schema.coaLots.productId, values.productId), eq(schema.coaLots.lotNumber, values.lotNumber), input.id ? ne(schema.coaLots.id, input.id) : undefined));
    if (dupe) throw new TRPCError({ code: "CONFLICT", message: `Lot ${values.lotNumber} already exists for this product. Edit it instead.` });

    let id = input.id;
    if (id) await db.update(schema.coaLots).set(values).where(eq(schema.coaLots.id, id));
    else {
      const [res] = await db.insert(schema.coaLots).values(values);
      id = res.insertId;
      // El enlace provisional "Current batch" deja de hacer falta cuando hay un lote con datos
      await db.delete(schema.coaLots).where(and(eq(schema.coaLots.productId, values.productId), eq(schema.coaLots.lotNumber, "Current batch")));
    }
    await normalizeLatest(values.productId, values.latest ? id : undefined);
    return { id };
  }),

  remove: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
    const [lot] = await db.select().from(schema.coaLots).where(eq(schema.coaLots.id, input.id));
    if (!lot) return { ok: true };
    await db.delete(schema.coaLots).where(eq(schema.coaLots.id, input.id));
    await normalizeLatest(lot.productId);
    return { ok: true };
  }),

  /** Lee un PDF ya publicado en otra URL (por ejemplo los del WordPress) sin volver a subirlo. */
  parseUrl: adminProcedure.input(z.object({ url: z.url().max(1024) })).mutation(async ({ input }) => {
    if (!/^https:\/\//i.test(input.url)) throw new TRPCError({ code: "BAD_REQUEST", message: "Use an https:// link to a PDF." });
    const res = await fetch(input.url, { signal: AbortSignal.timeout(20_000) }).catch(() => null);
    if (!res?.ok) throw new TRPCError({ code: "BAD_REQUEST", message: `The PDF could not be downloaded${res ? ` (HTTP ${res.status})` : ""}.` });
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.subarray(0, 5).toString() !== "%PDF-") throw new TRPCError({ code: "BAD_REQUEST", message: "That link is not a PDF." });
    const filename = decodeURIComponent(input.url.split("/").pop() ?? "certificate.pdf");
    return { ...(await parsePdfBuffer(buf, filename)), reportUrl: input.url };
  }),

  stats: adminProcedure.query(async () => {
    const [withData] = await db.select({ n: count() }).from(schema.coaLots).where(ne(schema.coaLots.lotNumber, "Current batch"));
    return { lots: withData?.n ?? 0 };
  }),
});
