import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { trpc } from "../lib/trpc";
import Logo from "./Logo";

const KEY = "peptiva.researcher.v1";

/** Confirmación de edad y uso de investigación (reemplaza el plugin peptiva-age). */
export default function AgeGate() {
  const [show, setShow] = useState(false);
  const [email, setEmail] = useState("");
  const subscribe = trpc.content.subscribe.useMutation();

  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) !== "yes") setShow(true);
    } catch {
      setShow(true);
    }
  }, []);

  useEffect(() => {
    document.body.style.overflow = show ? "hidden" : "";
  }, [show]);

  if (!show) return null;

  const accept = () => {
    if (email.includes("@")) subscribe.mutate({ email, source: "age_gate" });
    try {
      localStorage.setItem(KEY, "yes");
    } catch {
      /* ignorar */
    }
    setShow(false);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-navy-deep/85 p-4 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby="gate-title" className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl">
        <Logo variant="stacked" className="mx-auto h-24" />
        <h2 id="gate-title" className="mt-6 text-2xl font-bold">Confirm researcher access</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate">
          Peptiva Supplies sells compounds strictly for laboratory research. By entering, you confirm that you are 18 or older and that
          any purchase will be used only for in-vitro research, never for human or animal consumption.
        </p>
        <label htmlFor="gate-email" className="label mt-6">Email for restock alerts <span className="font-normal text-muted">(optional)</span></label>
        <input id="gate-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="field" placeholder="you@lab.com" />
        <button type="button" className="btn btn-primary mt-6 w-full" onClick={accept}>
          I'm 18+ and agree to research use only
        </button>
        <a href="https://www.google.com" className="mt-3 block text-center text-sm font-semibold text-slate hover:text-navy">Leave site</a>
        <p className="mt-5 text-center text-xs text-muted">
          See our <Link to="/terms-conditions" onClick={accept} className="underline">terms & conditions</Link>.
        </p>
      </div>
    </div>
  );
}
