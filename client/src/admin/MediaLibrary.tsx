import { useState } from "react";
import { trpc, type RouterOutputs } from "../lib/trpc";
import { UploadZone, fmtBytes } from "./mediaKit";
import { Button, Card, Empty, Field, Modal, Notice, Pagination, fmtDate, inputCls } from "./ui";

type Item = RouterOutputs["admin"]["media"]["list"]["items"][number];

/**
 * Aviso mientras queden fotos o certificados alojados en el WordPress anterior, con el botón que los
 * copia a esta tienda. Va por tandas y muestra el avance; lo que falle queda listado al final.
 */
function LegacyImport() {
  const utils = trpc.useUtils();
  const status = trpc.admin.media.legacyStatus.useQuery();
  const run = trpc.admin.media.importLegacy.useMutation();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [failed, setFailed] = useState<{ url: string; reason: string }[]>([]);
  const total = (status.data?.images ?? 0) + (status.data?.pdfs ?? 0);

  const start = async () => {
    const skip: string[] = [];
    const errors: { url: string; reason: string }[] = [];
    let done = 0;
    setFailed([]);
    setProgress({ done: 0, total });
    for (;;) {
      const r = await run.mutateAsync({ skip });
      done += r.imported;
      for (const f of r.failed) {
        skip.push(f.url);
        errors.push(f);
      }
      setProgress({ done, total });
      if (r.remaining <= 0) break;
    }
    setFailed(errors);
    setProgress(null);
    await Promise.all([utils.admin.media.invalidate(), utils.admin.products.invalidate(), utils.catalog.invalidate()]);
  };

  if (!status.data || (!total && !failed.length)) return null;
  return (
    <Notice tone={failed.length && !total ? "red" : "amber"}>
      {total ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-3xl">
            <strong>{[status.data.images ? `${status.data.images} product photo${status.data.images === 1 ? "" : "s"}` : null, status.data.pdfs ? `${status.data.pdfs} lab report PDF${status.data.pdfs === 1 ? "" : "s"}` : null].filter(Boolean).join(" and ")}</strong>{" "}
            still load from the old WordPress site. Copy them here before the domain is moved, or they will stop loading that day.
          </p>
          <Button disabled={Boolean(progress)} onClick={() => void start()}>{progress ? `Copying… ${progress.done} of ${progress.total}` : "Copy them to this store"}</Button>
        </div>
      ) : null}
      {failed.length ? (
        <div className={total ? "mt-3" : ""}>
          <p className="font-semibold">{failed.length} file{failed.length === 1 ? "" : "s"} could not be copied:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">{failed.map((f) => <li key={f.url}><span className="break-all font-mono">{f.url.replace(/^https?:\/\/[^/]+/, "")}</span> — {f.reason}</li>)}</ul>
        </div>
      ) : null}
    </Notice>
  );
}

/** Biblioteca de imágenes: todo lo que se ha subido para el blog y los productos. */
export default function MediaLibrary() {
  const utils = trpc.useUtils();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<Item | null>(null);
  const [alt, setAlt] = useState("");
  const [copied, setCopied] = useState(false);
  const q = trpc.admin.media.list.useQuery({ page, pageSize: 48, search: search || undefined }, { placeholderData: (p) => p });
  const refresh = () => utils.admin.media.list.invalidate();
  const update = trpc.admin.media.update.useMutation({ onSuccess: refresh });
  const remove = trpc.admin.media.remove.useMutation({
    onSuccess: (r) => {
      if (r.ok) setOpen(null);
      return refresh();
    },
  });

  const show = (m: Item) => {
    remove.reset();
    setCopied(false);
    setAlt(m.alt ?? "");
    setOpen(m);
  };

  return (
    <div className="space-y-4">
      <LegacyImport />
      <UploadZone onUploaded={() => setPage(1)} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <input type="search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search by file name or description" className={`${inputCls} sm:w-80`} aria-label="Search images" />
        {q.data ? <p className="text-sm text-slate">{q.data.total} image{q.data.total === 1 ? "" : "s"} · {fmtBytes(q.data.bytes)} stored</p> : null}
      </div>

      <Card>
        {q.data?.items.length ? (
          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4 lg:grid-cols-6">
            {q.data.items.map((m) => (
              <button key={m.id} type="button" onClick={() => show(m)} className="group text-left">
                <span className="block aspect-square overflow-hidden rounded-xl bg-mist ring-1 ring-line transition group-hover:ring-2 group-hover:ring-navy/50">
                  <img src={m.url} alt={m.alt ?? ""} loading="lazy" className="h-full w-full rounded-none object-cover" />
                </span>
                <span className="mt-1.5 block truncate text-xs font-medium text-ink">{m.filename}</span>
                <span className="block text-[0.7rem] text-muted">{m.width && m.height ? `${m.width}×${m.height} · ` : ""}{fmtBytes(m.size)}</span>
              </button>
            ))}
          </div>
        ) : q.data ? (
          <Empty>{search ? "No images match that search." : "No images yet. Upload the first one above — product photos, article covers, anything the store needs."}</Empty>
        ) : (
          <Empty>Loading…</Empty>
        )}
        {q.data ? <Pagination page={page} total={q.data.total} pageSize={48} onPage={setPage} /> : null}
      </Card>

      <Modal
        title={open?.filename ?? ""}
        open={Boolean(open)}
        onClose={() => setOpen(null)}
        wide
        footer={
          open ? (
            <>
              <Button variant="danger" disabled={remove.isPending} onClick={() => remove.mutate({ id: open.id, force: Boolean(remove.data && !remove.data.ok) })}>
                {remove.data && !remove.data.ok ? "Delete anyway" : "Delete"}
              </Button>
              <Button variant="ghost" onClick={() => setOpen(null)}>Close</Button>
              <Button disabled={update.isPending || alt === (open.alt ?? "")} onClick={() => update.mutate({ id: open.id, alt })}>Save description</Button>
            </>
          ) : undefined
        }
      >
        {open ? (
          <div className="grid gap-5 sm:grid-cols-[1.2fr_1fr]">
            <div className="flex items-center justify-center overflow-hidden rounded-xl bg-mist p-3">
              <img src={open.url} alt={open.alt ?? ""} className="max-h-[52vh] w-auto rounded-none object-contain" />
            </div>
            <div className="space-y-4 text-sm">
              {remove.data && !remove.data.ok ? (
                <Notice tone="amber">
                  This image is in use. Deleting it leaves a broken image in:
                  <ul className="mt-1 list-disc pl-5">{remove.data.usedIn.map((u) => <li key={u}>{u}</li>)}</ul>
                </Notice>
              ) : null}
              <Field label="Description (alt text)" hint="What the image shows. Screen readers and search engines read this.">
                <input value={alt} onChange={(e) => setAlt(e.target.value)} className={inputCls} maxLength={255} />
              </Field>
              <Field label="Address">
                <div className="flex gap-2">
                  <input readOnly value={open.url} className={`${inputCls} font-mono text-xs`} onFocus={(e) => e.target.select()} />
                  <Button variant="ghost" onClick={() => { void navigator.clipboard.writeText(open.url).then(() => setCopied(true)); }}>{copied ? "Copied" : "Copy"}</Button>
                </div>
              </Field>
              <dl className="grid grid-cols-2 gap-y-1 text-xs text-slate">
                <dt>Size</dt><dd className="text-ink">{fmtBytes(open.size)}</dd>
                <dt>Dimensions</dt><dd className="text-ink">{open.width && open.height ? `${open.width} × ${open.height} px` : "—"}</dd>
                <dt>Format</dt><dd className="text-ink">{open.mime.replace("image/", "").toUpperCase()}</dd>
                <dt>Uploaded</dt><dd className="text-ink">{fmtDate(open.createdAt, true)}</dd>
              </dl>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
