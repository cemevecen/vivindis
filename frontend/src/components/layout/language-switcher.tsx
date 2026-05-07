"use client";

import { useLocale, useTranslations } from "next-intl";

import { usePathname, useRouter, routing } from "@/i18n/routing";

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

export function LanguageSwitcher({ selectClassName }: LanguageSwitcherProps) {
  const locale = useLocale() as (typeof routing.locales)[number];
  const pathname = usePathname();
  const router = useRouter();
  const tCommon = useTranslations("common");

  return (
    <label className="flex items-center gap-2 text-sm text-muted-foreground">
      <span className="sr-only">{tCommon("languageLabel")}</span>
      <select
        className={
          selectClassName ??
          "rounded-md border border-input bg-background px-2 py-1.5 text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        }
        value={locale}
        onChange={(e) => {
          const next = e.target.value as (typeof routing.locales)[number];
          router.replace(pathname, { locale: next });
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
