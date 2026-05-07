import { getTranslations } from "next-intl/server";

import { BuildVersionBadge } from "@/components/layout/build-version-badge";
import { Link } from "@/i18n/routing";

export async function SiteFooter() {
  const t = await getTranslations("footer");
  const tNav = await getTranslations("navigation");

  return (
    <footer className="shrink-0 border-t border-border bg-neutral-100/95 dark:bg-zinc-900/95">
      <div className="mx-auto flex max-w-6xl flex-nowrap items-center justify-center gap-x-4 overflow-x-auto px-4 py-6 sm:gap-x-8">
        <p className="shrink-0 whitespace-nowrap text-sm text-muted-foreground">{t("rights")}</p>
        <Link
          href="/about"
          className="shrink-0 whitespace-nowrap text-sm font-semibold text-foreground underline-offset-4 decoration-foreground/40 underline transition-colors hover:text-primary hover:decoration-primary hover:underline"
        >
          {tNav("about")}
        </Link>
        <BuildVersionBadge className="shrink-0 whitespace-nowrap" />
      </div>
    </footer>
  );
}
