import { redirect } from "next/navigation";
import { SitePageFrame } from "@/app/_components/site/site-page-frame";
import { auth, isGoogleAuthConfigured } from "@/auth";
import { signInWithGoogleAction } from "./actions";
import { normalizeInternalRedirect } from "@/lib/auth/redirect";
import { getAuthenticatedViewer } from "@/lib/auth/session";

type Props = {
  searchParams: Promise<{ redirectTo?: string; error?: string }>;
};

export default async function SignInPage({ searchParams }: Props) {
  const [{ redirectTo: rawRedirectTo, error }, session] = await Promise.all([
    searchParams,
    auth(),
  ]);

  const redirectTo = normalizeInternalRedirect(rawRedirectTo, "/maxwell/studio");

  if (session?.user?.email) {
    redirect(redirectTo);
  }

  const googleConfigured = isGoogleAuthConfigured();
  const viewer = await getAuthenticatedViewer();

  return (
    <SitePageFrame viewer={viewer}>
      <section className="min-h-[calc(100vh-4rem)] px-6 py-16 lg:py-24">
        <div className="mx-auto max-w-xl">
          <div className="rounded-[10px] border border-border bg-card/95 p-8 shadow-[0_24px_80px_rgba(0,0,0,0.08)] backdrop-blur">
            <p className="text-xs font-mono uppercase tracking-[0.28em] text-muted-foreground">
              Maxwell access
            </p>
            <h1 className="mt-4 text-3xl font-display tracking-tight">
              Sign in to continue with Maxwell
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Noon now requires a Google account before starting a Maxwell session.
              Your prompt and proposal flow stay tied to the same verified identity.
            </p>

            <div className="mt-6 rounded-2xl border border-border bg-background/70 p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">What happens next</p>
              <ul className="mt-3 space-y-2">
                <li>Continue into Maxwell Studio with your prompt preserved.</li>
                <li>Keep your proposal and workspace linked to the same account.</li>
                <li>Receive the formal proposal to the email tied to your sign-in.</li>
              </ul>
            </div>

            {error ? (
              <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            {googleConfigured ? (
              <form action={signInWithGoogleAction} className="mt-8">
                <input type="hidden" name="redirectTo" value={redirectTo} />
                <button
                  type="submit"
                  className="site-primary-action inline-flex h-12 w-full items-center justify-center rounded-full px-6 text-sm font-medium"
                >
                  Continue with Google
                </button>
              </form>
            ) : (
              <div className="mt-8 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-800">
                Google sign-in is not configured yet. Add <code>AUTH_GOOGLE_ID</code>,{" "}
                <code>AUTH_GOOGLE_SECRET</code>, and <code>AUTH_SECRET</code> before
                enabling this flow.
              </div>
            )}
          </div>
        </div>
      </section>
    </SitePageFrame>
  );
}
