/**
 * lib/maxwell/session-language.ts
 *
 * What language a studio session speaks — decided once, when the client sends
 * their first message, from what their browser asks for.
 *
 * `studio_session.language` is not decoration. It decides:
 *   · the language Maxwell replies in,
 *   · the wording of the one-tap reference answers,
 *   · and the locale of the client's portal link (`buildWorkspaceUrl`), which
 *     is how they reach the portal after paying — they click a link we sent,
 *     they don't type the address.
 *
 * Until 2026-08-07 nothing ever passed it, so every session in production was
 * created as English — all sixteen of them — and a Spanish client got an
 * English Maxwell and an English portal no matter what their computer said.
 * The Spanish branch of the reference labels had never once executed.
 *
 * WHY THE HEADER AND NOT THE URL: the studio page is served at /en even to a
 * Spanish visitor, because its own copy is still inline English (see
 * i18n/launch-locales.ts). So the URL locale would report "en" for everyone
 * and quietly reintroduce the same bug. `Accept-Language` reports the
 * computer, which is the thing we actually want to follow.
 */

/**
 * The languages a session may speak. Deliberately NOT the four locales the
 * routing declares: these are the two we can carry end to end — Maxwell's
 * replies, the labels, and the portal. Adding "fr" here would give a French
 * client French replies and an English portal, which is the mixed-language
 * experience we just spent the day removing. fr/de join this list the day they
 * join the portal, not before.
 */
export const SESSION_LANGUAGES = ["en", "es"] as const;

export type SessionLanguage = (typeof SESSION_LANGUAGES)[number];

export const DEFAULT_SESSION_LANGUAGE: SessionLanguage = "en";

function isSupported(tag: string): tag is SessionLanguage {
  return (SESSION_LANGUAGES as readonly string[]).includes(tag);
}

/**
 * Pick a session language from an `Accept-Language` header.
 *
 * Honours quality values, so a browser that says it prefers Spanish but will
 * accept English gets Spanish:
 *
 *   "es-ES,es;q=0.9,en;q=0.8"  -> "es"   (regional tag matches its base)
 *   "en-GB,en;q=0.9"           -> "en"
 *   "fr-FR,fr;q=0.9,en;q=0.5"  -> "en"   (French isn't carried end to end yet,
 *                                         so English — the honest fallback —
 *                                         wins on being supported at all)
 *   "ja"                       -> "en"
 *   null / "" / "*"            -> "en"
 *
 * Never throws and never returns anything outside SESSION_LANGUAGES: a garbled
 * header from a bot must not decide a paying client's language, and it must
 * certainly not break the request that creates their session.
 */
export function negotiateSessionLanguage(
  acceptLanguage: string | null | undefined,
): SessionLanguage {
  if (!acceptLanguage) return DEFAULT_SESSION_LANGUAGE;

  const ranked = acceptLanguage
    .split(",")
    .map((part) => {
      const [rawTag, ...params] = part.trim().split(";");
      const tag = rawTag.trim().toLowerCase();
      // q= is optional and may be malformed; anything unparseable is treated as
      // the default quality of 1 rather than dropped, matching how browsers
      // read a header they only half understand.
      const qParam = params
        .map((p) => p.trim().toLowerCase())
        .find((p) => p.startsWith("q="));
      const parsedQ = qParam ? Number.parseFloat(qParam.slice(2)) : Number.NaN;
      const quality = Number.isFinite(parsedQ) ? parsedQ : 1;
      return { tag, quality };
    })
    // q=0 means "explicitly not this one".
    .filter((entry) => entry.tag.length > 0 && entry.quality > 0)
    // Stable sort: equal qualities keep the order the browser listed them in,
    // which is itself a preference.
    .sort((a, b) => b.quality - a.quality);

  for (const { tag } of ranked) {
    // "es-419" and "es-ES" are both Spanish for our purposes — we have one
    // Spanish, not a regional set.
    const base = tag.split("-")[0];
    if (isSupported(base)) return base;
  }

  return DEFAULT_SESSION_LANGUAGE;
}
