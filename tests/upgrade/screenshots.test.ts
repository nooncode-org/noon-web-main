/**
 * tests/upgrade/screenshots.test.ts
 *
 * Tarea #41 — the /upgrade audit gets eyes. What must hold:
 *
 *   - every URL is the CLIENT'S, so every URL passes the SSRF guard
 *     before a browser opens it — a refused page is skipped, not fetched;
 *   - captures are capped (an audit is not a crawl);
 *   - and the whole thing is optional: no captures means the audit runs
 *     on text exactly as it did before, never an error.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/maxwell/client-reference-guard", () => ({
  guardClientReferenceUrl: vi.fn(),
}));
vi.mock("@/lib/maxwell/reference-study/card-capture", () => ({
  ensureCardCapture: vi.fn(),
  readCardCapture: vi.fn(),
}));

import { guardClientReferenceUrl } from "@/lib/maxwell/client-reference-guard";
import {
  ensureCardCapture,
  readCardCapture,
} from "@/lib/maxwell/reference-study/card-capture";
import { captureUpgradeScreenshots } from "@/lib/upgrade/screenshots";

describe("captureUpgradeScreenshots", () => {
  afterEach(() => vi.clearAllMocks());

  it("guards every URL before capturing, and caps at two pages", async () => {
    vi.mocked(guardClientReferenceUrl).mockImplementation(async (url) => ({
      ok: true,
      url,
    }));
    vi.mocked(ensureCardCapture).mockResolvedValue("abc123");
    vi.mocked(readCardCapture).mockResolvedValue(Buffer.from([0xff, 0xd8, 0xff]));

    const out = await captureUpgradeScreenshots([
      "https://client.example/",
      "https://client.example/about",
      "https://client.example/contact",
    ]);

    expect(out).toHaveLength(2);
    expect(out[0].startsWith("data:image/jpeg;base64,")).toBe(true);
    // The guard ran for each page it attempted — never a raw fetch.
    expect(guardClientReferenceUrl).toHaveBeenCalled();
    expect(vi.mocked(ensureCardCapture).mock.calls.length).toBeLessThanOrEqual(2);
  });

  it("skips a page the guard refuses instead of opening it", async () => {
    vi.mocked(guardClientReferenceUrl).mockResolvedValue({
      ok: false,
      reason: "private",
    });

    const out = await captureUpgradeScreenshots(["http://169.254.169.254/"]);

    expect(out).toEqual([]);
    expect(ensureCardCapture).not.toHaveBeenCalled();
  });

  it("returns nothing when a page cannot be captured — the audit still runs", async () => {
    vi.mocked(guardClientReferenceUrl).mockImplementation(async (url) => ({
      ok: true,
      url,
    }));
    vi.mocked(ensureCardCapture).mockResolvedValue(null);

    await expect(
      captureUpgradeScreenshots(["https://client.example/"]),
    ).resolves.toEqual([]);
  });

  it("survives a capture that throws", async () => {
    vi.mocked(guardClientReferenceUrl).mockImplementation(async (url) => ({
      ok: true,
      url,
    }));
    vi.mocked(ensureCardCapture).mockRejectedValue(new Error("browser died"));

    await expect(
      captureUpgradeScreenshots(["https://client.example/"]),
    ).resolves.toEqual([]);
  });
});
