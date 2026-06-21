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
  /^\/logo.*$/,
  // html → static showcase files in /public (e.g. /work/mockups/*.html) served
  // as-is inside same-origin iframes; never locale-prefixed.
  /^\/.*\.(png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|eot|html)$/,
];

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
