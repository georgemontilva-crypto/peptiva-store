import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { trpc } from "../lib/trpc";
import { usePageMeta } from "../lib/format";

const TERMS = [
  ["10%", "Commission per sale"],
  ["30 days", "Cookie window"],
  ["$25", "Minimum payout"],
];

const STEPS = [
  { title: "Share", body: "Introduce Peptiva to your audience with your unique link. Clicks are tracked for 30 days, so later purchases still count." },
  { title: "Earn", body: "Receive a commission on qualifying purchases made through your link, approved once the order completes." },
  { title: "Grow", body: "Use product information and certificates of analysis to create accurate, educational content for researchers." },
];

export default function Affiliate() {
  usePageMeta("Affiliate Program — Peptiva Supplies", "Join the Peptiva Supplies affiliate program and earn 10% commission on referred research peptide sales.");
  const { hash } = useLocation();
  const [form, setForm] = useState({ name: "", email: "", channel: "", audience: "", message: "", website: "" });
  const apply = trpc.content.applyAffiliate.useMutation();
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    if (hash === "#apply") {
      const t = window.setTimeout(() => document.getElementById("apply")?.scrollIntoView({ block: "start" }), 50);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [hash]);

  return (
    <>
      <section className="relative overflow-hidden bg-navy-deep text-white">
        <div className="lab-grid absolute inset-0 opacity-[0.35] [filter:invert(1)] [mask-image:linear-gradient(to_left,black,transparent_70%)]" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-5 py-20">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold text-white">
            <span className="h-2 w-2 rounded-full bg-teal" aria-hidden />
            Affiliate Program
          </p>
          <h1 className="mt-6 max-w-3xl text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-6xl">Become a Peptiva affiliate.</h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/75">
            Partner with a research brand built on quality, transparency and independently verified products, and earn on every sale you refer.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <a href="#apply" className="btn bg-teal px-7 py-3.5 text-white hover:bg-white hover:text-navy">Apply to join</a>
            <Link to="/affiliate-account" className="btn border border-white/40 px-7 py-3.5 text-white hover:bg-white hover:text-navy">Affiliate account</Link>
          </div>
          <dl className="mt-14 grid max-w-2xl grid-cols-3 divide-x divide-white/15 border-y border-white/15">
            {TERMS.map(([k, v]) => (
              <div key={v} className="px-4 py-6 first:pl-0">
                <dt className="whitespace-nowrap font-display text-2xl font-bold text-white sm:text-3xl">{k}</dt>
                <dd className="mt-1 text-sm text-white/65">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20">
        <h2 className="text-3xl font-bold">How it works</h2>
        <ol className="mt-10 grid gap-4 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="rounded-3xl bg-ice p-8">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white font-display font-bold text-navy">{i + 1}</span>
              <h3 className="mt-5 text-xl font-medium text-ink">{s.title}</h3>
              <p className="mt-2 leading-relaxed text-slate">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="apply" className="mx-auto max-w-6xl scroll-mt-32 px-5">
        <div className="grid gap-12 rounded-[2rem] bg-mist p-8 sm:p-12 md:grid-cols-[1fr_1.3fr]">
          <div>
            <h2 className="text-3xl font-bold">Apply to join</h2>
            <p className="mt-4 leading-relaxed text-slate">Tell us where you'll share Peptiva. We review applications within 2 business days and email you your affiliate link once approved.</p>
            <ul className="mt-8 space-y-3 text-sm text-slate">
              {["Content must describe products as research use only", "No medical, dosing or human-use claims", "No paid ads bidding on the Peptiva brand name"].map((t) => (
                <li key={t} className="flex gap-3"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal" aria-hidden />{t}</li>
              ))}
            </ul>
          </div>

          {apply.isSuccess ? (
            <div role="status" className="rounded-3xl bg-white p-8">
              <h3 className="text-2xl font-bold">Application received</h3>
              <p className="mt-3 text-slate">Thanks, {form.name.split(" ")[0]}. We'll reply to {form.email} within 2 business days.</p>
            </div>
          ) : (
            <form
              className="grid gap-5 rounded-3xl bg-white p-6 sm:p-8"
              onSubmit={(e) => {
                e.preventDefault();
                apply.mutate({ ...form, audience: form.audience || undefined, message: form.message || undefined, website: form.website || undefined });
              }}
            >
              <div className="grid gap-5 sm:grid-cols-2">
                <label><span className="label">Name</span><input required autoComplete="name" value={form.name} onChange={set("name")} className="field" /></label>
                <label><span className="label">Email</span><input required type="email" autoComplete="email" value={form.email} onChange={set("email")} className="field" /></label>
              </div>
              <label><span className="label">Website or social profile</span><input required value={form.channel} onChange={set("channel")} placeholder="https://instagram.com/yourlab" className="field" /></label>
              <label>
                <span className="label">Audience size</span>
                <select value={form.audience} onChange={set("audience")} className="field">
                  <option value="">Select</option>
                  <option>Under 1,000</option>
                  <option>1,000–10,000</option>
                  <option>10,000–100,000</option>
                  <option>100,000+</option>
                </select>
              </label>
              <label><span className="label">How will you promote Peptiva? <span className="font-normal text-muted">(optional)</span></span><textarea rows={4} value={form.message} onChange={set("message")} className="field" /></label>
              <input tabIndex={-1} autoComplete="off" value={form.website} onChange={set("website")} className="hidden" aria-hidden />
              {apply.error ? <p role="alert" className="text-sm text-alert">{apply.error.message}</p> : null}
              <button type="submit" className="btn btn-primary justify-self-start px-8" disabled={apply.isPending}>{apply.isPending ? "Sending…" : "Send application"}</button>
            </form>
          )}
        </div>
      </section>
    </>
  );
}
