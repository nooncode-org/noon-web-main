/**
 * tests/maxwell/prototipo-route-flag.test.ts
 *
 * Coverage for `isPrototipoDecisionRouteEnabled` — the env gate that hides
 * the D-slice route until App backend is live. Mirrors the lightweight test
 * style of the lifecycle-emails flag (covered indirectly via send tests).
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isPrototipoDecisionRouteEnabled } from "@/lib/maxwell/prototipo-route-flag";

const originalEnv = { ...process.env };

beforeEach(() => {
  delete process.env.MAXWELL_PROTOTIPO_DECISION_ROUTE;
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("isPrototipoDecisionRouteEnabled", () => {
  it("returns false when the env var is unset", () => {
    expect(isPrototipoDecisionRouteEnabled()).toBe(false);
  });

  it("returns false when the env var is empty", () => {
    process.env.MAXWELL_PROTOTIPO_DECISION_ROUTE = "";
    expect(isPrototipoDecisionRouteEnabled()).toBe(false);
  });

  it("returns false for any value other than the exact string '1'", () => {
    for (const value of ["0", "true", "yes", "on", "enabled", " 1 "]) {
      process.env.MAXWELL_PROTOTIPO_DECISION_ROUTE = value;
      expect(isPrototipoDecisionRouteEnabled()).toBe(false);
    }
  });

  it("returns true when the env var is exactly '1'", () => {
    process.env.MAXWELL_PROTOTIPO_DECISION_ROUTE = "1";
    expect(isPrototipoDecisionRouteEnabled()).toBe(true);
  });
});
