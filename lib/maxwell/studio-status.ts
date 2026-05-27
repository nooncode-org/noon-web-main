import type { StudioStatus } from "./repositories";

export const STUDIO_STATUS_META: Record<StudioStatus, { label: string }> = {
  intake: { label: "Starting" },
  clarifying: { label: "Clarifying" },
  generating_prototype: { label: "Building prototype" },
  prototype_ready: { label: "Prototype ready" },
  revision_requested: { label: "Applying adjustment" },
  revision_applied: { label: "Adjustment applied" },
  prototype_shared: { label: "Shared with client" },
  approved_for_proposal: { label: "Approved for proposal" },
  proposal_pending_review: { label: "Proposal in review" },
  proposal_sent: { label: "Proposal sent" },
  converted: { label: "Converted" },
};

export function getStudioStatusLabel(status: StudioStatus | null | undefined): string {
  if (!status) {
    return "Unknown";
  }

  return STUDIO_STATUS_META[status]?.label ?? status.replaceAll("_", " ");
}
