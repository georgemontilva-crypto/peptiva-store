import { Link } from "react-router-dom";
import { usePageMeta } from "../lib/format";
import { SUPPORT_EMAIL } from "../lib/site";

/** Página temporal para Mi cuenta y Cuenta de afiliado hasta que se lancen los inicios de sesión. */
export default function AccountSoon({ kind }: { kind: "customer" | "affiliate" }) {
  const customer = kind === "customer";
  usePageMeta(`${customer ? "My account" : "Affiliate account"} — Peptiva Supplies`);

  return (
    <div className="mx-auto max-w-6xl px-5 py-16">
      <div className="grid gap-10 md:grid-cols-[1.2fr_1fr] md:items-start">
        <div>
          <p className="text-sm font-semibold text-teal">{customer ? "User" : "Affiliate Program"}</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight">{customer ? "My account" : "Affiliate account"}</h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-slate">
            {customer
              ? "Online accounts are moving to our new store. Until sign-in is available, you can still check out as a guest and follow your order from your confirmation email."
              : "The affiliate dashboard is moving to our new store. Until sign-in is available, our team shares your link and commission reports by email."}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {customer ? (
              <Link to="/shop" className="btn btn-primary">Continue shopping</Link>
            ) : (
              <Link to="/affiliate#apply" className="btn btn-primary">Apply to join</Link>
            )}
            <Link to="/contact" className="btn btn-ghost">Contact support</Link>
          </div>
        </div>
        <div className="rounded-3xl bg-mist p-8">
          <h2 className="text-lg font-medium">{customer ? "Need something from a past order?" : "Already an affiliate?"}</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate">
            {customer
              ? "Email us with your order number and the email used at checkout. We reply within one business day."
              : "Email us from the address you registered with to get your link, earnings or payout status."}
          </p>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="mt-4 inline-block font-semibold text-navy underline underline-offset-4">{SUPPORT_EMAIL}</a>
        </div>
      </div>
    </div>
  );
}
