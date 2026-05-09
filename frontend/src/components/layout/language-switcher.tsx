"use client";

import { useLocale, useTranslations } from "next-intl";
import { Suspense } from "react";
import type { ComponentProps } from "react";
import { useParams, useSearchParams } from "next/navigation";

import { Link, usePathname, useRouter, routing } from "@/i18n/routing";

const localeLabels: Record<(typeof routing.locales)[number], string> = {
  tr: "Türkçe",
  en: "English",
  de: "Deutsch",
  fr: "Français",
  it: "Italiano",
  es: "Español",
  pt: "Português",
  ja: "日本語",
  zh: "中文",
  sw: "Kiswahili",
  ar: "العربية",
  ru: "Русский",
};

type LanguageSwitcherProps = {
  /** Özel yüzeylerde kontrast için (ör. koyu arka plan) */
  selectClassName?: string;
};

function urlSearchParamsToQuery(
  sp: URLSearchParams,
): Record<string, string | string[]> | undefined {
  if (sp.size === 0) {
    return undefined;
  }
  const out: Record<string, string | string[]> = {};
  for (const key of Array.from(sp.keys())) {
    const all = sp.getAll(key);
    out[key] = all.length === 1 ? all[0]! : all;
  }
  return out;
}

function LanguageSwitcherImpl({ selectClassName }: LanguageSwitcherProps) {
  const pathname = usePathname();
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const tCommon = useTranslations("common");
  const currentLocale = (params.locale as string | undefined) ?? locale;

  return (
    <label className="flex items-center gap-2 text-sm text-muted-foreground">
      <span className="sr-only">{tCommon("languageLabel")}</span>
      <select
        className={
          selectClassName ??
          "rounded-md border border-input bg-background px-2 py-1.5 text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        }
        value={currentLocale}
        onChange={(e) => {
          const next = e.target.value as (typeof routing.locales)[number];
          if (!routing.locales.includes(next)) {
            return;
          }
          const query = urlSearchParamsToQuery(searchParams);
          const routeParams: Record<string, string> = {};
          for (const [key, value] of Object.entries(params)) {
            if (key === "locale" || value === undefined) {
              continue;
            }
            routeParams[key] = Array.isArray(value) ? String(value[0]) : String(value);
          }
          type AppHref = NonNullable<ComponentProps<typeof Link>["href"]>;
          const href = (
            pathname.includes("[")
              ? { pathname, params: routeParams, ...(query ? { query } : {}) }
              : query
                ? { pathname, query }
                : pathname
          ) as AppHref;
          router.replace(
            // next-intl `Link` href widens `UrlObject.query` vs `router.replace` input; values are built from URLSearchParams only.
            href as Parameters<ReturnType<typeof useRouter>["replace"]>[0],
            { locale: next },
          );
        }}
      >
        {routing.locales.map((loc) => (
          <option key={loc} value={loc}>
            {localeLabels[loc]}
          </option>
        ))}
      </select>
    </label>
  );
}

export function LanguageSwitcher(props: LanguageSwitcherProps) {
  return (
    <Suspense
      fallback={
        <div
          className={
            props.selectClassName ??
            "h-9 w-full min-w-[6.75rem] max-w-[8.5rem] shrink-0 rounded-md border border-input bg-muted/40"
          }
          aria-hidden
        />
      }
    >
      <LanguageSwitcherImpl {...props} />
    </Suspense>
  );
}
