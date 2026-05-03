"use client";

import { UserButton } from "@clerk/nextjs";
import { useLocale } from "next-intl";

import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { MobileNavButton } from "@/components/layout/mobile-nav-button";

const clerkEnabled =
  typeof process !== "undefined" &&
  Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim());

export function DashboardHeader() {
  const locale = useLocale();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-background/95 px-3 sm:px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <MobileNavButton />
      <div className="flex flex-1 items-center justify-end gap-3 sm:gap-4">
        <LanguageSwitcher />
        {clerkEnabled ? (
          <UserButton afterSignOutUrl={`/${locale}`} />
        ) : null}
      </div>
    </header>
  );
}
