"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronDown, Globe, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildSignInHref } from "@/lib/auth/redirect";

type UpgradeInputProps = {
  isAuthenticated: boolean;
  /** Pre-filled URL from localStorage restore after auth */
  initialUrl?: string;
  initialMode?: UpgradeMode | "specific_note";
  initialNote?: string;
};

type UpgradeMode = "answer_questions" | "best_judgment";

const MODES = [
  {
    value: "best_judgment" as const,
    label: "Use Noon's best judgment",
    description: "We analyze your site and recommend improvements automatically.",
  },
  {
    value: "answer_questions" as const,
    label: "Answer a few questions",
    description: "Tell us a bit about your goals - up to 5 quick questions.",
  },
] as const;

const STORAGE_KEY = "noon_upgrade_pending";

function savePending(url: string, mode: string, note: string) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ url, mode, note }));
  } catch {
    // ignore storage errors
  }
}

function clearPending() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function UpgradeInput({
  isAuthenticated,
  initialUrl = "",
  initialMode = "best_judgment",
  initialNote = "",
}: UpgradeInputProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [url, setUrl] = useState(initialUrl);
  const [mode, setMode] = useState<UpgradeMode>(
    initialMode === "answer_questions" ? "answer_questions" : "best_judgment"
  );
  const [note, setNote] = useState(initialNote);
  // Own the disclosure instead of deriving it from `note.length > 0`: derived, a
  // select-all-delete inside the field collapsed the panel out from under the
  // cursor. Seeded open when there's a note to show, then the user's own toggles win.
  const [noteOpen, setNoteOpen] = useState(initialNote.length > 0);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // Restore optional context from localStorage after signin redirect.
  useEffect(() => {
    if (!initialNote) {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const pending = JSON.parse(raw) as { url?: string; mode?: string; note?: string };
          if (pending.note) {
            setNote(pending.note);
            setNoteOpen(true); // a restored note must not stay hidden behind the summary
          }
        }
      } catch {
        // ignore
      }
    }
    // run once on mount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const trimmedUrl = url.trim();
  const trimmedNote = note.trim();
  const canSubmit = trimmedUrl.length > 0 && !isSubmitting && !isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);

    // If not authenticated, save state and redirect to sign-in
    if (!isAuthenticated) {
      savePending(trimmedUrl, mode, note);
      const redirectTo = `/upgrade?url=${encodeURIComponent(trimmedUrl)}&mode=${mode}`;
      router.push(buildSignInHref(redirectTo));
      return;
    }

    clearPending();
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          websiteUrl: trimmedUrl,
          mode,
          contextNote: trimmedNote.length > 0 ? trimmedNote : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message ?? "Something went wrong. Please try again.");
        return;
      }

      startTransition(() => {
        router.push(`/upgrade/${data.session.id}`);
      });
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="liquid-glass-card w-full"
    >
      <div className="space-y-4 p-4">
      {/* URL input */}
      <div className="space-y-2">
        <label htmlFor="website-url" className="text-sm font-medium text-foreground">
          Your website URL
        </label>
        <div className="relative">
          <Globe
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            id="website-url"
            ref={inputRef}
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="yourwebsite.com"
            autoComplete="url"
            // Taller and larger than the rest: this is THE input. It used to be
            // 44px while the OPTIONAL note field was 166px — the one thing you
            // must fill was the smallest thing on screen.
            className="h-[52px] w-full rounded-[9px] border border-foreground/12 bg-[var(--bg-secondary)] py-2.5 pl-11 pr-4 font-mono text-[15px] text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-shadow placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/35"
            disabled={isSubmitting}
          />
        </div>
      </div>

      {/* Mode selector */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-foreground">How should we approach it?</legend>
        <div className="grid gap-2">
          {MODES.map((m) => (
            <label
              key={m.value}
              className={`flex cursor-pointer items-start gap-3 rounded-[9px] border px-4 py-2.5 transition-colors ${
                mode === m.value
                  ? "border-primary/70 bg-primary/10"
                  : "border-foreground/10 bg-[var(--bg-secondary)] hover:border-foreground/30"
              }`}
            >
              <input
                type="radio"
                name="mode"
                value={m.value}
                checked={mode === m.value}
                onChange={() => setMode(m.value)}
                className="mt-0.5 accent-primary"
                disabled={isSubmitting}
              />
              <span className="space-y-0.5">
                <span className="block text-sm font-medium text-foreground">{m.label}</span>
                <span className="block text-xs text-foreground/70">{m.description}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Optional context — behind a disclosure, and only 3 rows when open.
          It used to sit open at 7 rows (166px), making the field you can SKIP the
          biggest thing on the page. Stays open once it has content, so a filled
          note can never hide itself. */}
      <details
        open={noteOpen}
        onToggle={(e) => setNoteOpen(e.currentTarget.open)}
        className="group"
      >
        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
          <ChevronDown
            className="h-4 w-4 transition-transform group-open:rotate-180"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          Additional details <span className="font-normal">(optional)</span>
        </summary>
        <textarea
          id="context-note"
          // The <summary> is the disclosure's own name, not this field's — with the
          // visible <label> gone, this is what keeps the textarea from being
          // announced as an unlabeled edit box.
          aria-label="Additional details (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Anything you’d like us to consider."
          rows={3}
          maxLength={2000}
          className="mt-2.5 w-full resize-y rounded-[9px] border border-foreground/12 bg-[var(--bg-secondary)] px-4 py-3 text-sm text-foreground transition-shadow placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/35"
          disabled={isSubmitting}
        />
        {/* Only once there IS something to count — "0/2000" under an empty
            optional field is pure noise. */}
        {note.length > 0 && (
          <p className="mt-1.5 text-right text-xs text-muted-foreground">{note.length}/2000</p>
        )}
      </details>

      {/* Error */}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {/* Submit */}
      <Button
        type="submit"
        disabled={!canSubmit}
        className="h-11 w-full gap-2 rounded-[9px]"
        size="lg"
      >
        {isSubmitting || isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Starting...
          </>
        ) : (
          <>
            Analyze my website
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </Button>

      {!isAuthenticated && (
        <p className="text-center text-xs text-muted-foreground">
          You&apos;ll be asked to sign in before the analysis starts.
        </p>
      )}
      </div>
    </form>
  );
}
