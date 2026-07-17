"use client";

/**
 * VersionRollbackButton — the client's "request rollback to this version" action
 * on a non-live version row (v3 B.4 version-linking, co-signed 2026-06-20).
 *
 * Rollback is STAFF authority (Fase 2): the client SUGGESTS, staff decide+execute.
 * So this does NOT publish — it files a `type = rollback` client request (the same
 * §9 persist-then-forward path as RequestBox) carrying `versionRef = this version`.
 * The App accepts it (dangling-tolerant, Q-B4-3) and surfaces it to staff; the
 * request then flows through the same 5 client-visible states as any request and
 * appears in the request log below.
 *
 * Mirrors VersionPublishButton's deliberate two-step (expand → confirm) UX. Gated
 * at the call site by ROLLBACK_REQUEST_ENABLED — this component never mounts while
 * the App hasn't deployed `type = rollback` (hard deploy order, cosign §4).
 */

import { useState, useTransition } from "react";
import {
  CLIENT_REQUEST_BODY_MAX,
  DEFAULT_CLIENT_REQUEST_PRIORITY,
} from "@/lib/maxwell/client-requests";
import { submitRequestAction } from "../_actions/submit-request";

export function VersionRollbackButton({
  sessionId,
  versionSequenceNumber,
}: {
  sessionId: string;
  versionSequenceNumber: number;
}) {
  // State-agnostic copy: the row may never have been live ("rollback" would read
  // oddly there). The wire type stays `rollback` (B.4); this is client-facing only.
  const defaultBody = `Please make version ${versionSequenceNumber} the live version.`;
  const [expanded, setExpanded] = useState(false);
  const [body, setBody] = useState(defaultBody);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const trimmedLength = body.trim().length;
  const canSend = trimmedLength >= 1 && trimmedLength <= CLIENT_REQUEST_BODY_MAX && !isPending;

  function handleSend() {
    if (!canSend) return;
    setError(null);
    startTransition(async () => {
      const result = await submitRequestAction({
        sessionId,
        type: "rollback",
        clientPriority: DEFAULT_CLIENT_REQUEST_PRIORITY,
        body,
        versionRef: versionSequenceNumber,
      });
      if (result.ok) {
        // The server action revalidated the page; the new rollback request appears
        // in the request log below. Collapse + reset defensively.
        setExpanded(false);
        setBody(defaultBody);
      } else {
        setError(result.error);
      }
    });
  }

  if (!expanded) {
    return (
      <div className="mt-3">
        <button
          type="button"
          onClick={() => {
            setError(null);
            setExpanded(true);
          }}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/30 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
        >
          Ask the team to make this version live
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
    <div className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/5 p-3">
      <p className="mb-2 text-xs text-muted-foreground">
        Ask your Noon team to make version {versionSequenceNumber} the live version. They
        will review the request and apply it.
      </p>
      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        maxLength={CLIENT_REQUEST_BODY_MAX}
        rows={3}
        aria-label="Rollback request details"
        className="w-full resize-none rounded-lg border border-border bg-transparent px-3 py-2 text-sm leading-relaxed outline-none placeholder:text-muted-foreground/50"
        disabled={isPending}
      />
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          className="site-primary-action inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Sending…" : "Send request"}
        </button>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          disabled={isPending}
          className="rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
      {error && (
        <p className="mt-2 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
