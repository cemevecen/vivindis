"use client";

import { useAuth } from "@clerk/nextjs";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, FileText, GitCompare, Search, Store, Upload } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { ComparePageContent } from "@/components/compare/compare-page-content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "@/i18n/routing";
import { apiFetch, formatClientFetchError, isPublicApiBaseUrlConfigured } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import type { StoreSearchResponse, StoreSearchResultItem } from "@/types/store-search";

type Mode = "store" | "file" | "text" | "compare";

type SearchPlatform = "google_play" | "app_store" | "both";

type Props = {
  clerkEnabled: boolean;
};

function buildNewAppQueryString(hit: StoreSearchResultItem): string {
  const p = new URLSearchParams();
  p.set("platform", hit.platform);
  if (hit.platform === "google_play") {
    p.set("package_name", hit.id);
  } else {
    p.set("bundle_id", hit.id);
  }
  p.set("name", hit.name);
  if (hit.developer) p.set("developer", hit.developer);
  if (hit.icon) p.set("icon_url", hit.icon);
  return p.toString();
}

function StoreResultCard({
  hit,
  onSelect,
}: {
  hit: StoreSearchResultItem;
  onSelect: (hit: StoreSearchResultItem) => void;
}) {
  const t = useTranslations("analyzeHub");
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(hit)}
        className="flex w-full gap-3 rounded-lg border border-border bg-card p-4 text-left shadow-sm transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {hit.icon ? (
          // eslint-disable-next-line @next/next/no-img-element -- harici mağaza CDN; remotePatterns gerekmez
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
          <p className="truncate font-medium">{hit.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {hit.platform === "google_play" ? hit.id : `id: ${hit.id}`}
          </p>
          {hit.developer ? (
            <p className="truncate text-xs text-muted-foreground">{hit.developer}</p>
          ) : null}
          {hit.rating != null ? (
            <p className="text-xs font-medium text-foreground">
              {t("ratingShort", { score: hit.rating.toFixed(1) })}
            </p>
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
              onClick={(e) => e.stopPropagation()}
            >
              {t("openStoreLink")}
              <ExternalLink className="size-3 shrink-0" aria-hidden />
            </a>
          ) : null}
        </div>
      </button>
    </li>
  );
}

/** Clerk + useAuth yalnızca `clerkEnabled` iken mount edilir (SSG / Clerk yok ortamı). */
function AnalyzeHubConnected() {
  const t = useTranslations("analyzeHub");
  const tNav = useTranslations("navigation");
  const tCompare = useTranslations("compare");
  const tCommon = useTranslations("common");
  const { getToken } = useAuth();
  const router = useRouter();
  const locale = useLocale();

  const { searchLang, searchCountry } = useMemo(() => {
    const lc = typeof locale === "string" ? locale : "tr";
    const lang = lc.length >= 2 ? lc.split("-")[0]?.slice(0, 2) ?? "tr" : "tr";
    const country = lang === "zh" ? "cn" : lang;
    return { searchLang: lang, searchCountry: country };
  }, [locale]);

  const [mode, setMode] = useState<Mode>("store");
  const [platform, setPlatform] = useState<SearchPlatform>("google_play");
  const [draftQuery, setDraftQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");

  const searchQuery = useQuery({
    queryKey: queryKeys.store.search(activeQuery, platform, searchLang, searchCountry),
    queryFn: () =>
      apiFetch<StoreSearchResponse>(
        `/api/v1/store/search?q=${encodeURIComponent(activeQuery)}&platform=${platform}&lang=${encodeURIComponent(searchLang)}&country=${encodeURIComponent(searchCountry)}&num=20`,
        { getToken },
      ),
    enabled: activeQuery.length >= 2,
  });

  const goToNewApp = (hit: StoreSearchResultItem) => {
    router.push(`/apps/new?${buildNewAppQueryString(hit)}`);
  };

  const results = searchQuery.data?.results ?? [];
  const androidHits = useMemo(() => results.filter((r) => r.platform === "google_play"), [results]);
  const iosHits = useMemo(() => results.filter((r) => r.platform === "app_store"), [results]);

  const tabs = useMemo(
    () =>
      [
        { id: "store" as const, label: t("tabStore"), Icon: Store },
        { id: "file" as const, label: t("tabFile"), Icon: Upload },
        { id: "text" as const, label: t("tabText"), Icon: FileText },
        { id: "compare" as const, label: t("tabCompare"), Icon: GitCompare },
      ] as const,
    [t],
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label={t("tablistLabel")}>
        {tabs.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={mode === id}
            onClick={() => setMode(id)}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
              mode === id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-muted/40 text-muted-foreground hover:bg-muted",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {label}
          </button>
        ))}
      </div>

      {mode === "store" ? (
        <section className="space-y-6" aria-labelledby="analyze-store-heading">
          <h2 id="analyze-store-heading" className="sr-only">
            {t("tabStore")}
          </h2>
          <div className="space-y-2">
            <Label htmlFor="store-search">{t("searchLabel")}</Label>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <Input
                id="store-search"
                value={draftQuery}
                onChange={(e) => setDraftQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    setActiveQuery(draftQuery.trim());
                  }
                }}
                placeholder={t("searchPlaceholder")}
                autoComplete="off"
                className="sm:max-w-md"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={platform === "google_play" ? "default" : "outline"}
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setPlatform("google_play")}
                >
                  {t("platformAndroid")}
                </Button>
                <Button
                  type="button"
                  variant={platform === "app_store" ? "default" : "outline"}
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setPlatform("app_store")}
                >
                  {t("platformIos")}
                </Button>
                <Button
                  type="button"
                  variant={platform === "both" ? "default" : "outline"}
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setPlatform("both")}
                >
                  {t("platformBoth")}
                </Button>
              </div>
              <Button
                type="button"
                onClick={() => setActiveQuery(draftQuery.trim())}
                disabled={draftQuery.trim().length < 2}
                className="gap-2 sm:ml-2"
              >
                <Search className="size-4" aria-hidden />
                {t("searchAction")}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{t("searchHint")}</p>
            {!isPublicApiBaseUrlConfigured() ? (
              <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-950 dark:text-amber-100">
                {t("apiUrlMissing")}
              </p>
            ) : null}
          </div>

          {activeQuery.length >= 2 ? (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">
                {t("resultsHeading", { count: results.length })}
              </h3>
              {searchQuery.isPending ? (
                <p className="text-sm text-muted-foreground">{tCommon("loading")}</p>
              ) : searchQuery.isError ? (
                <div className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
                  <p className="text-sm font-medium text-destructive">{t("searchFailed")}</p>
                  <p className="text-sm text-destructive/90 break-words">
                    {formatClientFetchError(searchQuery.error)}
                  </p>
                  <Button type="button" variant="outline" size="sm" onClick={() => searchQuery.refetch()}>
                    {tCommon("retry")}
                  </Button>
                </div>
              ) : !results.length ? (
                <p className="text-sm text-muted-foreground">{t("noResults")}</p>
              ) : platform === "both" ? (
                <div className="space-y-8">
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-foreground">{t("platformAndroid")}</h4>
                    {androidHits.length ? (
                      <ul className="grid gap-3 sm:grid-cols-1 lg:grid-cols-2">
                        {androidHits.map((hit) => (
                          <StoreResultCard key={`gp-${hit.id}-${hit.name}`} hit={hit} onSelect={goToNewApp} />
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">{t("noResultsGroup")}</p>
                    )}
                  </div>
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-foreground">{t("platformIos")}</h4>
                    {iosHits.length ? (
                      <ul className="grid gap-3 sm:grid-cols-1 lg:grid-cols-2">
                        {iosHits.map((hit) => (
                          <StoreResultCard key={`ios-${hit.id}-${hit.name}`} hit={hit} onSelect={goToNewApp} />
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">{t("noResultsGroup")}</p>
                    )}
                  </div>
                </div>
              ) : (
                <ul className="grid gap-3 sm:grid-cols-1 lg:grid-cols-2">
                  {results.map((hit) => (
                    <StoreResultCard key={`${hit.platform}-${hit.id}-${hit.name}`} hit={hit} onSelect={goToNewApp} />
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          <p className="text-xs text-muted-foreground">{t("storeFooter")}</p>
        </section>
      ) : null}

      {mode === "file" ? (
        <section className="space-y-4 rounded-lg border border-border bg-muted/15 p-6">
          <h2 className="text-lg font-semibold">{t("tabFile")}</h2>
          <p className="text-sm text-muted-foreground">{t("fileBody")}</p>
          <div className="rounded-md border border-dashed border-border bg-background/80 p-8 text-center text-sm text-muted-foreground">
            {t("fileDropHint")}
          </div>
          <Button type="button" variant="secondary" disabled>
            {t("fileActionSoon")}
          </Button>
        </section>
      ) : null}

      {mode === "text" ? (
        <section className="space-y-4 rounded-lg border border-border bg-muted/15 p-6">
          <h2 className="text-lg font-semibold">{t("tabText")}</h2>
          <p className="text-sm text-muted-foreground">{t("textBody")}</p>
          <textarea
            className="min-h-[160px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            readOnly
            placeholder={t("textPlaceholder")}
            disabled
            aria-disabled
          />
          <Button type="button" variant="secondary" disabled>
            {t("textActionSoon")}
          </Button>
        </section>
      ) : null}

      {mode === "compare" ? (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">{t("tabCompare")}</h2>
          <p className="text-sm text-muted-foreground">{t("compareIntro")}</p>
          <ComparePageContent
            heading={tNav("compare")}
            emptyTitle={tCompare("emptyTitle")}
            emptyDescription={tCompare("emptyDescription")}
            cta={tCompare("cta")}
          />
        </section>
      ) : null}
    </div>
  );
}

export function AnalyzeHub({ clerkEnabled }: Props) {
  const t = useTranslations("analyzeHub");

  if (!clerkEnabled) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
        {t("noClerk")}
      </div>
    );
  }

  return <AnalyzeHubConnected />;
}
