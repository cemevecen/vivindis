import { getTranslations } from "next-intl/server";

import { CompareAppsDashboard } from "@/components/compare/compare-apps-dashboard";
import { ComparePageContent } from "@/components/compare/compare-page-content";

type PageProps = {
  searchParams: Record<string, string | string[] | undefined>;
};

export default async function ComparePage({ searchParams }: PageProps) {
  const t = await getTranslations("compare");
  const tNav = await getTranslations("navigation");
  const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim());

  const rawA = searchParams.app_a;
  const rawB = searchParams.app_b;
  const appA = typeof rawA === "string" ? rawA.trim() : "";
  const appB = typeof rawB === "string" ? rawB.trim() : "";

  if (appA && appB) {
    return <CompareAppsDashboard appIdA={appA} appIdB={appB} clerkEnabled={clerkEnabled} />;
  }

  return (
    <ComparePageContent
      heading={tNav("compare")}
      emptyTitle={t("emptyTitle")}
      emptyDescription={t("emptyDescription")}
      cta={t("cta")}
    />
  );
}
