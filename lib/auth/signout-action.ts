/**
 * lib/auth/signout-action.ts
 *
 * Server Action wrapper around NextAuth v5's `signOut`. Used by the user-menu
 * surfaces (`components/ui/user-menu.tsx`) in both the public Navigation and
 * the StudioHeader. NextAuth handles cookie removal + JWT invalidation; this
 * thin wrapper exists only so a client form can call `action={signOutAction}`
 * without importing the full `auth.ts` module from a client context.
 *
 * Redirect target: the site root for the current locale is not known at this
 * layer (the action runs server-side without route params); NextAuth defaults
 * to the configured `pages.signIn` (`/signin`) on session-less redirects. To
 * land the user on the landing page instead, we pass `redirectTo: "/"` which
 * the locale-aware middleware will then rewrite to the correct locale prefix
 * (i18n is handled at the middleware level, not here).
 */

"use server";

import { signOut } from "@/auth";

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/" });
}
