"use client";

import { UserButton } from "@clerk/nextjs";
import { GitCompare, Info, LayoutDashboard, Search, Smartphone } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { BuildVersionBadge } from "@/components/layout/build-version-badge";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { Link, usePathname } from "@/i18n/routing";
import { cn } from "@/lib/utils";

const clerkEnabled =
  typeof process !== "undefined" &&
  Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim());

export function DashboardHeader() {
  const locale = useLocale();
  const pathname = usePathname();
  const t = useTranslations("navigation");

  const links = [
    { href: "/dashboard" as const, label: t("dashboard"), Icon: LayoutDashboard },
    { href: "/analyze" as const, label: t("analyze"), Icon: Search },
    { href: "/apps" as const, label: t("apps"), Icon: Smartphone },
    { href: "/compare" as const, label: t("compare"), Icon: GitCompare },
    { href: "/about" as const, label: t("about"), Icon: Info },
  ];

  return (
    <header className="sticky top-0 z-30 flex min-h-16 shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-4">
      <div className="flex min-w-0 items-center gap-3">
        <Link href="/" className="shrink-0 text-lg font-semibold tracking-tight">
          Vivindis
        </Link>
        <BuildVersionBadge className="hidden min-w-0 truncate sm:inline" />
      </div>

      <nav
        aria-label={t("sidebarNav")}
        className="order-last -mx-3 flex w-[calc(100%+1.5rem)] gap-1 overflow-x-auto px-3 sm:order-none sm:mx-0 sm:w-auto sm:flex-1 sm:justify-center sm:px-0"
      >
        {links.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
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

      <div className="flex shrink-0 items-center gap-3 sm:gap-4">
        <BuildVersionBadge className="shrink-0 sm:hidden" />
        <LanguageSwitcher />
        {clerkEnabled ? (
          <UserButton afterSignOutUrl={`/${locale}`} />
        ) : null}
      </div>
    </header>
  );
}
