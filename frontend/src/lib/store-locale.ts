import { routing } from "@/i18n/routing";

type AppLocale = (typeof routing.locales)[number];

/**
 * Maps next-intl UI locale to Google Play / App Store RSS storefront parameters.
 * Used for store search and for review pulls when review_scope is "local".
 */
export const STORE_LOCALE_BY_UI: Record<AppLocale, { lang: string; country: string }> = {
  tr: { lang: "tr", country: "tr" },
  en: { lang: "en", country: "us" },
  de: { lang: "de", country: "de" },
  fr: { lang: "fr", country: "fr" },
  it: { lang: "it", country: "it" },
  es: { lang: "es", country: "es" },
  pt: { lang: "pt", country: "br" },
  ja: { lang: "ja", country: "jp" },
  zh: { lang: "zh", country: "cn" },
  sw: { lang: "sw", country: "ke" },
  ar: { lang: "ar", country: "sa" },
  ru: { lang: "ru", country: "ru" },
};

export function storeLocaleFromUiLocale(locale: string): { lang: string; country: string } {
  const raw = typeof locale === "string" ? locale : "tr";
  const base = raw.split("-")[0]?.toLowerCase() ?? "tr";
  const code = base.length >= 2 ? base.slice(0, 2) : "tr";
  if ((routing.locales as readonly string[]).includes(code)) {
    return STORE_LOCALE_BY_UI[code as AppLocale];
  }
  return STORE_LOCALE_BY_UI.tr;
}
