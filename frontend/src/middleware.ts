import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import createMiddleware from "next-intl/middleware";

import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

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
        return intlMiddleware(req);
      }
      if (isProtectedRoute(req)) {
        await auth().protect();
      }
      return intlMiddleware(req);
    })
  : intlMiddleware;

export const config = {
  matcher: ["/", "/((?!api|_next|_next/static|_next/image|_vercel|.*\\..*).*)"],
};
