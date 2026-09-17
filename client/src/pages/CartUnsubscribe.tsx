import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { trpc } from "../lib/trpc";

export default function CartUnsubscribe() {
  const { token = "" } = useParams();
  const m = trpc.shop.unsubscribeCart.useMutation();
  useEffect(() => {
    if (token.length >= 16) m.mutate({ token });
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mx-auto max-w-xl px-5 py-24 text-center">
      <h1 className="text-3xl font-bold">{m.isSuccess ? "You won't get cart reminders" : m.isError ? "Something went wrong" : "Updating…"}</h1>
      <p className="mt-3 text-slate">
        {m.isSuccess ? "We stopped the reminder emails for this cart. Order confirmations and shipping updates are not affected." : m.isError ? "Please try the link again or contact support." : ""}
      </p>
      <Link to="/" className="btn btn-primary mt-8">Back to the store</Link>
    </div>
  );
}
