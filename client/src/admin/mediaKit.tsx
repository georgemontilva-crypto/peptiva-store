import { useCallback, useRef, useState, type ReactNode } from "react";
import { trpc } from "../lib/trpc";
import { Button, Modal, Notice, inputCls } from "./ui";

/**
 * Subida de imágenes y selector de la biblioteca, compartidos por blog, productos y el editor.
 *
 * Antes de subir, la imagen se reduce a un máximo de 2000 px y se recodifica en WebP dentro del
 * propio navegador. Una foto de cámara de 6 MB baja a unos cientos de KB sin diferencia visible, y
 * como las imágenes viven en la base de datos, cada MB ahorrado cuenta.
 */
const MAX_SIDE = 2000;
const QUALITY = 0.86;

export type UploadedImage = { id: number; url: string; filename: string; size: number };

const fmtBytes = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
export { fmtBytes };

async function prepare(file: File): Promise<{ blob: Blob; name: string; width: number | null; height: number | null }> {
  // Los GIF se suben tal cual: recodificarlos los dejaría sin animación
  if (file.type === "image/gif") return { blob: file, name: file.name, width: null, height: null };
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return { blob: file, name: file.name, width: null, height: null };
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { blob: file, name: file.name, width: bitmap.width, height: bitmap.height };
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const webp = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", QUALITY));
  // Si recodificar no ahorra nada y no hubo que reducirla, se queda el original
  if (!webp || (scale === 1 && webp.size >= file.size)) return { blob: file, name: file.name, width, height };
  return { blob: webp, name: file.name.replace(/\.[a-z0-9]+$/i, "") + ".webp", width, height };
}

export async function uploadImage(file: File, alt = ""): Promise<UploadedImage> {
  if (!file.type.startsWith("image/")) throw new Error(`"${file.name}" is not an image.`);
  const { blob, name, width, height } = await prepare(file);
  const res = await fetch("/admin-api/media/upload", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/octet-stream",
      "x-filename": encodeURIComponent(name),
      "x-alt": encodeURIComponent(alt),
      ...(width ? { "x-width": String(width), "x-height": String(height) } : {}),
    },
    body: blob,
  });
  const data = (await res.json().catch(() => null)) as (UploadedImage & { error?: string }) | null;
  if (!res.ok || !data || data.error) throw new Error(data?.error ?? "The image could not be uploaded.");
  return data;
}

/** Zona para soltar o elegir archivos; sube varios seguidos y avisa de cada resultado. */
export function UploadZone({ onUploaded, compact = false }: { onUploaded: (images: UploadedImage[]) => void; compact?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const utils = trpc.useUtils();

  const send = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      setError(null);
      const done: UploadedImage[] = [];
      const failed: string[] = [];
      for (const [i, f] of files.entries()) {
        setBusy(files.length > 1 ? `Uploading ${i + 1} of ${files.length}…` : "Uploading…");
        try {
          done.push(await uploadImage(f));
        } catch (err) {
          failed.push(err instanceof Error ? err.message : String(err));
        }
      }
      setBusy(null);
      if (failed.length) setError(failed.join(" "));
      if (done.length) {
        await utils.admin.media.list.invalidate();
        onUploaded(done);
      }
    },
    [onUploaded, utils],
  );

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void send(Array.from(e.dataTransfer.files));
        }}
        className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed text-center transition-colors ${compact ? "gap-2 px-4 py-5" : "gap-3 px-6 py-9"} ${over ? "border-teal bg-teal-soft/40" : "border-slate-300 bg-mist/50"}`}
      >
        <p className="text-sm text-slate">
          {busy ?? (
            <>
              Drag images here or{" "}
              <button type="button" className="font-semibold text-navy underline" onClick={() => input.current?.click()}>
                choose files
              </button>
            </>
          )}
        </p>
        {!compact && !busy ? <p className="text-xs text-muted">JPG, PNG, WebP or GIF · optimized automatically before upload</p> : null}
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
          multiple
          hidden
          onChange={(e) => {
            void send(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
      </div>
      {error ? <div className="mt-2"><Notice tone="red">{error}</Notice></div> : null}
    </div>
  );
}

/** Ventana para elegir una o varias imágenes de la biblioteca, o subir nuevas sin salir de ella. */
export function MediaPicker({ open, onClose, onPick, multiple = false }: { open: boolean; onClose: () => void; onPick: (urls: { url: string; alt: string | null }[]) => void; multiple?: boolean }) {
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<{ url: string; alt: string | null }[]>([]);
  const q = trpc.admin.media.list.useQuery({ page: 1, pageSize: 60, search: search || undefined }, { enabled: open });

  const close = () => {
    setPicked([]);
    onClose();
  };
  const choose = (item: { url: string; alt: string | null }) => {
    if (!multiple) {
      onPick([item]);
      close();
      return;
    }
    setPicked((p) => (p.some((x) => x.url === item.url) ? p.filter((x) => x.url !== item.url) : [...p, item]));
  };

  return (
    <Modal
      title={multiple ? "Choose images" : "Choose an image"}
      open={open}
      onClose={close}
      wide
      footer={
        multiple ? (
          <>
            <Button variant="ghost" onClick={close}>Cancel</Button>
            <Button disabled={!picked.length} onClick={() => { onPick(picked); close(); }}>Add {picked.length || ""} image{picked.length === 1 ? "" : "s"}</Button>
          </>
        ) : undefined
      }
    >
      <UploadZone
        compact
        onUploaded={(imgs) => {
          const items = imgs.map((i) => ({ url: i.url, alt: null }));
          if (!multiple && items[0]) {
            onPick([items[0]]);
            close();
          } else setPicked((p) => [...p, ...items]);
        }}
      />
      <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search the library" className={`${inputCls} mt-4`} aria-label="Search images" />
      <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
        {q.data?.items.map((m) => {
          const on = picked.some((x) => x.url === m.url);
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => choose({ url: m.url, alt: m.alt })}
              className={`group relative aspect-square overflow-hidden rounded-xl bg-mist ring-2 transition ${on ? "ring-teal" : "ring-transparent hover:ring-navy/40"}`}
              title={m.filename}
            >
              <img src={m.url} alt={m.alt ?? ""} loading="lazy" className="h-full w-full rounded-none object-cover" />
              {on ? <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-teal text-xs font-bold text-white">✓</span> : null}
            </button>
          );
        })}
      </div>
      {q.data && !q.data.items.length ? <p className="py-8 text-center text-sm text-slate">{search ? "No images match that search." : "The library is empty. Upload the first image above."}</p> : null}
      {q.data && q.data.total > q.data.items.length ? <p className="mt-3 text-center text-xs text-muted">Showing the latest {q.data.items.length} of {q.data.total}. Search to find older images.</p> : null}
    </Modal>
  );
}

/** Campo de una sola imagen: vista previa, cambiar, quitar. */
export function ImageField({ label, value, onChange, hint, aspect = "aspect-[4/3]" }: { label: string; value: string | null; onChange: (url: string | null) => void; hint?: ReactNode; aspect?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <span className="mb-1 block text-xs font-semibold text-ink">{label}</span>
      {value ? (
        <div className={`relative overflow-hidden rounded-xl border border-line bg-mist ${aspect}`}>
          <img src={value} alt="" className="h-full w-full rounded-none object-contain" />
          <div className="absolute inset-x-2 bottom-2 flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>Change</Button>
            <Button size="sm" variant="danger" onClick={() => onChange(null)}>Remove</Button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className={`flex w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-300 bg-mist/50 text-sm text-slate hover:border-navy hover:text-navy ${aspect}`}>
          <span className="text-2xl leading-none">+</span>
          Choose or upload an image
        </button>
      )}
      {hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
      <MediaPicker open={open} onClose={() => setOpen(false)} onPick={(items) => onChange(items[0]?.url ?? null)} />
    </div>
  );
}

/** Galería ordenable: añadir varias, reordenar con las flechas, quitar. */
export function GalleryField({ label, value, onChange, hint }: { label: string; value: string[]; onChange: (urls: string[]) => void; hint?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const move = (i: number, d: -1 | 1) => {
    const next = [...value];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(next);
  };
  return (
    <div>
      <span className="mb-1 block text-xs font-semibold text-ink">{label}</span>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {value.map((url, i) => (
          <div key={`${url}-${i}`} className="group relative aspect-square overflow-hidden rounded-lg border border-line bg-mist">
            <img src={url} alt="" className="h-full w-full rounded-none object-cover" />
            <div className="absolute inset-x-1 bottom-1 flex justify-between gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
              <span className="flex gap-1">
                <button type="button" className="rounded bg-white/95 px-1.5 text-xs font-bold shadow disabled:opacity-40" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move earlier">←</button>
                <button type="button" className="rounded bg-white/95 px-1.5 text-xs font-bold shadow disabled:opacity-40" disabled={i === value.length - 1} onClick={() => move(i, 1)} aria-label="Move later">→</button>
              </span>
              <button type="button" className="rounded bg-white/95 px-1.5 text-xs font-bold text-red-700 shadow" onClick={() => onChange(value.filter((_, k) => k !== i))} aria-label="Remove image">✕</button>
            </div>
          </div>
        ))}
        <button type="button" onClick={() => setOpen(true)} className="flex aspect-square flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-mist/50 text-xs text-slate hover:border-navy hover:text-navy">
          <span className="text-xl leading-none">+</span>
          Add
        </button>
      </div>
      {hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
      <MediaPicker open={open} multiple onClose={() => setOpen(false)} onPick={(items) => onChange([...value, ...items.map((i) => i.url).filter((u) => !value.includes(u))])} />
    </div>
  );
}
