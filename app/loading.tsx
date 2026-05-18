import { NoonLogo } from "@/components/ui/noon-logo";

// Top-level loading skeleton shown while the App Router resolves the page.
// Branded and minimal — should appear for ~100-400ms during route transitions.
// Keeps the chrome (logo + page background) so the jump to the final page
// doesn't flash a white screen.
export default function Loading() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border/60 px-6 py-5">
        <div className="mx-auto flex max-w-3xl items-center">
          <NoonLogo variant="lockup" height={24} />
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center justify-center gap-2">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-2 w-2 animate-pulse rounded-full bg-muted-foreground/40"
                style={{ animationDelay: `${i * 180}ms` }}
              />
            ))}
          </div>
          <p className="text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Loading
          </p>
        </div>
      </main>
    </div>
  );
}
