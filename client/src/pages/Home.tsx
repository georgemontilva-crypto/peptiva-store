import { Link } from "react-router-dom";
import { trpc } from "../lib/trpc";
import { usePageMeta } from "../lib/format";
import ProductCard from "../components/ProductCard";

export default function Home() {
  usePageMeta("Peptiva Supplies — Research Peptides");
  const { data } = trpc.catalog.products.useQuery();

  return (
    <>
      <section className="bg-mist">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-20 md:grid-cols-[1.1fr_1fr]">
          <div>
            <h1 className="text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">
              Research peptides, tested lot by lot.
            </h1>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-slate">
              Lyophilized compounds for laboratory research, shipped across the United States with third-party
              analysis for every batch.
            </p>
            <Link
              to="/shop"
              className="mt-8 inline-block rounded-full bg-navy px-7 py-3 font-semibold text-white hover:bg-navy-deep"
            >
              Browse the catalog
            </Link>
          </div>
          <div className="grid grid-cols-3 items-end gap-3" aria-hidden>
            {data?.slice(0, 3).map((p, i) => (
              <div key={p.id} className={`rounded-2xl bg-white p-3 ${i === 1 ? "-translate-y-6" : ""}`}>
                {p.imageUrl ? <img src={p.imageUrl} alt="" className="aspect-[3/4] w-full object-contain" /> : null}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pt-16">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-2xl font-medium">Catalog</h2>
          <Link to="/shop" className="text-sm font-semibold text-navy underline underline-offset-4">
            See all {data?.length ?? ""} products
          </Link>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-4">
          {data?.slice(0, 8).map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      </section>
    </>
  );
}
