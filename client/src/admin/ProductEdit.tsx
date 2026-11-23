import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { trpc } from "../lib/trpc";
import RichEditor from "./RichEditor";
import { GalleryField, ImageField } from "./mediaKit";
import { Count, SearchPreview, slugify } from "./BlogEdit";
import { Button, Card, Field, Notice, inputCls } from "./ui";

type Variant = { id?: number; label: string; price: string; salePrice: string; sku: string; stockStatus: "instock" | "outofstock" };
type Form = {
  name: string; slug: string; shortDescription: string; descriptionHtml: string; price: string; salePrice: string; imageUrl: string | null; gallery: string[];
  seoTitle: string; seoDescription: string; status: "active" | "draft"; stockStatus: "instock" | "outofstock"; featured: boolean; sortOrder: string; categoryIds: number[]; variants: Variant[];
};

const blank: Form = {
  name: "", slug: "", shortDescription: "", descriptionHtml: "", price: "", salePrice: "", imageUrl: null, gallery: [], seoTitle: "", seoDescription: "",
  status: "draft", stockStatus: "instock", featured: false, sortOrder: "0", categoryIds: [], variants: [],
};
const num = (v: string | null | undefined) => (v == null || v === "" ? "" : String(Number(v)));

export default function ProductEdit() {
  const { id } = useParams();
  const productId = id && id !== "new" ? Number(id) : null;
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const q = trpc.admin.products.get.useQuery({ id: productId! }, { enabled: productId != null, staleTime: 0 });
  const cats = trpc.admin.categories.list.useQuery();
  const [form, setForm] = useState<Form>(blank);
  const [slugTouched, setSlugTouched] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (!q.data) return;
    const p = q.data;
    setForm({
      name: p.name, slug: p.slug, shortDescription: p.shortDescription ?? "", descriptionHtml: p.descriptionHtml ?? "", price: num(p.price), salePrice: num(p.salePrice),
      imageUrl: p.imageUrl, gallery: p.gallery, seoTitle: p.seoTitle ?? "", seoDescription: p.seoDescription ?? "", status: p.status, stockStatus: p.stockStatus,
      featured: p.featured, sortOrder: String(p.sortOrder), categoryIds: p.categoryIds,
      variants: p.variants.map((v) => ({ id: v.id, label: v.label, price: num(v.price), salePrice: num(v.salePrice), sku: v.sku ?? "", stockStatus: v.stockStatus })),
    });
    setSlugTouched(true);
    setDirty(false);
  }, [q.data]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const refresh = () => Promise.all([utils.admin.products.invalidate(), utils.catalog.invalidate(), utils.admin.categories.list.invalidate()]);
  const save = trpc.admin.products.save.useMutation({
    onSuccess: async (r) => {
      setDirty(false);
      setSavedAt(new Date());
      await refresh();
      if (productId == null) navigate(`/admin/products/${r.id}`, { replace: true });
    },
  });
  const remove = trpc.admin.products.remove.useMutation({ onSuccess: async () => { await refresh(); navigate("/admin/products", { replace: true }); } });

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setDirty(true);
    setForm((f) => ({ ...f, [k]: v, ...(k === "name" && !slugTouched ? { slug: slugify(String(v)) } : {}) }));
  };
  const setVariant = (i: number, patch: Partial<Variant>) => set("variants", form.variants.map((v, k) => (k === i ? { ...v, ...patch } : v)));
  const moveVariant = (i: number, d: -1 | 1) => {
    const next = [...form.variants];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j]!, next[i]!];
    set("variants", next);
  };

  const hasVariants = form.variants.length > 0;
  const variantsValid = form.variants.every((v) => v.label.trim() && v.price !== "" && Number(v.price) >= 0);
  const valid = form.name.trim() && (hasVariants ? variantsValid : form.price !== "");

  const submit = () =>
    save.mutate({
      id: productId ?? undefined,
      name: form.name, slug: form.slug || undefined, shortDescription: form.shortDescription || null, descriptionHtml: form.descriptionHtml || null,
      price: Number(form.price || 0), salePrice: form.salePrice === "" ? null : Number(form.salePrice), imageUrl: form.imageUrl, gallery: form.gallery,
      seoTitle: form.seoTitle || null, seoDescription: form.seoDescription || null, status: form.status, stockStatus: form.stockStatus, featured: form.featured,
      sortOrder: Number(form.sortOrder) || 0, categoryIds: form.categoryIds,
      variants: form.variants.map((v) => ({ id: v.id, label: v.label, price: Number(v.price || 0), salePrice: v.salePrice === "" ? null : Number(v.salePrice), sku: v.sku || null, stockStatus: v.stockStatus })),
    });

  if (productId != null && q.isPending) return <p className="text-slate">Loading…</p>;
  if (productId != null && q.error) return <Notice tone="red">{q.error.message} <Link to="/admin/products" className="underline">Back to products</Link></Notice>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/admin/products" className="text-sm font-semibold text-navy hover:underline">← All products</Link>
        <div className="flex items-center gap-3 text-sm">
          {dirty ? <span className="text-amber-700">Unsaved changes</span> : savedAt ? <span className="text-emerald-700">Saved {savedAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span> : null}
          {productId != null && form.status === "active" ? <a href={`/product/${form.slug}`} target="_blank" rel="noreferrer" className="font-semibold text-navy hover:underline">View on store ↗</a> : null}
          <Button disabled={save.isPending || !valid} onClick={submit}>{save.isPending ? "Saving…" : productId == null ? "Create product" : "Save changes"}</Button>
        </div>
      </div>

      {save.error ? <Notice tone="red">{save.error.message}</Notice> : null}
      {remove.error ? <Notice tone="amber">{remove.error.message}</Notice> : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <Card className="p-5">
            <div className="space-y-4">
              <Field label="Name">
                <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="BPC-157" className={`${inputCls} text-lg font-semibold`} maxLength={191} />
              </Field>
              <Field label="Address" hint="Changing it after launch breaks links already shared and indexed.">
                <div className="flex items-center gap-1 text-sm">
                  <span className="shrink-0 text-muted">/product/</span>
                  <input value={form.slug} onChange={(e) => { setSlugTouched(true); set("slug", slugify(e.target.value)); }} className={`${inputCls} font-mono`} />
                </div>
              </Field>
              <Field label="Short description" hint="One or two lines shown next to the price, above the buy button.">
                <textarea value={form.shortDescription} onChange={(e) => set("shortDescription", e.target.value)} rows={3} className={inputCls} maxLength={4000} />
              </Field>
            </div>
          </Card>

          <Card
            title="Presentations & pricing"
            action={<Button size="sm" variant="ghost" onClick={() => set("variants", [...form.variants, { label: "", price: hasVariants ? "" : form.price, salePrice: "", sku: "", stockStatus: "instock" }])}>+ Add presentation</Button>}
          >
            <div className="p-5">
              {hasVariants ? (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[620px] text-sm">
                      <thead className="text-left text-xs font-semibold text-slate">
                        <tr><th className="w-8" /><th className="pb-2 pr-2">Presentation</th><th className="pb-2 pr-2">Price</th><th className="pb-2 pr-2">Sale price</th><th className="pb-2 pr-2">SKU</th><th className="pb-2 pr-2">Stock</th><th /></tr>
                      </thead>
                      <tbody>
                        {form.variants.map((v, i) => (
                          <tr key={v.id ?? `new-${i}`}>
                            <td className="pb-2 pr-1 align-middle">
                              <span className="flex flex-col text-[0.65rem] leading-none text-muted">
                                <button type="button" className="hover:text-navy disabled:opacity-25" disabled={i === 0} onClick={() => moveVariant(i, -1)} aria-label="Move up">▲</button>
                                <button type="button" className="hover:text-navy disabled:opacity-25" disabled={i === form.variants.length - 1} onClick={() => moveVariant(i, 1)} aria-label="Move down">▼</button>
                              </span>
                            </td>
                            <td className="pb-2 pr-2"><input value={v.label} onChange={(e) => setVariant(i, { label: e.target.value })} placeholder="10 mg" className={inputCls} maxLength={64} aria-label="Presentation" /></td>
                            <td className="pb-2 pr-2"><input type="number" min={0} step="0.01" value={v.price} onChange={(e) => setVariant(i, { price: e.target.value })} className={`${inputCls} w-28!`} aria-label="Price" /></td>
                            <td className="pb-2 pr-2"><input type="number" min={0} step="0.01" value={v.salePrice} onChange={(e) => setVariant(i, { salePrice: e.target.value })} placeholder="—" className={`${inputCls} w-28!`} aria-label="Sale price" /></td>
                            <td className="pb-2 pr-2"><input value={v.sku} onChange={(e) => setVariant(i, { sku: e.target.value })} className={`${inputCls} w-32! font-mono text-xs`} maxLength={64} aria-label="SKU" /></td>
                            <td className="pb-2 pr-2">
                              <select value={v.stockStatus} onChange={(e) => setVariant(i, { stockStatus: e.target.value as Variant["stockStatus"] })} className={`${inputCls} w-32!`} aria-label="Stock">
                                <option value="instock">In stock</option>
                                <option value="outofstock">Out of stock</option>
                              </select>
                            </td>
                            <td className="pb-2 text-right"><Button size="sm" variant="danger" onClick={() => set("variants", form.variants.filter((_, k) => k !== i))} aria-label={`Remove ${v.label || "presentation"}`}>✕</Button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-2 text-xs text-muted">
                    The store shows “from” the lowest price. Write the strength in the name — <strong>10 mg</strong>, <strong>40 mg</strong> — because each presentation is matched to its lab report by those milligrams.
                  </p>
                </>
              ) : (
                <div className="flex flex-wrap gap-4">
                  <Field label="Price (USD)"><input type="number" min={0} step="0.01" value={form.price} onChange={(e) => set("price", e.target.value)} className={`${inputCls} w-36!`} /></Field>
                  <Field label="Sale price" hint="Optional. Shown with the regular price crossed out."><input type="number" min={0} step="0.01" value={form.salePrice} onChange={(e) => set("salePrice", e.target.value)} placeholder="—" className={`${inputCls} w-36!`} /></Field>
                  <p className="basis-full text-xs text-muted">Sold in more than one strength or size? Add a presentation for each one.</p>
                </div>
              )}
            </div>
          </Card>

          <div>
            <span className="mb-1 block text-xs font-semibold text-ink">Full description</span>
            <RichEditor value={form.descriptionHtml} onChange={(html) => set("descriptionHtml", html)} placeholder="Research overview, specifications, storage and handling…" minHeight={300} />
          </div>

          <Card title="Search engines">
            <div className="space-y-4 p-5">
              <SearchPreview title={form.seoTitle || (form.name ? `${form.name} | Research Peptide | Peptiva Supplies` : "")} path={`product/${form.slug}`} description={form.seoDescription || form.shortDescription} />
              <Field label="Search title" hint={<>Optional. Leave empty to use the product name. <Count value={form.seoTitle} ideal={60} /></>}>
                <input value={form.seoTitle} onChange={(e) => set("seoTitle", e.target.value)} className={inputCls} maxLength={255} />
              </Field>
              <Field label="Meta description" hint={<Count value={form.seoDescription} ideal={160} />}>
                <textarea value={form.seoDescription} onChange={(e) => set("seoDescription", e.target.value)} rows={3} className={inputCls} maxLength={512} />
              </Field>
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card title="Visibility">
            <div className="space-y-4 p-5">
              <Field label="Status" hint={form.status === "active" ? "Visible in the shop and can be bought." : "Hidden from the store. Only visible here."}>
                <select value={form.status} onChange={(e) => set("status", e.target.value as Form["status"])} className={inputCls}>
                  <option value="active">Active — on sale</option>
                  <option value="draft">Draft — hidden</option>
                </select>
              </Field>
              <Field label="Stock">
                <select value={form.stockStatus} onChange={(e) => set("stockStatus", e.target.value as Form["stockStatus"])} className={inputCls}>
                  <option value="instock">In stock</option>
                  <option value="outofstock">Out of stock</option>
                </select>
              </Field>
              <label className="flex items-start gap-3 text-sm">
                <input type="checkbox" checked={form.featured} onChange={(e) => set("featured", e.target.checked)} className="mt-0.5 h-4 w-4 accent-teal" />
                <span><span className="font-semibold">Featured</span><span className="block text-xs text-muted">Comes first under “Most requested compounds” on the home page.</span></span>
              </label>
            </div>
          </Card>

          <Card title="Photos">
            <div className="space-y-4 p-5">
              <ImageField label="Main photo" value={form.imageUrl} onChange={(url) => set("imageUrl", url)} aspect="aspect-square" hint="Square, at least 1000×1000. Used on the shop card and at the top of the product page." />
              <GalleryField label="More photos" value={form.gallery} onChange={(urls) => set("gallery", urls)} hint="Optional. Shown as thumbnails under the main photo." />
            </div>
          </Card>

          <Card title="Categories" action={<Link to="/admin/products?view=categories" className="text-xs font-semibold text-navy hover:underline">Manage</Link>}>
            <div className="space-y-2 p-5">
              {cats.data?.map((c) => (
                <label key={c.id} className="flex items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={form.categoryIds.includes(c.id)}
                    onChange={(e) => set("categoryIds", e.target.checked ? [...form.categoryIds, c.id] : form.categoryIds.filter((x) => x !== c.id))}
                    className="h-4 w-4 accent-teal"
                  />
                  {c.name}
                </label>
              ))}
              {cats.data && !cats.data.length ? <p className="text-sm text-slate">No categories yet.</p> : null}
            </div>
          </Card>

          {productId != null ? (
            <Card title="Lab reports">
              <div className="space-y-3 p-5 text-sm text-slate">
                <p>Certificates of Analysis for this product are uploaded and assigned in the lab reports section.</p>
                <Link to="/admin/coas" className="font-semibold text-navy hover:underline">Open lab reports →</Link>
              </div>
            </Card>
          ) : null}

          {productId != null ? (
            <Card title="Delete product">
              <div className="space-y-3 p-5 text-sm text-slate">
                <p>Removes the product, its presentations and its lab reports. A product that already has orders can't be deleted — set it to Draft instead.</p>
                <Button variant="danger" disabled={remove.isPending} onClick={() => { if (confirm(`Delete "${form.name}" permanently? Its presentations and lab reports go with it.`)) remove.mutate({ id: productId }); }}>Delete this product</Button>
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
