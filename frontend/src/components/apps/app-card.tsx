"use client";

import { ChevronRight, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/routing";
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

type Props = {
  app: AppDto;
  onDelete?: (app: AppDto) => void;
  isDeleting?: boolean;
};

export function AppCard({ app, onDelete, isDeleting = false }: Props) {
  const t = useTranslations("apps");

  return (
    <div className="group relative rounded-lg border border-border bg-card shadow-sm transition-colors hover:border-primary/40 hover:bg-muted/30">
      <Link href={`/apps/${app.id}`} className="block p-4 pr-11">
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
      {onDelete ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="absolute right-2 top-2 rounded-full text-muted-foreground opacity-70 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
          aria-label={t("deleteApp")}
          disabled={isDeleting}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onDelete(app);
          }}
        >
          <X className="size-3.5" aria-hidden />
        </Button>
      ) : null}
    </div>
  );
}
