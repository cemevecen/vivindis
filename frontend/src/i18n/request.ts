import { getRequestConfig } from "next-intl/server";
import type { AbstractIntlMessages } from "use-intl";

import { deepMergeMessages } from "./deep-merge-messages";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !routing.locales.includes(locale as (typeof routing.locales)[number])) {
    locale = routing.defaultLocale;
  }

  const en = (await import("../messages/en.json")).default as unknown as Record<string, unknown>;

  if (locale === "en") {
    return {
      locale,
      messages: en as AbstractIntlMessages,
    };
  }

  const localeMessages = (await import(`../messages/${locale}.json`)).default as unknown as Record<
    string,
    unknown
  >;
  const messages = deepMergeMessages(en, localeMessages) as AbstractIntlMessages;

  return {
    locale,
    messages,
  };
});
