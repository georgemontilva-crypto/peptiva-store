import { Link } from "react-router-dom";
import { formatPrice } from "../lib/format";
import type { RouterOutputs } from "../lib/trpc";

type Item = RouterOutputs["catalog"]["products"][number];

export default function ProductCard({ product }: { product: Item }) {
  return (
    <Link to={`/product/${product.slug}`} className="group block">
      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-mist">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} loading="lazy" className="h-full w-full object-contain p-7 transition-transform duration-500 group-hover:-translate-y-1.5" />
        ) : null}
        {product.variantCount > 1 ? (
          <span className="absolute left-3 top-3 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-navy">{product.variantCount} sizes</span>
        ) : null}
      </div>
      <div className="mt-4 flex items-start justify-between gap-3">
        <h3 className="font-display text-[1.05rem] font-medium leading-snug text-ink group-hover:text-navy">{product.name}</h3>
        <p className="shrink-0 pt-0.5 text-sm font-semibold tabular-nums text-navy">
          {product.variantCount > 1 ? <span className="font-normal text-slate">from </span> : null}
          {formatPrice(product.price)}
        </p>
      </div>
    </Link>
  );
}
