import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/** Texto largo recortado con degradado y botón "Show more" / "Show less". */
export default function Collapsible({ children, collapsedHeight = 260 }: { children: ReactNode; collapsedHeight?: number }) {
  const [open, setOpen] = useState(false);
  const [fullHeight, setFullHeight] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setFullHeight(el.scrollHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const needed = fullHeight > collapsedHeight + 60;

  const toggle = () => {
    if (open && wrapper.current) {
      // Al cerrar, volver al inicio de la sección si quedó arriba de la pantalla
      const top = wrapper.current.getBoundingClientRect().top;
      if (top < 0) window.scrollBy({ top: top - 140 });
    }
    setOpen((v) => !v);
  };

  return (
    <div ref={wrapper}>
      <div
        id={id}
        className="relative overflow-hidden transition-[max-height] duration-500 ease-in-out"
        style={{ maxHeight: !needed ? undefined : open ? fullHeight + 40 : collapsedHeight }}
      >
        <div ref={ref}>{children}</div>
        {needed && !open ? <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-white via-white/80 to-transparent" aria-hidden /> : null}
      </div>
      {needed ? (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={toggle}
          className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl border-2 border-ink px-5 text-sm font-bold uppercase tracking-wide text-ink transition-colors hover:bg-ink hover:text-white"
        >
          {open ? "Show less" : "Show more"}
          <svg viewBox="0 0 20 20" className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} fill="currentColor" aria-hidden>
            <path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}
