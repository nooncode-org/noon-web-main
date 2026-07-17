/**
 * tests/maxwell/prototype-poll-policy.test.ts
 *
 * Unit tests for the pure poll-policy helpers that bound the v0 poll loop.
 * No I/O — covers the threshold boundaries and input normalization that both
 * the route and the client rely on.
 */

import { describe, expect, it } from "vitest";
import {
  GENERATION_IN_FLIGHT_WINDOW_MS,
  MAX_PROTOTYPE_POLL_ATTEMPTS,
  POLL_RESCUE_AFTER_ATTEMPTS,
  hasExceededPollBudget,
  isGenerationLikelyInFlight,
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

describe("isGenerationLikelyInFlight — same-session double-fire guard", () => {
  const NOW = Date.parse("2026-07-17T12:00:00Z");
  const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString();

  it("blocks a create while generating_prototype is fresh", () => {
    expect(isGenerationLikelyInFlight("generating_prototype", iso(5_000), NOW)).toBe(true);
    expect(
      isGenerationLikelyInFlight(
        "generating_prototype",
        iso(GENERATION_IN_FLIGHT_WINDOW_MS - 1),
        NOW,
      ),
    ).toBe(true);
  });

  it("reopens the retry lane once the row is an orphan (past the window)", () => {
    expect(
      isGenerationLikelyInFlight(
        "generating_prototype",
        iso(GENERATION_IN_FLIGHT_WINDOW_MS),
        NOW,
      ),
    ).toBe(false);
  });

  it("never blocks other statuses", () => {
    expect(isGenerationLikelyInFlight("clarifying", iso(0), NOW)).toBe(false);
    expect(isGenerationLikelyInFlight("prototype_ready", iso(0), NOW)).toBe(false);
    expect(isGenerationLikelyInFlight("revision_requested", iso(0), NOW)).toBe(false);
  });

  it("fails open on missing or unparseable timestamps", () => {
    expect(isGenerationLikelyInFlight("generating_prototype", null, NOW)).toBe(false);
    expect(isGenerationLikelyInFlight("generating_prototype", undefined, NOW)).toBe(false);
    expect(isGenerationLikelyInFlight("generating_prototype", "not-a-date", NOW)).toBe(false);
  });

  it("keeps the window above the poll budget so a live loop can never be past it", () => {
    expect(GENERATION_IN_FLIGHT_WINDOW_MS).toBeGreaterThan(MAX_PROTOTYPE_POLL_ATTEMPTS * 5000);
  });
});
