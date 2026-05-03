import { getTranslations } from "next-intl/server";

import { ComparePageContent } from "@/components/compare/compare-page-content";

export default async function ComparePage() {
  const t = await getTranslations("compare");
  const tNav = await getTranslations("navigation");

  return (
    <ComparePageContent
      heading={tNav("compare")}
      emptyTitle={t("emptyTitle")}
      emptyDescription={t("emptyDescription")}
      cta={t("cta")}
    />
  );
}
