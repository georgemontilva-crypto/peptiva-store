import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { trpc } from "../lib/trpc";
import { Badge, Button, Card, Empty, Modal, Notice, OrderStatusBadge, Pagination, Table, fmtDate, fmtMoney, inputCls } from "./ui";

type Sort = "recent" | "spent" | "orders";

/** Convierte filas en un CSV que Excel abre bien (BOM + comillas escapadas). */
export function downloadCsv(filename: string, header: string[], rows: (string | number | null)[][]) {
  const cell = (v: string | number | null) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = "﻿" + [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function CustomerModal({ email, onClose }: { email: string | null; onClose: () => void }) {
  const q = trpc.admin.customers.get.useQuery({ email: email! }, { enabled: Boolean(email) });
  const c = q.data;
  return (
    <Modal title={c?.name || email || ""} open={Boolean(email)} onClose={onClose} wide>
      {q.isPending ? <p className="text-slate">Loading…</p> : null}
      {q.error ? <Notice tone="red">{q.error.message}</Notice> : null}
      {c ? (
        <div className="space-y-5 text-sm">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl bg-mist p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate">Spent</p><p className="mt-1 text-xl font-bold tabular-nums text-navy">{fmtMoney(c.spent)}</p></div>
            <div className="rounded-xl bg-mist p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate">Paid orders</p><p className="mt-1 text-xl font-bold tabular-nums text-navy">{c.paidOrders}</p></div>
            <div className="rounded-xl bg-mist p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate">Average order</p><p className="mt-1 text-xl font-bold tabular-nums text-navy">{fmtMoney(c.paidOrders ? c.spent / c.paidOrders : 0)}</p></div>
          </div>
          <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
            <dt className="text-slate">Email</dt>
            <dd><a href={`mailto:${c.email}`} className="font-semibold text-navy hover:underline">{c.email}</a> {c.subscribed ? <Badge tone="teal">Newsletter</Badge> : null}</dd>
            <dt className="text-slate">Phone</dt><dd>{c.phone || "—"}</dd>
            <dt className="text-slate">Last shipping address</dt><dd>{c.address}</dd>
            {c.favorites.length ? (<><dt className="text-slate">Buys most</dt><dd>{c.favorites.map((f) => `${f.name} ×${f.quantity}`).join(" · ")}</dd></>) : null}
          </dl>
          <div className="overflow-hidden rounded-xl border border-line">
            <Table head={["Order", "Status", "Total", "Coupon", "Date"]}>
              {c.orders.map((o) => (
                <tr key={o.id}>
                  <td className="px-4 py-2.5"><Link to={`/admin/orders/${o.id}`} className="font-semibold text-navy hover:underline">{o.number}</Link></td>
                  <td className="px-4 py-2.5"><OrderStatusBadge status={o.status} /></td>
                  <td className="px-4 py-2.5 tabular-nums">{fmtMoney(o.total)}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{o.couponCode?.toUpperCase() ?? "—"}</td>
                  <td className="px-4 py-2.5 text-slate">{fmtDate(o.createdAt, true)}</td>
                </tr>
              ))}
            </Table>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

/** Clientes: una fila por correo, con lo que ha comprado. No hay cuentas; se agrupan los pedidos. */
export default function Customers() {
  const utils = trpc.useUtils();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [sort, setSort] = useState<Sort>("recent");
  const [open, setOpen] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => { setDebounced(search); setPage(1); }, 300);
    return () => window.clearTimeout(t);
  }, [search]);

  const q = trpc.admin.customers.list.useQuery({ page, pageSize: 25, search: debounced || undefined, sort }, { placeholderData: (p) => p });

  const exportAll = async () => {
    setExporting(true);
    try {
      const all = await utils.admin.customers.list.fetch({ page: 1, pageSize: 5000, search: debounced || undefined, sort });
      downloadCsv(
        `peptiva-customers-${new Date().toISOString().slice(0, 10)}.csv`,
        ["Name", "Email", "Phone", "Location", "Orders", "Paid orders", "Spent (USD)", "First order", "Last order"],
        all.customers.map((c) => [c.name, c.email, c.phone, c.location, c.orders, c.paidOrders, c.spent.toFixed(2), new Date(c.firstOrderAt).toISOString().slice(0, 10), new Date(c.lastOrderAt).toISOString().slice(0, 10)]),
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, email or city" className={`${inputCls} sm:w-64`} aria-label="Search customers" />
          <select value={sort} onChange={(e) => { setSort(e.target.value as Sort); setPage(1); }} className={`${inputCls} sm:w-auto`} aria-label="Sort customers">
            <option value="recent">Most recent order</option>
            <option value="spent">Highest spend</option>
            <option value="orders">Most orders</option>
          </select>
        </div>
        <Button variant="ghost" disabled={exporting || !q.data?.total} onClick={() => void exportAll()}>{exporting ? "Preparing…" : "Export CSV"}</Button>
      </div>

      <Card>
        <Table head={["Customer", "Location", "Orders", "Spent", "First order", "Last order"]} empty={q.data && !q.data.customers.length ? <Empty>{debounced ? "No customers match." : "No customers yet. They appear here with their first order."}</Empty> : null}>
          {q.data?.customers.map((c) => (
            <tr key={c.email} className="cursor-pointer hover:bg-mist/50" onClick={() => setOpen(c.email)}>
              <td className="px-4 py-3">
                <button type="button" className="text-left" onClick={(e) => { e.stopPropagation(); setOpen(c.email); }}>
                  <span className="block font-semibold text-navy hover:underline">{c.name || "—"}</span>
                  <span className="block text-xs text-muted">{c.email}</span>
                </button>
              </td>
              <td className="px-4 py-3 text-slate">{c.location}</td>
              <td className="px-4 py-3 tabular-nums">{c.paidOrders}{c.orders > c.paidOrders ? <span className="text-xs text-muted"> · {c.orders - c.paidOrders} unpaid</span> : null} {c.paidOrders > 1 ? <Badge tone="teal">Repeat</Badge> : null}</td>
              <td className="px-4 py-3 font-semibold tabular-nums">{fmtMoney(c.spent)}</td>
              <td className="px-4 py-3 text-slate">{fmtDate(c.firstOrderAt)}</td>
              <td className="px-4 py-3 text-slate">{fmtDate(c.lastOrderAt)}</td>
            </tr>
          ))}
        </Table>
        {q.data ? <Pagination page={page} total={q.data.total} pageSize={25} onPage={setPage} /> : null}
      </Card>

      <CustomerModal email={open} onClose={() => setOpen(null)} />
    </div>
  );
}
