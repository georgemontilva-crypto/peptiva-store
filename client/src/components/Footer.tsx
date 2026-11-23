import { Link } from "react-router-dom";
import { SUPPORT_EMAIL } from "../lib/site";
import Logo from "./Logo";

const COLUMNS: { title: string; links: { to: string; label: string }[] }[] = [
  {
    title: "Catalog",
    links: [
      { to: "/shop", label: "All Research Peptides" },
      { to: "/shop?category=bundle-save", label: "Bundle Pricing" },
      { to: "/coas", label: "Certificates of Analysis" },
    ],
  },
  {
    title: "Resources",
    links: [
      { to: "/blog", label: "Research Guides" },
      { to: "/about-us", label: "About Us" },
      { to: "/faq", label: "FAQ" },
      { to: "/affiliate", label: "Affiliate Program" },
    ],
  },
  {
    title: "Support",
    links: [
      { to: "/contact", label: "Contact Us" },
      { to: "/track-order", label: "Track your order" },
      { to: "/shipping-policy", label: "Shipping Info" },
      { to: "/return-refund", label: "Returns & Refunds" },
    ],
  },
  {
    title: "Legal",
    links: [
      { to: "/privacy-policy", label: "Privacy Policy" },
      { to: "/terms-conditions", label: "Terms of Service" },
      { to: "/faq", label: "Research Use Only" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="bg-ink text-white/65">
      <div className="wrap grid grid-cols-2 gap-x-6 gap-y-10 py-14 sm:py-16 md:grid-cols-[1.5fr_1fr_1fr_1fr_1fr] md:gap-10">
        <div className="col-span-2 md:col-span-1">
          <Logo variant="stacked" className="h-24" />
          <p className="mt-5 max-w-xs text-sm font-light leading-relaxed">
            Research peptides for controlled laboratory research. Third-party tested, with a Certificate of Analysis published for every
            lot.
          </p>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="mt-5 inline-block text-sm font-medium text-white hover:text-teal">
            {SUPPORT_EMAIL}
          </a>
        </div>
        {COLUMNS.map((c) => (
          <div key={c.title} className="text-sm">
            <p className="mb-4 font-medium text-white">{c.title}</p>
            <ul className="space-y-2.5 font-light">
              {c.links.map((l) => (
                <li key={l.label}>
                  <Link to={l.to} className="inline-block py-1 hover:text-white">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Aviso FDA completo: requisito legal y además texto que el buscador asocia al sector */}
      <div className="border-t border-white/10">
        <div className="wrap py-10">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/50">FDA Disclaimer</p>
          <p className="mt-3 max-w-4xl text-xs font-light leading-relaxed text-white/50">
            Statements made regarding these products have <strong className="font-medium text-white/75">not been evaluated by the U.S. Food
            and Drug Administration</strong>. These products are <strong className="font-medium text-white/75">not intended to diagnose,
            treat, cure, or prevent any disease</strong>. Product information on this website is provided for laboratory research purposes
            only. All products are sold strictly for laboratory research use by qualified professionals and are{" "}
            <strong className="font-medium text-white/75">not for human, veterinary, or food use in any form</strong>. Information presented
            on this website is not a substitute for, or alternative to, information from a qualified health care practitioner. This notice is
            required under the Federal Food, Drug, and Cosmetic Act.
          </p>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="wrap flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-white/45">© {new Date().getFullYear()} Peptiva Supplies. All rights reserved.</p>
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-white/45">
            <li>SSL Secured</li>
            <li>99%+ HPLC Purity</li>
            <li>COA with every lot</li>
            <li>Ships from the U.S.</li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
