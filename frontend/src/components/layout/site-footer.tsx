import Image from "next/image";

import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/routing";

export async function SiteFooter() {
  const t = await getTranslations("footer");

  return (
    <footer className="shrink-0 border-t border-border bg-background/95">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-3 px-4 py-6 sm:flex-row sm:gap-6">
        <Link href="/" className="shrink-0 transition-opacity hover:opacity-90">
          <Image
            src="/analyze-masthead-logo.png"
            alt="Vivindis"
            width={40}
            height={40}
            className="size-10 rounded-md"
          />
        </Link>
        <p className="text-center text-sm text-muted-foreground sm:text-left">{t("rights")}</p>
      </div>
    </footer>
  );
}
