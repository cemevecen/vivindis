"use client";

import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { AnalysisCharts } from "@/components/analysis/analysis-charts";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/routing";
import { downloadAnalysisCsvExport, downloadAnalysisJson } from "@/lib/analysis-export";
import { ApiError, apiFetch, formatClientFetchError } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import type { AnalysisDto, AnalysisListDto } from "@/types/analysis";
import type { FetchStatus, ReviewFetchDto } from "@/types/app";

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
  appId: string;
  fetchId: string | undefined;
  clerkEnabled: boolean;
};

export function AnalysisPageClient({ appId, fetchId, clerkEnabled }: Props) {
  const t = useTranslations("analysis");
  const tDash = useTranslations("dashboard");
  const tApps = useTranslations("apps");
  const tCommon = useTranslations("common");
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  const fetchQuery = useQuery({
    queryKey: queryKeys.apps.fetchDetail(appId, fetchId ?? ""),
    queryFn: () => apiFetch<ReviewFetchDto>(`/api/v1/apps/${appId}/fetches/${fetchId}`, { getToken }),
    enabled: Boolean(clerkEnabled && fetchId),
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return s === "pending" || s === "running" ? 3000 : false;
    },
  });

  const analysesQuery = useQuery({
    queryKey: queryKeys.analyses.byApp(appId),
    queryFn: () => apiFetch<AnalysisListDto>(`/api/v1/apps/${appId}/analyses`, { getToken }),
    enabled: Boolean(clerkEnabled && appId),
    refetchInterval: (q) => {
      if (!fetchId) {
        return false;
      }
      const items = analysesForFetch(q.state.data?.items ?? [], fetchId);
      return items.some((a) => a.status === "pending" || a.status === "running") ? 3000 : false;
    },
  });

  const startMutation = useMutation({
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
      toast.success(t("runAnalysisDone"));
      await queryClient.invalidateQueries({ queryKey: queryKeys.analyses.byApp(appId) });
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : t("analysisError"));
    },
  });

  if (!clerkEnabled) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
        {tDash("noClerk")}
      </div>
    );
  }

  if (!fetchId) {
    return (
      <div className="space-y-4 rounded-lg border border-border bg-card p-8">
        <p className="text-sm text-muted-foreground">{t("missingFetch")}</p>
        <Link href={`/apps/${appId}`} className={cn(buttonVariants())}>
          {t("backToApp")}
        </Link>
      </div>
    );
  }

  if (fetchQuery.isPending) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="h-10 w-56 animate-pulse rounded-md bg-muted" />
        <div className="h-28 animate-pulse rounded-lg bg-muted" />
        <div className="h-64 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  if (fetchQuery.isError) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-sm">
        <p className="font-medium text-destructive">{tApps("errorLoad")}</p>
        <Button type="button" variant="outline" className="mt-4" onClick={() => void fetchQuery.refetch()}>
          {tCommon("retry")}
        </Button>
        <div className="mt-4">
          <Link href={`/apps/${appId}`} className={cn(buttonVariants({ variant: "ghost" }))}>
            {t("backToApp")}
          </Link>
        </div>
      </div>
    );
  }

  const fetch = fetchQuery.data;
  if (!fetch) {
    return null;
  }

  const items = analysesForFetch(analysesQuery.data?.items ?? [], fetchId);
  const busy = items.some((a) => a.status === "pending" || a.status === "running");

  const heuristic = latestByType(items, "heuristic");
  const ai = latestByType(items, "ai");

  const chartLabels = {
    sentiment: t("chartSentiment"),
    ratings: t("chartRatings"),
    topics: t("chartTopics"),
    overall: t("overallScore"),
    empty: t("noAnalysisYet"),
    failed: t("analysisError"),
    heuristicTitle: t("heuristic"),
    aiTitle: t("ai"),
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <Link href={`/apps/${appId}`} className="text-sm text-muted-foreground hover:text-foreground">
            ← {t("backToApp")}
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">{t("pageTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("pollHint")}</p>
        </div>
      </div>

      {analysesQuery.isError ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <p className="font-medium text-destructive">{t("analysesLoadError")}</p>
          <p className="mt-1 text-xs break-words text-destructive/90">{formatClientFetchError(analysesQuery.error)}</p>
          <Button type="button" variant="outline" className="mt-3" onClick={() => void analysesQuery.refetch()}>
            {tCommon("retry")}
          </Button>
        </div>
      ) : null}
      {analysesQuery.isPending && !analysesQuery.isError ? (
        <p className="text-sm text-muted-foreground">{tCommon("loading")}</p>
      ) : null}

      <section className="rounded-lg border border-border bg-muted/20 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">{t("importHeading")}</h2>
          <span
            className={cn(
              "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
              statusClass(fetch.status),
            )}
          >
            {fetch.status === "pending"
              ? tApps("statusPending")
              : fetch.status === "running"
                ? tApps("statusRunning")
                : fetch.status === "completed"
                  ? tApps("statusCompleted")
                  : tApps("statusFailed")}
          </span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {tApps("reviews")}: {fetch.review_count}
        </p>
        {fetch.status === "failed" && fetch.error_message ? (
          <p className="mt-2 text-xs text-destructive">{fetch.error_message}</p>
        ) : null}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          disabled={fetch.status !== "completed" || busy || startMutation.isPending}
          onClick={() => startMutation.mutate()}
        >
          {startMutation.isPending ? t("runAnalysisBusy") : busy ? t("analyzing") : t("runAnalysis")}
        </Button>
        {fetch.status !== "completed" ? (
          <span className="text-sm text-muted-foreground">{t("fetchNotCompleted")}</span>
        ) : null}
      </div>

      {((heuristic?.status === "completed" && heuristic.result) ||
        (ai?.status === "completed" && ai.result)) &&
      fetchId ? (
        <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold">{t("exportHeading")}</h2>
          <div className="flex flex-wrap gap-2">
            {heuristic?.status === "completed" && heuristic.result ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => downloadAnalysisJson(fetchId, "heuristic", heuristic)}
                >
                  {t("exportJsonHeuristic")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => downloadAnalysisCsvExport(fetchId, "heuristic", heuristic)}
                >
                  {t("exportCsvHeuristic")}
                </Button>
              </>
            ) : null}
            {ai?.status === "completed" && ai.result ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => downloadAnalysisJson(fetchId, "ai", ai)}
                >
                  {t("exportJsonAi")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => downloadAnalysisCsvExport(fetchId, "ai", ai)}
                >
                  {t("exportCsvAi")}
                </Button>
              </>
            ) : null}
          </div>
        </section>
      ) : null}

      <AnalysisCharts heuristic={heuristic} ai={ai} chartLabels={chartLabels} />
    </div>
  );
}
