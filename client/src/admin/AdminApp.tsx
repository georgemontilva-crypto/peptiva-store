import { useEffect, useState } from "react";
import { Link, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { trpc } from "../lib/trpc";
import Logo from "../components/Logo";
import ErrorBoundary from "../components/ErrorBoundary";
import Login from "./Login";
import Dashboard from "./Dashboard";
import Orders from "./Orders";
import OrderDetail from "./OrderDetail";
import Abandoned from "./Abandoned";
import Coupons from "./Coupons";
import Affiliates from "./Affiliates";
import AffiliateDetail from "./AffiliateDetail";
import Commissions from "./Commissions";
import Inbox from "./Inbox";
import Settings from "./Settings";
import Coas from "./Coas";

const icon = (d: string) => (
  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);

const NAV = [
  { group: "Overview", items: [{ to: "/admin", label: "Dashboard", icon: icon("M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-3H4zM14 4v3h6V4z") }] },
  {
    group: "Sales",
    items: [
      { to: "/admin/orders", label: "Orders & tracking", icon: icon("M3 7l9-4 9 4-9 4-9-4zM3 7v10l9 4 9-4V7M12 11v10") },
      { to: "/admin/abandoned", label: "Abandoned carts", icon: icon("M5 7h14l-1.2 11.2A2 2 0 0 1 15.8 20H8.2a2 2 0 0 1-2-1.8L5 7zM9 7V6a3 3 0 0 1 6 0v1M10 12l4 4M14 12l-4 4") },
      { to: "/admin/coupons", label: "Coupons", icon: icon("M4 8a2 2 0 0 0 2-2h12a2 2 0 0 0 2 2v8a2 2 0 0 0-2 2H6a2 2 0 0 0-2-2zM9 15l6-6M9.5 9.5h.01M14.5 14.5h.01") },
    ],
  },
  {
    group: "Affiliates",
    items: [
      { to: "/admin/affiliates", label: "Affiliates", icon: icon("M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM22 19v-1a4 4 0 0 0-3-3.9M16 4.1a3 3 0 0 1 0 5.8") },
      { to: "/admin/commissions", label: "Commissions", icon: icon("M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6") },
    ],
  },
  {
    group: "Store",
    items: [
      { to: "/admin/coas", label: "Lab reports (COAs)", icon: icon("M9 3h6M10 3v6L4.5 18.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3M7 15h10") },
      { to: "/admin/inbox", label: "Messages & leads", icon: icon("M4 6h16v12H4zM4 7l8 6 8-6") },
      { to: "/admin/settings", label: "Settings", icon: icon("M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1") },
    ],
  },
];

const TITLES: [RegExp, string][] = [
  [/^\/admin\/?$/, "Dashboard"],
  [/^\/admin\/orders\/\d+/, "Order detail"],
  [/^\/admin\/orders/, "Orders & tracking"],
  [/^\/admin\/abandoned/, "Abandoned carts"],
  [/^\/admin\/coupons/, "Coupons"],
  [/^\/admin\/affiliates\/\d+/, "Affiliate detail"],
  [/^\/admin\/affiliates/, "Affiliates"],
  [/^\/admin\/commissions/, "Commissions"],
  [/^\/admin\/inbox/, "Messages & leads"],
  [/^\/admin\/settings/, "Settings"],
  [/^\/admin\/coas/, "Lab reports (COAs)"],
];

export default function AdminApp() {
  const me = trpc.admin.auth.me.useQuery(undefined, { retry: false });
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const utils = trpc.useUtils();
  const logout = trpc.admin.auth.logout.useMutation({ onSuccess: () => utils.admin.auth.me.invalidate() });
  const badges = trpc.admin.dashboard.overview.useQuery(undefined, { enabled: Boolean(me.data), staleTime: 60_000 });

  useEffect(() => {
    document.title = "Admin — Peptiva Supplies";
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    (window as unknown as { __appMounted?: boolean }).__appMounted = true;
    return () => {
      meta.remove();
    };
  }, []);
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  if (me.isPending) return <div className="h-[100dvh] bg-mist" aria-busy="true" />;
  if (!me.data) return <Login />;

  const title = TITLES.find(([re]) => re.test(pathname))?.[1] ?? "Admin";
  const counts: Record<string, number | undefined> = {
    "/admin/orders": badges.data ? badges.data.toShip + badges.data.onHold : undefined,
    "/admin/affiliates": badges.data?.affiliates.pending,
  };

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-mist text-ink">
      <aside className={`fixed left-0 top-0 z-40 flex h-[100dvh] w-64 shrink-0 flex-col border-r border-line bg-white transition-transform lg:static lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex shrink-0 items-center justify-between border-b border-line px-5 py-4">
          <Link to="/admin" className="flex items-center gap-2">
            <Logo />
            <span className="rounded-md bg-navy px-1.5 py-0.5 text-[0.65rem] font-bold tracking-wider text-white">ADMIN</span>
          </Link>
          <button type="button" className="rounded-lg p-1.5 text-slate hover:bg-mist lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu">✕</button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Admin">
          {NAV.map((g) => (
            <div key={g.group} className="mb-5">
              <p className="px-3 pb-1.5 text-[0.7rem] font-semibold uppercase tracking-wider text-muted">{g.group}</p>
              {g.items.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.to === "/admin"}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${isActive ? "bg-navy text-white" : "text-slate hover:bg-mist hover:text-ink"}`
                  }
                >
                  {n.icon}
                  <span className="flex-1">{n.label}</span>
                  {counts[n.to] ? <span className="rounded-full bg-teal px-1.5 text-xs font-bold leading-5 text-white">{counts[n.to]}</span> : null}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="shrink-0 border-t border-line p-4 text-sm">
          <p className="truncate font-semibold text-ink" title={me.data.email}>{me.data.email}</p>
          <div className="mt-2 flex items-center justify-between">
            <Link to="/" className="font-semibold text-navy hover:underline">View store →</Link>
            <button type="button" className="font-semibold text-red-700 hover:underline" onClick={() => logout.mutate()}>Log out</button>
          </div>
        </div>
      </aside>
      {open ? <button type="button" aria-label="Close menu" className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} /> : null}

      <div className="flex h-full min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-line bg-white px-5 lg:px-8">
          <button type="button" className="rounded-lg border border-line px-2.5 py-1.5 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">☰</button>
          <h1 className="font-display text-lg font-medium text-ink">{title}</h1>
        </header>
        <main className="flex-1 overflow-y-auto overscroll-contain p-5 lg:p-8">
          <ErrorBoundary resetKey={pathname}>
            <Routes>
              <Route path="/admin" element={<Dashboard />} />
              <Route path="/admin/orders" element={<Orders />} />
              <Route path="/admin/orders/:id" element={<OrderDetail />} />
              <Route path="/admin/abandoned" element={<Abandoned />} />
              <Route path="/admin/coupons" element={<Coupons />} />
              <Route path="/admin/affiliates" element={<Affiliates />} />
              <Route path="/admin/affiliates/:id" element={<AffiliateDetail />} />
              <Route path="/admin/commissions" element={<Commissions />} />
              <Route path="/admin/inbox" element={<Inbox />} />
              <Route path="/admin/settings" element={<Settings />} />
              <Route path="/admin/coas" element={<Coas />} />
              <Route path="*" element={<p className="text-slate">Section not found. <Link to="/admin" className="text-navy underline">Go to dashboard</Link></p>} />
            </Routes>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
