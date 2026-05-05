import { getTranslations } from "next-intl/server";

import { DashboardHomePanel } from "@/components/dashboard/dashboard-home-panel";

export default async function DashboardPage() {
  const t = await getTranslations("dashboard");
  const tAnalysis = await getTranslations("analysis");

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      <DashboardHomePanel clerkEnabled />
      <p className="text-xs text-muted-foreground">
        {tAnalysis("sentiment")} · {tAnalysis("topics")} · {tAnalysis("issues")} — Oturum 7
      </p>
    </div>
  );
}
