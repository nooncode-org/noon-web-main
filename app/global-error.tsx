"use client";

import { useEffect } from "react";

// Root layout error boundary — renders its own <html> because the root layout
// itself may have failed. Keep fully self-contained: no external imports, no
// next/link (router context may be unavailable when the root layout fails).
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(
      "Noon Web root error:",
      error,
      error.digest ? { digest: error.digest } : undefined,
    );
  }, [error]);

  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <style>{`
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          .ge-root {
            min-height: 100dvh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 48px 24px;
            font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
            background: #ffffff;
            color: #111827;
            -webkit-font-smoothing: antialiased;
          }
          .ge-card { width: 100%; max-width: 480px; }
          .ge-brand {
            display: inline-block;
            font-size: 13px;
            font-weight: 600;
            letter-spacing: -0.01em;
            color: #111827;
            margin-bottom: 32px;
          }
          .ge-heading {
            font-size: clamp(26px, 4vw, 36px);
            font-weight: 400;
            letter-spacing: -0.025em;
            line-height: 1.1;
            color: #111827;
            margin-bottom: 16px;
          }
          .ge-body {
            font-size: 14px;
            line-height: 1.65;
            color: #6b7280;
            margin-bottom: 32px;
            max-width: 40ch;
          }
          .ge-actions { display: flex; flex-wrap: wrap; gap: 10px; }
          .ge-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 11px 22px;
            border-radius: 9999px;
            font-size: 14px;
            font-weight: 500;
            text-decoration: none;
            cursor: pointer;
            border: 1px solid transparent;
            background: transparent;
            line-height: 1;
            font-family: inherit;
            transition: transform .18s;
          }
          .ge-btn-primary { background: #111827; color: #ffffff; }
          .ge-btn-primary:hover { transform: translateY(-1px); }
          .ge-btn-secondary { border-color: #e6e8f2; color: #111827; }
          .ge-btn-secondary:hover { background: #f7f8fc; }
          @media (prefers-color-scheme: dark) {
            .ge-root { background: #000000; color: #ffffff; }
            .ge-brand, .ge-heading { color: #ffffff; }
            .ge-body { color: #a3a3a3; }
            .ge-btn-primary { background: #ffffff; color: #000000; }
            .ge-btn-secondary { border-color: #262626; color: #ffffff; }
            .ge-btn-secondary:hover { background: #1f1f1f; }
          }
        `}</style>
        <main className="ge-root">
          <div className="ge-card">
            <span className="ge-brand">Noon</span>
            <h1 className="ge-heading">
              Something interrupted<br />the page.
            </h1>
            <p className="ge-body">
              Try again. If it keeps happening, contact us and we&apos;ll dig in.
            </p>
            <div className="ge-actions">
              <button type="button" onClick={reset} className="ge-btn ge-btn-primary">
                Try again
              </button>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a href="/en" className="ge-btn ge-btn-secondary">
                Go home
              </a>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
