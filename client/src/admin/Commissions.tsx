import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { trpc } from "../lib/trpc";
import { Badge, Button, Card, Empty, OrderStatusBadge, Pagination, Table, Tabs, fmtDate, fmtMoney } from "./ui";

type Status = "" | "pending" | "approved" | "paid" | "rejected";
const TONE = { pending: "amber", approved: "teal", paid: "green", rejected: "gray" } as const;

export default function Commissions() {
  const [params, setParams] = useSearchParams();
  const status = (params.get("status") ?? "") as Status;
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<number[]>([]);
  const utils = trpc.useUtils();
  const q = trpc.admin.commissions.list.useQuery({ status: status || undefined, page, pageSize: 50 }, { placeholderData: (p) => p });
  const setStatus = trpc.admin.affiliates.setCommissionStatus.useMutation({
    onSuccess: () => {
      setSelected([]);
      return Promise.all([utils.admin.commissions.list.invalidate(), utils.admin.dashboard.overview.invalidate()]);
    },
  });

  return (
    <div className="space-y-4">
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
    </div>
  );
}
