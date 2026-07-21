"use client";

import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
 * DomainRowMenu — the per-row "…" menu for a CUSTOM domain (never the default
 * nooncode.dev one). Its one action, "Disconnect domain", opens a confirm dialog:
 * disconnecting takes the client's site offline at that address, so it needs a
 * deliberate yes. In our model the Noon team does the actual disconnection, so
 * this creates a request (front only for now — logic later).
 *
 * The confirm button is explicit red (destructive), not `.site-primary-action`:
 * the alert portals outside `.mxw-rd` where that override never lands.
 */
export function DomainRowMenu({ domain }: { domain: string }) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  function disconnect() {
    // TODO(logic later): create a "disconnect domain" request to the Noon team.
    setConfirmOpen(false);
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Options for ${domain}`}
            className="shrink-0 rounded-[6px] p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground data-[state=open]:bg-secondary data-[state=open]:text-foreground"
          >
            <MoreHorizontal className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="rounded-[6px]">
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirmOpen(true)}>
            Disconnect domain
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="rounded-[8px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect this domain?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-mono text-foreground">{domain}</span> will stop serving your
              product at that address. Your Noon team handles the disconnection — nothing to do
              on your end.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-[6px]">Cancel</AlertDialogCancel>
            {/* Plain red button, NOT AlertDialogAction: the latter's buttonVariants
                default is `.site-primary-action` (blue, !important) which would
                override any bg set here. disconnect() closes via state. */}
            <button
              type="button"
              onClick={disconnect}
              className="inline-flex items-center justify-center rounded-[6px] bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
            >
              Disconnect
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
