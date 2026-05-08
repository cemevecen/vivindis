import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { LocaleHtmlAttributes } from "@/components/i18n/locale-html-attributes";
import { routing } from "@/i18n/routing";
import { pathRestAfterLocale } from "@/lib/i18n-seo-path";
import { getSiteUrl } from "@/lib/site-url";

type Props = {
  children: React.ReactNode;
  params: { locale: string };
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = params;
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    return {};
  }

  const h = headers();
  const pathname = h.get("x-vivindis-pathname") ?? `/${locale}`;
  const rest = pathRestAfterLocale(pathname, locale);
  const siteUrl = getSiteUrl();
  const pathSuffix = rest || "";

  const languages: Record<string, string> = {
    "x-default": `${siteUrl}/${routing.defaultLocale}${pathSuffix}`,
  };
  for (const loc of routing.locales) {
    languages[loc] = `${siteUrl}/${loc}${pathSuffix}`;
  }

  const tMeta = await getTranslations({ locale, namespace: "meta" });

  return {
    description: tMeta("siteDescription"),
    alternates: {
      canonical: `${siteUrl}/${locale}${pathSuffix}`,
      languages,
    },
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = params;
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <NextIntlClientProvider locale={locale} messages={messages} key={locale}>
      <LocaleHtmlAttributes />
      {children}
    </NextIntlClientProvider>
  );
}
