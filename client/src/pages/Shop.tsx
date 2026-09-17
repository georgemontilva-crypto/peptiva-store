import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { trpc } from "../lib/trpc";
import { usePageMeta } from "../lib/format";
import ProductCard from "../components/ProductCard";

const SORTS = [
  { value: "featured", label: "Featured" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "name", label: "Name A–Z" },
];

export default function Shop() {
  const [params, setParams] = useSearchParams();
  const category = params.get("category") ?? undefined;
  const q = params.get("q") ?? "";
  const sort = params.get("sort") ?? "featured";
  const cats = trpc.catalog.categories.useQuery();
  const products = trpc.catalog.products.useQuery(category ? { category } : undefined);
  const current = cats.data?.find((c) => c.slug === category);
  usePageMeta(`${current?.name ?? "Shop research peptides"} — Peptiva Supplies`);

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const list = useMemo(() => {
    let items = products.data ?? [];
    if (q.trim()) {
      const term = q.trim().toLowerCase();
      items = items.filter((p) => p.name.toLowerCase().includes(term));
    }
    const sorted = [...items];
    if (sort === "price-asc") sorted.sort((a, b) => Number(a.price) - Number(b.price));
    if (sort === "price-desc") sorted.sort((a, b) => Number(b.price) - Number(a.price));
    if (sort === "name") sorted.sort((a, b) => a.name.localeCompare(b.name));
    return sorted;
  }, [products.data, q, sort]);

  return (
    <div className="mx-auto max-w-6xl px-5 py-14">
      <h1 className="text-4xl font-bold tracking-tight">{current?.name ?? "Shop"}</h1>
      <p className="mt-3 max-w-xl text-slate">Every compound ships with a published certificate of analysis. Buy 2 of an item for 10% off, 3+ for 15% off.</p>

      <div className="mt-10 flex flex-col gap-4 border-b border-line pb-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          <Chip to="/shop" active={!category} label="All" />
          {cats.data?.map((c) => <Chip key={c.slug} to={`/shop?category=${c.slug}`} active={c.slug === category} label={c.name} />)}
        </div>
        <div className="flex gap-3">
          <label htmlFor="shop-search" className="sr-only">Search products</label>
          <input id="shop-search" type="search" value={q} onChange={(e) => setParam("q", e.target.value || null)} placeholder="Search compounds" className="field w-full py-2 lg:w-56" />
          <label htmlFor="shop-sort" className="sr-only">Sort by</label>
          <select id="shop-sort" value={sort} onChange={(e) => setParam("sort", e.target.value === "featured" ? null : e.target.value)} className="field w-auto py-2">
            {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>

      {products.isLoading ? (
        <p className="mt-12 text-slate">Loading products…</p>
      ) : list.length ? (
        <>
          <p className="mt-6 text-sm text-muted">{list.length} {list.length === 1 ? "product" : "products"}</p>
          <div className="mt-6 grid grid-cols-2 gap-x-5 gap-y-12 md:grid-cols-3 lg:grid-cols-4">
            {list.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </>
      ) : (
        <div className="mt-16 text-center">
          <p className="font-display text-lg text-ink">No products match “{q}”.</p>
          <button type="button" className="btn btn-ghost mt-5" onClick={() => setParams({})}>Clear filters</button>
        </div>
      )}
    </div>
  );
}

function Chip({ to, active, label }: { to: string; active: boolean; label: string }) {
  return (
    <Link to={to} aria-current={active ? "page" : undefined} className={`rounded-full border px-4 py-1.5 text-sm font-semibold ${active ? "border-navy bg-navy text-white" : "border-line text-slate hover:border-navy hover:text-navy"}`}>
      {label}
    </Link>
  );
}
