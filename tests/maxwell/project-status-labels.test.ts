/**
 * tests/maxwell/project-status-labels.test.ts
 *
 * NoonWeb owns the client-facing copy for the App's raw `project_status` enum
 * (master-spec-v3 §8.1). These tests lock the enum→label mapping and the
 * defensive fallbacks (unknown enum value, exotic currency code).
 */

import { describe, expect, it } from "vitest";
import {
  formatProposalAmount,
  mapProjectStatusToMeta,
} from "@/lib/maxwell/project-status-labels";

describe("mapProjectStatusToMeta", () => {
  it.each([
    ["backlog", "Scheduled"],
    ["in_progress", "In Development"],
    ["review", "In Review"],
    ["delivered", "Delivered"],
    ["completed", "Completed"],
  ])("maps %s to label %s", (status, label) => {
    expect(mapProjectStatusToMeta(status).label).toBe(label);
  });

  it("returns every meta field for a known status", () => {
    const meta = mapProjectStatusToMeta("in_progress");
    expect(meta.label).toBeTruthy();
    expect(meta.description).toBeTruthy();
    expect(meta.color).toContain("border");
  });

  it("degrades an unknown enum value to a neutral label (forward-compat)", () => {
    const meta = mapProjectStatusToMeta("some_future_status");
    expect(meta.label).toBe("In progress");
    expect(meta.color).toContain("border");
  });
});

describe("formatProposalAmount", () => {
  it("formats a USD amount with the currency symbol and no decimals", () => {
    expect(formatProposalAmount(1500, "USD")).toBe("$1,500");
  });

  it("uppercases and trims the currency code", () => {
    expect(formatProposalAmount(1500, " usd ")).toBe("$1,500");
  });

  it("falls back to '<amount> <CODE>' for an invalid currency code", () => {
    expect(formatProposalAmount(1500, "NOTACURRENCY")).toBe("1,500 NOTACURRENCY");
  });

  it("defaults an empty currency to USD", () => {
    expect(formatProposalAmount(2000, "")).toBe("$2,000");
  });
});
