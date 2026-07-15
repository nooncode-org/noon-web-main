import Link from "next/link";
import { User } from "lucide-react";
import { NoonLogo } from "@/components/ui/noon-logo";

type ProposalNavProps = {
  /** Where the logo + account button point (the viewer's Noon home). */
  homeHref: string;
  /** First initial of the signed-in viewer, or null when not signed in
   * (renders a generic user glyph instead). */
  viewerInitial: string | null;
};

/**
 * Minimal top bar for the public proposal page — Noon wordmark + account.
 * Deliberately NOT the full app nav (no search / AI / menu / back): a client
 * opens this as a single document via a link, so only these affordances fit.
 */
export function ProposalNav({ homeHref, viewerInitial }: ProposalNavProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur">
      <div className="flex h-14 items-center justify-between px-6 sm:px-8">
        <Link href={homeHref} aria-label="Noon home" className="text-foreground">
          <NoonLogo variant="wordmark" height={17} />
        </Link>
        <Link
          href={homeHref}
          aria-label="Your account"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-secondary text-xs font-medium text-foreground transition-colors hover:bg-white/[0.06]"
        >
          {viewerInitial ?? <User className="h-4 w-4 text-muted-foreground" />}
        </Link>
      </div>
    </header>
  );
}
