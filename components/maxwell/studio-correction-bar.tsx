"use client";

import { Loader2 } from "lucide-react";
import type { StudioPhase } from "./studio-shell";

type StudioCorrectionBarProps = {
  phase: StudioPhase;
  versionNumber: number;
  correctionsUsed: number;
  maxCorrections: number;
};

export function StudioCorrectionBar({
  phase,
  versionNumber,
  correctionsUsed,
  maxCorrections,
}: StudioCorrectionBarProps) {
  const isRevising = phase === "revision_requested";
  const allUsed = correctionsUsed >= maxCorrections;
  const remaining = maxCorrections - correctionsUsed;

  return (
    <div className="flex items-center gap-3 border-y border-border/70 bg-card px-4 py-2.5 text-xs">
      {/* Version badge */}
      <span className="shrink-0 rounded-md border border-border/70 bg-secondary px-2 py-0.5 text-muted-foreground">
        v{versionNumber}
      </span>

      {/* Dot indicators */}
      <div className="flex items-center gap-1 shrink-0">
        {Array.from({ length: maxCorrections }).map((_, i) => (
          <span
            key={i}
            className="w-2 h-2 rounded-full transition-colors duration-300"
            style={{
              backgroundColor: i < correctionsUsed ? "var(--muted-foreground)" : "var(--border)",
            }}
          />
        ))}
      </div>

      {/* Status label */}
      <span className="min-w-0 flex-1 truncate text-muted-foreground">
        {isRevising ? (
          <span className="flex items-center gap-1.5">
            <Loader2 className="w-3 h-3 animate-spin inline" />
            Applying adjustment...
          </span>
        ) : allUsed ? (
          "Adjustments complete"
        ) : (
          `${remaining} adjustment${remaining === 1 ? "" : "s"} remaining`
        )}
      </span>
    </div>
  );
}
