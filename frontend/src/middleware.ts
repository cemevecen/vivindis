import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { RECORDS_SLUG, RECORDS_SLUG_ALTERNATION, routing, type AppLocale } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

function attachVivindisSeoHeaders(req: NextRequest, res: NextResponse): NextResponse {
  const pathname = req.nextUrl.pathname;
  const first = pathname.split("/").filter(Boolean)[0];
  if (first && routing.locales.includes(first as AppLocale)) {
    res.headers.set("x-vivindis-locale", first);
    res.headers.set("x-vivindis-pathname", pathname);
  }
  return res;
}

function intlWithSeo(req: NextRequest): NextResponse {
  return attachVivindisSeoHeaders(req, intlMiddleware(req));
}

/** Permanent redirect from legacy `/:locale/apps/...` to localized records paths. */
function maybeRedirectLegacyApps(req: NextRequest): NextResponse | null {
  const segments = req.nextUrl.pathname.split("/").filter(Boolean);
  if (segments.length < 2) {
    return null;
  }
  const locale = segments[0] as AppLocale;
  if (!routing.locales.includes(locale)) {
    return null;
  }
  if (segments[1] !== "apps") {
    return null;
  }
  const slug = RECORDS_SLUG[locale];
  const tail = segments.slice(2).join("/");
  const newPathname = `/${locale}/${slug}${tail ? `/${tail}` : ""}`;
  if (newPathname === req.nextUrl.pathname) {
    return null;
  }
  const url = req.nextUrl.clone();
  url.pathname = newPathname;
  return NextResponse.redirect(url, 308);
}

const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() ?? "";

const isProtectedRoute = createRouteMatcher([
  `/:locale/:records(${RECORDS_SLUG_ALTERNATION})(.*)`,
  "/:locale/apps(.*)",
  "/:locale/compare(.*)",
]);

const isPublicAuthRoute = createRouteMatcher([
  "/:locale/sign-in(.*)",
  "/:locale/sign-up(.*)",
]);

function runIntlChain(req: NextRequest): NextResponse {
  const legacy = maybeRedirectLegacyApps(req);
  if (legacy) {
    return legacy;
  }
  return intlWithSeo(req);
}

export default clerkPublishableKey
  ? clerkMiddleware(async (auth, req) => {
      if (isPublicAuthRoute(req)) {
        return intlWithSeo(req);
      }
      const legacy = maybeRedirectLegacyApps(req);
      if (legacy) {
        return legacy;
      }
      if (isProtectedRoute(req)) {
        await auth().protect();
      }
      return intlWithSeo(req);
    })
  : (req: NextRequest) => runIntlChain(req);

export const config = {
  matcher: ["/", "/((?!api|_next|_next/static|_next/image|_vercel|.*\\..*).*)"],
};
