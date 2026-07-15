"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { z } from "zod";
import { signIn, signOut } from "@/auth";
import { normalizeInternalRedirect } from "@/lib/auth/redirect";
import { resolveClientIdentity } from "@/lib/server/rate-limit";
import { consumeDistributedToken } from "@/lib/server/rate-limit-distributed";

export async function signInWithGoogleAction(formData: FormData) {
  const redirectTo = normalizeInternalRedirect(
    formData.get("redirectTo")?.toString(),
    "/maxwell",
  );

  try {
    await signIn("google", { redirectTo });
  } catch (error) {
    if (error instanceof AuthError) {
      // Pass a CODE, not prose — signin/page.tsx maps it to copy (and avoids
      // reflecting arbitrary text from the query string).
      redirect(
        `/signin?redirectTo=${encodeURIComponent(redirectTo)}&error=GoogleSignInFailed`,
      );
    }
    throw error;
  }
}

// ── Email magic-link ─────────────────────────────────────────────────────────

const emailSchema = z.string().trim().toLowerCase().email();

const THROTTLE_MESSAGE =
  "Too many sign-in emails requested. Please wait a few minutes and try again.";

export type EmailSignInState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | { status: "error"; message: string };

/**
 * `useActionState` server action for the email (magic-link) form. Validates +
 * normalizes the address, throttles per-IP (the per-email throttle lives in the
 * signIn policy, which also covers direct endpoint POSTs), then asks Auth.js to
 * send the link. Enumeration-safe: there is no account-existence concept, so
 * every valid address gets the same "check your inbox" outcome.
 */
export async function signInWithEmailAction(
  _prev: EmailSignInState,
  formData: FormData,
): Promise<EmailSignInState> {
  const parsed = emailSchema.safeParse(formData.get("email")?.toString() ?? "");
  if (!parsed.success) {
    return { status: "error", message: "Enter a valid email address." };
  }
  const email = parsed.data;
  const redirectTo = normalizeInternalRedirect(
    formData.get("redirectTo")?.toString(),
    "/maxwell",
  );

  const requestHeaders = await headers();
  const ip = resolveClientIdentity(
    new Request("http://internal", { headers: requestHeaders }),
  );
  const ipVerdict = await consumeDistributedToken({
    namespace: "auth.magiclink.ip",
    identityKey: ip,
    limit: 10,
    windowSeconds: 60 * 60,
  });
  if (!ipVerdict.ok) {
    return { status: "error", message: THROTTLE_MESSAGE };
  }

  try {
    // redirect:false → raw mode: returns the URL on success, throws on failure.
    await signIn("resend", { email, redirectTo, redirect: false });
    return { status: "sent", email };
  } catch (error) {
    if (error instanceof AuthError) {
      // Per-email throttle in the signIn policy surfaces as AccessDenied.
      if (error.type === "AccessDenied") {
        return { status: "error", message: THROTTLE_MESSAGE };
      }
      return { status: "error", message: "Couldn't send the sign-in link. Please try again." };
    }
    throw error;
  }
}

export async function signOutAction(formData: FormData) {
  const redirectTo = normalizeInternalRedirect(
    formData.get("redirectTo")?.toString(),
    "/signin",
  );

  await signOut({ redirectTo });
}
