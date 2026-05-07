"use client";

import { Suspense, type ReactNode } from "react";

import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { FileText, GitCompare, Search, Smartphone, Store, Upload } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";

import { BrandHomeLink } from "@/components/layout/brand-home-link";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Link, usePathname } from "@/i18n/routing";
import { parseAnalyzeHubMode, type AnalyzeHubMode } from "@/lib/analyze-hub-utils";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const clerkEnabled =
  typeof process !== "undefined" &&
  Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim());

const analyzeSourceTabs: { id: AnalyzeHubMode; labelKey: "tabStore" | "tabFile" | "tabText" | "tabCompare"; Icon: typeof Store }[] = [
  { id: "store", labelKey: "tabStore", Icon: Store },
  { id: "file", labelKey: "tabFile", Icon: Upload },
  { id: "text", labelKey: "tabText", Icon: FileText },
  { id: "compare", labelKey: "tabCompare", Icon: GitCompare },
];

function DashboardHeaderFallback(): ReactNode {
  return (
    <header className="sticky top-0 z-30 min-h-16 shrink-0 border-b border-border bg-neutral-100/95 backdrop-blur dark:bg-zinc-900/95" />
  );
}

function DashboardHeaderContent() {
  const locale = useLocale();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("navigation");
  const tAuth = useTranslations("auth");
  const tAnalyze = useTranslations("analyzeHub");

  const analyzeMode = parseAnalyzeHubMode(searchParams.get("mode"));
  const isAnalyzePage = pathname === "/analyze";

  const links = [
    { href: "/analyze" as const, label: t("analyze"), Icon: Search },
    { href: "/apps" as const, label: t("apps"), Icon: Smartphone },
  ];

  return (
    <header className="sticky top-0 z-30 shrink-0 border-b border-border bg-neutral-100/95 backdrop-blur supports-[backdrop-filter]:bg-neutral-100/80 dark:bg-zinc-900/95 dark:supports-[backdrop-filter]:bg-zinc-900/80">
      <div className="flex min-h-16 flex-wrap items-center justify-between gap-x-4 gap-y-3 px-3 py-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <BrandHomeLink wordmarkClassName="text-lg" iconSize="md" />
        </div>

        <nav
          aria-label={t("sidebarNav")}
          className="order-last -mx-3 flex w-[calc(100%+1.5rem)] gap-1 overflow-x-auto px-3 sm:order-none sm:mx-0 sm:w-auto sm:flex-1 sm:justify-center sm:px-0"
        >
          {links.map(({ href, label, Icon }) => {
            const active =
              pathname === href ||
              pathname.startsWith(`${href}/`) ||
              (href === "/analyze" && pathname === "/compare");
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <LanguageSwitcher />
          {clerkEnabled ? (
            <>
              <SignedIn>
                <UserButton afterSignOutUrl={`/${locale}`} />
              </SignedIn>
              <SignedOut>
                <Link
                  href="/sign-in"
                  className={cn(buttonVariants({ size: "sm" }), "shrink-0")}
                >
                  {tAuth("signIn")}
                </Link>
              </SignedOut>
            </>
          ) : null}
        </div>
      </div>

      {isAnalyzePage ? (
        <nav
          aria-label={tAnalyze("tablistLabel")}
          className="-mx-0 flex gap-1 overflow-x-auto border-t border-border px-3 py-2 sm:justify-center sm:px-4"
        >
          {analyzeSourceTabs.map(({ id, labelKey, Icon }) => {
            const active = analyzeMode === id;
            return (
              <Link
                key={id}
                href={`/analyze?mode=${id}`}
                className={cn(
                  "inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                {tAnalyze(labelKey)}
              </Link>
            );
          })}
        </nav>
      ) : null}
    </header>
  );
}

export function DashboardHeader() {
  return (
    <Suspense fallback={<DashboardHeaderFallback />}>
      <DashboardHeaderContent />
    </Suspense>
  );
}
