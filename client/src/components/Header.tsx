import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useCart } from "../lib/cart";
import { MAIN_NAV, type NavItem } from "../lib/site";
import Logo from "./Logo";

export default function Header() {
  const cart = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname, hash } = useLocation();

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname, hash]);

  return (
    <header className="sticky top-0 z-40">
      <p className="bg-black px-4 py-2 text-center text-[0.8rem] text-white/85">
        Research use only. Not for human or veterinary use. <span className="hidden sm:inline">Free U.S. shipping on every order.</span>
      </p>
      <div className="border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-[4.5rem] max-w-6xl items-center justify-between gap-6 px-5">
          <Link to="/" aria-label="Peptiva Supplies home" className="shrink-0">
            <Logo className="h-10 sm:h-12" />
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
              className="relative flex h-10 items-center gap-2 rounded-full border border-line px-4 text-sm font-semibold text-navy hover:border-navy"
              aria-label={`Open cart, ${cart.count} items`}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                <path d="M5 7h14l-1.2 11.2A2 2 0 0 1 15.8 20H8.2a2 2 0 0 1-2-1.8L5 7z" />
                <path d="M9 7V6a3 3 0 0 1 6 0v1" />
              </svg>
              Cart
              {cart.count > 0 ? <span className="rounded-full bg-teal px-1.5 text-xs font-bold leading-5 text-white">{cart.count}</span> : null}
            </button>
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-navy lg:hidden"
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                {menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
              </svg>
            </button>
          </div>
        </div>

        {menuOpen ? (
          <nav id="mobile-menu" aria-label="Mobile" className="max-h-[calc(100vh-6rem)] overflow-y-auto border-t border-line px-5 pb-6 lg:hidden">
            {MAIN_NAV.map((item) =>
              item.children ? (
                <div key={item.label} className="border-b border-line py-3">
                  <p className="py-1 text-xs font-semibold text-muted">{item.label}</p>
                  {item.children.map((c) => (
                    <Link key={c.to} to={c.to} className="block py-2 pl-3 font-semibold text-ink">{c.label}</Link>
                  ))}
                </div>
              ) : (
                <NavLink key={item.label} to={item.to!} end className="block border-b border-line py-3.5 font-semibold text-ink">
                  {item.label}
                </NavLink>
              ),
            )}
          </nav>
        ) : null}
      </div>
    </header>
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
      ) : null}
    </div>
  );
}
