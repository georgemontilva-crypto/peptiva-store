import { useState } from "react";
import { Link } from "react-router-dom";
import { trpc } from "../lib/trpc";
import { formatPrice, usePageMeta } from "../lib/format";

const fmtDate = (d: Date | string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-800",
  approved: "bg-teal-soft text-navy",
  paid: "bg-emerald-50 text-emerald-800",
  rejected: "bg-mist text-muted",
};

export default function AffiliateAccount() {
  usePageMeta("Affiliate account — Peptiva Supplies");
  const me = trpc.affiliate.me.useQuery();
  if (me.isPending) return <div className="mx-auto h-[60vh] max-w-6xl px-5 py-16" aria-busy="true" />;
  return me.data ? <Dashboard /> : <Login />;
}

function Login() {
  const utils = trpc.useUtils();
  const [mode, setMode] = useState<"login" | "reset">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const login = trpc.affiliate.login.useMutation({ onSuccess: () => utils.affiliate.me.invalidate() });
  const reset = trpc.affiliate.requestReset.useMutation();

  return (
    <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 md:grid-cols-[1fr_1fr] md:items-start">
      <div>
        <p className="text-sm font-semibold text-teal">Affiliate Program</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight">Affiliate account</h1>
        <p className="mt-4 max-w-md text-lg leading-relaxed text-slate">Sign in to get your referral link and follow your clicks, orders, commissions and payouts.</p>
        <p className="mt-8 text-sm text-slate">Not an affiliate yet?</p>
        <Link to="/affiliate#apply" className="btn btn-ghost mt-3">Apply to join</Link>
      </div>

      <div className="rounded-3xl bg-mist p-7 sm:p-9">
        {mode === "login" ? (
          <form
            className="grid gap-5"
            onSubmit={(e) => {
              e.preventDefault();
              login.mutate({ email, password });
            }}
          >
            <h2 className="text-2xl font-bold">Sign in</h2>
            <label><span className="label">Email</span><input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="field" /></label>
            <label><span className="label">Password</span><input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="field" /></label>
            {login.error ? <p role="alert" className="text-sm text-alert">{login.error.message}</p> : null}
            <button type="submit" className="btn btn-primary" disabled={login.isPending}>{login.isPending ? "Signing in…" : "Sign in"}</button>
            <button type="button" className="justify-self-start text-sm font-semibold text-navy underline" onClick={() => setMode("reset")}>Forgot your password?</button>
          </form>
        ) : (
          <form
            className="grid gap-5"
            onSubmit={(e) => {
              e.preventDefault();
              reset.mutate({ email });
            }}
          >
            <h2 className="text-2xl font-bold">Reset password</h2>
            {reset.isSuccess ? (
              <p role="status" className="text-slate">If that email belongs to an active affiliate, we sent a link to choose a new password. Check your inbox and spam folder.</p>
            ) : (
              <>
                <p className="text-sm text-slate">We'll email you a link to choose a new password. First time here? The same link lets you create it.</p>
                <label><span className="label">Email</span><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="field" /></label>
                {reset.error ? <p role="alert" className="text-sm text-alert">{reset.error.message}</p> : null}
                <button type="submit" className="btn btn-primary" disabled={reset.isPending}>Send link</button>
              </>
            )}
            <button type="button" className="justify-self-start text-sm font-semibold text-navy underline" onClick={() => setMode("login")}>Back to sign in</button>
          </form>
        )}
      </div>
    </div>
  );
}

function Dashboard() {
  const utils = trpc.useUtils();
  const d = trpc.affiliate.dashboard.useQuery();
  const logout = trpc.affiliate.logout.useMutation({ onSuccess: () => utils.affiliate.me.invalidate() });
  const payout = trpc.affiliate.updatePayout.useMutation({ onSuccess: () => utils.affiliate.dashboard.invalidate() });
  const [copied, setCopied] = useState(false);
  const [editPayout, setEditPayout] = useState<{ payoutMethod: string; payoutDetails: string } | null>(null);

  if (d.isPending) return <div className="mx-auto h-[60vh] max-w-6xl px-5 py-16" aria-busy="true" />;
  if (!d.data) return <p className="mx-auto max-w-6xl px-5 py-16 text-alert">{d.error?.message ?? "Could not load your dashboard."}</p>;
  const a = d.data;
  const link = `${window.location.origin}/?ref=${a.code}`;
  const balance = a.totals.approved;

  return (
    <div className="mx-auto max-w-6xl px-5 py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-teal">Affiliate account</p>
          <h1 className="mt-1 text-4xl font-bold tracking-tight">Hi, {a.name.split(" ")[0]}</h1>
          <p className="mt-2 text-slate">You earn {a.rate}% on qualifying sales, tracked for {a.cookieDays} days after each click.</p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => logout.mutate()}>Sign out</button>
      </div>

      <div className="mt-8 rounded-3xl bg-navy-deep p-6 text-white sm:p-8">
        <p className="text-sm text-white/70">Your referral link</p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <input readOnly value={link} className="w-full rounded-full border border-white/20 bg-white/10 px-5 py-3 text-white" onFocus={(e) => e.currentTarget.select()} aria-label="Referral link" />
          <button
            type="button"
            className="btn shrink-0 bg-teal text-white hover:bg-white hover:text-navy"
            onClick={() => {
              navigator.clipboard?.writeText(link).then(() => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 2000);
              });
            }}
          >
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
        <p className="mt-3 text-sm text-white/60">Add it to any page: {window.location.origin}/product/bpc-157?ref={a.code}</p>
        {a.coupons.length ? (
          <p className="mt-4 text-sm text-white/80">
            Your codes: {a.coupons.map((c) => `${c.code.toUpperCase()} (${c.type === "percent" ? `${Number(c.amount)}%` : formatPrice(c.amount)} off)`).join(" · ")}
          </p>
        ) : null}
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-3xl bg-line md:grid-cols-4">
        {[
          ["Clicks", String(a.totals.clicks), `${a.clicks30} in the last 30 days`],
          ["Referred orders", String(a.totals.orders), `${a.totals.conversionRate}% conversion`],
          ["Pending", formatPrice(a.totals.pending), "Waiting for delivery"],
          ["Ready to pay", formatPrice(balance), `Minimum payout ${formatPrice(a.minPayout)}`],
        ].map(([k, v, hint]) => (
          <div key={k} className="bg-white p-6">
            <dt className="text-sm text-slate">{k}</dt>
            <dd className="mt-1 font-display text-2xl font-bold tabular-nums text-navy">{v}</dd>
            <dd className="mt-1 text-xs text-muted">{hint}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-10 grid gap-8 lg:grid-cols-[2fr_1fr]">
        <section>
          <h2 className="text-xl font-medium">Commissions</h2>
          {a.commissions.length ? (
            <div className="mt-4 overflow-x-auto rounded-2xl border border-line">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="bg-mist text-left text-slate">
                  <tr><th className="px-4 py-3 font-semibold">Order</th><th className="px-4 py-3 font-semibold">Date</th><th className="px-4 py-3 font-semibold">Sale</th><th className="px-4 py-3 font-semibold">Commission</th><th className="px-4 py-3 font-semibold">Status</th></tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {a.commissions.map((c) => (
                    <tr key={c.id}>
                      <td className="px-4 py-3 font-semibold">{c.orderNumber}</td>
                      <td className="px-4 py-3 text-slate">{fmtDate(c.createdAt)}</td>
                      <td className="px-4 py-3 tabular-nums">{formatPrice(c.base)}</td>
                      <td className="px-4 py-3 font-semibold tabular-nums">{formatPrice(c.amount)}</td>
                      <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${STATUS_STYLE[c.status]}`}>{c.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-4 rounded-2xl bg-mist px-5 py-8 text-center text-slate">No referred orders yet. Share your link to start earning.</p>
          )}
        </section>

        <aside className="space-y-8">
          <section className="rounded-3xl bg-mist p-6">
            <h2 className="text-lg font-medium">Payout details</h2>
            {editPayout ? (
              <form
                className="mt-4 grid gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  payout.mutate(editPayout, { onSuccess: () => setEditPayout(null) });
                }}
              >
                <label>
                  <span className="label">Method</span>
                  <select value={editPayout.payoutMethod} onChange={(e) => setEditPayout({ ...editPayout, payoutMethod: e.target.value })} className="field" required>
                    <option value="">Select</option>
                    <option>PayPal</option><option>Zelle</option><option>Venmo</option><option>Bank transfer</option><option>Store credit</option>
                  </select>
                </label>
                <label><span className="label">Account (email, phone or details)</span><input required value={editPayout.payoutDetails} onChange={(e) => setEditPayout({ ...editPayout, payoutDetails: e.target.value })} className="field" /></label>
                {payout.error ? <p className="text-sm text-alert">{payout.error.message}</p> : null}
                <div className="flex gap-2"><button className="btn btn-primary" disabled={payout.isPending}>Save</button><button type="button" className="btn btn-ghost" onClick={() => setEditPayout(null)}>Cancel</button></div>
              </form>
            ) : (
              <>
                <p className="mt-3 text-sm text-slate">{a.payoutMethod ? `${a.payoutMethod}: ${a.payoutDetails}` : "Add where you want to receive payouts."}</p>
                <button type="button" className="mt-4 text-sm font-semibold text-navy underline" onClick={() => setEditPayout({ payoutMethod: a.payoutMethod ?? "", payoutDetails: a.payoutDetails ?? "" })}>
                  {a.payoutMethod ? "Edit" : "Add payout details"}
                </button>
              </>
            )}
          </section>

          <section>
            <h2 className="text-lg font-medium">Payouts</h2>
            {a.payouts.length ? (
              <ul className="mt-3 divide-y divide-line border-y border-line text-sm">
                {a.payouts.map((p) => (
                  <li key={p.id} className="flex justify-between py-3"><span className="text-slate">{fmtDate(p.createdAt)}{p.method ? ` · ${p.method}` : ""}</span><span className="font-semibold tabular-nums">{formatPrice(p.amount)}</span></li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-slate">No payouts yet. Paid out so far: {formatPrice(a.totals.paidOut)}.</p>
            )}
          </section>
        </aside>
      </div>

      <p className="mt-12 text-sm text-slate">
        Commissions are approved once an order is delivered and paid out when your balance reaches the minimum. Promote products as research use only, without medical or dosing claims.
      </p>
    </div>
  );
}
