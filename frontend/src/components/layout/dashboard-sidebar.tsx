"use client";

import { GitCompare, LayoutDashboard, Smartphone } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/routing";
import { cn } from "@/lib/utils";

type SidebarProps = {
  onNavigate?: () => void;
};

export function DashboardSidebar({ onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const t = useTranslations("navigation");

  const links = [
    { href: "/dashboard" as const, label: t("dashboard"), Icon: LayoutDashboard },
    { href: "/apps" as const, label: t("apps"), Icon: Smartphone },
    { href: "/compare" as const, label: t("compare"), Icon: GitCompare },
  ];

  return (
    <div
      role="navigation"
      aria-label={t("sidebarNav")}
      className="flex h-full min-h-0 w-full flex-col border-r border-border bg-muted/30"
    >
      <div className="flex h-14 shrink-0 items-center border-b border-border px-4">
        <Link href="/" className="text-lg font-semibold tracking-tight" onClick={() => onNavigate?.()}>
          Vivindis
        </Link>
      </div>
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        {links.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              onClick={() => onNavigate?.()}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
