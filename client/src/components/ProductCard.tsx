import { Link } from "react-router-dom";
import { formatPrice } from "../lib/format";
import type { RouterOutputs } from "../lib/trpc";

type Item = RouterOutputs["catalog"]["products"][number];

export default function ProductCard({ product }: { product: Item }) {
  return (
    <Link to={`/product/${product.slug}`} className="group block">
      <div className="aspect-square overflow-hidden rounded-2xl bg-mist">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-contain p-6 transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : null}
      </div>
      <div className="mt-3 flex items-baseline justify-between gap-3">
        <h3 className="font-display text-base font-medium text-ink group-hover:text-navy">{product.name}</h3>
        <p className="shrink-0 text-sm font-semibold text-navy">
          {product.variantCount > 1 ? <span className="font-normal text-slate">from </span> : null}
          {formatPrice(product.price)}
        </p>
      </div>
    </Link>
  );
}
