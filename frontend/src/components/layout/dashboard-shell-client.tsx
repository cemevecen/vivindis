import type { ReactNode } from "react";

import { DashboardHeader } from "@/components/layout/dashboard-header";
import { SiteFooter } from "@/components/layout/site-footer";

export function DashboardShellClient({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen min-w-0 flex-col">
      <DashboardHeader />
      <main className="flex-1 min-w-0 overflow-x-hidden p-3 sm:p-5 md:p-6">{children}</main>
      <SiteFooter />
    </div>
  );
}
