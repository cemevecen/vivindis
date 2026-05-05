"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { AppList } from "@/components/apps/app-list";
import { AppsSkeleton } from "@/components/apps/apps-skeleton";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { usePublicToken } from "@/lib/auth";
import { queryKeys } from "@/lib/query-keys";
import type { AppDto } from "@/types/app";

type Props = {
  clerkEnabled: boolean;
};

function AppsConnectedList() {
  const getToken = usePublicToken();
  const tDash = useTranslations("dashboard");
  const tCommon = useTranslations("common");

  const query = useQuery({
    queryKey: queryKeys.apps.all,
    queryFn: () => apiFetch<AppDto[]>("/api/v1/apps", { getToken }),
  });

  if (query.isPending) {
    return <AppsSkeleton />;
  }

  if (query.isError) {
    const message = query.error instanceof Error ? query.error.message : tDash("loadError");
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-center text-sm">
        <p className="font-medium text-destructive">{tDash("loadError")}</p>
        <p className="mt-1 text-muted-foreground">{message}</p>
        <Button type="button" variant="outline" className="mt-4" onClick={() => void query.refetch()}>
          {tCommon("retry")}
        </Button>
      </div>
    );
  }

  return <AppList apps={query.data ?? []} />;
}

export function AppsListPanel({ clerkEnabled }: Props) {
  void clerkEnabled;
  return <AppsConnectedList />;
}
