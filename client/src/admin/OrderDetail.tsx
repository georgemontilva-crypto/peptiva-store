import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { trpc } from "../lib/trpc";
import { Badge, Button, Card, Field, Notice, ORDER_STATUS, OrderStatusBadge, fmtDate, fmtMoney, inputCls } from "./ui";

const CARRIERS = [
  { value: "usps", label: "USPS" },
  { value: "ups", label: "UPS" },
  { value: "fedex", label: "FedEx" },
  { value: "dhl", label: "DHL" },
  { value: "other", label: "Other" },
] as const;

type Carrier = (typeof CARRIERS)[number]["value"];
type Status = "pending" | "paid" | "on_hold" | "failed" | "cancelled" | "shipped" | "completed" | "refunded";

export default function OrderDetail() {
  const id = Number(useParams().id);
  const utils = trpc.useUtils();
  const q = trpc.admin.orders.get.useQuery({ id }, { enabled: id > 0 });
  const o = q.data;
  const [form, setForm] = useState({ status: "paid" as Status, carrier: "" as Carrier | "", trackingNumber: "", trackingUrl: "", note: "", notifyCustomer: true });
  const [privateNote, setPrivateNote] = useState("");

  useEffect(() => {
    if (!o) return;
    setForm((f) => ({ ...f, status: o.status as Status, carrier: (o.carrier as Carrier) ?? "", trackingNumber: o.trackingNumber ?? "", trackingUrl: o.trackingUrl ?? "", note: "" }));
  }, [o?.id, o?.status, o?.trackingNumber]); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = () => Promise.all([utils.admin.orders.get.invalidate({ id }), utils.admin.orders.list.invalidate(), utils.admin.dashboard.overview.invalidate()]);
  const update = trpc.admin.orders.update.useMutation({ onSuccess: refresh });
  const addNote = trpc.admin.orders.addNote.useMutation({ onSuccess: () => { setPrivateNote(""); return refresh(); } });

  if (q.isPending) return <p className="text-slate">Loading…</p>;
  if (!o) return <Notice tone="red">{q.error?.message ?? "Order not found"}</Notice>;

  const shipNow = () => setForm((f) => ({ ...f, status: "shipped" }));
  const willEmail = form.notifyCustomer && (form.status !== o.status || form.trackingNumber !== (o.trackingNumber ?? ""));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/admin/orders" className="text-sm font-semibold text-slate hover:text-navy">← Orders</Link>
          <h2 className="font-display text-2xl font-bold text-navy">{o.number}</h2>
          <OrderStatusBadge status={o.status} />
        </div>
        <p className="text-sm text-slate">Placed {fmtDate(o.createdAt, true)}{o.paidAt ? ` · Paid ${fmtDate(o.paidAt, true)}` : ""}</p>
      </div>

      {o.status === "on_hold" ? <Notice tone="red"><strong>Needs review.</strong> The payment couldn't be confirmed automatically (see payment log below). Check the transaction in the Bankful panel before shipping, then mark it as Paid.</Notice> : null}

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          <Card title="Items">
            <ul className="divide-y divide-line">
              {o.items.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                  <div>
                    <p className="font-semibold">{i.name}{i.variantLabel ? <span className="font-normal text-slate"> · {i.variantLabel}</span> : null}</p>
                    <p className="text-xs text-muted">{fmtMoney(i.unitPrice)} × {i.quantity}{i.bundlePercent ? ` · ${i.bundlePercent}% bundle` : ""}</p>
                  </div>
                  <p className="font-semibold tabular-nums">{fmtMoney(i.lineTotal)}</p>
                </li>
              ))}
            </ul>
            <dl className="space-y-1.5 border-t border-line bg-mist/50 px-5 py-4 text-sm">
              <Row k="Subtotal" v={fmtMoney(o.subtotal)} />
              {Number(o.bundleDiscount) > 0 ? <Row k="Bundle savings" v={`−${fmtMoney(o.bundleDiscount)}`} /> : null}
              {o.couponCode ? <Row k={`Coupon ${o.couponCode.toUpperCase()}`} v={`−${fmtMoney(o.couponDiscount)}`} /> : null}
              <Row k="Shipping" v={Number(o.shippingTotal) ? fmtMoney(o.shippingTotal) : "Free"} />
              <div className="flex justify-between border-t border-line pt-2 font-semibold"><dt>Total</dt><dd className="tabular-nums">{fmtMoney(o.total)}</dd></div>
            </dl>
          </Card>

          <Card title="Update status & tracking">
            <form
              className="grid gap-4 p-5 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                update.mutate({
                  id: o.id,
                  status: form.status,
                  carrier: form.carrier || null,
                  trackingNumber: form.trackingNumber || null,
                  trackingUrl: form.trackingUrl || null,
                  note: form.note || null,
                  notifyCustomer: form.notifyCustomer,
                });
              }}
            >
              <Field label="Status">
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Status })} className={inputCls}>
                  {Object.entries(ORDER_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </Field>
              <Field label="Carrier">
                <select value={form.carrier} onChange={(e) => setForm({ ...form, carrier: e.target.value as Carrier | "" })} className={inputCls}>
                  <option value="">—</option>
                  {CARRIERS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </Field>
              <Field label="Tracking number">
                <input value={form.trackingNumber} onChange={(e) => setForm({ ...form, trackingNumber: e.target.value })} className={inputCls} placeholder="9400 1000 0000 0000 0000" />
              </Field>
              <Field label="Custom tracking URL" hint={form.carrier === "other" ? "Needed for 'Other' carriers" : "Optional; USPS/UPS/FedEx/DHL links are automatic"}>
                <input value={form.trackingUrl} onChange={(e) => setForm({ ...form, trackingUrl: e.target.value })} className={inputCls} placeholder="https://" />
              </Field>
              <Field label="Message to the customer (optional)" className="sm:col-span-2">
                <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className={inputCls} placeholder="Shown in the tracking page and the email" />
              </Field>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input type="checkbox" checked={form.notifyCustomer} onChange={(e) => setForm({ ...form, notifyCustomer: e.target.checked })} className="h-4 w-4 accent-navy" />
                Email the customer about this update
              </label>
              {update.error ? <p className="text-sm text-red-700 sm:col-span-2">{update.error.message}</p> : null}
              {update.isSuccess ? <p className="text-sm text-emerald-700 sm:col-span-2">Saved{willEmail ? "" : "."}</p> : null}
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <Button type="submit" disabled={update.isPending}>{update.isPending ? "Saving…" : "Save update"}</Button>
                {o.status === "paid" && form.status === "paid" ? <Button variant="ghost" onClick={shipNow}>Mark as shipped</Button> : null}
              </div>
            </form>
          </Card>

          <Card title="Timeline">
            <ol className="space-y-4 px-5 py-5">
              {[...o.events].reverse().map((e) => (
                <li key={e.id} className="flex gap-3 text-sm">
                  <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${e.public ? "bg-teal" : "bg-slate-400"}`} aria-hidden />
                  <div>
                    <p className="font-semibold">{ORDER_STATUS[e.status]?.label ?? e.status} {!e.public ? <Badge>Internal</Badge> : null}</p>
                    {e.note ? <p className="text-slate">{e.note}</p> : null}
                    <p className="text-xs text-muted">{fmtDate(e.createdAt, true)} · {e.createdBy.startsWith("admin") ? "Admin" : "System"}</p>
                  </div>
                </li>
              ))}
              {!o.events.length ? <li className="text-sm text-slate">No events yet.</li> : null}
            </ol>
            <form
              className="flex gap-2 border-t border-line px-5 py-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (privateNote.trim()) addNote.mutate({ id: o.id, note: privateNote.trim() });
              }}
            >
              <input value={privateNote} onChange={(e) => setPrivateNote(e.target.value)} className={inputCls} placeholder="Internal note (not visible to the customer)" aria-label="Internal note" />
              <Button type="submit" variant="ghost" disabled={addNote.isPending}>Add</Button>
            </form>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Customer">
            <div className="space-y-3 px-5 py-4 text-sm">
              <p className="font-semibold">{o.firstName} {o.lastName}</p>
              <p><a href={`mailto:${o.email}`} className="text-navy hover:underline">{o.email}</a><br />{o.phone}</p>
              <p className="text-slate">{o.address1}{o.address2 ? <><br />{o.address2}</> : null}<br />{o.city}, {o.state} {o.zip}</p>
              {o.customerNote ? <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-900"><strong>Note:</strong> {o.customerNote}</p> : null}
              <p className="text-xs text-muted">Research-use acknowledgment: {o.researchAcknowledged ? "yes" : "no"}</p>
            </div>
          </Card>

          <Card title="Shipment">
            <div className="space-y-2 px-5 py-4 text-sm">
              {o.trackingNumber ? (
                <>
                  <p>{o.carrier?.toUpperCase()} · <span className="font-semibold">{o.trackingNumber}</span></p>
                  {o.trackingLink ? <a href={o.trackingLink} target="_blank" rel="noreferrer" className="font-semibold text-navy hover:underline">Open carrier tracking ↗</a> : null}
                  <p className="text-xs text-muted">Shipped {fmtDate(o.shippedAt, true)}</p>
                </>
              ) : (
                <p className="text-slate">No tracking number yet.</p>
              )}
              <a href={`/track-order?order=${o.number}&email=${encodeURIComponent(o.email)}`} target="_blank" rel="noreferrer" className="block text-xs font-semibold text-navy hover:underline">Customer tracking page ↗</a>
            </div>
          </Card>

          {o.affiliate ? (
            <Card title="Affiliate">
              <div className="space-y-1 px-5 py-4 text-sm">
                <Link to={`/admin/affiliates/${o.affiliate.id}`} className="font-semibold text-navy hover:underline">{o.affiliate.name}</Link>
                <p className="text-slate">Code {o.affiliate.code}</p>
                {o.commission ? <p>Commission {fmtMoney(o.commission.amount)} ({Number(o.commission.rate)}%) · <Badge tone={o.commission.status === "paid" ? "green" : o.commission.status === "approved" ? "teal" : o.commission.status === "rejected" ? "gray" : "amber"}>{o.commission.status}</Badge></p> : <p className="text-xs text-muted">Commission is created when the order is paid.</p>}
              </div>
            </Card>
          ) : null}

          <Card title="Payment log">
            <ul className="divide-y divide-line text-xs">
              {o.payments.map((p) => (
                <li key={p.id} className="px-5 py-2.5">
                  <p className="font-semibold">{p.outcome.replace(/_/g, " ")} {p.signatureValid ? <Badge tone="green">signed</Badge> : <Badge tone="red">unsigned</Badge>}</p>
                  <p className="text-muted">{p.kind ?? "callback"} · {p.transStatus ?? "—"} · {fmtDate(p.createdAt, true)}</p>
                </li>
              ))}
              {!o.payments.length ? <li className="px-5 py-3 text-slate">No payment callbacks received.</li> : null}
              {o.paymentTransactionId ? <li className="px-5 py-2.5 text-slate">Bankful transaction: {o.paymentTransactionId}</li> : null}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between text-slate"><dt>{k}</dt><dd className="tabular-nums">{v}</dd></div>;
}
