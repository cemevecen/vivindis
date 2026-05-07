"use client";

import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
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

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, "\"\"")}"`;
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
  const [reviewItems, setReviewItems] = useState<ReviewListItemDto[]>([]);
  const [reviewTotal, setReviewTotal] = useState(0);
  const [reviewOffset, setReviewOffset] = useState(0);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewFilter, setReviewFilter] = useState<"all" | "positive" | "neutral" | "negative">("all");
  const [reviewSort, setReviewSort] = useState<"newest" | "oldest" | "rating_desc" | "rating_asc">("newest");

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
        ["index", "platform", "rating", "sentiment", "review_date", "author", "title", "body"],
        ...rows.map((row, idx) => [
          String(idx + 1),
          row.platform,
          String(row.rating),
          reviewTone(row.rating),
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
      a.download = `analiz-edilen-yorumlar-${fetchId ?? "export"}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(formatClientFetchError(e));
    }
  }, [fetchId, loadAllReviews]);

  const exportReviewsExcel = useCallback(async () => {
    try {
      const rows = await loadAllReviews();
      const XLSX = await import("xlsx");
      const worksheet = XLSX.utils.json_to_sheet(
        rows.map((row, idx) => ({
          index: idx + 1,
          platform: row.platform,
          rating: row.rating,
          sentiment: reviewTone(row.rating),
          review_date: row.review_date,
          author: row.author ?? "",
          title: row.title ?? "",
          body: row.body ?? "",
        })),
      );
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "yorumlar");
      XLSX.writeFile(workbook, `analiz-edilen-yorumlar-${fetchId ?? "export"}.xlsx`);
    } catch (e) {
      toast.error(formatClientFetchError(e));
    }
  }, [fetchId, loadAllReviews]);

  const exportReviewsPdf = useCallback(async () => {
    try {
      const rows = await loadAllReviews();
      const html = rows
        .map(
          (row, idx) =>
            `<article style="border:1px solid #e5e7eb;border-radius:12px;padding:12px;margin:10px 0;">
              <p style="font-size:12px;color:#64748b;">#${idx + 1} | ${row.platform} | puan: ${row.rating} | ${row.review_date} | ${reviewTone(row.rating)}</p>
              ${row.title ? `<h3 style="font-size:14px;margin:6px 0;">${row.title}</h3>` : ""}
              <p style="font-size:13px;white-space:pre-wrap;">${row.body}</p>
            </article>`,
        )
        .join("");
      const win = window.open("", "_blank");
      if (!win) {
        toast.error("PDF penceresi açılamadı.");
        return;
      }
      win.document.write(`
        <html><head><title>Analiz edilen yorumlar</title></head>
        <body style="font-family:Arial,sans-serif;padding:24px;">
          <h1>Analiz edilen yorumlar</h1>
          <p>Toplam yorum: ${rows.length}</p>
          ${html}
        </body></html>
      `);
      win.document.close();
      win.print();
    } catch (e) {
      toast.error(formatClientFetchError(e));
    }
  }, [loadAllReviews]);

  useEffect(() => {
    setReviewItems([]);
    setReviewTotal(0);
    setReviewOffset(0);
  }, [fetchId]);

  useEffect(() => {
    if (!fetchId || fetchQuery.data?.status !== "completed") {
      return;
    }
    void loadReviewChunk(0, true);
  }, [fetchId, fetchQuery.data?.status, loadReviewChunk]);

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
      ? "Kuyruga alindi, scraper worker bekleniyor..."
      : fetch.status === "running"
        ? `Yorumlar hizli cekiliyor... (${fetch.review_count} toplandi)`
        : busy
          ? "Gemini yapay zekasi analiz ediyor..."
          : "Analiz sonuclari hazir.";

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
        {fetch.status === "completed" && fetch.review_count === 0 ? (
          <p className="mt-2 text-xs text-amber-700">
            Bu aralık/kaynak için yorum bulunamadı. Tarih aralığını genişletin veya kaynak seçimini değiştirin.
          </p>
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

      {fetch.status === "completed" ? (
        <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Analiz edilen yorumlar</h2>
              <p className="text-xs text-muted-foreground">
                Yüklenen: {reviewItems.length}/{reviewTotal} · Görünen: {visibleReviewItems.length}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                value={reviewFilter}
                onChange={(e) => setReviewFilter(e.target.value as typeof reviewFilter)}
                className="rounded-md border border-border bg-background px-2 py-1 text-xs"
                aria-label="Yorum duygu filtresi"
              >
                <option value="all">Tümü</option>
                <option value="positive">Pozitif</option>
                <option value="neutral">Nötr</option>
                <option value="negative">Negatif</option>
              </select>
              <select
                value={reviewSort}
                onChange={(e) => setReviewSort(e.target.value as typeof reviewSort)}
                className="rounded-md border border-border bg-background px-2 py-1 text-xs"
                aria-label="Yorum sıralama"
              >
                <option value="newest">En yeni</option>
                <option value="oldest">En eski</option>
                <option value="rating_desc">Puan yüksek</option>
                <option value="rating_asc">Puan düşük</option>
              </select>
            </div>
          </div>
          {reviewItems.length === 0 && !reviewsLoading ? (
            <p className="text-sm text-muted-foreground">Bu fetch için gösterilecek yorum yok.</p>
          ) : (
            <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
              {visibleReviewItems.map((row, idx) => (
                <article key={row.id} className="rounded-lg border border-border bg-muted/20 p-3">
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <p className="inline-flex items-center gap-2">
                      #{idx + 1}
                      <span
                        className={cn(
                          "inline-flex size-2 rounded-full",
                          reviewTone(row.rating) === "positive"
                            ? "bg-emerald-500"
                            : reviewTone(row.rating) === "negative"
                              ? "bg-red-500"
                              : "bg-slate-400",
                        )}
                        aria-hidden
                      />
                      <span>| puan: {row.rating}</span>
                    </p>
                    <p>{row.review_date}</p>
                  </div>
                  <p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground/80">
                    {row.platform === "google_play" ? "Google Play" : "App Store"}
                  </p>
                  {row.title ? <p className="mt-1 text-sm font-medium">{row.title}</p> : null}
                  <p className="mt-1 whitespace-pre-wrap text-sm">{row.body}</p>
                </article>
              ))}
            </div>
          )}
          <div className="mt-3 grid gap-2 sm:grid-cols-4">
            <Button
              type="button"
              className="bg-slate-900 text-white hover:bg-slate-800"
              size="sm"
              disabled={reviewsLoading || reviewOffset >= reviewTotal}
              onClick={() => void loadReviewChunk(reviewOffset, false)}
            >
              {reviewsLoading
                ? tCommon("loading")
                : reviewOffset < reviewTotal
                  ? `Genişlet · ${reviewTotal - reviewOffset} yorum daha göster`
                  : "Tüm yorumlar yüklendi"}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => void exportReviewsCsv()}>
              Sonuçları CSV indir
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => void exportReviewsExcel()}>
              Sonuçları Excel indir
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => void exportReviewsPdf()}>
              Sonuçları PDF indir
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
