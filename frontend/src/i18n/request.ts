import { getRequestConfig } from "next-intl/server";
import type { AbstractIntlMessages } from "use-intl";

import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !routing.locales.includes(locale as (typeof routing.locales)[number])) {
    locale = routing.defaultLocale;
  }

  const messages = (await import(`../messages/${locale}.json`)).default as AbstractIntlMessages;

  return {
    locale,
    messages,
  };
});
