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
      <Link to={`/product/${product.slug}`} className="relative block aspect-square overflow-hidden rounded-2xl bg-mist ring-1 ring-line transition-shadow duration-300 group-hover:shadow-[0_18px_40px_-18px_rgba(15,22,33,0.3)] sm:rounded-3xl">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} loading="lazy" className="h-full w-full rounded-2xl object-cover transition-transform duration-500 group-hover:scale-[1.04] sm:rounded-3xl" />
        ) : null}
        {hasSizes ? (
          <span className="absolute left-2 top-2 rounded-full bg-ink px-2 py-0.5 text-[0.7rem] font-semibold text-white sm:left-3 sm:top-3 sm:px-2.5 sm:py-1 sm:text-xs">{product.variantCount} sizes</span>
        ) : null}
      </Link>
      <div className="mt-3 flex flex-1 flex-col sm:mt-4">
        <h3 className="line-clamp-2 min-h-[2.6em] text-[0.95rem] font-medium leading-[1.35] text-ink sm:text-[1.05rem]" title={product.name}>
          <Link to={`/product/${product.slug}`} className="hover:underline hover:underline-offset-4">{product.name}</Link>
        </h3>
        <p className="mt-1 text-sm font-medium tabular-nums text-ink">
          {hasSizes ? <span className="font-light text-muted">from </span> : null}
          {formatPrice(product.price)}
        </p>
        <div className="mt-auto pt-3">
          {hasSizes ? (
            <Link to={`/product/${product.slug}`} className="flex h-11 items-center justify-center rounded-full border border-line text-sm font-medium text-ink hover:border-ink">
              Choose size
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => cart.add({ productId: product.id, variantId: null, quantity: 1 })}
              className="flex h-11 w-full items-center justify-center rounded-full bg-ink text-sm font-medium text-white hover:bg-black"
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
