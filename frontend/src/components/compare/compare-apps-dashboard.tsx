"use client";

import { useAuth } from "@clerk/nextjs";
import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, Globe } from "lucide-react";

import { AnalysisCharts } from "@/components/analysis/analysis-charts";
import { CompareSplitReviewsSection } from "@/components/compare/compare-split-reviews-section";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectNative } from "@/components/ui/select-native";
import { Link, useRouter } from "@/i18n/routing";
import { ApiError, apiFetch } from "@/lib/api";
import { rangeFromPreset, type DatePresetId } from "@/lib/analyze-hub-utils";
import { GLOBAL_SCAN_LANG_CODES, MAX_GLOBAL_FETCH_LANGS } from "@/lib/global-scan-langs";
import { storeLocaleFromUiLocale } from "@/lib/store-locale";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import type { AnalysisDto, AnalysisListDto } from "@/types/analysis";
import type { AppDto, FetchStatus, ReviewFetchDto } from "@/types/app";

type DeepResearchDatePreset = DatePresetId | "custom";

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
    case "waiting_approval":
      return "bg-amber-500/15 text-amber-800 dark:text-amber-200";
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
}: {
  title: string;
  app: AppDto;
  fetchRow: ReviewFetchDto | undefined;
  analysisItems: AnalysisDto[];
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
  const autoAnalyzeRef = useRef<string>("");

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

  useEffect(() => {
    if (
      !fetchId ||
      fetchRow?.status !== "completed" ||
      items.length > 0 ||
      busy ||
      analyzeMutation.isPending ||
      autoAnalyzeRef.current === fetchId
    ) {
      return;
    }
    autoAnalyzeRef.current = fetchId;
    analyzeMutation.mutate();
  }, [fetchId, fetchRow?.status, items.length, busy, analyzeMutation]);

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

  const hasCompletedAnalysis = Boolean(heuristic || ai);

  return (
    <div className="flex min-w-0 flex-1 basis-0 flex-col gap-3 overflow-y-auto overflow-x-hidden border-border p-3 sm:p-4 md:max-w-[50%] md:border-e md:last:border-e-0">
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
        <h2 className="mt-1 break-words text-lg font-semibold tracking-tight">{app.name}</h2>
        <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{app.package_name || app.bundle_id || "—"}</p>
      </div>

      <section className="rounded-lg border border-border bg-muted/20 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-medium text-foreground">{t("splitFetchStatusHeading")}</span>
          {fetchRow ? (
            <span
              className={cn(
                "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                statusClass(fetchRow.status),
              )}
            >
              {fetchRow.status === "waiting_approval"
                ? tApps("statusWaitingApproval")
                : fetchRow.status === "pending"
                  ? tApps("statusPending")
                  : fetchRow.status === "running"
                    ? tApps("statusRunning")
                    : fetchRow.status === "completed"
                      ? tApps("statusCompleted")
                      : tApps("statusFailed")}
            </span>
          ) : (
            <span className="inline-flex animate-pulse rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {tApps("statusPending")}
            </span>
          )}
        </div>
        {fetchRow && fetchRow.status !== "waiting_approval" && fetchRow.status !== "pending" && fetchRow.status !== "running" ? (
          <p className="mt-2 text-xs text-muted-foreground">
            {tApps("reviews")}: {fetchRow.review_count}
          </p>
        ) : null}
        {fetchRow?.status === "failed" && fetchRow.error_message ? (
          <p className="mt-2 text-xs text-destructive">{fetchRow.error_message}</p>
        ) : null}
        {busy ? (
          <p className="mt-2 text-xs text-sky-600 dark:text-sky-400">{ta("analyzing")}</p>
        ) : null}
      </section>

      {hasCompletedAnalysis || fetchRow?.status === "completed" ? (
        <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
          {hasCompletedAnalysis ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              disabled={!fetchRow || fetchRow.status !== "completed" || busy || analyzeMutation.isPending}
              onClick={() => analyzeMutation.mutate()}
            >
              {analyzeMutation.isPending ? ta("runAnalysisBusy") : ta("runAnalysis")}
            </Button>
          ) : null}
          {fetchRow?.status === "completed" ? (
            <Link
              href={{
                pathname: "/apps/[id]/analysis",
                params: { id: app.id },
                query: { fetchId: fetchRow.id },
              }}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full justify-center sm:w-auto")}
            >
              {ta("viewAnalytics")}
            </Link>
          ) : null}
        </div>
      ) : null}

      {fetchRow ? <CompareSplitReviewsSection appId={app.id} fetchRow={fetchRow} /> : null}

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("splitChartsHeading")}</h3>
        <AnalysisCharts heuristic={heuristic} ai={ai} chartLabels={chartLabels} splitPane compactCards />
      </section>

      <div className="mt-auto flex flex-wrap gap-2 border-t border-border pt-4">
        <Link href={{ pathname: "/apps/[id]", params: { id: app.id } }} className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}>
          {tApps("detailTitle")}
        </Link>
      </div>
    </div>
  );
}

function CompareDeepResearchPanel({
  appIdA,
  appIdB,
  fetchA,
  fetchB,
}: {
  appIdA: string;
  appIdB: string;
  fetchA: ReviewFetchDto;
  fetchB: ReviewFetchDto;
}) {
  const ta = useTranslations("analysis");
  const tAnalyzeHub = useTranslations("analyzeHub");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [datePreset, setDatePreset] = useState<DeepResearchDatePreset>("custom");
  const earlierFrom = fetchA.from_date < fetchB.from_date ? fetchA.from_date : fetchB.from_date;
  const laterTo = fetchA.to_date > fetchB.to_date ? fetchA.to_date : fetchB.to_date;
  const [deepFrom, setDeepFrom] = useState(earlierFrom);
  const [deepTo, setDeepTo] = useState(laterTo);
  const [deepLangs, setDeepLangs] = useState<Set<string>>(
    () => new Set(GLOBAL_SCAN_LANG_CODES.slice(0, MAX_GLOBAL_FETCH_LANGS)),
  );

  const langOptions = useMemo(() => {
    let dn: Intl.DisplayNames;
    try {
      dn = new Intl.DisplayNames([locale, "en"], { type: "language" });
    } catch {
      dn = new Intl.DisplayNames(["en"], { type: "language" });
    }
    return GLOBAL_SCAN_LANG_CODES.map((code) => ({
      code,
      label: dn.of(code) ?? code,
    }));
  }, [locale]);

  const toggleDeepLang = useCallback(
    (code: string) => {
      setDeepLangs((prev) => {
        const next = new Set(prev);
        if (next.has(code)) {
          next.delete(code);
        } else {
          if (next.size >= MAX_GLOBAL_FETCH_LANGS) {
            toast.error(ta("deepResearchLangLimitToast"));
            return prev;
          }
          next.add(code);
        }
        return next;
      });
    },
    [ta],
  );

  const selectFirst24 = useCallback(() => {
    setDeepLangs(new Set(GLOBAL_SCAN_LANG_CODES.slice(0, MAX_GLOBAL_FETCH_LANGS)));
  }, []);

  const clearLangs = useCallback(() => {
    setDeepLangs(new Set());
  }, []);

  const isFirst24 = useMemo(() => {
    if (deepLangs.size !== MAX_GLOBAL_FETCH_LANGS) return false;
    return GLOBAL_SCAN_LANG_CODES.slice(0, MAX_GLOBAL_FETCH_LANGS).every((c) => deepLangs.has(c));
  }, [deepLangs]);

  const allSelected = useMemo(
    () => GLOBAL_SCAN_LANG_CODES.every((c) => deepLangs.has(c)),
    [deepLangs],
  );

  const selectAllRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const el = selectAllRef.current;
    if (!el) return;
    el.indeterminate = deepLangs.size > 0 && !allSelected;
  }, [deepLangs, allSelected]);

  const deepMutation = useMutation({
    mutationFn: async () => {
      const langs = Array.from(deepLangs).sort();
      if (langs.length < 1) throw new Error("lang");
      const body = {
        from_date: deepFrom,
        to_date: deepTo,
        review_scope: "global" as const,
        global_langs: langs,
        review_limit: 5000,
      };
      for (const id of [appIdA, appIdB]) {
        await apiFetch<ReviewFetchDto>(`/api/v1/apps/${id}/fetch`, {
          method: "POST",
          body,
          getToken,
        });
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.apps.fetches(appIdA) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.apps.fetches(appIdB) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.apps.recentFetches });
      await queryClient.invalidateQueries({ queryKey: queryKeys.analyses.byApp(appIdA) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.analyses.byApp(appIdB) });
      toast.success(ta("deepResearchToastNewImportStarted"));
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : tCommon("error"));
    },
  });

  const runDeep = useCallback(() => {
    if (deepLangs.size < 1) {
      toast.error(ta("deepResearchNeedOneLang"));
      return;
    }
    if (!deepFrom || !deepTo || deepFrom > deepTo) {
      toast.error(ta("deepResearchInvalidRange"));
      return;
    }
    deepMutation.mutate();
  }, [deepFrom, deepTo, deepLangs, deepMutation, ta]);

  return (
    <section
      className={cn(
        "relative min-w-0 overflow-hidden rounded-xl border border-violet-500/35 bg-gradient-to-br from-violet-500/[0.09] via-primary/[0.05] to-amber-500/[0.07] p-4 shadow-sm ring-1 ring-violet-500/12",
        "dark:border-violet-400/28 dark:from-violet-500/[0.11] dark:via-primary/[0.07] dark:to-amber-500/[0.07] dark:ring-violet-400/14",
      )}
    >
      <div
        className="pointer-events-none absolute -right-5 -top-5 h-14 w-14 rounded-full bg-violet-500/12 blur-xl dark:bg-violet-400/10"
        aria-hidden
      />
      <div className="relative flex gap-3">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-primary text-white shadow-sm dark:from-violet-500 dark:to-primary"
          aria-hidden
        >
          <Globe className="h-4 w-4" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <button
            type="button"
            className={cn(
              "flex w-full items-center justify-between gap-2 rounded-md px-0.5 py-0.5 text-left",
              "text-sm font-semibold text-foreground outline-none transition-colors",
              "hover:bg-background/40 focus-visible:ring-2 focus-visible:ring-ring",
            )}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            <span className="min-w-0">{ta("deepResearchPrepTitle")}</span>
            <ChevronDown
              className={cn(
                "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
                open && "rotate-180",
              )}
              aria-hidden
            />
          </button>

          {open ? (
            <div className="space-y-3">
              <div className="min-w-0 space-y-3 rounded-lg border border-white/35 bg-background/55 p-3 dark:border-white/10 dark:bg-background/35">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1">
                    <Label className="text-xs" htmlFor="deep-preset-compare">
                      {tAnalyzeHub("dateRangeLabel")}
                    </Label>
                    <SelectNative
                      id="deep-preset-compare"
                      value={datePreset}
                      onChange={(e) => {
                        const v = e.target.value as DeepResearchDatePreset;
                        setDatePreset(v);
                        if (v === "custom") return;
                        const r = rangeFromPreset(v);
                        setDeepFrom(r.from);
                        setDeepTo(r.to);
                      }}
                      className="h-9 w-full rounded-lg text-sm"
                    >
                      <option value="7d">{tAnalyzeHub("datePresetLast7")}</option>
                      <option value="30d">{tAnalyzeHub("datePresetLast30")}</option>
                      <option value="90d">{tAnalyzeHub("datePresetLast90")}</option>
                      <option value="180d">{tAnalyzeHub("datePresetLast180")}</option>
                      <option value="365d">{tAnalyzeHub("datePresetLast365")}</option>
                      <option value="2y">{tAnalyzeHub("datePresetLast2y")}</option>
                      <option value="5y">{tAnalyzeHub("datePresetLast5y")}</option>
                      <option value="all">{tAnalyzeHub("datePresetAll")}</option>
                      <option value="custom">{ta("deepResearchDatePresetCustom")}</option>
                    </SelectNative>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs" htmlFor="deep-from-compare">
                      {ta("deepResearchDateFromLabel")}
                    </Label>
                    <Input
                      id="deep-from-compare"
                      type="date"
                      value={deepFrom}
                      max={deepTo || undefined}
                      onChange={(e) => {
                        setDatePreset("custom");
                        setDeepFrom(e.target.value);
                      }}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs" htmlFor="deep-to-compare">
                      {ta("deepResearchDateToLabel")}
                    </Label>
                    <Input
                      id="deep-to-compare"
                      type="date"
                      value={deepTo}
                      min={deepFrom || undefined}
                      onChange={(e) => {
                        setDatePreset("custom");
                        setDeepTo(e.target.value);
                      }}
                      className="h-9"
                    />
                  </div>
                </div>

                <div className="space-y-1.5 border-t border-border/50 pt-2">
                  <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                    <Label className="text-xs">{ta("globalLangsLabel")}</Label>
                    <span className="text-xs text-muted-foreground">
                      {deepLangs.size}/{MAX_GLOBAL_FETCH_LANGS}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={selectFirst24}>
                      {ta("deepResearchSelectAll24")}
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={clearLangs}>
                      {ta("deepResearchClearLangs")}
                    </Button>
                  </div>
                  <div className="max-h-[min(12rem,35vh)] overflow-y-auto rounded border border-border bg-card/50 p-1.5">
                    <div className="grid grid-cols-2 gap-x-2 gap-y-0 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                      <label className="col-span-full flex cursor-pointer items-center gap-1.5 border-b border-border/50 pb-1 text-xs font-medium hover:bg-muted/40">
                        <input
                          ref={selectAllRef}
                          type="checkbox"
                          className="size-3.5 shrink-0 rounded border-border"
                          checked={allSelected}
                          onChange={() => {
                            if (isFirst24) {
                              clearLangs();
                            } else {
                              selectFirst24();
                            }
                          }}
                        />
                        <span className="leading-tight">{ta("deepResearchLangCheckboxAll")}</span>
                      </label>
                      {langOptions.map(({ code, label }) => (
                        <label
                          key={code}
                          className="flex min-w-0 cursor-pointer items-center gap-1 rounded px-0.5 py-0.5 text-xs hover:bg-muted/50"
                        >
                          <input
                            type="checkbox"
                            className="size-3.5 shrink-0 rounded border-border"
                            checked={deepLangs.has(code)}
                            onChange={() => toggleDeepLang(code)}
                          />
                          <span className="min-w-0 truncate" title={`${label} (${code})`}>
                            {label} <span className="text-muted-foreground">({code})</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <Button
                type="button"
                className="h-9 w-full rounded-lg text-sm font-semibold shadow-sm"
                onClick={runDeep}
                disabled={deepMutation.isPending}
              >
                {deepMutation.isPending ? tCommon("loading") : ta("deepResearchCta")}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function CompareAppsDashboardAuthed({ appIdA, appIdB }: { appIdA: string; appIdB: string }) {
  const t = useTranslations("compare");
  const tApps = useTranslations("apps");
  const ta = useTranslations("analysis");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const router = useRouter();

  const splitParam = searchParams.get("split");
  const splitOn =
    splitParam === "0" || splitParam === "false"
      ? false
      : true;

  const setSplit = (on: boolean) => {
    const p = new URLSearchParams(searchParams.toString());
    if (on) {
      p.delete("split");
    } else {
      p.set("split", "0");
    }
    const query = Object.fromEntries(p);
    router.push(Object.keys(query).length > 0 ? { pathname: "/compare", query } : "/compare");
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
          return rows.some((r) => ["pending", "running", "waiting_approval"].includes(r.status)) ? 3000 : false;
        },
      },
      {
        queryKey: queryKeys.apps.fetches(appIdB),
        queryFn: () => apiFetch<ReviewFetchDto[]>(`/api/v1/apps/${appIdB}/fetches`, { getToken }),
        enabled: true,
        refetchInterval: (q: { state: { data: ReviewFetchDto[] | undefined } }) => {
          const rows = q.state.data ?? [];
          return rows.some((r) => ["pending", "running", "waiting_approval"].includes(r.status)) ? 3000 : false;
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
      const { lang, country } = storeLocaleFromUiLocale(locale);
      const body = {
        from_date: args.fromDate,
        to_date: args.toDate,
        review_scope: "local" as const,
        lang,
        country,
        review_limit: 1000,
      };
      // Sırayla: aynı anda iki POST + kuyruk tetikleri yarışmasın (backend artık senkron enqueue).
      for (const id of args.appIds) {
        await apiFetch<ReviewFetchDto>(`/api/v1/apps/${id}/fetch`, {
          method: "POST",
          body,
          getToken,
        });
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.apps.fetches(appIdA) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.apps.fetches(appIdB) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.apps.recentFetches });
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
    if (queries.some((q) => q.isPending) || queries.some((q) => q.isError)) {
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
    <div className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <h2 className="mt-1 break-words text-xl font-semibold tracking-tight">{app.name}</h2>
      <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{app.package_name || app.bundle_id || "—"}</p>
      <dl className="mt-4 space-y-2 text-sm">
        {fetchRow &&
        (fetchRow.status === "waiting_approval" || fetchRow.status === "pending" || fetchRow.status === "running") ? null : (
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">{tApps("reviews")}</dt>
            <dd>{fetchRow?.review_count ?? "—"}</dd>
          </div>
        )}
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">{tApps("status")}</dt>
          <dd>
            {fetchRow
              ? fetchRow.status === "waiting_approval"
                ? tApps("statusWaitingApproval")
                : fetchRow.status === "pending"
                  ? tApps("statusPending")
                  : fetchRow.status === "running"
                    ? tApps("statusRunning")
                    : fetchRow.status === "completed"
                      ? tApps("statusCompleted")
                      : fetchRow.status === "failed"
                        ? tApps("statusFailed")
                        : fetchRow.status
              : "—"}
          </dd>
        </div>
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={{ pathname: "/apps/[id]", params: { id: app.id } }} className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}>
          {tApps("detailTitle")}
        </Link>
        {fetchRow?.status === "completed" ? (
          <Link
            href={{
              pathname: "/apps/[id]/analysis",
              params: { id: app.id },
              query: { fetchId: fetchRow.id },
            }}
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
      </div>

      {splitOn ? (
        <div className="flex min-w-0 flex-col rounded-xl border border-border bg-card/50 md:flex-row md:items-start">
          <CompareAppSplitPane
            title={t("slotA")}
            app={appA}
            fetchRow={fa}
            analysisItems={anaAq.data?.items ?? []}
          />
          <CompareAppSplitPane
            title={t("slotB")}
            app={appB}
            fetchRow={fb}
            analysisItems={anaBq.data?.items ?? []}
          />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title={t("slotA")} app={appA} fetchRow={fa} hasHeuristic={Boolean(hA)} />
          <Card title={t("slotB")} app={appB} fetchRow={fb} hasHeuristic={Boolean(hB)} />
        </div>
      )}

      {fa?.status === "completed" && fb?.status === "completed" ? (
        <CompareDeepResearchPanel appIdA={appIdA} appIdB={appIdB} fetchA={fa} fetchB={fb} />
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Link href="/analyze/store" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          {t("backToAnalyze")}
        </Link>
        <Link href="/compare" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
          {t("clearCompare")}
        </Link>
      </div>
    </div>
  );
}
