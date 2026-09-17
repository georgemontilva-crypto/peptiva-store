import { Link } from "react-router-dom";
import { formatPrice } from "../lib/format";
import { useCart } from "../lib/cart";
import type { RouterOutputs } from "../lib/trpc";

type Item = RouterOutputs["catalog"]["products"][number];

/** Tarjeta de producto de alto uniforme: nombre en 2 líneas fijas, precio debajo y botón siempre abajo. */
export default function ProductCard({ product }: { product: Item }) {
  const cart = useCart();
  const hasSizes = product.variantCount > 0;

  return (
    <article className="group flex h-full flex-col">
      <Link to={`/product/${product.slug}`} className="relative block aspect-square overflow-hidden rounded-2xl bg-white ring-1 ring-line transition-shadow duration-300 group-hover:shadow-[0_18px_40px_-18px_rgba(11,39,66,0.35)] sm:rounded-3xl">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} loading="lazy" className="h-full w-full rounded-2xl object-cover transition-transform duration-500 group-hover:scale-[1.04] sm:rounded-3xl" />
        ) : null}
        {hasSizes ? (
          <span className="absolute left-2 top-2 rounded-full bg-navy px-2 py-0.5 text-[0.7rem] font-semibold text-white sm:left-3 sm:top-3 sm:px-2.5 sm:py-1 sm:text-xs">{product.variantCount} sizes</span>
        ) : null}
      </Link>
      <div className="mt-3 flex flex-1 flex-col sm:mt-4">
        <h3 className="line-clamp-2 min-h-[2.6em] font-display text-[0.95rem] font-medium leading-[1.3] text-ink sm:text-[1.05rem]" title={product.name}>
          <Link to={`/product/${product.slug}`} className="hover:text-navy">{product.name}</Link>
        </h3>
        <p className="mt-1 text-sm font-semibold tabular-nums text-navy">
          {hasSizes ? <span className="font-normal text-slate">from </span> : null}
          {formatPrice(product.price)}
        </p>
        <div className="mt-auto pt-3">
          {hasSizes ? (
            <Link to={`/product/${product.slug}`} className="flex h-11 items-center justify-center rounded-full border border-line text-sm font-semibold text-navy hover:border-navy">
              Choose size
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => cart.add({ productId: product.id, variantId: null, quantity: 1 })}
              className="flex h-11 w-full items-center justify-center rounded-full bg-navy text-sm font-semibold text-white hover:bg-navy-deep"
              aria-label={`Add ${product.name} to cart`}
            >
              Add to cart
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div aria-hidden>
      <div className="skeleton aspect-square rounded-2xl sm:rounded-3xl" />
      <div className="skeleton mt-4 h-4 w-2/3 rounded-full" />
      <div className="skeleton mt-3 h-11 rounded-full" />
    </div>
  );
}
