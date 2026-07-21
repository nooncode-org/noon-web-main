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
import {
  ATTACHMENT_MIME_ALLOWLIST,
  ATTACHMENTS_ENABLED,
  isAllowedAttachmentMime,
  isValidAttachmentSize,
} from "@/lib/maxwell/attachments";
import { submitRequestAction } from "../_actions/submit-request";
import { submitRequestUpdateAction } from "../_actions/submit-request-update";
import { submitRequestAttachmentAction } from "../_actions/submit-request-attachment";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/* Styled (Radix) selects replace the native ones: the native popup can't be
   themed (OS chrome, system-blue highlight) and its arrow hugs the border.
   Trigger restyled to match the form inputs; content matches the card system. */
const SELECT_TRIGGER =
  "w-full rounded-[6px] border-border bg-transparent shadow-none dark:bg-transparent dark:hover:bg-transparent";
const SELECT_CONTENT = "rounded-[6px] border-border";
/** Radix Select forbids empty-string item values — sentinel for "no version". */
const NO_VERSION = "none";

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
  // Attachment sub-form (B.5b). Gated by ATTACHMENTS_ENABLED; mutually exclusive
  // with the reply form. Shares `error` and the transition with the reply path.
  const [attaching, setAttaching] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [attachNote, setAttachNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const trimmedLength = reply.trim().length;
  const canSend = trimmedLength >= 1 && trimmedLength <= CLIENT_REQUEST_BODY_MAX && !isPending;
  const canAttach = file != null && !isPending;

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

  function closeAttach() {
    setAttaching(false);
    setFile(null);
    setAttachNote("");
  }

  function sendAttachment() {
    if (!file || isPending) return;
    // Client-side mirror of the server validation — fail fast before upload.
    if (!isAllowedAttachmentMime(file.type)) {
      setError("That file type isn't allowed.");
      return;
    }
    if (!isValidAttachmentSize(file.size)) {
      setError("That file is too large (max 10 MB).");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await submitRequestAttachmentAction({
        sessionId,
        requestId: request.id,
        file,
        body: attachNote.trim() ? attachNote : null,
      });
      if (result.ok) {
        closeAttach();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="rounded-[6px] border border-border p-4">
      <div className="mb-1.5 flex items-center gap-2.5">
        <span className="text-[11px] font-medium">
          {CLIENT_REQUEST_TYPE_LABELS[request.type]}
        </span>
        {request.versionRef != null && (
          <span className="text-[11px] text-muted-foreground/70">
            Re: version {request.versionRef}
          </span>
        )}
        <span className="text-[11px] text-muted-foreground/70">
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
            className="w-full resize-none rounded-[6px] border border-border bg-transparent px-3 py-2 text-sm leading-relaxed outline-none placeholder:text-muted-foreground/50"
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
      ) : attaching ? (
        <div className="mt-3">
          <input
            type="file"
            accept={ATTACHMENT_MIME_ALLOWLIST.join(",")}
            onChange={(event) => {
              setError(null);
              setFile(event.target.files?.[0] ?? null);
            }}
            aria-label="Choose a file to attach"
            disabled={isPending}
            className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-full file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-xs file:font-medium hover:file:bg-secondary/70"
          />
          <textarea
            value={attachNote}
            onChange={(event) => setAttachNote(event.target.value)}
            maxLength={CLIENT_REQUEST_BODY_MAX}
            rows={2}
            placeholder="Add an optional note…"
            aria-label="Attachment note (optional)"
            className="mt-2 w-full resize-none rounded-[6px] border border-border bg-transparent px-3 py-2 text-sm leading-relaxed outline-none placeholder:text-muted-foreground/50"
            disabled={isPending}
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={sendAttachment}
              disabled={!canAttach}
              className="site-primary-action inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? "Attaching…" : "Attach file"}
            </button>
            <button
              type="button"
              onClick={closeAttach}
              disabled={isPending}
              className="rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setError(null);
              setReplying(true);
            }}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-[6px] border border-border bg-secondary/30 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
          >
            Reply
          </button>
          {ATTACHMENTS_ENABLED && (
            <button
              type="button"
              onClick={() => {
                setError(null);
                setAttaching(true);
              }}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-[6px] border border-border bg-secondary/30 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
            >
              Attach file
            </button>
          )}
        </div>
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
    <section id="requests" className="scroll-mt-16 rounded-[6px] border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <h2 className="text-sm font-medium">Requests</h2>
        {requests.length > 0 && (
          <span className="text-[13px] text-muted-foreground">{requests.length}</span>
        )}
      </div>

      <div className="p-5">
      {requests.length > 0 && (
        <div className="mb-4 space-y-3">
          {requests.map((request) => (
            <RequestCard key={request.id} sessionId={sessionId} request={request} />
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="rounded-[6px] border border-border p-4">
        <div className="mb-3 grid gap-3 sm:grid-cols-2">
          <div>
            <span className="mb-1 block text-[11px] text-muted-foreground">
              Type
            </span>
            <Select
              value={type}
              onValueChange={(value) => setType(value as ClientRequestType)}
              disabled={isPending}
            >
              <SelectTrigger aria-label="Request type" className={SELECT_TRIGGER}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={SELECT_CONTENT}>
                {SELECTABLE_CLIENT_REQUEST_TYPES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {CLIENT_REQUEST_TYPE_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <span className="mb-1 block text-[11px] text-muted-foreground">
              Priority
            </span>
            <Select
              value={priority}
              onValueChange={(value) => setPriority(value as ClientRequestPriority)}
              disabled={isPending}
            >
              <SelectTrigger aria-label="Request priority" className={SELECT_TRIGGER}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={SELECT_CONTENT}>
                {CLIENT_REQUEST_PRIORITIES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {CLIENT_REQUEST_PRIORITY_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {versionOptions.length > 0 && (
          <div className="mb-3">
            <span className="mb-1 block text-[11px] text-muted-foreground">
              Regarding version <span className="opacity-60">(optional)</span>
            </span>
            <Select
              value={versionRef == null ? NO_VERSION : String(versionRef)}
              onValueChange={(value) =>
                setVersionRef(value === NO_VERSION ? null : Number(value))
              }
              disabled={isPending}
            >
              <SelectTrigger aria-label="Regarding version" className={SELECT_TRIGGER}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={SELECT_CONTENT}>
                <SelectItem value={NO_VERSION}>No specific version</SelectItem>
                {versionOptions.map((version) => (
                  <SelectItem key={version.sequence} value={String(version.sequence)}>
                    Version {version.sequence}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
      </div>
    </section>
  );
}
