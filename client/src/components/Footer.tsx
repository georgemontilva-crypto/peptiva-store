import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="mt-24 bg-navy-deep text-white/75">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:grid-cols-[2fr_1fr_1fr]">
        <div>
          <p className="font-display text-lg font-bold text-white">Peptiva Supplies</p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed">
            All products are sold strictly for in-vitro laboratory research. They are not drugs, foods or cosmetics and
            must not be used on humans or animals.
          </p>
        </div>
        <div className="text-sm">
          <p className="mb-3 font-semibold text-white">Shop</p>
          <ul className="space-y-2">
            <li><Link to="/shop" className="hover:text-white">All products</Link></li>
            <li><Link to="/shop?category=research-peptides" className="hover:text-white">Research peptides</Link></li>
            <li><Link to="/shop?category=bundle-save" className="hover:text-white">Bundle & save</Link></li>
          </ul>
        </div>
        <div className="text-sm">
          <p className="mb-3 font-semibold text-white">Support</p>
          <ul className="space-y-2">
            <li><a href="mailto:support@peptivasupplies.com" className="hover:text-white">support@peptivasupplies.com</a></li>
          </ul>
        </div>
      </div>
      <p className="border-t border-white/10 px-5 py-5 text-center text-xs text-white/50">
        © {new Date().getFullYear()} Peptiva Supplies
      </p>
    </footer>
  );
}
