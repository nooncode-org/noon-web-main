import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);
const disabledLaunchLocales = new Set(["es", "fr", "de"]);

// Routes that should NOT be locale-prefixed
const bypassPatterns = [
  /^\/api(\/.*)?$/,
  /^\/_next(\/.*)?$/,
  /^\/favicon\.ico$/,
  /^\/logo.*$/,
  /^\/.*\.(png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|eot)$/,
];

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (bypassPatterns.some((pattern) => pattern.test(pathname))) {
    return NextResponse.next();
  }

  const localeSegment = pathname.split("/")[1];
  if (disabledLaunchLocales.has(localeSegment)) {
    const url = request.nextUrl.clone();
    const rest = pathname.slice(localeSegment.length + 1);
    url.pathname = `/en${rest || ""}`;
    return NextResponse.redirect(url);
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
