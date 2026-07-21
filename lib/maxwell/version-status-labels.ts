/**
 * lib/maxwell/version-status-labels.ts
 *
 * Client-facing presentation for the App's per-version `state` in the
 * project-status pull (v3 Fase 2 — versioning display, Slice 2a). NoonWeb owns
 * this copy (master-spec-v3 §8.1) — the App ships the raw client-visible state
 * and the portal maps it to a label / badge tone.
 *
 * The wire vocabulary is FROZEN cross-repo (co-signed 2026-06-18 — see
 * docs/2026-06-17-v3-fase2-versioning-publish-design.md §9.2): the App exposes a
 * positive allowlist of client-visible version states
 * (`ready_for_client_preview | published | previous_published | rolled_back`);
 * internal lifecycle values (`draft`, validation-failed, …) never cross.
 *
 * `mapVersionStateToMeta` degrades ANY unrecognised value to a neutral "Version"
 * label so a future state addition (or an internal value that ever slipped the
 * App allowlist) renders a safe chip instead of an empty/leaky one — the same
 * defensive default as `mapProjectStatusToMeta`.
 *
 * Pure module (no server-only imports) so it can be shared by Server Components
 * and any future client component.
 */

export type VersionStateMeta = {
  label: string;
  /** Badge tone (Tailwind classes), mirroring the workspace status palette. */
  tone: string;
  /** Solid dot color (Tailwind bg-*) for the compact "● label" status treatment. */
  dot: string;
};

const NEUTRAL_VERSION_META: VersionStateMeta = {
  label: "Version",
  tone: "border-border text-muted-foreground",
  dot: "bg-zinc-400",
};

const VERSION_STATE_META: Record<string, VersionStateMeta> = {
  ready_for_client_preview: {
    label: "Preview ready",
    tone: "border-blue-500/25 bg-blue-500/10 text-blue-700",
    dot: "bg-blue-500",
  },
  published: {
    label: "Published",
    tone: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700",
    dot: "bg-emerald-500",
  },
  previous_published: {
    label: "Previously published",
    tone: "border-zinc-500/25 bg-zinc-500/10 text-zinc-500",
    dot: "bg-zinc-400",
  },
  rolled_back: {
    label: "Rolled back",
    tone: "border-amber-500/25 bg-amber-500/10 text-amber-700",
    dot: "bg-amber-500",
  },
};

/** Map a raw client-visible version `state` to client-facing presentation. */
export function mapVersionStateToMeta(state: string): VersionStateMeta {
  return VERSION_STATE_META[state] ?? NEUTRAL_VERSION_META;
}

/**
 * Whether a version row should read as the live published one. Treats the
 * per-version `state` as canonical (the wire `published` boolean is a
 * convenience that the producer may omit — see project-status-types.ts).
 */
export function isPublishedVersion(version: { state: string; published?: boolean }): boolean {
  return version.state === "published" || version.published === true;
}

/**
 * Client-visible states from which a version may be (re)published (Slice 2b). Per
 * the frozen contract (Q-E): only validation-passed versions are publishable; a
 * `rolled_back` version may be re-published (it stays in history). The currently
 * `published` one is excluded (no self-publish), and any internal/unknown state
 * is excluded so we never offer Publish on something we can't reason about — the
 * App stays the final authority and rejects a non-publishable target server-side.
 */
const PUBLISHABLE_VERSION_STATES: ReadonlySet<string> = new Set([
  "ready_for_client_preview",
  "previous_published",
  "rolled_back",
]);

/** Whether NoonWeb should surface a Publish action for a version in this state. */
export function isPublishableVersionState(state: string): boolean {
  return PUBLISHABLE_VERSION_STATES.has(state);
}
