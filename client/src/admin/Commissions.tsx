import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { trpc } from "../lib/trpc";
import { Badge, Button, Card, Empty, OrderStatusBadge, Pagination, Stat, Table, Tabs, fmtDate, fmtMoney } from "./ui";

type Status = "" | "pending" | "approved" | "paid" | "rejected";
type View = "commissions" | "owed" | "payouts";
const TONE = { pending: "amber", approved: "teal", paid: "green", rejected: "gray" } as const;

export default function Commissions() {
  const [params, setParams] = useSearchParams();
  const status = (params.get("status") ?? "") as Status;
  const view: View = params.get("view") === "payouts" ? "payouts" : params.get("view") === "owed" ? "owed" : "commissions";
  const summary = trpc.admin.commissions.summary.useQuery();
  const owed = trpc.admin.commissions.owed.useQuery(undefined, { enabled: view === "owed" });
  const payouts = trpc.admin.commissions.payouts.useQuery(undefined, { enabled: view === "payouts" });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<number[]>([]);
  const utils = trpc.useUtils();
  const q = trpc.admin.commissions.list.useQuery({ status: status || undefined, page, pageSize: 50 }, { placeholderData: (p) => p });
  const setStatus = trpc.admin.affiliates.setCommissionStatus.useMutation({
    onSuccess: () => {
      setSelected([]);
      return Promise.all([utils.admin.commissions.invalidate(), utils.admin.dashboard.overview.invalidate()]);
    },
  });

  return (
    <div className="space-y-4">
      {summary.data ? (
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <Stat label="Ready to pay" value={fmtMoney(summary.data.approved)} hint={`${summary.data.approvedCount} approved commission${summary.data.approvedCount === 1 ? "" : "s"} · minimum payout ${fmtMoney(summary.data.minPayout)}`} to="/admin/commissions?view=owed" />
          <Stat label="Pending delivery" value={fmtMoney(summary.data.pending)} hint="Approved when the order is delivered" to="/admin/commissions?status=pending" />
          <Stat label="Paid out so far" value={fmtMoney(summary.data.paid)} hint={`${summary.data.payouts} payout${summary.data.payouts === 1 ? "" : "s"} recorded`} to="/admin/commissions?view=payouts" />
          <Stat label="Referred sales, 30 days" value={fmtMoney(summary.data.sales30)} hint={`${summary.data.orders30} orders · ${summary.data.clicks30} clicks · ${summary.data.activeAffiliates} active affiliates`} to="/admin/affiliates?status=active" />
        </div>
      ) : null}

      <Tabs<View>
        value={view}
        onChange={(v) => { setParams(v === "commissions" ? {} : { view: v }); setPage(1); setSelected([]); }}
        options={[{ value: "commissions", label: "Commissions" }, { value: "owed", label: "To pay" }, { value: "payouts", label: "Payout history", count: summary.data?.payouts }]}
      />

      {view === "owed" ? (
        <>
          <p className="max-w-3xl text-sm text-slate">What each affiliate is owed right now. Open the affiliate to record the payment: that marks their approved commissions as paid and keeps the reference.</p>
          <Card>
            <Table head={["Affiliate", "Commissions", "Amount owed", "Pay to", ""]} empty={owed.data && !owed.data.length ? <Empty>Nothing to pay. Approved commissions show up here.</Empty> : null}>
              {owed.data?.map((o) => (
                <tr key={o.affiliateId} className="hover:bg-mist/50">
                  <td className="px-4 py-3"><Link to={`/admin/affiliates/${o.affiliateId}`} className="font-semibold text-navy hover:underline">{o.name}</Link></td>
                  <td className="px-4 py-3 tabular-nums">{o.n}</td>
                  <td className="px-4 py-3 font-semibold tabular-nums">{fmtMoney(o.amount)} {summary.data && o.amount < summary.data.minPayout ? <Badge>Below minimum</Badge> : <Badge tone="teal">Ready</Badge>}</td>
                  <td className="px-4 py-3 text-slate">{o.payoutMethod ? `${o.payoutMethod}${o.payoutDetails ? ` · ${o.payoutDetails}` : ""}` : <span className="text-muted">No payout details yet</span>}</td>
                  <td className="px-4 py-3 text-right"><Link to={`/admin/affiliates/${o.affiliateId}`} className="inline-flex h-8 items-center rounded-lg bg-navy px-3 text-xs font-semibold text-white hover:bg-navy-deep">Record payout</Link></td>
                </tr>
              ))}
            </Table>
          </Card>
        </>
      ) : null}

      {view === "payouts" ? (
        <Card>
          <Table head={["Date", "Affiliate", "Amount", "Method", "Reference", "Note"]} empty={payouts.data && !payouts.data.length ? <Empty>No payouts recorded yet.</Empty> : null}>
            {payouts.data?.map((p) => (
              <tr key={p.id} className="hover:bg-mist/50">
                <td className="whitespace-nowrap px-4 py-3 text-slate">{fmtDate(p.createdAt, true)}</td>
                <td className="px-4 py-3"><Link to={`/admin/affiliates/${p.affiliateId}`} className="font-semibold text-navy hover:underline">{p.affiliateName}</Link></td>
                <td className="px-4 py-3 font-semibold tabular-nums">{fmtMoney(p.amount)}</td>
                <td className="px-4 py-3">{p.method ?? "—"}</td>
                <td className="px-4 py-3 font-mono text-xs">{p.reference ?? "—"}</td>
                <td className="px-4 py-3 text-slate">{p.note ?? "—"}</td>
              </tr>
            ))}
          </Table>
        </Card>
      ) : null}

      {view === "commissions" ? (
      <>
      <p className="max-w-3xl text-sm text-slate">
        Commissions are created when a referred order is paid, approved automatically when the order is marked Delivered (configurable in Settings) and rejected if it's cancelled or refunded. Pay them from each affiliate's page.
      </p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={status} onChange={(v) => { setParams(v ? { status: v } : {}); setPage(1); setSelected([]); }} options={[{ value: "", label: "All" }, { value: "pending", label: "Pending" }, { value: "approved", label: "Approved" }, { value: "paid", label: "Paid" }, { value: "rejected", label: "Rejected" }]} />
        {selected.length ? (
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setStatus.mutate({ ids: selected, status: "approved" })}>Approve {selected.length}</Button>
            <Button variant="danger" onClick={() => setStatus.mutate({ ids: selected, status: "rejected" })}>Reject {selected.length}</Button>
          </div>
        ) : null}
      </div>
      <Card>
        <Table head={["", "Affiliate", "Order", "Order status", "Sale", "Commission", "Source", "Status", "Date"]} empty={q.data && !q.data.commissions.length ? <Empty>No commissions here.</Empty> : null}>
          {q.data?.commissions.map((c) => (
            <tr key={c.id} className="hover:bg-mist/50">
              <td className="px-4 py-3">
                {c.status === "pending" || c.status === "approved" ? (
                  <input type="checkbox" className="h-4 w-4 accent-navy" checked={selected.includes(c.id)} onChange={(e) => setSelected((s) => (e.target.checked ? [...s, c.id] : s.filter((x) => x !== c.id)))} aria-label={`Select ${c.orderNumber}`} />
                ) : null}
              </td>
              <td className="px-4 py-3"><Link to={`/admin/affiliates/${c.affiliateId}`} className="font-semibold text-navy hover:underline">{c.affiliateName}</Link></td>
              <td className="px-4 py-3"><Link to={`/admin/orders/${c.orderId}`} className="text-navy hover:underline">{c.orderNumber}</Link></td>
              <td className="px-4 py-3"><OrderStatusBadge status={c.orderStatus} /></td>
              <td className="px-4 py-3 tabular-nums">{fmtMoney(c.base)}</td>
              <td className="px-4 py-3 font-semibold tabular-nums">{fmtMoney(c.amount)} <span className="text-xs font-normal text-muted">{Number(c.rate)}%</span></td>
              <td className="px-4 py-3 text-xs capitalize">{c.source}</td>
              <td className="px-4 py-3"><Badge tone={TONE[c.status]}>{c.status}</Badge></td>
              <td className="px-4 py-3 text-slate">{fmtDate(c.createdAt)}</td>
            </tr>
          ))}
        </Table>
        {q.data ? <Pagination page={page} total={q.data.total} pageSize={50} onPage={setPage} /> : null}
      </Card>
      </>
      ) : null}
    </div>
  );
}
