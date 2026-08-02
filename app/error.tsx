"use client";

import { useEffect } from "react";
import Link from "next/link";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { SiteNavRd } from "@/app/_components/site/site-nav-rd";
import "@/app/_components/site/legal-rd.css";
import "./not-found.css";

// Root-level error boundary for the App Router. Catches errors thrown in any
// route segment without its own error.tsx. MUST be a client component.
export default function GlobalErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App Router error boundary caught:", error);
  }, [error]);

  return (
    <div className={`${GeistSans.variable} ${GeistMono.variable} lgl-rd`}>
      <SiteNavRd locale="en" />

      <div className="lgl-frame" aria-hidden />

      <main className="nf-main">
        <div className="nf-center">
          <h1 className="nf-display">
            That didn&apos;t go<br />as planned.
          </h1>
          {/* The copy follows the buttons. It used to offer a third door
              ("or contact us"), which now points at nothing — a sentence naming
              an action the page no longer has is worse than a shorter one. */}
          <p className="nf-lead">
            We hit an unexpected error. Try again, or head back home — we&apos;ve logged it and
            we&apos;ll dig in.
          </p>
          {error.digest && (
            <p
              style={{
                fontFamily: "var(--mono)",
                fontSize: 11,
                letterSpacing: "0.04em",
                color: "var(--text-muted)",
                marginBottom: 24,
              }}
            >
              Ref {error.digest.slice(0, 8)}
            </p>
          )}
          <div className="nf-actions">
            <button type="button" onClick={reset} className="lgl-btn lgl-btn-primary">
              Try again
            </button>
            <Link href="/" className="lgl-btn lgl-btn-secondary">
              Back to home
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
