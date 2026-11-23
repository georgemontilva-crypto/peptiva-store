import { Link } from "react-router-dom";
import { trpc } from "../lib/trpc";
import { Card, Empty, Notice, OrderStatusBadge, Stat, Table, fmtDate, fmtMoney } from "./ui";

export default function Dashboard() {
  const q = trpc.admin.dashboard.overview.useQuery(undefined, { refetchInterval: 60_000 });
  const store = trpc.admin.insights.store.useQuery(undefined, { staleTime: 60_000 });
  const legacy = trpc.admin.media.legacyStatus.useQuery(undefined, { staleTime: 60_000 });
  const legacyLeft = (legacy.data?.images ?? 0) + (legacy.data?.pdfs ?? 0);
  const d = q.data;
  const st = store.data;
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

      {st ? (
        <>
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <Stat label="Products on sale" value={st.products.active} hint={[st.products.outOfStock ? `${st.products.outOfStock} out of stock` : "All in stock", st.products.draft ? `${st.products.draft} drafts` : null].filter(Boolean).join(" · ")} to="/admin/products" />
            <Stat label="Customers" value={st.customers.total} hint={st.customers.total ? `${st.customers.repeat} bought more than once (${Math.round((st.customers.repeat / st.customers.total) * 100)}%)` : "They appear with the first paid order"} to="/admin/customers" />
            <Stat label="Articles published" value={st.blog.live} hint={[st.blog.scheduled ? `${st.blog.scheduled} scheduled${st.blog.nextScheduled ? `, next ${fmtDate(st.blog.nextScheduled)}` : ""}` : null, st.blog.draft ? `${st.blog.draft} drafts` : null].filter(Boolean).join(" · ") || "Nothing scheduled"} to="/admin/blog" />
            <Stat label="Image library" value={st.media.count} hint={st.media.count ? `${(st.media.bytes / 1024 / 1024).toFixed(1)} MB stored` : "Upload product and article images"} to="/admin/media" />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card title="Best sellers, last 30 days" action={<Link to="/admin/products" className="text-sm font-semibold text-navy hover:underline">All products</Link>}>
              {st.topProducts.length ? (
                <ul className="divide-y divide-line">
                  {st.topProducts.map((t, i) => (
                    <li key={t.name} className="flex items-center gap-4 px-5 py-3 text-sm">
                      <span className="w-5 text-center text-xs font-bold text-muted">{i + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{t.name}</span>
                        <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-mist"><span className="block h-full rounded-full bg-teal" style={{ width: `${Math.max(4, (t.revenue / st.topProducts[0]!.revenue) * 100)}%` }} /></span>
                      </span>
                      <span className="text-right"><span className="block font-semibold tabular-nums">{fmtMoney(t.revenue)}</span><span className="block text-xs text-muted">{t.units} units</span></span>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>No paid orders in the last 30 days.</Empty>
              )}
            </Card>

            <Card title="Needs attention">
              <ul className="divide-y divide-line text-sm">
                {d.toShip ? <li className="flex items-center justify-between gap-3 px-5 py-3"><span>{d.toShip} paid order{d.toShip === 1 ? "" : "s"} waiting for a tracking number</span><Link to="/admin/orders?status=paid" className="shrink-0 font-semibold text-navy hover:underline">Ship</Link></li> : null}
                {d.onHold ? <li className="flex items-center justify-between gap-3 px-5 py-3"><span>{d.onHold} order{d.onHold === 1 ? "" : "s"} on hold need a manual review</span><Link to="/admin/orders?status=on_hold" className="shrink-0 font-semibold text-navy hover:underline">Review</Link></li> : null}
                {d.affiliates.pending ? <li className="flex items-center justify-between gap-3 px-5 py-3"><span>{d.affiliates.pending} affiliate application{d.affiliates.pending === 1 ? "" : "s"} to review</span><Link to="/admin/affiliates?status=pending" className="shrink-0 font-semibold text-navy hover:underline">Review</Link></li> : null}
                {d.affiliates.commissionsApproved > 0 ? <li className="flex items-center justify-between gap-3 px-5 py-3"><span>{fmtMoney(d.affiliates.commissionsApproved)} in approved commissions ready to pay</span><Link to="/admin/commissions?status=approved" className="shrink-0 font-semibold text-navy hover:underline">Pay</Link></li> : null}
                {legacyLeft ? <li className="flex items-center justify-between gap-3 px-5 py-3"><span>{legacyLeft} file{legacyLeft === 1 ? "" : "s"} still load from the old WordPress site</span><Link to="/admin/coas" className="shrink-0 font-semibold text-navy hover:underline">Copy</Link></li> : null}
                {st.products.outOfStock ? <li className="flex items-center justify-between gap-3 px-5 py-3"><span>{st.products.outOfStock} product{st.products.outOfStock === 1 ? " is" : "s are"} marked out of stock</span><Link to="/admin/products" className="shrink-0 font-semibold text-navy hover:underline">Check</Link></li> : null}
                {st.missingCoa.length ? (
                  <li className="flex items-center justify-between gap-3 px-5 py-3">
                    <span>{st.missingCoa.length} product{st.missingCoa.length === 1 ? "" : "s"} on sale without a lab report: <span className="text-slate">{st.missingCoa.slice(0, 4).map((m) => m.name).join(", ")}{st.missingCoa.length > 4 ? "…" : ""}</span></span>
                    <Link to="/admin/coas" className="shrink-0 font-semibold text-navy hover:underline">Upload</Link>
                  </li>
                ) : null}
                {!d.toShip && !d.onHold && !d.affiliates.pending && !(d.affiliates.commissionsApproved > 0) && !st.products.outOfStock && !st.missingCoa.length && !legacyLeft ? <li className="px-5 py-10 text-center text-slate">Nothing pending. Everything is up to date.</li> : null}
              </ul>
            </Card>
          </div>
        </>
      ) : null}

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
