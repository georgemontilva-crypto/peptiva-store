import { useEffect } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { trpc } from "../lib/trpc";
import { useCart } from "../lib/cart";

/** Enlace del email de carrito abandonado: restaura los productos y lleva al checkout. */
export default function CartRecover() {
  const { token = "" } = useParams();
  const [params] = useSearchParams();
  const cart = useCart();
  const navigate = useNavigate();
  const q = trpc.shop.recoverCart.useQuery({ token }, { enabled: token.length >= 16, retry: false });

  useEffect(() => {
    if (!q.data) return;
    cart.replace(q.data.lines, params.get("coupon") ?? q.data.couponCode ?? null);
    navigate("/checkout", { replace: true });
  }, [q.data]); // eslint-disable-line react-hooks/exhaustive-deps

  if (q.error) {
    return (
      <div className="mx-auto max-w-xl px-5 py-24 text-center">
        <h1 className="text-3xl font-bold">This cart link expired</h1>
        <p className="mt-3 text-slate">You can still add the products again from the shop.</p>
        <Link to="/shop" className="btn btn-primary mt-8">Go to the shop</Link>
      </div>
    );
  }
  return <p className="mx-auto max-w-xl px-5 py-24 text-center text-slate" role="status">Restoring your cart…</p>;
}
