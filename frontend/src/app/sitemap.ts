import type { MetadataRoute } from "next";

import { routing } from "@/i18n/routing";
import { getSiteUrl } from "@/lib/site-url";

/** Public shells suitable for hreflang/sitemap (no auth wall for anonymous GET). */
const PUBLIC_PATH_SEGMENTS = ["", "about", "analyze"] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();
  const entries: MetadataRoute.Sitemap = [];

  for (const locale of routing.locales) {
    for (const segment of PUBLIC_PATH_SEGMENTS) {
      const path = segment ? `/${locale}/${segment}` : `/${locale}`;
      entries.push({
        url: `${base}${path}`,
        lastModified: new Date(),
        changeFrequency: segment === "" ? "weekly" : "weekly",
        priority: segment === "" ? 1 : 0.8,
      });
    }
  }

  return entries;
}
