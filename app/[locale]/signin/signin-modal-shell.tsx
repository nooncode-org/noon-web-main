"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";

/**
 * Client wrapper for the sign-in modal. Renders the full-screen centering
 * layer and dismisses (navigates to `dismissHref`) when the user clicks the
 * empty space around the modal card, or presses Escape — the standard modal
 * affordance. Clicks on the card or its children do not dismiss (guarded by the
 * `target === currentTarget` check).
 */
export function SignInModalShell({
  children,
  dismissHref,
}: {
  children: ReactNode;
  dismissHref: string;
}) {
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") router.push(dismissHref);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [router, dismissHref]);

  function handleBackdropClick(event: MouseEvent<HTMLElement>) {
    if (event.target === event.currentTarget) router.push(dismissHref);
  }

  return (
    <main className="si-modal-wrap" onClick={handleBackdropClick}>
      {children}
    </main>
  );
}
