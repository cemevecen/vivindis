"use client";

import { UserButton } from "@clerk/nextjs";
import { useLocale } from "next-intl";

import { BuildVersionBadge } from "@/components/layout/build-version-badge";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { MobileNavButton } from "@/components/layout/mobile-nav-button";

const clerkEnabled =
  typeof process !== "undefined" &&
  Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim());

export function DashboardHeader() {
  const locale = useLocale();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-background/95 px-3 sm:px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <MobileNavButton />
        <BuildVersionBadge className="hidden min-w-0 truncate sm:inline" />
      </div>
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
