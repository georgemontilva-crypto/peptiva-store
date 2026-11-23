import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { trpc, type RouterOutputs } from "../lib/trpc";
import RichEditor from "./RichEditor";
import { Badge, Button, Card, Empty, Field, Modal, Notice, Table, Tabs, fmtDate, inputCls } from "./ui";

type View = "pages" | "faq";
type FaqItem = RouterOutputs["admin"]["pages"]["faq"]["items"][number];

/** Editor de una página de políticas: título y texto, con la opción de volver al original. */
function PageEditor({ slug, onClose }: { slug: string; onClose: () => void }) {
  const utils = trpc.useUtils();
  const q = trpc.admin.pages.get.useQuery({ slug }, { staleTime: 0 });
  const [title, setTitle] = useState("");
  const [html, setHtml] = useState("");
  useEffect(() => {
    if (q.data) {
      setTitle(q.data.title);
      setHtml(q.data.html);
    }
  }, [q.data]);
  const refresh = () => Promise.all([utils.admin.pages.invalidate(), utils.content.page.invalidate()]);
  const save = trpc.admin.pages.save.useMutation({ onSuccess: async () => { await refresh(); onClose(); } });
  const reset = trpc.admin.pages.reset.useMutation({ onSuccess: async () => { await refresh(); onClose(); } });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onClose} className="text-sm font-semibold text-navy hover:underline">← All pages</button>
        <div className="flex gap-2">
          {q.data?.edited ? <Button variant="ghost" disabled={reset.isPending} onClick={() => { if (confirm("Discard your edits and go back to the original text of this page?")) reset.mutate({ slug }); }}>Restore original</Button> : null}
          <a href={`/${slug}`} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center rounded-lg px-3 text-sm font-semibold text-navy hover:bg-mist">View page ↗</a>
          <Button disabled={save.isPending || !title.trim() || !q.data} onClick={() => save.mutate({ slug, title, html })}>{save.isPending ? "Saving…" : "Save page"}</Button>
        </div>
      </div>
      {save.error ? <Notice tone="red">{save.error.message}</Notice> : null}
      <Card className="p-5">
        <Field label="Page title"><input value={title} onChange={(e) => setTitle(e.target.value)} className={`${inputCls} text-lg font-semibold`} maxLength={191} /></Field>
      </Card>
      {q.data ? <RichEditor value={html} onChange={setHtml} minHeight={420} /> : <p className="text-slate">Loading…</p>}
    </div>
  );
}

function PagesList() {
  const [params, setParams] = useSearchParams();
  const editing = params.get("page");
  const q = trpc.admin.pages.list.useQuery();
  if (editing) return <PageEditor slug={editing} onClose={() => setParams({})} />;
  return (
    <>
      <p className="max-w-2xl text-sm text-slate">The policy pages linked in the footer and at checkout. Keep them in line with what the store actually does — shipping rates, return window, minimum age.</p>
      <Card>
        <Table head={["Page", "Address", "Status", ""]} empty={q.data && !q.data.length ? <Empty>No pages.</Empty> : null}>
          {q.data?.map((p) => (
            <tr key={p.slug} className="hover:bg-mist/50">
              <td className="px-4 py-3 font-semibold">{p.title}</td>
              <td className="px-4 py-3 font-mono text-xs text-slate">/{p.slug}</td>
              <td className="px-4 py-3">{p.edited ? <Badge tone="teal">Edited {fmtDate(p.updatedAt)}</Badge> : <Badge>Original text</Badge>}</td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-2">
                  <a href={`/${p.slug}`} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center rounded-lg px-3 text-xs font-semibold text-navy hover:bg-mist">View</a>
                  <Button size="sm" variant="ghost" onClick={() => setParams({ page: p.slug })}>Edit</Button>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}

function FaqEditor() {
  const utils = trpc.useUtils();
  const q = trpc.admin.pages.faq.useQuery(undefined, { staleTime: 0 });
  const [items, setItems] = useState<FaqItem[]>([]);
  const [dirty, setDirty] = useState(false);
  const [edit, setEdit] = useState<{ index: number | null; item: FaqItem } | null>(null);
  useEffect(() => {
    if (q.data) {
      setItems(q.data.items);
      setDirty(false);
    }
  }, [q.data]);
  const refresh = () => Promise.all([utils.admin.pages.faq.invalidate(), utils.content.faq.invalidate()]);
  const save = trpc.admin.pages.saveFaq.useMutation({ onSuccess: refresh });
  const reset = trpc.admin.pages.resetFaq.useMutation({ onSuccess: refresh });

  const change = (next: FaqItem[]) => {
    setItems(next);
    setDirty(true);
  };
  const move = (i: number, d: -1 | 1) => {
    const next = [...items];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j]!, next[i]!];
    change(next);
  };
  const sections = [...new Set(items.map((i) => i.section))];
  const apply = () => {
    if (!edit) return;
    change(edit.index == null ? [...items, edit.item] : items.map((it, k) => (k === edit.index ? edit.item : it)));
    setEdit(null);
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-slate">Shown on the FAQ page and, the first eight, on the home page. They are also sent to Google as questions and answers, so write the answer the way you'd say it to a customer.</p>
        <div className="flex gap-2">
          {q.data?.edited ? <Button variant="ghost" disabled={reset.isPending} onClick={() => { if (confirm("Discard all edits and go back to the original questions?")) reset.mutate(); }}>Restore original</Button> : null}
          <Button variant="ghost" onClick={() => setEdit({ index: null, item: { section: sections[0] ?? "General", q: "", a: "" } })}>+ Add question</Button>
          <Button disabled={!dirty || save.isPending} onClick={() => save.mutate({ items })}>{save.isPending ? "Saving…" : dirty ? "Save changes" : "Saved"}</Button>
        </div>
      </div>
      {save.error ? <Notice tone="red">{save.error.message}</Notice> : null}
      <Card>
        <ul className="divide-y divide-line">
          {items.map((it, i) => (
            <li key={`${it.q}-${i}`} className="flex items-start gap-3 px-4 py-3.5">
              <span className="mt-0.5 flex flex-col text-xs leading-none text-muted">
                <button type="button" className="px-1 py-0.5 hover:text-navy disabled:opacity-25" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">▲</button>
                <button type="button" className="px-1 py-0.5 hover:text-navy disabled:opacity-25" disabled={i === items.length - 1} onClick={() => move(i, 1)} aria-label="Move down">▼</button>
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{it.q} <Badge>{it.section}</Badge></p>
                <p className="mt-1 line-clamp-2 text-sm text-slate">{it.a.replace(/<[^>]+>/g, " ")}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button size="sm" variant="ghost" onClick={() => setEdit({ index: i, item: it })}>Edit</Button>
                <Button size="sm" variant="danger" onClick={() => { if (confirm("Remove this question?")) change(items.filter((_, k) => k !== i)); }}>Remove</Button>
              </div>
            </li>
          ))}
        </ul>
        {q.data && !items.length ? <Empty>No questions. Add the first one.</Empty> : null}
      </Card>

      <Modal
        title={edit?.index == null ? "New question" : "Edit question"}
        open={Boolean(edit)}
        onClose={() => setEdit(null)}
        wide
        footer={<><Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button><Button disabled={!edit?.item.q.trim() || !edit.item.a.replace(/<[^>]+>/g, "").trim() || !edit.item.section.trim()} onClick={apply}>Done</Button></>}
      >
        {edit ? (
          <div className="space-y-4">
            <Field label="Section" hint="Questions with the same section are grouped together.">
              <input value={edit.item.section} onChange={(e) => setEdit({ ...edit, item: { ...edit.item, section: e.target.value } })} list="faq-sections" className={inputCls} maxLength={80} />
              <datalist id="faq-sections">{sections.map((s) => <option key={s} value={s} />)}</datalist>
            </Field>
            <Field label="Question"><input value={edit.item.q} onChange={(e) => setEdit({ ...edit, item: { ...edit.item, q: e.target.value } })} className={inputCls} maxLength={300} /></Field>
            <div>
              <span className="mb-1 block text-xs font-semibold text-ink">Answer</span>
              <RichEditor value={edit.item.a} onChange={(a) => setEdit((cur) => (cur ? { ...cur, item: { ...cur.item, a } } : cur))} minHeight={160} placeholder="Answer in two or three sentences." />
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}

/** Textos fijos del sitio: páginas de políticas y preguntas frecuentes. */
export default function Pages() {
  const [params, setParams] = useSearchParams();
  const view: View = params.get("view") === "faq" ? "faq" : "pages";
  return (
    <div className="space-y-4">
      {params.get("page") ? null : <Tabs<View> value={view} onChange={(v) => setParams(v === "faq" ? { view: "faq" } : {})} options={[{ value: "pages", label: "Policy pages" }, { value: "faq", label: "FAQ" }]} />}
      {view === "faq" ? <FaqEditor /> : <PagesList />}
    </div>
  );
}
