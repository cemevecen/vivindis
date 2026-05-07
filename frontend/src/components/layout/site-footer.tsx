import { getTranslations } from "next-intl/server";

import { BuildVersionBadge } from "@/components/layout/build-version-badge";
import { Link } from "@/i18n/routing";

export async function SiteFooter() {
  const t = await getTranslations("footer");
  const tNav = await getTranslations("navigation");

  return (
    <footer className="shrink-0 border-t border-border bg-background/95">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-3 px-4 py-6">
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-6">
          <p className="text-center text-sm text-muted-foreground sm:text-left">{t("rights")}</p>
        </div>
        <Link
          href="/about"
          className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
        >
          {tNav("about")}
        </Link>
        <BuildVersionBadge className="text-center" />
      </div>
    </footer>
  );
}
