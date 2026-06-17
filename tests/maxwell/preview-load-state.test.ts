/**
 * tests/maxwell/preview-load-state.test.ts
 *
 * Pure-logic coverage for the preview-iframe load-state helpers: the overlay
 * the user sees per load status, and the bounded auto-reload decision.
 */

import { describe, expect, it } from "vitest";
import {
  MAX_PREVIEW_AUTO_RELOADS,
  PREVIEW_LOAD_TIMEOUT_MS,
  derivePreviewOverlay,
  shouldAutoReloadPreview,
} from "@/lib/maxwell/preview-load-state";

describe("derivePreviewOverlay", () => {
  it("hides the overlay once loaded (regardless of the slow hint)", () => {
    expect(derivePreviewOverlay("loaded", false)).toBe("hidden");
    expect(derivePreviewOverlay("loaded", true)).toBe("hidden");
  });

  it("shows the error overlay on error", () => {
    expect(derivePreviewOverlay("error", false)).toBe("error");
    expect(derivePreviewOverlay("error", true)).toBe("error");
  });

  it("shows loading while loading and the slow hint has not tripped", () => {
    expect(derivePreviewOverlay("loading", false)).toBe("loading");
  });

  it("escalates to the slow overlay once the slow hint is shown", () => {
    expect(derivePreviewOverlay("loading", true)).toBe("slow");
  });
});

describe("shouldAutoReloadPreview", () => {
  it("auto-reloads while under the cap", () => {
    expect(shouldAutoReloadPreview(0)).toBe(true);
    expect(shouldAutoReloadPreview(MAX_PREVIEW_AUTO_RELOADS - 1)).toBe(true);
  });

  it("stops auto-reloading at/over the cap (then the manual button takes over)", () => {
    expect(shouldAutoReloadPreview(MAX_PREVIEW_AUTO_RELOADS)).toBe(false);
    expect(shouldAutoReloadPreview(MAX_PREVIEW_AUTO_RELOADS + 1)).toBe(false);
  });
});

describe("thresholds", () => {
  it("uses sane, positive bounds", () => {
    expect(PREVIEW_LOAD_TIMEOUT_MS).toBeGreaterThan(0);
    expect(MAX_PREVIEW_AUTO_RELOADS).toBeGreaterThanOrEqual(1);
  });
});
