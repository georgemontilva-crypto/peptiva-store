import { useEffect } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { trpc } from "../lib/trpc";
import { useCart } from "../lib/cart";
import { formatPrice, usePageMeta } from "../lib/format";
import NotFound from "./NotFound";

export default function OrderReceived() {
  usePageMeta("Order received — Peptiva Supplies");
  const { id } = useParams();
  const [params] = useSearchParams();
  const key = params.get("key") ?? "";
  const cart = useCart();
  const order = trpc.shop.order.useQuery(
    { id: Number(id), key },
    { enabled: Number(id) > 0 && key.length >= 10, retry: false, refetchInterval: (q) => (q.state.data?.status === "pending" ? 4000 : false) },
  );

  const status = order.data?.status;
  useEffect(() => {
    if (status === "paid" || status === "on_hold") cart.clear();
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  if (order.isLoading) return <div className="mx-auto h-[60vh] max-w-3xl px-5 py-16" aria-busy="true" />;
  if (!order.data) return <NotFound />;
  const o = order.data;

  const heading =
    o.status === "paid" || o.status === "shipped" || o.status === "completed"
      ? "Thank you, your order is confirmed"
      : o.status === "on_hold"
        ? "We received your order"
        : o.status === "pending"
          ? "Confirming your payment…"
          : "This order wasn't paid";

  const detail =
    o.status === "paid"
      ? `A confirmation was sent to ${o.email}. Orders ship the same or next business day.`
      : o.status === "on_hold"
        ? "Your payment is being reviewed. We'll email you as soon as it's confirmed, usually within one business day."
        : o.status === "pending"
          ? "This usually takes a few seconds. You can keep this page open."
          : "The payment was declined or cancelled, so nothing was charged. Your cart is still saved.";

  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <p className="text-sm font-semibold text-teal">Order {o.number}</p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight">{heading}</h1>
      <p className="mt-4 text-lg text-slate" role="status">{detail}</p>
      {o.status === "failed" || o.status === "cancelled" ? <Link to="/checkout" className="btn btn-primary mt-8">Return to checkout</Link> : null}

      <div className="mt-12 grid gap-8 rounded-3xl border border-line p-7 sm:grid-cols-[1.5fr_1fr]">
        <div>
          <h2 className="text-lg font-medium">Items</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {o.items.map((i, idx) => (
              <li key={idx} className="flex justify-between gap-4">
                <span>{i.name}{i.variantLabel ? `, ${i.variantLabel}` : ""} × {i.quantity}</span>
                <span className="tabular-nums">{formatPrice(i.lineTotal)}</span>
              </li>
            ))}
            {Number(o.couponDiscount) > 0 ? (
              <li className="flex justify-between gap-4 text-teal">
                <span>Code {o.couponCode?.toUpperCase()}</span>
                <span className="tabular-nums">−{formatPrice(o.couponDiscount)}</span>
              </li>
            ) : null}
            <li className="flex justify-between gap-4 border-t border-line pt-3 font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{formatPrice(o.total)}</span>
            </li>
          </ul>
        </div>
        <div className="text-sm">
          <h2 className="text-lg font-medium">Shipping to</h2>
          <p className="mt-4 leading-relaxed text-slate">{o.name}<br />{o.address.map((l) => <span key={l}>{l}<br /></span>)}</p>
        </div>
      </div>

      <Link to={`/track-order?order=${o.number}&email=${encodeURIComponent(o.email)}`} className="btn btn-ghost mt-8">Track this order</Link>

      <p className="mt-8 text-sm text-slate">
        Questions about this order? Email <a href="mailto:support@peptivasupplies.com" className="font-semibold text-navy underline">support@peptivasupplies.com</a> with your order number.
      </p>
    </div>
  );
}
