"use client";

import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Globe } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { AnalysisCharts } from "@/components/analysis/analysis-charts";
import { ReviewTimelineCharts } from "@/components/analysis/review-timeline-charts";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useRouter } from "@/i18n/routing";
import { downloadAnalysisCsvExport, downloadAnalysisJson } from "@/lib/analysis-export";
import {
  buildFullAnalysisPdfHtml,
  openHtmlPrintWindow,
  type AnalysisPdfLocaleStrings,
} from "@/lib/analysis-pdf-html";
import { ApiError, apiFetch, formatClientFetchError } from "@/lib/api";
import { GLOBAL_SCAN_LANG_CODES, MAX_GLOBAL_FETCH_LANGS } from "@/lib/global-scan-langs";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import type { AnalysisDto, AnalysisListDto, InsightsDto } from "@/types/analysis";
import type { AppDto } from "@/types/app";
import type { FetchStatus, ReviewFetchDto, ReviewListItemDto, ReviewListResponseDto } from "@/types/app";

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

function reviewTone(rating: number): "positive" | "neutral" | "negative" {
  if (rating >= 4) {
    return "positive";
  }
  if (rating <= 2) {
    return "negative";
  }
  return "neutral";
}

function reviewToneMessageKey(rating: number): "tonePositive" | "toneNeutral" | "toneNegative" {
  if (rating >= 4) {
    return "tonePositive";
  }
  if (rating <= 2) {
    return "toneNegative";
  }
  return "toneNeutral";
}

function ratingTierClasses(rating: number): { dot: string; text: string } {
  const safe = Math.max(1, Math.min(5, Math.round(rating)));
  if (safe <= 1) {
    return { dot: "bg-red-500", text: "text-red-600 dark:text-red-400" };
  }
  if (safe === 2) {
    return { dot: "bg-orange-500", text: "text-orange-600 dark:text-orange-400" };
  }
  if (safe === 3) {
    return { dot: "bg-yellow-500", text: "text-yellow-600 dark:text-yellow-400" };
  }
  if (safe === 4) {
    return { dot: "bg-lime-500", text: "text-lime-600 dark:text-lime-400" };
  }
  return { dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" };
}

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, "\"\"")}"`;
}

type Props = {
  appId: string;
  fetchId: string | undefined;
  clerkEnabled: boolean;
};

const TIMELINE_REVIEW_CAP = 20_000;
const GLOBAL_FETCH_META_PREFIX = "vivindis:globalFetchMeta:";

export function AnalysisPageClient({ appId, fetchId, clerkEnabled }: Props) {
  const t = useTranslations("analysis");
  const tAnalyzeHub = useTranslations("analyzeHub");
  const tDash = useTranslations("dashboard");
  const tApps = useTranslations("apps");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const exportBase = t("exportFileBase");
  const { getToken } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [reviewItems, setReviewItems] = useState<ReviewListItemDto[]>([]);
  const [reviewTotal, setReviewTotal] = useState(0);
  const [reviewOffset, setReviewOffset] = useState(0);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewFilter, setReviewFilter] = useState<"all" | "positive" | "neutral" | "negative">("all");
  const [reviewSort, setReviewSort] = useState<"newest" | "oldest" | "rating_desc" | "rating_asc">("newest");
  const [timelineReviews, setTimelineReviews] = useState<ReviewListItemDto[] | null>(null);
  const [timelineLoadState, setTimelineLoadState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [insightAlertFilter, setInsightAlertFilter] = useState<"all" | "triggered" | "high" | "medium" | "low">("all");
  const [deepFrom, setDeepFrom] = useState("");
  const [deepTo, setDeepTo] = useState("");
  const [deepLangs, setDeepLangs] = useState<Set<string>>(() => new Set(GLOBAL_SCAN_LANG_CODES.slice(0, MAX_GLOBAL_FETCH_LANGS)));
  const [globalScanMeta, setGlobalScanMeta] = useState<{ from: string; to: string; langs: string[] } | null>(null);

  const deepParam = searchParams.get("deep") === "1";

  const fetchQuery = useQuery({
    queryKey: fetchId ? queryKeys.reviews.fetchById(fetchId) : ["analysis", "fetch", "idle"],
    queryFn: () => apiFetch<ReviewFetchDto>(`/api/v1/fetches/${fetchId}`, { getToken }),
    enabled: Boolean(clerkEnabled && fetchId),
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return s === "pending" || s === "running" ? 1000 : false;
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
      return items.some((a) => a.status === "pending" || a.status === "running") ? 1000 : false;
    },
  });

  const appQuery = useQuery({
    queryKey: queryKeys.apps.detail(appId),
    queryFn: () => apiFetch<AppDto>(`/api/v1/apps/${appId}`, { getToken }),
    enabled: Boolean(clerkEnabled && appId),
  });

  const insightsQuery = useQuery({
    queryKey: ["analysis", "insights", appId, fetchId],
    queryFn: () =>
      apiFetch<InsightsDto>(`/api/v1/apps/${appId}/insights?fetch_id=${encodeURIComponent(fetchId ?? "")}`, {
        getToken,
      }),
    enabled: Boolean(clerkEnabled && appId && fetchId && fetchQuery.data?.status === "completed"),
  });

  useEffect(() => {
    const f = fetchQuery.data;
    if (!f) {
      return;
    }
    setDeepFrom(f.from_date);
    setDeepTo(f.to_date);
    // Sync when fetch id or server import range changes (not every query refetch)
  }, [fetchQuery.data?.id, fetchQuery.data?.from_date, fetchQuery.data?.to_date]); // eslint-disable-line react-hooks/exhaustive-deps -- see above

  useEffect(() => {
    if (!fetchQuery.data?.id) {
      return;
    }
    setDeepLangs(new Set(GLOBAL_SCAN_LANG_CODES.slice(0, MAX_GLOBAL_FETCH_LANGS)));
  }, [fetchQuery.data?.id]); // eslint-disable-line react-hooks/exhaustive-deps -- only when fetch id changes

  useEffect(() => {
    if (!deepParam || !fetchId) {
      setGlobalScanMeta(null);
      return;
    }
    try {
      const raw = sessionStorage.getItem(`${GLOBAL_FETCH_META_PREFIX}${fetchId}`);
      if (!raw) {
        setGlobalScanMeta(null);
        return;
      }
      const parsed = JSON.parse(raw) as { from?: string; to?: string; langs?: string[] };
      if (typeof parsed.from === "string" && typeof parsed.to === "string" && Array.isArray(parsed.langs)) {
        setGlobalScanMeta({
          from: parsed.from,
          to: parsed.to,
          langs: parsed.langs.filter((c): c is string => typeof c === "string"),
        });
      } else {
        setGlobalScanMeta(null);
      }
    } catch {
      setGlobalScanMeta(null);
    }
  }, [deepParam, fetchId]);

  const filteredInsightAlerts = useMemo(() => {
    const alerts = insightsQuery.data?.alerts ?? [];
    if (insightAlertFilter === "all") {
      return alerts;
    }
    if (insightAlertFilter === "triggered") {
      return alerts.filter((a) => a.triggered);
    }
    return alerts.filter((a) => a.severity === insightAlertFilter);
  }, [insightAlertFilter, insightsQuery.data?.alerts]);

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

  const analysisPdfCopy = useMemo((): AnalysisPdfLocaleStrings | null => {
    const f = fetchQuery.data;
    if (!f) {
      return null;
    }
    const truncatedNote =
      timelineReviews !== null &&
      timelineReviews.length > 0 &&
      timelineReviews.length < f.review_count
        ? t("timelineTruncatedHint", { loaded: timelineReviews.length, total: f.review_count })
        : "";
    return {
      docTitle: t("pdfFullReportDocTitle"),
      reportHeading: t("pdfReportHeading"),
      timelineTruncatedNote: truncatedNote,
      labelApp: t("pdfLabelApp"),
      labelImportRange: t("pdfLabelImportRange"),
      labelTotalInImport: t("pdfLabelTotalInImport"),
      labelPageUrl: t("pdfLabelPageUrl"),
      labelGenerated: t("pdfLabelGenerated"),
      sectionTimeline: t("timelineSectionHeading"),
      sectionHeuristic: t("heuristic"),
      sectionAi: t("ai"),
      sectionInsights: t("insightsTitle"),
      sectionReviewDetails: t("pdfSectionReviewList"),
      timelineVolumeTitle: t("timelineVolumeTitle"),
      timelineStarsStackTitle: t("timelineStarsStackTitle"),
      timelineAvgRatingTitle: t("timelineAvgRatingTitle"),
      pdfChartsDeckTitle: t("pdfChartsDeckTitle"),
      pdfAppendixDetails: t("pdfAppendixDetails"),
      pdfTableSubtitle: t("pdfTableSubtitle"),
      timelineBucketDay: t("timelineBucketDay"),
      timelineBucketWeek: t("timelineBucketWeek"),
      timelineBucketMonth: t("timelineBucketMonth"),
      timelineBucketYear: t("timelineBucketYear"),
      colPeriod: t("pdfColPeriod"),
      colCount: t("pdfColCount"),
      colAvgRating: t("pdfColAvgRating"),
      colStars: t("pdfColStars"),
      chartSentiment: t("chartSentiment"),
      chartRatings: t("chartRatings"),
      chartTopics: t("chartTopics"),
      overallScore: t("overallScore"),
      colSharePct: t("pdfColSharePct"),
      analysisPending: t("pdfAnalysisPending"),
      analysisRunning: t("pdfAnalysisRunning"),
      analysisFailed: t("analysisError"),
      analysisEmpty: t("noAnalysisYet"),
      modelLabel: t("pdfModelLabel"),
      yes: t("pdfYes"),
      no: t("pdfNo"),
      insightsRelease: t("insightsReleaseTitle"),
      insightsSegments: t("insightsSegmentsTitle"),
      insightsAvgRating: t("insightsAvgRating"),
      insightsActions: t("insightsActionsTitle"),
      insightsAlertsTitle: t("insightsAlertsTitle"),
      totalReviews: t("pdfTotalReviews"),
      ratingLabel: t("ratingLabel"),
      tonePositive: t("tonePositive"),
      toneNeutral: t("toneNeutral"),
      toneNegative: t("toneNegative"),
      platformGooglePlay: tApps("platformGooglePlay"),
      platformAppStore: tApps("platformAppStore"),
      insightColMetric: t("pdfInsightColMetric"),
      insightColValue: t("pdfInsightColValue"),
      insightColDelta: t("pdfInsightColDelta"),
      insightColTitle: t("pdfInsightColTitle"),
      insightColSev: t("pdfInsightColSev"),
      insightColOn: t("pdfInsightColOn"),
      insightColDetail: t("pdfInsightColDetail"),
      insightColP: t("pdfInsightColP"),
      insightColProblem: t("pdfInsightColProblem"),
      insightColReco: t("pdfInsightColReco"),
      insightColSegment: t("pdfInsightColSegment"),
      insightColReviews: t("pdfInsightColReviews"),
      insightBenchmarkScores: t("pdfInsightBenchmarkScores"),
    };
  }, [fetchQuery.data, timelineReviews, t, tApps]);

  const copyAnalysisPageLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success(t("shareLinkCopied"));
    } catch {
      toast.error(t("shareCopyFailed"));
    }
  }, [t]);

  const shareAnalysisPage = useCallback(async () => {
    if (!navigator.share) {
      return;
    }
    try {
      await navigator.share({
        title: t("pageTitle"),
        text: t("shareNativeBody", { name: appQuery.data?.name ?? "" }),
        url: window.location.href,
      });
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        return;
      }
      toast.error(t("shareFailed"));
    }
  }, [appQuery.data?.name, t]);

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

  const toggleDeepLang = useCallback(
    (code: string) => {
      setDeepLangs((prev) => {
        const next = new Set(prev);
        if (next.has(code)) {
          next.delete(code);
        } else {
          if (next.size >= MAX_GLOBAL_FETCH_LANGS) {
            toast.error(t("deepResearchLangLimitToast"));
            return prev;
          }
          next.add(code);
        }
        return next;
      });
    },
    [t],
  );

  const selectFirst24DeepLangs = useCallback(() => {
    setDeepLangs(new Set(GLOBAL_SCAN_LANG_CODES.slice(0, MAX_GLOBAL_FETCH_LANGS)));
  }, []);

  const clearDeepLangs = useCallback(() => {
    setDeepLangs(new Set());
  }, []);

  const isDeepLangsFirst24Preset = useMemo(() => {
    if (deepLangs.size !== MAX_GLOBAL_FETCH_LANGS) {
      return false;
    }
    return GLOBAL_SCAN_LANG_CODES.slice(0, MAX_GLOBAL_FETCH_LANGS).every((c) => deepLangs.has(c));
  }, [deepLangs]);

  const deepLangSelectAllRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const el = deepLangSelectAllRef.current;
    if (!el) {
      return;
    }
    el.indeterminate = deepLangs.size > 0 && !isDeepLangsFirst24Preset;
  }, [deepLangs, isDeepLangsFirst24Preset]);

  const deepResearchMutation = useMutation({
    mutationFn: async () => {
      if (!fetchId || !fetchQuery.data) {
        throw new Error("fetchId");
      }
      const langs = Array.from(deepLangs).sort();
      if (langs.length < 1) {
        throw new Error("lang");
      }
      const created = await apiFetch<ReviewFetchDto>(`/api/v1/apps/${appId}/fetch`, {
        method: "POST",
        body: {
          from_date: deepFrom,
          to_date: deepTo,
          review_scope: "global",
          global_langs: langs,
        },
        getToken,
      });
      return created;
    },
    onSuccess: async (created) => {
      try {
        sessionStorage.setItem(
          `${GLOBAL_FETCH_META_PREFIX}${created.id}`,
          JSON.stringify({
            from: deepFrom,
            to: deepTo,
            langs: Array.from(deepLangs).sort(),
          }),
        );
      } catch {
        /* storage full or unavailable */
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.apps.fetches(appId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.analyses.byApp(appId) });
      toast.success(t("globalQueued"));
      router.push(`/apps/${appId}/analysis?fetchId=${created.id}&deep=1`);
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : tCommon("error"));
    },
  });

  const runDeepResearch = useCallback(() => {
    if (deepLangs.size < 1) {
      toast.error(t("deepResearchNeedOneLang"));
      return;
    }
    if (!deepFrom || !deepTo || deepFrom > deepTo) {
      toast.error(t("deepResearchInvalidRange"));
      return;
    }
    deepResearchMutation.mutate();
  }, [deepFrom, deepTo, deepLangs, deepResearchMutation, t]);

  const loadReviewChunk = useCallback(
    async (nextOffset: number, reset: boolean) => {
      if (!fetchId) {
        return;
      }
      setReviewsLoading(true);
      try {
        const chunk = await apiFetch<ReviewListResponseDto>(
          `/api/v1/apps/${appId}/reviews?fetch_id=${encodeURIComponent(fetchId)}&limit=100&offset=${nextOffset}`,
          { getToken },
        );
        setReviewTotal(chunk.total);
        setReviewOffset(nextOffset + chunk.items.length);
        setReviewItems((prev) => (reset ? chunk.items : [...prev, ...chunk.items]));
      } catch (e) {
        toast.error(formatClientFetchError(e));
      } finally {
        setReviewsLoading(false);
      }
    },
    [appId, fetchId, getToken],
  );

  const loadAllReviews = useCallback(async (): Promise<ReviewListItemDto[]> => {
    if (!fetchId) {
      return [];
    }
    const all: ReviewListItemDto[] = [];
    let offset = 0;
    let total = 0;
    for (;;) {
      const chunk = await apiFetch<ReviewListResponseDto>(
        `/api/v1/apps/${appId}/reviews?fetch_id=${encodeURIComponent(fetchId)}&limit=100&offset=${offset}`,
        { getToken },
      );
      total = chunk.total;
      all.push(...chunk.items);
      offset += chunk.items.length;
      if (offset >= total || chunk.items.length === 0) {
        break;
      }
    }
    return all;
  }, [appId, fetchId, getToken]);

  const visibleReviewItems = useMemo(() => {
    const filtered =
      reviewFilter === "all" ? reviewItems : reviewItems.filter((row) => reviewTone(row.rating) === reviewFilter);
    return [...filtered].sort((a, b) => {
      if (reviewSort === "rating_desc") {
        return b.rating - a.rating;
      }
      if (reviewSort === "rating_asc") {
        return a.rating - b.rating;
      }
      const da = Date.parse(a.review_date);
      const db = Date.parse(b.review_date);
      if (reviewSort === "oldest") {
        return da - db;
      }
      return db - da;
    });
  }, [reviewFilter, reviewItems, reviewSort]);

  const exportReviewsCsv = useCallback(async () => {
    try {
      const rows = await loadAllReviews();
      const csvRows = [
        [
          t("csvHeaderIndex"),
          t("csvHeaderPlatform"),
          t("csvHeaderRating"),
          t("csvHeaderSentiment"),
          t("csvHeaderReviewDate"),
          t("csvHeaderAuthor"),
          t("csvHeaderTitle"),
          t("csvHeaderBody"),
        ],
        ...rows.map((row, idx) => [
          String(idx + 1),
          row.platform,
          String(row.rating),
          t(reviewToneMessageKey(row.rating)),
          row.review_date,
          row.author ?? "",
          row.title ?? "",
          row.body ?? "",
        ]),
      ];
      const csv = csvRows.map((r) => r.map(csvEscape).join(",")).join("\n");
      const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${exportBase}-${fetchId ?? "export"}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(formatClientFetchError(e));
    }
  }, [exportBase, fetchId, loadAllReviews, t]);

  const exportReviewsExcel = useCallback(async () => {
    try {
      const rows = await loadAllReviews();
      const XLSX = await import("xlsx");
      const worksheet = XLSX.utils.json_to_sheet(
        rows.map((row, idx) => ({
          [t("csvHeaderIndex")]: idx + 1,
          [t("csvHeaderPlatform")]: row.platform,
          [t("csvHeaderRating")]: row.rating,
          [t("csvHeaderSentiment")]: t(reviewToneMessageKey(row.rating)),
          [t("csvHeaderReviewDate")]: row.review_date,
          [t("csvHeaderAuthor")]: row.author ?? "",
          [t("csvHeaderTitle")]: row.title ?? "",
          [t("csvHeaderBody")]: row.body ?? "",
        })),
      );
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, t("exportSheetName"));
      XLSX.writeFile(workbook, `${exportBase}-${fetchId ?? "export"}.xlsx`);
    } catch (e) {
      toast.error(formatClientFetchError(e));
    }
  }, [exportBase, fetchId, loadAllReviews, t]);

  const exportFullAnalysisPdf = useCallback(async () => {
    const f = fetchQuery.data;
    if (!f || !fetchId || !analysisPdfCopy || !appQuery.data) {
      toast.error(tCommon("error"));
      return;
    }
    try {
      const rows = await loadAllReviews();
      const items = analysesForFetch(analysesQuery.data?.items ?? [], fetchId);
      const heur = latestByType(items, "heuristic");
      const aiRow = latestByType(items, "ai");
      const generatedAtLabel = new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : locale, {
        dateStyle: "full",
        timeStyle: "short",
      }).format(new Date());
      const html = buildFullAnalysisPdfHtml({
        copy: analysisPdfCopy,
        appName: appQuery.data.name,
        fetch: f,
        pageUrl: window.location.href,
        generatedAtLabel,
        timelineReviews,
        timelineLocale: locale,
        heuristic: heur,
        ai: aiRow,
        insights: insightsQuery.data,
        reviewRows: rows,
      });
      const win = openHtmlPrintWindow(html);
      if (!win) {
        toast.error(t("pdfWindowError"));
      }
    } catch (e) {
      toast.error(formatClientFetchError(e));
    }
  }, [
    analysisPdfCopy,
    analysesQuery.data,
    appQuery.data,
    fetchId,
    fetchQuery.data,
    insightsQuery.data,
    loadAllReviews,
    locale,
    t,
    tCommon,
    timelineReviews,
  ]);

  useEffect(() => {
    setReviewItems([]);
    setReviewTotal(0);
    setReviewOffset(0);
    setTimelineReviews(null);
    setTimelineLoadState("idle");
  }, [fetchId]);

  useEffect(() => {
    if (!fetchId || fetchQuery.data?.status !== "completed") {
      return;
    }
    void loadReviewChunk(0, true);
  }, [fetchId, fetchQuery.data?.status, loadReviewChunk]);

  useEffect(() => {
    if (!fetchId || !clerkEnabled || fetchQuery.data?.status !== "completed") {
      return;
    }
    const total = fetchQuery.data.review_count;
    if (total <= 0) {
      setTimelineReviews([]);
      setTimelineLoadState("ready");
      return;
    }
    let cancelled = false;
    setTimelineLoadState("loading");
    void (async () => {
      try {
        const all: ReviewListItemDto[] = [];
        let offset = 0;
        const cap = Math.min(total, TIMELINE_REVIEW_CAP);
        for (;;) {
          const chunk = await apiFetch<ReviewListResponseDto>(
            `/api/v1/apps/${appId}/reviews?fetch_id=${encodeURIComponent(fetchId)}&limit=100&offset=${offset}`,
            { getToken },
          );
          all.push(...chunk.items);
          offset += chunk.items.length;
          if (cancelled) {
            return;
          }
          if (offset >= cap || offset >= chunk.total || chunk.items.length === 0) {
            break;
          }
        }
        if (!cancelled) {
          setTimelineReviews(all);
          setTimelineLoadState("ready");
        }
      } catch {
        if (!cancelled) {
          setTimelineLoadState("error");
          setTimelineReviews(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [appId, clerkEnabled, fetchId, fetchQuery.data?.review_count, fetchQuery.data?.status, getToken]);

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
  const liveStatusHint =
    fetch.status === "pending"
      ? t("liveStatusPending")
      : fetch.status === "running"
        ? tAnalyzeHub("fetchHintRunningNoCount")
        : busy
          ? t("liveStatusAnalyzing")
          : t("liveStatusReady");

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
          <p className="text-sm text-muted-foreground">{liveStatusHint}</p>
        </div>
        <div className="flex min-w-[12rem] flex-col gap-2 sm:items-end">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("shareHeading")}</p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => void copyAnalysisPageLink()}>
              {t("shareCopyLink")}
            </Button>
            {typeof navigator !== "undefined" && typeof navigator.share === "function" ? (
              <Button type="button" variant="outline" size="sm" onClick={() => void shareAnalysisPage()}>
                {t("shareNative")}
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {appQuery.data ? (
        <section className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("activeAppLabel")}</p>
          <div className="mt-2 flex items-center gap-3">
            {appQuery.data.icon_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- external app icon URL
              <img
                src={appQuery.data.icon_url}
                alt=""
                width={44}
                height={44}
                className="size-11 rounded-lg border border-border bg-muted/30 object-cover"
              />
            ) : (
              <div className="size-11 rounded-lg border border-dashed border-border bg-muted/40" />
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{appQuery.data.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {appQuery.data.platform === "google_play"
                  ? tApps("platformGooglePlay")
                  : appQuery.data.platform === "app_store"
                    ? tApps("platformAppStore")
                    : tApps("platformBoth")}
                {" · "}
                {appQuery.data.platform === "app_store"
                  ? appQuery.data.bundle_id || "—"
                  : appQuery.data.package_name || "—"}
              </p>
            </div>
          </div>
        </section>
      ) : null}

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
        {fetch.status === "pending" || fetch.status === "running" ? null : (
          <p className="mt-2 text-xs text-muted-foreground">
            {tApps("reviews")}: {fetch.review_count}
          </p>
        )}
        {fetch.status === "completed" && fetch.review_count === 0 ? (
          <p className="mt-2 text-xs text-amber-700">{t("noReviewsInRange")}</p>
        ) : null}
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

      <section
        className={cn(
          "relative overflow-hidden rounded-2xl border-2 border-violet-500/40 bg-gradient-to-br from-violet-500/[0.14] via-primary/[0.09] to-amber-500/[0.12] p-5 shadow-md ring-1 ring-violet-500/15",
          "dark:border-violet-400/35 dark:from-violet-500/[0.18] dark:via-primary/[0.12] dark:to-amber-500/[0.1] dark:ring-violet-400/20",
        )}
      >
        <div
          className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-violet-500/20 blur-2xl dark:bg-violet-400/15"
          aria-hidden
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-primary text-white shadow-lg dark:from-violet-500 dark:to-primary"
            aria-hidden
          >
            <Globe className="h-6 w-6" strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            {!deepParam ? (
              <>
                <p className="text-base font-semibold tracking-tight text-foreground">{t("localResultNotice")}</p>
                <p className="text-sm font-medium text-foreground/95">{t("globalUpsellHint")}</p>
              </>
            ) : (
              <>
                <p className="text-base font-semibold tracking-tight text-foreground">{t("deepResearchGlobalResultsTitle")}</p>
                <p className="text-sm text-muted-foreground">{t("deepResearchRunAnotherHint")}</p>
              </>
            )}
            <p className="text-xs leading-relaxed text-muted-foreground">{t("globalTop30Hint")}</p>

            <div className="space-y-4 rounded-xl border border-white/40 bg-background/60 p-4 dark:border-white/10 dark:bg-background/40">
              <p className="text-sm font-semibold text-foreground">{t("deepResearchPrepTitle")}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="deep-from">{t("deepResearchDateFromLabel")}</Label>
                  <Input
                    id="deep-from"
                    type="date"
                    value={deepFrom}
                    max={deepTo || undefined}
                    onChange={(e) => setDeepFrom(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="deep-to">{t("deepResearchDateToLabel")}</Label>
                  <Input
                    id="deep-to"
                    type="date"
                    value={deepTo}
                    min={deepFrom || undefined}
                    onChange={(e) => setDeepTo(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t("globalLangsLabel")}</Label>
                <p className="text-xs text-muted-foreground">{t("globalLangsHint")}</p>
                <p className="text-xs text-amber-800 dark:text-amber-200">{t("deepResearchLangCapHint")}</p>
                <p className="text-xs text-muted-foreground">{t("deepResearchWiderHint")}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={selectFirst24DeepLangs}>
                    {t("deepResearchSelectAll24")}
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={clearDeepLangs}>
                    {t("deepResearchClearLangs")}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {deepLangs.size}/{MAX_GLOBAL_FETCH_LANGS}
                  </span>
                </div>
                <div className="max-h-[min(22rem,50vh)] overflow-y-auto rounded-md border border-border bg-card/50 p-2">
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1 sm:grid-cols-3 md:grid-cols-4">
                    <label className="col-span-full mb-1 flex cursor-pointer items-center gap-2 border-b border-border/60 pb-2 text-sm font-medium hover:bg-muted/40">
                      <input
                        ref={deepLangSelectAllRef}
                        type="checkbox"
                        className="size-4 rounded border-border"
                        checked={isDeepLangsFirst24Preset}
                        onChange={() => {
                          if (isDeepLangsFirst24Preset) {
                            clearDeepLangs();
                          } else {
                            selectFirst24DeepLangs();
                          }
                        }}
                      />
                      <span>{t("deepResearchLangCheckboxAll")}</span>
                    </label>
                    {langOptions.map(({ code, label }) => (
                      <label
                        key={code}
                        className="flex min-w-0 cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-xs hover:bg-muted/60 sm:text-sm"
                      >
                        <input
                          type="checkbox"
                          className="size-4 shrink-0 rounded border-border"
                          checked={deepLangs.has(code)}
                          onChange={() => {
                            toggleDeepLang(code);
                          }}
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
              size="lg"
              className="w-full rounded-xl font-semibold shadow-sm sm:w-auto"
              onClick={() => {
                runDeepResearch();
              }}
              disabled={deepResearchMutation.isPending || fetch.status !== "completed"}
            >
              {deepResearchMutation.isPending ? tCommon("loading") : t("deepResearchCta")}
            </Button>
          </div>
        </div>
      </section>

      {deepParam ? (
        <section className="rounded-lg border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-foreground">{t("deepResearchStatusTitle")}</p>
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
          <p className="mt-1 text-sm text-muted-foreground">
            {fetch.status === "pending" || fetch.status === "running"
              ? t("deepResearchStatusRunning")
              : fetch.status === "completed"
                ? t("deepResearchStatusCompleted")
                : t("deepResearchStatusFailed")}
          </p>
          {globalScanMeta ? (
            <div className="mt-3 rounded-lg border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground">{t("deepResearchPlannedParams")}</p>
              <p className="mt-1">{t("deepResearchParamRange", { from: globalScanMeta.from, to: globalScanMeta.to })}</p>
              <p className="mt-1 break-words">
                {t("deepResearchParamLangs", {
                  count: globalScanMeta.langs.length,
                  list:
                    [...globalScanMeta.langs].slice(0, 14).join(", ") +
                    (globalScanMeta.langs.length > 14 ? "…" : ""),
                })}
              </p>
            </div>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">
              {t("deepResearchParamRange", { from: fetch.from_date, to: fetch.to_date })}
            </p>
          )}
          <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3">
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>{t("deepResearchCollectedLabel")}</span>
              <span className="font-semibold text-foreground">{fetch.review_count}</span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  fetch.status === "failed"
                    ? "w-full bg-destructive/80"
                    : fetch.status === "completed"
                      ? "w-full bg-emerald-500"
                      : "w-1/3 animate-pulse bg-primary",
                )}
              />
            </div>
          </div>
        </section>
      ) : null}

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

      {fetch.status === "completed" && fetch.review_count > 0 ? (
        timelineLoadState === "loading" || timelineLoadState === "idle" ? (
          <div className="space-y-3 rounded-2xl border border-border bg-muted/20 p-6" aria-busy="true">
            <div className="h-5 w-48 animate-pulse rounded bg-muted" />
            <div className="h-[300px] animate-pulse rounded-xl bg-muted" />
          </div>
        ) : timelineLoadState === "error" ? (
          <p className="text-sm text-muted-foreground">{t("timelineLoadError")}</p>
        ) : timelineReviews ? (
          <ReviewTimelineCharts
            reviews={timelineReviews}
            locale={locale}
            isPartial={timelineReviews.length < fetch.review_count}
            totalExpected={fetch.review_count}
            fetchFromDate={fetch.from_date}
            fetchToDate={fetch.to_date}
            labels={{
              sectionHeading: t("timelineSectionHeading"),
              bucketDay: t("timelineBucketDay"),
              bucketWeek: t("timelineBucketWeek"),
              bucketMonth: t("timelineBucketMonth"),
              bucketYear: t("timelineBucketYear"),
              volumeTitle: t("timelineVolumeTitle"),
              starsStackTitle: t("timelineStarsStackTitle"),
              avgRatingTitle: t("timelineAvgRatingTitle"),
              empty: t("timelineEmpty"),
              starShort: (n) => t("timelineStarLabel", { star: n }),
              truncatedHint: t("timelineTruncatedHint", {
                loaded: timelineReviews.length,
                total: fetch.review_count,
              }),
            }}
          />
        ) : null
      ) : null}

      <AnalysisCharts
        heuristic={heuristic}
        ai={ai}
        chartLabels={chartLabels}
        chartLayout="featured"
        stackAiBelow
      />

      {insightsQuery.data ? (
        <section className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-sm">
          <h2 className="text-base font-semibold">{t("insightsTitle")}</h2>
          <div className="grid gap-3 md:grid-cols-3">
            {insightsQuery.data.benchmark.scores.map((s) => (
              <article key={s.label} className="rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</p>
                <p className="mt-1 text-xl font-semibold text-foreground">{s.value.toFixed(2)}</p>
                <p
                  className={cn(
                    "text-xs",
                    s.direction === "up"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : s.direction === "down"
                        ? "text-red-600 dark:text-red-400"
                        : "text-muted-foreground",
                  )}
                >
                  {t("insightsDeltaPrefix")} {s.delta_vs_category.toFixed(2)}
                </p>
              </article>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <article className="rounded-lg border border-border bg-muted/20 p-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">{t("insightsAlertsTitle")}</h3>
                <select
                  value={insightAlertFilter}
                  onChange={(e) => setInsightAlertFilter(e.target.value as typeof insightAlertFilter)}
                  className="rounded-md border border-border bg-background px-2 py-1 text-xs"
                  aria-label={t("insightsAlertFilterAria")}
                >
                  <option value="all">{t("insightsFilterAll")}</option>
                  <option value="triggered">{t("insightsFilterTriggered")}</option>
                  <option value="high">{t("insightsFilterHigh")}</option>
                  <option value="medium">{t("insightsFilterMedium")}</option>
                  <option value="low">{t("insightsFilterLow")}</option>
                </select>
              </div>
              <div className="mt-2 space-y-2">
                {filteredInsightAlerts.map((a) => (
                  <div key={a.key} className="rounded-md border border-border bg-card p-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">
                        {a.title} {a.triggered ? "•" : ""}
                      </p>
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                          a.severity === "high"
                            ? "bg-red-500/15 text-red-700 dark:text-red-300"
                            : a.severity === "medium"
                              ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                              : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
                        )}
                      >
                        {a.severity}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{a.detail}</p>
                  </div>
                ))}
                {filteredInsightAlerts.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t("insightsNoAlertsInFilter")}</p>
                ) : null}
              </div>
            </article>
            <article className="rounded-lg border border-border bg-muted/20 p-3">
              <h3 className="text-sm font-semibold">{t("insightsActionsTitle")}</h3>
              <div className="mt-2 space-y-2">
                {insightsQuery.data.actions.map((a, idx) => (
                  <div key={`${a.problem}-${idx}`} className="rounded-md border border-border bg-card p-2">
                    <p className="text-sm font-medium text-foreground">
                      {a.priority} · {a.problem}
                    </p>
                    <p className="text-xs text-muted-foreground">{a.recommendation}</p>
                  </div>
                ))}
              </div>
            </article>
          </div>
          <article className="rounded-lg border border-border bg-muted/20 p-3">
            <h3 className="text-sm font-semibold">{t("insightsReleaseTitle")}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{insightsQuery.data.release_impact.summary}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {insightsQuery.data.release_impact.current_version ?? "—"} vs{" "}
              {insightsQuery.data.release_impact.previous_version ?? "—"} · Δ{" "}
              {insightsQuery.data.release_impact.rating_delta?.toFixed(2) ?? "—"}
            </p>
          </article>
          <article className="rounded-lg border border-border bg-muted/20 p-3">
            <h3 className="text-sm font-semibold">{t("insightsSegmentsTitle")}</h3>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              {insightsQuery.data.segments.map((s) => (
                <div key={s.segment} className="rounded-md border border-border bg-card p-2">
                  <p className="text-xs text-muted-foreground">{s.segment}</p>
                  <p className="text-sm font-medium text-foreground">
                    {s.reviews} · {t("insightsAvgRating")} {s.avg_rating.toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          </article>
        </section>
      ) : null}

      {fetch.status === "completed" ? (
        <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">{t("analyzedReviewsHeading")}</h2>
              <p className="text-xs text-muted-foreground">
                {t("reviewsLoadedMeta", {
                  loaded: reviewItems.length,
                  total: reviewTotal,
                  visible: visibleReviewItems.length,
                })}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                value={reviewFilter}
                onChange={(e) => setReviewFilter(e.target.value as typeof reviewFilter)}
                className="rounded-md border border-border bg-background px-2 py-1 text-xs"
                aria-label={t("reviewsFilterAria")}
              >
                <option value="all">{t("filterAll")}</option>
                <option value="positive">{t("filterPositive")}</option>
                <option value="neutral">{t("filterNeutral")}</option>
                <option value="negative">{t("filterNegative")}</option>
              </select>
              <select
                value={reviewSort}
                onChange={(e) => setReviewSort(e.target.value as typeof reviewSort)}
                className="rounded-md border border-border bg-background px-2 py-1 text-xs"
                aria-label={t("reviewsSortAria")}
              >
                <option value="newest">{t("sortNewest")}</option>
                <option value="oldest">{t("sortOldest")}</option>
                <option value="rating_desc">{t("sortRatingDesc")}</option>
                <option value="rating_asc">{t("sortRatingAsc")}</option>
              </select>
            </div>
          </div>
          {reviewItems.length === 0 && !reviewsLoading ? (
            <p className="text-sm text-muted-foreground">{t("noReviewsForFetch")}</p>
          ) : (
            <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
              {visibleReviewItems.map((row, idx) => {
                const ratingClasses = ratingTierClasses(row.rating);
                return (
                <article key={row.id} className="rounded-lg border border-border bg-muted/20 p-3">
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <p className="inline-flex items-center gap-2">
                      #{idx + 1}
                      <span className={cn("inline-flex size-2 rounded-full", ratingClasses.dot)} aria-hidden />
                      <span className={cn("font-semibold", ratingClasses.text)}>
                        {t("reviewCardRating", { rating: row.rating })}
                      </span>
                    </p>
                    <p>{row.review_date}</p>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {row.author
                      ? t("reviewCardReviewer", { name: row.author })
                      : t("reviewCardReviewerUnset")}
                  </p>
                  <p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground/80">
                    {row.platform === "google_play" ? tApps("platformGooglePlay") : tApps("platformAppStore")}
                  </p>
                  {row.title ? <p className="mt-1 text-sm font-medium">{row.title}</p> : null}
                  <p className="mt-1 whitespace-pre-wrap text-sm">{row.body}</p>
                </article>
                );
              })}
            </div>
          )}
          <div className="mt-3 grid gap-2 sm:grid-cols-4">
            <Button
              type="button"
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              size="sm"
              disabled={reviewsLoading || reviewOffset >= reviewTotal}
              onClick={() => void loadReviewChunk(reviewOffset, false)}
            >
              {reviewsLoading
                ? tCommon("loading")
                : reviewOffset < reviewTotal
                  ? t("expandShowMore", { count: reviewTotal - reviewOffset })
                  : t("allReviewsLoaded")}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => void exportReviewsCsv()}>
              {t("exportResultsCsv")}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => void exportReviewsExcel()}>
              {t("exportResultsExcel")}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => void exportFullAnalysisPdf()}>
              {t("exportResultsPdf")}
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
