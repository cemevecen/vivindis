import type { ReactNode } from "react";

import { SiteFooter } from "@/components/layout/site-footer";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col bg-muted/40">
      <div className="flex flex-1 flex-col items-center justify-center p-6">{children}</div>
      <SiteFooter />
    </div>
  );
}
