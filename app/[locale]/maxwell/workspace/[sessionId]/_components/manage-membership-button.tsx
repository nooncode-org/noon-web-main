"use client";

/**
 * ManageMembershipButton — opens the Stripe Billing Portal so a membership client
 * can update their payment method or cancel (v3 membership billing M2 / Fase 6b).
 *
 * The server action returns a one-time portal URL; we redirect the browser to it.
 * Stripe hosts the management UI; on return the workspace re-renders with the
 * updated membership state (fed by the M1 webhook → App → project-status pull).
 */

import { useState, useTransition } from "react";
import { openBillingPortal } from "../_actions/open-billing-portal";

export function ManageMembershipButton({ sessionId }: { sessionId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await openBillingPortal({ sessionId });
      if (result.ok) {
        // Leave the site for Stripe's hosted portal.
        window.location.href = result.url;
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="inline-flex items-center gap-1.5 rounded-[6px] border border-border bg-secondary/30 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Opening…" : "Manage membership"}
      </button>
      {error && (
        <p className="mt-2 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
