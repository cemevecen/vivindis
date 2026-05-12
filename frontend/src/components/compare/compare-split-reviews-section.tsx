"use client";

import { useAuth } from "@clerk/nextjs";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { apiFetch, formatClientFetchError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { ReviewFetchDto, ReviewListResponseDto } from "@/types/app";

const PAGE_SIZE = 30;

function reviewTone(rating: number): "positive" | "neutral" | "negative" {
  if (rating >= 4) {
    return "positive";
  }
  if (rating <= 2) {
    return "negative";
  }
  return "neutral";
}

type Props = {
  appId: string;
  fetchRow: ReviewFetchDto;
};

export function CompareSplitReviewsSection({ appId, fetchRow }: Props) {
  const fetchId = fetchRow.id;
  const t = useTranslations("compare");
  const ta = useTranslations("analysis");
  const tApps = useTranslations("apps");
  const tCommon = useTranslations("common");
  const { getToken } = useAuth();
  const [open, setOpen] = useState(false);
  const [reviewFilter, setReviewFilter] = useState<"all" | "positive" | "neutral" | "negative">("all");
  const [reviewSort, setReviewSort] = useState<"newest" | "oldest" | "rating_desc" | "rating_asc">("newest");

  const pollWhileImport =
    fetchRow.status === "pending" || fetchRow.status === "running" || fetchRow.status === "waiting_approval"
      ? 4000
      : false;

  const q = useInfiniteQuery({
    queryKey: ["compare", "split-reviews", appId, fetchId],
    initialPageParam: 0,
    queryFn: async ({ pageParam }: { pageParam: number }) => {
      return apiFetch<ReviewListResponseDto>(
        `/api/v1/apps/${appId}/reviews?fetch_id=${encodeURIComponent(fetchId)}&limit=${PAGE_SIZE}&offset=${pageParam}`,
        { getToken },
      );
    },
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, p) => sum + p.items.length, 0);
      return loaded < lastPage.total ? loaded : undefined;
    },
    enabled: Boolean(fetchId),
    refetchInterval: pollWhileImport,
  });

  const flat = useMemo(() => q.data?.pages.flatMap((p) => p.items) ?? [], [q.data?.pages]);
  const total = q.data?.pages[0]?.total ?? 0;

  const visible = useMemo(() => {
    const filtered =
      reviewFilter === "all" ? flat : flat.filter((row) => reviewTone(row.rating) === reviewFilter);
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
  }, [flat, reviewFilter, reviewSort]);

  if (q.isError) {
    return (
      <section className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
        <p className="text-xs font-medium text-destructive">{t("splitReviewsLoadError")}</p>
        <p className="mt-1 text-xs break-words text-destructive/90">{formatClientFetchError(q.error)}</p>
        <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => void q.refetch()}>
          {tCommon("retry")}
        </Button>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-border bg-card shadow-sm">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 p-3 text-left hover:bg-muted/30"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="min-w-0">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("splitReviewsHeading")}</h3>
          <p className="text-xs text-muted-foreground">
            {ta("reviewsLoadedMeta", { loaded: flat.length, total, visible: visible.length })}
          </p>
        </div>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open ? (
        <div className="space-y-2 border-t border-border px-3 pb-3 pt-2">
          <p className="text-[11px] text-muted-foreground">{t("splitReviewsFilterHint")}</p>
          <div className="flex flex-wrap gap-2">
            <select
              value={reviewFilter}
              onChange={(e) => setReviewFilter(e.target.value as typeof reviewFilter)}
              className="rounded-md border border-border bg-background px-2 py-1 text-xs"
              aria-label={ta("reviewsFilterAria")}
            >
              <option value="all">{ta("filterAll")}</option>
              <option value="positive">{ta("filterPositive")}</option>
              <option value="neutral">{ta("filterNeutral")}</option>
              <option value="negative">{ta("filterNegative")}</option>
            </select>
            <select
              value={reviewSort}
              onChange={(e) => setReviewSort(e.target.value as typeof reviewSort)}
              className="rounded-md border border-border bg-background px-2 py-1 text-xs"
              aria-label={ta("reviewsSortAria")}
            >
              <option value="newest">{ta("sortNewest")}</option>
              <option value="oldest">{ta("sortOldest")}</option>
              <option value="rating_desc">{ta("sortRatingDesc")}</option>
              <option value="rating_asc">{ta("sortRatingAsc")}</option>
            </select>
          </div>

          {q.isPending && flat.length === 0 ? (
            <p className="text-xs text-muted-foreground">{tCommon("loading")}</p>
          ) : visible.length === 0 && !q.isFetching ? (
            <p className="text-xs text-muted-foreground">
              {fetchRow.status === "completed" && total === 0 ? ta("noReviewsForFetch") : t("splitReviewsEmpty")}
            </p>
          ) : (
            <div className="max-h-[min(240px,35vh)] space-y-2 overflow-y-auto pr-1">
              {visible.map((row, idx) => (
                <article key={row.id} className="rounded-md border border-border bg-muted/20 p-2.5">
                  <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                    <p className="inline-flex items-center gap-1.5">
                      <span className="tabular-nums text-muted-foreground/80">#{idx + 1}</span>
                      <span
                        className={cn(
                          "inline-flex size-1.5 shrink-0 rounded-full",
                          reviewTone(row.rating) === "positive"
                            ? "bg-emerald-500"
                            : reviewTone(row.rating) === "negative"
                              ? "bg-red-500"
                              : "bg-muted-foreground/45",
                        )}
                        aria-hidden
                      />
                      <span>{ta("reviewCardRating", { rating: row.rating })}</span>
                    </p>
                    <p className="shrink-0">{row.review_date}</p>
                  </div>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {row.author ? ta("reviewCardReviewer", { name: row.author }) : ta("reviewCardReviewerUnset")}
                  </p>
                  <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground/80">
                    {row.platform === "google_play" ? tApps("platformGooglePlay") : tApps("platformAppStore")}
                  </p>
                  {row.title ? <p className="mt-1 line-clamp-2 text-xs font-medium">{row.title}</p> : null}
                  <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs leading-snug">{row.body}</p>
                </article>
              ))}
            </div>
          )}

          {flat.length > 0 && q.hasNextPage ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="w-full sm:w-auto"
              disabled={q.isFetchingNextPage}
              onClick={() => void q.fetchNextPage()}
            >
              {q.isFetchingNextPage
                ? tCommon("loading")
                : ta("expandShowMore", { count: Math.min(PAGE_SIZE, total - flat.length) })}
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
