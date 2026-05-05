import { getTranslations } from "next-intl/server";

import { NewAppPanel } from "@/components/apps/new-app-panel";

export default async function NewAppPage() {
  const t = await getTranslations("apps");

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("newTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("newSubtitle")}</p>
      </div>
      <NewAppPanel clerkEnabled />
    </div>
  );
}
