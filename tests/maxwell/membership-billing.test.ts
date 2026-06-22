/**
 * v3 membership billing M1 — pure unit coverage:
 *   - the flag defaults OFF (gated build),
 *   - the Stripe→wire status mapper,
 *   - the client-facing membership label mapper,
 *   - the outbound `membership-lifecycle` wire builder (incl. the 3 amendments),
 *   - the sanitized `membership` field on the project-status pull schema.
 */
import { describe, expect, it } from "vitest";
import {
  MEMBERSHIP_BILLING_ENABLED,
  MEMBERSHIP_INTERVAL,
  mapStripeSubscriptionStatusToWire,
} from "@/lib/maxwell/membership-billing";
import { mapMembershipStatusToMeta } from "@/lib/maxwell/project-status-labels";
import { buildMembershipLifecyclePayload } from "@/lib/noon-app-integration";
import { projectStatusDataSchema } from "@/lib/maxwell/project-status-types";

describe("membership-billing flag", () => {
  it("defaults OFF (gated build — flipped by the enablement PR)", () => {
    expect(MEMBERSHIP_BILLING_ENABLED).toBe(false);
  });

  it("bills monthly", () => {
    expect(MEMBERSHIP_INTERVAL).toBe("month");
  });
});

describe("mapStripeSubscriptionStatusToWire", () => {
  it("maps active/trialing → active", () => {
    expect(mapStripeSubscriptionStatusToWire("active")).toBe("active");
    expect(mapStripeSubscriptionStatusToWire("trialing")).toBe("active");
  });

  it("maps dunning/unpaid/incomplete/paused → past_due", () => {
    for (const s of ["past_due", "unpaid", "incomplete", "incomplete_expired", "paused"]) {
      expect(mapStripeSubscriptionStatusToWire(s)).toBe("past_due");
    }
  });

  it("maps canceled → cancelled", () => {
    expect(mapStripeSubscriptionStatusToWire("canceled")).toBe("cancelled");
  });

  it("defaults an unknown status to active (never a false suspension)", () => {
    expect(mapStripeSubscriptionStatusToWire("some_future_status")).toBe("active");
  });
});

describe("mapMembershipStatusToMeta", () => {
  it("maps each known status to a distinct label", () => {
    expect(mapMembershipStatusToMeta("active").label).toBe("Active");
    expect(mapMembershipStatusToMeta("past_due").label).toBe("Payment past due");
    expect(mapMembershipStatusToMeta("cancelled").label).toBe("Cancelling");
    expect(mapMembershipStatusToMeta("ended").label).toBe("Ended");
  });

  it("degrades an unknown status to a neutral chip (never empty)", () => {
    const meta = mapMembershipStatusToMeta("weird");
    expect(meta.label).toBe("Membership");
    expect(meta.color).toContain("border");
  });
});

describe("buildMembershipLifecyclePayload", () => {
  const base = {
    externalSessionId: "session-1",
    externalProposalId: "proposal-1",
    externalSubscriptionId: "sub_123",
    externalEventId: "evt_abc",
    eventKind: "renewed" as const,
    status: "active" as const,
    currentPeriodEnd: "2026-07-22T00:00:00.000Z",
    monthlyAmountUsd: 69,
    created: 1_700_000_000,
  };

  it("emits the co-signed snake_case shape with the 3 amendments", () => {
    const payload = buildMembershipLifecyclePayload(base);
    expect(payload).toEqual({
      external_source: "noon_website",
      external_session_id: "session-1",
      external_proposal_id: "proposal-1",
      external_subscription_id: "sub_123",
      // amendment 1 — explicit idempotency id (Stripe evt id).
      external_event_id: "evt_abc",
      membership: {
        event_kind: "renewed",
        status: "active",
        current_period_end: "2026-07-22T00:00:00.000Z",
        // amendment 3 — whole USD dollars, never Stripe minor units.
        monthly_amount_usd: 69,
        currency: "USD",
      },
      // amendment 2 — Stripe event ts for latest-wins ordering.
      created: 1_700_000_000,
    });
  });

  it("omits metadata when not provided, includes it when provided", () => {
    expect("metadata" in buildMembershipLifecyclePayload(base)).toBe(false);
    const withMeta = buildMembershipLifecyclePayload({ ...base, metadata: { stripe_event_type: "invoice.paid" } });
    expect(withMeta.metadata).toEqual({ stripe_event_type: "invoice.paid" });
  });

  it("carries a null current_period_end through unchanged", () => {
    const payload = buildMembershipLifecyclePayload({ ...base, currentPeriodEnd: null });
    expect(payload.membership.current_period_end).toBeNull();
  });
});

describe("project-status pull — sanitized membership field", () => {
  const valid = {
    project: { id: "p1", name: "Proj", status: "in_progress" },
    proposal: null,
    payment: { activated: true, status: "confirmed" },
    versions: [],
    latestUpdate: null,
    serverTime: "2026-06-22T00:00:00.000Z",
  };

  it("accepts a membership block and preserves it", () => {
    const parsed = projectStatusDataSchema.parse({
      ...valid,
      membership: { status: "active", monthlyAmountUsd: 69, currentPeriodEnd: "2026-07-22T00:00:00.000Z" },
    });
    expect(parsed.membership).toEqual({
      status: "active",
      monthlyAmountUsd: 69,
      currentPeriodEnd: "2026-07-22T00:00:00.000Z",
    });
  });

  it("parses fine when membership is absent (pre-M1 producer)", () => {
    const parsed = projectStatusDataSchema.parse(valid);
    expect(parsed.membership).toBeUndefined();
  });

  it("strips internal keys the App must never expose (§8.3 allowlist)", () => {
    const parsed = projectStatusDataSchema.parse({
      ...valid,
      membership: {
        status: "active",
        // These must NOT survive the allowlist parse.
        stripe_subscription_id: "sub_leak",
        earnings_usd: 9999,
      },
    });
    expect(parsed.membership).toEqual({ status: "active" });
    expect("stripe_subscription_id" in (parsed.membership ?? {})).toBe(false);
  });
});
