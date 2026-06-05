import { Link, Outlet, useLocation } from "react-router-dom";
import { ConnectButton } from "@rainbow-me/rainbowkit";

export default function Layout() {
  const { pathname } = useLocation();
  // Hide the nav wallet button on the checkout page — it's self-contained
  const isCheckout  = pathname.startsWith("/checkout");
  // Dashboard has its own full-screen layout with JWT auth — no wallet button needed
  const isDashboard = pathname.startsWith("/dashboard");
  // On the landing page the nav floats transparently over the dark Arc hero
  const isLanding   = pathname === "/";

  const linkCls = isLanding
    ? "text-sm text-blue-100/80 hover:text-white transition-colors"
    : "text-sm text-gray-500 hover:text-gray-900 transition-colors";

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      <header className={
        isLanding
          ? "absolute top-0 inset-x-0 z-50 bg-transparent"
          : "sticky top-0 z-50 bg-white border-b border-gray-200"
      }>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className={`font-bold text-lg tracking-tight select-none ${isLanding ? "text-white" : "text-[#6c47ff]"}`}>
            ⚡ ArcPay
          </Link>

          <nav className="flex items-center gap-5">
            <Link to="/docs" className={`${linkCls} hidden sm:block`}>Docs</Link>
            <Link to="/demo"  className={`${linkCls} hidden sm:block`}>Try demo</Link>
            <Link to="/store" className={`${linkCls} hidden sm:block`}>Store</Link>
            {isLanding ? (
              <Link to="/dashboard"
                className="rounded-xl bg-[#c7c2f7] text-[#0a1734] text-sm font-semibold px-4 h-9 inline-flex items-center hover:bg-white transition-colors">
                Start integrating
              </Link>
            ) : (
              <Link to="/dashboard" className={linkCls}>Dashboard</Link>
            )}
            {!isCheckout && !isLanding && !isDashboard && <ConnectButton showBalance={false} chainStatus="icon" />}
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-gray-200 bg-white mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex items-center justify-between text-xs text-gray-400">
          <span>© 2026 ArcPay</span>
          <span className="flex items-center gap-1">
            Built on <span className="font-semibold text-[#6c47ff]">Arc</span>
          </span>
        </div>
      </footer>
    </div>
  );
}
