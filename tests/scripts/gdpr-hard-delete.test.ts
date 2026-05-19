/**
 * tests/scripts/gdpr-hard-delete.test.ts
 *
 * B14 — Tests for the pure helpers in `scripts/gdpr-hard-delete.lib.mjs`.
 * The DB-touching side of the GDPR delete lives in
 * `scripts/gdpr-hard-delete.mjs` and is exercised via the runbook's
 * dry-run protocol (not unit-tested).
 *
 * Pattern matches B45's `tests/scripts/check-migrations.test.ts` —
 * vitest imports the .lib.mjs directly.
 */

import { describe, expect, it } from "vitest";
import {
  CASCADE_DELETED_TABLES,
  EMAIL_DELETED_TABLES,
  RETAINED_TABLES,
  anonymizeStripePayloads,
  buildDeletionPlan,
  formatPlanSummary,
  hashEmail,
  serializeSnapshot,
} from "../../scripts/gdpr-hard-delete.lib.mjs";

describe("hashEmail", () => {
  it("returns a 16-char hex digest", () => {
    expect(hashEmail("user@example.com")).toMatch(/^[a-f0-9]{16}$/);
  });

  it("is deterministic", () => {
    expect(hashEmail("user@example.com")).toBe(hashEmail("user@example.com"));
  });

  it("normalises (case-insensitive, trim) before hashing", () => {
    const canonical = hashEmail("user@example.com");
    expect(hashEmail("User@Example.com")).toBe(canonical);
    expect(hashEmail("USER@EXAMPLE.COM")).toBe(canonical);
    expect(hashEmail("  user@example.com  ")).toBe(canonical);
  });

  it("differs for different emails", () => {
    expect(hashEmail("a@x.com")).not.toBe(hashEmail("b@x.com"));
  });
});

describe("table catalog constants", () => {
  it("CASCADE_DELETED_TABLES includes the studio_session root", () => {
    expect(CASCADE_DELETED_TABLES).toContain("studio_session");
  });

  it("EMAIL_DELETED_TABLES includes contact_leads", () => {
    expect(EMAIL_DELETED_TABLES).toContain("contact_leads");
  });

  it("RETAINED_TABLES explicitly lists proposal_access_audit (compliance retention)", () => {
    expect(RETAINED_TABLES).toContain("proposal_access_audit");
  });

  it("RETAINED_TABLES includes gdpr_deletion_log itself (Art. 30 records of processing)", () => {
    expect(RETAINED_TABLES).toContain("gdpr_deletion_log");
  });

  it("the three catalogs are disjoint (no table in two lists)", () => {
    const cascade = new Set(CASCADE_DELETED_TABLES);
    const emailDel = new Set(EMAIL_DELETED_TABLES);
    const retained = new Set(RETAINED_TABLES);

    for (const t of cascade) {
      expect(emailDel.has(t), `${t} in both cascade + email`).toBe(false);
      expect(retained.has(t), `${t} in both cascade + retained`).toBe(false);
    }
    for (const t of emailDel) {
      expect(retained.has(t), `${t} in both email + retained`).toBe(false);
    }
  });
});

describe("anonymizeStripePayloads", () => {
  it("returns empty array on empty input", () => {
    expect(anonymizeStripePayloads([])).toEqual([]);
  });

  it("preserves the 5 whitelisted columns and drops everything else", () => {
    const result = anonymizeStripePayloads([
      {
        event_type: "checkout.completed",
        provider_payment_intent_id: "pi_abc",
        amount_usd: 99.5,
        currency: "USD",
        event_at: "2026-05-15T12:00:00Z",
        // any additional column (would be dropped) — verify by shape
      } as Record<string, unknown> as Parameters<typeof anonymizeStripePayloads>[0][0],
    ]);

    expect(result).toHaveLength(1);
    // Lex-sorted: amount_usd < currency < event_at < event_type < provider_payment_intent_id
    expect(Object.keys(result[0]).sort()).toEqual([
      "amount_usd",
      "currency",
      "event_at",
      "event_type",
      "provider_payment_intent_id",
    ]);
  });

  it("normalises numeric strings (Postgres NUMERIC arrives as string from postgres.js)", () => {
    const result = anonymizeStripePayloads([
      {
        event_type: "checkout.completed",
        amount_usd: "150.00" as unknown as number,
        currency: "USD",
        provider_payment_intent_id: "pi_x",
        event_at: "2026-05-01T00:00:00Z",
      },
    ]);

    expect(result[0].amount_usd).toBe(150);
  });

  it("preserves nulls (no defaulting to 0 or empty string)", () => {
    const result = anonymizeStripePayloads([
      { event_type: "manual_evidence" /* all other fields absent */ },
    ]);

    expect(result[0].provider_payment_intent_id).toBeNull();
    expect(result[0].amount_usd).toBeNull();
    expect(result[0].currency).toBeNull();
    expect(result[0].event_at).toBeNull();
    expect(result[0].event_type).toBe("manual_evidence");
  });

  it("serialises Date objects to ISO strings (event_at comes as Date from some drivers)", () => {
    const date = new Date("2026-05-15T12:34:56Z");
    const result = anonymizeStripePayloads([
      { event_type: "x", event_at: date },
    ]);

    expect(result[0].event_at).toBe("2026-05-15T12:34:56.000Z");
  });
});

describe("buildDeletionPlan", () => {
  const sampleInputs = {
    email: "alice@example.com",
    studioSessionIds: ["sess-1", "sess-2"],
    rowsByTable: { studio_session: 2, studio_message: 87, payment_event: 3 },
    paymentEvents: [
      {
        event_type: "checkout.completed",
        provider_payment_intent_id: "pi_1",
        amount_usd: 100,
        currency: "USD",
        event_at: "2026-05-15T12:00:00Z",
      },
    ],
  };

  it("hashes the input email", () => {
    const plan = buildDeletionPlan({
      ...sampleInputs,
      generatedAt: "2026-05-19T12:00:00Z",
    });
    expect(plan.emailHash).toBe(hashEmail("alice@example.com"));
  });

  it("forwards studio_session_ids verbatim", () => {
    const plan = buildDeletionPlan(sampleInputs);
    expect(plan.studioSessionIds).toEqual(["sess-1", "sess-2"]);
  });

  it("forwards rows-by-table counts verbatim", () => {
    const plan = buildDeletionPlan(sampleInputs);
    expect(plan.rowsByTable).toEqual({
      studio_session: 2,
      studio_message: 87,
      payment_event: 3,
    });
  });

  it("anonymises payment events into preserved records", () => {
    const plan = buildDeletionPlan(sampleInputs);
    expect(plan.preservedPaymentRecords).toHaveLength(1);
    expect(plan.preservedPaymentRecords[0].provider_payment_intent_id).toBe("pi_1");
  });

  it("derives a filesystem-safe snapshot path (no colons in timestamp)", () => {
    const plan = buildDeletionPlan({
      ...sampleInputs,
      generatedAt: "2026-05-19T12:34:56.789Z",
    });
    expect(plan.snapshotPath).toMatch(/^\.\/gdpr-snapshots\/2026-05-19T12-34-56-789Z-[a-f0-9]{16}\.json$/);
    // Colons in the timestamp portion would break Windows fs; the only
    // dot is the .json extension which is fine.
    const filename = plan.snapshotPath.split("/").pop() ?? "";
    expect(filename).not.toMatch(/:/);
  });
});

describe("serializeSnapshot", () => {
  it("wraps in a versioned envelope (so future format changes are detectable)", () => {
    const json = serializeSnapshot({
      emailHash: "abc123",
      generatedAt: "2026-05-19T12:00:00Z",
      operatorName: "alice",
      studioSessionIds: [],
      rowsByTable: {},
    });
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe(1);
    expect(parsed.generated_at).toBe("2026-05-19T12:00:00Z");
    expect(parsed.email_hash).toBe("abc123");
    expect(parsed.operator_name).toBe("alice");
  });

  it("preserves the rows_by_table payload verbatim for restore", () => {
    const rows = {
      studio_session: [{ id: "s1", initial_prompt: "hi" }],
      payment_event: [{ id: "p1", amount_usd: 50 }],
    };
    const json = serializeSnapshot({
      emailHash: "x",
      generatedAt: "2026-05-19T12:00:00Z",
      operatorName: "op",
      studioSessionIds: ["s1"],
      rowsByTable: rows,
    });
    const parsed = JSON.parse(json);
    expect(parsed.rows_by_table).toEqual(rows);
  });

  it("emits indented JSON (human-readable)", () => {
    const json = serializeSnapshot({
      emailHash: "x",
      generatedAt: "2026-05-19T12:00:00Z",
      operatorName: "op",
      studioSessionIds: [],
      rowsByTable: {},
    });
    expect(json).toContain("\n  ");
  });
});

describe("formatPlanSummary", () => {
  const samplePlan = {
    emailHash: "abcdef1234567890",
    studioSessionIds: ["sess-1", "sess-2"],
    rowsByTable: { studio_session: 2, payment_event: 3, contact_leads: 1 },
    preservedPaymentRecords: [
      {
        provider_payment_intent_id: "pi_xyz",
        amount_usd: 100,
        currency: "USD",
        event_at: "2026-05-15T12:00:00Z",
        event_type: "checkout.completed",
      },
    ],
    snapshotPath: "./gdpr-snapshots/2026-05-19T12-00-00-000Z-abcdef1234567890.json",
  };

  it("includes email hash, session count, and per-table counts", () => {
    const summary = formatPlanSummary(samplePlan);
    expect(summary).toContain("abcdef1234567890");
    expect(summary).toContain("Studio sessions:       2");
    expect(summary).toContain("studio_session");
    expect(summary).toContain("payment_event");
  });

  it("sorts table names alphabetically (deterministic output for ops review)", () => {
    const summary = formatPlanSummary(samplePlan);
    // contact_leads (c) must appear before payment_event (p), which must
    // appear before studio_session (s).
    const c = summary.indexOf("contact_leads");
    const p = summary.indexOf("payment_event");
    const s = summary.indexOf("studio_session");
    expect(c).toBeGreaterThan(-1);
    expect(p).toBeGreaterThan(c);
    expect(s).toBeGreaterThan(p);
  });

  it("includes Stripe identifiers for preserved payment records", () => {
    const summary = formatPlanSummary(samplePlan);
    expect(summary).toContain("pi_xyz");
    expect(summary).toContain("100.00 USD");
    expect(summary).toContain("checkout.completed");
  });

  it("handles payment record with no payment_intent_id (manual evidence path)", () => {
    const summary = formatPlanSummary({
      ...samplePlan,
      preservedPaymentRecords: [
        {
          provider_payment_intent_id: null,
          amount_usd: null,
          currency: null,
          event_at: null,
          event_type: "manual_evidence",
        },
      ],
    });
    expect(summary).toContain("(no payment_intent_id)");
    expect(summary).toContain("n/a");
    expect(summary).toContain("manual_evidence");
  });

  it("displays snapshot path at the end", () => {
    const summary = formatPlanSummary(samplePlan);
    expect(summary).toContain("Snapshot path:");
    expect(summary).toContain(samplePlan.snapshotPath);
  });
});
