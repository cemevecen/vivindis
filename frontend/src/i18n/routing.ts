import { defineRouting } from "next-intl/routing";
import { createNavigation } from "next-intl/navigation";

export const routing = defineRouting({
  locales: ["tr", "en", "de", "fr", "it", "es", "pt", "ja", "zh", "sw", "ar", "ru"],
  defaultLocale: "tr",
  localePrefix: "always",
});

export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
