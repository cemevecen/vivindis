import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

function attachVivindisSeoHeaders(req: NextRequest, res: NextResponse): NextResponse {
  const pathname = req.nextUrl.pathname;
  const first = pathname.split("/").filter(Boolean)[0];
  if (first && routing.locales.includes(first as (typeof routing.locales)[number])) {
    res.headers.set("x-vivindis-locale", first);
    res.headers.set("x-vivindis-pathname", pathname);
  }
  return res;
}

function intlWithSeo(req: NextRequest): NextResponse {
  return attachVivindisSeoHeaders(req, intlMiddleware(req));
}

const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() ?? "";

const isProtectedRoute = createRouteMatcher([
  "/:locale/apps(.*)",
  "/:locale/compare(.*)",
]);

const isPublicAuthRoute = createRouteMatcher([
  "/:locale/sign-in(.*)",
  "/:locale/sign-up(.*)",
]);

export default clerkPublishableKey
  ? clerkMiddleware(async (auth, req) => {
      if (isPublicAuthRoute(req)) {
        return intlWithSeo(req);
      }
      if (isProtectedRoute(req)) {
        await auth().protect();
      }
      return intlWithSeo(req);
    })
  : intlWithSeo;

export const config = {
  matcher: ["/", "/((?!api|_next|_next/static|_next/image|_vercel|.*\\..*).*)"],
};
