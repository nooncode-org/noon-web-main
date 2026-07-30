/**
 * tests/maxwell/portal-support-requests.test.ts
 *
 * The portal's two administrative asks — cancel my plan, export my data.
 *
 * These buttons used to be front-only: the dialog closed and nothing happened, so
 * a client could believe they had cancelled and be charged again next month. What
 * is pinned here is what keeps that from coming back quietly: the requests must
 * ride a type the Server Action will actually ACCEPT, cancellation must outrank a
 * routine ask, and the cancellation body must keep saying that nothing was
 * cancelled in Stripe.
 */
import { describe, expect, it } from "vitest";
import {
  CLIENT_REQUEST_BODY_MAX,
  CLIENT_REQUEST_BODY_MIN,
  isClientRequestPriority,
  isClientRequestType,
  isMembershipOnlyRequestType,
} from "@/lib/maxwell/client-requests";
import {
  portalSupportChatFallback,
  portalSupportRequest,
  type PortalSupportRequestKind,
} from "@/lib/maxwell/portal-support-requests";

const KINDS: PortalSupportRequestKind[] = ["cancel_membership", "export_project_data"];

describe("portalSupportRequest", () => {
  it("uses a type the frozen cross-repo vocabulary actually contains", () => {
    // The App enforces the 10 types with a DB CHECK. Inventing "cancel_plan" here
    // would be rejected at the far end — the request would never land.
    for (const kind of KINDS) {
      const req = portalSupportRequest(kind);
      expect(isClientRequestType(req.type)).toBe(true);
      expect(isClientRequestPriority(req.clientPriority)).toBe(true);
    }
  });

  it("never uses a membership-only type, so a one-time buyer can file it too", () => {
    // submitRequestAction rejects membership-only types with PLAN_NOT_ALLOWED. A
    // one-time client can legitimately ask for an export or to stop their hosting,
    // so picking e.g. `scope_change` here would silently lock them out.
    for (const kind of KINDS) {
      expect(isMembershipOnlyRequestType(portalSupportRequest(kind).type)).toBe(false);
    }
  });

  it("ranks cancellation above a routine ask", () => {
    // Time-sensitive money: every day it sits unread is a day closer to charging
    // someone who thinks they already cancelled.
    expect(portalSupportRequest("cancel_membership").clientPriority).toBe("high");
    expect(portalSupportRequest("export_project_data").clientPriority).toBe("normal");
  });

  it("warns, in the body, that Stripe was NOT touched", () => {
    // Whoever picks this up must not assume the subscription is already stopped.
    const body = portalSupportRequest("cancel_membership").body;
    expect(body.toLowerCase()).toContain("nothing has been cancelled in stripe");
  });

  it("says which flow each request came from", () => {
    expect(portalSupportRequest("cancel_membership").body).toContain("CANCELLATION");
    expect(portalSupportRequest("export_project_data").body.toLowerCase()).toContain("export");
    // Both name the screen, so the request is traceable without asking the client.
    for (const kind of KINDS) {
      expect(portalSupportRequest(kind).body).toContain("Settings ->");
    }
  });

  it("keeps every body inside the bounds the action validates", () => {
    for (const kind of KINDS) {
      const { body } = portalSupportRequest(kind);
      expect(body.length).toBeGreaterThanOrEqual(CLIENT_REQUEST_BODY_MIN);
      expect(body.length).toBeLessThanOrEqual(CLIENT_REQUEST_BODY_MAX);
    }
  });
});

describe("portalSupportChatFallback", () => {
  it("gives a real message for every kind — a click is never swallowed", () => {
    // Used when no session is wired (proposal page, wspreview playground): the
    // client is handed to a human instead of getting a fake confirmation.
    for (const kind of KINDS) {
      expect(portalSupportChatFallback(kind).length).toBeGreaterThan(10);
    }
    expect(portalSupportChatFallback("cancel_membership")).not.toBe(
      portalSupportChatFallback("export_project_data"),
    );
  });
});
