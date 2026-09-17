import { useState } from "react";
import { useCart } from "../lib/cart";

export default function CouponForm({ error }: { error?: string | null }) {
  const cart = useCart();
  const [code, setCode] = useState("");

  if (cart.couponCode && !error) {
    return (
      <p className="flex items-center justify-between text-sm">
        <span className="text-slate">Code <strong className="text-ink">{cart.couponCode.toUpperCase()}</strong> applied</span>
        <button type="button" className="font-semibold text-navy underline" onClick={() => cart.setCoupon(null)}>Remove</button>
      </p>
    );
  }

  return (
    <div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (code.trim()) cart.setCoupon(code.trim());
        }}
      >
        <label htmlFor="coupon" className="sr-only">Discount code</label>
        <input id="coupon" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Discount code" className="field py-2" />
        <button type="submit" className="btn btn-ghost px-4 py-2">Apply</button>
      </form>
      {error ? (
        <p className="mt-2 text-sm text-alert" role="alert">
          {error}{" "}
          <button type="button" className="underline" onClick={() => cart.setCoupon(null)}>Clear</button>
        </p>
      ) : null}
    </div>
  );
}
