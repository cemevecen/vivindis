import type { ReactNode } from "react";

import { DashboardShellClient } from "@/components/layout/dashboard-shell-client";

export default function DashboardShellLayout({ children }: { children: ReactNode }) {
  return <DashboardShellClient>{children}</DashboardShellClient>;
}
