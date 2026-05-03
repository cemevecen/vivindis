"use client";

import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery } from "@tanstack/react-query";
import { FileText, GitCompare, Search, Store, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { ComparePageContent } from "@/components/compare/compare-page-content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "@/i18n/routing";
import { ApiError, apiFetch } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import type { AppDto } from "@/types/app";
import type { StoreSearchHit } from "@/types/store-search";

type Mode = "store" | "file" | "text" | "compare";

type Props = {
  clerkEnabled: boolean;
};

/** Clerk + useAuth yalnızca `clerkEnabled` iken mount edilir (SSG / Clerk yok ortamı). */
function AnalyzeHubConnected() {
  const t = useTranslations("analyzeHub");
  const tNav = useTranslations("navigation");
  const tCompare = useTranslations("compare");
  const tCommon = useTranslations("common");
  const { getToken } = useAuth();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("store");
  const [platform, setPlatform] = useState<"google_play" | "app_store">("google_play");
  const [draftQuery, setDraftQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");

  const searchQuery = useQuery({
    queryKey: queryKeys.store.search(activeQuery, platform),
    queryFn: () =>
      apiFetch<StoreSearchHit[]>(
        `/api/v1/store/search?q=${encodeURIComponent(activeQuery)}&platform=${platform}&lang=tr&country=tr`,
        { getToken },
      ),
    enabled: activeQuery.length >= 2,
  });

  const createMutation = useMutation({
    mutationFn: async (hit: StoreSearchHit) => {
      const body = {
        platform: hit.store,
        package_name: hit.package_name,
        bundle_id: hit.bundle_id?.trim() ? hit.bundle_id.trim() : null,
        name: hit.name,
        developer: hit.developer,
        category: hit.category,
        icon_url: hit.icon_url,
        is_active: true,
      };
      return apiFetch<AppDto>("/api/v1/apps", { method: "POST", body, getToken });
    },
    onSuccess: (app) => {
      toast.success(t("appLinked"));
      router.push(`/apps/${app.id}`);
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : tCommon("error"));
    },
  });

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
              <div className="flex gap-2">
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
          </div>

          {activeQuery.length >= 2 ? (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">
                {t("resultsHeading", { count: searchQuery.data?.length ?? 0 })}
              </h3>
              {searchQuery.isPending ? (
                <p className="text-sm text-muted-foreground">{tCommon("loading")}</p>
              ) : searchQuery.isError ? (
                <p className="text-sm text-destructive">{tCommon("error")}</p>
              ) : !searchQuery.data?.length ? (
                <p className="text-sm text-muted-foreground">{t("noResults")}</p>
              ) : (
                <ul className="grid gap-3 sm:grid-cols-1 lg:grid-cols-2">
                  {searchQuery.data.map((hit) => (
                    <li
                      key={`${hit.store}-${hit.package_name || hit.bundle_id}-${hit.name}`}
                      className="flex gap-3 rounded-lg border border-border bg-card p-4 shadow-sm"
                    >
                      {hit.icon_url ? (
                        // eslint-disable-next-line @next/next/no-img-element -- harici mağaza CDN; remotePatterns gerekmez
                        <img
                          src={hit.icon_url}
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
                          {hit.store === "google_play" ? hit.package_name : `id: ${hit.bundle_id ?? "—"}`}
                        </p>
                        {hit.developer ? (
                          <p className="truncate text-xs text-muted-foreground">{hit.developer}</p>
                        ) : null}
                        {hit.category ? (
                          <p className="text-xs text-muted-foreground">{hit.category}</p>
                        ) : null}
                        {hit.score != null ? (
                          <p className="text-xs font-medium text-foreground">
                            {t("ratingShort", { score: hit.score.toFixed(1) })}
                          </p>
                        ) : null}
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        className="self-center shrink-0"
                        disabled={createMutation.isPending}
                        onClick={() => createMutation.mutate(hit)}
                      >
                        {t("selectApp")}
                      </Button>
                    </li>
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
