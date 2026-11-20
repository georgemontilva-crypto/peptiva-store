import { useState } from "react";
import { Link } from "react-router-dom";
import { trpc } from "../lib/trpc";
import { usePageMeta, useJsonLd, SITE_URL, formatPrice } from "../lib/format";
import { HERO_VIALS, DECOR_VIALS, VIALS, vialFor } from "../lib/site";
import ProductCard, { ProductCardSkeleton } from "../components/ProductCard";
import NewsletterForm from "../components/NewsletterForm";

const SEALS = [
  "≥99% HPLC purity",
  "Mass spec verified identity",
  "Third-party tested",
  "COA for every lot",
  "Lyophilized & sealed vials",
  "Ships same or next business day",
  "Cold-pack packaging",
  "U.S. based support",
];

function Arrow({ className = "" }: { className?: string }) {
  return (
    <svg width="24" height="10" viewBox="0 0 45 15" fill="none" className={`arrow ${className}`} aria-hidden>
      <path
        d="M44.7 8.2a1 1 0 0 0 0-1.4L38.3.4a1 1 0 1 0-1.4 1.4L42.6 7.5l-5.7 5.7a1 1 0 1 0 1.4 1.4l6.4-6.4zM0 8.5h44v-2H0z"
        fill="currentColor"
      />
    </svg>
  );
}

/* Iconos de línea, al estilo de las ilustraciones de la referencia */
const ico = { fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** Gradilla con dos tubos, vista en perspectiva. */
const IconRack = (p: { className?: string }) => (
  <svg viewBox="0 0 64 64" className={p.className} {...ico} aria-hidden>
    <path d="M17 28.6V8M26 27.4V6.8" />
    <ellipse cx="21.5" cy="7.4" rx="4.5" ry="1.9" />
    <path d="M17 31.4v8.4a4.5 4.5 0 0 0 9 0v-8.8" />
    <path d="M33.6 25.6V5.2M42.6 24.4V4" />
    <ellipse cx="38.1" cy="4.6" rx="4.5" ry="1.9" />
    <path d="M33.6 28.4v7.4a4.5 4.5 0 0 0 9 0v-7.8" />
    <path d="M7 27.6 39 21.2l18 7.1L25 34.7z" />
    <ellipse cx="21.5" cy="30" rx="4.6" ry="1.9" />
    <ellipse cx="38.1" cy="26.7" rx="4.6" ry="1.9" />
    <path d="M7 27.6v17.6M25 34.7v17.6M57 28.3v17.6M39 21.2v17.6" />
    <path d="M7 45.2 39 38.8l18 7.1L25 52.3z" />
  </svg>
);
/** Pipeta sobre placa de Petri. */
const IconPipette = (p: { className?: string }) => (
  <svg viewBox="0 0 64 64" className={p.className} {...ico} aria-hidden>
    <ellipse cx="34" cy="45" rx="21" ry="7.5" />
    <path d="M13 45v4.5M55 45v4.5" />
    <path d="M13 49.5a21 7.5 0 0 0 42 0" />
    <circle cx="16" cy="12" r="5.6" />
    <path d="M19.7 16.2 36.5 33M12.9 18.2 29.7 35" />
    <path d="m36.5 33-6.8 2 2-6.8z" />
  </svg>
);
/** Lupa con burbujas y mango rayado. */
const IconLens = (p: { className?: string }) => (
  <svg viewBox="0 0 64 64" className={p.className} {...ico} aria-hidden>
    <circle cx="25" cy="25" r="15" />
    <circle cx="25" cy="25" r="12" />
    <circle cx="21" cy="22" r="3.6" />
    <circle cx="28.5" cy="28" r="2.2" />
    <path d="M35.6 35.6 56 56M38.8 32.4 59.2 52.8" />
    <path d="m39.5 40.5 4-4M44 45l4-4M48.5 49.5l4-4" />
  </svg>
);
/** Cronómetro con líneas de velocidad. */
const IconTimer = (p: { className?: string }) => (
  <svg viewBox="0 0 64 64" className={p.className} {...ico} aria-hidden>
    <circle cx="38" cy="34" r="17" />
    <circle cx="38" cy="34" r="2" />
    <path d="M38 34 27 25M38 34h11" />
    <path d="M33 11.5h10l1 6.5H32z" />
    <path d="M4 22h18M10 30h12M4 38h16M14 46h10" />
  </svg>
);
/** Camión de reparto con líneas de movimiento. */
const IconTruck = (p: { className?: string }) => (
  <svg viewBox="0 0 64 64" className={p.className} {...ico} aria-hidden>
    <path d="M14 20.5 44 16v24l-30 4z" />
    <path d="M44 24h7l8 9v7h-15z" />
    <circle cx="23" cy="46" r="4.2" />
    <circle cx="36" cy="45" r="4.2" />
    <circle cx="52" cy="43.5" r="4.2" />
    <path d="M23 46h.01M36 45h.01M52 43.5h.01" />
    <path d="M2 19h10M16 16h4M2 26h14M4 32h8" />
  </svg>
);
/** Molécula: núcleo con cuatro enlaces. */
const IconMolecule = (p: { className?: string }) => (
  <svg viewBox="0 0 64 64" className={p.className} {...ico} aria-hidden>
    <circle cx="32" cy="32" r="8.5" />
    <circle cx="12" cy="13" r="5" />
    <circle cx="55" cy="26" r="4.5" />
    <circle cx="50" cy="50" r="4.5" />
    <circle cx="20" cy="52" r="4.5" />
    <path d="M16.6 17.1 26.4 26M14.4 19.4 24.2 28.3" />
    <path d="M40.3 29.6 50.5 27M40.8 32.8 51 30.2" />
    <path d="m37.6 38.6 8.6 7.6M35.4 41.1l8.6 7.6" />
    <path d="m26.6 38.8-4.8 8.6M23.8 37.2 19 45.8" />
  </svg>
);
const IconShield = (p: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={p.className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 3l7 3v5.5c0 4.2-2.9 7.7-7 9.5-4.1-1.8-7-5.3-7-9.5V6z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);
const IconDoc = (p: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={p.className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5M9 13h6M9 17h4" />
  </svg>
);

const GUARANTEE = [
  {
    edge: "bg-teal",
    chip: "bg-teal-soft text-navy",
    Icon: IconShield,
    title: "99%+ purity guaranteed",
    sub: "Every lot assayed by HPLC before release",
  },
  {
    edge: "bg-navy",
    chip: "bg-sky text-navy",
    Icon: IconDoc,
    title: "A COA with every lot",
    sub: "Published on the site, not sent on request",
  },
  {
    edge: "bg-amber-300",
    chip: "bg-amber-100 text-amber-700",
    Icon: IconTruck,
    title: "Free U.S. shipping",
    sub: "Dispatched same or next business day",
  },
];

const PROCUREMENT = [
  {
    title: "Documentation with every lot",
    body: "Each product page links the current Certificate of Analysis, with the lot number, the identity confirmation and the purity result on the same page as the price.",
    cta: { to: "/coas", label: "Browse the certificates" },
    Icon: IconRack,
  },
  {
    title: "Research-grade material at catalog pricing",
    body: "A United States supplier with list prices set for research budgets, and bundle pricing that lowers the unit cost from the second vial onward.",
    cta: { to: "/shop", label: "See the catalog" },
    Icon: IconPipette,
  },
  {
    title: "Support that answers specifications",
    body: "Questions about purity results, reconstitution, storage or bulk quantities are answered by email within one business day.",
    cta: { to: "/contact", label: "Contact support" },
    Icon: IconLens,
  },
  {
    title: "Shipped and tracked across the U.S.",
    body: "Insulated packaging with cold packs, tracking on every order, and an order-tracking page where the status is available at any time.",
    cta: { to: "/track-order", label: "Track an order" },
    Icon: IconTimer,
  },
];

const QUALITY_TABS = [
  {
    key: "Purity",
    Icon: IconShield,
    title: "Chromatographic purity",
    method: "HPLC analysis",
    body: "Each lot is run by high-performance liquid chromatography and released only at 99% or above. The reported purity is part of the Certificate of Analysis for that lot.",
  },
  {
    key: "Identity",
    Icon: IconMolecule,
    title: "Confirmed identity",
    method: "Mass spectrometry",
    body: "The molecular weight of every lot is confirmed against the expected mass for the sequence, so the vial contains the compound the label states and not a close analogue.",
  },
  {
    key: "Documentation",
    Icon: IconDoc,
    title: "Traceable by lot number",
    method: "Certificate of Analysis",
    body: "Results are tied to the lot number printed on your vial, and every certificate stays published, so a result can be retrieved months after the order.",
  },
  {
    key: "Handling",
    Icon: IconTimer,
    title: "Stable on arrival",
    method: "Lyophilized & sealed",
    body: "Material ships lyophilized in sealed vials with cold packs and insulated packaging, ready to be stored sealed and protected from light.",
  },
];

/**
 * Frascos sueltos de fondo. Las posiciones están escritas a mano para que la nube quede repartida y
 * salga siempre igual; los de atrás van más pequeños, más claros y desenfocados para dar profundidad.
 */
const SCATTER: { top: string; left: string; size: number; rot: number; dim: number; blur: number }[] = [
  { top: "2%", left: "3%", size: 76, rot: -18, dim: 0.5, blur: 1.5 },
  { top: "0%", left: "13%", size: 58, rot: 22, dim: 0.35, blur: 2 },
  { top: "9%", left: "23%", size: 92, rot: -8, dim: 0.75, blur: 0 },
  { top: "-2%", left: "35%", size: 48, rot: 14, dim: 0.3, blur: 2.5 },
  { top: "6%", left: "62%", size: 70, rot: 26, dim: 0.5, blur: 1.5 },
  { top: "1%", left: "73%", size: 100, rot: -14, dim: 0.8, blur: 0 },
  { top: "4%", left: "86%", size: 62, rot: 10, dim: 0.45, blur: 2 },
  { top: "10%", left: "95%", size: 80, rot: -24, dim: 0.6, blur: 1 },
  { top: "28%", left: "1%", size: 64, rot: 12, dim: 0.4, blur: 2 },
  { top: "22%", left: "14%", size: 54, rot: -20, dim: 0.35, blur: 2.5 },
  { top: "34%", left: "88%", size: 58, rot: 18, dim: 0.4, blur: 2 },
  { top: "26%", left: "96%", size: 74, rot: -10, dim: 0.55, blur: 1 },
  { top: "52%", left: "4%", size: 96, rot: 20, dim: 0.75, blur: 0 },
  { top: "60%", left: "16%", size: 52, rot: -16, dim: 0.3, blur: 2.5 },
  { top: "56%", left: "84%", size: 88, rot: -22, dim: 0.7, blur: 0.5 },
  { top: "66%", left: "94%", size: 56, rot: 16, dim: 0.35, blur: 2 },
  { top: "80%", left: "2%", size: 60, rot: -12, dim: 0.4, blur: 2 },
  { top: "86%", left: "12%", size: 84, rot: 24, dim: 0.65, blur: 0.5 },
  { top: "90%", left: "30%", size: 54, rot: -18, dim: 0.3, blur: 2.5 },
  { top: "84%", left: "68%", size: 68, rot: 14, dim: 0.45, blur: 1.5 },
  { top: "92%", left: "80%", size: 92, rot: -8, dim: 0.7, blur: 0 },
  { top: "76%", left: "92%", size: 50, rot: 20, dim: 0.3, blur: 2.5 },
];

const ALL_VIALS = Object.values(VIALS);

function ScatterVials() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {SCATTER.map((s, i) => (
        <img
          key={i}
          src={ALL_VIALS[i % ALL_VIALS.length]}
          alt=""
          className="absolute rounded-none object-contain"
          style={{
            top: s.top,
            left: s.left,
            width: s.size * 0.82,
            transform: `translate(-50%, -50%) rotate(${s.rot}deg)`,
            opacity: s.dim * 0.85,
            filter: s.blur ? `blur(${s.blur}px)` : undefined,
          }}
        />
      ))}
    </div>
  );
}

export default function Home() {
  usePageMeta(
    "Peptiva Supplies | Research Peptides for Laboratories | 99%+ HPLC Purity",
    "Research peptides supplied at 99%+ HPLC purity with a third-party Certificate of Analysis published for every lot. Free U.S. shipping, same or next business day dispatch. Laboratory research use only.",
  );
  const { data: products } = trpc.catalog.products.useQuery();
  const coas = trpc.content.coas.useQuery();
  const faq = trpc.content.faq.useQuery();
  const [tab, setTab] = useState(0);

  const featured = products?.slice(0, 8);
  /** Frasco recortado para la composición número i: el del producto destacado si el catálogo ya cargó. */
  const cut = (i: number) => (products?.[i] ? vialFor(products[i]!.slug, i) : (DECOR_VIALS[i % DECOR_VIALS.length] ?? HERO_VIALS[0]!));

  useJsonLd(
    "home-items",
    featured?.length
      ? {
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "Research peptides at Peptiva Supplies",
          itemListElement: featured.map((p, i) => ({ "@type": "ListItem", position: i + 1, name: p.name, url: `${SITE_URL}/product/${p.slug}` })),
        }
      : null,
  );

  const faqTop = faq.data?.slice(0, 8);
  useJsonLd(
    "home-faq",
    faqTop?.length
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqTop.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() },
          })),
        }
      : null,
  );

  const active = QUALITY_TABS[tab]!;

  return (
    <>
      {/* ===================== HERO ===================== */}
      <section className="relative overflow-hidden lg:h-[560px] xl:h-[620px]" aria-label="Peptiva Supplies: research peptides for laboratories">
        <div className="absolute inset-0 flex flex-col lg:flex-row" aria-hidden>
          <div className="hidden bg-white lg:block lg:w-1/2" />
          <div className="panel-soft flex-1" />
        </div>

        <div className="wrap relative h-full">
          <div className="flex h-full flex-col lg:grid lg:grid-cols-2 lg:items-center">
            <div className="order-2 z-20 flex flex-col items-center gap-5 pb-14 pt-6 text-center lg:order-1 lg:items-start lg:pb-0 lg:pt-0 lg:text-left">
              <h1 className="max-w-md text-[2.7rem] font-semibold leading-[1.03] sm:text-[3.2rem] lg:max-w-xl lg:text-[3.6rem] xl:text-[4rem]">
                Research peptides <span className="serif">your lab</span> can verify.
              </h1>
              <p className="max-w-sm text-base leading-relaxed text-slate sm:text-lg lg:max-w-md lg:text-xl">
                Lyophilized compounds at 99%+ HPLC purity, each lot documented with a third-party Certificate of Analysis.
              </p>
              <div className="flex flex-col gap-3 pt-1 min-[420px]:flex-row">
                <Link to="/shop" className="btn btn-primary">
                  Shop research peptides <Arrow />
                </Link>
                <Link to="/coas" className="btn btn-ghost">View lab results</Link>
              </div>
            </div>

            {/* En escritorio la composición ocupa toda la mitad derecha de la pantalla y se recorta en los bordes */}
            <div
              className="relative order-1 h-[280px] w-full sm:h-[360px] lg:absolute lg:inset-y-0 lg:left-1/2 lg:right-0 lg:order-2 lg:h-full lg:w-1/2"
              aria-hidden
            >
              <img src={HERO_VIALS[0]} alt="" className="vial float-shadow absolute bottom-[-8%] left-[2%] h-[64%] w-auto max-w-none rotate-[-9deg] rounded-none object-contain" />
              <img src={HERO_VIALS[1]} alt="" className="vial float-shadow absolute bottom-[-6%] left-[28%] z-10 h-[84%] w-auto max-w-none rotate-[3deg] rounded-none object-contain" style={{ animationDelay: "-2s" }} />
              <img src={HERO_VIALS[2]} alt="" className="vial float-shadow absolute bottom-[4%] right-[-2%] h-[52%] w-auto max-w-none rotate-[12deg] rounded-none object-contain" style={{ animationDelay: "-4s" }} />
            </div>
          </div>
        </div>
      </section>

      {/* ===================== CINTA ===================== */}
      <section aria-label="Quality standards" className="ticker overflow-hidden bg-ink py-3.5 text-white">
        <div className="ticker-track flex w-max gap-12 whitespace-nowrap">
          {[...SEALS, ...SEALS].map((s, i) => (
            <span key={i} className="flex items-center gap-12 text-[0.9rem] font-light" aria-hidden={i >= SEALS.length}>
              {s}
              <span className="h-1.5 w-1.5 rounded-full bg-teal" />
            </span>
          ))}
        </div>
      </section>

      {/* ===================== GARANTÍA (panel partido a sangre) ===================== */}
      <section data-reveal className="grid lg:grid-cols-2">
        <div className="band-lilac relative flex min-h-[320px] items-center justify-center overflow-hidden p-10 lg:min-h-[520px]" aria-hidden>
          <img src={cut(3)} alt="" className="vial float-shadow h-[260px] w-auto max-w-none rotate-[-10deg] rounded-none object-contain lg:h-[400px]" />
          <div className="absolute bottom-10 right-6 rounded-2xl bg-white/90 p-4 shadow-[0_20px_40px_-22px_rgba(12,42,71,0.45)] backdrop-blur lg:right-12">
            <p className="text-sm font-semibold">99%+ purity</p>
            <p className="text-xs font-light text-slate">Verified by HPLC</p>
          </div>
        </div>

        <div className="flex items-center bg-white px-5 py-16 lg:px-14 lg:py-20">
          <div className="w-full max-w-xl">
            <h2 className="text-3xl font-semibold sm:text-[2.6rem]">The Peptiva supply guarantee</h2>
            <p className="mt-4 text-lg font-light leading-relaxed text-slate">
              Three things every order carries, whether it is one vial or a full bundle.
            </p>
            <ul className="mt-8 space-y-3">
              {GUARANTEE.map((g) => (
                <li key={g.title} className="flex overflow-hidden rounded-2xl bg-mist">
                  <span className={`w-1.5 shrink-0 ${g.edge}`} aria-hidden />
                  <div className="flex items-center gap-4 px-5 py-4">
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${g.chip}`} aria-hidden>
                      <g.Icon className="h-5 w-5" />
                    </span>
                    <span>
                      <span className="block font-semibold">{g.title}</span>
                      <span className="block text-sm font-light text-slate">{g.sub}</span>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ===================== PRECIO POR CANTIDAD ===================== */}
      <section className="band-pastel relative overflow-hidden" data-reveal>
        <ScatterVials />
        <div className="wrap relative py-20 text-center lg:py-28">
          <span className="chip bg-white/80 text-navy">
            <span className="h-1.5 w-1.5 rounded-full bg-teal" aria-hidden />
            Bundle pricing
          </span>
          <h2 className="mx-auto mt-6 max-w-3xl text-[2.2rem] font-semibold leading-[1.08] sm:text-[3rem]">
            Stocking the bench? <span className="serif">Up to 15% off</span> per vial.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-lg font-light leading-relaxed text-slate">
            Buy two units of the same product and the discount applies automatically at checkout. From three units it goes to 15%, with no
            subscription and no minimum order.
          </p>
          <ul className="mt-8 flex flex-wrap justify-center gap-2.5 text-sm">
            <li className="chip bg-ink text-white">2 units · 10% off</li>
            <li className="chip bg-teal-soft text-navy">3+ units · 15% off</li>
            <li className="chip border border-line bg-white text-ink">Free U.S. shipping</li>
          </ul>

          <div className="mx-auto mt-10 flex max-w-xl items-center gap-5 rounded-[1.75rem] bg-white p-5 text-left shadow-[0_28px_60px_-35px_rgba(12,42,71,0.55)]">
            <div className="relative shrink-0 rounded-2xl bg-mist p-2">
              <img src={cut(0)} alt="" className="h-20 w-16 rounded-none object-contain" />
              <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-ink px-2 py-0.5 text-[0.65rem] font-semibold text-white">×3</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">Same product, three vials</p>
              <p className="text-sm font-light text-slate">Bundle applied in the cart</p>
              <span className="mt-2 inline-block rounded-full bg-teal-soft px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-wide text-navy">15% off applied</span>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted line-through">{formatPrice(179.97)}</p>
              <p className="text-2xl font-semibold tabular-nums">{formatPrice(152.97)}</p>
              <p className="text-xs font-medium text-teal">Save {formatPrice(27)}</p>
            </div>
          </div>

          <div className="mt-9">
            <Link to="/shop?category=bundle-save" className="btn btn-primary">
              See bundle pricing <Arrow />
            </Link>
          </div>
          <p className="mt-4 text-sm font-light text-slate">No subscription. An adult signature is required on delivery.</p>
        </div>
      </section>

      {/* ===================== PROCUREMENT ===================== */}
      <section className="band-mint" data-reveal>
        <div className="wrap py-20 lg:py-28">
          <h2 className="text-center text-[2.1rem] font-semibold sm:text-[2.9rem]">Built for laboratory procurement</h2>
          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            {PROCUREMENT.map((p) => (
              <article key={p.title} className="flex items-start gap-5 rounded-[1.75rem] bg-white p-7 shadow-[0_24px_50px_-38px_rgba(12,42,71,0.5)]">
                <div className="min-w-0 flex-1">
                  <h3 className="text-xl font-semibold leading-snug">{p.title}</h3>
                  <p className="mt-3 text-[0.95rem] font-light leading-relaxed text-slate">{p.body}</p>
                  <Link to={p.cta.to} className="btn btn-ghost mt-5 text-sm">{p.cta.label}</Link>
                </div>
                <p.Icon className="hidden h-20 w-20 shrink-0 text-muted sm:block" />
              </article>
            ))}
            <article className="flex items-center justify-between gap-6 rounded-[1.75rem] bg-white p-7 shadow-[0_24px_50px_-38px_rgba(12,42,71,0.5)] lg:col-span-2">
              <h3 className="text-xl font-semibold">Free U.S. shipping on every order, no minimum</h3>
              <div className="flex shrink-0 items-center gap-5">
                <Link to="/shipping-policy" className="btn btn-ghost text-sm">Read the shipping policy</Link>
                <IconTruck className="hidden h-16 w-16 text-muted sm:block" />
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* ===================== CALIDAD ===================== */}
      <section className="wrap py-20 lg:py-28" data-reveal>
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <h2 className="text-[2.1rem] font-semibold sm:text-[2.9rem]">Quality your lab can verify</h2>
            <p className="mt-5 max-w-md text-lg font-light leading-relaxed text-slate">
              Every lot is tested by an independent laboratory before release, and the full result is published on this site for your quality
              records.
            </p>

            <div className="mt-8 flex flex-wrap gap-2.5" role="tablist" aria-label="Testing performed on every lot">
              {QUALITY_TABS.map((t, i) => (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  id={`qtab-${i}`}
                  aria-selected={tab === i}
                  aria-controls={`qpanel-${i}`}
                  onClick={() => setTab(i)}
                  className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors ${tab === i ? "bg-ink font-medium text-white" : "bg-mist text-slate hover:bg-line"}`}
                >
                  <t.Icon className="h-4 w-4" />
                  {t.key}
                </button>
              ))}
            </div>

            <div role="tabpanel" id={`qpanel-${tab}`} aria-labelledby={`qtab-${tab}`} className="mt-6 rounded-[1.5rem] border border-line bg-mist p-7">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-xl font-semibold">{active.title}</h3>
                <span className="chip bg-white text-navy">
                  <span className="h-1.5 w-1.5 rounded-full bg-teal" aria-hidden />
                  {active.method}
                </span>
              </div>
              <p className="mt-3 text-[0.95rem] font-light leading-relaxed text-slate">{active.body}</p>
            </div>

            <Link to="/shop" className="btn btn-primary mt-8">
              Shop the catalog <Arrow />
            </Link>
          </div>

          {/* Panel con el frasco inclinado y tarjetas flotantes */}
          <div className="relative">
            <div className="panel-ice relative overflow-hidden rounded-[2.5rem] px-10 pb-28 pt-14">
              <div className="lab-grid absolute inset-0 opacity-60" aria-hidden />
              <img src={cut(4)} alt="" className="vial float-shadow relative mx-auto h-[300px] w-auto max-w-full rotate-[-12deg] rounded-none object-contain lg:h-[360px]" aria-hidden />
              <div className="scan-line pointer-events-none absolute inset-x-0 top-0 h-full" aria-hidden />
            </div>
            <div className="absolute right-4 top-6 flex items-center gap-3 rounded-2xl bg-white p-4 shadow-[0_22px_45px_-22px_rgba(12,42,71,0.45)]">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-soft text-navy" aria-hidden>
                <IconShield className="h-4 w-4" />
              </span>
              <span>
                <span className="block text-sm font-semibold">99%+ purity</span>
                <span className="block text-xs font-light text-slate">Verified by HPLC</span>
              </span>
            </div>
            <Link
              to="/coas"
              className="absolute inset-x-6 bottom-6 flex items-center gap-4 rounded-2xl bg-white px-5 py-4 shadow-[0_22px_45px_-22px_rgba(12,42,71,0.45)] transition-transform hover:-translate-y-0.5"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-mist text-navy" aria-hidden>
                <IconDoc className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">See the certificates</span>
                <span className="block truncate text-xs font-light text-slate">
                  {coas.data ? `${coas.data.length} lots published` : "Certificate of Analysis by lot"}
                </span>
              </span>
              <svg viewBox="0 0 20 20" className="h-5 w-5 shrink-0 text-muted" fill="currentColor" aria-hidden>
                <path d="M7.3 4.3a1 1 0 0 1 1.4 0l5 5a1 1 0 0 1 0 1.4l-5 5a1 1 0 0 1-1.4-1.4L11.6 10 7.3 5.7a1 1 0 0 1 0-1.4z" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* ===================== CATÁLOGO ===================== */}
      <section className="band-ice" data-reveal>
        <div className="wrap py-20 lg:py-24">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-[2.1rem] font-semibold sm:text-[2.9rem]">Most requested compounds</h2>
              <p className="mt-3 text-lg font-light text-slate">Each one ships with the certificate for its lot.</p>
            </div>
            <Link to="/shop" className="font-medium text-ink underline underline-offset-4">
              All {products?.length ?? ""} research peptides
            </Link>
          </div>
          <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 sm:gap-y-12 md:grid-cols-4">
            {featured ? featured.map((p) => <ProductCard key={p.id} product={p} />) : Array.from({ length: 8 }, (_, i) => <ProductCardSkeleton key={i} />)}
          </div>
        </div>
      </section>

      {/* ===================== FAQ ===================== */}
      {faqTop?.length ? (
        <section className="wrap py-20 lg:py-28" data-reveal>
          <h2 className="text-center text-[2.1rem] font-semibold sm:text-[2.9rem]">Frequently asked questions</h2>
          <div className="mx-auto mt-12 max-w-3xl divide-y divide-line border-t border-line">
            {faqTop.map((item) => (
              <details key={item.q} className="group py-6">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-[1.1rem] font-medium text-ink marker:hidden">
                  {item.q}
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-mist transition-transform group-open:rotate-180" aria-hidden>
                    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
                      <path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" />
                    </svg>
                  </span>
                </summary>
                <div className="prose-copy mt-3 text-[0.95rem] font-light" dangerouslySetInnerHTML={{ __html: item.a }} />
              </details>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link to="/faq" className="btn btn-ghost">Read the full FAQ</Link>
          </div>
        </section>
      ) : null}

      {/* ===================== CIERRE ===================== */}
      <section className="band-pastel relative overflow-hidden" data-reveal>
        {/* Frascos asomando por las esquinas, como en la referencia */}
        <img src={cut(5)} alt="" className="vial pointer-events-none absolute -left-10 top-6 hidden h-44 w-auto max-w-none rotate-[18deg] rounded-none object-contain opacity-90 md:block" aria-hidden />
        <img src={cut(2)} alt="" className="vial pointer-events-none absolute -right-8 bottom-24 hidden h-48 w-auto max-w-none rotate-[-14deg] rounded-none object-contain opacity-90 md:block" style={{ animationDelay: "-3s" }} aria-hidden />

        <div className="wrap relative py-20 text-center lg:py-28">
          <h2 className="mx-auto max-w-3xl text-[2.2rem] font-semibold leading-[1.1] sm:text-[3rem]">
            Research peptides for your lab, with the{" "}
            <span className="relative inline-block">
              documentation
              <span className="absolute inset-x-0 -bottom-1 h-[6px] rounded-full bg-teal/60" aria-hidden />
            </span>{" "}
            your records expect.
          </h2>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 min-[420px]:flex-row">
            <Link to="/shop" className="btn btn-primary">
              Shop the catalog <Arrow />
            </Link>
            <Link to="/contact" className="btn btn-ghost">Talk to support</Link>
          </div>

          <div className="mx-auto mt-16 flex max-w-3xl flex-col items-center gap-6 rounded-[1.75rem] bg-lilac/70 p-8 text-left backdrop-blur sm:flex-row sm:justify-between">
            <div>
              <h3 className="text-xl font-semibold">Restock and new-lot notices</h3>
              <p className="mt-1 text-[0.95rem] font-light text-slate">
                New compounds, restock alerts and new certificates. No more than twice a month.
              </p>
            </div>
            <div className="w-full shrink-0 sm:w-auto">
              <NewsletterForm />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
