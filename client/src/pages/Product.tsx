import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { trpc } from "../lib/trpc";
import { formatPrice, usePageMeta } from "../lib/format";
import NotFound from "./NotFound";

export default function Product() {
  const { slug = "" } = useParams();
  const { data: product, isLoading } = trpc.catalog.productBySlug.useQuery({ slug }, { retry: false });
  const [variantId, setVariantId] = useState<number | null>(null);

  useEffect(() => {
    setVariantId(product?.variants[0]?.id ?? null);
  }, [product?.id]);

  usePageMeta(product ? (product.seoTitle ?? `${product.name} — Peptiva Supplies`) : undefined, product?.seoDescription);

  if (isLoading) return <p className="mx-auto max-w-6xl px-5 py-16 text-slate">Loading…</p>;
  if (!product) return <NotFound />;

  const variant = product.variants.find((v) => v.id === variantId);
  const price = variant?.price ?? product.price;

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <nav className="text-sm text-slate" aria-label="Breadcrumb">
        <Link to="/shop" className="hover:text-navy">Shop</Link>
        <span className="mx-2 text-muted">/</span>
        <span className="text-ink">{product.name}</span>
      </nav>

      <div className="mt-6 grid gap-10 md:grid-cols-2">
        <div className="aspect-square rounded-3xl bg-mist">
          {product.imageUrl ? (
            <img src={product.imageUrl} alt={product.name} className="h-full w-full object-contain p-10" />
          ) : null}
        </div>

        <div className="md:pt-6">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{product.name}</h1>
          <p className="mt-3 text-2xl font-semibold text-navy">{formatPrice(price)}</p>

          {product.variants.length > 0 ? (
            <fieldset className="mt-8">
              <legend className="text-sm font-semibold text-ink">Amount</legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {product.variants.map((v) => (
                  <label
                    key={v.id}
                    className={`cursor-pointer rounded-xl border px-4 py-2 text-sm font-semibold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-teal ${
                      v.id === variantId ? "border-navy bg-navy text-white" : "border-slate-300 text-ink hover:border-navy"
                    }`}
                  >
                    <input
                      type="radio"
                      name="variant"
                      className="sr-only"
                      checked={v.id === variantId}
                      onChange={() => setVariantId(v.id)}
                    />
                    {v.label}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}

          <button
            type="button"
            disabled
            className="mt-8 w-full rounded-full bg-navy px-6 py-3.5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            Add to cart
          </button>
          <p className="mt-2 text-xs text-muted">Checkout is being connected in the next release.</p>

          <p className="mt-8 rounded-xl border-l-4 border-teal bg-mist px-4 py-3 text-sm leading-relaxed text-slate">
            Supplied for laboratory research only. Not for human or veterinary use.
          </p>

          <div className="mt-8 border-t border-slate-200 pt-6">
            <h2 className="text-lg font-medium">Certificates of analysis</h2>
            {product.coas.length ? (
              <ul className="mt-3 space-y-2 text-sm">
                {product.coas.map((c) => (
                  <li key={c.id} className="flex justify-between gap-4">
                    <span>
                      Lot {c.lotNumber}
                      {c.purity ? `, ${c.purity} purity` : ""}
                    </span>
                    {c.reportUrl ? (
                      <a href={c.reportUrl} target="_blank" rel="noreferrer" className="font-semibold text-navy underline">
                        View report
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate">Lot reports for this product will be listed here.</p>
            )}
          </div>
        </div>
      </div>

      {product.descriptionHtml ? (
        <section className="mt-16 border-t border-slate-200 pt-4">
          <div className="product-copy" dangerouslySetInnerHTML={{ __html: product.descriptionHtml }} />
        </section>
      ) : null}
    </div>
  );
}
