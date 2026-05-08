"use client";

import { useAuth } from "@clerk/nextjs";
import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { AnalysisCharts } from "@/components/analysis/analysis-charts";
import { StartFetchForm } from "@/components/apps/start-fetch-form";
import { CompareSplitReviewsSection } from "@/components/compare/compare-split-reviews-section";
import { Button, buttonVariants } from "@/components/ui/button";
import { Link, usePathname, useRouter } from "@/i18n/routing";
import { ApiError, apiFetch } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import type { AnalysisDto, AnalysisListDto } from "@/types/analysis";
import type { AppDto, FetchStatus, ReviewFetchDto } from "@/types/app";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validUuid(id: string): boolean {
  return UUID_RE.test(id.trim());
}

function analysesForFetch(items: AnalysisDto[], fetchId: string) {
  return items.filter((a) => a.fetch_id === fetchId);
}

function latestByType(items: AnalysisDto[], type: AnalysisDto["type"]): AnalysisDto | undefined {
  const filtered = items.filter((a) => a.type === type);
  if (filtered.length === 0) {
    return undefined;
  }
  return [...filtered].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
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
  appIdA: string;
  appIdB: string;
  clerkEnabled: boolean;
};

export function CompareAppsDashboard({ appIdA, appIdB, clerkEnabled }: Props) {
  const t = useTranslations("compare");
  const tDash = useTranslations("dashboard");
  const okA = validUuid(appIdA);
  const okB = validUuid(appIdB);

  if (!clerkEnabled) {
    return <p className="text-sm text-muted-foreground">{tDash("noClerk")}</p>;
  }

  if (!okA || !okB) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {t("invalidAppIds")}
      </div>
    );
  }

  return <CompareAppsDashboardAuthed appIdA={appIdA} appIdB={appIdB} />;
}

function CompareAppSplitPane({
  title,
  app,
  fetchRow,
  analysisItems,
  wideCharts,
}: {
  title: string;
  app: AppDto;
  fetchRow: ReviewFetchDto | undefined;
  analysisItems: AnalysisDto[];
  wideCharts: boolean;
}) {
  const t = useTranslations("compare");
  const ta = useTranslations("analysis");
  const tApps = useTranslations("apps");
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const fetchId = fetchRow?.id;
  const items = fetchId ? analysesForFetch(analysisItems, fetchId) : [];
  const busy = items.some((a) => a.status === "pending" || a.status === "running");
  const heuristic = latestByType(items, "heuristic");
  const ai = latestByType(items, "ai");

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      if (!fetchId) {
        throw new Error("fetchId");
      }
      return apiFetch<AnalysisDto[]>(`/api/v1/fetches/${fetchId}/analyze`, {
        method: "POST",
        body: { types: ["heuristic", "ai"] },
        getToken,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.analyses.byApp(app.id) });
      toast.success(ta("runAnalysisDone"));
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : ta("analysisError"));
    },
  });

  const chartLabels = {
    sentiment: ta("chartSentiment"),
    ratings: ta("chartRatings"),
    topics: ta("chartTopics"),
    overall: ta("overallScore"),
    empty: ta("noAnalysisYet"),
    failed: ta("analysisError"),
    heuristicTitle: ta("heuristic"),
    aiTitle: ta("ai"),
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 basis-0 flex-col gap-4 overflow-y-auto border-border p-3 sm:p-4 md:border-e md:last:border-e-0">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight">{app.name}</h2>
        <p className="mt-1 font-mono text-xs text-muted-foreground">{app.package_name || app.bundle_id || "—"}</p>
      </div>

      <StartFetchForm appId={app.id} />

      {fetchRow ? (
        <section className="rounded-lg border border-border bg-muted/20 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-medium text-foreground">{t("splitFetchStatusHeading")}</span>
            <span
              className={cn(
                "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                statusClass(fetchRow.status),
              )}
            >
              {fetchRow.status === "pending"
                ? tApps("statusPending")
                : fetchRow.status === "running"
                  ? tApps("statusRunning")
                  : fetchRow.status === "completed"
                    ? tApps("statusCompleted")
                    : tApps("statusFailed")}
            </span>
          </div>
          {fetchRow.status === "pending" || fetchRow.status === "running" ? null : (
            <p className="mt-2 text-xs text-muted-foreground">
              {tApps("reviews")}: {fetchRow.review_count}
            </p>
          )}
          {fetchRow.status === "failed" && fetchRow.error_message ? (
            <p className="mt-2 text-xs text-destructive">{fetchRow.error_message}</p>
          ) : null}
        </section>
      ) : (
        <p className="text-xs text-muted-foreground">{t("splitNoFetchYet")}</p>
      )}

      {fetchRow ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            disabled={fetchRow.status !== "completed" || busy || analyzeMutation.isPending}
            onClick={() => analyzeMutation.mutate()}
          >
            {analyzeMutation.isPending ? ta("runAnalysisBusy") : busy ? ta("analyzing") : ta("runAnalysis")}
          </Button>
          {fetchRow.status === "completed" ? (
            <Link
              href={`/apps/${app.id}/analysis?fetchId=${fetchRow.id}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              {ta("viewAnalytics")}
            </Link>
          ) : null}
        </div>
      ) : null}

      {fetchRow ? <CompareSplitReviewsSection appId={app.id} fetchRow={fetchRow} /> : null}

      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("splitChartsHeading")}</h3>
        <AnalysisCharts heuristic={heuristic} ai={ai} chartLabels={chartLabels} splitPane={!wideCharts} />
      </section>

      <div className="mt-auto flex flex-wrap gap-2 border-t border-border pt-4">
        <Link href={`/apps/${app.id}`} className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}>
          {tApps("detailTitle")}
        </Link>
      </div>
    </div>
  );
}

function CompareAppsDashboardAuthed({ appIdA, appIdB }: { appIdA: string; appIdB: string }) {
  const t = useTranslations("compare");
  const tApps = useTranslations("apps");
  const ta = useTranslations("analysis");
  const tCommon = useTranslations("common");
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const splitOn =
    searchParams.get("split") === "1" ||
    searchParams.get("split") === "true" ||
    searchParams.get("layout") === "split";

  const chartsWide = searchParams.get("charts") === "wide";

  const setSplit = (on: boolean) => {
    const p = new URLSearchParams(searchParams.toString());
    if (on) {
      p.set("split", "1");
      p.delete("layout");
    } else {
      p.delete("split");
      p.delete("layout");
    }
    router.push(`${pathname}?${p.toString()}`);
  };

  const setChartsWide = (wide: boolean) => {
    const p = new URLSearchParams(searchParams.toString());
    if (wide) {
      p.set("charts", "wide");
    } else {
      p.delete("charts");
    }
    router.push(`${pathname}?${p.toString()}`);
  };

  const queries = useQueries({
    queries: [
      {
        queryKey: queryKeys.apps.detail(appIdA),
        queryFn: () => apiFetch<AppDto>(`/api/v1/apps/${appIdA}`, { getToken }),
        enabled: true,
      },
      {
        queryKey: queryKeys.apps.detail(appIdB),
        queryFn: () => apiFetch<AppDto>(`/api/v1/apps/${appIdB}`, { getToken }),
        enabled: true,
      },
      {
        queryKey: queryKeys.apps.fetches(appIdA),
        queryFn: () => apiFetch<ReviewFetchDto[]>(`/api/v1/apps/${appIdA}/fetches`, { getToken }),
        enabled: true,
        refetchInterval: (q: { state: { data: ReviewFetchDto[] | undefined } }) => {
          const rows = q.state.data ?? [];
          return rows.some((r) => r.status === "pending" || r.status === "running") ? 3000 : false;
        },
      },
      {
        queryKey: queryKeys.apps.fetches(appIdB),
        queryFn: () => apiFetch<ReviewFetchDto[]>(`/api/v1/apps/${appIdB}/fetches`, { getToken }),
        enabled: true,
        refetchInterval: (q: { state: { data: ReviewFetchDto[] | undefined } }) => {
          const rows = q.state.data ?? [];
          return rows.some((r) => r.status === "pending" || r.status === "running") ? 3000 : false;
        },
      },
      {
        queryKey: queryKeys.analyses.byApp(appIdA),
        queryFn: () => apiFetch<AnalysisListDto>(`/api/v1/apps/${appIdA}/analyses`, { getToken }),
        enabled: true,
        refetchInterval: (q: { state: { data: AnalysisListDto | undefined } }) => {
          const items = q.state.data?.items ?? [];
          return items.some((a) => a.status === "pending" || a.status === "running") ? 2000 : false;
        },
      },
      {
        queryKey: queryKeys.analyses.byApp(appIdB),
        queryFn: () => apiFetch<AnalysisListDto>(`/api/v1/apps/${appIdB}/analyses`, { getToken }),
        enabled: true,
        refetchInterval: (q: { state: { data: AnalysisListDto | undefined } }) => {
          const items = q.state.data?.items ?? [];
          return items.some((a) => a.status === "pending" || a.status === "running") ? 2000 : false;
        },
      },
    ],
  });

  const [appAq, appBq, fetchAq, fetchBq, anaAq, anaBq] = queries;
  const bootstrapFetchKeyRef = useRef<string>("");

  const bootstrapFetchMutation = useMutation({
    mutationFn: async (args: { appIds: string[]; fromDate: string; toDate: string }) => {
      await Promise.all(
        args.appIds.map((id) =>
          apiFetch<ReviewFetchDto>(`/api/v1/apps/${id}/fetch`, {
            method: "POST",
            body: {
              from_date: args.fromDate,
              to_date: args.toDate,
              review_scope: "global",
            },
            getToken,
          }),
        ),
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.apps.fetches(appIdA) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.apps.fetches(appIdB) });
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : tCommon("error"));
    },
  });

  const latestFetch = (rows: ReviewFetchDto[] | undefined) =>
    rows && rows.length
      ? [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
      : undefined;

  const fa = latestFetch(fetchAq.data);
  const fb = latestFetch(fetchBq.data);

  useEffect(() => {
    if (!splitOn || queries.some((q) => q.isPending) || queries.some((q) => q.isError)) {
      return;
    }
    const missingIds: string[] = [];
    if ((fetchAq.data ?? []).length === 0) {
      missingIds.push(appIdA);
    }
    if ((fetchBq.data ?? []).length === 0) {
      missingIds.push(appIdB);
    }
    if (missingIds.length === 0 || bootstrapFetchMutation.isPending) {
      return;
    }

    const sourceRange = fa ?? fb;
    const fallbackTo = new Date();
    const fallbackFrom = new Date();
    fallbackFrom.setDate(fallbackFrom.getDate() - 30);
    const fromDate = sourceRange?.from_date ?? fallbackFrom.toISOString().slice(0, 10);
    const toDate = sourceRange?.to_date ?? fallbackTo.toISOString().slice(0, 10);

    const reqKey = `${missingIds.sort().join(",")}|${fromDate}|${toDate}`;
    if (bootstrapFetchKeyRef.current === reqKey) {
      return;
    }
    bootstrapFetchKeyRef.current = reqKey;
    bootstrapFetchMutation.mutate({ appIds: missingIds, fromDate, toDate });
  }, [
    splitOn,
    queries,
    fetchAq.data,
    fetchBq.data,
    appIdA,
    appIdB,
    fa,
    fb,
    bootstrapFetchMutation,
  ]);

  if (queries.some((q) => q.isPending)) {
    return <p className="text-sm text-muted-foreground">{tCommon("loading")}</p>;
  }

  if (queries.some((q) => q.isError)) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-destructive">{t("loadPairFailed")}</p>
        <Link href="/compare" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          {t("clearCompare")}
        </Link>
      </div>
    );
  }

  const appA = appAq.data;
  const appB = appBq.data;
  if (!appA || !appB) {
    return null;
  }

  const latestHeuristic = (items: AnalysisListDto | undefined) =>
    (items?.items ?? []).filter((x) => x.type === "heuristic" && x.status === "completed").sort((a, b) =>
      a.created_at < b.created_at ? 1 : -1,
    )[0];

  const hA = latestHeuristic(anaAq.data);
  const hB = latestHeuristic(anaBq.data);

  const Card = ({
    title,
    app,
    fetchRow,
    hasHeuristic,
  }: {
    title: string;
    app: AppDto;
    fetchRow: ReviewFetchDto | undefined;
    hasHeuristic: boolean;
  }) => (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <h2 className="mt-1 text-xl font-semibold tracking-tight">{app.name}</h2>
      <p className="mt-1 font-mono text-xs text-muted-foreground">{app.package_name || app.bundle_id || "—"}</p>
      <dl className="mt-4 space-y-2 text-sm">
        {fetchRow && (fetchRow.status === "pending" || fetchRow.status === "running") ? null : (
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">{tApps("reviews")}</dt>
            <dd>{fetchRow?.review_count ?? "—"}</dd>
          </div>
        )}
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">{tApps("status")}</dt>
          <dd>{fetchRow ? fetchRow.status : "—"}</dd>
        </div>
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={`/apps/${app.id}`} className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}>
          {tApps("detailTitle")}
        </Link>
        {fetchRow?.status === "completed" ? (
          <Link
            href={`/apps/${app.id}/analysis?fetchId=${fetchRow.id}`}
            className={cn(buttonVariants({ size: "sm" }))}
          >
            {ta("viewAnalytics")}
          </Link>
        ) : null}
      </div>
      {hasHeuristic ? (
        <p className="mt-3 text-xs text-muted-foreground">{t("heuristicReadyHint")}</p>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">{t("runHeuristicHint")}</p>
      )}
    </div>
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("pairTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("pairSubtitle")}</p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant={splitOn ? "default" : "outline"} onClick={() => setSplit(true)}>
              {t("splitViewOn")}
            </Button>
            <Button type="button" size="sm" variant={!splitOn ? "default" : "outline"} onClick={() => setSplit(false)}>
              {t("splitViewOff")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground sm:max-w-xl">{t("splitViewHint")}</p>
        </div>
        {splitOn ? (
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3 sm:flex-row sm:flex-wrap sm:items-center">
            <span className="text-xs font-medium text-foreground">{t("chartsLayoutLabel")}</span>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={!chartsWide ? "default" : "outline"}
                onClick={() => setChartsWide(false)}
              >
                {t("chartsLayoutCompact")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant={chartsWide ? "default" : "outline"}
                onClick={() => setChartsWide(true)}
              >
                {t("chartsLayoutWide")}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground sm:ml-2 sm:max-w-md">{t("chartsLayoutHint")}</p>
          </div>
        ) : null}
      </div>

      {splitOn ? (
        <div className="flex min-h-[min(90vh,960px)] min-w-0 flex-col rounded-xl border border-border bg-card/50 md:flex-row md:items-stretch">
          <CompareAppSplitPane
            title={t("slotA")}
            app={appA}
            fetchRow={fa}
            analysisItems={anaAq.data?.items ?? []}
            wideCharts={chartsWide}
          />
          <CompareAppSplitPane
            title={t("slotB")}
            app={appB}
            fetchRow={fb}
            analysisItems={anaBq.data?.items ?? []}
            wideCharts={chartsWide}
          />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title={t("slotA")} app={appA} fetchRow={fa} hasHeuristic={Boolean(hA)} />
          <Card title={t("slotB")} app={appB} fetchRow={fb} hasHeuristic={Boolean(hB)} />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Link href="/analyze" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          {t("backToAnalyze")}
        </Link>
        <Link href="/compare" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
          {t("clearCompare")}
        </Link>
      </div>
    </div>
  );
}
