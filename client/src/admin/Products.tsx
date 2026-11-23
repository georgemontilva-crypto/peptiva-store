import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { trpc, type RouterOutputs } from "../lib/trpc";
import { Badge, Button, Card, Empty, Field, Modal, Notice, Table, Tabs, fmtMoney, inputCls } from "./ui";

type Product = RouterOutputs["admin"]["products"]["list"][number];
type Category = RouterOutputs["admin"]["categories"]["list"][number];
type View = "products" | "categories";

/** Interruptor pequeño para cambiar un estado desde la tabla sin abrir la ficha. */
function Toggle({ on, onChange, label, tone = "teal" }: { on: boolean; onChange: (v: boolean) => void; label: string; tone?: "teal" | "amber" }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      title={label}
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${on ? (tone === "teal" ? "bg-teal" : "bg-amber-400") : "bg-slate-300"}`}
    >
      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${on ? "translate-x-[18px]" : "translate-x-0.5"}`} />
    </button>
  );
}

function ProductsTable() {
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | "active" | "draft">("");
  const q = trpc.admin.products.list.useQuery({ search: search || undefined, status: status || undefined }, { placeholderData: (p) => p });
  const refresh = () => Promise.all([utils.admin.products.list.invalidate(), utils.catalog.invalidate()]);
  const quick = trpc.admin.products.quick.useMutation({ onSuccess: refresh });
  const reorder = trpc.admin.products.reorder.useMutation({ onSuccess: refresh });
  const rows = q.data ?? [];
  const canReorder = !search && !status;

  const move = (i: number, d: -1 | 1) => {
    const ids = rows.map((r) => r.id);
    const j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    reorder.mutate({ ids });
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products" className={`${inputCls} sm:w-64`} aria-label="Search products" />
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={`${inputCls} sm:w-auto`} aria-label="Filter by status">
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
          </select>
        </div>
        <Link to="/admin/products/new" className="inline-flex h-10 items-center rounded-lg bg-navy px-4 text-sm font-semibold text-white hover:bg-navy-deep">+ New product</Link>
      </div>

      <Card>
        <Table head={["", "Product", "Price", "On sale", "In stock", "Featured", "Variants", "COAs", "Sold", ""]} empty={q.data && !rows.length ? <Empty>No products match.</Empty> : null}>
          {rows.map((p: Product, i) => (
            <tr key={p.id} className="hover:bg-mist/50">
              <td className="py-3 pl-3 pr-0">
                {canReorder ? (
                  <span className="flex flex-col text-xs leading-none text-muted">
                    <button type="button" className="px-1 py-0.5 hover:text-navy disabled:opacity-25" disabled={i === 0 || reorder.isPending} onClick={() => move(i, -1)} aria-label={`Move ${p.name} up`}>▲</button>
                    <button type="button" className="px-1 py-0.5 hover:text-navy disabled:opacity-25" disabled={i === rows.length - 1 || reorder.isPending} onClick={() => move(i, 1)} aria-label={`Move ${p.name} down`}>▼</button>
                  </span>
                ) : null}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-mist ring-1 ring-line">
                    {p.imageUrl ? <img src={p.imageUrl} alt="" loading="lazy" className="h-full w-full rounded-none object-cover" /> : <span className="text-[0.6rem] text-muted">No photo</span>}
                  </span>
                  <span className="min-w-0">
                    <Link to={`/admin/products/${p.id}`} className="block truncate font-semibold text-navy hover:underline">{p.name}</Link>
                    <span className="block truncate text-xs text-muted">/product/{p.slug}</span>
                  </span>
                </div>
              </td>
              <td className="px-4 py-3 tabular-nums">
                {p.variantCount > 1 ? <span className="text-xs text-muted">from </span> : null}
                {p.salePrice ? <><span className="font-semibold">{fmtMoney(p.salePrice)}</span> <span className="text-xs text-muted line-through">{fmtMoney(p.price)}</span></> : <span className="font-semibold">{fmtMoney(p.price)}</span>}
              </td>
              <td className="px-4 py-3"><Toggle on={p.status === "active"} label={p.status === "active" ? "On sale — click to hide from the store" : "Hidden — click to put on sale"} onChange={(v) => quick.mutate({ id: p.id, status: v ? "active" : "draft" })} /></td>
              <td className="px-4 py-3"><Toggle on={p.stockStatus === "instock"} label={p.stockStatus === "instock" ? "In stock — click to mark out of stock" : "Out of stock — click to mark in stock"} onChange={(v) => quick.mutate({ id: p.id, stockStatus: v ? "instock" : "outofstock" })} /></td>
              <td className="px-4 py-3"><Toggle tone="amber" on={p.featured} label={p.featured ? "Featured on the home page" : "Not featured"} onChange={(v) => quick.mutate({ id: p.id, featured: v })} /></td>
              <td className="px-4 py-3 tabular-nums text-slate">{p.variantCount || "—"}</td>
              <td className="px-4 py-3">{p.lotCount ? <span className="tabular-nums text-slate">{p.lotCount}</span> : <Badge tone="amber">None</Badge>}</td>
              <td className="px-4 py-3 tabular-nums text-slate">{p.unitsSold}</td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-2">
                  {p.status === "active" ? <a href={`/product/${p.slug}`} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center rounded-lg px-3 text-xs font-semibold text-navy hover:bg-mist">View</a> : null}
                  <Link to={`/admin/products/${p.id}`} className="inline-flex h-8 items-center rounded-lg border border-line bg-white px-3 text-xs font-semibold hover:border-navy hover:text-navy">Edit</Link>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      </Card>
      <p className="text-xs text-muted">
        The order here is the order in the shop. {canReorder ? "Use the arrows to move a product." : "Clear the search and filter to reorder."} Featured products come first under “Most requested compounds” on the home page.
      </p>
    </>
  );
}

function CategoriesTable() {
  const utils = trpc.useUtils();
  const q = trpc.admin.categories.list.useQuery();
  const [form, setForm] = useState<{ id?: number; name: string; slug: string; description: string; sortOrder: string } | null>(null);
  const refresh = () => Promise.all([utils.admin.categories.list.invalidate(), utils.catalog.invalidate()]);
  const save = trpc.admin.categories.save.useMutation({ onSuccess: () => { setForm(null); return refresh(); } });
  const remove = trpc.admin.categories.remove.useMutation({ onSuccess: refresh });

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-slate">Categories are the filters at the top of the shop. A product can be in several.</p>
        <Button onClick={() => { save.reset(); setForm({ name: "", slug: "", description: "", sortOrder: String(q.data?.length ?? 0) }); }}>+ New category</Button>
      </div>
      <Card>
        <Table head={["Category", "Address", "Products", "Order", ""]} empty={q.data && !q.data.length ? <Empty>No categories yet.</Empty> : null}>
          {q.data?.map((c: Category) => (
            <tr key={c.id} className="hover:bg-mist/50">
              <td className="px-4 py-3"><p className="font-semibold">{c.name}</p>{c.description ? <p className="max-w-md truncate text-xs text-muted">{c.description}</p> : null}</td>
              <td className="px-4 py-3 font-mono text-xs text-slate">/shop?category={c.slug}</td>
              <td className="px-4 py-3 tabular-nums">{c.productCount}</td>
              <td className="px-4 py-3 tabular-nums text-slate">{c.sortOrder}</td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => { save.reset(); setForm({ id: c.id, name: c.name, slug: c.slug, description: c.description ?? "", sortOrder: String(c.sortOrder) }); }}>Edit</Button>
                  <Button size="sm" variant="danger" onClick={() => { if (confirm(`Delete the category "${c.name}"? Its ${c.productCount} products stay in the catalog, just without this category.`)) remove.mutate({ id: c.id }); }}>Delete</Button>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      <Modal
        title={form?.id ? "Edit category" : "New category"}
        open={Boolean(form)}
        onClose={() => setForm(null)}
        footer={<><Button variant="ghost" onClick={() => setForm(null)}>Cancel</Button><Button disabled={save.isPending || !form?.name.trim()} onClick={() => form && save.mutate({ id: form.id, name: form.name, slug: form.slug || undefined, description: form.description || null, sortOrder: Number(form.sortOrder) || 0 })}>{save.isPending ? "Saving…" : "Save"}</Button></>}
      >
        {form ? (
          <div className="space-y-4">
            {save.error ? <Notice tone="red">{save.error.message}</Notice> : null}
            <Field label="Name"><input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} maxLength={191} /></Field>
            <Field label="Address" hint="Leave empty to generate it from the name. Changing it breaks links to the old one."><input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className={`${inputCls} font-mono`} /></Field>
            <Field label="Description" hint="Optional. Shown under the category title in the shop."><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className={inputCls} /></Field>
            <Field label="Order" hint="Lower numbers come first."><input type="number" min={0} value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} className={`${inputCls} w-28!`} /></Field>
          </div>
        ) : null}
      </Modal>
    </>
  );
}

export default function Products() {
  const [params, setParams] = useSearchParams();
  const view: View = params.get("view") === "categories" ? "categories" : "products";
  return (
    <div className="space-y-4">
      <Tabs<View> value={view} onChange={(v) => setParams(v === "products" ? {} : { view: v })} options={[{ value: "products", label: "Products" }, { value: "categories", label: "Categories" }]} />
      {view === "products" ? <ProductsTable /> : <CategoriesTable />}
    </div>
  );
}
