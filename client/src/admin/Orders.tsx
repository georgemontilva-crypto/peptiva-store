import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { trpc } from "../lib/trpc";
import { Badge, Card, Empty, OrderStatusBadge, Pagination, Table, Tabs, fmtDate, fmtMoney, inputCls } from "./ui";

const TABS = [
  { value: "", label: "All" },
  { value: "paid", label: "To ship" },
  { value: "on_hold", label: "On hold" },
  { value: "shipped", label: "Shipped" },
  { value: "completed", label: "Delivered" },
  { value: "pending", label: "Awaiting payment" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "refunded", label: "Refunded" },
];

export default function Orders() {
  const [params, setParams] = useSearchParams();
  const status = params.get("status") ?? "";
  const [search, setSearch] = useState(params.get("q") ?? "");
  const [page, setPage] = useState(1);
  const [debounced, setDebounced] = useState(search);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(search), 300);
    return () => window.clearTimeout(t);
  }, [search]);
  useEffect(() => {
    setPage(1);
  }, [status, debounced]);

  const q = trpc.admin.orders.list.useQuery({ status: status || undefined, search: debounced || undefined, page, pageSize: 25 }, { placeholderData: (p) => p });
  const overview = trpc.admin.dashboard.overview.useQuery();
  const counts = overview.data?.byStatus ?? {};

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <Tabs value={status} onChange={(v) => setParams(v ? { status: v } : {})} options={TABS.map((t) => ({ ...t, count: t.value ? counts[t.value] ?? 0 : undefined }))} />
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Order #, email, name or tracking" className={`${inputCls} xl:w-72`} aria-label="Search orders" />
      </div>
      <Card>
        <Table head={["Order", "Customer", "Status", "Items", "Total", "Tracking", "Date"]} empty={q.data && !q.data.orders.length ? <Empty>No orders match.</Empty> : null}>
          {q.data?.orders.map((o) => (
            <tr key={o.id} className="hover:bg-mist/50">
              <td className="px-4 py-3">
                <Link to={`/admin/orders/${o.id}`} className="font-semibold text-navy hover:underline">{o.number}</Link>
                <div className="mt-1 flex gap-1">
                  {o.couponCode ? <Badge tone="teal">{o.couponCode.toUpperCase()}</Badge> : null}
                  {o.affiliateId ? <Badge tone="blue">Affiliate</Badge> : null}
                </div>
              </td>
              <td className="px-4 py-3"><p className="font-medium">{o.name}</p><p className="text-xs text-muted">{o.email} · {o.state}</p></td>
              <td className="px-4 py-3"><OrderStatusBadge status={o.status} /></td>
              <td className="px-4 py-3 tabular-nums">{o.items}</td>
              <td className="px-4 py-3 font-semibold tabular-nums">{fmtMoney(o.total)}</td>
              <td className="px-4 py-3 text-xs text-slate">{o.trackingNumber ?? "—"}</td>
              <td className="px-4 py-3 text-slate">{fmtDate(o.createdAt, true)}</td>
            </tr>
          ))}
        </Table>
        {q.data ? <Pagination page={page} total={q.data.total} pageSize={25} onPage={setPage} /> : null}
      </Card>
    </div>
  );
}
