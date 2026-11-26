import { useEffect, useState } from "react";
import { trpc, type RouterOutputs } from "../lib/trpc";
import { Button, Card, Field, Notice, inputCls } from "./ui";

type Values = RouterOutputs["admin"]["settings"]["get"]["values"];

export default function Settings() {
  const utils = trpc.useUtils();
  const q = trpc.admin.settings.get.useQuery();
  const [v, setV] = useState<Values | null>(null);
  const save = trpc.admin.settings.update.useMutation({ onSuccess: () => utils.admin.settings.get.invalidate() });
  const [pw, setPw] = useState({ current: "", next: "" });
  const changePw = trpc.admin.auth.changePassword.useMutation({ onSuccess: () => setPw({ current: "", next: "" }) });

  useEffect(() => {
    if (q.data) setV(q.data.values);
  }, [q.data]);
  if (!v) return <p className="text-slate">Loading…</p>;

  const num = (k: keyof Values) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value === "" ? 0 : Number(e.target.value) });

  return (
    <form
      className="max-w-4xl space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate(v);
      }}
    >
      <Card title="Affiliate program">
        <div className="grid gap-4 p-5 sm:grid-cols-3">
          <Field label="Commission (%)" hint="Used unless the affiliate has their own rate"><input type="number" min="0" max="90" step="0.5" value={v.commissionRate} onChange={num("commissionRate")} className={inputCls} /></Field>
          <Field label="Cookie window (days)" hint="How long a click is credited"><input type="number" min="1" max="365" value={v.cookieDays} onChange={num("cookieDays")} className={inputCls} /></Field>
          <Field label="Minimum payout (USD)"><input type="number" min="0" step="1" value={v.minPayout} onChange={num("minPayout")} className={inputCls} /></Field>
          <label className="flex items-center gap-2 text-sm sm:col-span-3">
            <input type="checkbox" checked={v.autoApproveOnComplete} onChange={(e) => setV({ ...v, autoApproveOnComplete: e.target.checked })} className="h-4 w-4 accent-navy" />
            Approve commissions automatically when an order is marked Delivered
          </label>
        </div>
      </Card>

      <Card title="Abandoned cart reminders">
        <div className="grid gap-4 p-5 sm:grid-cols-3">
          <label className="flex items-center gap-2 text-sm sm:col-span-3">
            <input type="checkbox" checked={v.abandonedEnabled} onChange={(e) => setV({ ...v, abandonedEnabled: e.target.checked })} className="h-4 w-4 accent-navy" />
            Send reminder emails
          </label>
          <Field label="First email after (minutes)" hint="Minimum 15"><input type="number" min="15" value={v.abandonedFirstDelayMinutes} onChange={num("abandonedFirstDelayMinutes")} className={inputCls} /></Field>
          <Field label="Second email after (hours)" hint="Counted from the first email"><input type="number" min="1" value={v.abandonedSecondDelayHours} onChange={num("abandonedSecondDelayHours")} className={inputCls} /></Field>
          <Field label="Coupon in 2nd email" hint="Must exist in Coupons; empty = none"><input value={v.abandonedCouponCode} onChange={(e) => setV({ ...v, abandonedCouponCode: e.target.value.trim() })} className={`${inputCls} font-mono uppercase`} /></Field>
        </div>
      </Card>

      <Card title="Shipping">
        <div className="grid gap-4 p-5 sm:grid-cols-3">
          <Field label="Same-day cutoff (Eastern Time, 0–23)" hint="14 = 2:00 PM. Drives the countdown on product pages."><input type="number" min="0" max="23" value={v.shippingCutoffHour} onChange={num("shippingCutoffHour")} className={inputCls} /></Field>
        </div>
      </Card>

      {save.error ? <Notice tone="red">{save.error.message}</Notice> : null}
      {save.isSuccess ? <Notice tone="green">Settings saved.</Notice> : null}
      <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save settings"}</Button>

      <PaymentsCard />

      <Card title="Your admin password">
        <div className="grid gap-4 p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <Field label="Current password"><input type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} className={inputCls} /></Field>
          <Field label="New password" hint="At least 10 characters"><input type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} className={inputCls} /></Field>
          <Button variant="ghost" disabled={changePw.isPending || pw.next.length < 10 || !pw.current} onClick={() => changePw.mutate(pw)}>Change</Button>
          {changePw.error ? <p className="text-sm text-red-700 sm:col-span-3">{changePw.error.message}</p> : null}
          {changePw.isSuccess ? <p className="text-sm text-emerald-700 sm:col-span-3">Password updated.</p> : null}
        </div>
      </Card>
    </form>
  );
}

/**
 * Estado de la pasarela de pago. Las credenciales no se editan aquí: viven en las variables del
 * hosting. Esta tarjeta dice en qué modo está y permite comprobar con un clic que Bankful las acepta.
 */
function PaymentsCard() {
  const status = trpc.admin.payments.status.useQuery();
  const test = trpc.admin.payments.test.useMutation();
  const mode = status.data?.mode;
  const r = test.data;
  const label = { off: "Not configured", sandbox: "Test mode (sandbox)", live: "Live" } as const;
  const tone = { off: "bg-red-50 text-red-800 border-red-200", sandbox: "bg-amber-50 text-amber-900 border-amber-200", live: "bg-emerald-50 text-emerald-800 border-emerald-200" } as const;

  return (
    <Card title="Card payments (Bankful)">
      <div className="space-y-4 p-5 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {mode ? <span className={`rounded-full border px-3 py-1 text-xs font-bold ${tone[mode]}`}>{label[mode]}</span> : null}
            <span className="text-slate">
              {mode === "off" ? "Checkout is closed until the Bankful credentials are added." : mode === "sandbox" ? "No real money moves. Orders paid here are tests." : mode === "live" ? "Real cards are charged." : ""}
            </span>
          </div>
          <Button type="button" variant="ghost" disabled={test.isPending || mode === "off"} onClick={() => test.mutate()}>{test.isPending ? "Testing…" : "Test connection"}</Button>
        </div>

        {r ? (
          <Notice tone={r.ok ? "green" : "red"}>
            <p><strong>{r.ok ? "Connection works." : `Bankful did not accept the request${r.status ? ` (HTTP ${r.status})` : ""}.`}</strong> {r.message}</p>
            {r.hint ? <p className="mt-1">{r.hint}</p> : null}
            {r.url ? <p className="mt-2"><a href={r.url} target="_blank" rel="noreferrer" className="font-semibold underline">Open the test payment page</a> to see what customers will see. It belongs to no order.</p> : null}
          </Notice>
        ) : null}
        {test.error ? <Notice tone="red">{test.error.message}</Notice> : null}

        <p className="text-xs text-slate">
          The credentials are set in the hosting variables, never here: <code>BANKFUL_API_USERNAME</code>, <code>BANKFUL_API_PASSWORD</code> and, only while testing, <code>BANKFUL_SANDBOX=true</code>.
          {status.data?.lastCallback ? ` Last notification from Bankful: ${new Date(status.data.lastCallback.at).toLocaleString()} (${status.data.lastCallback.outcome}).` : " No notification from Bankful has been received yet."}
        </p>
      </div>
    </Card>
  );
}
