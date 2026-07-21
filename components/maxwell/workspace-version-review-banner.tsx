"use client";

import { useState } from "react";
import { ArrowUpRight, Check } from "lucide-react";
import { useWorkspaceTabs } from "@/components/maxwell/workspace-tabs";

/**
 * VersionReviewBanner — the client's #1 recurring job, made first-class: when a
 * version is `ready_for_client_preview`, this banner sits on the Overview and
 * offers the decision directly — view it, make it live, or request changes —
 * instead of burying it in the Versions row "…" menu (audit P0-2, 2026-07-19).
 *
 * Verbs reuse the FROZEN version vocabulary: the primary action IS publish
 * ("Make it live", same verb as VersionRowMenu / version-publish-button) — no
 * invented "approve" state. "Request changes" jumps to the Chat (the talking
 * surface; the "+" → Review site tool lives there).
 *
 * Front only (logic later): "Make it live" flips to an inline success state and
 * resolves the Versions tab's amber action dot via the tabs context. The port
 * wires it to the same publish action (+ its confirm) as the Versions row.
 */
export function VersionReviewBanner({
  sequence,
  previewUrl,
  notes,
  publishAction,
}: {
  sequence: number;
  previewUrl: string | null;
  /** Team-written "what changed in this build" — shown instead of the generic
   *  instruction line so the client knows what to look at before deciding. */
  notes?: string | null;
  /**
   * Real publish (the workspace page passes the bound server action — same
   * transport as the Versions row's publish). Absent = mock: flips locally.
   */
  publishAction?: () => Promise<{ ok: boolean; error?: string }>;
}) {
  const tabs = useWorkspaceTabs();
  const [published, setPublished] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function makeLive() {
    if (publishing) return;
    if (!publishAction) {
      setPublished(true);
      tabs?.resolvePending("versions");
      return;
    }
    setPublishing(true);
    setError(null);
    const result = await publishAction();
    setPublishing(false);
    if (result.ok) {
      setPublished(true);
      tabs?.resolvePending("versions");
    } else {
      setError(result.error ?? "Something went wrong — please try again.");
    }
  }

  if (published) {
    return (
      <section className="flex items-center gap-3 rounded-[6px] border border-emerald-500/30 bg-emerald-500/[0.06] px-5 py-3.5">
        <span
          aria-hidden
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white"
        >
          <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
        </span>
        <div>
          <p className="text-sm font-medium">Version {sequence} is going live</p>
          <p className="text-[12px] text-muted-foreground">
            Your Noon team takes it from here — you&apos;ll get an email when it&apos;s up.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-[6px] border border-border bg-card px-5 py-3.5">
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-[#0056fd]" />
        <div className="min-w-0">
          <p className="text-sm font-medium">Version {sequence} is ready for your review</p>
          <p className="text-[12px] text-muted-foreground">
            {notes ?? "Take a look, then make it live — or tell us what to change."}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {previewUrl && (
          <a
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-[6px] border border-border bg-background px-3 py-1.5 text-[13px] font-medium transition-colors hover:bg-secondary/40"
          >
            View v{sequence}
            <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.75} />
          </a>
        )}
        <button
          type="button"
          onClick={() => tabs?.select("chat")}
          className="rounded-[6px] border border-border bg-background px-3 py-1.5 text-[13px] font-medium transition-colors hover:bg-secondary/40"
        >
          Request changes
        </button>
        <button
          type="button"
          onClick={makeLive}
          disabled={publishing}
          // border-transparent: its two siblings carry a real 1px border —
          // without matching box metrics this one renders 2px shorter.
          className="rounded-[6px] border border-transparent bg-[#0056fd] px-3.5 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-[#0047e0] disabled:pointer-events-none disabled:opacity-60"
        >
          {publishing ? "Making it live…" : "Make it live"}
        </button>
      </div>
      {error && (
        <p role="alert" className="w-full text-[12px] text-red-600">
          {error}
        </p>
      )}
    </section>
  );
}
