/**
 * Path after the locale prefix, e.g. `/de/analyze` + locale `de` → `/analyze`.
 * Used for canonical and hreflang URL construction.
 */
export function pathRestAfterLocale(pathname: string, locale: string): string {
  const prefix = `/${locale}`;
  if (pathname === prefix || pathname === `${prefix}/`) {
    return "";
  }
  if (pathname.startsWith(`${prefix}/`)) {
    return pathname.slice(prefix.length);
  }
  return "";
}
