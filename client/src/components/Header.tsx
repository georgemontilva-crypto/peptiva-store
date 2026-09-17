import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useCart } from "../lib/cart";
import { MAIN_NAV } from "../lib/site";
import Logo from "./Logo";

export default function Header() {
  const cart = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setMenuOpen(false), [pathname]);

  return (
    <header className="sticky top-0 z-40">
      <p className="bg-black px-4 py-2 text-center text-[0.8rem] text-white/85">
        Research use only. Not for human or veterinary use. <span className="hidden sm:inline">Free U.S. shipping on every order.</span>
      </p>
      <div className="border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-5">
          <Link to="/" aria-label="Peptiva Supplies home">
            <Logo />
          </Link>

          <nav aria-label="Main" className="hidden items-center gap-8 text-[0.95rem] font-semibold text-slate md:flex">
            {MAIN_NAV.map((n) => (
              <NavLink key={n.to} to={n.to} className={({ isActive }) => (isActive ? "text-navy" : "hover:text-navy")}>
                {n.label}
              </NavLink>
            ))}
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
              {cart.count > 0 ? (
                <span className="rounded-full bg-teal px-1.5 text-xs font-bold leading-5 text-white">{cart.count}</span>
              ) : null}
            </button>
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-navy md:hidden"
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
          <nav id="mobile-menu" aria-label="Mobile" className="border-t border-line px-5 pb-5 md:hidden">
            {MAIN_NAV.map((n) => (
              <NavLink key={n.to} to={n.to} className="block border-b border-line py-3.5 font-semibold text-ink">
                {n.label}
              </NavLink>
            ))}
          </nav>
        ) : null}
      </div>
    </header>
  );
}
