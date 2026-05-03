import { AnalyzeHub } from "@/components/analyze/analyze-hub";

export default function AnalyzePage() {
  const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim());

  return <AnalyzeHub clerkEnabled={clerkEnabled} />;
}
