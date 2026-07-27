/**
 * tests/maxwell/portal-support-requests.test.ts
 *
 * The portal's settings + domain asks (cancel plan / export data / connect
 * domain) are wired as `support` requests — the frozen 10-type wire has no
 * dedicated types for them, and `support` is "help, not new work". That wiring
 * silently breaks for one-time buyers (who must still be able to cancel their
 * hosting or connect a domain) if `support` ever joins the membership-only
 * lock. This pins the dependency.
 */
import { describe, expect, it } from "vitest";
import { isMembershipOnlyRequestType } from "@/lib/maxwell/client-requests";

describe("portal settings/domain asks ride `support`", () => {
  it("`support` stays available to one-time plans (cancel/export/connect depend on it)", () => {
    expect(isMembershipOnlyRequestType("support")).toBe(false);
  });
});
