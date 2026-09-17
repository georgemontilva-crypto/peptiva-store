import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQuote } from "../lib/useQuote";
import { formatPrice } from "../lib/format";
import QuantityStepper from "./QuantityStepper";
import Totals from "./Totals";

export default function CartDrawer() {
  const { cart, quote, isLoading } = useQuote();
  const panelRef = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();

  useEffect(() => {
    cart.close();
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!cart.isOpen) return;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && cart.close();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [cart.isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Se mantiene montado mientras dura la animación de cierre
  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (cart.isOpen) {
      setMounted(true);
      const raf = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
      return () => cancelAnimationFrame(raf);
    }
    setShown(false);
    const t = window.setTimeout(() => setMounted(false), 400);
    return () => window.clearTimeout(t);
  }, [cart.isOpen]);

  if (!mounted) return null;

  return (
    <div className={`fixed inset-0 z-50 ${shown ? "drawer-open" : ""}`} aria-hidden={!cart.isOpen}>
      <button type="button" aria-label="Close cart" className="drawer-backdrop absolute inset-0 bg-navy-deep/45 backdrop-blur-[2px]" onClick={cart.close} tabIndex={cart.isOpen ? 0 : -1} />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Shopping cart"
        className="drawer-panel absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-2xl outline-none"
      >
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 className="text-lg font-medium">Your cart</h2>
          <button type="button" onClick={cart.close} className="rounded-full p-2 text-slate hover:text-navy" aria-label="Close cart">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        {cart.items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
            <p className="font-display text-lg text-ink">Your cart is empty</p>
            <p className="mt-2 text-sm text-slate">Add a compound from the catalog to get started.</p>
            <Link to="/shop" className="btn btn-primary mt-6">Browse products</Link>
          </div>
        ) : (
          <>
            <ul className="flex-1 divide-y divide-line overflow-y-auto px-6">
              {isLoading && !quote ? <li className="py-6 text-sm text-slate">Updating prices…</li> : null}
              {quote?.lines.map((l, i) => (
                <li key={`${l.productId}-${l.variantId}`} className="drawer-item flex gap-4 py-5" style={{ animationDelay: `${120 + i * 60}ms` }}>
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-white ring-1 ring-line">
                    {l.imageUrl ? <img src={l.imageUrl} alt="" className="h-full w-full rounded-2xl object-cover" /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between gap-3">
                      <div>
                        <Link to={`/product/${l.slug}`} className="font-display font-medium text-ink hover:text-navy">{l.name}</Link>
                        {l.variantLabel ? <p className="text-sm text-slate">{l.variantLabel}</p> : null}
                      </div>
                      <p className="text-right text-sm font-semibold tabular-nums text-ink">
                        {formatPrice(l.lineTotal)}
                        {l.bundlePercent ? <span className="block text-xs font-normal text-muted line-through">{formatPrice(l.lineSubtotal)}</span> : null}
                      </p>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <QuantityStepper size="sm" value={l.quantity} onChange={(q) => cart.setQuantity(l.productId, l.variantId, q)} />
                      <button type="button" className="text-xs font-semibold text-slate underline hover:text-alert" onClick={() => cart.remove(l.productId, l.variantId)}>
                        Remove
                      </button>
                    </div>
                    {l.bundlePercent ? (
                      <p className="mt-2 text-xs font-semibold text-teal">{l.bundlePercent}% bundle discount applied</p>
                    ) : (
                      <p className="mt-2 text-xs text-muted">Add one more for 10% off this item</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            {quote ? (
              <div className="border-t border-line bg-mist px-6 py-5">
                <Totals quote={quote} />
                <Link to="/checkout" className="btn btn-primary mt-5 w-full">Checkout</Link>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
