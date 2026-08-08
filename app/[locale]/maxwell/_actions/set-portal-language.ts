/**
 * app/[locale]/maxwell/_actions/set-portal-language.ts
 *
 * The client picks the language their portal speaks.
 *
 * Until 2026-08-07 the selector in Settings → General was decoration: local
 * state, no persistence, under a line that promised "We'll remember this for
 * your next visit". It remembered nothing.
 *
 * The language is now stored in TWO places, because they answer two different
 * questions:
 *
 *   the cookie   what the BROWSER should be served next time — read by
 *                next-intl when it has to choose a locale (a bare "/" visit).
 *   the session  what the PROJECT speaks — the language Maxwell replies in and
 *                the locale of the portal link we email them. Without this, a
 *                client could switch to Spanish and still get an English link
 *                in their next email, which is the same broken promise with
 *                extra steps.
 *
 * The session write only happens inside a project. The same panel also opens
 * from the signed-in home, where there is no project yet — there the cookie
 * carries it alone, and whichever project they start next picks its language up
 * from the browser as usual.
 */

"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getAuthenticatedViewer } from "@/lib/auth/session";
import { viewerOwnsStudioSession } from "@/lib/auth/ownership";
import { log } from "@/lib/server/logger";
import {
  getStudioSession,
  updateStudioSessionLanguage,
} from "@/lib/maxwell/repositories";
import {
  SESSION_LANGUAGES,
  type SessionLanguage,
} from "@/lib/maxwell/session-language";

/** next-intl's own cookie name. Changing it here silently detaches the two. */
const LOCALE_COOKIE = "NEXT_LOCALE";

/** A year: this is a stated preference, not a session detail. */
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export type SetPortalLanguageResult =
  | { ok: true; language: SessionLanguage }
  | { ok: false; error: string };

function isSupported(value: string): value is SessionLanguage {
  return (SESSION_LANGUAGES as readonly string[]).includes(value);
}

export async function setPortalLanguageAction(input: {
  language: string;
  /** Present when the panel was opened inside a project. */
  sessionId?: string;
}): Promise<SetPortalLanguageResult> {
  // Validated against the languages we can carry end to end, never trusted from
  // the client: this value ends up in a cookie, in a URL prefix and in the DB.
  if (!isSupported(input.language)) {
    return { ok: false, error: "That language isn't available." };
  }
  const language = input.language;

  const viewer = await getAuthenticatedViewer();
  if (!viewer) {
    return { ok: false, error: "Please sign in again." };
  }

  const jar = await cookies();
  jar.set(LOCALE_COOKIE, language, {
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    // Readable by next-intl on the server; nothing secret about a language.
    httpOnly: false,
  });

  if (input.sessionId) {
    const session = await getStudioSession(input.sessionId);
    // A missing or someone else's project must not stop the cookie from having
    // been set — the person still asked for a language and still gets it.
    if (session && viewerOwnsStudioSession(viewer, session)) {
      try {
        await updateStudioSessionLanguage(session.id, language);
        revalidatePath("/[locale]/maxwell/workspace/[sessionId]", "page");
      } catch (error) {
        log.warn(
          "maxwell.portal-language",
          "Could not persist the project language; the cookie still applies.",
          { session_id: session.id, error: String(error) },
        );
      }
    }
  }

  return { ok: true, language };
}
