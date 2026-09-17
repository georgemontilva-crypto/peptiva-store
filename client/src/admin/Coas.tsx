import { useRef, useState } from "react";
import { trpc, type RouterOutputs } from "../lib/trpc";
import { Badge, Button, Card, Field, Modal, Notice, Table, fmtDate, inputCls } from "./ui";

type Lot = RouterOutputs["admin"]["coas"]["lots"][number];
type Parsed = { parsed: Record<string, string | number | undefined>; match: { id: number; name: string } | null; scanned: boolean; reportUrl: string };
type Form = {
  id?: number; productId: string; lotNumber: string; title: string; purity: string; specPurity: string; appearance: string; identity: string;
  measured: string; heavyMetals: string; endotoxin: string; testedAt: string; reportUrl: string; latest: boolean;
};

const blank = (productId = ""): Form => ({ productId, lotNumber: "", title: "", purity: "", specPurity: "≥ 95%", appearance: "White Lyophilized Powder", identity: "Confirmed", measured: "Not requested", heavyMetals: "Not detected", endotoxin: "", testedAt: "", reportUrl: "", latest: true });

export default function Coas() {
  const utils = trpc.useUtils();
  const products = trpc.admin.coas.products.useQuery();
  const [productId, setProductId] = useState<number | null>(null);
  const lots = trpc.admin.coas.lots.useQuery({ productId: productId ?? 0 }, { enabled: Boolean(productId) });
  const [form, setForm] = useState<Form | null>(null);
  const [notice, setNotice] = useState<{ tone: "amber" | "green" | "red"; text: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [url, setUrl] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = () => Promise.all([utils.admin.coas.products.invalidate(), utils.admin.coas.lots.invalidate()]);
  const save = trpc.admin.coas.save.useMutation({ onSuccess: () => { setForm(null); setNotice({ tone: "green", text: "Lot saved. It's live on the product page." }); return refresh(); } });
  const remove = trpc.admin.coas.remove.useMutation({ onSuccess: refresh });
  const parseUrl = trpc.admin.coas.parseUrl.useMutation({ onSuccess: (r) => openParsed(r as Parsed), onError: (e) => setNotice({ tone: "red", text: e.message }) });
  const current = products.data?.find((p) => p.id === productId);

  function openParsed(r: Parsed) {
    const p = r.parsed;
    // El nombre leído del certificado manda sobre el producto abierto en la lista
    const target = r.match?.id ?? productId ?? null;
    if (r.match) setProductId(r.match.id);
    const found = Number(p.found ?? 0);
    setNotice(
      r.scanned
        ? { tone: "amber", text: "This PDF has no text layer (it's a scanned image), so nothing could be read. Type the values from the certificate." }
        : found < 4
          ? { tone: "amber", text: `Only part of the certificate could be read (${found} fields). Check the empty fields against the PDF.` }
          : { tone: "green", text: `Read ${found} fields from the certificate${r.match ? ` · matched to ${r.match.name}` : ""}. Review and save.` },
    );
    setForm({
      ...blank(target ? String(target) : ""),
      lotNumber: String(p.lotNumber ?? ""), title: String(p.title ?? ""), purity: String(p.purity ?? ""), specPurity: String(p.specPurity ?? "≥ 95%"),
      appearance: String(p.appearance ?? ""), identity: String(p.identity ?? ""), measured: String(p.measured ?? ""), heavyMetals: String(p.heavyMetals ?? ""),
      endotoxin: String(p.endotoxin ?? ""), testedAt: String(p.testedAt ?? ""), reportUrl: r.reportUrl,
    });
  }

  async function upload(file: File) {
    setUploading(true);
    setNotice(null);
    try {
      const res = await fetch("/admin-api/coa/upload", { method: "POST", headers: { "Content-Type": "application/pdf", "X-Filename": file.name }, body: file });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      openParsed(data as Parsed);
    } catch (err) {
      setNotice({ tone: "red", text: err instanceof Error ? err.message : "Upload failed" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const edit = (l: Lot) =>
    setForm({
      id: l.id, productId: String(l.productId), lotNumber: l.lotNumber, title: l.title ?? "", purity: l.purity ?? "", specPurity: l.specPurity ?? "", appearance: l.appearance ?? "",
      identity: l.identity ?? "", measured: l.measured ?? "", heavyMetals: l.heavyMetals ?? "", endotoxin: l.endotoxin ?? "", testedAt: l.testedAt ?? "", reportUrl: l.reportUrl ?? "", latest: l.latest,
    });

  const f = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((s) => (s ? { ...s, [k]: e.target.value } : s));

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl">
            <h2 className="font-display text-lg font-medium text-ink">Add a lab report</h2>
            <p className="mt-1 text-sm text-slate">Upload the certificate PDF: lot, purity, identity, net content, heavy metals, endotoxin and test date are read automatically, and the product is suggested from the name. You review before publishing.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) upload(file); }} />
            <Button onClick={() => fileRef.current?.click()} disabled={uploading}>{uploading ? "Reading PDF…" : "Upload certificate PDF"}</Button>
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (url) parseUrl.mutate({ url }); }}>
              <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="…or paste a PDF link" className={`${inputCls} sm:w-60`} aria-label="PDF link" />
              <Button type="submit" variant="ghost" disabled={parseUrl.isPending || !url}>{parseUrl.isPending ? "Reading…" : "Read"}</Button>
            </form>
          </div>
        </div>
      </Card>

      {notice ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}

      <div className="grid gap-5 xl:grid-cols-[1fr_1.4fr]">
        <Card title="Products">
          <ul className="max-h-[70vh] divide-y divide-line overflow-y-auto">
            {products.data?.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => setProductId(p.id)} className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-mist/60 ${productId === p.id ? "bg-mist" : ""}`}>
                  {p.imageUrl ? <img src={p.imageUrl} alt="" className="h-10 w-10 rounded-lg object-cover" /> : <span className="h-10 w-10 rounded-lg bg-mist" />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">{p.name}</span>
                    <span className="block text-xs text-muted">
                      {p.latest ? `Lot ${p.latest.lotNumber} · ${p.latest.purity}% · ${fmtDate(p.latest.testedAt ? `${p.latest.testedAt}T12:00:00` : null)}` : p.pdfOnly ? "PDF only, no data" : "No certificate"}
                    </span>
                  </span>
                  {p.latest ? <Badge tone="green">{p.lotCount} {p.lotCount === 1 ? "lot" : "lots"}</Badge> : p.pdfOnly ? <Badge tone="amber">Needs data</Badge> : <Badge tone="red">Missing</Badge>}
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <Card
          title={current ? `Lots · ${current.name}` : "Lots"}
          action={current ? <Button size="sm" variant="ghost" onClick={() => setForm(blank(String(current.id)))}>+ Add manually</Button> : null}
        >
          {!current ? (
            <p className="px-5 py-12 text-center text-sm text-slate">Pick a product to see and edit its lots.</p>
          ) : (
            <>
              {current.pdfOnly && !current.latest ? (
                <div className="p-5 pb-0">
                  <Notice tone="amber">
                    This product only has a PDF link without data, so the test results section doesn't show. <button type="button" className="font-semibold underline" onClick={() => { setUrl(current.pdfOnly ?? ""); parseUrl.mutate({ url: current.pdfOnly! }); }}>Read that PDF</button> or upload it.
                  </Notice>
                </div>
              ) : null}
              <Table head={["Lot", "Purity", "Identity", "Heavy metals", "Tested", "", ""]}>
                {lots.data?.filter((l) => l.lotNumber !== "Current batch").map((l) => (
                  <tr key={l.id} className="hover:bg-mist/50">
                    <td className="px-4 py-3"><p className="font-semibold">{l.lotNumber}</p><p className="text-xs text-muted">{l.title}</p></td>
                    <td className="px-4 py-3 font-semibold tabular-nums text-emerald-700">{l.purity ? `${l.purity}%` : "—"}</td>
                    <td className="px-4 py-3">{l.identity ?? "—"}</td>
                    <td className="px-4 py-3">{l.heavyMetals ?? "—"}</td>
                    <td className="px-4 py-3 text-slate">{l.testedAt ? fmtDate(`${l.testedAt}T12:00:00`) : "—"}</td>
                    <td className="px-4 py-3">{l.latest ? <Badge tone="teal">Shown first</Badge> : null}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        {l.reportUrl ? <a href={l.reportUrl} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center rounded-lg px-2 text-xs font-semibold text-navy hover:bg-mist">PDF ↗</a> : null}
                        <Button size="sm" variant="ghost" onClick={() => edit(l)}>Edit</Button>
                        <Button size="sm" variant="danger" onClick={() => { if (confirm(`Delete lot ${l.lotNumber}?`)) remove.mutate({ id: l.id }); }}>Delete</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </Table>
              {lots.data && !lots.data.some((l) => l.lotNumber !== "Current batch") ? <p className="px-5 py-8 text-center text-sm text-slate">No lots with data yet.</p> : null}
            </>
          )}
        </Card>
      </div>

      <Modal
        title={form?.id ? `Edit lot ${form.lotNumber}` : "Review certificate data"}
        open={Boolean(form)}
        onClose={() => setForm(null)}
        wide
        footer={
          <>
            <Button variant="ghost" onClick={() => setForm(null)}>Cancel</Button>
            <Button
              disabled={save.isPending || !form?.productId || !form?.lotNumber}
              onClick={() => form && save.mutate({ ...form, id: form.id, productId: Number(form.productId), testedAt: form.testedAt || null })}
            >
              {save.isPending ? "Saving…" : "Save lot"}
            </Button>
          </>
        }
      >
        {form ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Product" className="sm:col-span-2">
              <select value={form.productId} onChange={f("productId")} className={inputCls}>
                <option value="">Select a product</option>
                {products.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <Field label="Lot number"><input value={form.lotNumber} onChange={f("lotNumber")} className={`${inputCls} font-mono`} placeholder="D4130" /></Field>
            <Field label="Name on certificate"><input value={form.title} onChange={f("title")} className={inputCls} placeholder="GLP-1 SM" /></Field>
            <Field label="Purity (%)" hint="Number only, e.g. 99.434"><input value={form.purity} onChange={f("purity")} inputMode="decimal" className={inputCls} /></Field>
            <Field label="Purity specification"><input value={form.specPurity} onChange={f("specPurity")} className={inputCls} /></Field>
            <Field label="Appearance"><input value={form.appearance} onChange={f("appearance")} className={inputCls} /></Field>
            <Field label="Identity (MS)"><input value={form.identity} onChange={f("identity")} className={inputCls} /></Field>
            <Field label="Net peptide content"><input value={form.measured} onChange={f("measured")} className={inputCls} /></Field>
            <Field label="Heavy metals"><input value={form.heavyMetals} onChange={f("heavyMetals")} className={inputCls} /></Field>
            <Field label="Endotoxin"><input value={form.endotoxin} onChange={f("endotoxin")} className={inputCls} placeholder="< 1 EU/mL" /></Field>
            <Field label="Test date"><input type="date" value={form.testedAt} onChange={f("testedAt")} className={inputCls} /></Field>
            <Field label="Certificate PDF link" className="sm:col-span-3"><input value={form.reportUrl} onChange={f("reportUrl")} className={inputCls} /></Field>
            <label className="flex items-center gap-2 text-sm sm:col-span-3">
              <input type="checkbox" checked={form.latest} onChange={(e) => setForm({ ...form, latest: e.target.checked })} className="h-4 w-4 accent-navy" />
              Show this lot first on the product page (the "Verified test results" section)
            </label>
            {save.error ? <p className="text-sm text-red-700 sm:col-span-3">{save.error.message}</p> : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
