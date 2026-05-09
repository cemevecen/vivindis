"use client";

import { ExternalLink, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AppDto } from "@/types/app";
import type { StoreSearchResultItem } from "@/types/store-search";

/** Mağaza kataloğu ↔ pazaryeri gibi iki seçenekli, yumuşak renkli ikili pill geçişi. */
export function DualPillSwitch({
  ariaLabel,
  left,
  right,
  value,
  onChange,
  className,
}: {
  ariaLabel: string;
  left: string;
  right: string;
  value: "left" | "right";
  onChange: (v: "left" | "right") => void;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex w-full min-w-0 max-w-full gap-1 rounded-full border border-border/60 bg-muted/35 p-1 shadow-inner sm:max-w-[min(24rem,100%)]",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onChange("left")}
        className={cn(
          "min-h-[2.75rem] min-w-0 flex-1 rounded-full px-2 py-2 text-center text-xs font-semibold leading-snug outline-none transition-[color,background-color,box-shadow,transform] duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:px-3 sm:text-sm",
          value === "left"
            ? "bg-sky-100/90 text-sky-950 shadow-sm ring-1 ring-sky-200/60 dark:bg-sky-950/50 dark:text-sky-50 dark:ring-sky-800/40"
            : "text-muted-foreground hover:bg-background/55 active:scale-[0.99] dark:hover:bg-background/10",
        )}
      >
        {left}
      </button>
      <button
        type="button"
        onClick={() => onChange("right")}
        className={cn(
          "min-h-[2.75rem] min-w-0 flex-1 rounded-full px-2 py-2 text-center text-xs font-semibold leading-snug outline-none transition-[color,background-color,box-shadow,transform] duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:px-3 sm:text-sm",
          value === "right"
            ? "bg-violet-100/90 text-violet-950 shadow-sm ring-1 ring-violet-200/60 dark:bg-violet-950/50 dark:text-violet-50 dark:ring-violet-800/40"
            : "text-muted-foreground hover:bg-background/55 active:scale-[0.99] dark:hover:bg-background/10",
        )}
      >
        {right}
      </button>
    </div>
  );
}

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
      className="flex w-full min-w-0 max-w-full rounded-2xl border border-border bg-muted p-1 shadow-inner"
      role="group"
      aria-label={ariaLabel}
    >
      <button
        type="button"
        className={cn(
          "min-w-0 flex-1 rounded-xl px-2 py-2.5 text-center text-xs font-medium leading-snug transition-colors sm:px-3 sm:text-sm",
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
          "min-w-0 flex-1 rounded-xl px-2 py-2.5 text-center text-xs font-medium leading-snug transition-colors sm:px-3 sm:text-sm",
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
    <div className="rounded-2xl border border-orange-200/30 bg-gradient-to-br from-orange-50/25 via-card to-amber-50/15 p-4 shadow-sm dark:border-orange-800/25 dark:from-orange-950/12 dark:via-card dark:to-amber-950/8 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="flex min-w-0 gap-3 sm:flex-1 sm:gap-4">
          {hit.icon ? (
            // eslint-disable-next-line @next/next/no-img-element -- harici mağaza CDN
            <img
              src={hit.icon}
              alt=""
              width={64}
              height={64}
              className="size-14 shrink-0 rounded-2xl border border-border bg-card object-cover sm:size-20"
            />
          ) : (
            <div className="size-14 shrink-0 rounded-2xl border border-dashed border-border bg-muted/50 sm:size-20" />
          )}
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("activeAppCardLabel")}
            </p>
            <p className="break-words text-lg font-bold leading-snug tracking-tight text-foreground sm:truncate sm:text-xl">
              {title}
            </p>
            <p className="break-all font-mono text-sm text-muted-foreground sm:truncate sm:break-normal">
              {hit.platform === "google_play" ? hit.id : `id ${hit.id}`}
            </p>
            {isResolving ? (
              <p className="text-sm font-medium text-muted-foreground">{t("storePinResolving")}</p>
            ) : null}
          </div>
        </div>
        <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:shrink-0 sm:flex-row sm:flex-wrap sm:justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10 w-full justify-center sm:w-auto"
            onClick={onSearchAnother}
          >
            {t("searchAnotherApp")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10 w-full justify-center gap-1 sm:w-auto"
            onClick={onClear}
          >
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
  selectAriaLabel,
  pinDisabled,
  layout = "list",
}: {
  hit: StoreSearchResultItem;
  onPin: (hit: StoreSearchResultItem) => void;
  selectLabel: string;
  /** Görünür etiket kısa olduğunda (ör. «Seç») ekran okuyucu için tam açıklama. */
  selectAriaLabel?: string;
  pinDisabled?: boolean;
  layout?: "list" | "grid";
}) {
  const t = useTranslations("analyzeHub");
  const selectA11y = selectAriaLabel ?? selectLabel;

  if (layout === "grid") {
    return (
      <li className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-colors hover:border-primary/25">
        <div className="flex min-w-0 flex-1 flex-col items-center gap-1 px-2 pb-1.5 pt-2.5 text-center">
          {hit.icon ? (
            // eslint-disable-next-line @next/next/no-img-element -- harici mağaza CDN
            <img
              src={hit.icon}
              alt=""
              width={44}
              height={44}
              className="size-11 shrink-0 rounded-lg border border-border bg-muted object-cover"
            />
          ) : (
            <div className="size-11 shrink-0 rounded-lg border border-dashed border-border bg-muted" />
          )}
          <p className="line-clamp-2 min-h-[2.25rem] text-[11px] font-semibold leading-tight text-foreground sm:min-h-[2.5rem] sm:text-xs">
            {hit.name}
          </p>
          {hit.rating != null ? (
            <p className="text-[10px] font-medium text-muted-foreground">
              {t("ratingShort", { score: hit.rating.toFixed(1) })}
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-8 w-full shrink-0 rounded-none rounded-b-lg border-x-0 border-b-0 text-xs font-medium shadow-none"
          disabled={pinDisabled}
          aria-label={selectA11y}
          onClick={() => onPin(hit)}
        >
          {selectLabel}
        </Button>
      </li>
    );
  }

  return (
    <li className="min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-colors hover:border-primary/25">
      <div className="flex min-w-0 flex-col gap-3 p-3 sm:flex-row sm:items-stretch sm:gap-3 sm:p-3.5">
        <div className="flex min-w-0 gap-3 sm:flex-1">
          {hit.icon ? (
            // eslint-disable-next-line @next/next/no-img-element -- harici mağaza CDN
            <img
              src={hit.icon}
              alt=""
              width={56}
              height={56}
              className="size-12 shrink-0 rounded-xl border border-border bg-muted object-cover sm:size-14"
            />
          ) : (
            <div className="size-12 shrink-0 rounded-xl border border-dashed border-border bg-muted sm:size-14" />
          )}
          <div className="min-w-0 flex-1 space-y-1">
            <p className="line-clamp-2 font-medium leading-snug text-foreground sm:line-clamp-1 sm:truncate">{hit.name}</p>
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
                className="inline-flex min-w-0 max-w-full items-center gap-1 break-all text-xs text-primary underline-offset-4 hover:underline"
              >
                {t("openStoreLink")}
                <ExternalLink className="size-3 shrink-0" aria-hidden />
              </a>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 sm:flex-col sm:justify-center">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-9 w-full font-medium sm:w-[min(100%,7.5rem)]"
            disabled={pinDisabled}
            aria-label={selectA11y}
            onClick={() => onPin(hit)}
          >
            {selectLabel}
          </Button>
        </div>
      </div>
    </li>
  );
}
