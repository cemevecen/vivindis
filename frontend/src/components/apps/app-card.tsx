"use client";

import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import type { AppDto } from "@/types/app";

function platformLabel(app: AppDto, t: (key: string) => string) {
  switch (app.platform) {
    case "google_play":
      return t("platformGooglePlay");
    case "app_store":
      return t("platformAppStore");
    default:
      return t("platformBoth");
  }
}

export function AppCard({ app }: { app: AppDto }) {
  const t = useTranslations("apps");

  return (
    <Link
      href={`/apps/${app.id}`}
      className={cn(
        "group flex flex-col justify-between rounded-lg border border-border bg-card p-4 shadow-sm transition-colors",
        "hover:border-primary/40 hover:bg-muted/30",
      )}
    >
      <div className="space-y-1">
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-semibold leading-tight tracking-tight">{app.name || t("detailTitle")}</h2>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
        </div>
        <p className="text-xs text-muted-foreground">{platformLabel(app, t)}</p>
        {app.package_name ? (
          <p className="truncate font-mono text-xs text-muted-foreground">{app.package_name}</p>
        ) : null}
      </div>
    </Link>
  );
}
