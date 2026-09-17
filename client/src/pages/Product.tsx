import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { trpc } from "../lib/trpc";
import { useCart } from "../lib/cart";
import { formatPrice, usePageMeta } from "../lib/format";
import QuantityStepper from "../components/QuantityStepper";
import ProductCard from "../components/ProductCard";
import NotFound from "./NotFound";

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

  useEffect(() => {
    setVariantId(product?.variants[0]?.id ?? null);
    setQuantity(1);
  }, [product?.id]);

  usePageMeta(product ? (product.seoTitle ?? `${product.name} — Peptiva Supplies`) : undefined, product?.seoDescription);

  if (isLoading) return <div className="mx-auto h-[70vh] max-w-6xl px-5 py-16" aria-busy="true" />;
  if (!product) return <NotFound />;

  const variant = product.variants.find((v) => v.id === variantId);
  const unit = Number(variant?.salePrice ?? variant?.price ?? product.salePrice ?? product.price);
  const pct = quantity >= 3 ? 15 : quantity === 2 ? 10 : 0;
  const lineTotal = unit * quantity * (1 - pct / 100);
  const needsVariant = product.variants.length > 0 && !variant;
  const coa = product.coas[0];

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <nav className="text-sm text-slate" aria-label="Breadcrumb">
        <Link to="/shop" className="hover:text-navy">Shop</Link>
        <span className="mx-2 text-muted" aria-hidden>/</span>
        <span className="text-ink" aria-current="page">{product.name}</span>
      </nav>

      <div className="mt-6 grid gap-10 md:grid-cols-[1.05fr_1fr] lg:gap-16">
        <div className="relative aspect-square overflow-hidden rounded-[2rem] bg-mist md:sticky md:top-32 md:self-start">
          <div className="lab-grid absolute inset-0 [mask-image:radial-gradient(circle,black,transparent_75%)]" aria-hidden />
          {product.imageUrl ? <img src={product.imageUrl} alt={product.name} className="relative h-full w-full object-contain p-12" /> : null}
        </div>

        <div className="md:pt-4">
          <p className="text-sm font-semibold text-teal">Research peptide{coa ? " · COA published" : ""}</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight">{product.name}</h1>
          <p className="mt-4 font-display text-3xl font-medium tabular-nums text-navy">{formatPrice(unit)}</p>

          {product.variants.length > 0 ? (
            <fieldset className="mt-8">
              <legend className="label">Amount per vial</legend>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {product.variants.map((v) => (
                  <label key={v.id} className={`cursor-pointer rounded-2xl border-2 px-4 py-3 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-teal ${v.id === variantId ? "border-navy bg-navy/[0.04]" : "border-line hover:border-navy/40"}`}>
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
                  <button key={t.qty} type="button" onClick={() => setQuantity(t.qty)} aria-pressed={active} className={`rounded-2xl border-2 px-3 py-3 text-left ${active ? "border-teal bg-teal-soft/50" : "border-line hover:border-teal/50"}`}>
                    <span className="block text-sm font-semibold text-ink">{t.label}</span>
                    <span className={`block text-xs ${t.pct ? "font-semibold text-teal" : "text-slate"}`}>{t.pct ? `Save ${t.pct}%` : "Standard price"}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <QuantityStepper value={quantity} onChange={setQuantity} />
            <button
              type="button"
              className="btn btn-primary flex-1 py-3.5"
              disabled={needsVariant}
              onClick={() => cart.add({ productId: product.id, variantId: variant?.id ?? null, quantity })}
            >
              Add to cart · {formatPrice(lineTotal)}
            </button>
          </div>
          {pct ? <p className="mt-2 text-sm font-semibold text-teal">You save {formatPrice(unit * quantity - lineTotal)} with the {pct}% bundle discount.</p> : null}

          <ul className="mt-8 grid grid-cols-1 gap-3 text-sm text-slate sm:grid-cols-3">
            {["Free U.S. shipping", "Ships same or next day", "99% purity guarantee"].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-teal" fill="currentColor" aria-hidden><path d="M8 13.2 4.8 10l-1.1 1.1L8 15.4l8.3-8.3-1.1-1.1z" /></svg>
                {t}
              </li>
            ))}
          </ul>

          <div className="mt-8 rounded-2xl border border-line p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-medium">Certificate of analysis</h2>
                <p className="mt-1 text-sm text-slate">{coa ? `${coa.lotNumber}${coa.purity ? `, ${coa.purity} purity` : ""}` : "Report for this product is being prepared."}</p>
              </div>
              {coa?.reportUrl ? (
                <a href={coa.reportUrl} target="_blank" rel="noreferrer" className="btn btn-ghost shrink-0 px-4 py-2 text-sm">View PDF</a>
              ) : null}
            </div>
          </div>

          <p className="mt-6 rounded-2xl bg-mist px-5 py-4 text-sm leading-relaxed text-slate">
            <strong className="text-ink">Research use only.</strong> This product is supplied for in-vitro laboratory research and is not intended for human or veterinary use.
          </p>
        </div>
      </div>

      {product.descriptionHtml ? (
        <section className="mt-20 grid gap-10 border-t border-line pt-12 md:grid-cols-[1fr_2.2fr]">
          <h2 className="text-2xl font-bold">About {product.name}</h2>
          <div className="prose-copy" dangerouslySetInnerHTML={{ __html: product.descriptionHtml }} />
        </section>
      ) : null}

      {related.data ? (
        <section className="mt-24">
          <h2 className="text-2xl font-bold">Researchers also order</h2>
          <div className="mt-8 grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-4">
            {related.data.filter((p) => p.id !== product.id).slice(0, 4).map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      ) : null}
    </div>
  );
}
