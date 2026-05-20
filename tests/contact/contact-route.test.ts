/**
 * tests/contact/contact-route.test.ts
 *
 * Route-handler coverage for `POST /api/contact` — the public
 * contact-form intake. Distinct from `tests/contact/contact-abuse.test.ts`
 * which covers the underlying helpers in `lib/server/contact-abuse`.
 *
 * Why this gap is meaningful: contact is the most-public endpoint in
 * the app (no auth), so the route-level orchestration of
 *   schema validation → abuse assessment → storage → response
 * deserves a regression net of its own.
 *
 * Mocked:
 *   - `assessContactSubmission` (returns one of: accept / accept_ignored /
 *     block — covers honeypot + rate-limit + heuristics)
 *   - `saveContactLead` (persists the lead row)
 *
 * Schema (`contactSubmissionRequestSchema` from lib/contact) runs real
 * so a future field rename surfaces here.
 *
 * Coverage matrix:
 *   - Happy path → 201 with { success, lead: { id, inquiry, createdAt } }
 *   - Honeypot triggers `accept_ignored` → 202 with lead=null (the
 *     attacker thinks they got through, ops sees nothing in inbox)
 *   - Rate-limit triggers `block` → 429 with Retry-After header +
 *     message body
 *   - Schema invalid (missing required field) → 400 with fieldErrors
 *   - Schema invalid (inquiry / contactType mismatch via superRefine)
 *     → 400 with fieldErrors.inquiry
 *   - saveContactLead throws → 500 with friendly message that
 *     surfaces the contactInbox fallback
 *   - Cache-Control: no-store on EVERY response (no caching of any
 *     contact-form interaction)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/server/contact-abuse", () => ({
  assessContactSubmission: vi.fn(),
}));

vi.mock("@/lib/server/noon-storage", () => ({
  saveContactLead: vi.fn(),
}));

vi.mock("@/lib/server/logger", () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import * as abuse from "@/lib/server/contact-abuse";
import * as storage from "@/lib/server/noon-storage";
import { POST } from "@/app/api/contact/route";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ROUTE = "http://localhost/api/contact";

/**
 * Minimal valid payload. `inquiry: "general"` + `contactType: "general"`
 * passes the superRefine routing check (general inquiries are allowed
 * under the general contact type).
 */
function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    inquiry: "general",
    contactType: "general",
    name: "Alex Owner",
    email: "alex@example.com",
    brief: "Hi, I have a quick question about your services.",
    ...overrides,
  };
}

function postReq(body: unknown) {
  return new Request(ROUTE, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: abuse assessor allows (the "happy" outcome — note it's
  // "allow", not "accept"; the route only branches on "accept_ignored"
  // and "block" so any other value falls through to save+201).
  vi.mocked(abuse.assessContactSubmission).mockResolvedValue({
    outcome: "allow",
    metadata: {
      ipHash: "ipHash",
      userAgent: "vitest",
      originHost: null,
    } as never,
  });

  vi.mocked(storage.saveContactLead).mockResolvedValue({
    id: "lead-1",
    inquiry: "general",
    contactType: "general",
    name: "Alex Owner",
    email: "alex@example.com",
    brief: "Hi, I have a quick question about your services.",
    budget: null,
    timeline: null,
    source: null,
    ipHash: "ipHash",
    userAgent: "vitest",
    originHost: null,
    status: "new",
    createdAt: "2026-05-19T00:00:00.000Z",
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe("POST /api/contact — happy path", () => {
  it("returns 201 with the persisted lead summary", async () => {
    const res = await POST(postReq(validPayload()));
    expect(res.status).toBe(201);

    const body = (await res.json()) as {
      success: boolean;
      lead: { id: string; inquiry: string; createdAt: string };
    };
    expect(body.success).toBe(true);
    expect(body.lead).toEqual({
      id: "lead-1",
      inquiry: "general",
      createdAt: "2026-05-19T00:00:00.000Z",
    });

    // Cache-Control prevents any browser/CDN caching of the response.
    expect(res.headers.get("cache-control")).toBe("no-store");

    // Abuse assessor + storage were both called once.
    expect(abuse.assessContactSubmission).toHaveBeenCalledTimes(1);
    expect(storage.saveContactLead).toHaveBeenCalledTimes(1);
  });

  it("forwards the abuse-assessment metadata to saveContactLead", async () => {
    await POST(postReq(validPayload()));

    expect(storage.saveContactLead).toHaveBeenCalledWith(
      expect.objectContaining({
        inquiry: "general",
        contactType: "general",
        name: "Alex Owner",
        email: "alex@example.com",
      }),
      expect.objectContaining({ ipHash: "ipHash" }),
    );
  });
});

// ---------------------------------------------------------------------------
// Abuse assessor outcomes
// ---------------------------------------------------------------------------

describe("POST /api/contact — abuse outcomes", () => {
  it("returns 202 (accept_ignored) when the honeypot triggers — silent drop", async () => {
    vi.mocked(abuse.assessContactSubmission).mockResolvedValue({
      outcome: "accept_ignored",
      reason: "honeypot",
    });

    const res = await POST(postReq(validPayload()));
    expect(res.status).toBe(202);

    const body = (await res.json()) as { success: boolean; lead: unknown };
    // Critical: attacker sees success, but no lead is persisted.
    expect(body.success).toBe(true);
    expect(body.lead).toBeNull();
    expect(storage.saveContactLead).not.toHaveBeenCalled();
  });

  it("returns 429 with Retry-After when rate-limited (block outcome)", async () => {
    vi.mocked(abuse.assessContactSubmission).mockResolvedValue({
      outcome: "block",
      reason: "ip_short_window",
      message: "Too many submissions. Try again in a minute.",
      retryAfterSeconds: 60,
      metadata: {} as never,
    });

    const res = await POST(postReq(validPayload()));
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("60");
    expect(res.headers.get("cache-control")).toBe("no-store");

    const body = (await res.json()) as { success: boolean; message: string };
    expect(body.success).toBe(false);
    expect(body.message).toMatch(/Try again/);

    expect(storage.saveContactLead).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Schema validation
// ---------------------------------------------------------------------------

describe("POST /api/contact — schema validation", () => {
  it("returns 400 with fieldErrors when a required field is missing (name)", async () => {
    const payload = validPayload();
    delete (payload as Record<string, unknown>).name;

    const res = await POST(postReq(payload));
    expect(res.status).toBe(400);

    const body = (await res.json()) as {
      success: boolean;
      fieldErrors: Record<string, string[]>;
    };
    expect(body.success).toBe(false);
    expect(body.fieldErrors.name).toBeDefined();

    // Abuse assessor + storage NOT reached when schema fails.
    expect(abuse.assessContactSubmission).not.toHaveBeenCalled();
    expect(storage.saveContactLead).not.toHaveBeenCalled();
  });

  it("returns 400 when email is malformed", async () => {
    const res = await POST(postReq(validPayload({ email: "not-an-email" })));
    expect(res.status).toBe(400);

    const body = (await res.json()) as { fieldErrors: Record<string, string[]> };
    expect(body.fieldErrors.email).toBeDefined();
  });

  it("returns 400 when brief is too short (< 10 chars)", async () => {
    const res = await POST(postReq(validPayload({ brief: "short" })));
    expect(res.status).toBe(400);

    const body = (await res.json()) as { fieldErrors: Record<string, string[]> };
    expect(body.fieldErrors.brief).toBeDefined();
  });

  it("returns 400 when inquiry path is not allowed under contactType (superRefine)", async () => {
    // "seller" inquiry requires contactType=partnership, but we send
    // contactType=general — superRefine flags it.
    const res = await POST(
      postReq(validPayload({ contactType: "general", inquiry: "seller" })),
    );
    expect(res.status).toBe(400);

    const body = (await res.json()) as { fieldErrors: Record<string, string[]> };
    expect(body.fieldErrors.inquiry).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Storage failure
// ---------------------------------------------------------------------------

describe("POST /api/contact — storage failure", () => {
  it("returns 500 with friendly fallback message that includes the inbox", async () => {
    vi.mocked(storage.saveContactLead).mockRejectedValue(
      new Error("Postgres timeout"),
    );

    const res = await POST(postReq(validPayload()));
    expect(res.status).toBe(500);

    const body = (await res.json()) as { success: boolean; message: string };
    expect(body.success).toBe(false);
    // Message gives the user a fallback channel (the contact inbox).
    expect(body.message).toMatch(/contact us directly/i);
    expect(body.message).toContain("@"); // contains an email address
    // Internal error not leaked.
    expect(body.message).not.toContain("Postgres");
  });
});
