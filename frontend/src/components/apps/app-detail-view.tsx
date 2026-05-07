"use client";

import { useAuth } from "@clerk/nextjs";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { toast } from "sonner";

import { StartFetchForm } from "@/components/apps/start-fetch-form";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/routing";
import { findDuplicateAppsForApp } from "@/lib/app-dedupe";
import { ApiError, apiFetch } from "@/lib/api";
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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const pairParam = searchParams.get("pair_app_id")?.trim() ?? "";
  const pairValid = Boolean(pairParam && UUID_RE.test(pairParam) && pairParam !== appId);

  const pairAppQuery = useQuery({
    queryKey: queryKeys.apps.detail(pairParam),
    queryFn: () => apiFetch<AppDto>(`/api/v1/apps/${pairParam}`, { getToken }),
    enabled: clerkEnabled && pairValid,
  });

  const dateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : locale, {
        dateStyle: "medium",
        timeZone: "UTC",
      }),
    [locale],
  );

  const dateTimeFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : locale, {
        dateStyle: "medium",
        timeStyle: "short",
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

  const allAppsQuery = useQuery({
    queryKey: queryKeys.apps.all,
    queryFn: () => apiFetch<AppDto[]>("/api/v1/apps", { getToken }),
    enabled: clerkEnabled && Boolean(appId),
  });

  const duplicateApps = useMemo(() => {
    const row = appQuery.data;
    const all = allAppsQuery.data;
    if (!row || !all) {
      return [];
    }
    return findDuplicateAppsForApp(all, row);
  }, [allAppsQuery.data, appQuery.data]);

  const deleteDuplicateMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/api/v1/apps/${id}`, {
        method: "DELETE",
        getToken,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.apps.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.apps.detail(appId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.apps.fetches(appId) });
      toast.success(t("deleteSuccess"));
    },
    onError: (error) => {
      const message = error instanceof ApiError ? error.message : t("deleteFailed");
      toast.error(message);
    },
  });

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
      {pairValid && pairAppQuery.data ? (
        <div className="rounded-lg border border-sky-200 bg-sky-50/80 p-4 text-sm text-sky-950 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-100">
          <p className="font-medium">{t("pairBannerTitle")}</p>
          <p className="mt-1 text-muted-foreground dark:text-sky-200/90">
            {t("pairBannerIntro", { name: pairAppQuery.data.name })}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={`/apps/${pairParam}`}
              className={cn(buttonVariants({ variant: "default", size: "sm" }))}
            >
              {t("pairBannerOpenPartner")}
            </Link>
            <Link
              href={`/compare?app_a=${appId}&app_b=${pairParam}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              {t("pairBannerCompare")}
            </Link>
          </div>
        </div>
      ) : pairValid && pairAppQuery.isError ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
          {tCommon("error")}
        </div>
      ) : null}
      {duplicateApps.length > 0 ? (
        <section className="rounded-lg border border-amber-200/80 bg-amber-50/60 p-4 dark:border-amber-900/45 dark:bg-amber-950/25">
          <h2 className="text-sm font-semibold text-amber-950 dark:text-amber-100">
            {t("duplicateRegistrationsHeading")}
          </h2>
          <p className="mt-1 text-xs text-amber-900/80 dark:text-amber-200/85">{t("duplicateRegistrationsHint")}</p>
          <ul className="mt-3 divide-y divide-border rounded-md border border-border bg-card">
            {duplicateApps.map((d) => (
              <li
                key={d.id}
                className="flex flex-col gap-2 px-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="truncate font-medium text-foreground">{d.name || t("detailTitle")}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("duplicateSavedAt", {
                      date: dateTimeFmt.format(new Date(d.created_at)),
                    })}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/apps/${d.id}`}
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                  >
                    {t("duplicateOpen")}
                  </Link>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                    disabled={deleteDuplicateMutation.isPending}
                    onClick={() => {
                      const ok = window.confirm(
                        t("deleteConfirm", { name: d.name || t("detailTitle") }),
                      );
                      if (!ok) {
                        return;
                      }
                      deleteDuplicateMutation.mutate(d.id);
                    }}
                  >
                    {t("duplicateDelete")}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
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
                  {row.status === "pending" || row.status === "running" ? null : (
                    <p className="text-muted-foreground">
                      {t("reviews")}: {row.review_count}
                    </p>
                  )}
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
