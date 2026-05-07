import { Suspense } from "react";

import { AnalyzeHub } from "@/components/analyze";

function AnalyzeHubFallback() {
  return <div className="min-h-[50vh] rounded-lg border border-dashed border-border bg-muted/20" aria-hidden />;
}

export default function AnalyzePage() {
  const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim());

  return (
    <Suspense fallback={<AnalyzeHubFallback />}>
      <AnalyzeHub clerkEnabled={clerkEnabled} />
    </Suspense>
  );
}
