"use client";

import { useTranslations } from "next-intl";

import { AppCard } from "@/components/apps/app-card";
import type { AppDto } from "@/types/app";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/routing";
import { cn } from "@/lib/utils";

type Props = {
  apps: AppDto[];
  deletingAppId?: string | null;
  onDeleteApp?: (app: AppDto) => void;
};

export function AppList({ apps, deletingAppId = null, onDeleteApp }: Props) {
  const t = useTranslations("apps");

  if (apps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-border bg-muted/20 py-16 text-center">
        <div className="space-y-1">
          <p className="font-medium">{t("emptyTitle")}</p>
          <p className="max-w-sm text-sm text-muted-foreground">{t("emptyDescription")}</p>
        </div>
        <Link href="/analyze/store" className={cn(buttonVariants())}>
          {t("createFirst")}
        </Link>
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {apps.map((app) => (
        <li key={app.id} className="min-h-0">
          <AppCard app={app} onDelete={onDeleteApp} isDeleting={deletingAppId === app.id} />
        </li>
      ))}
    </ul>
  );
}
