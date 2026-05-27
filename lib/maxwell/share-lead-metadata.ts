/**
 * lib/maxwell/share-lead-metadata.ts
 *
 * Pure helper that builds the `metadata` block of the `prototype-share` wire
 * payload (ADR-028 D2 left this field open as `Record<string, unknown>`).
 *
 * Purpose: bring the lead-enrichment parity that `inbound-proposal` already
 * had into the share flow. App-side `receiveWebsiteInboundProposal` reads
 * `metadata.score` (via `readInboundScore` with default 80) and
 * `metadata.amount` to populate `leads.score` + `leads.value` at insert
 * time. The share-flow handler (`insertFreshLeadForShare`) needs the same
 * shape to set those columns instead of leaving them at the DB defaults.
 *
 * See `archivos-pedro/noon-web/sessions/2026-05-27-handoff-piedra-smoke-findings.md`
 * section "Follow-up slice — paridad de lead enrichment" for the full
 * cross-repo spec.
 *
 * **Why score = 80 as a constant.** App's `readInboundScore` falls back to
 * 80 when `metadata.score` is missing. Web's `buildWebsiteProposalPayload`
 * never sends a score for `inbound-proposal` either, so today every
 * inbound-Maxwell lead in production gets `leads.score = 80`. Sending the
 * literal 80 from share keeps the share flow visibly symmetrical without
 * inventing a Maxwell-scoring model — a real scoring is its own slice when
 * the product has the model defined.
 *
 * The amount uses the same source the legacy flow uses
 * (`resolveProposalCommercialProfile().pricing.activation`) so a single
 * lead that touches both flows lands the same number in `leads.value`.
 *
 * No I/O, no env reads — pure function so it stays trivially testable.
 */

import type { StudioSession } from "./repositories";
import {
  resolveProposalCommercialProfile,
  type ProjectCategory,
  type ComplexityTier,
} from "./proposal-rules";

/**
 * Score that lands on `leads.score` when the share-flow handler inserts a
 * fresh prospect lead. Matches the fallback `readInboundScore` uses on
 * App-side (`Math.max(0, Math.min(100, Math.round(rawScore))) || 80`).
 */
export const SHARE_LEAD_BASELINE_SCORE = 80;

/**
 * Wire-side shape of the enrichment metadata. App's handler reads:
 *  - `metadata.score` via `readInboundScore`
 *  - `metadata.amount` via `Number(payload.metadata?.amount ?? 0)`
 *
 * The rest is informational — App today does not consume the pricing
 * category / tier / membership flag for share-flow leads, but mirroring
 * what the legacy proposal payload already exposes keeps both inbound
 * paths visually identical for anyone reading the wire body or the App
 * `website_webhook_events.payload_hash` audit trail.
 */
export type ShareLeadMetadata = {
  score: number;
  amount: number;
  pricing_category: ProjectCategory;
  pricing_tier: ComplexityTier;
  membership_recommended: boolean;
};

/**
 * Pure parser that converts a `PRICING_TABLE` activation string
 * (e.g. `"$1200 USD"` or `"$1,200"`) into a numeric USD amount. Matches
 * the contract of the private `parseUsdAmount` in
 * `lib/noon-app-integration.ts:293` that the legacy flow uses; kept local
 * to avoid promoting that private helper through an export chain just for
 * one call site. If a future refactor consolidates the two, this can be
 * removed.
 */
export function parseActivationAmountUsd(value: string): number {
  if (!value) return 0;
  const normalized = value.replace(/,/g, "");
  const match = normalized.match(/\$?\s*(\d+(?:\.\d+)?)/);
  if (!match) return 0;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Build the share-flow `metadata` block from a studio session.
 *
 * Caller is the share Server Action; pass `session` straight from
 * `getStudioSession(sessionId)`. The return value is spread directly into
 * the `metadata` field of the `requestPrototipoShare` input.
 */
export function buildShareLeadMetadata(session: StudioSession): ShareLeadMetadata {
  const profile = resolveProposalCommercialProfile(session);
  return {
    score: SHARE_LEAD_BASELINE_SCORE,
    amount: parseActivationAmountUsd(profile.pricing.activation),
    pricing_category: profile.category,
    pricing_tier: profile.tier,
    membership_recommended: profile.membershipRecommended,
  };
}
