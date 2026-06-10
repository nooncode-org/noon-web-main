import { Suspense } from "react";
import { auth } from "@/auth";
import { UpgradeInput } from "@/components/upgrade/upgrade-input";
import { UpgradeSessionList } from "@/components/upgrade/upgrade-session-list";
import { listUserSessions } from "@/lib/upgrade/repositories";
import { BeforeAfterScan } from "@/components/sections/premium";
import { UpgradeDemo } from "@/components/marketing/upgrade-demo/UpgradeDemo";
import { UpgradeSteps } from "@/components/upgrade/upgrade-steps";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Upgrade Your Website | Noon",
  description:
    "Get an AI-powered audit of your website and a fully upgraded version, then bring it to life with Noon.",
};

type Props = {
  params: Promise<{ locale?: string }>;
  searchParams: Promise<{ url?: string; mode?: string }>;
};

async function UpgradePageContent({ params, searchParams }: Props) {
  void params;
  const [{ url = "", mode = "" }, session] = await Promise.all([searchParams, auth()]);
  const isAuthenticated = Boolean(session?.user?.email);
  const sessions = isAuthenticated && session?.user?.email
    ? await listUserSessions(session.user.email)
    : [];

  // Restore pre-auth state from URL params (set by UpgradeInput before signin redirect)
  const initialUrl = decodeURIComponent(url);
  const initialMode = mode === "answer_questions" ? "answer_questions" : "best_judgment";

  return (
    <section aria-labelledby="upgrade-entry-title" className="mx-auto w-full max-w-[1180px] px-5 lg:px-8">
      <div className="mx-auto w-full max-w-xl">
        <div className="text-center">
          <div className="mb-5">
            <h1 id="upgrade-entry-title" className="site-hero-title mx-auto max-w-xl text-foreground">
              Upgrade a live website with Maxwell.
            </h1>
            <p className="site-hero-copy mx-auto mt-5 max-w-lg text-muted-foreground">
              Paste your URL — Maxwell audits it, prioritizes what matters, and rebuilds it as
              real, maintainable code.
            </p>
          </div>
        </div>

        <UpgradeInput
          isAuthenticated={isAuthenticated}
          initialUrl={initialUrl}
          initialMode={initialMode}
        />

        {sessions.length > 0 && <UpgradeSessionList sessions={sessions} />}
      </div>

      {/* How it works — process cards */}
      <div className="mx-auto mt-24 max-w-4xl">
        <div className="mb-8 text-center">
          <p className="site-meta-label mb-3 text-muted-foreground">How it works</p>
          <h2 className="site-section-title">Three steps to a better website</h2>
        </div>
        <UpgradeSteps />
      </div>

      {/* What you get back — faithful representation of the real audit output */}
      <div className="mx-auto mt-24 max-w-4xl">
        <div className="mb-8 text-center">
          <p className="site-meta-label mb-3 text-muted-foreground">What you get back</p>
          <h2 className="site-section-title">A clear, scored audit of your site</h2>
        </div>
        <UpgradeDemo />
      </div>

      {/* Premium: Before/After Scan visualization */}
      <BeforeAfterScan className="mt-24" />
    </section>
  );
}

export default function UpgradePage(props: Props) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-[1180px] px-5 lg:px-8">
          <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,1fr)] lg:gap-16">
            <div>
              <div className="mb-3 h-8 w-64 animate-pulse rounded-lg bg-muted" />
              <div className="mb-10 h-4 w-96 max-w-full animate-pulse rounded bg-muted" />
              <div className="h-72 w-full max-w-xl animate-pulse rounded-[10px] bg-muted/40" />
            </div>
            <div className="hidden h-[420px] w-full rounded-[10px] bg-muted/30 lg:block" />
          </div>
        </div>
      }
    >
      <UpgradePageContent {...props} />
    </Suspense>
  );
}
