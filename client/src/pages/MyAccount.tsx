import { Link } from "react-router-dom";
import { usePageMeta } from "../lib/format";
import { SUPPORT_EMAIL } from "../lib/site";

export default function MyAccount() {
  usePageMeta("My account — Peptiva Supplies");
  return (
    <div className="mx-auto max-w-6xl px-5 py-16">
      <div className="grid gap-10 md:grid-cols-[1.2fr_1fr] md:items-start">
        <div>
          <p className="text-sm font-semibold text-teal">User</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight">My account</h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-slate">
            Checkout doesn't require an account. Every order gets a confirmation email with a link to follow its status and tracking number.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/track-order" className="btn btn-primary">Track an order</Link>
            <Link to="/shop" className="btn btn-ghost">Continue shopping</Link>
          </div>
        </div>
        <div className="rounded-3xl bg-mist p-8">
          <h2 className="text-lg font-medium">Need help with an order?</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate">Email us with your order number and the email used at checkout. We reply within one business day.</p>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="mt-4 inline-block font-semibold text-navy underline underline-offset-4">{SUPPORT_EMAIL}</a>
        </div>
      </div>
    </div>
  );
}
