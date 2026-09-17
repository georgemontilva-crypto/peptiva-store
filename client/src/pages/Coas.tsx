import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { trpc } from "../lib/trpc";
import { usePageMeta } from "../lib/format";
import LoadError from "../components/LoadError";

const CHECKS = [
  {
    title: "Identity",
    body: "Mass spectrometry confirms the molecular weight matches the expected compound.",
    icon: <path d="M4 18h16M6 18V9m4 9V5m4 13v-7m4 7V8" />,
  },
  {
    title: "Purity",
    body: "HPLC separates the sample and measures what share of it is the target peptide. Our release threshold is 99%.",
    icon: <path d="M3 17c3 0 3-10 6-10s3 10 6 10 3-6 6-6" />,
  },
  {
    title: "Traceability",
    body: "Each report is tied to a production batch, so results match the vial you receive.",
    icon: <path d="M7 4h10v16H7zM10 8h4M10 12h4M10 16h2" />,
  },
];

export default function Coas() {
  usePageMeta("Lab Results & Certificates of Analysis — Peptiva Supplies", "Independent certificates of analysis for every Peptiva Supplies research peptide, verified by HPLC and mass spectrometry.");
  const coas = trpc.content.coas.useQuery();
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (coas.data ?? []).filter((c) => !term || c.productName.toLowerCase().includes(term));
  }, [coas.data, q]);

  return (
    <>
      <section className="relative overflow-hidden bg-navy-deep text-white">
        <div className="lab-grid absolute inset-0 opacity-[0.35] [filter:invert(1)] [mask-image:linear-gradient(to_left,black,transparent_70%)]" aria-hidden />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 lg:grid-cols-[1.25fr_1fr]">
          <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold text-white">
            <span className="h-2 w-2 rounded-full bg-teal" aria-hidden />
            Independent laboratory testing
          </p>
          <h1 className="mt-6 max-w-3xl text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-6xl">Lab results for every compound we sell.</h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/75">
            Open any certificate of analysis to see the identity and purity data behind a product before you order it.
          </p>
          <dl className="mt-12 grid max-w-3xl grid-cols-3 divide-x divide-white/15 border-y border-white/15">
            {[
              [coas.data ? String(coas.data.length) : "—", "Published reports"],
              ["≥99%", "Purity release threshold"],
              ["HPLC + MS", "Testing methods"],
            ].map(([k, v]) => (
              <div key={v} className="px-4 py-6 first:pl-0">
                <dt className="whitespace-nowrap font-display text-xl font-bold text-white sm:text-2xl">{k}</dt>
                <dd className="mt-1 text-sm text-white/65">{v}</dd>
              </div>
            ))}
          </dl>
          </div>
          <CertificateIllustration />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="text-2xl font-bold">What each certificate confirms</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {CHECKS.map((c) => (
            <div key={c.title} className="rounded-3xl bg-ice p-7">
              <svg viewBox="0 0 24 24" className="h-9 w-9 rounded-xl bg-white p-1.5 text-teal" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                {c.icon}
              </svg>
              <h3 className="mt-5 text-lg font-medium text-ink">{c.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate">{c.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5" aria-labelledby="reports-title">
        <div className="sticky top-[6.25rem] z-20 -mx-5 flex flex-col gap-3 border-b border-line bg-white/95 px-5 py-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <h2 id="reports-title" className="text-2xl font-bold">
            All reports {coas.data ? <span className="text-base font-normal text-muted">({list.length})</span> : null}
          </h2>
          <div className="relative">
            <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <label htmlFor="coa-search" className="sr-only">Search lab results</label>
            <input id="coa-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by compound" className="field w-full pl-10 sm:w-72" />
          </div>
        </div>

        {coas.isError ? (
          <div className="mt-10"><LoadError what="the lab results" onRetry={() => coas.refetch()} /></div>
        ) : (
          <ul className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-5 lg:grid-cols-4">
            {coas.isPending
              ? Array.from({ length: 8 }, (_, i) => (
                  <li key={i} aria-hidden>
                    <div className="skeleton aspect-square rounded-3xl" />
                    <div className="skeleton mt-4 h-4 w-2/3 rounded-full" />
                    <div className="skeleton mt-3 h-10 rounded-full" />
                  </li>
                ))
              : list.map((c) => (
                  <li key={c.id} className="group flex flex-col">
                    <div className="relative aspect-square overflow-hidden rounded-3xl bg-white ring-1 ring-line">
                      {c.imageUrl ? <img src={c.imageUrl} alt="" loading="lazy" className="h-full w-full rounded-3xl object-cover transition-transform duration-500 group-hover:scale-[1.04]" /> : null}
                      <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-navy shadow-sm">
                        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 text-teal" fill="currentColor" aria-hidden><path d="M10 1.5 3 4.5v5c0 4.2 3 7.8 7 9 4-1.2 7-4.8 7-9v-5l-7-3zm-1.2 12.1L5.6 10.4l1.2-1.2 2 2 4.4-4.4 1.2 1.2-5.6 5.6z" /></svg>
                        Verified
                      </span>
                    </div>
                    <h3 className="mt-4 font-display text-[1.05rem] font-medium leading-snug text-ink">{c.productName}</h3>
                    {c.purity ? (
                      <>
                        <p className="mt-1 font-display text-2xl font-bold tabular-nums text-emerald-700">{c.purity}%<span className="ml-1 text-xs font-medium text-slate">HPLC</span></p>
                        <p className="text-xs text-slate">Lot {c.lotNumber}{c.testedAt ? ` · ${new Date(`${c.testedAt}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : ""}{c.lotCount > 1 ? ` · ${c.lotCount} lots` : ""}</p>
                      </>
                    ) : (
                      <p className="mt-1 text-sm text-slate">Certificate available (PDF)</p>
                    )}
                    <div className="mt-4 flex flex-col gap-2">
                      {c.reportUrl ? (
                        <a href={c.reportUrl} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-navy text-sm font-semibold text-white hover:bg-navy-deep">
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 14h6M9 17h4" /></svg>
                          View report<span className="sr-only"> for {c.productName} (PDF, opens in new tab)</span>
                        </a>
                      ) : null}
                      <Link to={`/product/${c.productSlug}`} className="inline-flex h-10 items-center justify-center rounded-full border border-line text-sm font-semibold text-navy hover:border-navy">
                        View product<span className="sr-only">: {c.productName}</span>
                      </Link>
                    </div>
                  </li>
                ))}
          </ul>
        )}
        {coas.data && !list.length ? (
          <div className="mt-6 rounded-3xl bg-mist px-6 py-12 text-center">
            <p className="font-display text-lg text-ink">No reports match “{q}”.</p>
            <button type="button" className="btn btn-ghost mt-5" onClick={() => setQ("")}>Show all reports</button>
          </div>
        ) : null}

        <div className="mt-20 flex flex-col items-start justify-between gap-6 rounded-3xl bg-ice p-8 sm:flex-row sm:items-center sm:p-10">
          <div>
            <h2 className="text-2xl font-bold">Need a report for a specific lot?</h2>
            <p className="mt-2 text-slate">Send us the lot number printed on your vial and we'll share the matching certificate.</p>
          </div>
          <Link to="/contact" className="btn btn-primary shrink-0">Request a COA</Link>
        </div>
      </section>
    </>
  );
}

/** Ilustración de un certificado (sin datos inventados: solo los umbrales que garantiza la tienda). */
function CertificateIllustration() {
  return (
    <div className="relative mx-auto hidden w-full max-w-sm lg:block" aria-hidden>
      <div className="absolute -right-4 top-6 h-full w-full rotate-3 rounded-3xl bg-white/10" />
      <div className="relative rounded-3xl bg-white p-7 text-ink shadow-[0_40px_80px_-30px_rgba(0,0,0,0.6)]">
        <div className="flex items-center justify-between">
          <p className="font-display text-sm font-medium text-navy">Certificate of analysis</p>
          <span className="rounded-full bg-teal-soft px-2.5 py-1 text-xs font-semibold text-navy">Pass</span>
        </div>
        <div className="mt-5 rounded-2xl bg-mist p-4">
          <svg viewBox="0 0 280 110" className="h-28 w-full">
            <path d="M0 100h280" stroke="#cfd6e0" />
            <path d="M0 98 C40 98 60 96 80 95 S110 92 118 60 S126 8 132 8 S140 70 148 92 S200 97 280 98" fill="none" stroke="#0fb0b3" strokeWidth="2.5" />
            <path d="M0 98 C40 98 60 96 80 95 S110 92 118 60 S126 8 132 8 S140 70 148 92 S200 97 280 98 V100 H0z" fill="#0fb0b3" opacity="0.12" />
            <path d="M190 98 C194 98 196 90 199 90 S204 98 208 98" fill="none" stroke="#15426e" strokeWidth="1.5" />
          </svg>
          <p className="mt-1 text-xs text-slate">HPLC chromatogram</p>
        </div>
        <dl className="mt-5 divide-y divide-line text-sm">
          {[["Purity (HPLC)", "≥ 99%"], ["Identity (MS)", "Confirmed"], ["Appearance", "Lyophilized powder"], ["Batch", "Traceable"]].map(([k, v]) => (
            <div key={k} className="flex justify-between py-2.5">
              <dt className="text-slate">{k}</dt>
              <dd className="font-semibold text-navy">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
