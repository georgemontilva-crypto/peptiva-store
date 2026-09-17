import { useEffect, useRef, useState } from "react";
import { getAffiliateCode } from "../lib/affiliate";
import { Link, useSearchParams } from "react-router-dom";
import { trpc } from "../lib/trpc";
import { useQuote } from "../lib/useQuote";
import { formatPrice, usePageMeta } from "../lib/format";
import Totals from "../components/Totals";
import CouponForm from "../components/CouponForm";

const STATES = "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(" ");

type Form = {
  email: string; firstName: string; lastName: string; phone: string; address1: string; address2: string;
  city: string; state: string; zip: string; customerNote: string; researchAcknowledged: boolean;
};
const empty: Form = { email: "", firstName: "", lastName: "", phone: "", address1: "", address2: "", city: "", state: "", zip: "", customerNote: "", researchAcknowledged: false };

export default function Checkout() {
  usePageMeta("Checkout — Peptiva Supplies");
  const { cart, quote, isLoading } = useQuote();
  const [params] = useSearchParams();
  const payment = params.get("payment");
  const [form, setForm] = useState<Form>(empty);
  const enabled = trpc.shop.paymentsEnabled.useQuery();
  const placeOrder = trpc.shop.placeOrder.useMutation({
    onSuccess: ({ redirectUrl }) => {
      window.location.href = redirectUrl;
    },
  });

  // Guarda el carrito cuando hay un email válido, para poder enviar recordatorios si no termina la compra
  const saveCart = trpc.shop.saveCart.useMutation();
  const lastSaved = useRef("");
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim());
  const persistCart = () => {
    if (!emailValid || !cart.items.length) return;
    const key = JSON.stringify([form.email.trim().toLowerCase(), form.firstName.trim(), cart.items, cart.couponCode]);
    if (key === lastSaved.current) return;
    lastSaved.current = key;
    saveCart.mutate({
      token: cart.token,
      email: form.email.trim(),
      firstName: form.firstName.trim() || null,
      lines: cart.items,
      couponCode: cart.couponCode,
      affiliateCode: getAffiliateCode(),
    });
  };
  useEffect(() => {
    if (!lastSaved.current) return; // solo re-guarda si ya se guardó una vez
    const t = window.setTimeout(persistCart, 800);
    return () => window.clearTimeout(t);
  }, [cart.items, cart.couponCode]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof Form>(key: K) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value }));

  const fieldErrors = placeOrder.error?.data?.zodError as { fieldErrors?: Record<string, string[]> } | null | undefined;
  const errorFor = (k: keyof Form) => fieldErrors?.fieldErrors?.[k]?.[0];

  if (!cart.items.length) {
    return (
      <div className="mx-auto max-w-xl px-5 py-24 text-center">
        <h1 className="text-3xl font-bold">Your cart is empty</h1>
        <p className="mt-3 text-slate">Add products to your cart to check out.</p>
        <Link to="/shop" className="btn btn-primary mt-8">Browse products</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <h1 className="text-4xl font-bold tracking-tight">Checkout</h1>

      {payment === "failed" ? (
        <p role="alert" className="mt-6 rounded-2xl border border-alert/30 bg-red-50 px-5 py-4 text-sm text-alert">
          Your payment was declined. Your cart is still saved, so you can try again or use a different card.
        </p>
      ) : null}
      {payment === "cancelled" ? (
        <p role="status" className="mt-6 rounded-2xl bg-mist px-5 py-4 text-sm text-slate">Payment was cancelled. Your cart is still saved.</p>
      ) : null}

      <form
        className="mt-10 grid gap-12 lg:grid-cols-[1.4fr_1fr]"
        onSubmit={(e) => {
          e.preventDefault();
          if (!form.researchAcknowledged) return;
          placeOrder.mutate({
            ...form,
            state: form.state as (typeof STATES)[number] as never,
            address2: form.address2 || null,
            customerNote: form.customerNote || null,
            researchAcknowledged: true,
            lines: cart.items,
            couponCode: cart.couponCode,
            cartToken: cart.token,
            affiliateCode: getAffiliateCode(),
          });
        }}
      >
        <div className="space-y-10">
          <section>
            <h2 className="text-xl font-medium">Contact</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Email" error={errorFor("email")} className="sm:col-span-2">
                <input type="email" autoComplete="email" required value={form.email} onChange={set("email")} onBlur={persistCart} className="field" />
              </Field>
              <Field label="Phone" error={errorFor("phone")} className="sm:col-span-2">
                <input type="tel" autoComplete="tel" required value={form.phone} onChange={set("phone")} className="field" />
              </Field>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-medium">Billing & shipping address</h2>
            <p className="mt-1 text-sm text-slate">We currently ship within the United States only.</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="First name" error={errorFor("firstName")}>
                <input autoComplete="given-name" required value={form.firstName} onChange={set("firstName")} onBlur={persistCart} className="field" />
              </Field>
              <Field label="Last name" error={errorFor("lastName")}>
                <input autoComplete="family-name" required value={form.lastName} onChange={set("lastName")} className="field" />
              </Field>
              <Field label="Street address" error={errorFor("address1")} className="sm:col-span-2">
                <input autoComplete="address-line1" required value={form.address1} onChange={set("address1")} className="field" />
              </Field>
              <Field label="Apartment, suite, etc. (optional)" className="sm:col-span-2">
                <input autoComplete="address-line2" value={form.address2} onChange={set("address2")} className="field" />
              </Field>
              <Field label="City" error={errorFor("city")} className="sm:col-span-2">
                <input autoComplete="address-level2" required value={form.city} onChange={set("city")} className="field" />
              </Field>
              <Field label="State" error={errorFor("state")}>
                <select autoComplete="address-level1" required value={form.state} onChange={set("state")} className="field">
                  <option value="">Select</option>
                  {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="ZIP code" error={errorFor("zip")}>
                <input autoComplete="postal-code" inputMode="numeric" required value={form.zip} onChange={set("zip")} className="field" />
              </Field>
              <Field label="Order notes (optional)" className="sm:col-span-2">
                <textarea rows={3} value={form.customerNote} onChange={set("customerNote")} className="field" />
              </Field>
            </div>
          </section>
        </div>

        <aside className="lg:sticky lg:top-32 lg:self-start">
          <div className="rounded-3xl bg-mist p-6 sm:p-8">
            <h2 className="text-xl font-medium">Order summary</h2>
            {isLoading ? <p className="mt-4 text-sm text-slate">Calculating…</p> : null}
            {quote ? (
              <>
                <ul className="mt-5 space-y-4">
                  {quote.lines.map((l) => (
                    <li key={`${l.productId}-${l.variantId}`} className="flex items-center gap-3">
                      <div className="relative h-14 w-14 shrink-0 rounded-2xl bg-white ring-1 ring-line">
                        {l.imageUrl ? <img src={l.imageUrl} alt="" className="h-full w-full rounded-2xl object-cover" /> : null}
                        <span className="absolute -right-1.5 -top-1.5 rounded-full bg-navy px-1.5 text-xs font-bold leading-5 text-white">{l.quantity}</span>
                      </div>
                      <div className="min-w-0 flex-1 text-sm">
                        <p className="font-semibold text-ink">{l.name}</p>
                        <p className="text-slate">{[l.variantLabel, l.bundlePercent ? `${l.bundlePercent}% bundle` : null].filter(Boolean).join(", ")}</p>
                      </div>
                      <p className="text-sm font-semibold tabular-nums">{formatPrice(l.lineTotal)}</p>
                    </li>
                  ))}
                </ul>
                <div className="my-6 border-t border-line pt-6">
                  <CouponForm error={quote.couponError} />
                </div>
                <Totals quote={quote} />
              </>
            ) : null}

            <label className="mt-6 flex gap-3 text-sm leading-relaxed text-slate">
              <input type="checkbox" required checked={form.researchAcknowledged} onChange={set("researchAcknowledged")} className="mt-1 h-4 w-4 shrink-0 accent-navy" />
              <span>
                I am 18 or older and confirm these products are for laboratory research use only, not for human or veterinary use. I agree to the{" "}
                <Link to="/terms-conditions" target="_blank" className="underline">terms & conditions</Link> and{" "}
                <Link to="/return-refund" target="_blank" className="underline">refund policy</Link>.
              </span>
            </label>

            {placeOrder.error && !fieldErrors?.fieldErrors ? (
              <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-alert">{placeOrder.error.message}</p>
            ) : null}
            {enabled.data === false ? (
              <p className="mt-4 rounded-xl bg-white px-4 py-3 text-sm text-slate">Card payments are being set up. Please check back shortly or contact support.</p>
            ) : null}

            <button type="submit" className="btn btn-primary mt-6 w-full py-4 text-base" disabled={placeOrder.isPending || !quote || Boolean(quote.couponError) || enabled.data === false}>
              {placeOrder.isPending ? "Opening secure payment…" : `Pay ${quote ? formatPrice(quote.total) : ""} by card`}
            </button>
            <p className="mt-3 text-center text-xs text-muted">You'll enter your card on our payment provider's secure page.</p>
          </div>
        </aside>
      </form>
    </div>
  );
}

function Field({ label, error, className = "", children }: { label: string; error?: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-sm text-alert">{error}</span> : null}
    </label>
  );
}
