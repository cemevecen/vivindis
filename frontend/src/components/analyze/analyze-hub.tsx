"use client";

import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, FileText, GitCompare, Search, Store, Upload } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectNative } from "@/components/ui/select-native";
import { Link, useRouter } from "@/i18n/routing";
import {
  ApiError,
  apiFetch,
  formatClientFetchError,
  isLikelyFetchNetworkError,
  isPublicApiBaseUrlConfigured,
} from "@/lib/api";
import { parseReviewFile } from "@/lib/parse-review-file";
import { parseReviewLinesFromPaste } from "@/lib/review-import-parse";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import type { AnalysisDto } from "@/types/analysis";
import type { AppDto, ReviewImportResponseDto } from "@/types/app";
import type { StoreSearchResponse, StoreSearchResultItem } from "@/types/store-search";

const MASTHEAD_PLUS_PATTERN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cpath fill='%23ffffff' d='M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z'/%3E%3C/svg%3E\")";

type Mode = "store" | "file" | "text" | "compare";
type SearchPlatform = "google_play" | "app_store" | "both";
type DatePresetId = "7d" | "30d" | "90d" | "365d";
type ReviewScope = "local" | "global";
type AnalysisMode = "fast" | "rich";

type Props = {
  clerkEnabled: boolean;
};

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function rangeFromPreset(preset: DatePresetId): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  const days = preset === "7d" ? 7 : preset === "30d" ? 30 : preset === "90d" ? 90 : 365;
  from.setDate(from.getDate() - days);
  return { from: isoDate(from), to: isoDate(to) };
}

function buildNewAppQueryString(
  hit: StoreSearchResultItem,
  dates: { from: string; to: string },
): string {
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
  p.set("from_date", dates.from);
  p.set("to_date", dates.to);
  return p.toString();
}

function appBodyFromHit(hit: StoreSearchResultItem): Record<string, unknown> {
  const plat = hit.platform === "app_store" ? "app_store" : "google_play";
  return {
    platform: plat,
    package_name: hit.platform === "google_play" ? hit.id : "",
    bundle_id: hit.platform === "app_store" ? hit.id : null,
    name: hit.name,
    developer: hit.developer ?? null,
    category: null,
    icon_url: hit.icon ?? null,
    is_active: true,
  };
}

function SegmentedTwo({
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

function StoreResultCard({
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

function AnalyzeHubConnected() {
  const t = useTranslations("analyzeHub");
  const tNav = useTranslations("navigation");
  const tCommon = useTranslations("common");
  const { getToken } = useAuth();
  const router = useRouter();
  const locale = useLocale();
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<Mode>("store");
  const [datePreset, setDatePreset] = useState<DatePresetId>("30d");
  const [reviewScope, setReviewScope] = useState<ReviewScope>("global");
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>("fast");

  const dateRange = useMemo(() => rangeFromPreset(datePreset), [datePreset]);

  const { searchLang, searchCountry } = useMemo(() => {
    if (reviewScope === "global") {
      return { searchLang: "en", searchCountry: "us" };
    }
    const lc = typeof locale === "string" ? locale : "tr";
    const lang = lc.length >= 2 ? lc.split("-")[0]?.slice(0, 2) ?? "tr" : "tr";
    const country = lang === "zh" ? "cn" : lang;
    return { searchLang: lang, searchCountry: country };
  }, [locale, reviewScope]);

  const [platform, setPlatform] = useState<SearchPlatform>("google_play");
  const [draftQuery, setDraftQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");

  const [compareDraftA, setCompareDraftA] = useState("");
  const [compareDraftB, setCompareDraftB] = useState("");
  const [activeCompareA, setActiveCompareA] = useState("");
  const [activeCompareB, setActiveCompareB] = useState("");
  const [compareHitA, setCompareHitA] = useState<StoreSearchResultItem | null>(null);
  const [compareHitB, setCompareHitB] = useState<StoreSearchResultItem | null>(null);
  const [compareBusy, setCompareBusy] = useState(false);

  const [targetAppId, setTargetAppId] = useState<string>("");
  const [pastedText, setPastedText] = useState("");
  const [parsedFileLines, setParsedFileLines] = useState<string[]>([]);
  const [fileLabel, setFileLabel] = useState("");
  const [fileDragOver, setFileDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const searchQuery = useQuery({
    queryKey: queryKeys.store.search(activeQuery, platform, searchLang, searchCountry),
    queryFn: () =>
      apiFetch<StoreSearchResponse>(
        `/api/v1/store/search?q=${encodeURIComponent(activeQuery)}&platform=${platform}&lang=${encodeURIComponent(searchLang)}&country=${encodeURIComponent(searchCountry)}&num=20`,
        { getToken },
      ),
    enabled: activeQuery.length >= 2,
  });

  const searchQueryA = useQuery({
    queryKey: queryKeys.store.search(`${activeCompareA}:cmpA`, platform, searchLang, searchCountry),
    queryFn: () =>
      apiFetch<StoreSearchResponse>(
        `/api/v1/store/search?q=${encodeURIComponent(activeCompareA)}&platform=${platform}&lang=${encodeURIComponent(searchLang)}&country=${encodeURIComponent(searchCountry)}&num=12`,
        { getToken },
      ),
    enabled: activeCompareA.length >= 2,
  });

  const searchQueryB = useQuery({
    queryKey: queryKeys.store.search(`${activeCompareB}:cmpB`, platform, searchLang, searchCountry),
    queryFn: () =>
      apiFetch<StoreSearchResponse>(
        `/api/v1/store/search?q=${encodeURIComponent(activeCompareB)}&platform=${platform}&lang=${encodeURIComponent(searchLang)}&country=${encodeURIComponent(searchCountry)}&num=12`,
        { getToken },
      ),
    enabled: activeCompareB.length >= 2,
  });

  const appsQuery = useQuery({
    queryKey: queryKeys.apps.all,
    queryFn: () => apiFetch<AppDto[]>("/api/v1/apps", { getToken }),
  });

  const importMutation = useMutation({
    mutationFn: async (payload: { items: { body: string; rating?: number }[] }) => {
      if (!targetAppId) {
        throw new Error("no_app");
      }
      return apiFetch<ReviewImportResponseDto>(`/api/v1/apps/${targetAppId}/import-reviews`, {
        method: "POST",
        body: {
          from_date: dateRange.from,
          to_date: dateRange.to,
          items: payload.items.map((i) => ({ body: i.body, rating: i.rating })),
        },
        getToken,
      });
    },
  });

  const runAnalysisTypes = useCallback((): AnalysisDto["type"][] => {
    return analysisMode === "fast" ? ["heuristic"] : ["ai"];
  }, [analysisMode]);

  const afterImport = useCallback(
    async (fetchId: string, appId: string) => {
      const types = runAnalysisTypes();
      try {
        await apiFetch<AnalysisDto[]>(`/api/v1/fetches/${fetchId}/analyze`, {
          method: "POST",
          body: { types },
          getToken,
        });
      } catch {
        toast.error(t("analyzeKickoffFailed"));
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.apps.fetches(appId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.analyses.byApp(appId) });
      router.push(`/apps/${appId}/analysis?fetchId=${fetchId}`);
    },
    [getToken, queryClient, router, runAnalysisTypes, t],
  );

  const goToNewApp = (hit: StoreSearchResultItem) => {
    router.push(`/apps/new?${buildNewAppQueryString(hit, dateRange)}`);
  };

  const results = useMemo(() => searchQuery.data?.results ?? [], [searchQuery.data?.results]);
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

  const apps = appsQuery.data ?? [];

  const processFile = async (file: File | null) => {
    setParsedFileLines([]);
    setFileLabel("");
    if (!file) {
      return;
    }
    setFileLabel(file.name);
    const { lines, errorKey } = await parseReviewFile(file);
    if (errorKey === "parseFailed") {
      toast.error(t("fileParseFailed"));
      setParsedFileLines([]);
      return;
    }
    if (errorKey === "parseEmpty" || lines.length === 0) {
      toast.error(t("fileParseEmpty"));
      setParsedFileLines([]);
      return;
    }
    setParsedFileLines(lines);
  };

  const handleImportFile = async () => {
    if (!targetAppId || parsedFileLines.length === 0) {
      return;
    }
    try {
      const res = await importMutation.mutateAsync({
        items: parsedFileLines.map((body) => ({ body })),
      });
      await afterImport(res.fetch_id, targetAppId);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : tCommon("error");
      if (e instanceof Error && e.message === "no_app") {
        return;
      }
      toast.error(msg);
    }
  };

  const handleImportPaste = async () => {
    const lines = parseReviewLinesFromPaste(pastedText);
    if (!targetAppId || lines.length === 0) {
      return;
    }
    try {
      const res = await importMutation.mutateAsync({
        items: lines.map((body) => ({ body })),
      });
      await afterImport(res.fetch_id, targetAppId);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : tCommon("error");
      toast.error(msg);
    }
  };

  const handleCompareStart = async () => {
    if (!compareHitA || !compareHitB) {
      return;
    }
    setCompareBusy(true);
    try {
      const a = await apiFetch<AppDto>("/api/v1/apps", {
        method: "POST",
        body: appBodyFromHit(compareHitA),
        getToken,
      });
      const b = await apiFetch<AppDto>("/api/v1/apps", {
        method: "POST",
        body: appBodyFromHit(compareHitB),
        getToken,
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.apps.all });
      toast.success(t("compareCreatedBoth", { a: a.name, b: b.name }));
      router.push(`/compare?app_a=${a.id}&app_b=${b.id}`);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : tCommon("error");
      toast.error(msg);
    } finally {
      setCompareBusy(false);
    }
  };

  const shellBody = (
    <div className="min-h-[60vh] space-y-6 bg-gradient-to-b from-sky-100/80 via-sky-50/50 to-slate-50 px-3 py-6 sm:px-6">
      <div className="mx-auto max-w-[min(1240px,calc(100vw-1.5rem))] space-y-6 rounded-2xl border border-slate-200/80 bg-white/95 p-5 shadow-sm sm:p-8">
        {mode === "store" ? (
          <section className="space-y-5" aria-labelledby="analyze-store-heading">
            <h2 id="analyze-store-heading" className="sr-only">
              {t("tabStore")}
            </h2>
            <div className="space-y-2">
              <Label htmlFor="store-search" className="text-slate-800">
                {t("searchLabel")}
              </Label>
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
                className="rounded-xl border-slate-200 bg-white"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="date-preset" className="text-slate-800">
                  {t("dateRangeLabel")}
                </Label>
                <SelectNative
                  id="date-preset"
                  value={datePreset}
                  onChange={(e) => setDatePreset(e.target.value as DatePresetId)}
                  className="rounded-xl"
                >
                  <option value="7d">{t("datePresetLast7")}</option>
                  <option value="30d">{t("datePresetLast30")}</option>
                  <option value="90d">{t("datePresetLast90")}</option>
                  <option value="365d">{t("datePresetLast365")}</option>
                </SelectNative>
              </div>
              <div className="space-y-2">
                <span className="block text-sm font-medium text-slate-800">{t("reviewScopeLabel")}</span>
                <SegmentedTwo
                  ariaLabel={t("reviewScopeLabel")}
                  left={t("reviewScopeLocal")}
                  right={t("reviewScopeGlobal")}
                  value={reviewScope === "local" ? "left" : "right"}
                  onChange={(v) => setReviewScope(v === "left" ? "local" : "global")}
                />
              </div>
            </div>

            <div className="space-y-2">
              <span className="block text-sm font-medium text-slate-800">{t("platformRowLabel")}</span>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={platform === "google_play" ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "rounded-full",
                    platform === "google_play" ? "bg-slate-900 text-white hover:bg-slate-800" : "",
                  )}
                  onClick={() => setPlatform("google_play")}
                >
                  {t("platformAndroid")}
                </Button>
                <Button
                  type="button"
                  variant={platform === "app_store" ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "rounded-full",
                    platform === "app_store" ? "bg-slate-900 text-white hover:bg-slate-800" : "",
                  )}
                  onClick={() => setPlatform("app_store")}
                >
                  {t("platformIos")}
                </Button>
                <Button
                  type="button"
                  variant={platform === "both" ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "rounded-full",
                    platform === "both" ? "bg-slate-900 text-white hover:bg-slate-800" : "",
                  )}
                  onClick={() => setPlatform("both")}
                >
                  {t("platformBoth")}
                </Button>
              </div>
            </div>

            <Button
              type="button"
              className="h-12 w-full rounded-xl bg-slate-900 text-base font-semibold text-white hover:bg-slate-800"
              onClick={() => setActiveQuery(draftQuery.trim())}
              disabled={draftQuery.trim().length < 2}
            >
              {t("fetchReviewsCta")}
            </Button>

            <div className="space-y-2">
              <span className="block text-sm font-medium text-slate-800">{t("analysisModeLabel")}</span>
              <SegmentedTwo
                ariaLabel={t("analysisModeLabel")}
                left={t("analysisModeFast")}
                right={t("analysisModeRich")}
                value={analysisMode === "fast" ? "left" : "right"}
                onChange={(v) => setAnalysisMode(v === "left" ? "fast" : "rich")}
              />
            </div>

            {!isPublicApiBaseUrlConfigured() ? (
              <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-950">
                {t("apiUrlMissing")}
              </p>
            ) : null}

            {activeQuery.length >= 2 ? (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-slate-600">
                  {t("resultsHeading", { count: results.length })}
                </h3>
                {searchQuery.isPending ? (
                  <p className="text-sm text-slate-500">{tCommon("loading")}</p>
                ) : searchQuery.isError ? (
                  <div className="space-y-2 rounded-xl border border-red-200 bg-red-50/50 p-3">
                    <p className="text-sm font-medium text-red-800">{t("searchFailed")}</p>
                    <p className="text-sm break-words text-red-800/90">{formatClientFetchError(searchQuery.error)}</p>
                    {isLikelyFetchNetworkError(searchQuery.error) ? (
                      <p className="text-xs leading-relaxed text-slate-600">{t("searchNetworkHint")}</p>
                    ) : null}
                    <Button type="button" variant="outline" size="sm" onClick={() => void searchQuery.refetch()}>
                      {tCommon("retry")}
                    </Button>
                  </div>
                ) : !results.length ? (
                  <p className="text-sm text-slate-500">{t("noResults")}</p>
                ) : platform === "both" ? (
                  <div className="space-y-8">
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-slate-800">{t("platformAndroid")}</h4>
                      {androidHits.length ? (
                        <ul className="grid gap-3 sm:grid-cols-1 lg:grid-cols-2">
                          {androidHits.map((hit) => (
                            <StoreResultCard
                              key={`gp-${hit.id}-${hit.name}`}
                              hit={hit}
                              onSelect={goToNewApp}
                              selectLabel={t("selectAppContinue")}
                            />
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-slate-500">{t("noResultsGroup")}</p>
                      )}
                    </div>
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-slate-800">{t("platformIos")}</h4>
                      {iosHits.length ? (
                        <ul className="grid gap-3 sm:grid-cols-1 lg:grid-cols-2">
                          {iosHits.map((hit) => (
                            <StoreResultCard
                              key={`ios-${hit.id}-${hit.name}`}
                              hit={hit}
                              onSelect={goToNewApp}
                              selectLabel={t("selectAppContinue")}
                            />
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-slate-500">{t("noResultsGroup")}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <ul className="grid gap-3 sm:grid-cols-1 lg:grid-cols-2">
                    {results.map((hit) => (
                      <StoreResultCard
                        key={`${hit.platform}-${hit.id}-${hit.name}`}
                        hit={hit}
                        onSelect={goToNewApp}
                        selectLabel={t("selectAppContinue")}
                      />
                    ))}
                  </ul>
                )}
              </div>
            ) : null}

            <p className="text-xs text-slate-500">{t("storeFooter")}</p>
          </section>
        ) : null}

        {mode === "file" || mode === "text" ? (
          <section className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="target-app" className="text-slate-800">
                {t("targetAppLabel")}
              </Label>
              <SelectNative
                id="target-app"
                value={targetAppId}
                onChange={(e) => setTargetAppId(e.target.value)}
                className="rounded-xl"
              >
                <option value="">{t("targetAppPlaceholder")}</option>
                {apps.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} — {a.package_name || a.bundle_id || a.id.slice(0, 8)}
                  </option>
                ))}
              </SelectNative>
              {appsQuery.isError ? <p className="text-xs text-red-600">{t("appsLoadError")}</p> : null}
              {!appsQuery.isPending && apps.length === 0 ? (
                <p className="text-sm text-slate-600">
                  {t("noAppsYet")}{" "}
                  <button
                    type="button"
                    className="font-medium text-orange-700 underline"
                    onClick={() => router.push("/apps/new")}
                  >
                    {t("goCreateApp")}
                  </button>
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <span className="block text-sm font-medium text-slate-800">{t("analysisModeLabel")}</span>
              <SegmentedTwo
                ariaLabel={t("analysisModeLabel")}
                left={t("analysisModeFast")}
                right={t("analysisModeRich")}
                value={analysisMode === "fast" ? "left" : "right"}
                onChange={(v) => setAnalysisMode(v === "left" ? "fast" : "rich")}
              />
            </div>

            {mode === "file" ? (
              <>
                <div className="space-y-2">
                  <Label className="text-slate-800">{t("filePickLabel")}</Label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="sr-only"
                    accept=".csv,.txt,.tsv,.xlsx,.xls,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                    onChange={(e) => void processFile(e.target.files?.[0] ?? null)}
                  />
                  <div
                    role="button"
                    tabIndex={0}
                    className={cn(
                      "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-orange-400/70",
                      fileDragOver ? "border-orange-500 bg-orange-50/60" : "border-slate-300 bg-slate-50/80",
                    )}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setFileDragOver(true);
                    }}
                    onDragLeave={() => setFileDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setFileDragOver(false);
                      const f = e.dataTransfer.files[0];
                      void processFile(f ?? null);
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        fileInputRef.current?.click();
                      }
                    }}
                  >
                    <Upload className="size-8 text-slate-500" aria-hidden />
                    <p className="text-sm font-medium text-slate-800">{t("fileDropHint")}</p>
                    <p className="text-xs text-slate-600">{t("fileConstraints")}</p>
                  </div>
                  {fileLabel ? (
                    <p className="text-xs text-slate-500">
                      {fileLabel}
                      {parsedFileLines.length > 0
                        ? ` · ${t("poolLineCount", { count: parsedFileLines.length })}`
                        : null}
                    </p>
                  ) : null}
                </div>
                <Button
                  type="button"
                  disabled={!targetAppId || parsedFileLines.length === 0 || importMutation.isPending}
                  className="h-12 w-full rounded-xl bg-gradient-to-b from-amber-400 to-orange-600 text-base font-semibold text-white shadow-md hover:from-amber-500 hover:to-orange-600 disabled:opacity-50"
                  onClick={() => void handleImportFile()}
                >
                  {t("startSentimentCta")}
                </Button>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="paste-reviews" className="text-slate-800">
                    {t("pasteReviewsLabel")}
                  </Label>
                  <textarea
                    id="paste-reviews"
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    placeholder={t("textPlaceholder")}
                    className="min-h-[160px] w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-inner"
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className="h-11 w-full rounded-xl bg-slate-900 text-white hover:bg-slate-800"
                  disabled={!pastedText.trim()}
                  onClick={() => {
                    const n = parseReviewLinesFromPaste(pastedText).length;
                    toast.info(t("poolLineCount", { count: n }));
                  }}
                >
                  {t("loadTextToPool")}
                </Button>
                <Button
                  type="button"
                  disabled={!targetAppId || parseReviewLinesFromPaste(pastedText).length === 0 || importMutation.isPending}
                  className="h-12 w-full rounded-xl bg-gradient-to-b from-amber-400 to-orange-600 text-base font-semibold text-white shadow-md hover:from-amber-500 hover:to-orange-600 disabled:opacity-50"
                  onClick={() => void handleImportPaste()}
                >
                  {t("startSentimentCta")}
                </Button>
              </>
            )}
          </section>
        ) : null}

        {mode === "compare" ? (
          <section className="space-y-5">
            <p className="text-sm text-slate-600">{t("compareHint")}</p>
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-3">
                <Label className="text-slate-800">{t("compareApp1Label")}</Label>
                <Input
                  value={compareDraftA}
                  onChange={(e) => setCompareDraftA(e.target.value)}
                  placeholder={t("searchPlaceholder")}
                  className="rounded-xl"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="bg-slate-900 text-white hover:bg-slate-800"
                  onClick={() => setActiveCompareA(compareDraftA.trim())}
                  disabled={compareDraftA.trim().length < 2}
                >
                  <Search className="mr-2 size-4" aria-hidden />
                  {t("searchAction")}
                </Button>
                {activeCompareA.length >= 2 && searchQueryA.data ? (
                  <ul className="grid gap-2">
                    {searchQueryA.data.results.map((hit) => (
                      <StoreResultCard
                        key={`ca-${hit.platform}-${hit.id}`}
                        hit={hit}
                        onSelect={() => setCompareHitA(hit)}
                        selectLabel={t("comparePickSlotA")}
                      />
                    ))}
                  </ul>
                ) : null}
              </div>
              <div className="space-y-3">
                <Label className="text-slate-800">{t("compareApp2Label")}</Label>
                <Input
                  value={compareDraftB}
                  onChange={(e) => setCompareDraftB(e.target.value)}
                  placeholder={t("searchPlaceholder")}
                  className="rounded-xl"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="bg-slate-900 text-white hover:bg-slate-800"
                  onClick={() => setActiveCompareB(compareDraftB.trim())}
                  disabled={compareDraftB.trim().length < 2}
                >
                  <Search className="mr-2 size-4" aria-hidden />
                  {t("searchAction")}
                </Button>
                {activeCompareB.length >= 2 && searchQueryB.data ? (
                  <ul className="grid gap-2">
                    {searchQueryB.data.results.map((hit) => (
                      <StoreResultCard
                        key={`cb-${hit.platform}-${hit.id}`}
                        hit={hit}
                        onSelect={() => setCompareHitB(hit)}
                        selectLabel={t("comparePickSlotB")}
                      />
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="compare-date" className="text-slate-800">
                {t("compareDateLabel")}
              </Label>
              <SelectNative
                id="compare-date"
                value={datePreset}
                onChange={(e) => setDatePreset(e.target.value as DatePresetId)}
                className="max-w-md rounded-xl"
              >
                <option value="7d">{t("datePresetLast7")}</option>
                <option value="30d">{t("datePresetLast30")}</option>
                <option value="90d">{t("datePresetLast90")}</option>
                <option value="365d">{t("datePresetLast365")}</option>
              </SelectNative>
            </div>
            <div className="space-y-2">
              <span className="block text-sm font-medium text-slate-800">{t("analysisModeLabel")}</span>
              <SegmentedTwo
                ariaLabel={t("analysisModeLabel")}
                left={t("analysisModeFast")}
                right={t("analysisModeRich")}
                value={analysisMode === "fast" ? "left" : "right"}
                onChange={(v) => setAnalysisMode(v === "left" ? "fast" : "rich")}
              />
            </div>
            <Button
              type="button"
              className="h-12 w-full rounded-xl bg-gradient-to-b from-amber-400 to-orange-600 text-base font-semibold text-white shadow-md disabled:opacity-50"
              disabled={!compareHitA || !compareHitB || compareBusy}
              onClick={() => void handleCompareStart()}
            >
              {t("startCompareCta")}
            </Button>
            <p className="text-xs text-slate-500">{tNav("compare")}</p>
          </section>
        ) : null}
      </div>
    </div>
  );

  return (
    <div className="-mx-4 -mt-4 sm:-mx-6 sm:-mt-6">
      <div
        className="relative overflow-hidden rounded-b-[22px] border-b border-black/15 shadow-[0_10px_32px_rgba(48,8,16,0.28)]"
        style={{
          background: "linear-gradient(102deg, #120608 0%, #1f0a0e 18%, #3a0f18 40%, #5c1524 62%, #7a1f30 82%, #8f2840 100%)",
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage: MASTHEAD_PLUS_PATTERN,
            backgroundSize: "24px 24px",
          }}
        />
        <div className="relative z-10 flex flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
          <div className="flex flex-wrap items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- küçük statik logo */}
            <img
              src="/analyze-masthead-logo.png"
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 shrink-0 rounded-lg bg-white/95 object-contain p-0.5 shadow"
            />
            <div>
              <p className="text-lg font-semibold tracking-tight text-white">{t("mastheadTitle")}</p>
              <p className="text-xs text-white/70">{t("mastheadSubtitle")}</p>
            </div>
          </div>
          <div className="flex flex-col items-stretch gap-3 sm:items-end">
            <div className="flex flex-wrap items-center justify-end gap-2 text-white/90 [&_label]:text-white/80">
              <Link
                href="/about"
                className="rounded-full border border-white/25 px-3 py-1.5 text-sm text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              >
                {t("aboutLink")}
              </Link>
              <LanguageSwitcher selectClassName="rounded-lg border border-white/25 bg-white/10 px-2 py-1.5 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40" />
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
                    "inline-flex min-h-[44px] min-w-[7rem] flex-1 items-center justify-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-colors sm:flex-none",
                    mode === id
                      ? "border-indigo-200/80 bg-white text-slate-900 shadow-md"
                      : "border-white/20 bg-white/10 text-white hover:bg-white/20",
                  )}
                >
                  <Icon className="size-4 shrink-0 opacity-90" aria-hidden />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      {shellBody}
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
