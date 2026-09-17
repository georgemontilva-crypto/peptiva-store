import { useEffect, useRef, useState } from "react";
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

/** "Every lot, independently verified." — certificado principal, tabla completa y lotes en la misma sección. */
export function VerifiedResults({ lot, lots }: { lot: Lot; lots: Lot[] }) {
  const ok = passes(lot);
  const rows: [string, React.ReactNode, string][] = [
    ["Appearance", lot.appearance || "—", "Meets spec"],
    ["Purity", <span className={`font-semibold ${ok ? "text-emerald-700" : "text-alert"}`}>{lot.purity}% · {ok ? "Pass" : "Review"}</span>, lot.specPurity || "≥ 95%"],
    ["Identity (MS)", lot.identity || "—", "Meets spec"],
    ["Net peptide content", lot.measured || "—", "Report"],
    ["Heavy metals", lot.heavyMetals || "—", "Pass"],
    ["Endotoxin", lot.endotoxin || "—", "Reported"],
  ];
  const withPdf = lots.filter((l) => l.reportUrl);

  return (
    <section className="-mx-5 rounded-none bg-mist px-4 py-10 ring-1 ring-line sm:mx-0 sm:rounded-[2rem] sm:px-8 sm:py-12 xl:-mx-10 xl:px-10" aria-labelledby="verified-title">
      <div className="mx-auto max-w-2xl text-center" data-reveal>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal">Verified test results</p>
        <h2 id="verified-title" className="mt-3 text-[1.75rem] font-bold leading-tight tracking-tight sm:text-4xl">Every lot, independently verified.</h2>
        <p className="mt-4 leading-relaxed text-slate">
          Each batch is analyzed by an accredited third-party laboratory. The report below reflects the identity, purity and full-panel specification data released with this product.
        </p>
      </div>

      <div className="mt-10 grid gap-5 lg:grid-cols-[1fr_1.3fr] xl:grid-cols-[0.82fr_1.45fr_0.95fr]">
        <div className="relative flex flex-col justify-between overflow-hidden rounded-3xl bg-gradient-to-br from-navy to-navy-deep p-6 text-white sm:p-7" data-reveal>
          <div className="lab-grid absolute inset-0 opacity-20 [filter:invert(1)] [mask-image:linear-gradient(to_top_left,black,transparent_70%)]" aria-hidden />
          <div className="scan-line pointer-events-none absolute inset-x-0 top-0 h-24" aria-hidden />
          <div className="relative">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/70">Certificate of analysis</p>
            <CountUp value={lot.purity!} className="mt-3 block text-5xl text-[#4fc7c9] sm:text-6xl lg:text-5xl xl:text-[3.4rem]" />
            <p className="mt-2 text-xs font-bold uppercase tracking-[0.16em] text-white/70">Purity by HPLC</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {["Accredited lab", lot.identity === "Confirmed" ? "Mass-spec verified" : null].filter(Boolean).map((b) => (
                <span key={b} className="rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-[0.7rem] font-bold uppercase tracking-wide">{b}</span>
              ))}
            </div>
          </div>
          <dl className="relative mt-10 grid grid-cols-2 gap-4 border-t border-white/15 pt-5 text-sm">
            <div><dt className="text-white/60">Lot</dt><dd className="font-semibold">{lot.lotNumber}</dd></div>
            <div><dt className="text-white/60">Tested</dt><dd className="font-semibold">{fmtTested(lot.testedAt)}</dd></div>
          </dl>
        </div>

        <div className="overflow-hidden rounded-3xl border-t-2 border-teal bg-white ring-1 ring-line" data-reveal style={{ transitionDelay: "80ms" }}>
          {/* Teléfono: filas apiladas para que nada se corte */}
          <dl className="divide-y divide-line sm:hidden">
            {rows.map(([k, v, spec]) => (
              <div key={k} className="px-4 py-3">
                <dt className="flex items-baseline justify-between gap-3 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-muted">
                  <span>{k}</span>
                  <span className="normal-case tracking-normal">Spec: {spec}</span>
                </dt>
                <dd className="mt-1 text-[0.95rem] font-semibold text-ink">{v}</dd>
              </div>
            ))}
          </dl>
          <table className="hidden w-full text-sm sm:table">
            <caption className="sr-only">Certificate of analysis for lot {lot.lotNumber}</caption>
            <thead>
              <tr className="text-left text-[0.68rem] uppercase tracking-[0.14em] text-muted">
                <th scope="col" className="px-4 py-4 font-semibold">Parameter</th>
                <th scope="col" className="px-4 py-4 font-semibold">Result</th>
                <th scope="col" className="px-4 py-4 text-right font-semibold">Specification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map(([k, v, spec]) => (
                <tr key={k}>
                  <th scope="row" className="px-4 py-3.5 text-left font-semibold text-ink">{k}</th>
                  <td className="px-4 py-3.5 text-slate">{v}</td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-right text-slate">{spec}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {withPdf.length ? (
          <div className="flex flex-col lg:col-span-2 xl:col-span-1" data-reveal style={{ transitionDelay: "160ms" }}>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal">Third-party verified</p>
            <h3 className="mt-1 text-lg font-bold leading-snug text-navy">Certificate of Analysis — by lot</h3>
            {/* En escritorio la lista ocupa el alto de la fila y hace scroll por dentro, sin estirar la sección */}
            <div className="mt-3 xl:relative xl:min-h-[18rem] xl:flex-1">
            <ul className="grid gap-3 sm:grid-cols-2 xl:absolute xl:inset-0 xl:grid-cols-1 xl:content-start xl:overflow-y-auto xl:pr-1">
              {withPdf.map((l) => (
                <li key={l.id} className="rounded-2xl bg-white p-4 ring-1 ring-line">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className={`text-[0.68rem] font-bold uppercase tracking-[0.14em] ${l.latest ? "text-emerald-700" : "text-muted"}`}>{l.latest ? "Latest" : "Previous lot"}</p>
                      <p className="font-display font-bold text-navy">{l.title || "Certificate"}</p>
                      <p className="text-[0.7rem] uppercase tracking-wide text-muted">Lot <span className="font-semibold text-ink">{l.lotNumber}</span></p>
                    </div>
                    {hasData(l) ? <Purity value={l.purity!} className={`text-2xl ${passes(l) ? "text-emerald-700" : "text-alert"}`} /> : null}
                  </div>
                  {hasData(l) ? (
                    <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-line pt-3 text-xs">
                      {[["Measured", l.measured], ["Identity", l.identity], ["Heavy metals", l.heavyMetals], ["Tested", fmtTested(l.testedAt)]].map(([k, v]) => (
                        <div key={k} className="min-w-0">
                          <dt className="text-muted">{k}</dt>
                          <dd className="truncate font-semibold text-ink" title={v ?? ""}>{v || "—"}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                  <a href={l.reportUrl!} target="_blank" rel="noreferrer" className="mt-3 flex h-10 items-center justify-center rounded-xl bg-mist text-sm font-semibold text-navy ring-1 ring-line transition-colors hover:bg-ice">
                    View certificate →<span className="sr-only"> for lot {l.lotNumber} (PDF)</span>
                  </a>
                </li>
              ))}
            </ul>
            </div>
          </div>
        ) : null}
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

/** Cuenta desde 0 hasta la pureza cuando la tarjeta entra en pantalla. */
function CountUp({ value, className }: { value: string; className: string }) {
  const target = Number(value);
  const decimals = value.split(".")[1]?.length ?? 0;
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(value);

  useEffect(() => {
    const el = ref.current;
    if (!el || !Number.isFinite(target) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    setShown((90).toFixed(decimals));
    const io = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const from = 90;
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / 1400);
        const eased = 1 - Math.pow(1 - t, 3);
        setShown((from + (target - from) * eased).toFixed(decimals));
        if (t < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [target, decimals]);

  return (
    <span ref={ref}>
      <span className="sr-only">{value}%</span>
      <span aria-hidden><Purity value={shown} className={className} /></span>
    </span>
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
