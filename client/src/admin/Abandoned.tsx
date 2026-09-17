import { useState } from "react";
import { Link } from "react-router-dom";
import { trpc } from "../lib/trpc";
import { Badge, Button, Card, Empty, Notice, Pagination, Table, Tabs, fmtDate, fmtMoney } from "./ui";

type Status = "" | "open" | "recovered" | "unsubscribed";

export default function Abandoned() {
  const [status, setStatus] = useState<Status>("open");
  const [page, setPage] = useState(1);
  const utils = trpc.useUtils();
  const q = trpc.admin.abandoned.list.useQuery({ status: status || undefined, page, pageSize: 25 }, { placeholderData: (p) => p });
  const refresh = () => utils.admin.abandoned.list.invalidate();
  const sendNow = trpc.admin.abandoned.sendNow.useMutation({ onSuccess: refresh });
  const remove = trpc.admin.abandoned.remove.useMutation({ onSuccess: refresh });
  const run = trpc.admin.abandoned.runNow.useMutation({ onSuccess: refresh });

  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-sm text-slate">
        A cart is saved when a shopper types their email at checkout and doesn't pay. They get up to two reminders (timing and optional coupon in{" "}
        <Link to="/admin/settings" className="font-semibold text-navy hover:underline">Settings</Link>). Buying cancels the reminders automatically.
      </p>
      {q.data && !q.data.mailConfigured ? <Notice tone="amber">Email isn't configured (RESEND_API_KEY and MAIL_FROM), so reminders are not being sent. Carts are still being saved.</Notice> : null}
      {q.data && !q.data.enabled ? <Notice tone="amber">Cart reminders are turned off in Settings.</Notice> : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={[{ value: "open", label: "Open" }, { value: "recovered", label: "Recovered" }, { value: "unsubscribed", label: "Unsubscribed" }, { value: "", label: "All" }]} />
        <div className="flex items-center gap-3">
          {run.data ? <span className="text-xs text-slate">{"sent" in run.data ? `${run.data.sent} sent` : `Skipped: ${String(run.data.skipped).replace(/_/g, " ")}`}</span> : null}
          <Button variant="ghost" onClick={() => run.mutate()} disabled={run.isPending}>Run reminders now</Button>
        </div>
      </div>
      {sendNow.error ? <Notice tone="red">{sendNow.error.message}</Notice> : null}

      <Card>
        <Table head={["Shopper", "Cart", "Value", "Reminders", "Status", "Last activity", ""]} empty={q.data && !q.data.carts.length ? <Empty>No carts here.</Empty> : null}>
          {q.data?.carts.map((c) => (
            <tr key={c.id} className="align-top hover:bg-mist/50">
              <td className="px-4 py-3"><p className="font-medium">{c.firstName ?? "—"}</p><a href={`mailto:${c.email}`} className="text-xs text-navy hover:underline">{c.email}</a></td>
              <td className="max-w-xs px-4 py-3 text-xs text-slate">{c.items.join(", ")}{c.couponCode ? <><br /><Badge tone="teal">{c.couponCode.toUpperCase()}</Badge></> : null}</td>
              <td className="px-4 py-3 font-semibold tabular-nums">{fmtMoney(c.subtotal)}</td>
              <td className="px-4 py-3 text-xs">{c.emailsSent}/2{c.lastEmailAt ? <p className="text-muted">last {fmtDate(c.lastEmailAt, true)}</p> : null}</td>
              <td className="px-4 py-3">
                {c.status === "recovered" ? <Badge tone="green">Recovered</Badge> : c.status === "unsubscribed" ? <Badge>Unsubscribed</Badge> : <Badge tone="amber">Open</Badge>}
                {c.recoveredOrderId ? <Link to={`/admin/orders/${c.recoveredOrderId}`} className="mt-1 block text-xs text-navy hover:underline">View order</Link> : null}
              </td>
              <td className="px-4 py-3 text-xs text-slate">{fmtDate(c.updatedAt, true)}</td>
              <td className="px-4 py-3 text-right">
                <div className="flex justify-end gap-2">
                  {c.status === "open" && c.emailsSent < 2 ? (
                    <Button size="sm" variant="ghost" disabled={sendNow.isPending} onClick={() => sendNow.mutate({ id: c.id })}>Send reminder {c.emailsSent + 1}</Button>
                  ) : null}
                  <Button size="sm" variant="danger" onClick={() => { if (confirm("Delete this cart?")) remove.mutate({ id: c.id }); }}>Delete</Button>
                </div>
              </td>
            </tr>
          ))}
        </Table>
        {q.data ? <Pagination page={page} total={q.data.total} pageSize={25} onPage={setPage} /> : null}
      </Card>
    </div>
  );
}
