"use client";

import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { AppList } from "@/components/apps/app-list";
import { AppsSkeleton } from "@/components/apps/apps-skeleton";
import { Button } from "@/components/ui/button";
import { ApiError, apiFetch } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { AppDto } from "@/types/app";

type Props = {
  clerkEnabled: boolean;
};

function AppsConnectedList() {
  const { getToken } = useAuth();
  const tDash = useTranslations("dashboard");
  const tApps = useTranslations("apps");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.apps.all,
    queryFn: () => apiFetch<AppDto[]>("/api/v1/apps", { getToken }),
  });

  const deleteMutation = useMutation({
    mutationFn: (appId: string) =>
      apiFetch<void>(`/api/v1/apps/${appId}`, {
        method: "DELETE",
        getToken,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.apps.all });
      toast.success(tApps("deleteSuccess"));
    },
    onError: (error) => {
      const message = error instanceof ApiError ? error.message : tApps("deleteFailed");
      toast.error(message);
    },
  });

  const handleDeleteApp = (app: AppDto) => {
    const confirmed = window.confirm(tApps("deleteConfirm", { name: app.name || tApps("detailTitle") }));
    if (!confirmed) {
      return;
    }
    deleteMutation.mutate(app.id);
  };

  if (query.isPending) {
    return <AppsSkeleton />;
  }

  if (query.isError) {
    const message = query.error instanceof Error ? query.error.message : tDash("loadError");
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-center text-sm">
        <p className="font-medium text-destructive">{tDash("loadError")}</p>
        <p className="mt-1 text-muted-foreground">{message}</p>
        <Button type="button" variant="outline" className="mt-4" onClick={() => void query.refetch()}>
          {tCommon("retry")}
        </Button>
      </div>
    );
  }

  return (
    <AppList
      apps={query.data ?? []}
      deletingAppId={deleteMutation.isPending ? deleteMutation.variables ?? null : null}
      onDeleteApp={handleDeleteApp}
    />
  );
}

export function AppsListPanel({ clerkEnabled }: Props) {
  const tDash = useTranslations("dashboard");

  if (!clerkEnabled) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
        {tDash("noClerk")}
      </div>
    );
  }

  return <AppsConnectedList />;
}
