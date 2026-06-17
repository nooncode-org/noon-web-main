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
import type { ClientRequest } from "@/lib/maxwell/repositories";
import {
  CLIENT_REQUEST_BODY_MAX,
  CLIENT_REQUEST_PRIORITIES,
  CLIENT_REQUEST_PRIORITY_LABELS,
  CLIENT_REQUEST_TYPES,
  CLIENT_REQUEST_TYPE_LABELS,
  clientVisibleStateLabel,
  DEFAULT_CLIENT_REQUEST_PRIORITY,
  type ClientRequestPriority,
  type ClientRequestType,
} from "@/lib/maxwell/client-requests";
import { submitRequestAction } from "../_actions/submit-request";

function formatStamp(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function RequestBox({
  sessionId,
  requests,
}: {
  sessionId: string;
  requests: ClientRequest[];
}) {
  const [type, setType] = useState<ClientRequestType>("comment");
  const [priority, setPriority] = useState<ClientRequestPriority>(
    DEFAULT_CLIENT_REQUEST_PRIORITY,
  );
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const trimmedLength = body.trim().length;
  const canSend = trimmedLength >= 1 && trimmedLength <= CLIENT_REQUEST_BODY_MAX && !isPending;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSend) return;
    setError(null);
    startTransition(async () => {
      const result = await submitRequestAction({ sessionId, type, clientPriority: priority, body });
      if (result.ok) {
        setBody("");
        setType("comment");
        setPriority(DEFAULT_CLIENT_REQUEST_PRIORITY);
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
            <div key={request.id} className="rounded-xl border border-border bg-card p-4">
              <div className="mb-1.5 flex items-center gap-2.5">
                <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  {CLIENT_REQUEST_TYPE_LABELS[request.type]}
                </span>
                <span className="text-[10px] text-muted-foreground/50">
                  {formatStamp(request.createdAt)}
                </span>
                <span className="ml-auto shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {clientVisibleStateLabel(request.clientVisibleState)}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{request.body}</p>
            </div>
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
              {CLIENT_REQUEST_TYPES.map((value) => (
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
