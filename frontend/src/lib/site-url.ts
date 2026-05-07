function stripTrailingSlash(u: string): string {
  return u.replace(/\/$/, "");
}

/**
 * Canonical origin for metadata, hreflang, sitemap and robots.
 * Set `NEXT_PUBLIC_SITE_URL` in production (e.g. https://vivindis.com).
 */
export function getSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) {
    return stripTrailingSlash(explicit);
  }
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    return `https://${stripTrailingSlash(vercel)}`;
  }
  return "https://vivindis.com";
}
