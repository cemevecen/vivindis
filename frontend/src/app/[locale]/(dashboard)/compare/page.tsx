import { getTranslations } from "next-intl/server";

import { CompareAppsDashboard, ComparePageContent } from "@/components/compare";

type PageProps = {
  searchParams: Record<string, string | string[] | undefined>;
};

export default async function ComparePage({ searchParams }: PageProps) {
  const t = await getTranslations("compare");
  const tNav = await getTranslations("navigation");

  const rawA = searchParams.app_a;
  const rawB = searchParams.app_b;
  const appA = typeof rawA === "string" ? rawA.trim() : "";
  const appB = typeof rawB === "string" ? rawB.trim() : "";

  if (appA && appB) {
    return <CompareAppsDashboard appIdA={appA} appIdB={appB} clerkEnabled />;
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
