"use client";

import { useState } from "react";
import { MoreHorizontal, ExternalLink, Rocket, Send } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * VersionRowMenu — the per-version "…" menu on a version row. Consolidates every
 * row action behind ONE kebab on the right (replacing the stacked inline buttons):
 * Open preview + whichever management actions apply to THIS version's state. Every
 * row gets the same affordance; the menu just shows fewer items when fewer apply.
 *
 * Front only for now (logic later): Publish / Ask-to-make-live open a confirm
 * dialog that closes on confirm. At port time these wire to the real
 * submitVersionAction / submitRequestAction flows (see version-publish-button.tsx
 * / version-rollback-button.tsx). The confirm buttons carry an explicit brand-blue
 * bg — `.site-primary-action` never reaches the portaled AlertDialog.
 */
export function VersionRowMenu({
  versionSequence,
  previewUrl,
  canPublish,
  canRequestLive,
  publishAction,
  requestLiveAction,
}: {
  versionSequence: number;
  previewUrl?: string | null;
  canPublish: boolean;
  canRequestLive: boolean;
  /** Real publish (bound server action) — absent = the mock's front-only close. */
  publishAction?: () => Promise<{ ok: boolean; error?: string }>;
  /** Real make-it-live request (rollback path, staff authority) — same contract. */
  requestLiveAction?: () => Promise<{ ok: boolean; error?: string }>;
}) {
  const [publishOpen, setPublishOpen] = useState(false);
  const [liveOpen, setLiveOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // One confirm runner for both dialogs: pending while the action runs, close on
  // success (revalidatePath re-renders the row's new state), inline error on fail.
  async function runConfirm(
    action: (() => Promise<{ ok: boolean; error?: string }>) | undefined,
    close: () => void,
  ) {
    if (!action) {
      close();
      return;
    }
    if (pending) return;
    setPending(true);
    setError(null);
    const result = await action();
    setPending(false);
    if (result.ok) close();
    else setError(result.error ?? "Something went wrong — please try again.");
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Options for version ${versionSequence}`}
            className="shrink-0 rounded-[6px] p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground data-[state=open]:bg-secondary data-[state=open]:text-foreground"
          >
            <MoreHorizontal className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 rounded-[6px]">
          {previewUrl && (
            <DropdownMenuItem asChild>
              <a href={previewUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink strokeWidth={1.75} />
                Open preview
              </a>
            </DropdownMenuItem>
          )}
          {previewUrl && (canPublish || canRequestLive) && <DropdownMenuSeparator />}
          {canPublish && (
            <DropdownMenuItem onSelect={() => setPublishOpen(true)}>
              <Rocket strokeWidth={1.75} />
              Publish this version
            </DropdownMenuItem>
          )}
          {canRequestLive && (
            <DropdownMenuItem onSelect={() => setLiveOpen(true)}>
              <Send strokeWidth={1.75} />
              Ask the team to make this version live
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Publish confirm (front only — mirrors version-publish-button.tsx copy). */}
      <AlertDialog open={publishOpen} onOpenChange={setPublishOpen}>
        <AlertDialogContent className="rounded-[8px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Publish version {versionSequence}?</AlertDialogTitle>
            <AlertDialogDescription>
              It becomes the live version visible to the public at your domain.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && publishOpen && (
            <p role="alert" className="text-[12px] text-red-600">
              {error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-[6px]" disabled={pending}>
              Cancel
            </AlertDialogCancel>
            <button
              type="button"
              disabled={pending}
              onClick={() => runConfirm(publishAction, () => setPublishOpen(false))}
              className="inline-flex items-center justify-center rounded-[6px] bg-[#0056fd] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0047e0] disabled:pointer-events-none disabled:opacity-60"
            >
              {pending ? "Publishing…" : "Publish"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Ask-to-make-live confirm (front only — mirrors version-rollback-button.tsx). */}
      <AlertDialog open={liveOpen} onOpenChange={setLiveOpen}>
        <AlertDialogContent className="rounded-[8px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Make version {versionSequence} live?</AlertDialogTitle>
            <AlertDialogDescription>
              Your Noon team will review the request and make version {versionSequence} the
              live version. Nothing to do on your end.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && liveOpen && (
            <p role="alert" className="text-[12px] text-red-600">
              {error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-[6px]" disabled={pending}>
              Cancel
            </AlertDialogCancel>
            <button
              type="button"
              disabled={pending}
              onClick={() => runConfirm(requestLiveAction, () => setLiveOpen(false))}
              className="inline-flex items-center justify-center rounded-[6px] bg-[#0056fd] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0047e0] disabled:pointer-events-none disabled:opacity-60"
            >
              {pending ? "Sending…" : "Send request"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
