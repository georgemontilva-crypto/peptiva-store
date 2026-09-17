import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { trpc } from "../lib/trpc";
import { useCart } from "../lib/cart";
import { formatPrice, usePageMeta } from "../lib/format";
import QuantityStepper from "../components/QuantityStepper";
import ProductCard from "../components/ProductCard";
import NotFound from "./NotFound";
import ShipCountdown from "../components/ShipCountdown";
import Collapsible from "../components/Collapsible";
import { LotGrid, VerifiedResults, hasData } from "../components/ProductCoa";

const TIERS = [
  { qty: 1, pct: 0, label: "1 vial" },
  { qty: 2, pct: 10, label: "2 vials" },
  { qty: 3, pct: 15, label: "3+ vials" },
];

export default function Product() {
  const { slug = "" } = useParams();
  const { data: product, isLoading } = trpc.catalog.productBySlug.useQuery({ slug }, { retry: false });
  const related = trpc.catalog.products.useQuery(undefined, { enabled: Boolean(product) });
  const cart = useCart();
  const [variantId, setVariantId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const buyRef = useRef<HTMLDivElement>(null);
  const [showSticky, setShowSticky] = useState(false);

  // En teléfono, cuando el botón principal sale de pantalla aparece una barra fija de compra abajo
  useEffect(() => {
    const el = buyRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setShowSticky(!e!.isIntersecting && e!.boundingClientRect.top < 0), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, [product?.id, isLoading]);

  useEffect(() => {
    setVariantId(product?.variants[0]?.id ?? null);
    setQuantity(1);
  }, [product?.id]);

  usePageMeta(product ? (product.seoTitle ?? `${product.name} — Peptiva Supplies`) : undefined, product?.seoDescription);

  if (isLoading) {
    return (
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 md:grid-cols-[1.05fr_1fr]" aria-busy="true">
        <div className="skeleton aspect-square rounded-[2rem]" />
        <div className="space-y-4 pt-4">
          <div className="skeleton h-10 w-2/3 rounded-full" />
          <div className="skeleton h-8 w-1/4 rounded-full" />
          <div className="skeleton mt-8 h-24 rounded-2xl" />
          <div className="skeleton h-14 rounded-full" />
        </div>
      </div>
    );
  }
  if (!product) return <NotFound />;

  const variant = product.variants.find((v) => v.id === variantId);
  const unit = Number(variant?.salePrice ?? variant?.price ?? product.salePrice ?? product.price);
  const pct = quantity >= 3 ? 15 : quantity === 2 ? 10 : 0;
  const lineTotal = unit * quantity * (1 - pct / 100);
  const needsVariant = product.variants.length > 0 && !variant;
  const coa = product.coas[0];
  const primaryLot = product.coas.find((l) => l.latest && hasData(l)) ?? product.coas.find(hasData);

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <nav className="text-sm text-slate" aria-label="Breadcrumb">
        <Link to="/shop" className="hover:text-navy">Shop</Link>
        <span className="mx-2 text-muted" aria-hidden>/</span>
        <span className="text-ink" aria-current="page">{product.name}</span>
      </nav>

      <div className="mt-6 grid gap-10 md:grid-cols-[1.05fr_1fr] lg:gap-16">
        <div className="relative aspect-square overflow-hidden rounded-[2rem] bg-white ring-1 ring-line md:sticky md:top-32 md:self-start">
          {product.imageUrl ? <img src={product.imageUrl} alt={product.name} className="h-full w-full rounded-[2rem] object-cover" /> : null}
          {coa ? (
            <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-navy shadow-sm">
              <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 text-teal" fill="currentColor" aria-hidden><path d="M10 1.5 3 4.5v5c0 4.2 3 7.8 7 9 4-1.2 7-4.8 7-9v-5l-7-3zm-1.2 12.1L5.6 10.4l1.2-1.2 2 2 4.4-4.4 1.2 1.2-5.6 5.6z" /></svg>
              Lab verified
            </span>
          ) : null}
        </div>

        <div className="md:pt-4">
          <p className="text-sm font-semibold text-teal">Research peptide{coa ? " · COA published" : ""}</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight">{product.name}</h1>
          <p className="mt-4 font-display text-3xl font-medium tabular-nums text-navy">{formatPrice(unit)}</p>

          {product.variants.length > 0 ? (
            <fieldset className="mt-8">
              <legend className="label">Amount per vial</legend>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {product.variants.map((v) => (
                  <label key={v.id} className={`cursor-pointer rounded-2xl border-2 px-2.5 py-2.5 text-center sm:px-4 sm:py-3 sm:text-left has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-teal ${v.id === variantId ? "border-navy bg-navy/[0.04]" : "border-line hover:border-navy/40"}`}>
                    <input type="radio" name="variant" className="sr-only" checked={v.id === variantId} onChange={() => setVariantId(v.id)} />
                    <span className="block font-display font-medium text-ink">{v.label}</span>
                    <span className="block text-sm tabular-nums text-slate">{formatPrice(v.salePrice ?? v.price)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}

          <div className="mt-8">
            <p className="label">Bundle & save</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {TIERS.map((t) => {
                const active = t.qty === 3 ? quantity >= 3 : quantity === t.qty;
                return (
                  <button key={t.qty} type="button" onClick={() => setQuantity(t.qty)} aria-pressed={active} className={`rounded-2xl border-2 px-2 py-2.5 text-center sm:px-3 sm:py-3 sm:text-left ${active ? "border-teal bg-teal-soft/50" : "border-line hover:border-teal/50"}`}>
                    <span className="block text-sm font-semibold text-ink">{t.label}</span>
                    <span className={`block text-xs ${t.pct ? "font-semibold text-teal" : "text-slate"}`}>{t.pct ? `Save ${t.pct}%` : "Standard price"}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div ref={buyRef} className="mt-8 flex items-center gap-3 sm:gap-4">
            <QuantityStepper value={quantity} onChange={setQuantity} />
            <button
              type="button"
              className="btn btn-primary min-w-0 flex-1 whitespace-nowrap px-3 py-3.5 sm:px-6"
              disabled={needsVariant}
              onClick={() => cart.add({ productId: product.id, variantId: variant?.id ?? null, quantity })}
            >
              Add to cart · {formatPrice(lineTotal)}
            </button>
          </div>
          {pct ? <p className="mt-2 text-sm font-semibold text-teal">You save {formatPrice(unit * quantity - lineTotal)} with the {pct}% bundle discount.</p> : null}

          <div className="mt-6 space-y-2.5">
            <p className="flex items-center gap-2.5 rounded-2xl border border-line bg-white px-4 py-3 text-sm text-slate">
              <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-alert" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M20 12v9H4v-9M2 7h20v5H2zM12 21V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" /></svg>
              <span>Buy <strong className="text-navy">2</strong> save <strong className="text-alert">10%</strong> · buy <strong className="text-navy">3+</strong> save <strong className="text-alert">15%</strong> — applied automatically at checkout.</span>
            </p>
            <ShipCountdown />
          </div>

          <ul className="mt-8 grid grid-cols-1 gap-3 text-sm text-slate sm:grid-cols-3">
            {["Free U.S. shipping", "Ships same or next day", "99% purity guarantee"].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-teal" fill="currentColor" aria-hidden><path d="M8 13.2 4.8 10l-1.1 1.1L8 15.4l8.3-8.3-1.1-1.1z" /></svg>
                {t}
              </li>
            ))}
          </ul>

          {primaryLot ? (
            <a href="#verified-title" className="mt-8 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-2xl border border-line p-4 hover:border-navy/40 sm:p-5">
              <div>
                <p className="text-sm text-slate">Lab verified · Lot {primaryLot.lotNumber}</p>
                <p className="font-display text-xl font-bold text-emerald-700">{primaryLot.purity}% <span className="text-sm font-medium text-slate">HPLC purity</span></p>
              </div>
              <span className="text-sm font-semibold text-navy">See test results ↓</span>
            </a>
          ) : coa?.reportUrl ? (
            <div className="mt-8 flex items-center justify-between gap-4 rounded-2xl border border-line p-5">
              <div>
                <h2 className="text-base font-medium">Certificate of analysis</h2>
                <p className="mt-1 text-sm text-slate">Independent lab report for this product.</p>
              </div>
              <a href={coa.reportUrl} target="_blank" rel="noreferrer" className="btn btn-ghost shrink-0 px-4 py-2 text-sm">View PDF</a>
            </div>
          ) : null}

          <p className="mt-6 rounded-2xl bg-mist px-5 py-4 text-sm leading-relaxed text-slate">
            <strong className="text-ink">Research use only.</strong> This product is supplied for in-vitro laboratory research and is not intended for human or veterinary use.
          </p>
        </div>
      </div>

      {primaryLot ? (
        <div className="mt-20">
          <VerifiedResults lot={primaryLot} lots={product.coas} />
        </div>
      ) : product.coas.some((l) => l.reportUrl) ? (
        <div className="mt-20">
          <LotGrid lots={product.coas.filter((l) => l.reportUrl)} />
        </div>
      ) : null}

      {product.descriptionHtml ? (
        <section className="mt-20 border-t border-line pt-12" aria-labelledby="about-title">
          <h2 id="about-title" className="text-2xl font-bold text-ink">About this product</h2>
          <div className="mt-6 max-w-4xl">
            <Collapsible>
              <div className="prose-copy max-w-none" dangerouslySetInnerHTML={{ __html: product.descriptionHtml }} />
            </Collapsible>
          </div>
        </section>
      ) : null}

      <section className="mt-14 rounded-3xl bg-gradient-to-r from-red-50 to-mist px-6 py-7 ring-1 ring-red-100 sm:px-8" aria-labelledby="notice-title">
        <p id="notice-title" className="text-xs font-bold uppercase tracking-[0.16em] text-alert">⚠ Important research notice</p>
        <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate">
          <p><strong className="text-ink">Not for human consumption.</strong> This product is sold exclusively for laboratory and research purposes. It is not intended to diagnose, treat, cure, or prevent any disease.</p>
          <p>Scientific information on this page is drawn from peer-reviewed literature and provided for educational reference only. It should not be interpreted as medical advice or a product claim.</p>
          <p>By purchasing, you confirm you are a qualified researcher and will use this material in accordance with all applicable laws and regulations.</p>
        </div>
      </section>

      {related.data ? (
        <section className="mt-24">
          <h2 className="text-2xl font-bold">Researchers also order</h2>
          <div className="mt-8 grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 sm:gap-y-10 md:grid-cols-4">
            {related.data.filter((p) => p.id !== product.id).slice(0, 4).map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      ) : null}
      {/* Espacio para que la barra fija no tape el final de la página */}
      <div className="h-16 sm:hidden" aria-hidden />
      <div className={`fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-4 pt-3 shadow-[0_-10px_30px_-15px_rgba(11,39,66,0.25)] backdrop-blur transition-transform duration-300 safe-bottom sm:hidden ${showSticky ? "translate-y-0" : "translate-y-full"}`} aria-hidden={!showSticky}>
        <div className="flex items-center gap-3 pb-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{product.name}{variant ? ` · ${variant.label}` : ""}</p>
            <p className="text-sm tabular-nums text-navy">{formatPrice(lineTotal)}{quantity > 1 ? <span className="text-slate"> · {quantity} vials</span> : null}</p>
          </div>
          <button
            type="button"
            tabIndex={showSticky ? 0 : -1}
            className="btn btn-primary shrink-0 px-5"
            disabled={needsVariant}
            onClick={() => cart.add({ productId: product.id, variantId: variant?.id ?? null, quantity })}
          >
            Add to cart
          </button>
        </div>
      </div>
    </div>
  );
}
