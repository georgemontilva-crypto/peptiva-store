import { useEffect, useRef, type ReactNode } from "react";
import { Link } from "react-router-dom";

export const fmtMoney = (v: string | number | null | undefined) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(v ?? 0));
export const fmtDate = (d: Date | string | null | undefined, withTime = false) =>
  d
    ? new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}) })
    : "—";

export function Card({ title, action, children, className = "" }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-line bg-white ${className}`}>
      {title ? (
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <h2 className="font-display text-[0.95rem] font-medium text-ink">{title}</h2>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

const TONES = {
  gray: "bg-slate-100 text-slate-700",
  amber: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
  green: "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200",
  blue: "bg-sky-50 text-sky-800 ring-1 ring-sky-200",
  red: "bg-red-50 text-red-700 ring-1 ring-red-200",
  teal: "bg-teal-soft text-navy ring-1 ring-teal/30",
  navy: "bg-navy text-white",
} as const;

export function Badge({ tone = "gray", children }: { tone?: keyof typeof TONES; children: ReactNode }) {
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONES[tone]}`}>{children}</span>;
}

export const ORDER_STATUS: Record<string, { label: string; tone: keyof typeof TONES }> = {
  pending: { label: "Awaiting payment", tone: "gray" },
  paid: { label: "Paid · to ship", tone: "amber" },
  on_hold: { label: "On hold", tone: "red" },
  failed: { label: "Failed", tone: "gray" },
  cancelled: { label: "Cancelled", tone: "gray" },
  shipped: { label: "Shipped", tone: "blue" },
  completed: { label: "Delivered", tone: "green" },
  refunded: { label: "Refunded", tone: "gray" },
};

export function OrderStatusBadge({ status }: { status: string }) {
  const s = ORDER_STATUS[status] ?? { label: status, tone: "gray" as const };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" | "subtle"; size?: "sm" | "md" }) {
  const v = {
    primary: "bg-navy text-white hover:bg-navy-deep disabled:opacity-50",
    ghost: "border border-line bg-white text-ink hover:border-navy hover:text-navy disabled:opacity-50",
    danger: "border border-red-200 bg-white text-red-700 hover:bg-red-50 disabled:opacity-50",
    subtle: "text-navy hover:bg-mist disabled:opacity-50",
  }[variant];
  const sz = size === "sm" ? "h-8 px-3 text-xs" : "h-10 px-4 text-sm";
  return <button type="button" {...props} className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed ${v} ${sz} ${className}`} />;
}

export function Field({ label, hint, children, className = "" }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-semibold text-ink">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

export const inputCls = "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20";

export function Modal({ title, open, onClose, children, footer, wide = false }: { title: string; open: boolean; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-navy-deep/50" onClick={onClose} />
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className={`relative flex max-h-[calc(100dvh-2rem)] w-full flex-col rounded-2xl bg-white shadow-2xl outline-none ${wide ? "max-w-3xl" : "max-w-lg"}`}>
        <div className="flex shrink-0 items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-display text-lg font-medium text-ink">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate hover:bg-mist" aria-label="Close">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer ? <div className="flex shrink-0 justify-end gap-2 border-t border-line px-5 py-3.5">{footer}</div> : null}
      </div>
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; count?: number }[] }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-xl bg-white p-1 ring-1 ring-line" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${value === o.value ? "bg-navy text-white" : "text-slate hover:bg-mist hover:text-ink"}`}
        >
          {o.label}
          {o.count != null ? <span className={`ml-1.5 text-xs ${value === o.value ? "text-white/70" : "text-muted"}`}>{o.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function Table({ head, children, empty }: { head: ReactNode[]; children: ReactNode; empty?: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="border-b border-line bg-mist/60 text-left text-xs uppercase tracking-wide text-slate">
          <tr>{head.map((h, i) => <th key={i} className="px-4 py-2.5 font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
      {empty}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="px-5 py-12 text-center text-sm text-slate">{children}</p>;
}

export function Pagination({ page, total, pageSize, onPage }: { page: number; total: number; pageSize: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between border-t border-line px-4 py-3 text-sm text-slate">
      <span>Page {page} of {pages} · {total} total</span>
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</Button>
        <Button variant="ghost" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</Button>
      </div>
    </div>
  );
}

export function Notice({ tone = "amber", children }: { tone?: "amber" | "red" | "green" | "blue"; children: ReactNode }) {
  const t = { amber: "border-amber-200 bg-amber-50 text-amber-900", red: "border-red-200 bg-red-50 text-red-800", green: "border-emerald-200 bg-emerald-50 text-emerald-900", blue: "border-sky-200 bg-sky-50 text-sky-900" }[tone];
  return <div className={`rounded-xl border px-4 py-3 text-sm ${t}`}>{children}</div>;
}

export function Stat({ label, value, hint, to }: { label: string; value: ReactNode; hint?: ReactNode; to?: string }) {
  const body = (
    <>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate">{label}</p>
      <p className="mt-1.5 font-display text-2xl font-bold tabular-nums text-navy">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </>
  );
  return to ? (
    <Link to={to} className="block rounded-2xl border border-line bg-white p-5 transition-shadow hover:shadow-[0_10px_30px_-18px_rgba(11,39,66,0.4)]">{body}</Link>
  ) : (
    <div className="rounded-2xl border border-line bg-white p-5">{body}</div>
  );
}
