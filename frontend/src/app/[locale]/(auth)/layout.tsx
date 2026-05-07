import type { ReactNode } from "react";

import { BuildVersionBadge } from "@/components/layout/build-version-badge";
import { SiteFooter } from "@/components/layout/site-footer";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col bg-muted/40">
      <div className="absolute right-4 top-4 z-10">
        <BuildVersionBadge />
      </div>
      <div className="flex flex-1 flex-col items-center justify-center p-6">{children}</div>
      <SiteFooter />
    </div>
  );
}
