import { useState } from "react";
import { trpc } from "../lib/trpc";
import { Badge, Card, Empty, Table, Tabs, fmtDate } from "./ui";

export default function Inbox() {
  const [tab, setTab] = useState<"messages" | "leads">("messages");
  const messages = trpc.admin.inbox.messages.useQuery(undefined, { enabled: tab === "messages" });
  const leads = trpc.admin.inbox.leads.useQuery(undefined, { enabled: tab === "leads" });

  return (
    <div className="space-y-4">
      <Tabs value={tab} onChange={setTab} options={[{ value: "messages", label: "Contact messages" }, { value: "leads", label: "Leads & newsletter" }]} />
      {tab === "messages" ? (
        <Card>
          {messages.data && !messages.data.length ? <Empty>No messages yet.</Empty> : null}
          <ul className="divide-y divide-line">
            {messages.data?.map((m) => (
              <li key={m.id} className="px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{m.name} <a href={`mailto:${m.email}?subject=${encodeURIComponent(`Re: ${m.subject ?? "Your message"}`)}`} className="font-normal text-navy hover:underline">&lt;{m.email}&gt;</a></p>
                  <p className="text-xs text-muted">{fmtDate(m.createdAt, true)}</p>
                </div>
                {m.subject ? <Badge tone="teal">{m.subject}</Badge> : null}
                <p className="mt-2 whitespace-pre-line text-sm text-slate">{m.message}</p>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <Card>
          <Table head={["Email", "Source", "Date"]} empty={leads.data && !leads.data.length ? <Empty>No leads yet.</Empty> : null}>
            {leads.data?.map((l) => (
              <tr key={l.id}>
                <td className="px-4 py-3">{l.email}</td>
                <td className="px-4 py-3"><Badge>{l.source === "age_gate" ? "Age gate" : "Newsletter"}</Badge></td>
                <td className="px-4 py-3 text-slate">{fmtDate(l.createdAt, true)}</td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
    </div>
  );
}
