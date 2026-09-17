import { Link } from "react-router-dom";
import { formatPrice } from "../lib/format";
import { useCart } from "../lib/cart";
import type { RouterOutputs } from "../lib/trpc";

type Item = RouterOutputs["catalog"]["products"][number];

export default function ProductCard({ product }: { product: Item }) {
  const cart = useCart();
  const hasSizes = product.variantCount > 0;

  return (
    <article className="group flex flex-col">
      <Link to={`/product/${product.slug}`} className="relative block aspect-square overflow-hidden rounded-3xl bg-white ring-1 ring-line transition-shadow duration-300 group-hover:shadow-[0_18px_40px_-18px_rgba(11,39,66,0.35)]">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} loading="lazy" className="h-full w-full rounded-3xl object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
        ) : null}
        {hasSizes ? (
          <span className="absolute left-3 top-3 rounded-full bg-navy px-2.5 py-1 text-xs font-semibold text-white">{product.variantCount} sizes</span>
        ) : null}
      </Link>
      <div className="mt-4 flex flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-[1.05rem] font-medium leading-snug text-ink">
            <Link to={`/product/${product.slug}`} className="hover:text-navy">{product.name}</Link>
          </h3>
          <p className="shrink-0 pt-0.5 text-sm font-semibold tabular-nums text-navy">
            {hasSizes ? <span className="font-normal text-slate">from </span> : null}
            {formatPrice(product.price)}
          </p>
        </div>
        {hasSizes ? (
          <Link to={`/product/${product.slug}`} className="mt-3 inline-flex h-10 items-center justify-center rounded-full border border-line text-sm font-semibold text-navy hover:border-navy">
            Choose size
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => cart.add({ productId: product.id, variantId: null, quantity: 1 })}
            className="mt-3 inline-flex h-10 items-center justify-center rounded-full bg-navy text-sm font-semibold text-white hover:bg-navy-deep"
            aria-label={`Add ${product.name} to cart`}
          >
            Add to cart
          </button>
        )}
      </div>
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div aria-hidden>
      <div className="skeleton aspect-square rounded-3xl" />
      <div className="skeleton mt-4 h-4 w-2/3 rounded-full" />
      <div className="skeleton mt-3 h-10 rounded-full" />
    </div>
  );
}
