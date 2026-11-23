import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { trpc, type RouterOutputs } from "../lib/trpc";
import { Badge, Button, Card, Empty, Table, Tabs, fmtDate, inputCls } from "./ui";

type Post = RouterOutputs["admin"]["blog"]["list"][number];
type Filter = "all" | Post["state"];

export function PostStateBadge({ state, publishedAt }: { state: Post["state"]; publishedAt: Date | string | null }) {
  if (state === "live") return <Badge tone="green">Published</Badge>;
  if (state === "scheduled") return <Badge tone="blue">Scheduled · {fmtDate(publishedAt)}</Badge>;
  return <Badge>Draft</Badge>;
}

/** Listado de artículos del blog con su estado: publicado, programado o borrador. */
export default function Blog() {
  const utils = trpc.useUtils();
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const q = trpc.admin.blog.list.useQuery();
  const remove = trpc.admin.blog.remove.useMutation({ onSuccess: () => utils.admin.blog.list.invalidate() });

  const all = q.data ?? [];
  const count = (s: Post["state"]) => all.filter((p) => p.state === s).length;
  const rows = useMemo(() => {
    const t = search.trim().toLowerCase();
    const time = (p: Post) => (p.publishedAt ? new Date(p.publishedAt).getTime() : 0);
    // Como un calendario editorial: borradores, luego lo próximo a salir, y al final lo ya publicado
    const rank = { draft: 0, scheduled: 1, live: 2 } as const;
    return all
      .filter((p) => (filter === "all" || p.state === filter) && (!t || p.title.toLowerCase().includes(t) || p.slug.includes(t) || (p.category ?? "").toLowerCase().includes(t)))
      .sort((a, b) => rank[a.state] - rank[b.state] || (a.state === "scheduled" ? time(a) - time(b) : time(b) - time(a)));
  }, [all, filter, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-slate">
          Articles appear on the store under <strong>Research Guides</strong>. A published article with a future date stays hidden until that day, then goes live on its own.
        </p>
        <Link to="/admin/blog/new" className="inline-flex h-10 items-center rounded-lg bg-navy px-4 text-sm font-semibold text-white hover:bg-navy-deep">+ New article</Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All", count: all.length },
            { value: "live", label: "Published", count: count("live") },
            { value: "scheduled", label: "Scheduled", count: count("scheduled") },
            { value: "draft", label: "Drafts", count: count("draft") },
          ]}
        />
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title or category" className={`${inputCls} sm:w-72`} aria-label="Search articles" />
      </div>

      <Card>
        <Table head={["Article", "Category", "Status", "Date", ""]} empty={q.data && !rows.length ? <Empty>{all.length ? "No articles match." : "No articles yet. Write the first one."}</Empty> : null}>
          {rows.map((p) => (
            <tr key={p.id} className="hover:bg-mist/50">
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-mist text-[0.65rem] text-muted ring-1 ring-line">
                    {p.coverImage ? <img src={p.coverImage} alt="" className="h-full w-full rounded-none object-cover" /> : "No cover"}
                  </span>
                  <span className="min-w-0">
                    <Link to={`/admin/blog/${p.id}`} className="block truncate font-semibold text-navy hover:underline">{p.title}</Link>
                    <span className="block truncate text-xs text-muted">/blog/{p.slug}</span>
                  </span>
                </div>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-slate">{p.category ?? "—"}</td>
              <td className="px-4 py-3"><PostStateBadge state={p.state} publishedAt={p.publishedAt} /></td>
              <td className="whitespace-nowrap px-4 py-3 text-slate">{p.publishedAt ? fmtDate(p.publishedAt, true) : <span className="text-muted">Not set</span>}</td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-2">
                  <a href={`/blog/${p.slug}`} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center rounded-lg px-3 text-xs font-semibold text-navy hover:bg-mist">{p.state === "live" ? "View" : "Preview"}</a>
                  <Link to={`/admin/blog/${p.id}`} className="inline-flex h-8 items-center rounded-lg border border-line bg-white px-3 text-xs font-semibold hover:border-navy hover:text-navy">Edit</Link>
                  <Button size="sm" variant="danger" onClick={() => { if (confirm(`Delete "${p.title}"? This cannot be undone.`)) remove.mutate({ id: p.id }); }}>Delete</Button>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}
