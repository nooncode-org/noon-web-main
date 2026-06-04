/**
 * tests/maxwell/prototype-poll-policy.test.ts
 *
 * Unit tests for the pure poll-policy helpers that bound the v0 poll loop.
 * No I/O — covers the threshold boundaries and input normalization that both
 * the route and the client rely on.
 */

import { describe, expect, it } from "vitest";
import {
  MAX_PROTOTYPE_POLL_ATTEMPTS,
  POLL_RESCUE_AFTER_ATTEMPTS,
  hasExceededPollBudget,
  normalizePollAttempt,
  shouldRescueUnstableCompletion,
} from "@/lib/maxwell/prototype-poll-policy";

describe("prototype-poll-policy — thresholds", () => {
  it("keeps the rescue threshold strictly below the hard cap", () => {
    expect(POLL_RESCUE_AFTER_ATTEMPTS).toBeLessThan(MAX_PROTOTYPE_POLL_ATTEMPTS);
  });
});

describe("normalizePollAttempt", () => {
  it("defaults to 1 for missing / invalid / sub-1 inputs", () => {
    expect(normalizePollAttempt(null)).toBe(1);
    expect(normalizePollAttempt(undefined)).toBe(1);
    expect(normalizePollAttempt("")).toBe(1);
    expect(normalizePollAttempt("nope")).toBe(1);
    expect(normalizePollAttempt(0)).toBe(1);
    expect(normalizePollAttempt(-5)).toBe(1);
    expect(normalizePollAttempt(Number.NaN)).toBe(1);
  });

  it("parses string query values and floors them", () => {
    expect(normalizePollAttempt("12")).toBe(12);
    expect(normalizePollAttempt("36")).toBe(36);
    expect(normalizePollAttempt(7.9)).toBe(7);
  });
});

describe("hasExceededPollBudget", () => {
  it("is false below the cap and true at/above it", () => {
    expect(hasExceededPollBudget(MAX_PROTOTYPE_POLL_ATTEMPTS - 1)).toBe(false);
    expect(hasExceededPollBudget(MAX_PROTOTYPE_POLL_ATTEMPTS)).toBe(true);
    expect(hasExceededPollBudget(MAX_PROTOTYPE_POLL_ATTEMPTS + 10)).toBe(true);
  });

  it("never trips on the first attempt", () => {
    expect(hasExceededPollBudget(1)).toBe(false);
  });
});

describe("shouldRescueUnstableCompletion", () => {
  it("is false below the rescue threshold and true at/above it", () => {
    expect(shouldRescueUnstableCompletion(POLL_RESCUE_AFTER_ATTEMPTS - 1)).toBe(false);
    expect(shouldRescueUnstableCompletion(POLL_RESCUE_AFTER_ATTEMPTS)).toBe(true);
    expect(shouldRescueUnstableCompletion(POLL_RESCUE_AFTER_ATTEMPTS + 1)).toBe(true);
  });

  it("does not rescue on the first attempt", () => {
    expect(shouldRescueUnstableCompletion(1)).toBe(false);
  });
});
