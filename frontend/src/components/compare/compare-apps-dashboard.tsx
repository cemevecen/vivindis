"use client";

import { useQueries } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/routing";
import { apiFetch } from "@/lib/api";
import { usePublicToken } from "@/lib/auth";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import type { AnalysisListDto } from "@/types/analysis";
import type { AppDto, ReviewFetchDto } from "@/types/app";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validUuid(id: string): boolean {
  return UUID_RE.test(id.trim());
}

type Props = {
  appIdA: string;
  appIdB: string;
  clerkEnabled: boolean;
};

/**
 * Clerk anahtarı yoksa kökte `ClerkProvider` yoktur; `useAuth` yalnızca alt bileşende,
 * `clerkEnabled === true` iken çağrılır.
 */
export function CompareAppsDashboard({ appIdA, appIdB, clerkEnabled }: Props) {
  const t = useTranslations("compare");
  const okA = validUuid(appIdA);
  const okB = validUuid(appIdB);
  void clerkEnabled;

  if (!okA || !okB) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {t("invalidAppIds")}
      </div>
    );
  }

  return <CompareAppsDashboardAuthed appIdA={appIdA} appIdB={appIdB} />;
}

function CompareAppsDashboardAuthed({ appIdA, appIdB }: { appIdA: string; appIdB: string }) {
  const t = useTranslations("compare");
  const tApps = useTranslations("apps");
  const tCommon = useTranslations("common");
  const ta = useTranslations("analysis");
  const getToken = usePublicToken();

  const queries = useQueries({
    queries: [
      {
        queryKey: queryKeys.apps.detail(appIdA),
        queryFn: () => apiFetch<AppDto>(`/api/v1/apps/${appIdA}`, { getToken }),
        enabled: true,
      },
      {
        queryKey: queryKeys.apps.detail(appIdB),
        queryFn: () => apiFetch<AppDto>(`/api/v1/apps/${appIdB}`, { getToken }),
        enabled: true,
      },
      {
        queryKey: queryKeys.apps.fetches(appIdA),
        queryFn: () => apiFetch<ReviewFetchDto[]>(`/api/v1/apps/${appIdA}/fetches`, { getToken }),
        enabled: true,
      },
      {
        queryKey: queryKeys.apps.fetches(appIdB),
        queryFn: () => apiFetch<ReviewFetchDto[]>(`/api/v1/apps/${appIdB}/fetches`, { getToken }),
        enabled: true,
      },
      {
        queryKey: queryKeys.analyses.byApp(appIdA),
        queryFn: () => apiFetch<AnalysisListDto>(`/api/v1/apps/${appIdA}/analyses`, { getToken }),
        enabled: true,
      },
      {
        queryKey: queryKeys.analyses.byApp(appIdB),
        queryFn: () => apiFetch<AnalysisListDto>(`/api/v1/apps/${appIdB}/analyses`, { getToken }),
        enabled: true,
      },
    ],
  });

  const [appAq, appBq, fetchAq, fetchBq, anaAq, anaBq] = queries;

  if (queries.some((q) => q.isPending)) {
    return <p className="text-sm text-muted-foreground">{tCommon("loading")}</p>;
  }

  if (queries.some((q) => q.isError)) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-destructive">{t("loadPairFailed")}</p>
        <Link href="/compare" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          {t("clearCompare")}
        </Link>
      </div>
    );
  }

  const appA = appAq.data;
  const appB = appBq.data;
  if (!appA || !appB) {
    return null;
  }

  const latestFetch = (rows: ReviewFetchDto[] | undefined) =>
    rows && rows.length
      ? [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
      : undefined;

  const fa = latestFetch(fetchAq.data);
  const fb = latestFetch(fetchBq.data);

  const latestHeuristic = (items: AnalysisListDto | undefined) =>
    (items?.items ?? []).filter((x) => x.type === "heuristic" && x.status === "completed").sort((a, b) =>
      a.created_at < b.created_at ? 1 : -1,
    )[0];

  const hA = latestHeuristic(anaAq.data);
  const hB = latestHeuristic(anaBq.data);

  const Card = ({
    title,
    app,
    fetchRow,
    hasHeuristic,
  }: {
    title: string;
    app: AppDto;
    fetchRow: ReviewFetchDto | undefined;
    hasHeuristic: boolean;
  }) => (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <h2 className="mt-1 text-xl font-semibold tracking-tight">{app.name}</h2>
      <p className="mt-1 font-mono text-xs text-muted-foreground">{app.package_name || app.bundle_id || "—"}</p>
      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">{tApps("reviews")}</dt>
          <dd>{fetchRow?.review_count ?? "—"}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">{tApps("status")}</dt>
          <dd>{fetchRow ? fetchRow.status : "—"}</dd>
        </div>
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={`/apps/${app.id}`} className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}>
          {tApps("detailTitle")}
        </Link>
        {fetchRow?.status === "completed" ? (
          <Link
            href={`/apps/${app.id}/analysis?fetchId=${fetchRow.id}`}
            className={cn(buttonVariants({ size: "sm" }))}
          >
            {ta("viewAnalytics")}
          </Link>
        ) : null}
      </div>
      {hasHeuristic ? (
        <p className="mt-3 text-xs text-muted-foreground">{t("heuristicReadyHint")}</p>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">{t("runHeuristicHint")}</p>
      )}
    </div>
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("pairTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("pairSubtitle")}</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={t("slotA")} app={appA} fetchRow={fa} hasHeuristic={Boolean(hA)} />
        <Card title={t("slotB")} app={appB} fetchRow={fb} hasHeuristic={Boolean(hB)} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href="/analyze" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          {t("backToAnalyze")}
        </Link>
        <Link href="/compare" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
          {t("clearCompare")}
        </Link>
      </div>
    </div>
  );
}
