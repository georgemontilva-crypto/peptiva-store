import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { trpc } from "../lib/trpc";
import { formatPrice, usePageMeta } from "../lib/format";

const STEPS = [
  { key: "placed", label: "Order placed" },
  { key: "paid", label: "Confirmed" },
  { key: "shipped", label: "Shipped" },
  { key: "completed", label: "Delivered" },
];

const stepIndex = (status: string) =>
  status === "completed" ? 3 : status === "shipped" ? 2 : status === "paid" || status === "on_hold" ? 1 : 0;

const fmt = (d: Date | string | null | undefined) =>
  d ? new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "";

export default function TrackOrder() {
  usePageMeta("Track your order — Peptiva Supplies");
  const [params, setParams] = useSearchParams();
  const [order, setOrder] = useState(params.get("order") ?? "");
  const [email, setEmail] = useState(params.get("email") ?? "");
  const submitted = { order: params.get("order") ?? "", email: params.get("email") ?? "" };
  const enabled = submitted.order.length > 0 && submitted.email.includes("@");
  const q = trpc.shop.trackOrder.useQuery(submitted, { enabled, retry: false });
  const data = q.data;
  const problem = data && ["failed", "cancelled", "refunded"].includes(data.status);
  const current = data ? stepIndex(data.status) : -1;

  return (
    <div className="mx-auto max-w-4xl px-5 py-16">
      <h1 className="text-4xl font-bold tracking-tight">Track your order</h1>
      <p className="mt-3 text-slate">Enter the order number from your confirmation email (for example PV-1025) and the email you used at checkout.</p>

      <form
        className="mt-8 grid gap-3 rounded-3xl bg-mist p-5 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end sm:p-6"
        onSubmit={(e) => {
          e.preventDefault();
          setParams({ order: order.trim(), email: email.trim() }, { replace: true });
        }}
      >
        <label><span className="label">Order number</span><input required value={order} onChange={(e) => setOrder(e.target.value)} placeholder="PV-1025" className="field" /></label>
        <label><span className="label">Email</span><input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="field" /></label>
        <button type="submit" className="btn btn-primary">{q.isFetching ? "Searching…" : "Track"}</button>
      </form>

      {q.error ? <p role="alert" className="mt-6 rounded-2xl bg-red-50 px-5 py-4 text-sm text-alert">{q.error.message}</p> : null}

      {data ? (
        <section className="mt-10" aria-live="polite">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-teal">Order {data.number}</p>
              <h2 className="mt-1 text-3xl font-bold">{data.statusLabel}</h2>
              <p className="mt-1 text-sm text-slate">Placed {fmt(data.createdAt)} · Shipping to {data.shipTo}</p>
            </div>
            <p className="font-display text-xl font-medium tabular-nums text-navy">{formatPrice(data.total)}</p>
          </div>

          {problem ? (
            <p className="mt-8 rounded-2xl border border-line px-5 py-4 text-slate">
              This order is {data.statusLabel.toLowerCase()}. If you have questions, <Link to="/contact" className="font-semibold text-navy underline">contact support</Link>.
            </p>
          ) : (
            <ol className="mt-10 grid grid-cols-4 gap-2" aria-label="Order progress">
              {STEPS.map((s, i) => (
                <li key={s.key} className="relative">
                  <div className={`h-1.5 rounded-full ${i <= current ? "bg-teal" : "bg-line"}`} />
                  <p className={`mt-3 text-sm font-semibold ${i <= current ? "text-ink" : "text-muted"}`}>
                    {s.label}
                    {i === current ? <span className="sr-only"> (current step)</span> : null}
                  </p>
                </li>
              ))}
            </ol>
          )}

          {data.trackingNumber ? (
            <div className="mt-10 flex flex-col justify-between gap-4 rounded-3xl bg-ice p-6 sm:flex-row sm:items-center">
              <div>
                <p className="text-sm text-slate">{data.carrier ? `${data.carrier} tracking number` : "Tracking number"}</p>
                <p className="font-display text-xl font-medium text-ink">{data.trackingNumber}</p>
              </div>
              {data.trackingUrl ? <a href={data.trackingUrl} target="_blank" rel="noreferrer" className="btn btn-primary">Track with carrier</a> : null}
            </div>
          ) : data.status === "paid" ? (
            <p className="mt-10 rounded-3xl bg-ice p-6 text-slate">We're preparing your order. You'll get the tracking number by email as soon as it ships.</p>
          ) : null}

          <div className="mt-10 grid gap-8 md:grid-cols-2">
            <div>
              <h3 className="text-lg font-medium">History</h3>
              <ol className="mt-4 space-y-4 border-l-2 border-line pl-5">
                {[...data.events].reverse().map((e, i) => (
                  <li key={i} className="relative">
                    <span className="absolute -left-[1.72rem] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-teal" aria-hidden />
                    <p className="font-semibold text-ink">{e.label}</p>
                    {e.note ? <p className="text-sm text-slate">{e.note}</p> : null}
                    <p className="text-xs text-muted">{fmt(e.at)}</p>
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <h3 className="text-lg font-medium">Items</h3>
              <ul className="mt-4 divide-y divide-line border-y border-line text-sm">
                {data.items.map((i, idx) => (
                  <li key={idx} className="flex justify-between gap-4 py-3">
                    <span>{i.name}{i.variantLabel ? `, ${i.variantLabel}` : ""}</span>
                    <span className="text-slate">× {i.quantity}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
