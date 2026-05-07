import type { ReactNode } from "react";

import { DashboardHeader } from "@/components/layout/dashboard-header";

export function DashboardShellClient({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen min-w-0 flex-col">
      <DashboardHeader />
      <main className="flex-1 overflow-x-auto p-4 sm:p-6">{children}</main>
    </div>
  );
}
