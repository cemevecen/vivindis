import { getTranslations } from "next-intl/server";

import { BuildVersionBadge } from "@/components/layout/build-version-badge";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/routing";
import { cn } from "@/lib/utils";

export default async function LocaleHomePage() {
  const tNav = await getTranslations("navigation");
  const tAuth = await getTranslations("auth");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          Vivindis
        </Link>
        <BuildVersionBadge />
      </header>
      <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
        <div className="flex max-w-lg flex-col items-center gap-2 text-center">
          <h1 className="text-3xl font-semibold tracking-tight">Vivindis</h1>
          <p className="text-sm text-muted-foreground">
            Google Play ve App Store yorumlarını toplayıp analiz edin. Oturum 6+ ile pano ve formlar
            genişletilecek.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href="/dashboard" className={cn(buttonVariants({ variant: "default" }))}>
            {tNav("dashboard")}
          </Link>
          <Link href="/sign-in" className={cn(buttonVariants({ variant: "outline" }))}>
            {tAuth("signIn")}
          </Link>
          <Link href="/sign-up" className={cn(buttonVariants({ variant: "ghost" }))}>
            {tAuth("signUp")}
          </Link>
        </div>
      </main>
    </div>
  );
}
