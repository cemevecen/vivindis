import { createNavigation } from "next-intl/navigation";
import { defineRouting } from "next-intl/routing";

export const locales = ["tr", "en", "de", "fr", "it", "es", "pt", "ja", "zh", "sw", "ar", "ru"] as const;

export type AppLocale = (typeof locales)[number];

/**
 * Localized first segment for the dashboard area backed by `src/app/.../apps/*`
 * (saved store apps / imports). Internal routes stay `/apps`, `/apps/[id]`, …
 */
export const RECORDS_SLUG: Record<AppLocale, string> = {
  tr: "kayitlar",
  en: "records",
  de: "eintraege",
  fr: "enregistrements",
  it: "registrazioni",
  es: "registros",
  pt: "registros",
  ja: "kiroku",
  zh: "jilu",
  sw: "rekodi",
  ar: "sijillat",
  ru: "zapisi",
};

function localizedRecords(suffix: "" | "/new" | "/[id]" | "/[id]/analysis"): Record<AppLocale, string> {
  const out = {} as Record<AppLocale, string>;
  for (const loc of locales) {
    out[loc] = `/${RECORDS_SLUG[loc]}${suffix}`;
  }
  return out;
}

/** Same visible path for every UI locale (non-localized segments). */
function pathEveryLocale(path: string): Record<AppLocale, string> {
  const out = {} as Record<AppLocale, string>;
  for (const loc of locales) {
    out[loc] = path;
  }
  return out;
}

/** Unique slugs for Clerk `createRouteMatcher` (single alternation group). */
export const RECORDS_SLUG_ALTERNATION = Array.from(new Set(Object.values(RECORDS_SLUG))).join("|");

const sharedPathnames = {
  "/": pathEveryLocale("/"),
  "/about": pathEveryLocale("/about"),
  "/analyze": pathEveryLocale("/analyze"),
  "/analyze/store": pathEveryLocale("/analyze/store"),
  "/analyze/marketplace": pathEveryLocale("/analyze/marketplace"),
  "/compare": pathEveryLocale("/compare"),
  "/sign-in": pathEveryLocale("/sign-in"),
  "/sign-up": pathEveryLocale("/sign-up"),
} as const;

export const routing = defineRouting({
  locales: [...locales],
  defaultLocale: "tr",
  localePrefix: "always",
  pathnames: {
    ...sharedPathnames,
    "/apps": localizedRecords(""),
    "/apps/new": localizedRecords("/new"),
    "/apps/[id]": localizedRecords("/[id]"),
    "/apps/[id]/analysis": localizedRecords("/[id]/analysis"),
  },
});

export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
