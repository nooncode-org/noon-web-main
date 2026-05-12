import { describe, expect, it } from "vitest";
import { fromStripeMinorUnit, toStripeMinorUnit } from "@/lib/stripe/server";

describe("Stripe server helpers", () => {
  it("converts USD amounts to Stripe minor units", () => {
    expect(toStripeMinorUnit(4500, "USD")).toBe(450000);
    expect(toStripeMinorUnit(10.25, "usd")).toBe(1025);
  });

  it("keeps zero-decimal currencies in whole units", () => {
    expect(toStripeMinorUnit(1200, "JPY")).toBe(1200);
    expect(fromStripeMinorUnit(1200, "JPY")).toBe(1200);
  });

  it("rejects non-positive amounts", () => {
    expect(() => toStripeMinorUnit(0, "USD")).toThrow(/greater than zero/i);
  });
});
