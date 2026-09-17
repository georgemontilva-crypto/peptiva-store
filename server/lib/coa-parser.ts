import { extractText, getDocumentProxy } from "unpdf";

/**
 * Lectura de certificados de análisis (portado del importador del plugin de WordPress).
 *
 * Los COAs de Freedom Diagnostics traen las ETIQUETAS de la tabla como imagen: en la capa de
 * texto solo están los valores. Por eso no se busca "Purity: x" sino el patrón de cada dato.
 */
export type ParsedCoa = {
  title?: string;
  lotNumber?: string;
  purity?: string;
  appearance?: string;
  measured?: string;
  identity?: string;
  heavyMetals?: string;
  endotoxin?: string;
  testedAt?: string; // YYYY-MM-DD
  specPurity: string;
  found: number;
  textLength: number;
};

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const iso = (y: number, m: number, d: number) =>
  y > 2000 && m >= 1 && m <= 12 && d >= 1 && d <= 31 ? `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` : undefined;

export async function pdfToText(buffer: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}

export function parseCoaText(raw: string): ParsedCoa {
  const t = raw.replace(/\s+/g, " ");
  const ns = raw.replace(/\s+/g, "");
  const out: ParsedCoa = { specPurity: "≥ 95%", found: 0, textLength: t.trim().length };

  // Nº de COA / accession (para no confundirlo con el lote)
  const coa = t.match(/COA\s*[:#]?\s*(\d{6,})/i)?.[1] ?? t.match(/\b(\d{10})\b/)?.[1] ?? "";

  const purity = t.match(/\b(\d{1,3}\.\d{1,3})\s*%/);
  if (purity && Number(purity[1]) <= 100) {
    out.purity = purity[1];
    out.found++;
  }

  const appearance = ns.match(/(off-?white|white|tan|yellowish)?lyophilizedpowder/i);
  if (appearance) {
    const pre = appearance[1] ? `${appearance[1].charAt(0).toUpperCase()}${appearance[1].slice(1).toLowerCase()} ` : "";
    out.appearance = `${pre}Lyophilized Powder`;
    out.found++;
  } else {
    const m = t.match(/appearance[^A-Za-z]{0,40}([A-Za-z ]{4,40}powder)/i);
    if (m) {
      out.appearance = m[1]!.trim();
      out.found++;
    }
  }

  const labeled = t.match(/\b(?:lot|batch)(?:\s*(?:no|number|#))?\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-/]{2,15})\b/i);
  if (labeled && labeled[1]!.toLowerCase() !== coa.toLowerCase() && /\d/.test(labeled[1]!)) {
    out.lotNumber = labeled[1]!.trim();
    out.found++;
  } else {
    // Primero el formato típico del laboratorio (letra + 4-5 dígitos, p. ej. D4130); si no, cualquier código corto.
    // Así "CJC-1295 No DAC D4128" toma D4128 y no el nombre del péptido.
    const preferred = [...t.matchAll(/\b([A-Z]\d{4,5})\b/g)].map((m) => m[1]!).find((c) => c !== coa);
    const generic = [...t.matchAll(/\b([A-Z]{1,3}-?\d{3,6})\b/g)].map((m) => m[1]!).find((c) => c !== coa && !/^\d+$/.test(c));
    const cand = preferred ?? generic;
    if (cand) {
      out.lotNumber = cand;
      out.found++;
    }
  }

  const mg = [...t.matchAll(/([A-Za-z0-9+\-]{2,20})?\s*[—\-–:]?\s*(\d+(?:\.\d+)?)\s*mg\b/gi)];
  if (mg.length) {
    const parts = [...new Set(mg.map((h) => {
      const name = (h[1] ?? "").trim();
      const val = `${h[2]}mg`;
      return name && !/^\d+$/.test(name) ? `${name} ${val}` : val;
    }))];
    out.measured = parts.slice(0, 3).join(" · ");
    out.found++;
  } else if (/not\s*requested/i.test(t)) {
    out.measured = "Not requested";
    out.found++;
  }

  if (/\b(confirmed|conforms|complies|pass(?:es)?)\b/i.test(t)) {
    out.identity = "Confirmed";
    out.found++;
  } else if (out.purity) {
    // Se identifica el compuesto por espectrometría: si hay pureza, la identidad está confirmada
    out.identity = "Confirmed";
  }

  if (/heavy\s*metals?[^A-Za-z]{0,40}(not\s*detected|nd\b|pass(?:es)?|complies)/i.test(t)) {
    out.heavyMetals = "Not detected";
    out.found++;
  }

  const endo = t.match(/(<?\s*\d+(?:\.\d+)?\s*EU\s*\/\s*m[lL])/i);
  if (endo) {
    out.endotoxin = endo[1]!.replace(/\s+/g, " ").trim();
    out.found++;
  }

  // La última fecha del documento suele ser la del reporte
  const dates = [...t.matchAll(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g)];
  const last = dates.at(-1);
  if (last) {
    out.testedAt = iso(Number(last[3]), Number(last[1]), Number(last[2]));
    if (out.testedAt) out.found++;
  } else {
    const m = t.match(/\b([A-Z][a-z]{2,8})\.?\s+(\d{1,2}),?\s+(\d{4})\b/);
    const month = m ? MONTHS.indexOf(m[1]!.slice(0, 3).toLowerCase()) : -1;
    if (m && month >= 0) {
      out.testedAt = iso(Number(m[3]), month + 1, Number(m[2]));
      if (out.testedAt) out.found++;
    }
  }

  // El nombre va justo antes del código de lote: "NAD+ D4131", "GLP-1 SM D4130"
  if (out.lotNumber) {
    const before = t.slice(0, t.indexOf(out.lotNumber)).trim().split(" ");
    const words: string[] = [];
    for (let i = before.length - 1; i >= 0 && words.length < 4; i--) {
      const w = before[i]!;
      if (!w || /\d{5,}/.test(w) || /[/:]/.test(w.replace(/\/(?=[A-Za-z])/g, "")) || /^(result|identity|product|analysis|test|coa|of|certificate|sample|lot|batch)$/i.test(w)) break;
      words.unshift(w);
    }
    const cand = words.join(" ");
    if (cand.length >= 2 && cand.length <= 40) {
      out.title = cand;
      out.found++;
    }
  }
  if (!out.title) {
    const m = t.match(/([A-Z]{2,6}[\-\s]?\d{2,4}\s*[/+]\s*[A-Za-z]{2,3}\s*\d{0,4})/);
    if (m) {
      out.title = m[1]!.replace(/\s+/g, " ").trim();
      out.found++;
    }
  }
  return out;
}

/** Sugiere el producto comparando el nombre leído y el del archivo con el catálogo. */
export function matchProduct<T extends { id: number; name: string; slug: string }>(needle: string, products: T[]): T | null {
  // El laboratorio usa nombres GLP-1/2/3 para los productos PS-1/2/3
  const norm = (s: string) => s.toLowerCase().replace(/glp[\s-]*(\d)/g, "ps$1").replace(/[^a-z0-9]/g, "");
  const n = norm(needle);
  if (!n) return null;
  let best: { p: T; score: number } | null = null;
  for (const p of products) {
    for (const key of [p.name, p.slug]) {
      const k = norm(key).replace(/\d+(mg|ml)$/, "");
      if (k.length < 3) continue;
      const score = n.includes(k) ? k.length : 0;
      if (score && (!best || score > best.score)) best = { p, score };
    }
  }
  return best?.p ?? null;
}
