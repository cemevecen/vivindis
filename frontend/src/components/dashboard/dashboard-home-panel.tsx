"use client";

import { useAuth } from "@clerk/nextjs";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { AppsSkeleton } from "@/components/apps/apps-skeleton";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/routing";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import type { AppDto } from "@/types/app";

type Props = {
  clerkEnabled: boolean;
};

function DashboardConnected() {
  const t = useTranslations("dashboard");
  const tApps = useTranslations("apps");
  const tCommon = useTranslations("common");
  const { getToken } = useAuth();

  const query = useQuery({
    queryKey: queryKeys.apps.all,
    queryFn: () => apiFetch<AppDto[]>("/api/v1/apps", { getToken }),
  });

  if (query.isPending) {
    return <AppsSkeleton />;
  }

  if (query.isError) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-sm">
        <p className="font-medium text-destructive">{t("loadError")}</p>
        <Button type="button" variant="outline" className="mt-4" onClick={() => void query.refetch()}>
          {tCommon("retry")}
        </Button>
      </div>
    );
  }

  const count = query.data?.length ?? 0;

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm">
      <h2 className="text-lg font-semibold">{t("appsHeading")}</h2>
      <p className="text-sm text-muted-foreground">{t("appsCount", { count })}</p>
      <div className="flex flex-wrap gap-3">
        <Link href="/apps" className={cn(buttonVariants())}>
          {t("openApps")}
        </Link>
        <Link href="/apps/new" className={cn(buttonVariants({ variant: "outline" }))}>
          {tApps("addNew")}
        </Link>
      </div>
    </div>
  );
}

export function DashboardHomePanel({ clerkEnabled }: Props) {
  const t = useTranslations("dashboard");

  if (!clerkEnabled) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/30 p-8 text-sm text-muted-foreground">
        {t("noClerk")}
      </div>
    );
  }

  return <DashboardConnected />;
}
