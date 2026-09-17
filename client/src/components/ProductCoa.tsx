import type { RouterOutputs } from "../lib/trpc";

type Lot = RouterOutputs["catalog"]["productBySlug"]["coas"][number];

export const fmtTested = (d: string | null) =>
  d ? new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

const specNumber = (spec: string | null) => Number((spec ?? "").match(/\d+(\.\d+)?/)?.[0] ?? 95);
export const hasData = (l: Lot) => l.lotNumber !== "Current batch" && Boolean(l.purity);
export const passes = (l: Lot) => Number(l.purity) >= specNumber(l.specPurity);

function Purity({ value, className }: { value: string; className: string }) {
  return (
    <span className={`font-display font-bold tabular-nums tracking-tight ${className}`}>
      {value}
      <span className="ml-0.5 text-[0.4em] align-baseline">%</span>
    </span>
  );
}

/** "Every lot, independently verified." — certificado principal con la tabla completa. */
export function VerifiedResults({ lot }: { lot: Lot }) {
  const ok = passes(lot);
  const rows: [string, React.ReactNode, string][] = [
    ["Appearance", lot.appearance || "—", "Meets spec"],
    ["Purity", <span className={`font-semibold ${ok ? "text-emerald-700" : "text-alert"}`}>{lot.purity}% · {ok ? "Pass" : "Review"}</span>, lot.specPurity || "≥ 95%"],
    ["Identity (MS)", lot.identity || "—", "Meets spec"],
    ["Net peptide content", lot.measured || "—", "Report"],
    ["Heavy metals", lot.heavyMetals || "—", "Pass"],
    ["Endotoxin", lot.endotoxin || "—", "Reported"],
  ];

  return (
    <section className="rounded-[2rem] bg-mist px-5 py-12 ring-1 ring-line sm:px-10" aria-labelledby="verified-title">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal">Verified test results</p>
        <h2 id="verified-title" className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Every lot, independently verified.</h2>
        <p className="mt-4 leading-relaxed text-slate">
          Each batch is analyzed by an accredited third-party laboratory. The report below reflects the identity, purity and full-panel specification data released with this product.
        </p>
      </div>

      <div className="mt-10 grid gap-5 lg:grid-cols-[1fr_1.35fr]">
        <div className="relative flex flex-col justify-between overflow-hidden rounded-3xl bg-gradient-to-br from-navy to-navy-deep p-8 text-white">
          <div className="lab-grid absolute inset-0 opacity-20 [filter:invert(1)] [mask-image:linear-gradient(to_top_left,black,transparent_70%)]" aria-hidden />
          <div className="relative">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/70">Certificate of analysis</p>
            <Purity value={lot.purity!} className="mt-3 block text-6xl text-[#4fc7c9] sm:text-7xl" />
            <p className="mt-2 text-xs font-bold uppercase tracking-[0.16em] text-white/70">Purity by HPLC</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {["Accredited lab", lot.identity === "Confirmed" ? "Mass-spec verified" : null].filter(Boolean).map((b) => (
                <span key={b} className="rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wide">{b}</span>
              ))}
            </div>
          </div>
          <dl className="relative mt-10 grid grid-cols-2 gap-4 border-t border-white/15 pt-5 text-sm">
            <div><dt className="text-white/60">Lot</dt><dd className="font-semibold">{lot.lotNumber}</dd></div>
            <div><dt className="text-white/60">Tested</dt><dd className="font-semibold">{fmtTested(lot.testedAt)}</dd></div>
          </dl>
        </div>

        <div className="overflow-hidden rounded-3xl border-t-2 border-teal bg-white ring-1 ring-line">
          <table className="w-full text-sm">
            <caption className="sr-only">Certificate of analysis for lot {lot.lotNumber}</caption>
            <thead>
              <tr className="text-left text-[0.7rem] uppercase tracking-[0.14em] text-muted">
                <th scope="col" className="px-5 py-4 font-semibold">Parameter</th>
                <th scope="col" className="px-5 py-4 font-semibold">Result</th>
                <th scope="col" className="px-5 py-4 text-right font-semibold">Specification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map(([k, v, spec]) => (
                <tr key={k}>
                  <th scope="row" className="px-5 py-4 text-left font-semibold text-ink">{k}</th>
                  <td className="px-5 py-4 text-slate">{v}</td>
                  <td className="px-5 py-4 text-right text-slate">{spec}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <p className="max-w-md text-sm text-muted">
          Representative report from lot {lot.lotNumber}{lot.title ? ` (${lot.title})` : ""}. Your order ships with its own lot-specific certificate.
        </p>
        {lot.reportUrl ? (
          <a href={lot.reportUrl} target="_blank" rel="noreferrer" className="btn bg-ink px-6 text-white hover:bg-navy">
            View this batch's certificate →
          </a>
        ) : null}
      </div>
    </section>
  );
}

/** "Certificate of Analysis — by lot" — una tarjeta por lote. */
export function LotGrid({ lots }: { lots: Lot[] }) {
  return (
    <section aria-labelledby="lots-title">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal">Third-party verified</p>
      <h2 id="lots-title" className="mt-3 text-3xl font-bold tracking-tight">Certificate of Analysis — by lot</h2>
      <p className="mt-3 text-slate">Every lot is HPLC-tested at an accredited lab. Open any batch's certificate below.</p>
      <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {lots.map((l) => (
          <li key={l.id} className="flex flex-col rounded-3xl bg-white p-6 ring-1 ring-line">
            <p className={`text-xs font-bold uppercase tracking-[0.14em] ${l.latest ? "text-emerald-700" : "text-muted"}`}>{l.latest ? "Latest" : "Previous lot"}</p>
            <p className="mt-2 font-display text-lg font-bold text-navy">{l.title || "Certificate"}</p>
            <p className="mt-1 text-xs uppercase tracking-wide text-muted">Lot <span className="font-semibold text-ink">{l.lotNumber}</span></p>
            {hasData(l) ? (
              <>
                <Purity value={l.purity!} className={`mt-4 text-4xl ${passes(l) ? "text-emerald-700" : "text-alert"}`} />
                <p className="text-sm text-slate">HPLC purity · <span className="text-navy">{passes(l) ? "meets spec" : "below spec"}</span></p>
                <dl className="mt-5 space-y-2.5 border-t border-line pt-4 text-sm">
                  {[["Measured", l.measured], ["Identity", l.identity], ["Heavy metals", l.heavyMetals], ["Tested", fmtTested(l.testedAt)]].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4">
                      <dt className="text-slate">{k}</dt>
                      <dd className="text-right font-semibold text-ink">{v || "—"}</dd>
                    </div>
                  ))}
                </dl>
              </>
            ) : (
              <p className="mt-4 text-sm text-slate">The full certificate is available as a PDF.</p>
            )}
            {l.reportUrl ? (
              <a href={l.reportUrl} target="_blank" rel="noreferrer" className="mt-6 inline-flex h-12 items-center justify-center rounded-2xl bg-mist text-sm font-semibold text-navy ring-1 ring-line hover:bg-ice">
                View certificate →<span className="sr-only"> for lot {l.lotNumber} (PDF)</span>
              </a>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
