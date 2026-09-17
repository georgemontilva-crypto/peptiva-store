import { useState } from "react";
import { Link } from "react-router-dom";
import { trpc } from "../lib/trpc";
import { usePageMeta } from "../lib/format";

export default function Coas() {
  usePageMeta("Lab Results & Certificates of Analysis — Peptiva Supplies", "Third-party certificates of analysis for every Peptiva Supplies research peptide.");
  const { data, isLoading } = trpc.content.coas.useQuery();
  const [q, setQ] = useState("");
  const list = (data ?? []).filter((c) => c.productName.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div className="mx-auto max-w-6xl px-5 py-16">
      <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div className="max-w-2xl">
          <h1 className="text-4xl font-bold tracking-tight">Lab results</h1>
          <p className="mt-4 text-lg leading-relaxed text-slate">
            Certificates of analysis from independent laboratories, confirming identity and purity by HPLC and mass spectrometry.
          </p>
        </div>
        <div>
          <label htmlFor="coa-search" className="sr-only">Search lab results</label>
          <input id="coa-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by compound" className="field w-full md:w-64" />
        </div>
      </div>

      {isLoading ? <p className="mt-12 text-slate">Loading results…</p> : null}
      <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((c) => (
          <li key={c.id} className="flex items-center gap-4 rounded-2xl border border-line p-4 hover:border-navy/40">
            <div className="h-20 w-20 shrink-0 rounded-xl bg-mist">
              {c.imageUrl ? <img src={c.imageUrl} alt="" loading="lazy" className="h-full w-full object-contain p-2" /> : null}
            </div>
            <div className="min-w-0 flex-1">
              <Link to={`/product/${c.productSlug}`} className="font-display font-medium text-ink hover:text-navy">{c.productName}</Link>
              <p className="text-sm text-slate">{c.lotNumber}{c.purity ? `, ${c.purity}` : ""}</p>
              {c.reportUrl ? (
                <a href={c.reportUrl} target="_blank" rel="noreferrer" className="mt-1.5 inline-block text-sm font-semibold text-navy underline underline-offset-2">
                  Open PDF report
                </a>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      {!isLoading && !list.length ? <p className="mt-12 text-slate">No results for “{q}”.</p> : null}
    </div>
  );
}
