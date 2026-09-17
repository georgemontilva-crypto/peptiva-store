import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/** Texto largo recortado con degradado y botón "Show more". */
export default function Collapsible({ children, collapsedHeight = 220 }: { children: ReactNode; collapsedHeight?: number }) {
  const [open, setOpen] = useState(false);
  const [needed, setNeeded] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (ref.current) setNeeded(ref.current.scrollHeight > collapsedHeight + 40);
  }, [children, collapsedHeight]);

  return (
    <div>
      <div
        id={id}
        ref={ref}
        className="relative overflow-hidden transition-[max-height] duration-500"
        style={{ maxHeight: open || !needed ? ref.current?.scrollHeight ?? 99999 : collapsedHeight }}
      >
        {children}
        {!open && needed ? <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white to-transparent" aria-hidden /> : null}
      </div>
      {needed ? (
        <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((v) => !v)} className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl border-2 border-ink px-5 text-sm font-bold uppercase tracking-wide text-ink hover:bg-ink hover:text-white">
          {open ? "Show less ↑" : "Show more ↓"}
        </button>
      ) : null}
    </div>
  );
}
