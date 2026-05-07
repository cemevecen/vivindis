"use client";

import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, RotateCcw, Search, Upload } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { PinnedStoreAppCard, SegmentedTwo, StoreResultCard } from "@/components/analyze/analyze-hub-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectNative } from "@/components/ui/select-native";
import { useRouter } from "@/i18n/routing";
import {
  ApiError,
  apiFetch,
  formatClientFetchError,
  isLikelyFetchNetworkError,
  isPublicApiBaseUrlConfigured,
} from "@/lib/api";
import {
  appBodyFromHit,
  parseAnalyzeHubMode,
  rangeFromPreset,
  type AnalysisMode,
  type DatePresetId,
  type ReviewScope,
  type SearchPlatform,
} from "@/lib/analyze-hub-utils";
import { parseReviewFile } from "@/lib/parse-review-file";
import { parseReviewLinesFromPaste } from "@/lib/review-import-parse";
import { queryKeys } from "@/lib/query-keys";
import { storeLocaleFromUiLocale } from "@/lib/store-locale";
import { cn } from "@/lib/utils";
import type { AnalysisDto } from "@/types/analysis";
import type { AppDto, ReviewFetchDto, ReviewImportResponseDto, ReviewListResponseDto } from "@/types/app";
import type { StoreSearchResponse, StoreSearchResultItem } from "@/types/store-search";

type Props = {
  clerkEnabled: boolean;
};

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

function AnalyzeHubConnected() {
  const t = useTranslations("analyzeHub");
  const tNav = useTranslations("navigation");
  const tCommon = useTranslations("common");
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const locale = useLocale();
  const queryClient = useQueryClient();

  const searchParams = useSearchParams();
  const mode = useMemo(() => parseAnalyzeHubMode(searchParams.get("mode")), [searchParams]);
  const [datePreset, setDatePreset] = useState<DatePresetId>("30d");
  const [reviewScope, setReviewScope] = useState<ReviewScope>("global");
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>("fast");

  const dateRange = useMemo(() => rangeFromPreset(datePreset), [datePreset]);

  const { lang: searchLang, country: searchCountry } = useMemo(
    () => storeLocaleFromUiLocale(locale),
    [locale],
  );

  const [platform, setPlatform] = useState<SearchPlatform>("google_play");
  const [draftQuery, setDraftQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");

  const [compareDraftA, setCompareDraftA] = useState("");
  const [compareDraftB, setCompareDraftB] = useState("");
  const [activeCompareA, setActiveCompareA] = useState("");
  const [activeCompareB, setActiveCompareB] = useState("");
  const [compareHitA, setCompareHitA] = useState<StoreSearchResultItem | null>(null);
  const [compareHitB, setCompareHitB] = useState<StoreSearchResultItem | null>(null);
  const [comparePlatformA, setComparePlatformA] = useState<SearchPlatform>("google_play");
  const [comparePlatformB, setComparePlatformB] = useState<SearchPlatform>("google_play");
  const [compareReviewScopeA, setCompareReviewScopeA] = useState<ReviewScope>("global");
  const [compareReviewScopeB, setCompareReviewScopeB] = useState<ReviewScope>("global");
  const [compareRegistryAppA, setCompareRegistryAppA] = useState<AppDto | null>(null);
  const [compareRegistryAppB, setCompareRegistryAppB] = useState<AppDto | null>(null);
  const [compareBusy, setCompareBusy] = useState(false);

  const [targetAppId, setTargetAppId] = useState<string>("");
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
  const [fetchProgressEvents, setFetchProgressEvents] = useState<FetchProgressEvent[]>([]);
  const [nowTick, setNowTick] = useState<number>(() => Date.now());
  const [isPinningStore, setIsPinningStore] = useState(false);
  const [analysisKickoffBusy, setAnalysisKickoffBusy] = useState(false);
  const pinRequestRef = useRef(0);
  const sessionAppRef = useRef<AppDto | null>(null);
  const pinnedPanelRef = useRef<HTMLDivElement>(null);
  const lastFetchHydratedToPoolRef = useRef<string | null>(null);
  const hydrateRunTokenRef = useRef(0);
  const fetchCountSamplesRef = useRef<Array<{ ts: number; count: number }>>([]);
  const storeFetchFailedToastRef = useRef<string | null>(null);
  const storeFetchPollErrorToastRef = useRef<string | null>(null);
  const progressEventKeysRef = useRef<Set<string>>(new Set());
  const lastRunningCountRef = useRef<number>(0);

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

  const searchQuery = useQuery({
    queryKey: queryKeys.store.search(activeQuery, platform, searchLang, searchCountry),
    queryFn: () =>
      apiFetch<StoreSearchResponse>(
        `/api/v1/store/search?q=${encodeURIComponent(activeQuery)}&platform=${platform}&lang=${encodeURIComponent(searchLang)}&country=${encodeURIComponent(searchCountry)}&num=20`,
        { getToken },
      ),
    enabled: activeQuery.length >= 2 && Boolean(isSignedIn),
  });

  const searchQueryA = useQuery({
    queryKey: queryKeys.store.search(`${activeCompareA}:cmpA`, comparePlatformA, searchLang, searchCountry),
    queryFn: () =>
      apiFetch<StoreSearchResponse>(
        `/api/v1/store/search?q=${encodeURIComponent(activeCompareA)}&platform=${comparePlatformA}&lang=${encodeURIComponent(searchLang)}&country=${encodeURIComponent(searchCountry)}&num=12`,
        { getToken },
      ),
    enabled: activeCompareA.length >= 2 && Boolean(isSignedIn),
  });

  const searchQueryB = useQuery({
    queryKey: queryKeys.store.search(`${activeCompareB}:cmpB`, comparePlatformB, searchLang, searchCountry),
    queryFn: () =>
      apiFetch<StoreSearchResponse>(
        `/api/v1/store/search?q=${encodeURIComponent(activeCompareB)}&platform=${comparePlatformB}&lang=${encodeURIComponent(searchLang)}&country=${encodeURIComponent(searchCountry)}&num=12`,
        { getToken },
      ),
    enabled: activeCompareB.length >= 2 && Boolean(isSignedIn),
  });

  const appsQuery = useQuery({
    queryKey: queryKeys.apps.all,
    queryFn: () => apiFetch<AppDto[]>("/api/v1/apps", { getToken }),
    enabled: Boolean(isSignedIn),
  });

  const appFetchesQuery = useQuery({
    queryKey: sessionApp ? queryKeys.apps.fetches(sessionApp.id) : ["analyzeHub", "fetches", "idle"],
    queryFn: () => apiFetch<ReviewFetchDto[]>(`/api/v1/apps/${sessionApp?.id}/fetches`, { getToken }),
    enabled: Boolean(sessionApp?.id && isSignedIn),
  });

  const addFetchProgressEvent = useCallback((event: FetchProgressEvent) => {
    if (progressEventKeysRef.current.has(event.key)) {
      return;
    }
    progressEventKeysRef.current.add(event.key);
    setFetchProgressEvents((prev) => [...prev, event]);
  }, []);

  const resetFetchProgressTimeline = useCallback(() => {
    progressEventKeysRef.current = new Set();
    lastRunningCountRef.current = 0;
    fetchCountSamplesRef.current = [];
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
    mutationFn: async (appId: string) => {
      return apiFetch<ReviewFetchDto>(`/api/v1/apps/${appId}/fetch`, {
        method: "POST",
        body: {
          from_date: dateRange.from,
          to_date: dateRange.to,
          review_scope: reviewScope,
          ...(reviewScope === "local" ? { lang: searchLang, country: searchCountry } : {}),
        },
        getToken,
      });
    },
    onSuccess: (row) => {
      setStoreFetchId(String(row.id).trim());
      addFetchProgressEvent({
        key: `${row.id}:created`,
        at: new Date().toISOString(),
        label: t("fetchEventCreatedLabel"),
        reason: t("fetchEventCreatedReason"),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.apps.fetches(row.app_id) });
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status >= 500) {
        toast.error(t("storeReviewsPullFailed"));
        return;
      }
      const msg = err instanceof ApiError ? err.message : tCommon("error");
      toast.error(msg);
    },
  });

  const fetchRowQuery = useQuery({
    queryKey: storeFetchId ? queryKeys.reviews.fetchById(storeFetchId) : ["analyzeHub", "fetch", "idle"],
    queryFn: () => apiFetch<ReviewFetchDto>(`/api/v1/fetches/${storeFetchId}`, { getToken }),
    enabled: Boolean(storeFetchId && storeFetchId.length > 0 && isSignedIn),
    retry: (failureCount, err) =>
      failureCount < 4 && err instanceof ApiError && err.status === 404,
    retryDelay: (attempt) => 200 * (attempt + 1),
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return s === "pending" || s === "running" ? 1000 : false;
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
      const count = row.review_count ?? 0;
      if (count > 0 && count !== lastRunningCountRef.current) {
        lastRunningCountRef.current = count;
        addFetchProgressEvent({
          key: `${storeFetchId}:running-count:${count}`,
          at: isoNow,
          label: t("fetchEventReviewsCountLabel", { count }),
          reason: t("fetchEventReviewsCountReason"),
        });
      }
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
    if (!sessionApp || !storeFetchId || row?.id !== storeFetchId || row.status !== "completed") {
      return;
    }
    const runToken = ++hydrateRunTokenRef.current;
    let cancelled = false;
    const appId = sessionApp.id;
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
  }, [addFetchProgressEvent, sessionApp, storeFetchId, fetchRowQuery.data, getToken, t, tCommon]);

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
      await queryClient.invalidateQueries({ queryKey: queryKeys.analyses.byApp(appId) });
      router.push(`/apps/${appId}/analysis?fetchId=${fetchId}`);
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
    setTargetAppId((tid) => (app && tid === app.id ? "" : tid));
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
    storePullMutation.mutate(sessionApp.id);
  }, [addFetchProgressEvent, requireSignedIn, resetFetchProgressTimeline, sessionApp, storePullMutation, t]);

  /** Metin/dosya havuzu ile mağazadan yüklenen satırlar tek sayaçta birleşir. */
  const poolDisplayCount = useMemo(() => poolLines.length, [poolLines.length]);

  useEffect(() => {
    const row = fetchRowQuery.data;
    if (!row || !storeFetchId || row.id !== storeFetchId || row.status !== "running") {
      return;
    }
    const now = Date.now();
    const count = Math.max(0, row.review_count ?? 0);
    const prev = fetchCountSamplesRef.current[fetchCountSamplesRef.current.length - 1];
    if (prev && prev.count === count) {
      return;
    }
    fetchCountSamplesRef.current.push({ ts: now, count });
    if (fetchCountSamplesRef.current.length > 40) {
      fetchCountSamplesRef.current.shift();
    }
  }, [fetchRowQuery.data, storeFetchId]);

  const historicalAvgDurationSec = useMemo(() => {
    const rows = appFetchesQuery.data ?? [];
    const completed = rows
      .filter((r) => r.status === "completed" && r.started_at && r.completed_at)
      .slice(0, 10)
      .map((r) => {
        const s = Date.parse(r.started_at || "");
        const e = Date.parse(r.completed_at || "");
        return Number.isFinite(s) && Number.isFinite(e) ? Math.max(1, Math.floor((e - s) / 1000)) : 0;
      })
      .filter((v) => v > 0);
    if (completed.length === 0) {
      return 240;
    }
    return Math.max(45, Math.floor(completed.reduce((a, b) => a + b, 0) / completed.length));
  }, [appFetchesQuery.data]);

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

  const fetchEtaSec = useMemo(() => {
    const row = fetchRowQuery.data;
    if (!row || row.status !== "running" || !storeFetchId || row.id !== storeFetchId) {
      return null;
    }
    const samples = fetchCountSamplesRef.current;
    if (samples.length < 2) {
      return Math.max(0, historicalAvgDurationSec - fetchElapsedSec);
    }
    const first = samples.at(0);
    const last = samples.at(-1);
    if (first === undefined || last === undefined) {
      return Math.max(0, historicalAvgDurationSec - fetchElapsedSec);
    }
    const deltaCount = last.count - first.count;
    const deltaSec = Math.max(1, Math.floor((last.ts - first.ts) / 1000));
    const speed = deltaCount / deltaSec;
    const currentCount = Math.max(0, row.review_count ?? 0);

    if (speed <= 0.01) {
      return Math.max(0, historicalAvgDurationSec - fetchElapsedSec);
    }

    const projectedTotalBySpeed = currentCount + speed * Math.max(30, historicalAvgDurationSec * 0.8);
    const projectedTotal = Math.max(currentCount + 25, Math.floor(projectedTotalBySpeed));
    const remaining = Math.max(0, projectedTotal - currentCount);
    return Math.floor(remaining / speed);
  }, [fetchElapsedSec, fetchRowQuery.data, historicalAvgDurationSec, storeFetchId]);

  const fetchSpeedPerSec = useMemo(() => {
    const row = fetchRowQuery.data;
    if (!row || row.status !== "running" || !storeFetchId || row.id !== storeFetchId) {
      return 0;
    }
    const samples = fetchCountSamplesRef.current;
    if (samples.length < 2) {
      return 0;
    }
    // Exponential smoothing over sample deltas to reduce ETA jitter.
    let ema = 0;
    let seeded = false;
    for (let i = 1; i < samples.length; i += 1) {
      const cur = samples[i];
      const prev = samples[i - 1];
      if (cur === undefined || prev === undefined) {
        continue;
      }
      const dc = cur.count - prev.count;
      const dt = Math.max(1, Math.floor((cur.ts - prev.ts) / 1000));
      const inst = dc / dt;
      if (!seeded) {
        ema = inst;
        seeded = true;
      } else {
        ema = 0.35 * inst + 0.65 * ema;
      }
    }
    return Math.max(0, ema);
  }, [fetchRowQuery.data, storeFetchId]);

  const fetchProgressPercent = useMemo(() => {
    const row = fetchRowQuery.data;
    if (!row || !storeFetchId || row.id !== storeFetchId) {
      return 0;
    }
    if (row.status === "pending") {
      const p = Math.min(22, 8 + Math.floor(fetchElapsedSec / 4));
      return p;
    }
    if (row.status === "running") {
      const timeProgress = Math.min(92, Math.max(20, Math.floor((fetchElapsedSec / historicalAvgDurationSec) * 100)));
      if (fetchEtaSec === null || fetchEtaSec <= 0) {
        return timeProgress;
      }
      const total = fetchElapsedSec + fetchEtaSec;
      const etaProgress = total > 0 ? Math.floor((fetchElapsedSec / total) * 100) : timeProgress;
      return Math.min(96, Math.max(25, Math.floor((timeProgress + etaProgress) / 2)));
    }
    if (row.status === "completed") {
      return 100;
    }
    return 0;
  }, [fetchElapsedSec, fetchEtaSec, fetchRowQuery.data, historicalAvgDurationSec, storeFetchId]);

  const fetchDynamicHint = useMemo(() => {
    const row = fetchRowQuery.data;
    if (!row || !storeFetchId) {
      return "";
    }
    if (row.status === "pending") {
      return t("fetchHintPending");
    }
    if (row.status === "running") {
      const count = row.review_count ?? 0;
      return count > 0
        ? t("fetchHintRunningWithCount", { count })
        : t("fetchHintRunningNoCount");
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
    if (row.status === "pending") {
      return t("fetchStage1");
    }
    if (row.status === "running" && (row.review_count ?? 0) === 0) {
      return t("fetchStage2");
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

  const fetchTimeline = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : locale, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    return fetchProgressEvents.map((ev) => {
      const ts = Date.parse(ev.at);
      const time = Number.isFinite(ts) ? fmt.format(new Date(ts)) : ev.at;
      return { ...ev, time };
    });
  }, [fetchProgressEvents, locale]);

  const fetchElapsedText = useMemo(() => formatDuration(fetchElapsedSec), [fetchElapsedSec]);

  const effectiveAppId = useMemo(() => {
    const fromSelect = targetAppId.trim();
    if (fromSelect) {
      return fromSelect;
    }
    return sessionApp?.id ?? "";
  }, [targetAppId, sessionApp?.id]);

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
        await queryClient.invalidateQueries({ queryKey: queryKeys.analyses.byApp(appId) });
        router.push(`/apps/${appId}/analysis?fetchId=${storeFetchId}`);
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

  const results = useMemo(() => searchQuery.data?.results ?? [], [searchQuery.data?.results]);
  const androidHits = useMemo(() => results.filter((r) => r.platform === "google_play"), [results]);
  const iosHits = useMemo(() => results.filter((r) => r.platform === "app_store"), [results]);

  const appChoices = useMemo(() => {
    const list = appsQuery.data ?? [];
    if (sessionApp && !list.some((a) => a.id === sessionApp.id)) {
      return [sessionApp, ...list];
    }
    return list;
  }, [appsQuery.data, sessionApp]);

  const processFile = async (file: File | null) => {
    setFileLabel("");
    if (!file) {
      return;
    }
    setFileLabel(file.name);
    const { lines, errorKey } = await parseReviewFile(file);
    if (errorKey === "parseFailed") {
      toast.error(t("fileParseFailed"));
      return;
    }
    if (errorKey === "parseEmpty" || lines.length === 0) {
      toast.error(t("fileParseEmpty"));
      return;
    }
    setPoolLines((prev) => [...prev, ...lines]);
    toast.success(t("poolAppended", { count: lines.length }));
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
      if (regA && regB) {
        toast.success(t("compareOpenedRegistryPair"));
        router.push(`/compare?app_a=${regA.id}&app_b=${regB.id}`);
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
        await queryClient.invalidateQueries({ queryKey: queryKeys.apps.all });
        toast.success(t("compareCreatedBoth", { a: a.name, b: b.name }));
        router.push(`/compare?app_a=${a.id}&app_b=${b.id}`);
        return;
      }
      if (regA && hitB) {
        const b = await apiFetch<AppDto>("/api/v1/apps", {
          method: "POST",
          body: appBodyFromHit(hitB),
          getToken,
        });
        await queryClient.invalidateQueries({ queryKey: queryKeys.apps.all });
        toast.success(t("compareMixedCreatedOne", { created: b.name, existing: regA.name }));
        router.push(`/compare?app_a=${regA.id}&app_b=${b.id}`);
        return;
      }
      if (hitA && regB) {
        const a = await apiFetch<AppDto>("/api/v1/apps", {
          method: "POST",
          body: appBodyFromHit(hitA),
          getToken,
        });
        await queryClient.invalidateQueries({ queryKey: queryKeys.apps.all });
        toast.success(t("compareMixedCreatedOne", { created: a.name, existing: regB.name }));
        router.push(`/compare?app_a=${a.id}&app_b=${regB.id}`);
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

  const hideStoreResultGrid = Boolean(selectedStoreHit || isPinningStore);

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
    <div className="min-h-[60vh] space-y-6 bg-gradient-to-b from-muted/70 via-muted/35 to-background px-3 py-6 sm:px-6">
      <div className="mx-auto max-w-[min(1240px,calc(100vw-1.5rem))] space-y-6 rounded-2xl border border-border/80 bg-card/95 p-5 shadow-sm sm:p-8">
        {mode === "store" ? (
          <section className="space-y-5" aria-labelledby="analyze-store-heading">
            <h2 id="analyze-store-heading" className="sr-only">
              {t("tabStore")}
            </h2>
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
              <div className="flex flex-wrap gap-2">
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
              </div>
            </div>

            <Button
              type="button"
              className="h-12 w-full rounded-xl bg-primary text-base font-semibold text-primary-foreground hover:bg-primary/90"
              onClick={() => {
                if (requireSignedIn()) {
                  setActiveQuery(draftQuery.trim());
                }
              }}
              disabled={!isLoaded || draftQuery.trim().length < 2}
            >
              {t("searchCatalogCta")}
            </Button>

            {!isPublicApiBaseUrlConfigured() ? (
              <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-100">
                {t("apiUrlMissing")}
              </p>
            ) : null}

            {selectedStoreHit && (sessionApp || isPinningStore) ? (
              <div
                ref={pinnedPanelRef}
                className="space-y-4 rounded-2xl border border-orange-200/70 bg-orange-50/30 p-4 dark:border-orange-900/45 dark:bg-orange-950/20 sm:p-5"
              >
                <PinnedStoreAppCard
                  hit={selectedStoreHit}
                  app={sessionApp}
                  isResolving={isPinningStore && !sessionApp}
                  onClear={clearStorePin}
                  onSearchAnother={dismissStorePinCard}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="store-fetch-date-preset" className="text-foreground">
                      {t("dateRangeLabel")}
                    </Label>
                    <SelectNative
                      id="store-fetch-date-preset"
                      value={datePreset}
                      onChange={(e) => setDatePreset(e.target.value as DatePresetId)}
                      className="rounded-xl"
                      disabled={!sessionApp}
                    >
                      <option value="7d">{t("datePresetLast7")}</option>
                      <option value="30d">{t("datePresetLast30")}</option>
                      <option value="90d">{t("datePresetLast90")}</option>
                      <option value="365d">{t("datePresetLast365")}</option>
                    </SelectNative>
                  </div>
                  <div className="space-y-2">
                    <span className="block text-sm font-medium text-foreground">{t("reviewScopeLabel")}</span>
                    <SegmentedTwo
                      ariaLabel={t("reviewScopeLabel")}
                      left={t("reviewScopeLocal")}
                      right={t("reviewScopeGlobal")}
                      value={reviewScope === "local" ? "left" : "right"}
                      onChange={(v) => setReviewScope(v === "left" ? "local" : "global")}
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  className="h-12 w-full rounded-xl bg-primary text-base font-semibold text-primary-foreground shadow-md hover:bg-primary/90 disabled:opacity-50"
                  onClick={() => void handlePullStoreReviews()}
                  disabled={
                    !sessionApp ||
                    storePullMutation.isPending ||
                    fetchRowQuery.data?.status === "pending" ||
                    fetchRowQuery.data?.status === "running" ||
                    (Boolean(storeFetchId) && fetchRowQuery.isPending)
                  }
                >
                  {storePullMutation.isPending ||
                  fetchRowQuery.data?.status === "pending" ||
                  (Boolean(storeFetchId) && fetchRowQuery.isPending)
                    ? tCommon("loading")
                    : fetchRowQuery.data?.status === "running"
                      ? t("fetchRunningShort")
                      : t("pullStoreReviewsCta")}
                </Button>
                {sessionApp && storeFetchId && fetchRowQuery.isError ? (
                  <div className="space-y-2 rounded-xl border border-red-200 bg-red-50/80 p-3">
                    <p className="text-sm font-medium text-red-800">{t("storeFetchPollFailed")}</p>
                    <p className="text-xs break-words text-red-800/90">{formatClientFetchError(fetchRowQuery.error)}</p>
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
                      fetchRowQuery.data?.status === "completed"))) ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">{t("fetchProgressLabel")}</p>
                      <p className="rounded-full bg-orange-100 dark:bg-orange-950/50 px-2.5 py-1 text-sm font-bold text-orange-900 dark:text-orange-100">
                        %{fetchRowQuery.data?.status === "completed" ? 100 : fetchProgressPercent}
                      </p>
                    </div>
                    <div
                      className="h-2.5 w-full overflow-hidden rounded-full bg-muted"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={fetchRowQuery.data?.status === "completed" ? 100 : fetchProgressPercent}
                      aria-label={t("fetchProgressLabel")}
                    >
                      <div
                        className="h-full rounded-full bg-orange-500 transition-[width] duration-700 ease-out"
                        style={{
                          width: `${
                            fetchRowQuery.data?.status === "completed"
                              ? 100
                              : storePullMutation.isPending
                                ? 8
                                : fetchProgressPercent
                          }%`,
                        }}
                      />
                    </div>
                    <div className="grid gap-2 sm:grid-cols-4">
                      <div className="rounded-xl border border-orange-200 bg-orange-50/70 px-3 py-2 dark:border-orange-900/50 dark:bg-orange-950/30">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-orange-900 dark:text-orange-100/70">
                          {t("progressSectionProgress")}
                        </p>
                        <p className="text-lg font-bold tabular-nums text-orange-950 dark:text-orange-50">
                          %{fetchRowQuery.data?.status === "completed" ? 100 : fetchProgressPercent}
                        </p>
                      </div>
                      <div className="rounded-xl border border-border bg-card/80 px-3 py-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {t("progressSectionElapsed")}
                        </p>
                        <p className="text-lg font-bold tabular-nums text-foreground">{fetchElapsedText}</p>
                      </div>
                      <div className="rounded-xl border border-border bg-card/80 px-3 py-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {t("progressSectionEta")}
                        </p>
                        <p className="text-lg font-bold tabular-nums text-foreground">
                          {fetchEtaSec !== null && fetchRowQuery.data?.status === "running"
                            ? formatDuration(fetchEtaSec)
                            : fetchRowQuery.data?.status === "completed"
                              ? formatDuration(0)
                              : t("progressPlaceholderUnknown")}
                        </p>
                      </div>
                      <div className="rounded-xl border border-border bg-card/80 px-3 py-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {t("progressSectionCollected")}
                        </p>
                        <p className="text-lg font-bold tabular-nums text-foreground">
                          {fetchRowQuery.data?.review_count ?? hydratedPoolCount}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">{fetchDynamicHint}</p>
                    <p className="text-xs font-semibold text-foreground">{fetchStageLabel}</p>
                    <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-foreground">
                      <p>{t("progressElapsedInline", { value: fetchElapsedText })}</p>
                      <p>
                        {t("progressEtaInline", {
                          value:
                            fetchEtaSec !== null && fetchRowQuery.data?.status === "running"
                              ? formatDuration(fetchEtaSec)
                              : fetchRowQuery.data?.status === "completed"
                                ? formatDuration(0)
                                : t("progressPlaceholderUnknown"),
                        })}
                      </p>
                      <p>
                        {t("progressFinishInline", {
                          value: formatDuration(fetchElapsedSec + Math.max(0, fetchEtaSec ?? 0)),
                        })}
                      </p>
                      <p>
                        {fetchSpeedPerSec > 0
                          ? t("progressSpeedPerSec", { rate: fetchSpeedPerSec.toFixed(1) })
                          : t("progressSpeedMeasuring")}
                      </p>
                    </div>
                  </div>
                ) : null}
                {fetchTimeline.length > 0 ? (
                  <div className="space-y-2 rounded-xl border border-border bg-card/70 p-3">
                    <p className="text-sm font-medium text-foreground">{t("fetchLiveLogTitle")}</p>
                    <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
                      {fetchTimeline.map((ev) => (
                        <div key={ev.key} className="rounded-md border border-border bg-muted/80 px-2 py-1.5">
                          <p className="text-xs font-semibold text-foreground">
                            [{ev.time}] {ev.label}
                          </p>
                          <p className="text-xs text-muted-foreground">{ev.reason}</p>
                        </div>
                      ))}
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
                  <div className="space-y-2 rounded-xl border border-orange-200 bg-orange-50/70 p-3 dark:border-orange-900/50 dark:bg-orange-950/30">
                    <p className="text-sm font-semibold text-orange-900 dark:text-orange-100">{t("hydratePoolTitle")}</p>
                    <p className="text-xs text-orange-800 dark:text-orange-200">
                      {fetchRowQuery.data?.review_count
                        ? t("hydratePoolRowsTotal", {
                            loaded: hydratedPoolCount,
                            total: fetchRowQuery.data.review_count,
                          })
                        : t("hydratePoolRows", { loaded: hydratedPoolCount })}
                    </p>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-orange-100 dark:bg-orange-950/50">
                      <div className="h-full w-1/3 animate-pulse rounded-full bg-orange-500" />
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

            {activeQuery.length >= 2 && !hideStoreResultGrid ? (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">
                  {t("resultsHeading", { count: results.length })}
                </h3>
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
                        <ul className="grid gap-3 sm:grid-cols-1 lg:grid-cols-2">
                          {androidHits.map((hit) => (
                            <StoreResultCard
                              key={`gp-${hit.id}-${hit.name}`}
                              hit={hit}
                              onPin={(h) => void pinStoreHit(h)}
                              selectLabel={t("selectAppPin")}
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
                        <ul className="grid gap-3 sm:grid-cols-1 lg:grid-cols-2">
                          {iosHits.map((hit) => (
                            <StoreResultCard
                              key={`ios-${hit.id}-${hit.name}`}
                              hit={hit}
                              onPin={(h) => void pinStoreHit(h)}
                              selectLabel={t("selectAppPin")}
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
                  <ul className="grid gap-3 sm:grid-cols-1 lg:grid-cols-2">
                    {results.map((hit) => (
                      <StoreResultCard
                        key={`${hit.platform}-${hit.id}-${hit.name}`}
                        hit={hit}
                        onPin={(h) => void pinStoreHit(h)}
                        selectLabel={t("selectAppPin")}
                        pinDisabled={isPinningStore}
                      />
                    ))}
                  </ul>
                )}
              </div>
            ) : null}

            <p className="text-xs text-muted-foreground">{t("storeFooter")}</p>
          </section>
        ) : null}

        {mode === "file" || mode === "text" ? (
          <section className="space-y-5">
            <p className="text-sm text-muted-foreground">{t("fileTextIntro")}</p>
            <div className="space-y-2">
              <Label htmlFor="target-app" className="text-foreground">
                {t("targetAppLabel")}
              </Label>
              <SelectNative
                id="target-app"
                value={targetAppId}
                onChange={(e) => setTargetAppId(e.target.value)}
                className="rounded-xl"
              >
                <option value="">{t("targetAppPlaceholder")}</option>
                {appChoices.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} — {a.package_name || a.bundle_id || a.id.slice(0, 8)}
                  </option>
                ))}
              </SelectNative>
              {sessionApp ? (
                <p className="text-xs text-muted-foreground">{t("sessionAppLinkedHint", { name: sessionApp.name })}</p>
              ) : null}
              {appsQuery.isError ? <p className="text-xs text-red-600">{t("appsLoadError")}</p> : null}
              {!appsQuery.isPending && appChoices.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("noAppsYet")}{" "}
                  <button
                    type="button"
                    className="font-medium text-orange-700 underline dark:text-orange-300"
                    onClick={() => router.push("/apps/new")}
                  >
                    {t("goCreateApp")}
                  </button>
                </p>
              ) : null}
            </div>

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
                      "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-orange-400/70",
                      fileDragOver ? "border-orange-500 bg-orange-50/60" : "border-border bg-muted/80",
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
            ) : (
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
                    className="min-h-[160px] w-full rounded-2xl border border-border bg-card px-3 py-2 text-sm text-foreground shadow-inner"
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
            )}
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
                <SelectNative
                  id="compare-reg-a"
                  value={compareRegistryAppA?.id ?? ""}
                  onChange={(e) => {
                    const v = e.target.value.trim();
                    if (!v) {
                      setCompareRegistryAppA(null);
                      return;
                    }
                    const app = appsQuery.data?.find((a) => a.id === v);
                    if (app) {
                      setCompareRegistryAppA(app);
                      setCompareHitA(null);
                    }
                  }}
                  className="rounded-xl"
                  disabled={!appsQuery.data?.length}
                >
                  <option value="">{t("compareRegisteredSelectPlaceholder")}</option>
                  {(appsQuery.data ?? []).map((app) => (
                    <option key={app.id} value={app.id}>
                      {app.name}
                    </option>
                  ))}
                </SelectNative>
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
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={() => {
                    if (requireSignedIn()) {
                      setActiveCompareA(compareDraftA.trim());
                    }
                  }}
                  disabled={!isLoaded || compareDraftA.trim().length < 2}
                >
                  <Search className="mr-2 size-4" aria-hidden />
                  {t("searchAction")}
                </Button>
                {compareRegistryAppA ? (
                  <div className="rounded-xl border border-orange-200/70 bg-orange-50/40 p-3 dark:border-orange-900/45 dark:bg-orange-950/25">
                    <p className="text-xs font-semibold uppercase tracking-wide text-orange-900/90 dark:text-orange-200/90">
                      {t("compareSelectedSummaryLabel")}
                    </p>
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
                        <p className="truncate font-semibold text-foreground">{compareRegistryAppA.name}</p>
                        <p className="truncate font-mono text-xs text-muted-foreground">
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
                  <div className="rounded-xl border border-orange-200/70 bg-orange-50/40 p-3 dark:border-orange-900/45 dark:bg-orange-950/25">
                    <p className="text-xs font-semibold uppercase tracking-wide text-orange-900/90 dark:text-orange-200/90">
                      {t("compareSelectedSummaryLabel")}
                    </p>
                    <p className="mt-1 font-semibold text-foreground">{compareHitA.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {compareHitA.platform === "google_play" ? compareHitA.id : `id ${compareHitA.id}`}
                      {" · "}
                      {compareHitA.platform === "google_play" ? t("platformAndroid") : t("platformIos")}
                    </p>
                  </div>
                ) : null}
                {activeCompareA.length >= 2 && searchQueryA.data ? (
                  <ul className="grid gap-2">
                    {searchQueryA.data.results.map((hit) => (
                      <StoreResultCard
                        key={`ca-${hit.platform}-${hit.id}`}
                        hit={hit}
                        onPin={() => {
                          setCompareRegistryAppA(null);
                          setCompareHitA(hit);
                        }}
                        selectLabel={t("comparePickSlotA")}
                      />
                    ))}
                  </ul>
                ) : null}
              </div>
              <div className="space-y-3 rounded-2xl border border-border/80 bg-muted/20 p-4 sm:p-5">
                <Label htmlFor="compare-reg-b" className="text-foreground">
                  {t("compareRegisteredSelectLabel")}
                </Label>
                <SelectNative
                  id="compare-reg-b"
                  value={compareRegistryAppB?.id ?? ""}
                  onChange={(e) => {
                    const v = e.target.value.trim();
                    if (!v) {
                      setCompareRegistryAppB(null);
                      return;
                    }
                    const app = appsQuery.data?.find((a) => a.id === v);
                    if (app) {
                      setCompareRegistryAppB(app);
                      setCompareHitB(null);
                    }
                  }}
                  className="rounded-xl"
                  disabled={!appsQuery.data?.length}
                >
                  <option value="">{t("compareRegisteredSelectPlaceholder")}</option>
                  {(appsQuery.data ?? []).map((app) => (
                    <option key={app.id} value={app.id}>
                      {app.name}
                    </option>
                  ))}
                </SelectNative>
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
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={() => {
                    if (requireSignedIn()) {
                      setActiveCompareB(compareDraftB.trim());
                    }
                  }}
                  disabled={!isLoaded || compareDraftB.trim().length < 2}
                >
                  <Search className="mr-2 size-4" aria-hidden />
                  {t("searchAction")}
                </Button>
                {compareRegistryAppB ? (
                  <div className="rounded-xl border border-orange-200/70 bg-orange-50/40 p-3 dark:border-orange-900/45 dark:bg-orange-950/25">
                    <p className="text-xs font-semibold uppercase tracking-wide text-orange-900/90 dark:text-orange-200/90">
                      {t("compareSelectedSummaryLabel")}
                    </p>
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
                        <p className="truncate font-semibold text-foreground">{compareRegistryAppB.name}</p>
                        <p className="truncate font-mono text-xs text-muted-foreground">
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
                  <div className="rounded-xl border border-orange-200/70 bg-orange-50/40 p-3 dark:border-orange-900/45 dark:bg-orange-950/25">
                    <p className="text-xs font-semibold uppercase tracking-wide text-orange-900/90 dark:text-orange-200/90">
                      {t("compareSelectedSummaryLabel")}
                    </p>
                    <p className="mt-1 font-semibold text-foreground">{compareHitB.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {compareHitB.platform === "google_play" ? compareHitB.id : `id ${compareHitB.id}`}
                      {" · "}
                      {compareHitB.platform === "google_play" ? t("platformAndroid") : t("platformIos")}
                    </p>
                  </div>
                ) : null}
                {activeCompareB.length >= 2 && searchQueryB.data ? (
                  <ul className="grid gap-2">
                    {searchQueryB.data.results.map((hit) => (
                      <StoreResultCard
                        key={`cb-${hit.platform}-${hit.id}`}
                        hit={hit}
                        onPin={() => {
                          setCompareRegistryAppB(null);
                          setCompareHitB(hit);
                        }}
                        selectLabel={t("comparePickSlotB")}
                      />
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
            {appsQuery.data && appsQuery.data.length > 0 ? (
              <div className="space-y-2 rounded-2xl border border-border bg-card p-4 sm:p-5">
                <p className="text-sm font-semibold text-foreground">{t("compareRegisteredListTitle")}</p>
                <p className="text-xs text-muted-foreground">{t("compareRegisteredListHint")}</p>
                <ul className="max-h-56 divide-y divide-border overflow-y-auto rounded-xl border border-border">
                  {appsQuery.data.map((app) => (
                    <li key={app.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5">
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        {app.icon_url ? (
                          // eslint-disable-next-line @next/next/no-img-element -- app icon URL
                          <img
                            src={app.icon_url}
                            alt=""
                            width={36}
                            height={36}
                            className="size-9 shrink-0 rounded-lg border border-border object-cover"
                          />
                        ) : (
                          <div className="size-9 shrink-0 rounded-lg border border-dashed border-border bg-muted/50" />
                        )}
                        <span className="truncate text-sm font-medium text-foreground">{app.name}</span>
                      </div>
                      <div className="flex flex-wrap gap-4">
                        <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                          <input
                            type="checkbox"
                            className="size-4 rounded border-border accent-primary"
                            checked={compareRegistryAppA?.id === app.id}
                            onChange={(e) => onRegistrySlotCheckbox("a", app, e.target.checked)}
                          />
                          {t("compareRegisteredCol1")}
                        </label>
                        <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                          <input
                            type="checkbox"
                            className="size-4 rounded border-border accent-primary"
                            checked={compareRegistryAppB?.id === app.id}
                            onChange={(e) => onRegistrySlotCheckbox("b", app, e.target.checked)}
                          />
                          {t("compareRegisteredCol2")}
                        </label>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="compare-date" className="text-foreground">
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
              <p className="text-xs text-muted-foreground">{t("compareDateRangePoolHint")}</p>
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
              className="h-12 w-full rounded-xl bg-gradient-to-b from-amber-400 to-orange-600 text-base font-semibold text-white shadow-md disabled:opacity-50"
              disabled={!canStartCompare || compareBusy}
              onClick={() => void handleCompareStart()}
            >
              {compareBusy ? tCommon("loading") : t("startCompareCta")}
            </Button>
            <p className="text-xs text-muted-foreground">{tNav("compare")}</p>
          </section>
        ) : null}

        {mode !== "compare" ? (
          <div className="sticky bottom-1 z-10 mt-6 space-y-4 rounded-2xl border-2 border-orange-200/80 bg-gradient-to-b from-card to-orange-50/35 p-4 shadow-xl dark:border-orange-900/50 dark:from-card dark:to-orange-950/25 sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-orange-200/60 dark:border-orange-900/40 pb-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-orange-900 dark:text-orange-200/90">{t("poolBadgeTitle")}</p>
                <p className="text-3xl font-bold tabular-nums text-foreground">{poolDisplayCount}</p>
                {isHydratingPool ? (
                  <p className="mt-1 text-xs font-medium text-orange-800 dark:text-orange-200">{t("hydratePoolTitle")}</p>
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
              <SegmentedTwo
                ariaLabel={t("analysisModeLabel")}
                left={t("analysisModeFast")}
                right={t("analysisModeRich")}
                value={analysisMode === "fast" ? "left" : "right"}
                onChange={(v) => setAnalysisMode(v === "left" ? "fast" : "rich")}
              />
            </div>
            {poolLines.length > 0 && !effectiveAppId ? (
              <p className="text-center text-xs font-medium text-amber-900 dark:text-amber-200">{t("analyzeNeedAppForTextPool")}</p>
            ) : null}
            <Button
              type="button"
              className="h-14 w-full rounded-xl bg-gradient-to-b from-amber-400 to-orange-600 text-lg font-bold text-white shadow-md hover:from-amber-500 hover:to-orange-600 disabled:opacity-50"
              disabled={!canRunUnifiedAnalysis || analysisKickoffBusy || importMutation.isPending}
              onClick={() => void runUnifiedAnalysis()}
            >
              {analysisKickoffBusy || importMutation.isPending ? tCommon("loading") : t("startSentimentCta")}
            </Button>
            {!canRunUnifiedAnalysis ? (
              <p className="text-center text-xs text-muted-foreground">{t("analyzeFooterDisabledHint")}</p>
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
