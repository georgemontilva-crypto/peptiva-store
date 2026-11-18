import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useCart } from "../lib/cart";
import { MAIN_NAV, type NavItem } from "../lib/site";
import Logo from "./Logo";

export default function Header() {
  const cart = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname, hash } = useLocation();
  const headerRef = useRef<HTMLElement>(null);
  const [headerH, setHeaderH] = useState(92);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname, hash]);

  useEffect(() => {
    if (menuOpen && headerRef.current) setHeaderH(headerRef.current.getBoundingClientRect().height);
  }, [menuOpen]);

  // Bloquea el scroll de la página mientras el menú móvil está abierto
  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <header ref={headerRef} className="sticky top-0 z-40">
      <div className="border-b border-line bg-white/90 backdrop-blur-md">
        <div className="wrap flex h-16 items-center justify-between gap-4 sm:h-[4.75rem]">
          <Link to="/" aria-label="Peptiva Supplies home" className="shrink-0">
            <Logo className="h-9 sm:h-11" />
          </Link>

          <nav aria-label="Main" className="hidden lg:block">
            <ul className="flex items-center gap-1 text-[0.95rem] font-medium text-ink">
              {MAIN_NAV.map((item) => (
                <li key={item.label}>{item.children ? <Dropdown item={item} /> : <TopLink item={item} />}</li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-1 sm:gap-2">
            <Link
              to="/my-account"
              className="hidden h-10 w-10 items-center justify-center rounded-full text-ink hover:bg-mist sm:flex"
              aria-label="My account"
            >
              <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                <circle cx="12" cy="8" r="3.6" />
                <path d="M4.5 20a7.5 7.5 0 0 1 15 0" strokeLinecap="round" />
              </svg>
            </Link>
            <button
              type="button"
              onClick={cart.open}
              className="relative flex h-10 w-10 items-center justify-center rounded-full text-ink hover:bg-mist"
              aria-label={`Open cart, ${cart.count} items`}
            >
              <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                <path d="M5 7h14l-1.2 11.2A2 2 0 0 1 15.8 20H8.2a2 2 0 0 1-2-1.8L5 7z" />
                <path d="M9 7V6a3 3 0 0 1 6 0v1" />
              </svg>
              <span className="absolute -right-0.5 -top-0.5 min-w-5 rounded-full bg-ink px-1.5 text-center text-[0.7rem] font-semibold leading-5 text-white">
                {cart.count}
              </span>
            </button>
            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center rounded-full text-ink hover:bg-mist lg:hidden"
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                {menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Franja de aviso: obligatoria y además describe el sitio en la primera línea que lee el buscador */}
      <p className="truncate bg-ink px-4 py-1.5 text-center text-[0.72rem] font-light tracking-wide text-white/85 sm:py-2 sm:text-[0.8rem]">
        Research use only. Not for human or veterinary use.<span className="hidden sm:inline"> Free U.S. shipping on every order.</span>
      </p>

      {menuOpen ? <MobileMenu top={headerH} onClose={() => setMenuOpen(false)} /> : null}
    </header>
  );
}

/** Menú de teléfono: panel a pantalla completa bajo la barra, con grupos desplegables y accesos rápidos. */
function MobileMenu({ onClose, top }: { onClose: () => void; top: number }) {
  const { pathname } = useLocation();
  const [openGroup, setOpenGroup] = useState<string | null>(() => MAIN_NAV.find((i) => i.children?.some((c) => c.to.split("#")[0] === pathname))?.label ?? null);

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 lg:hidden" style={{ top }}>
      <button type="button" aria-label="Close menu" className="absolute inset-0 bg-ink/30" onClick={onClose} />
      <nav id="mobile-menu" aria-label="Mobile" className="mobile-menu-enter safe-bottom relative flex max-h-full flex-col overflow-y-auto rounded-b-3xl bg-white px-5 pb-6 pt-2 shadow-2xl">
        {MAIN_NAV.map((item) =>
          item.children ? (
            <div key={item.label} className="border-b border-line">
              <button
                type="button"
                onClick={() => setOpenGroup((g) => (g === item.label ? null : item.label))}
                aria-expanded={openGroup === item.label}
                className="flex min-h-14 w-full items-center justify-between text-left text-lg font-medium text-ink"
              >
                {item.label}
                <svg viewBox="0 0 20 20" className={`h-5 w-5 text-muted transition-transform ${openGroup === item.label ? "rotate-180" : ""}`} fill="currentColor" aria-hidden>
                  <path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" />
                </svg>
              </button>
              {openGroup === item.label ? (
                <ul className="menu-pop pb-3">
                  {item.children.map((c) => (
                    <li key={c.to}>
                      <Link to={c.to} className="flex min-h-12 flex-col justify-center rounded-xl px-3 py-2 active:bg-mist">
                        <span className="font-medium text-ink">{c.label}</span>
                        {c.description ? <span className="text-sm text-slate">{c.description}</span> : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : (
            <NavLink key={item.label} to={item.to!} end className="flex min-h-14 items-center border-b border-line text-lg font-medium text-ink">
              {item.label}
            </NavLink>
          ),
        )}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Link to="/shop" className="btn btn-primary">Shop all</Link>
          <Link to="/my-account" className="btn btn-ghost">My account</Link>
        </div>
        <a href="mailto:support@peptivasupplies.com" className="mt-4 text-center text-sm font-medium text-slate">support@peptivasupplies.com</a>
      </nav>
    </div>
  );
}

function TopLink({ item }: { item: NavItem }) {
  return (
    <NavLink to={item.to!} end className={({ isActive }) => `flex items-center gap-1.5 rounded-full px-3.5 py-2 transition-colors ${isActive ? "bg-mist" : "hover:bg-mist"}`}>
      {item.label}
      {item.badge ? <span className="rounded-full bg-teal-soft px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider text-navy">{item.badge}</span> : null}
    </NavLink>
  );
}

function Dropdown({ item }: { item: NavItem }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);
  const { pathname, hash } = useLocation();
  const active = item.children!.some((c) => c.to.split("#")[0] === pathname);

  useEffect(() => {
    setOpen(false);
  }, [pathname, hash]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const id = `menu-${item.label.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={() => {
        window.clearTimeout(closeTimer.current);
        setOpen(true);
      }}
      onMouseLeave={() => {
        closeTimer.current = window.setTimeout(() => setOpen(false), 150);
      }}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={(e) => {
          // Con mouse el menú ya se abrió al pasar por encima: el clic no debe cerrarlo.
          // Con teclado (detail === 0) o pantalla táctil, el clic abre/cierra.
          const hoverMouse = e.detail > 0 && window.matchMedia("(hover: hover)").matches;
          setOpen((v) => (hoverMouse ? true : !v));
        }}
        className={`flex items-center gap-1 rounded-full px-3.5 py-2 transition-colors ${active || open ? "bg-mist" : "hover:bg-mist"}`}
      >
        {item.label}
        <svg viewBox="0 0 20 20" className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} fill="currentColor" aria-hidden>
          <path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" />
        </svg>
      </button>
      {open ? (
        <div id={id} className="absolute left-1/2 top-full z-50 w-72 -translate-x-1/2 pt-2">
          <div className="menu-pop">
            <ul className="rounded-2xl border border-line bg-white p-2 shadow-[0_24px_48px_-20px_rgba(15,22,33,0.28)]">
              {item.children!.map((c) => (
                <li key={c.to}>
                  <Link to={c.to} className="block rounded-xl px-3.5 py-2.5 hover:bg-mist focus-visible:bg-mist">
                    <span className="block font-medium text-ink">{c.label}</span>
                    {c.description ? <span className="block text-sm font-light text-slate">{c.description}</span> : null}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
