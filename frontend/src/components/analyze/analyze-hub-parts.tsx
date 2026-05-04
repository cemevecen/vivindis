"use client";

import { ExternalLink, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AppDto } from "@/types/app";
import type { StoreSearchResultItem } from "@/types/store-search";

export function SegmentedTwo({
  ariaLabel,
  left,
  right,
  value,
  onChange,
}: {
  ariaLabel: string;
  left: string;
  right: string;
  value: "left" | "right";
  onChange: (v: "left" | "right") => void;
}) {
  return (
    <div
      className="flex rounded-2xl border border-slate-200/90 bg-slate-100/90 p-1 shadow-inner"
      role="group"
      aria-label={ariaLabel}
    >
      <button
        type="button"
        className={cn(
          "flex-1 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
          value === "left"
            ? "border border-orange-400 bg-orange-50 text-slate-900 shadow-sm"
            : "text-slate-600 hover:bg-white/60",
        )}
        onClick={() => onChange("left")}
      >
        {left}
      </button>
      <button
        type="button"
        className={cn(
          "flex-1 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
          value === "right"
            ? "border border-orange-400 bg-orange-50 text-slate-900 shadow-sm"
            : "text-slate-600 hover:bg-white/60",
        )}
        onClick={() => onChange("right")}
      >
        {right}
      </button>
    </div>
  );
}

export function PinnedStoreAppCard({
  hit,
  app,
  onClear,
}: {
  hit: StoreSearchResultItem;
  app: AppDto;
  onClear: () => void;
}) {
  const t = useTranslations("analyzeHub");
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-orange-200/80 bg-gradient-to-br from-orange-50/90 to-amber-50/50 p-4 shadow-sm">
      <div className="flex min-w-0 flex-1 gap-3">
        {hit.icon ? (
          // eslint-disable-next-line @next/next/no-img-element -- harici mağaza CDN
          <img
            src={hit.icon}
            alt=""
            width={48}
            height={48}
            className="size-12 shrink-0 rounded-xl border border-orange-100 bg-white object-cover"
          />
        ) : (
          <div className="size-12 shrink-0 rounded-xl border border-dashed border-orange-200 bg-white/80" />
        )}
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-orange-800/90">{t("pinnedCardLabel")}</p>
          <p className="truncate text-base font-semibold text-slate-900">{app.name}</p>
          <p className="truncate font-mono text-xs text-slate-600">{hit.platform === "google_play" ? hit.id : `id ${hit.id}`}</p>
        </div>
      </div>
      <Button type="button" variant="outline" size="sm" className="shrink-0 gap-1" onClick={onClear}>
        <X className="size-3.5" aria-hidden />
        {t("clearPinnedSelection")}
      </Button>
    </div>
  );
}

export function StoreResultCard({
  hit,
  onSelect,
  selectLabel,
}: {
  hit: StoreSearchResultItem;
  onSelect: (hit: StoreSearchResultItem) => void;
  selectLabel: string;
}) {
  const t = useTranslations("analyzeHub");
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(hit)}
        className="flex w-full gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60"
      >
        {hit.icon ? (
          // eslint-disable-next-line @next/next/no-img-element -- harici mağaza CDN
          <img
            src={hit.icon}
            alt=""
            width={56}
            height={56}
            className="size-14 shrink-0 rounded-xl border border-slate-200 bg-slate-100 object-cover"
          />
        ) : (
          <div className="size-14 shrink-0 rounded-xl border border-dashed border-slate-200 bg-slate-100" />
        )}
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate font-medium text-slate-900">{hit.name}</p>
          <p className="truncate text-xs text-slate-500">
            {hit.platform === "google_play" ? hit.id : `id: ${hit.id}`}
          </p>
          {hit.developer ? <p className="truncate text-xs text-slate-500">{hit.developer}</p> : null}
          {hit.rating != null ? (
            <p className="text-xs font-medium text-slate-800">{t("ratingShort", { score: hit.rating.toFixed(1) })}</p>
          ) : null}
          {hit.review_count != null ? (
            <p className="text-xs text-slate-500">
              {hit.review_count.toLocaleString()} {t("reviewsCount")}
            </p>
          ) : null}
          {hit.store_url ? (
            <a
              href={hit.store_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-sky-700 underline-offset-4 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {t("openStoreLink")}
              <ExternalLink className="size-3 shrink-0" aria-hidden />
            </a>
          ) : null}
          <p className="text-xs font-medium text-orange-700">{selectLabel}</p>
        </div>
      </button>
    </li>
  );
}
