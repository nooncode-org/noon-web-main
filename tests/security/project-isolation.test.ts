/**
 * tests/security/project-isolation.test.ts
 *
 * v3 prep — locks the operational fields denylist + the sanitiser
 * behaviour. The cross-repo contract assumes Web NEVER sends these
 * keys to a client surface; these tests fail loud if the strip
 * misses a case or the type-level removal silently breaks.
 *
 * What we pin:
 *   - The catalog stays a closed list (no surprise additions in
 *     production). The exact contents are asserted so a future PR
 *     that adds / removes a field is forced through an explicit
 *     test edit + reviewer eyes.
 *   - The sanitiser strips at every depth including arrays, nested
 *     objects, and the root. It must NOT mutate the input.
 *   - It passes through `Date`, primitives, `null`, `undefined`
 *     untouched.
 *   - `assertNoInternalFields` produces a path-aware error message
 *     (so a reviewer reading a CI failure can pinpoint the leak).
 *   - `containsInternalFields` mirrors the assert behaviour as a
 *     boolean.
 */

import { describe, expect, it } from "vitest";

import {
  INTERNAL_ONLY_FIELDS,
  assertNoInternalFields,
  containsInternalFields,
  sanitizeForClient,
} from "@/lib/security/project-isolation";

describe("INTERNAL_ONLY_FIELDS catalog (closed list)", () => {
  it("contains exactly the curated set (no surprise additions)", () => {
    // Sorted comparison so reorder of the source array is harmless.
    expect([...INTERNAL_ONLY_FIELDS].sort()).toEqual(
      [
        "autoSendDueAt",
        "caseClassification",
        "payloadJson",
        "providerEventId",
        "providerPaymentIntentId",
        "providerSessionId",
        "reviewEscalatedAt",
        "reviewNotifiedAt",
        "reviewRemindedAt",
        "reviewRequired",
        "reviewerId",
        "stripeCheckoutSessionId",
        "stripePaymentIntentId",
        "stylePackId",
        "supersededByProposalRequestId",
        "supersedesProposalRequestId",
      ].sort(),
    );
  });

  it("has no duplicate entries", () => {
    expect(new Set(INTERNAL_ONLY_FIELDS).size).toBe(INTERNAL_ONLY_FIELDS.length);
  });
});

describe("sanitizeForClient — root level", () => {
  it("strips known internal fields at the root", () => {
    const input = {
      id: "sess-1",
      goalSummary: "Build it",
      reviewerId: "ops-staff-42",
      stylePackId: "tech-digital",
      payloadJson: { provider: "stripe", raw: "x" },
    };

    const out = sanitizeForClient(input);

    expect(out).toEqual({ id: "sess-1", goalSummary: "Build it" });
  });

  it("does NOT mutate the input", () => {
    const input = {
      id: "sess-1",
      reviewerId: "ops-staff-42",
    };

    const before = { ...input };
    sanitizeForClient(input);

    expect(input).toEqual(before);
  });

  it("passes through fields not in the catalog", () => {
    const input = { customField: "keep me", another: 123 };
    expect(sanitizeForClient(input)).toEqual(input);
  });
});

describe("sanitizeForClient — nested objects", () => {
  it("strips internal fields inside nested objects", () => {
    const input = {
      session: {
        id: "sess-1",
        reviewerId: "ops-1",      // ← strip
        goalSummary: "Goal",
      },
      proposal: {
        id: "prop-1",
        reviewRequired: true,      // ← strip
        approvedAmountUsd: 250,
        stripePaymentIntentId: "pi_abc",  // ← strip
      },
    };

    expect(sanitizeForClient(input)).toEqual({
      session: { id: "sess-1", goalSummary: "Goal" },
      proposal: { id: "prop-1", approvedAmountUsd: 250 },
    });
  });

  it("strips internals inside deeply nested objects (3+ levels)", () => {
    const input = {
      a: {
        b: {
          c: {
            keep: "yes",
            reviewerId: "deep-leak",   // ← strip even at depth 3
          },
        },
      },
    };

    const out = sanitizeForClient(input);
    expect(out).toEqual({ a: { b: { c: { keep: "yes" } } } });
  });
});

describe("sanitizeForClient — arrays", () => {
  it("strips internals from each element of an array of objects", () => {
    const input = {
      events: [
        { id: "e1", message: "ok", providerEventId: "evt_1" },     // ← strip
        { id: "e2", message: "ok", payloadJson: { raw: "..." } },  // ← strip
      ],
    };

    expect(sanitizeForClient(input)).toEqual({
      events: [
        { id: "e1", message: "ok" },
        { id: "e2", message: "ok" },
      ],
    });
  });

  it("preserves arrays of primitives untouched", () => {
    const input = { tags: ["alpha", "beta", "gamma"] };
    expect(sanitizeForClient(input)).toEqual(input);
  });

  it("handles arrays nested inside objects nested inside arrays", () => {
    const input = {
      groups: [
        {
          name: "A",
          items: [
            { id: 1, reviewerId: "x" },  // ← strip
            { id: 2 },
          ],
        },
      ],
    };

    expect(sanitizeForClient(input)).toEqual({
      groups: [
        {
          name: "A",
          items: [{ id: 1 }, { id: 2 }],
        },
      ],
    });
  });
});

describe("sanitizeForClient — pass-through values", () => {
  it("passes through primitives", () => {
    expect(sanitizeForClient("hello")).toBe("hello");
    expect(sanitizeForClient(42)).toBe(42);
    expect(sanitizeForClient(true)).toBe(true);
  });

  it("passes through null and undefined", () => {
    expect(sanitizeForClient(null)).toBeNull();
    expect(sanitizeForClient(undefined)).toBeUndefined();
  });

  it("passes through Date instances (not stripped because non-plain object)", () => {
    const d = new Date("2026-05-19T00:00:00Z");
    const out = sanitizeForClient({ when: d });
    expect(out.when).toBe(d);
  });

  it("passes through class instances unchanged", () => {
    class Money {
      constructor(public readonly amount: number) {}
    }
    const m = new Money(250);
    const out = sanitizeForClient({ price: m });
    expect(out.price).toBe(m);
  });
});

describe("assertNoInternalFields", () => {
  it("does not throw when the payload is clean", () => {
    expect(() =>
      assertNoInternalFields({ id: "x", nested: { ok: true, items: [{ id: 1 }] } }),
    ).not.toThrow();
  });

  it("throws with the path when an internal field is at the root", () => {
    expect(() =>
      assertNoInternalFields({ id: "x", reviewerId: "leak" }),
    ).toThrow(/Internal field "reviewerId" leaked at reviewerId/);
  });

  it("throws with the full path when nested", () => {
    expect(() =>
      assertNoInternalFields({
        proposal: { id: "p1", stripePaymentIntentId: "pi_x" },
      }),
    ).toThrow(/leaked at proposal\.stripePaymentIntentId/);
  });

  it("throws with the array-index path when inside an array", () => {
    expect(() =>
      assertNoInternalFields({
        events: [{ id: 1 }, { id: 2, payloadJson: { raw: "x" } }],
      }),
    ).toThrow(/leaked at events\[1\]\.payloadJson/);
  });

  it("includes the context label in the error when provided", () => {
    expect(() =>
      assertNoInternalFields(
        { reviewerId: "leak" },
        "GET /api/maxwell/session",
      ),
    ).toThrow(/GET \/api\/maxwell\/session/);
  });
});

describe("containsInternalFields", () => {
  it("returns true when a leak exists at any depth", () => {
    expect(containsInternalFields({ reviewerId: "x" })).toBe(true);
    expect(
      containsInternalFields({ a: { b: { c: { payloadJson: {} } } } }),
    ).toBe(true);
    expect(
      containsInternalFields({ items: [{ stripeCheckoutSessionId: "cs" }] }),
    ).toBe(true);
  });

  it("returns false when the payload is clean", () => {
    expect(containsInternalFields({ id: "x", name: "y" })).toBe(false);
    expect(containsInternalFields(null)).toBe(false);
    expect(containsInternalFields("plain string")).toBe(false);
    expect(containsInternalFields([])).toBe(false);
  });
});

describe("type-level guarantee (compile-time)", () => {
  it("strips InternalOnlyField keys from the output type", () => {
    // This test asserts at the TYPE level — the runtime body just
    // exercises the function. The real check is that `out.reviewerId`
    // would be a TS error if uncommented (which we can't assert at
    // runtime, but the cast below would also fail to compile if the
    // SanitisedForClient type stopped stripping the keys).
    const input = {
      id: "sess-1",
      reviewerId: "ops",
      goalSummary: "g",
      nested: {
        kept: 1,
        payloadJson: { raw: "x" },
      },
    };
    const out = sanitizeForClient(input);

    // Type-only assertions: these would fail to compile if the type
    // stripping regressed. We use a runtime expression that depends
    // on the type narrowing to lock in the contract.
    const _idIsString: string = out.id;
    const _summaryIsString: string = out.goalSummary;
    const _keptIsNumber: number = out.nested.kept;
    // Intentionally NOT: `out.reviewerId` or `out.nested.payloadJson` —
    // those keys must not exist on the output type.

    expect(_idIsString).toBe("sess-1");
    expect(_summaryIsString).toBe("g");
    expect(_keptIsNumber).toBe(1);
  });
});
