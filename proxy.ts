import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";
import { resolveDisabledLocaleRedirect } from "./i18n/launch-locales";

const intlMiddleware = createMiddleware(routing);

// Routes that should NOT be locale-prefixed
const bypassPatterns = [
  /^\/api(\/.*)?$/,
  /^\/_next(\/.*)?$/,
  /^\/favicon\.ico$/,
  /^\/robots\.txt$/,
  /^\/sitemap\.xml$/,
  /^\/manifest\.webmanifest$/,
  /^\/logo.*$/,
  // html → static showcase files in /public (e.g. /work/mockups/*.html) served
  // as-is inside same-origin iframes; never locale-prefixed.
  /^\/.*\.(png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|eot|html)$/,
];

/**
 * The dev-only design playground (`/maxwell/wspreview`). The page itself calls
 * notFound() outside `next dev`, which blocks the mock from ever rendering —
 * but that path still answers 200 with the not-found body (the shell streams
 * before the status can change). Blocking it here makes it a true 404, and
 * keeps working even if the page-level guard is ever edited away.
 */
const DEV_ONLY_PATHS = /^\/(?:[a-z]{2}\/)?maxwell\/wspreview(?:\/.*)?$/;

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (process.env.NODE_ENV !== "development" && DEV_ONLY_PATHS.test(pathname)) {
    return new NextResponse(null, { status: 404 });
  }

  if (bypassPatterns.some((pattern) => pattern.test(pathname))) {
    return NextResponse.next();
  }

  // §7.1 / spec §32 — locales declared but not launched (es/fr/de) redirect to
  // their /en equivalent so a visitor never lands on a half-built localized page.
  const localeRedirect = resolveDisabledLocaleRedirect(pathname);
  if (localeRedirect) {
    const url = request.nextUrl.clone();
    url.pathname = localeRedirect; // query/hash preserved by clone()
    return NextResponse.redirect(url);
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
