"use client";

import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, GitCompare, Search, Store, Upload } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { PinnedStoreAppCard, SegmentedTwo, StoreResultCard } from "@/components/analyze/analyze-hub-parts";
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
import {
  MASTHEAD_PLUS_PATTERN,
  appBodyFromHit,
  rangeFromPreset,
  type AnalysisMode,
  type AnalyzeHubMode,
  type DatePresetId,
  type ReviewScope,
  type SearchPlatform,
} from "@/lib/analyze-hub-utils";
import { parseReviewFile } from "@/lib/parse-review-file";
import { parseReviewLinesFromPaste } from "@/lib/review-import-parse";
import { queryKeys } from "@/lib/query-keys";
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

function AnalyzeHubConnected() {
  const t = useTranslations("analyzeHub");
  const tNav = useTranslations("navigation");
  const tCommon = useTranslations("common");
  const { getToken } = useAuth();
  const router = useRouter();
  const locale = useLocale();
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<AnalyzeHubMode>("store");
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
  /** Havuz: dosya/metin satırları (mağaza çekimi tamamlanınca sayaç ayrıca fetch.review_count ile birleşir). */
  const [poolLines, setPoolLines] = useState<string[]>([]);
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
  const storeFetchFailedToastRef = useRef<string | null>(null);
  const storeFetchPollErrorToastRef = useRef<string | null>(null);
  const progressEventKeysRef = useRef<Set<string>>(new Set());
  const lastRunningCountRef = useRef<number>(0);

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
          lang: searchLang,
          country: searchCountry,
        },
        getToken,
      });
    },
    onSuccess: (row) => {
      setStoreFetchId(String(row.id).trim());
      addFetchProgressEvent({
        key: `${row.id}:created`,
        at: new Date().toISOString(),
        label: "Fetch kaydı oluşturuldu",
        reason: "İstek API tarafından alındı, worker kuyruğa gönderiliyor.",
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
    enabled: Boolean(storeFetchId && storeFetchId.length > 0),
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
        label: "Kuyruğa alındı",
        reason: "Worker bu fetch görevini alana kadar bekleniyor.",
      });
      return;
    }
    if (row.status === "running") {
      addFetchProgressEvent({
        key: `${storeFetchId}:running`,
        at: row.started_at || isoNow,
        label: "Worker görevi başlattı",
        reason: "Mağaza API çağrıları ile yorumlar toplanıyor.",
      });
      const count = row.review_count ?? 0;
      if (count > 0 && count !== lastRunningCountRef.current) {
        lastRunningCountRef.current = count;
        addFetchProgressEvent({
          key: `${storeFetchId}:running-count:${count}`,
          at: isoNow,
          label: `${count} yorum toplandı`,
          reason: "Scraper yeni yorumları havuza eklemeye devam ediyor.",
        });
      }
      return;
    }
    if (row.status === "completed") {
      addFetchProgressEvent({
        key: `${storeFetchId}:completed`,
        at: row.completed_at || isoNow,
        label: `Fetch tamamlandı (${row.review_count} yorum)`,
        reason: "Mağaza çekimi bitti; analiz adımına geçebilirsiniz.",
      });
      return;
    }
    if (row.status === "failed") {
      addFetchProgressEvent({
        key: `${storeFetchId}:failed`,
        at: row.completed_at || isoNow,
        label: "Fetch başarısız",
        reason: row.error_message || "Worker hata döndürdü, log kontrol edilmeli.",
      });
    }
  }, [addFetchProgressEvent, fetchRowQuery.data, storeFetchId]);

  useEffect(() => {
    const row = fetchRowQuery.data;
    if (!sessionApp || !storeFetchId || row?.id !== storeFetchId || row.status !== "completed") {
      return;
    }
    let cancelled = false;
    const appId = sessionApp.id;
    void (async () => {
      try {
        addFetchProgressEvent({
          key: `${storeFetchId}:hydrate-start`,
          at: new Date().toISOString(),
          label: "Yorumlar arayüze aktarılıyor",
          reason: "Review listesi sayfalı çekilip havuz sayacına yazılıyor.",
        });
        const limit = 100;
        let offset = 0;
        const bodies: string[] = [];
        let total = 0;
        for (;;) {
          const chunk = await apiFetch<ReviewListResponseDto>(
            `/api/v1/apps/${appId}/reviews?limit=${limit}&offset=${offset}`,
            { getToken },
          );
          total = chunk.total;
          for (const it of chunk.items) {
            const text = [it.title, it.body].filter(Boolean).join("\n").trim();
            if (text.length > 0) {
              bodies.push(text);
            }
          }
          offset += chunk.items.length;
          if (cancelled) {
            return;
          }
          if (offset >= total || chunk.items.length === 0) {
            break;
          }
        }
        if (cancelled) {
          return;
        }
        setPoolLines(bodies);
        lastFetchHydratedToPoolRef.current = storeFetchId;
        addFetchProgressEvent({
          key: `${storeFetchId}:hydrate-complete`,
          at: new Date().toISOString(),
          label: `Arayüz havuzu güncellendi (${bodies.length} satır)`,
          reason: "Artık analiz butonuyla bir sonraki adıma geçebilirsiniz.",
        });
      } catch (e) {
        if (!cancelled) {
          const detail = e instanceof ApiError ? e.message : tCommon("error");
          toast.error(t("storeReviewsHydrateFailed", { detail }));
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
      } catch {
        toast.error(t("analyzeKickoffFailed"));
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.apps.fetches(appId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.analyses.byApp(appId) });
      router.push(`/apps/${appId}/analysis?fetchId=${fetchId}`);
    },
    [getToken, queryClient, router, runAnalysisTypes, t],
  );

  const dismissStorePinCard = useCallback(() => {
    pinRequestRef.current += 1;
    setSelectedStoreHit(null);
    setStoreFetchId(null);
    setIsPinningStore(false);
  }, []);

  const clearStorePin = useCallback(() => {
    pinRequestRef.current += 1;
    const app = sessionAppRef.current;
    setTargetAppId((tid) => (app && tid === app.id ? "" : tid));
    setSelectedStoreHit(null);
    setSessionApp(null);
    setStoreFetchId(null);
    setIsPinningStore(false);
    lastFetchHydratedToPoolRef.current = null;
    storeFetchFailedToastRef.current = null;
    storeFetchPollErrorToastRef.current = null;
  }, []);

  const pinStoreHit = useCallback(
    async (hit: StoreSearchResultItem) => {
      const token = ++pinRequestRef.current;
      setIsPinningStore(true);
      setSelectedStoreHit(hit);
      setStoreFetchId(null);
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
    [getToken, queryClient, t, tCommon],
  );

  const handlePullStoreReviews = useCallback(() => {
    if (!sessionApp) {
      return;
    }
    resetFetchProgressTimeline();
    addFetchProgressEvent({
      key: `${sessionApp.id}:request-start`,
      at: new Date().toISOString(),
      label: "Çekim isteği gönderildi",
      reason: "API kaydı oluşturup worker kuyruğuna yazana kadar bekleniyor.",
    });
    setStoreFetchId(null);
    setPoolLines([]);
    lastFetchHydratedToPoolRef.current = null;
    storeFetchFailedToastRef.current = null;
    storeFetchPollErrorToastRef.current = null;
    storePullMutation.mutate(sessionApp.id);
  }, [
    addFetchProgressEvent,
    resetFetchProgressTimeline,
    reviewScope,
    searchCountry,
    searchLang,
    sessionApp,
    storePullMutation,
  ]);

  /** Metin/dosya havuzu ile mağazadan yüklenen satırlar tek sayaçta birleşir. */
  const poolDisplayCount = useMemo(() => poolLines.length, [poolLines.length]);

  const fetchProgressPercent = useMemo(() => {
    const row = fetchRowQuery.data;
    if (!row || (row.status !== "pending" && row.status !== "running")) {
      return 0;
    }
    if (row.status === "pending") {
      return 25;
    }
    return 65;
  }, [fetchRowQuery.data]);

  const fetchDynamicHint = useMemo(() => {
    const row = fetchRowQuery.data;
    if (!row || !storeFetchId) {
      return "";
    }
    if (row.status === "pending") {
      return "Kuyruga alindi, worker bekleniyor...";
    }
    if (row.status === "running") {
      const count = row.review_count ?? 0;
      return count > 0
        ? `Magazadan yorumlar cekiliyor... (${count} yorum toplandi)`
        : "Google Play ve App Store yorumlari cekiliyor...";
    }
    if (row.status === "completed") {
      return `Yorum cekimi tamamlandi (${row.review_count} yorum). Simdi analiz baslatabilirsiniz.`;
    }
    return row.error_message ?? "";
  }, [fetchRowQuery.data, storeFetchId]);

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

  const fetchElapsedText = useMemo(() => {
    if (!fetchTimeline.length) {
      return "";
    }
    const startMs = Date.parse(fetchTimeline[0].at);
    if (!Number.isFinite(startMs)) {
      return "";
    }
    const endMs =
      fetchRowQuery.data?.status === "completed" || fetchRowQuery.data?.status === "failed"
        ? Date.parse(fetchRowQuery.data?.completed_at || "")
        : nowTick;
    const safeEnd = Number.isFinite(endMs) ? endMs : nowTick;
    const sec = Math.max(0, Math.floor((safeEnd - startMs) / 1000));
    const mm = String(Math.floor(sec / 60)).padStart(2, "0");
    const ss = String(sec % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  }, [fetchRowQuery.data?.completed_at, fetchRowQuery.data?.status, fetchTimeline, nowTick]);

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
    const appId = effectiveAppId;
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
    if (fetchRowQuery.data?.status === "completed" && storeFetchId) {
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
      } catch {
        toast.error(t("analyzeKickoffFailed"));
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
    router,
    runAnalysisTypes,
    t,
    tCommon,
  ]);

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

  const hideStoreResultGrid = Boolean(selectedStoreHit || isPinningStore);

  useEffect(() => {
    if (!selectedStoreHit || (!sessionApp && !isPinningStore)) {
      return;
    }
    pinnedPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedStoreHit, sessionApp, isPinningStore]);

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
              {t("searchCatalogCta")}
            </Button>

            {!isPublicApiBaseUrlConfigured() ? (
              <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-950">
                {t("apiUrlMissing")}
              </p>
            ) : null}

            {selectedStoreHit && (sessionApp || isPinningStore) ? (
              <div
                ref={pinnedPanelRef}
                className="space-y-4 rounded-2xl border border-orange-200/70 bg-orange-50/30 p-4 sm:p-5"
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
                    <Label htmlFor="store-fetch-date-preset" className="text-slate-800">
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
                <Button
                  type="button"
                  className="h-12 w-full rounded-xl bg-gradient-to-b from-slate-800 to-slate-950 text-base font-semibold text-white shadow-md hover:from-slate-700 hover:to-slate-900 disabled:opacity-50"
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
                (fetchRowQuery.data?.status === "pending" || fetchRowQuery.data?.status === "running") ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-800">{t("fetchProgressLabel")}</p>
                    <div
                      className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={fetchProgressPercent}
                      aria-label={t("fetchProgressLabel")}
                    >
                      <div
                        className="h-full rounded-full bg-orange-500 transition-[width] duration-700 ease-out"
                        style={{ width: `${fetchProgressPercent}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-600">{fetchDynamicHint}</p>
                    {fetchElapsedText ? (
                      <p className="text-xs font-medium text-slate-700">Gecen sure: {fetchElapsedText}</p>
                    ) : null}
                  </div>
                ) : null}
                {fetchTimeline.length > 0 ? (
                  <div className="space-y-2 rounded-xl border border-slate-200 bg-white/70 p-3">
                    <p className="text-sm font-medium text-slate-800">Canli islem gunlugu</p>
                    <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
                      {fetchTimeline.map((ev) => (
                        <div key={ev.key} className="rounded-md border border-slate-100 bg-slate-50/80 px-2 py-1.5">
                          <p className="text-xs font-semibold text-slate-700">
                            [{ev.time}] {ev.label}
                          </p>
                          <p className="text-xs text-slate-600">{ev.reason}</p>
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
              </div>
            ) : null}

            {activeQuery.length >= 2 && !hideStoreResultGrid ? (
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
                              onPin={(h) => void pinStoreHit(h)}
                              selectLabel={t("selectAppPin")}
                              pinDisabled={isPinningStore}
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
                              onPin={(h) => void pinStoreHit(h)}
                              selectLabel={t("selectAppPin")}
                              pinDisabled={isPinningStore}
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
                        onPin={(h) => void pinStoreHit(h)}
                        selectLabel={t("selectAppPin")}
                        pinDisabled={isPinningStore}
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
            <p className="text-sm text-slate-600">{t("fileTextIntro")}</p>
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
                {appChoices.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} — {a.package_name || a.bundle_id || a.id.slice(0, 8)}
                  </option>
                ))}
              </SelectNative>
              {sessionApp ? (
                <p className="text-xs text-slate-500">{t("sessionAppLinkedHint", { name: sessionApp.name })}</p>
              ) : null}
              {appsQuery.isError ? <p className="text-xs text-red-600">{t("appsLoadError")}</p> : null}
              {!appsQuery.isPending && appChoices.length === 0 ? (
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
                  {fileLabel ? <p className="text-xs text-slate-500">{fileLabel}</p> : null}
                </div>
                <p className="text-xs text-slate-600">{t("filePoolFooterHint")}</p>
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
                  onClick={handleLoadTextIntoPool}
                >
                  {t("loadTextToPool")}
                </Button>
                <p className="text-xs text-slate-600">{t("textPoolFooterHint")}</p>
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
                        onPin={() => setCompareHitA(hit)}
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
                        onPin={() => setCompareHitB(hit)}
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

        {mode !== "compare" ? (
          <div className="sticky bottom-1 z-10 mt-6 space-y-4 rounded-2xl border-2 border-orange-200/80 bg-gradient-to-b from-white to-orange-50/40 p-4 shadow-xl sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-orange-100 pb-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-orange-900/80">{t("poolBadgeTitle")}</p>
                <p className="text-3xl font-bold tabular-nums text-slate-900">{poolDisplayCount}</p>
              </div>
              {poolLines.length > 0 ? (
                <Button type="button" variant="ghost" size="sm" className="text-slate-600" onClick={() => setPoolLines([])}>
                  {t("clearManualPool")}
                </Button>
              ) : null}
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-900">{t("analysisModeSectionTitle")}</p>
              <SegmentedTwo
                ariaLabel={t("analysisModeLabel")}
                left={t("analysisModeFast")}
                right={t("analysisModeRich")}
                value={analysisMode === "fast" ? "left" : "right"}
                onChange={(v) => setAnalysisMode(v === "left" ? "fast" : "rich")}
              />
            </div>
            {poolLines.length > 0 && !effectiveAppId ? (
              <p className="text-center text-xs font-medium text-amber-900">{t("analyzeNeedAppForTextPool")}</p>
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
              <p className="text-center text-xs text-slate-600">{t("analyzeFooterDisabledHint")}</p>
            ) : null}
          </div>
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
