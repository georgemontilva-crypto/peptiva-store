import { useState } from "react";
import { Link } from "react-router-dom";
import { trpc } from "../lib/trpc";
import { usePageMeta, useJsonLd, SITE_URL, formatPrice } from "../lib/format";
import { HERO_VIALS } from "../lib/site";
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

/** Flecha del botón, igual en toda la web. */
function Arrow() {
  return (
    <svg width="22" height="9" viewBox="0 0 45 15" fill="none" className="arrow" aria-hidden>
      <path
        d="M44.7 8.2a1 1 0 0 0 0-1.4L38.3.4a1 1 0 1 0-1.4 1.4L42.6 7.5l-5.7 5.7a1 1 0 1 0 1.4 1.4l6.4-6.4zM0 8.5h44v-2H0z"
        fill="currentColor"
      />
    </svg>
  );
}

const GUARANTEE = [
  {
    title: "99%+ purity, verified",
    body: "Every lot is assayed by HPLC before it is released. If an independent test comes back under 99%, we refund that product in full.",
    tag: "Every lot assayed",
  },
  {
    title: "A COA for every lot",
    body: "The Certificate of Analysis for the lot you receive is published on this site, with its identity and purity results, so it can go straight into your quality file.",
    tag: "Published, not on request",
  },
  {
    title: "Free U.S. shipping",
    body: "Orders are packed in sealed, lyophilized vials with cold packs and dispatched the same or next business day, at no shipping cost to your lab.",
    tag: "Same or next business day",
  },
];

const PROCUREMENT = [
  {
    title: "Documentation with every order",
    body: "Each product page links the current Certificate of Analysis, with the lot number, the identity confirmation and the purity result on the same page as the price.",
    cta: { to: "/coas", label: "Browse the certificates" },
  },
  {
    title: "Research-grade material at catalog pricing",
    body: "A United States supplier with list prices set for research budgets, and bundle pricing that drops the unit cost from the second vial onward.",
    cta: { to: "/shop", label: "See the catalog" },
  },
  {
    title: "Support that answers specifications",
    body: "Questions about purity results, reconstitution, storage or bulk quantities are answered by email within one business day.",
    cta: { to: "/contact", label: "Contact support" },
  },
  {
    title: "Shipped and tracked across the U.S.",
    body: "Insulated packaging, tracking on every order and an order-tracking page where the status and tracking number are available at any time.",
    cta: { to: "/track-order", label: "Track an order" },
  },
];

const QUALITY_TABS = [
  {
    key: "Purity",
    title: "Chromatographic purity",
    method: "HPLC",
    body: "Each lot is run by high-performance liquid chromatography and released only at 99% or above. The chromatogram and the reported purity are part of the Certificate of Analysis for that lot.",
  },
  {
    key: "Identity",
    title: "Confirmed identity",
    method: "Mass spectrometry",
    body: "The molecular weight of every lot is confirmed against the expected mass for the sequence, so the vial contains the compound the label states and not a close analogue.",
  },
  {
    key: "Documentation",
    title: "Traceable by lot number",
    method: "Certificate of Analysis",
    body: "Results are tied to the lot number printed on your vial. Every certificate stays published on the COAs page, so a result can be retrieved months after the order.",
  },
  {
    key: "Handling",
    title: "Stable on arrival",
    method: "Lyophilized & sealed",
    body: "Material ships lyophilized in sealed vials with cold packs and insulated packaging. Stored sealed at -20 °C and protected from light, it remains stable for long-term laboratory use.",
  },
];

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

  // Lista de productos destacados para el buscador
  useJsonLd(
    "home-items",
    featured?.length
      ? {
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "Research peptides at Peptiva Supplies",
          itemListElement: featured.map((p, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: p.name,
            url: `${SITE_URL}/product/${p.slug}`,
          })),
        }
      : null,
  );

  // Preguntas frecuentes en formato FAQPage: es lo que Google muestra desplegado bajo el resultado
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

  return (
    <>
      {/* ===== Hero: mitad blanca, mitad degradado, como la referencia ===== */}
      <section className="relative overflow-hidden" aria-label="Peptiva Supplies: research peptides for laboratories">
        <div className="absolute inset-0 flex flex-col lg:flex-row" aria-hidden>
          <div className="hidden bg-white lg:block lg:w-1/2" />
          <div className="panel-soft flex-1" />
        </div>
        <div className="wrap relative">
          <div className="flex flex-col lg:grid lg:min-h-[480px] lg:grid-cols-2 lg:items-center">
            <div className="order-2 z-20 flex flex-col items-center gap-4 pb-12 pt-4 text-center lg:order-1 lg:items-start lg:py-12 lg:text-left">
              <h1 className="max-w-md text-[2.6rem] font-semibold leading-[1.04] sm:text-5xl lg:max-w-lg lg:text-[3.4rem] xl:text-[3.9rem]">
                Research peptides your lab can verify.
              </h1>
              <p className="max-w-sm text-base leading-relaxed text-slate sm:text-lg lg:max-w-md lg:text-xl">
                Lyophilized compounds at 99%+ HPLC purity, each lot documented with a third-party Certificate of Analysis. Shipped free
                across the United States for laboratory research use only.
              </p>
              <div className="flex flex-col gap-3 pt-2 min-[420px]:flex-row">
                <Link to="/shop" className="btn btn-primary">
                  Shop research peptides <Arrow />
                </Link>
                <Link to="/coas" className="btn btn-ghost">View lab results</Link>
              </div>
            </div>

            <div className="order-1 flex items-end justify-center gap-2 pt-8 lg:order-2 lg:h-full lg:pt-0" aria-hidden>
              {HERO_VIALS.map((src, i) => (
                <div key={src} className={`flex flex-col items-center ${i === 1 ? "z-10 -mx-4 mb-10 w-[38%] max-w-[210px]" : "w-[31%] max-w-[170px]"}`}>
                  <img
                    src={src}
                    alt=""
                    className="vial aspect-[4/5] w-full rounded-3xl object-cover shadow-[0_28px_50px_-20px_rgba(12,42,71,0.35)]"
                    style={{ animationDelay: `${i * -2}s`, ["--tilt" as string]: `${(i - 1) * 4}deg` }}
                  />
                  <div className="vial-shadow mt-3 h-3 w-2/3 rounded-full bg-navy-deep/60 blur-md" style={{ animationDelay: `${i * -2}s` }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== Cinta de sellos ===== */}
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

      {/* ===== La garantía ===== */}
      <section className="wrap py-20 sm:py-24" data-reveal>
        <h2 className="max-w-3xl text-3xl font-semibold sm:text-[2.6rem]">The Peptiva supply guarantee</h2>
        <p className="mt-4 max-w-2xl text-lg font-light leading-relaxed text-slate">
          Three things every order carries, whether it is one vial or a full bundle.
        </p>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {GUARANTEE.map((g) => (
            <article key={g.title} className="card flex h-full flex-col p-7">
              <h3 className="text-xl font-semibold">{g.title}</h3>
              <p className="mt-3 flex-1 text-[0.95rem] font-light leading-relaxed text-slate">{g.body}</p>
              <p className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-navy">
                <span className="h-1.5 w-1.5 rounded-full bg-teal" aria-hidden />
                {g.tag}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* ===== Precio por cantidad ===== */}
      <section className="wrap" data-reveal>
        <div className="panel-ice overflow-hidden rounded-[2rem] border border-line">
          <div className="grid gap-10 p-7 sm:p-12 lg:grid-cols-[1.1fr_.9fr] lg:items-center">
            <div>
              <p className="eyebrow">Bundle pricing</p>
              <h2 className="mt-3 text-3xl font-semibold sm:text-[2.6rem]">
                Stocking the bench? <span className="text-navy">Up to 15% off</span> per vial.
              </h2>
              <p className="mt-4 max-w-md text-lg font-light leading-relaxed text-slate">
                Buy two units of the same product and the discount applies automatically at checkout. From three units it goes to 15%, with
                no subscription and no minimum order.
              </p>
              <ul className="mt-7 flex flex-wrap gap-2 text-sm">
                {["2 units · 10% off", "3+ units · 15% off", "Free U.S. shipping"].map((t) => (
                  <li key={t} className="rounded-full border border-line bg-white px-4 py-2 font-medium text-ink">{t}</li>
                ))}
              </ul>
              <Link to="/shop?category=bundle-save" className="btn btn-primary mt-8">
                See bundle pricing <Arrow />
              </Link>
            </div>

            <div className="card p-6 sm:p-8">
              <p className="text-sm font-medium text-muted">Example · 3 units of the same product</p>
              <dl className="mt-5 space-y-3 text-[0.95rem]">
                <div className="flex items-center justify-between">
                  <dt className="font-light text-slate">List price</dt>
                  <dd className="tabular-nums text-muted line-through">{formatPrice(179.97)}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="font-light text-slate">Bundle discount</dt>
                  <dd className="tabular-nums font-medium text-navy">−15%</dd>
                </div>
                <div className="flex items-center justify-between border-t border-line pt-3">
                  <dt className="font-medium">You pay</dt>
                  <dd className="text-2xl font-semibold tabular-nums">{formatPrice(152.97)}</dd>
                </div>
              </dl>
              <p className="mt-5 text-sm font-light leading-relaxed text-slate">
                Applied automatically in the cart. An adult signature is required on delivery.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Para procurement ===== */}
      <section className="wrap py-20 sm:py-24" data-reveal>
        <h2 className="max-w-3xl text-3xl font-semibold sm:text-[2.6rem]">Built for laboratory procurement</h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {PROCUREMENT.map((p) => (
            <article key={p.title} className="card flex h-full flex-col p-7 transition-shadow hover:shadow-[0_24px_48px_-28px_rgba(15,22,33,0.35)]">
              <h3 className="text-xl font-semibold">{p.title}</h3>
              <p className="mt-3 flex-1 text-[0.95rem] font-light leading-relaxed text-slate">{p.body}</p>
              <Link to={p.cta.to} className="mt-6 inline-flex items-center gap-2 text-[0.95rem] font-medium text-ink underline underline-offset-4">
                {p.cta.label}
              </Link>
            </article>
          ))}
        </div>
      </section>

      {/* ===== Calidad verificable (pestañas) ===== */}
      <section className="wrap" data-reveal>
        <div className="overflow-hidden rounded-[2rem] bg-ink text-white">
          <div className="grid gap-10 p-7 sm:p-12 lg:grid-cols-[.95fr_1.05fr] lg:items-center">
            <div>
              <p className="eyebrow text-white/50">Quality</p>
              <h2 className="mt-3 text-3xl font-semibold text-white sm:text-[2.6rem]">Quality your lab can verify</h2>
              <p className="mt-4 max-w-md text-lg font-light leading-relaxed text-white/70">
                Every lot is tested by an independent laboratory before release, and the full result is published on this site for your
                quality records.
              </p>
              <div className="mt-8 flex flex-wrap gap-2" role="tablist" aria-label="Testing performed on every lot">
                {QUALITY_TABS.map((t, i) => (
                  <button
                    key={t.key}
                    type="button"
                    role="tab"
                    id={`qtab-${i}`}
                    aria-selected={tab === i}
                    aria-controls={`qpanel-${i}`}
                    onClick={() => setTab(i)}
                    className={`rounded-full px-4 py-2 text-sm transition-colors ${tab === i ? "bg-white font-medium text-ink" : "bg-white/10 text-white/75 hover:bg-white/20"}`}
                  >
                    {t.key}
                  </button>
                ))}
              </div>
            </div>

            <div
              role="tabpanel"
              id={`qpanel-${tab}`}
              aria-labelledby={`qtab-${tab}`}
              className="relative overflow-hidden rounded-3xl bg-white/5 p-7 ring-1 ring-white/10 sm:p-9"
            >
              <div className="scan-line pointer-events-none absolute inset-x-0 top-0 h-full" aria-hidden />
              <p className="text-sm font-medium uppercase tracking-[0.14em] text-teal">{QUALITY_TABS[tab]!.method}</p>
              <h3 className="mt-3 text-2xl font-semibold text-white">{QUALITY_TABS[tab]!.title}</h3>
              <p className="mt-4 text-[0.98rem] font-light leading-relaxed text-white/70">{QUALITY_TABS[tab]!.body}</p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link to="/coas" className="btn btn-light">
                  See the certificates <Arrow />
                </Link>
                {coas.data ? <p className="text-sm font-light text-white/55">{coas.data.length} certificates published</p> : null}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Catálogo destacado ===== */}
      <section className="wrap py-20 sm:py-24" data-reveal>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-semibold sm:text-[2.6rem]">Most requested compounds</h2>
            <p className="mt-3 text-lg font-light text-slate">Each one ships with the certificate for its lot.</p>
          </div>
          <Link to="/shop" className="font-medium text-ink underline underline-offset-4">
            All {products?.length ?? ""} research peptides
          </Link>
        </div>
        <div className="mt-10 grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 sm:gap-y-12 md:grid-cols-4">
          {featured ? featured.map((p) => <ProductCard key={p.id} product={p} />) : Array.from({ length: 8 }, (_, i) => <ProductCardSkeleton key={i} />)}
        </div>
      </section>

      {/* ===== Preguntas frecuentes ===== */}
      {faqTop?.length ? (
        <section className="wrap" data-reveal>
          <div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr]">
            <div className="lg:sticky lg:top-32 lg:self-start">
              <h2 className="text-3xl font-semibold sm:text-[2.6rem]">Frequently asked questions</h2>
              <p className="mt-4 text-lg font-light leading-relaxed text-slate">
                Purity, documentation, shipping and storage, answered the way a laboratory asks them.
              </p>
              <Link to="/faq" className="btn btn-ghost mt-6">Read the full FAQ</Link>
            </div>
            <div className="divide-y divide-line border-y border-line">
              {faqTop.map((item) => (
                <details key={item.q} className="group py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-[1.05rem] font-medium text-ink marker:hidden">
                    {item.q}
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line text-ink transition-transform group-open:rotate-45" aria-hidden>+</span>
                  </summary>
                  <div className="prose-copy mt-3 text-[0.95rem] font-light" dangerouslySetInnerHTML={{ __html: item.a }} />
                </details>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* ===== Cierre + boletín ===== */}
      <section className="wrap pt-20 sm:pt-24" data-reveal>
        <div className="panel-soft rounded-[2rem] p-8 text-center sm:p-14">
          <h2 className="mx-auto max-w-3xl text-3xl font-semibold leading-[1.1] sm:text-[2.8rem]">
            Research peptides for your lab, with the <span className="text-navy">documentation</span> your records expect.
          </h2>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 min-[420px]:flex-row">
            <Link to="/shop" className="btn btn-primary">
              Shop the catalog <Arrow />
            </Link>
            <Link to="/contact" className="btn btn-ghost">Talk to support</Link>
          </div>
          <div className="mx-auto mt-12 max-w-xl border-t border-white/60 pt-10">
            <h3 className="text-xl font-semibold">Restock and new-lot notices</h3>
            <p className="mt-2 text-[0.95rem] font-light text-slate">
              New compounds, restock alerts and new certificates. No more than twice a month.
            </p>
            <div className="mt-5 flex justify-center">
              <NewsletterForm />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
