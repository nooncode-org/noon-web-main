/**
 * lib/maxwell/project-status-labels.ts
 *
 * Client-facing presentation for the App's raw `project_status` enum. NoonWeb
 * owns this copy (master-spec-v3 §8.1: "the client workspace lives inside the
 * website/client portal") — the App ships the raw enum value and the portal
 * maps it to a label / description / chip style.
 *
 * Enum source (verified against `App-nooncode` `database.types.ts`
 * `Enums.project_status`): backlog · in_progress · review · delivered ·
 * completed. `mapProjectStatusToMeta` degrades any unrecognised value to a
 * neutral "In progress" label so a future enum addition never renders an empty
 * chip — it shows a safe default until NoonWeb adds the mapping.
 *
 * The chip color classes mirror `lib/maxwell/workspace-status.ts` so the App
 * status chip is visually consistent with the local one it supersedes.
 */

export type ProjectStatusMeta = {
  label: string;
  description: string;
  color: string;
};

const NEUTRAL_META: ProjectStatusMeta = {
  label: "In progress",
  description: "Your project is moving through execution inside Noon.",
  color: "bg-blue-500/10 text-blue-600 border-blue-500/25",
};

const PROJECT_STATUS_META: Record<string, ProjectStatusMeta> = {
  backlog: {
    label: "Scheduled",
    description: "Your project is queued and kickoff prep is underway.",
    color: "bg-amber-500/10 text-amber-700 border-amber-500/25",
  },
  in_progress: {
    label: "In Development",
    description: "The Noon team is actively building the approved scope.",
    color: "bg-blue-500/10 text-blue-600 border-blue-500/25",
  },
  review: {
    label: "In Review",
    description: "Your project is in internal review and QA before delivery.",
    color: "bg-violet-500/10 text-violet-600 border-violet-500/25",
  },
  delivered: {
    label: "Delivered",
    description: "Your project has been delivered with the agreed materials.",
    color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/25",
  },
  completed: {
    label: "Completed",
    description: "This project is complete. Reach out any time for what's next.",
    color: "bg-zinc-500/10 text-zinc-500 border-zinc-500/25",
  },
};

/** Map a raw `project_status` enum value to client-facing presentation. */
export function mapProjectStatusToMeta(status: string): ProjectStatusMeta {
  return PROJECT_STATUS_META[status] ?? NEUTRAL_META;
}

/**
 * Client-facing presentation for the v3 membership state (M1). The App ships the
 * raw `membership.status` (active · past_due · cancelled · ended) in the
 * project-status pull; NoonWeb owns the label / description / chip style here
 * (§8.1). An unrecognised value degrades to a neutral "Membership" chip so a
 * future status never renders empty.
 */
const MEMBERSHIP_NEUTRAL_META: ProjectStatusMeta = {
  label: "Membership",
  description: "Your membership is active with Noon.",
  color: "bg-blue-500/10 text-blue-600 border-blue-500/25",
};

const MEMBERSHIP_STATUS_META: Record<string, ProjectStatusMeta> = {
  active: {
    label: "Active",
    description: "Your membership is active. Your monthly plan is up to date.",
    color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/25",
  },
  past_due: {
    label: "Payment past due",
    description: "We couldn't process your latest membership payment. Please update your payment method to keep your project active.",
    color: "bg-amber-500/10 text-amber-700 border-amber-500/25",
  },
  cancelled: {
    label: "Cancelling",
    description: "Your membership is set to end. You keep access until the end of the current period.",
    color: "bg-zinc-500/10 text-zinc-500 border-zinc-500/25",
  },
  ended: {
    label: "Ended",
    description: "Your membership has ended. Reach out any time to reactivate.",
    color: "bg-zinc-500/10 text-zinc-500 border-zinc-500/25",
  },
};

/** Map a raw membership status to client-facing presentation. */
export function mapMembershipStatusToMeta(status: string): ProjectStatusMeta {
  return MEMBERSHIP_STATUS_META[status] ?? MEMBERSHIP_NEUTRAL_META;
}

/**
 * Format the proposal amount + currency for the client. Mirrors the workspace's
 * existing minimalist copy — no thousands grouping surprises, currency code as
 * a suffix so non-USD reads cleanly (e.g. "1500 USD").
 */
export function formatProposalAmount(amount: number, currency: string): string {
  const safeCurrency = currency.trim().toUpperCase() || "USD";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: safeCurrency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    // Unknown/invalid currency code → fall back to "<amount> <CODE>".
    return `${Math.round(amount).toLocaleString("en-US")} ${safeCurrency}`;
  }
}
