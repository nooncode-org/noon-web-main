import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth, getDevBypassEmail } from "@/auth";
import { StudioShell } from "@/components/maxwell/studio-shell";
import { buildSignInHref } from "@/lib/auth/redirect";
import { isPrototipoDecisionRouteEnabled } from "@/lib/maxwell/prototipo-route-flag";

export const metadata: Metadata = {
  title: "Maxwell Studio — Noon",
  description: "Build your software idea with Maxwell.",
  robots: { index: false, follow: false },
};

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ prompt?: string; session_id?: string }>;
};

export default async function MaxwellStudioPage({ params, searchParams }: Props) {
  const [{ locale }, { prompt = "", session_id }] = await Promise.all([
    params,
    searchParams,
  ]);
  const trimmedPrompt = prompt.trim();
  const studioPath = `/${locale}/studio`;

  const session = await auth();
  // Dev bypass: use DEV_VIEWER_EMAIL from .env.local when Google auth is not
  // configured. getDevBypassEmail() always returns null in production.
  const viewerEmail = session?.user?.email ?? getDevBypassEmail();

  if (!viewerEmail) {
    // Signed-out visitor. A param-less visit has no conversation to restore
    // and no callback worth preserving, so send them home. With a prompt or a
    // session_id, route through sign-in and return to that same target.
    if (!trimmedPrompt && !session_id) {
      redirect(`/${locale}`);
    }
    const redirectTo = session_id
      ? `${studioPath}?session_id=${encodeURIComponent(session_id)}`
      : `${studioPath}?prompt=${encodeURIComponent(trimmedPrompt)}`;
    redirect(buildSignInHref(redirectTo));
  }

  // Signed in. A param-less visit is the "My chats" hub: StudioShell starts in
  // intake and loads the saved-conversation list (StudioHeader "Your chats").
  // A prompt or session_id drives a specific conversation instead.

  return (
    <StudioShell
      initialPrompt={trimmedPrompt}
      initialSessionId={session_id}
      viewerEmail={viewerEmail}
      locale={locale}
      shareEnabled={isPrototipoDecisionRouteEnabled()}
    />
  );
}
