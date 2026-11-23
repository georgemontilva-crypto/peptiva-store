/**
 * Frascos recortados sobre fondo transparente, listos para las composiciones que flotan sobre los
 * degradados. Son archivos del proyecto: se recortaron una vez a partir de las fotos de estudio, así
 * que no dependen de ningún proceso en tiempo real ni de que el recorte automático acierte.
 */
export const VIALS = {
  "bacteriostatic-water": "/vials/bacteriostatic-water.webp",
  "bpc-157-tb-500": "/vials/bpc-157-tb-500.webp",
  "bpc-157": "/vials/bpc-157.webp",
  "cjc-1295-ipamorelin": "/vials/cjc-1295-ipamorelin.webp",
  epithalon: "/vials/epithalon.webp",
  "ghk-cu": "/vials/ghk-cu.webp",
  glow: "/vials/glow.webp",
  ipamorelin: "/vials/ipamorelin.webp",
  kpv: "/vials/kpv.webp",
  "mots-c": "/vials/mots-c.webp",
  "mt-1": "/vials/mt-1.webp",
  "mt-2": "/vials/mt-2.webp",
  nad: "/vials/nad.webp",
  selank: "/vials/selank.webp",
  semax: "/vials/semax.webp",
  tb500: "/vials/tb500.webp",
  tesamorelin: "/vials/tesamorelin.webp",
  "ps-1": "/vials/ps-1.webp",
  "ps-2": "/vials/ps-2.webp",
  "ps-3": "/vials/ps-3.webp",
  glutathione: "/vials/glutathione.webp",
  klow: "/vials/klow.webp",
  "pt-141": "/vials/pt-141.webp",
} as const;

/** Los tres del hero, en orden: izquierda, centro (el grande) y derecha. */
export const HERO_VIALS = [VIALS["bpc-157"], VIALS.tb500, VIALS["mots-c"]];

/** Frascos para las demás composiciones de la portada. */
export const DECOR_VIALS = [VIALS["ghk-cu"], VIALS.nad, VIALS.semax, VIALS.selank, VIALS.kpv, VIALS.glow];

/**
 * Alias de cada frasco. Se buscan de más largo a más corto para que "bpc-157-tb-500" no se confunda
 * con "bpc-157".
 */
const VIAL_ALIASES: [string, string][] = [
  ["bpc157tb500", VIALS["bpc-157-tb-500"]],
  ["bpc157tb", VIALS["bpc-157-tb-500"]],
  ["cjc1295ipamorelin", VIALS["cjc-1295-ipamorelin"]],
  ["bacteriostatic", VIALS["bacteriostatic-water"]],
  ["tesamorelin", VIALS.tesamorelin],
  ["glutathione", VIALS.glutathione],
  ["ipamorelin", VIALS.ipamorelin],
  ["epithalon", VIALS.epithalon],
  ["melanotan1", VIALS["mt-1"]],
  ["melanotan2", VIALS["mt-2"]],
  ["cjc1295", VIALS["cjc-1295-ipamorelin"]],
  ["bpc157", VIALS["bpc-157"]],
  ["selank", VIALS.selank],
  ["ghkcu", VIALS["ghk-cu"]],
  ["motsc", VIALS["mots-c"]],
  ["tb500", VIALS.tb500],
  ["semax", VIALS.semax],
  ["pt141", VIALS["pt-141"]],
  ["glow", VIALS.glow],
  ["klow", VIALS.klow],
  ["mots", VIALS["mots-c"]],
  ["nad", VIALS.nad],
  ["kpv", VIALS.kpv],
  ["ps1", VIALS["ps-1"]],
  ["ps2", VIALS["ps-2"]],
  ["ps3", VIALS["ps-3"]],
  ["mt1", VIALS["mt-1"]],
  ["mt2", VIALS["mt-2"]],
];

/** Devuelve el frasco recortado que corresponde a un producto, o uno por defecto si no hay. */
export function vialFor(slug: string | null | undefined, fallbackIndex = 0): string {
  const key = (slug ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (key) {
    const hit = VIAL_ALIASES.find(([alias]) => key.includes(alias));
    if (hit) return hit[1];
  }
  return DECOR_VIALS[fallbackIndex % DECOR_VIALS.length]!;
}

export const SUPPORT_EMAIL = "support@peptivasupplies.com";

export const POLICY_LINKS = [
  { to: "/shipping-policy", label: "Shipping policy" },
  { to: "/return-refund", label: "Returns & refunds" },
  { to: "/terms-conditions", label: "Terms & conditions" },
  { to: "/privacy-policy", label: "Privacy policy" },
];

export type NavItem = { label: string; to?: string; badge?: string; children?: { to: string; label: string; description?: string }[] };

/**
 * Menú principal. Los enlaces describen lo que hay detrás ("Research Peptides" en vez de "Shop"),
 * que es lo que lee el buscador y lo que busca un laboratorio.
 */
export const MAIN_NAV: NavItem[] = [
  { label: "Research Peptides", to: "/shop" },
  { label: "Bundle Pricing", to: "/shop?category=bundle-save", badge: "Save" },
  { label: "COAs", to: "/coas" },
  { label: "Contact us", to: "/contact" },
  {
    label: "More",
    children: [
      { to: "/about-us", label: "About Us", description: "Our standards and sourcing" },
      { to: "/blog", label: "Research Guides", description: "Reading labels, COAs and lot records" },
      { to: "/faq", label: "FAQ", description: "Purity, shipping and storage" },
      { to: "/track-order", label: "Track order", description: "Status and tracking number" },
      { to: "/affiliate", label: "Affiliate Program", description: "Earn on referred research orders" },
    ],
  },
];

export const COMPANY_LINKS = [
  { to: "/about-us", label: "About Us" },
  { to: "/faq", label: "FAQ" },
  { to: "/contact", label: "Contact" },
  { to: "/affiliate", label: "Affiliate Program" },
];
