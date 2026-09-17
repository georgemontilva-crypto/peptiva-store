import { Link } from "react-router-dom";
import { trpc } from "../lib/trpc";
import { Card, Empty, Notice, OrderStatusBadge, Stat, Table, fmtDate, fmtMoney } from "./ui";

export default function Dashboard() {
  const q = trpc.admin.dashboard.overview.useQuery(undefined, { refetchInterval: 60_000 });
  const d = q.data;
  if (q.isPending) return <p className="text-slate">Loading…</p>;
  if (!d) return <Notice tone="red">Could not load the dashboard: {q.error?.message}</Notice>;
  const max = Math.max(1, ...d.days.map((x) => x.total));

  return (
    <div className="space-y-6">
      {!d.health.payments || !d.health.email || !d.health.sessionSecret ? (
        <Notice tone="amber">
          <strong>Setup pending:</strong>{" "}
          {[!d.health.payments && "Bankful keys (card payments are off)", !d.health.email && "Resend email (no confirmations, tracking or cart reminders are sent)", !d.health.sessionSecret && "SESSION_SECRET (admin sessions close on every deploy)"]
            .filter(Boolean)
            .join(" · ")}
        </Notice>
      ) : null}

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat label="Sales today" value={fmtMoney(d.revenue.today.total)} hint={`${d.revenue.today.orders} orders`} />
        <Stat label="Last 7 days" value={fmtMoney(d.revenue.week.total)} hint={`${d.revenue.week.orders} orders`} />
        <Stat label="Last 30 days" value={fmtMoney(d.revenue.month.total)} hint={`${d.revenue.month.orders} orders · avg ${fmtMoney(d.revenue.month.orders ? d.revenue.month.total / d.revenue.month.orders : 0)}`} />
        <Stat label="To ship" value={d.toShip} hint={d.onHold ? `${d.onHold} on hold need review` : "Paid orders without tracking"} to="/admin/orders?status=paid" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <Card title="Sales, last 14 days">
          <div className="flex h-56 items-end gap-2 px-5 pb-4 pt-6">
            {d.days.map((x) => (
              <div key={x.day} className="group flex flex-1 flex-col items-center gap-2">
                <div className="relative flex h-44 w-full items-end">
                  <div className="w-full rounded-t-md bg-teal/80 transition-colors group-hover:bg-navy" style={{ height: `${Math.max(2, (x.total / max) * 100)}%` }} title={`${x.day}: ${fmtMoney(x.total)} · ${x.orders} orders`} />
                </div>
                <span className="text-[0.65rem] text-muted">{new Date(`${x.day}T12:00:00`).toLocaleDateString("en-US", { day: "numeric" })}</span>
              </div>
            ))}
          </div>
        </Card>

        <div className="grid gap-4">
          <Stat label="Abandoned carts (30 days)" value={fmtMoney(d.abandoned.value)} hint={`${d.abandoned.open} open · ${d.abandoned.recovered} recovered`} to="/admin/abandoned" />
          <Stat label="Affiliate applications" value={d.affiliates.pending} hint="Waiting for review" to="/admin/affiliates?status=pending" />
          <Stat label="Commissions to pay" value={fmtMoney(d.affiliates.commissionsApproved)} hint={`${fmtMoney(d.affiliates.commissionsPending)} pending delivery`} to="/admin/commissions?status=approved" />
        </div>
      </div>

      <Card title="Latest orders" action={<Link to="/admin/orders" className="text-sm font-semibold text-navy hover:underline">All orders</Link>}>
        <Table head={["Order", "Customer", "Status", "Total", "Date"]} empty={d.recent.length ? null : <Empty>No orders yet.</Empty>}>
          {d.recent.map((o) => (
            <tr key={o.id} className="hover:bg-mist/50">
              <td className="px-4 py-3"><Link to={`/admin/orders/${o.id}`} className="font-semibold text-navy hover:underline">{o.number}</Link></td>
              <td className="px-4 py-3"><p className="font-medium">{o.firstName} {o.lastName}</p><p className="text-xs text-muted">{o.email}</p></td>
              <td className="px-4 py-3"><OrderStatusBadge status={o.status} /></td>
              <td className="px-4 py-3 tabular-nums">{fmtMoney(o.total)}</td>
              <td className="px-4 py-3 text-slate">{fmtDate(o.createdAt, true)}</td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}
