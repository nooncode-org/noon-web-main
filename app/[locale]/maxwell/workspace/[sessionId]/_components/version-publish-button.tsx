"use client";

/**
 * VersionPublishButton — the client's Publish action on a publishable version row
 * (v3 Fase 2 versioning, Slice 2b). Publishing makes a version the live public
 * one, so it is a deliberate two-step action (Publish → confirm) rather than a
 * single click.
 *
 * NoonWeb persists nothing locally: on success the server action revalidates the
 * page and the project-status pull re-renders this section with the new published
 * state (this row flips to "Published" and the button disappears). On failure the
 * client sees a clean error and can retry.
 */

import { useState, useTransition } from "react";
import { submitVersionAction } from "../_actions/submit-version-action";

export function VersionPublishButton({
  sessionId,
  versionSequenceNumber,
}: {
  sessionId: string;
  versionSequenceNumber: number;
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handlePublish() {
    setError(null);
    startTransition(async () => {
      const result = await submitVersionAction({ sessionId, versionSequenceNumber });
      if (result.ok) {
        // The server action revalidated the page; this row re-renders as
        // "Published" and the button unmounts. Reset state defensively.
        setConfirming(false);
      } else {
        setError(result.error);
        setConfirming(false);
      }
    });
  }

  if (!confirming) {
    return (
      <div className="mt-3">
        <button
          type="button"
          onClick={() => {
            setError(null);
            setConfirming(true);
          }}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-[6px] border border-border bg-secondary/30 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Publishing…" : "Publish this version"}
        </button>
        {error && (
          <p className="mt-2 text-xs text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-[6px] border border-emerald-500/25 bg-emerald-500/5 p-3">
      <p className="mb-2 text-xs text-muted-foreground">
        Publish this version? It becomes the live version visible to the public.
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handlePublish}
          disabled={isPending}
          className="site-primary-action inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Publishing…" : "Confirm publish"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={isPending}
          className="rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
