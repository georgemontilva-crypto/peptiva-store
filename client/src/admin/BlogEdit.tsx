import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { trpc } from "../lib/trpc";
import RichEditor from "./RichEditor";
import { ImageField } from "./mediaKit";
import { PostStateBadge } from "./Blog";
import { Button, Card, Field, Notice, inputCls } from "./ui";

type Form = {
  title: string; slug: string; excerpt: string; bodyHtml: string; coverImage: string | null; coverAlt: string; category: string;
  targetKeyword: string; seoTitle: string; seoDescription: string; status: "draft" | "published"; publishedAt: string;
};

const blank: Form = { title: "", slug: "", excerpt: "", bodyHtml: "", coverImage: null, coverAlt: "", category: "", targetKeyword: "", seoTitle: "", seoDescription: "", status: "draft", publishedAt: "" };
const toLocal = (d: Date | string | null) => (d ? new Date(new Date(d).getTime() - new Date(d).getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : "");
export const slugify = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);

/** Contador con el color según se acerque al límite que suele mostrar Google. */
export function Count({ value, ideal }: { value: string; ideal: number }) {
  const n = value.length;
  return <span className={n > ideal ? "text-red-600" : n > ideal * 0.9 ? "text-amber-600" : "text-muted"}>{n} / {ideal}</span>;
}

/** Así se verá el resultado en Google, con lo que haya escrito en ese momento. */
export function SearchPreview({ title, path, description }: { title: string; path: string; description: string }) {
  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <p className="truncate text-xs text-slate">peptivasupplies.com › {path.replace(/^\//, "").replace(/\//g, " › ")}</p>
      <p className="mt-1 truncate text-[1.05rem] text-[#1a0dab]">{title || "Title of the page"}</p>
      <p className="mt-0.5 line-clamp-2 text-sm text-slate">{description || "The description appears here. Without one, Google picks a fragment of the page on its own."}</p>
    </div>
  );
}

export default function BlogEdit() {
  const { id } = useParams();
  const postId = id && id !== "new" ? Number(id) : null;
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const q = trpc.admin.blog.get.useQuery({ id: postId! }, { enabled: postId != null, staleTime: 0 });
  const cats = trpc.admin.blog.categories.useQuery();
  const [form, setForm] = useState<Form>(blank);
  const [slugTouched, setSlugTouched] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (!q.data) return;
    const p = q.data;
    setForm({
      title: p.title, slug: p.slug, excerpt: p.excerpt ?? "", bodyHtml: p.bodyHtml, coverImage: p.coverImage, coverAlt: p.coverAlt ?? "", category: p.category ?? "",
      targetKeyword: p.targetKeyword ?? "", seoTitle: p.seoTitle ?? "", seoDescription: p.seoDescription ?? "", status: p.status, publishedAt: toLocal(p.publishedAt),
    });
    setSlugTouched(true);
    setDirty(false);
  }, [q.data]);

  // Aviso del navegador si se intenta cerrar la pestaña con cambios sin guardar
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const save = trpc.admin.blog.save.useMutation({
    onSuccess: async (r) => {
      setDirty(false);
      setSavedAt(new Date());
      await Promise.all([utils.admin.blog.list.invalidate(), utils.admin.blog.categories.invalidate(), utils.admin.blog.get.invalidate()]);
      if (postId == null) navigate(`/admin/blog/${r.id}`, { replace: true });
    },
  });

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setDirty(true);
    setForm((f) => ({ ...f, [k]: v, ...(k === "title" && !slugTouched ? { slug: slugify(String(v)) } : {}) }));
  };

  const submit = (status: Form["status"]) => {
    save.mutate({
      id: postId ?? undefined,
      title: form.title, slug: form.slug || undefined, excerpt: form.excerpt || null, bodyHtml: form.bodyHtml, coverImage: form.coverImage, coverAlt: form.coverAlt || null,
      category: form.category || null, targetKeyword: form.targetKeyword || null, seoTitle: form.seoTitle || null, seoDescription: form.seoDescription || null,
      status, publishedAt: form.publishedAt ? new Date(form.publishedAt) : null,
    });
    setForm((f) => ({ ...f, status }));
  };

  if (postId != null && q.isPending) return <p className="text-slate">Loading…</p>;
  if (postId != null && q.error) return <Notice tone="red">{q.error.message} <Link to="/admin/blog" className="underline">Back to articles</Link></Notice>;

  const scheduled = form.status === "published" && form.publishedAt && new Date(form.publishedAt) > new Date();
  const state = form.status === "draft" ? "draft" : scheduled ? "scheduled" : "live";
  const words = form.bodyHtml.replace(/<[^>]+>/g, " ").trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/admin/blog" className="text-sm font-semibold text-navy hover:underline">← All articles</Link>
        <div className="flex items-center gap-3 text-sm">
          {dirty ? <span className="text-amber-700">Unsaved changes</span> : savedAt ? <span className="text-emerald-700">Saved {savedAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span> : null}
          {postId != null && form.slug ? <a href={`/blog/${form.slug}`} target="_blank" rel="noreferrer" className="font-semibold text-navy hover:underline">{state === "live" ? "View on store ↗" : "Preview ↗"}</a> : null}
        </div>
      </div>

      {save.error ? <Notice tone="red">{save.error.message}</Notice> : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <Card className="p-5">
            <div className="space-y-4">
              <Field label="Title">
                <input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="How to Read a Peptide Certificate of Analysis" className={`${inputCls} text-lg font-semibold`} maxLength={255} />
              </Field>
              <Field label="Address" hint="Lowercase words separated by hyphens. Changing it after publishing breaks links already shared.">
                <div className="flex items-center gap-1 text-sm">
                  <span className="shrink-0 text-muted">/blog/</span>
                  <input value={form.slug} onChange={(e) => { setSlugTouched(true); set("slug", slugify(e.target.value)); }} className={`${inputCls} font-mono`} />
                </div>
              </Field>
            </div>
          </Card>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-semibold text-ink">Article</span>
              <span className="text-xs text-muted">{words} words · about {Math.max(1, Math.round(words / 220))} min read</span>
            </div>
            <RichEditor value={form.bodyHtml} onChange={(html) => set("bodyHtml", html)} placeholder="Start with the point of the article. Use H2 for each section." minHeight={460} />
          </div>

          <Card title="Search engines">
            <div className="space-y-4 p-5">
              <SearchPreview title={form.seoTitle || (form.title ? `${form.title} | Peptiva Supplies` : "")} path={`blog/${form.slug}`} description={form.seoDescription || form.excerpt} />
              <Field label="Search title" hint={<>Optional. Leave empty to use the article title. <Count value={form.seoTitle} ideal={60} /></>}>
                <input value={form.seoTitle} onChange={(e) => set("seoTitle", e.target.value)} className={inputCls} maxLength={255} />
              </Field>
              <Field label="Meta description" hint={<>One or two sentences that make someone want to click. <Count value={form.seoDescription} ideal={160} /></>}>
                <textarea value={form.seoDescription} onChange={(e) => set("seoDescription", e.target.value)} rows={3} className={inputCls} maxLength={512} />
              </Field>
              <Field label="Target search" hint="The phrase this article should rank for. Only a note for the team; it is not published.">
                <input value={form.targetKeyword} onChange={(e) => set("targetKeyword", e.target.value)} placeholder="how to read a peptide COA" className={inputCls} maxLength={191} />
              </Field>
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card title="Publish" action={<PostStateBadge state={state} publishedAt={form.publishedAt || null} />}>
            <div className="space-y-4 p-5">
              <Field label="Publish date" hint={form.status === "draft" ? "Optional. A future date schedules the article when you publish." : scheduled ? "Hidden until this moment, then it goes live on its own." : "Shown on the article. Leave empty to use the moment you publish."}>
                <input type="datetime-local" value={form.publishedAt} onChange={(e) => set("publishedAt", e.target.value)} className={inputCls} />
              </Field>
              <div className="flex flex-col gap-2">
                <Button disabled={save.isPending || !form.title.trim()} onClick={() => submit("published")}>
                  {save.isPending ? "Saving…" : form.status === "published" ? "Save changes" : form.publishedAt && new Date(form.publishedAt) > new Date() ? "Schedule" : "Publish"}
                </Button>
                {form.status === "published" ? (
                  <Button variant="ghost" disabled={save.isPending} onClick={() => submit("draft")}>Unpublish (back to draft)</Button>
                ) : (
                  <Button variant="ghost" disabled={save.isPending || !form.title.trim()} onClick={() => submit("draft")}>Save draft</Button>
                )}
              </div>
            </div>
          </Card>

          <Card title="Cover & listing">
            <div className="space-y-4 p-5">
              <ImageField label="Cover image" value={form.coverImage} onChange={(url) => set("coverImage", url)} aspect="aspect-[16/9]" hint="Shown at the top of the article, in the listing and when the link is shared. 1600×900 or larger works best." />
              {form.coverImage ? (
                <Field label="Cover description (alt text)">
                  <input value={form.coverAlt} onChange={(e) => set("coverAlt", e.target.value)} className={inputCls} maxLength={255} />
                </Field>
              ) : null}
              <Field label="Category">
                <input value={form.category} onChange={(e) => set("category", e.target.value)} list="blog-categories" placeholder="Lab Documentation" className={inputCls} maxLength={80} />
                <datalist id="blog-categories">{cats.data?.map((c) => <option key={c} value={c} />)}</datalist>
              </Field>
              <Field label="Summary" hint="Shown on the listing card. Leave empty to use the meta description.">
                <textarea value={form.excerpt} onChange={(e) => set("excerpt", e.target.value)} rows={4} className={inputCls} maxLength={1000} />
              </Field>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
