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

/** Locales declared in routing but NOT launched yet — redirected to /en
 * unconditionally. Their message files lag behind and nobody on the team can
 * vouch for their quality. */
export const DISABLED_LAUNCH_LOCALES: ReadonlySet<string> = new Set([
  "fr",
  "de",
]);

/**
 * Locales that ship on SOME routes but not others — redirected to /en
 * everywhere except `TRANSLATED_PATH_PREFIXES`.
 *
 * 2026-07-19 (owner): `es` RE-OPENED so browser-language detection routes
 * Spanish visitors to /es. The intent was right; the reach was not. An audit on
 * 2026-08-07 found that only SEVEN files under `app/[locale]` read from the
 * message files at all — the -rd redesign rebuilt every marketing page with its
 * copy written inline, so `/es/about`, `/es/services`, `/es/contact`, the
 * templates index and the studio all answered in English under a URL that
 * promised Spanish. Keys were never the gap (es.json is 372/373); the pages
 * simply stopped asking.
 *
 * Gating the locale outright was the obvious fix and the wrong one: it would
 * also have silenced the two surfaces that DO answer in real Spanish — and they
 * are the ones a paying client actually lives in. So the gate is per-path.
 */
export const PARTIAL_LAUNCH_LOCALES: ReadonlySet<string> = new Set(["es"]);

/**
 * Path prefixes (locale segment already stripped) that a partial locale keeps.
 *
 * The bar for entry is deliberately high — a page qualifies only when EVERY
 * word it renders is translated:
 *
 *   /maxwell/workspace/  the client portal. Fully translated 2026-08-07 (56
 *                        keys, dates included), and it renders the tool alone —
 *                        no marketing nav, no footer, nothing English around it.
 *   /maxwell/prototipo/  the prototype the client reviews. 68 keys, and likewise
 *                        no marketing chrome.
 *   /maxwell/proposal/   the proposal and its payment step. Joined 2026-08-08,
 *                        once its last inline sentence moved to the message
 *                        files. This is where a client enters card details, so
 *                        it is the last page that should be asking them to
 *                        read a second language.
 *
 * `/templates/[slug]` is translated too and still does NOT qualify: it mounts
 * `<SiteNav>` and `<SiteFooterRd>`, both hardcoded English. Spanish copy inside
 * an English frame reads worse than honest English, so it stays gated until the
 * shared chrome is translated.
 *
 * Trailing slashes are load-bearing: they stop `/maxwell/workspaces-old` from
 * matching `/maxwell/workspace`.
 */
export const TRANSLATED_PATH_PREFIXES: readonly string[] = [
  "/maxwell/workspace/",
  "/maxwell/prototipo/",
  "/maxwell/proposal/",
];

/**
 * If `pathname` sits under a locale that can't serve it, return the `/en`
 * pathname to redirect to (the rest of the path preserved); otherwise `null`.
 *
 * Pure on the pathname only — the caller copies query/hash from the original URL
 * (e.g. via `NextRequest.nextUrl.clone()`), so `/es/x?q=1` keeps `?q=1`.
 *
 *   "/de"                        -> "/en"     (disabled locale, every path)
 *   "/fr/maxwell/workspace/abc"  -> "/en/..."  (disabled beats translated)
 *   "/es/about"                  -> "/en/about"  (partial locale, English page)
 *   "/es/maxwell"                -> "/en/maxwell" (the studio is English too)
 *   "/es/maxwell/workspace/abc"  -> null  (translated — Spanish is served)
 *   "/es/maxwell/prototipo/xyz"  -> null  (translated)
 *   "/en/about"                  -> null  (already English)
 *   "/about"                     -> null  (locale-less; handled by next-intl)
 *   "/espanol"                   -> null  (exact-segment match, not a prefix)
 */
export function resolveDisabledLocaleRedirect(pathname: string): string | null {
  const localeSegment = pathname.split("/")[1];
  const isDisabled = DISABLED_LAUNCH_LOCALES.has(localeSegment);
  const isPartial = PARTIAL_LAUNCH_LOCALES.has(localeSegment);
  if (!isDisabled && !isPartial) {
    return null;
  }

  // "" for "/es", "/" for "/es/", "/about" for "/es/about".
  const rest = pathname.slice(localeSegment.length + 1);

  // A partial locale keeps the routes it can actually answer in full. A fully
  // disabled locale keeps nothing — its message file can't be vouched for, so
  // "translated" would be a claim we can't back.
  if (
    isPartial &&
    TRANSLATED_PATH_PREFIXES.some((prefix) => rest.startsWith(prefix))
  ) {
    return null;
  }

  return `/en${rest || ""}`;
}
