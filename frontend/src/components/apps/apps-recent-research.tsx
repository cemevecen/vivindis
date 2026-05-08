"use client";

import { useAuth } from "@clerk/nextjs";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/routing";
import { ApiError, apiFetch } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import type { RecentReviewFetchDto, ReviewScope } from "@/types/app";

function parseApiDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) {
    return new Date(isoDate);
  }
  return new Date(Date.UTC(y, m - 1, d));
}

function statusClass(status: RecentReviewFetchDto["status"]): string {
  switch (status) {
    case "completed":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
    case "running":
      return "bg-sky-500/15 text-sky-700 dark:text-sky-400";
    case "waiting_approval":
      return "bg-amber-500/15 text-amber-800 dark:text-amber-200";
    case "failed":
      return "bg-destructive/15 text-destructive";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function scopeBadgeClass(scope: ReviewScope): string {
  return scope === "local"
    ? "border-violet-500/40 bg-violet-500/10 text-violet-800 dark:text-violet-200"
    : "border-sky-500/40 bg-sky-500/10 text-sky-900 dark:text-sky-100";
}

type Props = {
  clerkEnabled: boolean;
};

export function AppsRecentResearch({ clerkEnabled }: Props) {
  const { getToken } = useAuth();
  const t = useTranslations("apps");
  const tCommon = useTranslations("common");
  const locale = useLocale();

  const dateFmt = new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : locale, {
    dateStyle: "medium",
    timeZone: "UTC",
  });

  const query = useQuery({
    queryKey: queryKeys.apps.recentFetches,
    queryFn: () =>
      apiFetch<RecentReviewFetchDto[]>("/api/v1/apps/recent-fetches?limit=15", { getToken }),
    enabled: clerkEnabled,
  });

  if (!clerkEnabled) {
    return null;
  }

  if (query.isPending) {
    return (
      <section className="space-y-3" aria-busy="true">
        <div className="h-5 w-48 animate-pulse rounded bg-muted" />
        <div className="h-24 animate-pulse rounded-lg border border-border bg-muted/30" />
      </section>
    );
  }

  if (query.isError) {
    const message = query.error instanceof ApiError ? query.error.message : tCommon("error");
    return (
      <section className="space-y-3">
        <h2 className="text-lg font-medium">{t("recentResearchHeading")}</h2>
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
          <p className="text-destructive">{message}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void query.refetch()}>
            {tCommon("retry")}
          </Button>
        </div>
      </section>
    );
  }

  const items = query.data ?? [];
  if (items.length === 0) {
    return (
      <section className="space-y-2">
        <h2 className="text-lg font-medium">{t("recentResearchHeading")}</h2>
        <p className="text-sm text-muted-foreground">{t("recentResearchEmpty")}</p>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-medium">{t("recentResearchHeading")}</h2>
      <ul className="divide-y divide-border rounded-lg border border-border">
        {items.map((row) => {
          const scope: ReviewScope = row.review_scope === "local" ? "local" : "global";
          const href = `/apps/${row.app_id}/analysis?fetchId=${row.id}`;
          return (
            <li key={row.id}>
              <Link
                href={href}
                className="flex flex-col gap-2 p-4 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              >
                <div className="min-w-0 space-y-1 text-sm">
                  <p className="truncate font-medium text-foreground">{row.app_name || t("detailTitle")}</p>
                  <p className="text-muted-foreground">
                    {dateFmt.format(parseApiDate(row.from_date))} — {dateFmt.format(parseApiDate(row.to_date))}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex w-fit rounded-full border px-2.5 py-0.5 text-xs font-medium",
                      scopeBadgeClass(scope),
                    )}
                  >
                    {scope === "local" ? t("researchKindLocal") : t("researchKindDeep")}
                  </span>
                  <span
                    className={cn(
                      "inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-medium",
                      statusClass(row.status),
                    )}
                  >
                    {row.status === "waiting_approval"
                      ? t("statusWaitingApproval")
                      : row.status === "pending"
                        ? t("statusPending")
                        : row.status === "running"
                          ? t("statusRunning")
                          : row.status === "completed"
                            ? t("statusCompleted")
                            : t("statusFailed")}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                    {t("recentResearchOpen")}
                    <ChevronRight className="size-3.5" aria-hidden />
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
