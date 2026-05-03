"use client";

import { useAuth } from "@clerk/nextjs";
import { useQueries } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";

import { StartFetchForm } from "@/components/apps/start-fetch-form";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/routing";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import type { AppDto, FetchStatus, ReviewFetchDto } from "@/types/app";

function parseApiDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) {
    return new Date(isoDate);
  }
  return new Date(Date.UTC(y, m - 1, d));
}

function statusClass(status: FetchStatus): string {
  switch (status) {
    case "completed":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
    case "running":
      return "bg-sky-500/15 text-sky-700 dark:text-sky-400";
    case "failed":
      return "bg-destructive/15 text-destructive";
    default:
      return "bg-muted text-muted-foreground";
  }
}

type Props = {
  appId: string;
  clerkEnabled: boolean;
};

export function AppDetailView({ appId, clerkEnabled }: Props) {
  const t = useTranslations("apps");
  const ta = useTranslations("analysis");
  const tDash = useTranslations("dashboard");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const { getToken } = useAuth();

  const dateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : locale, {
        dateStyle: "medium",
        timeZone: "UTC",
      }),
    [locale],
  );

  const queries = useQueries({
    queries: [
      {
        queryKey: queryKeys.apps.detail(appId),
        queryFn: () => apiFetch<AppDto>(`/api/v1/apps/${appId}`, { getToken }),
        enabled: clerkEnabled && Boolean(appId),
      },
      {
        queryKey: queryKeys.apps.fetches(appId),
        queryFn: () => apiFetch<ReviewFetchDto[]>(`/api/v1/apps/${appId}/fetches`, { getToken }),
        enabled: clerkEnabled && Boolean(appId),
      },
    ],
  });

  const [appQuery, fetchQuery] = queries;

  if (!clerkEnabled) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
        {tDash("noClerk")}
      </div>
    );
  }

  if (appQuery.isPending || fetchQuery.isPending) {
    return (
      <div className="space-y-6" aria-busy="true">
        <div className="h-10 w-48 animate-pulse rounded-md bg-muted" />
        <div className="h-32 animate-pulse rounded-lg bg-muted" />
        <div className="h-40 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  if (appQuery.isError) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-center text-sm">
        <p className="font-medium text-destructive">{t("errorLoad")}</p>
        <Button type="button" variant="outline" className="mt-4" onClick={() => void appQuery.refetch()}>
          {tCommon("retry")}
        </Button>
        <div className="mt-4">
          <Link href="/apps" className={cn(buttonVariants({ variant: "ghost" }))}>
            {t("backToApps")}
          </Link>
        </div>
      </div>
    );
  }

  const app = appQuery.data;
  const fetches = fetchQuery.data ?? [];
  const sorted = [...fetches].sort((a, b) => b.created_at.localeCompare(a.created_at));

  const platformLabel =
    app?.platform === "google_play"
      ? t("platformGooglePlay")
      : app?.platform === "app_store"
        ? t("platformAppStore")
        : t("platformBoth");

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <Link href="/apps" className="text-sm text-muted-foreground hover:text-foreground">
            ← {t("backToApps")}
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">{app?.name ?? t("detailTitle")}</h1>
          <p className="text-sm text-muted-foreground">
            {platformLabel}
            {app?.package_name ? (
              <>
                {" "}
                · <span className="font-mono">{app.package_name}</span>
              </>
            ) : null}
          </p>
        </div>
      </div>

      <StartFetchForm appId={appId} />

      <section className="space-y-3">
        <h2 className="text-lg font-medium">{t("fetchList")}</h2>
        {fetchQuery.isError ? (
          <p className="text-sm text-destructive">{tCommon("error")}</p>
        ) : sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noFetches")}</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {sorted.map((row) => (
              <li
                key={row.id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              >
                <div className="space-y-1 text-sm">
                  <p>
                    {dateFmt.format(parseApiDate(row.from_date))} — {dateFmt.format(parseApiDate(row.to_date))}
                  </p>
                  <p className="text-muted-foreground">
                    {t("reviews")}: {row.review_count}
                  </p>
                  {row.status === "failed" && row.error_message ? (
                    <p className="text-xs text-destructive">
                      {t("fetchError")}: {row.error_message}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-medium",
                      statusClass(row.status),
                    )}
                  >
                    {row.status === "pending"
                      ? t("statusPending")
                      : row.status === "running"
                        ? t("statusRunning")
                        : row.status === "completed"
                          ? t("statusCompleted")
                          : t("statusFailed")}
                  </span>
                  <Link
                    href={`/apps/${appId}/analysis?fetchId=${row.id}`}
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                  >
                    {ta("viewAnalytics")}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
