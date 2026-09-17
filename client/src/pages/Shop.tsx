import { Link, useSearchParams } from "react-router-dom";
import { trpc } from "../lib/trpc";
import { usePageMeta } from "../lib/format";
import ProductCard from "../components/ProductCard";

export default function Shop() {
  const [params] = useSearchParams();
  const category = params.get("category") ?? undefined;
  const cats = trpc.catalog.categories.useQuery();
  const products = trpc.catalog.products.useQuery(category ? { category } : undefined);
  const current = cats.data?.find((c) => c.slug === category);
  usePageMeta(`${current?.name ?? "Shop"} — Peptiva Supplies`);

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <h1 className="text-3xl font-bold tracking-tight">{current?.name ?? "All products"}</h1>

      <div className="mt-6 flex flex-wrap gap-2">
        <FilterChip to="/shop" active={!category} label="All" />
        {cats.data?.map((c) => (
          <FilterChip key={c.slug} to={`/shop?category=${c.slug}`} active={c.slug === category} label={c.name} />
        ))}
      </div>

      {products.isLoading ? (
        <p className="mt-12 text-slate">Loading products…</p>
      ) : products.data?.length ? (
        <div className="mt-10 grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
          {products.data.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      ) : (
        <p className="mt-12 text-slate">
          No products in this category yet.{" "}
          <Link to="/shop" className="text-navy underline">View all products</Link>
        </p>
      )}
    </div>
  );
}

function FilterChip({ to, active, label }: { to: string; active: boolean; label: string }) {
  return (
    <Link
      to={to}
      aria-current={active ? "page" : undefined}
      className={`rounded-full border px-4 py-1.5 text-sm font-semibold ${
        active ? "border-navy bg-navy text-white" : "border-slate-300 text-slate hover:border-navy hover:text-navy"
      }`}
    >
      {label}
    </Link>
  );
}
