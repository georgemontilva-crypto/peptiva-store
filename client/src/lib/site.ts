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

export type NavItem = { label: string; to?: string; children?: { to: string; label: string; description?: string }[] };

/** Menú principal: mismo orden que el sitio de WordPress. */
export const MAIN_NAV: NavItem[] = [
  { label: "Home", to: "/" },
  { label: "Contact", to: "/contact" },
  { label: "COAs", to: "/coas" },
  {
    label: "More",
    children: [
      { to: "/shop", label: "Shop", description: "All research peptides" },
      { to: "/about-us", label: "About Us", description: "Our standards and mission" },
      { to: "/faq", label: "FAQ", description: "Purity, shipping and storage" },
    ],
  },
  {
    label: "User",
    children: [
      { to: "/track-order", label: "Track order", description: "Status and tracking number" },
      { to: "/my-account", label: "My account", description: "Orders and account details" },
    ],
  },
  {
    label: "Affiliate Program",
    children: [
      { to: "/affiliate", label: "Affiliate Program", description: "Earn 10% on referred sales" },
      { to: "/affiliate#apply", label: "Apply to join", description: "Send your application" },
      { to: "/affiliate-account", label: "Affiliate login", description: "Your link, clicks and commissions" },
    ],
  },
];

export const COMPANY_LINKS = [
  { to: "/about-us", label: "About Us" },
  { to: "/faq", label: "FAQ" },
  { to: "/contact", label: "Contact" },
  { to: "/affiliate", label: "Affiliate Program" },
];
