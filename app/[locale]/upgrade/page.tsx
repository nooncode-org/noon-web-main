import { Suspense } from "react";
import { auth } from "@/auth";
import { UpgradeInput } from "@/components/upgrade/upgrade-input";
import { UpgradeSessionList } from "@/components/upgrade/upgrade-session-list";
import { listUserSessions } from "@/lib/upgrade/repositories";
import { BeforeAfterScan } from "@/components/sections/premium";
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
            <p className="site-hero-copy mx-auto mt-4 max-w-xl text-muted-foreground">
              Paste your website URL so we can analyze it, identify conversion, UI/UX, and other
              key improvements, and generate an upgraded version with all those improvements
              applied.
            </p>
            <div className="site-meta-label mx-auto mt-4 grid max-w-xl grid-cols-3 gap-2 font-mono text-muted-foreground">
              {["Scan", "Diagnose", "Generate"].map((item) => (
                <span
                  key={item}
                  className="liquid-glass-pill inline-flex items-center justify-center gap-2 rounded-full px-2.5 py-1.5"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>

        <UpgradeInput
          isAuthenticated={isAuthenticated}
          initialUrl={initialUrl}
          initialMode={initialMode}
        />

        {sessions.length > 0 && <UpgradeSessionList sessions={sessions} />}
      </div>

      {/* Enhanced: Visual process explanation */}
      <div className="mx-auto mt-16 max-w-4xl">
        <div className="mb-8 text-center">
          <p className="site-meta-label mb-3 text-muted-foreground">How it works</p>
          <h2 className="site-section-title">Three steps to a better website</h2>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              step: "01",
              title: "Scan",
              description: "We analyze your live website for performance, accessibility, UI/UX issues, and conversion opportunities.",
              gradient: "from-primary/20 to-primary/5",
            },
            {
              step: "02",
              title: "Diagnose",
              description: "Maxwell identifies specific improvements with detailed recommendations and priority rankings.",
              gradient: "from-primary/15 to-primary/5",
            },
            {
              step: "03",
              title: "Generate",
              description: "Get a fully upgraded version of your site with all improvements applied, ready for review.",
              gradient: "from-primary/10 to-primary/5",
            },
          ].map((item, index) => (
            <div
              key={item.step}
              className="group border border-foreground/10 bg-card/50 p-6 transition-colors duration-300 hover:border-foreground/20"
              style={{
                animation: "reveal-up 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards",
                animationDelay: `${index * 100}ms`,
                opacity: 0,
              }}
            >
              <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-[8px] border border-primary/30 bg-primary/10 text-sm font-mono text-primary">
                {item.step}
              </span>
              <h3 className="mb-2 text-lg font-semibold text-foreground">{item.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{item.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Premium: Before/After Scan visualization */}
      <BeforeAfterScan className="mt-20" />
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
