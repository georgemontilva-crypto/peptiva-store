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
      <p className="truncate bg-black px-4 py-1.5 text-center text-[0.72rem] text-white/85 sm:py-2 sm:text-[0.8rem]">
        Research use only. Not for human or veterinary use.<span className="hidden sm:inline"> Free U.S. shipping on every order.</span>
      </p>
      <div className="border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:h-[4.5rem] sm:gap-6 sm:px-5">
          <Link to="/" aria-label="Peptiva Supplies home" className="shrink-0">
            <Logo className="h-9 sm:h-12" />
          </Link>

          <nav aria-label="Main" className="hidden lg:block">
            <ul className="flex items-center gap-1 text-[0.95rem] font-semibold text-slate">
              {MAIN_NAV.map((item) => (
                <li key={item.label}>{item.children ? <Dropdown item={item} /> : <TopLink item={item} />}</li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={cart.open}
              className="relative flex h-11 w-11 items-center justify-center gap-2 rounded-full border border-line text-sm font-semibold text-navy hover:border-navy sm:h-10 sm:w-auto sm:px-4"
              aria-label={`Open cart, ${cart.count} items`}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                <path d="M5 7h14l-1.2 11.2A2 2 0 0 1 15.8 20H8.2a2 2 0 0 1-2-1.8L5 7z" />
                <path d="M9 7V6a3 3 0 0 1 6 0v1" />
              </svg>
              <span className="hidden sm:inline">Cart</span>
              {cart.count > 0 ? (
                <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-teal px-1.5 text-center text-xs font-bold leading-5 text-white sm:static sm:min-w-0">{cart.count}</span>
              ) : null}
            </button>
            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-line text-navy lg:hidden"
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
      <button type="button" aria-label="Close menu" className="absolute inset-0 bg-navy-deep/30" onClick={onClose} />
      <nav id="mobile-menu" aria-label="Mobile" className="mobile-menu-enter safe-bottom relative flex max-h-full flex-col overflow-y-auto rounded-b-3xl bg-white px-4 pb-6 pt-2 shadow-2xl">
        {MAIN_NAV.map((item) =>
          item.children ? (
            <div key={item.label} className="border-b border-line">
              <button
                type="button"
                onClick={() => setOpenGroup((g) => (g === item.label ? null : item.label))}
                aria-expanded={openGroup === item.label}
                className="flex min-h-14 w-full items-center justify-between text-left text-lg font-semibold text-ink"
              >
                {item.label}
                <svg viewBox="0 0 20 20" className={`h-5 w-5 text-slate transition-transform ${openGroup === item.label ? "rotate-180" : ""}`} fill="currentColor" aria-hidden>
                  <path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" />
                </svg>
              </button>
              {openGroup === item.label ? (
                <ul className="menu-pop pb-3">
                  {item.children.map((c) => (
                    <li key={c.to}>
                      <Link to={c.to} className="flex min-h-12 flex-col justify-center rounded-xl px-3 py-2 active:bg-mist">
                        <span className="font-semibold text-ink">{c.label}</span>
                        {c.description ? <span className="text-sm text-slate">{c.description}</span> : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : (
            <NavLink key={item.label} to={item.to!} end className={({ isActive }) => `flex min-h-14 items-center border-b border-line text-lg font-semibold ${isActive ? "text-navy" : "text-ink"}`}>
              {item.label}
            </NavLink>
          ),
        )}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Link to="/shop" className="btn btn-primary">Shop all</Link>
          <Link to="/track-order" className="btn btn-ghost">Track order</Link>
        </div>
        <a href="mailto:support@peptivasupplies.com" className="mt-4 text-center text-sm font-semibold text-slate">support@peptivasupplies.com</a>
      </nav>
    </div>
  );
}

function TopLink({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to!}
      end
      className={({ isActive }) => `block rounded-full px-3.5 py-2 ${isActive ? "text-navy" : "hover:bg-mist hover:text-navy"}`}
    >
      {item.label}
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
        className={`flex items-center gap-1 rounded-full px-3.5 py-2 ${active || open ? "text-navy" : "hover:bg-mist hover:text-navy"} ${open ? "bg-mist" : ""}`}
      >
        {item.label}
        <svg viewBox="0 0 20 20" className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} fill="currentColor" aria-hidden>
          <path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" />
        </svg>
      </button>
      {open ? (
        <div id={id} className="absolute left-1/2 top-full z-50 w-72 -translate-x-1/2 pt-2">
          <div className="menu-pop">
          <ul className="rounded-2xl border border-line bg-white p-2 shadow-[0_24px_48px_-20px_rgba(11,39,66,0.35)]">
            {item.children!.map((c) => (
              <li key={c.to}>
                <Link to={c.to} className="block rounded-xl px-3.5 py-2.5 hover:bg-mist focus-visible:bg-mist">
                  <span className="block font-semibold text-ink">{c.label}</span>
                  {c.description ? <span className="block text-sm font-normal text-slate">{c.description}</span> : null}
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
