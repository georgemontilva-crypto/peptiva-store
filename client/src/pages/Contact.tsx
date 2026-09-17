import { useState } from "react";
import { trpc } from "../lib/trpc";
import { usePageMeta } from "../lib/format";
import { SUPPORT_EMAIL } from "../lib/site";

export default function Contact() {
  usePageMeta("Contact — Peptiva Supplies", "Contact Peptiva Supplies about products, certificates of analysis, orders or bulk inquiries.");
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "", website: "" });
  const send = trpc.content.sendContact.useMutation();
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="mx-auto max-w-6xl px-5 py-16">
      <div className="grid gap-14 md:grid-cols-[1fr_1.3fr]">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Get in touch</h1>
          <p className="mt-4 text-lg leading-relaxed text-slate">Questions about a compound, a certificate of analysis or an order? We reply within 24 hours on business days.</p>
          <h2 className="mt-10 text-lg font-medium">We can help with</h2>
          <ul className="mt-3 space-y-2 text-slate">
            {["Product inquiries and specifications", "Certificate of analysis requests", "Order status and shipping", "Technical support", "Bulk orders"].map((t) => (
              <li key={t} className="flex gap-3"><span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal" aria-hidden />{t}</li>
            ))}
          </ul>
          <p className="mt-10 text-sm text-slate">Prefer email?</p>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="font-display text-lg font-medium text-navy underline underline-offset-4">{SUPPORT_EMAIL}</a>
        </div>

        <div className="rounded-3xl bg-mist p-7 sm:p-10">
          {send.isSuccess ? (
            <div role="status">
              <h2 className="text-2xl font-bold">Message sent</h2>
              <p className="mt-3 text-slate">Thanks, {form.name.split(" ")[0]}. We'll reply to {form.email} within one business day.</p>
            </div>
          ) : (
            <form
              className="grid gap-5"
              onSubmit={(e) => {
                e.preventDefault();
                send.mutate({ ...form, subject: form.subject || undefined, website: form.website || undefined });
              }}
            >
              <div className="grid gap-5 sm:grid-cols-2">
                <label><span className="label">Name</span><input required autoComplete="name" value={form.name} onChange={set("name")} className="field" /></label>
                <label><span className="label">Email</span><input required type="email" autoComplete="email" value={form.email} onChange={set("email")} className="field" /></label>
              </div>
              <label>
                <span className="label">Topic</span>
                <select value={form.subject} onChange={set("subject")} className="field">
                  <option value="">General question</option>
                  <option>Product specifications</option>
                  <option>Certificate of analysis</option>
                  <option>Order status</option>
                  <option>Bulk order</option>
                </select>
              </label>
              <label><span className="label">Message</span><textarea required minLength={10} rows={6} value={form.message} onChange={set("message")} className="field" /></label>
              <input tabIndex={-1} autoComplete="off" value={form.website} onChange={set("website")} className="hidden" aria-hidden />
              {send.error ? <p role="alert" className="text-sm text-alert">{send.error.message}</p> : null}
              <button type="submit" className="btn btn-primary justify-self-start px-8" disabled={send.isPending}>{send.isPending ? "Sending…" : "Send message"}</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
