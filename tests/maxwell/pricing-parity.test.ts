/**
 * Cross-repo pricing parity (auditoría 2026-07 F2-05/F7-01): PRICING_TABLE in
 * proposal-rules.ts and the App's lib/maxwell/pricing.ts are the same
 * commercial truth maintained twice. Each repo pins its local table against
 * the SHARED canonical snapshot lib/maxwell/pricing-table.v1.json
 * (byte-identical twin committed in both repos). An accidental local edit
 * fails here; a deliberate pricing change must touch the JSON, whose diff is
 * the cross-repo sync signal.
 */

import { describe, expect, it } from "vitest";
import {
  PRICING_TABLE,
  type ComplexityTier,
  type ProjectCategory,
} from "@/lib/maxwell/proposal-rules";
import canonical from "@/lib/maxwell/pricing-table.v1.json";
import { HOSTING_MONTHLY_USD, HOSTING_YEARLY_USD } from "@/lib/maxwell/hosting-billing";

// The canonical snapshot uses the App's tier naming; this repo names tiers in
// Spanish. Same three levels, fixed mapping.
const TIER_MAP: Record<"low" | "medium" | "high", ComplexityTier> = {
  low: "bajo",
  medium: "medio",
  high: "alto",
};

const CATEGORIES = Object.keys(canonical.table) as ProjectCategory[];

describe("cross-repo pricing parity", () => {
  it("canonical snapshot is v1 and covers the full 5×3 matrix", () => {
    expect(canonical.version).toBe(1);
    expect(CATEGORIES.sort()).toEqual(
      (Object.keys(PRICING_TABLE) as ProjectCategory[]).sort()
    );
  });

  it("PRICING_TABLE matches the canonical snapshot cell-for-cell (30 values)", () => {
    for (const category of CATEGORIES) {
      for (const level of ["low", "medium", "high"] as const) {
        const cell = canonical.table[category][level];
        const local = PRICING_TABLE[category][TIER_MAP[level]];
        expect(local.activation, `${category}.${level}.activation`).toBe(cell.activation);
        expect(local.monthly, `${category}.${level}.monthly`).toBe(cell.monthly);
      }
    }
  });
});

/**
 * The membership INCLUDES hosting + database (owner model), so it can never
 * cost LESS than buying hosting on its own — that would price the plan which
 * strictly contains the other one below it, and no client would ever pick
 * hosting-only. That inversion was real until 2026-07-23 (landing sat at
 * $25/$32 against $35 hosting); these tests keep it from coming back the next
 * time either side of the pricing moves.
 */
describe("membership vs standalone hosting", () => {
  it("every membership monthly is above the standalone hosting monthly", () => {
    for (const category of CATEGORIES) {
      for (const level of ["low", "medium", "high"] as const) {
        const monthly = PRICING_TABLE[category][TIER_MAP[level]].monthly;
        expect(monthly, `${category}.${level} membership vs hosting`).toBeGreaterThan(
          HOSTING_MONTHLY_USD,
        );
      }
    }
  });

  it("a full year of the cheapest membership still beats a year of hosting alone", () => {
    // The yearly hosting plan is discounted, so it's the harder bar to clear —
    // check the cheapest membership against it, not against the monthly rate.
    const cheapestMonthly = Math.min(
      ...CATEGORIES.flatMap((category) =>
        (["low", "medium", "high"] as const).map(
          (level) => PRICING_TABLE[category][TIER_MAP[level]].monthly,
        ),
      ),
    );
    expect(cheapestMonthly * 12).toBeGreaterThan(HOSTING_YEARLY_USD);
  });
});
