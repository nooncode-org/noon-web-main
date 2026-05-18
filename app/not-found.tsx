import Link from "next/link";
import type { Metadata } from "next";
import { NoonLogo } from "@/components/ui/noon-logo";
import { getContactHref } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Page not found — Noon",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  const contactHref = getContactHref({
    inquiry: "general",
    source: "not-found",
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
            404 — not found
          </p>
          <h1 className="mb-4 font-display text-2xl leading-tight">
            We couldn&apos;t find that page.
          </h1>
          <p className="mb-8 text-sm leading-relaxed text-muted-foreground">
            The link may be old, or the page may have moved. From here you can go back to the
            home page or reach out if you were looking for something specific.
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/"
              className="site-primary-action inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-medium"
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
