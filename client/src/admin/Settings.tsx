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

      {save.error ? <Notice tone="red">{save.error.message}</Notice> : null}
      {save.isSuccess ? <Notice tone="green">Settings saved.</Notice> : null}
      <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save settings"}</Button>

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
