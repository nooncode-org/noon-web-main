"use client";

/**
 * RequestBox — the client's typed-request log + submission form on the workspace
 * page (v3 client-request system §9, Slice A). The local outbox is the source of
 * truth, so the list is rendered from server-provided `requests`; on a successful
 * send we reset the form and the server action's `revalidatePath` re-renders the
 * page with the new request appended.
 *
 * The status badge uses a minimal client-visible-state label; Slice B refines the
 * full state->copy mapping when it wires the outbound state receiver.
 */

import { useState, useTransition, type FormEvent } from "react";
import type { ClientRequestWithUpdates } from "@/lib/maxwell/repositories";
import type { ProjectStatusVersion } from "@/lib/maxwell/project-status-types";
import {
  CLIENT_REQUEST_BODY_MAX,
  CLIENT_REQUEST_PRIORITIES,
  CLIENT_REQUEST_PRIORITY_LABELS,
  CLIENT_REQUEST_TYPE_LABELS,
  clientVisibleStateMeta,
  DEFAULT_CLIENT_REQUEST_PRIORITY,
  SELECTABLE_CLIENT_REQUEST_TYPES,
  type ClientRequestPriority,
  type ClientRequestType,
} from "@/lib/maxwell/client-requests";
import { submitRequestAction } from "../_actions/submit-request";
import { submitRequestUpdateAction } from "../_actions/submit-request-update";

function formatStamp(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

/**
 * One request in the log + its clarification replies (B.5a) + an inline "Reply"
 * affordance. Reply state is per-card. The reply posts to the App's
 * client-request-update receiver; on success `revalidatePath` re-renders with the
 * new reply appended. (Needs Clarification collapses to "In review" client-side,
 * so a reply is offered on any request rather than gated on a raw state.)
 */
function RequestCard({
  sessionId,
  request,
}: {
  sessionId: string;
  request: ClientRequestWithUpdates;
}) {
  const stateMeta = clientVisibleStateMeta(request.clientVisibleState);
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const trimmedLength = reply.trim().length;
  const canSend = trimmedLength >= 1 && trimmedLength <= CLIENT_REQUEST_BODY_MAX && !isPending;

  function sendReply() {
    if (!canSend) return;
    setError(null);
    startTransition(async () => {
      const result = await submitRequestUpdateAction({
        sessionId,
        requestId: request.id,
        body: reply,
      });
      if (result.ok) {
        setReply("");
        setReplying(false);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-1.5 flex items-center gap-2.5">
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          {CLIENT_REQUEST_TYPE_LABELS[request.type]}
        </span>
        {request.versionRef != null && (
          <span className="text-[10px] font-mono text-muted-foreground/70">
            Re: version {request.versionRef}
          </span>
        )}
        <span className="text-[10px] text-muted-foreground/50">
          {formatStamp(request.createdAt)}
        </span>
        <span
          className={`ml-auto shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${stateMeta.tone}`}
        >
          {stateMeta.label}
        </span>
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{request.body}</p>

      {request.updates.length > 0 && (
        <div className="mt-3 space-y-2 border-l-2 border-border pl-3">
          {request.updates.map((update) => (
            <div key={update.id}>
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/70">
                Your reply · {formatStamp(update.createdAt)}
              </p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                {update.body}
              </p>
            </div>
          ))}
        </div>
      )}

      {replying ? (
        <div className="mt-3">
          <textarea
            value={reply}
            onChange={(event) => setReply(event.target.value)}
            maxLength={CLIENT_REQUEST_BODY_MAX}
            rows={2}
            placeholder="Add a reply or clarification…"
            aria-label="Reply to request"
            className="w-full resize-none rounded-lg border border-border bg-transparent px-3 py-2 text-sm leading-relaxed outline-none placeholder:text-muted-foreground/50"
            disabled={isPending}
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={sendReply}
              disabled={!canSend}
              className="site-primary-action inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? "Sending…" : "Send reply"}
            </button>
            <button
              type="button"
              onClick={() => setReplying(false)}
              disabled={isPending}
              className="rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setError(null);
            setReplying(true);
          }}
          disabled={isPending}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/30 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
        >
          Reply
        </button>
      )}
      {error && (
        <p className="mt-2 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function RequestBox({
  sessionId,
  requests,
  versions,
}: {
  sessionId: string;
  requests: ClientRequestWithUpdates[];
  /** Project versions from the App pull, for the optional "Regarding version" link (B.4). */
  versions: ProjectStatusVersion[];
}) {
  const [type, setType] = useState<ClientRequestType>("comment");
  const [priority, setPriority] = useState<ClientRequestPriority>(
    DEFAULT_CLIENT_REQUEST_PRIORITY,
  );
  const [body, setBody] = useState("");
  const [versionRef, setVersionRef] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Newest-first, matching the Versions section ordering.
  const versionOptions = [...versions].sort((a, b) => b.sequence - a.sequence);

  const trimmedLength = body.trim().length;
  const canSend = trimmedLength >= 1 && trimmedLength <= CLIENT_REQUEST_BODY_MAX && !isPending;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSend) return;
    setError(null);
    startTransition(async () => {
      const result = await submitRequestAction({
        sessionId,
        type,
        clientPriority: priority,
        body,
        versionRef,
      });
      if (result.ok) {
        setBody("");
        setType("comment");
        setPriority(DEFAULT_CLIENT_REQUEST_PRIORITY);
        setVersionRef(null);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <section>
      <h2 className="mb-4 text-xs font-mono uppercase tracking-widest text-muted-foreground">
        Requests
      </h2>

      {requests.length > 0 && (
        <div className="mb-4 space-y-3">
          {requests.map((request) => (
            <RequestCard key={request.id} sessionId={sessionId} request={request} />
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Type
            </span>
            <select
              value={type}
              onChange={(event) => setType(event.target.value as ClientRequestType)}
              aria-label="Request type"
              disabled={isPending}
              className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm outline-none"
            >
              {SELECTABLE_CLIENT_REQUEST_TYPES.map((value) => (
                <option key={value} value={value}>
                  {CLIENT_REQUEST_TYPE_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Priority
            </span>
            <select
              value={priority}
              onChange={(event) => setPriority(event.target.value as ClientRequestPriority)}
              aria-label="Request priority"
              disabled={isPending}
              className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm outline-none"
            >
              {CLIENT_REQUEST_PRIORITIES.map((value) => (
                <option key={value} value={value}>
                  {CLIENT_REQUEST_PRIORITY_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
        </div>
        {versionOptions.length > 0 && (
          <label className="mb-3 block">
            <span className="mb-1 block text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Regarding version <span className="normal-case opacity-60">(optional)</span>
            </span>
            <select
              value={versionRef ?? ""}
              onChange={(event) =>
                setVersionRef(event.target.value ? Number(event.target.value) : null)
              }
              aria-label="Regarding version"
              disabled={isPending}
              className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm outline-none"
            >
              <option value="">No specific version</option>
              {versionOptions.map((version) => (
                <option key={version.sequence} value={version.sequence}>
                  Version {version.sequence}
                </option>
              ))}
            </select>
          </label>
        )}
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          maxLength={CLIENT_REQUEST_BODY_MAX}
          rows={3}
          placeholder="Describe your request to your Noon team…"
          aria-label="Request details"
          className="w-full resize-none bg-transparent text-sm leading-relaxed outline-none placeholder:text-muted-foreground/50"
          disabled={isPending}
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="text-[11px] text-muted-foreground/50">
            {trimmedLength}/{CLIENT_REQUEST_BODY_MAX}
          </span>
          <button
            type="submit"
            disabled={!canSend}
            className="site-primary-action inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? "Sending…" : "Send request"}
          </button>
        </div>
        {error && (
          <p className="mt-2 text-xs text-red-600" role="alert">
            {error}
          </p>
        )}
      </form>
    </section>
  );
}
