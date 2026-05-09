import type { ReactNode } from "react";
import { Suspense } from "react";

import { AnalyzeBreadcrumb } from "@/components/layout/analyze-breadcrumb";

function AnalyzeBreadcrumbFallback() {
  return <div className="mb-4 h-5 rounded bg-muted/40" aria-hidden />;
}

export default function AnalyzeLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Suspense fallback={<AnalyzeBreadcrumbFallback />}>
        <AnalyzeBreadcrumb />
      </Suspense>
      {children}
    </>
  );
}
