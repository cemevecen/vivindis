"use client";

import { ExternalLink, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button, buttonVariants } from "@/components/ui/button";
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
      className="flex rounded-2xl border border-border bg-muted p-1 shadow-inner"
      role="group"
      aria-label={ariaLabel}
    >
      <button
        type="button"
        className={cn(
          "flex-1 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
          value === "left"
            ? "border border-primary/30 bg-card text-foreground shadow-sm"
            : "text-muted-foreground hover:bg-card/70",
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
            ? "border border-primary/30 bg-card text-foreground shadow-sm"
            : "text-muted-foreground hover:bg-card/70",
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
  isResolving,
  onClear,
  onSearchAnother,
}: {
  hit: StoreSearchResultItem;
  app: AppDto | null;
  isResolving: boolean;
  onClear: () => void;
  onSearchAnother: () => void;
}) {
  const t = useTranslations("analyzeHub");
  const title = app?.name ?? hit.name;
  return (
    <div className="rounded-2xl border border-orange-200/30 bg-gradient-to-br from-orange-50/25 via-card to-amber-50/15 p-5 shadow-sm dark:border-orange-800/25 dark:from-orange-950/12 dark:via-card dark:to-amber-950/8 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 gap-4">
          {hit.icon ? (
            // eslint-disable-next-line @next/next/no-img-element -- harici mağaza CDN
            <img
              src={hit.icon}
              alt=""
              width={64}
              height={64}
              className="size-16 shrink-0 rounded-2xl border border-border bg-card object-cover sm:size-20"
            />
          ) : (
            <div className="size-16 shrink-0 rounded-2xl border border-dashed border-border bg-muted/50 sm:size-20" />
          )}
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("activeAppCardLabel")}
            </p>
            <p className="truncate text-xl font-bold tracking-tight text-foreground">{title}</p>
            <p className="truncate font-mono text-sm text-muted-foreground">
              {hit.platform === "google_play" ? hit.id : `id ${hit.id}`}
            </p>
            {isResolving ? (
              <p className="text-sm font-medium text-muted-foreground">{t("storePinResolving")}</p>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onSearchAnother}>
            {t("searchAnotherApp")}
          </Button>
          <Button type="button" variant="outline" size="sm" className="gap-1" onClick={onClear}>
            <X className="size-3.5" aria-hidden />
            {t("clearPinnedSelection")}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function StoreResultCard({
  hit,
  onPin,
  selectLabel,
  pinDisabled,
}: {
  hit: StoreSearchResultItem;
  onPin: (hit: StoreSearchResultItem) => void;
  selectLabel: string;
  pinDisabled?: boolean;
}) {
  const t = useTranslations("analyzeHub");
  return (
    <li className="overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-colors hover:border-primary/25">
      <div className="flex gap-3 p-4">
        {hit.icon ? (
          // eslint-disable-next-line @next/next/no-img-element -- harici mağaza CDN
          <img
            src={hit.icon}
            alt=""
            width={56}
            height={56}
            className="size-14 shrink-0 rounded-xl border border-border bg-muted object-cover"
          />
        ) : (
          <div className="size-14 shrink-0 rounded-xl border border-dashed border-border bg-muted" />
        )}
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate font-medium text-foreground">{hit.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {hit.platform === "google_play" ? hit.id : `id: ${hit.id}`}
          </p>
          {hit.developer ? <p className="truncate text-xs text-muted-foreground">{hit.developer}</p> : null}
          {hit.rating != null ? (
            <p className="text-xs font-medium text-foreground">{t("ratingShort", { score: hit.rating.toFixed(1) })}</p>
          ) : null}
          {hit.review_count != null ? (
            <p className="text-xs text-muted-foreground">
              {hit.review_count.toLocaleString()} {t("reviewsCount")}
            </p>
          ) : null}
          {hit.store_url ? (
            <a
              href={hit.store_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary underline-offset-4 hover:underline"
            >
              {t("openStoreLink")}
              <ExternalLink className="size-3 shrink-0" aria-hidden />
            </a>
          ) : null}
        </div>
      </div>
      <div className="border-t border-border bg-muted/40 px-3 py-3">
        <Button
          type="button"
          className={cn(buttonVariants(), "h-10 w-full rounded-lg")}
          disabled={pinDisabled}
          onClick={() => onPin(hit)}
        >
          {selectLabel}
        </Button>
      </div>
    </li>
  );
}
