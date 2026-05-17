"use client";

import { useEffect } from "react";

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
          html, body { margin: 0; padding: 0; }
          .noon-global-error {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 48px 24px;
            font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
            background: #ffffff;
            color: #000000;
            box-sizing: border-box;
          }
          .noon-global-error * { box-sizing: border-box; }
          .noon-global-error__card {
            width: 100%;
            max-width: 32rem;
            background: #ffffff;
            border: 1px solid #dbe3ef;
            border-radius: 16px;
            padding: 32px;
          }
          .noon-global-error__brand {
            margin: 0;
            font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
            font-size: 12px;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.18em;
            color: #66738b;
          }
          .noon-global-error__title {
            margin: 12px 0 0;
            font-size: 30px;
            line-height: 1.2;
            font-weight: 600;
          }
          .noon-global-error__body {
            margin: 12px 0 0;
            font-size: 14px;
            line-height: 1.5;
            color: #66738b;
          }
          .noon-global-error__actions {
            margin-top: 24px;
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
          }
          .noon-global-error__btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 10px 20px;
            border-radius: 9999px;
            font-size: 14px;
            font-weight: 500;
            text-decoration: none;
            cursor: pointer;
            border: 1px solid transparent;
            background: transparent;
          }
          .noon-global-error__btn--primary {
            background: #000000;
            color: #ffffff;
          }
          .noon-global-error__btn--secondary {
            border-color: #dbe3ef;
            color: #000000;
          }
          @media (prefers-color-scheme: dark) {
            .noon-global-error { background: #000000; color: #e8edf7; }
            .noon-global-error__card { background: #080808; border-color: #262626; }
            .noon-global-error__brand { color: #7a8aaa; }
            .noon-global-error__body { color: #7a8aaa; }
            .noon-global-error__btn--primary { background: #e8edf7; color: #000000; }
            .noon-global-error__btn--secondary { border-color: #262626; color: #e8edf7; }
          }
        `}</style>
        <main className="noon-global-error">
          <section className="noon-global-error__card">
            <p className="noon-global-error__brand">Noon</p>
            <h1 className="noon-global-error__title">Something interrupted the page.</h1>
            <p className="noon-global-error__body">
              Try again. If it keeps happening, contact Noon and include this page context.
            </p>
            <div className="noon-global-error__actions">
              <button
                type="button"
                onClick={reset}
                className="noon-global-error__btn noon-global-error__btn--primary"
              >
                Try again
              </button>
              {/*
                global-error.tsx renders when the root layout itself fails, so
                Next.js router context may not be available. Using next/link here
                risks failing on top of an already-failed render. Plain anchor is
                the safe choice for this surface.
              */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a
                href="/en"
                className="noon-global-error__btn noon-global-error__btn--secondary"
              >
                Go home
              </a>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
