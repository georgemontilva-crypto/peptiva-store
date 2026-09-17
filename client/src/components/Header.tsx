import { Link, NavLink } from "react-router-dom";

const nav = [
  { to: "/shop", label: "Shop" },
  { to: "/shop?category=research-peptides", label: "Research peptides" },
  { to: "/shop?category=bundle-save", label: "Bundle & save" },
];

export default function Header() {
  return (
    <header className="sticky top-0 z-40">
      <p className="bg-navy-deep px-4 py-2 text-center text-xs text-white/85">
        For laboratory research use only. Not for human or veterinary use.
      </p>
      <div className="border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-5">
          <Link to="/" className="font-display text-xl font-bold tracking-tight text-navy">
            Peptiva<span className="font-normal text-teal"> Supplies</span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm font-semibold text-slate sm:flex">
            {nav.map((n) => (
              <NavLink key={n.to} to={n.to} className="hover:text-navy">
                {n.label}
              </NavLink>
            ))}
          </nav>
          <Link to="/shop" className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-deep sm:hidden">
            Shop
          </Link>
        </div>
      </div>
    </header>
  );
}
