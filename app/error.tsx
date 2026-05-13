"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Noon Web render error:", error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12 text-foreground">
      <section className="w-full max-w-lg rounded-2xl border border-border bg-card p-8">
        <p className="text-xs font-mono uppercase tracking-[0.18em] text-muted-foreground">
          Noon
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Something interrupted the page.</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Try again. If it keeps happening, contact Noon and include this page context.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background"
          >
            Try again
          </button>
          <Link
            href="/en"
            className="rounded-full border border-border px-5 py-2.5 text-sm font-medium"
          >
            Go home
          </Link>
        </div>
      </section>
    </main>
  );
}
