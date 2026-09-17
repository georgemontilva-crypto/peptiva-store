import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { trpc } from "../lib/trpc";
import { Badge, Button, Card, Empty, Field, Modal, Notice, Table, Tabs, fmtDate, fmtMoney, inputCls } from "./ui";

type Status = "" | "pending" | "active" | "suspended" | "rejected";
export const AFF_STATUS: Record<string, { label: string; tone: "amber" | "green" | "gray" | "red" }> = {
  pending: { label: "Application", tone: "amber" },
  active: { label: "Active", tone: "green" },
  suspended: { label: "Suspended", tone: "red" },
  rejected: { label: "Rejected", tone: "gray" },
};

export default function Affiliates() {
  const [params, setParams] = useSearchParams();
  const status = (params.get("status") ?? "") as Status;
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const q = trpc.admin.affiliates.list.useQuery({ status: status || undefined, search: search || undefined }, { placeholderData: (p) => p });
  const [invite, setInvite] = useState<{ name: string; email: string; code: string; commissionRate: string; sendInvite: boolean } | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const refresh = () => Promise.all([utils.admin.affiliates.list.invalidate(), utils.admin.dashboard.overview.invalidate()]);
  const approve = trpc.admin.affiliates.approve.useMutation({ onSuccess: (r) => { if (r.passwordLink) setLink(r.passwordLink); return refresh(); } });
  const reject = trpc.admin.affiliates.reject.useMutation({ onSuccess: refresh });
  const create = trpc.admin.affiliates.create.useMutation({
    onSuccess: (r) => {
      setInvite(null);
      refresh();
      // Sin email configurado se queda aquí para copiar el enlace de contraseña
      if (r.passwordLink) setLink(r.passwordLink);
      else navigate(`/admin/affiliates/${r.id}`);
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <Tabs value={status} onChange={(v) => setParams(v ? { status: v } : {})} options={[{ value: "", label: "All" }, { value: "pending", label: "Applications" }, { value: "active", label: "Active" }, { value: "suspended", label: "Suspended" }, { value: "rejected", label: "Rejected" }]} />
        <div className="flex gap-2">
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, email or code" className={`${inputCls} xl:w-64`} aria-label="Search affiliates" />
          <Button onClick={() => setInvite({ name: "", email: "", code: "", commissionRate: "", sendInvite: true })}>+ Add affiliate</Button>
        </div>
      </div>

      {link ? (
        <Notice tone="blue">
          Email isn't configured, so share this one-time link so the affiliate can create their password (valid 7 days):
          <input readOnly value={link} className={`${inputCls} mt-2`} onFocus={(e) => e.currentTarget.select()} />
          <button type="button" className="mt-2 text-xs font-semibold underline" onClick={() => setLink(null)}>Dismiss</button>
        </Notice>
      ) : null}

      <Card>
        <Table head={["Affiliate", "Status", "Code", "Rate", "Clicks", "Orders", "Pending", "To pay", "Paid", ""]} empty={q.data && !q.data.length ? <Empty>No affiliates here.</Empty> : null}>
          {q.data?.map((a) => (
            <tr key={a.id} className="hover:bg-mist/50">
              <td className="px-4 py-3">
                <Link to={`/admin/affiliates/${a.id}`} className="font-semibold text-navy hover:underline">{a.name}</Link>
                <p className="text-xs text-muted">{a.email}</p>
                {a.status === "pending" ? <p className="mt-1 max-w-xs truncate text-xs text-slate" title={a.channel ?? ""}>{a.channel} · {a.audience ?? "—"} · {fmtDate(a.createdAt)}</p> : null}
              </td>
              <td className="px-4 py-3"><Badge tone={AFF_STATUS[a.status]?.tone}>{AFF_STATUS[a.status]?.label}</Badge></td>
              <td className="px-4 py-3 font-mono text-xs">{a.code}</td>
              <td className="px-4 py-3 tabular-nums">{a.effectiveRate}%</td>
              <td className="px-4 py-3 tabular-nums">{a.totals.clicks}</td>
              <td className="px-4 py-3 tabular-nums">{a.totals.orders}</td>
              <td className="px-4 py-3 tabular-nums">{fmtMoney(a.totals.pending)}</td>
              <td className="px-4 py-3 font-semibold tabular-nums">{fmtMoney(a.totals.approved)}</td>
              <td className="px-4 py-3 tabular-nums">{fmtMoney(a.totals.paid)}</td>
              <td className="px-4 py-3 text-right">
                {a.status === "pending" ? (
                  <div className="flex justify-end gap-2">
                    <Button size="sm" onClick={() => approve.mutate({ id: a.id })} disabled={approve.isPending}>Approve</Button>
                    <Button size="sm" variant="danger" onClick={() => { if (confirm(`Reject ${a.name}?`)) reject.mutate({ id: a.id }); }}>Reject</Button>
                  </div>
                ) : (
                  <Link to={`/admin/affiliates/${a.id}`} className="text-sm font-semibold text-navy hover:underline">Open</Link>
                )}
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      <Modal
        title="Add affiliate"
        open={Boolean(invite)}
        onClose={() => setInvite(null)}
        footer={<><Button variant="ghost" onClick={() => setInvite(null)}>Cancel</Button><Button disabled={create.isPending || !invite?.name || !invite?.email} onClick={() => invite && create.mutate({ name: invite.name, email: invite.email, code: invite.code || undefined, status: "active", commissionRate: invite.commissionRate ? Number(invite.commissionRate) : null, sendInvite: invite.sendInvite })}>{create.isPending ? "Saving…" : "Add as active"}</Button></>}
      >
        {invite ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name"><input value={invite.name} onChange={(e) => setInvite({ ...invite, name: e.target.value })} className={inputCls} /></Field>
            <Field label="Email"><input type="email" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} className={inputCls} /></Field>
            <Field label="Referral code" hint="Empty = generated from the name"><input value={invite.code} onChange={(e) => setInvite({ ...invite, code: e.target.value })} className={`${inputCls} font-mono`} /></Field>
            <Field label="Commission %" hint="Empty = general rate from Settings"><input type="number" min="0" max="90" step="0.5" value={invite.commissionRate} onChange={(e) => setInvite({ ...invite, commissionRate: e.target.value })} className={inputCls} /></Field>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" checked={invite.sendInvite} onChange={(e) => setInvite({ ...invite, sendInvite: e.target.checked })} className="h-4 w-4 accent-navy" />
              Send welcome email with a link to create their password
            </label>
            {create.error ? <p className="text-sm text-red-700 sm:col-span-2">{create.error.message}</p> : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
