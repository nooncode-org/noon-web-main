"use server";

import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
import { normalizeInternalRedirect } from "@/lib/auth/redirect";

export async function signInWithGoogleAction(formData: FormData) {
  const redirectTo = normalizeInternalRedirect(
    formData.get("redirectTo")?.toString(),
    "/maxwell",
  );

  try {
    await signIn("google", { redirectTo });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(
        `/signin?redirectTo=${encodeURIComponent(redirectTo)}&error=${encodeURIComponent(
          "Could not start Google sign-in. Please try again.",
        )}`,
      );
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
