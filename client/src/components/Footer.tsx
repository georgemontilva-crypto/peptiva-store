import { Link } from "react-router-dom";
import { COMPANY_LINKS, POLICY_LINKS, SUPPORT_EMAIL } from "../lib/site";
import Logo from "./Logo";

export default function Footer() {
  return (
    <footer className="mt-28 bg-navy-deep text-white/70">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-6 gap-y-10 px-5 py-12 sm:py-16 md:grid-cols-[1.6fr_1fr_1fr_1fr] md:gap-12">
        <div className="col-span-2 md:col-span-1">
          <Logo variant="stacked" className="h-28" />
          <p className="mt-4 max-w-xs text-sm leading-relaxed">
            Research peptides with third-party purity testing, shipped from the United States.
          </p>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="mt-5 inline-block text-sm font-semibold text-white hover:text-teal">
            {SUPPORT_EMAIL}
          </a>
        </div>
        <FooterColumn title="Store" links={[{ to: "/shop", label: "All products" }, { to: "/shop?category=bundle-save", label: "Bundle & save" }, { to: "/coas", label: "Lab results" }]} />
        <FooterColumn title="Company" links={COMPANY_LINKS} />
        <FooterColumn title="Policies" links={POLICY_LINKS} className="col-span-2 sm:col-span-1" />
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-6xl px-5 py-6 text-xs leading-relaxed text-white/45">
          © {new Date().getFullYear()} Peptiva Supplies. All products are sold strictly for in-vitro laboratory research. They are not
          drugs, foods, supplements or cosmetics, have not been evaluated by the FDA, and must not be used on humans or animals.
        </p>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links, className = "" }: { title: string; links: { to: string; label: string }[]; className?: string }) {
  return (
    <div className={`text-sm ${className}`}>
      <p className="mb-4 font-display font-medium text-white">{title}</p>
      <ul className="space-y-2.5">
        {links.map((l) => (
          <li key={l.to}>
            <Link to={l.to} className="inline-block py-1 hover:text-white">{l.label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
