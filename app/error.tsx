"use client";

import { useEffect } from "react";
import Link from "next/link";
import { NoonLogo } from "@/components/ui/noon-logo";
import { getContactHref } from "@/lib/site-config";

// Root-level error boundary for the App Router. Catches errors thrown in any
// route segment that does not have its own `error.tsx`. The component MUST
// be a client component — Next.js wires it as a React error boundary.
//
// `reset` is the Next-provided callback that retries the rendering of the
// segment that threw. `error.digest` is a server-generated hash that
// identifies the error in the platform logs (useful when a user reports the
// issue and we look it up in Vercel logs).
export default function GlobalErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface to Vercel logs. Once Vercel Analytics is mounted (B42) this
    // also feeds the dashboard. No third-party error tracker is wired —
    // see roadmap §10.8.3 for the accepted gap.
    console.error("App Router error boundary caught:", error);
  }, [error]);

  const contactHref = getContactHref({
    inquiry: "general",
    source: "error-page",
  });

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border/60 px-6 py-5">
        <div className="mx-auto flex max-w-3xl items-center">
          <Link href="/" aria-label="Noon home" className="inline-flex">
            <NoonLogo variant="lockup" height={24} />
          </Link>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-md text-center">
          <p className="mb-3 font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Something broke
          </p>
          <h1 className="mb-4 font-display text-2xl leading-tight">
            That didn&apos;t go as planned.
          </h1>
          <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
            We hit an unexpected error. You can try again, head back home, or contact us if it
            keeps happening — we&apos;ll dig in.
          </p>

          {error.digest && (
            <p className="mb-8 inline-block rounded-full border border-border bg-secondary/30 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Ref {error.digest.slice(0, 8)}
            </p>
          )}

          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={reset}
              className="site-primary-action inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-medium"
            >
              Try again
            </button>
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-full border border-border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-secondary/50"
            >
              Back to home
            </Link>
            <Link
              href={contactHref}
              className="inline-flex items-center justify-center rounded-full border border-border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-secondary/50"
            >
              Contact Noon
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
