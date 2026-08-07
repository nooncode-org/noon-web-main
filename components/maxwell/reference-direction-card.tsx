"use client";

import { useState } from "react";

/**
 * ReferenceDirectionCard — the Fase A confirmation card (Quality Layer v2).
 *
 * The moment before generating: Maxwell shows the 2-3 selected visual
 * references AS QUALITY CAPTURES and the client approves the direction with
 * one tap — or swaps, or brings their own reference (the fast-path client who
 * skipped the style conversation gets their ask HERE).
 *
 * Owner-approved anatomy (2026-08-03, mockup round): title only (no subtitle
 * — Maxwell's bubble above already says it), captures big with the primary
 * chipped, 3-4 word descriptors, three actions, no fine print.
 *
 * Status: UI piece of Fase A (Entrega 2). Currently mounted in the dev bench
 * (/maxwell/tracepreview) with demo data; the live wiring (real captures from
 * the reference study + working handlers) lands with the pipeline build.
 * Labels arrive via data so the caller passes the session's language.
 */

export type ReferenceOption = {
  /** Display name — "Poilâne · Paris". */
  name: string;
  /** 3-4 word descriptor ("Editorial and warm"). Optional on secondaries. */
  why?: string;
  /** Quality capture (retina, hero-framed, clean) — never a raw thumbnail. */
  imageUrl: string;
  primary?: boolean;
  /**
   * E2.2 — the reference's actual URL, so the confirm action knows which
   * direction the tap chose. Absent in bench/demo data.
   */
  refUrl?: string;
};

export type ReferenceDirectionData = {
  /** Card heading — "Dirección visual de tu prototipo". */
  title: string;
  /** 2-3 references, primary first. */
  references: ReferenceOption[];
  /** Button labels in the SESSION's language (the client's, not ours). */
  labels: {
    continue: string;
    preferAnother: string;
    useMine: string;
    primaryChip: string;
  };
};

export function ReferenceDirectionCard({
  data,
  onContinue,
  onPreferAnother,
  onUseMine,
}: {
  data: ReferenceDirectionData;
  /** Receives the reference the client had selected when confirming. */
  onContinue?: (selected: ReferenceOption) => void;
  onPreferAnother?: () => void;
  onUseMine?: () => void;
}) {
  // The tiles are a CHOICE, not an exhibit (owner): tapping one makes it the
  // direction — chip and blue edge follow the selection, "Continue" confirms
  // whichever is marked. Starts on the system's recommendation.
  const [selected, setSelected] = useState(() => {
    const primary = data.references.findIndex((ref) => ref.primary);
    return primary === -1 ? 0 : primary;
  });

  const ghost =
    "rounded-[6px] border border-border px-3.5 py-2 text-[13px] font-medium text-foreground/85 transition-colors hover:bg-secondary/60";

  return (
    <div className="max-w-[560px] overflow-hidden rounded-[8px] border border-border bg-card">
      <p className="px-[18px] pt-4 text-sm font-semibold text-foreground">{data.title}</p>

      <div className="grid grid-cols-2 gap-2.5 px-[18px] pt-3.5">
        {data.references.map((ref, index) => {
          const isSelected = index === selected;
          return (
            <button
              key={ref.name}
              type="button"
              aria-pressed={isSelected}
              onClick={() => setSelected(index)}
              className="group relative min-w-0 text-left"
            >
              {/* Same ratio for every capture (the scale rule applied to our own
                  showcase) — hero-framed via object-top. Selection reads on the
                  image's edge: blue and slightly lifted when chosen, quiet
                  otherwise. */}
              {/* eslint-disable-next-line @next/next/no-img-element -- captures
                  come from the reference cache, not the public/ pipeline;
                  next/image would demand width/height we don't know yet. */}
              <img
                src={ref.imageUrl}
                alt={ref.name}
                className={`aspect-[16/10] w-full rounded-[6px] border object-cover object-top transition-colors ${
                  isSelected
                    ? "border-[#0056fd] ring-1 ring-[#0056fd]"
                    : "border-border group-hover:border-foreground/30"
                }`}
              />
              {isSelected && (
                <span className="absolute left-2 top-2 rounded-[4px] bg-[#0056fd] px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.02em] text-white">
                  {data.labels.primaryChip}
                </span>
              )}
              <p
                className={`mt-2 truncate text-[12.5px] font-semibold transition-colors ${
                  isSelected ? "text-foreground" : "text-foreground/70 group-hover:text-foreground"
                }`}
              >
                {ref.name}
              </p>
              {ref.why && (
                <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">{ref.why}</p>
              )}
            </button>
          );
        })}
      </div>

      {/* Symmetric on purpose (owner): primary full-width, then the two
          secondaries at exact halves — no third button wrapping alone at any
          pane width. */}
      <div className="space-y-2 px-[18px] py-4">
        <button
          type="button"
          onClick={() => onContinue?.(data.references[selected])}
          className="w-full rounded-[6px] bg-[#0056fd] px-3.5 py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-[#0047e0]"
        >
          {data.labels.continue}
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onPreferAnother} className={ghost}>
            {data.labels.preferAnother}
          </button>
          <button type="button" onClick={onUseMine} className={ghost}>
            {data.labels.useMine}
          </button>
        </div>
      </div>
    </div>
  );
}
