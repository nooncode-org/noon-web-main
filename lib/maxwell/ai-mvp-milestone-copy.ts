/**
 * lib/maxwell/ai-mvp-milestone-copy.ts
 *
 * Client-facing copy for App's post-payment AI MVP pipeline milestones, derived
 * from the milestone `kind` ALONE (handoff §2/§3, master-spec §19.3). NoonWeb
 * never surfaces pipeline internals — only these three fixed strings keyed by
 * kind, plus the `version_url` carried on `version-ready`.
 *
 * Kept as a tiny pure module so the mapping is unit-tested and shared between
 * the workspace page and any future surface (email, dashboard).
 */

import type { AiMvpMilestone, AiMvpMilestoneKind } from "@/lib/maxwell/repositories";

export type AiMvpMilestoneCopy = {
  /** Short status chip / heading. */
  label: string;
  /** One-line description shown under the heading. */
  description: string;
};

/** §19.3 client copy. Exhaustive over AiMvpMilestoneKind (compiler-enforced). */
export const AI_MVP_MILESTONE_COPY: Record<AiMvpMilestoneKind, AiMvpMilestoneCopy> = {
  started: {
    label: "Preparing your first version",
    description:
      "Our system is building the first version of your project. This usually takes a few minutes — you can leave this page and come back.",
  },
  "version-ready": {
    label: "First version available",
    description:
      "The first version of your project is ready to preview.",
  },
  escalated: {
    label: "Our team is preparing your project",
    description:
      "Our team is putting the finishing touches on your project and will update you here shortly.",
  },
};

/**
 * Pick the milestone to show the client from the full set for a project.
 *
 * `getAiMvpMilestonesByProjectId` returns newest-first, so the most recent
 * transition is the current status — that is what we render. Returns null when
 * there are no milestones yet (the page renders no banner).
 *
 * A defensive guard drops any milestone whose kind we don't have copy for
 * (forward-compat: an App-side kind added before NoonWeb ships copy degrades to
 * "no banner" instead of a crash).
 */
export function pickCurrentMilestone(
  milestones: AiMvpMilestone[],
): AiMvpMilestone | null {
  for (const milestone of milestones) {
    if (milestone.kind in AI_MVP_MILESTONE_COPY) return milestone;
  }
  return null;
}
