/**
 * tests/maxwell/polling-progress.test.ts
 *
 * B28 — Tests para los helpers puros del indicador de progreso polling v0.
 *
 * Cobertura:
 * - formatElapsed: 0, sub-60, exact 60, mid-minute, edge cases (NaN, negativos)
 * - classifyPollingPhase: bordes de los 4 buckets (15, 45, 90)
 * - pollingStatusText: una línea por fase
 * - pollingStatusForElapsed: equivalencia con la composición de los dos anteriores
 */

import { describe, expect, it } from "vitest";
import {
  classifyPollingPhase,
  formatElapsed,
  pollingStatusForElapsed,
  pollingStatusText,
} from "@/lib/maxwell/polling-progress";

describe("formatElapsed", () => {
  it("returns 0s for 0 seconds", () => {
    expect(formatElapsed(0)).toBe("0s");
  });

  it("returns Xs for sub-60 second values", () => {
    expect(formatElapsed(1)).toBe("1s");
    expect(formatElapsed(15)).toBe("15s");
    expect(formatElapsed(59)).toBe("59s");
  });

  it("returns Xm for exact-minute multiples", () => {
    expect(formatElapsed(60)).toBe("1m");
    expect(formatElapsed(120)).toBe("2m");
    expect(formatElapsed(600)).toBe("10m");
  });

  it("returns Xm Ys for mid-minute values", () => {
    expect(formatElapsed(75)).toBe("1m 15s");
    expect(formatElapsed(125)).toBe("2m 5s");
    expect(formatElapsed(3661)).toBe("61m 1s");
  });

  it("floors fractional seconds (avoids '1.5s' jitter from setInterval drift)", () => {
    expect(formatElapsed(15.7)).toBe("15s");
    expect(formatElapsed(59.999)).toBe("59s");
  });

  it("normalises negative and NaN to 0s (defensive against NTP / clock drift)", () => {
    expect(formatElapsed(-5)).toBe("0s");
    expect(formatElapsed(NaN)).toBe("0s");
    expect(formatElapsed(Infinity)).toBe("0s");
  });
});

describe("classifyPollingPhase", () => {
  it("classifies sub-15s as 'setup'", () => {
    expect(classifyPollingPhase(0)).toBe("setup");
    expect(classifyPollingPhase(7)).toBe("setup");
    expect(classifyPollingPhase(14)).toBe("setup");
  });

  it("classifies 15-44s as 'generating'", () => {
    expect(classifyPollingPhase(15)).toBe("generating");
    expect(classifyPollingPhase(30)).toBe("generating");
    expect(classifyPollingPhase(44)).toBe("generating");
  });

  it("classifies 45-89s as 'almost'", () => {
    expect(classifyPollingPhase(45)).toBe("almost");
    expect(classifyPollingPhase(60)).toBe("almost");
    expect(classifyPollingPhase(89)).toBe("almost");
  });

  it("classifies 90s+ as 'extended'", () => {
    expect(classifyPollingPhase(90)).toBe("extended");
    expect(classifyPollingPhase(180)).toBe("extended");
    expect(classifyPollingPhase(600)).toBe("extended");
  });

  it("treats negative / NaN / Infinity as setup (0s)", () => {
    expect(classifyPollingPhase(-3)).toBe("setup");
    expect(classifyPollingPhase(NaN)).toBe("setup");
    expect(classifyPollingPhase(Infinity)).toBe("setup");
  });
});

describe("pollingStatusText", () => {
  it("returns a distinct copy for each phase", () => {
    const setup = pollingStatusText("setup");
    const generating = pollingStatusText("generating");
    const almost = pollingStatusText("almost");
    const extended = pollingStatusText("extended");

    expect(setup).not.toBe(generating);
    expect(generating).not.toBe(almost);
    expect(almost).not.toBe(extended);
  });

  it("uses sentence case + trailing ellipsis on in-progress phases", () => {
    expect(pollingStatusText("setup")).toMatch(/setting up/i);
    expect(pollingStatusText("setup")).toMatch(/…$/);
    expect(pollingStatusText("generating")).toMatch(/…$/);
    expect(pollingStatusText("almost")).toMatch(/…$/);
  });

  it("uses explicit recovery copy on extended (no ellipsis, mentions retry)", () => {
    const copy = pollingStatusText("extended");
    expect(copy).toMatch(/longer than usual/i);
    expect(copy).toMatch(/try again/i);
    expect(copy).not.toMatch(/…$/);
  });
});

describe("pollingStatusForElapsed (convenience composition)", () => {
  it("matches pollingStatusText(classifyPollingPhase(seconds)) for representative inputs", () => {
    for (const seconds of [0, 14, 15, 44, 45, 89, 90, 600]) {
      expect(pollingStatusForElapsed(seconds)).toBe(
        pollingStatusText(classifyPollingPhase(seconds)),
      );
    }
  });
});
