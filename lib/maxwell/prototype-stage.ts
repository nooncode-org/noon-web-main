/**
 * lib/maxwell/prototype-stage.ts
 *
 * The REAL stage of a prototype generation, as the poll endpoint actually knows
 * it — plus the pure helpers the chat's activity trace renders from.
 *
 * **Why this exists.** `/api/maxwell/prototype/poll` distinguishes several
 * genuinely different situations and then collapses every one of them into a
 * single `status: "pending"`. The client, having no way to tell them apart, fell
 * back to guessing from the clock (`polling-progress.ts` picks its line purely
 * from elapsed seconds) while the chat rendered three hardcoded steps whose
 * "progress" was `index < 1` — step one always ticked, steps two and three span
 * forever, no matter what was happening. Real information existed; it was thrown
 * away at the API boundary and replaced with theatre.
 *
 * This module is the vocabulary that carries it across instead. Pure (no I/O, no
 * React), like `polling-progress.ts` and `preview-load-state.ts`.
 *
 * **The stages, and the server condition each one means:**
 *   - `generating`  — v0 reports the version still pending: it is writing code.
 *   - `assembling`  — v0 says completed, but its output has not settled: either
 *     the source imports files it never emitted (`findMissingLocalImports`) or
 *     the version signature keeps changing between polls. Two server checks, one
 *     user-facing truth ("it says done, it isn't"), so they share a stage —
 *     splitting them would surface plumbing the client can't act on.
 *   - `publishing`  — code is settled; the preview URL is not serving HTML yet
 *     (the deployment is warming up), or an update is still serving the old one.
 *   - `ready`       — a version was committed.
 *
 * **Ordering caveat (deliberate).** The steps render in the canonical order
 * below and status is derived from the CURRENT stage — there is no high-water
 * mark. v0 can regress (it re-generates a version after we thought it settled),
 * and when it does the trace regresses with it. A latched "everything before
 * stays ✓" would read smoother while quietly claiming work that came undone;
 * showing the truth is the point of this module.
 */

/**
 * Wire value emitted by the poll endpoint on every response — plus the two
 * Fase A stages that happen BEFORE v0 is even called (docs/maxwell/
 * fase-a-spec.md §2: "cocina a la vista; jamás un spinner mudo"). Those two
 * are set by the client while the generation request is in flight, since
 * the study runs inside that request and the poll never observes it.
 */
export type PrototypeStage =
  | "studying"
  | "gathering"
  | "generating"
  | "assembling"
  | "publishing"
  | "ready";

/**
 * Canonical order the trace renders in. Also the order the server reaches them
 * in for a clean run — `generating` is strictly first (the v0-pending check
 * returns before any other), and `ready` only after a version is committed.
 */
export const PROTOTYPE_STAGE_ORDER: readonly PrototypeStage[] = [
  "studying",
  "gathering",
  "generating",
  "assembling",
  "publishing",
  "ready",
] as const;

/** Runtime guard for the wire value — the client must not trust the payload. */
export function isPrototypeStage(value: unknown): value is PrototypeStage {
  return (
    typeof value === "string" &&
    (PROTOTYPE_STAGE_ORDER as readonly string[]).includes(value)
  );
}

/**
 * User-facing label per stage. Present tense while running: these describe what
 * is happening right now, not a promise about when it ends. No stage claims an
 * ETA — v0's duration is not predictable, so the trace shows elapsed time only.
 */
export function prototypeStageLabel(stage: PrototypeStage): string {
  switch (stage) {
    case "studying":
      return "Studying design references";
    case "gathering":
      return "Preparing visual resources";
    case "generating":
      return "Generating your prototype";
    case "assembling":
      return "Assembling the files";
    case "publishing":
      return "Publishing the preview";
    case "ready":
      return "Preview ready";
  }
}

/**
 * One line of context under the active step, explaining the wait in the client's
 * terms. Only used for the stage in progress — a finished step needs no excuse.
 */
export function prototypeStageDetail(stage: PrototypeStage): string {
  switch (stage) {
    case "studying":
      return "Measuring the references that fit your project, down to the detail.";
    case "gathering":
      return "Finding real photography and content that match your business.";
    case "generating":
      return "Writing the code for your first interactive version.";
    case "assembling":
      return "The build reported done — waiting for the last files to land.";
    case "publishing":
      return "Bringing the preview online. This is usually the quickest part.";
    case "ready":
      return "Your prototype is live in the preview panel.";
  }
}

export type StepStatus = "done" | "active" | "pending";

/**
 * Status of `step` given the stage the run is currently in. Strictly positional
 * against {@link PROTOTYPE_STAGE_ORDER}: earlier = done, equal = active, later =
 * pending. `ready` is the terminal stage, so it reports `done` rather than
 * spinning on itself once reached.
 */
export function prototypeStepStatus(
  step: PrototypeStage,
  current: PrototypeStage,
): StepStatus {
  const stepIndex = PROTOTYPE_STAGE_ORDER.indexOf(step);
  const currentIndex = PROTOTYPE_STAGE_ORDER.indexOf(current);
  if (stepIndex < currentIndex) return "done";
  if (stepIndex > currentIndex) return "pending";
  return current === "ready" ? "done" : "active";
}
