export const HERO_VIALS = [
  "/media/wp/2026/08/ps1.png",
  "/media/wp/2026/08/ps2.png",
  "/media/wp/2026/08/ps3.png",
];

export const SUPPORT_EMAIL = "support@peptivasupplies.com";

export const POLICY_LINKS = [
  { to: "/shipping-policy", label: "Shipping policy" },
  { to: "/return-refund", label: "Returns & refunds" },
  { to: "/terms-conditions", label: "Terms & conditions" },
  { to: "/privacy-policy", label: "Privacy policy" },
];

export type NavItem = { label: string; to?: string; badge?: string; children?: { to: string; label: string; description?: string }[] };

/**
 * Menú principal. Los enlaces describen lo que hay detrás ("Research Peptides" en vez de "Shop"),
 * que es lo que lee el buscador y lo que busca un laboratorio.
 */
export const MAIN_NAV: NavItem[] = [
  { label: "Research Peptides", to: "/shop" },
  { label: "Bundle Pricing", to: "/shop?category=bundle-save", badge: "Save" },
  { label: "COAs", to: "/coas" },
  { label: "Contact us", to: "/contact" },
  {
    label: "More",
    children: [
      { to: "/about-us", label: "About Us", description: "Our standards and sourcing" },
      { to: "/faq", label: "FAQ", description: "Purity, shipping and storage" },
      { to: "/track-order", label: "Track order", description: "Status and tracking number" },
      { to: "/affiliate", label: "Affiliate Program", description: "Earn on referred research orders" },
    ],
  },
];

export const COMPANY_LINKS = [
  { to: "/about-us", label: "About Us" },
  { to: "/faq", label: "FAQ" },
  { to: "/contact", label: "Contact" },
  { to: "/affiliate", label: "Affiliate Program" },
];
