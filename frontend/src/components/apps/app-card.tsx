"use client";

import { Package, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/routing";
import type { AppDto } from "@/types/app";

const CARD_H = "h-40"; /* sabit kutucuk yüksekliği — tüm kartlar aynı */

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
  const storeId = app.package_name?.trim() || app.bundle_id?.trim() || null;

  return (
    <div
      className={`group relative flex ${CARD_H} rounded-lg border border-border bg-card shadow-sm transition-colors hover:border-primary/40 hover:bg-muted/30`}
    >
      <Link
        href={`/apps/${app.id}`}
        className="flex min-h-0 min-w-0 flex-1 items-center gap-3 p-3 pr-[5.25rem]"
      >
        <div className="relative size-14 shrink-0 overflow-hidden rounded-xl border border-border bg-muted/40">
          {app.icon_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- harici mağaza / ikon URL
            <img
              src={app.icon_url}
              alt=""
              width={56}
              height={56}
              className="size-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex size-full items-center justify-center bg-muted/60 text-muted-foreground">
              <Package className="size-7 opacity-60" aria-hidden />
            </div>
          )}
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col justify-center gap-1">
          <h2 className="line-clamp-2 text-sm font-semibold leading-snug tracking-tight text-foreground">
            {app.name || t("detailTitle")}
          </h2>
          <p className="text-xs text-muted-foreground">{platformLabel(app, t)}</p>
          {storeId ? (
            <p className="truncate font-mono text-[11px] text-muted-foreground" title={storeId}>
              {storeId}
            </p>
          ) : null}
        </div>
      </Link>
      {onDelete ? (
        <Button
          type="button"
          variant="outline"
          size="xs"
          className="absolute right-2.5 top-2.5 z-10 rounded-full border-destructive/25 bg-background px-2 text-xs font-semibold text-destructive shadow-sm hover:bg-destructive hover:text-destructive-foreground [&_svg]:text-current"
          aria-label={t("deleteApp")}
          disabled={isDeleting}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onDelete(app);
          }}
        >
          <X className="size-3" aria-hidden />
          {t("deleteShort")}
        </Button>
      ) : null}
    </div>
  );
}
