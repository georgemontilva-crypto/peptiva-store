import { Link } from "react-router-dom";
import { trpc } from "../lib/trpc";
import { usePageMeta } from "../lib/format";
import { HERO_VIALS } from "../lib/site";
import ProductCard, { ProductCardSkeleton } from "../components/ProductCard";
import NewsletterForm from "../components/NewsletterForm";
import MoleculeField from "../components/MoleculeField";

const SEALS = ["≥99% HPLC purity", "Mass spec verified", "Third-party tested", "COA for every product", "Lyophilized & sealed", "Ships same or next day", "Cold-pack packaging", "U.S. based support"];

export default function Home() {
  usePageMeta("Peptiva Supplies — Research Peptides, Third-Party Tested", "Research peptides tested by independent labs for 99%+ purity, with certificates of analysis for every product. Free U.S. shipping.");
  const { data: products } = trpc.catalog.products.useQuery();
  const coas = trpc.content.coas.useQuery();

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-mist">
        <MoleculeField tone="light" density={0.9} className="[mask-image:linear-gradient(to_right,rgba(0,0,0,.25)_0%,rgba(0,0,0,.25)_35%,black_60%)]" />
        <div className="lab-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_70%_50%,black,transparent_70%)]" aria-hidden />
        <div className="relative mx-auto grid max-w-6xl items-center gap-8 px-5 pb-12 pt-10 sm:gap-12 sm:pb-20 sm:pt-16 md:grid-cols-[1fr_1.05fr] md:pb-28 md:pt-24">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-navy">
              <span className="lab-pulse h-2 w-2 rounded-full bg-teal" aria-hidden />
              Every lot tested by an independent lab
            </p>
            <h1 className="mt-6 text-[2.4rem] font-bold leading-[1.05] tracking-tight sm:text-6xl">
              Research peptides you can verify.
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-slate">
              Lyophilized compounds with 99%+ HPLC purity and a published certificate of analysis for each one, shipped from the U.S.
            </p>
            <div className="mt-8 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:flex sm:flex-wrap">
              <Link to="/shop" className="btn btn-primary px-7 py-3.5">Shop the catalog</Link>
              <Link to="/coas" className="btn btn-ghost px-7 py-3.5">View lab results</Link>
            </div>
          </div>

          <div className="relative mx-auto flex h-[250px] w-full max-w-[520px] items-end justify-center gap-2 min-[420px]:h-[300px] sm:h-[440px]" aria-hidden>
            {HERO_VIALS.map((src, i) => (
              <div key={src} className={`flex flex-col items-center ${i === 1 ? "z-10 -mx-4 mb-10 w-[42%]" : "w-[34%]"}`}>
                <img
                  src={src}
                  alt=""
                  className="vial aspect-[4/5] w-full rounded-3xl object-cover shadow-[0_28px_50px_-20px_rgba(12,42,71,0.45)]"
                  style={{ animationDelay: `${i * -2}s`, ["--tilt" as string]: `${(i - 1) * 4}deg` }}
                />
                <div className="vial-shadow mt-3 h-3 w-2/3 rounded-full bg-navy-deep blur-md" style={{ animationDelay: `${i * -2}s` }} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Cinta de sellos */}
      <section aria-label="Quality standards" className="ticker overflow-hidden border-y border-navy-deep bg-navy py-4 text-white">
        <div className="ticker-track flex w-max gap-12 whitespace-nowrap">
          {[...SEALS, ...SEALS].map((s, i) => (
            <span key={i} className="flex items-center gap-12 font-display text-[0.95rem] font-medium" aria-hidden={i >= SEALS.length}>
              {s}
              <span className="h-1.5 w-1.5 rounded-full bg-teal" />
            </span>
          ))}
        </div>
      </section>

      {/* Garantía */}
      <section className="mx-auto max-w-6xl px-5 py-24" data-reveal>
        <div className="grid gap-10 md:grid-cols-[1fr_1.3fr] md:items-center">
          <div>
            <h2 className="text-3xl font-bold leading-tight sm:text-4xl">The 99% purity guarantee</h2>
            <p className="mt-4 text-lg leading-relaxed text-slate">
              If an independent lab test shows any product below 99% purity, we refund that product in full. Send us the third-party COA
              within 30 days of delivery.
            </p>
            <Link to="/return-refund" className="mt-6 inline-block font-semibold text-navy underline underline-offset-4">Read the guarantee terms</Link>
          </div>
          <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-3xl bg-line sm:grid-cols-3">
            {[
              { k: "99%+", v: "Minimum purity by HPLC, confirmed by mass spectrometry" },
              { k: coas.data ? String(coas.data.length) : "—", v: "Certificates of analysis published on the site" },
              { k: "2–4 days", v: "Typical U.S. delivery after same or next-day dispatch" },
            ].map((s) => (
              <div key={s.k} className="bg-white p-7">
                <dt className="font-display text-3xl font-bold text-navy">{s.k}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-slate">{s.v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Destacados */}
      <section className="mx-auto max-w-6xl px-5" data-reveal>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold">Most requested</h2>
            <p className="mt-2 text-slate">Buy 2 of the same item for 10% off, or 3+ for 15% off.</p>
          </div>
          <Link to="/shop" className="font-semibold text-navy underline underline-offset-4">All {products?.length ?? ""} products</Link>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-x-3 gap-y-8 sm:mt-10 sm:gap-x-5 sm:gap-y-12 md:grid-cols-4">
          {products ? products.slice(0, 8).map((p) => <ProductCard key={p.id} product={p} />) : Array.from({ length: 8 }, (_, i) => <ProductCardSkeleton key={i} />)}
        </div>
      </section>

      {/* Para investigadores */}
      <section className="mx-auto mt-28 max-w-6xl px-5" data-reveal>
        <div className="grid overflow-hidden rounded-[2rem] bg-navy-deep text-white md:grid-cols-2">
          <div className="p-7 sm:p-14">
            <h2 className="text-3xl font-bold text-white sm:text-4xl">Built for researchers</h2>
            <p className="mt-4 max-w-md leading-relaxed text-white/70">
              Consistent material from one lot to the next, documented so your results can be reproduced.
            </p>
            <ul className="mt-10 space-y-6">
              {[
                ["Documented batches", "Each product page links its current certificate of analysis."],
                ["Stable on arrival", "Lyophilized, sealed vials shipped in insulated packaging with cold packs."],
                ["Real support", "Questions about specifications or bulk orders are answered within one business day."],
              ].map(([t, d]) => (
                <li key={t} className="border-l-2 border-teal pl-5">
                  <p className="font-display text-lg font-medium text-white">{t}</p>
                  <p className="mt-1 text-sm leading-relaxed text-white/65">{d}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className="relative hidden min-h-72 bg-navy md:block">
            <div className="lab-grid absolute inset-0 opacity-40 invert" aria-hidden />
            <div className="absolute inset-0 flex items-center justify-center p-10">
              {HERO_VIALS[1] ? <img src={HERO_VIALS[1]} alt="" className="aspect-square max-h-80 w-full max-w-80 rounded-3xl object-cover shadow-[0_30px_60px_-20px_rgba(0,0,0,0.55)]" /> : null}
            </div>
          </div>
        </div>
      </section>

      {/* CTA + newsletter */}
      <section className="mx-auto mt-28 max-w-6xl px-5" data-reveal>
        <div className="flex flex-col items-start justify-between gap-8 border-y border-line py-14 md:flex-row md:items-center">
          <div className="max-w-lg">
            <h2 className="text-3xl font-bold">Hear about restocks first</h2>
            <p className="mt-3 text-slate">New compounds, restock alerts and the occasional discount code. No more than twice a month.</p>
          </div>
          <NewsletterForm />
        </div>
      </section>
    </>
  );
}
