import { useEffect } from "react";

/**
 * Hace aparecer con suavidad los elementos marcados con data-reveal al entrar en pantalla.
 * Vigila también el contenido que llega después (datos cargados, cambio de página).
 */
export default function RevealManager() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    document.documentElement.classList.add("js-reveal");

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-visible");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    const scan = () => document.querySelectorAll("[data-reveal]:not(.is-visible)").forEach((el) => io.observe(el));
    scan();
    const mo = new MutationObserver(scan);
    mo.observe(document.body, { childList: true, subtree: true });
    // Red de seguridad: nada queda oculto si el observador falla
    const failsafe = window.setInterval(() => {
      document.querySelectorAll("[data-reveal]:not(.is-visible)").forEach((el) => {
        if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add("is-visible");
      });
    }, 1500);

    return () => {
      io.disconnect();
      mo.disconnect();
      window.clearInterval(failsafe);
      document.documentElement.classList.remove("js-reveal");
    };
  }, []);
  return null;
}
