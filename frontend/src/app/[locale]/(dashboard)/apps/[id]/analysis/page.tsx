import { AnalysisPageClient } from "@/components/analysis/analysis-page-client";

type PageProps = {
  params: { id: string };
  searchParams: Record<string, string | string[] | undefined>;
};

export default function AppAnalysisPage({ params, searchParams }: PageProps) {
  const raw = searchParams.fetchId;
  const fetchId = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : undefined;
  const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim());

  return <AnalysisPageClient appId={params.id} fetchId={fetchId} clerkEnabled={clerkEnabled} />;
}
