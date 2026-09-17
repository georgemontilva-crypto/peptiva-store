import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { trpc } from "../lib/trpc";
import { AFF_STATUS } from "./Affiliates";
import { Badge, Button, Card, Empty, Field, Modal, Notice, Stat, Table, fmtDate, fmtMoney, inputCls } from "./ui";

type Status = "pending" | "active" | "rejected" | "suspended";
const C_TONE = { pending: "amber", approved: "teal", paid: "green", rejected: "gray" } as const;

export default function AffiliateDetail() {
  const id = Number(useParams().id);
  const utils = trpc.useUtils();
  const q = trpc.admin.affiliates.get.useQuery({ id }, { enabled: id > 0 });
  const a = q.data;
  const [form, setForm] = useState({ name: "", email: "", code: "", status: "active" as Status, commissionRate: "", channel: "", payoutMethod: "", payoutDetails: "", adminNote: "" });
  const [selected, setSelected] = useState<number[]>([]);
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [payout, setPayout] = useState({ method: "", reference: "", note: "" });
  const [link, setLink] = useState<string | null>(null);

  useEffect(() => {
    if (!a) return;
    setForm({ name: a.name, email: a.email, code: a.code, status: a.status, commissionRate: a.commissionRate ? String(Number(a.commissionRate)) : "", channel: a.channel ?? "", payoutMethod: a.payoutMethod ?? "", payoutDetails: a.payoutDetails ?? "", adminNote: a.adminNote ?? "" });
    setPayout((p) => ({ ...p, method: a.payoutMethod ?? "" }));
  }, [a?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = () => Promise.all([utils.admin.affiliates.get.invalidate({ id }), utils.admin.affiliates.list.invalidate(), utils.admin.dashboard.overview.invalidate(), utils.admin.commissions.list.invalidate()]);
  const update = trpc.admin.affiliates.update.useMutation({ onSuccess: refresh });
  const approve = trpc.admin.affiliates.approve.useMutation({ onSuccess: (r) => { setLink(r.passwordLink); return refresh(); } });
  const resend = trpc.admin.affiliates.resendInvite.useMutation({ onSuccess: (r) => setLink(r.passwordLink) });
  const setStatus = trpc.admin.affiliates.setCommissionStatus.useMutation({ onSuccess: () => { setSelected([]); return refresh(); } });
  const pay = trpc.admin.affiliates.createPayout.useMutation({ onSuccess: () => { setPayoutOpen(false); return refresh(); } });

  if (q.isPending) return <p className="text-slate">Loading…</p>;
  if (!a) return <Notice tone="red">{q.error?.message ?? "Affiliate not found"}</Notice>;
  const refLink = `${window.location.origin}/?ref=${a.code}`;
  const selectable = a.commissions.filter((c) => c.status === "pending" || c.status === "approved");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/admin/affiliates" className="text-sm font-semibold text-slate hover:text-navy">← Affiliates</Link>
          <h2 className="font-display text-2xl font-bold text-navy">{a.name}</h2>
          <Badge tone={AFF_STATUS[a.status]?.tone}>{AFF_STATUS[a.status]?.label}</Badge>
        </div>
        <div className="flex gap-2">
          {a.status === "pending" ? <Button onClick={() => approve.mutate({ id: a.id })} disabled={approve.isPending}>Approve & send welcome</Button> : null}
          {a.status === "active" ? <Button variant="ghost" onClick={() => resend.mutate({ id: a.id })} disabled={resend.isPending}>{a.hasPassword ? "Send password reset" : "Resend welcome email"}</Button> : null}
        </div>
      </div>

      {approve.data?.emailed || resend.data?.emailed ? <Notice tone="green">Email sent to {a.email}.</Notice> : null}
      {link ? (
        <Notice tone="blue">
          Email isn't configured. Share this one-time link so {a.name.split(" ")[0]} can create a password (valid 7 days):
          <input readOnly value={link} className={`${inputCls} mt-2`} onFocus={(e) => e.currentTarget.select()} />
        </Notice>
      ) : null}

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
        <Stat label="Clicks" value={a.totals.clicks} hint={`${a.totals.conversionRate}% conversion`} />
        <Stat label="Orders" value={a.totals.orders} />
        <Stat label="Pending" value={fmtMoney(a.totals.pending)} hint="Until delivery" />
        <Stat label="Ready to pay" value={fmtMoney(a.totals.approved)} hint={`Minimum ${fmtMoney(a.minPayout)}`} />
        <Stat label="Paid out" value={fmtMoney(a.totals.paidOut)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          <Card
            title="Commissions"
            action={
              <div className="flex gap-2">
                {selected.length ? (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => setStatus.mutate({ ids: selected, status: "approved" })}>Approve {selected.length}</Button>
                    <Button size="sm" variant="danger" onClick={() => setStatus.mutate({ ids: selected, status: "rejected" })}>Reject</Button>
                  </>
                ) : null}
                <Button size="sm" disabled={a.totals.approved <= 0} onClick={() => setPayoutOpen(true)}>Record payout</Button>
              </div>
            }
          >
            <Table head={["", "Order", "Date", "Sale", "Rate", "Commission", "Source", "Status"]} empty={a.commissions.length ? null : <Empty>No referred orders yet.</Empty>}>
              {a.commissions.map((c) => {
                const canSelect = selectable.some((s) => s.id === c.id);
                return (
                  <tr key={c.id} className="hover:bg-mist/50">
                    <td className="px-4 py-3">
                      {canSelect ? <input type="checkbox" className="h-4 w-4 accent-navy" checked={selected.includes(c.id)} onChange={(e) => setSelected((s) => (e.target.checked ? [...s, c.id] : s.filter((x) => x !== c.id)))} aria-label={`Select ${c.orderNumber}`} /> : null}
                    </td>
                    <td className="px-4 py-3"><Link to={`/admin/orders/${c.orderId}`} className="font-semibold text-navy hover:underline">{c.orderNumber}</Link></td>
                    <td className="px-4 py-3 text-slate">{fmtDate(c.createdAt)}</td>
                    <td className="px-4 py-3 tabular-nums">{fmtMoney(c.base)}</td>
                    <td className="px-4 py-3 tabular-nums">{Number(c.rate)}%</td>
                    <td className="px-4 py-3 font-semibold tabular-nums">{fmtMoney(c.amount)}</td>
                    <td className="px-4 py-3 text-xs capitalize">{c.source}</td>
                    <td className="px-4 py-3"><Badge tone={C_TONE[c.status]}>{c.status}</Badge></td>
                  </tr>
                );
              })}
            </Table>
          </Card>

          <Card title="Payouts">
            <Table head={["Date", "Amount", "Method", "Reference", "Note"]} empty={a.payouts.length ? null : <Empty>No payouts recorded.</Empty>}>
              {a.payouts.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3">{fmtDate(p.createdAt)}</td>
                  <td className="px-4 py-3 font-semibold tabular-nums">{fmtMoney(p.amount)}</td>
                  <td className="px-4 py-3">{p.method ?? "—"}</td>
                  <td className="px-4 py-3 text-xs">{p.reference ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-slate">{p.note ?? ""}</td>
                </tr>
              ))}
            </Table>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Referral link">
            <div className="space-y-3 px-5 py-4 text-sm">
              <input readOnly value={refLink} className={inputCls} onFocus={(e) => e.currentTarget.select()} aria-label="Referral link" />
              <p className="text-xs text-muted">Also works on any page with ?ref={a.code}. Password {a.hasPassword ? "created" : "not created yet"}.</p>
              {a.coupons.length ? (
                <p>Coupons: {a.coupons.map((c) => <Badge key={c.id} tone={c.active ? "teal" : "gray"}>{c.code.toUpperCase()} · {c.usageCount} uses</Badge>)}</p>
              ) : (
                <p className="text-xs text-slate">No coupon assigned. <Link to="/admin/coupons" className="font-semibold text-navy hover:underline">Create one</Link> and pick this affiliate.</p>
              )}
            </div>
          </Card>

          <Card title="Profile">
            <form
              className="grid gap-3 px-5 py-4"
              onSubmit={(e) => {
                e.preventDefault();
                update.mutate({ id: a.id, ...form, commissionRate: form.commissionRate ? Number(form.commissionRate) : null });
              }}
            >
              <Field label="Name"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} /></Field>
              <Field label="Email"><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Code"><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className={`${inputCls} font-mono`} /></Field>
                <Field label="Commission %" hint={`Empty = ${a.commissionRate ? "general" : a.effectiveRate + "%"}`}><input type="number" min="0" max="90" step="0.5" value={form.commissionRate} onChange={(e) => setForm({ ...form, commissionRate: e.target.value })} className={inputCls} /></Field>
              </div>
              <Field label="Status">
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Status })} className={inputCls}>
                  <option value="pending">Application</option><option value="active">Active</option><option value="suspended">Suspended</option><option value="rejected">Rejected</option>
                </select>
              </Field>
              <Field label="Website / social"><input value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })} className={inputCls} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Payout method"><input value={form.payoutMethod} onChange={(e) => setForm({ ...form, payoutMethod: e.target.value })} className={inputCls} /></Field>
                <Field label="Payout account"><input value={form.payoutDetails} onChange={(e) => setForm({ ...form, payoutDetails: e.target.value })} className={inputCls} /></Field>
              </div>
              <Field label="Internal notes"><textarea rows={3} value={form.adminNote} onChange={(e) => setForm({ ...form, adminNote: e.target.value })} className={inputCls} /></Field>
              {a.applicationNote ? <p className="rounded-lg bg-mist px-3 py-2 text-xs text-slate"><strong>Application:</strong> {a.applicationNote}</p> : null}
              {update.error ? <p className="text-sm text-red-700">{update.error.message}</p> : null}
              {update.isSuccess ? <p className="text-sm text-emerald-700">Saved.</p> : null}
              <Button type="submit" disabled={update.isPending}>Save profile</Button>
            </form>
          </Card>
        </div>
      </div>

      <Modal
        title={`Record payout to ${a.name}`}
        open={payoutOpen}
        onClose={() => setPayoutOpen(false)}
        footer={<><Button variant="ghost" onClick={() => setPayoutOpen(false)}>Cancel</Button><Button disabled={pay.isPending} onClick={() => pay.mutate({ affiliateId: a.id, ...payout })}>Mark {fmtMoney(a.totals.approved)} as paid</Button></>}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate">This marks every approved commission ({fmtMoney(a.totals.approved)}) as paid. Send the money first through {a.payoutMethod ?? "your payout method"}{a.payoutDetails ? ` to ${a.payoutDetails}` : ""}.</p>
          {a.totals.approved < a.minPayout ? <Notice tone="amber">The balance is below the {fmtMoney(a.minPayout)} minimum payout.</Notice> : null}
          <Field label="Method"><input value={payout.method} onChange={(e) => setPayout({ ...payout, method: e.target.value })} className={inputCls} /></Field>
          <Field label="Reference / transaction ID"><input value={payout.reference} onChange={(e) => setPayout({ ...payout, reference: e.target.value })} className={inputCls} /></Field>
          <Field label="Note"><input value={payout.note} onChange={(e) => setPayout({ ...payout, note: e.target.value })} className={inputCls} /></Field>
          {pay.error ? <p className="text-sm text-red-700">{pay.error.message}</p> : null}
        </div>
      </Modal>
    </div>
  );
}
