import { useState } from "react";
import { trpc } from "../lib/trpc";
import { Button, Notice } from "./ui";

/**
 * Estado de los archivos que venían del WordPress anterior (sobre todo los PDF de los certificados).
 *
 * La tienda los copia sola al arrancar. Aquí se ve si queda algo por traer, qué no se pudo descargar
 * y, con `showSaved`, la confirmación de lo que ya está guardado, incluidos los certificados antiguos
 * que no están asociados a ningún lote.
 */
export default function LegacyFiles({ showSaved = false }: { showSaved?: boolean }) {
  const utils = trpc.useUtils();
  const status = trpc.admin.media.legacyStatus.useQuery();
  const batch = trpc.admin.media.importLegacy.useMutation();
  const sync = trpc.admin.media.syncLegacy.useMutation();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const d = status.data;
  if (!d) return null;
  const total = d.images + d.pdfs;

  const start = async () => {
    const skip: string[] = [];
    let done = 0;
    setProgress({ done: 0, total });
    try {
      while (total) {
        const r = await batch.mutateAsync({ skip });
        done += r.imported;
        for (const f of r.failed) skip.push(f.url);
        setProgress({ done, total });
        if (r.remaining <= 0) break;
      }
      await sync.mutateAsync();
    } finally {
      setProgress(null);
      await Promise.all([utils.admin.media.invalidate(), utils.admin.products.invalidate(), utils.admin.coas.invalidate(), utils.catalog.invalidate(), utils.content.invalidate()]);
    }
  };

  const path = (url: string) => url.replace(/^https?:\/\/[^/]+\/wp-content\/uploads\//, "");
  const what = [d.images ? `${d.images} photo${d.images === 1 ? "" : "s"}` : null, d.pdfs ? `${d.pdfs} lab report PDF${d.pdfs === 1 ? "" : "s"}` : null].filter(Boolean).join(" and ");

  return (
    <>
      {total || d.failed.length ? (
        <Notice tone={total ? "amber" : "red"}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-3xl">
              {total ? (
                <><strong>{what}</strong> still load from the old WordPress site. The store copies them by itself every time it starts; they must be here before that site is removed.</>
              ) : (
                <><strong>{d.failed.length} file{d.failed.length === 1 ? "" : "s"}</strong> from the old WordPress site could not be downloaded.</>
              )}
            </p>
            <Button disabled={Boolean(progress)} onClick={() => void start()}>{progress ? (total ? `Copying… ${progress.done} of ${progress.total}` : "Copying…") : "Copy them now"}</Button>
          </div>
          {d.failed.length ? (
            <ul className="mt-3 list-disc space-y-0.5 pl-5 text-xs">{d.failed.map((f) => <li key={f.url}><span className="break-all font-mono">{path(f.url)}</span> — {f.reason}</li>)}</ul>
          ) : null}
        </Notice>
      ) : null}

      {showSaved && d.saved && !total && !d.failed.length ? (
        <Notice tone="green">
          <p><strong>{d.saved} file{d.saved === 1 ? "" : "s"} from the old site are stored in this store.</strong> Nothing loads from WordPress any more.</p>
          {d.unlinked.length ? (
            <details className="mt-2">
              <summary className="cursor-pointer font-medium">{d.unlinked.length} saved certificate{d.unlinked.length === 1 ? " is" : "s are"} not attached to any lot (other versions, kept as a backup)</summary>
              <ul className="mt-2 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">{d.unlinked.map((u) => <li key={u.url}><a href={u.url} target="_blank" rel="noreferrer" className="break-all font-mono underline">{u.name}</a></li>)}</ul>
            </details>
          ) : null}
        </Notice>
      ) : null}
    </>
  );
}
