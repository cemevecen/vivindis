import type { ReactNode } from "react";

import { BuildVersionBadge } from "@/components/layout/build-version-badge";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-muted/40 p-6">
      <div className="absolute right-4 top-4">
        <BuildVersionBadge />
      </div>
      {children}
    </div>
  );
}
