"use client";

/**
 * CommentBox — the client's message log + send form on the workspace page
 * (v3 client portal, Slice 1b). The local outbox is the source of truth, so the
 * list is rendered from server-provided `comments`; on a successful send we
 * clear the textarea and the server action's `revalidatePath` re-renders the
 * page with the new message appended.
 */

import { useState, useTransition, type FormEvent } from "react";
import type { ClientComment } from "@/lib/maxwell/repositories";
import { submitCommentAction } from "../_actions/submit-comment";

const MAX_COMMENT_LENGTH = 2000;

function formatStamp(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function CommentBox({
  sessionId,
  comments,
}: {
  sessionId: string;
  comments: ClientComment[];
}) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const trimmedLength = body.trim().length;
  const canSend = trimmedLength >= 1 && trimmedLength <= MAX_COMMENT_LENGTH && !isPending;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSend) return;
    setError(null);
    startTransition(async () => {
      const result = await submitCommentAction({ sessionId, body });
      if (result.ok) {
        setBody("");
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <section>
      <h2 className="mb-4 text-xs font-mono uppercase tracking-widest text-muted-foreground">
        Messages
      </h2>

      {comments.length > 0 && (
        <div className="mb-4 space-y-3">
          {comments.map((comment) => (
            <div key={comment.id} className="rounded-xl border border-border bg-card p-4">
              <div className="mb-1.5 flex items-center gap-2.5">
                <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  You
                </span>
                <span className="text-[10px] text-muted-foreground/50">
                  {formatStamp(comment.createdAt)}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{comment.body}</p>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card p-4">
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          maxLength={MAX_COMMENT_LENGTH}
          rows={3}
          placeholder="Send a message to your Noon team…"
          aria-label="Message to your Noon team"
          className="w-full resize-none bg-transparent text-sm leading-relaxed outline-none placeholder:text-muted-foreground/50"
          disabled={isPending}
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="text-[11px] text-muted-foreground/50">
            {trimmedLength}/{MAX_COMMENT_LENGTH}
          </span>
          <button
            type="submit"
            disabled={!canSend}
            className="site-primary-action inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? "Sending…" : "Send"}
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
