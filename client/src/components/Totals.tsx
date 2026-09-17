import { formatPrice } from "../lib/format";
import type { RouterOutputs } from "../lib/trpc";

type Quote = RouterOutputs["shop"]["quote"];

export default function Totals({ quote }: { quote: Quote }) {
  return (
    <dl className="space-y-2 text-sm">
      <Row label="Subtotal" value={formatPrice(quote.subtotal)} />
      {Number(quote.bundleDiscount) > 0 ? <Row label="Bundle savings" value={`−${formatPrice(quote.bundleDiscount)}`} accent /> : null}
      {quote.coupon ? <Row label={`Code ${quote.coupon.code.toUpperCase()} (${quote.coupon.label})`} value={`−${formatPrice(quote.couponDiscount)}`} accent /> : null}
      <Row label="Shipping" value="Free" />
      <div className="flex items-baseline justify-between border-t border-line pt-3">
        <dt className="font-display text-base font-medium text-ink">Total</dt>
        <dd className="font-display text-xl font-bold text-navy tabular-nums">{formatPrice(quote.total)}</dd>
      </div>
    </dl>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate">{label}</dt>
      <dd className={`tabular-nums ${accent ? "font-semibold text-teal" : "text-ink"}`}>{value}</dd>
    </div>
  );
}
