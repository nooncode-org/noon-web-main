"use client";

/**
 * WorkspaceReentryBanner — v3 client portal, Slice 1d (B).
 *
 * Thin CTA rendered at the top of the Studio chat column when the active
 * session has a provisioned client workspace (post-payment portal). It gives
 * the client a way back to `/{locale}/maxwell/workspace/{sessionId}` without
 * digging up the "Workspace ready" email. Presentational only — the host
 * (StudioShell) decides when to mount it; the access gate stays on the
 * workspace page itself (auth + ownership).
 */

import Link from "next/link";
import { ArrowRight, Monitor } from "lucide-react";

export function WorkspaceReentryBanner({ href }: { href: string }) {
  return (
    <div className="shrink-0 border-b border-border/70 bg-secondary/30 px-3 py-2">
      <Link
        href={href}
        className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-xs transition-colors hover:bg-secondary"
      >
        <Monitor className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate text-foreground/90">
          <span className="font-medium">Your project workspace is ready.</span>{" "}
          <span className="text-muted-foreground">Open it to see updates and messages.</span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 font-medium text-foreground/80 transition-colors group-hover:text-foreground">
          Open workspace
          <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </Link>
    </div>
  );
}
