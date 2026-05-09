import { getTranslations } from "next-intl/server";

import { AppsRecentResearch } from "@/components/apps/apps-recent-research";
import { AppsListPanel } from "@/components/apps/apps-list-panel";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/routing";
import { cn } from "@/lib/utils";

export default async function AppsPage() {
  const t = await getTranslations("apps");
  const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim());

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("listSubtitle")}</p>
        </div>
        {clerkEnabled ? (
          <Link href="/analyze/store" className={cn(buttonVariants())}>
            {t("addNew")}
          </Link>
        ) : null}
      </div>
      <AppsRecentResearch clerkEnabled={clerkEnabled} />
      <AppsListPanel clerkEnabled={clerkEnabled} />
    </div>
  );
}
