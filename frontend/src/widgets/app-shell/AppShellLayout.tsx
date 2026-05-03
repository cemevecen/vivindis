import { NavLink, Outlet } from "react-router-dom";

const nav = [
  { to: "/", label: "Özet" },
  { to: "/analyze", label: "Analiz" },
  { to: "/store", label: "Mağaza" },
];

export function AppShellLayout() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <NavLink
            to="/"
            className="text-xl font-semibold tracking-tight text-brand-900 hover:text-brand-600"
          >
            Vivindis
          </NavLink>
          <nav className="flex flex-wrap gap-2">
            {nav.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  [
                    "rounded-lg px-3 py-2 text-sm font-medium transition",
                    isActive
                      ? "bg-brand-600 text-white shadow-sm"
                      : "text-ink-muted hover:bg-slate-100 hover:text-ink",
                  ].join(" ")
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-slate-200 bg-white py-6 text-center text-sm text-ink-muted">
        Vivindis — mağaza yorumu analizi
      </footer>
    </div>
  );
}
