import { useState } from "react";
import { Link } from "react-router-dom";
import { trpc } from "../lib/trpc";
import { usePageMeta, useJsonLd, SITE_URL, formatPrice } from "../lib/format";
import { HERO_VIALS, cutUrl } from "../lib/site";
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

const GUARANTEE = [
  { edge: "bg-teal", title: "99%+ purity guaranteed", sub: "Every lot assayed by HPLC before release" },
  { edge: "bg-navy", title: "A COA with every lot", sub: "Published on the site, not sent on request" },
  { edge: "bg-amber-300", title: "Free U.S. shipping", sub: "Dispatched same or next business day" },
];

const PROCUREMENT = [
  {
    title: "Documentation with every order",
    body: "Each product page links the current Certificate of Analysis, with the lot number, the identity confirmation and the purity result on the same page as the price.",
    cta: { to: "/coas", label: "Browse the certificates" },
  },
  {
    title: "Research-grade material at catalog pricing",
    body: "A United States supplier with list prices set for research budgets, and bundle pricing that lowers the unit cost from the second vial onward.",
    cta: { to: "/shop", label: "See the catalog" },
  },
  {
    title: "Support that answers specifications",
    body: "Questions about purity results, reconstitution, storage or bulk quantities are answered by email within one business day.",
    cta: { to: "/contact", label: "Contact support" },
  },
  {
    title: "Shipped and tracked across the U.S.",
    body: "Insulated packaging with cold packs, tracking on every order, and an order-tracking page where the status is available at any time.",
    cta: { to: "/track-order", label: "Track an order" },
  },
];

const QUALITY_TABS = [
  {
    key: "Purity",
    title: "Chromatographic purity",
    method: "HPLC analysis",
    body: "Each lot is run by high-performance liquid chromatography and released only at 99% or above. The reported purity is part of the Certificate of Analysis for that lot.",
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
    body: "Results are tied to the lot number printed on your vial, and every certificate stays published, so a result can be retrieved months after the order.",
  },
  {
    key: "Handling",
    title: "Stable on arrival",
    method: "Lyophilized & sealed",
    body: "Material ships lyophilized in sealed vials with cold packs and insulated packaging, ready to be stored sealed and protected from light.",
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
  const shot = (i: number) => products?.[i]?.imageUrl ?? HERO_VIALS[i % HERO_VIALS.length]!;
  /** La misma foto sin fondo, para que el frasco flote sobre el degradado. */
  const cut = (i: number) => cutUrl(shot(i));

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
              <img src={cut(0)} alt="" className="vial float-shadow absolute bottom-[-18%] left-[-6%] h-[88%] w-auto max-w-none rotate-[-9deg] rounded-none object-contain" />
              <img src={cut(1)} alt="" className="vial float-shadow absolute bottom-[-10%] left-[24%] z-10 h-[104%] w-auto max-w-none rotate-[3deg] rounded-none object-contain" style={{ animationDelay: "-2s" }} />
              <img src={cut(2)} alt="" className="vial float-shadow absolute bottom-[0%] right-[-4%] h-[66%] w-auto max-w-none rotate-[12deg] rounded-none object-contain" style={{ animationDelay: "-4s" }} />
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

      {/* ===================== GARANTÍA ===================== */}
      <section className="band-lilac" data-reveal>
        <div className="wrap grid items-center gap-12 py-20 lg:grid-cols-2 lg:py-24">
          <div className="relative mx-auto hidden h-[420px] w-full max-w-md lg:block" aria-hidden>
            <img src={cut(3)} alt="" className="vial float-shadow absolute inset-0 mx-auto h-full w-auto max-w-none rounded-none object-contain" />
            <div className="absolute -right-2 bottom-10 rounded-2xl bg-white p-4 shadow-[0_20px_40px_-20px_rgba(12,42,71,0.4)]">
              <p className="text-sm font-semibold">99%+ purity</p>
              <p className="text-xs font-light text-slate">Verified by HPLC</p>
            </div>
          </div>

          <div>
            <h2 className="text-3xl font-semibold sm:text-[2.7rem]">The Peptiva supply guarantee</h2>
            <p className="mt-4 max-w-md text-lg font-light leading-relaxed text-slate">
              Three things every order carries, whether it is one vial or a full bundle.
            </p>
            <ul className="mt-8 space-y-4">
              {GUARANTEE.map((g) => (
                <li key={g.title} className="flex overflow-hidden rounded-2xl bg-white shadow-[0_18px_40px_-28px_rgba(12,42,71,0.5)]">
                  <span className={`w-1.5 shrink-0 ${g.edge}`} aria-hidden />
                  <div className="px-6 py-5">
                    <p className="text-[1.05rem] font-semibold">{g.title}</p>
                    <p className="mt-1 text-sm font-light text-slate">{g.sub}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ===================== PRECIO POR CANTIDAD ===================== */}
      <section className="band-pastel" data-reveal>
        <div className="wrap py-20 text-center lg:py-28">
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
            <div className="relative shrink-0">
              <img src={cut(0)} alt="" className="float-shadow-sm h-20 w-20 rounded-none object-contain" />
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
            {PROCUREMENT.map((p, i) => (
              <article key={p.title} className="flex items-start gap-5 rounded-[1.75rem] bg-white p-7 shadow-[0_24px_50px_-35px_rgba(12,42,71,0.5)]">
                <div className="min-w-0 flex-1">
                  <h3 className="text-xl font-semibold leading-snug">{p.title}</h3>
                  <p className="mt-3 text-[0.95rem] font-light leading-relaxed text-slate">{p.body}</p>
                  <Link to={p.cta.to} className="btn btn-ghost mt-5 text-sm">{p.cta.label}</Link>
                </div>
                <img src={cut(i)} alt="" className="float-shadow-sm hidden h-28 w-28 shrink-0 rounded-none object-contain sm:block" aria-hidden />
              </article>
            ))}
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
                  className={`rounded-full px-4 py-2 text-sm transition-colors ${tab === i ? "bg-ink font-medium text-white" : "bg-mist text-slate hover:bg-line"}`}
                >
                  {t.key}
                </button>
              ))}
            </div>

            <div role="tabpanel" id={`qpanel-${tab}`} aria-labelledby={`qtab-${tab}`} className="mt-6 rounded-[1.5rem] bg-ice p-7">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-xl font-semibold">{QUALITY_TABS[tab]!.title}</h3>
                <span className="chip bg-white text-navy">{QUALITY_TABS[tab]!.method}</span>
              </div>
              <p className="mt-3 text-[0.95rem] font-light leading-relaxed text-slate">{QUALITY_TABS[tab]!.body}</p>
            </div>

            <Link to="/shop" className="btn btn-primary mt-8">
              Shop the catalog <Arrow />
            </Link>
          </div>

          {/* Panel con el frasco y tarjetas flotantes */}
          <div className="relative">
            <div className="panel-ice relative overflow-hidden rounded-[2.5rem] p-10">
              <div className="lab-grid absolute inset-0 opacity-60" aria-hidden />
              <img src={cut(4)} alt="" className="vial float-shadow relative mx-auto h-[360px] w-auto max-w-full rounded-none object-contain" aria-hidden />
              <div className="scan-line pointer-events-none absolute inset-x-0 top-0 h-full" aria-hidden />
            </div>
            <div className="absolute right-4 top-6 rounded-2xl bg-white p-4 shadow-[0_22px_45px_-22px_rgba(12,42,71,0.45)]">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-soft text-[0.7rem] text-navy" aria-hidden>✓</span>
                99%+ purity
              </p>
              <p className="mt-0.5 text-xs font-light text-slate">Verified by HPLC</p>
            </div>
            <Link
              to="/coas"
              className="absolute inset-x-6 bottom-5 flex items-center justify-between gap-4 rounded-2xl bg-white px-5 py-4 shadow-[0_22px_45px_-22px_rgba(12,42,71,0.45)] transition-transform hover:-translate-y-0.5"
            >
              <span>
                <span className="block text-sm font-semibold">See the certificates</span>
                <span className="block text-xs font-light text-slate">
                  {coas.data ? `${coas.data.length} lots published` : "Certificate of Analysis by lot"}
                </span>
              </span>
              <Arrow className="text-ink" />
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
      <section className="band-lilac" data-reveal>
        <div className="wrap py-20 text-center lg:py-28">
          <h2 className="mx-auto max-w-4xl text-[2.2rem] font-semibold leading-[1.08] sm:text-[3.1rem]">
            Research peptides for your lab, with the <span className="serif">documentation</span> your records expect.
          </h2>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 min-[420px]:flex-row">
            <Link to="/shop" className="btn btn-primary">
              Shop the catalog <Arrow />
            </Link>
            <Link to="/contact" className="btn btn-ghost">Talk to support</Link>
          </div>

          <div className="mx-auto mt-16 max-w-xl rounded-[1.75rem] bg-white p-8 shadow-[0_28px_60px_-40px_rgba(12,42,71,0.5)]">
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
