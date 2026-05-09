"use client";

import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  LayoutGrid,
  List,
  RotateCcw,
  Search,
  Upload,
  X,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { AnimatedPoolCount } from "@/components/analyze/animated-pool-count";
import {
  DualPillSwitch,
  PinnedStoreAppCard,
  SegmentedTwo,
  StoreResultCard,
} from "@/components/analyze/analyze-hub-parts";
import { RegisteredAppGridPicker, RegisteredAppTileVisual } from "@/components/analyze/registered-app-grid-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectNative } from "@/components/ui/select-native";
import { usePathname, useRouter } from "@/i18n/routing";
import {
  ApiError,
  apiFetch,
  formatClientFetchError,
  isLikelyFetchNetworkError,
  isPublicApiBaseUrlConfigured,
} from "@/lib/api";
import {
  analyzeStoreSourceFromPathname,
  appBodyFromHit,
  parseAnalyzeHubMode,
  rangeFromPreset,
  storeHitFromRegisteredApp,
  type AnalysisMode,
  type DatePresetId,
  type ReviewScope,
  type SearchPlatform,
} from "@/lib/analyze-hub-utils";
import { dedupeAppsForList } from "@/lib/app-dedupe";
import { parseReviewFile } from "@/lib/parse-review-file";
import { parseReviewLinesFromPaste } from "@/lib/review-import-parse";
import { queryKeys } from "@/lib/query-keys";
import { storeLocaleFromUiLocale } from "@/lib/store-locale";
import { cn } from "@/lib/utils";
import type { AnalysisDto } from "@/types/analysis";
import type { AppDto, AppPlatform, ReviewFetchDto, ReviewImportResponseDto, ReviewListResponseDto } from "@/types/app";
import type { StoreSearchResponse, StoreSearchResultItem } from "@/types/store-search";

type Props = {
  clerkEnabled: boolean;
};

type ReviewSampleLimitOption = 100 | 500 | 1000 | 5000 | null;

type FetchProgressEvent = {
  key: string;
  at: string;
  label: string;
  reason: string;
};

type HydratedReviewItem = ReviewListResponseDto["items"][number];

function formatDuration(totalSec: number): string {
  const safe = Math.max(0, Math.floor(totalSec));
  const hh = Math.floor(safe / 3600);
  const mm = Math.floor((safe % 3600) / 60);
  const ss = safe % 60;
  if (hh > 0) {
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  }
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

const TARGET_APP_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const STORE_CATALOG_PAGE_SIZE = 20;
const STORE_CATALOG_LAYOUT_LS_KEY = "vivindis.storeCatalogResultsLayout";

function classifyMarketplaceSellerUrl(url: string): "ok" | "amazon" | "invalid" {
  const u = url.trim().toLowerCase();
  if (u.length < 12) {
    return "invalid";
  }
  if (u.includes("amazon.")) {
    return "amazon";
  }
  if (u.includes("trendyol.com") || u.includes("hepsiburada.com") || u.includes("n11.com")) {
    return "ok";
  }
  return "invalid";
}

type MarketplaceSiteId = "trendyol" | "hepsiburada" | "n11";

const MARKETPLACE_CHIP_SITES: MarketplaceSiteId[] = ["trendyol", "hepsiburada", "n11"];

const MARKETPLACE_CHIP_LABEL: Record<MarketplaceSiteId, "marketplaceBrandTrendyol" | "marketplaceBrandHepsiburada" | "marketplaceBrandN11"> = {
  trendyol: "marketplaceBrandTrendyol",
  hepsiburada: "marketplaceBrandHepsiburada",
  n11: "marketplaceBrandN11",
};

function marketplaceChipIconSrc(site: MarketplaceSiteId): string {
  return `/marketplace/${site}-app.jpg`;
}

function marketplaceUrlMatchesSite(url: string, site: MarketplaceSiteId): boolean {
  const u = url.trim().toLowerCase();
  if (site === "trendyol") {
    return u.includes("trendyol.com");
  }
  if (site === "hepsiburada") {
    return u.includes("hepsiburada.com");
  }
  return u.includes("n11.com");
}

function formatTargetAppOptionLabel(app: AppDto): string {
  return `${app.name} — ${app.package_name || app.bundle_id || app.id.slice(0, 8)}`;
}

function AnalyzeHubConnected() {
  const t = useTranslations("analyzeHub");
  const tApps = useTranslations("apps");
  const tNav = useTranslations("navigation");
  const tCommon = useTranslations("common");
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const queryClient = useQueryClient();

  const searchParams = useSearchParams();
  const mode = useMemo(() => parseAnalyzeHubMode(searchParams.get("mode")), [searchParams]);

  const storeSourceMode = useMemo((): "catalog" | "marketplace" => {
    const fromPath = analyzeStoreSourceFromPathname(pathname);
    return fromPath ?? "catalog";
  }, [pathname]);

  const [datePreset, setDatePreset] = useState<DatePresetId>("30d");
  const reviewScope: ReviewScope = "local";
  const [reviewSampleLimit, setReviewSampleLimit] = useState<ReviewSampleLimitOption>(1000);
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>("fast");

  const dateRange = useMemo(() => rangeFromPreset(datePreset), [datePreset]);

  const { lang: searchLang, country: searchCountry } = useMemo(
    () => storeLocaleFromUiLocale(locale),
    [locale],
  );

  const [platform, setPlatform] = useState<SearchPlatform>("google_play");
  const [marketplaceSite, setMarketplaceSite] = useState<MarketplaceSiteId>("trendyol");
  const [marketplaceSellerUrl, setMarketplaceSellerUrl] = useState("");
  const [draftQuery, setDraftQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [storeCatalogPage, setStoreCatalogPage] = useState(0);
  const [storeCatalogLayout, setStoreCatalogLayout] = useState<"list" | "grid">("list");

  const [compareDraftA, setCompareDraftA] = useState("");
  const [compareDraftB, setCompareDraftB] = useState("");
  const [activeCompareA, setActiveCompareA] = useState("");
  const [activeCompareB, setActiveCompareB] = useState("");
  const [compareHitA, setCompareHitA] = useState<StoreSearchResultItem | null>(null);
  const [compareHitB, setCompareHitB] = useState<StoreSearchResultItem | null>(null);
  const [comparePlatformA, setComparePlatformA] = useState<SearchPlatform>("google_play");
  const [comparePlatformB, setComparePlatformB] = useState<SearchPlatform>("google_play");
  const [compareReviewScopeA, setCompareReviewScopeA] = useState<ReviewScope>("local");
  const [compareReviewScopeB, setCompareReviewScopeB] = useState<ReviewScope>("local");
  const [compareRegistryAppA, setCompareRegistryAppA] = useState<AppDto | null>(null);
  const [compareRegistryAppB, setCompareRegistryAppB] = useState<AppDto | null>(null);
  const [compareQuickPickExpanded, setCompareQuickPickExpanded] = useState(true);
  const [storeCatalogQuickPickExpanded, setStoreCatalogQuickPickExpanded] = useState(true);
  const [compareRegPickerNonceA, setCompareRegPickerNonceA] = useState(0);
  const [compareRegPickerNonceB, setCompareRegPickerNonceB] = useState(0);
  const [compareBusy, setCompareBusy] = useState(false);

  const [targetAppId, setTargetAppId] = useState<string>("");
  const [targetAppPickerText, setTargetAppPickerText] = useState("");
  const [targetAppPickerOpen, setTargetAppPickerOpen] = useState(false);
  const [pastedText, setPastedText] = useState("");
  /** Havuz: dosya/metin satırları (mağaza çekimi tamamlanınca sayaç ayrıca fetch.review_count ile birleşir). */
  const [poolLines, setPoolLines] = useState<string[]>([]);
  const [hydratedReviews, setHydratedReviews] = useState<HydratedReviewItem[]>([]);
  const [isHydratingPool, setIsHydratingPool] = useState(false);
  const [hydratedPoolCount, setHydratedPoolCount] = useState(0);
  const [fileLabel, setFileLabel] = useState("");
  const [fileDragOver, setFileDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedStoreHit, setSelectedStoreHit] = useState<StoreSearchResultItem | null>(null);
  const [sessionApp, setSessionApp] = useState<AppDto | null>(null);
  const [storeFetchId, setStoreFetchId] = useState<string | null>(null);
  const [, setFetchProgressEvents] = useState<FetchProgressEvent[]>([]);
  const [nowTick, setNowTick] = useState<number>(() => Date.now());
  const [isPinningStore, setIsPinningStore] = useState(false);
  const [analysisKickoffBusy, setAnalysisKickoffBusy] = useState(false);
  const [progressHintIdx, setProgressHintIdx] = useState(0);
  const prevCanStartCompareRef = useRef(false);
  const pinRequestRef = useRef(0);
  const sessionAppRef = useRef<AppDto | null>(null);
  const pinnedPanelRef = useRef<HTMLDivElement>(null);
  const lastFetchHydratedToPoolRef = useRef<string | null>(null);
  const hydrateRunTokenRef = useRef(0);
  const storeFetchFailedToastRef = useRef<string | null>(null);
  const storeFetchPollErrorToastRef = useRef<string | null>(null);
  const progressEventKeysRef = useRef<Set<string>>(new Set());

  const requireSignedIn = useCallback(() => {
    if (!isLoaded) {
      return false;
    }
    if (!isSignedIn) {
      router.push("/sign-in");
      return false;
    }
    return true;
  }, [isLoaded, isSignedIn, router]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_CATALOG_LAYOUT_LS_KEY);
      if (raw === "grid" || raw === "list") {
        setStoreCatalogLayout(raw);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const setStoreCatalogLayoutPersisted = useCallback((next: "list" | "grid") => {
    setStoreCatalogLayout(next);
    try {
      localStorage.setItem(STORE_CATALOG_LAYOUT_LS_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    setStoreCatalogPage(0);
  }, [activeQuery, platform]);

  const catalogBackendOffset =
    platform === "app_store" ? storeCatalogPage * STORE_CATALOG_PAGE_SIZE : 0;
  const catalogFetchNum =
    platform === "google_play" ? 50 : platform === "app_store" ? STORE_CATALOG_PAGE_SIZE : 20;

  const searchQuery = useQuery({
    queryKey: queryKeys.store.search(
      activeQuery,
      platform,
      searchLang,
      searchCountry,
      catalogBackendOffset,
      catalogFetchNum,
    ),
    queryFn: () =>
      apiFetch<StoreSearchResponse>(
        `/api/v1/store/search?q=${encodeURIComponent(activeQuery)}&platform=${platform}&lang=${encodeURIComponent(searchLang)}&country=${encodeURIComponent(searchCountry)}&num=${catalogFetchNum}&offset=${catalogBackendOffset}`,
        { getToken },
      ),
    enabled: activeQuery.length >= 2 && Boolean(isSignedIn),
  });

  const searchQueryA = useQuery({
    queryKey: queryKeys.store.search(`${activeCompareA}:cmpA`, comparePlatformA, searchLang, searchCountry, 0, 12),
    queryFn: () =>
      apiFetch<StoreSearchResponse>(
        `/api/v1/store/search?q=${encodeURIComponent(activeCompareA)}&platform=${comparePlatformA}&lang=${encodeURIComponent(searchLang)}&country=${encodeURIComponent(searchCountry)}&num=12&offset=0`,
        { getToken },
      ),
    enabled: activeCompareA.length >= 2 && Boolean(isSignedIn),
  });

  const searchQueryB = useQuery({
    queryKey: queryKeys.store.search(`${activeCompareB}:cmpB`, comparePlatformB, searchLang, searchCountry, 0, 12),
    queryFn: () =>
      apiFetch<StoreSearchResponse>(
        `/api/v1/store/search?q=${encodeURIComponent(activeCompareB)}&platform=${comparePlatformB}&lang=${encodeURIComponent(searchLang)}&country=${encodeURIComponent(searchCountry)}&num=12&offset=0`,
        { getToken },
      ),
    enabled: activeCompareB.length >= 2 && Boolean(isSignedIn),
  });

  const appsQuery = useQuery({
    queryKey: queryKeys.apps.all,
    queryFn: () => apiFetch<AppDto[]>("/api/v1/apps", { getToken }),
    enabled: Boolean(isSignedIn),
  });

  const registeredAppsDeduped = useMemo(
    () => dedupeAppsForList(appsQuery.data ?? []),
    [appsQuery.data],
  );

  const marketplaceUrlFieldPlaceholder = useMemo(() => {
    switch (marketplaceSite) {
      case "trendyol":
        return t("marketplaceUrlPlaceholderTrendyol");
      case "hepsiburada":
        return t("marketplaceUrlPlaceholderHepsiburada");
      case "n11":
        return t("marketplaceUrlPlaceholderN11");
      default:
        return t("marketplaceUrlPlaceholder");
    }
  }, [marketplaceSite, t]);

  const marketplacePullInputReady = useMemo(() => {
    if (classifyMarketplaceSellerUrl(marketplaceSellerUrl) !== "ok") {
      return false;
    }
    return marketplaceUrlMatchesSite(marketplaceSellerUrl, marketplaceSite);
  }, [marketplaceSellerUrl, marketplaceSite]);

  useEffect(() => {
    if (storeSourceMode !== "marketplace") {
      return;
    }
    if (classifyMarketplaceSellerUrl(marketplaceSellerUrl) !== "ok") {
      return;
    }
    const u = marketplaceSellerUrl.trim().toLowerCase();
    if (u.includes("hepsiburada.com")) {
      setMarketplaceSite("hepsiburada");
    } else if (u.includes("n11.com")) {
      setMarketplaceSite("n11");
    } else if (u.includes("trendyol.com")) {
      setMarketplaceSite("trendyol");
    }
  }, [marketplaceSellerUrl, storeSourceMode]);

  const registryPlatformLabel = useCallback(
    (p: AppPlatform) =>
      p === "google_play" ? t("platformAndroid") : p === "app_store" ? t("platformIos") : t("platformBoth"),
    [t],
  );

  const addFetchProgressEvent = useCallback((event: FetchProgressEvent) => {
    if (progressEventKeysRef.current.has(event.key)) {
      return;
    }
    progressEventKeysRef.current.add(event.key);
    setFetchProgressEvents((prev) => [...prev, event]);
  }, []);

  const resetFetchProgressTimeline = useCallback(() => {
    progressEventKeysRef.current = new Set();
    setFetchProgressEvents([]);
  }, []);

  useEffect(() => {
    sessionAppRef.current = sessionApp;
  }, [sessionApp]);

  useEffect(() => {
    if (sessionApp) {
      setTargetAppId(sessionApp.id);
    }
  }, [sessionApp]);

  useEffect(() => {
    if (pathname !== "/analyze") {
      return;
    }
    if (mode !== "store") {
      return;
    }
    router.replace("/analyze/store");
  }, [pathname, mode, router]);

  useEffect(() => {
    if (!targetAppId) {
      return;
    }
    const all = appsQuery.data ?? [];
    const row = all.find((a) => a.id === targetAppId);
    setTargetAppPickerText(row ? formatTargetAppOptionLabel(row) : targetAppId);
  }, [targetAppId, appsQuery.data]);

  const importMutation = useMutation({
    mutationFn: async (payload: { appId: string; items: { body: string; rating?: number }[] }) => {
      return apiFetch<ReviewImportResponseDto>(`/api/v1/apps/${payload.appId}/import-reviews`, {
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

  const storePullMutation = useMutation({
    mutationFn: async (payload: { appId: string }) => {
      return apiFetch<ReviewFetchDto>(`/api/v1/apps/${payload.appId}/fetch`, {
        method: "POST",
        body: {
          from_date: dateRange.from,
          to_date: dateRange.to,
          review_scope: reviewScope,
          ...(reviewScope === "local" ? { lang: searchLang, country: searchCountry } : {}),
          ...(reviewSampleLimit !== null ? { review_limit: reviewSampleLimit } : {}),
        },
        getToken,
      });
    },
    onSuccess: (row) => {
      setStoreFetchId(String(row.id).trim());
      const waiting = row.status === "waiting_approval";
      addFetchProgressEvent({
        key: `${row.id}:${waiting ? "waiting-approval" : "created"}`,
        at: new Date().toISOString(),
        label: waiting ? t("fetchEventWaitingApprovalLabel") : t("fetchEventCreatedLabel"),
        reason: waiting ? t("fetchEventWaitingApprovalReason") : t("fetchEventCreatedReason"),
      });
      if (waiting) {
        toast.success(tApps("fetchWaitingApprovalToast"));
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.apps.fetches(row.app_id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.apps.recentFetches });
      void queryClient.invalidateQueries({ queryKey: ["apps", String(row.app_id), "stats"] });
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status >= 500) {
        const detail = err.message.trim();
        toast.error(detail.length > 0 ? detail : t("storeReviewsPullFailed"));
        return;
      }
      const msg = err instanceof ApiError ? err.message : tCommon("error");
      toast.error(msg);
    },
  });

  const externalScraperQuery = useQuery({
    queryKey: ["integrations", "external-scraper", "status"],
    queryFn: () =>
      apiFetch<{ enabled: boolean; marketplace_analysis_ready: boolean }>(
        "/api/v1/integrations/external-scraper/status",
        { getToken },
      ),
    enabled: Boolean(isSignedIn && isLoaded),
    staleTime: 60_000,
  });

  const marketplacePullMutation = useMutation({
    mutationFn: async (payload: { appId: string; sellerUrl: string }) => {
      return apiFetch<ReviewFetchDto>(`/api/v1/apps/${payload.appId}/fetch-marketplace-seller`, {
        method: "POST",
        body: {
          from_date: dateRange.from,
          to_date: dateRange.to,
          seller_url: payload.sellerUrl,
          max_sellers: 1,
        },
        getToken,
      });
    },
    onSuccess: (row) => {
      setStoreFetchId(String(row.id).trim());
      const waiting = row.status === "waiting_approval";
      addFetchProgressEvent({
        key: `${row.id}:${waiting ? "waiting-approval" : "created"}`,
        at: new Date().toISOString(),
        label: waiting ? t("fetchEventWaitingApprovalLabel") : t("fetchEventCreatedLabel"),
        reason: waiting ? t("fetchEventWaitingApprovalReason") : t("fetchEventCreatedReason"),
      });
      if (waiting) {
        toast.success(tApps("fetchWaitingApprovalToast"));
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.apps.fetches(row.app_id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.apps.recentFetches });
      void queryClient.invalidateQueries({ queryKey: ["apps", String(row.app_id), "stats"] });
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status >= 500) {
        const detail = err.message.trim();
        toast.error(detail.length > 0 ? detail : t("storeReviewsPullFailed"));
        return;
      }
      const msg = err instanceof ApiError ? err.message : tCommon("error");
      toast.error(msg);
    },
  });

  const fetchRowQuery = useQuery({
    queryKey: storeFetchId ? queryKeys.reviews.fetchById(storeFetchId) : ["analyzeHub", "fetch", "idle"],
    queryFn: async () => {
      try {
        return await apiFetch<ReviewFetchDto>(`/api/v1/fetches/${storeFetchId}`, { getToken });
      } catch (err) {
        // Some deploys can briefly return 404 for the global fetch lookup; recover via app-scoped list.
        if (err instanceof ApiError && err.status === 404 && sessionApp?.id && storeFetchId) {
          const rows = await apiFetch<ReviewFetchDto[]>(`/api/v1/apps/${sessionApp.id}/fetches`, { getToken });
          const matched = rows.find((row) => String(row.id).trim() === String(storeFetchId).trim());
          if (matched) {
            return matched;
          }
        }
        throw err;
      }
    },
    enabled: Boolean(storeFetchId && storeFetchId.length > 0 && isSignedIn),
    retry: (failureCount, err) => failureCount < 8 && err instanceof ApiError && err.status === 404,
    retryDelay: (attempt) => 300 * (attempt + 1),
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      if (s === "pending" || s === "running") {
        return 1000;
      }
      return s === "waiting_approval" ? 5000 : false;
    },
  });

  useEffect(() => {
    const timer = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const row = fetchRowQuery.data;
    if (!storeFetchId || !row || row.id !== storeFetchId) {
      return;
    }
    const isoNow = new Date().toISOString();
    if (row.status === "waiting_approval") {
      addFetchProgressEvent({
        key: `${storeFetchId}:waiting-approval`,
        at: row.created_at || isoNow,
        label: t("fetchEventWaitingApprovalLabel"),
        reason: t("fetchEventWaitingApprovalReason"),
      });
      return;
    }
    if (row.status === "pending") {
      addFetchProgressEvent({
        key: `${storeFetchId}:pending`,
        at: row.created_at || isoNow,
        label: t("fetchEventPendingLabel"),
        reason: t("fetchEventPendingReason"),
      });
      return;
    }
    if (row.status === "running") {
      addFetchProgressEvent({
        key: `${storeFetchId}:running`,
        at: row.started_at || isoNow,
        label: t("fetchEventWorkerStartedLabel"),
        reason: t("fetchEventWorkerStartedReason"),
      });
      return;
    }
    if (row.status === "completed") {
      addFetchProgressEvent({
        key: `${storeFetchId}:completed`,
        at: row.completed_at || isoNow,
        label: t("fetchEventCompletedLabel", { count: row.review_count ?? 0 }),
        reason: t("fetchEventCompletedReason"),
      });
      return;
    }
    if (row.status === "failed") {
      addFetchProgressEvent({
        key: `${storeFetchId}:failed`,
        at: row.completed_at || isoNow,
        label: t("fetchEventFailedLabel"),
        reason: row.error_message || t("fetchEventFailedDefaultReason"),
      });
    }
  }, [addFetchProgressEvent, fetchRowQuery.data, storeFetchId, t]);

  useEffect(() => {
    const row = fetchRowQuery.data;
    const appIdForHydrate = (sessionApp?.id ?? targetAppId.trim()) || "";
    if (!appIdForHydrate || !storeFetchId || row?.id !== storeFetchId || row.status !== "completed") {
      return;
    }
    const runToken = ++hydrateRunTokenRef.current;
    let cancelled = false;
    const appId = appIdForHydrate;
    void (async () => {
      setIsHydratingPool(true);
      setHydratedPoolCount(0);
      try {
        addFetchProgressEvent({
          key: `${storeFetchId}:hydrate-start`,
          at: new Date().toISOString(),
          label: t("fetchEventHydrateStartLabel"),
          reason: t("fetchEventHydrateStartReason"),
        });
        const limit = 100;
        let offset = 0;
        const bodies: string[] = [];
        const reviewRows: HydratedReviewItem[] = [];
        const seenIds = new Set<string>();
        let total = 0;
        for (;;) {
          const chunk = await apiFetch<ReviewListResponseDto>(
            `/api/v1/apps/${appId}/reviews?fetch_id=${encodeURIComponent(storeFetchId)}&limit=${limit}&offset=${offset}`,
            { getToken },
          );
          total = chunk.total;
          for (const it of chunk.items) {
            if (seenIds.has(it.id)) {
              continue;
            }
            seenIds.add(it.id);
            reviewRows.push(it);
            const text = [it.title, it.body].filter(Boolean).join("\n").trim();
            if (text.length > 0) {
              bodies.push(text);
            }
          }
          setHydratedPoolCount(bodies.length);
          offset += chunk.items.length;
          if (cancelled || hydrateRunTokenRef.current != runToken) {
            return;
          }
          if (offset >= total || chunk.items.length === 0) {
            break;
          }
        }
        if (cancelled || hydrateRunTokenRef.current != runToken) {
          return;
        }
        setPoolLines(bodies);
        setHydratedReviews(reviewRows);
        lastFetchHydratedToPoolRef.current = storeFetchId;
        addFetchProgressEvent({
          key: `${storeFetchId}:hydrate-complete`,
          at: new Date().toISOString(),
          label: t("fetchEventHydrateCompleteLabel", { count: bodies.length }),
          reason: t("fetchEventHydrateCompleteReason"),
        });
      } catch (e) {
        if (!cancelled) {
          const detail = e instanceof ApiError ? e.message : tCommon("error");
          toast.error(t("storeReviewsHydrateFailed", { detail }));
        }
      } finally {
        if (!cancelled && hydrateRunTokenRef.current == runToken) {
          setIsHydratingPool(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [addFetchProgressEvent, sessionApp, targetAppId, storeFetchId, fetchRowQuery.data, getToken, t, tCommon]);

  useEffect(() => {
    const row = fetchRowQuery.data;
    if (!storeFetchId || row?.id !== storeFetchId || row.status !== "failed") {
      return;
    }
    if (storeFetchFailedToastRef.current === storeFetchId) {
      return;
    }
    storeFetchFailedToastRef.current = storeFetchId;
    toast.error(t("storeReviewsPullFailed"));
  }, [fetchRowQuery.data, storeFetchId, t]);

  useEffect(() => {
    if (fetchRowQuery.isSuccess) {
      storeFetchPollErrorToastRef.current = null;
    }
  }, [fetchRowQuery.isSuccess]);

  useEffect(() => {
    if (!storeFetchId || !fetchRowQuery.isError) {
      return;
    }
    const key = `${storeFetchId}:poll`;
    if (storeFetchPollErrorToastRef.current === key) {
      return;
    }
    storeFetchPollErrorToastRef.current = key;
    toast.error(t("storeFetchPollFailed"));
  }, [fetchRowQuery.isError, storeFetchId, t]);

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
      } catch (e) {
        toast.error(formatClientFetchError(e));
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.apps.fetches(appId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.apps.recentFetches });
      await queryClient.invalidateQueries({ queryKey: queryKeys.analyses.byApp(appId) });
      router.push({
        pathname: "/apps/[id]/analysis",
        params: { id: appId },
        query: { fetchId },
      });
    },
    [getToken, queryClient, router, runAnalysisTypes],
  );

  const dismissStorePinCard = useCallback(() => {
    pinRequestRef.current += 1;
    setSelectedStoreHit(null);
    setStoreFetchId(null);
    setIsPinningStore(false);
    setHydratedReviews([]);
    setIsHydratingPool(false);
    setHydratedPoolCount(0);
  }, []);

  const clearStorePin = useCallback(() => {
    pinRequestRef.current += 1;
    const app = sessionAppRef.current;
    setTargetAppId((tid) => {
      if (app && tid === app.id) {
        setTargetAppPickerText("");
        return "";
      }
      return tid;
    });
    setSelectedStoreHit(null);
    setSessionApp(null);
    setStoreFetchId(null);
    setIsPinningStore(false);
    setHydratedReviews([]);
    setIsHydratingPool(false);
    setHydratedPoolCount(0);
    lastFetchHydratedToPoolRef.current = null;
    storeFetchFailedToastRef.current = null;
    storeFetchPollErrorToastRef.current = null;
  }, []);

  const pinStoreHit = useCallback(
    async (hit: StoreSearchResultItem) => {
      if (!requireSignedIn()) {
        return;
      }
      const token = ++pinRequestRef.current;
      setIsPinningStore(true);
      setSelectedStoreHit(hit);
      setStoreFetchId(null);
      setHydratedReviews([]);
      setIsHydratingPool(false);
      setHydratedPoolCount(0);
      try {
        const app = await apiFetch<AppDto>("/api/v1/apps", {
          method: "POST",
          body: appBodyFromHit(hit),
          getToken,
        });
        if (token !== pinRequestRef.current) {
          return;
        }
        setSessionApp(app);
        await queryClient.invalidateQueries({ queryKey: queryKeys.apps.all });
        toast.success(t("storeAppPinned"));
      } catch (e) {
        if (token !== pinRequestRef.current) {
          return;
        }
        setSelectedStoreHit(null);
        setSessionApp(null);
        const msg = e instanceof ApiError ? e.message : tCommon("error");
        toast.error(msg);
      } finally {
        if (token === pinRequestRef.current) {
          setIsPinningStore(false);
        }
      }
    },
    [getToken, queryClient, requireSignedIn, t, tCommon],
  );

  const selectRegisteredCatalogApp = useCallback(
    (app: AppDto) => {
      if (!requireSignedIn()) {
        return;
      }
      const hit = storeHitFromRegisteredApp(app);
      if (!hit) {
        toast.error(t("storeCatalogRegisteredPickUnavailable"));
        return;
      }
      pinRequestRef.current += 1;
      setIsPinningStore(false);
      setSelectedStoreHit(hit);
      setSessionApp(app);
      setStoreFetchId(null);
      setHydratedReviews([]);
      setIsHydratingPool(false);
      setHydratedPoolCount(0);
      lastFetchHydratedToPoolRef.current = null;
      storeFetchFailedToastRef.current = null;
      storeFetchPollErrorToastRef.current = null;
    },
    [requireSignedIn, t],
  );

  const handlePullStoreReviews = useCallback(() => {
    if (!requireSignedIn()) {
      return;
    }
    if (!sessionApp) {
      return;
    }
    resetFetchProgressTimeline();
    addFetchProgressEvent({
      key: `${sessionApp.id}:request-start`,
      at: new Date().toISOString(),
      label: t("fetchEventRequestSentLabel"),
      reason: t("fetchEventRequestSentReason"),
    });
    setStoreFetchId(null);
    setPoolLines([]);
    setHydratedReviews([]);
    setIsHydratingPool(false);
    setHydratedPoolCount(0);
    hydrateRunTokenRef.current += 1;
    lastFetchHydratedToPoolRef.current = null;
    storeFetchFailedToastRef.current = null;
    storeFetchPollErrorToastRef.current = null;
    storePullMutation.mutate({ appId: sessionApp.id });
  }, [addFetchProgressEvent, requireSignedIn, resetFetchProgressTimeline, sessionApp, storePullMutation, t]);

  /** Metin/dosya havuzu ile mağazadan yüklenen satırlar tek sayaçta birleşir. */
  const poolCountForDisplay = useMemo(() => {
    if (isHydratingPool) {
      return Math.max(poolLines.length, hydratedPoolCount);
    }
    return poolLines.length;
  }, [hydratedPoolCount, isHydratingPool, poolLines.length]);

  const fetchElapsedSec = useMemo(() => {
    const row = fetchRowQuery.data;
    if (!row || !storeFetchId || row.id !== storeFetchId) {
      return 0;
    }
    const start = Date.parse(row.started_at || row.created_at || "");
    if (!Number.isFinite(start)) {
      return 0;
    }
    const end =
      row.status === "completed" || row.status === "failed" ? Date.parse(row.completed_at || "") : nowTick;
    const safeEnd = Number.isFinite(end) ? end : nowTick;
    return Math.max(0, Math.floor((safeEnd - start) / 1000));
  }, [fetchRowQuery.data, nowTick, storeFetchId]);

  const fetchDynamicHint = useMemo(() => {
    const row = fetchRowQuery.data;
    if (!row || !storeFetchId) {
      return "";
    }
    if (row.status === "waiting_approval") {
      return t("fetchHintWaitingApproval");
    }
    if (row.status === "pending") {
      return t("fetchHintPending");
    }
    if (row.status === "running") {
      return t("fetchHintRunningNoCount");
    }
    if (row.status === "completed") {
      return t("fetchHintCompleted", { count: row.review_count ?? 0 });
    }
    return row.error_message ?? "";
  }, [fetchRowQuery.data, storeFetchId, t]);

  const fetchStageLabel = useMemo(() => {
    const row = fetchRowQuery.data;
    if (!row || !storeFetchId || row.id !== storeFetchId) {
      return "";
    }
    if (row.status === "waiting_approval") {
      return t("fetchStageWaitingApproval");
    }
    if (row.status === "pending") {
      return t("fetchStage1");
    }
    if (row.status === "running") {
      return t("fetchStage3");
    }
    if (row.status === "completed" && isHydratingPool) {
      return t("fetchStage4");
    }
    if (row.status === "completed") {
      return t("fetchStageDone");
    }
    return t("fetchStageEnded");
  }, [fetchRowQuery.data, isHydratingPool, storeFetchId, t]);

  const rotatingProgressHints = useMemo(() => {
    const row = fetchRowQuery.data;
    const isWaitingApproval =
      Boolean(storeFetchId) && row?.id === storeFetchId && row?.status === "waiting_approval";
    const tail = isWaitingApproval ? [] : [t("estimatedTimeHint")];
    const hints = [fetchStageLabel, fetchDynamicHint, ...tail]
      .map((v) => v.trim())
      .filter((v, i, arr) => v.length > 0 && arr.indexOf(v) === i);
    return hints.length > 0 ? hints : [tCommon("loading")];
  }, [fetchDynamicHint, fetchRowQuery.data, fetchStageLabel, storeFetchId, t, tCommon]);

  useEffect(() => {
    setProgressHintIdx(0);
  }, [storeFetchId, fetchRowQuery.data?.status]);

  useEffect(() => {
    if (rotatingProgressHints.length <= 1) {
      return;
    }
    const timer = window.setInterval(() => {
      setProgressHintIdx((prev) => (prev + 1) % rotatingProgressHints.length);
    }, 1500);
    return () => window.clearInterval(timer);
  }, [rotatingProgressHints]);

  const fetchElapsedText = useMemo(() => formatDuration(fetchElapsedSec), [fetchElapsedSec]);

  const effectiveAppId = useMemo(() => {
    const fromSelect = targetAppId.trim();
    if (fromSelect) {
      return fromSelect;
    }
    return sessionApp?.id ?? "";
  }, [targetAppId, sessionApp?.id]);

  const handlePullMarketplaceReviews = useCallback(() => {
    if (!requireSignedIn()) {
      return;
    }
    const appId = sessionApp?.id;
    if (!appId) {
      toast.error(t("marketplaceNeedStorePinToast"));
      return;
    }
    const cls = classifyMarketplaceSellerUrl(marketplaceSellerUrl);
    if (cls === "amazon") {
      toast.error(t("marketplaceAmazonNotSupported"));
      return;
    }
    if (cls !== "ok") {
      toast.error(t("marketplaceUrlInvalid"));
      return;
    }
    if (!marketplaceUrlMatchesSite(marketplaceSellerUrl, marketplaceSite)) {
      toast.error(t("marketplaceUrlSiteMismatch"));
      return;
    }
    if (!externalScraperQuery.data?.enabled) {
      toast.error(t("marketplaceApifyDisabled"));
      return;
    }
    resetFetchProgressTimeline();
    addFetchProgressEvent({
      key: `${appId}:marketplace-request-start`,
      at: new Date().toISOString(),
      label: t("fetchEventRequestSentLabel"),
      reason: t("fetchEventRequestSentReason"),
    });
    setStoreFetchId(null);
    setPoolLines([]);
    setHydratedReviews([]);
    setIsHydratingPool(false);
    setHydratedPoolCount(0);
    hydrateRunTokenRef.current += 1;
    lastFetchHydratedToPoolRef.current = null;
    storeFetchFailedToastRef.current = null;
    storeFetchPollErrorToastRef.current = null;
    marketplacePullMutation.mutate({ appId, sellerUrl: marketplaceSellerUrl.trim() });
  }, [
    addFetchProgressEvent,
    externalScraperQuery.data?.enabled,
    marketplacePullMutation,
    marketplaceSellerUrl,
    marketplaceSite,
    requireSignedIn,
    resetFetchProgressTimeline,
    sessionApp?.id,
    t,
  ]);

  const canRunUnifiedAnalysis = useMemo(() => {
    if (poolLines.length > 0) {
      return true;
    }
    if (!effectiveAppId) {
      return false;
    }
    return fetchRowQuery.data?.status === "completed" && Boolean(storeFetchId);
  }, [poolLines.length, effectiveAppId, fetchRowQuery.data?.status, storeFetchId]);

  const runUnifiedAnalysis = useCallback(async () => {
    if (!requireSignedIn()) {
      return;
    }
    const appId = effectiveAppId;
    const canAnalyzeExistingFetch = Boolean(storeFetchId) && fetchRowQuery.data?.status === "completed";

    if (canAnalyzeExistingFetch) {
      if (!appId) {
        toast.error(t("analyzeFooterNeedApp"));
        return;
      }
      setAnalysisKickoffBusy(true);
      try {
        await apiFetch<AnalysisDto[]>(`/api/v1/fetches/${storeFetchId}/analyze`, {
          method: "POST",
          body: { types: runAnalysisTypes() },
          getToken,
        });
        await queryClient.invalidateQueries({ queryKey: queryKeys.apps.fetches(appId) });
        await queryClient.invalidateQueries({ queryKey: queryKeys.apps.recentFetches });
        await queryClient.invalidateQueries({ queryKey: queryKeys.analyses.byApp(appId) });
        router.push({
          pathname: "/apps/[id]/analysis",
          params: { id: appId },
          query: { fetchId: storeFetchId },
        });
      } catch (e) {
        toast.error(formatClientFetchError(e));
      } finally {
        setAnalysisKickoffBusy(false);
      }
      return;
    }

    if (poolLines.length > 0) {
      if (!appId) {
        toast.error(t("analyzeNeedAppForTextPool"));
        return;
      }
      setAnalysisKickoffBusy(true);
      try {
        const res = await importMutation.mutateAsync({
          appId,
          items: poolLines.map((body) => ({ body })),
        });
        setPoolLines([]);
        await afterImport(res.fetch_id, appId);
      } catch (e) {
        const msg = e instanceof ApiError ? e.message : tCommon("error");
        toast.error(msg);
      } finally {
        setAnalysisKickoffBusy(false);
      }
      return;
    }
    if (!appId) {
      toast.error(t("analyzeFooterNeedApp"));
      return;
    }
    toast.info(t("analyzeFooterNeedData"));
  }, [
    effectiveAppId,
    poolLines,
    importMutation,
    afterImport,
    fetchRowQuery.data?.status,
    storeFetchId,
    getToken,
    queryClient,
    requireSignedIn,
    router,
    runAnalysisTypes,
    t,
    tCommon,
  ]);

  const catalogRawResults = useMemo(() => searchQuery.data?.results ?? [], [searchQuery.data?.results]);
  const results = catalogRawResults;
  const catalogPageSlice = useMemo(() => {
    if (platform !== "google_play") {
      return catalogRawResults;
    }
    const start = storeCatalogPage * STORE_CATALOG_PAGE_SIZE;
    return catalogRawResults.slice(start, start + STORE_CATALOG_PAGE_SIZE);
  }, [catalogRawResults, platform, storeCatalogPage]);

  const androidHits = useMemo(() => results.filter((r) => r.platform === "google_play"), [results]);
  const iosHits = useMemo(() => results.filter((r) => r.platform === "app_store"), [results]);

  const catalogPaginationActivePlay =
    platform === "google_play" &&
    (catalogRawResults.length > STORE_CATALOG_PAGE_SIZE ||
      (catalogRawResults.length === 50 && Boolean(searchQuery.data?.has_more)));
  const catalogPaginationActiveAppStore =
    platform === "app_store" && (storeCatalogPage > 0 || Boolean(searchQuery.data?.has_more));
  const showCatalogPagination = catalogPaginationActivePlay || catalogPaginationActiveAppStore;

  const catalogHasPrevPage = storeCatalogPage > 0;
  const catalogHasNextPage =
    platform === "google_play"
      ? (storeCatalogPage + 1) * STORE_CATALOG_PAGE_SIZE < catalogRawResults.length
      : Boolean(searchQuery.data?.has_more);

  const catalogHeadlineCount =
    platform === "both"
      ? results.length
      : platform === "google_play"
        ? catalogRawResults.length
        : catalogBackendOffset + catalogRawResults.length;

  useEffect(() => {
    if (storeSourceMode !== "catalog") {
      return;
    }
    if (activeQuery.length < 2) {
      return;
    }
    if (searchQuery.isSuccess) {
      setStoreCatalogQuickPickExpanded(false);
    }
  }, [storeSourceMode, activeQuery, searchQuery.isSuccess, searchQuery.dataUpdatedAt]);

  useEffect(() => {
    if (mode !== "compare") {
      return;
    }
    if (activeCompareA.length < 2) {
      return;
    }
    if (searchQueryA.isSuccess) {
      setCompareRegPickerNonceA((n) => n + 1);
    }
  }, [mode, activeCompareA, searchQueryA.isSuccess, searchQueryA.dataUpdatedAt]);

  useEffect(() => {
    if (mode !== "compare") {
      return;
    }
    if (activeCompareB.length < 2) {
      return;
    }
    if (searchQueryB.isSuccess) {
      setCompareRegPickerNonceB((n) => n + 1);
    }
  }, [mode, activeCompareB, searchQueryB.isSuccess, searchQueryB.dataUpdatedAt]);

  const appChoices = useMemo(() => {
    const raw = appsQuery.data ?? [];
    const merged =
      sessionApp && !raw.some((a) => a.id === sessionApp.id) ? [sessionApp, ...raw] : raw;
    return dedupeAppsForList(merged, { preferAppId: sessionApp?.id ?? null });
  }, [appsQuery.data, sessionApp]);

  const targetAppPickerFiltered = useMemo(() => {
    const q = targetAppPickerText.trim().toLowerCase();
    if (!q) {
      return appChoices;
    }
    return appChoices.filter(
      (a) =>
        (a.name || "").toLowerCase().includes(q) ||
        (a.package_name || "").toLowerCase().includes(q) ||
        (a.bundle_id || "").toLowerCase().includes(q) ||
        a.id.toLowerCase().includes(q),
    );
  }, [appChoices, targetAppPickerText]);

  const commitTargetAppPickerInput = useCallback(
    (options?: { announceInvalid?: boolean }) => {
      const raw = targetAppPickerText.trim();
      if (!raw) {
        setTargetAppId("");
        return;
      }
      const uuidCandidate = raw.toLowerCase();
      if (TARGET_APP_UUID_RE.test(uuidCandidate)) {
        setTargetAppId(uuidCandidate);
        return;
      }
      const exact = appChoices.find((a) => formatTargetAppOptionLabel(a) === raw);
      if (exact) {
        setTargetAppId(exact.id);
        return;
      }
      const ci = appChoices.find(
        (a) => formatTargetAppOptionLabel(a).toLowerCase() === raw.toLowerCase(),
      );
      if (ci) {
        setTargetAppId(ci.id);
        setTargetAppPickerText(formatTargetAppOptionLabel(ci));
        return;
      }
      if (options?.announceInvalid) {
        toast.error(t("targetAppUnresolved"));
      }
    },
    [targetAppPickerText, appChoices, t],
  );

  const processFile = async (file: File | null) => {
    setFileLabel("");
    if (!file) {
      return;
    }
    setFileLabel(file.name);
    const { lines, errorKey } = await parseReviewFile(file);
    if (errorKey === "parseFailed") {
      toast.error(t("fileParseFailed"));
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }
    if (errorKey === "parseEmpty" || lines.length === 0) {
      toast.error(t("fileParseEmpty"));
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }
    setPoolLines((prev) => [...prev, ...lines]);
    toast.success(t("poolAppended", { count: lines.length }));
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleLoadTextIntoPool = () => {
    const lines = parseReviewLinesFromPaste(pastedText);
    if (lines.length === 0) {
      toast.info(t("textPoolEmpty"));
      return;
    }
    setPoolLines((prev) => [...prev, ...lines]);
    toast.success(t("poolAppended", { count: lines.length }));
    setPastedText("");
  };

  const resetCompareColumnA = useCallback(() => {
    setCompareHitA(null);
    setCompareDraftA("");
    setActiveCompareA("");
    setCompareRegistryAppA(null);
  }, []);

  const resetCompareColumnB = useCallback(() => {
    setCompareHitB(null);
    setCompareDraftB("");
    setActiveCompareB("");
    setCompareRegistryAppB(null);
  }, []);

  const clearCompareSelectionA = useCallback(() => {
    setCompareRegistryAppA(null);
    setCompareHitA(null);
  }, []);

  const clearCompareSelectionB = useCallback(() => {
    setCompareRegistryAppB(null);
    setCompareHitB(null);
  }, []);

  const onRegistrySlotCheckbox = useCallback(
    (side: "a" | "b", app: AppDto, checked: boolean) => {
      if (!checked) {
        if (side === "a" && compareRegistryAppA?.id === app.id) {
          setCompareRegistryAppA(null);
        }
        if (side === "b" && compareRegistryAppB?.id === app.id) {
          setCompareRegistryAppB(null);
        }
        return;
      }
      const other = side === "a" ? compareRegistryAppB : compareRegistryAppA;
      if (other?.id === app.id) {
        toast.error(t("compareSameAppTwice"));
        return;
      }
      if (side === "a") {
        setCompareRegistryAppA(app);
        setCompareHitA(null);
      } else {
        setCompareRegistryAppB(app);
        setCompareHitB(null);
      }
    },
    [compareRegistryAppA, compareRegistryAppB, t],
  );

  const canStartCompare = useMemo(() => {
    const hasA = Boolean(compareRegistryAppA || compareHitA);
    const hasB = Boolean(compareRegistryAppB || compareHitB);
    if (!hasA || !hasB) {
      return false;
    }
    if (compareRegistryAppA && compareRegistryAppB && compareRegistryAppA.id === compareRegistryAppB.id) {
      return false;
    }
    if (
      compareHitA &&
      compareHitB &&
      compareHitA.platform === compareHitB.platform &&
      compareHitA.id === compareHitB.id
    ) {
      return false;
    }
    return true;
  }, [compareRegistryAppA, compareRegistryAppB, compareHitA, compareHitB]);

  useEffect(() => {
    if (!canStartCompare) {
      setCompareQuickPickExpanded(true);
    } else if (!prevCanStartCompareRef.current && canStartCompare) {
      setCompareQuickPickExpanded(false);
    }
    prevCanStartCompareRef.current = canStartCompare;
  }, [canStartCompare]);

  useEffect(() => {
    if (mode !== "compare") {
      return;
    }
    const aDone = activeCompareA.length >= 2 && searchQueryA.isSuccess;
    const bDone = activeCompareB.length >= 2 && searchQueryB.isSuccess;
    if (aDone || bDone) {
      setCompareQuickPickExpanded(false);
    }
  }, [
    mode,
    activeCompareA,
    activeCompareB,
    searchQueryA.isSuccess,
    searchQueryA.dataUpdatedAt,
    searchQueryB.isSuccess,
    searchQueryB.dataUpdatedAt,
  ]);

  const handleCompareStart = async () => {
    if (!requireSignedIn()) {
      return;
    }
    if (!canStartCompare) {
      toast.error(t("compareNeedBothSlots"));
      return;
    }
    const regA = compareRegistryAppA;
    const regB = compareRegistryAppB;
    const hitA = compareHitA;
    const hitB = compareHitB;

    setCompareBusy(true);
    try {
      const queueFetchForCompareApp = async (appId: string, scope: ReviewScope) => {
        await apiFetch<ReviewFetchDto>(`/api/v1/apps/${appId}/fetch`, {
          method: "POST",
          body: {
            from_date: dateRange.from,
            to_date: dateRange.to,
            review_scope: scope,
            ...(scope === "local" ? { lang: searchLang, country: searchCountry } : {}),
            ...(reviewSampleLimit !== null ? { review_limit: reviewSampleLimit } : {}),
          },
          getToken,
        });
      };

      if (regA && regB) {
        toast.success(t("compareOpenedRegistryPair"));
        router.push({
          pathname: "/compare",
          query: { app_a: regA.id, app_b: regB.id, split: "1" },
        });
        return;
      }
      if (hitA && hitB) {
        const a = await apiFetch<AppDto>("/api/v1/apps", {
          method: "POST",
          body: appBodyFromHit(hitA),
          getToken,
        });
        const b = await apiFetch<AppDto>("/api/v1/apps", {
          method: "POST",
          body: appBodyFromHit(hitB),
          getToken,
        });
        await Promise.all([
          queueFetchForCompareApp(a.id, compareReviewScopeA),
          queueFetchForCompareApp(b.id, compareReviewScopeB),
        ]);
        await queryClient.invalidateQueries({ queryKey: queryKeys.apps.all });
        toast.success(t("compareCreatedBoth", { a: a.name, b: b.name }));
        router.push({
          pathname: "/compare",
          query: { app_a: a.id, app_b: b.id, split: "1" },
        });
        return;
      }
      if (regA && hitB) {
        const b = await apiFetch<AppDto>("/api/v1/apps", {
          method: "POST",
          body: appBodyFromHit(hitB),
          getToken,
        });
        await queueFetchForCompareApp(b.id, compareReviewScopeB);
        await queryClient.invalidateQueries({ queryKey: queryKeys.apps.all });
        toast.success(t("compareMixedCreatedOne", { created: b.name, existing: regA.name }));
        router.push({
          pathname: "/compare",
          query: { app_a: regA.id, app_b: b.id, split: "1" },
        });
        return;
      }
      if (hitA && regB) {
        const a = await apiFetch<AppDto>("/api/v1/apps", {
          method: "POST",
          body: appBodyFromHit(hitA),
          getToken,
        });
        await queueFetchForCompareApp(a.id, compareReviewScopeA);
        await queryClient.invalidateQueries({ queryKey: queryKeys.apps.all });
        toast.success(t("compareMixedCreatedOne", { created: a.name, existing: regB.name }));
        router.push({
          pathname: "/compare",
          query: { app_a: a.id, app_b: regB.id, split: "1" },
        });
        return;
      }
      toast.error(t("compareNeedBothSlots"));
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : tCommon("error");
      toast.error(msg);
    } finally {
      setCompareBusy(false);
    }
  };

  /** Pin kartı görünürken sonuç ızgarasını gizle; yalnızca mağaza kataloğu + aktif pin akışında. */
  const hideStoreResultGrid = useMemo(
    () =>
      storeSourceMode === "catalog" &&
      Boolean(selectedStoreHit && (sessionApp || isPinningStore)),
    [storeSourceMode, selectedStoreHit, sessionApp, isPinningStore],
  );

  const formatReviewDate = useCallback(
    (iso: string) => {
      const parsed = Date.parse(iso);
      if (!Number.isFinite(parsed)) {
        return iso;
      }
      return new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : locale, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(new Date(parsed));
    },
    [locale],
  );

  const downloadReviewsCsv = useCallback(() => {
    if (hydratedReviews.length === 0) {
      toast.info(t("noReviewsToExport"));
      return;
    }
    const quote = (v: string) => `"${v.replace(/"/g, "\"\"")}"`;
    const rows = [
      [
        t("csvHeaderIndex"),
        t("csvHeaderPlatform"),
        t("csvHeaderRating"),
        t("csvHeaderReviewDate"),
        t("csvHeaderAuthor"),
        t("csvHeaderTitle"),
        t("csvHeaderBody"),
      ],
      ...hydratedReviews.map((r, idx) => [
        String(idx + 1),
        r.platform,
        String(r.rating),
        r.review_date,
        r.author ?? "",
        r.title ?? "",
        r.body ?? "",
      ]),
    ];
    const csv = rows.map((row) => row.map((col) => quote(col)).join(",")).join("\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${t("exportSheetReviews")}-${storeFetchId ?? "export"}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [hydratedReviews, storeFetchId, t]);

  const downloadReviewsExcel = useCallback(async () => {
    if (hydratedReviews.length === 0) {
      toast.info(t("noReviewsToExport"));
      return;
    }
    const XLSX = await import("xlsx");
    const rows = hydratedReviews.map((r, idx) => ({
      [t("csvHeaderIndex")]: idx + 1,
      [t("csvHeaderPlatform")]: r.platform,
      [t("csvHeaderRating")]: r.rating,
      [t("csvHeaderReviewDate")]: r.review_date,
      [t("csvHeaderAuthor")]: r.author ?? "",
      [t("csvHeaderTitle")]: r.title ?? "",
      [t("csvHeaderBody")]: r.body ?? "",
    }));
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, t("exportSheetReviews"));
    XLSX.writeFile(workbook, `${t("exportSheetReviews")}-${storeFetchId ?? "export"}.xlsx`);
  }, [hydratedReviews, storeFetchId, t]);

  useEffect(() => {
    if (!selectedStoreHit || (!sessionApp && !isPinningStore)) {
      return;
    }
    pinnedPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedStoreHit, sessionApp, isPinningStore]);

  const shellBody = (
    <div className="min-h-[60vh] space-y-6 overflow-x-clip bg-gradient-to-b from-muted/70 via-muted/35 to-background px-3 py-6 sm:px-6">
      <div className="mx-auto w-full min-w-0 max-w-[min(1240px,100%)] space-y-6 rounded-2xl border border-border/80 bg-card/95 p-4 shadow-sm sm:p-8">
        {mode === "store" ? (
          <section className="space-y-5" aria-labelledby="analyze-store-heading">
            <h2 id="analyze-store-heading" className="sr-only">
              {t("tabStore")}
            </h2>
            <div className="flex min-w-0 w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="min-w-0 shrink-0 text-sm font-medium text-foreground">{t("storeSourceLabel")}</span>
              <DualPillSwitch
                ariaLabel={t("storeSourceAria")}
                left={t("storeSourceCatalog")}
                right={t("storeSourceMarketplace")}
                value={storeSourceMode === "catalog" ? "left" : "right"}
                className="sm:shrink-0"
                onChange={(v) => {
                  router.replace(v === "left" ? "/analyze/store" : "/analyze/marketplace");
                }}
              />
            </div>

            {storeSourceMode === "catalog" ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="store-search" className="text-foreground">
                    {t("searchLabel")}
                  </Label>
                  <Input
                    id="store-search"
                    value={draftQuery}
                    onChange={(e) => setDraftQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (requireSignedIn()) {
                          setActiveQuery(draftQuery.trim());
                        }
                      }
                    }}
                    placeholder={t("searchPlaceholder")}
                    autoComplete="off"
                    className="rounded-xl border-border bg-card"
                  />
                </div>

                <div className="space-y-2">
                  <span className="block text-sm font-medium text-foreground">{t("platformRowLabel")}</span>
                  <div className="flex flex-wrap items-center gap-2 md:gap-3">
                    <Button
                      type="button"
                      variant={platform === "google_play" ? "default" : "outline"}
                      size="sm"
                      className={cn(
                        "rounded-full",
                        platform === "google_play" ? "bg-primary text-primary-foreground hover:bg-primary/90" : "",
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
                        platform === "app_store" ? "bg-primary text-primary-foreground hover:bg-primary/90" : "",
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
                        platform === "both" ? "bg-primary text-primary-foreground hover:bg-primary/90" : "",
                      )}
                      onClick={() => setPlatform("both")}
                    >
                      {t("platformBoth")}
                    </Button>
                    <Button
                      type="button"
                      className="h-10 w-full shrink-0 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 sm:w-auto sm:px-5"
                      onClick={() => {
                        if (requireSignedIn()) {
                          setActiveQuery(draftQuery.trim());
                        }
                      }}
                      disabled={!isLoaded || draftQuery.trim().length < 2}
                    >
                      <Search className="mr-2 size-4 shrink-0" aria-hidden />
                      <span className="text-center leading-tight">{t("searchCatalogCta")}</span>
                    </Button>
                  </div>
                </div>

                {registeredAppsDeduped.length > 0 ? (
                  <div className="space-y-2 rounded-2xl border border-border bg-card p-4 sm:p-5">
                    <button
                      type="button"
                      id="store-catalog-registered-quick-pick-toggle"
                      className="flex w-full min-w-0 items-center justify-between gap-2 rounded-xl py-1 text-left outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => setStoreCatalogQuickPickExpanded((open) => !open)}
                      aria-expanded={storeCatalogQuickPickExpanded}
                      aria-controls="store-catalog-registered-quick-pick-panel"
                      aria-label={
                        storeCatalogQuickPickExpanded
                          ? t("storeCatalogRegisteredQuickPickCollapse")
                          : t("storeCatalogRegisteredQuickPickExpand")
                      }
                    >
                      <span className="min-w-0 flex-1 break-words pr-1 text-sm font-semibold text-foreground">
                        {t("storeCatalogRegisteredListTitle")}
                      </span>
                      <ChevronDown
                        className={cn(
                          "size-4 shrink-0 opacity-70 transition-transform",
                          storeCatalogQuickPickExpanded && "rotate-180",
                        )}
                        aria-hidden
                      />
                    </button>
                    {storeCatalogQuickPickExpanded ? (
                      <div
                        id="store-catalog-registered-quick-pick-panel"
                        role="region"
                        aria-labelledby="store-catalog-registered-quick-pick-toggle"
                        className="space-y-2"
                      >
                        <p className="text-xs text-muted-foreground">{t("storeCatalogRegisteredListHint")}</p>
                        <div className="max-h-[22rem] rounded-xl border border-border p-2 scrollbar-stable-visible">
                          <div
                            className="grid gap-2"
                            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(5.25rem, 1fr))" }}
                          >
                            {registeredAppsDeduped.map((app) => (
                              <button
                                key={app.id}
                                type="button"
                                className={cn(
                                  "flex flex-col items-center gap-1.5 rounded-lg border p-2 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                  sessionApp?.id === app.id
                                    ? "border-primary bg-primary/5"
                                    : "border-border/80 bg-card/40 hover:bg-muted/40",
                                )}
                                onClick={() => selectRegisteredCatalogApp(app)}
                                aria-label={t("storeCatalogRegisteredPickAria", { name: app.name })}
                              >
                                <RegisteredAppTileVisual app={app} platformLabel={registryPlatformLabel(app.platform)} />
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="min-w-0 space-y-4 rounded-2xl border border-teal-200/35 bg-teal-50/10 p-4 dark:border-teal-800/25 dark:bg-teal-950/12 sm:p-5">
                <div className="min-w-0">
                  <p className="break-words text-base font-semibold text-foreground">{t("marketplacePanelTitle")}</p>
                </div>
                {!externalScraperQuery.data?.enabled && !externalScraperQuery.isPending ? (
                  <p className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs text-amber-950/90 dark:border-amber-500/18 dark:bg-amber-500/8 dark:text-amber-100/90">
                    {t("marketplaceApifyDisabled")}
                  </p>
                ) : null}
                {!appsQuery.isPending && registeredAppsDeduped.length === 0 && !sessionApp ? (
                  <p className="text-sm text-muted-foreground">
                    {t("noAppsYet")}{" "}
                    <button
                      type="button"
                      className="font-medium text-primary/90 underline"
                      onClick={() => router.push("/apps/new")}
                    >
                      {t("goCreateApp")}
                    </button>
                  </p>
                ) : null}
                <div className="space-y-2">
                  <span className="block text-sm font-medium text-foreground">{t("marketplaceSiteLabel")}</span>
                  <div className="flex flex-wrap gap-2">
                    {MARKETPLACE_CHIP_SITES.map((site) => (
                      <Button
                        key={site}
                        type="button"
                        size="sm"
                        variant={marketplaceSite === site ? "default" : "outline"}
                        className={cn(
                          "rounded-full gap-2 pr-3",
                          marketplaceSite === site ? "bg-primary text-primary-foreground hover:bg-primary/90" : "",
                        )}
                        onClick={() => setMarketplaceSite(site)}
                      >
                        <span className="relative size-6 shrink-0 overflow-hidden rounded-md bg-background/90 ring-1 ring-border/60 dark:bg-background/80">
                          <Image
                            src={marketplaceChipIconSrc(site)}
                            alt=""
                            width={24}
                            height={24}
                            className="size-full object-cover"
                            sizes="24px"
                          />
                        </span>
                        <span>{t(MARKETPLACE_CHIP_LABEL[site])}</span>
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  {sessionApp ? (
                    <p className="text-sm text-foreground">
                      {t("marketplacePinnedAppBanner", { name: sessionApp.name })}
                    </p>
                  ) : (
                    <p className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-sm text-amber-950/90 dark:border-amber-500/18 dark:bg-amber-500/8 dark:text-amber-100/90">
                      {t("marketplaceNeedStorePin")}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="marketplace-seller-url" className="text-foreground">
                    {t("marketplaceUrlLabel")}
                  </Label>
                  <Input
                    id="marketplace-seller-url"
                    value={marketplaceSellerUrl}
                    onChange={(e) => setMarketplaceSellerUrl(e.target.value)}
                    placeholder={marketplaceUrlFieldPlaceholder}
                    autoComplete="off"
                    className="rounded-xl border-border bg-card"
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-[2fr_2fr] sm:items-end">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="marketplace-fetch-date-preset" className="text-sm font-medium text-foreground">
                      {t("dateRangeLabel")}
                    </Label>
                    <SelectNative
                      id="marketplace-fetch-date-preset"
                      value={datePreset}
                      onChange={(e) => setDatePreset(e.target.value as DatePresetId)}
                      className="h-11 rounded-xl"
                    >
                      <option value="7d">{t("datePresetLast7")}</option>
                      <option value="30d">{t("datePresetLast30")}</option>
                      <option value="90d">{t("datePresetLast90")}</option>
                      <option value="180d">{t("datePresetLast180")}</option>
                      <option value="365d">{t("datePresetLast365")}</option>
                      <option value="2y">{t("datePresetLast2y")}</option>
                      <option value="5y">{t("datePresetLast5y")}</option>
                      <option value="all">{t("datePresetAll")}</option>
                    </SelectNative>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="h-5 invisible select-none" aria-hidden>
                      &nbsp;
                    </div>
                    <Button
                      type="button"
                      className="h-11 w-full rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
                      onClick={() => void handlePullMarketplaceReviews()}
                      disabled={
                        !sessionApp ||
                        !marketplacePullInputReady ||
                        !externalScraperQuery.data?.enabled ||
                        externalScraperQuery.isPending ||
                        marketplacePullMutation.isPending ||
                        fetchRowQuery.data?.status === "pending" ||
                        fetchRowQuery.data?.status === "running" ||
                        fetchRowQuery.data?.status === "waiting_approval" ||
                        (Boolean(storeFetchId) && fetchRowQuery.isPending)
                      }
                    >
                      {marketplacePullMutation.isPending ||
                      fetchRowQuery.data?.status === "pending" ||
                      (Boolean(storeFetchId) && fetchRowQuery.isPending)
                        ? tCommon("loading")
                        : fetchRowQuery.data?.status === "running"
                          ? t("fetchRunningShort")
                          : fetchRowQuery.data?.status === "waiting_approval"
                            ? t("fetchWaitingApprovalShort")
                            : t("marketplacePullCta")}
                    </Button>
                  </div>
                </div>
                {sessionApp && storeFetchId && fetchRowQuery.isError ? (
                  <div className="space-y-2 rounded-xl border border-red-200 bg-red-50/80 p-3">
                    <p className="text-sm font-medium text-red-800">{t("storeFetchPollFailed")}</p>
                    <p className="text-xs break-words text-red-800/90">
                      {fetchRowQuery.error instanceof ApiError && fetchRowQuery.error.status === 404
                        ? t("fetchHintPending")
                        : formatClientFetchError(fetchRowQuery.error)}
                    </p>
                    <Button type="button" variant="outline" size="sm" onClick={() => void fetchRowQuery.refetch()}>
                      {tCommon("retry")}
                    </Button>
                  </div>
                ) : null}
                {sessionApp &&
                (marketplacePullMutation.isPending ||
                  (Boolean(storeFetchId) &&
                    (fetchRowQuery.isPending ||
                      fetchRowQuery.data?.status === "pending" ||
                      fetchRowQuery.data?.status === "running" ||
                      fetchRowQuery.data?.status === "waiting_approval" ||
                      fetchRowQuery.data?.status === "completed"))) ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">{t("fetchProgressLabel")}</p>
                    <div className="grid gap-2 sm:grid-cols-1">
                      <div className="rounded-xl border border-border bg-card/80 px-3 py-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {t("progressSectionElapsed")}
                        </p>
                        <p className="text-lg font-bold tabular-nums text-foreground">{fetchElapsedText}</p>
                      </div>
                    </div>
                    {fetchRowQuery.data?.status === "completed" ? (
                      <div className="rounded-xl border border-border bg-card/80 px-3 py-2 sm:max-w-md">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {t("progressSectionCollected")}
                        </p>
                        <p className="text-lg font-bold tabular-nums text-foreground">
                          {fetchRowQuery.data?.review_count ?? 0}
                        </p>
                      </div>
                    ) : null}
                    <p className="text-xs text-muted-foreground">{fetchDynamicHint}</p>
                    <div className="rounded-xl border border-border bg-card/70 px-3 py-2">
                      <p
                        key={`${storeFetchId ?? "idle"}-${progressHintIdx}`}
                        className="text-xs font-medium text-foreground animate-in fade-in duration-300"
                      >
                        {rotatingProgressHints[progressHintIdx]}
                      </p>
                    </div>
                  </div>
                ) : null}
                {sessionApp && fetchRowQuery.data?.status === "failed" && fetchRowQuery.data.error_message ? (
                  <p className="text-sm text-red-700">{fetchRowQuery.data.error_message}</p>
                ) : null}
                {sessionApp && fetchRowQuery.data?.status === "completed" ? (
                  <p className="text-sm font-medium text-emerald-800">
                    {t("fetchCompletedHint", { count: fetchRowQuery.data.review_count })}
                  </p>
                ) : null}
                {sessionApp && isHydratingPool ? (
                  <div className="space-y-2 rounded-xl border border-orange-200/35 bg-orange-50/20 p-3 dark:border-orange-800/28 dark:bg-orange-950/12">
                    <p className="text-sm font-semibold text-foreground">{t("hydratePoolTitle")}</p>
                    <p className="text-xs text-muted-foreground">
                      {fetchRowQuery.data?.review_count
                        ? t("hydratePoolRowsTotal", {
                            loaded: hydratedPoolCount,
                            total: fetchRowQuery.data.review_count,
                          })
                        : t("hydratePoolRows", { loaded: hydratedPoolCount })}
                    </p>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-orange-100/50 dark:bg-orange-950/30">
                      <div className="h-full w-1/3 animate-pulse rounded-full bg-orange-500/55" />
                    </div>
                  </div>
                ) : null}
                {sessionApp && hydratedReviews.length > 0 ? (
                  <details className="rounded-xl border border-border bg-card/80 p-3">
                    <summary className="cursor-pointer select-none text-sm font-semibold text-foreground">
                      {t("inspectReviewsSummary", { count: hydratedReviews.length })}
                    </summary>
                    <div className="mt-3 space-y-3">
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={downloadReviewsCsv}>
                          <Download className="mr-2 size-4" aria-hidden />
                          {t("downloadCsv")}
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => void downloadReviewsExcel()}>
                          <Download className="mr-2 size-4" aria-hidden />
                          {t("downloadExcel")}
                        </Button>
                      </div>
                      <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                        {hydratedReviews.map((row, idx) => (
                          <article key={row.id} className="rounded-xl border border-border bg-muted/80 px-3 py-2">
                            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                              <p>
                                #{idx + 1} | {t("hubReviewLineRating", { rating: row.rating })}
                              </p>
                              <p>{t("hubReviewLineDate", { date: formatReviewDate(row.review_date) })}</p>
                            </div>
                            {row.title ? <p className="mt-1 text-sm font-medium text-foreground">{row.title}</p> : null}
                            <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{row.body}</p>
                          </article>
                        ))}
                      </div>
                    </div>
                  </details>
                ) : null}
              </div>
            )}

            {!isPublicApiBaseUrlConfigured() ? (
              <p className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs text-amber-950/90 dark:border-amber-500/18 dark:bg-amber-500/8 dark:text-amber-100/90">
                {t("apiUrlMissing")}
              </p>
            ) : null}

            {storeSourceMode === "catalog" && selectedStoreHit && (sessionApp || isPinningStore) ? (
              <div
                ref={pinnedPanelRef}
                className="space-y-4 rounded-2xl border border-orange-200/30 bg-orange-50/12 p-4 dark:border-orange-800/22 dark:bg-orange-950/10 sm:p-5"
              >
                <PinnedStoreAppCard
                  hit={selectedStoreHit}
                  app={sessionApp}
                  isResolving={isPinningStore && !sessionApp}
                  onClear={clearStorePin}
                  onSearchAnother={dismissStorePinCard}
                />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-[2fr_1fr_1fr_2fr] sm:items-end">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="store-fetch-date-preset" className="text-sm font-medium text-foreground">
                      {t("dateRangeLabel")}
                    </Label>
                    <SelectNative
                      id="store-fetch-date-preset"
                      value={datePreset}
                      onChange={(e) => setDatePreset(e.target.value as DatePresetId)}
                      className="h-11 rounded-xl"
                      disabled={!sessionApp}
                    >
                      <option value="7d">{t("datePresetLast7")}</option>
                      <option value="30d">{t("datePresetLast30")}</option>
                      <option value="90d">{t("datePresetLast90")}</option>
                      <option value="180d">{t("datePresetLast180")}</option>
                      <option value="365d">{t("datePresetLast365")}</option>
                      <option value="2y">{t("datePresetLast2y")}</option>
                      <option value="5y">{t("datePresetLast5y")}</option>
                      <option value="all">{t("datePresetAll")}</option>
                    </SelectNative>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label className="text-sm font-medium text-foreground sm:whitespace-nowrap">
                      {t("reviewScopeLabel")}
                    </Label>
                    <div className="flex h-11 min-w-0 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 sm:px-4">
                      <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                        {t("reviewScopeLocal")}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="store-fetch-sample-limit" className="text-sm font-medium text-foreground">
                      {t("reviewSampleLimitLabel")}
                    </Label>
                    <SelectNative
                      id="store-fetch-sample-limit"
                      value={reviewSampleLimit === null ? "all" : String(reviewSampleLimit)}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === "all") {
                          setReviewSampleLimit(null);
                          return;
                        }
                        setReviewSampleLimit(Number(v) as 100 | 500 | 1000 | 5000);
                      }}
                      className="h-11 rounded-xl"
                      disabled={!sessionApp}
                    >
                      <option value="100">100</option>
                      <option value="500">500</option>
                      <option value="1000">1.000</option>
                      <option value="5000">5.000</option>
                      <option value="all">{t("reviewSampleLimitAll")}</option>
                    </SelectNative>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="h-5 invisible select-none" aria-hidden>
                      &nbsp;
                    </div>
                    <Button
                      type="button"
                      className="h-11 w-full rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
                      onClick={() => void handlePullStoreReviews()}
                      disabled={
                        !sessionApp ||
                        storePullMutation.isPending ||
                        fetchRowQuery.data?.status === "pending" ||
                        fetchRowQuery.data?.status === "running" ||
                        fetchRowQuery.data?.status === "waiting_approval" ||
                        (Boolean(storeFetchId) && fetchRowQuery.isPending)
                      }
                    >
                      {storePullMutation.isPending ||
                      fetchRowQuery.data?.status === "pending" ||
                      (Boolean(storeFetchId) && fetchRowQuery.isPending)
                        ? tCommon("loading")
                        : fetchRowQuery.data?.status === "running"
                          ? t("fetchRunningShort")
                          : fetchRowQuery.data?.status === "waiting_approval"
                            ? t("fetchWaitingApprovalShort")
                            : t("pullStoreReviewsCta")}
                    </Button>
                  </div>
                </div>
                {sessionApp && storeFetchId && fetchRowQuery.isError ? (
                  <div className="space-y-2 rounded-xl border border-red-200 bg-red-50/80 p-3">
                    <p className="text-sm font-medium text-red-800">{t("storeFetchPollFailed")}</p>
                    <p className="text-xs break-words text-red-800/90">
                      {fetchRowQuery.error instanceof ApiError && fetchRowQuery.error.status === 404
                        ? t("fetchHintPending")
                        : formatClientFetchError(fetchRowQuery.error)}
                    </p>
                    <Button type="button" variant="outline" size="sm" onClick={() => void fetchRowQuery.refetch()}>
                      {tCommon("retry")}
                    </Button>
                  </div>
                ) : null}
                {sessionApp &&
                (storePullMutation.isPending ||
                  (Boolean(storeFetchId) &&
                    (fetchRowQuery.isPending ||
                      fetchRowQuery.data?.status === "pending" ||
                      fetchRowQuery.data?.status === "running" ||
                      fetchRowQuery.data?.status === "waiting_approval" ||
                      fetchRowQuery.data?.status === "completed"))) ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">{t("fetchProgressLabel")}</p>
                    <div className="grid gap-2 sm:grid-cols-1">
                      <div className="rounded-xl border border-border bg-card/80 px-3 py-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {t("progressSectionElapsed")}
                        </p>
                        <p className="text-lg font-bold tabular-nums text-foreground">{fetchElapsedText}</p>
                      </div>
                    </div>
                    {fetchRowQuery.data?.status === "completed" ? (
                      <div className="rounded-xl border border-border bg-card/80 px-3 py-2 sm:max-w-md">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {t("progressSectionCollected")}
                        </p>
                        <p className="text-lg font-bold tabular-nums text-foreground">
                          {fetchRowQuery.data?.review_count ?? 0}
                        </p>
                      </div>
                    ) : null}
                    <p className="text-xs text-muted-foreground">{fetchDynamicHint}</p>
                    <div className="rounded-xl border border-border bg-card/70 px-3 py-2">
                      <p
                        key={`${storeFetchId ?? "idle"}-${progressHintIdx}`}
                        className="text-xs font-medium text-foreground animate-in fade-in duration-300"
                      >
                        {rotatingProgressHints[progressHintIdx]}
                      </p>
                    </div>
                  </div>
                ) : null}
                {sessionApp && fetchRowQuery.data?.status === "failed" && fetchRowQuery.data.error_message ? (
                  <p className="text-sm text-red-700">{fetchRowQuery.data.error_message}</p>
                ) : null}
                {sessionApp && fetchRowQuery.data?.status === "completed" ? (
                  <p className="text-sm font-medium text-emerald-800">
                    {t("fetchCompletedHint", { count: fetchRowQuery.data.review_count })}
                  </p>
                ) : null}
                {isHydratingPool ? (
                  <div className="space-y-2 rounded-xl border border-orange-200/35 bg-orange-50/20 p-3 dark:border-orange-800/28 dark:bg-orange-950/12">
                    <p className="text-sm font-semibold text-foreground">{t("hydratePoolTitle")}</p>
                    <p className="text-xs text-muted-foreground">
                      {fetchRowQuery.data?.review_count
                        ? t("hydratePoolRowsTotal", {
                            loaded: hydratedPoolCount,
                            total: fetchRowQuery.data.review_count,
                          })
                        : t("hydratePoolRows", { loaded: hydratedPoolCount })}
                    </p>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-orange-100/50 dark:bg-orange-950/30">
                      <div className="h-full w-1/3 animate-pulse rounded-full bg-orange-500/55" />
                    </div>
                  </div>
                ) : null}
                {hydratedReviews.length > 0 ? (
                  <details className="rounded-xl border border-border bg-card/80 p-3">
                    <summary className="cursor-pointer select-none text-sm font-semibold text-foreground">
                      {t("inspectReviewsSummary", { count: hydratedReviews.length })}
                    </summary>
                    <div className="mt-3 space-y-3">
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={downloadReviewsCsv}>
                          <Download className="mr-2 size-4" aria-hidden />
                          {t("downloadCsv")}
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => void downloadReviewsExcel()}>
                          <Download className="mr-2 size-4" aria-hidden />
                          {t("downloadExcel")}
                        </Button>
                      </div>
                      <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                        {hydratedReviews.map((row, idx) => (
                          <article key={row.id} className="rounded-xl border border-border bg-muted/80 px-3 py-2">
                            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                              <p>
                                #{idx + 1} | {t("hubReviewLineRating", { rating: row.rating })}
                              </p>
                              <p>{t("hubReviewLineDate", { date: formatReviewDate(row.review_date) })}</p>
                            </div>
                            {row.title ? <p className="mt-1 text-sm font-medium text-foreground">{row.title}</p> : null}
                            <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{row.body}</p>
                          </article>
                        ))}
                      </div>
                    </div>
                  </details>
                ) : null}
              </div>
            ) : null}

            {storeSourceMode === "catalog" && activeQuery.length >= 2 && !hideStoreResultGrid ? (
              <div className="space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <h3 className="text-sm font-medium text-muted-foreground">
                      {t("resultsHeading", { count: catalogHeadlineCount })}
                    </h3>
                    {showCatalogPagination ? (
                      <p className="text-xs text-muted-foreground">
                        {t("storeResultsRange", {
                          from: storeCatalogPage * STORE_CATALOG_PAGE_SIZE + 1,
                          to: storeCatalogPage * STORE_CATALOG_PAGE_SIZE + catalogPageSlice.length,
                          loaded:
                            platform === "google_play"
                              ? catalogRawResults.length
                              : catalogBackendOffset + catalogRawResults.length,
                        })}
                      </p>
                    ) : null}
                  </div>
                  {!searchQuery.isPending && !searchQuery.isError && results.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <div
                        className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5"
                        role="group"
                        aria-label={t("storeResultsLayoutGroup")}
                      >
                        <Button
                          type="button"
                          variant={storeCatalogLayout === "list" ? "secondary" : "ghost"}
                          size="sm"
                          className="h-8 gap-1.5 px-2.5"
                          onClick={() => setStoreCatalogLayoutPersisted("list")}
                          aria-pressed={storeCatalogLayout === "list"}
                        >
                          <List className="size-4 shrink-0" aria-hidden />
                          <span className="text-xs font-medium">{t("storeResultsLayoutList")}</span>
                        </Button>
                        <Button
                          type="button"
                          variant={storeCatalogLayout === "grid" ? "secondary" : "ghost"}
                          size="sm"
                          className="h-8 gap-1.5 px-2.5"
                          onClick={() => setStoreCatalogLayoutPersisted("grid")}
                          aria-pressed={storeCatalogLayout === "grid"}
                        >
                          <LayoutGrid className="size-4 shrink-0" aria-hidden />
                          <span className="text-xs font-medium">{t("storeResultsLayoutGrid")}</span>
                        </Button>
                      </div>
                      {showCatalogPagination ? (
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 px-2"
                            disabled={!catalogHasPrevPage || searchQuery.isPending}
                            onClick={() => setStoreCatalogPage((p) => Math.max(0, p - 1))}
                            aria-label={t("storeResultsPaginationPrev")}
                          >
                            <ChevronLeft className="size-4" aria-hidden />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 px-2"
                            disabled={!catalogHasNextPage || searchQuery.isPending}
                            onClick={() => setStoreCatalogPage((p) => p + 1)}
                            aria-label={t("storeResultsPaginationNext")}
                          >
                            <ChevronRight className="size-4" aria-hidden />
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                {searchQuery.isPending ? (
                  <p className="text-sm text-muted-foreground">{tCommon("loading")}</p>
                ) : searchQuery.isError ? (
                  <div className="space-y-2 rounded-xl border border-red-200 bg-red-50/50 p-3">
                    <p className="text-sm font-medium text-red-800">{t("searchFailed")}</p>
                    <p className="text-sm break-words text-red-800/90">{formatClientFetchError(searchQuery.error)}</p>
                    {isLikelyFetchNetworkError(searchQuery.error) ? (
                      <p className="text-xs leading-relaxed text-muted-foreground">{t("searchNetworkHint")}</p>
                    ) : null}
                    <Button type="button" variant="outline" size="sm" onClick={() => void searchQuery.refetch()}>
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
                        <ul
                          className={cn(
                            "grid gap-2",
                            storeCatalogLayout === "grid"
                              ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4"
                              : "grid-cols-1 lg:grid-cols-2",
                          )}
                        >
                          {androidHits.map((hit) => (
                            <StoreResultCard
                              key={`gp-${hit.id}-${hit.name}`}
                              hit={hit}
                              layout={storeCatalogLayout}
                              onPin={(h) => void pinStoreHit(h)}
                              selectLabel={t("selectAppPin")}
                              selectAriaLabel={t("selectAppPinAria")}
                              pinDisabled={isPinningStore}
                            />
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-muted-foreground">{t("noResultsGroup")}</p>
                      )}
                    </div>
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-foreground">{t("platformIos")}</h4>
                      {iosHits.length ? (
                        <ul
                          className={cn(
                            "grid gap-2",
                            storeCatalogLayout === "grid"
                              ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4"
                              : "grid-cols-1 lg:grid-cols-2",
                          )}
                        >
                          {iosHits.map((hit) => (
                            <StoreResultCard
                              key={`ios-${hit.id}-${hit.name}`}
                              hit={hit}
                              layout={storeCatalogLayout}
                              onPin={(h) => void pinStoreHit(h)}
                              selectLabel={t("selectAppPin")}
                              selectAriaLabel={t("selectAppPinAria")}
                              pinDisabled={isPinningStore}
                            />
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-muted-foreground">{t("noResultsGroup")}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <ul
                    className={cn(
                      "grid gap-2",
                      storeCatalogLayout === "grid"
                        ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4"
                        : "grid-cols-1 lg:grid-cols-2",
                    )}
                  >
                    {catalogPageSlice.map((hit) => (
                      <StoreResultCard
                        key={`${hit.platform}-${hit.id}-${hit.name}`}
                        hit={hit}
                        layout={storeCatalogLayout}
                        onPin={(h) => void pinStoreHit(h)}
                        selectLabel={t("selectAppPin")}
                        selectAriaLabel={t("selectAppPinAria")}
                        pinDisabled={isPinningStore}
                      />
                    ))}
                  </ul>
                )}
              </div>
            ) : null}

          </section>
        ) : null}

        {mode === "file" || mode === "text" ? (
          <section className="space-y-5">
            <p className="text-sm text-muted-foreground">{t("fileTextIntro")}</p>

            {mode === "file" ? (
              <>
                <div className="space-y-2">
                  <Label className="text-foreground">{t("filePickLabel")}</Label>
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
                      "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/35",
                      fileDragOver ? "border-orange-400/45 bg-orange-50/25 dark:bg-orange-950/15" : "border-border bg-muted/80",
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
                    <Upload className="size-8 text-muted-foreground" aria-hidden />
                    <p className="text-sm font-medium text-foreground">{t("fileDropHint")}</p>
                    <p className="text-xs text-muted-foreground">{t("fileConstraints")}</p>
                  </div>
                  {fileLabel ? <p className="text-xs text-muted-foreground">{fileLabel}</p> : null}
                </div>
                <p className="text-xs text-muted-foreground">{t("filePoolFooterHint")}</p>
              </>
            ) : null}

            <div className="relative space-y-2">
              <Label htmlFor="target-app-picker" className="text-foreground">
                {t("targetAppLabel")}
              </Label>
              <Input
                id="target-app-picker"
                autoComplete="off"
                className="rounded-xl"
                placeholder={t("targetAppPlaceholder")}
                aria-autocomplete="list"
                aria-expanded={targetAppPickerOpen}
                value={targetAppPickerText}
                onChange={(e) => {
                  const v = e.target.value;
                  setTargetAppPickerText(v);
                  if (v.trim() === "") {
                    setTargetAppId("");
                    return;
                  }
                  const sel = appChoices.find((a) => a.id === targetAppId);
                  if (sel && v !== formatTargetAppOptionLabel(sel)) {
                    setTargetAppId("");
                  }
                }}
                onFocus={() => setTargetAppPickerOpen(true)}
                onBlur={() => {
                  window.setTimeout(() => {
                    commitTargetAppPickerInput({ announceInvalid: false });
                    setTargetAppPickerOpen(false);
                  }, 160);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitTargetAppPickerInput({ announceInvalid: true });
                    setTargetAppPickerOpen(false);
                  }
                  if (e.key === "Escape") {
                    setTargetAppPickerOpen(false);
                  }
                }}
              />
              {targetAppPickerOpen && targetAppPickerFiltered.length > 0 ? (
                <ul
                  role="listbox"
                  className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-border bg-popover py-1 text-popover-foreground shadow-md"
                >
                  {targetAppPickerFiltered.map((a) => (
                    <li key={a.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={targetAppId === a.id}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                        onMouseDown={(ev) => ev.preventDefault()}
                        onClick={() => {
                          setTargetAppId(a.id);
                          setTargetAppPickerText(formatTargetAppOptionLabel(a));
                          setTargetAppPickerOpen(false);
                        }}
                      >
                        {formatTargetAppOptionLabel(a)}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {sessionApp ? (
                <p className="text-xs text-muted-foreground">{t("sessionAppLinkedHint", { name: sessionApp.name })}</p>
              ) : null}
              {appsQuery.isError ? <p className="text-xs text-red-600">{t("appsLoadError")}</p> : null}
              {!appsQuery.isPending && appChoices.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("noAppsYet")}{" "}
                  <button
                    type="button"
                    className="font-medium text-primary/90 underline"
                    onClick={() => router.push("/analyze/store")}
                  >
                    {t("goCreateApp")}
                  </button>
                </p>
              ) : null}
            </div>

            {mode === "text" ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="paste-reviews" className="text-foreground">
                    {t("pasteReviewsLabel")}
                  </Label>
                  <textarea
                    id="paste-reviews"
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    placeholder={t("textPlaceholder")}
                    className="min-h-[160px] w-full rounded-2xl border border-border bg-card px-3 py-2 text-base text-foreground shadow-inner md:text-sm"
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className="h-11 w-full rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
                  disabled={!pastedText.trim()}
                  onClick={handleLoadTextIntoPool}
                >
                  {t("loadTextToPool")}
                </Button>
                <p className="text-xs text-muted-foreground">{t("textPoolFooterHint")}</p>
              </>
            ) : null}
          </section>
        ) : null}

        {mode === "compare" ? (
          <section className="space-y-6">
            <p className="text-sm text-muted-foreground">{t("compareHint")}</p>
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-3 rounded-2xl border border-border/80 bg-muted/20 p-4 sm:p-5">
                <Label htmlFor="compare-reg-a" className="text-foreground">
                  {t("compareRegisteredSelectLabel")}
                </Label>
                <RegisteredAppGridPicker
                  id="compare-reg-a"
                  apps={registeredAppsDeduped}
                  value={compareRegistryAppA}
                  onChange={(app) => {
                    setCompareRegistryAppA(app);
                    if (app) {
                      setCompareHitA(null);
                    }
                  }}
                  disabled={!registeredAppsDeduped.length}
                  placeholder={t("compareRegisteredSelectPlaceholder")}
                  clearLabel={t("compareRegisteredPickerClear")}
                  getPlatformLabel={registryPlatformLabel}
                  collapseNonce={compareRegPickerNonceA}
                />
                <Label className="text-foreground">{t("compareApp1Label")}</Label>
                <div className="space-y-2">
                  <span className="block text-sm font-medium text-foreground">{t("platformRowLabel")}</span>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant={comparePlatformA === "google_play" ? "default" : "outline"}
                        size="sm"
                        className={cn(
                          "rounded-full",
                          comparePlatformA === "google_play" ? "bg-primary text-primary-foreground hover:bg-primary/90" : "",
                        )}
                        onClick={() => {
                          setComparePlatformA("google_play");
                          setCompareHitA(null);
                          setActiveCompareA("");
                        }}
                      >
                        {t("platformAndroid")}
                      </Button>
                      <Button
                        type="button"
                        variant={comparePlatformA === "app_store" ? "default" : "outline"}
                        size="sm"
                        className={cn(
                          "rounded-full",
                          comparePlatformA === "app_store" ? "bg-primary text-primary-foreground hover:bg-primary/90" : "",
                        )}
                        onClick={() => {
                          setComparePlatformA("app_store");
                          setCompareHitA(null);
                          setActiveCompareA("");
                        }}
                      >
                        {t("platformIos")}
                      </Button>
                      <Button
                        type="button"
                        variant={comparePlatformA === "both" ? "default" : "outline"}
                        size="sm"
                        className={cn(
                          "rounded-full",
                          comparePlatformA === "both" ? "bg-primary text-primary-foreground hover:bg-primary/90" : "",
                        )}
                        onClick={() => {
                          setComparePlatformA("both");
                          setCompareHitA(null);
                          setActiveCompareA("");
                        }}
                      >
                        {t("platformBoth")}
                      </Button>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1 rounded-full"
                      onClick={resetCompareColumnA}
                    >
                      <RotateCcw className="size-3.5" aria-hidden />
                      {t("compareColumnReset")}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <span className="block text-sm font-medium text-foreground">{t("reviewScopeLabel")}</span>
                  <SegmentedTwo
                    ariaLabel={t("reviewScopeLabel")}
                    left={t("reviewScopeLocal")}
                    right={t("reviewScopeGlobal")}
                    value={compareReviewScopeA === "local" ? "left" : "right"}
                    onChange={(v) => setCompareReviewScopeA(v === "left" ? "local" : "global")}
                  />
                </div>
                <Input
                  value={compareDraftA}
                  onChange={(e) => setCompareDraftA(e.target.value)}
                  placeholder={t("compareSearchPlaceholder")}
                  className="rounded-xl"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-10 w-full bg-primary text-primary-foreground hover:bg-primary/90 sm:h-9 sm:w-auto"
                  onClick={() => {
                    if (requireSignedIn()) {
                      setActiveCompareA(compareDraftA.trim());
                    }
                  }}
                  disabled={!isLoaded || compareDraftA.trim().length < 2}
                >
                  <Search className="mr-2 size-4 shrink-0" aria-hidden />
                  {t("searchAction")}
                </Button>
                {compareRegistryAppA ? (
                  <div className="rounded-xl border border-orange-200/30 bg-orange-50/12 p-3 dark:border-orange-800/22 dark:bg-orange-950/10">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {t("compareSelectedSummaryLabel")}
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0 text-muted-foreground hover:bg-muted dark:hover:bg-muted/80"
                        onClick={clearCompareSelectionA}
                        aria-label={t("compareRemoveSelectedAppAria")}
                      >
                        <X className="size-4" aria-hidden />
                      </Button>
                    </div>
                    <div className="mt-2 flex gap-3">
                      {compareRegistryAppA.icon_url ? (
                        // eslint-disable-next-line @next/next/no-img-element -- app icon URL
                        <img
                          src={compareRegistryAppA.icon_url}
                          alt=""
                          width={48}
                          height={48}
                          className="size-12 shrink-0 rounded-xl border border-border bg-card object-cover"
                        />
                      ) : (
                        <div className="size-12 shrink-0 rounded-xl border border-dashed border-border bg-muted/50" />
                      )}
                      <div className="min-w-0">
                        <p className="break-words font-semibold text-foreground">{compareRegistryAppA.name}</p>
                        <p className="break-all font-mono text-xs text-muted-foreground">
                          {compareRegistryAppA.platform === "app_store"
                            ? compareRegistryAppA.bundle_id || "—"
                            : compareRegistryAppA.package_name}
                          {" · "}
                          {compareRegistryAppA.platform === "google_play"
                            ? t("platformAndroid")
                            : compareRegistryAppA.platform === "app_store"
                              ? t("platformIos")
                              : t("platformBoth")}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}
                {!compareRegistryAppA && compareHitA ? (
                  <div className="rounded-xl border border-orange-200/30 bg-orange-50/12 p-3 dark:border-orange-800/22 dark:bg-orange-950/10">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {t("compareSelectedSummaryLabel")}
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0 text-muted-foreground hover:bg-muted dark:hover:bg-muted/80"
                        onClick={clearCompareSelectionA}
                        aria-label={t("compareRemoveSelectedAppAria")}
                      >
                        <X className="size-4" aria-hidden />
                      </Button>
                    </div>
                    <p className="mt-1 font-semibold text-foreground">{compareHitA.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {compareHitA.platform === "google_play" ? compareHitA.id : `id ${compareHitA.id}`}
                      {" · "}
                      {compareHitA.platform === "google_play" ? t("platformAndroid") : t("platformIos")}
                    </p>
                  </div>
                ) : null}
                {!compareRegistryAppA && !compareHitA && activeCompareA.length >= 2 && searchQueryA.data ? (
                  <ul className="grid gap-2">
                    {searchQueryA.data.results.map((hit) => (
                      <StoreResultCard
                        key={`ca-${hit.platform}-${hit.id}`}
                        hit={hit}
                        layout="list"
                        onPin={() => {
                          setCompareRegistryAppA(null);
                          setCompareHitA(hit);
                          setActiveCompareA("");
                          setCompareDraftA("");
                        }}
                        selectLabel={t("selectApp")}
                        selectAriaLabel={t("comparePickSlotA")}
                      />
                    ))}
                  </ul>
                ) : null}
              </div>
              <div className="space-y-3 rounded-2xl border border-border/80 bg-muted/20 p-4 sm:p-5">
                <Label htmlFor="compare-reg-b" className="text-foreground">
                  {t("compareRegisteredSelectLabel")}
                </Label>
                <RegisteredAppGridPicker
                  id="compare-reg-b"
                  apps={registeredAppsDeduped}
                  value={compareRegistryAppB}
                  onChange={(app) => {
                    setCompareRegistryAppB(app);
                    if (app) {
                      setCompareHitB(null);
                    }
                  }}
                  disabled={!registeredAppsDeduped.length}
                  placeholder={t("compareRegisteredSelectPlaceholder")}
                  clearLabel={t("compareRegisteredPickerClear")}
                  getPlatformLabel={registryPlatformLabel}
                  collapseNonce={compareRegPickerNonceB}
                />
                <Label className="text-foreground">{t("compareApp2Label")}</Label>
                <div className="space-y-2">
                  <span className="block text-sm font-medium text-foreground">{t("platformRowLabel")}</span>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant={comparePlatformB === "google_play" ? "default" : "outline"}
                        size="sm"
                        className={cn(
                          "rounded-full",
                          comparePlatformB === "google_play" ? "bg-primary text-primary-foreground hover:bg-primary/90" : "",
                        )}
                        onClick={() => {
                          setComparePlatformB("google_play");
                          setCompareHitB(null);
                          setActiveCompareB("");
                        }}
                      >
                        {t("platformAndroid")}
                      </Button>
                      <Button
                        type="button"
                        variant={comparePlatformB === "app_store" ? "default" : "outline"}
                        size="sm"
                        className={cn(
                          "rounded-full",
                          comparePlatformB === "app_store" ? "bg-primary text-primary-foreground hover:bg-primary/90" : "",
                        )}
                        onClick={() => {
                          setComparePlatformB("app_store");
                          setCompareHitB(null);
                          setActiveCompareB("");
                        }}
                      >
                        {t("platformIos")}
                      </Button>
                      <Button
                        type="button"
                        variant={comparePlatformB === "both" ? "default" : "outline"}
                        size="sm"
                        className={cn(
                          "rounded-full",
                          comparePlatformB === "both" ? "bg-primary text-primary-foreground hover:bg-primary/90" : "",
                        )}
                        onClick={() => {
                          setComparePlatformB("both");
                          setCompareHitB(null);
                          setActiveCompareB("");
                        }}
                      >
                        {t("platformBoth")}
                      </Button>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1 rounded-full"
                      onClick={resetCompareColumnB}
                    >
                      <RotateCcw className="size-3.5" aria-hidden />
                      {t("compareColumnReset")}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <span className="block text-sm font-medium text-foreground">{t("reviewScopeLabel")}</span>
                  <SegmentedTwo
                    ariaLabel={t("reviewScopeLabel")}
                    left={t("reviewScopeLocal")}
                    right={t("reviewScopeGlobal")}
                    value={compareReviewScopeB === "local" ? "left" : "right"}
                    onChange={(v) => setCompareReviewScopeB(v === "left" ? "local" : "global")}
                  />
                </div>
                <Input
                  value={compareDraftB}
                  onChange={(e) => setCompareDraftB(e.target.value)}
                  placeholder={t("compareSearchPlaceholder")}
                  className="rounded-xl"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-10 w-full bg-primary text-primary-foreground hover:bg-primary/90 sm:h-9 sm:w-auto"
                  onClick={() => {
                    if (requireSignedIn()) {
                      setActiveCompareB(compareDraftB.trim());
                    }
                  }}
                  disabled={!isLoaded || compareDraftB.trim().length < 2}
                >
                  <Search className="mr-2 size-4 shrink-0" aria-hidden />
                  {t("searchAction")}
                </Button>
                {compareRegistryAppB ? (
                  <div className="rounded-xl border border-orange-200/30 bg-orange-50/12 p-3 dark:border-orange-800/22 dark:bg-orange-950/10">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {t("compareSelectedSummaryLabel")}
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0 text-muted-foreground hover:bg-muted dark:hover:bg-muted/80"
                        onClick={clearCompareSelectionB}
                        aria-label={t("compareRemoveSelectedAppAria")}
                      >
                        <X className="size-4" aria-hidden />
                      </Button>
                    </div>
                    <div className="mt-2 flex gap-3">
                      {compareRegistryAppB.icon_url ? (
                        // eslint-disable-next-line @next/next/no-img-element -- app icon URL
                        <img
                          src={compareRegistryAppB.icon_url}
                          alt=""
                          width={48}
                          height={48}
                          className="size-12 shrink-0 rounded-xl border border-border bg-card object-cover"
                        />
                      ) : (
                        <div className="size-12 shrink-0 rounded-xl border border-dashed border-border bg-muted/50" />
                      )}
                      <div className="min-w-0">
                        <p className="break-words font-semibold text-foreground">{compareRegistryAppB.name}</p>
                        <p className="break-all font-mono text-xs text-muted-foreground">
                          {compareRegistryAppB.platform === "app_store"
                            ? compareRegistryAppB.bundle_id || "—"
                            : compareRegistryAppB.package_name}
                          {" · "}
                          {compareRegistryAppB.platform === "google_play"
                            ? t("platformAndroid")
                            : compareRegistryAppB.platform === "app_store"
                              ? t("platformIos")
                              : t("platformBoth")}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}
                {!compareRegistryAppB && compareHitB ? (
                  <div className="rounded-xl border border-orange-200/30 bg-orange-50/12 p-3 dark:border-orange-800/22 dark:bg-orange-950/10">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {t("compareSelectedSummaryLabel")}
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0 text-muted-foreground hover:bg-muted dark:hover:bg-muted/80"
                        onClick={clearCompareSelectionB}
                        aria-label={t("compareRemoveSelectedAppAria")}
                      >
                        <X className="size-4" aria-hidden />
                      </Button>
                    </div>
                    <p className="mt-1 font-semibold text-foreground">{compareHitB.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {compareHitB.platform === "google_play" ? compareHitB.id : `id ${compareHitB.id}`}
                      {" · "}
                      {compareHitB.platform === "google_play" ? t("platformAndroid") : t("platformIos")}
                    </p>
                  </div>
                ) : null}
                {!compareRegistryAppB && !compareHitB && activeCompareB.length >= 2 && searchQueryB.data ? (
                  <ul className="grid gap-2">
                    {searchQueryB.data.results.map((hit) => (
                      <StoreResultCard
                        key={`cb-${hit.platform}-${hit.id}`}
                        hit={hit}
                        layout="list"
                        onPin={() => {
                          setCompareRegistryAppB(null);
                          setCompareHitB(hit);
                          setActiveCompareB("");
                          setCompareDraftB("");
                        }}
                        selectLabel={t("selectApp")}
                        selectAriaLabel={t("comparePickSlotB")}
                      />
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
            {registeredAppsDeduped.length > 0 ? (
              <div className="space-y-2 rounded-2xl border border-border bg-card p-4 sm:p-5">
                <button
                  type="button"
                  id="compare-registered-quick-pick-toggle"
                  className="flex w-full min-w-0 items-center justify-between gap-2 rounded-xl py-1 text-left outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => setCompareQuickPickExpanded((open) => !open)}
                  aria-expanded={compareQuickPickExpanded}
                  aria-controls="compare-registered-quick-pick-panel"
                  aria-label={
                    compareQuickPickExpanded
                      ? t("compareRegisteredQuickPickCollapse")
                      : t("compareRegisteredQuickPickExpand")
                  }
                >
                  <span className="min-w-0 flex-1 break-words pr-1 text-sm font-semibold text-foreground">
                    {t("compareRegisteredListTitle")}
                  </span>
                  <ChevronDown
                    className={cn(
                      "size-4 shrink-0 opacity-70 transition-transform",
                      compareQuickPickExpanded && "rotate-180",
                    )}
                    aria-hidden
                  />
                </button>
                {compareQuickPickExpanded ? (
                  <div
                    id="compare-registered-quick-pick-panel"
                    role="region"
                    aria-labelledby="compare-registered-quick-pick-toggle"
                    className="space-y-2"
                  >
                    <p className="text-xs text-muted-foreground">{t("compareRegisteredListHint")}</p>
                    <div className="max-h-[22rem] rounded-xl border border-border p-2 scrollbar-stable-visible">
                      <div
                        className="grid gap-2"
                        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(5.25rem, 1fr))" }}
                      >
                        {registeredAppsDeduped.map((app) => (
                          <div
                            key={app.id}
                            className="flex flex-col items-center gap-1.5 rounded-lg border border-border/80 bg-card/40 p-2"
                          >
                            <div className="flex w-full flex-col items-center gap-1">
                              <RegisteredAppTileVisual app={app} platformLabel={registryPlatformLabel(app.platform)} />
                            </div>
                            <div className="flex w-full flex-col gap-1 border-t border-border/60 pt-1.5">
                              <label className="flex cursor-pointer items-center gap-1.5 text-[10px] font-medium text-foreground">
                                <input
                                  type="checkbox"
                                  className="size-3.5 shrink-0 rounded border-border accent-primary"
                                  checked={compareRegistryAppA?.id === app.id}
                                  onChange={(e) => onRegistrySlotCheckbox("a", app, e.target.checked)}
                                />
                                <span className="leading-tight">{t("compareRegisteredCol1")}</span>
                              </label>
                              <label className="flex cursor-pointer items-center gap-1.5 text-[10px] font-medium text-foreground">
                                <input
                                  type="checkbox"
                                  className="size-3.5 shrink-0 rounded border-border accent-primary"
                                  checked={compareRegistryAppB?.id === app.id}
                                  onChange={(e) => onRegistrySlotCheckbox("b", app, e.target.checked)}
                                />
                                <span className="leading-tight">{t("compareRegisteredCol2")}</span>
                              </label>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[2fr_1fr_1fr_2fr] sm:items-end">
              <div className="flex flex-col gap-2">
                <Label htmlFor="compare-fetch-date-preset" className="text-sm font-medium text-foreground">
                  {t("dateRangeLabel")}
                </Label>
                <SelectNative
                  id="compare-fetch-date-preset"
                  value={datePreset}
                  onChange={(e) => setDatePreset(e.target.value as DatePresetId)}
                  className="h-11 rounded-xl"
                >
                  <option value="7d">{t("datePresetLast7")}</option>
                  <option value="30d">{t("datePresetLast30")}</option>
                  <option value="90d">{t("datePresetLast90")}</option>
                  <option value="180d">{t("datePresetLast180")}</option>
                  <option value="365d">{t("datePresetLast365")}</option>
                  <option value="2y">{t("datePresetLast2y")}</option>
                  <option value="5y">{t("datePresetLast5y")}</option>
                  <option value="all">{t("datePresetAll")}</option>
                </SelectNative>
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium text-foreground sm:whitespace-nowrap">
                  {t("reviewScopeLabel")}
                </Label>
                <div className="flex h-11 min-w-0 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 sm:px-4">
                  <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                    {t("reviewScopeLocal")}
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="compare-fetch-sample-limit" className="text-sm font-medium text-foreground">
                  {t("reviewSampleLimitLabel")}
                </Label>
                <SelectNative
                  id="compare-fetch-sample-limit"
                  value={reviewSampleLimit === null ? "all" : String(reviewSampleLimit)}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "all") {
                      setReviewSampleLimit(null);
                      return;
                    }
                    setReviewSampleLimit(Number(v) as 100 | 500 | 1000 | 5000);
                  }}
                  className="h-11 rounded-xl"
                >
                  <option value="100">100</option>
                  <option value="500">500</option>
                  <option value="1000">1.000</option>
                  <option value="5000">5.000</option>
                  <option value="all">{t("reviewSampleLimitAll")}</option>
                </SelectNative>
              </div>
              <div className="flex flex-col gap-2">
                <div className="h-5 invisible select-none" aria-hidden>
                  &nbsp;
                </div>
                <Button
                  type="button"
                  className="h-11 w-full rounded-xl bg-primary px-6 text-sm font-bold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
                  onClick={() => void handlePullStoreReviews()}
                  disabled={
                    !sessionApp ||
                    storePullMutation.isPending ||
                    fetchRowQuery.data?.status === "pending" ||
                    fetchRowQuery.data?.status === "running" ||
                    fetchRowQuery.data?.status === "waiting_approval" ||
                    (Boolean(storeFetchId) && fetchRowQuery.isPending)
                  }
                >
                  {storePullMutation.isPending ||
                  fetchRowQuery.data?.status === "pending" ||
                  (Boolean(storeFetchId) && fetchRowQuery.isPending)
                    ? tCommon("loading")
                    : fetchRowQuery.data?.status === "running"
                      ? t("fetchRunningShort")
                      : fetchRowQuery.data?.status === "waiting_approval"
                        ? t("fetchWaitingApprovalShort")
                        : t("pullStoreReviewsCta")}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">{t("analysisModeSectionTitle")}</p>
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
              className="h-12 w-full rounded-xl bg-gradient-to-b from-amber-500 to-orange-600 text-base font-semibold text-white shadow-sm hover:from-amber-600 hover:to-orange-700 disabled:opacity-50"
              disabled={!canStartCompare || compareBusy}
              onClick={() => void handleCompareStart()}
            >
              {compareBusy ? tCommon("loading") : t("startCompareCta")}
            </Button>
            <p className="text-xs text-muted-foreground">{tNav("compare")}</p>
          </section>
        ) : null}

        {mode !== "compare" ? (
          <div className="sticky bottom-1 z-10 mt-6 min-w-0 max-w-full space-y-4 rounded-2xl border border-orange-200/28 bg-gradient-to-b from-card via-card to-orange-50/12 p-4 shadow-md dark:border-orange-800/22 dark:from-card dark:to-orange-950/10 sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-orange-200/30 dark:border-orange-800/20 pb-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("poolBadgeTitle")}</p>
                <AnimatedPoolCount
                  value={poolCountForDisplay}
                  className="text-3xl font-bold tabular-nums text-foreground"
                />
                {isHydratingPool ? (
                  <p className="mt-1 text-xs font-medium text-muted-foreground">{t("hydratePoolTitle")}</p>
                ) : null}
              </div>
              {poolLines.length > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => {
                    setPoolLines([]);
                    setHydratedReviews([]);
                    setIsHydratingPool(false);
                    setHydratedPoolCount(0);
                  }}
                >
                  {t("clearManualPool")}
                </Button>
              ) : null}
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">{t("analysisModeSectionTitle")}</p>
              <div className="grid w-full min-w-0 grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,3fr)]">
                <Button
                  type="button"
                  variant={analysisMode === "fast" ? "default" : "outline"}
                  className={cn(
                    "h-11 w-full min-w-0 shrink-0 rounded-xl px-2 text-xs font-semibold leading-tight sm:px-3 sm:text-sm",
                    analysisMode === "fast" ? "bg-primary text-primary-foreground hover:bg-primary/90" : "",
                  )}
                  onClick={() => setAnalysisMode("fast")}
                >
                  {t("analysisModeFast")}
                </Button>
                <Button
                  type="button"
                  variant={analysisMode === "rich" ? "default" : "outline"}
                  className={cn(
                    "h-11 w-full min-w-0 shrink-0 rounded-xl px-2 text-xs font-semibold leading-tight sm:px-3 sm:text-sm",
                    analysisMode === "rich" ? "bg-primary text-primary-foreground hover:bg-primary/90" : "",
                  )}
                  onClick={() => setAnalysisMode("rich")}
                >
                  {t("analysisModeRich")}
                </Button>
                <Button
                  type="button"
                  className="h-11 w-full min-w-0 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-4 text-sm font-semibold text-white shadow-sm ring-1 ring-amber-600/25 hover:from-amber-600 hover:to-orange-700 hover:ring-amber-700/30 disabled:opacity-50 dark:ring-amber-400/20 sm:px-6"
                  disabled={!canRunUnifiedAnalysis || analysisKickoffBusy || importMutation.isPending}
                  onClick={() => void runUnifiedAnalysis()}
                >
                  {analysisKickoffBusy || importMutation.isPending ? tCommon("loading") : t("startSentimentCta")}
                </Button>
              </div>
            </div>
            {poolLines.length > 0 && !effectiveAppId ? (
              <p className="text-center text-xs font-medium text-muted-foreground">{t("analyzeNeedAppForTextPool")}</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );

  return shellBody;
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
