import { useEffect, useRef, useState } from "react";
import Logo from "./Logo";

const KEY = "peptiva.researcher.v1";
const EXIT_URL = "https://www.google.com";

/**
 * Verificación de investigador al entrar (mismo texto y condiciones que el gate del sitio en WordPress):
 * dos confirmaciones obligatorias, 21+ y uso de laboratorio.
 *
 * El cuadro solo pide la verificación. El registro opcional por correo vive en el pie de página, donde
 * no compite con lo único que hay que hacer aquí.
 *
 * Mientras está abierto el foco del teclado se queda dentro: al abrirse pasa a la primera casilla y el
 * tabulador circula entre los elementos del cuadro, sin bajar a los enlaces de la página que hay detrás.
 */
export default function AgeGate() {
  const [show, setShow] = useState(false);
  const [age, setAge] = useState(false);
  const [research, setResearch] = useState(false);
  const [entering, setEntering] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) !== "yes") setShow(true);
    } catch {
      setShow(true);
    }
  }, []);

  useEffect(() => {
    if (!show) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusables = () =>
      Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? [],
      ).filter((el) => el.offsetParent !== null);

    focusables()[0]?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const items = focusables();
      if (!items.length) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement as HTMLElement | null;
      if (!dialogRef.current?.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey, true);
    };
  }, [show]);

  if (!show) return null;

  const enter = () => {
    if (!age || !research) return;
    setEntering(true);
    try {
      localStorage.setItem(KEY, "yes");
    } catch {
      /* ignorar */
    }
    setShow(false);
  };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center overflow-y-auto bg-white px-4 py-10">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="gate-title" aria-describedby="gate-intro" className="w-full max-w-[460px] rounded-[26px] border border-line bg-white p-6 text-center shadow-[0_40px_90px_rgba(11,39,66,0.18)] sm:p-10">
        <Logo variant="stacked" className="mx-auto h-20" />
        <p className="mt-3 text-xs font-bold uppercase tracking-[0.18em] text-teal">Premium Research Peptides</p>
        <h1 id="gate-title" className="mt-4 text-2xl font-bold tracking-tight sm:text-[1.75rem]">Researcher Verification</h1>
        <p id="gate-intro" className="mt-2.5 text-sm leading-relaxed text-slate">
          Peptiva supplies research peptides exclusively to qualified researchers and laboratories for in-vitro and laboratory use.
        </p>

        <div className="mt-6 flex flex-col gap-3 text-left">
          <label className="flex cursor-pointer items-start gap-3 rounded-[13px] border border-line bg-navy/[0.03] p-3.5 text-[0.85rem] leading-snug text-ink transition-colors hover:border-teal/40">
            <input type="checkbox" checked={age} onChange={(e) => setAge(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 rounded-md accent-teal" />
            <span>I confirm I am <strong className="font-bold">21 years of age or older</strong>.</span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-[13px] border border-line bg-navy/[0.03] p-3.5 text-[0.85rem] leading-snug text-ink transition-colors hover:border-teal/40">
            <input type="checkbox" checked={research} onChange={(e) => setResearch(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 rounded-md accent-teal" />
            <span>I am a qualified researcher and will use all products strictly for <strong className="font-bold">laboratory research — not for human consumption</strong>.</span>
          </label>
        </div>

        <button
          type="button"
          onClick={enter}
          disabled={!age || !research || entering}
          className="mt-5 h-13 w-full rounded-full bg-gradient-to-br from-teal to-navy py-4 font-bold text-white transition-[filter] hover:brightness-110 disabled:cursor-not-allowed disabled:bg-none disabled:bg-slate-200 disabled:text-muted"
        >
          {entering ? "One moment…" : "Enter Peptiva"}
        </button>

        <p className="mt-4 text-[0.8rem] text-slate">
          Not a researcher? <a href={EXIT_URL} className="underline underline-offset-2">Exit</a>
        </p>
      </div>

      <p className="mt-5 max-w-[460px] text-center text-[0.7rem] leading-relaxed text-muted">
        These statements have not been evaluated by the FDA. Products are not intended to diagnose, treat, cure, or prevent any disease and are sold for research use only.
      </p>
    </div>
  );
}
