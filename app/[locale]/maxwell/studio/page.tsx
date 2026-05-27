import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
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
  const studioPath = `/${locale}/maxwell/studio`;

  if (!trimmedPrompt && !session_id) {
    redirect(`/${locale}`);
  }

  const session = await auth();
  const viewerEmail = session?.user?.email ?? null;

  if (!viewerEmail) {
    const redirectTo = session_id
      ? `${studioPath}?session_id=${encodeURIComponent(session_id)}`
      : trimmedPrompt
        ? `${studioPath}?prompt=${encodeURIComponent(trimmedPrompt)}`
        : studioPath;
    redirect(buildSignInHref(redirectTo));
  }

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
