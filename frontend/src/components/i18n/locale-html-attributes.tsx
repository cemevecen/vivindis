"use client";

import { useLocale } from "next-intl";
import { useEffect } from "react";

const rtlLocales = new Set(["ar"]);

/**
 * `lang` ve `dir` kök `<html>` üzerinde güncellenir (Arapça RTL, Japonca LTR).
 */
export function LocaleHtmlAttributes() {
  const locale = useLocale();
  const dir = rtlLocales.has(locale) ? "rtl" : "ltr";

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
  }, [locale, dir]);

  return null;
}
