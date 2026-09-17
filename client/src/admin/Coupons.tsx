import { useState } from "react";
import { trpc, type RouterOutputs } from "../lib/trpc";
import { Badge, Button, Card, Empty, Field, Modal, Notice, Table, fmtDate, fmtMoney, inputCls } from "./ui";

type Coupon = RouterOutputs["admin"]["coupons"]["list"][number];
type Form = {
  id?: number; code: string; description: string; type: "percent" | "fixed"; amount: string; active: boolean;
  startsAt: string; expiresAt: string; usageLimit: string; perCustomerLimit: string; minSubtotal: string; affiliateId: string;
};

const empty: Form = { code: "", description: "", type: "percent", amount: "", active: true, startsAt: "", expiresAt: "", usageLimit: "", perCustomerLimit: "", minSubtotal: "", affiliateId: "" };
const toLocal = (d: Date | string | null) => (d ? new Date(new Date(d).getTime() - new Date(d).getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : "");
const numOrNull = (s: string) => (s.trim() === "" ? null : Number(s));

function couponState(c: Coupon) {
  const now = Date.now();
  if (!c.active) return <Badge>Inactive</Badge>;
  if (c.expiresAt && new Date(c.expiresAt).getTime() < now) return <Badge tone="red">Expired</Badge>;
  if (c.startsAt && new Date(c.startsAt).getTime() > now) return <Badge tone="blue">Scheduled</Badge>;
  if (c.usageLimit != null && c.usageCount >= c.usageLimit) return <Badge tone="red">Used up</Badge>;
  return <Badge tone="green">Active</Badge>;
}

export default function Coupons() {
  const utils = trpc.useUtils();
  const q = trpc.admin.coupons.list.useQuery();
  const affiliates = trpc.admin.affiliates.list.useQuery({ status: "active" });
  const [form, setForm] = useState<Form | null>(null);
  const done = () => { setForm(null); return utils.admin.coupons.list.invalidate(); };
  const create = trpc.admin.coupons.create.useMutation({ onSuccess: done });
  const update = trpc.admin.coupons.update.useMutation({ onSuccess: done });
  const remove = trpc.admin.coupons.remove.useMutation({ onSuccess: () => utils.admin.coupons.list.invalidate() });
  const error = create.error ?? update.error;
  const saving = create.isPending || update.isPending;

  const edit = (c: Coupon) =>
    setForm({
      id: c.id, code: c.code, description: c.description ?? "", type: c.type, amount: String(Number(c.amount)), active: c.active,
      startsAt: toLocal(c.startsAt), expiresAt: toLocal(c.expiresAt), usageLimit: c.usageLimit?.toString() ?? "",
      perCustomerLimit: c.perCustomerLimit?.toString() ?? "", minSubtotal: c.minSubtotal ? String(Number(c.minSubtotal)) : "", affiliateId: c.affiliateId?.toString() ?? "",
    });

  const save = () => {
    if (!form) return;
    const payload = {
      code: form.code, description: form.description || null, type: form.type, amount: Number(form.amount || 0), active: form.active,
      startsAt: form.startsAt ? new Date(form.startsAt) : null, expiresAt: form.expiresAt ? new Date(form.expiresAt) : null,
      usageLimit: numOrNull(form.usageLimit), perCustomerLimit: numOrNull(form.perCustomerLimit), minSubtotal: numOrNull(form.minSubtotal),
      affiliateId: numOrNull(form.affiliateId),
    };
    if (form.id) update.mutate({ id: form.id, ...payload });
    else create.mutate(payload);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-slate">Codes apply after the bundle discount. Assign a code to an affiliate and every sale with it is credited to them, even without their link.</p>
        <Button onClick={() => { create.reset(); update.reset(); setForm(empty); }}>+ New coupon</Button>
      </div>
      {remove.data?.deactivated ? <Notice tone="blue">That coupon has orders, so it was deactivated instead of deleted to keep the history.</Notice> : null}

      <Card>
        <Table head={["Code", "Discount", "Status", "Uses", "Rules", "Sales", "Affiliate", ""]} empty={q.data && !q.data.length ? <Empty>No coupons yet.</Empty> : null}>
          {q.data?.map((c) => (
            <tr key={c.id} className="hover:bg-mist/50">
              <td className="px-4 py-3"><p className="font-mono font-semibold">{c.code.toUpperCase()}</p>{c.description ? <p className="text-xs text-muted">{c.description}</p> : null}</td>
              <td className="px-4 py-3 font-semibold">{c.type === "percent" ? `${Number(c.amount)}%` : fmtMoney(c.amount)}</td>
              <td className="px-4 py-3">{couponState(c)}</td>
              <td className="px-4 py-3 tabular-nums">{c.usageCount}{c.usageLimit != null ? ` / ${c.usageLimit}` : ""}</td>
              <td className="px-4 py-3 text-xs text-slate">
                {[c.minSubtotal ? `Min ${fmtMoney(c.minSubtotal)}` : null, c.perCustomerLimit ? `${c.perCustomerLimit}× per customer` : null, c.startsAt ? `From ${fmtDate(c.startsAt)}` : null, c.expiresAt ? `Until ${fmtDate(c.expiresAt)}` : null].filter(Boolean).join(" · ") || "—"}
              </td>
              <td className="px-4 py-3 text-xs"><p className="font-semibold tabular-nums">{fmtMoney(c.revenue)}</p><p className="text-muted">−{fmtMoney(c.discountGiven)} given</p></td>
              <td className="px-4 py-3 text-xs">{c.affiliateName ?? "—"}</td>
              <td className="px-4 py-3 text-right">
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => edit(c)}>Edit</Button>
                  <Button size="sm" variant="danger" onClick={() => { if (confirm(`Delete ${c.code.toUpperCase()}?`)) remove.mutate({ id: c.id }); }}>Delete</Button>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      <Modal
        title={form?.id ? `Edit ${form.code.toUpperCase()}` : "New coupon"}
        open={Boolean(form)}
        onClose={() => setForm(null)}
        footer={<><Button variant="ghost" onClick={() => setForm(null)}>Cancel</Button><Button onClick={save} disabled={saving || !form?.code || !form?.amount}>{saving ? "Saving…" : "Save coupon"}</Button></>}
      >
        {form ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Code" hint="Customers type it at checkout; not case-sensitive">
              <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.replace(/\s/g, "") })} className={`${inputCls} font-mono uppercase`} />
            </Field>
            <Field label="Internal description"><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputCls} placeholder="Summer campaign" /></Field>
            <Field label="Type">
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as Form["type"] })} className={inputCls}>
                <option value="percent">Percentage off</option>
                <option value="fixed">Fixed amount off (USD)</option>
              </select>
            </Field>
            <Field label={form.type === "percent" ? "Percentage" : "Amount (USD)"}>
              <input type="number" min="0" max={form.type === "percent" ? 100 : undefined} step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Starts (optional)"><input type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} className={inputCls} /></Field>
            <Field label="Expires (optional)"><input type="datetime-local" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} className={inputCls} /></Field>
            <Field label="Total uses allowed" hint="Empty = unlimited"><input type="number" min="1" value={form.usageLimit} onChange={(e) => setForm({ ...form, usageLimit: e.target.value })} className={inputCls} /></Field>
            <Field label="Uses per customer" hint="Checked by email; empty = unlimited"><input type="number" min="1" value={form.perCustomerLimit} onChange={(e) => setForm({ ...form, perCustomerLimit: e.target.value })} className={inputCls} /></Field>
            <Field label="Minimum order (USD)" hint="After bundle discounts"><input type="number" min="0" step="0.01" value={form.minSubtotal} onChange={(e) => setForm({ ...form, minSubtotal: e.target.value })} className={inputCls} /></Field>
            <Field label="Credit sales to affiliate">
              <select value={form.affiliateId} onChange={(e) => setForm({ ...form, affiliateId: e.target.value })} className={inputCls}>
                <option value="">— None —</option>
                {affiliates.data?.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.code})</option>)}
              </select>
            </Field>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="h-4 w-4 accent-navy" />
              Active
            </label>
            {error ? <p className="text-sm text-red-700 sm:col-span-2">{error.message}</p> : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
