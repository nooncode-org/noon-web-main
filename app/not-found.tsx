import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12 text-foreground">
      <section className="w-full max-w-lg rounded-2xl border border-border bg-card p-8">
        <p className="text-xs font-mono uppercase tracking-[0.18em] text-muted-foreground">
          Noon
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Page not found.</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          This page is unavailable or the link expired.
        </p>
        <Link
          href="/en"
          className="mt-6 inline-flex rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background"
        >
          Go home
        </Link>
      </section>
    </main>
  );
}
