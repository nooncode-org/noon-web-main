/**
 * i18n/launch-locales.ts
 *
 * §7.1 / spec §32 — launch-gating of declared-but-not-yet-shipped locales.
 *
 * `i18n/routing.ts` declares four locales (en/es/fr/de) so the routes and copy
 * scaffolding exist, but the site ships ENGLISH-ONLY at launch. The middleware
 * (`proxy.ts`) redirects any URL under a disabled locale to its `/en` equivalent
 * so a visitor never lands on a half-built localized page (and search engines
 * don't index one).
 *
 * The decision is a pure string function so it can be unit-tested without the
 * Next/next-intl middleware machinery (the live routing path otherwise has no
 * coverage; a silent change to this set would expose broken locales).
 */

/** Locales declared in routing but NOT launched yet — redirected to /en.
 * 2026-07-19 (owner): `es` RE-OPENED — browser-language auto-detection routes
 * Spanish visitors to /es again (es.json is 1:1 with en.json in keys; the
 * remaining gap is copy hardcoded in components, tracked as the translation
 * pass). fr/de stay gated: their message files lag behind and nobody on the
 * team can vouch for their quality. */
export const DISABLED_LAUNCH_LOCALES: ReadonlySet<string> = new Set([
  "fr",
  "de",
]);

/**
 * If `pathname`'s first segment is a disabled launch locale, return the `/en`
 * pathname to redirect to (the rest of the path preserved); otherwise `null`.
 *
 * Pure on the pathname only — the caller copies query/hash from the original URL
 * (e.g. via `NextRequest.nextUrl.clone()`), so `/es/x?q=1` keeps `?q=1`.
 *
 *   "/es/about"                 -> "/en/about"
 *   "/fr/maxwell/workspace/abc" -> "/en/maxwell/workspace/abc"
 *   "/de"                       -> "/en"
 *   "/en/about"                 -> null  (already English)
 *   "/about"                    -> null  (locale-less; handled by next-intl)
 *   "/espanol"                  -> null  (exact-segment match, not a prefix)
 */
export function resolveDisabledLocaleRedirect(pathname: string): string | null {
  const localeSegment = pathname.split("/")[1];
  if (!DISABLED_LAUNCH_LOCALES.has(localeSegment)) {
    return null;
  }
  const rest = pathname.slice(localeSegment.length + 1);
  return `/en${rest || ""}`;
}
