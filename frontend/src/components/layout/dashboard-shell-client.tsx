"use client";

import { useCallback, useState, type ReactNode } from "react";

import { DashboardNavProvider } from "@/components/layout/dashboard-nav-context";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { cn } from "@/lib/utils";

export function DashboardShellClient({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeMenu = useCallback(() => setMobileOpen(false), []);
  const openMenu = useCallback(() => setMobileOpen(true), []);

  return (
    <DashboardNavProvider value={{ openMenu, closeMenu, menuOpen: mobileOpen }}>
      <div className="flex min-h-screen">
        {mobileOpen ? (
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            aria-label="Close navigation menu"
            onClick={closeMenu}
          />
        ) : null}

        <div
          id="dashboard-sidebar"
          className={cn(
            "fixed inset-y-0 left-0 z-50 h-full w-[min(18rem,100vw-2rem)] shrink-0 transition-transform duration-200 ease-out md:static md:z-0 md:h-auto md:w-56 md:translate-x-0",
            mobileOpen ? "translate-x-0 shadow-xl" : "-translate-x-full md:translate-x-0",
          )}
        >
          <DashboardSidebar onNavigate={closeMenu} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <DashboardHeader />
          <main className="flex-1 overflow-x-auto p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </DashboardNavProvider>
  );
}
