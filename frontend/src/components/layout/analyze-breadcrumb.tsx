"use client";

import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";

import { Link, usePathname } from "@/i18n/routing";
import { parseAnalyzeHubMode } from "@/lib/analyze-hub-utils";
import { cn } from "@/lib/utils";

export function AnalyzeBreadcrumb() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tNav = useTranslations("navigation");
  const tAnalyze = useTranslations("analyzeHub");

  if (!pathname.startsWith("/analyze")) {
    return null;
  }

  const mode = parseAnalyzeHubMode(searchParams.get("mode"));

  const crumbs: { href?: string; label: string }[] = [{ href: "/", label: tNav("breadcrumbHome") }];

  if (pathname.endsWith("/analyze/store")) {
    crumbs.push({ href: "/analyze/store", label: tNav("analyze") });
    crumbs.push({ label: tAnalyze("storeSourceCatalog") });
  } else if (pathname.endsWith("/analyze/marketplace")) {
    crumbs.push({ href: "/analyze/store", label: tNav("analyze") });
    crumbs.push({ label: tAnalyze("storeSourceMarketplace") });
  } else if (pathname === "/analyze") {
    crumbs.push({ href: "/analyze/store", label: tNav("analyze") });
    if (mode === "file") {
      crumbs.push({ label: tAnalyze("tabFile") });
    } else if (mode === "text") {
      crumbs.push({ label: tAnalyze("tabText") });
    } else if (mode === "compare") {
      crumbs.push({ label: tAnalyze("tabCompare") });
    } else {
      crumbs.push({ label: tAnalyze("storeSourceCatalog") });
    }
  }

  return (
    <nav aria-label={tNav("breadcrumbNavLabel")} className="mb-4 flex min-w-0 flex-wrap items-center">
      <ol className="flex min-w-0 flex-wrap items-center gap-1 text-sm text-muted-foreground">
        {crumbs.map((c, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <li key={`${c.label}-${i}`} className="flex min-w-0 items-center gap-1">
              {i > 0 ? <ChevronRight className="size-3.5 shrink-0 opacity-60" aria-hidden /> : null}
              {c.href && !isLast ? (
                <Link
                  href={c.href}
                  className="truncate font-medium text-foreground underline-offset-4 hover:underline"
                >
                  {c.label}
                </Link>
              ) : (
                <span
                  className={cn("truncate", isLast && "font-medium text-foreground")}
                  aria-current={isLast ? "page" : undefined}
                >
                  {c.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
